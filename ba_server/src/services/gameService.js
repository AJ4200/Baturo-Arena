const HttpError = require('../errors/HttpError');
const {
  upsertPlayer,
  getPlayerById,
  incrementPlayerStats,
  incrementPlayerGameStats,
  listPlayersByScore,
  listPlayersByGameScore,
} = require('../repositories/playerRepository');
const {
  createRoom,
  getRoomByCode,
  getRoomById,
  listPublicRooms,
  addPlayerToRoom,
  removePlayerFromRoom,
  findRoomPlayer,
  listRoomPlayers,
  updateRoomState,
  countRoomPlayers,
  claimRoomResultRecording,
  setRoomResultRecorded,
} = require('../repositories/roomRepository');
const { createRoomCode } = require('../utils/roomCode');
const { checkWinner, applyMove, isValidMove, createEmptyBoard } = require('../utils/game');
const { listGames, getGameById } = require('./gamesCatalog');

const TURN_SYMBOLS = ['X', 'O', 'Y', 'Z'];
const LUDO_TOKENS_PER_PLAYER = 4;
const LUDO_HOME_PROGRESS = 57;
const LUDO_HOME_LANE_START_PROGRESS = 51;
const LUDO_SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LUDO_START_INDEX_BY_SYMBOL = {
  X: 0,
  O: 13,
  Y: 26,
  Z: 39,
};

function serializePlayer(player) {
  if (!player) {
    return null;
  }

  return {
    playerId: player.id,
    name: player.name,
    wins: Number(player.wins),
    losses: Number(player.losses),
    draws: Number(player.draws),
  };
}

function serializeLeaderboardPlayer(player) {
  return {
    ...serializePlayer(player),
    score: Number(player.score),
  };
}

async function ensureRoom(code) {
  const room = await getRoomByCode(code);
  if (!room) {
    throw new HttpError(404, 'Room not found');
  }
  return room;
}

async function applyMatchResult(roomId, gameType, winner) {
  const players = await listRoomPlayers(roomId);

  if (winner === 'draw') {
    await Promise.all(
      players.map(async (player) => {
        await incrementPlayerStats(player.player_id, { draws: 1 });
        await incrementPlayerGameStats(player.player_id, gameType, { draws: 1 });
      })
    );
    return;
  }

  await Promise.all(
    players.map(async (player) => {
      if (player.symbol === winner) {
        await incrementPlayerStats(player.player_id, { wins: 1 });
        await incrementPlayerGameStats(player.player_id, gameType, { wins: 1 });
        return;
      }

      await incrementPlayerStats(player.player_id, { losses: 1 });
      await incrementPlayerGameStats(player.player_id, gameType, { losses: 1 });
    })
  );
}

async function ensureMatchResultRecorded(room) {
  if (!room || room.status !== 'finished' || !room.winner || room.result_recorded) {
    return;
  }

  const claimed = await claimRoomResultRecording(room.id);
  if (!claimed) {
    return;
  }

  try {
    await applyMatchResult(room.id, room.game_type, room.winner);
  } catch (error) {
    await setRoomResultRecorded(room.id, false);
    throw error;
  }
}

async function buildRoomResponse(room, playerId) {
  const players = await listRoomPlayers(room.id);
  const youMembership = playerId
    ? players.find((entry) => entry.player_id === playerId) || null
    : null;
  const you = playerId ? await getPlayerById(playerId) : null;

  return {
    room: {
      code: room.code,
      name: room.name,
      gameType: room.game_type || 'tic-tac-two',
      maxPlayers: Number(room.max_players || 4),
      isPublic: room.is_public,
      board: room.board,
      turn: room.turn,
      status: room.status,
      winner: room.winner,
      playersCount: players.length,
      players: players.map((entry) => ({
        playerId: entry.player_id,
        name: entry.name,
        symbol: entry.symbol,
        wins: Number(entry.wins),
        losses: Number(entry.losses),
        draws: Number(entry.draws),
      })),
    },
    yourSymbol: youMembership ? youMembership.symbol : null,
    you: serializePlayer(you),
  };
}

