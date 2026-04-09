'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCrown,
  AiOutlineDrag,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineTeam,
  AiOutlineUser,
} from 'react-icons/ai';
import PlayerO from '@/components/game/player/PlayerO';
import PlayerX from '@/components/game/player/PlayerX';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { GameBoard } from '@/features/game/GameBoard';
import { evaluateBoard } from '@/lib/cpu';
import { applyMove, createEmptyBoard, formatGameName } from '@/lib/games';
import { getOfflineSeats, type OfflineSeatToken } from '@/lib/offline';
import type { BoardCell, GameDefinition, GameMove, GameType, MatchResultEvent, PlayerProfile } from '@/types/game';

type OfflineArenaGameProps = {
  player: PlayerProfile;
  gameType: GameType;
  gameDefinitions: GameDefinition[];
  participantNames: string[];
  participantCount: number;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Symbol = 'X' | 'O';

type OfflineParticipant = {
  name: string;
  token: OfflineSeatToken;
  symbol: Symbol;
};

const getPlayerLabels = (currentGameType: GameType): { x: string; o: string } => {
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
  return { x: 'Team X', o: 'Team O' };
};

const formatParticipantLabel = (participant: OfflineParticipant): string =>
  `${participant.name} (${participant.token})`;

const createOfflineParticipants = (
  gameType: GameType,
  participantNames: string[],
  participantCount: number,
  fallbackName: string
): OfflineParticipant[] => {
  const seats = getOfflineSeats(gameType, participantCount);
  return seats.map((seat, index) => {
    const trimmedName = String(participantNames[index] || '').trim();
    return {
      name: trimmedName || (index === 0 ? fallbackName : `Player ${index + 1}`),
      token: seat.token,
      symbol: seat.symbol,
    };
  });
};

export function OfflineArenaGame({
  player,
  gameType,
  gameDefinitions,
  participantNames,
  participantCount,
  onMatchComplete,
  onLeave,
}: OfflineArenaGameProps) {
  const [board, setBoard] = useState<BoardCell[]>(() => createEmptyBoard(gameType, gameDefinitions));
  const [turn, setTurn] = useState<Symbol>('X');
  const [winner, setWinner] = useState<Symbol | 'draw' | null>(null);
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const [teamTurnOffsets, setTeamTurnOffsets] = useState<{ X: number; O: number }>({ X: 0, O: 0 });
  const lastReportedWinnerRef = useRef<Symbol | 'draw' | null>(null);
  const gameLabel = formatGameName(gameType, gameDefinitions);
  const playerLabels = useMemo(() => getPlayerLabels(gameType), [gameType]);

  const participants = useMemo(
    () => createOfflineParticipants(gameType, participantNames, participantCount, player.name),
    [gameType, participantCount, participantNames, player.name]
  );
  const xParticipants = useMemo(
    () => participants.filter((entry) => entry.symbol === 'X'),
    [participants]
  );
  const oParticipants = useMemo(
    () => participants.filter((entry) => entry.symbol === 'O'),
    [participants]
  );

  const activeTurnParticipant = useMemo(() => {
    const team = turn === 'X' ? xParticipants : oParticipants;
    if (team.length === 0) {
      return null;
    }
    const offset = turn === 'X' ? teamTurnOffsets.X : teamTurnOffsets.O;
    return team[offset % team.length];
  }, [oParticipants, teamTurnOffsets.O, teamTurnOffsets.X, turn, xParticipants]);

  useEffect(() => {
    setBoard(createEmptyBoard(gameType, gameDefinitions));
    setTurn('X');
    setWinner(null);
    setTeamTurnOffsets({ X: 0, O: 0 });
    lastReportedWinnerRef.current = null;
  }, [gameDefinitions, gameType, participantCount, participants.length]);

  const status = useMemo(() => {
    if (winner === 'draw') {
      return `${gameLabel} | Offline Match | Draw`;
    }
    if (winner === 'X') {
      return `${gameLabel} | Offline Match | ${playerLabels.x} win`;
    }
    if (winner === 'O') {
      return `${gameLabel} | Offline Match | ${playerLabels.o} win`;
    }
    if (!activeTurnParticipant) {
      return `${gameLabel} | Offline Match | ${playerLabels[turn.toLowerCase() as 'x' | 'o']} to move`;
    }
    return `${gameLabel} | Offline Match | ${formatParticipantLabel(activeTurnParticipant)} turn`;
  }, [activeTurnParticipant, gameLabel, playerLabels, turn, winner]);

  const roomStatusIcon = winner
    ? <AiOutlineCheckCircle />
    : <AiOutlineClockCircle />;

  const xResult = winner === 'X' ? 'winner' : winner === 'O' ? 'loser' : 'neutral';
  const oResult = winner === 'O' ? 'winner' : winner === 'X' ? 'loser' : 'neutral';

  const controllerButtons = [
    { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: handleRematch },
    { key: 'leave', label: 'Leave', icon: <AiOutlineArrowDown />, onClick: onLeave },
  ];

  const canPlay = winner === null;
  const showAdaptiveController = gameType !== 'checkers';

  const advanceTeamTurnOffset = (symbol: Symbol) => {
    setTeamTurnOffsets((currentValue) => {
      const teamSize = symbol === 'X' ? xParticipants.length : oParticipants.length;
      const nextValue = teamSize > 1 ? (currentValue[symbol] + 1) % teamSize : 0;
      return {
        ...currentValue,
        [symbol]: nextValue,
      };
    });
  };

  const handleMove = (move: GameMove) => {
    if (!canPlay) {
      return;
    }

    const appliedBoard = applyMove(gameType, board, move, turn, gameDefinitions);
    if (appliedBoard.every((cell, index) => cell === board[index])) {
      return;
    }

    const result = evaluateBoard(gameType, appliedBoard, gameDefinitions);
    if (result) {
      setBoard(appliedBoard);
      setWinner(result);
      return;
    }

    advanceTeamTurnOffset(turn);
    setBoard(appliedBoard);
    setTurn(turn === 'X' ? 'O' : 'X');
  };

  function handleRematch() {
    setBoard(createEmptyBoard(gameType, gameDefinitions));
    setTurn('X');
    setWinner(null);
    setTeamTurnOffsets({ X: 0, O: 0 });
    lastReportedWinnerRef.current = null;
  }

  useEffect(() => {
    if (winner === null) {
      return;
    }
    if (lastReportedWinnerRef.current === winner) {
      return;
    }

    const primarySymbol = participants[0]?.symbol ?? 'X';
    const opponent = participants
      .filter((entry) => entry.symbol !== primarySymbol)
      .map((entry) => entry.name)
      .join(', ');

    lastReportedWinnerRef.current = winner;
    onMatchComplete({
      mode: 'offline',
      gameType,
      outcome: winner === 'draw' ? 'draw' : winner === primarySymbol ? 'win' : 'loss',
      opponent: opponent || 'Offline Opponent',
    });
  }, [gameType, onMatchComplete, participants, winner]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      {showAdaptiveController ? (
        <AdaptiveControllerOverlay
          title="Offline Match"
          subtitle="Local turn-based controls"
          buttons={controllerButtons}
        />
      ) : null}

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
                  <span className="room-float-title">{gameLabel} Offline Match</span>
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
                    <AiOutlineTeam /> Local Players ({participants.length})
                  </p>
                  {participants.map((entry) => (
                    <p key={`${entry.token}-${entry.name}`} className="room-joined-line">
                      <AiOutlinePlayCircle /> {formatParticipantLabel(entry)}
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
                    className="room-float-action-btn room-float-action-btn-danger"
                    type="button"
                    onClick={onLeave}
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
          <GameBoard
            gameType={gameType}
            board={board}
            gameDefinitions={gameDefinitions}
            disabled={!canPlay}
            interactiveSymbol={turn}
            onMove={handleMove}
          />
        </div>
      </div>

      <PlayerX
        pieceLabel={playerLabels.x}
        alias={xParticipants.map((entry) => `${entry.token}:${entry.name}`).join(' | ') || 'Team X'}
        picture={`https://robohash.org/offline-x-${gameType}`}
        wins={player.wins}
        losses={player.losses}
        draws={player.draws}
        result={xResult}
        mood={
          winner === 'X' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : turn === 'X' ? (
            <span className="player-state you">
              <AiOutlineUser /> Turn
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
        alias={oParticipants.map((entry) => `${entry.token}:${entry.name}`).join(' | ') || 'Team O'}
        picture={`https://robohash.org/offline-o-${gameType}`}
        wins={0}
        losses={0}
        draws={0}
        result={oResult}
        mood={
          winner === 'O' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : turn === 'O' ? (
            <span className="player-state you">
              <AiOutlineUser /> Turn
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
