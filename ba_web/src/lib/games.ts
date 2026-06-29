import type { BoardCell, ChessPiece, GameCategory, GameDefinition, GameMove, GameSymbol, GameType } from '@/types/game';

export const GAME_CATEGORY_LABELS: Record<GameCategory, string> = {
  board: 'Board',
  puzzle: 'Puzzle',
  arcade: 'Arcade',
  action: 'Action',
  sports: 'Sports',
  rhythm: 'Rhythm',
  cards: 'Cards',
  racing: 'Racing',
  strategy: 'Strategy',
};

export const formatGameCategory = (category: GameCategory): string =>
  GAME_CATEGORY_LABELS[category] || category;

export const FALLBACK_GAMES: GameDefinition[] = [
  {
    id: 'tic-tac-two',
    category: 'board',
    name: 'Tic-Tac-Two',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic tic-tac-toe with turn order X, O, Y, and Z for up to 4 players.',
    rows: 3,
    columns: 3,
    connect: 3,
    moveMode: 'cell',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'connect-all-four',
    category: 'board',
    name: 'Connect-All-Four',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Drop pieces into columns and connect four before your rival does.',
    rows: 6,
    columns: 7,
    connect: 4,
    moveMode: 'column',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'orbital-flip',
    category: 'board',
    name: 'Orbital-Flip',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Expanded 6x6 orbital grid: place a piece each turn and flip neighboring enemy tiles to control space.',
    rows: 6,
    columns: 6,
    connect: 0,
    moveMode: 'flip',
    winCondition: 'majority',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'corner-clash',
    category: 'board',
    name: 'Corner-Clash',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Capture the corners. Every move also flips orthogonally adjacent enemy tiles.',
    rows: 5,
    columns: 5,
    connect: 0,
    moveMode: 'corner-flip',
    winCondition: 'corners',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'checkers',
    category: 'board',
    name: 'Checkers',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic 8x8 checkers with captures and king promotion.',
    rows: 8,
    columns: 8,
    connect: 0,
    moveMode: 'checkers',
    winCondition: 'elimination',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'chess',
    category: 'board',
    name: 'Chess',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic chess with checkmate, castling, en passant, and automatic queen promotion.',
    rows: 8,
    columns: 8,
    connect: 0,
    moveMode: 'chess',
    winCondition: 'checkmate',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'ludo',
    category: 'board',
    name: 'Ludo',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic 4-token race game. Roll, spawn on six, capture rivals, and get all tokens home first.',
    rows: 15,
    columns: 15,
    connect: 0,
    moveMode: 'ludo',
    winCondition: 'ludo-home',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'leap-on',
    category: 'arcade',
    name: 'Leap',
    minPlayers: 1,
    maxPlayers: 4,
    description: 'Orbit a fixed central anchor, chain leaps between safe white orbs, avoid black hazards, and survive the inward pull.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'leap-on',
    winCondition: 'leap-on-score',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: '2048',
    category: 'puzzle',
    name: '2048',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Slide and merge tiles to reach 2048. Single-player puzzle run.',
    rows: 4,
    columns: 4,
    connect: 0,
    moveMode: 'solo-2048',
    winCondition: 'target-2048',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'sudoku',
    category: 'puzzle',
    name: 'Sudoku',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Fill the 9x9 grid so each row, column, and 3x3 box contains numbers 1-9.',
    rows: 9,
    columns: 9,
    connect: 0,
    moveMode: 'solo-sudoku',
    winCondition: 'sudoku-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'minesweeper',
    category: 'puzzle',
    name: 'Minesweeper',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Clear all safe cells and flag mines without detonating the board.',
    rows: 9,
    columns: 9,
    connect: 0,
    moveMode: 'solo-minesweeper',
    winCondition: 'minesweeper-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'memory-match',
    category: 'puzzle',
    name: 'Memory-Match',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Flip cards, find pairs, and clear the grid in the fewest moves.',
    rows: 4,
    columns: 4,
    connect: 0,
    moveMode: 'solo-memory',
    winCondition: 'memory-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'dino-run',
    category: 'arcade',
    name: 'Dino-Run',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Dash through the neon desert, jump and duck hazards, and survive the distance target.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-dino',
    winCondition: 'dino-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'snake',
    category: 'arcade',
    name: 'Snake',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Navigate your growing snake, eat food, and survive without hitting walls or yourself.',
    rows: 20,
    columns: 20,
    connect: 0,
    moveMode: 'solo-snake',
    winCondition: 'snake-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'maze-flux',
    category: 'puzzle',
    name: 'Maze Flux',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Route an energy core through an original neon circuit maze, recover every signal, and outmaneuver scanner drones.',
    rows: 15,
    columns: 17,
    connect: 0,
    moveMode: 'solo-maze-flux',
    winCondition: 'maze-flux-clear',
    supportsOnline: false,
    supportsCpu: true,
  },

  {
    id: 'brickbreaker',
    category: 'arcade',
    name: 'Brick Breaker',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Retro brick-breaking action with score combos and rising ball speed over rounds.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-brickbreaker',
    winCondition: 'brickbreaker-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'sling-shot',
    category: 'arcade',
    name: 'Sling Shot',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Arc a limited set of shots through breakable target towers. Read the angle, tune the pull, and clear the stack.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-sling-shot',
    winCondition: 'sling-shot-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'flappy-wing',
    category: 'arcade',
    name: 'Flappy Wing',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Tap through tight sky gates, keep lift under control, and survive the scoring run without clipping a tower.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-flappy-wing',
    winCondition: 'flappy-wing-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'voxel-yard',
    category: 'action',
    name: 'Voxel Yard',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'A compact 3D block-building sandbox. Select faces, place cubes, break upper blocks, and complete the yard build target.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-voxel-yard',
    winCondition: 'voxel-yard-build',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'crate-shift',
    category: 'puzzle',
    name: 'Crate Shift',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Push crates through a walled warehouse and park every crate on a marked pad without trapping your route.',
    rows: 9,
    columns: 9,
    connect: 0,
    moveMode: 'solo-crate-shift',
    winCondition: 'crate-shift-solve',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'mole-bash',
    category: 'arcade',
    name: 'Mole Bash',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Tap quick pop-up targets across a 3x3 hole board, avoid decoys, and clear the score goal before the timer expires.',
    rows: 3,
    columns: 3,
    connect: 0,
    moveMode: 'solo-mole-bash',
    winCondition: 'mole-bash-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'air-hockey',
    category: 'sports',
    name: 'Air Hockey',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Fast-paced table duel with real-time puck physics, rounds, and match scoring.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'air-hockey',
    winCondition: 'air-hockey-score',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'space-invaders',
    category: 'action',
    name: 'Space Invaders',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Defend the arena, blast invading fleets, and survive the final wave with your shields intact.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-space-invaders',
    winCondition: 'space-invaders-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'neon-pong',
    category: 'arcade',
    name: 'Neon Pong',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Retro paddle duel against the arena CPU. First to seven neon points claims the rally crown.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-neon-pong',
    winCondition: 'neon-pong-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'tetris',
    category: 'arcade',
    name: 'Tetris',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Stack falling tetrominoes, clear lines, and chase the high score.',
    rows: 20,
    columns: 10,
    connect: 0,
    moveMode: 'solo-tetris',
    winCondition: 'tetris-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'starfall-survivor',
    category: 'action',
    name: 'Starfall Survivor',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Pilot a prism skiff through a collapsing sky, recover star shards, and outfly comet swarms before the rift closes.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-starfall',
    winCondition: 'starfall-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'rift-runner',
    category: 'action',
    name: 'Rift Runner',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Blast through rift sentinels, recover their stolen cores, and phase across the arena before the vault seals.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-rift-runner',
    winCondition: 'rift-runner-extract',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'dread-sector',
    category: 'action',
    name: 'Dread Sector',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'A clean-room retro raycaster. Purge the maze, recover supplies, and reach extraction alive.',
    rows: 16,
    columns: 16,
    connect: 0,
    moveMode: 'solo-dread-sector',
    winCondition: 'dread-sector-extract',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'echo-bloom',
    category: 'rhythm',
    name: 'Echo Bloom',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'A radial rhythm ritual. Strike inward pulses on the beat and grow a luminous flower from pure harmony.',
    rows: 1,
    columns: 4,
    connect: 0,
    moveMode: 'solo-echo-bloom',
    winCondition: 'echo-bloom-resonate',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'pulse-forge',
    category: 'arcade',
    name: 'Pulse Forge',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Balance four volatile energy lanes, vent heat, and forge enough clean pulses before the reactor window closes.',
    rows: 1,
    columns: 4,
    connect: 0,
    moveMode: 'solo-pulse-forge',
    winCondition: 'pulse-forge-stabilize',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'prism-relay',
    category: 'strategy',
    name: 'Prism Relay',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Rotate a six-node prism, route color-matched pulses, and vent charged conduits before the relay lattice overloads.',
    rows: 1,
    columns: 6,
    connect: 0,
    moveMode: 'solo-prism-relay',
    winCondition: 'prism-relay-stabilize',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'blackjack',
    category: 'cards',
    name: 'Blackjack',
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Play classic twenty-one against the arena dealer. Read the table, manage your aces, and win five hands to take the match.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'solo-blackjack',
    winCondition: 'blackjack-five-wins',
    supportsOnline: false,
    supportsCpu: true,
  },
  {
    id: 'turbo-rush',
    category: 'racing',
    name: 'Turbo Rush',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'A realtime neon street race with boost pads, traffic hazards, live rivals, and a sprint to the finish line.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'racing',
    winCondition: 'race-finish',
    supportsOnline: true,
    supportsCpu: true,
  },
  {
    id: 'cipher-auction',
    category: 'strategy',
    name: 'Cipher Auction',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'A realtime sealed-bid battle. Split signal chips across encrypted vaults, outread every rival, and land the highest uncontested bids.',
    rows: 1,
    columns: 1,
    connect: 0,
    moveMode: 'cipher-auction',
    winCondition: 'cipher-score',
    supportsOnline: true,
    supportsCpu: true,
  },
];

