import { BUILDINGS } from './buildings';
import { STRATA } from './strata';

/**
 * 政体配置
 * 定义政体的判定条件和效果
 * 
 * 判定条件 (conditions) 说明:
 * - priority: 优先级 (数值越大越优先判定)
 * - minSize: 最小联盟成员数
 * - maxSize: 最大联盟成员数
 * - exactCoalition:精确匹配联盟成员 (数组)
 * - includes: 必须包含的阶层 (数组)
 * - excludes: 必须不包含的阶层 (数组)
 * - includesAny: 必须包含其中任意一个阶层 (数组)
 * - minCategoryShare: 分类影响力占比最小值 { category: threshold }
 * - minTotalShare: 总影响力占比最小值 [{ categories: [], threshold: 0 }]
 * - includesGroup: 必须包含指定组的成员 ['upper', 'middle', 'lower'] (需全部包含至少一个)
 * - matchAll: 必须满足所有项 (默认)
 * 
 * 效果 (effects) 说明:
 * - categories: 产业类别产出修正 { gather: 0.1 }
 * - buildingProductionMod: 特定建筑产出修正 { farm: 0.15 }
 * - production: 全局生产效率
 * - industry: 工业产出
 * - taxIncome: 税收收入
 * - scienceBonus, cultureBonus, militaryBonus: 科研/文化/军事修正
 * - stability: 稳定度
 * - maxPop: 人口上限
 * - resourceDemandMod, stratumDemandMod: 需求修正
 * 
 * 官员偏好 (officialPreferences) 说明:
 * - stratumWeights: { stratumKey: multiplier } 出身阶层权重乘数 (>1 提高概率, <1 降低概率)
 * - statBonuses: { statKey: bonus } 额外属性加成 (叠加到对应属性值上)
 *   statKey 可选: administrative, military, diplomacy, prestige
 */

