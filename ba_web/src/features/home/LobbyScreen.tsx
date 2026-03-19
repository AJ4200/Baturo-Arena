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
  const selectedDefinition = useMemo(
    () => games.find((gameItem) => gameItem.id === selectedGame) || games[0],
    [games, selectedGame]
  );
  const supportsOnline = selectedDefinition?.supportsOnline ?? true;
  const supportsCpu = selectedDefinition?.supportsCpu ?? true;

  const filteredRooms = useMemo(
    () => publicRooms.filter((roomItem) => roomItem.gameType === selectedGame),
    [publicRooms, selectedGame]
  );

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
          <input className="lobby-input" value={playerName} onChange={(event) => onPlayerNameChange(event.target.value)} placeholder="your name" />
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
            onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
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
          {!supportsOnline ? (
            <p>{formatGameName(selectedGame, games)} is single-player only. Start a solo run above.</p>
          ) : filteredRooms.length === 0 ? (
            <p>No public rooms yet for this game.</p>
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
                    | <AiOutlineTeam /> {roomItem.playersCount}/{roomItem.maxPlayers} players
                  </p>
                </div>
                <button className={classnames('lobby-btn', 'custome-shadow')} type="button" disabled={isLoading} onClick={() => onJoinRoom(roomItem.code)}>
                  Join
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {message ? <p className="lobby-message">{message}</p> : null}
    </section>
  );
}
