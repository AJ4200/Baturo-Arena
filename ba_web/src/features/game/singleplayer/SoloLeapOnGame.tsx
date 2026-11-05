'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloLeapOnGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  gameType: string;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Status = 'ready' | 'playing' | 'over';
type NodeKind = 'safe' | 'split';
type HazardShape = 'triangle' | 'square' | 'diamond';

type LeapNode = {
  id: number;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  spin: number;
  badAngle: number;
  badSpeed: number;
};

type Hazard = {
  id: number;
  shape: HazardShape;
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
};

type Pilot = {
  nodeId: number;
  angle: number;
  dir: 1 | -1;
  revolved: number;
  turns: number;
  flying: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flightLeft: number;
  charge: number | null;
};

type Hud = {
  status: Status;
  score: number;
  best: number;
  chain: number;
  rotations: number;
  jumps: number;
  zoom: number;
  note: string;
};

const WIDTH = 960;
const HEIGHT = 540;
const ORBIT_GAP = 14;
const CAPTURE_GAP = 20;
const ORBIT_SPEED = 2.6;
const FLIGHT_SPEED = 720;
const MIN_JUMP = 210;
const MAX_JUMP = 640;
const MAX_HOLD_MS = 700;
const COLLAPSE_ROTATIONS = 3.4;
const BASE_ROTATION_POINTS = 10;
const MAX_CHAIN_EXPONENT = 24;
const WIN_SCORE = 5000;
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.05;
const BEST_KEY = 'baturo_leap_on_best_score';

const TAU = Math.PI * 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const normalize = (value: number) => ((value % TAU) + TAU) % TAU;
const angleGap = (a: number, b: number) => {
  const diff = Math.abs(normalize(a) - normalize(b));
  return Math.min(diff, TAU - diff);
};

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
};

const cssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

const createWorld = () => {
  const nodes: LeapNode[] = [
    { id: 0, kind: 'safe', x: 0, y: 0, r: 46, spin: 1, badAngle: 0, badSpeed: 0 },
  ];
  return { nodes, hazards: [] as Hazard[], heading: -0.2, nextId: 1, hazardId: 1 };
};

type World = ReturnType<typeof createWorld>;

const extendWorld = (world: World, currentId: number) => {
  while (world.nodes.length === 0 || world.nodes[world.nodes.length - 1].id < currentId + 7) {
    const last = world.nodes[world.nodes.length - 1];
    world.heading += rand(-0.75, 0.75);
    world.heading = Math.max(-1.35, Math.min(1.35, world.heading));
    const gap = rand(250, MAX_JUMP - 80);
    const r = rand(30, 58);
    const x = last.x + Math.cos(world.heading) * gap;
    const y = last.y + Math.sin(world.heading) * gap;
    const isSplit = world.nextId > 2 && Math.random() < Math.min(0.55, 0.2 + world.nextId * 0.01);
    const node: LeapNode = {
      id: world.nextId,
      kind: isSplit ? 'split' : 'safe',
      x,
      y,
      r: isSplit ? r + 10 : r,
      spin: Math.random() < 0.5 ? 1 : -1,
      badAngle: rand(0, TAU),
      badSpeed: rand(0.5, 1.3) * (Math.random() < 0.5 ? 1 : -1),
    };
    world.nextId += 1;
    world.nodes.push(node);

    if (node.id > 1 && Math.random() < 0.75) {
      const sideways = Math.random() < 0.5 ? 1 : -1;
      const offset = rand(95, 150) * sideways;
      const t = rand(0.35, 0.65);
      const shapes: HazardShape[] = ['triangle', 'square', 'diamond'];
      world.hazards.push({
        id: world.hazardId,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        x: last.x + (x - last.x) * t - Math.sin(world.heading) * offset,
        y: last.y + (y - last.y) * t + Math.cos(world.heading) * offset,
        size: rand(16, 28),
        rotation: rand(0, TAU),
        rotationSpeed: rand(-1.6, 1.6),
      });
      world.hazardId += 1;
    }
  }

  const keepFrom = currentId - 5;
  world.nodes = world.nodes.filter((node) => node.id >= keepFrom);
  const anchor = world.nodes[0];
  world.hazards = world.hazards.filter((hazard) => hazard.x > anchor.x - 600 || hazard.y > anchor.y - 900);
};

