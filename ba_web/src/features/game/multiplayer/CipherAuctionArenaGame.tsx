'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineDatabase,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineLock,
  AiOutlineMinus,
  AiOutlinePlus,
  AiOutlineReload,
  AiOutlineSafety,
  AiOutlineSound,
  AiOutlineThunderbolt,
  AiOutlineTrophy,
  AiOutlineUnlock,
  AiOutlineWifi,
} from 'react-icons/ai';
import {
  AdaptiveControllerOverlay,
  type ControllerSection,
} from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type {
  CpuDifficulty,
  GameDefinition,
  GameMode,
  MatchResultEvent,
  PlayerProfile,
} from '@/types/game';

type CipherPhase = 'waiting' | 'countdown' | 'commit' | 'reveal' | 'finished';
type VaultKind = 'archive' | 'amplifier' | 'firewall';

type CipherPlayer = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  score: number;
  connected: boolean;
  locked: boolean;
  bids?: number[];
};

type CipherVault = {
  id: string;
  name: string;
  kind: VaultKind;
  reward: number;
  minBid: number;
};

type CipherBidReveal = {
  playerId: string;
  playerName: string;
  color: string;
  bid: number;
};

type CipherResult = {
  vaultId: string;
  outcome: 'won' | 'tie' | 'sealed';
  winnerId: string | null;
  winnerName: string | null;
  topBid: number;
  reward: number;
  bids: CipherBidReveal[];
};

type CipherState = {
  phase: CipherPhase;
  round: number;
  maxRounds: number;
  targetScore: number;
  chipBudget: number;
  deadline: number | null;
  serverNow: number;
  vaults: CipherVault[];
  results: CipherResult[];
  winnerIds: string[];
  lastEvent: string;
  ownBids: number[];
  players: CipherPlayer[];
};

type CipherAuctionArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  roomCode?: string | null;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  cpuDifficulty: CpuDifficulty;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
  return token;
};

const getWsBaseUrl = (): string => API_BASE_URL.replace(/^http/i, 'ws');
const CPU_ID = 'cipher-cpu';
const CPU_NAME_BY_DIFFICULTY: Record<CpuDifficulty, string> = {
  easy: 'Loose Signal',
  medium: 'Pattern Reader',
  hard: 'Black Ledger',
};
const LOCAL_VAULT_NAMES = [
  'Ghost Ledger',
  'Solar Key',
  'Black Archive',
  'Prism Cache',
  'Null Crown',
  'Echo Patent',
  'Velvet Root',
  'Ion Reserve',
  'Mirror Seed',
];

const createLocalVaults = (round: number): CipherVault[] =>
  Array.from({ length: 3 }, (_, index) => {
    const seed = round * 7 + index * 11;
    const kindIndex = seed % 3;
    const kind: VaultKind =
      kindIndex === 0 ? 'archive' : kindIndex === 1 ? 'amplifier' : 'firewall';
    return {
      id: `vault-${round}-${index}`,
      name: LOCAL_VAULT_NAMES[seed % LOCAL_VAULT_NAMES.length],
      kind,
      reward: 2 + ((seed + index) % 4) + (kind === 'amplifier' ? 1 : 0),
      minBid: kind === 'firewall' ? 2 : 1,
    };
  });

const createCpuBids = (round: number, difficulty: CpuDifficulty): number[] => {
  const patterns: Record<CpuDifficulty, number[][]> = {
    easy: [
      [1, 2, 1],
      [0, 2, 3],
      [2, 1, 1],
      [1, 0, 3],
    ],
    medium: [
      [2, 3, 2],
      [3, 1, 3],
      [1, 3, 3],
      [3, 2, 2],
    ],
    hard: [
      [3, 2, 2],
      [2, 4, 1],
      [4, 1, 2],
      [2, 2, 3],
    ],
  };
  return patterns[difficulty][(round - 1) % patterns[difficulty].length];
};

const createCpuMatchState = (
  player: PlayerProfile,
  difficulty: CpuDifficulty
): CipherState => ({
  phase: 'countdown',
  round: 0,
  maxRounds: 6,
  targetScore: 18,
  chipBudget: 7,
  deadline: Date.now() + 1800,
  serverNow: Date.now(),
  vaults: [],
  results: [],
  winnerIds: [],
  lastEvent: `${CPU_NAME_BY_DIFFICULTY[difficulty]} entered the encrypted market.`,
  ownBids: [0, 0, 0],
  players: [
    {
      id: player.playerId,
      name: player.name,
      symbol: 'X',
      color: '#55e6ff',
      score: 0,
      connected: true,
      locked: false,
      bids: [0, 0, 0],
    },
    {
      id: CPU_ID,
      name: CPU_NAME_BY_DIFFICULTY[difficulty],
      symbol: 'O',
      color: '#ff6eb6',
      score: 0,
      connected: true,
      locked: true,
      bids: [0, 0, 0],
    },
  ],
});

