export type StarfallStatus = 'playing' | 'won' | 'lost';

export type StarfallInputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type StarfallShip = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hull: number;
  invulnerableMs: number;
  dashCooldownMs: number;
  pulseMs: number;
};

export type StarfallShard = {
  id: number;
  x: number;
  y: number;
  radius: number;
  drift: number;
  phase: number;
  value: number;
};

export type StarfallHazard = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  spin: number;
  nearMissed: boolean;
};

export type StarfallWorld = {
  status: StarfallStatus;
  ship: StarfallShip;
  shards: StarfallShard[];
  hazards: StarfallHazard[];
  score: number;
  combo: number;
  comboWindowMs: number;
  nearMisses: number;
  threatLevel: number;
  timeLeftMs: number;
  elapsedMs: number;
  spawnCooldownMs: number;
  shardCooldownMs: number;
  nextId: number;
};

export const STAGE_WIDTH = 900;
export const STAGE_HEIGHT = 560;
export const SHIP_RADIUS = 18;
export const TARGET_SCORE = 18;
export const ROUND_TIME_MS = 78_000;
export const START_HULL = 3;
export const MAX_SHARDS = 3;
export const DASH_COOLDOWN_MS = 2200;

const MAX_TIME_MS = 90_000;
const SHIP_ACCELERATION = 920;
const SHIP_FRICTION = 0.94;
const MAX_SPEED = 340;
const DASH_SPEED = 420;
const BASE_HAZARD_COOLDOWN_MS = 1180;
const BASE_SHARD_COOLDOWN_MS = 1500;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const distanceBetween = (leftX: number, leftY: number, rightX: number, rightY: number): number =>
  Math.hypot(leftX - rightX, leftY - rightY);

const normalizeVector = (x: number, y: number): { x: number; y: number } => {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return {
    x: x / magnitude,
    y: y / magnitude,
  };
};

const createShip = (): StarfallShip => ({
  x: STAGE_WIDTH / 2,
  y: STAGE_HEIGHT * 0.58,
  vx: 0,
  vy: 0,
  hull: START_HULL,
  invulnerableMs: 0,
  dashCooldownMs: 0,
  pulseMs: 0,
});

const isPointSafeFromShip = (ship: StarfallShip, x: number, y: number, minimumDistance: number): boolean =>
  distanceBetween(ship.x, ship.y, x, y) >= minimumDistance;

const createShard = (id: number, ship: StarfallShip): StarfallShard => {
  let x = 0;
  let y = 0;

  for (let attempts = 0; attempts < 12; attempts += 1) {
    x = randomBetween(86, STAGE_WIDTH - 86);
    y = randomBetween(80, STAGE_HEIGHT - 80);
    if (isPointSafeFromShip(ship, x, y, 130)) {
      break;
    }
  }

  return {
    id,
    x,
    y,
    radius: randomBetween(11, 16),
    drift: randomBetween(-0.8, 0.8),
    phase: randomBetween(0, Math.PI * 2),
    value: 1,
  };
};

const createHazard = (id: number, threatLevel: number): StarfallHazard => {
  const edge = Math.floor(Math.random() * 4);
  const speed = randomBetween(118, 172) + threatLevel * 16;
  const targetX = randomBetween(STAGE_WIDTH * 0.22, STAGE_WIDTH * 0.78);
  const targetY = randomBetween(STAGE_HEIGHT * 0.18, STAGE_HEIGHT * 0.78);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = randomBetween(0, STAGE_WIDTH);
    y = -56;
  } else if (edge === 1) {
    x = STAGE_WIDTH + 56;
    y = randomBetween(0, STAGE_HEIGHT);
  } else if (edge === 2) {
    x = randomBetween(0, STAGE_WIDTH);
    y = STAGE_HEIGHT + 56;
  } else {
    x = -56;
    y = randomBetween(0, STAGE_HEIGHT);
  }

  const direction = normalizeVector(targetX - x, targetY - y);

  return {
    id,
    x,
    y,
    vx: direction.x * speed,
    vy: direction.y * speed,
    radius: randomBetween(16, 28),
    hue: Math.round(randomBetween(8, 38)),
    spin: randomBetween(-180, 180),
    nearMissed: false,
  };
};