const createPilot = (): Pilot => ({
  nodeId: 0,
  angle: 0,
  dir: 1,
  revolved: 0,
  turns: 0,
  flying: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  flightLeft: 0,
  charge: null,
});

const drawHazard = (context: CanvasRenderingContext2D, hazard: Hazard) => {
  context.save();
  context.translate(hazard.x, hazard.y);
  context.rotate(hazard.rotation);
  context.beginPath();
  const s = hazard.size;
  if (hazard.shape === 'triangle') {
    context.moveTo(0, -s * 1.1);
    context.lineTo(s, s * 0.8);
    context.lineTo(-s, s * 0.8);
  } else if (hazard.shape === 'square') {
    context.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7);
  } else {
    context.moveTo(0, -s * 1.2);
    context.lineTo(s * 0.9, 0);
    context.lineTo(0, s * 1.2);
    context.lineTo(-s * 0.9, 0);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
};

export function SoloLeapOnGame({
  player,
  mode,
  gameType,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloLeapOnGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World>(createWorld());
  const pilotRef = useRef<Pilot>(createPilot());
  const statusRef = useRef<Status>('ready');
  const runRef = useRef({
    score: 0,
    chain: 0,
    rotations: 0,
    jumps: 0,
    note: 'Hold Space to charge a longer leap. Release to jump.',
  });
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.9 });
  const reportedRef = useRef(false);
  const lastHudRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const chargeStartRef = useRef<number | null>(null);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [hud, setHud] = useState<Hud>({
    status: 'ready',
    score: 0,
    best: 0,
    chain: 0,
    rotations: 0,
    jumps: 0,
    zoom: 1,
    note: runRef.current.note,
  });
  const gameLabel = formatGameName(gameType as any, gameDefinitions);

  const publishHud = useCallback(() => {
    setHud((previous) => ({
      status: statusRef.current,
      score: Math.floor(runRef.current.score),
      best: previous.best,
      chain: runRef.current.chain,
      rotations: runRef.current.rotations,
      jumps: runRef.current.jumps,
      zoom: cameraRef.current.zoom,
      note: runRef.current.note,
    }));
  }, []);

  const restart = useCallback(() => {
    worldRef.current = createWorld();
    extendWorld(worldRef.current, 0);
    pilotRef.current = createPilot();
    statusRef.current = 'ready';
    runRef.current = {
      score: 0,
      chain: 0,
      rotations: 0,
      jumps: 0,
      note: 'Hold Space to charge a longer leap. Release to jump.',
    };
    cameraRef.current = { x: 0, y: 0, zoom: 0.9 };
    reportedRef.current = false;
    chargeStartRef.current = null;
    setHud((previous) => ({ ...previous, best: readBest() }));
    publishHud();
  }, [publishHud]);

  const press = useCallback(() => {
    if (statusRef.current === 'over') return;
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing';
    }
    if (chargeStartRef.current === null && !pilotRef.current.flying) {
      chargeStartRef.current = performance.now();
    }
  }, []);

  const release = useCallback(() => {
    const started = chargeStartRef.current;
    chargeStartRef.current = null;
    const pilot = pilotRef.current;
    if (started === null || statusRef.current !== 'playing' || pilot.flying) return;

    const held = Math.min(MAX_HOLD_MS, performance.now() - started);
    const distance = MIN_JUMP + (MAX_JUMP - MIN_JUMP) * (held / MAX_HOLD_MS);
    const node = worldRef.current.nodes.find((entry) => entry.id === pilot.nodeId);
    if (!node) return;

    const tangent = pilot.angle + (pilot.dir * Math.PI) / 2;
    pilot.vx = Math.cos(tangent) * FLIGHT_SPEED;
    pilot.vy = Math.sin(tangent) * FLIGHT_SPEED;
    pilot.x = node.x + Math.cos(pilot.angle) * (node.r + ORBIT_GAP);
    pilot.y = node.y + Math.sin(pilot.angle) * (node.r + ORBIT_GAP);
    pilot.flightLeft = distance / FLIGHT_SPEED;
    pilot.flying = true;
    pilot.charge = null;
    if (pilot.turns < 1) {
      runRef.current.chain = 0;
    }
    runRef.current.jumps += 1;
  }, []);

  useEffect(() => {
    setHud((previous) => ({ ...previous, best: readBest() }));
    extendWorld(worldRef.current, 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) press();
      } else if (event.code === 'KeyR') {
        restart();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        release();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [press, release, restart]);

  useEffect(() => {
    let previous = performance.now();

    const finish = (note: string) => {
      statusRef.current = 'over';
      runRef.current.note = note;
      chargeStartRef.current = null;
      const finalScore = Math.floor(runRef.current.score);
      const best = Math.max(readBest(), finalScore);
      window.localStorage.setItem(BEST_KEY, String(best));
      setHud((value) => ({ ...value, best }));
      if (!reportedRef.current) {
        reportedRef.current = true;
        onMatchComplete({
          mode,
          gameType: gameType as any,
          outcome: finalScore >= WIN_SCORE ? 'win' : 'loss',
          opponent: 'The Void',
        });
      }
    };

    const step = (dt: number) => {
      const world = worldRef.current;
      const pilot = pilotRef.current;
      const run = runRef.current;

      world.nodes.forEach((node) => {
        if (node.kind === 'split') node.badAngle = normalize(node.badAngle + node.badSpeed * dt);
      });
      world.hazards.forEach((hazard) => {
        hazard.rotation += hazard.rotationSpeed * dt;
      });

      if (!pilot.flying) {
        const node = world.nodes.find((entry) => entry.id === pilot.nodeId);
        if (!node) return;
        const orbitRadius = node.r + ORBIT_GAP;
        const delta = (ORBIT_SPEED * dt * 140) / orbitRadius;
        pilot.angle = normalize(pilot.angle + pilot.dir * delta);
        pilot.revolved += delta / TAU;
        pilot.x = node.x + Math.cos(pilot.angle) * orbitRadius;
        pilot.y = node.y + Math.sin(pilot.angle) * orbitRadius;

        while (pilot.revolved >= 1) {
          pilot.revolved -= 1;
          run.rotations += 1;
          run.chain += 1;
          const exponent = Math.min(MAX_CHAIN_EXPONENT, run.chain - 1);
          const gained = BASE_ROTATION_POINTS * 2 ** exponent;
          run.score += gained;
          run.note = `Rotation x${run.chain}: +${gained.toLocaleString()}`;
          pilot.turns += 1;
        }

        if (pilot.turns + pilot.revolved >= COLLAPSE_ROTATIONS) {
          finish('The orb collapsed under you. Leap before it breaks.');
          return;
        }

        if (node.kind === 'split' && angleGap(pilot.angle, node.badAngle) <= Math.PI / 2) {
          finish('The dark half swept over you.');
          return;
        }
      } else {
        pilot.x += pilot.vx * dt;
        pilot.y += pilot.vy * dt;
        pilot.flightLeft -= dt;

        const hitHazard = world.hazards.find(
          (hazard) => Math.hypot(hazard.x - pilot.x, hazard.y - pilot.y) < hazard.size * 0.95 + 8
        );
        if (hitHazard) {
          finish(`Hit a ${hitHazard.shape}.`);
          return;
        }

        const target = world.nodes.find(
          (node) =>
            node.id !== pilot.nodeId &&
            Math.hypot(node.x - pilot.x, node.y - pilot.y) <= node.r + CAPTURE_GAP
        );
        if (target) {
          const landingAngle = Math.atan2(pilot.y - target.y, pilot.x - target.x);
          if (target.kind === 'split' && angleGap(landingAngle, target.badAngle) <= Math.PI / 2) {
            finish('You landed on the dark half.');
            return;
          }
          pilot.flying = false;
          pilot.nodeId = target.id;
          pilot.angle = normalize(landingAngle);
          pilot.dir = target.spin === 1 ? 1 : -1;
          pilot.revolved = 0;
          pilot.turns = 0;
          run.score += 25;
          run.note = target.kind === 'split' ? 'Clean landing on the light half.' : 'Landed.';
          extendWorld(world, target.id);
        } else if (pilot.flightLeft <= 0) {
          finish('You drifted into the void.');
          return;
        }
      }
    };

    const updateCamera = (dt: number) => {
      const world = worldRef.current;
      const pilot = pilotRef.current;
      const camera = cameraRef.current;
      const home = world.nodes.find((entry) => entry.id === pilot.nodeId) ?? world.nodes[0];
      const focusX = pilot.flying ? pilot.x : home.x;
      const focusY = pilot.flying ? pilot.y : home.y;

      let far: LeapNode | null = null;
      let farthestDistance = 0;
      for (const node of world.nodes) {
        if (node.id <= home.id) continue;
        const distance = Math.hypot(node.x - home.x, node.y - home.y) - node.r;
        if (distance <= MAX_JUMP + 60 && distance > farthestDistance) {
          far = node;
          farthestDistance = distance;
        }
      }

      let targetX = focusX;
      let targetY = focusY;
      let targetZoom = MAX_ZOOM;
      if (far) {
        targetX = (focusX + far.x) / 2;
        targetY = (focusY + far.y) / 2;
        const spanX = Math.abs(far.x - focusX) + far.r * 2 + 200;
        const spanY = Math.abs(far.y - focusY) + far.r * 2 + 200;
        targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(WIDTH / spanX, HEIGHT / spanY)));
      }
      const ease = Math.min(1, dt * 2.4);
      camera.x += (targetX - camera.x) * ease;
      camera.y += (targetY - camera.y) * ease;
      camera.zoom += (targetZoom - camera.zoom) * ease;
    };

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const world = worldRef.current;
      const pilot = pilotRef.current;
      const camera = cameraRef.current;
      const dark = cssVar('--match-dark-rgb', '24, 24, 24');
      const light = cssVar('--match-light-rgb', '255, 255, 255');
      const deep = cssVar('--match-deep-rgb', '36, 36, 36');

      context.setTransform(1, 0, 0, 1, 0, 0);
      const background = context.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, WIDTH * 0.7);
      background.addColorStop(0, `rgb(${deep})`);
      background.addColorStop(1, `rgb(${dark})`);
      context.fillStyle = background;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.translate(WIDTH / 2, HEIGHT / 2);
      context.scale(camera.zoom, camera.zoom);
      context.translate(-camera.x, -camera.y);

      const home = world.nodes.find((entry) => entry.id === pilot.nodeId);
      const lineWidth = 2 / camera.zoom;

      world.nodes.forEach((node) => {
        const isHome = node.id === pilot.nodeId && !pilot.flying;
        context.lineWidth = lineWidth * 1.5;
        context.strokeStyle = `rgba(${light}, 0.18)`;
        context.beginPath();
        context.arc(node.x, node.y, node.r + ORBIT_GAP, 0, TAU);
        context.stroke();

        context.fillStyle = `rgb(${light})`;
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, TAU);
        context.fill();

        if (node.kind === 'split') {
          context.fillStyle = '#0b0b0f';
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.arc(node.x, node.y, node.r, node.badAngle - Math.PI / 2, node.badAngle + Math.PI / 2);
          context.closePath();
          context.fill();
        }

        context.strokeStyle = isHome ? '#ffd166' : `rgba(${light}, 0.7)`;
        context.lineWidth = lineWidth * (isHome ? 3 : 1.5);
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, TAU);
        context.stroke();
      });

      context.fillStyle = '#e63946';
      context.strokeStyle = '#2b0a0d';
      context.lineWidth = lineWidth * 1.5;
      world.hazards.forEach((hazard) => drawHazard(context, hazard));

      const isCharging = chargeStartRef.current !== null && !pilot.flying && home;
      if (isCharging && home) {
        const held = Math.min(MAX_HOLD_MS, now - (chargeStartRef.current as number));
        const distance = MIN_JUMP + (MAX_JUMP - MIN_JUMP) * (held / MAX_HOLD_MS);
        const tangent = pilot.angle + (pilot.dir * Math.PI) / 2;
        context.strokeStyle = '#ffd166';
        context.lineWidth = lineWidth * 2;
        context.setLineDash([10 / camera.zoom, 8 / camera.zoom]);
        context.beginPath();
        context.moveTo(pilot.x, pilot.y);
        context.lineTo(pilot.x + Math.cos(tangent) * distance, pilot.y + Math.sin(tangent) * distance);
        context.stroke();
        context.setLineDash([]);
      }

      context.fillStyle = statusRef.current === 'over' ? '#e63946' : '#ffd166';
      context.strokeStyle = `rgb(${dark})`;
      context.lineWidth = lineWidth * 2;
      context.beginPath();
      context.arc(pilot.x, pilot.y, 11, 0, TAU);
      context.fill();
      context.stroke();
    };

    const loop = (timestamp: number) => {
      const dt = Math.min(0.033, Math.max(0.001, (timestamp - previous) / 1000));
      previous = timestamp;
      if (statusRef.current === 'playing') {
        step(dt);
      } else if (statusRef.current === 'ready') {
        const world = worldRef.current;
        const pilot = pilotRef.current;
        const node = world.nodes.find((entry) => entry.id === pilot.nodeId);
        if (node) {
          pilot.x = node.x + Math.cos(pilot.angle) * (node.r + ORBIT_GAP);
          pilot.y = node.y + Math.sin(pilot.angle) * (node.r + ORBIT_GAP);
        }
      }
      updateCamera(dt);
      draw(timestamp);
      if (timestamp - lastHudRef.current > 90) {
        lastHudRef.current = timestamp;
        publishHud();
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };

    frameRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [gameType, mode, onMatchComplete, publishHud]);

  const statusLabel = hud.status === 'over' ? 'Run over' : hud.status === 'playing' ? 'Orbiting' : 'Ready';
  const isOver = hud.status === 'over';
  const nextRotationPoints = BASE_ROTATION_POINTS * 2 ** Math.min(MAX_CHAIN_EXPONENT, hud.chain);

  const controllerSections = [
    {
      key: 'leap',
      title: 'Leap',
      layout: 'row' as const,
      buttons: [
        {
          key: 'leap',
          label: 'Hold: Charge Leap',
          icon: <AiOutlineThunderbolt />,
          onPointerDown: press,
          onPointerUp: release,
        },
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: restart },
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
        title={`${gameLabel} Controls`}
        subtitle="Tap to pulse, hold Space to leap farther"
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.3, repeat: Infinity } : undefined}
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
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Run</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> {statusLabel}</span>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{hud.score.toLocaleString()}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{hud.best.toLocaleString()}</strong></div>
                <div className="solo-float-stat"><span>Chain</span><strong>x{hud.chain}</strong></div>
                <div className="solo-float-stat"><span>Rotations</span><strong>{hud.rotations}</strong></div>
                <div className="solo-float-stat"><span>Leaps</span><strong>{hud.jumps}</strong></div>
              </div>
              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={restart}>
                  <AiOutlineReload /> Restart
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="room-float-action-btn room-float-action-btn-danger" type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="leap-on-shell">
        <div className="leap-on-hud">
          <div><span>Score</span><strong>{hud.score.toLocaleString()}</strong></div>
          <div><span>Chain</span><strong>x{hud.chain}</strong></div>
          <div><span>Next Spin</span><strong>+{nextRotationPoints.toLocaleString()}</strong></div>
          <div><span>Zoom</span><strong>{hud.zoom.toFixed(2)}x</strong></div>
        </div>

        <div
          className="leap-on-stage-wrap"
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          role="presentation"
        >
          <canvas ref={canvasRef} className="leap-on-canvas" width={WIDTH} height={HEIGHT} />
          {(hud.status === 'ready' || isOver) && (
            <div className="leap-on-overlay">
              <span>{isOver ? (hud.score >= WIN_SCORE ? 'Run cleared' : 'Run over') : 'Leap'}</span>
              <p>{hud.note}</p>
              {isOver ? (
                <button type="button" onClick={(event) => { event.stopPropagation(); restart(); }}>
                  <AiOutlineReload /> Leap again
                </button>
              ) : (
                <small>Tap or hold Space to start</small>
              )}
            </div>
          )}
        </div>
        <p className="leap-on-hint">{hud.note}</p>
      </section>
    </>
  );
}
