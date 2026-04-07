'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloDinoGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type RunStatus = 'ready' | 'running' | 'won' | 'crashed';

type ObstacleKind = 'cactus' | 'bird';

type Obstacle = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: ObstacleKind;
  passed: boolean;
};

type DinoWorldState = {
  status: RunStatus;
  dinoY: number;
  velocityY: number;
  wantsDuck: boolean;
  isDucking: boolean;
  obstacles: Obstacle[];
  score: number;
  speed: number;
  elapsedMs: number;
  spawnCooldown: number;
  groundOffset: number;
  jumps: number;
  dodged: number;
};

type DinoHudState = {
  status: RunStatus;
  score: number;
  bestScore: number;
  speed: number;
  elapsedSeconds: number;
  jumps: number;
  dodged: number;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const STAGE_WIDTH = 860;
const STAGE_HEIGHT = 260;
const GROUND_Y = 206;
const DINO_X = 82;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 50;
const DINO_DUCK_HEIGHT = 30;
const JUMP_STRENGTH = 12.4;
const GRAVITY = 0.72;
const SPEED_START = 6.2;
const SPEED_BOOST_MAX = 5.2;
const SPEED_BOOST_SCALE = 0.0032;
const SCORE_RATE = 0.18;
const WIN_SCORE = 1000;
const BEST_SCORE_STORAGE_KEY = 'baruto_dino_best_score';

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const createInitialWorld = (): DinoWorldState => ({
  status: 'ready',
  dinoY: 0,
  velocityY: 0,
  wantsDuck: false,
  isDucking: false,
  obstacles: [],
  score: 0,
  speed: SPEED_START,
  elapsedMs: 0,
  spawnCooldown: 160,
  groundOffset: 0,
  jumps: 0,
  dodged: 0,
});

const createHudState = (world: DinoWorldState, bestScore: number): DinoHudState => ({
  status: world.status,
  score: Math.floor(world.score),
  bestScore: Math.floor(bestScore),
  speed: Number(world.speed.toFixed(1)),
  elapsedSeconds: Math.floor(world.elapsedMs / 1000),
  jumps: world.jumps,
  dodged: world.dodged,
});

const createObstacle = (id: number, score: number): Obstacle => {
  const spawnBird = score > 220 && Math.random() < 0.34;
  if (spawnBird) {
    const flightBand = Math.random() < 0.5 ? 72 : 108;
    const width = 38;
    const height = 26;
    return {
      id,
      x: STAGE_WIDTH + randomBetween(24, 88),
      y: GROUND_Y - flightBand,
      width,
      height,
      kind: 'bird',
      passed: false,
    };
  }

  const width = Math.round(randomBetween(20, 34));
  const height = Math.round(randomBetween(42, 66));
  return {
    id,
    x: STAGE_WIDTH + randomBetween(16, 84),
    y: GROUND_Y - height,
    width,
    height,
    kind: 'cactus',
    passed: false,
  };
};

const intersects = (left: Box, right: Box): boolean => {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
};

const getDinoBox = (world: DinoWorldState): Box => {
  const width = world.isDucking ? DINO_WIDTH + 10 : DINO_WIDTH;
  const height = world.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT;
  const top = GROUND_Y - world.dinoY - height;
  return {
    x: DINO_X + 4,
    y: top + 3,
    width: width - 8,
    height: height - 6,
  };
};

const hasCollision = (world: DinoWorldState): boolean => {
  const dinoBox = getDinoBox(world);
  return world.obstacles.some((obstacle) =>
    intersects(dinoBox, {
      x: obstacle.x + 3,
      y: obstacle.y + 2,
      width: Math.max(1, obstacle.width - 6),
      height: Math.max(1, obstacle.height - 4),
    })
  );
};

const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.arc(x, y, scale * 0.3, Math.PI, 0);
  ctx.arc(x + scale * 0.28, y - scale * 0.18, scale * 0.25, Math.PI, 0);
  ctx.arc(x + scale * 0.55, y, scale * 0.3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
};

const drawWorld = (
  ctx: CanvasRenderingContext2D,
  world: DinoWorldState,
  bestScore: number
) => {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
  skyGradient.addColorStop(0, '#d6f2ff');
  skyGradient.addColorStop(0.58, '#b8dcff');
  skyGradient.addColorStop(1, '#efd8b8');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  ctx.fillStyle = 'rgba(255, 213, 99, 0.85)';
  ctx.beginPath();
  ctx.arc(STAGE_WIDTH - 74, 54, 26, 0, Math.PI * 2);
  ctx.fill();

  const cloudShift = (world.groundOffset * 0.22) % (STAGE_WIDTH + 180);
  const cloudBases = [140, 410, 730];
  cloudBases.forEach((baseX, index) => {
    let cloudX = baseX - cloudShift;
    while (cloudX < -140) {
      cloudX += STAGE_WIDTH + 200;
    }
    drawCloud(ctx, cloudX, 52 + index * 20, index === 1 ? 38 : 30);
  });

  ctx.strokeStyle = 'rgba(50, 62, 78, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(STAGE_WIDTH, GROUND_Y + 1);
  ctx.stroke();

  ctx.fillStyle = 'rgba(45, 59, 76, 0.7)';
  const stripeOffset = world.groundOffset % 38;
  for (let x = -stripeOffset; x <= STAGE_WIDTH; x += 38) {
    ctx.fillRect(x, GROUND_Y + 7, 22, 3);
  }

  world.obstacles.forEach((obstacle) => {
    if (obstacle.kind === 'cactus') {
      ctx.fillStyle = '#2f7a3f';
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillRect(obstacle.x - 6, obstacle.y + obstacle.height * 0.42, 7, 12);
      ctx.fillRect(obstacle.x + obstacle.width - 1, obstacle.y + obstacle.height * 0.3, 7, 11);
      ctx.fillStyle = 'rgba(214, 255, 218, 0.5)';
      ctx.fillRect(obstacle.x + 4, obstacle.y + 7, 2, obstacle.height - 14);
      return;
    }

    ctx.fillStyle = '#5d6077';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = '#9aa2c4';
    ctx.fillRect(obstacle.x + 6, obstacle.y + 7, obstacle.width - 12, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 9, obstacle.y + obstacle.height - 7, 6, 3);
  });

  const dinoWidth = world.isDucking ? DINO_WIDTH + 10 : DINO_WIDTH;
  const dinoHeight = world.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT;
  const dinoTop = GROUND_Y - world.dinoY - dinoHeight;
  const stepPhase = Math.floor(world.groundOffset / 8) % 2;

  ctx.fillStyle = '#1e2f47';
  ctx.fillRect(DINO_X, dinoTop, dinoWidth, dinoHeight);
  ctx.fillRect(DINO_X + dinoWidth - 14, dinoTop + 8, 10, 6);
  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(DINO_X + dinoWidth - 10, dinoTop + 10, 3, 3);

  ctx.fillStyle = '#1a2639';
  if (!world.isDucking && world.dinoY <= 0.01 && world.status === 'running') {
    ctx.fillRect(DINO_X + 7, GROUND_Y - 1, 8, stepPhase === 0 ? 12 : 7);
    ctx.fillRect(DINO_X + 25, GROUND_Y - 1, 8, stepPhase === 0 ? 7 : 12);
  } else {
    ctx.fillRect(DINO_X + 7, GROUND_Y - 1, 8, 8);
    ctx.fillRect(DINO_X + 24, GROUND_Y - 1, 8, 8);
  }

  ctx.fillStyle = 'rgba(12, 22, 36, 0.85)';
  ctx.font = '600 18px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`DIST ${Math.floor(world.score)}m`, 16, 28);
  ctx.fillText(`BEST ${Math.floor(bestScore)}m`, 16, 50);

  if (world.status !== 'running') {
    ctx.fillStyle = 'rgba(12, 16, 24, 0.52)';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    const title =
      world.status === 'ready'
        ? 'Ready to Sprint'
        : world.status === 'won'
          ? 'Distance Target Hit'
          : 'Run Crashed';
    const subtitle =
      world.status === 'ready'
        ? 'Press Space or Jump to launch.'
        : world.status === 'won'
          ? 'New Run to chase an even higher best.'
          : 'Press New Run and keep your rhythm.';

    ctx.fillStyle = '#f5f8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 30px "Courier New", monospace';
    ctx.fillText(title, STAGE_WIDTH / 2, STAGE_HEIGHT / 2 - 14);
    ctx.font = '500 16px "Courier New", monospace';
    ctx.fillText(subtitle, STAGE_WIDTH / 2, STAGE_HEIGHT / 2 + 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
};

export function SoloDinoGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloDinoGameProps) {
  const [hud, setHud] = useState<DinoHudState>(() => createHudState(createInitialWorld(), 0));
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [isDuckPressed, setIsDuckPressed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<DinoWorldState>(createInitialWorld());
  const bestScoreRef = useRef(0);
  const obstacleIdRef = useRef(1);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('dino-run', gameDefinitions);

  const syncHud = useCallback(() => {
    setHud(createHudState(worldRef.current, bestScoreRef.current));
  }, []);

  const persistBestScore = useCallback(() => {
    if (bestScoreRef.current > 0) {
      window.localStorage.setItem(
        BEST_SCORE_STORAGE_KEY,
        String(Math.floor(bestScoreRef.current))
      );
    }
  }, []);

  const reportOutcome = useCallback(
    (status: RunStatus) => {
      if (status === 'won' && lastReportedOutcomeRef.current !== 'win') {
        lastReportedOutcomeRef.current = 'win';
        onMatchComplete({
          mode: 'cpu',
          gameType: 'dino-run',
          outcome: 'win',
          opponent: 'Neon Desert',
        });
        return;
      }

      if (status === 'crashed' && lastReportedOutcomeRef.current !== 'loss') {
        lastReportedOutcomeRef.current = 'loss';
        onMatchComplete({
          mode: 'cpu',
          gameType: 'dino-run',
          outcome: 'loss',
          opponent: 'Neon Desert',
        });
      }
    },
    [onMatchComplete]
  );

  const handleNewRun = useCallback(() => {
    const nextWorld = createInitialWorld();
    nextWorld.status = 'running';
    worldRef.current = nextWorld;
    obstacleIdRef.current = 1;
    lastReportedOutcomeRef.current = null;
    setIsDuckPressed(false);
    syncHud();
  }, [syncHud]);

  const setDuckIntent = useCallback(
    (shouldDuck: boolean) => {
      const world = worldRef.current;
      if (world.status === 'won' || world.status === 'crashed') {
        world.wantsDuck = false;
        setIsDuckPressed(false);
        return;
      }

      const shouldStartRun = shouldDuck && world.status === 'ready';
      if (shouldStartRun) {
        world.status = 'running';
      }

      if (!shouldStartRun && world.wantsDuck === shouldDuck) {
        return;
      }

      world.wantsDuck = shouldDuck;
      setIsDuckPressed(shouldDuck);
      syncHud();
    },
    [syncHud]
  );

  const handleJump = useCallback(() => {
    const world = worldRef.current;
    if (world.status === 'won' || world.status === 'crashed') {
      return;
    }

    if (world.status === 'ready') {
      world.status = 'running';
    }

    if (world.dinoY <= 0.001) {
      world.velocityY = JUMP_STRENGTH;
      world.dinoY = 0.01;
      world.wantsDuck = false;
      world.isDucking = false;
      world.jumps += 1;
      setIsDuckPressed(false);
    }

    syncHud();
  }, [syncHud]);

  useEffect(() => {
    const savedBest = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsedBest = savedBest ? Number(savedBest) : 0;
    if (Number.isFinite(parsedBest) && parsedBest > 0) {
      bestScoreRef.current = parsedBest;
    }
    syncHud();

    return () => {
      persistBestScore();
    };
  }, [persistBestScore, syncHud]);

  const controllerButtons = [
    { key: 'jump', label: 'Jump', icon: <AiOutlineArrowUp />, onClick: handleJump },
    {
      key: 'duck',
      label: 'Duck',
      icon: <AiOutlineArrowDown />,
      onPointerDown: () => setDuckIntent(true),
      onPointerUp: () => setDuckIntent(false),
    },
    { key: 'new', label: 'New Run', icon: <AiOutlineReload />, onClick: handleNewRun },
    { key: 'sound', label: isMusicMuted ? 'Unmute' : 'Mute', icon: <AiOutlineSound />, onClick: onToggleMusic },
    { key: 'motion', label: enableAnimations ? 'Motion On' : 'Motion Off', icon: <AiOutlineDrag />, onClick: onToggleAnimations },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.code === 'Space' || event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault();
        if (!event.repeat) {
          handleJump();
        }
        return;
      }

      if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault();
        setDuckIntent(true);
        return;
      }

      if (
        !event.repeat &&
        (key === 'r' || event.key === 'Enter') &&
        worldRef.current.status !== 'running'
      ) {
        event.preventDefault();
        handleNewRun();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowDown' || key === 's') {
        setDuckIntent(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleJump, handleNewRun, setDuckIntent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let animationFrameId = 0;
    let previousTime = performance.now();
    let hudAccumulator = 0;

    const tick = (time: number) => {
      const deltaMs = Math.min(40, Math.max(8, time - previousTime));
      previousTime = time;
      const deltaFrames = deltaMs / (1000 / 60);
      const world = worldRef.current;
      const previousStatus = world.status;

      if (world.status === 'running') {
        world.elapsedMs += deltaMs;
        world.speed =
          SPEED_START + Math.min(SPEED_BOOST_MAX, world.score * SPEED_BOOST_SCALE);
        world.groundOffset = (world.groundOffset + world.speed * deltaFrames) % STAGE_WIDTH;
        world.spawnCooldown -= world.speed * deltaFrames;

        if (world.spawnCooldown <= 0) {
          world.obstacles.push(createObstacle(obstacleIdRef.current, world.score));
          obstacleIdRef.current += 1;
          const cooldownBase = randomBetween(152, 284);
          const cooldownReduction = Math.min(94, world.score * 0.034);
          world.spawnCooldown = Math.max(96, cooldownBase - cooldownReduction);
        }

        const survivors: Obstacle[] = [];
        for (const obstacle of world.obstacles) {
          const nextX = obstacle.x - world.speed * deltaFrames;
          const passed = obstacle.passed || nextX + obstacle.width < DINO_X + 8;
          if (!obstacle.passed && passed) {
            world.dodged += 1;
          }

          if (nextX + obstacle.width > -24) {
            survivors.push({
              ...obstacle,
              x: nextX,
              passed,
            });
          }
        }
        world.obstacles = survivors;

        if (world.wantsDuck && world.dinoY > 0) {
          world.velocityY -= GRAVITY * deltaFrames * 0.78;
        }

        world.velocityY -= GRAVITY * deltaFrames;
        world.dinoY = Math.max(0, world.dinoY + world.velocityY * deltaFrames);
        if (world.dinoY === 0 && world.velocityY < 0) {
          world.velocityY = 0;
        }

        world.isDucking = world.wantsDuck && world.dinoY <= 0.01;
        world.score += world.speed * deltaFrames * SCORE_RATE;

        if (hasCollision(world)) {
          world.status = 'crashed';
          world.velocityY = 0;
          world.isDucking = false;
          setIsDuckPressed(false);
        } else if (world.score >= WIN_SCORE) {
          world.status = 'won';
          world.velocityY = 0;
          world.isDucking = false;
          setIsDuckPressed(false);
        }

        if (world.score > bestScoreRef.current) {
          bestScoreRef.current = Math.floor(world.score);
        }
      }

      drawWorld(context, world, bestScoreRef.current);

      hudAccumulator += deltaMs;
      if (hudAccumulator >= 120 || world.status !== previousStatus) {
        syncHud();
        hudAccumulator = 0;
      }

      if (world.status !== previousStatus) {
        if (world.status === 'won') {
          reportOutcome('won');
          persistBestScore();
        } else if (world.status === 'crashed') {
          reportOutcome('crashed');
          persistBestScore();
        }
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    drawWorld(context, worldRef.current, bestScoreRef.current);
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [persistBestScore, reportOutcome, syncHud]);

  const runStatus = useMemo(() => {
    if (hud.status === 'ready') {
      return 'Ready';
    }
    if (hud.status === 'running') {
      return 'Running';
    }
    if (hud.status === 'won') {
      return 'Target Hit';
    }
    return 'Crashed';
  }, [hud.status]);

  const helperMessage = useMemo(() => {
    if (hud.status === 'ready') {
      return 'Jump over cacti, duck under low birds, and hit 1000m.';
    }
    if (hud.status === 'running') {
      return 'Controls: Space / W / Up to jump. Hold Down / S to duck.';
    }
    if (hud.status === 'won') {
      return `Target cleared at ${hud.score}m. Queue another run to push your best.`;
    }
    return 'Collision detected. Reset and keep the rhythm.';
  }, [hud.score, hud.status]);

  const runButtonLabel =
    hud.status === 'ready' ? 'Start Run' : hud.status === 'running' ? 'Restart Run' : 'New Run';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Dino Run Controller"
        subtitle="Tap jump or hold duck"
        buttons={controllerButtons}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div
          className={`room-float-card solo-room-float-card${
            isInfoCardCollapsed ? ' room-float-card-collapsed' : ''
          }`}
        >
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand game info"
              title="Expand game info"
            >
              <AiOutlineArrowUp />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor">
                  <AiOutlineDrag /> drag
                </span>
                <span className="room-float-title">{gameLabel} Solo</span>
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
                  <strong>{runStatus}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Distance</span>
                  <strong>{hud.score}m</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{hud.bestScore}m</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Dodged</span>
                  <strong>{hud.dodged}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Speed</span>
                  <strong>{hud.speed}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button
                  className={classnames('room-float-action-btn')}
                  type="button"
                  onClick={handleNewRun}
                >
                  <AiOutlineReload /> {runButtonLabel}
                </button>
                <button
                  className={classnames('room-float-action-btn')}
                  type="button"
                  disabled={hud.status === 'won' || hud.status === 'crashed'}
                  onClick={handleJump}
                >
                  <AiOutlineArrowUp /> Jump
                </button>
                <button
                  className={classnames('room-float-action-btn')}
                  type="button"
                  onClick={onToggleMusic}
                >
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  className={classnames('room-float-action-btn')}
                  type="button"
                  onClick={onToggleAnimations}
                >
                  Motion {enableAnimations ? 'On' : 'Off'}
                </button>
                <button
                  className={classnames(
                    'room-float-action-btn',
                    'room-float-action-btn-danger'
                  )}
                  type="button"
                  onClick={onLeave}
                >
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="solo-dino-shell">
        <div className="solo-dino-hud">
          <div className="solo-dino-hud-item">
            <span>Target</span>
            <strong>{WIN_SCORE}m</strong>
          </div>
          <div className="solo-dino-hud-item">
            <span>Time</span>
            <strong>{hud.elapsedSeconds}s</strong>
          </div>
          <div className="solo-dino-hud-item">
            <span>Jumps</span>
            <strong>{hud.jumps}</strong>
          </div>
          <div className="solo-dino-hud-item">
            <span>Duck</span>
            <strong>{isDuckPressed ? 'Held' : 'Off'}</strong>
          </div>
        </div>

        <div className="solo-dino-stage-wrap">
          <canvas
            ref={canvasRef}
            className="solo-dino-stage"
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            role="img"
            aria-label="Dino run board"
          />
        </div>

        <motion.div
          className="solo-dino-controls"
          animate={{ y: [5, -5, 5] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <button
            className={classnames('solo-dino-btn', 'solo-dino-btn-primary')}
            type="button"
            onClick={handleNewRun}
          >
            <AiOutlineReload /> {runButtonLabel}
          </button>
          <button
            className="solo-dino-btn"
            type="button"
            disabled={hud.status === 'won' || hud.status === 'crashed'}
            onClick={handleJump}
          >
            <AiOutlineArrowUp /> Jump
          </button>
          <button
            className={classnames(
              'solo-dino-btn',
              isDuckPressed && 'solo-dino-btn-duck-active'
            )}
            type="button"
            disabled={hud.status === 'won' || hud.status === 'crashed'}
            onPointerDown={(event) => {
              event.preventDefault();
              setDuckIntent(true);
            }}
            onPointerUp={() => setDuckIntent(false)}
            onPointerCancel={() => setDuckIntent(false)}
            onPointerLeave={() => setDuckIntent(false)}
          >
            <AiOutlineArrowDown /> Hold Duck
          </button>
        </motion.div>

        <p className="solo-dino-message">{helperMessage}</p>
      </section>
    </>
  );
}