function getRoomStatusByPlayerCount(playerCount, minPlayers) {
  return playerCount >= minPlayers ? 'playing' : 'waiting';
}

function getAllowedTurnSymbols(maxPlayers) {
  const safeMax = Math.max(2, Math.min(4, Number(maxPlayers || 2)));
  return TURN_SYMBOLS.slice(0, safeMax);
}

function getTurnSymbolsInRoom(players, maxPlayers) {
  const allowed = getAllowedTurnSymbols(maxPlayers);
  const present = new Set(players.map((entry) => entry.symbol));
  return allowed.filter((symbol) => present.has(symbol));
}

function pickSymbol(players, maxPlayers) {
  const allowed = getAllowedTurnSymbols(maxPlayers);
  const occupied = new Set(players.map((entry) => entry.symbol));
  return allowed.find((symbol) => !occupied.has(symbol)) || null;
}

function getInitialTurn(players, maxPlayers) {
  const turnSymbols = getTurnSymbolsInRoom(players, maxPlayers);
  return turnSymbols[0] || 'X';
}

function getNextTurnSymbol(currentTurn, players, maxPlayers) {
  const turnSymbols = getTurnSymbolsInRoom(players, maxPlayers);
  if (turnSymbols.length === 0) {
    return 'X';
  }

  const currentIndex = turnSymbols.indexOf(currentTurn);
  if (currentIndex < 0) {
    return turnSymbols[0];
  }

  return turnSymbols[(currentIndex + 1) % turnSymbols.length];
}

function createLudoBoardState(turnSymbols) {
  const safeSymbols = turnSymbols.filter((symbol) => TURN_SYMBOLS.includes(symbol));
  const tokens = {};
  safeSymbols.forEach((symbol) => {
    tokens[symbol] = Array(LUDO_TOKENS_PER_PLAYER).fill(-1);
  });
  return {
    mode: 'ludo',
    diceValue: null,
    tokens,
  };
}

function normalizeLudoBoardState(board, turnSymbols) {
  const fallback = createLudoBoardState(turnSymbols);
  if (!board || typeof board !== 'object' || board.mode !== 'ludo') {
    return fallback;
  }

  const tokens = {};
  turnSymbols.forEach((symbol) => {
    const value = board.tokens?.[symbol];
    if (!Array.isArray(value) || value.length !== LUDO_TOKENS_PER_PLAYER) {
      tokens[symbol] = Array(LUDO_TOKENS_PER_PLAYER).fill(-1);
      return;
    }
    tokens[symbol] = value.map((entry) => {
      const parsed = Number(entry);
      if (!Number.isInteger(parsed)) {
        return -1;
      }
      return Math.max(-1, Math.min(LUDO_HOME_PROGRESS, parsed));
    });
  });

  const parsedDiceValue = Number(board.diceValue);
  return {
    mode: 'ludo',
    diceValue: Number.isInteger(parsedDiceValue) ? Math.max(1, Math.min(6, parsedDiceValue)) : null,
    tokens,
  };
}

function getLudoTrackIndex(symbol, progress) {
  if (progress < 0 || progress > 50) {
    return null;
  }
  const startIndex = LUDO_START_INDEX_BY_SYMBOL[symbol];
  if (typeof startIndex !== 'number') {
    return null;
  }
  return (startIndex + progress) % 52;
}

function getLudoMovableTokenIds(boardState, symbol, diceValue) {
  const values = Array.isArray(boardState.tokens?.[symbol]) ? boardState.tokens[symbol] : [];
  const tokenIds = [];

  values.forEach((progress, index) => {
    if (!Number.isInteger(progress) || progress === LUDO_HOME_PROGRESS) {
      return;
    }
    if (progress === -1) {
      if (diceValue === 6) {
        tokenIds.push(`${symbol}-${index + 1}`);
      }
      return;
    }
    if (progress + diceValue <= LUDO_HOME_PROGRESS) {
      tokenIds.push(`${symbol}-${index + 1}`);
    }
  });

  return tokenIds;
}

