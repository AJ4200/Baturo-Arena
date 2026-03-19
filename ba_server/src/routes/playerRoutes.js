const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const {
  registerPlayer,
  recordPlayerMatchResult,
  getLeaderboard,
} = require("../services/gameService");

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

router.post(
  "/result",
  asyncHandler(async (req, res) => {
    const player = await recordPlayerMatchResult({
      playerId: req.body.playerId,
      gameType: req.body.gameType,
      outcome: req.body.outcome,
    });
    res.json(player);
  })
);

module.exports = router;
