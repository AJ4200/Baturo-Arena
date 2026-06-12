'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import classnames from 'classnames';
import {
  AiOutlineAppstore,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineCheckCircle,
  AiOutlineDown,
  AiOutlineGlobal,
  AiOutlineLeft,
  AiOutlinePicCenter,
  AiOutlineRight,
  AiOutlineRobot,
  AiOutlineSearch,
  AiOutlineTeam,
  AiOutlineUp,
  AiOutlineUnorderedList,
} from 'react-icons/ai';
import type { GameCategory, GameDefinition, GameType } from '@/types/game';
import { getGameCarouselThumbnail } from '@/features/home/gameCarouselThumbnails';
import { formatGameCategory } from '@/lib/games';

type ChooseGameLayout = 'carousel' | 'list' | 'grid';

const CHOOSE_GAME_LAYOUTS: { id: ChooseGameLayout; label: string }[] = [
  { id: 'carousel', label: 'Carousel' },
  { id: 'list', label: 'List' },
  { id: 'grid', label: 'Grid' },
];

const CHOOSE_GAME_PAGE_SIZE: Record<Exclude<ChooseGameLayout, 'carousel'>, number> = {
  list: 3,
  grid: 4,
};

type GameCategoryFilter = GameCategory | 'all';

type GameSelectScreenProps = {
  games: GameDefinition[];
  selectedGame: GameType;
  onSelectGame: (gameType: GameType) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function GameSelectScreen({
  games,
  selectedGame,
  onSelectGame,
  onBack,
  onContinue,
}: GameSelectScreenProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GameCategoryFilter>('all');
  const [layoutMode, setLayoutMode] = useState<ChooseGameLayout>('carousel');
  const [layoutPage, setLayoutPage] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const availableCategories = useMemo(
    () => Array.from(new Set(games.map((game) => game.category))),
    [games]
  );
  const filteredGames = useMemo(
    () =>
      games.filter((game) => {
        if (selectedCategory !== 'all' && game.category !== selectedCategory) {
          return false;
        }

        if (!normalizedSearchQuery) {
          return true;
        }

        return (
          game.name.toLowerCase().includes(normalizedSearchQuery) ||
          game.description.toLowerCase().includes(normalizedSearchQuery) ||
          game.id.toLowerCase().includes(normalizedSearchQuery) ||
          formatGameCategory(game.category).toLowerCase().includes(normalizedSearchQuery)
        );
      }),
    [games, normalizedSearchQuery, selectedCategory]
  );
  const selectedIndex =
    filteredGames.length === 0 ? -1 : Math.max(0, filteredGames.findIndex((game) => game.id === selectedGame));
  const selectedOrder = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const selectedDefinition = selectedIndex >= 0 ? filteredGames[selectedIndex] : null;
  const selectedGameName = selectedDefinition?.name || 'No game selected';
  const totalGames = filteredGames.length;
  const pageSize = layoutMode === 'carousel' ? Math.max(filteredGames.length, 1) : CHOOSE_GAME_PAGE_SIZE[layoutMode];
  const totalPages = layoutMode === 'carousel' ? 1 : Math.max(1, Math.ceil(filteredGames.length / pageSize));
  const safeLayoutPage = Math.min(layoutPage, totalPages - 1);
  const visibleRangeStart = filteredGames.length === 0 ? 0 : safeLayoutPage * pageSize + 1;
  const visibleRangeEnd =
    layoutMode === 'carousel' ? filteredGames.length : Math.min(filteredGames.length, (safeLayoutPage + 1) * pageSize);
  const pagedGames = useMemo(() => {
    if (layoutMode === 'carousel') {
      return filteredGames;
    }

    const pageStart = safeLayoutPage * pageSize;
    return filteredGames.slice(pageStart, pageStart + pageSize);
  }, [filteredGames, layoutMode, pageSize, safeLayoutPage]);

  useEffect(() => {
    if (filteredGames.length === 0) {
      setIsDropdownOpen(false);
      return;
    }

    if (!filteredGames.some((game) => game.id === selectedGame)) {
      onSelectGame(filteredGames[0].id);
    }
  }, [filteredGames, onSelectGame, selectedGame]);

  useEffect(() => {
    if (layoutPage !== safeLayoutPage) {
      setLayoutPage(safeLayoutPage);
    }
  }, [layoutPage, safeLayoutPage]);

  useEffect(() => {
    if (layoutMode === 'carousel' || selectedIndex < 0) {
      return;
    }

    const selectedPage = Math.floor(selectedIndex / pageSize);
    setLayoutPage((currentPage) => (currentPage === selectedPage ? currentPage : selectedPage));
  }, [layoutMode, pageSize, selectedIndex]);

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (!filteredGames.length) return;
      const nextIndex = (selectedIndex + direction + filteredGames.length) % filteredGames.length;
      onSelectGame(filteredGames[nextIndex].id);
    },
    [filteredGames, selectedIndex, onSelectGame]
  );

  const selectLayoutPage = useCallback(
    (pageIndex: number) => {
      if (layoutMode === 'carousel' || !filteredGames.length) {
        return;
      }

      const nextPage = Math.min(Math.max(pageIndex, 0), totalPages - 1);
      const firstGameOnPage = filteredGames[nextPage * pageSize];
      setLayoutPage(nextPage);

      if (firstGameOnPage) {
        onSelectGame(firstGameOnPage.id);
      }
    },
    [filteredGames, layoutMode, onSelectGame, pageSize, totalPages]
  );

  const moveBrowser = useCallback(
    (direction: -1 | 1) => {
      if (layoutMode === 'carousel') {
        moveSelection(direction);
        return;
      }

      if (!filteredGames.length) {
        return;
      }

      const nextPage = (safeLayoutPage + direction + totalPages) % totalPages;
      selectLayoutPage(nextPage);
    },
    [filteredGames.length, layoutMode, moveSelection, safeLayoutPage, selectLayoutPage, totalPages]
  );

  const changeLayoutMode = useCallback(
    (nextLayoutMode: ChooseGameLayout) => {
      setLayoutMode(nextLayoutMode);

      if (nextLayoutMode === 'carousel') {
        setLayoutPage(0);
        return;
      }

      setLayoutPage(selectedIndex < 0 ? 0 : Math.floor(selectedIndex / CHOOSE_GAME_PAGE_SIZE[nextLayoutMode]));
    },
    [selectedIndex]
  );

  const renderLayoutIcon = (layoutId: ChooseGameLayout) => {
    if (layoutId === 'list') return <AiOutlineUnorderedList />;
    if (layoutId === 'grid') return <AiOutlineAppstore />;
    return <AiOutlinePicCenter />;
  };

  const renderGameOption = (game: GameDefinition) => {
    const isSelected = selectedGame === game.id;
    const thumbnail = getGameCarouselThumbnail(game.id);

    return (
      <article
        key={game.id}
        className={classnames(
          'choose-game-option-card',
          `choose-game-option-card-${layoutMode}`,
          isSelected && 'choose-game-option-card-active'
        )}
        data-selected={isSelected ? 'true' : 'false'}
      >
        <button
          className="choose-game-option-select"
          type="button"
          onClick={() => onSelectGame(game.id)}
          aria-label={`Select ${game.name}`}
        >
          <div className="choose-game-option-art" aria-hidden="true">
            <div className={classnames('choose-game-thumb', thumbnail.className)}>
              <span>{thumbnail.label}</span>
            </div>
          </div>
          <div className="choose-game-option-copy">
            <strong>{game.name}</strong>
            <span>{game.description}</span>
            <div className="choose-game-option-pills">
              <small>{formatGameCategory(game.category)}</small>
              <small>
                <AiOutlineTeam /> {game.minPlayers}-{game.maxPlayers}
              </small>
              <small>{game.supportsOnline ? <AiOutlineGlobal /> : <AiOutlineRobot />} {game.supportsOnline ? 'Online' : 'Solo'}</small>
              <small>{game.supportsCpu ? 'CPU' : 'No CPU'}</small>
            </div>
          </div>
        </button>
      </article>
    );
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (isTypingField && event.key !== 'Enter') {
        return;
      }

      if (event.repeat) {
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection, onContinue]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const carouselTrackStyle = useMemo<CSSProperties>(() => {
    if (selectedIndex < 0) return {};
    return {
      transform: `translateX(calc(50% - (var(--choose-carousel-card-size) / 2) - ${selectedIndex} * (var(--choose-carousel-card-size) + var(--choose-carousel-gap))))`,
    };
  }, [selectedIndex]);

  return (
    <section className="title-screen-content">
      <h1>
        <span>Choose</span>
        <span>-</span>
        <span>Game</span>
      </h1>

      <div className="choose-game-layout-toolbar">
        <div className="choose-game-layout-switch" role="group" aria-label="Choose game layout">
          {CHOOSE_GAME_LAYOUTS.map((layoutOption) => (
            <button
              key={layoutOption.id}
              className={classnames(
                'choose-game-layout-btn',
                layoutMode === layoutOption.id && 'choose-game-layout-btn-active'
              )}
              type="button"
              onClick={() => changeLayoutMode(layoutOption.id)}
              aria-pressed={layoutMode === layoutOption.id}
              title={`${layoutOption.label} layout`}
            >
              {renderLayoutIcon(layoutOption.id)}
              <span>{layoutOption.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lobby-card mt-8">
        <div className="choose-game-toolbar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <label className="choose-game-search" aria-label="Search games">
            <AiOutlineSearch />
            <input
              className="choose-game-search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search games"
            />
          </label>
          <div className="choose-game-toolbar-right">
            <div className="choose-game-meta" aria-live="polite">
              <span className="choose-game-position">
                {filteredGames.length === 0 ? '0 results' : `${selectedOrder} of ${totalGames}`}
              </span>
              <div className="choose-game-selector" ref={dropdownRef}>
                <button
                  className="choose-game-name choose-game-name-button"
                  type="button"
                  onClick={() => setIsDropdownOpen((currentValue) => !currentValue)}
                  disabled={filteredGames.length === 0}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span>{selectedGameName}</span>
                  {isDropdownOpen ? <AiOutlineUp /> : <AiOutlineDown />}
                </button>
                {isDropdownOpen && (
                  <div className="choose-game-dropdown ba-scroll-surface">
                    {filteredGames.map((game) => (
                      <button
                        key={game.id}
                        className={classnames(
                          'choose-game-dropdown-item',
                          game.id === selectedGame && 'active'
                        )}
                        onClick={() => {
                          onSelectGame(game.id);
                          setTimeout(() => setIsDropdownOpen(false), 100);
                        }}
                      >
                        {game.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
            <button
              className="choose-game-step-btn choose-game-play-now-btn"
              type="button"
              disabled={filteredGames.length === 0}
              onClick={onContinue}
              aria-label="Play selected game"
              title="Play selected game"
            >
              <AiOutlineCheckCircle /> Play
            </button>
          </div>
        </div>
        <div className="choose-game-category-bar" role="group" aria-label="Filter games by category">
          <button
            className={classnames('choose-game-category-chip', selectedCategory === 'all' && 'active')}
            type="button"
            onClick={() => setSelectedCategory('all')}
            aria-pressed={selectedCategory === 'all'}
          >
            All <span>{games.length}</span>
          </button>
          {availableCategories.map((category) => {
            const categoryCount = games.filter((game) => game.category === category).length;
            return (
              <button
                key={category}
                className={classnames('choose-game-category-chip', selectedCategory === category && 'active')}
                type="button"
                onClick={() => setSelectedCategory(category)}
                aria-pressed={selectedCategory === category}
              >
                {formatGameCategory(category)} <span>{categoryCount}</span>
              </button>
            );
          })}
        </div>
        <p className="choose-game-hint">
          <AiOutlineArrowRight /> Tip: use arrow keys to browse, switch layouts, then Enter to launch.
        </p>

        {layoutMode === 'carousel' ? (
          <>
            <div className="choose-game-carousel-shell choose-game-browser-shell-carousel">
              <button
                className="choose-game-carousel-nav choose-game-carousel-nav-left"
                type="button"
                disabled={filteredGames.length === 0}
                onClick={() => moveSelection(-1)}
                aria-label="Select previous game"
                title="Previous game"
              >
                <AiOutlineLeft />
              </button>

              <div className="choose-game-carousel-mask">
                {filteredGames.length === 0 ? (
                  <div className="choose-game-empty-state">
                    <strong>No games found</strong>
                    <span>Try a different search term.</span>
                  </div>
                ) : (
                  <div className="choose-game-carousel-track" style={carouselTrackStyle}>
                    {filteredGames.map((game) => {
                      const isSelected = selectedGame === game.id;
                      const thumbnail = getGameCarouselThumbnail(game.id);

                      return (
                        <article
                          key={game.id}
                          className={classnames('choose-game-carousel-card', isSelected && 'choose-game-carousel-card-active')}
                          data-selected={isSelected ? 'true' : 'false'}
                        >
                          <button
                            className="choose-game-carousel-card-select"
                            type="button"
                            onClick={() => onSelectGame(game.id)}
                            aria-label={`Select ${game.name}`}
                          >
                            <div className={classnames('choose-game-thumb', thumbnail.className)}>
                              <span>{thumbnail.label}</span>
                            </div>
                          </button>

                          {isSelected ? (
                            <button className="choose-game-play-btn choose-game-play-btn-active" type="button" onClick={onContinue}>
                              <AiOutlineCheckCircle /> Play Game
                            </button>
                          ) : (
                            <button className="choose-game-carousel-peek-btn" type="button" onClick={() => onSelectGame(game.id)}>
                              Select
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                className="choose-game-carousel-nav choose-game-carousel-nav-right"
                type="button"
                disabled={filteredGames.length === 0}
                onClick={() => moveSelection(1)}
                aria-label="Select next game"
                title="Next game"
              >
                <AiOutlineRight />
              </button>
            </div>

            <div className="choose-game-dot-row" aria-hidden={filteredGames.length <= 1}>
              {filteredGames.map((game) => (
                <button
                  key={game.id}
                  className={classnames('choose-game-dot', selectedGame === game.id && 'choose-game-dot-active')}
                  type="button"
                  onClick={() => onSelectGame(game.id)}
                  aria-label={`Switch to ${game.name}`}
                  title={game.name}
                />
              ))}
            </div>

            {selectedDefinition ? (
              <section className="choose-game-spotlight">
                <div className="choose-game-spotlight-head">
                  <strong>{selectedDefinition.name}</strong>
                  <span>
                    {selectedOrder} / {totalGames}
                  </span>
                </div>
                <p>{selectedDefinition.description}</p>
                <div className="choose-game-spotlight-pills">
                  <span>{formatGameCategory(selectedDefinition.category)}</span>
                  <span>
                    <AiOutlineTeam /> {selectedDefinition.minPlayers}-{selectedDefinition.maxPlayers} players
                  </span>
                  <span>{selectedDefinition.supportsOnline ? <AiOutlineGlobal /> : <AiOutlineRobot />} {selectedDefinition.supportsOnline ? 'Online Ready' : 'Solo Focus'}</span>
                  <span>{selectedDefinition.supportsCpu ? 'CPU Enabled' : 'CPU Off'}</span>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className={classnames('choose-game-catalog-stage', `choose-game-catalog-stage-${layoutMode}`)}>
            <div className="choose-game-catalog-head">
              <div className="choose-game-catalog-count" aria-live="polite">
                <span>
                  Showing {visibleRangeStart}-{visibleRangeEnd} of {totalGames}
                </span>
              </div>
              <div className="choose-game-catalog-pager">
                <button
                  className="choose-game-catalog-page-btn"
                  type="button"
                  disabled={filteredGames.length === 0}
                  onClick={() => moveBrowser(-1)}
                  aria-label="Show previous page"
                  title="Previous page"
                >
                  <AiOutlineLeft />
                </button>
                <span className="choose-game-page-status" aria-label={`Page ${safeLayoutPage + 1} of ${totalPages}`}>
                  {safeLayoutPage + 1}
                  <small>/</small>
                  {totalPages}
                </span>
                <div className="choose-game-catalog-dots" aria-hidden={totalPages <= 1}>
                  {Array.from({ length: totalPages }, (_, pageIndex) => (
                    <button
                      key={pageIndex}
                      className={classnames('choose-game-dot', 'choose-game-page-dot', safeLayoutPage === pageIndex && 'choose-game-dot-active')}
                      type="button"
                      onClick={() => selectLayoutPage(pageIndex)}
                      aria-label={`Show page ${pageIndex + 1}`}
                      title={`Page ${pageIndex + 1}`}
                    />
                  ))}
                </div>
                <button
                  className="choose-game-catalog-page-btn"
                  type="button"
                  disabled={filteredGames.length === 0}
                  onClick={() => moveBrowser(1)}
                  aria-label="Show next page"
                  title="Next page"
                >
                  <AiOutlineRight />
                </button>
              </div>
            </div>

            {filteredGames.length === 0 ? (
              <div className="choose-game-empty-state choose-game-catalog-empty">
                <strong>No games found</strong>
                <span>Try a different search term.</span>
              </div>
            ) : (
              <div
                className={classnames(
                  'choose-game-layout-panel',
                  `choose-game-layout-panel-${layoutMode}`,
                  'ba-scroll-surface'
                )}
                aria-label={`${layoutMode} game picker page ${safeLayoutPage + 1} of ${totalPages}`}
              >
                {pagedGames.map(renderGameOption)}
              </div>
            )}

            {selectedDefinition ? (
              <div className="choose-game-catalog-summary">
                <div>
                  <strong>{selectedDefinition.name}</strong>
                  <p>{selectedDefinition.description}</p>
                  <div className="choose-game-spotlight-pills">
                    <span>{formatGameCategory(selectedDefinition.category)}</span>
                    <span>
                      <AiOutlineTeam /> {selectedDefinition.minPlayers}-{selectedDefinition.maxPlayers} players
                    </span>
                    <span>{selectedDefinition.supportsOnline ? <AiOutlineGlobal /> : <AiOutlineRobot />} {selectedDefinition.supportsOnline ? 'Online Ready' : 'Solo Focus'}</span>
                    <span>{selectedDefinition.supportsCpu ? 'CPU Enabled' : 'CPU Off'}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </section>
  );
}
