const { run, get, all } = require('../db/client');

function serializeSocialPlayer(row, prefix = '') {
  if (!row) {
    return null;
  }

  return {
    playerId: row[`${prefix}id`],
    name: row[`${prefix}name`],
    wins: Number(row[`${prefix}wins`] || 0),
    losses: Number(row[`${prefix}losses`] || 0),
    draws: Number(row[`${prefix}draws`] || 0),
  };
}

function serializeMessage(row, currentPlayerId) {
  const sender = serializeSocialPlayer(row, 'sender_');
  const recipient = serializeSocialPlayer(row, 'recipient_');

  return {
    id: Number(row.id),
    kind: row.kind,
    body: row.body,
    roomCode: row.room_code || null,
    createdAt: row.created_at,
    readAt: row.read_at || null,
    sender,
    recipient,
    isMine: row.sender_id === currentPlayerId,
  };
}

async function findRelationship(playerId, targetPlayerId) {
  return get(
    `SELECT *
     FROM raiburu_requests
     WHERE (
       requester_player_id = ? AND recipient_player_id = ?
     ) OR (
       requester_player_id = ? AND recipient_player_id = ?
     )
     ORDER BY
       CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
       updated_at DESC
     LIMIT 1`,
    [playerId, targetPlayerId, targetPlayerId, playerId]
  );
}

async function searchPlayers(playerId, query, limit = 8) {
  const normalizedQuery = `%${String(query || '').trim().toLowerCase()}%`;
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 8));

  const rows = await all(
    `SELECT
       p.id,
       p.name,
       p.wins,
       p.losses,
       p.draws,
       ga.picture AS avatar_url,
       rr.id AS request_id,
       rr.status AS request_status,
       rr.requester_player_id,
       rr.recipient_player_id
     FROM players p
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     LEFT JOIN LATERAL (
       SELECT *
       FROM raiburu_requests
       WHERE (
         requester_player_id = ? AND recipient_player_id = p.id
       ) OR (
         requester_player_id = p.id AND recipient_player_id = ?
       )
       ORDER BY
         CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         updated_at DESC
       LIMIT 1
     ) rr ON TRUE
     WHERE p.id <> ?
       AND (LOWER(p.name) LIKE ? OR LOWER(p.id) LIKE ?)
     ORDER BY
       CASE WHEN rr.status = 'accepted' THEN 0 ELSE 1 END,
       (p.wins * 3 + p.draws) DESC,
       p.name ASC
     LIMIT ?`,
    [playerId, playerId, playerId, normalizedQuery, normalizedQuery, safeLimit]
  );

  return rows.map((row) => ({
    ...serializeSocialPlayer(row),
    avatarUrl: row.avatar_url || null,
    relation:
      row.request_status === 'accepted'
        ? 'raiburu'
        : row.request_status === 'pending' && row.requester_player_id === playerId
          ? 'outgoing'
          : row.request_status === 'pending' && row.recipient_player_id === playerId
            ? 'incoming'
            : 'none',
    requestId: row.request_id ? Number(row.request_id) : null,
  }));
}

async function listRaiburus(playerId) {
  const rows = await all(
    `SELECT
       rr.id AS request_id,
       rr.updated_at,
       p.id,
       p.name,
       p.wins,
       p.losses,
       p.draws,
       last_message.body AS last_message_body,
       last_message.created_at AS last_message_at,
       COALESCE(unread.total, 0) AS unread_total
     FROM raiburu_requests rr
     INNER JOIN players p ON p.id = CASE
       WHEN rr.requester_player_id = ? THEN rr.recipient_player_id
       ELSE rr.requester_player_id
     END
     LEFT JOIN LATERAL (
       SELECT body, created_at
       FROM raiburu_messages
       WHERE (
         sender_player_id = ? AND recipient_player_id = p.id
       ) OR (
         sender_player_id = p.id AND recipient_player_id = ?
       )
       ORDER BY created_at DESC
       LIMIT 1
     ) last_message ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS total
       FROM raiburu_messages
       WHERE sender_player_id = p.id
         AND recipient_player_id = ?
         AND read_at IS NULL
     ) unread ON TRUE
     WHERE rr.status = 'accepted'
       AND (rr.requester_player_id = ? OR rr.recipient_player_id = ?)
     ORDER BY
       COALESCE(last_message.created_at, rr.updated_at) DESC,
       p.name ASC`,
    [playerId, playerId, playerId, playerId, playerId, playerId]
  );

  return rows.map((row) => ({
    requestId: Number(row.request_id),
    player: serializeSocialPlayer(row),
    acceptedAt: row.updated_at,
    lastMessage: row.last_message_body
      ? {
          body: row.last_message_body,
          createdAt: row.last_message_at,
        }
      : null,
    unreadCount: Number(row.unread_total || 0),
  }));
}

