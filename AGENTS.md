# AGENTS.md

## Baturo Arena Agent Rules

- Do not run automated tests, linters, or type-check commands by default.
- Run checks only when one of these is true:
  - The user explicitly asks for a check.
  - A targeted check is required to resolve a concrete blocker or decision.
- Prefer focused file inspection and reasoning instead of broad verification runs.

## Adding a game to the catalog

When introducing a new `GameType`, complete the full Baturo Arena integration:

1. `ba_server/src/utils/game.js` - add the `GAME_RULES` entry and every move/win guard.
2. `ba_web/src/types/game.ts` - add the `GameType`, category, move mode, win condition, and game-specific state types.
3. `ba_web/src/lib/games.ts` - add `FALLBACK_GAMES` and every solo/board/winner guard.
4. `ba_web/src/features/home/gameCarouselThumbnails.ts` - add the label and `choose-game-thumb-{id}` class.
5. `ba_web/src/app/globals.css` - add `.choose-game-carousel-card .choose-game-thumb-{id}` in the block marked `Per-game carousel thumbnails`.
6. `ba_web/src/app/ArenaGame.tsx` - route every supported mode to the game component.
7. Add a draggable game info card using the existing `room-float-*` pattern.
8. Add `AdaptiveControllerOverlay` controls for the game's primary actions, including touch-friendly controls.
9. Make game UI surfaces consume the generated `--match-*` theme variables. Do not leave HUDs, panels, overlays, or controls on an unrelated fixed palette.
10. Wire supported modes honestly. Add working CPU behavior before setting `supportsCpu: true`, and disable local/offline mode when hidden information or networking makes shared-device play invalid.
11. For realtime games, add and register the authenticated server websocket, keep authoritative state and validation on the server, and handle reconnect, presence, and rematch behavior.
12. Confirm lobby cards, game intro metadata, history/leaderboard names, catalog filters, and room capacity all reflect the new game.
