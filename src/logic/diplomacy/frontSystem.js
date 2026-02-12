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

let frontIdCounter = 0;

const generateFrontId = () => {
    frontIdCounter += 1;
    return `front_${Date.now()}_${frontIdCounter}`;
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

    // Generate resource nodes based on both sides' economies
    const resourceNodes = generateResourceNodes(epoch, attackerEconomy, defenderEconomy, attackerId, defenderId);

    // Generate infrastructure based on both sides' buildings
    const infrastructure = generateInfrastructure(epoch, attackerEconomy, defenderEconomy, attackerId, defenderId);

    return {
        id: frontId,
        warId: `${attackerId}_vs_${defenderId}`,
        attackerId,
        defenderId,
        status: 'active', // active | stalemate | collapsed
        createdDay: 0, // Will be set by caller
        resourceNodes,
        infrastructure,
        assignedCorps: {
            attacker: [], // corps IDs
            defender: [], // corps IDs
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
 * Generate resource nodes on the front, derived from actual BUILDINGS config
 * Player side: pick from owned buildings' output resources
 * AI side: simulate based on epoch/wealth if no building data
 */
const generateResourceNodes = (epoch, attackerEco, defenderEco, attackerId, defenderId) => {
    const nodes = [];
    let nodeId = 0;

    const sides = [
        { owner: attackerId, eco: attackerEco },
        { owner: defenderId, eco: defenderEco },
    ];

    // Helper: get primary output resource from a building's output object
    // Excludes non-resource outputs like maxPop, militaryCapacity
    const NON_RESOURCE_OUTPUTS = ['maxPop', 'militaryCapacity', 'culture', 'science'];
    const getMainResource = (output) => {
        if (!output || typeof output !== 'object') return null;
        const entries = Object.entries(output).filter(([k]) => !NON_RESOURCE_OUTPUTS.includes(k) && RESOURCES[k]);
        if (entries.length === 0) return null;
        // Pick highest output
        entries.sort((a, b) => b[1] - a[1]);
        return { resource: entries[0][0], outputRate: entries[0][1] };
    };

    for (const side of sides) {
        const buildings = side.eco?.buildings || {}; // { buildingId: count }
        const ownedEntries = Object.entries(buildings).filter(([, count]) => count > 0);

        if (ownedEntries.length > 0) {
            // Pick 2-4 buildings that have valid resource output
            const candidates = [];
            for (const [bId, count] of ownedEntries) {
                const bDef = BUILDINGS.find(b => b.id === bId);
                if (!bDef) continue;
                const main = getMainResource(bDef.output);
                if (!main) continue;
                candidates.push({ building: bDef, count, ...main });
            }

            // Shuffle and take 2-4
            const shuffled = candidates.sort(() => Math.random() - 0.5);
            const nodeCount = Math.min(4, Math.max(2, shuffled.length));

            for (let i = 0; i < nodeCount && i < shuffled.length; i++) {
                const c = shuffled[i];
                // Amount = output rate * building count * coefficient (50~100 days of production)
                const coefficient = 50 + Math.floor(Math.random() * 50);
                const amount = Math.max(10, Math.floor(c.outputRate * c.count * coefficient));

                nodeId++;
                nodes.push({
                    id: `rn_${nodeId}`,
                    type: c.building.id,
                    resource: c.resource,
                    desc: c.building.name,
                    amount,
                    maxAmount: amount,
                    owner: side.owner,
                    plundered: false,
                });
            }
        } else {
            // AI fallback: simulate buildings based on epoch/wealth
            const wealth = side.eco?.wealth || 500;
            const population = side.eco?.population || 100;
            const nodeCount = Math.min(4, Math.max(2, Math.floor((wealth / 300) + (population / 200))));
            const epochBuildings = BUILDINGS.filter(b => b.epoch <= epoch);
            // Pick random buildings that have valid resource outputs
            const validBuildings = epochBuildings.filter(b => getMainResource(b.output));
            const available = validBuildings.length > 0 ? validBuildings : [];

            if (available.length > 0) {
                for (let i = 0; i < nodeCount; i++) {
                    const bDef = available[Math.floor(Math.random() * available.length)];
                    const main = getMainResource(bDef.output);
                    if (!main) continue;
                    const amount = Math.max(10, Math.floor(main.outputRate * (2 + Math.floor(Math.random() * 5)) * (60 + Math.random() * 40)));

                    nodeId++;
                    nodes.push({
                        id: `rn_${nodeId}`,
                        type: bDef.id,
                        resource: main.resource,
                        desc: bDef.name,
                        amount,
                        maxAmount: amount,
                        owner: side.owner,
                        plundered: false,
                    });
                }
            } else {
                // Ultimate fallback to legacy templates
                for (let i = 0; i < nodeCount; i++) {
                    const template = RESOURCE_NODE_FALLBACK[Math.floor(Math.random() * RESOURCE_NODE_FALLBACK.length)];
                    const amount = Math.floor(template.baseAmount * Math.pow(template.epochScale, epoch) * (0.7 + Math.random() * 0.6));
                    nodeId++;
                    nodes.push({
                        id: `rn_${nodeId}`,
                        type: template.type,
                        resource: template.resource,
                        desc: template.desc,
                        amount,
                        maxAmount: amount,
                        owner: side.owner,
                        plundered: false,
                    });
                }
            }
        }
    }

    return nodes;
};

/**
 * Generate infrastructure on the front, derived from actual BUILDINGS by category
 * military cat → defense effect; civic cat → income effect; gather/industry → supply effect
 */
const generateInfrastructure = (epoch, attackerEco, defenderEco, attackerId, defenderId) => {
    const infra = [];
    let infraId = 0;

    // Category to effect mapping
    const CAT_EFFECT_MAP = {
        military: { defense: 0.12 },
        civic: { income: 40 },
        gather: { supply: 0.08 },
        industry: { supply: 0.1 },
    };

    const sides = [
        { owner: attackerId, eco: attackerEco },
        { owner: defenderId, eco: defenderEco },
    ];

    for (const side of sides) {
        const buildings = side.eco?.buildings || {};
        const ownedEntries = Object.entries(buildings).filter(([, count]) => count > 0);

        if (ownedEntries.length > 0) {
            // Group owned buildings by category, pick one representative per category
            const byCat = {};
            for (const [bId, count] of ownedEntries) {
                const bDef = BUILDINGS.find(b => b.id === bId);
                if (!bDef || !bDef.cat) continue;
                if (!byCat[bDef.cat]) byCat[bDef.cat] = [];
                byCat[bDef.cat].push({ building: bDef, count });
            }

            // Pick 1 representative from each category (up to 3 categories)
            const cats = Object.keys(byCat).slice(0, 3);
            for (const cat of cats) {
                const candidates = byCat[cat];
                const pick = candidates[Math.floor(Math.random() * candidates.length)];
                const bLevel = side.eco?.buildingLevels?.[pick.building.id] || 0;
                const durability = Math.floor(100 * (1 + bLevel * 0.3) * (1 + epoch * 0.15));

                infraId++;
                infra.push({
                    id: `inf_${infraId}`,
                    type: pick.building.id,
                    name: pick.building.name,
                    desc: pick.building.desc || pick.building.name,
                    owner: side.owner,
                    durability,
                    maxDurability: durability,
                    effect: { ...(CAT_EFFECT_MAP[cat] || { supply: 0.05 }) },
                    destroyed: false,
                });
            }
        } else {
            // Fallback: use legacy templates
            const buildingCount = Object.values(side.eco?.buildings || {}).reduce((s, c) => s + c, 0);
            const infraCount = Math.min(3, Math.max(1, Math.floor(Math.max(1, buildingCount) / 5)));
            const available = [...INFRASTRUCTURE_FALLBACK];
            for (let i = 0; i < infraCount; i++) {
                const idx = Math.floor(Math.random() * available.length);
                const template = available.splice(idx, 1)[0];
                if (!template) break;
                const durabilityScale = 1 + epoch * 0.15;
                const durability = Math.floor(template.baseDurability * durabilityScale);

                infraId++;
                infra.push({
                    id: `inf_${infraId}`,
                    type: template.type,
                    name: template.name,
                    desc: template.desc,
                    owner: side.owner,
                    durability,
                    maxDurability: durability,
                    effect: { ...template.effect },
                    destroyed: false,
                });
            }
        }
    }

    return infra;
};

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
    };

    const node = newFront.resourceNodes.find(n => n.id === nodeId);
    if (!node || node.plundered || node.owner === plunderer) return { front: newFront, loot: {} };

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

    return { front: newFront, loot };
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
export const calculateFrontEconomicImpact = (front, nationId) => {
    let productionPenalty = 0;
    let incomePenalty = 0;
    let supplyBonus = 0;
    let defenseBonus = 0;

    // Plundered resource nodes reduce production
    const ownNodes = (front.resourceNodes || []).filter(n => n.owner === nationId);
    const totalPlundered = ownNodes.filter(n => n.plundered).length;
    const totalNodes = ownNodes.length;
    if (totalNodes > 0) {
        productionPenalty = (totalPlundered / totalNodes) * 0.15; // Up to 15% production penalty
    }

    // Destroyed infrastructure provides penalties or removes bonuses
    const ownInfra = (front.infrastructure || []).filter(i => i.owner === nationId);
    for (const infra of ownInfra) {
        if (infra.destroyed) {
            // Destroyed infrastructure is a penalty
            if (infra.effect.income) incomePenalty += infra.effect.income;
        } else {
            // Surviving infrastructure provides bonuses
            const healthRatio = infra.durability / infra.maxDurability;
            if (infra.effect.supply) supplyBonus += infra.effect.supply * healthRatio;
            if (infra.effect.defense) defenseBonus += infra.effect.defense * healthRatio;
        }
    }

    return { productionPenalty, incomePenalty, supplyBonus, defenseBonus };
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

    // Frequency control based on posture
    const baseInterval = 4; // every 4 days
    let interval = baseInterval;
    if (posture === 'aggressive') interval = Math.max(2, Math.floor(baseInterval * 0.6));
    if (posture === 'passive') interval = Math.floor(baseInterval * 1.5);

    // Use front id hash + day for deterministic but varied timing
    const hash = (front.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    if ((day + hash) % interval !== 0) return null;

    // Pick a random event
    const template = FRICTION_EVENT_TEMPLATES[Math.floor(Math.random() * FRICTION_EVENT_TEMPLATES.length)];

    // Calculate casualties (0.1% ~ 0.5% of total units)
    const playerTotal = playerCorps.reduce((s, c) => {
        return s + Object.values(c.units || {}).reduce((a, b) => a + b, 0);
    }, 0);
    const enemyTotal = enemyCorps.reduce((s, c) => {
        return s + Object.values(c.units || {}).reduce((a, b) => a + b, 0);
    }, 0);

    const baseCasualtyRate = 0.001 + Math.random() * 0.004; // 0.1% ~ 0.5%
    let playerCasualties = Math.max(1, Math.floor(playerTotal * baseCasualtyRate * template.intensity));
    let enemyCasualties = Math.max(1, Math.floor(enemyTotal * baseCasualtyRate * template.intensity));

    // Posture adjustments
    if (posture === 'aggressive') {
        playerCasualties = Math.ceil(playerCasualties * 1.2);
        enemyCasualties = Math.ceil(enemyCasualties * 1.5);
    } else if (posture === 'passive') {
        playerCasualties = Math.ceil(playerCasualties * 0.5);
        enemyCasualties = Math.ceil(enemyCasualties * 0.5);
    }

    // Player bias from event template
    if (template.playerBias > 0) {
        enemyCasualties = Math.ceil(enemyCasualties * (1 + template.playerBias));
    } else if (template.playerBias < 0) {
        playerCasualties = Math.ceil(playerCasualties * (1 + Math.abs(template.playerBias)));
    }

    // War score delta: +1~3 for player advantage, -1~3 for enemy advantage
    let warScoreDelta = 0;
    if (enemyCasualties > playerCasualties * 1.3) warScoreDelta = 1 + Math.floor(Math.random() * 2);
    else if (playerCasualties > enemyCasualties * 1.3) warScoreDelta = -(1 + Math.floor(Math.random() * 2));

    return {
        events: [{ text: template.text, day }],
        casualties: {
            player: playerCasualties,
            enemy: enemyCasualties,
        },
        warScoreDelta,
    };
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
        const army = generateNationArmy(enemyNation, epoch, deploymentRatio, 1.0);

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
