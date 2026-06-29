import { useEffect, useMemo, useState } from 'react';
import X from '@/components/game/tic-tac-two/X';
import O from '@/components/game/tic-tac-two/O';
import Y from '@/components/game/tic-tac-two/Y';
import Z from '@/components/game/tic-tac-two/Z';
import { getGameDefinition } from '@/lib/games';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import type { BoardCell, ChessPiece, GameDefinition, GameMove, GameSymbol, GameType } from '@/types/game';

type GameBoardProps = {
  gameType: GameType;
  board: BoardCell[];
  gameDefinitions: GameDefinition[];
  disabled?: boolean;
  interactiveSymbol?: GameSymbol | null;
  onMove: (move: GameMove) => void;
};

const isCheckersPiece = (cell: BoardCell): cell is 'XC' | 'XK' | 'OC' | 'OK' =>
  cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';

const isChessPiece = (cell: BoardCell): cell is ChessPiece =>
  typeof cell === 'string' &&
  (cell.startsWith('XC') || cell.startsWith('OC')) &&
  !isCheckersPiece(cell);

const getChessPieceLabel = (piece: ChessPiece): string => {
  const labels: Record<string, string> = {
    P: '\u265F',
    N: '\u265E',
    B: '\u265D',
    R: '\u265C',
    Q: '\u265B',
    K: '\u265A',
  };
  return labels[piece[2]] || '';
};

const getCellOwner = (cell: Exclude<BoardCell, null>): GameSymbol => {
  if (cell === 'Y' || cell === 'Z') {
    return cell;
  }
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
  const [selectedChessCell, setSelectedChessCell] = useState<number | null>(null);
  const pieceMotionProps = {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { duration: 0.3 },
  } as const;

  useEffect(() => {
    if (gameType !== 'checkers') {
      setSelectedCheckersCell(null);
    }
    if (gameType !== 'chess') {
      setSelectedChessCell(null);
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

  useEffect(() => {
    if (selectedChessCell === null) {
      return;
    }
    if (!isChessPiece(board[selectedChessCell])) {
      setSelectedChessCell(null);
    }
  }, [board, selectedChessCell]);

  const renderPiece = (cell: Exclude<BoardCell, null>) => {
    const owner = getCellOwner(cell);
    const ownerClass =
      owner === 'X'
        ? 'piece-owner-x'
        : owner === 'O'
          ? 'piece-owner-o'
          : owner === 'Y'
            ? 'piece-owner-y'
            : 'piece-owner-z';

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

    if (gameType === 'chess' && isChessPiece(cell)) {
      return (
        <motion.div
          className={classnames('marker', 'marker-chess-piece', ownerClass)}
          initial={pieceMotionProps.initial}
          animate={pieceMotionProps.animate}
          transition={pieceMotionProps.transition}
          aria-label={`${owner === 'X' ? 'White' : 'Black'} chess piece`}
        >
          {getChessPieceLabel(cell)}
        </motion.div>
      );
    }

    if (gameType === 'connect-all-four') {
      if (owner === 'Y' || owner === 'Z') {
        return owner === 'Y' ? <Y /> : <Z />;
      }
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
      if (owner === 'Y' || owner === 'Z') {
        return owner === 'Y' ? <Y /> : <Z />;
      }
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
      if (owner === 'Y' || owner === 'Z') {
        return owner === 'Y' ? <Y /> : <Z />;
      }
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

    if (owner === 'X') {
      return <X />;
    }
    if (owner === 'O') {
      return <O />;
    }
    return owner === 'Y' ? <Y /> : <Z />;
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

  const chessBoard = useMemo(() => {
    if (game.moveMode !== 'chess') {
      return null;
    }

    return Array.from({ length: game.rows }).map((_, row) => (
      <div key={row} className="board-row board-row-chess">
        {Array.from({ length: game.columns }).map((__, column) => {
          const cellIndex = row * game.columns + column;
          const cell = board[cellIndex];
          const owner = cell ? getCellOwner(cell) : null;
          const isSelectablePiece =
            !disabled &&
            isChessPiece(cell) &&
            (!interactiveSymbol || owner === interactiveSymbol);
          const isSelected = selectedChessCell === cellIndex;

          const handleChessClick = () => {
            if (disabled) {
              return;
            }
            if (isSelectablePiece) {
              setSelectedChessCell(cellIndex);
              return;
            }
            if (selectedChessCell !== null) {
              onMove({ from: selectedChessCell, to: cellIndex });
              setSelectedChessCell(null);
            }
          };

          return (
            <button
              key={cellIndex}
              className={classnames(
                'square',
                'square-chess',
                isDarkSquare(cellIndex, game.columns) ? 'square-chess-dark' : 'square-chess-light',
                isSelected && 'square-chess-selected'
              )}
              type="button"
              disabled={disabled}
              onClick={handleChessClick}
            >
              {cell ? renderPiece(cell) : null}
            </button>
          );
        })}
      </div>
    ));
  }, [board, disabled, game.columns, game.moveMode, game.rows, interactiveSymbol, onMove, selectedChessCell]);

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino' ||
    game.moveMode === 'solo-snake' ||
    game.moveMode === 'solo-maze-flux' ||
    game.moveMode === 'solo-space-invaders' ||
    game.moveMode === 'solo-brickbreaker' ||
    game.moveMode === 'solo-neon-pong' ||
    game.moveMode === 'solo-tetris' ||
    game.moveMode === 'solo-starfall' ||
    game.moveMode === 'solo-rift-runner' ||
    game.moveMode === 'solo-dread-sector' ||
    game.moveMode === 'solo-echo-bloom' ||
    game.moveMode === 'solo-pulse-forge' ||
    game.moveMode === 'solo-prism-relay' ||
    game.moveMode === 'solo-sling-shot' ||
    game.moveMode === 'solo-flappy-wing' ||
    game.moveMode === 'solo-blackjack' ||
    game.moveMode === 'air-hockey' ||
    game.moveMode === 'racing' ||
    game.moveMode === 'cipher-auction' ||
    game.moveMode === 'ludo'
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

  if (game.moveMode === 'chess') {
    return (
      <div className={classnames('board', 'board-grid', 'board-chess')}>
        {chessBoard}
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
