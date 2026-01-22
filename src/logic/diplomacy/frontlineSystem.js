/**
 * 战线系统核心逻辑
 * 负责战线地图的生成、状态管理和战斗处理
 */

import {
    FRONTLINE_SCALE_CONFIG,
    TERRAIN_TYPES,
    FRONTLINE_BUILDING_TYPES,
    CORPS_STATES,
    WAR_SCORE_CONFIG,
    calculateFrontlineScale,
    generateTerrainGrid,
    BUILDING_SELECTION_PRIORITY,
    PLAYER_BUILDING_TO_FRONTLINE,
} from '../../config/frontlineConfig.js';
import { BUILDINGS } from '../../config/buildings.js';
import { getBuildingLevelDistribution } from '../../utils/buildingUpgradeUtils.js';

/**
 * 生成战线地图
 * @param {string} playerId - 玩家ID
 * @param {Object} playerState - 玩家游戏状态（含建筑数据）
 * @param {Object} enemyNation - 敌方AI国家对象
 * @param {number} currentTick - 当前游戏tick
 * @returns {Object} 战线地图对象
 */
export function generateFrontlineMap(playerId, playerState, enemyNation, currentTick) {
    // 1. 计算战线规模
    const scaleConfig = calculateFrontlineScale(playerState, enemyNation);

    // 2. 生成地形网格
    const terrain = generateTerrainGrid(scaleConfig.width, scaleConfig.height);

    // 3. 选择并放置玩家建筑
    const playerBuildings = selectPlayerBuildingsForFrontline(
        playerState.buildings || [],
        playerState.buildingUpgrades || {},
        scaleConfig.playerBuildings
    );

    // 4. 生成敌方建筑
    const enemyBuildings = generateEnemyBuildings(
        enemyNation,
        scaleConfig.enemyBuildings
    );

    // 5. 在地图上放置建筑
    const buildings = [
        ...placeBuildingsOnMap(playerBuildings, playerId, 'left', terrain, scaleConfig),
        ...placeBuildingsOnMap(enemyBuildings, enemyNation.id, 'right', terrain, scaleConfig),
    ];

    // 6. 创建战线地图对象
    return {
        // 元数据
        warId: `war_${playerId}_vs_${enemyNation.id}_${currentTick}`,
        participants: [playerId, enemyNation.id],
        createdAtTick: currentTick,
        active: true,

        // 规模信息
        scale: scaleConfig.scaleId,
        scaleName: scaleConfig.name,
        width: scaleConfig.width,
        height: scaleConfig.height,
        maxCorps: scaleConfig.maxCorps,

        // 实力对比
        playerPower: scaleConfig.playerPower,
        enemyPower: scaleConfig.enemyPower,

        // 地图数据
        terrain,
        buildings,

        // 兵团列表（初始为空，需要玩家/AI创建）
        corps: [],

        // 正在进行的战斗
        activeBattles: [],

        // 战争状态
        warScore: 0,
        warExhaustion: { [playerId]: 0, [enemyNation.id]: 0 },
        daysSinceStart: 0,

        // 控制区域统计
        areaControl: {
            [playerId]: 0.5,
            [enemyNation.id]: 0.5,
        },
    };
}

/**
 * 根据玩家实际建筑情况选择战线上的建筑
 */
