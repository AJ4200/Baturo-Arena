'use client';

import { useEffect, useState } from 'react';
import {
  AiOutlineCheck,
  AiOutlineClose,
  AiOutlineCloudSync,
  AiOutlineDatabase,
  AiOutlineSafetyCertificate,
  AiOutlineSetting,
} from 'react-icons/ai';

type BackupNoticeProps = {
  requireEula: boolean;
  onAcceptEula: () => void;
  onReadEula: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
};

export function BackupNotice({
  requireEula,
  onAcceptEula,
  onReadEula,
  dontShowAgain,
  onDontShowAgainChange,
  onDismiss,
  onOpenSettings,
}: BackupNoticeProps) {
  const [eulaChecked, setEulaChecked] = useState(false);
  const canContinue = !requireEula || eulaChecked;

  useEffect(() => {
    if (requireEula) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, requireEula]);

  const handleContinue = () => {
    if (!canContinue) return;
    if (requireEula) onAcceptEula();
    onDismiss();
  };

  return (
    <div className="backup-notice-backdrop" role="presentation">
      <section
        className="backup-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-notice-title"
        aria-describedby="backup-notice-summary"
      >
        {requireEula ? null : (
          <button
            className="backup-notice-close"
            type="button"
            onClick={onDismiss}
            aria-label="Close backup information"
          >
            <AiOutlineClose />
          </button>
        )}

        <header className="backup-notice-head">
          <span className="backup-notice-kicker">
            <AiOutlineSafetyCertificate /> Your progress, your choice
          </span>
          <h2 id="backup-notice-title">How Baturo Arena keeps your data</h2>
          <p id="backup-notice-summary">
            Local backup and online sign-in protect different parts of your arena profile.
          </p>
        </header>

        <div className="backup-notice-grid">
          <article className="backup-notice-option backup-notice-option-local">
            <span className="backup-notice-option-icon">
              <AiOutlineDatabase />
            </span>
            <div>
              <span className="backup-notice-label">This device</span>
              <h3>Local backup</h3>
              <p>
                Saves your player snapshot, selected game, audio, motion, and CPU preferences in
                this browser.
              </p>
              <strong>
                Match history also stays on this device. Clearing browser data can remove both.
              </strong>
            </div>
          </article>

          <article className="backup-notice-option backup-notice-option-online">
            <span className="backup-notice-option-icon">
              <AiOutlineCloudSync />
            </span>
            <div>
              <span className="backup-notice-label">Signed in</span>
              <h3>Online profile</h3>
              <p>
                Google sign-in restores your online identity and server-recorded match stats used
                for multiplayer and leaderboards.
              </p>
              <strong>It does not upload your local settings or device match history.</strong>
            </div>
          </article>
        </div>

        <p className="backup-notice-privacy">
          <AiOutlineSafetyCertificate />
          CPU and local play work without Google. Sign-in is only required for online multiplayer.
        </p>

        <div className="backup-notice-footer">
          {requireEula ? (
            <label className="backup-notice-check backup-notice-check-eula">
              <input
                type="checkbox"
                checked={eulaChecked}
                onChange={(event) => setEulaChecked(event.target.checked)}
              />
              <span className="backup-notice-check-box" aria-hidden="true">
                <AiOutlineCheck />
              </span>
              <span>
                I have read and accept the{' '}
                <button type="button" className="backup-notice-eula-link" onClick={onReadEula}>
                  EULA
                </button>{' '}
                and how my data is handled
              </span>
            </label>
          ) : (
            <label className="backup-notice-check">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => onDontShowAgainChange(event.target.checked)}
              />
              <span className="backup-notice-check-box" aria-hidden="true">
                <AiOutlineCheck />
              </span>
              <span>Don&apos;t show this guide again</span>
            </label>
          )}

          <div className="backup-notice-actions">
            {requireEula ? null : (
              <button className="backup-notice-action backup-notice-action-secondary" type="button" onClick={onOpenSettings}>
                <AiOutlineSetting /> Backup settings
              </button>
            )}
            <button
              className="backup-notice-action backup-notice-action-primary"
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              autoFocus
            >
              {requireEula ? 'Accept & Continue' : 'Got it'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
