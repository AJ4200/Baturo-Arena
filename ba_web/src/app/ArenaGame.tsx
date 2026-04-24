'use client';

import React from 'react';
import { CpuArenaGame } from '@/features/game/CpuArenaGame';
import { LudoArenaGame } from '@/features/game/LudoArenaGame';
import { OnlineLudoArenaGame } from '@/features/game/OnlineLudoArenaGame';
import { SoloDinoGame } from '@/features/game/singleplayer/SoloDinoGame';
import { SoloMemoryMatchGame } from '@/features/game/singleplayer/SoloMemoryMatchGame';
import { SoloMinesweeperGame } from '@/features/game/singleplayer/SoloMinesweeperGame';
import { OnlineArenaGame } from '@/features/game/OnlineArenaGame';
import { OfflineArenaGame } from '@/features/game/OfflineArenaGame';
import { Solo2048Game } from '@/features/game/singleplayer/Solo2048Game';
import { SoloSudokuGame } from '@/features/game/singleplayer/SoloSudokuGame';
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
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  runWithLoader: <T>(task: () => Promise<T>, showLoader?: boolean) => Promise<T>;
  onProfileUpdate: (player: PlayerProfile) => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
  cpuDifficulty: CpuDifficulty;
  offlineParticipantNames: string[];
  offlineParticipantCount: number;
};

const ArenaGame: React.FC<ArenaGameProps> = ({
  mode,
  roomCode,
  player,
  gameType,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  runWithLoader,
  onProfileUpdate,
  onMatchComplete,
  onLeave,
  cpuDifficulty,
  offlineParticipantNames,
  offlineParticipantCount,
}) => {
  if (gameType === '2048') {
    return (
      <Solo2048Game
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'sudoku') {
    return (
      <SoloSudokuGame
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'minesweeper') {
    return (
      <SoloMinesweeperGame
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'memory-match') {
    return (
      <SoloMemoryMatchGame
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'dino-run') {
    return (
      <SoloDinoGame
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'ludo' && mode === 'online') {
    if (!roomCode) {
      return null;
    }
    return (
      <OnlineLudoArenaGame
        roomCode={roomCode}
        player={player}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        runWithLoader={runWithLoader}
        onProfileUpdate={onProfileUpdate}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (gameType === 'ludo') {
    return (
      <LudoArenaGame
        player={player}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        gameDefinitions={gameDefinitions}
        participantNames={offlineParticipantNames}
        participantCount={offlineParticipantCount}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (mode === 'cpu') {
    return (
      <CpuArenaGame
        player={player}
        gameType={gameType}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        difficulty={cpuDifficulty}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
      />
    );
  }

  if (mode === 'offline') {
    return (
      <OfflineArenaGame
        player={player}
        gameType={gameType}
        gameDefinitions={gameDefinitions}
        participantNames={offlineParticipantNames}
        participantCount={offlineParticipantCount}
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
      enableAnimations={enableAnimations}
      onToggleMusic={onToggleMusic}
      onToggleAnimations={onToggleAnimations}
      runWithLoader={runWithLoader}
      onProfileUpdate={onProfileUpdate}
      onMatchComplete={onMatchComplete}
      onLeave={onLeave}
    />
  );
};

export default ArenaGame;
