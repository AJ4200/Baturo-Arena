const WebSocket = require('ws');
const { authenticateSessionToken } = require('./services/authService');
let wss = null;
let clientsByPlayer = new Map();

function init(server) {
  if (wss) return;
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    // Expect the client to send a JSON message { type: 'identify', token }
    ws.once('message', async (raw) => {
      try {
        const payload = JSON.parse(String(raw));
        if (payload && payload.type === 'identify' && payload.token) {
          try {
            const session = await authenticateSessionToken(payload.token);
            const playerId = session.playerId;
            clientsByPlayer.set(playerId, ws);
            ws.on('close', () => {
              clientsByPlayer.delete(playerId);
            });
          } catch (_e) {
            // authentication failed - close connection
            try { ws.close(); } catch (_err) {}
          }
        } else {
          try { ws.close(); } catch (_err) {}
        }
      } catch (_e) {
        try { ws.close(); } catch (_err) {}
      }
    });
  });
}

function notifyPlayer(playerId, data) {
  const ws = clientsByPlayer.get(playerId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(data));
  } catch (_e) {
    // ignore
  }
}

module.exports = { init, notifyPlayer };
