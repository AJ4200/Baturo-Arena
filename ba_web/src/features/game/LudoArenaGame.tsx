'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCrown,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineThunderbolt,
  AiOutlineTeam,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type LudoArenaGameProps = {
  player: PlayerProfile;
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  gameDefinitions: GameDefinition[];
  participantNames: string[];
  participantCount: number;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type LudoColor = 'red' | 'blue' | 'yellow' | 'green';

type LudoParticipant = {
  color: LudoColor;
  name: string;
  index: number;
};

type LudoToken = {
  id: string;
  color: LudoColor;
  slot: number;
  progress: number;
};

const PLAYER_COLORS: LudoColor[] = ['red', 'blue', 'yellow', 'green'];
const TOKENS_PER_PLAYER = 4;
const HOME_PROGRESS = 57;
const HOME_LANE_START_PROGRESS = 51;
const SAFE_TRACK_INDEXES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_META: Record<LudoColor, { label: string }> = {
  red: { label: 'Red' },
  blue: { label: 'Blue' },
  yellow: { label: 'Yellow' },
  green: { label: 'Green' },
};

const START_INDEX_BY_COLOR: Record<LudoColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  green: 39,
};

const TRACK_COORDS: Array<[number, number]> = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];

const HOME_LANE_COORDS: Record<LudoColor, Array<[number, number]>> = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  blue: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
  green: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7],
  ],
};

const YARD_COORDS: Record<LudoColor, Array<[number, number]>> = {
  red: [
    [2, 2],
    [2, 4],
    [4, 2],
    [4, 4],
  ],
  blue: [
    [2, 10],
    [2, 12],
    [4, 10],
    [4, 12],
  ],
  yellow: [
    [10, 10],
    [10, 12],
    [12, 10],
    [12, 12],
  ],
  green: [
    [10, 2],
    [10, 4],
    [12, 2],
    [12, 4],
  ],
};

const TRACK_KEY_SET = new Set<string>(TRACK_COORDS.map(([row, column]) => `${row}-${column}`));
const SAFE_KEY_SET = new Set<string>(
  Array.from(SAFE_TRACK_INDEXES).map((index) => {
    const [row, column] = TRACK_COORDS[index];
    return `${row}-${column}`;
  })
);

const HOME_KEY_SETS: Record<LudoColor, Set<string>> = {
  red: new Set(HOME_LANE_COORDS.red.map(([row, column]) => `${row}-${column}`)),
  blue: new Set(HOME_LANE_COORDS.blue.map(([row, column]) => `${row}-${column}`)),
  yellow: new Set(HOME_LANE_COORDS.yellow.map(([row, column]) => `${row}-${column}`)),
  green: new Set(HOME_LANE_COORDS.green.map(([row, column]) => `${row}-${column}`)),
};

const getTrackIndex = (color: LudoColor, progress: number): number | null => {
  if (progress < 0 || progress > 50) {
    return null;
  }
  return (START_INDEX_BY_COLOR[color] + progress) % TRACK_COORDS.length;
};

const createInitialTokens = (activeColors: LudoColor[]): LudoToken[] => {
  const tokens: LudoToken[] = [];
  activeColors.forEach((color) => {
    for (let slot = 0; slot < TOKENS_PER_PLAYER; slot += 1) {
      tokens.push({
        id: `${color}-${slot + 1}`,
        color,
        slot,
        progress: -1,
      });
    }
  });
  return tokens;
};

const getMovableTokenIds = (tokens: LudoToken[], color: LudoColor, diceValue: number): string[] => {
  return tokens
    .filter((token) => token.color === color)
    .filter((token) => {
      if (token.progress === HOME_PROGRESS) {
        return false;
      }
      if (token.progress === -1) {
        return diceValue === 6;
      }
      return token.progress + diceValue <= HOME_PROGRESS;
    })
    .map((token) => token.id);
};

const hasWon = (tokens: LudoToken[], color: LudoColor): boolean => {
  return tokens
    .filter((token) => token.color === color)
    .every((token) => token.progress === HOME_PROGRESS);
};

const resolveBaseColor = (row: number, column: number): LudoColor | null => {
  if (row <= 5 && column <= 5) {
    return 'red';
  }
  if (row <= 5 && column >= 9) {
    return 'blue';
  }
  if (row >= 9 && column >= 9) {
    return 'yellow';
  }
  if (row >= 9 && column <= 5) {
    return 'green';
  }
  return null;
};

