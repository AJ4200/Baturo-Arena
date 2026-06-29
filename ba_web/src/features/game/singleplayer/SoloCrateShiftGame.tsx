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
  AiOutlineRollback,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type {
  CrateShiftCell,
  CrateShiftDirection,
  CrateShiftState,
  GameDefinition,
  MatchResultEvent,
  PlayerProfile,
} from '@/types/game';

type SoloCrateShiftGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const LEVEL = [
  '#########',
  '#.......#',
  '#..GGG..#',
  '#.......#',
  '#..CCC..#',
  '#.#...#.#',
  '#...P...#',
  '#..#.#..#',
  '#########',
] as const;

const BEST_SCORE_STORAGE_KEY = 'baturo_crate_shift_best_score';

const DIRECTIONS: Record<CrateShiftDirection, { row: number; column: number }> = {
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 },
};

const cellKey = (cell: CrateShiftCell): string => `${cell.row}:${cell.column}`;

const sameCell = (left: CrateShiftCell, right: CrateShiftCell): boolean =>
  left.row === right.row && left.column === right.column;

const parseLevel = (): {
  player: CrateShiftCell;
  crates: CrateShiftCell[];
  goals: CrateShiftCell[];
  walls: Set<string>;
} => {
  const crates: CrateShiftCell[] = [];
  const goals: CrateShiftCell[] = [];
  const walls = new Set<string>();
  let player: CrateShiftCell = { row: 1, column: 1 };

  LEVEL.forEach((line, row) => {
    Array.from(line).forEach((cell, column) => {
      if (cell === '#') {
        walls.add(cellKey({ row, column }));
      }
      if (cell === 'P') {
        player = { row, column };
      }
      if (cell === 'C') {
        crates.push({ row, column });
      }
      if (cell === 'G') {
        goals.push({ row, column });
      }
    });
  });

  return { player, crates, goals, walls };
};

const LEVEL_DATA = parseLevel();
const ROWS = LEVEL.length;
const COLUMNS = LEVEL[0].length;

const createInitialState = (): CrateShiftState => ({
  player: LEVEL_DATA.player,
  crates: LEVEL_DATA.crates,
  moves: 0,
  pushes: 0,
  status: 'playing',
});

const isSolved = (crates: CrateShiftCell[]): boolean =>
  LEVEL_DATA.goals.every((goal) => crates.some((crate) => sameCell(crate, goal)));

const isWall = (cell: CrateShiftCell): boolean => LEVEL_DATA.walls.has(cellKey(cell));

const isOutside = (cell: CrateShiftCell): boolean =>
  cell.row < 0 || cell.row >= ROWS || cell.column < 0 || cell.column >= COLUMNS;

const getCrateIndexAt = (crates: CrateShiftCell[], cell: CrateShiftCell): number =>
  crates.findIndex((crate) => sameCell(crate, cell));

