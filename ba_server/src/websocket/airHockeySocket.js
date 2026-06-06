const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer } = require('../repositories/roomRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_MESSAGE_BYTES = 8192;
const airHockeyRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function getRoomSockets(roomCode) {
  if (!airHockeyRooms.has(roomCode)) {
    airHockeyRooms.set(roomCode, new Set());
  }
  return airHockeyRooms.get(roomCode);
}

function broadcastToRoom(socket, payload) {
  const roomSockets = airHockeyRooms.get(socket.airHockeyRoomCode);
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
  const roomCode = socket.airHockeyRoomCode;
  if (!roomCode) {
    return;
  }

  const roomSockets = airHockeyRooms.get(roomCode);
  if (!roomSockets) {
    return;
  }

  roomSockets.delete(socket);
  if (roomSockets.size === 0) {
    airHockeyRooms.delete(roomCode);
    return;
  }

  roomSockets.forEach((peer) => {
    sendJson(peer, {
      type: 'air-hockey-presence',
      event: 'left',
      playerId: socket.airHockeyPlayerId,
      playerName: socket.airHockeyPlayerName,
      side: socket.airHockeySide,
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
  if (type === 'air-hockey-state' && socket.airHockeySide !== 'left') {
    return null;
  }
  if (type === 'air-hockey-paddle' && socket.airHockeySide !== 'right') {
    return null;
  }
  if (
    type !== 'air-hockey-state' &&
    type !== 'air-hockey-paddle' &&
    type !== 'air-hockey-rematch'
  ) {
    return null;
  }

  return {
    ...payload,
    playerId: socket.airHockeyPlayerId,
    playerName: socket.airHockeyPlayerName,
    side: socket.airHockeySide,
    sentAt: Date.now(),
  };
}

async function authenticateAirHockeySocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }

  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'air-hockey') {
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

function attachAirHockeyWebSocket(server) {
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
    if (requestUrl.pathname !== '/ws/air-hockey') {
      return;
    }

    try {
      const auth = await authenticateAirHockeySocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.airHockeyRoomCode = auth.roomCode;
        ws.airHockeyPlayerId = auth.playerId;
        ws.airHockeyPlayerName = auth.playerName;
        ws.airHockeySide = auth.side;
        ws.isAlive = true;

        const roomSockets = getRoomSockets(auth.roomCode);
        roomSockets.forEach((peer) => {
          sendJson(ws, {
            type: 'air-hockey-presence',
            event: 'joined',
            playerId: peer.airHockeyPlayerId,
            playerName: peer.airHockeyPlayerName,
            side: peer.airHockeySide,
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
          type: 'air-hockey-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          roomCode: auth.roomCode,
          side: auth.side,
        });

        broadcastToRoom(ws, {
          type: 'air-hockey-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          side: auth.side,
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Air Hockey websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachAirHockeyWebSocket,
};
