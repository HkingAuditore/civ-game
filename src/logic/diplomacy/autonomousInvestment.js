import {
    calculateOverseasProfit,
    createOverseasInvestment,
    createForeignInvestment,
    hasActiveTreaty // [NEW] Use shared helper
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
            a.targetId === targetNation.id && a.type === 'investment_pact'
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
    diplomacyOrganizations, // [NEW] Pass organizations for treaty checks
    playerState, // { population, resources, taxes, ..., buildings: {} }
    market, // Player market (used if targeting player)
    epoch,
    daysElapsed
}) {
    // Helper: Check if we can invest in a nation
    const canInvestInTarget = (target) => {
        if (!target) return false;

        const targetId = target.id;
        const isVassal = investorNation.vassalOf === targetId && investorNation.vassalType !== 'colony';
        const isSuzerain = target.vassalOf === investorNation.id;

        // Treaty check (Investment Pact) using diplomacyOrganizations
        const hasInvestmentTreaty = diplomacyOrganizations?.organizations?.some(org =>
            org.type === 'economic_pact' && // Economic pacts allow investment
            org.members.includes(investorNation.id) &&
            org.members.includes(targetId)
        );

        // Direct Treaty check
        const hasDirectPact = hasActiveTreaty(investorNation, 'investment_pact', daysElapsed);

        // Debug
        // console.log(`[AI投资检查] ${investorNation.name} -> ${targetId}: VassalOf=${isVassal}, Suzerain=${isSuzerain}, Treaty=${hasInvestmentTreaty||hasDirectPact}`);

        return isVassal || isSuzerain || hasInvestmentTreaty || hasDirectPact;
    };
    // 1. Check AI capability
    // Must be Civilized or Industrial era (Epoch 2+) to invest
    // Must have enough budget (Wealth > 5000)
    if (epoch < 2) {
        debugLog('overseas', `[AI投资] ${investorNation.name} 时代不足 (${epoch} < 2)`);
        return null;
    }
    if ((investorNation.wealth || 0) < 5000) {
        debugLog('overseas', `[AI投资] ${investorNation.name} 财富不足 (${investorNation.wealth || 0} < 5000)`);
        return null;
    }

    // Note: The game loop already has a 30% daily probability check, so no additional probability check needed here
    console.log(`[AI投资] ${investorNation.name} 通过初始检查, wealth=${investorNation.wealth}, epoch=${epoch}, relation=${investorNation.relation}`);
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
    // 关系 > 30 且满足投资条约/附庸关系
    if (playerRelation > 30 && canInvestInTarget(playerState)) {
        targets.push({ id: 'player', name: 'Player', ...playerState });
        console.log(`[AI投资] ${investorNation.name} 将玩家加入投资目标 (关系: ${playerRelation}, 协议有效)`);
    } else {
        // console.log(`[AI投资] ${investorNation.name} 跳过玩家 (关系: ${playerRelation}, 协议: ${canInvestInTarget(playerState)})`);
    }

    if (targets.length === 0) {
        console.log(`[AI投资] ${investorNation.name} 无合适投资目标 (关系: ${investorNation.relation || 0} <= 30 或 无有效协议)`);
        debugLog('overseas', `[AI投资] ${investorNation.name} 无合适投资目标 (关系: ${investorNation.relation || 0} 或 无协议)`);
        return null;
    }

    // 3. Evaluate Buildings
    // AI prefers resource extraction or profitable industry
    // Fix: BUILDINGS uses 'cat' not 'category', and 'baseCost' not 'cost'
    const candidateBuildings = BUILDINGS.filter(b => {
        // 1. Basic Type Check
        if (b.cat !== 'gather' && b.cat !== 'industry') return false;
        if ((b.epoch || 0) > epoch) return false;
        if (!b.baseCost && !b.cost) return false;

        // 2. [NEW] Employment Relationship Check
        // "不能投资没有雇佣关系的建筑" (Cannot invest in buildings without employment relationship)
        // Rule: A building is investable ONLY if it employs people OTHER than the owner.
        // If the only worker is the owner (e.g. Peasant Farm, Quarry), it is Self-Employment, not Capitalist Investment.
        // This prevents "Free Labor" exploit where Owner-Worker wages are skipped.
        const jobs = b.jobs || {};
        const hasEmployees = Object.keys(jobs).some(jobStratum => jobStratum !== b.owner);

        return hasEmployees;
    });

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

            // [NEW] Check if target has this building (Requirement: "我没有造建筑不允许你投资")
            const targetBuildings = target.buildings || {};
            // Check if player has constructed this building type (count > 0)
            if (!targetBuildings[building.id] || targetBuildings[building.id] <= 0) {
                // console.log(`[AI投资] ${investorNation.name} 跳过 ${building.name} (目标未建造)`);
                continue;
            }

            // [NEW] Use Base Prices to simulate AI Market (Home)
            const investorMarketPrices = {};
            // RESOURCES is imported from '../../config'
            Object.keys(RESOURCES).forEach(key => {
                investorMarketPrices[key] = RESOURCES[key].basePrice || 1;
            });

            // Use existing calculateOverseasProfit function to get accurate profit calculation
            // Create a mock investment object for the calculation
            const mockInvestment = {
                buildingId: building.id,
                strategy: 'PROFIT_MAX',
            };

            // For AI investing in player, player is "target nation", AI is "home"
            const profitResult = calculateOverseasProfit(
                mockInvestment,
                target, // target nation (player)
                {}, // player resources (not needed for price calc)
                investorMarketPrices // [FIX] Use AI's (Home) Simulated Prices
            );

            const dailyProfit = profitResult.profit || 0;
            const roi = cost > 0 ? (dailyProfit * 360) / cost : 0;

            console.log(`[AI投资] ${investorNation.name} 评估 ${building.name}: output=${profitResult.outputValue?.toFixed(1)}, input=${profitResult.inputCost?.toFixed(1)}, wage=${profitResult.wageCost?.toFixed(1)}, profit=${dailyProfit.toFixed(1)}/day, ROI=${(roi * 100).toFixed(1)}%`);
            debugLog('overseas', `[AI投资] ${investorNation.name} 评估 ${building.name}: ROI=${(roi * 100).toFixed(1)}%, profit=${dailyProfit.toFixed(1)}/day`);

            if (roi > 0.10) { // 10% ROI acceptable for AI
                console.log(`[AI投资] ${investorNation.name} 决定投资 ${building.name}! ROI=${(roi * 100).toFixed(1)}%`);
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

    console.log(`[AI投资] ${investorNation.name} 未找到合适的投资机会 (没有ROI>10%的建筑)`);
    return null;
}
