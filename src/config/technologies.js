/**
 * 知识树配置
 * 每个知识节点包含：
 * - id: 知识唯一标识
 * - name: 知识名称
 * - desc: 知识描述和效果
 * - cost: 研究成本
 * - epoch: 解锁时代
 * - prerequisites: 前置知识ID数组（可选，无则为该时代根节点）
 */
export const TECHS = [
    // 石器时代
    {
        id: 'barter',
        name: "物物交换",
        desc: "允许建造贸易站，让商人阶层登上历史舞台。财政收入 +2%。",
        cost: { science: 150 },
        epoch: 0,
        effects: { taxIncome: 0.02 },
    },
    {
        id: 'stone_axes',
        name: "磨制石斧",
        desc: "伐木场产出提升 12%。",
        cost: { science: 150 },
        epoch: 0,
        effects: { buildings: { lumber_camp: 0.12 } },
    },
    {
        id: 'flint_knapping',
        name: "打制燧石",
        desc: "采石场效率增加 12%。",
        cost: { science: 210 },
        epoch: 0,
        prerequisites: ['stone_axes'],
        effects: { buildings: { quarry: 0.12 } },
    },
    {
        id: 'animal_husbandry',
        name: "畜牧业",
        desc: "驯养牲畜，每人每日额外获得 0.1 粮食。",
        cost: { science: 240 },
        epoch: 0,
        effects: { perPopPassive: { food: 0.1 } },
    },
    {
        id: 'pottery',
        name: "陶器",
        desc: "农田储粮效率 +5%。",
        cost: { science: 300 },
        epoch: 0,
        prerequisites: ['barter'],
        effects: { buildings: { farm: 0.05 } },
    },
    {
        id: 'tool_making',
        name: "工具制作",
        desc: "解锁石器作坊，提供早期稳定的工具来源。采集建筑效率 +5%。",
        cost: { science: 270 },
        epoch: 0,
        prerequisites: ['pottery'],
        effects: { categories: { gather: 0.05 } },
    },
    {
        id: 'basic_irrigation',
        name: "基础灌溉",
        desc: "开凿浅渠把河水引入农田，产量提升 8%。",
        cost: { science: 360 },
        epoch: 0,
        prerequisites: ['animal_husbandry'],
        effects: { buildings: { farm: 0.08 } },
    },
    {
        id: 'oral_tradition',
        name: "口述传统",
        desc: "长者口述史诗，图书馆的整理效率提升 8%。",
        cost: { science: 330 },
        epoch: 0,
        prerequisites: ['pottery'],
        effects: { buildings: { library: 0.08 } },
    },
    {
        id: 'communal_granary',
        name: "公共粮仓",
        desc: "人口上限 +10%。",
        cost: { science: 390 },
        epoch: 0,
        prerequisites: ['basic_irrigation'],
        effects: { maxPop: 0.1 },
    },

    {
        id: 'river_fishing',
        name: "河湾捕鱼",
        desc: "每人每日额外获得 0.05 粮食，财政收入 +1%。",
        cost: { science: 450 },
        epoch: 0,
        prerequisites: ['communal_granary'],
        effects: { perPopPassive: { food: 0.05 }, taxIncome: 0.01 },
    },
    {
        id: 'wheel',
        name: "车轮",
        desc: "采集建筑整体效率 +10%。",
        cost: { science: 480 },
        epoch: 0,
        prerequisites: ['flint_knapping', 'tool_making'],
        effects: { categories: { gather: 0.1 } },
    },

    // 青铜时代
    {
        id: 'sailing',
        name: "航海术",
        desc: "解锁船坞建设，开启海上贸易与军事行动。财政收入 +3%，每人每日获得 0.02 粮食。",
        cost: { science: 1050 },
        epoch: 1,
        prerequisites: ['caravan_trade'],
        effects: { taxIncome: 0.03, perPopPassive: { food: 0.02 } },
    },
    {
        id: 'tools',
        name: "铜制工具",
        desc: "允许建造鑯木厂，工业效率 +3%。",
        cost: { science: 750 },
        epoch: 1,
        prerequisites: ['copper_mining'],
        effects: { categories: { industry: 0.03 } },
    },    {
        id: 'copper_mining',
        name: "铜脉勘探",
        desc: "解锁铜矿开采。",
        cost: { science: 840 },
        epoch: 1,
        prerequisites: ['flint_knapping'],
        effects: {},
    },
    {
        id: 'bronze_working',
        name: "青铜冶炼",
        desc: "青铜铸坊产出 +15%，铁矿井同步获得 +8%。",
        cost: { science: 960 },
        epoch: 1,
        prerequisites: ['copper_mining'],
        effects: { buildings: { bronze_foundry: 0.15, mine: 0.08 } },
    },
    {
        id: 'horse_collar',
        name: "牛项圈",
        desc: "农田与庄园增产 5%。",
        cost: { science: 780 },
        epoch: 1,
        prerequisites: ['tools'],
        effects: { buildings: { farm: 0.05, large_estate: 0.05 } },
    },
    {
        id: 'caravan_trade',
        name: "驼队贸易",
        desc: "市场银币收入 +18%。",
        cost: { science: 900 },
        epoch: 1,
        prerequisites: ['early_administration'],
        effects: { buildings: { market: 0.18 } },
    },
    {
        id: 'granary_architecture',
        name: "粮仓结构",
        desc: "粮仓产出 +12%，并额外提供 +5% 人口上限。",
        cost: { science: 960 },
        epoch: 1,
        prerequisites: ['horse_collar'],
        effects: { buildings: { granary: 0.12 }, maxPop: 0.05 },
    },
    {
        id: 'primitive_weaving',
        name: "原始纺织",
        desc: "使用简易织机将羊毛加工为布料。织布坊效率 +5%。",
        cost: { science: 820 },
        epoch: 1,
        prerequisites: ['tools'],
        effects: { buildings: { loom_house: 0.05 } },
    },
    {
        id: 'early_administration',
        name: "早期行政",
        desc: "解锁官署，建立初步的税收与民政管理体系。启用官员系统，官员容量 +2。",
        cost: { science: 880 },
        epoch: 1,
        prerequisites: ['bronze_working'],
        effects: { categories: { civic: 0.05 } },
    },

    // 古典时代
    {
        id: 'papyrus_cultivation',
        name: "改进造纸术",
        desc: "造纸工坊效率 +12%。",
        cost: { science: 1575 },
        epoch: 2,
        prerequisites: ['library_catalogs'],
        effects: { buildings: { reed_works: 0.12 } },
    },
    {
        id: 'culinary_arts',
        name: "烹饪艺术",
        desc: "解锁烹饪坊，将粮食加工为珍馐，满足上层阶级的饮食需求。",
        cost: { science: 1680 },
        epoch: 2,
        prerequisites: ['road_system'],
        effects: {},
    },
    {
        id: 'brewing',
        name: "酿造工艺",
        desc: "解锁酿造坊，将粮食发酵为美酒，供贸易与享用。",
        cost: { science: 1610 },
        epoch: 2,
        prerequisites: ['road_system'],
        effects: {},
    },
    {
        id: 'carpentry',
        name: "精细木工",
        desc: "解锁家具工坊，将木材与石料加工为精美家具，提升上层阶级的生活品质。",
        cost: { science: 1750 },
        epoch: 2,
        prerequisites: ['advanced_weaving'],
        effects: {},
    },
    {
        id: 'library_catalogs',
        name: "图书编目",
        desc: "图书馆科研 +15%。",
        cost: { science: 1645 },
        epoch: 2,
        prerequisites: ['republican_code'],
        effects: { buildings: { library: 0.15 } },
    },
    {
        id: 'amphitheater_design',
        name: "剧场设计",
        desc: "解锁剧场建筑。",
        cost: { science: 1470 },
        epoch: 1,
        prerequisites: ['early_administration'],
        effects: {},
    },
    {
        id: 'urban_planning',
        name: "城市规划",
        desc: "木屋效率 +12%，人口上限 +5%。",
        cost: { science: 1820 },
        epoch: 2,
        prerequisites: ['republican_code'],
        effects: { buildings: { house: 0.12 }, maxPop: 0.05 },
    },
    {
        id: 'republican_code',
        name: "共和法典",
        desc: "完善的法律体系提升社会运转效率。民生建筑效率 +9%，人口上限 +5%。",
        cost: { science: 1960 },
        epoch: 2,
        prerequisites: ['early_administration'],
        effects: { categories: { civic: 0.09 }, maxPop: 0.05 },
    },
    {
        id: 'road_system',
        name: "道路网络",
        desc: "采集作业效率 +6%。",
        cost: { science: 2100 },
        epoch: 2,
        prerequisites: ['urban_planning'],
        effects: { categories: { gather: 0.06 } },
    },
    {
        id: 'advanced_weaving',
        name: "高级纺织",
        desc: "改进织布工具和织机设计，提升纺织效率。织布坊效率 +12%。",
        cost: { science: 1950 },
        epoch: 2,
        prerequisites: ['ironworking'],
        effects: { buildings: { loom_house: 0.12 } },
    },

    // 封建时代
    {
        id: 'feudalism',
        name: "封建制度",
        desc: "庄园耕作效率 +9%。",
        cost: { science: 3500 },
        epoch: 3,
        prerequisites: ['three_field_system'],
        effects: { buildings: { large_estate: 0.09 } },
    },
    {
        id: 'basic_weaving',
        name: "织布机",
        desc: "新型的纺织工具。织布坊效率 +15%。",
        cost: { science: 3150 },
        epoch: 3,
        prerequisites: ['wool_trade'],
        effects: { buildings: { loom_house: 0.15 } },
    },
    {
        id: 'theology',
        name: "神学",
        desc: "教堂文化产出 +18%。",
        cost: { science: 3850 },
        epoch: 3,
        prerequisites: ['ritual_priesthood'],
        effects: { buildings: { church: 0.18 } },
    },
    {
        id: 'bureaucracy',
        name: "官僚制度",
        desc: "解锁市政厅，建立高效的行政管理体系。采集、工业、市政建筑效率 +3%，每人每日获得 0.002 文化。",
        cost: { science: 4200 },
        epoch: 3,
        prerequisites: ['feudalism'],
        effects: { categories: { gather: 0.03, industry: 0.03, civic: 0.03 }, perPopPassive: { culture: 0.002 } },
    },
    {
        id: 'civil_service',
        name: "文官制度",
        desc: "建立系统化的文官选拔与考核体系，提升行政效率。税收收入 +5%。",
        cost: { science: 8750 },
        epoch: 4,
        prerequisites: ['bureaucracy'],
        effects: { taxIncome: 0.05 },
    },
    {
        id: 'administrative_reform',
        name: "行政改革",
        desc: "改革行政体系，提升官僚机构运转效率。民生建筑效率 +7%。",
        cost: { science: 18900 },
        epoch: 5,
        prerequisites: ['civil_service'],
        effects: { categories: { civic: 0.07 } },
    },
    {
        id: 'centralization',
        name: "中央集权",
        desc: "加强中央政府权威，统一政令。税收收入 +8%。",
        cost: { science: 27900 },
        epoch: 6,
        prerequisites: ['administrative_reform'],
        effects: { taxIncome: 0.08 },
    },
    {
        id: 'three_field_system',
        name: "三圃制",
        desc: "农田与庄园额外 +9% 产量。",
        cost: { science: 3850 },
        epoch: 3,
        prerequisites: ['forestry_management'],
        effects: { buildings: { farm: 0.09, large_estate: 0.09 } },
    },
    {
        id: 'stone_keep_engineering',
        name: "石垒堡舍",
        desc: "居住建筑人口上限加成 6%。",
        cost: { science: 4025 },
        epoch: 3,
        prerequisites: ['masonry_guild'],
        effects: { buildings: { hut: 0.06, house: 0.06 } },
    },
    {
        id: 'manor_architecture',
        name: "庄园建筑学",
        desc: "解锁石砌宅邸，贵族风格的坚固住宅，提供更多人口容量。宅邸效率 +15%，人口上限 +5%。",
        cost: { science: 4550 },
        epoch: 3,
        prerequisites: ['stone_keep_engineering'],
        effects: { buildings: { manor_house: 0.15 }, maxPop: 0.05 },
    },
    {
        id: 'monastic_brewing',
        name: "修道院酿造",
        desc: "解锁修道院酒祖，修士传承的高级酿酒工艺。酒祖效率 +15%，教堂文化 +10%。",
        cost: { science: 4200 },
        epoch: 3,
        prerequisites: ['theology'],
        effects: { buildings: { monastery_cellar: 0.15, church: 0.10 } },
    },    {
        id: 'wool_trade',
        name: "羊毛贸易",
        desc: "解锁纺织工场，封建时代最重要的纺织产业。纺织工场效率 +15%，织布坊效率 +10%。",
        cost: { science: 3850 },
        epoch: 3,
        prerequisites: ['primitive_weaving'],
        effects: { buildings: { wool_workshop: 0.15, loom_house: 0.10 } },
    },
    {
        id: 'masonry_guild',
        name: "石匠行会",
        desc: "解锁采石工场，行会组织的专业采石作业。采石工场效率 +15%，采石场效率 +10%。",
        cost: { science: 4025 },
        epoch: 3,
        prerequisites: ['carpentry'],
        effects: { buildings: { stone_workshop: 0.15, quarry: 0.10 } },
    },
    {
        id: 'forestry_management',
        name: "林业管理",
        desc: "解锁硬木林场，有计划的森林采伐与维护。硬木林场效率 +15%，伐木场效率 +10%。",
        cost: { science: 3675 },
        epoch: 3,
        prerequisites: ['carpentry'],
        effects: { buildings: { hardwood_camp: 0.15, lumber_camp: 0.10 } },
    },

    {
        id: 'ritual_priesthood',
        name: "仪式司祭",
        desc: "礼拜设施文化产出提升 9%。",
        cost: { science: 1190 },
        epoch: 3,
        prerequisites: ['amphitheater_design'],
        effects: { buildings: { church: 0.09 } },
    },
    {
        id: 'ironworking',
        name: "锻铁术",
        desc: "解锁铁器铺，并且铁矿井效率 +18%。",
        cost: { science: 1500 },
        epoch: 2,
        prerequisites: ['bronze_working'],
        effects: { buildings: { mine: 0.18 } },
    },
    // 探索时代
    {
        id: 'cartography',
        name: "海图绘制",
        desc: "船坞香料获取 +18%。",
        cost: { science: 6300 },
        epoch: 4,
        prerequisites: ['sailing'],
        effects: { buildings: { dockyard: 0.18 } },
    },
    {
        id: 'charter_companies',
        name: "特许公司",
        desc: "贸易港银币产出 +21%，财政收入 +5%。",
        cost: { science: 6650 },
        epoch: 4,
        prerequisites: ['cartography'],
        effects: { buildings: { trade_port: 0.21 }, taxIncome: 0.05 },
    },
    {
        id: 'navigator_schooling',
        name: "领航学",
        desc: "航海学院科研提升 21%。",
        cost: { science: 7000 },
        epoch: 4,
        prerequisites: ['cartography'],
        effects: { buildings: { navigator_school: 0.21 } },
    },
    {
        id: 'naval_artillery',
        name: "舰炮试验",
        desc: "船坞额外获得 10% 产量。",
        cost: { science: 7350 },
        epoch: 4,
        prerequisites: ['navigator_schooling'],
        effects: { buildings: { dockyard: 0.10 } },
    },
    {
        id: 'colonial_ledgers',
        name: "殖民档案",
        desc: "系统化的殖民地档案管理，提升海外贸易效率。船坞和贸易港效率 +14%，财政收入 +5%。",
        cost: { science: 7700 },
        epoch: 4,
        prerequisites: ['charter_companies'],
        effects: { buildings: { dockyard: 0.14, trade_port: 0.14 }, taxIncome: 0.05 },
    },
    {
        id: 'spice_monopolies',
        name: "香料垄断",
        desc: "贸易港再获 10% 产量。",
        cost: { science: 8050 },
        epoch: 4,
        prerequisites: ['colonial_ledgers'],
        effects: { buildings: { trade_port: 0.10 } },
    },
    {
        id: 'colonial_architecture',
        name: "殖民建筑",
        desc: "解锁联排住宅，港口城市流行的高效多层建筑。联排住宅效率 +15%，人口上限 +5%。",
        cost: { science: 8400 },
        epoch: 4,
        prerequisites: ['colonial_ledgers'],
        effects: { buildings: { townhouse: 0.15 }, maxPop: 0.05 },
    },
    {
        id: 'new_world_dyes',
        name: "新世界染料",
        desc: "解锁印染工坊，使用胭脂虫红等新世界珍贵染料。印染工坊效率 +15%，染坊效率 +10%。",
        cost: { science: 7875 },
        epoch: 4,
        prerequisites: ['charter_companies'],
        effects: { buildings: { dye_workshop: 0.15, dye_works: 0.10 } },
    },

    // 启蒙时代

    {
        id: 'coffee_agronomy',
        name: "咖啡栽培学",
        desc: "解锁咖啡种植园。",
        cost: { science: 14400 },
        epoch: 5,
        prerequisites: ['spice_monopolies'],
        effects: {},
    },
    {
        id: 'coffeehouse_philosophy',
        name: "咖啡馆哲学",
        desc: "解锁咖啡馆，每人每日获得 0.002 文化。",
        cost: { science: 15300 },
        epoch: 5,
        prerequisites: ['coffee_agronomy'],
        effects: { perPopPassive: { culture: 0.002 } },
    },
    {
        id: 'printing_press',
        name: "印刷机",
        desc: "解锁印刷所。",
        cost: { science: 16200 },
        epoch: 5,
        prerequisites: ['coffeehouse_philosophy'],
        effects: {},
    },
    {
        id: 'public_schooling',
        name: "公共教育",
        desc: "图书馆 +18% 科研，每人每日获得 0.001 文化。",
        cost: { science: 17100 },
        epoch: 5,
        prerequisites: ['printing_press'],
        effects: { buildings: { library: 0.18 }, perPopPassive: { culture: 0.001 } },
    },
    {
        id: 'social_contract',
        name: "社会契约",
        desc: "启蒙思想推动社会进步。民生建筑效率 +14%，人口上限 +5%，每人每日获得 0.003 文化。",
        cost: { science: 18000 },
        epoch: 5,
        prerequisites: ['public_schooling'],
        effects: { categories: { civic: 0.14 }, maxPop: 0.05, perPopPassive: { culture: 0.003 } },
    },
    {
        id: 'salon_debates',
        name: "沙龙辩论",
        desc: "剧场文化再增 10%。",
        cost: { science: 18900 },
        epoch: 5,
        prerequisites: ['social_contract'],
        effects: { buildings: { amphitheater: 0.10 } },
    },
    {
        id: 'enlightened_urbanism',
        name: "启蒙城市主义",
        desc: "解锁阁楼公馆，兼具优雅与实用的新式住宅区。阁楼公馆效率 +15%，人口上限 +6%。",
        cost: { science: 19800 },
        epoch: 5,
        prerequisites: ['social_contract'],
        effects: { buildings: { civic_apartment: 0.15 }, maxPop: 0.06 },
    },

    // 工业时代
    {
        id: 'coal_gasification',
        name: "煤气化",
        desc: "解锁煤矿开采。",
        cost: { science: 23400 },
        epoch: 6,
        effects: {},
    },
    {
        id: 'steel_alloys',
        name: "钢合金",
        desc: "解锁炼钢厂。",
        cost: { science: 24300 },
        epoch: 6,
        prerequisites: ['coal_gasification'],
        effects: {},
    },
    {
        id: 'industrialization',
        name: "工业化",
        desc: "解锁工厂，工业建筑效率 +7%。",
        cost: { science: 27000 },
        epoch: 6,
        prerequisites: ['steel_alloys'],
        effects: { categories: { industry: 0.07 } },
    },
    {
        id: 'steam_power',
        name: "蒸汽动力",
        desc: "工业建筑再获 +14% 产量。",
        cost: { science: 28800 },
        epoch: 6,
        prerequisites: ['precision_tools'],
        effects: { categories: { industry: 0.14 } },
    },
    {
        id: 'chemical_fertilizer',
        name: "化学施肥",
        desc: "农田与庄园 +14% 产出。",
        cost: { science: 27000 },
        epoch: 6,
        prerequisites: ['coal_gasification'],
        effects: { buildings: { farm: 0.14, large_estate: 0.14 } },
    },
    {
        id: 'rail_network',
        name: "铁路网",
        desc: "铁路枢纽效率 +21%，采集 +7%。",
        cost: { science: 27900 },
        epoch: 6,
        prerequisites: ['steel_alloys'],
        effects: { buildings: { rail_depot: 0.21 }, categories: { gather: 0.07 } },
    },
    {
        id: 'precision_tools',
        name: "精密机具",
        desc: "工厂产出 +18%。",
        cost: { science: 28800 },
        epoch: 6,
        prerequisites: ['industrialization'],
        effects: { buildings: { factory: 0.18 } },
    },

    // 军事知识
    {
        id: 'military_training',
        name: "军事训练",
        desc: "解锁训练场，提供更多军事容量。军事建筑效率 +10%。",
        cost: { science: 2800 },
        epoch: 2,
        prerequisites: ['ironworking'],
        effects: { categories: { military: 0.10 } },
    },
    {
        id: 'swordsmithing',
        name: "锻造术",
        desc: "解锁刀剑资源与铸剑坊，铁质兵器大幅提升近战部队战斗力。铸剑坊效率 +10%。",
        cost: { science: 2100 },
        epoch: 2,
        prerequisites: ['ironworking'],
        effects: { buildings: { swordsmith: 0.10 } },
    },
    {
        id: 'armor_forging',
        name: "铠甲锻造",
        desc: "解锁铠甲资源与甲胄工坊，重甲防护使精锐部队如铁壁般坚不可摧。甲胄工坊效率 +10%。",
        cost: { science: 3500 },
        epoch: 3,
        prerequisites: ['swordsmithing'],
        effects: { buildings: { armorsmith: 0.10 } },
    },
    {
        id: 'fortification',
        name: "要塞工程",
        desc: "解锁要塞，大幅提升军事容量。军事建筑效率 +18%，人口上限 +5%。",
        cost: { science: 8400 },
        epoch: 4,
        prerequisites: ['armor_forging'],
        effects: { categories: { military: 0.18 }, maxPop: 0.05 },
    },
    {
        id: 'gunpowder_formula',
        name: "火药配方",
        desc: "解锁火药资源与火药工坊，黑火药的发明彻底改变了战争形态。火药工坊效率 +10%。",
        cost: { science: 7000 },
        epoch: 4,
        prerequisites: ['fortification'],
        effects: { buildings: { powder_mill: 0.10 } },
    },
    {
        id: 'musket_manufacturing',
        name: "火器制造",
        desc: "解锁火枪资源与枪炮作坊，火绳枪与早期火炮震慑四方。枪炮作坊效率 +10%。",
        cost: { science: 8050 },
        epoch: 4,
        prerequisites: ['gunpowder_formula'],
        effects: { buildings: { gun_workshop: 0.10 } },
    },
    {
        id: 'rifle_engineering',
        name: "精密枪械",
        desc: "解锁步枪、弹药资源与枪械工坊、弹药厂。线膛枪管使射击精度大幅提升。枪械工坊效率 +10%，弹药厂效率 +10%。",
        cost: { science: 15750 },
        epoch: 5,
        prerequisites: ['musket_manufacturing'],
        effects: { buildings: { rifle_works: 0.10, ammo_factory: 0.10 } },
    },
    {
        id: 'military_industrialization',
        name: "军事工业化",
        desc: "解锁制式军火资源与兵工厂，大规模标准化军工生产线。所有军事建筑效率 +14%。",
        cost: { science: 27000 },
        epoch: 6,
        prerequisites: ['rifle_engineering'],
        effects: { categories: { military: 0.14 } },
    },

    // ========== 高级工业科技 ==========

    // 纺织产业升级知识
    {
        id: 'mechanized_weaving',
        name: "机械织布",
        desc: "解锁织布坊和成衣作坊，水力驱动的飞梭织机大幅提升布料产量。织布坊效率 +20%，成衣作坊效率 +15%。",
        cost: { science: 13500 },
        epoch: 5,
        prerequisites: ['basic_weaving'],
        effects: { buildings: { loom_house: 0.14, tailor_workshop: 0.10 } },
    },
    {
        id: 'assembly_line',
        name: "流水线生产",
        desc: "解锁纺织厂和服装工厂，标准化分工使产量大幅提升。纺织厂效率 +25%，服装工厂效率 +20%。",
        cost: { science: 26100 },
        epoch: 6,
        prerequisites: ['mechanized_weaving', 'industrialization'],
        effects: { buildings: { textile_mill: 0.18, garment_factory: 0.14 } },
    },

    // 木材加工产业升级知识
    {
        id: 'hydraulic_sawing',
        name: "水力锯切",
        desc: "解锁鑯木厂和伐木场升级，水轮驱动的圆锯效率远超手工。鑯木厂效率 +25%，伐木场效率 +15%。",
        cost: { science: 12600 },
        epoch: 5,
        prerequisites: ['forestry_management'],
        effects: { buildings: { sawmill: 0.18, lumber_camp: 0.10 } },
    },    {
        id: 'mass_production',
        name: "大规模生产",
        desc: "解锁木材加工厂和家具工坊，标准化零件实现批量生产。木材加工厂效率 +20%，家具工坊效率 +25%。",
        cost: { science: 25200 },
        epoch: 6,
        prerequisites: ['hydraulic_sawing', 'industrialization'],
        effects: { buildings: { lumber_mill: 0.14, furniture_workshop: 0.18 } },
    },

    // 冶金产业升级知识
    {
        id: 'advanced_metallurgy',
        name: "先进冶金",
        desc: "解锁竖井矿场，改良熔炉与合金配方提升工具质量。铁器铺效率 +20%，青铜铸坊效率 +15%。",
        cost: { science: 7700 },
        epoch: 4,
        prerequisites: ['masonry_guild'],
        effects: { buildings: { iron_tool_workshop: 0.14, bronze_foundry: 0.10 } },
    },
    {
        id: 'bessemer_process',
        name: "贝塞麦炼钢法",
        desc: "解锁炼钢厂和冶金工坊，吹入空气快速去碳，钢铁产量剧增。炼钢厂效率 +30%，冶金工坊效率 +25%。",
        cost: { science: 27900 },
        epoch: 6,
        prerequisites: ['advanced_metallurgy', 'steel_alloys'],
        effects: { buildings: { steel_foundry: 0.21, metallurgy_workshop: 0.18 } },
    },

    // 建材产业升级知识
    {
        id: 'industrial_ceramics',
        name: "工业陶瓷",
        desc: "解锁砖窑升级，环形窑与传送带实现连续烧制。砖窑效率 +25%。",
        cost: { science: 11700 },
        epoch: 5,
        prerequisites: ['masonry_guild'],
        effects: { buildings: { brickworks: 0.18 } },
    },
    {
        id: 'standardized_construction',
        name: "标准化建筑",
        desc: "解锁建材厂，预制构件加速建设、降低成本。建材厂效率 +25%，人口上限 +5%。",
        cost: { science: 24300 },
        epoch: 6,
        prerequisites: ['industrial_ceramics', 'industrialization'],
        effects: { buildings: { building_materials_plant: 0.18 }, maxPop: 0.05 },
    },

    // 食品加工产业升级知识
    {
        id: 'food_preservation',
        name: "食品保鲜",
        desc: "解锁罐头厂，密封罐装技术延长食品保质期。",
        cost: { science: 22500 },
        epoch: 6,
        prerequisites: ['chemical_fertilizer'],
        effects: { buildings: { culinary_kitchen: 0.18 } },
    },
    {
        id: 'distillation',
        name: "蒸馏技术",
        desc: "解锁蒸馏酒厂，分离提纯出高度烈酒。",
        cost: { science: 14400 },
        epoch: 5,
        prerequisites: ['monastic_brewing'],
        effects: { buildings: { brewery: 0.21 } },
    },

    // 造纸印刷产业升级知识
    {
        id: 'wood_pulp_process',
        name: "木浆造纸",
        desc: "解锁造纸厂，木材纤维取代手工纸浆，产量倍增。",
        cost: { science: 13050 },
        epoch: 5,
        prerequisites: ['papyrus_cultivation'],
        effects: { buildings: { reed_works: 0.21 } },
    },
    {
        id: 'mass_media',
        name: "大众传媒",
        desc: "解锁印刷所和出版社，报纸杂志覆盖全民，舆论力量崛起。印刷所效率 +30%，出版社效率 +20%。",
        cost: { science: 24750 },
        epoch: 6,
        prerequisites: ['printing_press', 'wood_pulp_process'],
        effects: { buildings: { printing_house: 0.21, publishing_house: 0.14 } },
    },

    // 高级采集知识
    {
        id: 'deep_shaft_mining',
        name: "深井采矿",
        desc: "解锁工业矿场，蒸汽泵排水、铁轨运矿，开采深层矿脉。",
        cost: { science: 23400 },
        epoch: 6,
        prerequisites: ['steam_power'],
        effects: { buildings: { mine: 0.18, coal_mine: 0.14 } },
    },
    {
        id: 'agricultural_machinery',
        name: "农业机械",
        desc: "解锁机械化农场，蒸汽拖拉机与收割机解放大量人力。",
        cost: { science: 25200 },
        epoch: 6,
        prerequisites: ['chemical_fertilizer', 'steam_power'],
        effects: { buildings: { farm: 0.18, large_estate: 0.21 } },
    },
    {
        id: 'steam_logging',
        name: "蒸汽伐木",
        desc: "解锁伐木公司，蒸汽锯与窄轨铁路运输原木。",
        cost: { science: 22500 },
        epoch: 6,
        prerequisites: ['hydraulic_sawing', 'steam_power'],
        effects: { buildings: { lumber_camp: 0.21 } },
    },

    // 高级文化与城市知识
    {
        id: 'higher_education',
        name: "高等教育",
        desc: "解锁大学，系统化培养专业人才。",
        cost: { science: 15750 },
        epoch: 5,
        prerequisites: ['public_schooling'],
        effects: { buildings: { library: 0.14, navigator_school: 0.14 } },
    },
    {
        id: 'grand_arts',
        name: "高雅艺术",
        desc: "解锁歌剧院，戏剧与音乐的殿堂。",
        cost: { science: 17100 },
        epoch: 5,
        prerequisites: ['salon_debates'],
        effects: { buildings: { amphitheater: 0.18, church: 0.10 } },
    },
    {
        id: 'urban_architecture',
        name: "城市建筑学",
        desc: "解锁公寓楼，多层建筑容纳更多城市人口。人口上限 +6%。",
        cost: { science: 26100 },
        epoch: 6,
        prerequisites: ['enlightened_urbanism', 'standardized_construction'],
        effects: { buildings: { house: 0.14 }, maxPop: 0.06 },
    },
    {
        id: 'financial_capitalism',
        name: "金融资本主义",
        desc: "解锁证券交易所，股票与债券调配社会资本。贸易港效率 +20%，铁路枢纽效率 +15%，财政收入 +8%。",
        cost: { science: 29250 },
        epoch: 6,
        prerequisites: ['rail_network', 'spice_monopolies'],
        effects: { buildings: { trade_port: 0.14, rail_depot: 0.10 }, taxIncome: 0.08 },
    },

    // 探索时代 (Epoch 4) 补充知识
    {
        id: 'cotton_cultivation',
        name: "棉花种植",
        desc: "解锁棉花种植园和棉纺织坊，棉花成为纺织业的核心原料。",
        cost: { science: 6500 },
        epoch: 4,
        prerequisites: ['new_world_dyes'],
        effects: { buildings: { loom_house: 0.10 } },
    },

    // 电气时代 (Epoch 7) 知识树
    // 第一批：原料/基础设施
    {
        id: 'oil_drilling',
        name: "石油钻探",
        desc: "掌握深层石油钻探技术，开启化石能源新纪元。",
        cost: { science: 18000 },
        epoch: 7,
        prerequisites: ['coal_gasification'],
        effects: {},
    },
    {
        id: 'rubber_vulcanization',
        name: "硫化橡胶",
        desc: "橡胶硫化工艺使天然橡胶变得耐用，成为工业关键材料。",
        cost: { science: 16000 },
        epoch: 7,
        prerequisites: ['coal_gasification'],
        effects: {},
    },
    {
        id: 'power_generation',
        name: "电力发电",
        desc: "利用蒸汽轮机将煤炭的热能转化为电能，开启电气化时代。",
        cost: { science: 20000 },
        epoch: 7,
        prerequisites: ['oil_drilling'],
        effects: {},
    },
    {
        id: 'deep_mining',
        name: "深层采矿",
        desc: "电气化采矿设备使深层矿脉的开采成为可能，铜产量倍增。",
        cost: { science: 17000 },
        epoch: 7,
        prerequisites: ['power_generation'],
        effects: {},
    },
    // 第二批：中间品/加工
    {
        id: 'organic_chemistry',
        name: "有机化学",
        desc: "从煤焦油和石油中提取有机化合物，化学工业由此诞生。",
        cost: { science: 22000 },
        epoch: 7,
        prerequisites: ['oil_drilling'],
        effects: {},
    },
    {
        id: 'electrical_wiring',
        name: "电线制造",
        desc: "绝缘铜线的大规模生产，铜的需求进入爆发式增长期。",
        cost: { science: 21000 },
        epoch: 7,
        prerequisites: ['rubber_vulcanization', 'power_generation'],
        effects: {},
    },
    {
        id: 'mechanical_engineering',
        name: "机械工程",
        desc: "精密机械设计与制造，为汽车和工厂设备奠定基础。",
        cost: { science: 24000 },
        epoch: 7,
        prerequisites: ['power_generation'],
        effects: {},
    },
    {
        id: 'synthetic_fertilizer',
        name: "合成化肥",
        desc: "哈伯法合成氨，化肥革命彻底改变农业面貌。",
        cost: { science: 23000 },
        epoch: 7,
        prerequisites: ['organic_chemistry'],
        effects: {},
    },
    {
        id: 'synthetic_chemistry',
        name: "合成化学",
        desc: "煤化工合成人造纤维，纺织业迎来革命性变革。",
        cost: { science: 35000 },
        epoch: 7,
        prerequisites: ['organic_chemistry'],
        effects: {},
    },
    {
        id: 'electric_weaving',
        name: "电气纺织",
        desc: "电力驱动的大规模自动化纺织，产能飞跃式增长。",
        cost: { science: 38000 },
        epoch: 7,
        prerequisites: ['synthetic_chemistry', 'power_generation'],
        effects: {},
    },
    // 第三批：终端/标志性
    {
        id: 'automobile_manufacturing',
        name: "汽车制造",
        desc: "流水线生产汽车，改变人类出行方式的伟大发明。",
        cost: { science: 28000 },
        epoch: 7,
        prerequisites: ['mechanical_engineering', 'rubber_vulcanization'],
        effects: {},
    },
    {
        id: 'radio_broadcasting',
        name: "无线广播",
        desc: "电磁波携带信息穿越空间，大众传媒时代开启。",
        cost: { science: 25000 },
        epoch: 7,
        prerequisites: ['electrical_wiring'],
        effects: {},
    },
    {
        id: 'electrification',
        name: "全面电气化",
        desc: "电力网络覆盖全国，所有工业建筑获得效率加成。",
        cost: { science: 30000 },
        epoch: 7,
        prerequisites: ['power_generation', 'electrical_wiring'],
        effects: {
            buildings: {
                coal_power_plant: 0.15,
                oil_refinery: 0.10,
                wiring_factory: 0.10,
                machinery_plant: 0.10,
                automobile_factory: 0.10,
                synthetic_fiber_plant: 0.10,
                electric_textile_mill: 0.10,
                factory: 0.15,
                steel_works: 0.10
            }
        },
    },
    {
        id: 'modern_logistics',
        name: "现代物流",
        desc: "铁路网络与汽车运输的结合，大幅提升贸易效率。采集类建筑效率 +10%，银币收入 +5%。",
        cost: { science: 26000 },
        epoch: 7,
        prerequisites: ['automobile_manufacturing'],
        effects: {
            categories: { gather: 0.10 },
            taxIncome: 0.05
        },
    },

    // 原子时代 (Epoch 8) 知识树
    // 第一批：原料/基础
    {
        id: 'nuclear_physics',
        name: "核物理",
        desc: "理解原子核结构与裂变反应原理，开启核能时代。",
        cost: { science: 32000 },
        epoch: 8,
        prerequisites: ['electrification'],
        effects: {},
    },
    {
        id: 'polymer_chemistry',
        name: "高分子化学",
        desc: "合成塑料和高分子聚合物的技术突破。",
        cost: { science: 30000 },
        epoch: 8,
        prerequisites: ['organic_chemistry'],
        effects: {},
    },
    {
        id: 'aluminum_smelting',
        name: "铝冶炼",
        desc: "电解法大规模冶炼铝材，轻量化金属革命。",
        cost: { science: 31000 },
        epoch: 8,
        prerequisites: ['power_generation'],
        effects: {},
    },
    // 第二批：中间品/加工
    {
        id: 'transistor',
        name: "晶体管",
        desc: "固态电子器件取代真空管，电子工业的黎明。",
        cost: { science: 35000 },
        epoch: 8,
        prerequisites: ['electrical_wiring'],
        effects: {},
    },
    {
        id: 'integrated_circuits',
        name: "集成电路",
        desc: "在硅片上集成数百个晶体管，电子元件微型化革命。",
        cost: { science: 38000 },
        epoch: 8,
        prerequisites: ['transistor'],
        effects: {},
    },
    {
        id: 'pharmaceutical_industry',
        name: "制药工业",
        desc: "抗生素和现代药物的大规模工业化生产。",
        cost: { science: 33000 },
        epoch: 8,
        prerequisites: ['polymer_chemistry'],
        effects: {},
    },
    {
        id: 'nuclear_power',
        name: "核能发电",
        desc: "将受控核裂变转化为电能，能源新纪元。",
        cost: { science: 40000 },
        epoch: 8,
        prerequisites: ['nuclear_physics'],
        effects: {},
    },
    {
        id: 'synthetic_textiles',
        name: "合成纺织",
        desc: "化纤大规模应用于纺织业，人造纤维彻底改变服装产业。",
        cost: { science: 50000 },
        epoch: 8,
        prerequisites: ['synthetic_chemistry', 'polymer_chemistry'],
        effects: {},
    },
    // 第三批：终端/标志性
    {
        id: 'consumer_electronics',
        name: "消费电子",
        desc: "电子元件进入千家万户，家电工业蓬勃发展。",
        cost: { science: 42000 },
        epoch: 8,
        prerequisites: ['integrated_circuits'],
        effects: {},
    },
    {
        id: 'television_broadcasting',
        name: "电视广播",
        desc: "影像传播革命，视觉媒体主宰大众文化。",
        cost: { science: 36000 },
        epoch: 8,
        prerequisites: ['integrated_circuits', 'radio_broadcasting'],
        effects: {},
    },
    {
        id: 'high_rise_construction',
        name: "高层建筑",
        desc: "钢筋混凝土技术使摩天大楼成为可能。",
        cost: { science: 34000 },
        epoch: 8,
        prerequisites: ['aluminum_smelting'],
        effects: {},
    },
    {
        id: 'military_electronics',
        name: "军事电子化",
        desc: "电子设备应用于军事指挥和武器系统。",
        cost: { science: 44000 },
        epoch: 8,
        prerequisites: ['integrated_circuits'],
        effects: {},
    },
    {
        id: 'automation_basics',
        name: "自动化基础",
        desc: "工业自动化的初步应用，全面提升生产效率。所有工业建筑效率 +10%，采集效率 +5%。",
        cost: { science: 48000 },
        epoch: 8,
        prerequisites: ['consumer_electronics', 'military_electronics'],
        effects: {
            buildings: {
                electronics_factory: 0.15,
                plastics_factory: 0.10,
                synthetic_textile_mill: 0.10,
                coal_power_plant: 0.10,
                nuclear_power_plant: 0.10,
                factory: 0.10
            },
            categories: { gather: 0.05 }
        },
    },

    // 信息时代 (Epoch 9) 知识树
    // 第一批
    {
        id: 'photolithography',
        name: "光刻技术",
        desc: "在硅片上精确蚀刻纳米级电路图案的关键技术。",
        cost: { science: 55000 },
        epoch: 9,
        prerequisites: ['integrated_circuits'],
        effects: {},
    },
    {
        id: 'semiconductor_manufacturing',
        name: "半导体制造",
        desc: "大规模集成电路的工业化生产，信息时代的基石。",
        cost: { science: 60000 },
        epoch: 9,
        prerequisites: ['photolithography'],
        effects: {},
    },
    {
        id: 'solar_energy',
        name: "太阳能发电",
        desc: "光伏效应将阳光直接转化为电能，清洁能源革命。",
        cost: { science: 52000 },
        epoch: 9,
        prerequisites: ['semiconductor_manufacturing'],
        effects: {},
    },
    {
        id: 'composite_materials',
        name: "复合材料",
        desc: "碳纤维和先进聚合物的工业化应用。",
        cost: { science: 50000 },
        epoch: 9,
        prerequisites: ['polymer_chemistry', 'aluminum_smelting'],
        effects: {},
    },
    // 第二批
    {
        id: 'internet',
        name: "互联网",
        desc: "全球计算机网络连接改变信息传播方式。",
        cost: { science: 58000 },
        epoch: 9,
        prerequisites: ['semiconductor_manufacturing'],
        effects: {},
    },
    {
        id: 'software_engineering',
        name: "软件工程",
        desc: "系统化的软件开发方法论和工具链。",
        cost: { science: 56000 },
        epoch: 9,
        prerequisites: ['internet'],
        effects: {},
    },
    {
        id: 'cloud_computing',
        name: "云计算",
        desc: "将计算资源虚拟化并按需分配。",
        cost: { science: 62000 },
        epoch: 9,
        prerequisites: ['internet', 'software_engineering'],
        effects: {},
    },
    {
        id: 'fintech',
        name: "金融科技",
        desc: "数字化金融服务重塑全球资本市场。",
        cost: { science: 60000 },
        epoch: 9,
        prerequisites: ['cloud_computing'],
        effects: {},
    },
    // 第三批
    {
        id: 'biotech',
        name: "生物科技",
        desc: "基因编辑和分子工程开创医学新纪元。",
        cost: { science: 65000 },
        epoch: 9,
        prerequisites: ['pharmaceutical_industry', 'semiconductor_manufacturing'],
        effects: {},
    },
    {
        id: 'ai_automation',
        name: "AI与自动化",
        desc: "人工智能驱动的全面自动化，劳动力需求锐减。",
        cost: { science: 70000 },
        epoch: 9,
        prerequisites: ['software_engineering', 'automation_basics'],
        effects: {},
    },
    {
        id: 'ai_research',
        name: "前沿AI研究",
        desc: "深度学习和通用人工智能的突破性进展。",
        cost: { science: 75000 },
        epoch: 9,
        prerequisites: ['ai_automation', 'cloud_computing'],
        effects: {},
    },
    {
        id: 'space_technology',
        name: "航天科技",
        desc: "复合材料和精密电子使太空探索成为可能。终极科技，全面提升国力。",
        cost: { science: 80000 },
        epoch: 9,
        prerequisites: ['composite_materials', 'ai_research'],
        effects: {
            categories: { industry: 0.20, gather: 0.15 },
            taxIncome: 0.10
        },
    },
];

