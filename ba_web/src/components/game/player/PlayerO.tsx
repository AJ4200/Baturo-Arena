// components/game/PlayerO.tsx
import classnames from "classnames";
import React from "react";

interface PlayerOProps {
  alias: string;
  picture: string;
  wins: number;
  losses: number;
  draws: number;
  mood: React.ReactNode;
  result?: "winner" | "loser" | "neutral";
}

const PlayerO: React.FC<PlayerOProps> = ({
  alias,
  picture,
  wins,
  losses,
  draws,
  mood,
  result = "neutral",
}) => (
  <div className={classnames("fixed right-10 flex-col", "player plo", `player-result-${result}`)}>
    <div>
      <img
        src={picture}
        alt={`${alias}'s Picture`}
        className="player-picture"
      />{" "}
      <div className="bg-black p-1 w-full">
        <span className="text-green-700">W: {wins}</span> - {" "}
        <span className="text-red-700">L: {losses}</span> - {" "}
        <span >D: {draws}</span> 
      </div>
    </div>
    <div>
      <p>
        O : {alias} : {mood}
      </p>
    </div>
  </div>
);

export default PlayerO;
