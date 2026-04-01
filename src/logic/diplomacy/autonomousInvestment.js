import {
    calculateOverseasProfit,
    createOverseasInvestment,
    createForeignInvestment,
    hasActiveTreaty, // [NEW] Use shared helper
    getInvestableBuildings // [NEW] Dynamic building list for stratum
} from './overseasInvestment';
import { BUILDINGS, RESOURCES } from '../../config';
import { INDEPENDENCE_CONFIG } from '../../config/diplomacy';
import { debugLog } from '../../utils/debugFlags';
import { getNationAnnualOutput, getNationEconomicScale, getNationTreasury } from './economyUtils';

// [NEW] 外资投资的最低到岗率要求 (95%)
const MIN_FOREIGN_INVESTMENT_STAFFING_RATIO = 0.95;
const MAX_TOP_INVESTMENTS = 5;
const MAX_BUILDING_SAMPLES = 5;

// ========== 模块级缓存（类似 trading.js 的 _opportunityCache）==========
// 避免每次调用都对全量国家/建筑做 filter + sort
const _investmentCache = {
    // --- Inbound eligible investors cache ---
    inboundSignature: '',
    inboundEligible: [],       // 已排序的 eligible investors
    inboundLastRefreshDay: -Infinity,
    // --- Outbound candidate nations cache ---
    outboundSignature: '',
    outboundCandidates: [],    // 已排序的 candidate nations
    outboundLastRefreshDay: -Infinity,
    // --- Building candidate cache for selectBestInvestmentBuilding ---
    buildingSignature: '',
    buildingCandidates: [],    // pre-filtered BUILDINGS
    buildingLastRefreshDay: -Infinity,
    // --- Foreign investment index: buildingId -> operating count ---
    foreignInvIndex: null,     // Map<string, number>
    foreignInvSignature: '',
};

const CACHE_REFRESH_INTERVAL = 30; // 每 30 天刷新一次缓存

const buildForeignInvIndex = (foreignInvestments) => {
    const idx = new Map();
    if (!foreignInvestments) return idx;
    for (let i = 0; i < foreignInvestments.length; i++) {
        const inv = foreignInvestments[i];
        if (inv.status === 'operating') {
            const key = inv.buildingId;
            idx.set(key, (idx.get(key) || 0) + (inv.count || 1));
        }
    }
    return idx;
};

const computeInboundSignature = (nations, diplomacyOrganizations, daysElapsed) => {
    const nCount = nations?.length || 0;
    const orgCount = diplomacyOrganizations?.organizations?.length || 0;
    const dayBucket = Math.floor(daysElapsed / CACHE_REFRESH_INTERVAL);
    // [FIX P2] 加入各国条约总数，条约签订/终止时立即刷新缓存，避免30天内新签条约不生效
    const treatyCount = nations?.reduce((sum, n) => {
        const t = n.treaties;
        if (!t) return sum;
        return sum + (Array.isArray(t) ? t.length : Object.keys(t).length);
    }, 0) || 0;
    return `${nCount}|${orgCount}|${dayBucket}|${treatyCount}`;
};

const computeOutboundSignature = (nations, diplomacyOrganizations, daysElapsed) => {
    const nCount = nations?.length || 0;
    const orgCount = diplomacyOrganizations?.organizations?.length || 0;
    const dayBucket = Math.floor(daysElapsed / CACHE_REFRESH_INTERVAL);
    const treatyCount = nations?.reduce((sum, n) => {
        const t = n.treaties;
        if (!t) return sum;
        return sum + (Array.isArray(t) ? t.length : Object.keys(t).length);
    }, 0) || 0;
    return `out|${nCount}|${orgCount}|${dayBucket}|${treatyCount}`;
};

const computeBuildingSignature = (targetBuildings, epoch, daysElapsed) => {
    const bKeys = targetBuildings ? Object.keys(targetBuildings).length : 0;
    const dayBucket = Math.floor(daysElapsed / CACHE_REFRESH_INTERVAL);
    return `bld|${bKeys}|${epoch}|${dayBucket}`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const weightedSampleWithoutReplacement = (items, getWeight, sampleSize) => {
    if (items.length <= sampleSize) return items;
    const scored = items.map(item => {
        const weight = Math.max(0.0001, getWeight(item));
        const key = Math.pow(Math.random(), 1 / weight);
        return { item, key };
    });
    scored.sort((a, b) => b.key - a.key);
    return scored.slice(0, sampleSize).map(entry => entry.item);
};

const pickRandomSubset = (items, sampleSize) => {
    if (items.length <= sampleSize) return items;
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, sampleSize);
};

const getRelationWeight = (relation = 0) => clamp((relation + 100) / 200, 0.05, 1);

const getWealthSignal = (nation) => {
    const value = getNationEconomicScale(nation, 0);
    return clamp(Math.log10(value + 1) / 6, 0.05, 1);
};

