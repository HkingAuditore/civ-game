/**
 * 兵团管理系统
 * 负责兵团的创建、命令下达、移动控制和战斗指挥
 */

import { CORPS_STATES } from '../config/frontlineConfig.js';
import {
    calculateCorpsStrength,
    calculateCorpsSpeed
} from './diplomacy/frontlineSystem.js';
import { UNIT_TYPES } from '../config/militaryUnits.js';

/**
 * 兵团命令类型
 */
export const CORPS_COMMANDS = {
    MOVE: 'move',           // 移动到目标位置
    ATTACK_CORPS: 'attack', // 攻击敌方兵团
    ATTACK_BUILDING: 'siege', // 攻击敌方建筑
    DEFEND: 'defend',       // 原地防守（防御加成）
    RETREAT: 'retreat',     // 撤退到安全位置
    REINFORCE: 'reinforce', // 从后方补充兵力
};

/**
 * 从军队中创建兵团
 * @param {Object} frontlineMap - 战线地图
 * @param {Object} playerArmy - 玩家军队 { unitType: count }
 * @param {string} corpsName - 兵团名称
 * @param {Object} unitAllocation - 分配给兵团的单位 { unitType: count }
 * @param {string} ownerId - 所有者ID
 * @returns {Object} 创建结果 { success, corps, error }
 */
export function createCorpsFromArmy(frontlineMap, playerArmy, corpsName, unitAllocation, ownerId) {
    // 验证分配的单位是否合法
    for (const [unitType, count] of Object.entries(unitAllocation)) {
        const available = playerArmy[unitType] || 0;
        if (count > available) {
            return {
                success: false,
                error: `${UNIT_TYPES[unitType]?.name || unitType}数量不足，可用: ${available}，需要: ${count}`,
            };
        }
    }

    // 检查兵团数量限制
    const existingCorps = frontlineMap.corps.filter(c => c.owner === ownerId);
    if (existingCorps.length >= frontlineMap.maxCorps) {
        return {
            success: false,
            error: `已达到兵团数量上限 (${frontlineMap.maxCorps})`,
        };
    }

    // 确定初始位置（玩家在左侧）
    const isPlayer = ownerId === frontlineMap.participants[0];
    const startX = isPlayer ? 1 : frontlineMap.width - 2;
    const startY = Math.floor(frontlineMap.height / 2);

    // 创建兵团
    const corps = {
        id: `corps_${ownerId}_${Date.now()}`,
        owner: ownerId,
        name: corpsName,
        position: { x: startX, y: startY },
        targetPosition: null,
        units: { ...unitAllocation },
        state: 'idle',
        morale: 100,
        supplies: 100,
        pendingCommand: null,
        battleHistory: [],
        createdAt: Date.now(),
    };

    frontlineMap.corps.push(corps);

    return { success: true, corps };
}

/**
 * 解散兵团，将单位返回军队
 * @param {Object} frontlineMap - 战线地图
 * @param {string} corpsId - 兵团ID
 * @returns {Object} 返回的单位 { unitType: count }
 */
export function disbandCorps(frontlineMap, corpsId) {
    const corpsIndex = frontlineMap.corps.findIndex(c => c.id === corpsId);
    if (corpsIndex === -1) {
        return null;
    }

    const corps = frontlineMap.corps[corpsIndex];
    const returnedUnits = { ...corps.units };

    frontlineMap.corps.splice(corpsIndex, 1);

    return returnedUnits;
}

/**
 * 下达移动命令
 * @param {Object} corps - 兵团对象
 * @param {Object} targetPosition - 目标位置 { x, y }
 * @param {Object} frontlineMap - 战线地图
 * @returns {Object} 命令结果
 */
