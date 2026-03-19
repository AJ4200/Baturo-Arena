import classnames from 'classnames';
import { AiOutlineArrowLeft } from 'react-icons/ai';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameType, LeaderboardCategory } from '@/types/game';

type LeaderboardScreenProps = {
  leaderboard: LeaderboardCategory[];
  selectedCategory: GameType | 'overall';
  games: GameDefinition[];
  onBack: () => void;
  onRefresh: () => void;
  onSelectCategory: (value: GameType | 'overall') => void;
};

export function LeaderboardScreen({
  leaderboard,
  selectedCategory,
  games,
  onBack,
  onRefresh,
  onSelectCategory,
}: LeaderboardScreenProps) {
  const activeCategory = leaderboard.find((entry) => entry.gameType === selectedCategory) || leaderboard[0];

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
          <select className="settings-select" value={selectedCategory} onChange={(event) => onSelectCategory(event.target.value as GameType | 'overall')}>
            <option value="overall">Overall Arena</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>

        <div className="lobby-game-banner">
          <strong>{activeCategory?.name || 'Overall Arena'}</strong>
          <span>
            {selectedCategory === 'overall'
              ? 'Combined performance across every current Baturo Arena game.'
              : `Stats filtered for ${formatGameName(selectedCategory, games)}.`}
          </span>
        </div>

        <div className="leaderboard-list">
          {!activeCategory || activeCategory.players.length === 0 ? (
            <p>No players found yet.</p>
          ) : (
            activeCategory.players.map((entry, index) => (
              <div key={`${activeCategory.gameType}-${entry.playerId}`} className="leaderboard-item">
                <div className="leaderboard-rank">#{index + 1}</div>
                <img src={`https://robohash.org/${entry.name}`} alt={`${entry.name} avatar`} className="leaderboard-avatar" />
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
