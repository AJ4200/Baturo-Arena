'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineDelete,
  AiOutlineDrag,
  AiOutlineFastForward,
  AiOutlineInfoCircle,
  AiOutlinePause,
  AiOutlinePlayCircle,
  AiOutlinePlus,
  AiOutlineReload,
  AiOutlineRise,
  AiOutlineSound,
  AiOutlineSwap,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import {
  BASTION_CELL,
  BASTION_COLS,
  BASTION_ENEMY_SPECS,
  BASTION_MAX_TOWER_LEVEL,
  BASTION_PATH_POINTS,
  BASTION_ROWS,
  BASTION_STAGE_HEIGHT,
  BASTION_STAGE_WIDTH,
  BASTION_SURGE_COST,
  BASTION_SURGE_RADIUS,
  BASTION_TARGETING_LABELS,
  BASTION_TOTAL_WAVES,
  BASTION_TOWER_ORDER,
  BASTION_TOWER_SPECS,
  advanceBastionWorld,
  callBastionWave,
  createInitialBastionWorld,
  cycleBastionTargeting,
  findBastionTowerAt,
  formatBastionCountdown,
  getBastionSellValue,
  getBastionTowerCenter,
  getBastionTowerStats,
  getBastionUpgradeCost,
  isBastionCellInside,
  isBastionPathCell,
  placeBastionTower,
  sellBastionTower,
  triggerBastionSurge,
  upgradeBastionTower,
  type BastionTower,
  type BastionTowerKind,
  type BastionWorld,
} from '@/lib/bastionSurgeEngine';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloBastionSurgeGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type UiState = {
  col: number;
  row: number;
  cursorVisible: boolean;
  buildKind: BastionTowerKind | null;
  selectedId: number | null;
  surgeArmed: boolean;
  surgeX: number;
  surgeY: number;
};

const BEST_SCORE_KEY = 'baturo_bastion_surge_best_score';

const readThemeColor = (canvas: HTMLCanvasElement, property: string, fallback: string): string => {
  const value = window.getComputedStyle(canvas).getPropertyValue(property).trim();
  return value ? `rgb(${value})` : fallback;
};

const drawPolygon = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation: number
) => {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
};

const TOWER_SIDES: Record<BastionTowerKind, number> = { pulse: 4, arc: 6, rail: 3, cryo: 8 };

const drawTower = (
  context: CanvasRenderingContext2D,
  kind: BastionTowerKind,
  x: number,
  y: number,
  level: number,
  angle: number,
  recoil: number,
  alpha: number
) => {
  const spec = BASTION_TOWER_SPECS[kind];
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = 'rgba(6, 12, 22, 0.85)';
  context.strokeStyle = spec.color;
  context.lineWidth = 2.5;
  drawPolygon(context, x, y, 22, TOWER_SIDES[kind], Math.PI / 4);
  context.fill();
  context.stroke();
  context.fillStyle = spec.color;
  drawPolygon(context, x, y, 11 + level * 1.5, TOWER_SIDES[kind], angle);
  context.fill();
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(angle) * (20 - recoil * 6), y + Math.sin(angle) * (20 - recoil * 6));
  context.stroke();
  for (let pip = 0; pip < level; pip += 1) {
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x - 8 + pip * 8, y + 28, 2.6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};

