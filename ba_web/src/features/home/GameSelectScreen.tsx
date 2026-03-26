'use client';

import { useCallback, useEffect } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineLeft,
  AiOutlineRight,
  AiOutlineTeam,
} from 'react-icons/ai';
import type { GameDefinition, GameType } from '@/types/game';

type GameSelectScreenProps = {
  games: GameDefinition[];
  selectedGame: GameType;
  onSelectGame: (gameType: GameType) => void;
  onBack: () => void;
  onContinue: () => void;
};

const THUMBNAIL_LABELS: Record<GameType, string> = {
  'tic-tac-two': 'X / O',
  'connect-all-four': '4 IN A ROW',
  'orbital-flip': 'ORBIT',
  'corner-clash': 'CORNERS',
  checkers: 'CHECKERS',
  '2048': 'MERGE',
  'sudoku': '9 x 9',
  'minesweeper': 'MINES',
  'memory-match': 'PAIRS',
};

export function GameSelectScreen({
  games,
  selectedGame,
  onSelectGame,
  onBack,
  onContinue,
}: GameSelectScreenProps) {
  const selectedIndex = games.length === 0 ? -1 : Math.max(0, games.findIndex((game) => game.id === selectedGame));
  const selectedOrder = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const selectedGameName = selectedIndex >= 0 ? games[selectedIndex]?.name ?? 'No game selected' : 'No game selected';
  const totalGames = games.length;

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (games.length === 0) {
        return;
      }

      const nextIndex = (selectedIndex + direction + games.length) % games.length;
      onSelectGame(games[nextIndex].id);
    },
    [games, onSelectGame, selectedIndex]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection, onContinue]);

  return (
    <section className="title-screen-content">
      <h1>
        <span>Choose</span>
        <span>-</span>
        <span>Game</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="choose-game-toolbar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <div className="choose-game-toolbar-right">
            <div className="choose-game-meta" aria-live="polite">
              <span className="choose-game-position">
                {selectedOrder} of {totalGames}
              </span>
              <span className="choose-game-name">{selectedGameName}</span>
            </div>
            <button
              className="choose-game-step-btn choose-game-play-now-btn"
              type="button"
              disabled={games.length === 0}
              onClick={onContinue}
              aria-label="Play selected game"
              title="Play selected game"
            >
              <AiOutlineCheckCircle /> Play
            </button>
            <button
              className="choose-game-step-btn"
              type="button"
              disabled={games.length === 0}
              onClick={() => moveSelection(-1)}
              aria-label="Select previous game"
              title="Previous game"
            >
              <AiOutlineLeft /> Prev
            </button>
            <button
              className="choose-game-step-btn"
              type="button"
              disabled={games.length === 0}
              onClick={() => moveSelection(1)}
              aria-label="Select next game"
              title="Next game"
            >
              Next <AiOutlineRight />
            </button>
          </div>
        </div>
        <p className="choose-game-hint">
          <AiOutlineArrowRight /> Tip: use arrow keys to browse and Enter to play.
        </p>

        <div className="choose-game-grid">
          {games.map((game) => {
            const isSelected = selectedGame === game.id;

            return (
              <div
                key={game.id}
                className={classnames('choose-game-card', isSelected && 'choose-game-card-active')}
              >
                <button
                  className="choose-game-card-select"
                  type="button"
                  onClick={() => onSelectGame(game.id)}
                >
                  <div className={classnames('choose-game-thumb', `choose-game-thumb-${game.id}`)}>
                    <span>{THUMBNAIL_LABELS[game.id]}</span>
                  </div>
                  <strong>{game.name}</strong>
                  <span>{game.description}</span>
                  <small>
                    <AiOutlineTeam /> {game.minPlayers}-{game.maxPlayers} players
                  </small>
                </button>

                {isSelected ? (
                  <button className="choose-game-play-btn" type="button" onClick={onContinue}>
                    <AiOutlineCheckCircle /> Play Game
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
