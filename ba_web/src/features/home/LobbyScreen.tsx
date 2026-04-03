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
  AiOutlineTeam,
} from 'react-icons/ai';
import { useCallback, useMemo, useState } from 'react';
import { formatGameName } from '@/lib/games';
import type { CpuDifficulty, GameDefinition, GameType, PlayerProfile, PublicRoom } from '@/types/game';
import type { GoogleAccount } from '@/features/home/ProfileDock';

type LobbyScreenProps = {
  playerName: string;
  roomName: string;
  joinCode: string;
  selectedGame: GameType;
  cpuDifficulty: CpuDifficulty;
  games: GameDefinition[];
  publicRooms: PublicRoom[];
  playerProfile: PlayerProfile | null;
  googleAccount: GoogleAccount | null;
  message: string;
  isLoading: boolean;
  onClearMessage: () => void;
  onBack: () => void;
  onGameChange: (value: GameType) => void;
  onCpuDifficultyChange: (difficulty: CpuDifficulty) => void;
  onPlayerNameChange: (value: string) => void;
  onRoomNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onSaveName: () => void;
  onCreatePublic: () => void;
  onCreatePrivate: () => void;
  onJoinByCode: () => void;
  onRefreshRooms: () => void;
  onJoinRoom: (code: string) => void;
  onPlayCpu: () => void;
};