function parseLudoTokenId(tokenId) {
  const match = /^([XOYZ])-(\d)$/.exec(String(tokenId || ''));
  if (!match) {
    return null;
  }
  const symbol = match[1];
  const slot = Number(match[2]) - 1;
  if (slot < 0 || slot >= LUDO_TOKENS_PER_PLAYER) {
    return null;
  }
  return { symbol, slot };
}

function hasLudoWinner(boardState, symbol) {
  const values = Array.isArray(boardState.tokens?.[symbol]) ? boardState.tokens[symbol] : [];
  return (
    values.length === LUDO_TOKENS_PER_PLAYER &&
    values.every((progress) => progress === LUDO_HOME_PROGRESS)
  );
}

function applyLudoTokenMove(boardState, symbol, tokenId, diceValue, turnSymbols) {
  const parsedToken = parseLudoTokenId(tokenId);
  if (!parsedToken || parsedToken.symbol !== symbol) {
    return null;
  }

  const current = boardState.tokens?.[symbol]?.[parsedToken.slot];
  if (!Number.isInteger(current)) {
    return null;
  }

  let nextProgress = current;
  if (current === -1) {
    if (diceValue !== 6) {
      return null;
    }
    nextProgress = 0;
  } else {
    nextProgress = current + diceValue;
    if (nextProgress > LUDO_HOME_PROGRESS) {
      return null;
    }
  }

  const nextTokens = {};
  turnSymbols.forEach((turnSymbol) => {
    const values = Array.isArray(boardState.tokens?.[turnSymbol])
      ? boardState.tokens[turnSymbol]
      : Array(LUDO_TOKENS_PER_PLAYER).fill(-1);
    nextTokens[turnSymbol] = [...values];
  });
  nextTokens[symbol][parsedToken.slot] = nextProgress;

  let captured = 0;
  const destinationTrackIndex = getLudoTrackIndex(symbol, nextProgress);

  if (destinationTrackIndex !== null && !LUDO_SAFE_TRACK_INDEXES.has(destinationTrackIndex)) {
    turnSymbols.forEach((turnSymbol) => {
      if (turnSymbol === symbol) {
        return;
      }
      nextTokens[turnSymbol] = nextTokens[turnSymbol].map((progress) => {
        const index = getLudoTrackIndex(turnSymbol, progress);
        if (index !== destinationTrackIndex) {
          return progress;
        }
        captured += 1;
        return -1;
      });
    });
  }

  return {
    board: {
      mode: 'ludo',
      diceValue: null,
      tokens: nextTokens,
    },
    captured,
    reachedHome: nextProgress === LUDO_HOME_PROGRESS,
  };
}

function applyLudoAction(boardState, symbol, action, turnSymbols) {
  const nextTurnFor = (currentTurn) => {
    const currentIndex = turnSymbols.indexOf(currentTurn);
    if (currentIndex < 0) {
      return turnSymbols[0] || 'X';
    }
    return turnSymbols[(currentIndex + 1) % Math.max(1, turnSymbols.length)] || 'X';
  };

  const actionType = action?.action;
  if (actionType === 'roll') {
    if (boardState.diceValue !== null) {
      return { error: 'Select a token before rolling again' };
    }

    const rolled = Math.floor(Math.random() * 6) + 1;
    const movableTokenIds = getLudoMovableTokenIds(boardState, symbol, rolled);
    if (movableTokenIds.length === 0) {
      return {
        board: { ...boardState, diceValue: null },
        turn: nextTurnFor(symbol),
        status: 'playing',
        winner: null,
      };
    }

    return {
      board: { ...boardState, diceValue: rolled },
      turn: symbol,
      status: 'playing',
      winner: null,
    };
  }

  if (actionType === 'move') {
    if (!Number.isInteger(boardState.diceValue)) {
      return { error: 'Roll first before moving a token' };
    }

    const movableTokenIds = getLudoMovableTokenIds(boardState, symbol, boardState.diceValue);
    if (!movableTokenIds.includes(String(action?.tokenId || ''))) {
      return { error: 'Selected token cannot move with this dice value' };
    }

    const resolution = applyLudoTokenMove(
      boardState,
      symbol,
      String(action.tokenId),
      boardState.diceValue,
      turnSymbols
    );
    if (!resolution) {
      return { error: 'Could not apply token move' };
    }

    if (hasLudoWinner(resolution.board, symbol)) {
      return {
        board: resolution.board,
        turn: symbol,
        status: 'finished',
        winner: symbol,
      };
    }

    const earnedExtraTurn =
      boardState.diceValue === 6 || resolution.captured > 0 || resolution.reachedHome;

    return {
      board: resolution.board,
      turn: earnedExtraTurn ? symbol : nextTurnFor(symbol),
      status: 'playing',
      winner: null,
    };
  }

  return { error: 'Invalid ludo action' };
}

