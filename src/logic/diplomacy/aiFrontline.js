/**
 * AI战线行为系统
 * 负责AI玩家在战线上的决策和AI-AI战争的简化模拟
 */

import {
    calculateNationPower,
    FRONTLINE_BUILDING_TYPES,
} from '../../config/frontlineConfig.js';
import {
    createCorps,
    calculateCorpsStrength
} from './frontlineSystem.js';
import { getPrimaryWeaponForEpoch } from '../../config/militaryWeapons.js';

/**
 * AI战术策略类型
 */
export const AI_WAR_STRATEGIES = {
    aggressive: {
        id: 'aggressive',
        name: '进攻型',
        attackWeight: 0.7,
        defendWeight: 0.2,
        retreatThreshold: 0.3,
        description: '主动寻找敌方弱点进攻'
    },
    defensive: {
        id: 'defensive',
        name: '防御型',
        attackWeight: 0.2,
        defendWeight: 0.7,
        retreatThreshold: 0.5,
        description: '优先保护己方建筑'
    },
    balanced: {
        id: 'balanced',
        name: '均衡型',
        attackWeight: 0.5,
        defendWeight: 0.4,
        retreatThreshold: 0.4,
        description: '根据兵力对比决定进攻或防守'
    },
    opportunistic: {
        id: 'opportunistic',
        name: '机会型',
        attackWeight: 0.6,
        defendWeight: 0.3,
        retreatThreshold: 0.35,
        description: '寻找有利时机出击'
    }
};

/**
 * AI在战线上的每日决策
 * @param {Object} frontlineMap - 战线地图
 * @param {Object} aiNation - AI国家对象
 * @param {Object} gameState - 游戏状态
 * @returns {Array} 执行的AI动作日志
 */
export function processAIFrontlineDecisions(frontlineMap, aiNation, gameState) {
    const logs = [];

    // 获取AI的策略
    const strategy = getAIWarStrategy(aiNation);

    // 获取AI的兵团
    const aiCorps = frontlineMap.corps.filter(c => c.owner === aiNation.id);

    // 如果没有兵团，尝试创建
    if (aiCorps.length === 0) {
        const createLog = aiCreateCorps(frontlineMap, aiNation);
        if (createLog) logs.push(createLog);
        return logs;
    }

    // 为每个兵团做决策
    aiCorps.forEach(corps => {
        // 跳过正在行动的兵团
        if (corps.state === 'moving' || corps.state === 'attacking' || corps.state === 'retreating') {
            return;
        }

        const decision = makeCorpsDecision(corps, frontlineMap, aiNation, strategy);
        if (decision) {
            logs.push(decision);
        }
    });

    return logs;
}

/**
 * 获取AI的战争策略
 */
function getAIWarStrategy(aiNation) {
    // 基于AI的特性选择策略
    const aggression = aiNation.aggression || 0.5;

    if (aggression > 0.7) return AI_WAR_STRATEGIES.aggressive;
    if (aggression < 0.3) return AI_WAR_STRATEGIES.defensive;
    if (Math.random() > 0.5) return AI_WAR_STRATEGIES.opportunistic;
    return AI_WAR_STRATEGIES.balanced;
}

/**
 * AI创建兵团
 */
function aiCreateCorps(frontlineMap, aiNation) {
    // 估算AI可用兵力
    const armySize = aiNation.armySize || aiNation.army?.total || 100;
    const epoch = aiNation.epoch || 0;

    // 创建一个默认兵团
    const units = generateAIUnits(armySize, epoch);

    // 确定起始位置（AI在右侧）
    const startX = frontlineMap.width - 2;
    const startY = Math.floor(frontlineMap.height / 2);

    const corps = {
        id: `corps_${aiNation.id}_${Date.now()}`,
        owner: aiNation.id,
        name: `${aiNation.name || 'AI'}军团`,
        position: { x: startX, y: startY },
        targetPosition: null,
        units,
        state: 'idle',
        morale: 100,
        supplies: 100,
        pendingCommand: null,
        battleHistory: [],
    };

    frontlineMap.corps.push(corps);

    return {
        type: 'ai_corps_created',
        corpsId: corps.id,
        corpsName: corps.name,
        strength: calculateCorpsStrength(corps),
    };
}

