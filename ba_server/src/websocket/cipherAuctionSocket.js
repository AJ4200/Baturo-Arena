const { WebSocket, WebSocketServer } = require('ws');
const { authenticateSessionToken } = require('../services/authService');
const { getRoomByCode, findRoomPlayer } = require('../repositories/roomRepository');

const HEARTBEAT_INTERVAL_MS = 30000;
const TICK_INTERVAL_MS = 250;
const MAX_MESSAGE_BYTES = 2048;
const COMMIT_MS = 12000;
const REVEAL_MS = 4500;
const COUNTDOWN_MS = 3500;
const MAX_ROUNDS = 6;
const TARGET_SCORE = 18;
const CHIP_BUDGET = 7;
const PLAYER_COLORS = ['#55e6ff', '#ff6eb6', '#ffd65c', '#9b8cff'];
const VAULT_NAMES = [
  'Ghost Ledger',
  'Solar Key',
  'Black Archive',
  'Prism Cache',
  'Null Crown',
  'Echo Patent',
  'Velvet Root',
  'Ion Reserve',
  'Mirror Seed',
];
const cipherRooms = new Map();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getConnectedPlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function createRoom(roomCode) {
  return {
    code: roomCode,
    phase: 'waiting',
    round: 0,
    deadline: null,
    players: new Map(),
    sockets: new Set(),
    vaults: [],
    results: [],
    winnerIds: [],
    lastEvent: 'Waiting for another cipher broker.',
  };
}

function getCipherRoom(roomCode) {
  if (!cipherRooms.has(roomCode)) {
    cipherRooms.set(roomCode, createRoom(roomCode));
  }
  return cipherRooms.get(roomCode);
}

function createVaults(round) {
  return Array.from({ length: 3 }, (_, index) => {
    const seed = round * 7 + index * 11;
    const kindIndex = seed % 3;
    const kind = kindIndex === 0 ? 'archive' : kindIndex === 1 ? 'amplifier' : 'firewall';
    return {
      id: `vault-${round}-${index}`,
      name: VAULT_NAMES[seed % VAULT_NAMES.length],
      kind,
      reward: 2 + ((seed + index) % 4) + (kind === 'amplifier' ? 1 : 0),
      minBid: kind === 'firewall' ? 2 : 1,
    };
  });
}

function serializeRoom(room, viewerId) {
  const revealBids = room.phase === 'reveal' || room.phase === 'finished';
  return {
    type: 'cipher-auction-state',
    phase: room.phase,
    round: room.round,
    maxRounds: MAX_ROUNDS,
    targetScore: TARGET_SCORE,
    chipBudget: CHIP_BUDGET,
    deadline: room.deadline,
    serverNow: Date.now(),
    vaults: room.vaults,
    results: room.results,
    winnerIds: room.winnerIds,
    lastEvent: room.lastEvent,
    ownBids: room.players.get(viewerId)?.bids || [0, 0, 0],
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      symbol: player.symbol,
      color: player.color,
      score: player.score,
      connected: player.connected,
      locked: player.locked,
      bids: revealBids ? player.bids : undefined,
    })),
  };
}

function broadcastState(room) {
  room.sockets.forEach((socket) => {
    sendJson(socket, serializeRoom(room, socket.cipherPlayerId));
  });
}

function beginCountdown(room) {
  room.phase = 'countdown';
  room.deadline = Date.now() + COUNTDOWN_MS;
  room.lastEvent = 'Brokers linked. Encrypting the first vault set.';
  broadcastState(room);
}

function beginRound(room) {
  room.round += 1;
  room.phase = 'commit';
  room.deadline = Date.now() + COMMIT_MS;
  room.vaults = createVaults(room.round);
  room.results = [];
  room.winnerIds = [];
  room.lastEvent = `Round ${room.round}: split ${CHIP_BUDGET} signal chips, then lock the bid.`;
  room.players.forEach((player) => {
    player.bids = [0, 0, 0];
    player.locked = false;
  });
  broadcastState(room);
}

