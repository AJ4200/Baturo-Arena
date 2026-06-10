const GAME_RULES = {
  'tic-tac-two': {
    id: 'tic-tac-two',
    name: 'Tic-Tac-Two',
    rows: 3,
    columns: 3,
    connect: 3,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic tic-tac-toe with turn order X, O, Y, and Z for up to 4 players.',
    moveMode: 'cell',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  'connect-all-four': {
    id: 'connect-all-four',
    name: 'Connect-All-Four',
    rows: 6,
    columns: 7,
    connect: 4,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Drop pieces into columns and connect four before your rival does.',
    moveMode: 'column',
    winCondition: 'connect',
    supportsOnline: true,
    supportsCpu: true,
  },
  'orbital-flip': {
    id: 'orbital-flip',
    name: 'Orbital-Flip',
    rows: 6,
    columns: 6,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Expanded 6x6 orbital grid: place a piece each turn and flip neighboring enemy tiles to control space.',
    moveMode: 'flip',
    winCondition: 'majority',
    supportsOnline: true,
    supportsCpu: true,
  },
  'corner-clash': {
    id: 'corner-clash',
    name: 'Corner-Clash',
    rows: 5,
    columns: 5,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Capture the corners. Every move also flips orthogonally adjacent enemy tiles.',
    moveMode: 'corner-flip',
    winCondition: 'corners',
    supportsOnline: true,
    supportsCpu: true,
  },
  checkers: {
    id: 'checkers',
    name: 'Checkers',
    rows: 8,
    columns: 8,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic 8x8 checkers with captures and king promotion.',
    moveMode: 'checkers',
    winCondition: 'elimination',
    supportsOnline: true,
    supportsCpu: true,
  },
  chess: {
    id: 'chess',
    name: 'Chess',
    rows: 8,
    columns: 8,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic chess with checkmate, castling, en passant, and automatic queen promotion.',
    moveMode: 'chess',
    winCondition: 'checkmate',
    supportsOnline: true,
    supportsCpu: true,
  },
  ludo: {
    id: 'ludo',
    name: 'Ludo',
    rows: 15,
    columns: 15,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Classic 4-token race game. Roll, spawn on six, capture rivals, and get all tokens home first.',
    moveMode: 'ludo',
    winCondition: 'ludo-home',
    supportsOnline: true,
    supportsCpu: true,
  },
  'leap-on': {
    id: 'leap-on',
    name: 'Leap',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 4,
    description: 'Orbit a fixed central anchor, chain leaps between safe white orbs, avoid black hazards, and survive the inward pull.',
    moveMode: 'leap-on',
    winCondition: 'leap-on-score',
    supportsOnline: true,
    supportsCpu: true,
  },
  '2048': {
    id: '2048',
    name: '2048',
    rows: 4,
    columns: 4,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Slide and merge tiles to reach 2048. Single-player puzzle run.',
    moveMode: 'solo-2048',
    winCondition: 'target-2048',
    supportsOnline: false,
    supportsCpu: true,
  },
  sudoku: {
    id: 'sudoku',
    name: 'Sudoku',
    rows: 9,
    columns: 9,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Fill the 9x9 grid so each row, column, and 3x3 box contains numbers 1-9.',
    moveMode: 'solo-sudoku',
    winCondition: 'sudoku-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  minesweeper: {
    id: 'minesweeper',
    name: 'Minesweeper',
    rows: 9,
    columns: 9,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Clear all safe cells and flag mines without detonating the board.',
    moveMode: 'solo-minesweeper',
    winCondition: 'minesweeper-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  'memory-match': {
    id: 'memory-match',
    name: 'Memory-Match',
    rows: 4,
    columns: 4,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Flip cards, find pairs, and clear the grid in the fewest moves.',
    moveMode: 'solo-memory',
    winCondition: 'memory-complete',
    supportsOnline: false,
    supportsCpu: true,
  },
  'dino-run': {
    id: 'dino-run',
    name: 'Dino-Run',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Dash through the neon desert, jump and duck hazards, and survive the distance target.',
    moveMode: 'solo-dino',
    winCondition: 'dino-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
  snake: {
    id: 'snake',
    name: 'Snake',
    rows: 20,
    columns: 20,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Navigate your growing snake, eat food, and survive without hitting walls or yourself.',
    moveMode: 'solo-snake',
    winCondition: 'snake-survive',
    supportsOnline: false,
    supportsCpu: true,
  },

  brickbreaker: {
    id: 'brickbreaker',
    name: 'BrickBreaker',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Retro brick-breaking action with score combos and rising ball speed over rounds.',
    moveMode: 'solo-brickbreaker',
    winCondition: 'brickbreaker-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  'air-hockey': {
    id: 'air-hockey',
    name: 'Air Hockey',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Fast-paced table duel with real-time puck physics, rounds, and match scoring.',
    moveMode: 'air-hockey',
    winCondition: 'air-hockey-score',
    supportsOnline: true,
    supportsCpu: true,
  },
  'space-invaders': {
    id: 'space-invaders',
    name: 'Space Invaders',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Defend the arena, blast invading fleets, and survive the final wave with your shields intact.',
    moveMode: 'solo-space-invaders',
    winCondition: 'space-invaders-clear',
    supportsOnline: false,
    supportsCpu: true,
  },
  'neon-pong': {
    id: 'neon-pong',
    name: 'Neon Pong',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Retro paddle duel against the arena CPU. First to seven neon points claims the rally crown.',
    moveMode: 'solo-neon-pong',
    winCondition: 'neon-pong-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  tetris: {
    id: 'tetris',
    name: 'Tetris',
    rows: 20,
    columns: 10,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Stack falling tetrominoes, clear lines, and chase the high score.',
    moveMode: 'solo-tetris',
    winCondition: 'tetris-score',
    supportsOnline: false,
    supportsCpu: true,
  },
  'starfall-survivor': {
    id: 'starfall-survivor',
    name: 'Starfall Survivor',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Pilot a prism skiff through a collapsing sky, recover star shards, and outfly comet swarms before the rift closes.',
    moveMode: 'solo-starfall',
    winCondition: 'starfall-survive',
    supportsOnline: false,
    supportsCpu: true,
  },
  'rift-runner': {
    id: 'rift-runner',
    name: 'Rift Runner',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Blast through rift sentinels, recover their stolen cores, and phase across the arena before the vault seals.',
    moveMode: 'solo-rift-runner',
    winCondition: 'rift-runner-extract',
    supportsOnline: false,
    supportsCpu: true,
  },
  'dread-sector': {
    id: 'dread-sector',
    name: 'Dread Sector',
    rows: 16,
    columns: 16,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'A clean-room retro raycaster. Purge the maze, recover supplies, and reach extraction alive.',
    moveMode: 'solo-dread-sector',
    winCondition: 'dread-sector-extract',
    supportsOnline: false,
    supportsCpu: true,
  },
  'pulse-forge': {
    id: 'pulse-forge',
    name: 'Pulse Forge',
    rows: 1,
    columns: 4,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Balance four volatile energy lanes, vent heat, and forge enough clean pulses before the reactor window closes.',
    moveMode: 'solo-pulse-forge',
    winCondition: 'pulse-forge-stabilize',
    supportsOnline: false,
    supportsCpu: true,
  },
  blackjack: {
    id: 'blackjack',
    name: 'Blackjack',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 1,
    maxPlayers: 1,
    description: 'Play classic twenty-one against the arena dealer. Read the table, manage your aces, and win five hands to take the match.',
    moveMode: 'solo-blackjack',
    winCondition: 'blackjack-five-wins',
    supportsOnline: false,
    supportsCpu: true,
  },
  'turbo-rush': {
    id: 'turbo-rush',
    name: 'Turbo Rush',
    rows: 1,
    columns: 1,
    connect: 0,
    minPlayers: 2,
    maxPlayers: 4,
    description: 'A realtime neon street race with boost pads, traffic hazards, live rivals, and a sprint to the finish line.',
    moveMode: 'racing',
    winCondition: 'race-finish',
    supportsOnline: true,
    supportsCpu: true,
  },
};

function getGameRules(gameType) {
  return GAME_RULES[gameType] || null;
}

function listGameRules() {
  return Object.values(GAME_RULES);
}

function createEmptyBoard(gameType) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  const board = Array(rules.rows * rules.columns).fill(null);

  if (rules.id === 'orbital-flip') {
    const topRow = Math.floor(rules.rows / 2) - 1;
    const bottomRow = Math.floor(rules.rows / 2);
    const leftColumn = Math.floor(rules.columns / 2) - 1;
    const rightColumn = Math.floor(rules.columns / 2);
    const midLeft = getCellIndex(topRow, leftColumn, rules.columns);
    const midRight = getCellIndex(topRow, rightColumn, rules.columns);
    const lowLeft = getCellIndex(bottomRow, leftColumn, rules.columns);
    const lowRight = getCellIndex(bottomRow, rightColumn, rules.columns);
    board[midLeft] = 'X';
    board[midRight] = 'O';
    board[lowLeft] = 'O';
    board[lowRight] = 'X';
  }

  if (rules.id === 'checkers') {
    for (let row = 0; row < rules.rows; row += 1) {
      for (let column = 0; column < rules.columns; column += 1) {
        if ((row + column) % 2 === 0) {
          continue;
        }

        const index = getCellIndex(row, column, rules.columns);
        if (row <= 2) {
          board[index] = 'OC';
        } else if (row >= rules.rows - 3) {
          board[index] = 'XC';
        }
      }
    }
  }

  if (rules.id === 'chess') {
    const blackBackRank = ['OCRU', 'OCN', 'OCB', 'OCQ', 'OCKU', 'OCB', 'OCN', 'OCRU'];
    const whiteBackRank = ['XCRU', 'XCN', 'XCB', 'XCQ', 'XCKU', 'XCB', 'XCN', 'XCRU'];

    blackBackRank.forEach((piece, column) => {
      board[getCellIndex(0, column, rules.columns)] = piece;
      board[getCellIndex(1, column, rules.columns)] = 'OCP';
      board[getCellIndex(rules.rows - 2, column, rules.columns)] = 'XCP';
      board[getCellIndex(rules.rows - 1, column, rules.columns)] = whiteBackRank[column];
    });
  }

  if (rules.id === 'leap-on') {
    return {
      mode: 'leap-on',
      status: 'waiting',
      timeMs: 0,
      round: 0,
      winner: null,
      players: [],
      anchorRadius: 16,
      orbs: [
        { id: 'safe-1', kind: 'safe', angle: 28, radius: 66, spin: 0, drift: 8 },
        { id: 'safe-2', kind: 'safe', angle: 116, radius: 78, spin: 0, drift: -7 },
        { id: 'safe-3', kind: 'safe', angle: 214, radius: 58, spin: 0, drift: 10 },
        { id: 'safe-4', kind: 'safe', angle: 302, radius: 84, spin: 0, drift: -9 },
        { id: 'hazard-1', kind: 'hazard', angle: 74, radius: 50, spin: 0, drift: -13 },
        { id: 'hazard-2', kind: 'hazard', angle: 258, radius: 72, spin: 0, drift: 12 },
        { id: 'split-1', kind: 'split', angle: 168, radius: 68, spin: 25, drift: 16 },
        { id: 'split-2', kind: 'split', angle: 336, radius: 54, spin: 205, drift: -15 },
      ],
      lastEvent: null,
    };
  }

  return board;
}

function getBoardDimensions(gameType) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  return {
    rows: rules.rows,
    columns: rules.columns,
    connect: rules.connect,
    moveMode: rules.moveMode,
    winCondition: rules.winCondition || 'connect',
  };
}