export const getGameDefinition = (gameType: GameType, games = FALLBACK_GAMES): GameDefinition => {
  return games.find((game) => game.id === gameType) || FALLBACK_GAMES[0];
};

export const createEmptyBoard = (gameType: GameType, games = FALLBACK_GAMES): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  const board = Array(game.rows * game.columns).fill(null);

  if (game.id === 'orbital-flip') {
    const topRow = Math.floor(game.rows / 2) - 1;
    const bottomRow = Math.floor(game.rows / 2);
    const leftColumn = Math.floor(game.columns / 2) - 1;
    const rightColumn = Math.floor(game.columns / 2);

    board[getCellIndex(topRow, leftColumn, game.columns)] = 'X';
    board[getCellIndex(topRow, rightColumn, game.columns)] = 'O';
    board[getCellIndex(bottomRow, leftColumn, game.columns)] = 'O';
    board[getCellIndex(bottomRow, rightColumn, game.columns)] = 'X';
  }

  if (game.id === 'checkers') {
    for (let row = 0; row < game.rows; row += 1) {
      for (let column = 0; column < game.columns; column += 1) {
        if ((row + column) % 2 === 0) {
          continue;
        }

        const index = getCellIndex(row, column, game.columns);
        if (row <= 2) {
          board[index] = 'OC';
        } else if (row >= game.rows - 3) {
          board[index] = 'XC';
        }
      }
    }
  }

  if (game.id === 'chess') {
    const blackBackRank: ChessPiece[] = ['OCRU', 'OCN', 'OCB', 'OCQ', 'OCKU', 'OCB', 'OCN', 'OCRU'];
    const whiteBackRank: ChessPiece[] = ['XCRU', 'XCN', 'XCB', 'XCQ', 'XCKU', 'XCB', 'XCN', 'XCRU'];

    blackBackRank.forEach((piece, column) => {
      board[getCellIndex(0, column, game.columns)] = piece;
      board[getCellIndex(1, column, game.columns)] = 'OCP';
      board[getCellIndex(game.rows - 2, column, game.columns)] = 'XCP';
      board[getCellIndex(game.rows - 1, column, game.columns)] = whiteBackRank[column];
    });
  }

  return board;
};