export function issueMovementCommand(corps, targetPosition, frontlineMap) {
    // 验证目标位置
    if (!isValidPosition(targetPosition, frontlineMap)) {
        return { success: false, error: '目标位置无效' };
    }

    // 计算预计到达时间
    const distance = calculateDistance(corps.position, targetPosition);
    const speed = calculateCorpsSpeed(corps, frontlineMap.terrain, corps.position);
    const estimatedDays = Math.ceil(distance / speed);

    corps.targetPosition = { ...targetPosition };
    corps.state = 'moving';
    corps.pendingCommand = {
        type: CORPS_COMMANDS.MOVE,
        target: targetPosition,
        issuedAt: Date.now(),
    };

    return {
        success: true,
        estimatedDays,
        message: `${corps.name} 正在向 (${targetPosition.x}, ${targetPosition.y}) 移动，预计 ${estimatedDays} 天到达`,
    };
}

/**
 * 下达攻击命令
 * @param {Object} corps - 兵团对象
 * @param {Object} target - 攻击目标（敌方兵团或建筑）
 * @param {Object} frontlineMap - 战线地图
 * @returns {Object} 命令结果
 */
export function issueAttackCommand(corps, target, frontlineMap) {
    // 检查目标是否为敌方
    if (target.owner === corps.owner) {
        return { success: false, error: '不能攻击己方目标' };
    }

    // 确定攻击类型
    const isBuilding = target.type && !target.units;
    const commandType = isBuilding ? CORPS_COMMANDS.ATTACK_BUILDING : CORPS_COMMANDS.ATTACK_CORPS;

    // 如果是建筑，移动到相邻格；如果是敌方兵团，移动到其位置触发遭遇战
    const distance = calculateDistance(corps.position, target.position);
    if (isBuilding) {
        if (distance > 1) {
            const adjacentPos = findAdjacentPosition(target.position, frontlineMap, corps.position);
            corps.targetPosition = adjacentPos;
            corps.state = 'moving';
        } else {
            corps.state = 'attacking';
            corps.targetPosition = null;
        }
    } else {
        corps.targetPosition = { ...target.position };
        corps.state = 'moving';
    }

    corps.pendingCommand = {
        type: commandType,
        targetId: target.id,
        targetPosition: target.position,
        issuedAt: Date.now(),
    };

    return {
        success: true,
        message: `${corps.name} 正在向 ${isBuilding ? target.type : target.name} 发起攻击`,
    };
}

/**
 * 下达防守命令
 * @param {Object} corps - 兵团对象
 * @returns {Object} 命令结果
 */
export function issueDefendCommand(corps) {
    corps.state = 'defending';
    corps.targetPosition = null;
    corps.pendingCommand = {
        type: CORPS_COMMANDS.DEFEND,
        issuedAt: Date.now(),
    };

    return {
        success: true,
        message: `${corps.name} 进入防守状态，防御力 +25%`,
    };
}

/**
 * 下达撤退命令
 * @param {Object} corps - 兵团对象
 * @param {Object} frontlineMap - 战线地图
 * @returns {Object} 命令结果
 */
export function issueRetreatCommand(corps, frontlineMap) {
    // 撤退到己方起始区域
    const isPlayer = corps.owner === frontlineMap.participants[0];
    const retreatX = isPlayer ? 0 : frontlineMap.width - 1;
    const retreatY = Math.floor(frontlineMap.height / 2);

    corps.targetPosition = { x: retreatX, y: retreatY };
    corps.state = 'retreating';
    corps.pendingCommand = {
        type: CORPS_COMMANDS.RETREAT,
        issuedAt: Date.now(),
    };

    return {
        success: true,
        message: `${corps.name} 开始撤退`,
    };
}

/**
 * 补充兵团兵力
 * @param {Object} corps - 兵团对象
 * @param {Object} reinforcements - 补充的单位 { unitType: count }
 * @param {Object} playerArmy - 玩家军队
 * @returns {Object} 结果
 */