function getCellIndex(row, column, columns) {
  return row * columns + column;
}

const COMPETITIVE_SYMBOLS = ['X', 'O', 'Y', 'Z'];

function isCompetitiveSymbol(cell) {
  return cell === 'X' || cell === 'O' || cell === 'Y' || cell === 'Z';
}

function isCheckersPiece(cell) {
  return cell === 'XC' || cell === 'XK' || cell === 'OC' || cell === 'OK';
}

function getCheckersOwner(cell) {
  if (!isCheckersPiece(cell)) {
    return null;
  }
  return cell.startsWith('X') ? 'X' : 'O';
}

function isCheckersKing(cell) {
  return cell === 'XK' || cell === 'OK';
}

function getCheckersPiece(owner, king) {
  if (owner === 'X') {
    return king ? 'XK' : 'XC';
  }
  return king ? 'OK' : 'OC';
}

function getCheckersCandidateMoves(board, owner, rows, columns) {
  const captures = [];
  const regular = [];

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
}

function parseCheckersMove(move) {
  if (!move || typeof move !== 'object') {
    return null;
  }

  const from = Number(move.from);
  const to = Number(move.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return null;
  }

  return { from, to };
}

function findCheckersMove(board, owner, move, rows, columns) {
  const parsedMove = parseCheckersMove(move);
  if (!parsedMove) {
    return null;
  }

  const candidates = getCheckersCandidateMoves(board, owner, rows, columns);
  const source = candidates.captures.length > 0 ? candidates.captures : candidates.regular;
  return source.find(
    (candidate) => candidate.from === parsedMove.from && candidate.to === parsedMove.to
  ) || null;
}

