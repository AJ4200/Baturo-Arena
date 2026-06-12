'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { GiCrosshair, GiExitDoor, GiHealthNormal } from 'react-icons/gi';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type RunStatus = 'ready' | 'playing' | 'won' | 'lost';
type EnemyKind = 'crawler' | 'warden';
type PickupKind = 'ammo' | 'health';

type Enemy = {
  id: number;
  x: number;
  y: number;
  hp: number;
  kind: EnemyKind;
  attackCooldownMs: number;
  hurtMs: number;
};

type Pickup = {
  id: number;
  x: number;
  y: number;
  kind: PickupKind;
  active: boolean;
};

type World = {
  status: RunStatus;
  playerX: number;
  playerY: number;
  angle: number;
  health: number;
  ammo: number;
  score: number;
  elapsedMs: number;
  shotCooldownMs: number;
  muzzleMs: number;
  damageMs: number;
  enemies: Enemy[];
  pickups: Pickup[];
  kills: number;
  message: string;
};

type InputState = {
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  sprint: boolean;
};

type SoloDreadSectorGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const FOV = Math.PI / 3;
const RAY_COUNT = 240;
const MAX_DEPTH = 20;
const MOVE_SPEED = 2.35;
const TURN_SPEED = 2.25;
const MOUSE_LOOK_SENSITIVITY = 0.0024;
const PLAYER_RADIUS = 0.2;
const SHOT_COOLDOWN_MS = 330;
const BEST_SCORE_KEY = 'baturo_dread_sector_best_score';

const MAP = [
  '1111111111111111',
  '1000000000000001',
  '1020111111101201',
  '1000100000100001',
  '1110103300101111',
  '1000100000100001',
  '1011110111110101',
  '1000000000000001',
  '1030111111101301',
  '1000100000100001',
  '1110102200101111',
  '1000100000100001',
  '1011110111110101',
  '1000000000000001',
  '10000000000000E1',
  '1111111111111111',
];

const ENEMY_SEED: Array<Omit<Enemy, 'attackCooldownMs' | 'hurtMs'>> = [
  { id: 1, x: 6.5, y: 1.5, hp: 2, kind: 'crawler' },
  { id: 2, x: 12.5, y: 3.5, hp: 2, kind: 'crawler' },
  { id: 3, x: 2.5, y: 5.5, hp: 2, kind: 'crawler' },
  { id: 4, x: 8.5, y: 7.5, hp: 3, kind: 'warden' },
  { id: 5, x: 13.5, y: 8.5, hp: 2, kind: 'crawler' },
  { id: 6, x: 3.5, y: 11.5, hp: 3, kind: 'warden' },
  { id: 7, x: 10.5, y: 13.5, hp: 2, kind: 'crawler' },
  { id: 8, x: 13.5, y: 13.5, hp: 3, kind: 'warden' },
];

const PICKUP_SEED: Pickup[] = [
  { id: 1, x: 3.5, y: 3.5, kind: 'ammo', active: true },
  { id: 2, x: 12.5, y: 5.5, kind: 'health', active: true },
  { id: 3, x: 6.5, y: 9.5, kind: 'ammo', active: true },
  { id: 4, x: 13.5, y: 11.5, kind: 'health', active: true },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
};

const getMapCell = (x: number, y: number): string => {
  const row = Math.floor(y);
  const column = Math.floor(x);
  if (row < 0 || row >= MAP.length || column < 0 || column >= MAP[0].length) {
    return '1';
  }
  return MAP[row][column];
};

const isWall = (x: number, y: number): boolean => {
  const cell = getMapCell(x, y);
  return cell !== '0' && cell !== 'E';
};

const canOccupy = (x: number, y: number): boolean =>
  !isWall(x - PLAYER_RADIUS, y - PLAYER_RADIUS) &&
  !isWall(x + PLAYER_RADIUS, y - PLAYER_RADIUS) &&
  !isWall(x - PLAYER_RADIUS, y + PLAYER_RADIUS) &&
  !isWall(x + PLAYER_RADIUS, y + PLAYER_RADIUS);

