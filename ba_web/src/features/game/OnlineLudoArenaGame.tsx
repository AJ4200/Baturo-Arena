'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCrown,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineTeam,
  AiOutlineThunderbolt,
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
  LudoBoardState,
  MatchResultEvent,
  PlayerProfile,
  RoomStatePayload,
} from '@/types/game';

type OnlineLudoArenaGameProps = {
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

type LudoColor = 'red' | 'blue' | 'yellow' | 'green';

const SYMBOL_COLOR_MAP: Record<GameSymbol, LudoColor> = {
  X: 'red',
  O: 'blue',
  Y: 'yellow',
  Z: 'green',
};

const COLOR_META: Record<LudoColor, { label: string; pieceLabel: string }> = {
  red: { label: 'Red', pieceLabel: 'Red Ludo' },
  blue: { label: 'Blue', pieceLabel: 'Blue Ludo' },
  yellow: { label: 'Yellow', pieceLabel: 'Yellow Ludo' },
  green: { label: 'Green', pieceLabel: 'Green Ludo' },
};

const SAFE_TRACK_INDEXES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
const START_INDEX_BY_SYMBOL: Record<GameSymbol, number> = {
  X: 0,
  O: 13,
  Y: 26,
  Z: 39,
};

const TRACK_COORDS: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

const HOME_LANE_COORDS: Record<GameSymbol, Array<[number, number]>> = {
  X: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  O: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  Y: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  Z: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

const YARD_COORDS: Record<GameSymbol, Array<[number, number]>> = {
  X: [[2, 2], [2, 4], [4, 2], [4, 4]],
  O: [[2, 10], [2, 12], [4, 10], [4, 12]],
  Y: [[10, 10], [10, 12], [12, 10], [12, 12]],
  Z: [[10, 2], [10, 4], [12, 2], [12, 4]],
};

const TRACK_KEY_SET = new Set<string>(TRACK_COORDS.map(([row, column]) => `${row}-${column}`));
const SAFE_KEY_SET = new Set<string>(
  Array.from(SAFE_TRACK_INDEXES).map((index) => {
    const [row, column] = TRACK_COORDS[index];
    return `${row}-${column}`;
  })
);

const HOME_KEY_SETS: Record<GameSymbol, Set<string>> = {
  X: new Set(HOME_LANE_COORDS.X.map(([row, column]) => `${row}-${column}`)),
  O: new Set(HOME_LANE_COORDS.O.map(([row, column]) => `${row}-${column}`)),
  Y: new Set(HOME_LANE_COORDS.Y.map(([row, column]) => `${row}-${column}`)),
  Z: new Set(HOME_LANE_COORDS.Z.map(([row, column]) => `${row}-${column}`)),
};

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

const normalizeLudoBoard = (value: unknown): LudoBoardState => {
  if (!value || typeof value !== 'object') {
    return { mode: 'ludo', diceValue: null, tokens: {} };
  }

  const candidate = value as Partial<LudoBoardState>;
  if (candidate.mode !== 'ludo' || !candidate.tokens || typeof candidate.tokens !== 'object') {
    return { mode: 'ludo', diceValue: null, tokens: {} };
  }

  const tokens: LudoBoardState['tokens'] = {};
  (['X', 'O', 'Y', 'Z'] as GameSymbol[]).forEach((symbol) => {
    const entry = candidate.tokens?.[symbol];
    if (!Array.isArray(entry)) {
      return;
    }
    tokens[symbol] = entry.map((progress) => {
      const parsed = Number(progress);
      if (!Number.isInteger(parsed)) {
        return -1;
      }
      return Math.max(-1, Math.min(57, parsed));
    }).slice(0, 4);
  });

  const diceValue = Number(candidate.diceValue);
  return {
    mode: 'ludo',
    diceValue: Number.isInteger(diceValue) ? Math.max(1, Math.min(6, diceValue)) : null,
    tokens,
  };
};

const getTrackIndex = (symbol: GameSymbol, progress: number): number | null => {
  if (progress < 0 || progress > 50) {
    return null;
  }
  return (START_INDEX_BY_SYMBOL[symbol] + progress) % TRACK_COORDS.length;
};

const getMovableTokenIds = (boardState: LudoBoardState, symbol: GameSymbol, diceValue: number): string[] => {
  const values = boardState.tokens[symbol] || [];
  return values
    .map((progress, index) => ({ progress, index }))
    .filter((entry) => Number.isInteger(entry.progress))
    .filter((entry) => {
      if (entry.progress === 57) {
        return false;
      }
      if (entry.progress === -1) {
        return diceValue === 6;
      }
      return entry.progress + diceValue <= 57;
    })
    .map((entry) => `${symbol}-${entry.index + 1}`);
};

const resolveBaseColor = (row: number, column: number): LudoColor | null => {
  if (row <= 5 && column <= 5) return 'red';
  if (row <= 5 && column >= 9) return 'blue';
  if (row >= 9 && column >= 9) return 'yellow';
  if (row >= 9 && column <= 5) return 'green';
  return null;
};

const resolveTokenCoord = (symbol: GameSymbol, slot: number, progress: number): [number, number] | null => {
  if (progress === 57) {
    return null;
  }
  if (progress === -1) {
    return YARD_COORDS[symbol][slot] || null;
  }
  if (progress >= 51) {
    return HOME_LANE_COORDS[symbol][progress - 51] || null;
  }
  const trackIndex = getTrackIndex(symbol, progress);
  if (trackIndex === null) {
    return null;
  }
  return TRACK_COORDS[trackIndex] || null;
};

export function OnlineLudoArenaGame({
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
}: OnlineLudoArenaGameProps) {
  const [room, setRoom] = useState<RoomStatePayload['room'] | null>(null);
  const [yourSymbol, setYourSymbol] = useState<GameSymbol | null>(null);
  const [message, setMessage] = useState('');
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedResultRef = useRef<string | null>(null);

  const gameLabel = room ? formatGameName(room.gameType, gameDefinitions) : 'Ludo';
  const boardState = useMemo(() => normalizeLudoBoard(room?.board), [room?.board]);
  const participants = room?.players || [];
  const turnSymbol = room?.turn || 'X';
  const canPlayTurn = Boolean(room && room.status === 'playing' && yourSymbol && yourSymbol === turnSymbol);

  const movableTokenIds = useMemo(() => {
    if (!canPlayTurn || !yourSymbol || !Number.isInteger(boardState.diceValue)) {
      return [];
    }
    return getMovableTokenIds(boardState, yourSymbol, boardState.diceValue || 0);
  }, [boardState, canPlayTurn, yourSymbol]);

  const tokenMapByCell = useMemo(() => {
    const map = new Map<string, Array<{ tokenId: string; symbol: GameSymbol; slot: number }>>();
    (['X', 'O', 'Y', 'Z'] as GameSymbol[]).forEach((symbol) => {
      const values = boardState.tokens[symbol] || [];
      values.forEach((progress, slot) => {
        const coord = resolveTokenCoord(symbol, slot, progress);
        if (!coord) {
          return;
        }
        const key = `${coord[0]}-${coord[1]}`;
        const current = map.get(key) || [];
        current.push({ tokenId: `${symbol}-${slot + 1}`, symbol, slot });
        map.set(key, current);
      });
    });
    return map;
  }, [boardState]);

  const callApi = async <T,>(path: string, init?: RequestInit, showLoader = true): Promise<T> => {
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
  };

  const applyPayload = (payload: RoomStatePayload) => {
    setRoom(payload.room);
    setYourSymbol(payload.yourSymbol);
    if (payload.you) {
      onProfileUpdate(payload.you);
    }
  };

  const syncRoom = async () => {
    const payload = await callApi<RoomStatePayload>(`/api/rooms/${encodeURIComponent(roomCode)}`, undefined, false);
    applyPayload(payload);
    setMessage('');
  };

  useEffect(() => {
    syncRoom().catch(() => {
      setMessage('Could not load ludo room');
    });

    const intervalId = window.setInterval(() => {
      syncRoom().catch(() => {
        // Silent polling for room updates.
      });
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomCode]);

  useEffect(() => {
    if (!room || room.winner === null) {
      lastReportedResultRef.current = null;
      return;
    }

    const playerSymbol = yourSymbol || room.players.find((entry) => entry.playerId === player.playerId)?.symbol || null;
    const resultKey = `${room.code}:${room.winner}:${playerSymbol ?? 'none'}`;
    if (lastReportedResultRef.current === resultKey) {
      return;
    }

    const outcome = room.winner === 'draw' ? 'draw' : playerSymbol && room.winner === playerSymbol ? 'win' : 'loss';
    const opponent = playerSymbol
      ? room.players.filter((entry) => entry.symbol !== playerSymbol).map((entry) => entry.name).join(', ') || 'Opponent'
      : 'Opponent';

    lastReportedResultRef.current = resultKey;
    onMatchComplete({
      mode: 'online',
      gameType: 'ludo',
      outcome,
      opponent,
    });
  }, [onMatchComplete, player.playerId, room, yourSymbol]);

  const handleRoomAction = async (action: { action: 'roll' } | { action: 'move'; tokenId: string }) => {
    if (!room || !canPlayTurn) {
      return;
    }

    try {
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ move: action }),
        }
      );
      applyPayload(payload);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Move failed');
    }
  };

  const handleRematch = async () => {
    if (!room) {
      return;
    }
    try {
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/rematch`,
        { method: 'POST', body: JSON.stringify({}) }
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
      await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/leave`,
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (_error) {
      // Ignore leave failures and continue with local leave.
    }
    onLeave();
  };

  const roomStatusIcon =
    room?.status === 'waiting' ? <AiOutlineClockCircle /> : room?.status === 'playing' ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />;

  const statusText = useMemo(() => {
    if (!room) {
      return 'Loading room...';
    }
    if (room.status === 'waiting') {
      return `${gameLabel} | Room ${room.code} | Waiting for players (${room.playersCount}/${room.maxPlayers})`;
    }
    if (room.status === 'playing') {
      if (yourSymbol && turnSymbol === yourSymbol) {
        return `${gameLabel} | Room ${room.code} | Your turn (${turnSymbol})`;
      }
      return `${gameLabel} | Room ${room.code} | ${turnSymbol} to move`;
    }
    if (room.winner === 'draw') {
      return `${gameLabel} | Room ${room.code} | Draw`;
    }
    if (room.winner) {
      return `${gameLabel} | Room ${room.code} | ${room.winner} wins`;
    }
    return `${gameLabel} | Room ${room.code} | Match finished`;
  }, [gameLabel, room, turnSymbol, yourSymbol]);

  const controllerButtons = [
    { key: 'roll', label: 'Roll', icon: <AiOutlineThunderbolt />, onClick: () => void handleRoomAction({ action: 'roll' }), disabled: !canPlayTurn || boardState.diceValue !== null },
    { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: () => void handleRematch(), disabled: !room || room.status !== 'finished' },
  ];

  const renderPlayerMood = (symbol: GameSymbol) => {
    if (room?.winner === symbol) {
      return (
        <span className="player-state winner">
          <AiOutlineCrown /> Winner
        </span>
      );
    }
    if (yourSymbol === symbol) {
      return (
        <span className="player-state you">
          <AiOutlineUser /> You
        </span>
      );
    }
    return (
      <span className="player-state ready">
        <AiOutlineCheckCircle /> Ready
      </span>
    );
  };

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Online Ludo"
        subtitle="Room controls"
        buttons={controllerButtons}
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
                    <AiOutlineInfoCircle className="room-float-title-icon" /> {room ? `${room.name} (${room.code}) | ${gameLabel}` : 'Loading room'}
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
                    {roomStatusIcon} {statusText}
                  </span>
                </div>

                <div className="room-joined">
                  <p className="room-joined-title">
                    <AiOutlineTeam /> Joined Players ({room?.playersCount || 0}/{room?.maxPlayers || 4})
                  </p>
                  {participants.map((entry) => (
                    <p key={entry.playerId} className={classnames('room-joined-line', `ludo-roster-line-${SYMBOL_COLOR_MAP[entry.symbol]}`)}>
                      {turnSymbol === entry.symbol ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />}{' '}
                      {entry.name} ({entry.symbol})
                    </p>
                  ))}
                </div>

                <div className="room-float-actions">
                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={() => void handleRoomAction({ action: 'roll' })}
                    disabled={!canPlayTurn || boardState.diceValue !== null}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <AiOutlineThunderbolt /> Roll
                  </motion.button>
                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={() => void handleRematch()}
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
                    onClick={() => void handleLeave()}
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

        {message ? <div className="status text-red-500">{message}</div> : null}

        <div className="board-stage-card ludo-stage-card">
          <div className="ludo-topbar">
            <div className={classnames('ludo-turn-chip', `ludo-turn-chip-${SYMBOL_COLOR_MAP[turnSymbol] || 'red'}`)}>
              <AiOutlinePlayCircle />
              <span>{room?.winner ? `${room.winner} wins` : `${turnSymbol} to move`}</span>
            </div>
            <div className="ludo-dice-chip">
              <AiOutlineThunderbolt /> Dice: <strong>{boardState.diceValue ?? '-'}</strong>
            </div>
          </div>

          <div className="ludo-board-grid" role="grid" aria-label="Online ludo board">
            {Array.from({ length: 15 * 15 }, (_, cellIndex) => {
              const row = Math.floor(cellIndex / 15);
              const column = cellIndex % 15;
              const cellKey = `${row}-${column}`;
              const baseColor = resolveBaseColor(row, column);
              const isTrackCell = TRACK_KEY_SET.has(cellKey);
              const isSafeCell = SAFE_KEY_SET.has(cellKey);
              const homeLaneSymbol = (['X', 'O', 'Y', 'Z'] as GameSymbol[]).find((symbol) => HOME_KEY_SETS[symbol].has(cellKey));
              const homeLaneColor = homeLaneSymbol ? SYMBOL_COLOR_MAP[homeLaneSymbol] : null;
              const isCenterCell = row === 7 && column === 7;
              const tokensAtCell = tokenMapByCell.get(cellKey) || [];

              return (
                <div
                  key={cellKey}
                  className={classnames(
                    'ludo-cell',
                    baseColor && `ludo-cell-base-${baseColor}`,
                    isTrackCell && 'ludo-cell-track',
                    isSafeCell && 'ludo-cell-safe',
                    homeLaneColor && `ludo-cell-home-${homeLaneColor}`,
                    isCenterCell && 'ludo-cell-center'
                  )}
                  role="gridcell"
                >
                  {tokensAtCell.map((token) => {
                    const color = SYMBOL_COLOR_MAP[token.symbol];
                    const interactive = canPlayTurn && yourSymbol === token.symbol && movableTokenIds.includes(token.tokenId);
                    return (
                      <button
                        key={token.tokenId}
                        className={classnames('ludo-token', `ludo-token-${color}`, interactive && 'ludo-token-actionable')}
                        type="button"
                        disabled={!interactive}
                        onClick={() => void handleRoomAction({ action: 'move', tokenId: token.tokenId })}
                        title={`${token.symbol} token ${token.slot + 1}`}
                        aria-label={`${token.symbol} token ${token.slot + 1}`}
                      >
                        {token.slot + 1}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="ludo-controls">
            <button
              className="ludo-roll-btn"
              type="button"
              disabled={!canPlayTurn || boardState.diceValue !== null}
              onClick={() => void handleRoomAction({ action: 'roll' })}
            >
              <AiOutlineThunderbolt /> {canPlayTurn ? 'Roll Dice' : 'Waiting Turn'}
            </button>
            <span className="ludo-controls-hint">
              Need a 6 to launch a token from base. Exact roll is required to reach home.
            </span>
          </div>
        </div>
      </div>

      {(() => {
        const xPlayer = participants.find((entry) => entry.symbol === 'X');
        const oPlayer = participants.find((entry) => entry.symbol === 'O');
        const yPlayer = participants.find((entry) => entry.symbol === 'Y');
        const zPlayer = participants.find((entry) => entry.symbol === 'Z');

        const xResult = room?.winner === 'X' ? 'winner' : room?.winner ? 'loser' : 'neutral';
        const oResult = room?.winner === 'O' ? 'winner' : room?.winner ? 'loser' : 'neutral';
        const yResult = room?.winner === 'Y' ? 'winner' : room?.winner ? 'loser' : 'neutral';
        const zResult = room?.winner === 'Z' ? 'winner' : room?.winner ? 'loser' : 'neutral';

        return (
          <>
            <PlayerX
              pieceLabel={COLOR_META.red.pieceLabel}
              alias={xPlayer?.name || 'Waiting...'}
              picture={`https://robohash.org/${xPlayer?.name || 'ludo-x'}`}
              wins={xPlayer?.wins || 0}
              losses={xPlayer?.losses || 0}
              draws={xPlayer?.draws || 0}
              result={xResult}
              mood={renderPlayerMood('X')}
            />
            <PlayerO
              pieceLabel={COLOR_META.blue.pieceLabel}
              alias={oPlayer?.name || 'Waiting...'}
              picture={`https://robohash.org/${oPlayer?.name || 'ludo-o'}`}
              wins={oPlayer?.wins || 0}
              losses={oPlayer?.losses || 0}
              draws={oPlayer?.draws || 0}
              result={oResult}
              mood={renderPlayerMood('O')}
            />
            {yPlayer ? (
              <PlayerY
                pieceLabel={COLOR_META.yellow.pieceLabel}
                alias={yPlayer.name}
                picture={`https://robohash.org/${yPlayer.name || 'ludo-y'}`}
                wins={yPlayer.wins || 0}
                losses={yPlayer.losses || 0}
                draws={yPlayer.draws || 0}
                result={yResult}
                mood={renderPlayerMood('Y')}
              />
            ) : null}
            {zPlayer ? (
              <PlayerZ
                pieceLabel={COLOR_META.green.pieceLabel}
                alias={zPlayer.name}
                picture={`https://robohash.org/${zPlayer.name || 'ludo-z'}`}
                wins={zPlayer.wins || 0}
                losses={zPlayer.losses || 0}
                draws={zPlayer.draws || 0}
                result={zResult}
                mood={renderPlayerMood('Z')}
              />
            ) : null}
          </>
        );
      })()}
    </>
  );
}

