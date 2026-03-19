import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiFillPlayCircle,
  AiFillSetting,
  AiOutlineHistory,
  AiOutlineTrophy,
} from 'react-icons/ai';

type MainMenuProps = {
  enableAnimations: boolean;
  onPlay: () => void;
  onLeaderboard: () => void;
  onHistory: () => void;
  onSettings: () => void;
};

export function MainMenu({
  enableAnimations,
  onPlay,
  onLeaderboard,
  onHistory,
  onSettings,
}: MainMenuProps) {
  return (
    <section className="title-screen-content">
      <h1>
        <span>Baturo</span>
        <span>-</span>
        <span>Arena</span>
      </h1>

      <motion.div
        className="main-menu"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4, repeat: Infinity } : undefined}
      >
        <button className={classnames('main-menu-btn', 'custome-shadow')} type="button" onClick={onPlay}>
          <AiFillPlayCircle /> Play
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