async function resetRoomForPlayers(room, gameDefinition) {
  const players = await listRoomPlayers(room.id);
  const playerCount = players.length;
  const status = getRoomStatusByPlayerCount(playerCount, gameDefinition.minPlayers);
  const turnSymbols = getTurnSymbolsInRoom(players, room.max_players || gameDefinition.maxPlayers);
  const turn = getInitialTurn(players, room.max_players || gameDefinition.maxPlayers);
  const board =
    gameDefinition.id === 'ludo'
      ? createLudoBoardState(turnSymbols)
      : createEmptyBoard(gameDefinition.id);

  await updateRoomState(room.id, {
    board,
    turn,
    status,
    winner: null,
    resultRecorded: false,
  });
}

async function registerPlayer({ playerId, name }) {
  const player = await upsertPlayer({ playerId, name });
  return serializePlayer(player);
}

async function recordPlayerMatchResult({ playerId, gameType, outcome }) {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new HttpError(400, 'Invalid playerId');
  }

  const selectedGame = getGameById(gameType || 'tic-tac-two');
  if (!selectedGame) {
    throw new HttpError(400, 'Unsupported game type');
  }

  if (outcome !== 'win' && outcome !== 'loss' && outcome !== 'draw') {
    throw new HttpError(400, 'Invalid outcome');
  }

  const delta =
    outcome === 'win'
      ? { wins: 1, losses: 0, draws: 0 }
      : outcome === 'loss'
        ? { wins: 0, losses: 1, draws: 0 }
        : { wins: 0, losses: 0, draws: 1 };

  await incrementPlayerStats(playerId, delta);
  await incrementPlayerGameStats(playerId, selectedGame.id, delta);

  const updatedPlayer = await getPlayerById(playerId);
  return serializePlayer(updatedPlayer);
}

async function createNewRoom({ playerId, roomName, isPublic, gameType }) {
  const owner = await getPlayerById(playerId);
  if (!owner) {
    throw new HttpError(400, 'Invalid playerId');
  }

  const selectedGame = getGameById(gameType || 'tic-tac-two');
  if (!selectedGame) {
    throw new HttpError(400, 'Unsupported game type');
  }
  if (!selectedGame.supportsOnline) {
    throw new HttpError(400, `${selectedGame.name} is single-player only`);
  }

  let code = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateCode = createRoomCode();
    // eslint-disable-next-line no-await-in-loop
    const existing = await getRoomByCode(candidateCode);
    if (!existing) {
      code = candidateCode;
      break;
    }
  }

  if (!code) {
    throw new HttpError(500, 'Could not generate room code');
  }

  const safeName = (roomName && String(roomName).trim()) || `${owner.name}'s Room`;
  const room = await createRoom({
    code,
    name: safeName,
    isPublic: Boolean(isPublic),
    creatorPlayerId: playerId,
    gameType: selectedGame.id,
    maxPlayers: selectedGame.maxPlayers,
  });

  await addPlayerToRoom(room.id, playerId, 'X');
  const createdRoom = await getRoomById(room.id);
  await resetRoomForPlayers(createdRoom, selectedGame);
  const freshRoom = await getRoomById(room.id);
  return buildRoomResponse(freshRoom || createdRoom, playerId);
}

