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
import { UNIT_TYPES } from '../../config/militaryUnits';

let frontIdCounter = 0;

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
    contact: '接触',
    pressure: '压制',
    breakthrough: '突破',
    collapse: '崩溃',
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
        posture: 'defensive',
        zones,
        resourceNodes,
        infrastructure,
        destroyedBuildings: {}, // { nationId: { buildingId: count } }
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
 * Ensure front has all runtime fields for backward compatibility.
 * @param {Object} front
 * @returns {Object}
 */
export const ensureFrontDefaults = (front) => {
    if (!front || typeof front !== 'object') return front;
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
                reached: zone.id === 2 || zone.id === 3, // frontline zones
                cleared: false,
            };
        }
        // Migrate old resourceNodes into nearest matching zone
        if (Array.isArray(front.resourceNodes)) {
            for (const node of front.resourceNodes) {
                // Put defender-owned nodes in zone 2, attacker-owned in zone 3
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

    return {
        ...front,
        startDay: Number.isFinite(front.startDay) ? front.startDay : (front.createdDay || 0),
        linePosition: normalizedPosition,
        lineVelocity: Number.isFinite(front.lineVelocity) ? front.lineVelocity : 0,
        phase: front.phase || deriveFrontPhase(normalizedPosition),
        controlLog: Array.isArray(front.controlLog) ? front.controlLog.slice(-12) : [],
        frictionLog: Array.isArray(front.frictionLog) ? front.frictionLog.slice(-10) : [],
        posture: front.posture || 'defensive',
        _lastAdvanceDay: Number.isFinite(front._lastAdvanceDay) ? front._lastAdvanceDay : 0,
        zones,
        destroyedBuildings: front.destroyedBuildings || {},
    };
};

/**
 * Generate resource nodes on the front, derived from actual BUILDINGS config
 * Player side: pick from owned buildings' output resources
 * AI side: simulate based on epoch/wealth if no building data
 */
const _generateResourceNodes = (epoch, attackerEco, defenderEco, attackerId, defenderId) => {
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
const _generateInfrastructure = (epoch, attackerEco, defenderEco, attackerId, defenderId) => {
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
export const calculateFrontEconomicImpact = (front, nationId) => {
    const normalizedFront = ensureFrontDefaults(front);
    let productionPenalty = 0;
    let incomePenalty = 0;
    let supplyBonus = 0;
    let defenseBonus = 0;

    // Plundered resource nodes reduce production
    const ownNodes = (normalizedFront.resourceNodes || []).filter(n => n.owner === nationId);
    const totalPlundered = ownNodes.filter(n => n.plundered).length;
    const totalNodes = ownNodes.length;
    if (totalNodes > 0) {
        productionPenalty = (totalPlundered / totalNodes) * 0.15; // Up to 15% production penalty
    }

    // Destroyed infrastructure provides penalties or removes bonuses
    const ownInfra = (normalizedFront.infrastructure || []).filter(i => i.owner === nationId);
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
 * Calculate front economic modifiers used by main simulation.
 * Three-layer economic pressure model:
 * 1. Base war upkeep (food/silver per deployed soldier)
 * 2. Zone-depth production/income penalty
 * 3. War fatigue (stability + stratum satisfaction)
 * @param {Object} front
 * @param {string} nationId
 * @param {number} currentDay - Current game day
 * @param {number} deployedUnits - Total deployed units for this nation
 * @param {number} silverIncome - Nation's current silver income per day
 * @returns {Object}
 */
export const getFrontlineEconomicModifiers = (front, nationId, currentDay = 0, deployedUnits = 0, silverIncome = 100) => {
    const normalizedFront = ensureFrontDefaults(front);
    const impact = calculateFrontEconomicImpact(normalizedFront, nationId);
    const side = nationId === normalizedFront.attackerId
        ? 'attacker'
        : nationId === normalizedFront.defenderId
            ? 'defender'
            : null;

    if (!side) {
        return {
            productionPenalty: impact.productionPenalty,
            incomePenalty: impact.incomePenalty,
            supplyBonus: impact.supplyBonus,
            defenseBonus: impact.defenseBonus,
            frontlinePressure: 0,
            militaryDemandPressure: 0,
            foodUpkeep: 0,
            silverUpkeep: 0,
            stabilityMod: 0,
            stratumMods: {},
            supplyCrisis: false,
            populationLossRate: 0,
        };
    }

    // === Layer 1: Base war upkeep ===
    const foodUpkeep = deployedUnits * 0.3;
    const silverUpkeep = deployedUnits * 0.1;

    // === Layer 2: Zone-depth penalty ===
    const linePos = normalizedFront.linePosition;
    let zoneProductionPenalty = 0;
    let zoneIncomePenalty = 0;
    let populationLossRate = 0;

    if (side === 'attacker') {
        // Attacker is hurt when defender pushes into attacker territory (linePos < 50)
        if (linePos < 50) {
            // Attacker frontier breached (35-50)
            zoneProductionPenalty += 0.05;
        }
        if (linePos < 35) {
            // Attacker economic zone breached (15-35)
            zoneProductionPenalty += 0.15;
            zoneIncomePenalty += silverIncome * 0.2;
        }
        if (linePos < 15) {
            // Attacker core breached (0-15)
            zoneProductionPenalty += 0.25;
            zoneIncomePenalty += silverIncome * 0.4;
            // Population loss: 0.5% × depth penetration factor
            const depthFactor = (15 - linePos) / 15;
            populationLossRate = 0.005 * depthFactor;
        }
    } else {
        // Defender is hurt when attacker pushes into defender territory (linePos > 50)
        if (linePos > 50) {
            zoneProductionPenalty += 0.05;
        }
        if (linePos > 65) {
            zoneProductionPenalty += 0.15;
            zoneIncomePenalty += silverIncome * 0.2;
        }
        if (linePos > 85) {
            zoneProductionPenalty += 0.25;
            zoneIncomePenalty += silverIncome * 0.4;
            const depthFactor = (linePos - 85) / 15;
            populationLossRate = 0.005 * depthFactor;
        }
    }

    // === Layer 3: War fatigue ===
    const warDuration = Math.max(0, currentDay - (normalizedFront.startDay || 0));
    const fatiguePeriods = Math.floor(warDuration / 30); // Every 30 days
    const stabilityMod = fatiguePeriods * -2; // -2 stability per 30 days
    const stratumMods = {};
    if (fatiguePeriods > 0) {
        stratumMods.soldier = fatiguePeriods * 3;    // Military likes war
        stratumMods.merchant = fatiguePeriods * -3;  // Merchants hate war
    }

    // Combined pressure
    const totalProductionPenalty = Math.min(0.5, impact.productionPenalty + zoneProductionPenalty);
    const totalIncomePenalty = impact.incomePenalty + zoneIncomePenalty;
    const frontlinePressure = side === 'attacker'
        ? Math.max(0, (50 - linePos) / 50)
        : Math.max(0, (linePos - 50) / 50);
    const phaseMultiplier = normalizedFront.phase === 'collapse'
        ? 1.25
        : normalizedFront.phase === 'breakthrough'
            ? 1.1
            : normalizedFront.phase === 'pressure'
                ? 1.0
                : 0.8;

    return {
        productionPenalty: totalProductionPenalty,
        incomePenalty: totalIncomePenalty,
        supplyBonus: impact.supplyBonus,
        defenseBonus: impact.defenseBonus,
        frontlinePressure,
        militaryDemandPressure: frontlinePressure * (0.4 + phaseMultiplier * 0.3),
        foodUpkeep,
        silverUpkeep,
        stabilityMod,
        stratumMods,
        supplyCrisis: false, // Will be set by caller if resources run out
        populationLossRate,
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
    let advanceDelta = 0;
    if (enemyCasualties > playerCasualties * 1.3) warScoreDelta = 1 + Math.floor(Math.random() * 2);
    else if (playerCasualties > enemyCasualties * 1.3) warScoreDelta = -(1 + Math.floor(Math.random() * 2));
    if (enemyCasualties > playerCasualties) {
        advanceDelta = 0.4 + Math.min(1.8, (enemyCasualties - playerCasualties) / Math.max(20, enemyCasualties + playerCasualties) * 6);
    } else if (playerCasualties > enemyCasualties) {
        advanceDelta = -(0.4 + Math.min(1.8, (playerCasualties - enemyCasualties) / Math.max(20, enemyCasualties + playerCasualties) * 6));
    }

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

    return {
        events: [{ text: template.text, day }],
        casualties: {
            player: playerCasualties,
            enemy: enemyCasualties,
        },
        warScoreDelta,
        advanceDelta,
        autoPlunderNodeId,
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
    const totalUnits = Math.max(1, attackerUnits + defenderUnits);
    const ratioDelta = (attackerUnits - defenderUnits) / totalUnits;

    let postureDelta = 0;
    const playerSide = getPlayerSide(normalizedFront);
    const posture = normalizedFront.posture || 'defensive';
    if (playerSide === 'attacker') {
        if (posture === 'aggressive') postureDelta += 0.8;
        if (posture === 'passive') postureDelta -= 0.5;
    } else if (playerSide === 'defender') {
        if (posture === 'aggressive') postureDelta -= 0.8;
        if (posture === 'passive') postureDelta += 0.5;
    }

    let naturalDrift = 0;
    if (attackerUnits === 0 && defenderUnits > 0) naturalDrift = -1.4;
    if (defenderUnits === 0 && attackerUnits > 0) naturalDrift = 1.4;

    const rawDelta = ratioDelta * 3.2 + postureDelta + naturalDrift + (battleDelta || 0);
    const clampedDelta = clamp(rawDelta, -4, 4);
    const oldPosition = normalizedFront.linePosition;
    const linePosition = clamp(oldPosition + clampedDelta, 0, 100);
    const lineVelocity = linePosition - oldPosition;
    const oldPhase = normalizedFront.phase || deriveFrontPhase(oldPosition);
    const phase = deriveFrontPhase(linePosition);

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

    // Check for collapse (linePosition reaches 0 or 100)
    let status = normalizedFront.status;
    if (linePosition <= 0 || linePosition >= 100) {
        status = 'collapsed';
        controlLog.push({
            day,
            phase: 'collapse',
            delta: Number(lineVelocity.toFixed(2)),
            text: linePosition <= 0 ? '💀 守方防线彻底崩溃！' : '💀 攻方防线彻底崩溃！',
            isCheckpoint: true,
        });
    }

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
