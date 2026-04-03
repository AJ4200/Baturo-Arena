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

async function signInWithGoogleCredential({ credential }) {
  const payload = await verifyGoogleCredential(credential);
  const playerId = `google:${payload.sub}`;
  const playerName = extractNameFromPayload(payload);

  const player = await upsertPlayer({
    playerId,
    name: playerName,
  });

  await upsertGoogleAccount({
    playerId,
    googleSub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  });

  const session = await createSession(playerId, authSessionTtlHours);

  return {
    player: serializePlayer(player),
    account: {
      sub: payload.sub,
      name: player.name,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    },
    authToken: session.token,
    expiresAt: session.expiresAt,
  };
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
  authenticateSessionToken,
  signOutSession,
};
