'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRobot,
  AiOutlineSound,
  AiOutlineTeam,
  AiOutlineThunderbolt,
  AiOutlineUser,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import type { ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile } from '@/types/game';

type MatchPhase = 'faceoff' | 'playing' | 'goal' | 'won';
type Side = 'left' | 'right';
type DirectionKey = 'up' | 'down' | 'left' | 'right';

type PaddleState = {
  x: number;
  y: number;
};

type PuckState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type AirHockeyState = {
  phase: MatchPhase;
  leftScore: number;
  rightScore: number;
  round: number;
  leftPaddle: PaddleState;
  rightPaddle: PaddleState;
  puck: PuckState;
  lastScorer: Side | null;
  serveTo: Side;
  elapsedMs: number;
};

type AirHockeyArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const TABLE_WIDTH = 920;
const TABLE_HEIGHT = 540;
const GOAL_HEIGHT = 170;
const GOAL_TOP = Math.round((TABLE_HEIGHT - GOAL_HEIGHT) / 2);
const GOAL_BOTTOM = GOAL_TOP + GOAL_HEIGHT;
const CENTER_LINE_X = TABLE_WIDTH / 2;
const TABLE_PADDING = 18;
const PADDLE_RADIUS = 28;
const PUCK_RADIUS = 18;
const PADDLE_SPEED = 420;
const CPU_SPEED = 360;
const PADDLE_SHOT_BOOST = 0.35;
const FACE_OFF_DELAY_MS = 850;
const MATCH_POINT = 5;
const MIN_PUCK_SPEED = 260;
const MAX_PUCK_SPEED = 760;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getLeftBounds = () => ({
  minX: TABLE_PADDING + PADDLE_RADIUS,
  maxX: CENTER_LINE_X - PADDLE_RADIUS - 10,
  minY: TABLE_PADDING + PADDLE_RADIUS,
  maxY: TABLE_HEIGHT - TABLE_PADDING - PADDLE_RADIUS,
});

const getRightBounds = () => ({
  minX: CENTER_LINE_X + PADDLE_RADIUS + 10,
  maxX: TABLE_WIDTH - TABLE_PADDING - PADDLE_RADIUS,
  minY: TABLE_PADDING + PADDLE_RADIUS,
  maxY: TABLE_HEIGHT - TABLE_PADDING - PADDLE_RADIUS,
});

const createPaddles = (): { leftPaddle: PaddleState; rightPaddle: PaddleState } => ({
  leftPaddle: {
    x: 148,
    y: TABLE_HEIGHT / 2,
  },
  rightPaddle: {
    x: TABLE_WIDTH - 148,
    y: TABLE_HEIGHT / 2,
  },
});

const createFaceoffPuck = (): PuckState => ({
  x: TABLE_WIDTH / 2,
  y: TABLE_HEIGHT / 2,
  vx: 0,
  vy: 0,
});

const launchPuck = (serveTo: Side): PuckState => {
  const horizontalDirection = serveTo === 'left' ? -1 : 1;
  const speed = 320 + Math.random() * 55;
  return {
    x: TABLE_WIDTH / 2,
    y: TABLE_HEIGHT / 2 + (Math.random() * 70 - 35),
    vx: horizontalDirection * speed,
    vy: Math.random() * 180 - 90,
  };
};

const createInitialState = (): AirHockeyState => {
  const paddles = createPaddles();
  return {
    phase: 'faceoff',
    leftScore: 0,
    rightScore: 0,
    round: 1,
    ...paddles,
    puck: createFaceoffPuck(),
    lastScorer: null,
    serveTo: 'right',
    elapsedMs: 0,
  };
};

const normalizeVector = (x: number, y: number): { x: number; y: number } => {
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
};

const getModeLabel = (mode: GameMode): string => {
  if (mode === 'cpu') {
    return 'CPU Match';
  }
  return 'Local Match';
};

const getModeSubtitle = (mode: GameMode): string => {
  if (mode === 'cpu') {
    return 'WASD or arrow keys for you, arena AI on the far side';
  }
  return 'WASD drives the left paddle, arrow keys drive the right paddle';
};

