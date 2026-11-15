const crypto = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer, listRoomPlayers } = require('../repositories/roomRepository');
const { recordPlayerMatchResultOnce } = require('../repositories/playerRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const TICK_INTERVAL_MS = 100;
const MAX_MESSAGE_BYTES = 1024;
const COUNTDOWN_MS = 3000;
const MATCH_DURATION_MS = 60000;
const MOVE_INTERVAL_MS = 180;
const ARENA_WIDTH = 13;
const ARENA_HEIGHT = 9;
const MAX_SCORE = 10;
const MAX_ENERGY = 3;
const STARTING_SPARKS = 6;
const SYMBOL_ORDER = ['X', 'O', 'Y', 'Z'];
const PLAYER_COLORS = {
  X: '#61e8ff',
  O: '#ff77ba',
  Y: '#ffe071',
  Z: '#b59aff',
};
const SPAWNS = {
  X: { x: 1, y: 1 },
  O: { x: ARENA_WIDTH - 2, y: ARENA_HEIGHT - 2 },
  Y: { x: ARENA_WIDTH - 2, y: 1 },
  Z: { x: 1, y: ARENA_HEIGHT - 2 },
};
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const sparkstormRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function coordinateKey(x, y) {
  return `${x}:${y}`;
}

function createPlayer(member) {
  const symbol = SYMBOL_ORDER.includes(member.symbol) ? member.symbol : 'X';
  return {
    id: member.player_id,
    name: member.name || 'Spark Runner',
    symbol,
    color: PLAYER_COLORS[symbol],
    ...SPAWNS[symbol],
    score: 0,
    energy: MAX_ENERGY,
    direction: null,
    boostPending: false,
    nextMoveAt: 0,
    connected: false,
    participated: false,
  };
}

function getConnectedPlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function getFreeCells(room) {
  const unavailable = new Set(room.sparks.map((spark) => coordinateKey(spark.x, spark.y)));
  room.players.forEach((player) => unavailable.add(coordinateKey(player.x, player.y)));
  const cells = [];
  for (let y = 0; y < ARENA_HEIGHT; y += 1) {
    for (let x = 0; x < ARENA_WIDTH; x += 1) {
      if (!unavailable.has(coordinateKey(x, y))) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function spawnSpark(room) {
  const cells = getFreeCells(room);
  if (cells.length === 0) {
    return false;
  }
  room.sparks.push(cells[Math.floor(Math.random() * cells.length)]);
  return true;
}

function createRoom(roomCode, members) {
  const players = new Map();
  members.forEach((member) => players.set(member.player_id, createPlayer(member)));
  const room = {
    code: roomCode,
    matchId: crypto.randomUUID(),
    phase: 'waiting',
    players,
    sockets: new Set(),
    sparks: [],
    deadline: null,
    remainingMs: null,
    matchStarted: false,
    winnerId: null,
    resultRecorded: false,
    resultRecordingMatchId: null,
    lastEvent: 'Waiting for at least two runners to enter the arena.',
    lastActivityAt: Date.now(),
  };
  for (let index = 0; index < STARTING_SPARKS; index += 1) {
    spawnSpark(room);
  }
  return room;
}

function getRoom(roomCode, members) {
  let room = sparkstormRooms.get(roomCode);
  if (!room) {
    room = createRoom(roomCode, members);
    sparkstormRooms.set(roomCode, room);
  }
  members.forEach((member) => {
    if (!room.players.has(member.player_id)) {
      const player = createPlayer(member);
      room.players.set(member.player_id, player);
      room.sparks = room.sparks.filter(
        (spark) => coordinateKey(spark.x, spark.y) !== coordinateKey(player.x, player.y)
      );
      while (room.sparks.length < STARTING_SPARKS) {
        if (!spawnSpark(room)) break;
      }
    }
  });
  return room;
}

function serializeRoom(room) {
  return {
    type: 'sparkstorm-state',
    matchId: room.matchId,
    phase: room.phase,
    deadline: room.deadline,
    serverNow: Date.now(),
    durationMs: MATCH_DURATION_MS,
    targetScore: MAX_SCORE,
    winnerId: room.winnerId,
    lastEvent: room.lastEvent,
    sparks: room.sparks.map((spark) => ({ ...spark })),
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      symbol: player.symbol,
      color: player.color,
      x: player.x,
      y: player.y,
      score: player.score,
      energy: player.energy,
      connected: player.connected,
    })),
  };
}

function broadcastState(room) {
  const payload = serializeRoom(room);
  room.sockets.forEach((socket) => sendJson(socket, payload));
}

function beginCountdown(room) {
  if (getConnectedPlayers(room).length < 2) {
    room.phase = 'waiting';
    room.deadline = null;
    room.lastEvent = 'Waiting for at least two runners to enter the arena.';
    broadcastState(room);
    return;
  }
  room.phase = 'countdown';
  room.deadline = Date.now() + COUNTDOWN_MS;
  room.lastEvent = room.matchStarted
    ? 'Runners reconnected. The arena is powering back up!'
    : 'All runners linked. Get ready to move at once!';
  broadcastState(room);
}

async function recordMatchResults(room) {
  if (room.phase !== 'finished' || room.resultRecorded) {
    return;
  }
  const matchId = room.matchId;
  if (room.resultRecordingMatchId === matchId) {
    return;
  }
  room.resultRecordingMatchId = matchId;
  try {
    await Promise.all(
      Array.from(room.players.values())
        .filter((player) => player.participated)
        .map((player) => {
          const outcome = room.winnerId === null ? 'draw' : room.winnerId === player.id ? 'win' : 'loss';
          return recordPlayerMatchResultOnce(
            player.id,
            matchId,
            'sparkstorm',
            outcome,
            {
              wins: outcome === 'win' ? 1 : 0,
              losses: outcome === 'loss' ? 1 : 0,
              draws: outcome === 'draw' ? 1 : 0,
            }
          );
        })
    );
    if (room.matchId === matchId) {
      room.resultRecorded = true;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record Sparkstorm match results', { roomCode: room.code, matchId }, error);
  } finally {
    if (room.resultRecordingMatchId === matchId) {
      room.resultRecordingMatchId = null;
    }
  }
}

function finishMatch(room, targetWinnerId) {
  const standings = Array.from(room.players.values()).sort((left, right) => right.score - left.score);
  const highScore = standings[0]?.score || 0;
  const leaders = standings.filter((player) => player.score === highScore);
  room.phase = 'finished';
  room.deadline = null;
  room.remainingMs = null;
  room.winnerId =
    targetWinnerId === undefined ? (leaders.length === 1 ? leaders[0].id : null) : targetWinnerId;
  room.lastEvent = room.winnerId
    ? `${room.players.get(room.winnerId)?.name || 'A runner'} owns the Sparkstorm arena!`
    : 'The arena closes in a dead heat. Nobody takes the crown.';
  broadcastState(room);
  recordMatchResults(room);
}

function movePlayer(player, now) {
  const vector = DIRECTIONS[player.direction];
  if (!vector || now < player.nextMoveAt) {
    return false;
  }
  const boost = player.boostPending && player.energy > 0;
  const distance = boost ? 2 : 1;
  player.x = (player.x + vector.x * distance + ARENA_WIDTH) % ARENA_WIDTH;
  player.y = (player.y + vector.y * distance + ARENA_HEIGHT) % ARENA_HEIGHT;
  player.nextMoveAt = now + MOVE_INTERVAL_MS;
  player.boostPending = false;
  if (boost) {
    player.energy -= 1;
  }
  return true;
}

function shuffle(players) {
  for (let index = players.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [players[index], players[swapIndex]] = [players[swapIndex], players[index]];
  }
  return players;
}

function advanceMatch(room, now) {
  if (room.phase !== 'playing') {
    return;
  }
  if (room.deadline && now >= room.deadline) {
    finishMatch(room);
    return;
  }

  const movers = getConnectedPlayers(room).filter((player) => movePlayer(player, now));
  if (movers.length === 0) {
    return;
  }

  const events = [];
  const landingOrder = shuffle([...movers]);
  landingOrder.forEach((player) => {
    const sparkIndex = room.sparks.findIndex(
      (spark) => spark.x === player.x && spark.y === player.y
    );
    if (sparkIndex < 0) {
      return;
    }
    room.sparks.splice(sparkIndex, 1);
    player.score += 1;
    player.energy = Math.min(MAX_ENERGY, player.energy + 1);
    events.push(`${player.name} grabbed a spark!`);
    spawnSpark(room);
  });

  const winners = getConnectedPlayers(room).filter((player) => player.score >= MAX_SCORE);
  if (winners.length > 0) {
    finishMatch(room, winners.length === 1 ? winners[0].id : null);
    return;
  }

  if (events.length > 0) {
    room.lastEvent = events.join(' ');
  }
  broadcastState(room);
}

function pauseForDisconnect(room, now) {
  if (room.phase === 'playing') {
    room.remainingMs = Math.max(0, (room.deadline || now) - now);
  }
  room.phase = 'waiting';
  room.deadline = null;
  room.players.forEach((player) => {
    player.direction = null;
    player.boostPending = false;
  });
  room.lastEvent = 'The arena pauses until two runners are connected.';
  broadcastState(room);
}

function advanceRooms() {
  const now = Date.now();
  sparkstormRooms.forEach((room) => {
    if (room.phase === 'finished' && !room.resultRecorded) {
      recordMatchResults(room);
    }
    if (room.sockets.size === 0) {
      if (now - room.lastActivityAt > 30 * 60 * 1000) {
        sparkstormRooms.delete(room.code);
      }
      return;
    }
    const connectedPlayers = getConnectedPlayers(room);
    if (room.phase === 'finished') {
      return;
    }
    if (connectedPlayers.length < 2) {
      if (room.phase !== 'waiting') {
        pauseForDisconnect(room, now);
      }
      return;
    }
    if (room.phase === 'waiting') {
      beginCountdown(room);
      return;
    }
    if (room.phase === 'countdown') {
      if (room.deadline && now >= room.deadline) {
        room.phase = 'playing';
        room.deadline = now + (room.remainingMs ?? MATCH_DURATION_MS);
        room.remainingMs = null;
        room.matchStarted = true;
        room.players.forEach((player) => {
          player.nextMoveAt = now;
          if (player.connected) {
            player.participated = true;
          }
        });
        room.lastEvent = 'Go! Collect sparks and dash to ten.';
        broadcastState(room);
      }
      return;
    }
    advanceMatch(room, now);
  });
}

function normalizeMessage(rawData) {
  const text = rawData.toString('utf8');
  if (Buffer.byteLength(text, 'utf8') > MAX_MESSAGE_BYTES) {
    return null;
  }
  try {
    const payload = JSON.parse(text);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_error) {
    return null;
  }
}

function updateInput(room, playerId, payload) {
  const player = room.players.get(playerId);
  if (!player?.connected || room.phase === 'finished') {
    return;
  }
  if (
    payload.direction === null ||
    (typeof payload.direction === 'string' && Object.prototype.hasOwnProperty.call(DIRECTIONS, payload.direction))
  ) {
    player.direction = payload.direction;
  }
  if (payload.boost === true && player.energy > 0) {
    player.boostPending = true;
  }
}

async function authenticateSparkstormSocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }
  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'sparkstorm') {
    return null;
  }
  const membership = await findRoomPlayer(room.id, session.playerId);
  if (!membership || !SYMBOL_ORDER.includes(membership.symbol)) {
    return null;
  }
  return {
    roomCode,
    playerId: session.playerId,
    roster: await listRoomPlayers(room.id),
  };
}

