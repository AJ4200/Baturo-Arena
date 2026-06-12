'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import {
  RIFT_STAGE_HEIGHT,
  RIFT_STAGE_WIDTH,
  RIFT_TARGET_CORES,
  advanceRiftRunnerWorld,
  createInitialRiftRunnerWorld,
  formatRiftRunnerTime,
  type RiftAimState,
  type RiftInputState,
  type RiftRunnerWorld,
} from '@/lib/riftRunnerEngine';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloRiftRunnerGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Direction = keyof RiftInputState;

const BEST_SCORE_KEY = 'baturo_rift_runner_best_score';

const readThemeColor = (
  canvas: HTMLCanvasElement,
  property: string,
  fallback: string
): string => {
  const value = window.getComputedStyle(canvas).getPropertyValue(property).trim();
  return value ? `rgb(${value})` : fallback;
};

const drawDiamond = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) => {
  context.beginPath();
  context.moveTo(x, y - radius);
  context.lineTo(x + radius, y);
  context.lineTo(x, y + radius);
  context.lineTo(x - radius, y);
  context.closePath();
};

const drawWorld = (
  canvas: HTMLCanvasElement,
  world: RiftRunnerWorld,
  aim: RiftAimState
) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const themeBase = readThemeColor(canvas, '--match-base-rgb', '#35d7b1');
  const themeLight = readThemeColor(canvas, '--match-light-rgb', '#dffff7');
  const themeDark = readThemeColor(canvas, '--match-dark-rgb', '#081522');
  const themeDeep = readThemeColor(canvas, '--match-deep-rgb', '#12253a');
  const time = world.timeLeftMs / 1000;

  context.clearRect(0, 0, RIFT_STAGE_WIDTH, RIFT_STAGE_HEIGHT);

  const background = context.createLinearGradient(0, 0, RIFT_STAGE_WIDTH, RIFT_STAGE_HEIGHT);
  background.addColorStop(0, '#040915');
  background.addColorStop(0.5, '#0d1730');
  background.addColorStop(1, themeDeep);
  context.fillStyle = background;
  context.fillRect(0, 0, RIFT_STAGE_WIDTH, RIFT_STAGE_HEIGHT);

  context.save();
  context.globalAlpha = 0.14;
  context.strokeStyle = themeLight;
  context.lineWidth = 1;
  const gridOffset = (time * 12) % 40;
  for (let x = -40 + gridOffset; x < RIFT_STAGE_WIDTH + 40; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - 95, RIFT_STAGE_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= RIFT_STAGE_HEIGHT; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(RIFT_STAGE_WIDTH, y);
    context.stroke();
  }
  context.restore();

  const arenaGlow = context.createRadialGradient(
    world.player.x,
    world.player.y,
    20,
    world.player.x,
    world.player.y,
    280
  );
  arenaGlow.addColorStop(0, 'rgba(80, 235, 210, 0.14)');
  arenaGlow.addColorStop(0.55, 'rgba(90, 110, 255, 0.05)');
  arenaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = arenaGlow;
  context.fillRect(0, 0, RIFT_STAGE_WIDTH, RIFT_STAGE_HEIGHT);

  world.portals.forEach((portal) => {
    const progress = 1 - portal.lifeMs / portal.maxLifeMs;
    context.save();
    context.translate(portal.x, portal.y);
    context.rotate(progress * Math.PI);
    context.strokeStyle = `rgba(255, 88, 190, ${0.75 * (1 - progress)})`;
    context.lineWidth = 7;
    context.shadowBlur = 24;
    context.shadowColor = '#ff58be';
    context.beginPath();
    context.arc(0, 0, 18 + progress * 42, 0, Math.PI * 1.35);
    context.stroke();
    context.restore();
  });

  world.projectiles.forEach((projectile) => {
    context.save();
    context.fillStyle = projectile.owner === 'player' ? themeLight : '#ff658b';
    context.shadowBlur = 16;
    context.shadowColor = projectile.owner === 'player' ? themeBase : '#ff4775';
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  world.enemies.forEach((enemy) => {
    const enemyColor =
      enemy.kind === 'brute' ? '#ff9b52' : enemy.kind === 'gunner' ? '#ff65ae' : '#76e8ff';
    context.save();
    context.translate(enemy.x, enemy.y);
    context.rotate(enemy.phase);
    context.shadowBlur = 18;
    context.shadowColor = enemyColor;
    context.fillStyle = enemyColor;
    context.strokeStyle = '#050812';
    context.lineWidth = 4;
    drawDiamond(context, 0, 0, enemy.radius);
    context.fill();
    context.stroke();

    context.rotate(-enemy.phase * 2);
    context.fillStyle = themeDark;
    context.beginPath();
    context.arc(0, 0, Math.max(4, enemy.radius * 0.3), 0, Math.PI * 2);
    context.fill();
    context.restore();

    const healthWidth = enemy.radius * 2.3;
    context.fillStyle = 'rgba(0, 0, 0, 0.62)';
    context.fillRect(enemy.x - healthWidth / 2, enemy.y - enemy.radius - 12, healthWidth, 5);
    context.fillStyle = enemyColor;
    context.fillRect(
      enemy.x - healthWidth / 2,
      enemy.y - enemy.radius - 12,
      healthWidth * Math.max(0, enemy.hp / enemy.maxHp),
      5
    );
  });

  const { player } = world;
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.angle);
  context.globalAlpha =
    player.invulnerableMs > 0 && Math.floor(player.invulnerableMs / 70) % 2 === 0 ? 0.32 : 1;
  context.shadowBlur = player.dashMs > 0 ? 34 : 22;
  context.shadowColor = player.dashMs > 0 ? '#ffffff' : themeBase;
  context.fillStyle = player.dashMs > 0 ? '#ffffff' : themeLight;
  context.strokeStyle = '#030711';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(23, 0);
  context.lineTo(-12, 14);
  context.lineTo(-6, 0);
  context.lineTo(-12, -14);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = themeBase;
  context.beginPath();
  context.arc(3, 0, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const reticle =
    aim.manual
      ? aim
      : {
          x: player.x + Math.cos(player.angle) * 95,
          y: player.y + Math.sin(player.angle) * 95,
        };
  context.save();
  context.strokeStyle = aim.manual ? themeLight : 'rgba(255, 255, 255, 0.5)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(reticle.x, reticle.y, 12, 0, Math.PI * 2);
  context.moveTo(reticle.x - 18, reticle.y);
  context.lineTo(reticle.x - 7, reticle.y);
  context.moveTo(reticle.x + 7, reticle.y);
  context.lineTo(reticle.x + 18, reticle.y);
  context.moveTo(reticle.x, reticle.y - 18);
  context.lineTo(reticle.x, reticle.y - 7);
  context.moveTo(reticle.x, reticle.y + 7);
  context.lineTo(reticle.x, reticle.y + 18);
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(255,255,255,0.17)';
  context.lineWidth = 3;
  context.strokeRect(8, 8, RIFT_STAGE_WIDTH - 16, RIFT_STAGE_HEIGHT - 16);
  context.restore();
};

export function SoloRiftRunnerGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloRiftRunnerGameProps) {
  const [world, setWorld] = useState<RiftRunnerWorld>(() => createInitialRiftRunnerWorld());
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<RiftInputState>({ up: false, down: false, left: false, right: false });
  const aimRef = useRef<RiftAimState>({ x: RIFT_STAGE_WIDTH / 2, y: 80, manual: false });
  const aimDirectionRef = useRef<RiftInputState>({ up: false, down: false, left: false, right: false });
  const pointerAimRef = useRef(false);
  const firingRef = useRef(false);
  const dashRequestRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const reportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const tapTimeoutsRef = useRef<number[]>([]);

  const gameLabel = formatGameName('rift-runner', gameDefinitions);
  const dashReady = world.player.dashCooldownMs <= 0;
  const statusLabel =
    world.status === 'won'
      ? 'Vault Cracked'
      : world.status === 'lost'
        ? 'Runner Down'
        : world.threatLevel >= 4
          ? 'Rift Overload'
          : `Threat ${world.threatLevel}`;

  const resetGame = useCallback(() => {
    inputRef.current = { up: false, down: false, left: false, right: false };
    aimDirectionRef.current = { up: false, down: false, left: false, right: false };
    aimRef.current = { x: RIFT_STAGE_WIDTH / 2, y: 80, manual: false };
    pointerAimRef.current = false;
    firingRef.current = false;
    dashRequestRef.current = false;
    lastFrameRef.current = null;
    reportedOutcomeRef.current = null;
    setWorld(createInitialRiftRunnerWorld());
  }, []);

  useEffect(() => {
    const stored = Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
    setBestScore(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    if (world.score <= bestScore) return;
    setBestScore(world.score);
    window.localStorage.setItem(BEST_SCORE_KEY, String(world.score));
  }, [bestScore, world.score]);

  useEffect(() => {
    if (world.status === 'playing' || reportedOutcomeRef.current) return;
    const outcome = world.status === 'won' ? 'win' : 'loss';
    reportedOutcomeRef.current = outcome;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'rift-runner',
      outcome,
      opponent: 'Rift Sentinels',
    });
  }, [onMatchComplete, world.status]);

  const setDirection = useCallback((direction: Direction, active: boolean) => {
    inputRef.current[direction] = active;
  }, []);

  const setAimDirection = useCallback((direction: Direction, active: boolean) => {
    aimDirectionRef.current[direction] = active;
  }, []);

  const tapDirection = useCallback(
    (direction: Direction, target: 'move' | 'aim') => {
      const setter = target === 'move' ? setDirection : setAimDirection;
      setter(direction, true);
      const timeoutId = window.setTimeout(() => setter(direction, false), 150);
      tapTimeoutsRef.current.push(timeoutId);
    },
    [setAimDirection, setDirection]
  );

  const queueDash = useCallback(() => {
    if (dashReady && world.status === 'playing') dashRequestRef.current = true;
  }, [dashReady, world.status]);

  const setFiring = useCallback((active: boolean) => {
    firingRef.current = active;
  }, []);

  const updatePointerAim = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerAimRef.current = true;
    aimRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * RIFT_STAGE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * RIFT_STAGE_HEIGHT,
      manual: true,
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent, active: boolean) => {
      const key = event.key.toLowerCase();
      const moveDirection =
        key === 'w'
          ? 'up'
          : key === 's'
            ? 'down'
            : key === 'a'
              ? 'left'
              : key === 'd'
                ? 'right'
                : null;
      const aimDirection =
        key === 'arrowup'
          ? 'up'
          : key === 'arrowdown'
            ? 'down'
            : key === 'arrowleft'
              ? 'left'
              : key === 'arrowright'
                ? 'right'
                : null;

      if (moveDirection) {
        event.preventDefault();
        setDirection(moveDirection, active);
      }
      if (aimDirection) {
        event.preventDefault();
        setAimDirection(aimDirection, active);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        setFiring(active);
      }
      if (active && key === 'shift') {
        event.preventDefault();
        queueDash();
      }
      if (active && key === 'r') resetGame();
    };

    const keyDown = (event: KeyboardEvent) => handleKey(event, true);
    const keyUp = (event: KeyboardEvent) => handleKey(event, false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      tapTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [queueDash, resetGame, setAimDirection, setDirection, setFiring]);

  useEffect(() => {
    const step = (now: number) => {
      setWorld((current) => {
        if (lastFrameRef.current === null) {
          lastFrameRef.current = now;
          return current;
        }

        const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.032);
        lastFrameRef.current = now;
        const aimDirections = aimDirectionRef.current;
        const aimX = Number(aimDirections.right) - Number(aimDirections.left);
        const aimY = Number(aimDirections.down) - Number(aimDirections.up);
        if (aimX !== 0 || aimY !== 0) {
          aimRef.current = {
            x: current.player.x + aimX * 500,
            y: current.player.y + aimY * 500,
            manual: true,
          };
        }

        const next = advanceRiftRunnerWorld(
          current,
          deltaSeconds,
          inputRef.current,
          aimRef.current,
          firingRef.current || aimX !== 0 || aimY !== 0,
          dashRequestRef.current
        );
        dashRequestRef.current = false;
        if (aimX === 0 && aimY === 0 && !pointerAimRef.current) {
          aimRef.current.manual = false;
        }
        if (canvasRef.current) drawWorld(canvasRef.current, next, aimRef.current);
        return next;
      });
      frameRef.current = window.requestAnimationFrame(step);
    };

    if (canvasRef.current) drawWorld(canvasRef.current, world, aimRef.current);
    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const controllerSections = useMemo(
    () => [
      {
        key: 'movement',
        title: 'Move',
        layout: 'dpad' as const,
        buttons: [
          { key: 'move-up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => tapDirection('up', 'move'), onPointerDown: () => setDirection('up', true), onPointerUp: () => setDirection('up', false) },
          { key: 'move-left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => tapDirection('left', 'move'), onPointerDown: () => setDirection('left', true), onPointerUp: () => setDirection('left', false) },
          { key: 'move-down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => tapDirection('down', 'move'), onPointerDown: () => setDirection('down', true), onPointerUp: () => setDirection('down', false) },
          { key: 'move-right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => tapDirection('right', 'move'), onPointerDown: () => setDirection('right', true), onPointerUp: () => setDirection('right', false) },
        ],
      },
      {
        key: 'combat',
        title: 'Combat',
        subtitle: 'Fire auto-locks the nearest sentinel',
        layout: 'row' as const,
        buttons: [
          { key: 'fire', label: 'Fire', icon: <AiOutlineThunderbolt />, onPointerDown: () => setFiring(true), onPointerUp: () => setFiring(false), disabled: world.status !== 'playing' },
          { key: 'dash', label: dashReady ? 'Phase' : `${(world.player.dashCooldownMs / 1000).toFixed(1)}s`, icon: <AiOutlineRocket />, onClick: queueDash, disabled: !dashReady || world.status !== 'playing' },
          { key: 'reset', label: 'New Run', icon: <AiOutlineReload />, onClick: resetGame },
        ],
      },
    ],
    [dashReady, queueDash, resetGame, setDirection, setFiring, tapDirection, world.player.dashCooldownMs, world.status]
  );

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Move, fire, phase, and break the sentinel vault"
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
                <div className="solo-float-stat"><span>Cores</span><strong>{world.collected}/{RIFT_TARGET_CORES}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Kills</span><strong>{world.enemiesDestroyed}</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{formatRiftRunnerTime(world.timeLeftMs)}</strong></div>
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

      <section className="rift-runner-shell rift-runner-shooter-shell">
        <div className="rift-runner-hud">
          <article><span>Core Cache</span><strong>{world.collected}/{RIFT_TARGET_CORES}</strong></article>
          <article><span>Shield</span><strong>{Math.max(0, world.player.integrity)}/5</strong></article>
          <article><span>Threat</span><strong>Tier {world.threatLevel}</strong></article>
          <article><span>Kill Chain</span><strong>x{Math.max(1, world.combo)}</strong></article>
          <article><span>Rift Clock</span><strong>{formatRiftRunnerTime(world.timeLeftMs)}</strong></article>
        </div>

        <div className="rift-runner-stage-wrap">
          <canvas
            ref={canvasRef}
            className="rift-runner-canvas"
            width={RIFT_STAGE_WIDTH}
            height={RIFT_STAGE_HEIGHT}
            aria-label="Rift Runner top-down shooter arena"
            onPointerMove={updatePointerAim}
            onPointerDown={(event) => {
              updatePointerAim(event);
              setFiring(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              setFiring(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => setFiring(false)}
            onPointerLeave={() => {
              setFiring(false);
              pointerAimRef.current = false;
              aimRef.current.manual = false;
            }}
          />
          <div className="rift-runner-stage-overlay">
            <span>Score {world.score}</span>
            <span>Sentinels {world.enemies.length}</span>
            <span>Best chain x{Math.max(1, world.bestCombo)}</span>
          </div>
          {world.status !== 'playing' ? (
            <div className="rift-runner-result">
              <span>{world.status === 'won' ? 'Core cache secured' : 'Heist failed'}</span>
              <h2>{world.status === 'won' ? 'Vault Cracked' : 'Runner Down'}</h2>
              <p>
                {world.status === 'won'
                  ? `${world.enemiesDestroyed} sentinels destroyed. ${world.score} points banked.`
                  : `${world.collected} of ${RIFT_TARGET_CORES} cores recovered before shutdown.`}
              </p>
              <div>
                <button type="button" onClick={resetGame}><AiOutlineReload /> Run Again</button>
                <button type="button" onClick={onLeave}>Leave Arena</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rift-runner-combat-strip">
          <div>
            <span>Weapon</span>
            <strong>Phase Repeater</strong>
          </div>
          <div>
            <span>Dash</span>
            <strong>{dashReady ? 'Ready' : `${(world.player.dashCooldownMs / 1000).toFixed(1)}s`}</strong>
          </div>
          <p>{world.lastEvent}</p>
        </div>

        <p className="rift-runner-hint">
          Move with WASD. Aim with the mouse or arrow keys. Hold Space or press the arena to fire. Shift phase-dashes through danger.
        </p>
      </section>
    </>
  );
}

export default SoloRiftRunnerGame;
