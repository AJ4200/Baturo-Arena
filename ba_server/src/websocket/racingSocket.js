const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer } = require('../repositories/roomRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_MESSAGE_BYTES = 4096;
const racingRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function getRoomSockets(roomCode) {
  if (!racingRooms.has(roomCode)) {
    racingRooms.set(roomCode, new Set());
  }
  return racingRooms.get(roomCode);
}

function leaveRoom(socket) {
  const roomCode = socket.racingRoomCode;
  if (!roomCode) {
    return;
  }

  const roomSockets = racingRooms.get(roomCode);
  if (!roomSockets) {
    return;
  }

  roomSockets.delete(socket);
  if (roomSockets.size === 0) {
    racingRooms.delete(roomCode);
    return;
  }

  roomSockets.forEach((peer) => {
    sendJson(peer, {
      type: 'racing-presence',
      event: 'left',
      playerId: socket.racingPlayerId,
      playerName: socket.racingPlayerName,
    });
  });
}

function broadcastToRoom(socket, payload) {
  const roomSockets = racingRooms.get(socket.racingRoomCode);
  if (!roomSockets) {
    return;
  }

  roomSockets.forEach((peer) => {
    if (peer !== socket) {
      sendJson(peer, payload);
    }
  });
}

function normalizeRacingPayload(socket, rawData) {
  const text = rawData.toString('utf8');
  if (text.length > MAX_MESSAGE_BYTES) {
    return null;
  }

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    return null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const type = String(payload.type || '');
  if (type !== 'racing-input' && type !== 'racing-finish') {
    return null;
  }

  return {
    ...payload,
    playerId: socket.racingPlayerId,
    playerName: socket.racingPlayerName,
    sentAt: Date.now(),
  };
}

async function authenticateRacingSocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }

  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'turbo-rush') {
    return null;
  }

  const membership = await findRoomPlayer(room.id, session.playerId);
  if (!membership) {
    return null;
  }

  return {
    roomCode,
    playerId: session.playerId,
    playerName: session.player?.name || 'Racer',
  };
}

function attachRacingWebSocket(server) {
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
    if (requestUrl.pathname !== '/ws/racing') {
      return;
    }

    try {
      const auth = await authenticateRacingSocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.racingRoomCode = auth.roomCode;
        ws.racingPlayerId = auth.playerId;
        ws.racingPlayerName = auth.playerName;
        ws.isAlive = true;

        getRoomSockets(auth.roomCode).add(ws);

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (rawData) => {
          const payload = normalizeRacingPayload(ws, rawData);
          if (!payload) {
            return;
          }
          broadcastToRoom(ws, payload);
        });

        ws.on('close', () => leaveRoom(ws));

        sendJson(ws, {
          type: 'racing-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          roomCode: auth.roomCode,
        });

        broadcastToRoom(ws, {
          type: 'racing-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Racing websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachRacingWebSocket,
};
