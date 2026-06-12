'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
  AiOutlineThunderbolt,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile, RoomStatePayload } from '@/types/game';

type DirectionKey = 'left' | 'right' | 'accelerate' | 'brake' | 'boost';
type RaceStatus = 'playing' | 'finished';

type RacerInput = Record<DirectionKey, boolean>;

type Racer = {
  id: string;
  name: string;
  color: string;
  x: number;
  speed: number;
  distance: number;
  boost: number;
  health: number;
  finished: boolean;
  finishMs: number | null;
  isLocal: boolean;
  isCpu: boolean;
  hitCooldownMs: number;
};

type TrackObject = {
  id: string;
  x: number;
  distance: number;
};

type RaceState = {
  status: RaceStatus;
  elapsedMs: number;
  racers: Racer[];
  winnerId: string | null;
  lastEvent: string;
};

type RacingArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  roomCode?: string | null;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
  offlineParticipantNames?: string[];
  offlineParticipantCount?: number;
};

const STAGE_WIDTH = 920;
const STAGE_HEIGHT = 560;
const ROAD_MIN_X = 126;
const ROAD_MAX_X = STAGE_WIDTH - 126;
const FINISH_DISTANCE = 5200;
const VIEW_DISTANCE = 980;
const MAX_SPEED = 640;
const ACCELERATION = 390;
const BRAKE_FORCE = 520;
const FRICTION = 75;
const STEER_FORCE = 370;
const BOOST_BURN = 30;
const BOOST_GAIN = 34;
const IMPACT_COOLDOWN_MS = 720;
const RACER_COLORS = ['#22d3ee', '#fb7185', '#facc15', '#a78bfa'];