export function LobbyScreen({
  playerName,
  roomName,
  joinCode,
  selectedGame,
  cpuDifficulty,
  games,
  publicRooms,
  playerProfile,
  googleAccount,
  message,
  isLoading,
  onClearMessage,
  onBack,
  onGameChange,
  onCpuDifficultyChange,
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
}: LobbyScreenProps) {
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState<'all' | 'waiting' | 'playing' | 'open'>('all');
  const [createRoomMode, setCreateRoomMode] = useState<'public' | 'private'>('public');
  const selectedDefinition = useMemo(
    () => games.find((gameItem) => gameItem.id === selectedGame) || games[0],
    [games, selectedGame]
  );
  const supportsOnline = selectedDefinition?.supportsOnline ?? true;
  const supportsCpu = selectedDefinition?.supportsCpu ?? true;
  const selectedGameName = formatGameName(selectedGame, games);
  const selectedGameDescription = selectedDefinition?.description || 'Choose a mode and jump in.';
  const profilePreviewName = (playerProfile?.name || playerName || '').trim() || 'Player';
  const profilePreviewAvatarUrl =
    googleAccount?.picture || `https://robohash.org/${encodeURIComponent(profilePreviewName)}?size=160x160`;
  const isGoogleConnected = Boolean(googleAccount?.sub);
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

  const roomStats = useMemo(() => {
    const total = gameRooms.length;
    const waiting = gameRooms.filter((roomItem) => roomItem.status === 'waiting').length;
    const playing = gameRooms.filter((roomItem) => roomItem.status === 'playing').length;
    const openSlots = gameRooms.filter((roomItem) => roomItem.playersCount < roomItem.maxPlayers).length;
    return { total, waiting, playing, openSlots };
  }, [gameRooms]);

  const filteredRooms = useMemo(() => {
    const normalizedQuery = roomQuery.trim().toLowerCase();

    return gameRooms
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
  }, [gameRooms, roomQuery, roomStatusFilter]);
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
    if (!supportsOnline || isLoading) {
      return;
    }
    if (createRoomMode === 'public') {
      onCreatePublic();
      return;
    }
    onCreatePrivate();
  };

  return (
    <section className="title-screen-content">
      <h1>
        <span>Baturo</span>
        <span>-</span>
        <span>Arena</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-control-bar">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>

          <div className="lobby-control-main">
            <div className="lobby-control-stack">
              <label className="lobby-select-stack">
                <span className="lobby-select-caption">Selected Game</span>
                <select
                  className="settings-select lobby-select-control"
                  value={selectedGame}
                  onChange={(event) => onGameChange(event.target.value as GameType)}
                >
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="lobby-difficulty-stack">
                <span className="lobby-select-caption">CPU Difficulty</span>
                <div className="lobby-difficulty-tabs" aria-label="CPU difficulty">
                  {(['easy', 'medium', 'hard'] as CpuDifficulty[]).map((difficultyOption) => (
                    <button
                      key={difficultyOption}
                      className={classnames(
                        'lobby-difficulty-tab',
                        cpuDifficulty === difficultyOption && 'lobby-difficulty-tab-active'
                      )}
                      type="button"
                      disabled={!supportsCpu}
                      aria-pressed={cpuDifficulty === difficultyOption}
                      onClick={() => onCpuDifficultyChange(difficultyOption)}
                    >
                      {difficultyOption}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              className={classnames('lobby-btn', 'custome-shadow', 'lobby-cpu-cta')}
              type="button"
              disabled={!supportsCpu}
              onClick={onPlayCpu}
            >
              <span className="lobby-cpu-cta-main">
                {supportsOnline ? <AiOutlineRobot /> : <AiOutlinePlayCircle />} Play {selectedGameName}{' '}
                {supportsOnline ? 'vs CPU' : 'Solo'}
              </span>
              <small>{supportsCpu ? 'Quick practice run' : 'CPU mode unavailable for this game'}</small>
            </button>
          </div>
        </div>

        <div className="lobby-game-banner">
          <div className="lobby-game-banner-head">
            <strong>{selectedGameName}</strong>
            <div className="lobby-game-flags">
              <span className="lobby-flag">
                <AiOutlineTeam /> {selectedDefinition?.minPlayers ?? 1}-{selectedDefinition?.maxPlayers ?? 1} Players
              </span>
              <span className={classnames('lobby-flag', supportsOnline ? 'lobby-flag-on' : 'lobby-flag-off')}>
                Online {supportsOnline ? 'On' : 'Off'}
              </span>
              <span className={classnames('lobby-flag', supportsCpu ? 'lobby-flag-on' : 'lobby-flag-off')}>
                CPU {supportsCpu ? 'On' : 'Off'}
              </span>
            </div>
          </div>
          <span>{selectedGameDescription}</span>
          <p className="lobby-key-hint">Tip: press Enter in the fields below for quicker actions.</p>
        </div>

        <div className="lobby-content-grid">
          <section className="lobby-panel">
            <div className="lobby-panel-head lobby-panel-head-static">
              <div>
                <p className="lobby-panel-title">Profile</p>
                <p className="lobby-panel-subtitle">Set how your name appears in rooms and leaderboards.</p>
              </div>
            </div>
            <div className="lobby-profile-preview">
              <div className="lobby-profile-avatar-shell">
                <img
                  src={profilePreviewAvatarUrl}
                  alt={`${profilePreviewName} avatar preview`}
                  className="lobby-profile-avatar"
                />
              </div>
            <div className="lobby-profile-meta">
              <strong>{profilePreviewName}</strong>
              <span>
                {playerProfile ? `Player ID: ${playerProfile.playerId}` : 'Live avatar preview'}
                {isGoogleConnected ? ' | Google connected' : ' | Guest mode'}
              </span>
              {isGoogleConnected && googleAccount?.email ? <span>{googleAccount.email}</span> : null}
            </div>
            </div>
            {playerProfile ? (
              <div className="public-room-summary">
                <span className="public-room-pill">Wins {playerProfile.wins}</span>
                <span className="public-room-pill">Losses {playerProfile.losses}</span>
                <span className="public-room-pill">Draws {playerProfile.draws}</span>
              </div>
            ) : null}
            <div className="lobby-row">
              <input
                className="lobby-input"
                value={playerName}
                onChange={(event) => onPlayerNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSaveName();
                  }
                }}
                placeholder="your name"
              />
              <button className={classnames('lobby-btn', 'custome-shadow')} type="button" onClick={onSaveName}>
                Save Name
              </button>
            </div>
          </section>

          <section className="lobby-panel lobby-panel-create">
            <div className="lobby-panel-head lobby-panel-head-static">
              <div>
                <p className="lobby-panel-title">Create Online Room</p>
                <p className="lobby-panel-subtitle">
                  Spin up a public room for quick joins or private room for invite-only matches.
                </p>
              </div>
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
                Public Room
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
                Private Room
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
        </div>

        <section className="lobby-panel lobby-panel-join">
          <div className="lobby-panel-head">
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
                  if (!isLoading && supportsOnline) {
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
              Join by Code
            </button>
          </div>
          <p className="join-room-hint">Tip: code accepts letters and numbers only, and auto-formats as you type.</p>
        </section>

        <div className="public-rooms lobby-panel">
          <div className="lobby-panel-head lobby-panel-head-static public-room-head">
            <div>
              <p className="lobby-panel-title">Public Rooms | {selectedGameName}</p>
              <p className="lobby-panel-subtitle">Discover active rooms and use filters to find your next match.</p>
            </div>
          </div>
          {supportsOnline ? (
            <>
              <div className="public-room-summary">
                <span className="public-room-pill">Total {roomStats.total}</span>
                <span className="public-room-pill">Waiting {roomStats.waiting}</span>
                <span className="public-room-pill">Playing {roomStats.playing}</span>
                <span className="public-room-pill">Open {roomStats.openSlots}</span>
              </div>

              <div className="public-room-tools">
                <input
                  className="lobby-input public-room-search"
                  value={roomQuery}
                  onChange={(event) => setRoomQuery(event.target.value)}
                  placeholder="Search room name or code"
                />
                <select
                  className="settings-select"
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
                <button
                  className={classnames('lobby-btn', 'custome-shadow', 'public-room-refresh-btn')}
                  type="button"
                  disabled={isLoading}
                  onClick={onRefreshRooms}
                >
                  <AiOutlineReload /> Refresh List
                </button>
              </div>
            </>
          ) : null}
          {!supportsOnline ? (
            <p className="public-room-empty">{formatGameName(selectedGame, games)} is single-player only. Start a solo run above.</p>
          ) : filteredRooms.length === 0 ? (
            <p className="public-room-empty">No public rooms match this filter yet.</p>
          ) : (
            filteredRooms.map((roomItem) => (
              <div key={roomItem.code} className="public-room-item">
                <div className="public-room-main">
                  <div className="public-room-top">
                    <p className="public-room-title">{roomItem.name}</p>
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
                  <div className="public-room-meta">
                    <span className="public-room-meta-pill">
                      <AiOutlineTeam /> {roomItem.playersCount}/{roomItem.maxPlayers} players
                    </span>
                    <span className="public-room-meta-pill">{formatGameName(roomItem.gameType, games)}</span>
                    <span className="public-room-meta-pill">Host {roomItem.creatorName}</span>
                    <span className="public-room-meta-pill">Updated {formatUpdatedTime(roomItem.updatedAt)}</span>
                    <span className="public-room-meta-pill public-room-code-pill">
                      Code <span className="public-room-code-badge">{roomItem.code}</span>
                    </span>
                    <button
                      className="room-code-copy-btn"
                      type="button"
                      onClick={() => void handleCopyRoomCode(roomItem.code)}
                      aria-label={`Copy room code ${roomItem.code}`}
                      title={copiedRoomCode === roomItem.code ? 'Copied' : 'Copy room code'}
                    >
                      <AiOutlineCopy />
                    </button>
                    {copiedRoomCode === roomItem.code ? <span className="room-code-copy-feedback">Copied</span> : null}
                  </div>
                  {roomItem.players.length > 0 ? (
                    <div className="public-room-meta">
                      {roomItem.players.map((joinedPlayer) => (
                        <span key={`${roomItem.code}-${joinedPlayer.playerId}`} className="public-room-meta-pill">
                          {joinedPlayer.symbol} · {joinedPlayer.name} ({joinedPlayer.wins}-{joinedPlayer.losses}-
                          {joinedPlayer.draws})
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
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
                  {roomItem.playersCount >= roomItem.maxPlayers ? 'Full' : 'Join'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {message ? (
        <div className="lobby-message-row">
          <p className="lobby-message">{message}</p>
          <button className="lobby-message-dismiss" type="button" onClick={onClearMessage}>
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  );
}
