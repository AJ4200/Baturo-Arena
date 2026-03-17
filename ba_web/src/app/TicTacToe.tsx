"use client";

import React from "react";
import { CpuTicTacToe } from "@/features/game/CpuTicTacToe";
import { OnlineTicTacToe } from "@/features/game/OnlineTicTacToe";
import type {
  CpuDifficulty,
  GameMode,
  MatchResultEvent,
  PlayerProfile,
} from "@/types/game";

type TicTacToeProps = {
  mode: GameMode;
  roomCode: string | null;
  player: PlayerProfile;
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  runWithLoader: <T>(task: () => Promise<T>, showLoader?: boolean) => Promise<T>;
  onProfileUpdate: (player: PlayerProfile) => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
  cpuDifficulty: CpuDifficulty;
};

const TicTacToe: React.FC<TicTacToeProps> = ({
  mode,
  roomCode,
  player,
  isMusicMuted,
  onToggleMusic,
  runWithLoader,
  onProfileUpdate,
  onMatchComplete,
  onLeave,
  cpuDifficulty,
}) => {
  if (mode === "cpu") {
    return (
      <CpuTicTacToe
        player={player}
        isMusicMuted={isMusicMuted}
        onToggleMusic={onToggleMusic}
        difficulty={cpuDifficulty}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (!roomCode) {
    return null;
  }

  return (
    <OnlineTicTacToe
      roomCode={roomCode}
      player={player}
      isMusicMuted={isMusicMuted}
      onToggleMusic={onToggleMusic}
      runWithLoader={runWithLoader}
      onProfileUpdate={onProfileUpdate}
      onMatchComplete={onMatchComplete}
      onLeave={onLeave}
    />
  );
};

export default TicTacToe;
