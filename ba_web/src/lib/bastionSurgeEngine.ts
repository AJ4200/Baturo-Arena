export const BASTION_COLS = 16;
export const BASTION_ROWS = 10;
export const BASTION_CELL = 60;
export const BASTION_STAGE_WIDTH = BASTION_COLS * BASTION_CELL;
export const BASTION_STAGE_HEIGHT = BASTION_ROWS * BASTION_CELL;
export const BASTION_TOTAL_WAVES = 15;
export const BASTION_START_CREDITS = 180;
export const BASTION_START_CORE = 20;
export const BASTION_FIRST_WAVE_DELAY = 22;
export const BASTION_WAVE_DELAY = 14;
export const BASTION_SURGE_COST = 100;
export const BASTION_SURGE_RADIUS = 140;
export const BASTION_MAX_TOWER_LEVEL = 3;

export type BastionTowerKind = 'pulse' | 'arc' | 'rail' | 'cryo';
export type BastionTargeting = 'first' | 'strong' | 'close';
export type BastionEnemyKind = 'drone' | 'runner' | 'brute' | 'aegis' | 'splitter' | 'mini' | 'colossus';
export type BastionStatus = 'playing' | 'won' | 'lost';

export type BastionTowerSpec = {
  kind: BastionTowerKind;
  label: string;
  short: string;
  cost: number;
  range: number;
  cooldown: number;
  damage: number;
  color: string;
  blurb: string;
};

export type BastionEnemySpec = {
  kind: BastionEnemyKind;
  label: string;
  hp: number;
  shield: number;
  speed: number;
  radius: number;
  reward: number;
  leak: number;
  color: string;
  isBoss: boolean;
};

export type BastionTower = {
  id: number;
  kind: BastionTowerKind;
  col: number;
  row: number;
  level: number;
  cooldown: number;
  targeting: BastionTargeting;
  invested: number;
  angle: number;
  recoil: number;
};

export type BastionEnemy = {
  id: number;
  kind: BastionEnemyKind;
  dist: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldDelay: number;
  slowTimer: number;
  slowFactor: number;
  stunTimer: number;
  hitFlash: number;
};

export type BastionEffect = {
  id: number;
  kind: 'tracer' | 'arc' | 'beam' | 'ring' | 'burst' | 'float' | 'surge';
  x: number;
  y: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
  text: string;
};

export type BastionSpawn = { kind: BastionEnemyKind; at: number };

export type BastionWorld = {
  status: BastionStatus;
  paused: boolean;
  time: number;
  wave: number;
  waveActive: boolean;
  waveClock: number;
  waveLeaks: number;
  spawnQueue: BastionSpawn[];
  intermission: number;
  credits: number;
  core: number;
  maxCore: number;
  score: number;
  kills: number;
  leaks: number;
  surge: number;
  towers: BastionTower[];
  enemies: BastionEnemy[];
  effects: BastionEffect[];
  nextId: number;
  lastEvent: string;
};

export type BastionActionResult = { ok: boolean; message: string };

export type BastionTowerStats = {
  damage: number;
  range: number;
  cooldown: number;
  chain: number;
  slow: number;
};

export const BASTION_TOWER_ORDER: BastionTowerKind[] = ['pulse', 'arc', 'rail', 'cryo'];

export const BASTION_TOWER_SPECS: Record<BastionTowerKind, BastionTowerSpec> = {
  pulse: {
    kind: 'pulse',
    label: 'Pulse Turret',
    short: 'Pulse',
    cost: 50,
    range: 150,
    cooldown: 0.42,
    damage: 9,
    color: '#22d3ee',
    blurb: 'Rapid single-target fire. Cheap and reliable.',
  },
  arc: {
    kind: 'arc',
    label: 'Arc Coil',
    short: 'Arc',
    cost: 90,
    range: 135,
    cooldown: 0.95,
    damage: 15,
    color: '#c084fc',
    blurb: 'Chains lightning through several foes. +25% vs chilled.',
  },
  rail: {
    kind: 'rail',
    label: 'Rail Lance',
    short: 'Rail',
    cost: 140,
    range: 270,
    cooldown: 2.1,
    damage: 72,
    color: '#fb7185',
    blurb: 'Piercing beam that ignores shields. +35% vs chilled.',
  },
  cryo: {
    kind: 'cryo',
    label: 'Cryo Node',
    short: 'Cryo',
    cost: 80,
    range: 125,
    cooldown: 1,
    damage: 3,
    color: '#93c5fd',
    blurb: 'Slows every enemy in range. Sets up shatter damage.',
  },
};

