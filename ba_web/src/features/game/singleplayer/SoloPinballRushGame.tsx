'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import Matter from 'matter-js';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  MatchResultEvent,
  PinballRushState,
  PinballRushTargetState,
  PlayerProfile,
} from '@/types/game';

type SoloPinballRushGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type PinballRefs = {
  engine: Matter.Engine;
  runner: Matter.Runner;
  ball: Matter.Body;
  leftFlipper: Matter.Body;
  rightFlipper: Matter.Body;
  plunger: Matter.Body;
  targets: Array<{ id: string; body: Matter.Body; value: number }>;
};

const TABLE_WIDTH = 720;
const TABLE_HEIGHT = 960;
const BALL_RADIUS = 13;
const TARGET_SCORE = 5500;
const STARTING_LIVES = 3;
const BEST_SCORE_STORAGE_KEY = 'baturo_pinball_rush_best_score';

const TARGET_LAYOUT: PinballRushTargetState[] = [
  { id: 'top-left', x: 226, y: 194, radius: 30, active: true },
  { id: 'top-right', x: 494, y: 194, radius: 30, active: true },
  { id: 'mid', x: 360, y: 332, radius: 34, active: true },
  { id: 'lane-left', x: 188, y: 470, radius: 24, active: true },
  { id: 'lane-right', x: 532, y: 470, radius: 24, active: true },
];

const createInitialState = (bestScore = 0): PinballRushState => ({
  status: 'ready',
  ball: { x: 610, y: 780, angle: 0 },
  score: 0,
  bestScore,
  lives: STARTING_LIVES,
  multiplier: 1,
  targetsLit: TARGET_LAYOUT.length,
  timeMs: 0,
  event: 'Ready',
});

const createWall = (x: number, y: number, width: number, height: number, angle = 0): Matter.Body =>
  Matter.Bodies.rectangle(x, y, width, height, {
    isStatic: true,
    angle,
    restitution: 0.58,
    friction: 0.08,
    label: 'wall',
  });

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const createPinballWorld = (onScore: (targetId: string, value: number) => void): PinballRefs => {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1.08, scale: 0.001 },
  });
  const runner = Matter.Runner.create();
  const world = engine.world;

  const ball = Matter.Bodies.circle(610, 780, BALL_RADIUS, {
    restitution: 0.88,
    friction: 0.02,
    frictionAir: 0.004,
    density: 0.0024,
    label: 'ball',
  });

  const leftFlipper = Matter.Bodies.rectangle(268, 812, 128, 18, {
    isStatic: true,
    angle: -0.24,
    restitution: 0.72,
    label: 'left-flipper',
  });
  const rightFlipper = Matter.Bodies.rectangle(452, 812, 128, 18, {
    isStatic: true,
    angle: 0.24,
    restitution: 0.72,
    label: 'right-flipper',
  });
  const plunger = Matter.Bodies.rectangle(610, 872, 52, 18, {
    isStatic: true,
    restitution: 1.02,
    label: 'plunger',
  });

  const walls = [
    createWall(TABLE_WIDTH / 2, -20, TABLE_WIDTH, 40),
    createWall(-20, TABLE_HEIGHT / 2, 40, TABLE_HEIGHT),
    createWall(TABLE_WIDTH + 20, TABLE_HEIGHT / 2, 40, TABLE_HEIGHT),
    createWall(112, 724, 190, 18, 0.48),
    createWall(608, 724, 190, 18, -0.48),
    createWall(586, 612, 22, 520),
    createWall(648, 612, 22, 520),
    createWall(142, 142, 154, 18, -0.72),
    createWall(578, 142, 154, 18, 0.72),
    createWall(360, 74, 230, 18),
  ];

  const targets = TARGET_LAYOUT.map((target, index) => ({
    id: target.id,
    value: index === 2 ? 420 : 260,
    body: Matter.Bodies.circle(target.x, target.y, target.radius, {
      isStatic: true,
      isSensor: true,
      label: `target:${target.id}`,
    }),
  }));

  const bumpers = [
    Matter.Bodies.circle(266, 300, 38, { isStatic: true, restitution: 1.22, label: 'bumper' }),
    Matter.Bodies.circle(454, 300, 38, { isStatic: true, restitution: 1.22, label: 'bumper' }),
    Matter.Bodies.circle(360, 440, 42, { isStatic: true, restitution: 1.25, label: 'bumper' }),
  ];

  Matter.Composite.add(world, [
    ball,
    leftFlipper,
    rightFlipper,
    plunger,
    ...walls,
    ...targets.map((target) => target.body),
    ...bumpers,
  ]);

  Matter.Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      const targetLabel = labels.find((label) => label.startsWith('target:'));
      if (targetLabel && labels.includes('ball')) {
        const targetId = targetLabel.replace('target:', '');
        const target = targets.find((entry) => entry.id === targetId);
        if (target) {
          onScore(target.id, target.value);
        }
      }

      if (labels.includes('ball') && labels.includes('bumper')) {
        onScore('bumper', 120);
      }
    });
  });

  return { engine, runner, ball, leftFlipper, rightFlipper, plunger, targets };
};

