'use client';

import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import classnames from 'classnames';
import {
  AiOutlineClose,
  AiOutlineAudioMuted,
  AiOutlineMinus,
  AiOutlinePauseCircle,
  AiOutlinePlayCircle,
  AiOutlinePlus,
  AiOutlineReload,
  AiOutlineRetweet,
  AiOutlineSound,
  AiOutlineStepBackward,
  AiOutlineStepForward,
} from 'react-icons/ai';
import { IoMdList, IoMdMusicalNote } from 'react-icons/io';

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  artSrc?: string | null;
};

type MusicDockProps = {
  tracks: MusicTrack[];
  isMuted: boolean;
  volume: number;
  showLauncher?: boolean;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
};

const GENERIC_ART_SRC = '/music/art/generic-cover.svg';

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export function MusicDock({ tracks, isMuted, volume, showLauncher = true, onToggleMute, onVolumeChange }: MusicDockProps) {
  const hasTracks = tracks.length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [isTrackListOpen, setIsTrackListOpen] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [isRepeatOneEnabled, setIsRepeatOneEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const [nowPlayingToast, setNowPlayingToast] = useState<MusicTrack | null>(null);
  const [isClient, setIsClient] = useState(false);
  const lastToastTrackIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeKnobRef = useRef<HTMLDivElement | null>(null);
  const safeVolume = Math.min(100, Math.max(0, Math.round(volume)));
  const activeTrack =
    hasTracks && tracks[activeTrackIndex]
      ? tracks[activeTrackIndex]
      : hasTracks
        ? tracks[0]
        : null;
  const coverSource = activeTrack?.artSrc || GENERIC_ART_SRC;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const centerFillWidth = `${progressRatio * 50}%`;
  const progressCursorPosition = `${progressRatio * 100}%`;
  const knobAngle = 210 + (safeVolume / 100) * 300;
  const knobSweep = (safeVolume / 100) * 300;
  const knobStyle = {
    '--music-knob-angle': `${knobAngle}deg`,
    '--music-knob-sweep': `${knobSweep}deg`,
  } as CSSProperties;
  const isTrackListPanelOpen = isOpen && isTrackListOpen;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!hasTracks) {
      setActiveTrackIndex(0);
      return;
    }

    setActiveTrackIndex((currentValue) => Math.min(currentValue, tracks.length - 1));
  }, [hasTracks, tracks.length]);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setIsTrackListOpen(false);
  }, [isOpen]);

  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const playPromise = audio.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.muted = isMuted;
    audio.volume = safeVolume / 100;
  }, [isMuted, safeVolume, activeTrack?.src]);

  useEffect(() => {
    if (!activeTrack) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setCurrentTime(0);
    setDuration(0);
    audio.load();
    tryPlay();
  }, [activeTrack?.src, tryPlay]);

  useEffect(() => {
    if (!activeTrack) {
      setNowPlayingToast(null);
      lastToastTrackIdRef.current = null;
      return;
    }

    if (lastToastTrackIdRef.current === null) {
      lastToastTrackIdRef.current = activeTrack.id;
      return;
    }

    if (lastToastTrackIdRef.current === activeTrack.id) {
      return;
    }

    lastToastTrackIdRef.current = activeTrack.id;
    setNowPlayingToast(activeTrack);

    const timeoutId = window.setTimeout(() => setNowPlayingToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [activeTrack]);

  const pickRandomTrackIndex = useCallback(
    (excludeIndex: number): number => {
      if (tracks.length <= 1) {
        return excludeIndex;
      }

      let nextIndex = excludeIndex;
      while (nextIndex === excludeIndex) {
        nextIndex = Math.floor(Math.random() * tracks.length);
      }
      return nextIndex;
    },
    [tracks.length]
  );

  const selectTrackAtIndex = useCallback(
    (targetIndex: number) => {
      if (!hasTracks) {
        return;
      }

      const nextIndex = (targetIndex + tracks.length) % tracks.length;
      setActiveTrackIndex(nextIndex);
    },
    [hasTracks, tracks.length]
  );

  const handleNextTrack = useCallback(() => {
    if (!hasTracks) {
      return;
    }

    if (isShuffleEnabled) {
      setActiveTrackIndex((currentValue) => pickRandomTrackIndex(currentValue));
      return;
    }

    selectTrackAtIndex(activeTrackIndex + 1);
  }, [activeTrackIndex, hasTracks, isShuffleEnabled, pickRandomTrackIndex, selectTrackAtIndex]);

  const handlePreviousTrack = useCallback(() => {
    if (!hasTracks) {
      return;
    }

    selectTrackAtIndex(activeTrackIndex - 1);
  }, [activeTrackIndex, hasTracks, selectTrackAtIndex]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      tryPlay();
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }, [tryPlay]);

  const handleSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Number(event.target.value);
    if (Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  }, []);

  const stepVolume = useCallback(
    (direction: -1 | 1) => {
      onVolumeChange(Math.min(100, Math.max(0, safeVolume + direction * 5)));
    },
    [onVolumeChange, safeVolume]
  );

  const updateVolumeFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const knob = volumeKnobRef.current;
      if (!knob) {
        return;
      }

      const rect = knob.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normalizedAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
      const angleFromTop = (normalizedAngle + 450) % 360;
      let sweepPosition = angleFromTop - 210;
      if (sweepPosition < 0) {
        sweepPosition += 360;
      }

      const clampedSweep = Math.min(300, Math.max(0, sweepPosition));
      const nextVolume = Math.round((clampedSweep / 300) * 100);
      onVolumeChange(nextVolume);
    },
    [onVolumeChange]
  );

  const handleKnobPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsAdjustingVolume(true);
      updateVolumeFromPointer(event.clientX, event.clientY);
    },
    [updateVolumeFromPointer]
  );

  const handleKnobKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        stepVolume(1);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        stepVolume(-1);
      }
    },
    [stepVolume]
  );

  useEffect(() => {
    if (!isAdjustingVolume) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      updateVolumeFromPointer(event.clientX, event.clientY);
    };

    const stopAdjusting = () => {
      setIsAdjustingVolume(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopAdjusting);
    window.addEventListener('pointercancel', stopAdjusting);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopAdjusting);
      window.removeEventListener('pointercancel', stopAdjusting);
    };
  }, [isAdjustingVolume, updateVolumeFromPointer]);

  const handleTrackEnd = useCallback(() => {
    if (!hasTracks) {
      return;
    }

    if (tracks.length <= 1 || isRepeatOneEnabled) {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = 0;
      tryPlay();
      return;
    }

    if (isShuffleEnabled) {
      setActiveTrackIndex((currentValue) => pickRandomTrackIndex(currentValue));
      return;
    }

    setActiveTrackIndex((currentValue) => (currentValue + 1) % tracks.length);
  }, [hasTracks, isRepeatOneEnabled, isShuffleEnabled, pickRandomTrackIndex, tracks.length, tryPlay]);

  return (
    <div className={classnames('music-dock', isOpen && 'music-dock-open')}>
      {!isOpen && showLauncher ? (
        <button
          className="music-dock-toggle"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Show music player"
          title="Show music player"
        >
          <IoMdMusicalNote />
        </button>
      ) : null}

      <section className="music-dock-panel" aria-hidden={!isOpen}>
        <header className="music-dock-head">
          <h3>Music Player</h3>
          <div className="music-dock-head-actions">
            <span>{hasTracks ? `${activeTrackIndex + 1} of ${tracks.length}` : 'No tracks'}</span>
            <button
              className={classnames('music-dock-head-btn', isTrackListPanelOpen && 'music-dock-head-btn-active')}
              type="button"
              onClick={() => setIsTrackListOpen((currentValue) => !currentValue)}
              aria-label={isTrackListPanelOpen ? 'Hide track list' : 'Show track list'}
              title={isTrackListPanelOpen ? 'Hide track list' : 'Show track list'}
            >
              <IoMdList />
            </button>
            <button
              className="music-dock-head-btn"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Hide music player"
              title="Hide music player"
            >
              <AiOutlineClose />
            </button>
          </div>
        </header>

        {activeTrack ? (
          <>
            <div className="music-dock-now-playing">
              <div className="music-dock-art-wrap">
                <img
                  src={coverSource}
                  alt={`${activeTrack.title} artwork`}
                  className="music-dock-art"
                  onError={(event) => {
                    if (event.currentTarget.src.endsWith(GENERIC_ART_SRC)) {
                      return;
                    }
                    event.currentTarget.src = GENERIC_ART_SRC;
                  }}
                />
              </div>
              <div className="music-dock-track-meta">
                <strong>{activeTrack.title}</strong>
                <span>{activeTrack.artist}</span>
              </div>
            </div>

            <div className="music-dock-control-deck">
              <div className="music-dock-transport-row">
                <button
                  className={classnames('music-dock-icon-btn', isShuffleEnabled && 'music-dock-icon-btn-toggle-active')}
                  type="button"
                  onClick={() => setIsShuffleEnabled((currentValue) => !currentValue)}
                  aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
                  title={isShuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
                >
                  <AiOutlineRetweet />
                </button>
                <button className="music-dock-icon-btn" type="button" onClick={handlePreviousTrack} aria-label="Previous track" title="Previous track">
                  <AiOutlineStepBackward />
                </button>
                <button
                  className="music-dock-icon-btn music-dock-icon-btn-main"
                  type="button"
                  onClick={handlePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <AiOutlinePauseCircle /> : <AiOutlinePlayCircle />}
                </button>
                <button className="music-dock-icon-btn" type="button" onClick={handleNextTrack} aria-label="Next track" title="Next track">
                  <AiOutlineStepForward />
                </button>
                <button
                  className={classnames('music-dock-icon-btn', isRepeatOneEnabled && 'music-dock-icon-btn-toggle-active')}
                  type="button"
                  onClick={() => setIsRepeatOneEnabled((currentValue) => !currentValue)}
                  aria-label={isRepeatOneEnabled ? 'Disable repeat one' : 'Enable repeat one'}
                  title={isRepeatOneEnabled ? 'Repeat one on' : 'Repeat one off'}
                >
                  <AiOutlineReload />
                </button>
              </div>
            </div>

            <label className="music-dock-progress">
              <span>Progress</span>
              <div className="music-dock-progress-shell">
                <div className="music-dock-progress-track">
                  <span className="music-dock-progress-center" />
                  <span className="music-dock-progress-fill music-dock-progress-fill-left" style={{ width: centerFillWidth }} />
                  <span className="music-dock-progress-fill music-dock-progress-fill-right" style={{ width: centerFillWidth }} />
                  <span className="music-dock-progress-cursor" style={{ left: progressCursorPosition }} />
                </div>
                <input
                  className="music-dock-progress-hitbox"
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={handleSeek}
                  disabled={duration <= 0}
                />
              </div>
              <strong>
                {formatClock(currentTime)} / {formatClock(duration)}
              </strong>
            </label>

            <label className="music-dock-volume">
              <span>Volume</span>
              <div className="music-dock-volume-cluster">
                <button
                  className={classnames('music-dock-volume-step music-dock-volume-mute', isMuted && 'music-dock-volume-mute-active')}
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <AiOutlineAudioMuted /> : <AiOutlineSound />}
                </button>
                <button className="music-dock-volume-step" type="button" onClick={() => stepVolume(-1)} aria-label="Lower volume">
                  <AiOutlineMinus />
                </button>
                <div
                  ref={volumeKnobRef}
                  className={classnames('music-dock-volume-knob', isAdjustingVolume && 'music-dock-volume-knob-active')}
                  style={knobStyle}
                  role="slider"
                  aria-label="Volume control"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={safeVolume}
                  tabIndex={0}
                  onPointerDown={handleKnobPointerDown}
                  onKeyDown={handleKnobKeyDown}
                >
                  <span>{safeVolume}%</span>
                  <small>VOL</small>
                </div>
                <button className="music-dock-volume-step" type="button" onClick={() => stepVolume(1)} aria-label="Increase volume">
                  <AiOutlinePlus />
                </button>
              </div>
              <strong>{safeVolume}%</strong>
            </label>
          </>
        ) : (
          <p className="music-dock-empty">Drop tracks into `public/music` to start playback.</p>
        )}
      </section>

      <aside className={classnames('music-dock-list-panel', isTrackListPanelOpen && 'music-dock-list-panel-open')} aria-hidden={!isTrackListPanelOpen}>
        <div className="music-dock-list-panel-head">
          <h4>Track List</h4>
          <span>{tracks.length}</span>
        </div>
        {hasTracks ? (
          <div className="music-dock-list">
            <ul>
              {tracks.map((track, index) => {
                const isActive = index === activeTrackIndex;
                return (
                  <li key={track.id}>
                    <button
                      className={classnames('music-dock-track-btn', isActive && 'music-dock-track-btn-active')}
                      type="button"
                      onClick={() => selectTrackAtIndex(index)}
                    >
                      <strong>{track.title}</strong>
                      <span>{track.artist}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="music-dock-empty">No tracks available.</p>
        )}
      </aside>

      <audio
        autoPlay={true}
        loop={tracks.length === 1 || isRepeatOneEnabled}
        muted={isMuted}
        preload="metadata"
        ref={audioRef}
        src={activeTrack?.src}
        onEnded={handleTrackEnd}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
      />

      {isClient && nowPlayingToast
        ? createPortal(
            <div className="music-now-playing-toast" role="status" aria-live="polite">
              <img src={nowPlayingToast.artSrc || GENERIC_ART_SRC} alt={`${nowPlayingToast.title} art`} />
              <div>
                <strong>Now Playing</strong>
                <span>{nowPlayingToast.title}</span>
                <small>{nowPlayingToast.artist}</small>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
