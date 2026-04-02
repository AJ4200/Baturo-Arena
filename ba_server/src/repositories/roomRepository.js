const { run, get, all } = require('../db/client');
const { createEmptyBoard } = require('../utils/game');

function parseRoom(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    is_public: Boolean(row.is_public),
    result_recorded: Boolean(row.result_recorded),
    board: JSON.parse(row.board),
    max_players: Number(row.max_players || 4),
  };
}

async function createRoom({ code, name, isPublic, creatorPlayerId, gameType, maxPlayers }) {
  const emptyBoard = JSON.stringify(createEmptyBoard(gameType));
  const insertResult = await run(
    `INSERT INTO rooms (
      code, name, is_public, creator_player_id, game_type, max_players, board, turn, status, winner, result_recorded, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'X', 'waiting', NULL, FALSE, CURRENT_TIMESTAMP)
    RETURNING id`,
    [code, name, isPublic, creatorPlayerId, gameType, maxPlayers, emptyBoard]
  );
  return getRoomById(insertResult.lastID);
}

async function getRoomByCode(code) {
  const row = await get('SELECT * FROM rooms WHERE code = ?', [code]);
  return parseRoom(row);
}

async function getRoomById(roomId) {
  const row = await get('SELECT * FROM rooms WHERE id = ?', [roomId]);
  return parseRoom(row);
}

async function listPublicRooms() {
  const rows = await all(
    `SELECT
      r.code,
      r.name,
      r.game_type,
      r.max_players,
      r.status,
      r.is_public,
      creator.name AS creator_name,
      r.updated_at,
      COUNT(rp.player_id) AS players_count,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'playerId', joined_player.id,
            'name', joined_player.name,
            'symbol', rp.symbol,
            'wins', joined_player.wins,
            'losses', joined_player.losses,
            'draws', joined_player.draws
          )
          ORDER BY rp.joined_at ASC
        ) FILTER (WHERE rp.player_id IS NOT NULL),
        '[]'::JSON
      ) AS players
    FROM rooms r
    INNER JOIN players creator ON creator.id = r.creator_player_id
    LEFT JOIN room_players rp ON rp.room_id = r.id
    LEFT JOIN players joined_player ON joined_player.id = rp.player_id
    WHERE r.is_public = TRUE
    GROUP BY r.id, creator.name
    ORDER BY r.created_at DESC`
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    gameType: row.game_type,
    maxPlayers: Number(row.max_players || 4),
    status: row.status,
    isPublic: Boolean(row.is_public),
    playersCount: Number(row.players_count),
    creatorName: row.creator_name,
    updatedAt: row.updated_at,
    players: Array.isArray(row.players) ? row.players : [],
  }));
}

async function addPlayerToRoom(roomId, playerId, symbol) {
  await run(
    `INSERT INTO room_players (room_id, player_id, symbol)
     VALUES (?, ?, ?)
     ON CONFLICT (room_id, player_id) DO NOTHING`,
    [roomId, playerId, symbol]
  );
}

async function removePlayerFromRoom(roomId, playerId) {
  await run('DELETE FROM room_players WHERE room_id = ? AND player_id = ?', [roomId, playerId]);
}

async function findRoomPlayer(roomId, playerId) {
  return get('SELECT * FROM room_players WHERE room_id = ? AND player_id = ?', [roomId, playerId]);
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
    [JSON.stringify(board), turn, status, winner, resultRecorded, roomId]
  );
}

async function resetRoom(roomId, status) {
  const room = await getRoomById(roomId);
  if (!room) {
    return;
  }

  await run(
    `UPDATE rooms
     SET board = ?, turn = 'X', status = ?, winner = NULL, result_recorded = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(createEmptyBoard(room.game_type)), status, roomId]
  );
}

async function countRoomPlayers(roomId) {
  const row = await get('SELECT COUNT(*) AS total FROM room_players WHERE room_id = ?', [roomId]);
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