const createWorld = (): World => ({
  status: 'ready',
  playerX: 1.5,
  playerY: 1.5,
  angle: 0,
  health: 100,
  ammo: 28,
  score: 0,
  elapsedMs: 0,
  shotCooldownMs: 0,
  muzzleMs: 0,
  damageMs: 0,
  enemies: ENEMY_SEED.map((enemy) => ({ ...enemy, attackCooldownMs: 0, hurtMs: 0 })),
  pickups: PICKUP_SEED.map((pickup) => ({ ...pickup })),
  kills: 0,
  message: 'Purge the sector. The extraction gate unlocks after all hostiles fall.',
});

const castRay = (originX: number, originY: number, angle: number) => {
  const step = 0.025;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let distance = 0;
  let hitCell = '1';
  let hitX = originX;
  let hitY = originY;

  while (distance < MAX_DEPTH) {
    distance += step;
    hitX = originX + cos * distance;
    hitY = originY + sin * distance;
    hitCell = getMapCell(hitX, hitY);
    if (hitCell !== '0' && hitCell !== 'E') {
      break;
    }
  }

  const fractionalX = hitX - Math.floor(hitX);
  const fractionalY = hitY - Math.floor(hitY);
  const edge = Math.min(fractionalX, 1 - fractionalX, fractionalY, 1 - fractionalY);
  return { distance, cell: hitCell, edge };
};

const hasLineOfSight = (fromX: number, fromY: number, toX: number, toY: number): boolean => {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const angle = Math.atan2(toY - fromY, toX - fromX);
  return castRay(fromX, fromY, angle).distance + 0.08 >= distance;
};

const drawEnemy = (
  context: CanvasRenderingContext2D,
  enemy: Enemy,
  screenX: number,
  centerY: number,
  size: number
) => {
  const warden = enemy.kind === 'warden';
  const bodyColor = enemy.hurtMs > 0 ? '#fff6d5' : warden ? '#c92f21' : '#8dbf35';
  context.save();
  context.translate(screenX, centerY);
  context.shadowBlur = size * 0.16;
  context.shadowColor = warden ? '#ff3c24' : '#adff42';
  context.fillStyle = bodyColor;
  context.strokeStyle = '#1b0906';
  context.lineWidth = Math.max(2, size * 0.035);

  context.beginPath();
  context.moveTo(-size * 0.28, size * 0.34);
  context.lineTo(-size * 0.38, -size * 0.02);
  context.lineTo(-size * 0.18, -size * 0.38);
  context.lineTo(0, -size * 0.5);
  context.lineTo(size * 0.18, -size * 0.38);
  context.lineTo(size * 0.38, -size * 0.02);
  context.lineTo(size * 0.28, size * 0.34);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#ffe36a';
  context.fillRect(-size * 0.22, -size * 0.16, size * 0.13, size * 0.08);
  context.fillRect(size * 0.09, -size * 0.16, size * 0.13, size * 0.08);
  context.fillStyle = '#090706';
  context.fillRect(-size * 0.18, -size * 0.14, size * 0.05, size * 0.05);
  context.fillRect(size * 0.13, -size * 0.14, size * 0.05, size * 0.05);

  context.fillStyle = '#240805';
  context.fillRect(-size * 0.19, size * 0.05, size * 0.38, size * 0.12);
  context.fillStyle = '#eee1c1';
  for (let tooth = 0; tooth < 4; tooth += 1) {
    context.fillRect(-size * 0.16 + tooth * size * 0.09, size * 0.05, size * 0.045, size * 0.07);
  }

  if (warden) {
    context.fillStyle = '#3d0b08';
    context.beginPath();
    context.moveTo(-size * 0.18, -size * 0.38);
    context.lineTo(-size * 0.32, -size * 0.58);
    context.lineTo(-size * 0.05, -size * 0.43);
    context.fill();
    context.beginPath();
    context.moveTo(size * 0.18, -size * 0.38);
    context.lineTo(size * 0.32, -size * 0.58);
    context.lineTo(size * 0.05, -size * 0.43);
    context.fill();
  }
  context.restore();
};

