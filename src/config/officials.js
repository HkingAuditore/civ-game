/**
 * 官员系统配置
 * 定义官员效果、姓名库及生成逻辑
 */

import { STRATA } from './strata';
import { assignPoliticalStance } from './politicalStances';

// ========== 效果类型定义 ==========
// 设计原则：每种效果类型都应该能显著影响玩家的游戏风格和决策
// 扩展时只需在此处添加新类型，系统会自动识别并应用

export const OFFICIAL_EFFECT_TYPES = {
    // ============ 生产类效果 ============
    // 建筑产出加成
    building_boost: {
        type: 'buildings',
        category: 'production',
        targets: [
            'farm', 'large_estate', 'lumber_camp', 'quarry', 'mine', 'copper_mine',
            'coal_mine', 'sawmill', 'brickworks', 'factory', 'steel_foundry',
            'loom_house', 'furniture_workshop', 'tailor_workshop', 'brewery',
            'market', 'trade_port', 'trading_post', 'dockyard',
            'library', 'church', 'barracks', 'training_ground', 'fortress'
        ],
        valueRange: [0.08, 0.35], // +8% ~ +35% (大幅提升)
        weight: 25,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 产出 +${(val * 100).toFixed(0)}%`,
    },

    // 类别产出加成
    category_boost: {
        type: 'categories',
        category: 'production',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [0.06, 0.30], // 大幅提升
        weight: 20,
        costMultiplier: 1.2,
        description: (val, target) => `${target}类建筑产出 +${(val * 100).toFixed(0)}%`,
    },

    // 战时产出加成
    wartime_production: {
        type: 'wartimeProduction',
        category: 'production',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.3,
        description: (val) => `战时产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 经济类效果 ============
    // 贸易利润加成
    trade_bonus: {
        type: 'tradeBonus',
        category: 'economy',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 15,
        costMultiplier: 1.4,
        description: (val) => `贸易利润 +${(val * 100).toFixed(0)}%`,
    },

    // 税收效率加成
    tax_efficiency: {
        type: 'taxEfficiency',
        category: 'economy',
        valueRange: [0.06, 0.25], // 大幅提升
        weight: 15,
        costMultiplier: 1.5,
        description: (val) => `税收效率 +${(val * 100).toFixed(0)}%`,
    },

    // 建筑成本降低
    building_cost_reduction: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 12,
        costMultiplier: 1.2,
        description: (val) => `建筑成本 ${(val * 100).toFixed(0)}%`,
    },

    // 生产原料成本降低（只影响有input和output的建筑）
    production_input_cost: {
        type: 'productionInputCost',
        category: 'economy',
        targets: [
            'sawmill', 'brickworks', 'reed_works', 'brewery', 'furniture_workshop',
            'culinary_kitchen', 'loom_house', 'dye_works', 'tailor_workshop',
            'bronze_foundry', 'iron_tool_workshop', 'steel_foundry', 'wool_workshop',
            'factory', 'printing_house'
        ],
        valueRange: [-0.30, -0.08], // -8% ~ -30% 原料消耗 (大幅提升)
        weight: 18, // 提高权重，使效果更容易出现
        costMultiplier: 1.1,
        description: (val, target) => `${target}原料消耗 ${(val * 100).toFixed(0)}%`,
    },

    // 税收收入加成
    income_percent: {
        type: 'incomePercent',
        category: 'economy',
        valueRange: [0.06, 0.22], // 大幅提升
        weight: 12,
        costMultiplier: 1.5,
        description: (val) => `税收收入 +${(val * 100).toFixed(0)}%`,
    },

    // 固定被动产出
    passive_gain: {
        type: 'passive',
        category: 'economy',
        targets: ['food', 'silver', 'culture', 'science'],
        valueRange: [50, 2500], // 大幅提升，配合时代缩放
        weight: 10,
        costMultiplier: 1.5,
        description: (val, target) => `每日 ${target} +${val.toFixed(1)}`,
    },

    // 百分比被动加成
    passive_percent: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [0.06, 0.28], // 大幅提升
        weight: 12,
        costMultiplier: 1.3,
        description: (val, target) => `${target} 产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 需求/资源类效果 ============
    // 阶层需求修正 (负值 = 降低需求 = 好)
    stratum_demand: {
        type: 'stratumDemandMod',
        category: 'needs',
        targets: Object.keys(STRATA),
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 15,
        costMultiplier: 0.8,
        description: (val, target) => `${target} 需求 ${(val * 100).toFixed(0)}%`,
    },

    // 资源需求修正 (负值 = 降低需求 = 好)
    resource_demand: {
        type: 'resourceDemandMod',
        category: 'needs',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'culture'
        ],
        valueRange: [-0.28, -0.06], // 大幅提升
        weight: 12,
        costMultiplier: 0.7,
        description: (val, target) => `${target} 需求 ${(val * 100).toFixed(0)}%`,
    },

    // 资源供给加成
    resource_supply: {
        type: 'resourceSupplyMod',
        category: 'needs',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'steel'
        ],
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 供给 +${(val * 100).toFixed(0)}%`,
    },

    // 需求减少
    needs_reduction: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [0.08, 0.28], // 大幅提升
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `全民需求 -${(val * 100).toFixed(0)}%`,
    },

    // ============ 人口/发展类效果 ============
    // 人口上限
    max_pop: {
        type: 'maxPop',
        category: 'population',
        valueRange: [0.06, 0.25], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `人口上限 +${(val * 100).toFixed(0)}%`,
    },

    // 人口增长加成
    population_growth: {
        type: 'populationGrowth',
        category: 'population',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `人口增长 +${(val * 100).toFixed(0)}%`,
    },

    // 科研产出加成
    research_speed: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.4,
        description: (val) => `科研产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 政治类效果 ============
    // 阶层满意度
    approval_boost: {
        type: 'approval',
        category: 'politics',
        targets: Object.keys(STRATA),
        valueRange: [8, 25], // 大幅提升
        weight: 15,
        costMultiplier: 0.8,
        description: (val, target) => `${target} 满意度 +${val}`,
    },

    // 联盟阶层满意度
    coalition_approval: {
        type: 'coalitionApproval',
        category: 'politics',
        valueRange: [6, 18], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `联盟阶层满意度 +${val}`,
    },

    // 合法性加成
    legitimacy_bonus: {
        type: 'legitimacyBonus',
        category: 'politics',
        valueRange: [0.06, 0.22], // 大幅提升
        weight: 10,
        costMultiplier: 1.2,
        description: (val) => `合法性 +${(val * 100).toFixed(0)}%`,
    },

    // 组织度衰减 (负值=好)
    organization_decay: {
        type: 'organizationDecay',
        category: 'politics',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 8,
        costMultiplier: 1.1,
        description: (val) => `组织度增长 ${(val * 100).toFixed(0)}%`,
    },

    // 稳定度
    stability_bonus: {
        type: 'stability',
        category: 'politics',
        valueRange: [0.04, 0.15], // 大幅提升
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `稳定度 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 军事类效果 ============
    // 军事力量
    military_bonus: {
        type: 'militaryBonus',
        category: 'military',
        valueRange: [0.10, 0.35], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `军事力量 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护降低
    military_upkeep: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `军事维护 ${(val * 100).toFixed(0)}%`,
    },

    // ============ 外交类效果 ============
    // 外交关系加成
    diplomatic_bonus: {
        type: 'diplomaticBonus',
        category: 'diplomacy',
        valueRange: [1.0, 4.0], // 每日关系改善值 (大幅提升)
        weight: 8,
        costMultiplier: 1.0,
        description: (val) => `每日外交关系 +${val.toFixed(1)}`,
    },

    // 外交冷却缩短
    diplomatic_cooldown: {
        type: 'diplomaticCooldown',
        category: 'diplomacy',
        valueRange: [-0.35, -0.12], // 大幅提升
        weight: 6,
        costMultiplier: 0.9,
        description: (val) => `外交冷却 ${(val * 100).toFixed(0)}%`,
    },
};

// ========== 负面效果定义 ==========
export const OFFICIAL_DRAWBACK_TYPES = {
    // 产出惩罚
    category_penalty: {
        type: 'categories',
        category: 'production',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [-0.06, -0.02],
        weight: 20,
        description: (val, target) => `${target}类产出 ${(val * 100).toFixed(0)}%`,
    },

    // 被动消耗
    passive_cost: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [-0.04, -0.01],
        weight: 20,
        description: (val, target) => `每日 ${target} ${(val * 100).toFixed(0)}%`,
    },

    // 需求增加
    needs_increase: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [-0.06, -0.02],
        weight: 15,
        description: (val) => `全民需求 +${Math.abs(val * 100).toFixed(0)}%`,
    },

    // 阶层满意度惩罚
    approval_penalty: {
        type: 'approval',
        category: 'politics',
        targets: ['peasant', 'worker', 'merchant', 'artisan', 'landowner', 'serf', 'miner'],
        valueRange: [-8, -2],
        weight: 20,
        description: (val, target) => `${target} 满意度 ${val}`,
    },

    // 腐败 - 税收损失 (新增)
    corruption: {
        type: 'corruption',
        category: 'economy',
        valueRange: [0.02, 0.08],
        weight: 15,
        description: (val) => `腐败：税收损失 ${(val * 100).toFixed(0)}%`,
    },

    // 派系冲突 - 联盟内部稳定度降低 (新增)
    faction_conflict: {
        type: 'factionConflict',
        category: 'politics',
        valueRange: [0.01, 0.04],
        weight: 10,
        description: (val) => `派系冲突：稳定度 -${(val * 100).toFixed(0)}%`,
    },

    // 资源浪费 (新增)
    resource_waste: {
        type: 'resourceWaste',
        category: 'needs',
        targets: ['food', 'wood', 'stone', 'iron'],
        valueRange: [0.02, 0.06],
        weight: 12,
        description: (val, target) => `${target} 消耗 +${(val * 100).toFixed(0)}%`,
    },

    // 外交灾难 - 关系衰减加速 (新增)
    diplomatic_incident: {
        type: 'diplomaticIncident',
        category: 'diplomacy',
        valueRange: [0.1, 0.4], // 每日额外关系衰减
        weight: 8,
        description: (val) => `外交关系衰减 +${val.toFixed(1)}/日`,
    },

    // 建筑成本增加 (新增)
    building_cost_increase: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [0.04, 0.10],
        weight: 12,
        description: (val) => `建筑成本 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护增加 (新增)
    military_upkeep_increase: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [0.04, 0.10],
        weight: 10,
        description: (val) => `军事维护 +${(val * 100).toFixed(0)}%`,
    },

    // 科研减速 (新增)
    research_slowdown: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [-0.08, -0.02],
        weight: 8,
        description: (val) => `科研速度 ${(val * 100).toFixed(0)}%`,
    },

    // 生产原料成本增加（只影响有input和output的建筑）
    production_input_cost_increase: {
        type: 'productionInputCost',
        category: 'economy',
        targets: [
            'sawmill', 'brickworks', 'reed_works', 'brewery', 'furniture_workshop',
            'culinary_kitchen', 'loom_house', 'dye_works', 'tailor_workshop',
            'bronze_foundry', 'iron_tool_workshop', 'steel_foundry', 'wool_workshop',
            'factory', 'printing_house'
        ],
        valueRange: [0.05, 0.15], // +5% ~ +15% 原料消耗
        weight: 10,
        description: (val, target) => `${target}原料消耗 +${(val * 100).toFixed(0)}%`,
    },
};

