import { normalizeIdeologyDefinitions, reportIdeologyDslIssues } from './ideologyDsl.js';

/**
 * 理念分类常量
 * 8种分类，每种对应独特的图标颜色主题
 */
export const IDEOLOGY_CATEGORIES = {
    philosophy: { name: '哲学理念', icon: 'Brain', color: 'text-indigo-400', bgClass: 'bg-indigo-900/30' },
    theology:   { name: '神学理念', icon: 'Church', color: 'text-yellow-400', bgClass: 'bg-yellow-900/30' },
    politics:   { name: '政治理念', icon: 'Landmark', color: 'text-red-400', bgClass: 'bg-red-900/30' },
    economy:    { name: '经济理念', icon: 'Coins', color: 'text-green-400', bgClass: 'bg-green-900/30' },
    military:   { name: '军事理念', icon: 'Sword', color: 'text-orange-400', bgClass: 'bg-orange-900/30' },
    aesthetics: { name: '美学理念', icon: 'Palette', color: 'text-pink-400', bgClass: 'bg-pink-900/30' },
    science:    { name: '科学理念', icon: 'FlaskConical', color: 'text-cyan-400', bgClass: 'bg-cyan-900/30' },
    social:     { name: '社会理念', icon: 'Users', color: 'text-purple-400', bgClass: 'bg-purple-900/30' },
};

/**
 * 理念分数触发行为配置
 * 每种行为类型的基础分数和计算公式
 */
export const IDEOLOGY_SCORE_TRIGGERS = {
    research_tech:     { base: 5,  epochScale: 3,   desc: '研发知识' },
    epoch_advance:     { base: 30, epochScale: 10,  desc: '进入新时代' },
    achievement:       { base: 10, maxBase: 30,     desc: '达成成就' },
    building_milestone:{ base: 15, milestones: [50, 100, 200, 500, 1000], desc: '建筑里程碑' },
    pop_milestone:     { base: 20, milestones: [100, 500, 1000, 5000, 10000, 50000], desc: '人口里程碑' },
    war_result:        { baseWin: 20, baseLose: 15,  desc: '战争结果' },
    chain_complete:    { base: 20, desc: '产业链完成' },
    trade_milestone:   { base: 10, milestones: [1000, 5000, 20000, 100000], desc: '贸易里程碑' },
    class_harmony:     { base: 15, threshold: 70,   desc: '阶层和谐' },
    crisis_survived:   { base: 20, lowThreshold: 20, desc: '危机存活' },
    culture_milestone: { base: 10, milestones: [100, 500, 2000, 10000], desc: '文化繁荣' },
};

/**
 * 理念数据
 * 约50个理念，覆盖8个分类
 * 每个理念包含：id / name / category / icon / color / unlockEpoch / desc / rarity /
 * weightModifiers / effects.levels（3级）
 *
 * === 新增效果字段（在 effects.levels[n] 中可选） ===
 *
 * 1) onEvents: Array<{
 *      event: string,         // IDEOLOGY_EVENTS 常量，如 'on_build'
 *      effect: {
 *        action: 'addResource' | 'addStability' | 'addBuff' | 'addIdeologyScore' | 'modifyBonus',
 *        resource?: string,   // for addResource
 *        amount?: number,     // 中后期会按相对量框架动态缩放
 *        buffId?: string,     // for addBuff
 *        duration?: number,   // for addBuff (days)
 *        effects?: Object,    // for addBuff (bonuses during buff)
 *        name?: string,       // for addBuff display name
 *        category?: string,   // for addIdeologyScore
 *        bonusKey?: string,   // for modifyBonus
 *      },
 *      cooldownDays?: number, // min ticks between triggers
 *      maxTriggers?: number,  // lifetime cap
 *      condition?: Object,    // AND filter on eventData, e.g. { category: 'military' }
 *    }>
 *
 * 2) converters: Array<{
 *      source: string,                     // source identifier (e.g. 'military', 'silver', 'official')
 *      sourceType: 'resource' | 'buildingCount' | 'officialCount' | 'population' | 'stability',
 *      ratio: number,                      // conversion ratio
 *      target: string,                     // target bonus key (e.g. 'militaryBonus', 'scienceBonus')
 *      targetType: 'bonus' | 'resource',   // default 'bonus'
 *      cap?: number,                       // max converted value (before global safety cap)
 *    }>
 *
 * 3) ruleMods: Array<{
 *      type: 'building_cost_mod' | 'official_bonus' | 'tax_modifier' | 'cooldown_mod' | 'price_volatility_mod' | 'tech_cost_mod',
 *      scope?: string,   // e.g. building category for building_cost_mod, stratum for official_bonus
 *      value: number,
 *    }>
 *
 * 等级语义：
 * - L1 解锁身份效果（shared triggerEffects 会自动归入第1级）
 * - L2 强化引擎（通常为 converters / 更强 ruleMods）
 * - L3 解锁临界/危机能力（通常为额外 onEvents / triggerEffects）
 */
