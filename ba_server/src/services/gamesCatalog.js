const { listGameRules, getGameRules } = require('../utils/game');

function toGameDefinition(rules) {
  return {
    id: rules.id,
    name: rules.name,
    minPlayers: rules.minPlayers,
    maxPlayers: rules.maxPlayers,
    description: rules.description,
    rows: rules.rows,
    columns: rules.columns,
    connect: rules.connect,
    moveMode: rules.moveMode,
    winCondition: rules.winCondition,
    supportsOnline: Boolean(rules.supportsOnline),
    supportsCpu: Boolean(rules.supportsCpu),
  };
}

function listGames() {
  return listGameRules().map(toGameDefinition);
}

function getGameById(gameId) {
  const rules = getGameRules(gameId);
  return rules ? toGameDefinition(rules) : null;
}

module.exports = {
  listGames,
  getGameById,
};
