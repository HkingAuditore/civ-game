// 情景模式配置
// 通过配置化方式定义开局条件
// 设计原则：各时代场景应包含之前时代的大部分科技

// 各时代基础科技（用于配置参考）
// 时代0: barter, stone_axes, flint_knapping, animal_husbandry, pottery, tool_making, basic_irrigation, oral_tradition, communal_granary, river_fishing, wheel
// 时代1: sailing, tools, copper_mining, bronze_working, horse_collar, caravan_trade, granary_architecture, primitive_weaving, amphitheater_design
// 时代2: papyrus_cultivation, culinary_arts, brewing, carpentry, library_catalogs, urban_planning, republican_code, road_system, advanced_weaving, ironworking, military_training
// 时代3: feudalism, basic_weaving, theology, bureaucracy, three_field_system, stone_keep_engineering, ritual_priesthood
// 时代4: cartography, charter_companies, navigator_schooling, naval_artillery, colonial_ledgers, spice_monopolies, advanced_metallurgy, fortification
// 时代5: coffee_agronomy, coffeehouse_philosophy, printing_press, public_schooling, social_contract, salon_debates, mechanized_weaving, hydraulic_sawing, industrial_ceramics, distillation, wood_pulp_process, higher_education, grand_arts
// 时代6: coal_gasification, steel_alloys, industrialization, steam_power, chemical_fertilizer, rail_network, precision_tools, assembly_line, mass_production, bessemer_process, standardized_construction, food_preservation, mass_media, deep_shaft_mining, agricultural_machinery, steam_logging, urban_architecture, financial_capitalism

// 时代3完整科技包
const EPOCH_3_TECHS = [
    // 时代0
    'barter', 'stone_axes', 'flint_knapping', 'animal_husbandry', 'pottery', 'tool_making', 'basic_irrigation', 'oral_tradition', 'communal_granary', 'river_fishing', 'wheel',
    // 时代1
    'sailing', 'tools', 'copper_mining', 'bronze_working', 'horse_collar', 'caravan_trade', 'granary_architecture', 'primitive_weaving', 'amphitheater_design',
    // 时代2
    'papyrus_cultivation', 'culinary_arts', 'brewing', 'carpentry', 'library_catalogs', 'urban_planning', 'republican_code', 'road_system', 'advanced_weaving', 'ironworking', 'military_training',
    // 时代3
    'feudalism', 'basic_weaving', 'theology', 'bureaucracy', 'three_field_system', 'stone_keep_engineering', 'ritual_priesthood',
];

// 时代4完整科技包
const EPOCH_4_TECHS = [
    ...EPOCH_3_TECHS,
    // 时代4
    'cartography', 'charter_companies', 'navigator_schooling', 'naval_artillery', 'colonial_ledgers', 'spice_monopolies', 'advanced_metallurgy', 'fortification',
];

// 时代5完整科技包
const EPOCH_5_TECHS = [
    ...EPOCH_4_TECHS,
    // 时代5
    'coffee_agronomy', 'coffeehouse_philosophy', 'printing_press', 'public_schooling', 'social_contract', 'salon_debates', 'mechanized_weaving', 'hydraulic_sawing', 'industrial_ceramics', 'distillation', 'wood_pulp_process', 'higher_education', 'grand_arts',
];

// 时代6完整科技包
const EPOCH_6_TECHS = [
    ...EPOCH_5_TECHS,
    // 时代6
    'coal_gasification', 'steel_alloys', 'industrialization', 'steam_power', 'chemical_fertilizer', 'rail_network', 'precision_tools', 'assembly_line', 'mass_production', 'bessemer_process', 'standardized_construction', 'food_preservation', 'mass_media', 'deep_shaft_mining', 'agricultural_machinery', 'steam_logging', 'urban_architecture', 'financial_capitalism',
];