export const BASTION_ENEMY_SPECS: Record<BastionEnemyKind, BastionEnemySpec> = {
  drone: { kind: 'drone', label: 'Drone', hp: 26, shield: 0, speed: 82, radius: 11, reward: 6, leak: 1, color: '#7dd3fc', isBoss: false },
  runner: { kind: 'runner', label: 'Runner', hp: 16, shield: 0, speed: 150, radius: 9, reward: 7, leak: 1, color: '#facc15', isBoss: false },
  brute: { kind: 'brute', label: 'Brute', hp: 120, shield: 0, speed: 54, radius: 15, reward: 18, leak: 3, color: '#fb923c', isBoss: false },
  aegis: { kind: 'aegis', label: 'Aegis', hp: 55, shield: 60, speed: 68, radius: 13, reward: 20, leak: 2, color: '#a78bfa', isBoss: false },
  splitter: { kind: 'splitter', label: 'Splitter', hp: 70, shield: 0, speed: 64, radius: 14, reward: 14, leak: 2, color: '#f472b6', isBoss: false },
  mini: { kind: 'mini', label: 'Shard', hp: 22, shield: 0, speed: 96, radius: 8, reward: 3, leak: 1, color: '#f9a8d4', isBoss: false },
  colossus: { kind: 'colossus', label: 'Colossus', hp: 1000, shield: 0, speed: 38, radius: 23, reward: 140, leak: 8, color: '#f87171', isBoss: true },
};

const PATH_CELLS: Array<[number, number]> = [
  [-1, 1],
  [12, 1],
  [12, 4],
  [3, 4],
  [3, 7],
  [16, 7],
];

export const BASTION_PATH_POINTS = PATH_CELLS.map(([col, row]) => ({
  x: (col + 0.5) * BASTION_CELL,
  y: (row + 0.5) * BASTION_CELL,
}));

const PATH_SEGMENT_LENGTHS = BASTION_PATH_POINTS.slice(1).map((point, index) => {
  const previous = BASTION_PATH_POINTS[index];
  return Math.hypot(point.x - previous.x, point.y - previous.y);
});

export const BASTION_PATH_LENGTH = PATH_SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0);

const PATH_GRID: boolean[][] = Array.from({ length: BASTION_ROWS }, () => Array<boolean>(BASTION_COLS).fill(false));

PATH_CELLS.slice(1).forEach(([col, row], index) => {
  const [fromCol, fromRow] = PATH_CELLS[index];
  const startCol = Math.min(fromCol, col);
  const endCol = Math.max(fromCol, col);
  const startRow = Math.min(fromRow, row);
  const endRow = Math.max(fromRow, row);
  for (let cellRow = startRow; cellRow <= endRow; cellRow += 1) {
    for (let cellCol = startCol; cellCol <= endCol; cellCol += 1) {
      if (cellRow >= 0 && cellRow < BASTION_ROWS && cellCol >= 0 && cellCol < BASTION_COLS) {
        PATH_GRID[cellRow][cellCol] = true;
      }
    }
  }
});

export const isBastionPathCell = (col: number, row: number): boolean =>
  row >= 0 && row < BASTION_ROWS && col >= 0 && col < BASTION_COLS && PATH_GRID[row][col];

export const isBastionCellInside = (col: number, row: number): boolean =>
  row >= 0 && row < BASTION_ROWS && col >= 0 && col < BASTION_COLS;

export const getBastionPathPoint = (distance: number) => {
  let remaining = Math.max(0, distance);
  for (let index = 0; index < PATH_SEGMENT_LENGTHS.length; index += 1) {
    const length = PATH_SEGMENT_LENGTHS[index];
    const from = BASTION_PATH_POINTS[index];
    const to = BASTION_PATH_POINTS[index + 1];
    if (remaining <= length || index === PATH_SEGMENT_LENGTHS.length - 1) {
      const ratio = length > 0 ? Math.min(1, remaining / length) : 0;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        angle: Math.atan2(to.y - from.y, to.x - from.x),
      };
    }
    remaining -= length;
  }
  const last = BASTION_PATH_POINTS[BASTION_PATH_POINTS.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
};