const resolveTokenCoord = (token: LudoToken): [number, number] | null => {
  if (token.progress === HOME_PROGRESS) {
    return null;
  }

  if (token.progress === -1) {
    return YARD_COORDS[token.color][token.slot] || null;
  }

  if (token.progress >= HOME_LANE_START_PROGRESS) {
    return HOME_LANE_COORDS[token.color][token.progress - HOME_LANE_START_PROGRESS] || null;
  }

  const trackIndex = getTrackIndex(token.color, token.progress);
  if (trackIndex === null) {
    return null;
  }
  return TRACK_COORDS[trackIndex] || null;
};

const applyTokenMove = (
  tokens: LudoToken[],
  tokenId: string,
  diceValue: number
): { tokens: LudoToken[]; captured: number; reachedHome: boolean } | null => {
  const tokenIndex = tokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex < 0) {
    return null;
  }

  const movingToken = tokens[tokenIndex];
  let nextProgress = movingToken.progress;

  if (movingToken.progress === -1) {
    if (diceValue !== 6) {
      return null;
    }
    nextProgress = 0;
  } else {
    nextProgress = movingToken.progress + diceValue;
    if (nextProgress > HOME_PROGRESS) {
      return null;
    }
  }

  const nextTokens = tokens.map((token, index) =>
    index === tokenIndex
      ? {
          ...token,
          progress: nextProgress,
        }
      : token
  );

  let captured = 0;
  const destinationTrackIndex = getTrackIndex(movingToken.color, nextProgress);

  if (destinationTrackIndex !== null && !SAFE_TRACK_INDEXES.has(destinationTrackIndex)) {
    for (let index = 0; index < nextTokens.length; index += 1) {
      const token = nextTokens[index];
      if (token.id === tokenId || token.color === movingToken.color) {
        continue;
      }
      const tokenTrackIndex = getTrackIndex(token.color, token.progress);
      if (tokenTrackIndex !== destinationTrackIndex) {
        continue;
      }

      nextTokens[index] = {
        ...token,
        progress: -1,
      };
      captured += 1;
    }
  }

  return {
    tokens: nextTokens,
    captured,
    reachedHome: nextProgress === HOME_PROGRESS,
  };
};

