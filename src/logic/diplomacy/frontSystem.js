/**
 * Front System
 *
 * When war is declared between two nations, a "front" is generated.
 * The front contains resource nodes and infrastructure drawn from both sides'
 * economies. Corps are assigned to fronts; battles play out on fronts.
 * Winning side can plunder resources and damage infrastructure.
 *
 * Data model:
 * - Front: { id, warId, attackerId, defenderId, status, resourceNodes[], infrastructure[], assignedCorps: { attacker:[], defender:[] } }
 * - ResourceNode: { id, type, amount, owner, plundered }
 * - Infrastructure: { id, name, owner, durability, maxDurability, economicEffect }
 */

import { BUILDINGS } from '../../config/buildings';
import { RESOURCES } from '../../config';
import { UNIT_TYPES, calculateArmyMaintenance } from '../../config/militaryUnits';
import { getCorpsTotalUnits, getCorpsFrontTask } from './corpsSystem';
import { calculateWarBuildingDamage, calculateWarPopulationLoss, calculateWarPlunder } from './warEconomy';

let frontIdCounter = 0;
const FRONT_MIN_POSITION = 5;
const FRONT_MAX_POSITION = 95;

const generateFrontId = () => {
    frontIdCounter += 1;
    return `front_${Date.now()}_${frontIdCounter}`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// ========== Checkpoint Zone System ==========

/**
 * 7 zones from defender core (0) to attacker core (100)
 * linePosition 0 = defender fully controls, 100 = attacker fully controls
 */
export const FRONT_ZONES = [
    { id: 0, name: '守方核心区', start: 0, end: 15, ownerSide: 'defender', category: 'capital', buildingCats: ['gather', 'industry', 'civic', 'military'] },
    { id: 1, name: '守方经济区', start: 15, end: 35, ownerSide: 'defender', category: 'economic', buildingCats: ['industry', 'civic'] },
    { id: 2, name: '守方前沿', start: 35, end: 50, ownerSide: 'defender', category: 'frontier', buildingCats: ['military', 'gather'] },
    { id: 3, name: '攻方前沿', start: 50, end: 65, ownerSide: 'attacker', category: 'frontier', buildingCats: ['military', 'gather'] },
    { id: 4, name: '攻方经济区', start: 65, end: 85, ownerSide: 'attacker', category: 'economic', buildingCats: ['industry', 'civic'] },
    { id: 5, name: '攻方核心区', start: 85, end: 100, ownerSide: 'attacker', category: 'capital', buildingCats: ['gather', 'industry', 'civic', 'military'] },
];

export const CHECKPOINTS = [15, 35, 50, 65, 85];

/**
 * Get the zone object for a given linePosition
 */
export const getZoneForPosition = (linePosition) => {
    const pos = clamp(linePosition, 0, 100);
    for (const zone of FRONT_ZONES) {
        if (pos >= zone.start && pos < zone.end) return zone;
    }
    // Edge case: pos === 100, return last zone
    return FRONT_ZONES[FRONT_ZONES.length - 1];
};

/**
 * Get checkpoints crossed when position moves from oldPos to newPos
 * Returns array of { checkpoint, direction: 'forward'|'backward' }
 * forward = attacker advancing (pos increasing), backward = defender pushing back
 */
export const getCheckpointsCrossed = (oldPos, newPos) => {
    const crossed = [];
    if (oldPos === newPos) return crossed;
    const direction = newPos > oldPos ? 'forward' : 'backward';
    const lo = Math.min(oldPos, newPos);
    const hi = Math.max(oldPos, newPos);
    for (const cp of CHECKPOINTS) {
        // Checkpoint is crossed if it falls strictly between old and new positions
        if (cp > lo && cp <= hi) {
            crossed.push({ checkpoint: cp, direction });
        }
    }
    return crossed;
};

const FRONT_PHASE_LABELS = {
    contact: '僵持',
    pressure: '拉锯',
    breakthrough: '压制',
    collapse: '崩溃',
};

export const FRONT_POSTURES = {
    offensive: {
        id: 'offensive',
        name: '强攻推进',
        desc: '推进更快，但补给与伤亡压力更高。',
        advanceMod: 1.25,
        attritionMod: 1.25,
        supplyMod: 1.2,
        entrenchmentMod: 0.9,
        raidMod: 0.95,
    },
    balanced: {
        id: 'balanced',
        name: '稳扎稳打',
        desc: '推进稳定，兼顾补给、工事与持续作战。',
        advanceMod: 1.0,
        attritionMod: 1.0,
        supplyMod: 1.0,
        entrenchmentMod: 1.0,
        raidMod: 1.0,
    },
    attrition: {
        id: 'attrition',
        name: '固守消耗',
        desc: '强化工事与对峙收益，推进较慢，适合拖垮对手。',
        advanceMod: 0.82,
        attritionMod: 0.85,
        supplyMod: 0.9,
        entrenchmentMod: 1.25,
        raidMod: 0.8,
    },
    raid: {
        id: 'raid',
        name: '破袭骚扰',
        desc: '重点打击敌方补给和经济，不追求快速突破。',
        advanceMod: 0.75,
        attritionMod: 0.95,
        supplyMod: 0.95,
        entrenchmentMod: 0.95,
        raidMod: 1.35,
    },
};

const LEGACY_POSTURE_MAP = {
    aggressive: 'offensive',
    defensive: 'balanced',
    passive: 'attrition',
};

const deriveFrontPhase = (linePosition = 50) => {
    if (linePosition >= 90 || linePosition <= 10) return 'collapse';
    if (linePosition >= 75 || linePosition <= 25) return 'breakthrough';
    if (linePosition >= 60 || linePosition <= 40) return 'pressure';
    return 'contact';
};

const getTotalUnitsFromCorps = (corpsList = []) => corpsList.reduce((sum, corps) => {
    const units = Object.values(corps?.units || {}).reduce((s, count) => s + (count || 0), 0);
    return sum + units;
}, 0);

const normalizePostureId = (posture) => LEGACY_POSTURE_MAP[posture] || posture || 'balanced';

const buildEmptySideState = (epoch = 0) => ({
    deployedUnits: 0,
    corpsCount: 0,
    supplyNeed: {
        resources: {},
        logisticsMultiplier: 1,
        food: 0,
        silver: 0,
        materiel: 0,
        materielResource: epoch >= 5 ? 'ammunition' : epoch >= 4 ? 'gunpowder' : 'wood',
    },
    supplyAvailable: {
        resources: {},
        food: 0,
        silver: 0,
        materiel: 0,
        materielResource: epoch >= 5 ? 'ammunition' : epoch >= 4 ? 'gunpowder' : 'wood',
    },
    supplyRatio: 1,
    supplyState: '未接战',
    entrenchment: 25,
    raidPower: 0,
    reservePower: 0,
    advancePower: 0,
    defensePower: 0,
    economicPressure: 0,
    civilianPressure: 0,
});

export const getFrontPostureIdForSide = (front, side) => {
    const configured = front?.postures?.[side];
    if (configured) return normalizePostureId(configured);
    if (side === getPlayerSide(front)) {
        return normalizePostureId(front?.posture);
    }
    return normalizePostureId(front?.aiPosture || 'balanced');
};

export const getFrontPostureConfig = (posture) => {
    const postureId = normalizePostureId(posture);
    return FRONT_POSTURES[postureId] || FRONT_POSTURES.balanced;
};

const getRoleWeightedStrength = (corpsList = [], mode = 'advance') => corpsList.reduce((sum, corps) => {
    const units = getCorpsTotalUnits(corps);
    if (units <= 0) return sum;
    const task = getCorpsFrontTask(corps);
    const moraleFactor = 0.5 + ((corps?.morale ?? 100) / 100) * 0.5;
    const modeWeight = task?.[`${mode}Weight`] || 1;
    return sum + units * moraleFactor * modeWeight;
}, 0);

const getZoneRiskLabel = (linePosition, side) => {
    if (side === 'attacker') {
        if (linePosition < 15) return '核心区承压';
        if (linePosition < 35) return '经济区承压';
        if (linePosition < 50) return '边境区承压';
    } else {
        if (linePosition > 85) return '核心区承压';
        if (linePosition > 65) return '经济区承压';
        if (linePosition > 50) return '边境区承压';
    }
    return '边境接触';
};

const getSupplyStateLabel = (ratio) => {
    if (ratio >= 1.05) return '充足';
    if (ratio >= 0.85) return '稳定';
    if (ratio >= 0.65) return '吃紧';
    return '断裂';
};

const aggregateArmyFromCorps = (corpsList = []) => corpsList.reduce((army, corps) => {
    Object.entries(corps?.units || {}).forEach(([unitId, count]) => {
        if (count > 0) {
            army[unitId] = (army[unitId] || 0) + count;
        }
    });
    return army;
}, {});

const getSideLogisticsPressure = (linePosition = 50, side = 'attacker') => {
    if (side === 'attacker') {
        return Math.max(0, (linePosition - 50) / 50);
    }
    return Math.max(0, (50 - linePosition) / 50);
};

const isSideUnderTerritorialPressure = (linePosition = 50, side = 'attacker') => (
    side === 'attacker' ? linePosition < 50 : linePosition > 50
);

export const buildResourceCoverage = (needResources = {}, availableResources = {}) => {
    const resourceKeys = Object.keys(needResources);
    if (resourceKeys.length === 0) return 1;
    // 核心资源权重高（food、silver 是军队生存必需），次要资源按需求量比例加权
    const CORE_RESOURCES = ['food', 'silver'];
    let coreMin = 1;       // 核心资源取最低覆盖率
    let secondaryWeightedSum = 0;
    let secondaryWeightTotal = 0;
    resourceKeys.forEach((resourceKey) => {
        const needed = Number(needResources[resourceKey] || 0);
        if (needed <= 0) return;
        const available = Number(availableResources[resourceKey] || 0);
        const ratio = Math.min(1, available / needed);
        const safeRatio = Number.isFinite(ratio) ? ratio : 1;
        if (CORE_RESOURCES.includes(resourceKey)) {
            coreMin = Math.min(coreMin, safeRatio);
        } else {
            // 次要资源按需求量加权（需求越大权重越高）
            secondaryWeightedSum += safeRatio * needed;
            secondaryWeightTotal += needed;
        }
    });
    // 次要资源加权平均覆盖率（无次要资源时视为 100%）
    const secondaryAvg = secondaryWeightTotal > 0 ? secondaryWeightedSum / secondaryWeightTotal : 1;
    // 总补给率 = 核心资源覆盖率 * 70% 权重 + 次要资源覆盖率 * 30% 权重
    // 但核心资源不足时应直接体现（核心覆盖率作为硬上限）
    const combined = coreMin * 0.7 + secondaryAvg * 0.3;
    return Math.max(0, Math.min(1, Math.min(combined, coreMin + 0.15)));
};

const buildFactor = (label, value, kind = 'neutral') => ({
    label,
    value: Number(value.toFixed(2)),
    kind,
});

const buildWarScoreBreakdown = (prev = {}, updates = {}) => ({
    battle: (prev.battle || 0) + (updates.battle || 0),
    advance: (prev.advance || 0) + (updates.advance || 0),
    economic: (prev.economic || 0) + (updates.economic || 0),
    homeland: (prev.homeland || 0) + (updates.homeland || 0),
});

const getWarScoreBreakdownTotal = (breakdown = {}) => (
    Number(breakdown?.battle || 0)
    + Number(breakdown?.advance || 0)
    + Number(breakdown?.economic || 0)
    + Number(breakdown?.homeland || 0)
);

const deriveDetailedPhase = (linePosition, pressure, supplyRatio, contestedZone) => {
    if (linePosition <= 8 || linePosition >= 92 || pressure >= 80) return 'collapse';
    if (linePosition <= 22 || linePosition >= 78 || (pressure >= 62 && supplyRatio >= 0.9)) return 'breakthrough';
    if (linePosition <= 40 || linePosition >= 60 || contestedZone.includes('经济')) return 'pressure';
    return 'contact';
};

export const summarizeFrontState = (front, attackerCorps = [], defenderCorps = []) => {
    const normalizedFront = ensureFrontDefaults(front);
    const attackerUnits = getTotalUnitsFromCorps(attackerCorps);
    const defenderUnits = getTotalUnitsFromCorps(defenderCorps);
    const totalUnits = Math.max(1, attackerUnits + defenderUnits);
    const attackerAdvance = getRoleWeightedStrength(attackerCorps, 'advance');
    const defenderAdvance = getRoleWeightedStrength(defenderCorps, 'advance');
    const attackerDefense = getRoleWeightedStrength(attackerCorps, 'defense');
    const defenderDefense = getRoleWeightedStrength(defenderCorps, 'defense');
    const attackerRaid = getRoleWeightedStrength(attackerCorps, 'raid');
    const defenderRaid = getRoleWeightedStrength(defenderCorps, 'raid');
    const attackerReserve = getRoleWeightedStrength(attackerCorps, 'reserve');
    const defenderReserve = getRoleWeightedStrength(defenderCorps, 'reserve');

    const attackerPostureCfg = getFrontPostureConfig(getFrontPostureIdForSide(normalizedFront, 'attacker'));
    const defenderPostureCfg = getFrontPostureConfig(getFrontPostureIdForSide(normalizedFront, 'defender'));
    const attackPressure = ((attackerAdvance * attackerPostureCfg.advanceMod) - (defenderDefense * defenderPostureCfg.entrenchmentMod)) / totalUnits * 100;
    const defensePressure = ((defenderAdvance * defenderPostureCfg.advanceMod) - (attackerDefense * attackerPostureCfg.entrenchmentMod)) / totalUnits * 100;
    const rawPressure = 50 + (attackPressure - defensePressure) * 0.6;
    const pressure = clamp(rawPressure, 0, 100);

    const ownSide = getPlayerSide(normalizedFront);
    const playerUnits = ownSide === 'attacker' ? attackerUnits : defenderUnits;
    const enemyUnits = ownSide === 'attacker' ? defenderUnits : attackerUnits;
    const playerRaid = ownSide === 'attacker' ? attackerRaid : defenderRaid;
    const enemyRaid = ownSide === 'attacker' ? defenderRaid : attackerRaid;
    const playerReserve = ownSide === 'attacker' ? attackerReserve : defenderReserve;
    const enemyReserve = ownSide === 'attacker' ? defenderReserve : attackerReserve;

    const playerPostureCfg = getFrontPostureConfig(getFrontPostureIdForSide(normalizedFront, ownSide || 'attacker'));
    const enemyPostureCfg = getFrontPostureConfig(getFrontPostureIdForSide(normalizedFront, ownSide === 'attacker' ? 'defender' : 'attacker'));
    const raidIntensity = clamp(((playerRaid * playerPostureCfg.raidMod) - (enemyRaid * enemyPostureCfg.raidMod)) / Math.max(1, playerUnits + enemyUnits) * 120 + 50, 0, 100);
    const entrenchment = {
        attacker: clamp(Math.round((attackerDefense / Math.max(1, attackerUnits)) * 20 * attackerPostureCfg.entrenchmentMod + 25), 0, 100),
        defender: clamp(Math.round((defenderDefense / Math.max(1, defenderUnits)) * 20 * defenderPostureCfg.entrenchmentMod + 25), 0, 100),
    };

    const fallbackPlayerResources = normalizedFront.playerResources || {};
    const fallbackEnemyStock = normalizedFront.aiResources || {};
    const sideResources = {
        attacker: normalizedFront.sideResources?.attacker || (normalizedFront.attackerId === 'player' ? fallbackPlayerResources : fallbackEnemyStock),
        defender: normalizedFront.sideResources?.defender || (normalizedFront.defenderId === 'player' ? fallbackPlayerResources : fallbackEnemyStock),
    };
    const buildSideState = (side, corpsList, units, raidPower, reservePower, advancePower, defensePower, postureCfg) => {
        const army = aggregateArmyFromCorps(corpsList);
        const baseMaintenance = calculateArmyMaintenance(army);
        const normalizedBaseMaintenance = Object.fromEntries(
            Object.entries(baseMaintenance).map(([resourceKey, amount]) => [
                resourceKey,
                Math.max(0, Number(amount || 0)),
            ])
        );
        const logisticsPressure = getSideLogisticsPressure(normalizedFront.linePosition, side);
        const supplyLinePressure = Math.max(0, Number(normalizedFront.economicDamageBreakdown?.supplyLineDamage || 0)) / 100;
        const supplyLinePenalty = supplyLinePressure * 0.55;
        // 战线部署基础补给系数：部署到前线的军团比待命多30%补给需求
        const frontDeploymentBase = units > 0 ? 1.3 : 1.0;
        // 推进到敌方领土时产生额外补给需求（每深入10%增加约15%补给成本）
        const advanceSupplyPenalty = logisticsPressure * 1.5;
        let logisticsMultiplier = clamp(
            frontDeploymentBase * postureCfg.supplyMod + advanceSupplyPenalty + supplyLinePenalty,
            1,
            4
        );
        let battleSupplyMod = 1;
        // 会战期间额外补给消耗
        if (normalizedFront.activeBattleId) {
            battleSupplyMod = { probe: 1.3, assault: 1.8, siege: 1.6 }[normalizedFront.activeBattleType] || 1.5;
            logisticsMultiplier = clamp(logisticsMultiplier * battleSupplyMod, 1, 6);
        }
        const needResources = Object.fromEntries(
            Object.entries(normalizedBaseMaintenance).map(([resourceKey, amount]) => [
                resourceKey,
                Math.max(0, Math.ceil(amount * logisticsMultiplier)),
            ])
        );

        const stock = sideResources[side] || {};
        const availableResources = Object.fromEntries(
            Object.keys(needResources).map((resourceKey) => [resourceKey, Number(stock[resourceKey] || 0)])
        );
        const ammoResource = Object.keys(needResources).find((resourceKey) => ['ammunition', 'gunpowder', 'wood'].includes(resourceKey)) || 'wood';
        const supplyRatio = units > 0 ? buildResourceCoverage(needResources, availableResources) : 1;
        return {
            deployedUnits: units,
            corpsCount: corpsList.length,
            supplyNeed: {
                resources: needResources,
                baseResources: normalizedBaseMaintenance,
                logisticsMultiplier: Number(logisticsMultiplier.toFixed(2)),
                modifierBreakdown: {
                    frontDeploymentBase: Number(frontDeploymentBase.toFixed(2)),
                    postureSupplyMod: Number(postureCfg.supplyMod || 1),
                    advanceSupplyPenalty: Number(advanceSupplyPenalty.toFixed(2)),
                    supplyLinePenalty: Number(supplyLinePenalty.toFixed(2)),
                    battleSupplyMod: Number(battleSupplyMod.toFixed(2)),
                },
                food: Number(needResources.food || 0),
                silver: Number(needResources.silver || 0),
                materiel: Number(needResources[ammoResource] || 0),
                materielResource: ammoResource,
            },

            supplyAvailable: {
                resources: availableResources,
                food: Number(availableResources.food || 0),
                silver: Number(availableResources.silver || 0),
                materiel: Number(availableResources[ammoResource] || 0),
                materielResource: ammoResource,
            },
            supplyRatio: Number(supplyRatio.toFixed(2)),
            supplyState: units > 0 ? getSupplyStateLabel(supplyRatio) : '未接战',
            entrenchment: entrenchment[side],
            raidPower: Number(raidPower.toFixed(1)),
            reservePower: Number(reservePower.toFixed(1)),
            advancePower: Number(advancePower.toFixed(1)),
            defensePower: Number(defensePower.toFixed(1)),
            economicPressure: 0,
            civilianPressure: Number(normalizedFront.economicDamageBreakdown?.civilianPressure || 0),
        };
    };

    const attackerState = buildSideState('attacker', attackerCorps, attackerUnits, attackerRaid, attackerReserve, attackerAdvance, attackerDefense, attackerPostureCfg);
    const defenderState = buildSideState('defender', defenderCorps, defenderUnits, defenderRaid, defenderReserve, defenderAdvance, defenderDefense, defenderPostureCfg);
    const playerState = ownSide === 'attacker' ? attackerState : defenderState;
    const enemyState = ownSide === 'attacker' ? defenderState : attackerState;
    const supplyState = {
        attacker: attackerState.supplyState,
        defender: defenderState.supplyState,
        player: playerState.supplyState,
        playerRatio: playerState.supplyRatio,
        playerNeed: playerState.supplyNeed,
    };

    const contestedZone = getZoneRiskLabel(normalizedFront.linePosition, ownSide || 'attacker');
    const phase = deriveDetailedPhase(normalizedFront.linePosition, pressure, playerState.supplyRatio, contestedZone);

    return {
        pressure: Math.round(pressure),
        raidIntensity: Math.round(raidIntensity),
        entrenchment,
        contestedZone,
        phase,
        supplyState,
        sideState: {
            attacker: attackerState,
            defender: defenderState,
        },
        attacker: attackerState,
        defender: defenderState,
        playerView: {
            side: ownSide,
            own: playerState,
            enemy: enemyState,
            supplyState,
            pressure: Math.round(pressure),
            raidIntensity: Math.round(raidIntensity),
            entrenchment,
            contestedZone,
            phase,
        },
        summary: {
            playerUnits,
            enemyUnits,
            playerReserve: Math.round(playerReserve),
            enemyReserve: Math.round(enemyReserve),
        },
    };
};

const getAdvanceNarrative = (front, delta) => {
    const absDelta = Math.abs(delta);
    const attackerName = front.attackerId === 'player' ? '我军' : '攻方';
    const defenderName = front.defenderId === 'player' ? '我军' : '守方';

    if (absDelta < 0.6) {
        return '前线僵持，暂无明显推进';
    }
    if (delta > 0) {
        return absDelta >= 2.5 ? `${attackerName}夺取关键阵地，前线明显前推` : `${attackerName}稳步推进战线`;
    }
    return absDelta >= 2.5 ? `${defenderName}组织反击，战线被迫后撤` : `${defenderName}局部反推，前线回拉`;
};

// ========== Resource Node Templates (fallback for legacy/compatibility) ==========

// Fallback templates for when no building data is available
const RESOURCE_NODE_FALLBACK = [
    { type: 'farm', resource: 'food', baseAmount: 200, epochScale: 1.2, desc: '農田' },
    { type: 'mine', resource: 'iron', baseAmount: 80, epochScale: 1.3, desc: '矿脉' },
    { type: 'forest', resource: 'wood', baseAmount: 150, epochScale: 1.1, desc: '林場' },
    { type: 'quarry', resource: 'stone', baseAmount: 100, epochScale: 1.15, desc: '采石场' },
    { type: 'treasury', resource: 'silver', baseAmount: 300, epochScale: 1.4, desc: '财库' },
];

// Legacy export alias (kept for backward compat)
const RESOURCE_NODE_TEMPLATES = RESOURCE_NODE_FALLBACK;

// Infrastructure: now derived from buildings; legacy templates kept as fallback
const INFRASTRUCTURE_FALLBACK = [
    { type: 'supply_depot', name: '补给站', baseDurability: 100, effect: { supply: 0.1 }, desc: '为己方军队提供补给加成' },
    { type: 'watchtower', name: '瞭望塔', baseDurability: 60, effect: { defense: 0.08 }, desc: '提供防御加成' },
    { type: 'market_town', name: '市镇', baseDurability: 120, effect: { income: 50 }, desc: '每日产生银币收入' },
];

const INFRASTRUCTURE_TEMPLATES = INFRASTRUCTURE_FALLBACK;

// ========== Zone-based Resource Generation ==========

// Non-resource building outputs that should be excluded
const NON_RESOURCE_OUTPUTS = ['maxPop', 'militaryCapacity', 'culture', 'science'];

/**
 * Get primary output resource from a building's output object
 */
const getMainResource = (output) => {
    if (!output || typeof output !== 'object') return null;
    const entries = Object.entries(output).filter(([k]) => !NON_RESOURCE_OUTPUTS.includes(k) && RESOURCES[k]);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { resource: entries[0][0], outputRate: entries[0][1] };
};

let zoneNodeCounter = 0;

/**
 * Generate resource nodes for a specific zone based on owner's real buildings
 * @param {Object} zone - FRONT_ZONES entry
 * @param {Object} ownerBuildings - { buildingId: count }
 * @param {number} epoch
 * @param {string} ownerId
 * @returns {Array} resource nodes
 */
const generateZoneResources = (zone, ownerBuildings, epoch, ownerId) => {
    const nodes = [];
    const allowedCats = zone.buildingCats || [];

    // Filter buildings by zone's allowed categories
    const candidates = [];
    const buildingEntries = Object.entries(ownerBuildings || {}).filter(([, count]) => count > 0);

    for (const [bId, count] of buildingEntries) {
        const bDef = BUILDINGS.find(b => b.id === bId);
        if (!bDef || !allowedCats.includes(bDef.cat)) continue;
        const main = getMainResource(bDef.output);
        if (!main) continue;
        candidates.push({ building: bDef, count, ...main });
    }

    if (candidates.length > 0) {
        // Shuffle and take 2-4
        const shuffled = candidates.sort(() => Math.random() - 0.5);
        const nodeCount = Math.min(4, Math.max(2, shuffled.length));

        for (let i = 0; i < nodeCount && i < shuffled.length; i++) {
            const c = shuffled[i];
            // Amount = outputRate × count × (2~5 days of production), clamped 50~2000
            const daysFactor = 2 + Math.floor(Math.random() * 4); // 2-5
            const amount = clamp(Math.floor(c.outputRate * c.count * daysFactor), 50, 2000);

            zoneNodeCounter++;
            nodes.push({
                id: `zrn_${zoneNodeCounter}`,
                type: c.building.id,
                resource: c.resource,
                desc: c.building.name,
                amount,
                maxAmount: amount,
                owner: ownerId,
                linkedBuildingId: c.building.id,
                zoneId: zone.id,
                plundered: false,
            });
        }
    } else {
        // Fallback: epoch-appropriate buildings when no owned buildings match
        const epochBuildings = BUILDINGS.filter(b => b.epoch <= epoch && allowedCats.includes(b.cat));
        const validBuildings = epochBuildings.filter(b => getMainResource(b.output));
        const nodeCount = Math.min(3, Math.max(2, validBuildings.length));

        for (let i = 0; i < nodeCount && i < validBuildings.length; i++) {
            const bDef = validBuildings[Math.floor(Math.random() * validBuildings.length)];
            const main = getMainResource(bDef.output);
            if (!main) continue;
            const daysFactor = 2 + Math.floor(Math.random() * 4);
            const amount = clamp(Math.floor(main.outputRate * (1 + Math.floor(Math.random() * 3)) * daysFactor), 50, 2000);

            zoneNodeCounter++;
            nodes.push({
                id: `zrn_${zoneNodeCounter}`,
                type: bDef.id,
                resource: main.resource,
                desc: bDef.name,
                amount,
                maxAmount: amount,
                owner: ownerId,
                linkedBuildingId: bDef.id,
                zoneId: zone.id,
                plundered: false,
            });
        }
    }

    return nodes;
};

// Category → infrastructure effect mapping
const CAT_EFFECT_MAP = {
    military: { defense: 0.12 },
    civic: { income: 40 },
    gather: { supply: 0.08 },
    industry: { supply: 0.1 },
};

let zoneInfraCounter = 0;

/**
 * Generate infrastructure for a specific zone based on owner's real buildings
 */
const generateZoneInfrastructure = (zone, ownerBuildings, epoch, ownerId) => {
    const infra = [];
    const allowedCats = zone.buildingCats || [];

    const buildingEntries = Object.entries(ownerBuildings || {}).filter(([, count]) => count > 0);
    const byCat = {};
    for (const [bId, count] of buildingEntries) {
        const bDef = BUILDINGS.find(b => b.id === bId);
        if (!bDef || !allowedCats.includes(bDef.cat)) continue;
        if (!byCat[bDef.cat]) byCat[bDef.cat] = [];
        byCat[bDef.cat].push({ building: bDef, count });
    }

    // Pick 1 representative per category (up to 2)
    const cats = Object.keys(byCat).slice(0, 2);
    if (cats.length > 0) {
        for (const cat of cats) {
            const candidates = byCat[cat];
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            const durability = Math.floor(100 * (1 + epoch * 0.15));

            zoneInfraCounter++;
            infra.push({
                id: `zinf_${zoneInfraCounter}`,
                type: pick.building.id,
                name: pick.building.name,
                desc: pick.building.desc || pick.building.name,
                owner: ownerId,
                linkedBuildingId: pick.building.id,
                zoneId: zone.id,
                durability,
                maxDurability: durability,
                effect: { ...(CAT_EFFECT_MAP[cat] || { supply: 0.05 }) },
                destroyed: false,
            });
        }
    } else {
        // Fallback: 1 generic infrastructure
        const template = INFRASTRUCTURE_FALLBACK[Math.floor(Math.random() * INFRASTRUCTURE_FALLBACK.length)];
        const durability = Math.floor((template?.baseDurability || 80) * (1 + epoch * 0.15));
        zoneInfraCounter++;
        infra.push({
            id: `zinf_${zoneInfraCounter}`,
            type: template?.type || 'supply_depot',
            name: template?.name || '补给站',
            desc: template?.desc || '',
            owner: ownerId,
            zoneId: zone.id,
            durability,
            maxDurability: durability,
            effect: { ...(template?.effect || { supply: 0.05 }) },
            destroyed: false,
        });
    }

    return infra;
};

/**
 * Rebuild top-level aggregated resourceNodes/infrastructure from zones
 */
const rebuildFrontAggregates = (front) => {
    const zones = front.zones || {};
    return {
        ...front,
        resourceNodes: Object.values(zones).flatMap(z => z.resourceNodes || []),
        infrastructure: Object.values(zones).flatMap(z => z.infrastructure || []),
    };
};

// ========== Front Generation ==========

/**
 * Generate a front when war is declared
 * @param {string} attackerId - The aggressor nation id (or 'player')
 * @param {string} defenderId - The defending nation id (or 'player')
 * @param {number} epoch - Current game epoch
 * @param {Object} attackerEconomy - { resources, buildings, population, wealth }
 * @param {Object} defenderEconomy - { resources, buildings, population, wealth }
 * @returns {Object} New front object
 */
export const generateFront = (attackerId, defenderId, epoch, attackerEconomy, defenderEconomy) => {
    const frontId = generateFrontId();

    // Initialize zones: only frontline zones (2,3) are initially reached
    const zones = {};
    for (const zone of FRONT_ZONES) {
        const isInitialFrontline = zone.id === 2 || zone.id === 3;
        zones[zone.id] = {
            resourceNodes: [],
            infrastructure: [],
            reached: isInitialFrontline,
            cleared: false,
        };
    }

    // Generate initial resources only for the two frontline zones
    const attackerBuildings = attackerEconomy?.buildings || {};
    const defenderBuildings = defenderEconomy?.buildings || {};

    // Zone 2 (defender frontier): use defender's buildings
    zones[2].resourceNodes = generateZoneResources(FRONT_ZONES[2], defenderBuildings, epoch, defenderId);
    zones[2].infrastructure = generateZoneInfrastructure(FRONT_ZONES[2], defenderBuildings, epoch, defenderId);

    // Zone 3 (attacker frontier): use attacker's buildings
    zones[3].resourceNodes = generateZoneResources(FRONT_ZONES[3], attackerBuildings, epoch, attackerId);
    zones[3].infrastructure = generateZoneInfrastructure(FRONT_ZONES[3], attackerBuildings, epoch, attackerId);

    // Build aggregated top-level views
    const resourceNodes = Object.values(zones).flatMap(z => z.resourceNodes);
    const infrastructure = Object.values(zones).flatMap(z => z.infrastructure);

    return {
        id: frontId,
        warId: `${attackerId}_vs_${defenderId}`,
        attackerId,
        defenderId,
        status: 'active', // active | stalemate | collapsed
        createdDay: 0, // Will be set by caller
        startDay: 0,
        linePosition: 50, // 0=defender controls, 100=attacker controls
        lineVelocity: 0,
        phase: 'contact',
        controlLog: [],
        _lastAdvanceDay: 0,
        posture: 'balanced',
        aiPosture: 'balanced',
        postures: { attacker: 'balanced', defender: 'balanced' },
        pressure: 50,
        supplyState: {
            attacker: '稳定',
            defender: '稳定',
            player: '稳定',
            playerRatio: 1,
            playerNeed: { resources: {}, logisticsMultiplier: 1, food: 0, silver: 0, materiel: 0, materielResource: 'wood' },
        },
        sideState: {
            attacker: buildEmptySideState(epoch),
            defender: buildEmptySideState(epoch),
        },
        raidIntensity: 0,
        entrenchment: { attacker: 25, defender: 25 },
        contestedZone: '边境接触',
        lastResolvedFactors: [],
        frontDailySummary: [],
        warScoreBreakdown: { battle: 0, advance: 0, economic: 0, homeland: 0 },
        lastOccupationScoreDay: 0,
        lastWarEconomyDamageDay: 0,
        activeBattleId: null,
        recentBattleReports: [],
        economicDamageBreakdown: {
            supplyLineDamage: 0,
            productionLoss: 0,
            infrastructureLoss: 0,
            civilianPressure: 0,
        },
        zones,
        resourceNodes,
        infrastructure,
        destroyedBuildings: {}, // { nationId: { buildingId: count } }
        assignedCorps: {
            attacker: [], // corps IDs
            defender: [], // corps IDs
        },
        frontlineCorpsOrder: {
            attacker: [],
            defender: [],
        },
        frontPlans: {},
        sideResources: {
            attacker: attackerId === 'player' ? { ...(attackerEconomy?.resources || {}) } : {},
            defender: defenderId === 'player' ? { ...(defenderEconomy?.resources || {}) } : {},
        },
        frontPower: {
            attacker: 0,
            defender: 0,
        },
        // Cumulative plunder/damage tracking
        totalPlundered: { attacker: {}, defender: {} },
        totalDamage: { attacker: 0, defender: 0 },
    };
};

/**
 * Ensure front has all runtime fields for backward compatibility.
 * @param {Object} front
 * @returns {Object}
 */
export const ensureFrontDefaults = (front) => {
    if (!front || typeof front !== 'object') return front;
    // 已正规化的 front 直接返回，避免每 tick 重复处理
    if (front._normalized) return front;

    const normalizedPosition = clamp(
        Number.isFinite(front.linePosition) ? front.linePosition : 50,
        0,
        100
    );

    // Migrate old fronts without zones
    let zones = front.zones;
    if (!zones || typeof zones !== 'object' || Object.keys(zones).length === 0) {
        zones = {};
        for (const zone of FRONT_ZONES) {
            zones[zone.id] = {
                resourceNodes: [],
                infrastructure: [],
                reached: zone.id === 2 || zone.id === 3,
                cleared: false,
            };
        }
        if (Array.isArray(front.resourceNodes)) {
            for (const node of front.resourceNodes) {
                const targetZoneId = node.owner === front.defenderId ? 2 : 3;
                zones[targetZoneId].resourceNodes.push(node);
            }
        }
        if (Array.isArray(front.infrastructure)) {
            for (const infra of front.infrastructure) {
                const targetZoneId = infra.owner === front.defenderId ? 2 : 3;
                zones[targetZoneId].infrastructure.push(infra);
            }
        }
    }

    const normalizedWarScoreBreakdown = buildWarScoreBreakdown(front.warScoreBreakdown, {});
    const normalizedWarScore = getWarScoreBreakdownTotal(normalizedWarScoreBreakdown);
    const hasBreakdownScore = normalizedWarScore !== 0
        || Object.values(front.warScoreBreakdown || {}).some((value) => Number(value || 0) !== 0);

    return {
        ...front,
        _normalized: true,
        startDay: Number.isFinite(front.startDay) ? front.startDay : (front.createdDay || 0),
        linePosition: normalizedPosition,
        lineVelocity: Number.isFinite(front.lineVelocity) ? front.lineVelocity : 0,
        phase: front.phase || deriveFrontPhase(normalizedPosition),
        controlLog: Array.isArray(front.controlLog) ? front.controlLog.slice(-12) : [],
        frictionLog: Array.isArray(front.frictionLog) ? front.frictionLog.slice(-10) : [],
        posture: normalizePostureId(front.posture),
        aiPosture: normalizePostureId(front.aiPosture || 'balanced'),
        postures: {
            attacker: normalizePostureId(front.postures?.attacker || (front.attackerId === 'player' ? front.posture : front.aiPosture)),
            defender: normalizePostureId(front.postures?.defender || (front.defenderId === 'player' ? front.posture : front.aiPosture)),
        },
        pressure: Number.isFinite(front.pressure) ? front.pressure : 50,
        supplyState: front.supplyState || {
            attacker: '稳定',
            defender: '稳定',
            player: '稳定',
            playerRatio: 1,
            playerNeed: { resources: {}, logisticsMultiplier: 1, food: 0, silver: 0, materiel: 0, materielResource: 'wood' },
        },
        sideState: {
            attacker: { ...buildEmptySideState(front.epoch || 0), ...(front.sideState?.attacker || {}) },
            defender: { ...buildEmptySideState(front.epoch || 0), ...(front.sideState?.defender || {}) },
        },
        raidIntensity: Number.isFinite(front.raidIntensity) ? front.raidIntensity : 0,
        entrenchment: front.entrenchment || { attacker: 25, defender: 25 },
        contestedZone: front.contestedZone || '边境接触',
        lastResolvedFactors: Array.isArray(front.lastResolvedFactors) ? front.lastResolvedFactors.slice(-8) : [],
        frontDailySummary: Array.isArray(front.frontDailySummary) ? front.frontDailySummary.slice(-30) : [],
        warScore: hasBreakdownScore ? normalizedWarScore : Number(front.warScore || 0),
        warScoreBreakdown: normalizedWarScoreBreakdown,
        lastOccupationScoreDay: Number.isFinite(front.lastOccupationScoreDay) ? front.lastOccupationScoreDay : (front.startDay || 0),
        lastWarEconomyDamageDay: Number.isFinite(front.lastWarEconomyDamageDay) ? front.lastWarEconomyDamageDay : (front.startDay || 0),
        activeBattleId: front.activeBattleId || null,
        activeBattleType: front.activeBattleType || null,
        lastBattleEndDay: Number.isFinite(front.lastBattleEndDay) ? front.lastBattleEndDay : 0,
        recentBattleReports: Array.isArray(front.recentBattleReports) ? front.recentBattleReports.slice(-6) : [],
        economicDamageBreakdown: {
            supplyLineDamage: Number(front.economicDamageBreakdown?.supplyLineDamage || 0),
            productionLoss: Number(front.economicDamageBreakdown?.productionLoss || 0),
            infrastructureLoss: Number(front.economicDamageBreakdown?.infrastructureLoss || 0),
            civilianPressure: Number(front.economicDamageBreakdown?.civilianPressure || 0),
        },
        _lastAdvanceDay: Number.isFinite(front._lastAdvanceDay) ? front._lastAdvanceDay : 0,
        frontlineCorpsOrder: {
            attacker: Array.isArray(front.frontlineCorpsOrder?.attacker) ? front.frontlineCorpsOrder.attacker : [],
            defender: Array.isArray(front.frontlineCorpsOrder?.defender) ? front.frontlineCorpsOrder.defender : [],
        },
        frontPlans: front.frontPlans || {},
        sideResources: {
            attacker: front.sideResources?.attacker || {},
            defender: front.sideResources?.defender || {},
        },
        zones,
        destroyedBuildings: front.destroyedBuildings || {},
    };
};

// [已删除] _generateResourceNodes / _generateInfrastructure 旧版全局资源生成
// 功能已完全迁移至 generateZoneResources / generateZoneInfrastructure（zone-based）

// ========== Front Operations ==========

/**
 * Assign a corps to a front
 * @param {Object} front - The front to assign to
 * @param {string} corpsId - The corps ID
 * @param {string} side - 'attacker' or 'defender'
 * @returns {Object} Updated front
 */
export const assignCorpsToFront = (front, corpsId, side) => {
    const newFront = {
        ...front,
        assignedCorps: {
            ...front.assignedCorps,
            [side]: [...(front.assignedCorps[side] || [])],
        },
    };

    if (!newFront.assignedCorps[side].includes(corpsId)) {
        newFront.assignedCorps[side].push(corpsId);
    }

    return newFront;
};

/**
 * Remove a corps from a front
 */
export const removeCorpsFromFront = (front, corpsId, side) => {
    return {
        ...front,
        assignedCorps: {
            ...front.assignedCorps,
            [side]: (front.assignedCorps[side] || []).filter(id => id !== corpsId),
        },
    };
};

/**
 * Plunder a resource node (winning side takes resources)
 * @param {Object} front - The front
 * @param {string} nodeId - The resource node ID
 * @param {string} plunderer - The plundering side ('attacker' or 'defender')
 * @param {number} plunderRate - How much to take (0-1), default 0.3
 * @returns {{ front: Object, loot: Object }} Updated front and looted resources
 */
export const plunderResourceNode = (front, nodeId, plunderer, plunderRate = 0.3) => {
    const newFront = {
        ...front,
        resourceNodes: front.resourceNodes.map(n => ({ ...n })),
        totalPlundered: {
            attacker: { ...front.totalPlundered.attacker },
            defender: { ...front.totalPlundered.defender },
        },
        destroyedBuildings: JSON.parse(JSON.stringify(front.destroyedBuildings || {})),
    };

    // Also update zone-level nodes
    const zones = {};
    for (const [zId, zData] of Object.entries(front.zones || {})) {
        zones[zId] = {
            ...zData,
            resourceNodes: (zData.resourceNodes || []).map(n => ({ ...n })),
        };
    }
    newFront.zones = zones;

    const node = newFront.resourceNodes.find(n => n.id === nodeId);
    if (!node || node.plundered || node.owner === plunderer) return { front: newFront, loot: {}, destruction: null };

    // Calculate loot
    const lootAmount = Math.floor(node.amount * Math.min(1, plunderRate));
    node.amount -= lootAmount;
    if (node.amount <= 0) {
        node.plundered = true;
        node.amount = 0;
    }

    const loot = { [node.resource]: lootAmount };

    // Track cumulative plunder
    const plunderSide = newFront.totalPlundered[plunderer] || {};
    plunderSide[node.resource] = (plunderSide[node.resource] || 0) + lootAmount;
    newFront.totalPlundered[plunderer] = plunderSide;

    // Track building destruction if node is linked to a real building
    let destruction = null;
    if (node.plundered && node.linkedBuildingId) {
        const ownerId = node.owner;
        if (!newFront.destroyedBuildings[ownerId]) {
            newFront.destroyedBuildings[ownerId] = {};
        }
        newFront.destroyedBuildings[ownerId][node.linkedBuildingId] =
            (newFront.destroyedBuildings[ownerId][node.linkedBuildingId] || 0) + 1;
        destruction = {
            buildingId: node.linkedBuildingId,
            ownerId,
            destroyedCount: newFront.destroyedBuildings[ownerId][node.linkedBuildingId],
        };
    }

    // Sync zone-level node state
    for (const zData of Object.values(newFront.zones)) {
        const zoneNode = zData.resourceNodes.find(n => n.id === nodeId);
        if (zoneNode) {
            zoneNode.amount = node.amount;
            zoneNode.plundered = node.plundered;
        }
    }

    return { front: newFront, loot, destruction };
};

/**
 * Damage infrastructure on the front
 * @param {Object} front - The front
 * @param {string} infraId - Infrastructure ID
 * @param {number} damage - Amount of damage
 * @returns {Object} Updated front
 */
export const damageInfrastructure = (front, infraId, damage) => {
    const newFront = {
        ...front,
        infrastructure: front.infrastructure.map(i => ({ ...i })),
    };

    const infra = newFront.infrastructure.find(i => i.id === infraId);
    if (!infra || infra.destroyed) return newFront;

    infra.durability = Math.max(0, infra.durability - damage);
    if (infra.durability <= 0) {
        infra.destroyed = true;
    }

    return newFront;
};

/**
 * Calculate the economic impact of front damage on a nation
 * Returns modifiers that should be applied to the nation's economy
 * @param {Object} front - The front
 * @param {string} nationId - The nation to calculate impact for
 * @returns {Object} { productionPenalty, incomePenalty, supplyBonus }
 */

const sumMetricValues = (metric = {}) => Object.values(metric || {}).reduce((sum, value) => sum + Number(value || 0), 0);

const getSideRelativeLinePosition = (linePosition = 50, side = 'attacker') => (
    side === 'attacker' ? Number(linePosition || 50) : 100 - Number(linePosition || 50)
);

export const getBoundedHomelandPressure = (relativePosition = 50) => {
    const position = Math.max(0, Math.min(100, Number(relativePosition || 50)));
    if (position <= 8) return 100;
    if (position <= 15) return 78;
    if (position < 35) return 52;
    if (position < 50) return 24;
    if (position >= 92) return -100;
    if (position >= 85) return -78;
    if (position > 65) return -52;
    if (position > 50) return -24;
    return 0;
};

const buildTerritorialEconomyPenalty = (relativePosition = 50, ecoBreakdown = {}, silverIncome = 100) => {
    let zoneProductionPenalty = 0;
    let zoneTaxPenalty = 0;

    if (relativePosition < 50) {
        zoneProductionPenalty += 0.08;
        zoneTaxPenalty += 0.10;
    }
    if (relativePosition < 35) {
        zoneProductionPenalty += 0.12;
        zoneTaxPenalty += 0.18;
    }
    if (relativePosition < 15) {
        zoneProductionPenalty += 0.16;
        zoneTaxPenalty += 0.24;
    }
    if (relativePosition <= 8) {
        zoneProductionPenalty += 0.22;
        zoneTaxPenalty += 0.32;
    }

    const raidProductionPenalty = Math.min(0.25, Math.max(0, Number(ecoBreakdown.productionLoss || 0)) / 80);
    const civilianProductionPenalty = Math.min(0.20, Math.max(0, Number(ecoBreakdown.civilianPressure || 0)) / 180);
    const supplyLineTaxPenalty = Math.min(0.18, Math.max(0, Number(ecoBreakdown.supplyLineDamage || 0)) / 120);
    const civilianTaxPenalty = Math.min(0.35, Math.max(0, Number(ecoBreakdown.civilianPressure || 0)) / 90);
    const totalTaxEfficiencyPenalty = Math.min(0.85, zoneTaxPenalty + supplyLineTaxPenalty + civilianTaxPenalty);

    return {
        zoneProductionPenalty,
        raidProductionPenalty,
        civilianProductionPenalty,
        zoneTaxPenalty,
        supplyLineTaxPenalty,
        civilianTaxPenalty,
        totalTaxEfficiencyPenalty,
        incomePenaltyFromTax: silverIncome * totalTaxEfficiencyPenalty,
        infrastructureIncomePenalty: Math.max(0, Number(ecoBreakdown.infrastructureLoss || 0)),
    };
};

export const calculateFrontEconomicImpact = (front, nationId, options = {}) => {
    const normalizedFront = ensureFrontDefaults(front);
    const silverIncome = Math.max(0, Number(options.silverIncome || 0));
    let nodeProductionPenalty = 0;
    let destroyedInfraIncomePenalty = 0;
    let supplyBonus = 0;
    let defenseBonus = 0;

    const ownNodes = (normalizedFront.resourceNodes || []).filter((node) => node.owner === nationId);
    const totalPlundered = ownNodes.filter((node) => node.plundered).length;
    const totalNodes = ownNodes.length;
    if (totalNodes > 0) {
        nodeProductionPenalty = (totalPlundered / totalNodes) * 0.15;
    }

    const ownInfra = (normalizedFront.infrastructure || []).filter((infra) => infra.owner === nationId);
    for (const infra of ownInfra) {
        if (infra.destroyed) {
            if (infra.effect.income) destroyedInfraIncomePenalty += infra.effect.income;
        } else {
            const healthRatio = infra.durability / infra.maxDurability;
            if (infra.effect.supply) supplyBonus += infra.effect.supply * healthRatio;
            if (infra.effect.defense) defenseBonus += infra.effect.defense * healthRatio;
        }
    }

    const side = nationId === normalizedFront.attackerId
        ? 'attacker'
        : nationId === normalizedFront.defenderId
            ? 'defender'
            : null;
    const enemySide = side === 'attacker' ? 'defender' : 'attacker';
    const enemyNationId = side === 'attacker' ? normalizedFront.defenderId : normalizedFront.attackerId;
    const relativePosition = side ? getSideRelativeLinePosition(normalizedFront.linePosition, side) : 50;
    const territorialPressure = Boolean(side) && isSideUnderTerritorialPressure(normalizedFront.linePosition, side);
    const ecoBreakdown = normalizedFront.economicDamageBreakdown || {};
    const territorialPenalty = territorialPressure
        ? buildTerritorialEconomyPenalty(relativePosition, ecoBreakdown, silverIncome)
        : buildTerritorialEconomyPenalty(50, {}, silverIncome);
    const productionPenalty = Math.min(
        0.80,
        nodeProductionPenalty
            + territorialPenalty.zoneProductionPenalty
            + territorialPenalty.raidProductionPenalty
            + territorialPenalty.civilianProductionPenalty
    );
    const taxEfficiencyPenalty = territorialPressure ? territorialPenalty.totalTaxEfficiencyPenalty : 0;
    const incomePenalty = destroyedInfraIncomePenalty
        + territorialPenalty.infrastructureIncomePenalty
        + (territorialPressure ? territorialPenalty.incomePenaltyFromTax : 0);
    const sideState = side ? (normalizedFront.sideState?.[side] || buildEmptySideState(normalizedFront.epoch || 0)) : buildEmptySideState(normalizedFront.epoch || 0);

    return {
        productionPenalty,
        incomePenalty,
        taxEfficiencyPenalty,
        supplyBonus,
        defenseBonus,
        breakdown: {
            nodeProductionPenalty,
            zoneProductionPenalty: territorialPenalty.zoneProductionPenalty,
            raidProductionPenalty: territorialPenalty.raidProductionPenalty,
            civilianProductionPenalty: territorialPenalty.civilianProductionPenalty,
            destroyedInfraIncomePenalty,
            infrastructureIncomePenalty: territorialPenalty.infrastructureIncomePenalty,
            zoneTaxPenalty: territorialPenalty.zoneTaxPenalty,
            supplyLineTaxPenalty: territorialPenalty.supplyLineTaxPenalty,
            civilianTaxPenalty: territorialPenalty.civilianTaxPenalty,
        },
        territory: {
            side,
            relativePosition,
            territorialPressure,
            // Positive = homeland under invasion pressure; negative = deep into enemy territory (advantage, show as 0)
            homelandPressure: Math.max(0, getBoundedHomelandPressure(relativePosition)),
        },
        logistics: {
            supplyRatio: Number(sideState.supplyRatio || 0),
            dailySupplyNeed: sumMetricValues(sideState.supplyNeed?.resources || {}),
            dailySupplyAvailable: sumMetricValues(sideState.supplyAvailable?.resources || {}),
            dailyFoodUpkeep: Number(sideState.supplyNeed?.food || 0),
            dailySilverUpkeep: Number(sideState.supplyNeed?.silver || 0),
            dailyMaterielUpkeep: Number(sideState.supplyNeed?.materiel || 0),
            materielResource: sideState.supplyNeed?.materielResource || 'wood',
            resourceBreakdown: sideState.supplyNeed?.resources || {},
            baseResourceBreakdown: sideState.supplyNeed?.baseResources || {},
            modifierBreakdown: sideState.supplyNeed?.modifierBreakdown || {},
            logisticsMultiplier: Number(sideState.supplyNeed?.logisticsMultiplier || 1),
        },

        cumulative: {
            lootGained: side ? sumMetricValues(normalizedFront.totalPlundered?.[side] || {}) : 0,
            lootLost: side ? sumMetricValues(normalizedFront.totalPlundered?.[enemySide] || {}) : 0,
            buildingsDestroyed: enemyNationId ? sumMetricValues(normalizedFront.destroyedBuildings?.[enemyNationId] || {}) : 0,
            buildingsLost: sumMetricValues(normalizedFront.destroyedBuildings?.[nationId] || {}),
        },
    };
};

/**
 * Calculate front economic modifiers used by main simulation.
 * ?????????????????????/???????????? AI/????????????????
 * @param {Object} front
 * @param {string} nationId
 * @param {number} _currentDay - Current game day
 * @param {number} _deployedUnits - Total deployed units for this nation
 * @param {number} silverIncome - Nation's current silver income per day
 * @returns {Object}
 */
export const getFrontlineEconomicModifiers = (front, nationId, _currentDay = 0, _deployedUnits = 0, silverIncome = 100, nationResources = null) => {
    const normalizedFront = ensureFrontDefaults(front);
    const impact = calculateFrontEconomicImpact(normalizedFront, nationId, { silverIncome, nationResources });
    const side = nationId === normalizedFront.attackerId
        ? 'attacker'
        : nationId === normalizedFront.defenderId
            ? 'defender'
            : null;
    const sideState = normalizedFront.sideState?.[side] || buildEmptySideState(normalizedFront.epoch || 0);
    const derivedResources = nationResources || normalizedFront.sideResources?.[side] || (nationId === 'player' ? normalizedFront.playerResources : normalizedFront.aiResources) || {};
    const needResources = sideState.supplyNeed?.resources || {};
    const availableResources = Object.fromEntries(
        Object.keys(needResources).map((resourceKey) => [resourceKey, Number(derivedResources[resourceKey] || 0)])
    );
    const manualSupplyRatio = Object.keys(needResources).length > 0
        ? buildResourceCoverage(needResources, availableResources)
        : 1;
    const supplyRatio = Number(sideState.supplyRatio ?? manualSupplyRatio ?? 1);

    if (!side) {
        return {
            productionPenalty: impact.productionPenalty,
            incomePenalty: impact.incomePenalty,
            taxEfficiencyPenalty: impact.taxEfficiencyPenalty,
            supplyBonus: impact.supplyBonus,
            defenseBonus: impact.defenseBonus,
            frontlinePressure: 0,
            logisticsMultiplier: 1,
            supplyRatio: 1,
            supplyCrisis: false,
            breakdown: impact.breakdown,
            logistics: impact.logistics,
            cumulative: impact.cumulative,
            territory: impact.territory,
        };
    }

    const frontlinePressure = Math.max(0, (50 - impact.territory.relativePosition) / 50);

    return {
        productionPenalty: impact.productionPenalty,
        incomePenalty: impact.incomePenalty,
        taxEfficiencyPenalty: impact.taxEfficiencyPenalty,
        supplyBonus: impact.supplyBonus,
        defenseBonus: impact.defenseBonus,
        frontlinePressure,
        logisticsMultiplier: Number(sideState.supplyNeed?.logisticsMultiplier || 1),
        supplyRatio,
        supplyCrisis: supplyRatio < 0.65,
        breakdown: impact.breakdown,
        logistics: {
            ...impact.logistics,
            supplyRatio,
        },
        cumulative: impact.cumulative,
        territory: impact.territory,
    };
};


/**
 * Process automatic front effects each tick (resource regeneration, income, etc.)
 * @param {Object} front - The front
 * @returns {Object} Updated front
 */
export const processFrontTick = (front) => {
    if (front.status !== 'active') return front;

    // Slow resource regeneration for non-plundered nodes
    const newFront = {
        ...front,
        resourceNodes: front.resourceNodes.map(node => {
            if (node.plundered || node.amount >= node.maxAmount) return node;
            // Regenerate 0.5% per tick
            const regen = Math.ceil(node.maxAmount * 0.005);
            return { ...node, amount: Math.min(node.maxAmount, node.amount + regen) };
        }),
    };

    return newFront;
};

// ========== Front Friction System ==========

// Event templates for front line friction
const FRICTION_EVENT_TEMPLATES = [
    { text: '边境巡逻队遭遇敌方斥候，发生小规模交火', playerBias: 0, intensity: 1 },
    { text: '小股敌军试图渗透我方防线…被哨兵击退', playerBias: 0.3, intensity: 1 },
    { text: '我方骑兵对敌方补给线发起骚扰', playerBias: 0.5, intensity: 1.2 },
    { text: '敌方游击队袭击我方前沿哨所', playerBias: -0.3, intensity: 1.1 },
    { text: '双方前哨阵地争夺，各有伤亡', playerBias: 0, intensity: 1.3 },
    { text: '我方侦察兵探查到敌军调动，趁机伏击', playerBias: 0.4, intensity: 1.2 },
    { text: '敌方炮火零星轰击我方阵地', playerBias: -0.2, intensity: 0.8 },
    { text: '夜间交火，双方互有斥候伤亡', playerBias: 0, intensity: 0.9 },
    { text: '我方工兵破坏了敌方一处前沿工事', playerBias: 0.6, intensity: 1.4 },
    { text: '敌方派遣使者试探停战意向…被我方拒绝', playerBias: 0.1, intensity: 0.3 },
];

/**
 * Process front friction events (low-intensity continuous combat)
 * Called each tick when both sides have corps but no active battle
 * @param {Object} front - The front object
 * @param {Array} playerCorps - Player corps on this front
 * @param {Array} enemyCorps - Enemy corps on this front
 * @param {number} day - Current game day
 * @param {string} posture - Tactical posture: 'aggressive' | 'defensive' | 'passive'
 * @returns {Object|null} { events, casualties: {player, enemy}, warScoreDelta } or null if no friction
 */
export const processFrontFriction = (front, playerCorps, enemyCorps, day, posture = 'defensive') => {
    // Preconditions: both sides must have corps, no active battle
    if (!playerCorps?.length || !enemyCorps?.length) return null;
    const normalizedFront = ensureFrontDefaults(front);
    const postureCfg = getFrontPostureConfig(posture);
    const playerRaidStrength = getRoleWeightedStrength(playerCorps, 'raid');
    const enemyRaidStrength = getRoleWeightedStrength(enemyCorps, 'raid');
    const totalUnits = Math.max(1, getTotalUnitsFromCorps(playerCorps) + getTotalUnitsFromCorps(enemyCorps));

    // Frequency control based on posture and force ratio
    const baseInterval = 4; // every 4 days
    let interval = baseInterval;
    if (normalizePostureId(posture) === 'offensive') interval = Math.max(2, Math.floor(baseInterval * 0.7));
    if (normalizePostureId(posture) === 'attrition') interval = Math.floor(baseInterval * 1.35);
    if (normalizePostureId(posture) === 'raid') interval = Math.max(2, Math.floor(baseInterval * 0.75));

    // Force ratio accelerates friction: when one side overwhelms the other, skirmishes happen more often
    const playerTotal = playerCorps.reduce((s, c) => {
        return s + Object.values(c.units || {}).reduce((a, b) => a + b, 0);
    }, 0);
    const enemyTotal = enemyCorps.reduce((s, c) => {
        return s + Object.values(c.units || {}).reduce((a, b) => a + b, 0);
    }, 0);
    const largerForce = Math.max(playerTotal, enemyTotal);
    const smallerForce = Math.max(1, Math.min(playerTotal, enemyTotal));
    const forceRatio = largerForce / smallerForce;
    // 极端兵力差不会让整条战线每天都进入高强度摩擦。
    // 优势方更容易发起试探接敌，但小股守军无法无限制造接触机会。
    if (forceRatio >= 8) {
        interval = Math.max(2, Math.floor(interval * 0.75));
    } else if (forceRatio >= 3) {
        interval = Math.max(2, Math.floor(interval * 0.75));
    } else if (forceRatio >= 2) {
        interval = Math.max(2, Math.floor(interval * 0.85));
    }

    // Use front id hash + day for deterministic but varied timing
    const hash = (front.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    if ((day + hash) % interval !== 0) return null;

    // Pick a random event
    const template = FRICTION_EVENT_TEMPLATES[Math.floor(Math.random() * FRICTION_EVENT_TEMPLATES.length)];

    // 摩擦战只会动用前沿接触兵力，而不是把整条战线的总兵力都卷进来。
    // 否则超大军团会因为基数过大而在“暂无会战”时出现反直觉的巨额伤亡。
    const epoch = Math.max(0, Number(normalizedFront.epoch || 0));
    const frontlineDepth = Math.abs(Number(normalizedFront.linePosition || 50) - 50);
    const baseContactWidth = 800 + epoch * 900;
    const zoneContactBonus = frontlineDepth >= 15 ? 1.15 : 1.0;
    const postureContactBonus = normalizePostureId(posture) === 'offensive'
        ? 1.15
        : normalizePostureId(posture) === 'attrition'
            ? 0.75
            : normalizePostureId(posture) === 'raid'
                ? 0.9
                : 1.0;
    const contactWidth = Math.max(200, Math.round(baseContactWidth * zoneContactBonus * postureContactBonus));
    const weakerEngagedUnits = Math.max(1, Math.min(smallerForce, contactWidth));
    const strongerEngagedUnits = Math.max(
        1,
        Math.min(largerForce, Math.round(Math.min(contactWidth * 1.35, weakerEngagedUnits * 1.6)))
    );
    const playerEngagedUnits = playerTotal >= enemyTotal ? strongerEngagedUnits : weakerEngagedUnits;
    const enemyEngagedUnits = enemyTotal >= playerTotal ? strongerEngagedUnits : weakerEngagedUnits;

    // Force ratio casualty multiplier: overwhelming force causes much higher attrition to the weaker side
    // ratio 1:1 → ×1.0, 3:1 → ×1.6, 5:1 → ×2.0, 10:1 → ×2.5
    const dominantRatioBonusCasualty = Math.min(2.5, 1.0 + Math.pow(Math.max(0, forceRatio - 1), 0.5) * 0.55);

    const baseCasualtyRate = 0.002 + Math.random() * 0.004; // 0.2% ~ 0.6% of engaged troops
    // Apply dominant-side casualty bonus: the weaker side suffers amplified losses
    const playerCasualtyMod = playerTotal < enemyTotal ? dominantRatioBonusCasualty : 1.0;
    const enemyCasualtyMod = enemyTotal < playerTotal ? dominantRatioBonusCasualty : 1.0;
    let playerCasualties = Math.max(1, Math.floor(playerEngagedUnits * baseCasualtyRate * template.intensity * postureCfg.attritionMod * playerCasualtyMod));
    let enemyCasualties = Math.max(1, Math.floor(enemyEngagedUnits * baseCasualtyRate * template.intensity * enemyCasualtyMod));

    // Posture adjustments
    if (normalizePostureId(posture) === 'offensive') {
        playerCasualties = Math.ceil(playerCasualties * 1.2);
        enemyCasualties = Math.ceil(enemyCasualties * 1.5);
    } else if (normalizePostureId(posture) === 'attrition') {
        playerCasualties = Math.ceil(playerCasualties * 0.5);
        enemyCasualties = Math.ceil(enemyCasualties * 0.5);
    } else if (normalizePostureId(posture) === 'raid') {
        enemyCasualties = Math.ceil(enemyCasualties * 1.1);
    }

    // Player bias from event template
    if (template.playerBias > 0) {
        enemyCasualties = Math.ceil(enemyCasualties * (1 + template.playerBias));
    } else if (template.playerBias < 0) {
        playerCasualties = Math.ceil(playerCasualties * (1 + Math.abs(template.playerBias)));
    }

    // War score delta: +1~3 for player advantage, -1~3 for enemy advantage
    let warScoreDelta = 0;
    let advanceDelta = 0;
    if (enemyCasualties > playerCasualties * 1.3) warScoreDelta = 1 + Math.floor(Math.random() * 2);
    else if (playerCasualties > enemyCasualties * 1.3) warScoreDelta = -(1 + Math.floor(Math.random() * 2));
    if (enemyCasualties > playerCasualties) {
        advanceDelta = 0.4 + Math.min(1.8, (enemyCasualties - playerCasualties) / Math.max(20, enemyCasualties + playerCasualties) * 6);
    } else if (playerCasualties > enemyCasualties) {
        advanceDelta = -(0.4 + Math.min(1.8, (playerCasualties - enemyCasualties) / Math.max(20, enemyCasualties + playerCasualties) * 6));
    }

    const raidSwing = (playerRaidStrength - enemyRaidStrength) / totalUnits;
    const raidPressure = Math.max(0, raidSwing * 120 * postureCfg.raidMod);
    const enemyRaidPressure = Math.max(0, -raidSwing * 120 * postureCfg.raidMod);
    const supplyLineDamage = Math.max(0, Math.round(Math.max(raidPressure, enemyRaidPressure) * 0.08));
    const productionLoss = Math.max(0, Math.round(Math.max(raidPressure, enemyRaidPressure) * 0.05));
    const infrastructureLoss = Math.max(0, Math.round(Math.max(raidPressure, enemyRaidPressure) * 0.03));
    const civilianPressure = Math.max(0, Math.round(Math.max(0, Math.abs(normalizedFront.linePosition - 50) - 10) * 0.2));

    // Auto-plunder: when friction occurs in enemy zone, 30% chance to destroy a resource node
    let autoPlunderNodeId = null;
    const currentZone = getZoneForPosition(front.linePosition || 50);
    const pSide = getPlayerSide(front);
    // Check if current zone belongs to the enemy
    const isInEnemyZone = (pSide === 'attacker' && currentZone.ownerSide === 'defender')
        || (pSide === 'defender' && currentZone.ownerSide === 'attacker');
    if (isInEnemyZone && Math.random() < 0.3) {
        // Find an unplundered enemy resource node in current zone
        const zoneData = front.zones?.[currentZone.id];
        const targetNode = (zoneData?.resourceNodes || []).find(n => !n.plundered);
        if (targetNode) {
            autoPlunderNodeId = targetNode.id;
        }
    }

    // 战争经济：持续财富掠夺（经济区/核心区时生效）
    const playerSideHere = getPlayerSide(front);
    const enemySide = playerSideHere === 'attacker' ? 'defender' : 'attacker';
    const playerPostureFriction = getFrontPostureIdForSide(normalizedFront, playerSideHere || 'attacker');
    const playerRaidModFriction = FRONT_POSTURES[playerPostureFriction]?.raidMod || 1.0;
    const plunderResult = calculateWarPlunder({
        targetWealth: 0, // 实际wealth由调用者传入并应用
        linePosition: normalizedFront.linePosition,
        side: enemySide,
        raidMod: playerRaidModFriction,
        unitRatio: playerTotal > 0 && enemyTotal > 0 ? playerTotal / enemyTotal : (playerTotal > 0 ? 5.0 : 0.2),
    });

    return {
        events: [{ text: template.text, day }],
        casualties: {
            player: playerCasualties,
            enemy: enemyCasualties,
        },
        warScoreDelta,
        advanceDelta,
        autoPlunderNodeId,
        plunderResult, // 财富掠夺计算结果（包含比率，实际金额由调用者应用）
        factors: [
            buildFactor('边境摩擦', enemyCasualties > playerCasualties ? 0.6 : -0.6, enemyCasualties > playerCasualties ? 'positive' : enemyCasualties < playerCasualties ? 'negative' : 'neutral'),
            buildFactor('袭扰强度', raidPressure / 40, raidPressure > 0 ? 'positive' : 'neutral'),
        ],
        economicDamage: {
            supplyLineDamage,
            productionLoss,
            infrastructureLoss,
            civilianPressure,
        },
        warScoreBreakdown: {
            battle: 0,
            advance: warScoreDelta,
            economic: Math.round((raidPressure - enemyRaidPressure) / 25),
            homeland: 0,
        },
    };
};

/**
 * Process front-line advancement each tick.
 * Positive delta means attacker advances; negative means defender pushes back.
 * @param {Object} front
 * @param {Array} attackerCorps
 * @param {Array} defenderCorps
 * @param {number} day
 * @param {number} battleDelta
 * @returns {Object}
 */
export const processFrontAdvance = (front, attackerCorps = [], defenderCorps = [], day = 0, battleDelta = 0, attackerBuildings = null, defenderBuildings = null) => {
    const normalizedFront = ensureFrontDefaults(front);
    if (normalizedFront.status !== 'active') return normalizedFront;

    const attackerUnits = getTotalUnitsFromCorps(attackerCorps);
    const defenderUnits = getTotalUnitsFromCorps(defenderCorps);
    if (attackerUnits <= 0 && defenderUnits <= 0) {
        const summary = summarizeFrontState(normalizedFront, attackerCorps, defenderCorps);
        return {
            ...normalizedFront,
            lineVelocity: 0,
            pressure: summary.pressure,
            supplyState: summary.supplyState,
            sideState: summary.sideState, // [FIX] 保存 sideState
            raidIntensity: summary.raidIntensity,
            entrenchment: summary.entrenchment,
            contestedZone: summary.contestedZone,
            lastResolvedFactors: [],
            frontDailySummary: [
                ...(normalizedFront.frontDailySummary || []).slice(-29),
                {
                    day,
                    lineVelocity: 0,
                    phase: normalizedFront.phase || summary.phase,
                    contestedZone: summary.contestedZone,
                    supplyState: '未接战',
                    pressure: summary.pressure,
                    factors: [],
                },
            ],
        };
    }
    const totalUnits = Math.max(1, attackerUnits + defenderUnits);
    const ratioDelta = (attackerUnits - defenderUnits) / totalUnits;
    const summary = summarizeFrontState(normalizedFront, attackerCorps, defenderCorps);
    const factorList = [];

    let postureDelta = 0;
    const playerSide = getPlayerSide(normalizedFront);
    const attackerPosture = getFrontPostureIdForSide(normalizedFront, 'attacker');
    const defenderPosture = getFrontPostureIdForSide(normalizedFront, 'defender');
    const postureBiasMap = {
        offensive: 0.8,
        balanced: 0,
        attrition: -0.5,
        raid: -0.25,
    };
    postureDelta += (postureBiasMap[attackerPosture] || 0) * 0.35;
    postureDelta -= (postureBiasMap[defenderPosture] || 0) * 0.35;
    factorList.push(buildFactor('兵力对比', ratioDelta * 1.2, ratioDelta >= 0 ? 'positive' : 'negative'));
    if (postureDelta !== 0) {
        const playerPosture = getFrontPostureIdForSide(normalizedFront, playerSide || 'attacker');
        factorList.push(buildFactor(FRONT_POSTURES[playerPosture]?.name || '战区姿态', postureDelta, postureDelta >= 0 ? 'positive' : 'negative'));
    }

    let naturalDrift = 0;
    if (attackerUnits === 0 && defenderUnits > 0) naturalDrift = -0.45;
    if (defenderUnits === 0 && attackerUnits > 0) naturalDrift = 0.45;
    if (naturalDrift !== 0) {
        factorList.push(buildFactor('战线空虚', naturalDrift, naturalDrift >= 0 ? 'positive' : 'negative'));
    }

    const pressureDelta = ((summary.pressure || 50) - 50) / 60;
    if (pressureDelta !== 0) {
        factorList.push(buildFactor('战区压力', pressureDelta, pressureDelta >= 0 ? 'positive' : 'negative'));
    }
    const supplyPenalty = summary.supplyState?.playerRatio < 0.85
        ? -((0.85 - summary.supplyState.playerRatio) * 1.6)
        : 0;
    if (supplyPenalty !== 0) {
        factorList.push(buildFactor('补给不足', supplyPenalty, 'negative'));
    }
    const entrenchmentDelta = ((summary.entrenchment?.attacker || 25) - (summary.entrenchment?.defender || 25)) / 90;
    if (entrenchmentDelta !== 0) {
        factorList.push(buildFactor('工事对抗', entrenchmentDelta, entrenchmentDelta >= 0 ? 'positive' : 'negative'));
    }
    if (battleDelta) {
        factorList.push(buildFactor('会战结果', battleDelta, battleDelta >= 0 ? 'positive' : 'negative'));
    }

    const battleMomentum = (battleDelta || 0) * 0.35;
    const rawDelta = ratioDelta * 1.2 + postureDelta + naturalDrift + pressureDelta + supplyPenalty + entrenchmentDelta + battleMomentum;
    const clampedDelta = clamp(rawDelta, -0.9, 0.9);
    const oldPosition = normalizedFront.linePosition;
    const linePosition = clamp(oldPosition + clampedDelta, FRONT_MIN_POSITION, FRONT_MAX_POSITION);
    const lineVelocity = linePosition - oldPosition;
    const oldPhase = normalizedFront.phase || deriveDetailedPhase(oldPosition, summary.pressure, summary.supplyState?.playerRatio ?? 1, summary.contestedZone);
    const phase = deriveDetailedPhase(linePosition, summary.pressure, summary.supplyState?.playerRatio ?? 1, summary.contestedZone);

    // Deep clone zones for mutation
    const zones = {};
    for (const [zId, zData] of Object.entries(normalizedFront.zones || {})) {
        zones[zId] = {
            ...zData,
            resourceNodes: [...(zData.resourceNodes || [])],
            infrastructure: [...(zData.infrastructure || [])],
        };
    }

    // Checkpoint detection: generate resources for newly reached zones
    const crossed = getCheckpointsCrossed(oldPosition, linePosition);
    const controlLog = [...(normalizedFront.controlLog || [])];

    const CHECKPOINT_NARRATIVES = {
        15: { forward: '🔥 我军突入敌方核心区！敌方经济受到致命打击！', backward: '⚠️ 敌军突入我方核心区！我方经济岌岌可危！' },
        35: { forward: '🔥 我军突破敌方前沿，进入经济区！', backward: '⚠️ 敌军突入我方经济区！' },
        50: { forward: '⚔️ 我军越过中线，进入敌方领地！', backward: '⚠️ 敌军越过中线，进入我方领地！' },
        65: { forward: '📢 我军推进到前沿阵地', backward: '📢 敌军被击退至前沿地带' },
        85: { forward: '📢 战线推进到攻方经济区', backward: '🔥 敌军被击退到核心区边缘！' },
    };

    for (const { checkpoint, direction } of crossed) {
        const narrative = CHECKPOINT_NARRATIVES[checkpoint];
        if (narrative) {
            controlLog.push({
                day,
                phase,
                delta: Number(lineVelocity.toFixed(2)),
                text: narrative[direction] || `战线跨越 ${checkpoint}% 关键节点`,
                isCheckpoint: true,
                checkpoint,
            });
        }

        // Determine which zone was newly entered
        // For forward (attacker advancing, pos increasing), new zone is to the right of checkpoint
        // For backward (defender pushing, pos decreasing), new zone is to the left
        for (const zone of FRONT_ZONES) {
            if (direction === 'forward' && zone.start === checkpoint && zones[zone.id] && !zones[zone.id].reached) {
                zones[zone.id].reached = true;
                // Generate resources from the zone owner's buildings
                const zoneOwnerId = zone.ownerSide === 'attacker' ? normalizedFront.attackerId : normalizedFront.defenderId;
                const ownerBuildings = zone.ownerSide === 'attacker' ? (attackerBuildings || {}) : (defenderBuildings || {});
                zones[zone.id].resourceNodes = generateZoneResources(zone, ownerBuildings, normalizedFront.epoch || 0, zoneOwnerId);
                zones[zone.id].infrastructure = generateZoneInfrastructure(zone, ownerBuildings, normalizedFront.epoch || 0, zoneOwnerId);
            }
            if (direction === 'backward' && zone.end === checkpoint && zones[zone.id] && !zones[zone.id].reached) {
                zones[zone.id].reached = true;
                const zoneOwnerId = zone.ownerSide === 'attacker' ? normalizedFront.attackerId : normalizedFront.defenderId;
                const ownerBuildings = zone.ownerSide === 'attacker' ? (attackerBuildings || {}) : (defenderBuildings || {});
                zones[zone.id].resourceNodes = generateZoneResources(zone, ownerBuildings, normalizedFront.epoch || 0, zoneOwnerId);
                zones[zone.id].infrastructure = generateZoneInfrastructure(zone, ownerBuildings, normalizedFront.epoch || 0, zoneOwnerId);
            }
        }
    }

    // ========== 战争经济：checkpoint crossing 时触发建筑破坏和人口流失 ==========
    let warEconomyDamage = null;
    const destroyedBuildings = JSON.parse(JSON.stringify(normalizedFront.destroyedBuildings || {}));
    let nextWarEconomyDamageDay = Number(normalizedFront.lastWarEconomyDamageDay || normalizedFront.startDay || 0);
    const currentZone = getZoneForPosition(linePosition);
    const zoneCategory = currentZone?.category || 'frontier';
    const isAttackerAdvancing = linePosition > oldPosition;
    const victimSide = isAttackerAdvancing ? 'defender' : 'attacker';
    const victimId = victimSide === 'attacker' ? normalizedFront.attackerId : normalizedFront.defenderId;
    const isVictimPlayer = victimId === 'player';
    const victimBuildings = victimSide === 'attacker' ? (attackerBuildings || {}) : (defenderBuildings || {});
    const advancerPosture = getFrontPostureIdForSide(normalizedFront, isAttackerAdvancing ? 'attacker' : 'defender');
    const advancerRaidMod = (FRONT_POSTURES[advancerPosture]?.raidMod || 1.0);

    // 计算进攻方和防守方兵力，用于建筑破坏加速
    const advancerSide = isAttackerAdvancing ? 'attacker' : 'defender';
    const advancerCorps = advancerSide === 'attacker' ? attackerCorps : defenderCorps;
    const victimCorps = advancerSide === 'attacker' ? defenderCorps : attackerCorps;
    const advancerTotalUnits = getTotalUnitsFromCorps(advancerCorps);
    const victimTotalUnits = getTotalUnitsFromCorps(victimCorps);
    const advancerUnitRatio = victimTotalUnits > 0 ? advancerTotalUnits / victimTotalUnits : (advancerTotalUnits > 0 ? 5.0 : 1.0);

    if (crossed.length > 0) {
        // 建筑破坏判定（仅经济区和核心区触发）- 真实销毁
        if (zoneCategory === 'economic' || zoneCategory === 'capital') {
            const damageResult = calculateWarBuildingDamage({
                targetNationId: victimId,
                isPlayerNation: isVictimPlayer,
                buildings: victimBuildings,
                zoneCategory,
                raidMod: advancerRaidMod,
                existingDestroyed: destroyedBuildings[victimId] || {},
                nationWealth: isVictimPlayer ? 0 : 1000,
                nationMilitaryStrength: 0,
                enemyUnits: advancerTotalUnits,
                unitRatio: advancerUnitRatio,
            });

            // 更新 destroyedBuildings
            if (Object.keys(damageResult.destroyedBuildings).length > 0) {
                if (!destroyedBuildings[victimId]) destroyedBuildings[victimId] = {};
                for (const [bId, cnt] of Object.entries(damageResult.destroyedBuildings)) {
                    destroyedBuildings[victimId][bId] = (destroyedBuildings[victimId][bId] || 0) + cnt;
                }
            }

            warEconomyDamage = damageResult;

            if (damageResult.narrative) {
                controlLog.push({
                    day,
                    phase,
                    delta: 0,
                    text: `💥 ${damageResult.narrative}`,
                    isWarEconomy: true,
                });
            }
        }

        // 人口流失计算（返回给调用者消费）
        const popLoss = calculateWarPopulationLoss({
            population: 1000, // 占位值，由调用者传入实际人口并应用
            zoneCategory,
        });
        if (warEconomyDamage) {
            warEconomyDamage.populationLossRate = popLoss.populationLoss / 1000; // 比率
        } else {
            warEconomyDamage = { populationLossRate: popLoss.populationLoss / 1000, destroyedBuildings: {} };
        }
        warEconomyDamage.victimId = victimId;
        warEconomyDamage.zoneCategory = zoneCategory;
        nextWarEconomyDamageDay = day;
    } else if (zoneCategory === 'economic' || zoneCategory === 'capital') {
        // Sustained occupation damage interval base
        let occupationInterval = zoneCategory === 'capital' ? 3 : 5;
        const territoryOwnerSide = linePosition >= 50 ? 'defender' : 'attacker';
        const occupiedVictimId = territoryOwnerSide === 'attacker' ? normalizedFront.attackerId : normalizedFront.defenderId;
        const occupiedVictimBuildings = territoryOwnerSide === 'attacker' ? (attackerBuildings || {}) : (defenderBuildings || {});
        const occupiedVictimIsPlayer = occupiedVictimId === 'player';
        const occupiedAdvancerSide = territoryOwnerSide === 'attacker' ? 'defender' : 'attacker';
        const occupiedRaidMod = FRONT_POSTURES[getFrontPostureIdForSide(normalizedFront, occupiedAdvancerSide)]?.raidMod || 1.0;

        // 持续占领时也计算兵力比
        const occupiedAdvancerCorps = occupiedAdvancerSide === 'attacker' ? attackerCorps : defenderCorps;
        const occupiedVictimCorps = occupiedAdvancerSide === 'attacker' ? defenderCorps : attackerCorps;
        const occupiedAdvancerUnits = getTotalUnitsFromCorps(occupiedAdvancerCorps);
        const occupiedVictimUnits = getTotalUnitsFromCorps(occupiedVictimCorps);
        const occupiedUnitRatio = occupiedVictimUnits > 0 ? occupiedAdvancerUnits / occupiedVictimUnits : (occupiedAdvancerUnits > 0 ? 5.0 : 1.0);

        // Force ratio shortens sustained occupation damage interval
        if (occupiedUnitRatio >= 5) occupationInterval = Math.max(1, Math.floor(occupationInterval * 0.4));
        else if (occupiedUnitRatio >= 3) occupationInterval = Math.max(1, Math.floor(occupationInterval * 0.6));
        else if (occupiedUnitRatio >= 2) occupationInterval = Math.max(1, Math.floor(occupationInterval * 0.8));

        if (day - nextWarEconomyDamageDay >= occupationInterval) {
            const sustainedDamage = calculateWarBuildingDamage({
                targetNationId: occupiedVictimId,
                isPlayerNation: occupiedVictimIsPlayer,
                buildings: occupiedVictimBuildings,
                zoneCategory,
                raidMod: occupiedRaidMod * 0.7,
                existingDestroyed: destroyedBuildings[occupiedVictimId] || {},
                nationWealth: occupiedVictimIsPlayer ? 0 : 1000,
                nationMilitaryStrength: 0,
                enemyUnits: occupiedAdvancerUnits,
                unitRatio: occupiedUnitRatio,
            });

            if (
                Object.keys(sustainedDamage.destroyedBuildings || {}).length > 0
                || sustainedDamage.wealthLoss > 0
                || sustainedDamage.milStrLoss > 0
            ) {
                if (Object.keys(sustainedDamage.destroyedBuildings || {}).length > 0) {
                    if (!destroyedBuildings[occupiedVictimId]) destroyedBuildings[occupiedVictimId] = {};
                    for (const [bId, cnt] of Object.entries(sustainedDamage.destroyedBuildings)) {
                        destroyedBuildings[occupiedVictimId][bId] = (destroyedBuildings[occupiedVictimId][bId] || 0) + cnt;
                    }
                }
                warEconomyDamage = {
                    ...sustainedDamage,
                    populationLossRate: 0,
                    victimId: occupiedVictimId,
                    zoneCategory,
                    isSustainedOccupationDamage: true,
                };
                nextWarEconomyDamageDay = day;

                if (sustainedDamage.narrative) {
                    controlLog.push({
                        day,
                        phase,
                        delta: 0,
                        text: `🏚️ ${sustainedDamage.narrative}`,
                        isWarEconomy: true,
                    });
                }
            }
        }
    }

    const status = normalizedFront.status;

    const shouldLogAdvance = crossed.length === 0 && (Math.abs(lineVelocity) >= 1.2 || oldPhase !== phase);
    if (shouldLogAdvance) {
        controlLog.push({
            day,
            phase,
            delta: Number(lineVelocity.toFixed(2)),
            text: `${getAdvanceNarrative(normalizedFront, lineVelocity)}（态势：${FRONT_PHASE_LABELS[phase] || phase}）`,
        });
    }

    const updatedFront = {
        ...normalizedFront,
        linePosition,
        lineVelocity: Number(lineVelocity.toFixed(2)),
        phase,
        status,
        zones,
        controlLog: controlLog.slice(-16),
        _lastAdvanceDay: day || normalizedFront._lastAdvanceDay,
        lastOccupationScoreDay: normalizedFront.lastOccupationScoreDay || normalizedFront.startDay || 0,
        lastWarEconomyDamageDay: nextWarEconomyDamageDay,
        pressure: summary.pressure,
        supplyState: summary.supplyState,
        sideState: summary.sideState, // [FIX] 保存 sideState 供 AI stockpile 消耗计算使用
        raidIntensity: summary.raidIntensity,
        entrenchment: summary.entrenchment,
        contestedZone: summary.contestedZone,
        destroyedBuildings,
        warEconomyDamage, // 本次advance产生的战争经济伤害，供调用者消费
        lastResolvedFactors: factorList.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5),
        frontDailySummary: [
            ...(normalizedFront.frontDailySummary || []).slice(-29),
            {
                day,
                lineVelocity: Number(lineVelocity.toFixed(2)),
                phase,
                contestedZone: summary.contestedZone,
                supplyState: summary.supplyState?.player || '稳定',
                pressure: summary.pressure,
                factors: factorList.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5),
            },
        ],
    };

    // Rebuild top-level aggregates
    return rebuildFrontAggregates(updatedFront);
};

