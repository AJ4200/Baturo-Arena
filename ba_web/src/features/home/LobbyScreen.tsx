'use client';

import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCopy,
  AiOutlineKey,
  AiOutlinePlayCircle,
  AiOutlineReload,
  AiOutlineRobot,
  AiOutlineGlobal,
  AiOutlineTeam,
  AiOutlineAppstore,
  AiOutlineClose,
  AiOutlineEdit,
  AiOutlineFilter,
  AiOutlineIdcard,
  AiOutlineSave,
  AiOutlineSearch,
  AiOutlinePlusCircle,
  AiOutlineUser,
  AiOutlineDesktop,
} from 'react-icons/ai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatGameCategory, formatGameName } from '@/lib/games';
import { getOfflineSeats } from '@/lib/offline';
import { getGameCarouselThumbnail } from '@/features/home/gameCarouselThumbnails';
import type { CpuDifficulty, GameDefinition, GameMode, GameType, PlayerProfile, PublicRoom } from '@/types/game';
import type { GoogleAccount } from '@/features/home/ProfileDock';

type LobbyScreenProps = {
  playerName: string;
  roomName: string;
  joinCode: string;
  selectedGame: GameType;
  playMode: GameMode;
  cpuDifficulty: CpuDifficulty;
  offlinePlayerCount: number;
  offlinePlayerNames: string[];
  games: GameDefinition[];
  publicRooms: PublicRoom[];
  playerProfile: PlayerProfile | null;
  googleAccount: GoogleAccount | null;
  isLoading: boolean;
  isSinglePlayerMode?: boolean;
  onBack: () => void;
  onPlayModeChange: (mode: GameMode) => void;
  onCpuDifficultyChange: (difficulty: CpuDifficulty) => void;
  onOfflinePlayerCountChange: (count: number) => void;
  onOfflinePlayerNameChange: (index: number, value: string) => void;
  onPlayerNameChange: (value: string) => void;
  onRoomNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onSaveName: (name?: string) => void;
  onCreatePublic?: () => void;
  onCreatePrivate?: () => void;
  onJoinByCode?: () => void;
  onRefreshRooms?: () => void;
  onJoinRoom?: (code: string) => void;
  onPlayCpu: () => void;
  onPlayOffline: () => void;
};

