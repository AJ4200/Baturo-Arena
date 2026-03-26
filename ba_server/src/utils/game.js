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
    supportsOnline: true,
    supportsCpu: true,
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
    supportsOnline: true,
    supportsCpu: true,
  },
  'orbital-flip': {
    id: 'orbital-flip',
    name: 'Orbital-Flip',
    rows: 6,
    columns: 6,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Expanded 6x6 orbital grid: place a piece each turn and flip neighboring enemy tiles to control space.',
    moveMode: 'flip',
    winCondition: 'majority',
    supportsOnline: true,
    supportsCpu: true,
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
    supportsOnline: true,
    supportsCpu: true,
  },
  checkers: {
    id: 'checkers',
    name: 'Checkers',
    rows: 8,
    columns: 8,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic 8x8 checkers with captures and king promotion.',
    moveMode: 'checkers',
    winCondition: 'elimination',
    supportsOnline: true,
    supportsCpu: true,
  },
  '2048': {
    id: '2048',
    name: '2048',
    rows: 4,
    columns: 4,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Slide and merge tiles to reach 2048. Single-player puzzle run.',
    moveMode: 'solo-2048',
    winCondition: 'target-2048',
    supportsOnline: false,
    supportsCpu: true,
  },
  sudoku: {
    id: 'sudoku',
    name: 'Sudoku',
    rows: 9,
    columns: 9,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Fill the 9x9 grid so each row, column, and 3x3 box contains numbers 1-9.',
    moveMode: 'solo-sudoku',
    winCondition: 'sudoku-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  minesweeper: {
    id: 'minesweeper',
    name: 'Minesweeper',
    rows: 9,
    columns: 9,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Clear all safe cells and flag mines without detonating the board.',
    moveMode: 'solo-minesweeper',
    winCondition: 'minesweeper-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  'memory-match': {
    id: 'memory-match',
    name: 'Memory-Match',
    rows: 4,
    columns: 4,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Flip cards, find pairs, and clear the grid in the fewest moves.',
    moveMode: 'solo-memory',
    winCondition: 'memory-complete',
    supportsOnline: false,
    supportsCpu: true,
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
    const topRow = Math.floor(rules.rows / 2) - 1;
    const bottomRow = Math.floor(rules.rows / 2);
    const leftColumn = Math.floor(rules.columns / 2) - 1;
    const rightColumn = Math.floor(rules.columns / 2);
    const midLeft = getCellIndex(topRow, leftColumn, rules.columns);
    const midRight = getCellIndex(topRow, rightColumn, rules.columns);
    const lowLeft = getCellIndex(bottomRow, leftColumn, rules.columns);
    const lowRight = getCellIndex(bottomRow, rightColumn, rules.columns);
    board[midLeft] = 'X';
    board[midRight] = 'O';
    board[lowLeft] = 'O';
    board[lowRight] = 'X';
  }

  if (rules.id === 'checkers') {
    for (let row = 0; row < rules.rows; row += 1) {
      for (let column = 0; column < rules.columns; column += 1) {
        if ((row + column) % 2 === 0) {
          continue;
        }

        const index = getCellIndex(row, column, rules.columns);
        if (row <= 2) {
          board[index] = 'OC';
        } else if (row >= rules.rows - 3) {
          board[index] = 'XC';
        }
      }
    }
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

function isCheckersPiece(cell) {
  return cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';
}

function getCheckersOwner(cell) {
  if (!isCheckersPiece(cell)) {
    return null;
  }
  return cell.startsWith('X') ? 'X' : 'O';
}

function isCheckersKing(cell) {
  return cell === 'XK' || cell === 'OK';
}

function getCheckersPiece(owner, king) {
  if (owner === 'X') {
    return king ? 'XK' : 'XC';
  }
  return king ? 'OK' : 'OC';
}

function getCheckersCandidateMoves(board, owner, rows, columns) {
  const captures = [];
  const regular = [];

  for (let index = 0; index < board.length; index += 1) {
    const cell = board[index];
    if (!isCheckersPiece(cell) || getCheckersOwner(cell) !== owner) {
      continue;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowSteps = isCheckersKing(cell) ? [-1, 1] : owner === 'X' ? [-1] : [1];

    for (const rowStep of rowSteps) {
      for (const columnStep of [-1, 1]) {
        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= rows ||
          nextColumn < 0 ||
          nextColumn >= columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, columns);
        const nextCell = board[nextIndex];

        if (nextCell === null) {
          regular.push({ from: index, to: nextIndex, captureIndex: null });
          continue;
        }

        const nextOwner = getCheckersOwner(nextCell);
        if (!nextOwner || nextOwner === owner) {
          continue;
        }

        const jumpRow = row + rowStep * 2;
        const jumpColumn = column + columnStep * 2;
        if (
          jumpRow < 0 ||
          jumpRow >= rows ||
          jumpColumn < 0 ||
          jumpColumn >= columns
        ) {
          continue;
        }

        const jumpIndex = getCellIndex(jumpRow, jumpColumn, columns);
        if (board[jumpIndex] === null) {
          captures.push({ from: index, to: jumpIndex, captureIndex: nextIndex });
        }
      }
    }
  }

  return { captures, regular };
}

function parseCheckersMove(move) {
  if (!move || typeof move !== 'object') {
    return null;
  }

  const from = Number(move.from);
  const to = Number(move.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return null;
  }

  return { from, to };
}

function findCheckersMove(board, owner, move, rows, columns) {
  const parsedMove = parseCheckersMove(move);
  if (!parsedMove) {
    return null;
  }

  const candidates = getCheckersCandidateMoves(board, owner, rows, columns);
  const source = candidates.captures.length > 0 ? candidates.captures : candidates.regular;
  return source.find(
    (candidate) => candidate.from === parsedMove.from && candidate.to === parsedMove.to
  ) || null;
}

function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

function checkWinner(gameType, board) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (rules.winCondition === 'elimination') {
    const xPieces = board.filter((cell) => getCheckersOwner(cell) === 'X').length;
    const oPieces = board.filter((cell) => getCheckersOwner(cell) === 'O').length;

    if (xPieces === 0) {
      return 'O';
    }

    if (oPieces === 0) {
      return 'X';
    }

    const xMoves = getCheckersCandidateMoves(board, 'X', rules.rows, rules.columns);
    const oMoves = getCheckersCandidateMoves(board, 'O', rules.rows, rules.columns);
    const xHasMoves = xMoves.captures.length + xMoves.regular.length > 0;
    const oHasMoves = oMoves.captures.length + oMoves.regular.length > 0;

    if (!xHasMoves && !oHasMoves) {
      return 'draw';
    }

    if (!xHasMoves) {
      return 'O';
    }

    if (!oHasMoves) {
      return 'X';
    }

    return null;
  }

  if (
    rules.winCondition === 'target-2048' ||
    rules.winCondition === 'sudoku-complete' ||
    rules.winCondition === 'minesweeper-clear' ||
    rules.winCondition === 'memory-complete'
  ) {
    return null;
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

function getAvailableMoves(gameType, board, symbol = 'X') {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (
    rules.moveMode === 'solo-2048' ||
    rules.moveMode === 'solo-sudoku' ||
    rules.moveMode === 'solo-minesweeper' ||
    rules.moveMode === 'solo-memory'
  ) {
    return [];
  }

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const candidates = getCheckersCandidateMoves(board, owner, rules.rows, rules.columns);
    return candidates.captures.length > 0 ? candidates.captures : candidates.regular;
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

function isValidMove(gameType, board, move, symbol = 'X') {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const parsedMove = parseCheckersMove(move);
    if (!parsedMove) {
      return false;
    }
    return Boolean(findCheckersMove(board, owner, parsedMove, rules.rows, rules.columns));
  }

  return getAvailableMoves(gameType, board).includes(move);
}

function applyMove(gameType, board, move, symbol) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (
    rules.moveMode === 'solo-2048' ||
    rules.moveMode === 'solo-sudoku' ||
    rules.moveMode === 'solo-minesweeper' ||
    rules.moveMode === 'solo-memory'
  ) {
    return [...board];
  }

  const nextBoard = [...board];

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const legalMove = findCheckersMove(board, owner, move, rules.rows, rules.columns);
    if (!legalMove) {
      throw new Error('Invalid move');
    }

    const movingPiece = nextBoard[legalMove.from];
    if (!isCheckersPiece(movingPiece) || getCheckersOwner(movingPiece) !== owner) {
      throw new Error('Invalid move');
    }

    nextBoard[legalMove.from] = null;
    if (legalMove.captureIndex !== null) {
      nextBoard[legalMove.captureIndex] = null;
    }

    const destinationRow = Math.floor(legalMove.to / rules.columns);
    const shouldPromote =
      !isCheckersKing(movingPiece) &&
      ((owner === 'X' && destinationRow === 0) ||
        (owner === 'O' && destinationRow === rules.rows - 1));

    nextBoard[legalMove.to] = shouldPromote
      ? getCheckersPiece(owner, true)
      : movingPiece;

    return nextBoard;
  }

  if (!isValidMove(gameType, board, move)) {
    throw new Error('Invalid move');
  }

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