const createInput = (): RacerInput => ({
  left: false,
  right: false,
  accelerate: false,
  brake: false,
  boost: false,
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const createHazards = (): TrackObject[] =>
  Array.from({ length: 22 }, (_, index) => ({
    id: `traffic-${index}`,
    x: ROAD_MIN_X + 70 + ((index * 173) % Math.max(1, ROAD_MAX_X - ROAD_MIN_X - 140)),
    distance: 420 + index * 245 + (index % 3) * 86,
  }));

const createBoostPads = (): TrackObject[] =>
  Array.from({ length: 15 }, (_, index) => ({
    id: `boost-${index}`,
    x: ROAD_MIN_X + 54 + ((index * 229) % Math.max(1, ROAD_MAX_X - ROAD_MIN_X - 108)),
    distance: 360 + index * 330 + (index % 2) * 120,
  }));

const HAZARDS = createHazards();
const BOOST_PADS = createBoostPads();

const createRacer = (
  id: string,
  name: string,
  index: number,
  isLocal = false,
  isCpu = false
): Racer => ({
  id,
  name,
  color: RACER_COLORS[index % RACER_COLORS.length],
  x: ROAD_MIN_X + 118 + index * 142,
  speed: 0,
  distance: Math.max(0, index * -30),
  boost: isLocal ? 42 : 34,
  health: 100,
  finished: false,
  finishMs: null,
  isLocal,
  isCpu,
  hitCooldownMs: 0,
});

const createRaceState = (racers: Racer[]): RaceState => ({
  status: 'playing',
  elapsedMs: 0,
  racers,
  winnerId: null,
  lastEvent: 'Green light. Hunt the boost line.',
});

const createModeRacers = (
  mode: GameMode,
  player: PlayerProfile,
  offlineParticipantNames: string[] = [],
  offlineParticipantCount = 2
): Racer[] => {
  if (mode === 'offline') {
    const count = Math.max(2, Math.min(4, offlineParticipantCount));
    return Array.from({ length: count }, (_, index) =>
      createRacer(
        index === 0 ? player.playerId : `offline-${index}`,
        offlineParticipantNames[index] || (index === 0 ? player.name : `Player ${index + 1}`),
        index,
        index === 0,
        index > 0
      )
    );
  }

  if (mode === 'cpu') {
    return [
      createRacer(player.playerId, player.name, 0, true),
      createRacer('cpu-1', 'Circuit Rival', 1, false, true),
      createRacer('cpu-2', 'Apex Ghost', 2, false, true),
      createRacer('cpu-3', 'Boost Phantom', 3, false, true),
    ];
  }

  return [createRacer(player.playerId, player.name, 0, true)];
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

const getTrackY = (objectDistance: number, localDistance: number): number => {
  const relative = objectDistance - localDistance;
  return STAGE_HEIGHT - (relative / VIEW_DISTANCE) * STAGE_HEIGHT;
};

const getRacerRank = (racers: Racer[], racerId: string): number => {
  const sorted = [...racers].sort((a, b) => b.distance - a.distance || (a.finishMs || Infinity) - (b.finishMs || Infinity));
  return sorted.findIndex((racer) => racer.id === racerId) + 1;
};

const getCpuInput = (racer: Racer, localDistance: number): RacerInput => {
  const input = createInput();
  input.accelerate = true;
  input.boost = racer.boost > 18 && racer.speed > 360;

  const nearbyHazard = HAZARDS.find(
    (hazard) =>
      hazard.distance > racer.distance + 60 &&
      hazard.distance < racer.distance + 260 &&
      Math.abs(hazard.x - racer.x) < 78
  );
  const targetX = nearbyHazard
    ? nearbyHazard.x < (ROAD_MIN_X + ROAD_MAX_X) / 2
      ? nearbyHazard.x + 128
      : nearbyHazard.x - 128
    : ROAD_MIN_X + 110 + ((racer.id.charCodeAt(racer.id.length - 1) * 53 + localDistance * 0.03) % (ROAD_MAX_X - ROAD_MIN_X - 220));

  input.left = racer.x > targetX + 18;
  input.right = racer.x < targetX - 18;
  return input;
};

const advanceRacer = (
  racer: Racer,
  input: RacerInput,
  deltaSeconds: number,
  elapsedMs: number
): { racer: Racer; event: string | null } => {
  if (racer.finished) {
    return { racer, event: null };
  }

  let speed = racer.speed;
  let boost = racer.boost;
  let health = racer.health;
  let hitCooldownMs = Math.max(0, racer.hitCooldownMs - deltaSeconds * 1000);
  let event: string | null = null;

  if (input.accelerate) {
    speed += ACCELERATION * deltaSeconds;
  }
  if (input.brake) {
    speed -= BRAKE_FORCE * deltaSeconds;
  }
  if (input.boost && boost > 0 && speed > 90) {
    speed += 360 * deltaSeconds;
    boost = Math.max(0, boost - BOOST_BURN * deltaSeconds);
  }

  speed = Math.max(0, speed - FRICTION * deltaSeconds);
  if (health <= 0) {
    speed = Math.min(speed, 120);
  }
  speed = clamp(speed, 0, MAX_SPEED + (input.boost && boost > 0 ? 145 : 0));

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = 0.55 + Math.min(0.45, speed / MAX_SPEED);
  const x = clamp(racer.x + steer * STEER_FORCE * grip * deltaSeconds, ROAD_MIN_X + 26, ROAD_MAX_X - 26);
  const distance = racer.distance + speed * deltaSeconds;

  for (const pad of BOOST_PADS) {
    if (Math.abs(pad.distance - distance) < 24 && Math.abs(pad.x - x) < 58) {
      boost = Math.min(100, boost + BOOST_GAIN * deltaSeconds * 9);
      speed = Math.min(MAX_SPEED + 120, speed + 130 * deltaSeconds);
    }
  }

  if (hitCooldownMs <= 0) {
    const impact = HAZARDS.find(
      (hazard) => Math.abs(hazard.distance - distance) < 28 && Math.abs(hazard.x - x) < 46
    );
    if (impact) {
      speed = Math.max(70, speed * 0.48);
      health = Math.max(0, health - 18);
      hitCooldownMs = IMPACT_COOLDOWN_MS;
      event = `${racer.name} clipped traffic and lost momentum.`;
    }
  }

  const finished = distance >= FINISH_DISTANCE;
  return {
    racer: {
      ...racer,
      x,
      speed,
      distance: Math.min(distance, FINISH_DISTANCE),
      boost,
      health,
      finished,
      finishMs: finished ? racer.finishMs ?? elapsedMs : null,
      hitCooldownMs,
    },
    event,
  };
};

export function RacingArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
  offlineParticipantNames = [],
  offlineParticipantCount = 2,
}: RacingArenaGameProps) {
  const gameLabel = formatGameName('turbo-rush', gameDefinitions);
  const [race, setRace] = useState<RaceState>(() =>
    createRaceState(createModeRacers(mode, player, offlineParticipantNames, offlineParticipantCount))
  );
  const [connectionLabel, setConnectionLabel] = useState(mode === 'online' ? 'Socket idle' : 'Local engine');
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const inputRef = useRef<RacerInput>(createInput());
  const remoteInputsRef = useRef<Record<string, RacerInput>>({});
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const lastSentInputRef = useRef('');

  const localRacer = race.racers.find((racer) => racer.isLocal) || race.racers[0];
  const rank = localRacer ? getRacerRank(race.racers, localRacer.id) : 1;
  const progress = localRacer ? Math.min(100, (localRacer.distance / FINISH_DISTANCE) * 100) : 0;
  const visibleHazards = localRacer
    ? HAZARDS.filter((hazard) => {
        const y = getTrackY(hazard.distance, localRacer.distance);
        return y > -70 && y < STAGE_HEIGHT + 80;
      })
    : [];
  const visibleBoostPads = localRacer
    ? BOOST_PADS.filter((pad) => {
        const y = getTrackY(pad.distance, localRacer.distance);
        return y > -70 && y < STAGE_HEIGHT + 80;
      })
    : [];

  const resetRace = useCallback(() => {
    lastFrameRef.current = null;
    lastReportedOutcomeRef.current = null;
    remoteInputsRef.current = {};
    inputRef.current = createInput();
    setRace(createRaceState(createModeRacers(mode, player, offlineParticipantNames, offlineParticipantCount)));
  }, [mode, offlineParticipantCount, offlineParticipantNames, player]);

  const sendSocketMessage = useCallback((message: Record<string, unknown>) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const publishInput = useCallback(() => {
    if (mode !== 'online') {
      return;
    }
    const payload = {
      type: 'racing-input',
      playerId: player.playerId,
      playerName: player.name,
      input: inputRef.current,
      car: localRacer
        ? {
            x: localRacer.x,
            speed: localRacer.speed,
            distance: localRacer.distance,
            boost: localRacer.boost,
            health: localRacer.health,
          }
        : null,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSentInputRef.current) {
      return;
    }
    lastSentInputRef.current = serialized;
    sendSocketMessage(payload);
  }, [localRacer, mode, player.name, player.playerId, sendSocketMessage]);

  const setHeldInput = useCallback(
    (key: DirectionKey, active: boolean) => {
      inputRef.current[key] = active;
      publishInput();
    },
    [publishInput]
  );

  const tapInput = useCallback(
    (key: DirectionKey) => {
      setHeldInput(key, true);
      window.setTimeout(() => setHeldInput(key, false), key === 'boost' ? 260 : 140);
    },
    [setHeldInput]
  );

  useEffect(() => {
    setRace(createRaceState(createModeRacers(mode, player, offlineParticipantNames, offlineParticipantCount)));
    setConnectionLabel(mode === 'online' ? 'Socket idle' : 'Local engine');
  }, [mode, offlineParticipantCount, offlineParticipantNames, player]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setConnectionLabel('Socket needs sign-in');
      return;
    }

    let cancelled = false;
    const loadRoomPlayers = async () => {
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
        const players = payload.room.players.length ? payload.room.players : [{ playerId: player.playerId, name: player.name }];
        setRace(createRaceState(players.map((entry, index) => createRacer(entry.playerId, entry.name, index, entry.playerId === player.playerId))));
      } catch (_error) {
        if (!cancelled) {
          setConnectionLabel('Socket only');
        }
      }
    };

    void loadRoomPlayers();

    return () => {
      cancelled = true;
    };
  }, [mode, player.name, player.playerId, roomCode]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      return;
    }

    const wsUrl = `${getWsBaseUrl()}/ws/racing?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    setConnectionLabel('Socket connecting');

    socket.onopen = () => {
      setConnectionLabel('Socket live');
      publishInput();
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
          playerId?: string;
          playerName?: string;
          input?: RacerInput;
          car?: Partial<Racer>;
          winnerId?: string;
          winnerName?: string;
        };

        if (!payload.playerId || payload.playerId === player.playerId) {
          return;
        }

        if (payload.type === 'racing-input' && payload.input) {
          remoteInputsRef.current[payload.playerId] = payload.input;
          setRace((current) => {
            const existing = current.racers.find((racer) => racer.id === payload.playerId);
            if (existing) {
              return current;
            }
            return {
              ...current,
              racers: [
                ...current.racers,
                createRacer(payload.playerId || `remote-${current.racers.length}`, payload.playerName || 'Remote Racer', current.racers.length),
              ],
            };
          });
        }

        if (payload.type === 'racing-finish' && payload.winnerId) {
          setRace((current) => ({
            ...current,
            status: 'finished',
            winnerId: payload.winnerId || null,
            lastEvent: `${payload.winnerName || 'A rival'} crossed the line first.`,
          }));
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
  }, [mode, player.playerId, publishInput, roomCode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        setHeldInput('left', true);
      } else if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        setHeldInput('right', true);
      } else if (event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault();
        setHeldInput('accelerate', true);
      } else if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault();
        setHeldInput('brake', true);
      } else if (event.code === 'Space' || key === 'shift') {
        event.preventDefault();
        setHeldInput('boost', true);
      } else if (key === 'r') {
        event.preventDefault();
        resetRace();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || key === 'a') {
        setHeldInput('left', false);
      } else if (event.key === 'ArrowRight' || key === 'd') {
        setHeldInput('right', false);
      } else if (event.key === 'ArrowUp' || key === 'w') {
        setHeldInput('accelerate', false);
      } else if (event.key === 'ArrowDown' || key === 's') {
        setHeldInput('brake', false);
      } else if (event.code === 'Space' || key === 'shift') {
        setHeldInput('boost', false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [resetRace, setHeldInput]);

  useEffect(() => {
    const step = (now: number) => {
      setRace((current) => {
        if (current.status === 'finished') {
          return current;
        }

        if (lastFrameRef.current === null) {
          lastFrameRef.current = now;
          return current;
        }

        const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.034);
        lastFrameRef.current = now;
        let lastEvent = current.lastEvent;
        const localDistance = current.racers.find((racer) => racer.isLocal)?.distance || 0;
        const elapsedMs = current.elapsedMs + deltaSeconds * 1000;
        const racers = current.racers.map((racer) => {
          const input = racer.isLocal
            ? inputRef.current
            : racer.isCpu
              ? getCpuInput(racer, localDistance)
              : remoteInputsRef.current[racer.id] || createInput();
          const result = advanceRacer(racer, input, deltaSeconds, elapsedMs);
          if (result.event) {
            lastEvent = result.event;
          }
          return result.racer;
        });

        const winner = racers
          .filter((racer) => racer.finished)
          .sort((a, b) => (a.finishMs || Infinity) - (b.finishMs || Infinity))[0];

        if (winner) {
          if (mode === 'online' && winner.isLocal) {
            sendSocketMessage({
              type: 'racing-finish',
              playerId: player.playerId,
              playerName: player.name,
              winnerId: winner.id,
              winnerName: winner.name,
            });
          }
          return {
            status: 'finished',
            elapsedMs,
            racers,
            winnerId: winner.id,
            lastEvent: `${winner.name} takes the checkered line.`,
          };
        }

        return {
          ...current,
          elapsedMs,
          racers,
          lastEvent,
        };
      });

      publishInput();
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mode, player.name, player.playerId, publishInput, sendSocketMessage]);

  useEffect(() => {
    if (race.status !== 'finished' || !race.winnerId || !localRacer) {
      return;
    }

    const outcome = race.winnerId === localRacer.id ? 'win' : 'loss';
    if (lastReportedOutcomeRef.current === outcome) {
      return;
    }
    lastReportedOutcomeRef.current = outcome;
    onMatchComplete({
      mode,
      gameType: 'turbo-rush',
      outcome,
      opponent: race.racers.find((racer) => racer.id !== localRacer.id)?.name || 'Turbo Rush field',
    });
  }, [localRacer, mode, onMatchComplete, race.racers, race.status, race.winnerId]);

  const controllerSections = [
    {
      key: 'steering',
      title: 'Steering',
      layout: 'dpad' as const,
      buttons: [
        {
          key: 'accelerate',
          label: 'Gas',
          icon: <AiOutlineArrowUp />,
          slot: 'up' as const,
          onClick: () => tapInput('accelerate'),
          onPointerDown: () => setHeldInput('accelerate', true),
          onPointerUp: () => setHeldInput('accelerate', false),
        },
        {
          key: 'left',
          label: 'Left',
          icon: <AiOutlineArrowLeft />,
          slot: 'left' as const,
          onClick: () => tapInput('left'),
          onPointerDown: () => setHeldInput('left', true),
          onPointerUp: () => setHeldInput('left', false),
        },
        {
          key: 'brake',
          label: 'Brake',
          icon: <AiOutlineArrowDown />,
          slot: 'down' as const,
          onClick: () => tapInput('brake'),
          onPointerDown: () => setHeldInput('brake', true),
          onPointerUp: () => setHeldInput('brake', false),
        },
        {
          key: 'right',
          label: 'Right',
          icon: <AiOutlineArrowRight />,
          slot: 'right' as const,
          onClick: () => tapInput('right'),
          onPointerDown: () => setHeldInput('right', true),
          onPointerUp: () => setHeldInput('right', false),
        },
      ],
    },
    {
      key: 'race-actions',
      title: 'Turbo',
      layout: 'row' as const,
      buttons: [
        {
          key: 'boost',
          label: 'Boost',
          icon: <AiOutlineRocket />,
          onClick: () => tapInput('boost'),
          onPointerDown: () => setHeldInput('boost', true),
          onPointerUp: () => setHeldInput('boost', false),
          disabled: Boolean(localRacer && localRacer.boost <= 1),
        },
        {
          key: 'restart',
          label: 'Restart',
          icon: <AiOutlineReload />,
          onClick: resetRace,
        },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title={gameLabel}
        subtitle="WASD or arrows to drive, Space for boost"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand race info"
              title="Expand race info"
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
                  <AiOutlineInfoCircle className="room-float-title-icon" /> {mode === 'online' ? `Room ${roomCode}` : 'Race Control'}
                </span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse race info"
                  title="Collapse race info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Driver</span>
                  <strong>{player.name}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Rank</span>
                  <strong>
                    {rank}/{race.racers.length}
                  </strong>
                </div>
                <div className="solo-float-stat">
                  <span>Speed</span>
                  <strong>{Math.round(localRacer?.speed || 0)}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Boost</span>
                  <strong>{Math.round(localRacer?.boost || 0)}%</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Health</span>
                  <strong>{Math.round(localRacer?.health || 0)}%</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Link</span>
                  <strong>{connectionLabel}</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={resetRace}>
                  <AiOutlineReload /> Restart
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

      <section className="racing-shell">
        <div className="racing-hud">
          <div className="racing-hud-card">
            <span>Progress</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="racing-hud-card">
            <span>Rank</span>
            <strong>
              {rank}/{race.racers.length}
            </strong>
          </div>
          <div className="racing-hud-card">
            <span>Speed</span>
            <strong>{Math.round(localRacer?.speed || 0)}</strong>
          </div>
          <div className="racing-hud-card">
            <span>Boost</span>
            <strong>{Math.round(localRacer?.boost || 0)}%</strong>
          </div>
        </div>

        <div className="racing-stage-wrap">
          <div className="racing-stage" aria-label="Turbo Rush race track">
            <div className="racing-city racing-city-left" aria-hidden="true" />
            <div className="racing-city racing-city-right" aria-hidden="true" />
            <div className="racing-road" aria-hidden="true">
              <span className="racing-road-line racing-road-line-a" />
              <span className="racing-road-line racing-road-line-b" />
              <span className="racing-road-line racing-road-line-c" />
            </div>
            <div className="racing-progress-rail" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>

            {visibleBoostPads.map((pad) => (
              <div
                key={pad.id}
                className="racing-boost-pad"
                style={{
                  left: `${(pad.x / STAGE_WIDTH) * 100}%`,
                  top: `${getTrackY(pad.distance, localRacer?.distance || 0)}px`,
                }}
              >
                <AiOutlineThunderbolt />
              </div>
            ))}

            {visibleHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="racing-traffic"
                style={{
                  left: `${(hazard.x / STAGE_WIDTH) * 100}%`,
                  top: `${getTrackY(hazard.distance, localRacer?.distance || 0)}px`,
                }}
              >
                <span />
              </div>
            ))}

            {race.racers.map((racer) => {
              const relativeY =
                racer.isLocal || !localRacer
                  ? STAGE_HEIGHT - 92
                  : clamp(STAGE_HEIGHT - 92 - (racer.distance - localRacer.distance) * 0.34, 58, STAGE_HEIGHT - 54);
              const isLeader = race.racers.every((other) => racer.distance >= other.distance);

              return (
                <div
                  key={racer.id}
                  className={classnames(
                    'racing-car',
                    racer.isLocal && 'racing-car-local',
                    racer.hitCooldownMs > 0 && 'racing-car-hit',
                    isLeader && 'racing-car-leader'
                  )}
                  style={{
                    left: `${(racer.x / STAGE_WIDTH) * 100}%`,
                    top: `${relativeY}px`,
                    '--racing-car-color': racer.color,
                  } as React.CSSProperties}
                >
                  <span className="racing-car-name">{racer.name}</span>
                  <span className="racing-car-body">
                    <span className="racing-car-glass" />
                    <span className="racing-car-light racing-car-light-left" />
                    <span className="racing-car-light racing-car-light-right" />
                  </span>
                  {racer.boost > 2 && racer.speed > 360 ? <span className="racing-car-flame" /> : null}
                </div>
              );
            })}

            <div className="racing-stage-badges">
              <span>{race.lastEvent}</span>
              <span>{mode === 'online' ? connectionLabel : mode === 'cpu' ? 'CPU Field' : 'Local Field'}</span>
            </div>

            {race.status === 'finished' ? (
              <div className="racing-overlay">
                <div className="racing-message">
                  <span className={classnames('racing-status-pill', race.winnerId === localRacer?.id && 'racing-status-pill-win')}>
                    {race.winnerId === localRacer?.id ? 'Victory' : 'Race Over'}
                  </span>
                  <h2>{race.racers.find((racer) => racer.id === race.winnerId)?.name || 'A racer'} wins Turbo Rush</h2>
                  <p>{race.lastEvent}</p>
                  <div className="racing-message-actions">
                    <button className="racing-action-btn" type="button" onClick={resetRace}>
                      <AiOutlineReload /> Run It Back
                    </button>
                    <button className="racing-action-btn racing-action-btn-ghost" type="button" onClick={onLeave}>
                      Leave Arena
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="racing-inline-hint">
          Hit boost pads to refill turbo, dodge traffic, and keep the nose clean. Online rooms share live driver input over the racing socket.
        </p>
      </section>
    </>
  );
}
