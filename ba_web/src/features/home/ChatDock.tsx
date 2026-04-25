'use client';

import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import { AiOutlineClose, AiOutlineSend } from 'react-icons/ai';
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
  inviteOnlyRaibarus: boolean;
  showLauncher?: boolean;
  onToggleOpen: () => void;
  onInvite: (toPlayerId: string | null, toEmail: string | null, message?: string) => Promise<boolean>;
  onSearch: (query: string) => Promise<Friend[]>;
  onToggleInviteOnly: (enabled: boolean) => Promise<void>;
  onRefreshFriends: () => Promise<void>;
  onRefreshPendingInvites: () => Promise<void>;
};

export function ChatDock({
  isOpen,
  friends,
  pendingInvites,
  inviteOnlyRaibarus,
  showLauncher = true,
  onToggleOpen,
  onInvite,
  onSearch,
  onToggleInviteOnly,
  onRefreshFriends,
  onRefreshPendingInvites,
}: ChatDockProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [emailOrId, setEmailOrId] = useState('');
  const [note, setNote] = useState('');

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

  const invite = useCallback(async () => {
    const toPlayerId = selected?.playerId || null;
    const toEmail = emailOrId.trim() || null;
    if (!toPlayerId && !toEmail) {
      return;
    }
    const success = await onInvite(toPlayerId, toEmail, note.trim() || undefined);
    if (success) {
      setNote('');
      setEmailOrId('');
      setSelected(null);
      setResults([]);
      setQuery('');
    }
  }, [selected, emailOrId, note, onInvite]);

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
          title="Chat"
        >
          <IoMdChatbubbles />
          {pendingCount > 0 ? <span className="music-dock-toggle-badge">{pendingCount}</span> : null}
        </button>
      ) : null}

      <section className="profile-dock-panel" aria-hidden={!isOpen}>
        <header className="profile-dock-head">
          <h3>Chat & Invites</h3>
          <button className="music-dock-head-btn" type="button" onClick={onToggleOpen} aria-label="Close chat panel">
            <AiOutlineClose />
          </button>
        </header>

        <div className="profile-dock-account">
          <div className="profile-dock-status-note">Invite friends (Raibarus) or anyone by email/ID</div>

          <label className="profile-dock-input-label">Invite preference</label>
          <div className="profile-dock-status-grid">
            <label className="public-room-pill custome-shadow-invert">
              <input type="checkbox" checked={inviteOnlyRaibarus} onChange={(e) => onToggleInviteOnly(e.target.checked)} />
              Only allow invites from Raibarus (friends)
            </label>
          </div>

          <hr />

          <div className="chat-invite-section">
            <strong>Invite to room</strong>
            <div className="chat-invite-row">
              <input
                className="profile-dock-input"
                placeholder="Search users by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="lobby-btn" type="button" onClick={search}>
                Search
              </button>
            </div>
            {results.length > 0 ? (
              <ul className="chat-search-results">
                {results.map((r) => (
                  <li key={r.playerId}>
                    <button type="button" className="music-dock-track-btn" onClick={() => setSelected(r)}>
                      <img src={r.picture || `https://robohash.org/${encodeURIComponent(r.name)}?size=64x64`} alt="avatar" className="mini-avatar" />
                      <strong>{r.name}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="chat-invite-row">
              <input
                className="profile-dock-input"
                placeholder="Or enter email or player id"
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
              />
            </div>

            <textarea className="profile-dock-input" placeholder="Optional message" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="chat-invite-actions">
              <button className="lobby-btn custome-shadow" type="button" onClick={invite}>
                <AiOutlineSend /> Send Invite
              </button>
            </div>
          </div>

          <hr />
          <strong>Your Raibarus</strong>
          <div className="chat-friends-list">
            {friendList.length === 0 ? <p className="music-dock-empty">No raibarus yet. Use search to find players.</p> : null}
            <ul>
              {friendList.map((f) => (
                <li key={f.playerId} className="chat-friend-item">
                  <img src={f.picture || `https://robohash.org/${encodeURIComponent(f.name)}?size=64x64`} alt="avatar" className="mini-avatar" />
                  <strong>{f.name}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
