'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRobot,
  AiOutlineSound,
  AiOutlineTeam,
  AiOutlineThunderbolt,
  AiOutlineUser,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import type { ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  GameMode,
  MatchResultEvent,
  PlayerProfile,
  RoomPlayer,
  RoomStatePayload,
} from '@/types/game';

type MatchPhase = 'faceoff' | 'playing' | 'goal' | 'won';
type Side = 'left' | 'right';
type DirectionKey = 'up' | 'down' | 'left' | 'right';

type PaddleState = {
  x: number;
  y: number;
};

type PuckState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type AirHockeyState = {
  phase: MatchPhase;
  leftScore: number;
  rightScore: number;
  round: number;
  leftPaddle: PaddleState;
  rightPaddle: PaddleState;
  puck: PuckState;
  lastScorer: Side | null;
  serveTo: Side;
  elapsedMs: number;
};

type AirHockeyArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  roomCode?: string | null;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

const TABLE_WIDTH = 920;
const TABLE_HEIGHT = 540;
const GOAL_HEIGHT = 170;
const GOAL_TOP = Math.round((TABLE_HEIGHT - GOAL_HEIGHT) / 2);
const GOAL_BOTTOM = GOAL_TOP + GOAL_HEIGHT;
const CENTER_LINE_X = TABLE_WIDTH / 2;
const TABLE_PADDING = 18;
const PADDLE_RADIUS = 28;
const PUCK_RADIUS = 18;
const PADDLE_SPEED = 420;
const CPU_SPEED = 360;
const PADDLE_SHOT_BOOST = 0.35;
const FACE_OFF_DELAY_MS = 850;
const MATCH_POINT = 5;
const MIN_PUCK_SPEED = 260;
const MAX_PUCK_SPEED = 760;
const ONLINE_SYNC_INTERVAL_MS = 33;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getLeftBounds = () => ({
  minX: TABLE_PADDING + PADDLE_RADIUS,
  maxX: CENTER_LINE_X - PADDLE_RADIUS - 10,
  minY: TABLE_PADDING + PADDLE_RADIUS,
  maxY: TABLE_HEIGHT - TABLE_PADDING - PADDLE_RADIUS,
});

const getRightBounds = () => ({
  minX: CENTER_LINE_X + PADDLE_RADIUS + 10,
  maxX: TABLE_WIDTH - TABLE_PADDING - PADDLE_RADIUS,
  minY: TABLE_PADDING + PADDLE_RADIUS,
  maxY: TABLE_HEIGHT - TABLE_PADDING - PADDLE_RADIUS,
});

const createPaddles = (): { leftPaddle: PaddleState; rightPaddle: PaddleState } => ({
  leftPaddle: {
    x: 148,
    y: TABLE_HEIGHT / 2,
  },
  rightPaddle: {
    x: TABLE_WIDTH - 148,
    y: TABLE_HEIGHT / 2,
  },
});

const createFaceoffPuck = (): PuckState => ({
  x: TABLE_WIDTH / 2,
  y: TABLE_HEIGHT / 2,
  vx: 0,
  vy: 0,
});

const launchPuck = (serveTo: Side): PuckState => {
  const horizontalDirection = serveTo === 'left' ? -1 : 1;
  const speed = 320 + Math.random() * 55;
  return {
    x: TABLE_WIDTH / 2,
    y: TABLE_HEIGHT / 2 + (Math.random() * 70 - 35),
    vx: horizontalDirection * speed,
    vy: Math.random() * 180 - 90,
  };
};

const createInitialState = (): AirHockeyState => {
  const paddles = createPaddles();
  return {
    phase: 'faceoff',
    leftScore: 0,
    rightScore: 0,
    round: 1,
    ...paddles,
    puck: createFaceoffPuck(),
    lastScorer: null,
    serveTo: 'right',
    elapsedMs: 0,
  };
};

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
  const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    return null;
  }
  return token;
};

const getWsBaseUrl = (): string => API_BASE_URL.replace(/^http/i, 'ws');

const normalizeVector = (x: number, y: number): { x: number; y: number } => {
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
};

const isPaddleState = (value: unknown): value is PaddleState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const paddle = value as PaddleState;
  return Number.isFinite(paddle.x) && Number.isFinite(paddle.y);
};