export function LobbyScreen({
  playerName,
  roomName,
  joinCode,
  selectedGame,
  playMode,
  cpuDifficulty,
  offlinePlayerCount,
  offlinePlayerNames,
  games,
  publicRooms,
  playerProfile,
  googleAccount,
  isLoading,
  isSinglePlayerMode = false,
  onBack,
  onPlayModeChange,
  onCpuDifficultyChange,
  onOfflinePlayerCountChange,
  onOfflinePlayerNameChange,
  onPlayerNameChange,
  onRoomNameChange,
  onJoinCodeChange,
  onSaveName,
  onCreatePublic,
  onCreatePrivate,
  onJoinByCode,
  onRefreshRooms,
  onJoinRoom,
  onPlayCpu,
  onPlayOffline,
}: LobbyScreenProps) {
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState<'all' | 'waiting' | 'playing' | 'open'>('all');
  const [roomOwnershipFilter, setRoomOwnershipFilter] = useState<'all' | 'mine' | 'others'>('all');
  const [createRoomMode, setCreateRoomMode] = useState<'public' | 'private'>('public');
  const [isEditingProfileName, setIsEditingProfileName] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState(playerName);
  const selectedDefinition = useMemo(
    () => games.find((gameItem) => gameItem.id === selectedGame) || games[0],
    [games, selectedGame]
  );
  const supportsOnline = selectedDefinition?.supportsOnline ?? true;
  const supportsCpu = selectedDefinition?.supportsCpu ?? true;
  const supportsOffline = (selectedDefinition?.maxPlayers ?? 1) > 1;
  const selectedGameName = formatGameName(selectedGame, games);
  const selectedGameDescription = selectedDefinition?.description || 'Choose a mode and jump in.';
  const selectedGameCategory = selectedDefinition ? formatGameCategory(selectedDefinition.category) : 'Arcade';
  const selectedGameThumbnail = getGameCarouselThumbnail(selectedGame);
  const savedProfileName = (playerProfile?.name || playerName || '').trim() || 'Player';
  const visibleProfileName =
    isEditingProfileName && profileNameDraft.trim() ? profileNameDraft.trim() : savedProfileName;
  const modeOptions = useMemo(
    () => [
      {
        id: 'cpu' as const,
        icon: <AiOutlineRobot />,
        label: 'CPU Mode',
        kicker: 'Solo Challenge',
        footerLabel: 'Adaptive Rival',
        description: supportsCpu
          ? `Play ${selectedGameName} against AI.`
          : `${selectedGameName} does not support CPU mode.`,
        disabled: !supportsCpu,
      },
      {
        id: 'online' as const,
        icon: <AiOutlineGlobal />,
        label: 'Online Mode',
        kicker: 'Network Arena',
        footerLabel: 'Live Rooms',
        description: supportsOnline
          ? 'Create or join network rooms.'
          : `${selectedGameName} does not support online rooms.`,
        disabled: !supportsOnline || isSinglePlayerMode,
      },
      {
        id: 'offline' as const,
        icon: <AiOutlineTeam />,
        label: 'Local Multiplayer',
        kicker: 'Shared Screen',
        footerLabel: 'Couch Battle',
        description: supportsOffline
          ? 'Play locally with shared turns on one device.'
          : `${selectedGameName} is single-player only.`,
        disabled: !supportsOffline,
      },
    ],
    [isSinglePlayerMode, selectedGameName, supportsCpu, supportsOffline, supportsOnline]
  );
  const offlineSeats = useMemo(
    () => getOfflineSeats(selectedGame, offlinePlayerCount),
    [offlinePlayerCount, selectedGame]
  );
  const profilePreviewName = visibleProfileName;
  const profilePreviewAvatarUrl =
    googleAccount?.picture || `https://robohash.org/${encodeURIComponent(profilePreviewName)}?size=160x160`;
  const isGoogleConnected = Boolean(googleAccount?.sub);
  const profileStats = [
    { id: 'wins', label: 'Wins', value: playerProfile?.wins ?? 0 },
    { id: 'draws', label: 'Draws', value: playerProfile?.draws ?? 0 },
    { id: 'losses', label: 'Losses', value: playerProfile?.losses ?? 0 },
  ] as const;
  const profileStatsTotal = profileStats.reduce((total, stat) => total + stat.value, 0);
  let profileChartOffset = 0;
  const profileChartSegments = profileStats.map((stat) => {
    const span = profileStatsTotal > 0 ? (stat.value / profileStatsTotal) * 100 : 0;
    const segment = {
      ...stat,
      span,
      dash: stat.value > 0 ? Math.max(0.8, span - 2.4) : 0,
      offset: profileChartOffset,
    };
    profileChartOffset += span;
    return segment;
  });

  useEffect(() => {
    if (!isEditingProfileName) {
      setProfileNameDraft(playerName);
    }
  }, [isEditingProfileName, playerName]);

  const beginProfileNameEdit = () => {
    setProfileNameDraft(savedProfileName);
    setIsEditingProfileName(true);
  };

  const cancelProfileNameEdit = () => {
    setProfileNameDraft(playerName);
    setIsEditingProfileName(false);
  };

  const saveProfileName = () => {
    const nextName = profileNameDraft.trim();
    if (!nextName) {
      return;
    }
    onPlayerNameChange(nextName);
    onSaveName(nextName);
    setIsEditingProfileName(false);
  };
  const roomNameSuggestions = useMemo(() => {
    const safePlayerName = (playerName || 'Player').trim() || 'Player';
    return Array.from(
      new Set([
        `${safePlayerName}'s Room`,
        `${selectedGameName} Arena`,
        `${selectedGameName} Showdown`,
      ])
    );
  }, [playerName, selectedGameName]);

  const gameRooms = useMemo(
    () => publicRooms.filter((roomItem) => roomItem.gameType === selectedGame),
    [publicRooms, selectedGame]
  );

  const isPlayerHostedRoom = useCallback(
    (roomItem: PublicRoom) => {
      if (playerProfile?.playerId) {
        return roomItem.creatorPlayerId === playerProfile.playerId;
      }
      return roomItem.creatorName.trim().toLowerCase() === savedProfileName.trim().toLowerCase();
    },
    [playerProfile?.playerId, savedProfileName]
  );

  const roomOwnershipCounts = useMemo(() => {
    const mine = gameRooms.filter(isPlayerHostedRoom).length;
    return { all: gameRooms.length, mine, others: gameRooms.length - mine };
  }, [gameRooms, isPlayerHostedRoom]);

  const ownershipRooms = useMemo(
    () =>
      gameRooms.filter((roomItem) => {
        if (roomOwnershipFilter === 'mine') {
          return isPlayerHostedRoom(roomItem);
        }
        if (roomOwnershipFilter === 'others') {
          return !isPlayerHostedRoom(roomItem);
        }
        return true;
      }),
    [gameRooms, isPlayerHostedRoom, roomOwnershipFilter]
  );

  const roomStats = useMemo(() => {
    const total = ownershipRooms.length;
    const waiting = ownershipRooms.filter((roomItem) => roomItem.status === 'waiting').length;
    const playing = ownershipRooms.filter((roomItem) => roomItem.status === 'playing').length;
    const openSlots = ownershipRooms.filter((roomItem) => roomItem.playersCount < roomItem.maxPlayers).length;
    return { total, waiting, playing, openSlots };
  }, [ownershipRooms]);

  const filteredRooms = useMemo(() => {
    const normalizedQuery = roomQuery.trim().toLowerCase();

    return ownershipRooms
      .filter((roomItem) => {
        if (roomStatusFilter === 'waiting') {
          return roomItem.status === 'waiting';
        }
        if (roomStatusFilter === 'playing') {
          return roomItem.status === 'playing';
        }
        if (roomStatusFilter === 'open') {
          return roomItem.playersCount < roomItem.maxPlayers;
        }
        return true;
      })
      .filter((roomItem) => {
        if (!normalizedQuery) {
          return true;
        }
        return (
          roomItem.name.toLowerCase().includes(normalizedQuery) ||
          roomItem.code.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((leftRoom, rightRoom) => {
        const statusRank = (status: PublicRoom['status']) =>
          status === 'waiting' ? 0 : status === 'playing' ? 1 : 2;
        const leftRank = statusRank(leftRoom.status);
        const rightRank = statusRank(rightRoom.status);
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        const leftFill = leftRoom.playersCount / Math.max(1, leftRoom.maxPlayers);
        const rightFill = rightRoom.playersCount / Math.max(1, rightRoom.maxPlayers);
        if (leftFill !== rightFill) {
          return leftFill - rightFill;
        }

        return leftRoom.name.localeCompare(rightRoom.name);
      });
  }, [ownershipRooms, roomQuery, roomStatusFilter]);
  const formatUpdatedTime = useCallback((isoDate: string) => {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown update';
    }
    return parsed.toLocaleString();
  }, []);

  const handleCopyRoomCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRoomCode(code);
      window.setTimeout(() => {
        setCopiedRoomCode((currentValue) => (currentValue === code ? null : currentValue));
      }, 1200);
    } catch (_error) {
      // Ignore clipboard errors to avoid blocking the UI.
    }
  };

  const handleCreateRoom = () => {
    if (!supportsOnline || isLoading || !onCreatePublic || !onCreatePrivate) {
      return;
    }
    if (createRoomMode === 'public') {
      onCreatePublic();
      return;
    }
    onCreatePrivate();
  };
  const playLaunchConfig = useMemo(() => {
    if (playMode === 'cpu') {
      return {
        icon: <AiOutlineRobot />,
        title: `Play ${selectedGameName} vs CPU`,
        hint: supportsCpu
          ? isSinglePlayerMode
            ? 'Solo challenge run'
            : 'Head-to-head training match'
          : `${selectedGameName} does not support CPU mode.`,
        disabled: !supportsCpu,
        onClick: onPlayCpu,
        modeLabel: 'CPU Mode',
        detailLabel: `${cpuDifficulty.toUpperCase()} AI`,
      };
    }

    if (playMode === 'offline') {
      return {
        icon: <AiOutlineTeam />,
        title: 'Start Local Match',
        hint: supportsOffline
          ? 'Local shared-device turn play'
          : `${selectedGameName} is single-player only.`,
        disabled: !supportsOffline,
        onClick: onPlayOffline,
        modeLabel: 'Local Mode',
        detailLabel: `${offlinePlayerCount} Players`,
      };
    }

    return {
      icon: <AiOutlineGlobal />,
      title: supportsOnline ? 'Refresh Room Discovery' : 'Online Room Matchmaking',
      hint: supportsOnline
        ? 'Update the room list and find your next match.'
        : `${selectedGameName} does not support online rooms.`,
      disabled: !supportsOnline || isLoading || !onRefreshRooms,
      onClick: onRefreshRooms || null,
      modeLabel: 'Online Mode',
      detailLabel: supportsOnline ? 'Room Browser' : 'Unavailable',
    };
  }, [
    cpuDifficulty,
    isLoading,
    isSinglePlayerMode,
    offlinePlayerCount,
    onPlayCpu,
    onPlayOffline,
    onRefreshRooms,
    playMode,
    selectedGameName,
    supportsCpu,
    supportsOffline,
    supportsOnline,
  ]);

  return (
    <section className={classnames('title-screen-content', 'lobby-screen', `lobby-theme-${playMode}`)}>
      <div className="lobby-card mt-8">
        <section className="lobby-game-hero" aria-label={`${selectedGameName} lobby`}>
          <div className={classnames('lobby-game-hero-art', 'choose-game-thumb', selectedGameThumbnail.className)}>
            <button className="lobby-back lobby-game-hero-back" type="button" onClick={onBack}>
              <AiOutlineArrowLeft /> Back
            </button>
            <span className="lobby-game-hero-art-label">{selectedGameThumbnail.label}</span>
          </div>
          <div className="lobby-game-hero-copy">
            <span className="lobby-game-hero-kicker">Ready Room</span>
            <h1>{selectedGameName}</h1>
            <p>{selectedGameDescription}</p>
            <div className="lobby-game-hero-chips">
              <span><AiOutlineAppstore /> {selectedGameCategory}</span>
              <span><AiOutlineTeam /> {selectedDefinition?.minPlayers ?? 1}-{selectedDefinition?.maxPlayers ?? 1} Players</span>
              <span>{playLaunchConfig.icon} {playLaunchConfig.modeLabel}</span>
              {supportsOnline ? <span><AiOutlineGlobal /> Online</span> : null}
              {supportsCpu ? <span><AiOutlineRobot /> CPU</span> : null}
              {supportsOffline ? <span><AiOutlineDesktop /> Local</span> : null}
            </div>
          </div>
        </section>

        <div className="lobby-control-bar">
          <div className="lobby-control-main">
            <div className="lobby-control-stack">
              <div className="lobby-play-mode-stack">
                <span className="lobby-section-label"><AiOutlinePlayCircle /> Choose How To Play</span>
                <div className="lobby-play-mode-slider" role="tablist" aria-label="Play mode selector">
                  {modeOptions.map((modeOption) => {
                    const isActiveMode = playMode === modeOption.id;
                    return (
                      <div
                        key={modeOption.id}
                        role="presentation"
                        className={classnames(
                          'lobby-play-mode-card',
                          isActiveMode && 'lobby-play-mode-card-active',
                          `lobby-play-mode-card-${modeOption.id}`
                        )}
                      >
                        <button
                          className={classnames(
                            'lobby-play-mode-btn',
                            isActiveMode && 'lobby-play-mode-btn-active'
                          )}
                          type="button"
                          role="tab"
                          aria-selected={isActiveMode}
                          aria-label={modeOption.label}
                          title={modeOption.label}
                          disabled={modeOption.disabled}
                          onClick={() => onPlayModeChange(modeOption.id)}
                        >
                          <span className="lobby-play-mode-btn-kicker">{modeOption.kicker}</span>
                          <span className="lobby-play-mode-btn-heading">
                            <span className="lobby-play-mode-btn-icon">{modeOption.icon}</span>
                            <span className="lobby-play-mode-btn-label">{modeOption.label}</span>
                          </span>
                          <small className="lobby-play-mode-btn-copy">{modeOption.description}</small>
                        </button>
                        {modeOption.id === 'cpu' ? (
                          <div
                            className={classnames(
                              'lobby-mode-card-difficulty',
                              (!isActiveMode || !supportsCpu) && 'lobby-mode-card-difficulty-disabled'
                            )}
                            role="group"
                            aria-label="CPU difficulty"
                          >
                            <span>CPU Difficulty</span>
                            <div className="lobby-difficulty-tabs">
                              {([
                                { id: 'easy', numeral: 'I', label: 'Easy' },
                                { id: 'medium', numeral: 'II', label: 'Medium' },
                                { id: 'hard', numeral: 'III', label: 'Hard' },
                              ] as const).map((difficultyOption) => (
                                <button
                                  key={difficultyOption.id}
                                  className={classnames(
                                    'lobby-difficulty-tab',
                                    `lobby-difficulty-tab-${difficultyOption.id}`,
                                    cpuDifficulty === difficultyOption.id && 'lobby-difficulty-tab-active'
                                  )}
                                  type="button"
                                  disabled={!supportsCpu || !isActiveMode}
                                  aria-label={`${difficultyOption.label} CPU difficulty`}
                                  aria-pressed={cpuDifficulty === difficultyOption.id}
                                  onClick={() => onCpuDifficultyChange(difficultyOption.id)}
                                >
                                  <strong>{difficultyOption.numeral}</strong>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="lobby-mode-card-status">
                            {modeOption.icon}
                            <span>{modeOption.footerLabel}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="lobby-launch-panel">
              <span className="lobby-section-label"><AiOutlinePlayCircle /> Match Ready</span>
              <div className="lobby-launch-pills">
                <span className="lobby-launch-pill">{selectedGameName}</span>
                <span className="lobby-launch-pill">{playLaunchConfig.modeLabel}</span>
                <span className="lobby-launch-pill">{playLaunchConfig.detailLabel}</span>
              </div>
              <button
                className={classnames('lobby-btn', 'custome-shadow', 'lobby-cpu-cta', 'lobby-play-cta-side')}
                type="button"
                disabled={playLaunchConfig.disabled}
                onClick={playLaunchConfig.onClick || undefined}
              >
                <div className="lobby-cta-content">
                  <div className="lobby-cta-row">
                    <span className="lobby-cta-icon">{playLaunchConfig.icon}</span>
                    <span className="lobby-cta-title">{playLaunchConfig.title}</span>
                  </div>
                  <span className="lobby-cta-sub">{playLaunchConfig.hint}</span>
                </div>
              </button>
            </aside>
          </div>
        </div>

        <div className="lobby-content-grid">
          <section className="lobby-panel lobby-panel-profile">
            <div className="lobby-panel-head lobby-panel-head-static">
              <span className="lobby-panel-icon lobby-panel-icon-profile"><AiOutlineUser /></span>
              <div>
                <p className="lobby-panel-title">Profile</p>
                <p className="lobby-panel-subtitle">Set how your name appears in rooms and leaderboards.</p>
              </div>
            </div>
            <div className="lobby-profile-dashboard">
              <div className="lobby-profile-identity">
                <div className="lobby-profile-preview">
                  <div className="lobby-profile-avatar-shell">
                    <img
                      src={profilePreviewAvatarUrl}
                      alt={`${profilePreviewName} avatar preview`}
                      className="lobby-profile-avatar"
                    />
                  </div>
                  <div className="lobby-profile-meta">
                    <span className="lobby-profile-status">
                      {isGoogleConnected ? <AiOutlineGlobal /> : <AiOutlineUser />}
                      {isGoogleConnected ? 'Connected Profile' : 'Guest Profile'}
                    </span>
                    <strong>{profilePreviewName}</strong>
                    <span>
                      {playerProfile ? `Player ID: ${playerProfile.playerId}` : 'Live avatar preview'}
                      {isGoogleConnected ? ' | Google connected' : ' | Guest mode'}
                    </span>
                    {isGoogleConnected && googleAccount?.email ? <span>{googleAccount.email}</span> : null}
                  </div>
                </div>
              </div>
              <div className="lobby-profile-performance">
                <div className="lobby-profile-chart-wrap">
                  <svg className="lobby-profile-chart" viewBox="0 0 120 120" role="img" aria-label="Win draw loss record">
                    <circle className="lobby-profile-chart-track" cx="60" cy="60" r="46" pathLength="100" />
                    {profileChartSegments.map((segment) => (
                      <circle
                        key={segment.id}
                        className={classnames('lobby-profile-chart-segment', `lobby-profile-chart-segment-${segment.id}`)}
                        cx="60"
                        cy="60"
                        r="46"
                        pathLength="100"
                        strokeDasharray={`${segment.dash} ${100 - segment.dash}`}
                        strokeDashoffset={-segment.offset}
                      >
                        <title>{`${segment.label}: ${segment.value}`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="lobby-profile-chart-center">
                    <strong>{profileStatsTotal}</strong>
                    <span>Matches</span>
                  </div>
                </div>
                <div className="lobby-profile-chart-legend">
                  {profileStats.map((stat) => (
                    <div key={stat.id} className={`lobby-profile-chart-legend-${stat.id}`}>
                      <span />
                      <small>{stat.label}</small>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={classnames('profile-name-editor', isEditingProfileName && 'profile-name-editor-active')}>
                <span className="profile-name-editor-mark" aria-hidden="true">
                  <AiOutlineIdcard />
                </span>
                {isEditingProfileName ? (
                  <>
                    <label className="profile-name-edit-field" aria-label="Choose your arena name">
                      <input
                        className="lobby-input profile-name-editor-input"
                        value={profileNameDraft}
                        onChange={(event) => setProfileNameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            saveProfileName();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelProfileNameEdit();
                          }
                        }}
                        placeholder="Your arena name"
                        autoFocus
                      />
                    </label>
                    <div className="profile-name-editor-actions">
                      <button
                        className="profile-name-action profile-name-action-save"
                        type="button"
                        onClick={saveProfileName}
                        aria-label="Save arena name"
                        title="Save arena name"
                      >
                        <AiOutlineSave />
                      </button>
                      <button
                        className="profile-name-action"
                        type="button"
                        onClick={cancelProfileNameEdit}
                        aria-label="Cancel name edit"
                        title="Cancel"
                      >
                        <AiOutlineClose />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="profile-name-current">
                      <small>Arena Name</small>
                      <strong>{savedProfileName}</strong>
                      <span>This name appears in rooms and match records.</span>
                    </div>
                    <button className="profile-name-action profile-name-action-edit" type="button" onClick={beginProfileNameEdit}>
                      <AiOutlineEdit /> Edit
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {playMode === 'online' && !isSinglePlayerMode && onCreatePublic && onCreatePrivate ? (
            <section className="lobby-panel lobby-panel-create lobby-panel-room-create">
              <div className="lobby-panel-head lobby-panel-head-static">
                <span className="lobby-panel-icon lobby-panel-icon-create"><AiOutlinePlusCircle /></span>
                <div>
                  <p className="lobby-panel-title">Create Online Room</p>
                  <p className="lobby-panel-subtitle">
                    Spin up a public room for quick joins or private room for invite-only matches.
                  </p>
                </div>
              </div>
              <div className="lobby-room-builder-overview">
                <span className="lobby-room-builder-mark">
                  {createRoomMode === 'public' ? <AiOutlineGlobal /> : <AiOutlineKey />}
                </span>
                <div>
                  <small>Room Blueprint</small>
                  <strong>{createRoomMode === 'public' ? 'Open Arena' : 'Invite Vault'}</strong>
                </div>
                <span className="lobby-room-builder-game">{selectedGameName}</span>
              </div>
              <div className="create-room-visibility">
                <button
                  className={classnames(
                    'create-room-mode-btn',
                    createRoomMode === 'public' && 'create-room-mode-btn-active'
                  )}
                  type="button"
                  disabled={!supportsOnline}
                  onClick={() => setCreateRoomMode('public')}
                >
                  <AiOutlineGlobal /> Public Room
                </button>
                <button
                  className={classnames(
                    'create-room-mode-btn',
                    createRoomMode === 'private' && 'create-room-mode-btn-active'
                  )}
                  type="button"
                  disabled={!supportsOnline}
                  onClick={() => setCreateRoomMode('private')}
                >
                  <AiOutlineKey /> Private Room
                </button>
              </div>
              <p className="create-room-mode-hint">
                {createRoomMode === 'public'
                  ? 'Public rooms show in discovery and can be joined quickly.'
                  : 'Private rooms stay hidden and require your room code.'}
              </p>
              <div className="lobby-row">
                <input
                  className="lobby-input"
                  value={roomName}
                  disabled={!supportsOnline}
                  onChange={(event) => onRoomNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCreateRoom();
                    }
                  }}
                  placeholder={supportsOnline ? `${selectedGameName} room name` : 'Online rooms are disabled for this game'}
                />
                <button
                  className={classnames('lobby-btn', 'custome-shadow', 'lobby-btn-create-primary')}
                  type="button"
                  disabled={isLoading || !supportsOnline}
                  onClick={handleCreateRoom}
                >
                  <AiOutlinePlusCircle />
                  {createRoomMode === 'public' ? 'Create Public Room' : 'Create Private Room'}
                </button>
              </div>
              <div className="create-room-suggestions">
                {roomNameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className={classnames(
                      'create-room-suggestion-btn',
                      roomName === suggestion && 'create-room-suggestion-btn-active'
                    )}
                    type="button"
                    disabled={!supportsOnline}
                    onClick={() => onRoomNameChange(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="create-room-name-meta">
                {roomName.trim().length > 0
                  ? `${roomName.trim().length} characters`
                  : 'Leave blank to use default room naming.'}
              </p>
            </section>
          ) : null}

          {playMode === 'offline' ? (
            <section className="lobby-panel lobby-panel-create lobby-panel-local">
              <div className="lobby-panel-head lobby-panel-head-static">
                <span className="lobby-panel-icon lobby-panel-icon-local"><AiOutlineDesktop /></span>
                <div>
                  <p className="lobby-panel-title">Local Setup</p>
                  <p className="lobby-panel-subtitle">
                    Configure local players. Turns rotate per team on one device.
                  </p>
                </div>
              </div>
              <div className="lobby-local-overview">
                <span className="lobby-local-overview-count">{offlinePlayerCount}</span>
                <div>
                  <small>Player Roster</small>
                  <strong>One device, shared arena</strong>
                </div>
                <AiOutlineDesktop />
              </div>
              <div className="lobby-row">
                <label className="lobby-select-stack lobby-offline-count">
                  <span className="lobby-select-caption">Local Players</span>
                  <select
                    className="settings-select lobby-select-control"
                    value={offlinePlayerCount}
                    onChange={(event) =>
                      onOfflinePlayerCountChange(
                        Math.max(2, Number.parseInt(event.target.value, 10) || 2)
                      )
                    }
                  >
                    {Array.from(
                      { length: Math.max(0, (selectedDefinition?.maxPlayers ?? 2) - 1) },
                      (_, index) => index + 2
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count} Players
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="lobby-offline-players">
                {offlineSeats.map((seat) => (
                  <label key={seat.token} className="lobby-select-stack lobby-offline-player">
                    <span className="lobby-local-seat-head">
                      <span className="lobby-local-seat-number">{seat.index + 1}</span>
                      <span className="lobby-select-caption">{seat.label}</span>
                    </span>
                    <input
                      className="lobby-input"
                      value={offlinePlayerNames[seat.index] || ''}
                      onChange={(event) => onOfflinePlayerNameChange(seat.index, event.target.value)}
                      placeholder={seat.label}
                    />
                  </label>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {playMode === 'online' && !isSinglePlayerMode && onJoinByCode ? (
          <section className="lobby-panel lobby-panel-join lobby-panel-private-join">
            <div className="lobby-panel-head">
              <span className="lobby-panel-icon lobby-panel-icon-join"><AiOutlineKey /></span>
              <div>
                <p className="lobby-panel-title">Join Private Room</p>
                <p className="lobby-panel-subtitle">Have a code? Paste it and jump straight into the match.</p>
              </div>
              <span className="join-room-chip">
                <AiOutlineKey /> 8-Char Code
              </span>
            </div>
            <div className="lobby-row lobby-row-join">
              <input
                className="lobby-input"
                value={joinCode}
                disabled={!supportsOnline}
                onChange={(event) =>
                  onJoinCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!isLoading && supportsOnline && onJoinByCode) {
                      onJoinByCode();
                    }
                  }
                }}
                placeholder={supportsOnline ? 'private room code' : 'Join by code is disabled for this game'}
              />
              <button
                className={classnames('lobby-btn', 'custome-shadow', 'join-room-btn-primary')}
                type="button"
                disabled={isLoading || !supportsOnline}
                onClick={onJoinByCode}
              >
                <AiOutlineKey /> Join by Code
              </button>
            </div>
            <p className="join-room-hint">Tip: code accepts letters and numbers only, and auto-formats as you type.</p>
          </section>
        ) : null}

        {playMode === 'online' && !isSinglePlayerMode && onRefreshRooms && onJoinRoom ? (
          <div className="public-rooms lobby-panel lobby-panel-public-rooms">
            <div className="lobby-panel-head lobby-panel-head-static public-room-head">
              <span className="lobby-panel-icon lobby-panel-icon-public"><AiOutlineGlobal /></span>
              <div>
                <p className="lobby-panel-title">Public Rooms | {selectedGameName}</p>
                <p className="lobby-panel-subtitle">Discover active rooms and use filters to find your next match.</p>
              </div>
            </div>
            {supportsOnline ? (
              <>
                <div className="lobby-room-owner-tabs" role="tablist" aria-label="Room host filter">
                  {([
                    { id: 'all', label: 'All Rooms', count: roomOwnershipCounts.all },
                    { id: 'mine', label: 'Hosted By Me', count: roomOwnershipCounts.mine },
                    { id: 'others', label: 'Other Hosts', count: roomOwnershipCounts.others },
                  ] as const).map((ownershipOption) => (
                    <button
                      key={ownershipOption.id}
                      className={classnames(
                        'lobby-room-owner-tab',
                        roomOwnershipFilter === ownershipOption.id && 'lobby-room-owner-tab-active'
                      )}
                      type="button"
                      role="tab"
                      aria-selected={roomOwnershipFilter === ownershipOption.id}
                      onClick={() => setRoomOwnershipFilter(ownershipOption.id)}
                    >
                      <span>{ownershipOption.label}</span>
                      <strong>{ownershipOption.count}</strong>
                    </button>
                  ))}
                </div>
                <div className="public-room-summary lobby-room-metrics">
                  <div><strong>{roomStats.total}</strong><span>Total</span></div>
                  <div><strong>{roomStats.waiting}</strong><span>Waiting</span></div>
                  <div><strong>{roomStats.playing}</strong><span>Playing</span></div>
                  <div><strong>{roomStats.openSlots}</strong><span>Open</span></div>
                </div>

                <div className="public-room-tools">
                  <label className="public-room-tool public-room-search-tool">
                    <AiOutlineSearch />
                    <span>Search</span>
                    <input
                      className="public-room-tool-field public-room-search"
                      value={roomQuery}
                      onChange={(event) => setRoomQuery(event.target.value)}
                      placeholder="Room name or code"
                    />
                  </label>
                  <label className="public-room-tool public-room-status-tool">
                    <AiOutlineFilter />
                    <span>Status</span>
                    <select
                      className="public-room-tool-field public-room-status-select"
                      value={roomStatusFilter}
                      onChange={(event) =>
                        setRoomStatusFilter(event.target.value as 'all' | 'waiting' | 'playing' | 'open')
                      }
                    >
                      <option value="all">All Status</option>
                      <option value="waiting">Waiting</option>
                      <option value="playing">Playing</option>
                      <option value="open">Open Slots</option>
                    </select>
                  </label>
                  <button
                    className="public-room-tool public-room-refresh-btn"
                    type="button"
                    disabled={isLoading}
                    onClick={onRefreshRooms}
                  >
                    <AiOutlineReload />
                    <span>
                      <small>Rooms</small>
                      {isLoading ? 'Refreshing...' : 'Refresh List'}
                    </span>
                  </button>
                </div>
              </>
            ) : null}
            {!supportsOnline ? (
              <p className="public-room-empty">{formatGameName(selectedGame, games)} is single-player only. Start a solo run above.</p>
            ) : filteredRooms.length === 0 ? (
              <div className="public-room-empty lobby-room-empty-state">
                <AiOutlineGlobal />
                <strong>No rooms in this lane</strong>
                <span>Try another host tab, status, or search phrase.</span>
              </div>
            ) : (
              filteredRooms.map((roomItem) => {
                const isOwnedRoom = isPlayerHostedRoom(roomItem);
                const roomFill = Math.min(100, (roomItem.playersCount / Math.max(1, roomItem.maxPlayers)) * 100);
                return (
                  <article
                    key={roomItem.code}
                    className={classnames('public-room-item', isOwnedRoom && 'public-room-item-owned')}
                  >
                    <div className="public-room-host">
                      <span className="public-room-host-avatar">{roomItem.creatorName.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <small>{isOwnedRoom ? 'Your Room' : 'Hosted By'}</small>
                        <strong>{roomItem.creatorName}</strong>
                      </div>
                      {isOwnedRoom ? <span className="public-room-owned-badge">Mine</span> : null}
                    </div>
                    <div className="public-room-main">
                      <div className="public-room-top">
                        <div>
                          <small className="public-room-game-label">{formatGameName(roomItem.gameType, games)}</small>
                          <p className="public-room-title">{roomItem.name}</p>
                        </div>
                        <span
                          className={classnames(
                            'public-room-status-pill',
                            roomItem.status === 'waiting' && 'public-room-status-pill-waiting',
                            roomItem.status === 'playing' && 'public-room-status-pill-playing',
                            roomItem.status === 'finished' && 'public-room-status-pill-finished'
                          )}
                        >
                          {roomItem.status === 'waiting' ? (
                            <AiOutlineClockCircle />
                          ) : roomItem.status === 'playing' ? (
                            <AiOutlinePlayCircle />
                          ) : (
                            <AiOutlineCheckCircle />
                          )}{' '}
                          {roomItem.status}
                        </span>
                      </div>
                      <div className="public-room-capacity">
                        <div>
                          <span><AiOutlineTeam /> Players</span>
                          <strong>{roomItem.playersCount}/{roomItem.maxPlayers}</strong>
                        </div>
                        <span className="public-room-capacity-track">
                          <span style={{ width: `${roomFill}%` }} />
                        </span>
                      </div>
                      <div className="public-room-meta">
                        <span className="public-room-meta-pill">Updated {formatUpdatedTime(roomItem.updatedAt)}</span>
                        {roomItem.players.map((joinedPlayer) => (
                          <span key={`${roomItem.code}-${joinedPlayer.playerId}`} className="public-room-player-chip">
                            <strong>{joinedPlayer.symbol}</strong> {joinedPlayer.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="public-room-actions">
                      <button
                        className="public-room-code-action"
                        type="button"
                        onClick={() => void handleCopyRoomCode(roomItem.code)}
                        title={copiedRoomCode === roomItem.code ? 'Copied' : 'Copy room code'}
                      >
                        <span>Room Code</span>
                        <strong>{roomItem.code}</strong>
                        <AiOutlineCopy />
                      </button>
                      <button
                        className={classnames(
                          'lobby-btn',
                          'custome-shadow',
                          'public-room-join-btn',
                          roomItem.playersCount >= roomItem.maxPlayers && 'public-room-join-btn-full'
                        )}
                        type="button"
                        disabled={isLoading || roomItem.playersCount >= roomItem.maxPlayers}
                        onClick={() => onJoinRoom(roomItem.code)}
                      >
                        {roomItem.playersCount >= roomItem.maxPlayers ? 'Room Full' : isOwnedRoom ? 'Enter Room' : 'Join Room'}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : null}
      </div>

    </section>
  );
}
