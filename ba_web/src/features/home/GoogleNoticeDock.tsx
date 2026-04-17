'use client';

import type { ReactNode } from 'react';
import classnames from 'classnames';
import {
  AiOutlineCheckCircle,
  AiOutlineClose,
  AiOutlineExclamationCircle,
  AiOutlineInfoCircle,
  AiOutlineWarning,
} from 'react-icons/ai';

export type NoticeTone = 'error' | 'warning' | 'success' | 'info';

type GoogleNoticeDockProps = {
  isOpen: boolean;
  message: string;
  title?: string;
  tone?: NoticeTone;
  onToggleOpen: () => void;
  onDismiss: () => void;
};

const NOTICE_COPY: Record<NoticeTone, { launcher: string; heading: string; action: string; icon: ReactNode }> = {
  error: {
    launcher: 'Show error notice',
    heading: 'Action Needed',
    action: 'Dismiss Error',
    icon: <AiOutlineExclamationCircle />,
  },
  warning: {
    launcher: 'Show warning notice',
    heading: 'Heads Up',
    action: 'Dismiss Notice',
    icon: <AiOutlineWarning />,
  },
  success: {
    launcher: 'Show success notice',
    heading: 'Update',
    action: 'Close Update',
    icon: <AiOutlineCheckCircle />,
  },
  info: {
    launcher: 'Show info notice',
    heading: 'Notice',
    action: 'Dismiss',
    icon: <AiOutlineInfoCircle />,
  },
};

export function GoogleNoticeDock({
  isOpen,
  message,
  title,
  tone = 'info',
  onToggleOpen,
  onDismiss,
}: GoogleNoticeDockProps) {
  const noticeCopy = NOTICE_COPY[tone];

  return (
    <div
      className={classnames(
        'profile-dock',
        'google-notice-dock',
        `google-notice-dock-${tone}`,
        isOpen && 'profile-dock-open'
      )}
    >
      <button
        className={classnames(
          'music-dock-toggle',
          'music-dock-toggle-profile',
          'google-notice-dock-toggle',
          `google-notice-dock-toggle-${tone}`,
          isOpen && 'music-dock-toggle-active'
        )}
        type="button"
        onClick={onToggleOpen}
        aria-label={isOpen ? 'Hide latest notice' : noticeCopy.launcher}
        title={isOpen ? 'Hide latest notice' : noticeCopy.launcher}
      >
        {noticeCopy.icon}
      </button>

      <section
        className={classnames('profile-dock-panel', 'google-notice-dock-panel', `google-notice-dock-panel-${tone}`)}
        aria-hidden={!isOpen}
      >
        <header className="music-dock-head">
          <h3>{title || noticeCopy.heading}</h3>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close notice panel">
            <AiOutlineClose />
          </button>
        </header>

        <span className={classnames('google-notice-dock-tag', `google-notice-dock-tag-${tone}`)}>
          {noticeCopy.icon} {tone}
        </span>
        <p className="google-notice-dock-text">{message}</p>

        <button className={classnames('lobby-btn', 'custome-shadow', 'google-notice-dock-dismiss')} type="button" onClick={onDismiss}>
          {noticeCopy.action}
        </button>
      </section>
    </div>
  );
}
