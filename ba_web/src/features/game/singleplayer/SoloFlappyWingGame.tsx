'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Matter from 'matter-js';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { FlappyWingPipe, FlappyWingState, GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloFlappyWingGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type FlappyPipeBodies = {
  top: Matter.Body;
  bottom: Matter.Body;
};

type FlappyPhysicsRefs = {
  engine: Matter.Engine;
  wing: Matter.Body;
  pipeBodies: Map<number, FlappyPipeBodies>;
  pendingCrash: boolean;
};

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 520;
const WING_X = 190;
const WING_SIZE = 36;
const PIPE_WIDTH = 84;
const GAP_HEIGHT = 154;
const PIPE_SPEED = 235;
const GRAVITY = 1120;
const FLAP_STRENGTH = 410;
const WIN_SCORE = 18;
const BEST_SCORE_STORAGE_KEY = 'baturo_flappy_wing_best_score';
const MATTER_TICK_SECONDS = 1 / 60;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const pct = (value: number, total: number): string => `${(value / total) * 100}%`;

const createPipe = (id: number): FlappyWingPipe => ({
  id,
  x: STAGE_WIDTH + 80,
  gapY: 118 + Math.random() * 210,
  passed: false,
});

const createInitialState = (bestScore = 0): FlappyWingState => ({
  status: 'ready',
  wingY: 236,
  velocityY: 0,
  pipes: [],
  score: 0,
  bestScore,
  elapsedMs: 0,
  spawnTimer: 680,
});

const getStatusLabel = (state: FlappyWingState): string => {
  if (state.status === 'won') return 'Gate Run Clear';
  if (state.status === 'crashed') return 'Clipped';
  if (state.status === 'flying') return 'Flying';
  return 'Ready';
};

const toMatterVelocity = (velocity: number): number => velocity * MATTER_TICK_SECONDS;

const fromMatterVelocity = (velocity: number): number => velocity / MATTER_TICK_SECONDS;

const setMatterWing = (body: Matter.Body, wingY: number, velocityY: number): void => {
  Matter.Body.setPosition(body, { x: WING_X, y: wingY });
  Matter.Body.setVelocity(body, { x: 0, y: toMatterVelocity(velocityY) });
  Matter.Body.setAngularVelocity(body, 0);
};

const createPipeBodies = (pipe: FlappyWingPipe): FlappyPipeBodies => {
  const bottomHeight = STAGE_HEIGHT - pipe.gapY - GAP_HEIGHT;
  return {
    top: Matter.Bodies.rectangle(pipe.x + PIPE_WIDTH / 2, pipe.gapY / 2, PIPE_WIDTH, pipe.gapY, {
      isStatic: true,
      isSensor: true,
      label: `pipe:${pipe.id}:top`,
    }),
    bottom: Matter.Bodies.rectangle(
      pipe.x + PIPE_WIDTH / 2,
      pipe.gapY + GAP_HEIGHT + bottomHeight / 2,
      PIPE_WIDTH,
      bottomHeight,
      {
        isStatic: true,
        isSensor: true,
        label: `pipe:${pipe.id}:bottom`,
      }
    ),
  };
};

const syncMatterPipes = (refs: FlappyPhysicsRefs, pipes: FlappyWingPipe[]): void => {
  const wantedIds = new Set(pipes.map((pipe) => pipe.id));

  refs.pipeBodies.forEach((bodies, id) => {
    if (!wantedIds.has(id)) {
      Matter.Composite.remove(refs.engine.world, bodies.top);
      Matter.Composite.remove(refs.engine.world, bodies.bottom);
      refs.pipeBodies.delete(id);
    }
  });

  pipes.forEach((pipe) => {
    let bodies = refs.pipeBodies.get(pipe.id);
    if (!bodies) {
      bodies = createPipeBodies(pipe);
      refs.pipeBodies.set(pipe.id, bodies);
      Matter.Composite.add(refs.engine.world, [bodies.top, bodies.bottom]);
    }

    const bottomHeight = STAGE_HEIGHT - pipe.gapY - GAP_HEIGHT;
    Matter.Body.setPosition(bodies.top, { x: pipe.x + PIPE_WIDTH / 2, y: pipe.gapY / 2 });
    Matter.Body.setPosition(bodies.bottom, {
      x: pipe.x + PIPE_WIDTH / 2,
      y: pipe.gapY + GAP_HEIGHT + bottomHeight / 2,
    });
  });
};