const getCellIndex = (row: number, column: number, columns: number) => row * columns + column;
const COMPETITIVE_SYMBOLS: GameSymbol[] = ['X', 'O', 'Y', 'Z'];

const isCheckersPiece = (cell: BoardCell): cell is 'XC' | 'XK' | 'OC' | 'OK' =>
  cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';

const isCompetitiveSymbol = (cell: BoardCell): cell is GameSymbol =>
  cell === 'X' || cell === 'O' || cell === 'Y' || cell === 'Z';

const getCheckersOwner = (cell: BoardCell): 'X' | 'O' | null => {
  if (!isCheckersPiece(cell)) {
    return null;
  }
  return cell.startsWith('X') ? 'X' : 'O';
};

const isCheckersKing = (cell: BoardCell): boolean => cell === 'XK' || cell === 'OK';

const getCheckersPiece = (owner: 'X' | 'O', isKing: boolean): 'XC' | 'XK' | 'OC' | 'OK' => {
  if (owner === 'X') {
    return isKing ? 'XK' : 'XC';
  }
  return isKing ? 'OK' : 'OC';
};

type CheckersMove = { from: number; to: number };

export type CheckersCandidateMove = CheckersMove & { captureIndex: number | null };

const getCheckersCandidateMoves = (
  board: BoardCell[],
  owner: 'X' | 'O',
  rows: number,
  columns: number
): { captures: CheckersCandidateMove[]; regular: CheckersCandidateMove[] } => {
  const captures: CheckersCandidateMove[] = [];
  const regular: CheckersCandidateMove[] = [];

  for (let index = 0; index < board.length; index += 1) {
    const cell = board[index];
    if (!isCheckersPiece(cell) || getCheckersOwner(cell) !== owner) {
      continue;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowSteps = isCheckersKing(cell) ? [-1, 1] : owner === 'X' ? [-1] : [1];

    for (const rowStep of rowSteps) {
      for (const columnStep of [-1, 1]) {
        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= rows ||
          nextColumn < 0 ||
          nextColumn >= columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, columns);
        const nextCell = board[nextIndex];

        if (nextCell === null) {
          regular.push({ from: index, to: nextIndex, captureIndex: null });
          continue;
        }

        const nextOwner = getCheckersOwner(nextCell);
        if (!nextOwner || nextOwner === owner) {
          continue;
        }

        const jumpRow = row + rowStep * 2;
        const jumpColumn = column + columnStep * 2;
        if (
          jumpRow < 0 ||
          jumpRow >= rows ||
          jumpColumn < 0 ||
          jumpColumn >= columns
        ) {
          continue;
        }

        const jumpIndex = getCellIndex(jumpRow, jumpColumn, columns);
        if (board[jumpIndex] === null) {
          captures.push({ from: index, to: jumpIndex, captureIndex: nextIndex });
        }
      }
    }
  }

  return { captures, regular };
};

const findCheckersMove = (
  board: BoardCell[],
  owner: 'X' | 'O',
  move: CheckersMove,
  rows: number,
  columns: number
): CheckersCandidateMove | null => {
  const candidates = getCheckersCandidateMoves(board, owner, rows, columns);
  const source = candidates.captures.length > 0 ? candidates.captures : candidates.regular;
  return source.find((candidate) => candidate.from === move.from && candidate.to === move.to) || null;
};

