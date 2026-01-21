/**
 * 战线系统集成模块
 * 将战线地图系统集成到现有游戏循环中
 */

import {
    generateFrontlineMap,
    processFrontlineDaily,
    createCorps,
} from './frontlineSystem.js';
import {
    processAIFrontlineDecisions,
    processAIAIWarSimplified,
    processAIWeaponProduction,
} from './aiFrontline.js';
import { calculateArmyWeaponMaintenance } from '../../config/militaryWeapons.js';

/**
 * 战线地图管理器
 * 跟踪所有进行中的战线地图
 */
class FrontlineManager {
    constructor() {
        this.activeFrontlines = new Map();  // warId -> frontlineMap
    }

    /**
     * 开始新战争，创建战线地图
     * @param {string} playerId - 玩家ID
     * @param {Object} playerState - 玩家状态
     * @param {Object} enemyNation - 敌方AI国家
     * @param {number} currentTick - 当前游戏tick
     * @returns {Object} 创建的战线地图
     */
    startWar(playerId, playerState, enemyNation, currentTick) {
        const frontlineMap = generateFrontlineMap(playerId, playerState, enemyNation, currentTick);
        this.activeFrontlines.set(frontlineMap.warId, frontlineMap);
        return frontlineMap;
    }

    /**
     * 获取与特定敌人的战线地图
     * @param {string} playerId - 玩家ID
     * @param {string} enemyId - 敌方ID
     * @returns {Object|null} 战线地图
     */
    getFrontline(playerId, enemyId) {
        for (const [warId, frontline] of this.activeFrontlines) {
            if (frontline.participants.includes(playerId) &&
                frontline.participants.includes(enemyId) &&
                frontline.active) {
                return frontline;
            }
        }
        return null;
    }

    /**
     * 获取所有活跃战线
     */
    getActiveFrontlines() {
        return Array.from(this.activeFrontlines.values()).filter(f => f.active);
    }

    /**
     * 结束战争
     * @param {string} warId - 战争ID
     * @param {Object} result - 战争结果
     */
    endWar(warId, result) {
        const frontline = this.activeFrontlines.get(warId);
        if (frontline) {
            frontline.active = false;
            frontline.endResult = result;
            frontline.endedAt = Date.now();
        }
    }

    /**
     * 清理已结束的战争
     */
    cleanup() {
        for (const [warId, frontline] of this.activeFrontlines) {
            if (!frontline.active && frontline.endedAt &&
                (Date.now() - frontline.endedAt) > 7 * 24 * 60 * 60 * 1000) {
                this.activeFrontlines.delete(warId);
            }
        }
    }
}

// 全局战线管理器实例
export const frontlineManager = new FrontlineManager();

/**
 * 处理玩家战争的每日更新
 * @param {Object} params - 参数
 * @returns {Object} 处理结果
 */
export function processPlayerWarDaily({
    playerId,
    playerState,
    enemyNation,
    gameState,
    tick,
    logs = [],
}) {
    const result = {
        logs: [],
        warScore: 0,
        resourceChanges: {},
        casualties: 0,
    };

    // 获取或创建战线地图
    let frontline = frontlineManager.getFrontline(playerId, enemyNation.id);

    if (!frontline && enemyNation.isAtWar) {
        // 战争刚开始，创建战线地图
        frontline = frontlineManager.startWar(playerId, playerState, enemyNation, tick);
        result.logs.push({
            type: 'frontline_created',
            warId: frontline.warId,
            scale: frontline.scaleName,
            width: frontline.width,
            height: frontline.height,
        });
    }

    if (!frontline || !frontline.active) {
        return result;
    }

    // 处理战线每日更新
    const dailyLogs = processFrontlineDaily(frontline, gameState);
    result.logs.push(...dailyLogs);

    // 处理AI战线决策
    const aiLogs = processAIFrontlineDecisions(frontline, enemyNation, gameState);
    result.logs.push(...aiLogs);

    // 更新战争分数
    result.warScore = frontline.warScore;

    // 检查战争结束
    const warEndLog = dailyLogs.find(log => log.type === 'war_end');
    if (warEndLog) {
        frontlineManager.endWar(frontline.warId, warEndLog);
        result.warEnded = true;
        result.warResult = warEndLog;
    }

    return result;
}

/**
 * 处理AI-AI战争的简化模拟
 * @param {Array} nations - 所有国家
 * @param {number} tick - 当前游戏tick
 * @returns {Array} 战争日志
 */
export function processAIAIWarsDaily(nations, tick) {
    const logs = [];

    // 找到所有AI-AI战争
    const warringPairs = new Set();

    nations.forEach(nation => {
        if (nation.aiWarWith && Array.isArray(nation.aiWarWith)) {
            nation.aiWarWith.forEach(enemyId => {
                const key = [nation.id, enemyId].sort().join('_vs_');
                if (!warringPairs.has(key)) {
                    warringPairs.add(key);

                    const enemy = nations.find(n => n.id === enemyId);
                    if (enemy) {
                        const battleResult = processAIAIWarSimplified(nation, enemy, tick);
                        logs.push({
                            type: 'ai_ai_battle',
                            ...battleResult,
                        });
                    }
                }
            });
        }

        // 处理AI武器产能恢复
        processAIWeaponProduction(nation, tick);
    });

    return logs;
}

/**
 * 计算玩家军队的武器维护成本
 * @param {Object} army - 玩家军队 { unitType: count }
 * @param {Object} resources - 玩家资源
 * @returns {Object} 消耗详情
 */
export function processWeaponMaintenance(army, resources) {
    const maintenance = calculateArmyWeaponMaintenance(army);
    const consumed = {};
    const shortages = {};

    Object.entries(maintenance).forEach(([resource, amount]) => {
        const available = resources[resource] || 0;
        if (available >= amount) {
            consumed[resource] = amount;
        } else {
            consumed[resource] = available;
            shortages[resource] = amount - available;
        }
    });

    return { consumed, shortages, totalMaintenance: maintenance };
}

/**
 * 获取战争状态摘要
 * @param {string} playerId - 玩家ID
 * @returns {Object} 战争状态摘要
 */
export function getWarStatusSummary(playerId) {
    const activeFrontlines = frontlineManager.getActiveFrontlines();
    const playerFrontlines = activeFrontlines.filter(f =>
        f.participants.includes(playerId)
    );

    return {
        activeWars: playerFrontlines.length,
        frontlines: playerFrontlines.map(f => ({
            warId: f.warId,
            enemy: f.participants.find(p => p !== playerId),
            scale: f.scaleName,
            warScore: f.warScore,
            daysSinceStart: f.daysSinceStart,
            areaControl: f.areaControl[playerId] || 0,
            corpsCount: f.corps.filter(c => c.owner === playerId).length,
            maxCorps: f.maxCorps,
        })),
    };
}

/**
 * 序列化战线数据（用于保存游戏）
 */
export function serializeFrontlineData() {
    return Array.from(frontlineManager.activeFrontlines.entries());
}

/**
 * 反序列化战线数据（用于加载游戏）
 */
export function deserializeFrontlineData(data) {
    if (!Array.isArray(data)) return;

    frontlineManager.activeFrontlines.clear();
    data.forEach(([warId, frontline]) => {
        frontlineManager.activeFrontlines.set(warId, frontline);
    });
}

export default {
    frontlineManager,
    processPlayerWarDaily,
    processAIAIWarsDaily,
    processWeaponMaintenance,
    getWarStatusSummary,
    serializeFrontlineData,
    deserializeFrontlineData,
};
