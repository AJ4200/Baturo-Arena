import type { BoardCell, GameDefinition, GameMove, GameSymbol, GameType } from '@/types/game';

export const FALLBACK_GAMES: GameDefinition[] = [
  {
    id: 'tic-tac-two',
    name: 'Tic-Tac-Two',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic tic-tac-toe with turn order X, O, Y, and Z for up to 4 players.',
    rows: 3,
    columns: 3,
    connect: 3,
    moveMode: 'cell',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'connect-all-four',
    name: 'Connect-All-Four',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Drop pieces into columns and connect four before your rival does.',
    rows: 6,
    columns: 7,
    connect: 4,
    moveMode: 'column',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'orbital-flip',
    name: 'Orbital-Flip',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Expanded 6x6 orbital grid: place a piece each turn and flip neighboring enemy tiles to control space.',
    rows: 6,
    columns: 6,
    connect: 0,
    moveMode: 'flip',
    winCondition: 'majority',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'corner-clash',
    name: 'Corner-Clash',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Capture the corners. Every move also flips orthogonally adjacent enemy tiles.',
    rows: 5,
    columns: 5,
    connect: 0,
    moveMode: 'corner-flip',
    winCondition: 'corners',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'checkers',
    name: 'Checkers',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic 8x8 checkers with captures and king promotion.',
    rows: 8,
    columns: 8,
    connect: 0,
    moveMode: 'checkers',
    winCondition: 'elimination',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'ludo',
    name: 'Ludo',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic 4-token race game. Roll, spawn on six, capture rivals, and get all tokens home first.',
    rows: 15,
    columns: 15,
    connect: 0,
    moveMode: 'ludo',
    winCondition: 'ludo-home',
    supportsOnline: true,
    supportsCpu: false,
  },
  {
    id: '2048',
    name: '2048',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Slide and merge tiles to reach 2048. Single-player puzzle run.',
    rows: 4,
    columns: 4,
    connect: 0,
    moveMode: 'solo-2048',
    winCondition: 'target-2048',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Fill the 9x9 grid so each row, column, and 3x3 box contains numbers 1-9.',
    rows: 9,
    columns: 9,
    connect: 0,
    moveMode: 'solo-sudoku',
    winCondition: 'sudoku-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Clear all safe cells and flag mines without detonating the board.',
    rows: 9,
    columns: 9,
    connect: 0,
    moveMode: 'solo-minesweeper',
    winCondition: 'minesweeper-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'memory-match',
    name: 'Memory-Match',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Flip cards, find pairs, and clear the grid in the fewest moves.',
    rows: 4,
    columns: 4,
    connect: 0,
    moveMode: 'solo-memory',
    winCondition: 'memory-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'dino-run',
    name: 'Dino-Run',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Dash through the neon desert, jump and duck hazards, and survive the distance target.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-dino',
    winCondition: 'dino-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
];

export const getGameDefinition = (gameType: GameType, games = FALLBACK_GAMES): GameDefinition => {
  return games.find((game) => game.id === gameType) || FALLBACK_GAMES[0];
};

export const createEmptyBoard = (gameType: GameType, games = FALLBACK_GAMES): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  const board = Array(game.rows * game.columns).fill(null);

  if (game.id === 'orbital-flip') {
    const topRow = Math.floor(game.rows / 2) - 1;
    const bottomRow = Math.floor(game.rows / 2);
    const leftColumn = Math.floor(game.columns / 2) - 1;
    const rightColumn = Math.floor(game.columns / 2);

    board[getCellIndex(topRow, leftColumn, game.columns)] = 'X';
    board[getCellIndex(topRow, rightColumn, game.columns)] = 'O';
    board[getCellIndex(bottomRow, leftColumn, game.columns)] = 'O';
    board[getCellIndex(bottomRow, rightColumn, game.columns)] = 'X';
  }

  if (game.id === 'checkers') {
    for (let row = 0; row < game.rows; row += 1) {
      for (let column = 0; column < game.columns; column += 1) {
        if ((row + column) % 2 === 0) {
          continue;
        }

        const index = getCellIndex(row, column, game.columns);
        if (row <= 2) {
          board[index] = 'OC';
        } else if (row >= game.rows - 3) {
          board[index] = 'XC';
        }
      }
    }
  }

  return board;
};

const getCellIndex = (row: number, column: number, columns: number) => row * columns + column;
const COMPETITIVE_SYMBOLS: GameSymbol[] = ['X', 'O', 'Y', 'Z'];

const isCheckersPiece = (cell: BoardCell): cell is 'XC' | 'XK' | 'OC' | 'OK' =>
  cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';

const isCompetitiveSymbol = (cell: BoardCell): cell is GameSymbol =>
  cell === 'X' || cell === 'O' || cell === 'Y' || cell === 'Z';

