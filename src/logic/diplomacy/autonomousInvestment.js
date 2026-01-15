import {
    calculateOverseasProfit,
    createOverseasInvestment,
    createForeignInvestment,
    hasActiveTreaty, // [NEW] Use shared helper
    getInvestableBuildings // [NEW] Dynamic building list for stratum
} from './overseasInvestment';
import { BUILDINGS, RESOURCES } from '../../config';
import { debugLog } from '../../utils/debugFlags';

// [NEW] 外资投资的最低到岗率要求 (95%)
const MIN_FOREIGN_INVESTMENT_STAFFING_RATIO = 0.95;

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
    // [FIX] Any stratum that can be a building owner should be able to invest
    // This includes: capitalist, merchant, artisan, peasant (for some gather buildings)
    // We'll dynamically determine this based on BUILDINGS config
    const INVESTOR_STRATA = ['capitalist', 'merchant', 'artisan', 'peasant', 'lumberjack'];
    const MIN_ROI_THRESHOLD = 0.15; // 15% Annualized ROI
    const INVESTMENT_CHANCE = 0.3; // 30% chance to actually invest if a good opportunity is found (to avoid draining all cash at once)

    // Helper: Check if we can invest in a nation
    // Only allow investment to nations with: vassal status OR investment agreement
    const canInvestInNation = (targetNation) => {
        if (!targetNation || targetNation.id === 'player') return false;

        // 1. Vassal check - vassals can always be invested in
        const isVassal = targetNation.suzerainId === 'player' || targetNation.vassalOf === 'player';

        // 2. Check for investment_pact using hasActiveTreaty (same as manual investment check)
        // This checks targetNation.treaties which is where bilateral treaties are stored
        const hasInvestmentPact = hasActiveTreaty(targetNation, 'investment_pact', daysElapsed);

        // 3. Check for economic_pact (also allows investment)
        const hasEconomicPact = hasActiveTreaty(targetNation, 'economic_pact', daysElapsed);

        // 4. Check for investment_pact in diplomacy organizations (multilateral)
        const hasOrgInvestmentPact = diplomacyOrganizations?.organizations?.some(org =>
            org.type === 'investment_pact' &&
            org.members?.includes('player') &&
            org.members?.includes(targetNation.id)
        ) || false;

        const canInvest = isVassal || hasInvestmentPact || hasEconomicPact || hasOrgInvestmentPact;
        console.log(`🤖 [AUTO-INVEST] 检查目标 ${targetNation.name}: isVassal=${isVassal}, hasInvestmentPact=${hasInvestmentPact}, hasEconomicPact=${hasEconomicPact}, hasOrgPact=${hasOrgInvestmentPact} => ${canInvest}`);
        return canInvest;
    };

    // 2. Shuffle strata to give random chance of who invests first
    const strata = [...INVESTOR_STRATA].sort(() => Math.random() - 0.5);

    console.log(`🤖 [AUTO-INVEST] 检查投资者阶层: ${strata.join(', ')}`);
    console.log(`🤖 [AUTO-INVEST] 阶层财富:`, classWealth);

    for (const stratum of strata) {
        const wealth = classWealth[stratum] || 0;
        // Basic check: needs enough money for at least a cheap building (e.g. 1000)
        if (wealth < 1000) {
            console.log(`🤖 [AUTO-INVEST] ${stratum} 财富不足 (${wealth} < 1000), 跳过`);
            continue;
        }

        console.log(`🤖 [AUTO-INVEST] ${stratum} 财富=${wealth}, 开始寻找投资目标...`);

        // 3. Find potential targets
        // Filter valid nations first
        console.log(`🤖 [AUTO-INVEST] nations 列表: ${nations?.length || 0} 个, 国家: ${nations?.map(n => n.name).join(', ') || '无'}`);
        const validNations = nations.filter(n => canInvestInNation(n));
        console.log(`🤖 [AUTO-INVEST] ${stratum} 找到 ${validNations.length} 个有效投资目标`);
        if (validNations.length === 0) continue;

        // Shuffle nations to avoid always investing in the same one
        const shuffledNations = [...validNations].sort(() => Math.random() - 0.5);

        for (const targetNation of shuffledNations) {
            // 4. Find best building to invest in
            // [FIX] Use getInvestableBuildings to filter buildings for this stratum
            // Each stratum can only invest in buildings where they are the owner
            const candidateBuildings = getInvestableBuildings('treaty', stratum, epoch);

            console.log(`🤖 [AUTO-INVEST] ${stratum} 可投资的建筑: ${candidateBuildings.map(b => b.name).join(', ') || '无'}`);
            if (candidateBuildings.length === 0) continue;

            // Shuffle buildings
            const shuffledBuildings = candidateBuildings.sort(() => Math.random() - 0.5);

            for (const building of shuffledBuildings) {
                const cost = building.cost?.silver || 0;
                console.log(`🤖 [AUTO-INVEST] ${stratum} 检查 ${building.name}: cost=${cost}, wealth=${wealth.toFixed(0)}, canAfford=${wealth >= cost}`);
                if (wealth < cost) {
                    console.log(`🤖 [AUTO-INVEST] ${stratum} 跳过 ${building.name}: 财富不足`);
                    continue;
                }

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

                // [FIX] Use correct field name: 'profit' not 'totalProfit'
                const dailyProfit = calcResult.profit || 0;
                // Annualized ROI = (Daily Profit * 360) / Cost
                const annualROI = (dailyProfit * 360) / cost;

                console.log(`🤖 [AUTO-INVEST] ${stratum} 评估 ${building.name} 在 ${targetNation.name}: profit=${dailyProfit.toFixed(1)}/day, ROI=${(annualROI * 100).toFixed(1)}%, threshold=${(MIN_ROI_THRESHOLD * 100).toFixed(1)}%`);

                if (annualROI > MIN_ROI_THRESHOLD) {
                    // Found a good investment!
                    const roll = Math.random();
                    console.log(`🤖 [AUTO-INVEST] ${stratum} ROI足够! roll=${roll.toFixed(3)}, threshold=${INVESTMENT_CHANCE}, willInvest=${roll <= INVESTMENT_CHANCE}`);
                    if (roll > INVESTMENT_CHANCE) {
                        console.log(`🤖 [AUTO-INVEST] ${stratum} 随机跳过投资 (${(INVESTMENT_CHANCE * 100).toFixed(0)}%概率)`);
                        continue; // Chance to skip
                    }

                    console.log(`🤖 [AUTO-INVEST] ✅ ${stratum} 决定投资 ${building.name} 在 ${targetNation.name}!`);

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
                                daysElapsed,
                                investmentAmount: cost  // [FIX] 传递投资成本，之前缺失导致显示为0
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
    playerState, // { population, resources, taxes, ..., buildings: {}, staffingRatios: {} }
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
        // debugLog('overseas', `[AI投资] ${investorNation.name} 时代不足 (${epoch} < 2)`);
        return null;
    }
    if ((investorNation.wealth || 0) < 5000) {
        // debugLog('overseas', `[AI投资] ${investorNation.name} 财富不足 (${investorNation.wealth || 0} < 5000)`);
        return null;
    }

    // Note: The game loop already has a 30% daily probability check, so no additional probability check needed here
    // console.log(`[AI投资] ${investorNation.name} 通过初始检查, wealth=${investorNation.wealth}, epoch=${epoch}, relation=${investorNation.relation}`);
    // debugLog('overseas', `[AI投资] ${investorNation.name} 开始评估投资机会...`);

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
        // [NEW] Relation-based Probability Scaling
        // Higher relation = higher chance to consider investing
        // Map relation 30..100 to probability 0.1..1.0
        const relationProbability = Math.max(0.1, (playerRelation - 30) / 70);

        if (Math.random() < relationProbability) {
            targets.push({ id: 'player', name: 'Player', ...playerState });
            // console.log(`[AI投资] ${investorNation.name} 将玩家加入投资目标 (关系: ${playerRelation}, 概率: ${relationProbability.toFixed(2)})`);
        } else {
            // console.log(`[AI投资] ${investorNation.name} 因关系不足(${playerRelation})随机跳过本次对玩家投资`);
        }
    } else {
        // console.log(`[AI投资] ${investorNation.name} 跳过玩家 (关系: ${playerRelation}, 协议: ${canInvestInTarget(playerState)})`);
    }

    if (targets.length === 0) {
        // console.log(`[AI投资] ${investorNation.name} 无合适投资目标 (关系: ${investorNation.relation || 0} <= 30 或 无有效协议)`);
        // debugLog('overseas', `[AI投资] ${investorNation.name} 无合适投资目标 (关系: ${investorNation.relation || 0} 或 无协议)`);
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
            const playerBuildingCount = targetBuildings[building.id] || 0;
            // Check if player has constructed this building type (count > 0)
            if (playerBuildingCount <= 0) {
                console.log(`[AI投资] ${investorNation.name} 跳过 ${building.name} (目标未建造，当前数量: ${playerBuildingCount})`);
                continue;
            }

            // [NEW] Check staffing ratio (Requirement: "到岗率不足95%不允许投资")
            // Calculate staffing ratio from jobFill data
            const targetJobFill = target.jobFill || {};
            const buildingJobFillData = targetJobFill[building.id] || {};
            const buildingJobs = building.jobs || {};
            const buildingCount = targetBuildings[building.id] || 0;

            // Calculate total slots and filled slots
            let totalSlots = 0;
            let filledSlots = 0;
            Object.entries(buildingJobs).forEach(([role, slotsPerBuilding]) => {
                const totalRoleSlots = slotsPerBuilding * buildingCount;
                totalSlots += totalRoleSlots;
                filledSlots += Math.min(buildingJobFillData[role] || 0, totalRoleSlots);
            });

            // Calculate staffing ratio (default to 1 if no slots)
            const buildingStaffingRatio = totalSlots > 0 ? filledSlots / totalSlots : 1;

            // 检查是否满足95%要求
            if (buildingStaffingRatio < MIN_FOREIGN_INVESTMENT_STAFFING_RATIO) {
                console.log(`[AI投资] ${investorNation.name} 跳过 ${building.name} (到岗率不足: ${(buildingStaffingRatio * 100).toFixed(1)}% < 95%)`);
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

/**
 * [SHARED] Get best building for foreign investment
 * Unified logic for both autonomous investment and demand investment
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.targetBuildings - Target nation's buildings { buildingId: count }
 * @param {Object} params.targetJobFill - Target nation's job fill data { buildingId: { role: count } }
 * @param {number} params.epoch - Current epoch
 * @param {Object} params.market - Market data (optional, for ROI calculation)
 * @param {number} params.investorWealth - Investor's available wealth (optional)
 * @returns {Object|null} - { building, cost, roi } or null if no valid building
 */
export function selectBestInvestmentBuilding({
    targetBuildings = {},
    targetJobFill = {},
    epoch = 0,
    market = null,
    investorWealth = Infinity
}) {
    // 1. Filter buildings that meet all requirements
    const candidateBuildings = BUILDINGS.filter(b => {
        // 1.1 Basic Type Check - only gather and industry
        if (b.cat !== 'gather' && b.cat !== 'industry') return false;
        
        // 1.2 Epoch check
        if ((b.epoch || 0) > epoch) return false;
        
        // 1.3 Must have cost defined
        if (!b.baseCost && !b.cost) return false;

        // 1.4 [CRITICAL] Employment Relationship Check
        // Cannot invest in buildings without employment relationship
        // Rule: A building is investable ONLY if it employs people OTHER than the owner.
        // If the only worker is the owner (e.g. Peasant Farm, Quarry), it is Self-Employment
        const jobs = b.jobs || {};
        const hasEmployees = Object.keys(jobs).some(jobStratum => jobStratum !== b.owner);
        if (!hasEmployees) {
            console.log(`[投资筛选] 排除 ${b.name}: 没有雇佣关系 (owner=${b.owner}, jobs=${Object.keys(jobs).join(',')})`);
            return false;
        }

        // 1.5 Target must have this building
        const buildingCount = targetBuildings[b.id] || 0;
        if (buildingCount <= 0) {
            return false;
        }

        // 1.6 Check staffing ratio (>= 95%)
        const buildingJobFillData = targetJobFill[b.id] || {};
        const buildingJobs = b.jobs || {};
        let totalSlots = 0;
        let filledSlots = 0;
        Object.entries(buildingJobs).forEach(([role, slotsPerBuilding]) => {
            const totalRoleSlots = slotsPerBuilding * buildingCount;
            totalSlots += totalRoleSlots;
            filledSlots += Math.min(buildingJobFillData[role] || 0, totalRoleSlots);
        });
        const staffingRatio = totalSlots > 0 ? filledSlots / totalSlots : 1;
        if (staffingRatio < MIN_FOREIGN_INVESTMENT_STAFFING_RATIO) {
            console.log(`[投资筛选] 排除 ${b.name}: 到岗率不足 (${(staffingRatio * 100).toFixed(1)}% < 95%)`);
            return false;
        }

        // 1.7 Check if investor can afford
        const costConfig = b.baseCost || b.cost || {};
        const baseCost = Object.values(costConfig).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
        const cost = (baseCost || 1000) * 1.5; // Foreign investment markup
        if (cost > investorWealth) {
            return false;
        }

        return true;
    });

    if (candidateBuildings.length === 0) {
        console.log('[投资筛选] 没有找到满足条件的建筑');
        return null;
    }

    console.log(`[投资筛选] 找到 ${candidateBuildings.length} 个候选建筑: ${candidateBuildings.map(b => b.name).join(', ')}`);

    // 2. Calculate ROI for each candidate and select the best
    let bestBuilding = null;
    let bestRoi = -Infinity;
    let bestCost = 0;

    // Prepare market prices (use base prices if no market data)
    const prices = {};
    Object.keys(RESOURCES).forEach(key => {
        prices[key] = market?.prices?.[key] || RESOURCES[key]?.basePrice || 1;
    });

    for (const building of candidateBuildings) {
        const costConfig = building.baseCost || building.cost || {};
        const baseCost = Object.values(costConfig).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
        const cost = (baseCost || 1000) * 1.5;

        // Calculate daily profit
        let outputValue = 0;
        const output = building.output || {};
        Object.entries(output).forEach(([res, amount]) => {
            if (res === 'maxPop' || res === 'militaryCapacity') return;
            const price = prices[res] || 1;
            outputValue += amount * price;
        });

        let inputCost = 0;
        const input = building.input || {};
        Object.entries(input).forEach(([res, amount]) => {
            const price = prices[res] || 1;
            inputCost += amount * price;
        });

        let wageCost = 0;
        const jobs = building.jobs || {};
        Object.entries(jobs).forEach(([stratum, count]) => {
            if (building.owner && stratum === building.owner) return;
            wageCost += count * 10; // Estimate 10 silver per worker per day
        });

        const dailyProfit = outputValue - inputCost - wageCost;
        const roi = cost > 0 ? (dailyProfit * 360) / cost : 0;

        console.log(`[投资筛选] ${building.name}: profit=${dailyProfit.toFixed(1)}/day, cost=${cost}, ROI=${(roi * 100).toFixed(1)}%`);

        if (roi > bestRoi) {
            bestRoi = roi;
            bestBuilding = building;
            bestCost = cost;
        }
    }

    if (!bestBuilding) {
        console.log('[投资筛选] 没有找到正ROI的建筑');
        return null;
    }

    console.log(`[投资筛选] 选择最佳建筑: ${bestBuilding.name} (ROI=${(bestRoi * 100).toFixed(1)}%)`);
    return {
        building: bestBuilding,
        cost: bestCost,
        roi: bestRoi
    };
}
