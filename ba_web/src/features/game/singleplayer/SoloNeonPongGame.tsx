'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
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
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const STAGE_WIDTH = 760;
const STAGE_HEIGHT = 440;
const PADDLE_WIDTH = 14;
const PADDLE_HEIGHT = 96;
const PADDLE_MARGIN = 22;
const BALL_RADIUS = 9;
const WIN_SCORE = 7;
const PADDLE_SPEED = 420;
const CPU_SPEED = 340;
const BALL_BASE_SPEED = 300;
const BEST_SCORE_STORAGE_KEY = 'baturo_neon_pong_best_wins';

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

const launchBall = (rally: number, towardPlayer = Math.random() < 0.5): Pick<PongState, 'ballVx' | 'ballVy'> => {
  const speed = BALL_BASE_SPEED + rally * 12;
  const angle = (Math.random() * 0.7 - 0.35) * Math.PI;
  const direction = towardPlayer ? -1 : 1;
  return {
    ballVx: Math.cos(angle) * speed * direction,
    ballVy: Math.sin(angle) * speed,
  };
};

export function SoloNeonPongGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloNeonPongGameProps) {
  const [state, setState] = useState<PongState>(createInitialState);
  const [bestWins, setBestWins] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const movementRef = useRef({ up: false, down: false });
  const lastReportedOutcomeRef = useRef<MatchResultEvent['outcome'] | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const gameLoopRef = useRef<number | null>(null);

  const gameLabel = useMemo(() => formatGameName('neon-pong', gameDefinitions), [gameDefinitions]);

  const statusLabel = useMemo(() => {
    if (state.status === 'ready') return 'Press Launch to serve';
    if (state.status === 'won') return 'Arena Champion';
    if (state.status === 'lost') return 'CPU Takes the Crown';
    return 'Rally Live';
  }, [state.status]);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setState(createInitialState());
  }, []);

  const handleLaunch = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      const velocity = launchBall(current.rally);
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

  const stepWorld = useCallback((deltaMs: number) => {
    setState((current) => {
      if (current.status !== 'playing') {
        return current;
      }

      const deltaSeconds = deltaMs / 1000;
      let playerY = current.playerY;
      let cpuY = current.cpuY;

      if (movementRef.current.up) {
        playerY -= PADDLE_SPEED * deltaSeconds;
      }
      if (movementRef.current.down) {
        playerY += PADDLE_SPEED * deltaSeconds;
      }

      const paddleMin = 12;
      const paddleMax = STAGE_HEIGHT - PADDLE_HEIGHT - 12;
      playerY = clamp(playerY, paddleMin, paddleMax);

      const cpuCenter = cpuY + PADDLE_HEIGHT / 2;
      const targetCenter = current.ballY;
      const cpuDelta = targetCenter - cpuCenter;
      const cpuStep = clamp(cpuDelta, -CPU_SPEED * deltaSeconds, CPU_SPEED * deltaSeconds);
      cpuY = clamp(cpuY + cpuStep, paddleMin, paddleMax);

      let ballX = current.ballX + current.ballVx * deltaSeconds;
      let ballY = current.ballY + current.ballVy * deltaSeconds;
      let ballVx = current.ballVx;
      let ballVy = current.ballVy;

      if (ballY - BALL_RADIUS <= 0) {
        ballY = BALL_RADIUS;
        ballVy = Math.abs(ballVy);
      } else if (ballY + BALL_RADIUS >= STAGE_HEIGHT) {
        ballY = STAGE_HEIGHT - BALL_RADIUS;
        ballVy = -Math.abs(ballVy);
      }

      const playerPaddleX = PADDLE_MARGIN;
      const cpuPaddleX = STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH;

      const hitsPaddle = (
        side: 'player' | 'cpu',
        paddleX: number,
        paddleY: number
      ): boolean => {
        const movingToward =
          side === 'player' ? ballVx < 0 && ballX - BALL_RADIUS <= paddleX + PADDLE_WIDTH : ballVx > 0 && ballX + BALL_RADIUS >= paddleX;
        if (!movingToward) {
          return false;
        }

        const withinY = ballY + BALL_RADIUS >= paddleY && ballY - BALL_RADIUS <= paddleY + PADDLE_HEIGHT;
        return withinY;
      };

      if (hitsPaddle('player', playerPaddleX, playerY)) {
        ballX = playerPaddleX + PADDLE_WIDTH + BALL_RADIUS;
        ballVx = Math.abs(ballVx) * 1.04;
        const hitOffset = (ballY - (playerY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ballVy += hitOffset * 140;
      }

      if (hitsPaddle('cpu', cpuPaddleX, cpuY)) {
        ballX = cpuPaddleX - BALL_RADIUS;
        ballVx = -Math.abs(ballVx) * 1.04;
        const hitOffset = (ballY - (cpuY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        ballVy += hitOffset * 140;
      }

      const maxSpeed = 560 + current.rally * 18;
      const speed = Math.hypot(ballVx, ballVy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        ballVx *= scale;
        ballVy *= scale;
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

      <AdaptiveControllerOverlay
        sections={controllerSections}
        title="Neon Pong"
        subtitle="Arrow keys move your paddle. Space serves."
      />

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

      <section className="solo-neon-pong-shell ba-scroll-surface">
        <div className="solo-neon-pong-hud">
          <span className="solo-neon-pong-score solo-neon-pong-score-player">{state.playerScore}</span>
          <span className="solo-neon-pong-hud-label">{statusLabel}</span>
          <span className="solo-neon-pong-score solo-neon-pong-score-cpu">{state.cpuScore}</span>
        </div>

        <button
          type="button"
          className="solo-neon-pong-stage"
          onClick={state.status === 'ready' ? handleLaunch : undefined}
          aria-label={state.status === 'ready' ? 'Serve ball' : 'Neon pong arena'}
        >
          <div
            className="solo-neon-pong-court"
            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
          >
            <div className="solo-neon-pong-center-line" aria-hidden="true" />
            <div
              className="solo-neon-pong-paddle solo-neon-pong-paddle-player"
              style={{
                transform: `translate(${PADDLE_MARGIN}px, ${state.playerY}px)`,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
              }}
            />
            <div
              className="solo-neon-pong-paddle solo-neon-pong-paddle-cpu"
              style={{
                transform: `translate(${STAGE_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH}px, ${state.cpuY}px)`,
                width: PADDLE_WIDTH,
                height: PADDLE_HEIGHT,
              }}
            />
            <div
              className={classnames('solo-neon-pong-ball', state.status === 'playing' && 'solo-neon-pong-ball-live')}
              style={{
                transform: `translate(${state.ballX - BALL_RADIUS}px, ${state.ballY - BALL_RADIUS}px)`,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
              }}
            />
          </div>

          {state.status === 'ready' ? (
            <div className="solo-neon-pong-overlay">
              <strong>Serve to Start</strong>
              <span>First to {WIN_SCORE} wins the neon crown</span>
            </div>
          ) : null}

          {state.status === 'won' || state.status === 'lost' ? (
            <div className="solo-neon-pong-overlay">
              <strong>{state.status === 'won' ? 'You Win!' : 'CPU Wins'}</strong>
              <button className="solo-neon-pong-restart-btn" type="button" onClick={handleRestart}>
                Play Again
              </button>
            </div>
          ) : null}
        </button>
      </section>
    </>
  );
}