const getCooldownWeight = (daysElapsed, lastDay, cooldownDays = 30) => {
    if (!Number.isFinite(lastDay)) return 1;
    const delta = daysElapsed - lastDay;
    if (delta >= cooldownDays) return 1;
    return clamp(delta / cooldownDays, 0.2, 0.8);
};

const canPlayerInvestInNation = (targetNation, diplomacyOrganizations, daysElapsed) => {
    if (!targetNation || targetNation.id === 'player') return false;

    const isVassal = targetNation.suzerainId === 'player' || targetNation.vassalOf === 'player';
    const hasInvestmentPact = hasActiveTreaty(targetNation, 'investment_pact', daysElapsed);
    const hasEconomicPact = hasActiveTreaty(targetNation, 'economic_pact', daysElapsed);
    
    // [FIX] Convert targetNation.id to string for comparison, since org.members may contain string IDs
    const targetIdStr = String(targetNation.id);
    const hasOrgEconomicBloc = diplomacyOrganizations?.organizations?.some(org =>
        org.type === 'economic_bloc' &&
        org.isActive !== false && // [FIX] Check if org is active
        org.members?.some(m => String(m) === 'player' || String(m) === '0') && // Player membership
        org.members?.some(m => String(m) === targetIdStr) // Target nation membership
    ) || false;

    const canInvest = isVassal || hasInvestmentPact || hasEconomicPact || hasOrgEconomicBloc;
    
    // Debug log to help diagnose investment eligibility
    // if (!canInvest) {
    //     console.log(`🤖 [INVEST-CHECK] ${targetNation.name} 不可投资: isVassal=${isVassal}, hasInvestmentPact=${hasInvestmentPact}, hasEconomicPact=${hasEconomicPact}, hasOrgEconomicBloc=${hasOrgEconomicBloc}, treaties=${JSON.stringify(targetNation.treaties?.slice(0, 2))}`);
    // }
    
    return canInvest;
};

const canForeignInvestInPlayer = (investorNation, playerState, diplomacyOrganizations, daysElapsed) => {
    if (!investorNation || !playerState) return false;

    const targetId = playerState.id || 'player';
    const isVassal = investorNation.vassalOf === targetId && investorNation.vassalType !== 'colony';
    const isSuzerain = playerState.vassalOf === investorNation.id;
    const hasEconomicOrg = diplomacyOrganizations?.organizations?.some(org =>
        org.type === 'economic_bloc' &&
        org.members?.includes(investorNation.id) &&
        org.members?.includes(targetId)
    );
    const hasInvestmentPact = hasActiveTreaty(investorNation, 'investment_pact', daysElapsed);
    const hasEconomicPact = hasActiveTreaty(investorNation, 'economic_pact', daysElapsed);

    return isVassal || isSuzerain || hasEconomicOrg || hasInvestmentPact || hasEconomicPact;
};

const getInvestmentPolicyThreshold = (policy = 'autonomous') => {
    if (policy === 'guided') return 0.05;
    if (policy === 'forced') return -0.10;
    return 0.10;
};

const buildInvestableCache = (epoch, accessType, strata) => {
    const cache = {};
    strata.forEach(stratum => {
        cache[stratum] = getInvestableBuildings(accessType, stratum, epoch);
    });
    return cache;
};

const getBuildingSilverCost = (building) => {
    // Match the logic in establishOverseasInvestment
    const costConfig = building?.cost || building?.baseCost || {};
    const baseCost = Object.values(costConfig).reduce((sum, v) => sum + v, 0);
    
    // 投资成本 = 建筑基础成本 × 1.5（海外溢价）
    // Note: Vassal discount is not applied here since we're just estimating
    return baseCost * 1.5;
};

const estimateROIForBuilding = (building, targetNation, market, taxPolicies = {}, organizations = [], daysElapsed = 0) => {
    const cost = getBuildingSilverCost(building);
    if (cost <= 0) return { roi: -Infinity, dailyProfit: 0 };

    const mockInvestment = {
        id: 'temp_calc',
        buildingId: building.id,
        level: 1,
        strategy: 'PROFIT_MAX',
        operatingMode: 'local',
    };

    const calcResult = calculateOverseasProfit(
        mockInvestment,
        targetNation,
        {},
        market?.prices || {},
        {
            taxPolicies,
            organizations,
            daysElapsed,
            playerIsHome: true,
            partnerNation: targetNation,
        }
    );

    const dailyProfit = calcResult.profit || 0;
    const roi = (dailyProfit * 360) / cost;

    return { roi, dailyProfit };
};