export const POLITY_DEFINITIONS = [
    // ============================================
    // 1. 单一阶层专制 (优先级 1000)
    // ============================================
    {
        name: '封建地主专制',
        priority: 1000,
        description: '由大地主阶级独揽政权',
        icon: 'Castle',
        color: 'text-amber-500',
        conditions: { exactCoalition: ['landowner'] },
        effects: {
            categories: { gather: 0.15 },
            buildingProductionMod: { farm: 0.2, large_estate: 0.2 },
            resourceDemandMod: { food: -0.1 },
        },
        officialPreferences: {
            stratumWeights: { landowner: 2.5, peasant: 1.5 },
            statBonuses: { administrative: 8, prestige: 10 },
        },
    },
    {
        name: '垄断资本独裁',
        priority: 1000,
        description: '资本家独占国家权力',
        icon: 'Briefcase',
        color: 'text-blue-400',
        conditions: { exactCoalition: ['capitalist'] },
        effects: {
            industry: 0.2,
            buildingProductionMod: { factory: 0.25, steel_works: 0.2 },
            taxIncome: 0.15,
        },
        officialPreferences: {
            stratumWeights: { capitalist: 2.5, merchant: 1.8, engineer: 1.3 },
            statBonuses: { administrative: 10 },
        },
    },
    {
        name: '官僚集权',
        priority: 1000,
        description: '官僚阶层垄断政权',
        icon: 'ScrollText',
        color: 'text-purple-400',
        conditions: { exactCoalition: ['official'] },
        effects: {
            production: 0.1,
            taxIncome: 0.12,
            cultureBonus: 0.08,
            officialCapacity: 5, // 官僚集权大幅增加官员容量
        },
        officialPreferences: {
            stratumWeights: { scribe: 2.5, merchant: 1.3 },
            statBonuses: { administrative: 12, prestige: 5 },
        },
    },
    {
        name: '商业寡头政治',
        priority: 1000,
        description: '商人阶层掌控国家',
        icon: 'Coins',
        color: 'text-yellow-400',
        conditions: { exactCoalition: ['merchant'] },
        effects: {
            buildingProductionMod: { market: 0.25, trade_port: 0.2, trading_post: 0.15 },
            taxIncome: 0.15,
        },
        officialPreferences: {
            stratumWeights: { merchant: 2.5, navigator: 1.8, capitalist: 1.3 },
            statBonuses: { diplomacy: 10, administrative: 5 },
        },
    },
    {
        name: '神权政治',
        priority: 1000,
        description: '神职人员统治国家',
        icon: 'Cross',
        color: 'text-indigo-400',
        conditions: { exactCoalition: ['cleric'] },
        effects: {
            cultureBonus: 0.25,
            stability: 0.1,
            scienceBonus: -0.15,
        },
        officialPreferences: {
            stratumWeights: { cleric: 2.5, scribe: 1.3 },
            statBonuses: { prestige: 12, diplomacy: 5 },
        },
    },
    {
        name: '军人专政',
        priority: 1000,
        description: '军队独揽大权',
        icon: 'Swords',
        color: 'text-red-400',
        conditions: { exactCoalition: ['soldier'] },
        effects: {
            militaryBonus: 0.3,
            buildingProductionMod: { barracks: 0.25, fortress: 0.2 },
            stability: -0.05,
        },
        officialPreferences: {
            stratumWeights: { soldier: 3.0, landowner: 1.5 },
            statBonuses: { military: 15, prestige: 5 },
        },
    },
    {
        name: '工人无产阶级专政',
        priority: 1000,
        description: '工人阶级独揽政权',
        icon: 'Hammer',
        color: 'text-red-600',
        conditions: { exactCoalition: ['worker'] },
        effects: {
            industry: 0.18,
            stratumDemandMod: { worker: -0.12 },
            taxIncome: -0.1,
        },
        officialPreferences: {
            stratumWeights: { worker: 2.5, artisan: 1.5, engineer: 1.3 },
            statBonuses: { administrative: 5 },
        },
    },
    {
        name: '农民专政',
        priority: 1000,
        description: '农民阶级掌控政权',
        icon: 'Wheat',
        color: 'text-green-500',
        conditions: { exactCoalition: ['peasant'] },
        effects: {
            categories: { gather: 0.2 },
            buildingProductionMod: { farm: 0.18 },
            resourceDemandMod: { food: -0.1 },
        },
        officialPreferences: {
            stratumWeights: { peasant: 2.5, landowner: 1.5 },
            statBonuses: { prestige: 5 },
        },
    },
    {
        name: '技术官僚政治',
        priority: 1000,
        description: '工程师主导国家',
        icon: 'Cog',
        color: 'text-cyan-400',
        conditions: { exactCoalition: ['engineer'] },
        effects: {
            scienceBonus: 0.25,
            industry: 0.12,
            buildingProductionMod: { library: 0.2, university: 0.25 },
            officialCapacity: 4, // 技术官僚政治增加官员容量
        },
        officialPreferences: {
            stratumWeights: { engineer: 2.5, scribe: 1.5 },
            statBonuses: { administrative: 10 },
        },
    },
    {
        name: '学者治国',
        priority: 1000,
        description: '知识分子掌权',
        icon: 'Feather',
        color: 'text-blue-300',
        conditions: { exactCoalition: ['scribe'] },
        effects: {
            scienceBonus: 0.2,
            cultureBonus: 0.15,
            militaryBonus: -0.1,
        },
        officialPreferences: {
            stratumWeights: { scribe: 2.5, engineer: 1.3, cleric: 1.2 },
            statBonuses: { administrative: 8, diplomacy: 5 },
        },
    },
    {
        name: '行会共和',
        priority: 1000,
        description: '工匠行会主政',
        icon: 'Anvil',
        color: 'text-orange-400',
        conditions: { exactCoalition: ['artisan'] },
        effects: {
            buildingProductionMod: { loom_house: 0.25, furniture_workshop: 0.2, tailor_workshop: 0.15 },
            industry: 0.15,
        },
        officialPreferences: {
            stratumWeights: { artisan: 2.5, merchant: 1.3 },
            statBonuses: { administrative: 5 },
        },
    },
    {
        name: '海上共和国',
        priority: 1000,
        description: '航海家主导政权',
        icon: 'Compass',
        color: 'text-teal-400',
        conditions: { exactCoalition: ['navigator'] },
        effects: {
            buildingProductionMod: { dockyard: 0.3, trade_port: 0.25 },
            taxIncome: 0.1,
        },
        officialPreferences: {
            stratumWeights: { navigator: 2.5, merchant: 1.8 },
            statBonuses: { diplomacy: 10 },
        },
    },
    {
        name: '矿业工人政权',
        priority: 1000,
        description: '矿工阶级执政',
        icon: 'Pickaxe',
        color: 'text-gray-400',
        conditions: { exactCoalition: ['miner'] },
        effects: {
            buildingProductionMod: { mine: 0.3, quarry: 0.25 },
            categories: { gather: 0.15 },
        },
        officialPreferences: {
            stratumWeights: { worker: 2.0, artisan: 1.5 },
            statBonuses: { administrative: 5 },
        },
    },
    {
        name: '农奴起义政权',
        priority: 1000,
        description: '佃农阶级执政',
        icon: 'Users',
        color: 'text-brown-400',
        conditions: { exactCoalition: ['serf'] },
        effects: {
            categories: { gather: 0.12 },
            stratumDemandMod: { serf: -0.1 },
            stability: -0.1,
        },
        officialPreferences: {
            stratumWeights: { peasant: 2.0, worker: 1.5 },
        },
    },
    {
        name: '林业工人政权',
        priority: 1000,
        description: '樵夫阶级执政',
        icon: 'Trees',
        color: 'text-green-600',
        conditions: { exactCoalition: ['lumberjack'] },
        effects: {
            buildingProductionMod: { lumber_camp: 0.3 },
            categories: { gather: 0.12 },
        },
        officialPreferences: {
            stratumWeights: { peasant: 2.0, worker: 1.5 },
        },
    },
    {
        name: '技术工人苏维埃',
        priority: 1000,
        description: '技术工人阶层独揽政权，以工业技术为国家核心',
        icon: 'Wrench',
        color: 'text-cyan-500',
        conditions: { exactCoalition: ['technician'] },
        effects: {
            industry: 0.20,
            buildingProductionMod: { factory: 0.15, chemical_plant: 0.20 },
            stratumDemandMod: { technician: -0.10 },
        },
        officialPreferences: {
            stratumWeights: { engineer: 2.0, worker: 1.5, artisan: 1.3 },
            statBonuses: { administrative: 8 },
        },
    },
    {
        name: '科学家委员会',
        priority: 1000,
        description: '顶尖科学家主导国家，以知识与研究为最高权威',
        icon: 'Microscope',
        color: 'text-violet-400',
        conditions: { exactCoalition: ['scientist'] },
        effects: {
            scienceBonus: 0.30,
            buildingProductionMod: { university: 0.25, research_institute: 0.30 },
            militaryBonus: -0.10,
            officialCapacity: 3,
        },
        officialPreferences: {
            stratumWeights: { engineer: 2.0, scribe: 1.8 },
            statBonuses: { administrative: 10, diplomacy: 5 },
        },
    },
    // 单一阶层兜底 (优先级 999)
    {
        name: '独裁政体',
        priority: 999,
        description: '单一阶层执政',
        icon: 'Crown',
        color: 'text-amber-400',
        conditions: { maxSize: 1 },
        effects: {
            stability: -0.05,
            taxIncome: 0.05,
            officialCapacity: 2, // 独裁政体少量增加官员容量
        }
    },

    // ============================================
    // 2. 特定组合政体 (优先级 900)
    // ============================================
    // 工农联盟
    {
        name: '工农联合政府',
        priority: 910,
        description: '工人和农民阶级联合执政',
        icon: 'Handshake',
        color: 'text-red-500',
        conditions: {
            includes: ['worker', 'peasant'],
            minCategoryShare: { proletariat: 0.7 },
            maxSize: 2
        },
        effects: {
            categories: { gather: 0.12 },
            industry: 0.1,
            stratumDemandMod: { peasant: -0.08, worker: -0.08 },
        },
        officialPreferences: {
            stratumWeights: { worker: 2.0, peasant: 2.0, artisan: 1.3 },
        },
    },
    {
        name: '人民民主专政',
        priority: 900,
        description: '以工农联盟为基础的人民政权',
        icon: 'Users',
        color: 'text-red-600',
        conditions: {
            includes: ['worker', 'peasant'],
            minCategoryShare: { proletariat: 0.7 }
        },
        effects: {
            categories: { gather: 0.1 },
            industry: 0.12,
            stratumDemandMod: { peasant: -0.15, worker: -0.15 },
            taxIncome: -0.15,
        },
        officialPreferences: {
            stratumWeights: { worker: 2.0, peasant: 1.8 },
        },
    },

    // 资产阶级民主
    {
        name: '资产阶级共和国',
        priority: 900,
        description: '资产阶级主导的民主政体',
        icon: 'Building2',
        color: 'text-blue-400',
        conditions: {
            minCategoryShare: { bourgeoisie: 0.6 },
            excludes: ['landowner'],
            includesAny: ['worker', 'artisan']
        },
        effects: {
            industry: 0.15,
            taxIncome: 0.12,
            buildingProductionMod: { market: 0.1 },
            officialCapacity: 3, // 资产阶级共和国增加官员容量
        },
        officialPreferences: {
            stratumWeights: { capitalist: 2.0, merchant: 1.8, engineer: 1.3 },
            statBonuses: { administrative: 8 },
        },
    },
    {
        name: '资本主义寡头政治',
        priority: 890, // Fallback for Bourgeoisie
        description: '资产阶级独占政权',
        icon: 'Briefcase',
        color: 'text-blue-500',
        conditions: {
            minCategoryShare: { bourgeoisie: 0.6 },
            excludes: ['landowner']
        },
        effects: {
            industry: 0.18,
            taxIncome: 0.18,
            buildingProductionMod: { factory: 0.2 },
        },
        officialPreferences: {
            stratumWeights: { capitalist: 2.5, merchant: 1.5 },
            statBonuses: { administrative: 8 },
        },
    },

    // 贵族联盟
    {
        name: '封建神权联盟',
        priority: 900,
        description: '传统贵族与教会联合执政',
        icon: 'Crown',
        color: 'text-purple-500',
        conditions: {
            minCategoryShare: { aristocracy: 0.6 },
            includes: ['cleric']
        },
        effects: {
            categories: { gather: 0.12 },
            cultureBonus: 0.15,
            stability: 0.08,
            scienceBonus: -0.1,
        },
        officialPreferences: {
            stratumWeights: { cleric: 2.0, landowner: 2.0, scribe: 1.2 },
            statBonuses: { prestige: 10 },
        },
    },
    {
        name: '贵族寡头政治',
        priority: 890, // Fallback for Aristocracy
        description: '传统贵族阶层联合执政',
        icon: 'Castle',
        color: 'text-amber-500',
        conditions: {
            minCategoryShare: { aristocracy: 0.6 }
        },
        effects: {
            categories: { gather: 0.1 },
            taxIncome: 0.12,
            stratumDemandMod: { landowner: 0.1 },
        },
        officialPreferences: {
            stratumWeights: { landowner: 2.0, cleric: 1.5, merchant: 1.2 },
            statBonuses: { prestige: 8 },
        },
    },

    // 军政府
    {
        name: '军事-精英联盟',
        priority: 900,
        description: '军队与精英阶层联合执政',
        icon: 'Shield',
        color: 'text-red-500',
        conditions: {
            minCategoryShare: { military: 0.5 },
            includesAny: ['capitalist', 'landowner']
        },
        effects: {
            militaryBonus: 0.2,
            buildingProductionMod: { barracks: 0.15 },
            taxIncome: 0.08,
        },
        officialPreferences: {
            stratumWeights: { soldier: 2.5, capitalist: 1.5, landowner: 1.3 },
            statBonuses: { military: 12, prestige: 5 },
        },
    },
    {
        name: '军人政府',
        priority: 890, // Fallback for Military
        description: '军事力量主导的政权',
        icon: 'Swords',
        color: 'text-red-600',
        conditions: {
            minCategoryShare: { military: 0.5 }
        },
        effects: {
            militaryBonus: 0.22,
            buildingProductionMod: { barracks: 0.2 },
            stability: -0.03,
        },
        officialPreferences: {
            stratumWeights: { soldier: 2.8, landowner: 1.3 },
            statBonuses: { military: 12 },
        },
    },

    // 神权贵族联盟
    {
        name: '神权封建王国',
        priority: 900,
        description: '地主与神职人员联合，以土地和信仰双重统治',
        icon: 'Crown',
        color: 'text-purple-600',
        conditions: {
            includes: ['landowner', 'cleric'],
            maxSize: 2,
        },
        effects: {
            categories: { gather: 0.15 },
            cultureBonus: 0.18,
            stability: 0.12,
            scienceBonus: -0.12,
            buildingProductionMod: { farm: 0.12, large_estate: 0.12 },
        },
        officialPreferences: {
            stratumWeights: { cleric: 2.0, landowner: 2.0 },
            statBonuses: { prestige: 10, diplomacy: 5 },
        },
    },

    // 商业帝国
    {
        name: '商业帝国',
        priority: 900,
        description: '商人与航海家联合，以贸易和海权主导国家',
        icon: 'Ship',
        color: 'text-teal-500',
        conditions: {
            includes: ['merchant', 'navigator'],
            maxSize: 2,
        },
        effects: {
            buildingProductionMod: { market: 0.2, trade_port: 0.25, dockyard: 0.2 },
            taxIncome: 0.20,
            militaryBonus: 0.08,
        },
        officialPreferences: {
            stratumWeights: { merchant: 2.0, navigator: 2.0, capitalist: 1.3 },
            statBonuses: { diplomacy: 10 },
        },
    },

    // 工业资本-军事联盟
    {
        name: '军国主义帝国',
        priority: 900,
        description: '资本家与军人联合，以工业力量支撑军事扩张',
        icon: 'Shield',
        color: 'text-red-700',
        conditions: {
            includes: ['capitalist', 'soldier'],
            maxSize: 2,
        },
        effects: {
            militaryBonus: 0.25,
            industry: 0.12,
            buildingProductionMod: { factory: 0.15, barracks: 0.2 },
            stability: -0.05,
        },
        officialPreferences: {
            stratumWeights: { soldier: 2.5, capitalist: 2.0 },
            statBonuses: { military: 12, administrative: 5 },
        },
    },

    // 科技联盟（信息时代）
    {
        name: '科技共和国',
        priority: 900,
        description: '技术工人与科学家联合，以技术创新驱动国家',
        icon: 'Atom',
        color: 'text-violet-500',
        conditions: {
            includes: ['technician', 'scientist'],
            maxSize: 2,
        },
        effects: {
            scienceBonus: 0.25,
            industry: 0.15,
            buildingProductionMod: { factory: 0.12, research_institute: 0.25, chemical_plant: 0.15 },
            stratumDemandMod: { technician: -0.08, scientist: -0.08 },
        },
        officialPreferences: {
            stratumWeights: { engineer: 2.0, scribe: 1.5 },
            statBonuses: { administrative: 10 },
        },
    },

    // 知识精英联盟
    {
        name: '知识精英共和国',
        priority: 900,
        description: '学者、工程师与科学家联合，以知识和技术治国',
        icon: 'GraduationCap',
        color: 'text-blue-500',
        conditions: {
            includes: ['scribe', 'engineer', 'scientist'],
        },
        effects: {
            scienceBonus: 0.30,
            cultureBonus: 0.15,
            buildingProductionMod: { library: 0.2, university: 0.25, research_institute: 0.2 },
            officialCapacity: 5,
            militaryBonus: -0.08,
        },
        officialPreferences: {
            stratumWeights: { scribe: 2.0, engineer: 2.0 },
            statBonuses: { administrative: 10, diplomacy: 5 },
        },
    },

    // 工业三角联盟
    {
        name: '工业三角同盟',
        priority: 900,
        description: '工人、技术工人与资本家联合，形成完整工业体系',
        icon: 'Factory',
        color: 'text-orange-600',
        conditions: {
            includes: ['worker', 'technician', 'capitalist'],
        },
        effects: {
            industry: 0.22,
            buildingProductionMod: { factory: 0.20, chemical_plant: 0.18, steel_works: 0.15 },
            taxIncome: 0.10,
            stratumDemandMod: { worker: -0.06 },
        },
        officialPreferences: {
            stratumWeights: { capitalist: 1.8, engineer: 1.5, worker: 1.5 },
            statBonuses: { administrative: 8 },
        },
    },

    // 官商联盟
    {
        name: '官商勾结政府',
        priority: 900,
        description: '官员与商人相互勾连，以行政权力保护商业利益',
        icon: 'Handshake',
        color: 'text-yellow-600',
        conditions: {
            includes: ['official', 'merchant'],
            maxSize: 2,
        },
        effects: {
            taxIncome: 0.18,
            buildingProductionMod: { market: 0.18, trade_port: 0.15 },
            cultureBonus: 0.08,
            stability: -0.05,
            officialCapacity: 4,
        },
        officialPreferences: {
            stratumWeights: { merchant: 2.0, scribe: 1.8, capitalist: 1.5 },
            statBonuses: { administrative: 10, diplomacy: 5 },
        },
    },

    // 工匠-商人联盟（前工业时代）
    {
        name: '行会商业共和',
        priority: 900,
        description: '工匠行会与商人阶层联合，以手工业和贸易为基础',
        icon: 'Anvil',
        color: 'text-amber-600',
        conditions: {
            includes: ['artisan', 'merchant'],
            maxSize: 2,
        },
        effects: {
            buildingProductionMod: { loom_house: 0.2, furniture_workshop: 0.18, market: 0.15 },
            industry: 0.12,
            taxIncome: 0.10,
        },
        officialPreferences: {
            stratumWeights: { artisan: 2.0, merchant: 2.0 },
            statBonuses: { administrative: 5, diplomacy: 5 },
        },
    },

    // ============================================
    // 3. 大联盟政体 (优先级 800)
    // 必须 size >= 5
    // ============================================
    {
        name: '全民联合政府',
        priority: 850,
        description: '跨越阶级的广泛联盟',
        icon: 'Globe',
        color: 'text-green-400',
        conditions: {
            minSize: 8,
            includesGroup: ['upper', 'middle', 'lower']
        },
        effects: {
            production: 0.08,
            stratumDemandMod: { peasant: -0.05, worker: -0.05 },
            stability: 0.12,
            officialCapacity: 4, // 全民联合政府增加官员容量
        }
    },
    {
        name: '民族团结政府',
        priority: 840,
        description: '各阶层联合执政',
        icon: 'Users',
        color: 'text-teal-400',
        conditions: {
            minSize: 5,
            includesGroup: ['upper', 'middle', 'lower']
        },
        effects: {
            production: 0.05,
            stability: 0.1,
            maxPop: 15,
        }
    },
    {
        name: '人民阵线',
        priority: 830,
        description: '以劳动阶层为主体的广泛联盟',
        icon: 'Flag',
        color: 'text-red-500',
        conditions: {
            minSize: 5,
            minCategoryShare: { proletariat: 0.5 }
        },
        effects: {
            categories: { gather: 0.1 },
            industry: 0.1,
            stratumDemandMod: { peasant: -0.1, worker: -0.1 },
        },
        officialPreferences: {
            stratumWeights: { worker: 1.5, peasant: 1.5 },
        },
    },
    {
        name: '大联盟政府',
        priority: 800, // Fallback for Large Coalition
        description: '多阶层联合执政',
        icon: 'Users',
        color: 'text-blue-400',
        conditions: { minSize: 5 },
        effects: {
            production: 0.05,
            stability: 0.05,
        }
    },

    // ============================================
    // 4. 产业主导政体 (优先级 700)
    // ============================================
    {
        name: '工业资本主义政府',
        priority: 700,
        description: '工业资产阶级主导',
        icon: 'Factory',
        color: 'text-blue-500',
        conditions: {
            minCategoryShare: { industrial: 0.6 },
            includes: ['capitalist']
        },
        effects: {
            industry: 0.2,
            buildingProductionMod: { factory: 0.18 },
            taxIncome: 0.12,
            resourceDemandMod: { food: 0.1 },
        },
        officialPreferences: {
            stratumWeights: { capitalist: 2.0, engineer: 1.5, merchant: 1.3 },
            statBonuses: { administrative: 8 },
        },
    },
    {
        name: '劳工联合政府',
        priority: 700,
        description: '工业劳动者联合执政',
        icon: 'Hammer',
        color: 'text-orange-500',
        conditions: {
            minCategoryShare: { industrial: 0.6 },
            includes: ['worker', 'artisan']
        },
        effects: {
            industry: 0.15,
            buildingProductionMod: { loom_house: 0.12 },
            stratumDemandMod: { worker: -0.08, artisan: -0.08 },
        },
        officialPreferences: {
            stratumWeights: { worker: 1.8, artisan: 1.8 },
        },
    },
    {
        name: '地主-农民联盟',
        priority: 700,
        description: '农村阶层联合执政',
        icon: 'Wheat',
        color: 'text-green-500',
        conditions: {
            minCategoryShare: { agrarian: 0.6 },
            includes: ['landowner'],
            minCategoryShare2: { proletariat: 0.001 } // Proletariat share > 0. Hacky key for uniqueness or support multiple. 
            // Better: use specialized condition evaluator that handles multiple checks.
            // But let's simplify: agrarian >= 0.6 AND has landowner AND has any proletariat.
            // Wait, proletariatShare > 0 means has at least one proletariat.
            // I can use `includesAny: [...proletariat_keys]` but proletariat has many.
            // Easier: minCategoryShare supports multiple keys? No.
            // I'll stick to 'minTotalShare' logic? 
            // Let's rely on standard logic: agrarianShare >= 0.6 + has 'landowner' + has 'proletariat' (via minCategoryShare: {proletariat: 0.0001})
        },
        // Re-defining for clean structure:
        conditions: {
            minCategoryShare: { agrarian: 0.6, proletariat: 0.0001 },
            includes: ['landowner']
        },
        effects: {
            categories: { gather: 0.18 },
            buildingProductionMod: { farm: 0.15 },
            resourceDemandMod: { food: -0.08 },
        },
        officialPreferences: {
            stratumWeights: { landowner: 2.0, peasant: 1.5 },
            statBonuses: { prestige: 5 },
        },
    },
    {
        name: '农民政府',
        priority: 690,
        description: '农民阶级主导政权',
        icon: 'Wheat',
        color: 'text-green-600',
        conditions: {
            minCategoryShare: { agrarian: 0.6, proletariat: 0.5 }
        },
        effects: {
            categories: { gather: 0.18 },
            buildingProductionMod: { farm: 0.18 },
            resourceDemandMod: { food: -0.1 },
        },
        officialPreferences: {
            stratumWeights: { peasant: 2.0, landowner: 1.3 },
        },
    },
    {
        name: '商业共和国',
        priority: 700,
        description: '商业阶层主导政权',
        icon: 'Ship',
        color: 'text-teal-400',
        conditions: {
            minCategoryShare: { commercial: 0.5 }
        },
        effects: {
            buildingProductionMod: { market: 0.2, trade_port: 0.18 },
            taxIncome: 0.12,
        },
        officialPreferences: {
            stratumWeights: { merchant: 2.0, navigator: 1.5, capitalist: 1.3 },
            statBonuses: { diplomacy: 8 },
        },
    },
    {
        name: '技术精英政府',
        priority: 700,
        description: '知识分子联合执政',
        icon: 'GraduationCap',
        color: 'text-cyan-400',
        conditions: {
            includes: ['scribe', 'engineer']
        },
        effects: {
            scienceBonus: 0.18,
            industry: 0.1,
            buildingProductionMod: { library: 0.15, university: 0.15 },
            officialCapacity: 3, // 技术精英政府增加官员容量
        },
        officialPreferences: {
            stratumWeights: { scribe: 2.0, engineer: 2.0 },
            statBonuses: { administrative: 8 },
        },
    },
    {
        name: '信息时代民主',
        priority: 700,
        description: '科学家主导的现代民主政体，以知识经济为核心',
        icon: 'Cpu',
        color: 'text-violet-400',
        conditions: {
            minCategoryShare: { intellectual: 0.5 },
            includes: ['scientist'],
        },
        effects: {
            scienceBonus: 0.22,
            buildingProductionMod: { university: 0.18, research_institute: 0.22 },
            officialCapacity: 4,
            militaryBonus: -0.05,
        },
        officialPreferences: {
            stratumWeights: { engineer: 1.8, scribe: 1.5 },
            statBonuses: { administrative: 8, diplomacy: 5 },
        },
    },
    {
        name: '技术工业国家',
        priority: 700,
        description: '技术工人主导的工业政体，以精密制造为国家支柱',
        icon: 'Wrench',
        color: 'text-cyan-600',
        conditions: {
            minCategoryShare: { industrial: 0.6 },
            includes: ['technician'],
        },
        effects: {
            industry: 0.18,
            buildingProductionMod: { factory: 0.15, chemical_plant: 0.18 },
            stratumDemandMod: { technician: -0.08, worker: -0.05 },
        },
        officialPreferences: {
            stratumWeights: { engineer: 2.0, worker: 1.5 },
            statBonuses: { administrative: 8 },
        },
    },
    // ============================================
    {
        name: '无产阶级政府',
        priority: 600,
        description: '劳动人民掌握政权',
        icon: 'Hammer',
        color: 'text-red-500',
        conditions: {
            minCategoryShare: { proletariat: 0.7 }
        },
        effects: {
            categories: { gather: 0.12 },
            industry: 0.12,
            stratumDemandMod: { peasant: -0.1, worker: -0.1 },
            taxIncome: -0.1,
        },
        officialPreferences: {
            stratumWeights: { worker: 2.0, peasant: 1.5 },
        },
    },
    {
        name: '精英联盟政府',
        priority: 600,
        description: '上层阶级联合执政',
        icon: 'Crown',
        color: 'text-amber-400',
        conditions: {
            minTotalShare: [{ categories: ['bourgeoisie', 'aristocracy'], threshold: 0.7 }]
        },
        effects: {
            taxIncome: 0.15,
            stratumDemandMod: { landowner: 0.08, capitalist: 0.08 },
        },
        officialPreferences: {
            stratumWeights: { capitalist: 1.8, landowner: 1.8, merchant: 1.3 },
            statBonuses: { prestige: 8 },
        },
    },

    // ============================================
    // 6. 默认政体 (优先级 100)
    // ============================================
    {
        name: '双头政治',
        priority: 100,
        description: '两个阶层联合执政',
        icon: 'Scale',
        color: 'text-gray-400',
        conditions: { exactSize: 2 },
        effects: { stability: 0.03 }
    },
    {
        name: '三方联盟',
        priority: 100,
        description: '三个阶层共同执政',
        icon: 'Triangle',
        color: 'text-gray-400',
        conditions: { exactSize: 3 },
        effects: { stability: 0.05 }
    },

    // ============================================
    // 0. 最终兜底 (优先级 0)
    // ============================================
    {
        name: '联合政府',
        priority: 0,
        description: '多阶层联合执政',
        icon: 'Users',
        color: 'text-gray-400',
        conditions: {},
        effects: { stability: 0.03 }
    },
    {
        name: '无执政联盟',
        priority: -1, // Special handling in code if coalition is empty
        description: '尚未建立执政联盟，政府缺乏社会基础',
        icon: 'HelpCircle',
        color: 'text-gray-400',
        conditions: { maxSize: 0 },
        effects: {
            production: -0.1,
            taxIncome: -0.2,
            stability: -0.15,
        }
    }
];