/**
 * 生成AI单位组成
 */
function generateAIUnits(armySize, epoch) {
    const units = {};

    // 根据时代选择单位类型
    const unitTypes = getAIUnitTypesForEpoch(epoch);

    // 分配兵力
    let remaining = armySize;
    unitTypes.forEach((unitType, index) => {
        const allocation = index === unitTypes.length - 1
            ? remaining
            : Math.floor(remaining * (0.3 + Math.random() * 0.2));

        if (allocation > 0) {
            units[unitType] = allocation;
            remaining -= allocation;
        }
    });

    return units;
}

/**
 * 根据时代获取AI可用单位类型
 */
function getAIUnitTypesForEpoch(epoch) {
    const epochUnits = {
        0: ['militia', 'slinger'],
        1: ['spearman', 'archer', 'chariot'],
        2: ['hoplite', 'composite_archer', 'light_cavalry'],
        3: ['heavy_infantry', 'crossbowman', 'knight'],
        4: ['pikeman', 'arquebus', 'cuirassier'],
        5: ['musketeer', 'dragoon', 'line_infantry'],
        6: ['rifleman', 'artillery', 'assault_infantry'],
    };

    return epochUnits[epoch] || epochUnits[0];
}

/**
 * 为兵团做决策
 */
function makeCorpsDecision(corps, frontlineMap, aiNation, strategy) {
    // 计算局部兵力对比
    const localPowerBalance = calculateLocalPowerBalance(corps, frontlineMap);

    // 检查是否需要撤退
    if (corps.morale < 30 || corps.supplies < 20 || localPowerBalance < strategy.retreatThreshold) {
        return issueAIRetreat(corps, frontlineMap);
    }

    // 根据策略决定行动
    const roll = Math.random();

    if (roll < strategy.attackWeight && localPowerBalance > 0.8) {
        // 进攻
        return issueAIAttack(corps, frontlineMap);
    } else if (roll < strategy.attackWeight + strategy.defendWeight) {
        // 防守
        return issueAIDefend(corps);
    } else {
        // 移动到有利位置
        return issueAIMove(corps, frontlineMap, strategy);
    }
}

/**
 * 计算局部兵力对比
 */
function calculateLocalPowerBalance(corps, frontlineMap) {
    const friendlyPower = calculateCorpsStrength(corps);

    // 查找附近敌方兵团
    const nearbyEnemies = frontlineMap.corps.filter(c =>
        c.owner !== corps.owner &&
        Math.abs(c.position.x - corps.position.x) <= 3 &&
        Math.abs(c.position.y - corps.position.y) <= 3
    );

    const enemyPower = nearbyEnemies.reduce((sum, c) => sum + calculateCorpsStrength(c), 0);

    if (enemyPower === 0) return 2.0;  // 没有敌人，完全优势
    return friendlyPower / (friendlyPower + enemyPower);
}

/**
 * AI下达进攻命令
 */
function issueAIAttack(corps, frontlineMap) {
    // 优先攻击敌方兵团
    const enemyCorps = findWeakestEnemyCorps(corps, frontlineMap);
    if (enemyCorps) {
        corps.targetPosition = { ...enemyCorps.position };
        corps.state = 'moving';
        corps.pendingCommand = {
            type: 'attack',
            targetId: enemyCorps.id,
        };

        return {
            type: 'ai_attack_corps',
            corpsId: corps.id,
            targetId: enemyCorps.id,
        };
    }

    // 否则攻击敌方建筑
    const enemyBuilding = findNearestEnemyBuilding(corps, frontlineMap);
    if (enemyBuilding) {
        corps.targetPosition = { ...enemyBuilding.position };
        corps.state = 'moving';
        corps.pendingCommand = {
            type: 'siege',
            targetId: enemyBuilding.id,
        };

        return {
            type: 'ai_attack_building',
            corpsId: corps.id,
            targetId: enemyBuilding.id,
        };
    }

    return null;
}

/**
 * 找到最弱的敌方兵团
 */
