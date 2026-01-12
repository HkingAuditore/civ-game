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

export const NEGOTIABLE_TREATY_TYPES = Object.keys(TREATY_CONFIGS);
export const NEGOTIATION_MAX_ROUNDS = 3;

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
 * 计算朝贡金额（旧版本，已废弃）
 * @deprecated 请使用 vassalSystem.js 中的 calculateEnhancedTribute
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

// ========== 阶段1新增配置 ==========

/**
 * AI国家简化阶层配置模板
 * 不同政体类型的默认阶层比例和满意度
 */
export const SOCIAL_STRUCTURE_TEMPLATES = {
    monarchy: {
        elites: { ratio: 0.10, baseSatisfaction: 75, influence: 0.45 },
        commoners: { ratio: 0.80, baseSatisfaction: 50, influence: 0.35 },
        underclass: { ratio: 0.10, baseSatisfaction: 35, influence: 0.20 },
    },
    republic: {
        elites: { ratio: 0.15, baseSatisfaction: 65, influence: 0.35 },
        commoners: { ratio: 0.75, baseSatisfaction: 60, influence: 0.45 },
        underclass: { ratio: 0.10, baseSatisfaction: 45, influence: 0.20 },
    },
    theocracy: {
        elites: { ratio: 0.12, baseSatisfaction: 70, influence: 0.50 },
        commoners: { ratio: 0.78, baseSatisfaction: 55, influence: 0.30 },
        underclass: { ratio: 0.10, baseSatisfaction: 40, influence: 0.20 },
    },
    tribal: {
        elites: { ratio: 0.08, baseSatisfaction: 60, influence: 0.40 },
        commoners: { ratio: 0.82, baseSatisfaction: 55, influence: 0.40 },
        underclass: { ratio: 0.10, baseSatisfaction: 50, influence: 0.20 },
    },
    empire: {
        elites: { ratio: 0.08, baseSatisfaction: 80, influence: 0.55 },
        commoners: { ratio: 0.77, baseSatisfaction: 45, influence: 0.30 },
        underclass: { ratio: 0.15, baseSatisfaction: 30, influence: 0.15 },
    },
    default: {
        elites: { ratio: 0.12, baseSatisfaction: 65, influence: 0.40 },
        commoners: { ratio: 0.78, baseSatisfaction: 50, influence: 0.35 },
        underclass: { ratio: 0.10, baseSatisfaction: 40, influence: 0.25 },
    },
};

/**
 * AI国家经济数据配置
 * 用于初始化和更新AI国家的价格、库存等经济数据
 */
export const AI_ECONOMY_CONFIG = {
    // 价格波动配置
    prices: {
        initialVariation: 0.2,      // 初始价格相对玩家市场的波动范围 ±20%
        dailyVariation: 0.02,       // 每日价格随机波动 ±2%
        maxDeviation: 0.5,          // 相对基准价格的最大偏离 ±50%
    },
    // 库存配置（基于国家规模系数）
    inventory: {
        baseMultipliers: {
            small: 50,      // 小型国家基础库存系数
            medium: 100,    // 中型国家基础库存系数
            large: 200,     // 大型国家基础库存系数
        },
        // 不同资源类型的库存权重
        resourceWeights: {
            food: 2.0,      // 粮食库存较高
            wood: 1.5,
            stone: 1.0,
            iron: 1.2,
            cloth: 0.8,
            tools: 0.5,
            default: 0.3,
        },
        // 每日库存变化范围
        dailyChangeRate: 0.05,  // ±5%
    },
    // 国家规模阈值（基于财富）
    sizeThresholds: {
        small: 1000,
        medium: 5000,
        // large: > 5000
    },
};

/**
 * 条约签约成本与维护费配置
 */