// 辅助函数：根据名称获取政体定义
export const getPolityDefinition = (polityName) => {
    return POLITY_DEFINITIONS.find(def => def.name === polityName);
};

export const getPolityEffects = (polityName) => {
    const def = getPolityDefinition(polityName);
    return def ? def.effects : null;
};

/**
 * 根据政体名称获取官员偏好配置
 * @param {string} polityName - 政体名称
 * @returns {Object|null} { stratumWeights: {}, statBonuses: {} } 或 null
 */
export const getPolityOfficialPreferences = (polityName) => {
    const def = getPolityDefinition(polityName);
    return def ? (def.officialPreferences || null) : null;
};

// 复用之前的 formatPolityEffects 函数
export const formatPolityEffects = (effects) => {
    if (!effects) return [];

    const details = [];

    if (effects.categories) {
        Object.entries(effects.categories).forEach(([cat, value]) => {
            const percent = (value * 100).toFixed(0);
            const sign = value >= 0 ? '+' : '';
            const catName = cat === 'gather' ? '采集' : cat === 'industry' ? '工业' : cat;
            details.push({ text: `${catName}类建筑 ${sign}${percent}%`, positive: value >= 0 });
        });
    }

    if (effects.buildingProductionMod) {
        const entries = Object.entries(effects.buildingProductionMod);
        if (entries.length > 0) {
            // Group by percent value to condense output if they are the same
            const byPercent = {};
            entries.forEach(([id, val]) => {
                if (!byPercent[val]) byPercent[val] = [];
                // Helper to get name from BUILDINGS
                const bParams = BUILDINGS.find(b => b.id === id);
                byPercent[val].push(bParams ? bParams.name : id);
            });

            Object.entries(byPercent).forEach(([val, names]) => {
                const percent = (parseFloat(val) * 100).toFixed(0);
                const sign = val >= 0 ? '+' : '';
                const nameStr = names.join('、');
                details.push({ text: `${nameStr}产出 ${sign}${percent}%`, positive: val >= 0 });
            });
        }
    }

    if (effects.production !== undefined) {
        const percent = (effects.production * 100).toFixed(0);
        const sign = effects.production >= 0 ? '+' : '';
        details.push({ text: `全局生产 ${sign}${percent}%`, positive: effects.production >= 0 });
    }

    if (effects.industry !== undefined) {
        const percent = (effects.industry * 100).toFixed(0);
        const sign = effects.industry >= 0 ? '+' : '';
        details.push({ text: `工业产出 ${sign}${percent}%`, positive: effects.industry >= 0 });
    }

    if (effects.taxIncome !== undefined) {
        const percent = (effects.taxIncome * 100).toFixed(0);
        const sign = effects.taxIncome >= 0 ? '+' : '';
        details.push({ text: `税收收入 ${sign}${percent}%`, positive: effects.taxIncome >= 0 });
    }

    if (effects.scienceBonus !== undefined) {
        const percent = (effects.scienceBonus * 100).toFixed(0);
        const sign = effects.scienceBonus >= 0 ? '+' : '';
        details.push({ text: `科研产出 ${sign}${percent}%`, positive: effects.scienceBonus >= 0 });
    }

    if (effects.cultureBonus !== undefined) {
        const percent = (effects.cultureBonus * 100).toFixed(0);
        const sign = effects.cultureBonus >= 0 ? '+' : '';
        details.push({ text: `文化产出 ${sign}${percent}%`, positive: effects.cultureBonus >= 0 });
    }

    if (effects.militaryBonus !== undefined) {
        const percent = (effects.militaryBonus * 100).toFixed(0);
        const sign = effects.militaryBonus >= 0 ? '+' : '';
        details.push({ text: `军事力量 ${sign}${percent}%`, positive: effects.militaryBonus >= 0 });
    }

    if (effects.stability !== undefined) {
        const percent = (effects.stability * 100).toFixed(0);
        const sign = effects.stability >= 0 ? '+' : '';
        details.push({ text: `稳定度 ${sign}${percent}%`, positive: effects.stability >= 0 });
    }

    if (effects.maxPop !== undefined) {
        const sign = effects.maxPop >= 0 ? '+' : '';
        details.push({ text: `人口上限 ${sign}${effects.maxPop}`, positive: effects.maxPop >= 0 });
    }

    if (effects.resourceDemandMod) {
        Object.entries(effects.resourceDemandMod).forEach(([res, value]) => {
            const percent = (value * 100).toFixed(0);
            const sign = value >= 0 ? '+' : '';
            const resName = res === 'food' ? '食物' : res === 'wood' ? '木材' : res;
            details.push({ text: `${resName}需求 ${sign}${percent}%`, positive: value <= 0 }); // 需求减少是好事
        });
    }

    if (effects.stratumDemandMod) {
        const entries = Object.entries(effects.stratumDemandMod);
        if (entries.length > 0) {
            const byPercent = {};
            entries.forEach(([key, val]) => {
                if (!byPercent[val]) byPercent[val] = [];
                byPercent[val].push(STRATA[key]?.name || key);
            });

            Object.entries(byPercent).forEach(([val, names]) => {
                const percent = (parseFloat(val) * 100).toFixed(0);
                const sign = val >= 0 ? '+' : '';
                const nameStr = names.join('、');
                details.push({ text: `${nameStr}消费 ${sign}${percent}%`, positive: val <= 0 });
            });
        }
    }

    if (effects.officialCapacity !== undefined) {
        const sign = effects.officialCapacity >= 0 ? '+' : '';
        details.push({ text: `官员容量 ${sign}${effects.officialCapacity}`, positive: effects.officialCapacity >= 0 });
    }

    return details;
};
