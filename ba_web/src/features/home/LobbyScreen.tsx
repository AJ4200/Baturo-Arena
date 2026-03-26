import classnames from 'classnames';
import {
  AiOutlineArrowLeft,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCopy,
  AiOutlinePlayCircle,
  AiOutlineRobot,
  AiOutlineTeam,
} from 'react-icons/ai';
import { useMemo, useState } from 'react';
import { formatGameName } from '@/lib/games';
import type { GameDefinition, GameType, PublicRoom } from '@/types/game';

type LobbyScreenProps = {
  playerName: string;
  roomName: string;
  joinCode: string;
  selectedGame: GameType;
  games: GameDefinition[];
  publicRooms: PublicRoom[];
  message: string;
  isLoading: boolean;
  onClearMessage: () => void;
  onBack: () => void;
  onGameChange: (value: GameType) => void;
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
  games,
  publicRooms,
  message,
  isLoading,
  onClearMessage,
  onBack,
  onGameChange,
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
  const selectedDefinition = useMemo(
    () => games.find((gameItem) => gameItem.id === selectedGame) || games[0],
    [games, selectedGame]
  );
  const supportsOnline = selectedDefinition?.supportsOnline ?? true;
  const supportsCpu = selectedDefinition?.supportsCpu ?? true;

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

  return (
    <section className="title-screen-content">
      <h1>
        <span>Baturo</span>
        <span>-</span>
        <span>Arena</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <select className="settings-select" value={selectedGame} onChange={(event) => onGameChange(event.target.value as GameType)}>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={!supportsCpu} onClick={onPlayCpu}>
            {supportsOnline ? <AiOutlineRobot /> : <AiOutlinePlayCircle />} Play {formatGameName(selectedGame, games)} {supportsOnline ? 'vs CPU' : 'Solo'}
          </button>
        </div>

        <div className="lobby-game-banner">
          <strong>{formatGameName(selectedGame, games)}</strong>
          <span>{games.find((game) => game.id === selectedGame)?.description}</span>
        </div>

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

        <div className="lobby-row">
          <input
            className="lobby-input"
            value={roomName}
            disabled={!supportsOnline}
            onChange={(event) => onRoomNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!isLoading && supportsOnline) {
                  onCreatePublic();
                }
              }
            }}
            placeholder={supportsOnline ? `${formatGameName(selectedGame, games)} room name` : 'Online rooms are disabled for this game'}
          />
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={isLoading || !supportsOnline} onClick={onCreatePublic}>
            Create Public
          </button>
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={isLoading || !supportsOnline} onClick={onCreatePrivate}>
            Create Private
          </button>
        </div>

        <div className="lobby-row">
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
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={isLoading || !supportsOnline} onClick={onJoinByCode}>
            Join by Code
          </button>
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={!supportsOnline} onClick={onRefreshRooms}>
            Refresh List
          </button>
        </div>

        <div className="public-rooms">
          <h2>Public Rooms | {formatGameName(selectedGame, games)}</h2>
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
              </div>
            </>
          ) : null}
          {!supportsOnline ? (
            <p>{formatGameName(selectedGame, games)} is single-player only. Start a solo run above.</p>
          ) : filteredRooms.length === 0 ? (
            <p>No public rooms match this filter yet.</p>
          ) : (
            filteredRooms.map((roomItem) => (
              <div key={roomItem.code} className="public-room-item">
                <div>
                  <p className="public-room-title">{roomItem.name}</p>
                  <p className="public-room-meta">
                    {roomItem.status === 'waiting' ? <AiOutlineClockCircle /> : roomItem.status === 'playing' ? <AiOutlinePlayCircle /> : <AiOutlineCheckCircle />}{' '}
                    {roomItem.status} | {formatGameName(roomItem.gameType, games)} |{' '}
                    <span className="public-room-code-badge">{roomItem.code}</span>
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
                    | <AiOutlineTeam /> {roomItem.playersCount}/{roomItem.maxPlayers} players
                  </p>
                </div>
                <button
                  className={classnames('lobby-btn', 'custome-shadow')}
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
