// 叛乱系统逻辑处理
// 追踪阶层不满状态，触发叛乱事件

import { STRATA } from '../config/strata';
import { getOrganizationStage, getPhaseFromStage, ORGANIZATION_STAGE } from './organizationSystem';
import {
    REBELLION_PHASE,
    REBELLION_CONFIG,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebelNation,
    createRebellionEndEvent,
} from '../config/events/rebellionEvents';

/**
 * 检查阶层是否满足叛乱触发条件
 * @param {string} stratumKey - 阶层键
 * @param {number} approval - 当前好感度
 * @param {number} influenceShare - 影响力占比
 * @param {number} dissatisfactionDays - 不满天数
 * @returns {boolean} 是否满足条件
 */
export function checkRebellionCondition(stratumKey, approval, influenceShare, dissatisfactionDays) {
    // 奴隶类不参与叛乱（失业者现在可以参与叛乱）
    if (stratumKey === 'slave') {
        return false;
    }

    return (
        approval < REBELLION_CONFIG.MAX_APPROVAL_THRESHOLD &&
        influenceShare >= REBELLION_CONFIG.MIN_INFLUENCE_SHARE &&
        dissatisfactionDays >= REBELLION_CONFIG.MIN_DISSATISFACTION_DAYS
    );
}

/**
 * 更新叛乱状态
 * 每天调用，追踪各阶层的不满状态
 * @param {Object} rebellionStates - 当前叛乱状态
 * @param {Object} classApproval - 各阶层好感度
 * @param {Object} classInfluence - 各阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @returns {Object} 更新后的叛乱状态
 */
export function updateRebellionStates(rebellionStates, classApproval, classInfluence, totalInfluence) {
    const newStates = { ...rebellionStates };

    Object.keys(STRATA).forEach(stratumKey => {
        // 跳过奴隶（失业者现在可以参与叛乱）
        if (stratumKey === 'slave') {
            return;
        }

        const approval = classApproval[stratumKey] ?? 50;
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

        // 获取或初始化该阶层的叛乱状态
        const currentState = newStates[stratumKey] || {
            dissatisfactionDays: 0,
            phase: REBELLION_PHASE.NONE,
            influenceShare: 0,
            lastPhaseChange: 0,
        };

        // 更新影响力占比
        currentState.influenceShare = influenceShare;

        // 检查是否处于不满状态
        if (approval < REBELLION_CONFIG.MAX_APPROVAL_THRESHOLD) {
            currentState.dissatisfactionDays += 1;
        } else {
            // 如果好感度恢复，逐渐减少不满天数
            currentState.dissatisfactionDays = Math.max(0, currentState.dissatisfactionDays - 2);

            // 如果不满天数归零且不在叛乱状态，清除叛乱阶段
            if (currentState.dissatisfactionDays === 0 && currentState.phase !== REBELLION_PHASE.ACTIVE) {
                currentState.phase = REBELLION_PHASE.NONE;
            }
        }

        newStates[stratumKey] = currentState;
    });

    return newStates;
}

/**
 * [已废弃] 检查是否应该触发叛乱事件
 * @deprecated 此函数使用随机概率触发，已被组织度系统取代
 * 现在叛乱事件由 organizationSystem.checkOrganizationEvents() 确定性触发
 * 保留此函数以兼容可能存在的旧代码引用
 * 
 * @param {Object} rebellionStates - 叛乱状态
 * @param {Object} classApproval - 各阶层好感度
 * @param {Object} classInfluence - 各阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @returns {Object|null} 始终返回 null（不再触发随机事件）
 */
export function checkRebellionEvents(rebellionStates, classApproval, classInfluence, totalInfluence) {
    // [已废弃] 随机概率触发机制已被组织度阈值系统取代
    // 现在由 useGameLoop.js 中的 checkOrganizationEvents() 确定性触发事件
    // 当组织度达到 30%/70%/90% 阈值时自动触发对应事件
    console.warn('[DEPRECATED] checkRebellionEvents() 已废弃，请使用 organizationSystem.checkOrganizationEvents()');
    return null;
}

/**
 * 检查玩家是否有可用军队（非叛乱阶层）
 * @param {Object} army - 军队结构
 * @param {Object} popStructure - 人口结构
 * @param {string} rebellingStratum - 正在叛乱的阶层
 * @returns {boolean} 是否有可用军队
 */
export function hasAvailableMilitary(army, popStructure, rebellingStratum) {
    // 检查是否有任何军队单位
    const totalUnits = Object.values(army || {}).reduce((sum, count) => sum + (count || 0), 0);
    if (totalUnits === 0) return false;

    // 如果叛乱的是军事阶层，则军队不可用
    if (rebellingStratum === 'soldier') {
        return false;
    }

    return true;
}

/**
 * 检查军事阶层是否也在叛乱中
 * @param {Object} rebellionStates - 叛乱状态
 * @returns {boolean}
 */
export function isMilitaryRebelling(rebellionStates) {
    const soldierState = rebellionStates.soldier;

    return (
        (soldierState && soldierState.phase === REBELLION_PHASE.ACTIVE)
    );
}

