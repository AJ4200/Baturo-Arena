const crypto = require("crypto");
const { run, get, all } = require("../db/client");

function fallbackName(playerId) {
  return `Player-${playerId.slice(0, 4).toUpperCase()}`;
}

async function upsertPlayer({ playerId, name }) {
  const id = (playerId && String(playerId).trim()) || crypto.randomUUID();
  const trimmedName = (name && String(name).trim()) || fallbackName(id);

  const existing = await get("SELECT * FROM players WHERE id = ?", [id]);
  if (!existing) {
    await run(
      `INSERT INTO players (id, name, wins, losses, draws, updated_at)
       VALUES (?, ?, 0, 0, 0, CURRENT_TIMESTAMP)`,
      [id, trimmedName]
    );
  } else if (trimmedName !== existing.name) {
    await run(
      "UPDATE players SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [trimmedName, id]
    );
  }

  return get("SELECT * FROM players WHERE id = ?", [id]);
}

async function getPlayerById(playerId) {
  return get("SELECT * FROM players WHERE id = ?", [playerId]);
}

async function incrementPlayerStats(playerId, { wins = 0, losses = 0, draws = 0 }) {
  await run(
    `UPDATE players
     SET wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [wins, losses, draws, playerId]
  );
}

async function listPlayersByScore() {
  return all(
    `SELECT
      id,
      name,
      wins,
      losses,
      draws,
      (wins * 3 + draws) AS score
    FROM players
    ORDER BY score DESC, wins DESC, draws DESC, losses ASC, name ASC`
  );
}

module.exports = {
  upsertPlayer,
  getPlayerById,
  incrementPlayerStats,
  listPlayersByScore,
};
