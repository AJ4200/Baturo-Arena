'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineCloseCircle,
  AiOutlineDrag,
  AiOutlineFlag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloSudokuGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type SudokuPuzzle = {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  puzzle: number[];
  solution: number[];
};

type SoloSudokuState = {
  puzzle: SudokuPuzzle;
  board: number[];
  selectedCell: number | null;
  mistakes: number;
  isComplete: boolean;
  hasGivenUp: boolean;
};

const GRID_SIZE = 9;
const GRID_CELLS = GRID_SIZE * GRID_SIZE;

const parseGrid = (value: string): number[] => {
  return value
    .trim()
    .split('')
    .map((digit) => Number(digit));
};

const PUZZLES: SudokuPuzzle[] = [
  {
    id: 'sudoku-easy-1',
    difficulty: 'easy',
    puzzle: parseGrid(
      '530070000' +
        '600195000' +
        '098000060' +
        '800060003' +
        '400803001' +
        '700020006' +
        '060000280' +
        '000419005' +
        '000080079'
    ),
    solution: parseGrid(
      '534678912' +
        '672195348' +
        '198342567' +
        '859761423' +
        '426853791' +
        '713924856' +
        '961537284' +
        '287419635' +
        '345286179'
    ),
  },
  {
    id: 'sudoku-medium-1',
    difficulty: 'medium',
    puzzle: parseGrid(
      '200080300' +
        '060070084' +
        '030500209' +
        '000105408' +
        '000000000' +
        '402706000' +
        '301007040' +
        '720040060' +
        '004010003'
    ),
    solution: parseGrid(
      '245981376' +
        '169273584' +
        '837564219' +
        '976125438' +
        '513498627' +
        '482736951' +
        '391657842' +
        '728349165' +
        '654812793'
    ),
  },
  {
    id: 'sudoku-hard-1',
    difficulty: 'hard',
    puzzle: parseGrid(
      '000260701' +
        '680070090' +
        '190004500' +
        '820100040' +
        '004602900' +
        '050003028' +
        '009300074' +
        '040050036' +
        '703018000'
    ),
    solution: parseGrid(
      '435269781' +
        '682571493' +
        '197834562' +
        '826195347' +
        '374682915' +
        '951743628' +
        '519326874' +
        '248957136' +
        '763418259'
    ),
  },
];

const pickRandomPuzzle = (excludeId?: string): SudokuPuzzle => {
  const pool = PUZZLES.filter((puzzle) => puzzle.id !== excludeId);
  if (pool.length === 0) {
    return PUZZLES[0];
  }

  return pool[Math.floor(Math.random() * pool.length)];
};

const createPuzzleState = (puzzle: SudokuPuzzle): SoloSudokuState => ({
  puzzle,
  board: [...puzzle.puzzle],
  selectedCell: null,
  mistakes: 0,
  isComplete: false,
  hasGivenUp: false,
});

const createInitialState = (excludeId?: string): SoloSudokuState => {
  return createPuzzleState(pickRandomPuzzle(excludeId));
};

const createPrerenderState = (): SoloSudokuState => {
  return createPuzzleState(PUZZLES[0]);
};

const getConflictingIndexes = (board: number[]): Set<number> => {
  const conflicts = new Set<number>();

  const markDuplicates = (indexes: number[]) => {
    const seen = new Map<number, number[]>();

    indexes.forEach((index) => {
      const value = board[index];
      if (value === 0) {
        return;
      }

      const grouped = seen.get(value) || [];
      grouped.push(index);
      seen.set(value, grouped);
    });

    seen.forEach((indexesByValue) => {
      if (indexesByValue.length > 1) {
        indexesByValue.forEach((index) => conflicts.add(index));
      }
    });
  };

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const rowIndexes = Array.from({ length: GRID_SIZE }, (_, column) => row * GRID_SIZE + column);
    markDuplicates(rowIndexes);
  }

  for (let column = 0; column < GRID_SIZE; column += 1) {
    const columnIndexes = Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + column);
    markDuplicates(columnIndexes);
  }

  for (let boxRow = 0; boxRow < GRID_SIZE; boxRow += 3) {
    for (let boxColumn = 0; boxColumn < GRID_SIZE; boxColumn += 3) {
      const boxIndexes: number[] = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          boxIndexes.push((boxRow + row) * GRID_SIZE + (boxColumn + column));
        }
      }
      markDuplicates(boxIndexes);
    }
  }

  return conflicts;
};

