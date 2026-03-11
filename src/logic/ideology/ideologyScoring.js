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
 * @param {number} currentScore - 当前理念分数
 * @param {number} spentScore - 已消耗的理念分数
 * @param {number} ownedCount - 已拥有理念数
 * @returns {boolean}
 */
export function checkEmergence(currentScore, spentScore, ownedCount) {
    const availableScore = currentScore - spentScore;
    const threshold = getEmergenceThreshold(ownedCount);
    return availableScore >= threshold;
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

    // 3. 建筑里程碑
    const totalBuildings = _countTotalBuildings(gameState.buildings);
    const buildingMilestones = IDEOLOGY_SCORE_TRIGGERS.building_milestone.milestones;
    for (const milestone of buildingMilestones) {
        const key = `building_${milestone}`;
        if (totalBuildings >= milestone && !milestones.includes(key)) {
            milestones.push(key);
            scoreGained += IDEOLOGY_SCORE_TRIGGERS.building_milestone.base;
            reasons.push({ type: 'building_milestone', amount: IDEOLOGY_SCORE_TRIGGERS.building_milestone.base, desc: `建筑数达到${milestone}` });
        }
    }

    // 4. 人口里程碑
    const pop = gameState.population || 0;
    const popMilestones = IDEOLOGY_SCORE_TRIGGERS.pop_milestone.milestones;
    for (const milestone of popMilestones) {
        const key = `pop_${milestone}`;
        if (pop >= milestone && !milestones.includes(key)) {
            milestones.push(key);
            scoreGained += IDEOLOGY_SCORE_TRIGGERS.pop_milestone.base;
            reasons.push({ type: 'pop_milestone', amount: IDEOLOGY_SCORE_TRIGGERS.pop_milestone.base, desc: `人口达到${milestone}` });
        }
    }

    // 5. 文化里程碑
    const culture = gameState.resources?.culture || 0;
    const cultureMilestones = IDEOLOGY_SCORE_TRIGGERS.culture_milestone.milestones;
    for (const milestone of cultureMilestones) {
        const key = `culture_${milestone}`;
        if (culture >= milestone && !milestones.includes(key)) {
            milestones.push(key);
            scoreGained += IDEOLOGY_SCORE_TRIGGERS.culture_milestone.base;
            reasons.push({ type: 'culture_milestone', amount: IDEOLOGY_SCORE_TRIGGERS.culture_milestone.base, desc: `文化积累达到${milestone}` });
        }
    }

    // 6. 阶层和谐（所有阶层满意度>70）
    if (gameState.classApproval && !milestones.includes('class_harmony_first')) {
        const { threshold } = IDEOLOGY_SCORE_TRIGGERS.class_harmony;
        const allHappy = Object.values(gameState.classApproval).every(v => v >= threshold);
        if (allHappy) {
            milestones.push('class_harmony_first');
            scoreGained += IDEOLOGY_SCORE_TRIGGERS.class_harmony.base;
            reasons.push({ type: 'class_harmony', amount: IDEOLOGY_SCORE_TRIGGERS.class_harmony.base, desc: '所有阶层满意度达标' });
        }
    }

    // 7. 危机存活（稳定度曾跌到<20后回升到>50）
    const { lowThreshold } = IDEOLOGY_SCORE_TRIGGERS.crisis_survived;
    const stability = gameState.stability || gameState.currentStability || 50;
    const prevStability = prevState.stability || prevState.currentStability || 50;
    if (prevStability < lowThreshold && stability >= 50 && !milestones.includes('crisis_survived_first')) {
        milestones.push('crisis_survived_first');
        scoreGained += IDEOLOGY_SCORE_TRIGGERS.crisis_survived.base;
        reasons.push({ type: 'crisis_survived', amount: IDEOLOGY_SCORE_TRIGGERS.crisis_survived.base, desc: '危机中幸存' });
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