export const getCheckersMoves = (
  gameType: GameType,
  board: BoardCell[],
  symbol: 'X' | 'O',
  games = FALLBACK_GAMES
): CheckersCandidateMove[] => {
  const game = getGameDefinition(gameType, games);
  if (game.moveMode !== 'checkers') {
    return [];
  }

  const candidates = getCheckersCandidateMoves(board, symbol, game.rows, game.columns);
  return candidates.captures.length > 0 ? candidates.captures : candidates.regular;
};

type ChessOwner = 'X' | 'O';
type ChessKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export type ChessCandidateMove = { from: number; to: number };

const isChessPiece = (cell: BoardCell): cell is ChessPiece =>
  cell === 'XCP' ||
  cell === 'XCPV' ||
  cell === 'XCN' ||
  cell === 'XCB' ||
  cell === 'XCR' ||
  cell === 'XCRU' ||
  cell === 'XCQ' ||
  cell === 'XCK' ||
  cell === 'XCKU' ||
  cell === 'OCP' ||
  cell === 'OCPV' ||
  cell === 'OCN' ||
  cell === 'OCB' ||
  cell === 'OCR' ||
  cell === 'OCRU' ||
  cell === 'OCQ' ||
  cell === 'OCK' ||
  cell === 'OCKU';

const getChessOwner = (piece: ChessPiece): ChessOwner => (piece.startsWith('X') ? 'X' : 'O');

const getChessKind = (piece: ChessPiece): ChessKind => {
  const code = piece[2];
  if (code === 'P') return 'pawn';
  if (code === 'N') return 'knight';
  if (code === 'B') return 'bishop';
  if (code === 'R') return 'rook';
  if (code === 'Q') return 'queen';
  return 'king';
};

