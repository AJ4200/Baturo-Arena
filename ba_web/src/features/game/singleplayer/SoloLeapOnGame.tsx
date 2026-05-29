'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AiOutlineReload,
  AiOutlineInfoCircle,
  AiOutlineDrag,
  AiOutlineArrowDown,
  AiOutlineSound,
  AiOutlineCheckCircle,
  AiOutlinePlayCircle,
  AiOutlineClockCircle,
  AiOutlineTeam,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import PlayerO from '@/components/game/player/PlayerO';
import PlayerX from '@/components/game/player/PlayerX';
import PlayerY from '@/components/game/player/PlayerY';
import PlayerZ from '@/components/game/player/PlayerZ';
import type {
  GameDefinition,
  GameMode,
  GameSymbol,
  MatchResultEvent,
  PlayerProfile,
} from '@/types/game';

type LeapOnAction = 'jump' | 'dash' | 'block' | 'wait';

type LeapOnPlayerState = {
  symbol: GameSymbol;
  name: string;
  alive: boolean;
  score: number;
  stamina: number;
  action: LeapOnAction | null;
  isCpu: boolean;
};

type SoloLeapOnGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  gameType: string;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const ACTION_LABELS: Record<LeapOnAction, string> = {
  jump: 'Jump',
  dash: 'Dash',
  block: 'Block',
  wait: 'Brace',
};

const ACTION_DESCRIPTIONS: Record<LeapOnAction, string> = {
  jump: 'Leap over danger and earn extra momentum.',
  dash: 'Charge a rival and can knock them off balance.',
  block: 'Brace against impacts and reduce knockback.',
  wait: 'Stay safe and recover your rhythm.',
};

const getPlayerVisual = (player: LeapOnPlayerState) => {
  switch (player.symbol) {
    case 'O':
      return <PlayerO pieceLabel={player.name} alias={player.name} picture={`https://robohash.org/${player.name}`} wins={0} losses={0} draws={0} />;
    case 'Y':
      return <PlayerY pieceLabel={player.name} alias={player.name} picture={`https://robohash.org/${player.name}`} wins={0} losses={0} draws={0} />;
    case 'Z':
      return <PlayerZ pieceLabel={player.name} alias={player.name} picture={`https://robohash.org/${player.name}`} wins={0} losses={0} draws={0} />;
    default:
      return <PlayerX pieceLabel={player.name} alias={player.name} picture={`https://robohash.org/${player.name}`} wins={0} losses={0} draws={0} />;
  }
};

const getOpponentLabels = (mode: GameMode) => {
  if (mode === 'cpu') {
    return ['CPU Rebound', 'CPU Drift', 'CPU Smash'];
  }
  return ['Local Rival', 'Local Buddy', 'Local Pal'];
};

const chooseCpuAction = (player: LeapOnPlayerState) => {
  if (player.score >= 10 && Math.random() < 0.5) {
    return 'dash' as LeapOnAction;
  }
  if (player.stamina <= 1) {
    return 'jump' as LeapOnAction;
  }
  const roll = Math.random();
  if (roll < 0.4) return 'jump';
  if (roll < 0.7) return 'dash';
  if (roll < 0.9) return 'block';
  return 'wait';
};

const createParticipants = (playerName: string, mode: GameMode): LeapOnPlayerState[] => {
  const opponentNames = getOpponentLabels(mode);
  const base = [
    {
      symbol: 'X' as GameSymbol,
      name: playerName,
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      isCpu: false,
    },
    {
      symbol: 'O' as GameSymbol,
      name: opponentNames[0],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      isCpu: true,
    },
    {
      symbol: 'Y' as GameSymbol,
      name: opponentNames[1],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      isCpu: true,
    },
    {
      symbol: 'Z' as GameSymbol,
      name: opponentNames[2],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      isCpu: true,
    },
  ];

  return mode === 'offline' ? base.slice(0, 2) : base;
};

const describeOutcome = (winner: GameSymbol | 'draw' | null, playerSymbol: GameSymbol) => {
  if (winner === 'draw') {
    return 'draw';
  }
  return winner === playerSymbol ? 'win' : 'loss';
};