function selectPlayerBuildingsForFrontline(playerBuildings, buildingUpgrades, targetCount) {
    const selected = [];
    const available = normalizePlayerBuildingsForFrontline(playerBuildings, buildingUpgrades, targetCount)
        .filter(b => (b.level ?? 0) >= 0);

    // 按优先级选择
    for (const buildingId of BUILDING_SELECTION_PRIORITY) {
        if (selected.length >= targetCount) break;

        const building = available.find(b => b.id === buildingId);
        if (building) {
            const frontlineType = PLAYER_BUILDING_TO_FRONTLINE[buildingId] || 'housing';
            const typeConfig = FRONTLINE_BUILDING_TYPES[frontlineType];

            selected.push({
                sourceId: buildingId,
                type: frontlineType,
                level: building.level,
                health: typeConfig.baseHealth * (1 + building.level * 0.1),
                maxHealth: typeConfig.baseHealth * (1 + building.level * 0.1),
                resourceValue: scaleResourceValue(typeConfig.resourceValue, building.level),
                defenseValue: typeConfig.defenseValue,
            });

            // 从可用列表移除
            const idx = available.indexOf(building);
            if (idx > -1) available.splice(idx, 1);
        }
    }

    // 如果不够，随机补充
    while (selected.length < targetCount && available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        const building = available.splice(idx, 1)[0];
        const frontlineType = PLAYER_BUILDING_TO_FRONTLINE[building.id] || 'housing';
        const typeConfig = FRONTLINE_BUILDING_TYPES[frontlineType];

        selected.push({
            sourceId: building.id,
            type: frontlineType,
            level: building.level,
            health: typeConfig.baseHealth * (1 + building.level * 0.1),
            maxHealth: typeConfig.baseHealth * (1 + building.level * 0.1),
            resourceValue: scaleResourceValue(typeConfig.resourceValue, building.level),
            defenseValue: typeConfig.defenseValue,
        });
    }

    return selected;
}

/**
 * 统一玩家建筑数据结构，支持 {buildingId: count} 和数组格式
 */
function normalizePlayerBuildingsForFrontline(playerBuildings, buildingUpgrades, targetCount) {
    if (!playerBuildings) return [];

    // Already in array form
    if (Array.isArray(playerBuildings)) {
        const normalized = [];
        playerBuildings.forEach((entry) => {
            if (!entry) return;
            if (entry.id && Number.isFinite(entry.level)) {
                normalized.push({ id: entry.id, level: entry.level });
                return;
            }
            if (entry.id && Number.isFinite(entry.count)) {
                const count = Math.max(0, entry.count);
                for (let i = 0; i < count; i++) {
                    normalized.push({ id: entry.id, level: entry.level ?? 0 });
                }
            }
        });
        return normalized;
    }

    // Object map: { buildingId: count }
    if (typeof playerBuildings === 'object') {
        const normalized = [];
        const cap = Number.isFinite(targetCount) && targetCount > 0 ? targetCount : null;

        Object.entries(playerBuildings).forEach(([buildingId, countValue]) => {
            const count = Math.max(0, Number(countValue) || 0);
            if (count <= 0) return;

            const levelCounts = buildingUpgrades?.[buildingId] || {};
            const distribution = getBuildingLevelDistribution(buildingId, count, levelCounts);
            const sortedLevels = Object.keys(distribution)
                .map(level => parseInt(level, 10))
                .filter(level => Number.isFinite(level))
                .sort((a, b) => b - a);

            let remaining = cap ? Math.min(count, cap) : count;
            for (const level of sortedLevels) {
                if (remaining <= 0) break;
                const levelCount = distribution[level] || 0;
                const toAdd = Math.min(levelCount, remaining);
                for (let i = 0; i < toAdd; i++) {
                    normalized.push({ id: buildingId, level });
                }
                remaining -= toAdd;
            }

            // Fill any remainder with level 0
            for (let i = 0; i < remaining; i++) {
                normalized.push({ id: buildingId, level: 0 });
            }
        });

        return normalized;
    }

    return [];
}

/**
 * 根据敌方经济数据和时代生成建筑
 * 基于buildings.js中的实际建筑定义，按epoch过滤后选择
 */
