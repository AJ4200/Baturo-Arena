import { applyMove, evaluateBoard, getAvailableMoves, getGameDefinition } from '@/lib/games';
import type { BoardCell, CpuDifficulty, GameType } from '@/types/game';

type Symbol = 'X' | 'O';

type Board = BoardCell[];

const randomMove = (gameType: GameType, board: Board): number | null => {
  const moves = getAvailableMoves(gameType, board);
  if (moves.length === 0) {
    return null;
  }
  return moves[Math.floor(Math.random() * moves.length)];
};

const findImmediateMove = (gameType: GameType, board: Board, symbol: Symbol): number | null => {
  const moves = getAvailableMoves(gameType, board);
  for (const move of moves) {
    const nextBoard = applyMove(gameType, board, move, symbol);
    if (evaluateBoard(gameType, nextBoard) === symbol) {
      return move;
    }
  }
  return null;
};

const scoreConnectAllFourMove = (move: number): number => {
  const centerPreference = [3, 4, 2, 5, 1, 6, 0];
  return centerPreference.findIndex((entry) => entry === move) * -1;
};

const scoreCellMove = (gameType: GameType, move: number): number => {
  const game = getGameDefinition(gameType);
  const row = Math.floor(move / game.columns);
  const column = move % game.columns;
  const centerRow = (game.rows - 1) / 2;
  const centerColumn = (game.columns - 1) / 2;
  return -(Math.abs(row - centerRow) + Math.abs(column - centerColumn));
};

const scoreOrbitalFlipMove = (board: Board, move: number): number => {
  const nextBoard = applyMove('orbital-flip', board, move, 'O');
  const gainedTiles = nextBoard.filter((cell) => cell === 'O').length - board.filter((cell) => cell === 'O').length;
  const cornerBonus = [0, 3, 12, 15].includes(move) ? 3 : 0;
  const edgeBonus = [1, 2, 4, 7, 8, 11, 13, 14].includes(move) ? 1 : 0;
  return gainedTiles * 4 + cornerBonus + edgeBonus;
};

const minimaxTicTacTwo = (board: Board, isCpuTurn: boolean): number => {
  const winner = evaluateBoard('tic-tac-two', board);
  if (winner === 'O') {
    return 10;
  }
  if (winner === 'X') {
    return -10;
  }
  if (winner === 'draw') {
    return 0;
  }

  const moves = getAvailableMoves('tic-tac-two', board);

  if (isCpuTurn) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = minimaxTicTacTwo(applyMove('tic-tac-two', board, move, 'O'), false);
      bestScore = Math.max(bestScore, score);
    }
    return bestScore;
  }

  let bestScore = Infinity;
  for (const move of moves) {
    const score = minimaxTicTacTwo(applyMove('tic-tac-two', board, move, 'X'), true);
    bestScore = Math.min(bestScore, score);
  }
  return bestScore;
};

const hardMove = (gameType: GameType, board: Board): number | null => {
  const moves = getAvailableMoves(gameType, board);
  if (moves.length === 0) {
    return null;
  }

  if (gameType === 'tic-tac-two') {
    let bestScore = -Infinity;
    let bestMove = moves[0];

    for (const move of moves) {
      const score = minimaxTicTacTwo(applyMove(gameType, board, move, 'O'), false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  const game = getGameDefinition(gameType);

  if (game.moveMode === 'column') {
    return [...moves].sort((left, right) => scoreConnectAllFourMove(right) - scoreConnectAllFourMove(left))[0] ?? null;
  }

  if (gameType === 'orbital-flip') {
    return [...moves].sort((left, right) => scoreOrbitalFlipMove(board, right) - scoreOrbitalFlipMove(board, left))[0] ?? null;
  }

  return [...moves].sort((left, right) => scoreCellMove(gameType, right) - scoreCellMove(gameType, left))[0] ?? null;
};

export const getCpuMove = (
  gameType: GameType,
  board: Board,
  difficulty: CpuDifficulty
): number | null => {
  if (difficulty === 'easy') {
    return randomMove(gameType, board);
  }

  const winningMove = findImmediateMove(gameType, board, 'O');
  if (winningMove !== null) {
    return winningMove;
  }

  const blockMove = findImmediateMove(gameType, board, 'X');
  if (blockMove !== null) {
    return blockMove;
  }

  if (difficulty === 'medium') {
    const game = getGameDefinition(gameType);
    if (game.moveMode === 'flip') {
      return [...getAvailableMoves(gameType, board)].sort((left, right) => scoreOrbitalFlipMove(board, right) - scoreOrbitalFlipMove(board, left))[0] ?? null;
    }

    if (game.moveMode === 'cell') {
      const centerIndex = Math.floor(board.length / 2);
      if (board[centerIndex] === null) {
        return centerIndex;
      }
    } else if (board[3] === null) {
      return 3;
    }
    return randomMove(gameType, board);
  }

  return hardMove(gameType, board);
};

export { evaluateBoard };
