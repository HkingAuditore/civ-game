import { generateInvestmentProfile } from './officialInvestment';
import { LOYALTY_CONFIG } from '../../config/officials';

export const migrateOfficialForInvestment = (official, currentDay = 0) => {
    if (!official || typeof official !== 'object') return official;

    const hasInvestmentProfile = !!official.investmentProfile;
    const hasOwnedProperties = Array.isArray(official.ownedProperties);

    // 检测是否需要忠诚度迁移
    // 如果 loyalty 字段不存在或为 undefined，设置为默认值 75
    // 如果 loyalty 为 0 且 lowLoyaltyDays > 100，说明是旧系统导致的异常低忠诚度，尝试修复
    const needsLoyaltyMigration = official.loyalty === undefined || official.loyalty === null
        || (official.loyalty === 0 && (official.lowLoyaltyDays ?? 0) > 100);

    // 检测是否需要薪资迁移 - 旧存档可能没有 salary 字段
    const hasSalary = Number.isFinite(official.salary);

    // 如果所有字段都已存在且不需要忠诚度迁移和薪资迁移，直接返回
    if (hasInvestmentProfile && hasOwnedProperties && !needsLoyaltyMigration && hasSalary) {
        return official;
    }

    const sourceStratum = official.sourceStratum || official.stratum || 'peasant';
    const politicalStance = official.politicalStance;

    // 计算忠诚度初始值
    const defaultLoyalty = LOYALTY_CONFIG?.INITIAL_MIN ?? 50;
    const loyaltyValue = needsLoyaltyMigration
        ? defaultLoyalty  // 迁移时使用较低的初始值（50），给玩家一些时间提升
        : official.loyalty;

    return {
        ...official,
        financialSatisfaction: official.financialSatisfaction || 'satisfied',
        // [BUG FIX] 确保 salary 字段存在 - 旧存档可能没有这个字段
        // 优先使用 official.salary，其次用 baseSalary，最后用 0 作为兜底
        salary: Number.isFinite(official.salary) 
            ? official.salary 
            : (Number.isFinite(official.baseSalary) ? official.baseSalary : 0),
        baseSalary: Number.isFinite(official.baseSalary) ? official.baseSalary : (official.salary || 0),
        investmentProfile: hasInvestmentProfile
            ? official.investmentProfile
            : generateInvestmentProfile(sourceStratum, politicalStance, currentDay),
        ownedProperties: hasOwnedProperties ? official.ownedProperties : [],
        lastDayPropertyIncome: typeof official.lastDayPropertyIncome === 'number'
            ? official.lastDayPropertyIncome
            : 0,
        // 忠诚度系统字段迁移
        loyalty: loyaltyValue,
        lowLoyaltyDays: needsLoyaltyMigration ? 0 : (official.lowLoyaltyDays ?? 0),
    };
};

export const migrateAllOfficialsForInvestment = (officials = [], currentDay = 0) => {
    if (!Array.isArray(officials)) return [];
    return officials.map(official => migrateOfficialForInvestment(official, currentDay));
};
