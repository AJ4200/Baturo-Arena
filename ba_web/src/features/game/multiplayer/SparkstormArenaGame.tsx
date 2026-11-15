'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AiOutlineThunderbolt,
  AiOutlineTrophy,
  AiOutlineWifi,
} from 'react-icons/ai';
import {
  AdaptiveControllerOverlay,
  type ControllerSection,
} from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  GameMode,
  MatchResultEvent,
  PlayerProfile,
} from '@/types/game';

type Direction = 'up' | 'down' | 'left' | 'right';

type SparkstormPlayer = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  x: number;
  y: number;
  score: number;
  energy: number;
  connected: boolean;
};

type SparkstormState = {
  matchId: string;
  phase: 'waiting' | 'countdown' | 'playing' | 'finished';
  deadline: number | null;
  serverNow: number;
  durationMs: number;
  targetScore: number;
  winnerId: string | null;
  lastEvent: string;
  sparks: Array<{ x: number; y: number }>;
  players: SparkstormPlayer[];
};

type Notification = {
  id: string;
  type: 'join' | 'leave';
  playerName: string;
  connectedCount: number;
  totalCount: number;
};

type SparkstormArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  roomCode?: string | null;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const ARENA_WIDTH = 13;
const ARENA_HEIGHT = 9;
const CELL_COUNT = ARENA_WIDTH * ARENA_HEIGHT;

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
  return token;
};

const getWsBaseUrl = (): string => API_BASE_URL.replace(/^http/i, 'ws');

const getKeyDirection = (key: string): Direction | null => {
  const normalized = key.toLowerCase();
  if (normalized === 'arrowup' || normalized === 'w') return 'up';
  if (normalized === 'arrowdown' || normalized === 's') return 'down';
  if (normalized === 'arrowleft' || normalized === 'a') return 'left';
  if (normalized === 'arrowright' || normalized === 'd') return 'right';
  return null;
};

