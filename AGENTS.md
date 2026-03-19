# AGENTS.md

## Baturo Arena Agent Rules

- Do not run automated tests, linters, or type-check commands by default.
- Run checks only when one of these is true:
  - The user explicitly asks for a check.
  - A targeted check is required to resolve a concrete blocker or decision.
- Prefer focused file inspection and reasoning instead of broad verification runs.
