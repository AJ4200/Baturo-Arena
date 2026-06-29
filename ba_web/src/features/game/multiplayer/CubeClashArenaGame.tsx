'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile } from '@/types/game';

type CubeInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean;
};

type CubePlayer = {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  score: number;
  dashCooldownMs: number;
  connected: boolean;
  isLocal?: boolean;
  isCpu?: boolean;
};

type CubeSnapshot = {
  phase: 'waiting' | 'playing' | 'finished';
  round: number;
  elapsedMs: number;
  targetScore: number;
  roundTimeMs: number;
  winnerId: string | null;
  winnerName: string | null;
  event: string;
  core: { x: number; z: number };
  players: CubePlayer[];
};

type CubeClashArenaGameProps = {
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

const TARGET_SCORE = 8;
const ROUND_TIME_MS = 90000;
const ARENA_LIMIT = 6.4;
const PLAYER_RADIUS = 0.62;
const CORE_RADIUS = 0.72;
const ACCELERATION = 18;
const FRICTION = 7.2;
const MAX_SPEED = 6.2;
const DASH_SPEED = 7.2;
const DASH_COOLDOWN_MS = 1100;
const PLAYER_COLORS = ['#22d3ee', '#fb7185'];

const createInput = (): CubeInput => ({
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

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

const createCore = (): { x: number; z: number } => ({
  x: Math.round((Math.random() * 9.6 - 4.8) * 100) / 100,
  z: Math.round((Math.random() * 9.6 - 4.8) * 100) / 100,
});

const createCubePlayer = (
  id: string,
  name: string,
  index: number,
  isLocal = false,
  isCpu = false
): CubePlayer => ({
  id,
  name,
  color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  x: index === 0 ? -4.2 : 4.2,
  z: 0,
  vx: 0,
  vz: 0,
  score: 0,
  dashCooldownMs: 0,
  connected: true,
  isLocal,
  isCpu,
});

const createLocalSnapshot = (
  mode: GameMode,
  player: PlayerProfile,
  offlineParticipantNames: string[] = []
): CubeSnapshot => {
  const p1Name = offlineParticipantNames[0]?.trim() || player.name;
  const p2Name =
    mode === 'cpu'
      ? 'Vector Rival'
      : offlineParticipantNames[1]?.trim() || 'Player 2';

  return {
    phase: 'playing',
    round: 1,
    elapsedMs: 0,
    targetScore: TARGET_SCORE,
    roundTimeMs: ROUND_TIME_MS,
    winnerId: null,
    winnerName: null,
    event: 'Round live',
    core: createCore(),
    players: [
      createCubePlayer(player.playerId, p1Name, 0, true),
      createCubePlayer(mode === 'cpu' ? 'cpu-cube' : 'offline-p2', p2Name, 1, mode !== 'cpu' ? true : false, mode === 'cpu'),
    ],
  };
};

const createOnlinePlaceholder = (player: PlayerProfile): CubeSnapshot => ({
  phase: 'waiting',
  round: 1,
  elapsedMs: 0,
  targetScore: TARGET_SCORE,
  roundTimeMs: ROUND_TIME_MS,
  winnerId: null,
  winnerName: null,
  event: 'Connecting to arena',
  core: { x: 0, z: 0 },
  players: [createCubePlayer(player.playerId, player.name, 0, true)],
});

const advancePlayer = (player: CubePlayer, input: CubeInput, deltaSeconds: number, deltaMs: number): CubePlayer => {
  let axisX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let axisZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const axisLength = Math.hypot(axisX, axisZ);
  if (axisLength > 0) {
    axisX /= axisLength;
    axisZ /= axisLength;
  }

  let vx = player.vx + axisX * ACCELERATION * deltaSeconds;
  let vz = player.vz + axisZ * ACCELERATION * deltaSeconds;
  let dashCooldownMs = Math.max(0, player.dashCooldownMs - deltaMs);

  if (input.dash && dashCooldownMs <= 0 && axisLength > 0) {
    vx += axisX * DASH_SPEED;
    vz += axisZ * DASH_SPEED;
    dashCooldownMs = DASH_COOLDOWN_MS;
  }

  const friction = Math.max(0, 1 - FRICTION * deltaSeconds);
  vx *= friction;
  vz *= friction;

  const speed = Math.hypot(vx, vz);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vz = (vz / speed) * MAX_SPEED;
  }

  let x = clamp(player.x + vx * deltaSeconds, -ARENA_LIMIT, ARENA_LIMIT);
  let z = clamp(player.z + vz * deltaSeconds, -ARENA_LIMIT, ARENA_LIMIT);
  if (Math.abs(x) >= ARENA_LIMIT) {
    vx *= -0.42;
  }
  if (Math.abs(z) >= ARENA_LIMIT) {
    vz *= -0.42;
  }

  return { ...player, x, z, vx, vz, dashCooldownMs };
};

const resolveCollision = (players: CubePlayer[]): CubePlayer[] => {
  if (players.length < 2) {
    return players;
  }

  const nextPlayers = players.map((entry) => ({ ...entry }));
  const left = nextPlayers[0];
  const right = nextPlayers[1];
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const minDistance = PLAYER_RADIUS * 2;
  if (distance >= minDistance) {
    return nextPlayers;
  }

  const nx = dx / distance;
  const nz = dz / distance;
  const overlap = minDistance - distance;
  left.x -= nx * overlap * 0.5;
  left.z -= nz * overlap * 0.5;
  right.x += nx * overlap * 0.5;
  right.z += nz * overlap * 0.5;

  const leftPush = left.vx * nx + left.vz * nz;
  const rightPush = right.vx * nx + right.vz * nz;
  const impulse = (leftPush - rightPush) * 0.72;
  left.vx -= impulse * nx;
  left.vz -= impulse * nz;
  right.vx += impulse * nx;
  right.vz += impulse * nz;
  return nextPlayers;
};

const getCpuInput = (player: CubePlayer, core: { x: number; z: number }): CubeInput => {
  const input = createInput();
  input.up = core.z < player.z - 0.35;
  input.down = core.z > player.z + 0.35;
  input.left = core.x < player.x - 0.35;
  input.right = core.x > player.x + 0.35;
  input.dash = player.dashCooldownMs <= 0 && Math.hypot(core.x - player.x, core.z - player.z) > 3;
  return input;
};

const advanceLocalSnapshot = (
  snapshot: CubeSnapshot,
  inputs: Record<string, CubeInput>,
  deltaMs: number
): CubeSnapshot => {
  if (snapshot.phase !== 'playing') {
    return snapshot;
  }

  const deltaSeconds = deltaMs / 1000;
  let players = snapshot.players.map((entry) =>
    advancePlayer(entry, entry.isCpu ? getCpuInput(entry, snapshot.core) : inputs[entry.id] || createInput(), deltaSeconds, deltaMs)
  );
  players = resolveCollision(players);

  let core = snapshot.core;
  let event = snapshot.event;
  const collector = players.find((entry) => Math.hypot(entry.x - core.x, entry.z - core.z) <= CORE_RADIUS);
  if (collector) {
    players = players.map((entry) => entry.id === collector.id ? { ...entry, score: entry.score + 1 } : entry);
    core = createCore();
    event = `${collector.name} captured a core.`;
  }

  const elapsedMs = snapshot.elapsedMs + deltaMs;
  const winner = players.find((entry) => entry.score >= TARGET_SCORE);
  if (winner) {
    return {
      ...snapshot,
      phase: 'finished',
      elapsedMs,
      core,
      players,
      winnerId: winner.id,
      winnerName: winner.name,
      event: `${winner.name} claimed the arena.`,
    };
  }

  if (elapsedMs >= ROUND_TIME_MS) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const timedWinner = sorted[0].score === sorted[1].score ? null : sorted[0];
    return {
      ...snapshot,
      phase: 'finished',
      elapsedMs,
      core,
      players,
      winnerId: timedWinner?.id || null,
      winnerName: timedWinner?.name || null,
      event: timedWinner ? `${timedWinner.name} claimed the arena.` : 'Draw round',
    };
  }

  return {
    ...snapshot,
    elapsedMs,
    core,
    players,
    event,
  };
};

const formatTime = (snapshot: CubeSnapshot): string => {
  const left = Math.max(0, snapshot.roundTimeMs - snapshot.elapsedMs);
  return `${Math.ceil(left / 1000)}s`;
};

export function CubeClashArenaGame({
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
}: CubeClashArenaGameProps) {
  const gameLabel = formatGameName('cube-clash-3d', gameDefinitions);
  const [snapshot, setSnapshot] = useState<CubeSnapshot>(() =>
    mode === 'online' ? createOnlinePlaceholder(player) : createLocalSnapshot(mode, player, offlineParticipantNames)
  );
  const [connectionLabel, setConnectionLabel] = useState(mode === 'online' ? 'Socket idle' : 'Local engine');
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef(snapshot);
  const inputRef = useRef<Record<string, CubeInput>>({});
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSentInputRef = useRef('');
  const lastReportedOutcomeRef = useRef<string | null>(null);

  const localPlayer = useMemo(
    () => snapshot.players.find((entry) => entry.id === player.playerId) || snapshot.players[0],
    [player.playerId, snapshot.players]
  );
  const opponent = snapshot.players.find((entry) => entry.id !== localPlayer?.id);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  const publishInput = useCallback(() => {
    if (mode !== 'online') {
      return;
    }
    const input = inputRef.current[player.playerId] || createInput();
    const serialized = JSON.stringify(input);
    if (serialized === lastSentInputRef.current) {
      return;
    }
    lastSentInputRef.current = serialized;
    sendSocketMessage({ type: 'cube-clash-input', input });
  }, [mode, player.playerId, sendSocketMessage]);

  const setHeldInput = useCallback((playerId: string, key: keyof CubeInput, active: boolean) => {
    inputRef.current[playerId] = {
      ...(inputRef.current[playerId] || createInput()),
      [key]: active,
    };
    publishInput();
  }, [publishInput]);

  const tapInput = useCallback((playerId: string, key: keyof CubeInput) => {
    setHeldInput(playerId, key, true);
    window.setTimeout(() => setHeldInput(playerId, key, false), key === 'dash' ? 220 : 140);
  }, [setHeldInput]);

  const resetLocalRound = useCallback(() => {
    lastFrameRef.current = null;
    lastReportedOutcomeRef.current = null;
    inputRef.current = {};
    setSnapshot((current) => ({
      ...createLocalSnapshot(mode, player, offlineParticipantNames),
      round: current.round + 1,
    }));
  }, [mode, offlineParticipantNames, player]);

  const handleRematch = useCallback(() => {
    lastReportedOutcomeRef.current = null;
    if (mode === 'online') {
      sendSocketMessage({ type: 'cube-clash-rematch' });
      return;
    }
    resetLocalRound();
  }, [mode, resetLocalRound, sendSocketMessage]);

  useEffect(() => {
    lastReportedOutcomeRef.current = null;
    inputRef.current = {};
    setSnapshot(mode === 'online' ? createOnlinePlaceholder(player) : createLocalSnapshot(mode, player, offlineParticipantNames));
    setConnectionLabel(mode === 'online' ? 'Socket idle' : 'Local engine');
  }, [mode, offlineParticipantNames, player]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return undefined;
    }

    let cancelled = false;
    const connect = () => {
      const token = getAuthToken();
      if (!token) {
        setConnectionLabel('Socket needs sign-in');
        return;
      }

      const socket = new WebSocket(`${getWsBaseUrl()}/ws/cube-clash?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`);
      socketRef.current = socket;
      setConnectionLabel('Socket connecting');

      socket.onopen = () => {
        setConnectionLabel('Socket live');
        publishInput();
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }
        setConnectionLabel('Reconnecting');
        reconnectTimerRef.current = window.setTimeout(connect, 1200);
      };

      socket.onerror = () => {
        setConnectionLabel('Socket error');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            event?: string;
            playerName?: string;
            snapshot?: CubeSnapshot;
          };

          if (payload.type === 'cube-clash-snapshot' && payload.snapshot) {
            setSnapshot({
              ...payload.snapshot,
              players: payload.snapshot.players.map((entry) => ({
                ...entry,
                isLocal: entry.id === player.playerId,
              })),
            });
            setConnectionLabel('Socket live');
            return;
          }

          if (payload.type === 'cube-clash-presence') {
            setConnectionLabel(payload.event === 'left' ? 'Rival presence changed' : `${payload.playerName || 'Player'} joined`);
          }
        } catch (_error) {
          setConnectionLabel('Socket payload skipped');
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [mode, player.playerId, publishInput, roomCode]);

  useEffect(() => {
    if (mode === 'online') {
      return undefined;
    }

    const step = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const deltaMs = Math.min(now - lastFrameRef.current, 50);
      lastFrameRef.current = now;
      setSnapshot((current) => advanceLocalSnapshot(current, inputRef.current, deltaMs));
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const p1Id = player.playerId;
      const p2Id = snapshotRef.current.players.find((entry) => entry.id !== p1Id)?.id || 'offline-p2';
      const targetP2 = mode !== 'online';

      if (key === 'w') {
        event.preventDefault();
        setHeldInput(p1Id, 'up', true);
      } else if (key === 's') {
        event.preventDefault();
        setHeldInput(p1Id, 'down', true);
      } else if (key === 'a') {
        event.preventDefault();
        setHeldInput(p1Id, 'left', true);
      } else if (key === 'd') {
        event.preventDefault();
        setHeldInput(p1Id, 'right', true);
      } else if (event.code === 'Space') {
        event.preventDefault();
        setHeldInput(p1Id, 'dash', true);
      } else if (targetP2 && event.key === 'ArrowUp') {
        event.preventDefault();
        setHeldInput(p2Id, 'up', true);
      } else if (targetP2 && event.key === 'ArrowDown') {
        event.preventDefault();
        setHeldInput(p2Id, 'down', true);
      } else if (targetP2 && event.key === 'ArrowLeft') {
        event.preventDefault();
        setHeldInput(p2Id, 'left', true);
      } else if (targetP2 && event.key === 'ArrowRight') {
        event.preventDefault();
        setHeldInput(p2Id, 'right', true);
      } else if (targetP2 && event.key === 'Enter') {
        event.preventDefault();
        setHeldInput(p2Id, 'dash', true);
      } else if (mode === 'online' && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const map: Partial<Record<string, keyof CubeInput>> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const mapped = map[event.key];
        if (mapped) setHeldInput(p1Id, mapped, true);
      } else if (key === 'r') {
        event.preventDefault();
        handleRematch();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const p1Id = player.playerId;
      const p2Id = snapshotRef.current.players.find((entry) => entry.id !== p1Id)?.id || 'offline-p2';
      const targetP2 = mode !== 'online';

      if (key === 'w') setHeldInput(p1Id, 'up', false);
      else if (key === 's') setHeldInput(p1Id, 'down', false);
      else if (key === 'a') setHeldInput(p1Id, 'left', false);
      else if (key === 'd') setHeldInput(p1Id, 'right', false);
      else if (event.code === 'Space') setHeldInput(p1Id, 'dash', false);
      else if (targetP2 && event.key === 'ArrowUp') setHeldInput(p2Id, 'up', false);
      else if (targetP2 && event.key === 'ArrowDown') setHeldInput(p2Id, 'down', false);
      else if (targetP2 && event.key === 'ArrowLeft') setHeldInput(p2Id, 'left', false);
      else if (targetP2 && event.key === 'ArrowRight') setHeldInput(p2Id, 'right', false);
      else if (targetP2 && event.key === 'Enter') setHeldInput(p2Id, 'dash', false);
      else if (mode === 'online' && event.key.startsWith('Arrow')) {
        const map: Partial<Record<string, keyof CubeInput>> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const mapped = map[event.key];
        if (mapped) setHeldInput(p1Id, mapped, false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRematch, mode, player.playerId, setHeldInput]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 10, 10.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'cube-clash-canvas';
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x1f2937, 2.1);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 9, 4);
    key.castShadow = true;
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(14.4, 0.28, 14.4),
      new THREE.MeshStandardMaterial({ color: 0x263449, roughness: 0.72, metalness: 0.18 })
    );
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(14, 14, 0x9fb7ff, 0x536179);
    grid.position.y = 0.16;
    scene.add(grid);

    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.25 });
    const rails = [
      { x: 0, z: -7.1, sx: 14.6, sz: 0.22 },
      { x: 0, z: 7.1, sx: 14.6, sz: 0.22 },
      { x: -7.1, z: 0, sx: 0.22, sz: 14.6 },
      { x: 7.1, z: 0, sx: 0.22, sz: 14.6 },
    ];
    rails.forEach((rail) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(rail.sx, 0.8, rail.sz), railMaterial);
      mesh.position.set(rail.x, 0.48, rail.z);
      mesh.castShadow = true;
      scene.add(mesh);
    });

    const playerMeshes = new Map<string, THREE.Mesh>();
    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x8a5a00, roughness: 0.28, metalness: 0.35 })
    );
    coreMesh.castShadow = true;
    scene.add(coreMesh);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(260, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationId = 0;
    const render = () => {
      const current = snapshotRef.current;
      const ids = new Set(current.players.map((entry) => entry.id));
      Array.from(playerMeshes.entries()).forEach(([id, mesh]) => {
        if (!ids.has(id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material.dispose());
          } else {
            mesh.material.dispose();
          }
          playerMeshes.delete(id);
        }
      });

      current.players.forEach((entry) => {
        let mesh = playerMeshes.get(entry.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.9, 0.9),
            new THREE.MeshStandardMaterial({
              color: new THREE.Color(entry.color),
              emissive: new THREE.Color(entry.color).multiplyScalar(0.2),
              roughness: 0.36,
              metalness: 0.32,
            })
          );
          mesh.castShadow = true;
          scene.add(mesh);
          playerMeshes.set(entry.id, mesh);
        }
        mesh.position.lerp(new THREE.Vector3(entry.x, 0.78, entry.z), 0.42);
        mesh.rotation.x += 0.012 + Math.abs(entry.vz) * 0.002;
        mesh.rotation.z -= 0.012 + Math.abs(entry.vx) * 0.002;
        mesh.scale.setScalar(entry.connected === false ? 0.76 : 1);
      });

      coreMesh.position.set(current.core.x, 0.88 + Math.sin(Date.now() / 280) * 0.12, current.core.z);
      coreMesh.rotation.y += 0.025;
      coreMesh.rotation.x += 0.018;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      playerMeshes.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      coreMesh.geometry.dispose();
      if (Array.isArray(coreMesh.material)) {
        coreMesh.material.forEach((material) => material.dispose());
      } else {
        coreMesh.material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (snapshot.phase !== 'finished') {
      return;
    }

    const outcome = snapshot.winnerId === null ? 'draw' : snapshot.winnerId === player.playerId ? 'win' : 'loss';
    const reportKey = `${snapshot.round}:${outcome}:${snapshot.winnerId || 'draw'}`;
    if (lastReportedOutcomeRef.current === reportKey) {
      return;
    }
    lastReportedOutcomeRef.current = reportKey;
    onMatchComplete({
      mode,
      gameType: 'cube-clash-3d',
      outcome,
      opponent: opponent?.name || 'Cube Clash rival',
    });
  }, [mode, onMatchComplete, opponent?.name, player.playerId, snapshot.phase, snapshot.round, snapshot.winnerId]);

  const controllerSections = [
    {
      key: 'move',
      title: 'Move',
      layout: 'dpad' as const,
      buttons: [
        { key: 'up', label: 'Up', icon: <AiOutlineArrowUp />, slot: 'up' as const, onPointerDown: () => setHeldInput(player.playerId, 'up', true), onPointerUp: () => setHeldInput(player.playerId, 'up', false), onClick: () => tapInput(player.playerId, 'up') },
        { key: 'down', label: 'Down', icon: <AiOutlineArrowDown />, slot: 'down' as const, onPointerDown: () => setHeldInput(player.playerId, 'down', true), onPointerUp: () => setHeldInput(player.playerId, 'down', false), onClick: () => tapInput(player.playerId, 'down') },
        { key: 'left', label: 'Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onPointerDown: () => setHeldInput(player.playerId, 'left', true), onPointerUp: () => setHeldInput(player.playerId, 'left', false), onClick: () => tapInput(player.playerId, 'left') },
        { key: 'right', label: 'Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onPointerDown: () => setHeldInput(player.playerId, 'right', true), onPointerUp: () => setHeldInput(player.playerId, 'right', false), onClick: () => tapInput(player.playerId, 'right') },
      ],
    },
    {
      key: 'actions',
      title: 'Actions',
      layout: 'row' as const,
      buttons: [
        { key: 'dash', label: 'Dash', icon: <AiOutlineRocket />, onPointerDown: () => setHeldInput(player.playerId, 'dash', true), onPointerUp: () => setHeldInput(player.playerId, 'dash', false), onClick: () => tapInput(player.playerId, 'dash'), disabled: Boolean(localPlayer && localPlayer.dashCooldownMs > 70) },
        { key: 'rematch', label: 'Rematch', icon: <AiOutlineReload />, onClick: handleRematch },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay title={gameLabel} subtitle={mode === 'online' ? 'Server-synced 3D duel' : 'P1 WASD, P2 arrows'} sections={controllerSections} />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button className="room-float-collapsed-center" type="button" onClick={() => setIsInfoCardCollapsed(false)} aria-label="Expand arena info">
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel}</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse arena info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> {snapshot.event}</span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Mode</span><strong>{mode === 'offline' ? 'Local' : mode}</strong></div>
                <div className="solo-float-stat"><span>Link</span><strong>{connectionLabel}</strong></div>
                <div className="solo-float-stat"><span>Time</span><strong>{formatTime(snapshot)}</strong></div>
                <div className="solo-float-stat"><span>Target</span><strong>{snapshot.targetScore}</strong></div>
                {snapshot.players.map((entry) => (
                  <div key={entry.id} className="solo-float-stat">
                    <span>{entry.name}</span><strong>{entry.score}</strong>
                  </div>
                ))}
              </div>

              <div className="solo-float-actions">
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

      <section className="cube-clash-shell">
        <div className="cube-clash-hud">
          {snapshot.players.map((entry) => (
            <div key={entry.id} className={classnames('cube-clash-hud-card', entry.id === localPlayer?.id && 'cube-clash-hud-card-local')}>
              <span>{entry.connected === false ? 'Offline' : entry.id === localPlayer?.id ? 'You' : 'Rival'}</span>
              <strong>{entry.name}</strong>
              <i>{entry.score} / {snapshot.targetScore}</i>
            </div>
          ))}
          <div className="cube-clash-hud-card">
            <span>Clock</span>
            <strong>{formatTime(snapshot)}</strong>
            <i>{connectionLabel}</i>
          </div>
        </div>

        <div className="cube-clash-stage-wrap">
          <div ref={mountRef} className="cube-clash-stage" aria-label="Cube Clash 3D arena" />
          {snapshot.phase !== 'playing' ? (
            <div className="cube-clash-overlay">
              <div className="cube-clash-message">
                <span className={classnames('cube-clash-status-pill', snapshot.phase === 'finished' && 'cube-clash-status-pill-finished')}>
                  {snapshot.phase === 'waiting' ? 'Waiting' : 'Finished'}
                </span>
                <h2>{snapshot.phase === 'waiting' ? 'Arena standing by' : snapshot.winnerName ? `${snapshot.winnerName} wins` : 'Draw round'}</h2>
                <p>{snapshot.phase === 'waiting' ? 'The 3D room begins when both pilots are present.' : snapshot.event}</p>
                <div className="cube-clash-message-actions">
                  <button className="cube-clash-action-btn" type="button" onClick={handleRematch}>
                    <AiOutlineReload /> Rematch
                  </button>
                  <button className="cube-clash-action-btn cube-clash-action-btn-ghost" type="button" onClick={onLeave}>
                    Leave
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <p className="cube-clash-inline-hint">
          Collect glowing cores to score. Dashing helps cut angles, and body contact knocks both cubes off their line.
        </p>
      </section>
    </>
  );
}
