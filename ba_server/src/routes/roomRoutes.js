const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuthSession } = require("../middleware/requireAuthSession");
const {
  createNewRoom,
  joinExistingRoom,
  getRoomState,
  makeMove,
  rematchRoom,
  leaveRoom,
  listPublicRooms,
} = require("../services/gameService");

const router = express.Router();

router.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const rooms = await listPublicRooms();
    res.json({ rooms });
  })
);

router.use(requireAuthSession);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = await createNewRoom({
      playerId: req.auth.playerId,
      roomName: req.body.roomName,
      isPublic: req.body.isPublic,
      gameType: req.body.gameType,
    });
    res.json(payload);
  })
);

router.post(
  "/join",
  asyncHandler(async (req, res) => {
    const payload = await joinExistingRoom({
      playerId: req.auth.playerId,
      code: req.body.code,
    });
    res.json(payload);
  })
);

router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const payload = await getRoomState({
      code: req.params.code,
      playerId: req.auth.playerId,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/move",
  asyncHandler(async (req, res) => {
    const payload = await makeMove({
      code: req.params.code,
      playerId: req.auth.playerId,
      index: req.body.index,
      move: req.body.move,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/rematch",
  asyncHandler(async (req, res) => {
    const payload = await rematchRoom({
      code: req.params.code,
      playerId: req.auth.playerId,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/leave",
  asyncHandler(async (req, res) => {
    const payload = await leaveRoom({
      code: req.params.code,
      playerId: req.auth.playerId,
    });
    res.json(payload);
  })
);

module.exports = router;
