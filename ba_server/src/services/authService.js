const { OAuth2Client } = require('google-auth-library');
const HttpError = require('../errors/HttpError');
const { googleClientId, authSessionTtlHours } = require('../config/env');
const { upsertPlayer } = require('../repositories/playerRepository');
const {
  createSession,
  revokeSessionByToken,
  upsertGoogleAccount,
  getSessionByToken,
} = require('../repositories/authRepository');

let oauthClient = null;

function collectErrorCodes(error, target = new Set(), visited = new Set()) {
  if (!error || typeof error !== 'object') {
    return target;
  }

  if (visited.has(error)) {
    return target;
  }
  visited.add(error);

  if (typeof error.code === 'string') {
    target.add(error.code);
  }

  if (Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      collectErrorCodes(nestedError, target, visited);
    }
  }

  if (error.cause) {
    collectErrorCodes(error.cause, target, visited);
  }

  if (error.sourceError) {
    collectErrorCodes(error.sourceError, target, visited);
  }

  return target;
}

function isTransientDatabaseError(error) {
  const retryableCodes = new Set([
    'ETIMEDOUT',
    'ENETUNREACH',
    'ECONNRESET',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ENOTFOUND',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_CONNECT_ERROR',
  ]);

  const codes = collectErrorCodes(error);
  for (const code of codes) {
    if (retryableCodes.has(code)) {
      return true;
    }
  }

  return false;
}

async function withTransientRetry(task, { attempts = 3, baseDelayMs = 400 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await task();
    } catch (error) {
      lastError = error;
      const shouldRetry = isTransientDatabaseError(error) && attempt < attempts;
      if (!shouldRetry) {
        throw error;
      }

      const waitMs = baseDelayMs * attempt;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

function serializePlayer(player) {
  if (!player) {
    return null;
  }

  return {
    playerId: player.id,
    name: player.name,
    wins: Number(player.wins),
    losses: Number(player.losses),
    draws: Number(player.draws),
  };
}

function getGoogleOAuthClient() {
  if (!googleClientId) {
    throw new HttpError(500, 'GOOGLE_CLIENT_ID is required on the API server');
  }

  if (!oauthClient) {
    oauthClient = new OAuth2Client(googleClientId);
  }

  return oauthClient;
}

function extractNameFromPayload(payload) {
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim();
  }
  if (typeof payload.given_name === 'string' && payload.given_name.trim()) {
    return payload.given_name.trim();
  }
  if (typeof payload.email === 'string' && payload.email.includes('@')) {
    return payload.email.split('@')[0];
  }
  return 'Google Player';
}

async function verifyGoogleCredential(credential) {
  const trimmedCredential = String(credential || '').trim();
  if (!trimmedCredential) {
    throw new HttpError(400, 'Google credential is required');
  }

  const client = getGoogleOAuthClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken: trimmedCredential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Invalid Google credential');
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, 'Google credential could not be verified');
  }
}

async function verifyGoogleAccessToken(accessToken) {
  const trimmedToken = String(accessToken || '').trim();
  if (!trimmedToken) {
    throw new HttpError(400, 'Google access token is required');
  }

  if (!googleClientId) {
    throw new HttpError(500, 'GOOGLE_CLIENT_ID is required on the API server');
  }

  let tokenInfo = null;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(trimmedToken)}`
    );
    if (!response.ok) {
      throw new Error(`Token info request failed with status ${response.status}`);
    }
    tokenInfo = await response.json();
  } catch (_error) {
    throw new HttpError(401, 'Google access token could not be verified');
  }

  if (!tokenInfo || typeof tokenInfo.sub !== 'string') {
    throw new HttpError(401, 'Invalid Google access token');
  }

  const audience = typeof tokenInfo.aud === 'string' ? tokenInfo.aud : '';
  if (audience && audience !== googleClientId) {
    throw new HttpError(401, 'Google access token audience mismatch');
  }

  return tokenInfo;
}

async function fetchGoogleUserInfo(accessToken) {
  try {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload || typeof payload.sub !== 'string') {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
}

async function createGoogleSessionFromIdentity({ sub, name, email, picture }) {
  const playerId = `google:${sub}`;
  const playerName = extractNameFromPayload({ name, email });

  const player = await withTransientRetry(() =>
    upsertPlayer({
      playerId,
      name: playerName,
    })
  );

  await withTransientRetry(() =>
    upsertGoogleAccount({
      playerId,
      googleSub: sub,
      email: typeof email === 'string' ? email : null,
      picture: typeof picture === 'string' ? picture : null,
    })
  );

  const session = await withTransientRetry(() => createSession(playerId, authSessionTtlHours));

  return {
    player: serializePlayer(player),
    account: {
      sub,
      name: player.name,
      email: typeof email === 'string' ? email : undefined,
      picture: typeof picture === 'string' ? picture : undefined,
    },
    authToken: session.token,
    expiresAt: session.expiresAt,
  };
}

async function signInWithGoogleCredential({ credential }) {
  const payload = await verifyGoogleCredential(credential);
  return createGoogleSessionFromIdentity({
    sub: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
  });
}

async function signInWithGoogleAccessToken({ accessToken }) {
  const tokenInfo = await verifyGoogleAccessToken(accessToken);
  const userInfo = await fetchGoogleUserInfo(accessToken);

  const sub = userInfo?.sub || tokenInfo.sub;
  const email =
    (typeof userInfo?.email === 'string' && userInfo.email) ||
    (typeof tokenInfo.email === 'string' && tokenInfo.email) ||
    undefined;
  const name =
    (typeof userInfo?.name === 'string' && userInfo.name) ||
    (typeof tokenInfo.name === 'string' && tokenInfo.name) ||
    undefined;
  const picture = typeof userInfo?.picture === 'string' ? userInfo.picture : undefined;

  return createGoogleSessionFromIdentity({
    sub,
    name,
    email,
    picture,
  });
}

async function authenticateSessionToken(token) {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    throw new HttpError(401, 'Authentication token is required');
  }

  const session = await getSessionByToken(trimmedToken);
  if (!session) {
    throw new HttpError(401, 'Session expired or invalid. Sign in again.');
  }

  return {
    playerId: session.player_id,
    player: serializePlayer(session),
    account: session.google_sub
      ? {
          sub: session.google_sub,
          name: session.name,
          email: session.email || undefined,
          picture: session.picture || undefined,
        }
      : null,
    expiresAt: session.expires_at,
  };
}

async function signOutSession(token) {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    return;
  }
  await revokeSessionByToken(trimmedToken);
}

module.exports = {
  signInWithGoogleCredential,
  signInWithGoogleAccessToken,
  authenticateSessionToken,
  signOutSession,
};
