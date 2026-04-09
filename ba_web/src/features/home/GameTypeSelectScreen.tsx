'use client';

import { useCallback } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineAppstore,
  AiOutlineCheckCircle,
  AiOutlineCompass,
  AiOutlineRobot,
  AiOutlineTeam,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import type { GameTypeCategory, GameDefinition } from '@/types/game';

type GameTypeSelectScreenProps = {
  games: GameDefinition[];
  selectedCategory: GameTypeCategory;
  onSelectCategory: (category: GameTypeCategory) => void;
  onBack: () => void;
  onContinue: () => void;
};

type GameTypeOption = {
  id: GameTypeCategory;
  label: string;
  shortDescription: string;
  detail: string;
  icon: React.ReactNode;
};

export function GameTypeSelectScreen({
  games,
  selectedCategory,
  onSelectCategory,
  onBack,
  onContinue,
}: GameTypeSelectScreenProps) {
  const getGameCountByCategory = useCallback(
    (category: GameTypeCategory): number => {
      return games.filter((game) => {
        if (category === 'online-multiplayer') {
          return game.supportsOnline && game.minPlayers >= 2;
        }
        if (category === 'online') {
          return game.supportsOnline;
        }
        if (category === 'single-player') {
          return !game.supportsOnline || game.maxPlayers === 1;
        }
        return true; // 'all'
      }).length;
    },
    [games]
  );

  const gameTypeOptions: GameTypeOption[] = [
    {
      id: 'online-multiplayer',
      label: 'Online Multiplayer',
      shortDescription: `${getGameCountByCategory('online-multiplayer')} games`,
      detail: 'Fast matchmaking and room-based online competition.',
      icon: <AiOutlineTeam />,
    },
    {
      id: 'all',
      label: 'All Games',
      shortDescription: `${getGameCountByCategory('all')} games`,
      detail: 'Browse the full arena catalog in one view.',
      icon: <AiOutlineAppstore />,
    },
    {
      id: 'single-player',
      label: 'Single Player',
      shortDescription: `${getGameCountByCategory('single-player')} games`,
      detail: 'Practice, puzzle runs, and skill-building sessions.',
      icon: <AiOutlineRobot />,
    },
  ];
  const selectedOption =
    gameTypeOptions.find((option) => option.id === selectedCategory) || gameTypeOptions[0];
  const selectedGames = games.filter((game) => {
    if (selectedCategory === 'online-multiplayer') {
      return game.supportsOnline && game.minPlayers >= 2;
    }
    if (selectedCategory === 'single-player') {
      return !game.supportsOnline || game.maxPlayers === 1;
    }
    return true;
  });

  return (
    <section className="title-screen-content">
      <h1>
        <span>Select</span>
        <span>-</span>
        <span>Game Type</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="game-type-toolbar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
        </div>

        <div className="game-type-banner">
          <strong>Choose Your Arena Focus</strong>
          <span>Pick a mode lane first, then lock in the exact game on the next screen.</span>
        </div>

        <div className="game-type-layout">
          <div className="game-type-grid">
            {gameTypeOptions.map((option) => (
              <div
                key={option.id}
                className={classnames(
                  'game-type-card',
                  'flex',
                  'flex-col',
                  selectedCategory === option.id && 'game-type-card-active'
                )}
              >
                <button
                  className="game-type-card-select"
                  type="button"
                  onClick={() => onSelectCategory(option.id)}
                >
                  <div className="game-type-card-top">
                    <div className="game-type-icon">{option.icon}</div>
                    <span className="game-type-chip">{option.shortDescription}</span>
                  </div>
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>

                {selectedCategory === option.id ? (
                  <button className="game-type-play-btn" type="button" onClick={onContinue}>
                    <AiOutlineCheckCircle /> Continue
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <aside className="game-type-preview">
            <div className="game-type-preview-head">
              <p className="game-type-preview-label">Selected Lane</p>
              <strong>{selectedOption.label}</strong>
              <span>{selectedOption.detail}</span>
            </div>

            <div className="game-type-preview-stats">
              <span className="game-type-preview-pill">
                <AiOutlineCompass /> {selectedGames.length} Available
              </span>
              <span className="game-type-preview-pill">
                <AiOutlineThunderbolt /> Ready to Queue
              </span>
            </div>

            <ul className="game-type-preview-list">
              {selectedGames.slice(0, 5).map((game) => (
                <li key={game.id}>
                  <span>{game.name}</span>
                  <small>
                    {game.minPlayers}-{game.maxPlayers} players
                  </small>
                </li>
              ))}
              {selectedGames.length > 5 ? <li>+ {selectedGames.length - 5} more</li> : null}
            </ul>

            <button className="game-type-preview-cta" type="button" onClick={onContinue}>
              <AiOutlineCheckCircle /> Continue With {selectedOption.label}
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}
