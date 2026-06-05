'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineClockCircle,
  AiOutlinePlayCircle,
  AiOutlineCheckCircle,
  AiOutlineArrowDown,
  AiOutlineInfoCircle,
  AiOutlineTeam,
  AiOutlineDrag,
  AiOutlineUser,
} from 'react-icons/ai';
import PlayerO from '@/components/game/player/PlayerO';
import PlayerX from '@/components/game/player/PlayerX';
import PlayerY from '@/components/game/player/PlayerY';
import PlayerZ from '@/components/game/player/PlayerZ';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  GameSymbol,
  LeapOnAction,
  LeapOnBoardState,
  MatchResultEvent,
  PlayerProfile,
  RoomState,
  RoomStatePayload,
} from '@/types/game';

const ACTION_LABELS: Record<LeapOnAction, string> = {
  jump: 'Leap',
  dash: 'Outer Leap',
  block: 'Split Timing',
  wait: 'Hold Orbit',
  tick: 'Orbit',
};

const LEAP_INPUT_LABEL = 'Space / Tap to leap';

const ACTION_TOOLTIPS: Record<LeapOnAction, string> = {
  jump: 'Land on the nearest white orb.',
  dash: 'Risk a farther white orb for momentum.',
  block: 'Time the white side of a split orb.',
  wait: 'Hold orbit and recover stamina.',
  tick: 'Keep the live arena moving.',
};

const getPolarStyle = (angle: number, radius: number): React.CSSProperties => {
  const radians = (angle * Math.PI) / 180;
  const distance = Math.max(0, Math.min(92, radius)) * 0.43;
  return {
    left: `${50 + Math.cos(radians) * distance}%`,
    top: `${50 + Math.sin(radians) * distance}%`,
    '--leap-angle': `${angle}deg`,
  } as React.CSSProperties;
};

const getOrbStyle = (angle: number, radius: number, spin: number): React.CSSProperties => ({
  ...getPolarStyle(angle, radius),
  '--leap-spin': `${spin}deg`,
} as React.CSSProperties);

const readValidAuthToken = (): string | null => {
  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  if (!token) {
    return null;
  }

  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!expiresAt) {
    window.localStorage.removeItem(STORAGE_KEYS.authToken);
    return null;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    window.localStorage.removeItem(STORAGE_KEYS.authToken);
    window.localStorage.removeItem(STORAGE_KEYS.authTokenExpiresAt);
    return null;
  }

  return token;
};

const isLeapOnBoard = (board: unknown): board is LeapOnBoardState => {
  return typeof board === 'object' && board !== null && (board as LeapOnBoardState).mode === 'leap-on';
};

