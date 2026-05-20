'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineDown,
  AiOutlineGlobal,
  AiOutlineLeft,
  AiOutlineRight,
  AiOutlineRobot,
  AiOutlineSearch,
  AiOutlineTeam,
  AiOutlineUp,
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
  ludo: 'LUDO',
  '2048': 'MERGE',
  sudoku: '9 x 9',
  minesweeper: 'MINES',
  'memory-match': 'PAIRS',
  'dino-run': 'DODGE',
  snake: 'SNAKE',
  'space-invaders': 'INVADERS',
  brickbreaker: 'BRICKS',
  'air-hockey': 'PUCK',
  'neon-pong': 'PONG',
};

export function GameSelectScreen({
  games,
  selectedGame,
  onSelectGame,
  onBack,
  onContinue,
}: GameSelectScreenProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredGames = useMemo(
    () =>
      games.filter((game) => {
        if (!normalizedSearchQuery) {
          return true;
        }

        return (
          game.name.toLowerCase().includes(normalizedSearchQuery) ||
          game.description.toLowerCase().includes(normalizedSearchQuery) ||
          game.id.toLowerCase().includes(normalizedSearchQuery)
        );
      }),
    [games, normalizedSearchQuery]
  );
  const selectedIndex =
    filteredGames.length === 0 ? -1 : Math.max(0, filteredGames.findIndex((game) => game.id === selectedGame));
  const selectedOrder = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const selectedDefinition = selectedIndex >= 0 ? filteredGames[selectedIndex] : null;
  const selectedGameName = selectedDefinition?.name || 'No game selected';
  const totalGames = filteredGames.length;

  useEffect(() => {
    if (filteredGames.length === 0) {
      setIsDropdownOpen(false);
      return;
    }

    if (!filteredGames.some((game) => game.id === selectedGame)) {
      onSelectGame(filteredGames[0].id);
    }
  }, [filteredGames, onSelectGame, selectedGame]);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (!filteredGames.length) return;
      const nextIndex = (selectedIndex + direction + filteredGames.length) % filteredGames.length;
      onSelectGame(filteredGames[nextIndex].id);
    },
    [filteredGames, selectedIndex, onSelectGame]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (isTypingField && event.key !== 'Enter') {
        return;
      }

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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const carouselTrackStyle = useMemo<CSSProperties>(() => {
    if (selectedIndex < 0) return {};
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
          <label className="choose-game-search" aria-label="Search games">
            <AiOutlineSearch />
            <input
              className="choose-game-search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search games"
            />
          </label>
          <div className="choose-game-toolbar-right">
            <div className="choose-game-meta" aria-live="polite">
              <span className="choose-game-position">
                {filteredGames.length === 0 ? '0 results' : `${selectedOrder} of ${totalGames}`}
              </span>
              <div className="choose-game-selector" ref={dropdownRef}>
                <button
                  className="choose-game-name choose-game-name-button"
                  type="button"
                  onClick={() => setIsDropdownOpen((currentValue) => !currentValue)}
                  disabled={filteredGames.length === 0}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span>{selectedGameName}</span>
                  {isDropdownOpen ? <AiOutlineUp /> : <AiOutlineDown />}
                </button>
                {isDropdownOpen && (
                  <div className="choose-game-dropdown ba-scroll-surface">
                    {filteredGames.map((game) => (
                      <button
                        key={game.id}
                        className={classnames(
                          'choose-game-dropdown-item',
                          game.id === selectedGame && 'active'
                        )}
                        onClick={() => {
                          onSelectGame(game.id);
                          setTimeout(() => setIsDropdownOpen(false), 100);
                        }}
                      >
                        {game.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
            <button
              className="choose-game-step-btn choose-game-play-now-btn"
              type="button"
              disabled={filteredGames.length === 0}
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
            disabled={filteredGames.length === 0}
            onClick={() => moveSelection(-1)}
            aria-label="Select previous game"
            title="Previous game"
          >
            <AiOutlineLeft />
          </button>

          <div className="choose-game-carousel-mask">
            {filteredGames.length === 0 ? (
              <div className="choose-game-empty-state">
                <strong>No games found</strong>
                <span>Try a different search term.</span>
              </div>
            ) : (
              <div className="choose-game-carousel-track" style={carouselTrackStyle}>
                {filteredGames.map((game) => {
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
            )}
          </div>

          <button
            className="choose-game-carousel-nav choose-game-carousel-nav-right"
            type="button"
            disabled={filteredGames.length === 0}
            onClick={() => moveSelection(1)}
            aria-label="Select next game"
            title="Next game"
          >
            <AiOutlineRight />
          </button>
        </div>

        <div className="choose-game-dot-row" aria-hidden={filteredGames.length <= 1}>
          {filteredGames.map((game) => (
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
                {selectedOrder} / {totalGames}
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
