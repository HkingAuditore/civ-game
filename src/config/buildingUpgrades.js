// 建筑升级配置
// 定义各建筑的升级路径、费用和效果
// 
// 设计原则：
// 1. 产出倍率：基础 → Lv1(1.3x) → Lv2(1.8x) [NERFED from 1.5x/2.5x]
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

    // farm: base output 4.0, owner: peasant
    farm: [
        {
            name: "灌溉田",
            cost: { wood: 50, stone: 20, tools: 5, silver: 300 },
            input: { tools: 0.08, wood: 0.1 }, // increased tools, added wood for irrigation
            output: { food: 5.2 }, // 1.3x
            jobs: { peasant: 3 },
        },
        {
            name: "精耕田",
            cost: { plank: 80, brick: 40, tools: 15, silver: 800 },
            input: { tools: 0.15, wood: 0.2 }, // increased tools and wood
            output: { food: 7.2 }, // 1.8x
            jobs: { peasant: 4 },
        },
    ],

    // lumber_camp: base output 3.2, owner: lumberjack
    lumber_camp: [
        {
            name: "大伐木场",
            cost: { wood: 80, stone: 30, tools: 10, silver: 250 },
            input: { tools: 0.1, food: 0.3 }, // added food for workers
            output: { wood: 4.2 }, // 1.3x
            jobs: { lumberjack: 3 },
        },
        {
            name: "林场",
            cost: { plank: 60, brick: 30, tools: 20, silver: 600 },
            input: { tools: 0.18, food: 0.4 }, // increased inputs
            output: { wood: 5.8, food: 0.2 }, // 1.8x + 林场野味
            jobs: { lumberjack: 4 },
        },
    ],

    // quarry: base output 2.5, owner: miner
    quarry: [
        {
            name: "深坑采石场",
            cost: { wood: 80, stone: 50, tools: 15, silver: 300 },
            input: { tools: 0.12, wood: 0.3, food: 0.3 }, // added food for workers
            output: { stone: 3.25 }, // 1.3x
            jobs: { miner: 3 },
        },
        {
            name: "大采石场",
            cost: { plank: 80, stone: 100, tools: 30, silver: 700 },
            input: { tools: 0.2, wood: 0.5, food: 0.5 }, // increased all inputs
            output: { stone: 4.5, copper: 0.03 }, // 1.8x + 伴生矿
            jobs: { miner: 4 },
        },
    ],

    // loom_house: base output 2.4 cloth, owner: peasant
    loom_house: [
        {
            name: "织布坊",
            cost: { wood: 80, stone: 40, tools: 10, silver: 250 },
            input: { tools: 0.03 },
            output: { cloth: 3.1 }, // 1.3x
            jobs: { peasant: 3 },
        },
        {
            name: "大织布坊",
            cost: { plank: 60, brick: 40, tools: 20, silver: 600 },
            input: { tools: 0.06, dye: 0.05 }, // 新增染料需求
            output: { cloth: 4.3, culture: 0.07 }, // 1.8x + 织艺文化
            jobs: { peasant: 4 },
        },
    ],

    // brickworks: base output ~3.0 brick (estimated), owner: worker
    brickworks: [
        {
            name: "改良砖窑",
            cost: { stone: 80, wood: 40, tools: 15, silver: 300 },
            input: { stone: 1.2, wood: 0.6, tools: 0.03 },
            output: { brick: 3.9 }, // 1.3x
            jobs: { worker: 3 },
        },
        {
            name: "大砖窑",
            cost: { stone: 120, brick: 80, tools: 30, silver: 700 },
            input: { stone: 2.0, wood: 1.0, tools: 0.06 },
            output: { brick: 5.4, tools: 0.03 }, // 1.8x + 模具生产
            jobs: { worker: 4 },
        },
    ],

    // stone_tool_workshop: base output ~1.0 tools, owner: artisan
    // 效率提升型升级：技艺精进，产出提升但岗位不增加
    stone_tool_workshop: [
        {
            name: "工匠铺",
            cost: { stone: 50, wood: 50, silver: 200 },
            input: { wood: 1.2, stone: 1.0 },
            output: { tools: 1.3 }, // 1.3x
            jobs: { artisan: 2 }, // 保持不变，技艺精进
        },
        {
            name: "大工匠铺",
            cost: { brick: 40, plank: 40, silver: 500 },
            input: { wood: 2.0, stone: 1.5 },
            output: { tools: 1.8 }, // 1.8x
            jobs: { artisan: 2 }, // 效率提升，不需要更多人
        },
    ],

    // trading_post: base output food: 2, silver: 0.8, owner: merchant
    trading_post: [
        {
            name: "商铺",
            cost: { wood: 100, stone: 40, silver: 400 },
            input: { tools: 0.02 },
            output: { food: 2.6, silver: 1.0 }, // 1.3x
            jobs: { merchant: 2 },
        },
        {
            name: "商会",
            cost: { plank: 80, brick: 60, silver: 900 },
            input: { tools: 0.04, papyrus: 0.02 },
            output: { food: 3.6, silver: 1.4, spice: 0.03 }, // 1.8x + 异域贸易
            jobs: { merchant: 3 },
        },
    ],

    // library: base output science: 2.0, owner: scribe
    // 效率提升型升级：知识管理优化，产出增加但岗位不增加
    library: [
        {
            name: "学堂",
            cost: { stone: 150, plank: 40, papyrus: 30, silver: 600 },
            input: { papyrus: 0.1 },
            output: { science: 2.6 }, // 1.3x
            jobs: { scribe: 4 }, // 规模扩大
        },
        {
            name: "书院",
            cost: { brick: 120, plank: 60, papyrus: 80, silver: 1400 },
            input: { papyrus: 0.2 },
            output: { science: 3.6, culture: 0.14 }, // 1.8x + 文教传承
            jobs: { scribe: 4, official: 1 }, // 规模扩大，增加管理者
        },
    ],

    // ========== 青铜时代建筑 ==========

    // copper_mine: base output 0.5 copper, owner: miner
    copper_mine: [
        {
            name: "深铜矿",
            cost: { wood: 120, tools: 20, silver: 350 },
            input: { tools: 0.12, wood: 0.4, food: 0.4 }, // increased inputs, added food
            output: { copper: 0.65 }, // 1.3x
            jobs: { miner: 4 },
        },
        {
            name: "大铜矿",
            cost: { plank: 80, tools: 40, silver: 800 },
            input: { tools: 0.2, wood: 0.6, food: 0.6 }, // increased all inputs
            output: { copper: 0.9, stone: 0.2 }, // 1.8x + 废石利用
            jobs: { miner: 5 },
        },
    ],

    // dye_works: base output 0.6 dye, owner: artisan (but has peasant jobs)
    dye_works: [
        {
            name: "大染坊",
            cost: { wood: 60, stone: 25, tools: 10, silver: 250 },
            input: { food: 0.8, tools: 0.03 },
            output: { dye: 0.78 }, // 1.3x
            jobs: { peasant: 2, artisan: 1 }, // 增加工匠指导
        },
        {
            name: "染色工坊",
            cost: { plank: 50, brick: 30, tools: 20, silver: 600 },
            input: { food: 1.2, tools: 0.06, cloth: 0.1 }, // 需要布料样本
            output: { dye: 1.08, culture: 0.07 }, // 1.8x + 染艺文化
            jobs: { peasant: 2, artisan: 2 }, // 工匠比例提升
        },
    ],

    // sawmill: base output ~4.0 plank (estimated), owner: worker
    sawmill: [
        {
            name: "水力锯木坊",
            cost: { wood: 120, stone: 40, tools: 15, silver: 350 },
            input: { wood: 2.0, tools: 0.05 },
            output: { plank: 5.2 }, // 1.3x
            jobs: { worker: 3 },
        },
        {
            name: "大锯木坊",
            cost: { plank: 80, brick: 50, tools: 30, silver: 800 },
            input: { wood: 3.0, tools: 0.1, cloth: 0.1 }, // 需要布料（家具软垫）
            output: { plank: 7.2, furniture: 0.07 }, // 1.8x + 边角料家具
            jobs: { worker: 4 },
        },
    ],

    // bronze_foundry: base output ~1.0 tools, owner: worker
    // 效率提升型升级：熔炉改良，产出提升但岗位不增加
    bronze_foundry: [
        {
            name: "改良铸坊",
            cost: { stone: 60, copper: 25, silver: 300 },
            input: { copper: 0.4, wood: 0.25, tools: 0.02 },
            output: { tools: 1.3 }, // 1.3x
            jobs: { worker: 2, artisan: 1 }, // 保持总人数不变
        },
        {
            name: "大铸坊",
            cost: { brick: 50, copper: 40, silver: 700 },
            input: { copper: 0.6, wood: 0.4, tools: 0.04 },
            output: { tools: 1.8 }, // 1.8x
            jobs: { worker: 2, artisan: 1 }, // 熔炉改良，效率提升
        },
    ],

    // amphitheater: base output 1.2 culture, owner: cleric, base jobs: cleric:2
    amphitheater: [
        {
            name: "大剧场",
            cost: { stone: 120, brick: 40, silver: 400 },
            input: { fine_clothes: 0.1 },
            output: { culture: 1.56 }, // 1.3x
            jobs: { cleric: 2, peasant: 1 }, // 规模扩大，新增杂务
        },
        {
            name: "宏伟剧场",
            cost: { brick: 80, furniture: 20, silver: 900 },
            input: { fine_clothes: 0.15, ale: 0.1 }, // 演出招待
            output: { culture: 2.16, silver: 0.2 }, // 1.8x + 门票收入
            jobs: { cleric: 3, peasant: 1 }, // +1 cleric
        },
    ],

    // ========== 古典/封建时代建筑 ==========

    // reed_works: base output 0.6 papyrus, owner: peasant
    reed_works: [
        {
            name: "改良造纸坊",
            cost: { wood: 60, tools: 10, silver: 220 },
            input: { tools: 0.02 },
            output: { papyrus: 0.78 }, // 1.3x
            jobs: { peasant: 3 },
        },
        {
            name: "大造纸坊",
            cost: { plank: 50, tools: 20, silver: 500 },
            input: { tools: 0.04 },
            output: { papyrus: 1.08, science: 0.07 }, // 1.8x + 研墨副产
            jobs: { peasant: 4 },
        },
    ],

    // culinary_kitchen: base output 1.5 delicacies, owner: artisan, base jobs: artisan:2, peasant:1
    culinary_kitchen: [
        {
            name: "精致厨房",
            cost: { brick: 40, tools: 15, silver: 350 },
            input: { tools: 0.06, food: 1.0 },
            output: { delicacies: 1.95 }, // 1.3x
            jobs: { artisan: 2, peasant: 2 }, // 新增帮厨
        },
        {
            name: "御膳房",
            cost: { brick: 60, furniture: 15, silver: 800 },
            input: { tools: 0.1, food: 1.5, spice: 0.1 }, // 需要香料
            output: { delicacies: 2.7, culture: 0.1 }, // 1.8x + 美食文化
            jobs: { artisan: 3, peasant: 2 }, // +1 artisan
        },
    ],

    // brewery: base output 1.2 ale, owner: worker
    brewery: [
        {
            name: "大酒坊",
            cost: { brick: 30, tools: 12, silver: 280 },
            input: { food: 0.8, wood: 0.15, tools: 0.02 },
            output: { ale: 1.56 }, // 1.3x
            jobs: { worker: 3 },
        },
        {
            name: "酿酒工坊",
            cost: { brick: 50, tools: 25, silver: 650 },
            input: { food: 1.2, wood: 0.25, tools: 0.04, spice: 0.05 }, // 需要香料调味
            output: { ale: 2.16, culture: 0.07 }, // 1.8x + 酒文化
            jobs: { worker: 4 },
        },
    ],

    // furniture_workshop: base output 1.2 furniture, owner: artisan, base jobs: artisan:3
    furniture_workshop: [
        {
            name: "精工家具坊",
            cost: { plank: 80, tools: 20, silver: 400 },
            input: { tools: 0.06, plank: 0.8, cloth: 0.2 },
            output: { furniture: 1.56 }, // 1.3x
            jobs: { artisan: 3, worker: 1 }, // 工人学徒（而非自耕农）
        },
        {
            name: "大家具坊",
            cost: { plank: 120, furniture: 15, silver: 900 },
            input: { tools: 0.1, plank: 1.2, cloth: 0.3 },
            output: { furniture: 2.16 }, // 1.8x
            jobs: { artisan: 4, worker: 1 }, // +1 artisan
        },
    ],

    // tailor_workshop: base output 0.8 fine_clothes, owner: artisan, base jobs: artisan:2
    tailor_workshop: [
        {
            name: "高级成衣坊",
            cost: { plank: 50, tools: 15, silver: 350 },
            input: { tools: 0.03, cloth: 0.8, dye: 0.15 },
            output: { fine_clothes: 1.04, culture: 0.08 }, // 1.3x
            jobs: { artisan: 2, worker: 1 }, // 工人辅助（而非自耕农）
        },
        {
            name: "御用成衣坊",
            cost: { brick: 40, fine_clothes: 10, silver: 800 },
            input: { tools: 0.05, cloth: 1.2, dye: 0.25 },
            output: { fine_clothes: 1.44, culture: 0.14 }, // 1.8x
            jobs: { artisan: 3, worker: 1 }, // +1 artisan
        },
    ],

    // mine (iron): base output 0.5 iron, owner: capitalist
    mine: [
        {
            name: "深井铁矿",
            cost: { plank: 80, tools: 25, silver: 400 },
            input: { tools: 0.15, wood: 0.4, food: 0.6 }, // added wood (supports), food (miners)
            output: { iron: 0.65 }, // 1.3x
            jobs: { miner: 6, capitalist: 1 },
        },
        {
            name: "大铁矿",
            cost: { brick: 60, tools: 40, silver: 900 },
            input: { tools: 0.25, wood: 0.6, food: 0.8 }, // increased all inputs
            output: { iron: 0.9, coal: 0.07 }, // 1.8x + 煤层伴生
            jobs: { miner: 8, capitalist: 1 },
        },
    ],

    // iron_tool_workshop: base output ~1.4 tools, owner: worker/artisan
    // 效率提升型升级：锻造技术提升，产出增加但岗位不增加
    iron_tool_workshop: [
        {
            name: "精铁工坊",
            cost: { brick: 60, iron: 30, silver: 400 },
            input: { wood: 0.3, iron: 0.5, tools: 0.02 },
            output: { tools: 1.82 }, // 1.3x
            jobs: { worker: 2, artisan: 1 }, // 效率提升型
        },
        {
            name: "大铁匠铺",
            cost: { brick: 100, iron: 50, silver: 900 },
            input: { wood: 0.5, iron: 0.8, tools: 0.04 },
            output: { tools: 2.52 }, // 1.8x
            jobs: { worker: 2, artisan: 1 }, // 锻造技术提升
        },
    ],

    // large_estate: base output 18.0 food, owner: landowner
    large_estate: [
        {
            name: "繁荣庄园",
            cost: { plank: 60, tools: 20, silver: 400 },
            input: { tools: 0.2, wood: 0.3 }, // significantly increased tools for farming equipment
            output: { food: 20.0 }, // reduced from 23.4, ~1.1x multiplier
            jobs: { serf: 8, landowner: 1 },
        },
        {
            name: "领主庄园",
            cost: { brick: 50, furniture: 15, silver: 900 },
            input: { tools: 0.4, wood: 0.5, cloth: 0.1 }, // much higher input requirements
            output: { food: 25.0, cloth: 0.15, ale: 0.05 }, // reduced from 32.4, ~1.4x multiplier
            jobs: { serf: 10, landowner: 1 },
        },
    ],

    // church: base output culture: 0.8, silver: 0.5, owner: cleric, base jobs: cleric:3
    church: [
        {
            name: "大教堂",
            cost: { brick: 80, furniture: 25, silver: 500 },
            input: { furniture: 0.08, fine_clothes: 0.06 },
            output: { culture: 1.04, silver: 0.65 }, // 1.3x
            jobs: { cleric: 3, peasant: 1 }, // 新增维护
        },
        {
            name: "主教座堂",
            cost: { brick: 150, furniture: 40, silver: 1200 },
            input: { furniture: 0.12, fine_clothes: 0.1, papyrus: 0.05 }, // 需要经书纸张
            output: { culture: 1.44, silver: 0.9, science: 0.14 }, // 1.8x + 神学研究
            jobs: { cleric: 4, peasant: 1 }, // +1 cleric
        },
    ],

    // ========== 探索时代建筑 ==========

    // dockyard: base output ~0.35 spice, owner: merchant, base jobs: navigator:2, worker:2, merchant:1
    dockyard: [
        {
            name: "大船坞",
            cost: { plank: 120, tools: 30, silver: 500 },
            input: { wood: 0.3, tools: 0.02 },
            output: { spice: 0.46 }, // 1.3x
            jobs: { navigator: 2, worker: 3, merchant: 1 }, // +1 worker
        },
        {
            name: "皇家船厂",
            cost: { plank: 200, iron: 40, silver: 1100 },
            input: { wood: 0.5, tools: 0.04, cloth: 0.1 }, // 需要帆布
            output: { spice: 0.63, silver: 0.35, science: 0.07 }, // 1.8x + 贸易利润&航海测绘
            jobs: { navigator: 3, worker: 3, merchant: 1 }, // +1 navigator
        },
    ],

    // navigator_school: base output science: 0.6, culture: 0.2, owner: official
    navigator_school: [
        {
            name: "航海学府",
            cost: { plank: 80, papyrus: 40, silver: 400 },
            input: { papyrus: 0.04 },
            output: { science: 0.78, culture: 0.26 }, // 1.3x
            jobs: { navigator: 3, scribe: 1, official: 1 },
        },
        {
            name: "皇家航海学院",
            cost: { brick: 60, papyrus: 80, silver: 900 },
            input: { papyrus: 0.06, coffee: 0.03 }, // 需要咖啡提神
            output: { science: 1.08, culture: 0.36 }, // 1.8x
            jobs: { navigator: 4, scribe: 1, official: 1 },
        },
    ],

    // trade_port: base output food: 2.0, owner: merchant, base jobs: merchant:3
    trade_port: [
        {
            name: "繁荣港口",
            cost: { plank: 150, spice: 30, silver: 600 },
            input: { spice: 0.2 },
            output: { food: 2.6, silver: 0.2 }, // 1.3x
            jobs: { merchant: 3, worker: 1 }, // 新增搐运工
        },
        {
            name: "贸易枢纽",
            cost: { brick: 120, spice: 60, silver: 1300 },
            input: { spice: 0.3, cloth: 0.1 }, // 需要帆布
            output: { food: 3.6, silver: 0.35, spice: 0.07 }, // 1.8x + 转口贸易
            jobs: { merchant: 4, worker: 2 }, // +1 merchant, +1 搐运工
        },
    ],

    // coffee_plantation: base output 0.4 coffee, owner: merchant
    coffee_plantation: [
        {
            name: "大种植园",
            cost: { wood: 300, spice: 40, silver: 800 },
            input: { tools: 0.05 },
            output: { coffee: 0.52 }, // 1.3x
            jobs: { serf: 5, merchant: 1 },
        },
        {
            name: "种植园庄园",
            cost: { plank: 200, tools: 60, silver: 1800 },
            input: { tools: 0.1 },
            output: { coffee: 0.72, spice: 0.03, food: 0.7 }, // 1.8x + 混种&粮食副产
            jobs: { serf: 6, merchant: 1 },
        },
    ],

    // coffee_house: base output culture: ~1.0, science: ~1.0, owner: merchant
    // 效率提升型升级：氛围优化，产出增加但岗位不增加
    coffee_house: [
        {
            name: "文人咖啡馆",
            cost: { plank: 80, coffee: 25, silver: 400 },
            input: { coffee: 0.25, delicacies: 0.1 },
            output: { culture: 1.3, science: 1.3 }, // 1.3x
            jobs: { merchant: 1, scribe: 2 }, // 保持总人数，优化结构
        },
        {
            name: "沙龙",
            cost: { brick: 60, furniture: 25, silver: 900 },
            input: { coffee: 0.4, delicacies: 0.15 },
            output: { culture: 1.8, science: 1.8 }, // 1.8x
            jobs: { merchant: 1, scribe: 2 }, // 效率型沙龙
        },
    ],

    // ========== 启蒙时代建筑 ==========

    // printing_house: base output science: ~1.0, owner: capitalist
    // 效率提升型升级：印刷机改良，产出增加但岗位不增加
    printing_house: [
        {
            name: "大印刷所",
            cost: { brick: 120, papyrus: 40, silver: 500 },
            input: { papyrus: 0.25, coffee: 0.05 },
            output: { science: 1.3 }, // 1.3x
            jobs: { artisan: 2, scribe: 2, capitalist: 1 }, // 保持不变
        },
        {
            name: "出版社",
            cost: { brick: 200, papyrus: 80, silver: 1100 },
            input: { papyrus: 0.4, coffee: 0.08 },
            output: { science: 1.8, culture: 0.35 }, // 1.8x + 文学出版
            jobs: { artisan: 2, scribe: 2, capitalist: 1 }, // 效率提升
        },
    ],

    // textile_mill: base output cloth: ~3.0, fine_clothes: ~0.5, owner: capitalist
    textile_mill: [
        {
            name: "大纺织厂",
            cost: { brick: 120, tools: 40, silver: 600 },
            input: { food: 0.5, dye: 0.2, tools: 0.02 },
            output: { cloth: 3.9, fine_clothes: 0.65 }, // 1.3x
            jobs: { worker: 7, artisan: 2, capitalist: 1 },
        },
        {
            name: "纺织工场",
            cost: { brick: 200, tools: 60, silver: 1300 },
            input: { food: 0.8, dye: 0.3, tools: 0.04, coffee: 0.05 }, // 工人提神咖啡
            output: { cloth: 5.4, fine_clothes: 0.9 }, // 1.8x
            jobs: { worker: 8, artisan: 2, capitalist: 1 },
        },
    ],

    // lumber_mill: base output plank: ~7.0, owner: capitalist
    lumber_mill: [
        {
            name: "大木材厂",
            cost: { brick: 100, tools: 35, silver: 500 },
            input: { wood: 2.0, tools: 0.02 },
            output: { plank: 9.1 }, // 1.3x
            jobs: { worker: 5, artisan: 1, capitalist: 1 },
        },
        {
            name: "木业公司",
            cost: { brick: 180, tools: 50, silver: 1100 },
            input: { wood: 3.0, tools: 0.04 },
            output: { plank: 12.6, furniture: 0.14 }, // 1.8x + 木制品副产
            jobs: { worker: 6, artisan: 1, capitalist: 1 },
        },
    ],

    // building_materials_plant: base output brick: ~5.0, owner: capitalist
    building_materials_plant: [
        {
            name: "大建材厂",
            cost: { brick: 120, tools: 35, silver: 550 },
            input: { stone: 1.3, wood: 0.4, coal: 0.1 },
            output: { brick: 6.5 }, // 1.3x
            jobs: { worker: 6, engineer: 1, capitalist: 1 },
        },
        {
            name: "建材公司",
            cost: { brick: 200, tools: 50, silver: 1200 },
            input: { stone: 2.0, wood: 0.6, coal: 0.15 },
            output: { brick: 9.0 }, // 1.8x
            jobs: { worker: 7, engineer: 1, capitalist: 1 },
        },
    ],

    // distillery: base output ale: ~3.0, silver: ~0.6, owner: capitalist
    distillery: [
        {
            name: "大蒸馏厂",
            cost: { brick: 150, copper: 50, silver: 600 },
            input: { food: 1.3, coal: 0.1 },
            output: { ale: 3.9, silver: 0.78 }, // 1.3x
            jobs: { worker: 5, artisan: 2, capitalist: 1 },
        },
        {
            name: "酒业公司",
            cost: { brick: 250, copper: 80, silver: 1300 },
            input: { food: 2.0, coal: 0.15 },
            output: { ale: 5.4, silver: 1.08, culture: 0.14 }, // 1.8x + 品牌价值
            jobs: { worker: 6, artisan: 2, capitalist: 1 },
        },
    ],

    // paper_mill: base output papyrus: ~2.0, owner: capitalist
    paper_mill: [
        {
            name: "大造纸厂",
            cost: { brick: 120, tools: 35, silver: 500 },
            input: { wood: 1.0, coal: 0.08 },
            output: { papyrus: 2.6 }, // 1.3x
            jobs: { worker: 5, engineer: 1, capitalist: 1 },
        },
        {
            name: "造纸公司",
            cost: { brick: 200, tools: 50, silver: 1100 },
            input: { wood: 1.5, coal: 0.12 },
            output: { papyrus: 3.6, tools: 0.07 }, // 1.8x + 纸模工具
            jobs: { worker: 6, engineer: 1, capitalist: 1 },
        },
    ],

    // university: base output science: ~2.5, culture: ~0.7, owner: official
    // 效率提升型升级：教学方法优化，产出增加但岗位不增加
    university: [
        {
            name: "著名学府",
            cost: { brick: 250, papyrus: 60, silver: 750 },
            input: { papyrus: 0.2, coffee: 0.1, delicacies: 0.08 },
            output: { science: 3.25, culture: 0.91 }, // 1.3x
            jobs: { scribe: 4, engineer: 2, official: 2 }, // 规模扩大
        },
        {
            name: "皇家学院",
            cost: { brick: 400, papyrus: 120, silver: 1700 },
            input: { papyrus: 0.3, coffee: 0.15, delicacies: 0.12 },
            output: { science: 4.5, culture: 1.26 }, // 1.8x
            jobs: { scribe: 5, engineer: 2, official: 2 }, // 继续扩大
        },
    ],

    // opera_house: base output culture: ~3.0, silver: ~0.8, owner: cleric
    opera_house: [
        {
            name: "大歌剧院",
            cost: { brick: 250, furniture: 50, silver: 700 },
            input: { fine_clothes: 0.15, delicacies: 0.1 },
            output: { culture: 3.9, silver: 1.04 }, // 1.3x
            jobs: { cleric: 4, artisan: 2, merchant: 1 },
        },
        {
            name: "皇家歌剧院",
            cost: { brick: 400, furniture: 80, silver: 1500 },
            input: { fine_clothes: 0.25, delicacies: 0.15, coffee: 0.1 }, // 中场休息咖啡
            output: { culture: 5.4, silver: 1.44, science: 0.2 }, // 1.8x + 戏剧艺术研究
            jobs: { cleric: 5, artisan: 2, merchant: 1 },
        },
    ],

    // ========== 工业时代建筑 ==========

    // coal_mine: base output 0.65 coal, owner: capitalist
    coal_mine: [
        {
            name: "深煤矿",
            cost: { plank: 150, tools: 40, silver: 500 },
            input: { tools: 0.2, wood: 0.5, food: 0.8 }, // added wood (pit props), food (miners)
            output: { coal: 0.85 }, // 1.3x
            jobs: { miner: 8, capitalist: 1 },
        },
        {
            name: "大煤矿",
            cost: { brick: 100, tools: 60, silver: 1100 },
            input: { tools: 0.35, wood: 0.8, food: 1.0 }, // increased all inputs
            output: { coal: 1.17, iron: 0.07 }, // 1.8x + 煤矿伴生铁
            jobs: { miner: 10, capitalist: 1 },
        },
    ],

    // steel_foundry: base output steel: ~0.35, owner: capitalist
    steel_foundry: [
        {
            name: "大炼钢厂",
            cost: { brick: 200, iron: 120, silver: 750 },
            input: { iron: 0.3, coal: 0.3 },
            output: { steel: 0.46 }, // 1.3x
            jobs: { engineer: 3, worker: 4, capitalist: 1 },
        },
        {
            name: "钢铁联合厂",
            cost: { steel: 100, iron: 200, silver: 1700 },
            input: { iron: 0.5, coal: 0.5 },
            output: { steel: 0.63, tools: 0.14 }, // 1.8x + 钢工具副产
            jobs: { engineer: 4, worker: 5, capitalist: 1 },
        },
    ],

    // factory: base output tools: ~1.0, owner: capitalist
    factory: [
        {
            name: "大工厂",
            cost: { brick: 300, steel: 120, silver: 850 },
            input: { steel: 0.12, coal: 0.12 },
            output: { tools: 1.3 }, // 1.3x
            jobs: { worker: 10, engineer: 2, capitalist: 1 },
        },
        {
            name: "制造中心",
            cost: { steel: 200, tools: 80, silver: 1900 },
            input: { steel: 0.2, coal: 0.2 },
            output: { tools: 1.8, steel: 0.03, science: 0.07 }, // 1.8x + 废钢回收&工艺改良
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
    ],

    // industrial_mine: base output iron: ~1.5, copper: ~0.5, owner: capitalist
    industrial_mine: [
        {
            name: "大工业矿场",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { tools: 0.25, coal: 0.4, wood: 0.5, food: 1.0 }, // added wood and food
            output: { iron: 1.95, copper: 0.65 }, // 1.3x
            jobs: { miner: 10, engineer: 2, capitalist: 1 },
        },
        {
            name: "矿业公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { tools: 0.4, coal: 0.6, wood: 0.8, food: 1.2 }, // significantly increased
            output: { iron: 2.7, copper: 0.9 }, // 1.8x
            jobs: { miner: 12, engineer: 2, capitalist: 1 },
        },
    ],

    // mechanized_farm: base output food: ~20.0, owner: capitalist
    mechanized_farm: [
        {
            name: "大机械农场",
            cost: { steel: 100, tools: 50, silver: 750 },
            input: { tools: 0.25, coal: 0.3, iron: 0.1 }, // increased inputs for machinery maintenance
            output: { food: 24.0 }, // reduced from 26.0, ~1.2x multiplier
            jobs: { peasant: 4, worker: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "工业农场",
            cost: { steel: 170, tools: 80, silver: 1700 },
            input: { tools: 0.45, coal: 0.5, iron: 0.15, dye: 0.05 }, // significantly increased inputs
            output: { food: 30.0, cloth: 0.25 }, // reduced from 36.0, ~1.5x multiplier
            jobs: { peasant: 5, worker: 2, engineer: 1, capitalist: 1 },
        },
    ],

    // logging_company: base output wood: ~10.0, owner: capitalist
    logging_company: [
        {
            name: "大伐木公司",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { tools: 0.2, coal: 0.2, food: 0.6 }, // increased for machinery and workers
            output: { wood: 12.0 }, // reduced from 13.0
            jobs: { lumberjack: 6, worker: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "林业公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { tools: 0.35, coal: 0.35, food: 0.8 }, // significantly increased inputs
            output: { wood: 15.0 }, // reduced from 18.0
            jobs: { lumberjack: 8, worker: 2, engineer: 1, capitalist: 1 },
        },
    ],

    // prefab_factory: base output brick: ~9.0, owner: capitalist
    prefab_factory: [
        {
            name: "大预制厂",
            cost: { steel: 150, tools: 60, silver: 850 },
            input: { brick: 1.0, steel: 0.12, stone: 0.6, coal: 0.25 },
            output: { brick: 11.7 }, // 1.3x
            jobs: { worker: 10, engineer: 2, capitalist: 1 },
        },
        {
            name: "建筑材料公司",
            cost: { steel: 250, tools: 100, silver: 1900 },
            input: { brick: 1.5, steel: 0.2, stone: 1.0, coal: 0.4 },
            output: { brick: 16.2 }, // 1.8x
            jobs: { worker: 12, engineer: 2, capitalist: 1 },
        },
    ],

    // cannery: base output delicacies: ~3.0, owner: capitalist
    cannery: [
        {
            name: "大罐头厂",
            cost: { steel: 60, tools: 40, silver: 650 },
            input: { food: 1.6, iron: 0.2, coal: 0.15 },
            output: { delicacies: 3.9 }, // 1.3x
            jobs: { worker: 9, artisan: 3, engineer: 2, capitalist: 1 },
        },
        {
            name: "食品公司",
            cost: { steel: 120, tools: 60, silver: 1500 },
            input: { food: 2.5, iron: 0.3, coal: 0.25 },
            output: { delicacies: 5.4, ale: 0.2 }, // 1.8x + 饮料生产
            jobs: { worker: 10, artisan: 4, engineer: 3, capitalist: 1 },
        },
    ],

    // garment_factory: base output fine_clothes: ~2.4, culture: ~0.3, owner: capitalist
    garment_factory: [
        {
            name: "大服装厂",
            cost: { steel: 100, tools: 60, silver: 850 },
            input: { cloth: 1.6, dye: 0.3, coal: 0.2 },
            output: { fine_clothes: 3.12, culture: 0.39 }, // 1.3x
            jobs: { worker: 12, artisan: 3, engineer: 1, capitalist: 1 },
        },
        {
            name: "服装公司",
            cost: { steel: 170, tools: 100, silver: 1900 },
            input: { cloth: 2.5, dye: 0.5, coal: 0.3 },
            output: { fine_clothes: 4.32, culture: 0.54, cloth: 0.7 }, // 1.8x + 边角布料回收
            jobs: { worker: 15, artisan: 3, engineer: 1, capitalist: 1 },
        },
    ],

    // furniture_factory: base output furniture: ~3.0, culture: ~0.2, owner: capitalist
    furniture_factory: [
        {
            name: "大家具厂",
            cost: { steel: 80, tools: 50, silver: 750 },
            input: { plank: 1.6, cloth: 0.5, coal: 0.15 },
            output: { furniture: 3.9, culture: 0.26 }, // 1.3x
            jobs: { worker: 8, artisan: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "家具公司",
            cost: { steel: 150, tools: 80, silver: 1700 },
            input: { plank: 2.5, cloth: 0.8, coal: 0.25 },
            output: { furniture: 5.4, culture: 0.36, plank: 0.35 }, // 1.8x + 木材下脚料
            jobs: { worker: 10, artisan: 2, engineer: 1, capitalist: 1 },
        },
    ],

    // market: base output food: ~3.0, silver: ~5.0, owner: merchant
    market: [
        {
            name: "大市场",
            cost: { brick: 300, papyrus: 60, silver: 1000 },
            input: { papyrus: 0.1, coffee: 0.08 },
            output: { food: 3.9, silver: 6.5 }, // 1.3x
            jobs: { merchant: 3, scribe: 1 },
        },
        {
            name: "交易所",
            cost: { steel: 200, papyrus: 120, silver: 2200 },
            input: { papyrus: 0.15, coffee: 0.12 },
            output: { food: 5.4, silver: 9.0, culture: 0.2 }, // 1.8x + 商业文化
            jobs: { merchant: 4, scribe: 1, capitalist: 1 },
        },
    ],

    // rail_depot: base output silver: ~3.0, maxPop: ~15, owner: capitalist
    rail_depot: [
        {
            name: "大铁路站",
            cost: { steel: 120, coal: 80, silver: 850 },
            input: { coal: 0.25, ale: 0.1, delicacies: 0.05 },
            output: { silver: 3.9, maxPop: 20 }, // 1.3x
            jobs: { engineer: 2, merchant: 2, capitalist: 1 },
        },
        {
            name: "铁路枢纽",
            cost: { steel: 220, coal: 150, silver: 1900 },
            input: { coal: 0.4, ale: 0.15, delicacies: 0.1 },
            output: { silver: 5.4, maxPop: 27, food: 0.7, culture: 0.14 }, // 1.8x + 站台商业&交通文化
            jobs: { engineer: 3, merchant: 2, capitalist: 1 },
        },
    ],

    // metallurgy_workshop: base output tools: ~2.5, owner: capitalist
    metallurgy_workshop: [
        {
            name: "精密冶金坊",
            cost: { brick: 120, iron: 60, silver: 600 },
            input: { iron: 1.0, copper: 0.2, wood: 0.5 },
            output: { tools: 3.25 }, // 1.3x
            jobs: { worker: 4, artisan: 2, engineer: 1 },
        },
        {
            name: "大冶金坊",
            cost: { brick: 200, iron: 100, silver: 1300 },
            input: { iron: 1.5, copper: 0.3, wood: 0.8, coal: 0.1 }, // 需要煤炭燃料
            output: { tools: 4.5 }, // 1.8x
            jobs: { worker: 5, artisan: 2, engineer: 1 },
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
        };
    }

    const upgrades = BUILDING_UPGRADES[building.id];
    if (!upgrades || !upgrades[level - 1]) {
        return {
            name: building.name,
            input: building.input || {},
            output: building.output || {},
            jobs: building.jobs || {},
        };
    }

    const upgrade = upgrades[level - 1];
    return {
        name: upgrade.name || building.name,
        input: upgrade.input || building.input || {},
        output: upgrade.output || building.output || {},
        jobs: upgrade.jobs || building.jobs || {},
    };
};

// 获取建筑的最大升级等级
export const getMaxUpgradeLevel = (buildingId) => {
    const upgrades = BUILDING_UPGRADES[buildingId];
    return upgrades ? upgrades.length : 0;
};

// 获取升级成本
// existingUpgradeCount: 已经升级到该等级或更高等级的建筑数量（用于成本递增）
export const getUpgradeCost = (buildingId, targetLevel, existingUpgradeCount = 0) => {
    const upgrades = BUILDING_UPGRADES[buildingId];
    if (!upgrades || !upgrades[targetLevel - 1]) return null;

    const baseCost = upgrades[targetLevel - 1].cost || {};

    // 如果没有已有升级数量，直接返回基础成本
    if (existingUpgradeCount <= 0) {
        return baseCost;
    }

    // 应用成本递增系数（与建造成本递增一致：1.15^n）
    const multiplier = Math.pow(1.15, existingUpgradeCount);
    const scaledCost = {};
    for (const [resource, amount] of Object.entries(baseCost)) {
        scaledCost[resource] = Math.ceil(amount * multiplier);
    }

    return scaledCost;
};