/**
 * Determine which side the player belongs to on a front
 * @param {Object} front
 * @returns {'attacker'|'defender'|null}
 */
export const getPlayerSide = (front) => {
    if (front.attackerId === 'player') return 'attacker';
    if (front.defenderId === 'player') return 'defender';
    return null;
};

/**
 * Get the enemy side name
 * @param {'attacker'|'defender'} side
 * @returns {'attacker'|'defender'}
 */
export const getEnemySide = (side) => side === 'attacker' ? 'defender' : 'attacker';

/**
 * Cleanup a front when war ends (set to collapsed)
 * @param {Object} front
 * @returns {Object}
 */
export const collapseFront = (front) => {
    return { ...front, status: 'collapsed' };
};

// ========== Exports ==========

export { RESOURCE_NODE_TEMPLATES, INFRASTRUCTURE_TEMPLATES };

// ========== AI Enemy Corps Generation ==========

/**
 * Generate AI enemy corps for a front based on enemy nation's strength
 * @param {Object} front - The front object
 * @param {Object} enemyNation - The enemy nation object (with militaryStrength, population, etc.)
 * @param {number} epoch - Current epoch
 * @param {Function} generateNationArmy - Function to generate army composition
 * @param {Function} generateGeneral - Function to generate a general
 * @returns {Object} { enemyCorps: Array, enemyGenerals: Array } - AI corps and their generals
 */
