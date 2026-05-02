const { run, get, all } = require('../db/client');

async function ensureFriendship(playerId, friendPlayerId) {
  await run(
    `INSERT OR IGNORE INTO friends (player_id, friend_player_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [playerId, friendPlayerId]
  );
}

async function listFriends(playerId) {
  return all(
    `SELECT p.id as playerId, p.name, ga.picture
     FROM friends f
     INNER JOIN players p ON p.id = f.friend_player_id
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     WHERE f.player_id = ?
     ORDER BY p.name ASC`,
    [playerId]
  );
}

async function searchPlayers(query) {
  const like = `%${String(query).trim()}%`;
  return all(
    `SELECT p.id as playerId, p.name, ga.picture,
            COALESCE(SUM(s.wins), 0) as wins,
            COALESCE(SUM(s.draws), 0) as draws,
            COALESCE(SUM(s.losses), 0) as losses
     FROM players p
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     LEFT JOIN player_game_stats s ON s.player_id = p.id
     WHERE p.name ILIKE ? OR p.id ILIKE ?
     GROUP BY p.id, p.name, ga.picture
     ORDER BY p.name ASC
     LIMIT 20`,
    [like, like]
  );
}

async function createInvite({ fromPlayerId, toPlayerId, toEmail, roomCode, message }) {
  await run(
    `INSERT INTO invites (from_player_id, to_player_id, to_email, room_code, message, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [fromPlayerId, toPlayerId || null, toEmail || null, roomCode || null, message || null]
  );
}

async function recordEmailAttempt(inviteId) {
  await run(
    `UPDATE invites SET email_attempts = email_attempts + 1, last_email_attempt = CURRENT_TIMESTAMP WHERE id = ?`,
    [inviteId]
  );
}

async function listInvitesForPlayer(playerId) {
  return all(
    `SELECT i.id, i.from_player_id, i.to_player_id, i.to_email, i.room_code, i.message, i.created_at, p.name AS from_name, ga.picture AS from_picture
     FROM invites i
     LEFT JOIN players p ON p.id = i.from_player_id
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     WHERE i.to_player_id = ?
     ORDER BY i.created_at DESC`,
    [playerId]
  );
}

async function createFriendRequest({ fromPlayerId, toPlayerId, message }) {
  await run(
    `INSERT INTO friend_requests (from_player_id, to_player_id, message, status, created_at)
     VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT DO NOTHING`,
    [fromPlayerId, toPlayerId, message || null]
  );
}

async function listFriendRequestsFor(playerId) {
  return all(
    `SELECT fr.id, fr.from_player_id, fr.to_player_id, fr.message, fr.status, fr.created_at, p.name AS from_name, ga.picture AS from_picture
     FROM friend_requests fr
     LEFT JOIN players p ON p.id = fr.from_player_id
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     WHERE fr.to_player_id = ?
     ORDER BY fr.created_at DESC`,
    [playerId]
  );
}

async function updateFriendRequestStatus(requestId, status) {
  await run('UPDATE friend_requests SET status = ? WHERE id = ?', [status, requestId]);
}

async function acceptFriendRequest(requestId) {
  const reqRow = await get('SELECT * FROM friend_requests WHERE id = ?', [requestId]);
  if (!reqRow) return null;
  // mark request accepted
  await updateFriendRequestStatus(requestId, 'accepted');
  // create mutual friendship records
  await run(
    `INSERT OR IGNORE INTO friends (player_id, friend_player_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [reqRow.from_player_id, reqRow.to_player_id]
  );
  await run(
    `INSERT OR IGNORE INTO friends (player_id, friend_player_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [reqRow.to_player_id, reqRow.from_player_id]
  );
  return reqRow;
}

async function setInvitePreference(playerId, inviteOnly) {
  await run('UPDATE players SET invite_only_raibarus = ? WHERE id = ?', [inviteOnly ? 1 : 0, playerId]);
}

async function getPlayerInvitePreference(playerId) {
  return get('SELECT id, invite_only_raibarus FROM players WHERE id = ?', [playerId]);
}

module.exports = {
  ensureFriendship,
  listFriends,
  searchPlayers,
  createInvite,
  getPlayerInvitePreference,
  listInvitesForPlayer,
  recordEmailAttempt,
  createFriendRequest,
  listFriendRequestsFor,
  acceptFriendRequest,
  updateFriendRequestStatus,
  setInvitePreference,
};