function generateEnemyBuildings(enemyNation, targetCount) {
    const buildings = [];
    const wealth = enemyNation.wealth || 1000;
    const epoch = enemyNation.epoch || 0;

    // 从buildings.js获取该时代可用的建筑
    const availableBuildings = BUILDINGS.filter(b => b.epoch <= epoch);

    if (availableBuildings.length === 0) {
        // 如果没有可用建筑，生成基础建筑
        return generateFallbackBuildings(targetCount, wealth, epoch);
    }

    // 按类别分组并计算权重
    const categoryWeights = {
        gather: 0.30,    // 采集类（农田、矿场等）
        industry: 0.25,  // 工业类
        civic: 0.15,     // 市政类
        military: 0.20,  // 军事类
        luxury: 0.10,    // 奢侈品
    };

    // 按类别分组可用建筑
    const buildingsByCategory = {};
    availableBuildings.forEach(b => {
        const cat = b.cat || 'gather';
        if (!buildingsByCategory[cat]) {
            buildingsByCategory[cat] = [];
        }
        buildingsByCategory[cat].push(b);
    });

    // 根据财富调整建筑数量分配
    const wealthFactor = 1 + wealth / 5000;
    const epochFactor = 1 + epoch * 0.1;

    for (let i = 0; i < targetCount; i++) {
        // 按权重选择类别
        const category = weightedRandomSelect(categoryWeights, 1.0);
        const categoryBuildings = buildingsByCategory[category] || buildingsByCategory['gather'] || availableBuildings;

        if (categoryBuildings.length === 0) continue;

        // 从该类别随机选择一个建筑
        const selectedBuilding = categoryBuildings[Math.floor(Math.random() * categoryBuildings.length)];

        // 映射到战线建筑类型
        const frontlineType = PLAYER_BUILDING_TO_FRONTLINE[selectedBuilding.id] || mapCategoryToFrontlineType(category);
        const typeConfig = FRONTLINE_BUILDING_TYPES[frontlineType] || FRONTLINE_BUILDING_TYPES['housing'];

        // 计算建筑等级（基于时代和财富）
        const level = Math.max(1, Math.floor(epoch / 2) + 1 + Math.floor(Math.random() * 2));

        buildings.push({
            sourceId: selectedBuilding.id,
            sourceName: selectedBuilding.name,
            type: frontlineType,
            level: level,
            health: Math.floor(typeConfig.baseHealth * wealthFactor * epochFactor * (1 + level * 0.1)),
            maxHealth: Math.floor(typeConfig.baseHealth * wealthFactor * epochFactor * (1 + level * 0.1)),
            resourceValue: scaleResourceValue(typeConfig.resourceValue, level),
            defenseValue: Math.floor(typeConfig.defenseValue * epochFactor),
        });
    }

    return buildings;
}

/**
 * 将建筑类别映射到战线建筑类型
 */
function mapCategoryToFrontlineType(category) {
    const mapping = {
        gather: 'farm',      // 采集 -> 农田/矿场
        industry: 'workshop', // 工业 -> 工坊
        civic: 'housing',    // 市政 -> 居民区
        military: 'barracks', // 军事 -> 军营
        luxury: 'market',    // 奢侈品 -> 市场
    };
    return mapping[category] || 'housing';
}

/**
 * 备用建筑生成（当没有可用建筑定义时）
 */
function generateFallbackBuildings(targetCount, wealth, epoch) {
    const buildings = [];
    const wealthFactor = 1 + wealth / 5000;
    const epochFactor = 1 + epoch * 0.1;

    const fallbackTypes = ['farm', 'mine', 'housing', 'workshop'];

    for (let i = 0; i < targetCount; i++) {
        const type = fallbackTypes[i % fallbackTypes.length];
        const typeConfig = FRONTLINE_BUILDING_TYPES[type];

        buildings.push({
            sourceId: `fallback_${type}_${i}`,
            type,
            level: 1,
            health: Math.floor(typeConfig.baseHealth * wealthFactor * epochFactor),
            maxHealth: Math.floor(typeConfig.baseHealth * wealthFactor * epochFactor),
            resourceValue: scaleResourceValue(typeConfig.resourceValue, epoch),
            defenseValue: Math.floor(typeConfig.defenseValue * epochFactor),
        });
    }

    return buildings;
}

/**
 * 在地图上放置建筑
 */
