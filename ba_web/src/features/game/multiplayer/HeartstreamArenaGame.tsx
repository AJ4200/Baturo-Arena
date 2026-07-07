'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import Matter from 'matter-js';
import * as THREE from 'three';
import {
  AiFillHeart,
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineInfoCircle,
  AiOutlineReload,
  AiOutlineRocket,
  AiOutlineSound,
  AiOutlineThunderbolt,
  AiOutlineWifi,
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
} from '@/types/game';

type Side = 'left' | 'right';
type MatchPhase = 'ready' | 'playing' | 'won';
type DirectionKey = 'up' | 'down' | 'left' | 'right' | 'boost';

type PilotState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type ShardState = {
  id: string;
  x: number;
  y: number;
  value: number;
};

type HeartstreamState = {
  phase: MatchPhase;
  leftScore: number;
  rightScore: number;
  targetScore: number;
  round: number;
  timeMs: number;
  winner: Side | null;
  leftPilot: PilotState;
  rightPilot: PilotState;
  shards: ShardState[];
  event: string;
};

type InputState = {
  x: number;
  y: number;
  boost: boolean;
};

type HeartstreamArenaGameProps = {
  player: PlayerProfile;
  mode: GameMode;
  roomCode?: string | null;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
  offlineParticipantNames: string[];
};

type PhysicsRefs = {
  engine: Matter.Engine;
  leftPilot: Matter.Body;
  rightPilot: Matter.Body;
  shardBodies: Map<string, Matter.Body>;
  collectedShardIds: Set<string>;
};

type ThreeRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  leftPilot: THREE.Mesh;
  rightPilot: THREE.Mesh;
  leftTrail: THREE.Points;
  rightTrail: THREE.Points;
  shardMeshes: Map<string, THREE.Mesh>;
  heartGate: THREE.Mesh;
  animationId: number;
};

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 620;
const PILOT_RADIUS = 24;
const SHARD_RADIUS = 17;
const TARGET_SCORE = 16;
const SHARD_COUNT = 12;
const BOOST_FORCE = 0.0032;
const PILOT_FORCE = 0.0022;
const MAX_SPEED = 8.4;
const ONLINE_SYNC_INTERVAL_MS = 50;
const CPU_REACTION_MS = 160;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const emptyInput = (): InputState => ({ x: 0, y: 0, boost: false });

const createPilot = (side: Side): PilotState => ({
  x: side === 'left' ? 205 : ARENA_WIDTH - 205,
  y: ARENA_HEIGHT / 2,
  vx: 0,
  vy: 0,
});

const createShard = (index: number, round: number): ShardState => {
  const ring = index % 2 === 0 ? 190 : 118;
  const angle = (index / SHARD_COUNT) * Math.PI * 2 + round * 0.37;
  const wobble = Math.sin(index * 1.7 + round) * 32;
  return {
    id: `${round}-${index}-${Math.round(Math.random() * 10000)}`,
    x: ARENA_WIDTH / 2 + Math.cos(angle) * (ring + wobble),
    y: ARENA_HEIGHT / 2 + Math.sin(angle) * (ring - wobble * 0.4),
    value: index % 5 === 0 ? 2 : 1,
  };
};

const createShards = (round: number): ShardState[] =>
  Array.from({ length: SHARD_COUNT }, (_, index) => createShard(index, round));

const createInitialState = (round = 1): HeartstreamState => ({
  phase: 'ready',
  leftScore: 0,
  rightScore: 0,
  targetScore: TARGET_SCORE,
  round,
  timeMs: 0,
  winner: null,
  leftPilot: createPilot('left'),
  rightPilot: createPilot('right'),
  shards: createShards(round),
  event: 'Gather the heartstream before your rival does.',
});

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

const toScenePosition = (x: number, y: number): THREE.Vector3 =>
  new THREE.Vector3((x - ARENA_WIDTH / 2) / 42, 0, (y - ARENA_HEIGHT / 2) / 42);

const createHeartGeometry = (): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.42);
  shape.bezierCurveTo(0, 0.7, -0.5, 0.76, -0.5, 0.32);
  shape.bezierCurveTo(-0.5, 0.02, -0.15, -0.17, 0, -0.44);
  shape.bezierCurveTo(0.15, -0.17, 0.5, 0.02, 0.5, 0.32);
  shape.bezierCurveTo(0.5, 0.76, 0, 0.7, 0, 0.42);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.045,
    bevelThickness: 0.045,
  });
};

