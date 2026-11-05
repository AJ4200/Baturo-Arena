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
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloWellPuttGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Well = { x: number; y: number; strength: number; radius: number };
type Wall = { x: number; y: number; w: number; h: number };
type Hole = {
  name: string;
  tee: { x: number; y: number };
  cup: { x: number; y: number };
  par: number;
  wells: Well[];
  walls: Wall[];
};

type Phase = 'aiming' | 'rolling' | 'sunk' | 'failed' | 'complete';

const W = 960;
const H = 540;
const BALL_R = 8;
const CUP_R = 17;
const MAX_POWER = 760;
const FRICTION = 0.55;
const STOP_SPEED = 12;
const SINK_SPEED = 330;
const STROKE_BUFFER = 3;
const STEP = 1 / 120;
const BEST_KEY = 'baturo_well_putt_best_strokes';

const HOLES: Hole[] = [
  {
    name: 'First Pull',
    tee: { x: 110, y: 270 },
    cup: { x: 850, y: 270 },
    par: 2,
    wells: [{ x: 480, y: 160, strength: 1, radius: 28 }],
    walls: [],
  },
  {
    name: 'Push Away',
    tee: { x: 110, y: 400 },
    cup: { x: 850, y: 140 },
    par: 3,
    wells: [
      { x: 480, y: 270, strength: -1.2, radius: 30 },
      { x: 700, y: 400, strength: 0.9, radius: 24 },
    ],
    walls: [{ x: 300, y: 0, w: 22, h: 260 }],
  },
  {
    name: 'The Gate',
    tee: { x: 110, y: 130 },
    cup: { x: 850, y: 420 },
    par: 3,
    wells: [
      { x: 600, y: 270, strength: 1.6, radius: 30 },
      { x: 330, y: 400, strength: -0.9, radius: 22 },
    ],
    walls: [
      { x: 450, y: 0, w: 22, h: 200 },
      { x: 450, y: 340, w: 22, h: 200 },
    ],
  },
  {
    name: 'Binary Orbit',
    tee: { x: 90, y: 270 },
    cup: { x: 870, y: 270 },
    par: 4,
    wells: [
      { x: 400, y: 190, strength: 1.5, radius: 28 },
      { x: 400, y: 350, strength: -1.5, radius: 28 },
      { x: 680, y: 270, strength: 1.2, radius: 26 },
    ],
    walls: [{ x: 560, y: 120, w: 20, h: 90 }, { x: 560, y: 330, w: 20, h: 90 }],
  },
  {
    name: 'Event Horizon',
    tee: { x: 100, y: 470 },
    cup: { x: 860, y: 90 },
    par: 4,
    wells: [
      { x: 300, y: 330, strength: 1.8, radius: 32 },
      { x: 520, y: 240, strength: -1.6, radius: 28 },
      { x: 700, y: 160, strength: 1.4, radius: 26 },
      { x: 780, y: 380, strength: -1.0, radius: 24 },
    ],
    walls: [{ x: 400, y: 380, w: 20, h: 160 }, { x: 640, y: 0, w: 20, h: 130 }],
  },
];

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
};

const accelAt = (hole: Hole, x: number, y: number) => {
  let ax = 0;
  let ay = 0;
  hole.wells.forEach((well) => {
    const dx = well.x - x;
    const dy = well.y - y;
    const distSq = dx * dx + dy * dy + 900;
    const dist = Math.sqrt(distSq);
    const pull = (well.strength * 520000) / distSq;
    ax += (dx / dist) * pull;
    ay += (dy / dist) * pull;
  });
  return { ax, ay };
};

type Ball = { x: number; y: number; vx: number; vy: number };

