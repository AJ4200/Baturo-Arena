const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer } = require('../repositories/roomRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_MESSAGE_BYTES = 20000;
const heartstreamRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getRoomSockets(roomCode) {
  if (!heartstreamRooms.has(roomCode)) {
    heartstreamRooms.set(roomCode, new Set());
  }
  return heartstreamRooms.get(roomCode);
}

function broadcastToRoom(socket, payload) {
  const roomSockets = heartstreamRooms.get(socket.heartstreamRoomCode);
  if (!roomSockets) {
    return;
  }

  roomSockets.forEach((peer) => {
    if (peer !== socket) {
      sendJson(peer, payload);
    }
  });
}

function leaveRoom(socket) {
  const roomCode = socket.heartstreamRoomCode;
  if (!roomCode) {
    return;
  }

  const roomSockets = heartstreamRooms.get(roomCode);
  if (!roomSockets) {
    return;
  }

  roomSockets.delete(socket);
  if (roomSockets.size === 0) {
    heartstreamRooms.delete(roomCode);
    return;
  }

  roomSockets.forEach((peer) => {
    sendJson(peer, {
      type: 'heartstream-presence',
      event: 'left',
      playerId: socket.heartstreamPlayerId,
      playerName: socket.heartstreamPlayerName,
      side: socket.heartstreamSide,
    });
  });
}

function normalizeMessage(socket, rawData) {
  const text = rawData.toString('utf8');
  if (text.length > MAX_MESSAGE_BYTES) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    return null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const type = String(payload.type || '');
  if (type === 'heartstream-state' && socket.heartstreamSide !== 'left') {
    return null;
  }
  if (type === 'heartstream-input' && socket.heartstreamSide !== 'right') {
    return null;
  }
  if (
    type !== 'heartstream-state' &&
    type !== 'heartstream-input' &&
    type !== 'heartstream-rematch'
  ) {
    return null;
  }

  return {
    ...payload,
    playerId: socket.heartstreamPlayerId,
    playerName: socket.heartstreamPlayerName,
    side: socket.heartstreamSide,
    sentAt: Date.now(),
  };
}

async function authenticateHeartstreamSocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }

  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'heartstream') {
    return null;
  }

  const membership = await findRoomPlayer(room.id, session.playerId);
  if (!membership || (membership.symbol !== 'X' && membership.symbol !== 'O')) {
    return null;
  }

  return {
    roomCode,
    playerId: session.playerId,
    playerName: session.player?.name || 'Player',
    side: membership.symbol === 'X' ? 'left' : 'right',
  };
}

function attachHeartstreamWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  const heartbeatId = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatId);
  });

  server.on('upgrade', async (request, socket, head) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    if (requestUrl.pathname !== '/ws/heartstream') {
      return;
    }

    try {
      const auth = await authenticateHeartstreamSocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.heartstreamRoomCode = auth.roomCode;
        ws.heartstreamPlayerId = auth.playerId;
        ws.heartstreamPlayerName = auth.playerName;
        ws.heartstreamSide = auth.side;
        ws.isAlive = true;

        const roomSockets = getRoomSockets(auth.roomCode);
        roomSockets.forEach((peer) => {
          sendJson(ws, {
            type: 'heartstream-presence',
            event: 'joined',
            playerId: peer.heartstreamPlayerId,
            playerName: peer.heartstreamPlayerName,
            side: peer.heartstreamSide,
          });
        });
        roomSockets.add(ws);

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (rawData) => {
          const payload = normalizeMessage(ws, rawData);
          if (payload) {
            broadcastToRoom(ws, payload);
          }
        });

        ws.on('close', () => leaveRoom(ws));

        sendJson(ws, {
          type: 'heartstream-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          roomCode: auth.roomCode,
          side: auth.side,
        });

        broadcastToRoom(ws, {
          type: 'heartstream-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          side: auth.side,
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Heartstream websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachHeartstreamWebSocket,
};
