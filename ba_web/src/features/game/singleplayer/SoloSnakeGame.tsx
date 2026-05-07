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
  onToggleAnimations: () => void;
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
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloSnakeGameProps) {
  const [state, setState] = useState<SnakeGameState>(createInitialState);
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
    setState(createInitialState());
  }, []);

  const handleGameLoop = useCallback(() => {
    const now = performance.now();

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

      // Check if snake hits itself
      if (isSnakeOnPosition(currentState.snake, newHead.x, newHead.y)) {
        return {
          ...currentState,
          direction: nextDirection,
          status: 'lost',
        };
      }

      const eatsFood = newHead.x === currentState.food.x && newHead.y === currentState.food.y;

      let newSnake = [newHead, ...currentState.snake];
      let newFood = currentState.food;
      let newScore = currentState.score;

      if (eatsFood) {
        newScore = currentState.score + 10;
        newFood = randomPosition();
        while (isSnakeOnPosition(newSnake, newFood.x, newFood.y)) {
          newFood = randomPosition();
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
        status: 'playing',
        elapsedMs: currentState.elapsedMs + timeSinceLastMove,
      };
    });
  }, [currentSpeed]);

  // Game loop
  useEffect(() => {
    gameLoopRef.current = window.requestAnimationFrame(handleGameLoop);
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [handleGameLoop]);

  // Start game
  useEffect(() => {
    setState((current) => ({
      ...current,
      status: current.status === 'ready' ? 'playing' : current.status,
    }));
  }, []);

  // Report outcome
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

  // Keyboard controls
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
      <AdaptiveControllerOverlay sections={controllerSections} title={'Snake'} />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 4, repeat: Infinity }}
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

        {state.status === 'lost' && (
          <div className="solo-snake-overlay">
            <div className="solo-snake-message">
              <h2>Game Over!</h2>
              <p>Final Score: {state.score}</p>
              <p>Length: {state.snake.length}</p>
              <button className="solo-snake-restart-btn" onClick={handleNewGame}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .solo-snake-shell {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
          overflow: hidden;
        }

        .solo-snake-board {
          display: grid;
          grid-template-columns: repeat(${GRID_WIDTH}, 1fr);
          grid-template-rows: repeat(${GRID_HEIGHT}, 1fr);
          width: min(90vh, 600px);
          aspect-ratio: 1;
          gap: 1px;
          background: #0a0a14;
          padding: 4px;
          border-radius: 12px;
          box-shadow: 0 0 40px rgba(0, 255, 200, 0.2), inset 0 0 20px rgba(0, 0, 0, 0.5);
        }

        .solo-snake-cell {
          background: #16213e;
          border-radius: 2px;
          transition: all 0.05s ease-out;
          border: 1px solid rgba(0, 255, 200, 0.1);
        }

        .solo-snake-head {
          background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
          box-shadow: 0 0 12px rgba(0, 255, 136, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.3);
          border: 1px solid #00ff88;
        }

        .solo-snake-body {
          background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
          opacity: 0.7;
          box-shadow: 0 0 6px rgba(0, 255, 136, 0.5);
          border: 1px solid rgba(0, 255, 136, 0.5);
        }

        .solo-snake-food {
          background: linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%);
          animation: pulse 0.8s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(255, 107, 107, 0.8);
          border: 1px solid #ff6b6b;
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }

        .solo-snake-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
        }

        .solo-snake-message {
          text-align: center;
          background: rgba(10, 10, 20, 0.9);
          padding: 32px;
          border-radius: 12px;
          border: 2px solid #00ff88;
          box-shadow: 0 0 40px rgba(0, 255, 136, 0.3);
          color: #00ff88;
        }

        .solo-snake-message h2 {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 16px;
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        .solo-snake-message p {
          font-size: 18px;
          margin-bottom: 8px;
          color: #00ccff;
        }

        .solo-snake-restart-btn {
          background: linear-gradient(135deg, #00ff88 0%, #00ccff 100%);
          color: #0a0a14;
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
        }

        .solo-snake-restart-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.6);
        }

        .solo-snake-restart-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </>
  );
}
