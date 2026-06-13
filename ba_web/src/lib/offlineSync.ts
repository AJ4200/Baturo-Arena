import { STORAGE_KEYS } from '@/lib/constants';
import type { GameType, MatchOutcome } from '@/types/game';

export type PendingCpuResult = {
  id: string;
  playerId: string;
  playerName: string;
  gameType: GameType;
  outcome: MatchOutcome;
  createdAt: string;
};

const MAX_PENDING_RESULTS = 1000;

const isMatchOutcome = (value: unknown): value is MatchOutcome =>
  value === 'win' || value === 'loss' || value === 'draw';

const parsePendingResult = (value: unknown): PendingCpuResult | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<PendingCpuResult>;
  if (
    typeof entry.id !== 'string' ||
    typeof entry.playerId !== 'string' ||
    typeof entry.playerName !== 'string' ||
    typeof entry.gameType !== 'string' ||
    !isMatchOutcome(entry.outcome) ||
    typeof entry.createdAt !== 'string'
  ) {
    return null;
  }

  return entry as PendingCpuResult;
};

export const readPendingCpuResults = (): PendingCpuResult[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.pendingCpuResults) || '[]'
    ) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(parsePendingResult)
      .filter((entry): entry is PendingCpuResult => Boolean(entry))
      .slice(0, MAX_PENDING_RESULTS);
  } catch (_error) {
    return [];
  }
};

export const writePendingCpuResults = (entries: PendingCpuResult[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEYS.pendingCpuResults,
    JSON.stringify(entries.slice(0, MAX_PENDING_RESULTS))
  );
};

export const enqueuePendingCpuResult = (entry: PendingCpuResult): number => {
  const current = readPendingCpuResults();
  if (!current.some((queuedEntry) => queuedEntry.id === entry.id)) {
    current.push(entry);
    writePendingCpuResults(current);
  }
  return current.length;
};

export const removePendingCpuResult = (id: string): number => {
  const next = readPendingCpuResults().filter((entry) => entry.id !== id);
  writePendingCpuResults(next);
  return next.length;
};