export const getBastionTowerCenter = (tower: Pick<BastionTower, 'col' | 'row'>) => ({
  x: (tower.col + 0.5) * BASTION_CELL,
  y: (tower.row + 0.5) * BASTION_CELL,
});

export const getBastionTowerStats = (tower: Pick<BastionTower, 'kind' | 'level'>): BastionTowerStats => {
  const spec = BASTION_TOWER_SPECS[tower.kind];
  const step = tower.level - 1;
  return {
    damage: spec.damage * (1 + 0.6 * step),
    range: spec.range * (1 + 0.07 * step),
    cooldown: spec.cooldown * Math.pow(0.88, step),
    chain: 2 + tower.level,
    slow: Math.min(0.7, 0.34 + 0.08 * step),
  };
};

export const getBastionUpgradeCost = (tower: Pick<BastionTower, 'kind' | 'level'>): number | null => {
  if (tower.level >= BASTION_MAX_TOWER_LEVEL) return null;
  return Math.round(BASTION_TOWER_SPECS[tower.kind].cost * (0.8 + 0.6 * (tower.level - 1)));
};

export const getBastionSellValue = (tower: Pick<BastionTower, 'invested'>): number =>
  Math.floor(tower.invested * 0.65);

const getHealthMultiplier = (wave: number) => 1 + 0.17 * (wave - 1) + 0.009 * (wave - 1) * (wave - 1);

export const buildBastionWave = (wave: number): BastionSpawn[] => {
  const groups: Array<{ kind: BastionEnemyKind; count: number; gap: number; offset: number }> = [
    { kind: 'drone', count: Math.min(24, 6 + wave * 2), gap: Math.max(0.45, 0.95 - wave * 0.03), offset: 0 },
  ];
  if (wave >= 3) groups.push({ kind: 'runner', count: 3 + Math.floor(wave * 1.1), gap: 0.5, offset: 4 });
  if (wave >= 4) groups.push({ kind: 'brute', count: Math.floor((wave - 2) / 2) + (wave >= 12 ? 1 : 0), gap: 1.9, offset: 8 });
  if (wave >= 6) groups.push({ kind: 'aegis', count: Math.floor((wave - 4) / 2), gap: 1.5, offset: 10 });
  if (wave >= 7) groups.push({ kind: 'splitter', count: Math.floor((wave - 5) / 2), gap: 1.4, offset: 12 });
  if (wave % 5 === 0) groups.push({ kind: 'colossus', count: wave >= 15 ? 2 : 1, gap: 6, offset: 16 });

  const spawns: BastionSpawn[] = [];
  groups.forEach((group) => {
    for (let index = 0; index < group.count; index += 1) {
      spawns.push({ kind: group.kind, at: group.offset + index * group.gap });
    }
  });
  return spawns.sort((a, b) => a.at - b.at);
};

export const createInitialBastionWorld = (): BastionWorld => ({
  status: 'playing',
  paused: false,
  time: 0,
  wave: 0,
  waveActive: false,
  waveClock: 0,
  waveLeaks: 0,
  spawnQueue: [],
  intermission: BASTION_FIRST_WAVE_DELAY,
  credits: BASTION_START_CREDITS,
  core: BASTION_START_CORE,
  maxCore: BASTION_START_CORE,
  score: 0,
  kills: 0,
  leaks: 0,
  surge: 0,
  towers: [],
  enemies: [],
  effects: [],
  nextId: 1,
  lastEvent: 'Raise your first turrets before the legion arrives.',
});

const addEffect = (world: BastionWorld, effect: Partial<BastionEffect> & Pick<BastionEffect, 'kind' | 'x' | 'y'>) => {
  const life = effect.life ?? 0.25;
  world.effects.push({
    id: world.nextId++,
    x2: effect.x,
    y2: effect.y,
    color: '#ffffff',
    radius: 0,
    text: '',
    ...effect,
    life,
    maxLife: life,
  });
};

