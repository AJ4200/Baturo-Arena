const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer, listRoomPlayers } = require('../repositories/roomRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const TICK_INTERVAL_MS = 50;
const MAX_MESSAGE_BYTES = 2048;
const ARENA_LIMIT = 6.4;
const TARGET_SCORE = 8;
const ROUND_TIME_MS = 90000;
const PLAYER_RADIUS = 0.62;
const CORE_RADIUS = 0.72;
const ACCELERATION = 18;
const FRICTION = 7.2;
const MAX_SPEED = 6.2;
const DASH_SPEED = 7.2;
const DASH_COOLDOWN_MS = 1100;
const PLAYER_COLORS = ['#22d3ee', '#fb7185'];
const cubeClashRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  };
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object') {
    return createInput();
  }

  return {
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
    dash: Boolean(input.dash),
  };
}

function createCore() {
  return {
    x: Math.round((Math.random() * 9.6 - 4.8) * 100) / 100,
    z: Math.round((Math.random() * 9.6 - 4.8) * 100) / 100,
  };
}

function createPlayer(entry, index) {
  return {
    id: entry.player_id || entry.playerId,
    name: entry.name || `Player ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    x: index === 0 ? -4.2 : 4.2,
    z: index === 0 ? 0 : 0,
    vx: 0,
    vz: 0,
    score: 0,
    dashCooldownMs: 0,
    connected: false,
  };
}

function serializeRoom(room) {
  return {
    type: 'cube-clash-snapshot',
    snapshot: {
      phase: room.phase,
      round: room.round,
      elapsedMs: Math.round(room.elapsedMs),
      targetScore: TARGET_SCORE,
      roundTimeMs: ROUND_TIME_MS,
      winnerId: room.winnerId,
      winnerName: room.winnerName,
      event: room.event,
      core: room.core,
      players: Array.from(room.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        color: player.color,
        x: player.x,
        z: player.z,
        vx: player.vx,
        vz: player.vz,
        score: player.score,
        dashCooldownMs: Math.max(0, Math.round(player.dashCooldownMs)),
        connected: player.connected,
      })),
    },
  };
}

function broadcastRoom(room, payload = serializeRoom(room)) {
  room.sockets.forEach((socket) => sendJson(socket, payload));
}

function resetRoom(room) {
  const players = Array.from(room.players.values());
  players.forEach((player, index) => {
    player.x = index === 0 ? -4.2 : 4.2;
    player.z = 0;
    player.vx = 0;
    player.vz = 0;
    player.score = 0;
    player.dashCooldownMs = 0;
  });
  room.phase = players.length >= 2 ? 'playing' : 'waiting';
  room.elapsedMs = 0;
  room.winnerId = null;
  room.winnerName = null;
  room.core = createCore();
  room.round += 1;
  room.event = room.phase === 'playing' ? 'Round reset' : 'Waiting for rival';
}

function ensureRoom(roomCode, players) {
  if (!cubeClashRooms.has(roomCode)) {
    const room = {
      roomCode,
      sockets: new Set(),
      players: new Map(),
      inputs: new Map(),
      phase: 'waiting',
      elapsedMs: 0,
      winnerId: null,
      winnerName: null,
      core: createCore(),
      round: 1,
      event: 'Waiting for rival',
      tickId: null,
    };
    cubeClashRooms.set(roomCode, room);
  }

  const room = cubeClashRooms.get(roomCode);
  players.slice(0, 2).forEach((entry, index) => {
    const playerId = entry.player_id || entry.playerId;
    if (!room.players.has(playerId)) {
      room.players.set(playerId, createPlayer(entry, index));
      room.inputs.set(playerId, createInput());
    }
  });

  if (room.phase === 'waiting' && room.players.size >= 2) {
    room.phase = 'playing';
    room.event = 'Round live';
  }

  return room;
}

function advancePlayer(player, input, deltaSeconds, deltaMs) {
  let axisX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let axisZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const axisLength = Math.hypot(axisX, axisZ);
  if (axisLength > 0) {
    axisX /= axisLength;
    axisZ /= axisLength;
  }

  player.vx += axisX * ACCELERATION * deltaSeconds;
  player.vz += axisZ * ACCELERATION * deltaSeconds;
  player.dashCooldownMs = Math.max(0, player.dashCooldownMs - deltaMs);

  if (input.dash && player.dashCooldownMs <= 0 && axisLength > 0) {
    player.vx += axisX * DASH_SPEED;
    player.vz += axisZ * DASH_SPEED;
    player.dashCooldownMs = DASH_COOLDOWN_MS;
  }

  const friction = Math.max(0, 1 - FRICTION * deltaSeconds);
  player.vx *= friction;
  player.vz *= friction;

  const speed = Math.hypot(player.vx, player.vz);
  if (speed > MAX_SPEED) {
    player.vx = (player.vx / speed) * MAX_SPEED;
    player.vz = (player.vz / speed) * MAX_SPEED;
  }

  player.x = clamp(player.x + player.vx * deltaSeconds, -ARENA_LIMIT, ARENA_LIMIT);
  player.z = clamp(player.z + player.vz * deltaSeconds, -ARENA_LIMIT, ARENA_LIMIT);

  if (Math.abs(player.x) >= ARENA_LIMIT) {
    player.vx *= -0.42;
  }
  if (Math.abs(player.z) >= ARENA_LIMIT) {
    player.vz *= -0.42;
  }
}

function resolvePlayerCollision(left, right) {
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const minDistance = PLAYER_RADIUS * 2;
  if (distance >= minDistance) {
    return;
  }

  const nx = dx / distance;
  const nz = dz / distance;
  const overlap = minDistance - distance;
  left.x -= nx * overlap * 0.5;
  left.z -= nz * overlap * 0.5;
  right.x += nx * overlap * 0.5;
  right.z += nz * overlap * 0.5;

  const leftPush = left.vx * nx + left.vz * nz;
  const rightPush = right.vx * nx + right.vz * nz;
  const impulse = (leftPush - rightPush) * 0.72;
  left.vx -= impulse * nx;
  left.vz -= impulse * nz;
  right.vx += impulse * nx;
  right.vz += impulse * nz;
}

function finishRoom(room, winner) {
  room.phase = 'finished';
  room.winnerId = winner ? winner.id : null;
  room.winnerName = winner ? winner.name : null;
  room.event = winner ? `${winner.name} claimed the arena.` : 'Draw round';
}

function tickRoom(room) {
  if (room.phase === 'finished') {
    broadcastRoom(room);
    return;
  }

  if (room.players.size < 2) {
    room.phase = 'waiting';
    room.event = 'Waiting for rival';
    broadcastRoom(room);
    return;
  }

  room.phase = 'playing';
  const deltaMs = TICK_INTERVAL_MS;
  const deltaSeconds = deltaMs / 1000;
  room.elapsedMs += deltaMs;
  const players = Array.from(room.players.values()).slice(0, 2);

  players.forEach((player) => {
    advancePlayer(player, room.inputs.get(player.id) || createInput(), deltaSeconds, deltaMs);
  });

  if (players.length >= 2) {
    resolvePlayerCollision(players[0], players[1]);
  }

  const collector = players.find((player) => Math.hypot(player.x - room.core.x, player.z - room.core.z) <= CORE_RADIUS);
  if (collector) {
    collector.score += 1;
    room.core = createCore();
    room.event = `${collector.name} captured a core.`;
    if (collector.score >= TARGET_SCORE) {
      finishRoom(room, collector);
    }
  }

  if (room.phase !== 'finished' && room.elapsedMs >= ROUND_TIME_MS) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    finishRoom(room, sorted[0].score === sorted[1].score ? null : sorted[0]);
  }

  broadcastRoom(room);
}

function leaveRoom(socket) {
  const room = cubeClashRooms.get(socket.cubeClashRoomCode);
  if (!room) {
    return;
  }

  room.sockets.delete(socket);
  const stillConnected = Array.from(room.sockets).some((peer) => peer.cubeClashPlayerId === socket.cubeClashPlayerId);
  const player = room.players.get(socket.cubeClashPlayerId);
  if (player && !stillConnected) {
    player.connected = false;
  }

  if (room.sockets.size === 0) {
    if (room.tickId) {
      clearInterval(room.tickId);
    }
    cubeClashRooms.delete(socket.cubeClashRoomCode);
    return;
  }

  broadcastRoom(room, {
    type: 'cube-clash-presence',
    event: 'left',
    playerId: socket.cubeClashPlayerId,
    playerName: socket.cubeClashPlayerName,
  });
  broadcastRoom(room);
}

function normalizeMessage(socket, rawData) {
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

  const type = String(payload?.type || '');
  if (type === 'cube-clash-input') {
    return {
      type,
      input: normalizeInput(payload.input),
      playerId: socket.cubeClashPlayerId,
    };
  }
  if (type === 'cube-clash-rematch') {
    return {
      type,
      playerId: socket.cubeClashPlayerId,
    };
  }
  return null;
}

async function authenticateCubeClashSocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }

  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'cube-clash-3d') {
    return null;
  }

  const membership = await findRoomPlayer(room.id, session.playerId);
  if (!membership) {
    return null;
  }

  const players = await listRoomPlayers(room.id);
  return {
    roomCode,
    playerId: session.playerId,
    playerName: session.player?.name || 'Cube Pilot',
    players,
  };
}

function attachCubeClashWebSocket(server) {
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
    if (requestUrl.pathname !== '/ws/cube-clash') {
      return;
    }

    try {
      const auth = await authenticateCubeClashSocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const room = ensureRoom(auth.roomCode, auth.players);
        const player = room.players.get(auth.playerId);
        if (player) {
          player.connected = true;
          player.name = auth.playerName;
        }

        ws.cubeClashRoomCode = auth.roomCode;
        ws.cubeClashPlayerId = auth.playerId;
        ws.cubeClashPlayerName = auth.playerName;
        ws.isAlive = true;
        room.sockets.add(ws);

        if (!room.tickId) {
          room.tickId = setInterval(() => tickRoom(room), TICK_INTERVAL_MS);
        }

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (rawData) => {
          const payload = normalizeMessage(ws, rawData);
          if (!payload) {
            return;
          }
          if (payload.type === 'cube-clash-input') {
            room.inputs.set(payload.playerId, payload.input);
          }
          if (payload.type === 'cube-clash-rematch') {
            resetRoom(room);
            broadcastRoom(room);
          }
        });

        ws.on('close', () => leaveRoom(ws));

        broadcastRoom(room, {
          type: 'cube-clash-presence',
          event: 'joined',
          playerId: auth.playerId,
          playerName: auth.playerName,
          roomCode: auth.roomCode,
        });
        sendJson(ws, serializeRoom(room));
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Cube Clash websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachCubeClashWebSocket,
};
