'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Matter from 'matter-js';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
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

type BallState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Brick = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  tone: 'gold' | 'teal' | 'violet' | 'coral';
};

type BrickBreakerState = {
  status: RunStatus;
  paddleX: number;
  ball: BallState;
  bricks: Brick[];
  score: number;
  lives: number;
  level: number;
  combo: number;
  elapsedMs: number;
};

type BrickBreakerPhysicsRefs = {
  engine: Matter.Engine;
  ball: Matter.Body;
  paddle: Matter.Body;
  brickBodies: Map<string, Matter.Body>;
  pendingBrickHits: Set<string>;
  pendingPaddleHit: boolean;
};

type SoloBrickBreakerGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const STAGE_WIDTH = 900;
const STAGE_HEIGHT = 560;
const PADDLE_WIDTH = 142;
const PADDLE_HEIGHT = 18;
const PADDLE_Y = 516;
const PADDLE_SPEED = 660;
const BALL_RADIUS = 10;
const BALL_BASE_SPEED = 350;
const BALL_MAX_SPEED = 780;
const BRICK_COLUMNS = 10;
const BRICK_WIDTH = 76;
const BRICK_HEIGHT = 24;
const BRICK_GAP_X = 8;
const BRICK_GAP_Y = 10;
const BRICK_START_Y = 92;
const MAX_LEVEL = 3;
const BEST_SCORE_STORAGE_KEY = 'baturo_brick_breaker_best_score';
const MATTER_TICK_SECONDS = 1 / 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const createPaddleX = (): number => Math.round((STAGE_WIDTH - PADDLE_WIDTH) / 2);

const createDockedBall = (paddleX: number): BallState => ({
  x: paddleX + PADDLE_WIDTH / 2,
  y: PADDLE_Y - BALL_RADIUS - 2,
  vx: 0,
  vy: 0,
});

const createLaunchBall = (paddleX: number, level: number): BallState => {
  const baseSpeed = BALL_BASE_SPEED + (level - 1) * 26;
  const horizontalSeed = Math.random() < 0.5 ? -1 : 1;
  return {
    x: paddleX + PADDLE_WIDTH / 2,
    y: PADDLE_Y - BALL_RADIUS - 2,
    vx: horizontalSeed * (baseSpeed * 0.62),
    vy: -baseSpeed,
  };
};

const getBrickTone = (row: number): Brick['tone'] => {
  if (row <= 1) {
    return 'gold';
  }
  if (row <= 3) {
    return 'teal';
  }
  if (row <= 5) {
    return 'violet';
  }
  return 'coral';
};

const createBricks = (level: number): Brick[] => {
  const rows = 5 + level;
  const formationWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP_X;
  const startX = Math.round((STAGE_WIDTH - formationWidth) / 2);
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < BRICK_COLUMNS; column += 1) {
      const shouldSkip =
        (level === 2 && (row + column) % 5 === 0) ||
        (level === 3 && (row === 0 || row === rows - 1) && column % 2 === 1);

      if (shouldSkip) {
        continue;
      }

      const hp = level === 3 && row < 2 ? 2 : level === 2 && row < 2 ? 2 : 1;
      bricks.push({
        id: `L${level}-${row}-${column}`,
        x: startX + column * (BRICK_WIDTH + BRICK_GAP_X),
        y: BRICK_START_Y + row * (BRICK_HEIGHT + BRICK_GAP_Y),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        hp,
        tone: getBrickTone(row),
      });
    }
  }

  return bricks;
};

const createInitialState = (): BrickBreakerState => {
  const paddleX = createPaddleX();
  return {
    status: 'ready',
    paddleX,
    ball: createDockedBall(paddleX),
    bricks: createBricks(1),
    score: 0,
    lives: 3,
    level: 1,
    combo: 0,
    elapsedMs: 0,
  };
};

const getBallSpeed = (ball: BallState): number => Math.hypot(ball.vx, ball.vy);

const toMatterVelocity = (velocity: number): number => velocity * MATTER_TICK_SECONDS;

const fromMatterVelocity = (velocity: number): number => velocity / MATTER_TICK_SECONDS;

const setMatterBallFromState = (body: Matter.Body, ball: BallState): void => {
  Matter.Body.setPosition(body, { x: ball.x, y: ball.y });
  Matter.Body.setVelocity(body, {
    x: toMatterVelocity(ball.vx),
    y: toMatterVelocity(ball.vy),
  });
  Matter.Body.setAngularVelocity(body, 0);
};

const getMatterBallState = (body: Matter.Body): BallState => ({
  x: body.position.x,
  y: body.position.y,
  vx: fromMatterVelocity(body.velocity.x),
  vy: fromMatterVelocity(body.velocity.y),
});