export function SoloCrateShiftGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloCrateShiftGameProps) {
  const [state, setState] = useState<CrateShiftState>(createInitialState);
  const [history, setHistory] = useState<CrateShiftState[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef(false);
  const gameLabel = formatGameName('crate-shift', gameDefinitions);

  const cratesOnGoals = useMemo(
    () => state.crates.filter((crate) => LEVEL_DATA.goals.some((goal) => sameCell(crate, goal))).length,
    [state.crates]
  );

  const score = Math.max(0, 1200 - state.moves * 8 - state.pushes * 18 + cratesOnGoals * 90);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = false;
    setHistory([]);
    setState(createInitialState());
  }, []);

  const handleUndo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    lastReportedOutcomeRef.current = previous.status === 'won';
    setState(previous);
    setHistory(history.slice(0, -1));
  }, [history]);

  const movePlayer = useCallback((direction: CrateShiftDirection) => {
    if (state.status === 'won') {
      return;
    }

    const delta = DIRECTIONS[direction];
    const nextPlayer = {
      row: state.player.row + delta.row,
      column: state.player.column + delta.column,
    };

    if (isOutside(nextPlayer) || isWall(nextPlayer)) {
      return;
    }

    const crateIndex = getCrateIndexAt(state.crates, nextPlayer);
    if (crateIndex < 0) {
      const nextState: CrateShiftState = {
        ...state,
        player: nextPlayer,
        moves: state.moves + 1,
      };
      setHistory((current) => [...current, state]);
      setState(nextState);
      return;
    }

    const nextCrate = {
      row: nextPlayer.row + delta.row,
      column: nextPlayer.column + delta.column,
    };

    if (
      isOutside(nextCrate) ||
      isWall(nextCrate) ||
      getCrateIndexAt(state.crates, nextCrate) >= 0
    ) {
      return;
    }

    const nextCrates = state.crates.map((crate, index) =>
      index === crateIndex ? nextCrate : crate
    );
    const nextStatus = isSolved(nextCrates) ? 'won' : 'playing';
    const nextState: CrateShiftState = {
      ...state,
      player: nextPlayer,
      crates: nextCrates,
      moves: state.moves + 1,
      pushes: state.pushes + 1,
      status: nextStatus,
    };

    setHistory((current) => [...current, state]);
    setState(nextState);
  }, [state]);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (state.status !== 'won' || score <= bestScore) {
      return;
    }

    setBestScore(score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
    }
  }, [bestScore, score, state.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault();
        movePlayer('up');
        return;
      }
      if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault();
        movePlayer('down');
        return;
      }
      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        movePlayer('left');
        return;
      }
      if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        movePlayer('right');
        return;
      }
      if (key === 'z' || key === 'u') {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestart, handleUndo, movePlayer]);

  useEffect(() => {
    if (state.status === 'won' && !lastReportedOutcomeRef.current) {
      lastReportedOutcomeRef.current = true;
      onMatchComplete({
        mode: 'cpu',
        gameType: 'crate-shift',
        outcome: 'win',
        opponent: 'Warehouse Route',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Move',
      layout: 'dpad' as const,
      buttons: [
        { key: 'up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => movePlayer('up') },
        { key: 'down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => movePlayer('down') },
        { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => movePlayer('left') },
        { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => movePlayer('right') },
      ],
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        { key: 'undo', label: 'Undo', icon: <AiOutlineRollback />, onClick: handleUndo, disabled: history.length === 0 },
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: handleRestart },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Crate Shift" subtitle="Push every crate onto a pad" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
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
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Puzzle</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> {state.status === 'won' ? 'Solved' : 'Routing Crates'}</span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Pads</span><strong>{cratesOnGoals} / {LEVEL_DATA.goals.length}</strong></div>
                <div className="solo-float-stat"><span>Moves</span><strong>{state.moves}</strong></div>
                <div className="solo-float-stat"><span>Pushes</span><strong>{state.pushes}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleUndo} disabled={history.length === 0}>
                  <AiOutlineRollback /> Undo
                </button>
                <button className="room-float-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Reset
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

      <section className="crate-shift-shell">
        <div className="crate-shift-hud">
          <div className="crate-shift-hud-item"><span>Pads Filled</span><strong>{cratesOnGoals} / {LEVEL_DATA.goals.length}</strong></div>
          <div className="crate-shift-hud-item"><span>Moves</span><strong>{state.moves}</strong></div>
          <div className="crate-shift-hud-item"><span>Pushes</span><strong>{state.pushes}</strong></div>
          <div className="crate-shift-hud-item"><span>Score</span><strong>{score}</strong></div>
        </div>

        <div className="crate-shift-board-wrap">
          <div className="crate-shift-board" role="grid" aria-label="Crate Shift board">
            {Array.from({ length: ROWS }).map((_, row) =>
              Array.from({ length: COLUMNS }).map((__, column) => {
                const cell = { row, column };
                const key = cellKey(cell);
                const isGoal = LEVEL_DATA.goals.some((goal) => sameCell(goal, cell));
                const crate = state.crates.find((entry) => sameCell(entry, cell));
                const isCrateOnGoal = Boolean(crate && isGoal);
                const isPlayer = sameCell(state.player, cell);
                return (
                  <div
                    key={key}
                    className={classnames(
                      'crate-shift-cell',
                      isWall(cell) && 'crate-shift-wall',
                      isGoal && 'crate-shift-goal',
                      crate && 'crate-shift-crate',
                      isCrateOnGoal && 'crate-shift-crate-on-goal',
                      isPlayer && 'crate-shift-player'
                    )}
                    role="gridcell"
                  >
                    {isGoal ? <span className="crate-shift-goal-dot" /> : null}
                    {crate ? <span className="crate-shift-crate-box" /> : null}
                    {isPlayer ? <span className="crate-shift-worker" /> : null}
                  </div>
                );
              })
            )}
          </div>

          {state.status === 'won' ? (
            <div className="crate-shift-overlay">
              <div className="crate-shift-message">
                <span className="crate-shift-status-pill">Solved</span>
                <h2>Crates parked</h2>
                <p>Final score {score}. You solved it in {state.moves} moves and {state.pushes} pushes.</p>
                <button className="crate-shift-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Play Again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="crate-shift-actions">
          <button className="crate-shift-action-btn" type="button" onClick={handleUndo} disabled={history.length === 0}>
            <AiOutlineRollback /> Undo
          </button>
          <button className="crate-shift-action-btn" type="button" onClick={handleRestart}>
            <AiOutlineReload /> Reset
          </button>
        </div>

        <p className="crate-shift-message-inline">
          Move into a crate to push it. A crate can only slide into an open floor tile, so plan routes around the walls.
        </p>
      </section>
    </>
  );
}
