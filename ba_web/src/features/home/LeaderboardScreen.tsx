import { useEffect, useMemo, useState } from 'react';
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
  const [playerQuery, setPlayerQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const activeCategory = leaderboard.find((entry) => entry.gameType === selectedCategory) || leaderboard[0];

  const filteredPlayers = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    const normalizedQuery = playerQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeCategory.players;
    }

    return activeCategory.players.filter((entry) => entry.name.toLowerCase().includes(normalizedQuery));
  }, [activeCategory, playerQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagePlayers = filteredPlayers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

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

        <div className="leaderboard-tools">
          <input
            className="lobby-input leaderboard-search"
            value={playerQuery}
            onChange={(event) => setPlayerQuery(event.target.value)}
            placeholder="Search player name"
          />
          <span className="leaderboard-count">
            Showing {filteredPlayers.length}/{activeCategory?.players.length || 0}
          </span>
          <div className="leaderboard-page-size">
            <label>Per page:</label>
            <select className="settings-select" value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="leaderboard-list">
          {!activeCategory || filteredPlayers.length === 0 ? (
            <p>No players found yet.</p>
          ) : (
            <>
              {pagePlayers.map((entry, idx) => {
                const index = (currentPage - 1) * itemsPerPage + idx;
                return (
                  <div
                    key={`${activeCategory.gameType}-${entry.playerId}`}
                    className={classnames(
                      'leaderboard-item',
                      index === 0 && 'leaderboard-item-rank-1',
                      index === 1 && 'leaderboard-item-rank-2',
                      index === 2 && 'leaderboard-item-rank-3'
                    )}
                  >
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
                );
              })}

              <div className="pagination-row" style={{ marginTop: 12 }}>
                <div className="pagination-controls">
                  <button className="lobby-btn" type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </button>
                  <span className="pagination-info">Page {currentPage} / {totalPages}</span>
                  <button className="lobby-btn" type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
