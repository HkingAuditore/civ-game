// 时代配置文件
// 定义游戏中的各个时代及其升级要求和加成效果

/**
 * 时代配置数组
 * 每个时代包含：
 * - id: 时代编号
 * - name: 时代名称
 * - color: 显示颜色（Tailwind类名）
 * - bg: 背景颜色
 * - tileColor: 地图瓦片颜色
 * - req: 升级要求（科研、人口、文化等）
 * - cost: 升级成本（消耗的资源）
 * - bonuses: 时代加成效果
 */
export const EPOCHS = [
    {
        id: 0,
        name: "石器时代",
        color: "text-stone-400",
        bg: "bg-stone-900",
        tileColor: "bg-stone-700",
        req: { science: 0 },
        cost: {},
        bonuses: { desc: "文明的起源，一切从这里开始。" }
    },
    {
        id: 1,
        name: "青铜时代",
        color: "text-orange-400",
        bg: "bg-orange-950",
        tileColor: "bg-orange-800",
        req: { science: 600, population: 25 },
        cost: { food: 6000, wood: 3500, stone: 1200, silver: 600, science: 600 },
        bonuses: {
            desc: "掌握青铜冶炼与畜力生产，采集效率提升。",
            gatherBonus: 0.15,
            militaryBonus: 0.1
        }
    },
    {
        id: 2,
        name: "古典时代",
        color: "text-amber-300",
        bg: "bg-amber-900",
        tileColor: "bg-amber-700",
        req: { science: 1800, population: 90, culture: 250 },
        cost: { food: 20000, wood: 10000, brick: 3600, silver: 5000, tools: 1200, science: 1800 },
        bonuses: {
            desc: "城邦理性与文化盛开，基础设施大幅改善。",
            gatherBonus: 0.2,
            cultureBonus: 0.15,
            scienceBonus: 0.1
        }
    },
    {
        id: 3,
        name: "封建时代",
        color: "text-blue-400",
        bg: "bg-blue-950",
        tileColor: "bg-blue-800",
        req: { science: 4500, population: 170, culture: 600 },
        cost: { food: 100000, wood: 50000, brick: 25000, iron: 12500, papyrus: 5000, silver: 15000, science: 4500 },
        bonuses: {
            desc: "骑士与庄园秩序成熟，文化发展加速。",
            gatherBonus: 0.25,
            cultureBonus: 0.2
        }
    },
    {
        id: 4,
        name: "探索时代",
        color: "text-cyan-300",
        bg: "bg-cyan-900",
        tileColor: "bg-cyan-700",
        req: { science: 8000, population: 320, culture: 1400 },
        cost: { food: 260000, plank: 70000, brick: 60000, iron: 35000, silver: 40000, science: 8000 },
        bonuses: {
            desc: "远洋航行拓展视野，贸易与军事齐头并进。",
            gatherBonus: 0.3,
            scienceBonus: 0.2,
            militaryBonus: 0.1
        }
    },
    {
        id: 5,
        name: "启蒙时代",
        color: "text-purple-400",
        bg: "bg-purple-950",
        tileColor: "bg-purple-800",
        req: { science: 12000, population: 450, culture: 2500 },
        cost: { food: 350000, plank: 80000, papyrus: 30000, spice: 20000, silver: 50000, science: 12000 },
        bonuses: {
            desc: "理性与出版自由蔓延，文化科研全面提升。",
            cultureBonus: 0.3,
            scienceBonus: 0.3
        }
    },
    {
        id: 6,
        name: "工业时代",
        color: "text-gray-200",
        bg: "bg-gray-800",
        tileColor: "bg-gray-600",
        req: { science: 20000, population: 650, culture: 4000 },
        cost: { food: 750000, brick: 180000, iron: 120000, tools: 75000, spice: 30000, silver: 120000, science: 20000 },
        bonuses: {
            desc: "蒸汽与煤铁带来巨量产能。",
            gatherBonus: 0.4,
            industryBonus: 0.5,
            scienceBonus: 0.3
        }
    },
    {
        id: 7,
        name: "信息时代",
        color: "text-green-400",
        bg: "bg-green-950",
        tileColor: "bg-green-800",
        req: { science: 35000, population: 1000, culture: 8000 },
        cost: { food: 2000000, tools: 300000, silver: 250000, spice: 80000, papyrus: 100000, electronics: 150000, science: 35000 },
        bonuses: {
            desc: "数字革命改变世界，知识和信息成为核心生产力。",
            scienceBonus: 0.6,
            cultureBonus: 0.5,
            knowledgeBonus: 0.4
        }
    },
];