function resolveRound(room) {
  const connectedPlayers = getConnectedPlayers(room);
  const results = room.vaults.map((vault, vaultIndex) => {
    const bids = connectedPlayers.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      bid: player.bids[vaultIndex] || 0,
    }));
    const eligible = bids.filter((entry) => entry.bid >= vault.minBid);
    const topBid = eligible.reduce((highest, entry) => Math.max(highest, entry.bid), 0);
    const leaders = eligible.filter((entry) => entry.bid === topBid);

    if (leaders.length === 1) {
      const winner = room.players.get(leaders[0].playerId);
      if (winner) {
        winner.score += vault.reward;
      }
      return {
        vaultId: vault.id,
        outcome: 'won',
        winnerId: leaders[0].playerId,
        winnerName: leaders[0].playerName,
        topBid,
        reward: vault.reward,
        bids,
      };
    }

    if (leaders.length > 1) {
      leaders.forEach((leader) => {
        const tracedPlayer = room.players.get(leader.playerId);
        if (tracedPlayer) {
          tracedPlayer.score = Math.max(0, tracedPlayer.score - 1);
        }
      });
      return {
        vaultId: vault.id,
        outcome: 'tie',
        winnerId: null,
        winnerName: null,
        topBid,
        reward: vault.reward,
        bids,
      };
    }

    return {
      vaultId: vault.id,
      outcome: 'sealed',
      winnerId: null,
      winnerName: null,
      topBid: 0,
      reward: vault.reward,
      bids,
    };
  });

  room.results = results;
  room.phase = 'reveal';
  room.deadline = Date.now() + REVEAL_MS;
  const wins = results.filter((result) => result.outcome === 'won').length;
  const alarms = results.filter((result) => result.outcome === 'tie').length;
  room.lastEvent = `${wins} vault${wins === 1 ? '' : 's'} cracked. ${alarms} alarm${alarms === 1 ? '' : 's'} tripped.`;
  broadcastState(room);
}

function finishOrContinue(room) {
  const scores = Array.from(room.players.values())
    .filter((player) => player.connected)
    .sort((left, right) => right.score - left.score);
  const highScore = scores[0]?.score || 0;
  const leaders = scores.filter((player) => player.score === highScore);
  const reachedTarget = highScore >= TARGET_SCORE;
  const roundsComplete = room.round >= MAX_ROUNDS;

  if ((reachedTarget || roundsComplete) && leaders.length === 1) {
    room.phase = 'finished';
    room.deadline = null;
    room.winnerIds = [leaders[0].id];
    room.lastEvent = `${leaders[0].name} owns the cipher market with ${leaders[0].score} intel.`;
    broadcastState(room);
    return;
  }

  if (roundsComplete && leaders.length > 1) {
    room.lastEvent = 'Dead heat. Sudden-decrypt round engaged.';
  }
  beginRound(room);
}

function resetMatch(room) {
  room.round = 0;
  room.vaults = [];
  room.results = [];
  room.winnerIds = [];
  room.players.forEach((player) => {
    player.score = 0;
    player.bids = [0, 0, 0];
    player.locked = false;
  });
  beginCountdown(room);
}

function advanceRooms() {
  const now = Date.now();
  cipherRooms.forEach((room) => {
    const connectedPlayers = getConnectedPlayers(room);
    if (connectedPlayers.length < 2) {
      if (room.phase !== 'waiting') {
        room.phase = 'waiting';
        room.deadline = null;
        room.lastEvent = 'Signal paused until another broker reconnects.';
        broadcastState(room);
      }
      return;
    }

    if (room.phase === 'waiting') {
      beginCountdown(room);
      return;
    }

    if (!room.deadline || now < room.deadline) {
      return;
    }

    if (room.phase === 'countdown') {
      beginRound(room);
    } else if (room.phase === 'commit') {
      resolveRound(room);
    } else if (room.phase === 'reveal') {
      finishOrContinue(room);
    }
  });
}

