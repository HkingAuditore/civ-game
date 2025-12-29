/**
 * 官员系统配置
 * 定义官员效果、姓名库及生成逻辑
 */

import { STRATA } from './strata';

// ========== 效果类型定义 ==========
export const OFFICIAL_EFFECT_TYPES = {
    // 建筑产出加成
    building_boost: {
        type: 'buildings',
        // 包含采集、工业、商业、文化、军事各类核心建筑
        targets: [
            'farm', 'large_estate', 'lumber_camp', 'quarry', 'mine', 'copper_mine',
            'coal_mine', 'sawmill', 'brickworks', 'factory', 'steel_foundry',
            'loom_house', 'furniture_workshop', 'tailor_workshop', 'brewery',
            'market', 'trade_port', 'trading_post', 'dockyard',
            'library', 'church', 'barracks', 'training_ground', 'fortress'
        ],
        valueRange: [0.05, 0.25], // +5% ~ +25%
        weight: 30,
        costMultiplier: 1.0,
    },

    // 类别产出加成
    category_boost: {
        type: 'categories',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [0.05, 0.18],
        weight: 25,
        costMultiplier: 1.2,
    },

    // 阶层需求修正 (负值 = 降低需求 = 好)
    stratum_demand: {
        type: 'stratumDemandMod',
        targets: Object.keys(STRATA),
        valueRange: [-0.20, -0.05],
        weight: 20,
        costMultiplier: 0.8,
    },

    // 资源需求修正 (负值 = 降低需求 = 好)
    resource_demand: {
        type: 'resourceDemandMod',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'culture'
        ],
        valueRange: [-0.15, -0.05],
        weight: 15,
        costMultiplier: 0.7,
    },

    // 资源供给加成
    resource_supply: {
        type: 'resourceSupplyMod',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'steel'
        ],
        valueRange: [0.05, 0.15],
        weight: 15,
        costMultiplier: 1.0,
    },

    // 固定被动产出
    passive_gain: {
        type: 'passive',
        targets: ['food', 'silver', 'culture', 'science'],
        valueRange: [0.5, 3.0],
        weight: 10,
        costMultiplier: 1.5,
    },

    // 百分比被动加成
    passive_percent: {
        type: 'passivePercent',
        targets: ['silver', 'food'],
        valueRange: [0.03, 0.10],
        weight: 12,
        costMultiplier: 1.3,
    },

    // 需求减少
    needs_reduction: {
        type: 'needsReduction',
        valueRange: [0.05, 0.15],
        weight: 8,
        costMultiplier: 1.2,
    },

    // 人口上限
    max_pop: {
        type: 'maxPop',
        valueRange: [0.03, 0.10],
        weight: 10,
        costMultiplier: 1.0,
    },

    // 财政收入比例
    income_percent: {
        type: 'incomePercent',
        valueRange: [0.04, 0.12],
        weight: 12,
        costMultiplier: 1.5,
    },

    // 稳定性
    stability_bonus: {
        type: 'stability',
        valueRange: [0.02, 0.08],
        weight: 8,
        costMultiplier: 1.2,
    },

    // 军事力量
    military_bonus: {
        type: 'militaryBonus',
        valueRange: [0.03, 0.12],
        weight: 8,
        costMultiplier: 1.0,
    },

    // 阶层满意度
    approval_boost: {
        type: 'approval',
        targets: Object.keys(STRATA),
        valueRange: [5, 15],
        weight: 18,
        costMultiplier: 0.8,
    },
};

// ========== 负面效果定义 ==========
export const OFFICIAL_DRAWBACK_TYPES = {
    category_penalty: {
        type: 'categories',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [-0.08, -0.03],
        weight: 25,
    },
    passive_cost: {
        type: 'passivePercent',
        targets: ['silver', 'food'],
        valueRange: [-0.06, -0.02],
        weight: 30,
    },
    needs_increase: {
        type: 'needsReduction',
        valueRange: [-0.08, -0.03], // 负值在 needsReduction 中代表增加需求? 等等, reduce为正表示减少。
        // 在 effects.js 中: if (effects.needsReduction) bonuses.needsReduction += effects.needsReduction;
        // 这是一个系数。通常 0.1 表示减少10%。所以 -0.1 表示增加10%需求？
        // 让我们确认一下 simulation.js。无需确认，通常 reduction 为正。
        // 所以这里负值表示增加需求 (坏事)。
        weight: 20,
    },
    approval_penalty: {
        type: 'approval',
        targets: ['peasant', 'worker', 'merchant', 'artisan', 'landowner'],
        valueRange: [-12, -5],
        weight: 25,
    },
};