async function listPendingRequests(playerId) {
  const rows = await all(
    `SELECT
       rr.id,
       rr.requester_player_id,
       rr.recipient_player_id,
       rr.message,
       rr.status,
       rr.created_at,
       rr.updated_at,
       requester.id AS requester_id,
       requester.name AS requester_name,
       requester.wins AS requester_wins,
       requester.losses AS requester_losses,
       requester.draws AS requester_draws,
       recipient.id AS recipient_id,
       recipient.name AS recipient_name,
       recipient.wins AS recipient_wins,
       recipient.losses AS recipient_losses,
       recipient.draws AS recipient_draws
     FROM raiburu_requests rr
     INNER JOIN players requester ON requester.id = rr.requester_player_id
     INNER JOIN players recipient ON recipient.id = rr.recipient_player_id
     WHERE rr.status = 'pending'
       AND (rr.requester_player_id = ? OR rr.recipient_player_id = ?)
     ORDER BY rr.created_at DESC`,
    [playerId, playerId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    direction: row.recipient_player_id === playerId ? 'incoming' : 'outgoing',
    message: row.message || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requester: serializeSocialPlayer(row, 'requester_'),
    recipient: serializeSocialPlayer(row, 'recipient_'),
  }));
}

async function createRaiburuRequest({ requesterPlayerId, recipientPlayerId, message }) {
  const insertResult = await run(
    `INSERT INTO raiburu_requests (
       requester_player_id,
       recipient_player_id,
       message,
       status,
       updated_at
     ) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
     RETURNING id`,
    [requesterPlayerId, recipientPlayerId, message || null]
  );

  return getRaiburuRequestById(insertResult.lastID);
}

async function getRaiburuRequestById(requestId) {
  return get('SELECT * FROM raiburu_requests WHERE id = ?', [requestId]);
}

async function updateRaiburuRequestStatus({ requestId, recipientPlayerId, status }) {
  const result = await run(
    `UPDATE raiburu_requests
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND recipient_player_id = ? AND status = 'pending'
     RETURNING id`,
    [status, requestId, recipientPlayerId]
  );

  if (!result.lastID) {
    return null;
  }

  return getRaiburuRequestById(result.lastID);
}

async function listConversation(playerId, otherPlayerId, limit = 40) {
  const safeLimit = Math.max(1, Math.min(80, Number(limit) || 40));
  const rows = await all(
    `SELECT
       rm.id,
       rm.sender_player_id AS sender_id,
       rm.recipient_player_id AS recipient_id,
       rm.body,
       rm.kind,
       rm.room_code,
       rm.created_at,
       rm.read_at,
       sender.id AS sender_id,
       sender.name AS sender_name,
       sender.wins AS sender_wins,
       sender.losses AS sender_losses,
       sender.draws AS sender_draws,
       recipient.id AS recipient_id,
       recipient.name AS recipient_name,
       recipient.wins AS recipient_wins,
       recipient.losses AS recipient_losses,
       recipient.draws AS recipient_draws
     FROM raiburu_messages rm
     INNER JOIN players sender ON sender.id = rm.sender_player_id
     INNER JOIN players recipient ON recipient.id = rm.recipient_player_id
     WHERE (
       rm.sender_player_id = ? AND rm.recipient_player_id = ?
     ) OR (
       rm.sender_player_id = ? AND rm.recipient_player_id = ?
     )
     ORDER BY rm.created_at DESC
     LIMIT ?`,
    [playerId, otherPlayerId, otherPlayerId, playerId, safeLimit]
  );

  await run(
    `UPDATE raiburu_messages
     SET read_at = CURRENT_TIMESTAMP
     WHERE sender_player_id = ?
       AND recipient_player_id = ?
       AND read_at IS NULL`,
    [otherPlayerId, playerId]
  );

  return rows.reverse().map((row) => serializeMessage(row, playerId));
}

