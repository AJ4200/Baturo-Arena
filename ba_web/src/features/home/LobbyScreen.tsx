import classnames from "classnames";
import {
  AiOutlineArrowLeft,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineCopy,
  AiOutlinePlayCircle,
  AiOutlineRobot,
  AiOutlineTeam,
} from "react-icons/ai";
import { useState } from "react";
import type { PublicRoom } from "@/types/game";

type LobbyScreenProps = {
  playerName: string;
  roomName: string;
  joinCode: string;
  publicRooms: PublicRoom[];
  message: string;
  isLoading: boolean;
  onBack: () => void;
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
  publicRooms,
  message,
  isLoading,
  onBack,
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
        <span>Tic-</span>
        <span>Tac</span>
        <span>-Two</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onPlayCpu}>
            <AiOutlineRobot /> Play vs CPU
          </button>
        </div>

        <div className="lobby-row">
          <input
            className="lobby-input"
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            placeholder="your name"
          />
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onSaveName}>
            Save Name
          </button>
        </div>

        <div className="lobby-row">
          <input
            className="lobby-input"
            value={roomName}
            onChange={(event) => onRoomNameChange(event.target.value)}
            placeholder="room name"
          />
          <button
            className={classnames("lobby-btn", "custome-shadow")}
            type="button"
            disabled={isLoading}
            onClick={onCreatePublic}
          >
            Create Public
          </button>
          <button
            className={classnames("lobby-btn", "custome-shadow")}
            type="button"
            disabled={isLoading}
            onClick={onCreatePrivate}
          >
            Create Private
          </button>
        </div>

        <div className="lobby-row">
          <input
            className="lobby-input"
            value={joinCode}
            onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
            placeholder="private room code"
          />
          <button
            className={classnames("lobby-btn", "custome-shadow")}
            type="button"
            disabled={isLoading}
            onClick={onJoinByCode}
          >
            Join by Code
          </button>
          <button className={classnames("lobby-btn", "custome-shadow")} type="button" onClick={onRefreshRooms}>
            Refresh List
          </button>
        </div>

        <div className="public-rooms">
          <h2>Public Rooms</h2>
          {publicRooms.length === 0 ? (
            <p>No public rooms yet.</p>
          ) : (
            publicRooms.map((roomItem) => (
              <div key={roomItem.code} className="public-room-item">
                <div>
                  <p className="public-room-title">{roomItem.name}</p>
                  <p className="public-room-meta">
                    {roomItem.status === "waiting" ? (
                      <AiOutlineClockCircle />
                    ) : roomItem.status === "playing" ? (
                      <AiOutlinePlayCircle />
                    ) : (
                      <AiOutlineCheckCircle />
                    )}{" "}
                    {roomItem.status} |{" "}
                    <span className="public-room-code-badge">{roomItem.code}</span>
                    <button
                      className="room-code-copy-btn"
                      type="button"
                      onClick={() => void handleCopyRoomCode(roomItem.code)}
                      aria-label={`Copy room code ${roomItem.code}`}
                      title={copiedRoomCode === roomItem.code ? "Copied" : "Copy room code"}
                    >
                      <AiOutlineCopy />
                    </button>
                    | <AiOutlineTeam /> {roomItem.playersCount}/2 players
                  </p>
                </div>
                <button
                  className={classnames("lobby-btn", "custome-shadow")}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onJoinRoom(roomItem.code)}
                >
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
