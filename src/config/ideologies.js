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
 * 首批约30个理念，覆盖8个分类各3-4个
 * 每个理念包含：id / name / category / icon / color / unlockEpoch / desc / rarity /
 * weightModifiers / effects.levels（3级）/ effects.triggerEffects
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
                { stability: 5, cultureBonus: 0.05 },
                { stability: 8, cultureBonus: 0.08, categories: { civic: 0.05 } },
                { stability: 12, cultureBonus: 0.12, categories: { civic: 0.08 }, maxPop: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'cleric', bonus: { perPopPassive: { culture: 0.01 } } },
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
                { cultureBonus: 0.08, categories: { gather: 0.03 } },
                { cultureBonus: 0.12, categories: { gather: 0.05 }, stability: 3 },
                { cultureBonus: 0.16, categories: { gather: 0.08 }, stability: 5, maxPop: 0.02 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'gather', per: 5, bonus: { categories: { gather: 0.03 } } },
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
                { stability: 4, maxPop: 0.03 },
                { stability: 6, maxPop: 0.05, categories: { civic: 0.03 } },
                { stability: 10, maxPop: 0.08, categories: { civic: 0.05 }, cultureBonus: 0.05 },
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
                { stability: 8, cultureBonus: 0.03 },
                { stability: 12, cultureBonus: 0.06, maxPop: 0.04 },
                { stability: 18, cultureBonus: 0.10, maxPop: 0.06, categories: { civic: 0.05 } },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'culture', threshold: 500, bonus: { stability: 5, cultureBonus: 0.05 } },
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
                { scienceBonus: 0.05, maxPop: 0.03 },
                { scienceBonus: 0.08, maxPop: 0.05, cultureBonus: 0.03 },
                { scienceBonus: 0.12, maxPop: 0.08, cultureBonus: 0.06, stability: 3 },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { flatPop: 5 } },
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
                { scienceBonus: 0.08, categories: { industry: 0.03 } },
                { scienceBonus: 0.12, categories: { industry: 0.05 }, cultureBonus: 0.03 },
                { scienceBonus: 0.16, categories: { industry: 0.08 }, cultureBonus: 0.05, stability: 3 },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { scienceBonus: 0.002 } },
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
                { cultureBonus: 0.08, stability: -3 },
                { cultureBonus: 0.12, scienceBonus: 0.05, stability: -3 },
                { cultureBonus: 0.18, scienceBonus: 0.08, stability: -2, production: 0.05 },
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
                { scienceBonus: 0.08, cultureBonus: 0.05 },
                { scienceBonus: 0.12, cultureBonus: 0.08, categories: { civic: 0.03 } },
                { scienceBonus: 0.16, cultureBonus: 0.12, categories: { civic: 0.06 }, stability: 5 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'scholar', bonus: { perPopPassive: { science: 0.02 } } },
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
                { stability: 8, incomePercent: 0.03 },
                { stability: 12, incomePercent: 0.05, categories: { military: 0.03 } },
                { stability: 18, incomePercent: 0.08, categories: { military: 0.05 }, maxPop: 0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { stability: -1 } }, // 随时代推移效果递减
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
                { stability: 5, categories: { civic: 0.05 } },
                { stability: 8, categories: { civic: 0.08 }, scienceBonus: 0.03 },
                { stability: 12, categories: { civic: 0.12 }, scienceBonus: 0.05, cultureBonus: 0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { silver: 0.01 } } },
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
                { militaryBonus: 0.05, stability: 5 },
                { militaryBonus: 0.08, stability: 8, categories: { industry: 0.03 } },
                { militaryBonus: 0.12, stability: 12, categories: { industry: 0.06 }, maxPop: 0.05 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.005, target: 'militaryPower' },
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
                { stability: 8, categories: { civic: 0.05 } },
                { stability: 12, categories: { civic: 0.08 }, scienceBonus: 0.03 },
                { stability: 18, categories: { civic: 0.12 }, scienceBonus: 0.06, cultureBonus: 0.05 },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'culture', threshold: 300, bonus: { production: 0.03, stability: 3 } },
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
                { incomePercent: 0.05, taxIncome: 0.03 },
                { incomePercent: 0.08, taxIncome: 0.05, categories: { industry: 0.03 } },
                { incomePercent: 0.12, taxIncome: 0.08, categories: { industry: 0.05 }, stability: 3 },
            ],
            triggerEffects: [
                { type: 'chain_count_bonus', countType: 'complete', perCount: { incomePercent: 0.02 } },
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
                { categories: { industry: 0.08 }, incomePercent: 0.05 },
                { categories: { industry: 0.12 }, incomePercent: 0.08, production: 0.03 },
                { categories: { industry: 0.16 }, incomePercent: 0.12, production: 0.06, stability: -3 },
            ],
            triggerEffects: [
                { type: 'chain_count_bonus', countType: 'complete', perCount: { categories: { industry: 0.05 } } },
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
                { categories: { gather: 0.08 }, maxPop: 0.03 },
                { categories: { gather: 0.12 }, maxPop: 0.05, stability: 3 },
                { categories: { gather: 0.16 }, maxPop: 0.08, stability: 5, incomePercent: 0.03 },
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
                { categories: { industry: 0.08 }, production: 0.03 },
                { categories: { industry: 0.12 }, production: 0.06, incomePercent: 0.05 },
                { categories: { industry: 0.18 }, production: 0.10, incomePercent: 0.08, stability: -5 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'industry', per: 10, bonus: { production: 0.03 } },
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
                { militaryBonus: 0.10, stability: 3 },
                { militaryBonus: 0.15, stability: 5, categories: { military: 0.05 } },
                { militaryBonus: 0.22, stability: 8, categories: { military: 0.08 }, production: -0.03 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'soldier', ratio: 0.02, target: 'militaryPower' },
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
                { stability: 10, cultureBonus: 0.05, militaryBonus: -0.10 },
                { stability: 15, cultureBonus: 0.08, scienceBonus: 0.05, militaryBonus: -0.10 },
                { stability: 22, cultureBonus: 0.12, scienceBonus: 0.08, militaryBonus: -0.08, production: 0.05 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.01, stability: 1 } },
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
                { militaryBonus: 0.05 },
                { militaryBonus: 0.08, stability: 3 },
                { militaryBonus: 0.12, stability: 5, maxPop: -0.02 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.01, target: 'militaryPower' },
                { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.005, target: 'militaryPower' },
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
                { incomePercent: 0.05, militaryBonus: 0.05 },
                { incomePercent: 0.08, militaryBonus: 0.08, categories: { industry: 0.03 } },
                { incomePercent: 0.12, militaryBonus: 0.12, categories: { industry: 0.05 }, production: 0.03 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'military', per: 5, bonus: { incomePercent: 0.02 } },
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
                { cultureBonus: 0.08, stability: 3 },
                { cultureBonus: 0.12, stability: 5, categories: { civic: 0.03 } },
                { cultureBonus: 0.18, stability: 8, categories: { civic: 0.06 }, scienceBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'civic', per: 10, bonus: { cultureBonus: 0.03 } },
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
                { cultureBonus: 0.10, stability: -3 },
                { cultureBonus: 0.15, scienceBonus: 0.03, stability: -3 },
                { cultureBonus: 0.22, scienceBonus: 0.06, stability: -2, maxPop: 0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.015 } },
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
                { cultureBonus: 0.12 },
                { cultureBonus: 0.18, categories: { civic: 0.05 } },
                { cultureBonus: 0.25, categories: { civic: 0.08 }, stability: 5 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'civic', per: 5, bonus: { perPopPassive: { culture: 0.001 } } },
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
                { scienceBonus: 0.08 },
                { scienceBonus: 0.12, categories: { gather: 0.03 } },
                { scienceBonus: 0.18, categories: { gather: 0.05 }, cultureBonus: 0.05 },
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
                { scienceBonus: 0.10, production: 0.03 },
                { scienceBonus: 0.15, production: 0.05, categories: { industry: 0.03 } },
                { scienceBonus: 0.22, production: 0.08, categories: { industry: 0.06 }, cultureBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'tech_count_bonus', perTech: { production: 0.001 } },
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
                { scienceBonus: 0.08, categories: { industry: 0.05 } },
                { scienceBonus: 0.12, categories: { industry: 0.08 }, production: 0.05 },
                { scienceBonus: 0.18, categories: { industry: 0.12 }, production: 0.08, stability: -3 },
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
                { stability: 8, production: 0.03, maxPop: -0.03 },
                { stability: 12, production: 0.05, categories: { gather: 0.03 }, maxPop: -0.03 },
                { stability: 18, production: 0.08, categories: { gather: 0.06 }, maxPop: -0.02, cultureBonus: -0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'peasant', bonus: { perPopPassive: { food: 0.003 } } },
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
                { stability: 5, maxPop: 0.05, cultureBonus: 0.03 },
                { stability: 8, maxPop: 0.08, cultureBonus: 0.05, scienceBonus: 0.03 },
                { stability: 12, maxPop: 0.12, cultureBonus: 0.08, scienceBonus: 0.05, production: 0.03 },
            ],
            triggerEffects: [
                { type: 'resource_threshold', resource: 'culture', threshold: 1000, bonus: { maxPop: 0.05, stability: 5 } },
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
                { scienceBonus: 0.05, incomePercent: 0.03, maxPop: -0.02 },
                { scienceBonus: 0.08, incomePercent: 0.05, categories: { industry: 0.03 }, maxPop: -0.02 },
                { scienceBonus: 0.12, incomePercent: 0.08, categories: { industry: 0.06 }, maxPop: -0.02, stability: -3 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'noble', bonus: { perPopPassive: { silver: 0.02 } } },
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
                { stability: 8, categories: { civic: 0.05 }, cultureBonus: 0.03 },
                { stability: 12, categories: { civic: 0.08 }, cultureBonus: 0.05, scienceBonus: 0.03 },
                { stability: 18, categories: { civic: 0.12 }, cultureBonus: 0.08, scienceBonus: 0.05, maxPop: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { culture: 0.005 } } },
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
                { categories: { gather: 0.06 }, stability: 3 },
                { categories: { gather: 0.10 }, stability: 5, cultureBonus: 0.03 },
                { categories: { gather: 0.14 }, stability: 8, cultureBonus: 0.05, maxPop: 0.02 },
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
                { cultureBonus: 0.06, stability: 5 },
                { cultureBonus: 0.10, stability: 8, scienceBonus: 0.03 },
                { cultureBonus: 0.15, stability: 12, scienceBonus: 0.05, maxPop: 0.03 },
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
                { stability: 10, production: 0.03 },
                { stability: 15, production: 0.05, cultureBonus: 0.03 },
                { stability: 20, production: 0.08, cultureBonus: 0.05, militaryBonus: 0.03 },
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
                { stability: 8, categories: { civic: 0.05 } },
                { stability: 12, categories: { civic: 0.08 }, cultureBonus: 0.05 },
                { stability: 16, categories: { civic: 0.12 }, cultureBonus: 0.08, scienceBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'official', bonus: { perPopPassive: { culture: 0.02 } } },
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
                { stability: 5, production: 0.06, cultureBonus: -0.03 },
                { stability: 8, production: 0.10, categories: { industry: 0.03 }, cultureBonus: -0.03 },
                { stability: 12, production: 0.14, categories: { industry: 0.06 }, militaryBonus: 0.05, cultureBonus: -0.02 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'industry', per: 5, bonus: { stability: 1 } },
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
                { production: 0.06, scienceBonus: 0.05 },
                { production: 0.10, scienceBonus: 0.08, categories: { industry: 0.03 } },
                { production: 0.14, scienceBonus: 0.12, categories: { industry: 0.06 }, incomePercent: 0.03 },
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
                { stability: 8, categories: { gather: 0.05 } },
                { stability: 12, categories: { gather: 0.08 }, incomePercent: 0.03 },
                { stability: 16, categories: { gather: 0.12 }, incomePercent: 0.05, militaryBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'landowner', bonus: { perPopPassive: { silver: 0.01 } } },
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
                { militaryBonus: 0.08, incomePercent: 0.05 },
                { militaryBonus: 0.12, incomePercent: 0.08, categories: { military: 0.03 } },
                { militaryBonus: 0.16, incomePercent: 0.12, categories: { military: 0.06 }, stability: -5 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'soldier', ratio: 0.01, target: 'militaryPower' },
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
                { production: 0.08, maxPop: 0.05, stability: -5, incomePercent: -0.05 },
                { production: 0.12, maxPop: 0.08, stability: -3, incomePercent: -0.03, categories: { industry: 0.05 } },
                { production: 0.18, maxPop: 0.12, stability: -2, categories: { industry: 0.08 }, militaryBonus: 0.05 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.003 } } },
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
                { categories: { industry: 0.05 }, stability: 3 },
                { categories: { industry: 0.08 }, stability: 5, production: 0.03 },
                { categories: { industry: 0.12 }, stability: 8, production: 0.05, cultureBonus: 0.03 },
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
                { stability: 10, maxPop: 0.05, incomePercent: -0.05 },
                { stability: 15, maxPop: 0.08, cultureBonus: 0.03, incomePercent: -0.03 },
                { stability: 22, maxPop: 0.12, cultureBonus: 0.05, scienceBonus: 0.03, incomePercent: -0.02 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { silver: 0.005 } } },
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
                { militaryBonus: 0.06, stability: 3 },
                { militaryBonus: 0.10, stability: 5, categories: { gather: 0.03 } },
                { militaryBonus: 0.15, stability: 8, categories: { gather: 0.05 }, maxPop: 0.03 },
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
                { militaryBonus: 0.10, production: -0.02 },
                { militaryBonus: 0.15, production: -0.02, stability: 3 },
                { militaryBonus: 0.22, stability: 5, categories: { military: 0.05 } },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'soldier', bonus: { perPopPassive: { silver: 0.005 } } },
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
                { militaryBonus: 0.12, categories: { industry: 0.05 }, stability: -5, cultureBonus: -0.05 },
                { militaryBonus: 0.18, categories: { industry: 0.08 }, stability: -5, cultureBonus: -0.03, production: 0.05 },
                { militaryBonus: 0.25, categories: { industry: 0.12 }, stability: -3, production: 0.08 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'industry', per: 5, bonus: { militaryBonus: 0.02 } },
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
                { cultureBonus: 0.08, incomePercent: -0.03 },
                { cultureBonus: 0.12, stability: 3, incomePercent: -0.02 },
                { cultureBonus: 0.18, stability: 5, categories: { civic: 0.05 } },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'civic', per: 5, bonus: { cultureBonus: 0.02 } },
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
                { cultureBonus: 0.12, scienceBonus: 0.05, stability: -5 },
                { cultureBonus: 0.18, scienceBonus: 0.08, stability: -3, production: 0.03 },
                { cultureBonus: 0.25, scienceBonus: 0.12, stability: -2, production: 0.05, maxPop: 0.03 },
            ],
            triggerEffects: [
                { type: 'epoch_scaling', perEpoch: { cultureBonus: 0.02 } },
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
                { cultureBonus: 0.05, stability: 5 },
                { cultureBonus: 0.08, stability: 8, maxPop: 0.02 },
                { cultureBonus: 0.12, stability: 12, maxPop: 0.04, categories: { gather: 0.03 } },
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
                { scienceBonus: 0.10, cultureBonus: -0.03 },
                { scienceBonus: 0.15, production: 0.03, cultureBonus: -0.02 },
                { scienceBonus: 0.22, production: 0.06, categories: { industry: 0.05 } },
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
                { scienceBonus: 0.05, categories: { gather: 0.03 } },
                { scienceBonus: 0.08, categories: { gather: 0.05 }, cultureBonus: 0.03 },
                { scienceBonus: 0.12, categories: { gather: 0.08 }, cultureBonus: 0.05, stability: 3 },
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
                { categories: { industry: 0.08 }, scienceBonus: 0.05 },
                { categories: { industry: 0.12 }, scienceBonus: 0.08, production: 0.03 },
                { categories: { industry: 0.16 }, scienceBonus: 0.12, production: 0.06, stability: -3 },
            ],
            triggerEffects: [
                { type: 'building_count_bonus', category: 'industry', per: 10, bonus: { scienceBonus: 0.03 } },
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
                { stability: 8, production: 0.05, cultureBonus: -0.02 },
                { stability: 12, production: 0.08, maxPop: 0.03, cultureBonus: -0.02 },
                { stability: 16, production: 0.12, maxPop: 0.05, militaryBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'pop_ratio_bonus', stratum: 'worker', ratio: 0.003, target: 'militaryPower' },
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
                { scienceBonus: 0.05, incomePercent: 0.05, stability: -3 },
                { scienceBonus: 0.08, incomePercent: 0.08, cultureBonus: 0.03, stability: -3 },
                { scienceBonus: 0.12, incomePercent: 0.12, cultureBonus: 0.05, production: 0.03, stability: -2 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'merchant', bonus: { perPopPassive: { silver: 0.015 } } },
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
                { scienceBonus: 0.05, stability: 5 },
                { scienceBonus: 0.08, stability: 8, categories: { civic: 0.03 } },
                { scienceBonus: 0.12, stability: 12, categories: { civic: 0.06 }, production: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'official', bonus: { perPopPassive: { science: 0.01 } } },
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
                { maxPop: 0.05, stability: -5, production: 0.03 },
                { maxPop: 0.08, stability: -3, production: 0.06, categories: { industry: 0.03 } },
                { maxPop: 0.12, stability: -2, production: 0.10, categories: { industry: 0.06 }, cultureBonus: 0.03 },
            ],
            triggerEffects: [
                { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { silver: 0.008 } } },
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
