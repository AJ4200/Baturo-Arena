import classnames from 'classnames';
import {
  AiFillSetting,
  AiOutlineArrowLeft,
  AiOutlineMuted,
  AiOutlineSound,
} from 'react-icons/ai';
import { BiDownload, BiReset, BiSave } from 'react-icons/bi';
import { FaCheck, FaRobot, FaTimes } from 'react-icons/fa';
import { MdAnimation, MdMusicNote, MdStorage, MdTouchApp } from 'react-icons/md';
import type { CSSProperties } from 'react';
import type { CpuDifficulty } from '@/types/game';

type SettingsScreenProps = {
  isMusicMuted: boolean;
  isUISoundsMuted: boolean;
  musicVolume: number;
  enableAnimations: boolean;
  cpuDifficulty: CpuDifficulty;
  hasLocalSave: boolean;
  lastSavedAtLabel: string | null;
  onBack: () => void;
  onToggleMusic: () => void;
  onToggleUISounds: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onToggleAnimations: () => void;
  onCpuDifficultyChange: (difficulty: CpuDifficulty) => void;
  onSaveNow: () => void;
  onLoadSave: () => void;
  onResetPreferences: () => void;
};

const DIFFICULTY_OPTIONS: Array<{
  value: CpuDifficulty;
  label: string;
  description: string;
}> = [
  { value: 'easy', label: 'Easy', description: 'A relaxed warm-up' },
  { value: 'medium', label: 'Medium', description: 'A balanced battle' },
  { value: 'hard', label: 'Hard', description: 'No mercy mode' },
];

