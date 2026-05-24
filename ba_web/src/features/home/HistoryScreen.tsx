import { useEffect, useMemo, useState } from 'react';
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

const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
};

export function HistoryScreen({ history, selectedGame, games, onBack, onClear, onSelectGame }: HistoryScreenProps) {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const filteredHistory = useMemo(
    () => (selectedGame === 'all' ? history : history.filter((entry) => entry.gameType === selectedGame)),
    [history, selectedGame]
  );
  const sortedHistory = useMemo(() => {
    const copy = [...filteredHistory];
    copy.sort((leftEntry, rightEntry) => {
      const leftTime = new Date(leftEntry.finishedAt).getTime();
      const rightTime = new Date(rightEntry.finishedAt).getTime();
      return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
    return copy;
  }, [filteredHistory, sortOrder]);

  const summary = useMemo(() => {
    const wins = filteredHistory.filter((entry) => entry.outcome === 'win').length;
    const losses = filteredHistory.filter((entry) => entry.outcome === 'loss').length;
    const draws = filteredHistory.filter((entry) => entry.outcome === 'draw').length;
    const total = filteredHistory.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, draws, total, winRate };
  }, [filteredHistory]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / itemsPerPage));
  const visiblePages = useMemo(
    () => getVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const pageStart = sortedHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEnd = Math.min(sortedHistory.length, currentPage * itemsPerPage);
  const pageItems = sortedHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGame, sortOrder]);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

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
          <select className="settings-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
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

        <div className="history-summary">
          <span className="history-chip">Matches {summary.total}</span>
          <span className="history-chip history-chip-win">Wins {summary.wins}</span>
          <span className="history-chip history-chip-loss">Losses {summary.losses}</span>
          <span className="history-chip history-chip-draw">Draws {summary.draws}</span>
          <span className="history-chip">Win Rate {summary.winRate}%</span>
        </div>

        {sortedHistory.length === 0 ? (
          <p className="settings-save-meta">No completed matches recorded yet for this category</p>
        ) : (
          <>
            <ul className="settings-history-list">
              {pageItems.map((entry) => (
                <li key={entry.id} className="settings-history-item">
                  <span className={classnames('settings-history-outcome', `outcome-${entry.outcome}`)}>{entry.outcome.toUpperCase()}</span>
                  <span className="settings-history-opponent">
                    {formatGameName(entry.gameType, games)} | {(entry.mode === 'offline' ? 'LOCAL' : entry.mode.toUpperCase())} vs {entry.opponent}
                  </span>
                  <span className="settings-history-time">{new Date(entry.finishedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>

            <div className="pagination-row pagination-row-rich">
              <div className="pagination-meta-card">
                <span className="pagination-info">
                  Showing {pageStart}-{pageEnd} of {sortedHistory.length}
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

                <div className="pagination-page-list" aria-label="History pages">
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

              <div className="pagination-size pagination-size-card">
                <label>Items per page:</label>
                <select className="settings-select" value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
