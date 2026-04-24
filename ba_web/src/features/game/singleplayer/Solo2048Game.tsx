'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineDrag,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type Direction = 'up' | 'down' | 'left' | 'right';

type Solo2048State = {
  board: number[];
  score: number;
  moves: number;
  hasWon: boolean;
  isGameOver: boolean;
};

type Solo2048GameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const GRID_SIZE = 4;
const WIN_TILE = 2048;
const BEST_SCORE_STORAGE_KEY = 'baruto_2048_best_score';

const getCellIndex = (row: number, column: number) => row * GRID_SIZE + column;

const createEmptyBoard = () => Array(GRID_SIZE * GRID_SIZE).fill(0);

const addRandomTile = (board: number[]): number[] => {
  const emptyIndexes = board.reduce<number[]>((indexes, value, index) => {
    if (value === 0) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  if (emptyIndexes.length === 0) {
    return [...board];
  }

  const randomIndex = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  const nextBoard = [...board];
  nextBoard[randomIndex] = Math.random() < 0.9 ? 2 : 4;
  return nextBoard;
};

const getInitialBoard = (): number[] => {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return board;
};

const hasAvailableMoves = (board: number[]): boolean => {
  if (board.some((value) => value === 0)) {
    return true;
  }

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const value = board[getCellIndex(row, column)];
      if (row + 1 < GRID_SIZE && board[getCellIndex(row + 1, column)] === value) {
        return true;
      }
      if (column + 1 < GRID_SIZE && board[getCellIndex(row, column + 1)] === value) {
        return true;
      }
    }
  }

  return false;
};

const collapseLine = (line: number[]): { line: number[]; scoreGain: number; moved: boolean } => {
  const filtered = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let scoreGain = 0;

  for (let index = 0; index < filtered.length; index += 1) {
    const currentValue = filtered[index];
    const nextValue = filtered[index + 1];

    if (nextValue !== undefined && currentValue === nextValue) {
      const combinedValue = currentValue * 2;
      merged.push(combinedValue);
      scoreGain += combinedValue;
      index += 1;
    } else {
      merged.push(currentValue);
    }
  }

  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }

  const moved = merged.some((value, index) => value !== line[index]);
  return { line: merged, scoreGain, moved };
};

const getLineIndexes = (direction: Direction, lineIndex: number): number[] => {
  if (direction === 'left') {
    return [0, 1, 2, 3].map((column) => getCellIndex(lineIndex, column));
  }

  if (direction === 'right') {
    return [3, 2, 1, 0].map((column) => getCellIndex(lineIndex, column));
  }

  if (direction === 'up') {
    return [0, 1, 2, 3].map((row) => getCellIndex(row, lineIndex));
  }

  return [3, 2, 1, 0].map((row) => getCellIndex(row, lineIndex));
};

const moveBoard = (
  board: number[],
  direction: Direction
): { board: number[]; scoreGain: number; moved: boolean } => {
  const nextBoard = [...board];
  let scoreGain = 0;
  let moved = false;

  for (let lineIndex = 0; lineIndex < GRID_SIZE; lineIndex += 1) {
    const indexes = getLineIndexes(direction, lineIndex);
    const line = indexes.map((index) => board[index]);
    const collapsed = collapseLine(line);
    scoreGain += collapsed.scoreGain;
    moved = moved || collapsed.moved;

    indexes.forEach((index, valueIndex) => {
      nextBoard[index] = collapsed.line[valueIndex];
    });
  }

  if (!moved) {
    return { board, scoreGain: 0, moved: false };
  }

  return { board: addRandomTile(nextBoard), scoreGain, moved: true };
};

const createInitialState = (): Solo2048State => {
  const board = getInitialBoard();
  return {
    board,
    score: 0,
    moves: 0,
    hasWon: board.some((value) => value >= WIN_TILE),
    isGameOver: !hasAvailableMoves(board),
  };
};

const createPrerenderState = (): Solo2048State => ({
  board: createEmptyBoard(),
  score: 0,
  moves: 0,
  hasWon: false,
  isGameOver: false,
});

