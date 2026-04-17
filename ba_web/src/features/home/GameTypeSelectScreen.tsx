'use client';

import { useCallback } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineAppstore,
  AiOutlineCheckCircle,
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
  const getGamesForCategory = useCallback(
    (category: GameTypeCategory) =>
      games.filter((game) => {
        if (category === 'online-multiplayer') {
          return game.supportsOnline && game.minPlayers >= 2;
        }
        if (category === 'single-player') {
          return !game.supportsOnline || game.maxPlayers === 1;
        }
        return true;
      }),
    [games]
  );
  const getCategoryActionLabel = useCallback((category: GameTypeCategory) => {
    if (category === 'single-player') {
      return 'Start Solo Run';
    }
    if (category === 'online-multiplayer') {
      return 'Start Multiplayer Queue';
    }
    return 'Continue';
  }, []);

  const getCategoryActionHint = useCallback((category: GameTypeCategory) => {
    if (category === 'single-player') {
      return 'Jump into solo challenges and practice sessions.';
    }
    if (category === 'online-multiplayer') {
      return 'Create or join a room from the next screen.';
    }
    return 'Browse and pick any available game.';
  }, []);

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
          <span>Pick the lane you want, then continue with that mode.</span>
        </div>

        <div className="game-type-grid">
          {gameTypeOptions.map((option) => {
            const optionGames = getGamesForCategory(option.id);
            const isSelected = selectedCategory === option.id;
            return (
              <div
                key={option.id}
                className={classnames(
                  'game-type-card',
                  'flex',
                  'flex-col',
                  isSelected && 'game-type-card-active'
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

                {isSelected ? (
                  <div className="game-type-card-preview">
                    <div className="game-type-card-preview-head">
                      <span className="game-type-preview-pill">
                        <AiOutlineThunderbolt /> {optionGames.length} Available
                      </span>
                      <p>{getCategoryActionHint(option.id)}</p>
                    </div>
                    <ul className="game-type-preview-list">
                      {optionGames.slice(0, 3).map((game) => (
                        <li key={game.id}>
                          <span>{game.name}</span>
                          <small>
                            {game.minPlayers}-{game.maxPlayers} players
                          </small>
                        </li>
                      ))}
                      {optionGames.length > 3 ? <li>+ {optionGames.length - 3} more</li> : null}
                    </ul>
                    <button className="game-type-play-btn" type="button" onClick={onContinue}>
                      <AiOutlineCheckCircle /> {getCategoryActionLabel(option.id)}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