// ========== 阶层效果偏好映射 ==========
// 定义每个阶层出身的官员更倾向于生成哪些效果类型
// preferredEffects: 偏好的正面效果key列表 (权重翻倍)
// preferredDrawbacks: 偏好的负面效果key列表 (权重翻倍)
// preferredTargets: 偏好的目标 (建筑/资源/阶层) - 如果效果有targets，优先选择这些
export const STRATUM_EFFECT_PREFERENCES = {
    // 自耕农：农业、人口、稳定 (新增)
    peasant: {
        preferredEffects: ['building_boost', 'population_growth', 'stability_bonus', 'resource_supply'],
        preferredDrawbacks: ['research_slowdown', 'military_upkeep_increase'],
        preferredTargets: ['farm', 'food', 'peasant', 'gather'],
    },
    // 工人：工业、建设、效率 (新增)
    worker: {
        preferredEffects: ['building_boost', 'category_boost', 'building_cost_reduction', 'resource_supply', 'production_input_cost'],
        preferredDrawbacks: ['production_input_cost_increase', 'diplomatic_incident'],
        preferredTargets: ['sawmill', 'brickworks', 'plank', 'brick', 'worker', 'industry'],
    },
    // 文书：行政、科研、稳定
    scribe: {
        preferredEffects: ['research_speed', 'stability_bonus', 'tax_efficiency', 'income_percent', 'organization_decay'],
        preferredDrawbacks: ['corruption', 'approval_penalty'],
        preferredTargets: ['library', 'culture', 'science'],
    },
    // 商人：贸易、经济、财政
    merchant: {
        preferredEffects: ['trade_bonus', 'income_percent', 'passive_percent', 'building_cost_reduction'],
        preferredDrawbacks: ['corruption', 'needs_increase'],
        preferredTargets: ['market', 'trade_port', 'trading_post', 'silver', 'merchant'],
    },
    // 教士：稳定、政治、满意度
    cleric: {
        preferredEffects: ['stability_bonus', 'approval_boost', 'coalition_approval', 'legitimacy_bonus', 'organization_decay'],
        preferredDrawbacks: ['faction_conflict', 'needs_increase'],
        preferredTargets: ['church', 'cleric', 'culture'],
    },
    // 地主：农业、人口、土地
    landowner: {
        preferredEffects: ['building_boost', 'category_boost', 'population_growth', 'max_pop', 'resource_supply'],
        preferredDrawbacks: ['approval_penalty', 'needs_increase'],
        preferredTargets: ['farm', 'large_estate', 'food', 'peasant', 'gather'],
    },
    // 工程师：工业、建筑、科技
    engineer: {
        preferredEffects: ['building_boost', 'category_boost', 'building_cost_reduction', 'research_speed', 'production_input_cost'],
        preferredDrawbacks: ['resource_waste', 'production_input_cost_increase'],
        preferredTargets: ['factory', 'steel_foundry', 'sawmill', 'brickworks', 'industry'],
    },
    // 工匠：工业产出、资源
    artisan: {
        preferredEffects: ['building_boost', 'resource_supply', 'category_boost', 'stratum_demand', 'production_input_cost'],
        preferredDrawbacks: ['resource_waste', 'production_input_cost_increase'],
        preferredTargets: ['loom_house', 'furniture_workshop', 'tailor_workshop', 'brewery', 'tools', 'cloth'],
    },
    // 军人：军事、战时、外交
    soldier: {
        preferredEffects: ['military_bonus', 'military_upkeep', 'wartime_production', 'stability_bonus'],
        preferredDrawbacks: ['diplomatic_incident', 'faction_conflict'],
        preferredTargets: ['barracks', 'training_ground', 'fortress', 'military', 'soldier', 'knight'],
    },
    // 航海家：贸易、外交、探索
    navigator: {
        preferredEffects: ['trade_bonus', 'diplomatic_bonus', 'diplomatic_cooldown', 'building_boost'],
        preferredDrawbacks: ['diplomatic_incident', 'corruption'],
        preferredTargets: ['dockyard', 'trade_port', 'navigator'],
    },
    // 资本家：经济、贸易、财政
    capitalist: {
        preferredEffects: ['income_percent', 'trade_bonus', 'tax_efficiency', 'building_cost_reduction', 'passive_percent'],
        preferredDrawbacks: ['corruption', 'approval_penalty', 'faction_conflict'],
        preferredTargets: ['factory', 'market', 'silver', 'capitalist', 'industry'],
    },
};

