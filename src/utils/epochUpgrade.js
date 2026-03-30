import { TECHS, EPOCHS } from '../config';

/**
 * 根据当前人口规模计算时代升级成本系数。
 * 人口超过下一时代门槛越多，升级成本越高，形成自平衡。
 */
export const getEpochScaleMultiplier = (population, epoch) => {
    const nextEpoch = EPOCHS[epoch + 1];
    if (!nextEpoch) return 1;
    const baselinePop = nextEpoch.req?.population || 50;
    const ratio = Math.max(1, population / baselinePop);
    return 1 + Math.log2(ratio) * 0.15;
};

export const getEpochTechRequirementStatus = (epoch = 0, techsUnlocked = []) => {
    const currentEpochTechs = TECHS.filter((tech) => tech.epoch === epoch);
    const currentEpochTechTotal = currentEpochTechs.length;
    const unlockedSet = new Set(Array.isArray(techsUnlocked) ? techsUnlocked : []);
    const currentEpochResearched = currentEpochTechs.filter((tech) => unlockedSet.has(tech.id)).length;
    // Stone Age (epoch 0) uses 55% threshold to ease the first upgrade; later eras use 80%
    const ratio = epoch === 0 ? 0.55 : 0.8;
    const requiredTechCount = Math.floor(currentEpochTechTotal * ratio);

    return {
        currentEpochTechTotal,
        currentEpochResearched,
        requiredTechCount,
        isTechRequirementMet: currentEpochResearched >= requiredTechCount,
    };
};