const resetFlappyMatterWorld = (refs: FlappyPhysicsRefs, state: FlappyWingState): void => {
  refs.pendingCrash = false;
  setMatterWing(refs.wing, state.wingY, state.velocityY);
  syncMatterPipes(refs, state.pipes);
};

const createFlappyPhysics = (): FlappyPhysicsRefs => {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
  });
  const initial = createInitialState();
  const wing = Matter.Bodies.circle(WING_X, initial.wingY, WING_SIZE / 2, {
    restitution: 0,
    friction: 0,
    frictionAir: 0,
    label: 'wing',
  });
  const ceiling = Matter.Bodies.rectangle(STAGE_WIDTH / 2, -8, STAGE_WIDTH, 16, {
    isStatic: true,
    isSensor: true,
    label: 'world:ceiling',
  });
  const floor = Matter.Bodies.rectangle(STAGE_WIDTH / 2, STAGE_HEIGHT + 8, STAGE_WIDTH, 16, {
    isStatic: true,
    isSensor: true,
    label: 'world:floor',
  });
  const refs: FlappyPhysicsRefs = {
    engine,
    wing,
    pipeBodies: new Map(),
    pendingCrash: false,
  };

  Matter.Composite.add(engine.world, [wing, ceiling, floor]);
  Matter.Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('wing')) {
        refs.pendingCrash = true;
      }
    });
  });

  return refs;
};