function isChessPiece(cell) {
  return [
    'XCP', 'XCPV', 'XCN', 'XCB', 'XCR', 'XCRU', 'XCQ', 'XCK', 'XCKU',
    'OCP', 'OCPV', 'OCN', 'OCB', 'OCR', 'OCRU', 'OCQ', 'OCK', 'OCKU',
  ].includes(cell);
}

function getChessOwner(piece) {
  return piece.startsWith('X') ? 'X' : 'O';
}

function getChessKind(piece) {
  const code = piece[2];
  if (code === 'P') return 'pawn';
  if (code === 'N') return 'knight';
  if (code === 'B') return 'bishop';
  if (code === 'R') return 'rook';
  if (code === 'Q') return 'queen';
  return 'king';
}

function isChessSquareAttacked(board, targetIndex, attacker, rows, columns) {
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
}

function applyChessMoveUnchecked(board, move, rows, columns) {
  const movingPiece = board[move.from];
  if (!isChessPiece(movingPiece)) {
    return [...board];
  }

  const owner = getChessOwner(movingPiece);
  const opponent = owner === 'X' ? 'O' : 'X';
  const kind = getChessKind(movingPiece);
  const fromRow = Math.floor(move.from / columns);
  const fromColumn = move.from % columns;
  const toRow = Math.floor(move.to / columns);
  const toColumn = move.to % columns;
  const nextBoard = board.map((cell) => {
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

  let placedPiece = movingPiece;
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
}

function getChessPseudoMoves(board, owner, rows, columns) {
  const moves = [];
  const opponent = owner === 'X' ? 'O' : 'X';

  const addMove = (from, row, column) => {
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
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
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
}

function getChessMoves(board, owner, rows, columns) {
  const opponent = owner === 'X' ? 'O' : 'X';
  return getChessPseudoMoves(board, owner, rows, columns).filter((move) => {
    const nextBoard = applyChessMoveUnchecked(board, move, rows, columns);
    const kingIndex = nextBoard.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === owner && getChessKind(cell) === 'king'
    );
    return kingIndex >= 0 && !isChessSquareAttacked(nextBoard, kingIndex, opponent, rows, columns);
  });
}

function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

function checkWinner(gameType, board, activeSymbol = null) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (rules.winCondition === 'checkmate') {
    const xKing = board.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === 'X' && getChessKind(cell) === 'king'
    );
    const oKing = board.findIndex(
      (cell) => isChessPiece(cell) && getChessOwner(cell) === 'O' && getChessKind(cell) === 'king'
    );
    if (xKing < 0) return 'O';
    if (oKing < 0) return 'X';

    const symbolsToEvaluate = activeSymbol === 'X' || activeSymbol === 'O'
      ? [activeSymbol]
      : ['X', 'O'];
    for (const symbol of symbolsToEvaluate) {
      const moves = getChessMoves(board, symbol, rules.rows, rules.columns);
      if (moves.length > 0) {
        continue;
      }
      const kingIndex = symbol === 'X' ? xKing : oKing;
      const opponent = symbol === 'X' ? 'O' : 'X';
      return isChessSquareAttacked(board, kingIndex, opponent, rules.rows, rules.columns)
        ? opponent
        : 'draw';
    }
    return null;
  }

  if (rules.winCondition === 'elimination') {
    const xPieces = board.filter((cell) => getCheckersOwner(cell) === 'X').length;
    const oPieces = board.filter((cell) => getCheckersOwner(cell) === 'O').length;

    if (xPieces === 0) {
      return 'O';
    }

    if (oPieces === 0) {
      return 'X';
    }

    const xMoves = getCheckersCandidateMoves(board, 'X', rules.rows, rules.columns);
    const oMoves = getCheckersCandidateMoves(board, 'O', rules.rows, rules.columns);
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

  if (
    rules.winCondition === 'ludo-home' ||
    rules.winCondition === 'target-2048' ||
    rules.winCondition === 'sudoku-complete' ||
    rules.winCondition === 'minesweeper-clear' ||
    rules.winCondition === 'memory-complete' ||
    rules.winCondition === 'dino-survive' ||
    rules.winCondition === 'snake-survive' ||
    rules.winCondition === 'space-invaders-clear' ||
    rules.winCondition === 'brickbreaker-clear' ||
    rules.winCondition === 'neon-pong-score' ||
    rules.winCondition === 'tetris-score' ||
    rules.winCondition === 'starfall-survive' ||
    rules.winCondition === 'rift-runner-extract' ||
    rules.winCondition === 'dread-sector-extract' ||
    rules.winCondition === 'pulse-forge-stabilize' ||
    rules.winCondition === 'blackjack-five-wins' ||
    rules.winCondition === 'air-hockey-score' ||
    rules.winCondition === 'race-finish'
  ) {
    return null;
  }

  if (rules.winCondition === 'leap-on-score') {
    if (board && typeof board === 'object' && board.mode === 'leap-on') {
      return board.winner === 'draw' || ['X', 'O', 'Y', 'Z'].includes(board.winner)
        ? board.winner
        : null;
    }
    return null;
  }

  if (rules.winCondition === 'majority') {
    const counts = new Map();
    COMPETITIVE_SYMBOLS.forEach((symbol) => counts.set(symbol, 0));
    board.forEach((cell) => {
      if (isCompetitiveSymbol(cell)) {
        counts.set(cell, (counts.get(cell) || 0) + 1);
      }
    });

    if (isBoardFull(board)) {
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

  if (rules.winCondition === 'corners') {
    const corners = [
      getCellIndex(0, 0, rules.columns),
      getCellIndex(0, rules.columns - 1, rules.columns),
      getCellIndex(rules.rows - 1, 0, rules.columns),
      getCellIndex(rules.rows - 1, rules.columns - 1, rules.columns),
    ];
    const cornerCounts = new Map();
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

    if (isBoardFull(board)) {
      const counts = new Map();
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

  for (let row = 0; row < rules.rows; row += 1) {
    for (let column = 0; column < rules.columns; column += 1) {
      const startIndex = getCellIndex(row, column, rules.columns);
      const symbol = board[startIndex];

      if (!symbol || isCheckersPiece(symbol)) {
        continue;
      }

      for (const [rowStep, columnStep] of directions) {
        let connected = 1;

        while (connected < rules.connect) {
          const nextRow = row + rowStep * connected;
          const nextColumn = column + columnStep * connected;

          if (
            nextRow < 0 ||
            nextRow >= rules.rows ||
            nextColumn < 0 ||
            nextColumn >= rules.columns
          ) {
            break;
          }

          const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
          if (board[nextIndex] !== symbol) {
            break;
          }

          connected += 1;
        }

        if (connected === rules.connect) {
          return symbol;
        }
      }
    }
  }

  if (isBoardFull(board)) {
    return 'draw';
  }

  return null;
}

function getAvailableMoves(gameType, board, symbol = 'X') {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (
    rules.moveMode === 'solo-2048' ||
    rules.moveMode === 'solo-sudoku' ||
    rules.moveMode === 'solo-minesweeper' ||
    rules.moveMode === 'solo-memory' ||
    rules.moveMode === 'solo-dino' ||
    rules.moveMode === 'solo-snake' ||
    rules.moveMode === 'solo-space-invaders' ||
    rules.moveMode === 'solo-brickbreaker' ||
    rules.moveMode === 'solo-neon-pong' ||
    rules.moveMode === 'solo-tetris' ||
    rules.moveMode === 'solo-starfall' ||
    rules.moveMode === 'solo-rift-runner' ||
    rules.moveMode === 'solo-dread-sector' ||
    rules.moveMode === 'solo-pulse-forge' ||
    rules.moveMode === 'solo-blackjack' ||
    rules.moveMode === 'air-hockey' ||
    rules.moveMode === 'racing' ||
    rules.moveMode === 'ludo'
  ) {
    return [];
  }

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const candidates = getCheckersCandidateMoves(board, owner, rules.rows, rules.columns);
    return candidates.captures.length > 0 ? candidates.captures : candidates.regular;
  }

  if (rules.moveMode === 'chess') {
    const owner = symbol === 'O' ? 'O' : 'X';
    return getChessMoves(board, owner, rules.rows, rules.columns);
  }

  if (
    rules.moveMode === 'cell' ||
    rules.moveMode === 'flip' ||
    rules.moveMode === 'corner-flip'
  ) {
    return board.reduce((moves, cell, index) => {
      if (cell === null) {
        moves.push(index);
      }
      return moves;
    }, []);
  }

  const moves = [];
  for (let column = 0; column < rules.columns; column += 1) {
    if (board[getCellIndex(0, column, rules.columns)] === null) {
      moves.push(column);
    }
  }
  return moves;
}

function isValidMove(gameType, board, move, symbol = 'X') {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (rules.moveMode === 'leap-on') {
    return false;
  }

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const parsedMove = parseCheckersMove(move);
    if (!parsedMove) {
      return false;
    }
    return Boolean(findCheckersMove(board, owner, parsedMove, rules.rows, rules.columns));
  }

  if (rules.moveMode === 'chess') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const parsedMove = parseCheckersMove(move);
    if (!parsedMove) {
      return false;
    }
    return getChessMoves(board, owner, rules.rows, rules.columns).some(
      (candidate) => candidate.from === parsedMove.from && candidate.to === parsedMove.to
    );
  }

  return getAvailableMoves(gameType, board, symbol).includes(move);
}

function applyMove(gameType, board, move, symbol) {
  const rules = getGameRules(gameType);
  if (!rules) {
    throw new Error(`Unsupported game type: ${gameType}`);
  }

  if (
    rules.moveMode === 'solo-2048' ||
    rules.moveMode === 'solo-sudoku' ||
    rules.moveMode === 'solo-minesweeper' ||
    rules.moveMode === 'solo-memory' ||
    rules.moveMode === 'solo-dino' ||
    rules.moveMode === 'solo-snake' ||
    rules.moveMode === 'solo-space-invaders' ||
    rules.moveMode === 'solo-brickbreaker' ||
    rules.moveMode === 'solo-neon-pong' ||
    rules.moveMode === 'solo-tetris' ||
    rules.moveMode === 'solo-starfall' ||
    rules.moveMode === 'solo-rift-runner' ||
    rules.moveMode === 'solo-dread-sector' ||
    rules.moveMode === 'solo-pulse-forge' ||
    rules.moveMode === 'solo-blackjack' ||
    rules.moveMode === 'air-hockey' ||
    rules.moveMode === 'racing' ||
    rules.moveMode === 'ludo' ||
    rules.moveMode === 'leap-on'
  ) {
    return [...board];
  }

  const nextBoard = [...board];

  if (rules.moveMode === 'checkers') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const legalMove = findCheckersMove(board, owner, move, rules.rows, rules.columns);
    if (!legalMove) {
      throw new Error('Invalid move');
    }

    const movingPiece = nextBoard[legalMove.from];
    if (!isCheckersPiece(movingPiece) || getCheckersOwner(movingPiece) !== owner) {
      throw new Error('Invalid move');
    }

    nextBoard[legalMove.from] = null;
    if (legalMove.captureIndex !== null) {
      nextBoard[legalMove.captureIndex] = null;
    }

    const destinationRow = Math.floor(legalMove.to / rules.columns);
    const shouldPromote =
      !isCheckersKing(movingPiece) &&
      ((owner === 'X' && destinationRow === 0) ||
        (owner === 'O' && destinationRow === rules.rows - 1));

    nextBoard[legalMove.to] = shouldPromote
      ? getCheckersPiece(owner, true)
      : movingPiece;

    return nextBoard;
  }

  if (rules.moveMode === 'chess') {
    const owner = symbol === 'O' ? 'O' : 'X';
    const parsedMove = parseCheckersMove(move);
    const legalMove = parsedMove
      ? getChessMoves(board, owner, rules.rows, rules.columns).find(
          (candidate) => candidate.from === parsedMove.from && candidate.to === parsedMove.to
        )
      : null;
    if (!legalMove) {
      throw new Error('Invalid move');
    }
    return applyChessMoveUnchecked(board, legalMove, rules.rows, rules.columns);
  }

  if (!isValidMove(gameType, board, move, symbol)) {
    throw new Error('Invalid move');
  }

  if (rules.moveMode === 'cell') {
    nextBoard[move] = symbol;
    return nextBoard;
  }

  if (rules.moveMode === 'flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / rules.columns);
    const column = move % rules.columns;

    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
        if (rowStep === 0 && columnStep === 0) {
          continue;
        }

        const nextRow = row + rowStep;
        const nextColumn = column + columnStep;
        if (
          nextRow < 0 ||
          nextRow >= rules.rows ||
          nextColumn < 0 ||
          nextColumn >= rules.columns
        ) {
          continue;
        }

        const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
        if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
          nextBoard[nextIndex] = symbol;
        }
      }
    }

    return nextBoard;
  }

  if (rules.moveMode === 'corner-flip') {
    nextBoard[move] = symbol;
    const row = Math.floor(move / rules.columns);
    const column = move % rules.columns;
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
        nextRow >= rules.rows ||
        nextColumn < 0 ||
        nextColumn >= rules.columns
      ) {
        continue;
      }

      const nextIndex = getCellIndex(nextRow, nextColumn, rules.columns);
      if (nextBoard[nextIndex] && nextBoard[nextIndex] !== symbol) {
        nextBoard[nextIndex] = symbol;
      }
    }

    return nextBoard;
  }

  for (let row = rules.rows - 1; row >= 0; row -= 1) {
    const index = getCellIndex(row, move, rules.columns);
    if (nextBoard[index] === null) {
      nextBoard[index] = symbol;
      return nextBoard;
    }
  }

  throw new Error('Invalid move');
}

module.exports = {
  GAME_RULES,
  getGameRules,
  listGameRules,
  createEmptyBoard,
  getBoardDimensions,
  checkWinner,
  getAvailableMoves,
  isValidMove,
  applyMove,
};
