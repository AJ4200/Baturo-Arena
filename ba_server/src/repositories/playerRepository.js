const crypto = require('crypto');
const { run, get, all } = require('../db/client');

function fallbackName(playerId) {
  return `Player-${playerId.slice(0, 4).toUpperCase()}`;
}

async function upsertPlayer({ playerId, name }) {
  const id = (playerId && String(playerId).trim()) || crypto.randomUUID();
  const trimmedName = (name && String(name).trim()) || fallbackName(id);

  const existing = await get('SELECT * FROM players WHERE id = ?', [id]);
  if (!existing) {
    await run(
      `INSERT INTO players (id, name, wins, losses, draws, updated_at)
       VALUES (?, ?, 0, 0, 0, CURRENT_TIMESTAMP)`,
      [id, trimmedName]
    );
  } else if (trimmedName !== existing.name) {
    await run(
      'UPDATE players SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [trimmedName, id]
    );
  }

  return get('SELECT * FROM players WHERE id = ?', [id]);
}

async function getPlayerById(playerId) {
  return get('SELECT * FROM players WHERE id = ?', [playerId]);
}

async function incrementPlayerStats(playerId, { wins = 0, losses = 0, draws = 0 }) {
  await run(
    `UPDATE players
     SET wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [wins, losses, draws, playerId]
  );
}

async function incrementPlayerGameStats(playerId, gameType, { wins = 0, losses = 0, draws = 0 }) {
  await run(
    `INSERT INTO player_game_stats (player_id, game_type, wins, losses, draws, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(player_id, game_type)
     DO UPDATE SET
       wins = wins + excluded.wins,
       losses = losses + excluded.losses,
       draws = draws + excluded.draws,
       updated_at = CURRENT_TIMESTAMP`,
    [playerId, gameType, wins, losses, draws]
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

async function listPlayersByGameScore(gameType) {
  return all(
    `SELECT
      p.id,
      p.name,
      pgs.game_type,
      pgs.wins,
      pgs.losses,
      pgs.draws,
      (pgs.wins * 3 + pgs.draws) AS score
     FROM player_game_stats pgs
     INNER JOIN players p ON p.id = pgs.player_id
     WHERE pgs.game_type = ?
     ORDER BY score DESC, pgs.wins DESC, pgs.draws DESC, pgs.losses ASC, p.name ASC`,
    [gameType]
  );
}

module.exports = {
  upsertPlayer,
  getPlayerById,
  incrementPlayerStats,
  incrementPlayerGameStats,
  listPlayersByScore,
  listPlayersByGameScore,
};
