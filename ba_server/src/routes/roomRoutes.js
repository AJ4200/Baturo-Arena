const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
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

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = await createNewRoom({
      playerId: req.body.playerId,
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
      playerId: req.body.playerId,
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
      playerId:
        typeof req.query.playerId === "string" ? req.query.playerId : undefined,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/move",
  asyncHandler(async (req, res) => {
    const payload = await makeMove({
      code: req.params.code,
      playerId: req.body.playerId,
      index: req.body.index,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/rematch",
  asyncHandler(async (req, res) => {
    const payload = await rematchRoom({
      code: req.params.code,
      playerId: req.body.playerId,
    });
    res.json(payload);
  })
);

router.post(
  "/:code/leave",
  asyncHandler(async (req, res) => {
    const payload = await leaveRoom({
      code: req.params.code,
      playerId: req.body.playerId,
    });
    res.json(payload);
  })
);

module.exports = router;
