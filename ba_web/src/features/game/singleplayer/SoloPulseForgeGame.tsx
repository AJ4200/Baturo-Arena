'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay, type ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloPulseForgeGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type ForgePhase = 'running' | 'won' | 'lost';

type ForgeLane = {
  id: string;
  label: string;
  shortLabel: string;
  charge: number;
  heat: number;
  accent: string;
};

type ForgeState = {
  phase: ForgePhase;
  lanes: ForgeLane[];
  timeLeftMs: number;
  integrity: number;
  forged: number;
  streak: number;
  score: number;
  event: string;
};

const TARGET_PULSES = 12;
const REACTOR_TIME_MS = 76_000;
const BEST_SCORE_STORAGE_KEY = 'baturo_pulse_forge_best_score';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createInitialLanes = (): ForgeLane[] => [
  { id: 'ember', label: 'Ember', shortLabel: 'E', charge: 34, heat: 18, accent: '#f97316' },
  { id: 'ion', label: 'Ion', shortLabel: 'I', charge: 48, heat: 24, accent: '#22d3ee' },
  { id: 'verdant', label: 'Verdant', shortLabel: 'V', charge: 27, heat: 14, accent: '#22c55e' },
  { id: 'nova', label: 'Nova', shortLabel: 'N', charge: 42, heat: 28, accent: '#f472b6' },
];

const createInitialState = (): ForgeState => ({
  phase: 'running',
  lanes: createInitialLanes(),
  timeLeftMs: REACTOR_TIME_MS,
  integrity: 100,
  forged: 0,
  streak: 0,
  score: 0,
  event: 'Charge a lane, vent heat, then forge when the pulse window is clean.',
});

const formatTime = (timeMs: number) => `${Math.ceil(timeMs / 1000)}s`;

