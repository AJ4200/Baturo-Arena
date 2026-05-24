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

const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
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
  const visiblePages = useMemo(
    () => getVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const pageStart = filteredPlayers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEnd = Math.min(filteredPlayers.length, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, playerQuery]);

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
          <div className="leaderboard-page-size pagination-size-card">
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

              <div className="pagination-row pagination-row-rich">
                <div className="pagination-meta-card">
                  <span className="pagination-info">
                    Showing {pageStart}-{pageEnd} of {filteredPlayers.length}
                  </span>
                  <span className="pagination-subtle">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <div className="pagination-controls pagination-controls-rich">
                  <button
                    className="pagination-btn"
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Prev
                  </button>

                  <div className="pagination-page-list" aria-label="Leaderboard pages">
                    {visiblePages[0] > 1 ? (
                      <>
                        <button className="pagination-page-chip" type="button" onClick={() => setCurrentPage(1)}>
                          1
                        </button>
                        {visiblePages[0] > 2 ? <span className="pagination-ellipsis">...</span> : null}
                      </>
                    ) : null}

                    {visiblePages.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        className={classnames(
                          'pagination-page-chip',
                          currentPage === pageNumber && 'pagination-page-chip-active'
                        )}
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        aria-current={currentPage === pageNumber ? 'page' : undefined}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    {visiblePages[visiblePages.length - 1] < totalPages ? (
                      <>
                        {visiblePages[visiblePages.length - 1] < totalPages - 1 ? (
                          <span className="pagination-ellipsis">...</span>
                        ) : null}
                        <button className="pagination-page-chip" type="button" onClick={() => setCurrentPage(totalPages)}>
                          {totalPages}
                        </button>
                      </>
                    ) : null}
                  </div>

                  <button
                    className="pagination-btn"
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
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
