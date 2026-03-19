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
    winCondition: 'connect',
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
    winCondition: 'connect',
  },
  'orbital-flip': {
    id: 'orbital-flip',
    name: 'Orbital-Flip',
    rows: 4,
    columns: 4,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Start from a live center core, place a piece each turn, and flip every neighboring enemy tile to control the board.',
    moveMode: 'flip',
    winCondition: 'majority',
  },
  'corner-clash': {
    id: 'corner-clash',
    name: 'Corner-Clash',
    rows: 5,
    columns: 5,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Capture the corners. Every move also flips orthogonally adjacent enemy tiles.',
    moveMode: 'corner-flip',
    winCondition: 'corners',
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

  const board = Array(rules.rows * rules.columns).fill(null);

  if (rules.id === 'orbital-flip') {
    const midLeft = getCellIndex(1, 1, rules.columns);
    const midRight = getCellIndex(1, 2, rules.columns);
    const lowLeft = getCellIndex(2, 1, rules.columns);
    const lowRight = getCellIndex(2, 2, rules.columns);
    board[midLeft] = 'X';
    board[midRight] = 'O';
    board[lowLeft] = 'O';
    board[lowRight] = 'X';
  }

  return board;
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
    winCondition: rules.winCondition || 'connect',
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

  if (rules.winCondition === 'majority') {
    const xCount = board.filter((cell) => cell === 'X').length;
    const oCount = board.filter((cell) => cell === 'O').length;

    if (xCount === 0) {
      return 'O';
    }

    if (oCount === 0) {
      return 'X';
    }

    if (isBoardFull(board)) {
      if (xCount === oCount) {
        return 'draw';
      }
      return xCount > oCount ? 'X' : 'O';
    }

    return null;
  }

  if (rules.winCondition === 'corners') {
    const corners = [
      getCellIndex(0, 0, rules.columns),
      getCellIndex(0, rules.columns - 1, rules.columns),
      getCellIndex(rules.rows - 1, 0, rules.columns),
      getCellIndex(rules.rows - 1, rules.columns - 1, rules.columns),
    ];
    const xCorners = corners.filter((index) => board[index] === 'X').length;
    const oCorners = corners.filter((index) => board[index] === 'O').length;

    if (xCorners >= 3) {
      return 'X';
    }

    if (oCorners >= 3) {
      return 'O';
    }

    if (isBoardFull(board)) {
      const xCount = board.filter((cell) => cell === 'X').length;
      const oCount = board.filter((cell) => cell === 'O').length;
      if (xCount === oCount) {
        return 'draw';
      }
      return xCount > oCount ? 'X' : 'O';
    }

    return null;
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

  if (
    rules.moveMode === 'cell' ||
    rules.moveMode === 'flip' ||
    rules.moveMode === 'corner-flip'
  ) {
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

  if (rules.moveMode === 'flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / rules.columns);
    const column = move % rules.columns;

    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (rowStep === 0 && columnStep === 0) {
          continue;
        }

        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= rules.rows ||
          nextColumn < 0 ||
          nextColumn >= rules.columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
        if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
          nextBoard[nextIndex] = symbol;
        }
      }
    }

    return nextBoard;
  }

  if (rules.moveMode === 'corner-flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / rules.columns);
    const column = move % rules.columns;
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [rowStep, columnStep] of deltas) {
      const nextRow = row + rowStep;
      const nextColumn = column + columnStep;
      if (
        nextRow < 0 ||
        nextRow >= rules.rows ||
        nextColumn < 0 ||
        nextColumn >= rules.columns
      ) {
        continue;
      }

      const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
      if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
        nextBoard[nextIndex] = symbol;
      }
    }

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
