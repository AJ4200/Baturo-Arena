import X from '@/components/game/X';
import O from '@/components/game/O';
import { getGameDefinition } from '@/lib/games';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import type { BoardCell, GameDefinition, GameType } from '@/types/game';

type GameBoardProps = {
  gameType: GameType;
  board: BoardCell[];
  gameDefinitions: GameDefinition[];
  disabled?: boolean;
  onMove: (move: number) => void;
};

export function GameBoard({ gameType, board, gameDefinitions, disabled = false, onMove }: GameBoardProps) {
  const game = getGameDefinition(gameType, gameDefinitions);
  const pieceMotionProps = {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { duration: 0.3 },
  } as const;

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory'
  ) {
    return null;
  }

  const renderPiece = (cell: Exclude<BoardCell, null>) => {
    const ownerClass = cell === 'X' ? 'piece-owner-x' : 'piece-owner-o';

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

    return cell === 'X' ? <X /> : <O />;
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