// 知识树索引：id → 对象，便于快速查找
export const TECH_MAP = TECHS.reduce((map, tech) => {
    map[tech.id] = tech;
    return map;
}, {});

/**
 * 运行时校验：检查循环依赖和无效引用
 * 在开发环境中自动执行，生产环境跳过
 */
export function validateTechTree() {
    const errors = [];
    const idSet = new Set(TECHS.map(t => t.id));

    // 检查无效引用
    for (const tech of TECHS) {
        if (!tech.prerequisites) continue;
        for (const prereqId of tech.prerequisites) {
            if (!idSet.has(prereqId)) {
                errors.push(`[知识树] 无效前置引用: "${tech.id}" 引用了不存在的 "${prereqId}"`);
            }
        }
    }

    // 检查循环依赖（DFS）
    const visited = new Set();
    const inStack = new Set();

    function dfs(techId, path) {
        if (inStack.has(techId)) {
            errors.push(`[知识树] 循环依赖: ${[...path, techId].join(' → ')}`);
            return;
        }
        if (visited.has(techId)) return;
        visited.add(techId);
        inStack.add(techId);
        const tech = TECH_MAP[techId];
        if (tech?.prerequisites) {
            for (const prereqId of tech.prerequisites) {
                if (idSet.has(prereqId)) {
                    dfs(prereqId, [...path, techId]);
                }
            }
        }
        inStack.delete(techId);
    }

    for (const tech of TECHS) {
        if (!visited.has(tech.id)) {
            dfs(tech.id, []);
        }
    }

    // 输出结果
    if (errors.length > 0) {
        errors.forEach(e => console.warn(e));
    }
    return errors;
}

// 开发环境自动执行校验
if (import.meta.env?.DEV) {
    validateTechTree();
}