const drawWorld = (canvas: HTMLCanvasElement, world: BastionWorld, ui: UiState) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const themeBase = readThemeColor(canvas, '--match-base-rgb', '#35d7b1');
  const themeLight = readThemeColor(canvas, '--match-light-rgb', '#dffff7');
  const themeDark = readThemeColor(canvas, '--match-dark-rgb', '#081522');
  const themeDeep = readThemeColor(canvas, '--match-deep-rgb', '#04101a');

  context.clearRect(0, 0, BASTION_STAGE_WIDTH, BASTION_STAGE_HEIGHT);
  const background = context.createLinearGradient(0, 0, 0, BASTION_STAGE_HEIGHT);
  background.addColorStop(0, themeDark);
  background.addColorStop(1, themeDeep);
  context.fillStyle = background;
  context.fillRect(0, 0, BASTION_STAGE_WIDTH, BASTION_STAGE_HEIGHT);

  // Buildable grid
  context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  context.lineWidth = 1;
  for (let col = 0; col <= BASTION_COLS; col += 1) {
    context.beginPath();
    context.moveTo(col * BASTION_CELL, 0);
    context.lineTo(col * BASTION_CELL, BASTION_STAGE_HEIGHT);
    context.stroke();
  }
  for (let row = 0; row <= BASTION_ROWS; row += 1) {
    context.beginPath();
    context.moveTo(0, row * BASTION_CELL);
    context.lineTo(BASTION_STAGE_WIDTH, row * BASTION_CELL);
    context.stroke();
  }

  // Enemy lane
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const tracePath = () => {
    context.beginPath();
    BASTION_PATH_POINTS.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
  };
  context.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  context.lineWidth = BASTION_CELL - 4;
  tracePath();
  context.stroke();
  context.strokeStyle = themeBase;
  context.globalAlpha = 0.16;
  context.lineWidth = BASTION_CELL - 12;
  tracePath();
  context.stroke();
  context.globalAlpha = 0.5;
  context.strokeStyle = themeLight;
  context.lineWidth = 2;
  context.setLineDash([10, 14]);
  context.lineDashOffset = -world.time * 40;
  tracePath();
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;

  // Core at the exit
  const coreRatio = world.core / world.maxCore;
  const corePulse = 1 + Math.sin(world.time * 3) * 0.06;
  context.save();
  context.translate(BASTION_STAGE_WIDTH - 22, 7.5 * BASTION_CELL);
  context.shadowColor = themeBase;
  context.shadowBlur = 24;
  context.fillStyle = coreRatio > 0.4 ? themeBase : '#ff5c6c';
  drawPolygon(context, 0, 0, 24 * corePulse, 6, world.time);
  context.fill();
  context.restore();

  // Selected tower range / build ghost range
  const selected = ui.selectedId === null ? null : world.towers.find((tower) => tower.id === ui.selectedId) ?? null;
  const drawRange = (cx: number, cy: number, range: number, color: string) => {
    context.beginPath();
    context.arc(cx, cy, range, 0, Math.PI * 2);
    context.fillStyle = color;
    context.globalAlpha = 0.1;
    context.fill();
    context.globalAlpha = 0.6;
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
    context.globalAlpha = 1;
  };
  if (selected) {
    const center = getBastionTowerCenter(selected);
    drawRange(center.x, center.y, getBastionTowerStats(selected).range, BASTION_TOWER_SPECS[selected.kind].color);
  }

  // Towers
  world.towers.forEach((tower) => {
    const center = getBastionTowerCenter(tower);
    drawTower(context, tower.kind, center.x, center.y, tower.level, tower.angle, tower.recoil, 1);
    if (tower.id === ui.selectedId) {
      context.strokeStyle = themeLight;
      context.lineWidth = 2;
      context.strokeRect(tower.col * BASTION_CELL + 3, tower.row * BASTION_CELL + 3, BASTION_CELL - 6, BASTION_CELL - 6);
    }
  });

  // Enemies
  world.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    const spec = BASTION_ENEMY_SPECS[enemy.kind];
    context.save();
    context.translate(enemy.x, enemy.y);
    context.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : spec.color;
    context.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    context.lineWidth = 2;
    const sides = enemy.kind === 'runner' ? 3 : enemy.kind === 'brute' ? 5 : enemy.kind === 'colossus' ? 8 : enemy.kind === 'splitter' ? 6 : 4;
    drawPolygon(context, 0, 0, spec.radius, sides, enemy.angle);
    context.fill();
    context.stroke();
    if (enemy.slowTimer > 0) {
      context.strokeStyle = '#8fe8ff';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, spec.radius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    if (enemy.stunTimer > 0) {
      context.fillStyle = '#fff27a';
      context.font = 'bold 14px sans-serif';
      context.textAlign = 'center';
      context.fillText('✦', 0, -spec.radius - 14);
    }
    if (enemy.maxShield > 0 && enemy.shield > 0) {
      context.strokeStyle = 'rgba(120, 200, 255, 0.85)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, spec.radius + 5, 0, Math.PI * 2 * (enemy.shield / enemy.maxShield));
      context.stroke();
    }
    if (enemy.hp < enemy.maxHp) {
      const width = Math.max(22, spec.radius * 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.6)';
      context.fillRect(-width / 2, -spec.radius - 9, width, 4);
      context.fillStyle = '#6dff9c';
      context.fillRect(-width / 2, -spec.radius - 9, width * (enemy.hp / enemy.maxHp), 4);
    }
    context.restore();
  });

  // Effects
  world.effects.forEach((effect) => {
    const t = Math.max(0, effect.life / effect.maxLife);
    context.save();
    context.globalAlpha = t;
    context.strokeStyle = effect.color;
    context.fillStyle = effect.color;
    if (effect.kind === 'tracer' || effect.kind === 'arc' || effect.kind === 'beam') {
      context.lineWidth = effect.kind === 'beam' ? 4 + 6 * t : effect.kind === 'arc' ? 3 : 2;
      context.shadowColor = effect.color;
      context.shadowBlur = 12;
      context.beginPath();
      context.moveTo(effect.x, effect.y);
      if (effect.kind === 'arc') {
        const mx = (effect.x + effect.x2) / 2 + Math.sin(effect.id * 7.3) * 10;
        const my = (effect.y + effect.y2) / 2 + Math.cos(effect.id * 5.1) * 10;
        context.lineTo(mx, my);
      }
      context.lineTo(effect.x2, effect.y2);
      context.stroke();
    } else if (effect.kind === 'ring' || effect.kind === 'surge') {
      const radius = effect.radius * (1 - t * 0.6);
      context.lineWidth = effect.kind === 'surge' ? 6 : 3;
      context.beginPath();
      context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      context.stroke();
      if (effect.kind === 'surge') {
        context.globalAlpha = t * 0.25;
        context.fill();
      }
    } else if (effect.kind === 'burst') {
      context.beginPath();
      context.arc(effect.x, effect.y, effect.radius * (1.2 - t * 0.7), 0, Math.PI * 2);
      context.fill();
    } else if (effect.kind === 'float') {
      context.font = 'bold 15px sans-serif';
      context.textAlign = 'center';
      context.fillText(effect.text, effect.x, effect.y - (1 - t) * 24);
    }
    context.restore();
  });

  // Cursor / ghost / surge reticle
  if (ui.surgeArmed) {
    context.save();
    context.strokeStyle = '#ffe36b';
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.arc(ui.surgeX, ui.surgeY, BASTION_SURGE_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  } else if (ui.cursorVisible) {
    const x = ui.col * BASTION_CELL;
    const y = ui.row * BASTION_CELL;
    const buildable =
      isBastionCellInside(ui.col, ui.row) && !isBastionPathCell(ui.col, ui.row) && !findBastionTowerAt(world, ui.col, ui.row);
    if (ui.buildKind && isBastionCellInside(ui.col, ui.row)) {
      const spec = BASTION_TOWER_SPECS[ui.buildKind];
      const affordable = world.credits >= spec.cost;
      if (buildable) drawRange(x + BASTION_CELL / 2, y + BASTION_CELL / 2, spec.range, spec.color);
      drawTower(context, ui.buildKind, x + BASTION_CELL / 2, y + BASTION_CELL / 2, 1, -Math.PI / 2, 0, buildable && affordable ? 0.7 : 0.3);
      if (!buildable || !affordable) {
        context.fillStyle = 'rgba(255, 70, 90, 0.25)';
        context.fillRect(x, y, BASTION_CELL, BASTION_CELL);
      }
    }
    context.strokeStyle = themeLight;
    context.lineWidth = 2;
    context.strokeRect(x + 2, y + 2, BASTION_CELL - 4, BASTION_CELL - 4);
  }

  if (world.paused && world.status === 'playing') {
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.fillRect(0, 0, BASTION_STAGE_WIDTH, BASTION_STAGE_HEIGHT);
    context.fillStyle = themeLight;
    context.font = 'bold 44px sans-serif';
    context.textAlign = 'center';
    context.fillText('PAUSED', BASTION_STAGE_WIDTH / 2, BASTION_STAGE_HEIGHT / 2);
  }
};

