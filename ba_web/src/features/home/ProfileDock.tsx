'use client';

import classnames from 'classnames';
import { AiOutlineClose, AiOutlineLogin, AiOutlineLogout, AiOutlineUser } from 'react-icons/ai';

export type GoogleAccount = {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
};

type ProfileDockProps = {
  isOpen: boolean;
  account: GoogleAccount | null;
  onToggleOpen: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

export function ProfileDock({ isOpen, account, onToggleOpen, onSignIn, onSignOut }: ProfileDockProps) {
  const isConnected = Boolean(account?.sub);

  return (
    <div className={classnames('profile-dock', isOpen && 'profile-dock-open')}>
      <button
        className={classnames(
          'music-dock-toggle',
          'music-dock-toggle-profile',
          isConnected && 'music-dock-toggle-profile-connected',
          isOpen && 'music-dock-toggle-active'
        )}
        type="button"
        onClick={onToggleOpen}
        aria-label={isOpen ? 'Hide profile panel' : 'Show profile panel'}
      >
        <AiOutlineUser />
        {isConnected ? <span className="profile-dock-live-dot" aria-hidden="true" /> : null}
      </button>

      <section className="profile-dock-panel" aria-hidden={!isOpen}>
        <header className="music-dock-head">
          <h3>Profile</h3>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close profile panel">
            <AiOutlineClose />
          </button>
        </header>

        {account ? (
          <div className="profile-dock-account">
            <img src={account.picture || '/music/art/generic-cover.svg'} alt={`${account.name} avatar`} className="profile-dock-avatar" />
            <strong>{account.name}</strong>
            <span>{account.email || 'Google account connected'}</span>
            <button className={classnames('lobby-btn', 'custome-shadow', 'profile-dock-auth-btn')} type="button" onClick={onSignOut}>
              <AiOutlineLogout /> Sign out
            </button>
          </div>
        ) : (
          <div className="profile-dock-account">
            <div className="profile-dock-avatar profile-dock-avatar-placeholder">
              <AiOutlineUser />
            </div>
            <strong>Guest mode</strong>
            <span>Google sign-in is required only for online multiplayer.</span>
            <button className={classnames('lobby-btn', 'custome-shadow', 'profile-dock-auth-btn')} type="button" onClick={onSignIn}>
              <AiOutlineLogin /> Sign in with Google
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
