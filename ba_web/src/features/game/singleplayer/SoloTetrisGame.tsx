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
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';
import * as T from '@/lib/tetrisEngine';

type SoloTetrisGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const ROWS = 20;
const COLUMNS = 10;
const DROP_INTERVAL_DEFAULT = 700;
const DROP_INTERVAL_STEP = 55;
const DROP_INTERVAL_MIN = 140;
const LINES_PER_LEVEL = 10;
const BEST_SCORE_STORAGE_KEY = 'baturo_tetris_best_score';

const createSpawned = (tetromino: T.Tetromino): T.Spawned => ({
  tetromino,
  rotation: 0,
  x: Math.floor(COLUMNS / 2) - 2,
  y: -1,
});

const getDropInterval = (level: number) =>
  Math.max(DROP_INTERVAL_MIN, DROP_INTERVAL_DEFAULT - (level - 1) * DROP_INTERVAL_STEP);

const renderPreview = (tetromino: T.Tetromino | null) => {
  const shape = tetromino ? tetromino.blocks[0] : [];
  return (
    <div className="tetris-preview-grid">
      {Array.from({ length: 16 }).map((_, index) => {
        const filled = shape.includes(index);
        const color = filled ? tetromino?.color ?? '#6ee7b7' : 'rgba(255, 255, 255, 0.08)';
        return (
          <div
            key={index}
            className="tetris-preview-cell"
            style={{
              background: color,
              borderColor: filled ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
              boxShadow: filled
                ? '0 0 0 1px rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.12)'
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
};

export function SoloTetrisGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloTetrisGameProps) {
  const [grid, setGrid] = useState<T.Grid>(() => T.createEmptyGrid(ROWS, COLUMNS));
  const [spawned, setSpawned] = useState<T.Spawned>(() => createSpawned(T.randomTetromino()));
  const [nextTetromino, setNextTetromino] = useState<T.Tetromino>(() => T.randomTetromino());
  const [holdTetromino, setHoldTetromino] = useState<T.Tetromino | null>(null);
  const [holdAvailable, setHoldAvailable] = useState(true);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastDropRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastReportedOutcomeRef = useRef<'loss' | null>(null);

  const gameLabel = formatGameName('tetris', gameDefinitions);
  const level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  const dropInterval = getDropInterval(level);
  const runStatus = isGameOver ? 'Game Over' : score === 0 && lines === 0 ? 'Starting' : 'Stacking';

  const resetGame = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setGrid(T.createEmptyGrid(ROWS, COLUMNS));
    setSpawned(createSpawned(T.randomTetromino()));
    setNextTetromino(T.randomTetromino());
    setHoldTetromino(null);
    setHoldAvailable(true);
    setScore(0);
    setLines(0);
    setIsGameOver(false);
    lastDropRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }, []);

  useEffect(() => {
    resetGame();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [resetGame]);

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (score <= bestScore || typeof window === 'undefined') {
      return;
    }

    setBestScore(score);
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
  }, [bestScore, score]);

  useEffect(() => {
    if (!isGameOver || lastReportedOutcomeRef.current === 'loss') {
      return;
    }

    lastReportedOutcomeRef.current = 'loss';
    onMatchComplete({
      mode: 'cpu',
      gameType: 'tetris',
      outcome: 'loss',
      opponent: 'Tetris',
    });
  }, [isGameOver, onMatchComplete]);

  const spawnFromQueue = useCallback((tetromino: T.Tetromino) => createSpawned(tetromino), []);

  const lockSpawned = useCallback(
    (current: T.Spawned) => {
      if (isGameOver) {
        return;
      }

      const placed = T.placeTetromino(grid, ROWS, COLUMNS, current, current.tetromino.id);
      const { grid: clearedGrid, linesCleared } = T.clearFullLines(placed, ROWS, COLUMNS);

      setGrid(clearedGrid);

      if (linesCleared > 0) {
        const nextLineTotal = lines + linesCleared;
        const nextLevel = Math.floor(nextLineTotal / LINES_PER_LEVEL) + 1;
        setLines(nextLineTotal);
        setScore((currentScore) => currentScore + T.scoreForLines(linesCleared) * nextLevel);
      }

      const queuedTetromino = nextTetromino;
      const nextSpawn = spawnFromQueue(queuedTetromino);
      const refreshedQueue = T.randomTetromino();
      const nextIsBlocked = T.isCollision(clearedGrid, ROWS, COLUMNS, nextSpawn);

      setSpawned(nextSpawn);
      setNextTetromino(refreshedQueue);
      setHoldAvailable(true);

      if (nextIsBlocked) {
        setIsGameOver(true);
      }
    },
    [grid, isGameOver, lines, nextTetromino, spawnFromQueue]
  );

  const handleMove = useCallback(
    (dx: number) => {
      if (!spawned || isGameOver) {
        return;
      }

      const moved = T.moveSpawned(spawned, dx, 0);
      if (!T.isCollision(grid, ROWS, COLUMNS, moved)) {
        setSpawned(moved);
      }
    },
    [grid, isGameOver, spawned]
  );

  const handleRotate = useCallback(() => {
    if (!spawned || isGameOver) {
      return;
    }

    const rotated = T.rotateSpawned(spawned, 1);
    if (!T.isCollision(grid, ROWS, COLUMNS, rotated)) {
      setSpawned(rotated);
    }
  }, [grid, isGameOver, spawned]);

  const handleSoftDrop = useCallback(() => {
    if (!spawned || isGameOver) {
      return;
    }

    const moved = T.moveSpawned(spawned, 0, 1);
    if (T.isCollision(grid, ROWS, COLUMNS, moved)) {
      lockSpawned(spawned);
      return;
    }

    setSpawned(moved);
    setScore((currentScore) => currentScore + 1);
  }, [grid, isGameOver, lockSpawned, spawned]);

  const handleHardDrop = useCallback(() => {
    if (!spawned || isGameOver) {
      return;
    }

    let droppedRows = 0;
    let fallingPiece = spawned;

    while (!T.isCollision(grid, ROWS, COLUMNS, T.moveSpawned(fallingPiece, 0, 1))) {
      fallingPiece = T.moveSpawned(fallingPiece, 0, 1);
      droppedRows += 1;
    }

    if (droppedRows > 0) {
      setScore((currentScore) => currentScore + droppedRows * 2);
    }

    setSpawned(fallingPiece);
    lockSpawned(fallingPiece);
  }, [grid, isGameOver, lockSpawned, spawned]);

  const handleHold = useCallback(() => {
    if (!spawned || isGameOver || !holdAvailable) {
      return;
    }

    const currentTetromino = spawned.tetromino;
    const queuedTetromino = holdTetromino ?? nextTetromino;
    const nextSpawn = spawnFromQueue(queuedTetromino);
    const nextQueue = holdTetromino ? nextTetromino : T.randomTetromino();

    setHoldTetromino(currentTetromino);
    setSpawned(nextSpawn);
    setNextTetromino(nextQueue);
    setHoldAvailable(false);

    if (T.isCollision(grid, ROWS, COLUMNS, nextSpawn)) {
      setIsGameOver(true);
    }
  }, [grid, holdAvailable, holdTetromino, isGameOver, nextTetromino, spawnFromQueue, spawned]);

  const step = useCallback(
    (now: number) => {
      if (isGameOver || !spawned) {
        return;
      }

      if (now - lastDropRef.current >= dropInterval) {
        lastDropRef.current = now;
        const moved = T.moveSpawned(spawned, 0, 1);
        if (T.isCollision(grid, ROWS, COLUMNS, moved)) {
          lockSpawned(spawned);
        } else {
          setSpawned(moved);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    },
    [dropInterval, grid, isGameOver, lockSpawned, spawned]
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        handleMove(-1);
        return;
      }

      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        handleMove(1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 'x') {
        event.preventDefault();
        handleRotate();
        return;
      }

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSoftDrop();
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        handleHardDrop();
        return;
      }

      if (
        event.key.toLowerCase() === 'c' ||
        event.key === 'Shift' ||
        event.key.toLowerCase() === 'shift'
      ) {
        event.preventDefault();
        handleHold();
        return;
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleHardDrop, handleHold, handleMove, handleRotate, handleSoftDrop, resetGame]);

  const renderedGrid = useMemo(() => {
    if (!spawned) {
      return grid;
    }

    return T.placeTetromino([...grid], ROWS, COLUMNS, spawned, spawned.tetromino.id);
  }, [grid, spawned]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Movement',
      layout: 'dpad' as const,
      buttons: [
        { key: 'rotate', label: 'Rotate', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: handleRotate },
        { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => handleMove(-1) },
        { key: 'soft-drop', label: 'Drop', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: handleSoftDrop },
        { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => handleMove(1) },
      ],
    },
    {
      key: 'actions',
      title: 'Run Actions',
      layout: 'row' as const,
      buttons: [
        { key: 'hard-drop', label: 'Hard Drop', icon: <AiOutlineArrowDown />, onClick: handleHardDrop },
        { key: 'hold', label: 'Hold', icon: <AiOutlineReload />, onClick: handleHold, disabled: !holdAvailable },
        { key: 'new-run', label: 'New Run', icon: <AiOutlineReload />, onClick: resetGame },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Rotate, soft drop, hard drop, and hold pieces"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4, repeat: Infinity } : undefined}
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
                <span className="room-float-anchor">
                  <AiOutlineDrag /> drag
                </span>
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
                <div className="solo-float-stat">
                  <span>Player</span>
                  <strong>{player.name}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Status</span>
                  <strong>{runStatus}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Score</span>
                  <strong>{score}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Lines</span>
                  <strong>{lines}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Level</span>
                  <strong>{level}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleAnimations}>
                  Motion {enableAnimations ? 'On' : 'Off'}
                </button>
                <button className={classnames('room-float-action-btn', 'room-float-action-btn-danger')} type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <div className="tetris-layout">
        <div className="tetris-stage-shell">
          <div className="tetris-board-shell">
            <div className="tetris-board">
              <div className="tetris-grid" style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}>
                {renderedGrid.map((cell, index) => (
                  <div
                    key={index}
                    className={classnames('tetris-cell', cell && 'tetris-cell-filled')}
                    style={{
                      background: cell ? T.getTetrominoColor(cell) : '#0b1b26',
                      boxShadow: cell
                        ? '0 0 0 1px rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.1)'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="tetris-sidebar">
            <div className="tetris-preview-card tetris-preview-card-compact">
              <span className="tetris-preview-title">Next</span>
              {renderPreview(nextTetromino)}
              <span className="tetris-preview-label">{nextTetromino.id}</span>
            </div>

            <div className="tetris-preview-card tetris-preview-card-compact">
              <span className="tetris-preview-title">Hold</span>
              {renderPreview(holdTetromino)}
              <span className="tetris-preview-label">
                {holdTetromino ? holdTetromino.id : 'Store'}
              </span>
            </div>

            <div className={classnames('tetris-status-box', 'tetris-sidebar-wide', isGameOver && 'tetris-status-box-danger')}>
              <div className="tetris-score-row">
                <span>{isGameOver ? 'Run ended' : `Drop speed ${dropInterval}ms`}</span>
                <small>
                  {isGameOver
                    ? 'Press New Run or tap R to reset the stack.'
                    : 'Space hard drops. C or Shift stores the active piece.'}
                </small>
              </div>
              <div className="tetris-key-row">
                <span className="tetris-keycap">Left / Right</span>
                <span>move</span>
                <span className="tetris-keycap">Up</span>
                <span>rotate</span>
              </div>
              <div className="tetris-key-row">
                <span className="tetris-keycap">Down</span>
                <span>soft drop</span>
                <span className="tetris-keycap">Space</span>
                <span>hard drop</span>
              </div>
            </div>

            <div className="tetris-preview-card tetris-sidebar-wide">
              <span className="tetris-preview-title">Run Notes</span>
              <span className="tetris-preview-copy">
                Clear lines to raise the level and speed up the stack.
              </span>
              <span className="tetris-preview-copy">
                Hold is available once per drop cycle.
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
