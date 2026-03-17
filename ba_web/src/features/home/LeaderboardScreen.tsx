import classnames from "classnames";
import { AiOutlineArrowLeft } from "react-icons/ai";
import type { LeaderboardPlayer } from "@/types/game";

type LeaderboardScreenProps = {
  leaderboard: LeaderboardPlayer[];
  onBack: () => void;
  onRefresh: () => void;
};

export function LeaderboardScreen({ leaderboard, onBack, onRefresh }: LeaderboardScreenProps) {
  return (
    <section className="title-screen-content">
      <h1>
        <span>Leader-</span>
        <span>Board</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>

        <div className="leaderboard-list">
          {leaderboard.length === 0 ? (
            <p>No players found yet.</p>
          ) : (
            leaderboard.map((entry, index) => (
              <div key={entry.playerId} className="leaderboard-item">
                <div className="leaderboard-rank">#{index + 1}</div>
                <img
                  src={`https://robohash.org/${entry.name}`}
                  alt={`${entry.name} avatar`}
                  className="leaderboard-avatar"
                />
                <div className="leaderboard-meta">
                  <p>{entry.name}</p>
                  <p>
                    <span className="lb-win">W {entry.wins}</span> | <span className="lb-loss">L {entry.losses}</span> | D {entry.draws}
                  </p>
                </div>
                <div className="leaderboard-score">{entry.score} pts</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
