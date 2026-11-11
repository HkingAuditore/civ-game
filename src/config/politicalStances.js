/**
 * 做事主张配置
 * 定义官员的做事倾向、议题和效果触发条件
 * 注意：条件数值在分配主张时动态生成
 */

import { STRATA } from './strata.js';

// ========== 「在意的事」标签定义（只做界面标签，不参与数值） ==========
export const POLITICAL_ISSUES = {
    equality: { name: '公平', icon: 'Equal', description: '在意分得公不公平' },
    collectivism: { name: '互助', icon: 'Users', description: '先顾大家' },
    tradition: { name: '传统', icon: 'Landmark', description: '照老法子来' },
    hierarchy: { name: '次序', icon: 'Layers', description: '上下各安其位' },
    spiritual: { name: '信念', icon: 'Star', description: '心里有敬重的东西' },
    military: { name: '军事', icon: 'Sword', description: '人马与防务' },
    expansion: { name: '拓展', icon: 'Expand', description: '往远处扩地盘' },
    liberty: { name: '自由', icon: 'Bird', description: '各家自己做主' },
    law: { name: '法治', icon: 'Scale', description: '按规矩办事' },
    reform: { name: '改革', icon: 'RefreshCw', description: '想改改旧做法' },
    revolution: { name: '剧变', icon: 'Flame', description: '要动大手术' },
    land: { name: '土地', icon: 'Map', description: '田地怎么分' },
    trade: { name: '贸易', icon: 'Handshake', description: '买卖往来' },
    wealth: { name: '财富', icon: 'Coins', description: '手头宽裕' },
    centralization: { name: '集中', icon: 'Target', description: '事权归到一处' },
    free_market: { name: '自由市场', icon: 'Store', description: '价钱随行就市' },
    education: { name: '教育', icon: 'GraduationCap', description: '读书识字' },
    welfare: { name: '福利', icon: 'Heart', description: '照顾困难户' },
    privatization: { name: '私有', icon: 'Building', description: '产业归各家所有' },
    efficiency: { name: '效率', icon: 'Zap', description: '办事利索' },
    progress: { name: '进步', icon: 'TrendingUp', description: '技术往前赶' },
    nature: { name: '自然', icon: 'Leaf', description: '山水草木' },
    nation: { name: '民族', icon: 'Flag', description: '同乡同族的认同' },
    stability: { name: '稳定', icon: 'Anchor', description: '日子安稳' },
};

// ========== 有效阶层列表 ==========
const VALID_STRATA = [
    'peasant', 'worker', 'artisan', 'merchant', 'landowner',
    'cleric', 'scribe', 'soldier', 'official', 'capitalist',
    'miner', 'engineer', 'serf'
];