const createPhysics = (state: HeartstreamState): PhysicsRefs => {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
  const leftPilot = Matter.Bodies.circle(state.leftPilot.x, state.leftPilot.y, PILOT_RADIUS, {
    label: 'pilot:left',
    restitution: 0.88,
    frictionAir: 0.045,
  });
  const rightPilot = Matter.Bodies.circle(state.rightPilot.x, state.rightPilot.y, PILOT_RADIUS, {
    label: 'pilot:right',
    restitution: 0.88,
    frictionAir: 0.045,
  });
  const walls = [
    Matter.Bodies.rectangle(ARENA_WIDTH / 2, -18, ARENA_WIDTH, 36, { isStatic: true, label: 'wall:top' }),
    Matter.Bodies.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT + 18, ARENA_WIDTH, 36, { isStatic: true, label: 'wall:bottom' }),
    Matter.Bodies.rectangle(-18, ARENA_HEIGHT / 2, 36, ARENA_HEIGHT, { isStatic: true, label: 'wall:left' }),
    Matter.Bodies.rectangle(ARENA_WIDTH + 18, ARENA_HEIGHT / 2, 36, ARENA_HEIGHT, { isStatic: true, label: 'wall:right' }),
    Matter.Bodies.circle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 44, {
      isStatic: true,
      restitution: 1.15,
      label: 'gravity-well:center',
    }),
    Matter.Bodies.circle(ARENA_WIDTH / 2 - 250, ARENA_HEIGHT / 2 - 145, 38, {
      isStatic: true,
      restitution: 1.08,
      label: 'gravity-well:left',
    }),
    Matter.Bodies.circle(ARENA_WIDTH / 2 + 250, ARENA_HEIGHT / 2 + 145, 38, {
      isStatic: true,
      restitution: 1.08,
      label: 'gravity-well:right',
    }),
  ];
  const refs: PhysicsRefs = {
    engine,
    leftPilot,
    rightPilot,
    shardBodies: new Map(),
    collectedShardIds: new Set(),
  };

  Matter.Composite.add(engine.world, [leftPilot, rightPilot, ...walls]);
  syncShardBodies(refs, state.shards);

  Matter.Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      const shardLabel = labels.find((label) => label.startsWith('shard:'));
      if (shardLabel && labels.some((label) => label.startsWith('pilot:'))) {
        refs.collectedShardIds.add(shardLabel.replace('shard:', ''));
      }
    });
  });

  return refs;
};

function syncShardBodies(refs: PhysicsRefs, shards: ShardState[]): void {
  const activeIds = new Set(shards.map((shard) => shard.id));
  refs.shardBodies.forEach((body, id) => {
    if (!activeIds.has(id)) {
      Matter.Composite.remove(refs.engine.world, body);
      refs.shardBodies.delete(id);
    }
  });

  shards.forEach((shard) => {
    if (refs.shardBodies.has(shard.id)) {
      return;
    }
    const body = Matter.Bodies.circle(shard.x, shard.y, SHARD_RADIUS, {
      isSensor: true,
      isStatic: true,
      label: `shard:${shard.id}`,
    });
    refs.shardBodies.set(shard.id, body);
    Matter.Composite.add(refs.engine.world, body);
  });
}

const applyPilotInput = (body: Matter.Body, input: InputState): void => {
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude > 0) {
    const force = input.boost ? BOOST_FORCE : PILOT_FORCE;
    Matter.Body.applyForce(body, body.position, {
      x: (input.x / magnitude) * force,
      y: (input.y / magnitude) * force,
    });
  }

  const speed = Math.hypot(body.velocity.x, body.velocity.y);
  const maxSpeed = input.boost ? MAX_SPEED * 1.18 : MAX_SPEED;
  if (speed > maxSpeed) {
    Matter.Body.setVelocity(body, {
      x: (body.velocity.x / speed) * maxSpeed,
      y: (body.velocity.y / speed) * maxSpeed,
    });
  }
};

const readPilot = (body: Matter.Body): PilotState => ({
  x: clamp(body.position.x, PILOT_RADIUS, ARENA_WIDTH - PILOT_RADIUS),
  y: clamp(body.position.y, PILOT_RADIUS, ARENA_HEIGHT - PILOT_RADIUS),
  vx: body.velocity.x,
  vy: body.velocity.y,
});