export function Solo2048Game({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: Solo2048GameProps) {
  const [state, setState] = useState<Solo2048State>(() => createPrerenderState());
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('2048', gameDefinitions);
  const maxTile = useMemo(() => Math.max(...state.board), [state.board]);
  const runStatus = state.isGameOver
    ? state.hasWon
      ? 'Completed'
      : 'No Moves'
    : state.hasWon
      ? 'Target Hit'
      : 'Running';

  const handleDirection = useCallback((direction: Direction) => {
    setState((currentState) => {
      if (currentState.isGameOver) {
        return currentState;
      }

      const movedState = moveBoard(currentState.board, direction);
      if (!movedState.moved) {
        return currentState;
      }

      const hasWon = currentState.hasWon || movedState.board.some((value) => value >= WIN_TILE);
      const isGameOver = !hasAvailableMoves(movedState.board);

      return {
        board: movedState.board,
        score: currentState.score + movedState.scoreGain,
        moves: currentState.moves + 1,
        hasWon,
        isGameOver,
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setState(createInitialState());
  }, []);

  const controllerButtons = [
    { key: 'up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => handleDirection('up') },
    { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => handleDirection('left') },
    { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => handleDirection('right') },
    { key: 'down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => handleDirection('down') },
  ];
  const controllerSections = [
    {
      key: 'movement',
      title: 'Directional Pad',
      layout: 'dpad' as const,
      buttons: controllerButtons,
    },
    {
      key: 'actions',
      title: 'Run Controls',
      layout: 'row' as const,
      buttons: [{ key: 'new', label: 'New Run', icon: <AiOutlineReload />, onClick: handleReset }],
    },
  ];

  useEffect(() => {
    setState(createInitialState());
  }, []);

  useEffect(() => {
    const rawBestScore = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsedBestScore = rawBestScore ? Number(rawBestScore) : 0;
    if (Number.isFinite(parsedBestScore) && parsedBestScore > 0) {
      setBestScore(parsedBestScore);
    }
  }, []);

  useEffect(() => {
    if (state.score <= bestScore) {
      return;
    }

    setBestScore(state.score);
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.score));
  }, [bestScore, state.score]);

  useEffect(() => {
    if (state.hasWon && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: '2048',
        outcome: 'win',
        opponent: '2048 Target',
      });
      return;
    }

    if (state.isGameOver && !state.hasWon && lastReportedOutcomeRef.current === null) {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: '2048',
        outcome: 'loss',
        opponent: '2048 Target',
      });
    }
  }, [onMatchComplete, state.hasWon, state.isGameOver]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      let direction: Direction | null = null;

      if (event.key === 'ArrowUp' || key === 'w') {
        direction = 'up';
      } else if (event.key === 'ArrowDown' || key === 's') {
        direction = 'down';
      } else if (event.key === 'ArrowLeft' || key === 'a') {
        direction = 'left';
      } else if (event.key === 'ArrowRight' || key === 'd') {
        direction = 'right';
      }

      if (!direction) {
        return;
      }

      event.preventDefault();
      handleDirection(direction);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDirection]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Use the directional pad for tile movement"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 4, repeat: Infinity }}
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
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo</span>
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
                  <strong>{state.score}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Best</span>
                  <strong>{bestScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Moves</span>
                  <strong>{state.moves}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Top Tile</span>
                  <strong>{maxTile}</strong>
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

      <section className="solo-2048-shell">
        <div className="solo-2048-board" role="grid" aria-label="2048 board">
          {state.board.map((value, index) => (
            <div
              key={index}
              role="gridcell"
              className={classnames(
                'solo-2048-tile',
                value === 0 && 'solo-2048-tile-empty',
                value > 0 && `solo-2048-tile-${Math.min(value, 4096)}`
              )}
            >
              {value > 0 ? value : ''}
            </div>
          ))}
        </div>

        <p className="solo-2048-message">
          {state.isGameOver
            ? state.hasWon
              ? 'Run complete. You reached 2048 and ran out of moves.'
              : 'No moves left. Start a new run and try again.'
            : state.hasWon
              ? '2048 reached. Keep merging for a bigger score.'
              : 'Use arrow keys, WASD, or the adaptive controller D-pad to slide tiles.'}
        </p>
      </section>
    </>
  );
}
