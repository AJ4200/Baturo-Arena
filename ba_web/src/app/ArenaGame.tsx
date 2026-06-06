'use client';

import React from 'react';
import { CpuArenaGame } from '@/features/game/CpuArenaGame';
import { LudoArenaGame } from '@/features/game/multiplayer/LudoArenaGame';
import { OnlineLudoArenaGame } from '@/features/game/multiplayer/OnlineLudoArenaGame';
import { OnlineLeapOnArenaGame } from '@/features/game/multiplayer/OnlineLeapOnArenaGame';
import { SoloLeapOnGame } from '@/features/game/singleplayer/SoloLeapOnGame';
import { SoloDinoGame } from '@/features/game/singleplayer/SoloDinoGame';
import { SoloMemoryMatchGame } from '@/features/game/singleplayer/SoloMemoryMatchGame';
import { SoloMinesweeperGame } from '@/features/game/singleplayer/SoloMinesweeperGame';
import { SoloSnakeGame } from '@/features/game/singleplayer/SoloSnakeGame';
import { SoloSpaceInvadersGame } from '@/features/game/singleplayer/SoloSpaceInvadersGame';
import { SoloNeonPongGame } from '@/features/game/singleplayer/SoloNeonPongGame';
import { SoloBrickBreakerGame } from '@/features/game/singleplayer/SoloBrickBreakerGame';
import { SoloTetrisGame } from '@/features/game/singleplayer/SoloTetrisGame';
import { SoloStarfallSurvivorGame } from '@/features/game/singleplayer/SoloStarfallSurvivorGame';
import { SoloPulseForgeGame } from '@/features/game/singleplayer/SoloPulseForgeGame';
import { SoloBlackjackGame } from '@/features/game/singleplayer/SoloBlackjackGame';
import { AirHockeyArenaGame } from '@/features/game/multiplayer/AirHockeyArenaGame';
import { RacingArenaGame } from '@/features/game/multiplayer/RacingArenaGame';
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

  if (gameType === 'snake') {
    return (
      <SoloSnakeGame
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


  if (gameType === 'brickbreaker') {
    return (
      <SoloBrickBreakerGame
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

  if (gameType === 'air-hockey') {
    return (
      <AirHockeyArenaGame
        player={player}
        mode={mode}
        roomCode={roomCode}
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

  if (gameType === 'blackjack') {
    return (
      <SoloBlackjackGame
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

  if (gameType === 'turbo-rush') {
    return (
      <RacingArenaGame
        player={player}
        mode={mode}
        roomCode={roomCode}
        gameDefinitions={gameDefinitions}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        onMatchComplete={onMatchComplete}
        onLeave={onLeave}
        offlineParticipantNames={offlineParticipantNames}
        offlineParticipantCount={offlineParticipantCount}
      />
    );
  }

  if (gameType === 'space-invaders') {
    return (
      <SoloSpaceInvadersGame
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

  if (gameType === 'neon-pong') {
    return (
      <SoloNeonPongGame
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

  if (gameType === 'tetris') {
    return (
      <SoloTetrisGame
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

  if (gameType === 'starfall-survivor') {
    return (
      <SoloStarfallSurvivorGame
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

  if (gameType === 'pulse-forge') {
    return (
      <SoloPulseForgeGame
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

  if (gameType === 'leap-on' && mode === 'online') {
    if (!roomCode) {
      return null;
    }
    return (
      <OnlineLeapOnArenaGame
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

  if (gameType === 'leap-on') {
    return (
      <SoloLeapOnGame
        player={player}
        mode={mode}
        gameType={gameType}
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

  if (gameType === 'ludo') {
    return (
      <LudoArenaGame
        player={player}
        mode={mode}
        isMusicMuted={isMusicMuted}
        enableAnimations={enableAnimations}
        onToggleMusic={onToggleMusic}
        onToggleAnimations={onToggleAnimations}
        gameDefinitions={gameDefinitions}
        cpuDifficulty={cpuDifficulty}
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
