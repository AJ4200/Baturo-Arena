const { run, all } = require("./client");

async function ensureRoomColumns() {
  const columns = await all("PRAGMA table_info(rooms)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("game_type")) {
    await run("ALTER TABLE rooms ADD COLUMN game_type TEXT NOT NULL DEFAULT 'tic-tac-two'");
  }

  if (!columnNames.has("max_players")) {
    await run("ALTER TABLE rooms ADD COLUMN max_players INTEGER NOT NULL DEFAULT 4");
  }
}

async function runMigrations() {
  await run(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      creator_player_id TEXT NOT NULL,
      game_type TEXT NOT NULL DEFAULT 'tic-tac-two',
      max_players INTEGER NOT NULL DEFAULT 4,
      board TEXT NOT NULL,
      turn TEXT NOT NULL DEFAULT 'X',
      status TEXT NOT NULL DEFAULT 'waiting',
      winner TEXT,
      result_recorded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_player_id) REFERENCES players(id)
    )
  `);

  await ensureRoomColumns();

  await run(`
    CREATE TABLE IF NOT EXISTS room_players (
      room_id INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, player_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);
}

module.exports = { runMigrations };
