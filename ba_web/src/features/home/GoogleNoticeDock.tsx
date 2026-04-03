'use client';

import classnames from 'classnames';
import { AiOutlineClose, AiOutlineInfoCircle } from 'react-icons/ai';

type GoogleNoticeDockProps = {
  isOpen: boolean;
  message: string;
  onToggleOpen: () => void;
  onDismiss: () => void;
};

export function GoogleNoticeDock({ isOpen, message, onToggleOpen, onDismiss }: GoogleNoticeDockProps) {
  return (
    <div className={classnames('profile-dock', 'google-notice-dock', isOpen && 'profile-dock-open')}>
      <button
        className={classnames('music-dock-toggle', 'music-dock-toggle-profile', 'google-notice-dock-toggle', isOpen && 'music-dock-toggle-active')}
        type="button"
        onClick={onToggleOpen}
        aria-label={isOpen ? 'Hide account notice' : 'Show account notice'}
        title={isOpen ? 'Hide account notice' : 'Show account notice'}
      >
        <AiOutlineInfoCircle />
      </button>

      <section className={classnames('profile-dock-panel', 'google-notice-dock-panel')} aria-hidden={!isOpen}>
        <header className="music-dock-head">
          <h3>Account Notice</h3>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close account notice">
            <AiOutlineClose />
          </button>
        </header>

        <p className="google-notice-dock-text">{message}</p>

        <button className={classnames('lobby-btn', 'custome-shadow', 'google-notice-dock-dismiss')} type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </section>
    </div>
  );
}
