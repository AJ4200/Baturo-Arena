'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineDrag,
  AiOutlineFlag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloMinesweeperGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Tile = {
  isMine: boolean;
  adjacentMines: number;
  isRevealed: boolean;
  isFlagged: boolean;
};

type BoardStatus = 'idle' | 'playing' | 'won' | 'lost';

type MinesweeperState = {
  tiles: Tile[];
  status: BoardStatus;
  mineCount: number;
  revealedSafeCount: number;
  flagMode: boolean;
  startedAt: number | null;
};

const ROWS = 9;
const COLUMNS = 9;
const TILE_COUNT = ROWS * COLUMNS;
const MINE_COUNT = 10;

const getCellIndex = (row: number, column: number) => row * COLUMNS + column;

const createBlankTile = (): Tile => ({
  isMine: false,
  adjacentMines: 0,
  isRevealed: false,
  isFlagged: false,
});

const createBlankBoard = (): Tile[] => Array.from({ length: TILE_COUNT }, () => createBlankTile());

const getNeighborIndexes = (index: number): number[] => {
  const row = Math.floor(index / COLUMNS);
  const column = index % COLUMNS;
  const indexes: number[] = [];

  for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
    for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
      if (rowStep === 0 && columnStep === 0) {
        continue;
      }

      const nextRow = row + rowStep;
      const nextColumn = column + columnStep;
      if (
        nextRow < 0 ||
        nextRow >= ROWS ||
        nextColumn < 0 ||
        nextColumn >= COLUMNS
      ) {
        continue;
      }

      indexes.push(getCellIndex(nextRow, nextColumn));
    }
  }

  return indexes;
};

const buildBoardWithMines = (safeStartIndex: number): Tile[] => {
  const tiles = createBlankBoard();
  const candidates = Array.from({ length: TILE_COUNT }, (_, index) => index).filter(
    (index) => index !== safeStartIndex
  );

  for (let mine = 0; mine < MINE_COUNT; mine += 1) {
    const randomCandidate = Math.floor(Math.random() * candidates.length);
    const mineIndex = candidates[randomCandidate];
    candidates.splice(randomCandidate, 1);
    tiles[mineIndex].isMine = true;
  }

  for (let index = 0; index < TILE_COUNT; index += 1) {
    if (tiles[index].isMine) {
      continue;
    }

    const adjacentMines = getNeighborIndexes(index).filter(
      (neighborIndex) => tiles[neighborIndex].isMine
    ).length;
    tiles[index].adjacentMines = adjacentMines;
  }

  return tiles;
};

const createInitialState = (): MinesweeperState => ({
  tiles: createBlankBoard(),
  status: 'idle',
  mineCount: MINE_COUNT,
  revealedSafeCount: 0,
  flagMode: false,
  startedAt: null,
});

