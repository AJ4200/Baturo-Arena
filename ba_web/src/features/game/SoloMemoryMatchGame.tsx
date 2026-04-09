'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineDrag,
  AiOutlineFlag,
  AiOutlineReload,
  AiOutlineSound,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloMemoryMatchGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type MemoryCard = {
  id: number;
  value: string;
  isFaceUp: boolean;
  isMatched: boolean;
};

type MemoryState = {
  cards: MemoryCard[];
  revealed: number[];
  matchedPairs: number;
  moves: number;
  status: 'ready' | 'playing' | 'won' | 'lost';
  startedAt: number | null;
};

const CARD_VALUES = ['NOVA', 'COMET', 'AURA', 'PULSE', 'QUARK', 'WAVE', 'EMBER', 'DRIFT'];
const TOTAL_PAIRS = CARD_VALUES.length;

const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const createDeck = (): MemoryCard[] => {
  const values = shuffle([...CARD_VALUES, ...CARD_VALUES]);
  return values.map((value, index) => ({
    id: index,
    value,
    isFaceUp: false,
    isMatched: false,
  }));
};

const createInitialState = (): MemoryState => ({
  cards: createDeck(),
  revealed: [],
  matchedPairs: 0,
  moves: 0,
  status: 'ready',
  startedAt: null,
});