const advance = (hole: Hole, ball: Ball, dt: number): 'sunk' | 'well' | null => {
  const { ax, ay } = accelAt(hole, ball.x, ball.y);
  ball.vx += ax * dt;
  ball.vy += ay * dt;
  const damping = Math.exp(-FRICTION * dt);
  ball.vx *= damping;
  ball.vy *= damping;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.8; }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.8; }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * 0.8; }
  if (ball.y > H - BALL_R) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.8; }

  for (const wall of hole.walls) {
    const nearestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
    const nearestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < BALL_R * BALL_R) {
      if (distSq === 0) {
        ball.vx = -ball.vx;
        continue;
      }
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = nearestX + nx * BALL_R;
      ball.y = nearestY + ny * BALL_R;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 1.8 * dot * nx;
        ball.vy -= 1.8 * dot * ny;
      }
    }
  }

  for (const well of hole.wells) {
    if (Math.hypot(ball.x - well.x, ball.y - well.y) < well.radius * 0.45 && well.strength > 0) {
      return 'well';
    }
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  const cupDist = Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y);
  if (cupDist < CUP_R && speed < SINK_SPEED) return 'sunk';
  return null;
};

export function SoloWellPuttGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloWellPuttGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holeIndexRef = useRef(0);
  const ballRef = useRef<Ball>({ x: HOLES[0].tee.x, y: HOLES[0].tee.y, vx: 0, vy: 0 });
  const phaseRef = useRef<Phase>('aiming');
  const aimRef = useRef({ angle: 0, power: 0.55 });
  const strokesRef = useRef(0);
  const totalRef = useRef(0);
  const dragRef = useRef(false);
  const reportedRef = useRef(false);
  const noteRef = useRef('Drag back from the ball and release to shoot.');
  const lastHudRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [hud, setHud] = useState({
    hole: 1,
    name: HOLES[0].name,
    strokes: 0,
    limit: HOLES[0].par + STROKE_BUFFER,
    par: HOLES[0].par,
    total: 0,
    best: 0,
    phase: 'aiming' as Phase,
    power: 55,
    note: noteRef.current,
  });
  const gameLabel = formatGameName('well-putt', gameDefinitions);

  const publish = useCallback(() => {
    const hole = HOLES[holeIndexRef.current];
    setHud((previous) => ({
      hole: holeIndexRef.current + 1,
      name: hole.name,
      strokes: strokesRef.current,
      limit: hole.par + STROKE_BUFFER,
      par: hole.par,
      total: totalRef.current,
      best: previous.best,
      phase: phaseRef.current,
      power: Math.round(aimRef.current.power * 100),
      note: noteRef.current,
    }));
  }, []);

  const loadHole = useCallback((index: number) => {
    const hole = HOLES[index];
    holeIndexRef.current = index;
    ballRef.current = { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0 };
    aimRef.current = {
      angle: Math.atan2(hole.cup.y - hole.tee.y, hole.cup.x - hole.tee.x),
      power: 0.55,
    };
    strokesRef.current = 0;
    phaseRef.current = 'aiming';
    noteRef.current = `Hole ${index + 1}: ${hole.name}. Par ${hole.par}.`;
  }, []);

  const restart = useCallback(() => {
    totalRef.current = 0;
    reportedRef.current = false;
    loadHole(0);
    publish();
  }, [loadHole, publish]);

  const shoot = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;
    const { angle, power } = aimRef.current;
    const speed = MAX_POWER * (0.15 + 0.85 * power);
    ballRef.current.vx = Math.cos(angle) * speed;
    ballRef.current.vy = Math.sin(angle) * speed;
    strokesRef.current += 1;
    phaseRef.current = 'rolling';
    noteRef.current = 'Rolling...';
  }, []);

  const nudge = useCallback((deltaAngle: number, deltaPower: number) => {
    if (phaseRef.current !== 'aiming') return;
    aimRef.current.angle += deltaAngle;
    aimRef.current.power = Math.max(0.05, Math.min(1, aimRef.current.power + deltaPower));
    publish();
  }, [publish]);

  const advanceAfterSink = useCallback(() => {
    if (phaseRef.current !== 'sunk') return;
    if (holeIndexRef.current >= HOLES.length - 1) {
      phaseRef.current = 'complete';
      noteRef.current = `Course cleared in ${totalRef.current} strokes.`;
      const best = readBest();
      if (best === 0 || totalRef.current < best) {
        window.localStorage.setItem(BEST_KEY, String(totalRef.current));
        setHud((value) => ({ ...value, best: totalRef.current }));
      }
      if (!reportedRef.current) {
        reportedRef.current = true;
        onMatchComplete({ mode: 'cpu', gameType: 'well-putt', outcome: 'win', opponent: 'The Course' });
      }
    } else {
      loadHole(holeIndexRef.current + 1);
    }
    publish();
  }, [loadHole, onMatchComplete, publish]);

  const failHole = useCallback((note: string) => {
    phaseRef.current = 'failed';
    noteRef.current = note;
    if (!reportedRef.current) {
      reportedRef.current = true;
      onMatchComplete({ mode: 'cpu', gameType: 'well-putt', outcome: 'loss', opponent: 'The Course' });
    }
  }, [onMatchComplete]);

  useEffect(() => {
    setHud((previous) => ({ ...previous, best: readBest() }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft') { event.preventDefault(); nudge(-0.04, 0); }
      else if (event.code === 'ArrowRight') { event.preventDefault(); nudge(0.04, 0); }
      else if (event.code === 'ArrowUp') { event.preventDefault(); nudge(0, 0.04); }
      else if (event.code === 'ArrowDown') { event.preventDefault(); nudge(0, -0.04); }
      else if (event.code === 'Space') {
        event.preventDefault();
        if (phaseRef.current === 'sunk') advanceAfterSink();
        else shoot();
      } else if (event.code === 'KeyR') restart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advanceAfterSink, nudge, restart, shoot]);

  useEffect(() => {
    let previous = performance.now();
    let accumulator = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const hole = HOLES[holeIndexRef.current];
      const ball = ballRef.current;
      const style = getComputedStyle(document.documentElement);
      const dark = style.getPropertyValue('--match-dark-rgb').trim() || '24, 24, 24';
      const light = style.getPropertyValue('--match-light-rgb').trim() || '255, 255, 255';

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = `rgb(${dark})`;
      context.fillRect(0, 0, W, H);
      context.fillStyle = 'rgba(46, 125, 80, 0.55)';
      context.fillRect(8, 8, W - 16, H - 16);

      hole.wells.forEach((well) => {
        const attract = well.strength > 0;
        const color = attract ? '110, 190, 255' : '255, 120, 110';
        for (let ring = 4; ring >= 1; ring -= 1) {
          context.strokeStyle = `rgba(${color}, ${0.12 + (4 - ring) * 0.05})`;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(well.x, well.y, well.radius + ring * 14 * Math.abs(well.strength), 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = attract ? '#0a1a33' : '#3a0d0d';
        context.strokeStyle = `rgb(${color})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(well.x, well.y, well.radius * 0.7, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });

      context.fillStyle = `rgb(${light})`;
      hole.walls.forEach((wall) => context.fillRect(wall.x, wall.y, wall.w, wall.h));

      context.fillStyle = '#05070a';
      context.beginPath();
      context.arc(hole.cup.x, hole.cup.y, CUP_R, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffd166';
      context.lineWidth = 3;
      context.stroke();

      if (phaseRef.current === 'aiming') {
        const sim: Ball = { x: ball.x, y: ball.y, vx: 0, vy: 0 };
        const { angle, power } = aimRef.current;
        const speed = MAX_POWER * (0.15 + 0.85 * power);
        sim.vx = Math.cos(angle) * speed;
        sim.vy = Math.sin(angle) * speed;
        context.fillStyle = 'rgba(255, 209, 102, 0.85)';
        for (let i = 0; i < 260; i += 1) {
          if (advance(hole, sim, STEP * 2) !== null) break;
          if (i % 6 === 0) {
            context.beginPath();
            context.arc(sim.x, sim.y, 2.4, 0, Math.PI * 2);
            context.fill();
          }
        }
      }

      context.fillStyle = `rgb(${light})`;
      context.strokeStyle = `rgb(${dark})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    };

    const loop = (timestamp: number) => {
      accumulator += Math.min(0.05, (timestamp - previous) / 1000);
      previous = timestamp;

      if (phaseRef.current === 'rolling') {
        const hole = HOLES[holeIndexRef.current];
        const ball = ballRef.current;
        while (accumulator >= STEP && phaseRef.current === 'rolling') {
          accumulator -= STEP;
          const result = advance(hole, ball, STEP);
          if (result === 'sunk') {
            totalRef.current += strokesRef.current;
            phaseRef.current = 'sunk';
            ball.vx = 0;
            ball.vy = 0;
            ball.x = hole.cup.x;
            ball.y = hole.cup.y;
            const diff = strokesRef.current - hole.par;
            noteRef.current = strokesRef.current === 1 ? 'Hole in one!' : diff <= 0 ? `Sunk in ${strokesRef.current} (par ${hole.par}).` : `Sunk in ${strokesRef.current}.`;
          } else if (result === 'well') {
            failHole('Swallowed by a gravity well.');
          } else if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
            ball.vx = 0;
            ball.vy = 0;
            if (strokesRef.current >= hole.par + STROKE_BUFFER) {
              failHole('Out of strokes on this hole.');
            } else {
              phaseRef.current = 'aiming';
              noteRef.current = 'Line up the next shot.';
            }
          }
        }
      } else {
        accumulator = 0;
      }

      draw();
      if (timestamp - lastHudRef.current > 80) {
        lastHudRef.current = timestamp;
        publish();
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };

    frameRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [failHole, publish]);

  const pointerToWorld = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const updateAimFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointerToWorld(event);
    const ball = ballRef.current;
    const dx = ball.x - point.x;
    const dy = ball.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length < 6) return;
    aimRef.current.angle = Math.atan2(dy, dx);
    aimRef.current.power = Math.max(0.05, Math.min(1, length / 220));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current === 'sunk') {
      advanceAfterSink();
      return;
    }
    if (phaseRef.current !== 'aiming') return;
    dragRef.current = true;
    updateAimFromPointer(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) updateAimFromPointer(event);
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    shoot();
  };

  const isEnd = hud.phase === 'failed' || hud.phase === 'complete';

  const controllerSections = [
    {
      key: 'aim',
      title: 'Aim',
      layout: 'dpad' as const,
      buttons: [
        { key: 'power-up', label: 'Power +', icon: <AiOutlineArrowDown style={{ transform: 'rotate(180deg)' }} />, slot: 'up' as const, onClick: () => nudge(0, 0.06) },
        { key: 'left', label: 'Left', icon: <AiOutlineReload style={{ transform: 'scaleX(-1)' }} />, slot: 'left' as const, onClick: () => nudge(-0.06, 0) },
        { key: 'shoot', label: 'Shoot', icon: <AiOutlineThunderbolt />, slot: 'center' as const, onClick: () => (phaseRef.current === 'sunk' ? advanceAfterSink() : shoot()) },
        { key: 'right', label: 'Right', icon: <AiOutlineReload />, slot: 'right' as const, onClick: () => nudge(0.06, 0) },
        { key: 'power-down', label: 'Power -', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => nudge(0, -0.06) },
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
        subtitle="Drag back from the ball, or use arrows and Space"
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
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Course</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> Hole {hud.hole}/{HOLES.length}: {hud.name}</span>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Strokes</span><strong>{hud.strokes}/{hud.limit}</strong></div>
                <div className="solo-float-stat"><span>Par</span><strong>{hud.par}</strong></div>
                <div className="solo-float-stat"><span>Total</span><strong>{hud.total}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{hud.best || '-'}</strong></div>
                <div className="solo-float-stat"><span>Power</span><strong>{hud.power}%</strong></div>
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

      <section className="well-putt-shell">
        <div className="well-putt-hud">
          <div><span>Hole</span><strong>{hud.hole}/{HOLES.length}</strong></div>
          <div><span>Strokes</span><strong>{hud.strokes}/{hud.limit}</strong></div>
          <div><span>Par</span><strong>{hud.par}</strong></div>
          <div><span>Total</span><strong>{hud.total}</strong></div>
        </div>

        <div
          className="well-putt-stage-wrap"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="presentation"
        >
          <canvas ref={canvasRef} className="well-putt-canvas" width={W} height={H} />
          {isEnd && (
            <div className="well-putt-overlay">
              <span>{hud.phase === 'complete' ? 'Course cleared' : 'Out of luck'}</span>
              <p>{hud.note}</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); restart(); }}>
                <AiOutlineReload /> Play again
              </button>
            </div>
          )}
        </div>
        <p className="well-putt-hint">
          {hud.phase === 'sunk' ? `${hud.note} Tap or press Space for the next hole.` : hud.note}
        </p>
      </section>
    </>
  );
}