export function selectOutboundInvestmentsBatch({
    nations,
    playerNation,
    diplomacyOrganizations,
    overseasInvestments,
    classWealth,
    market,
    epoch,
    daysElapsed,
    taxPolicies = {},
    maxInvestments = MAX_TOP_INVESTMENTS,
    batchSize = 2,
    batchOffset = 0,
}) {
    if (!playerNation) return { investments: [], hasMore: false, nextOffset: 0 };

    // --- 缓存层：candidate nations 只在签名变化时重算 ---
    const sig = computeOutboundSignature(nations, diplomacyOrganizations, daysElapsed);
    let sortedCandidates;

    if (sig === _investmentCache.outboundSignature && _investmentCache.outboundCandidates.length > 0) {
        sortedCandidates = _investmentCache.outboundCandidates;
    } else {
        const candidateNations = (nations || []).filter(n => canPlayerInvestInNation(n, diplomacyOrganizations, daysElapsed));
        if (candidateNations.length === 0) return { investments: [], hasMore: false, nextOffset: 0 };

        sortedCandidates = candidateNations.sort((a, b) => {
            const weightA = getRelationWeight(a.relation || 0) * getWealthSignal(a);
            const weightB = getRelationWeight(b.relation || 0) * getWealthSignal(b);
            return weightB - weightA;
        });

        _investmentCache.outboundSignature = sig;
        _investmentCache.outboundCandidates = sortedCandidates;
        _investmentCache.outboundLastRefreshDay = daysElapsed;

        debugLog('trade', `[OUTBOUND] 刷新候选国缓存: ${sortedCandidates.length} 个候选`);
    }

    if (sortedCandidates.length === 0) return { investments: [], hasMore: false, nextOffset: 0 };

    const sampledNations = sortedCandidates.slice(batchOffset, batchOffset + batchSize);
    const hasMore = (batchOffset + batchSize) < sortedCandidates.length;
    const nextOffset = hasMore ? (batchOffset + batchSize) : 0;

    const strata = Object.keys(classWealth || {}).filter(stratum => (classWealth[stratum] || 0) >= 1000);
    if (strata.length === 0) return { investments: [], hasMore, nextOffset };

    const investments = [];

    for (let ni = 0; ni < sampledNations.length; ni++) {
        const targetNation = sampledNations[ni];
        const accessType = targetNation.vassalOf === 'player' ? 'vassal' : 'treaty';
        const investableCache = buildInvestableCache(epoch, accessType, strata);

        let bestOption = null;

        for (let si = 0; si < strata.length; si++) {
            const stratum = strata[si];
            const wealth = classWealth[stratum] || 0;
            const buildingPool = investableCache[stratum] || [];
            const sampledBuildings = pickRandomSubset(buildingPool, MAX_BUILDING_SAMPLES);

            for (let bi = 0; bi < sampledBuildings.length; bi++) {
                const building = sampledBuildings[bi];
                const cost = getBuildingSilverCost(building);
                if (cost <= 0 || cost > wealth) continue;

                const { roi, dailyProfit } = estimateROIForBuilding(
                    building,
                    targetNation,
                    market,
                    taxPolicies,
                    diplomacyOrganizations?.organizations || [],
                    daysElapsed
                );

                if (!Number.isFinite(roi) || roi <= 0) continue;

                if (!bestOption || roi > bestOption.roi) {
                    bestOption = { stratum, targetNation, building, cost, roi, dailyProfit };
                }
            }
        }

        if (bestOption) {
            investments.push(bestOption);
        }
    }

    if (investments.length === 0) return { investments: [], hasMore, nextOffset };

    investments.sort((a, b) => b.roi - a.roi);
    const finalInvestments = investments.slice(0, Math.min(maxInvestments, investments.length)).map(option => ({
        ...option,
        investment: createOverseasInvestment({
            buildingId: option.building.id,
            targetNationId: option.targetNation.id,
            ownerStratum: option.stratum,
            strategy: 'PROFIT_MAX',
            investmentAmount: option.cost,
        }),
    }));
    return { investments: finalInvestments, hasMore, nextOffset };
}