export function SoloMinesweeperGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloMinesweeperGameProps) {
  const [state, setState] = useState<MinesweeperState>(() => createInitialState());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('minesweeper', gameDefinitions);

  const flaggedCount = useMemo(
    () => state.tiles.filter((tile) => tile.isFlagged).length,
    [state.tiles]
  );
  const minesRemaining = state.mineCount - flaggedCount;
  const safeTilesTotal = TILE_COUNT - state.mineCount;
  const safeTilesLeft = safeTilesTotal - state.revealedSafeCount;
  const boardStatusLabel =
    state.status === 'idle' ? 'Ready' : state.status === 'playing' ? 'Playing' : state.status.toUpperCase();

  const resetBoard = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setElapsedSeconds(0);
    setState(createInitialState());
  }, []);

  const controllerButtons = [
    {
      key: 'mode',
      label: state.flagMode ? 'Reveal Mode' : 'Flag Mode',
      icon: <AiOutlineFlag />,
      onClick: () =>
        setState((currentState) => ({
          ...currentState,
          flagMode: !currentState.flagMode,
        })),
    },
    { key: 'new', label: 'New Board', icon: <AiOutlineReload />, onClick: resetBoard },
    {
      key: 'giveup',
      label: 'Give Up',
      icon: <AiOutlineArrowDown />,
      onClick: () =>
        setState((currentState) => {
          if (currentState.status === 'won' || currentState.status === 'lost') {
            return currentState;
          }

          const nextTiles = currentState.tiles.map((tile) => ({ ...tile, isRevealed: true }));
          return {
            ...currentState,
            tiles: nextTiles,
            status: 'lost',
            flagMode: false,
          };
        }),
    },
  ];
  const controllerSections = [
    {
      key: 'board-actions',
      title: 'Board Actions',
      layout: 'row' as const,
      buttons: controllerButtons,
    },
  ];

  const toggleFlagAt = useCallback((index: number) => {
    setState((currentState) => {
      if (currentState.status === 'won' || currentState.status === 'lost') {
        return currentState;
      }

      const target = currentState.tiles[index];
      if (target.isRevealed) {
        return currentState;
      }

      const nextTiles = [...currentState.tiles];
      nextTiles[index] = {
        ...target,
        isFlagged: !target.isFlagged,
      };

      return {
        ...currentState,
        tiles: nextTiles,
      };
    });
  }, []);

  const revealAt = useCallback((index: number) => {
    setState((currentState) => {
      if (currentState.status === 'won' || currentState.status === 'lost') {
        return currentState;
      }

      let nextTiles = currentState.tiles.map((tile) => ({ ...tile }));
      let nextStatus: BoardStatus = currentState.status;
      let nextStartedAt = currentState.startedAt;
      let nextRevealedSafeCount = currentState.revealedSafeCount;

      if (nextStatus === 'idle') {
        nextTiles = buildBoardWithMines(index);
        nextStatus = 'playing';
        nextStartedAt = Date.now();
        nextRevealedSafeCount = 0;
      }

      const target = nextTiles[index];
      if (target.isRevealed || target.isFlagged) {
        return {
          ...currentState,
          tiles: nextTiles,
          status: nextStatus,
          startedAt: nextStartedAt,
          revealedSafeCount: nextRevealedSafeCount,
        };
      }

      if (target.isMine) {
        const minedTiles = nextTiles.map((tile) =>
          tile.isMine ? { ...tile, isRevealed: true } : tile
        );
        return {
          ...currentState,
          tiles: minedTiles,
          status: 'lost',
          startedAt: nextStartedAt,
          revealedSafeCount: nextRevealedSafeCount,
          flagMode: false,
        };
      }

      const queue: number[] = [index];
      while (queue.length > 0) {
        const currentIndex = queue.pop() as number;
        const tile = nextTiles[currentIndex];

        if (tile.isRevealed || tile.isFlagged || tile.isMine) {
          continue;
        }

        tile.isRevealed = true;
        nextRevealedSafeCount += 1;

        if (tile.adjacentMines === 0) {
          getNeighborIndexes(currentIndex).forEach((neighborIndex) => {
            const neighbor = nextTiles[neighborIndex];
            if (!neighbor.isRevealed && !neighbor.isMine) {
              queue.push(neighborIndex);
            }
          });
        }
      }

      const hasWon = nextRevealedSafeCount >= safeTilesTotal;
      if (hasWon) {
        nextTiles = nextTiles.map((tile) =>
          tile.isMine ? { ...tile, isFlagged: true } : tile
        );
      }

      return {
        ...currentState,
        tiles: nextTiles,
        status: hasWon ? 'won' : 'playing',
        startedAt: nextStartedAt,
        revealedSafeCount: nextRevealedSafeCount,
        flagMode: hasWon ? false : currentState.flagMode,
      };
    });
  }, [safeTilesTotal]);

  useEffect(() => {
    if (state.status !== 'playing' || state.startedAt === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - state.startedAt!) / 1000)));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.startedAt, state.status]);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'minesweeper',
        outcome: 'win',
        opponent: 'Minesweeper Field',
      });
      return;
    }

    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'minesweeper',
        outcome: 'loss',
        opponent: 'Minesweeper Field',
      });
    }
  }, [onMatchComplete, state.status]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Minesweeper Controller"
        subtitle="Switch between reveal and flag controls"
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
                  <strong>{boardStatusLabel}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Mines Left</span>
                  <strong>{minesRemaining}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Safe Left</span>
                  <strong>{safeTilesLeft}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{elapsedSeconds}s</strong>
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

      <section className="solo-mines-shell">
        <div className="solo-mines-board" role="grid" aria-label="Minesweeper board">
          {state.tiles.map((tile, index) => (
            <button
              key={index}
              type="button"
              role="gridcell"
              className={classnames(
                'solo-mines-cell',
                tile.isRevealed && 'solo-mines-cell-revealed',
                tile.isFlagged && !tile.isRevealed && 'solo-mines-cell-flagged',
                tile.isMine && tile.isRevealed && 'solo-mines-cell-mine',
                tile.isRevealed &&
                  !tile.isMine &&
                  tile.adjacentMines > 0 &&
                  `solo-mines-cell-num-${tile.adjacentMines}`
              )}
              onClick={() => {
                if (state.flagMode) {
                  toggleFlagAt(index);
                  return;
                }
                revealAt(index);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                toggleFlagAt(index);
              }}
            >
              {tile.isRevealed
                ? tile.isMine
                  ? 'M'
                  : tile.adjacentMines > 0
                    ? tile.adjacentMines
                    : ''
                : tile.isFlagged
                  ? 'F'
                  : ''}
            </button>
          ))}
        </div>

        <p className="solo-mines-message">
          {state.status === 'won'
            ? 'Board cleared. Perfect sweep.'
            : state.status === 'lost'
              ? 'Mine triggered. Start a new board.'
              : state.flagMode
                ? 'Tap to place/remove flags. Right-click also flags.'
                : 'Tap to reveal cells. Use adaptive controls or right-click to mark mines.'}
        </p>
        <p className="solo-mines-tip">
          <AiOutlineInfoCircle /> First reveal is always safe.
        </p>
      </section>
    </>
  );
}
