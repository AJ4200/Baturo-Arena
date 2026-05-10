import classnames from "classnames";
import { AiOutlineArrowLeft, AiOutlineMuted, AiOutlineSound } from "react-icons/ai";
import type { CpuDifficulty } from "@/types/game";
import { FaCheck, FaTimes } from "react-icons/fa";
import { BiDownload, BiReset, BiSave } from "react-icons/bi";

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
    <section className="title-screen-content">
      <h1>
        <span>Set-</span>
        <span>tings</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row justify-between items-center">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <p className="settings-save-meta">
            {lastSavedAtLabel ? (
              <>
                Last local save:{' '}
                <span className="text-blue-500">
                  {lastSavedAtLabel.toString()}
                </span>
              </>
            ) : (
              'No local save found yet'
            )}
          </p>
        </div>
        <div className="settings-item">
          <p>UI Sounds</p>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onToggleUISounds}>
            {isUISoundsMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
          </button>
        </div>

        <div className="settings-item flex flex-col space-y-4">
          <div className="flex items-center justify-between w-full">
            <p>Music</p>
            <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onToggleMusic}>
              {isMusicMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
            </button>
          </div>

          <div className="settings-item-volume flex items-center justify-between w-full">
            <div className="flex items-center justify-between w-full">
              <p>Volume</p>
              <div className="settings-volume">
                <input
                  className="settings-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={musicVolume}
                  onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
                />
                <span className="settings-volume-value">{musicVolume}%</span>
              </div>
            </div>

          </div>
        </div>

        <div className="settings-item">
          <p>Enable Motion</p>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onToggleAnimations}>
            {enableAnimations ? <FaCheck /> : <FaTimes />}
          </button>
        </div>

        <div className="settings-item">
          <p>CPU Difficulty</p>

          <div className={classnames("settings-tabs", "lobby-btn", "custome-shadow")}>
            <button
              type="button"
              onClick={() => onCpuDifficultyChange('easy')}
              className={classnames(
                'settings-tab',
                cpuDifficulty === 'easy' && 'settings-tab-active'
              )}
            >
              Easy
            </button>

            <button
              type="button"
              onClick={() => onCpuDifficultyChange('medium')}
              className={classnames(
                'settings-tab',
                cpuDifficulty === 'medium' && 'settings-tab-active'
              )}
            >
              Medium
            </button>

            <button
              type="button"
              onClick={() => onCpuDifficultyChange('hard')}
              className={classnames(
                'settings-tab',
                cpuDifficulty === 'hard' && 'settings-tab-active'
              )}
            >
              Hard
            </button>
          </div>
        </div>

        <div className="settings-item settings-item-save">
          <p>Local Backup</p>
          <div className="settings-save-actions">
            <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onSaveNow}>
              <BiSave /> Save Now
            </button>
            <button
              className={classnames("lobby-btn", "custome-shadow")}
              type="button"
              disabled={!hasLocalSave}
              onClick={onLoadSave}
            >
              <BiDownload /> Load Save
            </button>
          </div>
        </div>

        <div className="settings-item">
          <p>Preferences</p>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onResetPreferences}>
            <BiReset /> Reset to Default
          </button>
        </div>
      </div>
    </section>
  );
}
