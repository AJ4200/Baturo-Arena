'use client';

import classnames from 'classnames';
import {
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineClose,
  AiOutlineLoading3Quarters,
  AiOutlineLogout,
  AiOutlineUser,
} from 'react-icons/ai';
import { FcGoogle } from 'react-icons/fc';
import type { PlayerProfile } from '@/types/game';

export type GoogleAccount = {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
};

type ProfileDockProps = {
  isOpen: boolean;
  account: GoogleAccount | null;
  playerProfile: PlayerProfile | null;
  playerName: string;
  isSigningIn: boolean;
  onToggleOpen: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onPlayerNameChange: (value: string) => void;
  onSaveName: () => void;
};

export function ProfileDock({
  isOpen,
  account,
  playerProfile,
  playerName,
  isSigningIn,
  onToggleOpen,
  onSignIn,
  onSignOut,
  onPlayerNameChange,
  onSaveName,
}: ProfileDockProps) {
  const isConnected = Boolean(account?.sub);
  const displayName = (playerProfile?.name || account?.name || playerName || 'Player').trim() || 'Player';
  const profileAvatar = `https://robohash.org/${encodeURIComponent(displayName)}?size=160x160`;
  const profileStatus = (() => {
    if (isSigningIn) {
      return {
        tone: 'syncing' as const,
        label: 'Signing In',
        detail: 'Completing Google account handshake.',
        icon: <AiOutlineLoading3Quarters className="animate-spin" />,
      };
    }

    if (isConnected) {
      return {
        tone: 'online' as const,
        label: 'Google Profile',
        detail: 'Online, CPU, and local modes unlocked.',
        icon: <AiOutlineCheckCircle />,
      };
    }

    if (playerProfile) {
      return {
        tone: 'guest' as const,
        label: 'Guest Profile',
        detail: 'Stats are tracked locally. Google sign-in enables online.',
        icon: <AiOutlineClockCircle />,
      };
    }

    return {
      tone: 'new' as const,
      label: 'Quick Guest',
      detail: 'Set a guest name to start tracking profile stats.',
      icon: <AiOutlineUser />,
    };
  })();

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
            <img src={account.picture || profileAvatar} alt={`${displayName} avatar`} className="profile-dock-avatar" />
            <strong>{displayName}</strong>
            <div className="profile-dock-status-wrap">
              <span
                className={classnames(
                  'profile-dock-status-pill',
                  `profile-dock-status-pill-${profileStatus.tone}`
                )}
              >
                {profileStatus.icon} {profileStatus.label}
              </span>
              <span className="profile-dock-status-note">{profileStatus.detail}</span>
            </div>
            <div className="profile-dock-status-grid">
              <span className="public-room-pill">Google Linked</span>
              <span className="public-room-pill">Stats Tracking On</span>
              <span className="public-room-pill">Online Ready</span>
            </div>
            <span>{account.email || 'Google account connected'}</span>
            {playerProfile ? <span>Player ID: {playerProfile.playerId}</span> : <span>Online profile ready</span>}
            {playerProfile ? (
              <div className="profile-dock-stats">
                <span className="public-room-pill">Wins {playerProfile.wins}</span>
                <span className="public-room-pill">Losses {playerProfile.losses}</span>
                <span className="public-room-pill">Draws {playerProfile.draws}</span>
              </div>
            ) : null}
            <button className={classnames('lobby-btn', 'custome-shadow', 'profile-dock-auth-btn')} type="button" onClick={onSignOut}>
              <AiOutlineLogout /> Sign out
            </button>
          </div>
        ) : (
          <div className="profile-dock-account">
            {playerProfile ? (
              <img src={profileAvatar} alt={`${displayName} avatar`} className="profile-dock-avatar" />
            ) : (
              <div className="profile-dock-avatar profile-dock-avatar-placeholder">
                <AiOutlineUser />
              </div>
            )}
            <strong>{playerProfile ? displayName : 'Guest mode'}</strong>
            <div className="profile-dock-status-wrap">
              <span
                className={classnames(
                  'profile-dock-status-pill',
                  `profile-dock-status-pill-${profileStatus.tone}`
                )}
              >
                {profileStatus.icon} {profileStatus.label}
              </span>
              <span className="profile-dock-status-note">{profileStatus.detail}</span>
            </div>
            <div className="profile-dock-status-grid">
              <span className="public-room-pill">{playerProfile ? 'Guest Profile Saved' : 'Guest Profile Pending'}</span>
              <span className="public-room-pill">{playerProfile ? 'Stats Tracking On' : 'Stats Tracking Off'}</span>
              <span className="public-room-pill">Offline Ready</span>
            </div>
            <span>Google sign-in is required only for online multiplayer.</span>
            <input
              className="profile-dock-input"
              value={playerName}
              onChange={(event) => onPlayerNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSaveName();
                }
              }}
              placeholder="Set guest name"
            />
            <button
              className={classnames('lobby-btn', 'custome-shadow', 'profile-dock-auth-btn')}
              type="button"
              onClick={onSaveName}
            >
              Save Name
            </button>
            {playerProfile ? <span>Player ID: {playerProfile.playerId} | Guest mode</span> : null}
            {playerProfile ? (
              <div className="profile-dock-stats">
                <span className="public-room-pill">Wins {playerProfile.wins}</span>
                <span className="public-room-pill">Losses {playerProfile.losses}</span>
                <span className="public-room-pill">Draws {playerProfile.draws}</span>
              </div>
            ) : null}
            <button
              className={classnames('lobby-btn', 'custome-shadow', 'profile-dock-auth-btn')}
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              aria-busy={isSigningIn}
            >
              {isSigningIn ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  <FcGoogle /> Sign in with Google
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
