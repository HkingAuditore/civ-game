/**
 * 政治立场配置
 * 定义官员的政治倾向、议题和效果触发条件
 * 注意：条件数值在分配立场时动态生成
 */

import { STRATA } from './strata';

// ========== 政治议题定义 ==========
export const POLITICAL_ISSUES = {
    equality: { name: '平等', icon: 'Equal', description: '关注贫富差距和社会公正' },
    collectivism: { name: '集体主义', icon: 'Users', description: '集体利益优先' },
    tradition: { name: '传统', icon: 'Landmark', description: '维护既有秩序' },
    hierarchy: { name: '等级制度', icon: 'Layers', description: '社会分层有序' },
    spiritual: { name: '灵性/宗教', icon: 'Star', description: '精神信仰' },
    military: { name: '军事', icon: 'Sword', description: '军事力量和国防' },
    expansion: { name: '扩张', icon: 'Expand', description: '领土和影响力扩展' },
    liberty: { name: '自由', icon: 'Bird', description: '个人自由权利' },
    law: { name: '法治', icon: 'Scale', description: '法律秩序' },
    reform: { name: '改革', icon: 'RefreshCw', description: '社会变革' },
    revolution: { name: '革命', icon: 'Flame', description: '激进变革' },
    land: { name: '土地', icon: 'Map', description: '土地分配' },
    trade: { name: '贸易', icon: 'Handshake', description: '商业活动' },
    wealth: { name: '财富', icon: 'Coins', description: '经济繁荣' },
    centralization: { name: '集权', icon: 'Target', description: '权力集中' },
    free_market: { name: '自由市场', icon: 'Store', description: '市场经济' },
    education: { name: '教育', icon: 'GraduationCap', description: '知识传播' },
    welfare: { name: '福利', icon: 'Heart', description: '社会保障' },
    privatization: { name: '私有化', icon: 'Building', description: '私有产权' },
    efficiency: { name: '效率', icon: 'Zap', description: '行政效能' },
    progress: { name: '进步', icon: 'TrendingUp', description: '科技发展' },
    nature: { name: '自然', icon: 'Leaf', description: '环境生态' },
    nation: { name: '民族', icon: 'Flag', description: '民族认同' },
    stability: { name: '稳定', icon: 'Anchor', description: '社会安定' },
};