export function SoloPinballRushGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloPinballRushGameProps) {
  const [state, setState] = useState<PinballRushState>(() => createInitialState());
  const [targets, setTargets] = useState<PinballRushTargetState[]>(TARGET_LAYOUT);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const pinballRef = useRef<PinballRefs | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const leftHeldRef = useRef(false);
  const rightHeldRef = useRef(false);
  const plungerHeldRef = useRef(false);
  const lastTargetHitRef = useRef<Record<string, number>>({});
  const lastReportedOutcomeRef = useRef<'won' | 'lost' | null>(null);
  const gameLabel = formatGameName('pinball-rush', gameDefinitions);

  const statusLabel = useMemo(() => {
    if (state.status === 'won') return 'Table Mastered';
    if (state.status === 'lost') return 'Drain';
    if (state.status === 'playing') return 'In Play';
    return 'Ready';
  }, [state.status]);

  const awardScore = useCallback((targetId: string, value: number) => {
    const now = Date.now();
    if ((lastTargetHitRef.current[targetId] || 0) + 170 > now) {
      return;
    }
    lastTargetHitRef.current[targetId] = now;

    setState((current) => {
      if (current.status !== 'playing') {
        return current;
      }
      const multiplier = targetId === 'bumper' ? current.multiplier : Math.min(5, current.multiplier + 1);
      const score = current.score + value * current.multiplier;
      return {
        ...current,
        score,
        bestScore: Math.max(current.bestScore, score),
        multiplier,
        event: targetId === 'bumper' ? 'Bumper hit' : 'Target lit',
        status: score >= TARGET_SCORE ? 'won' : current.status,
      };
    });

    if (targetId !== 'bumper') {
      setTargets((current) => {
        const nextTargets = current.map((target) =>
          target.id === targetId ? { ...target, active: false } : target
        );
        const activeCount = nextTargets.filter((target) => target.active).length;
        if (activeCount === 0) {
          window.setTimeout(() => {
            setTargets(TARGET_LAYOUT);
            setState((currentState) => ({
              ...currentState,
              multiplier: Math.min(6, currentState.multiplier + 1),
              targetsLit: TARGET_LAYOUT.length,
              event: 'Bank reset',
            }));
          }, 280);
        }
        setState((currentState) => ({
          ...currentState,
          targetsLit: activeCount,
        }));
        return nextTargets;
      });
    }
  }, []);

  const resetBall = useCallback((status: PinballRushState['status'] = 'playing') => {
    const refs = pinballRef.current;
    if (!refs) {
      return;
    }
    Matter.Body.setPosition(refs.ball, { x: 610, y: 780 });
    Matter.Body.setVelocity(refs.ball, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(refs.ball, 0);
    setState((current) => ({
      ...current,
      status,
      ball: { x: 610, y: 780, angle: 0 },
      multiplier: Math.max(1, Math.floor(current.multiplier / 2)),
      event: status === 'playing' ? 'Ball saved' : current.event,
    }));
  }, []);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    lastTargetHitRef.current = {};
    leftHeldRef.current = false;
    rightHeldRef.current = false;
    plungerHeldRef.current = false;
    setTargets(TARGET_LAYOUT);
    setState((current) => createInitialState(current.bestScore));
    window.setTimeout(() => resetBall('ready'), 0);
  }, [resetBall]);

  const launchBall = useCallback(() => {
    const refs = pinballRef.current;
    if (!refs || state.status === 'won' || state.status === 'lost') {
      return;
    }
    setState((current) => ({
      ...current,
      status: 'playing',
      event: 'Launch',
    }));
    Matter.Body.applyForce(refs.ball, refs.ball.position, { x: -0.006, y: -0.055 });
  }, [state.status]);

  const holdFlipper = useCallback((side: 'left' | 'right', held: boolean) => {
    if (side === 'left') {
      leftHeldRef.current = held;
    } else {
      rightHeldRef.current = held;
    }
  }, []);

  const holdPlunger = useCallback((held: boolean) => {
    plungerHeldRef.current = held;
    if (!held) {
      launchBall();
    }
  }, [launchBall]);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setState((current) => ({
      ...current,
      bestScore: Number.isFinite(storedBest) ? storedBest : 0,
    }));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && state.bestScore > 0) {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.bestScore));
    }
  }, [state.bestScore]);

  useEffect(() => {
    pinballRef.current = createPinballWorld(awardScore);
    const refs = pinballRef.current;
    Matter.Runner.run(refs.runner, refs.engine);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      Matter.Runner.stop(refs.runner);
      Matter.Composite.clear(refs.engine.world, false);
      Matter.Engine.clear(refs.engine);
      pinballRef.current = null;
    };
  }, [awardScore]);

  useEffect(() => {
    const step = (now: number) => {
      const refs = pinballRef.current;
      if (!refs) {
        return;
      }

      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const deltaMs = Math.min(now - lastFrameRef.current, 50);
      lastFrameRef.current = now;

      const leftTarget = leftHeldRef.current ? -0.78 : -0.24;
      const rightTarget = rightHeldRef.current ? 0.78 : 0.24;
      Matter.Body.setAngle(refs.leftFlipper, refs.leftFlipper.angle + (leftTarget - refs.leftFlipper.angle) * 0.42);
      Matter.Body.setAngle(refs.rightFlipper, refs.rightFlipper.angle + (rightTarget - refs.rightFlipper.angle) * 0.42);
      Matter.Body.setPosition(refs.plunger, {
        x: 610,
        y: plungerHeldRef.current ? 898 : 872,
      });

      const speed = Math.hypot(refs.ball.velocity.x, refs.ball.velocity.y);
      if (speed > 28) {
        Matter.Body.setVelocity(refs.ball, {
          x: (refs.ball.velocity.x / speed) * 28,
          y: (refs.ball.velocity.y / speed) * 28,
        });
      }

      const ball = refs.ball;
      setState((current) => {
        if (current.status === 'lost' || current.status === 'won') {
          return {
            ...current,
            ball: { x: ball.position.x, y: ball.position.y, angle: ball.angle },
          };
        }

        if (ball.position.y > TABLE_HEIGHT + 48) {
          const lives = current.lives - 1;
          if (lives <= 0) {
            return {
              ...current,
              lives: 0,
              status: 'lost',
              ball: { x: ball.position.x, y: ball.position.y, angle: ball.angle },
              event: 'Final drain',
            };
          }
          window.setTimeout(() => resetBall('playing'), 0);
          return {
            ...current,
            lives,
            multiplier: 1,
            ball: { x: ball.position.x, y: ball.position.y, angle: ball.angle },
            event: 'Drain',
          };
        }

        return {
          ...current,
          timeMs: current.status === 'playing' ? current.timeMs + deltaMs : current.timeMs,
          ball: { x: ball.position.x, y: ball.position.y, angle: ball.angle },
        };
      });

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [resetBall]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'a' || event.key === 'ArrowLeft') {
        event.preventDefault();
        holdFlipper('left', true);
      } else if (key === 'd' || event.key === 'ArrowRight') {
        event.preventDefault();
        holdFlipper('right', true);
      } else if (event.code === 'Space' || event.key === 'ArrowDown') {
        event.preventDefault();
        holdPlunger(true);
      } else if (key === 'r') {
        event.preventDefault();
        handleRestart();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'a' || event.key === 'ArrowLeft') {
        holdFlipper('left', false);
      } else if (key === 'd' || event.key === 'ArrowRight') {
        holdFlipper('right', false);
      } else if (event.code === 'Space' || event.key === 'ArrowDown') {
        holdPlunger(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRestart, holdFlipper, holdPlunger]);

  useEffect(() => {
    if ((state.status !== 'won' && state.status !== 'lost') || lastReportedOutcomeRef.current === state.status) {
      return;
    }
    lastReportedOutcomeRef.current = state.status;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'pinball-rush',
      outcome: state.status === 'won' ? 'win' : 'loss',
      opponent: 'Pinball Rush Table',
    });
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'flippers',
      title: 'Flippers',
      layout: 'row' as const,
      buttons: [
        {
          key: 'left',
          label: 'Left',
          icon: <AiOutlineArrowLeft />,
          onPointerDown: () => holdFlipper('left', true),
          onPointerUp: () => holdFlipper('left', false),
          onClick: () => {
            holdFlipper('left', true);
            window.setTimeout(() => holdFlipper('left', false), 120);
          },
        },
        {
          key: 'right',
          label: 'Right',
          icon: <AiOutlineArrowRight />,
          onPointerDown: () => holdFlipper('right', true),
          onPointerUp: () => holdFlipper('right', false),
          onClick: () => {
            holdFlipper('right', true);
            window.setTimeout(() => holdFlipper('right', false), 120);
          },
        },
      ],
    },
    {
      key: 'table-actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'launch',
          label: 'Launch',
          icon: <AiOutlineRocket />,
          onPointerDown: () => holdPlunger(true),
          onPointerUp: () => holdPlunger(false),
          onClick: launchBall,
          disabled: state.status === 'won' || state.status === 'lost',
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

      <AdaptiveControllerOverlay sections={controllerSections} title={gameLabel} subtitle="Flippers and launcher" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button className="room-float-collapsed-center" type="button" onClick={() => setIsInfoCardCollapsed(false)} aria-label="Expand table info">
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Table</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse table info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line">
                  {state.status === 'lost' ? <AiOutlineCloseCircle /> : <AiOutlineCheckCircle />} {statusLabel}
                </span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.score}</strong></div>
                <div className="solo-float-stat"><span>Target</span><strong>{TARGET_SCORE}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{state.bestScore}</strong></div>
                <div className="solo-float-stat"><span>Lives</span><strong>{state.lives}</strong></div>
                <div className="solo-float-stat"><span>Multi</span><strong>x{state.multiplier}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={launchBall} disabled={state.status === 'won' || state.status === 'lost'}>
                  <AiOutlineRocket /> Launch
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

      <section className="pinball-rush-shell">
        <div className="pinball-rush-hud">
          <div className="pinball-rush-hud-item"><span>Score</span><strong>{state.score}</strong></div>
          <div className="pinball-rush-hud-item"><span>Best</span><strong>{state.bestScore}</strong></div>
          <div className="pinball-rush-hud-item"><span>Lives</span><strong>{state.lives}</strong></div>
          <div className="pinball-rush-hud-item"><span>Multi</span><strong>x{state.multiplier}</strong></div>
        </div>

        <div className="pinball-rush-table-wrap">
          <div className="pinball-rush-table" aria-label="Pinball Rush table">
            <span className="pinball-rush-rail pinball-rush-rail-left" />
            <span className="pinball-rush-rail pinball-rush-rail-right" />
            <span className="pinball-rush-rail pinball-rush-rail-top" />
            <span className="pinball-rush-launch-lane" />
            <span className="pinball-rush-plunger" style={{ transform: `translateY(${plungerHeldRef.current ? 16 : 0}px)` }} />

            {targets.map((target) => (
              <span
                key={target.id}
                className={classnames('pinball-rush-target', !target.active && 'pinball-rush-target-dim')}
                style={{
                  left: `${(target.x / TABLE_WIDTH) * 100}%`,
                  top: `${(target.y / TABLE_HEIGHT) * 100}%`,
                  width: `${(target.radius * 2 / TABLE_WIDTH) * 100}%`,
                }}
              />
            ))}

            <span className="pinball-rush-bumper pinball-rush-bumper-a" />
            <span className="pinball-rush-bumper pinball-rush-bumper-b" />
            <span className="pinball-rush-bumper pinball-rush-bumper-c" />

            <span
              className="pinball-rush-ball"
              style={{
                left: `${(state.ball.x / TABLE_WIDTH) * 100}%`,
                top: `${(state.ball.y / TABLE_HEIGHT) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${state.ball.angle}rad)`,
              }}
            />
            <span className="pinball-rush-flipper pinball-rush-flipper-left" style={{ transform: `rotate(${leftHeldRef.current ? -45 : -14}deg)` }} />
            <span className="pinball-rush-flipper pinball-rush-flipper-right" style={{ transform: `rotate(${rightHeldRef.current ? 45 : 14}deg)` }} />

            {state.status === 'ready' || state.status === 'won' || state.status === 'lost' ? (
              <div className="pinball-rush-overlay">
                <div className="pinball-rush-message">
                  <span className="pinball-rush-status-pill">{statusLabel}</span>
                  <h2>{state.status === 'won' ? 'High table cleared' : state.status === 'lost' ? 'Out of balls' : 'Ball on deck'}</h2>
                  <p>{state.status === 'ready' ? 'Launch the ball and keep it alive with the flippers.' : `${state.event}. Score ${state.score}.`}</p>
                  <button className="pinball-rush-action-btn" type="button" onClick={state.status === 'ready' ? launchBall : handleRestart}>
                    {state.status === 'ready' ? <AiOutlineRocket /> : <AiOutlineReload />} {state.status === 'ready' ? 'Launch' : 'Play Again'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pinball-rush-actions">
          <button className="pinball-rush-action-btn" type="button" onClick={launchBall} disabled={state.status === 'won' || state.status === 'lost'}>
            <AiOutlineRocket /> Launch
          </button>
          <button className="pinball-rush-action-btn" type="button" onClick={handleRestart}>
            <AiOutlineReload /> Reset
          </button>
        </div>

        <p className="pinball-rush-message-inline">{state.event}</p>
      </section>
    </>
  );
}
