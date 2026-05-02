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
    CREATE TABLE IF NOT EXISTS raiburu_requests (
      id BIGSERIAL PRIMARY KEY,
      requester_player_id TEXT NOT NULL,
      recipient_player_id TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_player_id) REFERENCES players(id) ON DELETE CASCADE,
      CHECK (requester_player_id <> recipient_player_id)
    )
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_raiburu_requests_pending_pair
    ON raiburu_requests (
      LEAST(requester_player_id, recipient_player_id),
      GREATEST(requester_player_id, recipient_player_id)
    )
    WHERE status = 'pending'
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_raiburu_requests_recipient
    ON raiburu_requests(recipient_player_id, status, updated_at DESC)
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS raiburu_messages (
      id BIGSERIAL PRIMARY KEY,
      sender_player_id TEXT NOT NULL,
      recipient_player_id TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat',
      room_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMPTZ,
      FOREIGN KEY (sender_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_player_id) REFERENCES players(id) ON DELETE CASCADE,
      CHECK (sender_player_id <> recipient_player_id)
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_raiburu_messages_pair
    ON raiburu_messages(sender_player_id, recipient_player_id, created_at DESC)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_raiburu_messages_recipient
    ON raiburu_messages(recipient_player_id, read_at, created_at DESC)
  `);

  await run(`
    DELETE FROM auth_sessions
    WHERE expires_at <= CURRENT_TIMESTAMP
  `);
}

module.exports = { runMigrations };
