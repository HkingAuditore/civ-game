/**
 * 理念分数获取与涌现触发
 * 在 simulation tick 中检查各种行为触发条件并累加分数
 */

import { IDEOLOGY_SCORE_TRIGGERS } from '../../config/ideologies';

/**
 * 返回下次涌现所需的总理念分数阈值
 * @param {number} ownedCount - 当前已拥有的理念数量（含重复等级）
 * @returns {number} 阈值
 */
export function getEmergenceThreshold(ownedCount) {
    return 50 + ownedCount * 30;
}

/**
 * 检查是否应该触发涌现事件
 */
export function checkEmergence(currentScore, spentScore, ownedCount) {
    const availableScore = currentScore - spentScore;
    const threshold = getEmergenceThreshold(ownedCount);
    return availableScore >= threshold;
}

/**
 * 建筑里程碑公式：第 n 个（0-indexed）里程碑的阈值
 * 50 → 150 → 450 → 1350 → 4050 → 12150 … （每次 ×3）
 */
export function getBuildingMilestone(index) {
    return Math.round(50 * Math.pow(3, index));
}

/**
 * 人口里程碑公式：第 n 个（0-indexed）里程碑的阈值
 * 100 → 400 → 1600 → 6400 → 25600 → 102400 … （每次 ×4）
 */
export function getPopMilestone(index) {
    return Math.round(100 * Math.pow(4, index));
}

/**
 * 在每个simulation tick中调用，检查各种行为触发条件并累加理念分数
 * @param {Object} gameState - 当前游戏状态
 * @param {Object} prevState - 上一tick的游戏状态
 * @returns {{ scoreGained: number, reasons: Array<{type: string, amount: number, desc: string}> }}
 */
export function checkAndAwardIdeologyScore(gameState, prevState) {
    const reasons = [];
    let scoreGained = 0;
    const milestones = [...(gameState.ideologyMilestones || [])];

    // 1. 研发知识
    if (gameState.techsUnlocked && prevState.techsUnlocked) {
        const newTechs = gameState.techsUnlocked.filter(t => !prevState.techsUnlocked.includes(t));
        if (newTechs.length > 0) {
            const { base, epochScale } = IDEOLOGY_SCORE_TRIGGERS.research_tech;
            const amount = newTechs.length * (base + gameState.epoch * epochScale);
            scoreGained += amount;
            reasons.push({ type: 'research_tech', amount, desc: `研发${newTechs.length}项知识` });
        }
    }

    // 2. 进入新时代
    if (gameState.epoch > (prevState.epoch || 0)) {
        const { base, epochScale } = IDEOLOGY_SCORE_TRIGGERS.epoch_advance;
        const amount = base + gameState.epoch * epochScale;
        scoreGained += amount;
        reasons.push({ type: 'epoch_advance', amount, desc: `进入第${gameState.epoch}时代` });
    }

    // 3. 建筑里程碑（公式化，指数递增，无上限）
    const totalBuildings = _countTotalBuildings(gameState.buildings);
    const { base: buildingBase } = IDEOLOGY_SCORE_TRIGGERS.building_milestone;
    // 找出当前已达成的最高里程碑 index
    let buildingIdx = 0;
    while (milestones.includes(`building_idx_${buildingIdx}`)) buildingIdx++;
    // 检查是否达到下一个里程碑
    while (totalBuildings >= getBuildingMilestone(buildingIdx)) {
        milestones.push(`building_idx_${buildingIdx}`);
        scoreGained += buildingBase;
        reasons.push({ type: 'building_milestone', amount: buildingBase, desc: `建筑数达到${getBuildingMilestone(buildingIdx)}` });
        buildingIdx++;
    }

    // 4. 人口里程碑（公式化，指数递增，无上限）
    const pop = gameState.population || 0;
    const { base: popBase } = IDEOLOGY_SCORE_TRIGGERS.pop_milestone;
    let popIdx = 0;
    while (milestones.includes(`pop_idx_${popIdx}`)) popIdx++;
    while (pop >= getPopMilestone(popIdx)) {
        milestones.push(`pop_idx_${popIdx}`);
        scoreGained += popBase;
        reasons.push({ type: 'pop_milestone', amount: popBase, desc: `人口达到${getPopMilestone(popIdx)}` });
        popIdx++;
    }

    return {
        scoreGained,
        reasons,
        updatedMilestones: milestones,
    };
}

/**
 * 统计总建筑数
 */
function _countTotalBuildings(buildings) {
    if (!buildings || typeof buildings !== 'object') return 0;
    return Object.values(buildings).reduce((sum, count) => sum + (count || 0), 0);
}