export const TREATY_COSTS = {
    peace_treaty: { signingCostRate: 0.005, dailyMaintenance: 0 },
    non_aggression: { signingCostRate: 0.01, dailyMaintenance: 2 },
    trade_agreement: { signingCostRate: 0.02, dailyMaintenance: 5 },
    free_trade: { signingCostRate: 0.03, dailyMaintenance: 10 },
    investment_pact: { signingCostRate: 0.02, dailyMaintenance: 8 },
    open_market: { signingCostRate: 0.02, dailyMaintenance: 5 },
    academic_exchange: { signingCostRate: 0.015, dailyMaintenance: 3 },
    defensive_pact: { signingCostRate: 0.05, dailyMaintenance: 15 },
};

/**
 * 获取条约签约成本
 * @param {string} treatyType - 条约类型
 * @param {number} playerWealth - 玩家财富
 * @param {number} targetWealth - 目标国家财富
 * @returns {number} 签约成本
 */
export const calculateTreatySigningCost = (treatyType, playerWealth, targetWealth) => {
    const config = TREATY_COSTS[treatyType];
    if (!config) return 0;

    const minWealth = Math.min(playerWealth || 0, targetWealth || 0);
    return Math.floor(minWealth * config.signingCostRate);
};

/**
 * 获取条约每日维护费
 * @param {string} treatyType - 条约类型
 * @returns {number} 每日维护费
 */
export const getTreatyDailyMaintenance = (treatyType) => {
    const config = TREATY_COSTS[treatyType];
    return config?.dailyMaintenance || 0;
};

/**
 * 朝贡数值配置（调整后）
 */
export const TRIBUTE_CONFIG = {
    // 基础朝贡计算参数
    baseAmount: 200,                    // 固定基数（保底）
    playerWealthRate: 0.008,            // 基于玩家财富的比例
    vassalWealthRate: 0.03,             // 基于附庸财富的比例

    // 附庸规模系数
    sizeMultipliers: {
        small: 0.6,     // 小型附庸
        medium: 1.0,    // 中型附庸  
        large: 1.5,     // 大型附庸
    },

    // 资源朝贡配置
    resourceTribute: {
        enabled: true,
        baseAmount: 10,                  // 基础资源数量
        resources: ['food', 'wood', 'iron', 'cloth'],  // 可朝贡的资源类型
    },
};

/**
 * 独立倾向配置（调整后）
 */
export const INDEPENDENCE_CONFIG = {
    // 每日基础增长率（大幅提高）
    dailyGrowthRates: {
        protectorate: 0.08,     // 保护国：较低增长
        tributary: 0.15,        // 朝贡国：中等增长
        puppet: 0.25,           // 傀儡国：较高增长
        colony: 0.40,           // 殖民地：最高增长
    },

    // 时代系数（后期民族主义更强）
    eraMultiplier: {
        base: 1.0,
        perEra: 0.15,           // 每个时代增加15%
    },

    // 阶层满意度影响
    satisfactionThresholds: {
        critical: 30,           // 低于此值大幅增加独立倾向
        low: 50,                // 低于此值小幅增加独立倾向
        high: 70,               // 高于此值降低独立倾向
    },

    // 控制手段效果
    controlMeasures: {
        governor: {             // 派遣总督
            cost: 50,           // 每日成本
            independenceReduction: 0.3,  // 每日减少独立倾向
            eliteSatisfactionBonus: 2,   // 精英满意度提升
        },
        garrison: {             // 驻军占领
            costPerMilitary: 0.5,        // 每点军力的日成本
            independenceReduction: 0.5,  // 每日减少独立倾向
            commonerSatisfactionPenalty: -3,  // 平民满意度下降
        },
        assimilation: {         // 文化同化
            cost: 100,          // 每日成本
            independenceCapReduction: 0.05,  // 每日降低独立倾向上限
            minIndependenceCap: 30,          // 最低独立倾向上限
        },
        economicAid: {          // 经济扶持
            cost: 80,           // 每日成本
            commonerSatisfactionBonus: 3,    // 平民满意度提升
            underclassSatisfactionBonus: 5,  // 下层满意度提升
        },
    },
};

/**
 * 根据政体类型获取阶层结构
 * @param {string} governmentType - 政体类型
 * @returns {Object} 阶层结构
 */