const getCheckersOwner = (cell: BoardCell): 'X' | 'O' | null => {
  if (!isCheckersPiece(cell)) {
    return null;
  }
  return cell.startsWith('X') ? 'X' : 'O';
};

const isCheckersKing = (cell: BoardCell): boolean => cell === 'XK' || cell === 'OK';

const getCheckersPiece = (owner: 'X' | 'O', isKing: boolean): 'XC' | 'XK' | 'OC' | 'OK' => {
  if (owner === 'X') {
    return isKing ? 'XK' : 'XC';
  }
  return isKing ? 'OK' : 'OC';
};

type CheckersMove = { from: number; to: number };

export type CheckersCandidateMove = CheckersMove & { captureIndex: number | null };

const getCheckersCandidateMoves = (
  board: BoardCell[],
  owner: 'X' | 'O',
  rows: number,
  columns: number
): { captures: CheckersCandidateMove[]; regular: CheckersCandidateMove[] } => {
  const captures: CheckersCandidateMove[] = [];
  const regular: CheckersCandidateMove[] = [];

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
};

const findCheckersMove = (
  board: BoardCell[],
  owner: 'X' | 'O',
  move: CheckersMove,
  rows: number,
  columns: number
): CheckersCandidateMove | null => {
  const candidates = getCheckersCandidateMoves(board, owner, rows, columns);
  const source = candidates.captures.length > 0 ? candidates.captures : candidates.regular;
  return source.find((candidate) => candidate.from === move.from && candidate.to === move.to) || null;
};

export const getCheckersMoves = (
  gameType: GameType,
  board: BoardCell[],
  symbol: 'X' | 'O',
  games = FALLBACK_GAMES
): CheckersCandidateMove[] => {
  const game = getGameDefinition(gameType, games);
  if (game.moveMode !== 'checkers') {
    return [];
  }

  const candidates = getCheckersCandidateMoves(board, symbol, game.rows, game.columns);
  return candidates.captures.length > 0 ? candidates.captures : candidates.regular;
};

export const getAvailableMoves = (gameType: GameType, board: BoardCell[], games = FALLBACK_GAMES): number[] => {
  const game = getGameDefinition(gameType, games);

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino' ||
    game.moveMode === 'ludo'
  ) {
    return [];
  }

  if (game.moveMode === 'checkers') {
    return [];
  }

  if (game.moveMode === 'cell' || game.moveMode === 'flip' || game.moveMode === 'corner-flip') {
    return board.reduce<number[]>((moves, cell, index) => {
      if (cell === null) {
        moves.push(index);
      }
      return moves;
    }, []);
  }

  const moves: number[] = [];
  for (let column = 0; column < game.columns; column += 1) {
    if (board[getCellIndex(0, column, game.columns)] === null) {
      moves.push(column);
    }
  }

  return moves;
};

export const applyMove = (
  gameType: GameType,
  board: BoardCell[],
  move: GameMove,
  symbol: Exclude<BoardCell, null>,
  games = FALLBACK_GAMES
): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino' ||
    game.moveMode === 'ludo'
  ) {
    return [...board];
  }

  if (game.moveMode === 'checkers') {
    if (typeof move !== 'object' || move === null) {
      return [...board];
    }
    const owner = symbol.startsWith('O') ? 'O' : 'X';
    const legalMove = findCheckersMove(board, owner, move, game.rows, game.columns);
    if (!legalMove) {
      return [...board];
    }

    const nextBoard = [...board];
    const movingPiece = nextBoard[legalMove.from];
    if (!isCheckersPiece(movingPiece) || getCheckersOwner(movingPiece) !== owner) {
      return [...board];
    }

    nextBoard[legalMove.from] = null;
    if (legalMove.captureIndex !== null) {
      nextBoard[legalMove.captureIndex] = null;
    }

    const destinationRow = Math.floor(legalMove.to / game.columns);
    const shouldPromote =
      !isCheckersKing(movingPiece) &&
      ((owner === 'X' && destinationRow === 0) ||
        (owner === 'O' && destinationRow === game.rows - 1));

    nextBoard[legalMove.to] = shouldPromote
      ? getCheckersPiece(owner, true)
      : movingPiece;

    return nextBoard;
  }

  if (typeof move !== 'number' || !getAvailableMoves(gameType, board, games).includes(move)) {
    return [...board];
  }

  const nextBoard = [...board];

  if (game.moveMode === 'cell') {
    nextBoard[move] = symbol;
    return nextBoard;
  }

  if (game.moveMode === 'flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / game.columns);
    const column = move % game.columns;

    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (rowStep === 0 && columnStep === 0) {
          continue;
        }

        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= game.rows ||
          nextColumn < 0 ||
          nextColumn >= game.columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
        if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
          nextBoard[nextIndex] = symbol;
        }
      }
    }

    return nextBoard;
  }

  if (game.moveMode === 'corner-flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / game.columns);
    const column = move % game.columns;
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
        nextRow >= game.rows ||
        nextColumn < 0 ||
        nextColumn >= game.columns
      ) {
        continue;
      }

      const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
      if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
        nextBoard[nextIndex] = symbol;
      }
    }

    return nextBoard;
  }

  for (let row = game.rows - 1; row >= 0; row -= 1) {
    const index = getCellIndex(row, move, game.columns);
    if (nextBoard[index] === null) {
      nextBoard[index] = symbol;
      return nextBoard;
    }
  }

  return nextBoard;
};

