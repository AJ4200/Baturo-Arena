"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { IconContext } from "react-icons";
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
} from "react-icons/ai";
import X from "@/components/game/X";
import O from "@/components/game/O";
import PlayerO from "@/components/game/player/PlayerO";
import PlayerX from "@/components/game/player/PlayerX";
import { evaluateBoard, getCpuMove } from "@/lib/cpu";
import type { CpuDifficulty, MatchResultEvent, PlayerProfile } from "@/types/game";

type CpuTicTacToeProps = {
  player: PlayerProfile;
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  difficulty: CpuDifficulty;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Symbol = "X" | "O";
const EMPTY_BOARD: Array<Symbol | null> = Array(9).fill(null);

const buttonVariants = {
  initial: { boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.1)" },
  hover: { scale: 1.1, boxShadow: "0px 0px 15px rgba(0, 0, 0, 0.2)" },
  pressed: { scale: 0.9, boxShadow: "0px 0px 5px rgba(0, 0, 0, 0.2)" },
};

export function CpuTicTacToe({
  player,
  isMusicMuted,
  onToggleMusic,
  difficulty,
  onMatchComplete,
  onLeave,
}: CpuTicTacToeProps) {
  const [board, setBoard] = useState<Array<Symbol | null>>(EMPTY_BOARD);
  const [turn, setTurn] = useState<Symbol>("X");
  const [winner, setWinner] = useState<Symbol | "draw" | null>(null);
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedWinnerRef = useRef<Symbol | "draw" | null>(null);

  const status = useMemo(() => {
    if (winner === "draw") {
      return "CPU Match | Draw";
    }
    if (winner === "X") {
      return "CPU Match | You win";
    }
    if (winner === "O") {
      return "CPU Match | CPU wins";
    }

    if (turn === "X") {
      return "CPU Match | Your turn";
    }

    return "CPU Match | CPU thinking...";
  }, [turn, winner]);

  const roomStatusIcon = winner ? <AiOutlineCheckCircle /> : turn === "X" ? <AiOutlinePlayCircle /> : <AiOutlineClockCircle />;

  const canPlay = turn === "X" && winner === null;
  const xResult = winner === "X" ? "winner" : winner === "O" ? "loser" : "neutral";
  const oResult = winner === "O" ? "winner" : winner === "X" ? "loser" : "neutral";

  const applyBoardState = (nextBoard: Array<Symbol | null>, nextTurn: Symbol) => {
    const result = evaluateBoard(nextBoard);
    setBoard(nextBoard);
    setTurn(nextTurn);
    setWinner(result);
  };

  const handleMove = (index: number) => {
    if (!canPlay || board[index] !== null) {
      return;
    }

    const nextBoard = [...board];
    nextBoard[index] = "X";
    const result = evaluateBoard(nextBoard);
    if (result) {
      setBoard(nextBoard);
      setWinner(result);
      return;
    }

    setBoard(nextBoard);
    setTurn("O");
  };

  const handleRematch = () => {
    setBoard([...EMPTY_BOARD]);
    setTurn("X");
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
      mode: "cpu",
      outcome: winner === "draw" ? "draw" : winner === "X" ? "win" : "loss",
      opponent: `CPU (${difficulty})`,
    });
  }, [difficulty, onMatchComplete, winner]);

  useEffect(() => {
    if (turn !== "O" || winner !== null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const move = getCpuMove(board, difficulty);
      if (move === null) {
        return;
      }

      const nextBoard = [...board];
      nextBoard[move] = "O";
      applyBoardState(nextBoard, "X");
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [turn, winner, board, difficulty]);

  const renderSquare = (index: number): React.JSX.Element => (
    <div className="square" onClick={() => handleMove(index)}>
      {board[index] === "X" ? <X /> : board[index] === "O" ? <O /> : null}
    </div>
  );

  return (
    <>
      <div>
        <h1>
          <span>Tic-</span>
          <span>Tac</span>
          <span>-Two</span>
        </h1>
      </div>
      <div>
        <motion.div drag dragMomentum={false} className="room-float-drag-root">
          <div className={`room-float-card${isRoomCardCollapsed ? " room-float-card-collapsed" : ""}`}>
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
                  <span className="room-float-title">CPU Match ({difficulty})</span>
                  <button
                    className="room-float-toggle-btn"
                    type="button"
                    onClick={() => setIsRoomCardCollapsed(true)}
                    aria-label="Collapse room info"
                    title="Collapse room info"
                  >
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
                    className="reset"
                    onClick={handleRematch}
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="pressed"
                    type="button"
                  >
                    <IconContext.Provider value={{ size: "1.5em", style: { marginRight: "5px" } }}>
                      <AiOutlineReload />
                    </IconContext.Provider>
                    rematch
                  </motion.button>

                  <motion.button
                    className="mute"
                    onClick={onToggleMusic}
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="pressed"
                    type="button"
                  >
                    <IconContext.Provider value={{ size: "1.5em", style: { marginRight: "5px" } }}>
                      <div className="flex ">
                        <AiOutlineSound /> {isMusicMuted ? <p>off</p> : ""}
                      </div>
                    </IconContext.Provider>
                    mute
                  </motion.button>

                  <motion.button
                    className="reset room-leave-round"
                    onClick={onLeave}
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="pressed"
                    type="button"
                  >
                    leave
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className="board">
          <div className="board-row">
            {renderSquare(0)}
            {renderSquare(1)}
            {renderSquare(2)}
          </div>
          <div className="board-row">
            {renderSquare(3)}
            {renderSquare(4)}
            {renderSquare(5)}
          </div>
          <div className="board-row">
            {renderSquare(6)}
            {renderSquare(7)}
            {renderSquare(8)}
          </div>
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
          winner === "X" ? (
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
        picture={`https://robohash.org/cpu-${difficulty}`}
        wins={0}
        losses={0}
        draws={0}
        result={oResult}
        mood={
          winner === "O" ? (
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