const spawnEnemy = (world: BastionWorld, kind: BastionEnemyKind, dist: number) => {
  const spec = BASTION_ENEMY_SPECS[kind];
  const multiplier = getHealthMultiplier(Math.max(1, world.wave));
  const point = getBastionPathPoint(dist);
  const hp = Math.round(spec.hp * multiplier);
  const shield = Math.round(spec.shield * multiplier);
  world.enemies.push({
    id: world.nextId++,
    kind,
    dist,
    x: point.x,
    y: point.y,
    angle: point.angle,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    shieldDelay: 0,
    slowTimer: 0,
    slowFactor: 1,
    stunTimer: 0,
    hitFlash: 0,
  });
};

const startWave = (world: BastionWorld) => {
  world.wave += 1;
  world.waveActive = true;
  world.waveClock = 0;
  world.waveLeaks = 0;
  world.intermission = 0;
  world.spawnQueue = buildBastionWave(world.wave);
  const hasBoss = world.spawnQueue.some((spawn) => spawn.kind === 'colossus');
  world.lastEvent = hasBoss
    ? `Wave ${world.wave}: a Colossus approaches. Focus fire and chill it.`
    : `Wave ${world.wave} incoming.`;
};

const damageEnemy = (
  enemy: BastionEnemy,
  amount: number,
  source: BastionTowerKind | 'surge',
  pierceShield: boolean
) => {
  let damage = amount;
  if (enemy.slowTimer > 0) {
    if (source === 'rail') damage *= 1.35;
    if (source === 'arc') damage *= 1.25;
  }
  enemy.hitFlash = 0.12;
  enemy.shieldDelay = 2.5;
  if (!pierceShield && enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, damage);
    enemy.shield -= absorbed;
    damage -= absorbed;
  }
  enemy.hp -= damage;
};

const reapEnemies = (world: BastionWorld) => {
  if (!world.enemies.some((enemy) => enemy.hp <= 0)) return;

  const survivors: BastionEnemy[] = [];
  const fallen: BastionEnemy[] = [];
  world.enemies.forEach((enemy) => {
    (enemy.hp > 0 ? survivors : fallen).push(enemy);
  });
  world.enemies = survivors;

  fallen.forEach((enemy) => {
    const spec = BASTION_ENEMY_SPECS[enemy.kind];
    const reward = spec.reward + Math.floor(world.wave / 3);
    world.credits += reward;
    world.kills += 1;
    world.score += reward * 5;
    world.surge = Math.min(BASTION_SURGE_COST, world.surge + (spec.isBoss ? 30 : spec.reward >= 14 ? 4 : 2));
    addEffect(world, { kind: 'burst', x: enemy.x, y: enemy.y, color: spec.color, radius: spec.radius * 2.2, life: 0.35 });
    addEffect(world, { kind: 'float', x: enemy.x, y: enemy.y - spec.radius, text: `+${reward}`, color: '#fde047', life: 0.8 });

    if (enemy.kind === 'splitter') {
      spawnEnemy(world, 'mini', Math.max(0, enemy.dist - 12));
      spawnEnemy(world, 'mini', enemy.dist + 12);
    }
  });
};

const livingEnemiesInRange = (world: BastionWorld, x: number, y: number, range: number) =>
  world.enemies.filter(
    (enemy) => enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= range + BASTION_ENEMY_SPECS[enemy.kind].radius * 0.4
  );

