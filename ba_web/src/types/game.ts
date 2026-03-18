export type Screen = "home" | "lobby" | "leaderboard" | "history" | "settings" | "game";

export type GameMode = "online" | "cpu";

export type GameType = "tic-tac-two";

export type GameDefinition = {
  id: GameType;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
};

export type CpuDifficulty = "easy" | "medium" | "hard";

export type MatchOutcome = "win" | "loss" | "draw";

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
  status: "waiting" | "playing" | "finished";
  playersCount: number;
  maxPlayers: number;
  isPublic: boolean;
};

export type LeaderboardPlayer = PlayerProfile & {
  score: number;
};

export type RoomPlayer = {
  playerId: string;
  name: string;
  symbol: "X" | "O";
  wins: number;
  losses: number;
  draws: number;
};

export type RoomState = {
  code: string;
  name: string;
  gameType: GameType;
  maxPlayers: number;
  isPublic: boolean;
  board: Array<"X" | "O" | null>;
  turn: "X" | "O";
  status: "waiting" | "playing" | "finished";
  winner: "X" | "O" | "draw" | null;
  playersCount: number;
  players: RoomPlayer[];
};

export type RoomPayload = {
  room: {
    code: string;
  };
  you: PlayerProfile | null;
};

export type RoomStatePayload = {
  room: RoomState;
  yourSymbol: "X" | "O" | null;
  you: PlayerProfile | null;
};
