'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineInfoCircle,
  AiOutlineDrag,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

type SnakeSegment = {
  x: number;
  y: number;
};

type SnakeGameState = {
  snake: SnakeSegment[];
  food: SnakeSegment;
  direction: 'up' | 'down' | 'left' | 'right';
  nextDirection: 'up' | 'down' | 'left' | 'right';
  score: number;
  status: GameStatus;
  elapsedMs: number;
};

type SoloSnakeGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const INITIAL_SPEED = 150; // ms per move
const SPEED_INCREASE = 2; // % per food
const MAX_SPEED = 50; // ms per move minimum
const BEST_SCORE_STORAGE_KEY = 'baturo_snake_best_score';

const randomPosition = (): SnakeSegment => ({
  x: Math.floor(Math.random() * GRID_WIDTH),
  y: Math.floor(Math.random() * GRID_HEIGHT),
});

const isSnakeOnPosition = (snake: SnakeSegment[], x: number, y: number): boolean => {
  return snake.some((segment) => segment.x === x && segment.y === y);
};

const createInitialState = (): SnakeGameState => {
  const initialSnake: SnakeSegment[] = [
    { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
  ];

  let food = randomPosition();
  while (isSnakeOnPosition(initialSnake, food.x, food.y)) {
    food = randomPosition();
  }

  return {
    snake: initialSnake,
    food,
    direction: 'right',
    nextDirection: 'right',
    score: 0,
    status: 'ready',
    elapsedMs: 0,
  };
};

const getNewHead = (
  head: SnakeSegment,
  direction: 'up' | 'down' | 'left' | 'right'
): SnakeSegment => {
  let newHead = { ...head };

  if (direction === 'up') newHead.y = (head.y - 1 + GRID_HEIGHT) % GRID_HEIGHT;
  if (direction === 'down') newHead.y = (head.y + 1) % GRID_HEIGHT;
  if (direction === 'left') newHead.x = (head.x - 1 + GRID_WIDTH) % GRID_WIDTH;
  if (direction === 'right') newHead.x = (head.x + 1) % GRID_WIDTH;

  return newHead;
};

const isOppositeDirection = (
  current: 'up' | 'down' | 'left' | 'right',
  next: 'up' | 'down' | 'left' | 'right'
): boolean => {
  return (
    (current === 'up' && next === 'down') ||
    (current === 'down' && next === 'up') ||
    (current === 'left' && next === 'right') ||
    (current === 'right' && next === 'left')
  );
};

export function SoloSnakeGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloSnakeGameProps) {
  const [state, setState] = useState<SnakeGameState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastMoveTimeRef = useRef(0);
  const gameLabel = formatGameName('snake', gameDefinitions);

  const currentSpeed = useMemo(() => {
    const speedReduction = state.score * (SPEED_INCREASE / 100) * INITIAL_SPEED;
    return Math.max(MAX_SPEED, INITIAL_SPEED - speedReduction);
  }, [state.score]);

  const handleSetDirection = useCallback(
    (newDirection: 'up' | 'down' | 'left' | 'right') => {
      setState((current) => {
        if (!isOppositeDirection(current.direction, newDirection)) {
          return { ...current, nextDirection: newDirection };
        }
        return current;
      });
    },
    []
  );

  const handleNewGame = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    lastMoveTimeRef.current = 0;
    setState(createInitialState());
  }, []);

  const handleGameLoop = useCallback((now: number) => {
    setState((currentState) => {
      if (currentState.status === 'won' || currentState.status === 'lost') {
        return currentState;
      }

      const timeSinceLastMove = now - lastMoveTimeRef.current;

      if (timeSinceLastMove < currentSpeed) {
        return currentState;
      }

      lastMoveTimeRef.current = now;

      const nextDirection = !isOppositeDirection(currentState.direction, currentState.nextDirection)
        ? currentState.nextDirection
        : currentState.direction;

      const head = currentState.snake[0];
      const newHead = getNewHead(head, nextDirection);
      const eatsFood = newHead.x === currentState.food.x && newHead.y === currentState.food.y;
      const collisionSnake = eatsFood ? currentState.snake : currentState.snake.slice(0, -1);

      if (isSnakeOnPosition(collisionSnake, newHead.x, newHead.y)) {
        return {
          ...currentState,
          direction: nextDirection,
          status: 'lost',
        };
      }

      let newSnake = [newHead, ...currentState.snake];
      let newFood = currentState.food;
      let newScore = currentState.score;
      let nextStatus: GameStatus = 'playing';

      if (eatsFood) {
        newScore = currentState.score + 10;
        if (newSnake.length === GRID_WIDTH * GRID_HEIGHT) {
          nextStatus = 'won';
        } else {
          newFood = randomPosition();
          while (isSnakeOnPosition(newSnake, newFood.x, newFood.y)) {
            newFood = randomPosition();
          }
        }
      } else {
        newSnake.pop();
      }

      return {
        ...currentState,
        snake: newSnake,
        food: newFood,
        direction: nextDirection,
        score: newScore,
        status: nextStatus,
        elapsedMs: currentState.elapsedMs + timeSinceLastMove,
      };
    });
  }, [currentSpeed]);

  useEffect(() => {
    const step = (now: number) => {
      handleGameLoop(now);
      gameLoopRef.current = window.requestAnimationFrame(step);
    };

    gameLoopRef.current = window.requestAnimationFrame(step);
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [handleGameLoop]);

  useEffect(() => {
    setState((current) => ({
      ...current,
      status: current.status === 'ready' ? 'playing' : current.status,
    }));
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
    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'snake',
        outcome: 'loss',
        opponent: 'Snake',
      });
    }
  }, [state.status, onMatchComplete]);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'snake',
        outcome: 'win',
        opponent: 'Snake',
      });
    }
  }, [state.status, onMatchComplete]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleSetDirection('up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleSetDirection('down');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSetDirection('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSetDirection('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSetDirection]);

  const controllerButtons = [
    {
      key: 'up',
      label: 'Up',
      icon: <AiOutlineArrowUp />,
      slot: 'up' as const,
      onClick: () => handleSetDirection('up'),
    },
    {
      key: 'left',
      label: 'Left',
      icon: <AiOutlineArrowLeft />,
      slot: 'left' as const,
      onClick: () => handleSetDirection('left'),
    },
    {
      key: 'down',
      label: 'Down',
      icon: <AiOutlineArrowDown />,
      slot: 'down' as const,
      onClick: () => handleSetDirection('down'),
    },
    {
      key: 'right',
      label: 'Right',
      icon: <AiOutlineArrowRight />,
      slot: 'right' as const,
      onClick: () => handleSetDirection('right'),
    },
  ];

  const actionButtons = [
    { key: 'new', label: 'New', icon: <AiOutlineReload />, onClick: handleNewGame },
  ];

  const controllerSections = [
    {
      key: 'direction',
      title: 'Movement',
      layout: 'dpad' as const,
      buttons: controllerButtons,
    },
    {
      key: 'actions',
      title: 'Game Actions',
      layout: 'row' as const,
      buttons: actionButtons,
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title={'Snake'} />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4, repeat: Infinity } : undefined}
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
                  <strong>
                    {state.status === 'ready'
                      ? 'Starting'
                      : state.status === 'playing'
                        ? 'In Progress'
                        : state.status === 'won'
                          ? 'Won'
                          : 'Lost'}
                  </strong>
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
                  <span>Length</span>
                  <strong>{state.snake.length}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Speed</span>
                  <strong>{currentSpeed.toFixed(0)}ms</strong>
                </div>
              </div>

              <div className="solo-float-actions">
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

      <section className="solo-snake-shell">
        <div className="solo-snake-board" role="grid" aria-label="Snake game board">
          {Array.from({ length: GRID_HEIGHT }).map((_, y) =>
            Array.from({ length: GRID_WIDTH }).map((_, x) => {
              const isSnakeHead = state.snake[0].x === x && state.snake[0].y === y;
              const isSnakeBody = state.snake.slice(1).some((seg) => seg.x === x && seg.y === y);
              const isFood = state.food.x === x && state.food.y === y;

              return (
                <div
                  key={`${x}-${y}`}
                  className={classnames('solo-snake-cell', {
                    'solo-snake-head': isSnakeHead,
                    'solo-snake-body': isSnakeBody,
                    'solo-snake-food': isFood,
                  })}
                  style={{
                    gridColumn: x + 1,
                    gridRow: y + 1,
                  }}
                />
              );
            })
          )}
        </div>

        {(state.status === 'lost' || state.status === 'won') && (
          <div className="solo-snake-overlay">
            <div className="solo-snake-message">
              <h2>{state.status === 'won' ? 'Arena Cleared!' : 'Game Over!'}</h2>
              <p>Final Score: {state.score}</p>
              <p>Length: {state.snake.length}</p>
              <button className="solo-snake-restart-btn" onClick={handleNewGame}>
                Play Again
              </button>
            </div>
          </div>
        )}

        <p className="solo-snake-message-inline">
          {state.status === 'won'
            ? 'Full board captured. Clean run.'
            : state.status === 'lost'
              ? 'Wall-safe movement is on, so only your own trail can end the run.'
              : 'Use arrow keys or the adaptive D-pad to guide the snake and stack a higher score.'}
        </p>
      </section>
    </>
  );
}
