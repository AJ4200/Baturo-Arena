export type Screen = 'home' | 'game-select' | 'lobby' | 'leaderboard' | 'history' | 'settings' | 'game';

export type GameMode = 'online' | 'cpu';

export type GameType =
  | 'tic-tac-two'
  | 'connect-all-four'
  | 'orbital-flip'
  | 'corner-clash'
  | 'checkers'
  | '2048'
  | 'sudoku'
  | 'minesweeper'
  | 'memory-match';

export type GameDefinition = {
  id: GameType;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  rows: number;
  columns: number;
  connect: number;
  moveMode:
    | 'cell'
    | 'column'
    | 'flip'
    | 'corner-flip'
    | 'checkers'
    | 'solo-2048'
    | 'solo-sudoku'
    | 'solo-minesweeper'
    | 'solo-memory';
  winCondition?:
    | 'connect'
    | 'majority'
    | 'corners'
    | 'elimination'
    | 'target-2048'
    | 'sudoku-complete'
    | 'minesweeper-clear'
    | 'memory-complete';
  supportsOnline: boolean;
  supportsCpu: boolean;
};

export type CpuDifficulty = 'easy' | 'medium' | 'hard';

export type MatchOutcome = 'win' | 'loss' | 'draw';

export type MatchResultEvent = {
  mode: GameMode;
  gameType: GameType;
  outcome: MatchOutcome;
  opponent: string;
};

export type MatchHistoryEntry = MatchResultEvent & {
  id: string;
  finishedAt: string;
};

export type PlayerProfile = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
};

export type PublicRoom = {
  code: string;
  name: string;
  gameType: GameType;
  status: 'waiting' | 'playing' | 'finished';
  playersCount: number;
  maxPlayers: number;
  isPublic: boolean;
  creatorName: string;
  updatedAt: string;
  players: Array<{
    playerId: string;
    name: string;
    symbol: 'X' | 'O';
    wins: number;
    losses: number;
    draws: number;
  }>;
};

export type LeaderboardPlayer = PlayerProfile & {
  score: number;
};

export type LeaderboardCategory = {
  gameType: GameType | 'overall';
  name: string;
  players: LeaderboardPlayer[];
};

export type LeaderboardPayload = {
  overall: LeaderboardPlayer[];
  byGame: Array<{
    gameType: GameType;
    name: string;
    players: LeaderboardPlayer[];
  }>;
};

export type RoomPlayer = {
  playerId: string;
  name: string;
  symbol: 'X' | 'O';
  wins: number;
  losses: number;
  draws: number;
};

export type CheckersPiece = 'XC' | 'XK' | 'OC' | 'OK';

export type BoardCell = 'X' | 'O' | CheckersPiece | null;

export type GameMove = number | { from: number; to: number };

export type RoomState = {
  code: string;
  name: string;
  gameType: GameType;
  maxPlayers: number;
  isPublic: boolean;
  board: BoardCell[];
  turn: 'X' | 'O';
  status: 'waiting' | 'playing' | 'finished';
  winner: 'X' | 'O' | 'draw' | null;
  playersCount: number;
  players: RoomPlayer[];
};

export type RoomPayload = {
  room: {
    code: string;
    gameType: GameType;
  };
  you: PlayerProfile | null;
};

export type RoomStatePayload = {
  room: RoomState;
  yourSymbol: 'X' | 'O' | null;
  you: PlayerProfile | null;
};