const pickTarget = (world: BastionWorld, tower: BastionTower, range: number): BastionEnemy | null => {
  const center = getBastionTowerCenter(tower);
  let best: BastionEnemy | null = null;
  let bestScore = -Infinity;
  for (const enemy of livingEnemiesInRange(world, center.x, center.y, range)) {
    const score =
      tower.targeting === 'first'
        ? enemy.dist
        : tower.targeting === 'strong'
          ? enemy.hp + enemy.shield
          : -Math.hypot(enemy.x - center.x, enemy.y - center.y);
    if (score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
};

const fireTower = (world: BastionWorld, tower: BastionTower) => {
  const spec = BASTION_TOWER_SPECS[tower.kind];
  const stats = getBastionTowerStats(tower);
  const center = getBastionTowerCenter(tower);

  if (tower.kind === 'cryo') {
    const targets = livingEnemiesInRange(world, center.x, center.y, stats.range);
    if (targets.length === 0) return;
    targets.forEach((enemy) => {
      const resist = BASTION_ENEMY_SPECS[enemy.kind].isBoss ? 0.5 : 1;
      enemy.slowFactor = Math.min(enemy.slowFactor, 1 - stats.slow * resist);
      enemy.slowTimer = 1.8;
      damageEnemy(enemy, stats.damage * (1 + 0.6 * (tower.level - 1)), 'cryo', true);
    });
    addEffect(world, { kind: 'ring', x: center.x, y: center.y, color: spec.color, radius: stats.range, life: 0.45 });
    tower.cooldown = stats.cooldown;
    tower.recoil = 1;
    return;
  }

  const target = pickTarget(world, tower, stats.range);
  if (!target) return;
  tower.angle = Math.atan2(target.y - center.y, target.x - center.x);
  tower.recoil = 1;
  tower.cooldown = stats.cooldown;

  if (tower.kind === 'pulse') {
    damageEnemy(target, stats.damage, 'pulse', false);
    addEffect(world, { kind: 'tracer', x: center.x, y: center.y, x2: target.x, y2: target.y, color: spec.color, life: 0.12 });
    return;
  }

  if (tower.kind === 'arc') {
    const struck = new Set<number>([target.id]);
    let current = target;
    let damage = stats.damage;
    let fromX = center.x;
    let fromY = center.y;
    for (let hop = 0; hop < stats.chain; hop += 1) {
      damageEnemy(current, damage, 'arc', false);
      addEffect(world, { kind: 'arc', x: fromX, y: fromY, x2: current.x, y2: current.y, color: spec.color, life: 0.2 });
      fromX = current.x;
      fromY = current.y;
      damage *= 0.8;

      let next: BastionEnemy | null = null;
      let nextDistance = 100;
      for (const candidate of world.enemies) {
        if (candidate.hp <= 0 || struck.has(candidate.id)) continue;
        const distance = Math.hypot(candidate.x - fromX, candidate.y - fromY);
        if (distance < nextDistance) {
          next = candidate;
          nextDistance = distance;
        }
      }
      if (!next) break;
      current = next;
      struck.add(current.id);
    }
    return;
  }

  const dirX = Math.cos(tower.angle);
  const dirY = Math.sin(tower.angle);
  world.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    const relX = enemy.x - center.x;
    const relY = enemy.y - center.y;
    const along = relX * dirX + relY * dirY;
    const radius = BASTION_ENEMY_SPECS[enemy.kind].radius;
    if (along < 0 || along > stats.range + radius) return;
    if (Math.abs(relX * dirY - relY * dirX) <= radius + 7) {
      damageEnemy(enemy, stats.damage, 'rail', true);
    }
  });
  addEffect(world, {
    kind: 'beam',
    x: center.x,
    y: center.y,
    x2: center.x + dirX * stats.range,
    y2: center.y + dirY * stats.range,
    color: spec.color,
    life: 0.22,
  });
};

const finishWave = (world: BastionWorld) => {
  world.waveActive = false;
  const cleanBonus = world.waveLeaks === 0 ? 20 : 0;
  const bonus = 25 + world.wave * 6 + cleanBonus;
  world.credits += bonus;
  world.score += 150 + bonus * 2;
  addEffect(world, {
    kind: 'float',
    x: BASTION_STAGE_WIDTH / 2,
    y: BASTION_STAGE_HEIGHT / 2,
    text: `Wave ${world.wave} cleared  +${bonus}`,
    color: '#86efac',
    life: 1.8,
  });

  if (world.wave >= BASTION_TOTAL_WAVES) {
    world.status = 'won';
    world.score += world.core * 100 + Math.floor(world.credits / 2);
    world.lastEvent = 'The final wave is broken. The bastion holds.';
    return;
  }

  world.intermission = BASTION_WAVE_DELAY;
  world.lastEvent = cleanBonus
    ? `Wave ${world.wave} cleared with no leaks. Clean bonus earned.`
    : `Wave ${world.wave} cleared. Reinforce before the next one.`;
};

