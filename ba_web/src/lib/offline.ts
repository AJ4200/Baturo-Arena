import type { GameType } from '@/types/game';

export type OfflineSeatSymbol = 'X' | 'O';

export type OfflineSeatToken = 'X' | 'O' | 'Y' | 'Z' | 'P1' | 'P2' | 'P3' | 'P4';

export type OfflineSeat = {
  index: number;
  token: OfflineSeatToken;
  symbol: OfflineSeatSymbol;
  label: string;
};

const DEFAULT_OFFLINE_TOKENS: OfflineSeatToken[] = ['P1', 'P2', 'P3', 'P4'];
const TIC_TAC_TWO_OFFLINE_TOKENS: OfflineSeatToken[] = ['X', 'O', 'Y', 'Z'];

export const getOfflineSeatTokens = (gameType: GameType): OfflineSeatToken[] => {
  if (gameType === 'tic-tac-two') {
    return TIC_TAC_TWO_OFFLINE_TOKENS;
  }
  return DEFAULT_OFFLINE_TOKENS;
};

export const getOfflineSeatLabel = (gameType: GameType, token: OfflineSeatToken): string => {
  if (gameType === 'tic-tac-two') {
    if (token === 'X') {
      return 'Player 1 (X Team)';
    }
    if (token === 'O') {
      return 'Player 2 (O Team)';
    }
    if (token === 'Y') {
      return 'Player 3 (X Team)';
    }
    if (token === 'Z') {
      return 'Player 4 (O Team)';
    }
  }

  return token.startsWith('P')
    ? `Player ${token.replace('P', '')}`
    : `Player ${token}`;
};

export const getOfflineSeats = (gameType: GameType, playerCount: number): OfflineSeat[] => {
  const count = Math.max(2, Math.min(4, playerCount));
  const tokens = getOfflineSeatTokens(gameType);
  const seats: OfflineSeat[] = [];

  for (let index = 0; index < count; index += 1) {
    const token = tokens[index] || (`P${index + 1}` as OfflineSeatToken);
    seats.push({
      index,
      token,
      symbol: index % 2 === 0 ? 'X' : 'O',
      label: getOfflineSeatLabel(gameType, token),
    });
  }

  return seats;
};