async function createMessage({ senderPlayerId, recipientPlayerId, body, kind = 'chat', roomCode = null }) {
  const insertResult = await run(
    `INSERT INTO raiburu_messages (
       sender_player_id,
       recipient_player_id,
       body,
       kind,
       room_code
     ) VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
    [senderPlayerId, recipientPlayerId, body, kind, roomCode]
  );

  const row = await getMessageById(insertResult.lastID);
  return serializeMessage(row, senderPlayerId);
}

async function listSocialNotifications(playerId, limit = 12) {
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12));
  const requestRows = await all(
    `SELECT
       rr.id,
       rr.message,
       rr.created_at,
       requester.id AS requester_id,
       requester.name AS requester_name,
       requester.wins AS requester_wins,
       requester.losses AS requester_losses,
       requester.draws AS requester_draws
     FROM raiburu_requests rr
     INNER JOIN players requester ON requester.id = rr.requester_player_id
     WHERE rr.recipient_player_id = ?
       AND rr.status = 'pending'
     ORDER BY rr.created_at DESC
     LIMIT ?`,
    [playerId, safeLimit]
  );

  const inviteRows = await all(
    `SELECT
       rm.id,
       rm.body,
       rm.room_code,
       rm.created_at,
       sender.id AS sender_id,
       sender.name AS sender_name,
       sender.wins AS sender_wins,
       sender.losses AS sender_losses,
       sender.draws AS sender_draws
     FROM raiburu_messages rm
     INNER JOIN players sender ON sender.id = rm.sender_player_id
     WHERE rm.recipient_player_id = ?
       AND rm.kind = 'room_invite'
       AND rm.read_at IS NULL
     ORDER BY rm.created_at DESC
     LIMIT ?`,
    [playerId, safeLimit]
  );

  return [
    ...requestRows.map((row) => ({
      id: `request-${row.id}`,
      type: 'request',
      requestId: Number(row.id),
      message: row.message || '',
      createdAt: row.created_at,
      player: serializeSocialPlayer(row, 'requester_'),
      roomCode: null,
    })),
    ...inviteRows.map((row) => ({
      id: `invite-${row.id}`,
      type: 'room_invite',
      message: row.body,
      createdAt: row.created_at,
      player: serializeSocialPlayer(row, 'sender_'),
      roomCode: row.room_code || null,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, safeLimit);
}

async function getMessageById(messageId) {
  return get(
    `SELECT
       rm.id,
       rm.sender_player_id AS sender_id,
       rm.recipient_player_id AS recipient_id,
       rm.body,
       rm.kind,
       rm.room_code,
       rm.created_at,
       rm.read_at,
       sender.id AS sender_id,
       sender.name AS sender_name,
       sender.wins AS sender_wins,
       sender.losses AS sender_losses,
       sender.draws AS sender_draws,
       recipient.id AS recipient_id,
       recipient.name AS recipient_name,
       recipient.wins AS recipient_wins,
       recipient.losses AS recipient_losses,
       recipient.draws AS recipient_draws
     FROM raiburu_messages rm
     INNER JOIN players sender ON sender.id = rm.sender_player_id
     INNER JOIN players recipient ON recipient.id = rm.recipient_player_id
     WHERE rm.id = ?`,
    [messageId]
  );
}

module.exports = {
  findRelationship,
  searchPlayers,
  listRaiburus,
  listPendingRequests,
  createRaiburuRequest,
  updateRaiburuRequestStatus,
  listConversation,
  createMessage,
  listSocialNotifications,
};