const beginCpuRound = (
  state: CipherState,
  playerId: string,
  difficulty: CpuDifficulty
): CipherState => {
  const round = state.round + 1;
  const cpuBids = createCpuBids(round, difficulty);
  return {
    ...state,
    phase: 'commit',
    round,
    deadline: Date.now() + 12000,
    vaults: createLocalVaults(round),
    results: [],
    winnerIds: [],
    ownBids: [0, 0, 0],
    lastEvent: `Round ${round}: split 7 signal chips, then lock the bid.`,
    players: state.players.map((entry) => ({
      ...entry,
      locked: entry.id === CPU_ID,
      bids: entry.id === CPU_ID ? cpuBids : entry.id === playerId ? [0, 0, 0] : entry.bids,
    })),
  };
};

const resolveCpuRound = (state: CipherState): CipherState => {
  const nextPlayers = state.players.map((entry) => ({ ...entry }));
  const results = state.vaults.map((vault, vaultIndex) => {
    const bids = nextPlayers.map((entry) => ({
      playerId: entry.id,
      playerName: entry.name,
      color: entry.color,
      bid: entry.bids?.[vaultIndex] || 0,
    }));
    const eligible = bids.filter((entry) => entry.bid >= vault.minBid);
    const topBid = eligible.reduce((highest, entry) => Math.max(highest, entry.bid), 0);
    const leaders = eligible.filter((entry) => entry.bid === topBid);

    if (leaders.length === 1) {
      const winner = nextPlayers.find((entry) => entry.id === leaders[0].playerId);
      if (winner) winner.score += vault.reward;
      return {
        vaultId: vault.id,
        outcome: 'won' as const,
        winnerId: leaders[0].playerId,
        winnerName: leaders[0].playerName,
        topBid,
        reward: vault.reward,
        bids,
      };
    }

    if (leaders.length > 1) {
      leaders.forEach((leader) => {
        const tiedPlayer = nextPlayers.find((entry) => entry.id === leader.playerId);
        if (tiedPlayer) tiedPlayer.score = Math.max(0, tiedPlayer.score - 1);
      });
      return {
        vaultId: vault.id,
        outcome: 'tie' as const,
        winnerId: null,
        winnerName: null,
        topBid,
        reward: vault.reward,
        bids,
      };
    }

    return {
      vaultId: vault.id,
      outcome: 'sealed' as const,
      winnerId: null,
      winnerName: null,
      topBid: 0,
      reward: vault.reward,
      bids,
    };
  });

  const wins = results.filter((result) => result.outcome === 'won').length;
  const alarms = results.filter((result) => result.outcome === 'tie').length;
  return {
    ...state,
    phase: 'reveal',
    deadline: Date.now() + 4200,
    players: nextPlayers,
    results,
    lastEvent: `${wins} vault${wins === 1 ? '' : 's'} cracked. ${alarms} alarm${alarms === 1 ? '' : 's'} tripped.`,
  };
};

const finishOrContinueCpuMatch = (
  state: CipherState,
  playerId: string,
  difficulty: CpuDifficulty
): CipherState => {
  const sorted = [...state.players].sort((left, right) => right.score - left.score);
  const highScore = sorted[0]?.score || 0;
  const leaders = sorted.filter((entry) => entry.score === highScore);
  if ((highScore >= state.targetScore || state.round >= state.maxRounds) && leaders.length === 1) {
    return {
      ...state,
      phase: 'finished',
      deadline: null,
      winnerIds: [leaders[0].id],
      lastEvent: `${leaders[0].name} owns the cipher market with ${leaders[0].score} intel.`,
    };
  }
  return beginCpuRound(state, playerId, difficulty);
};

const getVaultIcon = (kind: VaultKind) => {
  if (kind === 'amplifier') return <AiOutlineThunderbolt />;
  if (kind === 'firewall') return <AiOutlineSafety />;
  return <AiOutlineDatabase />;
};

const getVaultRule = (vault: CipherVault): string => {
  if (vault.kind === 'amplifier') return 'Boosted intel payout';
  if (vault.kind === 'firewall') return `Needs at least ${vault.minBid} chips`;
  return 'Standard encrypted cache';
};

