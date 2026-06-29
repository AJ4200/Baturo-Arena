'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, MoleBashState, PlayerProfile } from '@/types/game';

type SoloMoleBashGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const GRID_SIZE = 9;
const ROUND_TIME_MS = 35000;
const TARGET_SCORE = 24;
const MAX_STRIKES = 5;
const BEST_SCORE_STORAGE_KEY = 'baturo_mole_bash_best_score';
const BEST_COMBO_STORAGE_KEY = 'baturo_mole_bash_best_combo';

const createInitialState = (bestScore = 0, bestCombo = 0): MoleBashState => ({
  status: 'ready',
  score: 0,
  bestScore,
  combo: 0,
  bestCombo,
  strikes: 0,
  hits: 0,
  misses: 0,
  timeLeftMs: ROUND_TIME_MS,
  holes: [],
  nextSpawnAt: 0,
  round: 1,
  event: 'Ready',
});

const getStatusLabel = (state: MoleBashState): string => {
  if (state.status === 'won') return 'Cleared';
  if (state.status === 'lost') return 'Round Over';
  if (state.status === 'playing') return 'Live';
  return 'Ready';
};

const formatTime = (timeLeftMs: number): string => {
  const seconds = Math.max(0, Math.ceil(timeLeftMs / 1000));
  return `${seconds}s`;
};

const getSpawnDelay = (score: number): number =>
  Math.max(360, 860 - score * 14) + Math.floor(Math.random() * 160);

const getHoleLifetime = (score: number): number =>
  Math.max(620, 1120 - score * 12);

const spawnHoles = (state: MoleBashState, now: number): MoleBashState => {
  const liveHoles = state.holes.filter((hole) => hole.expiresAt > now);
  const occupied = new Set(liveHoles.map((hole) => hole.index));
  const available = Array.from({ length: GRID_SIZE }, (_, index) => index).filter(
    (index) => !occupied.has(index)
  );

  if (available.length === 0) {
    return {
      ...state,
      holes: liveHoles,
      nextSpawnAt: now + getSpawnDelay(state.score),
    };
  }

  const spawnCount = state.score >= 10 && available.length > 1 && Math.random() > 0.52 ? 2 : 1;
  const nextHoles = [...liveHoles];

  for (let count = 0; count < spawnCount && available.length > 0; count += 1) {
    const poolIndex = Math.floor(Math.random() * available.length);
    const index = available[poolIndex];
    available.splice(poolIndex, 1);
    if (typeof index !== 'number') {
      continue;
    }

    const kind = state.score >= 7 && Math.random() < 0.24 ? 'decoy' : 'mole';
    nextHoles.push({
      index,
      kind,
      expiresAt: now + getHoleLifetime(state.score),
      hit: false,
    });
  }

  return {
    ...state,
    holes: nextHoles,
    nextSpawnAt: now + getSpawnDelay(state.score),
  };
};

const tickState = (state: MoleBashState, now: number, deltaMs: number): MoleBashState => {
  if (state.status !== 'playing') {
    return state;
  }

  const expiredMoles = state.holes.filter(
    (hole) => !hole.hit && hole.kind === 'mole' && hole.expiresAt <= now
  ).length;
  const liveHoles = state.holes.filter((hole) => hole.expiresAt > now);
  const nextStrikes = Math.min(MAX_STRIKES, state.strikes + expiredMoles);
  const timeLeftMs = Math.max(0, state.timeLeftMs - deltaMs);
  const timedOut = timeLeftMs <= 0 && state.score < TARGET_SCORE;
  const struckOut = nextStrikes >= MAX_STRIKES;

  let nextState: MoleBashState = {
    ...state,
    holes: liveHoles,
    strikes: nextStrikes,
    misses: state.misses + expiredMoles,
    combo: expiredMoles > 0 ? 0 : state.combo,
    timeLeftMs,
    event: expiredMoles > 0 ? 'Mole slipped away' : state.event,
  };

  if (timedOut || struckOut) {
    return {
      ...nextState,
      status: 'lost',
      holes: [],
      event: struckOut ? 'Too many misses' : 'Time expired',
    };
  }

  if (now >= nextState.nextSpawnAt) {
    nextState = spawnHoles(nextState, now);
  }

  return nextState;
};