function findWeakestEnemyCorps(corps, frontlineMap) {
    const enemies = frontlineMap.corps.filter(c => c.owner !== corps.owner);

    if (enemies.length === 0) return null;

    return enemies.reduce((weakest, current) => {
        const weakestStrength = weakest ? calculateCorpsStrength(weakest) : Infinity;
        const currentStrength = calculateCorpsStrength(current);
        return currentStrength < weakestStrength ? current : weakest;
    }, null);
}

/**
 * 找到最近的敌方建筑
 */
function findNearestEnemyBuilding(corps, frontlineMap) {
    const enemyBuildings = frontlineMap.buildings.filter(b => b.owner !== corps.owner);

    if (enemyBuildings.length === 0) return null;

    return enemyBuildings.reduce((nearest, current) => {
        const nearestDist = nearest
            ? Math.abs(nearest.position.x - corps.position.x) + Math.abs(nearest.position.y - corps.position.y)
            : Infinity;
        const currentDist = Math.abs(current.position.x - corps.position.x) + Math.abs(current.position.y - corps.position.y);
        return currentDist < nearestDist ? current : nearest;
    }, null);
}

/**
 * AI下达防守命令
 */
function issueAIDefend(corps) {
    corps.state = 'defending';
    corps.targetPosition = null;

    return {
        type: 'ai_defend',
        corpsId: corps.id,
    };
}

/**
 * AI下达移动命令
 */
function issueAIMove(corps, frontlineMap, strategy) {
    // 找一个战略位置
    const targetPos = findStrategicPosition(corps, frontlineMap, strategy);

    if (targetPos) {
        corps.targetPosition = targetPos;
        corps.state = 'moving';

        return {
            type: 'ai_move',
            corpsId: corps.id,
            targetPosition: targetPos,
        };
    }

    return null;
}

/**
 * 找到战略位置
 */
function findStrategicPosition(corps, frontlineMap, strategy) {
    // 防守型：靠近己方建筑
    if (strategy.id === 'defensive') {
        const ownBuilding = frontlineMap.buildings.find(b => b.owner === corps.owner);
        if (ownBuilding) {
            return {
                x: ownBuilding.position.x + (corps.owner === frontlineMap.participants[0] ? 1 : -1),
                y: ownBuilding.position.y,
            };
        }
    }

    // 进攻型：向中央推进
    const centerX = Math.floor(frontlineMap.width / 2);
    const isLeftSide = corps.owner === frontlineMap.participants[0];

    return {
        x: isLeftSide ? Math.min(corps.position.x + 2, centerX + 2) : Math.max(corps.position.x - 2, centerX - 2),
        y: corps.position.y + (Math.random() > 0.5 ? 1 : -1),
    };
}

/**
 * AI下达撤退命令
 */
function issueAIRetreat(corps, frontlineMap) {
    const isLeftSide = corps.owner === frontlineMap.participants[0];

    corps.targetPosition = {
        x: isLeftSide ? 0 : frontlineMap.width - 1,
        y: Math.floor(frontlineMap.height / 2),
    };
    corps.state = 'retreating';

    return {
        type: 'ai_retreat',
        corpsId: corps.id,
    };
}

// ==================== AI-AI 简化战争模拟 ====================

/**
 * 处理AI-AI战争（简化模拟，不生成战线地图）
 * @param {Object} nation1 - 第一个AI国家
 * @param {Object} nation2 - 第二个AI国家
 * @param {number} tick - 当前游戏tick
 * @returns {Object} 战争进展结果
 */