function leaveRoom(socket) {
  const room = sparkstormRooms.get(socket.sparkstormRoomCode);
  if (!room) {
    return;
  }
  room.sockets.delete(socket);
  const playerStillConnected = Array.from(room.sockets).some(
    (peer) => peer.sparkstormPlayerId === socket.sparkstormPlayerId
  );
  const player = room.players.get(socket.sparkstormPlayerId);
  if (player && !playerStillConnected) {
    player.connected = false;
    player.direction = null;
    player.boostPending = false;
  }
  room.lastActivityAt = Date.now();
  if (getConnectedPlayers(room).length < 2 && room.phase !== 'finished' && room.phase !== 'waiting') {
    pauseForDisconnect(room, Date.now());
    return;
  }
  broadcastState(room);
}

function attachSparkstormWebSocket(server) {
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
  const tickId = setInterval(advanceRooms, TICK_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatId);
    clearInterval(tickId);
  });

  server.on('upgrade', async (request, socket, head) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    if (requestUrl.pathname !== '/ws/sparkstorm') {
      return;
    }
    try {
      const auth = await authenticateSparkstormSocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.sparkstormRoomCode = auth.roomCode;
        ws.sparkstormPlayerId = auth.playerId;
        ws.isAlive = true;
        const room = getRoom(auth.roomCode, auth.roster);
        const player = room.players.get(auth.playerId);
        player.connected = true;
        if (room.phase === 'playing') {
          player.participated = true;
        }
        player.name = auth.roster.find((member) => member.player_id === auth.playerId)?.name || player.name;
        room.sockets.add(ws);
        room.lastActivityAt = Date.now();

        ws.on('pong', () => {
          ws.isAlive = true;
        });
        ws.on('message', (rawData) => {
          const payload = normalizeMessage(rawData);
          if (payload?.type === 'sparkstorm-input') {
            updateInput(room, auth.playerId, payload);
          } else if (payload?.type === 'sparkstorm-rematch' && room.phase === 'finished') {
            room.matchId = crypto.randomUUID();
            room.phase = 'waiting';
            room.sparks = [];
            room.deadline = null;
            room.remainingMs = null;
            room.matchStarted = false;
            room.winnerId = null;
            room.resultRecorded = false;
            room.players.forEach((entry) => {
              entry.score = 0;
              entry.energy = MAX_ENERGY;
              entry.direction = null;
              entry.boostPending = false;
              entry.nextMoveAt = 0;
              entry.participated = false;
              Object.assign(entry, SPAWNS[entry.symbol]);
            });
            for (let index = 0; index < STARTING_SPARKS; index += 1) {
              spawnSpark(room);
            }
            room.lastEvent = 'A fresh arena is powering up.';
            beginCountdown(room);
          }
        });
        ws.on('close', () => leaveRoom(ws));
        ws.on('error', (error) => {
          // eslint-disable-next-line no-console
          console.error('Sparkstorm websocket error', error);
        });

        if (room.phase === 'waiting' && getConnectedPlayers(room).length >= 2) {
          beginCountdown(room);
        } else {
          broadcastState(room);
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Sparkstorm websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachSparkstormWebSocket,
};
