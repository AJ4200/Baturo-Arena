'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import classnames from 'classnames';
import {
  AiOutlineAppstore,
  AiOutlineArrowLeft,
  AiOutlineCheckCircle,
  AiOutlineCrown,
  AiOutlineGlobal,
  AiOutlineRobot,
  AiOutlineTeam,
  AiOutlineThunderbolt,
  AiOutlineTrophy,
} from 'react-icons/ai';
import type { GameDefinition, GameTypeCategory } from '@/types/game';

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
  kicker: string;
  detail: string;
  icon: ReactNode;
  tone: 'team' | 'signal' | 'solo' | 'catalog';
};

export function GameTypeSelectScreen({
  games,
  selectedCategory,
  onSelectCategory,
  onBack,
  onContinue,
}: GameTypeSelectScreenProps) {
  const getGamesForCategory = useCallback(
    (category: GameTypeCategory) =>
      games.filter((game) => {
        if (category === 'online-multiplayer') {
          return game.supportsOnline && game.minPlayers >= 2;
        }
        if (category === 'online') {
          return game.supportsOnline;
        }
        if (category === 'single-player') {
          return game.supportsCpu;
        }
        return true;
      }),
    [games]
  );

  const gameTypeOptions: GameTypeOption[] = useMemo(
    () => [
      {
        id: 'online-multiplayer',
        label: 'Multiplayer',
        kicker: 'Room heat',
        detail: 'Live rooms, rivals, table talk, and games built for shared pressure.',
        icon: <AiOutlineTeam />,
        tone: 'team',
      },
      {
        id: 'online',
        label: 'Online Ready',
        kicker: 'Connected',
        detail: 'Everything that can touch the network, from duels to live arena runs.',
        icon: <AiOutlineGlobal />,
        tone: 'signal',
      },
      {
        id: 'single-player',
        label: 'CPU & Solo',
        kicker: 'Practice lab',
        detail: 'Solo challenges, CPU matches, and warm-up lanes for sharpening.',
        icon: <AiOutlineRobot />,
        tone: 'solo',
      },
      {
        id: 'all',
        label: 'Full Catalog',
        kicker: 'Everything',
        detail: 'Open the whole shelf and choose by mood, mode, or pure curiosity.',
        icon: <AiOutlineAppstore />,
        tone: 'catalog',
      },
    ],
    []
  );

  const selectedOption =
    gameTypeOptions.find((option) => option.id === selectedCategory) || gameTypeOptions[0];
  const selectedGames = getGamesForCategory(selectedOption.id);
  const selectedGameSamples = selectedGames.slice(0, 5);
  const totalGames = games.length;
  const onlineGames = games.filter((game) => game.supportsOnline).length;
  const cpuGames = games.filter((game) => game.supportsCpu).length;
  const multiplayerGames = games.filter((game) => game.supportsOnline && game.minPlayers >= 2).length;

  const getCategoryActionLabel = useCallback((category: GameTypeCategory) => {
    if (category === 'single-player') {
      return 'Enter Practice Lab';
    }
    if (category === 'online-multiplayer') {
      return 'Find a Room';
    }
    if (category === 'online') {
      return 'Browse Online Games';
    }
    return 'Open Catalog';
  }, []);

  const getGameModeLabel = (game: GameDefinition) => {
    if (game.supportsOnline && game.maxPlayers > 1) {
      return 'Online';
    }
    if (game.supportsCpu) {
      return 'CPU';
    }
    return 'Local';
  };

  return (
    <section className="title-screen-content game-type-screen">
      <h1>
        <span>Select</span>
        <span>-</span>
        <span>Game Type</span>
      </h1>

      <div className="lobby-card game-type-shell mt-8">
        <div className="game-type-toolbar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <span className="game-type-toolbar-chip">
            <AiOutlineThunderbolt /> {totalGames} games loaded
          </span>
        </div>

        <div className="game-type-hero">
          <div className="game-type-hero-copy">
            <span className="game-type-eyebrow">
              <AiOutlineCrown /> Arena Routing
            </span>
            <strong>{selectedOption.label}</strong>
            <p>{selectedOption.detail}</p>
          </div>

          <div className="game-type-hero-stats" aria-label="Catalog capability summary">
            <span>
              <AiOutlineAppstore /> {totalGames} Total
            </span>
            <span>
              <AiOutlineGlobal /> {onlineGames} Online
            </span>
            <span>
              <AiOutlineRobot /> {cpuGames} CPU
            </span>
            <span>
              <AiOutlineTeam /> {multiplayerGames} Rooms
            </span>
          </div>
        </div>

        <div className="game-type-grid" role="list" aria-label="Game type categories">
          {gameTypeOptions.map((option, optionIndex) => {
            const optionGames = getGamesForCategory(option.id);
            const isSelected = selectedCategory === option.id;
            const topSamples = optionGames.slice(0, 3);
            const optionFill = totalGames > 0 ? Math.max(14, Math.round((optionGames.length / totalGames) * 100)) : 14;

            return (
              <article
                key={option.id}
                className={classnames(
                  'game-type-card',
                  `game-type-card-${option.tone}`,
                  isSelected && 'game-type-card-active'
                )}
                role="listitem"
              >
                <button
                  className="game-type-card-select"
                  type="button"
                  onClick={() => onSelectCategory(option.id)}
                  aria-pressed={isSelected}
                >
                  <div className="game-type-card-top">
                    <div className="game-type-icon">{option.icon}</div>
                    <span className="game-type-chip">{option.kicker}</span>
                  </div>

                  <div className="game-type-card-title-row">
                    <small>0{optionIndex + 1}</small>
                    <strong>{option.label}</strong>
                  </div>

                  <span>{option.detail}</span>

                  <div className="game-type-meter" aria-hidden="true">
                    <span style={{ width: `${optionFill}%` }} />
                  </div>

                  <div className="game-type-card-meta">
                    <small>{optionGames.length} games</small>
                    <small>{topSamples[0]?.name || 'Coming soon'}</small>
                  </div>
                </button>
              </article>
            );
          })}
        </div>

        <section className={classnames('game-type-preview', `game-type-preview-${selectedOption.tone}`)}>
          <div className="game-type-preview-head">
            <span className="game-type-preview-label">
              <AiOutlineTrophy /> Selected Lane
            </span>
            <strong>{selectedOption.label}</strong>
            <span>{selectedOption.detail}</span>
          </div>

          <div className="game-type-preview-stats">
            <span className="game-type-preview-pill">
              <AiOutlineThunderbolt /> {selectedGames.length} Available
            </span>
            <span className="game-type-preview-pill">
              <AiOutlineGlobal /> {selectedGames.filter((game) => game.supportsOnline).length} Online
            </span>
            <span className="game-type-preview-pill">
              <AiOutlineRobot /> {selectedGames.filter((game) => game.supportsCpu).length} CPU
            </span>
          </div>

          <ul className="game-type-preview-list">
            {selectedGameSamples.map((game) => (
              <li key={game.id}>
                <span>{game.name}</span>
                <small>
                  {game.minPlayers}-{game.maxPlayers} players | {getGameModeLabel(game)}
                </small>
              </li>
            ))}
            {selectedGames.length > selectedGameSamples.length ? (
              <li>
                <span>More waiting</span>
                <small>+ {selectedGames.length - selectedGameSamples.length} games</small>
              </li>
            ) : null}
          </ul>

          <button className="game-type-preview-cta" type="button" onClick={onContinue}>
            <AiOutlineCheckCircle /> {getCategoryActionLabel(selectedOption.id)}
          </button>
        </section>
      </div>
    </section>
  );
}
