'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowRight,
  AiOutlineArrowDown,
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

type RuneRallyPlayer = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  position: number;
  score: number;
  charge: number;
  connected: boolean;
};

type RuneRallyState = {
  matchId: string;
  phase: 'waiting' | 'playing' | 'finished';
  targetScore: number;
  maxTurns: number;
  turnNumber: number;
  turnPlayerId: string | null;
  deadline: number | null;
  serverNow: number;
  winnerId: string | null;
  relics: number[];
  lastEvent: string;
  players: RuneRallyPlayer[];
};

type Notification = {
  id: string;
  type: 'join' | 'leave';
  playerName: string;
  connectedCount: number;
  totalCount: number;
};

type RuneRallyArenaGameProps = {
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

const TRACK_COORDINATES = [
  ...Array.from({ length: 7 }, (_, column) => [0, column] as const),
  ...Array.from({ length: 6 }, (_, index) => [index + 1, 6] as const),
  ...Array.from({ length: 6 }, (_, index) => [6, 5 - index] as const),
  ...Array.from({ length: 5 }, (_, index) => [5 - index, 0] as const),
];

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
  return token;
};

const getWsBaseUrl = (): string => API_BASE_URL.replace(/^http/i, 'ws');

export function RuneRallyArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: RuneRallyArenaGameProps) {
  const [gameState, setGameState] = useState<RuneRallyState | null>(null);
  const [connectionLabel, setConnectionLabel] = useState('Connecting');
  const [clockNow, setClockNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationDockVisible, setIsNotificationDockVisible] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reportedResultRef = useRef<string | null>(null);
  const gameLabel = formatGameName('rune-rally', gameDefinitions);

  const sendMessage = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => setClockNow(Date.now()), 200);
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
        `${getWsBaseUrl()}/ws/rune-rally?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`
      );
      socketRef.current = socket;
      socket.onopen = () => setConnectionLabel('Circuit connected');
      socket.onclose = () => {
        setConnectionLabel('Circuit disconnected — reconnecting');
        if (!cancelled) {
          retryTimerId = window.setTimeout(connect, 1500);
        }
      };
      socket.onerror = () => setConnectionLabel('Connection error — reconnecting');
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as (RuneRallyState & { type?: string }) | {
            type: string;
            eventType: string;
            playerName: string;
            connectedCount: number;
            totalCount: number;
          };
          if (payload.type === 'rune-rally-state') {
            setServerOffset(payload.serverNow - Date.now());
            setGameState(payload as RuneRallyState);
          } else if (payload.type === 'rune-rally-event') {
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
          setConnectionLabel('Game update skipped');
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
    if (gameState?.phase !== 'finished') {
      reportedResultRef.current = null;
      return;
    }
    const resultKey = gameState.winnerId || 'draw';
    if (reportedResultRef.current === resultKey) return;
    reportedResultRef.current = resultKey;
    const winner = gameState.players.find((entry) => entry.id === gameState.winnerId);
    onMatchComplete({
      mode,
      gameType: 'rune-rally',
      outcome: gameState.winnerId === player.playerId ? 'win' : gameState.winnerId ? 'loss' : 'draw',
      opponent: winner?.name || 'Rune Rally field',
      resultId: gameState.matchId,
    });
  }, [gameState, mode, onMatchComplete, player.playerId]);

  const ownPlayer = gameState?.players.find((entry) => entry.id === player.playerId);
  const currentPlayer = gameState?.players.find((entry) => entry.id === gameState.turnPlayerId);
  const isMyTurn = gameState?.phase === 'playing' && gameState.turnPlayerId === player.playerId;
  const timeLeftMs = gameState?.deadline
    ? Math.max(0, gameState.deadline - (clockNow + serverOffset))
    : 0;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const sortedPlayers = useMemo(
    () => [...(gameState?.players || [])].sort((left, right) => right.score - left.score),
    [gameState?.players]
  );
  const playersAtPosition = useMemo(() => {
    const positions = new Map<number, RuneRallyPlayer[]>();
    (gameState?.players || []).forEach((entry) => {
      const current = positions.get(entry.position) || [];
      current.push(entry);
      positions.set(entry.position, current);
    });
    return positions;
  }, [gameState?.players]);
  const relicSet = useMemo(() => new Set(gameState?.relics || []), [gameState?.relics]);

  const sendAction = (action: 'roll' | 'surge') => {
    if (isMyTurn && (action !== 'surge' || (ownPlayer?.charge || 0) >= 2)) {
      sendMessage({ type: 'rune-rally-move', action });
    }
  };

  const restartMatch = () => sendMessage({ type: 'rune-rally-rematch' });
  const controllerSections: ControllerSection[] = [
    {
      key: 'rune-rally-actions',
      title: 'Your move',
      subtitle: isMyTurn ? 'Choose your pace' : `Waiting for ${currentPlayer?.name || 'the next runner'}`,
      layout: 'row',
      buttons: [
        {
          key: 'roll',
          label: 'Roll 1-4',
          icon: <AiOutlineArrowRight />,
          onClick: () => sendAction('roll'),
          disabled: !isMyTurn,
        },
        {
          key: 'surge',
          label: 'Surge 5',
          icon: <AiOutlineThunderbolt />,
          onClick: () => sendAction('surge'),
          disabled: !isMyTurn || (ownPlayer?.charge || 0) < 2,
        },
        {
          key: 'rematch',
          label: 'Rerun Circuit',
          icon: <AiOutlineReload />,
          onClick: restartMatch,
          disabled: gameState?.phase !== 'finished',
        },
      ],
    },
  ];

  return (
    <>
      <h1 className="game-screen-title">{gameLabel}</h1>

      <motion.div
        className={`rune-rally-notification-dock${isNotificationDockVisible ? ' visible' : ''}`}
        initial={{ opacity: 0, y: -20 }}
        animate={isNotificationDockVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: isNotificationDockVisible ? 'auto' : 'none' }}
      >
        <div className="rune-rally-notification-dock-header">
          <span className="rune-rally-notification-dock-title">Players</span>
          <button
            className="rune-rally-notification-dock-close"
            type="button"
            onClick={() => setIsNotificationDockVisible(false)}
            aria-label="Close notifications"
          >
            ✕
          </button>
        </div>
        <div className="rune-rally-notification-dock-content">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              className={`rune-rally-notification rune-rally-notification-${notif.type}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <span className="rune-rally-notification-icon">
                {notif.type === 'join' ? '✓' : '✗'}
              </span>
              <span className="rune-rally-notification-text">
                <strong>{notif.playerName}</strong>
                <small>{notif.type === 'join' ? 'joined' : 'left'}</small>
              </span>
              <span className="rune-rally-notification-count">
                {notif.connectedCount}/{notif.totalCount}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <AdaptiveControllerOverlay
        title="Rune Rally Controls"
        subtitle="Roll for a burst or spend charge to surge five"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root rune-rally-float-root"
        animate={enableAnimations ? { y: [4, -4, 4] } : undefined}
        transition={enableAnimations ? { duration: 4.4, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card rune-rally-info-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand Rune Rally info"
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title">
                  <AiOutlineInfoCircle className="room-float-title-icon" /> Circuit Intel
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse Rune Rally info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Runner</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Runes</span><strong>{ownPlayer?.score || 0}/{gameState?.targetScore || 5}</strong></div>
                <div className="solo-float-stat"><span>Charge</span><strong>{ownPlayer?.charge || 0}</strong></div>
                <div className="solo-float-stat"><span>Turn</span><strong>{gameState?.turnNumber || 0}/{gameState?.maxTurns || 48}</strong></div>
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

      <main className="rune-rally-root">
        <header className="rune-rally-command">
          <div>
            <span className="rune-rally-connection"><AiOutlineWifi /> {connectionLabel}</span>
            <h2>
              {gameState?.phase === 'finished'
                ? 'Circuit complete'
                : gameState?.phase === 'playing'
                  ? isMyTurn
                    ? 'Your turn, runner!'
                    : `${currentPlayer?.name || 'Next runner'} is up`
                  : 'Waiting for runners'}
            </h2>
            <p>{gameState?.lastEvent || 'Linking to the shared rune circuit...'}</p>
          </div>
          <div className="rune-rally-command-actions">
            <button type="button" onClick={onToggleMusic}><AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}</button>
            <button type="button" onClick={onLeave}>Leave Circuit</button>
          </div>
        </header>

        <section className="rune-rally-scoreboard" aria-label="Runner standings">
          {sortedPlayers.map((entry, index) => (
            <article
              key={entry.id}
              className={`rune-rally-runner${entry.id === player.playerId ? ' is-you' : ''}${entry.id === gameState?.turnPlayerId ? ' is-active' : ''}`}
              style={{ '--rune-player': entry.color } as React.CSSProperties}
            >
              <span className="rune-rally-rank">{index + 1}</span>
              <span className="rune-rally-runner-copy">
                <strong>{entry.name}</strong>
                <small>{entry.connected ? `Runner ${entry.symbol}` : 'Reconnecting'}</small>
              </span>
              <span className="rune-rally-score">{entry.score}<small> / {gameState?.targetScore || 5}</small></span>
              <span className="rune-rally-charge" aria-label={`${entry.charge} charge`}>
                <AiOutlineThunderbolt /> {entry.charge}
              </span>
            </article>
          ))}
        </section>

        <section className="rune-rally-playfield" aria-label="Rune Rally circuit">
          <div className="rune-rally-track">
            {TRACK_COORDINATES.map(([row, column], position) => {
              const tilePlayers = playersAtPosition.get(position) || [];
              const hasRelic = relicSet.has(position);
              return (
                <div
                  key={position}
                  className={`rune-rally-tile${hasRelic ? ' has-relic' : ''}${tilePlayers.length ? ' has-runner' : ''}`}
                  style={{ gridRow: row + 1, gridColumn: column + 1 }}
                  aria-label={`Track tile ${position + 1}${hasRelic ? ', rune' : ''}`}
                >
                  <small>{String(position + 1).padStart(2, '0')}</small>
                  {hasRelic ? <span className="rune-rally-relic" aria-hidden="true">✦</span> : null}
                  {tilePlayers.length ? (
                    <span className="rune-rally-tokens">
                      {tilePlayers.map((entry) => (
                        <i
                          key={entry.id}
                          className={entry.id === gameState?.turnPlayerId ? 'is-current' : undefined}
                          style={{ '--rune-player': entry.color } as React.CSSProperties}
                          title={entry.name}
                        >
                          {entry.symbol}
                        </i>
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
            <div className="rune-rally-center">
              <span className="rune-rally-center-orbit">✦</span>
              <small>THE RUNE CIRCUIT</small>
              <strong>{gameState?.phase === 'playing' ? `${secondsLeft}s` : gameState?.phase === 'finished' ? 'FINISH' : 'READY'}</strong>
              <div className="rune-rally-turn-meter">
                <span style={{ transform: `scaleX(${Math.min(1, timeLeftMs / 20000)})` }} />
              </div>
            </div>
          </div>
          <div className="rune-rally-mobile-actions">
            <button type="button" onClick={() => sendAction('roll')} disabled={!isMyTurn}>
              <AiOutlineArrowRight /> Roll 1-4
            </button>
            <button type="button" onClick={() => sendAction('surge')} disabled={!isMyTurn || (ownPlayer?.charge || 0) < 2}>
              <AiOutlineThunderbolt /> Surge 5
            </button>
          </div>
        </section>

        <footer className="rune-rally-rules">
          <span><AiOutlineThunderbolt /> Rolling restores charge; a rune restores one more.</span>
          <span><AiOutlineArrowRight /> Land on a rival to bump them back and steal a rune if they have one.</span>
          <span>First to five runes wins. No turn? The circuit rolls for you.</span>
        </footer>

        {gameState?.phase === 'finished' ? (
          <div className="rune-rally-finale">
            <div className="rune-rally-finale-card">
              <AiOutlineTrophy />
              <span>{gameState.winnerId === player.playerId ? 'CIRCUIT CHAMPION' : gameState.winnerId ? 'RALLY COMPLETE' : 'DEAD HEAT'}</span>
              <h2>{gameState.players.find((entry) => entry.id === gameState.winnerId)?.name || 'It is a tie!'}</h2>
              <p>{gameState.lastEvent}</p>
              <div>
                <button type="button" onClick={restartMatch}><AiOutlineReload /> Run it back</button>
                <button type="button" onClick={onLeave}>Leave Arena</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
