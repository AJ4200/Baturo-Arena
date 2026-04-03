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
  AiOutlineArrowUp,
  AiOutlineUser,
  AiOutlineCrown,
  AiOutlineDrag,
  AiOutlineTeam,
} from 'react-icons/ai';
import PlayerO from '@/components/game/player/PlayerO';
import PlayerX from '@/components/game/player/PlayerX';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import { GameBoard } from '@/features/game/GameBoard';
import type {
  GameMove,
  GameDefinition,
  MatchResultEvent,
  PlayerProfile,
  RoomState,
  RoomStatePayload,
} from '@/types/game';

type OnlineArenaGameProps = {
  roomCode: string;
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  runWithLoader: <T>(task: () => Promise<T>, showLoader?: boolean) => Promise<T>;
  onProfileUpdate: (player: PlayerProfile) => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const getPlayerLabels = (currentGameType: string | null | undefined): { x: string; o: string } => {
  if (currentGameType === 'tic-tac-two') {
    return { x: 'Player X', o: 'Player O' };
  }
  if (currentGameType === 'connect-all-four') {
    return { x: 'Red Team', o: 'Blue Team' };
  }
  if (currentGameType === 'orbital-flip') {
    return { x: 'Nova Team', o: 'Pulse Team' };
  }
  if (currentGameType === 'corner-clash') {
    return { x: 'Flare Team', o: 'Tide Team' };
  }
  if (currentGameType === 'checkers') {
    return { x: 'Red Checkers', o: 'Blue Checkers' };
  }
  return { x: 'Player 1', o: 'Player 2' };
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

export function OnlineArenaGame({
  roomCode,
  player,
  gameDefinitions,
  isMusicMuted,
  onToggleMusic,
  runWithLoader,
  onProfileUpdate,
  onMatchComplete,
  onLeave,
}: OnlineArenaGameProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [yourSymbol, setYourSymbol] = useState<'X' | 'O' | null>(null);
  const [message, setMessage] = useState('');
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedResultRef = useRef<string | null>(null);

  const xPlayers = room?.players.filter((entry) => entry.symbol === 'X') || [];
  const oPlayers = room?.players.filter((entry) => entry.symbol === 'O') || [];
  const xPlayer = xPlayers[0] || null;
  const oPlayer = oPlayers[0] || null;
  const gameLabel = room ? formatGameName(room.gameType, gameDefinitions) : 'Loading game';
  const playerLabels = useMemo(() => getPlayerLabels(room?.gameType), [room?.gameType]);
  const getSymbolLabel = useCallback(
    (symbol: 'X' | 'O' | null | undefined) => {
      if (symbol === 'X') {
        return playerLabels.x;
      }
      if (symbol === 'O') {
        return playerLabels.o;
      }
      return 'Player';
    },
    [playerLabels.o, playerLabels.x]
  );

  const status = useMemo(() => {
    if (!room) {
      return 'Loading room...';
    }

    if (room.status === 'waiting') {
      return `${gameLabel} | Room ${room.code} | Waiting for players (${room.playersCount}/${room.maxPlayers})`;
    }

    if (room.status === 'playing') {
      if (yourSymbol && room.turn === yourSymbol) {
        return `${gameLabel} | Room ${room.code} | Your turn (${getSymbolLabel(yourSymbol)})`;
      }
      return `${gameLabel} | Room ${room.code} | ${getSymbolLabel(room.turn)} to move`;
    }

    if (room.winner === 'draw') {
      return `${gameLabel} | Room ${room.code} | Draw`;
    }

    if (room.winner && yourSymbol) {
      return room.winner === yourSymbol
        ? `${gameLabel} | Room ${room.code} | You win`
        : `${gameLabel} | Room ${room.code} | You lose`;
    }

    return `${gameLabel} | Room ${room.code} | Match finished`;
  }, [gameLabel, getSymbolLabel, room, yourSymbol]);

  const canPlayTurn = Boolean(room && yourSymbol && room.status === 'playing' && room.turn === yourSymbol);
  const xResult = room?.winner === 'X' ? 'winner' : room?.winner === 'O' ? 'loser' : 'neutral';
  const oResult = room?.winner === 'O' ? 'winner' : room?.winner === 'X' ? 'loser' : 'neutral';

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
  };

  const handleMove = async (move: GameMove) => {
    if (!room || !canPlayTurn) {
      return;
    }

    try {
      const movePayload = typeof move === 'number' ? { index: move } : { move };
      const payload = await callApi<RoomStatePayload>(
        `/api/rooms/${encodeURIComponent(room.code)}/move`,
        {
          method: 'POST',
          body: JSON.stringify(movePayload),
        }
      );
      applyPayload(payload);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not make move');
    }
  };

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
      // Fallback to client-side leave.
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
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomCode, player.playerId]);

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

    const outcome = room.winner === 'draw' ? 'draw' : playerSymbol && room.winner === playerSymbol ? 'win' : 'loss';
    const opponent = playerSymbol
      ? room.players.filter((entry) => entry.symbol !== playerSymbol).map((entry) => entry.name).join(', ') || 'Opponent'
      : 'Opponent';

    lastReportedResultRef.current = resultKey;
    onMatchComplete({
      mode: 'online',
      gameType: room.gameType,
      outcome,
      opponent,
    });
  }, [onMatchComplete, player.playerId, room, yourSymbol]);

  const roomStatusIcon = room?.status === 'waiting' ? <AiOutlineClockCircle /> : room?.status === 'playing' ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />;

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>
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
                <AiOutlineArrowUp />
              </button>
            ) : (
              <>
                <div className="room-float-header">
                  <span className="room-float-anchor">
                    <AiOutlineDrag /> drag
                  </span>
                  <span className="room-float-title">
                    {room ? `${room.name} (${room.code}) | ${gameLabel}` : 'Loading room'}
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
                    {roomStatusIcon} {status}
                  </span>
                </div>

                <div className="room-joined">
                  <p className="room-joined-title">
                    <AiOutlineTeam /> Joined Players ({room?.playersCount || 0}/{room?.maxPlayers || 4})
                  </p>
                  {room?.players && room.players.length > 0 ? (
                    room.players.map((joinedPlayer) => (
                      <p key={joinedPlayer.playerId} className="room-joined-line">
                        {joinedPlayer.symbol === 'X' ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />}{' '}
                        {joinedPlayer.name} ({getSymbolLabel(joinedPlayer.symbol)})
                      </p>
                    ))
                  ) : (
                    <p className="room-joined-line">
                      <AiOutlineClockCircle /> Waiting...
                    </p>
                  )}
                </div>

                <div className="room-float-actions">
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

        <div className="board-stage-card">
          <GameBoard
            gameType={room?.gameType || 'tic-tac-two'}
            board={room?.board || []}
            gameDefinitions={gameDefinitions}
            disabled={!canPlayTurn}
            interactiveSymbol={yourSymbol}
            onMove={(move) => void handleMove(move)}
          />
        </div>
      </div>

      <PlayerX
        pieceLabel={playerLabels.x}
        alias={xPlayers.map((entry) => entry.name).join(' & ') || 'Waiting...'}
        picture={`https://robohash.org/${xPlayer?.name || 'X'}`}
        wins={xPlayer?.wins || 0}
        losses={xPlayer?.losses || 0}
        draws={xPlayer?.draws || 0}
        result={xResult}
        mood={
          room?.winner === 'X' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : yourSymbol === 'X' ? (
            <span className="player-state you">
              <AiOutlineUser /> You
            </span>
          ) : (
            <span className="player-state ready">
              <AiOutlineCheckCircle /> Ready
            </span>
          )
        }
      />
      <PlayerO
        pieceLabel={playerLabels.o}
        alias={oPlayers.map((entry) => entry.name).join(' & ') || 'Waiting...'}
        picture={`https://robohash.org/${oPlayer?.name || 'O'}`}
        wins={oPlayer?.wins || 0}
        losses={oPlayer?.losses || 0}
        draws={oPlayer?.draws || 0}
        result={oResult}
        mood={
          room?.winner === 'O' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : yourSymbol === 'O' ? (
            <span className="player-state you">
              <AiOutlineUser /> You
            </span>
          ) : (
            <span className="player-state ready">
              <AiOutlineCheckCircle /> Ready
            </span>
          )
        }
      />
    </>
  );
}
