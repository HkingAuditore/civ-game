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
            gatherBonus: 0.30 // +30% 采集
        }
    },
    {
        id: 1,
        name: "青铜时代",
        color: "text-orange-400",
        bg: "bg-orange-950",
        tileColor: "bg-orange-800",
        req: { science: 280, population: 15 },
        cost: { food: 3000, wood: 1500, stone: 800, silver: 250, science: 280 },
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
        req: { science: 1800, population: 150 },
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
        req: { science: 4500, population: 400, culture: 600 },
        cost: { food: 100000, wood: 50000, brick: 25000, iron: 12500, papyrus: 5000, silver: 15000, science: 4500 },
        bonuses: {
            desc: "封建制度确立，人口与经济快速增长。",
            gatherBonus: 0.80,
            militaryBonus: 0.40,
            cultureBonus: 0.30,
            scienceBonus: 0.30,
            industryBonus: 0.40,
            taxIncome: 0.10 // +10% tax
        }
    },
    {
        id: 4,
        name: "探索时代",
        color: "text-cyan-300",
        bg: "bg-cyan-900",
        tileColor: "bg-cyan-700",
        req: { science: 8000, population: 900, culture: 1400 },
        cost: { food: 260000, plank: 70000, brick: 60000, iron: 35000, silver: 40000, science: 8000 },
        bonuses: {
            desc: "大航海开启，贸易与工业蓬勃发展。",
            gatherBonus: 1.20,
            militaryBonus: 0.45,
            cultureBonus: 0.40,
            scienceBonus: 0.50,
            industryBonus: 0.60,
            taxIncome: 0.25 // +25% total income
        }
    },
    {
        id: 5,
        name: "启蒙时代",
        color: "text-purple-400",
        bg: "bg-purple-950",
        tileColor: "bg-purple-800",
        req: { science: 12000, population: 1800, culture: 2500 },
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
        name: "蒸汽时代",
        color: "text-gray-200",
        bg: "bg-gray-800",
        tileColor: "bg-gray-600",
        req: { science: 20000, population: 4500, culture: 4000 },
        cost: { food: 750000, brick: 180000, iron: 120000, tools: 75000, spice: 30000, silver: 120000, science: 20000 },
        bonuses: {
            desc: "蒸汽与煤铁带来巨量产能。",
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
        name: "电气时代",
        color: "text-sky-400",
        bg: "bg-sky-950",
        tileColor: "bg-sky-800",
        req: { science: 30000, population: 8000, culture: 6000 },
        cost: { food: 1500000, brick: 350000, iron: 200000, tools: 150000, silver: 280000, steel: 8000, coal: 15000, science: 30000 },
        bonuses: {
            desc: "电力驱动的第二次工业革命。石油化工、电力传输、汽车制造标志着新纪元的到来。",
            gatherBonus: 2.20,
            militaryBonus: 0.70,
            cultureBonus: 1.00,
            scienceBonus: 1.50,
            industryBonus: 2.50,
            taxIncome: 0.15
        }
    },
    {
        id: 8,
        name: "原子时代",
        color: "text-violet-400",
        bg: "bg-violet-950",
        tileColor: "bg-violet-800",
        req: { science: 50000, population: 14000, culture: 12000 },
        cost: { food: 3000000, brick: 600000, iron: 400000, tools: 280000, silver: 600000, steel: 25000, oil: 8000, wiring: 6000, chemicals: 4000, science: 50000 },
        bonuses: {
            desc: "核能释放、电子革命、塑料帝国。人类文明进入超级工业化阶段。",
            gatherBonus: 2.80,
            militaryBonus: 0.80,
            cultureBonus: 1.30,
            scienceBonus: 2.50,
            industryBonus: 3.50,
            taxIncome: 0.18
        }
    },
    {
        id: 9,
        name: "信息时代",
        color: "text-cyan-400",
        bg: "bg-cyan-950",
        tileColor: "bg-cyan-800",
        req: { science: 80000, population: 25000, culture: 22000 },
        cost: { food: 6000000, brick: 1000000, iron: 700000, tools: 500000, silver: 1200000, steel: 60000, oil: 20000, electronics: 5000, plastics: 8000, aluminum: 4000, science: 80000 },
        bonuses: {
            desc: "硅片上的文明。半导体、互联网和可再生能源重塑人类社会。",
            gatherBonus: 3.50,
            militaryBonus: 0.90,
            cultureBonus: 1.60,
            scienceBonus: 4.00,
            industryBonus: 5.00,
            taxIncome: 0.20
        }
    }
];