export function SoloLeapOnGame({
  player,
  mode,
  gameType,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloLeapOnGameProps) {
  const [players, setPlayers] = useState<LeapOnPlayerState[]>(() => createParticipants(player.name, mode));
  const [turn, setTurn] = useState<GameSymbol>('X');
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState<GameSymbol | 'draw' | null>(null);
  const [message, setMessage] = useState('Ready to leap on!');
  const lastReportedWinnerRef = useRef<GameSymbol | 'draw' | null>(null);
  const gameLabel = formatGameName(gameType as any, gameDefinitions);
  const currentPlayer = players.find((playerState) => playerState.symbol === turn);
  const isCurrentHuman = currentPlayer ? !currentPlayer.isCpu : false;
  const statusText = winner
    ? winner === 'draw'
      ? 'Draw'
      : winner === 'X'
        ? 'You win'
        : 'You lose'
    : currentPlayer
      ? `${currentPlayer.name}'s turn`
      : 'Waiting for next turn';
  const controllerButtons = [
    { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: () => handleRematch() },
  ];

  const updatePlayers = (
    currentPlayers: LeapOnPlayerState[],
    symbol: GameSymbol,
    action: LeapOnAction
  ) => {
    const nextPlayers = currentPlayers.map((playerState) => ({ ...playerState, action: null }));
    const active = nextPlayers.find((playerState) => playerState.symbol === symbol);
    if (!active || !active.alive) {
      return { nextPlayers: currentPlayers, message: 'Cannot perform action from eliminated player', aliveCount: 0 };
    }

    active.action = action;
    let roundMessage = `${active.name} uses ${ACTION_LABELS[action]}.`;
    if (action === 'jump') {
      active.score += 2;
    } else if (action === 'dash' || action === 'block') {
      active.score += 1;
    }

    const alivePlayers = nextPlayers.filter((playerState) => playerState.alive);
    if (action === 'dash' && alivePlayers.length > 1) {
      const targets = alivePlayers.filter((playerState) => playerState.symbol !== symbol);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (target && target.action !== 'block' && Math.random() < 0.56) {
        target.alive = false;
        roundMessage += ` ${target.name} was knocked off!`;
      }
    }

    nextPlayers.forEach((playerState) => {
      if (!playerState.alive || playerState.symbol === symbol) {
        return;
      }
      const hazardChance = playerState.action === 'block' ? 0.08 : 0.22;
      if (playerState.action !== 'jump' && Math.random() < hazardChance) {
        playerState.alive = false;
        roundMessage += ` ${playerState.name} tumbled off the arena.`;
      }
    });

    if (action !== 'jump' && Math.random() < 0.16) {
      active.alive = false;
      roundMessage += ` ${active.name} missed the landing!`;
    }

    const aliveCount = nextPlayers.filter((playerState) => playerState.alive).length;
    return { nextPlayers, message: roundMessage, aliveCount };
  };

  const advanceToNextTurn = (activeSymbol: GameSymbol, nextPlayers: LeapOnPlayerState[]) => {
    const survivors = nextPlayers.filter((playerState) => playerState.alive);
    if (survivors.length === 0) {
      return activeSymbol;
    }
    const symbols = survivors.map((playerState) => playerState.symbol);
    const current = symbols.indexOf(activeSymbol);
    if (current < 0 || current === symbols.length - 1) {
      return symbols[0];
    }
    return symbols[current + 1];
  };

  const commitAction = (action: LeapOnAction) => {
    if (!currentPlayer || !currentPlayer.alive || winner) {
      return;
    }

    const { nextPlayers, message: nextMessage, aliveCount } = updatePlayers(players, turn, action);
    const nextTurn = advanceToNextTurn(turn, nextPlayers);
    const nextWinner = aliveCount <= 1 ? nextPlayers.find((playerState) => playerState.alive)?.symbol ?? 'draw' : null;

    setPlayers(nextPlayers);
    setRound((value) => value + 1);
    setMessage(nextMessage);
    setTurn(nextWinner ? turn : nextTurn);
    setWinner(nextWinner);
  };

  const handleAction = (action: LeapOnAction) => {
    if (!isCurrentHuman || !currentPlayer || winner) {
      return;
    }
    commitAction(action);
  };

  const handleRematch = () => {
    setPlayers(createParticipants(player.name, mode));
    setTurn('X');
    setRound(1);
    setWinner(null);
    setMessage('Ready to leap on!');
    lastReportedWinnerRef.current = null;
  };

  useEffect(() => {
    if (!currentPlayer || winner || !currentPlayer.isCpu) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const cpuAction = chooseCpuAction(currentPlayer);
      commitAction(cpuAction);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPlayer, winner, players]);

  useEffect(() => {
    if (!winner || lastReportedWinnerRef.current === winner) {
      return;
    }

    lastReportedWinnerRef.current = winner;
    onMatchComplete({
      mode,
      gameType: gameType as any,
      outcome: describeOutcome(winner, 'X'),
      opponent: players.filter((playerState) => playerState.symbol !== 'X').map((playerState) => playerState.name).join(', '),
    });
  }, [gameType, mode, onMatchComplete, players, winner]);

  const availableActions: LeapOnAction[] = ['jump', 'dash', 'block', 'wait'];
  const gameTitle = `${gameLabel} | ${mode === 'cpu' ? 'CPU Match' : 'Local Match'}`;

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameTitle}
        subtitle={statusText}
        buttons={controllerButtons}
      />

      <div>
        <motion.div drag dragMomentum={false} className="room-float-drag-root">
          <div className="room-float-card">
            <div className="room-float-header">
              <span className="room-float-anchor">
                <AiOutlineDrag /> drag
              </span>
              <span className="room-float-title">
                <AiOutlineInfoCircle className="room-float-title-icon" /> {gameTitle}
              </span>
              <button
                className="room-float-toggle-btn"
                type="button"
                onClick={onLeave}
                aria-label="Leave"
                title="Leave"
              >
                <AiOutlineArrowDown />
              </button>
            </div>

            <div className="room-score-strip">
              <span className="room-float-line">
                {winner ? <AiOutlineCheckCircle /> : <AiOutlineClockCircle />} {statusText}
              </span>
            </div>

            <div className="room-joined">
              <p className="room-joined-title">
                <AiOutlineTeam /> Arena Players ({players.filter((playerState) => playerState.alive).length})
              </p>
              {players.map((playerState) => (
                <p key={playerState.symbol} className="room-joined-line">
                  <AiOutlinePlayCircle /> {playerState.name} — {playerState.alive ? 'Alive' : 'Out'} — Score {playerState.score}
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
                onClick={onLeave}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Leave
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="board-stage-card">
          <div className="leap-on-arena-board">
            <div className="leap-on-arena-status">
              <p>{message}</p>
              <p>Round {round}</p>
            </div>

            <div className="leap-on-actions">
              {availableActions.map((action) => (
                <motion.button
                  key={action}
                  className="leap-on-action-btn"
                  type="button"
                  disabled={!isCurrentHuman || Boolean(winner) || !currentPlayer?.alive}
                  onClick={() => handleAction(action)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <strong>{ACTION_LABELS[action]}</strong>
                  <span>{ACTION_DESCRIPTIONS[action]}</span>
                </motion.button>
              ))}
            </div>

            <div className="leap-on-score-grid">
              {players.map((playerState) => (
                <div
                  key={playerState.symbol}
                  className={`leap-on-score-card${playerState.alive ? '' : ' leap-on-score-card-eliminated'}`}
                >
                  <div className="leap-on-score-card-header">
                    {getPlayerVisual(playerState)}
                    <div>
                      <p>{playerState.name}</p>
                      <p>{playerState.alive ? 'Alive' : 'Eliminated'}</p>
                    </div>
                  </div>
                  <div className="leap-on-score-details">
                    <span>Score {playerState.score}</span>
                    <span>Stamina {playerState.stamina}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
