const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuthSession } = require('../middleware/requireAuthSession');
const {
  getSocialSnapshot,
  searchRaiburuCandidates,
  sendRaiburuRequest,
  answerRaiburuRequest,
  getConversation,
  sendChatMessage,
  sendRoomInvite,
} = require('../services/socialService');

const router = express.Router();

router.use(requireAuthSession);

router.get(
  '/snapshot',
  asyncHandler(async (req, res) => {
    const payload = await getSocialSnapshot(req.auth.playerId);
    res.json(payload);
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const payload = await searchRaiburuCandidates({
      playerId: req.auth.playerId,
      query: req.query.q,
    });
    res.json(payload);
  })
);

router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const payload = await sendRaiburuRequest({
      requesterPlayerId: req.auth.playerId,
      recipientPlayerId: req.body.toPlayerId,
      message: req.body.message,
    });
    res.json(payload);
  })
);

router.post(
  '/requests/:requestId/:action',
  asyncHandler(async (req, res) => {
    const payload = await answerRaiburuRequest({
      playerId: req.auth.playerId,
      requestId: req.params.requestId,
      action: req.params.action,
    });
    res.json(payload);
  })
);

router.get(
  '/messages/:playerId',
  asyncHandler(async (req, res) => {
    const payload = await getConversation({
      playerId: req.auth.playerId,
      otherPlayerId: req.params.playerId,
    });
    res.json(payload);
  })
);

router.post(
  '/messages',
  asyncHandler(async (req, res) => {
    const payload = await sendChatMessage({
      playerId: req.auth.playerId,
      toPlayerId: req.body.toPlayerId,
      body: req.body.body,
    });
    res.json(payload);
  })
);

router.post(
  '/invites',
  asyncHandler(async (req, res) => {
    const payload = await sendRoomInvite({
      playerId: req.auth.playerId,
      toPlayerId: req.body.toPlayerId,
      roomCode: req.body.roomCode,
      message: req.body.message,
    });
    res.json(payload);
  })
);

module.exports = router;