export const advanceBastionWorld = (world: BastionWorld, deltaSeconds: number): BastionWorld => {
  if (world.status !== 'playing' || world.paused) return world;
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
  if (dt === 0) return world;
  world.time += dt;

  if (!world.waveActive) {
    world.intermission -= dt;
    if (world.intermission <= 0) startWave(world);
  } else {
    world.waveClock += dt;
    while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.waveClock) {
      const spawn = world.spawnQueue.shift();
      if (spawn) spawnEnemy(world, spawn.kind, 0);
    }
  }

  const remaining: BastionEnemy[] = [];
  world.enemies.forEach((enemy) => {
    const spec = BASTION_ENEMY_SPECS[enemy.kind];
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt;
      if (enemy.slowTimer <= 0) enemy.slowFactor = 1;
    }
    if (enemy.maxShield > 0 && enemy.shield < enemy.maxShield) {
      enemy.shieldDelay -= dt;
      if (enemy.shieldDelay <= 0) {
        enemy.shield = Math.min(enemy.maxShield, enemy.shield + enemy.maxShield * 0.2 * dt);
      }
    }
    if (enemy.stunTimer > 0) {
      enemy.stunTimer -= dt;
    } else {
      enemy.dist += spec.speed * enemy.slowFactor * dt;
    }

    if (enemy.dist >= BASTION_PATH_LENGTH) {
      world.core -= spec.leak;
      world.leaks += 1;
      world.waveLeaks += 1;
      world.lastEvent = `${spec.label} breached the core (-${spec.leak}).`;
      addEffect(world, {
        kind: 'float',
        x: BASTION_STAGE_WIDTH - 50,
        y: BASTION_PATH_POINTS[BASTION_PATH_POINTS.length - 1].y - 28,
        text: `-${spec.leak} core`,
        color: '#f87171',
        life: 1,
      });
      addEffect(world, {
        kind: 'burst',
        x: BASTION_STAGE_WIDTH - 24,
        y: BASTION_PATH_POINTS[BASTION_PATH_POINTS.length - 1].y,
        color: '#f87171',
        radius: 46,
        life: 0.5,
      });
      return;
    }

    const point = getBastionPathPoint(enemy.dist);
    enemy.x = point.x;
    enemy.y = point.y;
    enemy.angle = point.angle;
    remaining.push(enemy);
  });
  world.enemies = remaining;

  if (world.core <= 0) {
    world.core = 0;
    world.status = 'lost';
    world.lastEvent = 'The core has fallen.';
    return world;
  }

  world.towers.forEach((tower) => {
    tower.cooldown -= dt;
    tower.recoil = Math.max(0, tower.recoil - dt * 5);
    if (tower.cooldown <= 0) fireTower(world, tower);
  });
  reapEnemies(world);

  world.effects.forEach((effect) => {
    effect.life -= dt;
  });
  world.effects = world.effects.filter((effect) => effect.life > 0);

  if (world.waveActive && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    finishWave(world);
  }

  return world;
};

export const findBastionTowerAt = (world: BastionWorld, col: number, row: number): BastionTower | null =>
  world.towers.find((tower) => tower.col === col && tower.row === row) ?? null;

export const placeBastionTower = (
  world: BastionWorld,
  kind: BastionTowerKind,
  col: number,
  row: number
): BastionActionResult => {
  if (world.status !== 'playing') return { ok: false, message: 'The match is over.' };
  if (!isBastionCellInside(col, row)) return { ok: false, message: 'Outside the bastion grid.' };
  if (isBastionPathCell(col, row)) return { ok: false, message: 'The lane cannot be built on.' };
  if (findBastionTowerAt(world, col, row)) return { ok: false, message: 'That tile is already occupied.' };

  const spec = BASTION_TOWER_SPECS[kind];
  if (world.credits < spec.cost) {
    return { ok: false, message: `${spec.label} needs ${spec.cost} credits.` };
  }

  world.credits -= spec.cost;
  world.towers.push({
    id: world.nextId++,
    kind,
    col,
    row,
    level: 1,
    cooldown: 0.3,
    targeting: 'first',
    invested: spec.cost,
    angle: -Math.PI / 2,
    recoil: 0,
  });
  const center = getBastionTowerCenter({ col, row });
  addEffect(world, { kind: 'burst', x: center.x, y: center.y, color: spec.color, radius: 34, life: 0.35 });
  world.lastEvent = `${spec.label} online.`;
  return { ok: true, message: world.lastEvent };
};

