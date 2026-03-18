import classnames from "classnames";
import { AiOutlineArrowLeft } from "react-icons/ai";
import type { MatchHistoryEntry } from "@/types/game";

type HistoryScreenProps = {
  history: MatchHistoryEntry[];
  onBack: () => void;
  onClear: () => void;
};

export function HistoryScreen({ history, onBack, onClear }: HistoryScreenProps) {
  return (
    <section className="title-screen-content">
      <h1>
        <span>His-</span>
        <span>tory</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
        </div>

        <div className="settings-item settings-item-save">
          <p>Recent Matches</p>
          <div className="settings-save-actions">
            <button
              className={classnames("lobby-btn", "custome-shadow")}
              type="button"
              disabled={history.length === 0}
              onClick={onClear}
            >
              Clear History
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="settings-save-meta">No completed matches recorded yet</p>
        ) : (
          <ul className="settings-history-list">
            {history.slice(0, 20).map((entry) => (
              <li key={entry.id} className="settings-history-item">
                <span className={classnames("settings-history-outcome", `outcome-${entry.outcome}`)}>
                  {entry.outcome.toUpperCase()}
                </span>
                <span className="settings-history-opponent">
                  {entry.gameType} | {entry.mode === "cpu" ? "CPU" : "ONLINE"} vs {entry.opponent}
                </span>
                <span className="settings-history-time">{new Date(entry.finishedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
