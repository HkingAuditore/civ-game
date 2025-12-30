// 军事行动配置
// 定义可选择的固定军事目标

/**
 * 根据时代获取合适的兵种组合
 * @param {number} epoch - 时代等级
 * @param {string} actionType - 行动类型 (raid/assault/siege)
 * @returns {Array} 兵种配置数组
 */
export const getEnemyUnitsForEpoch = (epoch, actionType) => {
    // 根据时代定义兵种池
    // 注意: 所有兵种ID必须与 UNIT_TYPES 中定义的一致
    const epochUnits = {
        0: { // 石器时代
            light: ['militia', 'slinger'],
            medium: ['militia', 'slinger'],
            heavy: ['militia', 'slinger'],
        },
        1: { // 青铜时代
            light: ['militia', 'slinger', 'spearman'],
            medium: ['spearman', 'archer', 'chariot'],
            heavy: ['spearman', 'archer', 'chariot'],
        },
        2: { // 古典时代
            light: ['spearman', 'archer', 'light_cavalry'],
            medium: ['hoplite', 'composite_archer', 'light_cavalry'],
            heavy: ['hoplite', 'composite_archer', 'light_cavalry', 'battering_ram'],
        },
        3: { // 封建时代
            light: ['heavy_infantry', 'crossbowman', 'knight'],
            medium: ['heavy_infantry', 'crossbowman', 'knight', 'trebuchet'],
            heavy: ['heavy_infantry', 'crossbowman', 'knight', 'trebuchet'],
        },
        4: { // 火药时代
            light: ['pikeman', 'arquebus', 'cuirassier'],
            medium: ['pikeman', 'arquebus', 'cuirassier', 'bombard'],
            heavy: ['pikeman', 'arquebus', 'cuirassier', 'bombard'],
        },
        5: { // 启蒙时代
            light: ['musketeer', 'dragoon'],
            medium: ['musketeer', 'rifleman', 'dragoon', 'cannon'],
            heavy: ['musketeer', 'rifleman', 'dragoon', 'cannon'],
        },
        6: { // 工业时代
            light: ['line_infantry', 'lancer'],
            medium: ['line_infantry', 'gatling', 'lancer', 'artillery'],
            heavy: ['line_infantry', 'gatling', 'lancer', 'artillery'],
        },
    };

    const units = epochUnits[Math.min(epoch, 6)] || epochUnits[0];
    return units[actionType] || units.medium;
};

/**
 * Calculate proportional loot based on player and enemy resources
 * [FIXED] Added hard caps per resource type to prevent late-game overflow
 * @param {Object} playerResources - Player's current resources
 * @param {Object} enemyNation - Enemy nation object with wealth
 * @param {Object} lootConfig - Loot configuration with resource percentages
 * @returns {Object} Calculated loot amounts
 */
export const calculateProportionalLoot = (playerResources, enemyNation, lootConfig) => {
    const enemyWealth = enemyNation?.wealth || 500;
    const loot = {};

    // 硬性上限配置 - 每种资源每次掠夺的最大值
    // 这些值是绝对上限，无论玩家多强大都不会超过
    const HARD_CAPS = {
        // 基础资源
        food: 80000,
        wood: 50000,
        stone: 30000,
        // 金属
        copper: 8000,
        iron: 6000,
        coal: 5000,
        steel: 3000,
        // 加工品
        cloth: 15000,
        plank: 12000,
        brick: 10000,
        tools: 8000,
        dye: 4000,
        papyrus: 6000,
        // 奢侈品
        ale: 8000,
        delicacies: 5000,
        fine_clothes: 4000,
        furniture: 3000,
        // 贸易品
        spice: 5000,
        coffee: 4000,
        // 货币 - 银币上限稍高但仍有限制
        silver: 20000,
        // 特殊资源
        science: 3000,
        culture: 2000,
    };

    Object.entries(lootConfig).forEach(([resource, config]) => {
        const playerAmount = playerResources?.[resource] || 0;

        // 1. 基于敌方财富计算基础掠夺量
        const enemyBaseLoot = Math.floor(enemyWealth * config.enemyPercent);

        // 2. 基于玩家资源计算运输能力（但有递减收益）
        // 使用对数缩放，防止后期爆炸
        const logScale = playerAmount > 1000 ? Math.log10(playerAmount) / 6 : playerAmount / 1000;
        const playerScaledLoot = Math.floor(config.baseMin * (1 + logScale * 2));

        // 3. 取较小值，确保不会抢到比敌人有的还多
        const baseMin = config.baseMin || 10;
        const rawLoot = Math.max(baseMin, Math.min(enemyBaseLoot, playerScaledLoot));

        // 4. 应用硬性上限 - 这是最关键的修复
        const hardCap = HARD_CAPS[resource] || 100;
        const finalLoot = Math.min(rawLoot, hardCap);

        if (finalLoot > 0) {
            loot[resource] = Math.floor(finalLoot);
        }
    });

    return loot;
};

