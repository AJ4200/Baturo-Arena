'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import Matter from 'matter-js';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type RunStatus = 'ready' | 'playing' | 'won' | 'lost';

type PongState = {
  status: RunStatus;
  playerY: number;
  cpuY: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  playerScore: number;
  cpuScore: number;
  rally: number;
  elapsedMs: number;
};

type SoloNeonPongGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type PongPhysicsRefs = {
  engine: Matter.Engine;
  ball: Matter.Body;
  playerPaddle: Matter.Body;
  cpuPaddle: Matter.Body;
  pendingPaddleHit: 'player' | 'cpu' | null;
};

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 560;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 88;
const PADDLE_MARGIN = 20;
const BALL_RADIUS = 8;
const PADDLE_MIN_Y = 14;
const PADDLE_MAX_Y = STAGE_HEIGHT - PADDLE_HEIGHT - 14;
const WIN_SCORE = 7;
const PADDLE_SPEED = 420;
const CPU_SPEED = 340;
const BALL_BASE_SPEED = 300;
const BEST_SCORE_STORAGE_KEY = 'baturo_neon_pong_best_wins';
const MATTER_TICK_SECONDS = 1 / 60;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createCenteredBall = (): Pick<PongState, 'ballX' | 'ballY' | 'ballVx' | 'ballVy'> => ({
  ballX: STAGE_WIDTH / 2,
  ballY: STAGE_HEIGHT / 2,
  ballVx: 0,
  ballVy: 0,
});

const createInitialState = (): PongState => ({
  status: 'ready',
  playerY: STAGE_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  cpuY: STAGE_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  ...createCenteredBall(),
  playerScore: 0,
  cpuScore: 0,
  rally: 0,
  elapsedMs: 0,
});

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const launchBall = (rally: number, towardPlayer = Math.random() < 0.5): Pick<PongState, 'ballVx' | 'ballVy'> => {
  const speed = BALL_BASE_SPEED + rally * 12;
  const angle = (Math.random() * 0.7 - 0.35) * Math.PI;
  const direction = towardPlayer ? -1 : 1;
  return {
    ballVx: Math.cos(angle) * speed * direction,
    ballVy: Math.sin(angle) * speed,
  };
};

const toMatterVelocity = (velocity: number): number => velocity * MATTER_TICK_SECONDS;

const fromMatterVelocity = (velocity: number): number => velocity / MATTER_TICK_SECONDS;

const setMatterBall = (
  body: Matter.Body,
  ball: Pick<PongState, 'ballX' | 'ballY' | 'ballVx' | 'ballVy'>
): void => {
  Matter.Body.setPosition(body, { x: ball.ballX, y: ball.ballY });
  Matter.Body.setVelocity(body, {
    x: toMatterVelocity(ball.ballVx),
    y: toMatterVelocity(ball.ballVy),
  });
  Matter.Body.setAngularVelocity(body, 0);
};

const getMatterBall = (body: Matter.Body): Pick<PongState, 'ballX' | 'ballY' | 'ballVx' | 'ballVy'> => ({
  ballX: body.position.x,
  ballY: body.position.y,
  ballVx: fromMatterVelocity(body.velocity.x),
  ballVy: fromMatterVelocity(body.velocity.y),
});

const syncMatterPaddles = (refs: PongPhysicsRefs, playerY: number, cpuY: number): void => {
  Matter.Body.setPosition(refs.playerPaddle, {
    x: PADDLE_MARGIN + PADDLE_WIDTH / 2,
    y: playerY + PADDLE_HEIGHT / 2,
  });
  Matter.Body.setPosition(refs.cpuPaddle, {
    x: STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH / 2,
    y: cpuY + PADDLE_HEIGHT / 2,
  });
};

const resetPongMatterWorld = (refs: PongPhysicsRefs, state: PongState): void => {
  refs.pendingPaddleHit = null;
  syncMatterPaddles(refs, state.playerY, state.cpuY);
  setMatterBall(refs.ball, state);
};

