/**
 * Diplomacy Economy Utils
 * 统一 GDP 读取逻辑，避免 UI 与模拟口径不一致
 */

export const getNationGDP = (nation, fallback = 1000) => {
    const gdp = nation?.gdp;
    if (Number.isFinite(gdp) && gdp > 0) return gdp;

    const wealth = nation?.wealth;
    if (Number.isFinite(wealth) && wealth > 0) return wealth;

    return fallback;
};

export const getNationAnnualOutput = (nation, fallback = 1000) => {
    const annualOutput = nation?.aiEconomyMetrics?.annualOutput;
    if (Number.isFinite(annualOutput) && annualOutput > 0) return annualOutput;
    return getNationGDP(nation, fallback);
};

export const getNationWealthStock = (nation, fallback = 1000) => {
    const wealthStock = nation?.aiEconomyMetrics?.wealthStock;
    if (Number.isFinite(wealthStock) && wealthStock > 0) return wealthStock;

    const wealth = nation?.wealth;
    if (Number.isFinite(wealth) && wealth > 0) return wealth;

    return fallback;
};

export const getNationTreasury = (nation, fallback = 300) => {
    const treasury = nation?.aiEconomyMetrics?.treasury;
    if (Number.isFinite(treasury) && treasury >= 0) return treasury;

    const budget = nation?.budget;
    if (Number.isFinite(budget) && budget >= 0) return budget;

    return fallback;
};

export const getNationEconomicScale = (nation, fallback = 1000) => {
    const annualOutput = getNationAnnualOutput(nation, fallback);
    const treasury = getNationTreasury(nation, fallback * 0.25);

    return Math.max(annualOutput, treasury * 2.5);
};

export const calculateAITreasuryTargetRatio = ({
    wealth = 0,
    population = 0,
    epoch = 0,
    isAtWar = false,
    aggression = 0.3,
    capacityUsage = 0.6,
    developmentRate = 1.0,
} = {}) => {
    const wealthPerCapita = wealth / Math.max(1, population);
    const epochReserve = 0.16 + Math.min(0.08, epoch * 0.015);
    const warReserve = isAtWar ? 0.08 : 0;
    const pressureReserve = Math.max(0, capacityUsage - 0.82) * 0.18;
    const instabilityReserve = Math.max(0, aggression - 0.45) * 0.05;
    const povertyPenalty = Math.max(0, 0.08 - wealthPerCapita * 0.0025);
    const developmentPenalty = Math.max(0, 1 - developmentRate) * 0.04;

    return Math.max(
        0.12,
        Math.min(
            0.42,
            epochReserve + warReserve + pressureReserve + instabilityReserve - povertyPenalty - developmentPenalty
        )
    );
};
