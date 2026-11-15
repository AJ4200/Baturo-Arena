const crypto = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer, listRoomPlayers } = require('../repositories/roomRepository');
const { recordPlayerMatchResultOnce } = require('../repositories/playerRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const TICK_INTERVAL_MS = 250;
const MAX_MESSAGE_BYTES = 1024;
const TURN_MS = 20000;
const MAX_TURNS = 48;
const TARGET_SCORE = 5;
const TRACK_SIZE = 24;
const START_RELICS = [2, 5, 8, 11, 14, 17, 20, 23];
const SYMBOL_ORDER = ['X', 'O', 'Y', 'Z'];
const PLAYER_COLORS = {
  X: '#61e8ff',
  O: '#ff77ba',
  Y: '#ffe071',
  Z: '#b59aff',
};
const runeRallyRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function createPlayer(member) {
  const symbol = SYMBOL_ORDER.includes(member.symbol) ? member.symbol : 'X';
  return {
    id: member.player_id,
    name: member.name || 'Rally Runner',
    symbol,
    color: PLAYER_COLORS[symbol],
    position: SYMBOL_ORDER.indexOf(symbol) * (TRACK_SIZE / SYMBOL_ORDER.length),
    score: 0,
    charge: 2,
    connected: false,
  };
}

function createRoom(roomCode, members) {
  const players = new Map();
  members.forEach((member) => {
    players.set(member.player_id, createPlayer(member));
  });
  const orderedPlayers = Array.from(players.values()).sort(
    (left, right) => SYMBOL_ORDER.indexOf(left.symbol) - SYMBOL_ORDER.indexOf(right.symbol)
  );
  return {
    code: roomCode,
    matchId: crypto.randomUUID(),
    phase: 'waiting',
    players,
    sockets: new Set(),
    relics: new Set(START_RELICS),
    turnPlayerId: orderedPlayers[0]?.id || null,
    turnNumber: 0,
    deadline: null,
    winnerId: null,
    resultRecorded: false,
    resultRecordingMatchId: null,
    lastEvent: 'Waiting for at least two runners to join the circuit.',
    lastActivityAt: Date.now(),
  };
}

function getRoom(roomCode, members) {
  let room = runeRallyRooms.get(roomCode);
  if (!room) {
    room = createRoom(roomCode, members);
    runeRallyRooms.set(roomCode, room);
  }

  members.forEach((member) => {
    if (!room.players.has(member.player_id)) {
      room.players.set(member.player_id, createPlayer(member));
    }
  });
  return room;
}

function getConnectedPlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function serializeRoom(room) {
  return {
    type: 'rune-rally-state',
    matchId: room.matchId,
    phase: room.phase,
    targetScore: TARGET_SCORE,
    maxTurns: MAX_TURNS,
    turnNumber: room.turnNumber,
    turnPlayerId: room.turnPlayerId,
    deadline: room.deadline,
    serverNow: Date.now(),
    winnerId: room.winnerId,
    relics: Array.from(room.relics),
    lastEvent: room.lastEvent,
    players: Array.from(room.players.values()).map((player) => ({ ...player })),
  };
}

function broadcastState(room) {
  const payload = serializeRoom(room);
  room.sockets.forEach((socket) => sendJson(socket, payload));
}

function broadcastEvent(room, eventType, eventData) {
  const payload = {
    type: 'rune-rally-event',
    eventType,
    ...eventData,
  };
  room.sockets.forEach((socket) => sendJson(socket, payload));
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
      Array.from(room.players.values()).map((player) => {
        const outcome = room.winnerId === null ? 'draw' : room.winnerId === player.id ? 'win' : 'loss';
        const result = {
          wins: outcome === 'win' ? 1 : 0,
          losses: outcome === 'loss' ? 1 : 0,
          draws: outcome === 'draw' ? 1 : 0,
        };
        return recordPlayerMatchResultOnce(
          player.id,
          matchId,
          'rune-rally',
          outcome,
          result
        );
      })
    );
    if (room.matchId === matchId) {
      room.resultRecorded = true;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record Rune Rally match results', { roomCode: room.code, matchId }, error);
  } finally {
    if (room.resultRecordingMatchId === matchId) {
      room.resultRecordingMatchId = null;
    }
  }
}

