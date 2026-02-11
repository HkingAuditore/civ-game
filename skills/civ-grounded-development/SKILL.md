---
name: civ-grounded-development
description: Systematic grounding workflow for this civ-game repository. Use when handling any feature, bugfix, refactor, balancing change, UI update, or architecture adjustment in this repo. Force a "read-first, understand-first" process covering project architecture, gameplay logic, economic mechanisms, and numeric systems before implementation. Reuse existing systems by default; if a new subsystem is truly unavoidable, notify the user first and wait for confirmation.
---

# Civ Grounded Development

Enforce repository-grounded development. Read relevant code first, map existing mechanisms, then implement inside the current architecture and data model.

## Mandatory Workflow

1. Scope the request in one sentence.
2. Identify affected domain: `logic`, `config`, `components`, `hooks`, `utils`, `workers`.
3. Read current implementation before proposing changes:
   - Start from `references/system-map.md`.
   - Read the specific modules actually used by the feature.
   - Trace imports/exports to confirm data flow and ownership.
4. Write a short "existing mechanism summary" before coding:
   - Current logic path.
   - Economic principle involved (production/consumption/prices/wages/taxes/trade).
   - Numeric system involved (rates, caps, coefficients, thresholds, progression).
   - UI binding path (state source -> component -> interaction/effect).
5. Implement by extending existing system first:
   - Prefer modifying current modules/configs over creating new architecture.
   - Keep logic in existing domain folders (`src/logic`, `src/utils`, `src/config`).
   - Keep UI style and interaction patterns consistent with existing components.
6. Add concise Chinese comments only for non-obvious logic.
7. Validate with available checks (`npm run lint`, `npm run build`) when feasible.
8. Report results with:
   - What was reused.
   - What changed.
   - Why changes stay within project architecture.

## Hard Constraints

- Do not create a parallel system when an existing path can be extended.
- Do not rewrite core mechanics without reading current implementations first.
- Do not introduce a new data model for economy/logic/UI unless existing models are insufficient.
- If a new subsystem is unavoidable, state this explicitly and ask user confirmation before implementation.

## Reuse Decision Rule

1. Can current module be extended with a small change? Extend it.
2. Can behavior be config-driven in existing config files? Do that.
3. Can shared utility cover it with minor addition? Add to current utility.
4. Only when all above fail, propose a new subsystem and request confirmation.

## Output Requirements

Before coding, output a brief "grounding note" with:
- Related files read.
- Existing mechanism summary.
- Reuse-first implementation plan.

After coding, output a brief "alignment note" with:
- Existing systems reused.
- Numeric/economic consistency checks.
- Any unavoidable new abstraction and user confirmation status.

## Resources

- `references/system-map.md`: quick read order and key files for architecture, logic, economy, numeric balance, and UI bindings.
