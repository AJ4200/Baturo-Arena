const { run, get, all } = require("../db/client");

function parseRoom(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    is_public: Boolean(row.is_public),
    result_recorded: Boolean(row.result_recorded),
    board: JSON.parse(row.board),
  };
}

async function createRoom({ code, name, isPublic, creatorPlayerId }) {
  const emptyBoard = JSON.stringify(Array(9).fill(null));
  const insertResult = await run(
    `INSERT INTO rooms (
      code, name, is_public, creator_player_id, board, turn, status, winner, result_recorded, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'X', 'waiting', NULL, 0, CURRENT_TIMESTAMP)`,
    [code, name, isPublic ? 1 : 0, creatorPlayerId, emptyBoard]
  );
  return getRoomById(insertResult.lastID);
}

async function getRoomByCode(code) {
  const row = await get("SELECT * FROM rooms WHERE code = ?", [code]);
  return parseRoom(row);
}

async function getRoomById(roomId) {
  const row = await get("SELECT * FROM rooms WHERE id = ?", [roomId]);
  return parseRoom(row);
}

async function listPublicRooms() {
  const rows = await all(
    `SELECT
      r.code,
      r.name,
      r.status,
      r.is_public,
      COUNT(rp.player_id) AS players_count
    FROM rooms r
    LEFT JOIN room_players rp ON rp.room_id = r.id
    WHERE r.is_public = 1
    GROUP BY r.id
    ORDER BY r.created_at DESC`
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    isPublic: Boolean(row.is_public),
    playersCount: Number(row.players_count),
  }));
}

async function addPlayerToRoom(roomId, playerId, symbol) {
  await run(
    `INSERT OR IGNORE INTO room_players (room_id, player_id, symbol)
     VALUES (?, ?, ?)`,
    [roomId, playerId, symbol]
  );
}

async function removePlayerFromRoom(roomId, playerId) {
  await run(
    "DELETE FROM room_players WHERE room_id = ? AND player_id = ?",
    [roomId, playerId]
  );
}

async function findRoomPlayer(roomId, playerId) {
  return get(
    "SELECT * FROM room_players WHERE room_id = ? AND player_id = ?",
    [roomId, playerId]
  );
}

async function listRoomPlayers(roomId) {
  return all(
    `SELECT
      rp.player_id,
      rp.symbol,
      p.name,
      p.wins,
      p.losses,
      p.draws
    FROM room_players rp
    INNER JOIN players p ON p.id = rp.player_id
    WHERE rp.room_id = ?
    ORDER BY rp.joined_at ASC`,
    [roomId]
  );
}

async function updateRoomState(roomId, { board, turn, status, winner, resultRecorded }) {
  await run(
    `UPDATE rooms
     SET board = ?, turn = ?, status = ?, winner = ?, result_recorded = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(board), turn, status, winner, resultRecorded ? 1 : 0, roomId]
  );
}

async function resetRoom(roomId, status) {
  await run(
    `UPDATE rooms
     SET board = ?, turn = 'X', status = ?, winner = NULL, result_recorded = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(Array(9).fill(null)), status, roomId]
  );
}

async function countRoomPlayers(roomId) {
  const row = await get(
    "SELECT COUNT(*) AS total FROM room_players WHERE room_id = ?",
    [roomId]
  );
  return Number(row ? row.total : 0);
}

module.exports = {
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
};
