// 军事单位配置文件

import { RESOURCES } from './gameConstants';
import { WAR_ECONOMY } from './gameConstants';

/**
 * 兵种克制关系说明:
 * - 步兵(infantry) 克制 骑兵(cavalry) - 长矛阵/刺刀阵克制骑兵冲锋
 * - 骑兵(cavalry) 克制 弓箭手(archer) - 快速机动追杀远程单位
 * - 弓箭手(archer) 克制 步兵(infantry) - 远程火力压制步兵
 * - 火器(gunpowder) 克制 步兵(infantry)和骑兵(cavalry) - 火力优势
 * - 骑兵(cavalry) 近战克制 火器(gunpowder) - 近身后火器无法发挥优势
 * - 攻城(siege) 被所有近战克制 - 机动性差，容易被突袭
 * 
 * 时代淘汰机制:
 * - 每个兵种有 obsoleteAfterEpochs 属性
 * - 当玩家时代超过兵种时代 + obsoleteAfterEpochs 时，该兵种不再显示
 */

// 兵种类型定义
export const UNIT_TYPES = {
    // ============ 石器时代 (Epoch 0) ============
    militia: {
        id: 'militia',
        name: '民兵',
        desc: '由农民临时组成的武装力量，战斗力较弱但成本低廉。',
        epoch: 0,
        icon: 'Users',
        category: 'infantry',

        attack: 6,
        defense: 4,
        speed: 3,
        range: 1,

        recruitCost: { food: 125, wood: 60 },
        maintenanceCost: { food: 1.75, silver: 0.6 },
        trainingTime: 2,

        populationCost: 1,

        abilities: ['快速征召'],

        counters: { cavalry: 1.2, siege: 1.3 },
        weakAgainst: ['archer'],

        obsoleteAfterEpochs: 2
    },

    slinger: {
        id: 'slinger',
        name: '投石兵',
        desc: '使用投石索的远程单位，对轻甲单位有效。',
        epoch: 0,
        icon: 'Circle',
        category: 'archer',

        attack: 6,
        defense: 2,
        speed: 3,
        range: 3,

        recruitCost: { food: 150, wood: 75, stone: 25 },
        maintenanceCost: { food: 2, silver: 0.75, stone: 0.5 },
        trainingTime: 3,

        populationCost: 1,

        abilities: ['远程攻击'],

        counters: { infantry: 1.4 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    // ============ 青铜时代 (Epoch 1) ============
    spearman: {
        id: 'spearman',
        name: '长矛兵',
        desc: '装备青铜长矛的步兵，对骑兵有显著克制效果。',
        epoch: 1,
        icon: 'Sword',
        category: 'infantry',

        attack: 12,
        defense: 9,
        speed: 3,
        range: 1,

        recruitCost: { food: 275, wood: 175, copper: 60 },
        maintenanceCost: { food: 2.75, silver: 1.75, copper: 0.25 },
        trainingTime: 4,

        populationCost: 1,

        abilities: ['反骑兵'],

        counters: { cavalry: 1.8, siege: 1.2 },
        weakAgainst: ['archer'],

        obsoleteAfterEpochs: 2
    },

    archer: {
        id: 'archer',
        name: '弓箭手',
        desc: '装备复合弓的远程单位，克制步兵。',
        epoch: 1,
        icon: 'Target',
        category: 'archer',

        attack: 14,
        defense: 6,
        speed: 4,
        range: 4,

        recruitCost: { food: 325, wood: 225, silver: 125 },
        maintenanceCost: { food: 3.25, silver: 2.25, wood: 1 },
        trainingTime: 5,

        populationCost: 1,

        abilities: ['远程攻击', '高机动'],

        counters: { infantry: 1.5, siege: 1.4 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    chariot: {
        id: 'chariot',
        name: '战车',
        desc: '青铜时代的机动战力，由马匹牵引的战车。',
        epoch: 1,
        icon: 'Truck',
        category: 'cavalry',

        attack: 15,
        defense: 8,
        speed: 6,
        range: 1,

        recruitCost: { food: 500, wood: 300, copper: 150, silver: 200 },
        maintenanceCost: { food: 6, silver: 3.5, wood: 1.5 },
        trainingTime: 6,

        populationCost: 1,

        abilities: ['冲锋', '机动'],

        counters: { archer: 1.6 },
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 2
    },

    // ============ 古典时代 (Epoch 2) ============
    hoplite: {
        id: 'hoplite',
        name: '重装步兵',
        desc: '装备圆盾和长矛的古典精锐步兵，方阵作战威力强大。',
        epoch: 2,
        icon: 'Shield',
        category: 'infantry',

        attack: 16,
        defense: 14,
        speed: 2,
        range: 1,

        recruitCost: { food: 500, copper: 200, iron: 100, swords: 8, silver: 250 },
        maintenanceCost: { food: 3.75, silver: 2.75, iron: 0.4 },
        trainingTime: 6,

        populationCost: 1,

        abilities: ['方阵', '坚守'],

        counters: { cavalry: 1.7, siege: 1.3 },
        weakAgainst: ['archer'],

        obsoleteAfterEpochs: 2
    },

    composite_archer: {
        id: 'composite_archer',
        name: '复合弓手',
        desc: '使用复合弓的精锐射手，穿透力更强。',
        epoch: 2,
        icon: 'Target',
        category: 'archer',

        attack: 18,
        defense: 7,
        speed: 4,
        range: 5,

        recruitCost: { food: 425, wood: 250, copper: 125, swords: 5, silver: 225 },
        maintenanceCost: { food: 3.5, silver: 2.5, wood: 1.25, copper: 0.25 },
        trainingTime: 6,

        populationCost: 1,

        abilities: ['远程攻击', '穿甲'],

        counters: { infantry: 1.6, siege: 1.3 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    light_cavalry: {
        id: 'light_cavalry',
        name: '轻骑兵',
        desc: '快速机动的骑兵单位，克制弓箭手。',
        epoch: 2,
        icon: 'Navigation',
        category: 'cavalry',

        attack: 18,
        defense: 8,
        speed: 8,
        range: 1,

        recruitCost: { food: 600, silver: 300, iron: 125, swords: 6 },
        maintenanceCost: { food: 6, silver: 4, iron: 0.3 },
        trainingTime: 7,

        populationCost: 1,

        abilities: ['快速移动', '冲锋'],

        counters: { archer: 1.8 },
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 2
    },

    battering_ram: {
        id: 'battering_ram',
        name: '攻城槌',
        desc: '古典时代的攻城器械，对建筑极为有效。',
        epoch: 2,
        icon: 'Hammer',
        category: 'siege',

        attack: 30,
        defense: 15,
        speed: 1,
        range: 1,

        recruitCost: { food: 750, wood: 1000, iron: 250, swords: 4, silver: 400 },
        maintenanceCost: { food: 6, silver: 4, wood: 2.5, iron: 0.5 },
        trainingTime: 10,

        populationCost: 2,

        abilities: ['攻城'],

        counters: {},
        weakAgainst: ['cavalry', 'archer', 'infantry'],

        obsoleteAfterEpochs: 2
    },

    // ============ 封建时代 (Epoch 3) ============
    heavy_infantry: {
        id: 'heavy_infantry',
        name: '重甲步兵',
        desc: '装备锁子甲的精锐步兵，防御力强。',
        epoch: 3,
        icon: 'ShieldAlert',
        category: 'infantry',

        attack: 20,
        defense: 18,
        speed: 2,
        range: 1,

        recruitCost: { food: 700, iron: 300, swords: 10, plate_armor: 6, silver: 400 },
        maintenanceCost: { food: 4.5, silver: 3.5, iron: 0.6, cloth: 0.2 },
        trainingTime: 8,

        populationCost: 1,

        abilities: ['重甲', '坚守'],

        counters: { cavalry: 1.6, siege: 1.4 },
        weakAgainst: ['archer'],

        obsoleteAfterEpochs: 2
    },

    crossbowman: {
        id: 'crossbowman',
        name: '弩兵',
        desc: '装备十字弩的远程单位，穿透力强。',
        epoch: 3,
        icon: 'Crosshair',
        category: 'archer',

        attack: 22,
        defense: 9,
        speed: 3,
        range: 5,

        recruitCost: { food: 550, wood: 350, iron: 225, swords: 6, silver: 275 },
        maintenanceCost: { food: 4, silver: 3, wood: 0.75, iron: 0.5 },
        trainingTime: 7,

        populationCost: 1,

        abilities: ['远程攻击', '穿甲'],

        counters: { infantry: 1.7, siege: 1.4 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    knight: {
        id: 'knight',
        name: '骑士',
        desc: '装备板甲的精锐骑兵，封建时代的主力。',
        epoch: 3,
        icon: 'Crown',
        category: 'cavalry',

        attack: 28,
        defense: 22,
        speed: 6,
        range: 1,

        recruitCost: { food: 1250, iron: 500, copper: 150, swords: 12, plate_armor: 10, silver: 800 },
        maintenanceCost: { food: 9, silver: 6.5, iron: 0.8, copper: 0.3 },
        trainingTime: 10,

        populationCost: 1,

        abilities: ['重甲', '冲锋', '贵族'],

        counters: { archer: 1.9 },
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 2
    },

    trebuchet: {
        id: 'trebuchet',
        name: '投石机',
        desc: '中世纪的重型攻城器械，可投掷巨石。',
        epoch: 3,
        icon: 'Mountain',
        category: 'siege',

        attack: 45,
        defense: 8,
        speed: 1,
        range: 6,

        recruitCost: { food: 1000, wood: 1000, plank: 400, iron: 400, swords: 6, silver: 750 },
        maintenanceCost: { food: 7.5, silver: 6, plank: 1.5, iron: 0.6, stone: 1.2 },
        trainingTime: 12,

        populationCost: 3,

        abilities: ['攻城', '范围伤害'],

        counters: { infantry: 1.3 },
        weakAgainst: ['cavalry', 'archer'],

        obsoleteAfterEpochs: 2
    },

    // ============ 探索时代 (Epoch 4) ============
    pikeman: {
        id: 'pikeman',
        name: '长枪兵',
        desc: '装备长枪的步兵，方阵抵御骑兵冲锋。',
        epoch: 4,
        icon: 'Swords',
        category: 'infantry',

        attack: 22,
        defense: 20,
        speed: 2,
        range: 2,

        recruitCost: { food: 800, wood: 300, iron: 350, swords: 8, plate_armor: 5, silver: 450 },
        maintenanceCost: { food: 5, silver: 4, iron: 0.5 },
        trainingTime: 8,

        populationCost: 1,

        abilities: ['反骑兵', '方阵'],

        counters: { cavalry: 2.0, siege: 1.3 },
        weakAgainst: ['archer', 'gunpowder'],

        obsoleteAfterEpochs: 2
    },

    arquebus: {
        id: 'arquebus',
        name: '火绳枪手',
        desc: '早期火器部队，虽然装填慢但威力巨大，克制传统步兵和骑兵。',
        epoch: 4,
        icon: 'Flame',
        category: 'gunpowder',  // 改为火器类别

        attack: 28,
        defense: 8,
        speed: 2,
        range: 4,

        recruitCost: { food: 700, iron: 300, muskets: 10, silver: 500 },
        maintenanceCost: { food: 4.5, silver: 4, iron: 0.35, gunpowder: 0.8 },
        trainingTime: 9,

        populationCost: 1,

        abilities: ['火器', '穿甲', '装填缓慢'],

        counters: { infantry: 1.5, cavalry: 1.4 },  // 火器克制步兵和骑兵
        weakAgainst: ['cavalry'],  // 但被近身的骑兵克制

        obsoleteAfterEpochs: 2
    },

    cuirassier: {
        id: 'cuirassier',
        name: '胸甲骑兵',
        desc: '装备胸甲的重装骑兵，可抵抗早期火器。',
        epoch: 4,
        icon: 'Shield',
        category: 'cavalry',

        attack: 32,
        defense: 24,
        speed: 6,
        range: 1,

        recruitCost: { food: 1500, iron: 600, plate_armor: 10, silver: 1000 },
        maintenanceCost: { food: 10, silver: 7.5, iron: 1.25 },
        trainingTime: 11,

        populationCost: 1,

        abilities: ['重甲', '冲锋', '抗火器'],

        counters: { archer: 1.9, gunpowder: 1.5 },  // 骑兵近身克制火器
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 2
    },

    bombard: {
        id: 'bombard',
        name: '射石炮',
        desc: '早期火炮，可攻破城墙。',
        epoch: 4,
        icon: 'Bomb',
        category: 'siege',

        attack: 55,
        defense: 10,
        speed: 1,
        range: 6,

        recruitCost: { food: 1250, iron: 600, muskets: 8, copper: 250, silver: 1000 },
        maintenanceCost: { food: 9, silver: 7.5, iron: 1.2, gunpowder: 1.2, copper: 0.4 },
        trainingTime: 14,

        populationCost: 3,

        abilities: ['攻城', '范围伤害', '火器'],

        counters: { infantry: 1.5 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    // ============ 启蒙时代 (Epoch 5) ============
    musketeer: {
        id: 'musketeer',
        name: '刺刀火枪兵',
        desc: '装备滑膛枪和刺刀的步兵，可远程射击也可近战。',
        epoch: 5,
        icon: 'Zap',
        category: 'infantry',  // 火枪兵是步兵（有刺刀可近战）

        attack: 30,
        defense: 14,
        speed: 3,
        range: 3,

        recruitCost: { food: 900, iron: 350, rifles: 10, silver: 550 },
        maintenanceCost: { food: 5.5, silver: 5, iron: 0.45, ammunition: 0.8, cloth: 0.15 },
        trainingTime: 9,

        populationCost: 1,

        abilities: ['火器', '刺刀冲锋', '齐射'],

        counters: { cavalry: 1.6, siege: 1.4 },  // 火枪兵有刺刀，克制骑兵
        weakAgainst: ['gunpowder'],  // 被专业火器部队克制

        obsoleteAfterEpochs: 2
    },

    rifleman: {
        id: 'rifleman',
        name: '线膛枪手',
        desc: '装备线膛枪的精确射手，射程远、精度高。',
        epoch: 5,
        icon: 'Target',
        category: 'gunpowder',  // 改为火器类别

        attack: 35,
        defense: 10,
        speed: 3,
        range: 5,

        recruitCost: { food: 1000, iron: 400, rifles: 12, silver: 650 },
        maintenanceCost: { food: 6, silver: 5.5, iron: 0.5, ammunition: 1.0 },
        trainingTime: 10,

        populationCost: 1,

        abilities: ['火器', '精确射击', '穿甲'],

        counters: { infantry: 1.7, cavalry: 1.5, siege: 1.5 },  // 火器全面克制
        weakAgainst: ['cavalry'],  // 被近身骑兵克制

        obsoleteAfterEpochs: 2
    },

    dragoon: {
        id: 'dragoon',
        name: '龙骑兵',
        desc: '骑马机动的火枪兵，可下马作战，机动性和火力兼备。',
        epoch: 5,
        icon: 'Navigation',
        category: 'cavalry',  // 龙骑兵本质是骑兵

        attack: 35,
        defense: 18,
        speed: 7,
        range: 2,

        recruitCost: { food: 1400, iron: 450, rifles: 8, silver: 900 },
        maintenanceCost: { food: 10, silver: 7.5, iron: 0.75, ammunition: 0.6 },
        trainingTime: 12,

        populationCost: 1,

        abilities: ['火器', '快速移动', '下马作战'],

        counters: { archer: 1.8, gunpowder: 1.6 },  // 骑兵近身克制火器
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 2
    },

    cannon: {
        id: 'cannon',
        name: '野战炮',
        desc: '启蒙时代的标准火炮，可用于攻城和野战。',
        epoch: 5,
        icon: 'Bomb',
        category: 'siege',

        attack: 60,
        defense: 12,
        speed: 2,
        range: 7,

        recruitCost: { food: 1500, iron: 700, rifles: 6, copper: 300, silver: 1250 },
        maintenanceCost: { food: 10, silver: 9, iron: 1.4, ammunition: 1.5, copper: 0.5 },
        trainingTime: 15,

        populationCost: 3,

        abilities: ['攻城', '范围伤害', '火器'],

        counters: { infantry: 1.7, gunpowder: 1.5 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 2
    },

    // ============ 工业时代 (Epoch 6) ============
    line_infantry: {
        id: 'line_infantry',
        name: '线列步兵',
        desc: '工业化训练的步兵，装备后装步枪和刺刀。',
        epoch: 6,
        icon: 'Users',
        category: 'infantry',

        attack: 40,
        defense: 20,
        speed: 3,
        range: 4,

        recruitCost: { food: 1250, steel: 150, ordnance: 10, silver: 800 },
        maintenanceCost: { food: 7, silver: 6.5, steel: 0.3, ammunition: 1.0, coal: 0.15 },
        trainingTime: 10,

        populationCost: 1,

        abilities: ['火器', '齐射', '刺刀冲锋'],

        counters: { cavalry: 1.7, siege: 1.5 },
        weakAgainst: ['gunpowder'],

        obsoleteAfterEpochs: 3
    },

    gatling: {
        id: 'gatling',
        name: '加特林机枪组',
        desc: '早期机枪，火力密集，克制密集阵型的步兵和骑兵。',
        epoch: 6,
        icon: 'Zap',
        category: 'gunpowder',  // 改为火器类别

        attack: 50,
        defense: 12,
        speed: 2,
        range: 5,

        recruitCost: { food: 1500, steel: 300, ordnance: 15, coal: 200, silver: 1250 },
        maintenanceCost: { food: 8, silver: 9, steel: 0.6, ammunition: 2.0, coal: 0.8 },
        trainingTime: 12,

        populationCost: 2,

        abilities: ['火器', '压制火力', '范围伤害'],

        counters: { infantry: 2.0, cavalry: 1.8 },  // 机枪对步兵骑兵都有强克制
        weakAgainst: ['siege'],  // 被火炮克制

        obsoleteAfterEpochs: 3
    },

    lancer: {
        id: 'lancer',
        name: '枪骑兵',
        desc: '工业时代的精锐骑兵，适合侦察、追击和近身突袭火器阵地。',
        epoch: 6,
        icon: 'Compass',
        category: 'cavalry',

        attack: 38,
        defense: 20,
        speed: 8,
        range: 1,

        recruitCost: { food: 1600, steel: 120, ordnance: 8, silver: 1000 },
        maintenanceCost: { food: 11, silver: 8, steel: 0.25, ammunition: 0.5, iron: 0.4 },
        trainingTime: 11,

        populationCost: 1,

        abilities: ['冲锋', '快速移动', '侦察'],

        counters: { archer: 1.9, gunpowder: 1.7 },  // 骑兵近身克制火器
        weakAgainst: ['infantry'],

        obsoleteAfterEpochs: 3
    },

    artillery: {
        id: 'artillery',
        name: '重型火炮',
        desc: '工业化生产的重型火炮，威力巨大。',
        epoch: 6,
        icon: 'Bomb',
        category: 'siege',

        attack: 80,
        defense: 15,
        speed: 1,
        range: 8,

        recruitCost: { food: 2000, steel: 500, ordnance: 12, coal: 400, silver: 1750 },
        maintenanceCost: { food: 10, silver: 11, steel: 1.2, ammunition: 2.5, coal: 1.5 },
        trainingTime: 18,

        populationCost: 4,

        abilities: ['攻城', '范围伤害', '精确打击'],

        counters: { infantry: 2.0, gunpowder: 1.8, siege: 1.5 },
        weakAgainst: ['cavalry'],

        obsoleteAfterEpochs: 3
    }
};

// 兵种类别定义
export const UNIT_CATEGORIES = {
    infantry: { name: '步兵', icon: 'Swords', color: 'text-red-400', description: '克制骑兵，被弓箭手/火器克制' },
    archer: { name: '弓箭手', icon: 'Target', color: 'text-green-400', description: '克制步兵，被骑兵克制' },
    cavalry: { name: '骑兵', icon: 'Navigation', color: 'text-blue-400', description: '克制弓箭手/火器，被步兵克制' },
    gunpowder: { name: '火器', icon: 'Flame', color: 'text-yellow-400', description: '克制步兵/骑兵，近战被骑兵克制' },
    siege: { name: '攻城', icon: 'Bomb', color: 'text-orange-400', description: '攻城利器，但机动性差' }
};

// 克制关系常量 (用于UI显示)
export const COUNTER_RELATIONS = {
    infantry: { counters: 'cavalry', weakAgainst: 'archer/gunpowder' },
    archer: { counters: 'infantry', weakAgainst: 'cavalry' },
    cavalry: { counters: 'archer/gunpowder', weakAgainst: 'infantry' },
    gunpowder: { counters: 'infantry/cavalry', weakAgainst: 'cavalry(近战)' },
    siege: { counters: null, weakAgainst: 'all' }
};

export const calculateArmyFoodNeed = (army = {}) => {
    let total = 0;
    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        if (!unit) return;
        const foodNeed = unit.maintenanceCost?.food || 0;
        total += foodNeed * count;
    });
    return total;
};

// 战斗计算函数
// soldierWage: 士兵阶层的平均工资，影响战斗力（默认50，上限加成+50%）
export const calculateBattlePower = (army, epoch, militaryBuffs = 0, soldierWage = 50) => {
    let totalPower = 0;

    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;

        const unit = UNIT_TYPES[unitId];
        if (!unit) return;

        // 基础战斗力 = (攻击力 + 防御力) * 数量
        let unitPower = (unit.attack + unit.defense) * count;

        // 时代差距计算
        const epochDiff = epoch - unit.epoch;

        // 时代加成：高时代部队有科技优势
        if (epochDiff > 0 && epochDiff <= (unit.obsoleteAfterEpochs || 2)) {
            unitPower *= (1 + epochDiff * 0.05); // 每高一个时代+5%
        }

        // 时代淘汰惩罚：超过淘汰时代后战斗力下降
        const obsoleteThreshold = unit.obsoleteAfterEpochs || 2;
        if (epochDiff > obsoleteThreshold) {
            const obsoleteEpochs = epochDiff - obsoleteThreshold;
            // 每超过1个时代，战斗力降低25%，最多降低75%
            const penalty = Math.min(0.75, obsoleteEpochs * 0.25);
            unitPower *= (1 - penalty);
        }

        totalPower += unitPower;
    });

    // 应用军事buff
    totalPower *= (1 + militaryBuffs);

    // 军饷加成：工资越高，士气越高，战斗力越强
    // 基准工资50，每高出50点工资增加25%战斗力，上限+50%
    const baseWage = 50;
    const wageRatio = Math.max(0, (soldierWage - baseWage) / baseWage);
    const wageMultiplier = Math.min(1.5, 1 + wageRatio * 0.5);
    totalPower *= wageMultiplier;

    return totalPower;
};

/**
 * 根据时代获取可用的兵种列表
 * @param {number} epoch - 当前时代
 * @returns {Array} 可用兵种ID数组
 */
const getAvailableUnitsForEpoch = (epoch) => {
    const available = [];
    Object.entries(UNIT_TYPES).forEach(([unitId, unit]) => {
        // 兵种时代 <= 当前时代，且未过时
        const epochDiff = epoch - unit.epoch;
        const obsoleteThreshold = unit.obsoleteAfterEpochs || 2;
        if (unit.epoch <= epoch && epochDiff <= obsoleteThreshold) {
            available.push(unitId);
        }
    });
    return available;
};

/**
 * 计算一个兵种的实际银币造价（基于当地物价）
 * @param {string} unitId - 兵种ID
 * @param {Object} prices - 当地物价 { resource: price }
 * @returns {number} 实际银币总造价
 */
export const calculateUnitCost = (unitId, prices = {}) => {
    const unit = UNIT_TYPES[unitId];
    if (!unit?.recruitCost) return Infinity;
    let totalCost = 0;
    Object.entries(unit.recruitCost).forEach(([resource, amount]) => {
        // silver=1（货币本身）；没有价格数据时用basePrice
        const price = resource === 'silver'
            ? 1
            : (prices[resource] ?? RESOURCES?.[resource]?.basePrice ?? 1);
        totalCost += amount * price;
    });
    return totalCost;
};

/**
 * 为AI国家生成虚拟军队组成
 * 【军费预算制】：军队规模和装备由真实造价决定
 * - 军费预算 = wealth × 军费比例（和平15%/战时25%）
 * - 兵种选择 = 每类别内按epoch降序、在预算约束内选最先进能负担的
 * - 兵力 = min(人口上限, 预算 ÷ 单兵加权成本)
 * @param {Object} nation - 国家对象
 * @param {number} epoch - 当前时代
 * @param {number} deploymentRatio - 派遣比例 (0-1)，默认1.0表示全部派遣
 * @param {number} difficultyMultiplier - 难度军力倍数，默认1.0
 * @returns {Object} 军队对象 { unitId: count, ... }
 */
export const generateNationArmy = (nation, epoch, deploymentRatio = 1.0, difficultyMultiplier = 1.0) => {
    const population = nation?.population || 100;
    const militaryQuality = Math.max(0.7, Math.min(1.6, nation?.militaryQuality ?? nation?.militaryStrength ?? 1.0));
    const aggression = nation?.aggression || 0.3;
    const wealth = nation?.wealth || 500;

    // 1. 军费预算 = wealth × 军费比例
    const warBudgetRatio = nation?.isAtWar
        ? (WAR_ECONOMY?.WAR_BUDGET_RATIO || 0.25)
        : (WAR_ECONOMY?.PEACE_BUDGET_RATIO || 0.15);
    const militaryBudget = wealth * warBudgetRatio * difficultyMultiplier;

    // 2. 人口上限（保留现有动员率逻辑）
    const wartimeMobilizationBonus = nation?.isAtWar ? 0.008 : 0;
    const manpowerRatio = Math.min(0.026, 0.008 + epoch * 0.0015 + wartimeMobilizationBonus);
    const sizeQualityFactor = 0.9 + (militaryQuality - 1) * 0.2;
    const maxManpower = Math.floor(population * manpowerRatio * sizeQualityFactor);

    // 3. 获取当地物价（AI用nationPrices，否则用默认basePrice）
    const localPrices = nation?.nationPrices || {};

    // 4. 获取当前时代可用兵种
    const availableUnits = getAvailableUnitsForEpoch(epoch);
    if (availableUnits.length === 0) {
        const minFloor = WAR_ECONOMY?.MIN_ARMY_FLOOR || 10;
        return { militia: Math.max(minFloor, Math.min(maxManpower, Math.floor(militaryBudget / 200))) };
    }

    // 5. 按类别分组
    const infantryUnits = availableUnits.filter(id => UNIT_TYPES[id]?.category === 'infantry');
    const rangedUnits = availableUnits.filter(id =>
        UNIT_TYPES[id]?.category === 'archer' || UNIT_TYPES[id]?.category === 'gunpowder'
    );
    const cavalryUnits = availableUnits.filter(id => UNIT_TYPES[id]?.category === 'cavalry');
    const siegeUnits = availableUnits.filter(id => UNIT_TYPES[id]?.category === 'siege');

    // 6. 兵种选择函数：每类别内按epoch降序选预算内最先进的
    const selectBestAffordableUnit = (categoryUnits, budgetForCategory, minCount) => {
        if (categoryUnits.length === 0) return null; // 当前时代该类别无兵种，不出兵

        const sorted = [...categoryUnits].sort((a, b) =>
            (UNIT_TYPES[b]?.epoch || 0) - (UNIT_TYPES[a]?.epoch || 0)
        );
        for (const unitId of sorted) {
            const cost = calculateUnitCost(unitId, localPrices);
            if (budgetForCategory / cost >= minCount) {
                return { unitId, cost };
            }
        }
        // 都太贵？选该类别内最便宜的（不会跨类别凑）
        let cheapestId = sorted[sorted.length - 1];
        let cheapestCost = Infinity;
        for (const id of sorted) {
            const c = calculateUnitCost(id, localPrices);
            if (c < cheapestCost) {
                cheapestCost = c;
                cheapestId = id;
            }
        }
        return { unitId: cheapestId, cost: cheapestCost };
    };

    // 7. 预算分配比例（根据侵略性调整）
    const budgetRatios = {
        infantry: 0.35 + (1 - aggression) * 0.15,  // 35-50%
        ranged: 0.25 + aggression * 0.1,            // 25-35%
        cavalry: 0.20 + aggression * 0.1,           // 20-30%
        siege: 0.05,                                 // 5%
    };

    // 8. 两轮分配：第一轮按比例，第二轮回收无兵种类别的预算
    const categories = [
        { key: 'infantry', units: infantryUnits, ratio: budgetRatios.infantry },
        { key: 'ranged', units: rangedUnits, ratio: budgetRatios.ranged },
        { key: 'cavalry', units: cavalryUnits, ratio: budgetRatios.cavalry },
        { key: 'siege', units: siegeUnits, ratio: budgetRatios.siege },
    ];

    // 第一轮：标记哪些类别有兵种
    let recycleBudget = 0;
    let activeTotalRatio = 0;
    for (const cat of categories) {
        if (cat.units.length === 0) {
            recycleBudget += militaryBudget * cat.ratio;
            cat.active = false;
        } else {
            cat.active = true;
            activeTotalRatio += cat.ratio;
        }
    }

    // 第二轮：回收预算按比例分配给有兵种的类别
    const army = {};
    let totalRecruited = 0;
    const minCountPerCategory = 3; // 每类别至少能招到3人才选先进兵种

    for (const cat of categories) {
        if (!cat.active) continue;

        // 基础预算 + 回收预算（按比例）
        const baseBudget = militaryBudget * cat.ratio;
        const recyclePortion = activeTotalRatio > 0
            ? recycleBudget * (cat.ratio / activeTotalRatio)
            : 0;
        const categoryBudget = baseBudget + recyclePortion;

        const selection = selectBestAffordableUnit(cat.units, categoryBudget, minCountPerCategory);
        if (!selection) continue;

        const count = Math.floor(categoryBudget / selection.cost);
        if (count > 0) {
            army[selection.unitId] = (army[selection.unitId] || 0) + count;
            totalRecruited += count;
        }
    }

    // 9. 应用人口上限
    if (totalRecruited > maxManpower && maxManpower > 0) {
        const scaleFactor = maxManpower / totalRecruited;
        for (const unitId of Object.keys(army)) {
            army[unitId] = Math.max(1, Math.floor(army[unitId] * scaleFactor));
        }
        totalRecruited = Object.values(army).reduce((s, c) => s + c, 0);
    }

    // 10. 保底：极端情况下至少有MIN_ARMY_FLOOR人步兵
    const minFloor = WAR_ECONOMY?.MIN_ARMY_FLOOR || 10;
    if (totalRecruited < minFloor) {
        // 选当前时代最便宜的步兵
        const fallbackInfantry = infantryUnits.length > 0
            ? infantryUnits.reduce((best, id) => {
                const c = calculateUnitCost(id, localPrices);
                return c < (best.cost || Infinity) ? { id, cost: c } : best;
            }, { id: infantryUnits[0], cost: Infinity })
            : { id: 'militia' };
        const needed = minFloor - totalRecruited;
        army[fallbackInfantry.id] = (army[fallbackInfantry.id] || 0) + needed;
    }

    // 11. 应用派遣比例
    if (deploymentRatio < 1.0) {
        for (const unitId of Object.keys(army)) {
            army[unitId] = Math.max(1, Math.floor(army[unitId] * deploymentRatio));
        }
    }

    return army;
};

/**
 * 计算AI国家的总战斗力
 * @param {Object} nation - 国家对象
 * @param {number} epoch - 当前时代
 * @param {number} deploymentRatio - 派遣比例 (0-1)，默认1.0表示全部军队
 * @param {number} difficultyMultiplier - 难度军力倍数，默认1.0
 * @returns {number} 战斗力值
 */
export const calculateNationBattlePower = (nation, epoch, deploymentRatio = 1.0, difficultyMultiplier = 1.0) => {
    const army = generateNationArmy(nation, epoch, deploymentRatio, difficultyMultiplier);
    const aggression = nation?.aggression || 0.3;
    const militaryQuality = Math.max(0.7, Math.min(1.6, nation?.militaryQuality ?? nation?.militaryStrength ?? 1.0));

    // 侵略性影响进攻意愿，质量影响军队执行力。
    const aggressionBuff = Math.max(0, (aggression - 0.3) * 0.35);
    const qualityBuff = (militaryQuality - 1) * 0.25;
    const militaryBuffs = aggressionBuff + qualityBuff;

    return calculateBattlePower(army, epoch, militaryBuffs);
};

// 计算兵种克制效果
export const calculateCounterBonus = (attackerArmy, defenderArmy) => {
    let bonusMultiplier = 1.0;
    let counterCount = 0;

    Object.entries(attackerArmy).forEach(([attackerId, attackerCount]) => {
        if (attackerCount <= 0) return;

        const attackerUnit = UNIT_TYPES[attackerId];
        if (!attackerUnit) return;

        Object.entries(defenderArmy).forEach(([defenderId, defenderCount]) => {
            if (defenderCount <= 0) return;

            const defenderUnit = UNIT_TYPES[defenderId];
            if (!defenderUnit) return;

            // 检查类别克制
            if (attackerUnit.counters[defenderUnit.category]) {
                const counterBonus = attackerUnit.counters[defenderUnit.category];
                const weight = (attackerCount * defenderCount) / 100; // 权重
                bonusMultiplier += (counterBonus - 1) * weight;
                counterCount++;
            }
        });
    });

    return { multiplier: bonusMultiplier, counterCount };
};

const ATTACK_ABILITY_BONUS = {
    '范围伤害': 0.12,
    '压制火力': 0.1,
    '火器': 0.06,
    '齐射': 0.05,
    '远程攻击': 0.05,
    '穿甲': 0.06,
    '冲锋': 0.06,
    '机动': 0.04,
    '快速移动': 0.04,
    '侦察': 0.03,
    '攻城': 0.08,
    '精确打击': 0.08,
};

const DEFENSE_ABILITY_BONUS = {
    '坚守': 0.08,
    '方阵': 0.08,
    '盾墙': 0.08,
};

const sumAbilityBonus = (abilities, bonusMap) => {
    if (!Array.isArray(abilities)) return 0;
    return abilities.reduce((sum, ability) => sum + (bonusMap[ability] || 0), 0);
};

const getEnemyCategoryRatios = (enemyCategoryCounts = {}) => {
    const total = Object.values(enemyCategoryCounts).reduce((sum, count) => sum + (count || 0), 0);
    if (total <= 0) {
        return { infantry: 0, cavalry: 0, archer: 0, gunpowder: 0, siege: 0 };
    }
    return {
        infantry: (enemyCategoryCounts.infantry || 0) / total,
        cavalry: (enemyCategoryCounts.cavalry || 0) / total,
        archer: (enemyCategoryCounts.archer || 0) / total,
        gunpowder: (enemyCategoryCounts.gunpowder || 0) / total,
        siege: (enemyCategoryCounts.siege || 0) / total,
    };
};

const getCategoryCounts = (army = {}) => {
    const counts = {};
    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        if (!unit) return;
        counts[unit.category] = (counts[unit.category] || 0) + count;
    });
    return counts;
};

const getCounterMultiplier = (unit, enemyCategoryCounts, enemyTotalUnits) => {
    if (!unit || enemyTotalUnits <= 0) return 1;
    let multiplier = 1;
    Object.entries(unit.counters || {}).forEach(([category, bonus]) => {
        const weight = (enemyCategoryCounts[category] || 0) / enemyTotalUnits;
        if (weight > 0) {
            multiplier += (bonus - 1) * weight;
        }
    });
    return multiplier;
};

const getCounterPressureByCategory = (enemyArmy = {}) => {
    const pressure = {
        infantry: 1,
        cavalry: 1,
        archer: 1,
        gunpowder: 1,
        siege: 1,
    };
    const totalEnemyUnits = Object.values(enemyArmy).reduce((sum, count) => sum + (count || 0), 0);
    if (totalEnemyUnits <= 0) return pressure;

    Object.entries(enemyArmy).forEach(([unitId, count]) => {
        if (count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        if (!unit || !unit.counters) return;
        const weight = count / totalEnemyUnits;
        Object.entries(unit.counters).forEach(([category, bonus]) => {
            pressure[category] += (bonus - 1) * weight;
        });
    });

    return pressure;
};

const buildCombatProfile = ({
    army,
    enemyCategoryCounts,
    enemyCounterPressure,
    militaryBuffs = 0,
    defenseMultiplier = 1,
}) => {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalUnits = 0;
    const unitProfiles = {};
    const enemyTotalUnits = Object.values(enemyCategoryCounts || {}).reduce((sum, count) => sum + (count || 0), 0);
    const enemyRatios = getEnemyCategoryRatios(enemyCategoryCounts);

    Object.entries(army || {}).forEach(([unitId, count]) => {
        if (count <= 0) return;
        const unit = UNIT_TYPES[unitId];
        if (!unit) return;

        const counterMultiplier = getCounterMultiplier(unit, enemyCategoryCounts || {}, enemyTotalUnits);
        const attackAbilityBonus = sumAbilityBonus(unit.abilities, ATTACK_ABILITY_BONUS);
        const defenseAbilityBonus = sumAbilityBonus(unit.abilities, DEFENSE_ABILITY_BONUS);
        const rangeBonus = Math.min(0.3, (unit.range || 1) * 0.03);
        const speedBonus = Math.min(0.2, (unit.speed || 1) * 0.02);

        // 能力-规则细化：根据敌方构成对攻击/防御做情境修正
        let abilityAttackMod = 0;
        let abilityDefenseMod = 0;
        let counterPressureMod = 0;
        const abilities = Array.isArray(unit.abilities) ? unit.abilities : [];

        if (abilities.includes('范围伤害')) {
            abilityAttackMod += 0.18 * (enemyRatios.infantry + enemyRatios.archer);
        }
        if (abilities.includes('压制火力')) {
            abilityAttackMod += 0.12 * (enemyRatios.infantry + enemyRatios.archer);
        }
        if (abilities.includes('火器')) {
            abilityAttackMod += 0.1 * (enemyRatios.infantry + enemyRatios.cavalry);
            abilityDefenseMod -= 0.08 * enemyRatios.cavalry;
        }
        if (abilities.includes('穿甲')) {
            abilityAttackMod += 0.08 * (enemyRatios.infantry + enemyRatios.gunpowder + enemyRatios.siege);
        }
        if (abilities.includes('冲锋') && (unit.speed || 0) >= 6) {
            abilityAttackMod += 0.1 * (enemyRatios.gunpowder + enemyRatios.archer);
        }
        if (abilities.includes('刺刀冲锋')) {
            abilityAttackMod += 0.06 * enemyRatios.cavalry;
        }
        if (abilities.includes('装填缓慢')) {
            abilityAttackMod -= 0.12 * enemyRatios.cavalry;
        }
        if (abilities.includes('重甲')) {
            abilityDefenseMod += 0.12;
            abilityAttackMod -= 0.05;
        }
        if (abilities.includes('抗火器')) {
            counterPressureMod -= 0.15 * enemyRatios.gunpowder;
            abilityDefenseMod += 0.05 * enemyRatios.gunpowder;
        }
        if (abilities.includes('精确射击') || abilities.includes('精确打击')) {
            abilityAttackMod += 0.08 * (enemyRatios.siege + enemyRatios.infantry);
        }
        if (abilities.includes('下马作战')) {
            abilityDefenseMod += 0.08 * enemyRatios.cavalry;
        }

        const attackPerUnit = unit.attack
            * (1 + rangeBonus + speedBonus + attackAbilityBonus + abilityAttackMod)
            * (1 + militaryBuffs)
            * counterMultiplier;

        const defensePerUnit = unit.defense
            * (1 + speedBonus * 0.5 + defenseAbilityBonus + abilityDefenseMod)
            * defenseMultiplier
            * (1 + militaryBuffs);

        const counterPressure = Math.max(0.6, (enemyCounterPressure?.[unit.category] || 1) * (1 + counterPressureMod));
        const adjustedDefensePerUnit = defensePerUnit / counterPressure;

        totalAttack += attackPerUnit * count;
        totalDefense += defensePerUnit * count;
        totalUnits += count;

        unitProfiles[unitId] = {
            count,
            attackPerUnit,
            defensePerUnit,
            adjustedDefensePerUnit,
            category: unit.category,
        };
    });

    return {
        totalAttack,
        totalDefense,
        totalUnits,
        unitProfiles,
    };
};

const getDominantCategory = (unitProfiles = {}) => {
    const categoryCounts = {};
    Object.values(unitProfiles).forEach((profile) => {
        if (!profile) return;
        categoryCounts[profile.category] = (categoryCounts[profile.category] || 0) + profile.count;
    });
    let dominantCategory = null;
    let maxCount = 0;
    Object.entries(categoryCounts).forEach(([category, count]) => {
        if (count > maxCount) {
            maxCount = count;
            dominantCategory = category;
        }
    });
    return dominantCategory;
};

const probabilisticRound = (value) => {
    const integerPart = Math.floor(value);
    const fractionalPart = value - integerPart;
    return integerPart + (Math.random() < fractionalPart ? 1 : 0);
};

const applyLossCap = (losses, maxTotal) => {
    if (maxTotal <= 0) return {};
    const capped = { ...losses };
    let totalLoss = Object.values(capped).reduce((sum, count) => sum + (count || 0), 0);
    if (totalLoss <= maxTotal) return capped;

    const scale = maxTotal / totalLoss;
    Object.keys(capped).forEach((unitId) => {
        capped[unitId] = probabilisticRound(capped[unitId] * scale);
    });

    totalLoss = Object.values(capped).reduce((sum, count) => sum + (count || 0), 0);
    if (totalLoss <= maxTotal) return capped;

    const unitIdsByLoss = Object.keys(capped).sort((a, b) => (capped[b] || 0) - (capped[a] || 0));
    let index = 0;
    while (totalLoss > maxTotal && unitIdsByLoss.length > 0) {
        const unitId = unitIdsByLoss[index % unitIdsByLoss.length];
        if ((capped[unitId] || 0) > 0) {
            capped[unitId] -= 1;
            totalLoss -= 1;
        }
        index += 1;
    }

    return capped;
};

const computeLosses = ({
    sideProfile,
    enemyProfile,
    enemyCounterPressure,
    isWinner,
    powerRatio,
    decisive,
    dominanceRatio,
    ownPowerScore,
    enemyPowerScore,
}) => {
    if (!sideProfile || sideProfile.totalUnits <= 0 || enemyProfile.totalAttack <= 0) {
        return {};
    }

    const relativePower = enemyPowerScore / (enemyPowerScore + ownPowerScore);
    let damageScale = 0.12 * Math.pow(relativePower, 0.9);
    if (isWinner) damageScale *= 0.75;
    if (decisive) damageScale *= isWinner ? 0.6 : 1.1;
    damageScale *= 0.9 + Math.random() * 0.2;

    // 劣势方允许更高的伤害预算，支持“全灭”
    if (!isWinner) {
        const dominance = Math.max(1, dominanceRatio || 1);
        damageScale *= 1 + Math.min(0.8, (dominance - 1) * 0.18);
    }

    const damagePoints = enemyProfile.totalAttack * damageScale;
    if (damagePoints <= 0) return {};

    let exposureTotal = 0;
    Object.values(sideProfile.unitProfiles).forEach((profile) => {
        exposureTotal += profile.count / profile.adjustedDefensePerUnit;
    });

    if (exposureTotal <= 0) return {};

    const losses = {};
    Object.entries(sideProfile.unitProfiles).forEach(([unitId, profile]) => {
        const exposure = profile.count / profile.adjustedDefensePerUnit;
        const assignedDamage = damagePoints * (exposure / exposureTotal);
        const expectedLoss = assignedDamage / profile.adjustedDefensePerUnit;
        losses[unitId] = Math.min(profile.count, probabilisticRound(expectedLoss));
    });

    if (!isWinner) {
        const dominance = Math.max(1, dominanceRatio || 1);
        if (dominance >= 3 && (decisive || dominance >= 6)) {
            const wipeChance = Math.min(0.75, 0.2 + (dominance - 3) * 0.12 + (decisive ? 0.15 : 0));
            if (Math.random() < wipeChance) {
                const wiped = {};
                Object.entries(sideProfile.unitProfiles).forEach(([unitId, profile]) => {
                    wiped[unitId] = profile.count;
                });
                return wiped;
            }
        }
    }

    if (isWinner && powerRatio >= 3 && enemyProfile.totalUnits > 0) {
        let maxLossTotal;
        if (powerRatio >= 10) {
            maxLossTotal = Math.floor(Math.sqrt(enemyProfile.totalUnits) * 0.2);
        } else if (powerRatio >= 6) {
            maxLossTotal = Math.floor(Math.sqrt(enemyProfile.totalUnits) * 0.3);
        } else {
            maxLossTotal = Math.floor(Math.sqrt(enemyProfile.totalUnits) * 0.4);
        }

        const dominantCategory = getDominantCategory(sideProfile.unitProfiles);
        const counterPressure = enemyCounterPressure?.[dominantCategory] || 1;
        if (counterPressure >= 1.4 && maxLossTotal === 0 && enemyProfile.totalUnits >= 5) {
            maxLossTotal = 1;
        }

        return applyLossCap(losses, maxLossTotal);
    }

    return losses;
};

// 完整战斗模拟
export const simulateBattle = (attackerData, defenderData) => {
    const { army: attackerArmy, militaryBuffs: attackerBuffs = 0 } = attackerData;
    const { army: defenderArmy, militaryBuffs: defenderBuffs = 0, wealth: defenderWealth = 1000 } = defenderData;

    const attackerCategoryCounts = getCategoryCounts(attackerArmy);
    const defenderCategoryCounts = getCategoryCounts(defenderArmy);
    const attackerCounterPressure = getCounterPressureByCategory(attackerArmy);
    const defenderCounterPressure = getCounterPressureByCategory(defenderArmy);

    const attackerProfile = buildCombatProfile({
        army: attackerArmy,
        enemyCategoryCounts: defenderCategoryCounts,
        enemyCounterPressure: defenderCounterPressure,
        militaryBuffs: attackerBuffs,
        defenseMultiplier: 1,
    });

    const defenderProfile = buildCombatProfile({
        army: defenderArmy,
        enemyCategoryCounts: attackerCategoryCounts,
        enemyCounterPressure: attackerCounterPressure,
        militaryBuffs: defenderBuffs,
        defenseMultiplier: 1.2,
    });

    let attackerPower = attackerProfile.totalAttack * 0.65 + attackerProfile.totalDefense * 0.35;
    let defenderPower = defenderProfile.totalAttack * 0.65 + defenderProfile.totalDefense * 0.35;

    attackerPower *= 0.9 + Math.random() * 0.2;
    defenderPower *= 0.9 + Math.random() * 0.2;

    const totalPower = attackerPower + defenderPower;
    const attackerAdvantage = totalPower > 0 ? attackerPower / totalPower : 0;
    const defenderAdvantage = totalPower > 0 ? defenderPower / totalPower : 0;

    const victory = attackerAdvantage > 0.5;
    const decisive = Math.abs(attackerAdvantage - 0.5) > 0.28;

    const powerRatio = defenderPower > 0 ? attackerPower / defenderPower : 100;

    const attackerLosses = computeLosses({
        sideProfile: attackerProfile,
        enemyProfile: defenderProfile,
        enemyCounterPressure: defenderCounterPressure,
        isWinner: victory,
        powerRatio,
        decisive,
        dominanceRatio: victory ? powerRatio : 1 / powerRatio,
        ownPowerScore: attackerPower,
        enemyPowerScore: defenderPower,
    });

    const defenderLosses = computeLosses({
        sideProfile: defenderProfile,
        enemyProfile: attackerProfile,
        enemyCounterPressure: attackerCounterPressure,
        isWinner: !victory,
        powerRatio: powerRatio > 0 ? 1 / powerRatio : 100,
        decisive,
        dominanceRatio: victory ? powerRatio : 1 / powerRatio,
        ownPowerScore: defenderPower,
        enemyPowerScore: attackerPower,
    });

    const attackerCounter = calculateCounterBonus(attackerArmy, defenderArmy);
    const defenderCounter = calculateCounterBonus(defenderArmy, attackerArmy);

    // 计算掠夺资源（按比例计算，考虑敌方财富）
    // [FIXED] 添加硬性上限防止后期资源爆炸
    let loot = {};
    if (victory) {
        // Base loot multiplier depends on victory type
        const baseLootMultiplier = decisive ? 0.08 : 0.04; // 8% or 4% of enemy wealth
        const wealthBasedLoot = defenderWealth * baseLootMultiplier;

        // 硬性上限 - 无论敌方多富有，单次战斗的战利品都不会超过这些值
        const LOOT_CAPS = {
            food: 500,
            wood: 300,
            stone: 200,
            silver: 1500,
            iron: 150,
            copper: 100,
            cloth: 100,
            tools: 80,
        };

        // Diversified loot based on enemy wealth with proportional scaling
        // Apply hard caps to prevent late-game overflow
        loot = {
            food: Math.min(LOOT_CAPS.food, Math.floor(wealthBasedLoot * 0.25)),
            wood: Math.min(LOOT_CAPS.wood, Math.floor(wealthBasedLoot * 0.12)),
            stone: Math.min(LOOT_CAPS.stone, Math.floor(wealthBasedLoot * 0.08)),
            silver: Math.min(LOOT_CAPS.silver, Math.floor(wealthBasedLoot * 0.30)),
            iron: Math.min(LOOT_CAPS.iron, Math.floor(wealthBasedLoot * 0.10)),
            copper: Math.min(LOOT_CAPS.copper, Math.floor(wealthBasedLoot * 0.05)),
            cloth: Math.min(LOOT_CAPS.cloth, Math.floor(wealthBasedLoot * 0.05)),
            tools: Math.min(LOOT_CAPS.tools, Math.floor(wealthBasedLoot * 0.05)),
        };

        // Remove zero or negative values
        Object.keys(loot).forEach(key => {
            if (loot[key] <= 0) delete loot[key];
        });
    }

    return {
        victory,
        decisive,
        attackerPower: Math.floor(attackerPower),
        defenderPower: Math.floor(defenderPower),
        attackerAdvantage: (attackerAdvantage * 100).toFixed(1),
        defenderAdvantage: (defenderAdvantage * 100).toFixed(1),
        attackerLosses,
        defenderLosses,
        attackerCounter: attackerCounter.counterCount,
        defenderCounter: defenderCounter.counterCount,
        loot,
        battleReport: generateBattleReport({
            victory,
            decisive,
            attackerPower,
            defenderPower,
            attackerCounter: attackerCounter.counterCount,
            defenderCounter: defenderCounter.counterCount,
            attackerLosses,
            defenderLosses,
            loot
        })
    };
};

// 生成战斗报告
const generateBattleReport = (data) => {
    const { victory, decisive, attackerPower, defenderPower, attackerCounter, defenderCounter, attackerLosses, defenderLosses, loot } = data;

    let report = [];

    if (victory) {
        if (decisive) {
            report.push('🎉 压倒性胜利！敌军溃不成军！');
        } else {
            report.push('✓ 艰难的胜利，我军成功击退敌人。');
        }
    } else {
        if (decisive) {
            report.push('💀 惨败！我军遭受重创！');
        } else {
            report.push('✗ 战败，我军被迫撤退。');
        }
    }

    report.push(`战斗力对比：我方 ${Math.floor(attackerPower)} vs 敌方 ${Math.floor(defenderPower)}`);

    if (attackerCounter > 0) {
        report.push(`✓ 我方兵种克制生效 ${attackerCounter} 次`);
    }
    if (defenderCounter > 0) {
        report.push(`✗ 敌方兵种克制生效 ${defenderCounter} 次`);
    }

    const totalAttackerLoss = Object.values(attackerLosses).reduce((sum, val) => sum + val, 0);
    const totalDefenderLoss = Object.values(defenderLosses).reduce((sum, val) => sum + val, 0);

    report.push(`我方损失：${totalAttackerLoss} 人`);
    report.push(`敌方损失：${totalDefenderLoss} 人`);

    if (victory && loot) {
        const lootItems = Object.entries(loot).filter(([, v]) => v > 0).map(([key, value]) => `${key} ${value}`).join(', ');
        if (lootItems) {
            report.push(`掠夺资源：${lootItems}`);
        }
    }

    return report;
};

// 计算军队维护成本
export const calculateArmyMaintenance = (army) => {
    const maintenance = {};

    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;

        const unit = UNIT_TYPES[unitId];
        if (!unit) return;

        Object.entries(unit.maintenanceCost).forEach(([resource, cost]) => {
            maintenance[resource] = (maintenance[resource] || 0) + (cost * count);
        });
    });

    return maintenance;
};

// 计算军队所需军事容量（每个单位占用1点容量）
export const calculateArmyCapacityNeed = (army) => {
    let totalCapacity = 0;

    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;

        const unit = UNIT_TYPES[unitId];
        if (!unit) return;

        // 每个单位占用1点军事容量
        totalCapacity += count;
    });

    return totalCapacity;
};


// 计算军队人口占用
export const calculateArmyPopulation = (army) => {
    let totalPopulation = 0;

    Object.entries(army).forEach(([unitId, count]) => {
        if (count <= 0) return;

        const unit = UNIT_TYPES[unitId];
        if (!unit) return;

        totalPopulation += unit.populationCost * count;
    });

    return totalPopulation;
};

/**
 * 计算军队规模惩罚系数
 * 军队占人口比例越高，维护成本越高
 * @param {number} armyPopulation - 军队人口占用
 * @param {number} totalPopulation - 总人口
 * @returns {number} 规模惩罚系数 (1.0 ~ 2.0+)
 */
export const calculateArmyScalePenalty = (armyPopulation, totalPopulation) => {
    if (totalPopulation <= 0 || armyPopulation <= 0) return 1.0;

    const armyRatio = armyPopulation / totalPopulation;

    // 规模惩罚表：
    // 0-10%: ×1.0
    // 10-20%: ×1.25
    // 20-30%: ×1.5
    // 30-40%: ×1.75
    // 40%+: ×2.0+

    if (armyRatio <= 0.10) {
        return 1.0;
    } else if (armyRatio <= 0.20) {
        return 1.0 + (armyRatio - 0.10) * 2.5; // 0.10->1.0, 0.20->1.25
    } else if (armyRatio <= 0.30) {
        return 1.25 + (armyRatio - 0.20) * 2.5; // 0.20->1.25, 0.30->1.5
    } else if (armyRatio <= 0.40) {
        return 1.5 + (armyRatio - 0.30) * 2.5; // 0.30->1.5, 0.40->1.75
    } else {
        // 40%以上继续线性增加
        return 1.75 + (armyRatio - 0.40) * 2.5;
    }
};

// 默认资源价格，当市场价格不可用时使用
const DEFAULT_RESOURCE_PRICES = {
    food: 1,
    silver: 1,
    wood: 0.8,
    stone: 0.6,
    copper: 2,
    iron: 3,
    tools: 5,
    coal: 2,
    steel: 8,
    swords: 20,
    plate_armor: 35,
    gunpowder: 18,
    muskets: 30,
    rifles: 45,
    ammunition: 15,
    ordnance: 60
};

/**
 * 计算单个单位的预估每日军费（包含资源成本和时代加成）
 * @param {Object} unit - 单位对象
 * @param {Object} priceMap - 资源价格映射 {resource: price}
 * @param {number} epoch - 当前时代
 * @param {number} wageMultiplier - 军饷倍率
 * @returns {number} 预估每日军费（银币）
 */
export const calculateUnitExpense = (unit, priceMap = {}, epoch = 0, wageMultiplier = 1) => {
    if (!unit || !unit.maintenanceCost) return 0;

    let resourceCost = 0;

    Object.entries(unit.maintenanceCost).forEach(([resource, amount]) => {
        if (resource === 'silver') {
            // 银币直接加
            resourceCost += amount;
        } else {
            // 其他资源按市场价折算
            const price = priceMap[resource] || DEFAULT_RESOURCE_PRICES[resource] || 1;
            resourceCost += amount * price;
        }
    });

    // 时代加成：每时代+10%维护成本
    const epochMultiplier = 1 + epoch * 0.1;

    // 应用军饷倍率（最低0.5）
    const effectiveWageMultiplier = Math.max(0.5, wageMultiplier);

    return resourceCost * epochMultiplier * effectiveWageMultiplier;
};

/**
 * 计算军队资源维护成本（按市场价折算为银币）
 * @param {Object} army - 军队对象 {unitId: count}
 * @param {Object} priceMap - 资源价格映射 {resource: price}
 * @param {number} epoch - 当前时代
 * @returns {Object} { resourceCost, epochMultiplier, totalCost }
 */
export const calculateArmyMaintenanceCost = (army, priceMap = {}, epoch = 0) => {
    const maintenance = calculateArmyMaintenance(army);

    let resourceCost = 0;
    const costBreakdown = {};

    Object.entries(maintenance).forEach(([resource, amount]) => {
        if (resource === 'silver') {
            // 银币直接加
            resourceCost += amount;
            costBreakdown[resource] = amount;
        } else {
            // 其他资源按市场价折算
            const price = priceMap[resource] || DEFAULT_RESOURCE_PRICES[resource] || 1;
            const cost = amount * price;
            resourceCost += cost;
            costBreakdown[resource] = cost;
        }
    });

    // 时代加成：每时代+10%维护成本
    const epochMultiplier = 1 + epoch * 0.1;
    const totalCost = resourceCost * epochMultiplier;

    return {
        resourceCost,      // 基础资源成本
        epochMultiplier,   // 时代系数
        totalCost,         // 包含时代加成的总成本
        breakdown: costBreakdown
    };
};

/**
 * 计算军队总维护支出（包含规模惩罚）
 * @param {Object} army - 军队对象
 * @param {Object} priceMap - 资源价格映射
 * @param {number} epoch - 当前时代
 * @param {number} totalPopulation - 总人口
 * @param {number} wageMultiplier - 军饷倍率
 * @returns {Object} 完整的军费计算结果
 */
export const calculateTotalArmyExpense = (army, priceMap = {}, epoch = 0, totalPopulation = 100, wageMultiplier = 1) => {
    const armyPopulation = calculateArmyPopulation(army);
    const armyCount = Object.values(army).reduce((sum, count) => sum + count, 0);

    // 1. 计算资源维护成本
    const maintenanceCost = calculateArmyMaintenanceCost(army, priceMap, epoch);

    // 2. 计算规模惩罚
    const scalePenalty = calculateArmyScalePenalty(armyPopulation, totalPopulation);

    // 3. 应用军饷倍率
    const effectiveWageMultiplier = Math.max(0.5, wageMultiplier);

    // 4. 总军费 = 资源成本(含时代加成) × 规模惩罚 × 军饷倍率
    const totalExpense = maintenanceCost.totalCost * scalePenalty * effectiveWageMultiplier;

    return {
        dailyExpense: totalExpense,
        resourceCost: maintenanceCost.resourceCost,
        epochMultiplier: maintenanceCost.epochMultiplier,
        scalePenalty,
        wageMultiplier: effectiveWageMultiplier,
        armyCount,
        armyPopulation,
        breakdown: maintenanceCost.breakdown
    };
};
