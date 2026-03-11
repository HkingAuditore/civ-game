/**
 * 理念卡槽管理与冷却
 * 管理理念的装备/卸下、卡槽数量、冷却期
 */

import { IDEOLOGY_MAP } from '../../config/ideologies';

/** 冷却期（游戏日） */
const COOLDOWN_DAYS = 30;

/** 基础卡槽数 */
const BASE_SLOTS = 3;

/** 最终卡槽上限 */
const MAX_SLOTS = 10;

/** 每时代额外卡槽（从时代1开始，每个+1） */
const EPOCH_SLOT_SCHEDULE = {
    1: 4,   // 青铜时代: 4个卡槽
    2: 5,   // 古典时代: 5个
    3: 6,   // 封建时代: 6个
    4: 7,   // 探索时代: 7个
    5: 8,   // 启蒙时代: 8个
};

/**
 * 根据当前时代和条件计算最大卡槽数
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁知识
 * @param {number} synergyBonusSlots - 联动额外卡槽
 * @returns {number} 最大卡槽数
 */
export function getMaxSlots(epoch = 0, techsUnlocked = [], synergyBonusSlots = 0) {
    // 基础卡槽
    let slots = BASE_SLOTS;

    // 时代加成
    for (const [ep, maxAtEpoch] of Object.entries(EPOCH_SLOT_SCHEDULE)) {
        if (epoch >= parseInt(ep)) {
            slots = Math.max(slots, maxAtEpoch);
        }
    }

    // 联动/特殊加成
    slots += synergyBonusSlots;

    return Math.min(slots, MAX_SLOTS);
}

/**
 * 装备理念到卡槽
 * @param {string} ideologyId - 要装备的理念ID
 * @param {Object} state - 当前理念状态 { equippedIdeologies, ideologyCollection, ideologyCooldowns, ideologySlotCount }
 * @returns {{ success: boolean, message: string, updatedState: Object }}
 */
export function equipIdeology(ideologyId, state) {
    const { equippedIdeologies = [], ideologyCollection = [], ideologyCooldowns = {}, ideologySlotCount = BASE_SLOTS } = state;

    // 检查是否已装备
    if (equippedIdeologies.includes(ideologyId)) {
        return { success: false, message: '该理念已经装备在卡槽中' };
    }

    // 检查是否拥有
    const owned = ideologyCollection.find(e => e.id === ideologyId);
    if (!owned) {
        return { success: false, message: '尚未获得该理念' };
    }

    // 检查冷却
    const cooldown = ideologyCooldowns[ideologyId] || 0;
    if (cooldown > 0) {
        return { success: false, message: `该理念正在冷却中，剩余${cooldown}天` };
    }

    // 检查槽位
    if (equippedIdeologies.length >= ideologySlotCount) {
        return { success: false, message: '卡槽已满，请先移除一个理念' };
    }

    return {
        success: true,
        message: `已装备"${IDEOLOGY_MAP[ideologyId]?.name || ideologyId}"`,
        updatedState: {
            equippedIdeologies: [...equippedIdeologies, ideologyId],
        },
    };
}

/**
 * 从卡槽中卸下理念
 * @param {string} ideologyId - 要卸下的理念ID
 * @param {Object} state - 当前理念状态
 * @returns {{ success: boolean, message: string, updatedState: Object }}
 */
export function unequipIdeology(ideologyId, state) {
    const { equippedIdeologies = [], ideologyCooldowns = {} } = state;

    // 检查是否已装备
    if (!equippedIdeologies.includes(ideologyId)) {
        return { success: false, message: '该理念未装备在卡槽中' };
    }

    // 检查冷却（卸下也受冷却限制）
    const cooldown = ideologyCooldowns[ideologyId] || 0;
    if (cooldown > 0) {
        return { success: false, message: `该理念正在冷却中，剩余${cooldown}天` };
    }

    return {
        success: true,
        message: `已卸下"${IDEOLOGY_MAP[ideologyId]?.name || ideologyId}"`,
        updatedState: {
            equippedIdeologies: equippedIdeologies.filter(id => id !== ideologyId),
            ideologyCooldowns: {
                ...ideologyCooldowns,
                [ideologyId]: COOLDOWN_DAYS,
            },
        },
    };
}

/**
 * 每tick减少冷却天数
 * @param {Object} cooldowns - 当前冷却状态 { [ideologyId]: remainingDays }
 * @returns {Object} 更新后的冷却状态（移除已归零的条目）
 */
export function tickCooldowns(cooldowns = {}) {
    const updated = {};
    for (const [id, remaining] of Object.entries(cooldowns)) {
        const next = remaining - 1;
        if (next > 0) {
            updated[id] = next;
        }
        // 归零的不保留
    }
    return updated;
}

/**
 * 将装备的理念ID列表解析为完整的理念对象列表（含等级）
 * @param {Array<string>} equippedIds - 已装备理念ID
 * @param {Array} ideologyCollection - 理念库
 * @returns {Array} 完整的理念对象列表
 */
export function resolveEquippedIdeologies(equippedIds = [], ideologyCollection = []) {
    const collectionMap = {};
    for (const entry of ideologyCollection) {
        collectionMap[entry.id] = entry;
    }

    return equippedIds
        .filter(id => IDEOLOGY_MAP[id] && collectionMap[id])
        .map(id => ({
            ...IDEOLOGY_MAP[id],
            level: collectionMap[id].level || 1,
        }));
}
