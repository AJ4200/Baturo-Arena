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

type SoloDuneDriftGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Status = 'ready' | 'riding' | 'won' | 'crashed';

type Rider = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  airSpin: number;
  grounded: boolean;
  airTime: number;
};

type Puff = { x: number; y: number; vx: number; vy: number; life: number };

type Hud = {
  status: Status;
  distance: number;
  score: number;
  best: number;
  speed: number;
  combo: number;
  flips: number;
  note: string;
};

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1500;
const SLOPE_PULL = 920;
const DRAG = 0.0006;
const MIN_SPEED = 170;
const SPIN_RATE = 6.4;
const TARGET_DISTANCE = 2500;
const PX_PER_METER = 10;
const BEST_KEY = 'baturo_dune_drift_best_score';

const createTerrain = (seed: number) => {
  const phases = [seed * 1.7, seed * 2.9 + 1.3, seed * 4.1 + 2.1];
  return (x: number) =>
    x * 0.13 +
    Math.sin(x / 520 + phases[0]) * 95 +
    Math.sin(x / 230 + phases[1]) * 38 +
    Math.sin(x / 97 + phases[2]) * 11;
};

const normalizeAngle = (value: number) => {
  let next = value % (Math.PI * 2);
  if (next > Math.PI) next -= Math.PI * 2;
  if (next < -Math.PI) next += Math.PI * 2;
  return next;
};

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
};

const createRider = (height: (x: number) => number): Rider => ({
  x: 0,
  y: height(0),
  vx: 260,
  vy: 0,
  angle: 0,
  airSpin: 0,
  grounded: true,
  airTime: 0,
});

