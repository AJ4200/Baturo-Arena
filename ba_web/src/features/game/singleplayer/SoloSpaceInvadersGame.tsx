'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type RunStatus = 'ready' | 'playing' | 'won' | 'lost';

type BulletOwner = 'player' | 'enemy';

type Bullet = {
  id: number;
  x: number;
  y: number;
  velocityY: number;
  owner: BulletOwner;
};

type Invader = {
  id: number;
  x: number;
  y: number;
  row: number;
  column: number;
};

type ShieldBlock = {
  id: number;
  x: number;
  y: number;
  hp: number;
};

type WorldState = {
  status: RunStatus;
  shipX: number;
  bullets: Bullet[];
  invaders: Invader[];
  shields: ShieldBlock[];
  direction: 1 | -1;
  invaderStepCooldownMs: number;
  enemyShotCooldownMs: number;
  playerShotCooldownMs: number;
  score: number;
  lives: number;
  wave: number;
  elapsedMs: number;
  nextId: number;
  shipsHit: number;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SoloSpaceInvadersGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const STAGE_WIDTH = 880;
const STAGE_HEIGHT = 560;
const SHIP_WIDTH = 54;
const SHIP_HEIGHT = 28;
const SHIP_Y = 492;
const INVADER_WIDTH = 44;
const INVADER_HEIGHT = 26;
const INVADER_COLUMNS = 9;
const INVADER_ROWS = 5;
const INVADER_GAP_X = 18;
const INVADER_GAP_Y = 16;
const INVADER_START_Y = 72;
const INVADER_DESCENT = 22;
const FINAL_WAVE = 3;
const SHIP_SPEED = 420;
const PLAYER_BULLET_SPEED = -620;
const ENEMY_BULLET_SPEED = 260;
const PLAYER_FIRE_COOLDOWN_MS = 220;
const MAX_PLAYER_BULLETS = 2;
const BASE_ENEMY_SHOT_COOLDOWN_MS = 1100;
const BEST_SCORE_STORAGE_KEY = 'baturo_space_invaders_best_score';
const INVADER_ROW_SCORES = [40, 30, 20, 20, 10];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const intersects = (left: Box, right: Box): boolean => {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
};

const getShipBox = (shipX: number): Box => ({
  x: shipX,
  y: SHIP_Y,
  width: SHIP_WIDTH,
  height: SHIP_HEIGHT,
});

const getBulletBox = (bullet: Bullet): Box => ({
  x: bullet.x - 2,
  y: bullet.y - 10,
  width: 4,
  height: 20,
});

const getInvaderBox = (invader: Invader): Box => ({
  x: invader.x,
  y: invader.y,
  width: INVADER_WIDTH,
  height: INVADER_HEIGHT,
});

const getShieldBox = (shield: ShieldBlock): Box => ({
  x: shield.x,
  y: shield.y,
  width: 12,
  height: 12,
});

const getInitialShipX = (): number => Math.round((STAGE_WIDTH - SHIP_WIDTH) / 2);

const getFormationWidth = (): number =>
  INVADER_COLUMNS * INVADER_WIDTH + (INVADER_COLUMNS - 1) * INVADER_GAP_X;

const getInvaderStepMs = (wave: number, remainingInvaders: number): number => {
  const formationSize = INVADER_COLUMNS * INVADER_ROWS;
  const cleared = formationSize - remainingInvaders;
  return Math.max(120, 560 - wave * 40 - cleared * 8);
};

const createInvaders = (wave: number, nextId: number): { invaders: Invader[]; nextId: number } => {
  const formationWidth = getFormationWidth();
  const startX = Math.round((STAGE_WIDTH - formationWidth) / 2);
  const invaders: Invader[] = [];
  let currentId = nextId;

  for (let row = 0; row < INVADER_ROWS; row += 1) {
    for (let column = 0; column < INVADER_COLUMNS; column += 1) {
      invaders.push({
        id: currentId,
        x: startX + column * (INVADER_WIDTH + INVADER_GAP_X),
        y: INVADER_START_Y + row * (INVADER_HEIGHT + INVADER_GAP_Y) + (wave - 1) * 6,
        row,
        column,
      });
      currentId += 1;
    }
  }

  return { invaders, nextId: currentId };
};

const createShields = (nextId: number): { shields: ShieldBlock[]; nextId: number } => {
  const shields: ShieldBlock[] = [];
  let currentId = nextId;
  const topY = SHIP_Y - 96;
  const groupWidth = 5 * 12;
  const groupStarts = [118, 312, 506, 700];

  groupStarts.forEach((startX) => {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const isCenterGap = row === 2 && column >= 1 && column <= 3;
        if (isCenterGap) {
          continue;
        }

        shields.push({
          id: currentId,
          x: startX + column * 12 - Math.round(groupWidth / 2),
          y: topY + row * 12,
          hp: row === 0 ? 3 : 2,
        });
        currentId += 1;
      }
    }
  });

  return { shields, nextId: currentId };
};

