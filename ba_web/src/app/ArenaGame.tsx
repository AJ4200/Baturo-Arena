'use client';

import React from 'react';
import { CpuArenaGame } from '@/features/game/CpuArenaGame';
import { OnlineArenaGame } from '@/features/game/OnlineArenaGame';
import type {
  CpuDifficulty,
  GameDefinition,
  GameMode,
  GameType,
  MatchResultEvent,
  PlayerProfile,
} from '@/types/game';

type ArenaGameProps = {
  mode: GameMode;
  roomCode: string | null;
  player: PlayerProfile;
  gameType: GameType;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  onToggleMusic: () => void;
  runWithLoader: <T>(task: () => Promise<T>, showLoader?: boolean) => Promise<T>;
  onProfileUpdate: (player: PlayerProfile) => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
  cpuDifficulty: CpuDifficulty;
};

const ArenaGame: React.FC<ArenaGameProps> = ({
  mode,
  roomCode,
  player,
  gameType,
  gameDefinitions,
  isMusicMuted,
  onToggleMusic,
  runWithLoader,
  onProfileUpdate,
  onMatchComplete,
  onLeave,
  cpuDifficulty,
}) => {
  if (mode === 'cpu') {
    return (
      <CpuArenaGame
        player={player}
        gameType={gameType}
        gameDefinitions={gameDefinitions}
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
    <OnlineArenaGame
      roomCode={roomCode}
      player={player}
      gameDefinitions={gameDefinitions}
      isMusicMuted={isMusicMuted}
      onToggleMusic={onToggleMusic}
      runWithLoader={runWithLoader}
      onProfileUpdate={onProfileUpdate}
      onMatchComplete={onMatchComplete}
      onLeave={onLeave}
    />
  );
};

export default ArenaGame;
