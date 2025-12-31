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
    // [BUFFED] 所有硬性上限乘以3，配合冷却增加后的更高收益
    const HARD_CAPS = {
        // 基础资源
        food: 240000,
        wood: 150000,
        stone: 90000,
        // 金属
        copper: 24000,
        iron: 18000,
        coal: 15000,
        steel: 9000,
        // 加工品
        cloth: 45000,
        plank: 36000,
        brick: 30000,
        tools: 24000,
        dye: 12000,
        papyrus: 18000,
        // 奢侈品
        ale: 24000,
        delicacies: 15000,
        fine_clothes: 12000,
        furniture: 9000,
        // 贸易品
        spice: 15000,
        coffee: 12000,
        // 货币 - 银币上限稍高但仍有限制
        silver: 60000,
        // 特殊资源
        science: 9000,
        culture: 6000,
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
        cooldownDays: 15,  // [BUFFED] 5→15天，配合战利品×3
        // Proportional loot config: enemyPercent = % of enemy wealth, playerPercent = % of player resources
        // 边境掠夺主要获取：基础资源、农产品、轻便货物
        // [BUFFED] 所有数值乘以3，配合冷却时间增加
        lootConfig: {
            // 基础资源 - 容易掠夺
            food: { enemyPercent: 0.054, playerPercent: 0.036, baseMin: 75 },
            wood: { enemyPercent: 0.036, playerPercent: 0.030, baseMin: 45 },
            stone: { enemyPercent: 0.024, playerPercent: 0.018, baseMin: 24 },
            cloth: { enemyPercent: 0.030, playerPercent: 0.024, baseMin: 30 },
            // 货币和贵金属 - 掠夺者的主要目标
            silver: { enemyPercent: 0.066, playerPercent: 0.045, baseMin: 120 },
            copper: { enemyPercent: 0.024, playerPercent: 0.015, baseMin: 15 },
            // 加工品 - 少量
            plank: { enemyPercent: 0.015, playerPercent: 0.012, baseMin: 12 },
            dye: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 9 },
            // 食品和饮料
            ale: { enemyPercent: 0.027, playerPercent: 0.018, baseMin: 15 },
            delicacies: { enemyPercent: 0.015, playerPercent: 0.009, baseMin: 9 },
            // 贸易品 - 如果有的话
            spice: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 9 },
            coffee: { enemyPercent: 0.015, playerPercent: 0.009, baseMin: 6 },
        },
        // Legacy loot for backward compatibility (used as fallback) [BUFFED ×3]
        loot: {
            food: [120, 360],
            wood: [60, 180],
            silver: [180, 420],
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
        cooldownDays: 24,  // [BUFFED] 8→24天，配合战利品×3
        requiresTech: 'bronze_working', // 需要青铜冶炼 - 正规军队需要金属武器
        // 正面攻势主要获取：军事物资、金属、工业品
        // [BUFFED] 所有数值乘以3，配合冷却时间增加
        lootConfig: {
            // 基础资源
            food: { enemyPercent: 0.066, playerPercent: 0.045, baseMin: 105 },
            wood: { enemyPercent: 0.045, playerPercent: 0.033, baseMin: 60 },
            stone: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 36 },
            cloth: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 36 },
            // 金属和军事物资 - 击败敌军后缴获
            iron: { enemyPercent: 0.054, playerPercent: 0.036, baseMin: 45 },
            copper: { enemyPercent: 0.042, playerPercent: 0.030, baseMin: 30 },
            tools: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 24 },
            steel: { enemyPercent: 0.030, playerPercent: 0.018, baseMin: 12 },
            coal: { enemyPercent: 0.033, playerPercent: 0.024, baseMin: 18 },
            // 货币
            silver: { enemyPercent: 0.096, playerPercent: 0.060, baseMin: 270 },
            // 加工品
            plank: { enemyPercent: 0.030, playerPercent: 0.024, baseMin: 24 },
            brick: { enemyPercent: 0.027, playerPercent: 0.018, baseMin: 18 },
            dye: { enemyPercent: 0.024, playerPercent: 0.015, baseMin: 12 },
            // 奢侈品 - 战场缴获
            fine_clothes: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 9 },
            ale: { enemyPercent: 0.030, playerPercent: 0.024, baseMin: 18 },
            delicacies: { enemyPercent: 0.024, playerPercent: 0.015, baseMin: 12 },
            furniture: { enemyPercent: 0.015, playerPercent: 0.009, baseMin: 6 },
            // 贸易品
            spice: { enemyPercent: 0.024, playerPercent: 0.015, baseMin: 9 },
            coffee: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 9 },
            // 文化品
            papyrus: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 9 },
        },
        // [BUFFED ×3]
        loot: {
            food: [180, 480],
            iron: [60, 150],
            silver: [450, 720],
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
        cooldownDays: 36,  // [BUFFED] 12→36天，配合战利品×3
        requiresTech: 'fortification', // 需要防御工事科技 - 知道如何建城才知道如何攻城
        // 围城压制 - 攻陷城市后获取所有类型资源的丰厚战利品
        // [BUFFED] 所有数值乘以3，配合冷却时间增加
        lootConfig: {
            // 基础资源 - 城市储备
            food: { enemyPercent: 0.090, playerPercent: 0.060, baseMin: 150 },
            wood: { enemyPercent: 0.066, playerPercent: 0.045, baseMin: 90 },
            stone: { enemyPercent: 0.060, playerPercent: 0.042, baseMin: 75 },
            cloth: { enemyPercent: 0.057, playerPercent: 0.036, baseMin: 60 },
            // 金属资源 - 城市工业储备
            iron: { enemyPercent: 0.066, playerPercent: 0.048, baseMin: 66 },
            copper: { enemyPercent: 0.057, playerPercent: 0.042, baseMin: 54 },
            coal: { enemyPercent: 0.054, playerPercent: 0.036, baseMin: 45 },
            steel: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 30 },
            // 工业品 - 工坊缴获
            tools: { enemyPercent: 0.054, playerPercent: 0.036, baseMin: 36 },
            plank: { enemyPercent: 0.048, playerPercent: 0.033, baseMin: 36 },
            brick: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 36 },
            dye: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 24 },
            // 货币和贵金属 - 城市财库
            silver: { enemyPercent: 0.135, playerPercent: 0.084, baseMin: 450 },
            // 奢侈品 - 贵族府邸掠夺
            fine_clothes: { enemyPercent: 0.042, playerPercent: 0.027, baseMin: 24 },
            furniture: { enemyPercent: 0.036, playerPercent: 0.024, baseMin: 18 },
            ale: { enemyPercent: 0.045, playerPercent: 0.033, baseMin: 30 },
            delicacies: { enemyPercent: 0.042, playerPercent: 0.030, baseMin: 27 },
            // 贸易品 - 商人仓库
            spice: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 24 },
            coffee: { enemyPercent: 0.033, playerPercent: 0.024, baseMin: 18 },
            // 文化和知识 - 图书馆和档案
            papyrus: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 24 },
            science: { enemyPercent: 0.024, playerPercent: 0.012, baseMin: 15 },
            culture: { enemyPercent: 0.018, playerPercent: 0.009, baseMin: 12 },
        },
        // [BUFFED ×3]
        loot: {
            food: [240, 540],
            wood: [120, 300],
            tools: [30, 75],
            silver: [600, 960],
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
        cooldownDays: 18,  // [BUFFED] 6→18天，配合战利品×3
        requiresTech: 'sailing', // 需要航海术
        // 海上劫掠 - 主要获取贸易品和进口货物
        // [BUFFED] 所有数值乘以3，配合冷却时间增加
        lootConfig: {
            // 贸易货物 - 主要目标
            spice: { enemyPercent: 0.066, playerPercent: 0.054, baseMin: 45 },
            coffee: { enemyPercent: 0.060, playerPercent: 0.045, baseMin: 36 },
            dye: { enemyPercent: 0.054, playerPercent: 0.042, baseMin: 33 },
            // 奢侈品
            fine_clothes: { enemyPercent: 0.045, playerPercent: 0.033, baseMin: 27 },
            furniture: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 18 },
            ale: { enemyPercent: 0.042, playerPercent: 0.030, baseMin: 24 },
            delicacies: { enemyPercent: 0.048, playerPercent: 0.036, baseMin: 30 },
            // 工业原料
            cloth: { enemyPercent: 0.045, playerPercent: 0.033, baseMin: 36 },
            copper: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 27 },
            iron: { enemyPercent: 0.033, playerPercent: 0.024, baseMin: 24 },
            // 货币 - 商船财宝
            silver: { enemyPercent: 0.105, playerPercent: 0.066, baseMin: 300 },
            // 其他货物
            papyrus: { enemyPercent: 0.030, playerPercent: 0.024, baseMin: 18 },
            tools: { enemyPercent: 0.027, playerPercent: 0.018, baseMin: 15 },
        },
        // [BUFFED ×3]
        loot: {
            silver: [450, 840],
            spice: [60, 150],
            cloth: [60, 135],
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
        cooldownDays: 30,  // [BUFFED] 10→30天，配合战利品×3
        requiresTech: 'military_training', // 需要军事训练 - 系统性破坏需要有组织的军队
        // 焦土战术 - 主要破坏敌方资源，自己获取较少但敌方损失大
        // [BUFFED] 所有数值乘以3，配合冷却时间增加
        lootConfig: {
            // 抢先掠夺的物资
            food: { enemyPercent: 0.075, playerPercent: 0.054, baseMin: 120 },
            wood: { enemyPercent: 0.060, playerPercent: 0.042, baseMin: 75 },
            stone: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 45 },
            // 农产品
            cloth: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 36 },
            dye: { enemyPercent: 0.030, playerPercent: 0.018, baseMin: 18 },
            // 货币
            silver: { enemyPercent: 0.084, playerPercent: 0.054, baseMin: 225 },
            // 破坏后残余物资
            coal: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 27 },
            tools: { enemyPercent: 0.030, playerPercent: 0.018, baseMin: 15 },
            ale: { enemyPercent: 0.036, playerPercent: 0.027, baseMin: 24 },
        },
        // [BUFFED ×3]
        loot: {
            food: [180, 420],
            wood: [120, 270],
            silver: [300, 600],
        },
        influence: { win: 12, lose: -8 },
        winScore: 48,
        loseScore: 42,
        wealthDamage: 60, // 对敌方经济伤害更大
    },
];