function updateBid(room, playerId, payload) {
  if (room.phase !== 'commit') {
    return;
  }
  const player = room.players.get(playerId);
  if (!player) {
    return;
  }
  const bids = Array.isArray(payload.bids) ? payload.bids.map(Number) : [];
  if (
    bids.length !== 3 ||
    bids.some((bid) => !Number.isInteger(bid) || bid < 0 || bid > CHIP_BUDGET) ||
    bids.reduce((total, bid) => total + bid, 0) > CHIP_BUDGET
  ) {
    return;
  }

  player.bids = bids;
  player.locked = Boolean(payload.locked);
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers.length >= 2 && connectedPlayers.every((entry) => entry.locked)) {
    room.deadline = Math.min(room.deadline || Date.now() + 900, Date.now() + 900);
    room.lastEvent = 'All bids sealed. Accelerating reveal.';
  }
  broadcastState(room);
}

function leaveRoom(socket) {
  const room = cipherRooms.get(socket.cipherRoomCode);
  if (!room) {
    return;
  }
  room.sockets.delete(socket);
  const stillConnected = Array.from(room.sockets).some(
    (peer) => peer.cipherPlayerId === socket.cipherPlayerId
  );
  const player = room.players.get(socket.cipherPlayerId);
  if (player && !stillConnected) {
    player.connected = false;
    player.locked = false;
  }
  if (room.sockets.size === 0) {
    cipherRooms.delete(room.code);
  } else {
    broadcastState(room);
  }
}

async function authenticateCipherSocket(requestUrl) {
  const roomCode = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  const token = String(requestUrl.searchParams.get('token') || '').trim();
  if (!roomCode || !token) {
    return null;
  }
  const session = await authenticateSessionToken(token);
  const room = await getRoomByCode(roomCode);
  if (!room || room.game_type !== 'cipher-auction') {
    return null;
  }
  const membership = await findRoomPlayer(room.id, session.playerId);
  if (!membership) {
    return null;
  }
  return {
    roomCode,
    playerId: session.playerId,
    playerName: session.player?.name || 'Cipher Broker',
    symbol: membership.symbol || 'X',
  };
}

function attachCipherAuctionWebSocket(server) {
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
    if (requestUrl.pathname !== '/ws/cipher-auction') {
      return;
    }

    try {
      const auth = await authenticateCipherSocket(requestUrl);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.cipherRoomCode = auth.roomCode;
        ws.cipherPlayerId = auth.playerId;
        ws.isAlive = true;
        const room = getCipherRoom(auth.roomCode);
        const existing = room.players.get(auth.playerId);
        const playerIndex = existing ? existing.index : room.players.size;
        room.players.set(auth.playerId, {
          id: auth.playerId,
          name: auth.playerName,
          symbol: auth.symbol,
          color: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
          index: playerIndex,
          score: existing?.score || 0,
          bids: existing?.bids || [0, 0, 0],
          locked: existing?.locked || false,
          connected: true,
        });
        room.sockets.add(ws);

        ws.on('pong', () => {
          ws.isAlive = true;
        });
        ws.on('message', (rawData) => {
          const text = rawData.toString('utf8');
          if (text.length > MAX_MESSAGE_BYTES) {
            return;
          }
          let payload;
          try {
            payload = JSON.parse(text);
          } catch (_error) {
            return;
          }
          if (payload?.type === 'cipher-auction-bid') {
            updateBid(room, auth.playerId, payload);
          } else if (payload?.type === 'cipher-auction-rematch' && room.phase === 'finished') {
            resetMatch(room);
          }
        });
        ws.on('close', () => leaveRoom(ws));
        broadcastState(room);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Cipher Auction websocket upgrade failed', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  return wss;
}

module.exports = {
  attachCipherAuctionWebSocket,
};