const clampMatterBallSpeed = (body: Matter.Body): void => {
  const ball = getMatterBallState(body);
  const speed = getBallSpeed(ball);
  if (speed <= 0) {
    return;
  }

  const nextSpeed = clamp(speed, BALL_BASE_SPEED, BALL_MAX_SPEED);
  if (Math.abs(nextSpeed - speed) < 0.1) {
    return;
  }

  const ratio = nextSpeed / speed;
  Matter.Body.setVelocity(body, {
    x: body.velocity.x * ratio,
    y: body.velocity.y * ratio,
  });
};

const createMatterBrick = (brick: Brick): Matter.Body =>
  Matter.Bodies.rectangle(
    brick.x + brick.width / 2,
    brick.y + brick.height / 2,
    brick.width,
    brick.height,
    {
      isStatic: true,
      restitution: 1.05,
      friction: 0,
      label: `brick:${brick.id}`,
    }
  );

const syncMatterBricks = (refs: BrickBreakerPhysicsRefs, bricks: Brick[]): void => {
  const wantedIds = new Set(bricks.map((brick) => brick.id));

  refs.brickBodies.forEach((body, id) => {
    if (!wantedIds.has(id)) {
      Matter.Composite.remove(refs.engine.world, body);
      refs.brickBodies.delete(id);
    }
  });

  bricks.forEach((brick) => {
    if (refs.brickBodies.has(brick.id)) {
      return;
    }

    const body = createMatterBrick(brick);
    refs.brickBodies.set(brick.id, body);
    Matter.Composite.add(refs.engine.world, body);
  });
};

const resetMatterWorld = (refs: BrickBreakerPhysicsRefs, state: BrickBreakerState): void => {
  refs.pendingBrickHits.clear();
  refs.pendingPaddleHit = false;
  Matter.Body.setPosition(refs.paddle, {
    x: state.paddleX + PADDLE_WIDTH / 2,
    y: PADDLE_Y + PADDLE_HEIGHT / 2,
  });
  setMatterBallFromState(refs.ball, state.ball);
  syncMatterBricks(refs, state.bricks);
};

const createBrickBreakerPhysics = (): BrickBreakerPhysicsRefs => {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
  });
  const initialPaddleX = createPaddleX();
  const ball = Matter.Bodies.circle(
    initialPaddleX + PADDLE_WIDTH / 2,
    PADDLE_Y - BALL_RADIUS - 2,
    BALL_RADIUS,
    {
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      inertia: Infinity,
      label: 'ball',
    }
  );
  const paddle = Matter.Bodies.rectangle(
    initialPaddleX + PADDLE_WIDTH / 2,
    PADDLE_Y + PADDLE_HEIGHT / 2,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    {
      isStatic: true,
      restitution: 1.08,
      friction: 0,
      label: 'paddle',
    }
  );
  const walls = [
    Matter.Bodies.rectangle(-12, STAGE_HEIGHT / 2, 24, STAGE_HEIGHT, {
      isStatic: true,
      restitution: 1,
      friction: 0,
      label: 'wall:left',
    }),
    Matter.Bodies.rectangle(STAGE_WIDTH + 12, STAGE_HEIGHT / 2, 24, STAGE_HEIGHT, {
      isStatic: true,
      restitution: 1,
      friction: 0,
      label: 'wall:right',
    }),
    Matter.Bodies.rectangle(STAGE_WIDTH / 2, -12, STAGE_WIDTH, 24, {
      isStatic: true,
      restitution: 1,
      friction: 0,
      label: 'wall:top',
    }),
  ];
  const refs: BrickBreakerPhysicsRefs = {
    engine,
    ball,
    paddle,
    brickBodies: new Map(),
    pendingBrickHits: new Set(),
    pendingPaddleHit: false,
  };

  Matter.Composite.add(engine.world, [ball, paddle, ...walls]);
  Matter.Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes('ball')) {
        return;
      }

      const brickLabel = labels.find((label) => label.startsWith('brick:'));
      if (brickLabel) {
        refs.pendingBrickHits.add(brickLabel.replace('brick:', ''));
        return;
      }

      if (labels.includes('paddle')) {
        refs.pendingPaddleHit = true;
      }
    });
  });

  return refs;
};

