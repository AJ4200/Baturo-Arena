'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import classnames from 'classnames';
import {
  AiOutlineCheck,
  AiOutlineBell,
  AiOutlineClose,
  AiOutlineComment,
  AiOutlineInfoCircle,
  AiOutlineInbox,
  AiOutlineLoading3Quarters,
  AiOutlineMail,
  AiOutlineSearch,
  AiOutlineSend,
  AiOutlineTeam,
  AiOutlineUserAdd,
} from 'react-icons/ai';
import type { PlayerProfile } from '@/types/game';

type SocialPlayer = PlayerProfile & {
  avatarUrl?: string | null;
  relation?: 'none' | 'incoming' | 'outgoing' | 'raiburu';
  requestId?: number | null;
};

type Raiburu = {
  requestId: number;
  player: PlayerProfile;
  acceptedAt: string;
  lastMessage: {
    body: string;
    createdAt: string;
  } | null;
  unreadCount: number;
};

type RaiburuRequest = {
  id: number;
  direction: 'incoming' | 'outgoing';
  message: string;
  status: 'pending';
  createdAt: string;
  updatedAt: string;
  requester: PlayerProfile;
  recipient: PlayerProfile;
};

type RaiburuMessage = {
  id: number;
  kind: 'chat' | 'room_invite';
  body: string;
  roomCode: string | null;
  createdAt: string;
  readAt: string | null;
  sender: PlayerProfile;
  recipient: PlayerProfile;
  isMine: boolean;
};

type SocialSnapshot = {
  raiburus: Raiburu[];
  requests: RaiburuRequest[];
  notifications: SocialNotification[];
};

type SocialNotification = {
  id: string;
  type: 'request' | 'room_invite';
  requestId?: number;
  message: string;
  createdAt: string;
  player: PlayerProfile;
  roomCode: string | null;
};

type ChatDockProps = {
  isOpen: boolean;
  playerProfile: PlayerProfile | null;
  isOnlineReady: boolean;
  currentRoomCode: string | null;
  currentRoomName?: string;
  callApi: <T>(path: string, init?: RequestInit, showLoader?: boolean) => Promise<T>;
  onToggleOpen: () => void;
  onRequireSignIn: () => void;
  onJoinRoom: (code: string) => void;
  onStatusMessage: (message: string) => void;
};

const formatShortTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'now';
  }

  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getRecordLabel = (player: PlayerProfile): string => `${player.wins}W ${player.losses}L ${player.draws}D`;

const getWinRate = (player: PlayerProfile): number => {
  const totalGames = player.wins + player.losses + player.draws;
  if (totalGames <= 0) {
    return 0;
  }
  return Math.round((player.wins / totalGames) * 100);
};

const getPlayerRankTone = (player: PlayerProfile): 'fresh' | 'steady' | 'hot' => {
  if (player.wins >= 10 || getWinRate(player) >= 60) {
    return 'hot';
  }
  if (player.wins + player.losses + player.draws >= 3) {
    return 'steady';
  }
  return 'fresh';
};

const getPlayerAvatarUrl = (player: PlayerProfile & { avatarUrl?: string | null }): string =>
  player.avatarUrl || `https://robohash.org/${encodeURIComponent(player.name || player.playerId)}?size=160x160`;

