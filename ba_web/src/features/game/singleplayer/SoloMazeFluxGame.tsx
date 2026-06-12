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
  AiOutlinePauseCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type Direction = 'up' | 'down' | 'left' | 'right';
type RunStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost';

type Position = {
  x: number;
  y: number;
};

type Drone = Position & {
  id: number;
  direction: Direction;
  spawn: Position;
};

type MazeFluxState = {
  status: RunStatus;
  player: Position;
  direction: Direction | null;
  queuedDirection: Direction | null;
  drones: Drone[];
  sparks: string[];
  surgeNodes: string[];
  surgeTicks: number;
  invulnerableTicks: number;
  score: number;
  lives: number;
  tick: number;
};

type SoloMazeFluxGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const MAZE = [
  '#################',
  '#P...S#...#....D#',
  '#.##.#.#.#.#.##.#',
  '#....#..S..#....#',
  '###.###.#.###.###',
  '#...#...#...#...#',
  '#.#.#.#####.#.#.#',
  '#.#...#D.D#...#.#',
  '#.###.#...#.###.#',
  '#...#...#...#...#',
  '###.#.#####.#.###',
  '#...#...S...#...#',
  '#.#####.#.#####.#',
  '#D.....S#......S#',
  '#################',
] as const;

const ROWS = MAZE.length;
const COLUMNS = MAZE[0].length;
const STEP_MS = 145;
const SURGE_TICKS = 42;
const RESPAWN_GRACE_TICKS = 10;
const BEST_SCORE_STORAGE_KEY = 'baturo_maze_flux_best_score';

const DIRECTIONS: Direction[] = ['up', 'left', 'down', 'right'];
const DIRECTION_DELTAS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const positionKey = ({ x, y }: Position): string => `${x},${y}`;
const samePosition = (left: Position, right: Position): boolean =>
  left.x === right.x && left.y === right.y;
const distanceBetween = (left: Position, right: Position): number =>
  Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

const findMapPositions = (token: string): Position[] => {
  const positions: Position[] = [];
  MAZE.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === token) positions.push({ x, y });
    });
  });
  return positions;
};

const PLAYER_SPAWN = findMapPositions('P')[0] ?? { x: 1, y: 1 };
const DRONE_SPAWNS = findMapPositions('D');

const isOpenCell = ({ x, y }: Position): boolean =>
  y >= 0 && y < ROWS && x >= 0 && x < COLUMNS && MAZE[y][x] !== '#';

const movePosition = (position: Position, direction: Direction): Position => {
  const delta = DIRECTION_DELTAS[direction];
  return { x: position.x + delta.x, y: position.y + delta.y };
};

const canMove = (position: Position, direction: Direction): boolean =>
  isOpenCell(movePosition(position, direction));

const createInitialState = (): MazeFluxState => ({
  status: 'ready',
  player: { ...PLAYER_SPAWN },
  direction: null,
  queuedDirection: null,
  drones: DRONE_SPAWNS.map((spawn, index) => ({
    id: index,
    ...spawn,
    spawn: { ...spawn },
    direction: index % 2 === 0 ? 'left' : 'right',
  })),
  sparks: findMapPositions('.').map(positionKey),
  surgeNodes: findMapPositions('S').map(positionKey),
  surgeTicks: 0,
  invulnerableTicks: 0,
  score: 0,
  lives: 3,
  tick: 0,
});

const getDroneTarget = (
  drone: Drone,
  player: Position,
  playerDirection: Direction | null,
  tick: number
): Position => {
  if (drone.id === 0) return player;

  if (drone.id === 1 && playerDirection) {
    const delta = DIRECTION_DELTAS[playerDirection];
    return {
      x: player.x + delta.x * 3,
      y: player.y + delta.y * 3,
    };
  }

  return tick % 18 < 12 ? player : { x: COLUMNS - 2, y: ROWS - 2 };
};

const moveDrone = (
  drone: Drone,
  player: Position,
  playerDirection: Direction | null,
  surgeActive: boolean,
  tick: number
): Drone => {
  const available = DIRECTIONS.filter((direction) => canMove(drone, direction));
  const forwardOptions =
    available.length > 1
      ? available.filter((direction) => direction !== OPPOSITE_DIRECTION[drone.direction])
      : available;
  const options = forwardOptions.length ? forwardOptions : available;
  if (!options.length) return drone;

  const target = getDroneTarget(drone, player, playerDirection, tick);
  const ranked = [...options].sort((leftDirection, rightDirection) => {
    const leftDistance = distanceBetween(movePosition(drone, leftDirection), target);
    const rightDistance = distanceBetween(movePosition(drone, rightDirection), target);
    if (leftDistance === rightDistance) {
      return (
        (DIRECTIONS.indexOf(leftDirection) + tick + drone.id) % DIRECTIONS.length -
        (DIRECTIONS.indexOf(rightDirection) + tick + drone.id) % DIRECTIONS.length
      );
    }
    return surgeActive ? rightDistance - leftDistance : leftDistance - rightDistance;
  });

  const direction = ranked[0];
  return {
    ...drone,
    ...movePosition(drone, direction),
    direction,
  };
};