const isChessSquareAttacked = (
  board: BoardCell[],
  targetIndex: number,
  attacker: ChessOwner,
  rows: number,
  columns: number
): boolean => {
  const targetRow = Math.floor(targetIndex / columns);
  const targetColumn = targetIndex % columns;

  for (let index = 0; index < board.length; index += 1) {
    const piece = board[index];
    if (!isChessPiece(piece) || getChessOwner(piece) !== attacker) {
      continue;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowDistance = targetRow - row;
    const columnDistance = targetColumn - column;
    const kind = getChessKind(piece);

    if (kind === 'pawn') {
      const direction = attacker === 'X' ? -1 : 1;
      if (rowDistance === direction && Math.abs(columnDistance) === 1) {
        return true;
      }
      continue;
    }

    if (kind === 'knight') {
      if (
        (Math.abs(rowDistance) === 2 && Math.abs(columnDistance) === 1) ||
        (Math.abs(rowDistance) === 1 && Math.abs(columnDistance) === 2)
      ) {
        return true;
      }
      continue;
    }

    if (kind === 'king') {
      if (Math.max(Math.abs(rowDistance), Math.abs(columnDistance)) === 1) {
        return true;
      }
      continue;
    }

    const isStraight = rowDistance === 0 || columnDistance === 0;
    const isDiagonal = Math.abs(rowDistance) === Math.abs(columnDistance);
    if (
      (kind === 'rook' && !isStraight) ||
      (kind === 'bishop' && !isDiagonal) ||
      (kind === 'queen' && !isStraight && !isDiagonal)
    ) {
      continue;
    }

    const rowStep = Math.sign(rowDistance);
    const columnStep = Math.sign(columnDistance);
    let scanRow = row + rowStep;
    let scanColumn = column + columnStep;
    let blocked = false;
    while (scanRow !== targetRow || scanColumn !== targetColumn) {
      if (board[getCellIndex(scanRow, scanColumn, columns)] !== null) {
        blocked = true;
        break;
      }
      scanRow += rowStep;
      scanColumn += columnStep;
    }
    if (!blocked) {
      return true;
    }
  }

  return false;
};

const applyChessMoveUnchecked = (
  board: BoardCell[],
  move: ChessCandidateMove,
  rows: number,
  columns: number
): BoardCell[] => {
  const movingPiece = board[move.from];
  if (!isChessPiece(movingPiece)) {
    return [...board];
  }

  const owner = getChessOwner(movingPiece);
  const opponent: ChessOwner = owner === 'X' ? 'O' : 'X';
  const kind = getChessKind(movingPiece);
  const fromRow = Math.floor(move.from / columns);
  const fromColumn = move.from % columns;
  const toRow = Math.floor(move.to / columns);
  const toColumn = move.to % columns;
  const nextBoard: BoardCell[] = board.map((cell) => {
    if (cell === 'XCPV') return 'XCP';
    if (cell === 'OCPV') return 'OCP';
    return cell;
  });

  nextBoard[move.from] = null;

  if (kind === 'pawn' && board[move.to] === null && fromColumn !== toColumn) {
    const capturedPawnIndex = getCellIndex(fromRow, toColumn, columns);
    const capturedPawn = board[capturedPawnIndex];
    if (
      isChessPiece(capturedPawn) &&
      getChessOwner(capturedPawn) === opponent &&
      getChessKind(capturedPawn) === 'pawn' &&
      capturedPawn.endsWith('PV')
    ) {
      nextBoard[capturedPawnIndex] = null;
    }
  }

  if (kind === 'king' && Math.abs(toColumn - fromColumn) === 2) {
    const rookFromColumn = toColumn > fromColumn ? columns - 1 : 0;
    const rookToColumn = toColumn > fromColumn ? toColumn - 1 : toColumn + 1;
    const rookFrom = getCellIndex(fromRow, rookFromColumn, columns);
    const rookTo = getCellIndex(fromRow, rookToColumn, columns);
    nextBoard[rookFrom] = null;
    nextBoard[rookTo] = owner === 'X' ? 'XCR' : 'OCR';
  }

  let placedPiece: ChessPiece = movingPiece;
  if (kind === 'pawn') {
    if (toRow === 0 || toRow === rows - 1) {
      placedPiece = owner === 'X' ? 'XCQ' : 'OCQ';
    } else if (Math.abs(toRow - fromRow) === 2) {
      placedPiece = owner === 'X' ? 'XCPV' : 'OCPV';
    } else {
      placedPiece = owner === 'X' ? 'XCP' : 'OCP';
    }
  } else if (kind === 'rook') {
    placedPiece = owner === 'X' ? 'XCR' : 'OCR';
  } else if (kind === 'king') {
    placedPiece = owner === 'X' ? 'XCK' : 'OCK';
  }

  nextBoard[move.to] = placedPiece;
  return nextBoard;
};

const getChessPseudoMoves = (
  board: BoardCell[],
  owner: ChessOwner,
  rows: number,
  columns: number
): ChessCandidateMove[] => {
  const moves: ChessCandidateMove[] = [];
  const opponent: ChessOwner = owner === 'X' ? 'O' : 'X';

  const addMove = (from: number, row: number, column: number): boolean => {
    if (row < 0 || row >= rows || column < 0 || column >= columns) {
      return false;
    }
    const to = getCellIndex(row, column, columns);
    const target = board[to];
    if (target === null) {
      moves.push({ from, to });
      return true;
    }
    if (
      isChessPiece(target) &&
      getChessOwner(target) === opponent &&
      getChessKind(target) !== 'king'
    ) {
      moves.push({ from, to });
    }
    return false;
  };

  for (let index = 0; index < board.length; index += 1) {
    const piece = board[index];
    if (!isChessPiece(piece) || getChessOwner(piece) !== owner) {
      continue;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const kind = getChessKind(piece);

    if (kind === 'pawn') {
      const direction = owner === 'X' ? -1 : 1;
      const startRow = owner === 'X' ? rows - 2 : 1;
      const oneRow = row + direction;
      if (oneRow >= 0 && oneRow < rows && board[getCellIndex(oneRow, column, columns)] === null) {
        moves.push({ from: index, to: getCellIndex(oneRow, column, columns) });
        const twoRow = row + direction * 2;
        if (row === startRow && board[getCellIndex(twoRow, column, columns)] === null) {
          moves.push({ from: index, to: getCellIndex(twoRow, column, columns) });
        }
      }

      for (const columnStep of [-1, 1]) {
        const captureRow = row + direction;
        const captureColumn = column + columnStep;
        if (captureRow < 0 || captureRow >= rows || captureColumn < 0 || captureColumn >= columns) {
          continue;
        }
        const captureIndex = getCellIndex(captureRow, captureColumn, columns);
        const target = board[captureIndex];
        if (
          isChessPiece(target) &&
          getChessOwner(target) === opponent &&
          getChessKind(target) !== 'king'
        ) {
          moves.push({ from: index, to: captureIndex });
          continue;
        }
        const adjacent = board[getCellIndex(row, captureColumn, columns)];
        if (
          target === null &&
          isChessPiece(adjacent) &&
          getChessOwner(adjacent) === opponent &&
          getChessKind(adjacent) === 'pawn' &&
          adjacent.endsWith('PV')
        ) {
          moves.push({ from: index, to: captureIndex });
        }
      }
      continue;
    }

    if (kind === 'knight') {
      for (const [rowStep, columnStep] of [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ]) {
        addMove(index, row + rowStep, column + columnStep);
      }
      continue;
    }

    if (kind === 'king') {
      for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
        for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
          if (rowStep !== 0 || columnStep !== 0) {
            addMove(index, row + rowStep, column + columnStep);
          }
        }
      }

      const homeRow = owner === 'X' ? rows - 1 : 0;
      if (piece.endsWith('KU') && row === homeRow && column === 4 && !isChessSquareAttacked(board, index, opponent, rows, columns)) {
        for (const side of [-1, 1]) {
          const rookColumn = side < 0 ? 0 : columns - 1;
          const rook = board[getCellIndex(homeRow, rookColumn, columns)];
          const expectedRook = owner === 'X' ? 'XCRU' : 'OCRU';
          const clearColumns = side < 0 ? [1, 2, 3] : [5, 6];
          const pathColumns = side < 0 ? [3, 2] : [5, 6];
          if (
            rook === expectedRook &&
            clearColumns.every((clearColumn) => board[getCellIndex(homeRow, clearColumn, columns)] === null) &&
            pathColumns.every(
              (pathColumn) =>
                !isChessSquareAttacked(
                  board,
                  getCellIndex(homeRow, pathColumn, columns),
                  opponent,
                  rows,
                  columns
                )
            )
          ) {
            moves.push({ from: index, to: getCellIndex(homeRow, side < 0 ? 2 : 6, columns) });
          }
        }
      }
      continue;
    }

    const directions =
      kind === 'bishop'
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : kind === 'rook'
          ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
          : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    for (const [rowStep, columnStep] of directions) {
      let nextRow = row + rowStep;
      let nextColumn = column + columnStep;
      while (addMove(index, nextRow, nextColumn)) {
        nextRow += rowStep;
        nextColumn += columnStep;
      }
    }
  }

  return moves;
};

