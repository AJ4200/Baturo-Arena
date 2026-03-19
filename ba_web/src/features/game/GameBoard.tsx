import X from '@/components/game/X';
import O from '@/components/game/O';
import { getGameDefinition } from '@/lib/games';
import classnames from 'classnames';
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

  const renderCell = (cell: BoardCell, cellIndex: number, moveIndex: number) => {
    const content = cell === 'X' ? <X /> : cell === 'O' ? <O /> : null;
    return (
      <button
        key={cellIndex}
        className={classnames('square', gameType === 'connect-all-four' && 'square-connect-four')}
        type="button"
        disabled={disabled}
        onClick={() => onMove(moveIndex)}
      >
        {content}
      </button>
    );
  };

  if (game.moveMode === 'cell') {
    return (
      <div className={classnames('board', 'board-grid', `board-${game.id}`)}>
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