function startOrResumeMatch(room) {
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers.length < 2) {
    room.phase = 'waiting';
    room.deadline = null;
    room.lastEvent = 'Waiting for at least two runners to join the circuit.';
    broadcastState(room);
    return;
  }
  if (room.phase === 'finished') {
    return;
  }

  if (room.turnNumber === 0) {
    room.turnPlayerId = connectedPlayers[0].id;
    room.turnNumber = 1;
    room.lastEvent = 'The circuit is live! Collect five runes to claim the crown.';
  } else if (!connectedPlayers.some((player) => player.id === room.turnPlayerId)) {
    advanceTurn(room);
    return;
  } else {
    room.lastEvent = 'Runners reconnected. The rally resumes!';
  }
  room.phase = 'playing';
  room.deadline = Date.now() + TURN_MS;
  broadcastState(room);
}

function finishMatch(room) {
  const standings = Array.from(room.players.values()).sort((left, right) => right.score - left.score);
  const highestScore = standings[0]?.score || 0;
  const leaders = standings.filter((player) => player.score === highestScore);
  room.phase = 'finished';
  room.deadline = null;
  room.winnerId = leaders.length === 1 ? leaders[0].id : null;
  room.lastEvent = room.winnerId
    ? `${standings[0].name} takes the Rune Rally crown!`
    : 'The rally ends in a dead heat. Nobody takes the crown.';
  broadcastState(room);
  recordMatchResults(room);
}

function advanceTurn(room) {
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers.length < 2) {
    room.phase = 'waiting';
    room.deadline = null;
    room.lastEvent = 'The circuit pauses until at least two runners reconnect.';
    broadcastState(room);
    return;
  }

  const orderedPlayers = Array.from(room.players.values()).sort(
    (left, right) => SYMBOL_ORDER.indexOf(left.symbol) - SYMBOL_ORDER.indexOf(right.symbol)
  );
  const currentIndex = orderedPlayers.findIndex((player) => player.id === room.turnPlayerId);
  let nextPlayer = null;
  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const candidate = orderedPlayers[(currentIndex + offset + orderedPlayers.length) % orderedPlayers.length];
    if (candidate?.connected) {
      nextPlayer = candidate;
      break;
    }
  }

  if (!nextPlayer) {
    room.phase = 'waiting';
    room.deadline = null;
    broadcastState(room);
    return;
  }

  room.turnPlayerId = nextPlayer.id;
  room.turnNumber += 1;
  if (room.turnNumber > MAX_TURNS) {
    finishMatch(room);
    return;
  }
  room.deadline = Date.now() + TURN_MS;
  room.phase = 'playing';
  broadcastState(room);
}

function spawnReplacementRelic(room, fromPosition) {
  const occupied = new Set(Array.from(room.players.values()).map((player) => player.position));
  for (let offset = 5; offset < TRACK_SIZE + 5; offset += 1) {
    const position = (fromPosition + offset) % TRACK_SIZE;
    if (!room.relics.has(position) && !occupied.has(position)) {
      room.relics.add(position);
      return;
    }
  }
}

function resolveMove(room, playerId, action) {
  const player = room.players.get(playerId);
  if (room.phase !== 'playing' || room.turnPlayerId !== playerId || !player?.connected) {
    return;
  }
  if (action !== 'roll' && action !== 'surge') {
    return;
  }
  if (action === 'surge' && player.charge < 2) {
    return;
  }

  const distance = action === 'surge' ? 5 : Math.floor(Math.random() * 4) + 1;
  player.position = (player.position + distance) % TRACK_SIZE;
  if (action === 'surge') {
    player.charge -= 2;
  } else {
    player.charge = Math.min(3, player.charge + 1);
  }

  const events = [
    action === 'surge'
      ? `${player.name} surged ${distance} spaces.`
      : `${player.name} rolled ${distance} spaces.`,
  ];
  if (room.relics.delete(player.position)) {
    player.score += 1;
    player.charge = Math.min(3, player.charge + 1);
    events.push(`${player.name} collected a rune!`);
    spawnReplacementRelic(room, player.position);
  }

  const bumped = Array.from(room.players.values()).find(
    (rival) => rival.id !== player.id && rival.position === player.position
  );
  if (bumped) {
    bumped.position = (bumped.position - 2 + TRACK_SIZE) % TRACK_SIZE;
    if (bumped.score > 0) {
      bumped.score -= 1;
      player.score += 1;
      events.push(`${player.name} bumped ${bumped.name} and stole a rune!`);
    } else {
      events.push(`${player.name} bumped ${bumped.name} off the tile!`);
    }
  }

  room.lastEvent = events.join(' ');
  if (player.score >= TARGET_SCORE) {
    room.phase = 'finished';
    room.winnerId = player.id;
    room.deadline = null;
    room.lastEvent = `${player.name} collected five runes and wins the rally!`;
    broadcastState(room);
    recordMatchResults(room);
    return;
  }
  advanceTurn(room);
}