type OnlineLeapOnArenaGameProps = {
  roomCode: string;
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  runWithLoader: <T>(task: () => Promise<T>, showLoader?: boolean) => Promise<T>;
  onProfileUpdate: (player: PlayerProfile) => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

export function OnlineLeapOnArenaGame({
  roomCode,
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  runWithLoader,
  onProfileUpdate,
  onMatchComplete,
  onLeave,
}: OnlineLeapOnArenaGameProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [yourSymbol, setYourSymbol] = useState<GameSymbol | null>(null);
  const [message, setMessage] = useState('');
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedResultRef = useRef<string | null>(null);

  const boardState = useMemo(() => {
    if (!room || !isLeapOnBoard(room.board)) {
      return null;
    }
    return room.board;
  }, [room]);

  const yourPlayer = useMemo(
    () => boardState?.players.find((entry) => entry.symbol === yourSymbol) ?? null,
    [boardState, yourSymbol]
  );
  const tickerSymbol = useMemo(
    () => boardState?.players.find((entry) => entry.alive)?.symbol ?? null,
    [boardState]
  );

  const gameLabel = room ? formatGameName(room.gameType, gameDefinitions) : 'Loading Leap';

  const status = useMemo(() => {
    if (!room || !boardState) {
      return 'Loading room...';
    }

    if (room.status === 'waiting') {
      return `${gameLabel} | Room ${room.code} | Waiting for players (${room.playersCount}/${room.maxPlayers})`;
    }

    if (room.status === 'playing') {
      return `${gameLabel} | Room ${room.code} | Live orbit`;
    }

    if (room.winner === 'draw') {
      return `${gameLabel} | Room ${room.code} | Draw`;
    }

    if (room.winner) {
      return room.winner === yourSymbol
        ? `${gameLabel} | Room ${room.code} | You win`
        : `${gameLabel} | Room ${room.code} | You lose`;
    }

    return `${gameLabel} | Room ${room.code} | Match finished`;
  }, [boardState, gameLabel, room, yourSymbol]);

  const canPlay = Boolean(room && yourSymbol && room.status === 'playing' && yourPlayer?.alive);

  const callApi = useCallback(
    async <T,>(path: string, init?: RequestInit, showLoader = true): Promise<T> => {
      return runWithLoader(async () => {
        const headers = new Headers(init?.headers || undefined);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        const authToken = readValidAuthToken();
        if (authToken && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${authToken}`);
        }

        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          headers,
        });

        const text = await response.text();
        let payload: Record<string, unknown> = {};
        if (text) {
          try {
            payload = JSON.parse(text) as Record<string, unknown>;
          } catch (_error) {
            payload = {};
          }
        }
        if (!response.ok) {
          if (response.status === 401) {
            window.localStorage.removeItem(STORAGE_KEYS.authToken);
            window.localStorage.removeItem(STORAGE_KEYS.authTokenExpiresAt);
          }
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Request failed');
        }

        return payload as T;
      }, showLoader);
    },
    [runWithLoader]
  );

  const applyPayload = (payload: RoomStatePayload) => {
    setRoom(payload.room);
    setYourSymbol(payload.yourSymbol);
    if (payload.you) {
      onProfileUpdate(payload.you);
    }
  };

  const syncRoom = useCallback(async () => {
    const payload = await callApi<RoomStatePayload>(`/api/rooms/${encodeURIComponent(roomCode)}`, undefined, false);
    applyPayload(payload);
    setMessage((currentMessage) => (currentMessage === 'Internal server error' ? '' : currentMessage));
  }, [callApi, onProfileUpdate, roomCode]);

  const handleAction = async (action: LeapOnAction = 'jump', showLoader = true) => {
    if (!room || !canPlay) {
      return;
    }

    try {
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ move: { action } }),
        },
        showLoader
      );
      applyPayload(payload);
      if (action !== 'tick') {
        setMessage('');
      }
    } catch (error) {
      if (action !== 'tick') {
        setMessage(error instanceof Error ? error.message : 'Could not perform action');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      event.preventDefault();
      void handleAction('jump');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canPlay, room?.code]);

  useEffect(() => {
    if (!room || room.status !== 'playing' || room.winner) {
      return;
    }

    if (!tickerSymbol || tickerSymbol !== yourSymbol) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void handleAction('tick', false);
    }, 550);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canPlay, room?.code, room?.status, room?.winner, tickerSymbol, yourSymbol]);

  const handleRematch = async () => {
    if (!room) {
      return;
    }

    try {
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/rematch`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      applyPayload(payload);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not rematch');
    }
  };

  const handleLeave = async () => {
    if (!room) {
      onLeave();
      return;
    }

    try {
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/leave`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      if (payload.you) {
        onProfileUpdate(payload.you);
      }
    } catch (_error) {
      // Fall back to client-side leave.
    }

    onLeave();
  };

  useEffect(() => {
    syncRoom().catch(() => {
      setMessage('Could not load room');
    });

    const intervalId = window.setInterval(() => {
      syncRoom().catch(() => {
        // Keep polling silent unless user triggers an action.
      });
    }, 450);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomCode, syncRoom]);

  useEffect(() => {
    if (!room || room.winner === null) {
      lastReportedResultRef.current = null;
      return;
    }

    const playerSymbol =
      yourSymbol || room.players.find((entry) => entry.playerId === player.playerId)?.symbol || null;
    const resultKey = `${room.code}:${room.winner}:${playerSymbol ?? 'none'}`;
    if (lastReportedResultRef.current === resultKey) {
      return;
    }

    lastReportedResultRef.current = resultKey;
    onMatchComplete({
      mode: 'online',
      gameType: 'leap-on',
      outcome: room.winner === 'draw' ? 'draw' : room.winner === playerSymbol ? 'win' : 'loss',
      opponent: room.players.filter((entry) => entry.symbol !== playerSymbol).map((entry) => entry.name).join(', ') || 'Arena',
    });
  }, [onMatchComplete, player.playerId, room, yourSymbol]);

  const statusIcon = room?.winner ? <AiOutlineCheckCircle /> : room?.status === 'playing' ? <AiOutlinePlayCircle /> : <AiOutlineClockCircle />;

  const symbolPositionMap: Record<GameSymbol, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {
    X: 'top-left',
    O: 'top-right',
    Y: 'bottom-left',
    Z: 'bottom-right',
  };

  const renderPlayerCard = (state: LeapOnBoardState['players'][number]) => {

    const position = symbolPositionMap[state.symbol];
    const result = (room?.winner && room.winner !== 'draw'
      ? room.winner === state.symbol
        ? 'winner'
        : 'loser'
      : 'neutral') as 'winner' | 'loser' | 'neutral';

    const mood = state.symbol === yourSymbol
      ? <span className="player-state you">You</span>
      : state.alive
        ? <span className="player-state ready">Alive</span>
        : <span className="player-state">Out</span>;

    const playerProps = {
      alias: state.name,
      picture: `https://robohash.org/${state.name}`,
      pieceLabel: state.symbol,
      wins: 0,
      losses: 0,
      draws: 0,
      mood,
      result,
      position,
    };

    switch (state.symbol) {
      case 'O':
        return <PlayerO key={state.symbol} {...playerProps} />;
      case 'Y':
        return <PlayerY key={state.symbol} {...playerProps} />;
      case 'Z':
        return <PlayerZ key={state.symbol} {...playerProps} />;
      default:
        return <PlayerX key={state.symbol} {...playerProps} />;
    }
  };

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Online Match"
        subtitle={status}
        buttons={[
          { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: handleRematch },
        ]}
      />

      <div>
        <motion.div drag dragMomentum={false} className="room-float-drag-root">
          <div className={`room-float-card${isRoomCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
            {isRoomCardCollapsed ? (
              <button
                className="room-float-collapsed-center"
                type="button"
                onClick={() => setIsRoomCardCollapsed(false)}
                aria-label="Expand room info"
                title="Expand room info"
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
                    <AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Room
                  </span>
                  <button
                    className="room-float-toggle-btn"
                    type="button"
                    onClick={() => setIsRoomCardCollapsed(true)}
                    aria-label="Collapse room info"
                    title="Collapse room info"
                  >
                    <AiOutlineArrowDown />
                  </button>
                </div>

                <div className="room-score-strip">
                  <span className="room-float-line">
                    {statusIcon} {status}
                  </span>
                </div>

                <div className="room-joined">
                  <p className="room-joined-title">
                    <AiOutlineTeam /> Players ({room?.playersCount ?? 0})
                  </p>
                  {room?.players.map((entry) => (
                    <p key={entry.playerId} className="room-joined-line">
                      <AiOutlineUser /> {entry.name} ({entry.symbol})
                    </p>
                  ))}
                </div>

                <div className="room-float-actions">
                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={handleRematch}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <AiOutlineReload /> Rematch
                  </motion.button>

                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={onToggleMusic}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                  </motion.button>

                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={onToggleAnimations}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Motion {enableAnimations ? 'On' : 'Off'}
                  </motion.button>

                  <motion.button
                    className="room-float-action-btn room-float-action-btn-danger"
                    type="button"
                    onClick={handleLeave}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Leave
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className="board-stage-card">
          <div className="leap-on-arena-board">
            <div className="leap-on-header-bar">
              <span>Round {boardState?.round ?? 0}</span>
              <span>Timer {boardState?.timeMs ?? 0}ms</span>
            </div>

            <div className="leap-orbit-stage" aria-label="Leap arena">
              <div className="leap-anchor" />
              <div className="leap-anchor-ring" />
              {boardState?.orbs.map((orb) => (
                <span
                  key={orb.id}
                  className={`leap-orb leap-orb-${orb.kind}`}
                  style={getOrbStyle(orb.angle, orb.radius, orb.spin)}
                  title={orb.kind === 'safe' ? 'White orb' : orb.kind === 'hazard' ? 'Black orb' : 'Split orb'}
                />
              ))}
              {boardState?.players.map((state) => (
                <span
                  key={state.symbol}
                  className={`leap-runner leap-runner-${state.symbol.toLowerCase()}${state.alive ? '' : ' leap-runner-out'}`}
                  style={getPolarStyle(state.angle, state.radius)}
                  title={`${state.name} ${state.alive ? 'alive' : 'eliminated'}`}
                >
                  {state.symbol}
                </span>
              ))}
            </div>

            <div className="leap-on-arena-status">
              <p>{boardState?.lastEvent || 'Chain white-orb landings and stay outside the anchor.'}</p>
              <p>{LEAP_INPUT_LABEL}</p>
            </div>

            <div className="leap-on-actions-panel">
              <motion.button
                className="leap-on-action-btn leap-on-action-btn-primary"
                type="button"
                disabled={!canPlay}
                onClick={() => handleAction('jump')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                <strong>{ACTION_LABELS.jump}</strong>
                <span>{ACTION_TOOLTIPS.jump}</span>
              </motion.button>
            </div>

            {boardState?.players.map(renderPlayerCard)}

            {message ? <p className="leap-on-message">{message}</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