export function SoloFlappyWingGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloFlappyWingGameProps) {
  const [state, setState] = useState<FlappyWingState>(() => createInitialState());
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const nextPipeIdRef = useRef(1);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const physicsRef = useRef<FlappyPhysicsRefs | null>(null);
  const gameLabel = formatGameName('flappy-wing', gameDefinitions);

  const handleRestart = useCallback(() => {
    lastFrameTimeRef.current = null;
    nextPipeIdRef.current = 1;
    lastReportedOutcomeRef.current = null;
    setState((current) => {
      const nextState = createInitialState(current.bestScore);
      if (physicsRef.current) {
        resetFlappyMatterWorld(physicsRef.current, nextState);
      }
      return nextState;
    });
  }, []);

  const handleFlap = useCallback(() => {
    setState((current) => {
      if (current.status === 'won' || current.status === 'crashed') {
        return current;
      }

      if (physicsRef.current) {
        setMatterWing(physicsRef.current.wing, current.wingY, -FLAP_STRENGTH);
      }
      return {
        ...current,
        status: 'flying',
        velocityY: -FLAP_STRENGTH,
      };
    });
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    if (!Number.isFinite(storedBest) || storedBest <= 0) {
      return;
    }

    setState((current) => ({
      ...current,
      bestScore: storedBest,
    }));
  }, []);

  useEffect(() => {
    const refs = createFlappyPhysics();
    physicsRef.current = refs;
    resetFlappyMatterWorld(refs, createInitialState());

    return () => {
      Matter.Composite.clear(refs.engine.world, false);
      Matter.Engine.clear(refs.engine);
      physicsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && state.bestScore > 0) {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.bestScore));
    }
  }, [state.bestScore]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        if (!event.repeat) {
          handleFlap();
        }
        return;
      }

      if (event.key === 'r' || event.key === 'R' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          handleRestart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlap, handleRestart]);

  useEffect(() => {
    const step = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaMs = Math.min(now - lastFrameTimeRef.current, 35);
      lastFrameTimeRef.current = now;
      const deltaSeconds = deltaMs / 1000;

      setState((current) => {
        if (current.status !== 'flying') {
          return current;
        }

        const refs = physicsRef.current;
        if (!refs) {
          return current;
        }

        let spawnTimer = current.spawnTimer - deltaMs;
        let pipes = current.pipes.map((pipe) => ({
          ...pipe,
          x: pipe.x - PIPE_SPEED * deltaSeconds,
        }));

        if (spawnTimer <= 0) {
          pipes = [...pipes, createPipe(nextPipeIdRef.current)];
          nextPipeIdRef.current += 1;
          spawnTimer = 1280;
        }

        let score = current.score;
        pipes = pipes
          .filter((pipe) => pipe.x + PIPE_WIDTH > -40)
          .map((pipe) => {
            if (!pipe.passed && pipe.x + PIPE_WIDTH < WING_X - WING_SIZE / 2) {
              score += 1;
              return { ...pipe, passed: true };
            }
            return pipe;
          });

        const matterVelocityY = fromMatterVelocity(refs.wing.velocity.y);
        Matter.Body.setVelocity(refs.wing, {
          x: 0,
          y: toMatterVelocity(matterVelocityY + GRAVITY * deltaSeconds),
        });
        syncMatterPipes(refs, pipes);
        Matter.Engine.update(refs.engine, deltaMs);
        Matter.Body.setPosition(refs.wing, { x: WING_X, y: refs.wing.position.y });

        const velocityY = fromMatterVelocity(refs.wing.velocity.y);
        const wingY = refs.wing.position.y;
        const hitWorld = wingY - WING_SIZE / 2 < 0 || wingY + WING_SIZE / 2 > STAGE_HEIGHT;
        const hitPipe = refs.pendingCrash;
        refs.pendingCrash = false;
        const bestScore = Math.max(current.bestScore, score);

        if (score >= WIN_SCORE) {
          setMatterWing(refs.wing, clamp(wingY, WING_SIZE / 2, STAGE_HEIGHT - WING_SIZE / 2), 0);
          return {
            ...current,
            status: 'won',
            score,
            bestScore,
            wingY: clamp(wingY, WING_SIZE / 2, STAGE_HEIGHT - WING_SIZE / 2),
            velocityY: 0,
            pipes,
            elapsedMs: current.elapsedMs + deltaMs,
            spawnTimer,
          };
        }

        if (hitWorld || hitPipe) {
          setMatterWing(refs.wing, clamp(wingY, WING_SIZE / 2, STAGE_HEIGHT - WING_SIZE / 2), 0);
          return {
            ...current,
            status: 'crashed',
            score,
            bestScore,
            wingY: clamp(wingY, WING_SIZE / 2, STAGE_HEIGHT - WING_SIZE / 2),
            velocityY: 0,
            pipes,
            elapsedMs: current.elapsedMs + deltaMs,
            spawnTimer,
          };
        }

        return {
          ...current,
          wingY,
          velocityY,
          pipes,
          score,
          bestScore,
          elapsedMs: current.elapsedMs + deltaMs,
          spawnTimer,
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
        gameType: 'flappy-wing',
        outcome: 'win',
        opponent: 'Sky Gates',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    if (state.status === 'crashed' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'flappy-wing',
        outcome: 'loss',
        opponent: 'Sky Gates',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'flight',
      title: 'Flight',
      layout: 'dpad' as const,
      buttons: [
        { key: 'flap', label: 'Flap', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: handleFlap },
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, slot: 'center' as const, onClick: handleRestart },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Flappy Wing" subtitle="Tap, Space, or Up to flap" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.3, repeat: Infinity } : undefined}
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
                <div className="solo-float-stat"><span>Best</span><strong>{state.bestScore}</strong></div>
                <div className="solo-float-stat"><span>Target</span><strong>{WIN_SCORE}</strong></div>
                <div className="solo-float-stat"><span>Gates</span><strong>{state.pipes.length}</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{(state.elapsedMs / 1000).toFixed(1)}s</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleFlap}>
                  <AiOutlineArrowUp /> Flap
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

      <section className="solo-flappy-shell">
        <div className="solo-flappy-hud">
          <div className="solo-flappy-hud-item"><span>Score</span><strong>{state.score}</strong></div>
          <div className="solo-flappy-hud-item"><span>Best</span><strong>{state.bestScore}</strong></div>
          <div className="solo-flappy-hud-item"><span>Target</span><strong>{WIN_SCORE}</strong></div>
          <div className="solo-flappy-hud-item"><span>Status</span><strong>{getStatusLabel(state)}</strong></div>
        </div>

        <div className="solo-flappy-stage-wrap" onPointerDown={handleFlap} role="presentation">
          <div className="solo-flappy-stage">
            <div className="solo-flappy-cloud solo-flappy-cloud-a" />
            <div className="solo-flappy-cloud solo-flappy-cloud-b" />
            <div className="solo-flappy-cloud solo-flappy-cloud-c" />
            <div className="solo-flappy-horizon" />

            {state.pipes.map((pipe) => (
              <React.Fragment key={pipe.id}>
                <div
                  className="solo-flappy-pipe solo-flappy-pipe-top"
                  style={{
                    left: pct(pipe.x, STAGE_WIDTH),
                    top: 0,
                    width: pct(PIPE_WIDTH, STAGE_WIDTH),
                    height: pct(pipe.gapY, STAGE_HEIGHT),
                  }}
                />
                <div
                  className="solo-flappy-pipe solo-flappy-pipe-bottom"
                  style={{
                    left: pct(pipe.x, STAGE_WIDTH),
                    top: pct(pipe.gapY + GAP_HEIGHT, STAGE_HEIGHT),
                    width: pct(PIPE_WIDTH, STAGE_WIDTH),
                    height: pct(STAGE_HEIGHT - pipe.gapY - GAP_HEIGHT, STAGE_HEIGHT),
                  }}
                />
              </React.Fragment>
            ))}

            <div
              className="solo-flappy-wing"
              style={{
                left: pct(WING_X - WING_SIZE / 2, STAGE_WIDTH),
                top: pct(state.wingY - WING_SIZE / 2, STAGE_HEIGHT),
                width: pct(WING_SIZE, STAGE_WIDTH),
                height: pct(WING_SIZE, STAGE_HEIGHT),
                transform: `rotate(${clamp(state.velocityY / 18, -18, 28)}deg)`,
              }}
            >
              <span />
            </div>

            {state.status === 'ready' || state.status === 'won' || state.status === 'crashed' ? (
              <div className="solo-flappy-overlay">
                <div className="solo-flappy-message">
                  <span className={`solo-flappy-status-pill solo-flappy-status-pill-${state.status === 'crashed' ? 'loss' : state.status === 'won' ? 'win' : 'ready'}`}>
                    {state.status === 'won' ? 'Victory' : state.status === 'crashed' ? 'Run Over' : 'Ready'}
                  </span>
                  <h2>{state.status === 'won' ? 'Sky run clear' : state.status === 'crashed' ? 'Wing clipped' : 'Tap to lift'}</h2>
                  <p>
                    {state.status === 'won'
                      ? `Final score ${state.score}.`
                      : state.status === 'crashed'
                        ? `Final score ${state.score}.`
                        : 'Tap the stage, press Space, or use the controller to start flying.'}
                  </p>
                  <div className="solo-flappy-message-actions">
                    {state.status === 'ready' ? (
                      <button className="solo-flappy-action-btn" type="button" onClick={handleFlap}>
                        <AiOutlineArrowUp /> Start
                      </button>
                    ) : null}
                    <button className="solo-flappy-action-btn" type="button" onClick={handleRestart}>
                      <AiOutlineReload /> Play Again
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="solo-flappy-message-inline">Time each flap lightly. The run is won at {WIN_SCORE} clean gates.</p>
      </section>
    </>
  );
}
