import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiFillPlayCircle,
  AiFillSetting,
  AiOutlineHistory,
  AiOutlineTrophy,
} from 'react-icons/ai';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameType } from '@/types/game';

type MainMenuProps = {
  enableAnimations: boolean;
  games: GameDefinition[];
  selectedGame: GameType;
  onSelectGame: (gameType: GameType) => void;
  onPlay: () => void;
  onLeaderboard: () => void;
  onHistory: () => void;
  onSettings: () => void;
};

export function MainMenu({
  enableAnimations,
  games,
  selectedGame,
  onSelectGame,
  onPlay,
  onLeaderboard,
  onHistory,
  onSettings,
}: MainMenuProps) {
  return (
    <section className="title-screen-content">
      <h1>
        <span>Baruto</span>
        <span>-</span>
        <span>Arena</span>
      </h1>

      <div className="game-picker-card custome-shadow">
        <p className="game-picker-label">Choose your arena</p>
        <div className="game-picker-grid">
          {games.map((game) => (
            <button
              key={game.id}
              className={classnames(
                'game-picker-btn',
                selectedGame === game.id && 'game-picker-btn-active'
              )}
              type="button"
              onClick={() => onSelectGame(game.id)}
            >
              <strong>{game.name}</strong>
              <span>{game.description}</span>
            </button>
          ))}
        </div>
      </div>

      <motion.div
        className="main-menu"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4, repeat: Infinity } : undefined}
      >
        <button className={classnames('main-menu-btn', 'custome-shadow')} type="button" onClick={onPlay}>
          <AiFillPlayCircle /> Play {formatGameName(selectedGame, games)}
        </button>
        <button className={classnames('main-menu-btn', 'custome-shadow')} type="button" onClick={onLeaderboard}>
          <AiOutlineTrophy /> Leaderboard
        </button>
        <button className={classnames('main-menu-btn', 'custome-shadow')} type="button" onClick={onHistory}>
          <AiOutlineHistory /> History
        </button>
        <button className={classnames('main-menu-btn', 'custome-shadow')} type="button" onClick={onSettings}>
          <AiFillSetting /> Settings
        </button>
      </motion.div>
    </section>
  );
}
