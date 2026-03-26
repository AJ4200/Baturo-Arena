import { applyMove, evaluateBoard, getAvailableMoves, getCheckersMoves, getGameDefinition } from '@/lib/games';
import type { CheckersCandidateMove } from '@/lib/games';
import type { BoardCell, CpuDifficulty, GameMove, GameType } from '@/types/game';

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
  const game = getGameDefinition('orbital-flip');
  const nextBoard = applyMove('orbital-flip', board, move, 'O');
  const gainedTiles = nextBoard.filter((cell) => cell === 'O').length - board.filter((cell) => cell === 'O').length;
  const row = Math.floor(move / game.columns);
  const column = move % game.columns;
  const isCorner =
    (row === 0 || row === game.rows - 1) &&
    (column === 0 || column === game.columns - 1);
  const isEdge = row === 0 || row === game.rows - 1 || column === 0 || column === game.columns - 1;
  const cornerBonus = isCorner ? 3 : 0;
  const edgeBonus = !isCorner && isEdge ? 1 : 0;
  return gainedTiles * 4 + cornerBonus + edgeBonus;
};

const scoreCornerClashMove = (board: Board, move: number): number => {
  const game = getGameDefinition('corner-clash');
  const nextBoard = applyMove('corner-clash', board, move, 'O');
  const corners = [
    0,
    game.columns - 1,
    (game.rows - 1) * game.columns,
    game.rows * game.columns - 1,
  ];
  const currentCorners = corners.filter((index) => board[index] === 'O').length;
  const nextCorners = corners.filter((index) => nextBoard[index] === 'O').length;
  const tileSwing =
    nextBoard.filter((cell) => cell === 'O').length -
    board.filter((cell) => cell === 'O').length;
  const row = Math.floor(move / game.columns);
  const column = move % game.columns;
  const nearestCornerDistance = Math.min(
    row + column,
    row + (game.columns - 1 - column),
    game.rows - 1 - row + column,
    game.rows - 1 - row + (game.columns - 1 - column)
  );

  return (nextCorners - currentCorners) * 10 + tileSwing * 3 - nearestCornerDistance;
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

  if (gameType === 'corner-clash') {
    return [...moves].sort((left, right) => scoreCornerClashMove(board, right) - scoreCornerClashMove(board, left))[0] ?? null;
  }

  return [...moves].sort((left, right) => scoreCellMove(gameType, right) - scoreCellMove(gameType, left))[0] ?? null;
};

const scoreCheckersBoard = (board: Board): number => {
  return board.reduce((score, cell) => {
    if (cell === 'OC') {
      return score + 3;
    }
    if (cell === 'OK') {
      return score + 5;
    }
    if (cell === 'XC') {
      return score - 3;
    }
    if (cell === 'XK') {
      return score - 5;
    }
    return score;
  }, 0);
};

const getCheckersMoveScore = (board: Board, move: CheckersCandidateMove): number => {
  const beforeScore = scoreCheckersBoard(board);
  const nextBoard = applyMove('checkers', board, { from: move.from, to: move.to }, 'O');
  const afterScore = scoreCheckersBoard(nextBoard);
  const game = getGameDefinition('checkers');
  const sourcePiece = board[move.from];
  const destinationRow = Math.floor(move.to / game.columns);
  const promotionBonus = sourcePiece === 'OC' && destinationRow === game.rows - 1 ? 3 : 0;
  const captureBonus = move.captureIndex !== null ? 5 : 0;
  const opponentMobilityPenalty = getCheckersMoves('checkers', nextBoard, 'X').length * 0.18;
  return afterScore - beforeScore + promotionBonus + captureBonus - opponentMobilityPenalty;
};

const getCheckersCpuMove = (board: Board, difficulty: CpuDifficulty): GameMove | null => {
  const moves = getCheckersMoves('checkers', board, 'O');
  if (moves.length === 0) {
    return null;
  }

  if (difficulty === 'easy') {
    const randomIndex = Math.floor(Math.random() * moves.length);
    const move = moves[randomIndex];
    return { from: move.from, to: move.to };
  }

  if (difficulty === 'medium') {
    const bestMove = [...moves].sort((left, right) => getCheckersMoveScore(board, right) - getCheckersMoveScore(board, left))[0];
    return bestMove ? { from: bestMove.from, to: bestMove.to } : null;
  }

  let bestMove: CheckersCandidateMove | null = null;
  let bestWorstReplyScore = -Infinity;

  for (const move of moves) {
    const nextBoard = applyMove('checkers', board, { from: move.from, to: move.to }, 'O');
    const immediateResult = evaluateBoard('checkers', nextBoard);
    if (immediateResult === 'O') {
      return { from: move.from, to: move.to };
    }

    const opponentMoves = getCheckersMoves('checkers', nextBoard, 'X');
    if (opponentMoves.length === 0) {
      bestMove = move;
      bestWorstReplyScore = 999;
      continue;
    }

    let worstReplyScore = Infinity;
    for (const reply of opponentMoves) {
      const replyBoard = applyMove('checkers', nextBoard, { from: reply.from, to: reply.to }, 'X');
      const replyResult = evaluateBoard('checkers', replyBoard);
      if (replyResult === 'X') {
        worstReplyScore = -1000;
        break;
      }
      const replyScore = replyResult === 'O' ? 1000 : scoreCheckersBoard(replyBoard);
      worstReplyScore = Math.min(worstReplyScore, replyScore);
    }

    const weightedScore = worstReplyScore + getCheckersMoveScore(board, move) * 0.35;
    if (weightedScore > bestWorstReplyScore) {
      bestWorstReplyScore = weightedScore;
      bestMove = move;
    }
  }

  return bestMove ? { from: bestMove.from, to: bestMove.to } : null;
};

export const getCpuMove = (
  gameType: GameType,
  board: Board,
  difficulty: CpuDifficulty
): GameMove | null => {
  const game = getGameDefinition(gameType);
  if (game.moveMode === 'checkers') {
    return getCheckersCpuMove(board, difficulty);
  }

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory'
  ) {
    return null;
  }

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
    if (game.moveMode === 'flip') {
      return [...getAvailableMoves(gameType, board)].sort((left, right) => scoreOrbitalFlipMove(board, right) - scoreOrbitalFlipMove(board, left))[0] ?? null;
    }

    if (game.moveMode === 'corner-flip') {
      return [...getAvailableMoves(gameType, board)].sort((left, right) => scoreCornerClashMove(board, right) - scoreCornerClashMove(board, left))[0] ?? null;
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
