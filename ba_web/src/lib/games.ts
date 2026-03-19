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
  },
];

export const getGameDefinition = (gameType: GameType, games = FALLBACK_GAMES): GameDefinition => {
  return games.find((game) => game.id === gameType) || FALLBACK_GAMES[0];
};

export const createEmptyBoard = (gameType: GameType, games = FALLBACK_GAMES): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  return Array(game.rows * game.columns).fill(null);
};

const getCellIndex = (row: number, column: number, columns: number) => row * columns + column;

export const getAvailableMoves = (gameType: GameType, board: BoardCell[], games = FALLBACK_GAMES): number[] => {
  const game = getGameDefinition(gameType, games);

  if (game.moveMode === 'cell') {
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
