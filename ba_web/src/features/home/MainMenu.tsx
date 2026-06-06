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
      <div className="title-board-card title-board-card-hero">
        <div className="title-brand-lockup">
          <img
            className="title-brand-icon"
            src="/icons/baturo-arena-icon.svg"
            alt=""
            width="128"
            height="128"
            aria-hidden="true"
          />
          <h1>
            <span className="title-main-first">Baturo</span>
            <span className="title-main-dash">-</span>
            <span className="title-main-last">Arena</span>
          </h1>
        </div>
      </div>

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
