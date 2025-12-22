/**
 * Buffs and Stability Module
 * Handles buff/debuff system and stability calculations
 */

import { STRATA } from '../../config';
import { scaleEffectValues } from '../utils/helpers';
import { STABILITY_INERTIA } from '../utils/constants';

/**
 * Calculate active buffs and debuffs based on class status
 * @param {Object} params - Buff calculation parameters
 * @returns {Object} Active buffs and debuffs
 */
export const calculateBuffsAndDebuffs = ({
    popStructure,
    classApproval,
    classInfluence,
    totalInfluence,
    needsReport
}) => {
    const newActiveBuffs = [];
    const newActiveDebuffs = [];

    Object.keys(STRATA).forEach(key => {
        const def = STRATA[key];
        if (!def.buffs || (popStructure[key] || 0) === 0) return;

        const approval = classApproval[key] || 50;
        const satisfiedNeeds = (needsReport[key]?.satisfactionRatio ?? 1) >= 0.9;
        const influenceShare = totalInfluence > 0
            ? (classInfluence[key] || 0) / totalInfluence
            : 0;

        // Buff multiplier based on influence
        const buffMultiplier = influenceShare > 0.8 ? 2 : influenceShare > 0.5 ? 1.5 : 1;

        // High influence privilege for buffs
        const hasInfluenceBuffPrivilege = approval >= 85 && influenceShare >= 0.3;
        const meetsStandardBuffCondition = approval >= 85 && satisfiedNeeds;

        if ((hasInfluenceBuffPrivilege || meetsStandardBuffCondition) && def.buffs.satisfied) {
            const scaledBuff = scaleEffectValues(def.buffs.satisfied, buffMultiplier);
            newActiveBuffs.push({
                class: key,
                ...scaledBuff,
            });
        } else if (approval < 40 && def.buffs.dissatisfied && influenceShare >= 0.3) {
            const scaledDebuff = scaleEffectValues(def.buffs.dissatisfied, buffMultiplier);
            newActiveDebuffs.push({
                class: key,
                ...scaledDebuff,
            });
        }
    });

    return { newActiveBuffs, newActiveDebuffs };
};

/**
 * Calculate stability value based on class approval and modifiers
 * @param {Object} params - Stability parameters
 * @returns {Object} Stability calculation results
 */
export const calculateStability = ({
    popStructure,
    classApproval,
    classInfluence,
    totalInfluence,
    newActiveBuffs,
    newActiveDebuffs,
    eventStabilityModifier = 0,
    extraStabilityPenalty = 0,
    currentStability = 50,
    stabilityBonus = 0 // NEW: Stability bonus from other sources (e.g. festivals)
}) => {
    // Calculate weighted average of class approval
    let weightedApprovalSum = 0;
    let totalWeight = 0;

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;

        const approval = classApproval[key] || 50;
        const influence = classInfluence[key] || 0;
        const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

        weightedApprovalSum += approval * influenceShare;
        totalWeight += influenceShare;
    });

    // Base stability from weighted average
    let baseStability = totalWeight > 0 ? weightedApprovalSum : 50;
    if (eventStabilityModifier) {
        baseStability += eventStabilityModifier;
    }

    // Add buff/debuff modifiers
    let stabilityModifier = 0;
    newActiveBuffs.forEach(buff => {
        if (buff.stability) stabilityModifier += buff.stability;
    });
    newActiveDebuffs.forEach(debuff => {
        if (debuff.stability) stabilityModifier += debuff.stability;
    });

    // Apply stability bonus (percentage of base stability)
    if (stabilityBonus) {
        stabilityModifier += baseStability * stabilityBonus;
    }

    stabilityModifier -= extraStabilityPenalty;

    // Target stability (clamped to 0-100)
    const targetStability = Math.max(0, Math.min(100, baseStability + stabilityModifier));

    // Inertia-based stability calculation
    // Stability drifts towards target, making crises feel weightier
    const stabilityValue = Math.max(0, Math.min(100,
        currentStability + (targetStability - currentStability) * STABILITY_INERTIA
    ));

    // Calculate efficiency from stability
    const stabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (stabilityValue - 50) / 100));
    const efficiency = stabilityFactor;

    return {
        stabilityValue,
        targetStability,
        efficiency,
        stabilityFactor
    };
};

/**
 * Calculate class influence based on population and wealth
 * @param {Object} params - Influence parameters
 * @returns {Object} Class influence and totals
 */
export const calculateClassInfluence = ({
    popStructure,
    classWealthResult
}) => {
    const classInfluence = {};
    const totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) return;

        const def = STRATA[key];
        const wealthShare = classWealthResult[key] || 0;
        const wealthFactor = totalWealth > 0 ? wealthShare / totalWealth : 0;
        classInfluence[key] = (def.influenceBase * count) + (wealthFactor * 10);
    });

    const totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);

    return { classInfluence, totalInfluence, totalWealth };
};