export function ChatDock({
  isOpen,
  playerProfile,
  isOnlineReady,
  currentRoomCode,
  currentRoomName,
  callApi,
  onToggleOpen,
  onRequireSignIn,
  onJoinRoom,
  onStatusMessage,
}: ChatDockProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'alerts' | 'raiburus' | 'requests' | 'search'>('chat');
  const [raiburus, setRaiburus] = useState<Raiburu[]>([]);
  const [requests, setRequests] = useState<RaiburuRequest[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [selectedRaiburuId, setSelectedRaiburuId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RaiburuMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialPlayer[]>([]);
  const [requestTarget, setRequestTarget] = useState<SocialPlayer | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const incomingCount = useMemo(
    () => requests.filter((request) => request.direction === 'incoming').length,
    [requests]
  );
  const totalUnread = useMemo(
    () => raiburus.reduce((total, raiburu) => total + Number(raiburu.unreadCount || 0), 0),
    [raiburus]
  );
  const totalAlerts = notifications.length;
  const launcherBadgeCount = totalUnread + totalAlerts;
  const selectedRaiburu = useMemo(
    () => raiburus.find((raiburu) => raiburu.player.playerId === selectedRaiburuId) || null,
    [raiburus, selectedRaiburuId]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  const refreshSnapshot = useCallback(
    async (showLoader = false) => {
      if (!isOnlineReady) {
        setRaiburus([]);
        setRequests([]);
        setMessages([]);
        return;
      }

      const payload = await callApi<SocialSnapshot>('/api/social/snapshot', undefined, showLoader);
      setRaiburus(payload.raiburus);
      setRequests(payload.requests);
      setNotifications(payload.notifications || []);

      setSelectedRaiburuId((currentValue) => {
        if (currentValue && payload.raiburus.some((raiburu) => raiburu.player.playerId === currentValue)) {
          return currentValue;
        }
        return payload.raiburus[0]?.player.playerId || null;
      });
    },
    [callApi, isOnlineReady]
  );

  const loadConversation = useCallback(
    async (otherPlayerId: string, showLoader = false) => {
      if (!isOnlineReady) {
        return;
      }

      const payload = await callApi<{ messages: RaiburuMessage[] }>(
        `/api/social/messages/${encodeURIComponent(otherPlayerId)}`,
        undefined,
        showLoader
      );
      setMessages(payload.messages);
    },
    [callApi, isOnlineReady]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    refreshSnapshot(false).catch(() => {
      onStatusMessage('Could not load raiburu chat');
    });
  }, [isOpen, onStatusMessage, refreshSnapshot]);

  useEffect(() => {
    if (!isOpen || !selectedRaiburuId) {
      setMessages([]);
      return;
    }

    loadConversation(selectedRaiburuId, false).catch(() => {
      onStatusMessage('Could not load conversation');
    });
  }, [isOpen, loadConversation, onStatusMessage, selectedRaiburuId]);

  useEffect(() => {
    if (!isOpen || !isOnlineReady) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshSnapshot(false).catch(() => {});
      if (selectedRaiburuId) {
        loadConversation(selectedRaiburuId, false).catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isOnlineReady, isOpen, loadConversation, refreshSnapshot, selectedRaiburuId]);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const payload = await callApi<{ players: SocialPlayer[] }>(
        `/api/social/search?q=${encodeURIComponent(trimmedQuery)}`,
        undefined,
        false
      );
      setSearchResults(payload.players);
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : 'Could not search players');
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!requestTarget) {
      return;
    }

    try {
      setIsBusy(true);
      const payload = await callApi<SocialSnapshot>(
        '/api/social/requests',
        {
          method: 'POST',
          body: JSON.stringify({
            toPlayerId: requestTarget.playerId,
            message: requestMessage,
          }),
        },
        false
      );
      setRaiburus(payload.raiburus);
      setRequests(payload.requests);
      setRequestTarget(null);
      setRequestMessage('');
      onStatusMessage(`Raiburu request sent to ${requestTarget.name}`);
      await runSearch();
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : 'Could not send raiburu request');
    } finally {
      setIsBusy(false);
    }
  };

  const answerRequest = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      setIsBusy(true);
      const payload = await callApi<SocialSnapshot>(
        `/api/social/requests/${requestId}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
        false
      );
      setRaiburus(payload.raiburus);
      setRequests(payload.requests);
      onStatusMessage(action === 'accept' ? 'Raiburu added' : 'Raiburu request declined');
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : 'Could not update raiburu request');
    } finally {
      setIsBusy(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRaiburu || !draftMessage.trim()) {
      return;
    }

    try {
      setIsBusy(true);
      await callApi<{ message: RaiburuMessage }>(
        '/api/social/messages',
        {
          method: 'POST',
          body: JSON.stringify({
            toPlayerId: selectedRaiburu.player.playerId,
            body: draftMessage,
          }),
        },
        false
      );
      setDraftMessage('');
      await loadConversation(selectedRaiburu.player.playerId, false);
      await refreshSnapshot(false);
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsBusy(false);
    }
  };

  const sendInvite = async (targetPlayerId: string) => {
    if (!currentRoomCode) {
      onStatusMessage('Create or join an online room before inviting raiburus');
      return;
    }

    try {
      setIsBusy(true);
      await callApi<{ invite: RaiburuMessage }>(
        '/api/social/invites',
        {
          method: 'POST',
          body: JSON.stringify({
            toPlayerId: targetPlayerId,
            roomCode: currentRoomCode,
            message: inviteMessage,
          }),
        },
        false
      );
      setInviteMessage('');
      onStatusMessage('Room invite sent');
      if (targetPlayerId === selectedRaiburuId) {
        await loadConversation(targetPlayerId, false);
      }
      await refreshSnapshot(false);
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : 'Could not send invite');
    } finally {
      setIsBusy(false);
    }
  };

  const renderLockedState = () => (
    <div className="chat-empty-state">
      <AiOutlineTeam />
      <strong>Raiburu chat needs online sign-in</strong>
      <span>Connect Google to search players, add raiburus, message them, and send room invites.</span>
      <button className="lobby-btn custome-shadow chat-action-full" type="button" onClick={onRequireSignIn}>
        Open Profile
      </button>
    </div>
  );

  const renderPlayerStatsBlock = (targetPlayer: PlayerProfile, compact = false) => {
    const totalGames = targetPlayer.wins + targetPlayer.losses + targetPlayer.draws;
    const winRate = getWinRate(targetPlayer);
    const tone = getPlayerRankTone(targetPlayer);

    return (
      <div className={classnames('chat-player-stats-card', compact && 'chat-player-stats-card-compact', `chat-player-stats-card-${tone}`)}>
        <div className="chat-player-stats-head">
          <span>{tone === 'hot' ? 'Arena Hot' : tone === 'steady' ? 'Battle Tested' : 'Fresh Raiburu'}</span>
          <strong>{winRate}% WR</strong>
        </div>
        <div className="chat-stat-meter" aria-hidden="true">
          <span style={{ width: `${Math.max(4, winRate)}%` }} />
        </div>
        <div className="chat-stat-grid">
          <span><strong>{targetPlayer.wins}</strong> Wins</span>
          <span><strong>{targetPlayer.losses}</strong> Losses</span>
          <span><strong>{targetPlayer.draws}</strong> Draws</span>
          <span><strong>{totalGames}</strong> Games</span>
        </div>
      </div>
    );
  };

  const renderChatTab = () => (
    <div className="chat-dock-chat-grid">
      <div className="chat-raiburu-strip">
        {raiburus.length === 0 ? (
          <p className="chat-mini-empty">No raiburus yet. Search for players to send requests.</p>
        ) : (
          raiburus.map((raiburu) => (
            <button
              key={raiburu.player.playerId}
              className={classnames(
                'chat-raiburu-chip',
                selectedRaiburuId === raiburu.player.playerId && 'chat-raiburu-chip-active'
              )}
              type="button"
              onClick={() => {
                setSelectedRaiburuId(raiburu.player.playerId);
                setActiveTab('chat');
              }}
            >
              <span>{raiburu.player.name}</span>
              {raiburu.unreadCount > 0 ? <strong>{raiburu.unreadCount}</strong> : null}
            </button>
          ))
        )}
      </div>

      {selectedRaiburu ? (
        <>
          <div className="chat-conversation-head">
            <div>
              <strong>{selectedRaiburu.player.name}</strong>
              <span>{getRecordLabel(selectedRaiburu.player)}</span>
            </div>
            <button
              className="music-dock-head-btn"
              type="button"
              disabled={isBusy || !currentRoomCode}
              onClick={() => void sendInvite(selectedRaiburu.player.playerId)}
              aria-label="Invite selected raiburu to room"
              title={currentRoomCode ? 'Invite to current room' : 'Create or join a room first'}
            >
              <AiOutlineMail />
            </button>
          </div>

          {currentRoomCode ? (
            <input
              className="chat-input"
              value={inviteMessage}
              onChange={(event) => setInviteMessage(event.target.value)}
              maxLength={160}
              placeholder={`Optional invite note for ${currentRoomCode}`}
            />
          ) : null}

          <div className="chat-message-list">
            {messages.length === 0 ? (
              <p className="chat-mini-empty">Start the conversation. Keep the arena energy friendly.</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={classnames('chat-message', message.isMine ? 'chat-message-mine' : 'chat-message-theirs')}
                >
                  <span>{message.isMine ? 'You' : message.sender.name} | {formatShortTime(message.createdAt)}</span>
                  <p>{message.body}</p>
                  {message.kind === 'room_invite' && message.roomCode ? (
                    <button
                      className="chat-room-invite-btn"
                      type="button"
                      onClick={() => onJoinRoom(message.roomCode || '')}
                    >
                      Join Room {message.roomCode}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <form className="chat-composer" onSubmit={sendMessage}>
            <input
              className="chat-input"
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              maxLength={500}
              placeholder={`Message ${selectedRaiburu.player.name}`}
            />
            <button className="music-dock-icon-btn music-dock-icon-btn-main" type="submit" disabled={isBusy || !draftMessage.trim()}>
              {isBusy ? <AiOutlineLoading3Quarters className="animate-spin" /> : <AiOutlineSend />}
            </button>
          </form>
        </>
      ) : (
        <div className="chat-empty-state chat-empty-state-compact">
          <AiOutlineComment />
          <strong>Pick a raiburu</strong>
          <span>Accepted raiburus appear here for direct chat and room invites.</span>
        </div>
      )}
    </div>
  );

  const renderRequestsTab = () => (
    <div className="chat-request-list">
      {requests.length === 0 ? (
        <p className="chat-mini-empty">No pending raiburu requests.</p>
      ) : (
        requests.map((request) => {
          const otherPlayer = request.direction === 'incoming' ? request.requester : request.recipient;
          return (
            <div
              key={request.id}
              className={classnames(
                'chat-request-card',
                'chat-request-card-directed',
                request.direction === 'incoming' ? 'chat-request-card-incoming' : 'chat-request-card-outgoing'
              )}
            >
              <div>
                <div className="chat-request-route">
                  <span className={classnames('chat-direction-pill', request.direction === 'incoming' ? 'chat-direction-pill-in' : 'chat-direction-pill-out')}>
                    {request.direction === 'incoming' ? 'Received' : 'Sent'}
                  </span>
                  <small>{request.direction === 'incoming' ? `${otherPlayer.name} -> You` : `You -> ${otherPlayer.name}`}</small>
                </div>
                <strong>{otherPlayer.name}</strong>
                <span>{request.direction === 'incoming' ? 'Wants to be your raiburu' : 'Waiting for their answer'}</span>
                {request.message ? <p>{request.message}</p> : null}
                {renderPlayerStatsBlock(otherPlayer, true)}
              </div>
              {request.direction === 'incoming' ? (
                <div className="chat-request-actions">
                  <button className="music-dock-head-btn" type="button" disabled={isBusy} onClick={() => void answerRequest(request.id, 'accept')}>
                    <AiOutlineCheck />
                  </button>
                  <button className="music-dock-head-btn" type="button" disabled={isBusy} onClick={() => void answerRequest(request.id, 'decline')}>
                    <AiOutlineClose />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );

  const renderRaiburusTab = () => (
    <div className="chat-request-list">
      {raiburus.length === 0 ? (
        <p className="chat-mini-empty">Your raiburu list is waiting for its first name.</p>
      ) : (
        raiburus.map((raiburu) => (
          <div key={raiburu.player.playerId} className="chat-request-card chat-raiburu-card">
            <div>
              <strong>{raiburu.player.name}</strong>
              <span>{getRecordLabel(raiburu.player)}</span>
              {raiburu.lastMessage ? <p>{raiburu.lastMessage.body}</p> : <p>No messages yet.</p>}
              {renderPlayerStatsBlock(raiburu.player, true)}
            </div>
            <div className="chat-request-actions">
              <button
                className="music-dock-head-btn"
                type="button"
                onClick={() => {
                  setSelectedRaiburuId(raiburu.player.playerId);
                  setActiveTab('chat');
                }}
                aria-label={`Chat with ${raiburu.player.name}`}
              >
                <AiOutlineComment />
              </button>
              <button
                className="music-dock-head-btn"
                type="button"
                disabled={isBusy || !currentRoomCode}
                onClick={() => void sendInvite(raiburu.player.playerId)}
                aria-label={`Invite ${raiburu.player.name}`}
                title={currentRoomCode ? 'Invite to current room' : 'Create or join a room first'}
              >
                <AiOutlineMail />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderAlertsTab = () => (
    <div className="chat-alert-list">
      {notifications.length === 0 ? (
        <div className="chat-empty-state chat-empty-state-compact">
          <AiOutlineInbox />
          <strong>No alerts right now</strong>
          <span>Room invites, fresh raiburu requests, and social pings will collect here.</span>
        </div>
      ) : (
        notifications.map((notification) => (
          <div
            key={notification.id}
            className={classnames(
              'chat-alert-card',
              notification.type === 'room_invite' ? 'chat-alert-card-invite' : 'chat-alert-card-request'
            )}
          >
            <div className="chat-alert-icon">
              {notification.type === 'room_invite' ? <AiOutlineMail /> : <AiOutlineUserAdd />}
            </div>
            <div className="chat-alert-main">
              <div className="chat-alert-title-row">
                <strong>{notification.type === 'room_invite' ? 'Room Invite' : 'Raiburu Request'}</strong>
                <span>{formatShortTime(notification.createdAt)}</span>
              </div>
              <p>
                <b>{notification.player.name}</b>
                {notification.type === 'room_invite'
                  ? ` invited you to ${notification.roomCode || 'a room'}.`
                  : ' wants to become your raiburu.'}
              </p>
              {notification.message ? <small>{notification.message}</small> : null}
              {renderPlayerStatsBlock(notification.player, true)}
              <div className="chat-alert-actions">
                {notification.type === 'room_invite' && notification.roomCode ? (
                  <button className="lobby-btn custome-shadow chat-alert-primary" type="button" onClick={() => onJoinRoom(notification.roomCode || '')}>
                    Join {notification.roomCode}
                  </button>
                ) : null}
                {notification.type === 'request' && notification.requestId ? (
                  <>
                    <button className="lobby-btn custome-shadow chat-alert-primary" type="button" disabled={isBusy} onClick={() => void answerRequest(notification.requestId || 0, 'accept')}>
                      Accept
                    </button>
                    <button className="chat-alert-secondary" type="button" disabled={isBusy} onClick={() => void answerRequest(notification.requestId || 0, 'decline')}>
                      Decline
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSearchTab = () => (
    <div className="chat-search-pane">
      <form className="chat-search-form" onSubmit={runSearch}>
        <input
          className="chat-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search players by name or ID"
        />
        <button className="music-dock-head-btn" type="submit" disabled={isSearching || searchQuery.trim().length < 2}>
          {isSearching ? <AiOutlineLoading3Quarters className="animate-spin" /> : <AiOutlineSearch />}
        </button>
      </form>
      <div className="chat-search-results">
        {searchResults.length === 0 ? (
          <p className="chat-mini-empty">Search two or more characters. Hover a result for stats and request controls.</p>
        ) : (
          searchResults.map((result) => (
            <div key={result.playerId} className="chat-search-result">
              <img
                className="chat-search-avatar"
                src={getPlayerAvatarUrl(result)}
                alt={`${result.name} avatar`}
              />
              <div className="chat-search-result-main">
                <strong>{result.name}</strong>
                <span>{getRecordLabel(result)}</span>
              </div>
              <div className="chat-player-hover-card">
                <div className="chat-hover-profile">
                  <img src={getPlayerAvatarUrl(result)} alt={`${result.name} avatar preview`} />
                  <div>
                    <strong>{result.name}</strong>
                    <span>{getRecordLabel(result)}</span>
                  </div>
                </div>
                <span className="public-room-pill">{result.relation === 'raiburu' ? 'Raiburu' : result.relation === 'outgoing' ? 'Request Sent' : result.relation === 'incoming' ? 'Request Waiting' : 'New Player'}</span>
                <p>ID: {result.playerId}</p>
                {renderPlayerStatsBlock(result, true)}
                <button
                  className="lobby-btn custome-shadow chat-action-full"
                  type="button"
                  disabled={result.relation !== 'none'}
                  onClick={() => setRequestTarget(result)}
                >
                  <AiOutlineUserAdd /> Request Raiburu
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const requestModal = requestTarget ? (
    <div className="chat-request-modal" role="dialog" aria-modal="true" aria-label="Send raiburu request">
      <div className="chat-request-modal-card">
        <header className="profile-dock-head chat-dock-head">
          <div>
            <h3>Request Raiburu</h3>
            <span>{requestTarget.name}</span>
          </div>
          <button className="music-dock-head-btn" type="button" onClick={() => setRequestTarget(null)}>
            <AiOutlineClose />
          </button>
        </header>
        <p>{getRecordLabel(requestTarget)} | Add an optional message before sending.</p>
        <textarea
          className="chat-textarea"
          value={requestMessage}
          onChange={(event) => setRequestMessage(event.target.value)}
          maxLength={180}
          placeholder="Optional: tell them why you want to team up."
        />
        <button className="lobby-btn custome-shadow chat-action-full" type="button" disabled={isBusy} onClick={() => void sendRequest()}>
          {isBusy ? <AiOutlineLoading3Quarters className="animate-spin" /> : <AiOutlineSend />} Send Request
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={classnames('profile-dock', 'chat-dock', isOpen && 'profile-dock-open')}>
      <button
        className={classnames('music-dock-toggle', 'music-dock-toggle-profile', 'chat-dock-toggle', isOpen && 'music-dock-toggle-active')}
        type="button"
        onClick={onToggleOpen}
        aria-label={isOpen ? 'Hide raiburu chat' : 'Show raiburu chat'}
        title="Raiburu chat"
      >
        <AiOutlineComment />
        {launcherBadgeCount > 0 ? <span className="chat-dock-badge">{launcherBadgeCount}</span> : null}
      </button>

      <section className="profile-dock-panel chat-dock-panel" aria-hidden={!isOpen}>
        <header className="profile-dock-head chat-dock-head">
          <div>
            <h3>Raiburu Chat</h3>
            <span>{currentRoomCode ? `Room ${currentRoomCode}` : currentRoomName || 'Social dock'}</span>
          </div>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close raiburu chat">
            <AiOutlineClose />
          </button>
        </header>

        {!playerProfile || !isOnlineReady ? (
          renderLockedState()
        ) : (
          <>
            <nav className="chat-tabs" aria-label="Raiburu chat tabs">
              {[
                { id: 'chat' as const, label: 'Chat', icon: <AiOutlineComment />, count: totalUnread },
                { id: 'alerts' as const, label: 'Alerts', icon: <AiOutlineBell />, count: totalAlerts },
                { id: 'raiburus' as const, label: 'Raiburus', icon: <AiOutlineTeam />, count: raiburus.length },
                { id: 'requests' as const, label: 'Requests', icon: <AiOutlineUserAdd />, count: incomingCount },
                { id: 'search' as const, label: 'Search', icon: <AiOutlineSearch />, count: 0 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={classnames('chat-tab-btn', activeTab === tab.id && 'chat-tab-btn-active')}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="chat-tab-icon">{tab.icon}</span>
                  <strong>{tab.label}</strong>
                  {tab.count > 0 ? <span className="chat-tab-count">{tab.count}</span> : null}
                </button>
              ))}
            </nav>

            <div className="chat-room-invite-status">
              <AiOutlineInfoCircle />
              <span>
                {currentRoomCode
                  ? `Invites will point raiburus to ${currentRoomCode}.`
                  : 'Create or join an online room to enable invite buttons.'}
              </span>
            </div>

            {activeTab === 'chat' ? renderChatTab() : null}
            {activeTab === 'alerts' ? renderAlertsTab() : null}
            {activeTab === 'raiburus' ? renderRaiburusTab() : null}
            {activeTab === 'requests' ? renderRequestsTab() : null}
            {activeTab === 'search' ? renderSearchTab() : null}
          </>
        )}
      </section>

      {isClient && requestModal ? createPortal(requestModal, document.body) : null}
    </div>
  );
}