export function reinforceCorps(corps, reinforcements, playerArmy) {
    // 验证可用单位
    for (const [unitType, count] of Object.entries(reinforcements)) {
        const available = playerArmy[unitType] || 0;
        if (count > available) {
            return {
                success: false,
                error: `${UNIT_TYPES[unitType]?.name || unitType}数量不足`,
            };
        }
    }

    // 添加补充兵力
    Object.entries(reinforcements).forEach(([unitType, count]) => {
        corps.units[unitType] = (corps.units[unitType] || 0) + count;
    });

    // 补给恢复
    corps.supplies = Math.min(100, corps.supplies + 20);

    return {
        success: true,
        message: `${corps.name} 获得增援`,
    };
}

// ==================== 辅助函数 ====================

/**
 * 验证位置是否有效
 */
function isValidPosition(position, frontlineMap) {
    return (
        position.x >= 0 &&
        position.x < frontlineMap.width &&
        position.y >= 0 &&
        position.y < frontlineMap.height
    );
}

/**
 * 计算两点间距离
 */
function calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dz = pos1.y - pos2.y;
    const dy = (-pos1.x - pos1.y) - (-pos2.x - pos2.y);
    return (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) / 2;
}

/**
 * 找到目标相邻的可用位置
 */
function findAdjacentPosition(targetPos, frontlineMap, currentPos) {
    const directions = [
        { dx: 1, dy: 0 },
        { dx: 1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
    ];

    let bestPos = null;
    let bestDistance = Infinity;

    for (const { dx, dy } of directions) {
        const newPos = { x: targetPos.x + dx, y: targetPos.y + dy };

        if (isValidPosition(newPos, frontlineMap)) {
            const distance = calculateDistance(currentPos, newPos);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPos = newPos;
            }
        }
    }

    return bestPos || targetPos;
}

/**
 * 获取兵团详细信息
 * @param {Object} corps - 兵团对象
 * @returns {Object} 兵团详情
 */
export function getCorpsDetails(corps) {
    const totalUnits = Object.values(corps.units).reduce((sum, count) => sum + count, 0);

    const unitDetails = Object.entries(corps.units).map(([unitType, count]) => ({
        unitType,
        name: UNIT_TYPES[unitType]?.name || unitType,
        count,
        category: UNIT_TYPES[unitType]?.category || 'unknown',
    }));

    return {
        id: corps.id,
        name: corps.name,
        owner: corps.owner,
        position: corps.position,
        state: CORPS_STATES[corps.state] || { name: corps.state },
        totalUnits,
        unitDetails,
        morale: corps.morale,
        moraleStatus: getMoraleStatus(corps.morale),
        supplies: corps.supplies,
        supplyStatus: getSupplyStatus(corps.supplies),
        strength: calculateCorpsStrength(corps),
    };
}

/**
 * 获取士气状态描述
 */
function getMoraleStatus(morale) {
    if (morale >= 80) return { text: '高昂', color: 'green' };
    if (morale >= 50) return { text: '正常', color: 'yellow' };
    if (morale >= 25) return { text: '低落', color: 'orange' };
    return { text: '崩溃', color: 'red' };
}

/**
 * 获取补给状态描述
 */
function getSupplyStatus(supplies) {
    if (supplies >= 70) return { text: '充足', color: 'green' };
    if (supplies >= 40) return { text: '紧张', color: 'yellow' };
    if (supplies >= 20) return { text: '短缺', color: 'orange' };
    return { text: '枯竭', color: 'red' };
}

/**
 * 生成兵团名称建议
 * @param {string} ownerId - 所有者ID
 * @param {number} corpsNumber - 兵团序号
 * @returns {string} 建议的兵团名称
 */
export function suggestCorpsName(ownerId, corpsNumber) {
    const ordinals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const ordinal = ordinals[Math.min(corpsNumber - 1, ordinals.length - 1)] || corpsNumber;

    return `第${ordinal}军团`;
}

export default {
    createCorpsFromArmy,
    disbandCorps,
    issueMovementCommand,
    issueAttackCommand,
    issueDefendCommand,
    issueRetreatCommand,
    reinforceCorps,
    getCorpsDetails,
    suggestCorpsName,
    CORPS_COMMANDS,
};
