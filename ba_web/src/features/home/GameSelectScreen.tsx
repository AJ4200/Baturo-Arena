'use client';

import { useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineGlobal,
  AiOutlineLeft,
  AiOutlineRight,
  AiOutlineRobot,
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
  sudoku: '9 x 9',
  minesweeper: 'MINES',
  'memory-match': 'PAIRS',
  'dino-run': 'DODGE',
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
  const selectedDefinition = selectedIndex >= 0 ? games[selectedIndex] : null;
  const selectedGameName = selectedDefinition?.name || 'No game selected';
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

  const carouselTrackStyle = useMemo<CSSProperties>(() => {
    if (selectedIndex < 0) {
      return {};
    }

    return {
      transform: `translateX(calc(50% - (var(--choose-carousel-card-size) / 2) - ${selectedIndex} * (var(--choose-carousel-card-size) + var(--choose-carousel-gap))))`,
    };
  }, [selectedIndex]);

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
          </div>
        </div>
        <p className="choose-game-hint">
          <AiOutlineArrowRight /> Tip: use arrow keys to browse, then Enter to launch.
        </p>

        <div className="choose-game-carousel-shell">
          <button
            className="choose-game-carousel-nav choose-game-carousel-nav-left"
            type="button"
            disabled={games.length === 0}
            onClick={() => moveSelection(-1)}
            aria-label="Select previous game"
            title="Previous game"
          >
            <AiOutlineLeft />
          </button>

          <div className="choose-game-carousel-mask">
            <div className="choose-game-carousel-track" style={carouselTrackStyle}>
              {games.map((game) => {
                const isSelected = selectedGame === game.id;

                return (
                  <article
                    key={game.id}
                    className={classnames('choose-game-carousel-card', isSelected && 'choose-game-carousel-card-active')}
                    data-selected={isSelected ? 'true' : 'false'}
                  >
                    <button
                      className="choose-game-carousel-card-select"
                      type="button"
                      onClick={() => onSelectGame(game.id)}
                      aria-label={`Select ${game.name}`}
                    >
                      <div className={classnames('choose-game-thumb', `choose-game-thumb-${game.id}`)}>
                        <span>{THUMBNAIL_LABELS[game.id]}</span>
                      </div>
                      <strong>{game.name}</strong>
                      <span>{game.description}</span>
                      <small>
                        <AiOutlineTeam /> {game.minPlayers}-{game.maxPlayers} players
                      </small>
                      <div className="choose-game-card-chip-row">
                        <span>{game.supportsOnline ? 'Online' : 'Solo'}</span>
                        <span>{game.supportsCpu ? 'CPU' : 'No CPU'}</span>
                      </div>
                    </button>

                    {isSelected ? (
                      <button className="choose-game-play-btn choose-game-play-btn-active" type="button" onClick={onContinue}>
                        <AiOutlineCheckCircle /> Play Game
                      </button>
                    ) : (
                      <button className="choose-game-carousel-peek-btn" type="button" onClick={() => onSelectGame(game.id)}>
                        Select
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          <button
            className="choose-game-carousel-nav choose-game-carousel-nav-right"
            type="button"
            disabled={games.length === 0}
            onClick={() => moveSelection(1)}
            aria-label="Select next game"
            title="Next game"
          >
            <AiOutlineRight />
          </button>
        </div>

        <div className="choose-game-dot-row" aria-hidden={games.length <= 1}>
          {games.map((game) => (
            <button
              key={game.id}
              className={classnames('choose-game-dot', selectedGame === game.id && 'choose-game-dot-active')}
              type="button"
              onClick={() => onSelectGame(game.id)}
              aria-label={`Switch to ${game.name}`}
              title={game.name}
            />
          ))}
        </div>

        {selectedDefinition ? (
          <section className="choose-game-spotlight">
            <div className="choose-game-spotlight-head">
              <strong>{selectedDefinition.name}</strong>
              <span>
                Card {selectedOrder} / {totalGames}
              </span>
            </div>
            <p>{selectedDefinition.description}</p>
            <div className="choose-game-spotlight-pills">
              <span>
                <AiOutlineTeam /> {selectedDefinition.minPlayers}-{selectedDefinition.maxPlayers} players
              </span>
              <span>{selectedDefinition.supportsOnline ? <AiOutlineGlobal /> : <AiOutlineRobot />} {selectedDefinition.supportsOnline ? 'Online Ready' : 'Solo Focus'}</span>
              <span>{selectedDefinition.supportsCpu ? 'CPU Enabled' : 'CPU Off'}</span>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