async function joinExistingRoom({ playerId, code }) {
  const roomCode = String(code || '').trim().toUpperCase();
  if (!roomCode) {
    throw new HttpError(400, 'Room code is required');
  }

  const room = await ensureRoom(roomCode);
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new HttpError(400, 'Invalid playerId');
  }

  const gameDefinition = getGameById(room.game_type || 'tic-tac-two');
  if (!gameDefinition) {
    throw new HttpError(500, 'Room game type is invalid');
  }
  if (!gameDefinition.supportsOnline) {
    throw new HttpError(409, `${gameDefinition.name} rooms are not joinable online`);
  }

  const existingMembership = await findRoomPlayer(room.id, playerId);
  if (!existingMembership) {
    const players = await listRoomPlayers(room.id);
    const maxPlayers = Number(room.max_players || gameDefinition.maxPlayers);
    if (players.length >= maxPlayers) {
      throw new HttpError(409, 'Room is full');
    }

    const symbol = pickSymbol(players, maxPlayers);
    if (!symbol) {
      throw new HttpError(409, 'No available symbol slots in this room');
    }
    await addPlayerToRoom(room.id, playerId, symbol);
    const refreshed = await getRoomById(room.id);
    if (refreshed) {
      await resetRoomForPlayers(refreshed, gameDefinition);
    }
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function getRoomState({ code, playerId }) {
  const roomCode = String(code || '').trim().toUpperCase();
  let room = await ensureRoom(roomCode);

  if (room.status === 'finished' && room.winner && !room.result_recorded) {
    try {
      await ensureMatchResultRecorded(room);
      const refreshedRoom = await getRoomById(room.id);
      if (refreshedRoom) {
        room = refreshedRoom;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to record finished room result during room sync', {
        roomId: room.id,
        roomCode: room.code,
        gameType: room.game_type,
        winner: room.winner,
      }, error);
    }
  }

  return buildRoomResponse(room, playerId || null);
}