export const generateEnemyCorpsForFront = (front, enemyNation, epoch, generateNationArmy, generateGeneral) => {
    if (!front || !enemyNation) return { enemyCorps: [], enemyGenerals: [] };

    const militaryStrength = enemyNation.militaryStrength ?? 1.0;
    // Generate 1-3 corps based on military strength
    const corpsCount = Math.max(1, Math.min(3, Math.floor(militaryStrength * 1.5 + 0.5)));

    const enemyCorps = [];
    const enemyGenerals = [];

    const corpsNames = ['先锋军', '主力军', '预备军'];

    for (let i = 0; i < corpsCount; i++) {
        const corpsId = `ai_corps_${front.id}_${Date.now()}_${i}`;
        // Each corps gets a portion of the total army
        const deploymentRatio = 1.0 / corpsCount;
        let army = generateNationArmy(enemyNation, epoch, deploymentRatio, 1.0);

        // [FIX] Validate total units > 0; fallback to epoch-appropriate basic infantry
        const armyTotal = Object.values(army).reduce((s, c) => s + (c || 0), 0);
        if (armyTotal <= 0) {
            const fallbackUnit = Object.entries(UNIT_TYPES || {})
                .filter(([, u]) => u.epoch <= epoch && u.category === 'infantry')
                .sort((a, b) => b[1].epoch - a[1].epoch)[0];
            const fallbackId = fallbackUnit ? fallbackUnit[0] : 'militia';
            const MIN_FALLBACK = Math.max(10, Math.floor((enemyNation?.population || 100) * 0.001));
            army = { [fallbackId]: MIN_FALLBACK };
            console.warn(`[frontSystem] AI corps for ${enemyNation?.name} had 0 units, fallback to ${fallbackId} x${MIN_FALLBACK}`);
        }

        // Generate a general for this corps
        const general = generateGeneral(epoch);
        general.id = `ai_gen_${front.id}_${Date.now()}_${i}`;
        general.assignedCorpsId = corpsId;

        const corps = {
            id: corpsId,
            name: `${enemyNation.name || '敌军'} ${corpsNames[i] || `第${i + 1}军团`}`,
            units: army,
            generalId: general.id,
            assignedFrontId: front.id,
            status: 'deployed',
            morale: 80 + Math.floor(Math.random() * 20),
            isAI: true,
            nationId: enemyNation.id,
        };

        enemyCorps.push(corps);
        enemyGenerals.push(general);
    }

    return { enemyCorps, enemyGenerals };
};
