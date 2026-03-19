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
  resetRoom,
  countRoomPlayers,
} = require('../repositories/roomRepository');
const { createRoomCode } = require('../utils/roomCode');
const { checkWinner, applyMove, isValidMove } = require('../utils/game');
const { listGames, getGameById } = require('./gamesCatalog');

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

function pickSymbol(players) {
  const xCount = players.filter((entry) => entry.symbol === 'X').length;
  const oCount = players.filter((entry) => entry.symbol === 'O').length;
  return xCount <= oCount ? 'X' : 'O';
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
  const freshRoom = await getRoomById(room.id);
  return buildRoomResponse(freshRoom, playerId);
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

  const existingMembership = await findRoomPlayer(room.id, playerId);
  if (!existingMembership) {
    const players = await listRoomPlayers(room.id);
    const maxPlayers = Number(room.max_players || gameDefinition.maxPlayers);
    if (players.length >= maxPlayers) {
      throw new HttpError(409, 'Room is full');
    }

    const symbol = pickSymbol(players);
    await addPlayerToRoom(room.id, playerId, symbol);

    const playerCount = await countRoomPlayers(room.id);
    await resetRoom(room.id, getRoomStatusByPlayerCount(playerCount, gameDefinition.minPlayers));
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function getRoomState({ code, playerId }) {
  const roomCode = String(code || '').trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  return buildRoomResponse(room, playerId || null);
}

async function makeMove({ code, playerId, index }) {
  const roomCode = String(code || '').trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);

  if (!membership) {
    throw new HttpError(403, 'Player is not in this room');
  }

  const parsedIndex = Number(index);
  if (!Number.isInteger(parsedIndex)) {
    throw new HttpError(400, 'Invalid move index');
  }

  if (room.status !== 'playing') {
    throw new HttpError(409, 'Game is not in playing state');
  }

  if (membership.symbol !== room.turn) {
    throw new HttpError(409, 'Not your turn');
  }

  if (!isValidMove(room.game_type, room.board, parsedIndex)) {
    throw new HttpError(409, 'Move is not available');
  }

  const board = applyMove(room.game_type, room.board, parsedIndex, membership.symbol);
  const winner = checkWinner(room.game_type, board);

  if (winner) {
    await updateRoomState(room.id, {
      board,
      turn: room.turn,
      status: 'finished',
      winner,
      resultRecorded: true,
    });

    if (!room.result_recorded) {
      await applyMatchResult(room.id, room.game_type, winner);
    }
  } else {
    await updateRoomState(room.id, {
      board,
      turn: room.turn === 'X' ? 'O' : 'X',
      status: 'playing',
      winner: null,
      resultRecorded: false,
    });
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

  const playerCount = await countRoomPlayers(room.id);
  await resetRoom(room.id, getRoomStatusByPlayerCount(playerCount, gameDefinition.minPlayers));

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

  await removePlayerFromRoom(room.id, playerId);
  const playerCount = await countRoomPlayers(room.id);
  await resetRoom(room.id, getRoomStatusByPlayerCount(playerCount, gameDefinition.minPlayers));

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, null);
}

async function getLeaderboard() {
  const [overall, gameBreakdown] = await Promise.all([
    listPlayersByScore(),
    Promise.all(
      listGames().map(async (game) => ({
        gameType: game.id,
        name: game.name,
        players: (await listPlayersByGameScore(game.id)).map(serializeLeaderboardPlayer),
      }))
    ),
  ]);

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