const createInitialEntities = (
  ship: StarfallShip
): Pick<StarfallWorld, 'hazards' | 'shards' | 'nextId'> => {
  let nextId = 1;
  const hazards: StarfallHazard[] = [];
  const shards: StarfallShard[] = [];

  for (let index = 0; index < 2; index += 1) {
    hazards.push(createHazard(nextId, 1));
    nextId += 1;
  }

  for (let index = 0; index < 2; index += 1) {
    shards.push(createShard(nextId, ship));
    nextId += 1;
  }

  return { hazards, shards, nextId };
};

export const createInitialStarfallWorld = (): StarfallWorld => {
  const ship = createShip();
  const entities = createInitialEntities(ship);

  return {
    status: 'playing',
    ship,
    hazards: entities.hazards,
    shards: entities.shards,
    score: 0,
    combo: 0,
    comboWindowMs: 0,
    nearMisses: 0,
    threatLevel: 1,
    timeLeftMs: ROUND_TIME_MS,
    elapsedMs: 0,
    spawnCooldownMs: 900,
    shardCooldownMs: 850,
    nextId: entities.nextId,
  };
};

export const getThreatLevel = (score: number, nearMisses: number): number =>
  1 + Math.floor(score / 4) + Math.floor(nearMisses / 3);

export const formatStarfallTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const advanceStarfallWorld = (
  currentWorld: StarfallWorld,
  deltaSeconds: number,
  input: StarfallInputState,
  dashTriggered: boolean
): StarfallWorld => {
  if (currentWorld.status !== 'playing') {
    return currentWorld;
  }

  const deltaMs = deltaSeconds * 1000;
  const nextShip: StarfallShip = {
    ...currentWorld.ship,
    invulnerableMs: Math.max(0, currentWorld.ship.invulnerableMs - deltaMs),
    dashCooldownMs: Math.max(0, currentWorld.ship.dashCooldownMs - deltaMs),
    pulseMs: Math.max(0, currentWorld.ship.pulseMs - deltaMs),
  };

  const axisX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const axisY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moveVector = normalizeVector(axisX, axisY);

  nextShip.vx += moveVector.x * SHIP_ACCELERATION * deltaSeconds;
  nextShip.vy += moveVector.y * SHIP_ACCELERATION * deltaSeconds;
  nextShip.vx *= Math.pow(SHIP_FRICTION, deltaSeconds * 60);
  nextShip.vy *= Math.pow(SHIP_FRICTION, deltaSeconds * 60);

  if (dashTriggered && nextShip.dashCooldownMs <= 0) {
    const shipHeading = normalizeVector(nextShip.vx, nextShip.vy);
    const dashSource =
      moveVector.x !== 0 || moveVector.y !== 0
        ? moveVector
        : shipHeading.x !== 0 || shipHeading.y !== 0
          ? shipHeading
          : { x: 0, y: -1 };

    nextShip.vx += dashSource.x * DASH_SPEED;
    nextShip.vy += dashSource.y * DASH_SPEED;
    nextShip.dashCooldownMs = DASH_COOLDOWN_MS;
    nextShip.pulseMs = 380;
  }

  const speed = Math.hypot(nextShip.vx, nextShip.vy);
  if (speed > MAX_SPEED) {
    const normalizedVelocity = normalizeVector(nextShip.vx, nextShip.vy);
    nextShip.vx = normalizedVelocity.x * MAX_SPEED;
    nextShip.vy = normalizedVelocity.y * MAX_SPEED;
  }

  nextShip.x = clamp(nextShip.x + nextShip.vx * deltaSeconds, SHIP_RADIUS + 8, STAGE_WIDTH - SHIP_RADIUS - 8);
  nextShip.y = clamp(nextShip.y + nextShip.vy * deltaSeconds, SHIP_RADIUS + 8, STAGE_HEIGHT - SHIP_RADIUS - 8);

  if (nextShip.x <= SHIP_RADIUS + 8 || nextShip.x >= STAGE_WIDTH - SHIP_RADIUS - 8) {
    nextShip.vx *= 0.6;
  }

  if (nextShip.y <= SHIP_RADIUS + 8 || nextShip.y >= STAGE_HEIGHT - SHIP_RADIUS - 8) {
    nextShip.vy *= 0.6;
  }

  let score = currentWorld.score;
  let comboWindowMs = Math.max(0, currentWorld.comboWindowMs - deltaMs);
  let combo = comboWindowMs > 0 ? currentWorld.combo : 0;
  let nearMisses = currentWorld.nearMisses;
  let timeLeftMs = Math.max(0, currentWorld.timeLeftMs - deltaMs);
  let nextId = currentWorld.nextId;
  let hazards = currentWorld.hazards;
  let shards = currentWorld.shards;

  const threatLevel = getThreatLevel(score, nearMisses);

  let spawnCooldownMs = currentWorld.spawnCooldownMs - deltaMs;
  if (spawnCooldownMs <= 0) {
    hazards = [...hazards, createHazard(nextId, threatLevel)];
    nextId += 1;
    spawnCooldownMs = clamp(
      BASE_HAZARD_COOLDOWN_MS - threatLevel * 75 + randomBetween(-120, 180),
      340,
      1500
    );
  }

  let shardCooldownMs = currentWorld.shardCooldownMs - deltaMs;
  if (shards.length < MAX_SHARDS && shardCooldownMs <= 0) {
    shards = [...shards, createShard(nextId, nextShip)];
    nextId += 1;
    shardCooldownMs = BASE_SHARD_COOLDOWN_MS + randomBetween(-180, 560);
  }

  const nextHazards: StarfallHazard[] = [];
  for (const hazard of hazards) {
    const updatedHazard: StarfallHazard = {
      ...hazard,
      x: hazard.x + hazard.vx * deltaSeconds,
      y: hazard.y + hazard.vy * deltaSeconds,
      spin: hazard.spin + deltaSeconds * 72,
    };

    const isOffscreen =
      updatedHazard.x < -90 ||
      updatedHazard.x > STAGE_WIDTH + 90 ||
      updatedHazard.y < -90 ||
      updatedHazard.y > STAGE_HEIGHT + 90;

    if (isOffscreen) {
      continue;
    }

    const contactDistance = distanceBetween(nextShip.x, nextShip.y, updatedHazard.x, updatedHazard.y);

    if (
      nextShip.invulnerableMs <= 0 &&
      contactDistance <= updatedHazard.radius + SHIP_RADIUS - 2
    ) {
      nextShip.hull -= 1;
      nextShip.invulnerableMs = 1100;
      nextShip.pulseMs = 420;
      nextShip.vx = clamp(nextShip.vx - updatedHazard.vx * 0.28, -MAX_SPEED, MAX_SPEED);
      nextShip.vy = clamp(nextShip.vy - updatedHazard.vy * 0.28, -MAX_SPEED, MAX_SPEED);
      continue;
    }

    if (
      !updatedHazard.nearMissed &&
      nextShip.invulnerableMs <= 0 &&
      contactDistance <= updatedHazard.radius + SHIP_RADIUS + 22
    ) {
      updatedHazard.nearMissed = true;
      nearMisses += 1;
      timeLeftMs = Math.min(MAX_TIME_MS, timeLeftMs + 650);
    }

    nextHazards.push(updatedHazard);
  }

  const nextShards: StarfallShard[] = [];
  for (const shard of shards) {
    const updatedShard: StarfallShard = {
      ...shard,
      phase: shard.phase + deltaSeconds * 2.2,
      y: shard.y,
    };

    const shardDistance = distanceBetween(nextShip.x, nextShip.y, updatedShard.x, updatedShard.y);
    if (shardDistance <= SHIP_RADIUS + updatedShard.radius + 4) {
      score += updatedShard.value;
      combo = comboWindowMs > 0 ? combo + 1 : 1;
      comboWindowMs = 2400;
      nextShip.pulseMs = 360;
      timeLeftMs = Math.min(MAX_TIME_MS, timeLeftMs + 1800 + Math.min(combo, 4) * 160);
      continue;
    }

    nextShards.push(updatedShard);
  }

  const nextThreatLevel = getThreatLevel(score, nearMisses);
  const nextStatus: StarfallStatus =
    score >= TARGET_SCORE
      ? 'won'
      : nextShip.hull <= 0 || timeLeftMs <= 0
        ? 'lost'
        : 'playing';

  return {
    status: nextStatus,
    ship: nextShip,
    hazards: nextHazards,
    shards: nextShards,
    score,
    combo,
    comboWindowMs,
    nearMisses,
    threatLevel: nextThreatLevel,
    timeLeftMs,
    elapsedMs: currentWorld.elapsedMs + deltaMs,
    spawnCooldownMs,
    shardCooldownMs,
    nextId,
  };
};
