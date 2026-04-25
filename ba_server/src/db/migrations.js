const { run, all } = require('./client');

async function ensureRoomColumns() {
  const columns = await all(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'rooms'`
  );
  const columnNames = new Set(columns.map((column) => column.column_name));

  if (!columnNames.has('game_type')) {
    await run("ALTER TABLE rooms ADD COLUMN game_type TEXT NOT NULL DEFAULT 'tic-tac-two'");
  }

  if (!columnNames.has('max_players')) {
    await run('ALTER TABLE rooms ADD COLUMN max_players INTEGER NOT NULL DEFAULT 4');
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
      invite_only_raibarus BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      creator_player_id TEXT NOT NULL,
      game_type TEXT NOT NULL DEFAULT 'tic-tac-two',
      max_players INTEGER NOT NULL DEFAULT 4,
      board TEXT NOT NULL,
      turn TEXT NOT NULL DEFAULT 'X',
      status TEXT NOT NULL DEFAULT 'waiting',
      winner TEXT,
      result_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_player_id) REFERENCES players(id)
    )
  `);

  await ensureRoomColumns();

  await run(`
    CREATE TABLE IF NOT EXISTS room_players (
      room_id BIGINT NOT NULL,
      player_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, player_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS player_game_stats (
      player_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, game_type),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await run(`
    INSERT INTO player_game_stats (player_id, game_type, wins, losses, draws, updated_at)
    SELECT id, 'tic-tac-two', wins, losses, draws, CURRENT_TIMESTAMP
    FROM players
    ON CONFLICT (player_id, game_type) DO NOTHING
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS google_accounts (
      google_sub TEXT PRIMARY KEY,
      player_id TEXT NOT NULL UNIQUE,
      email TEXT,
      picture TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_player_id
    ON auth_sessions(player_id)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions(expires_at)
  `);

  await run(`
    DELETE FROM auth_sessions
    WHERE expires_at <= CURRENT_TIMESTAMP
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS friends (
      player_id TEXT NOT NULL,
      friend_player_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, friend_player_id),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS invites (
      id BIGSERIAL PRIMARY KEY,
      from_player_id TEXT NOT NULL,
      to_player_id TEXT,
      to_email TEXT,
      room_code TEXT,
      message TEXT,
      email_status TEXT,
      email_attempts INTEGER NOT NULL DEFAULT 0,
      last_email_attempt TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id BIGSERIAL PRIMARY KEY,
      from_player_id TEXT NOT NULL,
      to_player_id TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (to_player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);
}

module.exports = { runMigrations };
