'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import {
  AiOutlineArrowDown,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineArrowUp,
  AiOutlineCheckCircle,
  AiOutlineDelete,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlusCircle,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type {
  GameDefinition,
  MatchResultEvent,
  PlayerProfile,
  VoxelBlock,
  VoxelBlockType,
  VoxelYardState,
} from '@/types/game';

type SoloVoxelYardGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type FaceDirection = {
  x: number;
  y: number;
  z: number;
};

const BUILD_TARGET = 28;
const BEST_SCORE_STORAGE_KEY = 'baturo_voxel_yard_best_score';
const YARD_LIMIT = 5;
const MAX_BLOCK_HEIGHT = 6;

const BLOCK_LABELS: Record<VoxelBlockType, string> = {
  grass: 'Grass',
  soil: 'Soil',
  stone: 'Stone',
  wood: 'Wood',
  glass: 'Glass',
};

const BLOCK_COLORS: Record<VoxelBlockType, number> = {
  grass: 0x66b857,
  soil: 0x8a5a34,
  stone: 0x8f98a4,
  wood: 0xb87838,
  glass: 0x8fd6ff,
};

const BLOCK_TYPES: VoxelBlockType[] = ['grass', 'soil', 'stone', 'wood', 'glass'];

const positionKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`;

const createBlock = (x: number, y: number, z: number, type: VoxelBlockType): VoxelBlock => ({
  id: positionKey(x, y, z),
  x,
  y,
  z,
  type,
});

const createInitialBlocks = (): VoxelBlock[] => {
  const blocks: VoxelBlock[] = [];

  for (let x = -4; x <= 4; x += 1) {
    for (let z = -4; z <= 4; z += 1) {
      const edge = Math.abs(x) === 4 || Math.abs(z) === 4;
      blocks.push(createBlock(x, 0, z, edge ? 'soil' : 'grass'));
    }
  }

  blocks.push(createBlock(-2, 1, -1, 'wood'));
  blocks.push(createBlock(-2, 2, -1, 'wood'));
  blocks.push(createBlock(2, 1, 1, 'stone'));
  blocks.push(createBlock(2, 2, 1, 'stone'));
  blocks.push(createBlock(1, 1, -2, 'glass'));
  return blocks;
};

const createInitialState = (): VoxelYardState => ({
  blocks: createInitialBlocks(),
  selectedBlockId: positionKey(0, 0, 0),
  selectedType: 'grass',
  score: 0,
  placed: 0,
  removed: 0,
  status: 'building',
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getNextType = (currentType: VoxelBlockType, direction: 1 | -1): VoxelBlockType => {
  const index = BLOCK_TYPES.indexOf(currentType);
  const nextIndex = (index + direction + BLOCK_TYPES.length) % BLOCK_TYPES.length;
  return BLOCK_TYPES[nextIndex];
};

export function SoloVoxelYardGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloVoxelYardGameProps) {
  const [state, setState] = useState<VoxelYardState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [cameraYaw, setCameraYaw] = useState(-42);
  const [cameraDistance, setCameraDistance] = useState(14);
  const [selectedFace, setSelectedFace] = useState<FaceDirection>({ x: 0, y: 1, z: 0 });
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const blockGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const lastReportedOutcomeRef = useRef(false);
  const gameLabel = formatGameName('voxel-yard', gameDefinitions);

  const selectedBlock = useMemo(
    () => state.blocks.find((block) => block.id === state.selectedBlockId) || null,
    [state.blocks, state.selectedBlockId]
  );
  const buildProgress = Math.min(BUILD_TARGET, state.placed);
  const statusLabel = state.status === 'complete' ? 'Build Complete' : 'Sandbox Active';

  useEffect(() => {
    const storedBest =
      typeof window !== 'undefined'
        ? Number.parseInt(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0', 10)
        : 0;
    setBestScore(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    if (state.score <= bestScore) {
      return;
    }

    setBestScore(state.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.score));
    }
  }, [bestScore, state.score]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdde7ee, 18, 34);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'voxel-yard-canvas';

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x4b5b65, 1.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(7, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    scene.add(sun);

    const grid = new THREE.GridHelper(12, 12, 0x2f3a42, 0x9aa5aa);
    grid.position.y = -0.51;
    scene.add(grid);

    const blockGroup = new THREE.Group();
    scene.add(blockGroup);

    cameraRef.current = camera;
    blockGroupRef.current = blockGroup;

    const resize = () => {
      const bounds = mount.getBoundingClientRect();
      const width = Math.max(320, Math.round(bounds.width));
      const height = Math.max(260, Math.round(bounds.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointerRef.current.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      raycasterRef.current.setFromCamera(pointerRef.current, camera);

      const intersects = raycasterRef.current.intersectObjects(blockGroup.children, false);
      if (intersects.length === 0) {
        setState((current) => ({ ...current, selectedBlockId: null }));
        return;
      }

      const hit = intersects[0];
      const blockId = String(hit.object.userData.blockId || '');
      if (!blockId) {
        return;
      }

      if (hit.face) {
        const face = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        setSelectedFace({
          x: Math.round(face.x),
          y: Math.round(face.y),
          z: Math.round(face.z),
        });
      }

      setState((current) => ({ ...current, selectedBlockId: blockId }));
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    const animate = () => {
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
      mount.innerHTML = '';
      scene.clear();
      cameraRef.current = null;
      blockGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const yaw = (cameraYaw * Math.PI) / 180;
    camera.position.set(
      Math.sin(yaw) * cameraDistance,
      cameraDistance * 0.72,
      Math.cos(yaw) * cameraDistance
    );
    camera.lookAt(0, 1.3, 0);
  }, [cameraDistance, cameraYaw]);

  useEffect(() => {
    const group = blockGroupRef.current;
    if (!group) {
      return;
    }

    while (group.children.length > 0) {
      const child = group.children.pop();
      if (!child) {
        continue;
      }
      if ('geometry' in child && child.geometry instanceof THREE.BufferGeometry) {
        child.geometry.dispose();
      }
      if ('material' in child) {
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else if (material instanceof THREE.Material) {
          material.dispose();
        }
      }
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = new Map<VoxelBlockType, THREE.MeshStandardMaterial>();
    BLOCK_TYPES.forEach((type) => {
      materials.set(
        type,
        new THREE.MeshStandardMaterial({
          color: BLOCK_COLORS[type],
          roughness: type === 'glass' ? 0.18 : 0.72,
          metalness: 0.02,
          transparent: type === 'glass',
          opacity: type === 'glass' ? 0.58 : 1,
        })
      );
    });

    state.blocks.forEach((block) => {
      const material = materials.get(block.type);
      if (!material) {
        return;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(block.x, block.y, block.z);
      mesh.castShadow = block.y > 0;
      mesh.receiveShadow = true;
      mesh.userData.blockId = block.id;
      group.add(mesh);

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: block.id === state.selectedBlockId ? 0xffffff : 0x17202a,
          transparent: true,
          opacity: block.id === state.selectedBlockId ? 0.92 : 0.16,
        })
      );
      edge.position.copy(mesh.position);
      edge.userData.blockId = block.id;
      group.add(edge);
    });

    if (state.selectedBlockId) {
      const block = state.blocks.find((entry) => entry.id === state.selectedBlockId);
      if (block) {
        const selectedGeometry = new THREE.BoxGeometry(1.08, 1.08, 1.08);
        const selectedFrame = new THREE.LineSegments(
          new THREE.EdgesGeometry(selectedGeometry),
          new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        );
        selectedFrame.position.set(block.x, block.y, block.z);
        selectedFrame.userData.blockId = block.id;
        group.add(selectedFrame);
      }
    }

    return () => {
      materials.forEach((material) => material.dispose());
      geometry.dispose();
    };
  }, [state.blocks, state.selectedBlockId]);

  const handleRestart = useCallback(() => {
    lastReportedOutcomeRef.current = false;
    setSelectedFace({ x: 0, y: 1, z: 0 });
    setState(createInitialState());
  }, []);

  const selectType = useCallback((type: VoxelBlockType) => {
    setState((current) => ({ ...current, selectedType: type }));
  }, []);

  const cycleType = useCallback((direction: 1 | -1) => {
    setState((current) => ({ ...current, selectedType: getNextType(current.selectedType, direction) }));
  }, []);

  const handlePlaceBlock = useCallback(() => {
    setState((current) => {
      const selected = current.blocks.find((block) => block.id === current.selectedBlockId);
      if (!selected || current.status === 'complete') {
        return current;
      }

      const nextX = selected.x + selectedFace.x;
      const nextY = selected.y + selectedFace.y;
      const nextZ = selected.z + selectedFace.z;
      if (
        nextY < 0 ||
        nextY > MAX_BLOCK_HEIGHT ||
        Math.abs(nextX) > YARD_LIMIT ||
        Math.abs(nextZ) > YARD_LIMIT ||
        current.blocks.some((block) => block.x === nextX && block.y === nextY && block.z === nextZ)
      ) {
        return current;
      }

      const placed = current.placed + 1;
      const nextBlock = createBlock(nextX, nextY, nextZ, current.selectedType);
      return {
        ...current,
        blocks: [...current.blocks, nextBlock],
        selectedBlockId: nextBlock.id,
        score: current.score + 8 + Math.max(0, nextY),
        placed,
        status: placed >= BUILD_TARGET ? 'complete' : 'building',
      };
    });
  }, [selectedFace]);

  const handleBreakBlock = useCallback(() => {
    setState((current) => {
      const selected = current.blocks.find((block) => block.id === current.selectedBlockId);
      if (!selected || selected.y === 0 || current.status === 'complete') {
        return current;
      }

      const nextBlocks = current.blocks.filter((block) => block.id !== selected.id);
      return {
        ...current,
        blocks: nextBlocks,
        selectedBlockId: positionKey(selected.x, selected.y - 1, selected.z),
        score: current.score + 3,
        removed: current.removed + 1,
      };
    });
  }, []);

  const rotateCamera = useCallback((direction: 1 | -1) => {
    setCameraYaw((current) => current + direction * 18);
  }, []);

  const zoomCamera = useCallback((direction: 1 | -1) => {
    setCameraDistance((current) => clamp(current + direction * 1.2, 9, 21));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'q') {
        event.preventDefault();
        rotateCamera(-1);
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        rotateCamera(1);
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        zoomCamera(1);
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        zoomCamera(-1);
        return;
      }
      if (key === ' ' || key === 'enter') {
        event.preventDefault();
        handlePlaceBlock();
        return;
      }
      if (key === 'backspace' || key === 'delete') {
        event.preventDefault();
        handleBreakBlock();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBreakBlock, handlePlaceBlock, handleRestart, rotateCamera, zoomCamera]);

  useEffect(() => {
    if (state.status === 'complete' && !lastReportedOutcomeRef.current) {
      lastReportedOutcomeRef.current = true;
      onMatchComplete({
        mode: 'cpu',
        gameType: 'voxel-yard',
        outcome: 'win',
        opponent: 'Build Target',
      });
    }
  }, [onMatchComplete, state.status]);

  const controllerSections = [
    {
      key: 'camera',
      title: 'Camera',
      layout: 'dpad' as const,
      buttons: [
        { key: 'zoom-in', label: 'Zoom In', icon: <AiOutlineArrowUp />, slot: 'up' as const, onClick: () => zoomCamera(-1) },
        { key: 'zoom-out', label: 'Zoom Out', icon: <AiOutlineArrowDown />, slot: 'down' as const, onClick: () => zoomCamera(1) },
        { key: 'rotate-left', label: 'Rotate Left', icon: <AiOutlineArrowLeft />, slot: 'left' as const, onClick: () => rotateCamera(-1) },
        { key: 'rotate-right', label: 'Rotate Right', icon: <AiOutlineArrowRight />, slot: 'right' as const, onClick: () => rotateCamera(1) },
      ],
    },
    {
      key: 'blocks',
      title: 'Blocks',
      layout: 'row' as const,
      buttons: [
        { key: 'place', label: 'Place', icon: <AiOutlinePlusCircle />, onClick: handlePlaceBlock, disabled: state.status === 'complete' },
        { key: 'break', label: 'Break', icon: <AiOutlineDelete />, onClick: handleBreakBlock, disabled: !selectedBlock || selectedBlock.y === 0 || state.status === 'complete' },
        { key: 'type', label: BLOCK_LABELS[state.selectedType], icon: <AiOutlineCheckCircle />, onClick: () => cycleType(1) },
        { key: 'restart', label: 'Restart', icon: <AiOutlineReload />, onClick: handleRestart },
      ],
    },
  ];

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay sections={controllerSections} title="Voxel Yard" subtitle="Select a face, place blocks, build upward" />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [5, -5, 5] } : undefined}
        transition={enableAnimations ? { duration: 4.1, repeat: Infinity } : undefined}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button className="room-float-collapsed-center" type="button" onClick={() => setIsInfoCardCollapsed(false)} aria-label="Expand game info">
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo Build</span>
                <button className="room-float-toggle-btn" type="button" onClick={() => setIsInfoCardCollapsed(true)} aria-label="Collapse game info">
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="room-score-strip">
                <span className="room-float-line"><AiOutlineCheckCircle /> {statusLabel}</span>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.score}</strong></div>
                <div className="solo-float-stat"><span>Best</span><strong>{bestScore}</strong></div>
                <div className="solo-float-stat"><span>Placed</span><strong>{buildProgress} / {BUILD_TARGET}</strong></div>
                <div className="solo-float-stat"><span>Blocks</span><strong>{state.blocks.length}</strong></div>
                <div className="solo-float-stat"><span>Hotbar</span><strong>{BLOCK_LABELS[state.selectedType]}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className="room-float-action-btn" type="button" onClick={handlePlaceBlock} disabled={state.status === 'complete'}>
                  <AiOutlinePlusCircle /> Place
                </button>
                <button className="room-float-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Reset
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

      <section className="voxel-yard-shell">
        <div className="voxel-yard-hud">
          <div className="voxel-yard-hud-item"><span>Progress</span><strong>{buildProgress} / {BUILD_TARGET}</strong></div>
          <div className="voxel-yard-hud-item"><span>Score</span><strong>{state.score}</strong></div>
          <div className="voxel-yard-hud-item"><span>Selected</span><strong>{selectedBlock ? `${selectedBlock.x},${selectedBlock.y},${selectedBlock.z}` : 'None'}</strong></div>
          <div className="voxel-yard-hud-item"><span>Camera</span><strong>{Math.round(cameraDistance)} range</strong></div>
        </div>

        <div className="voxel-yard-stage-wrap">
          <div ref={mountRef} className="voxel-yard-stage" aria-label="Voxel Yard 3D sandbox" />
          {state.status === 'complete' ? (
            <div className="voxel-yard-overlay">
              <div className="voxel-yard-message">
                <span className="voxel-yard-status-pill">Build Complete</span>
                <h2>Yard target reached</h2>
                <p>Final score {state.score}. Reset the plot to start a fresh structure.</p>
                <button className="voxel-yard-action-btn" type="button" onClick={handleRestart}>
                  <AiOutlineReload /> Build Again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="voxel-yard-hotbar" role="toolbar" aria-label="Voxel block hotbar">
          <button className="voxel-yard-hotbar-step" type="button" onClick={() => cycleType(-1)} aria-label="Previous block type">
            <AiOutlineArrowLeft />
          </button>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              className={`voxel-yard-hotbar-btn${state.selectedType === type ? ' voxel-yard-hotbar-btn-active' : ''}`}
              type="button"
              onClick={() => selectType(type)}
              aria-label={`Select ${BLOCK_LABELS[type]}`}
            >
              <span className={`voxel-yard-swatch voxel-yard-swatch-${type}`} />
              <strong>{BLOCK_LABELS[type]}</strong>
            </button>
          ))}
          <button className="voxel-yard-hotbar-step" type="button" onClick={() => cycleType(1)} aria-label="Next block type">
            <AiOutlineArrowRight />
          </button>
        </div>

        <div className="voxel-yard-actions">
          <button className="voxel-yard-action-btn" type="button" onClick={handlePlaceBlock} disabled={!selectedBlock || state.status === 'complete'}>
            <AiOutlinePlusCircle /> Place Block
          </button>
          <button className="voxel-yard-action-btn" type="button" onClick={handleBreakBlock} disabled={!selectedBlock || selectedBlock.y === 0 || state.status === 'complete'}>
            <AiOutlineDelete /> Break Block
          </button>
          <button className="voxel-yard-action-btn" type="button" onClick={() => rotateCamera(-1)}>
            <AiOutlineArrowLeft /> Rotate
          </button>
          <button className="voxel-yard-action-btn" type="button" onClick={() => rotateCamera(1)}>
            Rotate <AiOutlineArrowRight />
          </button>
        </div>

        <p className="voxel-yard-message-inline">
          Tap a block face, then place beside it. Ground blocks anchor the plot and cannot be broken.
        </p>
      </section>
    </>
  );
}
