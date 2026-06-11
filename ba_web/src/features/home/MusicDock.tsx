'use client';

import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import classnames from 'classnames';
import {
  AiOutlineClose,
  AiOutlineMuted,
  AiOutlinePauseCircle,
  AiOutlinePlayCircle,
  AiOutlineStepBackward,
  AiOutlineStepForward,
  AiOutlineSound,
} from 'react-icons/ai';
import { IoMdList, IoMdMusicalNote } from 'react-icons/io';

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  artSrc?: string | null;
};

type Props = {
  tracks: MusicTrack[];
  isMuted: boolean;
  volume: number;
  showLauncher?: boolean;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
};

const GENERIC_ART_SRC = '/music/art/generic-cover.svg';
const TRACKLIST_VISUALIZER_BARS = 18;

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const sec = Math.floor(seconds);
  const minutes = Math.floor(sec / 60);
  const remainder = sec % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

export function MusicDock(props: Props) {
  const { tracks, isMuted, volume, showLauncher = true, onToggleMute, onVolumeChange } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [isTrackListMode, setIsTrackListMode] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);
  const [showNowPlayingToast, setShowNowPlayingToast] = useState(false);
  const [isNowPlayingToastExiting, setIsNowPlayingToastExiting] = useState(false);
  const toastExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrack = tracks[activeTrackIndex] ?? null;
  const cover = activeTrack?.artSrc || GENERIC_ART_SRC;

  const revealNowPlayingToast = () => {
    if (!activeTrack) return;

    if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
    if (toastRemoveTimerRef.current) clearTimeout(toastRemoveTimerRef.current);

    setShowNowPlayingToast(true);
    setIsNowPlayingToastExiting(false);
    toastExitTimerRef.current = setTimeout(() => {
      setIsNowPlayingToastExiting(true);
      toastRemoveTimerRef.current = setTimeout(() => {
        setShowNowPlayingToast(false);
        setIsNowPlayingToastExiting(false);
      }, 360);
    }, 4200);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = Math.min(1, Math.max(0, volume / 100));
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack || isMuted) {
      setPendingAutoplay(false);
      return;
    }

    const tryAutoplay = () => {
      if (!audio.paused) {
        setPendingAutoplay(false);
        return;
      }

      void audio
        .play()
        .then(() => {
          setPendingAutoplay(false);
        })
        .catch(() => {
          setPendingAutoplay(true);
        });
    };

    tryAutoplay();
  }, [activeTrack?.src, isMuted]);

  useEffect(() => {
    revealNowPlayingToast();

    return () => {
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
      if (toastRemoveTimerRef.current) clearTimeout(toastRemoveTimerRef.current);
    };
  }, [activeTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  useEffect(() => {
    if (!pendingAutoplay) {
      return;
    }

    const retryAutoplay = () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      setPendingAutoplay(false);
      void audio.play().catch(() => {
        setPendingAutoplay(true);
      });
    };

    window.addEventListener('pointerdown', retryAutoplay, { once: true });
    window.addEventListener('keydown', retryAutoplay, { once: true });

    return () => {
      window.removeEventListener('pointerdown', retryAutoplay);
      window.removeEventListener('keydown', retryAutoplay);
    };
  }, [pendingAutoplay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
      revealNowPlayingToast();
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handlePrevious = () => {
    setActiveTrackIndex((current) => (tracks.length ? (current - 1 + tracks.length) % tracks.length : current));
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleNext = () => {
    setActiveTrackIndex((current) => (tracks.length ? (current + 1) % tracks.length : current));
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const selectTrackAtIndex = (trackIndex: number) => {
    setActiveTrackIndex(trackIndex);
    setCurrentTime(0);
    setIsPlaying(true);
    setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      void audio.play().catch(() => {});
    }, 0);
  };

  const stepVolume = (delta: number) => {
    onVolumeChange(Math.min(100, Math.max(0, volume + delta)));
  };

  const handleAudioPlay = () => {
    setIsPlaying(true);
    revealNowPlayingToast();
  };

  const knobStyle: React.CSSProperties = {
    '--music-knob-sweep': `${Math.round((Math.max(0, Math.min(volume, 100)) / 100) * 240)}deg`,
  } as React.CSSProperties;

  const nowPlayingToast =
    showNowPlayingToast && activeTrack && typeof document !== 'undefined'
      ? createPortal(
          <aside
            className={classnames('music-now-playing-toast', isNowPlayingToastExiting && 'exit')}
            aria-live="polite"
          >
            <img src={cover} alt="" aria-hidden="true" />
            <div>
              <span>Now playing</span>
              <strong>{activeTrack.title}</strong>
              <small>{activeTrack.artist}</small>
            </div>
          </aside>,
          document.body
        )
      : null;

  return (
    <>
      <div className={classnames('music-dock', isOpen && 'music-dock-open')}>
      {!isOpen && showLauncher && (
        <button className="music-dock-toggle" type="button" onClick={() => setIsOpen(true)} aria-label="Open music player">
          <IoMdMusicalNote />
        </button>
      )}

      <section className="music-dock-panel" aria-hidden={!isOpen}>
        <header className="music-dock-head">
          <h3>Music Player</h3>
          <div className="music-dock-head-actions">
            <span>{tracks.length ? `${activeTrackIndex + 1} of ${tracks.length}` : 'No tracks'}</span>
            <button
              className={classnames('music-dock-head-btn', isTrackListMode && 'music-dock-head-btn-active')}
              type="button"
              onClick={() => setIsTrackListMode((current) => !current)}
              aria-label="Toggle track list view"
            >
              <IoMdList />
            </button>
            <button className="music-dock-head-btn" type="button" onClick={() => setIsOpen(false)} aria-label="Close music player">
              <AiOutlineClose />
            </button>
          </div>
        </header>

        {isTrackListMode ? (
          <div className="music-dock-tracklist-view">
            <div className={classnames('music-dock-tracklist-row', isPlaying && 'music-dock-tracklist-row-playing')}>
              <div className="music-dock-tracklist-visualizer" aria-hidden="true">
                {Array.from({ length: TRACKLIST_VISUALIZER_BARS }, (_, barIndex) => (
                  <span key={barIndex} />
                ))}
              </div>
              <div className="music-dock-tracklist-art-wrap">
                <img src={cover} alt={activeTrack ? `${activeTrack.title} artwork` : 'No track artwork'} className="music-dock-tracklist-art" />
              </div>
              <div className="music-dock-tracklist-meta">
                <strong>{activeTrack?.title || 'Select a track'}</strong>
                <span>{activeTrack?.artist || 'Tap any track to play'}</span>
              </div>
              <button className="music-dock-icon-btn music-dock-icon-btn-main" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <AiOutlinePauseCircle /> : <AiOutlinePlayCircle />}
              </button>
            </div>

            <div className="music-dock-expanded-list">
              <div className="music-dock-expanded-list-head">
                <h4>Track List</h4>
                <span>{tracks.length} tracks</span>
              </div>
              {tracks.length ? (
                <ul>
                  {tracks.map((track, trackIndex) => (
                    <li key={track.id}>
                      <button
                        type="button"
                        className={classnames('music-dock-track-btn', trackIndex === activeTrackIndex && 'music-dock-track-btn-active')}
                        onClick={() => selectTrackAtIndex(trackIndex)}
                        aria-current={trackIndex === activeTrackIndex ? 'true' : undefined}
                      >
                        <span className="music-dock-track-btn-index">{String(trackIndex + 1).padStart(2, '0')}</span>
                        <span className="music-dock-track-btn-copy">
                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>
                        </span>
                        {trackIndex === activeTrackIndex ? (
                          <span className={classnames('music-dock-track-btn-playing', isPlaying && 'is-playing')} aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="music-dock-empty">No tracks available.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="music-dock-now-playing">
              <div className="music-dock-art-wrap">
                <img src={cover} alt={activeTrack ? `${activeTrack.title} artwork` : 'No track artwork'} className="music-dock-art" />
              </div>
              <div className="music-dock-track-meta">
                <strong>{activeTrack?.title || 'Select a track'}</strong>
                <span>{activeTrack?.artist || 'Tracks will appear in the list below'}</span>
              </div>
            </div>

            <div className="music-dock-control-deck">
              <div className="music-dock-transport-row">
                <button className="music-dock-icon-btn" type="button" onClick={handlePrevious} aria-label="Previous track">
                  <AiOutlineStepBackward />
                </button>
                <button className="music-dock-icon-btn music-dock-icon-btn-main" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <AiOutlinePauseCircle /> : <AiOutlinePlayCircle />}
                </button>
                <button className="music-dock-icon-btn" type="button" onClick={handleNext} aria-label="Next track">
                  <AiOutlineStepForward />
                </button>
              </div>
            </div>

            {activeTrack ? (
              <>
                <label className="music-dock-progress">
                  <span>Progress</span>
                  <div className="music-dock-progress-shell">
                    <div className="music-dock-progress-track">
                      <span className="music-dock-progress-center" />
                      <span
                        className="music-dock-progress-fill music-dock-progress-fill-left"
                        style={{ width: `${Math.min(50, duration > 0 ? (currentTime / duration) * 50 : 0)}%` }}
                      />
                      <span
                        className="music-dock-progress-fill music-dock-progress-fill-right"
                        style={{ width: `${Math.min(50, duration > 0 ? (currentTime / duration) * 50 : 0)}%` }}
                      />
                      <span className="music-dock-progress-cursor" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                    </div>
                    <input
                      className="music-dock-progress-hitbox"
                      type="range"
                      min={0}
                      max={Math.round(duration || 0)}
                      step={1}
                      value={Math.round(currentTime || 0)}
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
                      className={classnames('music-dock-volume-step', isMuted && 'music-dock-volume-mute-active')}
                      type="button"
                      onClick={onToggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <AiOutlineMuted /> : <AiOutlineSound />}
                    </button>
                    <button className="music-dock-volume-step" type="button" onClick={() => stepVolume(-10)} aria-label="Lower volume">
                      -
                    </button>
                    <div className={classnames('music-dock-volume-knob', isMuted && 'music-dock-volume-mute-active')} style={knobStyle}>
                      <span>{volume}%</span>
                      <small>VOL</small>
                    </div>
                    <button className="music-dock-volume-step" type="button" onClick={() => stepVolume(10)} aria-label="Raise volume">
                      +
                    </button>
                  </div>
                  <strong>{volume}%</strong>
                </label>
              </>
            ) : null}
          </>
        )}
      </section>

      <audio
        ref={audioRef}
        src={activeTrack?.src}
        autoPlay={!isMuted}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={handleAudioPlay}
      />
      </div>
      {nowPlayingToast}
    </>
  );
}
