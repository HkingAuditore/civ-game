/**
 * 外交国家配置
 * 每个国家包含：
 * - id: 国家唯一标识
 * - name: 国家名称
 * - type: 政体类型
 * - color: 显示颜色
 * - desc: 国家描述
 */
export const COUNTRIES = [
    {
        id: 'stone_clan',
        name: "石斧部族",
        type: "部落联盟",
        color: "text-amber-400",
        desc: "这里的法则从未改变：弱肉强食。我们是不朽的顽石，是敲碎文明头骨的钝器，在文明的黎明前夜，用石斧丈量生存的边界。",
        appearEpoch: 0,
        expireEpoch: 9,
        marketVolatility: 0.45,
        aggression: 0.65,
        wealth: 350,
        economyTraits: {
            resourceBias: {
                food: 1.3,
                wood: 1.1,
                stone: 0.8,
            },
        },
    },
    {
        id: 'dawn_tribe',
        name: "曙光部落",
        type: "原始公社",
        color: "text-emerald-400",
        desc: "当第一缕晨曦刺破混沌，我们选择了在此耕作与繁衍。不求征服，只求在蛮荒的大地上，为人性的微光筑起巢穴，守护那最初的火种。",
        appearEpoch: 0,
        expireEpoch: 9,
        marketVolatility: 0.25,
        aggression: 0.2,
        wealth: 420,
        economyTraits: {
            resourceBias: {
                food: 1.4,
                wood: 0.9,
                plank: 0.7,
                culture: 0.5,
            },
        },
    },
    {
        id: 'saffron_city',
        name: "藏红花城邦",
        type: "贸易寡头",
        color: "text-orange-300",
        desc: "铜与香料的气息交织在巷道，金币的清脆声是唯一的通用语。寡头们俯瞰着繁忙的港口，深知财富比刀剑更能统治人心。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.33,
        aggression: 0.45,
        wealth: 900,
        economyTraits: {
            resourceBias: {
                copper: 1.5,
                brick: 1.2,
                spice: 1.2,
                wood: 0.8,
            },
        },
    },
    {
        id: 'marble_league',
        name: "大理石同盟",
        type: "古典议会",
        color: "text-blue-300",
        desc: "洁白的柱廊下，哲人辩论着真理与美德，剧场中回荡着悲剧的咏叹。理性是我们的城墙，艺术是我们的灵魂，我们在大理石上雕刻永恒。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.28,
        aggression: 0.35,
        wealth: 1400,
        economyTraits: {
            resourceBias: {
                papyrus: 1.5,
                culture: 1.6,
                stone: 1.1,
                silver: 0.9,
            },
        },
    },
    {
        id: 'high_kingdom',
        name: "高庭王国",
        type: "封建王权",
        color: "text-red-400",
        desc: "铁蹄踏碎了花朵，城堡耸立如长矛。在这里，血统决定命运，土地即是权利。骑士的誓言在铁面具下回响，只为君王与领地流干最后一滴血。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.34,
        aggression: 0.6,
        wealth: 1600,
        economyTraits: {
            resourceBias: {
                food: 1.3,
                iron: 1.4,
                tools: 1.1,
                culture: 0.8,
            },
        },
    },
    {
        id: 'sunset_armada',
        name: "落日舰队",
        type: "探索海权",
        color: "text-amber-500",
        desc: "地平线不是终点，而是诱惑。国土是甲板，边界是海浪。我们追逐着落日的余晖，把世界的财富装入船舱，或者葬身鱼腹，别无他选。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.37,
        aggression: 0.55,
        wealth: 1900,
        economyTraits: {
            resourceBias: {
                spice: 1.7,
                plank: 1.3,
                tools: 1.2,
                silver: 1.1,
            },
        },
    },
    {
        id: 'lumiere_republic',
        name: "光耀共和国",
        type: "启蒙共和",
        color: "text-purple-300",
        desc: "思想比火炮更具威力。在咖啡馆的喧嚣与印刷机的轰鸣中，旧世界的偶像正在崩塌。自由的幽灵在游荡，我们将用理性的光芒照亮愚昧的长夜。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.26,
        aggression: 0.3,
        wealth: 2100,
        economyTraits: {
            resourceBias: {
                coffee: 1.5,
                culture: 1.7,
                papyrus: 1.3,
                science: 1.4,
            },
        },
    },
    {
        id: 'industrial_consortium',
        name: "蒸汽财团",
        type: "公司寡头",
        color: "text-orange-400",
        desc: "黑烟遮蔽了天空，齿轮咬合着血肉。在这里，效率是最高的道德，利润是唯一的信仰。蒸汽的嘶吼奏响了时代的强音，我们将世界锻造成钢铁的模样。",
        appearEpoch: 6,
        expireEpoch: 9,
        marketVolatility: 0.24,
        aggression: 0.45,
        wealth: 2600,
        economyTraits: {
            resourceBias: {
                coal: 1.6,
                steel: 1.5,
                tools: 1.4,
                silver: 1.2,
            },
        },
    },
    // ========== 新增国家 ==========
    {
        id: 'steppe_horde',
        name: "草原汗国",
        type: "游牧部落",
        color: "text-yellow-300",
        desc: "草是马的命，地是长生天的赏赐。既然你们筑起了墙，那我们就学会飞翔。弓弦响处，便是疆界，在此之前，我们是风，是火，是你们噩梦中的马蹄声。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.42,
        aggression: 0.75,
        wealth: 1200,
        culturalTraits: {
            militaryFocus: true,
            tradingStyle: 'aggressive',
            diplomaticModifier: -0.1,
        },
        economyTraits: {
            resourceBias: {
                food: 1.5,
                iron: 1.2,
                tools: 0.9,
                culture: 0.6,
            },
        },
        specialAbilities: [
            { type: 'raid_bonus', value: 0.3, desc: "掠夺收益 +30%" },
            { type: 'cavalry_discount', value: 0.2, desc: "骑兵训练成本 -20%" }
        ],
    },
    {
        id: 'desert_caravan',
        name: "沙漠商队",
        type: "商业联盟",
        color: "text-amber-200",
        desc: "沙海无情，但金币有价。我们行走在生与死的边缘，用驼铃串起绿洲。在这个世界，只要付得起价钱，连魔鬼也能喝上一杯冰镇的葡萄酒。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.22,
        aggression: 0.25,
        wealth: 1800,
        culturalTraits: {
            tradingStyle: 'merchant',
            diplomaticModifier: 0.15,
            marketExpertise: true,
        },
        economyTraits: {
            resourceBias: {
                spice: 2.0,
                silver: 1.4,
                culture: 1.2,
                food: 0.7,
            },
        },
        specialAbilities: [
            { type: 'trade_bonus', value: 0.25, desc: "贸易收益 +25%" },
            { type: 'market_stability', value: 0.15, desc: "市场波动 -15%" }
        ],
    },
    {
        id: 'jungle_empire',
        name: "雨林帝国",
        type: "神权王朝",
        color: "text-green-400",
        desc: "藤曼缠绕着神庙，太阳在祭坛上注视。我们知晓星辰的秘密，也懂得鲜血的渴望。在深绿的帷幕后，古老的诸神从未离去，祂们在等待下一个轮回。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.35,
        aggression: 0.4,
        wealth: 1100,
        culturalTraits: {
            religiousFocus: true,
            scientificAdvancement: 0.2,
            isolationist: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.8,
                science: 1.5,
                papyrus: 1.3,
                stone: 1.2,
            },
        },
        specialAbilities: [
            { type: 'culture_bonus', value: 0.2, desc: "文化产出 +20%" },
            { type: 'science_bonus', value: 0.15, desc: "科研效率 +15%" }
        ],
    },
    {
        id: 'mountain_clans',
        name: "山地氏族",
        type: "部落联邦",
        color: "text-slate-300",
        desc: "岩石教会我们沉默与坚硬。在云端之上，在深谷之下，我们是山的骨骼。外人只看见险峻的要塞，却看不见我们在这个贫瘠高度上，为生存铸造的钢铁意志。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.38,
        aggression: 0.5,
        wealth: 800,
        culturalTraits: {
            defensiveFocus: true,
            miningExpertise: true,
            isolationist: true,
        },
        economyTraits: {
            resourceBias: {
                stone: 1.8,
                iron: 1.6,
                copper: 1.4,
                food: 0.8,
            },
        },
        specialAbilities: [
            { type: 'mining_bonus', value: 0.25, desc: "采矿产出 +25%" },
            { type: 'defense_bonus', value: 0.3, desc: "防御力 +30%" }
        ],
    },
    {
        id: 'river_confederation',
        name: "河谷邦联",
        type: "水利共和",
        color: "text-cyan-400",
        desc: "大河泛滥，给予生命也带走生命。治水即治国，堤坝即律法。我们学会了像水一样顺势而为，也学会了在泥泞中筑起文明的粮仓。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.28,
        aggression: 0.3,
        wealth: 1000,
        culturalTraits: {
            agriculturalFocus: true,
            engineeringAdvanced: true,
            peacefulTrade: true,
        },
        economyTraits: {
            resourceBias: {
                food: 2.0,
                papyrus: 1.4,
                brick: 1.2,
                culture: 1.1,
            },
        },
        specialAbilities: [
            { type: 'food_production', value: 0.3, desc: "粮食产出 +30%" },
            { type: 'population_growth', value: 0.15, desc: "人口增长 +15%" }
        ],
    },
    {
        id: 'island_thalassocracy',
        name: "群岛海权",
        type: "海洋联盟",
        color: "text-teal-300",
        desc: "陆地是监狱，海洋是通途。每一座岛屿都是一艘静止的船，每一艘船都是一座漂浮的岛。谁控制了航线，谁就扼住了世界的咽喉。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.32,
        aggression: 0.4,
        wealth: 1700,
        culturalTraits: {
            navalSupremacy: true,
            tradingStyle: 'maritime',
            explorationBonus: 0.25,
        },
        economyTraits: {
            resourceBias: {
                plank: 1.6,
                spice: 1.5,
                tools: 1.3,
                silver: 1.2,
            },
        },
        specialAbilities: [
            { type: 'naval_bonus', value: 0.35, desc: "海军战力 +35%" },
            { type: 'trade_route', value: 0.2, desc: "贸易路线收益 +20%" }
        ],
    },
    {
        id: 'northern_principality',
        name: "北境公国",
        type: "贵族议会",
        color: "text-blue-200",
        desc: "凛冬将至，而我们生于寒冰。在漫长的长夜里，只有斧头和烈酒能带来温暖。这里的荣誉像冻土一样坚硬，背叛者将被风雪永远埋葬。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.36,
        aggression: 0.55,
        wealth: 1400,
        culturalTraits: {
            militaryTradition: true,
            resourcefulSurvival: true,
            honorCode: true,
        },
        economyTraits: {
            resourceBias: {
                wood: 1.7,
                plank: 1.5,
                iron: 1.3,
                food: 0.9,
            },
        },
        specialAbilities: [
            { type: 'winter_warfare', value: 0.25, desc: "冬季作战加成 +25%" },
            { type: 'lumber_efficiency', value: 0.2, desc: "木材采集 +20%" }
        ],
    },
    {
        id: 'silk_empire',
        name: "丝绸帝国",
        type: "中央集权",
        color: "text-rose-300",
        desc: "丝绸编织着帝国的经纬，瓷器映照出盛世的容颜。在这天朝上国，每一种礼仪都暗示着等级，每一条贸易线都为了维系这庞大秩序的呼吸。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.25,
        aggression: 0.35,
        wealth: 2200,
        culturalTraits: {
            culturalHegemony: true,
            bureaucraticEfficiency: 0.2,
            tradingStyle: 'monopolistic',
        },
        economyTraits: {
            resourceBias: {
                culture: 2.0,
                papyrus: 1.6,
                silver: 1.4,
                science: 1.3,
            },
        },
        specialAbilities: [
            { type: 'culture_influence', value: 0.3, desc: "文化影响力 +30%" }
        ],
    },
    {
        id: 'nomad_confederation',
        name: "游牧联盟",
        type: "部落议会",
        color: "text-orange-200",
        desc: "帐篷是流动的家，草原是无墙的城。今天的朋友可能是明天的仇敌，唯有更快的马和更锋利的刀，才能在这片苍茫中赢得尊严。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.48,
        aggression: 0.7,
        wealth: 700,
        culturalTraits: {
            mobilityFocus: true,
            raidingCulture: true,
            adaptability: 0.25,
        },
        economyTraits: {
            resourceBias: {
                food: 1.4,
                wood: 1.1,
                tools: 0.9,
                culture: 0.7,
            },
        },
        specialAbilities: [
            { type: 'mobility_bonus', value: 0.4, desc: "移动速度 +40%" },
            { type: 'raid_frequency', value: 0.3, desc: "掠夺频率 +30%" }
        ],
    },
    {
        id: 'theocratic_order',
        name: "圣教骑士团",
        type: "宗教军事",
        color: "text-yellow-100",
        desc: "剑与通过剑所守卫的真理。我们在尘世建立天国，用鲜血洗涤罪恶。异教徒的哀嚎是献给主的赞美诗，不仅要征服肉体，更要征服灵魂。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.31,
        aggression: 0.65,
        wealth: 1500,
        culturalTraits: {
            religiousFervor: true,
            militaryDiscipline: 0.25,
            missionaryZeal: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.6,
                iron: 1.4,
                tools: 1.3,
                silver: 1.2,
            },
        },
        specialAbilities: [
            { type: 'holy_war', value: 0.3, desc: "圣战加成 +30%" },
            { type: 'morale_bonus', value: 0.25, desc: "士气 +25%" }
        ],
    },
    {
        id: 'merchant_republic',
        name: "自由商会",
        type: "商业共和",
        color: "text-emerald-300",
        desc: "金币没有祖国，利润不分信仰。在账本的方格间，我们计算着战争与和平的成本。只要借贷表平衡，即便是国王的皇冠，也可以作为抵押品。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.20,
        aggression: 0.25,
        wealth: 2400,
        culturalTraits: {
            financialExpertise: true,
            tradingStyle: 'capitalist',
            diplomaticModifier: 0.2,
        },
        economyTraits: {
            resourceBias: {
                silver: 1.8,
                culture: 1.4,
                science: 1.3,
                spice: 1.2,
            },
        },
        specialAbilities: [
            { type: 'banking_system', value: 0.25, desc: "利息收入 +25%" },
            { type: 'trade_network', value: 0.3, desc: "贸易网络效率 +30%" }
        ],
    },
    {
        id: 'revolutionary_state',
        name: "革命共和国",
        type: "革命政府",
        color: "text-red-300",
        desc: "这是最好的时代，也是最坏的时代。断头台的利刃切断了过去，街垒的石块堆砌出未来。为了自由，我们不惜让鲜血染红旗帜，因为公民不需要主子。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.40,
        aggression: 0.6,
        wealth: 1900,
        culturalTraits: {
            revolutionaryZeal: true,
            massConscription: 0.3,
            ideologicalExport: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.5,
                science: 1.4,
                iron: 1.3,
                food: 1.2,
            },
        },
        specialAbilities: [
            { type: 'conscription', value: 0.35, desc: "征兵效率 +35%" },
            { type: 'revolutionary_fervor', value: 0.2, desc: "战斗力 +20%" }
        ],
    },
    // ========== 历史致敬国家 ==========
    {
        id: 'eternal_city',
        name: "永恒之城",
        type: "元老院共和",
        color: "text-red-500",
        desc: "元老院的辩论声未落，军团的鹰旗已插遍地中海。大理石的辉煌下是征服者的铁律：顺我者昌，逆我者亡。这不仅是一座城，而是一个永恒的理念。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.27,
        aggression: 0.65,
        wealth: 1600,
        culturalTraits: {
            legalTradition: true,
            militaryDiscipline: 0.3,
            infrastructureFocus: true,
        },
        economyTraits: {
            resourceBias: {
                stone: 1.5,
                iron: 1.4,
                culture: 1.3,
                silver: 1.2,
            },
        },
        specialAbilities: [
            { type: 'military_trade', desc: "石材与铁矿贸易优势" },
            { type: 'high_aggression', desc: "较高的军事扩张倾向" }
        ],
    },
    {
        id: 'golden_crescent',
        name: "新月沃土",
        type: "神庙王权",
        color: "text-yellow-400",
        desc: "在泥板上刻下第一行楔形文字时，在这个众神漫步的晨曦时代，我们建立了最早的秩序。星辰指引着塔楼，法律约束着君王，这里是文明的摇篮，也是伊甸园的遗址。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.30,
        aggression: 0.45,
        wealth: 1100,
        culturalTraits: {
            cradle: true,
            writingInventor: true,
            astronomyAdvanced: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.6,
                brick: 1.5,
                papyrus: 1.4,
                culture: 1.3,
            },
        },
        specialAbilities: [
            { type: 'agricultural_trade', desc: "粮食与砖块贸易优势" },
            { type: 'cultural_focus', desc: "纸草和文化出口大国" }
        ],
    },
    {
        id: 'pyramid_kingdom',
        name: "金字塔王朝",
        type: "法老神权",
        color: "text-amber-300",
        desc: "尼罗河的涨落是时间的呼吸，沙漠的金沙是永恒的注脚。我们在生与死的彼岸建造宏伟的陵寝，因为在法老的凝视下，死亡仅仅是另一段旅程的开始。",
        appearEpoch: 1,
        expireEpoch: 9,
        marketVolatility: 0.25,
        aggression: 0.35,
        wealth: 1300,
        culturalTraits: {
            monumentBuilding: true,
            divineKingship: true,
            riverCivilization: true,
        },
        economyTraits: {
            resourceBias: {
                stone: 1.8,
                food: 1.5,
                papyrus: 1.4,
                culture: 1.6,
            },
        },
        specialAbilities: [
            { type: 'stone_trade', desc: "石材贸易大国" },
            { type: 'cultural_export', desc: "文化和纸草出口优势" }
        ],
    },
    {
        id: 'agora_polis',
        name: "雅典娜城邦",
        type: "民主议会",
        color: "text-sky-400",
        desc: "这里是理性的灯塔，是哲人的广场。我们在橄榄树下辩论正义，在陶片上刻在流放者的名字。民主是多数人的暴政还是自由的保障？历史在等待我们的答案。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.29,
        aggression: 0.30,
        wealth: 1200,
        culturalTraits: {
            democracyBirthplace: true,
            philosophyCenter: true,
            navalTradition: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 2.0,
                science: 1.8,
                silver: 1.3,
                papyrus: 1.2,
            },
        },
        specialAbilities: [
            { type: 'knowledge_trade', desc: "文化与科研贸易大国" },
            { type: 'peaceful_focus', desc: "低侵略性，偏好外交" }
        ],
    },
    {
        id: 'sparta_militaris',
        name: "铁血城邦",
        type: "军事寡头",
        color: "text-red-600",
        desc: "‘带着盾牌回来，或躺在盾牌上回来。’没有城墙，因为胸膛就是防线。没有艺术，因为战争就是杰作。在这里，弱者被遗弃，强者被磨砺。我们在盾牌的撞击声中寻找荣耀，直到最后一人倒下。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.35,
        aggression: 0.85,
        wealth: 900,
        culturalTraits: {
            militarySociety: true,
            austereLiving: true,
            helotSystem: true,
        },
        economyTraits: {
            resourceBias: {
                iron: 1.6,
                food: 1.3,
                tools: 1.2,
                culture: 0.5,
            },
        },
        specialAbilities: [
            { type: 'iron_trade', desc: "铁矿贸易优势" },
            { type: 'warlike', desc: "极高侵略性，频繁军事冲突" }
        ],
    },
    {
        id: 'carthago_nova',
        name: "迦太基商会",
        type: "商业寡头",
        color: "text-purple-400",
        desc: "海洋是我们的牧场，金钱是我们的士兵。无论多远的港口，都有我们的商栈。只要利润足够，大象也能翻越阿尔卑斯山。",
        appearEpoch: 2,
        expireEpoch: 9,
        marketVolatility: 0.26,
        aggression: 0.5,
        wealth: 1800,
        culturalTraits: {
            mercantileTradition: true,
            mercenaryArmy: true,
            navalCommerce: true,
        },
        economyTraits: {
            resourceBias: {
                silver: 1.7,
                spice: 1.5,
                plank: 1.4,
                tools: 1.2,
            },
        },
        specialAbilities: [
            { type: 'silver_trade', desc: "银币和香料贸易大国" },
            { type: 'naval_commerce', desc: "木板和工具出口优势" }
        ],
    },
    {
        id: 'viking_raiders',
        name: "北海劫掠者",
        type: "海盗联盟",
        color: "text-blue-400",
        desc: "奥丁在英灵殿注视，女武神在风暴中歌唱。龙首船破浪而来，带来恐惧也带来传说。我们不耕种土地，我们收割财富；无论在何处倒下，都是通往瓦尔哈拉的归途。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.45,
        aggression: 0.8,
        wealth: 1100,
        culturalTraits: {
            seafaringMastery: true,
            raidingCulture: true,
            explorerSpirit: true,
        },
        economyTraits: {
            resourceBias: {
                plank: 1.6,
                iron: 1.4,
                food: 1.2,
                silver: 1.1,
            },
        },
        specialAbilities: [
            { type: 'timber_trade', desc: "木板与铁矿贸易优势" },
            { type: 'raider', desc: "高侵略性，频繁劫掠" }
        ],
    },
    {
        id: 'mongol_horde',
        name: "天命大汗国",
        type: "游牧帝国",
        color: "text-amber-500",
        desc: "苍狼的子孙，听从长生天的召唤。从日出之地到日落之邦，凡马蹄所至，皆为牧场。对于抗拒者，车轮高过车轴的男丁皆不留；对于顺从者，我们将赐予他们作为奴仆的荣幸。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.50,
        aggression: 0.9,
        wealth: 1600,
        culturalTraits: {
            horseLordSupremacy: true,
            rapidConquest: true,
            tradeProtection: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.4,
                iron: 1.5,
                silver: 1.3,
                spice: 1.2,
            },
        },
        specialAbilities: [
            { type: 'conquest_trade', desc: "战利品丰富（铁、银、香料）" },
            { type: 'extreme_aggression', desc: "极高侵略性，大规模征服" }
        ],
    },
    {
        id: 'shogunate',
        name: "幕府将军领",
        type: "武家政权",
        color: "text-rose-400",
        desc: "菊与刀，樱花与钢铁。在浮世的虚幻中，唯有忠诚与名誉是真实的重担。幕府的威严笼罩列岛，武士的刀刃在寂静中出鞘，守护着这片日出之国的封闭与静美。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.28,
        aggression: 0.55,
        wealth: 1400,
        culturalTraits: {
            bushidoCode: true,
            isolationism: true,
            craftExcellence: true,
        },
        economyTraits: {
            resourceBias: {
                iron: 1.5,
                culture: 1.4,
                food: 1.3,
                tools: 1.2,
            },
        },
        specialAbilities: [
            { type: 'craft_trade', desc: "铁矿与工具贸易优势" },
            { type: 'cultural_isolation', desc: "中等侵略性，倾向自给自足" }
        ],
    }, {
        id: 'ming_celestial',
        name: "天朝上国",
        type: "科举帝制",
        color: "text-yellow-500",
        desc: "日月照耀之处，皆为汉土。庞大的官僚机器昼夜运转，维系着这古老帝国的脉搏。北驱鞑虏，南下西洋，我们在传统的厚重帷幕中，审视着自身与世界，既是中心，也是孤岛。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.22,
        aggression: 0.35,
        wealth: 2500,
        culturalTraits: {
            celestialMandate: true,
            examSystem: true,
            tributeSystem: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.8,
                science: 1.5,
                silver: 1.4,
                papyrus: 1.3,
            },
        },
        specialAbilities: [
            { type: 'luxury_trade', desc: "文化与科研贸易大国" },
            { type: 'wealthy_empire', desc: "巨额财富，低市场波动" }
        ],
    },
    {
        id: 'ottoman_sublime',
        name: "崇高门廷",
        type: "苏丹集权",
        color: "text-emerald-400",
        desc: "君士坦丁堡的陷落只是开始。在新军的火枪与巨炮声中，新月旗遮蔽了欧亚的天空。我们是罗马的继承者，也是哈里发的捍卫者，在此崇高门廷之下，万国皆为臣仆。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.30,
        aggression: 0.6,
        wealth: 2000,
        culturalTraits: {
            gunpowderEmpire: true,
            janissarySystem: true,
            multiculturalRule: true,
        },
        economyTraits: {
            resourceBias: {
                spice: 1.5,
                iron: 1.4,
                culture: 1.3,
                silver: 1.3,
            },
        },
        specialAbilities: [
            { type: 'spice_trade', desc: "香料与铁矿贸易优势" },
            { type: 'expansionist', desc: "较高侵略性，军事扩张" }
        ],
    },
    {
        id: 'spanish_conquistador',
        name: "征服者王冠",
        type: "殖民帝国",
        color: "text-orange-500",
        desc: "为了上帝，为了荣光，也为了黄金。我们在丛林中寻找黄金国，在异教徒的土地上竖起十字架。在那无敌舰队的白帆之下，流淌着新大陆的血泪与旧世界的贪婪。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.35,
        aggression: 0.7,
        wealth: 2200,
        culturalTraits: {
            conquistadorSpirit: true,
            religiousMission: true,
            colonialEmpire: true,
        },
        economyTraits: {
            resourceBias: {
                silver: 2.0,
                spice: 1.5,
                culture: 1.2,
                iron: 1.2,
            },
        },
        specialAbilities: [
            { type: 'silver_monopoly', desc: "银币贸易垄断" },
            { type: 'aggressive_colonial', desc: "高侵略性，殖民扩张" }
        ],
    },
    {
        id: 'british_empire',
        name: "海上霸权",
        type: "君主立宪",
        color: "text-blue-500",
        desc: "日不落的辉煌由贸易风吹送，由皇家海军护航。我们在曼彻斯特纺织世界，在伦敦交易全球。用法律、英镑和坚船利炮，编织了一张覆盖地球的文明之网。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.23,
        aggression: 0.55,
        wealth: 2800,
        culturalTraits: {
            navalSupremacy: true,
            parliamentarySystem: true,
            industrialPioneer: true,
        },
        economyTraits: {
            resourceBias: {
                coal: 1.6,
                steel: 1.5,
                silver: 1.4,
                culture: 1.3,
            },
        },
        specialAbilities: [
            { type: 'industrial_trade', desc: "煤炭与钢铁贸易大国" },
            { type: 'naval_dominance', desc: "低市场波动，稳定贸易" }
        ],
    },
    {
        id: 'prussian_eagle',
        name: "铁十字王国",
        type: "军事君主",
        color: "text-slate-400",
        desc: "其他国家拥有一支军队，而这个国家属于一支军队。铁血是我们的宪法，纪律是我们的信仰。在参谋本部的地图上，我们精密地计算着每一次胜利，因为德意志的命运在刀尖之上。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.25,
        aggression: 0.7,
        wealth: 2100,
        culturalTraits: {
            militaryPrecision: true,
            bureaucraticState: true,
            junkertradition: true,
        },
        economyTraits: {
            resourceBias: {
                iron: 1.6,
                coal: 1.4,
                tools: 1.3,
                science: 1.2,
            },
        },
        specialAbilities: [
            { type: 'military_industry', desc: "铁矿与煤炭贸易优势" },
            { type: 'disciplined_trade', desc: "高侵略性但低市场波动" }
        ],
    },
    {
        id: 'american_frontier',
        name: "新大陆合众国",
        type: "联邦共和",
        color: "text-blue-300",
        desc: "流淌着奶与蜜的应许之地，昭昭天命指引我们向西。这是一场伟大的实验，关于自由、枪支与个人奋斗。在这里，出身不代表一切，只要你有勇气，就能在蛮荒中建立属于自己的帝国。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.32,
        aggression: 0.45,
        wealth: 2300,
        culturalTraits: {
            manifestDestiny: true,
            frontierSpirit: true,
            democraticIdeals: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.5,
                coal: 1.4,
                steel: 1.3,
                silver: 1.2,
            },
        },
        specialAbilities: [
            { type: 'resource_trade', desc: "粮食与原材料贸易优势" },
            { type: 'moderate_expansion', desc: "中等侵略性，稳定发展" }
        ],
    },
    {
        id: 'tsarist_empire',
        name: "沙皇帝国",
        type: "专制帝国",
        color: "text-indigo-400",
        desc: "双头鹰注视着东西方，在无尽的雪原上，沙皇是唯一的父亲。东正教的钟声在寒风中回荡，农奴的脊梁支撑起金碧辉煌的宫殿。这是一个苦难与宏大并存的灵魂，冰冷如西伯利亚。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.35,
        aggression: 0.6,
        wealth: 1900,
        culturalTraits: {
            vastTerritory: true,
            autocraticRule: true,
            orthodoxFaith: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.4,
                iron: 1.3,
                wood: 1.5,
                coal: 1.2,
            },
        },
        specialAbilities: [
            { type: 'timber_export', desc: "木材与铁矿出口大国" },
            { type: 'vast_resources', desc: "较高侵略性，资源丰富" }
        ],
    },
    {
        id: 'dutch_voc',
        name: "联合东印度",
        type: "商业联省",
        color: "text-orange-300",
        desc: "上帝创造了世界，但荷兰人创造了荷兰。我们在海平面以下围海造田，在股票交易所里买卖未来。郁金香的泡沫虽然绚丽，但唯有东印度公司的红利，才是这海上马车夫的真正基石。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.18,
        aggression: 0.3,
        wealth: 2600,
        culturalTraits: {
            financialInnovation: true,
            tradingCompany: true,
            religiousTolerance: true,
        },
        economyTraits: {
            resourceBias: {
                silver: 1.8,
                spice: 1.7,
                culture: 1.3,
                science: 1.2,
            },
        },
        specialAbilities: [
            { type: 'financial_center', desc: "银币与香料贸易垄断" },
            { type: 'stable_market', desc: "极低市场波动，和平贸易" }
        ],
    },
    {
        id: 'inca_empire',
        name: "太阳之子",
        type: "神圣帝国",
        color: "text-yellow-600",
        desc: "这是太阳神的子民，安第斯山的雄鹰。我们在云端之上修筑道路，用结绳记录帝国的心跳。黄金只是太阳的汗水，只有土地与玉米才是生命的恩赐，直到那贪婪的白人带来毁灭。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.30,
        aggression: 0.4,
        wealth: 1500,
        culturalTraits: {
            sunWorship: true,
            roadNetwork: true,
            laborTax: true,
        },
        economyTraits: {
            resourceBias: {
                stone: 1.7,
                food: 1.5,
                silver: 1.4,
                culture: 1.3,
            },
        },
        specialAbilities: [
            { type: 'mountain_trade', desc: "石材与银币贸易优势" },
            { type: 'agricultural_base', desc: "粮食出口大国" }
        ],
    },
    {
        id: 'aztec_empire',
        name: "血祭帝国",
        type: "祭司王权",
        color: "text-teal-500",
        desc: "太阳需要鲜血才能升起，世界需要牺牲才能延续。在特诺奇蒂特兰的辉煌神庙顶端，还要跳动多少颗心脏，才能延缓这第五个太阳纪的终结？这是一场与末日的永恒赛跑。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.38,
        aggression: 0.75,
        wealth: 1300,
        culturalTraits: {
            sacrificialCulture: true,
            flowerWars: true,
            floatingGardens: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.6,
                culture: 1.5,
                stone: 1.3,
                silver: 1.2,
            },
        },
        specialAbilities: [
            { type: 'food_culture', desc: "粮食与文化贸易优势" },
            { type: 'warrior_society', desc: "高侵略性，好战文化" }
        ],
    },
    {
        id: 'byzantine_remnant',
        name: "紫衣帝都",
        type: "神圣帝国",
        color: "text-violet-400",
        desc: "紫色的凤凰在余烬中挣扎。尽管疆土日蹙，但君士坦丁堡的金墙依旧闪耀。我们守卫着罗马最后的法统，在蛮族的浪潮前，用希腊火和阴谋诡计，维系着那千年不灭的微光。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.28,
        aggression: 0.45,
        wealth: 1700,
        culturalTraits: {
            imperialLegacy: true,
            orthodoxCenter: true,
            diplomaticMastery: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.7,
                silver: 1.4,
                science: 1.3,
                stone: 1.2,
            },
        },
        specialAbilities: [
            { type: 'trade_focus', desc: "文化与银币贸易优势" },
            { type: 'diplomatic_focus', desc: "低侵略性，偏好和平贸易" }
        ],
    },
    {
        id: 'mali_mansa',
        name: "黄金曼萨",
        type: "商贸王国",
        color: "text-yellow-400",
        desc: "当曼萨朝圣的队伍经过，连开罗的金价都要暴跌十年。这里的黄金像尘土一样寻常，盐巴却比生命更珍贵。萨赫勒的烈日下，不仅有骆驼商队，还有廷巴克图的图书馆。",
        appearEpoch: 3,
        expireEpoch: 9,
        marketVolatility: 0.25,
        aggression: 0.3,
        wealth: 2400,
        culturalTraits: {
            goldTrade: true,
            islamicLearning: true,
            transaharaTrade: true,
        },
        economyTraits: {
            resourceBias: {
                silver: 2.0,
                culture: 1.5,
                spice: 1.3,
                food: 1.2,
            },
        },
        specialAbilities: [
            { type: 'gold_trade', desc: "银币贸易垄断（极高财富）" },
            { type: 'peaceful_merchant', desc: "低侵略性，和平贸易" }
        ],
    },
    {
        id: 'mughal_splendor',
        name: "莫卧儿辉煌",
        type: "帝国王朝",
        color: "text-emerald-300",
        desc: "孔雀宝座上的光辉令日月失色，大理石的陵墓是对爱最奢华的颂歌。突厥的弓马与印度的战象在此交融，在这片富庶得令人窒息的土地上，每一个转角都流淌着香料与诗歌。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.27,
        aggression: 0.5,
        wealth: 2300,
        culturalTraits: {
            artisticPatronage: true,
            religiousSyncretism: true,
            imperialGrandeur: true,
        },
        economyTraits: {
            resourceBias: {
                culture: 1.8,
                spice: 1.6,
                silver: 1.4,
                stone: 1.3,
            },
        },
        specialAbilities: [
            { type: 'luxury_export', desc: "文化与香料出口大国" },
            { type: 'wealthy_stable', desc: "巨额财富，中等侵略性" }
        ],
    },
    {
        id: 'zulu_impi',
        name: "战牛部落",
        type: "军事联盟",
        color: "text-green-500",
        desc: "大地随着牛角阵的冲锋而震颤。我们不需要火枪，短矛和盾牌足以刺穿帝国主义的傲慢。长矛洗刷了耻辱，勇气铸就了防线，在这片黑色的土地上，每一个战士都是祖灵的化身。",
        appearEpoch: 5,
        expireEpoch: 9,
        marketVolatility: 0.40,
        aggression: 0.8,
        wealth: 1000,
        culturalTraits: {
            militaryInnovation: true,
            ageRegiments: true,
            cattleWealth: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.5,
                iron: 1.3,
                tools: 1.1,
                culture: 0.8,
            },
        },
        specialAbilities: [
            { type: 'basic_resources', desc: "粮食与铁矿贸易" },
            { type: 'warrior_nation', desc: "极高侵略性，战斗民族" }
        ],
    },
    {
        id: 'polish_winged',
        name: "翼骑兵联邦",
        type: "贵族共和",
        color: "text-red-200",
        desc: "当上帝在叹息，翼骑兵便冲锋。我们是基督教世界的盾牌，是夹在东西方铁砧间的铁锤。虽有贵族的否决权带来的混乱，但在那背负羽翼的钢铁洪流面前，一切敌人终将粉碎。",
        appearEpoch: 4,
        expireEpoch: 9,
        marketVolatility: 0.32,
        aggression: 0.55,
        wealth: 1600,
        culturalTraits: {
            nobleRepublic: true,
            cavalryTradition: true,
            religiousTolerance: true,
        },
        economyTraits: {
            resourceBias: {
                food: 1.4,
                iron: 1.3,
                culture: 1.2,
                wood: 1.2,
            },
        },
        specialAbilities: [
            { type: 'cavalry_focus', desc: "铁矿与粮食贸易优势" },
            { type: 'balanced_aggression', desc: "适度的军事倾向" }
        ],
    },

    // ========== 信息时代国家（新增，用于补充后期贸易对象） ==========
    {
        id: 'pacific_federation',
        name: "环太平洋共同防务与贸易体",
        type: "议会-军工复合体",
        color: "text-sky-300",
        desc: "集装箱是细胞，航线是血管。在这个名为‘自由贸易’的庞大机器中，国家不过是一个大型港口服务区。只要你是供应链的一环，你就在保护伞下；否则，你就是等待被清除的贸易壁垒。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.22,
        aggression: 0.35,
        wealth: 3400,
        culturalTraits: {
            navalSupremacy: true,
            tradingStyle: 'maritime',
            democraticIdeals: true,
        },
        economyTraits: {
            resourceBias: {
                steel: 1.6,
                coal: 1.2,
                tools: 1.4,
                coffee: 1.2,
                spice: 1.1,
                silver: 1.3,
            },
        },
        specialAbilities: [
            { type: 'trade_network', desc: "贸易网络效率" },
            { type: 'naval_commerce', desc: "海运贸易优势" }
        ],
    },
    {
        id: 'digital_sultanate',
        name: "石油基金会托管苏丹国",
        type: "家族资本君主",
        color: "text-emerald-300",
        desc: "石油是旧时代的黑金，数据是新时代的石油。在这个赛博绿洲里，王子们在云端监控着臣民的心跳，主权财富基金买下了半个世界的未来。稳定是最高的算法，而异见是系统无法识别的乱码。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.20,
        aggression: 0.55,
        wealth: 3600,
        culturalTraits: {
            autocraticRule: true,
            multiculturalRule: true,
            tradingStyle: 'monopolistic',
        },
        economyTraits: {
            resourceBias: {
                coal: 1.8,
                steel: 1.4,
                silver: 1.6,
                spice: 1.2,
                coffee: 1.1,
            },
        },
        specialAbilities: [
            { type: 'financial_center', desc: "金融中心（银币贸易优势）" },
            { type: 'stable_market', desc: "低市场波动（贸易更稳定）" }
        ],
    },
    {
        id: 'silicon_commons',
        name: "算法委员会辖区",
        type: "平台治理共同体",
        color: "text-cyan-300",
        desc: "代码即法律，平台即国家。这里没有国界，只有用户协议。他们在云端构建乌托邦，用推荐算法喂养灵魂。你以为你在浏览世界，其实你只是在他们精心设计的鱼缸里，做着自由的梦。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.28,
        aggression: 0.25,
        wealth: 3200,
        culturalTraits: {
            scientificAdvancement: 0.25,
            philosophicalDiscourse: true,
            marketExpertise: true,
        },
        economyTraits: {
            resourceBias: {
                science: 2.0,
                culture: 1.8,
                papyrus: 1.4,
                tools: 1.2,
                silver: 1.1,
            },
        },
        specialAbilities: [
            { type: 'knowledge_trade', desc: "科研与文化出口优势" },
            { type: 'market_stability', desc: "市场运作成熟" }
        ],
    },
    {
        id: 'northern_energy_union',
        name: "北境管道共和国",
        type: "国家资本寡头",
        color: "text-slate-200",
        desc: "管道是这片冻土的脐带。他们在永夜中燃烧着地底的骨血，为温暖的世界输送光热，也输送着地缘政治的寒意。这不是生意，这是生存；当你拧开阀门，你就在与那头北极熊共舞。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.30,
        aggression: 0.45,
        wealth: 3300,
        culturalTraits: {
            vastTerritory: true,
            bureaucraticEfficiency: 0.15,
            resourcefulSurvival: true,
        },
        economyTraits: {
            resourceBias: {
                coal: 1.7,
                iron: 1.4,
                wood: 1.3,
                steel: 1.2,
                food: 0.9,
            },
        },
        specialAbilities: [
            { type: 'timber_trade', desc: "木材与矿产出口优势" },
            { type: 'industrial_trade', desc: "工业原料贸易优势" }
        ],
    },
    {
        id: 'free_city_network',
        name: "离岸自由港共同体",
        type: "自由贸易委员会",
        color: "text-teal-200",
        desc: "避税天堂的群岛，资本流动的尽头。这里没有国籍，只有账户等级。洗钱与慈善只是一枚硬币的两面，黑与白在离岸的迷雾中融为一体，构成了全球经济最灰色的底色。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.18,
        aggression: 0.20,
        wealth: 3500,
        culturalTraits: {
            financialInnovation: true,
            tradingCompany: true,
            religiousTolerance: true,
        },
        economyTraits: {
            resourceBias: {
                silver: 2.0,
                coffee: 1.3,
                spice: 1.3,
                furniture: 1.1,
                fine_clothes: 1.1,
                steel: 1.2,
            },
        },
        specialAbilities: [
            { type: 'banking_system', desc: "金融与结算优势" },
            { type: 'trade_bonus', desc: "贸易收益优势" }
        ],
    },
    {
        id: 'southern_agri_bloc',
        name: "南方民生保障阵线",
        type: "临时联合政府",
        color: "text-lime-300",
        desc: "在这个饥饿的世界，手中有粮，心中不慌。他们是全球的粮仓，也是这种植园经济的囚徒。每一粒出口的小麦都浸透了汗水与农药，为了换取那些永远不够用的工业零件。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.26,
        aggression: 0.22,
        wealth: 3100,
        culturalTraits: {
            agriculturalFocus: true,
            peacefulTrade: true,
            engineeringAdvanced: true,
        },
        economyTraits: {
            resourceBias: {
                food: 2.1,
                coffee: 1.6,
                cloth: 1.2,
                silver: 1.2,
                steel: 0.9,
                tools: 0.9,
            },
        },
        specialAbilities: [
            { type: 'agricultural_trade', desc: "农业品出口优势" },
            { type: 'peaceful_merchant', desc: "偏好和平贸易" }
        ],
    },
    {
        id: 'highland_mining_consortium',
        name: "资源开发与秩序恢复委员会",
        type: "治安军政府",
        color: "text-zinc-300",
        desc: "秩序是建立在刺刀和矿镐之上的。军政府的通告和开采许可证一样冷酷。在这高原的废墟上，他们用铁腕恢复生产，因为在这个崩坏的时代，只有挖出来的矿石，才是唯一的硬通货。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.27,
        aggression: 0.38,
        wealth: 3450,
        culturalTraits: {
            industrialLobby: true,
            engineeringAdvanced: true,
            bureaucraticEfficiency: 0.08,
        },
        economyTraits: {
            resourceBias: {
                iron: 1.8,
                coal: 1.5,
                steel: 1.4,
                tools: 1.2,
                silver: 1.1,
            },
        },
        specialAbilities: [
            { type: 'heavy_industry', desc: "重工业与矿产出口优势" },
            { type: 'steady_supply', desc: "供应稳定（适中波动）" }
        ],
    },
    {
        id: 'river_delta_metropolis',
        name: "河口关税总署同盟",
        type: "通商口岸督署",
        color: "text-blue-200",
        desc: "在拥挤的三角洲，每一寸土地都标好了价格。所有东西都是为了转手，所有人都是过客。繁荣的表象下是空心化的实业，他们靠吸食全球贸易的血肉为生，把自己变成了那个最臃肿的中间人。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.19,
        aggression: 0.22,
        wealth: 3550,
        culturalTraits: {
            urbanPlanning: true,
            marketExpertise: true,
            tradingCompany: true,
        },
        economyTraits: {
            resourceBias: {
                tools: 1.6,
                steel: 1.3,
                cloth: 1.2,
                furniture: 1.2,
                coffee: 1.2,
                silver: 1.4,
            },
        },
        specialAbilities: [
            { type: 'reexport_hub', desc: "转口贸易优势" },
            { type: 'efficient_market', desc: "市场效率优势" }
        ],
    },
    {
        id: 'equatorial_spice_union',
        name: "赤道海峡保护协定",
        type: "种植园董事会",
        color: "text-amber-300",
        desc: "赤道的阳光不仅催熟了咖啡豆，也催生了垄断。控制了海峡，就控制了时间。这不仅仅是种植园主的游戏，而是关于谁有权决定你的下午茶要付多少钱的地缘政治勒索。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.34,
        aggression: 0.30,
        wealth: 3250,
        culturalTraits: {
            maritimeTradition: true,
            tradingStyle: 'plantation',
            multiculturalRule: true,
        },
        economyTraits: {
            resourceBias: {
                spice: 2.1,
                coffee: 1.7,
                food: 1.1,
                silver: 1.2,
                steel: 0.85,
                tools: 0.9,
            },
        },
        specialAbilities: [
            { type: 'spice_export', desc: "香料出口优势" },
            { type: 'cash_crop_trade', desc: "经济作物贸易优势" }
        ],
    },
    {
        id: 'continental_rail_republic',
        name: "全国交通统筹共和国",
        type: "铁路与口粮委员会",
        color: "text-orange-200",
        desc: "列车从不晚点，因为晚点意味着饥荒。在这个铁轨铺就的国家，一切都像时刻表一样精密而无情。个人被简化为载重吨位，生活被压缩进车厢，我们要么在轰鸣中前进，要么在停摆中死亡。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.24,
        aggression: 0.33,
        wealth: 3350,
        culturalTraits: {
            infrastructureFirst: true,
            bureaucraticEfficiency: 0.10,
            republicanIdeals: true,
        },
        economyTraits: {
            resourceBias: {
                coal: 1.3,
                iron: 1.3,
                tools: 1.4,
                food: 1.2,
                wood: 1.1,
                silver: 1.1,
            },
        },
        specialAbilities: [
            { type: 'logistics_mastery', desc: "物流调度优势" },
            { type: 'bulk_trade', desc: "大宗贸易优势" }
        ],
    },
    {
        id: 'academy_principalities',
        name: "智库基金会保护国",
        type: "学术寡头邦联",
        color: "text-fuchsia-300",
        desc: "象牙塔变成了堡垒，论文变成了教条。知识不再是为了真理，而是为了基金会的拨款。这些智库的国王们在研讨会上划分世界，用术语和模型编织出一张看似理性实则傲慢的网。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.23,
        aggression: 0.18,
        wealth: 3150,
        culturalTraits: {
            scientificAdvancement: 0.20,
            philosophicalDiscourse: true,
            religiousTolerance: true,
        },
        economyTraits: {
            resourceBias: {
                science: 2.2,
                culture: 1.9,
                papyrus: 1.5,
                silver: 1.2,
                tools: 0.95,
                steel: 0.9,
            },
        },
        specialAbilities: [
            { type: 'research_exports', desc: "科研输出优势" },
            { type: 'cultural_exports', desc: "文化输出优势" }
        ],
    },
    {
        id: 'artisan_luxury_cartel',
        name: "轻奢与审美输出联合体",
        type: "品牌寡头理事会",
        color: "text-rose-300",
        desc: "为了那样东西，你愿意付出多少溢价？他们贩卖的不是商品，是阶级，是幻觉。在这个精致的卡特尔里，审美是最高的门槛，将世界无情地划分为‘有品位的’和‘买不起的’。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.31,
        aggression: 0.24,
        wealth: 3400,
        culturalTraits: {
            guildTradition: true,
            marketExpertise: true,
            artisticPatronage: true,
        },
        economyTraits: {
            resourceBias: {
                fine_clothes: 1.7,
                furniture: 1.6,
                delicacies: 1.3,
                ale: 1.2,
                cloth: 1.1,
                silver: 1.3,
            },
        },
        specialAbilities: [
            { type: 'luxury_goods', desc: "奢侈品出口优势" },
            { type: 'craftsmanship', desc: "工艺与附加值优势" }
        ],
    },
    {
        id: 'global_agro_logistics',
        name: "国际保供与配给署",
        type: "特别事务署",
        color: "text-green-200",
        desc: "如果你控制了食物，你就控制了人口。这个庞然大物披着人道主义的外衣，手里却握着饥饿的开关。在他们的报表里，那不是苍生，那是待分配的卡路里配额。",
        appearEpoch: 7,
        expireEpoch: 9,
        marketVolatility: 0.16,
        aggression: 0.15,
        wealth: 3300,
        culturalTraits: {
            bureaucraticEfficiency: 0.18,
            infrastructureFirst: true,
            peacefulTrade: true,
        },
        economyTraits: {
            resourceBias: {
                food: 2.0,
                wood: 1.2,
                cloth: 1.1,
                coffee: 1.1,
                silver: 1.15,
                tools: 0.95,
            },
        },
        specialAbilities: [
            { type: 'food_security', desc: "粮食供应稳定" },
            { type: 'low_volatility', desc: "市场波动更低" }
        ],
    },
];
