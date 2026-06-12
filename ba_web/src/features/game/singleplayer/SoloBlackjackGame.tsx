'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import {
  AiOutlineArrowDown,
  AiOutlineDrag,
  AiOutlineInfoCircle,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineSound,
  AiOutlineStop,
} from 'react-icons/ai';
import { AdaptiveControllerOverlay, type ControllerSection } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type SoloBlackjackGameProps = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type PlayingCard = { id: string; rank: Rank; suit: Suit };
type HandOutcome = 'win' | 'loss' | 'push' | null;
type BlackjackPhase = 'player-turn' | 'dealer-turn' | 'round-over' | 'match-over';

type BlackjackState = {
  deck: PlayingCard[];
  playerHand: PlayingCard[];
  dealerHand: PlayingCard[];
  phase: BlackjackPhase;
  outcome: HandOutcome;
  playerWins: number;
  dealerWins: number;
  pushes: number;
  round: number;
  message: string;
};

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MATCH_TARGET = 5;

const shuffle = <T,>(items: T[]): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const createDeck = (): PlayingCard[] =>
  shuffle(
    SUITS.flatMap((suit) =>
      RANKS.map((rank) => ({
        id: `${rank}-${suit}`,
        rank,
        suit,
      }))
    )
  );

const getHandScore = (hand: PlayingCard[]) => {
  let score = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.rank === 'A') {
      score += 11;
      aces += 1;
    } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
      score += 10;
    } else {
      score += Number.parseInt(card.rank, 10);
    }
  });

  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }

  return score;
};

const finishRound = (
  state: BlackjackState,
  outcome: Exclude<HandOutcome, null>,
  message: string
): BlackjackState => {
  const playerWins = state.playerWins + (outcome === 'win' ? 1 : 0);
  const dealerWins = state.dealerWins + (outcome === 'loss' ? 1 : 0);
  const pushes = state.pushes + (outcome === 'push' ? 1 : 0);
  const isMatchOver = playerWins >= MATCH_TARGET || dealerWins >= MATCH_TARGET;

  return {
    ...state,
    playerWins,
    dealerWins,
    pushes,
    outcome,
    phase: isMatchOver ? 'match-over' : 'round-over',
    message: isMatchOver
      ? playerWins >= MATCH_TARGET
        ? `${message} You own the table.`
        : `${message} The dealer takes the match.`
      : message,
  };
};

const dealRound = (previous?: BlackjackState): BlackjackState => {
  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];
  const base: BlackjackState = {
    deck,
    playerHand,
    dealerHand,
    phase: 'player-turn',
    outcome: null,
    playerWins: previous?.playerWins ?? 0,
    dealerWins: previous?.dealerWins ?? 0,
    pushes: previous?.pushes ?? 0,
    round: previous ? previous.round + 1 : 1,
    message: 'Your move. Hit for another card or stand on this hand.',
  };
  const playerScore = getHandScore(playerHand);
  const dealerScore = getHandScore(dealerHand);

  if (playerScore === 21 && dealerScore === 21) {
    return finishRound(base, 'push', 'Both sides opened with blackjack. Push.');
  }
  if (playerScore === 21) {
    return finishRound(base, 'win', 'Natural blackjack. The hand is yours.');
  }
  if (dealerScore === 21) {
    return finishRound(base, 'loss', 'The dealer opened with blackjack.');
  }

  return base;
};

function SuitMark({ suit }: { suit: Suit }) {
  if (suit === 'clubs') return <>&clubs;</>;
  if (suit === 'diamonds') return <>&diams;</>;
  if (suit === 'hearts') return <>&hearts;</>;
  return <>&spades;</>;
}

function Card({ card, hidden = false }: { card: PlayingCard; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="blackjack-card blackjack-card-hidden" aria-label="Hidden dealer card">
        <span>BA</span>
      </div>
    );
  }

  const isRed = card.suit === 'diamonds' || card.suit === 'hearts';
  return (
    <div className={classnames('blackjack-card', isRed && 'blackjack-card-red')} aria-label={`${card.rank} of ${card.suit}`}>
      <span className="blackjack-card-corner">
        <strong>{card.rank}</strong>
        <SuitMark suit={card.suit} />
      </span>
      <span className="blackjack-card-suit"><SuitMark suit={card.suit} /></span>
    </div>
  );
}

