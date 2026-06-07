import { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineReload,
  AiOutlineSearch,
  AiOutlineTeam,
} from 'react-icons/ai';
import { FaCrown, FaMedal, FaTrophy } from 'react-icons/fa';
import { MdLeaderboard } from 'react-icons/md';
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
  const categoryLeader = activeCategory?.players[0];
  const recordedResults = activeCategory?.players.reduce(
    (total, entry) => total + entry.wins + entry.losses + entry.draws,
    0
  ) || 0;

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  return (
    <section className="title-screen-content leaderboard-screen">
      <div className="leaderboard-screen-heading">
        <h1>
          <span>Leader-</span>
          <span>Board</span>
        </h1>
      </div>

      <div className="leaderboard-stage">
        <div className="leaderboard-toolbar">
          <button className="leaderboard-back-button" type="button" onClick={onBack}>
            <AiOutlineArrowLeft aria-hidden="true" /> Back
          </button>
          <label className="leaderboard-category-select">
            <MdLeaderboard aria-hidden="true" />
            <span>Standings</span>
            <select
              value={selectedCategory}
              onChange={(event) => onSelectCategory(event.target.value as GameType | 'overall')}
            >
              <option value="overall">Overall Arena</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <button className="leaderboard-refresh-button" type="button" onClick={onRefresh}>
            <AiOutlineReload aria-hidden="true" /> Refresh
          </button>
        </div>

        <section className="leaderboard-spotlight">
          <div className="leaderboard-spotlight-copy">
            <span className="leaderboard-live-label">
              <i aria-hidden="true" /> Live standings
            </span>
            <h2>{activeCategory?.name || 'Overall Arena'}</h2>
            <p>
              {selectedCategory === 'overall'
                ? 'Every current Baturo Arena result, combined into one competitive table.'
                : `${formatGameName(selectedCategory, games)} specialists fighting for the top rank.`}
            </p>
          </div>

          <div className="leaderboard-spotlight-stats">
            <article>
              <AiOutlineTeam aria-hidden="true" />
              <span>
                <small>Ranked players</small>
                <strong>{activeCategory?.players.length || 0}</strong>
              </span>
            </article>
            <article>
              <FaTrophy aria-hidden="true" />
              <span>
                <small>Top score</small>
                <strong>{categoryLeader?.score || 0}</strong>
              </span>
            </article>
            <article>
              <FaMedal aria-hidden="true" />
              <span>
                <small>Results logged</small>
                <strong>{recordedResults}</strong>
              </span>
            </article>
          </div>
        </section>

        <div className="leaderboard-command-deck">
          <label className="leaderboard-search-field">
            <AiOutlineSearch aria-hidden="true" />
            <input
              value={playerQuery}
              onChange={(event) => setPlayerQuery(event.target.value)}
              placeholder="Search player name"
              aria-label="Search player name"
            />
          </label>
          <span className="leaderboard-result-count">
            {filteredPlayers.length} of {activeCategory?.players.length || 0} players
          </span>
          <label className="leaderboard-page-size">
            <span>Per page</span>
            <select value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <section className="leaderboard-board">
          <div className="leaderboard-board-head" aria-hidden="true">
            <span>Rank</span>
            <span>Player</span>
            <span>Record</span>
            <span>Score</span>
          </div>

          {!activeCategory || filteredPlayers.length === 0 ? (
            <div className="leaderboard-empty">
              <MdLeaderboard aria-hidden="true" />
              <strong>{playerQuery ? 'No player matches that search' : 'No ranked players yet'}</strong>
              <span>{playerQuery ? 'Try another player name.' : 'Completed online matches will fill this board.'}</span>
            </div>
          ) : (
            <>
              {pagePlayers.map((entry, idx) => {
                const index = (currentPage - 1) * itemsPerPage + idx;
                return (
                  <article
                    key={`${activeCategory.gameType}-${entry.playerId}`}
                    className={classnames(
                      'leaderboard-rank-row',
                      index === 0 && 'leaderboard-rank-row-first',
                      index === 1 && 'leaderboard-rank-row-second',
                      index === 2 && 'leaderboard-rank-row-third'
                    )}
                  >
                    <div className="leaderboard-rank-number">
                      {index === 0 ? <FaCrown aria-hidden="true" /> : null}
                      <strong>#{index + 1}</strong>
                    </div>
                    <div className="leaderboard-player">
                      <span className="leaderboard-avatar-frame">
                        <img src={`https://robohash.org/${entry.name}`} alt={`${entry.name} avatar`} />
                      </span>
                      <span>
                        <strong>{entry.name}</strong>
                        <small>{index < 3 ? 'Podium contender' : 'Arena competitor'}</small>
                      </span>
                    </div>
                    <div className="leaderboard-record" aria-label={`${entry.wins} wins, ${entry.losses} losses, ${entry.draws} draws`}>
                      <span className="leaderboard-record-win">W {entry.wins}</span>
                      <span className="leaderboard-record-loss">L {entry.losses}</span>
                      <span className="leaderboard-record-draw">D {entry.draws}</span>
                    </div>
                    <div className="leaderboard-points">
                      <strong>{entry.score}</strong>
                      <small>points</small>
                    </div>
                  </article>
                );
              })}

              <div className="pagination-row pagination-row-rich leaderboard-pagination">
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
        </section>
      </div>
    </section>
  );
}