// ========== 名字生成库 ==========
// 各文化背景的姓名库
// ========== 名字生成库 (升级版) ==========
const NAME_STYLES = {
    // ========== 东亚 (更具官僚气息) ==========
    CHINESE: {
        last: [
            '李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林',
            '诸葛', '欧阳', '司马', '上官', '闻人', '皇甫', '夏侯', '公孙', '宇文', '长孙', '慕容', '申屠',
            '裴', '崔', '卢', '郑', '谢', '柳', '韩', '韦', '颜', '苏', '包', '狄', '寇', '范', '曾', '左',
            '孔', '孟', '墨', '荀', '庄', '列', '商', '白', '杜', '辛', '岳', '于', '戚', '海', '钱', '邓'
        ],
        // 文官常用字：偏儒家、治国、修身
        first_char_civil: [
            '安', '居', '廷', '守', '世', '克', '弘', '景', '伯', '仲', '叔', '季', '元', '孟', '德',
            '文', '光', '明', '学', '思', '仁', '义', '礼', '智', '信', '敬', '孝', '忠', '良', '善',
            '衡', '权', '操', '备', '亮', '瑜', '肃', '嘉', '懿', '统', '维', '逊', '恪', '师', '昭', '炎',
            '丘', '轲', '翟', '况', '周', '御', '鞅', '甫', '弃', '飞', '谦', '继', '瑞', '学', '稼'
        ],
        // 名字第二字（用于组成双字名）：偏宏大、自然、愿景
        second_char: [
            '石', '正', '玉', '龄', '同', '赞', '之', '源', '洲', '海', '岳', '山', '川', '在', '甫',
            '弼', '文', '武', '举', '直', '道', '远', '心', '性', '命', '理', '气', '常', '伦', '纲',
            '基', '业', '功', '绩', '勋', '烈', '辉', '煌', '鼎', '盛', '昌', '隆', '泰', '平', '宁', '康',
            '松', '柏', '梅', '兰', '竹', '菊', '风', '云', '雷', '电', '龙', '虎', '豹', '鹰', '鹏', '鲲'
        ],
        format: 'chinese_composite' // 特殊逻辑：大概率生成双字名
    },

    // ========== 日本 (公卿与大名风味) ==========
    JAPANESE: {
        last: [
            '近卫', '九条', '二条', '一条', '鹰司', // 五摄家
            '德川', '织田', '丰臣', '武田', '上杉', '毛利', '岛津', '伊达', '北条', // 战国大名
            '源', '平', '藤原', '橘', '菅原', // 古代氏族
            '西园寺', '三条', '今川', '足利', '细川', '山名', '大内', '朝仓', '浅井', '真田', '井伊',
            '伊藤', '山县', '大久保', '木户', '板垣', '大隈', '福泽', '渋泽', '夏目', '芥川', '太宰', '三岛'
        ],
        first: [
            '义经', '赖朝', '信长', '秀吉', '家康', '辉元', '政宗', '义弘', '信玄', '谦信',
            '道长', '赖通', '实资', '公季', '行成', '博雅', '晴明', '光秀', '利家', '元就',
            '义时', '泰时', '时宗', '尊氏', '义满', '秀赖', '忠胜', '幸村', '直政', '左近', '半兵卫',
            '博文', '有朋', '利通', '孝允', '退助', '重信', '谕吉', '荣一', '漱石', '龙之介', '治', '由纪夫'
        ],
        format: 'lastFirst'
    },

    // ========== 西欧 (分拆为法/德/英风格) ==========
    // 神圣罗马/德意志风格 (严谨、贵族)
    GERMANIC: {
        first: ['弗里德里希', '威廉', '奥托', '卡尔', '海因里希', '鲁道夫', '路德维希', '汉斯', '约瑟夫', '弗朗茨', '马克西米利安', '利奥波德',
            '康拉德', '西吉斯蒙德', '斐迪南', '阿道夫', '赫尔穆特', '阿尔布雷希特', '古斯塔夫', '瓦伦斯坦',
            '阿尔伯特', '马克斯', '维尔纳', '伊曼努尔', '格奥尔格', '约翰', '理查德', '西格蒙德'],
        last: ['霍亨索伦', '哈布斯堡', '维特尔斯巴赫', '哈耶克', '俾斯麦', '克劳塞维茨', '梅特涅', '瓦格纳', '施特劳斯', '海涅', '歌德', '席勒',
            '老毛奇', '罗恩', '兴登堡', '鲁登道夫', '施瓦本', '萨克森', '图恩', '塔克西斯', '李希滕斯坦',
            '爱因斯坦', '普朗克', '海森堡', '康德', '黑格尔', '尼采', '巴赫', '贝多芬', '弗洛伊德', '阿登纳', '默克尔'],
        particles: ['冯', '冯·德'], // 贵族前缀
        particleChance: 0.4, // 40% 概率出现前缀
        format: 'particleLastFirst'
    },

    // 法兰西风格 (优雅、集权)
    FRENCH: {
        first: ['路易', '查理', '弗朗索瓦', '亨利', '菲利普', '拿破仑', '让', '皮埃尔', '克洛德', '雅克', '古斯塔夫',
            '乔治', '米歇尔', '阿方斯', '奥诺雷', '亚历山大', '马克西米利安', '丹东',
            '布莱兹', '居里', '维克多', '克劳德', '奥古斯特', '夏尔', '埃马纽埃尔'],
        last: ['波旁', '瓦卢瓦', '卡佩', '黎塞留', '马扎然', '拉法耶特', '塔列朗', '伏尔泰', '卢梭', '雨果', '巴尔扎克',
            '罗伯斯庇尔', '奈伊', '缪拉', '达武', '马尔蒙', '苏尔特', '富歇', '笛卡尔', '孟德斯鸠',
            '巴斯德', '莫奈', '罗丹', '戴高乐', '蓬皮杜', '密特朗', '希拉克', '马克龙', '萨特', '加缪'],
        particles: ['德', '杜'],
        particleChance: 0.3,
        format: 'particleLastFirst'
    },

    // 英格兰风格 (务实、议会)
    ENGLISH: {
        first: ['威廉', '亨利', '爱德华', '理查', '乔治', '查尔斯', '詹姆斯', '托马斯', '亚瑟', '奥利弗', '温斯顿',
            '霍雷肖', '本杰明', '弗朗西斯', '罗伯特', '大卫', '维多利亚', '伊丽莎白',
            '艾萨克', '迈克尔', '史蒂芬', '简', '约翰', '玛格丽特', '托尼', '鲍里斯'],
        last: ['丘吉尔', '克伦威尔', '惠灵顿', '纳尔逊', '莎士比亚', '牛顿', '达尔文', '狄更斯', '培根', '洛克', '霍布斯',
            '沃尔波尔', '佩勒姆', '庇特', '格莱斯顿', '迪斯雷利', '张伯伦', '艾德礼', '德雷克', '霍金斯',
            '法拉第', '麦克斯韦', '图灵', '霍金', '奥斯汀', '奥威尔', '撒切尔', '布莱尔', '约翰逊', '凯恩斯'],
        // 英式头衔逻辑稍微复杂，暂不加particle，直接 First Last
        format: 'firstLast'
    },

    // ========== 斯拉夫/东欧 (粗犷、巨变) ==========
    SLAVIC: {
        first: ['伊凡', '彼得', '亚历山大', '尼古拉', '弗拉基米尔', '鲍里斯', '米哈伊尔', '德米特里', '列夫', '安德烈',
            '康斯坦丁', '尤里', '谢尔盖', '维亚切斯拉夫', '约瑟夫', '尼基塔', '列昂尼德',
            '安东', '费奥多尔', '伊戈尔', '瓦伦蒂娜'],
        last: ['罗曼诺夫', '留里克', '普希金', '托尔斯泰', '陀思妥耶夫斯基', '柴可夫斯基', '朱可夫', '加加林', '列宁', '斯大林',
            '布哈林', '季诺维也夫', '加米涅夫', '托洛茨基', '莫洛托夫', '赫鲁晓夫', '勃烈日涅夫', '安德罗波夫',
            '门捷列夫', '罗蒙诺索夫', '契诃夫', '果戈里', '戈尔巴乔夫', '叶利钦', '普京'],
        suffixes: ['维奇', '耶夫', '斯基'], // 简单的后缀模拟
        format: 'firstLast' // 简化处理，实际可以通过拼接生成 Lastname
    },

    // ========== 罗马/拜占庭 (古典、辉煌) ==========
    ROMAN: {
        // 三名法简化：Praenomen (名) + Nomen (氏族) + Cognomen (家族/绰号)
        first: ['盖乌斯', '卢修斯', '马库斯', '普布利乌斯', '昆图斯', '提图斯', '提比略', '塞克斯图斯',
            '格奈乌斯', '奥卢斯', '德基乌斯', '马尼乌斯', '查士丁尼', '君士坦丁', '狄奥多西'],
        last: ['尤利乌斯', '克劳狄乌斯', '科尔内利乌斯', '瓦莱里乌斯', '艾米利乌斯', '法比乌斯', '斯基皮奥', '西塞罗', '加图',
            '奥古斯都', '弗拉维乌斯', '安东尼乌斯', '多米提乌斯', '赛维鲁', '巴列奥略', '科穆宁'],
        cognomen: ['凯撒', '奥古斯都', '布鲁图斯', '西拉', '马略', '庞培', '安东尼', '尼禄', '图拉真', '哈德良',
            '克拉苏', '雷必达', '日耳曼尼库斯', '卡里古拉', '韦帕芗', '图密善', '奥勒留', '贝利萨留'],
        format: 'roman_tria_nomina'
    },

    // ========== 中东/伊斯兰 (繁复、黄金时代) ==========
    ISLAMIC: {
        first: ['穆罕默德', '艾哈迈德', '阿里', '哈桑', '侯赛因', '奥马尔', '奥斯曼', '阿卜杜勒', '优素福', '易卜拉欣',
            '苏莱曼', '穆拉德', '穆斯塔法', '巴耶济德', '赛义德', '萨拉丁', '拜巴尔', '帖木儿',
            '花拉子米', '海瑟姆', '贾迈勒', '安瓦尔'],
        last: ['拉希德', '阿巴斯', '倭马亚', '阿尤布', '塞尔柱', '伊本·西那', '伊本·鲁世德', '法拉比', '加扎利',
            '伊本·白图泰', '伊本·赫勒敦', '纳赛尔', '萨达特', '凯末尔', '霍梅尼', '巴列维',
            '阿拉法特', '卡扎菲', '侯赛因'],
        particles: ['伊本', '阿布'], // "之子", "之父"
        particleChance: 0.6,
        format: 'particleLastFirst' // 这里其实是 First + Particle + Last
    },

    // ========== 奇幻/克苏鲁/神秘 (用于非常后期或特殊事件) ==========
    ELDRITCH: {
        first: ['奈亚', '克图', '哈斯', '阿撒', '尤格', '莎布', '伊塔', '达贡', '海德',
            '阿布霍', '格赫', '伊波', '扎特', '兰', '洛夫'],
        last: ['拉托提普', '鲁', '塔', '托斯', '索托斯', '尼古拉丝', '库亚', '拉', '拉',
            '罗斯', '古', '萨', '瓜', '克拉夫特', '钱伯斯'],
        format: 'firstLast' // 简单的拼接
    }
};

