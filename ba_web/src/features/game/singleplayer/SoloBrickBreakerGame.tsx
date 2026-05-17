'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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

type SoloBrickBreakerGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
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

const updateBallDirectionAfterBrickHit = (
  previousBall: BallState,
  nextBall: BallState,
  brick: Brick
): BallState => {
  const previousLeft = previousBall.x - BALL_RADIUS;
  const previousRight = previousBall.x + BALL_RADIUS;
  const previousTop = previousBall.y - BALL_RADIUS;
  const previousBottom = previousBall.y + BALL_RADIUS;

  let vx = nextBall.vx;
  let vy = nextBall.vy;

  if (previousBottom <= brick.y || previousTop >= brick.y + brick.height) {
    vy *= -1;
  } else if (previousRight <= brick.x || previousLeft >= brick.x + brick.width) {
    vx *= -1;
  } else {
    vy *= -1;
  }

  return {
    ...nextBall,
    vx,
    vy,
  };
};

export function SoloBrickBreakerGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
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
    setState(createInitialState());
  }, []);

  const handleLaunchBall = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      return {
        ...current,
        status: 'playing',
        ball: createLaunchBall(current.paddleX, current.level),
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

        if (current.status === 'ready') {
          return {
            ...current,
            paddleX: nextPaddleX,
            ball: createDockedBall(nextPaddleX),
          };
        }

        if (current.status === 'won' || current.status === 'lost') {
          return current;
        }

        const previousBall = current.ball;
        let nextBall: BallState = {
          ...previousBall,
          x: previousBall.x + previousBall.vx * deltaSeconds,
          y: previousBall.y + previousBall.vy * deltaSeconds,
        };
        let nextBricks = current.bricks;
        let nextScore = current.score;
        let nextCombo = current.combo;
        let nextLives = current.lives;
        let nextLevel = current.level;
        let nextStatus: RunStatus = current.status;
        let nextElapsedMs = current.elapsedMs + deltaSeconds * 1000;

        if (nextBall.x - BALL_RADIUS <= 0) {
          nextBall = { ...nextBall, x: BALL_RADIUS, vx: Math.abs(nextBall.vx) };
        }
        if (nextBall.x + BALL_RADIUS >= STAGE_WIDTH) {
          nextBall = {
            ...nextBall,
            x: STAGE_WIDTH - BALL_RADIUS,
            vx: -Math.abs(nextBall.vx),
          };
        }
        if (nextBall.y - BALL_RADIUS <= 0) {
          nextBall = { ...nextBall, y: BALL_RADIUS, vy: Math.abs(nextBall.vy) };
        }

        const paddleTop = PADDLE_Y;
        const paddleBottom = PADDLE_Y + PADDLE_HEIGHT;
        const paddleLeft = nextPaddleX;
        const paddleRight = nextPaddleX + PADDLE_WIDTH;

        const touchesPaddle =
          nextBall.vy > 0 &&
          nextBall.y + BALL_RADIUS >= paddleTop &&
          nextBall.y - BALL_RADIUS <= paddleBottom &&
          nextBall.x >= paddleLeft - BALL_RADIUS &&
          nextBall.x <= paddleRight + BALL_RADIUS;

        if (touchesPaddle) {
          const hitRatio = clamp((nextBall.x - (paddleLeft + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1);
          const speed = clamp(getBallSpeed(nextBall) * 1.02, BALL_BASE_SPEED, BALL_MAX_SPEED);
          const vx = hitRatio * speed * 0.86;
          const vy = -Math.sqrt(Math.max(speed * speed - vx * vx, 42000));
          nextBall = {
            ...nextBall,
            x: clamp(nextBall.x, BALL_RADIUS, STAGE_WIDTH - BALL_RADIUS),
            y: paddleTop - BALL_RADIUS - 1,
            vx,
            vy,
          };
          nextCombo = 0;
        }

        let collidedBrickId: string | null = null;
        for (const brick of current.bricks) {
          const intersectsBrick =
            nextBall.x + BALL_RADIUS >= brick.x &&
            nextBall.x - BALL_RADIUS <= brick.x + brick.width &&
            nextBall.y + BALL_RADIUS >= brick.y &&
            nextBall.y - BALL_RADIUS <= brick.y + brick.height;

          if (!intersectsBrick) {
            continue;
          }

          collidedBrickId = brick.id;
          nextBall = updateBallDirectionAfterBrickHit(previousBall, nextBall, brick);
          nextCombo = current.combo + 1;
          const gain = 18 + current.level * 6 + nextCombo * 4;
          nextScore += gain;

          nextBricks = current.bricks.flatMap((entry) => {
            if (entry.id !== brick.id) {
              return [entry];
            }
            if (entry.hp <= 1) {
              return [];
            }
            return [{ ...entry, hp: entry.hp - 1 }];
          });
          break;
        }

        if (collidedBrickId && nextBricks.length === 0) {
          if (current.level >= MAX_LEVEL) {
            nextStatus = 'won';
            nextBall = {
              ...nextBall,
              vx: 0,
              vy: 0,
            };
          } else {
            nextLevel = current.level + 1;
            nextScore += 150 * current.level;
            nextCombo = 0;
            const levelPaddleX = createPaddleX();
            return {
              ...current,
              status: 'ready',
              paddleX: levelPaddleX,
              ball: createDockedBall(levelPaddleX),
              bricks: createBricks(nextLevel),
              score: nextScore,
              lives: nextLives,
              level: nextLevel,
              combo: nextCombo,
              elapsedMs: nextElapsedMs,
            };
          }
        }

        if (nextBall.y - BALL_RADIUS > STAGE_HEIGHT) {
          nextLives = current.lives - 1;
          if (nextLives <= 0) {
            return {
              ...current,
              status: 'lost',
              lives: 0,
              paddleX: nextPaddleX,
              ball: createDockedBall(nextPaddleX),
              combo: 0,
              elapsedMs: nextElapsedMs,
            };
          }

          const resetPaddleX = createPaddleX();
          return {
            ...current,
            status: 'ready',
            paddleX: resetPaddleX,
            ball: createDockedBall(resetPaddleX),
            bricks: nextBricks,
            score: nextScore,
            lives: nextLives,
            level: nextLevel,
            combo: 0,
            elapsedMs: nextElapsedMs,
          };
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
                <button className="room-float-action-btn" type="button" onClick={onToggleAnimations}>
                  Motion {enableAnimations ? 'On' : 'Off'}
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
