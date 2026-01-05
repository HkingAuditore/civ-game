/**
 * 建筑链配置
 * 定义产出相同资源的建筑升级链，用于UI合并显示
 * 
 * 原则：
 * 1. 同链建筑产出相同类型的主要资源
 * 2. 后续建筑的人均产出应高于前序建筑（构成升级关系）
 * 3. 附属产出建筑（如咖啡馆产科研）不纳入主链
 */

export const BUILDING_CHAINS = {
    // ========== 采集与农业 ==========

    // 食物生产链：农田 → 庄园 → 机械化农场
    food_production: {
        name: '食物生产',
        icon: 'Wheat',
        primaryOutput: 'food',
        buildings: ['farm', 'large_estate', 'mechanized_farm'],
    },

    // 木材采集链：伐木场 → 硬木林场 → 伐木公司
    wood_gathering: {
        name: '木材采集',
        icon: 'Trees',
        primaryOutput: 'wood',
        buildings: ['lumber_camp', 'hardwood_camp', 'logging_company'],
    },

    // 石材采集链：采石场 → 采石工场
    stone_gathering: {
        name: '石材采集',
        icon: 'Pickaxe',
        primaryOutput: 'stone',
        buildings: ['quarry', 'stone_workshop'],
    },

    // 铜矿开采链：铜矿井 → 竖井矿场（同时产铜铁）
    copper_mining: {
        name: '铜矿开采',
        icon: 'Gem',
        primaryOutput: 'copper',
        buildings: ['copper_mine', 'shaft_mine'],
    },

    // 铁矿开采链：铁矿井 → 工业矿场
    iron_mining: {
        name: '铁矿开采',
        icon: 'Mountain',
        primaryOutput: 'iron',
        buildings: ['mine', 'industrial_mine'],
    },

    // 煤矿开采：煤矿（单独，无前置）
    // coal_mining: 不构成链，单独显示

    // ========== 工业生产 ==========

    // 工具制造链：石器作坊 → 青铜铸坊 → 铁器铺 → 冶金工坊 → 工厂
    tools_production: {
        name: '工具制造',
        icon: 'Hammer',
        primaryOutput: 'tools',
        buildings: ['stone_tool_workshop', 'bronze_foundry', 'iron_tool_workshop', 'metallurgy_workshop', 'factory'],
    },

    // 木板加工链：锯木厂 → 木材加工厂
    plank_production: {
        name: '木板加工',
        icon: 'Axe',
        primaryOutput: 'plank',
        buildings: ['sawmill', 'lumber_mill'],
    },

    // 砖块生产链：砖窯 → 建材厂 → 预制构件厂
    brick_production: {
        name: '砖块生产',
        icon: 'Building2',
        primaryOutput: 'brick',
        buildings: ['brickworks', 'building_materials_plant', 'prefab_factory'],
    },

    // 钢铁生产链：炼钢厂 → 钢铁联合体
    steel_production: {
        name: '钢铁冶炼',
        icon: 'Cog',
        primaryOutput: 'steel',
        buildings: ['steel_foundry', 'steel_works'],
    },

    // 布料生产链：织布坊 → 纺织工场 → 纺织厂
    cloth_production: {
        name: '布料纺织',
        icon: 'Shirt',
        primaryOutput: 'cloth',
        buildings: ['loom_house', 'wool_workshop', 'textile_mill'],
    },

    // 华服生产链：成衣作坊 → 印染工坊 → 服装工厂
    fine_clothes_production: {
        name: '华服制作',
        icon: 'Package',
        primaryOutput: 'fine_clothes',
        buildings: ['tailor_workshop', 'dye_workshop', 'garment_factory'],
    },

    // 染料生产链：染坊（单独，印染工坊主产华服）
    dye_production: {
        name: '染料生产',
        icon: 'Paintbrush',
        primaryOutput: 'dye',
        buildings: ['dye_works'],
    },

    // 酒类生产链：酿造坊 → 修道院酒窖 → 蒸馏酒厂
    ale_production: {
        name: '酿酒',
        icon: 'Wine',
        primaryOutput: 'ale',
        buildings: ['brewery', 'monastery_cellar', 'distillery'],
    },

    // 珍馐生产链：烹饪坊 → 罐头厂
    delicacies_production: {
        name: '珍馐制作',
        icon: 'UtensilsCrossed',
        primaryOutput: 'delicacies',
        buildings: ['culinary_kitchen', 'cannery'],
    },

    // 家具生产链：家具工坊 → 家具工厂
    furniture_production: {
        name: '家具制造',
        icon: 'Armchair',
        primaryOutput: 'furniture',
        buildings: ['furniture_workshop', 'furniture_factory'],
    },

    // 纸张生产链：造纸工坊 → 造纸厂
    papyrus_production: {
        name: '造纸',
        icon: 'ScrollText',
        primaryOutput: 'papyrus',
        buildings: ['reed_works', 'paper_mill'],
    },

    // ========== 科研与文化 ==========

    // 科研生产链：图书馆 → 印刷所 → 大学 → 出版社
    // 注意：咖啡馆、航海学院等产科研但主要功能不同，不纳入
    science_production: {
        name: '科研机构',
        icon: 'Landmark',
        primaryOutput: 'science',
        buildings: ['library', 'printing_house', 'university', 'publishing_house'],
    },

    // 文化生产链：剧场 → 教堂 → 歌剧院
    culture_production: {
        name: '文化建筑',
        icon: 'Music2',
        primaryOutput: 'culture',
        buildings: ['amphitheater', 'church', 'opera_house'],
    },

    // ========== 贸易与商业 ==========

    // 贸易链：贸易站 → 市场 → 贸易港
    trade_chain: {
        name: '商业贸易',
        icon: 'Handshake',
        primaryOutput: 'silver',
        buildings: ['trading_post', 'market', 'trade_port'],
    },

    // 航海链：船坞 → 航海学院（航海相关）
    navigation_chain: {
        name: '航海事业',
        icon: 'Anchor',
        primaryOutput: 'spice',
        buildings: ['dockyard', 'navigator_school'],
    },

    // ========== 军事建筑 ==========

    // 军事容量链：兵营 → 训练场 → 要塞
    military_capacity: {
        name: '军事设施',
        icon: 'Shield',
        primaryOutput: 'militaryCapacity',
        buildings: ['barracks', 'training_ground', 'fortress'],
    },

    // ========== 居住建筑 ==========

    // 住房链：简陋小屋 → 粮仓 → 木屋 → 石砌宅邸 → 联排住宅 → 阁楼公馆 → 公寓楼
    housing_chain: {
        name: '住房建筑',
        icon: 'Home',
        primaryOutput: 'maxPop',
        buildings: ['hut', 'granary', 'house', 'manor_house', 'townhouse', 'civic_apartment', 'apartment_block'],
    },

    // ========== 行政建筑 ==========

    // 行政链：官署 → 市政厅
    administration_chain: {
        name: '行政机构',
        icon: 'Scale',
        primaryOutput: null, // 提供官员岗位
        buildings: ['magistrate_office', 'town_hall'],
    },
};