const isAirHockeyState = (value: unknown): value is AirHockeyState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as AirHockeyState;
  return (
    ['faceoff', 'playing', 'goal', 'won'].includes(candidate.phase) &&
    Number.isFinite(candidate.leftScore) &&
    Number.isFinite(candidate.rightScore) &&
    Number.isFinite(candidate.round) &&
    Number.isFinite(candidate.elapsedMs) &&
    isPaddleState(candidate.leftPaddle) &&
    isPaddleState(candidate.rightPaddle) &&
    Boolean(candidate.puck) &&
    Number.isFinite(candidate.puck.x) &&
    Number.isFinite(candidate.puck.y) &&
    Number.isFinite(candidate.puck.vx) &&
    Number.isFinite(candidate.puck.vy)
  );
};

const getModeLabel = (mode: GameMode): string => {
  if (mode === 'online') {
    return 'Online Match';
  }
  if (mode === 'cpu') {
    return 'CPU Match';
  }
  return 'Local Match';
};

const getModeSubtitle = (mode: GameMode): string => {
  if (mode === 'online') {
    return 'WASD or arrow keys move your paddle';
  }
  if (mode === 'cpu') {
    return 'WASD or arrow keys for you, arena AI on the far side';
  }
  return 'WASD drives the left paddle, arrow keys drive the right paddle';
};

