import { TECHS } from '../config';

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
