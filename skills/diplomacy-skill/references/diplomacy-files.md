# Diplomacy File Map (civ-game)

Use this list to quickly locate diplomacy-related code and configs in the repo.

## Core logic

- src/logic/diplomacy/index.js: diplomacy logic exports.
- src/logic/diplomacy/nations.js: nation relations, statuses, and diplomatic state handling.
- src/logic/diplomacy/aiDiplomacy.js: AI diplomacy decisions and evaluations.
- src/logic/diplomacy/aiEconomy.js: foreign economy behavior tied to diplomacy.
- src/logic/diplomacy/aiWar.js: war-related AI behavior.

## UI

- src/components/tabs/DiplomacyTab.jsx: diplomacy tab UI and player actions.

## Utilities

- src/utils/diplomaticUtils.js: helper calculations for diplomacy or relations.

## Events

- src/config/events/diplomaticEvents.js: dynamic diplomacy event config.
- src/config/events/staticDiplomaticEvents.js: fixed diplomacy events.

## Related configs (often needed)

- src/config/countries.js: country definitions.
- src/config/militaryActions.js: military action definitions used by diplomacy.
- src/config/scenarios.js: scenario setup for nations and starting relations.
- src/config/industryChains.js: industry chains for foreign market modeling.
- src/config/technologies.js: tech gates that can affect diplomacy options.

## Related systems (sometimes needed)

- src/logic/economy/*.js: market, price, and trade mechanics.
- src/logic/military*: if present, review war or unit logic when adding diplomacy actions.
- src/logic/simulation.js: main simulation loop, hooks into diplomacy updates.
