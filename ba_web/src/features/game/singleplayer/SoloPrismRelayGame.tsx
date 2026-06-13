'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
  AiOutlineWarning,
} from 'react-icons/ai';
import {
  AdaptiveControllerOverlay,
  type ControllerSection,
} from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  MatchResultEvent,
  PlayerProfile,
  PrismRelayColor,
  PrismRelayPulse,
  PrismRelayState,
} from '@/types/game';

type SoloPrismRelayGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const NODE_COUNT = 6;
const TARGET_ROUTES = 18;
const RUN_TIME_MS = 82_000;
const PULSE_WINDOW_MS = 6_000;
const BEST_SCORE_KEY = 'baturo_prism_relay_best_score';
const COLORS: PrismRelayColor[] = ['cyan', 'magenta', 'gold'];
const COLOR_LABELS: Record<PrismRelayColor, string> = {
  cyan: 'Cyan',
  magenta: 'Magenta',
  gold: 'Gold',
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createPulse = (id: number): PrismRelayPulse => ({
  id,
  color: COLORS[(id * 5 + Math.floor(id / 3)) % COLORS.length],
  volatile: id > 0 && id % 5 === 0,
});

const createInitialState = (): PrismRelayState => ({
  phase: 'running',
  rotation: 0,
  nodes: [
    { id: 'north-cyan', color: 'cyan', charge: 0 },
    { id: 'east-magenta', color: 'magenta', charge: 1 },
    { id: 'south-gold', color: 'gold', charge: 0 },
    { id: 'west-gold', color: 'gold', charge: 1 },
    { id: 'arc-cyan', color: 'cyan', charge: 0 },
    { id: 'arc-magenta', color: 'magenta', charge: 0 },
  ],
  queue: [createPulse(1), createPulse(2), createPulse(3), createPulse(4)],
  routed: 0,
  target: TARGET_ROUTES,
  integrity: 100,
  combo: 0,
  score: 0,
  timeLeftMs: RUN_TIME_MS,
  pulseWindowMs: PULSE_WINDOW_MS,
  event: 'Rotate a matching conduit to the uplink, then route the pulse.',
});

const getTopNodeIndex = (rotation: number) =>
  ((-rotation % NODE_COUNT) + NODE_COUNT) % NODE_COUNT;

const advanceQueue = (queue: PrismRelayPulse[]): PrismRelayPulse[] => {
  const lastId = queue[queue.length - 1]?.id || 0;
  return [...queue.slice(1), createPulse(lastId + 1)];
};

const formatTime = (timeMs: number) => `${Math.max(0, Math.ceil(timeMs / 1000))}s`;

export function SoloPrismRelayGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloPrismRelayGameProps) {
  const [state, setState] = useState<PrismRelayState>(() => createInitialState());
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const reportedPhaseRef = useRef<PrismRelayState['phase'] | null>(null);
  const gameLabel = formatGameName('prism-relay', gameDefinitions);
  const topNodeIndex = getTopNodeIndex(state.rotation);
  const topNode = state.nodes[topNodeIndex];
  const activePulse = state.queue[0];
  const pulseProgress = clamp((state.pulseWindowMs / PULSE_WINDOW_MS) * 100, 0, 100);
  const routeProgress = clamp((state.routed / state.target) * 100, 0, 100);
  const statusLabel =
    state.phase === 'won'
      ? 'Lattice Stable'
      : state.phase === 'lost'
        ? 'Relay Offline'
        : state.integrity <= 35
          ? 'Critical'
          : 'Routing';

  const resetGame = useCallback(() => {
    reportedPhaseRef.current = null;
    setState(createInitialState());
  }, []);

  const rotateRelay = useCallback((direction: -1 | 1) => {
    setState((current) => {
      if (current.phase !== 'running') return current;
      const rotation = current.rotation + direction;
      const selected = current.nodes[getTopNodeIndex(rotation)];
      if (!selected) return current;
      return {
        ...current,
        rotation,
        event: `${COLOR_LABELS[selected.color]} conduit aligned with the uplink.`,
      };
    });
  }, []);

  const routePulse = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'running') return current;

      const nodeIndex = getTopNodeIndex(current.rotation);
      const node = current.nodes[nodeIndex];
      const pulse = current.queue[0];
      if (!node || !pulse) return current;

      if (node.color !== pulse.color) {
        const integrity = clamp(current.integrity - (pulse.volatile ? 18 : 12), 0, 100);
        return {
          ...current,
          phase: integrity <= 0 ? 'lost' : 'running',
          integrity,
          combo: 0,
          pulseWindowMs: Math.max(900, current.pulseWindowMs - 1_200),
          event: `${COLOR_LABELS[pulse.color]} pulse rejected by the ${COLOR_LABELS[node.color]} conduit.`,
        };
      }

      const chargeGain = pulse.volatile ? 2 : 1;
      const nextCharge = node.charge + chargeGain;
      const overloaded = nextCharge >= 4;
      const nodes = current.nodes.map((entry, index) =>
        index === nodeIndex
          ? { ...entry, charge: overloaded ? 0 : nextCharge }
          : entry
      );
      const routed = current.routed + 1;
      const combo = overloaded ? 0 : current.combo + 1;
      const integrity = clamp(
        current.integrity + (overloaded ? -20 : pulse.volatile ? 2 : 1),
        0,
        100
      );
      const score =
        current.score +
        140 +
        current.combo * 24 +
        Math.round(current.pulseWindowMs / 80) +
        (pulse.volatile ? 110 : 0) -
        (overloaded ? 90 : 0);
      const phase =
        integrity <= 0 ? 'lost' : routed >= current.target ? 'won' : 'running';

      return {
        ...current,
        phase,
        nodes,
        queue: advanceQueue(current.queue),
        routed,
        integrity,
        combo,
        score,
        pulseWindowMs: PULSE_WINDOW_MS,
        event:
          phase === 'won'
            ? 'Every prism channel is synchronized. Relay lattice stable.'
            : overloaded
              ? `${COLOR_LABELS[node.color]} conduit overloaded and auto-discharged.`
              : `${COLOR_LABELS[pulse.color]} pulse routed. Combo x${combo}.`,
      };
    });
  }, []);

  const ventTopNode = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'running') return current;
      const nodeIndex = getTopNodeIndex(current.rotation);
      const node = current.nodes[nodeIndex];
      if (!node || node.charge <= 0) {
        return {
          ...current,
          event: 'The aligned conduit is already clear.',
        };
      }

      return {
        ...current,
        nodes: current.nodes.map((entry, index) =>
          index === nodeIndex ? { ...entry, charge: Math.max(0, entry.charge - 2) } : entry
        ),
        integrity: clamp(current.integrity + 3, 0, 100),
        combo: Math.max(0, current.combo - 1),
        pulseWindowMs: Math.max(700, current.pulseWindowMs - 650),
        event: `${COLOR_LABELS[node.color]} conduit vented. The pulse window tightened.`,
      };
    });
  }, []);

  useEffect(() => {
    const stored = Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
    setBestScore(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    if (state.score <= bestScore) return;
    setBestScore(state.score);
    window.localStorage.setItem(BEST_SCORE_KEY, String(state.score));
  }, [bestScore, state.score]);

  useEffect(() => {
    if (state.phase === 'running' || reportedPhaseRef.current === state.phase) return;
    reportedPhaseRef.current = state.phase;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'prism-relay',
      outcome: state.phase === 'won' ? 'win' : 'loss',
      opponent: 'Prism Lattice',
    });
  }, [onMatchComplete, state.phase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.phase !== 'running') return current;

        const timeLeftMs = Math.max(0, current.timeLeftMs - 100);
        let pulseWindowMs = current.pulseWindowMs - 100;
        let integrity = current.integrity;
        let queue = current.queue;
        let combo = current.combo;
        let event = current.event;

        if (pulseWindowMs <= 0) {
          const missedPulse = current.queue[0];
          integrity = clamp(integrity - (missedPulse?.volatile ? 18 : 11), 0, 100);
          queue = advanceQueue(current.queue);
          combo = 0;
          pulseWindowMs = PULSE_WINDOW_MS;
          event = `${missedPulse ? COLOR_LABELS[missedPulse.color] : 'Incoming'} pulse collapsed before routing.`;
        }

        const phase = timeLeftMs <= 0 || integrity <= 0 ? 'lost' : 'running';
        return {
          ...current,
          phase,
          timeLeftMs,
          pulseWindowMs,
          integrity,
          queue,
          combo,
          event:
            phase === 'lost'
              ? 'The relay lattice dropped before synchronization completed.'
              : event,
        };
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        rotateRelay(-1);
      } else if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        rotateRelay(1);
      } else if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        routePulse();
      } else if (key === 'v' || event.key === 'ArrowDown') {
        event.preventDefault();
        ventTopNode();
      } else if (key === 'r') {
        event.preventDefault();
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame, rotateRelay, routePulse, ventTopNode]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'relay-ring',
        title: 'Rotate Prism',
        subtitle: 'Align the uplink with a matching color',
        layout: 'row',
        buttons: [
          {
            key: 'rotate-left',
            label: 'Rotate Left',
            icon: <AiOutlineArrowLeft />,
            onClick: () => rotateRelay(-1),
            disabled: state.phase !== 'running',
          },
          {
            key: 'route',
            label: 'Route Pulse',
            icon: <AiOutlinePlayCircle />,
            onClick: routePulse,
            disabled: state.phase !== 'running',
          },
          {
            key: 'rotate-right',
            label: 'Rotate Right',
            icon: <AiOutlineArrowRight />,
            onClick: () => rotateRelay(1),
            disabled: state.phase !== 'running',
          },
          {
            key: 'vent',
            label: 'Vent Conduit',
            icon: <AiOutlineArrowDown />,
            onClick: ventTopNode,
            disabled: state.phase !== 'running' || topNode?.charge <= 0,
          },
        ],
      },
      {
        key: 'relay-system',
        layout: 'row',
        buttons: [
          {
            key: 'restart',
            label: 'Restart',
            icon: <AiOutlineReload />,
            onClick: resetGame,
          },
          {
            key: 'sound',
            label: isMusicMuted ? 'Unmute' : 'Mute',
            icon: <AiOutlineSound />,
            onClick: onToggleMusic,
          },
        ],
      },
    ],
    [
      isMusicMuted,
      onToggleMusic,
      resetGame,
      rotateRelay,
      routePulse,
      state.phase,
      topNode?.charge,
      ventTopNode,
    ]
  );

  return (
    <>
      <h1 className="game-screen-title">{gameLabel}</h1>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="Rotate, color-match, route, and vent before conduits overload"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.4, repeat: Infinity } : undefined}
      >
        <div
          className={`room-float-card solo-room-float-card${
            isInfoCardCollapsed ? ' room-float-card-collapsed' : ''
          }`}
        >
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand Prism Relay info"
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
                  aria-label="Collapse Prism Relay info"
                  title="Collapse game info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Status</span><strong>{statusLabel}</strong></div>
                <div className="solo-float-stat"><span>Routes</span><strong>{state.routed}/{state.target}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Integrity</span><strong>{state.integrity}%</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{formatTime(state.timeLeftMs)}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={resetGame}>
                  <AiOutlineReload /> New Run
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
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

      <section className="prism-relay-shell">
        <header className="prism-relay-hud">
          <article><span>Routes</span><strong>{state.routed}/{state.target}</strong></article>
          <article><span>Integrity</span><strong>{state.integrity}%</strong></article>
          <article><span>Combo</span><strong>x{state.combo}</strong></article>
          <article><span>Score</span><strong>{state.score}</strong></article>
          <article><span>Time</span><strong>{formatTime(state.timeLeftMs)}</strong></article>
        </header>

        <div className="prism-relay-progress" aria-label={`${state.routed} of ${state.target} pulses routed`}>
          <span style={{ width: `${routeProgress}%` }} />
        </div>

        <div className="prism-relay-board">
          <div className="prism-relay-uplink">
            <span>Uplink</span>
            <strong>{topNode ? COLOR_LABELS[topNode.color] : 'None'}</strong>
          </div>

          <div
            className="prism-relay-ring"
            style={{ '--prism-rotation': `${state.rotation * 60}deg` } as React.CSSProperties}
          >
            {state.nodes.map((node, index) => {
              const angle = index * 60 - 90;
              const isTop = index === topNodeIndex;
              return (
                <div
                  key={node.id}
                  className={classnames(
                    'prism-relay-node',
                    `prism-relay-node-${node.color}`,
                    isTop && 'prism-relay-node-active',
                    node.charge >= 3 && 'prism-relay-node-danger'
                  )}
                  style={
                    {
                      '--prism-node-angle': `${angle}deg`,
                      '--prism-node-upright-angle': `${-angle}deg`,
                      '--prism-node-counter-rotation': `${-state.rotation * 60}deg`,
                    } as React.CSSProperties
                  }
                >
                  <span>{COLOR_LABELS[node.color].slice(0, 1)}</span>
                  <small>{node.charge}/3</small>
                  <i aria-hidden="true">
                    {Array.from({ length: 3 }, (_, chargeIndex) => (
                      <b key={chargeIndex} className={chargeIndex < node.charge ? 'charged' : ''} />
                    ))}
                  </i>
                </div>
              );
            })}
            <div className="prism-relay-core">
              <AiOutlineThunderbolt />
              <strong>{state.phase === 'running' ? `${Math.round(routeProgress)}%` : statusLabel}</strong>
            </div>
          </div>

          <aside className="prism-relay-pulse-console">
            <span>Incoming Pulse</span>
            <div
              className={classnames(
                'prism-relay-active-pulse',
                activePulse && `prism-relay-pulse-${activePulse.color}`,
                activePulse?.volatile && 'prism-relay-pulse-volatile'
              )}
            >
              {activePulse?.volatile ? <AiOutlineWarning /> : <AiOutlineThunderbolt />}
              <strong>{activePulse ? COLOR_LABELS[activePulse.color] : 'Clear'}</strong>
              <small>{activePulse?.volatile ? 'Volatile +2 charge' : 'Standard +1 charge'}</small>
            </div>
            <div className="prism-relay-window">
              <span style={{ width: `${pulseProgress}%` }} />
            </div>
            <div className="prism-relay-queue">
              {state.queue.slice(1).map((pulse) => (
                <span
                  key={pulse.id}
                  className={classnames(
                    `prism-relay-pulse-${pulse.color}`,
                    pulse.volatile && 'volatile'
                  )}
                  title={`${COLOR_LABELS[pulse.color]}${pulse.volatile ? ' volatile' : ''}`}
                />
              ))}
            </div>
          </aside>
        </div>

        <div className="prism-relay-controls">
          <button type="button" onClick={() => rotateRelay(-1)} disabled={state.phase !== 'running'}>
            <AiOutlineArrowLeft /> Rotate
          </button>
          <button
            className="prism-relay-route-btn"
            type="button"
            onClick={routePulse}
            disabled={state.phase !== 'running'}
          >
            <AiOutlinePlayCircle /> Route {activePulse ? COLOR_LABELS[activePulse.color] : 'Pulse'}
          </button>
          <button type="button" onClick={() => rotateRelay(1)} disabled={state.phase !== 'running'}>
            Rotate <AiOutlineArrowRight />
          </button>
          <button type="button" onClick={ventTopNode} disabled={state.phase !== 'running' || topNode?.charge <= 0}>
            <AiOutlineArrowDown /> Vent
          </button>
        </div>

        <p className="prism-relay-event">
          {state.phase === 'running' ? <AiOutlineClockCircle /> : <AiOutlineCheckCircle />}
          {state.event}
        </p>

        {state.phase !== 'running' ? (
          <div className="prism-relay-result">
            <span>{state.phase === 'won' ? 'Synchronization complete' : 'Lattice failure'}</span>
            <h2>{state.phase === 'won' ? 'Prism Relay Stable' : 'Relay Offline'}</h2>
            <p>
              {state.phase === 'won'
                ? `Final score ${state.score}. The full spectrum is locked.`
                : `${state.routed} of ${state.target} pulses routed. Vent charged conduits before they overload.`}
            </p>
            <div>
              <button type="button" onClick={resetGame}><AiOutlineReload /> Run Again</button>
              <button type="button" onClick={onLeave}>Leave Arena</button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

export default SoloPrismRelayGame;
