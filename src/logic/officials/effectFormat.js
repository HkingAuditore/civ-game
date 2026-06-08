import { STRATA, RESOURCES, BUILDINGS } from '../../config';

/**
 * 官员效果格式化共享工具
 * 从 OfficialCard.jsx 抽取，供官员卡片与「全部加成汇总」面板共用。
 * getTargetName / formatEffect 行为与原卡片内实现保持一致。
 */

// 获取目标的显示名称
export const getTargetName = (target) => {
    const buildingDef = BUILDINGS.find(b => b.id === target);
    if (buildingDef) return buildingDef.name;
    if (STRATA[target]) return STRATA[target].name;
    if (RESOURCES[target]) return RESOURCES[target].name;
    const categoryNames = { gather: '采集', industry: '工业', civic: '民用', military: '军事', commerce: '商业' };
    if (categoryNames[target]) return categoryNames[target];
    if (target === 'silver') return '银币';
    if (target === 'food') return '粮食';
    if (target === 'culture') return '文化';
    if (target === 'science') return '科技';
    return target;
};

/**
 * 格式化单个效果的描述（完整汉化）
 * @returns {{ description: string, isGood: boolean }}
 */
export const formatEffect = (type, target, value) => {
    const targetName = target ? getTargetName(target, type) : null;
    const isPositive = value > 0;
    const absValue = Math.abs(value);
    let isGood = isPositive;
    let description = '';
    const formatScalar = (v) => {
        if (!Number.isFinite(v)) return v;
        const abs = Math.abs(v);
        if (abs >= 10) return v.toFixed(0);
        if (abs >= 1) return v.toFixed(1);
        return v.toFixed(2);
    };
    const pct = (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
    const num = (v) => `${v > 0 ? '+' : ''}${formatScalar(v)}`;

    switch (type) {
        // 建筑/类别产出
        case 'buildings': description = `${targetName}产出 ${pct(value)}`; break;
        case 'categories': description = `${targetName}类产出 ${pct(value)}`; break;

        // 贸易/税收
        case 'tradeBonus': description = `贸易利润 ${pct(value)}`; break;
        case 'taxEfficiency': description = `税收效率 ${pct(value)}`; break;
        case 'taxIncome': description = `税收加成 ${pct(value)}`; break;
        case 'taxBonus': description = `税收加成 ${pct(value)}`; break;

        // 立场产出（采集/工业产出，源自政治立场聚合）
        case 'gatherBonus': description = `采集产出 ${pct(value)}`; break;
        case 'industryBonus': description = `工业产出 ${pct(value)}`; break;

        // 建筑成本
        case 'buildingCostMod': isGood = value < 0; description = `建筑成本 ${pct(value)}`; break;

        // 被动产出
        case 'passive': description = `每日${targetName || '产出'} ${num(value)}`; break;
        case 'passivePercent':
            if (target === 'silver') {
                description = `银币收入 ${pct(value)}`;
            } else {
                description = `${targetName || '资源'}产出 ${pct(value)}`;
            }
            break;

        // 需求/消耗
        case 'stratumDemandMod': isGood = value < 0; description = `${targetName}消耗 ${pct(value)}`; break;
        case 'resourceDemandMod': isGood = value < 0; description = `${targetName}需求 ${pct(value)}`; break;
        case 'resourceSupplyMod': description = `${targetName}供给 ${pct(value)}`; break;
        case 'needsReduction': isGood = value > 0; description = `全民消耗 ${value > 0 ? '-' : '+'}${(absValue * 100).toFixed(0)}%`; break;

        // 人口
        case 'maxPop': description = `人口上限 ${pct(value)}`; break;
        case 'populationGrowth': description = `人口增长 ${pct(value)}`; break;

        // 科研/文化
        case 'researchSpeed': description = `科研产出 ${pct(value)}`; break;
        case 'cultureBonus': description = `文化产出 ${pct(value)}`; break;

        // 满意度/稳定度
        case 'approval': description = `${targetName || '全体'}满意度 ${isPositive ? '+' : ''}${formatScalar(value)}`; break;
        case 'coalitionApproval': description = `联盟满意度 ${isPositive ? '+' : ''}${formatScalar(value)}`; break;
        case 'legitimacyBonus': description = `合法性 ${pct(value)}`; break;
        case 'stability': description = `稳定度 ${pct(value)}`; break;

        // 军事
        case 'militaryBonus': description = `军队战力 ${pct(value)}`; break;
        case 'militaryUpkeep': isGood = value < 0; description = `军事维护 ${pct(value)}`; break;
        case 'wartimeProduction': description = `战时生产 ${pct(value)}`; break;
        case 'trainingSpeed': description = `训练速度 ${pct(value)}`; break;

        // 组织度
        case 'organizationDecay': isGood = value < 0; description = `组织度增速 ${pct(value)}`; break;

        // 外交
        case 'diplomaticBonus': description = `外交关系 ${isPositive ? '+' : ''}${formatScalar(value)}/日`; break;

        // 资源浪费
        case 'resourceWaste': isGood = value < 0; description = `${targetName || '资源'}浪费 ${pct(value)}`; break;

        // 派系冲突
        case 'factionConflict': isGood = value < 0; description = `派系冲突 ${value > 0 ? '-' : '+'}${(Math.abs(value) * 100).toFixed(0)}%稳定`; break;

        // 腐败
        case 'corruption': isGood = value < 0; description = `腐败 ${value > 0 ? '-' : '+'}${(Math.abs(value) * 100).toFixed(0)}%税收`; break;

        // 外交事件
        case 'diplomaticIncident': isGood = value < 0; description = `外交关系衰减 +${value.toFixed(1)}/日`; break;

        // 外交冷却
        case 'diplomaticCooldown': isGood = value < 0; description = `外交冷却 ${pct(value)}`; break;

        // 生产成本修正
        case 'productionInputCost':
            isGood = value < 0;
            description = `${targetName || '建筑'}原料消耗 ${pct(value)}`;
            break;

        // 其他
        case 'influenceBonus': description = `影响力 ${pct(value)}`; break;
        case 'wageModifier': isGood = value < 0; description = `薪俸成本 ${pct(value)}`; break;
        case 'corruptionMod': isGood = value < 0; description = `腐败程度 ${pct(value)}`; break;

        default: {
            // 尝试智能汉化未知类型
            const typeNames = {
                'production': '生产', 'bonus': '加成', 'penalty': '惩罚',
                'mod': '调整', 'rate': '速率', 'cost': '成本',
            };
            let cnType = type;
            Object.entries(typeNames).forEach(([en, cn]) => {
                cnType = cnType.replace(new RegExp(en, 'gi'), cn);
            });
            description = `${cnType}${targetName ? ` (${targetName})` : ''}: ${typeof value === 'number' && Math.abs(value) < 10 ? value.toFixed(2) : value}`;
        }
    }
    return { description, isGood };
};

// ========== 效果分类（用于汇总面板按类别分组）==========

/**
 * effect type -> 类别 key 映射
 */
export const EFFECT_CATEGORY = {
    // 生产
    buildings: 'production',
    categories: 'production',
    passive: 'production',
    passivePercent: 'production',
    wartimeProduction: 'production',
    productionInputCost: 'production',
    resourceWaste: 'production',
    gatherBonus: 'production',
    industryBonus: 'production',

    // 经济
    tradeBonus: 'economy',
    taxEfficiency: 'economy',
    taxIncome: 'economy',
    taxBonus: 'economy',
    buildingCostMod: 'economy',
    corruption: 'economy',

    // 需求/资源
    stratumDemandMod: 'demand',
    resourceDemandMod: 'demand',
    resourceSupplyMod: 'demand',
    needsReduction: 'demand',

    // 人口/科研
    maxPop: 'population',
    populationGrowth: 'population',
    researchSpeed: 'population',
    cultureBonus: 'population',

    // 政治/稳定
    approval: 'politics',
    coalitionApproval: 'politics',
    legitimacyBonus: 'politics',
    stability: 'politics',
    organizationDecay: 'politics',
    factionConflict: 'politics',

    // 军事
    militaryBonus: 'military',
    militaryUpkeep: 'military',
    trainingSpeed: 'military',

    // 外交
    diplomaticBonus: 'diplomacy',
    diplomaticCooldown: 'diplomacy',
    diplomaticIncident: 'diplomacy',
};

/**
 * 类别展示顺序
 */
export const CATEGORY_ORDER = [
    'production',
    'economy',
    'demand',
    'population',
    'politics',
    'military',
    'diplomacy',
    'other',
];

/**
 * 类别元信息：中文名 + 图标 + 主题色
 */
export const CATEGORY_META = {
    production: { name: '生产产出', icon: 'Factory', color: 'text-emerald-400' },
    economy: { name: '经济财政', icon: 'Coins', color: 'text-yellow-400' },
    demand: { name: '需求资源', icon: 'Package', color: 'text-cyan-400' },
    population: { name: '人口科研', icon: 'Users', color: 'text-sky-400' },
    politics: { name: '政治稳定', icon: 'Landmark', color: 'text-purple-400' },
    military: { name: '军事', icon: 'Sword', color: 'text-red-400' },
    diplomacy: { name: '外交', icon: 'Globe', color: 'text-green-400' },
    other: { name: '其他', icon: 'Sparkles', color: 'text-gray-400' },
};

/**
 * 取某 effect type 所属类别 key（未知归入 other）
 */
export const getEffectCategory = (type) => EFFECT_CATEGORY[type] || 'other';