// ========== 有效阶层列表（排除骑士） ==========
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

    // 执政联盟
    coalition_size_above: {
        generate: () => ({ threshold: 2 + Math.floor(Math.random() * 3) }), // 2-4
        check: (params, gs) => (gs.rulingCoalition?.length || 0) >= params.threshold,
        text: (params) => `执政联盟 ≥ ${params.threshold}个阶层`,
    },
    coalition_size_below: {
        generate: () => ({ threshold: 2 + Math.floor(Math.random() * 2) }), // 2-3
        check: (params, gs) => (gs.rulingCoalition?.length || 0) <= params.threshold,
        text: (params) => `执政联盟 ≤ ${params.threshold}个阶层`,
    },
    coalition_includes: {
        generate: () => {
            const stratum = VALID_STRATA[Math.floor(Math.random() * VALID_STRATA.length)];
            return { stratum };
        },
        check: (params, gs) => gs.rulingCoalition?.includes(params.stratum),
        text: (params) => `${STRATA[params.stratum]?.name || params.stratum}参与执政`,
    },

    // 合法性
    legitimacy_above: {
        generate: () => ({ threshold: 40 + Math.floor(Math.random() * 40) }), // 40-80
        check: (params, gs) => (gs.legitimacy || 50) >= params.threshold,
        text: (params) => `合法性 ≥ ${params.threshold}`,
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

// ========== 政治立场模板 ==========
// 每种立场定义其可能使用的条件类型和效果
const STANCE_TEMPLATES = {
    // ========== 石器时代 (epoch >= 0) ==========
    primitive_communism: {
        name: '原始公社',
        spectrum: 'left',
        icon: 'Users',
        color: 'text-red-400',
        unlockEpoch: 0,
        maxEpoch: 3, // 封建时代后消失
        historicalRef: '氏族共有制',
        description: '一切资源归部落共有',
        issues: ['equality', 'collectivism'],
        conditionTypes: ['stratum_approval_above', 'stability_above', 'coalition_size_above'],
        // 左派立场偏好的阶层（不包括地主、资本家）
        preferredStrata: ['peasant', 'worker', 'artisan', 'serf'],
        stratumWeights: { peasant: 2.0, worker: 2.0, serf: 1.5, landowner: 0.2, merchant: 0.3, capitalist: 0.1 },
        activeEffects: { stability: 0.05, approval: { peasant: 4, worker: 4 } },
        unsatisfiedPenalty: { approval: { peasant: -2, worker: -2 } },
    },

    tribal_elder: {
        name: '部落长老制',
        spectrum: 'right',
        icon: 'Crown',
        color: 'text-amber-400',
        unlockEpoch: 0,
        maxEpoch: 2, // 古典时代后消失
        historicalRef: '早期酋长',
        description: '尊崇长老权威',
        issues: ['tradition', 'hierarchy'],
        conditionTypes: ['legitimacy_above', 'stratum_influence_above', 'population_below'],
        preferredStrata: ['landowner', 'cleric', 'official'],
        stratumWeights: { landowner: 2.0, cleric: 1.5, peasant: 1.0 },
        activeEffects: { stability: 0.04, legitimacyBonus: 0.04 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    animism: {
        name: '万物有灵论',
        spectrum: 'center',
        icon: 'Leaf',
        color: 'text-green-400',
        unlockEpoch: 0,
        maxEpoch: 3, // 封建时代后消失
        historicalRef: '原始宗教',
        description: '敬畏自然神灵',
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
        description: '崇尚武力与征服',
        issues: ['military', 'expansion'],
        conditionTypes: ['at_war', 'stratum_approval_above'],
        preferredStrata: ['soldier', 'landowner'],
        stratumWeights: { soldier: 3.0 },
        activeEffects: { militaryBonus: 0.15 },
        unsatisfiedPenalty: { approval: { soldier: -4 } },
    },

    // ========== 青铜时代 (epoch >= 1) ==========
    aristocratic_oligarchy: {
        name: '贵族寡头制',
        spectrum: 'right',
        icon: 'Castle',
        color: 'text-purple-400',
        unlockEpoch: 1,
        historicalRef: '斯巴达双王制',
        description: '政权归于少数贵族',
        issues: ['hierarchy', 'tradition'],
        conditionTypes: ['stratum_influence_above', 'coalition_includes', 'legitimacy_above'],
        preferredStrata: ['landowner', 'official', 'merchant'],
        stratumWeights: { landowner: 3.0, official: 1.5 },
        activeEffects: { militaryBonus: 0.12, taxEfficiency: 0.08 },
        unsatisfiedPenalty: { approval: { landowner: -6 } },
    },

    theocracy: {
        name: '神权政治',
        spectrum: 'right',
        icon: 'Church',
        color: 'text-yellow-300',
        unlockEpoch: 1,
        historicalRef: '古埃及法老',
        description: '神的代言人统治',
        issues: ['spiritual', 'hierarchy'],
        conditionTypes: ['coalition_includes', 'stratum_approval_above'],
        preferredStrata: ['cleric'],
        stratumWeights: { cleric: 4.0 },
        activeEffects: { legitimacyBonus: 0.15, approval: { cleric: 15 } },
        unsatisfiedPenalty: { approval: { cleric: -8 } },
    },

    // ========== 古典时代 (epoch >= 2) ==========
    republicanism: {
        name: '共和主义',
        spectrum: 'center',
        icon: 'Scale',
        color: 'text-blue-400',
        unlockEpoch: 2,
        historicalRef: '罗马共和国',
        description: '公民参与公共事务',
        issues: ['liberty', 'law'],
        conditionTypes: ['coalition_size_above', 'legitimacy_above', 'stability_above'],
        preferredStrata: ['scribe', 'merchant', 'artisan', 'official'],
        stratumWeights: { scribe: 2.0, merchant: 1.5, artisan: 1.5 },
        activeEffects: { legitimacyBonus: 0.12, stability: 0.08 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    populares: {
        name: '平民派',
        spectrum: 'left',
        icon: 'Users',
        color: 'text-orange-400',
        unlockEpoch: 2,
        historicalRef: '格拉古兄弟',
        description: '为平民争取权益',
        issues: ['equality', 'reform'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard', 'food_affordable'],
        preferredStrata: ['peasant', 'worker', 'artisan', 'serf'],
        stratumWeights: { peasant: 2.5, worker: 2.5, artisan: 1.5 },
        activeEffects: { populationGrowth: 0.08, approval: { peasant: 8, worker: 8 } },
        unsatisfiedPenalty: { approval: { peasant: -4, worker: -4 } },
    },

    legalism: {
        name: '法家',
        spectrum: 'right',
        icon: 'Gavel',
        color: 'text-gray-300',
        unlockEpoch: 2,
        historicalRef: '商鞅变法',
        description: '严刑峻法治国',
        issues: ['law', 'efficiency'],
        conditionTypes: ['avg_tax_above', 'stability_above'],
        preferredStrata: ['official', 'soldier', 'scribe'],
        stratumWeights: { official: 2.5, soldier: 1.5 },
        activeEffects: { taxEfficiency: 0.15, stability: -0.06 },
        unsatisfiedPenalty: {},
    },

    confucianism: {
        name: '儒家',
        spectrum: 'center',
        icon: 'Book',
        color: 'text-amber-300',
        unlockEpoch: 2,
        historicalRef: '孔孟之道',
        description: '礼教治国',
        issues: ['tradition', 'education'],
        conditionTypes: ['stratum_approval_above', 'stability_above', 'legitimacy_above'],
        preferredStrata: ['scribe', 'cleric', 'official'],
        stratumWeights: { scribe: 3.0, cleric: 1.5, official: 2.0 },
        activeEffects: { stability: 0.15, researchSpeed: 0.08 },
        unsatisfiedPenalty: { stability: -0.02 },
    },

    mohism: {
        name: '墨家',
        spectrum: 'left',
        icon: 'Wrench',
        color: 'text-gray-400',
        unlockEpoch: 2,
        historicalRef: '墨子兼爱非攻',
        description: '兼爱非攻，尚同尚贤',
        issues: ['equality', 'efficiency'],
        conditionTypes: ['at_peace', 'stratum_approval_above'],
        preferredStrata: ['artisan', 'worker', 'engineer'],
        stratumWeights: { artisan: 2.5, worker: 2.0, engineer: 1.5 },
        activeEffects: {
            industryBonus: 0.12,
            buildingCostMod: -0.08,
            productionInputCost: { sawmill: -0.15, brickworks: -0.15, metallurgy_workshop: -0.18 }
        },
        unsatisfiedPenalty: { approval: { artisan: -2 } },
    },

    taoism: {
        name: '道家',
        spectrum: 'center',
        icon: 'Circle',
        color: 'text-slate-300',
        unlockEpoch: 2,
        historicalRef: '老庄无为',
        description: '无为而治',
        issues: ['liberty', 'nature'],
        conditionTypes: ['avg_tax_below', 'stability_above'],
        preferredStrata: ['cleric', 'peasant', 'scribe'],
        stratumWeights: { cleric: 2.0, peasant: 1.5, scribe: 1.5 },
        activeEffects: { needsReduction: 0.12, stability: 0.08 },
        unsatisfiedPenalty: {},
    },

    // ========== 封建时代 (epoch >= 3) ==========
    feudalism: {
        name: '封建主义',
        spectrum: 'right',
        icon: 'Castle',
        color: 'text-blue-500',
        unlockEpoch: 3,
        historicalRef: '中世纪欧洲分封',
        description: '领主-附庸关系',
        issues: ['hierarchy', 'land'],
        conditionTypes: ['stratum_influence_above', 'legitimacy_above'],
        preferredStrata: ['landowner', 'official'],
        stratumWeights: { landowner: 3.0, peasant: 0.5 },
        activeEffects: { gatherBonus: 0.08, approval: { landowner: 12 } },
        unsatisfiedPenalty: { approval: { landowner: -6 } },
    },

    peasant_revolt: {
        name: '农民起义派',
        spectrum: 'left',
        icon: 'Flame',
        color: 'text-red-600',
        unlockEpoch: 3,
        historicalRef: '黄巾起义、扎克雷起义',
        description: '推翻压迫者',
        issues: ['equality', 'revolution'],
        conditionTypes: ['stratum_approval_below', 'avg_tax_above', 'food_scarce', 'inflation_above'],
        preferredStrata: ['peasant', 'serf', 'worker'],
        stratumWeights: { peasant: 3.0, serf: 3.0, worker: 2.0 },
        activeEffects: { organizationDecay: -0.22 },
        unsatisfiedPenalty: {},
    },

    guild_corporatism: {
        name: '行会主义',
        spectrum: 'center',
        icon: 'Hammer',
        color: 'text-orange-300',
        unlockEpoch: 3,
        historicalRef: '中世纪行会',
        description: '同业互助，质量至上',
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
        name: '重商主义',
        spectrum: 'center',
        icon: 'Ship',
        color: 'text-cyan-400',
        unlockEpoch: 4,
        historicalRef: '东印度公司',
        description: '贸易国富之本',
        issues: ['trade', 'wealth'],
        conditionTypes: ['stratum_income_above', 'stratum_influence_above', 'resource_price_above', 'inflation_above'],
        preferredStrata: ['merchant', 'capitalist'],
        stratumWeights: { merchant: 3.0, capitalist: 2.0 },
        activeEffects: { tradeBonus: 0.18, incomePercentBonus: 0.08 },
        unsatisfiedPenalty: { approval: { merchant: -4 } },
    },

    absolutism: {
        name: '绝对君主制',
        spectrum: 'right',
        icon: 'Crown',
        color: 'text-purple-500',
        unlockEpoch: 4,
        historicalRef: '路易十四、彼得大帝',
        description: '朕即国家',
        issues: ['hierarchy', 'centralization'],
        conditionTypes: ['coalition_size_below', 'legitimacy_above'],
        preferredStrata: ['official', 'landowner'],
        stratumWeights: { official: 2.0 },
        activeEffects: { taxEfficiency: 0.15, buildingCostMod: -0.12 },
        unsatisfiedPenalty: {},
    },

    humanism: {
        name: '人文主义',
        spectrum: 'center',
        icon: 'Book',
        color: 'text-rose-300',
        unlockEpoch: 4,
        historicalRef: '文艺复兴',
        description: '以人为本',
        issues: ['education', 'progress'],
        conditionTypes: ['stratum_approval_above', 'epoch_at_least'],
        preferredStrata: ['scribe', 'artisan', 'engineer'],
        stratumWeights: { scribe: 3.0, artisan: 2.0 },
        activeEffects: { researchSpeed: 0.15, cultureBonus: 0.12 },
        unsatisfiedPenalty: {},
    },

    colonialism: {
        name: '殖民主义',
        spectrum: 'right',
        icon: 'Globe',
        color: 'text-emerald-500',
        unlockEpoch: 4,
        historicalRef: '大航海时代',
        description: '开拓新世界',
        issues: ['expansion', 'trade'],
        conditionTypes: ['stratum_income_above', 'at_war'],
        preferredStrata: ['merchant', 'soldier', 'navigator'],
        stratumWeights: { merchant: 2.0, soldier: 1.5 },
        activeEffects: { tradeBonus: 0.15, diplomaticBonus: 0.8 },
        unsatisfiedPenalty: {},
    },

    // ========== 启蒙时代 (epoch >= 5) ==========
    classical_liberalism: {
        name: '古典自由主义',
        spectrum: 'center',
        icon: 'Lightbulb',
        color: 'text-yellow-400',
        unlockEpoch: 5,
        historicalRef: '洛克、亚当斯密',
        description: '自由放任经济',
        issues: ['liberty', 'free_market'],
        conditionTypes: ['avg_tax_below', 'stratum_approval_above', 'price_stability', 'deflation_below'],
        preferredStrata: ['merchant', 'capitalist', 'artisan'],
        stratumWeights: { merchant: 2.0, capitalist: 2.5, artisan: 1.5 },
        activeEffects: { incomePercentBonus: 0.12, populationGrowth: 0.08 },
        unsatisfiedPenalty: { approval: { merchant: -4, capitalist: -4 } },
    },

    enlightened_despotism: {
        name: '开明专制',
        spectrum: 'center',
        icon: 'GraduationCap',
        color: 'text-indigo-400',
        unlockEpoch: 5,
        historicalRef: '腎特烈大帝、叶卡捷琳娜',
        description: '国王为国家第一仆人',
        issues: ['reform', 'centralization'],
        conditionTypes: ['coalition_size_below', 'legitimacy_above', 'stability_above'],
        preferredStrata: ['official', 'scribe', 'engineer'],
        stratumWeights: { official: 2.0, scribe: 2.0, engineer: 1.5 },
        activeEffects: { researchSpeed: 0.18, buildingCostMod: -0.08 },
        unsatisfiedPenalty: {},
    },
    conservatism: {
        name: '保守主义',
        spectrum: 'right',
        icon: 'Shield',
        color: 'text-gray-400',
        unlockEpoch: 5,
        historicalRef: '伯克、梅特涅',
        description: '维护传统秩序',
        issues: ['tradition', 'stability'],
        conditionTypes: ['stability_above', 'legitimacy_above'],
        preferredStrata: ['landowner', 'cleric', 'official'],
        stratumWeights: { landowner: 2.0, cleric: 2.0 },
        activeEffects: { stability: 0.12, legitimacyBonus: 0.08 },
        unsatisfiedPenalty: { stability: -0.04 },
    },

    utopian_socialism: {
        name: '空想社会主义',
        spectrum: 'left',
        icon: 'Sparkles',
        color: 'text-pink-400',
        unlockEpoch: 5,
        historicalRef: '莫尔乌托邦、欧文',
        description: '构建理想社会',
        issues: ['equality', 'progress'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard'],
        // 左派立场只关心平民阶层，不关心地主/资本家
        preferredStrata: ['worker', 'artisan', 'peasant', 'scribe'],
        stratumWeights: { scribe: 2.0, worker: 1.5, artisan: 1.5 },
        activeEffects: { researchSpeed: 0.12, approval: { worker: 8 } },
        unsatisfiedPenalty: {},
    },

    physiocracy: {
        name: '重农主义',
        spectrum: 'center',
        icon: 'Wheat',
        color: 'text-lime-400',
        unlockEpoch: 5,
        historicalRef: '魁奈学派',
        description: '土地是财富之源',
        issues: ['land', 'free_market'],
        conditionTypes: ['stratum_influence_above', 'stratum_approval_above', 'food_affordable', 'resource_price_below'],
        preferredStrata: ['landowner', 'peasant'],
        stratumWeights: { landowner: 2.5, peasant: 2.0 },
        activeEffects: { gatherBonus: 0.15, approval: { peasant: 8, landowner: 8 } },
        unsatisfiedPenalty: { approval: { landowner: -4 } },
    },

    // ========== 工业时代 (epoch >= 6) ==========
    marxism: {
        name: '马克思主义',
        spectrum: 'left',
        icon: 'Factory',
        color: 'text-red-500',
        unlockEpoch: 6,
        historicalRef: '共产党宣言',
        description: '工人阶级专政',
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
        name: '社会民主主义',
        spectrum: 'left',
        icon: 'HeartHandshake',
        color: 'text-rose-400',
        unlockEpoch: 6,
        historicalRef: '伯恩斯坦修正主义',
        description: '渐进改良',
        issues: ['equality', 'welfare'],
        conditionTypes: ['stratum_approval_above', 'stratum_living_standard', 'stability_above', 'food_affordable', 'price_stability'],
        preferredStrata: ['worker', 'scribe', 'artisan', 'peasant'],
        stratumWeights: { worker: 2.0, scribe: 1.5, artisan: 1.5 },
        activeEffects: { approval: { worker: 12, peasant: 8 }, stability: 0.08 },
        unsatisfiedPenalty: { approval: { worker: -4 } },
    },

    anarchism: {
        name: '无政府主义',
        spectrum: 'left',
        icon: 'CircleSlash',
        color: 'text-gray-500',
        unlockEpoch: 6,
        historicalRef: '巴枯宁、克鲁泡特金',
        description: '废除一切权威',
        issues: ['liberty', 'revolution'],
        conditionTypes: ['stability_below', 'stratum_approval_below'],
        preferredStrata: ['worker', 'artisan', 'peasant'],
        stratumWeights: { worker: 2.0, artisan: 2.0 },
        activeEffects: { needsReduction: 0.15 },
        unsatisfiedPenalty: { stability: -0.06 },
    },

    nationalism: {
        name: '民族主义',
        spectrum: 'right',
        icon: 'Flag',
        color: 'text-orange-500',
        unlockEpoch: 6,
        historicalRef: '俨斯麦统一德国',
        description: '民族国家至上',
        issues: ['nation', 'military'],
        conditionTypes: ['at_war', 'stratum_approval_above'],
        preferredStrata: ['soldier', 'official', 'landowner'],
        stratumWeights: { soldier: 2.5, official: 1.5 },
        activeEffects: { militaryBonus: 0.22, approval: { soldier: 12 } },
        unsatisfiedPenalty: {},
    },
    neoliberalism: {
        name: '新自由主义',
        spectrum: 'right',
        icon: 'TrendingUp',
        color: 'text-emerald-400',
        unlockEpoch: 6,
        historicalRef: '哈耶克、弗里德曼',
        description: '市场万能',
        issues: ['free_market', 'privatization'],
        conditionTypes: ['stratum_income_above', 'avg_tax_below', 'resource_price_above', 'inflation_above'],
        preferredStrata: ['capitalist', 'merchant'],
        stratumWeights: { capitalist: 4.0, merchant: 2.0 },
        activeEffects: { incomePercentBonus: 0.18, tradeBonus: 0.12 },
        unsatisfiedPenalty: { approval: { capitalist: -6 } },
    },

    technocracy: {
        name: '技术官僚主义',
        spectrum: 'center',
        icon: 'Cpu',
        color: 'text-sky-400',
        unlockEpoch: 6,
        historicalRef: '圣西门、专家治国',
        description: '让专家决策',
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
        name: '数字民主',
        spectrum: 'center',
        icon: 'Monitor',
        color: 'text-cyan-300',
        unlockEpoch: 7,
        historicalRef: '电子政务、区块链投票',
        description: '网络参与决策',
        issues: ['liberty', 'progress'],
        conditionTypes: ['coalition_size_above', 'stability_above', 'legitimacy_above'],
        preferredStrata: ['engineer', 'scribe', 'worker'],
        stratumWeights: { engineer: 2.0, scribe: 2.0, worker: 1.5 },
        activeEffects: { legitimacyBonus: 0.18, stability: 0.12 },
        unsatisfiedPenalty: {},
    },

    eco_socialism: {
        name: '生态社会主义',
        spectrum: 'left',
        icon: 'Leaf',
        color: 'text-green-500',
        unlockEpoch: 7,
        historicalRef: '绿色新政',
        description: '环境公正',
        issues: ['equality', 'nature'],
        conditionTypes: ['stratum_approval_above', 'stability_above'],
        preferredStrata: ['worker', 'peasant', 'engineer'],
        stratumWeights: { worker: 2.0, peasant: 2.0, engineer: 1.5 },
        activeEffects: { needsReduction: 0.15, stability: 0.08 },
        unsatisfiedPenalty: {},
    },

    transhumanism: {
        name: '超人类主义',
        spectrum: 'right',
        icon: 'Zap',
        color: 'text-violet-400',
        unlockEpoch: 7,
        historicalRef: '技术奇点',
        description: '超越人类极限',
        issues: ['progress', 'efficiency'],
        conditionTypes: ['epoch_at_least', 'stratum_income_above'],
        preferredStrata: ['engineer', 'capitalist'],
        stratumWeights: { engineer: 4.0, capitalist: 2.0 },
        activeEffects: { researchSpeed: 0.28, populationGrowth: 0.08 },
        unsatisfiedPenalty: {},
    },
};

// ========== 运行时政治立场存储 ==========
// 此对象存储带有生成条件的立场实例
export const POLITICAL_STANCES = {};

// 初始化基础立场（不含动态条件）
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
 * 获取指定时代可用的立场列表
 */
export function getAvailableStances(epoch) {
    return Object.values(STANCE_TEMPLATES).filter(s => s.unlockEpoch <= epoch);
}

/**
 * 为官员生成带动态条件的政治立场
 * @param {string} sourceStratum - 官员出身阶层
 * @param {number} epoch - 当前时代
 * @param {Object} market - 当前市场数据（包含 prices 等信息）
 * @returns {Object} { stanceId, conditionParams, conditionText }
 */
export function assignPoliticalStance(sourceStratum, epoch, market = null) {
    // 获取可用立场（考虑时代上下限）
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
        // 骑士阶层降权
        if (sourceStratum === 'knight') stratumWeight = 0.3;
        // 确保权重不为0
        stratumWeight = Math.max(0.1, stratumWeight);
        weights[stance.id] = stratumWeight;
        totalWeight += stratumWeight;
    });

    // 选择立场
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

    // 获取立场偏好的阶层列表（用于生成符合立场意识形态的条件）
    const preferredStrata = stance.preferredStrata || [sourceStratum];
    // 从偏好阶层中随机选择一个用于条件
    const getPreferredStratum = () => {
        if (preferredStrata.length > 0) {
            return preferredStrata[Math.floor(Math.random() * preferredStrata.length)];
        }
        return sourceStratum;
    };

    // === 强制添加一个执政联盟相关条件 ===
    const coalitionCondTypes = ['coalition_includes', 'coalition_size_above', 'coalition_size_below'];
    const coalitionType = coalitionCondTypes[Math.floor(Math.random() * coalitionCondTypes.length)];
    const coalitionCondDef = CONDITION_TYPES[coalitionType];
    if (coalitionCondDef) {
        // 对于 coalition_includes，使用立场偏好的阶层（而非出身阶层）
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

    // === 添加1-2个与立场相关阶层的条件（基于preferredStrata而非出身阶层） ===
    // 注意：移除了 stratum_approval_below，因为"希望某阶层满意度低"只适合激进立场（农民起义派、无政府主义等）
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
            // 90%概率使用立场偏好阶层（确保条件与立场意识形态匹配）
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

    // === 可选：从立场定义的条件类型中选择1个（去重） ===
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

    // === 为该官员随机化效果（基于立场模板，加减20%浮动） ===
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
 * 检查立场是否被满足
 */
export function isStanceSatisfied(stanceId, gameState, conditionParams) {
    if (!conditionParams || conditionParams.length === 0) return false;

    return conditionParams.every(c => {
        const condType = CONDITION_TYPES[c.typeId];
        return condType ? condType.check(c.params, gameState) : false;
    });
}

/**
 * 获取立场基础信息
 */
export function getStanceInfo(stanceId) {
    return POLITICAL_STANCES[stanceId] || STANCE_TEMPLATES[stanceId] || null;
}

/**
 * 获取立场的当前效果
 */
export function getStanceEffects(stanceId, gameState, conditionParams) {
    const stance = STANCE_TEMPLATES[stanceId];
    if (!stance) return { satisfied: false, effects: {} };

    const satisfied = isStanceSatisfied(stanceId, gameState, conditionParams);
    const effects = satisfied ? stance.activeEffects : stance.unsatisfiedPenalty;

    return { satisfied, effects: effects || {} };
}