export function SoloMoleBashGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMoleBashGameProps) {
  const [state, setState] = useState<MoleBashState>(() => createInitialState());
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastTickRef = useRef<number | null>(null);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('mole-bash', gameDefinitions);

  const startRound = useCallback(() => {
    lastTickRef.current = null;
    lastReportedOutcomeRef.current = null;
    setState((current) => ({
      ...createInitialState(current.bestScore, current.bestCombo),
      status: 'playing',
      nextSpawnAt: Date.now() + 260,
      round: current.round + (current.status === 'ready' ? 0 : 1),
      event: 'Round live',
    }));
  }, []);

  const handleRestart = useCallback(() => {
    lastTickRef.current = null;
    lastReportedOutcomeRef.current = null;
    setState((current) => createInitialState(current.bestScore, current.bestCombo));
  }, []);

  const hitHole = useCallback((index: number) => {
    setState((current) => {
      if (current.status !== 'playing') {
        return current;
      }

      const now = Date.now();
      const target = current.holes.find((hole) => hole.index === index && !hole.hit);
      if (!target) {
        const strikes = Math.min(MAX_STRIKES, current.strikes + 1);
        return {
          ...current,
          strikes,
          misses: current.misses + 1,
          combo: 0,
          status: strikes >= MAX_STRIKES ? 'lost' : current.status,
          holes: current.holes.filter((hole) => hole.expiresAt > now),
          event: strikes >= MAX_STRIKES ? 'Too many misses' : 'Empty hole',
        };
      }

      const holes = current.holes.map((hole) =>
        hole.index === index
          ? {
              ...hole,
              hit: true,
              expiresAt: now + 220,
            }
          : hole
      );

      if (target.kind === 'decoy') {
        const strikes = Math.min(MAX_STRIKES, current.strikes + 1);
        return {
          ...current,
          holes,
          score: Math.max(0, current.score - 2),
          strikes,
          combo: 0,
          status: strikes >= MAX_STRIKES ? 'lost' : current.status,
          event: strikes >= MAX_STRIKES ? 'Too many decoys' : 'Decoy hit',
        };
      }

      const combo = current.combo + 1;
      const scoreGain = combo > 0 && combo % 5 === 0 ? 3 : 1;
      const score = current.score + scoreGain;
      const bestScore = Math.max(current.bestScore, score);
      const bestCombo = Math.max(current.bestCombo, combo);

      return {
        ...current,
        holes,
        score,
        bestScore,
        combo,
        bestCombo,
        hits: current.hits + 1,
        status: score >= TARGET_SCORE ? 'won' : current.status,
        event: scoreGain > 1 ? 'Combo bonus' : 'Direct hit',
      };
    });
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    const storedCombo =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_COMBO_STORAGE_KEY) || '0', 10)
        : 0;

    setState((current) => ({
      ...current,
      bestScore: Number.isFinite(storedBest) ? storedBest : 0,
      bestCombo: Number.isFinite(storedCombo) ? storedCombo : 0,
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.bestScore));
    window.localStorage.setItem(BEST_COMBO_STORAGE_KEY, String(state.bestCombo));
  }, [state.bestCombo, state.bestScore]);

  useEffect(() => {
    if (state.status !== 'playing') {
      lastTickRef.current = null;
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const deltaMs = lastTickRef.current === null ? 100 : Math.min(now - lastTickRef.current, 220);
      lastTickRef.current = now;
      setState((current) => tickState(current, now, deltaMs));
    }, 90);

    return () => window.clearInterval(intervalId);
  }, [state.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const numeric = Number.parseInt(key, 10);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= GRID_SIZE) {
        event.preventDefault();
        if (!event.repeat) {
          hitHole(numeric - 1);
        }
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        if (!event.repeat) {
          handleRestart();
        }
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat && state.status !== 'playing') {
          startRound();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestart, hitHole, startRound, state.status]);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'mole-bash',
        outcome: 'win',
        opponent: 'Mole Rush',
      });
    }

    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'mole-bash',
        outcome: 'loss',
        opponent: 'Mole Rush',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'holes',
      title: 'Holes',
      layout: 'numpad' as const,
      buttons: Array.from({ length: GRID_SIZE }, (_, index) => ({
        key: `hole-${index}`,
        label: `Hole ${index + 1}`,
        icon: <span>{index + 1}</span>,
        onClick: () => hitHole(index),
        disabled: state.status !== 'playing',
      })),
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'start',
          label: state.status === 'playing' ? 'Live' : 'Start',
          icon: <AiOutlinePlayCircle />,
          onClick: startRound,
          disabled: state.status === 'playing',
        },
        { key: 'restart', label: 'Reset', icon: <AiOutlineReload />, onClick: handleRestart },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Mole Bash" subtitle="Tap active holes" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button className="room-float-collapsed-center" type="button" onClick={() => setIsInfoCardCollapsed(false)} aria-label="Expand game info">
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Arcade</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line">
                  {state.status === 'won' ? <AiOutlineCheckCircle /> : state.status === 'lost' ? <AiOutlineCloseCircle /> : <AiOutlinePlayCircle />}
                  {getStatusLabel(state)}
                </span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.score} / {TARGET_SCORE}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{state.bestScore}</strong></div>
                <div className="solo-float-stat"><span>Combo</span><strong>{state.combo}</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{formatTime(state.timeLeftMs)}</strong></div>
                <div className="solo-float-stat"><span>Strikes</span><strong>{state.strikes} / {MAX_STRIKES}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={startRound} disabled={state.status === 'playing'}>
                  <AiOutlinePlayCircle /> Start
                </button>
                <button className="room-float-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Reset
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="room-float-action-btn room-float-action-btn-danger" type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="mole-bash-shell">
        <div className="mole-bash-hud">
          <div className="mole-bash-hud-item"><span>Score</span><strong>{state.score} / {TARGET_SCORE}</strong></div>
          <div className="mole-bash-hud-item"><span>Time</span><strong>{formatTime(state.timeLeftMs)}</strong></div>
          <div className="mole-bash-hud-item"><span>Combo</span><strong>{state.combo}</strong></div>
          <div className="mole-bash-hud-item"><span>Strikes</span><strong>{state.strikes} / {MAX_STRIKES}</strong></div>
        </div>

        <div className="mole-bash-board-wrap">
          <div className="mole-bash-board" role="grid" aria-label="Mole Bash holes">
            {Array.from({ length: GRID_SIZE }, (_, index) => {
              const activeHole = state.holes.find((hole) => hole.index === index);
              return (
                <button
                  key={index}
                  type="button"
                  className={classnames(
                    'mole-bash-hole',
                    activeHole?.kind === 'mole' && 'mole-bash-hole-mole',
                    activeHole?.kind === 'decoy' && 'mole-bash-hole-decoy',
                    activeHole?.hit && 'mole-bash-hole-hit'
                  )}
                  onClick={() => hitHole(index)}
                  disabled={state.status !== 'playing'}
                  aria-label={`Hole ${index + 1}`}
                >
                  <span className="mole-bash-hole-shadow" />
                  <span className="mole-bash-target">
                    {activeHole?.kind === 'decoy' ? '!' : activeHole?.kind === 'mole' ? 'M' : index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {state.status !== 'playing' ? (
            <div className="mole-bash-overlay">
              <div className="mole-bash-message">
                <span className="mole-bash-status-pill">{getStatusLabel(state)}</span>
                <h2>{state.status === 'won' ? 'Mole rush cleared' : state.status === 'lost' ? 'Rush got away' : 'Ready to bash'}</h2>
                <p>
                  {state.status === 'won'
                    ? `Score ${state.score}, best combo ${state.bestCombo}.`
                    : state.status === 'lost'
                      ? `Score ${state.score}. Hit ${TARGET_SCORE} before time or strikes run out.`
                      : `Hit ${TARGET_SCORE} moles before the clock runs out.`}
                </p>
                <button className="mole-bash-action-btn" type="button" onClick={startRound}>
                  <AiOutlinePlayCircle /> {state.status === 'ready' ? 'Start' : 'Play Again'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mole-bash-actions">
          <button className="mole-bash-action-btn" type="button" onClick={startRound} disabled={state.status === 'playing'}>
            <AiOutlinePlayCircle /> Start
          </button>
          <button className="mole-bash-action-btn" type="button" onClick={handleRestart}>
            <AiOutlineReload /> Reset
          </button>
        </div>

        <p className="mole-bash-message-inline">{state.event}</p>
      </section>
    </>
  );
}
