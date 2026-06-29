'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile, SlingShotState, SlingShotTarget } from '@/types/game';

type SoloSlingShotGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 520;
const LAUNCH_X = 98;
const LAUNCH_Y = 382;
const GRAVITY = 620;
const PROJECTILE_RADIUS = 13;
const MAX_SHOTS = 5;
const BEST_SCORE_STORAGE_KEY = 'baturo_sling_shot_best_score';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const pct = (value: number, total: number): string => `${(value / total) * 100}%`;

const createTargets = (): SlingShotTarget[] => [
  { id: 1, x: 650, y: 342, width: 44, height: 88, hp: 1 },
  { id: 2, x: 704, y: 300, width: 48, height: 130, hp: 2 },
  { id: 3, x: 766, y: 360, width: 44, height: 70, hp: 1 },
  { id: 4, x: 724, y: 250, width: 52, height: 42, hp: 1 },
];

const createInitialState = (): SlingShotState => ({
  status: 'ready',
  angle: 43,
  power: 64,
  shotsLeft: MAX_SHOTS,
  score: 0,
  targets: createTargets(),
  projectile: null,
});

const shotSpeed = (power: number): number => power * 8.2;

const getStatusLabel = (state: SlingShotState): string => {
  if (state.status === 'won') return 'Cleared';
  if (state.status === 'lost') return 'Out of Shots';
  if (state.status === 'flying') return 'Shot Live';
  if (state.status === 'aiming') return 'Aiming';
  return 'Ready';
};

const intersectsTarget = (
  projectile: NonNullable<SlingShotState['projectile']>,
  target: SlingShotTarget
): boolean => {
  const nearestX = clamp(projectile.x, target.x, target.x + target.width);
  const nearestY = clamp(projectile.y, target.y, target.y + target.height);
  return Math.hypot(projectile.x - nearestX, projectile.y - nearestY) <= PROJECTILE_RADIUS;
};

