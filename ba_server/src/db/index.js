const { initializeClient } = require("./client");
const { runMigrations } = require("./migrations");

async function initDatabase() {
  await initializeClient();
  await runMigrations();
}

module.exports = { initDatabase };
