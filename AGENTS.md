# AGENTS.md

## Baturo Arena Agent Rules

- Do not run automated tests, linters, or type-check commands by default.
- Run checks only when one of these is true:
  - The user explicitly asks for a check.
  - A targeted check is required to resolve a concrete blocker or decision.
- Prefer focused file inspection and reasoning instead of broad verification runs.

## Adding a game to the catalog

When introducing a new `GameType`, update backend + web catalog **and** the Choose Game carousel thumbnail:

1. `ba_server/src/utils/game.js` — `GAME_RULES` entry
2. `ba_web/src/types/game.ts` — `GameType`, move mode, win condition
3. `ba_web/src/lib/games.ts` — `FALLBACK_GAMES` + solo/board guards
4. `ba_web/src/features/home/gameCarouselThumbnails.ts` — label + `choose-game-thumb-{id}` class
5. `ba_web/src/app/globals.css` — `.choose-game-carousel-card .choose-game-thumb-{id}` in the carousel thumbnail block (search `Per-game carousel thumbnails`)
6. `ba_web/src/app/ArenaGame.tsx` — route to the game component
