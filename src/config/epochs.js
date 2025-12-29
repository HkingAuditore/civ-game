// 时代配置文件
// 定义游戏中的各个时代及其升级要求和加成效果

/*
 * 时代配置数组
 * Each era contains:
 * - id: Era ID
 * - name: Era Name
 * - color: Display Color (Tailwind class)
 * - bg: Background Color
 * - tileColor: Map Tile Color
 * - req: Upgrade Requirements
 * - cost: Upgrade Costs
 * - bonuses: Era Bonuses
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
        bonuses: {
            desc: "文明的起源，一切从这里开始。",
            gatherBonus: 0.20 // +20% 采集
        }
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
            desc: "掌握青铜冶炼与畜力生产，资源获取加速。",
            gatherBonus: 0.40, // +40%
            militaryBonus: 0.20, // +20%
            industryBonus: 0.20 // +20%
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
            desc: "哲学与艺术的萌芽，文明全方位提升。",
            gatherBonus: 0.60,
            militaryBonus: 0.30,
            cultureBonus: 0.20,
            scienceBonus: 0.20,
            industryBonus: 0.30,
            maxPop: 0.10 // +10% max pop
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
            desc: "封建制度确立，人口与经济快速增长。",
            gatherBonus: 0.80,
            militaryBonus: 0.40,
            cultureBonus: 0.30,
            scienceBonus: 0.30,
            industryBonus: 0.40,
            taxIncome: 0.20 // +20% tax
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
            desc: "大航海开启，贸易与工业蓬勃发展。",
            gatherBonus: 1.20,
            militaryBonus: 0.45,
            cultureBonus: 0.40,
            scienceBonus: 0.50,
            industryBonus: 0.60,
            incomePercent: 0.50 // +50% total income
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
            desc: "理性的光辉照耀，科学与文化大幅提升。",
            gatherBonus: 1.50,
            militaryBonus: 0.50,
            cultureBonus: 0.60,
            scienceBonus: 0.80,
            industryBonus: 1.00,
            stability: 10 // +10 flat stability
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
            desc: "机械化大生产，工业产能爆炸式增长。",
            gatherBonus: 2.00,
            militaryBonus: 0.60,
            cultureBonus: 0.80,
            scienceBonus: 1.20,
            industryBonus: 2.00,
            maxPop: 0.20
        }
    },
    {
        id: 7,
        name: "信息时代",
        color: "text-green-400",
        bg: "bg-green-950",
        tileColor: "bg-green-800",
        req: { science: 35000, population: 1000, culture: 8000 },
        cost: { food: 2000000, tools: 300000, silver: 250000, spice: 80000, papyrus: 100000, science: 35000 },
        bonuses: {
            desc: "数字革命改变世界，知识和信息成为核心生产力。",
            gatherBonus: 3.00,
            militaryBonus: 0.80,
            cultureBonus: 1.50,
            scienceBonus: 3.00,
            industryBonus: 3.00,
            incomePercent: 1.00
        }
    }
];