export const evaluateBoard = (
  gameType: GameType,
  board: BoardCell[],
  games = FALLBACK_GAMES
): GameSymbol | 'draw' | null => {
  const game = getGameDefinition(gameType, games);
  if (
    game.winCondition === 'elimination' ||
    game.winCondition === 'ludo-home' ||
    game.winCondition === 'target-2048' ||
    game.winCondition === 'sudoku-complete' ||
    game.winCondition === 'minesweeper-clear' ||
    game.winCondition === 'memory-complete' ||
    game.winCondition === 'dino-survive'
  ) {
    if (game.winCondition !== 'elimination') {
      return null;
    }

    const xPieces = board.filter((cell) => getCheckersOwner(cell) === 'X').length;
    const oPieces = board.filter((cell) => getCheckersOwner(cell) === 'O').length;

    if (xPieces === 0) {
      return 'O';
    }

    if (oPieces === 0) {
      return 'X';
    }

    const xMoves = getCheckersCandidateMoves(board, 'X', game.rows, game.columns);
    const oMoves = getCheckersCandidateMoves(board, 'O', game.rows, game.columns);
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

  if (game.winCondition === 'majority') {
    const counts = new Map<GameSymbol, number>();
    COMPETITIVE_SYMBOLS.forEach((symbol) => counts.set(symbol, 0));
    board.forEach((cell) => {
      if (isCompetitiveSymbol(cell)) {
        counts.set(cell, (counts.get(cell) || 0) + 1);
      }
    });

    if (board.every((cell) => cell !== null)) {
  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
      if (sorted.length === 0 || sorted[0][1] <= 0) {
        return 'draw';
      }
      if (sorted[1] && sorted[0][1] === sorted[1][1]) {
        return 'draw';
      }
      return sorted[0][0];
    }

    return null;
  }

  if (game.winCondition === 'corners') {
    const corners = [
      getCellIndex(0, 0, game.columns),
      getCellIndex(0, game.columns - 1, game.columns),
      getCellIndex(game.rows - 1, 0, game.columns),
      getCellIndex(game.rows - 1, game.columns - 1, game.columns),
    ];
    const cornerCounts = new Map<GameSymbol, number>();
    COMPETITIVE_SYMBOLS.forEach((symbol) => cornerCounts.set(symbol, 0));

    corners.forEach((index) => {
      const cell = board[index];
      if (isCompetitiveSymbol(cell)) {
        cornerCounts.set(cell, (cornerCounts.get(cell) || 0) + 1);
      }
    });

    const symbolsWithThreeCorners = COMPETITIVE_SYMBOLS.filter(
      (symbol) => (cornerCounts.get(symbol) || 0) >= 3
    );
    if (symbolsWithThreeCorners.length === 1) {
      return symbolsWithThreeCorners[0];
    }

    if (board.every((cell) => cell !== null)) {
      const counts = new Map<GameSymbol, number>();
      COMPETITIVE_SYMBOLS.forEach((symbol) => counts.set(symbol, 0));
      board.forEach((cell) => {
        if (isCompetitiveSymbol(cell)) {
          counts.set(cell, (counts.get(cell) || 0) + 1);
        }
      });
  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
      if (sorted.length === 0 || sorted[0][1] <= 0) {
        return 'draw';
      }
      if (sorted[1] && sorted[0][1] === sorted[1][1]) {
        return 'draw';
      }
      return sorted[0][0];
    }

    return null;
  }

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const startIndex = getCellIndex(row, column, game.columns);
      const symbol = board[startIndex];
      if (!symbol || isCheckersPiece(symbol)) {
        continue;
      }
      const owner = symbol;

      for (const [rowStep, columnStep] of directions) {
        let connected = 1;
        while (connected < game.connect) {
          const nextRow = row + rowStep * connected;
          const nextColumn = column + columnStep * connected;
          if (
            nextRow < 0 ||
            nextRow >= game.rows ||
            nextColumn < 0 ||
            nextColumn >= game.columns
          ) {
            break;
          }

          const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
          if (board[nextIndex] !== symbol) {
            break;
          }
          connected += 1;
        }

        if (connected === game.connect) {
          return owner;
        }
      }
    }
  }

  return board.every((cell) => cell !== null) ? 'draw' : null;
};

export const formatGameName = (gameType: GameType, games = FALLBACK_GAMES): string => {
  return getGameDefinition(gameType, games).name;
};
