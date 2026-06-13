'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import {
  AiOutlineDatabase,
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
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile } from '@/types/game';

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
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: CipherAuctionArenaGameProps) {
  const [gameState, setGameState] = useState<CipherState | null>(null);
  const [connectionLabel, setConnectionLabel] = useState('Connecting');
  const [clockNow, setClockNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
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
    if (mode !== 'online' || !roomCode) {
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
    sendMessage({ type: 'cipher-auction-bid', bids: nextBids, locked: false });
  };

  const toggleLock = () => {
    if (!gameState || gameState.phase !== 'commit') return;
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

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

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
                <button type="button" onClick={() => sendMessage({ type: 'cipher-auction-rematch' })}>
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
