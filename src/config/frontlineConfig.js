/**
 * 战线地图系统配置
 * 定义战线地图的生成规则、规模配置、地形类型等
 */

/**
 * 战线规模配置
 * 根据交战双方的综合实力动态确定战线规模
 */
export const FRONTLINE_SCALE_CONFIG = {
    tiny: {
        name: '边境冲突',
        width: 6,
        height: 4,
        playerBuildings: 2,
        enemyBuildings: 2,
        maxCorps: 2,
        minPower: 0,
        maxPower: 5000,
        description: '小规模边境摩擦，快速决胜'
    },
    small: {
        name: '小型战役',
        width: 8,
        height: 6,
        playerBuildings: 4,
        enemyBuildings: 4,
        maxCorps: 3,
        minPower: 5000,
        maxPower: 15000,
        description: '有限战争目标，争夺边境资源'
    },
    medium: {
        name: '标准战争',
        width: 12,
        height: 8,
        playerBuildings: 7,
        enemyBuildings: 7,
        maxCorps: 5,
        minPower: 15000,
        maxPower: 40000,
        description: '常规战争规模，攻防兼备'
    },
    large: {
        name: '大规模战争',
        width: 16,
        height: 10,
        playerBuildings: 12,
        enemyBuildings: 12,
        maxCorps: 8,
        minPower: 40000,
        maxPower: 100000,
        description: '全面战争，需要战略规划'
    },
    epic: {
        name: '史诗级战役',
        width: 20,
        height: 12,
        playerBuildings: 18,
        enemyBuildings: 18,
        maxCorps: 12,
        minPower: 100000,
        maxPower: Infinity,
        description: '决定国运的大决战'
    }
};

/**
 * 地形类型定义
 */
export const TERRAIN_TYPES = {
    plain: {
        id: 'plain',
        name: '平原',
        icon: '🌾',
        color: '#90EE90',
        movementCost: 1.0,
        defenseBonus: 0,
        description: '开阔平坦的土地，便于行军'
    },
    forest: {
        id: 'forest',
        name: '森林',
        icon: '🌲',
        color: '#228B22',
        movementCost: 1.67,  // 0.6x speed
        defenseBonus: 0.20,
        description: '茂密的森林，提供掩护但行军困难'
    },
    mountain: {
        id: 'mountain',
        name: '山地',
        icon: '⛰️',
        color: '#8B4513',
        movementCost: 2.5,  // 0.4x speed
        defenseBonus: 0.40,
        description: '崎岖山地，易守难攻'
    },
    river: {
        id: 'river',
        name: '河流',
        icon: '🌊',
        color: '#4169E1',
        movementCost: 3.33,  // 0.3x speed
        defenseBonus: -0.20,
        description: '河流障碍，渡河时容易遭受攻击'
    },
    road: {
        id: 'road',
        name: '道路',
        icon: '🛤️',
        color: '#DEB887',
        movementCost: 0.67,  // 1.5x speed
        defenseBonus: -0.10,
        description: '铺设的道路，快速行军但缺少掩护'
    },
    marsh: {
        id: 'marsh',
        name: '沼泽',
        icon: '🏞️',
        color: '#6B8E23',
        movementCost: 3.0,
        defenseBonus: -0.10,
        description: '泥泞的沼泽地，行军极其困难'
    }
};

/**
 * 战线建筑类型定义
 */
