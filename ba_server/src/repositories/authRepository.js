const crypto = require('crypto');
const { run, get } = require('../db/client');

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function buildSessionExpiry(ttlHours) {
  const safeHours = Number.isFinite(Number(ttlHours)) && Number(ttlHours) > 0 ? Number(ttlHours) : 168;
  return new Date(Date.now() + safeHours * 60 * 60 * 1000).toISOString();
}

async function createSession(playerId, ttlHours) {
  const token = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = buildSessionExpiry(ttlHours);

  await run(
    `INSERT INTO auth_sessions (token_hash, player_id, expires_at, last_used_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [tokenHash, playerId, expiresAt]
  );

  return {
    token,
    expiresAt,
  };
}

async function revokeSessionByToken(token) {
  const tokenHash = hashSessionToken(token);
  await run('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);
}

async function upsertGoogleAccount({ playerId, googleSub, email, picture }) {
  await run(
    `INSERT INTO google_accounts (google_sub, player_id, email, picture, last_login_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (google_sub)
     DO UPDATE SET
       player_id = EXCLUDED.player_id,
       email = EXCLUDED.email,
       picture = EXCLUDED.picture,
       last_login_at = CURRENT_TIMESTAMP`,
    [googleSub, playerId, email || null, picture || null]
  );
}

async function getSessionByToken(token) {
  const tokenHash = hashSessionToken(token);
  const row = await get(
    `SELECT
      s.player_id,
      s.expires_at,
      p.id,
      p.name,
      p.wins,
      p.losses,
      p.draws,
      ga.google_sub,
      ga.email,
      ga.picture
     FROM auth_sessions s
     INNER JOIN players p ON p.id = s.player_id
     LEFT JOIN google_accounts ga ON ga.player_id = p.id
     WHERE s.token_hash = ?`,
    [tokenHash]
  );

  if (!row) {
    return null;
  }

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await run('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }

  await run(
    `UPDATE auth_sessions
     SET last_used_at = CURRENT_TIMESTAMP
     WHERE token_hash = ?`,
    [tokenHash]
  );

  return row;
}

module.exports = {
  createSession,
  revokeSessionByToken,
  upsertGoogleAccount,
  getSessionByToken,
};
