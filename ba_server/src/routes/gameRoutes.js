const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { listGames } = require("../services/gameService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const games = await listGames();
    res.json({ games });
  })
);

module.exports = router;
