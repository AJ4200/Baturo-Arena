const app = require("./app");
const { port, dbInitRetryDelayMs } = require("./config/env");
const { initDatabase } = require("./db");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function initializeDatabaseWithRetry() {
  let attempt = 0;
  const retryDelayMs =
    Number.isFinite(dbInitRetryDelayMs) && dbInitRetryDelayMs > 0 ? dbInitRetryDelayMs : 5000;

  while (true) {
    attempt += 1;
    try {
      await initDatabase();
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Database init attempt ${attempt} failed; retrying in ${retryDelayMs}ms`, error);
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryDelayMs);
    }
  }
}

const http = require('http');
const notifications = require('./notifications');

async function startServer() {
  await initializeDatabaseWithRetry();
  const server = http.createServer(app);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`baturo-arena api listening on http://localhost:${port}`);
  });

  // Initialize WebSocket notifications on the same server
  notifications.init(server);
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