export const FRONTLINE_BUILDING_TYPES = {
    farm: {
        id: 'farm',
        name: '农田',
        icon: '🌾',
        baseHealth: 80,
        defenseValue: 5,
        resourceValue: { food: 300 },
        destroyPenalty: { productionModifier: -0.10 },
        priority: 1
    },
    mine: {
        id: 'mine',
        name: '矿场',
        icon: '⛏️',
        baseHealth: 120,
        defenseValue: 10,
        resourceValue: { iron: 150, copper: 100 },
        destroyPenalty: { productionModifier: -0.10 },
        priority: 2
    },
    workshop: {
        id: 'workshop',
        name: '工坊',
        icon: '🔨',
        baseHealth: 100,
        defenseValue: 8,
        resourceValue: { tools: 80 },
        destroyPenalty: { productionModifier: -0.05 },
        priority: 3
    },
    market: {
        id: 'market',
        name: '市场',
        icon: '🏪',
        baseHealth: 100,
        defenseValue: 5,
        resourceValue: { silver: 500 },
        destroyPenalty: { incomeModifier: -0.10 },
        priority: 4
    },
    barracks: {
        id: 'barracks',
        name: '军营',
        icon: '🏰',
        baseHealth: 150,
        defenseValue: 20,
        resourceValue: { weapons: 50 },
        destroyPenalty: { militaryCapacity: -0.05 },
        priority: 5
    },
    housing: {
        id: 'housing',
        name: '居民区',
        icon: '🏠',
        baseHealth: 80,
        defenseValue: 3,
        resourceValue: { food: 100, cloth: 50 },
        destroyPenalty: { populationModifier: -0.02 },
        priority: 6
    },
    fortress: {
        id: 'fortress',
        name: '要塞',
        icon: '🏯',
        baseHealth: 300,
        defenseValue: 50,
        resourceValue: { weapons: 100, firearms: 50 },
        destroyPenalty: { stabilityModifier: -0.10 },
        priority: 7
    },
    town_center: {
        id: 'town_center',
        name: '城镇中心',
        icon: '🏛️',
        baseHealth: 500,
        defenseValue: 30,
        resourceValue: { silver: 1000, food: 500 },
        destroyPenalty: { stabilityModifier: -0.15, productionModifier: -0.10 },
        priority: 8
    }
};

/**
 * 兵团状态定义
 */
export const CORPS_STATES = {
    idle: {
        id: 'idle',
        name: '待命',
        icon: '⏸️',
        description: '兵团原地待命，可随时接受命令'
    },
    moving: {
        id: 'moving',
        name: '行军',
        icon: '🚶',
        description: '兵团正在向目标位置移动'
    },
    attacking: {
        id: 'attacking',
        name: '进攻',
        icon: '⚔️',
        description: '兵团正在攻击敌方目标'
    },
    defending: {
        id: 'defending',
        name: '防守',
        icon: '🛡️',
        defenseBonus: 0.25,
        description: '兵团原地驻守，获得防御加成'
    },
    retreating: {
        id: 'retreating',
        name: '撤退',
        icon: '🏃',
        description: '兵团正在撤退到安全位置'
    },
    routing: {
        id: 'routing',
        name: '溃败',
        icon: '💀',
        description: '兵团士气崩溃，正在溃逃'
    }
};

/**
 * 战争分数配置
 */
export const WAR_SCORE_CONFIG = {
    // 战斗相关
    battleVictory: {
        base: 10,
        perCasualty: 0.5,  // 每消灭一个敌方单位
        maxPerBattle: 40
    },
    battleDefeat: {
        base: -5,
        perCasualty: -0.3,  // 每损失一个己方单位
        minPerBattle: -30
    },

    // 建筑相关
    buildingDestroyed: {
        farm: 8,
        mine: 12,
        workshop: 10,
        market: 15,
        barracks: 18,
        housing: 6,
        fortress: 25,
        town_center: 35
    },
    buildingLost: {
        farm: -5,
        mine: -8,
        workshop: -7,
        market: -10,
        barracks: -12,
        housing: -4,
        fortress: -20,
        town_center: -30
    },

    // 区域控制
    areaControl: {
        majorityControl: 15,  // 控制超过50%地图
        fullControl: 30       // 控制超过80%地图
    },

    // 战争结束条件
    endConditions: {
        decisiveVictory: 100,
        majorVictory: 75,
        minorVictory: 50,
        stalemate: 0,
        minorDefeat: -50,
        majorDefeat: -75,
        decisiveDefeat: -100
    }
};

/**
 * 战争疲劳配置
 */
export const WAR_EXHAUSTION_CONFIG = {
    // 每日基础增长
    dailyBase: 0.1,

    // 战损导致的疲劳增长
    casualtyFatigue: 0.005,  // 每损失1单位

    // 建筑损失导致的疲劳
    buildingFatigue: {
        farm: 0.5,
        mine: 0.8,
        workshop: 0.6,
        market: 1.0,
        barracks: 1.2,
        housing: 0.4,
        fortress: 2.0,
        town_center: 3.0
    },

    // 疲劳效果
    effects: {
        10: { stabilityPenalty: -0.02 },
        25: { stabilityPenalty: -0.05, moralePenalty: -0.05 },
        50: { stabilityPenalty: -0.10, moralePenalty: -0.10, productionPenalty: -0.05 },
        75: { stabilityPenalty: -0.15, moralePenalty: -0.20, productionPenalty: -0.10 },
        100: { forcePeace: true }  // 强制和平
    }
};

