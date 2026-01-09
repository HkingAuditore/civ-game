// 外交扩展配置
// 以时代解锁为核心的外交机制门控

export const DIPLOMACY_ERA_UNLOCK = {
    treaties: {
        peace_treaty: { minEra: 1, name: '和平条约' },
        non_aggression: { minEra: 2, name: '互不侵犯条约' },
        trade_agreement: { minEra: 2, name: '贸易协定' },
        free_trade: { minEra: 4, name: '自由贸易协定' },
        investment_pact: { minEra: 4, name: '投资协议' },
        open_market: { minEra: 2, name: '开放市场' },
        academic_exchange: { minEra: 3, name: '学术交流' },
        defensive_pact: { minEra: 3, name: '共同防御' },
    },
    sovereignty: {
        protectorate: { minEra: 2, name: '保护国' },
        tributary: { minEra: 3, name: '朝贡国' },
        puppet: { minEra: 6, name: '傀儡国' },
        colony: { minEra: 4, name: '殖民地（人口型领地）' },
    },
    organizations: {
        military_alliance: { minEra: 3, name: '军事联盟' },
        economic_bloc: { minEra: 5, name: '经济共同体' },
        trade_zone: { minEra: 5, name: '自贸区' },
    },
    economy: {
        merchant_stationing: { minEra: 3, name: '商人驻留' },
        overseas_building: { minEra: 4, name: '海外建筑' },
        price_convergence: { minEra: 6, name: '市场价格联动' },
        multi_round_negotiation: { minEra: 5, name: '多轮谈判' },
    },
    migration: {
        economic_migration: { minEra: 3, name: '经济移民' },
        war_refugees: { minEra: 2, name: '战争难民' },
        political_exile: { minEra: 4, name: '政治流亡' },
    },
};

export const TREATY_CONFIGS = {
    peace_treaty: { baseDuration: 365, minRelation: 0 },
    non_aggression: { baseDuration: 365, minRelation: 40 },
    trade_agreement: { baseDuration: 365, minRelation: 45 },
    free_trade: { baseDuration: 1095, minRelation: 60 },
    investment_pact: { baseDuration: 730, minRelation: 55 },
    open_market: { baseDuration: 730, minRelation: 55 },
    academic_exchange: { baseDuration: 730, minRelation: 65 },
    defensive_pact: { baseDuration: 1095, minRelation: 70 },
};

export const TREATY_TYPE_LABELS = {
    peace_treaty: '和平条约',
    non_aggression: '互不侵犯',
    trade_agreement: '贸易协定',
    free_trade: '自由贸易',
    investment_pact: '投资协议',
    open_market: '开放市场',
    academic_exchange: '学术交流',
    defensive_pact: '共同防御',
};

export const OPEN_MARKET_TREATY_TYPES = ['open_market', 'trade_agreement', 'free_trade'];
export const PEACE_TREATY_TYPES = ['peace_treaty', 'non_aggression'];

export const ORGANIZATION_EFFECTS = {
    economic_bloc: {
        tariffDiscount: 0.2,
        relationBonus: 3,
    },
    trade_zone: {
        tariffDiscount: 0.4,
        relationBonus: 5,
    },
};

export const DIPLOMACY_SOVEREIGNTY_TYPES = ['protectorate', 'tributary', 'puppet', 'colony'];
export const DIPLOMACY_ORGANIZATION_TYPES = ['military_alliance', 'economic_bloc', 'trade_zone'];
export const OVERSEAS_BUILDING_MODES = ['local', 'dumping', 'buyback'];

export const DEFAULT_VASSAL_STATUS = {
    vassalOf: null,
    vassalType: null,
    autonomy: 1.0,
    tributeRate: 0.0,
    independencePressure: 0.0,
};

export const getTreatyDuration = (treatyType, currentEra) => {
    const config = TREATY_CONFIGS[treatyType];
    if (!config) return 365;
    const unlockEra = DIPLOMACY_ERA_UNLOCK.treaties[treatyType]?.minEra ?? 0;
    const eraAdvantage = Math.max(0, (currentEra ?? 0) - unlockEra);
    return Math.max(1, Math.floor(config.baseDuration * (1 + eraAdvantage * 0.5)));
};

export const getTreatyBreachPenalty = (currentEra) => {
    if (currentEra >= 6) return { relationPenalty: 50, cooldownDays: 365 };
    if (currentEra >= 4) return { relationPenalty: 35, cooldownDays: 180 };
    return { relationPenalty: 20, cooldownDays: 90 };
};

export const isDiplomacyUnlocked = (category, mechanismId, currentEra) => {
    const config = DIPLOMACY_ERA_UNLOCK[category]?.[mechanismId];
    return config ? currentEra >= config.minEra : false;
};
