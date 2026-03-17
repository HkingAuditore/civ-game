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
            input: { tools: 0.08, wood: 0.1 }, // reasonable input increase
            output: { food: 10.8 }, // 2.25x of base 4.8
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

    // loom_house: base output 1.92 cloth, owner: worker, base jobs: peasant:2
    loom_house: [
        {
            name: "织布坊",
            cost: { wood: 80, stone: 40, tools: 10, silver: 250 },
            input: { tools: 0.02 },
            output: { cloth: 3.744 }, // 1.3x of base 2.88
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大织布坊",
            cost: { plank: 60, brick: 40, tools: 20, silver: 600 },
            input: { tools: 0.04, dye: 0.03 }, // 新增染料需求
            output: { cloth: 6.48, culture: 0.05 }, // 2.25x of base 2.88 + 织艺文化
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // brickworks: base output 3.6 brick, owner: worker, base jobs: worker:3
    brickworks: [
        {
            name: "改良砖窑",
            cost: { stone: 80, wood: 40, tools: 15, silver: 300 },
            input: { stone: 1.725, wood: 0.5175, tools: 0.02 },
            output: { brick: 4.68 }, // 1.3x of base 3.6
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大砖窑",
            cost: { stone: 120, brick: 80, tools: 30, silver: 700 },
            input: { stone: 2.7, wood: 0.81, tools: 0.04 },
            output: { brick: 8.1, tools: 0.02 }, // 2.25x of base 3.6 + 模具生产
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // stone_tool_workshop: base output 0.5 tools, owner: artisan, base jobs: artisan:2
    // 效率提升型升级：技艺精进，产出提升但岗位不增加
    stone_tool_workshop: [
        {
            name: "工匠铺",
            cost: { stone: 50, wood: 50, silver: 200 },
            input: { wood: 1.65, stone: 1.35 },
            output: { tools: 0.975 },
            jobs: { artisan: 3 },
        },
        {
            name: "大工匠铺",
            cost: { brick: 40, plank: 40, silver: 500 },
            input: { wood: 2.25, stone: 1.8 },
            output: { tools: 1.35 },
            jobs: { artisan: 3 },
        },
    ],

    // trading_post: base output food: 2, silver: 0.8, owner: merchant, base jobs: merchant:1
    trading_post: [
        {
            name: "商铺",
            cost: { wood: 100, stone: 40, silver: 400 },
            input: { tools: 0.01 },
            output: { food: 5.2, silver: 2.08 }, // 1.3x of base 4 / 1.6
            jobs: { merchant: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "商会",
            cost: { plank: 80, brick: 60, silver: 900 },
            input: { tools: 0.02, papyrus: 0.01 },
            output: { food: 9.0, silver: 3.6, spice: 0.02 }, // 2.25x of base 4 / 1.6 + 异域贸易
            jobs: { merchant: 3 }, // +1 merchant only
        },
    ],

    // library: base output science: 1.0667, owner: scribe, base jobs: scribe:4
    // base input: papyrus: 0.03
    // 效率提升型升级：知识管理优化，产出增加但岗位适度增加
    library: [
        {
            name: "学堂",
            cost: { stone: 150, plank: 40, papyrus: 30, brick: 40, silver: 600, science: 80 },
            input: { papyrus: 0.08 },
            output: { science: 1.3867 }, // 1.3x of base 1.0667
            jobs: { scribe: 4 }, // keep same, efficiency upgrade
        },
        {
            name: "书院",
            cost: { brick: 120, plank: 60, papyrus: 80, silver: 1400, science: 200 },
            input: { papyrus: 0.15, science: 0.15 },
            output: { science: 2.4, culture: 0.12 }, // 2.25x of base 1.0667 + 文教传承
            jobs: { scribe: 5 }, // +1 scribe only (officials are expensive)
        },
    ],

    // ========== 青铜时代建筑 ==========

    // copper_mine: base output 0.5 copper, owner: miner, base jobs: miner:3
    copper_mine: [
        {
            name: "深铜矿",
            cost: { wood: 120, tools: 20, silver: 350 },
            input: { tools: 0.05, wood: 0.2, food: 0.2 }, // modest input cost
            output: { copper: 0.8667 }, // 1.3x of base 0.6667
            jobs: { miner: 4 }, // keep same, efficiency upgrade
        },
        {
            name: "大铜矿",
            cost: { plank: 80, tools: 40, silver: 800 },
            input: { tools: 0.1, wood: 0.35, food: 0.35 }, // reasonable input increase
            output: { copper: 1.5, stone: 0.15 }, // 2.25x of base 0.6667 + 废石利用
            jobs: { miner: 5 }, // +1 miner only
        },
    ],

    // dye_works: base output 0.6 dye, owner: worker, base jobs: worker:2
    dye_works: [
        {
            name: "大染坊",
            cost: { wood: 60, stone: 25, tools: 10, silver: 250 },
            input: { food: 0.6, tools: 0.02 },
            output: { dye: 1.17 }, // 1.3x of base 0.9
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "染色工坊",
            cost: { plank: 50, brick: 30, tools: 20, silver: 600 },
            input: { food: 0.9, tools: 0.04, cloth: 0.05 }, // 需要布料样本
            output: { dye: 2.025, culture: 0.05 }, // 2.25x of base 0.9 + 染艺文化
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // sawmill: base output 2.6 plank, owner: worker, base jobs: worker:3
    sawmill: [
        {
            name: "水力锯木坊",
            cost: { wood: 120, stone: 40, tools: 15, silver: 350 },
            input: { wood: 1.4, tools: 0.03 },
            output: { plank: 4.511 }, // 1.3x of base 3.47
            jobs: { worker: 4 }, // keep same, efficiency upgrade
        },
        {
            name: "大锯木坊",
            cost: { plank: 80, brick: 50, tools: 30, silver: 800 },
            input: { wood: 2.0, tools: 0.06, cloth: 0.05 }, // 需要布料（家具软垫）
            output: { plank: 7.8075, furniture: 0.05 }, // 2.25x of base 3.47 + 边角料家具
            jobs: { worker: 5 }, // +1 worker only
        },
    ],

    // bronze_foundry: base output 1.9 tools, owner: artisan, base jobs: worker:3, artisan:1
    // 效率提升型升级：熔炉改良，产出提升但岗位不增加
    bronze_foundry: [
        {
            name: "改良铸坊",
            cost: { stone: 60, copper: 25, silver: 300 },
            input: { copper: 0.82, wood: 0.48, tools: 0.015 },
            output: { tools: 2.20 },
            jobs: { worker: 3, artisan: 1 },
        },
        {
            name: "大铸坊",
            cost: { brick: 50, copper: 40, silver: 700 },
            input: { copper: 1.00, wood: 0.60, tools: 0.03 },
            output: { tools: 2.80 },
            jobs: { worker: 3, artisan: 1 },
        },
    ],

    // amphitheater: base output 5.4 culture, owner: cleric, base jobs: cleric:3
    // base input: fine_clothes:0.09, brick:0.02, dye:0.02
    amphitheater: [
        {
            name: "大剧场",
            cost: { stone: 120, brick: 40, silver: 400 },
            input: { fine_clothes: 0.06, dye: 0.015 }, // 降低消耗
            output: { culture: 6.5, silver: 0.8 }, // 1.2x
            jobs: { cleric: 2 }, // 减少岗位，提升人均效率
        },
        {
            name: "宏伟剧场",
            cost: { brick: 80, furniture: 20, silver: 900 },
            input: { fine_clothes: 0.08, ale: 0.03, dye: 0.025 }, // 降低消耗
            output: { culture: 9.0, silver: 1.5 }, // 1.6x + 高额门票
            jobs: { cleric: 2 }, // 适度增加
        },
    ],

    // ========== 古典/封建时代建筑 ==========

    // reed_works: base output 0.6 papyrus, owner: worker, base jobs: worker:2
    reed_works: [
        {
            name: "改良造纸坊",
            cost: { wood: 60, tools: 10, silver: 220 },
            input: { tools: 0.01 },
            output: { papyrus: 1.17 }, // 1.3x of base 0.90
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大造纸坊",
            cost: { plank: 50, tools: 20, silver: 500 },
            input: { tools: 0.02 },
            output: { papyrus: 2.025, science: 0.05 }, // 2.25x of base 0.90 + 研墨副产
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // culinary_kitchen: base output 1.5 delicacies, owner: artisan, base jobs: artisan:2, peasant:1
    culinary_kitchen: [
        {
            name: "精致厨房",
            cost: { brick: 40, tools: 15, cloth: 8, silver: 350 },
            input: { tools: 0.08, food: 1.2 },
            output: { delicacies: 2.6 }, // 1.3x of base 2.00
            jobs: { artisan: 3, peasant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "御膳房",
            cost: { brick: 60, furniture: 15, delicacies: 20, silver: 800 },
            input: { tools: 0.12, food: 1.8, spice: 0.06 }, // 需要香料
            output: { delicacies: 4.5, culture: 0.08 }, // 2.25x of base 2.00 + 美食文化
            jobs: { artisan: 3, peasant: 2 }, // +1 peasant only (artisan expensive)
        },
    ],

    // brewery: base output 1.2 ale, owner: worker, base jobs: worker:2
    brewery: [
        {
            name: "大酒坊",
            cost: { brick: 30, tools: 12, cloth: 6, silver: 280 },
            input: { food: 1.0, wood: 0.15, tools: 0.01 },
            output: { ale: 2.34 }, // 1.3x of base 1.80
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "酿酒工坊",
            cost: { brick: 50, tools: 25, dye: 10, ale: 15, silver: 650 },
            input: { food: 1.5, wood: 0.25, tools: 0.02, spice: 0.03 }, // 需要香料调味
            output: { ale: 4.05, culture: 0.05 }, // 2.25x of base 1.80 + 酒文化
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // furniture_workshop: base output 1.2 furniture, owner: artisan, base jobs: artisan:3
    furniture_workshop: [
        {
            name: "精工家具坊",
            cost: { plank: 80, tools: 20, silver: 400 },
            input: { tools: 0.08, plank: 1.0, cloth: 0.25 },
            output: { furniture: 2.08 }, // 1.3x of base 1.60
            jobs: { artisan: 4 }, // keep same, efficiency upgrade
        },
        {
            name: "大家具坊",
            cost: { plank: 120, furniture: 15, silver: 900 },
            input: { tools: 0.12, plank: 1.5, cloth: 0.35 },
            output: { furniture: 3.6 }, // 2.25x of base 1.60
            jobs: { artisan: 5 }, // +1 artisan only (no worker needed)
        },
    ],

    // tailor_workshop: base output 1.2 fine_clothes + 0.5 culture, owner: artisan, base jobs: artisan:3
    tailor_workshop: [
        {
            name: "高级成衣坊",
            cost: { plank: 50, tools: 15, silver: 350 },
            input: { tools: 0.069, cloth: 1.725, dye: 0.345 },
            output: { fine_clothes: 1.56, culture: 0.65 }, // 1.3x of base 1.2 & 0.5
            jobs: { artisan: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "御用成衣坊",
            cost: { brick: 40, fine_clothes: 10, silver: 800 },
            input: { tools: 0.108, cloth: 2.7, dye: 0.54 },
            output: { fine_clothes: 2.7, culture: 1.125 }, // 2.25x of base 1.2 & 0.5
            jobs: { artisan: 4 }, // +1 artisan only
        },
    ],

    // mine (iron): base output 0.5 iron, owner: landowner, base jobs: miner:5, capitalist:1
    mine: [
        {
            name: "深井铁矿",
            cost: { plank: 80, tools: 25, silver: 400 },
            input: { tools: 0.08, wood: 0.2, food: 0.3 }, // modest input cost
            output: { iron: 1.65 }, // 1.3x
            jobs: { miner: 7, landowner: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铁矿",
            cost: { brick: 60, tools: 40, silver: 900 },
            input: { tools: 0.15, wood: 0.35, food: 0.45 }, // reasonable input increase
            output: { iron: 2.86, coal: 0.05 }, // 2.25x + 煤层伴生
            jobs: { miner: 9, landowner: 1 }, // +2 miners only
        },
    ],

    // iron_tool_workshop: base output 3.1 tools, owner: artisan, base jobs: worker:3, artisan:1
    // 效率提升型升级：锻造技术提升，产出增加但岗位不增加
    iron_tool_workshop: [
        {
            name: "精铁工坊",
            cost: { brick: 60, iron: 30, silver: 400 },
            input: { wood: 0.72, iron: 1.10, tools: 0.015 },
            output: { tools: 3.40 },
            jobs: { worker: 3, artisan: 1 },
        },
        {
            name: "大铁匠铺",
            cost: { brick: 100, iron: 50, silver: 900 },
            input: { wood: 0.96, iron: 1.38, tools: 0.03 },
            output: { tools: 4.20 },
            jobs: { worker: 3, artisan: 1 },
        },
    ],

    // large_estate: base output 27.0 food, owner: landowner, base jobs: serf:8, landowner:1
    large_estate: [
        {
            name: "繁荣庄园",
            cost: { plank: 60, tools: 20, silver: 400 },
            input: { tools: 0.11, wood: 0.17 },
            output: { food: 31.05 },
            jobs: { serf: 8, landowner: 1 },
        },
        {
            name: "领主庄园",
            cost: { brick: 50, furniture: 15, silver: 900 },
            input: { tools: 0.16, wood: 0.26, cloth: 0.04 },
            output: { food: 39.5, cloth: 0.12, ale: 0.06 },
            jobs: { serf: 9, landowner: 1 },
        },
    ],

    // church: base output culture: 3.2, silver: 0.6667, owner: cleric, base jobs: cleric:4
    // base input: furniture: 0.04, fine_clothes: 0.03
    church: [
        {
            name: "大教堂",
            cost: { brick: 80, furniture: 25, silver: 500 },
            input: { furniture: 0.05, fine_clothes: 0.04 }, // 1.3x基础输入
            output: { culture: 4.16, silver: 1.2 }, // 1.3x culture + 奉献收入
            jobs: { cleric: 3 }, // 减少岗位
        },
        {
            name: "主教座堂",
            cost: { brick: 150, furniture: 40, silver: 1200 },
            input: { furniture: 0.07, fine_clothes: 0.055, papyrus: 0.02 }, // 2.25x基础输入
            output: { culture: 7.2, silver: 2.0, science: 0.15 }, // 2.25x culture + 高额奉献 + 神学
            jobs: { cleric: 4 }, // 恢复岗位
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

    // wool_workshop: base output cloth: 12.0, fine_clothes: 0.75, owner: worker, base jobs: serf:4, worker:3
    wool_workshop: [
        {
            name: "大纺织工场",
            cost: { plank: 80, tools: 20, silver: 380 },
            input: { food: 1.05, tools: 0.055 },
            output: { cloth: 13.8, fine_clothes: 0.86 },
            jobs: { serf: 4, worker: 3 },
        },
        {
            name: "领主纺织工场",
            cost: { brick: 60, tools: 35, silver: 850 },
            input: { food: 1.32, tools: 0.08, dye: 0.06 },
            output: { cloth: 16.8, fine_clothes: 1.35, culture: 0.08 },
            jobs: { serf: 5, worker: 3 },
        },
    ],

    // stone_workshop: base output stone: 8.75, owner: miner, base jobs: miner:4, worker:1
    stone_workshop: [
        {
            name: "大采石工场",
            cost: { plank: 60, iron: 25, silver: 350 },
            input: { tools: 0.085, food: 0.14 },
            output: { stone: 10.05 },
            jobs: { miner: 4, worker: 1 },
        },
        {
            name: "皇家采石场",
            cost: { brick: 80, iron: 40, silver: 800 },
            input: { tools: 0.13, food: 0.22 },
            output: { stone: 13.5, brick: 0.20 },
            jobs: { miner: 5, worker: 1 },
        },
    ],

    // hardwood_camp: base output 13.2 wood, owner: lumberjack, base jobs: lumberjack:5, worker:1
    hardwood_camp: [
        {
            name: "特用林场",
            cost: { plank: 80, tools: 30, silver: 450 },
            input: { tools: 0.11, food: 0.18 },
            output: { wood: 15.18 },
            jobs: { lumberjack: 5, worker: 1 },
        },
        {
            name: "皇家御林",
            cost: { brick: 80, tools: 50, silver: 900 },
            input: { tools: 0.16, food: 0.28 },
            output: { wood: 18.2, food: 0.35 },
            jobs: { lumberjack: 6, worker: 1 },
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

    // navigator_school: base output science: 2.0, culture: 1.2, owner: scribe, base jobs: navigator:3, scribe:1
    navigator_school: [
        {
            name: "航海学府",
            cost: { plank: 80, papyrus: 40, silver: 400 },
            input: { papyrus: 0.05 },
            output: { science: 2.2, culture: 1.4 },
            jobs: { navigator: 3, scribe: 1},
        },
        {
            name: "皇家航海学院",
            cost: { brick: 60, papyrus: 80, silver: 900 },
            input: { papyrus: 0.08, coffee: 0.03 }, // 需要咖啡提神
            output: { science: 3.0, culture: 1.8 },
            jobs: { navigator: 4, scribe: 1},
        },
    ],

    // trade_port: base output food: 2.0, owner: merchant, base jobs: merchant:3
    trade_port: [
        {
            name: "繁荣港口",
            cost: { plank: 150, spice: 30, silver: 600 },
            input: { spice: 0.46 },
            output: { food: 3.467, silver: 0.15 }, // 1.3x of base 2.6667
            jobs: { merchant: 4 }, // keep same, efficiency upgrade
        },
        {
            name: "贸易枢纽",
            cost: { plank: 120, spice: 60, silver: 1300 },
            input: { spice: 0.72, cloth: 0.06 }, // 需要帆布
            output: { food: 6.0, silver: 0.4 }, // 2.25x of base 2.6667 + 贸易利润
            jobs: { merchant: 5 }, // +1 merchant only
        },
    ],

    // shaft_mine: base output 2.10 iron, 1.26 copper, owner: miner, base jobs: miner:6, engineer:1
    shaft_mine: [
        {
            name: "通风矿井",
            cost: { brick: 120, tools: 45, silver: 650 },
            input: { tools: 0.15, wood: 0.32, science: 0.06 },
            output: { iron: 2.415, copper: 1.45 },
            jobs: { miner: 6, engineer: 1 },
        },
        {
            name: "蒸汽矿井",
            cost: { brick: 200, steel: 50, tools: 80, silver: 1200 },
            input: { tools: 0.19, coal: 0.14, wood: 0.38, science: 0.08 },
            output: { iron: 3.04, copper: 1.82, coal: 0.10 },
            jobs: { miner: 7, engineer: 1 },
        },
    ],


    // ========== 探索时代新建筑升级 ==========

    // dye_workshop: base output dye: 1.8, fine_clothes: 0.45, owner: artisan, base jobs: artisan:3, worker:2
    dye_workshop: [
        {
            name: "大印染工坊",
            cost: { brick: 80, tools: 25, silver: 480 },
            input: { food: 0.9, cloth: 0.5, spice: 0.06, science: 0.026 },
            output: { dye: 2.34, fine_clothes: 0.585 }, // 1.3x
            jobs: { artisan: 3, worker: 2 }, // keep same
        },
        {
            name: "皇家印染工坊",
            cost: { brick: 140, tools: 45, silver: 1050 },
            input: { food: 1.2, cloth: 0.7, spice: 0.08, iron: 0.02, science: 0.045 }, // 需要金属染缸
            output: { dye: 4.05, fine_clothes: 1.0125, culture: 0.08 }, // 2.25x + 织染艺术
            jobs: { artisan: 4, worker: 2 }, // +1 artisan
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
            input: { tools: 0.06 },
            output: { coffee: 1.35, spice: 0.02, food: 0.5 }, // 2.25x of base 0.6 + 混种&粮食副产
            jobs: { serf: 8, merchant: 1 }, // +1 serf only
        },
    ],

    // coffee_house: base output culture: 4.0, science: 1.3333, owner: merchant, base jobs: merchant:1, scribe:3
    // 效率提升型升级：氛围优化，产出增加但岗位不增加
    coffee_house: [
        {
            name: "文人咖啡馆",
            cost: { plank: 80, coffee: 25, silver: 400 },
            input: { coffee: 0.2, delicacies: 0.08 }, // 降低消耗
            output: { culture: 4.8, science: 1.733, silver: 0.6 }, // 1.2x + 消费收入
            jobs: { merchant: 1, scribe: 2 }, // 减少scribe岗位
        },
        {
            name: "沙龙",
            cost: { brick: 60, furniture: 25, silver: 900 },
            input: { coffee: 0.3, delicacies: 0.1 }, // 降低消耗
            output: { culture: 7.0, science: 3.0, silver: 1.2 }, // 1.75x + 高端消费
            jobs: { merchant: 1, scribe: 3 }, // 适度增加
        },
    ],

    // ========== 启蒙时代建筑 ==========

    // printing_house: base output science: 2.4, culture: 2.0, owner: capitalist, base jobs: artisan:5, scribe:3, capitalist:1
    // base input: papyrus: 0.40, coffee: 0.08, science: 0.10
    printing_house: [
        {
            name: "大印刷所",
            cost: { brick: 120, papyrus: 40, silver: 500, science: 100 },
            input: { papyrus: 0.52, coffee: 0.10, science: 0.13 }, // 1.3x基础输入
            output: { science: 3.12, culture: 2.6 }, // 1.3x
            jobs: { artisan: 5, scribe: 3, capitalist: 1 },
        },
        {
            name: "出版社",
            cost: { brick: 200, papyrus: 80, silver: 1100, science: 250 },
            input: { papyrus: 0.90, coffee: 0.18, science: 0.225 }, // 2.25x基础输入
            output: { science: 5.4, culture: 4.5 }, // 2.25x
            jobs: { artisan: 5, scribe: 3, capitalist: 1 },
        },
    ],

    // textile_mill: base output cloth: 50.40, fine_clothes: 3.10, owner: capitalist, base jobs: worker:14, artisan:3, capitalist:1
    textile_mill: [
        {
            name: "大纺织厂",
            cost: { brick: 120, tools: 40, silver: 600 },
            input: { cotton: 7.90, dye: 1.05, tools: 0.12 },
            output: { cloth: 57.0, fine_clothes: 3.60 },
            jobs: { worker: 15, artisan: 3, capitalist: 1 },
        },
        {
            name: "纺织工场",
            cost: { brick: 200, tools: 60, silver: 1300 },
            input: { cotton: 9.50, dye: 1.25, tools: 0.16, electricity: 0.08 },
            output: { cloth: 64.0, fine_clothes: 4.10 },
            jobs: { worker: 16, artisan: 3, capitalist: 1 },
        },
    ],

    // lumber_mill: base output plank: ~8.0, owner: capitalist, base jobs: worker:5, artisan:1, capitalist:1
    lumber_mill: [
        {
            name: "大木材厂",
            cost: { brick: 100, tools: 35, silver: 500 },
            input: { wood: 8.3572, tools: 0.024 },
            output: { plank: 22.2858 },
            jobs: { worker: 10, artisan: 1, capitalist: 1 },
        },
        {
            name: "木业公司",
            cost: { brick: 180, tools: 50, silver: 1100 },
            input: { wood: 14.4644, tools: 0.048 },
            output: { plank: 38.5715, furniture: 0.144 },
            jobs: { worker: 11, artisan: 1, capitalist: 1 },
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

    // distillery: base output ale: 16.2, silver: 2.4, owner: capitalist, base jobs: worker:9, artisan:2, capitalist:1
    distillery: [
        {
            name: "大蒸馏厂",
            cost: { brick: 150, copper: 50, silver: 600 },
            input: { food: 6.90, coal: 0.68 },
            output: { ale: 17.85, silver: 2.90 },
            jobs: { worker: 9, artisan: 2, capitalist: 1 },
        },
        {
            name: "酒业公司",
            cost: { brick: 250, copper: 80, silver: 1300 },
            input: { food: 8.10, coal: 0.82 },
            output: { ale: 21.45, silver: 3.80, culture: 0.18 },
            jobs: { worker: 10, artisan: 2, capitalist: 1 },
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

    // university: base output science: 5.2, culture: 1.2, owner: official, base jobs: scribe:4, engineer:2
    // 效率提升型升级：教学方法优化，产出增加但岗位适度增加
    university: [
        {
            name: "著名学府",
            cost: { brick: 250, papyrus: 60, silver: 750, science: 150 },
            input: { papyrus: 0.35, coffee: 0.21, delicacies: 0.13, science: 0.42 },
            output: { science: 6.3, culture: 1.4 },
            jobs: { scribe: 4, engineer: 2 },
        },
        {
            name: "皇家学院",
            cost: { brick: 400, papyrus: 120, silver: 1700, science: 400 },
            input: { papyrus: 0.45, coffee: 0.28, delicacies: 0.16, science: 0.62 },
            output: { science: 7.65, culture: 1.8 },
            jobs: { scribe: 5, engineer: 2 },
        },
    ],

    // opera_house: base output culture: ~3.5, silver: ~1.0, owner: cleric, base jobs: cleric:4, artisan:2, merchant:1
    opera_house: [
        {
            name: "大歌剧院",
            cost: { brick: 250, furniture: 50, silver: 700 },
            input: { fine_clothes: 0.25, delicacies: 0.15 },
            output: { culture: 5.6875, silver: 1.625 },
            jobs: { cleric: 5, artisan: 2, merchant: 1 },
        },
        {
            name: "皇家歌剧院",
            cost: { brick: 400, furniture: 80, silver: 1500 },
            input: { fine_clothes: 0.375, delicacies: 0.225, coffee: 0.1 },
            output: { culture: 9.8438, silver: 2.8125, science: 0.1875 },
            jobs: { cleric: 6, artisan: 2, merchant: 1 },
        },
    ],

    // ========== 工业时代建筑 ==========

    // coal_mine: base output 3.0 coal, owner: capitalist, base jobs: miner:12, capitalist:1
    // 激进升级：大幅提升煤炭产量以满足工业时代需求
    coal_mine: [
        {
            name: "深煤矿",
            cost: { plank: 150, tools: 40, silver: 500 },
            input: { tools: 0.35, wood: 0.5, food: 0.8 }, // 略微增加投入
            output: { coal: 5.0 }, // ~1.67x基础产量
            jobs: { miner: 13, capitalist: 1 }, // +1 miner
        },
        {
            name: "大煤矿",
            cost: { brick: 100, tools: 60, silver: 1100 },
            input: { tools: 0.55, wood: 0.8, food: 1.2 }, // 合理增加投入
            output: { coal: 8.0, iron: 0.2 }, // ~2.67x 基础产量 + 煤矿伴生铁
            jobs: { miner: 15, capitalist: 1 }, // +2 miners（不减少岗位）
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

    // factory: base output tools:18.9 machinery:0.82, owner: capitalist, base jobs: worker:10, engineer:3, capitalist:1
    factory: [
        {
            name: "大工厂",
            cost: { brick: 300, steel: 120, silver: 850, science: 200 },
            input: { steel: 3.30, coal: 3.10, science: 0.62 },
            output: { tools: 21.7, machinery: 1.05 },
            jobs: { worker: 10, engineer: 3, capitalist: 1 },
        },
        {
            name: "制造中心",
            cost: { steel: 200, tools: 80, silver: 1900, science: 450 },
            input: { steel: 4.00, coal: 3.80, science: 0.80 },
            output: { tools: 26.4, machinery: 1.55, steel: 0.2, science: 0.3 },
            jobs: { worker: 11, engineer: 3, capitalist: 1 },
        },
    ],

    // industrial_mine: base output iron: 6.40, copper: 2.20, owner: capitalist, base jobs: miner:13, engineer:2, capitalist:1
    industrial_mine: [
        {
            name: "大工业矿场",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { tools: 0.38, coal: 0.72, wood: 0.42, food: 0.82 },
            output: { iron: 7.65, copper: 2.65 },
            jobs: { miner: 14, engineer: 2, capitalist: 1 },
        },
        {
            name: "矿业公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { tools: 0.46, coal: 0.88, wood: 0.50, food: 0.96 },
            output: { iron: 9.90, copper: 3.95 },
            jobs: { miner: 15, engineer: 2, capitalist: 1 },
        },
    ],

    // mechanized_farm: base output food: 48.0, owner: capitalist, base jobs: peasant:4, worker:6, engineer:1, capitalist:1
    mechanized_farm: [
        {
            name: "大机械农场",
            cost: { steel: 100, tools: 50, silver: 750 },
            input: { tools: 0.23, coal: 0.46, iron: 0.06 },
            output: { food: 58.5 },
            jobs: { peasant: 5, worker: 6, engineer: 1, capitalist: 1 },
        },
        {
            name: "工业农场",
            cost: { steel: 170, tools: 80, silver: 1700 },
            input: { tools: 0.34, coal: 0.69, iron: 0.10, dye: 0.03 },
            output: { food: 72.8, cloth: 0.35 },
            jobs: { peasant: 5, worker: 7, engineer: 1, capitalist: 1 },
        },
    ],

    // logging_company: base output wood: 46.8, owner: capitalist, base jobs: lumberjack:9, worker:6, engineer:1, capitalist:1
    logging_company: [
        {
            name: "大伐木公司",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { tools: 0.18, coal: 0.34, food: 0.40 },
            output: { wood: 55.8 },
            jobs: { lumberjack: 10, worker: 6, engineer: 1, capitalist: 1 },
        },
        {
            name: "林业公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { tools: 0.23, coal: 0.44, food: 0.54 },
            output: { wood: 66.5 },
            jobs: { lumberjack: 11, worker: 6, engineer: 1, capitalist: 1 },
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

    // cannery: base output delicacies: ~3.5, owner: capitalist, base jobs: worker:8, artisan:2, engineer:1, capitalist:1
    cannery: [
        {
            name: "大罐头厂",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { food: 7.3125, iron: 0.8775, coal: 0.73125 },
            output: { delicacies: 10.2375 }, // 1.3x of base 7.875
            jobs: { worker: 17, artisan: 4, engineer: 1, capitalist: 1 },
        },
        {
            name: "食品公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { food: 12.65625, iron: 1.51875, coal: 1.265625 },
            output: { delicacies: 17.71875, ale: 0.3 }, // 2.25x + 饮料生产
            jobs: { worker: 18, artisan: 5, engineer: 1, capitalist: 1 },
        },
    ],

    // garment_factory: base output fine_clothes: 14.0, culture: 0.9, owner: capitalist, base jobs: worker:15, artisan:3, engineer:1, capitalist:1
    garment_factory: [
        {
            name: "大服装厂",
            cost: { steel: 100, tools: 60, silver: 850 },
            input: { cloth: 4.60, dye: 0.90, coal: 0.54 },
            output: { fine_clothes: 15.75, culture: 1.05 },
            jobs: { worker: 15, artisan: 3, engineer: 1, capitalist: 1 },
        },
        {
            name: "服装公司",
            cost: { steel: 170, tools: 100, silver: 1900 },
            input: { cloth: 5.40, dye: 1.05, coal: 0.64 },
            output: { fine_clothes: 18.48, culture: 1.35, cloth: 0.60 },
            jobs: { worker: 16, artisan: 3, engineer: 1, capitalist: 1 },
        },
    ],

    // furniture_factory: base output furniture: ~3.5, culture: ~0.2, owner: capitalist, base jobs: worker:8, artisan:2, engineer:1, capitalist:1
    furniture_factory: [
        {
            name: "大家具厂",
            cost: { steel: 80, tools: 50, silver: 750 },
            input: { plank: 7.3125, cloth: 2.34, coal: 0.73125 },
            output: { furniture: 10.2375, culture: 0.585 }, // 1.3x of base 7.875/0.45
            jobs: { worker: 17, artisan: 4, engineer: 1, capitalist: 1 },
        },
        {
            name: "家具公司",
            cost: { steel: 150, tools: 80, silver: 1700 },
            input: { plank: 12.65625, cloth: 4.05, coal: 1.265625 },
            output: { furniture: 17.71875, culture: 1.0125, plank: 0.4 }, // 2.25x + 木材下脚料
            jobs: { worker: 18, artisan: 4, engineer: 1, capitalist: 1 },
        },
    ],

    // market: base output food: ~2.0 (from trade), owner: merchant, base jobs: merchant:2
    // Note: Market's primary function is trade balancing, not direct production
    market: [
        {
            name: "大市场",
            cost: { brick: 300, papyrus: 60, cloth: 15, silver: 1000 },
            input: { papyrus: 0.12, coffee: 0.075 },
            output: { food: 3.9, silver: 0.45 },
            jobs: { merchant: 4, scribe: 1 },
        },
        {
            name: "交易所",
            cost: { steel: 200, papyrus: 120, delicacies: 30, silver: 2200 },
            input: { papyrus: 0.18, coffee: 0.12 },
            output: { food: 6.75, silver: 0.75, culture: 0.225 },
            jobs: { merchant: 5, scribe: 1 },
        },
    ],

    // rail_depot: base output silver: 2.7, maxPop: 14, owner: capitalist, base jobs: engineer:4, merchant:3, capitalist:1
    rail_depot: [
        {
            name: "大铁路站",
            cost: { steel: 120, coal: 80, silver: 850 },
            input: { coal: 0.375, ale: 0.1, delicacies: 0.05, science: 0.195 },
            output: { silver: 3.51, maxPop: 15 },
            jobs: { engineer: 4, merchant: 3, capitalist: 1 },
        },
        {
            name: "铁路枢纽",
            cost: { steel: 220, coal: 150, silver: 1900 },
            input: { coal: 0.5625, ale: 0.15, delicacies: 0.075, science: 0.3375 },
            output: { silver: 6.075, maxPop: 16, food: 0.625, culture: 0.125 },
            jobs: { engineer: 5, merchant: 4, capitalist: 1 },
        },
    ],

    // metallurgy_workshop: base output tools: 6.36, owner: artisan, base jobs: worker:3, artisan:2, engineer:1
    metallurgy_workshop: [
        {
            name: "精密冶金坊",
            cost: { brick: 120, iron: 60, silver: 600 },
            input: { iron: 2.30, copper: 0.48, wood: 0.96 },
            output: { tools: 7.20 },
            jobs: { worker: 3, artisan: 2, engineer: 1 },
        },
        {
            name: "大冶金坊",
            cost: { brick: 200, iron: 100, silver: 1300 },
            input: { iron: 2.65, copper: 0.56, wood: 1.05, coal: 0.10 },
            output: { tools: 9.10 },
            jobs: { worker: 4, artisan: 2, engineer: 1 },
        },
    ],

    // ========== Military Production Buildings Upgrades ==========

    // swordsmith: base output swords: 0.60, owner: artisan, base jobs: artisan:4
    swordsmith: [
        {
            name: "大铸剑坊",
            cost: { brick: 80, iron: 40, tools: 15, silver: 400 },
            input: { iron: 0.69, copper: 0.345 },
            output: { swords: 0.78 }, // 1.3x
            jobs: { artisan: 4 },
        },
        {
            name: "御用铸剑坊",
            cost: { brick: 120, iron: 60, tools: 30, silver: 900 },
            input: { iron: 1.08, copper: 0.54 },
            output: { swords: 1.35 }, // 2.25x
            jobs: { artisan: 5 },
        },
    ],

    // armorsmith: base output plate_armor: 0.45, owner: artisan, base jobs: artisan:4, worker:1
    armorsmith: [
        {
            name: "大甲胄工坊",
            cost: { brick: 100, iron: 50, tools: 20, silver: 500 },
            input: { iron: 0.92, cloth: 0.46 },
            output: { plate_armor: 0.585 }, // 1.3x
            jobs: { artisan: 4, worker: 1 },
        },
        {
            name: "御用甲胄工坊",
            cost: { brick: 160, iron: 80, tools: 35, silver: 1100 },
            input: { iron: 1.44, cloth: 0.72 },
            output: { plate_armor: 1.0125 }, // 2.25x
            jobs: { artisan: 5, worker: 1 },
        },
    ],

    // powder_mill: base output gunpowder: 0.55, owner: artisan, base jobs: artisan:3, worker:2
    powder_mill: [
        {
            name: "大火药工坊",
            cost: { brick: 140, iron: 30, tools: 25, silver: 550 },
            input: { coal: 0.575, food: 0.345 },
            output: { gunpowder: 0.715 }, // 1.3x
            jobs: { artisan: 3, worker: 2 },
        },
        {
            name: "火药工场",
            cost: { brick: 220, iron: 50, tools: 45, silver: 1200 },
            input: { coal: 0.9, food: 0.54 },
            output: { gunpowder: 1.2375 }, // 2.25x
            jobs: { artisan: 4, worker: 2 },
        },
    ],

    // gun_workshop: base output muskets: 0.40, owner: artisan, base jobs: artisan:4, worker:2
    gun_workshop: [
        {
            name: "大枪炮作坊",
            cost: { brick: 160, iron: 60, tools: 30, silver: 600 },
            input: { iron: 0.805, gunpowder: 0.23 },
            output: { muskets: 0.52 }, // 1.3x
            jobs: { artisan: 4, worker: 2 },
        },
        {
            name: "枪炮工场",
            cost: { brick: 260, iron: 100, tools: 50, silver: 1300 },
            input: { iron: 1.26, gunpowder: 0.36 },
            output: { muskets: 0.90 }, // 2.25x
            jobs: { artisan: 5, worker: 2 },
        },
    ],

    // rifle_works: base output rifles: 0.35, owner: artisan, base jobs: artisan:4, engineer:1, worker:3
    rifle_works: [
        {
            name: "大枪械工坊",
            cost: { brick: 200, steel: 60, tools: 45, silver: 700, science: 80 },
            input: { steel: 0.575, tools: 0.1725 },
            output: { rifles: 0.455 }, // 1.3x
            jobs: { artisan: 4, engineer: 1, worker: 3 },
        },
        {
            name: "精密枪械工场",
            cost: { brick: 320, steel: 100, tools: 70, silver: 1500, science: 180 },
            input: { steel: 0.9, tools: 0.27 },
            output: { rifles: 0.7875 }, // 2.25x
            jobs: { artisan: 5, engineer: 1, worker: 3 },
        },
    ],

    // ammo_factory: base output ammunition: 0.80, owner: artisan, base jobs: worker:6, artisan:2, engineer:1
    ammo_factory: [
        {
            name: "大弹药厂",
            cost: { brick: 180, steel: 40, tools: 30, silver: 600, science: 60 },
            input: { steel: 0.345, gunpowder: 0.46 },
            output: { ammunition: 1.04 }, // 1.3x
            jobs: { worker: 6, artisan: 2, engineer: 1 },
        },
        {
            name: "弹药工场",
            cost: { brick: 300, steel: 80, tools: 55, silver: 1300, science: 140 },
            input: { steel: 0.54, gunpowder: 0.72 },
            output: { ammunition: 1.80 }, // 2.25x
            jobs: { worker: 7, artisan: 2, engineer: 1 },
        },
    ],

    // arms_factory: base output ordnance: 0.50, ammunition: 1.20, owner: capitalist, base jobs: worker:15, engineer:3, capitalist:1
    // base input: steel:1.20, coal:0.80, science:0.20, machinery:0.10
    arms_factory: [
        {
            name: "大兵工厂",
            cost: { brick: 280, steel: 150, tools: 70, silver: 900, science: 200 },
            input: { steel: 1.38, coal: 0.92, science: 0.23, machinery: 0.13 },
            output: { ordnance: 0.65, ammunition: 1.56 }, // 1.3x
            jobs: { worker: 15, engineer: 3, capitalist: 1 },
        },
        {
            name: "军工联合体",
            cost: { steel: 250, tools: 120, silver: 2000, science: 400 },
            input: { steel: 2.16, coal: 1.44, science: 0.36, machinery: 0.225 },
            output: { ordnance: 1.125, ammunition: 2.70 }, // 2.25x
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
            input: {},
            output: { cotton: 5.40 }, // 2.25x
            jobs: { serf: 7, merchant: 1, worker: 1 },
        },
    ],

    // cotton_weaving_house: base output cloth: 13.2, fine_clothes: 0.88, owner: artisan, base jobs: worker:4, artisan:2
    cotton_weaving_house: [
        {
            name: "棉纺织工场",
            cost: { brick: 200, plank: 120, tools: 50, silver: 350 },
            input: { cotton: 2.45, tools: 0.08 },
            output: { cloth: 15.2, fine_clothes: 1.02 },
            jobs: { worker: 4, artisan: 2 },
        },
        {
            name: "大棉纺织坊",
            cost: { brick: 350, plank: 200, tools: 90, silver: 750 },
            input: { cotton: 3.10, tools: 0.10 },
            output: { cloth: 18.9, fine_clothes: 1.30 },
            jobs: { worker: 5, artisan: 2 },
        },
    ],

    // ============ 电气时代 (Epoch 7) 建筑升级 ============
    // oil_well: base output oil: 1.2, owner: capitalist, base jobs: worker:6, miner:3, capitalist:1
    oil_well: [
        {
            name: "深钻井架",
            cost: { silver: 2000, steel: 25, tools: 15, science: 100 },
            input: {},
            output: { oil: 1.56 }, // 1.3x
            jobs: { worker: 7, miner: 3, capitalist: 1 },
        },
        {
            name: "自动采油平台",
            cost: { silver: 4500, steel: 50, machinery: 8, science: 200 },
            input: {},
            output: { oil: 2.70 }, // 2.25x
            jobs: { worker: 7, miner: 4, capitalist: 1 },
        },
    ],

    // rubber_plantation: base output rubber: 0.8, owner: merchant, base jobs: peasant:5, worker:3, merchant:1
    rubber_plantation: [
        {
            name: "改良品种",
            cost: { silver: 1200, wood: 50, tools: 10, science: 80 },
            input: {},
            output: { rubber: 1.04 }, // 1.3x
            jobs: { peasant: 6, worker: 3, merchant: 1 },
        },
        {
            name: "大规模种植园",
            cost: { silver: 2500, wood: 80, tools: 20, science: 150 },
            input: {},
            output: { rubber: 1.80 }, // 2.25x
            jobs: { peasant: 7, worker: 4, merchant: 1 },
        },
    ],

    // coal_power_plant: base output electricity: 1.4, base input coal:1.0, owner: engineer, base jobs: worker:6, engineer:2
    coal_power_plant: [
        {
            name: "高压锅炉",
            cost: { silver: 3500, steel: 40, brick: 40, science: 150 },
            input: { coal: 1.15 },
            output: { electricity: 1.80 },
            jobs: { worker: 7, engineer: 2 },
        },
        {
            name: "超临界机组",
            cost: { silver: 7000, steel: 80, brick: 60, science: 300 },
            input: { coal: 1.35 },
            output: { electricity: 2.40 },
            jobs: { worker: 8, engineer: 3 },
        },
    ],

    // oil_refinery: base output chemicals: 0.5, base input oil:0.6 coal:0.3 dye:0.1, owner: engineer, base jobs: worker:5, engineer:2
    oil_refinery: [
        {
            name: "催化裂解",
            cost: { silver: 3000, steel: 30, brick: 20, science: 150 },
            input: { oil: 0.78, coal: 0.39, dye: 0.13 },
            output: { chemicals: 0.65 }, // 1.3x
            jobs: { worker: 6, engineer: 2 },
        },
        {
            name: "连续精馏塔",
            cost: { silver: 6000, steel: 60, brick: 40, science: 300 },
            input: { oil: 1.35, coal: 0.675, dye: 0.225 },
            output: { chemicals: 1.125 }, // 2.25x
            jobs: { worker: 7, engineer: 3 },
        },
    ],

    // wiring_factory: base output wiring: 0.5, base input copper:0.8 rubber:0.3 electricity:0.08, owner: engineer, base jobs: worker:6, artisan:2, engineer:1
    wiring_factory: [
        {
            name: "连续拉丝机",
            cost: { silver: 2500, steel: 15, tools: 12, science: 120 },
            input: { copper: 1.04, rubber: 0.39, electricity: 0.104 },
            output: { wiring: 0.65 }, // 1.3x
            jobs: { worker: 7, artisan: 2, engineer: 1 },
        },
        {
            name: "多芯线自动化",
            cost: { silver: 5000, steel: 30, tools: 20, science: 250 },
            input: { copper: 1.80, rubber: 0.675, electricity: 0.18 },
            output: { wiring: 1.125 }, // 2.25x
            jobs: { worker: 8, artisan: 3, engineer: 1 },
        },
    ],

    // machinery_plant: base output machinery: 0.4, base input steel:0.3 iron:0.4 tools:0.2 electricity:0.1, owner: engineer, base jobs: worker:8, artisan:2, engineer:2
    machinery_plant: [
        {
            name: "精密车床",
            cost: { silver: 3500, steel: 45, iron: 30, tools: 15, science: 160 },
            input: { steel: 0.39, iron: 0.52, tools: 0.26, electricity: 0.13 },
            output: { machinery: 0.52 }, // 1.3x
            jobs: { worker: 9, artisan: 2, engineer: 2 },
        },
        {
            name: "数控加工",
            cost: { silver: 7000, steel: 80, iron: 50, tools: 30, science: 350 },
            input: { steel: 0.675, iron: 0.90, tools: 0.45, electricity: 0.225 },
            output: { machinery: 0.90 }, // 2.25x
            jobs: { worker: 10, artisan: 3, engineer: 2 },
        },
    ],

    // automobile_factory: base output automobile:0.25, base input steel:0.4 rubber:0.3 machinery:0.3 electricity:0.15, owner: capitalist
    automobile_factory: [
        {
            name: "改进流水线",
            cost: { silver: 6000, steel: 75, machinery: 15, science: 200 },
            input: { steel: 0.52, rubber: 0.39, machinery: 0.39, electricity: 0.195 },
            output: { automobile: 0.325 }, // 1.3x
            jobs: { worker: 12, artisan: 3, engineer: 2, capitalist: 1 },
        },
        {
            name: "全自动组装",
            cost: { silver: 12000, steel: 120, machinery: 25, science: 400 },
            input: { steel: 0.90, rubber: 0.675, machinery: 0.675, electricity: 0.3375 },
            output: { automobile: 0.5625 }, // 2.25x
            jobs: { worker: 14, artisan: 4, engineer: 3, capitalist: 1 },
        },
    ],

    // fertilizer_plant: base output fertilizer:0.8, base input chemicals:0.25 coal:0.15, owner: engineer
    fertilizer_plant: [
        {
            name: "高压合成",
            cost: { silver: 2200, steel: 12, brick: 15, science: 100 },
            input: { chemicals: 0.325, coal: 0.195 },
            output: { fertilizer: 1.04 }, // 1.3x
            jobs: { worker: 5, engineer: 1 },
        },
        {
            name: "缓释配方",
            cost: { silver: 4500, steel: 25, brick: 30, science: 200 },
            input: { chemicals: 0.5625, coal: 0.3375 },
            output: { fertilizer: 1.8 }, // 2.25x
            jobs: { worker: 6, engineer: 2 },
        },
    ],

    // advanced_copper_mine: base output copper: 3.2, base input electricity: 0.2, owner: capitalist
    advanced_copper_mine: [
        {
            name: "电气化竖井",
            cost: { silver: 2500, steel: 30, machinery: 8, science: 120 },
            input: { electricity: 0.24 },
            output: { copper: 3.68 },
            jobs: { miner: 6, worker: 3, engineer: 1 },
        },
        {
            name: "露天开采",
            cost: { silver: 5000, steel: 60, machinery: 15, science: 250 },
            input: { electricity: 0.30, tools: 0.06 },
            output: { copper: 5.06 },
            jobs: { miner: 7, worker: 3, engineer: 1 },
        },
    ],

    // broadcast_station: base output science:4.2 culture:2.0, base input electricity:0.3 papyrus:0.1, owner: official
    broadcast_station: [
        {
            name: "短波发射",
            cost: { silver: 3000, wiring: 15, steel: 12, science: 150 },
            input: { electricity: 0.36, papyrus: 0.11 },
            output: { science: 4.8, culture: 2.3 },
            jobs: { scribe: 3, worker: 2, engineer: 1 },
        },
        {
            name: "全国广播网",
            cost: { silver: 6000, wiring: 30, steel: 20, science: 300 },
            input: { electricity: 0.48, papyrus: 0.14 },
            output: { science: 5.8, culture: 2.8 },
            jobs: { scribe: 4, worker: 2, engineer: 1 },
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

    // electric_textile_mill: base output cloth:68.25 fine_clothes:5.60, base input cotton:3.0 coal:0.3 dye:0.5 electricity:0.35, owner: capitalist
    electric_textile_mill: [
        {
            name: "高速织机",
            cost: { steel: 500, brick: 400, tools: 200, silver: 2500, science: 300 },
            input: { cotton: 9.80, coal: 0.42, dye: 1.20, electricity: 0.44 },
            output: { cloth: 77.0, fine_clothes: 6.40 },
            jobs: { worker: 18, engineer: 3, capitalist: 1 },
        },
        {
            name: "全自动印染",
            cost: { steel: 800, brick: 600, tools: 350, silver: 5000, science: 600 },
            input: { cotton: 11.50, coal: 0.55, dye: 1.45, electricity: 0.58 },
            output: { cloth: 87.4, fine_clothes: 7.50 },
            jobs: { worker: 19, engineer: 3, capitalist: 1 },
        },
    ],

    // ============ 原子时代 (Epoch 8) 建筑升级 ============
    // uranium_mine: base output uranium: 0.6, owner: official
    uranium_mine: [
        {
            name: "离心浓缩",
            cost: { silver: 4000, steel: 45, tools: 20, science: 200 },
            input: {},
            output: { uranium: 0.78 }, // 1.3x
            jobs: { miner: 7, worker: 3 },
        },
        {
            name: "气体扩散法",
            cost: { silver: 8000, steel: 80, tools: 35, science: 400 },
            input: {},
            output: { uranium: 1.35 }, // 2.25x
            jobs: { miner: 8, worker: 4 },
        },
    ],

    // nuclear_power_plant: base output electricity: 4.5, base input uranium:0.18 steel:0.12 stone:0.08, owner: official
    nuclear_power_plant: [
        {
            name: "沸水反应堆",
            cost: { silver: 12000, steel: 120, stone: 150, brick: 70, science: 400 },
            input: { uranium: 0.22, steel: 0.14, stone: 0.10 },
            output: { electricity: 5.20 },
            jobs: { technician: 7, engineer: 3 },
        },
        {
            name: "快中子堆",
            cost: { silver: 25000, steel: 200, stone: 250, brick: 120, science: 800 },
            input: { uranium: 0.28, steel: 0.18, stone: 0.12 },
            output: { electricity: 7.20 },
            jobs: { technician: 8, engineer: 4 },
        },
    ],

    // plastics_factory: base output plastics: 0.5, base input chemicals:0.4 oil:0.3, owner: engineer
    plastics_factory: [
        {
            name: "注塑成型",
            cost: { silver: 4500, steel: 30, chemicals: 15, science: 180 },
            input: { chemicals: 0.52, oil: 0.39 },
            output: { plastics: 0.65 }, // 1.3x
            jobs: { worker: 6, technician: 3, engineer: 1 },
        },
        {
            name: "吹塑挤压",
            cost: { silver: 9000, steel: 60, chemicals: 30, science: 350 },
            input: { chemicals: 0.90, oil: 0.675 },
            output: { plastics: 1.125 }, // 2.25x
            jobs: { worker: 7, technician: 4, engineer: 1 },
        },
    ],

    // electronics_factory: base output electronics: 0.3, base input copper:0.3 wiring:0.3 chemicals:0.2 stone:0.2 electricity:0.12, owner: engineer
    electronics_factory: [
        {
            name: "洁净车间",
            cost: { silver: 6500, steel: 35, wiring: 20, chemicals: 15, science: 250 },
            input: { copper: 0.39, wiring: 0.39, chemicals: 0.26, stone: 0.26, electricity: 0.156 },
            output: { electronics: 0.39 }, // 1.3x
            jobs: { technician: 6, worker: 4, engineer: 2 },
        },
        {
            name: "微米级工艺",
            cost: { silver: 13000, steel: 70, wiring: 40, chemicals: 30, science: 500 },
            input: { copper: 0.675, wiring: 0.675, chemicals: 0.45, stone: 0.45, electricity: 0.27 },
            output: { electronics: 0.675 }, // 2.25x
            jobs: { technician: 7, worker: 5, engineer: 3 },
        },
    ],

    // pharmaceutical_plant: base output medicine: 0.25, base input chemicals:0.3 papyrus:0.2, owner: engineer
    pharmaceutical_plant: [
        {
            name: "GMP标准化",
            cost: { silver: 5000, steel: 20, chemicals: 12, science: 200 },
            input: { chemicals: 0.39, papyrus: 0.26 },
            output: { medicine: 0.325 }, // 1.3x
            jobs: { technician: 4, scribe: 2, engineer: 1 },
        },
        {
            name: "生物制剂",
            cost: { silver: 10000, steel: 40, chemicals: 25, science: 400 },
            input: { chemicals: 0.675, papyrus: 0.45 },
            output: { medicine: 0.5625 }, // 2.25x
            jobs: { technician: 5, scribe: 3, engineer: 2 },
        },
    ],

    // aluminum_smelter: base output aluminum: 0.35, base input stone:0.5 coal:0.3 electricity:0.5, owner: engineer
    aluminum_smelter: [
        {
            name: "预焙阳极",
            cost: { silver: 5500, steel: 35, brick: 30, science: 200 },
            input: { stone: 0.65, coal: 0.39, electricity: 0.65 },
            output: { aluminum: 0.455 }, // 1.3x
            jobs: { worker: 7, technician: 2, engineer: 1 },
        },
        {
            name: "惰性阳极",
            cost: { silver: 11000, steel: 70, brick: 50, science: 400 },
            input: { stone: 1.125, coal: 0.675, electricity: 1.125 },
            output: { aluminum: 0.7875 }, // 2.25x
            jobs: { worker: 8, technician: 3, engineer: 2 },
        },
    ],

    // appliance_factory: base output electronics:0.5, base input electronics:0.2 plastics:0.2 steel:0.1 electricity:0.2, owner: capitalist
    appliance_factory: [
        {
            name: "模块化组装",
            cost: { silver: 8000, steel: 45, electronics: 8, science: 250 },
            input: { electronics: 0.26, plastics: 0.26, steel: 0.13, electricity: 0.26 },
            output: { electronics: 0.65 }, // 1.3x
            jobs: { worker: 9, technician: 3, capitalist: 1 },
        },
        {
            name: "智能家电",
            cost: { silver: 16000, steel: 80, electronics: 15, science: 500 },
            input: { electronics: 0.45, plastics: 0.45, steel: 0.225, electricity: 0.45 },
            output: { electronics: 1.125 }, // 2.25x
            jobs: { worker: 10, technician: 4, capitalist: 1 },
        },
    ],

    // television_station: base output culture:4.6 science:1.6, base input electricity:0.3 electronics:0.05, owner: official
    television_station: [
        {
            name: "彩色广播",
            cost: { silver: 6500, electronics: 12, wiring: 15, steel: 15, science: 200 },
            input: { electricity: 0.34, electronics: 0.06 },
            output: { culture: 5.2, science: 1.8 },
            jobs: { scribe: 4, technician: 2, engineer: 1 },
        },
        {
            name: "卫星转播",
            cost: { silver: 13000, electronics: 25, wiring: 30, steel: 25, science: 400 },
            input: { electricity: 0.46, electronics: 0.08 },
            output: { culture: 6.4, science: 2.2 },
            jobs: { scribe: 4, technician: 2, engineer: 1 },
        },
    ],

    // high_rise_apartment: base output maxPop:120, base input electricity:0.08, owner: capitalist
    high_rise_apartment: [
        {
            name: "电梯公寓",
            cost: { silver: 5000, steel: 60, brick: 70, stone: 40, science: 150 },
            input: { electricity: 0.12 },
            output: { maxPop: 156 }, // 1.3x
            jobs: { worker: 2 },
        },
        {
            name: "豪华公寓",
            cost: { silver: 10000, steel: 100, brick: 120, stone: 70, science: 300 },
            input: { electricity: 0.18 },
            output: { maxPop: 270 }, // 2.25x
            jobs: { worker: 3 },
        },
    ],

    // military_industrial_complex: base output ordnance:0.3, base input electronics:0.15 steel:0.2 chemicals:0.1 electricity:0.15, owner: official
    military_industrial_complex: [
        {
            name: "精确制造",
            cost: { silver: 9000, steel: 70, electronics: 15, chemicals: 20, science: 300 },
            input: { electronics: 0.195, steel: 0.26, chemicals: 0.13, electricity: 0.195 },
            output: { ordnance: 0.39 }, // 1.3x
            jobs: { worker: 7, technician: 3, engineer: 2 },
        },
        {
            name: "模块化军工",
            cost: { silver: 18000, steel: 120, electronics: 30, chemicals: 40, science: 600 },
            input: { electronics: 0.3375, steel: 0.45, chemicals: 0.225, electricity: 0.3375 },
            output: { ordnance: 0.675 }, // 2.25x
            jobs: { worker: 8, technician: 4, engineer: 3 },
        },
    ],

    // synthetic_textile_mill: base output fine_clothes:16.2, base input synthetic_fiber:2.0 dye:0.5 electricity:0.3, owner: capitalist
    synthetic_textile_mill: [
        {
            name: "高速经编",
            cost: { steel: 600, brick: 500, tools: 300, silver: 3500, science: 350 },
            input: { synthetic_fiber: 2.80, dye: 0.68, electricity: 0.36 },
            output: { fine_clothes: 18.24 },
            jobs: { worker: 14, technician: 4, capitalist: 1 },
        },
        {
            name: "智能纺织",
            cost: { steel: 900, brick: 750, tools: 500, silver: 7000, science: 700 },
            input: { synthetic_fiber: 3.35, dye: 0.82, electricity: 0.44 },
            output: { fine_clothes: 21.0 },
            jobs: { worker: 15, technician: 4, capitalist: 1 },
        },
    ],

    // ============ 信息时代 (Epoch 9) 建筑升级 ============
    // semiconductor_fab: base output semiconductors:0.15, base input electronics:0.3 chemicals:0.2 copper:0.2 stone:0.1 composites:0.02 electricity:0.25, owner: capitalist
    semiconductor_fab: [
        {
            name: "14nm工艺",
            cost: { silver: 18000, steel: 80, electronics: 30, chemicals: 20, science: 500 },
            input: { electronics: 0.39, chemicals: 0.26, copper: 0.26, stone: 0.13, composites: 0.026, electricity: 0.325 },
            output: { semiconductors: 0.195 }, // 1.3x
            jobs: { technician: 7, scientist: 3, engineer: 2 },
        },
        {
            name: "3nm工艺",
            cost: { silver: 35000, steel: 150, electronics: 60, chemicals: 40, science: 1000 },
            input: { electronics: 0.675, chemicals: 0.45, copper: 0.45, stone: 0.225, composites: 0.045, electricity: 0.5625 },
            output: { semiconductors: 0.3375 }, // 2.25x
            jobs: { technician: 8, scientist: 4, engineer: 3 },
        },
    ],

    // software_company: base output software:0.2 science:0.3, base input semiconductors:0.05 electricity:0.3, owner: capitalist
    software_company: [
        {
            name: "敏捷开发",
            cost: { silver: 9000, electronics: 15, science: 300 },
            input: { semiconductors: 0.065, electricity: 0.39 },
            output: { software: 0.26, science: 0.39 }, // 1.3x
            jobs: { engineer: 5, technician: 3, capitalist: 1 },
        },
        {
            name: "AI辅助编程",
            cost: { silver: 18000, electronics: 30, science: 600 },
            input: { semiconductors: 0.1125, electricity: 0.675 },
            output: { software: 0.45, science: 0.675 }, // 2.25x
            jobs: { engineer: 6, technician: 4, capitalist: 1 },
        },
    ],

    // data_center: base output silver:4.0 science:0.5, base input semiconductors:0.05 electricity:0.5 steel:0.05 composites:0.03, owner: capitalist
    data_center: [
        {
            name: "虚拟化集群",
            cost: { silver: 12000, steel: 60, brick: 40, semiconductors: 8, science: 350 },
            input: { semiconductors: 0.065, electricity: 0.65, steel: 0.065, composites: 0.039 },
            output: { silver: 5.20, science: 0.65 }, // 1.3x
            jobs: { technician: 6, scientist: 2, engineer: 2 },
        },
        {
            name: "量子计算中心",
            cost: { silver: 25000, steel: 100, brick: 70, semiconductors: 15, science: 700 },
            input: { semiconductors: 0.1125, electricity: 1.125, steel: 0.1125, composites: 0.0675 },
            output: { silver: 9.00, science: 1.125 }, // 2.25x
            jobs: { technician: 7, scientist: 3, engineer: 3 },
        },
    ],

    // internet_platform: base output silver:3.5 culture:0.5, base input software:0.1 electricity:0.2, owner: capitalist
    internet_platform: [
        {
            name: "移动互联",
            cost: { silver: 10000, electronics: 12, software: 5, science: 250 },
            input: { software: 0.13, electricity: 0.26 },
            output: { silver: 4.55, culture: 0.65 }, // 1.3x
            jobs: { scientist: 3, scribe: 4, merchant: 2, capitalist: 1 },
        },
        {
            name: "元宇宙平台",
            cost: { silver: 20000, electronics: 25, software: 10, science: 500 },
            input: { software: 0.225, electricity: 0.45 },
            output: { silver: 7.875, culture: 1.125 }, // 2.25x
            jobs: { scientist: 4, scribe: 4, merchant: 3, capitalist: 1 },
        },
    ],

    // solar_power_plant: base output electricity:2.6, base input stone:0.08 aluminum:0.06 composites:0.04, owner: engineer
    solar_power_plant: [
        {
            name: "高效单晶硅",
            cost: { silver: 8000, semiconductors: 12, aluminum: 20, steel: 30, science: 250 },
            input: { stone: 0.10, aluminum: 0.075, composites: 0.05 },
            output: { electricity: 3.40 },
            jobs: { technician: 5, engineer: 2 },
        },
        {
            name: "钙钛矿串联",
            cost: { silver: 16000, semiconductors: 25, aluminum: 40, steel: 50, science: 500 },
            input: { stone: 0.13, aluminum: 0.095, composites: 0.065 },
            output: { electricity: 4.60 },
            jobs: { technician: 6, engineer: 3 },
        },
    ],

    // composites_factory: base output composites:0.25, base input plastics:0.3 aluminum:0.2 chemicals:0.1, owner: engineer
    composites_factory: [
        {
            name: "碳纤维增强",
            cost: { silver: 8500, aluminum: 15, plastics: 15, science: 250 },
            input: { plastics: 0.39, aluminum: 0.26, chemicals: 0.13 },
            output: { composites: 0.325 }, // 1.3x
            jobs: { technician: 5, worker: 3, engineer: 1 },
        },
        {
            name: "纳米复合材料",
            cost: { silver: 17000, aluminum: 30, plastics: 30, science: 500 },
            input: { plastics: 0.675, aluminum: 0.45, chemicals: 0.225 },
            output: { composites: 0.5625 }, // 2.25x
            jobs: { technician: 6, worker: 4, engineer: 2 },
        },
    ],

    // research_institute: base output science:8.0 culture:1.4, base input semiconductors:0.05 electricity:0.3 papyrus:0.15 composites:0.02, owner: official
    research_institute: [
        {
            name: "超级计算",
            cost: { silver: 15000, semiconductors: 15, electronics: 20, science: 500 },
            input: { semiconductors: 0.07, electricity: 0.36, papyrus: 0.18, composites: 0.03 },
            output: { science: 9.2, culture: 1.6 },
            jobs: { scientist: 4, scribe: 2, engineer: 2 },
        },
        {
            name: "AGI研究中心",
            cost: { silver: 30000, semiconductors: 30, electronics: 40, science: 1000 },
            input: { semiconductors: 0.09, electricity: 0.46, papyrus: 0.22, composites: 0.04 },
            output: { science: 10.8, culture: 2.0 },
            jobs: { scientist: 5, scribe: 2, engineer: 2 },
        },
    ],

    // financial_center: base output silver:5.0, base input software:0.1 electricity:0.2, owner: capitalist
    financial_center: [
        {
            name: "高频交易",
            cost: { silver: 14000, software: 8, electronics: 12, steel: 20, science: 350 },
            input: { software: 0.13, electricity: 0.26 },
            output: { silver: 6.50 }, // 1.3x
            jobs: { merchant: 5, scribe: 3, capitalist: 2 },
        },
        {
            name: "去中心化金融",
            cost: { silver: 28000, software: 15, electronics: 25, steel: 35, science: 700 },
            input: { software: 0.225, electricity: 0.45 },
            output: { silver: 11.25 }, // 2.25x
            jobs: { merchant: 6, scribe: 4, capitalist: 3 },
        },
    ],

    // biotech_center: base output science:1.5 medicine:0.15, base input medicine:0.1 electronics:0.05 chemicals:0.1, owner: official
    biotech_center: [
        {
            name: "基因编辑",
            cost: { silver: 12000, medicine: 15, electronics: 15, science: 400 },
            input: { medicine: 0.13, electronics: 0.065, chemicals: 0.13 },
            output: { science: 1.95, medicine: 0.195 }, // 1.3x
            jobs: { scientist: 6, technician: 3, engineer: 1 },
        },
        {
            name: "合成生物学",
            cost: { silver: 25000, medicine: 30, electronics: 30, science: 800 },
            input: { medicine: 0.225, electronics: 0.1125, chemicals: 0.225 },
            output: { science: 3.375, medicine: 0.3375 }, // 2.25x
            jobs: { scientist: 7, technician: 4, engineer: 2 },
        },
    ],

    // automated_mine: base output copper:2.4 iron:1.2 coal:1.9 stone:1.9, base input electricity:0.3, owner: capitalist
    automated_mine: [
        {
            name: "自主采掘",
            cost: { silver: 9000, semiconductors: 8, machinery: 15, steel: 40, science: 300 },
            input: { electricity: 0.39 },
            output: { copper: 3.0, iron: 1.5, coal: 2.3, stone: 2.3 },
            jobs: { technician: 4, engineer: 2 },
        },
        {
            name: "深海太空采矿",
            cost: { silver: 18000, semiconductors: 15, machinery: 30, steel: 70, science: 600 },
            input: { electricity: 0.675 },
            output: { copper: 4.25, iron: 2.0, coal: 3.1, stone: 3.1 },
            jobs: { technician: 5, engineer: 3 },
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