const resetPhysics = (refs: PhysicsRefs, state: HeartstreamState): void => {
  Matter.Body.setPosition(refs.leftPilot, { x: state.leftPilot.x, y: state.leftPilot.y });
  Matter.Body.setVelocity(refs.leftPilot, { x: 0, y: 0 });
  Matter.Body.setPosition(refs.rightPilot, { x: state.rightPilot.x, y: state.rightPilot.y });
  Matter.Body.setVelocity(refs.rightPilot, { x: 0, y: 0 });
  refs.collectedShardIds.clear();
  syncShardBodies(refs, state.shards);
};

const createTrail = (color: number): THREE.Points => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(42 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.08,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
};

const pushTrailPoint = (trail: THREE.Points, position: THREE.Vector3): void => {
  const attribute = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
  const values = attribute.array as Float32Array;
  for (let index = values.length - 1; index >= 3; index -= 1) {
    values[index] = values[index - 3];
  }
  values[0] = position.x;
  values[1] = 0.12;
  values[2] = position.z;
  attribute.needsUpdate = true;
};

export function HeartstreamArenaGame({
  player,
  mode,
  roomCode,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
  offlineParticipantNames,
}: HeartstreamArenaGameProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const physicsRef = useRef<PhysicsRefs | null>(null);
  const threeRef = useRef<ThreeRefs | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<HeartstreamState>(createInitialState());
  const [viewState, setViewState] = useState<HeartstreamState>(stateRef.current);
  const [connectionStatus, setConnectionStatus] = useState(mode === 'online' ? 'Connecting' : 'Local');
  const [onlineSide, setOnlineSide] = useState<Side | null>(null);
  const onlineSideRef = useRef<Side | null>(null);
  const inputRef = useRef<Record<Side, InputState>>({ left: emptyInput(), right: emptyInput() });
  const pressedRef = useRef<Record<Side, Set<DirectionKey>>>({
    left: new Set(),
    right: new Set(),
  });
  const lastViewUpdateRef = useRef(0);
  const lastSyncRef = useRef(0);
  const lastCpuRef = useRef(0);
  const completedWinnerRef = useRef<Side | null>(null);

  const gameName = formatGameName('heartstream', gameDefinitions);
  const leftName = mode === 'offline' ? (offlineParticipantNames[0] || player.name || 'Player 1') : player.name;
  const rightName =
    mode === 'cpu'
      ? 'CPU Cupid'
      : mode === 'offline'
        ? (offlineParticipantNames[1] || 'Player 2')
        : 'Rival Pilot';

  const isAuthoritative = mode !== 'online' || onlineSide === 'left';
  const controlledSide: Side = mode === 'online' ? onlineSide || 'left' : 'left';

  const publishState = useCallback((nextState: HeartstreamState) => {
    stateRef.current = nextState;
    const now = performance.now();
    if (now - lastViewUpdateRef.current > 85 || nextState.phase === 'won') {
      lastViewUpdateRef.current = now;
      setViewState({ ...nextState, shards: [...nextState.shards] });
    }
  }, []);

  const setDirection = useCallback((side: Side, key: DirectionKey, active: boolean) => {
    const pressed = pressedRef.current[side];
    if (active) {
      pressed.add(key);
    } else {
      pressed.delete(key);
    }
    inputRef.current[side] = {
      x: (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0),
      y: (pressed.has('down') ? 1 : 0) - (pressed.has('up') ? 1 : 0),
      boost: pressed.has('boost'),
    };
  }, []);

  const resetMatch = useCallback(() => {
    const nextState = createInitialState(stateRef.current.round + 1);
    completedWinnerRef.current = null;
    if (physicsRef.current) {
      resetPhysics(physicsRef.current, nextState);
    }
    publishState(nextState);
    socketRef.current?.send(JSON.stringify({ type: 'heartstream-rematch' }));
  }, [publishState]);

  useEffect(() => {
    const refs = createPhysics(stateRef.current);
    physicsRef.current = refs;
    return () => {
      Matter.Composite.clear(refs.engine.world, false);
      Matter.Engine.clear(refs.engine);
      physicsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
    camera.position.set(0, 12, 13);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(4, 8, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(23, 0.18, 14.8),
      new THREE.MeshStandardMaterial({
        color: 0x101526,
        roughness: 0.36,
        metalness: 0.18,
        emissive: 0x131a34,
        emissiveIntensity: 0.42,
      })
    );
    floor.receiveShadow = true;
    scene.add(floor);

    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.06, 12, 80),
      new THREE.MeshStandardMaterial({
        color: 0xff78b7,
        emissive: 0xff3d91,
        emissiveIntensity: 1.2,
      })
    );
    gate.rotation.x = Math.PI / 2;
    gate.position.y = 0.08;
    scene.add(gate);

    const wellMaterial = new THREE.MeshStandardMaterial({
      color: 0x6ee7ff,
      emissive: 0x23a6d5,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.72,
    });
    [
      [ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 0.98],
      [ARENA_WIDTH / 2 - 250, ARENA_HEIGHT / 2 - 145, 0.82],
      [ARENA_WIDTH / 2 + 250, ARENA_HEIGHT / 2 + 145, 0.82],
    ].forEach(([x, y, scale]) => {
      const well = new THREE.Mesh(new THREE.CylinderGeometry(scale, scale, 0.16, 42), wellMaterial);
      const position = toScenePosition(x, y);
      well.position.set(position.x, 0.18, position.z);
      scene.add(well);
    });

    const pilotGeometry = new THREE.SphereGeometry(0.55, 32, 24);
    const leftPilot = new THREE.Mesh(
      pilotGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xff5ca8,
        emissive: 0xff1f80,
        emissiveIntensity: 0.72,
        roughness: 0.24,
        metalness: 0.3,
      })
    );
    const rightPilot = new THREE.Mesh(
      pilotGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x78f4ff,
        emissive: 0x22b8d8,
        emissiveIntensity: 0.72,
        roughness: 0.24,
        metalness: 0.3,
      })
    );
    leftPilot.castShadow = true;
    rightPilot.castShadow = true;
    scene.add(leftPilot, rightPilot);

    const leftTrail = createTrail(0xff76b8);
    const rightTrail = createTrail(0x73efff);
    scene.add(leftTrail, rightTrail);

    const stars = new THREE.BufferGeometry();
    const starPositions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 24;
      starPositions[index * 3 + 1] = 0.18 + Math.random() * 0.35;
      starPositions[index * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    stars.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.55 })
      )
    );

    const refs: ThreeRefs = {
      renderer,
      scene,
      camera,
      leftPilot,
      rightPilot,
      leftTrail,
      rightTrail,
      shardMeshes: new Map(),
      heartGate: gate,
      animationId: 0,
    };
    threeRef.current = refs;

    const heartGeometry = createHeartGeometry();
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      const aspect = width / height;
      camera.left = -11.4 * aspect;
      camera.right = 11.4 * aspect;
      camera.top = 8;
      camera.bottom = -8;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const state = stateRef.current;
      const leftPosition = toScenePosition(state.leftPilot.x, state.leftPilot.y);
      const rightPosition = toScenePosition(state.rightPilot.x, state.rightPilot.y);
      leftPilot.position.set(leftPosition.x, 0.58, leftPosition.z);
      rightPilot.position.set(rightPosition.x, 0.58, rightPosition.z);
      leftPilot.rotation.y += 0.04;
      rightPilot.rotation.y -= 0.04;
      gate.rotation.z += enableAnimations ? 0.012 : 0;
      pushTrailPoint(leftTrail, leftPosition);
      pushTrailPoint(rightTrail, rightPosition);

      const activeShardIds = new Set(state.shards.map((shard) => shard.id));
      refs.shardMeshes.forEach((mesh, id) => {
        if (!activeShardIds.has(id)) {
          scene.remove(mesh);
          refs.shardMeshes.delete(id);
        }
      });
      state.shards.forEach((shard) => {
        let mesh = refs.shardMeshes.get(shard.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            heartGeometry,
            new THREE.MeshStandardMaterial({
              color: shard.value > 1 ? 0xffd45f : 0xff70b7,
              emissive: shard.value > 1 ? 0xffb000 : 0xff2f92,
              emissiveIntensity: 1.1,
              roughness: 0.18,
              metalness: 0.16,
            })
          );
          mesh.scale.setScalar(shard.value > 1 ? 0.7 : 0.55);
          scene.add(mesh);
          refs.shardMeshes.set(shard.id, mesh);
        }
        const position = toScenePosition(shard.x, shard.y);
        mesh.position.set(position.x, 0.38 + Math.sin(performance.now() / 280 + shard.x) * 0.05, position.z);
        mesh.rotation.y += 0.035;
      });

      renderer.render(scene, camera);
      refs.animationId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(refs.animationId);
      refs.shardMeshes.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
      });
      heartGeometry.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, [enableAnimations]);

  useEffect(() => {
    if (mode !== 'online' || !roomCode) {
      return undefined;
    }

    const token = getAuthToken();
    if (!token) {
      setConnectionStatus('Sign in required');
      return undefined;
    }

    const socket = new WebSocket(`${getWsBaseUrl()}/ws/heartstream?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    setConnectionStatus('Connecting');

    socket.addEventListener('open', () => setConnectionStatus('Connected'));
    socket.addEventListener('close', () => setConnectionStatus('Disconnected'));
    socket.addEventListener('error', () => setConnectionStatus('Connection issue'));
    socket.addEventListener('message', (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch (_error) {
        return;
      }

      if (payload.type === 'heartstream-presence' && payload.side) {
        if (payload.playerId === player.playerId) {
          onlineSideRef.current = payload.side;
          setOnlineSide(payload.side);
        }
        setConnectionStatus(payload.event === 'left' ? 'Rival left' : 'Connected');
      }

      if (payload.type === 'heartstream-state' && payload.state && onlineSideRef.current !== 'left') {
        publishState(payload.state);
      }

      if (payload.type === 'heartstream-input' && payload.input && onlineSideRef.current === 'left') {
        inputRef.current.right = payload.input;
      }

      if (payload.type === 'heartstream-rematch') {
        const nextState = createInitialState(stateRef.current.round + 1);
        completedWinnerRef.current = null;
        if (physicsRef.current) {
          resetPhysics(physicsRef.current, nextState);
        }
        publishState(nextState);
      }
    });

    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [mode, player.playerId, publishState, roomCode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'shift'].includes(key)) {
        event.preventDefault();
      }
      const primarySide = mode === 'online' ? controlledSide : 'left';
      if (key === 'arrowup') setDirection(primarySide, 'up', true);
      if (key === 'arrowdown') setDirection(primarySide, 'down', true);
      if (key === 'arrowleft') setDirection(primarySide, 'left', true);
      if (key === 'arrowright') setDirection(primarySide, 'right', true);
      if (key === ' ') setDirection(primarySide, 'boost', true);
      if (mode === 'offline') {
        if (key === 'w') setDirection('right', 'up', true);
        if (key === 's') setDirection('right', 'down', true);
        if (key === 'a') setDirection('right', 'left', true);
        if (key === 'd') setDirection('right', 'right', true);
        if (key === 'shift') setDirection('right', 'boost', true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const primarySide = mode === 'online' ? controlledSide : 'left';
      if (key === 'arrowup') setDirection(primarySide, 'up', false);
      if (key === 'arrowdown') setDirection(primarySide, 'down', false);
      if (key === 'arrowleft') setDirection(primarySide, 'left', false);
      if (key === 'arrowright') setDirection(primarySide, 'right', false);
      if (key === ' ') setDirection(primarySide, 'boost', false);
      if (mode === 'offline') {
        if (key === 'w') setDirection('right', 'up', false);
        if (key === 's') setDirection('right', 'down', false);
        if (key === 'a') setDirection('right', 'left', false);
        if (key === 'd') setDirection('right', 'right', false);
        if (key === 'shift') setDirection('right', 'boost', false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [controlledSide, mode, setDirection]);

  useEffect(() => {
    let animationId = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      animationId = window.requestAnimationFrame(tick);
      const refs = physicsRef.current;
      if (!refs || !isAuthoritative) {
        return;
      }
      const deltaMs = Math.min(34, now - previous);
      previous = now;
      let state = stateRef.current;

      if (state.phase === 'ready') {
        state = { ...state, phase: 'playing', event: 'Heartstream live. Collect the glowing shards.' };
      }

      if (state.phase !== 'playing') {
        publishState(state);
        return;
      }

      if (mode === 'cpu' && now - lastCpuRef.current > CPU_REACTION_MS) {
        lastCpuRef.current = now;
        const target = state.shards.reduce<ShardState | null>((best, shard) => {
          if (!best) return shard;
          const bestDistance = Math.hypot(best.x - state.rightPilot.x, best.y - state.rightPilot.y);
          const shardDistance = Math.hypot(shard.x - state.rightPilot.x, shard.y - state.rightPilot.y);
          return shardDistance - shard.value * 26 < bestDistance - best.value * 26 ? shard : best;
        }, null);
        if (target) {
          const dx = target.x - state.rightPilot.x;
          const dy = target.y - state.rightPilot.y;
          const magnitude = Math.hypot(dx, dy) || 1;
          inputRef.current.right = { x: dx / magnitude, y: dy / magnitude, boost: magnitude > 180 };
        }
      }

      applyPilotInput(refs.leftPilot, inputRef.current.left);
      applyPilotInput(refs.rightPilot, inputRef.current.right);
      Matter.Engine.update(refs.engine, deltaMs);

      const leftPilot = readPilot(refs.leftPilot);
      const rightPilot = readPilot(refs.rightPilot);
      let leftScore = state.leftScore;
      let rightScore = state.rightScore;
      let event = state.event;
      let shards = state.shards;

      if (refs.collectedShardIds.size > 0) {
        const collected = refs.collectedShardIds;
        shards = state.shards.filter((shard) => {
          if (!collected.has(shard.id)) {
            return true;
          }
          const leftDistance = Math.hypot(shard.x - leftPilot.x, shard.y - leftPilot.y);
          const rightDistance = Math.hypot(shard.x - rightPilot.x, shard.y - rightPilot.y);
          if (leftDistance <= rightDistance) {
            leftScore += shard.value;
            event = `${leftName} caught ${shard.value > 1 ? 'a gold heart' : 'a heart shard'}.`;
          } else {
            rightScore += shard.value;
            event = `${rightName} caught ${shard.value > 1 ? 'a gold heart' : 'a heart shard'}.`;
          }
          return false;
        });
        refs.collectedShardIds.clear();
      }

      if (shards.length < SHARD_COUNT) {
        shards = [...shards];
        while (shards.length < SHARD_COUNT) {
          shards.push(createShard(shards.length + state.round, state.round + Math.floor(now / 1000)));
        }
        syncShardBodies(refs, shards);
      }

      const winner = leftScore >= TARGET_SCORE ? 'left' : rightScore >= TARGET_SCORE ? 'right' : null;
      const nextState: HeartstreamState = {
        ...state,
        phase: winner ? 'won' : 'playing',
        winner,
        leftScore,
        rightScore,
        leftPilot,
        rightPilot,
        shards,
        timeMs: state.timeMs + deltaMs,
        event: winner ? `${winner === 'left' ? leftName : rightName} filled the heartstream.` : event,
      };

      publishState(nextState);

      if (mode === 'online' && socketRef.current?.readyState === WebSocket.OPEN && now - lastSyncRef.current > ONLINE_SYNC_INTERVAL_MS) {
        lastSyncRef.current = now;
        socketRef.current.send(JSON.stringify({ type: 'heartstream-state', state: nextState }));
      }
    };

    animationId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationId);
  }, [isAuthoritative, leftName, mode, publishState, rightName]);

  useEffect(() => {
    if (mode !== 'online' || onlineSide !== 'right') {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'heartstream-input', input: inputRef.current.right }));
      }
    }, 33);
    return () => window.clearInterval(intervalId);
  }, [mode, onlineSide]);

  useEffect(() => {
    if (viewState.phase !== 'won' || !viewState.winner || completedWinnerRef.current === viewState.winner) {
      return;
    }
    completedWinnerRef.current = viewState.winner;
    const playerSide = mode === 'online' ? onlineSide : 'left';
    onMatchComplete({
      mode,
      gameType: 'heartstream',
      outcome: viewState.winner === playerSide ? 'win' : 'loss',
      opponent: viewState.winner === 'left' ? rightName : leftName,
    });
  }, [leftName, mode, onMatchComplete, onlineSide, rightName, viewState.phase, viewState.winner]);

  const makeHoldButton = (side: Side, key: DirectionKey, label: string, icon: React.ReactNode, slot?: 'up' | 'down' | 'left' | 'right' | 'center') => ({
    key: `${side}-${key}`,
    label,
    icon,
    slot,
    onPointerDown: () => setDirection(side, key, true),
    onPointerUp: () => setDirection(side, key, false),
  });

  const controllerSections = useMemo<ControllerSection[]>(() => {
    const primarySide = mode === 'online' ? controlledSide : 'left';
    const sections: ControllerSection[] = [
      {
        key: 'primary',
        title: mode === 'online' ? `Your Pilot (${primarySide})` : leftName,
        layout: 'dpad',
        buttons: [
          makeHoldButton(primarySide, 'up', 'Up', <AiOutlineArrowUp />, 'up'),
          makeHoldButton(primarySide, 'left', 'Left', <AiOutlineArrowLeft />, 'left'),
          makeHoldButton(primarySide, 'boost', 'Boost', <AiOutlineThunderbolt />, 'center'),
          makeHoldButton(primarySide, 'right', 'Right', <AiOutlineArrowRight />, 'right'),
          makeHoldButton(primarySide, 'down', 'Down', <AiOutlineArrowDown />, 'down'),
        ],
      },
    ];
    if (mode === 'offline') {
      sections.push({
        key: 'right',
        title: rightName,
        layout: 'dpad',
        buttons: [
          makeHoldButton('right', 'up', 'W', <AiOutlineArrowUp />, 'up'),
          makeHoldButton('right', 'left', 'A', <AiOutlineArrowLeft />, 'left'),
          makeHoldButton('right', 'boost', 'Boost', <AiOutlineThunderbolt />, 'center'),
          makeHoldButton('right', 'right', 'D', <AiOutlineArrowRight />, 'right'),
          makeHoldButton('right', 'down', 'S', <AiOutlineArrowDown />, 'down'),
        ],
      });
    }
    return sections;
  }, [controlledSide, leftName, mode, rightName]);

  const winnerName = viewState.winner === 'left' ? leftName : viewState.winner === 'right' ? rightName : null;
  const leftProgress = `${clamp((viewState.leftScore / viewState.targetScore) * 100, 0, 100)}%`;
  const rightProgress = `${clamp((viewState.rightScore / viewState.targetScore) * 100, 0, 100)}%`;

  return (
    <section className={classnames('heartstream-root', !enableAnimations && 'motion-off')}>
      <motion.div drag dragMomentum={false} className="room-floating-card heartstream-info-card">
        <div className="room-float-anchor">
          <AiOutlineInfoCircle /> {gameName}
        </div>
        <strong>Heartstream</strong>
        <span>{viewState.event}</span>
        <small>
          <AiOutlineWifi /> {mode === 'online' ? `${connectionStatus}${onlineSide ? ` / ${onlineSide}` : ''}` : mode.toUpperCase()}
        </small>
      </motion.div>

      <div className="heartstream-stage">
        <div className="heartstream-scorebar heartstream-scorebar-left">
          <span>{leftName}</span>
          <strong>{viewState.leftScore}</strong>
          <div><i style={{ width: leftProgress }} /></div>
        </div>
        <div className="heartstream-scorebar heartstream-scorebar-right">
          <span>{rightName}</span>
          <strong>{viewState.rightScore}</strong>
          <div><i style={{ width: rightProgress }} /></div>
        </div>
        <div ref={canvasHostRef} className="heartstream-canvas" />
        {viewState.phase === 'won' && winnerName ? (
          <div className="heartstream-victory">
            <AiFillHeart />
            <strong>{winnerName} wins the signal</strong>
            <span>That was dangerously cute.</span>
            <button type="button" onClick={resetMatch}>
              <AiOutlineReload /> Rematch
            </button>
          </div>
        ) : null}
      </div>

      <div className="heartstream-actions">
        <button type="button" onClick={onToggleMusic}>
          <AiOutlineSound /> {isMusicMuted ? 'Sound Off' : 'Sound On'}
        </button>
        <button type="button" onClick={resetMatch}>
          <AiOutlineReload /> Rematch
        </button>
        <button type="button" onClick={onLeave}>
          <AiOutlineRocket /> Leave
        </button>
      </div>

      <AdaptiveControllerOverlay
        title="Heartstream Controls"
        subtitle="Hold direction, boost through shards"
        sections={controllerSections}
        collapsedLabel="Heartstream controls"
        initialCollapsed={false}
      />
    </section>
  );
}
