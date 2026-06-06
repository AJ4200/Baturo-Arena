'use client';

import classnames from 'classnames';
import { AiOutlineGlobal, AiOutlineLoading3Quarters, AiOutlineRobot, AiOutlineTeam } from 'react-icons/ai';
import { getGameCarouselThumbnail } from '@/features/home/gameCarouselThumbnails';
import type { GameDefinition, GameMode, GameType } from '@/types/game';

type GameIntroSplashProps = {
  game: GameDefinition;
  phase: 'enter' | 'exit';
  supportedModes: GameMode[];
};

const MODE_LABELS: Record<GameMode, string> = {
  online: 'Online',
  cpu: 'CPU',
  offline: 'Local',
};

export function GameIntroSplash({ game, phase, supportedModes }: GameIntroSplashProps) {
  const thumbnail = getGameCarouselThumbnail(game.id as GameType);

  return (
    <section className={classnames('game-intro-splash', phase === 'exit' && 'game-intro-splash-exit')}>
      <div className="game-intro-splash-media" aria-hidden="true">
        <div className={classnames('game-intro-splash-thumb', 'choose-game-thumb', thumbnail.className)}>
          <span>{thumbnail.label}</span>
        </div>
      </div>

      <div className="game-intro-splash-copy">
        <h1>{game.name}</h1>
        <p>{game.description}</p>
      </div>

      <div className="game-intro-splash-meta">
        <span>
          <AiOutlineTeam /> {game.minPlayers}-{game.maxPlayers} Players
        </span>
        <span>{game.supportsOnline ? <AiOutlineGlobal /> : <AiOutlineRobot />} {supportedModes.map((mode) => MODE_LABELS[mode]).join(' | ')}</span>
      </div>

      <div className="game-intro-splash-loader" aria-label="Loading lobby">
        <AiOutlineLoading3Quarters className="loader-spin" />
      </div>
    </section>
  );
}

export default GameIntroSplash;