/**
 * 反向索引：buildingId -> chainId
 * 用于快速查找建筑所属的链
 */
export const BUILDING_TO_CHAIN = {};
for (const [chainId, chain] of Object.entries(BUILDING_CHAINS)) {
    for (const buildingId of chain.buildings) {
        BUILDING_TO_CHAIN[buildingId] = chainId;
    }
}

/**
 * 获取建筑所属的链配置
 * @param {string} buildingId - 建筑ID
 * @returns {Object|null} 链配置对象，如果不属于任何链则返回 null
 */
export const getBuildingChain = (buildingId) => {
    const chainId = BUILDING_TO_CHAIN[buildingId];
    if (!chainId) return null;
    return { id: chainId, ...BUILDING_CHAINS[chainId] };
};

/**
 * 检查建筑是否为某链中的最高级（已解锁）建筑
 * @param {string} buildingId - 建筑ID
 * @param {Array<string>} unlockedBuildingIds - 已解锁的建筑ID列表
 * @returns {boolean}
 */
export const isTopOfChain = (buildingId, unlockedBuildingIds) => {
    const chainId = BUILDING_TO_CHAIN[buildingId];
    if (!chainId) return true; // 不属于链的建筑总是显示

    const chain = BUILDING_CHAINS[chainId];
    const unlockedInChain = chain.buildings.filter(id => unlockedBuildingIds.includes(id));

    // 如果是链中已解锁的最后一个建筑，则为顶级
    return unlockedInChain[unlockedInChain.length - 1] === buildingId;
};