export const IDEOLOGIES = [
    // ============ 神学理念 (theology) ============
    {
        id: 'monotheism',
        name: '一神教',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 1,
        desc: '万物皆由唯一真神创造，信仰统一是社会凝聚的基石。',
        lore: '从古埃及阿顿崇拜到犹太教、基督教、伊斯兰教，一神教深刻塑造了人类文明的面貌。',
        rarity: 'common',
        weightModifiers: [
            { condition: { stratum: 'cleric', minPop: 10 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    stability: 5,
                    cultureBonus: 0.04,
                    scienceBonus: -0.03,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'cleric', bonus: { perPopPassive: { culture: 0.006 } } },
                    ],
                },
                {
                    stability: 7,
                    cultureBonus: 0.06,
                    categories: { civic: 0.04 },
                    scienceBonus: -0.04,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.008, target: 'cultureBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                },
                {
                    stability: 9,
                    cultureBonus: 0.08,
                    categories: { civic: 0.05 },
                    maxPop: 0.02,
                    scienceBonus: -0.05,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '信仰整合', buffId: 'faith_unity', duration: 120, effects: { stability: 8, cultureBonus: 0.08 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'resource_threshold', resource: 'culture', threshold: 500, bonus: { stability: 3, cultureBonus: 0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'polytheism',
        name: '多神教',
        category: 'theology',
        icon: 'Sparkles',
        color: 'text-yellow-300',
        unlockEpoch: 0,
        desc: '万物皆有灵，诸神各司其职，庇佑世间万象。',
        lore: '从苏美尔到希腊罗马、印度到北欧，多神信仰是人类最古老的精神寄托。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.08, categories: { gather: 0.03 }, stability: -2 },
                { cultureBonus: 0.12, categories: { gather: 0.05 }, stability: 1 },
                { cultureBonus: 0.16, categories: { gather: 0.08 }, stability: 3, maxPop: 0.02 },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'gather', per: 5, bonus: { categories: { gather: 0.05 } } },
            ],
        },
    },
    {
        id: 'ancestor_worship',
        name: '祖先崇拜',
        category: 'theology',
        icon: 'Flame',
        color: 'text-amber-400',
        unlockEpoch: 0,
        desc: '先祖之灵守护子孙，血脉传承是最神圣的义务。',
        lore: '从中国的宗庙祭祀到非洲的先灵信仰，祖先崇拜是宗族社会的精神核心。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 4, maxPop: 0.03, scienceBonus: -0.02 },
                { stability: 6, maxPop: 0.05, categories: { civic: 0.03 }, scienceBonus: -0.03 },
                { stability: 10, maxPop: 0.08, categories: { civic: 0.05 }, cultureBonus: 0.05, scienceBonus: -0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { stability: 1 } },
            ],
        },
    },
    {
        id: 'messianic_faith',
        name: '弥赛亚信仰',
        category: 'theology',
        icon: 'Sun',
        color: 'text-yellow-500',
        unlockEpoch: 2,
        desc: '救世主终将降临，引领信众走向应许之地。',
        lore: '犹太教的弥赛亚期盼、基督教的末日审判、佛教的弥勒下生——救世信仰跨越了文明的边界。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { stabilityBelow: 30 }, multiplier: 2.0 },
        ],
        effects: {
            levels: [
                { stability: 5, cultureBonus: 0.03, production: -0.03 },
                { stability: 8, cultureBonus: 0.06, maxPop: 0.04, production: -0.04 },
                { stability: 12, cultureBonus: 0.10, maxPop: 0.06, categories: { civic: 0.05 }, production: -0.05 },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'culture', threshold: 500, bonus: { stability: 5, cultureBonus: 0.05 } },
                // 资源消耗：宗教狂热需要持续的文化投入来维系信众
                { type: 'resource_drain', resource: 'culture', drainPerTick: 3,
                    bonus: { stability: 3, maxPop: 0.02 },
                    penaltyIfDrained: { stability: -5, cultureBonus: -0.03 } },
            ],
        },
    },

    // ============ 哲学理念 (philosophy) ============
    {
        id: 'humanism',
        name: '人文主义',
        category: 'philosophy',
        icon: 'BookOpen',
        color: 'text-indigo-400',
        unlockEpoch: 2,
        desc: '人是万物的尺度，人的尊严与潜能是一切价值的基础。',
        lore: '文艺复兴时期兴起的人文主义运动，将人从神学的阴影中解放，开启了现代文明。',
        rarity: 'common',
        weightModifiers: [
            { condition: { minTechs: 10 }, multiplier: 1.3 },
        ],
        effects: {
            levels: [
                { scienceBonus: 0.06, maxPop: 0.03, militaryBonus: -0.03 },
                {
                    scienceBonus: 0.08,
                    maxPop: 0.05,
                    cultureBonus: 0.03,
                    militaryBonus: -0.04,
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { flatPop: 1.2 } },
                    ],
                },
                {
                    scienceBonus: 0.10,
                    maxPop: 0.06,
                    cultureBonus: 0.05,
                    militaryBonus: -0.05,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '人道救济', buffId: 'humanitarian_relief', duration: 120, effects: { stability: 8, maxPop: 0.06, cultureBonus: 0.05 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35, normalBonus: { scienceBonus: 0.02, cultureBonus: 0.02 }, flippedBonus: { stability: -4, scienceBonus: -0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'rationalism',
        name: '理性主义',
        category: 'philosophy',
        icon: 'Lightbulb',
        color: 'text-indigo-300',
        unlockEpoch: 4,
        desc: '真理源于理性推演而非感官经验，逻辑是知识的唯一可靠基础。',
        lore: '笛卡尔"我思故我在"、斯宾诺莎的几何学伦理学、莱布尼茨的单子论——理性主义奠定了现代哲学基石。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minTechs: 20 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                { scienceBonus: 0.08, categories: { industry: 0.02 }, cultureBonus: -0.03, stability: -2 },
                {
                    scienceBonus: 0.10,
                    categories: { industry: 0.04 },
                    cultureBonus: -0.03,
                    stability: -2,
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { scienceBonus: 0.0012 } },
                    ],
                },
                {
                    scienceBonus: 0.12,
                    categories: { industry: 0.05 },
                    cultureBonus: -0.04,
                    stability: -3,
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '理性突破', buffId: 'rational_breakthrough', duration: 90, effects: { scienceBonus: 0.12, production: 0.05 } }, cooldownDays: 15 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.08 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 40, normalBonus: { scienceBonus: 0.02 }, flippedBonus: { scienceBonus: -0.04, stability: -3 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'existentialism',
        name: '存在主义',
        category: 'philosophy',
        icon: 'Eye',
        color: 'text-indigo-500',
        unlockEpoch: 6,
        desc: '存在先于本质，人通过自由选择来定义自我。',
        lore: '克尔凯郭尔的信仰之跃、海德格尔的此在、萨特的自由选择——存在主义是现代性焦虑的哲学回应。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { stabilityBelow: 40 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                { cultureBonus: 0.08, stability: -3, maxPop: -0.02 },
                { cultureBonus: 0.12, scienceBonus: 0.05, stability: -3, maxPop: -0.03 },
                { cultureBonus: 0.18, scienceBonus: 0.08, stability: -2, production: 0.05, maxPop: -0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.01 } },
            ],
        },
    },
    {
        id: 'absolute_idealism',
        name: '绝对唯心主义',
        category: 'philosophy',
        icon: 'Infinity',
        color: 'text-indigo-600',
        unlockEpoch: 4,
        desc: '精神是世界的本质，现实是绝对精神自我展开的过程。',
        lore: '黑格尔的辩证法、谢林的自然哲学、费希特的自我——德国唯心主义是西方哲学史的巅峰之一。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { minTechs: 25 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                { scienceBonus: 0.08, cultureBonus: 0.05, production: -0.03 },
                { scienceBonus: 0.12, cultureBonus: 0.08, categories: { civic: 0.03 }, production: -0.04 },
                { scienceBonus: 0.16, cultureBonus: 0.12, categories: { civic: 0.06 }, stability: 5, production: -0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'scribe', bonus: { perPopPassive: { science: 0.02 } } },
            ],
        },
    },

    // ============ 政治理念 (politics) ============
    {
        id: 'divine_right',
        name: '君权神授',
        category: 'politics',
        icon: 'Crown',
        color: 'text-red-400',
        unlockEpoch: 1,
        desc: '君主的权力源于神意，臣民服从是天命所归。',
        lore: '从法老到天子，从拜占庭皇帝到路易十四——君权神授是古代政治秩序的核心信条。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 5, taxIncome: 0.03, scienceBonus: -0.03 },
                { stability: 8, taxIncome: 0.05, categories: { military: 0.03 }, scienceBonus: -0.04 },
                { stability: 12, taxIncome: 0.08, categories: { military: 0.05 }, maxPop: 0.03, scienceBonus: -0.05 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { stability: -1 } }, // 随时代推移效果递减
                // 与共和主义根本矛盾：君主权威与共和理念冲突
                { type: 'mutual_exclusion', conflictsWith: ['republicanism'],
                    penalty: { stability: -12, categories: { civic: -0.10 } },
                    bonusIfPure: { stability: 3, taxIncome: 0.02 } },
                // 资源消耗：维持宫廷排场和王室威仪需要持续的银币投入
                { type: 'resource_drain', resource: 'silver', drainPerTick: 5,
                    bonus: { stability: 3, taxIncome: 0.02 },
                    penaltyIfDrained: { stability: -4, taxIncome: -0.03 } },
            ],
        },
    },
    {
        id: 'republicanism',
        name: '共和主义',
        category: 'politics',
        icon: 'Scale',
        color: 'text-red-300',
        unlockEpoch: 2,
        desc: '公共事务应由公民共同治理，权力来源于人民的授权。',
        lore: '罗马共和国、威尼斯共和国、美利坚合众国——共和主义是自由治理的伟大实验。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 4,
                    categories: { civic: 0.04 },
                    militaryBonus: -0.02,
                    taxIncome: -0.01,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { silver: 0.01 } } },
                        { type: 'mutual_exclusion', conflictsWith: ['divine_right'],
                            penalty: { stability: -12, categories: { civic: -0.10 } },
                            bonusIfPure: { stability: 2, cultureBonus: 0.02 } },
                    ],
                },
                {
                    stability: 6,
                    categories: { civic: 0.06 },
                    scienceBonus: 0.03,
                    cultureBonus: 0.02,
                    militaryBonus: -0.03,
                    converters: [
                        { source: 'officials', sourceType: 'officialCount', ratio: 0.25, target: 'stability', targetType: 'bonus', cap: 4 },
                    ],
                },
                {
                    stability: 7,
                    categories: { civic: 0.08 },
                    scienceBonus: 0.04,
                    cultureBonus: 0.03,
                    militaryBonus: -0.03,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '紧急授权', buffId: 'republic_emergency_mandate', duration: 90, effects: { stability: 8, categories: { civic: 0.08 }, taxIncome: -0.02 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35,
                            normalBonus: { taxIncome: 0.02, cultureBonus: 0.02 },
                            flippedBonus: { stability: -4, production: -0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'nationalism',
        name: '民族主义',
        category: 'politics',
        icon: 'Flag',
        color: 'text-red-500',
        unlockEpoch: 5,
        desc: '民族是神圣的共同体，为民族利益可以牺牲一切。',
        lore: '法国大革命点燃了民族国家的烈火，从统一运动到反殖民斗争，民族主义重塑了世界版图。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minEpoch: 5 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.06,
                    stability: 4,
                    cultureBonus: -0.02,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.003, target: 'militaryPower' },
                    ],
                },
                {
                    militaryBonus: 0.08,
                    stability: 6,
                    categories: { industry: 0.03 },
                    maxPop: 0.02,
                    cultureBonus: -0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'militaryBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                },
                {
                    militaryBonus: 0.10,
                    stability: 8,
                    categories: { industry: 0.04 },
                    maxPop: 0.03,
                    cultureBonus: -0.03,
                    onEvents: [
{ event: 'on_war_start', effect: { action: 'addBuff', name: '保家卫国', buffId: 'defend_homeland', duration: 180, effects: { militaryBonus: 0.18, stability: 8 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar', normalBonus: { stability: -2, cultureBonus: -0.02 }, flippedBonus: { militaryBonus: 0.05, stability: 3 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'social_contract_ideology',
        name: '社会契约',
        category: 'politics',
        icon: 'FileText',
        color: 'text-red-200',
        unlockEpoch: 4,
        desc: '政府的正当性来自被治者的同意，公民与国家之间存在相互约束的契约。',
        lore: '霍布斯的利维坦、洛克的自然权利、卢梭的公意——社会契约论奠定了现代政治哲学的基础。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 5, categories: { civic: 0.04 }, production: -0.02 },
                {
                    stability: 7,
                    categories: { civic: 0.06 },
                    scienceBonus: 0.03,
                    production: -0.03,
                    converters: [
                        { source: 'officials', sourceType: 'officialCount', ratio: 0.30, target: 'stability', targetType: 'bonus', cap: 4 },
                    ],
                },
                {
                    stability: 9,
                    categories: { civic: 0.08 },
                    scienceBonus: 0.05,
                    cultureBonus: 0.03,
                    production: -0.03,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '宪政让步', buffId: 'constitutional_compromise', duration: 120, effects: { stability: 8, categories: { civic: 0.06 }, production: -0.02 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'resource_threshold', resource: 'culture', threshold: 300, bonus: { production: 0.03, stability: 2 } },
                    ],
                },
            ],
        },
    },

    // ============ 经济理念 (economy) ============
    {
        id: 'mercantilism',
        name: '重商主义',
        category: 'economy',
        icon: 'ShoppingCart',
        color: 'text-green-400',
        unlockEpoch: 3,
        desc: '国富的关键在于贸易顺差和贵金属积累，国家应积极干预贸易。',
        lore: '科尔贝尔的法国工业政策、英国航海条例——重商主义是近代早期欧洲列强的经济信条。',
        rarity: 'common',
        weightModifiers: [
            { condition: { stratum: 'merchant', minPop: 10 }, multiplier: 1.3 },
        ],
        effects: {
            levels: [
                {
                    taxIncome: 0.04,
                    categories: { gather: -0.03 },
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.01 } },
                    ],
                },
                {
                    taxIncome: 0.06,
                    categories: { industry: 0.03, gather: -0.04 },
                    maxPop: -0.02,
                    converters: [
                        { source: 'trade', sourceType: 'tradeVolume', ratio: 0.00015, target: 'taxIncome', targetType: 'bonus', cap: 0.35 },
                    ],
                },
                {
                    taxIncome: 0.08,
                    categories: { industry: 0.04, gather: -0.04 },
                    stability: 2,
                    maxPop: -0.02,
                    onEvents: [
{ event: 'on_trade_complete', effect: { action: 'addBuff', name: '关税整编', buffId: 'customs_drive', duration: 90, effects: { taxIncome: 0.08, stability: 3 } }, cooldownDays: 20 },
                        { event: 'on_treasury_milestone', effect: { action: 'addStability', amount: 6 }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35, normalBonus: { taxIncome: 0.02 }, flippedBonus: { stability: -4, taxIncome: -0.04 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'laissez_faire',
        name: '自由放任',
        category: 'economy',
        icon: 'TrendingUp',
        color: 'text-green-300',
        unlockEpoch: 5,
        desc: '政府应远离市场，看不见的手会引导经济走向最优配置。',
        lore: '亚当·斯密《国富论》开启的经济自由主义，成为工业革命时期英国崛起的理论武器。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { industry: 0.08 },
                    taxIncome: 0.04,
                    stability: -2,
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { categories: { industry: 0.03 } } },
                        { type: 'mutual_exclusion', conflictsWith: ['communism'], penalty: { production: -0.15, taxIncome: -0.10, stability: -10 }, bonusIfPure: { taxIncome: 0.03 } },
                    ],
                },
                {
                    categories: { industry: 0.10 },
                    taxIncome: 0.06,
                    production: 0.03,
                    stability: -3,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'taxIncome', targetType: 'bonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'price_volatility_mod', value: 0.12 },
                    ],
                },
                {
                    categories: { industry: 0.12 },
                    taxIncome: 0.08,
                    production: 0.04,
                    stability: -4,
                    onEvents: [
{ event: 'on_chain_complete', effect: { action: 'addBuff', name: '市场繁荣', buffId: 'market_boom', duration: 120, effects: { taxIncome: 0.12, production: 0.06 } }, cooldownDays: 45 },
                    ],
                    triggerEffects: [
                        { type: 'inverse_scaling', source: 'stability', threshold: 45, aboveBonus: {}, belowBonus: { production: -0.003, taxIncome: -0.003 }, cap: 0.35 },
                    ],
                },
            ],
        },
    },
    {
        id: 'physiocracy',
        name: '重农主义',
        category: 'economy',
        icon: 'Wheat',
        color: 'text-green-500',
        unlockEpoch: 3,
        desc: '土地是一切财富的唯一真正来源，农业是国民经济的根基。',
        lore: '魁奈的"经济表"、杜尔哥的自然秩序——重农学派是现代经济学的先驱。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { categories: { gather: 0.08, industry: -0.03 }, maxPop: 0.03 },
                { categories: { gather: 0.12, industry: -0.04 }, maxPop: 0.05, stability: 3, scienceBonus: -0.02 },
                { categories: { gather: 0.16, industry: -0.05 }, maxPop: 0.08, stability: 5, taxIncome: 0.03, scienceBonus: -0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.005 } } },
            ],
        },
    },
    {
        id: 'state_capitalism',
        name: '国家资本主义',
        category: 'economy',
        icon: 'Building',
        color: 'text-green-600',
        unlockEpoch: 6,
        desc: '国家以资本运营者的身份主导经济命脉，以国有企业驱动工业化。',
        lore: '从俾斯麦的国家社会主义到东亚发展型国家，国家资本主义是后发国家工业化的重要路径。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { industry: 0.08 },
                    production: 0.04,
                    taxIncome: 0.03,
                    cultureBonus: -0.03,
                    stability: -1,
                    triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 8, bonus: { production: 0.03 } },
                    ],
                },
                {
                    categories: { industry: 0.10 },
                    production: 0.06,
                    taxIncome: 0.05,
                    cultureBonus: -0.04,
                    stability: -1,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'production', targetType: 'bonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.10 },
                    ],
                },
                {
                    categories: { industry: 0.12 },
                    production: 0.08,
                    taxIncome: 0.06,
                    cultureBonus: -0.05,
                    stability: -3,
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '紧急统制', buffId: 'state_capital_emergency_control', duration: 120, effects: { production: 0.15, categories: { industry: 0.12 }, stability: -2 } }, cooldownDays: 60 },
{ event: 'on_epoch_advance', effect: { action: 'addBuff', name: '五年计划', buffId: 'five_year_plan', duration: 240, effects: { production: 0.18, categories: { industry: 0.12 }, taxIncome: 0.08 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 8,
                            bonus: { production: 0.03, categories: { industry: 0.02 } },
                            penaltyIfDrained: { production: -0.04, stability: -4 } },
                    ],
                },
            ],
        },
    },

    // ============ 军事理念 (military) ============
    {
        id: 'militarism',
        name: '军国主义',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 1,
        desc: '国家的首要目标是军事力量，一切资源都应服务于战争准备。',
        lore: '从斯巴达到普鲁士，从帝国日本到苏联——军国主义塑造了历史上最强大的战争机器。',
        rarity: 'common',
        weightModifiers: [
            { condition: { recentWar: true }, multiplier: 1.8 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.10,
                    stability: 2,
                    cultureBonus: -0.03,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'soldier', ratio: 0.01, target: 'militaryPower' },
                        { type: 'mutual_exclusion', conflictsWith: ['pacifism'], penalty: { militaryBonus: -0.10, stability: -10 }, bonusIfPure: { stability: 2 } },
                        { type: 'diminishing_returns', category: 'military', threshold: 1, perExtra: { militaryBonus: -0.02, stability: -1 } },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    stability: 4,
                    categories: { military: 0.04 },
                    cultureBonus: -0.04,
                    production: -0.02,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.015, target: 'militaryBonus', targetType: 'bonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.08 },
                    ],
                },
                {
                    militaryBonus: 0.15,
                    stability: 6,
                    categories: { military: 0.06 },
                    production: -0.03,
                    cultureBonus: -0.06,
                    maxPop: -0.02,
                    onEvents: [
{ event: 'on_war_victory', effect: { action: 'addBuff', name: '战争狂热', buffId: 'war_fervor', duration: 180, effects: { militaryBonus: 0.15, production: 0.06, stability: -3 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar', normalBonus: { stability: -3, taxIncome: -0.02 }, flippedBonus: { militaryBonus: 0.05, stability: 2 } },
                        { type: 'inverse_scaling', source: 'militaryBonus', threshold: 0.30, aboveBonus: { stability: -0.5 }, belowBonus: {}, cap: 8 },
                    ],
                },
            ],
        },
    },
    {
        id: 'pacifism',
        name: '和平主义',
        category: 'military',
        icon: 'Heart',
        color: 'text-orange-200',
        unlockEpoch: 3,
        desc: '暴力永远不是解决问题的答案，和平与对话才是文明的正途。',
        lore: '从阿育王的非暴力到甘地的不合作运动——和平主义证明了精神力量可以战胜钢铁。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { noPeacefulYears: 10 }, multiplier: 0.5 }, // 长期和平更容易出现
        ],
        effects: {
            levels: [
                // 和平主义初期：大幅降低军事、换取稳定和文化
                { stability: 6, cultureBonus: 0.05, militaryBonus: -0.10 },
                // 中期：和平红利带来科技发展
                { stability: 8, cultureBonus: 0.08, scienceBonus: 0.05, militaryBonus: -0.08 },
                // 成熟期：和平繁荣全面发展，但军事惩罚仍在
                { stability: 12, cultureBonus: 0.12, scienceBonus: 0.08, militaryBonus: -0.06, production: 0.05 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.01, stability: 1 } },
                // 与军国主义根本矛盾
                { type: 'mutual_exclusion', conflictsWith: ['militarism'],
                    penalty: { militaryBonus: -0.15, stability: -12 },
                    bonusIfPure: { cultureBonus: 0.03, stability: 3 } },
                // 条件翻转：和平时和平红利，战争时和平主义者拖后腿
                { type: 'conditional_flip', condition: 'isAtWar',
                    normalBonus: { cultureBonus: 0.03, stability: 3 },
                    flippedBonus: { stability: -5, militaryBonus: -0.05 } },
            ],
        },
    },
    {
        id: 'levee_en_masse',
        name: '全民皆兵',
        category: 'military',
        icon: 'Shield',
        color: 'text-orange-500',
        unlockEpoch: 2,
        desc: '每个公民都是潜在的士兵，国家有权在危急时刻动员全体民众。',
        lore: '法国大革命的全民征兵令创造了史上第一支真正的国民军，改变了战争的规模和性质。',
        rarity: 'common',
        weightModifiers: [
            { condition: { recentWar: true }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.05,
                    production: -0.02,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.01, target: 'militaryPower' },
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.005, target: 'militaryPower' },
                    ],
                },
                {
                    militaryBonus: 0.07,
                    stability: 2,
                    production: -0.03,
                    scienceBonus: -0.02,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00007, target: 'militaryBonus', targetType: 'bonus', cap: 0.40 },
                    ],
                },
                {
                    militaryBonus: 0.09,
                    stability: 3,
                    maxPop: -0.02,
                    production: -0.04,
                    scienceBonus: -0.02,
                    onEvents: [
{ event: 'on_war_start', effect: { action: 'addBuff', name: '全民动员', buffId: 'mass_conscription', duration: 120, effects: { militaryBonus: 0.15, stability: 6, production: -0.03 } }, cooldownDays: 60 },
{ event: 'on_battle_defeat', effect: { action: 'addBuff', name: '同仇敌忾', buffId: 'rally_defense', duration: 120, effects: { militaryBonus: 0.18, stability: 5 } }, cooldownDays: 30 },
                    ],
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00009, target: 'militaryBonus', targetType: 'bonus', cap: 0.50 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { production: -0.02, taxIncome: -0.02 },
                            flippedBonus: { militaryBonus: 0.04, stability: 2 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'sea_power',
        name: '海权论',
        category: 'military',
        icon: 'Anchor',
        color: 'text-orange-300',
        unlockEpoch: 4,
        desc: '谁控制了海洋，谁就控制了世界贸易，进而控制了世界本身。',
        lore: '马汉的《海权对历史的影响》深刻影响了大英帝国和美利坚海军的战略思想。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    taxIncome: 0.04,
                    militaryBonus: 0.04,
                    categories: { gather: -0.03 },
                    stability: -1,
                    triggerEffects: [
{ type: 'building_count_bonus', category: 'military', per: 6, bonus: { taxIncome: 0.025 } },
                    ],
                },
                {
                    taxIncome: 0.05,
                    militaryBonus: 0.06,
                    categories: { industry: 0.03, gather: -0.03 },
                    stability: -1,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.00008, target: 'taxIncome', targetType: 'bonus', cap: 0.35 },
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.012, target: 'militaryBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.08 },
                    ],
                },
                {
                    taxIncome: 0.06,
                    militaryBonus: 0.08,
                    categories: { industry: 0.04, gather: -0.04 },
                    production: 0.03,
                    stability: -2,
                    onEvents: [
{ event: 'on_treaty_sign', effect: { action: 'addBuff', name: '开放海路', buffId: 'open_sea_lanes', duration: 180, effects: { taxIncome: 0.12, production: 0.06, stability: 4 } }, cooldownDays: 60 },
{ event: 'on_war_start', effect: { action: 'addBuff', name: '海上封锁', buffId: 'naval_blockade', duration: 120, effects: { militaryBonus: 0.15, taxIncome: -0.03, stability: -2 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { taxIncome: 0.03, production: 0.02 },
                            flippedBonus: { militaryBonus: 0.05, taxIncome: -0.03 } },
                    ],
                },
            ],
        },
    },

    // ============ 美学理念 (aesthetics) ============
    {
        id: 'classicism',
        name: '古典主义',
        category: 'aesthetics',
        icon: 'Columns',
        color: 'text-pink-300',
        unlockEpoch: 2,
        desc: '美在于秩序、对称和节制，古代经典是一切艺术的最高范本。',
        lore: '帕特农神庙的完美比例、维吉尔的叙事诗——古典主义追求永恒不变的美的法则。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.08, stability: 3, scienceBonus: -0.02,
                    onEvents: [
{ event: 'on_build', effect: { action: 'addBuff', name: '古典秩序', buffId: 'classical_order', duration: 90, effects: { cultureBonus: 0.06, stability: 3 } }, cooldownDays: 15, condition: { category: 'civic' } },
                    ],
                },
                { cultureBonus: 0.12, stability: 5, categories: { civic: 0.03 }, scienceBonus: -0.03, production: -0.02,
                    onEvents: [
                        { event: 'on_build', effect: { action: 'addBuff', name: '公共美德', buffId: 'civic_virtue', duration: 90, effects: { cultureBonus: 0.08, stability: 4, categories: { civic: 0.05 } } }, cooldownDays: 15, condition: { category: 'civic' } },
                    ],
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.02, target: 'cultureBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                },
                { cultureBonus: 0.18, stability: 8, categories: { civic: 0.06 }, scienceBonus: -0.03, production: -0.02,
                    onEvents: [
                        { event: 'on_build', effect: { action: 'addBuff', name: '纪念性工程', buffId: 'monumental_craft', duration: 120, effects: { cultureBonus: 0.10, stability: 5, categories: { civic: 0.06 } } }, cooldownDays: 12, condition: { category: 'civic' } },
                        { event: 'on_year_end', effect: { action: 'addStability', amount: 4 }, cooldownDays: 30 },
                    ],
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.025, target: 'cultureBonus', targetType: 'bonus', cap: 0.55 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.10 },
                    ],
                },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'civic', per: 10, bonus: { cultureBonus: 0.05 } },
            ],
        },
    },
    {
        id: 'romanticism',
        name: '浪漫主义',
        category: 'aesthetics',
        icon: 'Feather',
        color: 'text-pink-400',
        unlockEpoch: 5,
        desc: '情感、直觉和个性是艺术的灵魂，理性的枷锁必须被打碎。',
        lore: '拜伦的诗篇、德拉克洛瓦的画笔、贝多芬的交响曲——浪漫主义是工业时代人性的呐喊。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.10, stability: -3,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '情感爆发', buffId: 'romantic_outburst', duration: 120, effects: { cultureBonus: 0.12, stability: 5 } }, cooldownDays: 45 },
                    ],
                },
                { cultureBonus: 0.15, scienceBonus: 0.03, stability: -3,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '痛苦诗潮', buffId: 'poetics_of_ruin', duration: 150, effects: { cultureBonus: 0.15, scienceBonus: 0.06, stability: 5 } }, cooldownDays: 45 },
                        { event: 'on_battle_defeat', effect: { action: 'addBuff', name: '悲壮叙事', buffId: 'tragic_narrative', duration: 60, effects: { cultureBonus: 0.08, militaryBonus: 0.03 } }, cooldownDays: 60 },
                    ],
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: -0.003, target: 'cultureBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                },
                { cultureBonus: 0.22, scienceBonus: 0.06, stability: -2, maxPop: 0.03,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '革命灵感', buffId: 'revolutionary_inspiration', duration: 180, effects: { cultureBonus: 0.18, scienceBonus: 0.08, stability: 6 } }, cooldownDays: 45 },
                        { event: 'on_battle_defeat', effect: { action: 'addBuff', name: '民族挽歌', buffId: 'national_elegy', duration: 75, effects: { cultureBonus: 0.10, militaryBonus: 0.04, stability: 2 } }, cooldownDays: 60 },
                        { event: 'on_rebellion_start', effect: { action: 'addBuff', name: '革命浪潮', buffId: 'romantic_revolt', duration: 60, effects: { cultureBonus: 0.15, scienceBonus: 0.05 } } },
                    ],
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: -0.004, target: 'cultureBonus', targetType: 'bonus', cap: 0.55 },
                    ],
                },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.015 } },
                // 逆向缩放：动荡中迸发文化创造力，安逸时文化停滞
                { type: 'inverse_scaling', source: 'stability', threshold: 50,
                    aboveBonus: { cultureBonus: -0.002 }, belowBonus: { cultureBonus: 0.003 }, cap: 0.45 },
                // 条件翻转：工业化前浪漫主义繁荣，进入工业时代后日渐过时
                { type: 'conditional_flip', condition: 'epoch_above', threshold: 5,
                    normalBonus: { cultureBonus: 0.02, stability: 2 },
                    flippedBonus: { cultureBonus: -0.02, scienceBonus: -0.02 } },
            ],
        },
    },
    {
        id: 'impressionism',
        name: '印象派',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-500',
        unlockEpoch: 6,
        desc: '捕捉光影的瞬间印象，打破学院派的陈规旧矩。',
        lore: '莫奈的日出、雷诺阿的舞会、梵高的星夜——印象派是现代艺术的黎明。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.12, stability: -2, production: -0.02 },
                { cultureBonus: 0.18, categories: { civic: 0.05 }, stability: -2, production: -0.03 },
                { cultureBonus: 0.25, categories: { civic: 0.08 }, stability: -2, production: -0.03 },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'civic', per: 5, bonus: { perPopPassive: { culture: 0.002 } } },
            ],
        },
    },

    // ============ 科学理念 (science) ============
    {
        id: 'empiricism',
        name: '经验主义',
        category: 'science',
        icon: 'Microscope',
        color: 'text-cyan-400',
        unlockEpoch: 3,
        desc: '一切知识都源于感官经验和实验观察，真理必须经得起检验。',
        lore: '培根的归纳法、洛克的白板说、休谟的因果怀疑——经验主义是现代科学方法的哲学基石。',
        rarity: 'common',
        weightModifiers: [
            { condition: { minTechs: 15 }, multiplier: 1.3 },
        ],
        effects: {
            levels: [
                { scienceBonus: 0.08, stability: -2,
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '实验笔记', buffId: 'experimental_notes', duration: 90, effects: { scienceBonus: 0.08 } }, cooldownDays: 15 },
                    ],
                },
                { scienceBonus: 0.12, categories: { gather: 0.03 }, stability: -2, cultureBonus: -0.02,
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '实证突破', buffId: 'empirical_breakthrough', duration: 120, effects: { scienceBonus: 0.10, categories: { gather: 0.05 } } }, cooldownDays: 15 },
                    ],
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.015, target: 'scienceBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                },
                { scienceBonus: 0.18, categories: { gather: 0.05 }, cultureBonus: -0.03, stability: -2,
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '观测范式', buffId: 'observational_paradigm', duration: 150, effects: { scienceBonus: 0.12, categories: { gather: 0.06 } } }, cooldownDays: 15 },
                        { event: 'on_season_change', effect: { action: 'addBuff', name: '田野观测', buffId: 'field_observation', duration: 90, effects: { scienceBonus: 0.06 } }, cooldownDays: 45 },
                    ],
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.02, target: 'scienceBonus', targetType: 'bonus', cap: 0.55 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.08 },
                    ],
                },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { scienceBonus: 0.001 } },
            ],
        },
    },
    {
        id: 'scientific_method',
        name: '科学方法',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-300',
        unlockEpoch: 4,
        desc: '假设、实验、验证——系统化的知识探索方法是人类最强大的工具。',
        lore: '伽利略的望远镜、牛顿的棱镜实验——科学方法论的确立开启了知识爆炸的新纪元。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    scienceBonus: 0.08,
                    production: 0.02,
                    stability: -1,
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { production: 0.0008 } },
                        { type: 'diminishing_returns', category: 'science', threshold: 1, perExtra: { scienceBonus: -0.03, cultureBonus: -0.02 } },
                    ],
                },
                {
                    scienceBonus: 0.10,
                    production: 0.04,
                    categories: { industry: 0.03 },
                    stability: -2,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.012, target: 'scienceBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.06 },
                    ],
                },
                {
                    scienceBonus: 0.12,
                    production: 0.05,
                    categories: { industry: 0.05 },
                    cultureBonus: -0.02,
                    stability: -2,
                    onEvents: [
{ event: 'on_epoch_advance', effect: { action: 'addBuff', name: '知识爆炸', buffId: 'knowledge_explosion', duration: 180, effects: { scienceBonus: 0.22, production: 0.08 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'culture', drainPerTick: 4, bonus: { scienceBonus: 0.03, production: 0.02 }, penaltyIfDrained: { scienceBonus: -0.04, stability: -2 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'tech_optimism',
        name: '技术乐观主义',
        category: 'science',
        icon: 'Rocket',
        color: 'text-cyan-500',
        unlockEpoch: 6,
        desc: '技术进步是解决一切问题的钥匙，未来必然比今天更好。',
        lore: '从蒸汽时代的世博会到硅谷的创业神话——技术乐观主义是现代化叙事的核心。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.08, categories: { industry: 0.05 }, cultureBonus: -0.02 },
                { scienceBonus: 0.12, categories: { industry: 0.08 }, production: 0.05, cultureBonus: -0.03 },
                { scienceBonus: 0.18, categories: { industry: 0.12 }, production: 0.08, stability: -3, cultureBonus: -0.05 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { production: 0.02, scienceBonus: 0.01 } },
            ],
        },
    },

    // ============ 社会理念 (social) ============
    {
        id: 'caste_system',
        name: '种姓制度',
        category: 'social',
        icon: 'Layers',
        color: 'text-purple-400',
        unlockEpoch: 0,
        desc: '社会各阶层各安其位，上下尊卑是神圣秩序的体现。',
        lore: '印度的瓦尔纳制度、日本的士农工商——严格的社会分层在多种文明中独立产生。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 5, production: 0.03, maxPop: -0.03, scienceBonus: -0.03 },
                { stability: 8, production: 0.05, categories: { gather: 0.03 }, maxPop: -0.03, scienceBonus: -0.04 },
                { stability: 12, production: 0.08, categories: { gather: 0.06 }, maxPop: -0.02, cultureBonus: -0.05, scienceBonus: -0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.003 } } },
                // 与平等主义根本矛盾：等级制度与平等理想的碰撞撕裂社会
                { type: 'mutual_exclusion', conflictsWith: ['egalitarianism'],
                    penalty: { stability: -15, maxPop: -0.05 },
                    bonusIfPure: { stability: 3, production: 0.02 } },
            ],
        },
    },
    {
        id: 'egalitarianism',
        name: '平等主义',
        category: 'social',
        icon: 'Equal',
        color: 'text-purple-300',
        unlockEpoch: 4,
        desc: '所有人生而平等，社会不应人为制造不平等的壁垒。',
        lore: '从法国人权宣言到废奴运动到普选权——平等主义是现代民主社会的道德基石。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 4,
                    maxPop: 0.03,
                    cultureBonus: 0.02,
                    production: -0.02,
                    triggerEffects: [
                        { type: 'mutual_exclusion', conflictsWith: ['caste_system'],
                            penalty: { stability: -15, maxPop: -0.05 },
                            bonusIfPure: { maxPop: 0.03, cultureBonus: 0.02 } },
                        { type: 'diminishing_returns', category: 'social', threshold: 1,
                            perExtra: { stability: -2, production: -0.02 } },
                    ],
                },
                {
                    stability: 6,
                    maxPop: 0.05,
                    cultureBonus: 0.03,
                    scienceBonus: 0.02,
                    production: -0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00008, target: 'maxPop', targetType: 'bonus', cap: 0.35 },
                    ],
                    triggerEffects: [
                        { type: 'resource_threshold', resource: 'culture', threshold: 1000, bonus: { maxPop: 0.04, stability: 4 } },
                    ],
                },
                {
                    stability: 8,
                    maxPop: 0.06,
                    cultureBonus: 0.05,
                    scienceBonus: 0.03,
                    production: -0.03,
                    taxIncome: -0.02,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '平权改革', buffId: 'egalitarian_relief_program', duration: 120, effects: { stability: 8, maxPop: 0.06, cultureBonus: 0.06, taxIncome: -0.02 } }, cooldownDays: 60 },
{ event: 'on_pop_milestone', effect: { action: 'addBuff', name: '全民团结', buffId: 'peoples_unity', duration: 180, effects: { stability: 12, maxPop: 0.08, cultureBonus: 0.05 } }, cooldownDays: 60 },
                    ],
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0001, target: 'maxPop', targetType: 'bonus', cap: 0.45 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35,
                            normalBonus: { cultureBonus: 0.02, maxPop: 0.02 },
                            flippedBonus: { stability: -5, production: -0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'elitism',
        name: '精英主义',
        category: 'social',
        icon: 'GraduationCap',
        color: 'text-purple-500',
        unlockEpoch: 2,
        desc: '少数精英天生就比多数人更适合治理和创造，精英统治是效率的保障。',
        lore: '柏拉图的哲人王、马基雅维利的君主论——精英主义贯穿了整个政治哲学史。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.05, taxIncome: 0.03, maxPop: -0.02, stability: -2 },
                { scienceBonus: 0.08, taxIncome: 0.05, categories: { industry: 0.03 }, maxPop: -0.02, stability: -3 },
                { scienceBonus: 0.12, taxIncome: 0.08, categories: { industry: 0.06 }, maxPop: -0.02, stability: -5 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'landowner', bonus: { perPopPassive: { silver: 0.02 } } },
                // 资源消耗：精英阶层的特权和奢靡开销需要银币维持
                { type: 'resource_drain', resource: 'silver', drainPerTick: 6,
                    bonus: { scienceBonus: 0.03, taxIncome: 0.02 },
                    penaltyIfDrained: { stability: -5, taxIncome: -0.03 } },
            ],
        },
    },
    {
        id: 'civic_society',
        name: '公民社会',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-200',
        unlockEpoch: 5,
        desc: '介于国家与个人之间的公民组织是自由社会的基石。',
        lore: '托克维尔观察美国的结社传统、市民社会理论——公民社会是民主运行的润滑剂。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 5, categories: { civic: 0.05 }, cultureBonus: 0.03, militaryBonus: -0.02, approval: { artisan: 4, merchant: 4 } },
                { stability: 8, categories: { civic: 0.08 }, cultureBonus: 0.05, scienceBonus: 0.03, militaryBonus: -0.03, production: -0.02, approval: { artisan: 6, merchant: 6 }, organizationGrowthMod: -0.08 },
                { stability: 12, categories: { civic: 0.12 }, cultureBonus: 0.08, scienceBonus: 0.05, maxPop: 0.03, militaryBonus: -0.03, production: -0.02, approval: { artisan: 8, merchant: 8, worker: 4 }, organizationGrowthMod: -0.12 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { culture: 0.005 } } },
                // 资源消耗：公民组织和NGO的运作需要持续的银币投入
                { type: 'resource_drain', resource: 'silver', drainPerTick: 4,
                    bonus: { stability: 3, cultureBonus: 0.02 },
                    penaltyIfDrained: { stability: -3, cultureBonus: -0.02 } },
            ],
        },
    },

    // ============ 扩充理念：神学 (theology) ============
    {
        id: 'shamanism',
        name: '萨满信仰',
        category: 'theology',
        icon: 'TreePine',
        color: 'text-yellow-200',
        unlockEpoch: 0,
        desc: '通灵者沟通人与自然之灵，万物有灵的世界观引导部落走向繁荣。',
        lore: '从西伯利亚冻原到亚马逊雨林，萨满信仰是人类最古老的精神传统之一。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { categories: { gather: 0.06, industry: -0.03 }, stability: 3 },
                { categories: { gather: 0.10, industry: -0.04 }, stability: 5, cultureBonus: 0.03 },
                { categories: { gather: 0.14, industry: -0.05 }, stability: 8, cultureBonus: 0.05, maxPop: 0.02 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { categories: { gather: 0.01 } } },
            ],
        },
    },
    {
        id: 'mysticism',
        name: '神秘主义',
        category: 'theology',
        icon: 'Moon',
        color: 'text-yellow-600',
        unlockEpoch: 1,
        desc: '通过冥想与修行达到与神圣的直接合一，超越理性的体验是最高真理。',
        lore: '苏菲派的旋转、卡巴拉的生命之树、禅宗的顿悟——神秘体验跨越了一切教义边界。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.06, stability: 5, production: -0.02 },
                { cultureBonus: 0.10, stability: 8, scienceBonus: 0.03, production: -0.03, taxIncome: -0.02 },
                { cultureBonus: 0.15, stability: 12, scienceBonus: 0.05, maxPop: 0.03, production: -0.03, taxIncome: -0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'cleric', bonus: { perPopPassive: { science: 0.01 } } },
            ],
        },
    },

    // ============ 扩充理念：哲学 (philosophy) ============
    {
        id: 'stoicism',
        name: '斯多葛主义',
        category: 'philosophy',
        icon: 'Mountain',
        color: 'text-indigo-200',
        unlockEpoch: 2,
        desc: '内心的平静是唯一真正的善，外在的得失不值得扰乱灵魂。',
        lore: '塞涅卡的书信、爱比克泰德的手册、马可·奥勒留的沉思录——斯多葛哲学是罗马精英的精神支柱。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 6, production: 0.03, taxIncome: -0.02 },
                { stability: 10, production: 0.05, cultureBonus: 0.03, taxIncome: -0.03 },
                { stability: 14, production: 0.08, cultureBonus: 0.05, militaryBonus: 0.03, taxIncome: -0.03 },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'culture', threshold: 200, bonus: { stability: 5 } },
            ],
        },
    },
    {
        id: 'confucianism',
        name: '儒家思想',
        category: 'philosophy',
        icon: 'BookOpen',
        color: 'text-indigo-300',
        unlockEpoch: 1,
        desc: '仁义礼智信为本，修身齐家治国平天下。',
        lore: '孔子的仁学、孟子的性善论、朱熹的理学——儒家思想塑造了东亚文明两千年。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 7,
                    categories: { civic: 0.04, industry: -0.03 },
                    militaryBonus: -0.02,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'official', bonus: { perPopPassive: { culture: 0.02 } } },
                    ],
                },
                {
                    stability: 9,
                    categories: { civic: 0.06, industry: -0.03 },
                    cultureBonus: 0.04,
                    militaryBonus: -0.03,
                    converters: [
                        { source: 'official', sourceType: 'officialCount', ratio: 0.025, target: 'cultureBonus', targetType: 'bonus', cap: 0.35 },
                        { source: 'officials', sourceType: 'officialCount', ratio: 0.25, target: 'stability', targetType: 'bonus', cap: 4 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.08 },
                    ],
                },
                {
                    stability: 10,
                    categories: { civic: 0.08, industry: -0.04 },
                    cultureBonus: 0.05,
                    scienceBonus: 0.03,
                    militaryBonus: -0.03,
                    onEvents: [
                        { event: 'on_hire_official', effect: { action: 'addBuff', name: '礼制整饬', buffId: 'ritual_order', duration: 45, effects: { stability: 4, cultureBonus: 0.04, categories: { civic: 0.03 } } }, cooldownDays: 30 },
                        { event: 'on_stability_high', effect: { action: 'addBuff', name: '文教昌明', buffId: 'scholarly_flourishing', duration: 180, effects: { scienceBonus: 0.10, cultureBonus: 0.08 } }, cooldownDays: 60 },
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '礼崩乐坏', buffId: 'rites_in_repair', duration: 90, effects: { stability: 8, categories: { civic: 0.06 }, production: -0.02 } }, cooldownDays: 60 },
                    ],
                    converters: [
                        { source: 'official', sourceType: 'officialCount', ratio: 0.03, target: 'cultureBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                    triggerEffects: [
                        { type: 'inverse_scaling', source: 'stability', threshold: 50,
                            aboveBonus: { cultureBonus: 0.002 }, belowBonus: { cultureBonus: -0.002, stability: -0.3 }, cap: 0.35 },
                        { type: 'resource_drain', resource: 'culture', drainPerTick: 3,
                            bonus: { stability: 3, categories: { civic: 0.02 } },
                            penaltyIfDrained: { stability: -4, cultureBonus: -0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'legalism',
        name: '法家思想',
        category: 'philosophy',
        icon: 'Gavel',
        color: 'text-indigo-500',
        unlockEpoch: 1,
        desc: '法令明确、赏罚分明，以法治国是强盛之道。',
        lore: '商鞅变法、韩非子的帝王术——法家思想缔造了秦帝国的统一霸业。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 5, production: 0.06, cultureBonus: -0.03, maxPop: -0.02 },
                { stability: 8, production: 0.10, categories: { industry: 0.03 }, cultureBonus: -0.03, maxPop: -0.03 },
                { stability: 12, production: 0.14, categories: { industry: 0.06 }, militaryBonus: 0.05, cultureBonus: -0.02, maxPop: -0.03 },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 5, bonus: { stability: 1.5 } },
            ],
        },
    },
    {
        id: 'pragmatism',
        name: '实用主义',
        category: 'philosophy',
        icon: 'Wrench',
        color: 'text-indigo-400',
        unlockEpoch: 5,
        desc: '真理的检验标准是实际效果，任何理论都应为行动服务。',
        lore: '皮尔斯的意义理论、詹姆斯的真理观、杜威的工具主义——实用主义是美国精神的哲学表达。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minTechs: 15 }, multiplier: 1.3 },
        ],
        effects: {
            levels: [
                { production: 0.06, scienceBonus: 0.05, cultureBonus: -0.03 },
                { production: 0.10, scienceBonus: 0.08, categories: { industry: 0.03 }, cultureBonus: -0.04, stability: -2 },
                { production: 0.14, scienceBonus: 0.12, categories: { industry: 0.06 }, taxIncome: 0.03, cultureBonus: -0.05, stability: -2 },
            ],
            triggerEffects: [
                { type: 'chain_count_bonus', countType: 'complete', perCount: { production: 0.02 } },
            ],
        },
    },

    // ============ 扩充理念：政治 (politics) ============
    {
        id: 'feudalism_ideology',
        name: '封建主义',
        category: 'politics',
        icon: 'Castle',
        color: 'text-red-300',
        unlockEpoch: 2,
        desc: '层层分封、等级分明的土地制度是社会秩序的基础。',
        lore: '从西欧的采邑制到日本的幕藩体制，封建制度在不同文明中独立产生。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 8, categories: { gather: 0.05 }, scienceBonus: -0.03 },
                { stability: 12, categories: { gather: 0.08 }, taxIncome: 0.03, scienceBonus: -0.04, maxPop: -0.02 },
                { stability: 12, categories: { gather: 0.12 }, taxIncome: 0.05, militaryBonus: 0.03, scienceBonus: -0.05, maxPop: -0.02 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'landowner', bonus: { perPopPassive: { silver: 0.01 } } },
                // 条件翻转：封建制度在早期时代稳固，进入现代后日渐落伍
                { type: 'conditional_flip', condition: 'epoch_above', threshold: 4,
                    normalBonus: { stability: 3, categories: { gather: 0.02 } },
                    flippedBonus: { stability: -4, scienceBonus: -0.03 } },
            ],
        },
    },
    {
        id: 'anarchism',
        name: '无政府主义',
        category: 'politics',
        icon: 'CircleOff',
        color: 'text-red-600',
        unlockEpoch: 6,
        desc: '一切形式的统治都是压迫，真正的自由只存在于无政府状态。',
        lore: '蒲鲁东的"财产就是盗窃"、巴枯宁的革命理想——无政府主义是对现代国家最激进的挑战。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { stabilityBelow: 25 }, multiplier: 2.0 },
        ],
        effects: {
            levels: [
                { stability: -10, cultureBonus: 0.08, production: 0.05 },
                { stability: -10, cultureBonus: 0.12, production: 0.08, scienceBonus: 0.05 },
                { stability: -8, cultureBonus: 0.18, production: 0.12, scienceBonus: 0.08, maxPop: 0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { culture: 0.003 } } },
                // 逆向缩放：混乱中迸发创造力，稳定反而窒息无政府社区
                { type: 'inverse_scaling', source: 'stability', threshold: 30,
                    aboveBonus: { production: -0.002 }, belowBonus: { production: 0.003, cultureBonus: 0.002 }, cap: 0.55 },
            ],
        },
    },
    {
        id: 'imperialism',
        name: '帝国主义',
        category: 'politics',
        icon: 'Globe',
        color: 'text-red-500',
        unlockEpoch: 5,
        desc: '强大的国家天然有权支配弱小，扩张是文明传播的使命。',
        lore: '从罗马的万邦归一到维多利亚时代的"白人的负担"——帝国主义重塑了全球权力格局。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minEpoch: 5 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.07,
                    taxIncome: 0.04,
                    stability: -3,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'soldier', ratio: 0.008, target: 'militaryPower' },
                    ],
                },
                {
                    militaryBonus: 0.09,
                    taxIncome: 0.05,
                    categories: { military: 0.03 },
                    stability: -4,
                    maxPop: -0.02,
                    converters: [
                        { source: 'vassals', sourceType: 'vassalCount', ratio: 0.035, target: 'taxIncome', targetType: 'bonus', cap: 0.35 },
                    ],
                },
                {
                    militaryBonus: 0.10,
                    taxIncome: 0.06,
                    categories: { military: 0.04 },
                    stability: -4,
                    maxPop: -0.03,
                    onEvents: [
{ event: 'on_war_victory', effect: { action: 'addBuff', name: '殖民贡赋', buffId: 'colonial_tribute', duration: 180, effects: { taxIncome: 0.12, militaryBonus: 0.06 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35, normalBonus: { taxIncome: 0.02, militaryBonus: 0.02 }, flippedBonus: { stability: -6, taxIncome: -0.05 } },
                    ],
                },
            ],
        },
    },

    // ============ 扩充理念：经济 (economy) ============
    {
        id: 'communism',
        name: '共产主义',
        category: 'economy',
        icon: 'Factory',
        color: 'text-green-600',
        unlockEpoch: 6,
        desc: '生产资料公有化，按需分配，消灭阶级压迫。',
        lore: '马克思的《资本论》、列宁的十月革命——共产主义改变了20世纪的世界格局。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { minEpoch: 6 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    production: 0.08,
                    maxPop: 0.04,
                    taxIncome: -0.04,
                    scienceBonus: -0.02,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.002 } } },
                        { type: 'mutual_exclusion', conflictsWith: ['laissez_faire'], penalty: { production: -0.15, taxIncome: -0.10, stability: -10 }, bonusIfPure: { production: 0.03 } },
                        { type: 'diminishing_returns', category: 'economy', threshold: 1, perExtra: { production: -0.02, taxIncome: -0.02 } },
                    ],
                },
                {
                    production: 0.10,
                    maxPop: 0.06,
                    stability: -2,
                    taxIncome: -0.03,
                    categories: { industry: 0.05 },
                    scienceBonus: -0.03,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'production', targetType: 'bonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.12 },
                    ],
                },
                {
                    production: 0.12,
                    maxPop: 0.08,
                    stability: -1,
                    categories: { industry: 0.08 },
                    militaryBonus: 0.04,
                    scienceBonus: -0.03,
                    onEvents: [
{ event: 'on_epoch_advance', effect: { action: 'addBuff', name: '工业化运动', buffId: 'industrialization', duration: 240, effects: { production: 0.18, categories: { industry: 0.12 } } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 65, normalBonus: { production: 0.03, militaryBonus: 0.02 }, flippedBonus: { production: -0.03, scienceBonus: -0.02 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'guild_economy',
        name: '行会制度',
        category: 'economy',
        icon: 'Hammer',
        color: 'text-green-300',
        unlockEpoch: 2,
        desc: '工匠联合自治，维护行业标准和成员利益。',
        lore: '中世纪欧洲的行会制度规范了技艺传承，保护了工匠阶层的利益和城市的繁荣。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { categories: { industry: 0.05 }, stability: 3, scienceBonus: -0.02 },
                { categories: { industry: 0.08 }, stability: 5, production: 0.03, scienceBonus: -0.03, maxPop: -0.02 },
                { categories: { industry: 0.12 }, stability: 8, production: 0.05, cultureBonus: 0.03, scienceBonus: -0.03, maxPop: -0.02 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'artisan', bonus: { perPopPassive: { silver: 0.01 } } },
            ],
        },
    },
    {
        id: 'welfare_state',
        name: '福利国家',
        category: 'economy',
        icon: 'HeartHandshake',
        color: 'text-green-400',
        unlockEpoch: 7,
        desc: '国家有责任保障每个公民的基本生活水平和社会福利。',
        lore: '从俾斯麦的社会保险到北欧模式——福利国家是资本主义社会对公平诉求的回应。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 6, maxPop: 0.04, taxIncome: -0.05, production: -0.03 },
                {
                    stability: 8,
                    maxPop: 0.05,
                    cultureBonus: 0.03,
                    taxIncome: -0.04,
                    production: -0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.004, target: 'stability', targetType: 'bonus', cap: 4 },
                    ],
                },
                {
                    stability: 10,
                    maxPop: 0.07,
                    cultureBonus: 0.05,
                    scienceBonus: 0.03,
                    taxIncome: -0.03,
                    production: -0.04,
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '紧急救济', buffId: 'emergency_relief', duration: 120, effects: { stability: 8, maxPop: 0.06, production: -0.02 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 6, bonus: { stability: 3, maxPop: 0.02 }, penaltyIfDrained: { stability: -5, production: -0.03 } },
                    ],
                },
            ],
        },
    },

    // ============ 扩充理念：军事 (military) ============
    {
        id: 'guerrilla_warfare',
        name: '游击战术',
        category: 'military',
        icon: 'TreePine',
        color: 'text-orange-400',
        unlockEpoch: 3,
        desc: '以弱胜强，避实击虚，在运动中消灭敌人。',
        lore: '从西班牙抵抗拿破仑到毛泽东的人民战争——游击战术是弱者的终极武器。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { stabilityBelow: 40 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                { militaryBonus: 0.06, stability: 3, categories: { industry: -0.03 } },
                { militaryBonus: 0.10, stability: 5, categories: { gather: 0.03, industry: -0.04 }, taxIncome: -0.02 },
                { militaryBonus: 0.15, stability: 8, categories: { gather: 0.05, industry: -0.05 }, maxPop: 0.03, taxIncome: -0.03 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.008, target: 'militaryPower' },
            ],
        },
    },
    {
        id: 'professional_army',
        name: '职业军队',
        category: 'military',
        icon: 'BadgeCheck',
        color: 'text-orange-500',
        unlockEpoch: 4,
        desc: '精锐的职业化军队比临时征召的农民兵更有战斗力。',
        lore: '从罗马军团到瑞典的常备军制度——职业军队是军事现代化的关键一步。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    militaryBonus: 0.08,
                    taxIncome: -0.02,
                    maxPop: -0.01,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'soldier', bonus: { perPopPassive: { silver: 0.005 } } },
                        { type: 'diminishing_returns', category: 'military', threshold: 1,
                            perExtra: { taxIncome: -0.03, production: -0.02 } },
                    ],
                },
                {
                    militaryBonus: 0.10,
                    categories: { military: 0.04 },
                    stability: 2,
                    taxIncome: -0.03,
                    maxPop: -0.02,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.015, target: 'militaryBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.08 },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    categories: { military: 0.05 },
                    stability: 3,
                    taxIncome: -0.04,
                    maxPop: -0.02,
                    onEvents: [
{ event: 'on_battle_defeat', effect: { action: 'addBuff', name: '老兵整军', buffId: 'veteran_reorganization', duration: 90, effects: { militaryBonus: 0.15, stability: 6, taxIncome: -0.02 } }, cooldownDays: 45 },
{ event: 'on_war_start', effect: { action: 'addBuff', name: '战备扩编', buffId: 'professional_mobilization', duration: 120, effects: { militaryBonus: 0.12, production: -0.02 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 6,
                            bonus: { militaryBonus: 0.03, stability: 2 },
                            penaltyIfDrained: { militaryBonus: -0.05, stability: -4 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'total_war',
        name: '总体战',
        category: 'military',
        icon: 'Flame',
        color: 'text-orange-600',
        unlockEpoch: 6,
        desc: '战争不只是军队的事，整个社会都必须为胜利动员起来。',
        lore: '两次世界大战彻底改变了战争的概念——前线与后方的界限消失了。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { recentWar: true }, multiplier: 2.0 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.10,
                    categories: { industry: 0.04 },
                    stability: -5,
                    cultureBonus: -0.04,
                    triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 8, bonus: { militaryBonus: 0.04 } },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    categories: { industry: 0.06 },
                    stability: -5,
                    cultureBonus: -0.04,
                    production: 0.04,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'militaryBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.12 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.06 },
                    ],
                },
                {
                    militaryBonus: 0.15,
                    categories: { industry: 0.08 },
                    stability: -6,
                    cultureBonus: -0.05,
                    production: 0.06,
                    onEvents: [
{ event: 'on_war_start', effect: { action: 'addBuff', name: '全面动员令', buffId: 'total_mobilization', duration: 180, effects: { militaryBonus: 0.25, production: 0.18, stability: -6 } }, cooldownDays: 60 },
{ event: 'on_war_victory', effect: { action: 'addBuff', name: '胜利红利', buffId: 'victory_dividend', duration: 240, effects: { taxIncome: 0.15, production: 0.12, stability: 8 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { stability: -4, production: -0.03, taxIncome: -0.03 },
                            flippedBonus: { militaryBonus: 0.05, production: 0.04 } },
                    ],
                },
            ],
        },
    },

    // ============ 扩充理念：美学 (aesthetics) ============
    {
        id: 'baroque',
        name: '巴洛克',
        category: 'aesthetics',
        icon: 'Gem',
        color: 'text-pink-300',
        unlockEpoch: 3,
        desc: '富丽堂皇、动态夸张的艺术风格，是权力与信仰的视觉宣言。',
        lore: '圣彼得大教堂的穹顶、凡尔赛宫的镜厅——巴洛克是绝对主义时代的美学语言。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.08, taxIncome: -0.03 },
                { cultureBonus: 0.12, stability: 3, taxIncome: -0.03 },
                { cultureBonus: 0.18, stability: 5, categories: { civic: 0.05 }, taxIncome: -0.02 },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'civic', per: 5, bonus: { cultureBonus: 0.04 } },
                // 资源消耗：巴洛克的奢华需要持续的金钱投入
                { type: 'resource_drain', resource: 'silver', drainPerTick: 5,
                    bonus: { cultureBonus: 0.04, stability: 2 },
                    penaltyIfDrained: { cultureBonus: -0.03, stability: -3 } },
            ],
        },
    },
    {
        id: 'avant_garde',
        name: '先锋派',
        category: 'aesthetics',
        icon: 'Zap',
        color: 'text-pink-500',
        unlockEpoch: 7,
        desc: '打破一切旧有规则，艺术必须永远走在时代前面。',
        lore: '从达达主义到超现实主义，从包豪斯到朋克——先锋派的精神是永恒的反叛。',
        rarity: 'rare',
        weightModifiers: [
            { condition: { minEpoch: 7 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                { cultureBonus: 0.12, scienceBonus: 0.05, stability: -5, taxIncome: -0.02 },
                { cultureBonus: 0.18, scienceBonus: 0.08, stability: -3, production: 0.03, taxIncome: -0.03 },
                { cultureBonus: 0.25, scienceBonus: 0.12, stability: -2, production: 0.05, maxPop: 0.03, taxIncome: -0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.02 } },
                // 资源消耗：先锋艺术运动需要持续的文化投入来维系
                { type: 'resource_drain', resource: 'culture', drainPerTick: 4,
                    bonus: { scienceBonus: 0.03, cultureBonus: 0.03 },
                    penaltyIfDrained: { cultureBonus: -0.04, stability: -2 } },
            ],
        },
    },
    {
        id: 'folk_tradition',
        name: '民间传统',
        category: 'aesthetics',
        icon: 'Music',
        color: 'text-pink-200',
        unlockEpoch: 0,
        desc: '代代相传的歌谣、舞蹈和手工艺是民族灵魂的载体。',
        lore: '从中国的春节到巴西的狂欢节，民间传统是文化认同的根基。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.05, stability: 5, scienceBonus: -0.02 },
                { cultureBonus: 0.08, stability: 8, maxPop: 0.02, scienceBonus: -0.03, categories: { industry: -0.02 } },
                { cultureBonus: 0.12, stability: 12, maxPop: 0.04, categories: { gather: 0.03, industry: -0.03 }, scienceBonus: -0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { stability: 0.5 } },
            ],
        },
    },

    // ============ 扩充理念：科学 (science) ============
    {
        id: 'positivism',
        name: '实证主义',
        category: 'science',
        icon: 'BarChart',
        color: 'text-cyan-300',
        unlockEpoch: 5,
        desc: '只有可观察、可验证的知识才是真正的知识。',
        lore: '孔德的三阶段法则开启了社会科学的实证化，维也纳学派将逻辑实证推向极致。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.10, cultureBonus: -0.03, stability: -2 },
                { scienceBonus: 0.15, production: 0.03, cultureBonus: -0.02, stability: -2 },
                { scienceBonus: 0.22, production: 0.06, categories: { industry: 0.05 }, stability: -2 },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { production: 0.0015 } },
            ],
        },
    },
    {
        id: 'natural_philosophy',
        name: '自然哲学',
        category: 'science',
        icon: 'Leaf',
        color: 'text-cyan-400',
        unlockEpoch: 1,
        desc: '观察自然万物的运行规律是一切智慧的起点。',
        lore: '从亚里士多德到牛顿，自然哲学是现代科学的前身，奠定了人类探索宇宙的基石。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.05, categories: { gather: 0.03 }, militaryBonus: -0.02 },
                { scienceBonus: 0.08, categories: { gather: 0.05 }, cultureBonus: 0.03, militaryBonus: -0.02 },
                { scienceBonus: 0.12, categories: { gather: 0.08 }, cultureBonus: 0.05, stability: 3, militaryBonus: -0.02 },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { scienceBonus: 0.0008 } },
            ],
        },
    },
    {
        id: 'mechanization',
        name: '机械化思维',
        category: 'science',
        icon: 'Cog',
        color: 'text-cyan-500',
        unlockEpoch: 5,
        desc: '宇宙是一台精密的机器，一切都可以用力学原理解释。',
        lore: '从牛顿的万有引力到拉普拉斯的决定论——机械论世界观主导了启蒙时代的科学思想。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { categories: { industry: 0.08 }, scienceBonus: 0.05, cultureBonus: -0.03 },
                { categories: { industry: 0.12 }, scienceBonus: 0.08, production: 0.03, cultureBonus: -0.04 },
                { categories: { industry: 0.16 }, scienceBonus: 0.12, production: 0.06, stability: -3, cultureBonus: -0.05, maxPop: -0.02 },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 10, bonus: { scienceBonus: 0.05 } },
            ],
        },
    },

    // ============ 扩充理念：社会 (social) ============
    {
        id: 'collectivism',
        name: '集体主义',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 3,
        desc: '集体利益高于个人利益，团结协作是社会繁荣的保证。',
        lore: '从古代的公社到现代的合作社运动——集体主义在东西方文明中都有深厚根基。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 8, production: 0.05, cultureBonus: -0.02, scienceBonus: -0.02 },
                { stability: 12, production: 0.08, maxPop: 0.03, cultureBonus: -0.02, scienceBonus: -0.03 },
                { stability: 12, production: 0.12, maxPop: 0.05, militaryBonus: 0.03, scienceBonus: -0.03 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.003, target: 'militaryPower' },
                // 与个人主义根本矛盾
                { type: 'mutual_exclusion', conflictsWith: ['individualism'],
                    penalty: { stability: -10, production: -0.05 },
                    bonusIfPure: { production: 0.03, stability: 3 } },
            ],
        },
    },
    {
        id: 'individualism',
        name: '个人主义',
        category: 'social',
        icon: 'UserCheck',
        color: 'text-purple-300',
        unlockEpoch: 4,
        desc: '个人自由和权利是不可侵犯的，社会应服务于个人而非相反。',
        lore: '从洛克的自然权利到美国独立宣言——个人主义是自由主义文明的灵魂。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.05, taxIncome: 0.05, stability: -3, militaryBonus: -0.03 },
                { scienceBonus: 0.08, taxIncome: 0.08, cultureBonus: 0.03, stability: -3, militaryBonus: -0.04 },
                { scienceBonus: 0.12, taxIncome: 0.12, cultureBonus: 0.05, production: 0.03, stability: -2, militaryBonus: -0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { silver: 0.015 } } },
                // 社会理念过多的递减收益：个人主义在集体化社会中受压制
                { type: 'diminishing_returns', category: 'social', threshold: 1,
                    perExtra: { taxIncome: -0.02, stability: -2 } },
                // 与集体主义根本矛盾
                { type: 'mutual_exclusion', conflictsWith: ['collectivism'],
                    penalty: { stability: -10, production: -0.05 },
                    bonusIfPure: { scienceBonus: 0.02, taxIncome: 0.02 } },
                // 资源消耗：个人主义催生消费社会，需要银币维持消费活力
                { type: 'resource_drain', resource: 'silver', drainPerTick: 5,
                    bonus: { scienceBonus: 0.02, taxIncome: 0.03 },
                    penaltyIfDrained: { stability: -3, taxIncome: -0.03 } },
            ],
        },
    },
    {
        id: 'meritocracy',
        name: '贤能主义',
        category: 'social',
        icon: 'Award',
        color: 'text-purple-500',
        unlockEpoch: 2,
        desc: '官位和权力应基于才能和功绩分配，而非出身和世袭。',
        lore: '中国的科举制度是人类历史上第一个系统化的贤能选拔制度，深刻影响了全球治理理念。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    scienceBonus: 0.04,
                    stability: 4,
                    cultureBonus: -0.01,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'official', bonus: { perPopPassive: { science: 0.01 } } },
                    ],
                },
                {
                    scienceBonus: 0.06,
                    stability: 6,
                    categories: { civic: 0.03 },
                    cultureBonus: -0.02,
                    converters: [
                        { source: 'officials', sourceType: 'officialCount', ratio: 0.02, target: 'scienceBonus', targetType: 'bonus', cap: 0.30 },
                    ],
                },
                {
                    scienceBonus: 0.08,
                    stability: 8,
                    categories: { civic: 0.05 },
                    production: 0.03,
                    cultureBonus: -0.02,
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '吏治整顿', buffId: 'meritocratic_reform_drive', duration: 120, effects: { stability: 8, categories: { civic: 0.06 }, scienceBonus: 0.06 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35,
                            normalBonus: { scienceBonus: 0.02 },
                            flippedBonus: { stability: -4, scienceBonus: -0.03 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'labor_movement',
        name: '工人运动',
        category: 'social',
        icon: 'Pickaxe',
        color: 'text-purple-600',
        unlockEpoch: 6,
        desc: '劳动者团结起来，为工时、工资和尊严而斗争。',
        lore: '从英国宪章运动到国际工人协会——工人运动彻底改变了资本主义社会的面貌。',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minEpoch: 5 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                // 工人运动初期：带来动荡但提升产出
                { maxPop: 0.05, stability: -5, production: 0.05, taxIncome: -0.03 },
                // 中期：工人权益保障带来工业效率提升
                { maxPop: 0.08, stability: -3, production: 0.08, categories: { industry: 0.05 }, taxIncome: -0.04 },
                // 成熟期：劳资关系稳定化，全面提升工业生产力
                { maxPop: 0.12, stability: -2, production: 0.12, categories: { industry: 0.08 }, cultureBonus: 0.03, taxIncome: -0.05 },
            ],
            triggerEffects: [
                // 工人运动的核心效果：提升工业建筑产出，而非让工人产银币
{ type: 'building_count_bonus', category: 'industry', per: 5, bonus: { production: 0.03 } },
            ],
        },
    },

    // ============ 传奇理念 (legendary) ============
    // 传奇理念极为稀有，效果强大但代价显著，包含丰富的条件触发和资源消耗机制
    {
        id: 'mandate_of_heaven',
        name: '天命',
        category: 'politics',
        icon: 'Sun',
        color: 'text-amber-400',
        unlockEpoch: 3,
        desc: '天子受命于天，德配则天命不替，失德则天命转移。',
        lore: '周公旦首创天命论，将暴力革命包装为宇宙正义——此后两千年，每个新朝代都以"天命所归"来为自己加冕。',
        rarity: 'legendary',
        weightModifiers: [
            { condition: { stabilityBelow: 25 }, multiplier: 3.0 },
            { condition: { minEpoch: 3 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    stability: 8,
                    taxIncome: 0.04,
                    categories: { civic: 0.04 },
                    scienceBonus: -0.03,
                    cultureBonus: -0.02,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'official', bonus: { perPopPassive: { silver: 0.01, culture: 0.01 } } },
                        { type: 'mutual_exclusion', conflictsWith: ['republicanism', 'anarchism'],
                            penalty: { stability: -15, categories: { civic: -0.10 } },
                            bonusIfPure: { stability: 5, taxIncome: 0.03 } },
                    ],
                },
                {
                    stability: 10,
                    taxIncome: 0.06,
                    categories: { civic: 0.06, gather: 0.03 },
                    scienceBonus: -0.04,
                    cultureBonus: -0.03,
                    maxPop: 0.03,
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: 0.0025, target: 'taxIncome', targetType: 'bonus', cap: 0.35 },
                        { source: 'officials', sourceType: 'officialCount', ratio: 0.25, target: 'stability', targetType: 'bonus', cap: 4 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.08 },
                    ],
                },
                {
                    stability: 12,
                    taxIncome: 0.08,
                    categories: { civic: 0.08, gather: 0.04 },
                    scienceBonus: -0.04,
                    cultureBonus: -0.03,
                    maxPop: 0.04,
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '赦令安民', buffId: 'heavenly_pacification', duration: 120, effects: { stability: 12, taxIncome: 0.06, categories: { civic: 0.06 } } }, cooldownDays: 45 },
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '盛世开元', buffId: 'golden_mandate', duration: 180, effects: { stability: 15, taxIncome: 0.12, production: 0.08 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 25,
                            normalBonus: { stability: 4, taxIncome: 0.02 },
                            flippedBonus: { stability: -12, taxIncome: -0.08, maxPop: -0.05 } },
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 10,
                            bonus: { stability: 4, categories: { civic: 0.03 } },
                            penaltyIfDrained: { stability: -8, taxIncome: -0.05 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'invisible_hand',
        name: '看不见的手',
        category: 'economy',
        icon: 'Eye',
        color: 'text-amber-300',
        unlockEpoch: 5,
        desc: '每个人追求自身利益时，市场机制如同一只看不见的手，引导社会走向最优配置。',
        lore: '亚当·斯密在《国富论》中描绘的这只无形之手，成为古典经济学的终极隐喻，至今仍在塑造全球经济秩序。',
        rarity: 'legendary',
        weightModifiers: [
            { condition: { minTechs: 25 }, multiplier: 2.0 },
            { condition: { stratum: 'merchant', minPop: 30 }, multiplier: 1.8 },
        ],
        effects: {
            levels: [
                {
                    taxIncome: 0.08,
                    categories: { industry: 0.06 },
                    production: 0.04,
                    stability: -4,
                    cultureBonus: -0.03,
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.02, production: 0.01 } },
                        { type: 'mutual_exclusion', conflictsWith: ['communism', 'state_capitalism'],
                            penalty: { production: -0.12, taxIncome: -0.10, stability: -8 },
                            bonusIfPure: { taxIncome: 0.04 } },
                    ],
                },
                {
                    taxIncome: 0.10,
                    categories: { industry: 0.08 },
                    production: 0.06,
                    stability: -4,
                    cultureBonus: -0.04,
                    militaryBonus: -0.02,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'taxIncome', targetType: 'bonus', cap: 0.50 },
                        { source: 'trade', sourceType: 'tradeVolume', ratio: 0.00012, target: 'production', targetType: 'bonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'price_volatility_mod', value: 0.18 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.10 },
                    ],
                },
                {
                    taxIncome: 0.12,
                    categories: { industry: 0.10 },
                    production: 0.08,
                    stability: -5,
                    cultureBonus: -0.05,
                    militaryBonus: -0.03,
                    onEvents: [
                        { event: 'on_chain_complete', effect: { action: 'addBuff', name: '市场繁荣', buffId: 'market_prosperity', duration: 180, effects: { taxIncome: 0.18, production: 0.12 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'treasury_below', threshold: 500,
                            normalBonus: { taxIncome: 0.04, production: 0.02 },
                            flippedBonus: { stability: -8, taxIncome: -0.08, production: -0.05 } },
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 12,
                            bonus: { taxIncome: 0.04, categories: { industry: 0.03 } },
                            penaltyIfDrained: { stability: -6, production: -0.05 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'enlightenment_ideal',
        name: '启蒙理想',
        category: 'philosophy',
        icon: 'Lightbulb',
        color: 'text-amber-400',
        unlockEpoch: 5,
        desc: '理性是照亮黑暗的光芒，科学与人权将把人类从愚昧和专制中解放。',
        lore: '伏尔泰的讽刺、卢梭的回归自然、康德的"敢于运用你自己的理性"——启蒙运动是人类精神史上最伟大的革命。',
        rarity: 'legendary',
        weightModifiers: [
            { condition: { minTechs: 30 }, multiplier: 2.5 },
            { condition: { minEpoch: 5 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    scienceBonus: 0.10,
                    cultureBonus: 0.06,
                    stability: -4,
                    militaryBonus: -0.04,
                    production: -0.02,
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { scienceBonus: 0.0015, cultureBonus: 0.0008 } },
                        { type: 'mutual_exclusion', conflictsWith: ['caste_system', 'divine_right'],
                            penalty: { scienceBonus: -0.10, cultureBonus: -0.08, stability: -8 },
                            bonusIfPure: { scienceBonus: 0.03, cultureBonus: 0.02 } },
                    ],
                },
                {
                    scienceBonus: 0.12,
                    cultureBonus: 0.08,
                    stability: -4,
                    militaryBonus: -0.05,
                    production: -0.03,
                    maxPop: 0.04,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.015, target: 'scienceBonus', targetType: 'bonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.12 },
                        { type: 'building_cost_mod', scope: 'civic', value: -0.06 },
                    ],
                },
                {
                    scienceBonus: 0.15,
                    cultureBonus: 0.10,
                    stability: -5,
                    militaryBonus: -0.05,
                    production: -0.03,
                    maxPop: 0.05,
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '公民论战', buffId: 'public_reason_campaign', duration: 120, effects: { scienceBonus: 0.12, cultureBonus: 0.08, stability: 6 } }, cooldownDays: 60 },
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '知识大爆炸', buffId: 'knowledge_big_bang', duration: 180, effects: { scienceBonus: 0.22, cultureBonus: 0.15 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 30,
                            normalBonus: { scienceBonus: 0.03, cultureBonus: 0.02 },
                            flippedBonus: { stability: -6, scienceBonus: -0.04, cultureBonus: -0.03 } },
                        { type: 'resource_drain', resource: 'culture', drainPerTick: 5,
                            bonus: { scienceBonus: 0.03, cultureBonus: 0.02 },
                            penaltyIfDrained: { scienceBonus: -0.04, stability: -4 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'pax_universalis',
        name: '万国太平',
        category: 'social',
        icon: 'Globe',
        color: 'text-amber-300',
        unlockEpoch: 7,
        desc: '人类终将超越国界和种族的藩篱，建立一个永久和平的世界秩序。',
        lore: '从康德的《永久和平论》到联合国宪章——普世和平是人类文明最崇高也最遥不可及的梦想。',
        rarity: 'legendary',
        weightModifiers: [
            { condition: { minEpoch: 7 }, multiplier: 2.0 },
            { condition: { minTechs: 40 }, multiplier: 2.0 },
        ],
        effects: {
            levels: [
                {
                    stability: 10,
                    cultureBonus: 0.08,
                    maxPop: 0.06,
                    scienceBonus: 0.04,
                    militaryBonus: -0.10,
                    taxIncome: -0.04,
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '和平协定', buffId: 'peace_accord', duration: 180, effects: { stability: 10, cultureBonus: 0.08, maxPop: 0.06 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'mutual_exclusion', conflictsWith: ['militarism', 'imperialism', 'total_war'],
                            penalty: { stability: -15, cultureBonus: -0.10, militaryBonus: -0.08 },
                            bonusIfPure: { stability: 5, cultureBonus: 0.03 } },
                    ],
                },
                {
                    stability: 12,
                    cultureBonus: 0.10,
                    maxPop: 0.08,
                    scienceBonus: 0.05,
                    production: 0.03,
                    militaryBonus: -0.09,
                    taxIncome: -0.04,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00012, target: 'cultureBonus', targetType: 'bonus', cap: 0.35 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.8, target: 'stability', targetType: 'bonus', cap: 6 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.10 },
                    ],
                },
                {
                    stability: 14,
                    cultureBonus: 0.12,
                    maxPop: 0.10,
                    scienceBonus: 0.06,
                    production: 0.05,
                    militaryBonus: -0.08,
                    taxIncome: -0.05,
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '永久和平', buffId: 'perpetual_peace', duration: 240, effects: { stability: 15, cultureBonus: 0.15, maxPop: 0.10, scienceBonus: 0.08 } }, cooldownDays: 60 },
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '人道协调', buffId: 'humanitarian_coordination', duration: 120, effects: { stability: 8, maxPop: 0.08, cultureBonus: 0.08 } }, cooldownDays: 60 },
                        { event: 'on_pop_milestone', effect: { action: 'addBuff', name: '人类大同', buffId: 'universal_brotherhood', duration: 240, effects: { stability: 15, maxPop: 0.12, cultureBonus: 0.06 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { stability: 6, cultureBonus: 0.04, maxPop: 0.03 },
                            flippedBonus: { stability: -15, militaryBonus: -0.10, cultureBonus: -0.08 } },
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 8,
                            bonus: { stability: 4, maxPop: 0.03 },
                            penaltyIfDrained: { stability: -8, maxPop: -0.04 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'promethean_fire',
        name: '普罗米修斯之火',
        category: 'science',
        icon: 'Flame',
        color: 'text-amber-500',
        unlockEpoch: 6,
        desc: '技术是从神那里盗来的火种，人类有权也有责任用它重塑世界。',
        lore: '从普罗米修斯盗火到曼哈顿计划，从蒸汽机到互联网——每次技术飞跃都同时带来创造与毁灭的力量。',
        rarity: 'legendary',
        weightModifiers: [
            { condition: { minTechs: 35 }, multiplier: 2.5 },
            { condition: { minEpoch: 6 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    scienceBonus: 0.12,
                    categories: { industry: 0.08 },
                    production: 0.06,
                    stability: -6,
                    cultureBonus: -0.05,
                    maxPop: -0.02,
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { scienceBonus: 0.002, production: 0.0008 } },
{ type: 'building_count_bonus', category: 'industry', per: 12, bonus: { scienceBonus: 0.05, production: 0.02 } },
                    ],
                },
                {
                    scienceBonus: 0.15,
                    categories: { industry: 0.10 },
                    production: 0.08,
                    stability: -6,
                    cultureBonus: -0.06,
                    maxPop: -0.03,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'scienceBonus', targetType: 'bonus', cap: 0.50 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.14 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.08 },
                    ],
                },
                {
                    scienceBonus: 0.18,
                    categories: { industry: 0.12 },
                    production: 0.10,
                    stability: -7,
                    cultureBonus: -0.07,
                    maxPop: -0.04,
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '技术奇点', buffId: 'tech_singularity', duration: 240, effects: { scienceBonus: 0.25, production: 0.15, categories: { industry: 0.12 }, stability: -3 } }, cooldownDays: 90 },
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '科研军管', buffId: 'emergency_research_directorate', duration: 120, effects: { scienceBonus: 0.15, production: 0.10, stability: -2 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'population_above', threshold: 5000,
                            normalBonus: { scienceBonus: -0.03, production: -0.02 },
                            flippedBonus: { scienceBonus: 0.05, production: 0.03 } },
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 10,
                            bonus: { scienceBonus: 0.04, categories: { industry: 0.02 } },
                            penaltyIfDrained: { scienceBonus: -0.05, production: -0.04, stability: -4 } },
                    ],
                },
            ],
        },
    },

    // ============ V2: 哲学理念 (philosophy) ============
    {
        id: 'dialectics',
        name: '辩证法',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 3,
        desc: '矛盾是事物发展的动力，正反合推动历史前进。',
        lore: '从黑格尔到马克思，辩证法揭示了矛盾中蕴含的力量。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: -3, scienceBonus: 0.05, cultureBonus: 0.05 },
                { stability: -2, scienceBonus: 0.08, cultureBonus: 0.08 },
                { stability: -1, scienceBonus: 0.12, cultureBonus: 0.12,
                    onEvents: [
{ event: 'on_rebellion_start', effect: { action: 'addBuff', name: '扬弃', effects: { scienceBonus: 0.20, cultureBonus: 0.15 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'inverse_scaling', source: 'stability', threshold: 55, aboveBonus: { scienceBonus: -0.003 }, belowBonus: { scienceBonus: 0.005 }, cap: 0.45 },
            ],
        },
    },
    {
        id: 'utilitarianism',
        name: '功利主义',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 4,
        desc: '以最大多数人的最大幸福为道德标准。',
        lore: '边沁与密尔的效用理论，将幸福量化为政策的终极指标。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.04, needsReduction: 0.03 },
                { taxIncome: 0.06, needsReduction: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'taxIncome', cap: 0.45 },
                    ] },
                { taxIncome: 0.04, needsReduction: 0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'taxIncome', cap: 0.45 },
{ source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.01, target: 'stability', cap: 6 },
                    ] },
            ],
        },
    },
    {
        id: 'nihilism',
        name: '虚无主义',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 5,
        desc: '一切价值都是虚构，只有在废墟上才能重建真实。',
        lore: '尼采宣告上帝已死，陀思妥耶夫斯基则追问：若无上帝，一切皆可为？',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: -5, cultureBonus: 0.08 },
                { stability: -4, cultureBonus: 0.12,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.15 },
                    ] },
                { stability: -3, cultureBonus: 0.16,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.20 },
                    ],
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '永恒轮回', effects: { scienceBonus: 0.15, cultureBonus: 0.15, militaryBonus: 0.15 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'diminishing_returns', category: 'theology', threshold: 1, perExtra: { cultureBonus: -0.03 } },
                { type: 'resource_drain', resource: 'silver', drainPerTick: 5, bonus: { cultureBonus: 0.05 }, penaltyIfDrained: { stability: -3 } },
            ],
        },
    },
    {
        id: 'social_darwinism',
        name: '社会达尔文主义',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 5,
        desc: '适者生存，不平等是自然法则的必然结果。',
        lore: '赫伯特·斯宾塞将达尔文进化论延伸至社会领域，为竞争正名。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.05, stability: -2 },
                { industryBonus: 0.08, stability: -2,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.0005, target: 'production', cap: 0.35 },
                    ] },
                { industryBonus: 0.12, stability: -2, militaryBonus: 0.08,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.0005, target: 'production', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'wages_mod', scope: 'worker', value: -0.15 },
                    ] },
            ],
        },
    },
    {
        id: 'deconstructionism',
        name: '解构主义',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 7,
        desc: '消解一切固有结构，在碎片中发现新的可能。',
        lore: '德里达的解构思想挑战了西方形而上学的根基。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.06, taxIncome: -0.03 },
                { cultureBonus: 0.09, taxIncome: -0.03,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.012, target: 'cultureBonus', cap: 0.35 },
                    ] },
                { cultureBonus: 0.13, taxIncome: -0.03,
                    ruleMods: [
                        { type: 'official_bonus', scope: '_global', value: -0.08 },
                    ],
                    onEvents: [
                        { event: 'on_class_approval_low', effect: { action: 'addBuff', name: '话语裂解', buffId: 'discursive_fracture', duration: 180, effects: { cultureBonus: 0.12, organizationGrowthMod: 0.15, stability: -2 } }, cooldownDays: 45 },
                    ] },
            ],
            triggerEffects: [
                { type: 'coalition_diversity_bonus', perStratum: { cultureBonus: 0.03 }, cap: 0.50 },
            ],
        },
    },
    {
        id: 'ubermensch',
        name: '超人哲学',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 6,
        desc: '超越凡人的意志与力量，英雄创造历史。',
        lore: '尼采的超人不是蛮力的化身，而是自我超越的永恒追求。',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.05, stability: -3 },
                { militaryBonus: 0.08, stability: -2 },
                { militaryBonus: 0.12, stability: -1,
                    onEvents: [
{ event: 'on_battle_victory', effect: { action: 'addBuff', name: '意志的胜利', effects: { militaryBonus: 0.20, scienceBonus: 0.12 }, duration: 240 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'official_faction_bonus', faction: 'military', per: 1, bonus: { militaryBonus: 0.03 }, cap: 0.45 },
                { type: 'mutual_exclusion', conflictsWith: ['egalitarianism', 'collectivism'], penalty: { stability: -5 }, bonusIfPure: { militaryBonus: 0.03 } },
            ],
        },
    },

    // ============ V2: 神学理念 (theology) ============
    {
        id: 'buddhism',
        name: '佛法',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 2,
        desc: '四圣谛揭示苦的本质，中道引领解脱之路。',
        lore: '从乔达摩悉达多菩提树下的觉悟，到大乘佛教的普渡众生。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { needsReduction: 0.05, stability: 3 },
                { needsReduction: 0.08, stability: 5,
                    ruleMods: [
                        { type: 'resource_price_mod', scope: '_global', value: -0.08 },
                    ] },
                { needsReduction: 0.12, stability: 8,
                    ruleMods: [
                        { type: 'resource_price_mod', scope: '_global', value: -0.12 },
                    ],
                    converters: [
{ source: 'unemployment', sourceType: 'unemployment', ratio: 0.03, target: 'stability', cap: 4 },
                        { source: 'stability', sourceType: 'stability', ratio: 0.003, target: 'cultureBonus', cap: 0.2 },
                    ] },
            ],
        },
    },
    {
        id: 'eschatology',
        name: '末世论',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 3,
        desc: '末日即将降临，唯有信仰坚定者得以拯救。',
        lore: '从天启四骑士到千禧年主义，末世期盼贯穿人类宗教史。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.06, stability: -2 },
                { militaryBonus: 0.09, stability: -2 },
                { militaryBonus: 0.13, stability: -1,
                    onEvents: [
{ event: 'on_war_start', effect: { action: 'addBuff', name: '末日狂热', buffId: 'apocalyptic_fervor', duration: 180, effects: { militaryBonus: 0.22, stability: -3, cultureBonus: 0.06 } }, cooldownDays: 90 },
{ event: 'on_rebellion_start', effect: { action: 'addBuff', name: '天启', effects: { militaryBonus: 0.30 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'conditional_flip', condition: 'isAtWar', flippedBonus: { militaryBonus: 0.12 }, normalBonus: { militaryBonus: -0.05 } },
            ],
        },
    },
    {
        id: 'taoism',
        name: '道法自然',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 2,
        desc: '道生一，一生二，二生三，三生万物。无为而无不为。',
        lore: '老子《道德经》五千言，道尽了天地间最质朴的智慧。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { production: 0.04, stability: 2 },
                { production: 0.06, stability: 4,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'gather', value: -0.12 },
                    ] },
                { production: 0.09, stability: 6, needsReduction: 0.08,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'gather', value: -0.12 },
                    ],
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: 0.004, target: 'production', cap: 0.60 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'farm', per: 5, bonus: { production: 0.03 } },
            ],
        },
    },
    {
        id: 'jihad_doctrine',
        name: '圣战思想',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 3,
        desc: '以信仰之名征战四方，为神圣事业而战。',
        lore: '从十字军到吉哈德，圣战概念深刻影响了宗教与军事的交织。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.05, cultureBonus: 0.03 },
                { militaryBonus: 0.08, cultureBonus: 0.05,
                    converters: [
                        { source: 'warCount', sourceType: 'warCount', ratio: 0.04, target: 'militaryBonus', cap: 0.45 },
                    ] },
                { militaryBonus: 0.12, cultureBonus: 0.08,
                    converters: [
                        { source: 'warCount', sourceType: 'warCount', ratio: 0.04, target: 'militaryBonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'recruit_cost_mod', scope: 'infantry', value: -0.2 },
                    ],
                    onEvents: [
{ event: 'on_war_victory', effect: { action: 'addBuff', name: '圣战凯旋', buffId: 'holy_triumph', duration: 240, effects: { militaryBonus: 0.15, stability: 6, cultureBonus: 0.08 } }, cooldownDays: 90 },
{ event: 'on_war_victory', effect: { action: 'addStability', amount: 8 }, cooldownDays: 90 },
                    ] },
            ],
        },
    },
    {
        id: 'deism',
        name: '自然神论',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 4,
        desc: '上帝创造了宇宙的精密机器，然后让它自行运转。',
        lore: '伏尔泰与富兰克林的信仰：理性与神性并行不悖。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, stability: 2 },
                { scienceBonus: 0.06, stability: 3 },
                { scienceBonus: 0.10, stability: 5,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'scienceBonus', cap: 0.45 },
                    ] },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { cultureBonus: 0.001 } },
            ],
        },
    },

    // ============ V2: 政治理念 (politics) ============
    {
        id: 'federalism',
        name: '联邦主义',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 4,
        desc: '多元自治，各州共治，在差异中寻求统一。',
        lore: '从美国联邦制到瑞士邦联，分权治理展现了多样性的力量。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 4, taxIncome: -0.03 },
                { stability: 6, taxIncome: -0.02 },
                { stability: 10, taxIncome: -0.01,
                    converters: [
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.01, target: 'taxIncome', cap: 0.60 },
                    ] },
            ],
            triggerEffects: [
{ type: 'coalition_diversity_bonus', perStratum: { stability: 1.5, taxIncome: 0.01 }, cap: 8 },
            ],
        },
    },
    {
        id: 'totalitarianism',
        name: '极权主义',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 6,
        desc: '国家即一切，一切为国家，国家之外无一物。',
        lore: '汉娜·阿伦特揭示了极权体制如何将恐怖制度化。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.08, stability: -3, cultureBonus: -0.05 },
                { taxIncome: 0.12, stability: -3, cultureBonus: -0.04,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.2 },
                        { type: 'wages_mod', scope: 'official', value: 0.2 },
                    ] },
                { taxIncome: 0.16, stability: -2, cultureBonus: -0.03,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.25 },
                        { type: 'wages_mod', scope: 'official', value: 0.25 },
                    ],
                    converters: [
                        { source: 'officialCount', sourceType: 'officialCount', ratio: 0.03, target: 'militaryBonus', cap: 0.2 },
                    ] },
            ],
            triggerEffects: [
                { type: 'conditional_flip', condition: 'legitimacy<30', flippedBonus: { stability: -15 }, normalBonus: {} },
            ],
        },
    },
    {
        id: 'balance_of_power',
        name: '外交均势',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 4,
        desc: '列强之间的精妙平衡，任何一方的崛起都会引发联合制衡。',
        lore: '梅特涅和俾斯麦以均势外交维持了欧洲数十年的和平。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3 },
                { stability: 5,
                    converters: [
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.015, target: 'taxIncome', cap: 0.30 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.01, target: 'cultureBonus', cap: 0.30 },
                    ] },
                { stability: 8,
                    converters: [
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.015, target: 'taxIncome', cap: 0.30 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.01, target: 'cultureBonus', cap: 0.30 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.04, target: 'taxIncome', cap: 0.35 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.02, target: 'militaryBonus', cap: 0.35 },
                    ],
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addStability', amount: 3 } },
                    ] },
            ],
            triggerEffects: [
                { type: 'diplomatic_influence', value: 0.1 },
            ],
        },
    },
    {
        id: 'vanguardism',
        name: '革命先锋',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 6,
        desc: '由觉悟最高的少数精英引领群众走向革命。',
        lore: '列宁的先锋队理论：没有革命的理论，就没有革命的运动。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.05, stability: -3 },
                { scienceBonus: 0.08, stability: -2 },
                { scienceBonus: 0.12, stability: -1,
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.15 },
                    ],
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '革命浪潮', effects: { scienceBonus: 0.08, cultureBonus: 0.08, militaryBonus: 0.08, industryBonus: 0.08 }, duration: 360 }, cooldownDays: 720 },
                    ] },
            ],
            triggerEffects: [
                { type: 'official_faction_bonus', faction: 'academic', per: 1, bonus: { scienceBonus: 0.03 }, cap: 0.45 },
            ],
        },
    },
    {
        id: 'tributary_system',
        name: '朝贡体系',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 2,
        desc: '万邦来朝，以德服人，藩属纳贡以换取庇护。',
        lore: '从周天子的分封到明朝的朝贡贸易，华夏秩序延续千年。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.03 },
                { taxIncome: 0.05,
                    converters: [
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.03, target: 'taxIncome', cap: 0.45 },
                    ] },
                { taxIncome: 0.08,
                    converters: [
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.03, target: 'taxIncome', cap: 0.45 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.04, target: 'cultureBonus', cap: 0.2 },
                    ],
                    ruleMods: [
                        { type: 'maintenance_cost_mod', scope: 'infantry', value: -0.1 },
                        { type: 'diplomatic_influence', value: 0.05 },
                    ] },
            ],
        },
    },
    {
        id: 'populism',
        name: '民粹主义',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 5,
        desc: '人民的声音就是上帝的声音，精英是人民的敌人。',
        lore: '从格拉古兄弟到现代民粹浪潮，底层的愤怒从未停息。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3, taxIncome: -0.03, approval: { peasant: 5, unemployed: 4 } },
                { stability: 3, taxIncome: -0.03, approval: { peasant: 7, unemployed: 5 }, organizationGrowthMod: 0.08,
                    converters: [
{ source: 'poorPop', sourceType: 'poorPop', ratio: 0.005, target: 'stability', cap: 5 },
                    ] },
                { stability: 3, taxIncome: -0.03, approval: { peasant: 9, unemployed: 7 }, organizationGrowthMod: 0.12,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.005, target: 'stability', cap: 5 },
                    ],
                    ruleMods: [
                        { type: 'wages_mod', scope: 'peasant', value: 0.1 },
                    ] },
            ],
            triggerEffects: [
                { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 75, bonus: { production: 0.05 } },
            ],
        },
    },

    // ============ V2: 经济理念 (economy) ============
    {
        id: 'gold_standard',
        name: '金本位',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 5,
        desc: '以黄金为锚，稳定货币价值，建立国际信用。',
        lore: '19世纪的金本位制度为全球贸易提供了共同的价值标尺。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.03, stability: 2 },
                { taxIncome: 0.05, stability: 4 },
                { taxIncome: 0.08, stability: 6,
                    ruleMods: [
                        { type: 'price_volatility_mod', value: -0.2 },
                    ],
                    converters: [
{ source: 'silver', sourceType: 'resource', ratio: 0.001, target: 'stability', cap: 5 },
                    ] },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'silver', above: { threshold: 5000, bonus: { taxIncome: 0.08 } }, below: { threshold: 1000, bonus: { stability: -5 } } },
            ],
        },
    },
    {
        id: 'planned_economy',
        name: '计划经济',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 6,
        desc: '国家统一调配资源，五年计划指导生产，消灭市场无序。',
        lore: '苏联的五年计划在短短十年内将农业国变为工业强国。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.06, production: 0.04, needsReduction: 0.03 },
                { industryBonus: 0.09, production: 0.06, needsReduction: 0.05,
                    ruleMods: [
                        { type: 'price_volatility_mod', value: -0.25 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.12 },
                    ] },
                { industryBonus: 0.12, production: 0.08, needsReduction: 0.08,
                    ruleMods: [
                        { type: 'price_volatility_mod', value: -0.30 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.18 },
                    ],
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: -0.005, target: 'taxIncome', cap: -0.15 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 5, bonus: { production: 0.03 } },
            ],
        },
    },
    {
        id: 'manorial_economy',
        name: '庄园经济',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 3,
        desc: '庄园是自给自足的微型世界，领主与农奴各安其分。',
        lore: '中世纪庄园制度将土地、劳动和保护编织成稳固的社会网络。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { production: 0.04, needsReduction: 0.02 },
                { production: 0.05, needsReduction: 0.03,
                    converters: [
                        { source: 'large_estate', sourceType: 'specificBuilding', ratio: 0.015, target: 'production', cap: 0.30 },
                    ] },
                { production: 0.05, needsReduction: 0.03,
                    converters: [
                        { source: 'large_estate', sourceType: 'specificBuilding', ratio: 0.015, target: 'production', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'peasant', value: 0.12 },
                        { type: 'stratum_output_mod', scope: 'worker', value: -0.05 },
                    ],
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '庄园封闭', buffId: 'manorial_retreat', duration: 120, effects: { needsReduction: 0.08, stability: 8, production: -0.02 } }, cooldownDays: 60 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'large_estate', per: 3, bonus: { production: 0.04, stability: 1.5 } },
            ],
        },
    },
    {
        id: 'maritime_trade',
        name: '海上贸易',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 3,
        desc: '控制海洋就是控制财富，贸易路线是帝国的血脉。',
        lore: '从威尼斯到汉萨同盟，海上贸易缔造了跨越大陆的商业帝国。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.05, cultureBonus: 0.02 },
                { taxIncome: 0.08, cultureBonus: 0.04,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.001, target: 'taxIncome', cap: 0.30 },
                    ] },
                { taxIncome: 0.12, cultureBonus: 0.06,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.001, target: 'taxIncome', cap: 0.30 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.02, target: 'taxIncome', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'trade_route_mod', value: 0.15 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'trade_port', per: 3, bonus: { taxIncome: 0.04 } },
            ],
        },
    },
    {
        id: 'finance_capitalism',
        name: '金融资本主义',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 6,
        desc: '钱生钱，资本永不眠。金融是经济的血液，也是最大的赌场。',
        lore: '从罗斯柴尔德到华尔街，金融资本重塑了现代世界的权力格局。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.05, stability: -2 },
                { taxIncome: 0.08, stability: -2,
                    converters: [
                        { source: 'silver', sourceType: 'resource', ratio: 0.00015, target: 'taxIncome', cap: 0.45 },
                    ] },
                { taxIncome: 0.12, stability: -1,
                    converters: [
                        { source: 'silver', sourceType: 'resource', ratio: 0.00015, target: 'taxIncome', cap: 0.45 },
                        { source: 'stability', sourceType: 'stability', ratio: 0.002, target: 'taxIncome', cap: 0.30 },
                    ],
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '金融恐慌', effects: { taxIncome: -0.15 }, duration: 120 }, cooldownDays: 180 },
                    ] },
            ],
        },
    },
    {
        id: 'cooperative_movement',
        name: '合作社运动',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 5,
        desc: '工人共同拥有生产资料，利润共享，决策共议。',
        lore: '从罗奇代尔先驱者到蒙德拉贡，合作社证明了另一种经济的可能。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3, industryBonus: 0.03, approval: { worker: 5 } },
                { stability: 3, industryBonus: 0.03, approval: { worker: 7 }, organizationGrowthMod: -0.08,
                    ruleMods: [
                        { type: 'wages_mod', scope: 'worker', value: 0.08 },
                    ] },
                { stability: 3, industryBonus: 0.03, approval: { worker: 9, artisan: 4 }, organizationGrowthMod: -0.12,
                    ruleMods: [
                        { type: 'wages_mod', scope: 'worker', value: 0.08 },
                    ],
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: 0.003, target: 'industryBonus', cap: 0.35 },
                    ] },
            ],
            triggerEffects: [
                { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 70, bonus: { industryBonus: 0.08 } },
{ type: 'building_count_bonus', category: 'industry', per: 5, bonus: { stability: 1.5 } },
            ],
        },
    },

    // ============ V2: 军事理念 (military) ============
    {
        id: 'chivalry',
        name: '骑士精神',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 3,
        desc: '以荣誉为剑，以忠诚为盾，骑士道是战场上的贵族精神。',
        lore: '从查理曼的骑士到圆桌骑士团，骑士精神定义了中世纪战争的面貌。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.04, cultureBonus: 0.02 },
                { militaryBonus: 0.06, cultureBonus: 0.04,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.12 },
                        { type: 'unit_defense_mod', scope: 'cavalry', value: 0.08 },
                    ] },
                { militaryBonus: 0.08, cultureBonus: 0.06,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.18 },
                        { type: 'unit_defense_mod', scope: 'cavalry', value: 0.12 },
                    ],
                    onEvents: [
                        { event: 'on_battle_victory', effect: { action: 'addBuff', name: '凯旋赞歌', buffId: 'chivalric_glory', duration: 60, effects: { cultureBonus: 0.05, stability: 2, militaryBonus: 0.04 } }, cooldownDays: 60 },
                    ] },
            ],
            triggerEffects: [
                { type: 'unit_count_bonus', category: 'cavalry', per: 5, bonus: { militaryBonus: 0.01 }, cap: 0.30 },
            ],
        },
    },
    {
        id: 'fortress_doctrine',
        name: '要塞战术',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 4,
        desc: '层层防线、固若金汤，让入侵者在城墙下流尽鲜血。',
        lore: '从沃邦的棱堡体系到马奇诺防线，防御工事是战争的另一种艺术。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3, militaryBonus: 0.03 },
                { stability: 5, militaryBonus: 0.05,
                    ruleMods: [
                        { type: 'unit_defense_mod', scope: 'infantry', value: 0.15 },
                    ] },
                { stability: 8, militaryBonus: 0.08,
                    ruleMods: [
                        { type: 'unit_defense_mod', scope: 'infantry', value: 0.22 },
                        { type: 'building_cost_mod', scope: 'military', value: -0.20 },
                    ],
                    onEvents: [
{ event: 'on_battle_defeat', effect: { action: 'addBuff', name: '哀兵必胜', effects: { militaryBonus: 0.28 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'fortress', per: 3, bonus: { militaryBonus: 0.05 } },
            ],
        },
    },
    {
        id: 'blitzkrieg',
        name: '闪电战',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 7,
        desc: '集中装甲力量，突破一点，纵深穿插，速战速决。',
        lore: '古德里安的装甲部队在六周内征服了法国，改写了战争规则。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.06 },
                { militaryBonus: 0.09,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.15 },
                        { type: 'unit_attack_mod', scope: 'gunpowder', value: 0.10 },
                    ] },
                { militaryBonus: 0.13,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.22 },
                        { type: 'unit_attack_mod', scope: 'gunpowder', value: 0.15 },
                        { type: 'recruit_cost_mod', scope: 'cavalry', value: -0.25 },
                    ],
                    converters: [
                        { source: 'warCount', sourceType: 'warCount', ratio: 0.10, target: 'militaryBonus', cap: 0.30 },
                    ] },
            ],
        },
    },
    {
        id: 'peoples_war',
        name: '人民战争',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 6,
        desc: '动员一切力量，让敌人陷入人民的汪洋大海之中。',
        lore: '毛泽东的游击战思想：敌进我退，敌退我追，农村包围城市。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.04, stability: 2 },
                { militaryBonus: 0.04, stability: 2,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00003, target: 'militaryBonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'recruit_cost_mod', scope: 'infantry', value: -0.2 },
                    ] },
                { militaryBonus: 0.04, stability: 2,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00003, target: 'militaryBonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'recruit_cost_mod', scope: 'infantry', value: -0.2 },
                    ],
                    onEvents: [
{ event: 'on_battle_defeat', effect: { action: 'addBuff', name: '敌后根据地', effects: { militaryBonus: 0.18, production: 0.12 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 70, bonus: { militaryBonus: 0.10 } },
            ],
        },
    },
    {
        id: 'gunpowder_revolution',
        name: '火器革命',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 4,
        desc: '火药改变了战争的面貌，冷兵器时代一去不返。',
        lore: '从中国的火箭到欧洲的加农炮，火器革命是人类战争史的分水岭。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.05 },
                { militaryBonus: 0.08,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'gunpowder', value: 0.15 },
                        { type: 'unit_defense_mod', scope: 'siege', value: 0.1 },
                    ] },
                { militaryBonus: 0.12,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'gunpowder', value: 0.25 },
                        { type: 'unit_defense_mod', scope: 'siege', value: 0.18 },
                    ],
                    onEvents: [
                        { event: 'on_battle_victory', effect: { action: 'addBuff', name: '火力优势', buffId: 'firepower_supremacy', duration: 120, effects: { militaryBonus: 0.15, production: 0.05 } }, cooldownDays: 90 },
                    ] },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { militaryBonus: 0.02 } },
{ type: 'building_specific_bonus', buildingId: 'barracks', per: 5, bonus: { militaryBonus: 0.04 } },
            ],
        },
    },
    {
        id: 'military_industrial_complex',
        name: '军事工业复合体',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 7,
        desc: '军事与工业的深度融合，战争机器永不停歇。',
        lore: '艾森豪威尔的警告：军事工业复合体正在获得不应有的影响力。',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.05, industryBonus: 0.05, stability: -3 },
                { militaryBonus: 0.08, industryBonus: 0.08, stability: -3,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.02, target: 'industryBonus', cap: 0.45 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'militaryBonus', cap: 0.35 },
                    ] },
                { militaryBonus: 0.12, industryBonus: 0.12, stability: -2,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.02, target: 'industryBonus', cap: 0.45 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'militaryBonus', cap: 0.35 },
                        { source: 'warCount', sourceType: 'warCount', ratio: 0.03, target: 'industryBonus', cap: 0.35 },
                        { source: 'warCount', sourceType: 'warCount', ratio: 0.03, target: 'militaryBonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'maintenance_cost_mod', scope: 'gunpowder', value: -0.15 },
                    ] },
            ],
            triggerEffects: [
                { type: 'resource_drain', resource: 'silver', drainPerTick: 8, bonus: { militaryBonus: 0.05, industryBonus: 0.05 }, penaltyIfDrained: { stability: -5 } },
            ],
        },
    },

    // ============ V2: 美学理念 (aesthetics) ============
    {
        id: 'renaissance',
        name: '文艺复兴',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-400',
        unlockEpoch: 4,
        desc: '人文之光重燃，艺术与科学在佛罗伦萨的阳光下交相辉映。',
        lore: '达芬奇既是画家也是工程师，文艺复兴打破了艺术与科学的界限。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.06, scienceBonus: 0.04 },
                { cultureBonus: 0.09, scienceBonus: 0.06,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.015, target: 'scienceBonus', cap: 0.35 },
                    ] },
                { cultureBonus: 0.13, scienceBonus: 0.09,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.015, target: 'scienceBonus', cap: 0.35 },
                    ],
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '人文灵感', buffId: 'humanist_inspiration', duration: 150, effects: { cultureBonus: 0.10, scienceBonus: 0.08, stability: 3 } }, cooldownDays: 45 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'university', per: 3, bonus: { cultureBonus: 0.04 } },
            ],
        },
    },
    {
        id: 'bauhaus',
        name: '包豪斯',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-400',
        unlockEpoch: 7,
        desc: '形式追随功能，美就是最高效的设计。',
        lore: '包豪斯学院将艺术与工业合一，创造了现代设计的基因。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.04, cultureBonus: 0.03 },
                { industryBonus: 0.06, cultureBonus: 0.05,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.15 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.10 },
                    ] },
                { industryBonus: 0.10, cultureBonus: 0.07,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.20 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.15 },
                    ],
                    onEvents: [
{ event: 'on_build', effect: { action: 'addBuff', name: '标准化施工', buffId: 'bauhaus_standard_build', duration: 90, effects: { industryBonus: 0.08, cultureBonus: 0.05 } }, cooldownDays: 15, condition: { category: 'civic' } },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'industry', per: 5, bonus: { cultureBonus: 0.02 } },
            ],
        },
    },
    {
        id: 'calligraphy',
        name: '书法传统',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-400',
        unlockEpoch: 1,
        desc: '笔走龙蛇，墨分五色，文字承载着文明最深沉的记忆。',
        lore: '从甲骨文到阿拉伯书法，书写本身就是一种至高的艺术。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.04, scienceBonus: 0.02 },
                { cultureBonus: 0.05, scienceBonus: 0.03,
                    converters: [
                        { source: 'library', sourceType: 'specificBuilding', ratio: 0.015, target: 'cultureBonus', cap: 0.60 },
                    ] },
                { cultureBonus: 0.05, scienceBonus: 0.03,
                    converters: [
                        { source: 'library', sourceType: 'specificBuilding', ratio: 0.015, target: 'cultureBonus', cap: 0.60 },
                    ],
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'scholar', value: 0.12 },
                    ],
                    onEvents: [
{ event: 'on_stability_crisis', effect: { action: 'addBuff', name: '文脉守成', buffId: 'scriptural_continuity', duration: 120, effects: { cultureBonus: 0.10, scienceBonus: 0.05, stability: 6 } }, cooldownDays: 60 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'library', per: 3, bonus: { cultureBonus: 0.04, scienceBonus: 0.02 } },
            ],
        },
    },
    {
        id: 'oral_tradition',
        name: '口头传统',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-400',
        unlockEpoch: 0,
        desc: '在篝火旁传唱的史诗，是文明最古老的记忆。',
        lore: '从荷马到格里奥，口头传统在文字出现之前守护着民族的灵魂。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.03, stability: 2 },
                { cultureBonus: 0.05, stability: 4,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00004, target: 'cultureBonus', cap: 0.35 },
                    ] },
                { cultureBonus: 0.08, stability: 6, needsReduction: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00004, target: 'cultureBonus', cap: 0.35 },
                    ] },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'cleric', bonus: { cultureBonus: 0.005 }, per: 5 },
            ],
        },
    },
    {
        id: 'architectural_aesthetics',
        name: '建筑美学',
        category: 'aesthetics',
        icon: 'Palette',
        color: 'text-pink-400',
        unlockEpoch: 2,
        desc: '宏伟的建筑是刻在石头上的文明丰碑。',
        lore: '从帕特农神庙到悉尼歌剧院，建筑是最持久的艺术形式。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.03, stability: 2 },
                { cultureBonus: 0.04, stability: 3,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.012, target: 'cultureBonus', cap: 0.30 },
                    ] },
                { cultureBonus: 0.04, stability: 3,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.012, target: 'cultureBonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: 0.1 },
                    ],
                    onEvents: [
{ event: 'on_build', effect: { action: 'addBuff', name: '城市景观', buffId: 'urban_beauty', duration: 120, effects: { cultureBonus: 0.08, stability: 3 } }, cooldownDays: 15 },
                        { event: 'on_build', effect: { action: 'addStability', amount: 2 }, cooldownDays: 15 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'civic', per: 5, bonus: { cultureBonus: 0.03 } },
            ],
        },
    },

    // ============ V2: 科学理念 (science) ============
    {
        id: 'alchemy',
        name: '炼金术',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 2,
        desc: '在坩埚与蒸馏器之间，炼金术士寻找着万物的本源。',
        lore: '虽然未能点石成金，炼金术却奠定了现代化学的基础。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.03 },
                { scienceBonus: 0.05,
                    converters: [
                        { source: 'copper', sourceType: 'resource', ratio: 0.005, target: 'scienceBonus', cap: 0.1 },
                    ] },
                { scienceBonus: 0.08,
                    converters: [
                        { source: 'copper', sourceType: 'resource', ratio: 0.008, target: 'scienceBonus', cap: 0.15 },
                    ],
                    ruleMods: [
                        { type: 'resource_price_mod', scope: 'iron', value: -0.1 },
                    ],
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '炼成试验', buffId: 'transmutation_trial', duration: 120, effects: { scienceBonus: 0.08, production: 0.05, cultureBonus: -0.01 } }, cooldownDays: 45 },
                    ] },
            ],
        },
    },
    {
        id: 'natural_history',
        name: '博物学',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 4,
        desc: '观察、分类、记录——自然界是最伟大的图书馆。',
        lore: '从林奈的分类法到达尔文的小猎犬号之旅，博物学揭开了生命的奥秘。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, cultureBonus: 0.02 },
                { scienceBonus: 0.06, cultureBonus: 0.03,
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.01, target: 'scienceBonus', cap: 0.45 },
                    ] },
                { scienceBonus: 0.08, cultureBonus: 0.04,
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.015, target: 'scienceBonus', cap: 0.55 },
                    ],
                    onEvents: [
                        { event: 'on_season_change', effect: { action: 'addBuff', name: '田野考察', buffId: 'field_expedition', duration: 90, effects: { scienceBonus: 0.08, cultureBonus: 0.04 } }, cooldownDays: 60 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'gather', per: 5, bonus: { scienceBonus: 0.03 } },
                { type: 'epoch_scaling', perEpoch: { scienceBonus: 0.01 } },
            ],
        },
    },
    {
        id: 'systems_theory',
        name: '系统论',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 8,
        desc: '整体大于部分之和，复杂系统涌现出不可预见的秩序。',
        lore: '贝塔朗菲和维纳的系统思维，揭示了万物互联的深层逻辑。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.05, industryBonus: 0.03 },
                { scienceBonus: 0.08, industryBonus: 0.05,
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: 0.003, target: 'industryBonus', cap: 0.35 },
                    ] },
                { scienceBonus: 0.12, industryBonus: 0.08,
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.01, target: 'scienceBonus', cap: 0.45 },
                        { source: 'stability', sourceType: 'stability', ratio: 0.003, target: 'industryBonus', cap: 0.35 },
                    ],
                    onEvents: [
                        { event: 'on_chain_complete', effect: { action: 'addBuff', name: '系统涌现', buffId: 'systemic_emergence', duration: 120, effects: { scienceBonus: 0.12, industryBonus: 0.08, production: 0.05 } }, cooldownDays: 90 },
                    ] },
            ],
            triggerEffects: [
                { type: 'chain_count_bonus', perCount: { scienceBonus: 0.03, industryBonus: 0.02 }, cap: { scienceBonus: 0.15, industryBonus: 0.15 } },
            ],
        },
    },
    {
        id: 'materials_science',
        name: '材料科学',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 5,
        desc: '从青铜到钢铁到碳纤维，材料的突破定义了文明的高度。',
        lore: '每一次材料革命都彻底改变了人类制造和战争的方式。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.04, scienceBonus: 0.03 },
                { industryBonus: 0.06, scienceBonus: 0.05,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.12 },
                    ] },
                { industryBonus: 0.10, scienceBonus: 0.08,
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.18 },
                        { type: 'stratum_output_mod', scope: 'engineer', value: 0.15 },
                        { type: 'resource_price_mod', scope: 'iron', value: -0.12 },
                        { type: 'resource_price_mod', scope: 'steel', value: -0.1 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'steel_foundry', per: 3, bonus: { industryBonus: 0.04 } },
            ],
        },
    },
    {
        id: 'information_theory',
        name: '信息论',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 9,
        desc: '信息是一切事物的终极度量，比特是宇宙的基本单元。',
        lore: '香农和图灵开创了信息时代，数字革命彻底改写了文明的定义。',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.08, cultureBonus: 0.05 },
                { scienceBonus: 0.12, cultureBonus: 0.07,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'scienceBonus', cap: 0.2 },
                    ] },
                { scienceBonus: 0.16, cultureBonus: 0.10,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00005, target: 'scienceBonus', cap: 0.2 },
                    ],
                    ruleMods: [
                        { type: 'tech_cost_mod', value: -0.2 },
                    ],
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '突破', effects: { scienceBonus: 0.22 }, duration: 240 }, cooldownDays: 90 },
                    ] },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { scienceBonus: 0.002, cultureBonus: 0.002, industryBonus: 0.002 } },
{ type: 'building_specific_bonus', buildingId: 'university', per: 3, bonus: { scienceBonus: 0.05 } },
            ],
        },
    },

    // ============ V2: 社会理念 (social) ============
    {
        id: 'apartheid',
        name: '种族隔离',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 6,
        desc: '将人按肤色分隔，以制度化的不平等维持秩序。',
        lore: '南非的种族隔离制度最终被曼德拉领导的和平运动推翻。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.05, stability: -4 },
                { industryBonus: 0.08, stability: -4,
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'worker', value: 0.15 },
                        { type: 'wages_mod', scope: 'worker', value: -0.18 },
                    ] },
                { industryBonus: 0.12, stability: -3,
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'worker', value: 0.20 },
                        { type: 'wages_mod', scope: 'worker', value: -0.22 },
                    ],
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.0005, target: 'industryBonus', cap: 0.35 },
                    ] },
            ],
        },
    },
    {
        id: 'universal_education',
        name: '全民教育',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 5,
        desc: '知识是每个人的权利，教育是国家最好的投资。',
        lore: '普鲁士的义务教育制度为德国的工业崛起奠定了人才基础。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, cultureBonus: 0.03 },
                { scienceBonus: 0.06, cultureBonus: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00003, target: 'scienceBonus', cap: 0.35 },
                    ] },
                { scienceBonus: 0.10, cultureBonus: 0.08, stability: 3,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.00003, target: 'scienceBonus', cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'scholar', value: 0.15 },
                        { type: 'stratum_output_mod', scope: 'scientist', value: 0.12 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_specific_bonus', buildingId: 'library', per: 3, bonus: { scienceBonus: 0.03 } },
            ],
        },
    },
    {
        id: 'nomadic_spirit',
        name: '游牧精神',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 0,
        desc: '天地为帐，草原为路，逐水草而居是最古老的生存智慧。',
        lore: '从斯基泰到蒙古，游牧民族用机动性书写了征服的传奇。',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { production: 0.03, militaryBonus: 0.03 },
                { production: 0.05, militaryBonus: 0.05,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.1 },
                        { type: 'recruit_cost_mod', scope: 'cavalry', value: -0.12 },
                    ] },
                { production: 0.08, militaryBonus: 0.08,
                    ruleMods: [
                        { type: 'unit_attack_mod', scope: 'cavalry', value: 0.18 },
                        { type: 'recruit_cost_mod', scope: 'cavalry', value: -0.18 },
                    ],
                    onEvents: [
                        { event: 'on_war_start', effect: { action: 'addBuff', name: '草原突袭', buffId: 'steppe_raid', duration: 120, effects: { militaryBonus: 0.15, production: 0.08 } }, cooldownDays: 90 },
                    ] },
            ],
            triggerEffects: [
                { type: 'inverse_scaling', source: 'totalBuildings', threshold: 100, belowBonus: { militaryBonus: 0.10 }, aboveBonus: { militaryBonus: -0.05 } },
            ],
        },
    },
    {
        id: 'public_health',
        name: '公共卫生',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 5,
        desc: '干净的水源和合理的卫生制度拯救的生命远超任何药物。',
        lore: '约翰·斯诺的霍乱地图开创了流行病学，巴斯德揭示了微生物世界。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { maxPop: 0.05, stability: 2 },
                { maxPop: 0.05, stability: 2, needsReduction: 0.05,
                    converters: [
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.0005, target: 'production', cap: 0.60 },
                    ] },
                { maxPop: 0.05, stability: 2, needsReduction: 0.05,
                    converters: [
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.0005, target: 'production', cap: 0.60 },
                        { source: 'population', sourceType: 'population', ratio: 0.00004, target: 'maxPop', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'peasant', value: 0.08 },
                    ] },
            ],
        },
    },
    {
        id: 'cypherpunk',
        name: '密码朋克',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 9,
        desc: '代码即法律，加密即自由，去中心化即革命。',
        lore: '从密码学邮件列表到比特币，密码朋克运动重新定义了隐私与自由。',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.06, taxIncome: -0.05, stability: -2 },
                { scienceBonus: 0.09, taxIncome: -0.04, stability: -2,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.30 },
                    ] },
                { scienceBonus: 0.14, taxIncome: -0.03, stability: -1,
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.40 },
                    ],
                    converters: [
                        { source: 'stability', sourceType: 'stability', ratio: -0.005, target: 'scienceBonus', cap: 0.2 },
                    ],
                    onEvents: [
{ event: 'on_rebellion_start', effect: { action: 'addBuff', name: '匿名抵抗', effects: { scienceBonus: 0.30, cultureBonus: 0.20 }, duration: 360 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { taxIncome: 0.002 }, cap: 0.35 },
                { type: 'mutual_exclusion', conflictsWith: ['totalitarianism', 'divine_right'], penalty: { stability: -5 }, bonusIfPure: { scienceBonus: 0.05 } },
            ],
        },
    },

    // ============ V2: 补充理念 ============
    {
        id: 'serfdom',
        name: '契约农奴制',
        category: 'economy',
        icon: 'Coins',
        color: 'text-green-400',
        unlockEpoch: 2,
        desc: '农奴被束缚在土地上，以劳动换取领主的保护。',
        lore: '从俄国的农奴制到欧洲的庄园劳役，底层劳动力的锁定推动了农业产出。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { production: 0.05, stability: -2, approval: { peasant: -4 } },
                { production: 0.05, stability: -2, approval: { peasant: -6 }, organizationGrowthMod: 0.08,
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'peasant', value: 0.12 },
                        { type: 'wages_mod', scope: 'peasant', value: -0.15 },
                    ] },
                { production: 0.05, stability: -2, approval: { peasant: -8 }, organizationGrowthMod: 0.12,
                    ruleMods: [
                        { type: 'stratum_output_mod', scope: 'peasant', value: 0.12 },
                        { type: 'wages_mod', scope: 'peasant', value: -0.15 },
                    ],
                    onEvents: [
{ event: 'on_rebellion_start', effect: { action: 'addBuff', name: '农奴起义', effects: { stability: -15 }, duration: 120 }, cooldownDays: 180 },
                    ] },
            ],
            triggerEffects: [
                { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 40, invert: true, bonus: { production: 0.05 } },
            ],
        },
    },
    {
        id: 'thalassocracy',
        name: '海洋霸权',
        category: 'military',
        icon: 'Sword',
        color: 'text-orange-400',
        unlockEpoch: 4,
        desc: '谁控制了海洋，谁就控制了世界贸易和军事投射力。',
        lore: '从雅典到大英帝国，海洋霸权始终是强国的标志。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    militaryBonus: 0.04,
                    taxIncome: 0.04,
                },
                {
                    militaryBonus: 0.04,
                    taxIncome: 0.04,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.00008, target: 'militaryBonus', cap: 0.30 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.012, target: 'taxIncome', cap: 0.60 },
                    ],
                },
                {
                    militaryBonus: 0.05,
                    taxIncome: 0.05,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.0001, target: 'militaryBonus', cap: 0.35 },
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.015, target: 'taxIncome', cap: 0.30 },
                    ],
                    onEvents: [
                        { event: 'on_war_victory', effect: { action: 'addBuff', name: '制海权', buffId: 'command_of_the_seas', duration: 240, effects: { taxIncome: 0.15, militaryBonus: 0.12, production: 0.06 } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { taxIncome: 0.03, production: 0.02 },
                            flippedBonus: { militaryBonus: 0.05, taxIncome: -0.02 } },
                    ],
                },
            ],
        },
    },
    {
        id: 'philosopher_king',
        name: '哲人王',
        category: 'philosophy',
        icon: 'Brain',
        color: 'text-indigo-400',
        unlockEpoch: 3,
        desc: '由最有智慧的人来统治，知识即正义。',
        lore: '柏拉图在《理想国》中描绘了哲学家统治的理想城邦。',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, stability: 3 },
                { scienceBonus: 0.06, stability: 4,
                    converters: [
                        { source: 'officialCount', sourceType: 'officialCount', ratio: 0.03, target: 'scienceBonus', cap: 0.30 },
                    ] },
                { scienceBonus: 0.08, stability: 5,
                    converters: [
                        { source: 'officialCount', sourceType: 'officialCount', ratio: 0.04, target: 'scienceBonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'corruption_mod', value: -0.1 },
                    ] },
            ],
            triggerEffects: [
{ type: 'official_faction_bonus', faction: 'academic', per: 1, bonus: { scienceBonus: 0.02, stability: 1 }, cap: 0.30 },
            ],
        },
    },
    {
        id: 'golden_rule',
        name: '黄金规则',
        category: 'theology',
        icon: 'Church',
        color: 'text-yellow-400',
        unlockEpoch: 1,
        desc: '己所不欲，勿施于人——跨越文明的道德金律。',
        lore: '从孔子到耶稣，几乎所有伟大文明都独立发现了这条普世准则。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 4,
                    cultureBonus: 0.03,
                },
                {
                    stability: 4,
                    cultureBonus: 0.03,
                    converters: [
{ source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 1.0, target: 'stability', cap: 5 },
                    ],
                },
                {
                    stability: 5,
                    cultureBonus: 0.04,
                    converters: [
{ source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 1.2, target: 'stability', cap: 6 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.02, target: 'cultureBonus', cap: 0.35 },
                    ],
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '互惠善意', buffId: 'reciprocal_goodwill', duration: 180, effects: { stability: 8, cultureBonus: 0.08, scienceBonus: 0.05 } }, cooldownDays: 45 },
                    ],
                },
            ],
        },
    },
    {
        id: 'cartography',
        name: '制图学',
        category: 'science',
        icon: 'FlaskConical',
        color: 'text-cyan-400',
        unlockEpoch: 3,
        desc: '精确的地图是探索、贸易和征服的基石。',
        lore: '从托勒密到麦卡托，制图学革命开启了大航海时代。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    scienceBonus: 0.03,
                    cultureBonus: 0.02,
                },
                {
                    scienceBonus: 0.03,
                    cultureBonus: 0.02,
                    converters: [
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.012, target: 'scienceBonus', cap: 0.60 },
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.00008, target: 'cultureBonus', cap: 0.06 },
                    ],
                },
                {
                    scienceBonus: 0.04,
                    cultureBonus: 0.03,
                    converters: [
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.015, target: 'scienceBonus', cap: 0.30 },
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.0001, target: 'cultureBonus', cap: 0.60 },
                    ],
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '航路重绘', buffId: 'remapped_routes', duration: 180, effects: { scienceBonus: 0.08, cultureBonus: 0.06, taxIncome: 0.06 } }, cooldownDays: 60 },
                    ],
                },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { scienceBonus: 0.01 } },
            ],
        },
    },
    {
        id: 'environmentalism',
        name: '环境保护主义',
        category: 'social',
        icon: 'Users',
        color: 'text-purple-400',
        unlockEpoch: 8,
        desc: '地球不是我们从祖先那里继承的，而是从后代那里借来的。',
        lore: '蕾切尔·卡森的《寂静的春天》唤醒了人类对环境危机的认知。',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3, production: 0.03 },
                { stability: 5, production: 0.05,
                    ruleMods: [
                        { type: 'building_input_mod', scope: 'gather', value: -0.12 },
                    ] },
                { stability: 8, production: 0.08,
                    ruleMods: [
                        { type: 'building_input_mod', scope: 'gather', value: -0.18 },
                    ],
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.02, target: 'production', cap: 0.45 },
                    ] },
            ],
            triggerEffects: [
{ type: 'building_count_bonus', category: 'gather', per: 5, bonus: { stability: 2 } },
                { type: 'inverse_scaling', source: 'buildingCategoryCounts.industry', threshold: 35, belowBonus: { stability: 8 }, aboveBonus: { stability: -5 } },
            ],
        },
    },
];

/**
 * 理念索引：id → 对象，便于快速查找
 */
export const IDEOLOGY_MAP = IDEOLOGIES.reduce((map, ideology) => {
    map[ideology.id] = ideology;
    return map;
}, {});

const ideologyDslResult = normalizeIdeologyDefinitions(IDEOLOGIES);
if (ideologyDslResult.issues.length > 0) {
    reportIdeologyDslIssues('ideologies', ideologyDslResult.issues);
}

IDEOLOGIES.splice(0, IDEOLOGIES.length, ...ideologyDslResult.ideologies);
Object.keys(IDEOLOGY_MAP).forEach((key) => {
    delete IDEOLOGY_MAP[key];
});
IDEOLOGIES.forEach((ideology) => {
    IDEOLOGY_MAP[ideology.id] = ideology;
});

export const IDEOLOGY_DSL_ISSUES = ideologyDslResult.issues;
