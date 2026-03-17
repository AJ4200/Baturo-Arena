const HttpError = require("../errors/HttpError");
const {
  upsertPlayer,
  getPlayerById,
  incrementPlayerStats,
  listPlayersByScore,
} = require("../repositories/playerRepository");
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
} = require("../repositories/roomRepository");
const { createRoomCode } = require("../utils/roomCode");
const { checkWinner } = require("../utils/game");

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

async function ensureRoom(code) {
  const room = await getRoomByCode(code);
  if (!room) {
    throw new HttpError(404, "Room not found");
  }
  return room;
}

async function applyMatchResult(roomId, winner) {
  const players = await listRoomPlayers(roomId);

  if (winner === "draw") {
    await Promise.all(
      players.map((player) => incrementPlayerStats(player.player_id, { draws: 1 }))
    );
    return;
  }

  await Promise.all(
    players.map((player) => {
      if (player.symbol === winner) {
        return incrementPlayerStats(player.player_id, { wins: 1 });
      }
      return incrementPlayerStats(player.player_id, { losses: 1 });
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
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws,
      })),
    },
    yourSymbol: youMembership ? youMembership.symbol : null,
    you: serializePlayer(you),
  };
}

async function registerPlayer({ playerId, name }) {
  const player = await upsertPlayer({ playerId, name });
  return serializePlayer(player);
}

async function createNewRoom({ playerId, roomName, isPublic }) {
  const owner = await getPlayerById(playerId);
  if (!owner) {
    throw new HttpError(400, "Invalid playerId");
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
    throw new HttpError(500, "Could not generate room code");
  }

  const safeName = (roomName && String(roomName).trim()) || `${owner.name}'s Room`;
  const room = await createRoom({
    code,
    name: safeName,
    isPublic: Boolean(isPublic),
    creatorPlayerId: playerId,
  });

  await addPlayerToRoom(room.id, playerId, "X");
  const freshRoom = await getRoomById(room.id);
  return buildRoomResponse(freshRoom, playerId);
}

async function joinExistingRoom({ playerId, code }) {
  const roomCode = String(code || "").trim().toUpperCase();
  if (!roomCode) {
    throw new HttpError(400, "Room code is required");
  }

  const room = await ensureRoom(roomCode);
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new HttpError(400, "Invalid playerId");
  }

  const existingMembership = await findRoomPlayer(room.id, playerId);
  if (!existingMembership) {
    const players = await listRoomPlayers(room.id);
    if (players.length >= 2) {
      throw new HttpError(409, "Room is full");
    }

    const hasX = players.some((entry) => entry.symbol === "X");
    const symbol = hasX ? "O" : "X";
    await addPlayerToRoom(room.id, playerId, symbol);

    const playerCount = await countRoomPlayers(room.id);
    if (playerCount === 2) {
      await resetRoom(room.id, "playing");
    }
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function getRoomState({ code, playerId }) {
  const roomCode = String(code || "").trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  return buildRoomResponse(room, playerId || null);
}

async function makeMove({ code, playerId, index }) {
  const roomCode = String(code || "").trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);

  if (!membership) {
    throw new HttpError(403, "Player is not in this room");
  }

  const parsedIndex = Number(index);
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex > 8) {
    throw new HttpError(400, "Invalid move index");
  }

  if (room.status !== "playing") {
    throw new HttpError(409, "Game is not in playing state");
  }

  if (membership.symbol !== room.turn) {
    throw new HttpError(409, "Not your turn");
  }

  if (room.board[parsedIndex] !== null) {
    throw new HttpError(409, "Cell already occupied");
  }

  const board = [...room.board];
  board[parsedIndex] = membership.symbol;
  const winner = checkWinner(board);

  if (winner) {
    await updateRoomState(room.id, {
      board,
      turn: room.turn,
      status: "finished",
      winner,
      resultRecorded: true,
    });

    if (!room.result_recorded) {
      await applyMatchResult(room.id, winner);
    }
  } else {
    await updateRoomState(room.id, {
      board,
      turn: room.turn === "X" ? "O" : "X",
      status: "playing",
      winner: null,
      resultRecorded: false,
    });
  }

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function rematchRoom({ code, playerId }) {
  const roomCode = String(code || "").trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);

  if (!membership) {
    throw new HttpError(403, "Player is not in this room");
  }

  const playerCount = await countRoomPlayers(room.id);
  const status = playerCount === 2 ? "playing" : "waiting";
  await resetRoom(room.id, status);

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, playerId);
}

async function leaveRoom({ code, playerId }) {
  const roomCode = String(code || "").trim().toUpperCase();
  const room = await ensureRoom(roomCode);
  const membership = await findRoomPlayer(room.id, playerId);

  if (!membership) {
    throw new HttpError(404, "Player is not in this room");
  }

  await removePlayerFromRoom(room.id, playerId);
  const playerCount = await countRoomPlayers(room.id);
  const status = playerCount === 2 ? "playing" : "waiting";
  await resetRoom(room.id, status);

  const refreshedRoom = await getRoomById(room.id);
  return buildRoomResponse(refreshedRoom, null);
}

async function getLeaderboard() {
  const players = await listPlayersByScore();
  return players.map((player) => ({
    ...serializePlayer(player),
    score: Number(player.score),
  }));
}

module.exports = {
  registerPlayer,
  getLeaderboard,
  createNewRoom,
  joinExistingRoom,
  getRoomState,
  makeMove,
  rematchRoom,
  leaveRoom,
  listPublicRooms,
};