export const getChessMoves = (
  gameType: GameType,
  board: BoardCell[],
  owner: ChessOwner,
  games = FALLBACK_GAMES
): ChessCandidateMove[] => {
  const game = getGameDefinition(gameType, games);
  if (game.moveMode !== 'chess') {
    return [];
  }

  const opponent: ChessOwner = owner === 'X' ? 'O' : 'X';
  return getChessPseudoMoves(board, owner, game.rows, game.columns).filter((move) => {
    const nextBoard = applyChessMoveUnchecked(board, move, game.rows, game.columns);
    const kingIndex = nextBoard.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === owner && getChessKind(cell) === 'king'
    );
    return kingIndex >= 0 && !isChessSquareAttacked(nextBoard, kingIndex, opponent, game.rows, game.columns);
  });
};

export const getAvailableMoves = (gameType: GameType, board: BoardCell[], games = FALLBACK_GAMES): number[] => {
  const game = getGameDefinition(gameType, games);

  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino' ||
    game.moveMode === 'solo-snake' ||
    game.moveMode === 'solo-maze-flux' ||
    game.moveMode === 'solo-brickbreaker' ||
    game.moveMode === 'solo-sling-shot' ||
    game.moveMode === 'solo-flappy-wing' ||
    game.moveMode === 'solo-voxel-yard' ||
    game.moveMode === 'solo-crate-shift' ||
    game.moveMode === 'solo-mole-bash' ||
    game.moveMode === 'solo-space-invaders' ||
    game.moveMode === 'solo-neon-pong' ||
    game.moveMode === 'solo-tetris' ||
    game.moveMode === 'solo-starfall' ||
    game.moveMode === 'solo-rift-runner' ||
    game.moveMode === 'solo-dread-sector' ||
    game.moveMode === 'solo-echo-bloom' ||
    game.moveMode === 'solo-pulse-forge' ||
    game.moveMode === 'solo-prism-relay' ||
    game.moveMode === 'solo-blackjack' ||
    game.moveMode === 'air-hockey' ||
    game.moveMode === 'racing' ||
    game.moveMode === 'cipher-auction' ||
    game.moveMode === 'ludo' ||
    game.moveMode === 'leap-on'
  ) {
    return [];
  }

  if (game.moveMode === 'checkers' || game.moveMode === 'chess') {
    return [];
  }

  if (game.moveMode === 'cell' || game.moveMode === 'flip' || game.moveMode === 'corner-flip') {
    return board.reduce<number[]>((moves, cell, index) => {
      if (cell === null) {
        moves.push(index);
      }
      return moves;
    }, []);
  }

  const moves: number[] = [];
  for (let column = 0; column < game.columns; column += 1) {
    if (board[getCellIndex(0, column, game.columns)] === null) {
      moves.push(column);
    }
  }

  return moves;
};

