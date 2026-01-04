// 建筑升级配置
// 定义各建筑的升级路径、费用和效果
// 
// 设计原则：
// 1. 产出倍率：基础 → Lv1(1.3x) → Lv2(2.25x) [调整自1.8x以确保人均产出提升]
// 2. 职业配置：只增加同类职业（owner 不能雇佣更高阶层的工人）
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
            output: { food: 4.16 }, // 1.3x
            jobs: { peasant: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "精耕田",
            cost: { plank: 80, brick: 40, tools: 15, silver: 800 },
            input: { tools: 0.08, wood: 0.1 }, // reasonable input increase
            output: { food: 7.2 }, // 2.25x
            jobs: { peasant: 3 }, // +1 peasant only
        },
    ],

    // lumber_camp: base output 2.56 wood, owner: lumberjack, base jobs: lumberjack:2
    lumber_camp: [
        {
            name: "大伐木场",
            cost: { wood: 80, stone: 30, tools: 10, silver: 250 },
            input: { tools: 0.05, food: 0.15 }, // modest input cost
            output: { wood: 3.33 }, // 1.3x
            jobs: { lumberjack: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "林场",
            cost: { plank: 60, brick: 30, tools: 20, silver: 600 },
            input: { tools: 0.1 }, // tools only, food removed
            output: { wood: 5.76, food: 0.15 }, // 2.25x + 林场野味
            jobs: { lumberjack: 3 }, // +1 lumberjack only
        },
    ],

    // quarry: base output 2.0 stone, owner: miner, base jobs: miner:2
    quarry: [
        {
            name: "深坑采石场",
            cost: { wood: 80, stone: 50, tools: 15, silver: 300 },
            input: { tools: 0.06, wood: 0.15, food: 0.15 }, // modest input cost
            output: { stone: 2.6 }, // 1.3x
            jobs: { miner: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大采石场",
            cost: { plank: 80, stone: 100, tools: 30, silver: 700 },
            input: { tools: 0.12, wood: 0.25, food: 0.25 }, // reasonable input increase
            output: { stone: 4.5, copper: 0.02 }, // 2.25x + 伴生矿
            jobs: { miner: 3 }, // +1 miner only
        },
    ],

    // loom_house: base output 1.92 cloth, owner: worker, base jobs: peasant:2
    loom_house: [
        {
            name: "织布坊",
            cost: { wood: 80, stone: 40, tools: 10, silver: 250 },
            input: { tools: 0.02 },
            output: { cloth: 2.5 }, // 1.3x
            jobs: { worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大织布坊",
            cost: { plank: 60, brick: 40, tools: 20, silver: 600 },
            input: { tools: 0.04, dye: 0.03 }, // 新增染料需求
            output: { cloth: 4.32, culture: 0.05 }, // 2.25x + 织艺文化
            jobs: { worker: 3 }, // +1 worker only
        },
    ],

    // brickworks: base output 2.4 brick, owner: worker, base jobs: worker:2
    brickworks: [
        {
            name: "改良砖窑",
            cost: { stone: 80, wood: 40, tools: 15, silver: 300 },
            input: { stone: 1.0, wood: 0.35, tools: 0.02 },
            output: { brick: 3.12 }, // 1.3x
            jobs: { worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大砖窑",
            cost: { stone: 120, brick: 80, tools: 30, silver: 700 },
            input: { stone: 1.5, wood: 0.5, tools: 0.04 },
            output: { brick: 5.4, tools: 0.02 }, // 2.25x + 模具生产
            jobs: { worker: 3 }, // +1 worker only
        },
    ],

    // stone_tool_workshop: base output 0.5 tools, owner: artisan, base jobs: artisan:2
    // 效率提升型升级：技艺精进，产出提升但岗位不增加
    stone_tool_workshop: [
        {
            name: "工匠铺",
            cost: { stone: 50, wood: 50, silver: 200 },
            input: { wood: 1.1, stone: 0.9 },
            output: { tools: 0.65 }, // 1.3x
            jobs: { artisan: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大工匠铺",
            cost: { brick: 40, plank: 40, silver: 500 },
            input: { wood: 1.5, stone: 1.2 },
            output: { tools: 0.9 }, // 1.8x
            jobs: { artisan: 2 }, // keep same, efficiency upgrade
        },
    ],

    // trading_post: base output food: 2, silver: 0.8, owner: merchant, base jobs: merchant:1
    trading_post: [
        {
            name: "商铺",
            cost: { wood: 100, stone: 40, silver: 400 },
            input: { tools: 0.01 },
            output: { food: 2.6, silver: 1.04 }, // 1.3x
            jobs: { merchant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "商会",
            cost: { plank: 80, brick: 60, silver: 900 },
            input: { tools: 0.02, papyrus: 0.01 },
            output: { food: 4.5, silver: 1.8, spice: 0.02 }, // 2.25x + 异域贸易
            jobs: { merchant: 2 }, // +1 merchant only
        },
    ],

    // library: base output science: 0.8, owner: scribe, base jobs: scribe:3
    // 效率提升型升级：知识管理优化，产出增加但岗位适度增加
    library: [
        {
            name: "学堂",
            cost: { stone: 150, plank: 40, papyrus: 30, brick: 40, silver: 600 },
            input: { papyrus: 0.08 },
            output: { science: 1.04 }, // 1.3x
            jobs: { scribe: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "书院",
            cost: { brick: 120, plank: 60, papyrus: 80, silver: 1400 },
            input: { papyrus: 0.15 },
            output: { science: 1.8, culture: 0.12 }, // 2.25x + 文教传承
            jobs: { scribe: 4 }, // +1 scribe only (officials are expensive)
        },
    ],

    // ========== 青铜时代建筑 ==========

    // copper_mine: base output 0.5 copper, owner: miner, base jobs: miner:3
    copper_mine: [
        {
            name: "深铜矿",
            cost: { wood: 120, tools: 20, silver: 350 },
            input: { tools: 0.05, wood: 0.2, food: 0.2 }, // modest input cost
            output: { copper: 0.65 }, // 1.3x
            jobs: { miner: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大铜矿",
            cost: { plank: 80, tools: 40, silver: 800 },
            input: { tools: 0.1, wood: 0.35, food: 0.35 }, // reasonable input increase
            output: { copper: 1.125, stone: 0.15 }, // 2.25x + 废石利用
            jobs: { miner: 4 }, // +1 miner only
        },
    ],

    // dye_works: base output 0.6 dye, owner: worker, base jobs: worker:2
    dye_works: [
        {
            name: "大染坊",
            cost: { wood: 60, stone: 25, tools: 10, silver: 250 },
            input: { food: 0.6, tools: 0.02 },
            output: { dye: 0.78 }, // 1.3x
            jobs: { worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "染色工坊",
            cost: { plank: 50, brick: 30, tools: 20, silver: 600 },
            input: { food: 0.9, tools: 0.04, cloth: 0.05 }, // 需要布料样本
            output: { dye: 1.35, culture: 0.05 }, // 2.25x + 染艺文化
            jobs: { worker: 3 }, // +1 worker only
        },
    ],

    // sawmill: base output 2.6 plank, owner: worker, base jobs: worker:3
    sawmill: [
        {
            name: "水力锯木坊",
            cost: { wood: 120, stone: 40, tools: 15, silver: 350 },
            input: { wood: 1.4, tools: 0.03 },
            output: { plank: 3.38 }, // 1.3x
            jobs: { worker: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大锯木坊",
            cost: { plank: 80, brick: 50, tools: 30, silver: 800 },
            input: { wood: 2.0, tools: 0.06, cloth: 0.05 }, // 需要布料（家具软垫）
            output: { plank: 5.85, furniture: 0.05 }, // 2.25x + 边角料家具
            jobs: { worker: 4 }, // +1 worker only
        },
    ],

    // bronze_foundry: base output 1.0 tools, owner: artisan, base jobs: worker:2, artisan:1
    // 效率提升型升级：熔炉改良，产出提升但岗位不增加
    bronze_foundry: [
        {
            name: "改良铸坊",
            cost: { stone: 60, copper: 25, silver: 300 },
            input: { copper: 0.5, wood: 0.3, tools: 0.01 },
            output: { tools: 1.3 }, // 1.3x
            jobs: { worker: 2, artisan: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铸坊",
            cost: { brick: 50, copper: 40, silver: 700 },
            input: { copper: 0.7, wood: 0.45, tools: 0.02 },
            output: { tools: 1.8 }, // 1.8x
            jobs: { worker: 2, artisan: 1 }, // keep same, efficiency upgrade
        },
    ],

    // amphitheater: base output 1.2 culture, owner: cleric, base jobs: cleric:2
    amphitheater: [
        {
            name: "大剧场",
            cost: { stone: 120, brick: 40, silver: 400 },
            input: { fine_clothes: 0.06 }, // 降低消耗
            output: { culture: 1.56, silver: 0.8 }, // 1.3x + 门票收入
            jobs: { cleric: 1 }, // 减少岗位，提升人均效率
        },
        {
            name: "宏伟剧场",
            cost: { brick: 80, furniture: 20, silver: 900 },
            input: { fine_clothes: 0.08, ale: 0.03 }, // 降低消耗
            output: { culture: 2.16, silver: 1.5 }, // 1.8x + 高额门票
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
            output: { papyrus: 0.78 }, // 1.3x
            jobs: { worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "大造纸坊",
            cost: { plank: 50, tools: 20, silver: 500 },
            input: { tools: 0.02 },
            output: { papyrus: 1.35, science: 0.05 }, // 2.25x + 研墨副产
            jobs: { worker: 3 }, // +1 worker only
        },
    ],

    // culinary_kitchen: base output 1.5 delicacies, owner: artisan, base jobs: artisan:2, peasant:1
    culinary_kitchen: [
        {
            name: "精致厨房",
            cost: { brick: 40, tools: 15, cloth: 8, silver: 350 },
            input: { tools: 0.08, food: 1.2 },
            output: { delicacies: 1.95 }, // 1.3x
            jobs: { artisan: 2, peasant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "御膳房",
            cost: { brick: 60, furniture: 15, delicacies: 20, silver: 800 },
            input: { tools: 0.12, food: 1.8, spice: 0.06 }, // 需要香料
            output: { delicacies: 3.375, culture: 0.08 }, // 2.25x + 美食文化
            jobs: { artisan: 2, peasant: 2 }, // +1 peasant only (artisan expensive)
        },
    ],

    // brewery: base output 1.2 ale, owner: worker, base jobs: worker:2
    brewery: [
        {
            name: "大酒坊",
            cost: { brick: 30, tools: 12, cloth: 6, silver: 280 },
            input: { food: 1.0, wood: 0.15, tools: 0.01 },
            output: { ale: 1.56 }, // 1.3x
            jobs: { worker: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "酿酒工坊",
            cost: { brick: 50, tools: 25, dye: 10, ale: 15, silver: 650 },
            input: { food: 1.5, wood: 0.25, tools: 0.02, spice: 0.03 }, // 需要香料调味
            output: { ale: 2.7, culture: 0.05 }, // 2.25x + 酒文化
            jobs: { worker: 3 }, // +1 worker only
        },
    ],

    // furniture_workshop: base output 1.2 furniture, owner: artisan, base jobs: artisan:3
    furniture_workshop: [
        {
            name: "精工家具坊",
            cost: { plank: 80, tools: 20, silver: 400 },
            input: { tools: 0.08, plank: 1.0, cloth: 0.25 },
            output: { furniture: 1.56 }, // 1.3x
            jobs: { artisan: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "大家具坊",
            cost: { plank: 120, furniture: 15, silver: 900 },
            input: { tools: 0.12, plank: 1.5, cloth: 0.35 },
            output: { furniture: 2.7 }, // 2.25x
            jobs: { artisan: 4 }, // +1 artisan only (no worker needed)
        },
    ],

    // tailor_workshop: base output 0.8 fine_clothes + 0.1 culture, owner: artisan, base jobs: artisan:2
    tailor_workshop: [
        {
            name: "高级成衣坊",
            cost: { plank: 50, tools: 15, silver: 350 },
            input: { tools: 0.035, cloth: 0.85, dye: 0.17 },
            output: { fine_clothes: 1.04, culture: 0.13 }, // 1.3x
            jobs: { artisan: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "御用成衣坊",
            cost: { brick: 40, fine_clothes: 10, silver: 800 },
            input: { tools: 0.05, cloth: 1.3, dye: 0.25 },
            output: { fine_clothes: 1.8, culture: 0.225 }, // 2.25x
            jobs: { artisan: 3 }, // +1 artisan only
        },
    ],

    // mine (iron): base output 0.5 iron, owner: capitalist, base jobs: miner:5, capitalist:1
    mine: [
        {
            name: "深井铁矿",
            cost: { plank: 80, tools: 25, silver: 400 },
            input: { tools: 0.08, wood: 0.2, food: 0.3 }, // modest input cost
            output: { iron: 1.65 }, // 1.3x
            jobs: { miner: 5, capitalist: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铁矿",
            cost: { brick: 60, tools: 40, silver: 900 },
            input: { tools: 0.15, wood: 0.35, food: 0.45 }, // reasonable input increase
            output: { iron: 2.86, coal: 0.05 }, // 2.25x + 煤层伴生
            jobs: { miner: 6, capitalist: 1 }, // +1 miner only
        },
    ],

    // iron_tool_workshop: base output 1.5 tools, owner: artisan, base jobs: worker:2, artisan:1
    // 效率提升型升级：锻造技术提升，产出增加但岗位不增加
    iron_tool_workshop: [
        {
            name: "精铁工坊",
            cost: { brick: 60, iron: 30, silver: 400 },
            input: { wood: 0.4, iron: 0.65, tools: 0.01 },
            output: { tools: 1.95 }, // 1.3x
            jobs: { worker: 2, artisan: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "大铁匠铺",
            cost: { brick: 100, iron: 50, silver: 900 },
            input: { wood: 0.6, iron: 1.0, tools: 0.02 },
            output: { tools: 2.7 }, // 1.8x
            jobs: { worker: 2, artisan: 1 }, // keep same, efficiency upgrade
        },
    ],

    // large_estate: base output 18.0 food, owner: landowner, base jobs: serf:6, landowner:1
    large_estate: [
        {
            name: "繁荣庄园",
            cost: { plank: 60, tools: 20, silver: 400 },
            input: { tools: 0.1, wood: 0.15 }, // modest input cost
            output: { food: 23.4 }, // 1.3x
            jobs: { serf: 6, landowner: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "领主庄园",
            cost: { brick: 50, furniture: 15, silver: 900 },
            input: { tools: 0.18, wood: 0.25, cloth: 0.05 }, // reasonable input increase
            output: { food: 40.5, cloth: 0.1, ale: 0.03 }, // 2.25x + small bonus products
            jobs: { serf: 7, landowner: 1 }, // +1 serf only
        },
    ],

    // church: base output culture: 0.8, silver: 0.5, owner: cleric, base jobs: cleric:3
    church: [
        {
            name: "大教堂",
            cost: { brick: 80, furniture: 25, silver: 500 },
            input: { furniture: 0.05, fine_clothes: 0.04 }, // 降低消耗
            output: { culture: 1.04, silver: 1.2 }, // 1.3x + 奉献收入
            jobs: { cleric: 2 }, // 减少岗位
        },
        {
            name: "主教座堂",
            cost: { brick: 150, furniture: 40, silver: 1200 },
            input: { furniture: 0.06, fine_clothes: 0.05, papyrus: 0.02 }, // 降低消耗
            output: { culture: 1.44, silver: 2.0, science: 0.15 }, // 1.8x + 高额奉献 + 神学
            jobs: { cleric: 3 }, // 减少岗位
        },
    ],


    // ========== 封建时代新建筑升级 ==========

    // monastery_cellar: base output ale: 2.0, culture: 0.25, owner: cleric, base jobs: cleric:1, worker:2
    monastery_cellar: [
        {
            name: "修道院大酒窖",
            cost: { stone: 80, tools: 20, silver: 400 },
            input: { food: 2.0, wood: 0.35 },
            output: { ale: 2.6, culture: 0.33 }, // 1.3x
            jobs: { cleric: 1, worker: 2 }, // keep same
        },
        {
            name: "酿酒修道院",
            cost: { brick: 100, furniture: 20, silver: 900 },
            input: { food: 2.7, wood: 0.5 },
            output: { ale: 4.5, culture: 0.56, science: 0.08 }, // 2.25x + 神学研究
            jobs: { cleric: 2, worker: 2 }, // +1 cleric
        },
    ],

    // wool_workshop: base output cloth: 3.2, fine_clothes: 0.2, owner: worker, base jobs: serf:3, worker:2
    wool_workshop: [
        {
            name: "大纺织工场",
            cost: { plank: 80, tools: 20, silver: 380 },
            input: { food: 0.7, tools: 0.04 },
            output: { cloth: 4.16, fine_clothes: 0.26 }, // 1.3x
            jobs: { serf: 3, worker: 2 }, // keep same
        },
        {
            name: "领主纺织工场",
            cost: { brick: 60, tools: 35, silver: 850 },
            input: { food: 1.0, tools: 0.06, dye: 0.05 }, // 需要染料
            output: { cloth: 7.2, fine_clothes: 0.45, culture: 0.05 }, // 2.25x + 织艺文化
            jobs: { serf: 4, worker: 2 }, // +1 serf
        },
    ],

    // stone_workshop: base output stone: 3.5, owner: miner, base jobs: miner:3, worker:1
    stone_workshop: [
        {
            name: "大采石工场",
            cost: { plank: 60, iron: 25, silver: 350 },
            input: { tools: 0.08, food: 0.15 },
            output: { stone: 4.55 }, // 1.3x
            jobs: { miner: 3, worker: 1 }, // keep same
        },
        {
            name: "皇家采石场",
            cost: { brick: 80, iron: 40, silver: 800 },
            input: { tools: 0.12, food: 0.25 },
            output: { stone: 7.875, brick: 0.15 }, // 2.25x + 砖石加工
            jobs: { miner: 4, worker: 1 }, // +1 miner
        },
    ],

    // hardwood_camp: base output 4.8 wood, owner: lumberjack, base jobs: lumberjack:4, worker:1
    hardwood_camp: [
        {
            name: "特用林场",
            cost: { plank: 80, tools: 30, silver: 450 },
            input: { tools: 0.1, food: 0.2 },
            output: { wood: 6.24 }, // 1.3x
            jobs: { lumberjack: 4, worker: 1 }, // keep same
        },
        {
            name: "皇家御林",
            cost: { brick: 80, tools: 50, silver: 900 },
            input: { tools: 0.15, food: 0.35 },
            output: { wood: 10.8, food: 0.2 }, // 2.25x + 狩猎副产
            jobs: { lumberjack: 5, worker: 1 }, // +1 lumberjack
        },
    ],

    // ========== 探索时代建筑 ==========

    // dockyard: base output 0.35 spice, owner: merchant, base jobs: navigator:2, worker:2, merchant:1
    dockyard: [
        {
            name: "大船坞",
            cost: { plank: 120, tools: 30, silver: 500 },
            input: { wood: 0.4, tools: 0.02 },
            output: { spice: 0.9 }, // 1.3x
            jobs: { navigator: 2, worker: 2, merchant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "皇家船厂",
            cost: { plank: 200, iron: 40, silver: 1100 },
            input: { wood: 0.6, tools: 0.03, cloth: 0.06 }, // 需要帆布
            output: { spice: 0.79, silver: 0.25, science: 0.05 }, // 2.25x + 贸易利润&航海测绘
            jobs: { navigator: 3, worker: 2, merchant: 1 }, // +1 navigator only
        },
    ],

    // navigator_school: base output science: 0.6, culture: 0.2, owner: official, base jobs: navigator:2, scribe:1, official:1
    navigator_school: [
        {
            name: "航海学府",
            cost: { plank: 80, papyrus: 40, silver: 400 },
            input: { papyrus: 0.05 },
            output: { science: 0.78, culture: 0.26 }, // 1.3x
            jobs: { navigator: 2, scribe: 1, official: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "皇家航海学院",
            cost: { brick: 60, papyrus: 80, silver: 900 },
            input: { papyrus: 0.08, coffee: 0.03 }, // 需要咖啡提神
            output: { science: 1.35, culture: 0.45 }, // 2.25x
            jobs: { navigator: 3, scribe: 1, official: 1 }, // +1 navigator only
        },
    ],

    // trade_port: base output food: 2.0, owner: merchant, base jobs: merchant:3
    trade_port: [
        {
            name: "繁荣港口",
            cost: { plank: 150, spice: 30, silver: 600 },
            input: { spice: 0.25 },
            output: { food: 2.6, silver: 0.15 }, // 1.3x
            jobs: { merchant: 3 }, // keep same, efficiency upgrade
        },
        {
            name: "贸易枢纽",
            cost: { brick: 120, spice: 60, silver: 1300 },
            input: { spice: 0.35, cloth: 0.06 }, // 需要帆布
            output: { food: 4.5, silver: 0.4 }, // 2.25x + 贸易利润
            jobs: { merchant: 4 }, // +1 merchant only
        },
    ],

    // shaft_mine: base output 1.2 iron, 0.8 copper, owner: miner, base jobs: miner:5, engineer:1
    shaft_mine: [
        {
            name: "通风矿井",
            cost: { brick: 120, tools: 45, silver: 650 },
            input: { tools: 0.14, wood: 0.3 },
            output: { iron: 1.56, copper: 1.04 }, // 1.3x
            jobs: { miner: 5, engineer: 1 }, // keep same
        },
        {
            name: "蒸汽矿井",
            cost: { brick: 200, steel: 50, tools: 80, silver: 1200 },
            input: { tools: 0.2, coal: 0.15, wood: 0.4 }, // 引入煤炭
            output: { iron: 2.7, copper: 1.8, coal: 0.1 }, // 2.25x + 煤炭回收
            jobs: { miner: 6, engineer: 1 }, // +1 miner
        },
    ],


    // ========== 探索时代新建筑升级 ==========

    // dye_workshop: base output dye: 1.2, fine_clothes: 0.3, owner: artisan, base jobs: artisan:2, worker:2
    dye_workshop: [
        {
            name: "大印染工坊",
            cost: { brick: 80, tools: 25, silver: 480 },
            input: { food: 0.9, cloth: 0.5, spice: 0.06 },
            output: { dye: 1.56, fine_clothes: 0.39 }, // 1.3x
            jobs: { artisan: 2, worker: 2 }, // keep same
        },
        {
            name: "皇家印染工坊",
            cost: { brick: 140, tools: 45, silver: 1050 },
            input: { food: 1.2, cloth: 0.7, spice: 0.08, iron: 0.02 }, // 需要金属染缸
            output: { dye: 2.7, fine_clothes: 0.675, culture: 0.08 }, // 2.25x + 织染艺术
            jobs: { artisan: 3, worker: 2 }, // +1 artisan
        },
    ],

    // coffee_plantation: base output 0.4 coffee, owner: merchant, base jobs: serf:4, merchant:1

    coffee_plantation: [
        {
            name: "大种植园",
            cost: { wood: 300, spice: 40, silver: 800 },
            input: { tools: 0.03 },
            output: { coffee: 0.52 }, // 1.3x
            jobs: { serf: 4, merchant: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "种植园庄园",
            cost: { plank: 200, tools: 60, silver: 1800 },
            input: { tools: 0.06 },
            output: { coffee: 0.9, spice: 0.02, food: 0.5 }, // 2.25x + 混种&粮食副产
            jobs: { serf: 5, merchant: 1 }, // +1 serf only
        },
    ],

    // coffee_house: base output culture: 1.0, science: 1.0, owner: merchant, base jobs: merchant:1, scribe:2
    // 效率提升型升级：氛围优化，产出增加但岗位不增加
    coffee_house: [
        {
            name: "文人咖啡馆",
            cost: { plank: 80, coffee: 25, silver: 400 },
            input: { coffee: 0.2, delicacies: 0.08 }, // 降低消耗
            output: { culture: 1.3, science: 1.3, silver: 0.6 }, // 1.3x + 消费收入
            jobs: { merchant: 1, scribe: 1 }, // 减少scribe岗位
        },
        {
            name: "沙龙",
            cost: { brick: 60, furniture: 25, silver: 900 },
            input: { coffee: 0.3, delicacies: 0.1 }, // 降低消耗
            output: { culture: 1.8, science: 1.8, silver: 1.2 }, // 1.8x + 高端消费
            jobs: { merchant: 1, scribe: 2 }, // 适度增加
        },
    ],

    // ========== 启蒙时代建筑 ==========

    // printing_house: base output science: ~1.2, owner: capitalist, base jobs: artisan:2, scribe:2, capitalist:1
    // 效率提升型升级：印刷机改良，产出增加但岗位不增加
    printing_house: [
        {
            name: "大印刷所",
            cost: { brick: 120, papyrus: 40, silver: 500 },
            input: { papyrus: 0.32, coffee: 0.06 },
            output: { science: 1.56 }, // 1.3x
            jobs: { artisan: 2, scribe: 2, capitalist: 1 }, // keep same
        },
        {
            name: "出版社",
            cost: { brick: 200, papyrus: 80, silver: 1100 },
            input: { papyrus: 0.5, coffee: 0.1 },
            output: { science: 2.16, culture: 0.3 }, // 1.8x + 文学出版
            jobs: { artisan: 2, scribe: 2, capitalist: 1 }, // keep same, efficiency upgrade
        },
    ],

    // textile_mill: base output cloth: ~5.0, fine_clothes: ~0.6, owner: capitalist, base jobs: worker:6, artisan:2, capitalist:1
    textile_mill: [
        {
            name: "大纺织厂",
            cost: { brick: 120, tools: 40, silver: 600 },
            input: { food: 0.6, dye: 0.25, tools: 0.02 },
            output: { cloth: 6.5, fine_clothes: 0.78 }, // 1.3x
            jobs: { worker: 6, artisan: 2, capitalist: 1 }, // keep same
        },
        {
            name: "纺织工场",
            cost: { brick: 200, tools: 60, silver: 1300 },
            input: { food: 0.9, dye: 0.4, tools: 0.03, coffee: 0.04 }, // 工人提神咖啡
            output: { cloth: 11.25, fine_clothes: 1.35 }, // 2.25x
            jobs: { worker: 7, artisan: 2, capitalist: 1 }, // +1 worker only
        },
    ],

    // lumber_mill: base output plank: ~8.0, owner: capitalist, base jobs: worker:5, artisan:1, capitalist:1
    lumber_mill: [
        {
            name: "大木材厂",
            cost: { brick: 100, tools: 35, silver: 500 },
            input: { wood: 2.4, tools: 0.02 },
            output: { plank: 10.4 }, // 1.3x
            jobs: { worker: 5, artisan: 1, capitalist: 1 }, // keep same
        },
        {
            name: "木业公司",
            cost: { brick: 180, tools: 50, silver: 1100 },
            input: { wood: 3.6, tools: 0.04 },
            output: { plank: 18.0, furniture: 0.12 }, // 2.25x + 木制品副产
            jobs: { worker: 6, artisan: 1, capitalist: 1 }, // +1 worker only
        },
    ],

    // building_materials_plant: base output brick: ~5.5, owner: capitalist, base jobs: worker:6, engineer:1, capitalist:1
    building_materials_plant: [
        {
            name: "大建材厂",
            cost: { brick: 120, tools: 35, silver: 550 },
            input: { stone: 1.6, wood: 0.5, coal: 0.12 },
            output: { brick: 7.15 }, // 1.3x
            jobs: { worker: 6, engineer: 1, capitalist: 1 }, // keep same
        },
        {
            name: "建材公司",
            cost: { brick: 200, tools: 50, silver: 1200 },
            input: { stone: 2.4, wood: 0.75, coal: 0.18 },
            output: { brick: 12.375 }, // 2.25x
            jobs: { worker: 7, engineer: 1, capitalist: 1 }, // +1 worker only
        },
    ],

    // distillery: base output ale: ~3.5, silver: ~0.8, owner: capitalist, base jobs: worker:5, artisan:2, capitalist:1
    distillery: [
        {
            name: "大蒸馏厂",
            cost: { brick: 150, copper: 50, silver: 600 },
            input: { food: 1.6, coal: 0.12 },
            output: { ale: 4.55, silver: 1.04 }, // 1.3x
            jobs: { worker: 5, artisan: 2, capitalist: 1 }, // keep same
        },
        {
            name: "酒业公司",
            cost: { brick: 250, copper: 80, silver: 1300 },
            input: { food: 2.5, coal: 0.18 },
            output: { ale: 7.875, silver: 1.8, culture: 0.1 }, // 2.25x + 品牌价值
            jobs: { worker: 6, artisan: 2, capitalist: 1 }, // +1 worker only
        },
    ],

    // paper_mill: base output papyrus: ~2.5, owner: capitalist, base jobs: worker:5, engineer:1, capitalist:1
    paper_mill: [
        {
            name: "大造纸厂",
            cost: { brick: 120, tools: 35, silver: 500 },
            input: { wood: 1.2, coal: 0.1 },
            output: { papyrus: 3.25 }, // 1.3x
            jobs: { worker: 5, engineer: 1, capitalist: 1 }, // keep same
        },
        {
            name: "造纸公司",
            cost: { brick: 200, tools: 50, silver: 1100 },
            input: { wood: 1.8, coal: 0.15 },
            output: { papyrus: 5.625, tools: 0.05 }, // 2.25x + 纸模工具
            jobs: { worker: 6, engineer: 1, capitalist: 1 }, // +1 worker only
        },
    ],

    // university: base output science: ~3.0, culture: ~0.8, owner: official, base jobs: scribe:4, engineer:2, official:2
    // 效率提升型升级：教学方法优化，产出增加但岗位适度增加
    university: [
        {
            name: "著名学府",
            cost: { brick: 250, papyrus: 60, silver: 750 },
            input: { papyrus: 0.25, coffee: 0.15, delicacies: 0.1 },
            output: { science: 3.9, culture: 1.04 }, // 1.3x
            jobs: { scribe: 4, engineer: 2, official: 2 }, // keep same, efficiency upgrade
        },
        {
            name: "皇家学院",
            cost: { brick: 400, papyrus: 120, silver: 1700 },
            input: { papyrus: 0.35, coffee: 0.2, delicacies: 0.12 },
            output: { science: 6.75, culture: 1.8 }, // 2.25x
            jobs: { scribe: 5, engineer: 2, official: 2 }, // +1 scribe only
        },
    ],

    // opera_house: base output culture: ~3.5, silver: ~1.0, owner: cleric, base jobs: cleric:4, artisan:2, merchant:1
    opera_house: [
        {
            name: "大歌剧院",
            cost: { brick: 250, furniture: 50, silver: 700 },
            input: { fine_clothes: 0.2, delicacies: 0.12 },
            output: { culture: 4.55, silver: 1.3 }, // 1.3x
            jobs: { cleric: 4, artisan: 2, merchant: 1 }, // keep same
        },
        {
            name: "皇家歌剧院",
            cost: { brick: 400, furniture: 80, silver: 1500 },
            input: { fine_clothes: 0.3, delicacies: 0.18, coffee: 0.08 }, // 中场休息咖啡
            output: { culture: 7.875, silver: 2.25, science: 0.15 }, // 2.25x + 戴剧艺术研究
            jobs: { cleric: 5, artisan: 2, merchant: 1 }, // +1 cleric only
        },    ],

    // ========== 工业时代建筑 ==========

    // coal_mine: base output 0.65 coal, owner: capitalist, base jobs: miner:6, capitalist:1
    // 激进升级：大幅提升煤炭产量以满足工业时代需求
    coal_mine: [
        {
            name: "深煤矿",
            cost: { plank: 150, tools: 40, silver: 500 },
            input: { tools: 0.15, wood: 0.4, food: 0.6 }, // 略微增加投入
            output: { coal: 2.0 }, // 约3x基础产量
            jobs: { miner: 7, capitalist: 1 }, // +1 miner
        },
        {
            name: "大煤矿",
            cost: { brick: 100, tools: 60, silver: 1100 },
            input: { tools: 0.25, wood: 0.6, food: 0.9 }, // 合理增加投入
            output: { coal: 4.0, iron: 0.1 }, // 约 6.15x 基础产量 + 煤矿伴生铁翻倍
            jobs: { miner: 9, capitalist: 1 }, // +3 miners 大规模采矿
        },
    ],

    // steel_foundry: base output steel: ~0.4, owner: capitalist, base jobs: engineer:3, worker:4, capitalist:1
    steel_foundry: [
        {
            name: "大炼钢厂",
            cost: { brick: 200, iron: 120, silver: 750 },
            input: { iron: 0.35, coal: 0.35 },
            output: { steel: 0.52 }, // 1.3x
            jobs: { engineer: 3, worker: 4, capitalist: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "钢铁联合厂",
            cost: { steel: 100, iron: 200, silver: 1700 },
            input: { iron: 0.55, coal: 0.55 },
            output: { steel: 0.9, tools: 0.1 }, // 2.25x + 钢工具副产
            jobs: { engineer: 3, worker: 5, capitalist: 1 }, // +1 worker only
        },
    ],

    // factory: base output tools: ~1.2, owner: capitalist, base jobs: worker:10, engineer:2, capitalist:1
    factory: [
        {
            name: "大工厂",
            cost: { brick: 300, steel: 120, silver: 850 },
            input: { steel: 0.15, coal: 0.15 },
            output: { tools: 1.56 }, // 1.3x
            jobs: { worker: 10, engineer: 2, capitalist: 1 }, // keep same
        },
        {
            name: "制造中心",
            cost: { steel: 200, tools: 80, silver: 1900 },
            input: { steel: 0.25, coal: 0.25 },
            output: { tools: 2.7, steel: 0.02, science: 0.05 }, // 2.25x + 废钢回收&工艺改良
            jobs: { worker: 11, engineer: 2, capitalist: 1 }, // +1 worker only
        },
    ],

    // industrial_mine: base output iron: ~1.7, copper: ~0.55, owner: capitalist, base jobs: miner:10, engineer:2, capitalist:1
    industrial_mine: [
        {
            name: "大工业矿场",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { tools: 0.18, coal: 0.35, wood: 0.4, food: 0.8 },
            output: { iron: 2.21, copper: 0.72 }, // 1.3x
            jobs: { miner: 10, engineer: 2, capitalist: 1 }, // keep same
        },
        {
            name: "矿业公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { tools: 0.28, coal: 0.5, wood: 0.6, food: 1.0 },
            output: { iron: 3.825, copper: 1.2375 }, // 2.25x
            jobs: { miner: 11, engineer: 2, capitalist: 1 }, // +1 miner only
        },
    ],

    // mechanized_farm: base output food: 22.0, owner: capitalist, base jobs: peasant:4, worker:4, engineer:1, capitalist:1
    mechanized_farm: [
        {
            name: "大机械农场",
            cost: { steel: 100, tools: 50, silver: 750 },
            input: { tools: 0.15, coal: 0.25, iron: 0.06 },
            output: { food: 28.6 }, // 1.3x
            jobs: { peasant: 4, worker: 4, engineer: 1, capitalist: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "工业农场",
            cost: { steel: 170, tools: 80, silver: 1700 },
            input: { tools: 0.25, coal: 0.4, iron: 0.1, dye: 0.03 }, // reasonable input increase
            output: { food: 49.5, cloth: 0.2 }, // 2.25x + small cloth bonus
            jobs: { peasant: 5, worker: 4, engineer: 1, capitalist: 1 }, // +1 peasant only
        },
    ],

    // logging_company: base output wood: 12.0, owner: capitalist, base jobs: lumberjack:6, worker:4, engineer:1, capitalist:1
    logging_company: [
        {
            name: "大伐木公司",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { tools: 0.12, coal: 0.18, food: 0.4 },
            output: { wood: 15.6 }, // 1.3x
            jobs: { lumberjack: 6, worker: 4, engineer: 1, capitalist: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "林业公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { tools: 0.2, coal: 0.28, food: 0.55 },
            output: { wood: 27.0 }, // 2.25x
            jobs: { lumberjack: 7, worker: 4, engineer: 1, capitalist: 1 }, // +1 lumberjack only
        },
    ],

    // prefab_factory: base output brick: ~11.0, owner: capitalist, base jobs: worker:10, engineer:2, capitalist:1
    prefab_factory: [
        {
            name: "大预制厂",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { brick: 1.2, steel: 0.1, stone: 0.5, coal: 0.2 },
            output: { brick: 14.3 }, // 1.3x
            jobs: { worker: 10, engineer: 2, capitalist: 1 }, // keep same, efficiency upgrade
        },
        {
            name: "建筑材料公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { brick: 1.8, steel: 0.15, stone: 0.8, coal: 0.3 },
            output: { brick: 24.75 }, // 2.25x
            jobs: { worker: 11, engineer: 2, capitalist: 1 }, // +1 worker only
        },
    ],

    // cannery: base output delicacies: ~3.5, owner: capitalist, base jobs: worker:8, artisan:2, engineer:1, capitalist:1
    cannery: [
        {
            name: "大罐头厂",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { food: 2.0, iron: 0.25, coal: 0.15 },
            output: { delicacies: 4.55 }, // 1.3x
            jobs: { worker: 9, artisan: 2, engineer: 1, capitalist: 1 }, // +1 worker only
        },
        {
            name: "食品公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { food: 3.0, iron: 0.35, coal: 0.2 },
            output: { delicacies: 7.875, ale: 0.3 }, // 2.25x + 饮料生产
            jobs: { worker: 10, artisan: 3, engineer: 1, capitalist: 1 }, // reasonable scaling
        },
    ],

    // garment_factory: base output fine_clothes: ~2.8, culture: ~0.3, owner: capitalist, base jobs: worker:12, artisan:3, engineer:1, capitalist:1
    garment_factory: [
        {
            name: "大服装厂",
            cost: { steel: 100, tools: 60, silver: 850 },
            input: { cloth: 2.0, dye: 0.4, coal: 0.2 },
            output: { fine_clothes: 3.64, culture: 0.39 }, // 1.3x
            jobs: { worker: 12, artisan: 3, engineer: 1, capitalist: 1 }, // keep same
        },
        {
            name: "服装公司",
            cost: { steel: 170, tools: 100, silver: 1900 },
            input: { cloth: 3.0, dye: 0.6, coal: 0.25 },
            output: { fine_clothes: 6.3, culture: 0.675, cloth: 0.5 }, // 2.25x + 边角布料回收
            jobs: { worker: 14, artisan: 3, engineer: 1, capitalist: 1 }, // +2 workers only
        },
    ],

    // furniture_factory: base output furniture: ~3.5, culture: ~0.2, owner: capitalist, base jobs: worker:8, artisan:2, engineer:1, capitalist:1
    furniture_factory: [
        {
            name: "大家具厂",
            cost: { steel: 80, tools: 50, silver: 750 },
            input: { plank: 2.0, cloth: 0.6, coal: 0.12 },
            output: { furniture: 4.55, culture: 0.26 }, // 1.3x
            jobs: { worker: 8, artisan: 2, engineer: 1, capitalist: 1 }, // keep same
        },
        {
            name: "家具公司",
            cost: { steel: 150, tools: 80, silver: 1700 },
            input: { plank: 3.0, cloth: 0.9, coal: 0.2 },
            output: { furniture: 7.875, culture: 0.45, plank: 0.4 }, // 2.25x + 木材下脚料
            jobs: { worker: 9, artisan: 2, engineer: 1, capitalist: 1 }, // +1 worker only
        },
    ],

    // market: base output food: ~2.0 (from trade), owner: merchant, base jobs: merchant:2
    // Note: Market's primary function is trade balancing, not direct production
    market: [
        {
            name: "大市场",
            cost: { brick: 300, papyrus: 60, cloth: 15, silver: 1000 },
            input: { papyrus: 0.08, coffee: 0.05 },
            output: { food: 2.6, silver: 0.3 }, // 1.3x food, small silver bonus
            jobs: { merchant: 2, scribe: 1 }, // +1 scribe for records
        },
        {
            name: "交易所",
            cost: { steel: 200, papyrus: 120, delicacies: 30, silver: 2200 },
            input: { papyrus: 0.12, coffee: 0.08 },
            output: { food: 4.5, silver: 0.5, culture: 0.15 }, // 2.25x + 商业文化
            jobs: { merchant: 3, scribe: 1 }, // +1 merchant (capitalist too expensive)
        },
    ],

    // rail_depot: base output silver: ~1.5, maxPop: ~14, owner: capitalist, base jobs: engineer:2, merchant:2, capitalist:1
    rail_depot: [
        {
            name: "大铁路站",
            cost: { steel: 120, coal: 80, silver: 850 },
            input: { coal: 0.3, ale: 0.08, delicacies: 0.04 },
            output: { silver: 1.95, maxPop: 18 }, // 1.3x
            jobs: { engineer: 2, merchant: 2, capitalist: 1 }, // keep same
        },
        {
            name: "铁路枢纽",
            cost: { steel: 220, coal: 150, silver: 1900 },
            input: { coal: 0.45, ale: 0.12, delicacies: 0.06 },
            output: { silver: 2.7, maxPop: 25, food: 0.5, culture: 0.1 }, // 1.8x + 站台商业&交通文化
            jobs: { engineer: 2, merchant: 2, capitalist: 1 }, // keep same, efficiency upgrade
        },
    ],

    // metallurgy_workshop: base output tools: ~3.0, owner: artisan, base jobs: worker:4, artisan:2, engineer:1
    metallurgy_workshop: [
        {
            name: "精密冶金坊",
            cost: { brick: 120, iron: 60, silver: 600 },
            input: { iron: 1.2, copper: 0.25, wood: 0.6 },
            output: { tools: 3.9 }, // 1.3x
            jobs: { worker: 4, artisan: 2, engineer: 1 }, // keep same
        },
        {
            name: "大冶金坊",
            cost: { brick: 200, iron: 100, silver: 1300 },
            input: { iron: 1.8, copper: 0.4, wood: 0.9, coal: 0.08 }, // 需要煤炭燃料
            output: { tools: 6.75 }, // 2.25x
            jobs: { worker: 5, artisan: 2, engineer: 1 }, // +1 worker only
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
