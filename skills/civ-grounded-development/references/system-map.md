# System Map (civ-game)

Use this file as the minimum read checklist before coding.

## 1) Architecture Entry

- `src/main.jsx`
- `src/App.jsx`
- `src/components/index.js`
- `src/logic/index.js`
- `src/config/index.js`

## 2) Core Simulation and Mechanisms

- `src/logic/simulation.js` (main tick and orchestration)
- `src/hooks/useGameLoop.js` (loop driver)
- `src/hooks/useGameState.js` (state container)
- `src/hooks/useGameActions.js` (action boundary)
- `src/workers/simulation.worker.js` (worker simulation path)

## 3) Economic Principles and Numeric System

- `src/logic/economy/prices.js`
- `src/logic/economy/wages.js`
- `src/logic/economy/taxes.js`
- `src/logic/economy/trading.js`
- `src/logic/population/needs.js`
- `src/logic/population/jobs.js`
- `src/utils/economy.js`
- `src/utils/livingStandard.js`

Check these concepts when relevant:
- production and consumption loop
- price/wage/tax feedback
- resources and unlock gates
- coefficient and cap consistency
- progression pacing across epochs

## 4) Stability, Politics, and System Coupling

- `src/logic/stability/approval.js`
- `src/logic/stability/buffs.js`
- `src/logic/rulingCoalition.js`
- `src/logic/demands.js`
- `src/logic/rebellionSystem.js`
- `src/config/polityEffects.js`
- `src/config/systemSynergies.js`

## 5) Data and Balance Sources

- `src/config/gameData.js`
- `src/config/gameConstants.js`
- `src/config/epochs.js`
- `src/config/difficulty.js`
- `src/config/buildings.js`
- `src/config/buildingUpgrades.js`
- `src/config/technologies.js`
- `src/config/industryChains.js`
- `src/config/strata.js`

## 6) UI Binding Paths

- tabs: `src/components/tabs/`
- panels: `src/components/panels/`
- modals: `src/components/modals/`
- layout: `src/components/layout/`

Trace the full path before UI changes:
state source -> selector/calculation -> component props -> interaction handler -> state mutation.

## 7) Reuse-First Checklist

Before adding new files or abstractions, confirm:

1. Existing module cannot absorb the change with local extension.
2. Existing config-driven mechanism cannot represent the new rule.
3. Existing utility/helper cannot be extended safely.
4. User has been notified if a new subsystem is still required.