export function processAIAIWarSimplified(nation1, nation2, tick) {
    // 计算双方综合战力
    const power1 = calculateAIMilitaryPower(nation1);
    const power2 = calculateAIMilitaryPower(nation2);

    // 每日战斗判定
    const battleRoll = Math.random();
    const powerRatio = power1 / (power1 + power2);

    let winner, loser;
    if (battleRoll < powerRatio) {
        winner = nation1;
        loser = nation2;
    } else {
        winner = nation2;
        loser = nation1;
    }

    // 计算战斗损失
    const epoch = Math.max(nation1.epoch || 0, nation2.epoch || 0);
    const [winnerLoss, loserLoss] = calculateAIBattleLosses(winner, loser, epoch);

    // 消耗武器资源
    consumeAIWeapons(winner, winnerLoss, epoch);
    consumeAIWeapons(loser, loserLoss, epoch);

    // 更新战争分数
    const scoreChange = calculateAIBattleScore(winnerLoss, loserLoss);

    // 更新财富和军力
    applyAIWarAttrition(winner, loser, winnerLoss, loserLoss);

    return {
        winner: winner.id,
        loser: loser.id,
        winnerLoss,
        loserLoss,
        scoreChange,
        day: tick,
    };
}

/**
 * 计算AI军事力量
 */
function calculateAIMilitaryPower(nation) {
    const baseArmy = nation.armySize || nation.army?.total || 50;
    const militaryStrength = nation.militaryStrength || 1.0;
    const epoch = nation.epoch || 0;

    return baseArmy * militaryStrength * (1 + epoch * 0.15);
}

/**
 * 计算AI战斗损失
 */
function calculateAIBattleLosses(winner, loser, epoch) {
    const baseLoss = 5 + Math.floor(Math.random() * 10);

    // 胜者损失较少
    const winnerLoss = Math.floor(baseLoss * 0.3);
    // 败者损失较多
    const loserLoss = Math.floor(baseLoss * 0.7);

    return [winnerLoss, loserLoss];
}

/**
 * AI武器消耗
 */
function consumeAIWeapons(nation, casualties, epoch) {
    // AI没有实际资源库存，用虚拟"战备度"表示
    const weaponCostPerCasualty = getWeaponCostForEpoch(epoch);
    const totalCost = casualties * weaponCostPerCasualty;

    // 减少AI的militaryStrength（作为战备度的代理指标）
    const attritionRate = totalCost / ((nation.wealth || 1000) * 0.1 + 1000);
    nation.militaryStrength = Math.max(
        0.1,
        (nation.militaryStrength || 1) * (1 - attritionRate * 0.05)
    );
}

/**
 * 根据时代获取武器消耗系数
 */
function getWeaponCostForEpoch(epoch) {
    if (epoch <= 1) return 5;   // 工具时代，消耗低
    if (epoch <= 4) return 15;  // 兵器时代，消耗中等
    return 30;                   // 枪炮时代，消耗高
}

/**
 * 计算AI战斗分数
 */
function calculateAIBattleScore(winnerLoss, loserLoss) {
    return Math.floor((loserLoss - winnerLoss) * 0.5) + 5;
}

/**
 * 应用AI战争消耗
 */
function applyAIWarAttrition(winner, loser, winnerLoss, loserLoss) {
    // 减少军队规模
    if (winner.armySize) winner.armySize = Math.max(0, winner.armySize - winnerLoss);
    if (loser.armySize) loser.armySize = Math.max(0, loser.armySize - loserLoss);

    // 减少财富
    const wealthLoss = (winnerLoss + loserLoss) * 10;
    if (winner.wealth) winner.wealth = Math.max(0, winner.wealth - wealthLoss * 0.3);
    if (loser.wealth) loser.wealth = Math.max(0, loser.wealth - wealthLoss * 0.7);
}

/**
 * AI武器产能恢复
 */
export function processAIWeaponProduction(nation, tick) {
    const baseRecovery = 0.002;  // 每日基础恢复0.2%

    // 经济越好恢复越快
    const wealthFactor = 1 + (nation.wealth || 0) / 10000;

    // 和平时期恢复更快
    const peaceFactor = nation.isAtWarWithPlayer ? 0.5 : 1.2;

    // 科技加成
    const techFactor = 1 + (nation.epoch || 0) * 0.1;

    const recovery = baseRecovery * wealthFactor * peaceFactor * techFactor;

    nation.militaryStrength = Math.min(
        2.0,  // 上限200%
        (nation.militaryStrength || 1) + recovery
    );
}

export default {
    processAIFrontlineDecisions,
    processAIAIWarSimplified,
    processAIWeaponProduction,
    AI_WAR_STRATEGIES,
};
