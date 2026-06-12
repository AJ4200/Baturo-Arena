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
          <h1>
            <span className="title-main-first">Baturo</span>
            <span className="title-brand-mark" aria-hidden="true">
              <img
                className="title-brand-icon"
                src="/icons/baturo-arena-icon.svg"
                alt=""
                width="144"
                height="144"
              />
            </span>
            <span className="title-main-last">Arena</span>
          </h1>
        </div>
      </div>

      <motion.div
        className="main-menu"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4, repeat: Infinity } : undefined}
      >
        <button className={classnames('main-menu-btn', 'main-menu-btn-play')} type="button" onClick={onPlay}>
          <span className="main-menu-btn-icon"><AiFillPlayCircle /></span>
          <span>Play</span>
        </button>
        <button className={classnames('main-menu-btn', 'main-menu-btn-leaderboard')} type="button" onClick={onLeaderboard}>
          <span className="main-menu-btn-icon"><AiOutlineTrophy /></span>
          <span>Leaderboard</span>
        </button>
        <button className={classnames('main-menu-btn', 'main-menu-btn-history')} type="button" onClick={onHistory}>
          <span className="main-menu-btn-icon"><AiOutlineHistory /></span>
          <span>History</span>
        </button>
        <button className={classnames('main-menu-btn', 'main-menu-btn-settings')} type="button" onClick={onSettings}>
          <span className="main-menu-btn-icon"><AiFillSetting /></span>
          <span>Settings</span>
        </button>
      </motion.div>
    </section>
  );
}