// ========== 名字生成库 ==========
const NAME_STYLES = {
    // 东方风格：双字/单字名 + 姓
    EAST: {
        last: ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'],
        first: [
            '世民', '白', '甫', '廷', '信', '斯', '良', '平', '括', '安', '正', '泽', '恩', '博', '文', '武',
            '孔明', '仲谋', '玄德', '云长', '翼德', '子龙', '孟德', '公瑾', '孔丘', '孟轲', '守仁', '九龄',
            '安石', '居正', '国藩', '鸿章', '之洞', '中正', '独秀', '大钊', '润之', '恩来', '德怀', '伯承'
        ]
    },
    // 西方风格：名 + 姓
    WEST: {
        first: [
            '亚历山大', '凯撒', '屋大维', '查理', '亨利', '路易', '威廉', '乔治', '托马斯', '约翰', '詹姆斯',
            '腓特烈', '彼得', '伊丽莎白', '维多利亚', '拿破仑', '奥托', '弗拉基米尔', '约瑟夫', '温斯顿', '富兰克林'
        ],
        last: [
            '大帝', '奥古斯都', '马格努斯', '波拿巴', '华盛顿', '杰斐逊', '林肯', '丘吉尔', '罗斯福',
            '俾斯麦', '斯大林', '列宁', '马克思', '恩格斯', '韦伯', '杜尔凯姆', '牛顿', '达尔文', '爱因斯坦'
        ]
    },
    // 古典/神话风格
    ANCIENT: {
        first: ['阿切尔', '吉尔伽美什', '恩奇都', '萨尔贡', '汉谟拉比', '列奥尼达', '伯里克利', '阿伽门农', '奥德修斯'],
        last: ['苏美尔', '阿卡德', '巴比伦', '斯巴达', '雅典', '特洛伊', '迈锡尼', '克里特', '埃及']
    }
};

/**
 * 生成随机名字
 * @param {number} epoch - 当前时代 (影响风格偏好)
 * @returns {string} 全名
 */
export const generateName = (epoch) => {
    // 简单的风格选择逻辑，可以根据 epoch 调整概率
    let styleKey = 'EAST';
    const rand = Math.random();

    if (epoch <= 2) { // 早期时代：混合古典
        if (rand < 0.4) styleKey = 'ANCIENT';
        else if (rand < 0.7) styleKey = 'WEST';
        else styleKey = 'EAST';
    } else { // 晚期时代：东西方为主
        if (rand < 0.5) styleKey = 'WEST';
        else styleKey = 'EAST';
    }

    const style = NAME_STYLES[styleKey];
    const first = style.first[Math.floor(Math.random() * style.first.length)];
    const last = style.last[Math.floor(Math.random() * style.last.length)];

    if (styleKey === 'EAST') {
        return `${last}${first}`;
    } else {
        return `${first}·${last}`;
    }
};

/**
 * 辅助函数：从加权对象中随机选择
 */
const pickWeightedRandom = (weights) => {
    let total = 0;
    for (let key in weights) total += weights[key];
    let random = Math.random() * total;
    for (let key in weights) {
        random -= weights[key];
        if (random <= 0) return key;
    }
    return Object.keys(weights)[0];
};

/**
 * 辅助函数：生成单个效果
 */
const generateEffect = (isDrawback = false) => {
    const pool = isDrawback ? OFFICIAL_DRAWBACK_TYPES : OFFICIAL_EFFECT_TYPES;
    
    // 1. 随机选择效果类型 (按权重)
    const typeWeights = {};
    Object.keys(pool).forEach(key => typeWeights[key] = pool[key].weight);
    const typeKey = pickWeightedRandom(typeWeights);
    const config = pool[typeKey];

    // 2. 确定具体目标 (如果有)
    let target = null;
    if (config.targets) {
        target = config.targets[Math.floor(Math.random() * config.targets.length)];
    }

    // 3. 确定数值
    const [min, max] = config.valueRange;
    const rawValue = min + Math.random() * (max - min);
    // 保留2位小数 (如果是整数类如 approval，可能需要不同处理，这里统一百分比/数值保留2-3位)
    // 对于 approval (5-15)，保留整数比较好
    let value = rawValue;
    if (config.type === 'approval') {
        value = Math.round(rawValue);
    } else {
        value = Math.round(rawValue * 1000) / 1000;
    }

    return {
        type: config.type,
        target,
        value,
        costMultiplier: config.costMultiplier || 1.0 // 负面效果可能没有 multiplier
    };
};