export function SoloPulseForgeGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloPulseForgeGameProps) {
  const [state, setState] = useState<ForgeState>(() => createInitialState());
  const [selectedLaneIndex, setSelectedLaneIndex] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const reportedPhaseRef = useRef<ForgePhase | null>(null);
  const gameLabel = formatGameName('pulse-forge', gameDefinitions);
  const selectedLane = state.lanes[selectedLaneIndex] || state.lanes[0];
  const progressPercent = Math.min(100, (state.forged / TARGET_PULSES) * 100);
  const statusLabel =
    state.phase === 'won'
      ? 'Core Stable'
      : state.phase === 'lost'
        ? 'Core Breach'
        : state.integrity < 34
          ? 'Critical'
          : 'Forging';

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    lastFrameRef.current = null;
    setSelectedLaneIndex(0);
    setState(createInitialState());
  }, []);

  const selectLane = useCallback((index: number) => {
    setSelectedLaneIndex(clamp(index, 0, 3));
  }, []);

  const shiftLane = useCallback((direction: -1 | 1) => {
    setSelectedLaneIndex((current) => (current + direction + 4) % 4);
  }, []);

  const forgePulse = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'running') {
        return current;
      }

      const lane = current.lanes[selectedLaneIndex];
      if (!lane) {
        return current;
      }

      const isCleanForge = lane.charge >= 72 && lane.heat <= 86;
      const nextLanes = current.lanes.map((entry, index) => {
        if (index !== selectedLaneIndex) {
          return entry;
        }

        return isCleanForge
          ? { ...entry, charge: 12, heat: clamp(entry.heat + 13, 0, 100) }
          : { ...entry, charge: clamp(entry.charge - 22, 0, 100), heat: clamp(entry.heat + 16, 0, 100) };
      });

      if (!isCleanForge) {
        const integrity = clamp(current.integrity - 15, 0, 100);
        return {
          ...current,
          phase: integrity <= 0 ? 'lost' : 'running',
          lanes: nextLanes,
          integrity,
          streak: 0,
          event: lane.charge < 72 ? `${lane.label} was undercharged. The pulse scattered.` : `${lane.label} overheated. Vent before forging.`,
        };
      }

      const streak = current.streak + 1;
      const forged = current.forged + 1;
      const score = current.score + 120 + Math.round(lane.charge) + streak * 28 + Math.max(0, 86 - Math.round(lane.heat));
      return {
        ...current,
        phase: forged >= TARGET_PULSES ? 'won' : 'running',
        lanes: nextLanes,
        forged,
        streak,
        score,
        integrity: clamp(current.integrity + 3, 0, 100),
        event: forged >= TARGET_PULSES ? 'Pulse lattice locked. The reactor is stable.' : `${lane.label} pulse forged clean. Streak x${streak}.`,
      };
    });
  }, [selectedLaneIndex]);

  const ventLane = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'running') {
        return current;
      }

      const lane = current.lanes[selectedLaneIndex];
      const nextLanes = current.lanes.map((entry, index) =>
        index === selectedLaneIndex
          ? { ...entry, charge: clamp(entry.charge - 12, 0, 100), heat: clamp(entry.heat - 32, 0, 100) }
          : entry
      );

      return {
        ...current,
        lanes: nextLanes,
        event: `${lane.label} vented. Heat dropped, charge dipped.`,
      };
    });
  }, [selectedLaneIndex]);

  const stabilizeGrid = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'running') {
        return current;
      }

      return {
        ...current,
        lanes: current.lanes.map((lane) => ({
          ...lane,
          charge: clamp(lane.charge - 8, 0, 100),
          heat: clamp(lane.heat - 14, 0, 100),
        })),
        integrity: clamp(current.integrity + 4, 0, 100),
        streak: Math.max(0, current.streak - 1),
        event: 'Grid stabilized. Safer lanes, softer streak.',
      };
    });
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (state.score <= bestScore || typeof window === 'undefined') {
      return;
    }

    setBestScore(state.score);
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.score));
  }, [bestScore, state.score]);

  useEffect(() => {
    if (state.phase === 'running') {
      return;
    }

    if (reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'pulse-forge',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Pulse Reactor',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const step = (now: number) => {
      setState((current) => {
        if (lastFrameRef.current === null) {
          lastFrameRef.current = now;
          return current;
        }

        const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.04);
        lastFrameRef.current = now;
        if (current.phase !== 'running') {
          return current;
        }

        const elapsedSeconds = (REACTOR_TIME_MS - current.timeLeftMs) / 1000;
        let heatDamage = 0;
        const lanes = current.lanes.map((lane, index) => {
          const flux = 1 + Math.sin(elapsedSeconds * 1.35 + index * 1.7) * 0.2;
          const nextCharge = clamp(lane.charge + deltaSeconds * (7.4 + index * 0.6) * flux, 0, 100);
          const heatGain = nextCharge > 82 ? 6.8 : nextCharge > 64 ? 3.9 : 1.9;
          const nextHeat = clamp(lane.heat + deltaSeconds * heatGain - deltaSeconds * 2.5, 0, 100);
          if (nextHeat > 94) {
            heatDamage += (nextHeat - 93) * deltaSeconds * 0.42;
          }
          return { ...lane, charge: nextCharge, heat: nextHeat };
        });

        const timeLeftMs = Math.max(0, current.timeLeftMs - deltaSeconds * 1000);
        const integrity = clamp(current.integrity - heatDamage, 0, 100);
        const phase = timeLeftMs <= 0 || integrity <= 0 ? 'lost' : current.phase;
        return {
          ...current,
          phase,
          lanes,
          timeLeftMs,
          integrity,
          event: phase === 'lost' ? 'The reactor window collapsed before the pulse lattice stabilized.' : current.event,
        };
      });

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['1', '2', '3', '4'].includes(key)) {
        event.preventDefault();
        selectLane(Number.parseInt(key, 10) - 1);
        return;
      }

      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        shiftLane(-1);
        return;
      }

      if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        shiftLane(1);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) {
          forgePulse();
        }
        return;
      }

      if (key === 'v') {
        event.preventDefault();
        ventLane();
        return;
      }

      if (key === 's') {
        event.preventDefault();
        stabilizeGrid();
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [forgePulse, resetGame, selectLane, shiftLane, stabilizeGrid, ventLane]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'lane-select',
        title: 'Energy Lanes',
        layout: 'row',
        buttons: state.lanes.map((lane, index) => ({
          key: lane.id,
          label: selectedLaneIndex === index ? `${lane.shortLabel} Ready` : lane.shortLabel,
          icon: <AiOutlineThunderbolt />,
          onClick: () => selectLane(index),
          disabled: state.phase !== 'running',
        })),
      },
      {
        key: 'forge-actions',
        title: 'Forge Console',
        layout: 'row',
        buttons: [
          {
            key: 'previous',
            label: 'Prev',
            icon: <AiOutlineArrowLeft />,
            onClick: () => shiftLane(-1),
            disabled: state.phase !== 'running',
          },
          {
            key: 'forge',
            label: 'Forge',
            icon: <AiOutlinePlayCircle />,
            onClick: forgePulse,
            disabled: state.phase !== 'running',
          },
          {
            key: 'vent',
            label: 'Vent',
            icon: <AiOutlineArrowDown />,
            onClick: ventLane,
            disabled: state.phase !== 'running',
          },
          {
            key: 'next',
            label: 'Next',
            icon: <AiOutlineArrowRight />,
            onClick: () => shiftLane(1),
            disabled: state.phase !== 'running',
          },
          {
            key: 'stabilize',
            label: 'Stabilize',
            icon: <AiOutlineCheckCircle />,
            onClick: stabilizeGrid,
            disabled: state.phase !== 'running',
          },
          {
            key: 'reset',
            label: 'Reset',
            icon: <AiOutlineReload />,
            onClick: resetGame,
          },
        ],
      },
    ],
    [forgePulse, resetGame, selectLane, selectedLaneIndex, shiftLane, stabilizeGrid, state.lanes, state.phase, ventLane]
  );

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Select a lane, vent heat, and forge clean pulses before time expires"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.2, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand game info"
              title="Expand game info"
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor">
                  <AiOutlineDrag /> drag
                </span>
                <span className="room-float-title">
                  <AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse game info"
                  title="Collapse game info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Player</span>
                  <strong>{player.name}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Status</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Pulses</span>
                  <strong>{state.forged}/{TARGET_PULSES}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Integrity</span>
                  <strong>{Math.round(state.integrity)}%</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{formatTime(state.timeLeftMs)}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={resetGame}>
                  <AiOutlineReload /> New Run
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

      <section className="pulse-forge-shell">
        <div className="pulse-forge-hud">
          <div className="pulse-forge-hud-card">
            <span>Pulses</span>
            <strong>{state.forged}/{TARGET_PULSES}</strong>
          </div>
          <div className="pulse-forge-hud-card">
            <span>Integrity</span>
            <strong>{Math.round(state.integrity)}%</strong>
          </div>
          <div className="pulse-forge-hud-card">
            <span>Streak</span>
            <strong>x{state.streak}</strong>
          </div>
          <div className="pulse-forge-hud-card">
            <span>Time</span>
            <strong>{formatTime(state.timeLeftMs)}</strong>
          </div>
        </div>

        <div className="pulse-forge-reactor">
          <div className="pulse-forge-core" style={{ '--forge-progress': `${progressPercent}%` } as React.CSSProperties}>
            <span>{state.phase === 'won' ? 'Stable' : state.phase === 'lost' ? 'Breach' : `${Math.round(progressPercent)}%`}</span>
          </div>
          <div className="pulse-forge-core-rings" aria-hidden="true" />
        </div>

        <div className="pulse-forge-lanes" aria-label="Pulse forge lanes">
          {state.lanes.map((lane, index) => {
            const isSelected = selectedLaneIndex === index;
            const isForgeReady = lane.charge >= 72 && lane.heat <= 86;
            const isDanger = lane.heat > 86;
            return (
              <button
                key={lane.id}
                className={classnames(
                  'pulse-forge-lane',
                  isSelected && 'pulse-forge-lane-selected',
                  isForgeReady && 'pulse-forge-lane-ready',
                  isDanger && 'pulse-forge-lane-danger'
                )}
                type="button"
                onClick={() => selectLane(index)}
                style={{ '--lane-accent': lane.accent } as React.CSSProperties}
                disabled={state.phase !== 'running'}
              >
                <span className="pulse-forge-lane-name">{lane.label}</span>
                <span className="pulse-forge-lane-orb">{lane.shortLabel}</span>
                <span className="pulse-forge-meter">
                  <span style={{ height: `${lane.charge}%` }} />
                </span>
                <span className="pulse-forge-heat">
                  <span style={{ width: `${lane.heat}%` }} />
                </span>
                <span className="pulse-forge-lane-readout">
                  {Math.round(lane.charge)}c / {Math.round(lane.heat)}h
                </span>
              </button>
            );
          })}
        </div>

        <div className="pulse-forge-console">
          <button className="pulse-forge-console-btn" type="button" onClick={forgePulse} disabled={state.phase !== 'running'}>
            <AiOutlinePlayCircle /> Forge {selectedLane.label}
          </button>
          <button className="pulse-forge-console-btn" type="button" onClick={ventLane} disabled={state.phase !== 'running'}>
            <AiOutlineArrowDown /> Vent Lane
          </button>
          <button className="pulse-forge-console-btn" type="button" onClick={stabilizeGrid} disabled={state.phase !== 'running'}>
            <AiOutlineCheckCircle /> Stabilize
          </button>
        </div>

        <p className="pulse-forge-event">
          {state.phase === 'running' ? <AiOutlineClockCircle /> : <AiOutlineCheckCircle />} {state.event}
        </p>

        {state.phase !== 'running' ? (
          <div className="pulse-forge-result">
            <strong>{state.phase === 'won' ? 'Pulse Lattice Forged' : 'Reactor Breach'}</strong>
            <span>{state.phase === 'won' ? `Final score ${state.score}. Clean work.` : 'The lattice collapsed. Vent earlier and chase cleaner charge windows.'}</span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> Run Again
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

export default SoloPulseForgeGame;