export function CipherAuctionArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  cpuDifficulty,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: CipherAuctionArenaGameProps) {
  const [gameState, setGameState] = useState<CipherState | null>(null);
  const [connectionLabel, setConnectionLabel] = useState('Connecting');
  const [clockNow, setClockNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reportedWinnerRef = useRef<string | null>(null);
  const gameLabel = formatGameName('cipher-auction', gameDefinitions);

  const sendMessage = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== 'cpu') return;
    reportedWinnerRef.current = null;
    setConnectionLabel(`${CPU_NAME_BY_DIFFICULTY[cpuDifficulty]} ready`);
    setServerOffset(0);
    setGameState(createCpuMatchState(player, cpuDifficulty));
  }, [cpuDifficulty, mode, player]);

  useEffect(() => {
    if (mode !== 'online') {
      return;
    }
    if (!roomCode) {
      setConnectionLabel('Online room required');
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setConnectionLabel('Sign-in required');
      return;
    }

    const socket = new WebSocket(
      `${getWsBaseUrl()}/ws/cipher-auction?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`
    );
    socketRef.current = socket;
    socket.onopen = () => setConnectionLabel('Cipher link live');
    socket.onclose = () => setConnectionLabel('Cipher link closed');
    socket.onerror = () => setConnectionLabel('Cipher link error');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as CipherState & { type?: string };
        if (payload.type !== 'cipher-auction-state') return;
        setServerOffset(payload.serverNow - Date.now());
        setGameState(payload);
      } catch (_error) {
        setConnectionLabel('Cipher packet skipped');
      }
    };

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [mode, roomCode]);

  useEffect(() => {
    if (mode !== 'cpu') return;
    setGameState((current) => {
      if (!current?.deadline || current.deadline > clockNow) return current;
      if (current.phase === 'countdown') {
        return beginCpuRound(current, player.playerId, cpuDifficulty);
      }
      if (current.phase === 'commit') {
        return resolveCpuRound(current);
      }
      if (current.phase === 'reveal') {
        return finishOrContinueCpuMatch(current, player.playerId, cpuDifficulty);
      }
      return current;
    });
  }, [clockNow, cpuDifficulty, mode, player.playerId]);

  useEffect(() => {
    if (gameState?.phase !== 'finished') {
      reportedWinnerRef.current = null;
      return;
    }
    const winnerId = gameState.winnerIds[0];
    if (!winnerId || reportedWinnerRef.current === winnerId) return;
    reportedWinnerRef.current = winnerId;
    const winner = gameState.players.find((entry) => entry.id === winnerId);
    onMatchComplete({
      mode,
      gameType: 'cipher-auction',
      outcome: winnerId === player.playerId ? 'win' : 'loss',
      opponent: winner?.name || 'Cipher market',
    });
  }, [gameState, mode, onMatchComplete, player.playerId]);

  const ownPlayer = gameState?.players.find((entry) => entry.id === player.playerId);
  const ownBids = gameState?.ownBids || [0, 0, 0];
  const chipsUsed = ownBids.reduce((total, bid) => total + bid, 0);
  const chipsLeft = Math.max(0, (gameState?.chipBudget || 7) - chipsUsed);
  const timeLeftMs = gameState?.deadline
    ? Math.max(0, gameState.deadline - (clockNow + serverOffset))
    : 0;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const sortedPlayers = useMemo(
    () => [...(gameState?.players || [])].sort((left, right) => right.score - left.score),
    [gameState?.players]
  );

  const updateBid = (vaultIndex: number, change: number) => {
    if (!gameState || gameState.phase !== 'commit' || ownPlayer?.locked) return;
    const nextBids = [...ownBids];
    const nextValue = Math.max(0, nextBids[vaultIndex] + change);
    const nextTotal = chipsUsed - nextBids[vaultIndex] + nextValue;
    if (nextTotal > gameState.chipBudget) return;
    nextBids[vaultIndex] = nextValue;
    if (mode === 'cpu') {
      setGameState((current) =>
        current
          ? {
              ...current,
              ownBids: nextBids,
              players: current.players.map((entry) =>
                entry.id === player.playerId ? { ...entry, bids: nextBids, locked: false } : entry
              ),
            }
          : current
      );
      return;
    }
    sendMessage({ type: 'cipher-auction-bid', bids: nextBids, locked: false });
  };

  const toggleLock = () => {
    if (!gameState || gameState.phase !== 'commit') return;
    if (mode === 'cpu') {
      setGameState((current) => {
        if (!current) return current;
        const nextLocked = !ownPlayer?.locked;
        return {
          ...current,
          deadline: nextLocked ? Math.min(current.deadline || Date.now() + 700, Date.now() + 700) : current.deadline,
          lastEvent: nextLocked ? 'Both bids sealed. Accelerating reveal.' : current.lastEvent,
          players: current.players.map((entry) =>
            entry.id === player.playerId ? { ...entry, locked: nextLocked, bids: current.ownBids } : entry
          ),
        };
      });
      return;
    }
    sendMessage({
      type: 'cipher-auction-bid',
      bids: ownBids,
      locked: !ownPlayer?.locked,
    });
  };

  const phaseLabel =
    gameState?.phase === 'commit'
      ? 'Commit bids'
      : gameState?.phase === 'reveal'
        ? 'Decrypting'
        : gameState?.phase === 'countdown'
          ? 'Market opens'
          : gameState?.phase === 'finished'
            ? 'Market closed'
            : 'Waiting for brokers';

  const resetMatch = useCallback(() => {
    if (mode === 'cpu') {
      reportedWinnerRef.current = null;
      setGameState(createCpuMatchState(player, cpuDifficulty));
      return;
    }
    sendMessage({ type: 'cipher-auction-rematch' });
  }, [cpuDifficulty, mode, player, sendMessage]);

  const controllerSections: ControllerSection[] = [
    ...((gameState?.vaults || []).map((vault, vaultIndex) => ({
      key: vault.id,
      title: vault.name,
      layout: 'row' as const,
      buttons: [
        {
          key: `${vault.id}-minus`,
          label: `Remove chip from ${vault.name}`,
          icon: <AiOutlineMinus />,
          onClick: () => updateBid(vaultIndex, -1),
          disabled: gameState?.phase !== 'commit' || ownPlayer?.locked || ownBids[vaultIndex] <= 0,
        },
        {
          key: `${vault.id}-plus`,
          label: `Add chip to ${vault.name}`,
          icon: <AiOutlinePlus />,
          onClick: () => updateBid(vaultIndex, 1),
          disabled: gameState?.phase !== 'commit' || ownPlayer?.locked || chipsLeft <= 0,
        },
      ],
    })) || []),
    {
      key: 'cipher-actions',
      title: 'Auction',
      layout: 'row',
      buttons: [
        {
          key: 'seal',
          label: ownPlayer?.locked ? 'Unlock Bid' : 'Seal Bid',
          icon: ownPlayer?.locked ? <AiOutlineUnlock /> : <AiOutlineLock />,
          onClick: toggleLock,
          disabled: gameState?.phase !== 'commit',
        },
        {
          key: 'rematch',
          label: 'Restart Match',
          icon: <AiOutlineReload />,
          onClick: resetMatch,
          disabled: gameState?.phase !== 'finished',
        },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Cipher Auction Controls"
        subtitle="Allocate chips per vault, then seal the bid"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.2, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand Cipher Auction info"
              title="Expand game info"
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title">
                  <AiOutlineInfoCircle className="room-float-title-icon" /> Cipher Market
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse Cipher Auction info"
                  title="Collapse game info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>
              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Broker</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Mode</span><strong>{mode === 'cpu' ? cpuDifficulty : 'Online'}</strong></div>
                <div className="solo-float-stat"><span>Round</span><strong>{gameState?.round || 0}/{gameState?.maxRounds || 6}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{ownPlayer?.score || 0}</strong></div>
                <div className="solo-float-stat"><span>Chips</span><strong>{chipsLeft}</strong></div>
                <div className="solo-float-stat"><span>Phase</span><strong>{phaseLabel}</strong></div>
              </div>
              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="room-float-action-btn room-float-action-btn-danger" type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="cipher-auction-shell">
        <header className="cipher-auction-command">
          <div>
            <span className="cipher-auction-kicker">
              <AiOutlineWifi /> {connectionLabel}
            </span>
            <h2>{phaseLabel}</h2>
            <p>{gameState?.lastEvent || 'Establishing an encrypted market link.'}</p>
          </div>
          <div className="cipher-auction-command-actions">
            <button type="button" onClick={onToggleMusic}>
              <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={onLeave}>Leave Market</button>
          </div>
        </header>

        <div className="cipher-auction-scoreboard">
          {sortedPlayers.map((entry, index) => (
            <div
              key={entry.id}
              className={classnames(
                'cipher-auction-player',
                entry.id === player.playerId && 'cipher-auction-player-local',
                entry.locked && 'cipher-auction-player-locked'
              )}
              style={{ '--cipher-player': entry.color } as React.CSSProperties}
            >
              <span className="cipher-auction-rank">{index + 1}</span>
              <span className="cipher-auction-player-name">
                {entry.name}
                <small>{entry.connected ? (entry.locked ? 'Bid sealed' : 'Reading market') : 'Offline'}</small>
              </span>
              <strong>{entry.score}</strong>
            </div>
          ))}
        </div>

        <div className="cipher-auction-roundbar">
          <span>Round {gameState?.round || 0} / {gameState?.maxRounds || 6}</span>
          <div className="cipher-auction-timer" aria-label={`${secondsLeft} seconds remaining`}>
            <span style={{ transform: `scaleX(${Math.min(1, timeLeftMs / 12000)})` }} />
          </div>
          <strong>{gameState?.deadline ? `${secondsLeft}s` : '--'}</strong>
        </div>

        <div className="cipher-auction-vault-grid">
          {(gameState?.vaults.length ? gameState.vaults : Array.from({ length: 3 }, (_, index) => ({
            id: `placeholder-${index}`,
            name: 'Encrypted Vault',
            kind: 'archive' as const,
            reward: 0,
            minBid: 1,
          }))).map((vault, vaultIndex) => {
            const result = gameState?.results.find((entry) => entry.vaultId === vault.id);
            return (
              <article
                key={vault.id}
                className={classnames(
                  'cipher-auction-vault',
                  `cipher-auction-vault-${vault.kind}`,
                  result && `cipher-auction-vault-${result.outcome}`
                )}
              >
                <div className="cipher-auction-vault-head">
                  <span>{getVaultIcon(vault.kind)}</span>
                  <div>
                    <small>{vault.kind}</small>
                    <h3>{vault.name}</h3>
                  </div>
                  <strong>+{vault.reward}</strong>
                </div>
                <p>{getVaultRule(vault)}</p>

                {gameState?.phase === 'reveal' || gameState?.phase === 'finished' ? (
                  <div className="cipher-auction-reveal">
                    {(result?.bids || []).map((bid) => (
                      <span
                        key={bid.playerId}
                        className={result?.winnerId === bid.playerId ? 'winner' : undefined}
                        style={{ '--cipher-player': bid.color } as React.CSSProperties}
                      >
                        <i>{bid.bid}</i> {bid.playerName}
                      </span>
                    ))}
                    <strong>
                      {result?.outcome === 'won'
                        ? `${result.winnerName} cracked it`
                        : result?.outcome === 'tie'
                          ? 'Alarm: top bid tied'
                          : 'Vault stayed sealed'}
                    </strong>
                  </div>
                ) : (
                  <div className="cipher-auction-bid-control">
                    <button
                      type="button"
                      onClick={() => updateBid(vaultIndex, -1)}
                      disabled={gameState?.phase !== 'commit' || ownPlayer?.locked || ownBids[vaultIndex] <= 0}
                      aria-label={`Remove a chip from ${vault.name}`}
                    >
                      <AiOutlineMinus />
                    </button>
                    <strong>{ownBids[vaultIndex] || 0}</strong>
                    <button
                      type="button"
                      onClick={() => updateBid(vaultIndex, 1)}
                      disabled={gameState?.phase !== 'commit' || ownPlayer?.locked || chipsLeft <= 0}
                      aria-label={`Add a chip to ${vault.name}`}
                    >
                      <AiOutlinePlus />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <footer className="cipher-auction-console">
          <div>
            <span>Signal chips</span>
            <strong>{chipsLeft}</strong>
            <small>of {gameState?.chipBudget || 7} uncommitted</small>
          </div>
          <p>The highest bid wins only if uncontested. A tied top bid trips the alarm and costs every tied broker 1 intel.</p>
          <button
            type="button"
            className={ownPlayer?.locked ? 'is-locked' : undefined}
            onClick={toggleLock}
            disabled={gameState?.phase !== 'commit'}
          >
            {ownPlayer?.locked ? <AiOutlineUnlock /> : <AiOutlineLock />}
            {ownPlayer?.locked ? 'Unlock Bid' : 'Seal Bid'}
          </button>
        </footer>

        {gameState?.phase === 'finished' ? (
          <div className="cipher-auction-overlay">
            <div className="cipher-auction-finale">
              <AiOutlineTrophy />
              <span>{gameState.winnerIds[0] === player.playerId ? 'Market Dominated' : 'Auction Complete'}</span>
              <h2>{sortedPlayers[0]?.name || 'A broker'} wins Cipher Auction</h2>
              <p>{gameState.lastEvent}</p>
              <div>
                <button type="button" onClick={resetMatch}>
                  <AiOutlineReload /> Reopen Market
                </button>
                <button type="button" onClick={onLeave}>Leave Arena</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
