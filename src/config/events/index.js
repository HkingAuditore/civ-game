// Events module - Main entry point
// Exports all events and event-related functions

import { BASE_EVENTS } from './baseEvents.js';
import { CLASS_CONFLICT_EVENTS } from './classConflictEvents.js';
import { EPOCH_EVENTS } from './epochEvents.js';
import { economicEvents as ECONOMIC_EVENTS } from './economicEvents.js';
import { STATIC_DIPLOMATIC_EVENTS } from './staticDiplomaticEvents.js';
import { canTriggerEvent, getRandomEvent as getRandomEventFromList } from './eventUtils.js';
import {
    createWarDeclarationEvent,
    createGiftEvent,
    createAIRequestEvent,
    createEnemyPeaceRequestEvent,
    createPlayerPeaceProposalEvent,
    createPeaceRequestEvent,
    createBattleEvent,
    createAllianceRequestEvent,
    createAllianceProposalResultEvent,
    createAllianceBreakEvent,
    createTreatyProposalEvent,
    createTreatyProposalResultEvent,
    createTreatyBreachEvent,
    createNationAnnexedEvent,
    createAllyColdEvent,
    createAllyAttackedEvent,
    createAIDemandSurrenderEvent,
    createRebelDemandSurrenderEvent,
    createIndependenceWarEvent,
    createVassalAutonomyRequestEvent,
    createVassalRequestEvent,
    createOverseasInvestmentOpportunityEvent,
    createNationalizationThreatEvent,
    createTradeDisputeEvent,
    createMilitaryAllianceInviteEvent,
    createBorderIncidentEvent,
    REBEL_DEMAND_SURRENDER_TYPE,
} from './diplomaticEvents.js';
// 叛乱事件系统
import {
    REBELLION_PHASE,
    REBELLION_CONFIG,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebelNation,
    createRebellionEndEvent,
} from './rebellionEvents.js';

// Combine all events into a single array
export const EVENTS = [...BASE_EVENTS, ...CLASS_CONFLICT_EVENTS, ...EPOCH_EVENTS, ...ECONOMIC_EVENTS, ...STATIC_DIPLOMATIC_EVENTS];

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
    createAIRequestEvent,
    createEnemyPeaceRequestEvent,
    createPlayerPeaceProposalEvent,
    createPeaceRequestEvent,
    createBattleEvent,
    createAllianceRequestEvent,
    createAllianceProposalResultEvent,
    createAllianceBreakEvent,
    createTreatyProposalEvent,
    createTreatyProposalResultEvent,
    createTreatyBreachEvent,
    createNationAnnexedEvent,
    createAllyColdEvent,
    createAllyAttackedEvent,
    createAIDemandSurrenderEvent,
    createRebelDemandSurrenderEvent,
    createIndependenceWarEvent,
    createVassalAutonomyRequestEvent,
    createVassalRequestEvent,
    createOverseasInvestmentOpportunityEvent,
    createNationalizationThreatEvent,
    createTradeDisputeEvent,
    createMilitaryAllianceInviteEvent,
    createBorderIncidentEvent,
    REBEL_DEMAND_SURRENDER_TYPE,
};

// Re-export individual event arrays for potential direct access
export { BASE_EVENTS, CLASS_CONFLICT_EVENTS, EPOCH_EVENTS, ECONOMIC_EVENTS, STATIC_DIPLOMATIC_EVENTS };

// Re-export rebellion event system
export {
    REBELLION_PHASE,
    REBELLION_CONFIG,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebelNation,
    createRebellionEndEvent,
};

// 联合叛乱系统
import {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
} from './coalitionRebellion.js';

export {
    createCoalitionRebelNation,
    createCoalitionRebellionEvent,
    calculateCoalitionPopLoss,
};

// 联盟加入诉求事件系统
import {
    checkCoalitionDemandCondition,
    createCoalitionDemandEvent,
    checkAndCreateCoalitionDemandEvent,
    resetCoalitionEventCooldowns,
} from './coalitionEvents.js';

export {
    checkCoalitionDemandCondition,
    createCoalitionDemandEvent,
    checkAndCreateCoalitionDemandEvent,
    resetCoalitionEventCooldowns,
};
