const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { registerPlayer, getLeaderboard } = require("../services/gameService");

const router = express.Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const player = await registerPlayer({
      playerId: req.body.playerId,
      name: req.body.name,
    });
    res.json(player);
  })
);

router.get(
  "/leaderboard",
  asyncHandler(async (_req, res) => {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  })
);

module.exports = router;