export const upgradeBastionTower = (world: BastionWorld, towerId: number): BastionActionResult => {
  const tower = world.towers.find((candidate) => candidate.id === towerId);
  if (!tower || world.status !== 'playing') return { ok: false, message: 'Select a tower first.' };
  const cost = getBastionUpgradeCost(tower);
  if (cost === null) return { ok: false, message: 'Already at maximum level.' };
  if (world.credits < cost) return { ok: false, message: `Upgrade needs ${cost} credits.` };

  world.credits -= cost;
  tower.invested += cost;
  tower.level += 1;
  const center = getBastionTowerCenter(tower);
  addEffect(world, { kind: 'ring', x: center.x, y: center.y, color: '#fde047', radius: 44, life: 0.4 });
  world.lastEvent = `${BASTION_TOWER_SPECS[tower.kind].label} upgraded to level ${tower.level}.`;
  return { ok: true, message: world.lastEvent };
};

export const sellBastionTower = (world: BastionWorld, towerId: number): BastionActionResult => {
  const index = world.towers.findIndex((candidate) => candidate.id === towerId);
  if (index < 0 || world.status !== 'playing') return { ok: false, message: 'Select a tower first.' };

  const [tower] = world.towers.splice(index, 1);
  const value = getBastionSellValue(tower);
  world.credits += value;
  const center = getBastionTowerCenter(tower);
  addEffect(world, { kind: 'float', x: center.x, y: center.y, text: `+${value}`, color: '#fde047', life: 0.8 });
  world.lastEvent = `${BASTION_TOWER_SPECS[tower.kind].label} sold for ${value}.`;
  return { ok: true, message: world.lastEvent };
};

export const cycleBastionTargeting = (world: BastionWorld, towerId: number): BastionActionResult => {
  const tower = world.towers.find((candidate) => candidate.id === towerId);
  if (!tower) return { ok: false, message: 'Select a tower first.' };
  const order: BastionTargeting[] = ['first', 'strong', 'close'];
  tower.targeting = order[(order.indexOf(tower.targeting) + 1) % order.length];
  world.lastEvent = `Targeting: ${BASTION_TARGETING_LABELS[tower.targeting]}.`;
  return { ok: true, message: world.lastEvent };
};

export const BASTION_TARGETING_LABELS: Record<BastionTargeting, string> = {
  first: 'First in line',
  strong: 'Strongest',
  close: 'Closest',
};

export const callBastionWave = (world: BastionWorld): BastionActionResult => {
  if (world.status !== 'playing') return { ok: false, message: 'The match is over.' };
  if (world.waveActive) return { ok: false, message: 'A wave is already underway.' };
  const bonus = Math.floor(world.intermission);
  world.credits += bonus;
  if (bonus > 0) {
    addEffect(world, {
      kind: 'float',
      x: BASTION_STAGE_WIDTH / 2,
      y: BASTION_STAGE_HEIGHT / 2 - 40,
      text: `Early call +${bonus}`,
      color: '#fde047',
      life: 1.2,
    });
  }
  startWave(world);
  return { ok: true, message: world.lastEvent };
};

export const triggerBastionSurge = (world: BastionWorld, x: number, y: number): BastionActionResult => {
  if (world.status !== 'playing') return { ok: false, message: 'The match is over.' };
  if (world.surge < BASTION_SURGE_COST) {
    return { ok: false, message: `Surge charging: ${Math.floor(world.surge)}/${BASTION_SURGE_COST}.` };
  }

  const centerX = Math.min(BASTION_STAGE_WIDTH, Math.max(0, x));
  const centerY = Math.min(BASTION_STAGE_HEIGHT, Math.max(0, y));
  const damage = 55 + world.wave * 9;
  let hits = 0;
  world.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    const spec = BASTION_ENEMY_SPECS[enemy.kind];
    if (Math.hypot(enemy.x - centerX, enemy.y - centerY) > BASTION_SURGE_RADIUS + spec.radius) return;
    damageEnemy(enemy, damage, 'surge', true);
    enemy.stunTimer = Math.max(enemy.stunTimer, spec.isBoss ? 0.9 : 2.2);
    hits += 1;
  });
  world.surge = 0;
  addEffect(world, { kind: 'surge', x: centerX, y: centerY, color: '#fde047', radius: BASTION_SURGE_RADIUS, life: 0.6 });
  reapEnemies(world);
  world.lastEvent = hits > 0 ? `Surge Pulse struck ${hits} target${hits === 1 ? '' : 's'}.` : 'Surge Pulse hit empty ground.';
  return { ok: true, message: world.lastEvent };
};

export const formatBastionCountdown = (seconds: number): string => `${Math.max(0, Math.ceil(seconds))}s`;