const createInitialWorld = (): WorldState => {
  const invaderSeed = createInvaders(1, 1);
  const shieldSeed = createShields(invaderSeed.nextId);

  return {
    status: 'ready',
    shipX: getInitialShipX(),
    bullets: [],
    invaders: invaderSeed.invaders,
    shields: shieldSeed.shields,
    direction: 1,
    invaderStepCooldownMs: getInvaderStepMs(1, invaderSeed.invaders.length),
    enemyShotCooldownMs: BASE_ENEMY_SHOT_COOLDOWN_MS,
    playerShotCooldownMs: 0,
    score: 0,
    lives: 3,
    wave: 1,
    elapsedMs: 0,
    nextId: shieldSeed.nextId,
    shipsHit: 0,
  };
};

const createNextWave = (world: WorldState): WorldState => {
  const nextWave = world.wave + 1;
  const invaderSeed = createInvaders(nextWave, world.nextId);
  const shieldSeed = createShields(invaderSeed.nextId);

  return {
    ...world,
    shipX: getInitialShipX(),
    bullets: [],
    invaders: invaderSeed.invaders,
    shields: shieldSeed.shields,
    direction: 1,
    invaderStepCooldownMs: getInvaderStepMs(nextWave, invaderSeed.invaders.length),
    enemyShotCooldownMs: Math.max(420, BASE_ENEMY_SHOT_COOLDOWN_MS - nextWave * 90),
    playerShotCooldownMs: 0,
    wave: nextWave,
    nextId: shieldSeed.nextId,
  };
};

const pickEnemyShooter = (invaders: Invader[]): Invader | null => {
  if (invaders.length === 0) {
    return null;
  }

  const bottomByColumn = new Map<number, Invader>();
  invaders.forEach((invader) => {
    const current = bottomByColumn.get(invader.column);
    if (!current || current.y < invader.y) {
      bottomByColumn.set(invader.column, invader);
    }
  });

  const candidates = [...bottomByColumn.values()];
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
};