const drawWorld = (canvas: HTMLCanvasElement, world: World) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const horizon = VIEW_HEIGHT * 0.48;
  const sky = context.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#12070a');
  sky.addColorStop(1, '#5e1715');
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEW_WIDTH, horizon);

  const floor = context.createLinearGradient(0, horizon, 0, VIEW_HEIGHT);
  floor.addColorStop(0, '#28251f');
  floor.addColorStop(1, '#080807');
  context.fillStyle = floor;
  context.fillRect(0, horizon, VIEW_WIDTH, VIEW_HEIGHT - horizon);

  const depthBuffer = new Array<number>(RAY_COUNT);
  const columnWidth = VIEW_WIDTH / RAY_COUNT;
  for (let ray = 0; ray < RAY_COUNT; ray += 1) {
    const rayAngle = world.angle - FOV / 2 + (ray / RAY_COUNT) * FOV;
    const hit = castRay(world.playerX, world.playerY, rayAngle);
    const correctedDistance = Math.max(0.01, hit.distance * Math.cos(rayAngle - world.angle));
    depthBuffer[ray] = correctedDistance;
    const wallHeight = Math.min(VIEW_HEIGHT * 1.6, VIEW_HEIGHT / correctedDistance);
    const top = horizon - wallHeight / 2;
    const shade = clamp(1 - correctedDistance / MAX_DEPTH, 0.12, 1);
    const texturePulse = hit.edge < 0.05 ? 0.72 : 1;
    const base =
      hit.cell === '2'
        ? [96, 110, 119]
        : hit.cell === '3'
          ? [111, 48, 34]
          : [119, 84, 52];
    context.fillStyle = `rgb(${Math.floor(base[0] * shade * texturePulse)}, ${Math.floor(
      base[1] * shade * texturePulse
    )}, ${Math.floor(base[2] * shade * texturePulse)})`;
    context.fillRect(ray * columnWidth, top, columnWidth + 1, wallHeight);
  }

  const sprites: Array<{
    distance: number;
    angle: number;
    kind: 'enemy' | 'ammo' | 'health' | 'exit';
    enemy?: Enemy;
  }> = [];

  world.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    sprites.push({
      distance: Math.hypot(enemy.x - world.playerX, enemy.y - world.playerY),
      angle: normalizeAngle(Math.atan2(enemy.y - world.playerY, enemy.x - world.playerX) - world.angle),
      kind: 'enemy',
      enemy,
    });
  });
  world.pickups.forEach((pickup) => {
    if (!pickup.active) return;
    sprites.push({
      distance: Math.hypot(pickup.x - world.playerX, pickup.y - world.playerY),
      angle: normalizeAngle(Math.atan2(pickup.y - world.playerY, pickup.x - world.playerX) - world.angle),
      kind: pickup.kind,
    });
  });
  sprites.push({
    distance: Math.hypot(14.5 - world.playerX, 14.5 - world.playerY),
    angle: normalizeAngle(Math.atan2(14.5 - world.playerY, 14.5 - world.playerX) - world.angle),
    kind: 'exit',
  });

  sprites.sort((left, right) => right.distance - left.distance);
  sprites.forEach((sprite) => {
    if (Math.abs(sprite.angle) > FOV * 0.72) return;
    const screenX = VIEW_WIDTH / 2 + (sprite.angle / FOV) * VIEW_WIDTH;
    const rayIndex = clamp(Math.floor(screenX / columnWidth), 0, RAY_COUNT - 1);
    if (sprite.distance > depthBuffer[rayIndex] + 0.35) return;
    const size = clamp(VIEW_HEIGHT / sprite.distance, 18, VIEW_HEIGHT * 1.25);
    const centerY = horizon + size * 0.08;

    if (sprite.kind === 'enemy' && sprite.enemy) {
      drawEnemy(context, sprite.enemy, screenX, centerY, size);
      return;
    }

    context.save();
    context.translate(screenX, centerY);
    context.shadowBlur = size * 0.16;
    if (sprite.kind === 'ammo') {
      context.shadowColor = '#ffd84a';
      context.fillStyle = '#d69c28';
      context.fillRect(-size * 0.18, -size * 0.2, size * 0.36, size * 0.4);
      context.fillStyle = '#fff0a1';
      context.fillRect(-size * 0.08, -size * 0.12, size * 0.16, size * 0.24);
    } else if (sprite.kind === 'health') {
      context.shadowColor = '#ff3d55';
      context.fillStyle = '#f3e9d2';
      context.fillRect(-size * 0.22, -size * 0.18, size * 0.44, size * 0.36);
      context.fillStyle = '#d51f36';
      context.fillRect(-size * 0.055, -size * 0.13, size * 0.11, size * 0.26);
      context.fillRect(-size * 0.13, -size * 0.055, size * 0.26, size * 0.11);
    } else {
      const unlocked = world.kills === ENEMY_SEED.length;
      context.strokeStyle = unlocked ? '#5dff92' : '#ff4438';
      context.fillStyle = unlocked ? 'rgba(44, 148, 78, 0.34)' : 'rgba(110, 20, 14, 0.36)';
      context.lineWidth = Math.max(2, size * 0.035);
      context.fillRect(-size * 0.28, -size * 0.5, size * 0.56, size);
      context.strokeRect(-size * 0.28, -size * 0.5, size * 0.56, size);
    }
    context.restore();
  });

  context.save();
  context.strokeStyle = world.muzzleMs > 0 ? '#fffbd1' : 'rgba(235, 255, 235, 0.82)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(VIEW_WIDTH / 2 - 13, VIEW_HEIGHT / 2);
  context.lineTo(VIEW_WIDTH / 2 - 4, VIEW_HEIGHT / 2);
  context.moveTo(VIEW_WIDTH / 2 + 4, VIEW_HEIGHT / 2);
  context.lineTo(VIEW_WIDTH / 2 + 13, VIEW_HEIGHT / 2);
  context.moveTo(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 13);
  context.lineTo(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 4);
  context.moveTo(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 4);
  context.lineTo(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 13);
  context.stroke();

  const bob = Math.sin(world.elapsedMs / 110) * 4;
  context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT + bob);
  context.fillStyle = '#252523';
  context.strokeStyle = '#090909';
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(-105, 0);
  context.lineTo(-70, -92);
  context.lineTo(-28, -120);
  context.lineTo(34, -120);
  context.lineTo(78, -88);
  context.lineTo(112, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = world.muzzleMs > 0 ? '#fff69a' : '#a9271d';
  context.fillRect(-22, -132, 44, 30);
  context.restore();

  if (world.damageMs > 0) {
    context.fillStyle = `rgba(210, 10, 18, ${clamp(world.damageMs / 500, 0, 0.42)})`;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  context.save();
  context.globalAlpha = 0.82;
  context.fillStyle = '#090909';
  context.fillRect(12, 12, 150, 150);
  const scale = 8.8;
  MAP.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== '0' && cell !== 'E') {
        context.fillStyle = cell === '3' ? '#8f382b' : '#6a5a49';
        context.fillRect(16 + columnIndex * scale, 16 + rowIndex * scale, scale - 1, scale - 1);
      }
    });
  });
  context.fillStyle = world.kills === ENEMY_SEED.length ? '#56ff8e' : '#ff493f';
  context.fillRect(16 + 14 * scale, 16 + 14 * scale, scale - 1, scale - 1);
  world.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    context.fillStyle = '#ff5b38';
    context.fillRect(14 + enemy.x * scale, 14 + enemy.y * scale, 4, 4);
  });
  context.translate(16 + world.playerX * scale, 16 + world.playerY * scale);
  context.rotate(world.angle);
  context.fillStyle = '#f5f1ce';
  context.beginPath();
  context.moveTo(6, 0);
  context.lineTo(-4, 4);
  context.lineTo(-4, -4);
  context.closePath();
  context.fill();
  context.restore();
};