const createPongPhysics = (): PongPhysicsRefs => {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
  });
  const initial = createInitialState();
  const ball = Matter.Bodies.circle(initial.ballX, initial.ballY, BALL_RADIUS, {
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    inertia: Infinity,
    label: 'ball',
  });
  const playerPaddle = Matter.Bodies.rectangle(
    PADDLE_MARGIN + PADDLE_WIDTH / 2,
    initial.playerY + PADDLE_HEIGHT / 2,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    {
      isStatic: true,
      restitution: 1.06,
      friction: 0,
      label: 'paddle:player',
    }
  );
  const cpuPaddle = Matter.Bodies.rectangle(
    STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH / 2,
    initial.cpuY + PADDLE_HEIGHT / 2,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    {
      isStatic: true,
      restitution: 1.06,
      friction: 0,
      label: 'paddle:cpu',
    }
  );
  const topWall = Matter.Bodies.rectangle(STAGE_WIDTH / 2, -12, STAGE_WIDTH, 24, {
    isStatic: true,
    restitution: 1,
    friction: 0,
    label: 'wall:top',
  });
  const bottomWall = Matter.Bodies.rectangle(STAGE_WIDTH / 2, STAGE_HEIGHT + 12, STAGE_WIDTH, 24, {
    isStatic: true,
    restitution: 1,
    friction: 0,
    label: 'wall:bottom',
  });
  const refs: PongPhysicsRefs = {
    engine,
    ball,
    playerPaddle,
    cpuPaddle,
    pendingPaddleHit: null,
  };

  Matter.Composite.add(engine.world, [ball, playerPaddle, cpuPaddle, topWall, bottomWall]);
  Matter.Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes('ball')) {
        return;
      }
      if (labels.includes('paddle:player')) {
        refs.pendingPaddleHit = 'player';
      } else if (labels.includes('paddle:cpu')) {
        refs.pendingPaddleHit = 'cpu';
      }
    });
  });

  return refs;
};