export function SettingsScreen({
  isMusicMuted,
  isUISoundsMuted,
  musicVolume,
  enableAnimations,
  cpuDifficulty,
  hasLocalSave,
  lastSavedAtLabel,
  onBack,
  onToggleMusic,
  onToggleUISounds,
  onMusicVolumeChange,
  onToggleAnimations,
  onCpuDifficultyChange,
  onSaveNow,
  onLoadSave,
  onResetPreferences,
}: SettingsScreenProps) {
  return (
    <section className="title-screen-content settings-screen">
      <div className="settings-screen-heading">
        <span className="settings-screen-kicker">
          <AiFillSetting aria-hidden="true" /> Tune your arena
        </span>
        <h1>
          <span>Set-</span>
          <span>tings</span>
        </h1>
        <p>Make every match look, sound, and play exactly your way.</p>
      </div>

      <div className="lobby-card settings-shell">
        <div className="settings-toolbar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft aria-hidden="true" /> Back
          </button>
          <div className={classnames('settings-save-status', hasLocalSave && 'settings-save-status-ready')}>
            <span className="settings-save-status-dot" aria-hidden="true" />
            <span>
              <strong>{hasLocalSave ? 'Backup ready' : 'No backup yet'}</strong>
              {lastSavedAtLabel && <small>Saved {lastSavedAtLabel.toString()}</small>}
            </span>
          </div>
        </div>

        <div className="settings-layout">
          <section className="settings-panel settings-panel-experience">
            <div className="settings-panel-heading">
              <span className="settings-panel-icon settings-panel-icon-pink">
                <MdTouchApp aria-hidden="true" />
              </span>
              <span>
                <span className="settings-eyebrow">Experience</span>
                <h2>Feel the game</h2>
              </span>
            </div>

            <div className="settings-control-grid">
              <div className="settings-control-card">
                <div className="settings-control-copy">
                  <AiOutlineSound aria-hidden="true" />
                  <span>
                    <strong>UI sounds</strong>
                    <small>Clicks, moves, and alerts</small>
                  </span>
                </div>
                <button
                  className={classnames('settings-toggle', !isUISoundsMuted && 'settings-toggle-active')}
                  type="button"
                  role="switch"
                  aria-checked={!isUISoundsMuted}
                  aria-label={`UI sounds ${isUISoundsMuted ? 'off' : 'on'}`}
                  onClick={onToggleUISounds}
                >
                  <span className="settings-toggle-icon">
                    {isUISoundsMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
                  </span>
                  <span>{isUISoundsMuted ? 'Off' : 'On'}</span>
                </button>
              </div>

              <div className="settings-control-card">
                <div className="settings-control-copy">
                  <MdAnimation aria-hidden="true" />
                  <span>
                    <strong>Motion</strong>
                    <small>Transitions and effects</small>
                  </span>
                </div>
                <button
                  className={classnames('settings-toggle', enableAnimations && 'settings-toggle-active')}
                  type="button"
                  role="switch"
                  aria-checked={enableAnimations}
                  aria-label={`Motion ${enableAnimations ? 'on' : 'off'}`}
                  onClick={onToggleAnimations}
                >
                  <span className="settings-toggle-icon">
                    {enableAnimations ? <FaCheck /> : <FaTimes />}
                  </span>
                  <span>{enableAnimations ? 'On' : 'Off'}</span>
                </button>
              </div>
            </div>

            <div className="settings-music-card">
              <div className="settings-music-head">
                <div className="settings-control-copy">
                  <MdMusicNote aria-hidden="true" />
                  <span>
                    <strong>Arena music</strong>
                    <small>{isMusicMuted ? 'Muted' : 'Playing during menus and matches'}</small>
                  </span>
                </div>
                <button
                  className={classnames('settings-icon-button', !isMusicMuted && 'settings-icon-button-active')}
                  type="button"
                  aria-label={isMusicMuted ? 'Unmute music' : 'Mute music'}
                  onClick={onToggleMusic}
                >
                  {isMusicMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
                </button>
              </div>

              <label className="settings-volume-control">
                <span>Volume</span>
                <input
                  className="settings-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={musicVolume}
                  aria-label="Music volume"
                  style={{ '--settings-volume': `${musicVolume}%` } as CSSProperties}
                  onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
                />
                <output>{musicVolume}%</output>
              </label>
            </div>
          </section>

          <section className="settings-panel settings-panel-difficulty">
            <div className="settings-panel-heading">
              <span className="settings-panel-icon settings-panel-icon-blue">
                <FaRobot aria-hidden="true" />
              </span>
              <span>
                <span className="settings-eyebrow">CPU challenge</span>
                <h2>Choose your rival</h2>
              </span>
            </div>

            <div className="settings-difficulty-list" role="radiogroup" aria-label="CPU difficulty">
              {DIFFICULTY_OPTIONS.map((option, index) => {
                const isActive = cpuDifficulty === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={classnames('settings-difficulty-option', isActive && 'settings-difficulty-option-active')}
                    onClick={() => onCpuDifficultyChange(option.value)}
                  >
                    <span className="settings-difficulty-number">0{index + 1}</span>
                    <span className="settings-difficulty-copy">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    <span className="settings-difficulty-check" aria-hidden="true">
                      {isActive && <FaCheck />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-panel settings-panel-data">
            <div className="settings-panel-heading">
              <span className="settings-panel-icon settings-panel-icon-yellow">
                <MdStorage aria-hidden="true" />
              </span>
              <span>
                <span className="settings-eyebrow">Local data</span>
                <h2>Keep your lineup safe</h2>
              </span>
            </div>

            <p className="settings-data-copy">
              Store your preferences and progress on this device, then restore them whenever you need.
            </p>

            <div className="settings-data-actions">
              <button className="settings-action-button settings-action-button-primary" type="button" onClick={onSaveNow}>
                <BiSave aria-hidden="true" />
                <span>
                  <strong>Save now</strong>
                  <small>Update local backup</small>
                </span>
              </button>
              <button
                className="settings-action-button"
                type="button"
                disabled={!hasLocalSave}
                onClick={onLoadSave}
              >
                <BiDownload aria-hidden="true" />
                <span>
                  <strong>Load save</strong>
                  <small>{hasLocalSave ? 'Restore this device' : 'No save available'}</small>
                </span>
              </button>
            </div>

            <div className="settings-reset-row">
              <span>
                <strong>Need a clean slate?</strong>
                <small>Return audio, motion, and CPU settings to default.</small>
              </span>
              <button type="button" onClick={onResetPreferences}>
                <BiReset aria-hidden="true" /> Reset
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