// 称号/绰号库 (增加风味)
const EPITHETS = {
    positive: ['智者', '公正者', '狮心', '光辉者', '复兴者', '虔诚者', '好人', '博学者', '建设者',
        '征服者', '立法者', '太阳王', '奥古斯都', '真理守护者', '解放者', '受天命者', '完美的', '革新者', '宽宏者', '雷霆'],
    neutral: ['沉默者', '黑衣', '长脚', '矮子', '红胡子', '秃头', '无地王', '漫游者', '观星者',
        '简单的', '大胆', '痛风者', '好争吵者', '流亡者', '意外者', '中间人', '八字胡', '好猎者', '受洗者'],
    negative: ['残酷者', '暴君', '血斧', '懒惰者', '无能者', '疯子', '不幸者', '篡位者',
        '该诅咒者', '血腥', '软剑', '荒淫者', '昏庸者', '背教者', '阴谋家', '短命者', '无情者']
};
// 文化风格列表（用于随机选择）
const CULTURE_STYLES = Object.keys(NAME_STYLES);

/**
 * 生成随机名字
 * @param {number} epoch - 当前时代 (影响风格偏好)
 * @returns {string} 全名
 */
/**
 * 生成带有历史风味的随机名字
 */
export const generateName = (epoch) => {
    let styleKey;
    const rand = Math.random();

    // 1. 时代偏好选择 (稍微调整了逻辑，让风格更聚焦)
    if (epoch <= 2) {
        // 古典时代：罗马、中华、伊斯兰
        const styles = ['ROMAN', 'CHINESE', 'CHINESE', 'ISLAMIC', 'ISLAMIC', 'SLAVIC'];
        styleKey = styles[Math.floor(rand * styles.length)];
    } else if (epoch <= 5) {
        // 封建/启蒙：欧陆风云模式
        const styles = ['CHINESE', 'JAPANESE', 'GERMANIC', 'FRENCH', 'ENGLISH', 'SLAVIC', 'ISLAMIC'];
        styleKey = styles[Math.floor(rand * styles.length)];
    } else {
        // 工业/现代：全球化
        const keys = Object.keys(NAME_STYLES).filter(k => k !== 'ROMAN'); // 罗马此时不太合适了
        styleKey = keys[Math.floor(rand * keys.length)];
    }

    const style = NAME_STYLES[styleKey];
    let fullName = '';

    // 2. 根据格式生成名字
    if (style.format === 'chinese_composite') {
        // 中国逻辑：单字姓 + (50%单字名 / 50%双字名)
        const surname = style.last[Math.floor(Math.random() * style.last.length)];
        let givenName = '';

        // 第一字
        const char1 = style.first_char_civil[Math.floor(Math.random() * style.first_char_civil.length)];
        givenName += char1;

        // 70% 概率加第二字
        if (Math.random() < 0.7) {
            const char2 = style.second_char[Math.floor(Math.random() * style.second_char.length)];
            givenName += char2;
        }
        fullName = surname + givenName;

    } else if (style.format === 'roman_tria_nomina') {
        // 罗马三名法
        const praenomen = style.first[Math.floor(Math.random() * style.first.length)];
        const nomen = style.last[Math.floor(Math.random() * style.last.length)];
        const cognomen = style.cognomen[Math.floor(Math.random() * style.cognomen.length)];
        // 30% 概率只有两名，70% 概率三名
        fullName = (Math.random() < 0.3) ? `${praenomen}·${nomen}` : `${praenomen}·${nomen}·${cognomen}`;

    } else if (style.format === 'particleLastFirst') {
        // 带前缀的欧美/中东名字
        const first = style.first[Math.floor(Math.random() * style.first.length)];
        const last = style.last[Math.floor(Math.random() * style.last.length)];

        // 检查是否有前缀且触发概率
        let particle = '';
        if (style.particles && Math.random() < (style.particleChance || 0)) {
            particle = style.particles[Math.floor(Math.random() * style.particles.length)];

            if (styleKey === 'ISLAMIC') {
                // 伊斯兰：First + ibn + Last
                fullName = `${first}·${particle}·${last}`;
            } else {
                // 欧洲：First + von + Last
                fullName = `${first}·${particle}·${last}`;
            }
        } else {
            fullName = `${first}·${last}`;
        }

    } else {
        // 标准 First Last 或 Last First
        const first = style.first[Math.floor(Math.random() * style.first.length)];
        const last = style.last[Math.floor(Math.random() * style.last.length)];

        if (style.format === 'lastFirst') {
            fullName = `${last}${first}`;
        } else {
            fullName = `${first}·${last}`;
        }
    }

    // 3. 称号系统 (5% 概率获得称号，高Epoch概率增加)
    // 只有非中国/日本名字才加后缀称号（中文习惯通常不把绰号加在名字后面显示）
    if (styleKey !== 'CHINESE' && styleKey !== 'JAPANESE') {
        if (Math.random() < 0.05 + (epoch * 0.01)) {
            const epithetType = Math.random() < 0.7 ? 'positive' : (Math.random() < 0.9 ? 'neutral' : 'negative');
            const epithet = EPITHETS[epithetType][Math.floor(Math.random() * EPITHETS[epithetType].length)];
            fullName += ` “${epithet}”`;
        }
    }

    return fullName;
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
 * @param {boolean} isDrawback - 是否生成负面效果
 * @param {string} sourceStratum - 官员出身阶层（用于偏好加权）
 * @param {number} epoch - 当前时代（用于缩放效果数值）
 */
const generateEffect = (isDrawback = false, sourceStratum = null, epoch = 1) => {
    const pool = isDrawback ? OFFICIAL_DRAWBACK_TYPES : OFFICIAL_EFFECT_TYPES;
    const preferences = sourceStratum ? STRATUM_EFFECT_PREFERENCES[sourceStratum] : null;
    const preferredList = preferences
        ? (isDrawback ? preferences.preferredDrawbacks : preferences.preferredEffects) || []
        : [];
    const preferredTargets = preferences?.preferredTargets || [];

    // 1. 根据阶层偏好调整权重
    const typeWeights = {};
    Object.keys(pool).forEach(key => {
        let weight = pool[key].weight;
        // 如果是偏好的效果类型，权重翻倍
        if (preferredList.includes(key)) {
            weight *= 2.5;
        }
        typeWeights[key] = weight;
    });

    const typeKey = pickWeightedRandom(typeWeights);
    const config = pool[typeKey];

    // 2. 确定具体目标 (如果有)
    let target = null;
    if (config.targets && config.targets.length > 0) {
        // 找出与偏好目标的交集
        const matchingTargets = config.targets.filter(t => preferredTargets.includes(t));

        if (matchingTargets.length > 0 && Math.random() < 0.7) {
            // 70% 概率从偏好目标中选择
            target = matchingTargets[Math.floor(Math.random() * matchingTargets.length)];
        } else {
            // 否则随机选择
            target = config.targets[Math.floor(Math.random() * config.targets.length)];
        }
    }

    // 3. 确定数值 - 根据时代缩放
    // 时代缩放因子：早期时代效果较弱，后期更强
    // epoch 1: 0.4x, epoch 2: 0.55x, epoch 3: 0.7x, epoch 4: 0.85x, epoch 5: 1.0x, epoch 6+: 1.0x
    const epochScaleFactor = Math.min(1.0, 0.25 + epoch * 0.15);

    const [min, max] = config.valueRange;
    // 应用时代缩放：早期时代只能获得数值范围的一部分
    const scaledMin = min * epochScaleFactor;
    const scaledMax = max * epochScaleFactor;
    const rawValue = scaledMin + Math.random() * (scaledMax - scaledMin);

    let value = rawValue;
    if (config.type === 'approval' || config.type === 'coalitionApproval') {
        value = Math.round(rawValue);
    } else {
        value = Math.round(rawValue * 1000) / 1000;
    }

    return {
        type: config.type,
        target,
        value,
        costMultiplier: config.costMultiplier || 1.0
    };
};

/**
 * 生成随机官员
 * @param {number} epoch - 当前时代
 * @param {Object} popStructure - 当前人口结构 { stratumKey: population }
 * @param {Object} classInfluence - 当前影响力占比 { stratumKey: influencePercent }
 * @param {Object} market - 当前市场数据（包含 prices 等信息）
 * @returns {Object} 官员对象
 */
export const generateRandomOfficial = (epoch, popStructure = {}, classInfluence = {}, market = null) => {
    // 1. 基本信息
    const name = generateName(epoch);

    // 可作为官员出身的阶层列表
    const eligibleStrata = [
        'peasant', 'worker', // 新增：底层阶级也能出官员
        'scribe', 'merchant', 'cleric', 'landowner',
        'engineer', 'artisan', 'soldier', 'navigator', 'capitalist'
    ];

    // 基于人口和影响力计算权重
    const dynamicWeights = {};
    let totalWeight = 0;

    for (const stratum of eligibleStrata) {
        const pop = popStructure[stratum] || 0;
        const influence = classInfluence[stratum] || 0;

        // 只有人口 >= 1 的阶层才能产生官员
        if (pop >= 1) {
            // 权重 = 人口占比 + 影响力占比 (各占50%)
            // 使用 sqrt 让人口差异不至于太极端
            const popWeight = Math.sqrt(pop);
            const influenceWeight = influence * 100; // 影响力占比转换为百分比权重
            const weight = popWeight + influenceWeight;

            dynamicWeights[stratum] = Math.max(1, weight); // 最低权重为1
            totalWeight += dynamicWeights[stratum];
        }
    }

    // 如果没有任何符合条件的阶层，使用默认阶层（兜底）
    if (Object.keys(dynamicWeights).length === 0) {
        dynamicWeights['scribe'] = 1; // 默认文书
    }

    const sourceStratum = pickWeightedRandom(dynamicWeights);

    // 2. 生成效果 (2-8个正面)
    // 时代越后，更有可能产生多效果官员
    let minEffects = 1;
    if (epoch >= 3) minEffects = 2;
    if (epoch >= 6) minEffects = 3;

    let maxEffects = 3;
    if (epoch >= 3) maxEffects = 4;
    if (epoch >= 6) maxEffects = 5;

    // 随机生成数量
    let effectCount = Math.floor(minEffects + Math.random() * (maxEffects - minEffects + 1));

    const rawEffects = [];
    let totalCostScore = 0;

    for (let i = 0; i < effectCount; i++) {
        const eff = generateEffect(false, sourceStratum, epoch);
        rawEffects.push(eff);

        // 估算成本分 (绝对值 * 系数)
        // approval 5-15 vs percent 0.05-0.25
        // 需要归一化成本分
        let score = Math.abs(eff.value);
        if (eff.type === 'approval') score = score / 20; // 10点满意度 ≈ 0.5 效果分
        else if (eff.type === 'passive') score = score / 5; // 2点产出 ≈ 0.4 效果分

        totalCostScore += score * eff.costMultiplier;
    }

    // 3. 生成负面效果 (40% 概率，高时代概率略增)
    const drawbacks = [];
    let drawbackChance = 0.4 + (epoch * 0.03);

    // 如果正面效果特别多 (3个以上)，负面效果概率显著增加，可能出现"高风险高回报"
    if (effectCount >= 3) drawbackChance += 0.3;

    // 尝试生成第一个负面效果
    if (Math.random() < drawbackChance) {
        drawbacks.push(generateEffect(true, sourceStratum, epoch));
    }

    // [Update] 额外负面效果：每多一个正面效果 (超过3个)，就有一定概率增加一个相关负面效果
    // 让风险随收益增长，理论上5个正面效果可能伴随3个负面效果
    if (drawbacks.length > 0 && effectCount > 3) {
        const extraDrawbackChance = 0.65; // 提高至 65% 概率追加
        let potentialExtras = effectCount - 3; // 4个正面->1次追加机会, 5个->2次

        for (let i = 0; i < potentialExtras; i++) {
            if (Math.random() < extraDrawbackChance) {
                drawbacks.push(generateEffect(true, sourceStratum, epoch));
            }
        }
    }

    // 计算负面效果对成本分的抵消
    drawbacks.forEach(drawback => {
        let score = Math.abs(drawback.value);
        if (drawback.type === 'approval') score = score / 20;
        else if (drawback.type === 'needsReduction') score = Math.abs(drawback.value); // needsReduction 负值是坏事

        totalCostScore -= score * 0.5; // 负面效果抵消部分成本
    });

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
    drawbacks.forEach(mergeIntoEffects);

    // 5. 计算俸禄
    // 目标范围: 15 ~ 2500 银/日 (官员效果降低后，薪资也相应降低)
    // 基础薪资: 15 + 效果得分 * 150 (降低基础系数约50%)
    // 时代加成: (0.5 + epoch * 0.2) - 青铜时代约0.7x，工业时代约1.7x
    // 效果得分范围约 0.1 - 1.5，对应薪资约 30 - 250 基础
    const epochMultiplier = 0.5 + epoch * 0.2;
    const baseSalary = 15 + Math.max(0.1, totalCostScore) * 150;
    let salary = Math.round(baseSalary * epochMultiplier);
    // 确保在 15 ~ 2500 范围内
    salary = Math.max(15, Math.min(2500, salary));

    // 生成ID
    const id = `off_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;

    // 6. 计算出身阶层影响力加成
    // 公式: 基础值(5-10%) + 薪水因子
    // 调整：降低薪水因子的权重，避免轻易达到上限
    // 假设薪水范围 50 - 2500+
    // 薪水 200 -> 0.008 (0.8%)
    // 薪水 1000 -> 0.04 (4%)
    // 薪水 2500 -> 0.10 (10%)
    const baseInfluenceBonus = 0.03 + Math.random() * 0.05; // 3-8% 基础
    const salaryInfluenceBonus = (salary / 1250) * 0.05; // 每 1250 薪水 +5%
    const stratumInfluenceBonus = Math.min(0.25, baseInfluenceBonus + salaryInfluenceBonus); // 最高25%

    // 7. 分配政治立场（包含动态生成的条件，基于当前市场数据）
    const stanceResult = assignPoliticalStance(sourceStratum, epoch, market);

    return {
        id,
        name,
        sourceStratum,
        effects,
        rawEffects,
        salary,
        hireDate: null,
        wealth: 0, // 官员个人财富，初始为0
        influence: 5 + (salary / 10),
        stratumInfluenceBonus,
        // 政治立场信息
        politicalStance: stanceResult.stanceId,
        stanceConditionParams: stanceResult.conditionParams, // 条件参数数组
        stanceConditionText: stanceResult.conditionText, // 条件文本显示
        stanceActiveEffects: stanceResult.activeEffects, // 该官员独特的满足效果
        stanceUnsatisfiedPenalty: stanceResult.unsatisfiedPenalty, // 该官员独特的不满足惩罚
    };
};

/**
 * 重新计算官员俸禄 (用于存档兼容或调整)
 */
export const calculateOfficialSalary = (official, epoch) => {
    return official.salary; // 暂直接返回，如需动态重算可在此实现
};
