import {
    calculateOverseasProfit,
    createOverseasInvestment
} from './overseasInvestment';
import { BUILDINGS, RESOURCES } from '../../config';

/**
 * Process autonomous overseas for specific classes (Capitalist, Merchant)
 * @param {Object} context - Game context
 * @returns {Object|null} Result of investment attempt or null if nothing happened
 */
export function processClassAutonomousInvestment({
    nations,
    playerNation, // Explicit player nation object
    diplomacyOrganizations,
    overseasInvestments,
    classWealth,
    market, // Player market
    epoch,
    daysElapsed
}) {
    // 1. Definition of autonomous investors
    const INVESTOR_STRATA = ['capitalist', 'merchant'];
    const MIN_ROI_THRESHOLD = 0.15; // 15% Annualized ROI
    const INVESTMENT_CHANCE = 0.3; // 30% chance to actually invest if a good opportunity is found (to avoid draining all cash at once)

    // Helper: Check if we can invest in a nation
    const canInvestInNation = (targetNation) => {
        if (!targetNation || targetNation.id === 'player') return false;

        // Vassal check
        const isVassal = targetNation.suzerainId === 'player';

        // Treaty check (Investment Pact)
        // Find shared organization with type 'investment_pact' (assuming this type exists or checking permissions)
        const hasInvestmentTreaty = diplomacyOrganizations?.organizations?.some(org =>
            org.type === 'economic_pact' && // Assuming economic_pact covers investment or specific 'investment_pact'
            org.members.includes('player') &&
            org.members.includes(targetNation.id)
        );

        // Also check direct stats if stored on nation
        const hasDirectPact = playerNation?.diplomacy?.agreements?.some(a =>
            a.targetId === targetNation.id && a.type === 'investment_rights'
        );

        return isVassal || hasInvestmentTreaty || hasDirectPact;
    };

    // 2. Shuffle strata to give random chance of who invests first
    const strata = [...INVESTOR_STRATA].sort(() => Math.random() - 0.5);

    for (const stratum of strata) {
        const wealth = classWealth[stratum] || 0;
        // Basic check: needs enough money for at least a cheap building (e.g. 1000)
        if (wealth < 1000) continue;

        // 3. Find potential targets
        // Filter valid nations first
        const validNations = nations.filter(n => canInvestInNation(n));
        if (validNations.length === 0) continue;

        // Shuffle nations to avoid always investing in the same one
        const shuffledNations = [...validNations].sort(() => Math.random() - 0.5);

        for (const targetNation of shuffledNations) {
            // 4. Find best building to invest in
            // Filter buildings that can be built (logic from OverseasInvestmentPanel/overseasInvestment.js)
            // Simplified: check all manufacturing/resource buildings
            // We need a list of investable buildings. 
            // Importing INVESTABLE_BUILDINGS from overseasInvestment.js would be better, but let's filter BUILDINGS for now
            // or assume we iterate common profitable ones.

            const candidateBuildings = BUILDINGS.filter(b =>
                (b.category === 'manufacturing' || b.category === 'resource') &&
                b.cost && b.cost.silver // Must have a cost
            );

            // Shuffle buildings
            const shuffledBuildings = candidateBuildings.sort(() => Math.random() - 0.5);

            for (const building of shuffledBuildings) {
                const cost = building.cost.silver;
                if (wealth < cost) continue;

                // Check existing count limit? (Optional, skipping for now as autonomous capitalists are aggressive)

                // 5. Calculate Potential ROI with PROFIT_MAX strategy
                // Mock an investment object for calculation
                const mockInvestment = {
                    id: 'temp_calc',
                    buildingId: building.id,
                    level: 1,
                    strategy: 'PROFIT_MAX',
                    // Default operating data
                    operatingMode: 'local',
                };

                const calcResult = calculateOverseasProfit(
                    mockInvestment,
                    targetNation,
                    { [building.id]: 0 }, // Fake player resources, usually doesn't affect cost recalc too much unless input constrained
                    market?.prices || {}
                );

                const dailyProfit = calcResult.totalProfit || 0;
                // Annualized ROI = (Daily Profit * 360) / Cost
                const annualROI = (dailyProfit * 360) / cost;

                if (annualROI > MIN_ROI_THRESHOLD) {
                    // Found a good investment!
                    if (Math.random() > INVESTMENT_CHANCE) continue; // Chance to skip

                    return {
                        success: true,
                        stratum,
                        targetNation,
                        building,
                        cost,
                        annualROI,
                        dailyProfit,
                        action: () => {
                            // Create the investment object
                            // This function will be called by the game loop handler to generate the actual data
                            return createOverseasInvestment({
                                buildingId: building.id,
                                targetNation, // Pass full nation object as required by createOverseasInvestment
                                targetNationId: targetNation.id, // Fallback
                                ownerStratum: stratum,
                                strategy: 'PROFIT_MAX',
                                existingInvestments: overseasInvestments,
                                classWealth,
                                daysElapsed
                            });
                        }
                    };
                }
            }
        }
    }

    return null;
}