function placeBuildingsOnMap(buildings, ownerId, side, terrain, scaleConfig) {
    const placedBuildings = [];
    const { width, height } = scaleConfig;

    // 确定放置区域
    const xStart = side === 'left' ? 0 : Math.floor(width * 0.6);
    const xEnd = side === 'left' ? Math.floor(width * 0.4) : width;

    // 已占用的位置
    const occupied = new Set();

    buildings.forEach((building, index) => {
        // 寻找合适的位置
        let position = null;
        let attempts = 0;

        while (!position && attempts < 50) {
            const x = xStart + Math.floor(Math.random() * (xEnd - xStart));
            const y = Math.floor(Math.random() * height);
            const key = `${x},${y}`;

            // 检查位置是否可用
            if (!occupied.has(key) && isValidBuildingPosition(terrain, x, y)) {
                position = { x, y };
                occupied.add(key);
            }
            attempts++;
        }

        // 如果找不到合适位置，使用备用位置
        if (!position) {
            const x = xStart + (index % (xEnd - xStart));
            const y = Math.floor(index / (xEnd - xStart)) % height;
            position = { x, y };
        }

        placedBuildings.push({
            id: `building_${ownerId}_${index}`,
            owner: ownerId,
            position,
            ...building,
        });
    });

    return placedBuildings;
}

/**
 * 检查位置是否适合放置建筑
 */
function isValidBuildingPosition(terrain, x, y) {
    if (y < 0 || y >= terrain.length || x < 0 || x >= terrain[0].length) {
        return false;
    }

    const cell = terrain[y][x];
    // 河流和沼泽不能放置建筑
    return cell !== 'river' && cell !== 'marsh';
}

/**
 * 根据权重随机选择
 */
function weightedRandomSelect(weights, totalWeight) {
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return type;
    }

    return Object.keys(weights)[0];
}

/**
 * 根据等级缩放资源价值
 */
function scaleResourceValue(baseValue, level) {
    const result = {};
    Object.entries(baseValue).forEach(([resource, amount]) => {
        result[resource] = Math.floor(amount * (1 + level * 0.2));
    });
    return result;
}

// ==================== 兵团管理 ====================

/**
 * 创建新兵团
 * @param {Object} frontlineMap - 战线地图
 * @param {string} ownerId - 所有者ID
 * @param {string} name - 兵团名称
 * @param {Object} units - 兵种组成 { unitId: count }
 * @param {Object} position - 初始位置 { x, y }
 * @returns {Object} 创建的兵团对象
 */
export function createCorps(frontlineMap, ownerId, name, units, position) {
    const corpsId = `corps_${ownerId}_${Date.now()}`;

    const corps = {
        id: corpsId,
        owner: ownerId,
        name,
        position,
        targetPosition: null,
        units,
        state: 'idle',
        morale: 100,
        supplies: 100,
        pendingCommand: null,
        battleHistory: [],
    };

    frontlineMap.corps.push(corps);
    return corps;
}

/**
 * 计算兵团总兵力
 */
export function calculateCorpsStrength(corps) {
    let total = 0;
    Object.values(corps.units).forEach(count => {
        total += count;
    });
    return total;
}

/**
 * 计算兵团移动速度
 */
export function calculateCorpsSpeed(corps, terrain, position) {
    // 获取单位最低速度（以最慢单位为准）
    let minSpeed = 1;  // 默认速度（每日一格）

    // 地形修正
    const terrainCell = terrain[position.y]?.[position.x] || 'plain';
    const terrainConfig = TERRAIN_TYPES[terrainCell];
    const terrainModifier = 1 / (terrainConfig?.movementCost || 1);

    // 补给修正
    const supplyModifier = corps.supplies > 50 ? 1.0 : 0.5;

    // 士气修正
    const moraleModifier = corps.morale > 50 ? 1.0 : 0.7;

    return Math.max(1, Math.round(minSpeed * terrainModifier * supplyModifier * moraleModifier));
}

// ==================== 每日处理 ====================

/**
 * 处理战线每日更新
 * @param {Object} frontlineMap - 战线地图
 * @param {Object} gameState - 游戏状态
 * @returns {Array} 战斗日志
 */