export const applyMove = (
  gameType: GameType,
  board: BoardCell[],
  move: GameMove,
  symbol: Exclude<BoardCell, null>,
  games = FALLBACK_GAMES
): BoardCell[] => {
  const game = getGameDefinition(gameType, games);
  if (
    game.moveMode === 'solo-2048' ||
    game.moveMode === 'solo-sudoku' ||
    game.moveMode === 'solo-minesweeper' ||
    game.moveMode === 'solo-memory' ||
    game.moveMode === 'solo-dino' ||
    game.moveMode === 'solo-snake' ||
    game.moveMode === 'solo-maze-flux' ||
    game.moveMode === 'solo-brickbreaker' ||
    game.moveMode === 'solo-sling-shot' ||
    game.moveMode === 'solo-flappy-wing' ||
    game.moveMode === 'solo-voxel-yard' ||
    game.moveMode === 'solo-crate-shift' ||
    game.moveMode === 'solo-mole-bash' ||
    game.moveMode === 'solo-space-invaders' ||
    game.moveMode === 'solo-neon-pong' ||
    game.moveMode === 'solo-tetris' ||
    game.moveMode === 'solo-starfall' ||
    game.moveMode === 'solo-rift-runner' ||
    game.moveMode === 'solo-dread-sector' ||
    game.moveMode === 'solo-echo-bloom' ||
    game.moveMode === 'solo-pulse-forge' ||
    game.moveMode === 'solo-prism-relay' ||
    game.moveMode === 'solo-blackjack' ||
    game.moveMode === 'air-hockey' ||
    game.moveMode === 'racing' ||
    game.moveMode === 'cipher-auction' ||
    game.moveMode === 'ludo' ||
    game.moveMode === 'leap-on'
  ) {
    return [...board];
  }

  if (game.moveMode === 'checkers') {
    if (typeof move !== 'object' || move === null || 'action' in move) {
      return [...board];
    }
    const owner = symbol.startsWith('O') ? 'O' : 'X';
    const legalMove = findCheckersMove(board, owner, move, game.rows, game.columns);
    if (!legalMove) {
      return [...board];
    }

    const nextBoard = [...board];
    const movingPiece = nextBoard[legalMove.from];
    if (!isCheckersPiece(movingPiece) || getCheckersOwner(movingPiece) !== owner) {
      return [...board];
    }

    nextBoard[legalMove.from] = null;
    if (legalMove.captureIndex !== null) {
      nextBoard[legalMove.captureIndex] = null;
    }

    const destinationRow = Math.floor(legalMove.to / game.columns);
    const shouldPromote =
      !isCheckersKing(movingPiece) &&
      ((owner === 'X' && destinationRow === 0) ||
        (owner === 'O' && destinationRow === game.rows - 1));

    nextBoard[legalMove.to] = shouldPromote
      ? getCheckersPiece(owner, true)
      : movingPiece;

    return nextBoard;
  }

  if (game.moveMode === 'chess') {
    if (typeof move !== 'object' || move === null || 'action' in move) {
      return [...board];
    }
    const owner: ChessOwner = symbol.startsWith('O') ? 'O' : 'X';
    const legalMove = getChessMoves(gameType, board, owner, games).find(
      (candidate) => candidate.from === move.from && candidate.to === move.to
    );
    if (!legalMove) {
      return [...board];
    }
    return applyChessMoveUnchecked(board, legalMove, game.rows, game.columns);
  }

  if (typeof move !== 'number' || !getAvailableMoves(gameType, board, games).includes(move)) {
    return [...board];
  }

  const nextBoard = [...board];

  if (game.moveMode === 'cell') {
    nextBoard[move] = symbol;
    return nextBoard;
  }

  if (game.moveMode === 'flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / game.columns);
    const column = move % game.columns;

    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (rowStep === 0 && columnStep === 0) {
          continue;
        }

        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= game.rows ||
          nextColumn < 0 ||
          nextColumn >= game.columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
        if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
          nextBoard[nextIndex] = symbol;
        }
      }
    }

    return nextBoard;
  }

  if (game.moveMode === 'corner-flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / game.columns);
    const column = move % game.columns;
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [rowStep, columnStep] of deltas) {
      const nextRow = row + rowStep;
      const nextColumn = column + columnStep;

      if (
        nextRow < 0 ||
        nextRow >= game.rows ||
        nextColumn < 0 ||
        nextColumn >= game.columns
      ) {
        continue;
      }

      const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
      if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
        nextBoard[nextIndex] = symbol;
      }
    }

    return nextBoard;
  }

  for (let row = game.rows - 1; row >= 0; row -= 1) {
    const index = getCellIndex(row, move, game.columns);
    if (nextBoard[index] === null) {
      nextBoard[index] = symbol;
      return nextBoard;
    }
  }

  return nextBoard;
};