/**
 * 根据交战双方实力计算战线规模
 * @param {Object} player - 玩家状态
 * @param {Object} enemy - 敌方AI国家
 * @returns {Object} 战线规模配置
 */
export function calculateFrontlineScale(player, enemy) {
    const playerPower = calculateNationPower(player);
    const enemyPower = calculateNationPower(enemy);
    const combinedPower = playerPower + enemyPower;

    // 根据综合实力确定规模
    for (const [scaleId, config] of Object.entries(FRONTLINE_SCALE_CONFIG)) {
        if (combinedPower >= config.minPower && combinedPower < config.maxPower) {
            return { scaleId, ...config, playerPower, enemyPower, combinedPower };
        }
    }

    // 默认返回史诗级
    return { scaleId: 'epic', ...FRONTLINE_SCALE_CONFIG.epic, playerPower, enemyPower, combinedPower };
}

/**
 * 计算国家综合实力
 * @param {Object} nation - 国家对象
 * @returns {number} 综合实力值
 */
export function calculateNationPower(nation) {
    if (!nation) return 0;

    const militaryPower = (nation.armySize || nation.army?.total || 0) * 10;
    const economicPower = (nation.wealth || 0) * 0.5;
    const populationPower = (nation.population || 0) * 2;

    return Math.floor(militaryPower + economicPower + populationPower);
}

/**
 * 生成地形网格
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @returns {Array<Array<string>>} 地形ID的二维数组
 */
export function generateTerrainGrid(width, height) {
    const grid = [];

    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push(generateTerrainCell(x, y, width, height));
        }
        grid.push(row);
    }

    // 添加道路连接两侧
    addRoadNetwork(grid, width, height);

    return grid;
}

/**
 * 生成单个地形格子
 */
function generateTerrainCell(x, y, width, height) {
    const random = Math.random();

    // 边缘更可能是山地
    const edgeDistance = Math.min(y, height - 1 - y);
    const edgeFactor = edgeDistance < 2 ? 0.15 : 0;

    // 中部更可能有河流
    const centerY = Math.abs(y - height / 2) < 2;
    const riverFactor = centerY ? 0.1 : 0;

    if (random < 0.55) return 'plain';
    if (random < 0.70) return 'forest';
    if (random < 0.80 + edgeFactor) return 'mountain';
    if (random < 0.90 + riverFactor) return 'river';
    if (random < 0.95) return 'marsh';
    return 'plain';
}

/**
 * 添加道路网络
 */
function addRoadNetwork(grid, width, height) {
    // 水平主干道
    const mainRoadY = Math.floor(height / 2);
    for (let x = 0; x < width; x++) {
        if (grid[mainRoadY][x] === 'plain') {
            grid[mainRoadY][x] = 'road';
        }
    }

    // 垂直支路
    const leftRoadX = Math.floor(width * 0.25);
    const rightRoadX = Math.floor(width * 0.75);

    for (let y = 0; y < height; y++) {
        if (grid[y][leftRoadX] === 'plain') {
            grid[y][leftRoadX] = 'road';
        }
        if (grid[y][rightRoadX] === 'plain') {
            grid[y][rightRoadX] = 'road';
        }
    }
}

/**
 * 建筑优先级排序（战争中更有价值的建筑优先）
 */
export const BUILDING_SELECTION_PRIORITY = [
    'farm', 'large_estate',        // 粮食生产
    'mine', 'coal_mine',           // 矿产资源
    'weapon_workshop', 'arsenal',  // 军工生产
    'market', 'trade_port',        // 经济中心
    'sawmill', 'loom_house',       // 基础工业
    'barracks', 'fortress',        // 军事设施
];

/**
 * 将玩家建筑映射到战线建筑类型
 */
export const PLAYER_BUILDING_TO_FRONTLINE = {
    'farm': 'farm',
    'large_estate': 'farm',
    'mine': 'mine',
    'copper_mine': 'mine',
    'coal_mine': 'mine',
    'quarry': 'mine',
    'sawmill': 'workshop',
    'iron_tool_workshop': 'workshop',
    'bronze_foundry': 'workshop',
    'weapon_workshop': 'barracks',
    'arsenal': 'barracks',
    'market': 'market',
    'trade_port': 'market',
    'barracks': 'barracks',
    'fortress': 'fortress',
    'training_ground': 'barracks',
    'hut': 'housing',
    'house': 'housing',
    'town_hall': 'town_center',
};