export function processFrontlineDaily(frontlineMap, gameState) {
    if (!frontlineMap || !frontlineMap.active) return [];

    const logs = [];

    // 1. 更新战争天数
    frontlineMap.daysSinceStart++;

    // 2. 处理所有兵团移动
    frontlineMap.corps.forEach(corps => {
        if (corps.state === 'moving' && corps.targetPosition) {
            const moveLog = processCorpsMovement(corps, frontlineMap);
            if (moveLog) logs.push(moveLog);
        }
    });

    // 3. 检测并处理遭遇战
    const encounters = detectEncounters(frontlineMap);
    encounters.forEach(encounter => {
        const battleLog = processBattleEncounter(encounter, frontlineMap, gameState);
        if (battleLog) logs.push(battleLog);
    });

    // 4. 处理建筑攻击
    frontlineMap.corps.forEach(corps => {
        if (corps.state === 'attacking') {
            const attackLog = processBuildingAttack(corps, frontlineMap);
            if (attackLog) logs.push(attackLog);
        }
    });

    // 5. 更新补给状态
    updateCorpsSupplies(frontlineMap);

    // 6. 更新区域控制
    updateAreaControl(frontlineMap);

    // 7. 更新战争疲劳
    updateWarExhaustion(frontlineMap);

    // 8. 检查战争结束条件
    const endCondition = checkWarEndConditions(frontlineMap);
    if (endCondition) {
        logs.push({ type: 'war_end', ...endCondition });
    }

    return logs;
}

/**
 * 处理兵团移动
 */
function processCorpsMovement(corps, frontlineMap) {
    if (!corps.targetPosition) return null;

    const speed = calculateCorpsSpeed(corps, frontlineMap.terrain, corps.position);
    const steps = Math.max(1, speed);
    let arrived = false;

    for (let i = 0; i < steps; i++) {
        const distance = getHexDistance(corps.position, corps.targetPosition);
        if (distance <= 0) {
            arrived = true;
            break;
        }
        const nextPos = stepTowardTarget(corps.position, corps.targetPosition, frontlineMap);
        if (!nextPos) break;
        corps.position = nextPos;
    }

    if (getHexDistance(corps.position, corps.targetPosition) <= 0) {
        corps.position = { ...corps.targetPosition };
        corps.targetPosition = null;
        if (corps.pendingCommand?.type === 'siege' || corps.pendingCommand?.type === 'attack') {
            corps.state = 'attacking';
        } else if (corps.pendingCommand?.type === 'retreat') {
            corps.state = 'idle';
        } else {
            corps.state = 'idle';
        }
        arrived = true;
    }

    if (arrived) {
        return {
            type: 'corps_arrived',
            corpsId: corps.id,
            corpsName: corps.name,
            position: corps.position,
        };
    }

    return null;
}

function getHexDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dz = pos1.y - pos2.y;
    const dy = (-pos1.x - pos1.y) - (-pos2.x - pos2.y);
    return (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / 2;
}

function getHexNeighbors(position) {
    const directions = [
        { dx: 1, dy: 0 },
        { dx: 1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
    ];
    return directions.map(dir => ({
        x: position.x + dir.dx,
        y: position.y + dir.dy,
    }));
}

function stepTowardTarget(currentPos, targetPos, frontlineMap) {
    let bestPos = null;
    let bestDistance = Infinity;
    const candidates = getHexNeighbors(currentPos);

    for (const candidate of candidates) {
        if (!isValidPosition(candidate, frontlineMap)) continue;
        const distance = getHexDistance(candidate, targetPos);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestPos = candidate;
        }
    }

    return bestPos;
}

function isValidPosition(position, frontlineMap) {
    return (
        position.x >= 0 &&
        position.x < frontlineMap.width &&
        position.y >= 0 &&
        position.y < frontlineMap.height
    );
}

/**
 * 检测遭遇战
 */