export const getSocialStructureTemplate = (governmentType) => {
    const template = SOCIAL_STRUCTURE_TEMPLATES[governmentType] || SOCIAL_STRUCTURE_TEMPLATES.default;

    // 深拷贝并添加当前满意度
    return {
        elites: {
            ...template.elites,
            satisfaction: template.elites.baseSatisfaction + (Math.random() - 0.5) * 10,
        },
        commoners: {
            ...template.commoners,
            satisfaction: template.commoners.baseSatisfaction + (Math.random() - 0.5) * 10,
        },
        underclass: {
            ...template.underclass,
            satisfaction: template.underclass.baseSatisfaction + (Math.random() - 0.5) * 10,
        },
    };
};

/**
 * 计算阶层平均满意度
 * @param {Object} socialStructure - 阶层结构
 * @returns {number} 加权平均满意度
 */
export const calculateAverageSatisfaction = (socialStructure) => {
    if (!socialStructure) return 50;

    const { elites, commoners, underclass } = socialStructure;

    // 按影响力加权计算
    const totalInfluence = (elites?.influence || 0.4) + (commoners?.influence || 0.35) + (underclass?.influence || 0.25);

    const weightedSum =
        (elites?.satisfaction || 50) * (elites?.influence || 0.4) +
        (commoners?.satisfaction || 50) * (commoners?.influence || 0.35) +
        (underclass?.satisfaction || 50) * (underclass?.influence || 0.25);

    return weightedSum / totalInfluence;
};

// ========== 阶段4.3 时代演进效果配置 ==========

/**
 * 时代演进效果配置
 * 定义各机制随时代变化的加成
 */
export const ERA_PROGRESSION_EFFECTS = {
    // 商人派驻效率演进
    merchantEfficiency: {
        baseEfficiency: 1.0,
        perEraBonus: 0.1,           // 每个时代效率+10%
        maxBonus: 0.5,              // 最高+50%
        description: '商人驻留效率',
    },

    // 殖民/附庸控制力演进
    vassalControl: {
        baseControl: 1.0,
        perEraBonus: 0.05,          // 每个时代控制力+5%
        independenceReduction: 0.02, // 每个时代独立倾向减少速度+2%
        tributeBonus: 0.03,         // 每个时代朝贡效率+3%
        description: '附庸控制效率',
    },

    // 条约效果演进
    treatyEfficiency: {
        baseDurationBonus: 0,
        perEraDurationBonus: 0.1,   // 每个时代条约基础时长+10%
        baseMaintenanceReduction: 0,
        perEraMaintenanceReduction: 0.02, // 每个时代维护费-2%
        description: '条约效率',
    },

    // 国际组织效果演进
    organizationEfficiency: {
        baseEffectMultiplier: 1.0,
        perEraBonus: 0.08,          // 每个时代组织效果+8%
        maxBonus: 0.4,              // 最高+40%
        memberCapBonus: 1,          // 每个时代成员上限+1
        description: '国际组织效率',
    },

    // 海外投资效率演进
    overseasInvestment: {
        baseProfitMultiplier: 1.0,
        perEraBonus: 0.05,          // 每个时代利润+5%
        baseRiskReduction: 0,
        perEraRiskReduction: 0.02,  // 每个时代风险-2%
        description: '海外投资效率',
    },

    // 移民效率演进
    migrationEfficiency: {
        baseFlowMultiplier: 1.0,
        perEraBonus: 0.1,           // 每个时代移民流量+10%
        integrationSpeedBonus: 0.05, // 每个时代融入速度+5%
        description: '移民管理效率',
    },
};

/**
 * 计算时代演进效果
 * @param {string} effectType - 效果类型
 * @param {number} currentEra - 当前时代
 * @param {number} unlockEra - 解锁时代（默认为0）
 * @returns {Object} 演进效果数据
 */
