export const RIFT_STAGE_WIDTH = 900;
export const RIFT_STAGE_HEIGHT = 560;
export const RIFT_TARGET_CORES = 12;
export const RIFT_RUN_TIME_MS = 75_000;

const PLAYER_RADIUS = 16;
const PLAYER_SPEED = 245;
const PLAYER_FIRE_COOLDOWN_MS = 145;
const PLAYER_BULLET_SPEED = 720;
const DASH_SPEED = 720;
const DASH_DURATION_MS = 150;
const DASH_COOLDOWN_MS = 1_700;
const HIT_INVULNERABLE_MS = 900;

export type RiftInputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type RiftPoint = {
  x: number;
  y: number;
};

export type RiftAimState = RiftPoint & {
  manual: boolean;
};

export type RiftEnemyKind = 'scout' | 'gunner' | 'brute';

export type RiftEnemy = RiftPoint & {
  id: number;
  kind: RiftEnemyKind;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldownMs: number;
  phase: number;
  orbitDirection: 1 | -1;
  coreValue: number;
};

export type RiftProjectile = RiftPoint & {
  id: number;
  owner: 'player' | 'enemy';
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  lifeMs: number;
};

export type RiftPortal = RiftPoint & {
  id: number;
  lifeMs: number;
  maxLifeMs: number;
};

export type RiftRunnerWorld = {
  status: 'playing' | 'won' | 'lost';
  player: RiftPoint & {
    vx: number;
    vy: number;
    angle: number;
    integrity: number;
    fireCooldownMs: number;
    dashCooldownMs: number;
    dashMs: number;
    invulnerableMs: number;
  };
  enemies: RiftEnemy[];
  projectiles: RiftProjectile[];
  portals: RiftPortal[];
  collected: number;
  score: number;
  combo: number;
  bestCombo: number;
  threatLevel: number;
  timeLeftMs: number;
  enemySpawnMs: number;
  nextId: number;
  enemiesDestroyed: number;
  shotsFired: number;
  lastEvent: string;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const distance = (left: RiftPoint, right: RiftPoint) =>
  Math.hypot(left.x - right.x, left.y - right.y);

const normalize = (x: number, y: number): RiftPoint => {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

const getSpawnPoint = (): RiftPoint => {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: 36, y: 60 + Math.random() * (RIFT_STAGE_HEIGHT - 120) };
  if (edge === 1) return { x: RIFT_STAGE_WIDTH - 36, y: 60 + Math.random() * (RIFT_STAGE_HEIGHT - 120) };
  if (edge === 2) return { x: 70 + Math.random() * (RIFT_STAGE_WIDTH - 140), y: 36 };
  return { x: 70 + Math.random() * (RIFT_STAGE_WIDTH - 140), y: RIFT_STAGE_HEIGHT - 36 };
};

const chooseEnemyKind = (threatLevel: number): RiftEnemyKind => {
  const roll = Math.random();
  if (threatLevel >= 3 && roll > 0.72) return 'brute';
  if (threatLevel >= 2 && roll > 0.42) return 'gunner';
  return 'scout';
};

const createEnemy = (
  id: number,
  threatLevel: number,
  forcedKind?: RiftEnemyKind
): RiftEnemy => {
  const kind = forcedKind || chooseEnemyKind(threatLevel);
  const point = getSpawnPoint();
  const stats =
    kind === 'brute'
      ? { radius: 24, hp: 7 + threatLevel, speed: 58, fire: 1_400, cores: 2 }
      : kind === 'gunner'
        ? { radius: 17, hp: 3 + Math.floor(threatLevel / 2), speed: 82, fire: 900, cores: 1 }
        : { radius: 14, hp: 2 + Math.floor(threatLevel / 3), speed: 126, fire: 1_800, cores: 1 };

  return {
    id,
    ...point,
    kind,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed + threatLevel * 4,
    fireCooldownMs: stats.fire + Math.random() * 500,
    phase: Math.random() * Math.PI * 2,
    orbitDirection: Math.random() > 0.5 ? 1 : -1,
    coreValue: stats.cores,
  };
};

const createEnemySeed = () => [
  createEnemy(1, 1, 'scout'),
  createEnemy(2, 1, 'scout'),
  createEnemy(3, 1, 'gunner'),
];

export const createInitialRiftRunnerWorld = (): RiftRunnerWorld => ({
  status: 'playing',
  player: {
    x: RIFT_STAGE_WIDTH / 2,
    y: RIFT_STAGE_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    integrity: 5,
    fireCooldownMs: 0,
    dashCooldownMs: 0,
    dashMs: 0,
    invulnerableMs: 0,
  },
  enemies: createEnemySeed(),
  projectiles: [],
  portals: [],
  collected: 0,
  score: 0,
  combo: 0,
  bestCombo: 0,
  threatLevel: 1,
  timeLeftMs: RIFT_RUN_TIME_MS,
  enemySpawnMs: 2_200,
  nextId: 4,
  enemiesDestroyed: 0,
  shotsFired: 0,
  lastEvent: 'Sentinels have the cores. Open fire.',
});

const getAimDirection = (
  player: RiftPoint,
  enemies: RiftEnemy[],
  aim: RiftAimState,
  fallbackAngle: number
): { direction: RiftPoint; angle: number } => {
  let target: RiftPoint | null = null;
  if (aim.manual) {
    target = aim;
  } else if (enemies.length > 0) {
    target = enemies.reduce((closest, enemy) =>
      distance(player, enemy) < distance(player, closest) ? enemy : closest
    );
  }

  if (!target) {
    return {
      direction: { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) },
      angle: fallbackAngle,
    };
  }

  const direction = normalize(target.x - player.x, target.y - player.y);
  return { direction, angle: Math.atan2(direction.y, direction.x) };
};