function detectEncounters(frontlineMap) {
    const encounters = [];
    const corpsByPosition = {};

    // 按位置分组
    frontlineMap.corps.forEach(corps => {
        const key = `${corps.position.x},${corps.position.y}`;
        if (!corpsByPosition[key]) {
            corpsByPosition[key] = [];
        }
        corpsByPosition[key].push(corps);
    });

    // 检查同一位置的敌对兵团
    Object.values(corpsByPosition).forEach(corpsAtPosition => {
        if (corpsAtPosition.length >= 2) {
            const owners = new Set(corpsAtPosition.map(c => c.owner));
            if (owners.size >= 2) {
                encounters.push(corpsAtPosition);
            }
        }
    });

    return encounters;
}

/**
 * 处理遭遇战
 */
function processBattleEncounter(encounterCorps, frontlineMap, gameState) {
    // 按阵营分组
    const sides = {};
    encounterCorps.forEach(corps => {
        if (!sides[corps.owner]) sides[corps.owner] = [];
        sides[corps.owner].push(corps);
    });

    const sideArray = Object.entries(sides);
    if (sideArray.length < 2) return null;

    const [attackerId, attackers] = sideArray[0];
    const [defenderId, defenders] = sideArray[1];

    // 计算双方战力
    const attackerPower = attackers.reduce((sum, c) => sum + calculateCorpsBattlePower(c), 0);
    const defenderPower = defenders.reduce((sum, c) => sum + calculateCorpsBattlePower(c), 0);

    // 战斗结果
    const powerRatio = attackerPower / (attackerPower + defenderPower);
    const attackerWins = Math.random() < powerRatio;

    // 计算损失
    const loserLossRatio = 0.2 + Math.random() * 0.2;
    const winnerLossRatio = 0.05 + Math.random() * 0.1;

    const winner = attackerWins ? attackers : defenders;
    const loser = attackerWins ? defenders : attackers;

    // 应用损失
    let winnerCasualties = 0;
    let loserCasualties = 0;

    winner.forEach(corps => {
        const casualties = applyCorpsCasualties(corps, winnerLossRatio);
        winnerCasualties += casualties;
    });

    loser.forEach(corps => {
        const casualties = applyCorpsCasualties(corps, loserLossRatio);
        loserCasualties += casualties;
        corps.state = 'retreating';
        corps.morale = Math.max(0, corps.morale - 20);
    });

    // 更新战争分数
    const scoreChange = calculateBattleWarScore(winnerCasualties, loserCasualties, attackerWins);
    frontlineMap.warScore += attackerWins ? scoreChange : -scoreChange;

    return {
        type: 'battle',
        attackerId,
        defenderId,
        winner: attackerWins ? attackerId : defenderId,
        attackerCasualties: attackerWins ? winnerCasualties : loserCasualties,
        defenderCasualties: attackerWins ? loserCasualties : winnerCasualties,
        scoreChange: attackerWins ? scoreChange : -scoreChange,
    };
}

/**
 * 计算兵团战斗力
 */
function calculateCorpsBattlePower(corps) {
    let power = 0;
    Object.entries(corps.units).forEach(([unitId, count]) => {
        // 简化计算：每个单位10点基础战力
        power += count * 10;
    });

    // 士气修正
    power *= (corps.morale / 100);

    // 补给修正
    power *= (corps.supplies > 30 ? 1.0 : 0.7);

    return power;
}

/**
 * 应用兵团伤亡
 */
function applyCorpsCasualties(corps, lossRatio) {
    let totalCasualties = 0;

    Object.keys(corps.units).forEach(unitId => {
        const casualties = Math.floor(corps.units[unitId] * lossRatio);
        corps.units[unitId] -= casualties;
        totalCasualties += casualties;

        if (corps.units[unitId] <= 0) {
            delete corps.units[unitId];
        }
    });

    return totalCasualties;
}

/**
 * 计算战斗战争分数
 */
function calculateBattleWarScore(winnerCasualties, loserCasualties, isAttacker) {
    const baseScore = WAR_SCORE_CONFIG.battleVictory.base;
    const casualtyBonus = loserCasualties * WAR_SCORE_CONFIG.battleVictory.perCasualty;

    return Math.min(
        WAR_SCORE_CONFIG.battleVictory.maxPerBattle,
        baseScore + casualtyBonus
    );
}

