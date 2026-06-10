import type { GameType } from '@/types/game';

/** Label + CSS class for each game card in Choose Game carousel. Add an entry for every GameType. */
export const GAME_CAROUSEL_THUMBNAILS: Record<
  GameType,
  {
    label: string;
    className: string;
  }
> = {
  'tic-tac-two': { label: 'X / O', className: 'choose-game-thumb-tic-tac-two' },
  'connect-all-four': { label: '4 IN A ROW', className: 'choose-game-thumb-connect-all-four' },
  'orbital-flip': { label: 'ORBIT', className: 'choose-game-thumb-orbital-flip' },
  'corner-clash': { label: 'CORNERS', className: 'choose-game-thumb-corner-clash' },
  checkers: { label: 'CHECKERS', className: 'choose-game-thumb-checkers' },
  chess: { label: 'CHESS', className: 'choose-game-thumb-chess' },
  ludo: { label: 'LUDO', className: 'choose-game-thumb-ludo' },
  'leap-on': { label: 'LEAP', className: 'choose-game-thumb-leap-on' },
  '2048': { label: 'MERGE', className: 'choose-game-thumb-2048' },
  sudoku: { label: '9 x 9', className: 'choose-game-thumb-sudoku' },
  minesweeper: { label: 'MINES', className: 'choose-game-thumb-minesweeper' },
  'memory-match': { label: 'PAIRS', className: 'choose-game-thumb-memory-match' },
  'dino-run': { label: 'DODGE', className: 'choose-game-thumb-dino-run' },
  snake: { label: 'SNAKE', className: 'choose-game-thumb-snake' },
  brickbreaker: { label: 'BRICKS', className: 'choose-game-thumb-brickbreaker' },
  'air-hockey': { label: 'PUCK', className: 'choose-game-thumb-air-hockey' },
  'space-invaders': { label: 'INVADERS', className: 'choose-game-thumb-space-invaders' },
  'neon-pong': { label: 'NEON', className: 'choose-game-thumb-neon-pong' },
  tetris: { label: 'TETRIS', className: 'choose-game-thumb-tetris' },
  'starfall-survivor': { label: 'STARFALL', className: 'choose-game-thumb-starfall-survivor' },
  'rift-runner': { label: 'RIFT RUN', className: 'choose-game-thumb-rift-runner' },
  'pulse-forge': { label: 'PULSE', className: 'choose-game-thumb-pulse-forge' },
  blackjack: { label: 'BLACKJACK', className: 'choose-game-thumb-blackjack' },
  'turbo-rush': { label: 'TURBO', className: 'choose-game-thumb-turbo-rush' },
};

export const getGameCarouselThumbnail = (gameType: GameType) => GAME_CAROUSEL_THUMBNAILS[gameType];