export function AirHockeyArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: AirHockeyArenaGameProps) {
  const [state, setState] = useState<AirHockeyState>(createInitialState);
  const [connectionLabel, setConnectionLabel] = useState(mode === 'online' ? 'Socket idle' : 'Local table');
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [localSide, setLocalSide] = useState<Side | null>(mode === 'online' ? null : 'left');
  const [isOpponentConnected, setIsOpponentConnected] = useState(mode !== 'online');
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const faceoffTimerRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<AirHockeyState>(state);
  const localSideRef = useRef<Side | null>(mode === 'online' ? null : 'left');
  const remotePaddleRef = useRef<PaddleState | null>(null);
  const lastOnlineSyncRef = useRef(0);
  const leftInputRef = useRef<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const rightInputRef = useRef<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const gameLabel = formatGameName('air-hockey', gameDefinitions);
  const isOnlineAuthority = mode !== 'online' || localSide === 'left';
  const hasOnlineOpponent = mode !== 'online' || isOpponentConnected;
  const leftPlayerName = roomPlayers.find((entry) => entry.symbol === 'X')?.name || player.name;
  const rightPlayerName =
    roomPlayers.find((entry) => entry.symbol === 'O')?.name ||
    (mode === 'cpu' ? 'Arena CPU' : mode === 'online' ? 'Waiting for rival' : 'Right Paddle');
  const statusLabel = useMemo(() => {
    if (state.phase === 'won') {
      return state.leftScore > state.rightScore ? `${leftPlayerName} wins` : `${rightPlayerName} wins`;
    }
    if (state.phase === 'goal') {
      return state.lastScorer === 'left' ? `${leftPlayerName} scores` : `${rightPlayerName} scores`;
    }
    if (state.phase === 'faceoff') {
      if (mode === 'online' && !hasOnlineOpponent) {
        return 'Waiting for opponent';
      }
      return `Faceoff ${state.round}`;
    }
    return 'Puck live';
  }, [hasOnlineOpponent, leftPlayerName, mode, rightPlayerName, state.lastScorer, state.leftScore, state.phase, state.rightScore, state.round]);

  const sendSocketMessage = useCallback((message: Record<string, unknown>) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const handleRematch = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    lastFrameTimeRef.current = null;
    remotePaddleRef.current = null;
    const nextState = createInitialState();
    stateRef.current = nextState;
    setState(nextState);
    if (mode === 'online') {
      sendSocketMessage({ type: 'air-hockey-rematch' });
    }
  }, [mode, sendSocketMessage]);

  const handleSetInput = useCallback(
    (side: Side, direction: DirectionKey, isPressed: boolean) => {
      const controlledSide = mode === 'online' ? localSide : side;
      if (!controlledSide) {
        return;
      }
      const targetRef = controlledSide === 'left' ? leftInputRef : rightInputRef;
      targetRef.current[direction] = isPressed;
    },
    [localSide, mode]
  );

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const xRatio = (event.clientX - bounds.left) / bounds.width;
    const yRatio = (event.clientY - bounds.top) / bounds.height;
    const targetX = clamp(xRatio * TABLE_WIDTH, TABLE_PADDING, TABLE_WIDTH - TABLE_PADDING);
    const targetY = clamp(yRatio * TABLE_HEIGHT, TABLE_PADDING, TABLE_HEIGHT - TABLE_PADDING);

    setState((current) => {
      const pointerSide: Side = xRatio <= 0.5 ? 'left' : 'right';
      if (mode === 'online' && pointerSide !== localSide) {
        return current;
      }

      if (pointerSide === 'left') {
        const leftBounds = getLeftBounds();
        const nextState = {
          ...current,
          leftPaddle: {
            x: clamp(targetX, leftBounds.minX, leftBounds.maxX),
            y: clamp(targetY, leftBounds.minY, leftBounds.maxY),
          },
        };
        stateRef.current = nextState;
        return nextState;
      }

      if (mode === 'cpu') {
        return current;
      }

      const rightBounds = getRightBounds();
      const nextState = {
        ...current,
        rightPaddle: {
          x: clamp(targetX, rightBounds.minX, rightBounds.maxX),
          y: clamp(targetY, rightBounds.minY, rightBounds.maxY),
        },
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, [localSide, mode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    localSideRef.current = localSide;
  }, [localSide]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setConnectionLabel('Sign-in required');
      return;
    }

    let cancelled = false;
    const loadRoom = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomCode)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Room sync failed');
        }
        const payload = (await response.json()) as RoomStatePayload;
        if (cancelled) {
          return;
        }
        setRoomPlayers(payload.room.players);
        const nextSide = payload.yourSymbol === 'O' ? 'right' : 'left';
        localSideRef.current = nextSide;
        setLocalSide(nextSide);
      } catch (_error) {
        if (!cancelled) {
          setConnectionLabel('Room sync failed');
        }
      }
    };

    void loadRoom();
    const pollId = window.setInterval(loadRoom, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [mode, roomCode]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      return;
    }

    const socket = new WebSocket(
      `${getWsBaseUrl()}/ws/air-hockey?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`
    );
    wsRef.current = socket;
    setConnectionLabel('Socket connecting');

    socket.onopen = () => {
      setConnectionLabel('Socket live');
    };
    socket.onclose = () => {
      setConnectionLabel('Socket closed');
    };
    socket.onerror = () => {
      setConnectionLabel('Socket error');
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          event?: string;
          playerId?: string;
          playerName?: string;
          side?: Side;
          paddle?: PaddleState;
          state?: AirHockeyState;
        };

        if (payload.type === 'air-hockey-presence') {
          if (payload.playerId === player.playerId && payload.side) {
            localSideRef.current = payload.side;
            setLocalSide(payload.side);
          } else if (payload.event === 'joined' && payload.playerId) {
            setIsOpponentConnected(true);
            setRoomPlayers((current) => {
              if (current.some((entry) => entry.playerId === payload.playerId)) {
                return current;
              }
              return [
                ...current,
                {
                  playerId: payload.playerId || '',
                  name: payload.playerName || 'Opponent',
                  symbol: payload.side === 'left' ? 'X' : 'O',
                  wins: 0,
                  losses: 0,
                  draws: 0,
                },
              ];
            });
            if (localSideRef.current === 'left') {
              sendSocketMessage({ type: 'air-hockey-state', state: stateRef.current });
            }
          } else if (payload.event === 'left' && payload.playerId) {
            setIsOpponentConnected(false);
            setRoomPlayers((current) => current.filter((entry) => entry.playerId !== payload.playerId));
            lastFrameTimeRef.current = null;
            remotePaddleRef.current = null;
            const nextState = createInitialState();
            stateRef.current = nextState;
            setState(nextState);
          }
          return;
        }

        if (payload.type === 'air-hockey-state' && localSideRef.current === 'right' && isAirHockeyState(payload.state)) {
          setIsOpponentConnected(true);
          stateRef.current = payload.state;
          setState(payload.state);
          return;
        }

        if (payload.type === 'air-hockey-paddle' && localSideRef.current === 'left' && isPaddleState(payload.paddle)) {
          setIsOpponentConnected(true);
          const bounds = getRightBounds();
          remotePaddleRef.current = {
            x: clamp(payload.paddle.x, bounds.minX, bounds.maxX),
            y: clamp(payload.paddle.y, bounds.minY, bounds.maxY),
          };
          return;
        }

        if (payload.type === 'air-hockey-rematch') {
          lastReportedOutcomeRef.current = null;
          lastFrameTimeRef.current = null;
          remotePaddleRef.current = null;
          const nextState = createInitialState();
          stateRef.current = nextState;
          setState(nextState);
        }
      } catch (_error) {
        setConnectionLabel('Socket payload skipped');
      }
    };

    return () => {
      socket.close();
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };
  }, [mode, player.playerId, roomCode, sendSocketMessage]);

  useEffect(() => {
    if (faceoffTimerRef.current !== null) {
      window.clearTimeout(faceoffTimerRef.current);
      faceoffTimerRef.current = null;
    }

    if (
      isOnlineAuthority &&
      hasOnlineOpponent &&
      (state.phase === 'faceoff' || state.phase === 'goal') &&
      state.leftScore < MATCH_POINT &&
      state.rightScore < MATCH_POINT
    ) {
      faceoffTimerRef.current = window.setTimeout(() => {
        setState((current) => {
          if (current.phase !== 'faceoff' && current.phase !== 'goal') {
            return current;
          }
          return {
            ...current,
            phase: 'playing',
            puck: launchPuck(current.serveTo),
          };
        });
      }, FACE_OFF_DELAY_MS);
    }

    return () => {
      if (faceoffTimerRef.current !== null) {
        window.clearTimeout(faceoffTimerRef.current);
        faceoffTimerRef.current = null;
      }
    };
  }, [hasOnlineOpponent, isOnlineAuthority, state.leftScore, state.phase, state.rightScore]);

  useEffect(() => {
    const setDirection = (direction: DirectionKey, isPressed: boolean, offlineSide: Side) => {
      const controlledSide = mode === 'online' ? localSide : offlineSide;
      if (!controlledSide) {
        return;
      }
      const targetRef = controlledSide === 'left' ? leftInputRef : rightInputRef;
      targetRef.current[direction] = isPressed;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        setDirection('up', true, 'left');
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        setDirection('down', true, 'left');
      } else if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        setDirection('left', true, 'left');
      } else if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        setDirection('right', true, 'left');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setDirection('up', true, 'right');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setDirection('down', true, 'right');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setDirection('left', true, 'right');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setDirection('right', true, 'right');
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleRematch();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'W') {
        setDirection('up', false, 'left');
      } else if (event.key === 's' || event.key === 'S') {
        setDirection('down', false, 'left');
      } else if (event.key === 'a' || event.key === 'A') {
        setDirection('left', false, 'left');
      } else if (event.key === 'd' || event.key === 'D') {
        setDirection('right', false, 'left');
      } else if (event.key === 'ArrowUp') {
        setDirection('up', false, 'right');
      } else if (event.key === 'ArrowDown') {
        setDirection('down', false, 'right');
      } else if (event.key === 'ArrowLeft') {
        setDirection('left', false, 'right');
      } else if (event.key === 'ArrowRight') {
        setDirection('right', false, 'right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRematch, localSide, mode]);

  useEffect(() => {
    const step = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }

      const deltaSeconds = Math.min((now - lastFrameTimeRef.current) / 1000, 0.032);
      lastFrameTimeRef.current = now;

      setState((current) => {
        const syncOnlineState = (nextState: AirHockeyState): AirHockeyState => {
          stateRef.current = nextState;
          if (mode === 'online' && now - lastOnlineSyncRef.current >= ONLINE_SYNC_INTERVAL_MS) {
            lastOnlineSyncRef.current = now;
            if (localSide === 'left') {
              sendSocketMessage({ type: 'air-hockey-state', state: nextState });
            } else if (localSide === 'right') {
              sendSocketMessage({ type: 'air-hockey-paddle', paddle: nextState.rightPaddle });
            }
          }
          return nextState;
        };

        if (current.phase === 'won') {
          return current;
        }

        const leftBounds = getLeftBounds();
        const rightBounds = getRightBounds();
        const leftDirectionX = (leftInputRef.current.right ? 1 : 0) - (leftInputRef.current.left ? 1 : 0);
        const leftDirectionY = (leftInputRef.current.down ? 1 : 0) - (leftInputRef.current.up ? 1 : 0);
        const leftMove = normalizeVector(leftDirectionX, leftDirectionY);
        const nextLeftPaddle: PaddleState =
          mode === 'online' && localSide !== 'left'
            ? current.leftPaddle
            : {
                x: clamp(current.leftPaddle.x + leftMove.x * PADDLE_SPEED * deltaSeconds, leftBounds.minX, leftBounds.maxX),
                y: clamp(current.leftPaddle.y + leftMove.y * PADDLE_SPEED * deltaSeconds, leftBounds.minY, leftBounds.maxY),
              };

        let nextRightPaddle = current.rightPaddle;
        if (mode === 'cpu') {
          const cpuTargetX =
            current.puck.x > CENTER_LINE_X
              ? clamp(current.puck.x + 62, rightBounds.minX, rightBounds.maxX)
              : clamp(TABLE_WIDTH - 148, rightBounds.minX, rightBounds.maxX);
          const cpuTargetY =
            current.puck.x > CENTER_LINE_X
              ? clamp(current.puck.y, rightBounds.minY, rightBounds.maxY)
              : TABLE_HEIGHT / 2;
          const deltaX = cpuTargetX - current.rightPaddle.x;
          const deltaY = cpuTargetY - current.rightPaddle.y;
          const cpuDirection = normalizeVector(deltaX, deltaY);
          const cpuDistance = Math.hypot(deltaX, deltaY);
          const cpuStep = Math.min(cpuDistance, CPU_SPEED * deltaSeconds);
          nextRightPaddle = {
            x: clamp(current.rightPaddle.x + cpuDirection.x * cpuStep, rightBounds.minX, rightBounds.maxX),
            y: clamp(current.rightPaddle.y + cpuDirection.y * cpuStep, rightBounds.minY, rightBounds.maxY),
          };
        } else if (mode === 'online' && localSide === 'left') {
          nextRightPaddle = remotePaddleRef.current || current.rightPaddle;
        } else {
          const rightDirectionX = (rightInputRef.current.right ? 1 : 0) - (rightInputRef.current.left ? 1 : 0);
          const rightDirectionY = (rightInputRef.current.down ? 1 : 0) - (rightInputRef.current.up ? 1 : 0);
          const rightMove = normalizeVector(rightDirectionX, rightDirectionY);
          nextRightPaddle = {
            x: clamp(current.rightPaddle.x + rightMove.x * PADDLE_SPEED * deltaSeconds, rightBounds.minX, rightBounds.maxX),
            y: clamp(current.rightPaddle.y + rightMove.y * PADDLE_SPEED * deltaSeconds, rightBounds.minY, rightBounds.maxY),
          };
        }

        if (mode === 'online' && localSide === 'right') {
          return syncOnlineState({
            ...current,
            rightPaddle: nextRightPaddle,
          });
        }

        if (current.phase !== 'playing') {
          return syncOnlineState({
            ...current,
            leftPaddle: nextLeftPaddle,
            rightPaddle: nextRightPaddle,
          });
        }

        const leftPaddleVelocity = {
          x: nextLeftPaddle.x - current.leftPaddle.x,
          y: nextLeftPaddle.y - current.leftPaddle.y,
        };
        const rightPaddleVelocity = {
          x: nextRightPaddle.x - current.rightPaddle.x,
          y: nextRightPaddle.y - current.rightPaddle.y,
        };

        let nextPuck: PuckState = {
          ...current.puck,
          x: current.puck.x + current.puck.vx * deltaSeconds,
          y: current.puck.y + current.puck.vy * deltaSeconds,
        };

        const damping = Math.pow(0.992, deltaSeconds * 60);
        nextPuck.vx *= damping;
        nextPuck.vy *= damping;
        const clampedSpeed = clamp(Math.hypot(nextPuck.vx, nextPuck.vy), MIN_PUCK_SPEED, MAX_PUCK_SPEED);
        const speedNorm = normalizeVector(nextPuck.vx, nextPuck.vy);
        nextPuck.vx = speedNorm.x * clampedSpeed;
        nextPuck.vy = speedNorm.y * clampedSpeed;

        if (nextPuck.y - PUCK_RADIUS <= TABLE_PADDING) {
          nextPuck.y = TABLE_PADDING + PUCK_RADIUS;
          nextPuck.vy = Math.abs(nextPuck.vy);
        }
        if (nextPuck.y + PUCK_RADIUS >= TABLE_HEIGHT - TABLE_PADDING) {
          nextPuck.y = TABLE_HEIGHT - TABLE_PADDING - PUCK_RADIUS;
          nextPuck.vy = -Math.abs(nextPuck.vy);
        }

        const resolvePaddleCollision = (
          puck: PuckState,
          paddle: PaddleState,
          paddleVelocity: { x: number; y: number }
        ): PuckState => {
          const dx = puck.x - paddle.x;
          const dy = puck.y - paddle.y;
          const distance = Math.hypot(dx, dy);
          const minDistance = PUCK_RADIUS + PADDLE_RADIUS;

          if (distance <= 0 || distance >= minDistance) {
            return puck;
          }

          const normal = normalizeVector(dx, dy);
          const overlap = minDistance - distance;
          const relativeVx = puck.vx + paddleVelocity.x * PADDLE_SHOT_BOOST;
          const relativeVy = puck.vy + paddleVelocity.y * PADDLE_SHOT_BOOST;
          const dot = relativeVx * normal.x + relativeVy * normal.y;
          const reflectedVx = relativeVx - 2 * dot * normal.x;
          const reflectedVy = relativeVy - 2 * dot * normal.y;
          const speed = clamp(Math.hypot(reflectedVx, reflectedVy) * 1.02, MIN_PUCK_SPEED, MAX_PUCK_SPEED);
          const direction = normalizeVector(reflectedVx, reflectedVy);

          return {
            x: puck.x + normal.x * overlap,
            y: puck.y + normal.y * overlap,
            vx: direction.x * speed,
            vy: direction.y * speed,
          };
        };

        nextPuck = resolvePaddleCollision(nextPuck, nextLeftPaddle, leftPaddleVelocity);
        nextPuck = resolvePaddleCollision(nextPuck, nextRightPaddle, rightPaddleVelocity);

        const inGoalWindow = nextPuck.y >= GOAL_TOP && nextPuck.y <= GOAL_BOTTOM;
        if (nextPuck.x - PUCK_RADIUS <= TABLE_PADDING) {
          if (inGoalWindow) {
            const nextRightScore = current.rightScore + 1;
            const won = nextRightScore >= MATCH_POINT;
            const resetPaddles = createPaddles();
            return syncOnlineState({
              ...current,
              phase: won ? 'won' : 'goal',
              leftScore: current.leftScore,
              rightScore: nextRightScore,
              round: current.round + 1,
              ...resetPaddles,
              puck: createFaceoffPuck(),
              lastScorer: 'right',
              serveTo: 'left',
              elapsedMs: current.elapsedMs + deltaSeconds * 1000,
            });
          }
          nextPuck.x = TABLE_PADDING + PUCK_RADIUS;
          nextPuck.vx = Math.abs(nextPuck.vx);
        }

        if (nextPuck.x + PUCK_RADIUS >= TABLE_WIDTH - TABLE_PADDING) {
          if (inGoalWindow) {
            const nextLeftScore = current.leftScore + 1;
            const won = nextLeftScore >= MATCH_POINT;
            const resetPaddles = createPaddles();
            return syncOnlineState({
              ...current,
              phase: won ? 'won' : 'goal',
              leftScore: nextLeftScore,
              rightScore: current.rightScore,
              round: current.round + 1,
              ...resetPaddles,
              puck: createFaceoffPuck(),
              lastScorer: 'left',
              serveTo: 'right',
              elapsedMs: current.elapsedMs + deltaSeconds * 1000,
            });
          }
          nextPuck.x = TABLE_WIDTH - TABLE_PADDING - PUCK_RADIUS;
          nextPuck.vx = -Math.abs(nextPuck.vx);
        }

        return syncOnlineState({
          ...current,
          leftPaddle: nextLeftPaddle,
          rightPaddle: nextRightPaddle,
          puck: nextPuck,
          elapsedMs: current.elapsedMs + deltaSeconds * 1000,
        });
      });

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [localSide, mode, sendSocketMessage]);

  useEffect(() => {
    if (state.phase !== 'won') {
      return;
    }
    const winningSide: Side = state.leftScore > state.rightScore ? 'left' : 'right';
    const outcome = mode === 'online'
      ? winningSide === localSide
        ? 'win'
        : 'loss'
      : winningSide === 'left'
        ? 'win'
        : 'loss';
    if (lastReportedOutcomeRef.current === outcome) {
      return;
    }

    lastReportedOutcomeRef.current = outcome;
    onMatchComplete({
      mode,
      gameType: 'air-hockey',
      outcome,
      opponent: mode === 'online'
        ? localSide === 'left'
          ? rightPlayerName
          : leftPlayerName
        : mode === 'cpu'
          ? 'Arena CPU'
          : 'Local Opponent',
    });
  }, [leftPlayerName, localSide, mode, onMatchComplete, rightPlayerName, state.leftScore, state.phase, state.rightScore]);

  const controllerSections = useMemo<ControllerSection[]>(() => {
    const leftButtons = [
      {
        key: 'left-up',
        label: 'Up',
        icon: <AiOutlineArrowUp />,
        slot: 'up' as const,
        onPointerDown: () => handleSetInput('left', 'up', true),
        onPointerUp: () => handleSetInput('left', 'up', false),
      },
      {
        key: 'left-left',
        label: 'Left',
        icon: <AiOutlineArrowLeft />,
        slot: 'left' as const,
        onPointerDown: () => handleSetInput('left', 'left', true),
        onPointerUp: () => handleSetInput('left', 'left', false),
      },
      {
        key: 'left-down',
        label: 'Down',
        icon: <AiOutlineArrowDown />,
        slot: 'down' as const,
        onPointerDown: () => handleSetInput('left', 'down', true),
        onPointerUp: () => handleSetInput('left', 'down', false),
      },
      {
        key: 'left-right',
        label: 'Right',
        icon: <AiOutlineArrowRight />,
        slot: 'right' as const,
        onPointerDown: () => handleSetInput('left', 'right', true),
        onPointerUp: () => handleSetInput('left', 'right', false),
      },
    ];

    const sections: ControllerSection[] = [
      {
        key: 'left-paddle',
        title: `${player.name} Paddle`,
        subtitle: mode === 'online' ? `${localSide === 'right' ? 'Right' : 'Left'} side | WASD or arrows` : 'WASD',
        layout: 'dpad' as const,
        buttons: leftButtons,
      },
    ];

    if (mode === 'offline') {
      sections.push({
        key: 'right-paddle',
        title: 'Right Paddle',
        subtitle: 'Arrow keys',
        layout: 'dpad' as const,
        buttons: [
          {
            key: 'right-up',
            label: 'Up',
            icon: <AiOutlineArrowUp />,
            slot: 'up' as const,
            onPointerDown: () => handleSetInput('right', 'up', true),
            onPointerUp: () => handleSetInput('right', 'up', false),
          },
          {
            key: 'right-left',
            label: 'Left',
            icon: <AiOutlineArrowLeft />,
            slot: 'left' as const,
            onPointerDown: () => handleSetInput('right', 'left', true),
            onPointerUp: () => handleSetInput('right', 'left', false),
          },
          {
            key: 'right-down',
            label: 'Down',
            icon: <AiOutlineArrowDown />,
            slot: 'down' as const,
            onPointerDown: () => handleSetInput('right', 'down', true),
            onPointerUp: () => handleSetInput('right', 'down', false),
          },
          {
            key: 'right-right',
            label: 'Right',
            icon: <AiOutlineArrowRight />,
            slot: 'right' as const,
            onPointerDown: () => handleSetInput('right', 'right', true),
            onPointerUp: () => handleSetInput('right', 'right', false),
          },
        ],
      });
    }

    sections.push({
      key: 'match-actions',
      title: 'Match Actions',
      layout: 'row' as const,
      buttons: [
        {
          key: 'rematch',
          label: 'Rematch',
          icon: <AiOutlineReload />,
          onClick: handleRematch,
        },
      ],
    });

    return sections;
  }, [handleRematch, handleSetInput, localSide, mode, player.name]);

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        sections={controllerSections}
        title={getModeLabel(mode)}
        subtitle={getModeSubtitle(mode)}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [4, -4, 4] } : undefined}
        transition={enableAnimations ? { duration: 4.2, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand match info"
              title="Expand match info"
            >
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor">
                  <AiOutlineDrag /> drag
                </span>
                <span className="room-float-title">
                  <AiOutlineInfoCircle className="room-float-title-icon" />{' '}
                  {mode === 'online' ? `Room ${roomCode}` : `${gameLabel} ${getModeLabel(mode)}`}
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse match info"
                  title="Collapse match info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line">
                  {state.phase === 'playing' ? <AiOutlineThunderbolt /> : state.phase === 'won' ? <AiOutlineCheckCircle /> : <AiOutlineClockCircle />}{' '}
                  {statusLabel}
                </span>
              </div>

              <div className="room-joined">
                <p className="room-joined-title">
                  {mode === 'cpu' ? <AiOutlineRobot /> : <AiOutlineTeam />} Players
                </p>
                <p className="room-joined-line">
                  <AiOutlineUser /> {leftPlayerName} | Left Paddle
                </p>
                <p className="room-joined-line">
                  {mode === 'cpu' ? <AiOutlineRobot /> : <AiOutlineUser />}{' '}
                  {rightPlayerName} | Right Paddle
                </p>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Round</span>
                  <strong>{state.round}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Score</span>
                  <strong>{state.leftScore} : {state.rightScore}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Phase</span>
                  <strong>{state.phase === 'won' ? 'Finished' : state.phase === 'goal' ? 'Resetting' : state.phase === 'faceoff' ? 'Faceoff' : 'Live'}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{(state.elapsedMs / 1000).toFixed(1)}s</strong>
                </div>
                {mode === 'online' ? (
                  <div className="solo-float-stat">
                    <span>Link</span>
                    <strong>{connectionLabel}</strong>
                  </div>
                ) : null}
              </div>

              <div className="room-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handleRematch}>
                  <AiOutlineReload /> Rematch
                </button>
                <button className="room-float-action-btn" type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="room-float-action-btn room-float-action-btn-danger" type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="air-hockey-shell">
        <div className="air-hockey-scoreboard">
          <div className="air-hockey-score-team air-hockey-score-team-left">
            <span>{leftPlayerName}</span>
            <strong>{state.leftScore}</strong>
          </div>
          <div className="air-hockey-score-center">
            <span>{state.phase === 'faceoff' ? 'Faceoff' : state.phase === 'goal' ? 'Reset' : state.phase === 'won' ? 'Final' : 'Live'}</span>
            <strong>{gameLabel}</strong>
          </div>
          <div className="air-hockey-score-team air-hockey-score-team-right">
            <span>{rightPlayerName}</span>
            <strong>{state.rightScore}</strong>
          </div>
        </div>

        <div
          className="air-hockey-stage-wrap"
          onPointerDown={handleStagePointerMove}
          onPointerMove={handleStagePointerMove}
          role="presentation"
        >
          <div className="air-hockey-stage">
            <div className="air-hockey-center-line" />
            <div className="air-hockey-center-circle" />
            <div className="air-hockey-goal air-hockey-goal-left" />
            <div className="air-hockey-goal air-hockey-goal-right" />
            <div className="air-hockey-faceoff-dot air-hockey-faceoff-dot-top" />
            <div className="air-hockey-faceoff-dot air-hockey-faceoff-dot-bottom" />

            <div
              className="air-hockey-paddle air-hockey-paddle-left"
              style={{
                left: state.leftPaddle.x - PADDLE_RADIUS,
                top: state.leftPaddle.y - PADDLE_RADIUS,
                width: PADDLE_RADIUS * 2,
                height: PADDLE_RADIUS * 2,
              }}
            />

            <div
              className={classnames(
                'air-hockey-paddle',
                'air-hockey-paddle-right',
                mode === 'cpu' && 'air-hockey-paddle-cpu'
              )}
              style={{
                left: state.rightPaddle.x - PADDLE_RADIUS,
                top: state.rightPaddle.y - PADDLE_RADIUS,
                width: PADDLE_RADIUS * 2,
                height: PADDLE_RADIUS * 2,
              }}
            />

            <div
              className="air-hockey-puck"
              style={{
                left: state.puck.x - PUCK_RADIUS,
                top: state.puck.y - PUCK_RADIUS,
                width: PUCK_RADIUS * 2,
                height: PUCK_RADIUS * 2,
              }}
            />
          </div>

          {state.phase !== 'playing' ? (
            <div className="air-hockey-overlay">
              <div className="air-hockey-message">
                <span
                  className={classnames(
                    'air-hockey-status-pill',
                    state.phase === 'won' ? 'air-hockey-status-pill-win' : 'air-hockey-status-pill-ready'
                  )}
                >
                  {state.phase === 'won' ? 'Match Complete' : state.phase === 'goal' ? 'Goal Scored' : 'Faceoff'}
                </span>
                <h2>
                  {state.phase === 'won'
                    ? state.leftScore > state.rightScore
                      ? `${leftPlayerName} takes it`
                      : `${rightPlayerName} takes it`
                    : state.phase === 'goal'
                      ? 'Resetting the puck'
                      : mode === 'online' && !hasOnlineOpponent
                        ? 'Waiting for a rival'
                        : 'Stick ready'}
                </h2>
                <p>
                  {state.phase === 'won'
                    ? `Final score ${state.leftScore} to ${state.rightScore}.`
                    : state.phase === 'goal'
                      ? 'Next faceoff is loading at center ice.'
                      : mode === 'online'
                        ? hasOnlineOpponent
                          ? `You control the ${localSide === 'right' ? 'right' : 'left'} paddle with WASD, arrows, or pointer movement.`
                          : `Share room code ${roomCode} to start the match.`
                      : mode === 'cpu'
                        ? 'Move with WASD. The AI will meet you on the far half after the whistle.'
                        : 'Left side uses WASD and right side uses arrow keys once the puck drops.'}
                </p>
                {state.phase === 'won' ? (
                  <button className="air-hockey-rematch-btn" type="button" onClick={handleRematch}>
                    <AiOutlineReload /> Rematch
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <p className="air-hockey-message-inline">
          Keep your paddle inside your half, bank the puck off the rails, and race to {MATCH_POINT}.{' '}
          {mode === 'online' ? 'Your room stays synchronized over the Air Hockey socket.' : 'Pointer dragging works on either half of the table too.'}
        </p>
      </section>
    </>
  );
}
