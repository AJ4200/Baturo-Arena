'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, MatchResultEvent, PlayerProfile } from '@/types/game';

type Props = {
  player: PlayerProfile;
  gameDefinitions: GameDefinition[];
  isMusicMuted: boolean;
  enableAnimations: boolean;
  onToggleMusic: () => void;
  onToggleAnimations: () => void;
  onMatchComplete: (result: MatchResultEvent) => void;
  onLeave: () => void;
};

export function SoloBrickBreakerGame({ player, gameDefinitions, onMatchComplete }: Props) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const reported = useRef(false);

  useEffect(() => {
    if (lives <= 0 && !reported.current) {
      reported.current = true;
      onMatchComplete({ mode: 'cpu', gameType: 'brickbreaker', outcome: score >= 120 ? 'win' : 'loss', opponent: 'Arena Bricks' });
    }
  }, [lives, onMatchComplete, score]);

  const gameLabel = formatGameName('brickbreaker', gameDefinitions);

  return (
    <section>
      <h1 className="game-screen-title">{gameLabel}</h1>
      <AdaptiveControllerOverlay
        title="Retro Solo Run"
        subtitle="Tap bricks to break • every clear increases level"
        buttons={[]}
      />
      <div className="lobby-card mt-6">
        <p>Player: {player.name}</p>
        <p>Score: {score} • Lives: {lives} • Level: {level}</p>
        <div className="choose-game-dot-row" style={{ gap: 12 }}>
          {Array.from({ length: 12 }).map((_, idx) => (
            <button
              key={idx}
              className="choose-game-dot"
              style={{ width: 30, height: 20, borderRadius: 4 }}
              onClick={() => {
                setScore((v) => v + 10 * level);
                if ((idx + score) % 5 === 0) setLevel((v) => Math.min(6, v + 1));
              }}
            />
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button className="lobby-back" type="button" onClick={() => setLives((v) => Math.max(0, v - 1))}>Miss Ball</button>
          <button className="choose-game-play-now-btn" type="button" onClick={() => { setScore(0); setLives(3); setLevel(1); reported.current = false; }}>Restart</button>
        </div>
      </div>
    </section>
  );
}
