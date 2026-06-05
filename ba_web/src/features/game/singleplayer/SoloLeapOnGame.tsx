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

type LeapOnAction = 'jump';

type LeapOnPlayerState = {
  symbol: GameSymbol;
  name: string;
  alive: boolean;
  score: number;
  stamina: number;
  action: LeapOnAction | null;
  angle: number;
  radius: number;
  momentum: number;
  multiplier: number;
  orbits: number;
  lastAngle: number;
  eliminatedBy: string | null;
  isCpu: boolean;
};

type LeapOnOrbState = {
  id: string;
  kind: 'safe' | 'hazard' | 'split';
  angle: number;
  radius: number;
  spin: number;
  drift: number;
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

const LEAP_ANCHOR_RADIUS = 16;

const LEAP_ORB_LAYOUT: LeapOnOrbState[] = [
  { id: 'safe-1', kind: 'safe', angle: 28, radius: 66, spin: 0, drift: 8 },
  { id: 'safe-2', kind: 'safe', angle: 116, radius: 78, spin: 0, drift: -7 },
  { id: 'safe-3', kind: 'safe', angle: 214, radius: 58, spin: 0, drift: 10 },
  { id: 'safe-4', kind: 'safe', angle: 302, radius: 84, spin: 0, drift: -9 },
  { id: 'hazard-1', kind: 'hazard', angle: 74, radius: 50, spin: 0, drift: -13 },
  { id: 'hazard-2', kind: 'hazard', angle: 258, radius: 72, spin: 0, drift: 12 },
  { id: 'split-1', kind: 'split', angle: 168, radius: 68, spin: 25, drift: 16 },
  { id: 'split-2', kind: 'split', angle: 336, radius: 54, spin: 205, drift: -15 },
];

const LEAP_ACTION_CONFIG: Record<LeapOnAction, {
  landingKinds: LeapOnOrbState['kind'][];
  radiusBoost: number;
  momentumBoost: number;
  score: number;
}> = {
  jump: {
    landingKinds: ['safe', 'split'],
    radiusBoost: 16,
    momentumBoost: 1.05,
    score: 18,
  },
};

const normalizeLeapAngle = (angle: number) => ((angle % 360) + 360) % 360;

const getLeapAngleDistance = (firstAngle: number, secondAngle: number) => {
  const difference = Math.abs(normalizeLeapAngle(firstAngle) - normalizeLeapAngle(secondAngle));
  return Math.min(difference, 360 - difference);
};

const createLeapOrbs = () => LEAP_ORB_LAYOUT.map((orb) => ({ ...orb }));

const advanceLeapOrbsLive = (orbs: LeapOnOrbState[], deltaSeconds: number) =>
  orbs.map((orb) => ({
    ...orb,
    angle: normalizeLeapAngle(orb.angle + orb.drift * deltaSeconds * 0.9),
    spin: normalizeLeapAngle(orb.spin + 96 * deltaSeconds),
  }));

const getPolarStyle = (angle: number, radius: number): React.CSSProperties => {
  const radians = (angle * Math.PI) / 180;
  const distance = Math.max(0, Math.min(92, radius)) * 0.43;
  return {
    left: `${50 + Math.cos(radians) * distance}%`,
    top: `${50 + Math.sin(radians) * distance}%`,
    '--leap-angle': `${angle}deg`,
  } as React.CSSProperties;
};

const getOrbStyle = (angle: number, radius: number, spin: number): React.CSSProperties => ({
  ...getPolarStyle(angle, radius),
  '--leap-spin': `${spin}deg`,
} as React.CSSProperties);

const getOpponentLabels = (mode: GameMode) => {
  if (mode === 'cpu') {
    return ['CPU Rebound', 'CPU Drift', 'CPU Smash'];
  }
  return ['Local Rival', 'Local Buddy', 'Local Pal'];
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
      angle: 12,
      radius: 76,
      momentum: 3,
      multiplier: 1,
      orbits: 0,
      lastAngle: 12,
      eliminatedBy: null,
      isCpu: false,
    },
    {
      symbol: 'O' as GameSymbol,
      name: opponentNames[0],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      angle: 100,
      radius: 76,
      momentum: 3,
      multiplier: 1,
      orbits: 0,
      lastAngle: 100,
      eliminatedBy: null,
      isCpu: true,
    },
    {
      symbol: 'Y' as GameSymbol,
      name: opponentNames[1],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      angle: 188,
      radius: 76,
      momentum: 3,
      multiplier: 1,
      orbits: 0,
      lastAngle: 188,
      eliminatedBy: null,
      isCpu: true,
    },
    {
      symbol: 'Z' as GameSymbol,
      name: opponentNames[2],
      alive: true,
      score: 0,
      stamina: 3,
      action: null,
      angle: 276,
      radius: 76,
      momentum: 3,
      multiplier: 1,
      orbits: 0,
      lastAngle: 276,
      eliminatedBy: null,
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

const findLeapLandingOrb = (orbs: LeapOnOrbState[], playerState: LeapOnPlayerState, action: LeapOnAction) => {
  const config = LEAP_ACTION_CONFIG[action];
  const targetRadius = Math.min(92, playerState.radius + config.radiusBoost);
  const targetAngle = normalizeLeapAngle(playerState.angle + 34 + playerState.momentum * 3);
  return orbs
    .filter((orb) => config.landingKinds.includes(orb.kind))
    .map((orb) => ({
      orb,
      score:
        Math.abs(orb.radius - targetRadius) * 1.45 +
        getLeapAngleDistance(orb.angle, targetAngle),
    }))
    .sort((first, second) => first.score - second.score)[0]?.orb ?? null;
};

const isLeapSplitWhiteSide = (orb: LeapOnOrbState, playerAngle: number) => {
  return getLeapAngleDistance(orb.spin, playerAngle) <= 90;
};

const getTouchedOrb = (orbs: LeapOnOrbState[], playerState: LeapOnPlayerState) =>
  orbs.find((orb) => (
    Math.abs(orb.radius - playerState.radius) < 6 &&
    getLeapAngleDistance(orb.angle, playerState.angle) < 10
  )) ?? null;

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
  const [orbs, setOrbs] = useState<LeapOnOrbState[]>(() => createLeapOrbs());
  const [timeMs, setTimeMs] = useState(0);
  const [winner, setWinner] = useState<GameSymbol | 'draw' | null>(null);
  const [message, setMessage] = useState('Chain white-orb landings and stay outside the anchor.');
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedWinnerRef = useRef<GameSymbol | 'draw' | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const jumpQueuedRef = useRef(false);
  const playersRef = useRef(players);
  const orbsRef = useRef(orbs);
  const gameLabel = formatGameName(gameType as any, gameDefinitions);
  const statusText = winner
    ? winner === 'draw'
      ? 'Draw'
      : winner === 'X'
        ? 'You win'
        : 'You lose'
    : 'Live orbit';
  const controllerButtons = [
    { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: () => handleRematch() },
  ];

  const queueJump = () => {
    if (winner) {
      return;
    }
    jumpQueuedRef.current = true;
  };

  const handleRematch = () => {
    setPlayers(createParticipants(player.name, mode));
    setOrbs(createLeapOrbs());
    setTimeMs(0);
    setWinner(null);
    setMessage('Chain white-orb landings and stay outside the anchor.');
    lastReportedWinnerRef.current = null;
    lastFrameTimeRef.current = null;
    jumpQueuedRef.current = false;
  };

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    orbsRef.current = orbs;
  }, [orbs]);

  useEffect(() => {
    if (winner) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      event.preventDefault();
      queueJump();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [winner]);

  useEffect(() => {
    if (winner) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const step = (timestamp: number) => {
      const previousTimestamp = lastFrameTimeRef.current ?? timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0.001, (timestamp - previousTimestamp) / 1000));
      lastFrameTimeRef.current = timestamp;

      const nextOrbs = advanceLeapOrbsLive(orbsRef.current, deltaSeconds);
      orbsRef.current = nextOrbs;
      setOrbs(nextOrbs);
      setTimeMs((value) => value + Math.round(deltaSeconds * 1000));

      const nextPlayers = playersRef.current.map((playerState): LeapOnPlayerState => ({ ...playerState, action: null }));
      let nextMessage: string | null = null;

      nextPlayers.forEach((playerState) => {
        if (!playerState.alive) {
          return;
        }

        const previousAngle = playerState.angle;
        playerState.angle = normalizeLeapAngle(playerState.angle + (44 + playerState.momentum * 6) * deltaSeconds);
        playerState.radius = Math.max(0, playerState.radius - (4.8 + playerState.multiplier * 0.18) * deltaSeconds + playerState.momentum * 0.012);
        playerState.momentum = Math.max(0, playerState.momentum - 0.36 * deltaSeconds);

        if (playerState.angle < previousAngle && previousAngle - playerState.angle > 120) {
          playerState.orbits += 1;
          playerState.multiplier = Math.min(9, playerState.multiplier + 0.5);
          playerState.score += Math.round(20 * playerState.multiplier);
        }

        const shouldJump = playerState.symbol === 'X'
          ? jumpQueuedRef.current
          : playerState.radius < 48 || Boolean(findLeapLandingOrb(nextOrbs, playerState, 'jump'));

        if (shouldJump) {
          playerState.action = 'jump';
          const landingOrb = findLeapLandingOrb(nextOrbs, playerState, 'jump');
          if (
            landingOrb &&
            (landingOrb.kind !== 'split' || isLeapSplitWhiteSide(landingOrb, landingOrb.angle))
          ) {
            playerState.angle = normalizeLeapAngle(landingOrb.angle);
            playerState.lastAngle = playerState.angle;
            playerState.radius = Math.min(92, Math.max(LEAP_ANCHOR_RADIUS + 10, landingOrb.radius + 6));
            playerState.momentum = Math.min(12, playerState.momentum + 2.3);
            playerState.stamina = Math.min(5, playerState.stamina + 1);
            playerState.score += Math.round(16 * playerState.multiplier);
            if (playerState.symbol === 'X') {
              nextMessage = landingOrb.kind === 'split' ? 'Clean white-side split landing.' : 'White orb chained.';
            }
          } else {
            playerState.radius = Math.max(0, playerState.radius - 7);
            playerState.momentum = Math.max(0, playerState.momentum - 1.6);
            playerState.stamina = Math.max(0, playerState.stamina - 1);
            if (playerState.symbol === 'X') {
              nextMessage = 'No landing window. The anchor pulls harder.';
            }
          }
        }

        const touchedOrb = getTouchedOrb(nextOrbs, playerState);
        if (touchedOrb?.kind === 'hazard') {
          playerState.alive = false;
          playerState.eliminatedBy = 'black orb';
        } else if (touchedOrb?.kind === 'split' && !isLeapSplitWhiteSide(touchedOrb, touchedOrb.angle)) {
          playerState.alive = false;
          playerState.eliminatedBy = 'black side';
        } else if (playerState.radius <= LEAP_ANCHOR_RADIUS) {
          playerState.alive = false;
          playerState.eliminatedBy = 'central anchor';
        }
      });

      jumpQueuedRef.current = false;

      const survivors = nextPlayers.filter((playerState) => playerState.alive);
      const winnerSymbol = survivors[0]?.symbol;
      const isDraw = survivors.length <= 1 && !winnerSymbol;

      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);
      if (nextMessage) {
        setMessage(nextMessage);
      }
      if (survivors.length <= 1) {
        const nextWinner: GameSymbol | 'draw' = isDraw ? 'draw' : winnerSymbol!;
        setWinner(nextWinner);
        setMessage(isDraw ? 'Everyone was pulled in.' : `${survivors[0].name} outlasted the arena.`);
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [winner]);

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

  const gameTitle = `${gameLabel} | ${mode === 'cpu' ? 'CPU Match' : 'Local Match'}`;

  const symbolPositionMap: Record<GameSymbol, 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = {
    X: 'top-left',
    O: 'top-right',
    Y: 'bottom-left',
    Z: 'bottom-right',
  };

  const renderPlayerCard = (playerState: LeapOnPlayerState) => {
    const position = symbolPositionMap[playerState.symbol];
    const result = (winner && winner !== 'draw'
      ? winner === playerState.symbol
        ? 'winner'
        : 'loser'
      : 'neutral') as 'winner' | 'loser' | 'neutral';

    const mood = winner
      ? playerState.symbol === winner
        ? <span className="player-state winner">Winner</span>
        : playerState.alive
          ? <span className="player-state ready">Alive</span>
          : <span className="player-state">Out</span>
      : playerState.symbol === 'X'
        ? <span className="player-state you">You</span>
        : playerState.alive
          ? <span className="player-state ready">Alive</span>
          : <span className="player-state">Out</span>;

    const playerProps = {
      alias: playerState.name,
      picture: `https://robohash.org/${playerState.name}`,
      pieceLabel: playerState.symbol === 'X' ? 'You' : playerState.symbol,
      wins: 0,
      losses: 0,
      draws: 0,
      mood,
      result,
      position,
    };

    switch (playerState.symbol) {
      case 'O':
        return <PlayerO key={playerState.symbol} {...playerProps} />;
      case 'Y':
        return <PlayerY key={playerState.symbol} {...playerProps} />;
      case 'Z':
        return <PlayerZ key={playerState.symbol} {...playerProps} />;
      default:
        return <PlayerX key={playerState.symbol} {...playerProps} />;
    }
  };

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
          <div className={`room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
            {isInfoCardCollapsed ? (
              <button
                className="room-float-collapsed-center"
                type="button"
                onClick={() => setIsInfoCardCollapsed(false)}
                aria-label="Expand game info"
                title="Expand game info"
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
                    <AiOutlineInfoCircle className="room-float-title-icon" /> {gameTitle}
                  </span>
                  <button
                    className="room-float-toggle-btn"
                    type="button"
                    onClick={() => setIsInfoCardCollapsed(true)}
                    aria-label="Collapse game info"
                    title="Collapse game info"
                  >
                    <AiOutlineArrowDown />
                  </button>
                </div>
              </>
            )}

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
                  <AiOutlinePlayCircle /> {playerState.name} | {playerState.alive ? 'Alive' : 'Out'} | Score {playerState.score}
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
              <p>Time {(timeMs / 1000).toFixed(1)}s</p>
            </div>

            <div className="leap-orbit-stage" aria-label="Leap arena">
              <div className="leap-anchor" />
              <div className="leap-anchor-ring" />
              {orbs.map((orb) => (
                <span
                  key={orb.id}
                  className={`leap-orb leap-orb-${orb.kind}`}
                  style={getOrbStyle(orb.angle, orb.radius, orb.spin)}
                  title={orb.kind === 'safe' ? 'White orb' : orb.kind === 'hazard' ? 'Black orb' : 'Split orb'}
                />
              ))}
              {players.map((playerState) => (
                <span
                  key={playerState.symbol}
                  className={`leap-runner leap-runner-${playerState.symbol.toLowerCase()}${playerState.alive ? '' : ' leap-runner-out'}`}
                  style={getPolarStyle(playerState.angle, playerState.radius)}
                  title={`${playerState.name} ${playerState.alive ? 'alive' : 'eliminated'}`}
                >
                  {playerState.symbol}
                </span>
              ))}
            </div>

            <div className="leap-on-actions">
              <motion.button
                className="leap-on-action-btn leap-on-action-btn-primary"
                type="button"
                disabled={Boolean(winner) || !players.find((playerState) => playerState.symbol === 'X')?.alive}
                onClick={queueJump}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                <strong>Leap</strong>
                <span>Space / tap when a white landing window lines up.</span>
              </motion.button>
            </div>

            {players.map(renderPlayerCard)}
          </div>
        </div>
      </div>
    </>
  );
}
