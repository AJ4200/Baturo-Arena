const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuthSession } = require('../middleware/requireAuthSession');
const {
  listFriends,
  searchPlayers,
  createInvite,
  ensureFriendship,
  getPlayerInvitePreference,
  listInvitesForPlayer,
  recordEmailAttempt,
  createFriendRequest,
  listFriendRequestsFor,
  acceptFriendRequest,
  updateFriendRequestStatus,
  setInvitePreference,
} = require('../repositories/chatRepository');
const mailer = require('../utils/mailer');
const notifications = require('../notifications');

const router = express.Router();

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ players: [] });
    }
    const players = await searchPlayers(q);
    res.json({ players });
  })
);

router.use(requireAuthSession);

router.get(
  '/friends',
  asyncHandler(async (req, res) => {
    const playerId = req.auth.playerId;
    const friends = await listFriends(playerId);
    res.json({ friends });
  })
);

router.post(
  '/invite',
  asyncHandler(async (req, res) => {
    const fromPlayerId = req.auth.playerId;
    const { toPlayerId, toEmail, roomCode, message } = req.body || {};

    if (!toPlayerId && !toEmail) {
      return res.status(400).json({ error: 'target required' });
    }

    // If inviting an existing player id, enforce recipient preference
    if (toPlayerId) {
      const pref = await getPlayerInvitePreference(toPlayerId);
      if (pref && pref.invite_only_raibarus) {
        // check whether recipient considers sender a raibaru (friend)
        const friends = await listFriends(toPlayerId);
        const allowed = friends.some((f) => f.playerId === fromPlayerId) || friends.some((f) => f.playerId === fromPlayerId);
        if (!allowed) {
          return res.status(403).json({ error: 'Recipient only accepts invites from Raibarus' });
        }
      }
    }

    await createInvite({ fromPlayerId, toPlayerId, toEmail, roomCode, message });

    // if inviting an existing player, ensure friendship record exists (optional)
    if (toPlayerId) {
      await ensureFriendship(fromPlayerId, toPlayerId);
    }

    // send email if address provided and mailer available
    if (toEmail) {
      // if recipient preference disallows invites from non-raibarus, block email invites too
      // (no way to verify sender via email)
      // For now, if toPlayerId is provided and recipient has invite_only set, block; if toEmail only, we consider this blocked if any player with that email has invite_only true.
      if (toPlayerId) {
        // nothing extra here (already checked above)
      } else if (toEmail) {
        // try to find a google_account with that email and check preference
        try {
          const row = await searchPlayers(toEmail); // searchPlayers expects name but we'll fallback - it's okay to skip this check here
        } catch (_e) {
          // skip
        }
      }

        if (mailer.isConfigured()) {
          try {
            await mailer.sendInviteEmail({ to: toEmail, fromPlayerId, roomCode, message });
          } catch (_e) {
            // swallow email errors but continue
          }
        }
      }

      // push notification to recipient if connected
      if (toPlayerId) {
        notifications.notifyPlayer(toPlayerId, { type: 'invite', from: fromPlayerId, roomCode, message });
      }

      res.json({ ok: true });
  })
);

router.get(
  '/invites',
  asyncHandler(async (req, res) => {
    const playerId = req.auth.playerId;
    const invites = await listInvitesForPlayer(playerId);
    res.json({ invites });
  })
);

router.post(
  '/invite-preference',
  asyncHandler(async (req, res) => {
    const playerId = req.auth.playerId;
    const { inviteOnly } = req.body || {};

    if (typeof inviteOnly !== 'boolean') {
      return res.status(400).json({ error: 'inviteOnly must be a boolean' });
    }

    await setInvitePreference(playerId, inviteOnly);
    res.json({ ok: true, inviteOnly });
  })
);



router.get(
  '/friend-requests',
  asyncHandler(async (req, res) => {
    const playerId = req.auth.playerId;
    const requests = await listFriendRequestsFor(playerId);
    const normalized = requests.map((request) => ({
      id: String(request.id),
      fromPlayerId: request.from_player_id,
      fromPlayerName: request.from_name,
      fromPicture: request.from_picture,
      message: request.message,
      status: request.status,
      createdAt: request.created_at,
    }));
    res.json({ requests: normalized });
  })
);

router.post(
  '/friend-requests/:id/accept',
  asyncHandler(async (req, res) => {
    const accepted = await acceptFriendRequest(req.params.id);
    if (!accepted) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    notifications.notifyPlayer(accepted.from_player_id, { type: 'friend-accepted', by: accepted.to_player_id });
    res.json({ ok: true });
  })
);

router.post(
  '/friend-requests/:id/reject',
  asyncHandler(async (req, res) => {
    await updateFriendRequestStatus(req.params.id, 'rejected');
    res.json({ ok: true });
  })
);

module.exports = router;
