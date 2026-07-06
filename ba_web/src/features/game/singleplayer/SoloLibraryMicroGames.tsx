'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay, type ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloMicroGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type InfoCardProps = {
  title: string;
  playerName: string;
  status: string;
  stats: Array<{ label: string; value: string | number }>;
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onReset: () => void;
  onToggleMusic: () => void;
  onLeave: () => void;
};

function SoloInfoCard({
  title,
  playerName,
  status,
  stats,
  isMusicMuted,
  enableAnimations,
  onReset,
  onToggleMusic,
  onLeave,
}: InfoCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="room-float-drag-root"
      animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
      transition={enableAnimations ? { duration: 4.1, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <div className={`room-float-card solo-room-float-card${isCollapsed ? ' room-float-card-collapsed' : ''}`}>
        {isCollapsed ? (
          <button
            className="room-float-collapsed-center"
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand game info"
            title="Expand game info"
          >
            <AiOutlineInfoCircle />
          </button>
        ) : (
          <>
            <div className="room-float-header">
              <span className="room-float-anchor">
                <AiOutlineDrag /> drag
              </span>
              <span className="room-float-title">
                <AiOutlineInfoCircle className="room-float-title-icon" /> {title} Solo
              </span>
              <button
                className="room-float-toggle-btn"
                type="button"
                onClick={() => setIsCollapsed(true)}
                aria-label="Collapse game info"
                title="Collapse game info"
              >
                <AiOutlineArrowDown />
              </button>
            </div>

            <div className="solo-float-stats">
              <div className="solo-float-stat">
                <span>Player</span>
                <strong>{playerName}</strong>
              </div>
              <div className="solo-float-stat">
                <span>Status</span>
                <strong>{status}</strong>
              </div>
              {stats.map((stat) => (
                <div key={stat.label} className="solo-float-stat">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="solo-float-actions">
              <button className="room-float-action-btn" type="button" onClick={onReset}>
                <AiOutlineReload /> New Run
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
  );
}

type CodeColor = 'ruby' | 'sun' | 'mint' | 'sky' | 'violet' | 'slate';

type CodeAttempt = {
  guess: CodeColor[];
  exact: number;
  near: number;
};

type ColorCodeState = {
  secret: CodeColor[];
  guess: CodeColor[];
  selectedSlot: number;
  attempts: CodeAttempt[];
  phase: 'playing' | 'won' | 'lost';
  message: string;
};

const CODE_COLORS: Array<{ id: CodeColor; label: string; short: string; swatch: string }> = [
  { id: 'ruby', label: 'Ruby', short: 'R', swatch: '#ef4444' },
  { id: 'sun', label: 'Sun', short: 'S', swatch: '#facc15' },
  { id: 'mint', label: 'Mint', short: 'M', swatch: '#2dd4bf' },
  { id: 'sky', label: 'Sky', short: 'K', swatch: '#38bdf8' },
  { id: 'violet', label: 'Violet', short: 'V', swatch: '#a78bfa' },
  { id: 'slate', label: 'Slate', short: 'L', swatch: '#64748b' },
];

const CODE_ATTEMPT_LIMIT = 8;

const createSecretCode = (): CodeColor[] =>
  Array.from({ length: 4 }, () => CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)].id);

const createColorCodeState = (): ColorCodeState => ({
  secret: createSecretCode(),
  guess: ['ruby', 'sun', 'mint', 'sky'],
  selectedSlot: 0,
  attempts: [],
  phase: 'playing',
  message: 'Set four colors, submit the line, and read exact plus near clues.',
});

const scoreCodeGuess = (guess: CodeColor[], secret: CodeColor[]) => {
  let exact = 0;
  const remainingGuess: CodeColor[] = [];
  const remainingSecret: CodeColor[] = [];

  guess.forEach((color, index) => {
    if (secret[index] === color) {
      exact += 1;
      return;
    }
    remainingGuess.push(color);
    remainingSecret.push(secret[index]);
  });

  let near = 0;
  remainingGuess.forEach((color) => {
    const matchIndex = remainingSecret.indexOf(color);
    if (matchIndex >= 0) {
      near += 1;
      remainingSecret.splice(matchIndex, 1);
    }
  });

  return { exact, near };
};

export function SoloColorCodeGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMicroGameProps) {
  const [state, setState] = useState<ColorCodeState>(() => createColorCodeState());
  const reportedPhaseRef = useRef<ColorCodeState['phase'] | null>(null);
  const gameLabel = formatGameName('color-code', gameDefinitions);

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    setState(createColorCodeState());
  }, []);

  const selectSlot = useCallback((slot: number) => {
    setState((current) => ({
      ...current,
      selectedSlot: Math.max(0, Math.min(3, slot)),
    }));
  }, []);

  const setColor = useCallback((color: CodeColor) => {
    setState((current) => {
      if (current.phase !== 'playing') {
        return current;
      }
      const guess = [...current.guess];
      guess[current.selectedSlot] = color;
      return {
        ...current,
        guess,
        selectedSlot: (current.selectedSlot + 1) % 4,
        message: `${CODE_COLORS.find((entry) => entry.id === color)?.label || 'Color'} loaded.`,
      };
    });
  }, []);

  const submitGuess = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'playing') {
        return current;
      }

      const clue = scoreCodeGuess(current.guess, current.secret);
      const attempts = [...current.attempts, { guess: [...current.guess], ...clue }];
      const won = clue.exact === 4;
      const lost = !won && attempts.length >= CODE_ATTEMPT_LIMIT;
      return {
        ...current,
        attempts,
        phase: won ? 'won' : lost ? 'lost' : 'playing',
        selectedSlot: 0,
        message: won
          ? 'Vault opened. The whole code snapped into place.'
          : lost
            ? 'The vault sealed. Start a fresh code and chase the clue pattern.'
            : `${clue.exact} exact, ${clue.near} near. ${CODE_ATTEMPT_LIMIT - attempts.length} tries remain.`,
      };
    });
  }, []);

  useEffect(() => {
    if (state.phase === 'playing' || reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'color-code',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Color Vault',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        selectSlot((state.selectedSlot + 3) % 4);
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        selectSlot((state.selectedSlot + 1) % 4);
        return;
      }
      if (['1', '2', '3', '4', '5', '6'].includes(key)) {
        event.preventDefault();
        setColor(CODE_COLORS[Number.parseInt(key, 10) - 1].id);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submitGuess();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame, selectSlot, setColor, state.selectedSlot, submitGuess]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'slots',
        title: 'Slots',
        layout: 'row',
        buttons: state.guess.map((color, index) => ({
          key: `slot-${index}`,
          label: `Slot ${index + 1}`,
          icon: <span className={`micro-color-dot micro-color-${color}`} />,
          onClick: () => selectSlot(index),
          disabled: state.phase !== 'playing',
        })),
      },
      {
        key: 'colors',
        title: 'Colors',
        layout: 'row',
        buttons: CODE_COLORS.map((color) => ({
          key: color.id,
          label: color.label,
          icon: <span className={`micro-color-dot micro-color-${color.id}`} />,
          onClick: () => setColor(color.id),
          disabled: state.phase !== 'playing',
        })),
      },
      {
        key: 'actions',
        title: 'Vault',
        layout: 'row',
        buttons: [
          {
            key: 'submit',
            label: 'Submit',
            icon: <AiOutlineCheckCircle />,
            onClick: submitGuess,
            disabled: state.phase !== 'playing',
          },
          {
            key: 'reset',
            label: 'Reset',
            icon: <AiOutlineReload />,
            onClick: resetGame,
          },
        ],
      },
    ],
    [resetGame, selectSlot, setColor, state.guess, state.phase, submitGuess]
  );

  const statusLabel = state.phase === 'won' ? 'Code Broken' : state.phase === 'lost' ? 'Vault Sealed' : 'Decoding';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Pick slot colors, submit a line, and use exact/near clues"
        sections={controllerSections}
      />

      <SoloInfoCard
        title={gameLabel}
        playerName={player.name}
        status={statusLabel}
        stats={[
          { label: 'Tries', value: `${state.attempts.length}/${CODE_ATTEMPT_LIMIT}` },
          { label: 'Slot', value: state.selectedSlot + 1 },
          { label: 'Best Clue', value: state.attempts.length > 0 ? `${Math.max(...state.attempts.map((attempt) => attempt.exact))} exact` : 'None' },
          { label: 'Mode', value: 'Solo' },
        ]}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onReset={resetGame}
        onToggleMusic={onToggleMusic}
        onLeave={onLeave}
      />

      <section className="micro-game-shell color-code-shell">
        <div className="micro-game-hud">
          <article>
            <span>Attempts</span>
            <strong>{state.attempts.length}/{CODE_ATTEMPT_LIMIT}</strong>
          </article>
          <article>
            <span>Status</span>
            <strong>{statusLabel}</strong>
          </article>
          <article>
            <span>Selected</span>
            <strong>Slot {state.selectedSlot + 1}</strong>
          </article>
        </div>

        <div className="color-code-vault" aria-label="Current color code guess">
          {state.guess.map((color, index) => (
            <button
              key={`${color}-${index}`}
              type="button"
              className={classnames('color-code-slot', index === state.selectedSlot && 'color-code-slot-selected')}
              onClick={() => selectSlot(index)}
              disabled={state.phase !== 'playing'}
            >
              <span className={`micro-color-orb micro-color-${color}`} />
              <small>{index + 1}</small>
            </button>
          ))}
        </div>

        <div className="color-code-palette">
          {CODE_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              style={{ '--micro-swatch': color.swatch } as React.CSSProperties}
              onClick={() => setColor(color.id)}
              disabled={state.phase !== 'playing'}
            >
              <span className={`micro-color-dot micro-color-${color.id}`} />
              {color.label}
            </button>
          ))}
        </div>

        <div className="color-code-history" aria-label="Color code attempt history">
          {Array.from({ length: CODE_ATTEMPT_LIMIT }).map((_, index) => {
            const attempt = state.attempts[index];
            return (
              <div key={index} className={classnames('color-code-attempt', attempt && 'color-code-attempt-filled')}>
                <span className="color-code-attempt-number">{index + 1}</span>
                <div className="color-code-attempt-guess">
                  {(attempt?.guess || []).map((color, colorIndex) => (
                    <span key={`${color}-${colorIndex}`} className={`micro-color-dot micro-color-${color}`} />
                  ))}
                </div>
                <strong>{attempt ? `${attempt.exact} exact / ${attempt.near} near` : 'Waiting'}</strong>
              </div>
            );
          })}
        </div>

        <p className="micro-game-event">{state.message}</p>

        {state.phase !== 'playing' ? (
          <div className="micro-game-result">
            <strong>{state.phase === 'won' ? 'Vault Opened' : 'Vault Sealed'}</strong>
            <span>
              Secret: {state.secret.map((color) => CODE_COLORS.find((entry) => entry.id === color)?.short).join(' ')}
            </span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> New Code
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

type TowerLightsState = {
  lights: boolean[];
  selectedCell: number;
  moves: number;
  phase: 'playing' | 'won' | 'lost';
  message: string;
};

const TOWER_SIZE = 5;
const TOWER_MOVE_LIMIT = 34;
const TOWER_SEED_TOGGLES = [0, 2, 6, 9, 12, 18, 21, 24];

const toggleLightsAt = (lights: boolean[], index: number): boolean[] => {
  const next = [...lights];
  const row = Math.floor(index / TOWER_SIZE);
  const column = index % TOWER_SIZE;
  const targets = [
    [row, column],
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];

  targets.forEach(([targetRow, targetColumn]) => {
    if (targetRow < 0 || targetRow >= TOWER_SIZE || targetColumn < 0 || targetColumn >= TOWER_SIZE) {
      return;
    }
    const targetIndex = targetRow * TOWER_SIZE + targetColumn;
    next[targetIndex] = !next[targetIndex];
  });

  return next;
};

const createTowerLightsState = (): TowerLightsState => ({
  lights: TOWER_SEED_TOGGLES.reduce((lights, index) => toggleLightsAt(lights, index), Array(TOWER_SIZE * TOWER_SIZE).fill(false)),
  selectedCell: 12,
  moves: 0,
  phase: 'playing',
  message: 'Turn every tower panel dark. Each move flips a cross shape.',
});

export function SoloTowerLightsGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMicroGameProps) {
  const [state, setState] = useState<TowerLightsState>(() => createTowerLightsState());
  const reportedPhaseRef = useRef<TowerLightsState['phase'] | null>(null);
  const gameLabel = formatGameName('tower-lights', gameDefinitions);
  const litCount = state.lights.filter(Boolean).length;

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    setState(createTowerLightsState());
  }, []);

  const moveSelection = useCallback((rowDelta: number, columnDelta: number) => {
    setState((current) => {
      const row = Math.floor(current.selectedCell / TOWER_SIZE);
      const column = current.selectedCell % TOWER_SIZE;
      const nextRow = Math.max(0, Math.min(TOWER_SIZE - 1, row + rowDelta));
      const nextColumn = Math.max(0, Math.min(TOWER_SIZE - 1, column + columnDelta));
      return { ...current, selectedCell: nextRow * TOWER_SIZE + nextColumn };
    });
  }, []);

  const toggleCell = useCallback((cellIndex = state.selectedCell) => {
    setState((current) => {
      if (current.phase !== 'playing') {
        return current;
      }

      const lights = toggleLightsAt(current.lights, cellIndex);
      const moves = current.moves + 1;
      const remaining = lights.filter(Boolean).length;
      const won = remaining === 0;
      const lost = !won && moves >= TOWER_MOVE_LIMIT;

      return {
        ...current,
        lights,
        selectedCell: cellIndex,
        moves,
        phase: won ? 'won' : lost ? 'lost' : 'playing',
        message: won
          ? 'All panels are dark. Tower sequence cleared.'
          : lost
            ? 'The tower locked before the lights went dark.'
            : `${remaining} panels still lit. ${TOWER_MOVE_LIMIT - moves} moves remain.`,
      };
    });
  }, [state.selectedCell]);

  useEffect(() => {
    if (state.phase === 'playing' || reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'tower-lights',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Light Tower',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        moveSelection(-1, 0);
        return;
      }
      if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        moveSelection(1, 0);
        return;
      }
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        moveSelection(0, -1);
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        moveSelection(0, 1);
        return;
      }
      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          toggleCell();
        }
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection, resetGame, toggleCell]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'move',
        title: 'Tower Cursor',
        layout: 'dpad',
        buttons: [
          { key: 'up', label: 'Up', slot: 'up', icon: <AiOutlineArrowUp />, onClick: () => moveSelection(-1, 0), disabled: state.phase !== 'playing' },
          { key: 'left', label: 'Left', slot: 'left', icon: <AiOutlineArrowLeft />, onClick: () => moveSelection(0, -1), disabled: state.phase !== 'playing' },
          { key: 'toggle', label: 'Toggle', slot: 'center', icon: <AiOutlineThunderbolt />, onClick: () => toggleCell(), disabled: state.phase !== 'playing' },
          { key: 'right', label: 'Right', slot: 'right', icon: <AiOutlineArrowRight />, onClick: () => moveSelection(0, 1), disabled: state.phase !== 'playing' },
          { key: 'down', label: 'Down', slot: 'down', icon: <AiOutlineArrowDown />, onClick: () => moveSelection(1, 0), disabled: state.phase !== 'playing' },
        ],
      },
      {
        key: 'actions',
        title: 'Run',
        layout: 'row',
        buttons: [{ key: 'reset', label: 'Reset', icon: <AiOutlineReload />, onClick: resetGame }],
      },
    ],
    [moveSelection, resetGame, state.phase, toggleCell]
  );

  const statusLabel = state.phase === 'won' ? 'Tower Clear' : state.phase === 'lost' ? 'Tower Locked' : 'Solving';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Move the cursor and toggle cross-linked lights"
        sections={controllerSections}
      />

      <SoloInfoCard
        title={gameLabel}
        playerName={player.name}
        status={statusLabel}
        stats={[
          { label: 'Lit', value: litCount },
          { label: 'Moves', value: `${state.moves}/${TOWER_MOVE_LIMIT}` },
          { label: 'Cursor', value: `${Math.floor(state.selectedCell / TOWER_SIZE) + 1},${(state.selectedCell % TOWER_SIZE) + 1}` },
          { label: 'Mode', value: 'Solo' },
        ]}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onReset={resetGame}
        onToggleMusic={onToggleMusic}
        onLeave={onLeave}
      />

      <section className="micro-game-shell tower-lights-shell">
        <div className="micro-game-hud">
          <article>
            <span>Lit Panels</span>
            <strong>{litCount}</strong>
          </article>
          <article>
            <span>Moves</span>
            <strong>{state.moves}/{TOWER_MOVE_LIMIT}</strong>
          </article>
          <article>
            <span>Status</span>
            <strong>{statusLabel}</strong>
          </article>
        </div>

        <div className="tower-lights-board" aria-label="Tower lights grid">
          {state.lights.map((isLit, index) => (
            <button
              key={index}
              type="button"
              className={classnames(
                'tower-lights-cell',
                isLit && 'tower-lights-cell-lit',
                index === state.selectedCell && 'tower-lights-cell-selected'
              )}
              onClick={() => toggleCell(index)}
              disabled={state.phase !== 'playing'}
              aria-label={`Panel ${index + 1} ${isLit ? 'lit' : 'dark'}`}
            >
              <span />
            </button>
          ))}
        </div>

        <p className="micro-game-event">{state.message}</p>

        {state.phase !== 'playing' ? (
          <div className="micro-game-result">
            <strong>{state.phase === 'won' ? 'Tower Cleared' : 'Tower Locked'}</strong>
            <span>{state.phase === 'won' ? `${state.moves} moves. Clean shutdown.` : 'Reset the grid and try a tighter route.'}</span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> New Tower
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

type GlyphChainState = {
  sequence: number[];
  activeGlyph: number | null;
  inputIndex: number;
  level: number;
  phase: 'watching' | 'playing' | 'won' | 'lost';
  message: string;
};

const GLYPH_TARGET_LEVEL = 8;
const GLYPHS = [
  { label: 'North', short: 'N', className: 'glyph-chain-pad-north' },
  { label: 'East', short: 'E', className: 'glyph-chain-pad-east' },
  { label: 'South', short: 'S', className: 'glyph-chain-pad-south' },
  { label: 'West', short: 'W', className: 'glyph-chain-pad-west' },
];

const randomGlyph = () => Math.floor(Math.random() * GLYPHS.length);

const createGlyphChainState = (): GlyphChainState => ({
  sequence: [randomGlyph()],
  activeGlyph: null,
  inputIndex: 0,
  level: 1,
  phase: 'watching',
  message: 'Watch the glyph pulse, then repeat it back.',
});

export function SoloGlyphChainGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMicroGameProps) {
  const [state, setState] = useState<GlyphChainState>(() => createGlyphChainState());
  const reportedPhaseRef = useRef<GlyphChainState['phase'] | null>(null);
  const gameLabel = formatGameName('glyph-chain', gameDefinitions);

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    setState(createGlyphChainState());
  }, []);

  const pressGlyph = useCallback((glyphIndex: number) => {
    setState((current) => {
      if (current.phase !== 'playing') {
        return current;
      }

      const expected = current.sequence[current.inputIndex];
      if (glyphIndex !== expected) {
        return {
          ...current,
          activeGlyph: glyphIndex,
          phase: 'lost',
          message: `Chain broke on ${GLYPHS[glyphIndex].label}.`,
        };
      }

      const completedLevel = current.inputIndex >= current.sequence.length - 1;
      if (!completedLevel) {
        return {
          ...current,
          activeGlyph: glyphIndex,
          inputIndex: current.inputIndex + 1,
          message: `${current.inputIndex + 1}/${current.sequence.length} glyphs locked.`,
        };
      }

      if (current.level >= GLYPH_TARGET_LEVEL) {
        return {
          ...current,
          activeGlyph: glyphIndex,
          phase: 'won',
          message: 'Full glyph chain held. Perfect recall.',
        };
      }

      return {
        ...current,
        sequence: [...current.sequence, randomGlyph()],
        activeGlyph: glyphIndex,
        inputIndex: 0,
        level: current.level + 1,
        phase: 'watching',
        message: `Level ${current.level + 1}. Watch the next chain.`,
      };
    });
  }, []);

  useEffect(() => {
    if (state.phase !== 'watching') {
      return;
    }

    const timers: number[] = [];
    setState((current) => ({
      ...current,
      activeGlyph: null,
      message: `Watch level ${current.level}.`,
    }));

    state.sequence.forEach((glyph, index) => {
      timers.push(window.setTimeout(() => {
        setState((current) => ({ ...current, activeGlyph: glyph }));
      }, 420 + index * 640));
      timers.push(window.setTimeout(() => {
        setState((current) => ({ ...current, activeGlyph: null }));
      }, 760 + index * 640));
    });

    timers.push(window.setTimeout(() => {
      setState((current) =>
        current.phase === 'watching'
          ? {
              ...current,
              activeGlyph: null,
              phase: 'playing',
              inputIndex: 0,
              message: `Repeat ${current.sequence.length} glyph${current.sequence.length === 1 ? '' : 's'}.`,
            }
          : current
      );
    }, 980 + state.sequence.length * 640));

    return () => timers.forEach((timerId) => window.clearTimeout(timerId));
  }, [state.level, state.phase, state.sequence]);

  useEffect(() => {
    if ((state.phase !== 'won' && state.phase !== 'lost') || reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'glyph-chain',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Glyph Chorus',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['1', '2', '3', '4'].includes(key)) {
        event.preventDefault();
        pressGlyph(Number.parseInt(key, 10) - 1);
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pressGlyph, resetGame]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'glyphs',
        title: 'Glyph Pads',
        layout: 'row',
        buttons: GLYPHS.map((glyph, index) => ({
          key: glyph.label,
          label: glyph.label,
          icon: <span className={`glyph-chain-controller-dot ${glyph.className}`} />,
          onClick: () => pressGlyph(index),
          disabled: state.phase !== 'playing',
        })),
      },
      {
        key: 'run',
        title: 'Run',
        layout: 'row',
        buttons: [{ key: 'reset', label: 'Reset', icon: <AiOutlineReload />, onClick: resetGame }],
      },
    ],
    [pressGlyph, resetGame, state.phase]
  );

  const statusLabel =
    state.phase === 'won'
      ? 'Chain Held'
      : state.phase === 'lost'
        ? 'Chain Broken'
        : state.phase === 'watching'
          ? 'Watching'
          : 'Repeating';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Watch the sequence, then repeat the glyph chain"
        sections={controllerSections}
      />

      <SoloInfoCard
        title={gameLabel}
        playerName={player.name}
        status={statusLabel}
        stats={[
          { label: 'Level', value: `${state.level}/${GLYPH_TARGET_LEVEL}` },
          { label: 'Length', value: state.sequence.length },
          { label: 'Input', value: `${state.inputIndex}/${state.sequence.length}` },
          { label: 'Mode', value: 'Solo' },
        ]}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onReset={resetGame}
        onToggleMusic={onToggleMusic}
        onLeave={onLeave}
      />

      <section className="micro-game-shell glyph-chain-shell">
        <div className="micro-game-hud">
          <article>
            <span>Level</span>
            <strong>{state.level}/{GLYPH_TARGET_LEVEL}</strong>
          </article>
          <article>
            <span>Phase</span>
            <strong>{statusLabel}</strong>
          </article>
          <article>
            <span>Chain</span>
            <strong>{state.sequence.length}</strong>
          </article>
        </div>

        <div className="glyph-chain-board" aria-label="Glyph chain pads">
          {GLYPHS.map((glyph, index) => (
            <button
              key={glyph.label}
              type="button"
              className={classnames(
                'glyph-chain-pad',
                glyph.className,
                state.activeGlyph === index && 'glyph-chain-pad-active'
              )}
              onClick={() => pressGlyph(index)}
              disabled={state.phase !== 'playing'}
            >
              <strong>{glyph.short}</strong>
              <span>{glyph.label}</span>
            </button>
          ))}
        </div>

        <p className="micro-game-event">{state.message}</p>

        {state.phase === 'won' || state.phase === 'lost' ? (
          <div className="micro-game-result">
            <strong>{state.phase === 'won' ? 'Chain Completed' : 'Chain Broken'}</strong>
            <span>{state.phase === 'won' ? `Level ${GLYPH_TARGET_LEVEL} cleared.` : 'Reset and listen for the pattern again.'}</span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> New Chain
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

type NumberTrailState = {
  numbers: number[];
  found: boolean[];
  selectedCell: number;
  nextNumber: number;
  mistakes: number;
  phase: 'playing' | 'won' | 'lost';
  message: string;
};

const NUMBER_TRAIL_SIZE = 4;
const NUMBER_TRAIL_LIMIT = 16;
const NUMBER_TRAIL_MAX_MISTAKES = 4;

const shuffleNumbers = () => {
  const numbers = Array.from({ length: NUMBER_TRAIL_LIMIT }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [numbers[index], numbers[randomIndex]] = [numbers[randomIndex], numbers[index]];
  }
  return numbers;
};

const createNumberTrailState = (): NumberTrailState => ({
  numbers: shuffleNumbers(),
  found: Array(NUMBER_TRAIL_LIMIT).fill(false),
  selectedCell: 0,
  nextNumber: 1,
  mistakes: 0,
  phase: 'playing',
  message: 'Find 1, then keep climbing the trail.',
});

export function SoloNumberTrailGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMicroGameProps) {
  const [state, setState] = useState<NumberTrailState>(() => createNumberTrailState());
  const reportedPhaseRef = useRef<NumberTrailState['phase'] | null>(null);
  const gameLabel = formatGameName('number-trail', gameDefinitions);

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    setState(createNumberTrailState());
  }, []);

  const moveSelection = useCallback((rowDelta: number, columnDelta: number) => {
    setState((current) => {
      const row = Math.floor(current.selectedCell / NUMBER_TRAIL_SIZE);
      const column = current.selectedCell % NUMBER_TRAIL_SIZE;
      const nextRow = Math.max(0, Math.min(NUMBER_TRAIL_SIZE - 1, row + rowDelta));
      const nextColumn = Math.max(0, Math.min(NUMBER_TRAIL_SIZE - 1, column + columnDelta));
      return { ...current, selectedCell: nextRow * NUMBER_TRAIL_SIZE + nextColumn };
    });
  }, []);

  const chooseCell = useCallback((cellIndex = state.selectedCell) => {
    setState((current) => {
      if (current.phase !== 'playing' || current.found[cellIndex]) {
        return current;
      }

      const value = current.numbers[cellIndex];
      if (value !== current.nextNumber) {
        const mistakes = current.mistakes + 1;
        return {
          ...current,
          selectedCell: cellIndex,
          mistakes,
          phase: mistakes >= NUMBER_TRAIL_MAX_MISTAKES ? 'lost' : 'playing',
          message: mistakes >= NUMBER_TRAIL_MAX_MISTAKES
            ? 'Too many broken steps. The trail dissolved.'
            : `${value} is not next. Find ${current.nextNumber}.`,
        };
      }

      const found = [...current.found];
      found[cellIndex] = true;
      const nextNumber = current.nextNumber + 1;
      const won = nextNumber > NUMBER_TRAIL_LIMIT;
      return {
        ...current,
        found,
        selectedCell: cellIndex,
        nextNumber,
        phase: won ? 'won' : 'playing',
        message: won ? 'Full trail cleared in order.' : `${value} locked. Find ${nextNumber}.`,
      };
    });
  }, [state.selectedCell]);

  useEffect(() => {
    if ((state.phase !== 'won' && state.phase !== 'lost') || reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'number-trail',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Number Trail',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        moveSelection(-1, 0);
        return;
      }
      if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        moveSelection(1, 0);
        return;
      }
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        moveSelection(0, -1);
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        moveSelection(0, 1);
        return;
      }
      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          chooseCell();
        }
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chooseCell, moveSelection, resetGame]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'trail',
        title: 'Trail Cursor',
        layout: 'dpad',
        buttons: [
          { key: 'up', label: 'Up', slot: 'up', icon: <AiOutlineArrowUp />, onClick: () => moveSelection(-1, 0), disabled: state.phase !== 'playing' },
          { key: 'left', label: 'Left', slot: 'left', icon: <AiOutlineArrowLeft />, onClick: () => moveSelection(0, -1), disabled: state.phase !== 'playing' },
          { key: 'pick', label: 'Pick', slot: 'center', icon: <AiOutlineCheckCircle />, onClick: () => chooseCell(), disabled: state.phase !== 'playing' },
          { key: 'right', label: 'Right', slot: 'right', icon: <AiOutlineArrowRight />, onClick: () => moveSelection(0, 1), disabled: state.phase !== 'playing' },
          { key: 'down', label: 'Down', slot: 'down', icon: <AiOutlineArrowDown />, onClick: () => moveSelection(1, 0), disabled: state.phase !== 'playing' },
        ],
      },
      {
        key: 'run',
        title: 'Run',
        layout: 'row',
        buttons: [{ key: 'reset', label: 'Reset', icon: <AiOutlineReload />, onClick: resetGame }],
      },
    ],
    [chooseCell, moveSelection, resetGame, state.phase]
  );

  const statusLabel = state.phase === 'won' ? 'Trail Cleared' : state.phase === 'lost' ? 'Trail Lost' : 'Searching';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Pick numbers in order from 1 to 16"
        sections={controllerSections}
      />

      <SoloInfoCard
        title={gameLabel}
        playerName={player.name}
        status={statusLabel}
        stats={[
          { label: 'Next', value: state.nextNumber > NUMBER_TRAIL_LIMIT ? '-' : state.nextNumber },
          { label: 'Found', value: state.found.filter(Boolean).length },
          { label: 'Mistakes', value: `${state.mistakes}/${NUMBER_TRAIL_MAX_MISTAKES}` },
          { label: 'Mode', value: 'Solo' },
        ]}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onReset={resetGame}
        onToggleMusic={onToggleMusic}
        onLeave={onLeave}
      />

      <section className="micro-game-shell number-trail-shell">
        <div className="micro-game-hud">
          <article>
            <span>Next</span>
            <strong>{state.nextNumber > NUMBER_TRAIL_LIMIT ? '-' : state.nextNumber}</strong>
          </article>
          <article>
            <span>Found</span>
            <strong>{state.found.filter(Boolean).length}/{NUMBER_TRAIL_LIMIT}</strong>
          </article>
          <article>
            <span>Mistakes</span>
            <strong>{state.mistakes}/{NUMBER_TRAIL_MAX_MISTAKES}</strong>
          </article>
        </div>

        <div className="number-trail-board" aria-label="Number trail grid">
          {state.numbers.map((number, index) => (
            <button
              key={`${number}-${index}`}
              type="button"
              className={classnames(
                'number-trail-cell',
                state.found[index] && 'number-trail-cell-found',
                state.selectedCell === index && 'number-trail-cell-selected'
              )}
              onClick={() => chooseCell(index)}
              disabled={state.phase !== 'playing' || state.found[index]}
            >
              {number}
            </button>
          ))}
        </div>

        <p className="micro-game-event">{state.message}</p>

        {state.phase !== 'playing' ? (
          <div className="micro-game-result">
            <strong>{state.phase === 'won' ? 'Trail Cleared' : 'Trail Dissolved'}</strong>
            <span>{state.phase === 'won' ? `${state.mistakes} mistakes. Good eyes.` : 'Reset and rebuild the path from 1.'}</span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> New Trail
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

type TimingRingState = {
  angle: number;
  targetStart: number;
  targetSize: number;
  score: number;
  streak: number;
  attempts: number;
  phase: 'playing' | 'won' | 'lost';
  message: string;
};

const TIMING_RING_TARGET_SCORE = 8;
const TIMING_RING_MAX_ATTEMPTS = 12;

const createTimingTarget = () => ({
  targetStart: Math.floor(Math.random() * 360),
  targetSize: 42 + Math.floor(Math.random() * 32),
});

const createTimingRingState = (): TimingRingState => ({
  angle: 0,
  ...createTimingTarget(),
  score: 0,
  streak: 0,
  attempts: 0,
  phase: 'playing',
  message: 'Strike when the needle crosses the lit arc.',
});

const isAngleInTarget = (angle: number, targetStart: number, targetSize: number) => {
  const normalized = ((angle - targetStart) % 360 + 360) % 360;
  return normalized <= targetSize;
};

export function SoloTimingRingGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMicroGameProps) {
  const [state, setState] = useState<TimingRingState>(() => createTimingRingState());
  const reportedPhaseRef = useRef<TimingRingState['phase'] | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const gameLabel = formatGameName('timing-ring', gameDefinitions);

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    lastFrameRef.current = null;
    setState(createTimingRingState());
  }, []);

  const strikeRing = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'playing') {
        return current;
      }

      const attempts = current.attempts + 1;
      const hit = isAngleInTarget(current.angle, current.targetStart, current.targetSize);
      const nextTarget = createTimingTarget();

      if (!hit) {
        const lost = attempts >= TIMING_RING_MAX_ATTEMPTS;
        return {
          ...current,
          ...nextTarget,
          attempts,
          streak: 0,
          phase: lost ? 'lost' : 'playing',
          message: lost ? 'The ring burned out before enough clean strikes.' : 'Miss. The target arc jumped.',
        };
      }

      const streak = current.streak + 1;
      const score = current.score + 1;
      const won = score >= TIMING_RING_TARGET_SCORE;
      return {
        ...current,
        ...nextTarget,
        attempts,
        score,
        streak,
        phase: won ? 'won' : 'playing',
        message: won ? 'Timing ring stabilized.' : `Clean strike. Streak x${streak}.`,
      };
    });
  }, []);

  useEffect(() => {
    const step = (now: number) => {
      setState((current) => {
        if (lastFrameRef.current === null) {
          lastFrameRef.current = now;
          return current;
        }

        const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.05);
        lastFrameRef.current = now;
        if (current.phase !== 'playing') {
          return current;
        }

        const speed = 130 + current.score * 9 + current.streak * 6;
        return {
          ...current,
          angle: (current.angle + deltaSeconds * speed) % 360,
        };
      });

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((state.phase !== 'won' && state.phase !== 'lost') || reportedPhaseRef.current === state.phase) {
      return;
    }

    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'timing-ring',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Timing Ring',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          strikeRing();
        }
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame, strikeRing]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'timing',
        title: 'Ring',
        layout: 'row',
        buttons: [
          { key: 'strike', label: 'Strike', icon: <AiOutlineThunderbolt />, onClick: strikeRing, disabled: state.phase !== 'playing' },
          { key: 'reset', label: 'Reset', icon: <AiOutlineReload />, onClick: resetGame },
        ],
      },
    ],
    [resetGame, state.phase, strikeRing]
  );

  const statusLabel = state.phase === 'won' ? 'Ring Stable' : state.phase === 'lost' ? 'Ring Burned' : 'Timing';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Strike when the needle enters the target arc"
        sections={controllerSections}
      />

      <SoloInfoCard
        title={gameLabel}
        playerName={player.name}
        status={statusLabel}
        stats={[
          { label: 'Score', value: `${state.score}/${TIMING_RING_TARGET_SCORE}` },
          { label: 'Attempts', value: `${state.attempts}/${TIMING_RING_MAX_ATTEMPTS}` },
          { label: 'Streak', value: `x${state.streak}` },
          { label: 'Mode', value: 'Solo' },
        ]}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onReset={resetGame}
        onToggleMusic={onToggleMusic}
        onLeave={onLeave}
      />

      <section className="micro-game-shell timing-ring-shell">
        <div className="micro-game-hud">
          <article>
            <span>Score</span>
            <strong>{state.score}/{TIMING_RING_TARGET_SCORE}</strong>
          </article>
          <article>
            <span>Attempts</span>
            <strong>{state.attempts}/{TIMING_RING_MAX_ATTEMPTS}</strong>
          </article>
          <article>
            <span>Streak</span>
            <strong>x{state.streak}</strong>
          </article>
        </div>

        <div className="timing-ring-stage">
          <div
            className="timing-ring-target"
            style={{
              '--timing-target-start': `${state.targetStart}deg`,
              '--timing-target-size': `${state.targetSize}deg`,
            } as React.CSSProperties}
          />
          <div className="timing-ring-dial">
            <span
              className="timing-ring-needle"
              style={{ '--timing-angle': `${state.angle}deg` } as React.CSSProperties}
            />
            <strong>{state.phase === 'playing' ? 'Strike' : statusLabel}</strong>
          </div>
        </div>

        <div className="timing-ring-actions">
          <button type="button" onClick={strikeRing} disabled={state.phase !== 'playing'}>
            <AiOutlineThunderbolt /> Strike Ring
          </button>
          <button type="button" onClick={resetGame}>
            <AiOutlineReload /> Reset
          </button>
        </div>

        <p className="micro-game-event">{state.message}</p>

        {state.phase !== 'playing' ? (
          <div className="micro-game-result">
            <strong>{state.phase === 'won' ? 'Ring Stabilized' : 'Ring Burned Out'}</strong>
            <span>{state.phase === 'won' ? `${state.score} strikes landed.` : 'Reset and strike earlier inside the arc.'}</span>
            <button type="button" onClick={resetGame}>
              <AiOutlineReload /> New Ring
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
