// Events module - Main entry point
// Exports all events and event-related functions

import { BASE_EVENTS } from './baseEvents';
import { CLASS_CONFLICT_EVENTS } from './classConflictEvents';
import { canTriggerEvent, getRandomEvent as getRandomEventFromList } from './eventUtils';
import {
  createWarDeclarationEvent,
  createGiftEvent,
  createEnemyPeaceRequestEvent,
  createPlayerPeaceProposalEvent,
  createPeaceRequestEvent,
  createBattleEvent,
} from './diplomaticEvents';

// Combine all events into a single array
export const EVENTS = [...BASE_EVENTS, ...CLASS_CONFLICT_EVENTS];

// Re-export event utility functions
export { canTriggerEvent };

// Export getRandomEvent that uses the combined EVENTS array
export function getRandomEvent(gameState) {
  return getRandomEventFromList(gameState, EVENTS);
}

// Re-export diplomatic event creators
export {
  createWarDeclarationEvent,
  createGiftEvent,
  createEnemyPeaceRequestEvent,
  createPlayerPeaceProposalEvent,
  createPeaceRequestEvent,
  createBattleEvent,
};

// Re-export individual event arrays for potential direct access
export { BASE_EVENTS, CLASS_CONFLICT_EVENTS };
