import React, { useState } from 'react';
import classnames from 'classnames';
import {
  AiFillSetting,
  AiOutlineClose,
  AiOutlineCloudDownload,
  AiOutlineMuted,
  AiOutlineReload,
  AiOutlineSave,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import type { CpuDifficulty } from '@/types/game';

type SettingsDockProps = {
  isMusicMuted: boolean;
  isUISoundsMuted: boolean;
  musicVolume: number;
  enableAnimations: boolean;
  cpuDifficulty: CpuDifficulty;
  hasLocalSave: boolean;
  lastSavedAtLabel: string | null;
  onToggleMusic: () => void;
  onToggleUISounds: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onToggleAnimations: () => void;
  onCpuDifficultyChange: (difficulty: CpuDifficulty) => void;
  onSaveNow: () => void;
  onLoadSave: () => void;
  onResetPreferences: () => void;
};

export function SettingsDock(props: SettingsDockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={classnames('settings-dock', isOpen && 'settings-dock-open')}>
      <button
        className={classnames('settings-dock-launch', isOpen && 'settings-dock-launch-active')}
        type="button"
        aria-label={isOpen ? 'Close quick settings' : 'Open quick settings'}
        title={isOpen ? 'Close quick settings' : 'Quick Settings'}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <AiFillSetting />
      </button>

      <section className="settings-dock-panel" aria-hidden={!isOpen}>
        <div className="settings-dock-panel-head">
          <strong>Quick Settings</strong>
          <button className="settings-dock-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close quick settings">
            <AiOutlineClose />
          </button>
        </div>

        <div className="settings-dock-body">
          <div className="settings-dock-quick-row" aria-label="Quick setting toggles">
            <button
              className={classnames('settings-dock-icon-btn', !props.isMusicMuted && 'settings-dock-icon-btn-active')}
              type="button"
              onClick={props.onToggleMusic}
              aria-label={props.isMusicMuted ? 'Unmute music' : 'Mute music'}
              title={props.isMusicMuted ? 'Unmute music' : 'Mute music'}
            >
              {props.isMusicMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
            </button>
            <button
              className={classnames('settings-dock-icon-btn', !props.isUISoundsMuted && 'settings-dock-icon-btn-active')}
              type="button"
              onClick={props.onToggleUISounds}
              aria-label={props.isUISoundsMuted ? 'Enable UI sounds' : 'Mute UI sounds'}
              title={props.isUISoundsMuted ? 'Enable UI sounds' : 'Mute UI sounds'}
            >
              {props.isUISoundsMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
            </button>
            <button
              className={classnames('settings-dock-icon-btn', props.enableAnimations && 'settings-dock-icon-btn-active')}
              type="button"
              onClick={props.onToggleAnimations}
              aria-label={props.enableAnimations ? 'Disable motion' : 'Enable motion'}
              title={props.enableAnimations ? 'Disable motion' : 'Enable motion'}
            >
              <AiOutlineThunderbolt />
            </button>
            <button className="settings-dock-icon-btn" type="button" onClick={props.onSaveNow} aria-label="Save local backup" title="Save local backup">
              <AiOutlineSave />
            </button>
            <button
              className="settings-dock-icon-btn"
              type="button"
              disabled={!props.hasLocalSave}
              onClick={props.onLoadSave}
              aria-label="Load local backup"
              title="Load local backup"
            >
              <AiOutlineCloudDownload />
            </button>
            <button className="settings-dock-icon-btn" type="button" onClick={props.onResetPreferences} aria-label="Reset preferences" title="Reset preferences">
              <AiOutlineReload />
            </button>
          </div>

          <label className="settings-dock-compact-control">
            <span>Volume</span>
            <input
              className="settings-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={props.musicVolume}
              onChange={(event) => props.onMusicVolumeChange(Number(event.target.value))}
              aria-label="Music volume"
            />
            <strong>{props.musicVolume}%</strong>
          </label>

          <label className="settings-dock-compact-control">
            <span>CPU</span>
            <select
              className="settings-select"
              value={props.cpuDifficulty}
              onChange={(event) => props.onCpuDifficultyChange(event.target.value as CpuDifficulty)}
              aria-label="CPU difficulty"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <p className="settings-dock-save-meta">
            {props.lastSavedAtLabel ? `Saved ${props.lastSavedAtLabel}` : 'No local backup yet'}
          </p>
        </div>
      </section>
    </div>
  );
}

export default SettingsDock;
