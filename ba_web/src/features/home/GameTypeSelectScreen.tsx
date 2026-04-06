'use client';

import { useCallback } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineTeam,
  AiOutlineRobot,
  AiOutlineAppstore,
  AiOutlinePlayCircle,
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
  description: string;
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
      description: `${getGameCountByCategory('online-multiplayer')} games - Play with others online`,
      icon: <AiOutlineTeam />,
    },
    {
      id: 'online',
      label: 'Online Games',
      description: `${getGameCountByCategory('online')} games - All online-enabled games`,
      icon: <AiOutlinePlayCircle />,
    },
    {
      id: 'single-player',
      label: 'Single Player',
      description: `${getGameCountByCategory('single-player')} games - Solo challenges`,
      icon: <AiOutlineRobot />,
    },
    {
      id: 'all',
      label: 'All Games',
      description: `${getGameCountByCategory('all')} games - Browse everything`,
      icon: <AiOutlineAppstore />,
    },
  ];

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
          <strong>Choose how you want to play</strong>
          <span>Select a game type to filter and discover your next match</span>
        </div>

        <div className="game-type-grid">
          {gameTypeOptions.map((option) => (
            <div
              key={option.id}
              className={classnames('game-type-card', selectedCategory === option.id && 'game-type-card-active')}
            >
              <button
                className="game-type-card-select"
                type="button"
                onClick={() => onSelectCategory(option.id)}
              >
                <div className="game-type-icon">{option.icon}</div>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>

              {selectedCategory === option.id ? (
                <button className="game-type-play-btn" type="button" onClick={onContinue}>
                  Continue
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