export function SoloNeonPongGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloNeonPongGameProps) {
  const [state, setState] = useState<PongState>(createInitialState);
  const [bestWins, setBestWins] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const movementRef = useRef({ up: false, down: false });
  const pointerTargetYRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastReportedOutcomeRef = useRef<MatchResultEvent['outcome'] | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const physicsRef = useRef<PongPhysicsRefs | null>(null);

  const gameLabel = useMemo(() => formatGameName('neon-pong', gameDefinitions), [gameDefinitions]);

  const hud = useMemo(
    () => ({
      status:
        state.status === 'ready'
          ? 'Serve Ready'
          : state.status === 'won'
            ? 'Arena Champion'
            : state.status === 'lost'
              ? 'CPU Crown'
              : 'Rally Live',
      ballSpeed: state.status === 'playing' ? Math.round(Math.hypot(state.ballVx, state.ballVy)) : 0,
      elapsedSeconds: Math.floor(state.elapsedMs / 1000),
      serveState: state.status === 'ready' ? 'Waiting' : state.status === 'playing' ? 'Active' : 'Closed',
    }),
    [state]
  );

  const overlayCopy = useMemo(() => {
    if (state.status === 'won') {
      return {
        pill: 'Arena Champion',
        pillClass: 'solo-neon-pong-status-pill-win',
        title: 'You claimed the neon crown.',
        detail: `Final rally ${state.playerScore} - ${state.cpuScore}. Best match wins ${bestWins}.`,
      };
    }
    if (state.status === 'lost') {
      return {
        pill: 'CPU Crown',
        pillClass: 'solo-neon-pong-status-pill-loss',
        title: 'The CPU held the line.',
        detail: `Final rally ${state.playerScore} - ${state.cpuScore}. Reset and chase the crown again.`,
      };
    }
    if (state.playerScore > 0 || state.cpuScore > 0) {
      return {
        pill: 'Next Serve',
        pillClass: 'solo-neon-pong-status-pill-ready',
        title: `Rally score ${state.playerScore} - ${state.cpuScore}`,
        detail: 'Press Serve, Space, or drag the arena to line up your paddle.',
      };
    }
    return {
      pill: 'Serve Ready',
      pillClass: 'solo-neon-pong-status-pill-ready',
      title: 'Launch when ready',
      detail: `First to ${WIN_SCORE} points wins. Arrow keys, drag, or touch move your paddle.`,
    };
  }, [bestWins, state.cpuScore, state.playerScore, state.status]);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    const nextState = createInitialState();
    if (physicsRef.current) {
      resetPongMatterWorld(physicsRef.current, nextState);
    }
    setState(nextState);
  }, []);

  const handleLaunch = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      const velocity = launchBall(current.rally);
      if (physicsRef.current) {
        physicsRef.current.pendingPaddleHit = null;
        syncMatterPaddles(physicsRef.current, current.playerY, current.cpuY);
        setMatterBall(physicsRef.current.ball, {
          ...createCenteredBall(),
          ...velocity,
        });
      }
      return {
        ...current,
        status: 'playing',
        ...velocity,
      };
    });
  }, []);

  const handleSetMovement = useCallback((direction: 'up' | 'down', active: boolean) => {
    movementRef.current[direction] = active;
  }, []);

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }

    const scaleY = STAGE_HEIGHT / rect.height;
    const pointerY = (event.clientY - rect.top) * scaleY - PADDLE_HEIGHT / 2;
    pointerTargetYRef.current = clamp(pointerY, PADDLE_MIN_Y, PADDLE_MAX_Y);
  }, []);

  const handleStagePointerLeave = useCallback(() => {
    pointerTargetYRef.current = null;
  }, []);

  const stepWorld = useCallback((deltaMs: number) => {
    setState((current) => {
      if (current.status !== 'playing') {
        return current;
      }
      const refs = physicsRef.current;
      if (!refs) {
        return current;
      }

      const deltaSeconds = deltaMs / 1000;
      let playerY = current.playerY;
      let cpuY = current.cpuY;

      if (pointerTargetYRef.current !== null) {
        playerY = pointerTargetYRef.current;
      } else {
        if (movementRef.current.up) {
          playerY -= PADDLE_SPEED * deltaSeconds;
        }
        if (movementRef.current.down) {
          playerY += PADDLE_SPEED * deltaSeconds;
        }
      }

      playerY = clamp(playerY, PADDLE_MIN_Y, PADDLE_MAX_Y);

      const cpuCenter = cpuY + PADDLE_HEIGHT / 2;
      const targetCenter = current.ballY;
      const cpuDelta = targetCenter - cpuCenter;
      const cpuStep = clamp(cpuDelta, -CPU_SPEED * deltaSeconds, CPU_SPEED * deltaSeconds);
      cpuY = clamp(cpuY + cpuStep, PADDLE_MIN_Y, PADDLE_MAX_Y);

      syncMatterPaddles(refs, playerY, cpuY);
      Matter.Engine.update(refs.engine, deltaMs);

      let { ballX, ballY, ballVx, ballVy } = getMatterBall(refs.ball);
      const paddleHit = refs.pendingPaddleHit;
      refs.pendingPaddleHit = null;

      if (paddleHit) {
        const paddleY = paddleHit === 'player' ? playerY : cpuY;
        const hitOffset = (ballY - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ballVx = Math.abs(ballVx) * 1.04 * (paddleHit === 'player' ? 1 : -1);
        ballVy += hitOffset * 140;
        ballX =
          paddleHit === 'player'
            ? PADDLE_MARGIN + PADDLE_WIDTH + BALL_RADIUS
            : STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_RADIUS;
        setMatterBall(refs.ball, { ballX, ballY, ballVx, ballVy });
      }

      const maxSpeed = 560 + current.rally * 18;
      const speed = Math.hypot(ballVx, ballVy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        ballVx *= scale;
        ballVy *= scale;
        Matter.Body.setVelocity(refs.ball, {
          x: toMatterVelocity(ballVx),
          y: toMatterVelocity(ballVy),
        });
      }

      let playerScore = current.playerScore;
      let cpuScore = current.cpuScore;
      let status: RunStatus = current.status;
      let rally = current.rally;

      if (ballX < -BALL_RADIUS) {
        cpuScore += 1;
        if (cpuScore >= WIN_SCORE) {
          status = 'lost';
        } else {
          status = 'ready';
          ballX = STAGE_WIDTH / 2;
          ballY = STAGE_HEIGHT / 2;
          ballVx = 0;
          ballVy = 0;
          rally += 1;
          setMatterBall(refs.ball, createCenteredBall());
        }
      } else if (ballX > STAGE_WIDTH + BALL_RADIUS) {
        playerScore += 1;
        if (playerScore >= WIN_SCORE) {
          status = 'won';
        } else {
          status = 'ready';
          ballX = STAGE_WIDTH / 2;
          ballY = STAGE_HEIGHT / 2;
          ballVx = 0;
          ballVy = 0;
          rally += 1;
          setMatterBall(refs.ball, createCenteredBall());
        }
      }

      return {
        ...current,
        status,
        playerY,
        cpuY,
        ballX,
        ballY,
        ballVx,
        ballVy,
        playerScore,
        cpuScore,
        rally,
        elapsedMs: current.elapsedMs + deltaMs,
      };
    });
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const deltaMs = Math.min(32, now - last);
      lastFrameRef.current = now;
      stepWorld(deltaMs);
      gameLoopRef.current = window.requestAnimationFrame(tick);
    };

    gameLoopRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [stepWorld]);

  useEffect(() => {
    const refs = createPongPhysics();
    physicsRef.current = refs;
    resetPongMatterWorld(refs, createInitialState());

    return () => {
      Matter.Composite.clear(refs.engine.world, false);
      Matter.Engine.clear(refs.engine);
      physicsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestWins(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    if (state.status !== 'won' || state.playerScore <= bestWins) {
      return;
    }
    setBestWins(state.playerScore);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.playerScore));
    }
  }, [bestWins, state.playerScore, state.status]);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'neon-pong',
        outcome: 'win',
        opponent: 'Neon CPU',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'neon-pong',
        outcome: 'loss',
        opponent: 'Neon CPU',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleSetMovement('up', true);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleSetMovement('down', true);
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleLaunch();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        handleSetMovement('up', false);
      }
      if (event.key === 'ArrowDown') {
        handleSetMovement('down', false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleLaunch, handleSetMovement]);

  const controllerSections = [
    {
      key: 'paddle',
      title: 'Paddle',
      layout: 'dpad' as const,
      buttons: [
        {
          key: 'up',
          label: 'Up',
          icon: <AiOutlineArrowUp />,
          slot: 'up' as const,
          onPointerDown: () => handleSetMovement('up', true),
          onPointerUp: () => handleSetMovement('up', false),
        },
        {
          key: 'down',
          label: 'Down',
          icon: <AiOutlineArrowDown />,
          slot: 'down' as const,
          onPointerDown: () => handleSetMovement('down', true),
          onPointerUp: () => handleSetMovement('down', false),
        },
      ],
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'launch',
          label: 'Serve',
          icon: <AiOutlineRocket />,
          onClick: handleLaunch,
          disabled: state.status !== 'ready',
        },
        {
          key: 'restart',
          label: 'Restart',
          icon: <AiOutlineReload />,
          onClick: handleRestart,
        },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Neon Pong" />

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
                  <strong>{hud.status}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>You</span>
                  <strong>{state.playerScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>CPU</span>
                  <strong>{state.cpuScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Target</span>
                  <strong>{WIN_SCORE}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best Wins</span>
                  <strong>{bestWins}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Rally</span>
                  <strong>{state.rally + 1}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Elapsed</span>
                  <strong>{hud.elapsedSeconds}s</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleLaunch} disabled={state.status !== 'ready'}>
                  <AiOutlineRocket /> Serve
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

      <section className="solo-neon-pong-shell">
        <div className="solo-neon-pong-hud">
          <div className="solo-neon-pong-hud-item">
            <span>Your Score</span>
            <strong className="solo-neon-pong-score-you">{state.playerScore}</strong>
          </div>
          <div className="solo-neon-pong-hud-item">
            <span>CPU Score</span>
            <strong className="solo-neon-pong-score-cpu">{state.cpuScore}</strong>
          </div>
          <div className="solo-neon-pong-hud-item">
            <span>Ball Speed</span>
            <strong>{hud.ballSpeed}</strong>
          </div>
          <div className="solo-neon-pong-hud-item">
            <span>Serve</span>
            <strong>{hud.serveState}</strong>
          </div>
        </div>

        <div
          className="solo-neon-pong-stage-wrap"
          onPointerDown={handleStagePointerMove}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
          role="presentation"
        >
          <div ref={stageRef} className="solo-neon-pong-stage" aria-label="Neon Pong arena">
            <div className="solo-neon-pong-glow solo-neon-pong-glow-left" aria-hidden="true" />
            <div className="solo-neon-pong-glow solo-neon-pong-glow-right" aria-hidden="true" />
            <div className="solo-neon-pong-center-line" aria-hidden="true" />
            <div
              className="solo-neon-pong-paddle solo-neon-pong-paddle-player"
              style={{
                left: toPercent(PADDLE_MARGIN, STAGE_WIDTH),
                top: toPercent(state.playerY, STAGE_HEIGHT),
                width: toPercent(PADDLE_WIDTH, STAGE_WIDTH),
                height: toPercent(PADDLE_HEIGHT, STAGE_HEIGHT),
              }}
            />
            <div
              className="solo-neon-pong-paddle solo-neon-pong-paddle-cpu"
              style={{
                left: toPercent(STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, STAGE_WIDTH),
                top: toPercent(state.cpuY, STAGE_HEIGHT),
                width: toPercent(PADDLE_WIDTH, STAGE_WIDTH),
                height: toPercent(PADDLE_HEIGHT, STAGE_HEIGHT),
              }}
            />
            <div
              className={classnames(
                'solo-neon-pong-ball',
                state.status === 'playing' && enableAnimations && 'solo-neon-pong-ball-live'
              )}
              style={{
                left: toPercent(state.ballX - BALL_RADIUS, STAGE_WIDTH),
                top: toPercent(state.ballY - BALL_RADIUS, STAGE_HEIGHT),
                width: toPercent(BALL_RADIUS * 2, STAGE_WIDTH),
                height: toPercent(BALL_RADIUS * 2, STAGE_HEIGHT),
              }}
            />
          </div>

          {state.status === 'ready' || state.status === 'won' || state.status === 'lost' ? (
            <div className="solo-neon-pong-overlay">
              <div className="solo-neon-pong-message">
                <span className={classnames('solo-neon-pong-status-pill', overlayCopy.pillClass)}>
                  {overlayCopy.pill}
                </span>
                <h2>{overlayCopy.title}</h2>
                <p>{overlayCopy.detail}</p>
                <div className="solo-neon-pong-message-actions">
                  {state.status === 'ready' ? (
                    <button className="solo-neon-pong-restart-btn" type="button" onClick={handleLaunch}>
                      <AiOutlineRocket /> Serve Ball
                    </button>
                  ) : null}
                  <button className="solo-neon-pong-restart-btn" type="button" onClick={handleRestart}>
                    <AiOutlineReload /> {state.status === 'ready' ? 'Reset Match' : 'Play Again'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="solo-neon-pong-message-inline">
          {state.status === 'won'
            ? 'Seven points secured. The arena neon is yours.'
            : state.status === 'lost'
              ? 'The CPU rallied past your guard. Serve again and own the center line.'
              : 'Move with arrows or drag across the arena. Space serves the ball and speed climbs each rally.'}
        </p>
      </section>
    </>
  );
}
