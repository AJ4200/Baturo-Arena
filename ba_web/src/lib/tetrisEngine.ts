// Lightweight Tetris engine: pure functions and helpers for a simple single-player Tetris

export type Cell = string | null;
export type Grid = Cell[]; // rows * columns

export type Tetromino = {
  id: string;
  blocks: number[][]; // array of rotation states, each is array of cell indexes in a 4x4 matrix
  color?: string;
};

export const TETROMINOES: Tetromino[] = [
  { id: 'I', blocks: [[1,5,9,13],[4,5,6,7],[1,5,9,13],[4,5,6,7]], color: '#4ecdc4' },
  { id: 'J', blocks: [[0,4,5,6],[1,2,5,9],[4,5,6,10],[1,5,9,8]], color: '#556270' },
  { id: 'L', blocks: [[2,4,5,6],[1,5,9,10],[4,5,6,8],[0,1,5,9]], color: '#c7f464' },
  { id: 'O', blocks: [[1,2,5,6],[1,2,5,6],[1,2,5,6],[1,2,5,6]], color: '#ff6b6b' },
  { id: 'S', blocks: [[1,2,4,5],[1,5,6,10],[1,2,4,5],[1,5,6,10]], color: '#ffd166' },
  { id: 'T', blocks: [[1,4,5,6],[1,5,6,9],[4,5,6,9],[1,4,5,9]], color: '#06d6a0' },
  { id: 'Z', blocks: [[0,1,5,6],[2,5,6,9],[0,1,5,6],[2,5,6,9]], color: '#118ab2' },
];

export type Spawned = {
  tetromino: Tetromino;
  rotation: number; // 0..3
  x: number; // column in board for top-left of 4x4 box
  y: number; // row
};

export const createEmptyGrid = (rows: number, columns: number): Grid => Array(rows * columns).fill(null);

export const randomTetromino = (): Tetromino =>
  TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];

export const createSpawned = (rows: number, columns: number, tetromino?: Tetromino): Spawned => {
  const tet = tetromino ?? randomTetromino();
  const rotation = 0;
  const x = Math.floor(columns / 2) - 2; // place 4x4 box
  const y = -1; // start above screen
  return { tetromino: tet, rotation, x, y };
};

export const spawnTetromino = (rows: number, columns: number): Spawned => createSpawned(rows, columns);

export const getTetrominoColor = (id: string | null): string =>
  TETROMINOES.find((tetromino) => tetromino.id === id)?.color ?? '#6ee7b7';

export const getCell = (grid: Grid, rows: number, columns: number, row: number, col: number): Cell => {
  if (row < 0 || col < 0 || row >= rows || col >= columns) return null;
  return grid[row * columns + col];
};

export const setCell = (grid: Grid, rows: number, columns: number, row: number, col: number, value: Cell) => {
  const copy = [...grid];
  copy[row * columns + col] = value;
  return copy;
};

const forEachBlock = (spawned: Spawned, fn: (r: number, c: number, indexIn4x4: number) => void) => {
  const shape = spawned.tetromino.blocks[spawned.rotation % spawned.tetromino.blocks.length];
  for (const idx of shape) {
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    fn(r, c, idx);
  }
};

export const isCollision = (grid: Grid, rows: number, columns: number, spawned: Spawned): boolean => {
  let collided = false;
  forEachBlock(spawned, (r, c) => {
    const globalR = spawned.y + r;
    const globalC = spawned.x + c;
    if (globalC < 0 || globalC >= columns || globalR >= rows) {
      collided = true;
      return;
    }
    if (globalR >= 0) {
      const cell = getCell(grid, rows, columns, globalR, globalC);
      if (cell) {
        collided = true;
        return;
      }
    }
  });
  return collided;
};

export const placeTetromino = (grid: Grid, rows: number, columns: number, spawned: Spawned, value: string): Grid => {
  let next = [...grid];
  forEachBlock(spawned, (r, c) => {
    const globalR = spawned.y + r;
    const globalC = spawned.x + c;
    if (globalR >= 0 && globalR < rows && globalC >= 0 && globalC < columns) {
      next[globalR * columns + globalC] = value;
    }
  });
  return next;
};

export const clearFullLines = (grid: Grid, rows: number, columns: number): { grid: Grid; linesCleared: number } => {
  const newRows: Cell[][] = [];
  let cleared = 0;
  for (let r = 0; r < rows; r++) {
    const rowCells: Cell[] = [];
    for (let c = 0; c < columns; c++) {
      rowCells.push(getCell(grid, rows, columns, r, c));
    }
    const isFull = rowCells.every((cell) => cell !== null);
    if (!isFull) {
      newRows.push(rowCells);
    } else {
      cleared += 1;
    }
  }

  while (newRows.length < rows) {
    newRows.unshift(Array(columns).fill(null));
  }

  const flat = newRows.flat();
  return { grid: flat, linesCleared: cleared };
};

export const rotateSpawned = (spawned: Spawned, direction: 1 | -1): Spawned => {
  const nextRotation = (spawned.rotation + (direction === 1 ? 1 : 3)) % 4;
  return { ...spawned, rotation: nextRotation };
};

export const moveSpawned = (spawned: Spawned, dx: number, dy: number): Spawned => ({ ...spawned, x: spawned.x + dx, y: spawned.y + dy });

export const scoreForLines = (lines: number): number => {
  if (lines <= 0) return 0;
  const base = [0, 40, 100, 300, 1200];
  return base[lines] || lines * 1000;
};