/**
 * 处理叛乱行动结果
 * @param {string} action - 行动类型
 * @param {string} stratumKey - 阶层键
 * @param {Object} rebellionState - 当前叛乱状态
 * @param {Object} army - 军队
 * @param {number} militaryStrength - 军事力量
 * @returns {Object} 处理结果
 */
export function processRebellionAction(action, stratumKey, rebellionState = {}, army, militaryStrength) {
    const clamp = (value) => Math.max(0, Math.min(100, value));
    const baseOrganization = clamp(rebellionState.organization || 0);
    const currentStage = rebellionState.stage || getOrganizationStage(baseOrganization);

    const result = {
        success: false,
        newPhase: getPhaseFromStage(currentStage),
        playerLosses: 0,
        rebelLosses: 0,
        message: '',
        updatedOrganization: undefined,
        pauseDays: 0,
        // 新增：满意度变化
        approvalChange: 0,
    };

    const applyOrganization = (value) => {
        const next = clamp(value);
        result.updatedOrganization = next;
        const nextStage = getOrganizationStage(next);
        result.newPhase = getPhaseFromStage(nextStage);
    };

    const militaryBonus = Math.min(0.3, (militaryStrength || 0) * 0.1);

    switch (action) {
        case 'investigate': {
            const investigateChance = REBELLION_CONFIG.INVESTIGATE_SUCCESS_BASE + militaryBonus;
            result.success = Math.random() < investigateChance;
            if (result.success) {
                applyOrganization(baseOrganization - 20);
                result.pauseDays = 5;
                result.message = '调查成功，组织度被压制。';
            } else {
                // 调查失败不再增加组织度，只是无效果
                result.message = '调查无果，未获得有用情报。';
            }
            break;
        }
        case 'arrest': {
            const arrestChance = REBELLION_CONFIG.ARREST_SUCCESS_BASE + militaryBonus;
            result.success = Math.random() < arrestChance;
            if (result.success) {
                applyOrganization(baseOrganization - 35);
                result.pauseDays = 7;
                result.message = '成功逮捕核心成员。';
            } else {
                result.playerLosses = Math.floor(Math.random() * 5) + 1;
                // 逮捕失败不再增加组织度
                result.message = '逮捕失败，士气受损但形势未恶化。';
            }
            break;
        }
        case 'suppress': {
            const suppressChance = REBELLION_CONFIG.SUPPRESS_SUCCESS_BASE + militaryBonus;
            result.success = Math.random() < suppressChance;
            const totalArmy = Object.values(army || {}).reduce((sum, c) => sum + (c || 0), 0);
            const rebelStrength = (rebellionState.influenceShare || 0) * 100;
            if (result.success) {
                result.playerLosses = Math.floor(totalArmy * 0.1 * Math.random());
                result.rebelLosses = Math.floor(rebelStrength * (0.5 + Math.random() * 0.5));
                const target = currentStage === ORGANIZATION_STAGE.UPRISING ? 30 : baseOrganization - 60;
                applyOrganization(target);
                result.message = '镇压成功，组织被打散。';
            } else {
                result.playerLosses = Math.floor(totalArmy * 0.2 * Math.random());
                result.rebelLosses = Math.floor(rebelStrength * 0.3 * Math.random());
                // 镇压失败增加组织度（这是唯一有明确负面后果的行动）
                applyOrganization(baseOrganization + 10);
                result.message = '镇压失败，叛乱更加猖獗。';
            }
            break;
        }
        case 'appease': {
            // 安抚必定有效，在早期阶段效果更好
            result.success = true;
            const reduction = currentStage === ORGANIZATION_STAGE.GRUMBLING ? 15 : 8;
            applyOrganization(baseOrganization - reduction);
            result.approvalChange = 10;
            result.message = `安抚奏效，紧张局势有所缓和。（满意度+10，组织度-${reduction}%）`;
            break;
        }
        case 'negotiate': {
            // 谈判必定有效，但效果取决于当前阶段
            result.success = true;
            const reduction = currentStage === ORGANIZATION_STAGE.RADICALIZING ? 10 : 15;
            applyOrganization(baseOrganization - reduction);
            result.approvalChange = 15;
            result.message = `谈判取得进展。（满意度+15，组织度-${reduction}%）`;
            break;
        }
        case 'bribe': {
            // 收买内奸必定有效
            result.success = true;
            applyOrganization(baseOrganization - 12);
            result.pauseDays = 10; // 组织度增长暂停10天
            result.message = '贿赂奏效，内部出现分裂。（组织度-12%，增长暂停10天）';
            break;
        }
        default:
            break;
    }

    return result;
}

export {
}

export {
    REBELLION_PHASE,
    REBELLION_CONFIG,
    createBrewingEvent,
    createPlottingEvent,
    createActiveRebellionEvent,
    createOfficialCoupEvent,
    createOfficialCoupNation,
    createInvestigationResultEvent,
    createArrestResultEvent,
    createSuppressionResultEvent,
    createRebelNation,
    createRebellionEndEvent,
};