export function SparkstormArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SparkstormArenaGameProps) {
  const [gameState, setGameState] = useState<SparkstormState | null>(null);
  const [connectionLabel, setConnectionLabel] = useState('Connecting');
  const [clockNow, setClockNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationDockVisible, setIsNotificationDockVisible] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const directionRef = useRef<Direction | null>(null);
  const pressedDirectionsRef = useRef<Direction[]>([]);
  const reportedResultRef = useRef<string | null>(null);
  const gameLabel = formatGameName('sparkstorm', gameDefinitions);

  const sendInput = useCallback((direction: Direction | null, boost = false) => {
    directionRef.current = direction;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'sparkstorm-input', direction, boost }));
    }
  }, []);

  const triggerBoost = useCallback(() => {
    sendInput(directionRef.current, true);
  }, [sendInput]);

  useEffect(() => {
    const timerId = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (mode !== 'online') {
      setConnectionLabel('Online room required');
      return;
    }
    if (!roomCode) {
      setConnectionLabel('Room code required');
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setConnectionLabel('Sign-in required');
      return;
    }

    let cancelled = false;
    let retryTimerId: number | undefined;
    const connect = () => {
      if (cancelled) return;
      const socket = new WebSocket(
        `${getWsBaseUrl()}/ws/sparkstorm?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`
      );
      socketRef.current = socket;
      socket.onopen = () => {
        setConnectionLabel('Arena connected');
        socket.send(JSON.stringify({
          type: 'sparkstorm-input',
          direction: directionRef.current,
          boost: false,
        }));
      };
      socket.onclose = () => {
        setConnectionLabel('Arena disconnected — reconnecting');
        if (!cancelled) {
          retryTimerId = window.setTimeout(connect, 1500);
        }
      };
      socket.onerror = () => setConnectionLabel('Connection error — reconnecting');
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as (SparkstormState & { type?: string }) | {
            type: string;
            eventType: string;
            playerName: string;
            connectedCount: number;
            totalCount: number;
          };
          if (payload.type === 'sparkstorm-state') {
            setServerOffset(payload.serverNow - Date.now());
            setGameState(payload as SparkstormState);
          } else if (payload.type === 'sparkstorm-event') {
            const eventData = payload as any;
            const notifId = `${Date.now()}-${Math.random()}`;
            setIsNotificationDockVisible(true);
            setNotifications((prev) => [
              ...prev,
              {
                id: notifId,
                type: eventData.eventType,
                playerName: eventData.playerName,
                connectedCount: eventData.connectedCount,
                totalCount: eventData.totalCount,
              },
            ]);
            window.setTimeout(() => {
              setNotifications((prev) => {
                const updated = prev.filter((n) => n.id !== notifId);
                if (updated.length === 0) {
                  setIsNotificationDockVisible(false);
                }
                return updated;
              });
            }, 4000);
          }
        } catch (_error) {
          setConnectionLabel('Arena update skipped');
        }
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (retryTimerId !== undefined) {
        window.clearTimeout(retryTimerId);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [mode, roomCode]);

  useEffect(() => {
    if (mode !== 'online') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = getKeyDirection(event.key);
      if (direction) {
        event.preventDefault();
        if (event.repeat) return;
        const pressed = pressedDirectionsRef.current.filter((entry) => entry !== direction);
        pressed.push(direction);
        pressedDirectionsRef.current = pressed;
        sendInput(direction);
        return;
      }
      if ((event.code === 'Space' || event.key === 'Shift') && !event.repeat) {
        event.preventDefault();
        triggerBoost();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = getKeyDirection(event.key);
      if (!direction) return;
      event.preventDefault();
      pressedDirectionsRef.current = pressedDirectionsRef.current.filter((entry) => entry !== direction);
      sendInput(pressedDirectionsRef.current[pressedDirectionsRef.current.length - 1] || null);
    };
    const clearDirections = () => {
      pressedDirectionsRef.current = [];
      sendInput(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearDirections);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearDirections);
    };
  }, [mode, sendInput, triggerBoost]);

  useEffect(() => {
    if (gameState?.phase !== 'finished') {
      reportedResultRef.current = null;
      return;
    }
    if (reportedResultRef.current === gameState.matchId) return;
    reportedResultRef.current = gameState.matchId;
    const winner = gameState.players.find((entry) => entry.id === gameState.winnerId);
    const opponents = gameState.players
      .filter((entry) => entry.id !== player.playerId)
      .map((entry) => entry.name)
      .join(', ');
    onMatchComplete({
      mode,
      gameType: 'sparkstorm',
      outcome: gameState.winnerId === player.playerId ? 'win' : gameState.winnerId ? 'loss' : 'draw',
      opponent: opponents || winner?.name || 'Sparkstorm field',
      resultId: gameState.matchId,
    });
  }, [gameState, mode, onMatchComplete, player.playerId]);

  const ownPlayer = gameState?.players.find((entry) => entry.id === player.playerId);
  const canControl = gameState?.phase === 'playing' || gameState?.phase === 'countdown';
  const timeLeftMs = gameState?.deadline
    ? Math.max(0, gameState.deadline - (clockNow + serverOffset))
    : 0;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const sortedPlayers = useMemo(
    () => [...(gameState?.players || [])].sort((left, right) => right.score - left.score),
    [gameState?.players]
  );
  const playersByCell = useMemo(() => {
    const positions = new Map<string, SparkstormPlayer[]>();
    (gameState?.players || []).forEach((entry) => {
      const key = `${entry.x}:${entry.y}`;
      const current = positions.get(key) || [];
      current.push(entry);
      positions.set(key, current);
    });
    return positions;
  }, [gameState?.players]);
  const sparkCells = useMemo(
    () => new Set((gameState?.sparks || []).map((spark) => `${spark.x}:${spark.y}`)),
    [gameState?.sparks]
  );

  const setDirection = (direction: Direction) => sendInput(direction);
  const stopMoving = () => sendInput(null);
  const restartMatch = () => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'sparkstorm-rematch' }));
    }
  };
  const controllerSections: ControllerSection[] = [
    {
      key: 'sparkstorm-dpad',
      title: 'Move together',
      subtitle: 'Hold a direction to glide. Arrow keys or WASD work too.',
      layout: 'dpad',
      buttons: [
        {
          key: 'move-up',
          label: 'Move up',
          icon: <AiOutlineArrowUp />,
          onPointerDown: () => setDirection('up'),
          onPointerUp: stopMoving,
          slot: 'up',
          disabled: !canControl,
        },
        {
          key: 'move-left',
          label: 'Move left',
          icon: <AiOutlineArrowLeft />,
          onPointerDown: () => setDirection('left'),
          onPointerUp: stopMoving,
          slot: 'left',
          disabled: !canControl,
        },
        {
          key: 'boost',
          label: `Dash (${ownPlayer?.energy || 0})`,
          icon: <AiOutlineThunderbolt />,
          onClick: triggerBoost,
          slot: 'center',
          disabled: !canControl || (ownPlayer?.energy || 0) <= 0,
        },
        {
          key: 'move-right',
          label: 'Move right',
          icon: <AiOutlineArrowRight />,
          onPointerDown: () => setDirection('right'),
          onPointerUp: stopMoving,
          slot: 'right',
          disabled: !canControl,
        },
        {
          key: 'move-down',
          label: 'Move down',
          icon: <AiOutlineArrowDown />,
          onPointerDown: () => setDirection('down'),
          onPointerUp: stopMoving,
          slot: 'down',
          disabled: !canControl,
        },
      ],
    },
    {
      key: 'sparkstorm-match',
      title: 'Match',
      layout: 'row',
      buttons: [
        {
          key: 'rematch',
          label: 'Restart match',
          icon: <AiOutlineReload />,
          onClick: restartMatch,
          disabled: gameState?.phase !== 'finished',
        },
      ],
    },
  ];

  const phaseLabel =
    gameState?.phase === 'playing'
      ? 'All runners live'
      : gameState?.phase === 'countdown'
        ? `Starting in ${secondsLeft}`
        : gameState?.phase === 'finished'
          ? 'Arena closed'
          : 'Waiting for runners';

  return (
    <>
      <h1 className="game-screen-title">{gameLabel}</h1>

      <motion.div
        className={`sparkstorm-notification-dock${isNotificationDockVisible ? ' visible' : ''}`}
        initial={{ opacity: 0, y: -20 }}
        animate={isNotificationDockVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: isNotificationDockVisible ? 'auto' : 'none' }}
      >
        <div className="sparkstorm-notification-dock-header">
          <span className="sparkstorm-notification-dock-title">Players</span>
          <button
            className="sparkstorm-notification-dock-close"
            type="button"
            onClick={() => setIsNotificationDockVisible(false)}
            aria-label="Close notifications"
          >
            ✕
          </button>
        </div>
        <div className="sparkstorm-notification-dock-content">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              className={`sparkstorm-notification sparkstorm-notification-${notif.type}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <span className="sparkstorm-notification-icon">
                {notif.type === 'join' ? '✓' : '✗'}
              </span>
              <span className="sparkstorm-notification-text">
                <strong>{notif.playerName}</strong>
                <small>{notif.type === 'join' ? 'joined' : 'left'}</small>
              </span>
              <span className="sparkstorm-notification-count">
                {notif.connectedCount}/{notif.totalCount}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <AdaptiveControllerOverlay
        title="Sparkstorm Controls"
        subtitle="Move and dash at the same time as everyone else"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root sparkstorm-float-root"
        animate={enableAnimations ? { y: [4, -4, 4] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card sparkstorm-info-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand Sparkstorm info"
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title">
                  <AiOutlineInfoCircle className="room-float-title-icon" /> Arena Brief
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse Sparkstorm info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Runner</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Sparks</span><strong>{ownPlayer?.score || 0}/{gameState?.targetScore || 10}</strong></div>
                <div className="solo-float-stat"><span>Dash charge</span><strong>{ownPlayer?.energy || 0}</strong></div>
                <div className="solo-float-stat"><span>Match</span><strong>{phaseLabel}</strong></div>
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

      <main className="sparkstorm-root">
        <header className="sparkstorm-command">
          <div>
            <span className="sparkstorm-connection"><AiOutlineWifi /> {connectionLabel}</span>
            <h2>{gameState?.phase === 'finished' ? 'Storm over' : phaseLabel}</h2>
            <p>{gameState?.lastEvent || 'Linking to the simultaneous spark arena...'}</p>
          </div>
          <div className="sparkstorm-command-actions">
            <button type="button" onClick={onToggleMusic}><AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}</button>
            <button type="button" onClick={onLeave}>Leave Arena</button>
          </div>
        </header>

        <section className="sparkstorm-scoreboard" aria-label="Live runner scores">
          {sortedPlayers.map((entry, index) => (
            <article
              key={entry.id}
              className={`sparkstorm-runner${entry.id === player.playerId ? ' is-you' : ''}`}
              style={{ '--spark-player': entry.color } as React.CSSProperties}
            >
              <span className="sparkstorm-rank">{index + 1}</span>
              <span className="sparkstorm-runner-copy">
                <strong>{entry.name}</strong>
                <small>{entry.connected ? `Runner ${entry.symbol}` : 'Reconnecting'}</small>
              </span>
              <strong className="sparkstorm-score">{entry.score}<small> / {gameState?.targetScore || 10}</small></strong>
              <span className="sparkstorm-energy" aria-label={`${entry.energy} dash charges`}>
                <AiOutlineThunderbolt /> {entry.energy}
              </span>
            </article>
          ))}
        </section>

        <section className="sparkstorm-field-shell" aria-label="Sparkstorm live arena">
          <div className="sparkstorm-arena">
            {Array.from({ length: CELL_COUNT }, (_, index) => {
              const x = index % ARENA_WIDTH;
              const y = Math.floor(index / ARENA_WIDTH);
              const cellKey = `${x}:${y}`;
              const cellPlayers = playersByCell.get(cellKey) || [];
              const hasSpark = sparkCells.has(cellKey);
              return (
                <div
                  key={cellKey}
                  className={`sparkstorm-cell${hasSpark ? ' has-spark' : ''}${cellPlayers.length ? ' has-runner' : ''}`}
                  style={{ gridColumn: x + 1, gridRow: y + 1 }}
                  aria-label={`Arena tile ${x + 1}, ${y + 1}${hasSpark ? ', spark' : ''}`}
                >
                  {hasSpark ? <span className="sparkstorm-pickup" aria-hidden="true">✦</span> : null}
                  {cellPlayers.map((entry) => (
                    <i
                      key={entry.id}
                      className={`sparkstorm-token${entry.id === player.playerId ? ' is-you' : ''}`}
                      style={{ '--spark-player': entry.color } as React.CSSProperties}
                      title={`${entry.name}: ${entry.score} sparks`}
                    >
                      {entry.symbol}
                    </i>
                  ))}
                </div>
              );
            })}
            <div className="sparkstorm-hud">
              <span className="sparkstorm-hud-star">✦</span>
              <small>SPARKSTORM</small>
              <strong>
                {gameState?.phase === 'playing'
                  ? `${secondsLeft}s`
                  : gameState?.phase === 'countdown'
                    ? `${secondsLeft}`
                    : gameState?.phase === 'finished'
                      ? 'DONE'
                      : 'READY'}
              </strong>
              <span className="sparkstorm-clock">
                <i style={{ transform: `scaleX(${Math.min(1, timeLeftMs / (gameState?.durationMs || 60000))})` }} />
              </span>
            </div>
          </div>
          <div className="sparkstorm-touch-hint">
            Hold a direction and dash whenever you have charge. Everyone moves at once!
          </div>
        </section>

        <footer className="sparkstorm-rules">
          <span><AiOutlineArrowUp /> Hold WASD or arrows to steer.</span>
          <span><AiOutlineThunderbolt /> Space / Shift / Dash spends one charge for a double move.</span>
          <span>Collect ten sparks or lead when the 60-second storm ends.</span>
        </footer>

        {gameState?.phase === 'finished' ? (
          <div className="sparkstorm-finale">
            <div className="sparkstorm-finale-card">
              <AiOutlineTrophy />
              <span>{gameState.winnerId === player.playerId ? 'STORM CHAMPION' : gameState.winnerId ? 'ARENA COMPLETE' : 'DEAD HEAT'}</span>
              <h2>{gameState.players.find((entry) => entry.id === gameState.winnerId)?.name || 'It is a tie!'}</h2>
              <p>{gameState.lastEvent}</p>
              <div>
                <button type="button" onClick={restartMatch}><AiOutlineReload /> Storm again</button>
                <button type="button" onClick={onLeave}>Leave Arena</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
