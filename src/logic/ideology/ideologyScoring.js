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
    return 35 + ownedCount * 20;
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

    // NOTE: research_tech and epoch_advance scoring are now handled proactively
    // in useGameActions.js (researchTech / advanceEpoch) via ideologyEventBus.queueDirectEffect().
    // This eliminates the fragile prevTechsRef/prevEpochRef diff and save-load jump detection.

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

    // 5. 贸易里程碑（累计贸易量达到节点）
    const tradeVolume = gameState.tradeVolume || 0;
    if (tradeVolume > 0) {
        const { base: tradeBase, milestones: tradeMilestones } = IDEOLOGY_SCORE_TRIGGERS.trade_milestone;
        for (let i = 0; i < tradeMilestones.length; i++) {
            const key = `trade_vol_${i}`;
            if (!milestones.includes(key) && tradeVolume >= tradeMilestones[i]) {
                milestones.push(key);
                scoreGained += tradeBase;
                reasons.push({ type: 'trade_milestone', amount: tradeBase, desc: `贸易量达到${tradeMilestones[i]}` });
            }
        }
    }

    // 6. 战争结果（检测战争结束：上一tick有战争，本tick战争结束）
    const prevWarNations = prevState.warNations || [];
    const curWarNations = gameState.warNations || [];
    if (prevWarNations.length > 0) {
        const { baseWin, baseLose } = IDEOLOGY_SCORE_TRIGGERS.war_result;
        // 找出本tick结束的战争（上一tick在战，本tick不在战）
        for (const warEntry of prevWarNations) {
            const { id: nationId, warScore: prevWarScore, eventId } = warEntry;
            const stillAtWar = curWarNations.some(n => n.id === nationId);
            if (!stillAtWar) {
                // 战争结束，用 eventId 防止重复计分
                const key = `war_result_${eventId || nationId}`;
                if (!milestones.includes(key)) {
                    milestones.push(key);
                    // warScore > 0 表示玩家占优（胜），< 0 表示劣势（败）
                    const isWin = (prevWarScore || 0) >= 0;
                    const amount = isWin ? baseWin : baseLose;
                    scoreGained += amount;
                    reasons.push({ type: 'war_result', amount, desc: isWin ? '赢得战争' : '战争结束' });
                }
            }
        }
    }

    // 7. 产业链完成（检测 completedChains 数量增加）
    const prevChains = prevState.completedChains || 0;
    const curChains = gameState.completedChains || 0;
    if (curChains > prevChains) {
        const { base: chainBase } = IDEOLOGY_SCORE_TRIGGERS.chain_complete;
        const newChains = curChains - prevChains;
        const amount = newChains * chainBase;
        scoreGained += amount;
        reasons.push({ type: 'chain_complete', amount, desc: `完成${newChains}条产业链` });
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
