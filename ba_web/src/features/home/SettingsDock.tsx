import React, { useState } from 'react';
import classnames from 'classnames';
import { AiFillSetting, AiOutlineClose, AiOutlineMuted, AiOutlineSound } from 'react-icons/ai';
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
      {!isOpen ? (
        <button
          className="settings-dock-launch"
          type="button"
          aria-label="Open settings"
          title="Settings"
          onClick={() => setIsOpen(true)}
        >
          <AiFillSetting />
        </button>
      ) : (
        <section className="settings-dock-panel" aria-hidden={!isOpen}>
          <div className="settings-dock-panel-head">
            <strong>Settings</strong>
            <button className="settings-dock-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close settings">
              <AiOutlineClose />
            </button>
          </div>

          <div className="settings-dock-body">
            <div className="settings-item">
              <p>Music</p>
              <button className="lobby-btn" type="button" onClick={props.onToggleMusic}>
                {props.isMusicMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
              </button>
            </div>

            <div className="settings-item">
              <p>UI Sounds</p>
              <button className="lobby-btn" type="button" onClick={props.onToggleUISounds}>
                {props.isUISoundsMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
              </button>
            </div>

            <div className="settings-item">
              <p>Enable Motion</p>
              <button className="lobby-btn" type="button" onClick={props.onToggleAnimations}>
                {props.enableAnimations ? 'On' : 'Off'}
              </button>
            </div>

            <div className="settings-item settings-item-save">
              <p>Local Backup</p>
              <div className="settings-save-actions">
                <button className="lobby-btn" type="button" onClick={props.onSaveNow}>Save</button>
                <button className="lobby-btn" type="button" disabled={!props.hasLocalSave} onClick={props.onLoadSave}>Load</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default SettingsDock;