export function LudoArenaGame({
  player,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  gameDefinitions,
  participantNames,
  participantCount,
  onMatchComplete,
  onLeave,
}: LudoArenaGameProps) {
  const clampedParticipantCount = Math.max(2, Math.min(4, participantCount));
  const activeColors = useMemo(
    () => PLAYER_COLORS.slice(0, clampedParticipantCount),
    [clampedParticipantCount]
  );
  const gameLabel = formatGameName('ludo', gameDefinitions);
  const participants = useMemo<LudoParticipant[]>(
    () =>
      activeColors.map((color, index) => {
        const configuredName = String(participantNames[index] || '').trim();
        return {
          color,
          index,
          name: configuredName || (index === 0 ? player.name : `Player ${index + 1}`),
        };
      }),
    [activeColors, participantNames, player.name]
  );

  const [tokens, setTokens] = useState<LudoToken[]>(() => createInitialTokens(activeColors));
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [winnerColor, setWinnerColor] = useState<LudoColor | null>(null);
  const [statusMessage, setStatusMessage] = useState('Roll the dice to begin.');
  const [recentRolls, setRecentRolls] = useState<Array<{ color: LudoColor; name: string; value: number }>>([]);
  const [isRoomCardCollapsed, setIsRoomCardCollapsed] = useState(false);
  const lastReportedWinnerRef = useRef<LudoColor | null>(null);
  const activeColorKey = activeColors.join('|');
  const openingPlayerName =
    String(participantNames[0] || '').trim() || participants[0]?.name || player.name || 'Player 1';

  useEffect(() => {
    setTokens(createInitialTokens(activeColors));
    setCurrentTurnIndex(0);
    setDiceValue(null);
    setWinnerColor(null);
    setRecentRolls([]);
    lastReportedWinnerRef.current = null;
    setStatusMessage(`${openingPlayerName} to start. Roll the dice.`);
  }, [activeColorKey, activeColors, openingPlayerName]);

  const currentTurnColor = activeColors[currentTurnIndex] || activeColors[0];
  const currentParticipant =
    participants.find((participant) => participant.color === currentTurnColor) || participants[0];

  const movableTokenIds = useMemo(() => {
    if (diceValue === null || !currentTurnColor || winnerColor) {
      return [];
    }
    return getMovableTokenIds(tokens, currentTurnColor, diceValue);
  }, [currentTurnColor, diceValue, tokens, winnerColor]);

  const tokenMapByCell = useMemo(() => {
    const map = new Map<string, LudoToken[]>();

    tokens.forEach((token) => {
      const coord = resolveTokenCoord(token);
      if (!coord) {
        return;
      }
      const key = `${coord[0]}-${coord[1]}`;
      const existing = map.get(key) || [];
      existing.push(token);
      map.set(key, existing);
    });

    return map;
  }, [tokens]);

  const tokenStats = useMemo(() => {
    const stats = new Map<
      LudoColor,
      { yard: number; track: number; homeLane: number; home: number; total: number }
    >();
    activeColors.forEach((color) => {
      stats.set(color, { yard: 0, track: 0, homeLane: 0, home: 0, total: TOKENS_PER_PLAYER });
    });

    tokens.forEach((token) => {
      const colorStats = stats.get(token.color);
      if (!colorStats) {
        return;
      }
      if (token.progress === -1) {
        colorStats.yard += 1;
        return;
      }
      if (token.progress === HOME_PROGRESS) {
        colorStats.home += 1;
        return;
      }
      if (token.progress >= HOME_LANE_START_PROGRESS) {
        colorStats.homeLane += 1;
        return;
      }
      colorStats.track += 1;
    });

    return stats;
  }, [activeColors, tokens]);

  const roomStatusIcon = winnerColor ? <AiOutlineCheckCircle /> : <AiOutlineClockCircle />;
  const canRoll = winnerColor === null && diceValue === null;
  const canSelectToken = winnerColor === null && diceValue !== null;

  const advanceTurn = (index: number): number => (index + 1) % Math.max(1, activeColors.length);

  const handleRollDice = () => {
    if (!canRoll || !currentTurnColor || !currentParticipant) {
      return;
    }

    const rolled = Math.floor(Math.random() * 6) + 1;
    const nextMovableTokenIds = getMovableTokenIds(tokens, currentTurnColor, rolled);

    setRecentRolls((currentValue) => [
      { color: currentTurnColor, name: currentParticipant.name, value: rolled },
      ...currentValue,
    ].slice(0, 8));

    if (nextMovableTokenIds.length === 0) {
      const nextTurnIndex = advanceTurn(currentTurnIndex);
      const nextPlayerColor = activeColors[nextTurnIndex];
      const nextPlayerName =
        participants.find((participant) => participant.color === nextPlayerColor)?.name || 'next player';

      setDiceValue(null);
      setCurrentTurnIndex(nextTurnIndex);
      setStatusMessage(
        `${currentParticipant.name} rolled ${rolled}. No legal move, turn passes to ${nextPlayerName}.`
      );
      return;
    }

    setDiceValue(rolled);
    setStatusMessage(`${currentParticipant.name} rolled ${rolled}. Pick a highlighted token.`);
  };

  const handleSelectToken = (tokenId: string) => {
    if (!canSelectToken || diceValue === null || !currentTurnColor || !currentParticipant) {
      return;
    }
    if (!movableTokenIds.includes(tokenId)) {
      return;
    }

    const resolution = applyTokenMove(tokens, tokenId, diceValue);
    if (!resolution) {
      return;
    }

    const selectedToken = resolution.tokens.find((token) => token.id === tokenId);
    const tokenLabel = selectedToken
      ? `${COLOR_META[selectedToken.color].label} ${selectedToken.slot + 1}`
      : 'token';

    setTokens(resolution.tokens);

    if (hasWon(resolution.tokens, currentTurnColor)) {
      setWinnerColor(currentTurnColor);
      setDiceValue(null);
      setStatusMessage(`${currentParticipant.name} wins the ${gameLabel} match.`);
      return;
    }

    const earnedExtraTurn = diceValue === 6 || resolution.captured > 0 || resolution.reachedHome;
    if (earnedExtraTurn) {
      const reasons: string[] = [];
      if (diceValue === 6) {
        reasons.push('rolled a 6');
      }
      if (resolution.captured > 0) {
        reasons.push(`captured ${resolution.captured}`);
      }
      if (resolution.reachedHome) {
        reasons.push('reached home');
      }

      setDiceValue(null);
      setStatusMessage(
        `${currentParticipant.name} moved ${tokenLabel} and earns another turn (${reasons.join(', ')}).`
      );
      return;
    }

    const nextTurnIndex = advanceTurn(currentTurnIndex);
    const nextColor = activeColors[nextTurnIndex];
    const nextPlayer =
      participants.find((participant) => participant.color === nextColor)?.name || 'next player';

    setDiceValue(null);
    setCurrentTurnIndex(nextTurnIndex);
    setStatusMessage(`${currentParticipant.name} moved ${tokenLabel}. ${nextPlayer} is up next.`);
  };

  const handleRematch = () => {
    setTokens(createInitialTokens(activeColors));
    setCurrentTurnIndex(0);
    setDiceValue(null);
    setWinnerColor(null);
    setRecentRolls([]);
    lastReportedWinnerRef.current = null;
    setStatusMessage(`${participants[0]?.name || 'Player 1'} to start. Roll the dice.`);
  };

  useEffect(() => {
    if (!winnerColor) {
      lastReportedWinnerRef.current = null;
      return;
    }

    if (lastReportedWinnerRef.current === winnerColor) {
      return;
    }

    const primaryColor = participants[0]?.color || activeColors[0] || 'red';
    const opponents = participants
      .filter((participant) => participant.color !== primaryColor)
      .map((participant) => participant.name)
      .join(', ');

    lastReportedWinnerRef.current = winnerColor;
    onMatchComplete({
      mode: 'offline',
      gameType: 'ludo',
      outcome: winnerColor === primaryColor ? 'win' : 'loss',
      opponent: opponents || 'Local Opponent',
    });
  }, [activeColors, onMatchComplete, participants, winnerColor]);

  const controllerButtons = [
    { key: 'roll', label: 'Roll', icon: <AiOutlineThunderbolt />, onClick: handleRollDice },
    { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: handleRematch },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Ludo Match"
        subtitle="Roll, move, and race all tokens home"
        buttons={controllerButtons}
      />

      {/* Player Cards */}
      {participants.map((participant, index) => {
        const stats = tokenStats.get(participant.color);
        const isActiveTurn = winnerColor === null && participant.color === currentTurnColor;
        const hasWonMatch = winnerColor === participant.color;
        const positions = ['left-10', 'right-10', 'left-1/3 bottom-10', 'right-1/3 bottom-10'];
        const positionClass = positions[index] || positions[0];

        return (
          <div
            key={participant.color}
            className={classnames(
              'fixed flex-col',
              positionClass,
              'player',
              `ludo-player-${participant.color}`,
              hasWonMatch && 'player-result-winner',
              isActiveTurn && 'player-result-active'
            )}
          >
            <div className="player-top">
              <div className="player-color-badge" style={{ backgroundColor: participant.color }} />
              <div className="player-identity">
                <p className="player-piece-label">{COLOR_META[participant.color].label}</p>
                <p className="player-alias">{participant.name}</p>
                <p className="player-mood">
                  {hasWonMatch ? <AiOutlineCrown /> : isActiveTurn ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />}
                </p>
              </div>
            </div>

            <div className="player-stats">
              <div className="player-stat">
                <span>Home</span>
                <strong>{stats?.home ?? 0}/{TOKENS_PER_PLAYER}</strong>
              </div>
              <div className="player-stat">
                <span>Track</span>
                <strong>{stats?.track ?? 0}</strong>
              </div>
              <div className="player-stat">
                <span>Lane</span>
                <strong>{stats?.homeLane ?? 0}</strong>
              </div>
            </div>
          </div>
        );
      })}

      <div>
        <motion.div drag dragMomentum={false} className="room-float-drag-root">
          <div className={`room-float-card${isRoomCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
            {isRoomCardCollapsed ? (
              <button
                className="room-float-collapsed-center"
                type="button"
                onClick={() => setIsRoomCardCollapsed(false)}
                aria-label="Expand match info"
                title="Expand match info"
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
                    <AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Local Match
                  </span>
                  <button
                    className="room-float-toggle-btn"
                    type="button"
                    onClick={() => setIsRoomCardCollapsed(true)}
                    aria-label="Collapse match info"
                    title="Collapse match info"
                  >
                    <AiOutlineArrowDown />
                  </button>
                </div>

                <div className="room-score-strip">
                  <span className="room-float-line">
                    {roomStatusIcon} {statusMessage}
                  </span>
                </div>

                <div className="room-float-actions">
                  <motion.button
                    className="room-float-action-btn"
                    type="button"
                    onClick={handleRollDice}
                    disabled={!canRoll}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <AiOutlineThunderbolt /> Roll {currentParticipant ? `(${currentParticipant.name})` : ''}
                  </motion.button>
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
              </>
            )}
          </div>
        </motion.div>

        <div className="board-stage-card ludo-stage-card">
          <div className="ludo-topbar">
            <div className={classnames('ludo-turn-chip', currentTurnColor ? `ludo-turn-chip-${currentTurnColor}` : '')}>
              <AiOutlinePlayCircle />
              <span>{winnerColor ? `${COLOR_META[winnerColor].label} wins` : `${currentParticipant?.name || 'Player'} to move`}</span>
            </div>
            <div className="ludo-dice-chip">
              <AiOutlineThunderbolt /> Dice: <strong>{diceValue ?? '-'}</strong>
            </div>
          </div>

          <div className="ludo-board-grid" role="grid" aria-label="Ludo board">
            {Array.from({ length: 15 * 15 }, (_, cellIndex) => {
              const row = Math.floor(cellIndex / 15);
              const column = cellIndex % 15;
              const cellKey = `${row}-${column}`;
              const baseColor = resolveBaseColor(row, column);
              const isTrackCell = TRACK_KEY_SET.has(cellKey);
              const isSafeCell = SAFE_KEY_SET.has(cellKey);
              const homeLaneColor = (
                ['red', 'blue', 'yellow', 'green'] as LudoColor[]
              ).find((color) => HOME_KEY_SETS[color].has(cellKey));
              const isCenterCell = row === 7 && column === 7;
              const tokensAtCell = tokenMapByCell.get(cellKey) || [];

              return (
                <div
                  key={cellKey}
                  className={classnames(
                    'ludo-cell',
                    baseColor && `ludo-cell-base-${baseColor}`,
                    isTrackCell && 'ludo-cell-track',
                    isSafeCell && 'ludo-cell-safe',
                    homeLaneColor && `ludo-cell-home-${homeLaneColor}`,
                    isCenterCell && 'ludo-cell-center'
                  )}
                  role="gridcell"
                >
                  {tokensAtCell.map((token) => {
                    const isMovable = movableTokenIds.includes(token.id);
                    const interactive = canSelectToken && isMovable;
                    return (
                      <button
                        key={token.id}
                        className={classnames(
                          'ludo-token',
                          `ludo-token-${token.color}`,
                          interactive && 'ludo-token-actionable'
                        )}
                        type="button"
                        onClick={() => handleSelectToken(token.id)}
                        disabled={!interactive}
                        title={`${COLOR_META[token.color].label} token ${token.slot + 1}`}
                        aria-label={`${COLOR_META[token.color].label} token ${token.slot + 1}`}
                      >
                        {token.slot + 1}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="ludo-controls">
            <button className="ludo-roll-btn" type="button" onClick={handleRollDice} disabled={!canRoll}>
              <AiOutlineThunderbolt /> {canRoll ? 'Roll Dice' : 'Move a Token'}
            </button>
            <span className="ludo-controls-hint">
              Need a 6 to launch a token from base. Exact roll is required to reach home.
            </span>
          </div>

          {recentRolls.length > 0 ? (
            <div className="ludo-roll-feed">
              {recentRolls.map((rollEntry, index) => (
                <span
                  key={`${rollEntry.color}-${rollEntry.value}-${index}`}
                  className={classnames('ludo-roll-pill', `ludo-roll-pill-${rollEntry.color}`)}
                >
                  {rollEntry.name}: {rollEntry.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
