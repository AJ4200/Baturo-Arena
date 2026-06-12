export type Screen = 'home' | 'menu-intro' | 'game-type-select' | 'game-select' | 'game-intro' | 'lobby' | 'single-player-lobby' | 'leaderboard' | 'history' | 'settings' | 'game';

export type GameMode = 'online' | 'cpu' | 'offline';

export type GameTypeCategory = 'online-multiplayer' | 'online' | 'single-player' | 'all';

export type GameCategory =
  | 'board'
  | 'puzzle'
  | 'arcade'
  | 'action'
  | 'sports'
  | 'rhythm'
  | 'cards'
  | 'racing';

export type GameType =
  | 'tic-tac-two'
  | 'connect-all-four'
  | 'orbital-flip'
  | 'corner-clash'
  | 'checkers'
  | 'chess'
  | 'ludo'
  | 'leap-on'
  | '2048'
  | 'sudoku'
  | 'minesweeper'
  | 'memory-match'
  | 'dino-run'
  | 'snake'
  | 'maze-flux'
  | 'space-invaders'
  | 'brickbreaker'
  | 'air-hockey'
  | 'neon-pong'
  | 'tetris'
  | 'starfall-survivor'
  | 'rift-runner'
  | 'dread-sector'
  | 'echo-bloom'
  | 'pulse-forge'
  | 'blackjack'
  | 'turbo-rush';

export type GameDefinition = {
  id: GameType;
  category: GameCategory;
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
    | 'chess'
    | 'ludo'
    | 'leap-on'
    | 'solo-2048'
    | 'solo-sudoku'
    | 'solo-minesweeper'
    | 'solo-memory'
    | 'solo-dino'
    | 'solo-snake'
    | 'solo-maze-flux'
    | 'solo-space-invaders'
    | 'solo-brickbreaker'
    | 'solo-neon-pong'
    | 'solo-tetris'
    | 'solo-starfall'
    | 'solo-rift-runner'
    | 'solo-dread-sector'
    | 'solo-echo-bloom'
    | 'solo-pulse-forge'
    | 'solo-blackjack'
    | 'air-hockey'
    | 'racing';
  winCondition?:
    | 'connect'
    | 'majority'
    | 'corners'
    | 'elimination'
    | 'checkmate'
    | 'ludo-home'
    | 'target-2048'
    | 'sudoku-complete'
    | 'minesweeper-clear'
    | 'memory-complete'
    | 'dino-survive'
    | 'snake-survive'
    | 'maze-flux-clear'
    | 'space-invaders-clear'
    | 'brickbreaker-clear'
    | 'neon-pong-score'
    | 'tetris-score'
    | 'starfall-survive'
    | 'rift-runner-extract'
    | 'dread-sector-extract'
    | 'echo-bloom-resonate'
    | 'pulse-forge-stabilize'
    | 'blackjack-five-wins'
    | 'air-hockey-score'
    | 'race-finish'
    | 'leap-on-score';
  supportsOnline: boolean;
  supportsCpu: boolean;
};

export type LeapOnAction = 'jump' | 'dash' | 'block' | 'wait' | 'tick';

export type LeapOnOrbState = {
  id: string;
  kind: 'safe' | 'hazard' | 'split';
  angle: number;
  radius: number;
  spin: number;
  drift: number;
};

export type LeapOnPlayerState = {
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
};

export type LeapOnBoardState = {
  mode: 'leap-on';
  status: 'waiting' | 'playing' | 'finished';
  timeMs: number;
  round: number;
  winner: GameSymbol | 'draw' | null;
  players: LeapOnPlayerState[];
  anchorRadius: number;
  orbs: LeapOnOrbState[];
  lastEvent: string | null;
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

export type GameSymbol = 'X' | 'O' | 'Y' | 'Z';

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
  creatorPlayerId: string;
  creatorName: string;
  updatedAt: string;
  players: Array<{
    playerId: string;
    name: string;
    symbol: GameSymbol;
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
  symbol: GameSymbol;
  wins: number;
  losses: number;
  draws: number;
};

export type CheckersPiece = 'XC' | 'XK' | 'OC' | 'OK';

export type ChessPiece =
  | 'XCP'
  | 'XCPV'
  | 'XCN'
  | 'XCB'
  | 'XCR'
  | 'XCRU'
  | 'XCQ'
  | 'XCK'
  | 'XCKU'
  | 'OCP'
  | 'OCPV'
  | 'OCN'
  | 'OCB'
  | 'OCR'
  | 'OCRU'
  | 'OCQ'
  | 'OCK'
  | 'OCKU';

export type BoardCell = GameSymbol | CheckersPiece | ChessPiece | null;

export type LudoBoardState = {
  mode: 'ludo';
  diceValue: number | null;
  tokens: Partial<Record<GameSymbol, number[]>>;
};

export type GameMove = number | { from: number; to: number } | { action: LeapOnAction };

export type RoomState = {
  code: string;
  name: string;
  gameType: GameType;
  maxPlayers: number;
  isPublic: boolean;
  board: BoardCell[] | LudoBoardState | LeapOnBoardState;
  turn: GameSymbol;
  status: 'waiting' | 'playing' | 'finished';
  winner: GameSymbol | 'draw' | null;
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
  yourSymbol: GameSymbol | null;
  you: PlayerProfile | null;
};
