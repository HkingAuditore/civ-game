import { generateInvestmentProfile } from './officialInvestment';

export const migrateOfficialForInvestment = (official, currentDay = 0) => {
    if (!official || typeof official !== 'object') return official;

    const hasInvestmentProfile = !!official.investmentProfile;
    const hasOwnedProperties = Array.isArray(official.ownedProperties);

    if (hasInvestmentProfile && hasOwnedProperties) {
        return official;
    }

    const sourceStratum = official.sourceStratum || official.stratum || 'peasant';
    const politicalStance = official.politicalStance;

    return {
        ...official,
        financialSatisfaction: official.financialSatisfaction || 'satisfied',
        investmentProfile: hasInvestmentProfile
            ? official.investmentProfile
            : generateInvestmentProfile(sourceStratum, politicalStance, currentDay),
        ownedProperties: hasOwnedProperties ? official.ownedProperties : [],
        lastDayPropertyIncome: typeof official.lastDayPropertyIncome === 'number'
            ? official.lastDayPropertyIncome
            : 0,
    };
};

export const migrateAllOfficialsForInvestment = (officials = [], currentDay = 0) => {
    if (!Array.isArray(officials)) return [];
    return officials.map(official => migrateOfficialForInvestment(official, currentDay));
};