const createProjectile = (
  id: number,
  owner: RiftProjectile['owner'],
  origin: RiftPoint,
  direction: RiftPoint,
  speed: number,
  damage: number
): RiftProjectile => ({
  id,
  owner,
  x: origin.x + direction.x * 22,
  y: origin.y + direction.y * 22,
  vx: direction.x * speed,
  vy: direction.y * speed,
  radius: owner === 'player' ? 5 : 6,
  damage,
  lifeMs: owner === 'player' ? 1_250 : 2_200,
});

export const advanceRiftRunnerWorld = (
  world: RiftRunnerWorld,
  deltaSeconds: number,
  input: RiftInputState,
  aim: RiftAimState,
  firing: boolean,
  dashRequested: boolean
): RiftRunnerWorld => {
  if (world.status !== 'playing') return world;

  const deltaMs = deltaSeconds * 1000;
  let nextId = world.nextId;
  let timeLeftMs = Math.max(0, world.timeLeftMs - deltaMs);
  let integrity = world.player.integrity;
  let score = world.score;
  let combo = world.combo;
  let bestCombo = world.bestCombo;
  let collected = world.collected;
  let enemiesDestroyed = world.enemiesDestroyed;
  let shotsFired = world.shotsFired;
  let lastEvent = world.lastEvent;
  let fireCooldownMs = Math.max(0, world.player.fireCooldownMs - deltaMs);
  let dashCooldownMs = Math.max(0, world.player.dashCooldownMs - deltaMs);
  let dashMs = Math.max(0, world.player.dashMs - deltaMs);
  let invulnerableMs = Math.max(0, world.player.invulnerableMs - deltaMs);

  let moveX = Number(input.right) - Number(input.left);
  let moveY = Number(input.down) - Number(input.up);
  const movement = normalize(moveX, moveY);
  moveX = movement.x;
  moveY = movement.y;

  if (dashRequested && dashCooldownMs <= 0) {
    if (moveX === 0 && moveY === 0) {
      moveX = Math.cos(world.player.angle);
      moveY = Math.sin(world.player.angle);
    }
    dashMs = DASH_DURATION_MS;
    dashCooldownMs = DASH_COOLDOWN_MS;
    invulnerableMs = Math.max(invulnerableMs, DASH_DURATION_MS + 110);
    lastEvent = 'Phase drive online.';
  }

  const speed = dashMs > 0 ? DASH_SPEED : PLAYER_SPEED;
  const velocityBlend = Math.min(1, deltaSeconds * (dashMs > 0 ? 22 : 12));
  const vx = world.player.vx + (moveX * speed - world.player.vx) * velocityBlend;
  const vy = world.player.vy + (moveY * speed - world.player.vy) * velocityBlend;
  let playerX = clamp(world.player.x + vx * deltaSeconds, PLAYER_RADIUS, RIFT_STAGE_WIDTH - PLAYER_RADIUS);
  let playerY = clamp(world.player.y + vy * deltaSeconds, PLAYER_RADIUS, RIFT_STAGE_HEIGHT - PLAYER_RADIUS);

  const aimResult = getAimDirection(
    { x: playerX, y: playerY },
    world.enemies,
    aim,
    world.player.angle
  );
  let projectiles = world.projectiles;

  if (firing && fireCooldownMs <= 0) {
    projectiles = [
      ...projectiles,
      createProjectile(
        nextId,
        'player',
        { x: playerX, y: playerY },
        aimResult.direction,
        PLAYER_BULLET_SPEED,
        1
      ),
    ];
    nextId += 1;
    shotsFired += 1;
    fireCooldownMs = PLAYER_FIRE_COOLDOWN_MS;
  }

  let enemies = world.enemies.map((enemy) => {
    const toPlayer = normalize(playerX - enemy.x, playerY - enemy.y);
    const playerDistance = distance(enemy, { x: playerX, y: playerY });
    const desiredRange = enemy.kind === 'gunner' ? 225 : enemy.kind === 'brute' ? 90 : 120;
    const rangeDirection = playerDistance > desiredRange ? 1 : playerDistance < desiredRange * 0.72 ? -0.7 : 0;
    const orbitStrength = enemy.kind === 'gunner' ? 0.72 : 0.24;
    const moveDirection = normalize(
      toPlayer.x * rangeDirection - toPlayer.y * enemy.orbitDirection * orbitStrength,
      toPlayer.y * rangeDirection + toPlayer.x * enemy.orbitDirection * orbitStrength
    );

    return {
      ...enemy,
      x: clamp(enemy.x + moveDirection.x * enemy.speed * deltaSeconds, enemy.radius, RIFT_STAGE_WIDTH - enemy.radius),
      y: clamp(enemy.y + moveDirection.y * enemy.speed * deltaSeconds, enemy.radius, RIFT_STAGE_HEIGHT - enemy.radius),
      fireCooldownMs: enemy.fireCooldownMs - deltaMs,
      phase: enemy.phase + deltaSeconds * (enemy.kind === 'scout' ? 4.2 : 2.2),
    };
  });

  enemies = enemies.map((enemy) => {
    if (enemy.fireCooldownMs > 0 || enemy.kind === 'scout') return enemy;
    const shotDirection = normalize(playerX - enemy.x, playerY - enemy.y);
    projectiles = [
      ...projectiles,
      createProjectile(
        nextId,
        'enemy',
        enemy,
        shotDirection,
        enemy.kind === 'brute' ? 260 : 340,
        enemy.kind === 'brute' ? 2 : 1
      ),
    ];
    nextId += 1;
    return {
      ...enemy,
      fireCooldownMs:
        enemy.kind === 'brute'
          ? 1_300 + Math.random() * 500
          : 760 + Math.random() * 420,
    };
  });

  projectiles = projectiles
    .map((projectile) => ({
      ...projectile,
      x: projectile.x + projectile.vx * deltaSeconds,
      y: projectile.y + projectile.vy * deltaSeconds,
      lifeMs: projectile.lifeMs - deltaMs,
    }))
    .filter(
      (projectile) =>
        projectile.lifeMs > 0 &&
        projectile.x > -30 &&
        projectile.x < RIFT_STAGE_WIDTH + 30 &&
        projectile.y > -30 &&
        projectile.y < RIFT_STAGE_HEIGHT + 30
    );

  const consumedProjectiles = new Set<number>();
  const damagedEnemies = enemies.map((enemy) => {
    let hp = enemy.hp;
    projectiles.forEach((projectile) => {
      if (
        projectile.owner === 'player' &&
        !consumedProjectiles.has(projectile.id) &&
        distance(projectile, enemy) <= projectile.radius + enemy.radius
      ) {
        hp -= projectile.damage;
        consumedProjectiles.add(projectile.id);
      }
    });
    return hp === enemy.hp ? enemy : { ...enemy, hp };
  });

  const survivingEnemies: RiftEnemy[] = [];
  damagedEnemies.forEach((enemy) => {
    if (enemy.hp > 0) {
      survivingEnemies.push(enemy);
      return;
    }

    enemiesDestroyed += 1;
    collected = Math.min(RIFT_TARGET_CORES, collected + enemy.coreValue);
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    score += (enemy.kind === 'brute' ? 450 : enemy.kind === 'gunner' ? 240 : 150) * Math.max(1, combo);
    timeLeftMs = Math.min(RIFT_RUN_TIME_MS, timeLeftMs + enemy.coreValue * 850);
    lastEvent =
      enemy.kind === 'brute'
        ? `Carrier broken. ${enemy.coreValue} cores recovered.`
        : combo >= 3
          ? `Sentinel chain x${combo}.`
          : 'Sentinel down. Core recovered.';
  });
  enemies = survivingEnemies;

  projectiles.forEach((projectile) => {
    if (
      projectile.owner === 'enemy' &&
      !consumedProjectiles.has(projectile.id) &&
      distance(projectile, { x: playerX, y: playerY }) <= projectile.radius + PLAYER_RADIUS &&
      invulnerableMs <= 0
    ) {
      integrity -= projectile.damage;
      combo = 0;
      invulnerableMs = HIT_INVULNERABLE_MS;
      consumedProjectiles.add(projectile.id);
      lastEvent = 'Shield hit. Kill chain lost.';
    }
  });

  const collisionEnemy = enemies.find(
    (enemy) => distance(enemy, { x: playerX, y: playerY }) <= enemy.radius + PLAYER_RADIUS
  );
  if (collisionEnemy && invulnerableMs <= 0) {
    integrity -= collisionEnemy.kind === 'brute' ? 2 : 1;
    combo = 0;
    invulnerableMs = HIT_INVULNERABLE_MS;
    const away = normalize(playerX - collisionEnemy.x, playerY - collisionEnemy.y);
    playerX = clamp(playerX + away.x * 38, PLAYER_RADIUS, RIFT_STAGE_WIDTH - PLAYER_RADIUS);
    playerY = clamp(playerY + away.y * 38, PLAYER_RADIUS, RIFT_STAGE_HEIGHT - PLAYER_RADIUS);
    lastEvent = 'Sentinel collision. Reposition.';
  }

  projectiles = projectiles.filter((projectile) => !consumedProjectiles.has(projectile.id));

  const threatLevel = Math.min(4, 1 + Math.floor(collected / 3));
  let enemySpawnMs = world.enemySpawnMs - deltaMs;
  let portals = world.portals
    .map((portal) => ({ ...portal, lifeMs: portal.lifeMs - deltaMs }))
    .filter((portal) => portal.lifeMs > 0);

  if (enemySpawnMs <= 0 && enemies.length < 4 + threatLevel) {
    const enemy = createEnemy(nextId, threatLevel);
    nextId += 1;
    enemies = [...enemies, enemy];
    portals = [
      ...portals,
      { id: nextId, x: enemy.x, y: enemy.y, lifeMs: 850, maxLifeMs: 850 },
    ];
    nextId += 1;
    enemySpawnMs = Math.max(780, 2_250 - threatLevel * 280);
    lastEvent = enemy.kind === 'brute' ? 'Heavy core carrier entering.' : 'Rift contact incoming.';
  }

  const status =
    collected >= RIFT_TARGET_CORES
      ? 'won'
      : integrity <= 0 || timeLeftMs <= 0
        ? 'lost'
        : 'playing';

  return {
    status,
    player: {
      x: playerX,
      y: playerY,
      vx,
      vy,
      angle: aimResult.angle,
      integrity,
      fireCooldownMs,
      dashCooldownMs,
      dashMs,
      invulnerableMs,
    },
    enemies,
    projectiles,
    portals,
    collected,
    score,
    combo,
    bestCombo,
    threatLevel,
    timeLeftMs,
    enemySpawnMs,
    nextId,
    enemiesDestroyed,
    shotsFired,
    lastEvent,
  };
};

export const formatRiftRunnerTime = (timeMs: number) => {
  const seconds = Math.max(0, Math.ceil(timeMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