const drawWorld = (
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  bestScore: number
) => {
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  const bg = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
  bg.addColorStop(0, '#050816');
  bg.addColorStop(0.55, '#0b1731');
  bg.addColorStop(1, '#12061e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  for (let star = 0; star < 80; star += 1) {
    const x = (star * 97) % STAGE_WIDTH;
    const y = (star * 53 + world.wave * 17) % (STAGE_HEIGHT - 80);
    const alpha = 0.2 + ((star % 5) * 0.12);
    ctx.fillStyle = `rgba(191, 232, 255, ${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(72, 197, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, SHIP_Y + SHIP_HEIGHT + 14);
  ctx.lineTo(STAGE_WIDTH, SHIP_Y + SHIP_HEIGHT + 14);
  ctx.stroke();

  ctx.fillStyle = 'rgba(98, 229, 184, 0.85)';
  world.shields.forEach((shield) => {
    const hpAlpha = shield.hp === 3 ? 1 : shield.hp === 2 ? 0.76 : 0.48;
    ctx.fillStyle = `rgba(98, 229, 184, ${hpAlpha})`;
    ctx.fillRect(shield.x, shield.y, 10, 10);
  });

  world.invaders.forEach((invader) => {
    const tint = ['#7ae4ff', '#59c2ff', '#ff77c8', '#ffad5b', '#ffe36d'][invader.row] || '#7ae4ff';
    ctx.fillStyle = tint;
    ctx.fillRect(invader.x + 8, invader.y, INVADER_WIDTH - 16, 6);
    ctx.fillRect(invader.x + 4, invader.y + 6, INVADER_WIDTH - 8, 10);
    ctx.fillRect(invader.x, invader.y + 16, INVADER_WIDTH, 6);
    ctx.fillRect(invader.x + 6, invader.y + 22, 6, 4);
    ctx.fillRect(invader.x + INVADER_WIDTH - 12, invader.y + 22, 6, 4);
    ctx.fillStyle = '#07111f';
    ctx.fillRect(invader.x + 10, invader.y + 9, 4, 4);
    ctx.fillRect(invader.x + INVADER_WIDTH - 14, invader.y + 9, 4, 4);
  });

  world.bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.owner === 'player' ? '#f9ff7a' : '#ff6f91';
    ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 20);
  });

  ctx.fillStyle = '#b5f4ff';
  ctx.beginPath();
  ctx.moveTo(world.shipX + SHIP_WIDTH / 2, SHIP_Y);
  ctx.lineTo(world.shipX + SHIP_WIDTH, SHIP_Y + SHIP_HEIGHT);
  ctx.lineTo(world.shipX, SHIP_Y + SHIP_HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4ad6ff';
  ctx.fillRect(world.shipX + 18, SHIP_Y + 10, SHIP_WIDTH - 36, 12);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = '600 18px Arial';
  ctx.fillText(`Score ${world.score}`, 28, 34);
  ctx.fillText(`Best ${bestScore}`, 164, 34);
  ctx.fillText(`Wave ${world.wave}/${FINAL_WAVE}`, 306, 34);
  ctx.fillText(`Lives ${world.lives}`, 468, 34);
  ctx.fillText(`Fleet ${world.invaders.length}`, 598, 34);

  if (world.status === 'ready') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '700 28px Arial';
    ctx.fillText('Wave 1 incoming', 330, 248);
    ctx.font = '500 18px Arial';
    ctx.fillText('Move with arrows or A/D. Fire with Space.', 268, 282);
  }
};

const firePlayerShot = (world: WorldState): WorldState => {
  if (
    world.status === 'won' ||
    world.status === 'lost' ||
    world.playerShotCooldownMs > 0 ||
    world.bullets.filter((bullet) => bullet.owner === 'player').length >= MAX_PLAYER_BULLETS
  ) {
    return world;
  }

  const bullet: Bullet = {
    id: world.nextId,
    x: world.shipX + SHIP_WIDTH / 2,
    y: SHIP_Y - 8,
    velocityY: PLAYER_BULLET_SPEED,
    owner: 'player',
  };

  return {
    ...world,
    bullets: [...world.bullets, bullet],
    nextId: world.nextId + 1,
    playerShotCooldownMs: PLAYER_FIRE_COOLDOWN_MS,
    status: world.status === 'ready' ? 'playing' : world.status,
  };
};

const advanceWorld = (
  world: WorldState,
  deltaMs: number,
  moveLeft: boolean,
  moveRight: boolean
): WorldState => {
  if (world.status === 'won' || world.status === 'lost') {
    return world;
  }

  const deltaSeconds = deltaMs / 1000;
  const directionX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  const nextShipX = clamp(
    world.shipX + directionX * SHIP_SPEED * deltaSeconds,
    18,
    STAGE_WIDTH - SHIP_WIDTH - 18
  );

  let bullets = world.bullets
    .map((bullet) => ({
      ...bullet,
      y: bullet.y + bullet.velocityY * deltaSeconds,
    }))
    .filter((bullet) => bullet.y > -32 && bullet.y < STAGE_HEIGHT + 32);

  let invaders = world.invaders;
  let shields = world.shields;
  let direction = world.direction;
  let nextId = world.nextId;
  let score = world.score;
  let lives = world.lives;
  let shipsHit = world.shipsHit;
  let status: RunStatus = world.status === 'ready' ? 'playing' : world.status;
  let invaderStepCooldownMs = world.invaderStepCooldownMs - deltaMs;
  let enemyShotCooldownMs = world.enemyShotCooldownMs - deltaMs;

  if (invaderStepCooldownMs <= 0 && invaders.length > 0) {
    const willTouchEdge = invaders.some((invader) => {
      const nextX = invader.x + direction * 18;
      return nextX <= 18 || nextX + INVADER_WIDTH >= STAGE_WIDTH - 18;
    });

    if (willTouchEdge) {
      direction = direction === 1 ? -1 : 1;
      invaders = invaders.map((invader) => ({
        ...invader,
        y: invader.y + INVADER_DESCENT,
      }));
    } else {
      invaders = invaders.map((invader) => ({
        ...invader,
        x: invader.x + direction * 18,
      }));
    }

    invaderStepCooldownMs = getInvaderStepMs(world.wave, invaders.length);
  }

  if (enemyShotCooldownMs <= 0 && invaders.length > 0) {
    const shooter = pickEnemyShooter(invaders);
    if (shooter) {
      bullets = [
        ...bullets,
        {
          id: nextId,
          x: shooter.x + INVADER_WIDTH / 2,
          y: shooter.y + INVADER_HEIGHT + 4,
          velocityY: ENEMY_BULLET_SPEED + world.wave * 18,
          owner: 'enemy',
        },
      ];
      nextId += 1;
    }

    enemyShotCooldownMs = Math.max(
      340,
      BASE_ENEMY_SHOT_COOLDOWN_MS - world.wave * 110 + randomBetween(-120, 120)
    );
  }

  const remainingInvaders: Invader[] = [];
  const activeBullets: Bullet[] = [];

  bullets.forEach((bullet) => {
    if (bullet.owner !== 'player') {
      activeBullets.push(bullet);
      return;
    }

    const hitIndex = invaders.findIndex((invader) =>
      intersects(getBulletBox(bullet), getInvaderBox(invader))
    );

    if (hitIndex >= 0) {
      const hitInvader = invaders[hitIndex];
      score += INVADER_ROW_SCORES[hitInvader.row] || 10;
      invaders = invaders.filter((_, index) => index !== hitIndex);
      return;
    }

    activeBullets.push(bullet);
  });

  bullets = activeBullets;

  const shieldMap = new Map<number, ShieldBlock>();
  shields.forEach((shield) => shieldMap.set(shield.id, shield));
  const filteredBullets: Bullet[] = [];

  bullets.forEach((bullet) => {
    const hitShield = [...shieldMap.values()].find((shield) =>
      intersects(getBulletBox(bullet), getShieldBox(shield))
    );

    if (hitShield) {
      if (hitShield.hp <= 1) {
        shieldMap.delete(hitShield.id);
      } else {
        shieldMap.set(hitShield.id, { ...hitShield, hp: hitShield.hp - 1 });
      }
      return;
    }

    filteredBullets.push(bullet);
  });

  bullets = filteredBullets;
  shields = [...shieldMap.values()];

  const shipBox = getShipBox(nextShipX);
  const afterShipCheck: Bullet[] = [];

  bullets.forEach((bullet) => {
    if (bullet.owner === 'enemy' && intersects(getBulletBox(bullet), shipBox)) {
      shipsHit += 1;
      lives -= 1;
      return;
    }

    afterShipCheck.push(bullet);
  });

  bullets = afterShipCheck;

  if (lives <= 0) {
    status = 'lost';
  }

  if (
    invaders.some(
      (invader) =>
        invader.y + INVADER_HEIGHT >= SHIP_Y - 10 ||
        intersects(
          getShipBox(nextShipX),
          {
            x: invader.x,
            y: invader.y,
            width: INVADER_WIDTH,
            height: INVADER_HEIGHT,
          }
        )
    )
  ) {
    status = 'lost';
  }

  if (invaders.length === 0 && status !== 'lost') {
    if (world.wave >= FINAL_WAVE) {
      status = 'won';
    } else {
      return createNextWave({
        ...world,
        status: 'playing',
        shipX: nextShipX,
        bullets: [],
        invaders,
        shields,
        direction,
        invaderStepCooldownMs,
        enemyShotCooldownMs,
        playerShotCooldownMs: Math.max(0, world.playerShotCooldownMs - deltaMs),
        score,
        lives,
        elapsedMs: world.elapsedMs + deltaMs,
        nextId,
        shipsHit,
      });
    }
  }

  invaders.forEach((invader) => remainingInvaders.push(invader));

  return {
    ...world,
    status,
    shipX: nextShipX,
    bullets,
    invaders: remainingInvaders,
    shields,
    direction,
    invaderStepCooldownMs,
    enemyShotCooldownMs,
    playerShotCooldownMs: Math.max(0, world.playerShotCooldownMs - deltaMs),
    score,
    lives,
    elapsedMs: world.elapsedMs + deltaMs,
    nextId,
    shipsHit,
  };
};

export function SoloSpaceInvadersGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloSpaceInvadersGameProps) {
  const [world, setWorld] = useState<WorldState>(createInitialWorld);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const moveLeftRef = useRef(false);
  const moveRightRef = useRef(false);
  const reportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('space-invaders', gameDefinitions);

  const hud = useMemo(
    () => ({
      score: world.score,
      wave: world.wave,
      lives: world.lives,
      enemies: world.invaders.length,
      elapsedSeconds: Math.floor(world.elapsedMs / 1000),
      shipsHit: world.shipsHit,
      status:
        world.status === 'ready'
          ? 'Deploying'
          : world.status === 'playing'
            ? 'In Progress'
            : world.status === 'won'
              ? 'Victory'
              : 'Defeated',
    }),
    [world]
  );

  const handleFire = useCallback(() => {
    setWorld((current) => firePlayerShot(current));
  }, []);

  const handleNewGame = useCallback(() => {
    reportedOutcomeRef.current = null;
    lastFrameTimeRef.current = null;
    setWorld(createInitialWorld());
  }, []);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (world.score <= bestScore) {
      return;
    }

    setBestScore(world.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(world.score));
    }
  }, [bestScore, world.score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    drawWorld(context, world, bestScore);
  }, [bestScore, world]);

  useEffect(() => {
    const step = (now: number) => {
      const lastTime = lastFrameTimeRef.current ?? now;
      const deltaMs = clamp(now - lastTime, 0, 34);
      lastFrameTimeRef.current = now;
      setWorld((current) => advanceWorld(current, deltaMs, moveLeftRef.current, moveRightRef.current));
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        moveLeftRef.current = true;
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        moveRightRef.current = true;
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        handleFire();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        moveLeftRef.current = false;
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        moveRightRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleFire]);

  useEffect(() => {
    if (world.status === 'won' && reportedOutcomeRef.current !== 'win') {
      reportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'space-invaders',
        outcome: 'win',
        opponent: 'Invaders',
      });
    } else if (world.status === 'lost' && reportedOutcomeRef.current !== 'loss') {
      reportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'space-invaders',
        outcome: 'loss',
        opponent: 'Invaders',
      });
    }
  }, [onMatchComplete, world.status]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Movement',
      layout: 'row' as const,
      buttons: [
        {
          key: 'left',
          label: 'Left',
          icon: <AiOutlineArrowLeft />,
          onPointerDown: () => {
            moveLeftRef.current = true;
          },
          onPointerUp: () => {
            moveLeftRef.current = false;
          },
        },
        {
          key: 'right',
          label: 'Right',
          icon: <AiOutlineArrowRight />,
          onPointerDown: () => {
            moveRightRef.current = true;
          },
          onPointerUp: () => {
            moveRightRef.current = false;
          },
        },
      ],
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'fire',
          label: 'Fire',
          icon: <AiOutlineCheckCircle />,
          onClick: handleFire,
        },
        {
          key: 'new',
          label: 'New',
          icon: <AiOutlineReload />,
          onClick: handleNewGame,
        },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Space Invaders" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
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
                  <span>Score</span>
                  <strong>{hud.score}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Wave</span>
                  <strong>
                    {hud.wave}/{FINAL_WAVE}
                  </strong>
                </div>
                <div className="solo-float-stat">
                  <span>Lives</span>
                  <strong>{hud.lives}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Fleet</span>
                  <strong>{hud.enemies}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Hits Taken</span>
                  <strong>{hud.shipsHit}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Elapsed</span>
                  <strong>{hud.elapsedSeconds}s</strong>
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

      <section className="solo-space-shell">
        <div className="solo-space-stage-wrap">
          <canvas
            ref={canvasRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            className="solo-space-stage"
            aria-label="Space Invaders arena"
          />
          {(world.status === 'won' || world.status === 'lost') && (
            <div className="solo-space-overlay">
              <div className="solo-space-message">
                <p
                  className={classnames(
                    'solo-space-status-pill',
                    world.status === 'won' ? 'solo-space-status-pill-win' : 'solo-space-status-pill-loss'
                  )}
                >
                  {world.status === 'won' ? 'Arena Saved' : 'Fleet Breached'}
                </p>
                <h2>{world.status === 'won' ? 'You cleared every wave.' : 'The invaders got through.'}</h2>
                <p>
                  Score {world.score} | Wave {world.wave}/{FINAL_WAVE}
                </p>
                <p>
                  Best {bestScore} | Lives left {world.lives}
                </p>
                <button className="solo-space-restart-btn" type="button" onClick={handleNewGame}>
                  Launch Again
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="solo-space-message-inline">
          {world.status === 'won'
            ? 'Three waves down. The arena is clear.'
            : world.status === 'lost'
              ? 'The fleet reached the line. Reset and try a cleaner defense.'
              : 'Move with arrows or A/D, fire with Space, and use shield cover to preserve your lives.'}
        </p>
      </section>
    </>
  );
}
