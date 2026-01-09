# Project Rules

This file defines coding and architecture rules for the civ-game repo to improve
performance, data consistency, and maintainability. Keep it short, enforce it in
PRs, and link it from future docs.

## Core principles
- Single source of truth: game state lives in `useGameState` + simulation output.
- Deterministic simulation: `simulateTick` is the only place that changes core
  gameplay numbers; UI never recalculates or mutates them directly.
- One-way data flow: input actions -> action layer -> simulation -> state update.
- Avoid duplicate representations: do not store derived data if it can be
  computed from canonical state cheaply or cached per tick.

## File placement
- Gameplay rules -> `src/logic/**`
- Shared math/formatting -> `src/utils/**`
- UI-specific transforms -> component or hook that owns the UI
- Web Worker logic -> `src/workers/**`
- Config and constants -> `src/config/**`

## State management rules
- Do not set multiple overlapping state slices for the same concept.
- Prefer a single state update per tick. Batch updates and avoid nested
  setState loops inside loops.
- When adding new state, define:
  - owner (simulation or UI)
  - lifecycle (persistent vs. per-tick)
  - update source (action or simulation)
- If a field is derived (example: totals, summaries), expose it via selector or
  memoized helper, not persistent state.

## Simulation rules
- Keep `simulateTick` pure: it should not touch browser APIs.
- Expensive per-tick work must be rate-limited via
  `shouldRunThisTick` and cached via `tickCache`.
- For any cross-tick cache, use dirty flags to invalidate precisely.
- Avoid per-item logs inside large loops; aggregate and log summaries.
- Never allocate large arrays every tick without reuse or pruning.

## UI performance rules
- UI renders use `useThrottledGameState` or `useThrottledSelector` for
  frequently updating data (resources, logs, charts).
- Use memoized selectors for heavy computations (`useMemo`, cached helpers).
- For large lists, use virtualization or paginate.
- Avoid props that change identity each render (inline objects, arrays).

## Worker rules
- Use a single Worker entry point. Do not reimplement worker setup in multiple
  hooks. Prefer `useSimulationWorker` and keep worker protocols stable.
- Ensure all data passed to workers is structured-clone friendly.

## Data consistency rules
- Any new resource or stratum must be defined in `src/config` and referenced
  from `RESOURCES`/`STRATA` only.
- Do not hardcode resource names in logic or UI; use config maps.
- Normalize IDs: use lowercase snake_case for resources/buildings.
- Avoid storing the same value under multiple keys unless required for save
  format compatibility; document it when unavoidable.

## Logging and telemetry
- Logs are for player-facing events. Avoid debug spam in production paths.
- Any new debug logging must be gated by `debugFlags`.

## Style rules
- 4 spaces indentation, semicolons required.
- Prefer `export const` / `export function`.
- Add brief comments only for complex logic.

## Validation (recommended)
- `npm run lint`
- `npm run build`
