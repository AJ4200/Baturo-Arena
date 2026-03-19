import classnames from 'classnames';
import { AiOutlineArrowLeft } from 'react-icons/ai';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameType, MatchHistoryEntry } from '@/types/game';

type HistoryScreenProps = {
  history: MatchHistoryEntry[];
  selectedGame: GameType | 'all';
  games: GameDefinition[];
  onBack: () => void;
  onClear: () => void;
  onSelectGame: (value: GameType | 'all') => void;
};

export function HistoryScreen({ history, selectedGame, games, onBack, onClear, onSelectGame }: HistoryScreenProps) {
  const filteredHistory = selectedGame === 'all' ? history : history.filter((entry) => entry.gameType === selectedGame);

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
          <select className="settings-select" value={selectedGame} onChange={(event) => onSelectGame(event.target.value as GameType | 'all')}>
            <option value="all">All Games</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-item settings-item-save">
          <p>{selectedGame === 'all' ? 'Recent Matches' : `Recent ${formatGameName(selectedGame, games)} Matches`}</p>
          <div className="settings-save-actions">
            <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={history.length === 0} onClick={onClear}>
              Clear History
            </button>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="settings-save-meta">No completed matches recorded yet for this category</p>
        ) : (
          <ul className="settings-history-list">
            {filteredHistory.slice(0, 20).map((entry) => (
              <li key={entry.id} className="settings-history-item">
                <span className={classnames('settings-history-outcome', `outcome-${entry.outcome}`)}>{entry.outcome.toUpperCase()}</span>
                <span className="settings-history-opponent">
                  {formatGameName(entry.gameType, games)} | {entry.mode === 'cpu' ? 'CPU' : 'ONLINE'} vs {entry.opponent}
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