export function SoloSlingShotGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloSlingShotGameProps) {
  const [state, setState] = useState<SlingShotState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('sling-shot', gameDefinitions);

  const targetsLeft = state.targets.length;
  const trajectoryPoints = useMemo(() => {
    if (state.status === 'flying' || state.status === 'won' || state.status === 'lost') {
      return [];
    }

    const angleRad = (state.angle * Math.PI) / 180;
    const speed = shotSpeed(state.power);
    return Array.from({ length: 11 }, (_, index) => {
      const time = 0.16 + index * 0.105;
      const x = LAUNCH_X + Math.cos(angleRad) * speed * time;
      const y = LAUNCH_Y - Math.sin(angleRad) * speed * time + 0.5 * GRAVITY * time * time;
      return { x, y };
    }).filter((point) => point.x < STAGE_WIDTH && point.y > 0 && point.y < STAGE_HEIGHT);
  }, [state.angle, state.power, state.status]);

  const updateAim = useCallback((angleDelta: number, powerDelta: number) => {
    setState((current) => {
      if (current.status === 'flying' || current.status === 'won' || current.status === 'lost') {
        return current;
      }

      return {
        ...current,
        status: 'aiming',
        angle: clamp(current.angle + angleDelta, 18, 72),
        power: clamp(current.power + powerDelta, 32, 92),
      };
    });
  }, []);

  const handleLaunch = useCallback(() => {
    setState((current) => {
      if (
        current.status === 'flying' ||
        current.status === 'won' ||
        current.status === 'lost' ||
        current.shotsLeft <= 0
      ) {
        return current;
      }

      const angleRad = (current.angle * Math.PI) / 180;
      const speed = shotSpeed(current.power);
      return {
        ...current,
        status: 'flying',
        shotsLeft: current.shotsLeft - 1,
        projectile: {
          x: LAUNCH_X,
          y: LAUNCH_Y,
          vx: Math.cos(angleRad) * speed,
          vy: -Math.sin(angleRad) * speed,
        },
      };
    });
  }, []);

  const handleRestart = useCallback(() => {
    lastFrameTimeRef.current = null;
    lastReportedOutcomeRef.current = null;
    setState(createInitialState());
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (state.score <= bestScore) {
      return;
    }

    setBestScore(state.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.score));
    }
  }, [bestScore, state.score]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        updateAim(2, 0);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault();
        updateAim(-2, 0);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        updateAim(0, -4);
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        updateAim(0, 4);
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
        event.preventDefault();
        handleLaunch();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLaunch, handleRestart, updateAim]);

  useEffect(() => {
    const step = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSeconds = Math.min((now - lastFrameTimeRef.current) / 1000, 0.035);
      lastFrameTimeRef.current = now;

      setState((current) => {
        if (current.status !== 'flying' || !current.projectile) {
          return current;
        }

        const projectile = {
          x: current.projectile.x + current.projectile.vx * deltaSeconds,
          y: current.projectile.y + current.projectile.vy * deltaSeconds,
          vx: current.projectile.vx,
          vy: current.projectile.vy + GRAVITY * deltaSeconds,
        };

        const hitTarget = current.targets.find((target) => intersectsTarget(projectile, target));
        if (hitTarget) {
          const nextTargets = current.targets.flatMap((target) => {
            if (target.id !== hitTarget.id) {
              return [target];
            }
            return target.hp > 1 ? [{ ...target, hp: target.hp - 1 }] : [];
          });
          const nextScore = current.score + 140 + Math.round(current.power * 1.6) + current.shotsLeft * 18;
          return {
            ...current,
            status: nextTargets.length === 0 ? 'won' : current.shotsLeft <= 0 ? 'lost' : 'ready',
            score: nextScore,
            targets: nextTargets,
            projectile: null,
          };
        }

        const isOut =
          projectile.x > STAGE_WIDTH + 40 ||
          projectile.x < -40 ||
          projectile.y > STAGE_HEIGHT + 40 ||
          projectile.y < -80;
        if (isOut) {
          return {
            ...current,
            status: current.shotsLeft <= 0 ? 'lost' : 'ready',
            projectile: null,
          };
        }

        return {
          ...current,
          projectile,
        };
      });

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'sling-shot',
        outcome: 'win',
        opponent: 'Target Towers',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'sling-shot',
        outcome: 'loss',
        opponent: 'Target Towers',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'aim',
      title: 'Aim',
      layout: 'dpad' as const,
      buttons: [
        { key: 'angle-up', label: 'Angle Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => updateAim(2, 0) },
        { key: 'angle-down', label: 'Angle Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => updateAim(-2, 0) },
        { key: 'less-power', label: 'Less Power', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => updateAim(0, -4) },
        { key: 'more-power', label: 'More Power', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => updateAim(0, 4) },
        { key: 'launch', label: 'Launch', icon: <AiOutlineRocket />, slot: 'center' as const, onClick: handleLaunch, disabled: state.status === 'flying' },
      ],
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: handleRestart },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Sling Shot" subtitle="Arrows aim and tune power" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.2, repeat: Infinity } : undefined}
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
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Run</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> {getStatusLabel(state)}</span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Shots</span><strong>{state.shotsLeft}</strong></div>
                <div className="solo-float-stat"><span>Angle</span><strong>{state.angle} deg</strong></div>
                <div className="solo-float-stat"><span>Power</span><strong>{state.power}%</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleLaunch} disabled={state.status === 'flying'}>
                  <AiOutlineRocket /> Launch
                </button>
                <button className="room-float-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Restart
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

      <section className="solo-launch-shell">
        <div className="solo-launch-hud">
          <div className="solo-launch-hud-item"><span>Targets</span><strong>{targetsLeft}</strong></div>
          <div className="solo-launch-hud-item"><span>Angle</span><strong>{state.angle} deg</strong></div>
          <div className="solo-launch-hud-item"><span>Power</span><strong>{state.power}%</strong></div>
          <div className="solo-launch-hud-item"><span>Shots</span><strong>{state.shotsLeft} / {MAX_SHOTS}</strong></div>
        </div>

        <div className="solo-launch-stage-wrap">
          <div className="solo-launch-stage">
            <div className="solo-launch-skyline" />
            <div className="solo-launch-ground" />
            <div className="solo-launch-sling" style={{ left: pct(LAUNCH_X - 18, STAGE_WIDTH), top: pct(LAUNCH_Y - 68, STAGE_HEIGHT) }} />
            <div
              className="solo-launch-aim-line"
              style={{
                left: pct(LAUNCH_X, STAGE_WIDTH),
                top: pct(LAUNCH_Y, STAGE_HEIGHT),
                width: pct(state.power * 2.2, STAGE_WIDTH),
                transform: `rotate(${-state.angle}deg)`,
              }}
            />

            {trajectoryPoints.map((point, index) => (
              <span
                key={`${point.x}-${index}`}
                className="solo-launch-trajectory-dot"
                style={{ left: pct(point.x, STAGE_WIDTH), top: pct(point.y, STAGE_HEIGHT), opacity: 1 - index * 0.06 }}
              />
            ))}

            {state.targets.map((target) => (
              <div
                key={target.id}
                className={`solo-launch-target solo-launch-target-hp-${target.hp}`}
                style={{
                  left: pct(target.x, STAGE_WIDTH),
                  top: pct(target.y, STAGE_HEIGHT),
                  width: pct(target.width, STAGE_WIDTH),
                  height: pct(target.height, STAGE_HEIGHT),
                }}
              >
                <span>{target.hp > 1 ? 'x2' : ''}</span>
              </div>
            ))}

            {state.projectile ? (
              <div
                className="solo-launch-projectile"
                style={{
                  left: pct(state.projectile.x - PROJECTILE_RADIUS, STAGE_WIDTH),
                  top: pct(state.projectile.y - PROJECTILE_RADIUS, STAGE_HEIGHT),
                  width: pct(PROJECTILE_RADIUS * 2, STAGE_WIDTH),
                  height: pct(PROJECTILE_RADIUS * 2, STAGE_HEIGHT),
                }}
              />
            ) : null}

            {state.status === 'ready' || state.status === 'aiming' || state.status === 'won' || state.status === 'lost' ? (
              <div className="solo-launch-overlay">
                <div className="solo-launch-message">
                  <span className={`solo-launch-status-pill solo-launch-status-pill-${state.status === 'lost' ? 'loss' : state.status === 'won' ? 'win' : 'ready'}`}>
                    {state.status === 'won' ? 'Victory' : state.status === 'lost' ? 'Run Over' : 'Shot Ready'}
                  </span>
                  <h2>{state.status === 'won' ? 'Targets cleared' : state.status === 'lost' ? 'The towers held' : 'Set the arc'}</h2>
                  <p>
                    {state.status === 'won'
                      ? `Final score ${state.score}.`
                      : state.status === 'lost'
                        ? `Final score ${state.score}.`
                        : 'Adjust angle and power, then launch through the tower stack.'}
                  </p>
                  <div className="solo-launch-message-actions">
                    {state.status !== 'won' && state.status !== 'lost' ? (
                      <button className="solo-launch-action-btn" type="button" onClick={handleLaunch}>
                        <AiOutlineRocket /> Launch
                      </button>
                    ) : null}
                    <button className="solo-launch-action-btn" type="button" onClick={handleRestart}>
                      <AiOutlineReload /> Play Again
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="solo-launch-message-inline">Use arrow keys or the touch controls to shape the shot. Clear every target before the sling runs dry.</p>
      </section>
    </>
  );
}
