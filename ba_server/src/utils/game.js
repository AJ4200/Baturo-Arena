const GAME_RULES = {
  'tic-tac-two': {
    id: 'tic-tac-two',
    name: 'Tic-Tac-Two',
    rows: 3,
    columns: 3,
    connect: 3,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic tic-tac-toe for teams X and O. Up to 4 players can join (2 per side).',
    moveMode: 'cell',
  },
  'connect-all-four': {
    id: 'connect-all-four',
    name: 'Connect-All-Four',
    rows: 6,
    columns: 7,
    connect: 4,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Drop pieces into columns and connect four before your rival does.',
    moveMode: 'column',
  },
};

function getGameRules(gameType) {
  return GAME_RULES[gameType] || null;
}

function listGameRules() {
  return Object.values(GAME_RULES);
}

function createEmptyBoard(gameType) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  return Array(rules.rows * rules.columns).fill(null);
}

function getBoardDimensions(gameType) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  return {
    rows: rules.rows,
    columns: rules.columns,
    connect: rules.connect,
    moveMode: rules.moveMode,
  };
}

function getCellIndex(row, column, columns) {
  return row * columns + column;
}

function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

function checkWinner(gameType, board) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < rules.rows; row += 1) {
    for (let column = 0; column < rules.columns; column += 1) {
      const startIndex = getCellIndex(row, column, rules.columns);
      const symbol = board[startIndex];

      if (!symbol) {
        continue;
      }

      for (const [rowStep, columnStep] of directions) {
        let connected = 1;

        while (connected < rules.connect) {
          const nextRow = row + rowStep * connected;
          const nextColumn = column + columnStep * connected;

          if (
            nextRow < 0 ||
            nextRow >= rules.rows ||
            nextColumn < 0 ||
            nextColumn >= rules.columns
          ) {
            break;
          }

          const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
          if (board[nextIndex] !== symbol) {
            break;
          }

          connected += 1;
        }

        if (connected === rules.connect) {
          return symbol;
        }
      }
    }
  }

  if (isBoardFull(board)) {
    return 'draw';
  }

  return null;
}

function getAvailableMoves(gameType, board) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (rules.moveMode === 'cell') {
    return board.reduce((moves, cell, index) => {
      if (cell === null) {
        moves.push(index);
      }
      return moves;
    }, []);
  }

  const moves = [];
  for (let column = 0; column < rules.columns; column += 1) {
    if (board[getCellIndex(0, column, rules.columns)] === null) {
      moves.push(column);
    }
  }
  return moves;
}

function isValidMove(gameType, board, move) {
  return getAvailableMoves(gameType, board).includes(move);
}

function applyMove(gameType, board, move, symbol) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (!isValidMove(gameType, board, move)) {
    throw new Error('Invalid move');
  }

  const nextBoard = [...board];

  if (rules.moveMode === 'cell') {
    nextBoard[move] = symbol;
    return nextBoard;
  }

  for (let row = rules.rows - 1; row >= 0; row -= 1) {
    const index = getCellIndex(row, move, rules.columns);
    if (nextBoard[index] === null) {
      nextBoard[index] = symbol;
      return nextBoard;
    }
  }

  throw new Error('Invalid move');
}

module.exports = {
  GAME_RULES,
  getGameRules,
  listGameRules,
  createEmptyBoard,
  getBoardDimensions,
  checkWinner,
  getAvailableMoves,
  isValidMove,
  applyMove,
};