export function selectInboundInvestmentsBatch({
    investorNations,
    playerState,
    diplomacyOrganizations,
    market,
    epoch,
    daysElapsed,
    foreignInvestments = [],
    taxPolicies = {},
    maxInvestments = MAX_TOP_INVESTMENTS,
    batchSize = 2,
    batchOffset = 0,
}) {
    // --- 缓存层：eligible investors 只在签名变化时重算 ---
    const sig = computeInboundSignature(investorNations, diplomacyOrganizations, daysElapsed);
    let sortedInvestors;

    if (sig === _investmentCache.inboundSignature && _investmentCache.inboundEligible.length > 0) {
        sortedInvestors = _investmentCache.inboundEligible;
    } else {
        const eligibleInvestors = [];
        const nations = investorNations || [];
        let skipCooldown = 0, skipPermission = 0, skipWealth = 0;

        for (let i = 0; i < nations.length; i++) {
            const n = nations[i];
            if (!n || n.id === 'player') continue;

            const investorOutput = getNationAnnualOutput(n, 0);
            const investorTreasury = getNationTreasury(n, 0);
            if (investorOutput < 1200 || investorTreasury < 300) { skipWealth++; continue; }

            if (!canForeignInvestInPlayer(n, playerState, diplomacyOrganizations, daysElapsed)) { skipPermission++; continue; }

            const lastDay = n.lastForeignInvestmentDay ?? -Infinity;
            if (daysElapsed - lastDay < 60) { skipCooldown++; continue; }

            eligibleInvestors.push(n);
        }

        debugLog('trade', `[INBOUND] 筛选完毕: ${eligibleInvestors.length} eligible / ${nations.length} total (跳过: 权限${skipPermission} 冷却${skipCooldown} 财政${skipWealth})`);

        sortedInvestors = eligibleInvestors.sort((a, b) => {
            const weightA = getRelationWeight(a.relation || 0) * getWealthSignal(a);
            const weightB = getRelationWeight(b.relation || 0) * getWealthSignal(b);
            return weightB - weightA;
        });

        _investmentCache.inboundSignature = sig;
        _investmentCache.inboundEligible = sortedInvestors;
        _investmentCache.inboundLastRefreshDay = daysElapsed;
    }

    if (sortedInvestors.length === 0) {
        return { investments: [], hasMore: false, nextOffset: 0 };
    }

    const batchInvestors = sortedInvestors.slice(batchOffset, batchOffset + batchSize);
    const hasMore = (batchOffset + batchSize) < sortedInvestors.length;
    const nextOffset = hasMore ? (batchOffset + batchSize) : 0;

    debugLog('trade', `[INBOUND] batch [${batchOffset}..${batchOffset + batchSize}] of ${sortedInvestors.length}: ${batchInvestors.map(n => n.name).join(', ')}`);

    const decisions = [];

    for (let i = 0; i < batchInvestors.length; i++) {
        const investorNation = batchInvestors[i];
        const investmentPolicy = investorNation.vassalPolicy?.investmentPolicy || 'autonomous';
        const roiThreshold = getInvestmentPolicyThreshold(investmentPolicy);

        const bestBuilding = selectBestInvestmentBuilding({
            targetBuildings: playerState?.buildings || {},
            targetJobFill: playerState?.jobFill || {},
            epoch,
            market,
            investorWealth: getNationTreasury(investorNation, 0),
            foreignInvestments,
            daysElapsed,
        });

        if (!bestBuilding || bestBuilding.roi <= roiThreshold) continue;

        debugLog('trade', `[INBOUND] ${investorNation.name} -> ${bestBuilding.building.name} ROI=${(bestBuilding.roi * 100).toFixed(1)}%`);

        decisions.push({
            investorNation,
            building: bestBuilding.building,
            cost: bestBuilding.cost,
            roi: bestBuilding.roi,
            investmentPolicy,
        });
    }

    if (decisions.length === 0) {
        return { investments: [], hasMore, nextOffset };
    }

    decisions.sort((a, b) => b.roi - a.roi);
    const topDecisions = decisions.slice(0, Math.min(maxInvestments, decisions.length));

    return {
        investments: topDecisions,
        hasMore,
        nextOffset,
    };
}

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
    daysElapsed,
    taxPolicies = {}
}) {
    // 1. Definition of autonomous investors
    // [FIX] Any stratum that can be a building owner should be able to invest
    // This includes: capitalist, merchant, artisan, peasant (for some gather buildings)
    // We'll dynamically determine this based on BUILDINGS config
    const INVESTOR_STRATA = ['capitalist', 'merchant', 'artisan', 'peasant', 'lumberjack'];
    const MIN_ROI_THRESHOLD = 0.15; // 15% Annualized ROI
    const INVESTMENT_CHANCE = 0.3; // 30% chance to actually invest if a good opportunity is found (to avoid draining all cash at once)
    const economicAidConfig = INDEPENDENCE_CONFIG?.controlMeasures?.economicAid || {};
    const investmentFocusChance = economicAidConfig.investmentFocusChance || 0;
    const investmentChanceMultiplier = economicAidConfig.investmentChanceMultiplier || 1;

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

        // 4. Check for economic_bloc in diplomacy organizations (multilateral)
        // Economic bloc members can invest in each other
        const hasOrgEconomicBloc = diplomacyOrganizations?.organizations?.some(org =>
            org.type === 'economic_bloc' && // [FIX] Correct type: economic_bloc
            org.members?.includes('player') &&
            org.members?.includes(targetNation.id)
        ) || false;

        const canInvest = isVassal || hasInvestmentPact || hasEconomicPact || hasOrgEconomicBloc;
        debugLog('trade', `🤖 [AUTO-INVEST] 检查目标 ${targetNation.name}: isVassal=${isVassal}, hasInvestmentPact=${hasInvestmentPact}, hasEconomicPact=${hasEconomicPact}, hasOrgEconomicBloc=${hasOrgEconomicBloc} => ${canInvest}`);
        return canInvest;
    };
    const isEconomicAidActive = (targetNation) => {
        if (!targetNation || targetNation.vassalOf !== 'player') return false;
        const aid = targetNation.vassalPolicy?.controlMeasures?.economicAid;
        return aid === true || (aid && aid.active !== false);
    };

    // 2. Shuffle strata to give random chance of who invests first
    const strata = [...INVESTOR_STRATA].sort(() => Math.random() - 0.5);

    debugLog('trade', `🤖 [AUTO-INVEST] 检查投资者阶层: ${strata.join(', ')}`);
    debugLog('trade', '🤖 [AUTO-INVEST] 阶层财富:', classWealth);

    for (const stratum of strata) {
        const wealth = classWealth[stratum] || 0;
        // Basic check: needs enough money for at least a cheap building (e.g. 1000)
        if (wealth < 1000) {
            debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 财富不足 (${wealth} < 1000), 跳过`);
            continue;
        }

        debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 财富=${wealth}, 开始寻找投资目标...`);

        // 3. Find potential targets
        // Filter valid nations first
        debugLog('trade', `🤖 [AUTO-INVEST] nations 列表: ${nations?.length || 0} 个, 国家: ${nations?.map(n => n.name).join(', ') || '无'}`);
        const validNations = nations.filter(n => canInvestInNation(n));
        debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 找到 ${validNations.length} 个有效投资目标`);
        if (validNations.length === 0) continue;

        // Shuffle nations to avoid always investing in the same one
        const preferredTargets = validNations.filter(isEconomicAidActive);
        const preferAidTargets = preferredTargets.length > 0 && investmentFocusChance > 0
            && Math.random() < investmentFocusChance;
        const targetPool = preferAidTargets ? preferredTargets : validNations;
        if (preferAidTargets) {
            debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 经济扶持优先目标: ${preferredTargets.map(n => n.name).join(', ')}`);
        }
        const preferredTargetIds = new Set(preferredTargets.map(n => n.id));
        const shuffledNations = [...targetPool].sort(() => Math.random() - 0.5);

        for (const targetNation of shuffledNations) {
            // 4. Find best building to invest in
            // [FIX] Use getInvestableBuildings to filter buildings for this stratum
            // Each stratum can only invest in buildings where they are the owner
            const candidateBuildings = getInvestableBuildings('treaty', stratum, epoch);

            debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 可投资的建筑: ${candidateBuildings.map(b => b.name).join(', ') || '无'}`);
            if (candidateBuildings.length === 0) continue;

            // Shuffle buildings
            const shuffledBuildings = candidateBuildings.sort(() => Math.random() - 0.5);

            for (const building of shuffledBuildings) {
                // [FIX] Use getBuildingSilverCost instead of building.cost?.silver
                // Building cost is the sum of all material costs * 1.5 overseas markup
                const cost = getBuildingSilverCost(building);
                debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 检查 ${building.name}: cost=${cost}, wealth=${wealth.toFixed(0)}, canAfford=${wealth >= cost}`);
                if (cost <= 0 || wealth < cost) {
                    debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 跳过 ${building.name}: 成本=${cost}, 财富不足`);
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
                    market?.prices || {},
                    {
                        taxPolicies,
                        organizations: diplomacyOrganizations?.organizations || [],
                        daysElapsed,
                        playerIsHome: true,
                        partnerNation: targetNation,
                    }
                );

                // [FIX] Use correct field name: 'profit' not 'totalProfit'
                const dailyProfit = calcResult.profit || 0;
                // Annualized ROI = (Daily Profit * 360) / Cost
                const annualROI = (dailyProfit * 360) / cost;

                debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 评估 ${building.name} 在 ${targetNation.name}: profit=${dailyProfit.toFixed(1)}/day, ROI=${(annualROI * 100).toFixed(1)}%, threshold=${(MIN_ROI_THRESHOLD * 100).toFixed(1)}%`);

                if (annualROI > MIN_ROI_THRESHOLD) {
                    // Found a good investment!
                    const isPreferredTarget = preferredTargetIds.has(targetNation.id);
                    const effectiveInvestmentChance = isPreferredTarget
                        ? Math.min(1, INVESTMENT_CHANCE * investmentChanceMultiplier)
                        : INVESTMENT_CHANCE;
                    const roll = Math.random();
                    debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} ROI足够! roll=${roll.toFixed(3)}, threshold=${effectiveInvestmentChance}, willInvest=${roll <= effectiveInvestmentChance}`);
                    if (roll > effectiveInvestmentChance) {
                        debugLog('trade', `🤖 [AUTO-INVEST] ${stratum} 随机跳过投资 (${(effectiveInvestmentChance * 100).toFixed(0)}%概率)`);
                        continue; // Chance to skip
                    }

                    debugLog('trade', `🤖 [AUTO-INVEST] ✅ ${stratum} 决定投资 ${building.name} 在 ${targetNation.name}!`);

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
                                targetNationId: targetNation.id,
                                ownerStratum: stratum,
                                strategy: 'PROFIT_MAX',
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
    daysElapsed,
    foreignInvestments = [] // [NEW] Existing foreign investments to check limit
}) {
    // Helper: Check if we can invest in a nation
    const canInvestInTarget = (target) => {
        if (!target) return false;

        const targetId = target.id;
        const isVassal = investorNation.vassalOf === targetId && investorNation.vassalType !== 'colony';
        const isSuzerain = target.vassalOf === investorNation.id;

        // Treaty check using diplomacyOrganizations
        // Check if both nations are in the same economic_bloc (economic organization allows investment)
        const hasEconomicOrg = diplomacyOrganizations?.organizations?.some(org =>
            org.type === 'economic_bloc' && // [FIX] Correct type: economic_bloc not economic_pact
            org.members.includes(investorNation.id) &&
            org.members.includes(targetId)
        );

        // Direct Treaty check - Check if investor nation has investment_pact or economic_pact with player
        const hasInvestmentPact = hasActiveTreaty(investorNation, 'investment_pact', daysElapsed);
        const hasEconomicPact = hasActiveTreaty(investorNation, 'economic_pact', daysElapsed);

        const canInvest = isVassal || isSuzerain || hasEconomicOrg || hasInvestmentPact || hasEconomicPact;
        
        debugLog('trade', `[AI投资检查] ${investorNation.name} -> ${targetId}: isVassal=${isVassal}, isSuzerain=${isSuzerain}, hasEconomicOrg=${hasEconomicOrg}, hasInvestmentPact=${hasInvestmentPact}, hasEconomicPact=${hasEconomicPact} => ${canInvest}`);
        
        return canInvest;
    };
    // 1. Check AI capability
    // Must be Civilized or Industrial era (Epoch 2+) to invest
    // Must have enough budget (Wealth > 5000)
    if (epoch < 2) return null;
    const investorOutput = getNationAnnualOutput(investorNation, 0);
    const investorTreasury = getNationTreasury(investorNation, 0);
    if (investorOutput < 1200 || investorTreasury < 300) return null;

    // 2. Identify Targets
    const targets = [];

    // Evaluate Player
    const playerRelation = investorNation.relation || 0;
    // 关系 > 30 且满足投资条约/附庸关系
    if (playerRelation > 30 && canInvestInTarget(playerState)) {
        const relationProbability = Math.max(0.1, (playerRelation - 30) / 70);
        if (Math.random() < relationProbability) {
            targets.push({ id: 'player', name: 'Player', ...playerState });
        }
    }

    if (targets.length === 0) return null;

    // 3. Determine Investment Policy Thresholds
    // 投资政策决定了 AI 愿意接受的 ROI 下限
    const investmentPolicy = investorNation.vassalPolicy?.investmentPolicy || 'autonomous';
    let roiThreshold = 0.10; // Default: Autonomous (10%)

    if (investmentPolicy === 'guided') {
        roiThreshold = 0.05; // Guided: 5%
    } else if (investmentPolicy === 'forced') {
        roiThreshold = -0.10; // Forced: Accepts loss up to -10%
    }

    // 4. Evaluate Buildings
    const candidateBuildings = BUILDINGS.filter(b => {
        if (b.cat !== 'gather' && b.cat !== 'industry') return false;
        if ((b.epoch || 0) > epoch) return false;
        if (!b.baseCost && !b.cost) return false;

        const jobs = b.jobs || {};
        const hasEmployees = Object.keys(jobs).some(jobStratum => jobStratum !== b.owner);
        return hasEmployees;
    });

    // Shuffle
    const shuffledBuildings = candidateBuildings.sort(() => Math.random() - 0.5);

    // Pre-index foreign investments once
    const fiIdx = buildForeignInvIndex(foreignInvestments);

    for (const target of targets) {
        for (const building of shuffledBuildings) {
            const costConfig = building.baseCost || building.cost || {};
            const baseCost = Object.values(costConfig).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
            const cost = (baseCost || 1000) * 1.5;
            if ((investorNation.wealth || 0) < cost || investorTreasury < cost * 0.2) continue;

            const targetBuildings = target.buildings || {};
            const playerBuildingCount = targetBuildings[building.id] || 0;
            if (playerBuildingCount <= 0) continue;

            const existingForeignCount = fiIdx.get(building.id) || 0;
            if (existingForeignCount >= playerBuildingCount) continue;

            // Check staffing ratio
            const targetJobFill = target.jobFill || {};
            const buildingJobFillData = targetJobFill[building.id] || {};
            const buildingJobs = building.jobs || {};

            let totalSlots = 0;
            let filledSlots = 0;
            Object.entries(buildingJobs).forEach(([role, slotsPerBuilding]) => {
                const totalRoleSlots = slotsPerBuilding * playerBuildingCount;
                totalSlots += totalRoleSlots;
                filledSlots += Math.min(buildingJobFillData[role] || 0, totalRoleSlots);
            });

            const buildingStaffingRatio = totalSlots > 0 ? filledSlots / totalSlots : 1;
            if (buildingStaffingRatio < MIN_FOREIGN_INVESTMENT_STAFFING_RATIO) continue;

            // [FIX] Use target nation's market prices instead of base prices
            // This ensures AI investors respond to price spikes (high demand = high profit opportunity)
            const investorMarketPrices = {};
            Object.keys(RESOURCES).forEach(key => {
                // For player target, use player market prices; otherwise use base prices
                investorMarketPrices[key] = (target.id === 'player' && market?.prices?.[key]) 
                    ? market.prices[key] 
                    : (RESOURCES[key].basePrice || 1);
            });

            const profitResult = calculateOverseasProfit(
                { buildingId: building.id, strategy: 'PROFIT_MAX' },
                target,
                {},
                investorMarketPrices,
                {
                    taxPolicies,
                    organizations: diplomacyOrganizations?.organizations || [],
                    daysElapsed,
                    playerIsHome: false,
                    partnerNation: investorNation,
                }
            );

            const dailyProfit = profitResult.profit || 0;
            const roi = cost > 0 ? (dailyProfit * 360) / cost : 0;

            debugLog('trade', `[AI投资] ${investorNation.name} 评估 ${building.name} (Policy: ${investmentPolicy}): ROI=${(roi * 100).toFixed(1)}%, Threshold=${(roiThreshold * 100).toFixed(1)}%`);

            // [NEW] Use dynamic threshold based on policy
            if (roi > roiThreshold) {
                debugLog('trade', `[AI投资] ${investorNation.name} 决定投资 ${building.name}! ROI=${(roi * 100).toFixed(1)}%`);
                return {
                    type: 'request_investment',
                    investorNation,
                    targetId: target.id,
                    building,
                    cost,
                    roi,
                    investmentPolicy, // Pass policy for later handling
                    action: () => {
                        return {
                            type: 'event',
                            eventData: {
                                nationId: investorNation.id,
                                opportunity: {
                                    buildingType: building.name,
                                    buildingId: building.id,
                                    potentialProfit: dailyProfit * 30,
                                    requiredInvestment: cost,
                                    ownerStratum: 'capitalist',
                                    investmentPolicy: investmentPolicy, // Pass to event
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
    investorWealth = Infinity,
    foreignInvestments = [],
    daysElapsed = 0,
}) {
    // --- 预索引 foreignInvestments: O(n) 一次，代替每建筑 O(n) filter ---
    const fiSig = `fi|${(foreignInvestments || []).length}|${Math.floor(daysElapsed / CACHE_REFRESH_INTERVAL)}`;
    let foreignInvIdx;
    if (fiSig === _investmentCache.foreignInvSignature && _investmentCache.foreignInvIndex) {
        foreignInvIdx = _investmentCache.foreignInvIndex;
    } else {
        foreignInvIdx = buildForeignInvIndex(foreignInvestments);
        _investmentCache.foreignInvIndex = foreignInvIdx;
        _investmentCache.foreignInvSignature = fiSig;
    }

    // --- 缓存层：静态建筑候选（仅依赖 epoch + targetBuildings keys）---
    // 只缓存 "不依赖 investorWealth" 的筛选步骤
    const bldSig = computeBuildingSignature(targetBuildings, epoch, daysElapsed);
    let preFilteredBuildings;

    if (bldSig === _investmentCache.buildingSignature && _investmentCache.buildingCandidates.length > 0) {
        preFilteredBuildings = _investmentCache.buildingCandidates;
    } else {
        preFilteredBuildings = [];
        const hasJobFillData = targetJobFill && Object.keys(targetJobFill).length > 0;
        let skipNoEmploy = 0, skipStaffing = 0, skipCap = 0;

        for (let i = 0; i < BUILDINGS.length; i++) {
            const b = BUILDINGS[i];
            if (b.cat !== 'gather' && b.cat !== 'industry') continue;
            if ((b.epoch || 0) > epoch) continue;
            if (!b.baseCost && !b.cost) continue;

            const jobs = b.jobs || {};
            const jobKeys = Object.keys(jobs);
            let hasEmployees = false;
            for (let j = 0; j < jobKeys.length; j++) {
                if (jobKeys[j] !== b.owner) { hasEmployees = true; break; }
            }
            if (!hasEmployees) { skipNoEmploy++; continue; }

            const buildingCount = targetBuildings[b.id] || 0;
            if (buildingCount <= 0) continue;

            const existingForeignCount = foreignInvIdx.get(b.id) || 0;
            if (existingForeignCount >= buildingCount) { skipCap++; continue; }

            if (hasJobFillData) {
                const buildingJobFillData = targetJobFill[b.id] || {};
                let totalSlots = 0, filledSlots = 0;
                for (let j = 0; j < jobKeys.length; j++) {
                    const role = jobKeys[j];
                    const slotsPerBuilding = jobs[role];
                    const totalRoleSlots = slotsPerBuilding * buildingCount;
                    totalSlots += totalRoleSlots;
                    filledSlots += Math.min(buildingJobFillData[role] || 0, totalRoleSlots);
                }
                const staffingRatio = totalSlots > 0 ? filledSlots / totalSlots : 1;
                if (staffingRatio < MIN_FOREIGN_INVESTMENT_STAFFING_RATIO) { skipStaffing++; continue; }
            }

            const costConfig = b.baseCost || b.cost || {};
            const vals = Object.values(costConfig);
            let baseCostSum = 0;
            for (let j = 0; j < vals.length; j++) {
                if (typeof vals[j] === 'number') baseCostSum += vals[j];
            }
            const cost = (baseCostSum || 1000) * 1.5;

            preFilteredBuildings.push({ building: b, cost });
        }

        _investmentCache.buildingSignature = bldSig;
        _investmentCache.buildingCandidates = preFilteredBuildings;

        debugLog('trade', `[投资筛选] 缓存刷新: ${preFilteredBuildings.length} 候选 (排除: 无雇佣${skipNoEmploy} 到岗率${skipStaffing} 外资上限${skipCap})`);
    }

    if (preFilteredBuildings.length === 0) return null;

    // --- 仅对 investorWealth 做运行时过滤 + ROI 计算 ---
    const prices = {};
    const resKeys = Object.keys(RESOURCES);
    for (let i = 0; i < resKeys.length; i++) {
        const key = resKeys[i];
        prices[key] = market?.prices?.[key] || RESOURCES[key]?.basePrice || 1;
    }
    const wages = market?.wages || {};

    let bestBuilding = null;
    let bestRoi = -Infinity;
    let bestCost = 0;

    for (let i = 0; i < preFilteredBuildings.length; i++) {
        const { building, cost } = preFilteredBuildings[i];
        if (cost > investorWealth) continue;

        let outputValue = 0;
        const output = building.output || {};
        const outputKeys = Object.keys(output);
        for (let j = 0; j < outputKeys.length; j++) {
            const res = outputKeys[j];
            if (res === 'maxPop' || res === 'militaryCapacity') continue;
            outputValue += output[res] * (prices[res] || 1);
        }

        let inputCost = 0;
        const input = building.input || {};
        const inputKeys = Object.keys(input);
        for (let j = 0; j < inputKeys.length; j++) {
            inputCost += input[inputKeys[j]] * (prices[inputKeys[j]] || 1);
        }

        let wageCost = 0;
        const jobs = building.jobs || {};
        const jobKeys = Object.keys(jobs);
        for (let j = 0; j < jobKeys.length; j++) {
            const stratum = jobKeys[j];
            if (building.owner && stratum === building.owner) continue;
            wageCost += jobs[stratum] * (wages[stratum] ?? 0.1);
        }

        const dailyProfit = outputValue - inputCost - wageCost;
        const roi = cost > 0 ? (dailyProfit * 360) / cost : 0;

        if (roi > bestRoi) {
            bestRoi = roi;
            bestBuilding = building;
            bestCost = cost;
        }
    }

    if (!bestBuilding) return null;

    debugLog('trade', `[投资筛选] 最佳: ${bestBuilding.name} ROI=${(bestRoi * 100).toFixed(1)}%`);
    return { building: bestBuilding, cost: bestCost, roi: bestRoi };
}

/**
 * 重置投资系统的模块级缓存。
 * 在每个新投资周期开始时调用，确保缓存不会跨周期残留过期数据。
 */
export function resetInvestmentCache() {
    _investmentCache.inboundSignature = '';
    _investmentCache.inboundEligible = [];
    _investmentCache.outboundSignature = '';
    _investmentCache.outboundCandidates = [];
    _investmentCache.buildingSignature = '';
    _investmentCache.buildingCandidates = [];
    _investmentCache.foreignInvIndex = null;
    _investmentCache.foreignInvSignature = '';
}