export function SoloMemoryMatchGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onToggleAnimations,
  onMatchComplete,
  onLeave,
}: SoloMemoryMatchGameProps) {
  const [state, setState] = useState<MemoryState>(() => createInitialState());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const mismatchTimeoutRef = useRef<number | null>(null);
  const lastReportedOutcomeRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('memory-match', gameDefinitions);

  const clearMismatchTimeout = useCallback(() => {
    if (mismatchTimeoutRef.current !== null) {
      window.clearTimeout(mismatchTimeoutRef.current);
      mismatchTimeoutRef.current = null;
    }
  }, []);

  const handleCardSelect = useCallback((index: number) => {
    setState((currentState) => {
      if (currentState.status === 'won' || currentState.status === 'lost') {
        return currentState;
      }

      if (currentState.revealed.length >= 2) {
        return currentState;
      }

      const targetCard = currentState.cards[index];
      if (!targetCard || targetCard.isFaceUp || targetCard.isMatched) {
        return currentState;
      }

      const nextCards = [...currentState.cards];
      nextCards[index] = {
        ...targetCard,
        isFaceUp: true,
      };

      return {
        ...currentState,
        cards: nextCards,
        revealed: [...currentState.revealed, index],
        status: currentState.status === 'ready' ? 'playing' : currentState.status,
        startedAt: currentState.startedAt ?? Date.now(),
      };
    });
  }, []);

  const handleNewBoard = useCallback(() => {
    clearMismatchTimeout();
    lastReportedOutcomeRef.current = null;
    setElapsedSeconds(0);
    setState(createInitialState());
  }, [clearMismatchTimeout]);

  const handleGiveUp = useCallback(() => {
    clearMismatchTimeout();
    setState((currentState) => {
      if (currentState.status === 'won' || currentState.status === 'lost') {
        return currentState;
      }

      return {
        ...currentState,
        cards: currentState.cards.map((card) => ({
          ...card,
          isFaceUp: true,
        })),
        revealed: [],
        status: 'lost',
      };
    });
  }, [clearMismatchTimeout]);

  useEffect(() => {
    return () => {
      clearMismatchTimeout();
    };
  }, [clearMismatchTimeout]);

  useEffect(() => {
    if (state.revealed.length !== 2) {
      return;
    }

    const [firstIndex, secondIndex] = state.revealed;
    const firstCard = state.cards[firstIndex];
    const secondCard = state.cards[secondIndex];
    if (!firstCard || !secondCard) {
      return;
    }

    if (firstCard.value === secondCard.value) {
      setState((currentState) => {
        if (currentState.revealed.length !== 2) {
          return currentState;
        }

        const [leftIndex, rightIndex] = currentState.revealed;
        const nextCards = [...currentState.cards];
        nextCards[leftIndex] = {
          ...nextCards[leftIndex],
          isMatched: true,
        };
        nextCards[rightIndex] = {
          ...nextCards[rightIndex],
          isMatched: true,
        };

        const matchedPairs = currentState.matchedPairs + 1;
        return {
          ...currentState,
          cards: nextCards,
          matchedPairs,
          moves: currentState.moves + 1,
          revealed: [],
          status: matchedPairs >= TOTAL_PAIRS ? 'won' : 'playing',
        };
      });
      return;
    }

    mismatchTimeoutRef.current = window.setTimeout(() => {
      setState((currentState) => {
        if (currentState.revealed.length !== 2) {
          return currentState;
        }

        const [leftIndex, rightIndex] = currentState.revealed;
        const nextCards = [...currentState.cards];
        nextCards[leftIndex] = {
          ...nextCards[leftIndex],
          isFaceUp: false,
        };
        nextCards[rightIndex] = {
          ...nextCards[rightIndex],
          isFaceUp: false,
        };

        return {
          ...currentState,
          cards: nextCards,
          moves: currentState.moves + 1,
          revealed: [],
        };
      });
      mismatchTimeoutRef.current = null;
    }, 700);

    return () => {
      clearMismatchTimeout();
    };
  }, [clearMismatchTimeout, state.cards, state.revealed]);

  useEffect(() => {
    if (state.status !== 'playing' || state.startedAt === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - state.startedAt!) / 1000)));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.startedAt, state.status]);

  useEffect(() => {
    if (state.status === 'won' && lastReportedOutcomeRef.current !== 'win') {
      lastReportedOutcomeRef.current = 'win';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'memory-match',
        outcome: 'win',
        opponent: 'Memory Deck',
      });
      return;
    }

    if (state.status === 'lost' && lastReportedOutcomeRef.current !== 'loss') {
      lastReportedOutcomeRef.current = 'loss';
      onMatchComplete({
        mode: 'cpu',
        gameType: 'memory-match',
        outcome: 'loss',
        opponent: 'Memory Deck',
      });
    }
  }, [onMatchComplete, state.status]);

  const pairsLeft = TOTAL_PAIRS - state.matchedPairs;
  const controllerButtons = [
    { key: 'new', label: 'New Deck', icon: <AiOutlineReload />, onClick: handleNewBoard },
    { key: 'giveup', label: 'Give Up', icon: <AiOutlineFlag />, onClick: handleGiveUp },
  ];
  const controllerSections = [
    {
      key: 'deck-actions',
      title: 'Deck Actions',
      layout: 'row' as const,
      buttons: controllerButtons,
    },
  ];

  const accuracy = useMemo(() => {
    if (state.moves === 0) {
      return 100;
    }
    return Math.round((state.matchedPairs / state.moves) * 100);
  }, [state.matchedPairs, state.moves]);
  const runStatus = state.status === 'ready' ? 'Ready' : state.status.toUpperCase();

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Memory Match Controller"
        subtitle="Manage deck actions from the adaptive controls"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className={`room-float-card solo-room-float-card${isInfoCardCollapsed ? ' room-float-card-collapsed' : ''}`}>
          {isInfoCardCollapsed ? (
            <button
              className="room-float-collapsed-center"
              type="button"
              onClick={() => setIsInfoCardCollapsed(false)}
              aria-label="Expand game info"
              title="Expand game info"
            >
              <AiOutlineArrowUp />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor">
                  <AiOutlineDrag /> drag
                </span>
                <span className="room-float-title">{gameLabel} Solo</span>
                <button
                  className="room-float-toggle-btn"
                  type="button"
                  onClick={() => setIsInfoCardCollapsed(true)}
                  aria-label="Collapse game info"
                  title="Collapse game info"
                >
                  <AiOutlineArrowDown />
                </button>
              </div>

              <div className="solo-float-stats">
                <div className="solo-float-stat">
                  <span>Player</span>
                  <strong>{player.name}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Status</span>
                  <strong>{runStatus}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Moves</span>
                  <strong>{state.moves}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Pairs Left</span>
                  <strong>{pairsLeft}</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Accuracy</span>
                  <strong>{accuracy}%</strong>
                </div>
                <div className="solo-float-stat">
                  <span>Time</span>
                  <strong>{elapsedSeconds}s</strong>
                </div>
              </div>

              <div className="solo-float-actions">
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleAnimations}>
                  Motion {enableAnimations ? 'On' : 'Off'}
                </button>
                <button className={classnames('room-float-action-btn', 'room-float-action-btn-danger')} type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="solo-memory-shell">
        <div className="solo-memory-board" role="grid" aria-label="Memory Match board">
          {state.cards.map((card, index) => {
            const isVisible = card.isFaceUp || card.isMatched || state.status === 'lost';
            return (
              <button
                key={card.id}
                type="button"
                role="gridcell"
                className={classnames(
                  'solo-memory-card',
                  isVisible && 'solo-memory-card-visible',
                  card.isMatched && 'solo-memory-card-matched'
                )}
                onClick={() => handleCardSelect(index)}
                disabled={
                  state.status === 'won' ||
                  state.status === 'lost' ||
                  card.isMatched ||
                  card.isFaceUp ||
                  state.revealed.length >= 2
                }
              >
                <span className="solo-memory-card-token">{isVisible ? card.value : 'PAIR'}</span>
              </button>
            );
          })}
        </div>

        <p className="solo-memory-message">
          {state.status === 'won'
            ? `Deck cleared in ${state.moves} moves.`
            : state.status === 'lost'
              ? 'Board revealed. Start a new deck when ready.'
              : state.revealed.length === 2
                ? 'Checking cards...'
                : 'Flip two cards to find a matching pair.'}
        </p>
      </section>
    </>
  );
}