const readBestScore = (): number => {
  if (typeof window === 'undefined') return 0;
  const parsed = Number(window.localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(parsed) ? parsed : 0;
};

const createUi = (): UiState => ({
  col: 8,
  row: 5,
  cursorVisible: false,
  buildKind: 'pulse',
  selectedId: null,
  surgeArmed: false,
  surgeX: BASTION_STAGE_WIDTH / 2,
  surgeY: BASTION_STAGE_HEIGHT / 2,
});

export function SoloBastionSurgeGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloBastionSurgeGameProps) {
  const gameLabel = formatGameName('bastion-surge', gameDefinitions);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<BastionWorld>(createInitialBastionWorld());
  const uiRef = useRef<UiState>(createUi());
  const speedRef = useRef(1);
  const reportedRef = useRef(false);
  const lastHudRef = useRef(0);
  const [, setVersion] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const world = worldRef.current;
  const ui = uiRef.current;

  useEffect(() => {
    setBestScore(readBestScore());
  }, []);

  const announce = useCallback((message: string) => {
    worldRef.current.lastEvent = message;
  }, []);

  const resetGame = useCallback(() => {
    worldRef.current = createInitialBastionWorld();
    uiRef.current = createUi();
    reportedRef.current = false;
    speedRef.current = 1;
    setSpeed(1);
    refresh();
  }, [refresh]);

  const selectKind = useCallback(
    (kind: BastionTowerKind | null) => {
      uiRef.current.buildKind = kind;
      uiRef.current.selectedId = null;
      uiRef.current.surgeArmed = false;
      refresh();
    },
    [refresh]
  );

  const activateCell = useCallback(
    (col: number, row: number) => {
      const current = worldRef.current;
      const state = uiRef.current;
      if (current.status !== 'playing' || current.paused) return;
      const existing = findBastionTowerAt(current, col, row);
      if (existing) {
        state.selectedId = existing.id;
        state.buildKind = null;
      } else if (state.buildKind) {
        const result = placeBastionTower(current, state.buildKind, col, row);
        announce(result.message);
      } else {
        state.selectedId = null;
      }
      refresh();
    },
    [announce, refresh]
  );

  const fireSurge = useCallback(
    (x: number, y: number) => {
      const result = triggerBastionSurge(worldRef.current, x, y);
      announce(result.message);
      if (result.ok) uiRef.current.surgeArmed = false;
      refresh();
    },
    [announce, refresh]
  );

  const toggleSurge = useCallback(() => {
    const current = worldRef.current;
    const state = uiRef.current;
    if (current.status !== 'playing') return;
    if (current.surge < BASTION_SURGE_COST) {
      announce(`Surge Pulse charging (${Math.floor(current.surge)}/${BASTION_SURGE_COST})`);
      state.surgeArmed = false;
    } else {
      state.surgeArmed = !state.surgeArmed;
      state.surgeX = state.col * BASTION_CELL + BASTION_CELL / 2;
      state.surgeY = state.row * BASTION_CELL + BASTION_CELL / 2;
    }
    refresh();
  }, [announce, refresh]);

  const getSelectedTower = useCallback((): BastionTower | null => {
    const id = uiRef.current.selectedId;
    return id === null ? null : worldRef.current.towers.find((tower) => tower.id === id) ?? null;
  }, []);

  const upgradeSelected = useCallback(() => {
    const tower = getSelectedTower();
    if (!tower) return announce('Select a tower first');
    announce(upgradeBastionTower(worldRef.current, tower.id).message);
    refresh();
  }, [announce, getSelectedTower, refresh]);

  const sellSelected = useCallback(() => {
    const tower = getSelectedTower();
    if (!tower) return announce('Select a tower first');
    const result = sellBastionTower(worldRef.current, tower.id);
    announce(result.message);
    if (result.ok) uiRef.current.selectedId = null;
    refresh();
  }, [announce, getSelectedTower, refresh]);

  const cycleSelected = useCallback(() => {
    const tower = getSelectedTower();
    if (!tower) return announce('Select a tower first');
    announce(cycleBastionTargeting(worldRef.current, tower.id).message);
    refresh();
  }, [announce, getSelectedTower, refresh]);

  const callWave = useCallback(() => {
    if (worldRef.current.status !== 'playing') return;
    announce(callBastionWave(worldRef.current).message);
    refresh();
  }, [announce, refresh]);

  const togglePause = useCallback(() => {
    if (worldRef.current.status !== 'playing') return;
    worldRef.current.paused = !worldRef.current.paused;
    refresh();
  }, [refresh]);

  const toggleSpeed = useCallback(() => {
    speedRef.current = speedRef.current === 1 ? 2 : 1;
    setSpeed(speedRef.current);
  }, []);

  const moveCursor = useCallback(
    (dCol: number, dRow: number) => {
      const state = uiRef.current;
      state.col = Math.min(BASTION_COLS - 1, Math.max(0, state.col + dCol));
      state.row = Math.min(BASTION_ROWS - 1, Math.max(0, state.row + dRow));
      state.cursorVisible = true;
      if (state.surgeArmed) {
        state.surgeX = state.col * BASTION_CELL + BASTION_CELL / 2;
        state.surgeY = state.row * BASTION_CELL + BASTION_CELL / 2;
      }
      refresh();
    },
    [refresh]
  );

  const confirmCursor = useCallback(() => {
    const state = uiRef.current;
    if (state.surgeArmed) fireSurge(state.surgeX, state.surgeY);
    else activateCell(state.col, state.row);
  }, [activateCell, fireSurge]);

  const cancelAction = useCallback(() => {
    const state = uiRef.current;
    state.buildKind = null;
    state.selectedId = null;
    state.surgeArmed = false;
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      const handled = (() => {
        switch (key) {
          case 'arrowup':
          case 'w':
            moveCursor(0, -1);
            return true;
          case 'arrowdown':
          case 's':
            moveCursor(0, 1);
            return true;
          case 'arrowleft':
          case 'a':
            moveCursor(-1, 0);
            return true;
          case 'arrowright':
          case 'd':
            moveCursor(1, 0);
            return true;
          case 'enter':
          case 'e':
            confirmCursor();
            return true;
          case '1':
          case '2':
          case '3':
          case '4':
            selectKind(BASTION_TOWER_ORDER[Number(key) - 1]);
            return true;
          case 'u':
            upgradeSelected();
            return true;
          case 'x':
            sellSelected();
            return true;
          case 't':
            cycleSelected();
            return true;
          case 'n':
          case ' ':
            callWave();
            return true;
          case 'q':
            toggleSurge();
            return true;
          case 'f':
            toggleSpeed();
            return true;
          case 'p':
            togglePause();
            return true;
          case 'r':
            resetGame();
            return true;
          case 'escape':
            cancelAction();
            return true;
          default:
            return false;
        }
      })();
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    callWave,
    cancelAction,
    confirmCursor,
    cycleSelected,
    moveCursor,
    resetGame,
    selectKind,
    sellSelected,
    toggleSpeed,
    togglePause,
    toggleSurge,
    upgradeSelected,
  ]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const current = worldRef.current;
      if (current.status === 'playing' && !current.paused) {
        for (let pass = 0; pass < speedRef.current; pass += 1) advanceBastionWorld(current, delta);
      }
      if (canvasRef.current) drawWorld(canvasRef.current, current, uiRef.current);
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        setVersion((value) => value + 1);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (world.status === 'playing' || reportedRef.current) return;
    reportedRef.current = true;
    const stored = readBestScore();
    if (world.score > stored) {
      window.localStorage.setItem(BEST_SCORE_KEY, String(world.score));
      setBestScore(world.score);
    }
    onMatchComplete({
      mode: 'cpu',
      gameType: 'bastion-surge',
      outcome: world.status === 'won' ? 'win' : 'loss',
      opponent: 'Surge Legion',
    });
  }, [onMatchComplete, world.score, world.status]);

  const pointerToCell = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BASTION_STAGE_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * BASTION_STAGE_HEIGHT;
    return {
      x,
      y,
      col: Math.min(BASTION_COLS - 1, Math.max(0, Math.floor(x / BASTION_CELL))),
      row: Math.min(BASTION_ROWS - 1, Math.max(0, Math.floor(y / BASTION_CELL))),
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerToCell(event);
    const state = uiRef.current;
    state.col = point.col;
    state.row = point.row;
    state.cursorVisible = true;
    state.surgeX = point.x;
    state.surgeY = point.y;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerMove(event);
    const state = uiRef.current;
    if (event.button === 2) {
      cancelAction();
      return;
    }
    if (state.surgeArmed) fireSurge(state.surgeX, state.surgeY);
    else activateCell(state.col, state.row);
  };

  const selected = getSelectedTower();
  const selectedStats = selected ? getBastionTowerStats(selected) : null;
  const upgradeCost = selected ? getBastionUpgradeCost(selected) : null;
  const surgeReady = world.surge >= BASTION_SURGE_COST;
  const statusLabel = world.status === 'won' ? 'Victory' : world.status === 'lost' ? 'Breached' : world.paused ? 'Paused' : world.waveActive ? 'In combat' : 'Build phase';
  const nextWave = Math.min(BASTION_TOTAL_WAVES, world.wave + (world.waveActive ? 0 : 1));

  const controllerSections = useMemo(
    () => [
      {
        key: 'cursor',
        title: 'Cursor',
        layout: 'dpad' as const,
        buttons: [
          { key: 'cur-up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => moveCursor(0, -1) },
          { key: 'cur-left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => moveCursor(-1, 0) },
          { key: 'cur-down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => moveCursor(0, 1) },
          { key: 'cur-right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => moveCursor(1, 0) },
          { key: 'cur-place', label: 'Place', icon: <AiOutlinePlus />, slot: 'center' as const, onClick: confirmCursor },
        ],
      },
      {
        key: 'towers',
        title: 'Towers',
        subtitle: 'Pick what to build',
        layout: 'row' as const,
        buttons: BASTION_TOWER_ORDER.map((kind) => ({
          key: `tower-${kind}`,
          label: `${BASTION_TOWER_SPECS[kind].short} ${BASTION_TOWER_SPECS[kind].cost}`,
          icon: <AiOutlineThunderbolt />,
          onClick: () => selectKind(kind),
        })),
      },
      {
        key: 'actions',
        title: 'Command',
        layout: 'row' as const,
        buttons: [
          { key: 'upgrade', label: 'Upgrade', icon: <AiOutlineRise />, onClick: upgradeSelected },
          { key: 'sell', label: 'Sell', icon: <AiOutlineDelete />, onClick: sellSelected },
          { key: 'target', label: 'Target', icon: <AiOutlineSwap />, onClick: cycleSelected },
          { key: 'wave', label: 'Wave', icon: <AiOutlinePlayCircle />, onClick: callWave },
          { key: 'surge', label: 'Surge', icon: <AiOutlineThunderbolt />, onClick: toggleSurge },
          { key: 'speed', label: speed === 1 ? '2x' : '1x', icon: <AiOutlineFastForward />, onClick: toggleSpeed },
          { key: 'pause', label: world.paused ? 'Resume' : 'Pause', icon: <AiOutlinePause />, onClick: togglePause },
          { key: 'reset', label: 'Reset', icon: <AiOutlineReload />, onClick: resetGame },
        ],
      },
    ],
    [callWave, confirmCursor, cycleSelected, moveCursor, resetGame, selectKind, sellSelected, speed, toggleSpeed, togglePause, toggleSurge, upgradeSelected, world.paused]
  );

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Place towers, call waves, and fire the Surge Pulse"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button className="room-float-collapsed-center" type="button" onClick={() => setIsInfoCardCollapsed(false)} aria-label="Expand game info">
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle /> {gameLabel} Solo</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Status</span><strong>{statusLabel}</strong></div>
                <div className="solo-float-stat"><span>Wave</span><strong>{world.wave}/{BASTION_TOTAL_WAVES}</strong></div>
                <div className="solo-float-stat"><span>Core</span><strong>{world.core}/{world.maxCore}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{world.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
              </div>
              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={resetGame}><AiOutlineReload /> New Run</button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}><AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}</button>
                <button className="room-float-action-btn room-float-action-btn-danger" type="button" onClick={onLeave}>Leave</button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="bastion-surge-shell">
        <div className="bastion-surge-hud">
          <article><span>Wave</span><strong>{world.wave}/{BASTION_TOTAL_WAVES}</strong></article>
          <article><span>Credits</span><strong>{Math.floor(world.credits)}</strong></article>
          <article><span>Core</span><strong>{world.core}/{world.maxCore}</strong></article>
          <article><span>Kills</span><strong>{world.kills}</strong></article>
          <article>
            <span>Surge</span>
            <strong>{surgeReady ? 'READY' : `${Math.floor(world.surge)}%`}</strong>
          </article>
        </div>

        <div className="bastion-surge-stage-wrap">
          <canvas
            ref={canvasRef}
            className="bastion-surge-canvas"
            width={BASTION_STAGE_WIDTH}
            height={BASTION_STAGE_HEIGHT}
            aria-label="Bastion Surge tower defense field"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={() => {
              uiRef.current.cursorVisible = false;
            }}
            onContextMenu={(event) => event.preventDefault()}
          />
          <div className="bastion-surge-stage-overlay">
            <span>{world.waveActive ? `Wave ${world.wave} · ${world.enemies.length + world.spawnQueue.length} left` : world.wave >= BASTION_TOTAL_WAVES ? 'Final wave cleared' : `Wave ${nextWave} in ${formatBastionCountdown(world.intermission)}`}</span>
            <span>Score {world.score}</span>
            {speed === 2 ? <span>2x speed</span> : null}
          </div>
          {world.status !== 'playing' ? (
            <div className="bastion-surge-result">
              <span>{world.status === 'won' ? 'All waves repelled' : 'Core breached'}</span>
              <h2>{world.status === 'won' ? 'Bastion Held' : 'Bastion Fallen'}</h2>
              <p>
                {world.status === 'won'
                  ? `${world.kills} hostiles destroyed with ${world.core} core integrity left. ${world.score} points banked.`
                  : `Fell on wave ${world.wave} after ${world.kills} kills. ${world.score} points.`}
              </p>
              <div>
                <button type="button" onClick={resetGame}><AiOutlineReload /> Run Again</button>
                <button type="button" onClick={onLeave}>Leave Arena</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="bastion-surge-build-bar">
          {BASTION_TOWER_ORDER.map((kind, index) => {
            const spec = BASTION_TOWER_SPECS[kind];
            return (
              <button
                key={kind}
                type="button"
                className={`bastion-surge-tower-btn${ui.buildKind === kind ? ' is-active' : ''}${world.credits < spec.cost ? ' is-poor' : ''}`}
                style={{ '--tower-color': spec.color } as React.CSSProperties}
                onClick={() => selectKind(ui.buildKind === kind ? null : kind)}
                title={spec.blurb}
              >
                <kbd>{index + 1}</kbd>
                <strong>{spec.label}</strong>
                <span>{spec.cost}c</span>
                <small>{spec.blurb}</small>
              </button>
            );
          })}
          <button
            type="button"
            className={`bastion-surge-tower-btn bastion-surge-surge-btn${ui.surgeArmed ? ' is-active' : ''}${surgeReady ? ' is-ready' : ''}`}
            onClick={toggleSurge}
          >
            <kbd>Q</kbd>
            <strong>Surge Pulse</strong>
            <span>{surgeReady ? 'Ready' : `${Math.floor(world.surge)}%`}</span>
            <small>Stuns and blasts an area, ignoring shields</small>
          </button>
        </div>

        <div className="bastion-surge-inspector">
          {selected && selectedStats ? (
            <>
              <div>
                <span>{BASTION_TOWER_SPECS[selected.kind].label} · Lv {selected.level}/{BASTION_MAX_TOWER_LEVEL}</span>
                <strong>
                  DMG {Math.round(selectedStats.damage)} · Range {Math.round(selectedStats.range)} · {selectedStats.cooldown.toFixed(2)}s
                </strong>
                <small>Targeting: {BASTION_TARGETING_LABELS[selected.targeting]}</small>
              </div>
              <div className="bastion-surge-inspector-actions">
                <button type="button" onClick={upgradeSelected} disabled={upgradeCost === null || world.credits < upgradeCost}>
                  <AiOutlineRise /> {upgradeCost === null ? 'Maxed' : `Upgrade ${upgradeCost}c`}
                </button>
                <button type="button" onClick={cycleSelected}><AiOutlineSwap /> Target</button>
                <button type="button" onClick={sellSelected}><AiOutlineDelete /> Sell {getBastionSellValue(selected)}c</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>{world.lastEvent}</span>
              </div>
              <div className="bastion-surge-inspector-actions">
                <button type="button" onClick={callWave} disabled={world.waveActive || world.status !== 'playing'}>
                  <AiOutlinePlayCircle /> Call Wave Early
                </button>
                <button type="button" onClick={toggleSpeed}><AiOutlineFastForward /> {speed === 1 ? '2x Speed' : '1x Speed'}</button>
                <button type="button" onClick={togglePause}><AiOutlinePause /> {world.paused ? 'Resume' : 'Pause'}</button>
              </div>
            </>
          )}
        </div>

        <p className="bastion-surge-hint">
          Click a free tile to build, click a tower to manage it. 1-4 pick tower, U upgrade, X sell, T target, N call wave, Q Surge, F speed, P pause, Esc cancel.
        </p>
      </section>
    </>
  );
}