// ========== 条件类型定义 ==========
// 每种条件类型定义其生成参数和检测函数
const CONDITION_TYPES = {
    // 阶层满意度
    stratum_approval_above: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            const threshold = 40 + Math.floor(Math.random() * 40); // 40-80
            return { stratum, threshold };
        },
        check: (params, gs) => (gs.classApproval?.[params.stratum] || 50) >= params.threshold,
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}满意度 ≥ ${params.threshold}`,
    },
    stratum_approval_below: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            const threshold = 20 + Math.floor(Math.random() * 30); // 20-50
            return { stratum, threshold };
        },
        check: (params, gs) => (gs.classApproval?.[params.stratum] || 50) < params.threshold,
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}满意度 < ${params.threshold}`,
    },

    // 阶层影响力占比
    stratum_influence_above: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            const threshold = 10 + Math.floor(Math.random() * 25); // 10-35%
            return { stratum, threshold };
        },
        check: (params, gs) => {
            const total = gs.totalInfluence || 1;
            const inf = gs.classInfluence?.[params.stratum] || 0;
            return (inf / total) * 100 >= params.threshold;
        },
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}影响力 ≥ ${params.threshold}%`,
    },
    stratum_influence_below: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            const threshold = 5 + Math.floor(Math.random() * 15); // 5-20%
            return { stratum, threshold };
        },
        check: (params, gs) => {
            const total = gs.totalInfluence || 1;
            const inf = gs.classInfluence?.[params.stratum] || 0;
            return (inf / total) * 100 < params.threshold;
        },
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}影响力 < ${params.threshold}%`,
    },

    // 生活水平
    stratum_living_standard: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            // 使用中文等级名称（与 livingStandard.js 中的 LIVING_STANDARD_LEVELS 一致）
            const levels = ['赤贫', '贫困', '温饱', '小康', '富裕', '奢华'];
            const minLevel = Math.floor(Math.random() * 4); // 0-3 (赤贫到小康)
            return { stratum, minLevel, levelName: levels[minLevel] };
        },
        check: (params, gs) => {
            // 使用中文等级名称进行比较（与实际数据格式匹配）
            const levels = ['赤贫', '贫困', '温饱', '小康', '富裕', '奢华'];
            const current = gs.classLivingStandard?.[params.stratum]?.level || '温饱';
            const currentIndex = levels.indexOf(current);
            // 如果找不到当前等级，返回 false
            if (currentIndex === -1) return false;
            return currentIndex >= params.minLevel;
        },
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}生活水平 ≥ ${params.levelName}`,
    },

    // 阶层收入
    stratum_income_above: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            const threshold = 50 + Math.floor(Math.random() * 200); // 50-250
            return { stratum, threshold };
        },
        check: (params, gs) => (gs.classIncome?.[params.stratum] || 0) >= params.threshold,
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}日均收入 ≥ ${params.threshold}`,
    },

    // 稳定度
    stability_above: {
        generate: () => ({ threshold: 50 + Math.floor(Math.random() * 40) }), // 50-90%
        check: (params, gs) => (gs.stability || 0.5) * 100 >= params.threshold,
        text: (params) => `稳定度 ≥ ${params.threshold}%`,
    },
    stability_below: {
        generate: () => ({ threshold: 20 + Math.floor(Math.random() * 40) }), // 20-60%
        check: (params, gs) => (gs.stability || 0.5) * 100 < params.threshold,
        text: (params) => `稳定度 < ${params.threshold}%`,
    },

    // 税率
    avg_tax_above: {
        generate: () => ({ threshold: 8 + Math.floor(Math.random() * 15) }), // 8-23%
        check: (params, gs) => {
            const rates = Object.values(gs.taxPolicies?.headTaxRates || {});
            const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0.1;
            return avg * 100 >= params.threshold;
        },
        text: (params) => `平均税率 ≥ ${params.threshold}%`,
    },
    avg_tax_below: {
        generate: () => ({ threshold: 5 + Math.floor(Math.random() * 10) }), // 5-15%
        check: (params, gs) => {
            const rates = Object.values(gs.taxPolicies?.headTaxRates || {});
            const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0.1;
            return avg * 100 < params.threshold;
        },
        text: (params) => `平均税率 < ${params.threshold}%`,
    },

    // 联盟
    coalition_size_above: {
        generate: () => ({ threshold: 2 + Math.floor(Math.random() * 3) }), // 2-4
        check: (params, gs) => (gs.rulingCoalition?.length || 0) >= params.threshold,
        text: (params) => `联盟 ≥ ${params.threshold}个群体`,
    },
    coalition_size_below: {
        generate: () => ({ threshold: 2 + Math.floor(Math.random() * 2) }), // 2-3
        check: (params, gs) => (gs.rulingCoalition?.length || 0) <= params.threshold,
        text: (params) => `联盟 ≤ ${params.threshold}个群体`,
    },
    coalition_includes: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            return { stratum };
        },
        check: (params, gs) => gs.rulingCoalition?.includes(params.stratum),
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}参与共治`,
    },

    // 权威
    legitimacy_above: {
        generate: () => ({ threshold: 40 + Math.floor(Math.random() * 40) }), // 40-80
        check: (params, gs) => (gs.legitimacy || 50) >= params.threshold,
        text: (params) => `权威 ≥ ${params.threshold}`,
    },

    // 战争状态
    at_war: {
        generate: () => ({}),
        check: (_, gs) => gs.atWar === true || gs.nations?.some(n => n.isAtWar),
        text: () => `处于战争状态`,
    },
    at_peace: {
        generate: () => ({}),
        check: (_, gs) => gs.atWar !== true && !gs.nations?.some(n => n.isAtWar),
        text: () => `处于和平状态`,
    },

    // 人口
    population_above: {
        generate: () => ({ threshold: 500 + Math.floor(Math.random() * 2000) }), // 500-2500
        check: (params, gs) => (gs.population || 0) >= params.threshold,
        text: (params) => `人口 ≥ ${params.threshold}`,
    },
    population_below: {
        generate: () => ({ threshold: 200 + Math.floor(Math.random() * 500) }), // 200-700
        check: (params, gs) => (gs.population || 0) < params.threshold,
        text: (params) => `人口 < ${params.threshold}`,
    },

    // 时代
    epoch_at_least: {
        generate: () => ({ epoch: Math.floor(Math.random() * 5) }), // 0-4
        check: (params, gs) => (gs.epoch || 0) >= params.epoch,
        text: (params) => {
            const epochNames = ['石器时代', '青铜时代', '古典时代', '封建时代', '探索时代', '启蒙时代', '工业时代', '信息时代'];
            return `达到${epochNames[params.epoch] || `时代${params.epoch}`}`;
        },
    },

    // ========== 物价相关条件 ==========
    // 资源物价高于阈值
    resource_price_above: {
        generate: (market) => {
            const resources = ['food', 'wood', 'stone', 'iron', 'cloth', 'tools', 'copper', 'ale', 'coal', 'delicacies', 'furniture', 'fine_clothes', 'spice'];
            const resourceNames = {
                food: '粮食', wood: '木材', stone: '石材', iron: '铁',
                cloth: '布匹', tools: '工具', copper: '铜', ale: '美酒', coal: '煤炭',
                delicacies: '珍馐', furniture: '家具', fine_clothes: '华服', spice: '香料'
            };
            const resource = resources[Math.floor(Math.random() * resources.length)];
            // 基于当前市场价格生成合理阈值
            const currentPrice = market?.prices?.[resource] || 1;
            // 要求物价高于当前价格的 1.1-1.5 倍
            const multiplier = 1.1 + Math.random() * 0.4;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { resource, threshold, resourceName: resourceNames[resource] || resource };
        },
        check: (params, gs) => {
            const price = gs.prices?.[params.resource] || 1;
            return price >= params.threshold;
        },
        text: (params) => `${params.resourceName}物价 ≥ ${params.threshold}`,
    },
    // 资源物价低于阈值
    resource_price_below: {
        generate: (market) => {
            const resources = ['food', 'wood', 'stone', 'iron', 'cloth', 'tools', 'copper', 'ale', 'coal', 'delicacies', 'furniture', 'fine_clothes', 'spice'];
            const resourceNames = {
                food: '粮食', wood: '木材', stone: '石材', iron: '铁',
                cloth: '布匹', tools: '工具', copper: '铜', ale: '美酒', coal: '煤炭',
                delicacies: '珍馐', furniture: '家具', fine_clothes: '华服', spice: '香料'
            };
            const resource = resources[Math.floor(Math.random() * resources.length)];
            // 基于当前市场价格生成合理阈值
            const currentPrice = market?.prices?.[resource] || 1;
            // 要求物价低于当前价格的 0.7-0.95 倍
            const multiplier = 0.7 + Math.random() * 0.25;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { resource, threshold, resourceName: resourceNames[resource] || resource };
        },
        check: (params, gs) => {
            const price = gs.prices?.[params.resource] || 1;
            return price < params.threshold;
        },
        text: (params) => `${params.resourceName}物价 < ${params.threshold}`,
    },
    // 平均物价稳定（波动小）
    price_stability: {
        generate: () => {
            const threshold = 0.3 + Math.random() * 0.4; // 0.3-0.7 (波动幅度上限)
            return { threshold: Math.round(threshold * 100) / 100 };
        },
        check: (params, gs) => {
            // 检查物价波动幅度，如果prices存在则计算方差
            if (!gs.prices || Object.keys(gs.prices).length === 0) return true;
            const prices = Object.values(gs.prices);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
            return Math.sqrt(variance) <= params.threshold;
        },
        text: (params) => `物价波动 ≤ ${(params.threshold * 100).toFixed(0)}%`,
    },
    // 粮食充足（低价）
    food_affordable: {
        generate: (market) => {
            // 基于当前粮价生成合理阈值
            const currentPrice = market?.prices?.food || 1;
            // 要求粮价低于当前价格的 0.75-0.95 倍
            const multiplier = 0.75 + Math.random() * 0.2;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { threshold };
        },
        check: (params, gs) => {
            const foodPrice = gs.prices?.food || 1;
            return foodPrice <= params.threshold;
        },
        text: (params) => `粮价 ≤ ${params.threshold}`,
    },
    // 粮食紧缺（高价）
    food_scarce: {
        generate: (market) => {
            // 基于当前粮价生成合理阈值
            const currentPrice = market?.prices?.food || 1;
            // 要求粮价高于当前价格的 1.1-1.4 倍
            const multiplier = 1.1 + Math.random() * 0.3;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { threshold };
        },
        check: (params, gs) => {
            const foodPrice = gs.prices?.food || 1;
            return foodPrice >= params.threshold;
        },
        text: (params) => `粮价 ≥ ${params.threshold}`,
    },
    // 通胀压力（某种重要资源物价高）
    inflation_above: {
        generate: (market) => {
            const resources = ['food', 'wood', 'stone', 'iron', 'cloth', 'tools', 'copper', 'coal', 'delicacies', 'furniture', 'ale', 'fine_clothes', 'spice'];
            const resourceNames = {
                food: '粮食', wood: '木材', stone: '石材', iron: '铁',
                cloth: '布匹', tools: '工具', copper: '铜', coal: '煤炭',
                delicacies: '珍馐', furniture: '家具', ale: '美酒', fine_clothes: '华服', spice: '香料'
            };
            const resource = resources[Math.floor(Math.random() * resources.length)];
            // 基于当前市场价格生成合理阈值
            const currentPrice = market?.prices?.[resource] || 1;
            // 要求物价高于当前价格的 1.15-1.5 倍
            const multiplier = 1.15 + Math.random() * 0.35;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { resource, threshold, resourceName: resourceNames[resource] || resource };
        },
        check: (params, gs) => {
            const price = gs.prices?.[params.resource] || 1;
            return price >= params.threshold;
        },
        text: (params) => `${params.resourceName}物价 ≥ ${params.threshold}`,
    },
    // 通货紧缩（某种重要资源物价低）
    deflation_below: {
        generate: (market) => {
            const resources = ['food', 'wood', 'stone', 'iron', 'cloth', 'tools', 'copper', 'coal', 'delicacies', 'furniture', 'ale', 'fine_clothes', 'spice'];
            const resourceNames = {
                food: '粮食', wood: '木材', stone: '石材', iron: '铁',
                cloth: '布匹', tools: '工具', copper: '铜', coal: '煤炭',
                delicacies: '珍馐', furniture: '家具', ale: '美酒', fine_clothes: '华服', spice: '香料'
            };
            const resource = resources[Math.floor(Math.random() * resources.length)];
            // 基于当前市场价格生成合理阈值
            const currentPrice = market?.prices?.[resource] || 1;
            // 要求物价低于当前价格的 0.65-0.9 倍
            const multiplier = 0.65 + Math.random() * 0.25;
            const threshold = Math.round(currentPrice * multiplier * 10) / 10;
            return { resource, threshold, resourceName: resourceNames[resource] || resource };
        },
        check: (params, gs) => {
            const price = gs.prices?.[params.resource] || 1;
            return price < params.threshold;
        },
        text: (params) => `${params.resourceName}物价 < ${params.threshold}`,
    },
};

// ========== 做事主张模板 ==========
// 每种主张定义其可能使用的条件类型和效果
const STANCE_TEMPLATES = {
    // ========== 石器时代 (epoch >= 0) ==========
    primitive_communism: {
        name: '平分共享',
        spectrum: 'left',
        icon: 'Users',
        color: 'text-red-400',
        unlockEpoch: 0,
        maxEpoch: 3, // 封建时代后消失
        historicalRef: '早期村落共耕',
        description: '一切都归众人共有',
        issues: ['equality', 'collectivism'],
        conditionTypes: ['stratum_approval_above', 'stability_above', 'coalition_size_above'],
        // 普惠主张偏好的群体（不含世家、富商）
        preferredStrata: ['peasant', 'worker', 'artisan', 'serf'],
        stratumWeights: { peasant: 2.0, worker: 2.0, serf: 1.5, landowner: 0.2, merchant: 0.3, capitalist: 0.1 },
        activeEffects: { stability: 0.05, approval: { peasant: 4, worker: 4 } },
        unsatisfiedPenalty: { approval: { peasant: -2, worker: -2 } },
    },

    tribal_elder: {
        name: '长老做主',
        spectrum: 'right',
        icon: 'Crown',
        color: 'text-amber-400',
        unlockEpoch: 0,
        maxEpoch: 2, // 古典时代后消失
        historicalRef: '早期酋长',
        description: '遇事先问长辈',
        issues: ['tradition', 'hierarchy'],
        conditionTypes: ['legitimacy_above', 'stratum_influence_above', 'population_below'],
        preferredStrata: ['landowner', 'cleric', 'official'],
        stratumWeights: { landowner: 2.0, cleric: 1.5, peasant: 1.0 },
        activeEffects: { stability: 0.04, legitimacyBonus: 0.04 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    animism: {
        name: '万物有灵',
        spectrum: 'center',
        icon: 'Leaf',
        color: 'text-green-400',
        unlockEpoch: 0,
        maxEpoch: 3, // 封建时代后消失
        historicalRef: '早期自然崇拜',
        description: '敬着山川草木',
        issues: ['spiritual', 'nature'],
        conditionTypes: ['stratum_approval_above', 'stability_above'],
        preferredStrata: ['cleric', 'peasant'],
        stratumWeights: { cleric: 3.0, peasant: 1.5 },
        activeEffects: { approval: { cleric: 6 }, needsReduction: 0.02 },
        unsatisfiedPenalty: {},
    },

    warrior_cult: {
        name: '尚武精神',
        spectrum: 'right',
        icon: 'Sword',
        color: 'text-red-500',
        unlockEpoch: 0,
        maxEpoch: 5, // 启蒙时代后消失
        historicalRef: '原始部落战争',
        description: '看重胆气和武艺',
        issues: ['military', 'expansion'],
        conditionTypes: ['at_war', 'stratum_approval_above'],
        preferredStrata: ['soldier', 'landowner'],
        stratumWeights: { soldier: 3.0 },
        activeEffects: { militaryBonus: 0.15 },
        unsatisfiedPenalty: { approval: { soldier: -4 } },
    },

    // ========== 青铜时代 (epoch >= 1) ==========
    aristocratic_oligarchy: {
        name: '世家做主',
        spectrum: 'right',
        icon: 'Castle',
        color: 'text-purple-400',
        unlockEpoch: 1,
        historicalRef: '古希腊城邦旧制',
        description: '大事由几家老户商定',
        issues: ['hierarchy', 'tradition'],
        conditionTypes: ['stratum_influence_above', 'coalition_includes', 'legitimacy_above'],
        preferredStrata: ['landowner', 'official', 'merchant'],
        stratumWeights: { landowner: 3.0, official: 1.5 },
        activeEffects: { militaryBonus: 0.12, taxEfficiency: 0.08 },
        unsatisfiedPenalty: { approval: { landowner: -6 } },
    },

    theocracy: {
        name: '敬神为先',
        spectrum: 'right',
        icon: 'Church',
        color: 'text-yellow-300',
        unlockEpoch: 1,
        historicalRef: '古埃及旧制',
        description: '凡事敬神在先',
        issues: ['spiritual', 'hierarchy'],
        conditionTypes: ['coalition_includes', 'stratum_approval_above'],
        preferredStrata: ['cleric'],
        stratumWeights: { cleric: 4.0 },
        activeEffects: { legitimacyBonus: 0.15, approval: { cleric: 15 } },
        unsatisfiedPenalty: { approval: { cleric: -8 } },
    },

    // ========== 古典时代 (epoch >= 2) ==========
    republicanism: {
        name: '众人共商',
        spectrum: 'center',
        icon: 'Scale',
        color: 'text-blue-400',
        unlockEpoch: 2,
        historicalRef: '古罗马城邦旧制',
        description: '大事大家坐下来谈',
        issues: ['liberty', 'law'],
        conditionTypes: ['coalition_size_above', 'legitimacy_above', 'stability_above'],
        preferredStrata: ['scribe', 'merchant', 'artisan', 'official'],
        stratumWeights: { scribe: 2.0, merchant: 1.5, artisan: 1.5 },
        activeEffects: { legitimacyBonus: 0.12, stability: 0.08 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    populares: {
        name: '替平民说话',
        spectrum: 'left',
        icon: 'Users',
        color: 'text-orange-400',
        unlockEpoch: 2,
        historicalRef: '古罗马平民请愿',
        description: '替平民争一份公道',
        issues: ['equality', 'reform'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard', 'food_affordable'],
        preferredStrata: ['peasant', 'worker', 'artisan', 'serf'],
        stratumWeights: { peasant: 2.5, worker: 2.5, artisan: 1.5 },
        activeEffects: { populationGrowth: 0.08, approval: { peasant: 8, worker: 8 } },
        unsatisfiedPenalty: { approval: { peasant: -4, worker: -4 } },
    },

    legalism: {
        name: '法家严治',
        spectrum: 'right',
        icon: 'Gavel',
        color: 'text-gray-300',
        unlockEpoch: 2,
        historicalRef: '战国变法',
        description: '用严法立规矩',
        issues: ['law', 'efficiency'],
        conditionTypes: ['avg_tax_above', 'stability_above'],
        preferredStrata: ['official', 'soldier', 'scribe'],
        stratumWeights: { official: 2.5, soldier: 1.5 },
        activeEffects: { taxEfficiency: 0.15, stability: -0.06 },
        unsatisfiedPenalty: {},
    },

    confucianism: {
        name: '儒家礼治',
        spectrum: 'center',
        icon: 'Book',
        color: 'text-amber-300',
        unlockEpoch: 2,
        historicalRef: '先秦礼学',
        description: '用礼法约束',
        issues: ['tradition', 'education'],
        conditionTypes: ['stratum_approval_above', 'stability_above', 'legitimacy_above'],
        preferredStrata: ['scribe', 'cleric', 'official'],
        stratumWeights: { scribe: 3.0, cleric: 1.5, official: 2.0 },
        activeEffects: { stability: 0.15, researchSpeed: 0.08 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    mohism: {
        name: '墨家兼爱',
        spectrum: 'left',
        icon: 'Wrench',
        color: 'text-gray-400',
        unlockEpoch: 2,
        historicalRef: '先秦墨家',
        description: '能帮就帮，不爱争斗',
        issues: ['equality', 'efficiency'],
        conditionTypes: ['at_peace', 'stratum_approval_above'],
        preferredStrata: ['artisan', 'worker', 'engineer'],
        stratumWeights: { artisan: 2.5, worker: 2.0, engineer: 1.5 },
        activeEffects: {
            industryBonus: 0.12,
            buildingCostMod: -0.04, // nerf: 削弱官员建筑成本效果
            productionInputCost: { sawmill: -0.15, brickworks: -0.15, metallurgy_workshop: -0.18 }
        },
        unsatisfiedPenalty: { approval: { artisan: -2 } },
    },

    taoism: {
        name: '道家无为',
        spectrum: 'center',
        icon: 'Circle',
        color: 'text-slate-300',
        unlockEpoch: 2,
        historicalRef: '先秦道家',
        description: '顺其自然',
        issues: ['liberty', 'nature'],
        conditionTypes: ['avg_tax_below', 'stability_above'],
        preferredStrata: ['cleric', 'peasant', 'scribe'],
        stratumWeights: { cleric: 2.0, peasant: 1.5, scribe: 1.5 },
        activeEffects: { needsReduction: 0.12, stability: 0.08 },
        unsatisfiedPenalty: {},
    },

    // ========== 封建时代 (epoch >= 3) ==========
    feudalism: {
        name: '层层分封',
        spectrum: 'right',
        icon: 'Castle',
        color: 'text-blue-500',
        unlockEpoch: 3,
        historicalRef: '中世纪欧洲分封',
        description: '上下相托，各管一片',
        issues: ['hierarchy', 'land'],
        conditionTypes: ['stratum_influence_above', 'legitimacy_above'],
        preferredStrata: ['landowner', 'official'],
        stratumWeights: { landowner: 3.0, peasant: 0.5 },
        activeEffects: { gatherBonus: 0.08, approval: { landowner: 12 } },
        unsatisfiedPenalty: { approval: { landowner: -6 } },
    },

    peasant_revolt: {
        name: '田户抗争',
        spectrum: 'left',
        icon: 'Flame',
        color: 'text-red-600',
        unlockEpoch: 3,
        historicalRef: '历代农人请愿',
        description: '为田户争一份生计',
        issues: ['equality', 'revolution'],
        conditionTypes: ['stratum_approval_below', 'avg_tax_above', 'food_scarce', 'inflation_above'],
        preferredStrata: ['peasant', 'serf', 'worker'],
        stratumWeights: { peasant: 3.0, serf: 3.0, worker: 2.0 },
        activeEffects: { organizationDecay: -0.22 },
        unsatisfiedPenalty: {},
    },

    guild_corporatism: {
        name: '行会共济',
        spectrum: 'center',
        icon: 'Hammer',
        color: 'text-orange-300',
        unlockEpoch: 3,
        historicalRef: '中世纪行会',
        description: '同行帮同行，货要做扎实',
        issues: ['trade', 'tradition'],
        conditionTypes: ['stratum_approval_above', 'stratum_income_above', 'resource_price_below', 'price_stability'],
        preferredStrata: ['artisan', 'merchant'],
        stratumWeights: { artisan: 3.0, merchant: 2.0 },
        activeEffects: {
            tradeBonus: 0.12,
            approval: { artisan: 8, merchant: 8 },
            productionInputCost: { furniture_workshop: -0.18, tailor_workshop: -0.18, loom_house: -0.15 }
        },
        unsatisfiedPenalty: {
            approval: { artisan: -4 },
            productionInputCost: { furniture_workshop: 0.05, tailor_workshop: 0.05 }
        },
    },

    // ========== 探索时代 (epoch >= 4) ==========
    mercantilism: {
        name: '通商致富',
        spectrum: 'center',
        icon: 'Ship',
        color: 'text-cyan-400',
        unlockEpoch: 4,
        historicalRef: '早期远洋商号',
        description: '买卖做得越远，钱赚得越多',
        issues: ['trade', 'wealth'],
        conditionTypes: ['stratum_income_above', 'stratum_influence_above', 'resource_price_above', 'inflation_above'],
        preferredStrata: ['merchant', 'capitalist'],
        stratumWeights: { merchant: 3.0, capitalist: 2.0 },
        activeEffects: { tradeBonus: 0.18, taxBonus: 0.08 },
        unsatisfiedPenalty: { approval: { merchant: -4 } },
    },

    absolutism: {
        name: '独断专行',
        spectrum: 'right',
        icon: 'Crown',
        color: 'text-purple-500',
        unlockEpoch: 4,
        historicalRef: '近代君主集权',
        description: '大事一个人定',
        issues: ['hierarchy', 'centralization'],
        conditionTypes: ['coalition_size_below', 'legitimacy_above'],
        preferredStrata: ['official', 'landowner'],
        stratumWeights: { official: 2.0 },
        activeEffects: { taxEfficiency: 0.15, buildingCostMod: -0.06 }, // nerf: 削弱官员建筑成本效果
        unsatisfiedPenalty: {},
    },

    humanism: {
        name: '以人为本',
        spectrum: 'center',
        icon: 'Book',
        color: 'text-rose-300',
        unlockEpoch: 4,
        historicalRef: '文艺复兴',
        description: '肯在读书人和手艺人身上花钱',
        issues: ['education', 'progress'],
        conditionTypes: ['stratum_approval_above', 'epoch_at_least'],
        preferredStrata: ['scribe', 'artisan', 'engineer'],
        stratumWeights: { scribe: 3.0, artisan: 2.0 },
        activeEffects: { researchSpeed: 0.15, cultureBonus: 0.12 },
        unsatisfiedPenalty: {},
    },

    colonialism: {
        name: '向外拓殖',
        spectrum: 'right',
        icon: 'Globe',
        color: 'text-emerald-500',
        unlockEpoch: 4,
        historicalRef: '大航海时代',
        description: '愿意往远处做买卖',
        issues: ['expansion', 'trade'],
        conditionTypes: ['stratum_income_above', 'at_war'],
        preferredStrata: ['merchant', 'soldier', 'navigator'],
        stratumWeights: { merchant: 2.0, soldier: 1.5 },
        activeEffects: { tradeBonus: 0.15, diplomaticBonus: 0.8 },
        unsatisfiedPenalty: {},
    },

    // ========== 启蒙时代 (epoch >= 5) ==========
    classical_liberalism: {
        name: '放任自流',
        spectrum: 'center',
        icon: 'Lightbulb',
        color: 'text-yellow-400',
        unlockEpoch: 5,
        historicalRef: '近代自由贸易学说',
        description: '买卖的事让各家自己定',
        issues: ['liberty', 'free_market'],
        conditionTypes: ['avg_tax_below', 'stratum_approval_above', 'price_stability', 'deflation_below'],
        preferredStrata: ['merchant', 'capitalist', 'artisan'],
        stratumWeights: { merchant: 2.0, capitalist: 2.5, artisan: 1.5 },
        activeEffects: { taxBonus: 0.12, populationGrowth: 0.08 },
        unsatisfiedPenalty: { approval: { merchant: -4, capitalist: -4 } },
    },

    enlightened_despotism: {
        name: '开明治理',
        spectrum: 'center',
        icon: 'GraduationCap',
        color: 'text-indigo-400',
        unlockEpoch: 5,
        historicalRef: '近代开明君主',
        description: '当家的先替众人办事',
        issues: ['reform', 'centralization'],
        conditionTypes: ['coalition_size_below', 'legitimacy_above', 'stability_above'],
        preferredStrata: ['official', 'scribe', 'engineer'],
        stratumWeights: { official: 2.0, scribe: 2.0, engineer: 1.5 },
        activeEffects: { researchSpeed: 0.18, buildingCostMod: -0.04 }, // nerf: 削弱官员建筑成本效果
        unsatisfiedPenalty: {},
    },
    conservatism: {
        name: '守成不变',
        spectrum: 'right',
        icon: 'Shield',
        color: 'text-gray-400',
        unlockEpoch: 5,
        historicalRef: '近代保守思潮',
        description: '老法子最稳当',
        issues: ['tradition', 'stability'],
        conditionTypes: ['stability_above', 'legitimacy_above'],
        preferredStrata: ['landowner', 'cleric', 'official'],
        stratumWeights: { landowner: 2.0, cleric: 2.0 },
        activeEffects: { stability: 0.12, legitimacyBonus: 0.08 },
        unsatisfiedPenalty: { stability: -0.04 },
    },

    utopian_socialism: {
        name: '世外桃源',
        spectrum: 'left',
        icon: 'Sparkles',
        color: 'text-pink-400',
        unlockEpoch: 5,
        historicalRef: '早期空想公社',
        description: '想要一个谁都过得好的地方',
        issues: ['equality', 'progress'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard'],
        // 普惠主张只顾平民，不太顾世家和富商
        preferredStrata: ['worker', 'artisan', 'peasant', 'scribe'],
        stratumWeights: { scribe: 2.0, worker: 1.5, artisan: 1.5 },
        activeEffects: { researchSpeed: 0.12, approval: { worker: 8 } },
        unsatisfiedPenalty: {},
    },

    physiocracy: {
        name: '以农为先',
        spectrum: 'center',
        icon: 'Wheat',
        color: 'text-lime-400',
        unlockEpoch: 5,
        historicalRef: '重农学派',
        description: '有地才有一切',
        issues: ['land', 'free_market'],
        conditionTypes: ['stratum_influence_above', 'stratum_approval_above', 'food_affordable', 'resource_price_below'],
        preferredStrata: ['landowner', 'peasant'],
        stratumWeights: { landowner: 2.5, peasant: 2.0 },
        activeEffects: { gatherBonus: 0.15, approval: { peasant: 8, landowner: 8 } },
        unsatisfiedPenalty: { approval: { landowner: -4 } },
    },

    // ========== 工业时代 (epoch >= 6) ==========
    marxism: {
        name: '工坊合伙',
        spectrum: 'left',
        icon: 'Factory',
        color: 'text-red-500',
        unlockEpoch: 6,
        historicalRef: '早期工坊合作运动',
        description: '工坊由干活的人一起管',
        issues: ['equality', 'revolution', 'collectivism'],
        conditionTypes: ['coalition_includes', 'stratum_influence_above'],
        preferredStrata: ['worker', 'miner', 'artisan'],
        stratumWeights: { worker: 4.0, miner: 2.0 },
        activeEffects: {
            industryBonus: 0.18,
            approval: { worker: 15, miner: 12 },
            productionInputCost: { steel_foundry: -0.22, textile_mill: -0.18, building_materials_plant: -0.18 }
        },
        unsatisfiedPenalty: {
            approval: { worker: -6 },
            organizationDecay: -0.08,
            productionInputCost: { steel_foundry: 0.08, textile_mill: 0.06 }
        },
    },

    social_democracy: {
        name: '渐进改良',
        spectrum: 'left',
        icon: 'HeartHandshake',
        color: 'text-rose-400',
        unlockEpoch: 6,
        historicalRef: '渐进改良思潮',
        description: '一步一步来，不折腾',
        issues: ['equality', 'welfare'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard', 'stability_above', 'food_affordable', 'price_stability'],
        preferredStrata: ['worker', 'scribe', 'artisan', 'peasant'],
        stratumWeights: { worker: 2.0, scribe: 1.5, artisan: 1.5 },
        activeEffects: { approval: { worker: 12, peasant: 8 }, stability: 0.08 },
        unsatisfiedPenalty: { approval: { worker: -4 } },
    },

    anarchism: {
        name: '不受拘束',
        spectrum: 'left',
        icon: 'CircleSlash',
        color: 'text-gray-500',
        unlockEpoch: 6,
        historicalRef: '早期自治互助思潮',
        description: '不愿被条条框框管着',
        issues: ['liberty', 'revolution'],
        conditionTypes: ['stability_below', 'stratum_approval_below'],
        preferredStrata: ['worker', 'artisan', 'peasant'],
        stratumWeights: { worker: 2.0, artisan: 2.0 },
        activeEffects: { needsReduction: 0.15 },
        unsatisfiedPenalty: { stability: -0.06 },
    },

    nationalism: {
        name: '心系故土',
        spectrum: 'right',
        icon: 'Flag',
        color: 'text-orange-500',
        unlockEpoch: 6,
        historicalRef: '近代德国统一',
        description: '惦记家乡，护着乡里',
        issues: ['nation', 'military'],
        conditionTypes: ['at_war', 'stratum_approval_above'],
        preferredStrata: ['soldier', 'official', 'landowner'],
        stratumWeights: { soldier: 2.5, official: 1.5 },
        activeEffects: { militaryBonus: 0.22, approval: { soldier: 12 } },
        unsatisfiedPenalty: {},
    },
    neoliberalism: {
        name: '放任经营',
        spectrum: 'right',
        icon: 'TrendingUp',
        color: 'text-emerald-400',
        unlockEpoch: 6,
        historicalRef: '现代自由市场学说',
        description: '买卖随行就市',
        issues: ['free_market', 'privatization'],
        conditionTypes: ['stratum_income_above', 'avg_tax_below', 'resource_price_above', 'inflation_above'],
        preferredStrata: ['capitalist', 'merchant'],
        stratumWeights: { capitalist: 4.0, merchant: 2.0 },
        activeEffects: { taxBonus: 0.18, tradeBonus: 0.12 },
        unsatisfiedPenalty: { approval: { capitalist: -6 } },
    },

    technocracy: {
        name: '行家做主',
        spectrum: 'center',
        icon: 'Cpu',
        color: 'text-sky-400',
        unlockEpoch: 6,
        historicalRef: '早期管理学派',
        description: '内行说了算',
        issues: ['efficiency', 'progress'],
        conditionTypes: ['epoch_at_least', 'stratum_influence_above'],
        preferredStrata: ['engineer', 'scribe', 'official'],
        stratumWeights: { engineer: 3.0, scribe: 2.0 },
        activeEffects: {
            researchSpeed: 0.22,
            industryBonus: 0.12,
            productionInputCost: { printing_house: -0.28, factory: -0.22, steel_foundry: -0.15 }
        },
        unsatisfiedPenalty: {},
    },

    // ========== 信息时代 (epoch >= 7) ==========
    digital_democracy: {
        name: '线上共商',
        spectrum: 'center',
        icon: 'Monitor',
        color: 'text-cyan-300',
        unlockEpoch: 7,
        historicalRef: '网络议事工具',
        description: '有事上网办，少跑腿',
        issues: ['liberty', 'progress'],
        conditionTypes: ['coalition_size_above', 'stability_above', 'legitimacy_above'],
        preferredStrata: ['engineer', 'scribe', 'worker'],
        stratumWeights: { engineer: 2.0, scribe: 2.0, worker: 1.5 },
        activeEffects: { legitimacyBonus: 0.18, stability: 0.12 },
        unsatisfiedPenalty: {},
    },

    eco_socialism: {
        name: '与自然共处',
        spectrum: 'left',
        icon: 'Leaf',
        color: 'text-green-500',
        unlockEpoch: 7,
        historicalRef: '现代环保运动',
        description: '不糟蹋山水',
        issues: ['equality', 'nature'],
        conditionTypes: ['stratum_approval_above', 'stability_above'],
        preferredStrata: ['worker', 'peasant', 'engineer'],
        stratumWeights: { worker: 2.0, peasant: 2.0, engineer: 1.5 },
        activeEffects: { needsReduction: 0.15, stability: 0.08 },
        unsatisfiedPenalty: {},
    },

    transhumanism: {
        name: '超越极限',
        spectrum: 'right',
        icon: 'Zap',
        color: 'text-violet-400',
        unlockEpoch: 7,
        historicalRef: '未来技术设想',
        description: '总想突破身体的上限',
        issues: ['progress', 'efficiency'],
        conditionTypes: ['epoch_at_least', 'stratum_income_above'],
        preferredStrata: ['engineer', 'capitalist'],
        stratumWeights: { engineer: 4.0, capitalist: 2.0 },
        activeEffects: { researchSpeed: 0.28, populationGrowth: 0.08 },
        unsatisfiedPenalty: {},
    },
};

// ========== 运行时做事主张存储 ==========
// 此对象存储带有生成条件的主张实例
export const POLITICAL_STANCES = {};

// 初始化基础主张（不含动态条件）
Object.entries(STANCE_TEMPLATES).forEach(([id, template]) => {
    POLITICAL_STANCES[id] = {
        id,
        ...template,
        // triggerCondition 和 conditionText 会在 assignPoliticalStance 时动态生成
        triggerCondition: () => false,
        conditionText: '条件待生成',
    };
});

// ========== 辅助API ==========

/**
 * 获取指定时代可用的主张列表
 */
export function getAvailableStances(epoch) {
    return Object.values(STANCE_TEMPLATES).filter(s => s.unlockEpoch <= epoch);
}

/**
 * 为官员生成带动态条件的做事主张
 * @param {string} sourceStratum - 官员出身阶层
 * @param {number} epoch - 当前时代
 * @param {Object} market - 当前市场数据（包含 prices 等信息）
 * @returns {Object} { stanceId, conditionParams, conditionText }
 */
export function assignPoliticalStance(sourceStratum, epoch, market = null) {
    // 获取可用主张（考虑时代上下限）
    const available = Object.entries(STANCE_TEMPLATES).filter(([, stance]) => {
        const minEpoch = stance.unlockEpoch || 0;
        const maxEpoch = stance.maxEpoch ?? 999; // 默认无上限
        return epoch >= minEpoch && epoch <= maxEpoch;
    }).map(([id, stance]) => ({ id, ...stance }));

    if (available.length === 0) {
        return { stanceId: 'republicanism', conditionParams: [], conditionText: '默认条件' };
    }

    // 计算加权随机（出身阶层权重更高）
    const weights = {};
    let totalWeight = 0;
    available.forEach(stance => {
        // 基于出身阶层的权重
        let stratumWeight = stance.stratumWeights?.[sourceStratum] || 0.5;
        // 确保权重不为0
        stratumWeight = Math.max(0.1, stratumWeight);
        weights[stance.id] = stratumWeight;
        totalWeight += stratumWeight;
    });

    // 选择主张
    let random = Math.random() * totalWeight;
    let selectedId = available[0].id;
    for (const stance of available) {
        random -= weights[stance.id];
        if (random <= 0) {
            selectedId = stance.id;
            break;
        }
    }

    const stance = STANCE_TEMPLATES[selectedId];
    const conditions = [];

    // [Fix] 矛盾检查辅助函数
    const checkConflict = (newType, newParams) => {
        return conditions.some(existing => {
            // 1. 目标一致性检查 (阶层/资源) - 如果目标不同，则不冲突
            if (newParams.stratum && existing.params?.stratum && newParams.stratum !== existing.params.stratum) return false;
            // 注意：resource属性可能直接在params里，也可能是params本身（如果是字符串）
            const resA = newParams.resource || (typeof newParams === 'string' ? newParams : null);
            const resB = existing.params?.resource || (typeof existing.params === 'string' ? existing.params : null);
            if (resA && resB && resA !== resB) return false;

            // 2. 检查逻辑矛盾 (Above vs Below)
            const isAbove = newType.includes('above') || newType.includes('at_least');
            const isBelow = newType.includes('below') || newType.includes('at_most');
            const exIsAbove = existing.typeId.includes('above') || existing.typeId.includes('at_least');
            const exIsBelow = existing.typeId.includes('below') || existing.typeId.includes('at_most');

            // 只有当方向相反时才可能矛盾
            if ((isAbove && exIsBelow) || (isBelow && exIsAbove)) {
                // 检查是否针对同一指标 (去掉后缀比较)
                const rootNew = newType.replace(/_(above|below|at_least|at_most).*/, '');
                const rootEx = existing.typeId.replace(/_(above|below|at_least|at_most).*/, '');
                return rootNew === rootEx;
            }

            // 3. 避免完全重复 (同类型+同参数)
            if (newType === existing.typeId && JSON.stringify(newParams) === JSON.stringify(existing.params)) return true;

            return false;
        });
    };

    // 获取主张偏好的阶层列表（用于生成符合主张意识形态的条件）
    const preferredStrata = stance.preferredStrata || [sourceStratum];
    // 从偏好阶层中随机选择一个用于条件
    const getPreferredStratum = () => {
        if (preferredStrata.length > 0) {
            return preferredStrata[Math.floor(Math.random() * preferredStrata.length)];
        }
        return sourceStratum;
    };

    // === 强制添加一个联盟相关条件 ===
    const coalitionCondTypes = ['coalition_includes', 'coalition_size_above', 'coalition_size_below'];
    const coalitionType = coalitionCondTypes[Math.floor(Math.random() * coalitionCondTypes.length)];
    const coalitionCondDef = CONDITION_TYPES[coalitionType];
    if (coalitionCondDef) {
        // 对于 coalition_includes，使用主张偏好的阶层（而非出身阶层）
        let params;
        if (coalitionType === 'coalition_includes') {
            const preferredStratum = getPreferredStratum();
            if (preferredStratum && VALID_STRATA.includes(preferredStratum)) {
                params = { stratum: preferredStratum };
            } else {
                params = coalitionCondDef.generate(market);
            }
        } else {
            params = coalitionCondDef.generate(market);
        }
        conditions.push({
            typeId: coalitionType,
            params,
            text: coalitionCondDef.text(params)
        });
    }

    // === 添加1-2个与主张相关阶层的条件（基于preferredStrata而非出身阶层） ===
    // 注意：移除了 stratum_approval_below，因为"希望某阶层满意度低"只适合激进主张（田户抗争、不受拘束等）
    const stratumRelatedTypes = [
        'stratum_approval_above', 'stratum_influence_above', 'stratum_living_standard', 'stratum_income_above'
    ];
    const numStratumConds = 1 + Math.floor(Math.random() * 2); // 1-2个
    const usedStratumKeys = new Set(); // 用于去重：typeId + stratum 组合

    for (let i = 0; i < numStratumConds; i++) {
        const typeId = stratumRelatedTypes[Math.floor(Math.random() * stratumRelatedTypes.length)];
        const condDef = CONDITION_TYPES[typeId];
        if (condDef) {
            let params = condDef.generate(market);
            // 90%概率使用主张偏好阶层（确保条件与主张意识形态匹配）
            if (Math.random() < 0.9 && preferredStrata.length > 0) {
                params.stratum = getPreferredStratum();
            }

            // 去重检查：避免相同类型+相同阶层
            const key = `${typeId}-${params.stratum}`;
            if (usedStratumKeys.has(key)) {
                continue; // 跳过重复
            }
            usedStratumKeys.add(key);

            // [Fix] 使用通用矛盾检查
            if (checkConflict(typeId, params)) continue;

            conditions.push({
                typeId,
                params,
                text: condDef.text(params)
            });
        }
    }

    // === 可选：30%概率添加一个物价相关条件 ===
    const priceCondTypes = [
        'resource_price_above', 'resource_price_below', 'price_stability',
        'food_affordable', 'food_scarce', 'inflation_above', 'deflation_below'
    ];
    if (Math.random() < 0.3) {
        const typeId = priceCondTypes[Math.floor(Math.random() * priceCondTypes.length)];
        // 避免重复类型
        if (!conditions.some(c => c.typeId === typeId)) {
            const condDef = CONDITION_TYPES[typeId];
            if (condDef) {
                const params = condDef.generate(market);
                // [Fix] 检查矛盾
                if (!checkConflict(typeId, params)) {
                    conditions.push({
                        typeId,
                        params,
                        text: condDef.text(params)
                    });
                }
            }
        }
    }

    // === 可选：从主张定义的条件类型中选择1个（去重） ===
    const stanceCondTypes = stance.conditionTypes || [];
    if (stanceCondTypes.length > 0 && Math.random() < 0.5) {
        const typeId = stanceCondTypes[Math.floor(Math.random() * stanceCondTypes.length)];
        // 避免重复类型
        if (!conditions.some(c => c.typeId === typeId)) {
            const condDef = CONDITION_TYPES[typeId];
            if (condDef) {
                const params = condDef.generate(market);
                // [Fix] 检查矛盾
                if (!checkConflict(typeId, params)) {
                    conditions.push({
                        typeId,
                        params,
                        text: condDef.text(params)
                    });
                }
            }
        }
    }

    // 合成条件文本
    const conditionText = conditions.map(c => c.text).join(' 且 ');

    // === 为该官员随机化效果（基于主张模板，加减20%浮动） ===
    const randomizeEffectValue = (value) => {
        if (typeof value !== 'number') return value;
        // 在 0.8 ~ 1.2 之间浮动
        const factor = 0.8 + Math.random() * 0.4;
        return Math.round(value * factor * 100) / 100; // 保留两位小数
    };

    const randomizeEffects = (template) => {
        if (!template || typeof template !== 'object') return {};
        const result = {};
        Object.entries(template).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // 嵌套对象（如 approval: { peasant: 10 }）
                result[key] = {};
                Object.entries(value).forEach(([subKey, subValue]) => {
                    result[key][subKey] = randomizeEffectValue(subValue);
                });
            } else {
                result[key] = randomizeEffectValue(value);
            }
        });
        return result;
    };

    // 生成该官员独特的效果
    const activeEffects = randomizeEffects(stance.activeEffects);
    const unsatisfiedPenalty = randomizeEffects(stance.unsatisfiedPenalty);

    return {
        stanceId: selectedId,
        conditionParams: conditions,
        conditionText,
        activeEffects,       // 随机化后的满足效果
        unsatisfiedPenalty,  // 随机化后的不满足惩罚
    };
}

/**
 * 检查主张是否被满足
 */
export function isStanceSatisfied(stanceId, gameState, conditionParams) {
    if (!conditionParams || conditionParams.length === 0) return false;

    return conditionParams.every(c => {
        const condType = CONDITION_TYPES[c.typeId];
        return condType ? condType.check(c.params, gameState) : false;
    });
}

/**
 * 获取主张基础信息
 */
export function getStanceInfo(stanceId) {
    return POLITICAL_STANCES[stanceId] || STANCE_TEMPLATES[stanceId] || null;
}

/**
 * 获取主张的当前效果
 */
export function getStanceEffects(stanceId, gameState, conditionParams) {
    const stance = STANCE_TEMPLATES[stanceId];
    if (!stance) return { satisfied: false, effects: {} };

    const satisfied = isStanceSatisfied(stanceId, gameState, conditionParams);
    const effects = satisfied ? stance.activeEffects : stance.unsatisfiedPenalty;

    return { satisfied, effects: effects || {} };
}
