// components/game/PlayerO.tsx
import classnames from "classnames";
import React from "react";

interface PlayerOProps {
  alias: string;
  picture: string;
  pieceLabel?: string;
  wins: number;
  losses: number;
  draws: number;
  mood: React.ReactNode;
  result?: "winner" | "loser" | "neutral";
}

const PlayerO: React.FC<PlayerOProps> = ({
  alias,
  picture,
  pieceLabel = "Player O",
  wins,
  losses,
  draws,
  mood,
  result = "neutral",
}) => (
  <div className={classnames("fixed right-10 flex-col", "player plo", `player-result-${result}`)}>
    <div className="player-top">
      <img src={picture} alt={`${alias}'s Picture`} className="player-picture" />
      <div className="player-identity">
        <p className="player-piece-label">{pieceLabel}</p>
        <p className="player-alias">{alias}</p>
        <p className="player-mood">{mood}</p>
      </div>
    </div>

    <div className="player-stats">
      <div className="player-stat player-stat-win">
        <span>Wins</span>
        <strong>{wins}</strong>
      </div>
      <div className="player-stat player-stat-loss">
        <span>Losses</span>
        <strong>{losses}</strong>
      </div>
      <div className="player-stat player-stat-draw">
        <span>Draws</span>
        <strong>{draws}</strong>
      </div>
    </div>
  </div>
);

export default PlayerO;
