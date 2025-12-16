// 建筑升级配置
// 定义各建筑的升级路径、费用和效果

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
    farm: [
        {
            name: "灌溉农田",
            cost: { wood: 50, tools: 10, silver: 200 },
            input: { tools: 0.02 },
            output: { food: 5.5 },
            jobs: { peasant: 2 },
        },
        {
            name: "精耕农田",
            cost: { plank: 40, tools: 30, silver: 600 },
            input: { tools: 0.05 },
            output: { food: 7.5 },
            jobs: { peasant: 1 },
        },
    ],

    lumber_camp: [
        {
            name: "改良伐木场",
            cost: { wood: 40, tools: 8, silver: 150 },
            input: { tools: 0.02 },
            output: { wood: 4.5 },
            jobs: { lumberjack: 2 },
        },
        {
            name: "高效伐木场",
            cost: { plank: 30, tools: 20, silver: 400 },
            input: { tools: 0.04 },
            output: { wood: 6.0 },
            jobs: { lumberjack: 1 },
        },
    ],

    quarry: [
        {
            name: "深层采石场",
            cost: { wood: 60, tools: 10, silver: 180 },
            input: { tools: 0.02 },
            output: { stone: 3.5 },
            jobs: { miner: 2 },
        },
        {
            name: "工业采石场",
            cost: { plank: 40, tools: 25, silver: 500 },
            input: { tools: 0.05 },
            output: { stone: 5.0 },
            jobs: { miner: 1 },
        },
    ],

    loom_house: [
        {
            name: "改良织布坊",
            cost: { wood: 30, tools: 8, silver: 120 },
            input: { tools: 0.02 },
            output: { cloth: 3.2 },
            jobs: { peasant: 2 },
        },
        {
            name: "高效织布坊",
            cost: { plank: 25, tools: 18, silver: 350 },
            input: { tools: 0.04 },
            output: { cloth: 4.5 },
            jobs: { peasant: 1 },
        },
    ],

    brickworks: [
        {
            name: "改良砖窑",
            cost: { stone: 50, tools: 12, silver: 200 },
            input: { stone: 0.8, wood: 0.25, tools: 0.02 },
            output: { brick: 3.2 },
            jobs: { worker: 2 },
        },
        {
            name: "高效砖窑",
            cost: { brick: 40, tools: 30, silver: 550 },
            input: { stone: 0.6, wood: 0.2, tools: 0.04 },
            output: { brick: 4.5 },
            jobs: { worker: 1 },
        },
    ],

    stone_tool_workshop: [
        {
            name: "改良石器作坊",
            cost: { stone: 40, wood: 30, silver: 150 },
            input: { wood: 0.8, stone: 0.6 },
            output: { tools: 0.7 },
            jobs: { artisan: 2 },
        },
        {
            name: "精良石器作坊",
            cost: { stone: 60, wood: 50, silver: 400 },
            input: { wood: 0.6, stone: 0.5 },
            output: { tools: 1.0 },
            jobs: { artisan: 1 },
        },
    ],

    trading_post: [
        {
            name: "繁荣贸易站",
            cost: { wood: 80, stone: 30, silver: 250 },
            input: { tools: 0.02 },
            output: { food: 3, silver: 1.2 },
            jobs: { merchant: 1 },
        },
        {
            name: "商业中心",
            cost: { plank: 60, brick: 30, silver: 600 },
            input: { tools: 0.04 },
            output: { food: 4, silver: 1.8 },
            jobs: { merchant: 1 },
        },
    ],

    library: [
        {
            name: "学术图书馆",
            cost: { stone: 100, papyrus: 30, silver: 400 },
            input: { papyrus: 0.05 },
            output: { science: 1.1 },
            jobs: { scribe: 3 },
        },
        {
            name: "皇家图书馆",
            cost: { brick: 80, papyrus: 60, silver: 900 },
            input: { papyrus: 0.1 },
            output: { science: 1.5 },
            jobs: { scribe: 2 },
        },
    ],

    // ========== 青铜时代建筑 ==========
    copper_mine: [
        {
            name: "深层铜矿",
            cost: { wood: 100, tools: 20, silver: 300 },
            input: { tools: 0.04 },
            output: { copper: 0.7 },
            jobs: { miner: 3 },
        },
        {
            name: "工业铜矿",
            cost: { plank: 80, tools: 40, silver: 700 },
            input: { tools: 0.06 },
            output: { copper: 1.0 },
            jobs: { miner: 2 },
        },
    ],

    dye_works: [
        {
            name: "改良染坊",
            cost: { wood: 50, tools: 10, silver: 180 },
            input: { food: 0.4, tools: 0.02 },
            output: { dye: 0.8 },
            jobs: { peasant: 2 },
        },
        {
            name: "精细染坊",
            cost: { plank: 40, tools: 25, silver: 450 },
            input: { food: 0.3, tools: 0.04 },
            output: { dye: 1.1 },
            jobs: { peasant: 1 },
        },
    ],

    sawmill: [
        {
            name: "改良锯木厂",
            cost: { wood: 80, tools: 15, silver: 250 },
            input: { wood: 1.0, tools: 0.02 },
            output: { plank: 3.5 },
            jobs: { worker: 3 },
        },
        {
            name: "蒸汽锯木厂",
            cost: { plank: 60, tools: 35, silver: 600 },
            input: { wood: 0.8, tools: 0.04 },
            output: { plank: 4.8 },
            jobs: { worker: 2 },
        },
    ],

    bronze_foundry: [
        {
            name: "改良铸坊",
            cost: { stone: 80, copper: 30, silver: 350 },
            input: { copper: 0.5, wood: 0.3, tools: 0.02 },
            output: { tools: 1.4 },
            jobs: { worker: 2, artisan: 1 },
        },
        {
            name: "精良铸坊",
            cost: { brick: 60, copper: 50, silver: 750 },
            input: { copper: 0.4, wood: 0.25, tools: 0.04 },
            output: { tools: 1.9 },
            jobs: { worker: 1, artisan: 1 },
        },
    ],

    amphitheater: [
        {
            name: "宏伟剧场",
            cost: { stone: 150, brick: 50, silver: 500 },
            input: { fine_clothes: 0.12 },
            output: { culture: 1.6 },
            jobs: { cleric: 2 },
        },
        {
            name: "皇家剧场",
            cost: { brick: 100, furniture: 30, silver: 1000 },
            input: { fine_clothes: 0.1 },
            output: { culture: 2.2 },
            jobs: { cleric: 1 },
        },
    ],

    // ========== 古典时代建筑 ==========
    reed_works: [
        {
            name: "改良造纸坊",
            cost: { wood: 80, tools: 15, silver: 280 },
            input: { tools: 0.02 },
            output: { papyrus: 0.85 },
            jobs: { peasant: 2 },
        },
        {
            name: "工业造纸坊",
            cost: { plank: 60, tools: 30, silver: 650 },
            input: { tools: 0.04 },
            output: { papyrus: 1.2 },
            jobs: { peasant: 1 },
        },
    ],

    culinary_kitchen: [
        {
            name: "精致烹饪坊",
            cost: { brick: 50, tools: 20, silver: 400 },
            input: { tools: 0.08, food: 1.2 },
            output: { delicacies: 2.0 },
            jobs: { artisan: 2, peasant: 1 },
        },
        {
            name: "皇家厨房",
            cost: { brick: 80, furniture: 20, silver: 900 },
            input: { tools: 0.06, food: 1.0 },
            output: { delicacies: 2.8 },
            jobs: { artisan: 1, peasant: 1 },
        },
    ],

    brewery: [
        {
            name: "精酿酒坊",
            cost: { brick: 40, tools: 18, silver: 350 },
            input: { food: 1.0, wood: 0.15, tools: 0.02 },
            output: { ale: 1.6 },
            jobs: { worker: 2 },
        },
        {
            name: "蒸馏酒厂",
            cost: { brick: 70, copper: 30, silver: 800 },
            input: { food: 0.8, wood: 0.1, tools: 0.04 },
            output: { ale: 2.2 },
            jobs: { worker: 1 },
        },
    ],

    furniture_workshop: [
        {
            name: "精工家具坊",
            cost: { plank: 100, tools: 25, silver: 500 },
            input: { tools: 0.08, plank: 0.8, cloth: 0.25 },
            output: { furniture: 1.6 },
            jobs: { artisan: 3 },
        },
        {
            name: "大师家具坊",
            cost: { plank: 150, furniture: 20, silver: 1100 },
            input: { tools: 0.06, plank: 0.6, cloth: 0.2 },
            output: { furniture: 2.2 },
            jobs: { artisan: 2 },
        },
    ],

    tailor_workshop: [
        {
            name: "精工成衣坊",
            cost: { plank: 60, tools: 20, silver: 400 },
            input: { tools: 0.03, cloth: 0.8, dye: 0.15 },
            output: { fine_clothes: 1.1, culture: 0.15 },
            jobs: { artisan: 2 },
        },
        {
            name: "皇家成衣坊",
            cost: { brick: 50, fine_clothes: 15, silver: 900 },
            input: { tools: 0.02, cloth: 0.6, dye: 0.1 },
            output: { fine_clothes: 1.5, culture: 0.2 },
            jobs: { artisan: 1 },
        },
    ],

    mine: [
        {
            name: "深层铁矿",
            cost: { plank: 100, tools: 30, silver: 450 },
            input: { tools: 0.06 },
            output: { iron: 0.7 },
            jobs: { miner: 4, capitalist: 1 },
        },
        {
            name: "工业铁矿",
            cost: { brick: 80, tools: 50, silver: 1000 },
            input: { tools: 0.08 },
            output: { iron: 1.0 },
            jobs: { miner: 3, capitalist: 1 },
        },
    ],

    iron_tool_workshop: [
        {
            name: "精铁工坊",
            cost: { brick: 80, iron: 40, silver: 500 },
            input: { wood: 0.4, iron: 0.6, tools: 0.02 },
            output: { tools: 2.0 },
            jobs: { worker: 2, artisan: 1 },
        },
        {
            name: "大师铁匠铺",
            cost: { brick: 120, iron: 70, silver: 1100 },
            input: { wood: 0.3, iron: 0.5, tools: 0.04 },
            output: { tools: 2.8 },
            jobs: { worker: 1, artisan: 1 },
        },
    ],

    // ========== 封建时代建筑 ==========
    large_estate: [
        {
            name: "繁荣庄园",
            cost: { plank: 80, tools: 25, silver: 500 },
            input: { tools: 0.03 },
            output: { food: 24.0 },
            jobs: { serf: 5, landowner: 1 },
        },
        {
            name: "领主庄园",
            cost: { brick: 60, furniture: 20, silver: 1200 },
            input: { tools: 0.05 },
            output: { food: 32.0 },
            jobs: { serf: 4, landowner: 1 },
        },
    ],

    church: [
        {
            name: "宏伟教堂",
            cost: { brick: 100, furniture: 30, silver: 600 },
            input: { furniture: 0.08, fine_clothes: 0.08 },
            output: { culture: 1.1, silver: 0.7 },
            jobs: { cleric: 3 },
        },
        {
            name: "大教堂",
            cost: { brick: 180, furniture: 50, silver: 1400 },
            input: { furniture: 0.06, fine_clothes: 0.06 },
            output: { culture: 1.5, silver: 1.0 },
            jobs: { cleric: 2 },
        },
    ],

    // ========== 探索时代建筑 ==========
    dockyard: [
        {
            name: "大型船坞",
            cost: { plank: 150, tools: 40, silver: 600 },
            input: { wood: 0.4, tools: 0.03 },
            output: { spice: 0.5 },
            jobs: { navigator: 2, worker: 2, merchant: 1 },
        },
        {
            name: "皇家船厂",
            cost: { plank: 250, iron: 50, silver: 1400 },
            input: { wood: 0.3, tools: 0.05 },
            output: { spice: 0.7 },
            jobs: { navigator: 1, worker: 1, merchant: 1 },
        },
    ],

    navigator_school: [
        {
            name: "航海学府",
            cost: { plank: 100, papyrus: 50, silver: 500 },
            input: { papyrus: 0.05 },
            output: { science: 0.85, culture: 0.3 },
            jobs: { navigator: 2, scribe: 1, official: 1 },
        },
        {
            name: "皇家航海学院",
            cost: { brick: 80, papyrus: 100, silver: 1200 },
            input: { papyrus: 0.08 },
            output: { science: 1.2, culture: 0.4 },
            jobs: { navigator: 1, scribe: 1, official: 1 },
        },
    ],

    trade_port: [
        {
            name: "繁荣港口",
            cost: { plank: 180, spice: 40, silver: 700 },
            input: { spice: 0.25 },
            output: { food: 3.0, silver: 0.5 },
            jobs: { merchant: 3 },
        },
        {
            name: "国际贸易港",
            cost: { brick: 150, spice: 80, silver: 1600 },
            input: { spice: 0.2 },
            output: { food: 4.5, silver: 1.0 },
            jobs: { merchant: 2 },
        },
    ],

    metallurgy_workshop: [
        {
            name: "精密冶金坊",
            cost: { brick: 150, iron: 80, silver: 700 },
            input: { iron: 1.2, copper: 0.25, wood: 0.6 },
            output: { tools: 4.0 },
            jobs: { worker: 3, artisan: 2, engineer: 1 },
        },
        {
            name: "大师冶金坊",
            cost: { brick: 250, iron: 120, silver: 1500 },
            input: { iron: 1.0, copper: 0.2, wood: 0.5 },
            output: { tools: 5.5 },
            jobs: { worker: 3, artisan: 1, engineer: 1 },
        },
    ],

    // ========== 启蒙时代建筑 ==========
    coffee_plantation: [
        {
            name: "大型咖啡庄园",
            cost: { plank: 150, tools: 30, silver: 600 },
            input: { tools: 0.03 },
            output: { coffee: 0.55 },
            jobs: { serf: 3, merchant: 1 },
        },
        {
            name: "咖啡帝国",
            cost: { brick: 120, tools: 50, silver: 1400 },
            input: { tools: 0.05 },
            output: { coffee: 0.75 },
            jobs: { serf: 2, merchant: 1 },
        },
    ],

    coffee_house: [
        {
            name: "文人咖啡馆",
            cost: { plank: 100, coffee: 30, silver: 500 },
            input: { coffee: 0.35, delicacies: 0.15 },
            output: { culture: 1.4, science: 1.4 },
            jobs: { merchant: 1, scribe: 2 },
        },
        {
            name: "启蒙沙龙",
            cost: { brick: 80, furniture: 30, silver: 1200 },
            input: { coffee: 0.3, delicacies: 0.1 },
            output: { culture: 2.0, science: 2.0 },
            jobs: { merchant: 1, scribe: 1 },
        },
    ],

    printing_house: [
        {
            name: "大型印刷所",
            cost: { brick: 150, papyrus: 50, silver: 600 },
            input: { papyrus: 0.35, coffee: 0.08 },
            output: { science: 1.6 },
            jobs: { artisan: 2, scribe: 2, capitalist: 1 },
        },
        {
            name: "出版帝国",
            cost: { brick: 250, papyrus: 100, silver: 1400 },
            input: { papyrus: 0.3, coffee: 0.06 },
            output: { science: 2.2 },
            jobs: { artisan: 1, scribe: 1, capitalist: 1 },
        },
    ],

    textile_mill: [
        {
            name: "大型纺织厂",
            cost: { brick: 150, tools: 50, silver: 700 },
            input: { food: 0.6, dye: 0.25, tools: 0.03 },
            output: { cloth: 4.5, fine_clothes: 0.8 },
            jobs: { worker: 5, artisan: 2, capitalist: 1 },
        },
        {
            name: "纺织帝国",
            cost: { steel: 80, tools: 80, silver: 1600 },
            input: { food: 0.5, dye: 0.2, tools: 0.05 },
            output: { cloth: 6.0, fine_clothes: 1.1 },
            jobs: { worker: 4, artisan: 1, capitalist: 1 },
        },
    ],

    lumber_mill: [
        {
            name: "大型木材厂",
            cost: { brick: 120, tools: 40, silver: 600 },
            input: { wood: 2.5, tools: 0.03 },
            output: { plank: 10.0 },
            jobs: { worker: 4, artisan: 1, capitalist: 1 },
        },
        {
            name: "木材帝国",
            cost: { steel: 60, tools: 60, silver: 1400 },
            input: { wood: 2.0, tools: 0.05 },
            output: { plank: 13.0 },
            jobs: { worker: 3, artisan: 1, capitalist: 1 },
        },
    ],

    building_materials_plant: [
        {
            name: "大型建材厂",
            cost: { brick: 150, tools: 40, silver: 650 },
            input: { stone: 1.6, wood: 0.5, coal: 0.15 },
            output: { brick: 7.0 },
            jobs: { worker: 5, engineer: 1, capitalist: 1 },
        },
        {
            name: "建材帝国",
            cost: { steel: 80, tools: 60, silver: 1500 },
            input: { stone: 1.3, wood: 0.4, coal: 0.12 },
            output: { brick: 9.5 },
            jobs: { worker: 4, engineer: 1, capitalist: 1 },
        },
    ],

    distillery: [
        {
            name: "大型蒸馏厂",
            cost: { brick: 180, copper: 60, silver: 700 },
            input: { food: 1.6, coal: 0.15 },
            output: { ale: 4.5, silver: 1.0 },
            jobs: { worker: 4, artisan: 2, capitalist: 1 },
        },
        {
            name: "酒业帝国",
            cost: { steel: 70, copper: 100, silver: 1600 },
            input: { food: 1.3, coal: 0.1 },
            output: { ale: 6.0, silver: 1.5 },
            jobs: { worker: 3, artisan: 1, capitalist: 1 },
        },
    ],

    paper_mill: [
        {
            name: "大型造纸厂",
            cost: { brick: 150, tools: 40, silver: 600 },
            input: { wood: 1.2, coal: 0.12 },
            output: { papyrus: 3.2 },
            jobs: { worker: 4, engineer: 1, capitalist: 1 },
        },
        {
            name: "造纸帝国",
            cost: { steel: 60, tools: 60, silver: 1400 },
            input: { wood: 1.0, coal: 0.1 },
            output: { papyrus: 4.5 },
            jobs: { worker: 3, engineer: 1, capitalist: 1 },
        },
    ],

    university: [
        {
            name: "著名大学",
            cost: { brick: 300, papyrus: 80, silver: 900 },
            input: { papyrus: 0.25, coffee: 0.15, delicacies: 0.12 },
            output: { science: 4.0, culture: 1.1 },
            jobs: { scribe: 3, engineer: 2, official: 2 },
        },
        {
            name: "顶级学府",
            cost: { brick: 500, papyrus: 150, silver: 2000 },
            input: { papyrus: 0.2, coffee: 0.12, delicacies: 0.1 },
            output: { science: 5.5, culture: 1.5 },
            jobs: { scribe: 3, engineer: 1, official: 2 },
        },
    ],

    opera_house: [
        {
            name: "宏伟歌剧院",
            cost: { brick: 300, furniture: 60, silver: 800 },
            input: { fine_clothes: 0.2, delicacies: 0.15 },
            output: { culture: 4.5, silver: 1.3 },
            jobs: { cleric: 3, artisan: 2, merchant: 1 },
        },
        {
            name: "皇家歌剧院",
            cost: { brick: 500, furniture: 100, silver: 1800 },
            input: { fine_clothes: 0.15, delicacies: 0.12 },
            output: { culture: 6.0, silver: 1.8 },
            jobs: { cleric: 3, artisan: 1, merchant: 1 },
        },
    ],

    // ========== 工业时代建筑 ==========
    coal_mine: [
        {
            name: "深层煤矿",
            cost: { plank: 180, tools: 50, silver: 600 },
            input: { tools: 0.12 },
            output: { coal: 0.9 },
            jobs: { miner: 5, capitalist: 1 },
        },
        {
            name: "工业煤矿",
            cost: { steel: 100, tools: 80, silver: 1400 },
            input: { tools: 0.15 },
            output: { coal: 1.3 },
            jobs: { miner: 4, capitalist: 1 },
        },
    ],

    steel_foundry: [
        {
            name: "大型炼钢厂",
            cost: { brick: 250, iron: 150, silver: 900 },
            input: { iron: 0.35, coal: 0.35 },
            output: { steel: 0.55 },
            jobs: { engineer: 3, worker: 3, capitalist: 1 },
        },
        {
            name: "钢铁帝国",
            cost: { steel: 150, iron: 250, silver: 2000 },
            input: { iron: 0.3, coal: 0.3 },
            output: { steel: 0.75 },
            jobs: { engineer: 2, worker: 3, capitalist: 1 },
        },
    ],

    factory: [
        {
            name: "大型工厂",
            cost: { brick: 350, steel: 150, silver: 1000 },
            input: { steel: 0.15, coal: 0.15 },
            output: { tools: 1.6 },
            jobs: { worker: 8, engineer: 2, capitalist: 1 },
        },
        {
            name: "工业巨头",
            cost: { steel: 250, tools: 100, silver: 2200 },
            input: { steel: 0.12, coal: 0.12 },
            output: { tools: 2.2 },
            jobs: { worker: 6, engineer: 1, capitalist: 1 },
        },
    ],

    industrial_mine: [
        {
            name: "大型工业矿场",
            cost: { steel: 180, tools: 80, silver: 1000 },
            input: { tools: 0.12, coal: 0.25 },
            output: { iron: 2.2, copper: 0.7 },
            jobs: { miner: 8, engineer: 2, capitalist: 1 },
        },
        {
            name: "采矿帝国",
            cost: { steel: 300, tools: 120, silver: 2200 },
            input: { tools: 0.1, coal: 0.2 },
            output: { iron: 3.0, copper: 1.0 },
            jobs: { miner: 6, engineer: 1, capitalist: 1 },
        },
    ],

    mechanized_farm: [
        {
            name: "大型机械农场",
            cost: { steel: 120, tools: 60, silver: 900 },
            input: { tools: 0.08, coal: 0.15 },
            output: { food: 30.0 },
            jobs: { peasant: 3, worker: 3, engineer: 1, capitalist: 1 },
        },
        {
            name: "农业帝国",
            cost: { steel: 200, tools: 100, silver: 2000 },
            input: { tools: 0.06, coal: 0.12 },
            output: { food: 40.0 },
            jobs: { peasant: 2, worker: 2, engineer: 1, capitalist: 1 },
        },
    ],

    logging_company: [
        {
            name: "大型伐木公司",
            cost: { steel: 80, tools: 50, silver: 800 },
            input: { tools: 0.06, coal: 0.12 },
            output: { wood: 16.0 },
            jobs: { lumberjack: 5, worker: 3, engineer: 1, capitalist: 1 },
        },
        {
            name: "林业帝国",
            cost: { steel: 150, tools: 80, silver: 1800 },
            input: { tools: 0.05, coal: 0.1 },
            output: { wood: 22.0 },
            jobs: { lumberjack: 4, worker: 2, engineer: 1, capitalist: 1 },
        },
    ],

    prefab_factory: [
        {
            name: "大型预制厂",
            cost: { steel: 180, tools: 80, silver: 1000 },
            input: { brick: 1.2, steel: 0.15, stone: 0.8, coal: 0.3 },
            output: { brick: 14.0 },
            jobs: { worker: 8, engineer: 2, capitalist: 1 },
        },
        {
            name: "建筑帝国",
            cost: { steel: 300, tools: 120, silver: 2200 },
            input: { brick: 1.0, steel: 0.12, stone: 0.6, coal: 0.25 },
            output: { brick: 19.0 },
            jobs: { worker: 6, engineer: 1, capitalist: 1 },
        },
    ],

    cannery: [
        {
            name: "大型罐头厂",
            cost: { steel: 80, tools: 50, silver: 800 },
            input: { food: 2.0, iron: 0.25, coal: 0.2 },
            output: { delicacies: 4.5 },
            jobs: { worker: 6, artisan: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "食品帝国",
            cost: { steel: 150, tools: 80, silver: 1800 },
            input: { food: 1.6, iron: 0.2, coal: 0.15 },
            output: { delicacies: 6.0 },
            jobs: { worker: 5, artisan: 1, engineer: 1, capitalist: 1 },
        },
    ],

    garment_factory: [
        {
            name: "大型服装厂",
            cost: { steel: 120, tools: 80, silver: 1000 },
            input: { cloth: 2.0, dye: 0.4, coal: 0.25 },
            output: { fine_clothes: 3.6, culture: 0.4 },
            jobs: { worker: 10, artisan: 3, engineer: 1, capitalist: 1 },
        },
        {
            name: "时尚帝国",
            cost: { steel: 200, tools: 120, silver: 2200 },
            input: { cloth: 1.6, dye: 0.3, coal: 0.2 },
            output: { fine_clothes: 5.0, culture: 0.6 },
            jobs: { worker: 8, artisan: 2, engineer: 1, capitalist: 1 },
        },
    ],

    furniture_factory: [
        {
            name: "大型家具厂",
            cost: { steel: 100, tools: 60, silver: 900 },
            input: { plank: 2.0, cloth: 0.6, coal: 0.2 },
            output: { furniture: 4.5, culture: 0.3 },
            jobs: { worker: 6, artisan: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "家具帝国",
            cost: { steel: 180, tools: 100, silver: 2000 },
            input: { plank: 1.6, cloth: 0.5, coal: 0.15 },
            output: { furniture: 6.0, culture: 0.4 },
            jobs: { worker: 5, artisan: 1, engineer: 1, capitalist: 1 },
        },
    ],

    steel_works: [
        {
            name: "大型钢铁联合体",
            cost: { steel: 200, tools: 120, silver: 1200 },
            input: { iron: 1.0, coal: 0.8 },
            output: { steel: 1.6, tools: 1.0 },
            jobs: { worker: 12, engineer: 3, capitalist: 2 },
        },
        {
            name: "钢铁帝国",
            cost: { steel: 350, tools: 180, silver: 2600 },
            input: { iron: 0.8, coal: 0.6 },
            output: { steel: 2.2, tools: 1.4 },
            jobs: { worker: 10, engineer: 3, capitalist: 2 },
        },
    ],

    publishing_house: [
        {
            name: "大型出版社",
            cost: { brick: 250, papyrus: 80, silver: 900 },
            input: { papyrus: 0.8, coffee: 0.15, coal: 0.12 },
            output: { science: 3.2, culture: 1.3 },
            jobs: { scribe: 3, artisan: 2, engineer: 1, capitalist: 1 },
        },
        {
            name: "媒体帝国",
            cost: { steel: 120, papyrus: 150, silver: 2000 },
            input: { papyrus: 0.6, coffee: 0.12, coal: 0.1 },
            output: { science: 4.5, culture: 1.8 },
            jobs: { scribe: 3, artisan: 1, engineer: 1, capitalist: 1 },
        },
    ],

    rail_depot: [
        {
            name: "大型铁路枢纽",
            cost: { steel: 150, coal: 100, silver: 1000 },
            input: { coal: 0.35, ale: 0.15, delicacies: 0.08 },
            output: { silver: 2.0, maxPop: 18 },
            jobs: { engineer: 2, merchant: 2, capitalist: 1 },
        },
        {
            name: "铁路帝国",
            cost: { steel: 280, coal: 180, silver: 2400 },
            input: { coal: 0.3, ale: 0.12, delicacies: 0.06 },
            output: { silver: 3.0, maxPop: 24 },
            jobs: { engineer: 1, merchant: 1, capitalist: 1 },
        },
    ],

    stock_exchange: [
        {
            name: "大型交易所",
            cost: { brick: 400, papyrus: 80, silver: 1200 },
            input: { papyrus: 0.15, coffee: 0.12 },
            output: { silver: 6.5, culture: 0.7 },
            jobs: { merchant: 5, scribe: 2, capitalist: 2 },
        },
        {
            name: "金融帝国",
            cost: { steel: 250, papyrus: 150, silver: 2800 },
            input: { papyrus: 0.12, coffee: 0.1 },
            output: { silver: 9.0, culture: 1.0 },
            jobs: { merchant: 4, scribe: 1, capitalist: 2 },
        },
    ],
};

/**
 * 获取建筑在指定等级时的有效配置
 * @param {Object} building - 建筑基础配置
 * @param {number} level - 升级等级 (0 = 基础)
 * @returns {Object} 有效的 input/output/jobs 配置
 */
export const getBuildingEffectiveConfig = (building, level = 0) => {
    if (level === 0 || !BUILDING_UPGRADES[building.id]) {
        return {
            name: building.name,
            input: building.input || {},
            output: building.output || {},
            jobs: building.jobs || {},
        };
    }

    const upgradeIndex = level - 1;
    const upgrade = BUILDING_UPGRADES[building.id]?.[upgradeIndex];

    if (!upgrade) {
        // 如果请求的等级超出配置，返回最高级配置
        const maxUpgrade = BUILDING_UPGRADES[building.id]?.[BUILDING_UPGRADES[building.id].length - 1];
        return maxUpgrade ? {
            name: maxUpgrade.name,
            input: maxUpgrade.input || building.input || {},
            output: maxUpgrade.output || building.output || {},
            jobs: maxUpgrade.jobs || building.jobs || {},
        } : {
            name: building.name,
            input: building.input || {},
            output: building.output || {},
            jobs: building.jobs || {},
        };
    }

    return {
        name: upgrade.name,
        input: upgrade.input || building.input || {},
        output: upgrade.output || building.output || {},
        jobs: upgrade.jobs || building.jobs || {},
    };
};

/**
 * 获取建筑的最大升级等级
 * @param {string} buildingId - 建筑ID
 * @returns {number} 最大等级 (0 表示不支持升级)
 */
export const getMaxUpgradeLevel = (buildingId) => {
    return BUILDING_UPGRADES[buildingId]?.length || 0;
};

/**
 * 获取升级到下一级的费用
 * @param {string} buildingId - 建筑ID
 * @param {number} currentLevel - 当前等级
 * @returns {Object|null} 升级费用，如果已满级返回 null
 */
export const getUpgradeCost = (buildingId, currentLevel) => {
    const upgrade = BUILDING_UPGRADES[buildingId]?.[currentLevel];
    return upgrade?.cost || null;
};