export function SoloDuneDriftGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloDuneDriftGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainRef = useRef<(x: number) => number>(createTerrain(1));
  const riderRef = useRef<Rider>(createRider(terrainRef.current));
  const puffsRef = useRef<Puff[]>([]);
  const holdRef = useRef(false);
  const statusRef = useRef<Status>('ready');
  const scoreRef = useRef({ score: 0, combo: 0, flips: 0, spun: 0, note: 'Hold to dive and spin. Release to land.' });
  const reportedRef = useRef(false);
  const lastHudRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [hud, setHud] = useState<Hud>({
    status: 'ready',
    distance: 0,
    score: 0,
    best: 0,
    speed: 0,
    combo: 0,
    flips: 0,
    note: scoreRef.current.note,
  });
  const gameLabel = formatGameName('dune-drift', gameDefinitions);

  const publishHud = useCallback(() => {
    const rider = riderRef.current;
    setHud((previous) => ({
      status: statusRef.current,
      distance: Math.max(0, Math.floor(rider.x / PX_PER_METER)),
      score: Math.floor(scoreRef.current.score),
      best: previous.best,
      speed: Math.round(rider.vx / 10),
      combo: scoreRef.current.combo,
      flips: scoreRef.current.flips,
      note: scoreRef.current.note,
    }));
  }, []);

  const restart = useCallback(() => {
    terrainRef.current = createTerrain(Math.random() * 100);
    riderRef.current = createRider(terrainRef.current);
    puffsRef.current = [];
    scoreRef.current = { score: 0, combo: 0, flips: 0, spun: 0, note: 'Hold to dive and spin. Release to land.' };
    statusRef.current = 'ready';
    reportedRef.current = false;
    holdRef.current = false;
    setHud((previous) => ({ ...previous, best: readBest() }));
    publishHud();
  }, [publishHud]);

  const press = useCallback(() => {
    holdRef.current = true;
    if (statusRef.current === 'ready') {
      statusRef.current = 'riding';
    }
  }, []);

  const release = useCallback(() => {
    holdRef.current = false;
  }, []);

  useEffect(() => {
    setHud((previous) => ({ ...previous, best: readBest() }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        if (!event.repeat) press();
      } else if (event.code === 'KeyR') {
        restart();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
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

    const finish = (status: 'won' | 'crashed', note: string) => {
      statusRef.current = status;
      scoreRef.current.note = note;
      const best = Math.max(readBest(), Math.floor(scoreRef.current.score));
      window.localStorage.setItem(BEST_KEY, String(best));
      setHud((value) => ({ ...value, best }));
      if (!reportedRef.current) {
        reportedRef.current = true;
        onMatchComplete({
          mode: 'cpu',
          gameType: 'dune-drift',
          outcome: status === 'won' ? 'win' : 'loss',
          opponent: 'The Dunes',
        });
      }
    };

    const step = (dt: number) => {
      const rider = riderRef.current;
      const height = terrainRef.current;
      const hold = holdRef.current;
      const slopeAt = (x: number) => (height(x + 2) - height(x - 2)) / 4;

      if (rider.grounded) {
        const slope = slopeAt(rider.x);
        rider.vx += (slope * SLOPE_PULL * (hold ? 1.6 : 1) - DRAG * rider.vx * rider.vx) * dt;
        rider.vx = Math.max(MIN_SPEED, rider.vx);
        const nextX = rider.x + rider.vx * dt;
        const groundY = height(nextX);
        const ballisticY = rider.y + rider.vy * dt + 0.5 * GRAVITY * dt * dt;
        if (groundY - ballisticY > 1.5) {
          rider.x = nextX;
          rider.y = ballisticY;
          rider.vy += GRAVITY * dt;
          rider.grounded = false;
          rider.airTime = 0;
          scoreRef.current.spun = 0;
        } else {
          rider.vy = (groundY - rider.y) / dt;
          rider.x = nextX;
          rider.y = groundY;
          const target = Math.atan(slopeAt(nextX));
          rider.angle += normalizeAngle(target - rider.angle) * Math.min(1, dt * 14);
          scoreRef.current.score += rider.vx * dt * 0.02;
          if (Math.random() < dt * 28) {
            puffsRef.current.push({ x: rider.x, y: rider.y, vx: -rider.vx * 0.15, vy: -30 - Math.random() * 40, life: 0.6 });
          }
        }
      } else {
        rider.airTime += dt;
        rider.vy += GRAVITY * dt;
        rider.x += rider.vx * dt;
        rider.y += rider.vy * dt;
        if (hold) {
          const spin = SPIN_RATE * dt;
          rider.angle = normalizeAngle(rider.angle - spin);
          scoreRef.current.spun += spin;
        }
        const groundY = height(rider.x);
        if (rider.y >= groundY) {
          const slopeAngle = Math.atan(slopeAt(rider.x));
          const diff = Math.abs(normalizeAngle(rider.angle - slopeAngle));
          rider.y = groundY;
          if (diff > 0.95) {
            rider.angle = slopeAngle;
            finish('crashed', 'Wipeout. Land with the board matching the slope.');
            return;
          }
          const flips = Math.floor((scoreRef.current.spun + 1.2) / (Math.PI * 2));
          const perfect = diff < 0.32;
          scoreRef.current.flips += flips;
          scoreRef.current.combo = perfect || flips > 0 ? scoreRef.current.combo + 1 : 0;
          scoreRef.current.score += flips * 120 * Math.max(1, scoreRef.current.combo) + (perfect ? 40 : 0);
          if (perfect) rider.vx += 40 + scoreRef.current.combo * 6;
          scoreRef.current.note = flips > 0
            ? `${flips}x flip landed. Combo x${scoreRef.current.combo}.`
            : perfect
              ? 'Perfect landing. Speed boost.'
              : 'Rough landing.';
          rider.vy = 0;
          rider.grounded = true;
          rider.angle = slopeAngle;
        }
      }

      puffsRef.current = puffsRef.current
        .map((puff) => ({ ...puff, x: puff.x + puff.vx * dt, y: puff.y + puff.vy * dt, life: puff.life - dt }))
        .filter((puff) => puff.life > 0);

      if (rider.x / PX_PER_METER >= TARGET_DISTANCE) {
        finish('won', 'You crossed the Great Dune.');
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const rider = riderRef.current;
      const height = terrainRef.current;
      const camX = rider.x - WIDTH * 0.3;
      const camY = rider.y - HEIGHT * 0.55;
      const progress = Math.min(1, rider.x / PX_PER_METER / TARGET_DISTANCE);
      const dusk = Math.sin(progress * Math.PI);

      const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, `rgb(${Math.round(70 + 120 * (1 - dusk))}, ${Math.round(90 + 60 * (1 - dusk))}, ${Math.round(150 + 40 * (1 - dusk))})`);
      sky.addColorStop(1, `rgb(255, ${Math.round(190 - 70 * dusk)}, ${Math.round(110 + 20 * (1 - dusk))})`);
      context.fillStyle = sky;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.fillStyle = 'rgba(255, 243, 196, 0.92)';
      context.beginPath();
      context.arc(WIDTH * 0.78, 90 + progress * 160, 42, 0, Math.PI * 2);
      context.fill();

      const layers = [
        { factor: 0.12, offset: 0.55, color: 'rgba(120, 60, 90, 0.55)' },
        { factor: 0.25, offset: 0.68, color: 'rgba(170, 80, 70, 0.7)' },
      ];
      layers.forEach((layer, index) => {
        context.fillStyle = layer.color;
        context.beginPath();
        context.moveTo(0, HEIGHT);
        for (let sx = 0; sx <= WIDTH; sx += 16) {
          const wx = sx + camX * layer.factor;
          const wy = HEIGHT * layer.offset + Math.sin(wx / (260 + index * 90)) * 40 + Math.sin(wx / 90) * 8;
          context.lineTo(sx, wy);
        }
        context.lineTo(WIDTH, HEIGHT);
        context.fill();
      });

      context.beginPath();
      context.moveTo(0, HEIGHT);
      for (let sx = 0; sx <= WIDTH; sx += 6) {
        context.lineTo(sx, height(camX + sx) - camY);
      }
      context.lineTo(WIDTH, HEIGHT);
      context.closePath();
      context.fillStyle = '#2b1222';
      context.fill();
      context.strokeStyle = 'rgba(255, 226, 170, 0.9)';
      context.lineWidth = 3;
      context.beginPath();
      for (let sx = 0; sx <= WIDTH; sx += 6) {
        const sy = height(camX + sx) - camY;
        if (sx === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      }
      context.stroke();

      puffsRef.current.forEach((puff) => {
        context.fillStyle = `rgba(255, 226, 170, ${Math.max(0, puff.life)})`;
        context.beginPath();
        context.arc(puff.x - camX, puff.y - camY, 3 + (0.6 - puff.life) * 6, 0, Math.PI * 2);
        context.fill();
      });

      const rx = rider.x - camX;
      const ry = rider.y - camY;
      context.save();
      context.translate(rx, ry);
      context.rotate(rider.angle);
      context.fillStyle = '#ffe9b8';
      context.fillRect(-26, -4, 52, 5);
      context.fillStyle = statusRef.current === 'crashed' ? '#c0392b' : '#1b0f1f';
      context.beginPath();
      context.moveTo(-5, -6);
      context.lineTo(5, -6);
      context.lineTo(2, -34);
      context.lineTo(-3, -34);
      context.closePath();
      context.fill();
      context.beginPath();
      context.arc(0, -40, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#d93a5f';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-2, -34);
      context.quadraticCurveTo(-30, -34 + Math.sin(performance.now() / 120) * 4, -46, -26);
      context.stroke();
      context.restore();
    };

    const loop = (timestamp: number) => {
      const dt = Math.min(0.033, Math.max(0.001, (timestamp - previous) / 1000));
      previous = timestamp;
      if (statusRef.current === 'riding') {
        step(dt);
      }
      draw();
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
  }, [onMatchComplete, publishHud]);

  const statusLabel =
    hud.status === 'won' ? 'Crossed' : hud.status === 'crashed' ? 'Wipeout' : hud.status === 'riding' ? 'Riding' : 'Ready';
  const isOver = hud.status === 'won' || hud.status === 'crashed';

  const controllerSections = [
    {
      key: 'ride',
      title: 'Ride',
      layout: 'row' as const,
      buttons: [
        {
          key: 'spin',
          label: 'Hold: Dive / Spin',
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

      <AdaptiveControllerOverlay sections={controllerSections} title="Dune Drift" subtitle="Hold Space / tap to dive and spin" />

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
                <div className="solo-float-stat"><span>Distance</span><strong>{hud.distance}m</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{hud.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{hud.best}</strong></div>
                <div className="solo-float-stat"><span>Flips</span><strong>{hud.flips}</strong></div>
                <div className="solo-float-stat"><span>Combo</span><strong>x{hud.combo}</strong></div>
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

      <section className="dune-drift-shell">
        <div className="dune-drift-hud">
          <div><span>Distance</span><strong>{hud.distance}m / {TARGET_DISTANCE}m</strong></div>
          <div><span>Score</span><strong>{hud.score}</strong></div>
          <div><span>Speed</span><strong>{hud.speed}</strong></div>
          <div><span>Combo</span><strong>x{hud.combo}</strong></div>
        </div>

        <div
          className="dune-drift-stage-wrap"
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          role="presentation"
        >
          <canvas ref={canvasRef} className="dune-drift-canvas" width={WIDTH} height={HEIGHT} />
          {(hud.status === 'ready' || isOver) && (
            <div className="dune-drift-overlay">
              <span>{hud.status === 'won' ? 'Great Dune crossed' : hud.status === 'crashed' ? 'Wipeout' : 'Dune Drift'}</span>
              <p>{hud.note}</p>
              {isOver ? (
                <button type="button" onClick={(event) => { event.stopPropagation(); restart(); }}>
                  <AiOutlineReload /> Ride again
                </button>
              ) : (
                <small>Tap or hold Space to start</small>
              )}
            </div>
          )}
        </div>
        <p className="dune-drift-hint">{hud.note}</p>
      </section>
    </>
  );
}
