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
    research_tech:     { base: 15,  epochScale: 8,   desc: '研发知识' },
    epoch_advance:     { base: 60, epochScale: 20,  desc: '进入新时代' },
    achievement:       { base: 20, maxBase: 50,     desc: '达成成就' },
    building_milestone:{ base: 40, desc: '建筑里程碑（指数递增：50→150→450→…×3）' },
    pop_milestone:     { base: 45, desc: '人口里程碑（指数递增：100→400→1600→…×4）' },
    war_result:        { baseWin: 50, baseLose: 30,  desc: '战争结果' },
    chain_complete:    { base: 45, desc: '产业链完成' },
    trade_milestone:   { base: 25, milestones: [500, 1500, 4000, 10000, 25000, 60000, 150000], desc: '贸易里程碑' },
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
 *      type: 'building_cost_mod' | 'official_bonus' | 'official_capacity' | 'tax_modifier' | 'cooldown_mod' | 'price_volatility_mod' | 'tech_cost_mod',
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
        desc: '在旷野中听见的那个声音，不属于任何偶像，却震撼了整个灵魂。',
        lore: '"除我以外，你不可有别的神。" ——《摩西十诫》',
        rarity: 'common',
        weightModifiers: [
            { condition: { stratum: 'cleric', minPop: 10 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    stability: 6,
                    cultureBonus: 0.05,
                    scienceBonus: -0.03,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'cleric', bonus: { perPopPassive: { culture: 0.008 } } },
                        // 神职人员人口 → 文化加成
                        { type: 'pop_ratio_bonus', stratum: 'cleric', ratio: 0.002, target: 'cultureBonus' },
                        // 特定建筑（寺庙）数量 → 稳定度（信仰中心的地域影响）
                        { type: 'building_specific_bonus', buildingId: 'temple', per: 50, bonus: { stability: 0.8 }, cap: 12 },
                    ],
                },
                {
                    stability: 9,
                    cultureBonus: 0.08,
                    categories: { civic: 0.05 },
                    scienceBonus: -0.03,  // 不再增加
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.001, target: 'cultureBonus', cap: 0.45 },
                        // 神职人员人口 → 稳定度
                        { source: 'cleric', sourceType: 'population', ratio: 0.000002, target: 'stability', cap: 8 },
                        // 平均满意度 → 文化（信仰带来心理安慰）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.004, target: 'cultureBonus', cap: 0.30 },
                    ],
                    triggerEffects: [
                        // 寺庙数量 → 稳定度+文化（宗教网络扩张）
                        { type: 'building_specific_bonus', buildingId: 'temple', per: 30, bonus: { stability: 1.0, cultureBonus: 0.01 }, cap: 18 },
                    ],
                },
                {
                    stability: 12,
                    cultureBonus: 0.12,
                    categories: { civic: 0.07 },
                    maxPop: 0.03,
                    scienceBonus: -0.02,  // 惩罚减轻
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '信仰整合', buffId: 'faith_unity', duration: 120, effects: { stability: 10, cultureBonus: 0.10 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        // 使用比例阈値：文化库存超过当前产出的50倍时触发
                        { type: 'resource_threshold', resource: 'culture', threshold: 5000, bonus: { stability: 5, cultureBonus: 0.05 } },
                        // 条件翻转：稳定度高时信仰更虚诚
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 65,
                            normalBonus: {},
                            flippedBonus: { cultureBonus: 0.06, stability: 3 } },
                        // 寺庙数量 → 稳定度+文化+人口（宗教全面影响）
                        { type: 'building_specific_bonus', buildingId: 'temple', per: 20, bonus: { stability: 1.2, cultureBonus: 0.015, maxPop: 0.005 }, cap: 25 },
                    ],
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0012, target: 'cultureBonus', cap: 0.60 },
                        { source: 'cleric', sourceType: 'population', ratio: 0.000003, target: 'stability', cap: 12 },
                        // 平均满意度 → 稳定度+文化（信仰广泛时社会更和谐）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.008, target: 'stability', cap: 10 },
                    ],
                },            ],
        },
    },
    {
        id: 'polytheism',
        name: '多神教',
        category: 'theology',
        icon: 'Sparkles',
        color: 'text-yellow-300',
        unlockEpoch: 0,
        desc: '山川湖海皆是神的居所，每一阵风都携带着某个神祇的耳语。',
        lore: '"诸神之城奥林匹斯，从不曾被风暴撼动，从未被雨水浸润。" ——荷马《伊利亚特》',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    cultureBonus: 0.08,
                    categories: { gather: 0.03 },
                    stability: -2,
                    triggerEffects: [
                        // 神庙数量 → 采集加成（各神祝福土地）
                        { type: 'building_specific_bonus', buildingId: 'shrine', per: 50, bonus: { categories: { gather: 0.02 } }, cap: 0.30 },
                    ],
                },
                {
                    cultureBonus: 0.12,
                    categories: { gather: 0.05 },
                    stability: 1,
                    converters: [
                        // 平均满意度 → 文化（多神信仰包容性高）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.003, target: 'cultureBonus', cap: 0.25 },
                    ],
                    triggerEffects: [
                        // 神庙数量 → 采集+文化（神庙越多信仰越兴盛）
                        { type: 'building_specific_bonus', buildingId: 'shrine', per: 30, bonus: { categories: { gather: 0.025 }, cultureBonus: 0.008 }, cap: 0.40 },
                    ],
                },
                {
                    cultureBonus: 0.16,
                    categories: { gather: 0.08 },
                    stability: 3,
                    maxPop: 0.02,
                    converters: [
                        // 平均满意度 → 文化+稳定度（信仰广泛带来和谐）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.005, target: 'cultureBonus', cap: 0.35 },
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.06, target: 'stability', cap: 8 },
                    ],
                    triggerEffects: [
                        // 神庙数量 → 采集+文化+人口（神灵保佑大地）
                        { type: 'building_specific_bonus', buildingId: 'shrine', per: 20, bonus: { categories: { gather: 0.030 }, cultureBonus: 0.010, maxPop: 0.004 }, cap: 0.50 },
                    ],
                },
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
        desc: '我们站在祖先的肩膀上，他们的目光穿透时间，注视着血脉的延续。',
        lore: '"慎终追远，民德归厚矣。" ——《论语》',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 4,
                    maxPop: 0.03,
                    scienceBonus: -0.02,
                    triggerEffects: [
                        // 祈堂数量 → 稳定度（家族祭祀维系社会稳定）
                        { type: 'building_specific_bonus', buildingId: 'ancestral_hall', per: 50, bonus: { stability: 0.8 }, cap: 12 },
                    ],
                },
                {
                    stability: 6,
                    maxPop: 0.05,
                    categories: { civic: 0.03 },
                    scienceBonus: -0.03,
                    converters: [
                        // 合法性 → 稳定度（祖先赋予的正统性）
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.05, target: 'stability', cap: 8 },
                    ],
                    triggerEffects: [
                        // 祈堂数量 → 稳定度+人口（家族延续）
                        { type: 'building_specific_bonus', buildingId: 'ancestral_hall', per: 30, bonus: { stability: 1.0, maxPop: 0.004 }, cap: 18 },
                    ],
                },
                {
                    stability: 10,
                    maxPop: 0.08,
                    categories: { civic: 0.05 },
                    cultureBonus: 0.05,
                    scienceBonus: -0.03,
                    converters: [
                        // 合法性 → 稳定度+文化（祖先智慧传承）
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.08, target: 'stability', cap: 12 },
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.003, target: 'cultureBonus', cap: 0.30 },
                    ],
                    triggerEffects: [
                        // 祈堂数量 → 稳定度+人口+文化（祖先广泛保佑）
                        { type: 'building_specific_bonus', buildingId: 'ancestral_hall', per: 20, bonus: { stability: 1.2, maxPop: 0.005, cultureBonus: 0.008 }, cap: 25 },
                    ],
                },
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
        desc: '在漫漫长夜中守望，黎明终将到来，那个骑白马的人会终结所有的苦难。',
        lore: '"看哪，我必快来！" ——《启示录》22:7',
        rarity: 'rare',
        weightModifiers: [
            { condition: { stabilityBelow: 30 }, multiplier: 2.0 },
        ],
        effects: {
            levels: [
                {
                    stability: 6,
                    cultureBonus: 0.04,
                    production: -0.03,
                    triggerEffects: [
                        // 文化库存阈值：后期文化充裕时触发
                        { type: 'resource_threshold', resource: 'culture', threshold: 3000, bonus: { stability: 4, cultureBonus: 0.04 } },
                    ],
                },
                {
                    stability: 10,
                    cultureBonus: 0.08,
                    maxPop: 0.05,
                    production: -0.03,  // 惩罚不再增加
                    converters: [
                        // 神职人员人口 → 稳定度（信众基础）
                        { source: 'cleric', sourceType: 'population', ratio: 0.000003, target: 'stability', cap: 10 },
                    ],
                    triggerEffects: [
                        { type: 'resource_threshold', resource: 'culture', threshold: 8000, bonus: { stability: 6, cultureBonus: 0.06 } },
                    ],
                },
                {
                    stability: 15,
                    cultureBonus: 0.12,
                    maxPop: 0.08,
                    categories: { civic: 0.06 },
                    production: -0.02,  // 惩罚继续减轻
                    converters: [
                        { source: 'cleric', sourceType: 'population', ratio: 0.000005, target: 'stability', cap: 15 },
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.001, target: 'cultureBonus', cap: 0.50 },
                    ],
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '末世狂热', buffId: 'messianic_fervor', duration: 150, effects: { stability: 15, cultureBonus: 0.12, production: -0.05 } }, cooldownDays: 45 },
                    ],
                    triggerEffects: [
                        { type: 'resource_threshold', resource: 'culture', threshold: 20000, bonus: { stability: 8, cultureBonus: 0.08, maxPop: 0.03 } },
                        // 资源消耗：宗教狂热需要持续的文化投入（随时代缩放）
                        { type: 'resource_drain', resource: 'culture', drainPerTick: 50,
                            bonus: { stability: 5, maxPop: 0.03 },
                            penaltyIfDrained: { stability: -8, cultureBonus: -0.05 } },
                    ],
                },
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
        desc: '把目光从天国收回，投向镜中，那里映照着的，是人自己的尊严。',
        lore: '"人是万物的尺度，是存在的事物存在的尺度，也是不存在的事物不存在的尺度。" ——普罗泰戈拉',
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
        desc: '感官会欺骗，记忆会模糊，唯有理性之光永不熄灭，在那光中，真理澄明如镜。',
        lore: '"我思故我在。" ——勒内·笛卡尔',
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
        desc: '在虚无的深渊边缘，人必须自己选择成为什么样的人，这选择本身就是自由。',
        lore: '"存在先于本质。" ——让-保罗·萨特',
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
        desc: '世界是精神自我展开的宏大戏剧，每一幕都是绝对理念的显现。',
        lore: '"凡是合乎理性的都是现实的，凡是现实的都是合乎理性的。" ——黑格尔',
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
        desc: '王冠的重量来自上天的托付，臣服于宝座即是臣服于神圣的秩序。',
        lore: '"国王是上帝在人间的代理人。" ——雅克-贝尼涅·博须埃',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 6,
                    taxIncome: 0.05,
                    scienceBonus: -0.03,
                    triggerEffects: [
                        // 资源消耗：维持宫廷排场和王室威仪需要持续的銀币投入
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 10,
                            bonus: { stability: 4, taxIncome: 0.03 },
                            penaltyIfDrained: { stability: -5, taxIncome: -0.04 } },
                        // 与共和主义根本矛盾
                        { type: 'mutual_exclusion', conflictsWith: ['republicanism'],
                            penalty: { stability: -12, categories: { civic: -0.10 } },
                            bonusIfPure: { stability: 3, taxIncome: 0.02 } },
                    ],
                },
                {
                    stability: 10,
                    taxIncome: 0.08,
                    categories: { military: 0.05 },
                    scienceBonus: -0.03,  // 不再增加
                    converters: [
                        // 农民人口 → 稳定度（君主权威下的服从）
                        { source: 'peasant', sourceType: 'population', ratio: 0.0000005, target: 'stability', cap: 8 },
                        // 合法性 → 稳定度（君权神授的核心）
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.06, target: 'stability', cap: 8 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 20,
                            bonus: { stability: 5, taxIncome: 0.04 },
                            penaltyIfDrained: { stability: -6, taxIncome: -0.05 } },
                        { type: 'mutual_exclusion', conflictsWith: ['republicanism'],
                            penalty: { stability: -12, categories: { civic: -0.10 } },
                            bonusIfPure: { stability: 3, taxIncome: 0.02 } },
                    ],
                    ruleMods: [
                        { type: 'diplomatic_influence', value: 0.10 },
                    ],
                },
                {
                    stability: 14,
                    taxIncome: 0.12,
                    categories: { military: 0.07 },
                    maxPop: 0.04,
                    scienceBonus: -0.02,  // 惩罚减轻
                    converters: [
                        { source: 'peasant', sourceType: 'population', ratio: 0.0000008, target: 'stability', cap: 12 },
                        // 农民人口 → 税收（封建地租）
                        { source: 'peasant', sourceType: 'population', ratio: 0.0000006, target: 'taxIncome', cap: 0.40 },
                        // 合法性 → 稳定度+税收（君权越巩固，统治越高效）
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.10, target: 'stability', cap: 14 },
                        { source: 'legitimacy', sourceType: 'legitimacy', ratio: 0.004, target: 'taxIncome', cap: 0.35 },
                    ],
                    onEvents: [
                        { event: 'on_stability_crisis', effect: { action: 'addBuff', name: '君权宣言', buffId: 'royal_decree', duration: 120, effects: { stability: 12, taxIncome: 0.10, categories: { military: 0.08 } } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'resource_drain', resource: 'silver', drainPerTick: 35,
                            bonus: { stability: 6, taxIncome: 0.05 },
                            penaltyIfDrained: { stability: -8, taxIncome: -0.06 } },
                        { type: 'mutual_exclusion', conflictsWith: ['republicanism'],
                            penalty: { stability: -12, categories: { civic: -0.10 } },
                            bonusIfPure: { stability: 3, taxIncome: 0.02 } },
                        // 条件翻转：高稳定度时君权更巩固
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 70,
                            normalBonus: {},
                            flippedBonus: { stability: 4, taxIncome: 0.04 } },
                    ],
                    ruleMods: [
                        { type: 'diplomatic_influence', value: 0.15 },
                    ],
                },
            ],
        },
    },    {
        id: 'republicanism',
        name: '共和主义',
        category: 'politics',
        icon: 'Scale',
        color: 'text-red-300',
        unlockEpoch: 2,
        desc: '公共事务不是君主私产，而属于全体公民，这是自由的最古老定义。',
        lore: '"自由、平等、博爱。" ——法国大革命箴言',
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
                        // 平均满意度 → 稳定度（民心向背即共和根基）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.08, target: 'stability', cap: 8 },
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
                    converters: [
                        // 平均满意度 → 稳定度+文化（民主共识越高越繁荣）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.12, target: 'stability', cap: 12 },
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.003, target: 'cultureBonus', cap: 0.30 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35,
                            normalBonus: { taxIncome: 0.02, cultureBonus: 0.02 },
                            flippedBonus: { stability: -4, production: -0.03 } },
                        // 逆向缩放：满意度越高，军事惩罚越小（和平共和）
                        { type: 'inverse_scaling', source: 'militaryBonus', threshold: 0.20, aboveBonus: { stability: -0.3 }, belowBonus: { cultureBonus: 0.01 }, cap: 6 },
                        // 联盟多样性：联盟每增加1个阶层，稳定度和文化提升
                        { type: 'coalition_diversity_bonus', perStratum: { stability: 1.5, cultureBonus: 0.008 } },
                        // 商人满意度阈值：商人满意度超过65时，稳定度和税收提升
                        { type: 'approval_threshold_bonus', stratum: 'merchant', threshold: 65, bonus: { stability: 3, taxIncome: 0.03 } },
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
        desc: '当千万人的心跳在同一面旗帜下共鸣，个体的血流便汇成一条民族的河流。',
        lore: '"民族是什么？它是一个灵魂、一种精神原则。" ——厄内斯特·勒南',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { minEpoch: 5 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.08,
                    stability: 5,
                    cultureBonus: -0.02,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.004, target: 'militaryPower' },
                        // 和平时期也有效果：工业建筑数量 → 军事加成
                        { type: 'building_count_bonus', category: 'industry', per: 8, bonus: { militaryBonus: 0.02 }, cap: 0.25 },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    stability: 7,
                    categories: { industry: 0.05 },
                    maxPop: 0.03,
                    cultureBonus: -0.02,  // 惩罚不再加重
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000006, target: 'militaryBonus', cap: 0.40 },
                        // 工业建筑 → 军事力（工业化支撑军事）
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.001, target: 'militaryBonus', cap: 0.35 },
                    ],
                },
                {
                    militaryBonus: 0.16,
                    stability: 9,
                    categories: { industry: 0.06 },
                    maxPop: 0.04,
                    cultureBonus: -0.02,  // 惩罚不再增加
                    onEvents: [
                        { event: 'on_war_start', effect: { action: 'addBuff', name: '保家卫国', buffId: 'defend_homeland', duration: 180, effects: { militaryBonus: 0.20, stability: 10 } }, cooldownDays: 60 },
                    ],
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000008, target: 'militaryBonus', cap: 0.55 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0012, target: 'militaryBonus', cap: 0.45 },
                    ],
                    triggerEffects: [
                        // 战时加成，和平时也有工业建设带来的威慣效应
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { stability: -1, cultureBonus: -0.01 },
                            flippedBonus: { militaryBonus: 0.06, stability: 4 } },
                    ],
                    ruleMods: [
                        { type: 'maintenance_cost_mod', scope: 'infantry', value: -0.12 },
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
        desc: '政府与人民之间有一份不成文的契约：以服从换取保护，以让渡部分自由换取剩余的自由。',
        lore: '"人是生而自由的，却无往不在枷锁之中。" ——让-雅克·卢梭',
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
                        // 联盟多样性：社会契约鼓励各阶层参与治理
                        { type: 'coalition_diversity_bonus', perStratum: { stability: 1.2, cultureBonus: 0.006 } },
                        // 平民满意度阈值：平民满意度超过60时，科研和文化提升
                        { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 60, bonus: { scienceBonus: 0.03, cultureBonus: 0.02 } },
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
        desc: '银币流入是繁荣的证明，银币流出是衰落的征兆，贸易是一场零和游戏。',
        lore: '"贸易的收益不应以货币的积累来衡量。" ——亚当·斯密',
        rarity: 'common',
        weightModifiers: [
            { condition: { stratum: 'merchant', minPop: 10 }, multiplier: 1.3 },
        ],
        effects: {
            levels: [
                {
                    taxIncome: 0.06,
                    categories: { gather: -0.03 },
                    triggerEffects: [
                        // 核心机制：贸易盈余 → 税收加成
                        { type: 'resource_threshold', resource: 'silver', threshold: 2000, bonus: { taxIncome: 0.02 } },
                        // 按完整产业链给予奖励
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.015 }, cap: 0.25 },
                        // 港口数量 → 税收（港口是重商主义的核心）
                        { type: 'building_specific_bonus', buildingId: 'harbor', per: 30, bonus: { taxIncome: 0.018 }, cap: 0.30 },
                    ],
                },
                {
                    taxIncome: 0.10,
                    categories: { industry: 0.04, gather: -0.04 },
                    converters: [
                        { source: 'trade', sourceType: 'tradeVolume', ratio: 0.0002, target: 'taxIncome', cap: 0.50 },
                        // 平均满意度 → 税收（商人满意时贸易更活跃）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.003, target: 'taxIncome', cap: 0.25 },
                        // 富裕人口 → 税收（商人阶层财富带动贸易）
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00004, target: 'taxIncome', cap: 0.25 },
                    ],
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.02 }, cap: 0.30 },
                        // 港口数量 → 税收+产业链（贸易网络扩张）
                        { type: 'building_specific_bonus', buildingId: 'harbor', per: 20, bonus: { taxIncome: 0.022, categories: { industry: 0.008 } }, cap: 0.40 },
                    ],
                    ruleMods: [
                        { type: 'trade_route_mod', value: 0.15 },  // 贸易路线容量+15%
                    ],
                },
                {
                    taxIncome: 0.15,
                    categories: { industry: 0.06, gather: -0.05 },
                    stability: 3,
                    converters: [
                        { source: 'trade', sourceType: 'tradeVolume', ratio: 0.0003, target: 'taxIncome', cap: 0.70 },
                        // 新增：銀币库存也能贡献产出
                        { source: 'silver', sourceType: 'resource', ratio: 0.00001, target: 'production', cap: 0.30 },
                        // 平均满意度 → 税收+稳定度（商业繁荣人心安定）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.005, target: 'taxIncome', cap: 0.35 },
                    ],
                    onEvents: [
                        { event: 'on_trade_complete', effect: { action: 'addBuff', name: '关税整编', buffId: 'customs_drive', duration: 90, effects: { taxIncome: 0.12, stability: 5 } }, cooldownDays: 20 },
                        { event: 'on_treasury_milestone', effect: { action: 'addStability', amount: 8 }, cooldownDays: 45 },
                    ],
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.025 }, cap: 0.35 },
                        // 港口数量 → 税收+产出+稳定（全球贸易帝国）
                        { type: 'building_specific_bonus', buildingId: 'harbor', per: 15, bonus: { taxIncome: 0.025, production: 0.010, stability: 0.5 }, cap: 0.55 },
                        // 互斥惩罚：与自由贸易理念冲突
                        { type: 'mutual_exclusion', conflictsWith: ['laissez_faire'], penalty: { taxIncome: -0.10, stability: -5 }, bonusIfPure: { taxIncome: 0.05, production: 0.03 } },
                    ],
                    ruleMods: [
                        { type: 'trade_route_mod', value: 0.25 },
                    ],
                },            ],
        },
    },
    {
        id: 'laissez_faire',
        name: '自由放任',
        category: 'economy',
        icon: 'TrendingUp',
        color: 'text-green-300',
        unlockEpoch: 5,
        desc: '让市场自己说话，那只看不见的手，比任何宰相的算计都更加精明。',
        lore: '"每一个人……既不打算促进公共利益，却被一只看不见的手引导着……" ——亚当·斯密',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { industry: 0.10 },
                    taxIncome: 0.06,
                    stability: -2,
                    triggerEffects: [
                        { type: 'chain_count_bonus', countType: 'complete', perCount: { categories: { industry: 0.03 } }, cap: 0.30 },
                        { type: 'mutual_exclusion', conflictsWith: ['communism'],
                            penalty: { production: -0.15, taxIncome: -0.10, stability: -10 },
                            bonusIfPure: { taxIncome: 0.04, production: 0.02 } },
                    ],
                },
                {
                    categories: { industry: 0.14 },
                    taxIncome: 0.09,
                    production: 0.05,
                    stability: -2,  // 不再加重
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.004, target: 'taxIncome', cap: 0.50 },
                        // 完整产业链 → 产出
                        { source: 'chain', sourceType: 'chainCount', ratio: 0.015, target: 'production', cap: 0.35 },
                        // 富裕人口 → 税收（资本家级消费拉动经济）
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00003, target: 'taxIncome', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'price_volatility_mod', value: 0.12 },
                    ],
                },
                {
                    categories: { industry: 0.18 },
                    taxIncome: 0.12,
                    production: 0.08,
                    stability: -3,
                    onEvents: [
                        { event: 'on_chain_complete', effect: { action: 'addBuff', name: '市场繁荣', buffId: 'market_boom', duration: 120, effects: { taxIncome: 0.15, production: 0.08 } }, cooldownDays: 45 },
                    ],
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.005, target: 'taxIncome', cap: 0.65 },
                        { source: 'chain', sourceType: 'chainCount', ratio: 0.020, target: 'production', cap: 0.50 },
                    ],
                    triggerEffects: [
                        { type: 'inverse_scaling', source: 'stability', threshold: 45,
                            aboveBonus: {},
                            belowBonus: { production: -0.003, taxIncome: -0.003 }, cap: 0.35 },
                        // 条件翻转：高稳定度时市场更活跃
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 55,
                            normalBonus: {},
                            flippedBonus: { taxIncome: 0.04, production: 0.03 } },
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
        desc: '土地是唯一的财富之源，金黄的麦浪比堆满仓库的银币更加真实。',
        lore: '"土地是一切财富的源泉。" ——弗朗索瓦·魁奈',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { gather: 0.10, industry: -0.03 },
                    maxPop: 0.04,
                    taxIncome: 0.02,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.006 } } },
                        // 采集建筑数量 → 采集加成（核心成长机制）
                        { type: 'building_count_bonus', category: 'gather', per: 5, bonus: { categories: { gather: 0.02 } }, cap: 0.30 },
                        // 农场数量 → 采集加成（重农主义的核心）
                        { type: 'building_specific_bonus', buildingId: 'farm', per: 80, bonus: { categories: { gather: 0.025 } }, cap: 0.35 },
                    ],
                },
                {
                    categories: { gather: 0.15, industry: -0.04 },
                    maxPop: 0.07,
                    stability: 4,
                    taxIncome: 0.04,
                    scienceBonus: -0.02,
                    converters: [
                        // 农民人口 → 食物产出
                        { source: 'peasant', sourceType: 'population', ratio: 0.0000008, target: 'production', cap: 0.35 },
                        // 采集建筑 → 税收（土地税）
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.0008, target: 'taxIncome', cap: 0.40 },
                    ],
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.008 } } },
                        { type: 'building_count_bonus', category: 'gather', per: 4, bonus: { categories: { gather: 0.025 } }, cap: 0.40 },
                        // 农场数量 → 采集+税收（农业规模扩张）
                        { type: 'building_specific_bonus', buildingId: 'farm', per: 50, bonus: { categories: { gather: 0.030 }, taxIncome: 0.008 }, cap: 0.45 },
                    ],
                },
                {
                    categories: { gather: 0.20, industry: -0.05 },
                    maxPop: 0.10,
                    stability: 6,
                    taxIncome: 0.06,
                    scienceBonus: -0.02,  // 惩罚不再增加
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '农业革命', buffId: 'agrarian_revolution', duration: 200, effects: { categories: { gather: 0.20 }, maxPop: 0.08, taxIncome: 0.05 } }, cooldownDays: 90 },
                    ],
                    converters: [
                        { source: 'peasant', sourceType: 'population', ratio: 0.0000012, target: 'production', cap: 0.50 },
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.001, target: 'taxIncome', cap: 0.55 },
                    ],
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.010 } } },
                        { type: 'building_count_bonus', category: 'gather', per: 3, bonus: { categories: { gather: 0.03 } }, cap: 0.50 },
                        // 条件翻转：高稳定度时土地更肥沃
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 60,
                            normalBonus: {},
                            flippedBonus: { categories: { gather: 0.05 }, maxPop: 0.03 } },
                        // 农场数量 → 采集+税收+人口（农业帝国全面效益）
                        { type: 'building_specific_bonus', buildingId: 'farm', per: 30, bonus: { categories: { gather: 0.035 }, taxIncome: 0.010, maxPop: 0.005 }, cap: 0.60 },
                    ],
                },
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
        desc: '当市场无法追赶时代的脚步，国家便亲自下场，以铁腕推动工业的引擎。',
        lore: '"国家不应成为经济生活的旁观者。" ——弗里德里希·李斯特',
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
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.002, target: 'production', targetType: 'bonus', cap: 0.35 },
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
        desc: '剑锋所指之处，便是国家的边界；和平不过是两次战争间的喘息。',
        lore: '"战争是政治的继续。" ——卡尔·冯·克劳塞维茨',
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
                        // 步兵数量 → 军事加成（常备军威慑）
                        { type: 'unit_count_bonus', category: 'infantry', per: 500, bonus: { militaryBonus: 0.015 }, cap: 0.25 },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    stability: 4,
                    categories: { military: 0.04 },
                    cultureBonus: -0.04,
                    production: -0.02,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.0015, target: 'militaryBonus', targetType: 'bonus', cap: 0.35 },
                        // 军队总规模 → 稳定度（强大军队带来秩序感）
                        { source: 'militarySize', sourceType: 'militarySize', ratio: 0.0008, target: 'stability', cap: 10 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.08 },
                    ],
                    triggerEffects: [
                        // 骑兵数量 → 军事加成（精锐骑兵部队）
                        { type: 'unit_count_bonus', category: 'cavalry', per: 300, bonus: { militaryBonus: 0.020 }, cap: 0.30 },
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
                    converters: [
                        // 军队规模 → 军事加成（规模即力量）
                        { source: 'militarySize', sourceType: 'militarySize', ratio: 0.0012, target: 'militaryBonus', cap: 0.40 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'isAtWar', normalBonus: { stability: -3, taxIncome: -0.02 }, flippedBonus: { militaryBonus: 0.05, stability: 2 } },
                        { type: 'inverse_scaling', source: 'militaryBonus', threshold: 0.30, aboveBonus: { stability: -0.5 }, belowBonus: {}, cap: 8 },
                        // 全兵种数量 → 军事加成（多兵种协同）
                        { type: 'unit_count_bonus', category: 'all', per: 800, bonus: { militaryBonus: 0.018 }, cap: 0.45 },
                        // 资源消耗：每日消耗簮食维持军队，充足时军事大幅提升
                        { type: 'resource_drain', resource: 'food', drainPerTick: 15,
                            bonus: { militaryBonus: 0.06, stability: 3 },
                            penaltyIfDrained: { militaryBonus: -0.08, stability: -5 } },
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
        desc: '以眼还眼只会让整个世界陷入黑暗，另一种力量正在觉醒：非暴力的力量。',
        lore: '"以眼还眼，只会让整个世界变瞎。" ——莫罕达斯·甘地',
        rarity: 'uncommon',
        weightModifiers: [
            { condition: { noPeacefulYears: 10 }, multiplier: 0.5 }, // 长期和平更容易出现
        ],
        effects: {
            levels: [
                {
                    stability: 7,
                    cultureBonus: 0.07,
                    militaryBonus: -0.10,
                    triggerEffects: [
                        // 和平时期红利：文化建筑数量 → 稳定度
                        { type: 'building_count_bonus', category: 'civic', per: 5, bonus: { stability: 0.5 }, cap: 10 },
                        // 与军国主义根本矛盾
                        { type: 'mutual_exclusion', conflictsWith: ['militarism'],
                            penalty: { militaryBonus: -0.15, stability: -12 },
                            bonusIfPure: { cultureBonus: 0.04, stability: 4 } },
                        // 条件翻转：和平时和平红利，战争时和平主义者拖后腿
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { cultureBonus: 0.04, stability: 4 },
                            flippedBonus: { stability: -6, militaryBonus: -0.06 } },
                    ],
                },
                {
                    stability: 10,
                    cultureBonus: 0.10,
                    scienceBonus: 0.06,
                    militaryBonus: -0.08,
                    converters: [
                        // 文化建筑 → 科研（和平红利核心）
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0008, target: 'scienceBonus', cap: 0.40 },
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0006, target: 'cultureBonus', cap: 0.35 },
                    ],
                    triggerEffects: [
                        { type: 'building_count_bonus', category: 'civic', per: 4, bonus: { stability: 0.6 }, cap: 15 },
                        { type: 'mutual_exclusion', conflictsWith: ['militarism'],
                            penalty: { militaryBonus: -0.15, stability: -12 },
                            bonusIfPure: { cultureBonus: 0.04, stability: 4 } },
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { cultureBonus: 0.04, stability: 4 },
                            flippedBonus: { stability: -6, militaryBonus: -0.06 } },
                    ],
                },
                {
                    stability: 14,
                    cultureBonus: 0.15,
                    scienceBonus: 0.10,
                    militaryBonus: -0.06,
                    production: 0.06,
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '和平红利', buffId: 'peace_dividend', duration: 200, effects: { scienceBonus: 0.15, cultureBonus: 0.12, production: 0.08 } }, cooldownDays: 90 },
                    ],
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.001, target: 'scienceBonus', cap: 0.55 },
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0008, target: 'cultureBonus', cap: 0.50 },
                    ],
                    triggerEffects: [
                        { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.01, stability: 1 } },
                        { type: 'building_count_bonus', category: 'civic', per: 3, bonus: { stability: 0.8 }, cap: 20 },
                        { type: 'mutual_exclusion', conflictsWith: ['militarism'],
                            penalty: { militaryBonus: -0.15, stability: -12 },
                            bonusIfPure: { cultureBonus: 0.04, stability: 4 } },
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { cultureBonus: 0.04, stability: 4 },
                            flippedBonus: { stability: -6, militaryBonus: -0.06 } },
                    ],
                },
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
        desc: '当国家危难之际，每一个农夫、工匠、商人都将成为士兵，战争不再是贵族的特权。',
        lore: '"武装起来，公民们！" ——《马赛曲》',
        rarity: 'common',
        weightModifiers: [
            { condition: { recentWar: true }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    militaryBonus: 0.06,
                    production: -0.02,
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.015, target: 'militaryPower' },
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.008, target: 'militaryPower' },
                        // 步兵数量 → 军事力（人海战术）
                        { type: 'unit_count_bonus', category: 'infantry', per: 1000, bonus: { militaryBonus: 0.012 }, cap: 0.20 },
                    ],
                },
                {
                    militaryBonus: 0.09,
                    stability: 3,
                    production: -0.03,
                    scienceBonus: -0.02,
                    converters: [
                        // 总人口 → 军事加成（比例提升）
                        { source: 'population', sourceType: 'population', ratio: 0.000001, target: 'militaryBonus', cap: 0.50 },
                        // 军队规模 → 稳定度（全民皆兵带来凝聚力）
                        { source: 'militarySize', sourceType: 'militarySize', ratio: 0.0006, target: 'stability', cap: 8 },
                    ],
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.018, target: 'militaryPower' },
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.010, target: 'militaryPower' },
                        // 全兵种数量 → 军事力（全民动员规模）
                        { type: 'unit_count_bonus', category: 'all', per: 800, bonus: { militaryBonus: 0.015 }, cap: 0.30 },
                    ],
                },
                {
                    militaryBonus: 0.12,
                    stability: 4,
                    maxPop: -0.02,
                    production: -0.03,  // 惩罚不再加重
                    scienceBonus: -0.02,
                    onEvents: [
                        { event: 'on_war_start', effect: { action: 'addBuff', name: '全民动员', buffId: 'mass_conscription', duration: 120, effects: { militaryBonus: 0.18, stability: 8, production: -0.03 } }, cooldownDays: 60 },
                        { event: 'on_battle_defeat', effect: { action: 'addBuff', name: '同仇敌忳', buffId: 'rally_defense', duration: 120, effects: { militaryBonus: 0.22, stability: 6 } }, cooldownDays: 30 },
                    ],
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000013, target: 'militaryBonus', cap: 0.65 },
                        // 军队规模 → 军事加成（规模即力量）
                        { source: 'militarySize', sourceType: 'militarySize', ratio: 0.0010, target: 'militaryBonus', cap: 0.35 },
                    ],
                    triggerEffects: [
                        { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.020, target: 'militaryPower' },
                        { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.012, target: 'militaryPower' },
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { production: -0.01, taxIncome: -0.01 },
                            flippedBonus: { militaryBonus: 0.05, stability: 3 } },
                        // 全兵种数量 → 军事力（最大动员规模）
                        { type: 'unit_count_bonus', category: 'all', per: 600, bonus: { militaryBonus: 0.018 }, cap: 0.45 },
                    ],
                },
            ],
        },
    },    {
        id: 'sea_power',
        name: '海权论',
        category: 'military',
        icon: 'Anchor',
        color: 'text-orange-300',
        unlockEpoch: 4,
        desc: '谁掌握了海洋，谁就握住了世界贸易的咽喉；谁握住了贸易，谁就握住了世界。',
        lore: '"谁控制了海洋，谁就控制了世界贸易；谁控制了世界贸易，谁就控制了世界。" ——阿尔弗雷德·马汉',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    taxIncome: 0.05,
                    militaryBonus: 0.05,
                    categories: { gather: -0.03 },
                    stability: -1,
                    triggerEffects: [
                        // 日常效果：军事建筑数量 → 税收（港口贸易）
                        { type: 'building_count_bonus', category: 'military', per: 5, bonus: { taxIncome: 0.025 }, cap: 0.30 },
                        // 舰队单位数量 → 税收（海上巡逻保障贸易）
                        { type: 'unit_count_bonus', category: 'naval', per: 300, bonus: { taxIncome: 0.020 }, cap: 0.25 },
                    ],
                },
                {
                    taxIncome: 0.07,
                    militaryBonus: 0.08,
                    categories: { industry: 0.04, gather: -0.03 },
                    stability: -1,
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.00012, target: 'taxIncome', cap: 0.45 },
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.0015, target: 'militaryBonus', cap: 0.40 },
                        // 舰队规模 → 贸易量（海上力量投射贸易）
                        { source: 'naval', sourceType: 'unitCategory', ratio: 0.0015, target: 'taxIncome', cap: 0.35 },
                    ],
                    triggerEffects: [
                        { type: 'building_count_bonus', category: 'military', per: 4, bonus: { taxIncome: 0.030 }, cap: 0.40 },
                        // 舰队单位数量 → 军事加成（舰队实力）
                        { type: 'unit_count_bonus', category: 'naval', per: 200, bonus: { militaryBonus: 0.018 }, cap: 0.35 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.10 },
                    ],
                },
                {
                    taxIncome: 0.10,
                    militaryBonus: 0.12,
                    categories: { industry: 0.06, gather: -0.04 },
                    production: 0.04,
                    stability: -2,
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '开放海路', buffId: 'open_sea_lanes', duration: 180, effects: { taxIncome: 0.15, production: 0.08, stability: 5 } }, cooldownDays: 60 },
                        { event: 'on_war_start', effect: { action: 'addBuff', name: '海上封锁', buffId: 'naval_blockade', duration: 120, effects: { militaryBonus: 0.18, taxIncome: -0.03, stability: -2 } }, cooldownDays: 60 },
                    ],
                    converters: [
                        { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.00018, target: 'taxIncome', cap: 0.60 },
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.002, target: 'militaryBonus', cap: 0.55 },
                        // 舰队规模 → 军事加成（制海权即制制海权）
                        { source: 'naval', sourceType: 'unitCategory', ratio: 0.0025, target: 'militaryBonus', cap: 0.50 },
                    ],
                    triggerEffects: [
                        { type: 'building_count_bonus', category: 'military', per: 3, bonus: { taxIncome: 0.035 }, cap: 0.50 },
                        { type: 'conditional_flip', condition: 'isAtWar',
                            normalBonus: { taxIncome: 0.04, production: 0.03 },
                            flippedBonus: { militaryBonus: 0.06, taxIncome: -0.03 } },
                        // 舰队单位数量 → 税收+军事（制海权全面效益）
                        { type: 'unit_count_bonus', category: 'naval', per: 150, bonus: { taxIncome: 0.022, militaryBonus: 0.015 }, cap: 0.55 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'military', value: -0.15 },
                        { type: 'trade_route_mod', value: 0.20 },
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
        desc: '美，藏在古希腊神庙的比例之中，藏在罗马长诗的格律之内，那里有永恒的和谐。',
        lore: '"高贵的单纯，静穆的伟大。" ——温克尔曼',
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
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.002, target: 'cultureBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                },
                { cultureBonus: 0.18, stability: 8, categories: { civic: 0.06 }, scienceBonus: -0.03, production: -0.02,
                    onEvents: [
                        { event: 'on_build', effect: { action: 'addBuff', name: '纪念性工程', buffId: 'monumental_craft', duration: 120, effects: { cultureBonus: 0.10, stability: 5, categories: { civic: 0.06 } } }, cooldownDays: 12, condition: { category: 'civic' } },
                        { event: 'on_year_end', effect: { action: 'addStability', amount: 4 }, cooldownDays: 30 },
                    ],
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0025, target: 'cultureBonus', targetType: 'bonus', cap: 0.55 },
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
        desc: '理性的光辉太过冰冷，真正的艺术要燃烧，让情感冲破形式的牢笼。',
        lore: '"一切艺术都源于激情。" ——维克多·雨果',
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
        desc: '光影在画布上颤动，那一瞬间的光芒被永远留住，艺术不再复制现实，而是捕捉感受。',
        lore: '"色彩是我的痴迷，是长久的执念。" ——克劳德·莫奈',
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
        desc: '真理不在书本中，而在显微镜下、在田野间、在每一次凝视自然的眼睛里。',
        lore: '"一切知识都来自经验。" ——约翰·洛克',
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
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', targetType: 'bonus', cap: 0.45 },
                    ],
                },
                { scienceBonus: 0.18, categories: { gather: 0.05 }, cultureBonus: -0.03, stability: -2,
                    onEvents: [
{ event: 'on_tech_unlock', effect: { action: 'addBuff', name: '观测范式', buffId: 'observational_paradigm', duration: 150, effects: { scienceBonus: 0.12, categories: { gather: 0.06 } } }, cooldownDays: 15 },
                        { event: 'on_season_change', effect: { action: 'addBuff', name: '田野观测', buffId: 'field_observation', duration: 90, effects: { scienceBonus: 0.06 } }, cooldownDays: 45 },
                    ],
                    converters: [
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.002, target: 'scienceBonus', targetType: 'bonus', cap: 0.55 },
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
        desc: '怀疑是科学的起点，实验是真理的审判席，让事实说话，让假设跪下。',
        lore: '"知识就是力量。" ——弗朗西斯·培根',
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
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0012, target: 'scienceBonus', targetType: 'bonus', cap: 0.30 },
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
        desc: '蒸汽、电力、代码，人类的双手正在创造上帝未曾赐予的奇迹。',
        lore: '"任何足够先进的技术都与魔法无异。" ——阿瑟·克拉克',
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
        desc: '命运在出生时已刻入骨骼，有人生来执犁，有人生来执笔，这是宇宙的秩序。',
        lore: '"每个人生来就有自己必须履行的工作。" ——《薄伽梵歌》',
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
        desc: '当一个人跪下时，另一个人就必须骑在他背上，让我们都站起来。',
        lore: '"人人生而平等，造物主赋予他们若干不可转让的权利。" ——托马斯·杰斐逊',
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
                        { source: 'population', sourceType: 'population', ratio: 0.0000008, target: 'maxPop', targetType: 'bonus', cap: 0.35 },
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
                        { source: 'population', sourceType: 'population', ratio: 0.000001, target: 'maxPop', targetType: 'bonus', cap: 0.45 },
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
        desc: '羊群需要牧羊人，航船需要舵手，让最有能力的人引领方向，这是自然的法则。',
        lore: '"最好的国家是由最优秀的人统治的国家。" ——柏拉图',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    scienceBonus: 0.05, taxIncome: 0.03, maxPop: -0.02, stability: -2,
                    converters: [
                        // 富裕人口 → 科研（精英阶层投资知识）
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00004, target: 'scienceBonus', cap: 0.25 },
                    ],
                },
                {
                    scienceBonus: 0.08, taxIncome: 0.05, categories: { industry: 0.03 }, maxPop: -0.02, stability: -3,
                    converters: [
                        // 富裕人口 → 科研+税收（精英阶层投资和消费）
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00005, target: 'scienceBonus', cap: 0.35 },
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00003, target: 'taxIncome', cap: 0.20 },
                    ],
                },
                {
                    scienceBonus: 0.12, taxIncome: 0.08, categories: { industry: 0.06 }, maxPop: -0.02, stability: -5,
                    converters: [
                        // 富裕人口 → 科研+税收（精英阶层全面引领）
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00006, target: 'scienceBonus', cap: 0.45 },
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.00004, target: 'taxIncome', cap: 0.30 },
                    ],
                },
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
        desc: '在国家的巨轮与个人的浮木之间，有一片由公民自己编织的网，那是自由真正生长的土壤。',
        lore: '"在美国，无论哪里都能看到人们在结社。" ——亚历克西·德·托克维尔',
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
        desc: '在火焰的舞动中，在老树的年轮里，万物都在低语，听得见的人，便是通灵者。',
        lore: '"万物皆有灵，每个灵魂都值得敬畏。" ——蒙古萨满祷词',
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
        lore: '"神秘主义不是逃避现实，而是深入现实的本质。" ——鲁米',
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
        desc: '命运发给你的牌你无法选择，但你可以选择如何打好每一张牌。',
        lore: '"你有力量控制自己的思想——而非外界事件。认识到这一点，你就找到了力量。" ——马可·奥勒留',
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
        desc: '君子如竹，弯而不折；小人如草，风来便倒。修身养性，方能齐家治国。',
        lore: '"己所不欲，勿施于人。" ——孔子',
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
                        // 平均满意度 → 文化（信仰带来心理安慰）
                        { source: 'avgApproval', sourceType: 'avgApproval', ratio: 0.004, target: 'cultureBonus', cap: 0.30 },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'civic', value: -0.08 },
                        // 儒家强调礼制，官员体系效率提升
                        { type: 'official_bonus', scope: 'all', value: 0.12 },
                        // 儒家礼制扩大官员编制
                        { type: 'official_capacity', scope: '_global', value: 3 },
                    ],
                    triggerEffects: [
                        // 儒家官员派系：每8名官员提供文化加成（礼乐教化的核心）
                        { type: 'official_faction_bonus', faction: '儒官', per: 8, bonus: { cultureBonus: 0.010, stability: 0.5 }, cap: 0.25 },
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
        desc: '人不因善而行动，只因利害而行动。严刑峻法，才是治国的良方。',
        lore: '"法不阿贵，绳不挠曲。" ——韩非子',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    stability: 5, production: 0.06, cultureBonus: -0.03, maxPop: -0.02,
                    ruleMods: [
                        // 法家强调官员执法效率，官员体系效率+10%
                        { type: 'official_bonus', scope: 'all', value: 0.10 },
                        // 法家扩充官僚机构
                        { type: 'official_capacity', scope: '_global', value: 2 },
                    ],
                },
                {
                    stability: 8, production: 0.10, categories: { industry: 0.03 }, cultureBonus: -0.03, maxPop: -0.03,
                    ruleMods: [
                        { type: 'official_bonus', scope: 'all', value: 0.15 },
                        // 法家重视建筑管控，降低工业建筑消耗
                        { type: 'building_input_mod', scope: 'industry', value: -0.08 },
                        { type: 'official_capacity', scope: '_global', value: 3 },
                    ],
                },
                {
                    stability: 12, production: 0.14, categories: { industry: 0.06 }, militaryBonus: 0.05, cultureBonus: -0.02, maxPop: -0.03,
                    ruleMods: [
                        { type: 'official_bonus', scope: 'all', value: 0.20 },
                        { type: 'building_input_mod', scope: 'industry', value: -0.12 },
                        { type: 'official_capacity', scope: '_global', value: 4 },
                    ],
                },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'industry', per: 5, bonus: { stability: 1.5 } },
                // 法家官员派系：每10名官员提供产出加成（严格管理带来效率）
                { type: 'official_faction_bonus', faction: '法吏', per: 10, bonus: { production: 0.015, stability: 0.5 }, cap: 0.30 },
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
        desc: '真理不是被发现的，而是被创造出来的，管用的，就是对的。',
        lore: '"真理是观念中那些起作用的部分。" ——威廉·詹姆斯',
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
        desc: '土地是忠诚的货币，誓言是土地的契约，领主的领主，不是我的领主。',
        lore: '"我的附庸的附庸，不是我的附庸。" ——中世纪封建法则',
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
        lore: '"财产就是盗窃。" ——皮埃尔-约瑟夫·蒲鲁东',
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
        desc: '当旗帜插上异国的土地，便有一种神圣的使命感，扩张是文明的使命，而非野心。',
        lore: '"帝国不道歉，帝国不解释。" ——鲁德亚德·吉卜林',
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
        desc: '镰刀和锤子交叉在一起，一个是农民的收获，一个是工人的锻造，一起打破锁链。',
        lore: '"各尽所能，按需分配。" ——卡尔·马克思',
        rarity: 'rare',
        weightModifiers: [
            { condition: { minEpoch: 6 }, multiplier: 1.5 },
        ],
        effects: {
            levels: [
                {
                    production: 0.10,
                    maxPop: 0.05,
                    taxIncome: -0.03,
                    scienceBonus: -0.02,
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.003 } } },
                        { type: 'mutual_exclusion', conflictsWith: ['laissez_faire'], penalty: { production: -0.12, stability: -8 }, bonusIfPure: { production: 0.04 } },
                        { type: 'diminishing_returns', category: 'economy', threshold: 1, perExtra: { production: -0.02, taxIncome: -0.02 } },
                    ],
                },
                {
                    production: 0.15,
                    maxPop: 0.08,
                    taxIncome: -0.02,
                    categories: { industry: 0.08 },
                    scienceBonus: -0.02,  // 不再增加
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.005, target: 'production', cap: 0.50 },
                        // 工人人口 → 产出
                        { source: 'worker', sourceType: 'population', ratio: 0.000002, target: 'production', cap: 0.30 },
                        // 失业人口 → 产出（共产主义将失业转化为生产力）
                        { source: 'unemployment', sourceType: 'unemployment', ratio: 0.00015, target: 'production', cap: 0.20 },
                    ],
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.004 } } },
                        // 工人满意度阈值：工人满意度超过60时，产出额外提升
                        { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 60, bonus: { production: 0.04, categories: { industry: 0.03 } } },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.15 },
                    ],
                },
                {
                    production: 0.20,
                    maxPop: 0.12,
                    taxIncome: -0.01,  // 继续减轻
                    categories: { industry: 0.12 },
                    militaryBonus: 0.05,
                    scienceBonus: -0.01,  // 减轻
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0006, target: 'production', cap: 0.70 },
                        { source: 'worker', sourceType: 'population', ratio: 0.000003, target: 'production', cap: 0.40 },
                        // 失业人口 → 产出（全面动员，无人失业）
                        { source: 'unemployment', sourceType: 'unemployment', ratio: 0.0002, target: 'production', cap: 0.30 },
                    ],
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '工业化运动', buffId: 'industrialization', duration: 240, effects: { production: 0.25, categories: { industry: 0.15 } } }, cooldownDays: 90 },
                    ],
                    triggerEffects: [
                        { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.005 } } },
                        // 条件翻转：低稳定度时获得额外产出（革命激情）
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 50, normalBonus: { production: 0.02 }, flippedBonus: { production: 0.08, stability: -3 } },
                        // 工人满意度阈值：工人满意度超过70时，全面繁荣
                        { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 70, bonus: { production: 0.06, maxPop: 0.04, stability: 3 } },
                    ],
                    ruleMods: [
                        { type: 'building_cost_mod', scope: 'industry', value: -0.20 },
                        { type: 'maintenance_cost_mod', scope: 'infantry', value: -0.10 },
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
        desc: '工匠们的手艺是祖辈传下来的宝藏，只有在行会的庇护下，技艺才能代代相传。',
        lore: '"一个人若不为自己的手艺感到骄傲，那他便枉费了一生。" ——中世纪行会格言',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { industry: 0.05 }, stability: 3, scienceBonus: -0.02,
                    ruleMods: [
                        // 行会制度降低工业建筑的原料消耗（工匠精益生产）
                        { type: 'building_input_mod', scope: 'industry', value: -0.08 },
                    ],
                },
                {
                    categories: { industry: 0.08 }, stability: 5, production: 0.03, scienceBonus: -0.03, maxPop: -0.02,
                    ruleMods: [
                        { type: 'building_input_mod', scope: 'industry', value: -0.12 },
                    ],
                },
                {
                    categories: { industry: 0.12 }, stability: 8, production: 0.05, cultureBonus: 0.03, scienceBonus: -0.03, maxPop: -0.02,
                    ruleMods: [
                        { type: 'building_input_mod', scope: 'industry', value: -0.18 },
                    ],
                },
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
        desc: '没有人应该在获得医疗、教育和尊严之前先证明自己的价值。',
        lore: '"一个社会的文明程度，取决于它如何对待最弱的成员。" ——甘地',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 6, maxPop: 0.04, taxIncome: -0.05, production: -0.03,
                    triggerEffects: [
                        // 满意度阈值：工人满意度超过60时，稳定度额外提升
                        { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 60, bonus: { stability: 3, maxPop: 0.02 } },
                    ],
                },
                {
                    stability: 8,
                    maxPop: 0.05,
                    cultureBonus: 0.03,
                    taxIncome: -0.04,
                    production: -0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000004, target: 'stability', targetType: 'bonus', cap: 4 },
                        // 失业人口 → 稳定度（福利保障将失业转化为社会稳定）
                        { source: 'unemployment', sourceType: 'unemployment', ratio: 0.0002, target: 'stability', cap: 8 },
                    ],
                    triggerEffects: [
                        // 贫困人口满意度阈值：贫困人口满意度超过50时，人口上限提升
                        { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 50, bonus: { maxPop: 0.03, stability: 2 } },
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
                        // 全阶层满意度阈值：平均满意度超过70时，全面繁荣
                        { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 70, bonus: { stability: 5, cultureBonus: 0.04, maxPop: 0.03 } },
                        { type: 'approval_threshold_bonus', stratum: 'peasant', threshold: 65, bonus: { stability: 3, production: 0.02 } },
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
        desc: '敌进我退，敌驻我扰，敌疲我打，敌退我追，让强大的敌人陷入无边的消耗。',
        lore: '"星星之火，可以燎原。" ——毛泽东',
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
        lore: '"训练有素的职业军队是国家的基石。" ——马基雅维利',
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
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.0015, target: 'militaryBonus', targetType: 'bonus', cap: 0.30 },
                        // 步兵数量 → 军事加成（职业化步兵精锐）
                        { source: 'infantry', sourceType: 'unitCategory', ratio: 0.00004, target: 'militaryBonus', cap: 0.30 },
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
                    converters: [
                        // 骨兵数量 → 军事加成（精锐骑兵精锐）
                        { source: 'cavalry', sourceType: 'unitCategory', ratio: 0.00005, target: 'militaryBonus', cap: 0.35 },
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
        desc: '当敌人的目标是彻底毁灭，我们便以总体对总体，每一个工厂、每一粒粮食、每一个灵魂都投入战火。',
        lore: '"全面战争需要全面牺牲。" ——埃里希·鲁登道夫',
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
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.002, target: 'militaryBonus', targetType: 'bonus', cap: 0.45 },
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
                        // 资源消耗：每日消耗铁维持总体战机器，充足时军事大幅提升
                        { type: 'resource_drain', resource: 'iron', drainPerTick: 12,
                            bonus: { militaryBonus: 0.08, categories: { industry: 0.04 } },
                            penaltyIfDrained: { militaryBonus: -0.10, production: -0.05, stability: -4 } },
                    ],
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.002, target: 'militaryBonus', targetType: 'bonus', cap: 0.45 },
                        // 全兵种数量 → 军事加成（总动员规模即力量）
                        { source: 'all', sourceType: 'unitCategory', ratio: 0.00003, target: 'militaryBonus', cap: 0.40 },
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
        desc: '在黄金与大理石的交响中，权力宣示着它的荣耀，越华丽，越神圣。',
        lore: '"建筑是凝固的音乐。" ——歌德',
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
        desc: '艺术的使命不是反映现实，而是砸碎现实的镜子，让碎片折射出未知的光芒。',
        lore: '"艺术的真正目的是为人类打开一扇新的眼睛。" ——萨尔瓦多·达利',
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
        desc: '口耳相传的歌谣比任何纪念碑都长寿，因为它们活在每一个普通人的呼吸里。',
        lore: '"民歌是一个民族的灵魂之歌。" ——约翰·戈特弗里德·赫尔德',
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
        desc: '真理只存在于可观察、可验证的事实之中，其余皆是虚妄。',
        lore: '"一切知识都来自经验。" ——奥古斯特·孔德',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    scienceBonus: 0.12,
                    cultureBonus: -0.03,
                    stability: -2,
                    triggerEffects: [
                        // 每科技给予产出加成（提升比例）
                        { type: 'tech_count_bonus', perTech: { production: 0.003 } },
                        // 实验室数量 → 科研（实证主义的核心）
                        { type: 'building_specific_bonus', buildingId: 'laboratory', per: 30, bonus: { scienceBonus: 0.025 }, cap: 0.35 },                    ],
                },
                {
                    scienceBonus: 0.18,
                    production: 0.05,
                    cultureBonus: -0.02,
                    stability: -2,
                    converters: [
                        // 科技数量 → 产出（应用科学）
                        { source: 'techCount', sourceType: 'techCount', ratio: 0.003, target: 'production', cap: 0.50 },
                    ],
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { production: 0.004 } },
                        // 实验室数量 → 科研+产出（实验室越多实证越充分）
                        { type: 'building_specific_bonus', buildingId: 'laboratory', per: 20, bonus: { scienceBonus: 0.030, production: 0.010 }, cap: 0.45 },
                    ],
                },
                {
                    scienceBonus: 0.26,
                    production: 0.10,
                    categories: { industry: 0.06 },
                    stability: -2,
                    onEvents: [
                        { event: 'on_tech_research', effect: { action: 'addBuff', name: '实证突破', buffId: 'empirical_breakthrough', duration: 90, effects: { scienceBonus: 0.20, production: 0.10 } }, cooldownDays: 30 },
                    ],
                    converters: [
                        { source: 'techCount', sourceType: 'techCount', ratio: 0.004, target: 'production', cap: 0.65 },
                        // 科技数量 → 科研加成（复利）
                        { source: 'techCount', sourceType: 'techCount', ratio: 0.002, target: 'scienceBonus', cap: 0.40 },
                    ],
                    triggerEffects: [
                        { type: 'tech_count_bonus', perTech: { production: 0.005, scienceBonus: 0.002 } },
                        // 条件翻转：科技领先时实证主义更强
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 50,
                            normalBonus: {},
                            flippedBonus: { scienceBonus: 0.05, production: 0.04 } },
                        // 实验室数量 → 科研+产出+工业（实证主义全面开花）
                        { type: 'building_specific_bonus', buildingId: 'laboratory', per: 15, bonus: { scienceBonus: 0.035, production: 0.012, categories: { industry: 0.008 } }, cap: 0.60 },
                    ],
                },
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
        desc: '在星空下，在河流边，在森林里，自然的秩序是一切智慧的源泉。',
        lore: '"自然界不做无用之事。" ——亚里士多德',
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
        desc: '宇宙是一台精密的钟表，每一颗齿轮的转动都可以被计算，上帝是伟大的钟表匠。',
        lore: '"给我物质的性质和运动，我就能计算出整个宇宙。" ——皮埃尔-西蒙·拉普拉斯',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    categories: { industry: 0.10 },
                    scienceBonus: 0.06,
                    cultureBonus: -0.03,
                    triggerEffects: [
                        // 工业建筑数量 → 科研加成（每8座触发一组）
                        { type: 'building_count_bonus', category: 'industry', per: 8, bonus: { scienceBonus: 0.04 }, cap: 0.35 },
                    ],
                },
                {
                    categories: { industry: 0.14 },
                    scienceBonus: 0.10,
                    production: 0.04,
                    cultureBonus: -0.03,  // 惩罚不再加重
                    converters: [
                        // 工业建筑 → 科研（工业化推动科学）
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0012, target: 'scienceBonus', cap: 0.50 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.001, target: 'production', cap: 0.40 },
                    ],
                    triggerEffects: [
                        { type: 'building_count_bonus', category: 'industry', per: 6, bonus: { scienceBonus: 0.05 }, cap: 0.45 },
                        // 工厂数量 → 科研+产出（工厂是机械化思维的实验场）
                        { type: 'building_specific_bonus', buildingId: 'factory', per: 30, bonus: { scienceBonus: 0.030, production: 0.015 }, cap: 0.45 },
                    ],
                },
                {
                    categories: { industry: 0.18 },
                    scienceBonus: 0.15,
                    production: 0.08,
                    stability: -3,
                    cultureBonus: -0.04,
                    maxPop: -0.02,
                    onEvents: [
                        { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '机械化浪潮', buffId: 'mechanization_wave', duration: 200, effects: { categories: { industry: 0.20 }, scienceBonus: 0.18, production: 0.12 } }, cooldownDays: 90 },
                    ],
                    converters: [
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', cap: 0.65 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0013, target: 'production', cap: 0.55 },
                    ],
                    triggerEffects: [
                        { type: 'building_count_bonus', category: 'industry', per: 5, bonus: { scienceBonus: 0.06 }, cap: 0.55 },
                        // 条件翻转：工业化程度高时机械化思维更强
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 45,
                            normalBonus: {},
                            flippedBonus: { scienceBonus: 0.06, categories: { industry: 0.04 } } },
                        // 工厂数量 → 科研+产出+工业（工厂帝国全面开花）
                        { type: 'building_specific_bonus', buildingId: 'factory', per: 20, bonus: { scienceBonus: 0.035, production: 0.018, categories: { industry: 0.010 } }, cap: 0.60 },
                        // 逆向缩放：工业化越高，文化惩罚越大（机器吃掉人性）
                        { type: 'inverse_scaling', source: 'categories.industry', threshold: 0.30, aboveBonus: { cultureBonus: -0.01 }, belowBonus: {}, cap: 6 },
                    ],
                },
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
        desc: '一滴水会干涸，大海却永不枯竭，个人的力量微不足道，团结却能移山填海。',
        lore: '"团结就是力量。" ——《国际歌》',
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
        desc: '每个人都是自己生命的船长，自由是灵魂最宝贵的呼吸。',
        lore: '"不自由，毋宁死。" ——帕特里克·亨利',
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
        desc: '王侯将相宁有种乎？才德高者居上位，这是比血统更公平的法则。',
        lore: '"选贤与能，讲信修睦。" ——《礼记·大同》',
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
                    ruleMods: [
                        // 贤能主义提升官员体系效率
                        { type: 'official_bonus', scope: 'all', value: 0.12 },
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
                    ruleMods: [
                        { type: 'official_bonus', scope: 'all', value: 0.18 },
                    ],
                    triggerEffects: [
                        { type: 'conditional_flip', condition: 'stability_below', threshold: 35,
                            normalBonus: { scienceBonus: 0.02 },
                            flippedBonus: { stability: -4, scienceBonus: -0.03 } },
                        // 贤能官员派系：每8名官员提供科研加成（人才选拔带来知识积累）
                        { type: 'official_faction_bonus', faction: '贤士', per: 8, bonus: { scienceBonus: 0.012, stability: 0.4 }, cap: 0.25 },
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
        desc: '他们用汗水建造了城市，用鲜血浇灌了工厂，现在，他们要夺回属于自己的尊严。',
        lore: '"全世界无产者，联合起来！" ——卡尔·马克思、弗里德里希·恩格斯',
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
        desc: '皇天无亲，惟德是辅。天命可予亦可夺，有道者居之，无道者失之。',
        lore: '"天视自我民视，天听自我民听。" ——《尚书·泰誓》',
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
        lore: '"他通常既不打算促进公共的利益，也不知道自己能在什么程度上促进那种利益。" ——亚当·斯密《国富论》',
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
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.002, target: 'taxIncome', targetType: 'bonus', cap: 0.50 },
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
        desc: '敢于运用你自己的理性！走出自我招致的不成熟状态，这是启蒙的箴言。',
        lore: '"Sapere aude! 敢于知道！" ——伊曼努尔·康德',
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
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', targetType: 'bonus', cap: 0.35 },
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
        desc: '当国界成为地图上的虚线，当战争成为博物馆里的记忆，人类才能真正称得上文明。',
        lore: '"永久和平不是一个空洞的理想，而是一个逐步实现的任务。" ——伊曼努尔·康德',
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
                        { source: 'population', sourceType: 'population', ratio: 0.0000012, target: 'cultureBonus', targetType: 'bonus', cap: 0.35 },
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
        desc: '火种是从诸神那里盗来的，既然已经点燃，就让火焰烧尽一切蒙昧，照亮人类的命运。',
        lore: '"我现在是一切，知道一切，经历过一切。" ——普罗米修斯',
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
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.002, target: 'scienceBonus', targetType: 'bonus', cap: 0.50 },
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
        lore: '"矛盾是一切运动和生命力的根源。" ——黑格尔',
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
        lore: '"最大多数人的最大幸福，是衡量对与错的标准。" ——杰里米·边沁',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { taxIncome: 0.04, needsReduction: 0.03 },
                { taxIncome: 0.06, needsReduction: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000005, target: 'taxIncome', cap: 0.45 },
                    ] },
                { taxIncome: 0.04, needsReduction: 0.03,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000005, target: 'taxIncome', cap: 0.45 },
{ source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.0001, target: 'stability', cap: 6 },
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
        desc: '没有什么是真的，一切皆被允许，在意义的废墟上，人终于获得了彻底的自由。',
        lore: '"上帝已死。" ——弗里德里希·尼采',
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
        desc: '自然界不相信怜悯，强者吞噬弱者是宇宙的铁律，人类社会不过是丛林法则的延续。',
        lore: '"适者生存。" ——赫伯特·斯宾塞',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.05, stability: -2 },
                { industryBonus: 0.08, stability: -2,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.000005, target: 'production', cap: 0.35 },
                    ] },
                { industryBonus: 0.12, stability: -2, militaryBonus: 0.08,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.000005, target: 'production', cap: 0.35 },
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
        desc: '每一个文本都在自我消解，每一个意义都隐含着相反的种子，真理只是语言的幻术。',
        lore: '"文本之外无一物。" ——雅克·德里达',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.06, taxIncome: -0.03 },
                { cultureBonus: 0.09, taxIncome: -0.03,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0012, target: 'cultureBonus', cap: 0.35 },
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
        desc: '人是系在动物与超人之间的一根绳索，一根悬在深渊之上的绳索。',
        lore: '"人是一根系在动物与超人之间的绳索——一根悬在深渊之上的绳索。" ——弗里德里希·尼采',
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
{ type: 'official_faction_bonus', faction: 'military', per: 5, bonus: { militaryBonus: 0.03 }, cap: 0.45 },
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
        desc: '一切有为法，如梦幻泡影，在轮回的苦海中，觉醒是唯一的彼岸。',
        lore: '"众生皆苦。" ——佛陀',
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
        desc: '末日钟声已经敲响，在审判的火焰中，义人将升天，罪人将坠落。',
        lore: '"末日将至，我将亲见上帝。" ——《启示录》',
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
        desc: '流水不争先，争的是滔滔不绝。顺势而为，万物自化。',
        lore: '"道可道，非常道。" ——老子',
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
        desc: '剑刃上闪耀着神圣的光芒，为信仰而战，是通往天堂最短的路。',
        lore: '"信仰是一场奋斗。" ——《古兰经》',
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
        lore: '"我的上帝创造了宇宙，然后让它按照自然法则运行。" ——伏尔泰',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, stability: 2 },
                { scienceBonus: 0.06, stability: 3 },
                { scienceBonus: 0.10, stability: 5,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000005, target: 'scienceBonus', cap: 0.45 },
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
        name: '联邦制',
        category: 'politics',
        icon: 'Landmark',
        color: 'text-red-400',
        unlockEpoch: 4,
        desc: '合众国为一，各州为众，在差异中求统一，在分权中见共和。',
        lore: '"我们，人民……" ——美国宪法序言',        rarity: 'uncommon',
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
        desc: '国家即是一切，国家之外无物存在，每一个思想、每一句话语、每一次呼吸都服从于一个意志。',
        lore: '"老大哥在看着你。" ——乔治·奥威尔',
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
        desc: '当巨人们相互牵制，弱者才能在夹缝中呼吸，平衡是生存的艺术。',
        lore: '"没有永远的朋友，只有永远的利益。" ——亨利·约翰·坦普尔',
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
        desc: '历史不会自动向前，需要一群觉悟者走在最前面，用火焰点燃黑暗。',
        lore: '"没有革命的理论，就没有革命的运动。" ——弗拉基米尔·列宁',
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
{ type: 'official_faction_bonus', faction: 'academic', per: 5, bonus: { scienceBonus: 0.03 }, cap: 0.45 },
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
        desc: '远人来朝，不靠刀剑而靠德泽，以礼让换忠诚，以恩惠换臣服。',
        lore: '"远人不服，则修文德以来之。" ——孔子',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                {
                    taxIncome: 0.05,
                    cultureBonus: 0.03,
                    triggerEffects: [
                        // 基础：按步兵数量给予税收加成（象征朝贡护卫）
                        { type: 'unit_count_bonus', category: 'infantry', per: 500, bonus: { taxIncome: 0.01 }, cap: 0.15 },
                    ],
                },
                {
                    taxIncome: 0.08,
                    cultureBonus: 0.05,
                    converters: [
                        // 核心机制：附庸贡献税收
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.05, target: 'taxIncome', cap: 0.60 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.03, target: 'cultureBonus', cap: 0.30 },
                    ],
                    triggerEffects: [
                        { type: 'unit_count_bonus', category: 'infantry', per: 500, bonus: { taxIncome: 0.01 }, cap: 0.20 },
                    ],
                    ruleMods: [
                        { type: 'diplomatic_influence', value: 0.10 },
                    ],
                },
                {
                    taxIncome: 0.12,
                    cultureBonus: 0.08,
                    converters: [
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.08, target: 'taxIncome', cap: 0.80 },
                        { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.05, target: 'cultureBonus', cap: 0.40 },
                        // 新增：友好国家也能贡献（无附庸时仍有成长性）
                        { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.02, target: 'taxIncome', cap: 0.30 },
                    ],
                    onEvents: [
                        { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '万国来朝', buffId: 'all_nations_tribute', duration: 180, effects: { taxIncome: 0.15, cultureBonus: 0.10 } }, cooldownDays: 60 },
                    ],
                    triggerEffects: [
                        { type: 'unit_count_bonus', category: 'infantry', per: 500, bonus: { taxIncome: 0.012 }, cap: 0.25 },
                        // 条件翻转：稳定度高时获得额外加成
                        { type: 'conditional_flip', condition: 'stability_above', threshold: 70, normalBonus: {}, flippedBonus: { cultureBonus: 0.05, taxIncome: 0.03 } },
                    ],
                    ruleMods: [
                        { type: 'maintenance_cost_mod', scope: 'infantry', value: -0.15 },
                        { type: 'diplomatic_influence', value: 0.15 },
                    ],
                },
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
        desc: '人民的呼声高于一切法律和制度，当精英背叛了人民，唯有人民的意志才是神圣的。',
        lore: '"人民的声音就是上帝的声音。" ——西塞罗',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { stability: 3, taxIncome: -0.03, approval: { peasant: 5, unemployed: 4 } },
                { stability: 3, taxIncome: -0.03, approval: { peasant: 7, unemployed: 5 }, organizationGrowthMod: 0.08,
                    converters: [
{ source: 'poorPop', sourceType: 'poorPop', ratio: 0.00005, target: 'stability', cap: 5 },
                    ] },
                { stability: 3, taxIncome: -0.03, approval: { peasant: 9, unemployed: 7 }, organizationGrowthMod: 0.12,
                    converters: [
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.00005, target: 'stability', cap: 5 },
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
        desc: '黄金是永恒的锚，在这片动荡的海洋上，唯有它能让货币稳如磐石。',
        lore: '"黄金是最好的货币，也是最坏的主人。" ——谚语',
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
        desc: '市场的混乱是一头野兽，只有国家的铁腕才能驯服它，每一个齿轮都在计划中转动。',
        lore: '"我们将在五年内实现工业化。" ——约瑟夫·斯大林',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { industryBonus: 0.06, production: 0.04, needsReduction: 0.03,
                    ruleMods: [
                        // 计划经济降低工业建筑的原料消耗（集中调配提升效率）
                        { type: 'building_input_mod', scope: 'industry', value: -0.10 },
                    ],
                },
                { industryBonus: 0.09, production: 0.06, needsReduction: 0.05,
                    ruleMods: [
                        { type: 'price_volatility_mod', value: -0.25 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.12 },
                        { type: 'building_input_mod', scope: 'industry', value: -0.15 },
                    ] },
                { industryBonus: 0.12, production: 0.08, needsReduction: 0.08,
                    ruleMods: [
                        { type: 'price_volatility_mod', value: -0.30 },
                        { type: 'building_cost_mod', scope: 'industry', value: -0.18 },
                        { type: 'building_input_mod', scope: 'industry', value: -0.20 },
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
        desc: '高墙之内是另一个世界，领主赐予土地与庇护，农奴献上劳作与忠诚，各安天命。',
        lore: '"农奴是附属于土地的。" ——《查士丁尼法典》',
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
        desc: '谁控制了海洋，谁就控制了世界的财富，帆影所至，皆是黄金。',
        lore: '"谁控制了海洋，谁就控制了世界。" ——阿尔弗雷德·马汉',
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
        desc: '金钱从不睡眠，它在华尔街的玻璃塔里流动，在伦敦的交易所里呼吸，它统治着一切，却从不露面。',
        lore: '"金钱没有祖国。" ——内森·梅耶·罗斯柴尔德',
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
        desc: '既然资本家不会给工人公平，工人何不自己成为主人？一人一票，共担风险，共享果实。',
        lore: '"劳动者应当成为自己的雇主。" ——罗伯特·欧文',
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
        desc: '手握利剑，心存荣耀，为弱者而战，为誓言而死，这就是骑士的信仰。',
        lore: '"骑士之花，为荣誉而绽放。" ——《罗兰之歌》',
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
                { type: 'unit_count_bonus', category: 'cavalry', per: 300, bonus: { militaryBonus: 0.01 }, cap: 0.30 },
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
        desc: '石头比血肉更忠诚，让敌人在城墙下撞碎他们的野心。',
        lore: '"最好的防守就是防守本身。" ——塞巴斯蒂安·勒普雷斯特·德·沃邦',
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
        desc: '铁蹄踏破黎明，坦克碾碎边界，在敌人反应之前，战争已经结束。',
        lore: '"速度就是装甲。" ——海因茨·古德里安',
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
        desc: '敌人进攻，我们后退；敌人驻扎，我们骚扰；敌人疲惫，我们进攻；敌人后退，我们追击。',
        lore: '"兵民是胜利之本。" ——毛泽东',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.04, stability: 2 },
                { militaryBonus: 0.04, stability: 2,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000003, target: 'militaryBonus', cap: 0.45 },
                    ],
                    ruleMods: [
                        { type: 'recruit_cost_mod', scope: 'infantry', value: -0.2 },
                    ] },
                { militaryBonus: 0.04, stability: 2,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000003, target: 'militaryBonus', cap: 0.45 },
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
        desc: '骑士的荣耀在火药的烟雾中消散，从此，战争的法则被彻底重写。',
        lore: '"上帝创造人类，但火药使他们平等。" ——谚语',
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
        lore: '"我们必须警惕军事工业复合体获得不应有的影响力。" ——德怀特·艾森豪威尔',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { militaryBonus: 0.05, industryBonus: 0.05, stability: -3 },
                { militaryBonus: 0.08, industryBonus: 0.08, stability: -3,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.002, target: 'industryBonus', cap: 0.45 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0015, target: 'militaryBonus', cap: 0.35 },
                    ] },
                { militaryBonus: 0.12, industryBonus: 0.12, stability: -2,
                    converters: [
                        { source: 'military', sourceType: 'buildingCount', ratio: 0.002, target: 'industryBonus', cap: 0.45 },
                        { source: 'industry', sourceType: 'buildingCount', ratio: 0.0015, target: 'militaryBonus', cap: 0.35 },
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
        desc: '希腊的智慧、罗马的荣光，在一千年后重新点燃，人再次站在宇宙的中心。',
        lore: '"人是万物的尺度。" ——普罗泰戈拉',
        rarity: 'rare',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.06, scienceBonus: 0.04 },
                { cultureBonus: 0.09, scienceBonus: 0.06,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', cap: 0.35 },
                    ] },
                { cultureBonus: 0.13, scienceBonus: 0.09,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', cap: 0.35 },
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
        desc: '摒弃一切装饰，让形式追随功能，美，就是最高效的设计。',
        lore: '"少即是多。" ——密斯·凡·德·罗',
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
        desc: '笔走龙蛇之间，黑白交错之际，文字本身就是最崇高的艺术。',
        lore: '"书者，如也，如其学，如其才，如其志。" ——刘熙载',
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
        desc: '在文字诞生之前，故事便已存在，它们活在歌谣里、活在吟唱中、活在每一个篝火旁的记忆深处。',
        lore: '"从一个人的口中传到另一个人的耳中，这是最古老的学校。" ——非洲谚语',
        rarity: 'common',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.03, stability: 2 },
                { cultureBonus: 0.05, stability: 4,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000004, target: 'cultureBonus', cap: 0.35 },
                    ] },
                { cultureBonus: 0.08, stability: 6, needsReduction: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000004, target: 'cultureBonus', cap: 0.35 },
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
        desc: '石头堆砌的不只是房屋，而是一个时代的精神，当文字化为灰烬，唯有建筑仍在诉说。',
        lore: '"建筑是凝固的音乐。" ——歌德',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { cultureBonus: 0.03, stability: 2 },
                { cultureBonus: 0.04, stability: 3,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0012, target: 'cultureBonus', cap: 0.30 },
                    ] },
                { cultureBonus: 0.04, stability: 3,
                    converters: [
                        { source: 'civic', sourceType: 'buildingCount', ratio: 0.0012, target: 'cultureBonus', cap: 0.30 },
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
        desc: '在坩埚的火焰中，在神秘的符号里，炼金术士追寻着物质与灵魂的双重转化。',
        lore: '"如上所示，如在下所示。" ——《翡翠石板》',
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
        desc: '翻开自然的书页，每一个物种都是造物主写下的诗行。',
        lore: '"物竞天择，适者生存。" ——查尔斯·达尔文',
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
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.0015, target: 'scienceBonus', cap: 0.55 },
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
        lore: '"整体大于部分之和。" ——路德维希·贝塔朗菲',
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
        desc: '文明的本质由它的材料定义，石器时代、青铜时代、钢铁时代……下一个是什么？',
        lore: '"材料是文明的骨骼。" ——材料科学谚语',
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
        desc: '比特是宇宙的原子，当一切都可以被编码，一切都可以被复制，一切都可以被创造。',
        lore: '"信息是消除不确定性的东西。" ——克劳德·香农',
        rarity: 'legendary',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.08, cultureBonus: 0.05 },
                { scienceBonus: 0.12, cultureBonus: 0.07,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000005, target: 'scienceBonus', cap: 0.2 },
                    ] },
                { scienceBonus: 0.16, cultureBonus: 0.10,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000005, target: 'scienceBonus', cap: 0.2 },
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
        desc: '以法律之名画下鸿沟，肤色决定命运，血统定义等级，分离即是秩序。',
        lore: '"没有任何人天生就应该被歧视。" ——纳尔逊·曼德拉',
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
                        { source: 'poorPop', sourceType: 'poorPop', ratio: 0.000005, target: 'industryBonus', cap: 0.35 },
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
        desc: '让知识之光照进每一个角落，教育不是特权，而是每一个孩子应得的权利。',
        lore: '"教育是最强大的武器，你可以用它来改变世界。" ——纳尔逊·曼德拉',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { scienceBonus: 0.04, cultureBonus: 0.03 },
                { scienceBonus: 0.06, cultureBonus: 0.05,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000003, target: 'scienceBonus', cap: 0.35 },
                    ] },
                { scienceBonus: 0.10, cultureBonus: 0.08, stability: 3,
                    converters: [
                        { source: 'population', sourceType: 'population', ratio: 0.0000003, target: 'scienceBonus', cap: 0.35 },
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
        desc: '帐篷是我的城堡，草原是我的国度，没有围墙能困住真正的自由。',
        lore: '"我的家在我的背上。" ——蒙古谚语',
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
        desc: '看不见的杀手比千军万马更可怕，干净的水、清洁的空气，比任何城墙更能守护城市。',
        lore: '"预防胜于治疗。" ——希波克拉底',
        rarity: 'uncommon',
        weightModifiers: [],
        effects: {
            levels: [
                { maxPop: 0.05, stability: 2 },
                { maxPop: 0.05, stability: 2, needsReduction: 0.05,
                    converters: [
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.000005, target: 'production', cap: 0.60 },
                    ] },
                { maxPop: 0.05, stability: 2, needsReduction: 0.05,
                    converters: [
                        { source: 'wealthyPop', sourceType: 'wealthyPop', ratio: 0.000005, target: 'production', cap: 0.60 },
                        { source: 'population', sourceType: 'population', ratio: 0.0000004, target: 'maxPop', cap: 0.45 },
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
        desc: '在数字世界里，代码是宪法，加密是盾牌，隐私不是特权，而是自由的最后防线。',
        lore: '"密码学代码就是言论自由。" ——埃里克·休斯',
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
        desc: '没有自由的劳动力，但劳动力有保障，农奴被绑在土地上，却也永远不会失去土地。',
        lore: '"农奴是土地的一部分。" ——古罗马法谚',
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
        desc: '帝国的边疆不是城墙，而是海岸线，谁统治波浪，谁就统治世界的血脉。',
        lore: '"大英帝国的边疆在每一片海岸。" ——帕麦斯顿勋爵',
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
        desc: '城邦的命运应交由最智慧的人来掌舵，真理与权力的结合，是最高的政治理想。',
        lore: '"除非哲学家成为国王，或者国王成为哲学家，否则城邦的苦难永无止境。" ——柏拉图',
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
        desc: '己所不欲，勿施于人，这是人类发现的唯一普世法则，跨越一切文明的边界。',
        lore: '"己所不欲，勿施于人。" ——孔子',
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
        desc: '将未知变成已知，将想象变成坐标，每一条新的海岸线，都是世界的又一次睁开眼睛。',
        lore: '"地图不是疆域，但疆域需要地图。" ——阿尔弗雷德·科日布斯基',
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
        desc: '地球不是我们从祖先那里继承的遗产，而是从子孙那里借来的信托。',
        lore: '"我们不是从祖先那里继承了地球，而是从子孙那里借来的。" ——美洲原住民谚语',
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
                        { source: 'gather', sourceType: 'buildingCount', ratio: 0.002, target: 'production', cap: 0.45 },
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
