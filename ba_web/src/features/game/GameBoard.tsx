import { useEffect, useMemo, useState } from 'react';
import X from '@/components/game/tic-tac-two/X';
import O from '@/components/game/tic-tac-two/O';
import { getGameDefinition } from '@/lib/games';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import type { BoardCell, GameDefinition, GameMove, GameType } from '@/types/game';

type GameBoardProps = {
  gameType: GameType;
  board: BoardCell[];
  gameDefinitions: GameDefinition[];
  disabled?: boolean;
  interactiveSymbol?: 'X' | 'O' | null;
  onMove: (move: GameMove) => void;
};

const isCheckersPiece = (cell: BoardCell): cell is 'XC' | 'XK' | 'OC' | 'OK' =>
  cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';

const getCellOwner = (cell: Exclude<BoardCell, null>): 'X' | 'O' => {
  if (cell.startsWith('O')) {
    return 'O';
  }
  return 'X';
};

const isDarkSquare = (index: number, columns: number): boolean => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  return (row + column) % 2 === 1;
};

export function GameBoard({
  gameType,
  board,
  gameDefinitions,
  disabled = false,
  interactiveSymbol = null,
  onMove,
}: GameBoardProps) {
  const game = getGameDefinition(gameType, gameDefinitions);
  const [selectedCheckersCell, setSelectedCheckersCell] = useState<number | null>(null);
  const pieceMotionProps = {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { duration: 0.3 },
  } as const;

  useEffect(() => {
    if (gameType !== 'checkers') {
      setSelectedCheckersCell(null);
    }
  }, [gameType]);

  useEffect(() => {
    if (selectedCheckersCell === null) {
      return;
    }
    if (!isCheckersPiece(board[selectedCheckersCell])) {
      setSelectedCheckersCell(null);
    }
  }, [board, selectedCheckersCell]);

  const renderPiece = (cell: Exclude<BoardCell, null>) => {
    const owner = getCellOwner(cell);
    const ownerClass = owner === 'X' ? 'piece-owner-x' : 'piece-owner-o';

    if (gameType === 'checkers' && isCheckersPiece(cell)) {
      return (
        <motion.div
          className={classnames('marker', 'marker-checkers-piece', ownerClass, cell.endsWith('K') && 'is-king')}
          initial={pieceMotionProps.initial}
          animate={pieceMotionProps.animate}
          transition={pieceMotionProps.transition}
        >
          <span className="game-piece-checkers-disc" />
          {cell.endsWith('K') ? <span className="game-piece-checkers-crown" /> : null}
        </motion.div>
      );
    }

    if (gameType === 'connect-all-four') {
      return (
        <motion.div
          className={classnames('marker', 'marker-connect-piece', ownerClass)}
          initial={pieceMotionProps.initial}
          animate={pieceMotionProps.animate}
          transition={pieceMotionProps.transition}
        >
          <span className="game-piece-connect-disc" />
        </motion.div>
      );
    }

    if (gameType === 'orbital-flip') {
      return (
        <motion.div
          className={classnames('marker', 'marker-orbital-piece', ownerClass)}
          initial={pieceMotionProps.initial}
          animate={pieceMotionProps.animate}
          transition={pieceMotionProps.transition}
        >
          <span className="game-piece-orbital-core" />
          <span className="game-piece-orbital-ring" />
        </motion.div>
      );
    }

    if (gameType === 'corner-clash') {
      return (
        <motion.div
          className={classnames('marker', 'marker-corner-piece', ownerClass)}
          initial={pieceMotionProps.initial}
          animate={pieceMotionProps.animate}
          transition={pieceMotionProps.transition}
        >
          <span className="game-piece-corner-core" />
          <span className="game-piece-corner-gem" />
        </motion.div>
      );
    }

    return owner === 'X' ? <X /> : <O />;
  };

  const renderCell = (cell: BoardCell, cellIndex: number, moveIndex: number) => {
    const content = cell ? renderPiece(cell) : null;
    return (
      <button
        key={cellIndex}
        className={classnames(
          'square',
          gameType === 'connect-all-four' && 'square-connect-four',
          gameType === 'orbital-flip' && 'square-orbital-flip',
          gameType === 'corner-clash' && 'square-corner-clash'
        )}
        type="button"
        disabled={disabled}
        onClick={() => onMove(moveIndex)}
      >
        {content}
      </button>
    );
  };

  const checkersBoard = useMemo(() => {
    if (game.moveMode !== 'checkers') {
      return null;
    }

    return Array.from({ length: game.rows }).map((_, row) => (
      <div key={row} className="board-row board-row-checkers">
        {Array.from({ length: game.columns }).map((__, column) => {
          const cellIndex = row * game.columns + column;
          const cell = board[cellIndex];
          const darkSquare = isDarkSquare(cellIndex, game.columns);
          const owner = cell ? getCellOwner(cell) : null;
          const isSelectablePiece =
            darkSquare &&
            !disabled &&
            isCheckersPiece(cell) &&
            (!interactiveSymbol || owner === interactiveSymbol);
          const isSelected = selectedCheckersCell === cellIndex;

          const handleCheckersClick = () => {
            if (disabled || !darkSquare) {
              return;
            }

            if (isSelectablePiece) {
              setSelectedCheckersCell(cellIndex);
              return;
            }

            if (cell === null && selectedCheckersCell !== null) {
              onMove({ from: selectedCheckersCell, to: cellIndex });
              setSelectedCheckersCell(null);
              return;
            }

            setSelectedCheckersCell(null);
          };

          return (
            <button
              key={cellIndex}
              className={classnames(
                'square',
                'square-checkers',
                darkSquare ? 'square-checkers-dark' : 'square-checkers-light',
                isSelected && 'square-checkers-selected'
              )}
              type="button"
              disabled={disabled || !darkSquare}
              onClick={handleCheckersClick}
            >
              {cell ? renderPiece(cell) : null}
            </button>
          );
        })}
      </div>
    ));
  }, [board, disabled, game.columns, game.moveMode, game.rows, interactiveSymbol, onMove, selectedCheckersCell]);

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino'
  ) {
    return null;
  }

  if (game.moveMode === 'cell' || game.moveMode === 'flip' || game.moveMode === 'corner-flip') {
    return (
      <div
        className={classnames(
          'board',
          'board-grid',
          `board-${game.id}`,
          gameType === 'orbital-flip' && 'board-orbital-flip',
          gameType === 'corner-clash' && 'board-corner-clash'
        )}
      >
        {Array.from({ length: game.rows }).map((_, row) => (
          <div key={row} className="board-row">
            {Array.from({ length: game.columns }).map((__, column) => {
              const cellIndex = row * game.columns + column;
              return renderCell(board[cellIndex], cellIndex, cellIndex);
            })}
          </div>
        ))}
      </div>
    );
  }

  if (game.moveMode === 'checkers') {
    return (
      <div className={classnames('board', 'board-grid', 'board-checkers')}>
        {checkersBoard}
      </div>
    );
  }

  return (
    <div className={classnames('board', 'board-grid', 'board-connect-four')}>
      {Array.from({ length: game.rows }).map((_, row) => (
        <div key={row} className="board-row board-row-connect-four">
          {Array.from({ length: game.columns }).map((__, column) => {
            const cellIndex = row * game.columns + column;
            return renderCell(board[cellIndex], cellIndex, column);
          })}
        </div>
      ))}
    </div>
  );
}