export function SoloBlackjackGame({
  player,
  gameDefinitions,
  isMusicMuted,
  enableAnimations,
  onToggleMusic,
  onMatchComplete,
  onLeave,
}: SoloBlackjackGameProps) {
  const [state, setState] = useState<BlackjackState>(() => dealRound());
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const reportedResultRef = useRef<'win' | 'loss' | null>(null);
  const gameLabel = formatGameName('blackjack', gameDefinitions);
  const playerScore = getHandScore(state.playerHand);
  const dealerScore = getHandScore(state.dealerHand);
  const dealerVisibleScore =
    state.phase === 'player-turn' ? getHandScore(state.dealerHand.slice(0, 1)) : dealerScore;

  const hit = useCallback(() => {
    setState((current) => {
      if (current.phase !== 'player-turn') {
        return current;
      }

      const deck = [...current.deck];
      const nextCard = deck.pop();
      if (!nextCard) {
        return current;
      }

      const playerHand = [...current.playerHand, nextCard];
      const score = getHandScore(playerHand);
      const nextState = { ...current, deck, playerHand };

      if (score > 21) {
        return finishRound(nextState, 'loss', `Bust at ${score}. The dealer takes the hand.`);
      }
      if (score === 21) {
        return { ...nextState, phase: 'dealer-turn', message: 'Twenty-one. The dealer must answer.' };
      }

      return { ...nextState, message: `${score} on the table. Hit again or stand.` };
    });
  }, []);

  const stand = useCallback(() => {
    setState((current) =>
      current.phase === 'player-turn'
        ? { ...current, phase: 'dealer-turn', message: 'Standing. The dealer reveals the hole card.' }
        : current
    );
  }, []);

  const dealNext = useCallback(() => {
    reportedResultRef.current = null;
    setState((current) => (current.phase === 'match-over' ? dealRound() : dealRound(current)));
  }, []);

  useEffect(() => {
    if (state.phase !== 'dealer-turn') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== 'dealer-turn') {
          return current;
        }

        const currentDealerScore = getHandScore(current.dealerHand);
        if (currentDealerScore < 17) {
          const deck = [...current.deck];
          const nextCard = deck.pop();
          if (!nextCard) {
            return current;
          }

          const dealerHand = [...current.dealerHand, nextCard];
          const nextDealerScore = getHandScore(dealerHand);
          const nextState = { ...current, deck, dealerHand };
          return nextDealerScore > 21
            ? finishRound(nextState, 'win', `Dealer busts at ${nextDealerScore}. You win the hand.`)
            : { ...nextState, message: `Dealer draws to ${nextDealerScore}.` };
        }

        const currentPlayerScore = getHandScore(current.playerHand);
        if (currentDealerScore > currentPlayerScore) {
          return finishRound(current, 'loss', `Dealer wins ${currentDealerScore} to ${currentPlayerScore}.`);
        }
        if (currentDealerScore < currentPlayerScore) {
          return finishRound(current, 'win', `You win ${currentPlayerScore} to ${currentDealerScore}.`);
        }
        return finishRound(current, 'push', `Both hands finish on ${currentPlayerScore}. Push.`);
      });
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [state.dealerHand, state.phase]);

  useEffect(() => {
    if (state.phase !== 'match-over') {
      return;
    }

    const outcome = state.playerWins >= MATCH_TARGET ? 'win' : 'loss';
    if (reportedResultRef.current === outcome) {
      return;
    }

    reportedResultRef.current = outcome;
    onMatchComplete({
      mode: 'cpu',
      gameType: 'blackjack',
      outcome,
      opponent: 'Arena Dealer',
    });
  }, [onMatchComplete, state.phase, state.playerWins]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key === 'h' || event.code === 'Space') && state.phase === 'player-turn') {
        event.preventDefault();
        if (!event.repeat) hit();
      } else if (key === 's' && state.phase === 'player-turn') {
        event.preventDefault();
        stand();
      } else if (key === 'r' && (state.phase === 'round-over' || state.phase === 'match-over')) {
        event.preventDefault();
        dealNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dealNext, hit, stand, state.phase]);

  const controllerSections = useMemo<ControllerSection[]>(
    () => [
      {
        key: 'table-actions',
        title: 'Table Actions',
        layout: 'row',
        buttons: [
          {
            key: 'hit',
            label: 'Hit',
            icon: <AiOutlinePlayCircle />,
            onClick: hit,
            disabled: state.phase !== 'player-turn',
          },
          {
            key: 'stand',
            label: 'Stand',
            icon: <AiOutlineStop />,
            onClick: stand,
            disabled: state.phase !== 'player-turn',
          },
          {
            key: 'deal',
            label: state.phase === 'match-over' ? 'New Match' : 'Deal',
            icon: <AiOutlineReload />,
            onClick: dealNext,
            disabled: state.phase === 'player-turn' || state.phase === 'dealer-turn',
          },
        ],
      },
    ],
    [dealNext, hit, stand, state.phase]
  );

  const statusLabel =
    state.phase === 'player-turn'
      ? 'Your Turn'
      : state.phase === 'dealer-turn'
        ? 'Dealer Turn'
        : state.phase === 'match-over'
          ? state.playerWins >= MATCH_TARGET
            ? 'Match Won'
            : 'Match Lost'
          : state.outcome === 'win'
            ? 'Hand Won'
            : state.outcome === 'loss'
              ? 'Hand Lost'
              : 'Push';

  return (
    <>
      <div>
        <h1 className="game-screen-title">{gameLabel}</h1>
      </div>

      <AdaptiveControllerOverlay
        title="Blackjack Controller"
        subtitle="Hit, stand, and deal from the adaptive controls"
        sections={controllerSections}
      />

      <motion.div
        drag
        dragMomentum={false}
        className="room-float-drag-root"
        animate={enableAnimations ? { y: [6, -6, 6], rotate: [0, 0.4, 0, -0.4, 0] } : { y: 0, rotate: 0, skewX: 0, skewY: 0 }}
        transition={enableAnimations ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
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
              <AiOutlineInfoCircle />
            </button>
          ) : (
            <>
              <div className="room-float-header">
                <span className="room-float-anchor"><AiOutlineDrag /> drag</span>
                <span className="room-float-title"><AiOutlineInfoCircle className="room-float-title-icon" /> {gameLabel} Solo</span>
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
                <div className="solo-float-stat"><span>Player</span><strong>{player.name}</strong></div>
                <div className="solo-float-stat"><span>Status</span><strong>{statusLabel}</strong></div>
                <div className="solo-float-stat"><span>Score</span><strong>{state.playerWins} - {state.dealerWins}</strong></div>
                <div className="solo-float-stat"><span>Hand</span><strong>{playerScore}</strong></div>
                <div className="solo-float-stat"><span>Pushes</span><strong>{state.pushes}</strong></div>
                <div className="solo-float-stat"><span>Round</span><strong>{state.round}</strong></div>
              </div>

              <div className="solo-float-actions">
                <button className={classnames('room-float-action-btn')} type="button" onClick={onToggleMusic}>
                  <AiOutlineSound /> {isMusicMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className={classnames('room-float-action-btn', 'room-float-action-btn-danger')} type="button" onClick={onLeave}>
                  Leave
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <section className="blackjack-shell">
        <div className="blackjack-match-score" aria-label={`Player ${state.playerWins}, dealer ${state.dealerWins}`}>
          <span>{player.name}</span>
          <strong>{state.playerWins}</strong>
          <i>first to {MATCH_TARGET}</i>
          <strong>{state.dealerWins}</strong>
          <span>Dealer</span>
        </div>

        <div className="blackjack-table">
          <div className="blackjack-hand-zone blackjack-dealer-zone">
            <div className="blackjack-hand-heading">
              <span>Dealer</span>
              <strong>{state.phase === 'player-turn' ? `${dealerVisibleScore} + ?` : dealerScore}</strong>
            </div>
            <div className="blackjack-hand">
              {state.dealerHand.map((card, index) => (
                <Card key={card.id} card={card} hidden={index === 1 && state.phase === 'player-turn'} />
              ))}
            </div>
          </div>

          <div className={classnames('blackjack-table-message', state.outcome && `blackjack-table-message-${state.outcome}`)}>
            <strong>{statusLabel}</strong>
            <span>{state.message}</span>
          </div>

          <div className="blackjack-hand-zone blackjack-player-zone">
            <div className="blackjack-hand">
              {state.playerHand.map((card) => <Card key={card.id} card={card} />)}
            </div>
            <div className="blackjack-hand-heading">
              <span>{player.name}</span>
              <strong>{playerScore}</strong>
            </div>
          </div>
        </div>

        <div className="blackjack-actions">
          <button type="button" className="blackjack-action blackjack-action-hit" onClick={hit} disabled={state.phase !== 'player-turn'}>
            <AiOutlinePlayCircle /> Hit
          </button>
          <button type="button" className="blackjack-action blackjack-action-stand" onClick={stand} disabled={state.phase !== 'player-turn'}>
            <AiOutlineStop /> Stand
          </button>
          <button
            type="button"
            className="blackjack-action blackjack-action-deal"
            onClick={dealNext}
            disabled={state.phase === 'player-turn' || state.phase === 'dealer-turn'}
          >
            <AiOutlineReload /> {state.phase === 'match-over' ? 'New Match' : 'Deal Next'}
          </button>
        </div>
      </section>
    </>
  );
}