export const evaluateBoard = (
  gameType: GameType,
  board: BoardCell[],
  games = FALLBACK_GAMES,
  activeSymbol?: GameSymbol
): GameSymbol | 'draw' | null => {
  const game = getGameDefinition(gameType, games);
  if (game.winCondition === 'checkmate') {
    const xKing = board.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === 'X' && getChessKind(cell) === 'king'
    );
    const oKing = board.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === 'O' && getChessKind(cell) === 'king'
    );
    if (xKing < 0) return 'O';
    if (oKing < 0) return 'X';

    const symbolsToEvaluate: ChessOwner[] =
      activeSymbol === 'X' || activeSymbol === 'O' ? [activeSymbol] : ['X', 'O'];
    for (const symbol of symbolsToEvaluate) {
      const moves = getChessMoves(gameType, board, symbol, games);
      if (moves.length > 0) {
        continue;
      }
      const kingIndex = symbol === 'X' ? xKing : oKing;
      const opponent: ChessOwner = symbol === 'X' ? 'O' : 'X';
      return isChessSquareAttacked(board, kingIndex, opponent, game.rows, game.columns)
        ? opponent
        : 'draw';
    }
    return null;
  }

  if (
    game.winCondition === 'elimination' ||
    game.winCondition === 'ludo-home' ||
    game.winCondition === 'target-2048' ||
    game.winCondition === 'sudoku-complete' ||
    game.winCondition === 'minesweeper-clear' ||
    game.winCondition === 'memory-complete' ||
    game.winCondition === 'dino-survive' ||
    game.winCondition === 'snake-survive' ||
    game.winCondition === 'maze-flux-clear' ||
    game.winCondition === 'space-invaders-clear' ||
    game.winCondition === 'brickbreaker-clear' ||
    game.winCondition === 'sling-shot-clear' ||
    game.winCondition === 'flappy-wing-score' ||
    game.winCondition === 'voxel-yard-build' ||
    game.winCondition === 'crate-shift-solve' ||
    game.winCondition === 'mole-bash-score' ||
    game.winCondition === 'neon-pong-score' ||
    game.winCondition === 'tetris-score' ||
    game.winCondition === 'starfall-survive' ||
    game.winCondition === 'rift-runner-extract' ||
    game.winCondition === 'dread-sector-extract' ||
    game.winCondition === 'echo-bloom-resonate' ||
    game.winCondition === 'pulse-forge-stabilize' ||
    game.winCondition === 'prism-relay-stabilize' ||
    game.winCondition === 'blackjack-five-wins' ||
    game.winCondition === 'air-hockey-score' ||
    game.winCondition === 'race-finish' ||
    game.winCondition === 'cipher-score'
  ) {
    if (game.winCondition !== 'elimination') {
      return null;
    }

    const xPieces = board.filter((cell) => getCheckersOwner(cell) === 'X').length;
    const oPieces = board.filter((cell) => getCheckersOwner(cell) === 'O').length;

    if (xPieces === 0) {
      return 'O';
    }

    if (oPieces === 0) {
      return 'X';
    }

    const xMoves = getCheckersCandidateMoves(board, 'X', game.rows, game.columns);
    const oMoves = getCheckersCandidateMoves(board, 'O', game.rows, game.columns);
    const xHasMoves = xMoves.captures.length + xMoves.regular.length > 0;
    const oHasMoves = oMoves.captures.length + oMoves.regular.length > 0;

    if (!xHasMoves && !oHasMoves) {
      return 'draw';
    }

    if (!xHasMoves) {
      return 'O';
    }

    if (!oHasMoves) {
      return 'X';
    }

    return null;
  }

  if (game.winCondition === 'majority') {
    const counts = new Map<GameSymbol, number>();
    COMPETITIVE_SYMBOLS.forEach((symbol) => counts.set(symbol, 0));
    board.forEach((cell) => {
      if (isCompetitiveSymbol(cell)) {
        counts.set(cell, (counts.get(cell) || 0) + 1);
      }
    });

    if (board.every((cell) => cell !== null)) {
      const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
      if (sorted.length === 0 || sorted[0][1] <= 0) {
        return 'draw';
      }
      if (sorted[1] && sorted[0][1] === sorted[1][1]) {
        return 'draw';
      }
      return sorted[0][0];
    }

    return null;
  }

  if (game.winCondition === 'corners') {
    const corners = [
      getCellIndex(0, 0, game.columns),
      getCellIndex(0, game.columns - 1, game.columns),
      getCellIndex(game.rows - 1, 0, game.columns),
      getCellIndex(game.rows - 1, game.columns - 1, game.columns),
    ];
    const cornerCounts = new Map<GameSymbol, number>();
    COMPETITIVE_SYMBOLS.forEach((symbol) => cornerCounts.set(symbol, 0));

    corners.forEach((index) => {
      const cell = board[index];
      if (isCompetitiveSymbol(cell)) {
        cornerCounts.set(cell, (cornerCounts.get(cell) || 0) + 1);
      }
    });

    const symbolsWithThreeCorners = COMPETITIVE_SYMBOLS.filter(
      (symbol) => (cornerCounts.get(symbol) || 0) >= 3
    );
    if (symbolsWithThreeCorners.length === 1) {
      return symbolsWithThreeCorners[0];
    }

    if (board.every((cell) => cell !== null)) {
      const counts = new Map<GameSymbol, number>();
      COMPETITIVE_SYMBOLS.forEach((symbol) => counts.set(symbol, 0));
      board.forEach((cell) => {
        if (isCompetitiveSymbol(cell)) {
          counts.set(cell, (counts.get(cell) || 0) + 1);
        }
      });
      const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
      if (sorted.length === 0 || sorted[0][1] <= 0) {
        return 'draw';
      }
      if (sorted[1] && sorted[0][1] === sorted[1][1]) {
        return 'draw';
      }
      return sorted[0][0];
    }

    return null;
  }

  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < game.rows; row += 1) {
    for (let column = 0; column < game.columns; column += 1) {
      const startIndex = getCellIndex(row, column, game.columns);
      const symbol = board[startIndex];
      if (!isCompetitiveSymbol(symbol)) {
        continue;
      }
      const owner = symbol;

      for (const [rowStep, columnStep] of directions) {
        let connected = 1;
        while (connected < game.connect) {
          const nextRow = row + rowStep * connected;
          const nextColumn = column + columnStep * connected;
          if (
            nextRow < 0 ||
            nextRow >= game.rows ||
            nextColumn < 0 ||
            nextColumn >= game.columns
          ) {
            break;
          }

          const nextIndex = getCellIndex(nextRow, nextColumn, game.columns);
          if (board[nextIndex] !== symbol) {
            break;
          }
          connected += 1;
        }

        if (connected === game.connect) {
          return owner;
        }
      }
    }
  }

  return board.every((cell) => cell !== null) ? 'draw' : null;
};

export const formatGameName = (gameType: GameType, games = FALLBACK_GAMES): string => {
  return getGameDefinition(gameType, games).name;
};
