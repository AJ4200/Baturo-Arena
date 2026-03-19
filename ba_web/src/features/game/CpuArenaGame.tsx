'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineClockCircle,
  AiOutlinePlayCircle,
  AiOutlineCheckCircle,
  AiOutlineUser,
  AiOutlineCrown,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineRobot,
  AiOutlineTeam,
} from 'react-icons/ai';
import PlayerO from '@/components/game/player/PlayerO';
import PlayerX from '@/components/game/player/PlayerX';
import { GameBoard } from '@/features/game/GameBoard';
import { evaluateBoard, getCpuMove } from '@/lib/cpu';
import { applyMove, createEmptyBoard, formatGameName } from '@/lib/games';
import type { BoardCell, CpuDifficulty, GameDefinition, GameType, MatchResultEvent, PlayerProfile } from '@/types/game';

type CpuArenaGameProps = {
  player: PlayerProfile;
  gameType: GameType;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  difficulty: CpuDifficulty;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Symbol = 'X' | 'O';

export function CpuArenaGame({
  player,
  gameType,
  gameDefinitions,
  isMusicMuted,
  onToggleMusic,
  difficulty,
  onMatchComplete,
  onLeave,
}: CpuArenaGameProps) {
  const [board, setBoard] = useState<BoardCell[]>(() => createEmptyBoard(gameType, gameDefinitions));
  const [turn, setTurn] = useState<Symbol>('X');
  const [winner, setWinner] = useState<Symbol | 'draw' | null>(null);
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedWinnerRef = useRef<Symbol | 'draw' | null>(null);
  const gameLabel = formatGameName(gameType, gameDefinitions);

  useEffect(() => {
    setBoard(createEmptyBoard(gameType, gameDefinitions));
    setTurn('X');
    setWinner(null);
  }, [gameDefinitions, gameType]);

  const status = useMemo(() => {
    if (winner === 'draw') {
      return `${gameLabel} | CPU Match | Draw`;
    }
    if (winner === 'X') {
      return `${gameLabel} | CPU Match | You win`;
    }
    if (winner === 'O') {
      return `${gameLabel} | CPU Match | CPU wins`;
    }

    if (turn === 'X') {
      return `${gameLabel} | CPU Match | Your turn`;
    }

    return `${gameLabel} | CPU Match | CPU thinking...`;
  }, [gameLabel, turn, winner]);

  const roomStatusIcon = winner ? <AiOutlineCheckCircle /> : turn === 'X' ? <AiOutlinePlayCircle /> : <AiOutlineClockCircle />;

  const canPlay = turn === 'X' && winner === null;
  const xResult = winner === 'X' ? 'winner' : winner === 'O' ? 'loser' : 'neutral';
  const oResult = winner === 'O' ? 'winner' : winner === 'X' ? 'loser' : 'neutral';

  const applyBoardState = (nextBoard: BoardCell[], nextTurn: Symbol) => {
    const result = evaluateBoard(gameType, nextBoard);
    setBoard(nextBoard);
    setTurn(nextTurn);
    setWinner(result);
  };

  const handleMove = (move: number) => {
    if (!canPlay) {
      return;
    }

    const appliedBoard = applyMove(gameType, board, move, 'X');
    if (appliedBoard.every((cell, index) => cell === board[index])) {
      return;
    }

    const result = evaluateBoard(gameType, appliedBoard);
    if (result) {
      setBoard(appliedBoard);
      setWinner(result);
      return;
    }

    setBoard(appliedBoard);
    setTurn('O');
  };

  const handleRematch = () => {
    setBoard(createEmptyBoard(gameType, gameDefinitions));
    setTurn('X');
    setWinner(null);
  };

  useEffect(() => {
    if (winner === null) {
      lastReportedWinnerRef.current = null;
      return;
    }
    if (lastReportedWinnerRef.current === winner) {
      return;
    }

    lastReportedWinnerRef.current = winner;
    onMatchComplete({
      mode: 'cpu',
      gameType,
      outcome: winner === 'draw' ? 'draw' : winner === 'X' ? 'win' : 'loss',
      opponent: `CPU (${difficulty})`,
    });
  }, [difficulty, gameType, onMatchComplete, winner]);

  useEffect(() => {
    if (turn !== 'O' || winner !== null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const move = getCpuMove(gameType, board, difficulty);
      if (move === null) {
        return;
      }

      const nextBoard = applyMove(gameType, board, move, 'O', gameDefinitions);
      applyBoardState(nextBoard, 'X');
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [turn, winner, board, difficulty, gameDefinitions, gameType]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>
      <div>
        <motion.div drag dragMomentum={false} className="room-float-drag-root">
          <div className={`room-float-card${isRoomCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
            {isRoomCardCollapsed ? (
              <button className="room-float-collapsed-center" type="button" onClick={() => setIsRoomCardCollapsed(false)} aria-label="Expand room info" title="Expand room info">
                <AiOutlineInfoCircle />
              </button>
            ) : (
              <>
                <div className="room-float-header">
                  <span className="room-float-anchor">
                    <AiOutlineDrag /> drag
                  </span>
                  <span className="room-float-title">{gameLabel} CPU Match ({difficulty})</span>
                  <button className="room-float-toggle-btn" type="button" onClick={() => setIsRoomCardCollapsed(true)} aria-label="Collapse room info" title="Collapse room info">
                    <AiOutlineInfoCircle />
                  </button>
                </div>

                <div className="room-score-strip">
                  <span className="room-float-line">
                    {roomStatusIcon} {status}
                  </span>
                </div>

                <div className="room-joined">
                  <p className="room-joined-title">
                    <AiOutlineTeam /> Players
                  </p>
                  <p className="room-joined-line">
                    <AiOutlinePlayCircle /> {player.name} (X)
                  </p>
                  <p className="room-joined-line">
                    <AiOutlineRobot /> CPU ({difficulty}) (O)
                  </p>
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
          <GameBoard gameType={gameType} board={board} gameDefinitions={gameDefinitions} disabled={!canPlay} onMove={handleMove} />
        </div>
      </div>

      <PlayerX
        alias={player.name}
        picture={`https://robohash.org/${player.name}`}
        wins={player.wins}
        losses={player.losses}
        draws={player.draws}
        result={xResult}
        mood={
          winner === 'X' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : (
            <span className="player-state you">
              <AiOutlineUser /> You
            </span>
          )
        }
      />
      <PlayerO
        alias={`CPU (${difficulty})`}
        picture={`https://robohash.org/cpu-${gameType}-${difficulty}`}
        wins={0}
        losses={0}
        draws={0}
        result={oResult}
        mood={
          winner === 'O' ? (
            <span className="player-state winner">
              <AiOutlineCrown /> Winner
            </span>
          ) : (
            <span className="player-state ready">
              <AiOutlineRobot /> CPU
            </span>
          )
        }
      />
    </>
  );
}
