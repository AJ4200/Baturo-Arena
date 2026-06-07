import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineCalendar,
  AiOutlineClockCircle,
  AiOutlineDelete,
} from 'react-icons/ai';
import { BiFilterAlt } from 'react-icons/bi';
import { FaHandshake, FaTrophy } from 'react-icons/fa';
import { MdOutlineSportsScore } from 'react-icons/md';
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
    <section className="title-screen-content history-screen">
      <div className="history-screen-heading">
        <h1>
          <span>His-</span>
          <span>tory</span>
        </h1>
      </div>

      <div className="history-archive">
        <div className="history-toolbar">
          <button className="history-back-button" type="button" onClick={onBack}>
            <AiOutlineArrowLeft aria-hidden="true" /> Back
          </button>

          <div className="history-filter-group">
            <BiFilterAlt aria-hidden="true" />
            <label>
              <span>Game</span>
              <select
                value={selectedGame}
                onChange={(event) => onSelectGame(event.target.value as GameType | 'all')}
              >
                <option value="all">All Games</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Order</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </label>
          </div>
        </div>

        <div className="history-summary-grid">
          <article className="history-stat history-stat-total">
            <MdOutlineSportsScore aria-hidden="true" />
            <span>
              <small>Matches</small>
              <strong>{summary.total}</strong>
            </span>
          </article>
          <article className="history-stat history-stat-win">
            <FaTrophy aria-hidden="true" />
            <span>
              <small>Wins</small>
              <strong>{summary.wins}</strong>
            </span>
          </article>
          <article className="history-stat history-stat-loss">
            <span className="history-stat-mark" aria-hidden="true">X</span>
            <span>
              <small>Losses</small>
              <strong>{summary.losses}</strong>
            </span>
          </article>
          <article className="history-stat history-stat-draw">
            <FaHandshake aria-hidden="true" />
            <span>
              <small>Draws</small>
              <strong>{summary.draws}</strong>
            </span>
          </article>
          <article className="history-stat history-stat-rate">
            <span
              className="history-stat-ring"
              style={{ '--history-rate': `${summary.winRate * 3.6}deg` } as CSSProperties}
            >
              {summary.winRate}%
            </span>
            <span>
              <small>Win rate</small>
              <strong>{summary.total > 0 ? 'Form' : 'No data'}</strong>
            </span>
          </article>
        </div>

        <section className="history-ledger">
          <header className="history-ledger-head">
            <div>
              <span className="history-ledger-eyebrow">Local match archive</span>
              <h2>
                {selectedGame === 'all'
                  ? 'Recent matches'
                  : `${formatGameName(selectedGame, games)} matches`}
              </h2>
            </div>
            <button
              className="history-clear-button"
              type="button"
              disabled={history.length === 0}
              onClick={onClear}
            >
              <AiOutlineDelete aria-hidden="true" /> Clear history
            </button>
          </header>

          {sortedHistory.length === 0 ? (
            <div className="history-empty">
              <AiOutlineCalendar aria-hidden="true" />
              <strong>No matches in this archive yet</strong>
              <span>Completed games will be recorded here on this device.</span>
            </div>
          ) : (
            <>
              <ul className="history-match-list">
                {pageItems.map((entry) => {
                  const finishedAt = new Date(entry.finishedAt);
                  return (
                    <li key={entry.id} className={classnames('history-match', `history-match-${entry.outcome}`)}>
                      <span className="history-match-rail" aria-hidden="true" />
                      <span className="history-match-outcome">{entry.outcome}</span>
                      <div className="history-match-copy">
                        <span className="history-match-game">
                          {formatGameName(entry.gameType, games)}
                          <i>{entry.mode === 'offline' ? 'Local' : entry.mode}</i>
                        </span>
                        <strong>vs {entry.opponent}</strong>
                      </div>
                      <div className="history-match-date">
                        <span>
                          <AiOutlineCalendar aria-hidden="true" />
                          {finishedAt.toLocaleDateString()}
                        </span>
                        <span>
                          <AiOutlineClockCircle aria-hidden="true" />
                          {finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="pagination-row pagination-row-rich history-pagination">
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
                  <select value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
