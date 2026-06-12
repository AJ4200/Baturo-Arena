'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import {
  SHIP_RADIUS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  TARGET_SCORE,
  advanceStarfallWorld,
  createInitialStarfallWorld,
  formatStarfallTime,
  type StarfallInputState,
  type StarfallWorld,
} from '@/lib/starfallEngine';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloStarfallSurvivorGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type DirectionKey = keyof StarfallInputState;

const BEST_SCORE_STORAGE_KEY = 'baturo_starfall_best_score';

const toPercentX = (x: number) => `${(x / STAGE_WIDTH) * 100}%`;
const toPercentY = (y: number) => `${(y / STAGE_HEIGHT) * 100}%`;
const toPercentSize = (size: number) => `${(size / STAGE_WIDTH) * 100}%`;

export function SoloStarfallSurvivorGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloStarfallSurvivorGameProps) {
  const [world, setWorld] = useState<StarfallWorld>(() => createInitialStarfallWorld());
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const inputRef = useRef<StarfallInputState>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const dashRequestRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const tapTimeoutsRef = useRef<number[]>([]);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);

  const gameLabel = formatGameName('starfall-survivor', gameDefinitions);
  const dashReady = world.ship.dashCooldownMs <= 0;
  const progressPercent = Math.min(100, (world.score / TARGET_SCORE) * 100);
  const shipRotation =
    Math.abs(world.ship.vx) + Math.abs(world.ship.vy) > 2
      ? Math.atan2(world.ship.vy, world.ship.vx) * (180 / Math.PI) + 90
      : 0;
  const statusLabel =
    world.status === 'won'
      ? 'Extraction Locked'
      : world.status === 'lost'
        ? 'Hull Breached'
        : world.timeLeftMs <= 18_000
          ? 'Collapse Zone'
          : 'Shard Run';

  const resetGame = useCallback(() => {
    inputRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    dashRequestRef.current = false;
    lastFrameRef.current = null;
    lastReportedOutcomeRef.current = null;
    setWorld(createInitialStarfallWorld());
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (world.score <= bestScore || typeof window === 'undefined') {
      return;
    }

    setBestScore(world.score);
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(world.score));
  }, [bestScore, world.score]);

  useEffect(() => {
    if (world.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'starfall-survivor',
        outcome: 'win',
        opponent: 'Starfall Rift',
      });
    }

    if (world.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'starfall-survivor',
        outcome: 'loss',
        opponent: 'Starfall Rift',
      });
    }
  }, [onMatchComplete, world.status]);

  const setHeldDirection = useCallback((direction: DirectionKey, active: boolean) => {
    inputRef.current[direction] = active;
  }, []);

  const tapDirection = useCallback(
    (direction: DirectionKey) => {
      setHeldDirection(direction, true);
      if (typeof window === 'undefined') {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        setHeldDirection(direction, false);
      }, 150);
      tapTimeoutsRef.current.push(timeoutId);
    },
    [setHeldDirection]
  );

  const queueDash = useCallback(() => {
    dashRequestRef.current = true;
  }, []);

  useEffect(() => {
    const step = (now: number) => {
      setWorld((currentWorld) => {
        if (lastFrameRef.current === null) {
          lastFrameRef.current = now;
          return currentWorld;
        }

        const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.032);
        lastFrameRef.current = now;
        const nextWorld = advanceStarfallWorld(
          currentWorld,
          deltaSeconds,
          inputRef.current,
          dashRequestRef.current
        );
        dashRequestRef.current = false;
        return nextWorld;
      });

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault();
        setHeldDirection('up', true);
        return;
      }

      if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault();
        setHeldDirection('down', true);
        return;
      }

      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        setHeldDirection('left', true);
        return;
      }

      if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        setHeldDirection('right', true);
        return;
      }

      if (event.code === 'Space' || key === 'shift') {
        event.preventDefault();
        if (!event.repeat) {
          queueDash();
        }
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === 'ArrowUp' || key === 'w') {
        setHeldDirection('up', false);
      } else if (event.key === 'ArrowDown' || key === 's') {
        setHeldDirection('down', false);
      } else if (event.key === 'ArrowLeft' || key === 'a') {
        setHeldDirection('left', false);
      } else if (event.key === 'ArrowRight' || key === 'd') {
        setHeldDirection('right', false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [queueDash, resetGame, setHeldDirection]);

  useEffect(() => {
    return () => {
      tapTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      tapTimeoutsRef.current = [];
    };
  }, []);

  const overlayCopy = useMemo(() => {
    if (world.status === 'won') {
      return {
        title: 'Extraction Complete',
        body: 'The prism skiff broke through the storm with a full shard cache.',
      };
    }

    return {
      title: 'Run Collapsed',
      body: 'The sky won this round. Re-route the skiff and try a cleaner line.',
    };
  }, [world.status]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Flight Vector',
      layout: 'dpad' as const,
      buttons: [
        {
          key: 'up',
          label: 'Up',
          icon: <AiOutlineArrowUp />,
          slot: 'up' as const,
          onClick: () => tapDirection('up'),
          onPointerDown: () => setHeldDirection('up', true),
          onPointerUp: () => setHeldDirection('up', false),
        },
        {
          key: 'left',
          label: 'Left',
          icon: <AiOutlineArrowLeft />,
          slot: 'left' as const,
          onClick: () => tapDirection('left'),
          onPointerDown: () => setHeldDirection('left', true),
          onPointerUp: () => setHeldDirection('left', false),
        },
        {
          key: 'down',
          label: 'Down',
          icon: <AiOutlineArrowDown />,
          slot: 'down' as const,
          onClick: () => tapDirection('down'),
          onPointerDown: () => setHeldDirection('down', true),
          onPointerUp: () => setHeldDirection('down', false),
        },
        {
          key: 'right',
          label: 'Right',
          icon: <AiOutlineArrowRight />,
          slot: 'right' as const,
          onClick: () => tapDirection('right'),
          onPointerDown: () => setHeldDirection('right', true),
          onPointerUp: () => setHeldDirection('right', false),
        },
      ],
    },
    {
      key: 'actions',
      title: 'Thrusters',
      layout: 'row' as const,
      buttons: [
        {
          key: 'dash',
          label: dashReady ? 'Dash' : `${(world.ship.dashCooldownMs / 1000).toFixed(1)}s`,
          icon: <AiOutlineRocket />,
          onClick: queueDash,
          disabled: !dashReady,
        },
        {
          key: 'new-run',
          label: 'New Run',
          icon: <AiOutlineReload />,
          onClick: resetGame,
        },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Steer through the storm, burst with dash, and secure 18 shards"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
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
                  <span>Shards</span>
                  <strong>
                    {world.score}/{TARGET_SCORE}
                  </strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Hull</span>
                  <strong>{world.ship.hull}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{formatStarfallTime(world.timeLeftMs)}</strong>
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

      <section className="starfall-shell">
        <div className="starfall-hud">
          <div className="starfall-hud-card">
            <span>Shard Cache</span>
            <strong>
              {world.score}/{TARGET_SCORE}
            </strong>
          </div>
          <div className="starfall-hud-card">
            <span>Hull</span>
            <strong>{world.ship.hull}</strong>
          </div>
          <div className="starfall-hud-card">
            <span>Threat</span>
            <strong>Level {world.threatLevel}</strong>
          </div>
          <div className="starfall-hud-card">
            <span>Dash</span>
            <strong>{dashReady ? 'Ready' : `${(world.ship.dashCooldownMs / 1000).toFixed(1)}s`}</strong>
          </div>
        </div>

        <div className="starfall-stage-wrap">
          <div className="starfall-stage" aria-label="Starfall Survivor arena">
            <div className="starfall-nebula starfall-nebula-a" aria-hidden="true" />
            <div className="starfall-nebula starfall-nebula-b" aria-hidden="true" />
            <div className="starfall-starfield" aria-hidden="true" />
            <div className="starfall-rift-grid" aria-hidden="true" />

            <div className="starfall-progress-rail" aria-hidden="true">
              <span className="starfall-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            {world.shards.map((shard) => (
              <div
                key={shard.id}
                className="starfall-shard"
                style={{
                  left: toPercentX(shard.x),
                  top: toPercentY(shard.y),
                  width: toPercentSize(shard.radius * 2.2),
                  transform: `translate(-50%, -50%) rotate(${shard.phase * 36}deg)`,
                }}
              />
            ))}

            {world.hazards.map((hazard) => (
              <div
                key={hazard.id}
                className="starfall-comet"
                style={{
                  left: toPercentX(hazard.x),
                  top: toPercentY(hazard.y),
                  width: toPercentSize(hazard.radius * 2.3),
                  '--starfall-comet-hue': `${hazard.hue}`,
                  transform: `translate(-50%, -50%) rotate(${hazard.spin}deg)`,
                } as React.CSSProperties}
              >
                <span className="starfall-comet-tail" aria-hidden="true" />
              </div>
            ))}

            <div
              className={classnames(
                'starfall-ship',
                world.ship.invulnerableMs > 0 && 'starfall-ship-invulnerable',
                dashReady && 'starfall-ship-dash-ready'
              )}
              style={{
                left: toPercentX(world.ship.x),
                top: toPercentY(world.ship.y),
                width: toPercentSize(SHIP_RADIUS * 3.1),
                transform: `translate(-50%, -50%) rotate(${shipRotation}deg)`,
              }}
            >
              <span className="starfall-ship-core" aria-hidden="true" />
              <span className="starfall-ship-thruster" aria-hidden="true" />
            </div>

            <div className="starfall-stage-badges">
              <span className="starfall-stage-badge">{formatStarfallTime(world.timeLeftMs)}</span>
              <span className="starfall-stage-badge">Near Misses {world.nearMisses}</span>
              <span className="starfall-stage-badge">Combo x{Math.max(1, world.combo || 1)}</span>
            </div>

            {world.status !== 'playing' ? (
              <div className="starfall-overlay">
                <div className="starfall-message">
                  <span
                    className={classnames(
                      'starfall-status-pill',
                      world.status === 'won' ? 'starfall-status-pill-win' : 'starfall-status-pill-loss'
                    )}
                  >
                    {world.status === 'won' ? 'Victory' : 'Defeat'}
                  </span>
                  <h2>{overlayCopy.title}</h2>
                  <p>{overlayCopy.body}</p>
                  <div className="starfall-message-actions">
                    <button className="starfall-action-btn" type="button" onClick={resetGame}>
                      <AiOutlineReload /> New Run
                    </button>
                    <button className="starfall-action-btn starfall-action-btn-ghost" type="button" onClick={onLeave}>
                      Leave Arena
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="starfall-inline-hint">
          Collect 18 shards before the rift closes. Near misses buy a sliver of extra time, and dash can punch through narrow escape lanes.
        </p>
      </section>
    </>
  );
}