export function SoloMazeFluxGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloMazeFluxGameProps) {
  const [state, setState] = useState<MazeFluxState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('maze-flux', gameDefinitions);

  const setDirection = useCallback((direction: Direction) => {
    setState((current) => ({
      ...current,
      status:
        current.status === 'ready' || current.status === 'paused'
          ? 'playing'
          : current.status,
      queuedDirection: direction,
    }));
  }, []);

  const restart = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    setState(createInitialState());
  }, []);

  const startRun = useCallback(() => {
    setState((current) => ({
      ...current,
      status: current.status === 'ready' ? 'playing' : current.status,
    }));
  }, []);

  const togglePause = useCallback(() => {
    setState((current) => {
      if (current.status === 'won' || current.status === 'lost') return current;
      return {
        ...current,
        status: current.status === 'playing' ? 'paused' : 'playing',
      };
    });
  }, []);

  useEffect(() => {
    const savedBest = Number(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0);
    if (Number.isFinite(savedBest)) setBestScore(savedBest);
  }, []);

  useEffect(() => {
    if (state.score <= bestScore) return;
    setBestScore(state.score);
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.score));
  }, [bestScore, state.score]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setState((current) => {
        if (current.status !== 'playing') return current;

        const direction =
          current.queuedDirection && canMove(current.player, current.queuedDirection)
            ? current.queuedDirection
            : current.direction && canMove(current.player, current.direction)
              ? current.direction
              : null;
        const nextPlayer = direction ? movePosition(current.player, direction) : current.player;
        const nextKey = positionKey(nextPlayer);
        const collectedSpark = current.sparks.includes(nextKey);
        const collectedSurge = current.surgeNodes.includes(nextKey);
        let sparks = collectedSpark
          ? current.sparks.filter((key) => key !== nextKey)
          : current.sparks;
        let surgeNodes = collectedSurge
          ? current.surgeNodes.filter((key) => key !== nextKey)
          : current.surgeNodes;
        let score = current.score + (collectedSpark ? 10 : 0) + (collectedSurge ? 75 : 0);
        let surgeTicks = collectedSurge
          ? SURGE_TICKS
          : Math.max(0, current.surgeTicks - 1);
        const invulnerableTicks = Math.max(0, current.invulnerableTicks - 1);

        const shouldMoveDrones = current.tick % 2 === 0;
        let drones = shouldMoveDrones
          ? current.drones.map((drone) =>
              moveDrone(
                drone,
                nextPlayer,
                direction,
                surgeTicks > 0,
                current.tick
              )
            )
          : current.drones;

        const collidedDroneIds = drones
          .filter((drone, index) => {
            const crossedPaths =
              samePosition(current.drones[index], nextPlayer) &&
              samePosition(drone, current.player);
            return samePosition(drone, nextPlayer) || crossedPaths;
          })
          .map((drone) => drone.id);

        if (collidedDroneIds.length && surgeTicks > 0) {
          score += collidedDroneIds.length * 200;
          drones = drones.map((drone) =>
            collidedDroneIds.includes(drone.id)
              ? { ...drone, ...drone.spawn, direction: drone.id % 2 === 0 ? 'left' : 'right' }
              : drone
          );
        } else if (collidedDroneIds.length && invulnerableTicks === 0) {
          const lives = current.lives - 1;
          if (lives <= 0) {
            return {
              ...current,
              player: nextPlayer,
              drones,
              sparks,
              surgeNodes,
              score,
              lives: 0,
              surgeTicks: 0,
              status: 'lost',
              tick: current.tick + 1,
            };
          }

          return {
            ...current,
            player: { ...PLAYER_SPAWN },
            direction: null,
            queuedDirection: null,
            drones: current.drones.map((drone) => ({
              ...drone,
              ...drone.spawn,
              direction: drone.id % 2 === 0 ? 'left' : 'right',
            })),
            sparks,
            surgeNodes,
            score,
            lives,
            surgeTicks: 0,
            invulnerableTicks: RESPAWN_GRACE_TICKS,
            tick: current.tick + 1,
          };
        }

        const status = sparks.length === 0 && surgeNodes.length === 0 ? 'won' : 'playing';
        return {
          ...current,
          status,
          player: nextPlayer,
          direction,
          queuedDirection: current.queuedDirection,
          drones,
          sparks,
          surgeNodes,
          surgeTicks,
          invulnerableTicks,
          score,
          tick: current.tick + 1,
        };
      });
    }, STEP_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'maze-flux',
        outcome: 'win',
        opponent: 'Scanner Grid',
      });
    } else if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'maze-flux',
        outcome: 'loss',
        opponent: 'Scanner Grid',
      });
    }
  }, [onMatchComplete, state.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const direction =
        event.key === 'ArrowUp' || key === 'w'
          ? 'up'
          : event.key === 'ArrowDown' || key === 's'
            ? 'down'
            : event.key === 'ArrowLeft' || key === 'a'
              ? 'left'
              : event.key === 'ArrowRight' || key === 'd'
                ? 'right'
                : null;
      if (direction) {
        event.preventDefault();
        setDirection(direction);
      } else if (!event.repeat && (key === 'p' || event.code === 'Space')) {
        event.preventDefault();
        togglePause();
      } else if (!event.repeat && key === 'r') {
        restart();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restart, setDirection, togglePause]);

  const controllerSections = [
    {
      key: 'movement',
      title: 'Route Core',
      layout: 'dpad' as const,
      buttons: [
        { key: 'up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => setDirection('up') },
        { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => setDirection('left') },
        { key: 'down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => setDirection('down') },
        { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => setDirection('right') },
      ],
    },
    {
      key: 'actions',
      title: 'Grid Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'pause',
          label: state.status === 'paused' ? 'Resume' : 'Pause',
          icon: state.status === 'paused' ? <AiOutlinePlayCircle /> : <AiOutlinePauseCircle />,
          onClick: togglePause,
        },
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: restart },
      ],
    },
  ];

  const remaining = state.sparks.length + state.surgeNodes.length;
  const statusLabel = useMemo(() => {
    if (state.status === 'ready') return 'Ready';
    if (state.status === 'playing') return state.surgeTicks > 0 ? 'Surge Active' : 'Routing';
    if (state.status === 'paused') return 'Paused';
    if (state.status === 'won') return 'Grid Cleared';
    return 'Signal Lost';
  }, [state.status, state.surgeTicks]);

  return (
    <>
      <div className="maze-flux-title-wrap">
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Maze Flux Controller"
        subtitle="Route the core through the circuit"
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
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo</span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse game info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Status</span><strong>{statusLabel}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Lives</span><strong>{state.lives}</strong></div>
                <div className="solo-float-stat"><span>Signals</span><strong>{remaining}</strong></div>
              </div>

              <div className="solo-float-actions">
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

      <section className="maze-flux-shell">
        <div className="maze-flux-hud">
          <div><span>Score</span><strong>{state.score}</strong></div>
          <div><span>Best</span><strong>{bestScore}</strong></div>
          <div><span>Lives</span><strong>{state.lives} cores</strong></div>
          <div><span>Signals</span><strong>{remaining}</strong></div>
        </div>

        <div
          className={classnames(
            'maze-flux-board',
            state.surgeTicks > 0 && 'maze-flux-board-surge',
            !enableAnimations && 'maze-flux-board-static'
          )}
          role="grid"
          aria-label="Maze Flux circuit grid"
          style={{
            gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {MAZE.flatMap((row, y) =>
            [...row].map((cell, x) => {
              const key = positionKey({ x, y });
              const drone = state.drones.find((candidate) => candidate.x === x && candidate.y === y);
              const hasPlayer = state.player.x === x && state.player.y === y;
              const hasSpark = state.sparks.includes(key);
              const hasSurge = state.surgeNodes.includes(key);
              return (
                <div
                  key={key}
                  className={classnames(
                    'maze-flux-cell',
                    cell === '#' ? 'maze-flux-wall' : 'maze-flux-path'
                  )}
                  role="gridcell"
                >
                  {hasSpark ? <span className="maze-flux-spark" aria-hidden="true" /> : null}
                  {hasSurge ? <span className="maze-flux-surge-node" aria-hidden="true" /> : null}
                  {drone ? (
                    <span
                      className={classnames(
                        'maze-flux-drone',
                        `maze-flux-drone-${drone.id + 1}`,
                        state.surgeTicks > 0 && 'maze-flux-drone-disrupted'
                      )}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                  ) : null}
                  {hasPlayer ? (
                    <span
                      className={classnames(
                        'maze-flux-core',
                        state.invulnerableTicks > 0 && 'maze-flux-core-invulnerable'
                      )}
                      style={{ '--maze-flux-heading': `${DIRECTIONS.indexOf(state.direction || 'right') * 90 - 90}deg` } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                  ) : null}
                </div>
              );
            })
          )}

          {state.status !== 'playing' ? (
            <div className="maze-flux-overlay">
              <div className="maze-flux-message">
                <span>{statusLabel}</span>
                <h2>
                  {state.status === 'won'
                    ? 'Circuit Restored'
                    : state.status === 'lost'
                      ? 'Core Offline'
                      : state.status === 'paused'
                        ? 'Route Paused'
                        : 'Enter the Flux'}
                </h2>
                <p>
                  {state.status === 'won'
                    ? `All signals recovered with ${state.score} points.`
                    : state.status === 'lost'
                      ? 'The scanner grid caught the core. Reboot and reroute.'
                      : 'Collect every circuit spark. Surge nodes disrupt scanner drones for a short window.'}
                </p>
                <div>
                  <button
                    type="button"
                    onClick={
                      state.status === 'paused'
                        ? togglePause
                        : state.status === 'ready'
                          ? startRun
                          : restart
                    }
                  >
                    {state.status === 'paused' || state.status === 'ready' ? <AiOutlinePlayCircle /> : <AiOutlineReload />}
                    {state.status === 'paused' ? 'Resume' : state.status === 'ready' ? 'Start Run' : 'Reboot'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="maze-flux-help">
          Arrow keys or WASD route the energy core. Collect sparks, trigger surge nodes, and avoid angular scanner drones.
        </p>
      </section>
    </>
  );
}