/**
 * 处理建筑攻击
 */
function processBuildingAttack(corps, frontlineMap) {
    // 查找相邻的敌方建筑
    const targetBuilding = frontlineMap.buildings.find(b =>
        b.owner !== corps.owner &&
        getHexDistance(b.position, corps.position) <= 1
    );

    if (!targetBuilding) {
        corps.state = 'idle';
        return null;
    }

    // 计算伤害
    const damage = calculateCorpsStrength(corps) * 0.5;
    targetBuilding.health -= damage;

    if (targetBuilding.health <= 0) {
        // 建筑被摧毁
        const typeConfig = FRONTLINE_BUILDING_TYPES[targetBuilding.type];
        const scoreGain = WAR_SCORE_CONFIG.buildingDestroyed[targetBuilding.type] || 10;

        frontlineMap.warScore += corps.owner === frontlineMap.participants[0] ? scoreGain : -scoreGain;

        // 移除建筑
        const idx = frontlineMap.buildings.indexOf(targetBuilding);
        if (idx > -1) frontlineMap.buildings.splice(idx, 1);

        corps.state = 'idle';

        return {
            type: 'building_destroyed',
            buildingId: targetBuilding.id,
            buildingType: targetBuilding.type,
            owner: targetBuilding.owner,
            attacker: corps.owner,
            loot: targetBuilding.resourceValue,
            scoreChange: scoreGain,
        };
    }

    return {
        type: 'building_damaged',
        buildingId: targetBuilding.id,
        damage,
        remainingHealth: targetBuilding.health,
    };
}

/**
 * 更新兵团补给
 */
function updateCorpsSupplies(frontlineMap) {
    frontlineMap.corps.forEach(corps => {
        // 每日消耗补给
        corps.supplies = Math.max(0, corps.supplies - 2);

        // 低补给影响士气
        if (corps.supplies < 30) {
            corps.morale = Math.max(0, corps.morale - 5);
        }
    });
}

/**
 * 更新区域控制
 */
function updateAreaControl(frontlineMap) {
    const buildingCounts = {};

    frontlineMap.buildings.forEach(b => {
        buildingCounts[b.owner] = (buildingCounts[b.owner] || 0) + 1;
    });

    const total = frontlineMap.buildings.length || 1;

    frontlineMap.participants.forEach(participant => {
        frontlineMap.areaControl[participant] = (buildingCounts[participant] || 0) / total;
    });
}

/**
 * 更新战争疲劳
 */
function updateWarExhaustion(frontlineMap) {
    frontlineMap.participants.forEach(participant => {
        frontlineMap.warExhaustion[participant] =
            (frontlineMap.warExhaustion[participant] || 0) + 0.1;
    });
}

/**
 * 检查战争结束条件
 */
function checkWarEndConditions(frontlineMap) {
    const { warScore, warExhaustion, participants, daysSinceStart } = frontlineMap;

    // 决定性胜利
    if (warScore >= WAR_SCORE_CONFIG.endConditions.decisiveVictory) {
        return { winner: participants[0], result: 'decisive_victory' };
    }
    if (warScore <= WAR_SCORE_CONFIG.endConditions.decisiveDefeat) {
        return { winner: participants[1], result: 'decisive_victory' };
    }

    // 战争疲劳强制和平
    const maxExhaustion = Math.max(...Object.values(warExhaustion));
    if (maxExhaustion >= 100) {
        return { winner: null, result: 'exhaustion_peace' };
    }

    // 超长战争
    if (daysSinceStart >= 365) {
        if (warScore > 25) return { winner: participants[0], result: 'minor_victory' };
        if (warScore < -25) return { winner: participants[1], result: 'minor_victory' };
        return { winner: null, result: 'stalemate' };
    }

    return null;
}

export default {
    generateFrontlineMap,
    createCorps,
    calculateCorpsStrength,
    calculateCorpsSpeed,
    processFrontlineDaily,
};