export const MILITARY_ACTIONS = [
    {
        id: 'raid',
        name: '边境掠夺',
        desc: '小股兵力快速突袭敌方补给线，目标是劫掠资源。',
        difficulty: '易',
        difficultyLevel: 1,
        unitScale: 'light',
        baseUnitCount: { min: 6, max: 10 },
        deploymentRatio: { min: 0.05, max: 0.15 }, // 敌方派遣5%-15%军队
        enemyUnits: [],
        cooldownDays: 5,
        // Proportional loot config: enemyPercent = % of enemy wealth, playerPercent = % of player resources
        // 边境掠夺主要获取：基础资源、农产品、轻便货物
        // [NERFED] 所有数值削弱50%以防止资源溢出
        lootConfig: {
            // 基础资源 - 容易掠夺
            food: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 25 },
            wood: { enemyPercent: 0.012, playerPercent: 0.010, baseMin: 15 },
            stone: { enemyPercent: 0.008, playerPercent: 0.006, baseMin: 8 },
            cloth: { enemyPercent: 0.010, playerPercent: 0.008, baseMin: 10 },
            // 货币和贵金属 - 掠夺者的主要目标
            silver: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 40 },
            copper: { enemyPercent: 0.008, playerPercent: 0.005, baseMin: 5 },
            // 加工品 - 少量
            plank: { enemyPercent: 0.005, playerPercent: 0.004, baseMin: 4 },
            dye: { enemyPercent: 0.006, playerPercent: 0.004, baseMin: 3 },
            // 食品和饮料
            ale: { enemyPercent: 0.009, playerPercent: 0.006, baseMin: 5 },
            delicacies: { enemyPercent: 0.005, playerPercent: 0.003, baseMin: 3 },
            // 贸易品 - 如果有的话
            spice: { enemyPercent: 0.006, playerPercent: 0.004, baseMin: 3 },
            coffee: { enemyPercent: 0.005, playerPercent: 0.003, baseMin: 2 },
        },
        // Legacy loot for backward compatibility (used as fallback)
        loot: {
            food: [40, 120],
            wood: [20, 60],
            silver: [60, 140],
        },
        influence: { win: 5, lose: -4 },
        winScore: 8,
        loseScore: 6,
        wealthDamage: 15,
    },
    {
        id: 'assault',
        name: '正面攻势',
        desc: '投入主力与敌军正面冲突，寻求瓦解其主力部队。',
        difficulty: '中',
        difficultyLevel: 2,
        unitScale: 'medium',
        baseUnitCount: { min: 24, max: 36 },
        deploymentRatio: { min: 0.30, max: 0.70 }, // 敌方派遣30%-70%军队
        enemyUnits: [],
        cooldownDays: 8,
        requiresTech: 'bronze_working', // 需要青铜冶炼 - 正规军队需要金属武器
        // 正面攻势主要获取：军事物资、金属、工业品
        // [NERFED] 所有数值削弱50%以防止资源溢出
        lootConfig: {
            // 基础资源
            food: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 35 },
            wood: { enemyPercent: 0.015, playerPercent: 0.011, baseMin: 20 },
            stone: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 12 },
            cloth: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 12 },
            // 金属和军事物资 - 击败敌军后缴获
            iron: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 15 },
            copper: { enemyPercent: 0.014, playerPercent: 0.010, baseMin: 10 },
            tools: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 8 },
            steel: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 4 },
            coal: { enemyPercent: 0.011, playerPercent: 0.008, baseMin: 6 },
            // 货币
            silver: { enemyPercent: 0.032, playerPercent: 0.020, baseMin: 90 },
            // 加工品
            plank: { enemyPercent: 0.010, playerPercent: 0.008, baseMin: 8 },
            brick: { enemyPercent: 0.009, playerPercent: 0.006, baseMin: 6 },
            dye: { enemyPercent: 0.008, playerPercent: 0.005, baseMin: 4 },
            // 奢侈品 - 战场缴获
            fine_clothes: { enemyPercent: 0.006, playerPercent: 0.004, baseMin: 3 },
            ale: { enemyPercent: 0.010, playerPercent: 0.008, baseMin: 6 },
            delicacies: { enemyPercent: 0.008, playerPercent: 0.005, baseMin: 4 },
            furniture: { enemyPercent: 0.005, playerPercent: 0.003, baseMin: 2 },
            // 贸易品
            spice: { enemyPercent: 0.008, playerPercent: 0.005, baseMin: 3 },
            coffee: { enemyPercent: 0.006, playerPercent: 0.004, baseMin: 3 },
            // 文化品
            papyrus: { enemyPercent: 0.006, playerPercent: 0.004, baseMin: 3 },
        },
        loot: {
            food: [60, 160],
            iron: [20, 50],
            silver: [150, 240],
        },
        influence: { win: 10, lose: -6 },
        winScore: 25,
        loseScore: 20,
        wealthDamage: 30,
    },
    {
        id: 'siege',
        name: '围城压制',
        desc: '长期围困敌城，切断其物资来源并迫使投降。',
        difficulty: '难',
        difficultyLevel: 3,
        unitScale: 'heavy',
        baseUnitCount: { min: 30, max: 50 },
        deploymentRatio: { min: 0.30, max: 0.70 }, // 敌方派遣30%-70%军队
        enemyUnits: [],
        cooldownDays: 12,
        requiresTech: 'fortification', // 需要防御工事科技 - 知道如何建城才知道如何攻城
        // 围城压制 - 攻陷城市后获取所有类型资源的丰厚战利品
        // [NERFED] 所有数值削弱50%以防止资源溢出
        lootConfig: {
            // 基础资源 - 城市储备
            food: { enemyPercent: 0.030, playerPercent: 0.020, baseMin: 50 },
            wood: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 30 },
            stone: { enemyPercent: 0.020, playerPercent: 0.014, baseMin: 25 },
            cloth: { enemyPercent: 0.019, playerPercent: 0.012, baseMin: 20 },
            // 金属资源 - 城市工业储备
            iron: { enemyPercent: 0.022, playerPercent: 0.016, baseMin: 22 },
            copper: { enemyPercent: 0.019, playerPercent: 0.014, baseMin: 18 },
            coal: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 15 },
            steel: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 10 },
            // 工业品 - 工坊缴获
            tools: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 12 },
            plank: { enemyPercent: 0.016, playerPercent: 0.011, baseMin: 12 },
            brick: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 12 },
            dye: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 8 },
            // 货币和贵金属 - 城市财库
            silver: { enemyPercent: 0.045, playerPercent: 0.028, baseMin: 150 },
            // 奢侈品 - 贵族府邸掠夺
            fine_clothes: { enemyPercent: 0.014, playerPercent: 0.009, baseMin: 8 },
            furniture: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 6 },
            ale: { enemyPercent: 0.015, playerPercent: 0.011, baseMin: 10 },
            delicacies: { enemyPercent: 0.014, playerPercent: 0.010, baseMin: 9 },
            // 贸易品 - 商人仓库
            spice: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 8 },
            coffee: { enemyPercent: 0.011, playerPercent: 0.008, baseMin: 6 },
            // 文化和知识 - 图书馆和档案
            papyrus: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 8 },
            science: { enemyPercent: 0.008, playerPercent: 0.004, baseMin: 5 },
            culture: { enemyPercent: 0.006, playerPercent: 0.003, baseMin: 4 },
        },
        loot: {
            food: [80, 180],
            wood: [40, 100],
            tools: [10, 25],
            silver: [200, 320],
        },
        influence: { win: 14, lose: -10 },
        winScore: 52,
        loseScore: 54,
        wealthDamage: 45,
    },
    {
        id: 'naval_raid',
        name: '海上劫掠',
        desc: '拦截敌方商船队，夺取海上贸易货物。',
        difficulty: '中',
        difficultyLevel: 2,
        unitScale: 'medium',
        baseUnitCount: { min: 16, max: 28 },
        deploymentRatio: { min: 0.30, max: 0.70 }, // 敌方派遣30%-70%军队
        enemyUnits: [],
        cooldownDays: 6,
        requiresTech: 'sailing', // 需要航海术
        // 海上劫掠 - 主要获取贸易品和进口货物
        // [NERFED] 所有数值削弱50%以防止资源溢出
        lootConfig: {
            // 贸易货物 - 主要目标
            spice: { enemyPercent: 0.022, playerPercent: 0.018, baseMin: 15 },
            coffee: { enemyPercent: 0.020, playerPercent: 0.015, baseMin: 12 },
            dye: { enemyPercent: 0.018, playerPercent: 0.014, baseMin: 11 },
            // 奢侈品
            fine_clothes: { enemyPercent: 0.015, playerPercent: 0.011, baseMin: 9 },
            furniture: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 6 },
            ale: { enemyPercent: 0.014, playerPercent: 0.010, baseMin: 8 },
            delicacies: { enemyPercent: 0.016, playerPercent: 0.012, baseMin: 10 },
            // 工业原料
            cloth: { enemyPercent: 0.015, playerPercent: 0.011, baseMin: 12 },
            copper: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 9 },
            iron: { enemyPercent: 0.011, playerPercent: 0.008, baseMin: 8 },
            // 货币 - 商船财宝
            silver: { enemyPercent: 0.035, playerPercent: 0.022, baseMin: 100 },
            // 其他货物
            papyrus: { enemyPercent: 0.010, playerPercent: 0.008, baseMin: 6 },
            tools: { enemyPercent: 0.009, playerPercent: 0.006, baseMin: 5 },
        },
        loot: {
            silver: [150, 280],
            spice: [20, 50],
            cloth: [20, 45],
        },
        influence: { win: 8, lose: -5 },
        winScore: 32,
        loseScore: 38,
        wealthDamage: 25,
    },
    {
        id: 'scorched_earth',
        name: '焦土战术',
        desc: '深入敌境破坏其生产设施和农田，削弱敌方经济。',
        difficulty: '难',
        difficultyLevel: 3,
        unitScale: 'heavy',
        baseUnitCount: { min: 12, max: 20 },
        deploymentRatio: { min: 0.35, max: 0.55 }, // 敌方派遣35%-55%军队
        enemyUnits: [],
        cooldownDays: 10,
        requiresTech: 'military_training', // 需要军事训练 - 系统性破坏需要有组织的军队
        // 焦土战术 - 主要破坏敌方资源，自己获取较少但敌方损失大
        // [NERFED] 所有数值削弱50%以防止资源溢出
        lootConfig: {
            // 抢先掠夺的物资
            food: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 40 },
            wood: { enemyPercent: 0.020, playerPercent: 0.014, baseMin: 25 },
            stone: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 15 },
            // 农产品
            cloth: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 12 },
            dye: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 6 },
            // 货币
            silver: { enemyPercent: 0.028, playerPercent: 0.018, baseMin: 75 },
            // 破坏后残余物资
            coal: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 9 },
            tools: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 5 },
            ale: { enemyPercent: 0.012, playerPercent: 0.009, baseMin: 8 },
        },
        loot: {
            food: [60, 140],
            wood: [40, 90],
            silver: [100, 200],
        },
        influence: { win: 12, lose: -8 },
        winScore: 48,
        loseScore: 42,
        wealthDamage: 60, // 对敌方经济伤害更大
    },
];
