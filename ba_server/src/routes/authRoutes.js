const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  signInWithGoogleCredential,
  authenticateSessionToken,
  signOutSession,
} = require('../services/authService');
const { extractBearerToken } = require('../middleware/requireAuthSession');

const router = express.Router();

router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const payload = await signInWithGoogleCredential({
      credential: req.body.credential,
    });
    res.json(payload);
  })
);

router.get(
  '/session',
  asyncHandler(async (req, res) => {
    const token = extractBearerToken(req.headers.authorization);
    const payload = await authenticateSessionToken(token);
    res.json({
      player: payload.player,
      account: payload.account,
      expiresAt: payload.expiresAt,
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = extractBearerToken(req.headers.authorization);
    await signOutSession(token);
    res.json({ ok: true });
  })
);

module.exports = router;
