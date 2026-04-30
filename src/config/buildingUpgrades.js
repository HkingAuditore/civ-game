// 建筑升级配置
// 定义各建筑的升级路径、费用和效果
// 
// 设计原则：
// 1. 升级项围绕当前基础建筑联动重算，优先保证人均主产出严格递增
// 2. 岗位增量保持克制，不允许靠单纯加岗堆总量掩盖效率倒挂
// 3. 名称：使用符合历史时代的名称

/**
 * 升级配置结构说明：
 * - name: 升级后的建筑名称
 * - cost: 升级所需资源和银币
 * - input: 升级后的资源消耗（完全替代基础值）
 * - output: 升级后的资源产出（完全替代基础值）
 * - jobs: 升级后的岗位需求（完全替代基础值）
 */

export const BUILDING_UPGRADES = {
    // ========== 石器时代建筑 ==========

    // farm: base output 3.2 food, owner: peasant, base jobs: peasant:2
    farm: [
        {
            name: "灌溉田",
            cost: { wood: 50, stone: 20, tools: 5, silver: 300 },
            input: { tools: 0.04, wood: 0.06 }, // modest tool and wood cost
            output: { food: 6.24 }, // 1.3x of base 4.8
            jobs: { peasant: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "精耕田",
            cost: { plank: 80, brick: 40, tools: 15, silver: 800 },
            input: { tools: 0.08, wood: 0.1, fertilizer: 0.08 }, // fertilizer for modern intensive farming
            output: { food: 12.96 }, // 2.7x of base 4.8, fertilizer bonus
            jobs: { peasant: 4 }, // +1 peasant only
        },
    ],

    // lumber_camp: base output 2.56 wood, owner: lumberjack, base jobs: lumberjack:2
    lumber_camp: [
        {
            name: "大伐木场",
            cost: { wood: 80, stone: 30, tools: 10, silver: 250 },
            input: { tools: 0.05, food: 0.15 }, // modest input cost
            output: { wood: 4.992 }, // 1.3x of base 3.84
            jobs: { lumberjack: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "林场",
            cost: { plank: 60, brick: 30, tools: 20, silver: 600 },
            input: { tools: 0.1 }, // tools only, food removed
            output: { wood: 8.64, food: 0.15 }, // 2.25x of base 3.84 + 林场野味
            jobs: { lumberjack: 4 }, // +1 lumberjack only
        },
    ],

    // quarry: base output 2.0 stone, owner: miner, base jobs: miner:2
    quarry: [
        {
            name: "深坑采石场",
            cost: { wood: 80, stone: 50, tools: 15, silver: 300 },
            input: { tools: 0.06, wood: 0.15, food: 0.15 }, // modest input cost
            output: { stone: 3.9 }, // 1.3x of base 3.0
            jobs: { miner: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大采石场",
            cost: { plank: 80, stone: 100, tools: 30, silver: 700 },
            input: { tools: 0.12, wood: 0.25, food: 0.25 }, // reasonable input increase
            output: { stone: 6.75, copper: 0.02 }, // 2.25x of base 3.0 + 伴生矿
            jobs: { miner: 4 }, // +1 miner only
        },
    ],

    // loom_house: base output 1.92 cloth, owner: artisan, base jobs: artisan:3
    loom_house: [
        {
            name: "织布坊",
            cost: { wood: 80, stone: 40, tools: 10, silver: 250 },
            input: { tools: 0.02 },
            output: { cloth: 3.744 }, // 1.3x of base 2.88
            jobs: { peasant: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大织布坊",
            cost: { plank: 60, brick: 40, tools: 20, silver: 600 },
            input: { tools: 0.04, dye: 0.03 }, // 新增染料需求
            output: { cloth: 6.48, culture: 0.05 }, // 2.25x of base 2.88 + 织艺文化
            jobs: { peasant: 4 }, // +1 peasant only
        },
    ],

    // brickworks: base output 3.6 brick, owner: artisan, base jobs: artisan:3
    brickworks: [
        {
            name: "改良砖窑",
            cost: { stone: 80, wood: 40, tools: 15, silver: 300 },
            input: { stone: 1.725, wood: 0.5175, tools: 0.02 },
            output: { brick: 4.68 }, // 1.3x of base 3.6
            jobs: { artisan: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大砖窑",
            cost: { stone: 120, brick: 80, tools: 30, silver: 700 },
            input: { stone: 2.7, wood: 0.81, tools: 0.04 },
            output: { brick: 8.1, tools: 0.02 }, // 2.25x of base 3.6 + 模具生产
            jobs: { artisan: 4 }, // +1 artisan only
        },
    ],

    // stone_tool_workshop: base output tools: 1.0, owner: artisan, base jobs: artisan:3
    // 效率提升型升级：技艺精进，产出提升但岗位不增加
    stone_tool_workshop: [
        {
            name: "工匠铺",
            cost: { stone: 50, wood: 50, silver: 200 },
            input: { wood: 1.65, stone: 1.35 },
            output: { tools: 1.95 },
            jobs: { artisan: 3 },
        },
        {
            name: "大工匠铺",
            cost: { brick: 40, plank: 40, silver: 500 },
            input: { wood: 2.25, stone: 1.8 },
            output: { tools: 2.7 },
            jobs: { artisan: 3 },
        },
    ],

    // trading_post: base output food: 1.5 silver: 2.8, owner: merchant, base jobs: merchant:2
    trading_post: [
        {
            name: "商铺",
            cost: { wood: 100, stone: 40, silver: 400 },
            input: { tools: 0.01 },
            output: { food: 1.95, silver: 3.64 }, // 1.3x of base 1.5 / 2.8
            jobs: { merchant: 2 },
        },
        {
            name: "商会",
            cost: { plank: 80, brick: 60, silver: 900 },
            input: { tools: 0.02, papyrus: 0.01 },
            output: { food: 3.375, silver: 6.3, spice: 0.02 }, // 2.25x of base 1.5 / 2.8 + 异域贸易
            jobs: { merchant: 3 },
        },
    ],

    // library: base output science: 1.0667, owner: cleric, base jobs: cleric:1, scribe:3
    // base input: papyrus: 0.03
    // 效率提升型升级：知识管理优化，产出增加但岗位适度增加
    library: [
        {
            name: "学堂",
            cost: { stone: 150, plank: 40, papyrus: 30, brick: 40, silver: 600, science: 80 },
            input: { papyrus: 0.08 },
            output: { science: 1.3867 }, // 1.3x of base 1.0667
            jobs: { cleric: 1, scribe: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "书院",
            cost: { brick: 120, plank: 60, papyrus: 80, silver: 1400, science: 200 },
            input: { papyrus: 0.15, science: 0.15 },
            output: { science: 2.4, culture: 0.12 }, // 2.25x of base 1.0667 + 文教传承
            jobs: { cleric: 1, scribe: 5 }, // +1 scribe only
        },
    ],

    // ========== 青铜时代建筑 ==========

    // copper_mine: base output 0.5 copper, owner: artisan, base jobs: miner:4 worker:1 artisan:1
    copper_mine: [
        {
            name: "深铜矿",
            cost: { wood: 120, tools: 20, silver: 350 },
            input: { tools: 0.0625, wood: 0.25, food: 0.25 }, // modest input cost
            output: { copper: 1.0834 }, // 1.3x of base 0.6667
            jobs: { miner: 4, worker: 1, artisan: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铜矿",
            cost: { plank: 80, tools: 40, silver: 800 },
            input: { tools: 0.12, wood: 0.42, food: 0.42 }, // reasonable input increase
            output: { copper: 1.8, stone: 0.18 }, // 2.25x of base 0.6667 + 废石利用
            jobs: { miner: 5, worker: 1, artisan: 1 }, // +1 miner only
        },
    ],

    // dye_works:
    // dye_works: base output 0.6 dye, owner: artisan, base jobs: artisan:3
    dye_works: [
        {
            name: "大染坊",
            cost: { wood: 60, stone: 25, tools: 10, silver: 250 },
            input: { food: 0.8, tools: 0.0267 },
            output: { dye: 1.56 }, // 1.3x of base 0.9
            jobs: { artisan: 3, worker: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "染色工坊",
            cost: { plank: 50, brick: 30, tools: 20, silver: 600 },
            input: { food: 1.125, tools: 0.05, cloth: 0.0625 }, // 需要布料样本
            output: { dye: 2.5313, culture: 0.0625 }, // 2.25x of base 0.9 + 染艺文化
            jobs: { artisan: 4, worker: 1 }, // +1 artisan only
        },
    ],

    // sawmill: base output 2.6 plank, owner: artisan, base jobs: artisan:4
    sawmill: [
        {
            name: "水力锯木坊",
            cost: { wood: 120, stone: 40, tools: 15, silver: 350 },
            input: { wood: 1.75, tools: 0.0375 },
            output: { plank: 5.6387 }, // 1.3x of base 3.47
            jobs: { artisan: 4, worker: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大锯木坊",
            cost: { plank: 80, brick: 50, tools: 30, silver: 800 },
            input: { wood: 2.4, tools: 0.072, cloth: 0.06 }, // 需要布料（家具软垫）
            output: { plank: 9.369, furniture: 0.06 }, // 2.25x of base 3.47 + 边角料家具
            jobs: { artisan: 5, worker: 1 }, // +1 artisan only
        },
    ],

    // bronze_foundry: base output 4.0 tools (人均 1.0), owner: artisan, base jobs: worker:3, artisan:1
    // 效率提升型升级：熔炉改良，产出提升但岗位不增加
    bronze_foundry: [
        {
            name: "改良铸坊",
            cost: { stone: 60, copper: 25, silver: 300 },
            input: { copper: 1.93, wood: 1.29, tools: 0.015 },
            output: { tools: 4.60 }, // 人均 1.15
            jobs: { worker: 3, artisan: 1 },
        },
        {
            name: "大铸坊",
            cost: { brick: 50, copper: 40, silver: 700 },
            input: { copper: 2.35, wood: 1.57, tools: 0.03 },
            output: { tools: 5.60 }, // 人均 1.4 (>大工匠铺Lv2 0.9)
            jobs: { worker: 3, artisan: 1 },
        },
    ],

    // amphitheater: base output culture: 5 (人均 1.0), owner: cleric, base jobs: cleric:3 worker:2
    // 早期娱乐建筑，人均上限 ≤ 2.5 以避免压制后期 culture 主产建筑
    amphitheater: [
        {
            name: "大剧场",
            cost: { stone: 120, brick: 40, silver: 400 },
            input: { fine_clothes: 0.05, dye: 0.0125 }, // 同步降低消耗
            output: { culture: 6, silver: 1.2 }, // 人均 2.0 (3 jobs)
            jobs: { cleric: 2, worker: 1 },
        },
        {
            name: "宏伟剧场",
            cost: { brick: 80, furniture: 20, silver: 900 },
            input: { fine_clothes: 0.067, ale: 0.025, dye: 0.021 }, // 同步降低消耗
            output: { culture: 7.5, silver: 2.25 }, // 人均 2.5 (3 jobs)
            jobs: { cleric: 2, worker: 1 },
        },
    ],

    // ========== 古典/封建时代建筑 ==========

    // reed_works: base output 0.6 papyrus, owner: artisan, base jobs: artisan:3
    reed_works: [
        {
            name: "改良造纸坊",
            cost: { wood: 60, tools: 10, silver: 220 },
            input: { tools: 0.0167 },
            output: { papyrus: 1.95 }, // 1.3x of base 0.90
            jobs: { artisan: 3, worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大造纸坊",
            cost: { plank: 50, tools: 20, silver: 500 },
            input: { tools: 0.03 },
            output: { papyrus: 3.0375, science: 0.075 }, // 2.25x of base 0.90 + 研墨副产
            jobs: { artisan: 4, worker: 2 }, // +1 artisan only
        },
    ],

    // culinary_kitchen: base output 1.5 delicacies, owner: artisan, base jobs: artisan:3, worker:1
    culinary_kitchen: [
        {
            name: "精致厨房",
            cost: { brick: 40, tools: 15, cloth: 8, silver: 350 },
            input: { tools: 0.1, food: 1.5 },
            output: { delicacies: 3.25 }, // 1.3x of base 2.00
            jobs: { artisan: 3, worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "御膳房",
            cost: { brick: 60, furniture: 15, delicacies: 20, silver: 800 },
            input: { tools: 0.12, food: 1.8, spice: 0.06 }, // 需要香料
            output: { delicacies: 4.5, culture: 0.08 }, // 2.25x of base 2.00 + 美食文化
            jobs: { artisan: 3, worker: 2 }, // +1 worker only
        },
    ],

    // brewery: base output 1.2 ale, owner: artisan, base jobs: artisan:3
    brewery: [
        {
            name: "大酒坊",
            cost: { brick: 30, tools: 12, cloth: 6, silver: 280 },
            input: { food: 1.6667, wood: 0.25, tools: 0.0167 },
            output: { ale: 3.9 }, // 1.3x of base 1.80
            jobs: { artisan: 3, worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "酿酒工坊",
            cost: { brick: 50, tools: 25, dye: 10, ale: 15, silver: 650 },
            input: { food: 2.25, wood: 0.375, tools: 0.03, spice: 0.045 }, // 需要香料调味
            output: { ale: 6.075, culture: 0.075 }, // 2.25x of base 1.80 + 酒文化
            jobs: { artisan: 4, worker: 2 }, // +1 artisan only
        },
    ],

    // furniture_workshop: base output 1.2 furniture, owner: artisan, base jobs: artisan:3
    furniture_workshop: [
        {
            name: "精工家具坊",
            cost: { plank: 80, tools: 20, silver: 400 },
            input: { tools: 0.12, plank: 1.5, cloth: 0.375 },
            output: { furniture: 3.12 }, // 1.3x of base 1.60
            jobs: { artisan: 4, worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大家具坊",
            cost: { plank: 120, furniture: 15, silver: 900 },
            input: { tools: 0.192, plank: 2.4, cloth: 0.56 },
            output: { furniture: 5.76 }, // 2.25x of base 1.60
            jobs: { artisan: 5, worker: 3 }, // +1 artisan only (no worker needed)
        },
    ],

    // tailor_workshop: base output 1.2 fine_clothes + 0.5 culture, owner: artisan, base jobs: artisan:3
    tailor_workshop: [
        {
            name: "高级成衣坊",
            cost: { plank: 50, tools: 15, silver: 350 },
            input: { tools: 0.115, cloth: 2.875, dye: 0.575 },
            output: { fine_clothes: 2.6, culture: 1.0833 }, // 1.3x of base 1.2 & 0.5
            jobs: { artisan: 3, worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "御用成衣坊",
            cost: { brick: 40, fine_clothes: 10, silver: 800 },
            input: { tools: 0.162, cloth: 4.05, dye: 0.81 },
            output: { fine_clothes: 4.05, culture: 1.6875 }, // 2.25x of base 1.2 & 0.5
            jobs: { artisan: 4, worker: 2 }, // +1 artisan only
        },
    ],

    // mine (iron): base output 0.5 iron, owner: landowner, base jobs: worker:9, landowner:1
    mine: [
        {
            name: "深井铁矿",
            cost: { plank: 80, tools: 25, silver: 400 },
            input: { tools: 0.08, wood: 0.2, food: 0.3 }, // modest input cost
            output: { iron: 1.65 }, // 1.3x
            jobs: { worker: 7, landowner: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铁矿",
            cost: { brick: 60, tools: 40, silver: 900 },
            input: { tools: 0.15, wood: 0.35, food: 0.45 }, // reasonable input increase
            output: { iron: 2.86, coal: 0.05 }, // 2.25x + 煤层伴生
            jobs: { worker: 9, landowner: 1 }, // +2 workers only
        },
    ],

    // iron_tool_workshop: base output 6.0 tools (人均 1.5), owner: artisan, base jobs: worker:3, artisan:1
    // 效率提升型升级：锻造技术提升，产出增加但岗位不增加
    iron_tool_workshop: [
        {
            name: "精铁工坊",
            cost: { brick: 60, iron: 30, silver: 400 },
            input: { wood: 1.46, iron: 2.34, tools: 0.015 },
            output: { tools: 6.80 }, // 人均 1.7
            jobs: { worker: 3, artisan: 1 },
        },
        {
            name: "大铁匠铺",
            cost: { brick: 100, iron: 50, silver: 900 },
            input: { wood: 1.81, iron: 2.90, tools: 0.03 },
            output: { tools: 8.40 }, // 人均 2.1 (>大铸坊 1.4)
            jobs: { worker: 3, artisan: 1 },
        },
    ],

    // large_estate: base output 33.0 food (人均 3.67), owner: landowner, base jobs: serf:8, landowner:1
    large_estate: [
        {
            name: "繁荣庄园",
            cost: { plank: 60, tools: 20, silver: 400 },
            input: { tools: 0.13, wood: 0.21 },
            output: { food: 38.0 }, // 人均 4.22
            jobs: { serf: 8, landowner: 1 },
        },
        {
            name: "领主庄园",
            cost: { brick: 50, furniture: 15, silver: 900 },
            input: { tools: 0.18, wood: 0.29, cloth: 0.045, fertilizer: 0.17 },
            output: { food: 53.0, cloth: 0.13, ale: 0.07 }, // 人均 5.30
            jobs: { serf: 9, landowner: 1 },
        },
    ],

    // church: base output culture: 8 silver: 1.6, owner: cleric, base jobs: cleric:4 worker:4
    // 教堂是早期 culture 主产，最高人均 ≤ 4.0，让后期 culture 建筑能超过
    church: [
        {
            name: "大教堂",
            cost: { brick: 80, furniture: 25, silver: 500 },
            input: { furniture: 0.1, fine_clothes: 0.08 },
            output: { culture: 18, silver: 5.7597 }, // 人均 3.0 (6 jobs)
            jobs: { cleric: 3, worker: 3 },
        },
        {
            name: "主教座堂",
            cost: { brick: 150, furniture: 40, silver: 1200 },
            input: { furniture: 0.14, fine_clothes: 0.11, papyrus: 0.04 },
            output: { culture: 28, silver: 9.5995, science: 0.3 }, // 人均 4.0 (7 jobs)
            jobs: { cleric: 4, worker: 3 }, // 减1 worker，提升人均
        },
    ],


    // ========== 封建时代新建筑升级 ==========

    // monastery_cellar: base output ale: 4.4, culture: 1.4, owner: cleric, base jobs: cleric:1, worker:3
    monastery_cellar: [
        {
            name: "修道院大酒窖",
            cost: { stone: 80, tools: 20, silver: 400 },
            input: { food: 3.15, wood: 0.52 },
            output: { ale: 5.0, culture: 1.6 },
            jobs: { cleric: 1, worker: 3 },
        },
        {
            name: "酿酒修道院",
            cost: { brick: 100, furniture: 20, silver: 900 },
            input: { food: 4.05, wood: 0.68, papyrus: 0.02 },
            output: { ale: 6.5, culture: 2.2, science: 0.10 },
            jobs: { cleric: 2, worker: 3 },
        },
    ],

    // wool_workshop: base output cloth: 14.4 (人均 1.8), fine_clothes: 0.9, owner: artisan, base jobs: serf:4, artisan:1, worker:3
    wool_workshop: [
        {
            name: "大纺织工场",
            cost: { plank: 80, tools: 20, silver: 380 },
            input: { food: 1.26, tools: 0.066 },
            output: { cloth: 16.8, fine_clothes: 1.05 }, // 人均 2.1
            jobs: { serf: 4, artisan: 1, worker: 3 },
        },
        {
            name: "领主纺织工场",
            cost: { brick: 60, tools: 35, silver: 850 },
            input: { food: 1.62, tools: 0.10, dye: 0.072 },
            output: { cloth: 21.0, fine_clothes: 1.69, culture: 0.10 }, // 人均 2.33
            jobs: { serf: 5, artisan: 1, worker: 3 },
        },
    ],

    // stone_workshop: base output stone: 18 (人均 2.0), owner: artisan, base jobs: miner:4 worker:4 artisan:1
    stone_workshop: [
        {
            name: "大采石工场",
            cost: { plank: 60, iron: 25, silver: 350 },
            input: { tools: 0.175, food: 0.288 },
            output: { stone: 28.0 }, // 人均 3.11
            jobs: { miner: 4, worker: 4, artisan: 1 },
        },
        {
            name: "皇家采石场",
            cost: { brick: 80, iron: 40, silver: 800 },
            input: { tools: 0.250, food: 0.423 },
            output: { stone: 41.0, brick: 0.38 }, // 人均 3.73
            jobs: { miner: 5, worker: 5, artisan: 1 },
        },
    ],

    // hardwood_camp: base output 27 wood (人均 2.45), owner: merchant, base jobs: lumberjack:5 worker:5 merchant:1
    hardwood_camp: [
        {
            name: "特用林场",
            cost: { plank: 80, tools: 30, silver: 450 },
            input: { tools: 0.225, food: 0.37 },
            output: { wood: 31.0 }, // 人均 2.82
            jobs: { lumberjack: 5, worker: 5, merchant: 1 },
        },
        {
            name: "皇家御林",
            cost: { brick: 80, tools: 50, silver: 900 },
            input: { tools: 0.336, food: 0.59 },
            output: { wood: 39.0, food: 0.6 }, // 人均 3.0 (13人)
            jobs: { lumberjack: 6, worker: 6, merchant: 1 },
        },
    ],

    // ========== 探索时代建筑 ==========

    // dockyard: base output 0.84 spice, owner: merchant, base jobs: navigator:3, worker:2, merchant:1
    dockyard: [
        {
            name: "大船坞",
            cost: { plank: 120, tools: 30, silver: 500 },
            input: { wood: 0.4, tools: 0.02 },
            output: { spice: 1.092 }, // 1.3x of base 0.84
            jobs: { navigator: 3, worker: 2, merchant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "皇家船厂",
            cost: { plank: 200, iron: 40, silver: 1100 },
            input: { wood: 0.6, tools: 0.03, cloth: 0.06 }, // 需要帆布
            // Level 2 should never regress vs Level 1: keep the 2.25x spice progression and add bonus outputs
            output: { spice: 1.55, silver: 0.25, science: 0.05 }, // 2.25x + 贸易利润&航海测绘
            jobs: { navigator: 3, worker: 2, merchant: 1 }, // +1 navigator only
        },
    ],

    // navigator_school: base output science: 2.5 (人均 0.5), culture: 1.5, owner: merchant, base jobs: merchant:1, navigator:3, scribe:1
    navigator_school: [
        {
            name: "航海学府",
            cost: { plank: 80, papyrus: 40, silver: 400 },
            input: { papyrus: 0.06 },
            output: { science: 3.0, culture: 1.8 }, // 人均 0.6
            jobs: { merchant: 1, navigator: 3, scribe: 1},
        },
        {
            name: "皇家航海学院",
            cost: { brick: 60, papyrus: 80, silver: 900 },
            input: { papyrus: 0.10, coffee: 0.04 },
            output: { science: 4.5, culture: 2.7 }, // 人均 0.75 (6人)
            jobs: { merchant: 1, navigator: 4, scribe: 1},
        },
    ],

    // trade_port: base output food: 2.5 silver: 12.0 (silver 主产), owner: merchant, base jobs: merchant:4 worker:6
    trade_port: [
        {
            name: "繁荣港口",
            cost: { plank: 150, spice: 30, silver: 600 },
            input: { spice: 0.45 },
            output: { food: 3.25, silver: 15.6 }, // 1.3x
            jobs: { merchant: 4, worker: 6 },
        },
        {
            name: "贸易枢纽",
            cost: { plank: 120, spice: 60, silver: 1300 },
            input: { spice: 0.70, cloth: 0.10 },
            output: { food: 5.625, silver: 27.0 }, // 2.25x
            jobs: { merchant: 5, worker: 8 },
        },
    ],

    // shaft_mine: base output iron 7.0 (人均 0.368), copper 4.2, owner: merchant, base jobs: miner:6 engineer:12 merchant:1
    shaft_mine: [
        {
            name: "通风矿井",
            cost: { brick: 120, tools: 45, silver: 650 },
            input: { tools: 0.501, wood: 1.04, science: 0.174 },
            output: { iron: 8.10, copper: 4.86 }, // iron 人均 0.426
            jobs: { miner: 6, engineer: 12, merchant: 1 },
        },
        {
            name: "蒸汽矿井",
            cost: { brick: 200, steel: 50, tools: 80, silver: 1200 },
            input: { tools: 0.616, coal: 0.453, wood: 1.23, science: 0.259 },
            output: { iron: 10.5, copper: 6.30, coal: 0.30 }, // iron 人均 0.50
            jobs: { miner: 7, engineer: 13, merchant: 1 },
        },
    ],


    // ========== 探索时代新建筑升级 ==========

    // dye_workshop: base output dye: 5.50 (人均 0.611), fine_clothes: 1.38, owner: artisan, base jobs: artisan:3 worker:6
    dye_workshop: [
        {
            name: "大印染工坊",
            cost: { brick: 80, tools: 25, silver: 480 },
            input: { food: 4.41, cloth: 2.21, spice: 0.276, science: 0.073 },
            output: { dye: 6.60, fine_clothes: 1.66 }, // 人均 0.733
            jobs: { artisan: 3, worker: 6 },
        },
        {
            name: "皇家印染工坊",
            cost: { brick: 140, tools: 45, silver: 1050 },
            input: { food: 7.0, cloth: 3.5, spice: 0.438, iron: 0.07, science: 0.117 },
            output: { dye: 10.50, fine_clothes: 2.63, culture: 0.16 }, // 人均 0.875 (>大印染Lv1 0.733)
            jobs: { artisan: 4, worker: 8 },
        },
    ],

    // coffee_plantation: base output 0.4 coffee, owner: merchant, base jobs: serf:4, merchant:1

    coffee_plantation: [
        {
            name: "大种植园",
            cost: { wood: 300, spice: 40, silver: 800 },
            input: { tools: 0.03 },
            output: { coffee: 0.78 }, // 1.3x of base 0.6
            jobs: { serf: 6, merchant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "种植园庄园",
            cost: { plank: 200, tools: 60, silver: 1800 },
            input: { tools: 0.06, fertilizer: 0.08 }, // fertilizer for intensive coffee cultivation
            output: { coffee: 1.62, spice: 0.02, food: 0.5 }, // 2.7x of base 0.6, fertilizer bonus
            jobs: { serf: 8, merchant: 1 }, // +1 serf only
        },
    ],

    // spice_plantation: base output 2.50 spice (人均 0.278), owner: landowner, base jobs: serf:8, landowner:1
    spice_plantation: [
        {
            name: "大香料园",
            cost: { wood: 300, tools: 50, silver: 1000 },
            input: { food: 2.20, tools: 0.137 },
            output: { spice: 3.30 }, // 人均 0.30 (11人)
            jobs: { serf: 10, landowner: 1 },
        },
        {
            name: "香料庄园",
            cost: { plank: 200, tools: 80, silver: 2200 },
            input: { food: 3.0, tools: 0.20, fertilizer: 0.20 },
            output: { spice: 4.55, coffee: 0.06, food: 0.85 }, // 人均 0.35 (13人)
            jobs: { serf: 12, landowner: 1 },
        },
    ],

    // coffee_house: base output culture: 6 science: 1.9999, base input coffee: 0.5 delicacies: 0.25, owner: merchant, base jobs: merchant:1 scribe:5
    // epoch 5 culture 主产建筑，必须严格 > 教堂 Lv2 (4.0)
    coffee_house: [
        {
            name: "文人咖啡馆",
            cost: { plank: 80, coffee: 25, silver: 400 },
            input: { coffee: 0.4, delicacies: 0.16 },
            output: { culture: 26.0, science: 5.1989, silver: 1.2 }, // 人均 4.33 (6 jobs)
            jobs: { merchant: 1, scribe: 5 },
        },
        {
            name: "沙龙",
            cost: { brick: 60, furniture: 25, silver: 900 },
            input: { coffee: 0.45, delicacies: 0.15 },
            output: { culture: 30.0, science: 6.7498, silver: 1.8 }, // 人均 5.0 (6 jobs)
            jobs: { merchant: 1, scribe: 5 },
        },
    ],

    // ========== 启蒙时代建筑 ==========

    // printing_house: base output science: 7.80 (人均 0.867), culture: 4.50, owner: capitalist, base jobs: worker:5, scribe:3, capitalist:1
    printing_house: [
        {
            name: "大印刷所",
            cost: { brick: 120, papyrus: 40, silver: 500, science: 100 },
            input: { papyrus: 1.69, coffee: 0.338, science: 0.423 },
            output: { science: 10.5, culture: 5.85 }, // 人均 1.167
            jobs: { worker: 5, scribe: 3, capitalist: 1 },
        },
        {
            name: "出版社",
            cost: { brick: 200, papyrus: 80, silver: 1100, science: 250 },
            input: { papyrus: 2.4, coffee: 0.48, science: 0.60 },
            output: { science: 14.0, culture: 8.0 }, // 人均 1.556
            jobs: { worker: 5, scribe: 3, capitalist: 1 },
        },
    ],

    // textile_mill: base output cloth: 60.0 (人均 3.33), fine_clothes: 3.69, owner: capitalist, base jobs: worker:17, capitalist:1
    textile_mill: [
        {
            name: "大纺织厂",
            cost: { brick: 120, tools: 40, silver: 600 },
            input: { cotton: 8.81, dye: 1.20, tools: 0.134 },
            output: { cloth: 67.0, fine_clothes: 4.13 }, // 人均 3.53
            jobs: { worker: 18, capitalist: 1 },
        },
        {
            name: "纺织工场",
            cost: { brick: 200, tools: 60, silver: 1300 },
            input: { cotton: 9.94, dye: 1.36, tools: 0.151, electricity: 0.084 },
            output: { cloth: 76.0, fine_clothes: 4.86 }, // 人均 3.80
            jobs: { worker: 19, capitalist: 1 },
        },
    ],

    // lumber_mill: base output plank: 22 (人均 1.83), owner: capitalist, base jobs: worker:11, capitalist:1
    lumber_mill: [
        {
            name: "大木材厂",
            cost: { brick: 100, tools: 35, silver: 500 },
            input: { wood: 10.50, tools: 0.030 },
            output: { plank: 28.0 }, // 人均 2.33
            jobs: { worker: 11, capitalist: 1 },
        },
        {
            name: "木业公司",
            cost: { brick: 180, tools: 50, silver: 1100 },
            input: { wood: 17.25, tools: 0.057 },
            output: { plank: 46.0, furniture: 0.17 }, // 人均 3.54
            jobs: { worker: 12, capitalist: 1 },
        },
    ],

    // building_materials_plant: base output brick: 24.6, owner: capitalist, base jobs: worker:10, engineer:1, capitalist:1
    building_materials_plant: [
        {
            name: "大建材厂",
            cost: { brick: 120, tools: 35, silver: 550 },
            input: { stone: 8.10, wood: 2.35, coal: 0.85 },
            output: { brick: 28.2 },
            jobs: { worker: 10, engineer: 1, capitalist: 1 },
        },
        {
            name: "建材公司",
            cost: { brick: 200, tools: 50, silver: 1200 },
            input: { stone: 9.75, wood: 2.85, coal: 1.00 },
            output: { brick: 33.8 },
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
    ],

    // distillery: base output ale: 16.2, silver: 2.4, owner: capitalist, base jobs: worker:11, capitalist:1
    distillery: [
        {
            name: "大蒸馏厂",
            cost: { brick: 150, copper: 50, silver: 600 },
            input: { food: 6.90, coal: 0.68 },
            output: { ale: 17.85, silver: 2.90 },
            jobs: { worker: 11, capitalist: 1 },
        },
        {
            name: "酒业公司",
            cost: { brick: 250, copper: 80, silver: 1300 },
            input: { food: 8.10, coal: 0.82 },
            output: { ale: 21.45, silver: 3.80, culture: 0.18 },
            jobs: { worker: 12, capitalist: 1 },
        },
    ],

    // paper_mill: base output papyrus: 6.60, owner: capitalist, base jobs: worker:9, engineer:1, capitalist:1
    paper_mill: [
        {
            name: "大造纸厂",
            cost: { brick: 120, tools: 35, silver: 500 },
            input: { wood: 4.10, coal: 0.36 },
            output: { papyrus: 7.70 },
            jobs: { worker: 9, engineer: 1, capitalist: 1 },
        },
        {
            name: "造纸公司",
            cost: { brick: 200, tools: 50, silver: 1100 },
            input: { wood: 5.10, coal: 0.46 },
            output: { papyrus: 9.60, tools: 0.08 },
            jobs: { worker: 10, engineer: 1, capitalist: 1 },
        },
    ],

    // university: base output science: 5.2, culture: 1.2, owner: cleric, base jobs: cleric:1, scribe:3, engineer:2
    // 效率提升型升级：教学方法优化，产出增加但岗位适度增加
    university: [
        {
            name: "著名学府",
            cost: { brick: 250, papyrus: 60, silver: 750, science: 150 },
            input: { papyrus: 0.35, coffee: 0.21, delicacies: 0.13, science: 0.42 },
            output: { science: 6.3, culture: 1.4 },
            jobs: { cleric: 1, scribe: 3, engineer: 2 },
        },
        {
            name: "皇家学院",
            cost: { brick: 400, papyrus: 120, silver: 1700, science: 400 },
            input: { papyrus: 0.45, coffee: 0.28, delicacies: 0.16, science: 0.62 },
            output: { science: 8.0, culture: 2.0 },
            jobs: { cleric: 1, scribe: 4, engineer: 2 },
        },
    ],

    // opera_house: base output culture: 45.0 (人均 4.5), silver: 12.86, owner: cleric, base jobs: cleric:3 worker:5 scribe:2 = 10
    opera_house: [
        {
            name: "大歌剧院",
            cost: { brick: 250, furniture: 50, silver: 700 },
            input: { fine_clothes: 2.34, delicacies: 1.755 },
            output: { culture: 58.5, silver: 16.72 }, // 人均 5.85 (10 jobs)
            jobs: { cleric: 3, worker: 5, scribe: 2 },
        },
        {
            name: "皇家歌剧院",
            cost: { brick: 400, furniture: 80, silver: 1500 },
            input: { fine_clothes: 4.05, delicacies: 3.04, coffee: 1.35 },
            output: { culture: 101.25, silver: 28.94, science: 1.43 }, // 人均 9.20 (11 jobs)
            jobs: { cleric: 4, worker: 5, scribe: 2 },
        },
    ],

    // ========== 工业时代建筑 ==========

    // coal_mine: base output 3.0 coal, owner: capitalist, base jobs: worker:12, capitalist:1
    // 激进升级：大幅提升煤炭产量以满足工业时代需求
    coal_mine: [
        {
            name: "深煤矿",
            cost: { plank: 150, tools: 40, silver: 500 },
            input: { tools: 0.35, wood: 0.5, food: 0.8 }, // 略微增加投入
            output: { coal: 5.0 }, // ~1.67x基础产量
            jobs: { worker: 13, capitalist: 1 }, // +1 worker
        },
        {
            name: "大煤矿",
            cost: { brick: 100, tools: 60, silver: 1100 },
            input: { tools: 0.55, wood: 0.8, food: 1.2 }, // 合理增加投入
            output: { coal: 8.0, iron: 0.2 }, // ~2.67x 基础产量 + 煤矿伴生铁
            jobs: { worker: 15, capitalist: 1 }, // +2 workers
        },
    ],

    // steel_foundry: base output steel: ~0.4, owner: capitalist, base jobs: engineer:3, worker:4, capitalist:1
    steel_foundry: [
        {
            name: "大炼钢厂",
            cost: { brick: 200, iron: 120, silver: 750, science: 150 },
            input: { iron: 1.2, coal: 1.2, science: 0.3 },
            output: { steel: 1.2 }, // 1.7x (Fixed regression)
            jobs: { engineer: 5, worker: 7, capitalist: 1 }, // keep same
        },
        {
            name: "钢铁联合厂",
            cost: { steel: 100, iron: 200, silver: 1700, science: 350 },
            input: { iron: 2.4, coal: 2.4, science: 0.6 },
            output: { steel: 2.4, tools: 0.2 }, // 2.0x of Lv1
            jobs: { engineer: 5, worker: 8, capitalist: 1 }, // +1 worker only
        },
    ],

    // factory: base output tools:44.0 machinery:1.91 (人均 3.14), owner: capitalist, base jobs: worker:10, engineer:3, capitalist:1
    factory: [
        {
            name: "大工厂",
            cost: { brick: 300, steel: 120, silver: 850, science: 200 },
            input: { steel: 5.40, coal: 5.40, science: 1.34 },
            output: { tools: 51.0, machinery: 2.21 }, // 人均 3.64
            jobs: { worker: 10, engineer: 3, capitalist: 1 },
        },
        {
            name: "制造中心",
            cost: { steel: 200, tools: 80, silver: 1900, science: 450 },
            input: { steel: 6.36, coal: 6.04, science: 1.50 },
            output: { tools: 60.0, machinery: 2.60, steel: 0.2, science: 0.3 }, // 人均 4.0 (>大冶金坊 3.0)
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
    ],

    // industrial_mine: base output iron: 9.50 (人均 0.594), copper: 3.27, owner: capitalist, base jobs: worker:13, engineer:2, capitalist:1
    industrial_mine: [
        {
            name: "大工业矿场",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { tools: 0.564, coal: 1.07, wood: 0.625, food: 1.218 },
            output: { iron: 11.50, copper: 4.00 }, // iron 人均 0.676 (17 jobs)
            jobs: { worker: 14, engineer: 2, capitalist: 1 },
        },
        {
            name: "矿业公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { tools: 0.751, coal: 1.43, wood: 0.815, food: 1.567 },
            output: { iron: 14.50, copper: 5.10 }, // iron 人均 0.806 (18 jobs)
            jobs: { worker: 15, engineer: 2, capitalist: 1 },
        },
    ],

    // mechanized_farm: base output food: 66.0 (人均 5.5), owner: capitalist, base jobs: worker:10, engineer:1, capitalist:1
    mechanized_farm: [
        {
            name: "大机械农场",
            cost: { steel: 100, tools: 50, silver: 750 },
            input: { tools: 0.32, coal: 0.63, iron: 0.08, fertilizer: 0.17 }, // fertilizer is standard for industrial-era farming
            output: { food: 84.0 }, // 人均 6.46 (>领主庄园Lv2 5.30)
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
        {
            name: "工业农场",
            cost: { steel: 170, tools: 80, silver: 1700 },
            input: { tools: 0.45, coal: 0.92, iron: 0.13, dye: 0.04, fertilizer: 0.27 }, // heavy fertilizer usage
            output: { food: 112.0, cloth: 0.43 }, // 人均 8.0
            jobs: { worker: 12, engineer: 1, capitalist: 1 },
        },
    ],

    // logging_company: base output wood: 60.0 (人均 3.53), owner: capitalist, base jobs: worker:15, engineer:1, capitalist:1
    logging_company: [
        {
            name: "大伐木公司",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { tools: 0.231, coal: 0.436, food: 0.513 },
            output: { wood: 72.0 }, // 人均 4.0
            jobs: { worker: 16, engineer: 1, capitalist: 1 },
        },
        {
            name: "林业公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { tools: 0.292, coal: 0.557, food: 0.685 },
            output: { wood: 86.0 }, // 人均 4.53
            jobs: { worker: 17, engineer: 1, capitalist: 1 },
        },
    ],

    // prefab_factory: base output brick: 42.4, owner: capitalist, base jobs: worker:13, engineer:2, capitalist:1
    prefab_factory: [
        {
            name: "大预制厂",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { brick: 5.20, steel: 0.68, stone: 3.60, coal: 1.12 },
            output: { brick: 48.8 },
            jobs: { worker: 13, engineer: 2, capitalist: 1 },
        },
        {
            name: "建筑材料公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { brick: 6.20, steel: 0.82, stone: 4.30, coal: 1.35 },
            output: { brick: 57.8 },
            jobs: { worker: 14, engineer: 2, capitalist: 1 },
        },
    ],

    // cannery: base output delicacies: 13.30 (人均 1.025), owner: capitalist, base jobs: worker:11, engineer:1, capitalist:1
    cannery: [
        {
            name: "大罐头厂",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { food: 12.4, iron: 1.49, coal: 1.24 },
            output: { delicacies: 17.30 }, // 人均 1.33
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
        {
            name: "食品公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { food: 16.5, iron: 1.98, coal: 1.65 },
            output: { delicacies: 23.10, ale: 0.40 }, // 人均 1.93
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
    ],

    // garment_factory: base output fine_clothes: 14.0, culture: 0.9, owner: capitalist, base jobs: worker:18, engineer:1, capitalist:1
    garment_factory: [
        {
            name: "大服装厂",
            cost: { steel: 100, tools: 60, silver: 850 },
            input: { cloth: 4.60, dye: 0.90, coal: 0.54 },
            output: { fine_clothes: 15.75, culture: 1.05 },
            jobs: { worker: 18, engineer: 1, capitalist: 1 },
        },
        {
            name: "服装公司",
            cost: { steel: 170, tools: 100, silver: 1900 },
            input: { cloth: 5.40, dye: 1.05, coal: 0.64 },
            output: { fine_clothes: 18.48, culture: 1.35, cloth: 0.60 },
            jobs: { worker: 19, engineer: 1, capitalist: 1 },
        },
    ],

    // furniture_factory: base output furniture: 10.50 (人均 0.808), culture: 0.60, owner: capitalist, base jobs: worker:11, engineer:1, capitalist:1
    furniture_factory: [
        {
            name: "大家具厂",
            cost: { steel: 80, tools: 50, silver: 750 },
            input: { plank: 9.75, cloth: 3.12, coal: 0.975 },
            output: { furniture: 13.65, culture: 0.78 }, // 人均 1.05
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
        {
            name: "家具公司",
            cost: { steel: 150, tools: 80, silver: 1700 },
            input: { plank: 13.65, cloth: 4.37, coal: 1.365 },
            output: { furniture: 19.10, culture: 1.09, plank: 0.4 }, // 人均 1.59
            jobs: { worker: 11, engineer: 1, capitalist: 1 },
        },
    ],

    // market: base output food: 1.0 silver: 4.5 (silver 主产), owner: merchant, base jobs: merchant:3 worker:1
    // Note: Market's primary function is trade balancing, not direct production
    market: [
        {
            name: "大市场",
            cost: { brick: 300, papyrus: 60, cloth: 15, silver: 1000 },
            input: { papyrus: 0.12, coffee: 0.075 },
            output: { food: 1.3, silver: 5.85 }, // 1.3x
            jobs: { merchant: 4, scribe: 1 },
        },
        {
            name: "交易所",
            cost: { steel: 200, papyrus: 120, delicacies: 30, silver: 2200 },
            input: { papyrus: 0.18, coffee: 0.12 },
            output: { food: 2.25, silver: 10.125, culture: 0.225 }, // 2.25x
            jobs: { merchant: 5, scribe: 1 },
        },
    ],

    // rail_depot: base output silver: 12 maxPop: 21, base input coal: 0.7 ale: 0.2 delicacies: 0.1 science: 0.1, owner: capitalist, base jobs: engineer:6 scribe:5 capitalist:1
    rail_depot: [
        {
            name: "大铁路站",
            cost: { steel: 120, coal: 80, silver: 850 },
            input: { coal: 0.55, ale: 0.15, delicacies: 0.08, science: 0.08 },
            output: { silver: 62.2222, maxPop: 34.5 },
            jobs: { engineer: 6, scribe: 5, capitalist: 1 },
        },
        {
            name: "铁路枢纽",
            cost: { steel: 220, coal: 150, silver: 1900 },
            input: { coal: 0.60, ale: 0.18, delicacies: 0.10, science: 0.10 },
            output: { silver: 80, maxPop: 37.5, food: 0.75, culture: 0.15 },
            jobs: { engineer: 6, scribe: 5, capitalist: 1 },
        },
    ],

    // metallurgy_workshop: base output tools: 13.5 (人均 2.25), owner: artisan, base jobs: worker:3, artisan:2, engineer:1
    metallurgy_workshop: [
        {
            name: "精密冶金坊",
            cost: { brick: 120, iron: 60, silver: 600 },
            input: { iron: 5.16, copper: 1.11, wood: 2.21 },
            output: { tools: 15.60 }, // 人均 2.6
            jobs: { worker: 3, artisan: 2, engineer: 1 },
        },
        {
            name: "大冶金坊",
            cost: { brick: 200, iron: 100, silver: 1300 },
            input: { iron: 6.73, copper: 1.42, wood: 2.66, coal: 0.10 },
            output: { tools: 21.0 }, // 人均 3.0 (>大铁匠铺 2.1)
            jobs: { worker: 4, artisan: 2, engineer: 1 },
        },
    ],

    // ========== Military Production Buildings Upgrades ==========

    // swordsmith: base output swords: 0.9, base input iron: 0.9 copper: 0.45, owner: artisan, base jobs: artisan:4 worker:2
    swordsmith: [
        {
            name: "大铸剑坊",
            cost: { brick: 80, iron: 40, tools: 15, silver: 400 },
            input: { iron: 1.035, copper: 0.5175 },
            output: { swords: 1.755 }, // 1.3x
            jobs: { artisan: 4, worker: 2 },
        },
        {
            name: "御用铸剑坊",
            cost: { brick: 120, iron: 60, tools: 30, silver: 900 },
            input: { iron: 1.728, copper: 0.864 },
            output: { swords: 3.24 }, // 2.25x
            jobs: { artisan: 5, worker: 3 },
        },
    ],

    // armorsmith: base output plate_armor: 0.72, base input iron: 1.28 cloth: 0.64, owner: artisan, base jobs: artisan:4 worker:4
    armorsmith: [
        {
            name: "大甲胄工坊",
            cost: { brick: 100, iron: 50, tools: 20, silver: 500 },
            input: { iron: 1.472, cloth: 0.736 },
            output: { plate_armor: 1.4976 }, // 1.3x
            jobs: { artisan: 4, worker: 4 },
        },
        {
            name: "御用甲胄工坊",
            cost: { brick: 160, iron: 80, tools: 35, silver: 1100 },
            input: { iron: 2.4, cloth: 1.2 },
            output: { plate_armor: 2.7 }, // 2.25x
            jobs: { artisan: 5, worker: 5 },
        },
    ],

    // powder_mill: base output gunpowder: 0.99, base input coal: 0.9 food: 0.54, owner: artisan, base jobs: artisan:3 worker:6
    powder_mill: [
        {
            name: "大火药工坊",
            cost: { brick: 140, iron: 30, tools: 25, silver: 550 },
            input: { coal: 1.035, food: 0.621 },
            output: { gunpowder: 2.3166 }, // 1.3x
            jobs: { artisan: 3, worker: 6 },
        },
        {
            name: "火药工场",
            cost: { brick: 220, iron: 50, tools: 45, silver: 1200 },
            input: { coal: 1.8, food: 1.08 },
            output: { gunpowder: 4.455 }, // 2.25x
            jobs: { artisan: 4, worker: 8 },
        },
    ],

    // gun_workshop: base output muskets: 0.8, base input iron: 1.4 gunpowder: 0.4, owner: artisan, base jobs: artisan:4 worker:8
    gun_workshop: [
        {
            name: "大枪炮作坊",
            cost: { brick: 160, iron: 60, tools: 30, silver: 600 },
            input: { iron: 1.61, gunpowder: 0.46 },
            output: { muskets: 2.08 }, // 1.3x
            jobs: { artisan: 4, worker: 8 },
        },
        {
            name: "枪炮工场",
            cost: { brick: 260, iron: 100, tools: 50, silver: 1300 },
            input: { iron: 2.7, gunpowder: 0.7714 },
            output: { muskets: 3.8572 }, // 2.25x
            jobs: { artisan: 5, worker: 10 },
        },
    ],

    // rifle_works: base output rifles: 1.1, base input steel: 1 tools: 0.375, owner: artisan, base jobs: artisan:4 engineer:4 worker:12
    rifle_works: [
        {
            name: "大枪械工坊",
            cost: { brick: 200, steel: 60, tools: 45, silver: 700, science: 80 },
            input: { steel: 1.15, tools: 0.43 },
            output: { rifles: 4.4943 }, // 1.3x
            jobs: { artisan: 4, engineer: 4, worker: 12 },
        },
        {
            name: "精密枪械工场",
            cost: { brick: 320, steel: 100, tools: 70, silver: 1500, science: 180 },
            input: { steel: 1.84, tools: 0.69 },
            output: { rifles: 7.9514 }, // 2.25x
            jobs: { artisan: 5, engineer: 5, worker: 13 },
        },
    ],

    // ammo_factory: base output ammunition: 1.8, base input steel: 0.25 gunpowder: 0.5333, owner: artisan, base jobs: worker:9 artisan:2 engineer:1
    ammo_factory: [
        {
            name: "大弹药厂",
            cost: { brick: 180, steel: 40, tools: 30, silver: 600, science: 60 },
            input: { steel: 0.29, gunpowder: 0.6133 },
            output: { ammunition: 5.265 }, // 1.3x
            jobs: { worker: 9, artisan: 2, engineer: 1 },
        },
        {
            name: "弹药工场",
            cost: { brick: 300, steel: 80, tools: 55, silver: 1300, science: 140 },
            input: { steel: 0.40, gunpowder: 0.864 },
            output: { ammunition: 8.2125 }, // 2.25x
            jobs: { worker: 9, artisan: 2, engineer: 1 },
        },
    ],

    // arms_factory: base output ordnance: 2.40 (主产 人均 0.126) ammunition: 1.20, owner: capitalist, base jobs: worker:15 engineer:3 capitalist:1
    arms_factory: [
        {
            name: "大兵工厂",
            cost: { brick: 280, steel: 150, tools: 70, silver: 900, science: 200 },
            input: { steel: 1.04, coal: 0.92, science: 0.23, machinery: 0.13 },
            output: { ordnance: 3.12, ammunition: 1.56 }, // 1.3x
            jobs: { worker: 15, engineer: 3, capitalist: 1 },
        },
        {
            name: "军工联合体",
            cost: { steel: 250, tools: 120, silver: 2000, science: 400 },
            input: { steel: 1.62, coal: 1.44, science: 0.36, machinery: 0.225 },
            output: { ordnance: 5.40, ammunition: 2.70 }, // 2.25x
            jobs: { worker: 16, engineer: 3, capitalist: 1 },
        },
    ],

    // ============ 探索时代 (Epoch 4) 纺织链补充 ============
    // cotton_plantation: base output cotton: 2.4, owner: merchant, base jobs: serf:5, merchant:1
    cotton_plantation: [
        {
            name: "改良种植园",
            cost: { wood: 300, tools: 40, spice: 30, silver: 400 },
            input: {},
            output: { cotton: 3.12 }, // 1.3x
            jobs: { serf: 6, merchant: 1 },
        },
        {
            name: "大棉花庄园",
            cost: { wood: 500, tools: 80, spice: 50, silver: 900 },
            input: { fertilizer: 0.10 }, // fertilizer boosts cotton yields
            output: { cotton: 6.48 }, // 2.7x of base 2.4, fertilizer bonus
            jobs: { serf: 7, merchant: 1, worker: 1 },
        },
    ],

    // cotton_weaving_house: base output cloth: 16.0 (人均 2.67), fine_clothes: 1.07, owner: artisan, base jobs: worker:4, artisan:2
    cotton_weaving_house: [
        {
            name: "棉纺织工场",
            cost: { brick: 200, plank: 120, tools: 50, silver: 350 },
            input: { cotton: 3.0, tools: 0.098 },
            output: { cloth: 18.0, fine_clothes: 1.20 }, // 人均 3.0
            jobs: { worker: 4, artisan: 2 },
        },
        {
            name: "大棉纺织坊",
            cost: { brick: 350, plank: 200, tools: 90, silver: 750 },
            input: { cotton: 3.61, tools: 0.117 },
            output: { cloth: 22.0, fine_clothes: 1.51 }, // 人均 3.14
            jobs: { worker: 5, artisan: 2 },
        },
    ],

    // ============ 电气时代 (Epoch 7) 建筑升级 ============
    // oil_well: base output oil: 1.8, owner: capitalist, base jobs: worker:14 capitalist:1
    oil_well: [
        {
            name: "深钻井架",
            cost: { silver: 2000, steel: 25, tools: 15, science: 100 },
            input: {},
            output: { oil: 3.191 }, // 1.3x
            jobs: { worker: 14, capitalist: 1 },
        },
        {
            name: "自动采油平台",
            cost: { silver: 4500, steel: 50, machinery: 8, science: 200 },
            input: {},
            output: { oil: 5.0625 }, // 2.25x
            jobs: { worker: 14, capitalist: 1 },
        },
    ],

    // rubber_plantation: base output rubber: 1.3333, base input fertilizer: 0.1333, owner: merchant, base jobs: worker:14 merchant:1
    rubber_plantation: [
        {
            name: "改良品种",
            cost: { silver: 1200, wood: 50, tools: 10, science: 80 },
            input: { fertilizer: 0.15 }, // fertilizer for improved rubber tree cultivation
            output: { rubber: 2.9999 }, // 1.5x of base 0.8, fertilizer boost
            jobs: { worker: 14, merchant: 1 },
        },
        {
            name: "大规模种植园",
            cost: { silver: 2500, wood: 80, tools: 20, science: 150 },
            input: { fertilizer: 0.225 }, // heavy fertilizer usage for mass cultivation
            output: { rubber: 4.3332 }, // 2.6x of base 0.8, fertilizer bonus
            jobs: { worker: 14, merchant: 1 },
        },
    ],

    // coal_power_plant: base output electricity: 2.3333, base input coal: 1.6667, owner: capitalist, base jobs: worker:11 engineer:3 capitalist:1
    coal_power_plant: [
        {
            name: "高压锅炉",
            cost: { silver: 3500, steel: 40, brick: 40, science: 150 },
            input: { coal: 2.8751 },
            output: { electricity: 4.4999 },
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
        {
            name: "超临界机组",
            cost: { silver: 7000, steel: 80, brick: 60, science: 300 },
            input: { coal: 2.8126 },
            output: { electricity: 4.9999 },
            jobs: { worker: 10, engineer: 4, capitalist: 1 },
        },
    ],

    // oil_refinery: base output chemicals: 0.9375, base input oil: 1.125 coal: 0.5625 dye: 0.1875, owner: capitalist, base jobs: worker:10 engineer:4 capitalist:1
    oil_refinery: [
        {
            name: "催化裂解",
            cost: { silver: 3000, steel: 30, brick: 20, science: 150 },
            input: { oil: 2.4375, coal: 1.2188, dye: 0.4063 },
            output: { chemicals: 2.0312 }, // 1.3x
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
        {
            name: "连续精馏塔",
            cost: { silver: 6000, steel: 60, brick: 40, science: 300 },
            input: { oil: 3.4517, coal: 1.7259, dye: 0.5753 },
            output: { chemicals: 2.8764 }, // 2.25x
            jobs: { worker: 10, engineer: 4, capitalist: 1 },
        },
    ],

    // wiring_factory: base output wiring: 0.9375, base input copper: 1.5 rubber: 0.5625 electricity: 0.15, owner: capitalist, base jobs: worker:12 engineer:2 capitalist:1
    wiring_factory: [
        {
            name: "连续拉丝机",
            cost: { silver: 2500, steel: 15, tools: 12, science: 120 },
            input: { copper: 3.2499, rubber: 1.2188, electricity: 0.3249 },
            output: { wiring: 2.0312 }, // 1.3x
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
        {
            name: "多芯线自动化",
            cost: { silver: 5000, steel: 30, tools: 20, science: 250 },
            input: { copper: 5.0625, rubber: 1.8984, electricity: 0.5063 },
            output: { wiring: 3.1641 }, // 2.25x
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
    ],

    // machinery_plant: base output machinery: 0.8, base input steel: 0.25 iron: 0.4 tools: 0.2 electricity: 0.12, owner: capitalist, base jobs: worker:11 engineer:3 capitalist:1
    machinery_plant: [
        {
            name: "精密车床",
            cost: { silver: 3500, steel: 45, iron: 30, tools: 15, science: 160 },
            input: { steel: 0.25, iron: 0.48, tools: 0.24, electricity: 0.168 },
            output: { machinery: 1.9 }, // 1.3x
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
        {
            name: "数控加工",
            cost: { silver: 7000, steel: 80, iron: 50, tools: 30, science: 350 },
            input: { steel: 0.4, iron: 0.76, tools: 0.38, electricity: 0.276 },
            output: { machinery: 3.04 }, // 2.25x
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
    ],

    // automobile_factory: base output automobile:0.25, base input steel:0.4 rubber:0.3 machinery:0.3 electricity:0.15, owner: capitalist
    automobile_factory: [
        {
            name: "改进流水线",
            cost: { silver: 6000, steel: 75, machinery: 15, science: 200 },
            input: { steel: 0.52, rubber: 0.39, machinery: 0.39, electricity: 0.195 },
            output: { automobile: 0.325 }, // 1.3x
            jobs: { worker: 15, engineer: 2, capitalist: 1 },
        },
        {
            name: "全自动组装",
            cost: { silver: 12000, steel: 120, machinery: 25, science: 400 },
            input: { steel: 0.90, rubber: 0.675, machinery: 0.675, electricity: 0.3375 },
            output: { automobile: 0.5625 }, // 2.25x
            jobs: { worker: 17, engineer: 3, capitalist: 1 },
        },
    ],

    // fertilizer_plant: base output fertilizer: 2, base input chemicals: 0.625 coal: 0.375, owner: capitalist, base jobs: worker:11 engineer:3 capitalist:1
    fertilizer_plant: [
        {
            name: "高压合成",
            cost: { silver: 2200, steel: 12, brick: 15, science: 100 },
            input: { chemicals: 1.741, coal: 1.0448 },
            output: { fertilizer: 5.5715 }, // 1.3x
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
        {
            name: "缓释配方",
            cost: { silver: 4500, steel: 25, brick: 30, science: 200 },
            input: { chemicals: 2.3438, coal: 1.4063 },
            output: { fertilizer: 7.5 }, // 2.25x
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
    ],

    // advanced_copper_mine: base output copper: 4.8, base input electricity: 0.3, owner: capitalist, base jobs: worker:13 engineer:1 capitalist:1
    advanced_copper_mine: [
        {
            name: "电气化竖井",
            cost: { silver: 2500, steel: 30, machinery: 8, science: 120 },
            input: { electricity: 0.54 },
            output: { copper: 8.28 },
            jobs: { worker: 13, engineer: 1, capitalist: 1 },
        },
        {
            name: "露天开采",
            cost: { silver: 5000, steel: 60, machinery: 15, science: 250 },
            input: { electricity: 0.6136, tools: 0.0818 },
            output: { copper: 10.35 },
            jobs: { worker: 13, engineer: 1, capitalist: 1 },
        },
    ],

    // broadcast_station: base output science: 28.5 (人均 1.9) culture: 13.6, owner: capitalist, base jobs: scribe:7 worker:5 engineer:2 capitalist:1
    broadcast_station: [
        {
            name: "短波发射",
            cost: { silver: 3000, wiring: 15, steel: 12, science: 150 },
            input: { electricity: 2.71, papyrus: 0.91 },
            output: { science: 36.5, culture: 17.5 }, // 人均 2.43
            jobs: { scribe: 7, worker: 5, engineer: 2, capitalist: 1 },
        },
        {
            name: "全国广播网",
            cost: { silver: 6000, wiring: 30, steel: 20, science: 300 },
            input: { electricity: 3.30, papyrus: 1.10 },
            output: { science: 46.0, culture: 22.0 }, // 人均 3.067
            jobs: { scribe: 8, worker: 4, engineer: 2, capitalist: 1 },
        },
    ],

    // synthetic_fiber_plant: base output synthetic_fiber:2.0, base input coal:1.5 steel:0.3 science:0.1, owner: capitalist
    synthetic_fiber_plant: [
        {
            name: "连续聚合",
            cost: { steel: 450, brick: 350, tools: 180, silver: 2000, science: 250 },
            input: { coal: 1.95, steel: 0.39, science: 0.13 },
            output: { synthetic_fiber: 2.60 }, // 1.3x
            jobs: { worker: 14, engineer: 3, capitalist: 1 },
        },
        {
            name: "多品种共聚",
            cost: { steel: 700, brick: 500, tools: 300, silver: 4000, science: 500 },
            input: { coal: 3.375, steel: 0.675, science: 0.225 },
            output: { synthetic_fiber: 4.50 }, // 2.25x
            jobs: { worker: 16, engineer: 4, capitalist: 1 },
        },
    ],

    // electric_textile_mill: base output cloth:83.0 (人均 3.95), fine_clothes:6.83, owner: capitalist
    electric_textile_mill: [
        {
            name: "高速织机",
            cost: { steel: 500, brick: 400, tools: 200, silver: 2500, science: 300 },
            input: { cotton: 4.40, coal: 0.44, dye: 0.74, electricity: 0.515 },
            output: { cloth: 96.0, fine_clothes: 7.91 }, // 人均 4.36 (22人)
            jobs: { worker: 18, engineer: 3, capitalist: 1 },
        },
        {
            name: "全自动印染",
            cost: { steel: 800, brick: 600, tools: 350, silver: 5000, science: 600 },
            input: { cotton: 5.07, coal: 0.51, dye: 0.85, electricity: 0.59 },
            output: { cloth: 110.0, fine_clothes: 9.10 }, // 人均 4.78 (23人)
            jobs: { worker: 19, engineer: 3, capitalist: 1 },
        },
    ],

    // ============ 原子时代 (Epoch 8) 建筑升级 ============
    // uranium_mine: base output uranium: 1.2667, owner: capitalist, base jobs: worker:12 technician:6 capitalist:1
    uranium_mine: [
        {
            name: "离心浓缩",
            cost: { silver: 4000, steel: 45, tools: 20, science: 200 },
            input: {},
            output: { uranium: 3.1287 }, // 1.3x
            jobs: { worker: 13, technician: 5, capitalist: 1 },
        },
        {
            name: "气体扩散法",
            cost: { silver: 8000, steel: 80, tools: 35, science: 400 },
            input: {},
            output: { uranium: 4.5126 }, // 2.25x
            jobs: { worker: 12, technician: 6, capitalist: 1 },
        },
    ],

    // nuclear_power_plant: base output electricity: 9.5, base input uranium: 0.38 steel: 0.2533 stone: 0.1689, owner: capitalist, base jobs: technician:12 engineer:6 capitalist:1
    nuclear_power_plant: [
        {
            name: "沸水反应堆",
            cost: { silver: 12000, steel: 120, stone: 150, brick: 70, science: 400 },
            input: { uranium: 0.8824, steel: 0.5615, stone: 0.4011 },
            output: { electricity: 20.8578 },
            jobs: { technician: 13, engineer: 5, capitalist: 1 },
        },
        {
            name: "快中子堆",
            cost: { silver: 25000, steel: 200, stone: 250, brick: 120, science: 800 },
            input: { uranium: 0.9359, steel: 0.6016, stone: 0.4011 },
            output: { electricity: 24.0667 },
            jobs: { technician: 12, engineer: 6, capitalist: 1 },
        },
    ],

    // plastics_factory: base output plastics: 1.3, base input chemicals: 0.76 oil: 0.57, owner: capitalist, base jobs: worker:10 technician:6 engineer:2 capitalist:1
    plastics_factory: [
        {
            name: "注塑成型",
            cost: { silver: 4500, steel: 30, chemicals: 15, science: 180 },
            input: { chemicals: 1.71, oil: 1.273 },
            output: { plastics: 3.978 }, // 1.3x
            jobs: { worker: 11, technician: 5, engineer: 2, capitalist: 1 },
        },
        {
            name: "吹塑挤压",
            cost: { silver: 9000, steel: 60, chemicals: 30, science: 350 },
            input: { chemicals: 2.508, oil: 1.881 },
            output: { plastics: 5.85 }, // 2.25x
            jobs: { worker: 11, technician: 6, engineer: 1, capitalist: 1 },
        },
    ],

    // electronics_factory: base output electronics: 0.475, base input copper: 0.475 wiring: 0.475 chemicals: 0.3167 stone: 0.3167 electricity: 0.19, owner: capitalist, base jobs: technician:8 worker:7 engineer:3 capitalist:1
    electronics_factory: [
        {
            name: "洁净车间",
            cost: { silver: 6500, steel: 35, wiring: 20, chemicals: 15, science: 250 },
            input: { copper: 0.9025, wiring: 0.9025, chemicals: 0.6017, stone: 0.6017, electricity: 0.361 },
            output: { electronics: 0.9025 }, // 1.3x
            jobs: { technician: 9, worker: 6, engineer: 3, capitalist: 1 },
        },
        {
            name: "微米级工艺",
            cost: { silver: 13000, steel: 70, wiring: 40, chemicals: 30, science: 500 },
            input: { copper: 1.2692, wiring: 1.2692, chemicals: 0.8462, stone: 0.8462, electricity: 0.5076 },
            output: { electronics: 1.2692 }, // 2.25x
            jobs: { technician: 8, worker: 6, engineer: 4, capitalist: 1 },
        },
    ],

    // pharmaceutical_plant: base output medicine: 0.6429, base input chemicals: 0.7714 papyrus: 0.5143, owner: capitalist, base jobs: technician:9 scribe:6 engineer:2 capitalist:1
    pharmaceutical_plant: [
        {
            name: "GMP标准化",
            cost: { silver: 5000, steel: 20, chemicals: 12, science: 200 },
            input: { chemicals: 2.3818, papyrus: 1.5879 },
            output: { medicine: 1.985 }, // 1.3x
            jobs: { technician: 10, scribe: 5, engineer: 3, capitalist: 1 },
        },
        {
            name: "生物制剂",
            cost: { silver: 10000, steel: 40, chemicals: 25, science: 400 },
            input: { chemicals: 2.9979, papyrus: 1.9988 },
            output: { medicine: 2.4986 }, // 2.25x
            jobs: { technician: 9, scribe: 5, engineer: 4, capitalist: 1 },
        },
    ],

    // aluminum_smelter: base output aluminum: 0.8, base input stone: 0.95 coal: 0.57 electricity: 0.95, owner: capitalist, base jobs: worker:12 technician:4 engineer:2 capitalist:1
    aluminum_smelter: [
        {
            name: "预焙阳极",
            cost: { silver: 5500, steel: 35, brick: 30, science: 200 },
            input: { stone: 2.128, coal: 1.273, electricity: 2.128 },
            output: { aluminum: 2.1486 }, // 1.3x
            jobs: { worker: 13, technician: 4, engineer: 1, capitalist: 1 },
        },
        {
            name: "惰性阳极",
            cost: { silver: 11000, steel: 70, brick: 50, science: 400 },
            input: { stone: 2.907, coal: 1.748, electricity: 2.907 },
            output: { aluminum: 2.9486 }, // 2.25x
            jobs: { worker: 11, technician: 4, engineer: 3, capitalist: 1 },
        },
    ],

    // appliance_factory: base output electronics: 0.7917, base input electronics: 0.3167 plastics: 0.3167 steel: 0.1583 electricity: 0.3167, owner: capitalist, base jobs: worker:13 technician:5 capitalist:1
    appliance_factory: [
        {
            name: "模块化组装",
            cost: { silver: 8000, steel: 45, electronics: 8, science: 250 },
            input: { electronics: 0.6017, plastics: 0.6017, steel: 0.3008, electricity: 0.6017 },
            output: { electronics: 1.5042 }, // 1.3x
            jobs: { worker: 14, technician: 4, capitalist: 1 },
        },
        {
            name: "智能家电",
            cost: { silver: 16000, steel: 80, electronics: 15, science: 500 },
            input: { electronics: 0.9026, plastics: 0.9026, steel: 0.4512, electricity: 0.9026 },
            output: { electronics: 2.2563 }, // 2.25x
            jobs: { worker: 13, technician: 5, capitalist: 1 },
        },
    ],

    // television_station: base output culture: 17.0 science: 5.91 silver: 80 (silver 主产), owner: capitalist, base jobs: scribe:10 technician:5 engineer:3 capitalist:1 = 19
    television_station: [
        {
            name: "彩色广播",
            cost: { silver: 6500, electronics: 12, wiring: 15, steel: 15, science: 200 },
            input: { electricity: 1.84, electronics: 0.325 },
            output: { culture: 22.0, science: 7.65, silver: 110 }, // silver 主产
            jobs: { scribe: 10, technician: 5, engineer: 3, capitalist: 1 },
        },
        {
            name: "卫星转播",
            cost: { silver: 13000, electronics: 25, wiring: 30, steel: 25, science: 400 },
            input: { electricity: 2.49, electronics: 0.433 },
            output: { culture: 28.0, science: 9.74, silver: 140 }, // silver 主产
            jobs: { scribe: 10, technician: 5, engineer: 3, capitalist: 1 },
        },
    ],

    // high_rise_apartment: base output maxPop:120, base input electricity:0.08, owner: capitalist
    high_rise_apartment: [
        {
            name: "电梯公寓",
            cost: { silver: 5000, steel: 60, brick: 70, stone: 40, science: 150 },
            input: { electricity: 0.12 },
            output: { maxPop: 156, silver: 1.5 }, // 1.3x
            jobs: { worker: 2 },
        },
        {
            name: "豪华公寓",
            cost: { silver: 10000, steel: 100, brick: 120, stone: 70, science: 300 },
            input: { electricity: 0.18 },
            output: { maxPop: 270, silver: 2.5 }, // 2.25x
            jobs: { worker: 3 },
        },
    ],

    // military_industrial_complex: base output ordnance: 5.50 (人均 0.289), owner: capitalist, base jobs: worker:10 technician:5 engineer:3 capitalist:1
    military_industrial_complex: [
        {
            name: "精确制造",
            cost: { silver: 9000, steel: 70, electronics: 15, chemicals: 20, science: 300 },
            input: { electronics: 3.75, steel: 5.0, chemicals: 2.5, electricity: 3.75 },
            output: { ordnance: 7.50 }, // 人均 0.395
            jobs: { worker: 11, technician: 5, engineer: 2, capitalist: 1 },
        },
        {
            name: "模块化军工",
            cost: { silver: 18000, steel: 120, electronics: 30, chemicals: 40, science: 600 },
            input: { electronics: 5.25, steel: 7.0, chemicals: 3.5, electricity: 5.25 },
            output: { ordnance: 10.50 }, // 人均 0.553
            jobs: { worker: 10, technician: 5, engineer: 3, capitalist: 1 },
        },
    ],

    // synthetic_textile_mill: base output fine_clothes: 17.1, base input synthetic_fiber: 2.1111 dye: 0.5278 electricity: 0.3167, owner: capitalist, base jobs: worker:14 technician:4 capitalist:1
    synthetic_textile_mill: [
        {
            name: "高速经编",
            cost: { steel: 600, brick: 500, tools: 300, silver: 3500, science: 350 },
            input: { synthetic_fiber: 2.9555, dye: 0.7178, electricity: 0.38 },
            output: { fine_clothes: 19.2533 },
            jobs: { worker: 14, technician: 4, capitalist: 1 },
        },
        {
            name: "智能纺织",
            cost: { steel: 900, brick: 750, tools: 500, silver: 7000, science: 700 },
            input: { synthetic_fiber: 3.5361, dye: 0.8656, electricity: 0.4645 },
            output: { fine_clothes: 22.1667 },
            jobs: { worker: 15, technician: 4, capitalist: 1 },
        },
    ],

    // ============ 信息时代 (Epoch 9) 建筑升级 ============
    // semiconductor_fab: base output semiconductors: 0.56, base input electronics: 0.45 chemicals: 0.4182 copper: 0.4182 stone: 0.2091 composites: 0.0418 electricity: 0.5227, owner: capitalist, base jobs: technician:12 scientist:6 engineer:4 capitalist:1
    semiconductor_fab: [
        {
            name: "14nm工艺",
            cost: { silver: 18000, steel: 80, electronics: 30, chemicals: 20, science: 500 },
            input: { electronics: 0.81, chemicals: 1.0455, copper: 1.0455, stone: 0.5227, composites: 0.1045, electricity: 1.2963 },
            output: { semiconductors: 2.5013 }, // 1.3x
            jobs: { technician: 13, scientist: 6, engineer: 3, capitalist: 1 },
        },
        {
            name: "3nm工艺",
            cost: { silver: 35000, steel: 150, electronics: 60, chemicals: 40, science: 1000 },
            input: { electronics: 1.11, chemicals: 1.4428, copper: 1.4428, stone: 0.7318, composites: 0.1463, electricity: 1.7981 },
            output: { semiconductors: 3.4347 }, // 2.25x
            jobs: { technician: 12, scientist: 6, engineer: 4, capitalist: 1 },
        },
    ],

    // software_company: base output software: 1.5 (主产) science: 0.75, owner: capitalist, base jobs: engineer:11 technician:8 capitalist:1
    software_company: [
        {
            name: "敏捷开发",
            cost: { silver: 9000, electronics: 15, science: 300 },
            input: { semiconductors: 0.4153, electricity: 2.4918 },
            output: { software: 4.983, science: 2.4918 }, // 1.3x (software 主产)
            jobs: { engineer: 14, technician: 8, capitalist: 1 },
        },
        {
            name: "AI辅助编程",
            cost: { silver: 18000, electronics: 30, science: 600 },
            input: { semiconductors: 0.588, electricity: 3.5285 },
            output: { software: 7.057, science: 3.5285 }, // 2.25x (software 主产)
            jobs: { engineer: 13, technician: 9, capitalist: 1 },
        },
    ],

    // data_center: base output silver: 18 science: 2, base input semiconductors: 0.1 electricity: 1 steel: 0.08 composites: 0.05, owner: capitalist, base jobs: technician:12 scientist:5 engineer:5 capitalist:1
    data_center: [
        {
            name: "虚拟化集群",
            cost: { silver: 12000, steel: 60, brick: 40, semiconductors: 8, science: 350 },
            input: { semiconductors: 0.24, electricity: 2.34, steel: 0.144, composites: 0.1 },
            output: { silver: 94.5, science: 9.2 }, // 1.3x
            jobs: { technician: 13, scientist: 4, engineer: 5, capitalist: 1 },
        },
        {
            name: "量子计算中心",
            cost: { silver: 25000, steel: 100, brick: 70, semiconductors: 15, science: 700 },
            input: { semiconductors: 0.32, electricity: 3.12, steel: 0.192, composites: 0.1333 },
            output: { silver: 126, science: 12.4 }, // 2.25x
            jobs: { technician: 12, scientist: 5, engineer: 5, capitalist: 1 },
        },
    ],

    // internet_platform: base output silver: 15 culture: 1.2778, base input software: 0.18 electricity: 0.5111, owner: capitalist, base jobs: scientist:8 scribe:14 capitalist:1
    internet_platform: [
        {
            name: "移动互联",
            cost: { silver: 10000, electronics: 12, software: 5, science: 250 },
            input: { software: 0.378, electricity: 1.5333 },
            output: { silver: 75, culture: 3.8334 }, // 1.3x
            jobs: { scientist: 7, scribe: 15, capitalist: 1 },
        },
        {
            name: "元宇宙平台",
            cost: { silver: 20000, electronics: 25, software: 10, science: 500 },
            input: { software: 0.54, electricity: 2.1977 },
            output: { silver: 107.1429, culture: 5.4945 }, // 2.25x
            jobs: { scientist: 8, scribe: 14, capitalist: 1 },
        },
    ],

    // solar_power_plant: base output electricity: 24.0 (人均 1.333), owner: capitalist, base jobs: technician:11 engineer:6 capitalist:1
    solar_power_plant: [
        {
            name: "高效单晶硅",
            cost: { silver: 8000, semiconductors: 12, aluminum: 20, steel: 30, science: 250 },
            input: { stone: 1.0, aluminum: 0.75, composites: 0.50 },
            output: { electricity: 32.0 }, // 人均 1.6 (20人)
            jobs: { technician: 14, engineer: 5, capitalist: 1 },
        },
        {
            name: "钙钛矿串联",
            cost: { silver: 16000, semiconductors: 25, aluminum: 40, steel: 50, science: 500 },
            input: { stone: 1.30, aluminum: 0.95, composites: 0.65 },
            output: { electricity: 42.0 }, // 人均 1.826 (23人)
            jobs: { technician: 15, engineer: 7, capitalist: 1 },
        },
    ],

    // composites_factory: base output composites: 0.6389, base input plastics: 0.7667 aluminum: 0.5111 chemicals: 0.2556, owner: capitalist, base jobs: technician:11 worker:8 engineer:3 capitalist:1
    composites_factory: [
        {
            name: "碳纤维增强",
            cost: { silver: 8500, aluminum: 15, plastics: 15, science: 250 },
            input: { plastics: 2.2924, aluminum: 1.5282, chemicals: 0.7642 },
            output: { composites: 1.9103 }, // 1.3x
            jobs: { technician: 12, worker: 7, engineer: 3, capitalist: 1 },
        },
        {
            name: "纳米复合材料",
            cost: { silver: 17000, aluminum: 30, plastics: 30, science: 500 },
            input: { plastics: 3.052, aluminum: 2.0347, chemicals: 1.0175 },
            output: { composites: 2.5433 }, // 2.25x
            jobs: { technician: 11, worker: 7, engineer: 4, capitalist: 1 },
        },
    ],

    // research_institute: base output science: 75.0 (人均 3.26) culture: 13.5, owner: capitalist, base jobs: scientist:11 scribe:6 engineer:5 capitalist:1
    research_institute: [
        {
            name: "超级计算",
            cost: { silver: 15000, semiconductors: 15, electronics: 20, science: 500 },
            input: { semiconductors: 0.443, electricity: 2.276, papyrus: 1.138, composites: 0.190 },
            output: { science: 95.0, culture: 17.10 }, // 人均 4.13 (23人)
            jobs: { scientist: 11, scribe: 6, engineer: 5, capitalist: 1 },
        },
        {
            name: "AGI研究中心",
            cost: { silver: 30000, semiconductors: 30, electronics: 40, science: 1000 },
            input: { semiconductors: 0.524, electricity: 2.683, papyrus: 1.341, composites: 0.224 },
            output: { science: 115.0, culture: 20.70 }, // 人均 4.87 (23人)
            jobs: { scientist: 12, scribe: 5, engineer: 5, capitalist: 1 },
        },
    ],

    // financial_center: base output silver: 20, base input software: 0.18 electricity: 0.5111, owner: capitalist, base jobs: scribe:21 capitalist:2
    financial_center: [
        {
            name: "高频交易",
            cost: { silver: 14000, software: 8, electronics: 12, steel: 20, science: 350 },
            input: { software: 0.414, electricity: 1.6611 },
            output: { silver: 100 }, // 1.3x
            jobs: { scribe: 23, capitalist: 2 },
        },
        {
            name: "去中心化金融",
            cost: { silver: 28000, software: 15, electronics: 25, steel: 35, science: 700 },
            input: { software: 0.72, electricity: 2.9133 },
            output: { silver: 180 }, // 2.25x
            jobs: { scribe: 30, capitalist: 3 },
        },
    ],

    // biotech_center: base output medicine: 4.0 (主产) science: 3.45, owner: capitalist, base jobs: scientist:12 technician:7 engineer:3 capitalist:1
    biotech_center: [
        {
            name: "基因编辑",
            cost: { silver: 12000, medicine: 15, electronics: 15, science: 400 },
            input: { medicine: 0.6251, electronics: 0.3126, chemicals: 0.6251 },
            output: { medicine: 10.0, science: 9.3778 }, // 1.3x
            jobs: { scientist: 13, technician: 7, engineer: 2, capitalist: 1 },
        },
        {
            name: "合成生物学",
            cost: { silver: 25000, medicine: 30, electronics: 30, science: 800 },
            input: { medicine: 0.8501, electronics: 0.425, chemicals: 0.8501 },
            output: { medicine: 14.0, science: 12.7526 }, // 2.25x
            jobs: { scientist: 12, technician: 7, engineer: 3, capitalist: 1 },
        },
    ],

    // automated_mine: base output copper: 22 (人均 1.467) iron: 13 coal: 12 stone: 12, owner: capitalist, base jobs: technician:8 engineer:6 capitalist:1
    automated_mine: [
        {
            name: "自主采掘",
            cost: { silver: 9000, semiconductors: 8, machinery: 15, steel: 40, science: 300 },
            input: { electricity: 3.83 },
            output: { copper: 32.0, iron: 19.0, coal: 18.0, stone: 18.0 }, // copper 人均 1.778 (18人)
            jobs: { technician: 11, engineer: 6, capitalist: 1 },
        },
        {
            name: "深海太空采矿",
            cost: { silver: 18000, semiconductors: 15, machinery: 30, steel: 70, science: 600 },
            input: { electricity: 6.05 },
            output: { copper: 48.0, iron: 28.0, coal: 26.0, stone: 26.0 }, // copper 人均 2.087 (23人)
            jobs: { technician: 14, engineer: 8, capitalist: 1 },
        },
    ],
};

// 获取建筑的有效配置（包含升级的效果）
export const getBuildingEffectiveConfig = (building, level = 0) => {
    if (!level || level === 0) {
        return {
            name: building.name,
            input: building.input || {},
            output: building.output || {},
            jobs: building.jobs || {},
            owner: building.owner || null,
        };
    }

    const upgrades = BUILDING_UPGRADES[building.id];
    if (!upgrades || !upgrades[level - 1]) {
        return {
            name: building.name,
            input: building.input || {},
            output: building.output || {},
            jobs: building.jobs || {},
            owner: building.owner || null,
        };
    }

    const upgrade = upgrades[level - 1];
    return {
        name: upgrade.name || building.name,
        input: upgrade.input || building.input || {},
        output: upgrade.output || building.output || {},
        jobs: upgrade.jobs || building.jobs || {},
        owner: upgrade.owner || building.owner || null,
    };
};


// 获取建筑的最大升级等级
export const getMaxUpgradeLevel = (buildingId) => {
    const upgrades = BUILDING_UPGRADES[buildingId];
    return upgrades ? upgrades.length : 0;
};

// 获取升级成本
// 获取升级成本
// existingUpgradeCount: 已经升级到该等级或更高等级的建筑数量（用于成本递增）
// growthFactor: 成本增长系数 (默认 1.15)
// 获取升级成本
// existingUpgradeCount: 已经升级到该等级或更高等级的建筑数量（用于成本递增）
// growthFactor: 成本增长系数 (默认 1.15, 即 15% 基础增长率)
export const getUpgradeCost = (buildingId, targetLevel, existingUpgradeCount = 0, growthFactor = 1.15) => {
    const upgrades = BUILDING_UPGRADES[buildingId];
    if (!upgrades || !upgrades[targetLevel - 1]) return null;

    const baseCost = upgrades[targetLevel - 1].cost || {};

    // 如果没有已有升级数量，直接返回基础成本
    if (existingUpgradeCount <= 0) {
        return baseCost;
    }

    // 成本计算模型：Base * (1 + Rate * Count^k)
    // growthFactor 如 1.15，则 Rate = 0.15
    // k < 1 (如 0.9) 确保斜率逐渐降低 (concave down slope)
    // 这种模型下，价格随数量增加而增加，但增加的幅度逐渐减缓

    // 使用 0.9 的指数，保持一定的增长压力但避免后期爆炸
    const slopeExponent = 0.9;
    const rate = Math.max(0, growthFactor - 1);

    // Multiplier = 1 + Rate * (Count ^ k)
    // 例: Count=10, Rate=0.15
    // Linear (k=1): 1 + 1.5 = 2.5x
    // Decaying (k=0.9): 1 + 0.15 * 7.94 = 2.19x
    // Exponential (1.15^10) = 4.04x
    const multiplier = 1 + rate * Math.pow(existingUpgradeCount, slopeExponent);

    const scaledCost = {};
    for (const [resource, amount] of Object.entries(baseCost)) {
        scaledCost[resource] = Math.ceil(amount * multiplier);
    }

    return scaledCost;
};
