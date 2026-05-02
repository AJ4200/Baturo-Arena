const HttpError = require('../errors/HttpError');
const { getPlayerById } = require('../repositories/playerRepository');
const { getRoomByCode, findRoomPlayer } = require('../repositories/roomRepository');
const {
  findRelationship,
  searchPlayers,
  listRaiburus,
  listPendingRequests,
  createRaiburuRequest,
  updateRaiburuRequestStatus,
  listConversation,
  createMessage,
  listSocialNotifications,
} = require('../repositories/socialRepository');

const MAX_REQUEST_MESSAGE_LENGTH = 180;
const MAX_CHAT_MESSAGE_LENGTH = 500;

function trimWithLimit(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

async function ensurePlayerExists(playerId, label = 'player') {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new HttpError(404, `${label} not found`);
  }
  return player;
}

async function ensureRaiburus(playerId, targetPlayerId) {
  const relationship = await findRelationship(playerId, targetPlayerId);
  if (!relationship || relationship.status !== 'accepted') {
    throw new HttpError(403, 'You can only chat with raiburus');
  }
}

async function getSocialSnapshot(playerId) {
  await ensurePlayerExists(playerId);
  const [raiburus, requests, notifications] = await Promise.all([
    listRaiburus(playerId),
    listPendingRequests(playerId),
    listSocialNotifications(playerId),
  ]);

  return { raiburus, requests, notifications };
}

async function searchRaiburuCandidates({ playerId, query }) {
  await ensurePlayerExists(playerId);
  const safeQuery = trimWithLimit(query, 80);
  if (safeQuery.length < 2) {
    return { players: [] };
  }

  const players = await searchPlayers(playerId, safeQuery);
  return { players };
}

async function sendRaiburuRequest({ requesterPlayerId, recipientPlayerId, message }) {
  if (requesterPlayerId === recipientPlayerId) {
    throw new HttpError(400, 'You cannot send a raiburu request to yourself');
  }

  await ensurePlayerExists(requesterPlayerId);
  await ensurePlayerExists(recipientPlayerId, 'Recipient');

  const relationship = await findRelationship(requesterPlayerId, recipientPlayerId);
  if (relationship?.status === 'accepted') {
    throw new HttpError(409, 'That player is already your raiburu');
  }
  if (relationship?.status === 'pending') {
    throw new HttpError(409, 'A raiburu request is already pending');
  }

  await createRaiburuRequest({
    requesterPlayerId,
    recipientPlayerId,
    message: trimWithLimit(message, MAX_REQUEST_MESSAGE_LENGTH),
  });

  return getSocialSnapshot(requesterPlayerId);
}

async function answerRaiburuRequest({ playerId, requestId, action }) {
  const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : null;
  if (!status) {
    throw new HttpError(400, 'Invalid raiburu request action');
  }

  const updated = await updateRaiburuRequestStatus({
    requestId: Number(requestId),
    recipientPlayerId: playerId,
    status,
  });

  if (!updated) {
    throw new HttpError(404, 'Pending raiburu request not found');
  }

  return getSocialSnapshot(playerId);
}

async function getConversation({ playerId, otherPlayerId }) {
  if (playerId === otherPlayerId) {
    throw new HttpError(400, 'Select another raiburu');
  }

  await ensurePlayerExists(otherPlayerId, 'Raiburu');
  await ensureRaiburus(playerId, otherPlayerId);

  const messages = await listConversation(playerId, otherPlayerId);
  return { messages };
}

async function sendChatMessage({ playerId, toPlayerId, body }) {
  if (playerId === toPlayerId) {
    throw new HttpError(400, 'Select another raiburu');
  }

  const safeBody = trimWithLimit(body, MAX_CHAT_MESSAGE_LENGTH);
  if (!safeBody) {
    throw new HttpError(400, 'Message is required');
  }

  await ensurePlayerExists(toPlayerId, 'Raiburu');
  await ensureRaiburus(playerId, toPlayerId);

  const message = await createMessage({
    senderPlayerId: playerId,
    recipientPlayerId: toPlayerId,
    body: safeBody,
  });

  return { message };
}

async function sendRoomInvite({ playerId, toPlayerId, roomCode, message }) {
  if (playerId === toPlayerId) {
    throw new HttpError(400, 'Select another raiburu');
  }

  const safeRoomCode = String(roomCode || '').trim().toUpperCase();
  if (!safeRoomCode) {
    throw new HttpError(400, 'Room code is required for an invite');
  }

  await ensurePlayerExists(toPlayerId, 'Raiburu');
  await ensureRaiburus(playerId, toPlayerId);

  const room = await getRoomByCode(safeRoomCode);
  if (!room) {
    throw new HttpError(404, 'Room not found');
  }

  const membership = await findRoomPlayer(room.id, playerId);
  if (!membership) {
    throw new HttpError(403, 'Join the room before inviting raiburus');
  }

  const note = trimWithLimit(message, 160);
  const body = note || `Join my Baturo Arena room ${safeRoomCode}`;
  const invite = await createMessage({
    senderPlayerId: playerId,
    recipientPlayerId: toPlayerId,
    body,
    kind: 'room_invite',
    roomCode: safeRoomCode,
  });

  return { invite };
}

module.exports = {
  getSocialSnapshot,
  searchRaiburuCandidates,
  sendRaiburuRequest,
  answerRaiburuRequest,
  getConversation,
  sendChatMessage,
  sendRoomInvite,
};