export const SCENARIOS = [
    // ==================== 基础场景 ====================
    {
        id: 'agrarian_realm',
        name: '沃野同盟',
        icon: '🌾',
        description: '在肥沃的河谷平原上，一个以农业为根基的联盟正在崛起。祖辈开垦的良田养育了世代子民，粮仓充盈，民风淳朴。',
        tags: ['农业强', '人口偏农', '时代3'],
        highlights: ['农田与粮仓遍地', '自耕农与佃农占据主导', '粮食储备充足'],
        overrides: {
            resources: { 
                food: 300000, wood: 50000, stone: 30000, silver: 80000, culture: 15000, 
                cloth: 12000, tools: 8000, plank: 15000, brick: 12000, iron: 5000, copper: 4000,
            },
            buildings: { 
                farm: 40, lumber_camp: 12, loom_house: 6, large_estate: 10, hut: 20, house: 12,
                granary: 8, quarry: 6, brickworks: 4, sawmill: 6, trading_post: 3, market: 2,
                library: 1, church: 2, barracks: 3, training_ground: 1,
            },
            population: 420,
            popStructure: {
                peasant: 80, lumberjack: 24, worker: 42, serf: 60, landowner: 10,
                miner: 12, merchant: 9, scribe: 3, cleric: 6, soldier: 100, unemployed: 74,
            },
            maxPop: 500, epoch: 3,
            techsUnlocked: EPOCH_3_TECHS,
            rulingCoalition: ['peasant', 'landowner'],
            legitimacy: 45, stability: 65,
            classWealth: { peasant: 300, lumberjack: 250, worker: 200, serf: 80, landowner: 3000, miner: 200, merchant: 1200, scribe: 500, cleric: 800, soldier: 200, unemployed: 30 },
            classApproval: { peasant: 65, lumberjack: 60, worker: 55, serf: 45, landowner: 75, miner: 50, merchant: 60, scribe: 55, cleric: 70, soldier: 60, unemployed: 30 },
            activeDecrees: ['communal_granary', 'hunting_party', 'feudal_levy'],
            nationRelations: { 'stone_clan': 55, 'dawn_tribe': 70, 'river_confederation': 65 },
            army: { militia: 30, slinger: 20, spearman: 25, archer: 15, hoplite: 10 },
            marketPrices: { food: 0.5, wood: 2.5, tools: 18 },
        },
    },

    // ==================== 历史致敬场景 ====================
    {
        id: 'pax_romana',
        name: '罗马治世',
        icon: '🏛️',
        description: '「我来，我见，我征服。」帝国的雄鹰展翅于地中海之滨，军团铁蹄踏遍已知世界。道路四通八达，法律严明，公民以身为罗马人而骄傲。',
        tags: ['军政并重', '法制严明', '时代4'],
        highlights: ['强大军团', '元老院政治', '完善法制', '道路通商'],
        overrides: {
            resources: { 
                food: 1200000, wood: 400000, stone: 600000, silver: 1500000, culture: 300000, 
                cloth: 150000, tools: 200000, plank: 200000, brick: 300000, iron: 200000, copper: 100000,
            },
            buildings: { 
                farm: 80, large_estate: 25, quarry: 20, mine: 15, sawmill: 20, brickworks: 15,
                amphitheater: 15, library: 12, town_hall: 10, church: 8, market: 20, trading_post: 25,
                house: 60, barracks: 20, training_ground: 15, fortress: 10,
            },
            population: 1000,
            popStructure: {
                peasant: 100, serf: 150, landowner: 25, worker: 120, artisan: 30, miner: 75,
                merchant: 45, scribe: 36, official: 50, cleric: 24, soldier: 300, unemployed: 45,
            },
            maxPop: 1200, epoch: 4,
            techsUnlocked: EPOCH_4_TECHS,
            rulingCoalition: ['official', 'soldier', 'landowner'],
            legitimacy: 70, stability: 75,
            classWealth: { peasant: 200, serf: 60, landowner: 4000, worker: 300, artisan: 800, miner: 250, merchant: 3000, scribe: 1500, official: 4000, cleric: 1200, soldier: 600, unemployed: 40 },
            classApproval: { peasant: 50, serf: 35, landowner: 80, worker: 55, artisan: 65, miner: 45, merchant: 70, scribe: 70, official: 85, cleric: 65, soldier: 80, unemployed: 25 },
            activeDecrees: ['standing_army', 'bread_and_circus', 'corvee_labor', 'agora_assembly'],
            nationRelations: { 'sparta_militaris': 60, 'marble_league': 70, 'eternal_city': 90 },
            army: { heavy_infantry: 100, hoplite: 80, crossbowman: 50, light_cavalry: 30, knight: 20 },
            marketPrices: { stone: 1.5, iron: 3 },
        },
    },
    {
        id: 'silk_dynasty',
        name: '丝路王朝',
        icon: '🐉',
        description: '「普天之下，莫非王土。」东方帝国的繁华超越想象，丝绸之路连接东西，官僚体系井然有序。儒生治国，科举取士，文化昌盛，四海升平。',
        tags: ['文化昌盛', '官僚治国', '时代5'],
        highlights: ['丝绸之路', '科举制度', '官僚体系', '四海来朝'],
        overrides: {
            resources: { 
                food: 2500000, wood: 800000, stone: 600000, silver: 3500000, culture: 800000, 
                cloth: 500000, tools: 300000, plank: 400000, brick: 350000, iron: 300000, 
                papyrus: 200000, fine_clothes: 150000, spice: 100000, furniture: 80000,
            },
            buildings: { 
                farm: 100, large_estate: 35, loom_house: 30, tailor_workshop: 20, library: 25, 
                town_hall: 15, amphitheater: 10, church: 12, market: 30, trading_post: 40, trade_port: 8,
                house: 80, mine: 15, sawmill: 25, brickworks: 18, barracks: 10, training_ground: 8, fortress: 5,
            },
            population: 1400,
            popStructure: {
                peasant: 200, serf: 210, landowner: 35, worker: 150, artisan: 60, miner: 45,
                merchant: 70, scribe: 100, official: 75, cleric: 36, soldier: 200, unemployed: 223,
            },
            maxPop: 1700, epoch: 5,
            techsUnlocked: EPOCH_5_TECHS,
            rulingCoalition: ['official', 'scribe', 'landowner'],
            legitimacy: 75, stability: 70,
            classWealth: { peasant: 400, serf: 100, landowner: 8000, worker: 500, artisan: 1500, miner: 350, merchant: 6000, scribe: 3500, official: 8000, cleric: 2000, soldier: 800, unemployed: 80 },
            classApproval: { peasant: 55, serf: 40, landowner: 75, worker: 50, artisan: 60, miner: 45, merchant: 65, scribe: 85, official: 90, cleric: 70, soldier: 60, unemployed: 30 },
            activeDecrees: ['divine_kingship', 'temple_economy', 'salt_monopoly'],
            nationRelations: { 'silk_empire': 90, 'ming_celestial': 85, 'desert_caravan': 75, 'steppe_horde': 40 },
            army: { heavy_infantry: 80, composite_archer: 60, crossbowman: 40, light_cavalry: 20 },
            marketPrices: { cloth: 0.8, fine_clothes: 25, papyrus: 2 },
        },
    },
    {
        id: 'venetian_republic',
        name: '威尼斯共和',
        icon: '🦁',
        description: '「圣马可的雄狮永不沉睡。」亚德里亚海上的明珠，商人共和国的典范。总督与议会共治，商队远航四海，金币源源不断。',
        tags: ['商业霸权', '寡头共和', '时代5'],
        highlights: ['商人主政', '海上贸易', '银行金融', '玻璃工艺'],
        overrides: {
            resources: { 
                silver: 8000000, food: 1200000, wood: 350000, stone: 400000, 
                cloth: 400000, plank: 300000, brick: 250000, spice: 200000, coffee: 80000,
                fine_clothes: 120000, furniture: 80000, delicacies: 60000, tools: 200000,
            },
            buildings: { 
                market: 50, trading_post: 60, trade_port: 35, dockyard: 25, coffee_house: 15,
                library: 12, town_hall: 8, navigator_school: 8, amphitheater: 8,
                farm: 40, loom_house: 20, tailor_workshop: 15, furniture_workshop: 10,
                house: 70, barracks: 8, training_ground: 5, fortress: 3,
            },
            population: 1100,
            popStructure: {
                merchant: 280, navigator: 75, scribe: 60, worker: 100, peasant: 80, artisan: 75,
                official: 40, cleric: 24, soldier: 200, unemployed: 166,
            },
            maxPop: 1400, epoch: 5,
            techsUnlocked: EPOCH_5_TECHS,
            rulingCoalition: ['merchant', 'navigator'],
            legitimacy: 60, stability: 70,
            classWealth: { merchant: 25000, navigator: 5000, scribe: 3000, worker: 600, peasant: 400, artisan: 4000, official: 6000, cleric: 2500, soldier: 800, unemployed: 100 },
            classApproval: { merchant: 90, navigator: 80, scribe: 65, worker: 50, peasant: 45, artisan: 65, official: 70, cleric: 60, soldier: 60, unemployed: 35 },
            activeDecrees: ['navigation_act', 'joint_stock', 'bullionism', 'hanseatic_law'],
            nationRelations: { 'merchant_republic': 95, 'desert_caravan': 80, 'silk_empire': 70, 'island_thalassocracy': 85 },
            army: { pikeman: 80, arquebus: 60, cuirassier: 30, musketeer: 30 },
            marketPrices: { spice: 12, cloth: 1.0 },
        },
    },
    {
        id: 'spartan_state',
        name: '斯巴达军制',
        icon: '⚔️',
        description: '「带着盾回来，或者躺在盾上回来。」这是一个将军事训练推向极致的社会。每个公民都是战士，从出生起就接受严酷训练。',
        tags: ['全民皆兵', '军事至上', '时代3'],
        highlights: ['重装步兵', '铁血纪律', '军事训练', '公民战士'],
        overrides: {
            resources: { 
                food: 250000, wood: 60000, stone: 80000, silver: 100000, culture: 20000, 
                cloth: 15000, tools: 25000, plank: 30000, brick: 25000, iron: 40000, copper: 20000,
            },
            buildings: { 
                farm: 35, large_estate: 15, quarry: 10, mine: 8, sawmill: 8, brickworks: 6,
                barracks: 15, training_ground: 12, fortress: 8, amphitheater: 3, library: 2, church: 2,
                hut: 25, house: 15, market: 3, trading_post: 5,
            },
            population: 500,
            popStructure: {
                peasant: 35, serf: 90, landowner: 15, worker: 44, artisan: 8, miner: 28,
                merchant: 8, scribe: 6, cleric: 6, soldier: 245, unemployed: 15,
            },
            maxPop: 550, epoch: 3,
            techsUnlocked: EPOCH_3_TECHS,
            rulingCoalition: ['soldier'],
            legitimacy: 40, stability: 45,
            classWealth: { peasant: 100, serf: 30, landowner: 2000, worker: 150, artisan: 400, miner: 120, merchant: 800, scribe: 400, cleric: 500, soldier: 400, unemployed: 20 },
            classApproval: { peasant: 35, serf: 20, landowner: 60, worker: 40, artisan: 50, miner: 35, merchant: 50, scribe: 45, cleric: 50, soldier: 90, unemployed: 15 },
            activeDecrees: ['warrior_caste', 'war_economy', 'standing_army', 'press_gang'],
            nationRelations: { 'sparta_militaris': 95, 'agora_polis': 40, 'steppe_horde': 30 },
            army: { hoplite: 150, heavy_infantry: 50, spearman: 20 },
            marketPrices: { iron: 2, tools: 10, food: 1.5 },
        },
    },
    {
        id: 'viking_conquest',
        name: '维京远征',
        icon: '⛵',
        description: '「瓦尔哈拉的荣耀在等待！」北方的战士驾驭长船，越过风暴肆虐的海洋。劫掠、贸易、定居——三位一体的扩张策略。',
        tags: ['海上掠夺', '冒险精神', '时代3'],
        highlights: ['长船远航', '劫掠致富', '战士文化', '贸易网络'],
        overrides: {
            resources: { 
                food: 200000, wood: 80000, stone: 40000, silver: 180000, culture: 12000, 
                cloth: 20000, tools: 20000, plank: 50000, iron: 30000, copper: 15000, spice: 15000,
            },
            buildings: { 
                lumber_camp: 20, farm: 30, dockyard: 10, trading_post: 15, market: 5,
                barracks: 12, training_ground: 8, fortress: 4, church: 3, library: 2,
                hut: 30, house: 10, sawmill: 10, brickworks: 4, quarry: 6, mine: 5,
            },
            population: 450,
            popStructure: {
                peasant: 60, lumberjack: 40, worker: 50, serf: 30, navigator: 40,
                merchant: 20, scribe: 6, cleric: 9, soldier: 175, unemployed: 20,
            },
            maxPop: 500, epoch: 3,
            techsUnlocked: EPOCH_3_TECHS,
            rulingCoalition: ['soldier', 'navigator'],
            legitimacy: 30, stability: 40,
            classWealth: { peasant: 150, lumberjack: 200, worker: 180, serf: 50, navigator: 1500, merchant: 2000, scribe: 400, cleric: 600, soldier: 500, unemployed: 30 },
            classApproval: { peasant: 45, lumberjack: 55, worker: 50, serf: 30, navigator: 80, merchant: 65, scribe: 40, cleric: 55, soldier: 85, unemployed: 25 },
            activeDecrees: ['warrior_caste', 'navigation_act', 'press_gang'],
            nationRelations: { 'viking_raiders': 90, 'british_empire': 25, 'eternal_city': 30, 'island_thalassocracy': 60 },
            army: { heavy_infantry: 80, archer: 40, light_cavalry: 20, slinger: 20 },
            marketPrices: { wood: 1.5, spice: 20 },
        },
    },
    {
        id: 'mongol_horde',
        name: '蒙古铁骑',
        icon: '🏹',
        description: '「长生天之下，唯有蒙古！」草原上最可怕的战争机器，骑射无双的游牧帝国。从太平洋到多瑙河，没有人能阻挡草原之鹰。',
        tags: ['骑兵无敌', '快速征服', '时代4'],
        highlights: ['骑射精湛', '机动作战', '草原霸主', '横扫欧亚'],
        overrides: {
            resources: { 
                food: 600000, wood: 150000, stone: 100000, silver: 800000, culture: 50000, 
                cloth: 60000, tools: 100000, iron: 150000, copper: 50000, spice: 40000,
            },
            buildings: { 
                farm: 40, large_estate: 20, lumber_camp: 15, quarry: 10, mine: 12,
                barracks: 25, training_ground: 20, fortress: 15, market: 15, trading_post: 30,
                hut: 40, house: 25, church: 5, library: 3,
            },
            population: 900,
            popStructure: {
                peasant: 80, serf: 120, landowner: 20, lumberjack: 30, worker: 40, miner: 36,
                merchant: 45, scribe: 9, cleric: 15, soldier: 450, unemployed: 55,
            },
            maxPop: 1000, epoch: 4,
            techsUnlocked: EPOCH_4_TECHS,
            rulingCoalition: ['soldier'],
            legitimacy: 35, stability: 35,
            classWealth: { peasant: 80, serf: 30, landowner: 1500, lumberjack: 100, worker: 120, miner: 100, merchant: 2500, scribe: 300, cleric: 400, soldier: 400, unemployed: 20 },
            classApproval: { peasant: 30, serf: 20, landowner: 55, lumberjack: 35, worker: 35, miner: 30, merchant: 60, scribe: 40, cleric: 45, soldier: 85, unemployed: 15 },
            activeDecrees: ['warrior_caste', 'war_economy', 'standing_army', 'feudal_levy'],
            nationRelations: { 'mongol_horde': 95, 'steppe_horde': 80, 'silk_empire': 30, 'eternal_city': 20 },
            army: { horse_archer: 200, light_cavalry: 100, cuirassier: 50, trebuchet: 30, bombard: 20 },
            marketPrices: { iron: 2, food: 1.2 },
        },
    },
    {
        id: 'renaissance_florence',
        name: '翡冷翠文艺',
        icon: '🎨',
        description: '「人是万物的尺度。」美第奇家族赞助下的佛罗伦萨，艺术与思想的火花在这里绽放。达芬奇、米开朗基罗、马基雅维利……天才云集。',
        tags: ['文艺复兴', '银行金融', '时代5'],
        highlights: ['艺术赞助', '人文主义', '银行业', '天才辈出'],
        overrides: {
            resources: { 
                silver: 6000000, food: 1000000, wood: 400000, stone: 500000, culture: 1000000, 
                cloth: 350000, plank: 300000, brick: 280000, papyrus: 200000, 
                fine_clothes: 150000, furniture: 120000, delicacies: 80000, tools: 180000,
            },
            buildings: { 
                library: 30, amphitheater: 25, church: 20, town_hall: 12, coffee_house: 10,
                printing_house: 8, market: 25, trading_post: 35, tailor_workshop: 18, furniture_workshop: 15,
                farm: 45, loom_house: 20, house: 65, mine: 8, sawmill: 15, brickworks: 12,
                barracks: 6, training_ground: 4, fortress: 2,
            },
            population: 1150,
            popStructure: {
                peasant: 90, worker: 80, artisan: 108, merchant: 60, scribe: 120, official: 60,
                cleric: 65, landowner: 15, miner: 24, capitalist: 10, soldier: 150, unemployed: 368,
            },
            maxPop: 1400, epoch: 5,
            techsUnlocked: EPOCH_5_TECHS,
            rulingCoalition: ['merchant', 'scribe', 'cleric'],
            legitimacy: 55, stability: 65,
            classWealth: { peasant: 350, worker: 450, artisan: 2500, merchant: 15000, scribe: 4000, official: 5000, cleric: 3500, landowner: 6000, miner: 300, capitalist: 30000, soldier: 600, unemployed: 100 },
            classApproval: { peasant: 50, worker: 55, artisan: 75, merchant: 80, scribe: 90, official: 75, cleric: 80, landowner: 70, miner: 45, capitalist: 85, soldier: 55, unemployed: 40 },
            activeDecrees: ['printing_privilege', 'guild_charter', 'agora_assembly', 'bread_and_circus'],
            nationRelations: { 'merchant_republic': 80, 'eternal_city': 75, 'marble_league': 85, 'lumiere_republic': 70 },
            army: { pikeman: 60, arquebus: 50, crossbowman: 30, cuirassier: 10 },
            marketPrices: { culture: 0.5, papyrus: 2, fine_clothes: 22 },
        },
    },
    {
        id: 'british_empire',
        name: '日不落帝国',
        icon: '👑',
        description: '「统治吧，不列颠尼亚！」皇家海军称霸七海，工业革命的蒸汽机轰鸣作响。殖民地遍布全球，太阳永不落下。这是维多利亚时代的顶峰。',
        tags: ['海上霸权', '工业革命', '时代6'],
        highlights: ['皇家海军', '蒸汽动力', '全球殖民', '议会政治'],
        overrides: {
            resources: { 
                silver: 15000000, food: 4000000, wood: 1500000, stone: 1200000, 
                cloth: 800000, plank: 700000, brick: 600000, iron: 800000, coal: 600000, steel: 300000,
                tools: 500000, spice: 300000, coffee: 200000, fine_clothes: 250000, culture: 500000,
            },
            buildings: { 
                factory: 15, textile_mill: 20, steel_foundry: 8, coal_mine: 15, mine: 20,
                trade_port: 40, dockyard: 30, market: 35, trading_post: 50, coffee_house: 20,
                library: 20, printing_house: 12, town_hall: 15, navigator_school: 10,
                farm: 80, house: 100, barracks: 15, training_ground: 10, fortress: 8,
            },
            population: 1800,
            popStructure: {
                peasant: 160, worker: 350, artisan: 80, miner: 125, engineer: 30, capitalist: 35,
                merchant: 110, navigator: 60, scribe: 60, official: 75, cleric: 40, 
                soldier: 400, unemployed: 275,
            },
            maxPop: 2200, epoch: 6,
            techsUnlocked: EPOCH_6_TECHS,
            rulingCoalition: ['capitalist', 'merchant', 'official'],
            legitimacy: 65, stability: 70,
            classWealth: { peasant: 600, worker: 800, artisan: 2000, miner: 600, engineer: 4000, capitalist: 80000, merchant: 20000, navigator: 6000, scribe: 3500, official: 8000, cleric: 3000, soldier: 1000, unemployed: 150 },
            classApproval: { peasant: 45, worker: 50, artisan: 60, miner: 45, engineer: 70, capitalist: 90, merchant: 80, navigator: 75, scribe: 65, official: 75, cleric: 60, soldier: 70, unemployed: 30 },
            activeDecrees: ['navigation_act', 'joint_stock', 'laissez_faire', 'hanseatic_law', 'standing_army'],
            nationRelations: { 'british_empire': 95, 'dutch_voc': 60, 'lumiere_republic': 50, 'ming_celestial': 45 },
            army: { musketeer: 150, rifleman: 100, cuirassier: 50, cannon: 40, ironclad: 20, gatling: 10, howitzer: 10 },
            marketPrices: { coal: 3, steel: 8, cloth: 0.8 },
        },
    },

    // ==================== 原有场景 ====================
    {
        id: 'restive_frontier',
        name: '纷争边境',
        icon: '🔥',
        description: '烽火不熄，边关多事。这片疆土锻造出一支骁勇善战的边防军。将士们枕戈待旦，随时准备应对威胁。',
        tags: ['易造反', '军政紧张', '时代4'],
        highlights: ['军事设施完备', '军队规模庞大', '铁器军械充足'],
        overrides: {
            resources: { 
                food: 800000, wood: 300000, stone: 400000, silver: 500000, tools: 200000, 
                iron: 300000, copper: 100000, brick: 200000, plank: 150000, cloth: 80000,
            },
            buildings: { 
                farm: 60, large_estate: 20, sawmill: 20, iron_tool_workshop: 18, brickworks: 15,
                quarry: 18, mine: 12, barracks: 25, training_ground: 15, fortress: 12,
                hut: 30, house: 40, granary: 15, church: 3,
            },
            population: 1100,
            popStructure: {
                peasant: 120, serf: 120, landowner: 20, worker: 126, artisan: 18, miner: 96,
                capitalist: 12, cleric: 9, soldier: 480, unemployed: 99,
            },
            maxPop: 1300, epoch: 4,
            techsUnlocked: EPOCH_4_TECHS,
            rulingCoalition: ['soldier', 'landowner'],
            legitimacy: 25, stability: 30,
            classWealth: { peasant: 100, serf: 40, landowner: 2000, worker: 150, artisan: 400, miner: 120, capitalist: 5000, cleric: 600, soldier: 300, unemployed: 25 },
            classApproval: { peasant: 30, serf: 25, landowner: 60, worker: 35, artisan: 45, miner: 35, capitalist: 55, cleric: 50, soldier: 75, unemployed: 20 },
            activeDecrees: ['warrior_caste', 'war_economy', 'standing_army', 'press_gang', 'feudal_levy'],
            nationRelations: { 'steppe_horde': 15, 'mongol_horde': 10, 'viking_raiders': 20, 'sparta_militaris': 65 },
            army: { heavy_infantry: 120, crossbowman: 80, knight: 60, pikeman: 80, arquebus: 50, trebuchet: 30, bombard: 20, cuirassier: 10 },
            marketPrices: { iron: 6, tools: 22, food: 1.4 },
        },
    },
    {
        id: 'trade_port',
        name: '商贸港湾',
        icon: '⚓',
        description: '碧波万顷，帆影点点。这座滨海商埠汇聚四方货物，商贾往来不绝。商人们编织着跨越海洋的贸易网络。',
        tags: ['商业强', '贸易起步', '时代5'],
        highlights: ['港口市场繁荣', '商人航海家云集', '银币香料充裕'],
        overrides: {
            resources: { 
                silver: 5000000, spice: 200000, coffee: 120000, papyrus: 150000, food: 1500000, 
                wood: 400000, cloth: 300000, plank: 250000, brick: 200000,
                fine_clothes: 80000, furniture: 60000, delicacies: 50000, tools: 150000, iron: 100000,
            },
            buildings: { 
                market: 40, trade_port: 30, dockyard: 20, coffee_house: 15, library: 15,
                navigator_school: 10, trading_post: 40, farm: 50, loom_house: 25, tailor_workshop: 15,
                textile_mill: 5, house: 80, town_hall: 5, printing_house: 5,
                barracks: 8, training_ground: 6, fortress: 4,
            },
            population: 1200,
            popStructure: {
                merchant: 245, navigator: 60, scribe: 95, worker: 120, peasant: 100, artisan: 50,
                official: 35, capitalist: 10, soldier: 280, unemployed: 205,
            },
            maxPop: 1500, epoch: 5,
            techsUnlocked: EPOCH_5_TECHS,
            rulingCoalition: ['merchant', 'navigator'],
            legitimacy: 55, stability: 70,
            classWealth: { merchant: 15000, navigator: 4000, scribe: 2500, worker: 800, peasant: 600, artisan: 3000, official: 5000, capitalist: 40000, soldier: 1000, unemployed: 150 },
            classApproval: { merchant: 80, navigator: 75, scribe: 65, worker: 55, peasant: 50, artisan: 60, official: 60, soldier: 65, capitalist: 80, unemployed: 40 },
            activeDecrees: ['navigation_act', 'joint_stock', 'bullionism', 'hanseatic_law', 'printing_privilege'],
            nationRelations: { 'merchant_republic': 85, 'desert_caravan': 80, 'island_thalassocracy': 75, 'sunset_armada': 70, 'dutch_voc': 80, 'british_empire': 65 },
            army: { pikeman: 80, arquebus: 70, cuirassier: 40, musketeer: 60, rifleman: 20, cannon: 10 },
            marketPrices: { spice: 12, coffee: 15 },
        },
    },
    {
        id: 'rich_treasury',
        name: '富庶金库',
        icon: '💰',
        description: '金银满仓，财源广进。贵族积累雄厚财富，商人控制繁忙贸易网络，资本家筹划更大投资。金钱是这里最有力的武器。',
        tags: ['有钱', '财政优势', '时代5'],
        highlights: ['银币极其充裕', '上层阶级极富', '奢侈品遍地'],
        overrides: {
            resources: { 
                silver: 20000000, food: 2000000, wood: 600000, stone: 500000, 
                cloth: 350000, plank: 300000, brick: 250000,
                furniture: 200000, fine_clothes: 200000, delicacies: 150000,
                spice: 150000, coffee: 100000, tools: 250000, iron: 200000, papyrus: 120000, culture: 350000,
            },
            buildings: { 
                market: 50, trading_post: 60, trade_port: 30, coffee_house: 20,
                furniture_workshop: 25, tailor_workshop: 20, culinary_kitchen: 15,
                farm: 50, large_estate: 30, library: 15, town_hall: 8,
                house: 100, amphitheater: 12, church: 10, barracks: 8, training_ground: 6, fortress: 4,
            },
            population: 1300,
            popStructure: {
                merchant: 270, scribe: 85, artisan: 145, peasant: 115, serf: 180, landowner: 30,
                official: 40, cleric: 54, soldier: 240, unemployed: 141,
            },
            maxPop: 1650, epoch: 5,
            techsUnlocked: EPOCH_5_TECHS,
            rulingCoalition: ['merchant', 'landowner'],
            legitimacy: 50, stability: 60,
            classWealth: { merchant: 40000, scribe: 4000, artisan: 5000, peasant: 600, serf: 200, landowner: 60000, official: 10000, cleric: 6000, soldier: 1200, unemployed: 120 },
            classApproval: { merchant: 85, scribe: 60, artisan: 65, peasant: 40, serf: 30, landowner: 90, official: 70, cleric: 65, soldier: 60, unemployed: 25 },
            activeDecrees: ['bullionism', 'joint_stock', 'laissez_faire', 'encomienda', 'hanseatic_law', 'navigation_act'],
            nationRelations: { 'merchant_republic': 80, 'dutch_voc': 75, 'british_empire': 70, 'ming_celestial': 65, 'desert_caravan': 70 },
            army: { pikeman: 60, arquebus: 80, cuirassier: 40, musketeer: 50, cannon: 10 },
            marketPrices: { fine_clothes: 18, furniture: 16, delicacies: 12, spice: 15 },
        },
    },
];

export const getScenarioOptions = () => SCENARIOS;

export const getScenarioById = (scenarioId) => {
    if (!scenarioId) return null;
    return SCENARIOS.find(scenario => scenario.id === scenarioId) || null;
};