export function AirHockeyArenaGame({
  player,
  mode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: AirHockeyArenaGameProps) {
  const [state, setState] = useState<AirHockeyState>(createInitialState);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const faceoffTimerRef = useRef<number | null>(null);
  const leftInputRef = useRef<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const rightInputRef = useRef<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const gameLabel = formatGameName('air-hockey', gameDefinitions);
  const statusLabel = useMemo(() => {
    if (state.phase === 'won') {
      return state.leftScore > state.rightScore ? `${player.name} wins` : mode === 'cpu' ? 'Arena CPU wins' : 'Right side wins';
    }
    if (state.phase === 'goal') {
      return state.lastScorer === 'left'
        ? `${player.name} scores`
        : mode === 'cpu'
          ? 'Arena CPU scores'
          : 'Right side scores';
    }
    if (state.phase === 'faceoff') {
      return `Faceoff ${state.round}`;
    }
    return 'Puck live';
  }, [mode, player.name, state.lastScorer, state.leftScore, state.phase, state.rightScore, state.round]);

  const handleRematch = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    lastFrameTimeRef.current = null;
    setState(createInitialState());
  }, []);

  const handleSetInput = useCallback(
    (side: Side, direction: DirectionKey, isPressed: boolean) => {
      const targetRef = side === 'left' ? leftInputRef : rightInputRef;
      targetRef.current[direction] = isPressed;
    },
    []
  );

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const xRatio = (event.clientX - bounds.left) / bounds.width;
    const yRatio = (event.clientY - bounds.top) / bounds.height;
    const targetX = clamp(xRatio * TABLE_WIDTH, TABLE_PADDING, TABLE_WIDTH - TABLE_PADDING);
    const targetY = clamp(yRatio * TABLE_HEIGHT, TABLE_PADDING, TABLE_HEIGHT - TABLE_PADDING);

    setState((current) => {
      if (xRatio <= 0.5) {
        const leftBounds = getLeftBounds();
        return {
          ...current,
          leftPaddle: {
            x: clamp(targetX, leftBounds.minX, leftBounds.maxX),
            y: clamp(targetY, leftBounds.minY, leftBounds.maxY),
          },
        };
      }

      if (mode === 'cpu') {
        return current;
      }

      const rightBounds = getRightBounds();
      return {
        ...current,
        rightPaddle: {
          x: clamp(targetX, rightBounds.minX, rightBounds.maxX),
          y: clamp(targetY, rightBounds.minY, rightBounds.maxY),
        },
      };
    });
  }, [mode]);

  useEffect(() => {
    if (faceoffTimerRef.current !== null) {
      window.clearTimeout(faceoffTimerRef.current);
      faceoffTimerRef.current = null;
    }

    if ((state.phase === 'faceoff' || state.phase === 'goal') && state.leftScore < MATCH_POINT && state.rightScore < MATCH_POINT) {
      faceoffTimerRef.current = window.setTimeout(() => {
        setState((current) => {
          if (current.phase !== 'faceoff' && current.phase !== 'goal') {
            return current;
          }
          return {
            ...current,
            phase: 'playing',
            puck: launchPuck(current.serveTo),
          };
        });
      }, FACE_OFF_DELAY_MS);
    }

    return () => {
      if (faceoffTimerRef.current !== null) {
        window.clearTimeout(faceoffTimerRef.current);
        faceoffTimerRef.current = null;
      }
    };
  }, [state.leftScore, state.phase, state.rightScore]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        leftInputRef.current.up = true;
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        leftInputRef.current.down = true;
      } else if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        leftInputRef.current.left = true;
      } else if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        leftInputRef.current.right = true;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        rightInputRef.current.up = true;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        rightInputRef.current.down = true;
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rightInputRef.current.left = true;
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        rightInputRef.current.right = true;
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleRematch();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'W') {
        leftInputRef.current.up = false;
      } else if (event.key === 's' || event.key === 'S') {
        leftInputRef.current.down = false;
      } else if (event.key === 'a' || event.key === 'A') {
        leftInputRef.current.left = false;
      } else if (event.key === 'd' || event.key === 'D') {
        leftInputRef.current.right = false;
      } else if (event.key === 'ArrowUp') {
        rightInputRef.current.up = false;
      } else if (event.key === 'ArrowDown') {
        rightInputRef.current.down = false;
      } else if (event.key === 'ArrowLeft') {
        rightInputRef.current.left = false;
      } else if (event.key === 'ArrowRight') {
        rightInputRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRematch]);

  useEffect(() => {
    const step = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSeconds = Math.min((now - lastFrameTimeRef.current) / 1000, 0.032);
      lastFrameTimeRef.current = now;

      setState((current) => {
        if (current.phase === 'won') {
          return current;
        }

        const leftBounds = getLeftBounds();
        const rightBounds = getRightBounds();
        const leftDirectionX = (leftInputRef.current.right ? 1 : 0) - (leftInputRef.current.left ? 1 : 0);
        const leftDirectionY = (leftInputRef.current.down ? 1 : 0) - (leftInputRef.current.up ? 1 : 0);
        const leftMove = normalizeVector(leftDirectionX, leftDirectionY);
        let nextLeftPaddle: PaddleState = {
          x: clamp(current.leftPaddle.x + leftMove.x * PADDLE_SPEED * deltaSeconds, leftBounds.minX, leftBounds.maxX),
          y: clamp(current.leftPaddle.y + leftMove.y * PADDLE_SPEED * deltaSeconds, leftBounds.minY, leftBounds.maxY),
        };

        let nextRightPaddle = current.rightPaddle;
        if (mode === 'cpu') {
          const cpuTargetX =
            current.puck.x > CENTER_LINE_X
              ? clamp(current.puck.x + 62, rightBounds.minX, rightBounds.maxX)
              : clamp(TABLE_WIDTH - 148, rightBounds.minX, rightBounds.maxX);
          const cpuTargetY =
            current.puck.x > CENTER_LINE_X
              ? clamp(current.puck.y, rightBounds.minY, rightBounds.maxY)
              : TABLE_HEIGHT / 2;
          const deltaX = cpuTargetX - current.rightPaddle.x;
          const deltaY = cpuTargetY - current.rightPaddle.y;
          const cpuDirection = normalizeVector(deltaX, deltaY);
          const cpuDistance = Math.hypot(deltaX, deltaY);
          const cpuStep = Math.min(cpuDistance, CPU_SPEED * deltaSeconds);
          nextRightPaddle = {
            x: clamp(current.rightPaddle.x + cpuDirection.x * cpuStep, rightBounds.minX, rightBounds.maxX),
            y: clamp(current.rightPaddle.y + cpuDirection.y * cpuStep, rightBounds.minY, rightBounds.maxY),
          };
        } else {
          const rightDirectionX = (rightInputRef.current.right ? 1 : 0) - (rightInputRef.current.left ? 1 : 0);
          const rightDirectionY = (rightInputRef.current.down ? 1 : 0) - (rightInputRef.current.up ? 1 : 0);
          const rightMove = normalizeVector(rightDirectionX, rightDirectionY);
          nextRightPaddle = {
            x: clamp(current.rightPaddle.x + rightMove.x * PADDLE_SPEED * deltaSeconds, rightBounds.minX, rightBounds.maxX),
            y: clamp(current.rightPaddle.y + rightMove.y * PADDLE_SPEED * deltaSeconds, rightBounds.minY, rightBounds.maxY),
          };
        }

        if (current.phase !== 'playing') {
          return {
            ...current,
            leftPaddle: nextLeftPaddle,
            rightPaddle: nextRightPaddle,
          };
        }

        const leftPaddleVelocity = {
          x: nextLeftPaddle.x - current.leftPaddle.x,
          y: nextLeftPaddle.y - current.leftPaddle.y,
        };
        const rightPaddleVelocity = {
          x: nextRightPaddle.x - current.rightPaddle.x,
          y: nextRightPaddle.y - current.rightPaddle.y,
        };

        let nextPuck: PuckState = {
          ...current.puck,
          x: current.puck.x + current.puck.vx * deltaSeconds,
          y: current.puck.y + current.puck.vy * deltaSeconds,
        };

        const damping = Math.pow(0.992, deltaSeconds * 60);
        nextPuck.vx *= damping;
        nextPuck.vy *= damping;
        const clampedSpeed = clamp(Math.hypot(nextPuck.vx, nextPuck.vy), MIN_PUCK_SPEED, MAX_PUCK_SPEED);
        const speedNorm = normalizeVector(nextPuck.vx, nextPuck.vy);
        nextPuck.vx = speedNorm.x * clampedSpeed;
        nextPuck.vy = speedNorm.y * clampedSpeed;

        if (nextPuck.y - PUCK_RADIUS <= TABLE_PADDING) {
          nextPuck.y = TABLE_PADDING + PUCK_RADIUS;
          nextPuck.vy = Math.abs(nextPuck.vy);
        }
        if (nextPuck.y + PUCK_RADIUS >= TABLE_HEIGHT - TABLE_PADDING) {
          nextPuck.y = TABLE_HEIGHT - TABLE_PADDING - PUCK_RADIUS;
          nextPuck.vy = -Math.abs(nextPuck.vy);
        }

        const resolvePaddleCollision = (
          puck: PuckState,
          paddle: PaddleState,
          paddleVelocity: { x: number; y: number }
        ): PuckState => {
          const dx = puck.x - paddle.x;
          const dy = puck.y - paddle.y;
          const distance = Math.hypot(dx, dy);
          const minDistance = PUCK_RADIUS + PADDLE_RADIUS;

          if (distance <= 0 || distance >= minDistance) {
            return puck;
          }

          const normal = normalizeVector(dx, dy);
          const overlap = minDistance - distance;
          const relativeVx = puck.vx + paddleVelocity.x * PADDLE_SHOT_BOOST;
          const relativeVy = puck.vy + paddleVelocity.y * PADDLE_SHOT_BOOST;
          const dot = relativeVx * normal.x + relativeVy * normal.y;
          const reflectedVx = relativeVx - 2 * dot * normal.x;
          const reflectedVy = relativeVy - 2 * dot * normal.y;
          const speed = clamp(Math.hypot(reflectedVx, reflectedVy) * 1.02, MIN_PUCK_SPEED, MAX_PUCK_SPEED);
          const direction = normalizeVector(reflectedVx, reflectedVy);

          return {
            x: puck.x + normal.x * overlap,
            y: puck.y + normal.y * overlap,
            vx: direction.x * speed,
            vy: direction.y * speed,
          };
        };

        nextPuck = resolvePaddleCollision(nextPuck, nextLeftPaddle, leftPaddleVelocity);
        nextPuck = resolvePaddleCollision(nextPuck, nextRightPaddle, rightPaddleVelocity);

        const inGoalWindow = nextPuck.y >= GOAL_TOP && nextPuck.y <= GOAL_BOTTOM;
        if (nextPuck.x - PUCK_RADIUS <= TABLE_PADDING) {
          if (inGoalWindow) {
            const nextRightScore = current.rightScore + 1;
            const won = nextRightScore >= MATCH_POINT;
            const resetPaddles = createPaddles();
            return {
              ...current,
              phase: won ? 'won' : 'goal',
              leftScore: current.leftScore,
              rightScore: nextRightScore,
              round: current.round + 1,
              ...resetPaddles,
              puck: createFaceoffPuck(),
              lastScorer: 'right',
              serveTo: 'left',
              elapsedMs: current.elapsedMs + deltaSeconds * 1000,
            };
          }
          nextPuck.x = TABLE_PADDING + PUCK_RADIUS;
          nextPuck.vx = Math.abs(nextPuck.vx);
        }

        if (nextPuck.x + PUCK_RADIUS >= TABLE_WIDTH - TABLE_PADDING) {
          if (inGoalWindow) {
            const nextLeftScore = current.leftScore + 1;
            const won = nextLeftScore >= MATCH_POINT;
            const resetPaddles = createPaddles();
            return {
              ...current,
              phase: won ? 'won' : 'goal',
              leftScore: nextLeftScore,
              rightScore: current.rightScore,
              round: current.round + 1,
              ...resetPaddles,
              puck: createFaceoffPuck(),
              lastScorer: 'left',
              serveTo: 'right',
              elapsedMs: current.elapsedMs + deltaSeconds * 1000,
            };
          }
          nextPuck.x = TABLE_WIDTH - TABLE_PADDING - PUCK_RADIUS;
          nextPuck.vx = -Math.abs(nextPuck.vx);
        }

        return {
          ...current,
          leftPaddle: nextLeftPaddle,
          rightPaddle: nextRightPaddle,
          puck: nextPuck,
          elapsedMs: current.elapsedMs + deltaSeconds * 1000,
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
  }, [mode]);

  useEffect(() => {
    if (state.phase !== 'won') {
      return;
    }
    const outcome = state.leftScore > state.rightScore ? 'win' : 'loss';
    if (lastReportedOutcomeRef.current === outcome) {
      return;
    }

    lastReportedOutcomeRef.current = outcome;
    onMatchComplete({
      mode,
      gameType: 'air-hockey',
      outcome,
      opponent: mode === 'cpu' ? 'Arena CPU' : 'Local Opponent',
    });
  }, [mode, onMatchComplete, state.leftScore, state.phase, state.rightScore]);

  const controllerSections = useMemo<ControllerSection[]>(() => {
    const leftButtons = [
      {
        key: 'left-up',
        label: 'Up',
        icon: <AiOutlineArrowUp />,
        slot: 'up' as const,
        onPointerDown: () => handleSetInput('left', 'up', true),
        onPointerUp: () => handleSetInput('left', 'up', false),
      },
      {
        key: 'left-left',
        label: 'Left',
        icon: <AiOutlineArrowLeft />,
        slot: 'left' as const,
        onPointerDown: () => handleSetInput('left', 'left', true),
        onPointerUp: () => handleSetInput('left', 'left', false),
      },
      {
        key: 'left-down',
        label: 'Down',
        icon: <AiOutlineArrowDown />,
        slot: 'down' as const,
        onPointerDown: () => handleSetInput('left', 'down', true),
        onPointerUp: () => handleSetInput('left', 'down', false),
      },
      {
        key: 'left-right',
        label: 'Right',
        icon: <AiOutlineArrowRight />,
        slot: 'right' as const,
        onPointerDown: () => handleSetInput('left', 'right', true),
        onPointerUp: () => handleSetInput('left', 'right', false),
      },
    ];

    const sections: ControllerSection[] = [
      {
        key: 'left-paddle',
        title: `${player.name} Paddle`,
        subtitle: 'WASD',
        layout: 'dpad' as const,
        buttons: leftButtons,
      },
    ];

    if (mode !== 'cpu') {
      sections.push({
        key: 'right-paddle',
        title: 'Right Paddle',
        subtitle: 'Arrow keys',
        layout: 'dpad' as const,
        buttons: [
          {
            key: 'right-up',
            label: 'Up',
            icon: <AiOutlineArrowUp />,
            slot: 'up' as const,
            onPointerDown: () => handleSetInput('right', 'up', true),
            onPointerUp: () => handleSetInput('right', 'up', false),
          },
          {
            key: 'right-left',
            label: 'Left',
            icon: <AiOutlineArrowLeft />,
            slot: 'left' as const,
            onPointerDown: () => handleSetInput('right', 'left', true),
            onPointerUp: () => handleSetInput('right', 'left', false),
          },
          {
            key: 'right-down',
            label: 'Down',
            icon: <AiOutlineArrowDown />,
            slot: 'down' as const,
            onPointerDown: () => handleSetInput('right', 'down', true),
            onPointerUp: () => handleSetInput('right', 'down', false),
          },
          {
            key: 'right-right',
            label: 'Right',
            icon: <AiOutlineArrowRight />,
            slot: 'right' as const,
            onPointerDown: () => handleSetInput('right', 'right', true),
            onPointerUp: () => handleSetInput('right', 'right', false),
          },
        ],
      });
    }

    sections.push({
      key: 'match-actions',
      title: 'Match Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'rematch',
          label: 'Rematch',
          icon: <AiOutlineReload />,
          onClick: handleRematch,
        },
      ],
    });

    return sections;
  }, [handleRematch, handleSetInput, mode, player.name]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        sections={controllerSections}
        title={getModeLabel(mode)}
        subtitle={getModeSubtitle(mode)}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [4, -4, 4] } : undefined}
        transition={enableAnimations ? { duration: 4.2, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand match info"
              title="Expand match info"
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
                  <AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} {getModeLabel(mode)}
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse match info"
                  title="Collapse match info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line">
                  {state.phase === 'playing' ? <AiOutlineThunderbolt /> : state.phase === 'won' ? <AiOutlineCheckCircle /> : <AiOutlineClockCircle />}{' '}
                  {statusLabel}
                </span>
              </div>

              <div className="room-joined">
                <p className="room-joined-title">
                  {mode === 'cpu' ? <AiOutlineRobot /> : <AiOutlineTeam />} Players
                </p>
                <p className="room-joined-line">
                  <AiOutlineUser /> {player.name} | Left Paddle
                </p>
                <p className="room-joined-line">
                  {mode === 'cpu' ? <AiOutlineRobot /> : <AiOutlineUser />}{' '}
                  {mode === 'cpu' ? 'Arena CPU' : 'Right Paddle Rival'}
                </p>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Round</span>
                  <strong>{state.round}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Score</span>
                  <strong>{state.leftScore} : {state.rightScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Phase</span>
                  <strong>{state.phase === 'won' ? 'Finished' : state.phase === 'goal' ? 'Resetting' : state.phase === 'faceoff' ? 'Faceoff' : 'Live'}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{(state.elapsedMs / 1000).toFixed(1)}s</strong>
                </div>
              </div>

              <div className="room-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleRematch}>
                  <AiOutlineReload /> Rematch
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

      <section className="air-hockey-shell">
        <div className="air-hockey-scoreboard">
          <div className="air-hockey-score-team air-hockey-score-team-left">
            <span>{player.name}</span>
            <strong>{state.leftScore}</strong>
          </div>
          <div className="air-hockey-score-center">
            <span>{state.phase === 'faceoff' ? 'Faceoff' : state.phase === 'goal' ? 'Reset' : state.phase === 'won' ? 'Final' : 'Live'}</span>
            <strong>{gameLabel}</strong>
          </div>
          <div className="air-hockey-score-team air-hockey-score-team-right">
            <span>{mode === 'cpu' ? 'Arena CPU' : 'Right Paddle'}</span>
            <strong>{state.rightScore}</strong>
          </div>
        </div>

        <div
          className="air-hockey-stage-wrap"
          onPointerDown={handleStagePointerMove}
          onPointerMove={handleStagePointerMove}
          role="presentation"
        >
          <div className="air-hockey-stage">
            <div className="air-hockey-center-line" />
            <div className="air-hockey-center-circle" />
            <div className="air-hockey-goal air-hockey-goal-left" />
            <div className="air-hockey-goal air-hockey-goal-right" />
            <div className="air-hockey-faceoff-dot air-hockey-faceoff-dot-top" />
            <div className="air-hockey-faceoff-dot air-hockey-faceoff-dot-bottom" />

            <div
              className="air-hockey-paddle air-hockey-paddle-left"
              style={{
                left: state.leftPaddle.x - PADDLE_RADIUS,
                top: state.leftPaddle.y - PADDLE_RADIUS,
                width: PADDLE_RADIUS * 2,
                height: PADDLE_RADIUS * 2,
              }}
            />

            <div
              className={classnames(
                'air-hockey-paddle',
                'air-hockey-paddle-right',
                mode === 'cpu' && 'air-hockey-paddle-cpu'
              )}
              style={{
                left: state.rightPaddle.x - PADDLE_RADIUS,
                top: state.rightPaddle.y - PADDLE_RADIUS,
                width: PADDLE_RADIUS * 2,
                height: PADDLE_RADIUS * 2,
              }}
            />

            <div
              className="air-hockey-puck"
              style={{
                left: state.puck.x - PUCK_RADIUS,
                top: state.puck.y - PUCK_RADIUS,
                width: PUCK_RADIUS * 2,
                height: PUCK_RADIUS * 2,
              }}
            />
          </div>

          {state.phase !== 'playing' ? (
            <div className="air-hockey-overlay">
              <div className="air-hockey-message">
                <span
                  className={classnames(
                    'air-hockey-status-pill',
                    state.phase === 'won' ? 'air-hockey-status-pill-win' : 'air-hockey-status-pill-ready'
                  )}
                >
                  {state.phase === 'won' ? 'Match Complete' : state.phase === 'goal' ? 'Goal Scored' : 'Faceoff'}
                </span>
                <h2>
                  {state.phase === 'won'
                    ? state.leftScore > state.rightScore
                      ? `${player.name} takes it`
                      : mode === 'cpu'
                        ? 'Arena CPU takes it'
                        : 'Right side takes it'
                    : state.phase === 'goal'
                      ? 'Resetting the puck'
                      : 'Stick ready'}
                </h2>
                <p>
                  {state.phase === 'won'
                    ? `Final score ${state.leftScore} to ${state.rightScore}.`
                    : state.phase === 'goal'
                      ? 'Next faceoff is loading at center ice.'
                      : mode === 'cpu'
                        ? 'Move with WASD. The AI will meet you on the far half after the whistle.'
                        : 'Left side uses WASD and right side uses arrow keys once the puck drops.'}
                </p>
                {state.phase === 'won' ? (
                  <button className="air-hockey-rematch-btn" type="button" onClick={handleRematch}>
                    <AiOutlineReload /> Rematch
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <p className="air-hockey-message-inline">
          Keep your paddle inside your half, bank the puck off the rails, and race to {MATCH_POINT}. Pointer dragging works on either half of the table too.
        </p>
      </section>
    </>
  );
}
