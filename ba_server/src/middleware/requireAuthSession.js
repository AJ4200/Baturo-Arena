const asyncHandler = require('../utils/asyncHandler');
const { authenticateSessionToken } = require('../services/authService');

function extractBearerToken(authorizationHeader) {
  const headerValue = String(authorizationHeader || '').trim();
  if (!headerValue) {
    return '';
  }

  const [scheme, token] = headerValue.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return '';
  }
  return token;
}

const requireAuthSession = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  const session = await authenticateSessionToken(token);
  req.auth = session;
  next();
});

module.exports = {
  requireAuthSession,
  extractBearerToken,
};
