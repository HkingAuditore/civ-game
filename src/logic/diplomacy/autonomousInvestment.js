import {
    calculateOverseasProfit,
    createOverseasInvestment,
    createForeignInvestment
} from './overseasInvestment';
import { BUILDINGS, RESOURCES } from '../../config';
import { debugLog } from '../../utils/debugFlags';

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

/**
 * Process AI Investment logic
 * Allows AI nations to invest in player or other AI nations
 * @param {Object} context
 * @returns {Object|null} Investment decision
 */
export function processAIInvestment({
    investorNation,
    nations,
    playerState, // { population, resources, taxes, ... } 
    market, // Player market (used if targeting player)
    epoch,
    daysElapsed
}) {
    // 1. Check AI capability
    // Must be Civilized or Industrial era (Epoch 2+) to invest
    // Must have enough budget (Wealth > 5000)
    if ((investorNation.epoch || 0) < 2) {
        debugLog('overseas', `[AI投资] ${investorNation.name} 时代不足 (${investorNation.epoch || 0} < 2)`);
        return null;
    }
    if ((investorNation.wealth || 0) < 5000) {
        debugLog('overseas', `[AI投资] ${investorNation.name} 财富不足 (${investorNation.wealth || 0} < 5000)`);
        return null;
    }

    // Chance to invest: 5% daily chance (increased from 1% for better gameplay)
    if (Math.random() > 0.05) return null;
    
    debugLog('overseas', `[AI投资] ${investorNation.name} 开始评估投资机会...`);

    // 2. Identify Targets
    // Target Player?
    // Check relations > 40
    // Check if player has "Open Market" treaty or is Vassal (AI is Suzerain... unlikely but possible) or AI is Vassal of Player
    // For now, let's say friendly AI (Relation > 50) considers investing in Player
    
    // Simplification: AI mainly considers PLAYER as target for "Foreign Investment" feature
    // AI-to-AI investment simulation is less critical for UI but can be added if needed.
    
    const targets = [];
    
    // Evaluate Player
    const playerRelation = investorNation.relation || 0;
    // 关系 > 30 即可考虑投资 (降低门槛)
    if (playerRelation > 30) {
        targets.push({ id: 'player', name: 'Player', ...playerState });
    }

    if (targets.length === 0) {
        debugLog('overseas', `[AI投资] ${investorNation.name} 无合适投资目标 (关系: ${investorNation.relation || 0})`);
        return null;
    }

    // 3. Evaluate Buildings
    // AI prefers resource extraction or profitable industry
    // Fix: BUILDINGS uses 'cat' not 'category', and 'baseCost' not 'cost'
    const candidateBuildings = BUILDINGS.filter(b => 
        (b.cat === 'gather' || b.cat === 'industry') &&
        (b.epoch || 0) <= (investorNation.epoch || 0) &&
        (b.baseCost || b.cost) // Has cost definition
    );
    
    debugLog('overseas', `[AI投资] ${investorNation.name} 找到 ${candidateBuildings.length} 个候选建筑`);
    
     // Shuffle
     const shuffledBuildings = candidateBuildings.sort(() => Math.random() - 0.5);

     for (const target of targets) {
         for (const building of shuffledBuildings) {
             // Fix: use baseCost (primary) or cost (fallback)
             const costConfig = building.baseCost || building.cost || {};
             const baseCost = Object.values(costConfig).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
             const cost = (baseCost || 1000) * 1.5; // Foreign investment markup
             if ((investorNation.wealth || 0) < cost) continue;

             // ROI Calc
             // If target is player, use player market prices
             const prices = target.id === 'player' ? (market?.prices || {}) : {};
             
             // Mock investment
             const mockInvestment = {
                id: 'ai_calc',
                buildingId: building.id,
                strategy: 'PROFIT_MAX',
            };
            
            // We need a way to calc profit using player's data if target is player
            // Reuse profit calc but pass player as "Nation" with market
            const targetAsNationParams = target.id === 'player' ? {
                market: { prices },
                inventories: playerState.resources || {},
                wealth: playerState.wealth || 0
            } : target;

            // Note: calculateOverseasProfit assumes 'targetNation' is the host, and 'playerResources' describes the investor home.
            // Here: Investor = AI, Target = Player.
            // So we need to flip the logic or supply params correctly.
            // Actually calculateOverseasProfit is designed for Player -> Overseas.
            // For AI -> Player, the "Local" is Player, "Home" is AI.
            // But the function uses 'playerMarketPrices' as HOME prices usually.
            // Let's approximate:
            // Local Price (Player) vs Home Price (AI).
            // AI Prices? We can use investorNation.market.prices or mock based on base price.
            
            // Simplified Decision:
            // Just satisfy basic ROI: (OutputValue - InputCost) > threshold
            // Using Player Prices for everything (assuming local sourcing and local sales for dumping/profit)
            
            let dailyProfit = 0;
            const outputFunc = building.output || {};
            const inputFunc = building.input || {};
            
            let revenue = 0;
            let expense = 0;
            
            Object.entries(outputFunc).forEach(([res, amt]) => {
                if (res === 'maxPop' || res === 'militaryCapacity') return;
                const price = prices[res] || RESOURCES[res]?.basePrice || 1;
                revenue += amt * price;
            });
            
            Object.entries(inputFunc).forEach(([res, amt]) => {
                const price = prices[res] || RESOURCES[res]?.basePrice || 1;
                expense += amt * price;
            });
            
            // Wage estimate
            // Assume 100 workers per building roughly, wage ~1-2 silver
            expense += 100; 

            dailyProfit = revenue - expense;
            const roi = (dailyProfit * 360) / cost;
            
            debugLog('overseas', `[AI投资] ${investorNation.name} 评估 ${building.name}: ROI=${(roi*100).toFixed(1)}%, profit=${dailyProfit.toFixed(1)}/day`);
            
            if (roi > 0.10) { // 10% ROI acceptable for AI
                 return {
                     type: 'request_investment',
                     investorNation,
                     targetId: target.id,
                     building,
                     cost,
                     roi,
                     action: () => {
                         // Logic to actually create the investment or trigger event
                         // If target is player, return data structure for Event
                         return {
                             type: 'event',
                             eventData: {
                                 nationId: investorNation.id,
                                 opportunity: {
                                     buildingType: building.name,
                                     buildingId: building.id,
                                     potentialProfit: dailyProfit * 30, // Monthly
                                     requiredInvestment: cost,
                                     ownerStratum: 'capitalist' // AI investors are abstracted as Capitalists
                                 }
                             }
                         };
                     }
                 };
            }
         }
     }

    return null;
}
