'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AdaptiveControllerOverlay } from '@/features/game/AdaptiveControllerOverlay';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameMode, MatchResultEvent, PlayerProfile } from '@/types/game';

type Props = {
  player: PlayerProfile;
  mode: GameMode;
  gameDefinitions: GameDefinition[];
  onMatchComplete: (result: MatchResultEvent) => void;
};

export function AirHockeyArenaGame({ player, mode, gameDefinitions, onMatchComplete }: Props) {
  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);
  const [round, setRound] = useState(1);
  const reportedRef = useRef(false);

  useEffect(() => {
    const finished = leftScore >= 7 || rightScore >= 7;
    if (!finished || reportedRef.current) return;
    reportedRef.current = true;
    onMatchComplete({ mode, gameType: 'air-hockey', outcome: leftScore > rightScore ? 'win' : 'loss', opponent: 'Player 2' });
  }, [leftScore, mode, onMatchComplete, rightScore]);

  const label = formatGameName('air-hockey', gameDefinitions);

  return (
    <section>
      <h1 className="game-screen-title">{label}</h1>
      <AdaptiveControllerOverlay title="Local Duel" subtitle="First to 7 wins • physics-lite puck battles" buttons={[]} />
      <div className="lobby-card mt-6">
        <p>Round {round} • {player.name} {leftScore} : {rightScore} Rival</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button className="choose-game-play-now-btn" type="button" onClick={() => { setLeftScore((v) => v + 1); setRound((v) => v + 1); }}>Goal Left</button>
          <button className="choose-game-play-now-btn" type="button" onClick={() => { setRightScore((v) => v + 1); setRound((v) => v + 1); }}>Goal Right</button>
        </div>
      </div>
    </section>
  );
}