async function makeMove({ code, playerId, index, move }) {
  const roomCode = String(code || '').trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);

  if (!membership) {
    throw new HttpError(403, 'Player is not in this room');
  }

  if (room.status !== 'playing') {
    throw new HttpError(409, 'Game is not in playing state');
  }

  if (membership.symbol !== room.turn) {
    throw new HttpError(409, 'Not your turn');
  }

  const gameDefinition = getGameById(room.game_type || 'tic-tac-two');
  if (!gameDefinition) {
    throw new HttpError(500, 'Room game type is invalid');
  }
  const roomPlayers = await listRoomPlayers(room.id);
  const maxPlayers = Number(room.max_players || gameDefinition.maxPlayers);

  if (room.game_type === 'ludo') {
    if (!move || typeof move !== 'object') {
      throw new HttpError(400, 'Invalid ludo action');
    }

    const turnSymbols = getTurnSymbolsInRoom(roomPlayers, maxPlayers);
    const boardState = normalizeLudoBoardState(room.board, turnSymbols);
    const resolution = applyLudoAction(boardState, membership.symbol, move, turnSymbols);
    if (resolution.error) {
      throw new HttpError(409, resolution.error);
    }

    await updateRoomState(room.id, {
      board: resolution.board,
      turn: resolution.turn,
      status: resolution.status,
      winner: resolution.winner,
      resultRecorded: false,
    });

    if (resolution.status === 'finished' && resolution.winner && !room.result_recorded) {
      try {
        await ensureMatchResultRecorded({
          ...room,
          board: resolution.board,
          winner: resolution.winner,
          status: 'finished',
          result_recorded: false,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to record finished ludo result during move', {
          roomId: room.id,
          roomCode: room.code,
          gameType: room.game_type,
          winner: resolution.winner,
        }, error);
      }
    }
  } else {
    const isCheckers = room.game_type === 'checkers';
    const parsedMove = isCheckers
      ? {
          from: Number(move?.from),
          to: Number(move?.to),
        }
      : Number(index);

    if (isCheckers) {
      if (!Number.isInteger(parsedMove.from) || !Number.isInteger(parsedMove.to)) {
        throw new HttpError(400, 'Invalid checkers move');
      }
    } else if (!Number.isInteger(parsedMove)) {
      throw new HttpError(400, 'Invalid move index');
    }

    if (!isValidMove(room.game_type, room.board, parsedMove, membership.symbol)) {
      throw new HttpError(409, 'Move is not available');
    }

    const board = applyMove(room.game_type, room.board, parsedMove, membership.symbol);
    const winner = checkWinner(room.game_type, board);

    if (winner) {
      await updateRoomState(room.id, {
        board,
        turn: room.turn,
        status: 'finished',
        winner,
        resultRecorded: room.result_recorded,
      });

      if (!room.result_recorded) {
        try {
          await ensureMatchResultRecorded({
            ...room,
            board,
            winner,
            status: 'finished',
            result_recorded: false,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to record finished room result during move', {
            roomId: room.id,
            roomCode: room.code,
            gameType: room.game_type,
            winner,
          }, error);
        }
      }
    } else {
      await updateRoomState(room.id, {
        board,
        turn: getNextTurnSymbol(room.turn, roomPlayers, maxPlayers),
        status: 'playing',
        winner: null,
        resultRecorded: false,
      });
    }
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function rematchRoom({ code, playerId }) {
  const roomCode = String(code || '').trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);
  const gameDefinition = getGameById(room.game_type || 'tic-tac-two');

  if (!membership) {
    throw new HttpError(403, 'Player is not in this room');
  }
  if (!gameDefinition) {
    throw new HttpError(500, 'Room game type is invalid');
  }

  const playerCount = await countRoomPlayers(room.id);
  if (playerCount > 0) {
    await resetRoomForPlayers(room, gameDefinition);
  } else {
    const emptyBoard =
      gameDefinition.id === 'ludo'
        ? createLudoBoardState([])
        : createEmptyBoard(gameDefinition.id);
    await updateRoomState(room.id, {
      board: emptyBoard,
      turn: 'X',
      status: getRoomStatusByPlayerCount(playerCount, gameDefinition.minPlayers),
      winner: null,
      resultRecorded: false,
    });
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function leaveRoom({ code, playerId }) {
  const roomCode = String(code || '').trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);
  const gameDefinition = getGameById(room.game_type || 'tic-tac-two');

  if (!membership) {
    throw new HttpError(404, 'Player is not in this room');
  }
  if (!gameDefinition) {
    throw new HttpError(500, 'Room game type is invalid');
  }

  await removePlayerFromRoom(room.id, playerId);
  const remainingPlayers = await countRoomPlayers(room.id);
  if (remainingPlayers > 0) {
    await resetRoomForPlayers(room, gameDefinition);
  } else {
    const emptyBoard =
      gameDefinition.id === 'ludo'
        ? createLudoBoardState([])
        : createEmptyBoard(gameDefinition.id);
    await updateRoomState(room.id, {
      board: emptyBoard,
      turn: 'X',
      status: getRoomStatusByPlayerCount(remainingPlayers, gameDefinition.minPlayers),
      winner: null,
      resultRecorded: false,
    });
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, null);
}

async function getLeaderboard() {
  const overall = await listPlayersByScore();
  const gameBreakdown = [];
  for (const game of listGames()) {
    // Sequential reads avoid sudden connection fan-out on constrained networks.
    // This keeps leaderboard stable when DB connectivity is intermittent.
    // eslint-disable-next-line no-await-in-loop
    const players = await listPlayersByGameScore(game.id);
    gameBreakdown.push({
      gameType: game.id,
      name: game.name,
      players: players.map(serializeLeaderboardPlayer),
    });
  }

  return {
    overall: overall.map(serializeLeaderboardPlayer),
    byGame: gameBreakdown,
  };
}

module.exports = {
  registerPlayer,
  recordPlayerMatchResult,
  getLeaderboard,
  createNewRoom,
  joinExistingRoom,
  getRoomState,
  makeMove,
  rematchRoom,
  leaveRoom,
  listPublicRooms,
  listGames,
};
