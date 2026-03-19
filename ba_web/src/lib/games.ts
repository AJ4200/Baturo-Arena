import type { BoardCell, GameDefinition, GameType } from '@/types/game';

export const FALLBACK_GAMES: GameDefinition[] = [
  {
    id: 'tic-tac-two',
    name: 'Tic-Tac-Two',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic tic-tac-toe for teams X and O. Up to 4 players can join (2 per side).',
    rows: 3,
    columns: 3,
    connect: 3,
    moveMode: 'cell',
    winCondition: 'connect',
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

  return board;
};

const getCellIndex = (row: number, column: number, columns: number) => row * columns + column;

export const getAvailableMoves = (gameType: GameType, board: BoardCell[], games = FALLBACK_GAMES): number[] => {
  const game = getGameDefinition(gameType, games);

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
  move: number,
  symbol: Exclude<BoardCell, null>,
  games = FALLBACK_GAMES
): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  if (!getAvailableMoves(gameType, board, games).includes(move)) {
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
): 'X' | 'O' | 'draw' | null => {
  const game = getGameDefinition(gameType, games);
  if (game.winCondition === 'majority') {
    const xCount = board.filter((cell) => cell === 'X').length;
    const oCount = board.filter((cell) => cell === 'O').length;

    if (xCount === 0) {
      return 'O';
    }

    if (oCount === 0) {
      return 'X';
    }

    if (board.every((cell) => cell !== null)) {
      if (xCount === oCount) {
        return 'draw';
      }
      return xCount > oCount ? 'X' : 'O';
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
    const xCorners = corners.filter((index) => board[index] === 'X').length;
    const oCorners = corners.filter((index) => board[index] === 'O').length;

    if (xCorners >= 3) {
      return 'X';
    }

    if (oCorners >= 3) {
      return 'O';
    }

    if (board.every((cell) => cell !== null)) {
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

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const startIndex = getCellIndex(row, column, game.columns);
      const symbol = board[startIndex];
      if (!symbol) {
        continue;
      }

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
          return symbol;
        }
      }
    }
  }

  return board.every((cell) => cell !== null) ? 'draw' : null;
};

export const formatGameName = (gameType: GameType, games = FALLBACK_GAMES): string => {
  return getGameDefinition(gameType, games).name;
};
