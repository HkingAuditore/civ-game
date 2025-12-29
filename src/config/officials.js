/**
 * 官员系统配置
 * 定义官员效果、姓名库及生成逻辑
 */

import { STRATA } from './strata';

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
        valueRange: [0.05, 0.25], // +5% ~ +25%
        weight: 25,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 产出 +${(val * 100).toFixed(0)}%`,
    },

    // 类别产出加成
    category_boost: {
        type: 'categories',
        category: 'production',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [0.05, 0.18],
        weight: 20,
        costMultiplier: 1.2,
        description: (val, target) => `${target}类建筑产出 +${(val * 100).toFixed(0)}%`,
    },

    // 战时产出加成 (新增)
    wartime_production: {
        type: 'wartimeProduction',
        category: 'production',
        valueRange: [0.10, 0.30],
        weight: 12,
        costMultiplier: 1.3,
        description: (val) => `战时产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 经济类效果 ============
    // 贸易利润加成 (新增)
    trade_bonus: {
        type: 'tradeBonus',
        category: 'economy',
        valueRange: [0.08, 0.25],
        weight: 15,
        costMultiplier: 1.4,
        description: (val) => `贸易利润 +${(val * 100).toFixed(0)}%`,
    },

    // 税收效率加成 (新增)
    tax_efficiency: {
        type: 'taxEfficiency',
        category: 'economy',
        valueRange: [0.05, 0.15],
        weight: 15,
        costMultiplier: 1.5,
        description: (val) => `税收效率 +${(val * 100).toFixed(0)}%`,
    },

    // 建筑成本降低 (新增)
    building_cost_reduction: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [-0.20, -0.08],
        weight: 12,
        costMultiplier: 1.2,
        description: (val) => `建筑成本 ${(val * 100).toFixed(0)}%`,
    },

    // 财政收入比例
    income_percent: {
        type: 'incomePercent',
        category: 'economy',
        valueRange: [0.04, 0.12],
        weight: 12,
        costMultiplier: 1.5,
        description: (val) => `财政收入 +${(val * 100).toFixed(0)}%`,
    },

    // 固定被动产出
    passive_gain: {
        type: 'passive',
        category: 'economy',
        targets: ['food', 'silver', 'culture', 'science'],
        valueRange: [0.5, 3.0],
        weight: 10,
        costMultiplier: 1.5,
        description: (val, target) => `每日 ${target} +${val.toFixed(1)}`,
    },

    // 百分比被动加成
    passive_percent: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [0.03, 0.10],
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
        valueRange: [-0.20, -0.05],
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
        valueRange: [-0.15, -0.05],
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
        valueRange: [0.05, 0.15],
        weight: 12,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 供给 +${(val * 100).toFixed(0)}%`,
    },

    // 需求减少
    needs_reduction: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [0.05, 0.15],
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `全民需求 -${(val * 100).toFixed(0)}%`,
    },

    // ============ 人口/发展类效果 ============
    // 人口上限
    max_pop: {
        type: 'maxPop',
        category: 'population',
        valueRange: [0.03, 0.10],
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `人口上限 +${(val * 100).toFixed(0)}%`,
    },

    // 人口增长加成 (新增)
    population_growth: {
        type: 'populationGrowth',
        category: 'population',
        valueRange: [0.05, 0.20],
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `人口增长 +${(val * 100).toFixed(0)}%`,
    },

    // 科研速度加成 (新增)
    research_speed: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [0.08, 0.25],
        weight: 12,
        costMultiplier: 1.4,
        description: (val) => `科研速度 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 政治类效果 ============
    // 阶层满意度
    approval_boost: {
        type: 'approval',
        category: 'politics',
        targets: Object.keys(STRATA),
        valueRange: [5, 15],
        weight: 15,
        costMultiplier: 0.8,
        description: (val, target) => `${target} 满意度 +${val}`,
    },

    // 联盟阶层满意度 (新增)
    coalition_approval: {
        type: 'coalitionApproval',
        category: 'politics',
        valueRange: [3, 10],
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `联盟阶层满意度 +${val}`,
    },

    // 合法性加成 (新增)
    legitimacy_bonus: {
        type: 'legitimacyBonus',
        category: 'politics',
        valueRange: [0.03, 0.10],
        weight: 10,
        costMultiplier: 1.2,
        description: (val) => `合法性 +${(val * 100).toFixed(0)}%`,
    },

    // 组织度衰减 (新增，负值=好)
    organization_decay: {
        type: 'organizationDecay',
        category: 'politics',
        valueRange: [-0.20, -0.08],
        weight: 8,
        costMultiplier: 1.1,
        description: (val) => `组织度增长 ${(val * 100).toFixed(0)}%`,
    },

    // 稳定性
    stability_bonus: {
        type: 'stability',
        category: 'politics',
        valueRange: [0.02, 0.08],
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `稳定性 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 军事类效果 ============
    // 军事力量
    military_bonus: {
        type: 'militaryBonus',
        category: 'military',
        valueRange: [0.05, 0.15],
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `军事力量 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护降低 (新增)
    military_upkeep: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [-0.20, -0.08],
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `军事维护 ${(val * 100).toFixed(0)}%`,
    },

    // ============ 外交类效果 ============
    // 外交关系加成 (新增)
    diplomatic_bonus: {
        type: 'diplomaticBonus',
        category: 'diplomacy',
        valueRange: [0.5, 2.0], // 每日关系改善值
        weight: 8,
        costMultiplier: 1.0,
        description: (val) => `每日外交关系 +${val.toFixed(1)}`,
    },

    // 外交冷却缩短 (新增)
    diplomatic_cooldown: {
        type: 'diplomaticCooldown',
        category: 'diplomacy',
        valueRange: [-0.20, -0.10],
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
        valueRange: [-0.12, -0.04],
        weight: 20,
        description: (val, target) => `${target}类产出 ${(val * 100).toFixed(0)}%`,
    },

    // 被动消耗
    passive_cost: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [-0.08, -0.03],
        weight: 20,
        description: (val, target) => `每日 ${target} ${(val * 100).toFixed(0)}%`,
    },

    // 需求增加
    needs_increase: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [-0.12, -0.04],
        weight: 15,
        description: (val) => `全民需求 +${Math.abs(val * 100).toFixed(0)}%`,
    },

    // 阶层满意度惩罚
    approval_penalty: {
        type: 'approval',
        category: 'politics',
        targets: ['peasant', 'worker', 'merchant', 'artisan', 'landowner', 'serf', 'miner'],
        valueRange: [-15, -5],
        weight: 20,
        description: (val, target) => `${target} 满意度 ${val}`,
    },

    // 腐败 - 税收损失 (新增)
    corruption: {
        type: 'corruption',
        category: 'economy',
        valueRange: [0.05, 0.15],
        weight: 15,
        description: (val) => `腐败：税收损失 ${(val * 100).toFixed(0)}%`,
    },

    // 派系冲突 - 联盟内部稳定性降低 (新增)
    faction_conflict: {
        type: 'factionConflict',
        category: 'politics',
        valueRange: [0.02, 0.08],
        weight: 10,
        description: (val) => `派系冲突：稳定性 -${(val * 100).toFixed(0)}%`,
    },

    // 资源浪费 (新增)
    resource_waste: {
        type: 'resourceWaste',
        category: 'needs',
        targets: ['food', 'wood', 'stone', 'iron'],
        valueRange: [0.05, 0.12],
        weight: 12,
        description: (val, target) => `${target} 消耗 +${(val * 100).toFixed(0)}%`,
    },

    // 外交灾难 - 关系衰减加速 (新增)
    diplomatic_incident: {
        type: 'diplomaticIncident',
        category: 'diplomacy',
        valueRange: [0.3, 1.0], // 每日额外关系衰减
        weight: 8,
        description: (val) => `外交关系衰减 +${val.toFixed(1)}/日`,
    },

    // 建筑成本增加 (新增)
    building_cost_increase: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [0.08, 0.20],
        weight: 12,
        description: (val) => `建筑成本 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护增加 (新增)
    military_upkeep_increase: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [0.08, 0.18],
        weight: 10,
        description: (val) => `军事维护 +${(val * 100).toFixed(0)}%`,
    },

    // 科研减速 (新增)
    research_slowdown: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [-0.15, -0.05],
        weight: 8,
        description: (val) => `科研速度 ${(val * 100).toFixed(0)}%`,
    },
};

// ========== 阶层效果偏好映射 ==========
// 定义每个阶层出身的官员更倾向于生成哪些效果类型
// preferredEffects: 偏好的正面效果key列表 (权重翻倍)
// preferredDrawbacks: 偏好的负面效果key列表 (权重翻倍)
// preferredTargets: 偏好的目标 (建筑/资源/阶层) - 如果效果有targets，优先选择这些
export const STRATUM_EFFECT_PREFERENCES = {
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
        preferredEffects: ['building_boost', 'category_boost', 'building_cost_reduction', 'research_speed'],
        preferredDrawbacks: ['resource_waste', 'passive_cost'],
        preferredTargets: ['factory', 'steel_foundry', 'sawmill', 'brickworks', 'industry'],
    },
    // 工匠：工业产出、资源
    artisan: {
        preferredEffects: ['building_boost', 'resource_supply', 'category_boost', 'stratum_demand'],
        preferredDrawbacks: ['resource_waste', 'category_penalty'],
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
const NAME_STYLES = {
    // ========== 东亚 ==========
    // 中国
    CHINESE: {
        last: ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
            '诸葛', '欧阳', '司马', '上官', '慕容', '独孤', '令狐', '皇甫', '东方', '西门'],
        first: ['世民', '白', '甫', '廷', '信', '斯', '良', '平', '括', '安', '正', '泽', '恩', '博', '文', '武', '明', '华', '强', '勇',
            '孔明', '仲谋', '玄德', '云长', '翼德', '子龙', '孟德', '公瑾', '守仁', '九龄', '安石', '居正', '国藩', '鸿章'],
        format: 'lastFirst'
    },
    // 日本
    JAPANESE: {
        last: ['田中', '山本', '渡辺', '伊藤', '中村', '小林', '加藤', '吉田', '木村', '松本', '織田', '豊臣', '徳川', '武田', '上杉'],
        first: ['太郎', '次郎', '健一', '正人', '秀樹', '信長', '秀吉', '家康', '信玄', '謙信', '政宗', '光秀', '利家', '真田', '義経'],
        format: 'lastFirst'
    },
    // 朝鲜/韩国
    KOREAN: {
        last: ['金', '李', '朴', '崔', '郑', '姜', '赵', '尹', '张', '林', '韩', '申', '吴', '徐', '权'],
        first: ['成桂', '世宗', '舜臣', '正祖', '明成', '仁祖', '光海', '思慕', '俊英', '在民', '相赫', '敏浩', '东旭', '智勋', '贤宇'],
        format: 'lastFirst'
    },

    // ========== 东南亚 ==========
    SOUTHEAST_ASIAN: {
        last: ['阮', '陈', '范', '吴', '黎', '布特拉', '素可泰', '吴哥', '满者', '三佛齐', '马六甲', '暹罗', '占婆', '缅甸', '勃固'],
        first: ['文郎', '德政', '光中', '嘉隆', '明命', '拉玛', '朱拉', '蓬', '他信', '苏哈托', '马科斯', '李光耀', '马哈蒂尔', '昂山', '西哈努克'],
        format: 'lastFirst'
    },

    // ========== 西欧 ==========
    WESTERN_EUROPE: {
        first: ['威廉', '亨利', '理查德', '爱德华', '查尔斯', '乔治', '阿尔弗雷德', '哈罗德', '罗伯特', '路易',
            '弗朗索瓦', '拿破仑', '夏尔', '腓力', '雨果', '伏尔泰', '卢梭', '笛卡尔', '蒙田', '莫里哀',
            '亚当', '约翰·梅纳德', '约翰·洛克', '托马斯·霍布斯', '杰里米', '约翰·斯图亚特', '大卫'],
        last: ['斯图亚特', '都铎', '金雀花', '诺曼底', '威塞克斯', '温莎', '波旁', '瓦卢瓦', '卡佩', '梅罗文',
            '丘吉尔', '克伦威尔', '尼尔森', '惠灵顿', '黎塞留', '马扎然', '戴高乐', '密特朗', '庞皮杜',
            '斯密', '凯恩斯', '洛克', '霍布斯', '边沁', '穆勒', '休谟', '培根', '牛顿', '达尔文', '霍金'],
        format: 'firstLast'
    },

    // ========== 中欧 ==========
    CENTRAL_EUROPE: {
        first: ['腓特烈', '威廉', '奥托', '卡尔', '弗朗茨', '鲁道夫', '马克西米利安', '弗里德里希', '海因里希', '康拉德',
            '约翰', '沃尔夫冈', '约瑟夫', '路德维希', '阿尔伯特', '费迪南', '利奥波德', '西格蒙德', '马蒂亚斯', '查理',
            '弗里德里希', '路德维希·冯', '卡尔·门格尔', '约瑟夫·熊彼特', '西格蒙德·弗洛伊德'],
        last: ['霍亨索伦', '哈布斯堡', '维特尔斯巴赫', '萨克森', '巴伐利亚', '普鲁士', '奥地利', '波西米亚',
            '俾斯麦', '梅特涅', '克劳塞维茨', '歌德', '席勒', '贝多芬', '莫扎特', '巴赫', '黑格尔', '康德', '马克思',
            '哈耶克', '米塞斯', '韦伯', '熊彼特', '尼采', '叔本华', '费希特', '谢林', '胡塞尔', '海德格尔', '维特根斯坦'],
        format: 'firstLast'
    },

    // ========== 北欧 ==========
    NORDIC: {
        first: ['埃里克', '奥拉夫', '哈拉尔', '克努特', '古斯塔夫', '卡尔', '弗雷德里克', '克里斯蒂安', '西格弗雷德', '拉格纳',
            '比约恩', '伊瓦尔', '罗洛', '莱夫', '索尔芬', '斯韦恩', '马格努斯', '瓦尔德马', '英瓦尔', '鲁里克'],
        last: ['维京', '诺曼', '丹麦', '挪威', '瑞典', '冰岛', '芬兰', '戈特兰',
            '铁手', '无骨', '狂战士', '雷神', '远行者', '血斧', '蓝牙', '叉骨', '长船', '战狼', '海狼', '风暴'],
        format: 'firstLast'
    },

    // ========== 东欧 ==========
    EASTERN_EUROPE: {
        first: ['弗拉基米尔', '伊凡', '彼得', '亚历山大', '尼古拉', '德米特里', '米哈伊尔', '鲍里斯', '费奥多尔', '瓦西里',
            '卡西米尔', '雅盖沃', '博莱斯瓦夫', '梅什科', '马蒂亚斯', '弗拉德', '斯特凡', '米洛什', '彼得罗', '波格丹'],
        last: ['罗曼诺夫', '留里克', '莫斯科', '诺夫哥罗德', '基辅', '普斯科夫', '雅盖隆', '皮亚斯特', '哈布斯堡',
            '托尔斯泰', '陀思妥耶夫斯基', '果戈里', '普希金', '柴可夫斯基', '门捷列夫', '巴甫洛夫', '库图佐夫', '苏沃洛夫', '涅夫斯基'],
        format: 'firstLast'
    },

    // ========== 南欧 ==========
    SOUTHERN_EUROPE: {
        first: ['朱利奥', '马可', '安东尼奥', '洛伦佐', '弗朗切斯科', '费尔南多', '阿方索', '胡安', '卡洛斯', '恩里克',
            '达芬奇', '米开朗基罗', '拉斐尔', '但丁', '彼特拉克', '马基雅维利', '伽利略', '塞万提斯', '阿基米德', '毕达哥拉斯'],
        last: ['美第奇', '博尔吉亚', '斯福尔扎', '维斯孔蒂', '贡萨加', '埃斯特', '萨沃伊', '哈布斯堡', '波旁',
            '托雷多', '卡斯蒂利亚', '阿拉贡', '巴塞罗那', '马德里', '佛罗伦萨', '威尼斯', '米兰', '那不勒斯', '热那亚', '罗马'],
        format: 'firstLast'
    },

    // ========== 西亚 ==========
    WEST_ASIAN: {
        first: ['穆罕默德', '艾哈迈德', '阿里', '侯赛因', '奥马尔', '奥斯曼', '苏莱曼', '哈伦', '萨拉丁', '巴耶济德',
            '阿巴斯', '赛勒斯', '大流士', '薛西斯', '居鲁士', '纳迪尔', '阿卜杜勒', '法赫德', '费萨尔', '塔米姆'],
        last: ['拉希德', '沙特', '哈希姆', '奥斯曼', '阿巴斯', '萨法维', '阿契美尼德', '萨珊',
            '麦加', '麦地那', '巴格达', '大马士革', '开罗', '伊斯法罕', '设拉子', '巴士拉', '摩苏尔', '阿勒颇', '耶路撒冷', '贝鲁特'],
        format: 'firstLast'
    },

    // ========== 中亚 ==========
    CENTRAL_ASIAN: {
        first: ['铁木真', '窝阔台', '拔都', '忽必烈', '帖木儿', '巴布尔', '阿克巴', '沙贾汗', '阿提拉', '莫顿',
            '冒顿', '呼韩邪', '郁久闾', '阿史那', '骨力裴罗', '怀仁可汗', '咄苾', '颉利', '默啜', '毗伽'],
        last: ['可汗', '汗', '蒙古', '突厥', '鲜卑', '柔然', '匈奴', '回鹘', '契丹', '女真',
            '成吉思', '大蒙古', '金帐', '察合台', '伊儿', '帖木儿', '莫卧儿', '布哈拉', '撒马尔罕', '塔什干'],
        format: 'firstLast'
    },

    // ========== 南亚 ==========
    SOUTH_ASIAN: {
        first: ['阿育', '旃陀罗笈多', '阿克巴', '沙贾汗', '奥朗则布', '巴布尔', '胡马雍', '贾汗吉尔', '提普', '毗沙耶',
            '甘地', '尼赫鲁', '泰戈尔', '阿难陀', '室利', '达摩', '摩诃', '悉达多', '阿闍世', '频毗娑罗'],
        last: ['孔雀', '笈多', '巴拉', '莫卧儿', '马拉塔', '锡克', '拉杰普特', '查尔隆',
            '德里', '阿格拉', '孟买', '加尔各答', '果阿', '迈索尔', '海得拉巴', '拉合尔', '卡拉奇', '达卡', '科伦坡', '加德满都'],
        format: 'firstLast'
    },

    // ========== 北非 ==========
    NORTH_AFRICAN: {
        first: ['拉美西斯', '图特摩斯', '阿蒙霍特普', '图坦卡蒙', '克利奥帕特拉', '托勒密', '汉尼拔', '马西尼萨', '尤巴', '穆萨',
            '曼萨', '阿卜杜勒', '哈桑', '穆赫塔尔', '卡扎菲', '穆巴拉克', '萨达特', '纳赛尔', '穆罕默德·阿里', '阿勒摩哈德'],
        last: ['法老', '托勒密', '努比亚', '迦太基', '柏柏尔', '马格里布', '阿尔摩哈德', '阿尤布',
            '亚历山大', '开罗', '迦太基', '突尼斯', '阿尔及尔', '摩洛哥', '菲斯', '马拉喀什', '的黎波里', '班加西', '卢克索', '底比斯'],
        format: 'firstLast'
    },

    // ========== 撒哈拉以南非洲 ==========
    SUB_SAHARAN: {
        first: ['曼萨', '桑戈', '恰卡', '塞茨瓦约', '摩谢谢', '孟尼利克', '海尔', '塞拉西', '恩克鲁玛', '桑戈尔',
            '曼德拉', '卢蒙巴', '恩耶雷雷', '肯雅塔', '穆加贝', '博卡萨', '蒙博托', '阿拜', '奥巴桑乔', '乔纳森'],
        last: ['马里', '桑海', '加纳', '贝宁', '刚果', '祖鲁', '阿散蒂', '达荷美', '毛里塔尼亚',
            '廷巴克图', '加奥', '杰内', '大津巴布韦', '姆巴巴内', '阿克拉', '拉各斯', '阿布贾', '内罗毕', '亚的斯亚贝巴', '开普敦'],
        format: 'firstLast'
    },

    // ========== 美洲原住民 ==========
    NATIVE_AMERICAN: {
        first: ['蒙特祖玛', '夸特莫克', '特诺奇', '阿塔瓦尔帕', '曼科', '图帕克', '帕查库提', '波卡洪塔斯', '坐牛', '疯马',
            '杰罗尼莫', '红云', '科奇斯', '特库姆塞', '奥塞奥拉', '黑鹰', '西雅图', '约瑟夫酋长', '夸纳', '秀尼'],
        last: ['阿兹特克', '玛雅', '印加', '阿帕奇', '苏族', '切诺基', '易洛魁', '科曼奇', '纳瓦霍', '肖肖尼',
            '特诺奇提特兰', '库斯科', '马丘比丘', '奇琴伊察', '蒂卡尔', '科潘', '帕伦克', '瓦哈卡', '普韦布洛', '梅萨维德'],
        format: 'firstLast'
    },

    // ========== 大洋洲 ==========
    OCEANIAN: {
        first: ['卡美哈美哈', '利留卡拉尼', '特·拉乌帕拉哈', '洪吉', '塔法', '马拉马', '波马雷', '卡考巴乌', '图伊', '坦加塔',
            '莫科', '蒂帕', '霍尼', '瓦卡', '阿特亚', '塔内', '朗伊', '毛伊', '库库', '蒂基'],
        last: ['夏威夷', '毛利', '汤加', '萨摩亚', '斐济', '塔希提', '复活节岛', '帕劳',
            '阿提亚', '波利尼西亚', '密克罗尼西亚', '美拉尼西亚', '马奥里', '拉皮塔', '奥特亚罗瓦', '库克群岛', '图瓦卢', '基里巴斯', '瓦努阿图', '新喀里多尼亚'],
        format: 'firstLast'
    },

    // ========== 古典/神话风格 ==========
    ANCIENT: {
        first: ['吉尔伽美什', '恩奇都', '萨尔贡', '汉谟拉比', '尼布甲尼撒', '居鲁士', '大流士', '列奥尼达', '伯里克利',
            '亚历山大', '阿伽门农', '奥德修斯', '阿喀琉斯', '赫克托尔', '埃涅阿斯', '罗慕路斯', '凯撒', '屋大维', '图拉真', '马可·奥勒留'],
        last: ['苏美尔', '阿卡德', '巴比伦', '亚述', '波斯', '斯巴达', '雅典', '马其顿', '罗马', '迦太基',
            '特洛伊', '迈锡尼', '克里特', '腓尼基', '以色列', '犹大', '埃及', '努比亚', '库什', '阿克苏姆'],
        format: 'firstLast'
    },
};

// 文化风格列表（用于随机选择）
const CULTURE_STYLES = Object.keys(NAME_STYLES);

/**
 * 生成随机名字
 * @param {number} epoch - 当前时代 (影响风格偏好)
 * @returns {string} 全名
 */
export const generateName = (epoch) => {
    // 根据时代调整文化偏好
    let styleKey;
    const rand = Math.random();

    if (epoch <= 2) {
        // 早期时代：古典、亚洲、中东为主
        const earlyStyles = ['ANCIENT', 'CHINESE', 'WEST_ASIAN', 'SOUTH_ASIAN', 'NORTH_AFRICAN', 'CENTRAL_ASIAN'];
        styleKey = earlyStyles[Math.floor(rand * earlyStyles.length)];
    } else if (epoch <= 4) {
        // 中期时代：更广泛的文化
        const midStyles = ['CHINESE', 'JAPANESE', 'KOREAN', 'WESTERN_EUROPE', 'CENTRAL_EUROPE', 'EASTERN_EUROPE',
            'SOUTHERN_EUROPE', 'WEST_ASIAN', 'SOUTH_ASIAN', 'NORTH_AFRICAN', 'SUB_SAHARAN'];
        styleKey = midStyles[Math.floor(rand * midStyles.length)];
    } else {
        // 晚期时代：全球各地
        styleKey = CULTURE_STYLES[Math.floor(rand * CULTURE_STYLES.length)];
    }

    const style = NAME_STYLES[styleKey];
    const first = style.first[Math.floor(Math.random() * style.first.length)];
    const last = style.last[Math.floor(Math.random() * style.last.length)];

    // 根据格式返回名字
    if (style.format === 'lastFirst') {
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
 * @param {boolean} isDrawback - 是否生成负面效果
 * @param {string} sourceStratum - 官员出身阶层（用于偏好加权）
 */
const generateEffect = (isDrawback = false, sourceStratum = null) => {
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

    // 3. 确定数值
    const [min, max] = config.valueRange;
    const rawValue = min + Math.random() * (max - min);
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
 * @returns {Object} 官员对象
 */
export const generateRandomOfficial = (epoch, popStructure = {}, classInfluence = {}) => {
    // 1. 基本信息
    const name = generateName(epoch);

    // 可作为官员出身的阶层列表
    const eligibleStrata = [
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

    // 2. 生成效果 (1-3个正面)
    // 时代越后，更有可能产生多效果官员
    let effectCount = 1;
    const countRand = Math.random();
    if (epoch >= 2 && countRand > 0.6) effectCount = 2;
    if (epoch >= 4 && countRand > 0.85) effectCount = 3;

    const rawEffects = [];
    let totalCostScore = 0;

    for (let i = 0; i < effectCount; i++) {
        const eff = generateEffect(false, sourceStratum);
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
        drawback = generateEffect(true, sourceStratum);
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

    // 6. 计算出身阶层影响力加成
    // 公式: 基础值(5-10%) + 薪水因子(salary/100 * 5%)
    // 低级官员: ~5-10%, 高级官员: ~10-20%
    const baseInfluenceBonus = 0.05 + Math.random() * 0.05; // 5-10%
    const salaryInfluenceBonus = (salary / 100) * 0.05; // 薪水越高加成越多
    const stratumInfluenceBonus = Math.min(0.25, baseInfluenceBonus + salaryInfluenceBonus); // 最高25%

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
        influence: 0.5 + (salary / 50), // 官员个人影响力与身价挂钩
        stratumInfluenceBonus, // 新增：对出身阶层的影响力加成 (百分比)
    };
};

/**
 * 重新计算官员俸禄 (用于存档兼容或调整)
 */
export const calculateOfficialSalary = (official, epoch) => {
    return official.salary; // 暂直接返回，如需动态重算可在此实现
};
