---
name: diplomacy-skill
description: Diplomacy system work for civ-game (foreign economy/development/military simulation, treaties, alliances/organizations, relations like colony or subject, diplomatic actions, and diplomacy UI or events). Use when implementing or modifying diplomacy logic, diplomatic AI, treaties or agreements, nation relations/organization systems, foreign market calculations, or DiplomacyTab UX in this repo.
---

# Diplomacy Skill

## Overview

Implement and extend the game's diplomacy system: nation relations, treaties, alliances or organizations, foreign economy development and military simulation, plus diplomacy UI and events.

## Workflow

1. Clarify the feature scope: treaties, relations, organizations, foreign market simulation, or AI behavior.
2. Review existing diplomacy logic and configs; load references/diplomacy-files.md.
3. Define or adjust the data model for relations, treaties, organizations, and foreign markets.
4. Implement logic in src/logic/diplomacy and related economy or military modules.
5. Update configs, events, and UI to surface new actions and effects.
6. Ensure exports are wired through src/logic/index.js or src/components/index.js when needed.
7. Validate with lint or build when feasible.

## Design Rules

- Follow repo conventions: 4-space indent, semicolons, React 19 + Vite + Tailwind.
- Keep diplomacy logic in src/logic/diplomacy; shared helpers in src/utils.
- Prefer config-driven definitions for treaties, actions, or organizations.
- Add short Chinese comments only for non-obvious logic.

## Core Capabilities

### Treaties and agreements
- Model treaty types (non-aggression, investment, free trade) with terms, duration, and effects.
- Gate player actions and AI evaluation in aiDiplomacy and the diplomacy UI.

### Relations and statuses
- Represent relation states (ally, rival, colony, subject) with clear transitions and modifiers.
- Centralize relation math and validation in nations.js or utils.

### Organizations and blocs
- Support membership rules, shared effects, and triggers (e.g., alliances or free trade zones).
- Keep organization effects composable so multiple blocs can stack.

### Foreign simulation
- Track foreign market supply and demand, industry development, and military capacity.
- Separate deterministic simulation from UI; keep AI decisions in aiDiplomacy, aiEconomy, and aiWar.

## Resources

### references/

- references/diplomacy-files.md: map of relevant files and where to make changes.
