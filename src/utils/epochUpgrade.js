import { TECHS } from '../config';

export const getEpochTechRequirementStatus = (epoch = 0, techsUnlocked = []) => {
    const currentEpochTechs = TECHS.filter((tech) => tech.epoch === epoch);
    const currentEpochTechTotal = currentEpochTechs.length;
    const unlockedSet = new Set(Array.isArray(techsUnlocked) ? techsUnlocked : []);
    const currentEpochResearched = currentEpochTechs.filter((tech) => unlockedSet.has(tech.id)).length;
    const requiredTechCount = Math.floor(currentEpochTechTotal * 0.8);

    return {
        currentEpochTechTotal,
        currentEpochResearched,
        requiredTechCount,
        isTechRequirementMet: currentEpochResearched >= requiredTechCount,
    };
};
