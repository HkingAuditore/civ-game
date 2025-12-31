// 建筑配置文件
// 定义游戏中的所有建筑及其属性

/**
 * 建筑配置数组
 * 每个建筑包含：
 * - id: 建筑唯一标识
 * - name: 建筑名称
 * - desc: 建筑描述
 * - baseCost: 基础建造成本
 * - output: 产出资源（每秒）
 * - input: 消耗资源（每秒）
 * - jobs: 提供的工作岗位
 * - epoch: 解锁时代
 * - cat: 建筑类别（gather/industry/civic/military）
 * - visual: 视觉效果配置
 */
export const BUILDINGS = [
    // ========== 采集与农业建筑 ==========
    {
        id: 'farm',
        name: "农田",
        desc: "提供自耕农岗位。",
        baseCost: { wood: 12 },
        output: { food: 3.2 },
        jobs: { peasant: 2 },
        owner: 'peasant',
        epoch: 0,
        cat: 'gather',
        visual: { icon: 'Wheat', color: 'bg-yellow-700', text: 'text-yellow-200' },
        // 农田的差异化经济配置：农民工资和价格受生活成本、税收影响较小（基础生产，相对稳定）
        marketConfig: {
            price: {
                livingCostWeight: 0.08,    // 价格受生活成本影响很小（粮食是最基础的必需品）
                taxCostWeight: 0.15,       // 价格受税收影响较小
            },
            wage: {
                livingCostWeight: 0.08,    // 工资受生活成本影响较小（农民工资相对固定）
                taxCostWeight: 0.05,       // 工资受税收影响较小
            },
        }
    },

    {
        id: 'trading_post',
        name: "贸易站",
        desc: "原始的物资交换场所，提供商人岗位。",
        baseCost: { wood: 50, stone: 10 },
        output: { food: 2, silver: 0.8 },
        jobs: { merchant: 1 },
        owner: 'merchant',
        epoch: 0,
        cat: 'civic',
        requiresTech: 'barter',
        visual: { icon: 'Handshake', color: 'bg-amber-800', text: 'text-amber-200' }
    },

    {
        id: 'large_estate',
        name: "庄园",
        desc: "地主控制的土地，雇佣佃农。",
        baseCost: { wood: 100, plank: 25 },
        output: { food: 18.00 },
        jobs: { serf: 6, landowner: 1 },
        owner: 'landowner',
        epoch: 3,
        cat: 'gather',
        requiresTech: 'feudalism',
        visual: { icon: 'Castle', color: 'bg-amber-800', text: 'text-amber-200' },
        // Feudal estate economic config: serfs receive subsistence wages based on living costs
        marketConfig: {
            price: { livingCostWeight: 0.1, taxCostWeight: 0.15 },
            wage: {
                livingCostWeight: 0.05,
                taxCostWeight: 0.05,
                // Feudal wage system: wages are capped at 1.5x living costs (subsistence level)
                // This replaces market-based wages with cost-of-living based wages
                wageMode: 'subsistence',      // Use living-cost based wage calculation
                subsistenceMultiplier: 1.5,   // Wage = living costs × 1.5 (bare subsistence + small buffer)
            },
        }
    },

    {
        id: 'lumber_camp',
        name: "伐木场",
        desc: "砍伐木材，基础采集建筑。",
        baseCost: { food: 18 },
        input: {},
        output: { wood: 2.56 },
        jobs: { lumberjack: 2 },
        owner: 'lumberjack',
        epoch: 0,
        cat: 'gather',
        visual: { icon: 'Trees', color: 'bg-emerald-800', text: 'text-emerald-200' },
        // Tier 1 基础采集建筑：极高稳定度配置
        marketConfig: {
            price: { livingCostWeight: 0.1, taxCostWeight: 0.15 },
            wage: { livingCostWeight: 0.05, taxCostWeight: 0.05 }
        }
    },

    {
        id: 'quarry',
        name: "采石场",
        desc: "开采石料，基础采集建筑。",
        baseCost: { wood: 55 },
        input: {},
        output: { stone: 2.00 },
        jobs: { miner: 2 },
        owner: 'miner',
        epoch: 0,
        cat: 'gather',
        visual: { icon: 'Pickaxe', color: 'bg-stone-600', text: 'text-stone-200' },
        // Tier 1 基础采集建筑：极高稳定度配置
        marketConfig: {
            price: { livingCostWeight: 0.1, taxCostWeight: 0.15 },
            wage: { livingCostWeight: 0.05, taxCostWeight: 0.05 }
        }
    },

    {
        id: 'copper_mine',
        name: "铜矿井",
        desc: "开采铜矿石，需要少量工具维护。",
        baseCost: { food: 120, wood: 120 },
        input: { tools: 0.02 },
        output: { copper: 0.50 },
        jobs: { miner: 3 },
        owner: 'miner',
        epoch: 1,
        cat: 'gather',
        requiresTech: 'copper_mining',
        visual: { icon: 'Gem', color: 'bg-orange-700', text: 'text-orange-200' },
        // Tier 2 工业加工建筑：标准平衡配置
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },

    {
        id: 'reed_works',
        name: "造纸工坊",
        desc: "生产纸张的手工作坊。",
        baseCost: { food: 140, wood: 80 },
        input: { wood: 0.5 },
        output: { papyrus: 0.60 },
        jobs: { worker: 2 },
        owner: 'worker',
        epoch: 2,
        cat: 'industry',
        requiresTech: 'papyrus_cultivation',
        visual: { icon: 'ScrollText', color: 'bg-lime-800', text: 'text-lime-200' },
        // Tier 1 基础生产建筑：高稳定度配置，防止纸张价格波动
        marketConfig: {
            price: { livingCostWeight: 0.1, taxCostWeight: 0.15 },
            wage: { livingCostWeight: 0.05, taxCostWeight: 0.05 }
        }
    },

    {
        id: 'culinary_kitchen',
        name: "烹饪坊",
        desc: "将粮食烹饪为珍馐，供上层阶级享用。",
        baseCost: { wood: 100, stone: 60, brick: 30 },
        input: { tools: 0.1, food: 1.50 },
        output: { delicacies: 1.50 },
        jobs: { artisan: 2, peasant: 1 },
        owner: 'artisan',
        epoch: 2,
        cat: 'industry',
        requiresTech: 'culinary_arts',
        visual: { icon: 'UtensilsCrossed', color: 'bg-rose-800', text: 'text-rose-200' }
    },

    {
        id: 'brewery',
        name: "酿造坊",
        desc: "将粮食发酵酿造成美酒，供贸易与享用。",
        baseCost: { wood: 90, stone: 50, brick: 25 },
        input: { food: 1.20, wood: 0.20 },
        output: { ale: 1.20 },
        jobs: { worker: 2 },
        owner: 'worker',
        epoch: 2,
        cat: 'industry',
        requiresTech: 'brewing',
        visual: { icon: 'Wine', color: 'bg-purple-800', text: 'text-purple-200' },
        // Tier 3 奢侈品建筑：高波动性、高敏感度配置
        marketConfig: {
            price: { livingCostWeight: 0.4, taxCostWeight: 0.5 },
            wage: { livingCostWeight: 0.25, taxCostWeight: 0.25 }
        }
    },

    {
        id: 'furniture_workshop',
        name: "家具工坊",
        desc: "将木板与布料雕刻成精美家具，提升上层阶级的生活品质。",
        baseCost: { plank: 120, stone: 80 },
        input: { tools: 0.1, plank: 1.0, cloth: 0.30 },
        output: { furniture: 1.20 },
        jobs: { artisan: 3 },
        owner: 'artisan',
        epoch: 2,
        cat: 'industry',
        requiresTech: 'carpentry',
        visual: { icon: 'Armchair', color: 'bg-amber-800', text: 'text-amber-200' },
        // 家具工坊的差异化经济配置：奢侈品工艺，工资和价格受生活成本、税收影响更大
        marketConfig: {
            price: {
                livingCostWeight: 0.3,     // 价格受生活成本影响更大（奢侈品价格弹性高）
                taxCostWeight: 0.4,        // 价格受税收影响更大
            },
            wage: {
                livingCostWeight: 0.15,    // 工资受生活成本影响更大（工匠技能要求高）
                taxCostWeight: 0.15,       // 工资受税收影响更大
            },
        }
    },
    {
        id: 'loom_house',
        name: "织布坊",
        desc: "家庭式纺纱织布，保障民众衣物供应。",
        baseCost: { wood: 35, food: 20 },
        output: { cloth: 1.92 },
        jobs: { worker: 2 },
        owner: 'worker',
        epoch: 0,
        cat: 'industry',
        visual: { icon: 'Shirt', color: 'bg-indigo-800', text: 'text-indigo-200' },
        // 织布坊的差异化经济配置：布料作为基础必需品，价格应该相对稳定
        marketConfig: {
            price: {
                livingCostWeight: 0.12,    // 价格受生活成本影响较小（基础必需品）
                taxCostWeight: 0.15,       // 价格受税收影响较小
            },
            wage: {
                livingCostWeight: 0.08,    // 工资受生活成本影响较小（工人工资相对固定）
                taxCostWeight: 0.08,       // 工资受税收影响较小
            },
        }
    },

    {
        id: 'dye_works',
        name: "染坊",
        desc: "从植物中提取染料，用于制作高级织物。",
        baseCost: { wood: 60, stone: 20 },
        input: { food: 0.5 },
        output: { dye: 0.6 },
        jobs: { worker: 2 },
        owner: 'worker',
        epoch: 1,
        cat: 'industry',
        visual: { icon: 'Paintbrush', color: 'bg-pink-800', text: 'text-pink-200' }
    },

    {
        id: 'tailor_workshop',
        name: "成衣作坊",
        desc: "使用布料和染料制作精美的华服，供上层阶级享用。",
        baseCost: { wood: 100, stone: 40 },
        input: { tools: 0.04, cloth: 1.0, dye: 0.2 },
        output: { fine_clothes: 0.8, culture: 0.1 },
        jobs: { artisan: 2 },
        owner: 'artisan',
        epoch: 1,
        cat: 'industry',
        requiresTech: 'tools',
        visual: { icon: 'Package', color: 'bg-indigo-900', text: 'text-indigo-100' }
    },

    {
        id: 'mine',
        name: "铁矿井",
        desc: "深入岩层采集铁矿，需要工具维护。",
        baseCost: { plank: 120, food: 220 },
        input: { tools: 0.04 },
        output: { iron: 0.50 },
        jobs: { miner: 5, capitalist: 1 },
        owner: 'capitalist',
        epoch: 2,
        cat: 'gather',
        requiresTech: 'ironworking',
        visual: { icon: 'Mountain', color: 'bg-zinc-700', text: 'text-zinc-200' },
        // Tier 2 工业加工建筑：标准平衡配置
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },

    {
        id: 'coffee_plantation',
        name: "咖啡种植园",
        desc: "开垦远方殖民地的咖啡种植地。",
        baseCost: { wood: 200, spice: 30 },
        output: { coffee: 0.40 },
        jobs: { serf: 4, merchant: 1 },
        owner: 'merchant',
        epoch: 5,
        cat: 'gather',
        requiresTech: 'coffee_agronomy',
        visual: { icon: 'Coffee', color: 'bg-amber-900', text: 'text-amber-200' },
        // Colonial plantation economic config: serfs receive subsistence wages
        marketConfig: {
            price: { livingCostWeight: 0.15, taxCostWeight: 0.20 },
            wage: {
                livingCostWeight: 0.05,
                taxCostWeight: 0.05,
                wageMode: 'subsistence',      // Use living-cost based wage calculation
                subsistenceMultiplier: 1.3,   // Colonial exploitation: even lower wages (1.3x living costs)
            },
        }
    },    {
        id: 'coal_mine',
        name: "煤矿",
        desc: "开采地下煤炭，工业能源基石。",
        baseCost: { plank: 200, tools: 60 },
        input: { tools: 0.1 },
        output: { coal: 0.65 },
        jobs: { miner: 6, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'gather',
        requiresTech: 'coal_gasification',
        visual: { icon: 'Flame', color: 'bg-slate-700', text: 'text-slate-100' },
        // Tier 2 工业能源建筑：标准平衡配置，移除tools消耗防止死锁
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },

    // ========== 居住建筑 ==========
    {
        id: 'hut',
        name: "简陋小屋",
        desc: "增加人口上限。",
        baseCost: { wood: 20, food: 20 },
        output: { maxPop: 4 },
        epoch: 0,
        cat: 'civic',
        visual: { icon: 'Tent', color: 'bg-orange-800', text: 'text-orange-200' }
    },

    {
        id: 'house',
        name: "木屋",
        desc: "以木板与砖块搭建的整洁居所。",
        baseCost: { plank: 60, brick: 40 },
        output: { maxPop: 11 },
        epoch: 2,
        cat: 'civic',
        requiresTech: 'urban_planning',
        visual: { icon: 'Home', color: 'bg-amber-700', text: 'text-amber-100' }
    },

    {
        id: 'manor_house',
        name: "石砌宅邸",
        desc: "贵族风格的石砌住宅，坚固耐久，彰显领主权威。",
        baseCost: { brick: 120, plank: 80, iron: 15 },
        output: { maxPop: 13 },
        epoch: 3,
        cat: 'civic',
        requiresTech: 'manor_architecture',
        visual: { icon: 'Castle', color: 'bg-blue-800', text: 'text-blue-200' }
    },

    {
        id: 'townhouse',
        name: "联排住宅",
        desc: "港口城市流行的多层联排建筑，高效利用城市空间。",
        baseCost: { brick: 180, plank: 120, tools: 25 },
        output: { maxPop: 14 },
        epoch: 4,
        cat: 'civic',
        requiresTech: 'colonial_architecture',
        visual: { icon: 'Building', color: 'bg-cyan-800', text: 'text-cyan-200' }
    },

    {
        id: 'civic_apartment',
        name: "阁楼公馆",
        desc: "启蒙时代流行的多层砖石建筑，优雅的阁楼设计为新兴中产阶级提供舒适居所。",
        baseCost: { brick: 250, plank: 150, iron: 40, furniture: 20 },
        output: { maxPop: 15 },
        epoch: 5,
        cat: 'civic',
        requiresTech: 'enlightened_urbanism',
        visual: { icon: 'Building2', color: 'bg-purple-800', text: 'text-purple-200' }
    },

    {
        id: 'granary',
        name: "粮仓",
        desc: "加固的干燥粮仓，提升人口承载。",
        baseCost: { wood: 120, brick: 40 },
        output: { maxPop: 8 },
        epoch: 1,
        cat: 'civic',
        requiresTech: 'granary_architecture',
        visual: { icon: 'Boxes', color: 'bg-yellow-900', text: 'text-yellow-200' }
    },

    {
        id: 'town_hall',
        name: "市政厅",
        desc: "官员办公地，提供官员岗位，需要少量维护。",
        baseCost: { brick: 200, plank: 200 },
        input: { brick: 0.20, papyrus: 0.02, delicacies: 0.10, fine_clothes: 0.05 },
        output: {},
        jobs: { official: 5 },
        epoch: 3,
        cat: 'civic',
        requiresTech: 'bureaucracy',
        visual: { icon: 'Scale', color: 'bg-slate-800', text: 'text-slate-200' }
    },

    {
        id: 'church',
        name: "教堂",
        desc: "安抚民心，产出文化。",
        baseCost: { stone: 150, plank: 50 },
        input: { furniture: 0.10, fine_clothes: 0.10 },
        output: { culture: 0.80, silver: 0.50 },
        jobs: { cleric: 3 },
        owner: 'cleric',
        epoch: 3,
        cat: 'civic',
        requiresTech: 'theology',
        visual: { icon: 'Cross', color: 'bg-purple-900', text: 'text-purple-200' }
    },


    // ========== 封建时代新建筑 ==========
    {
        id: 'monastery_cellar',
        name: "修道院酒窖",
        desc: "修道士传承的酿酒技艺，出产上等美酒，彰显宗教文化。",
        baseCost: { stone: 120, brick: 60, tools: 15 },
        input: { food: 1.8, wood: 0.3 },
        output: { ale: 2.0, culture: 0.25 },
        jobs: { cleric: 1, worker: 2 },
        owner: 'cleric',
        epoch: 3,
        cat: 'industry',
        requiresTech: 'monastic_brewing',
        visual: { icon: 'Wine', color: 'bg-purple-800', text: 'text-purple-200' }
    },

    {
        id: 'wool_workshop',
        name: "纺织工场",
        desc: "规模化的羊毛加工作坊，封建领地的重要经济支柱。",
        baseCost: { plank: 100, brick: 50, tools: 15 },
        input: { food: 0.6, tools: 0.03 },
        output: { cloth: 3.2, fine_clothes: 0.2 },
        jobs: { serf: 3, worker: 2 },
        owner: 'worker',
        epoch: 3,
        cat: 'industry',
        requiresTech: 'wool_trade',
        visual: { icon: 'Shirt', color: 'bg-indigo-700', text: 'text-indigo-200' },
        // Wool workshop economic config: serfs receive subsistence wages
        marketConfig: {
            price: {
                livingCostWeight: 0.12,
                taxCostWeight: 0.15,
            },
            wage: {
                livingCostWeight: 0.08,
                taxCostWeight: 0.08,
                wageMode: 'subsistence',      // Use living-cost based wage calculation
                subsistenceMultiplier: 1.8,   // Workshop labor: slightly better (1.8x living costs)
            },
        }
    },


    {
        id: 'stone_workshop',
        name: "采石工场",
        desc: "使用铁器工具的专业采石场，为城堡和教堂建设提供大量优质石料。",
        baseCost: { plank: 80, iron: 30, tools: 20 },
        input: { tools: 0.06 },
        output: { stone: 3.5 },
        jobs: { miner: 3, worker: 1 },
        owner: 'miner',
        epoch: 3,
        cat: 'gather',
        requiresTech: 'masonry_guild',
        visual: { icon: 'Pickaxe', color: 'bg-stone-700', text: 'text-stone-200' }
    },

    {
        id: 'hardwood_camp',
        name: "硬木林场",
        desc: "有计划的森林采伐，提供大量木材与优质硬木。",
        baseCost: { plank: 100, iron: 25, tools: 25 },
        input: { tools: 0.08 },
        output: { wood: 4.8 },
        jobs: { lumberjack: 4, worker: 1 },
        owner: 'lumberjack',
        epoch: 3,
        cat: 'gather',
        requiresTech: 'forestry_management',
        visual: { icon: 'Trees', color: 'bg-emerald-900', text: 'text-emerald-200' },
        marketConfig: {
            price: { livingCostWeight: 0.15, taxCostWeight: 0.20 },
            wage: { livingCostWeight: 0.08, taxCostWeight: 0.08 }
        }
    },

    {
        id: 'amphitheater',
        name: "剧场",
        desc: "古典时代的文化舞台，激发灵感。",
        baseCost: { stone: 200, brick: 80 },
        input: { fine_clothes: 0.15 },
        output: { culture: 1.20 },
        jobs: { cleric: 2 },
        owner: 'cleric',
        epoch: 1,
        cat: 'civic',
        requiresTech: 'amphitheater_design',
        visual: { icon: 'Music2', color: 'bg-rose-900', text: 'text-rose-200' }
    },

    {
        id: 'navigator_school',
        name: "航海学院",
        desc: "培养探索时代的开路者，产出科研文化。",
        baseCost: { wood: 160, papyrus: 80 },
        output: { science: 0.60, culture: 0.20 },
        jobs: { navigator: 2, scribe: 1, official: 1 },
        owner: 'official',
        epoch: 4,
        cat: 'civic',
        requiresTech: 'navigator_schooling',
        visual: { icon: 'Navigation', color: 'bg-cyan-900', text: 'text-cyan-200' }
    },

    {
        id: 'shaft_mine',
        name: "竖井矿场",
        desc: "利用绞盘与更好的通风设施深入地下，同时开采铜铁矿脉。",
        baseCost: { brick: 150, plank: 100, tools: 50 },
        input: { tools: 0.12, wood: 0.25 },
        output: { iron: 1.2, copper: 0.8 },
        jobs: { miner: 5, engineer: 1 },
        owner: 'miner',
        epoch: 4,
        cat: 'gather',
        requiresTech: 'advanced_metallurgy',
        visual: { icon: 'Mountain', color: 'bg-zinc-600', text: 'text-zinc-200' },
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },

    // ========== 探索时代新建筑 ==========
    {
        id: 'dye_workshop',
        name: "印染工坊",
        desc: "使用新世界染料的专业印染作坊，如珍贵的胭脂虫红。",
        baseCost: { brick: 100, plank: 80, tools: 20 },
        input: { food: 0.8, cloth: 0.4, spice: 0.05 },
        output: { dye: 1.2, fine_clothes: 0.3 },
        jobs: { artisan: 2, worker: 2 },
        owner: 'artisan',
        epoch: 4,
        cat: 'industry',
        requiresTech: 'new_world_dyes',
        visual: { icon: 'Paintbrush', color: 'bg-rose-800', text: 'text-rose-200' }
    },

    {
        id: 'coffee_house',
        name: "咖啡馆",
        desc: "啜饮咖啡、交流思想的启蒙沙龙。",
        baseCost: { plank: 140, coffee: 40 },
        input: { coffee: 0.40, delicacies: 0.20 },
        output: { culture: 1.0, science: 1.0 },
        jobs: { merchant: 1, scribe: 2 },
        owner: 'merchant',
        epoch: 5,
        cat: 'civic',
        requiresTech: 'coffeehouse_philosophy',
        visual: { icon: 'Coffee', color: 'bg-brown-900', text: 'text-amber-200' }
    },

    {
        id: 'rail_depot',
        name: "铁路枢纽",
        desc: "蒸汽时代的交通心脏，连接全国贸易，提供岗位和人口上限。",
        baseCost: { steel: 180, coal: 120 },
        input: { coal: 0.40, ale: 0.20, delicacies: 0.10 },
        output: { silver: 1.50, maxPop: 14 },
        jobs: { engineer: 2, merchant: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'civic',
        requiresTech: 'rail_network',
        visual: { icon: 'Train', color: 'bg-gray-900', text: 'text-gray-100' }
    },

    // ========== 工业产业链建筑 ==========
    {
        id: 'sawmill',
        name: "锯木厂",
        desc: "在铜制工具辅助下高效加工木板。",
        baseCost: { wood: 75, stone: 35 },
        input: { wood: 1.20 },
        output: { plank: 2.60 },
        jobs: { worker: 3 },
        owner: 'worker',
        epoch: 1,
        requiresTech: 'tools',
        cat: 'industry',
        visual: { icon: 'Hammer', color: 'bg-amber-900', text: 'text-amber-300' },
        // Tier 2 工业加工建筑：标准平衡配置
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },

    {
        id: 'brickworks',
        name: "砖窯",
        desc: "烧制砖块，供城墙与民宅所用。",
        baseCost: { wood: 140, stone: 90 },
        input: { stone: 1.0, wood: 0.30 },
        output: { brick: 2.40 },
        jobs: { worker: 2 },
        owner: 'worker',
        epoch: 0,
        cat: 'industry',
        requiresTech: 'pottery',
        visual: { icon: 'Factory', color: 'bg-red-900', text: 'text-red-300' }
    },
    {
        id: 'stone_tool_workshop',
        name: "石器作坊",
        desc: "用燧石和木料打制粗糙的工具。",
        baseCost: { wood: 40, stone: 25 },
        input: { wood: 1.0, stone: 0.8 },
        output: { tools: 0.5 },
        jobs: { artisan: 2 },
        owner: 'artisan',
        epoch: 0,
        cat: 'industry',
        requiresTech: 'tool_making',
        visual: { icon: 'Hammer', color: 'bg-stone-700', text: 'text-stone-200' },
        // Tier 2 工业加工建筑：标准平衡配置
        marketConfig: {
            price: { livingCostWeight: 0.2, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.1, taxCostWeight: 0.1 }
        }
    },
    {
        id: 'bronze_foundry',
        name: "青铜铸坊",
        desc: "熔炼铜与木炭，制造精良工具。",
        baseCost: { wood: 140, stone: 75, copper: 35 },
        input: { copper: 0.60, wood: 0.40 },
        output: { tools: 1.0 },
        jobs: { worker: 2, artisan: 1 },
        owner: 'artisan',
        epoch: 1,
        cat: 'industry',
        requiresTech: 'bronze_working',
        visual: { icon: 'Anvil', color: 'bg-orange-800', text: 'text-amber-200' },
        // Tier 3 奢侈品/高科技建筑：高波动性配置
        marketConfig: {
            price: { livingCostWeight: 0.3, taxCostWeight: 0.35 },
            wage: { livingCostWeight: 0.2, taxCostWeight: 0.2 }
        }
    },
    {
        id: 'iron_tool_workshop',
        name: "铁器铺",
        desc: "以铁为原料，锻造坚固耐用的工具。",
        baseCost: { plank: 150, brick: 80 },
        input: { wood: 0.5, iron: 0.8 },
        output: { tools: 1.5 },
        jobs: { worker: 2, artisan: 1 },
        owner: 'artisan',
        epoch: 2,
        cat: 'industry',
        requiresTech: 'ironworking',
        visual: { icon: 'Cog', color: 'bg-zinc-800', text: 'text-zinc-200' },
        // Tier 3 高科技建筑：高敏感度配置
        marketConfig: {
            price: { livingCostWeight: 0.3, taxCostWeight: 0.35 },
            wage: { livingCostWeight: 0.2, taxCostWeight: 0.2 }
        }
    },

    {
        id: 'factory',
        name: "工厂",
        desc: "蒸汽驱动的流水线生产工具与机械。",
        baseCost: { brick: 400, steel: 200 },
        input: { steel: 0.20, coal: 0.20 },
        output: { tools: 1.20 },
        jobs: { worker: 10, engineer: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        requiresTech: 'industrialization',
        cat: 'industry',
        visual: { icon: 'Factory', color: 'bg-blue-900', text: 'text-blue-200' }
    },

    {
        id: 'printing_house',
        name: "印刷所",
        desc: "启蒙时代的出版重镇，大量复制知识。",
        baseCost: { brick: 200, papyrus: 80 },
        input: { papyrus: 0.40, coffee: 0.10 },
        output: { science: 1.20 },
        jobs: { artisan: 2, scribe: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'printing_press',
        visual: { icon: 'BookOpen', color: 'bg-indigo-900', text: 'text-indigo-200' }
    },

    {
        id: 'steel_foundry',
        name: "炼钢厂",
        desc: "以煤炭为燃料的炼钢炉，供应工业时代钢材。",
        baseCost: { brick: 300, iron: 200 },
        input: { iron: 0.40, coal: 0.40 },
        output: { steel: 0.40 },
        jobs: { engineer: 3, worker: 4, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'steel_alloys',
        visual: { icon: 'Cog', color: 'bg-gray-900', text: 'text-gray-200' }
    },

    // ========== 科研与市场建筑 ==========
    {
        id: 'library',
        name: "图书馆",
        desc: "编目典籍，持续产出科研。",
        baseCost: { wood: 200, stone: 60 },
        output: { science: 0.80 },
        jobs: { scribe: 3 },
        owner: 'scribe',
        epoch: 0,
        cat: 'civic',
        visual: { icon: 'Landmark', color: 'bg-cyan-800', text: 'text-cyan-200' }
    },

    {
        id: 'market',
        name: "市场",
        desc: "自动平衡市场供需：将盈余的滞销资源出口，换取急需的短缺资源。产出少量商业税收。",
        baseCost: { plank: 100 },
        input: { brick: 0.05 },
        output: { food: 2.0 },
        jobs: { merchant: 2 },
        owner: 'merchant',
        epoch: 1,
        requiresTech: 'caravan_trade',
        cat: 'civic',
        visual: { icon: 'Handshake', color: 'bg-yellow-800', text: 'text-yellow-200' }
    },

    {
        id: 'magistrate_office',
        name: "官署",
        desc: "早期行政机构，管理青铜时代的税收与民政。提供少量官员岗位。",
        baseCost: { plank: 80, stone: 60 },
        input: { papyrus: 0.01 },
        output: {},
        jobs: { official: 2, scribe: 1 },
        epoch: 1,
        cat: 'civic',
        requiresTech: 'early_administration',
        visual: { icon: 'Scroll', color: 'bg-slate-700', text: 'text-slate-200' }
    },

    {
        id: 'dockyard',
        name: "船坞",
        desc: "建造远洋船队，换取异域香料。",
        baseCost: { plank: 200, tools: 40 },
        input: { wood: 0.50 },
        output: { spice: 0.7 },
        jobs: { navigator: 2, worker: 2, merchant: 1 },
        owner: 'merchant',
        epoch: 4,
        cat: 'industry',
        requiresTech: 'cartography',
        visual: { icon: 'Anchor', color: 'bg-sky-900', text: 'text-sky-200' }
    },

    {
        id: 'trade_port',
        name: "贸易港",
        desc: "汇聚香料、银币与海外特许的繁忙港口。",
        baseCost: { plank: 220, spice: 60 },
        input: { spice: 0.30 },
        output: { food: 2.0 },
        jobs: { merchant: 3 },
        owner: 'merchant',
        epoch: 4,
        cat: 'civic',
        requiresTech: 'charter_companies',
        visual: { icon: 'Ship', color: 'bg-indigo-900', text: 'text-indigo-200' }
    },

    // ========== 军事建筑 ==========
    {
        id: 'barracks',
        name: "兵营",
        desc: "训练和驻扎军队的基地，提供军事容量。",
        baseCost: { wood: 80, stone: 40 },
        output: { militaryCapacity: 10 },
        epoch: 0,
        cat: 'military',
        visual: { icon: 'Shield', color: 'bg-red-900', text: 'text-red-200' }
    },

    {
        id: 'training_ground',
        name: "训练场",
        desc: "专业的军事训练设施，大幅提升军事容量。",
        baseCost: { plank: 150, brick: 80, iron: 30 },
        output: { militaryCapacity: 20 },
        epoch: 2,
        cat: 'military',
        requiresTech: 'military_training',
        visual: { icon: 'Swords', color: 'bg-red-800', text: 'text-red-100' }
    },

    {
        id: 'fortress',
        name: "要塞",
        desc: "坚固的军事堡垒，可容纳大量军队。",
        baseCost: { brick: 300, iron: 150, steel: 50 },
        output: { militaryCapacity: 40 },
        epoch: 4,
        cat: 'military',
        requiresTech: 'fortification',
        visual: { icon: 'Castle', color: 'bg-red-950', text: 'text-red-100' }
    },

    // ========== 高级工业建筑（后期生产形式） ==========

    // 纺织产业升级线
    {
        id: 'textile_mill',
        name: "纺织厂",
        desc: "水力驱动的纺织机，大幅提升布料和成衣产量。",
        baseCost: { brick: 180, plank: 120, tools: 60 },
        input: { food: 0.80, dye: 0.30 },
        output: { cloth: 5.00, fine_clothes: 0.60 },
        jobs: { worker: 6, artisan: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'mechanized_weaving',
        visual: { icon: 'Shirt', color: 'bg-indigo-700', text: 'text-indigo-100' },
        marketConfig: {
            price: { livingCostWeight: 0.25, taxCostWeight: 0.30 },
            wage: { livingCostWeight: 0.15, taxCostWeight: 0.15 }
        }
    },

    {
        id: 'garment_factory',
        name: "服装工厂",
        desc: "蒸汽动力缝纫机的大规模成衣生产线。",
        baseCost: { brick: 350, steel: 150, tools: 100 },
        input: { cloth: 2.50, dye: 0.50, coal: 0.30 },
        output: { fine_clothes: 2.80, culture: 0.30 },
        jobs: { worker: 12, artisan: 3, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'assembly_line',
        visual: { icon: 'Factory', color: 'bg-indigo-900', text: 'text-indigo-100' },
        marketConfig: {
            price: { livingCostWeight: 0.30, taxCostWeight: 0.35 },
            wage: { livingCostWeight: 0.20, taxCostWeight: 0.20 }
        }
    },

    // 木材加工产业升级线
    {
        id: 'lumber_mill',
        name: "木材加工厂",
        desc: "水力锯木机与烘干设备，高效生产优质木板。",
        baseCost: { brick: 160, plank: 100, tools: 50 },
        input: { wood: 3.00 },
        output: { plank: 8.00 },
        jobs: { worker: 5, artisan: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'hydraulic_sawing',
        visual: { icon: 'Axe', color: 'bg-amber-700', text: 'text-amber-100' },
        marketConfig: {
            price: { livingCostWeight: 0.20, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.12, taxCostWeight: 0.12 }
        }
    },

    {
        id: 'furniture_factory',
        name: "家具工厂",
        desc: "流水线生产标准化家具，满足城市中产阶级需求。",
        baseCost: { brick: 280, steel: 120, tools: 80 },
        input: { plank: 2.50, cloth: 0.80, coal: 0.25 },
        output: { furniture: 3.50, culture: 0.20 },
        jobs: { worker: 8, artisan: 2, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'mass_production',
        visual: { icon: 'Armchair', color: 'bg-amber-900', text: 'text-amber-100' },
        marketConfig: {
            price: { livingCostWeight: 0.28, taxCostWeight: 0.32 },
            wage: { livingCostWeight: 0.18, taxCostWeight: 0.18 }
        }
    },

    // 冶金产业升级线
    {
        id: 'metallurgy_workshop',
        name: "冶金工坊",
        desc: "改良的熔炉与锻造技术，高效生产精良工具。",
        baseCost: { brick: 200, iron: 100, tools: 60 },
        input: { iron: 1.50, copper: 0.30, wood: 0.80 },
        output: { tools: 3.00 },
        jobs: { worker: 4, artisan: 2, engineer: 1 },
        owner: 'artisan',
        epoch: 4,
        cat: 'industry',
        requiresTech: 'advanced_metallurgy',
        visual: { icon: 'Anvil', color: 'bg-zinc-700', text: 'text-zinc-100' },
        marketConfig: {
            price: { livingCostWeight: 0.25, taxCostWeight: 0.30 },
            wage: { livingCostWeight: 0.15, taxCostWeight: 0.15 }
        }
    },

    {
        id: 'steel_works',
        name: "钢铁联合体",
        desc: "垂直整合的大型钢铁企业，从矿石到成品一条龙生产。",
        baseCost: { brick: 500, steel: 250, tools: 150 },
        input: { iron: 1.20, coal: 1.00 },
        output: { steel: 1.20, tools: 0.80 },
        jobs: { worker: 15, engineer: 4, capitalist: 2 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'bessemer_process',
        visual: { icon: 'Factory', color: 'bg-gray-800', text: 'text-gray-100' },
        marketConfig: {
            price: { livingCostWeight: 0.30, taxCostWeight: 0.35 },
            wage: { livingCostWeight: 0.20, taxCostWeight: 0.20 }
        }
    },

    // 建材产业升级线
    {
        id: 'building_materials_plant',
        name: "建材厂",
        desc: "规模化生产砖块和预制建材，加速城市建设。",
        baseCost: { brick: 200, plank: 100, tools: 50 },
        input: { stone: 2.00, wood: 0.60, coal: 0.20 },
        output: { brick: 5.50 },
        jobs: { worker: 6, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'industrial_ceramics',
        visual: { icon: 'Building2', color: 'bg-red-800', text: 'text-red-100' },
        marketConfig: {
            price: { livingCostWeight: 0.20, taxCostWeight: 0.25 },
            wage: { livingCostWeight: 0.12, taxCostWeight: 0.12 }
        }
    },

    {
        id: 'prefab_factory',
        name: "预制构件厂",
        desc: "生产标准化建筑构件，革命性地改变建筑行业。",
        baseCost: { brick: 400, steel: 200, tools: 100 },
        input: { brick: 1.50, steel: 0.20, stone: 1.00, coal: 0.40 },
        output: { brick: 11.00 },
        jobs: { worker: 10, engineer: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'standardized_construction',
        visual: { icon: 'Building', color: 'bg-slate-700', text: 'text-slate-100' },
        marketConfig: {
            price: { livingCostWeight: 0.28, taxCostWeight: 0.32 },
            wage: { livingCostWeight: 0.18, taxCostWeight: 0.18 }
        }
    },

    // 食品加工产业升级线
    {
        id: 'cannery',
        name: "罐头厂",
        desc: "革命性的食品保存技术，将珍馐装罐长期保存。",
        baseCost: { brick: 250, steel: 100, tools: 60 },
        input: { food: 2.50, iron: 0.30, coal: 0.25 },
        output: { delicacies: 3.50 },
        jobs: { worker: 8, artisan: 2, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'food_preservation',
        visual: { icon: 'Package', color: 'bg-orange-800', text: 'text-orange-100' },
        marketConfig: {
            price: { livingCostWeight: 0.22, taxCostWeight: 0.28 },
            wage: { livingCostWeight: 0.14, taxCostWeight: 0.14 }
        }
    },

    {
        id: 'distillery',
        name: "蒸馏酒厂",
        desc: "工业化的酿酒设施，生产高度烈酒供出口贸易。",
        baseCost: { brick: 220, copper: 80, tools: 50 },
        input: { food: 2.00, coal: 0.20 },
        output: { ale: 3.50, silver: 0.80 },
        jobs: { worker: 5, artisan: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'distillation',
        visual: { icon: 'Wine', color: 'bg-purple-700', text: 'text-purple-100' },
        marketConfig: {
            price: { livingCostWeight: 0.35, taxCostWeight: 0.40 },
            wage: { livingCostWeight: 0.22, taxCostWeight: 0.22 }
        }
    },

    // 造纸印刷产业升级线
    {
        id: 'paper_mill',
        name: "造纸厂",
        desc: "工业化造纸设备，用木浆大规模生产纸张。",
        baseCost: { brick: 180, plank: 100, tools: 50 },
        input: { wood: 1.50, coal: 0.15 },
        output: { papyrus: 2.50 },
        jobs: { worker: 5, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 5,
        cat: 'industry',
        requiresTech: 'wood_pulp_process',
        visual: { icon: 'ScrollText', color: 'bg-lime-700', text: 'text-lime-100' },
        marketConfig: {
            price: { livingCostWeight: 0.18, taxCostWeight: 0.22 },
            wage: { livingCostWeight: 0.10, taxCostWeight: 0.10 }
        }
    },

    {
        id: 'publishing_house',
        name: "出版社",
        desc: "现代印刷与发行一体化，传播知识启迪民智。",
        baseCost: { brick: 300, steel: 80, papyrus: 100 },
        input: { papyrus: 1.00, coffee: 0.20, coal: 0.15 },
        output: { science: 2.50, culture: 1.00 },
        jobs: { scribe: 4, artisan: 2, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'industry',
        requiresTech: 'mass_media',
        visual: { icon: 'Newspaper', color: 'bg-cyan-800', text: 'text-cyan-100' },
        marketConfig: {
            price: { livingCostWeight: 0.25, taxCostWeight: 0.30 },
            wage: { livingCostWeight: 0.18, taxCostWeight: 0.18 }
        }
    },

    // 高级采集建筑
    {
        id: 'industrial_mine',
        name: "工业矿场",
        desc: "蒸汽动力的深井采矿设备，大幅提升矿石产量。",
        baseCost: { brick: 350, steel: 200, tools: 100 },
        input: { tools: 0.15, coal: 0.30 },
        output: { iron: 1.70, copper: 0.55 },
        jobs: { miner: 10, engineer: 2, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'gather',
        requiresTech: 'deep_shaft_mining',
        visual: { icon: 'Mountain', color: 'bg-zinc-800', text: 'text-zinc-100' },
        marketConfig: {
            price: { livingCostWeight: 0.25, taxCostWeight: 0.30 },
            wage: { livingCostWeight: 0.15, taxCostWeight: 0.15 }
        }
    },

    {
        id: 'mechanized_farm',
        name: "机械化农场",
        desc: "蒸汽拖拉机与收割机，农业产量飞跃式提升。",
        baseCost: { brick: 200, steel: 150, tools: 80 },
        input: { tools: 0.10, coal: 0.20 },
        output: { food: 22.00 },
        jobs: { peasant: 4, worker: 4, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'gather',
        requiresTech: 'agricultural_machinery',
        visual: { icon: 'Tractor', color: 'bg-green-800', text: 'text-green-100' },
        marketConfig: {
            price: { livingCostWeight: 0.18, taxCostWeight: 0.22 },
            wage: { livingCostWeight: 0.10, taxCostWeight: 0.10 }
        }
    },

    {
        id: 'logging_company',
        name: "伐木公司",
        desc: "配备蒸汽锯和运输铁路的大型伐木企业。",
        baseCost: { brick: 180, steel: 100, tools: 60 },
        input: { tools: 0.08, coal: 0.15 },
        output: { wood: 12.00 },
        jobs: { lumberjack: 6, worker: 4, engineer: 1, capitalist: 1 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'gather',
        requiresTech: 'steam_logging',
        visual: { icon: 'TreeDeciduous', color: 'bg-emerald-700', text: 'text-emerald-100' },
        marketConfig: {
            price: { livingCostWeight: 0.15, taxCostWeight: 0.20 },
            wage: { livingCostWeight: 0.08, taxCostWeight: 0.08 }
        }
    },

    // 高级居住建筑
    {
        id: 'apartment_block',
        name: "公寓楼",
        desc: "多层住宅建筑，容纳大量城市人口。",
        baseCost: { brick: 400, steel: 100, plank: 150 },
        output: { maxPop: 15 },
        epoch: 6,
        cat: 'civic',
        requiresTech: 'urban_architecture',
        visual: { icon: 'Building2', color: 'bg-slate-600', text: 'text-slate-100' }
    },

    // 高级文化建筑
    {
        id: 'university',
        name: "大学",
        desc: "高等学府，培养工程师和学者，产出大量科研。",
        baseCost: { brick: 400, plank: 200, papyrus: 100 },
        input: { papyrus: 0.30, coffee: 0.20, delicacies: 0.15 },
        output: { science: 3.00, culture: 0.80 },
        jobs: { scribe: 4, engineer: 2, official: 2 },
        owner: 'official',
        epoch: 5,
        cat: 'civic',
        requiresTech: 'higher_education',
        visual: { icon: 'GraduationCap', color: 'bg-blue-900', text: 'text-blue-100' }
    },

    {
        id: 'opera_house',
        name: "歌剧院",
        desc: "华丽的艺术殿堂，展示文明的文化成就。",
        baseCost: { brick: 350, plank: 150, furniture: 80 },
        input: { fine_clothes: 0.25, delicacies: 0.20 },
        output: { culture: 3.50, silver: 1.00 },
        jobs: { cleric: 4, artisan: 2, merchant: 1 },
        owner: 'cleric',
        epoch: 5,
        cat: 'civic',
        requiresTech: 'grand_arts',
        visual: { icon: 'Music', color: 'bg-rose-800', text: 'text-rose-100' }
    },

    {
        id: 'stock_exchange',
        name: "证券交易所",
        desc: "金融资本的神经中枢，调配全国资金流向。",
        baseCost: { brick: 500, steel: 150, papyrus: 100 },
        input: { papyrus: 0.20, coffee: 0.15 },
        output: { silver: 5.00, culture: 0.50 },
        jobs: { merchant: 6, scribe: 2, capitalist: 2 },
        owner: 'capitalist',
        epoch: 6,
        cat: 'civic',
        requiresTech: 'financial_capitalism',
        visual: { icon: 'TrendingUp', color: 'bg-emerald-900', text: 'text-emerald-100' }
    },
];