export const getEraProgressionEffect = (effectType, currentEra, unlockEra = 0) => {
    const config = ERA_PROGRESSION_EFFECTS[effectType];
    if (!config) {
        return { multiplier: 1.0, bonus: 0 };
    }

    // 计算时代优势（当前时代超过解锁时代的程度）
    const eraAdvantage = Math.max(0, currentEra - unlockEra);

    const result = {
        effectType,
        currentEra,
        eraAdvantage,
        description: config.description,
    };

    // 根据效果类型计算具体加成
    switch (effectType) {
        case 'merchantEfficiency':
            result.multiplier = config.baseEfficiency +
                Math.min(eraAdvantage * config.perEraBonus, config.maxBonus);
            result.bonusPercent = Math.round((result.multiplier - 1) * 100);
            break;

        case 'vassalControl':
            result.controlMultiplier = config.baseControl + eraAdvantage * config.perEraBonus;
            result.independenceReductionBonus = eraAdvantage * config.independenceReduction;
            result.tributeBonus = eraAdvantage * config.tributeBonus;
            break;

        case 'treatyEfficiency':
            result.durationBonus = config.baseDurationBonus + eraAdvantage * config.perEraDurationBonus;
            result.maintenanceReduction = config.baseMaintenanceReduction +
                eraAdvantage * config.perEraMaintenanceReduction;
            break;

        case 'organizationEfficiency':
            result.effectMultiplier = config.baseEffectMultiplier +
                Math.min(eraAdvantage * config.perEraBonus, config.maxBonus);
            result.memberCapBonus = eraAdvantage * config.memberCapBonus;
            break;

        case 'overseasInvestment':
            result.profitMultiplier = config.baseProfitMultiplier + eraAdvantage * config.perEraBonus;
            result.riskReduction = config.baseRiskReduction + eraAdvantage * config.perEraRiskReduction;
            break;

        case 'migrationEfficiency':
            result.flowMultiplier = config.baseFlowMultiplier + eraAdvantage * config.perEraBonus;
            result.integrationBonus = eraAdvantage * config.integrationSpeedBonus;
            break;

        default:
            result.multiplier = 1.0;
    }

    return result;
};

/**
 * 获取所有时代演进效果汇总
 * @param {number} currentEra - 当前时代
 * @returns {Object} 所有效果汇总
 */
export const getAllEraProgressionEffects = (currentEra) => {
    const effects = {};

    for (const effectType of Object.keys(ERA_PROGRESSION_EFFECTS)) {
        effects[effectType] = getEraProgressionEffect(effectType, currentEra);
    }

    return effects;
};

/**
 * 获取时代演进效果的UI描述
 * @param {number} currentEra - 当前时代
 * @returns {Array<Object>} 效果描述数组
 */
export const getEraProgressionDescriptions = (currentEra) => {
    const descriptions = [];
    const effects = getAllEraProgressionEffects(currentEra);

    for (const [type, effect] of Object.entries(effects)) {
        const config = ERA_PROGRESSION_EFFECTS[type];
        let desc = config.description;
        let value = '';

        switch (type) {
            case 'merchantEfficiency':
                if (effect.bonusPercent > 0) {
                    value = `+${effect.bonusPercent}%`;
                }
                break;
            case 'vassalControl':
                if (effect.tributeBonus > 0) {
                    value = `朝贡+${Math.round(effect.tributeBonus * 100)}%`;
                }
                break;
            case 'treatyEfficiency':
                if (effect.durationBonus > 0) {
                    value = `时长+${Math.round(effect.durationBonus * 100)}%`;
                }
                break;
            case 'organizationEfficiency':
                if (effect.memberCapBonus > 0) {
                    value = `成员上限+${Math.floor(effect.memberCapBonus)}`;
                }
                break;
            case 'overseasInvestment':
                if (effect.profitMultiplier > 1) {
                    value = `利润+${Math.round((effect.profitMultiplier - 1) * 100)}%`;
                }
                break;
            case 'migrationEfficiency':
                if (effect.flowMultiplier > 1) {
                    value = `流量+${Math.round((effect.flowMultiplier - 1) * 100)}%`;
                }
                break;
        }

        if (value) {
            descriptions.push({
                type,
                name: desc,
                value,
                effect,
            });
        }
    }

    return descriptions;
};
