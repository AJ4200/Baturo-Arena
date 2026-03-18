const GAME_CATALOG = {
  "tic-tac-two": {
    id: "tic-tac-two",
    name: "Tic-Tac-Two",
    minPlayers: 2,
    maxPlayers: 4,
    description: "Classic tic-tac-toe for teams X and O. Up to 4 players can join (2 per side).",
  },
};

function listGames() {
  return Object.values(GAME_CATALOG);
}

function getGameById(gameId) {
  return GAME_CATALOG[gameId] || null;
}

module.exports = {
  listGames,
  getGameById,
};