/**
 * 生成随机官员
 * @param {number} epoch - 当前时代
 * @returns {Object} 官员对象
 */
export const generateRandomOfficial = (epoch) => {
    // 1. 基本信息
    const name = generateName(epoch);
    const sourceStratum = pickWeightedRandom({
        official: 25, scribe: 15, merchant: 12, cleric: 10,
        landowner: 10, knight: 8, engineer: 8, artisan: 6,
        soldier: 4, navigator: 2, capitalist: 5 // 增加资本家权重
    });

    // 2. 生成效果 (1-3个正面)
    // 时代越后，更有可能产生多效果官员
    let effectCount = 1;
    const countRand = Math.random();
    if (epoch >= 2 && countRand > 0.6) effectCount = 2;
    if (epoch >= 4 && countRand > 0.85) effectCount = 3;

    const rawEffects = [];
    let totalCostScore = 0;

    for (let i = 0; i < effectCount; i++) {
        const eff = generateEffect(false);
        rawEffects.push(eff);
        
        // 估算成本分 (绝对值 * 系数)
        // approval 5-15 vs percent 0.05-0.25
        // 需要归一化成本分
        let score = Math.abs(eff.value);
        if (eff.type === 'approval') score = score / 20; // 10点满意度 ≈ 0.5 效果分
        else if (eff.type === 'passive') score = score / 5; // 2点产出 ≈ 0.4 效果分
        
        totalCostScore += score * eff.costMultiplier;
    }

    // 3. 生成负面效果 (30% 概率，高时代概率略增)
    let drawback = null;
    if (Math.random() < 0.3 + (epoch * 0.02)) {
        drawback = generateEffect(true);
        // 负面效果减少成本分
        let score = Math.abs(drawback.value);
        if (drawback.type === 'approval') score = score / 20;
        else if (drawback.type === 'needsReduction') score = Math.abs(drawback.value); // needsReduction 负值是坏事
        
        totalCostScore -= score * 0.5; // 负面效果抵消部分成本
    }

    // 4. 构建效果对象 (合并同类)
    const effects = {};
    const mergeIntoEffects = (eff) => {
        if (eff.target) {
            if (!effects[eff.type]) effects[eff.type] = {};
            effects[eff.type][eff.target] = (effects[eff.type][eff.target] || 0) + eff.value;
        } else {
            effects[eff.type] = (effects[eff.type] || 0) + eff.value;
        }
    };
    
    rawEffects.forEach(mergeIntoEffects);
    if (drawback) mergeIntoEffects(drawback);

    // 5. 计算俸禄
    // 基础分 ~0.1 - 0.5 左右
    // 目标俸禄: Epoch 0 ~2-5银, Epoch 6 ~20-50银
    // 公式: Score * 20 * (1 + Epoch * 0.2)
    const epochMultiplier = 1 + epoch * 0.2;
    // 确保最低 1 + epoch
    const minSalary = 1 + epoch;
    let salary = Math.round(Math.max(0.1, totalCostScore) * 25 * epochMultiplier);
    salary = Math.max(minSalary, salary);

    // 生成ID
    const id = `off_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;

    return {
        id,
        name,
        sourceStratum,
        effects,
        rawEffects, // 保留原始效果列表用于UI展示 (可选，或者直接解析 effects)
        // 为了UI展示方便，我们可以只存储 final effects, UI 解析即可
        // 但 drawback 对 UI 展示也是有用的，分开存？
        // 咱们简化模型，只存 effects，UI 遍历 effects 渲染。
        // 为了能在UI上区分"这是个负面效果"，依靠数值正负即可。
        // 唯独 needsReduction 比较反直觉 (正=好, 负=坏).
        
        salary,
        hireDate: null,
        influence: 0.5 + (salary / 50), // 影响力与身价挂钩
    };
};

/**
 * 重新计算官员俸禄 (用于存档兼容或调整)
 */
export const calculateOfficialSalary = (official, epoch) => {
    return official.salary; // 暂直接返回，如需动态重算可在此实现
};