export function SoloBrickBreakerGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloBrickBreakerGameProps) {
  const [state, setState] = useState<BrickBreakerState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const leftPressedRef = useRef(false);
  const rightPressedRef = useRef(false);
  const physicsRef = useRef<BrickBreakerPhysicsRefs | null>(null);
  const gameLabel = formatGameName('brickbreaker', gameDefinitions);

  const aliveBricks = state.bricks.length;
  const statusLabel = useMemo(() => {
    if (state.status === 'won') {
      return 'Arena Cleared';
    }
    if (state.status === 'lost') {
      return 'Out of Lives';
    }
    if (state.status === 'playing') {
      return 'In Play';
    }
    return 'Ready to Launch';
  }, [state.status]);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    lastFrameTimeRef.current = null;
    const nextState = createInitialState();
    if (physicsRef.current) {
      resetMatterWorld(physicsRef.current, nextState);
    }
    setState(nextState);
  }, []);

  const handleLaunchBall = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      const nextBall = createLaunchBall(current.paddleX, current.level);
      if (physicsRef.current) {
        setMatterBallFromState(physicsRef.current.ball, nextBall);
      }
      return {
        ...current,
        status: 'playing',
        ball: nextBall,
      };
    });
  }, []);

  const handleSetMovement = useCallback((direction: 'left' | 'right', isPressed: boolean) => {
    if (direction === 'left') {
      leftPressedRef.current = isPressed;
      return;
    }
    rightPressedRef.current = isPressed;
  }, []);

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    const pointerRatio = (event.clientX - bounds.left) / bounds.width;
    const nextPaddleX = clamp(pointerRatio * STAGE_WIDTH - PADDLE_WIDTH / 2, 0, STAGE_WIDTH - PADDLE_WIDTH);
    setState((current) => {
      const nextBall =
        current.status === 'ready'
          ? createDockedBall(nextPaddleX)
          : current.ball;
      return {
        ...current,
        paddleX: nextPaddleX,
        ball: nextBall,
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
    const refs = createBrickBreakerPhysics();
    physicsRef.current = refs;
    resetMatterWorld(refs, createInitialState());

    return () => {
      Matter.Composite.clear(refs.engine.world, false);
      Matter.Engine.clear(refs.engine);
      physicsRef.current = null;
    };
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
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        leftPressedRef.current = true;
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        rightPressedRef.current = true;
      } else if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
        event.preventDefault();
        handleLaunchBall();
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleRestart();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        leftPressedRef.current = false;
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        rightPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleLaunchBall, handleRestart]);

  useEffect(() => {
    const step = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSeconds = Math.min((now - lastFrameTimeRef.current) / 1000, 0.032);
      lastFrameTimeRef.current = now;

      setState((current) => {
        const moveDirection =
          (leftPressedRef.current ? -1 : 0) + (rightPressedRef.current ? 1 : 0);
        const nextPaddleX = clamp(
          current.paddleX + moveDirection * PADDLE_SPEED * deltaSeconds,
          0,
          STAGE_WIDTH - PADDLE_WIDTH
        );
        const refs = physicsRef.current;

        if (current.status === 'ready') {
          const nextBall = createDockedBall(nextPaddleX);
          if (refs) {
            Matter.Body.setPosition(refs.paddle, {
              x: nextPaddleX + PADDLE_WIDTH / 2,
              y: PADDLE_Y + PADDLE_HEIGHT / 2,
            });
            setMatterBallFromState(refs.ball, nextBall);
            syncMatterBricks(refs, current.bricks);
          }
          return {
            ...current,
            paddleX: nextPaddleX,
            ball: nextBall,
          };
        }

        if (current.status === 'won' || current.status === 'lost') {
          return current;
        }

        if (!refs) {
          return current;
        }

        Matter.Body.setPosition(refs.paddle, {
          x: nextPaddleX + PADDLE_WIDTH / 2,
          y: PADDLE_Y + PADDLE_HEIGHT / 2,
        });
        syncMatterBricks(refs, current.bricks);
        Matter.Engine.update(refs.engine, deltaSeconds * 1000);

        const hitBrickIds = Array.from(refs.pendingBrickHits);
        const hitPaddle = refs.pendingPaddleHit;
        refs.pendingBrickHits.clear();
        refs.pendingPaddleHit = false;

        let nextBall = getMatterBallState(refs.ball);
        let nextBricks = current.bricks;
        let nextScore = current.score;
        let nextCombo = current.combo;
        let nextLives = current.lives;
        let nextLevel = current.level;
        let nextStatus: RunStatus = current.status;
        let nextElapsedMs = current.elapsedMs + deltaSeconds * 1000;

        if (hitPaddle) {
          const hitRatio = clamp(
            (refs.ball.position.x - (nextPaddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2),
            -1,
            1
          );
          const speed = clamp(getBallSpeed(nextBall) * 1.02, BALL_BASE_SPEED, BALL_MAX_SPEED);
          const vx = hitRatio * speed * 0.86;
          const vy = -Math.sqrt(Math.max(speed * speed - vx * vx, 42000));
          Matter.Body.setPosition(refs.ball, {
            x: clamp(refs.ball.position.x, BALL_RADIUS, STAGE_WIDTH - BALL_RADIUS),
            y: PADDLE_Y - BALL_RADIUS - 1,
          });
          Matter.Body.setVelocity(refs.ball, {
            x: toMatterVelocity(vx),
            y: toMatterVelocity(vy),
          });
          nextBall = {
            x: refs.ball.position.x,
            y: refs.ball.position.y,
            vx,
            vy,
          };
          nextCombo = 0;
        }

        const hitBrick = hitBrickIds
          .map((id) => current.bricks.find((brick) => brick.id === id))
          .find((brick): brick is Brick => Boolean(brick));
        if (hitBrick) {
          nextCombo = current.combo + 1;
          const gain = 18 + current.level * 6 + nextCombo * 4;
          nextScore += gain;

          nextBricks = current.bricks.flatMap((entry) => {
            if (entry.id !== hitBrick.id) {
              return [entry];
            }
            if (entry.hp <= 1) {
              const body = refs.brickBodies.get(entry.id);
              if (body) {
                Matter.Composite.remove(refs.engine.world, body);
                refs.brickBodies.delete(entry.id);
              }
              return [];
            }
            return [{ ...entry, hp: entry.hp - 1 }];
          });
        }

        clampMatterBallSpeed(refs.ball);
        nextBall = getMatterBallState(refs.ball);

        if (hitBrick && nextBricks.length === 0) {
          if (current.level >= MAX_LEVEL) {
            nextStatus = 'won';
            nextBall = {
              ...nextBall,
              vx: 0,
              vy: 0,
            };
            setMatterBallFromState(refs.ball, nextBall);
          } else {
            nextLevel = current.level + 1;
            nextScore += 150 * current.level;
            nextCombo = 0;
            const levelPaddleX = createPaddleX();
            const nextState = {
              ...current,
              status: 'ready' as const,
              paddleX: levelPaddleX,
              ball: createDockedBall(levelPaddleX),
              bricks: createBricks(nextLevel),
              score: nextScore,
              lives: nextLives,
              level: nextLevel,
              combo: nextCombo,
              elapsedMs: nextElapsedMs,
            };
            resetMatterWorld(refs, nextState);
            return {
              ...nextState,
            };
          }
        }

        if (nextBall.y - BALL_RADIUS > STAGE_HEIGHT) {
          nextLives = current.lives - 1;
          if (nextLives <= 0) {
            const nextState = {
              ...current,
              status: 'lost' as const,
              lives: 0,
              paddleX: nextPaddleX,
              ball: createDockedBall(nextPaddleX),
              bricks: nextBricks,
              score: nextScore,
              level: nextLevel,
              combo: 0,
              elapsedMs: nextElapsedMs,
            };
            resetMatterWorld(refs, nextState);
            return nextState;
          }

          const resetPaddleX = createPaddleX();
          const nextState = {
            ...current,
            status: 'ready' as const,
            paddleX: resetPaddleX,
            ball: createDockedBall(resetPaddleX),
            bricks: nextBricks,
            score: nextScore,
            lives: nextLives,
            level: nextLevel,
            combo: 0,
            elapsedMs: nextElapsedMs,
          };
          resetMatterWorld(refs, nextState);
          return nextState;
        }

        return {
          ...current,
          status: nextStatus,
          paddleX: nextPaddleX,
          ball: nextBall,
          bricks: nextBricks,
          score: nextScore,
          lives: nextLives,
          level: nextLevel,
          combo: nextCombo,
          elapsedMs: nextElapsedMs,
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
        gameType: 'brickbreaker',
        outcome: 'win',
        opponent: 'Arena Bricks',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'brickbreaker',
        outcome: 'loss',
        opponent: 'Arena Bricks',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Paddle',
      layout: 'dpad' as const,
      buttons: [
        {
          key: 'left',
          label: 'Left',
          icon: <AiOutlineArrowLeft />,
          slot: 'left' as const,
          onPointerDown: () => handleSetMovement('left', true),
          onPointerUp: () => handleSetMovement('left', false),
        },
        {
          key: 'right',
          label: 'Right',
          icon: <AiOutlineArrowRight />,
          slot: 'right' as const,
          onPointerDown: () => handleSetMovement('right', true),
          onPointerUp: () => handleSetMovement('right', false),
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
          label: state.status === 'ready' ? 'Launch' : 'Live',
          icon: <AiOutlineRocket />,
          onClick: handleLaunchBall,
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

      <AdaptiveControllerOverlay
        sections={controllerSections}
        title="Brick Breaker"
        subtitle="Arrow keys or drag the stage to keep the rally alive"
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.4, repeat: Infinity } : undefined}
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
                  <AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Run
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

              <div className="room-score-strip">
                <span className="room-float-line">
                  <AiOutlineCheckCircle /> {statusLabel}
                </span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Player</span>
                  <strong>{player.name}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Score</span>
                  <strong>{state.score}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Lives</span>
                  <strong>{state.lives}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Level</span>
                  <strong>{state.level} / {MAX_LEVEL}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Combo</span>
                  <strong>x{Math.max(1, state.combo)}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleLaunchBall} disabled={state.status !== 'ready'}>
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

      <section className="solo-brick-shell">
        <div className="solo-brick-hud">
          <div className="solo-brick-hud-item">
            <span>Bricks Left</span>
            <strong>{aliveBricks}</strong>
          </div>
          <div className="solo-brick-hud-item">
            <span>Ball Speed</span>
            <strong>{Math.round(getBallSpeed(state.ball))}</strong>
          </div>
          <div className="solo-brick-hud-item">
            <span>Time</span>
            <strong>{(state.elapsedMs / 1000).toFixed(1)}s</strong>
          </div>
          <div className="solo-brick-hud-item">
            <span>Serve</span>
            <strong>{state.status === 'ready' ? 'Waiting' : state.status === 'playing' ? 'Active' : 'Closed'}</strong>
          </div>
        </div>

        <div
          className="solo-brick-stage-wrap"
          onPointerDown={handleStagePointerMove}
          onPointerMove={handleStagePointerMove}
          role="presentation"
        >
          <div className="solo-brick-stage">
            <div className="solo-brick-glow solo-brick-glow-top" />
            <div className="solo-brick-glow solo-brick-glow-bottom" />

            {state.bricks.map((brick) => (
              <div
                key={brick.id}
                className={`solo-brick-brick solo-brick-brick-${brick.tone} solo-brick-brick-hp-${brick.hp}`}
                style={{
                  left: brick.x,
                  top: brick.y,
                  width: brick.width,
                  height: brick.height,
                }}
              >
                <span>{brick.hp > 1 ? `x${brick.hp}` : ''}</span>
              </div>
            ))}

            <div
              className="solo-brick-paddle"
              style={{
                left: state.paddleX,
                top: PADDLE_Y,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
              }}
            />

            <div
              className="solo-brick-ball"
              style={{
                left: state.ball.x - BALL_RADIUS,
                top: state.ball.y - BALL_RADIUS,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
              }}
            />
          </div>

          {(state.status === 'won' || state.status === 'lost' || state.status === 'ready') ? (
            <div className="solo-brick-overlay">
              <div className="solo-brick-message">
                <span
                  className={`solo-brick-status-pill ${
                    state.status === 'won'
                      ? 'solo-brick-status-pill-win'
                      : state.status === 'lost'
                        ? 'solo-brick-status-pill-loss'
                        : 'solo-brick-status-pill-ready'
                  }`}
                >
                  {state.status === 'won' ? 'Victory' : state.status === 'lost' ? 'Run Over' : 'Serve Ready'}
                </span>
                <h2>
                  {state.status === 'won'
                    ? 'Board Cleared'
                    : state.status === 'lost'
                      ? 'The bricks held'
                      : state.level === 1 && state.score === 0
                        ? 'Launch when ready'
                        : `Level ${state.level} ready`}
                </h2>
                <p>
                  {state.status === 'won'
                    ? `Final score ${state.score}. Clean sweep through all ${MAX_LEVEL} rounds.`
                    : state.status === 'lost'
                      ? `Final score ${state.score}. Restart to run the stack again.`
                      : 'Press Launch, Enter, or tap the rocket control to send the ball out.'}
                </p>
                <div className="solo-brick-message-actions">
                  {state.status !== 'won' && state.status !== 'lost' ? (
                    <button className="solo-brick-restart-btn" type="button" onClick={handleLaunchBall}>
                      <AiOutlineRocket /> Launch Ball
                    </button>
                  ) : null}
                  <button className="solo-brick-restart-btn" type="button" onClick={handleRestart}>
                    <AiOutlineReload /> Play Again
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="solo-brick-message-inline">
          Drag across the stage or use arrow keys to slide the paddle. Clearing a wave docks the next serve so you can reset before the speed climbs again.
        </p>
      </section>
    </>
  );
}