function resetMatch(room) {
  room.phase = 'waiting';
  room.relics = new Set(START_RELICS);
  room.turnNumber = 0;
  room.deadline = null;
  room.winnerId = null;
  room.matchId = crypto.randomUUID();
  room.resultRecorded = false;
  room.players.forEach((player) => {
    player.position = SYMBOL_ORDER.indexOf(player.symbol) * (TRACK_SIZE / SYMBOL_ORDER.length);
    player.score = 0;
    player.charge = 2;
  });
  room.turnPlayerId = getConnectedPlayers(room)[0]?.id || null;
  room.lastEvent = 'A fresh circuit is warming up.';
  startOrResumeMatch(room);
}

function leaveRoom(socket) {
  const room = runeRallyRooms.get(socket.runeRallyRoomCode);
  if (!room) {
    return;
  }

  room.sockets.delete(socket);
  const playerStillConnected = Array.from(room.sockets).some(
    (peer) => peer.runeRallyPlayerId === socket.runeRallyPlayerId
  );
  const player = room.players.get(socket.runeRallyPlayerId);
  if (player && !playerStillConnected) {
    player.connected = false;
  }
  room.lastActivityAt = Date.now();

  if (!playerStillConnected && player) {
    broadcastEvent(room, 'player-left', {
      playerId: socket.runeRallyPlayerId,
      playerName: player.name,
      connectedCount: getConnectedPlayers(room).length,
      totalCount: room.players.size,
    });
  }

  const connectedPlayers = getConnectedPlayers(room);
  if (room.phase === 'playing' && connectedPlayers.length < 2) {
    room.phase = 'waiting';
    room.deadline = null;
    room.lastEvent = 'The circuit pauses until at least two runners reconnect.';
  } else if (room.phase === 'playing' && room.turnPlayerId === socket.runeRallyPlayerId && !playerStillConnected) {
    advanceTurn(room);
    return;
  }
  broadcastState(room);
}

function normalizeMessage(rawData) {
  const text = rawData.toString('utf8');
  if (Buffer.byteLength(text, 'utf8') > MAX_MESSAGE_BYTES) {
    return null;
  }
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

async function authenticateRuneRallySocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }

  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'rune-rally') {
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

function advanceRooms() {
  const now = Date.now();
  runeRallyRooms.forEach((room) => {
    if (room.sockets.size === 0) {
      if (now - room.lastActivityAt > 30 * 60 * 1000) {
        runeRallyRooms.delete(room.code);
      }
      return;
    }
    if (room.phase === 'finished' && !room.resultRecorded) {
      recordMatchResults(room);
      return;
    }
    if (room.phase !== 'playing' || !room.deadline || now < room.deadline) {
      return;
    }
    resolveMove(room, room.turnPlayerId, 'roll');
  });
}

function attachRuneRallyWebSocket(server) {
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
    if (requestUrl.pathname !== '/ws/rune-rally') {
      return;
    }

    try {
      const auth = await authenticateRuneRallySocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.runeRallyRoomCode = auth.roomCode;
        ws.runeRallyPlayerId = auth.playerId;
        ws.isAlive = true;
        const room = getRoom(auth.roomCode, auth.roster);
        const player = room.players.get(auth.playerId);
        player.connected = true;
        player.name = auth.roster.find((member) => member.player_id === auth.playerId)?.name || player.name;
        room.sockets.add(ws);
        room.lastActivityAt = Date.now();

        broadcastEvent(room, 'player-joined', {
          playerId: auth.playerId,
          playerName: player.name,
          connectedCount: getConnectedPlayers(room).length,
          totalCount: room.players.size,
        });

        ws.on('pong', () => {
          ws.isAlive = true;
        });
        ws.on('message', (rawData) => {
          const payload = normalizeMessage(rawData);
          if (payload?.type === 'rune-rally-move') {
            resolveMove(room, auth.playerId, payload.action);
          } else if (payload?.type === 'rune-rally-rematch' && room.phase === 'finished') {
            resetMatch(room);
          }
        });
        ws.on('close', () => leaveRoom(ws));
        ws.on('error', (error) => {
          // eslint-disable-next-line no-console
          console.error('Rune Rally websocket error', error);
        });

        if (room.phase === 'waiting') {
          startOrResumeMatch(room);
        } else {
          broadcastState(room);
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Rune Rally websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachRuneRallyWebSocket,
};