const isCompleteBoard = (board: number[], solution: number[]): boolean => {
  for (let index = 0; index < GRID_CELLS; index += 1) {
    if (board[index] !== solution[index]) {
      return false;
    }
  }
  return true;
};

export function SoloSudokuGame({
  player,
  gameDefinitions,
  isMusicMuted,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloSudokuGameProps) {
  const [state, setState] = useState<SoloSudokuState>(() => createPrerenderState());
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('sudoku', gameDefinitions);

  const conflictIndexes = useMemo(() => getConflictingIndexes(state.board), [state.board]);
  const filledCells = useMemo(() => state.board.filter((value) => value !== 0).length, [state.board]);
  const runStatus = state.isComplete ? 'Solved' : state.hasGivenUp ? 'Revealed' : 'In Progress';

  const setCellValue = useCallback((nextValue: number) => {
    setState((currentState) => {
      if (currentState.hasGivenUp || currentState.isComplete) {
        return currentState;
      }

      const selectedCell = currentState.selectedCell;
      if (selectedCell === null) {
        return currentState;
      }

      if (currentState.puzzle.puzzle[selectedCell] !== 0) {
        return currentState;
      }

      const currentValue = currentState.board[selectedCell];
      if (currentValue === nextValue) {
        return currentState;
      }

      const nextBoard = [...currentState.board];
      nextBoard[selectedCell] = nextValue;

      const hasMistake =
        nextValue !== 0 && nextValue !== currentState.puzzle.solution[selectedCell];
      const isComplete = isCompleteBoard(nextBoard, currentState.puzzle.solution);

      return {
        ...currentState,
        board: nextBoard,
        mistakes: currentState.mistakes + (hasMistake ? 1 : 0),
        isComplete,
      };
    });
  }, []);

  const handleClearCell = useCallback(() => {
    setCellValue(0);
  }, [setCellValue]);

  const handleNewPuzzle = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setState((currentState) => createInitialState(currentState.puzzle.id));
  }, []);

  const handleGiveUp = useCallback(() => {
    setState((currentState) => {
      if (currentState.hasGivenUp || currentState.isComplete) {
        return currentState;
      }

      return {
        ...currentState,
        board: [...currentState.puzzle.solution],
        hasGivenUp: true,
        selectedCell: null,
      };
    });
  }, []);

  useEffect(() => {
    setState(createInitialState());
  }, []);

  useEffect(() => {
    if (state.isComplete && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'sudoku',
        outcome: 'win',
        opponent: `Sudoku ${state.puzzle.difficulty}`,
      });
      return;
    }

    if (state.hasGivenUp && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'sudoku',
        outcome: 'loss',
        opponent: `Sudoku ${state.puzzle.difficulty}`,
      });
    }
  }, [onMatchComplete, state.hasGivenUp, state.isComplete, state.puzzle.difficulty]);

  useEffect(() => {
    const moveSelectedCell = (rowStep: number, columnStep: number) => {
      setState((currentState) => {
        const selectedIndex = currentState.selectedCell ?? 0;
        const currentRow = Math.floor(selectedIndex / GRID_SIZE);
        const currentColumn = selectedIndex % GRID_SIZE;
        const nextRow = (currentRow + rowStep + GRID_SIZE) % GRID_SIZE;
        const nextColumn = (currentColumn + columnStep + GRID_SIZE) % GRID_SIZE;
        return {
          ...currentState,
          selectedCell: nextRow * GRID_SIZE + nextColumn,
        };
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key >= '1' && key <= '9') {
        event.preventDefault();
        setCellValue(Number(key));
        return;
      }

      if (key === 'Backspace' || key === 'Delete' || key === '0') {
        event.preventDefault();
        handleClearCell();
        return;
      }

      if (key === 'ArrowUp') {
        event.preventDefault();
        moveSelectedCell(-1, 0);
        return;
      }

      if (key === 'ArrowDown') {
        event.preventDefault();
        moveSelectedCell(1, 0);
        return;
      }

      if (key === 'ArrowLeft') {
        event.preventDefault();
        moveSelectedCell(0, -1);
        return;
      }

      if (key === 'ArrowRight') {
        event.preventDefault();
        moveSelectedCell(0, 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClearCell, setCellValue]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

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
                <span className="room-float-title">{gameLabel} Solo</span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse game info"
                  title="Collapse game info"
                >
                  <AiOutlineInfoCircle />
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
                  <span>Difficulty</span>
                  <strong>{state.puzzle.difficulty}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Filled</span>
                  <strong>
                    {filledCells}/{GRID_CELLS}
                  </strong>
                </div>
                <div className="solo-float-stat">
                  <span>Mistakes</span>
                  <strong>{state.mistakes}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className={classnames('room-float-action-btn')} type="button" onClick={handleNewPuzzle}>
                  <AiOutlineReload /> New Puzzle
                </button>
                <button className={classnames('room-float-action-btn')} type="button" onClick={handleClearCell}>
                  <AiOutlineCloseCircle /> Clear Cell
                </button>
                <button
                  className={classnames('room-float-action-btn')}
                  type="button"
                  disabled={state.hasGivenUp || state.isComplete}
                  onClick={handleGiveUp}
                >
                  <AiOutlineFlag /> Give Up
                </button>
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className={classnames('room-float-action-btn', 'room-float-action-btn-danger')} type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="solo-sudoku-shell">
        <div className="solo-sudoku-board" role="grid" aria-label="Sudoku board">
          {state.board.map((value, index) => {
            const row = Math.floor(index / GRID_SIZE);
            const column = index % GRID_SIZE;
            const isFixed = state.puzzle.puzzle[index] !== 0;
            const isSelected = state.selectedCell === index;
            const isConflict = conflictIndexes.has(index);
            const isCorrect =
              !isFixed && value !== 0 && value === state.puzzle.solution[index];

            return (
              <button
                key={index}
                type="button"
                role="gridcell"
                aria-label={`Cell ${row + 1}-${column + 1}`}
                className={classnames(
                  'solo-sudoku-cell',
                  isFixed && 'solo-sudoku-cell-fixed',
                  isSelected && 'solo-sudoku-cell-selected',
                  isConflict && 'solo-sudoku-cell-conflict',
                  isCorrect && 'solo-sudoku-cell-correct'
                )}
                style={{
                  borderTopWidth: row % 3 === 0 ? 3 : 1,
                  borderLeftWidth: column % 3 === 0 ? 3 : 1,
                  borderRightWidth: column === GRID_SIZE - 1 ? 3 : 1,
                  borderBottomWidth: row === GRID_SIZE - 1 ? 3 : 1,
                }}
                onClick={() => {
                  setState((currentState) => ({
                    ...currentState,
                    selectedCell: index,
                  }));
                }}
              >
                {value === 0 ? '' : value}
              </button>
            );
          })}
        </div>

        <motion.div
          className="solo-sudoku-pad"
          animate={{ y: [6, -6, 6] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              className="solo-sudoku-pad-btn"
              type="button"
              onClick={() => setCellValue(value)}
            >
              {value}
            </button>
          ))}
          <button className="solo-sudoku-pad-btn solo-sudoku-pad-clear" type="button" onClick={handleClearCell}>
            Clear
          </button>
        </motion.div>

        <p className="solo-sudoku-message">
          {state.isComplete
            ? 'Solved. Great run.'
            : state.hasGivenUp
              ? 'Puzzle revealed. Start a new one when you are ready.'
              : 'Select a cell, then use 1-9, Backspace, or the pad.'}
        </p>
      </section>
    </>
  );
}
