'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineReload,
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

const createSpawned = (tetromino: T.Tetromino) => ({
  tetromino,
  rotation: 0,
  x: Math.floor(COLUMNS / 2) - 2,
  y: -1,
});

const getTetrominoColor = (cell: string | null) => T.getTetrominoColor(cell);

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
              boxShadow: filled ? `0 0 0 1px rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.12)` : undefined,
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
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const dropIntervalRef = useRef<number>(DROP_INTERVAL_DEFAULT);
  const lastDropRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const gameLabel = formatGameName('tetris', gameDefinitions);

  const resetGame = useCallback(() => {
    setGrid(T.createEmptyGrid(ROWS, COLUMNS));
    setSpawned(createSpawned(T.randomTetromino()));
    setNextTetromino(T.randomTetromino());
    setHoldTetromino(null);
    setHoldAvailable(true);
    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    dropIntervalRef.current = DROP_INTERVAL_DEFAULT;
    lastDropRef.current = performance.now();
  }, []);

  useEffect(() => {
    resetGame();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resetGame]);

  const spawnNext = useCallback(
    (tetromino: T.Tetromino) => createSpawned(tetromino),
    []
  );

  const lockSpawned = useCallback(
    (current: T.Spawned) => {
      const placed = T.placeTetromino(grid, ROWS, COLUMNS, current, current.tetromino.id);
      const { grid: clearedGrid, linesCleared } = T.clearFullLines(placed, ROWS, COLUMNS);

      setGrid(clearedGrid);
      if (linesCleared > 0) {
        setLines((previous) => previous + linesCleared);
        setScore((previous) => previous + T.scoreForLines(linesCleared) * level);
      }

      const nextSpawn = spawnNext(nextTetromino);
      const nextQueue = T.randomTetromino();
      const gameOver = T.isCollision(clearedGrid, ROWS, COLUMNS, nextSpawn);

      setSpawned(nextSpawn);
      setNextTetromino(nextQueue);
      setHoldAvailable(true);

      if (gameOver) {
        setIsGameOver(true);
        onMatchComplete({ mode: 'cpu', gameType: 'tetris', outcome: 'loss', opponent: 'Tetris AI' });
      }
    },
    [grid, level, nextTetromino, onMatchComplete, spawnNext]
  );

  const step = useCallback(
    (now: number) => {
      if (isGameOver) return;
      if (!spawned) return;
      if (now - lastDropRef.current >= dropIntervalRef.current) {
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
    [grid, isGameOver, lockSpawned, spawned]
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  const handleMove = useCallback(
    (dx: number) => {
      if (!spawned || isGameOver) return;
      const moved = T.moveSpawned(spawned, dx, 0);
      if (!T.isCollision(grid, ROWS, COLUMNS, moved)) {
        setSpawned(moved);
      }
    },
    [grid, isGameOver, spawned]
  );

  const handleRotate = useCallback(() => {
    if (!spawned || isGameOver) return;
    const rotated = T.rotateSpawned(spawned, 1);
    if (!T.isCollision(grid, ROWS, COLUMNS, rotated)) {
      setSpawned(rotated);
    }
  }, [grid, isGameOver, spawned]);

  const handleDrop = useCallback(() => {
    if (!spawned || isGameOver) return;
    let fell = spawned;
    while (!T.isCollision(grid, ROWS, COLUMNS, T.moveSpawned(fell, 0, 1))) {
      fell = T.moveSpawned(fell, 0, 1);
    }
    setSpawned(fell);
    lockSpawned(fell);
  }, [grid, isGameOver, lockSpawned, spawned]);

  const handleHold = useCallback(() => {
    if (!spawned || isGameOver || !holdAvailable) return;
    const currentTetromino = spawned.tetromino;
    if (!holdTetromino) {
      setHoldTetromino(currentTetromino);
      setSpawned(spawnNext(nextTetromino));
      setNextTetromino(T.randomTetromino());
    } else {
      setSpawned(spawnNext(holdTetromino));
      setHoldTetromino(currentTetromino);
    }
    setHoldAvailable(false);
  }, [holdAvailable, holdTetromino, isGameOver, nextTetromino, spawnNext, spawned]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isGameOver) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleMove(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleMove(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleRotate();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleDrop();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleHold();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const moved = T.moveSpawned(spawned!, 0, 1);
        if (!T.isCollision(grid, ROWS, COLUMNS, moved)) {
          setSpawned(moved);
          setScore((s) => s + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, handleDrop, handleHold, handleMove, handleRotate, isGameOver, spawned]);

  const renderedGrid = useMemo(() => {
    let g = [...grid];
    if (spawned) {
      g = T.placeTetromino(g, ROWS, COLUMNS, spawned, spawned.tetromino.id);
    }
    return g;
  }, [grid, spawned]);

  const controllerSections = [
    {
      key: 'controls',
      title: 'Controls',
      layout: 'row' as const,
      buttons: [
        { key: 'rotate', label: 'Rotate', icon: <AiOutlineArrowUp />, onClick: handleRotate },
        { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, onClick: () => handleMove(-1) },
        { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, onClick: () => handleMove(1) },
        { key: 'drop', label: 'Drop', icon: <AiOutlineArrowDown />, onClick: handleDrop },
        { key: 'hold', label: 'Hold', icon: <AiOutlineReload />, onClick: handleHold, disabled: !holdAvailable },
      ],
    },
  ];

  return (
    <div className="solo-game-root">
      <h1 className="game-screen-title">{gameLabel}</h1>

      <div className="tetris-layout">
        <div className="tetris-board" style={{ width: 240, height: 480, background: '#081421', padding: 6 }}>
          <div className="tetris-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: 2 }}>
            {renderedGrid.map((cell, idx) => {
              const color = getTetrominoColor(cell);
              return (
                <div
                  key={idx}
                  className={classnames('tetris-cell', { filled: !!cell })}
                  style={{
                    width: '100%',
                    paddingTop: '100%',
                    position: 'relative',
                    background: cell ? color : '#0b1b26',
                    borderRadius: 2,
                    boxShadow: cell ? `0 0 0 1px rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.1)` : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="tetris-sidebar">
          <div className="tetris-status-box">
            <span>Score: {score}</span>
            <span>Lines: {lines}</span>
            <span>Level: {level}</span>
            <span>Hold available: {holdAvailable ? 'Yes' : 'Locked'}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="lobby-btn" type="button" onClick={resetGame}>
                Restart
              </button>
              <button className="lobby-btn" type="button" onClick={onLeave}>
                Leave
              </button>
            </div>
          </div>

          <div className="tetris-preview-card">
            <span className="tetris-preview-title">Next</span>
            {renderPreview(nextTetromino)}
            <span className="tetris-preview-label">{nextTetromino.id}</span>
          </div>

          <div className="tetris-preview-card">
            <span className="tetris-preview-title">Hold</span>
            {renderPreview(holdTetromino)}
            <span className="tetris-preview-label">
              {holdTetromino ? holdTetromino.id : 'Press C to hold'}
            </span>
          </div>
        </div>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title={gameLabel} />
    </div>
  );
}