export function SoloDreadSectorGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloDreadSectorGameProps) {
  const [hud, setHud] = useState<World>(() => createWorld());
  const [bestScore, setBestScore] = useState(0);
  const [mouseLocked, setMouseLocked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World>(createWorld());
  const inputRef = useRef<InputState>({
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
    sprint: false,
  });
  const lastFrameRef = useRef<number | null>(null);
  const hudTimerRef = useRef(0);
  const reportedStatusRef = useRef<RunStatus | null>(null);
  const gameLabel = formatGameName('dread-sector', gameDefinitions);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    setBestScore(Number.isFinite(stored) ? stored : 0);
  }, []);

  const syncHud = useCallback(() => {
    setHud({
      ...worldRef.current,
      enemies: worldRef.current.enemies.map((enemy) => ({ ...enemy })),
      pickups: worldRef.current.pickups.map((pickup) => ({ ...pickup })),
    });
  }, []);

  const resetGame = useCallback(() => {
    worldRef.current = { ...createWorld(), status: 'playing' };
    reportedStatusRef.current = null;
    lastFrameRef.current = null;
    syncHud();
  }, [syncHud]);

  const captureMouse = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock();
    }
  }, []);

  const startAndCaptureMouse = useCallback(() => {
    resetGame();
    captureMouse();
  }, [captureMouse, resetGame]);

  const shoot = useCallback(() => {
    const world = worldRef.current;
    if (world.status === 'ready') {
      world.status = 'playing';
    }
    if (world.status !== 'playing' || world.shotCooldownMs > 0) return;
    if (world.ammo <= 0) {
      world.message = 'Dry magazine. Find an amber ammo cache.';
      syncHud();
      return;
    }

    world.ammo -= 1;
    world.shotCooldownMs = SHOT_COOLDOWN_MS;
    world.muzzleMs = 95;

    let target: Enemy | null = null;
    let targetDistance = Infinity;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const distance = Math.hypot(enemy.x - world.playerX, enemy.y - world.playerY);
      const angleDelta = Math.abs(
        normalizeAngle(Math.atan2(enemy.y - world.playerY, enemy.x - world.playerX) - world.angle)
      );
      const hitCone = Math.atan2(0.34, distance);
      if (
        angleDelta <= hitCone &&
        distance < targetDistance &&
        hasLineOfSight(world.playerX, world.playerY, enemy.x, enemy.y)
      ) {
        target = enemy;
        targetDistance = distance;
      }
    }

    if (target) {
      target.hp -= 1;
      target.hurtMs = 170;
      world.score += target.kind === 'warden' ? 180 : 120;
      if (target.hp <= 0) {
        world.kills += 1;
        world.score += 250;
        world.message =
          world.kills === ENEMY_SEED.length
            ? 'Sector purged. Reach the green extraction gate.'
            : `Hostile erased. ${ENEMY_SEED.length - world.kills} remain.`;
      }
    }
    syncHud();
  }, [syncHud]);

  useEffect(() => {
    const onPointerLockChange = () => {
      setMouseLocked(document.pointerLockElement === canvasRef.current);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) {
        return;
      }
      const world = worldRef.current;
      if (world.status !== 'playing') {
        return;
      }
      world.angle = normalizeAngle(world.angle + event.movementX * MOUSE_LOOK_SENSITIVITY);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === canvasRef.current) {
        document.exitPointerLock();
      }
    };
  }, []);

  useEffect(() => {
    const setKey = (key: string, pressed: boolean) => {
      const input = inputRef.current;
      if (key === 'w' || key === 'arrowup') input.forward = pressed;
      if (key === 's' || key === 'arrowdown') input.backward = pressed;
      if (key === 'a') input.strafeLeft = pressed;
      if (key === 'd') input.strafeRight = pressed;
      if (key === 'arrowleft' || key === 'q') input.turnLeft = pressed;
      if (key === 'arrowright' || key === 'e') input.turnRight = pressed;
      if (key === 'shift') input.sprint = pressed;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(key)) {
        event.preventDefault();
      }
      if (key === ' ') {
        shoot();
        return;
      }
      if (key === 'r' && worldRef.current.status !== 'playing') {
        resetGame();
        return;
      }
      if (
        worldRef.current.status === 'ready' &&
        ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
      ) {
        worldRef.current.status = 'playing';
        syncHud();
      }
      setKey(key, true);
    };
    const onKeyUp = (event: KeyboardEvent) => setKey(event.key.toLowerCase(), false);
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [resetGame, shoot]);

  useEffect(() => {
    let animationFrame = 0;
    const frame = (timestamp: number) => {
      const world = worldRef.current;
      const lastFrame = lastFrameRef.current ?? timestamp;
      const deltaMs = Math.min(34, timestamp - lastFrame);
      const delta = deltaMs / 1000;
      lastFrameRef.current = timestamp;

      if (world.status === 'playing') {
        world.elapsedMs += deltaMs;
        world.shotCooldownMs = Math.max(0, world.shotCooldownMs - deltaMs);
        world.muzzleMs = Math.max(0, world.muzzleMs - deltaMs);
        world.damageMs = Math.max(0, world.damageMs - deltaMs);
        const input = inputRef.current;
        const speed = MOVE_SPEED * (input.sprint ? 1.55 : 1);
        world.angle = normalizeAngle(
          world.angle + ((input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0)) * TURN_SPEED * delta
        );
        const forward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
        const strafe = (input.strafeRight ? 1 : 0) - (input.strafeLeft ? 1 : 0);
        const moveX =
          (Math.cos(world.angle) * forward + Math.cos(world.angle + Math.PI / 2) * strafe) *
          speed *
          delta;
        const moveY =
          (Math.sin(world.angle) * forward + Math.sin(world.angle + Math.PI / 2) * strafe) *
          speed *
          delta;
        if (canOccupy(world.playerX + moveX, world.playerY)) world.playerX += moveX;
        if (canOccupy(world.playerX, world.playerY + moveY)) world.playerY += moveY;

        world.pickups.forEach((pickup) => {
          if (!pickup.active || Math.hypot(pickup.x - world.playerX, pickup.y - world.playerY) > 0.55) return;
          pickup.active = false;
          if (pickup.kind === 'ammo') {
            world.ammo += 14;
            world.message = 'Ammo cache recovered. +14 rounds.';
          } else {
            world.health = Math.min(100, world.health + 35);
            world.message = 'Combat stim applied. +35 health.';
          }
          world.score += 75;
        });

        world.enemies.forEach((enemy) => {
          if (enemy.hp <= 0) return;
          enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);
          enemy.hurtMs = Math.max(0, enemy.hurtMs - deltaMs);
          const distance = Math.hypot(world.playerX - enemy.x, world.playerY - enemy.y);
          if (distance < 6.5 && hasLineOfSight(enemy.x, enemy.y, world.playerX, world.playerY)) {
            if (distance > 0.72) {
              const enemySpeed = enemy.kind === 'warden' ? 0.68 : 0.92;
              const enemyAngle = Math.atan2(world.playerY - enemy.y, world.playerX - enemy.x);
              const nextX = enemy.x + Math.cos(enemyAngle) * enemySpeed * delta;
              const nextY = enemy.y + Math.sin(enemyAngle) * enemySpeed * delta;
              if (!isWall(nextX, enemy.y)) enemy.x = nextX;
              if (!isWall(enemy.x, nextY)) enemy.y = nextY;
            } else if (enemy.attackCooldownMs <= 0) {
              const damage = enemy.kind === 'warden' ? 16 : 10;
              world.health = Math.max(0, world.health - damage);
              world.damageMs = 420;
              world.message = `Armor breach. ${damage} damage taken.`;
              enemy.attackCooldownMs = enemy.kind === 'warden' ? 920 : 720;
            }
          }
        });

        if (world.health <= 0) {
          world.status = 'lost';
          world.message = 'Signal lost. The sector consumed another operative.';
        } else if (
          world.kills === ENEMY_SEED.length &&
          Math.hypot(14.5 - world.playerX, 14.5 - world.playerY) < 0.62
        ) {
          world.status = 'won';
          world.score += Math.max(0, 5000 - Math.floor(world.elapsedMs / 20)) + world.health * 10;
          world.message = 'Extraction complete. Dread Sector is silent.';
        }
      }

      const canvas = canvasRef.current;
      if (canvas) drawWorld(canvas, world);
      hudTimerRef.current += deltaMs;
      if (hudTimerRef.current >= 100) {
        hudTimerRef.current = 0;
        syncHud();
      }
      animationFrame = window.requestAnimationFrame(frame);
    };
    animationFrame = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [syncHud]);

  useEffect(() => {
    if ((hud.status !== 'won' && hud.status !== 'lost') || reportedStatusRef.current === hud.status) {
      return;
    }
    reportedStatusRef.current = hud.status;
    if (hud.score > bestScore) {
      setBestScore(hud.score);
      window.localStorage.setItem(BEST_SCORE_KEY, String(hud.score));
    }
    onMatchComplete({
      mode: 'cpu',
      gameType: 'dread-sector',
      outcome: hud.status === 'won' ? 'win' : 'loss',
      opponent: 'Dread Sector',
    });
  }, [bestScore, hud.score, hud.status, onMatchComplete]);

  const setInput = useCallback((key: keyof InputState, pressed: boolean) => {
    inputRef.current[key] = pressed;
    if (pressed && worldRef.current.status === 'ready') {
      worldRef.current.status = 'playing';
      syncHud();
    }
  }, [syncHud]);

  const handleViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === 'touch') {
        shoot();
        return;
      }
      if (document.pointerLockElement !== canvasRef.current) {
        captureMouse();
        return;
      }
      if (event.button === 0) {
        shoot();
      }
    },
    [captureMouse, shoot]
  );

  const controllerSections = useMemo(
    () => [
      {
        key: 'movement',
        title: 'Movement',
        layout: 'dpad' as const,
        buttons: [
          {
            key: 'forward',
            label: 'Forward',
            icon: <AiOutlineArrowUp />,
            slot: 'up' as const,
            onPointerDown: () => setInput('forward', true),
            onPointerUp: () => setInput('forward', false),
          },
          {
            key: 'turn-left',
            label: 'Turn Left',
            icon: <AiOutlineArrowLeft />,
            slot: 'left' as const,
            onPointerDown: () => setInput('turnLeft', true),
            onPointerUp: () => setInput('turnLeft', false),
          },
          {
            key: 'backward',
            label: 'Backward',
            icon: <AiOutlineArrowDown />,
            slot: 'down' as const,
            onPointerDown: () => setInput('backward', true),
            onPointerUp: () => setInput('backward', false),
          },
          {
            key: 'turn-right',
            label: 'Turn Right',
            icon: <AiOutlineArrowRight />,
            slot: 'right' as const,
            onPointerDown: () => setInput('turnRight', true),
            onPointerUp: () => setInput('turnRight', false),
          },
        ],
      },
      {
        key: 'combat',
        title: 'Combat',
        layout: 'row' as const,
        buttons: [
          { key: 'fire', label: 'Fire', icon: <GiCrosshair />, onClick: shoot },
          {
            key: 'sprint',
            label: 'Sprint',
            icon: <AiOutlineThunderbolt />,
            onPointerDown: () => setInput('sprint', true),
            onPointerUp: () => setInput('sprint', false),
          },
          { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: resetGame },
        ],
      },
    ],
    [resetGame, setInput, shoot]
  );

  return (
    <>
      <h1 className="game-screen-title">{gameLabel}</h1>
      <AdaptiveControllerOverlay
        title="Dread Sector Controls"
        subtitle="Move, turn, purge"
        sections={controllerSections}
        initialCollapsed
      />

      <section className="dread-sector-shell">
        <header className="dread-sector-hud">
          <article>
            <span><GiHealthNormal /> Health</span>
            <strong>{hud.health}</strong>
          </article>
          <article>
            <span><GiCrosshair /> Ammo</span>
            <strong>{hud.ammo}</strong>
          </article>
          <article>
            <span>Hostiles</span>
            <strong>{hud.kills}/{ENEMY_SEED.length}</strong>
          </article>
          <article>
            <span>Score</span>
            <strong>{hud.score}</strong>
          </article>
          <article>
            <span>Best</span>
            <strong>{bestScore}</strong>
          </article>
        </header>

        <div className="dread-sector-stage">
          <canvas
            ref={canvasRef}
            className="dread-sector-canvas"
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            onPointerDown={handleViewportPointerDown}
            aria-label="Dread Sector first-person combat viewport"
          />
          {hud.status === 'playing' ? (
            <div className="dread-sector-mouse-status">
              {mouseLocked ? 'Mouse look active | Esc releases cursor' : 'Click viewport to capture mouse'}
            </div>
          ) : null}
          {hud.status === 'ready' ? (
            <div className="dread-sector-result">
              <span>Clean-room retro raycaster</span>
              <h2>Dread Sector</h2>
              <p>WASD moves, mouse looks, left click fires, Shift sprints, and Esc releases the cursor.</p>
              <button type="button" onClick={startAndCaptureMouse}><GiCrosshair /> Enter Sector</button>
            </div>
          ) : null}
          {hud.status === 'won' || hud.status === 'lost' ? (
            <div className="dread-sector-result">
              <span>{hud.status === 'won' ? 'Mission complete' : 'Operative lost'}</span>
              <h2>{hud.status === 'won' ? 'Sector Cleared' : 'Signal Terminated'}</h2>
              <p>{hud.message}</p>
              <div>
                <button type="button" onClick={startAndCaptureMouse}><AiOutlineReload /> Run Again</button>
                <button type="button" onClick={onLeave}><GiExitDoor /> Leave</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="dread-sector-status">
          <span>{hud.message}</span>
          <div>
            <button type="button" onClick={onToggleMusic}>
              <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> Restart
            </button>
            <button type="button" onClick={onLeave}>
              <GiExitDoor /> Exit
            </button>
          </div>
        </div>

        <p className="dread-sector-hint">
          {player.name}, eliminate every hostile, collect supplies, then reach the gate marked on the minimap.
        </p>
      </section>
    </>
  );
}
