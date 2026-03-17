import type { CpuDifficulty } from "@/types/game";

type Symbol = "X" | "O";
type Board = Array<Symbol | null>;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

const getWinner = (board: Board): Symbol | "draw" | null => {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every((cell) => cell !== null)) {
    return "draw";
  }

  return null;
};

const availableMoves = (board: Board): number[] => {
  const moves: number[] = [];
  board.forEach((cell, index) => {
    if (cell === null) {
      moves.push(index);
    }
  });
  return moves;
};

const randomMove = (board: Board): number | null => {
  const moves = availableMoves(board);
  if (moves.length === 0) {
    return null;
  }
  return moves[Math.floor(Math.random() * moves.length)];
};

const findImmediateMove = (board: Board, symbol: Symbol): number | null => {
  const moves = availableMoves(board);
  for (const move of moves) {
    const nextBoard = [...board];
    nextBoard[move] = symbol;
    if (getWinner(nextBoard) === symbol) {
      return move;
    }
  }
  return null;
};

const minimax = (board: Board, isCpuTurn: boolean): number => {
  const winner = getWinner(board);
  if (winner === "O") {
    return 10;
  }
  if (winner === "X") {
    return -10;
  }
  if (winner === "draw") {
    return 0;
  }

  const moves = availableMoves(board);

  if (isCpuTurn) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const nextBoard = [...board];
      nextBoard[move] = "O";
      bestScore = Math.max(bestScore, minimax(nextBoard, false));
    }
    return bestScore;
  }

  let bestScore = Infinity;
  for (const move of moves) {
    const nextBoard = [...board];
    nextBoard[move] = "X";
    bestScore = Math.min(bestScore, minimax(nextBoard, true));
  }
  return bestScore;
};

const hardMove = (board: Board): number | null => {
  const moves = availableMoves(board);
  if (moves.length === 0) {
    return null;
  }

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const nextBoard = [...board];
    nextBoard[move] = "O";
    const score = minimax(nextBoard, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};

export const getCpuMove = (board: Board, difficulty: CpuDifficulty): number | null => {
  if (difficulty === "easy") {
    return randomMove(board);
  }

  const winningMove = findImmediateMove(board, "O");
  if (winningMove !== null) {
    return winningMove;
  }

  const blockMove = findImmediateMove(board, "X");
  if (blockMove !== null) {
    return blockMove;
  }

  if (difficulty === "medium") {
    if (board[4] === null) {
      return 4;
    }
    return randomMove(board);
  }

  return hardMove(board);
};

export const evaluateBoard = getWinner;
