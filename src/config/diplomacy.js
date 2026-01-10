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

// ========== 附庸系统配置 ==========

/**
 * 附庸类型配置
 * - minRelation: 建立该关系所需的最低关系值
 * - autonomy: 初始自主度 (0-100)
 * - tributeRate: 朝贡比例（基于GDP增量）
 * - exploitationFactor: 工资剥削系数（1.0为市场价）
 */
export const VASSAL_TYPE_CONFIGS = {
    protectorate: {
        name: '保护国',
        minEra: 2,
        minRelation: 60,
        autonomy: 80,
        tributeRate: 0.08,
        exploitationFactor: 0.9,
        tariffDiscount: 0.5,
        description: '高自主度附庸，提供有限朝贡与优惠贸易',
    },
    tributary: {
        name: '朝贡国',
        minEra: 3,
        minRelation: 50,
        autonomy: 50,
        tributeRate: 0.15,
        exploitationFactor: 0.7,
        tariffDiscount: 0.75,
        description: '中等自主度附庸，定期朝贡与优先贸易',
    },
    puppet: {
        name: '傀儡国',
        minEra: 6,
        minRelation: 30,
        autonomy: 20,
        tributeRate: 0.25,
        exploitationFactor: 0.5,
        tariffDiscount: 1.0,
        description: '低自主度附庸，高额朝贡与完全贸易控制',
    },
    colony: {
        name: '殖民地',
        minEra: 4,
        minRelation: 0,
        autonomy: 5,
        tributeRate: 0.35,
        exploitationFactor: 0.3,
        tariffDiscount: 1.0,
        description: '无自主度领地，强制资源配额与贸易垄断',
    },
};

export const VASSAL_TYPE_LABELS = {
    protectorate: '保护国',
    tributary: '朝贡国',
    puppet: '傀儡国',
    colony: '殖民地',
};

/**
 * 自主度对附庸能力的影响
 * @param {number} autonomy - 自主度 (0-100)
 * @returns {Object} 自主度效果
 */
export const getAutonomyEffects = (autonomy) => ({
    canDeclareWar: autonomy > 70,
    canSignTreaties: autonomy > 50,
    canSetTariffs: autonomy > 40,
    tributeReduction: 1 - (autonomy / 200),
    investmentShield: autonomy / 100,
});

/**
 * 计算附庸的独立倾向
 * @param {Object} vassalNation - 附庸国对象
 * @param {Object} overlordMilitary - 宗主军事力量
 * @returns {number} 独立倾向 (0-100)
 */
export const calculateIndependenceDesire = (vassalNation, overlordMilitary = 1.0) => {
    if (!vassalNation || vassalNation.vassalOf === null) return 0;
    
    let desire = vassalNation.independencePressure || 0;
    
    // 朝贡负担
    desire += (vassalNation.tributeRate || 0) * 100;
    
    // 自主度压力
    desire += (100 - (vassalNation.autonomy || 100)) * 0.3;
    
    // 社会满意度影响（如果有阶层数据）
    if (vassalNation.socialStructure) {
        const eliteSat = vassalNation.socialStructure.elites?.satisfaction || 50;
        const commonerSat = vassalNation.socialStructure.commoners?.satisfaction || 50;
        desire += (100 - eliteSat) * 0.15;
        desire += (100 - commonerSat) * 0.1;
    }
    
    // 宗主军事优势抑制
    const militaryAdvantage = Math.max(0, overlordMilitary - (vassalNation.militaryStrength || 0.5));
    desire -= militaryAdvantage * 30;
    
    return Math.min(100, Math.max(0, desire));
};

/**
 * 计算朝贡金额
 * @param {Object} vassalNation - 附庸国对象
 * @returns {number} 朝贡金额（银币）
 */
export const calculateTribute = (vassalNation) => {
    if (!vassalNation || vassalNation.vassalOf === null) return 0;
    
    const tributeRate = vassalNation.tributeRate || 0;
    const autonomy = vassalNation.autonomy || 100;
    
    // 基于国家财富估算GDP增量
    const gdpEstimate = (vassalNation.wealth || 500) * 0.05;
    const tributeBase = gdpEstimate * tributeRate;
    
    // 自主度降低实际朝贡
    const autonomyFactor = 1 - (autonomy / 200);
    
    // 独立倾向降低实际朝贡
    const independenceDesire = vassalNation.independencePressure || 0;
    const resistanceFactor = 1 - (independenceDesire / 200);
    
    return Math.floor(tributeBase * autonomyFactor * resistanceFactor);
};

/**
 * 附庸关系转换要求
 */
export const VASSAL_TRANSITION_REQUIREMENTS = {
    // 从主权国家到各类附庸
    fromSovereign: {
        protectorate: { minRelation: 60, militaryRatio: 0.5, warScore: 30 },
        tributary: { minRelation: 50, militaryRatio: 0.4, warScore: 50 },
        puppet: { minRelation: 30, militaryRatio: 0.3, warScore: 80 },
        colony: { minRelation: 0, militaryRatio: 0.2, warScore: 100 },
    },
    // 附庸升降级
    upgrade: {
        protectorate_to_tributary: { minRelation: 40 },
        tributary_to_puppet: { minRelation: 30, warScore: 30 },
        puppet_to_colony: { minRelation: 0, warScore: 50 },
    },
    downgrade: {
        colony_to_puppet: { minRelation: 50, independencePressure: 60 },
        puppet_to_tributary: { minRelation: 60, independencePressure: 50 },
        tributary_to_protectorate: { minRelation: 70, independencePressure: 40 },
    },
};

/**
 * 独立战争触发条件
 */
export const INDEPENDENCE_WAR_CONDITIONS = {
    minIndependenceDesire: 80,
    triggers: {
        overlordAtWar: { probability: 0.3 },
        overlordLowStability: { threshold: 40, probability: 0.2 },
        foreignSupport: { minRelation: 60, probability: 0.25 },
        highOrganization: { threshold: 70, probability: 0.15 },
    },
};
