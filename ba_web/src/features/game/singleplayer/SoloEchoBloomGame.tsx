'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { motion } from 'framer-motion';
import { AdaptiveControllerOverlay, type ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type RunStatus = 'ready' | 'playing' | 'won' | 'lost';
type NoteStatus = 'pending' | 'hit' | 'missed';
type Judge = 'Perfect' | 'Great' | 'Good' | 'Miss' | 'Ready';

type BloomNote = {
  id: number;
  lane: number;
  timeMs: number;
  status: NoteStatus;
};

type BloomWorld = {
  status: RunStatus;
  elapsedMs: number;
  score: number;
  combo: number;
  maxCombo: number;
  harmony: number;
  perfect: number;
  great: number;
  good: number;
  misses: number;
  judge: Judge;
  judgeMs: number;
  notes: BloomNote[];
};

type SoloEchoBloomGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const STAGE_WIDTH = 840;
const STAGE_HEIGHT = 600;
const CENTER_X = STAGE_WIDTH / 2;
const CENTER_Y = STAGE_HEIGHT / 2;
const HIT_RADIUS = 76;
const SPAWN_RADIUS = 268;
const APPROACH_MS = 1500;
const SONG_DURATION_MS = 51_000;
const BEAT_MS = 500;
const HIT_WINDOW_MS = 235;
const MISS_WINDOW_MS = 250;
const BEST_SCORE_KEY = 'baturo_echo_bloom_best_score';
const LANE_COLORS = ['#ff6fae', '#66e8ff', '#ffcc59', '#8cff83'];
const LANE_KEYS = ['D', 'F', 'J', 'K'];
const LANE_ANGLES = [Math.PI, -Math.PI / 2, Math.PI / 2, 0];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const buildChart = (): BloomNote[] => {
  const pattern = [0, 1, 3, 2, 0, 2, 3, 1, 0, 3, 1, 2, 3, 0, 2, 1];
  const notes: BloomNote[] = [];
  let id = 1;

  for (let beat = 0; beat < 94; beat += 1) {
    const timeMs = 1800 + beat * BEAT_MS;
    notes.push({
      id,
      lane: pattern[beat % pattern.length],
      timeMs,
      status: 'pending',
    });
    id += 1;

    if (beat >= 16 && beat % 4 === 3) {
      notes.push({
        id,
        lane: pattern[(beat + 5) % pattern.length],
        timeMs: timeMs + BEAT_MS / 2,
        status: 'pending',
      });
      id += 1;
    }
  }

  return notes.sort((left, right) => left.timeMs - right.timeMs);
};

const createWorld = (status: RunStatus = 'ready'): BloomWorld => ({
  status,
  elapsedMs: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  harmony: 72,
  perfect: 0,
  great: 0,
  good: 0,
  misses: 0,
  judge: 'Ready',
  judgeMs: 0,
  notes: buildChart(),
});

const getAccuracy = (world: BloomWorld): number => {
  const judged = world.perfect + world.great + world.good + world.misses;
  if (judged === 0) return 100;
  const weighted = world.perfect + world.great * 0.75 + world.good * 0.45;
  return Math.round((weighted / judged) * 100);
};

const drawPetal = (
  context: CanvasRenderingContext2D,
  angle: number,
  length: number,
  width: number,
  color: string,
  alpha: number
) => {
  context.save();
  context.rotate(angle);
  context.globalAlpha = alpha;
  const gradient = context.createLinearGradient(0, 0, length, 0);
  gradient.addColorStop(0, '#fff8d9');
  gradient.addColorStop(0.22, color);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(8, 0);
  context.bezierCurveTo(length * 0.35, -width, length * 0.82, -width * 0.55, length, 0);
  context.bezierCurveTo(length * 0.82, width * 0.55, length * 0.35, width, 8, 0);
  context.fill();
  context.restore();
};

const readThemeColor = (
  canvas: HTMLCanvasElement,
  property: string,
  fallback: string
): string => {
  const value = window.getComputedStyle(canvas).getPropertyValue(property).trim();
  return value ? `rgb(${value})` : fallback;
};

const drawWorld = (canvas: HTMLCanvasElement, world: BloomWorld) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const time = world.elapsedMs;
  const harmony = world.harmony / 100;
  const beatPhase = (time % BEAT_MS) / BEAT_MS;
  const beatPulse = Math.sin(beatPhase * Math.PI) * 8;
  const themeBase = readThemeColor(canvas, '--match-base-rgb', '#2b1640');
  const themeDeep = readThemeColor(canvas, '--match-deep-rgb', '#101934');
  const themeDark = readThemeColor(canvas, '--match-dark-rgb', '#050713');

  const background = context.createRadialGradient(CENTER_X, CENTER_Y, 20, CENTER_X, CENTER_Y, 470);
  background.addColorStop(0, themeBase);
  background.addColorStop(0.52, themeDeep);
  background.addColorStop(1, themeDark);
  context.fillStyle = background;
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  for (let radius = 120; radius <= 360; radius += 48) {
    context.strokeStyle = radius % 96 === 0 ? '#8be8ff' : '#b98aff';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(CENTER_X, CENTER_Y, radius + Math.sin(time / 1200 + radius) * 3, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  LANE_ANGLES.forEach((angle, lane) => {
    const endX = CENTER_X + Math.cos(angle) * SPAWN_RADIUS;
    const endY = CENTER_Y + Math.sin(angle) * SPAWN_RADIUS;
    const gradient = context.createLinearGradient(CENTER_X, CENTER_Y, endX, endY);
    gradient.addColorStop(0, LANE_COLORS[lane]);
    gradient.addColorStop(1, 'rgba(255,255,255,0.04)');
    context.strokeStyle = gradient;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(
      CENTER_X + Math.cos(angle) * (HIT_RADIUS + 18),
      CENTER_Y + Math.sin(angle) * (HIT_RADIUS + 18)
    );
    context.lineTo(endX, endY);
    context.stroke();

    context.save();
    context.translate(endX, endY);
    context.fillStyle = 'rgba(5, 7, 19, 0.78)';
    context.strokeStyle = LANE_COLORS[lane];
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 24, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#fff';
    context.font = '900 17px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(LANE_KEYS[lane], 0, 1);
    context.restore();
  });

  context.save();
  context.translate(CENTER_X, CENTER_Y);
  context.rotate(time / 9000);
  const petals = 8 + Math.round(harmony * 12);
  for (let index = 0; index < petals; index += 1) {
    const angle = (index / petals) * Math.PI * 2;
    const color = LANE_COLORS[index % LANE_COLORS.length];
    drawPetal(
      context,
      angle,
      56 + harmony * 42 + beatPulse,
      13 + harmony * 8,
      color,
      0.35 + harmony * 0.58
    );
  }
  context.restore();

  context.save();
  context.shadowBlur = 30 + beatPulse;
  context.shadowColor = '#fff4c5';
  context.fillStyle = '#fff4c5';
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, 18 + beatPulse * 0.25, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = 'rgba(255,255,255,0.94)';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(CENTER_X, CENTER_Y, HIT_RADIUS + beatPulse * 0.16, 0, Math.PI * 2);
  context.stroke();

  world.notes.forEach((note) => {
    if (note.status !== 'pending') return;
    const timeUntil = note.timeMs - world.elapsedMs;
    if (timeUntil > APPROACH_MS || timeUntil < -MISS_WINDOW_MS) return;
    const progress = clamp(1 - timeUntil / APPROACH_MS, 0, 1.14);
    const radius = SPAWN_RADIUS - (SPAWN_RADIUS - HIT_RADIUS) * progress;
    const angle = LANE_ANGLES[note.lane];
    const x = CENTER_X + Math.cos(angle) * radius;
    const y = CENTER_Y + Math.sin(angle) * radius;
    const size = 12 + progress * 7;

    context.save();
    context.shadowBlur = 22;
    context.shadowColor = LANE_COLORS[note.lane];
    context.fillStyle = LANE_COLORS[note.lane];
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  });

  if (world.judgeMs > 0) {
    context.save();
    context.globalAlpha = clamp(world.judgeMs / 420, 0.2, 1);
    context.fillStyle =
      world.judge === 'Perfect'
        ? '#fff4a8'
        : world.judge === 'Great'
          ? '#8fffe0'
          : world.judge === 'Good'
            ? '#8ecbff'
            : '#ff778d';
    context.font = '900 34px system-ui';
    context.textAlign = 'center';
    context.fillText(world.judge.toUpperCase(), CENTER_X, CENTER_Y - 118);
    context.restore();
  }
};

const playTone = (
  audioContext: AudioContext | null,
  frequency: number,
  duration: number,
  volume: number
) => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
};

export function SoloEchoBloomGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloEchoBloomGameProps) {
  const [snapshot, setSnapshot] = useState<BloomWorld>(() => createWorld());
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<BloomWorld>(createWorld());
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const lastBeatRef = useRef(-1);
  const reportedStatusRef = useRef<RunStatus | null>(null);
  const mutedRef = useRef(isMusicMuted);
  const syncTimerRef = useRef(0);
  const gameLabel = formatGameName('echo-bloom', gameDefinitions);
  const accuracy = getAccuracy(snapshot);
  const statusLabel =
    snapshot.status === 'ready'
      ? 'Song Ready'
      : snapshot.status === 'won'
        ? 'Full Resonance'
        : snapshot.status === 'lost'
          ? 'Harmony Lost'
          : snapshot.harmony < 30
            ? 'Fading'
            : 'In Bloom';
  const timeLeftSeconds = Math.max(0, Math.ceil((SONG_DURATION_MS - snapshot.elapsedMs) / 1000));

  useEffect(() => {
    mutedRef.current = isMusicMuted;
  }, [isMusicMuted]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0);
    setBestScore(Number.isFinite(stored) ? stored : 0);
  }, []);

  const syncSnapshot = useCallback(() => {
    setSnapshot({
      ...worldRef.current,
      notes: worldRef.current.notes.map((note) => ({ ...note })),
    });
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
  }, []);

  const startGame = useCallback(() => {
    ensureAudio();
    worldRef.current = createWorld('playing');
    lastFrameRef.current = null;
    lastBeatRef.current = -1;
    reportedStatusRef.current = null;
    syncSnapshot();
  }, [ensureAudio, syncSnapshot]);

  const strikeLane = useCallback(
    (lane: number) => {
      const world = worldRef.current;
      if (world.status === 'ready') {
        startGame();
        return;
      }
      if (world.status !== 'playing') return;

      let closest: BloomNote | null = null;
      let closestDelta = Infinity;
      for (const note of world.notes) {
        if (note.status !== 'pending' || note.lane !== lane) continue;
        const delta = Math.abs(note.timeMs - world.elapsedMs);
        if (delta < closestDelta) {
          closest = note;
          closestDelta = delta;
        }
      }

      if (!closest || closestDelta > HIT_WINDOW_MS) {
        world.combo = 0;
        world.harmony = clamp(world.harmony - 3, 0, 100);
        world.judge = 'Miss';
        world.judgeMs = 300;
        if (!mutedRef.current) playTone(audioContextRef.current, 110, 0.09, 0.05);
        syncSnapshot();
        return;
      }

      closest.status = 'hit';
      world.combo += 1;
      world.maxCombo = Math.max(world.maxCombo, world.combo);
      const comboBonus = Math.min(300, world.combo * 6);
      if (closestDelta <= 75) {
        world.perfect += 1;
        world.score += 1000 + comboBonus;
        world.harmony = clamp(world.harmony + 2.4, 0, 100);
        world.judge = 'Perfect';
      } else if (closestDelta <= 145) {
        world.great += 1;
        world.score += 700 + comboBonus;
        world.harmony = clamp(world.harmony + 1.3, 0, 100);
        world.judge = 'Great';
      } else {
        world.good += 1;
        world.score += 400 + comboBonus;
        world.harmony = clamp(world.harmony + 0.4, 0, 100);
        world.judge = 'Good';
      }
      world.judgeMs = 420;
      if (!mutedRef.current) {
        playTone(audioContextRef.current, [261.63, 329.63, 392, 523.25][lane], 0.18, 0.08);
      }
      syncSnapshot();
    },
    [startGame, syncSnapshot]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const lane = ['d', 'f', 'j', 'k'].indexOf(key);
      if (lane >= 0) {
        event.preventDefault();
        strikeLane(lane);
      }
      if ((key === ' ' || key === 'enter') && worldRef.current.status === 'ready') {
        event.preventDefault();
        startGame();
      }
      if (key === 'r' && worldRef.current.status !== 'playing') {
        startGame();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startGame, strikeLane]);

  useEffect(() => {
    let animationFrame = 0;
    const frame = (timestamp: number) => {
      const world = worldRef.current;
      const previous = lastFrameRef.current ?? timestamp;
      const deltaMs = Math.min(40, timestamp - previous);
      lastFrameRef.current = timestamp;

      if (world.status === 'playing') {
        world.elapsedMs += deltaMs;
        world.judgeMs = Math.max(0, world.judgeMs - deltaMs);
        const beat = Math.floor(world.elapsedMs / BEAT_MS);
        if (beat !== lastBeatRef.current) {
          lastBeatRef.current = beat;
          if (!mutedRef.current) {
            playTone(audioContextRef.current, beat % 4 === 0 ? 130.81 : 98, 0.06, beat % 4 === 0 ? 0.04 : 0.018);
          }
        }

        world.notes.forEach((note) => {
          if (note.status === 'pending' && world.elapsedMs - note.timeMs > MISS_WINDOW_MS) {
            note.status = 'missed';
            world.misses += 1;
            world.combo = 0;
            world.harmony = clamp(world.harmony - 8, 0, 100);
            world.judge = 'Miss';
            world.judgeMs = 320;
          }
        });

        if (world.harmony <= 0) {
          world.status = 'lost';
        } else if (world.elapsedMs >= SONG_DURATION_MS) {
          world.status = getAccuracy(world) >= 58 ? 'won' : 'lost';
        }
      }

      const canvas = canvasRef.current;
      if (canvas) drawWorld(canvas, world);
      syncTimerRef.current += deltaMs;
      if (syncTimerRef.current >= 60) {
        syncTimerRef.current = 0;
        syncSnapshot();
      }
      animationFrame = window.requestAnimationFrame(frame);
    };
    animationFrame = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [syncSnapshot]);

  useEffect(() => {
    if (
      (snapshot.status !== 'won' && snapshot.status !== 'lost') ||
      reportedStatusRef.current === snapshot.status
    ) {
      return;
    }
    reportedStatusRef.current = snapshot.status;
    if (snapshot.score > bestScore) {
      setBestScore(snapshot.score);
      window.localStorage.setItem(BEST_SCORE_KEY, String(snapshot.score));
    }
    onMatchComplete({
      mode: 'cpu',
      gameType: 'echo-bloom',
      outcome: snapshot.status === 'won' ? 'win' : 'loss',
      opponent: 'The Bloom',
    });
  }, [bestScore, onMatchComplete, snapshot.score, snapshot.status]);

  useEffect(
    () => () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    },
    []
  );

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'petals',
        title: 'Strike Petals',
        subtitle: 'Press as each pulse touches the center ring',
        layout: 'row',
        buttons: LANE_KEYS.map((label, lane) => ({
          key: `lane-${lane}`,
          label,
          icon:
            lane === 0 ? (
              <AiOutlineArrowLeft />
            ) : lane === 1 ? (
              <AiOutlineArrowUp />
            ) : lane === 2 ? (
              <AiOutlineArrowDown />
            ) : (
              <AiOutlineArrowRight />
            ),
          onClick: () => strikeLane(lane),
        })),
      },
      {
        key: 'system',
        layout: 'row',
        buttons: [
          { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: startGame },
          { key: 'sound', label: isMusicMuted ? 'Unmute' : 'Mute', icon: <AiOutlineSound />, onClick: onToggleMusic },
        ],
      },
    ],
    [isMusicMuted, onToggleMusic, startGame, strikeLane]
  );

  return (
    <>
      <h1 className="game-screen-title">{gameLabel}</h1>
      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Strike D, F, J, and K as each pulse reaches the timing ring"
        sections={controllerSections}
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
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
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
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Status</span><strong>{statusLabel}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{snapshot.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Accuracy</span><strong>{accuracy}%</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{timeLeftSeconds}s</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={startGame}>
                  <AiOutlineReload /> New Run
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleAnimations}>
                  Motion {enableAnimations ? 'On' : 'Off'}
                </button>
                <button
                  className="room-float-action-btn room-float-action-btn-danger"
                  type="button"
                  onClick={onLeave}
                >
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="echo-bloom-shell">
        <header className="echo-bloom-hud">
          <article><span>Score</span><strong>{snapshot.score}</strong></article>
          <article><span>Combo</span><strong>x{snapshot.combo}</strong></article>
          <article><span>Harmony</span><strong>{Math.round(snapshot.harmony)}%</strong></article>
          <article><span>Accuracy</span><strong>{accuracy}%</strong></article>
          <article><span>Best</span><strong>{bestScore}</strong></article>
        </header>

        <div className="echo-bloom-stage">
          <canvas
            ref={canvasRef}
            className="echo-bloom-canvas"
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            aria-label="Echo Bloom radial rhythm stage"
          />
          {snapshot.status === 'ready' ? (
            <div className="echo-bloom-result">
              <span>Radial rhythm ritual</span>
              <h2>Wake The Bloom</h2>
              <p>Strike D, F, J, and K as colored pulses touch the white timing ring.</p>
              <button type="button" onClick={startGame}>Begin Song</button>
            </div>
          ) : null}
          {snapshot.status === 'won' || snapshot.status === 'lost' ? (
            <div className="echo-bloom-result">
              <span>{snapshot.status === 'won' ? 'Bloom awakened' : 'Harmony collapsed'}</span>
              <h2>{snapshot.status === 'won' ? 'Full Resonance' : 'Song Withered'}</h2>
              <p>
                {accuracy}% accuracy, max combo x{snapshot.maxCombo}, {snapshot.perfect} perfect strikes.
              </p>
              <div>
                <button type="button" onClick={startGame}><AiOutlineReload /> Play Again</button>
                <button type="button" onClick={onLeave}>Leave</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="echo-bloom-pads">
          {LANE_KEYS.map((label, lane) => (
            <button
              key={label}
              type="button"
              style={{ '--echo-lane-color': LANE_COLORS[lane] } as React.CSSProperties}
              onPointerDown={() => strikeLane(lane)}
              aria-label={`Strike ${label} petal`}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="echo-bloom-footer">
          <p>{player.name}, follow the pulse inward. Perfect timing opens the flower.</p>
          <div>
            <button type="button" onClick={onToggleMusic}>
              <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={onToggleAnimations}>
              Motion {enableAnimations ? 'On' : 'Off'}
            </button>
            <button type="button" onClick={startGame}><AiOutlineReload /> Restart</button>
            <button type="button" onClick={onLeave}>Exit</button>
          </div>
        </div>
      </section>
    </>
  );
}
