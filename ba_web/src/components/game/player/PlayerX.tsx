// components/game/PlayerX.tsx
import classnames from "classnames";
import React from "react";

interface PlayerXProps {
  alias: string;
  picture: string;
  wins: number;
  losses: number;
  draws: number;
  mood: React.ReactNode;
  result?: "winner" | "loser" | "neutral";
}

const PlayerX: React.FC<PlayerXProps> = ({
  alias,
  picture,
  wins,
  losses,
  draws,
  mood,
  result = "neutral",
}) => (
  <div className={classnames("fixed left-10 flex-col", "player plx", `player-result-${result}`)}>
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
    <div className="mt-2 shadow-lg">
      <p>
        X : {alias} : {mood}
      </p>
    </div>
  </div>
);

export default PlayerX;
