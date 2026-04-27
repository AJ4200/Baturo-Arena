'use client';

import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import { AiOutlineClose, AiOutlineSend, AiOutlineUserAdd, AiOutlineCheck, AiOutlineDelete } from 'react-icons/ai';
import { IoMdChatbubbles } from 'react-icons/io';

type Friend = {
  playerId: string;
  name: string;
  picture?: string | null;
};

type PendingInvite = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  message?: string;
};

type ChatDockProps = {
  isOpen: boolean;
  friends: Friend[];
  pendingInvites: PendingInvite[];
  showLauncher?: boolean;
  onToggleOpen: () => void;
  onSearch: (query: string) => Promise<Friend[]>;
  onSendFriendRequest: (toPlayerId: string | null, toEmail: string | null, message?: string) => Promise<boolean>;
  onAcceptFriendRequest?: (requestId: string) => Promise<void>;
  onRejectFriendRequest?: (requestId: string) => Promise<void>;
  onRefreshFriends: () => Promise<void>;
  onRefreshPendingInvites: () => Promise<void>;
};

export function ChatDock({
  isOpen,
  friends,
  pendingInvites,
  showLauncher = true,
  onToggleOpen,
  onSearch,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onRefreshFriends,
  onRefreshPendingInvites,
}: ChatDockProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [emailOrId, setEmailOrId] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  const search = useCallback(async () => {
    if (!query || query.trim().length < 1) {
      setResults([]);
      return;
    }
    try {
      const found = await onSearch(query.trim());
      setResults(found || []);
    } catch (_e) {
      setResults([]);
    }
  }, [query, onSearch]);

  const sendRequest = useCallback(async () => {
    const toPlayerId = selected?.playerId || null;
    const toEmail = emailOrId.trim() || null;
    if (!toPlayerId && !toEmail) {
      return;
    }
    const success = await onSendFriendRequest(toPlayerId, toEmail, note.trim() || undefined);
    if (success) {
      setNote('');
      setEmailOrId('');
      setSelected(null);
      setResults([]);
      setQuery('');
    }
  }, [selected, emailOrId, note, onSendFriendRequest]);

  const friendList = useMemo(() => friends || [], [friends]);
  const pendingCount = (pendingInvites || []).length;

  return (
    <div className={classnames('chat-dock', isOpen && 'chat-dock-open')}>
      {!isOpen && showLauncher ? (
        <button
          className={classnames('music-dock-toggle', 'music-dock-toggle-profile', 'chat-dock-launcher')}
          type="button"
          onClick={onToggleOpen}
          aria-label={isOpen ? 'Hide chat panel' : 'Show chat panel'}
          title="Raibarus & Chat"
        >
          <IoMdChatbubbles />
          {pendingCount > 0 ? <span className="music-dock-toggle-badge">{pendingCount}</span> : null}
        </button>
      ) : null}

      <section className="profile-dock-panel" aria-hidden={!isOpen}>
        <header className="profile-dock-head">
          <h3>Raibarus & Chat</h3>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close chat panel">
            <AiOutlineClose />
          </button>
        </header>

        <div className="profile-dock-account">
          <div className="chat-tabs">
            <button
              className={classnames('chat-tab', tab === 'friends' && 'chat-tab-active')}
              onClick={() => setTab('friends')}
            >
              <span>Your Raibarus</span>
              <span className="chat-tab-count">{friendList.length}</span>
            </button>
            <button
              className={classnames('chat-tab', tab === 'requests' && 'chat-tab-active')}
              onClick={() => setTab('requests')}
            >
              <span>Requests</span>
              <span className="chat-tab-count">{pendingCount}</span>
            </button>
          </div>

          {tab === 'friends' ? (
            <>
              <div className="chat-section">
                <strong>Find & Add Raibarus</strong>
                <p className="chat-section-hint">Search for players to send them a friend request.</p>
                
                <div className="chat-search-bar">
                  <input
                    className="profile-dock-input chat-search-input"
                    placeholder="Search by name, email, or player ID"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && search()}
                  />
                  <button className="chat-search-btn" type="button" onClick={search} title="Search">
                    <AiOutlineUserAdd />
                  </button>
                </div>

                {results.length > 0 ? (
                  <ul className="chat-search-results">
                    {results.map((r) => (
                      <li key={r.playerId}>
                        <button
                          type="button"
                          className={classnames('chat-result-item', selected?.playerId === r.playerId && 'chat-result-selected')}
                          onClick={() => setSelected(r)}
                        >
                          <img src={r.picture || `https://robohash.org/${encodeURIComponent(r.name)}?size=48x48`} alt="avatar" className="chat-result-avatar" />
                          <span className="chat-result-name">{r.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <hr />

              <div className="chat-section">
                <div className="chat-section-header">
                  <strong>Your Raibarus</strong>
                  <span className="chat-count-badge">{friendList.length}</span>
                </div>
                <div className="chat-friends-list">
                  {friendList.length === 0 ? (
                    <p className="music-dock-empty">No raibarus yet. Search above to add friends!</p>
                  ) : (
                    <ul>
                      {friendList.map((f) => (
                        <li key={f.playerId} className="chat-friend-item">
                          <img src={f.picture || `https://robohash.org/${encodeURIComponent(f.name)}?size=40x40`} alt="avatar" className="chat-friend-avatar" />
                          <strong className="chat-friend-name">{f.name}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="chat-section">
              <div className="chat-section-header">
                <strong>Friend Requests</strong>
                <span className="chat-count-badge">{pendingCount}</span>
              </div>
              <div className="chat-requests-list">
                {pendingCount === 0 ? (
                  <p className="music-dock-empty">No pending requests.</p>
                ) : (
                  <ul>
                    {pendingInvites.map((invite) => (
                      <li key={invite.id} className="chat-request-item">
                        <div className="chat-request-info">
                          <strong>{invite.fromPlayerName}</strong>
                          {invite.message && <small className="chat-request-message">{invite.message}</small>}
                        </div>
                        <div className="chat-request-actions">
                          {onAcceptFriendRequest && (
                            <button
                              className="chat-request-btn chat-request-accept"
                              type="button"
                              onClick={() => onAcceptFriendRequest(invite.id)}
                              title="Accept"
                            >
                              <AiOutlineCheck />
                            </button>
                          )}
                          {onRejectFriendRequest && (
                            <button
                              className="chat-request-btn chat-request-reject"
                              type="button"
                              onClick={() => onRejectFriendRequest(invite.id)}
                              title="Reject"
                            >
                              <AiOutlineDelete />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Message Popup Panel - appears on the left when a player is selected */}
      {selected ? (
        <div className={classnames('chat-message-popup', selected && 'chat-message-popup-open')}>
          <div className="chat-popup-content">
            <button
              className="chat-popup-close"
              type="button"
              onClick={() => {
                setSelected(null);
                setNote('');
              }}
              title="Close"
            >
              <AiOutlineClose />
            </button>

            <div className="chat-popup-header">
              <img src={selected.picture || `https://robohash.org/${encodeURIComponent(selected.name)}?size=48x48`} alt="avatar" className="chat-popup-avatar" />
              <div className="chat-popup-info">
                <strong>{selected.name}</strong>
                <small>Send a friend request</small>
              </div>
            </div>

            <textarea
              className="profile-dock-input chat-popup-message-input"
              placeholder="Optional message (e.g., 'Let's play some games!')"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
            <small className="chat-popup-char-count">{note.length}/200</small>

            <div className="chat-popup-actions">
              <button
                className="lobby-btn custome-shadow chat-popup-send"
                type="button"
                onClick={sendRequest}
              >
                <AiOutlineSend /> Send
              </button>
              <button
                className="lobby-btn chat-popup-cancel"
                type="button"
                onClick={() => {
                  setSelected(null);
                  setNote('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

