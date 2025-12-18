// Epoch-specific Events - Events tied to specific historical eras
// Each epoch has 5 unique events with historical references and class conflicts

export const EPOCH_EVENTS = [
    // ==========================================
    // 石器时代 (Epoch 0) - Stone Age Events
    // ==========================================
    {
        id: 'mammoth_hunt',
        name: '猛犸象狩猎',
        icon: 'Target',
        image: null,
        description: '侦察兵发现了一头巨大的猛犸象！这是一次危险但回报丰厚的狩猎机会。整个部落都在讨论是否要组织这次狩猎。',
        triggerConditions: {
            minPopulation: 30,
            maxEpoch: 1,
        },
        options: [
            {
                id: 'full_hunt',
                text: '全族出动',
                description: '动员所有战士，确保成功但风险更大。',
                effects: {
                    resourcePercent: {
                        food: 0.015,
                    },
                    populationPercent: -0.015,
                    approval: {
                        soldier: 15,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 狩猎准备
                        wood: 0.03, // 制作工具
                    },
                    buildingProductionMod: {
                        lumber_camp: -0.05, // 劳动力转移
                        stone_tool_workshop: -0.05,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.3,
                        effects: {
                            resourcePercent: { food: 0.07 },
                            approval: { soldier: 20 },
                        },
                        description: '猎人们技艺高超，猛犸象被成功捕获，收获超出预期！',
                    },
                ],
            },
            {
                id: 'small_party',
                text: '精英小队',
                description: '只派最好的猎人，风险较低但收获也少。',
                effects: {
                    resourcePercent: {
                        food: 0.03,
                    },
                    approval: {
                        soldier: 10,
                    },
                    resourceDemandMod: {
                        food: 0.02, // 狩猎准备
                        wood: 0.01, // 制作工具
                    },
                    buildingProductionMod: {
                        stone_tool_workshop: -0.02,
                    },
                },
            },
            {
                id: 'let_it_go',
                text: '放弃狩猎',
                description: '猛犸象太危险了，不值得冒险。',
                effects: {
                    stability: 5,
                    approval: {
                        peasant: 5,
                        soldier: -10,
                    },
                    stratumDemandMod: {
                        soldier: -0.05, // 猎人不满
                    },
                },
            },
        ],
    },
    {
        id: 'fire_discovery',
        name: '火的秘密',
        icon: 'Flame',
        image: null,
        description: '一位老人声称掌握了"驯化"火焰的秘密。他愿意将这个知识传授给部落，但要求特殊的地位和供养。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'honor_elder',
                text: '尊敬长者',
                description: '给予他尊贵地位，学习火的奥秘。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                        food: -0.012,
                    },
                    approval: {
                        cleric: 15,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        food: 0.02, // 供养长者
                    },
                    buildingProductionMod: { all: 0.02 }, // 火的利用提升效率
                },
            },
            {
                id: 'force_knowledge',
                text: '强迫他交出知识',
                description: '知识应该属于所有人，不能被一人垄断。',
                effects: {
                    resourcePercent: {
                        science: 0.02,
                    },
                    stability: -10,
                    approval: {
                        cleric: -20,
                        soldier: 10,
                    },
                    buildingProductionMod: {
                        stone_tool_workshop: 0.03, // 知识传播
                    },
                },
            },
            {
                id: 'reject_offer',
                text: '拒绝他的条件',
                description: '我们不需要这种"魔法"。',
                effects: {
                    approval: {
                        cleric: -10,
                        soldier: 5,
                    },
                    stratumDemandMod: {
                        cleric: -0.05, // 长者不满
                    },
                },
            },
        ],
    },
    {
        id: 'cave_dispute',
        name: '洞穴争端',
        icon: 'Home',
        image: null,
        description: '两个家族为争夺一个宽敞温暖的洞穴而发生冲突。双方都声称这是他们祖先发现的。',
        triggerConditions: {
            minPopulation: 40,
            maxEpoch: 0,
        },
        options: [
            {
                id: 'favor_stronger',
                text: '判给强者',
                description: '强大的家族更能保卫洞穴。',
                effects: {
                    stability: -5,
                    approval: {
                        soldier: 15,
                        peasant: -10,
                    },
                    resourceDemandMod: {
                        stone: 0.08, // 建造材料
                        food: 0.05,
                    },
                },
            },
            {
                id: 'share_cave',
                text: '共同居住',
                description: '洞穴足够大，可以容纳两家人。',
                effects: {
                    stability: 5,
                    approval: {
                        peasant: 10,
                        soldier: -5,
                    },
                    stratumDemandMod: {
                        peasant: 0.03, // 和谐共处
                    },
                },
            },
            {
                id: 'build_new',
                text: '建造新住所',
                description: '动员大家建造新的住所，解决住房问题。',
                effects: {
                    resourcePercent: {
                        food: -0.02,
                    },
                    population: 2,
                    stability: 3,
                    approval: {
                        peasant: 15,
                        artisan: 10,
                    },
                    resourceDemandMod: {
                        wood: 0.05, // 建造新住所
                        stone: 0.03,
                    },
                },
            },
        ],
    },
    {
        id: 'shaman_ritual',
        name: '萨满仪式',
        icon: 'Star',
        image: null,
        description: '部落萨满宣称天象显示灾难将至，要求举行大型祭祀仪式。他需要大量的食物和祭品。',
        triggerConditions: {
            maxEpoch: 1,
        },
        options: [
            {
                id: 'grand_ritual',
                text: '举行盛大仪式',
                description: '相信萨满，投入资源进行祭祀。',
                effects: {
                    resourcePercent: {
                        food: -0.04,
                        culture: 0.02,
                    },
                    stability: 10,
                    approval: {
                        cleric: 25,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        culture: 0.1, // 祭祀活动
                        food: 0.05, // 祭品
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            stability: 15,
                            approval: { cleric: 15 },
                        },
                        description: '仪式后天气好转，人们相信是萨满的功劳！',
                    },
                ],
            },
            {
                id: 'simple_ritual',
                text: '简单祭祀',
                description: '进行较小规模的仪式，节省资源。',
                effects: {
                    resourcePercent: {
                        food: -0.012,
                        culture: 0.012,
                    },
                    approval: {
                        cleric: -5,
                    },
                    resourceDemandMod: {
                        culture: 0.03, // 祭祀活动
                        food: 0.02, // 祭品
                    },
                },
            },
            {
                id: 'ignore_shaman',
                text: '无视萨满',
                description: '这些预言不可信，我们靠自己的双手生存。',
                effects: {
                    stability: -5,
                    approval: {
                        cleric: -20,
                        soldier: 10,
                    },
                    stratumDemandMod: {
                        cleric: -0.1, // 萨满不满
                    },
                },
            },
        ],
    },
    {
        id: 'stone_tool_innovation',
        name: '石器革新',
        icon: 'Hammer',
        image: null,
        description: '一位年轻的工匠发明了一种新的打制石器方法，可以制作更锋利的工具。但部落长老认为这违背了祖先传下的方法。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'embrace_innovation',
                text: '接受创新',
                description: '新方法更好，应该推广使用。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                    },
                    approval: {
                        artisan: 20,
                        cleric: -15,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        wood: 0.02, // 制作新工具
                        stone: 0.03,
                    },
                },
            },
            {
                id: 'keep_tradition',
                text: '坚持传统',
                description: '祖先的智慧不能轻易抛弃。',
                effects: {
                    resourcePercent: {
                        culture: 0.02,
                    },
                    approval: {
                        cleric: 15,
                        artisan: -15,
                    },
                    stratumDemandMod: {
                        artisan: -0.08, // 工匠不满
                    },
                },
            },
            {
                id: 'test_first',
                text: '先行试验',
                description: '让工匠证明他的方法确实更好。',
                effects: {
                    resourcePercent: {
                        science: 0.02,
                        culture: 0.012,
                    },
                    approval: {
                        artisan: 10,
                        scribe: 10,
                    },
                    resourceDemandMod: {
                        wood: 0.01, // 试验消耗
                        stone: 0.01,
                    },
                },
            },
        ],
    },

    // === 新增石器时代事件 ===
    {
        id: 'wild_beast_taming',
        name: '驯服野兽',
        icon: 'Dog',
        image: null,
        description: '孩子们在营地外发现了一窝被遗弃的狼崽，它们瑟瑟发抖，眼神中满是惊恐。有人认为可以将它们养大成为狩猎的帮手，但老人们担心野性难驯，会给部落带来灾祸。',
        triggerConditions: {
            maxEpoch: 0,
            minPopulation: 20,
        },
        options: [
            {
                id: 'adopt_cubs',
                text: '收养狼崽',
                description: '精心喂养，尝试驯化它们。',
                effects: {
                    resourcePercent: { food: -0.02, science: 0.025 },
                    approval: { peasant: 8, soldier: 12 },
                    resourceDemandMod: { food: 0.03 },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: { resourcePercent: { food: 0.05 }, approval: { soldier: 15 } },
                        description: '狼崽长大后成为出色的猎犬，狩猎效率大增！',
                    },
                ],
            },
            {
                id: 'release_cubs',
                text: '放归荒野',
                description: '野兽终归属于荒野，让它们自由生活。',
                effects: { stability: 3, approval: { cleric: 10, peasant: 5 } },
            },
            {
                id: 'kill_cubs',
                text: '杀死狼崽',
                description: '狼是危险的敌人，斩草除根。',
                effects: { resourcePercent: { food: 0.01 }, stability: -3, approval: { soldier: 5, cleric: -15, peasant: -10 } },
            },
        ],
    },
    {
        id: 'sacred_cave_paintings',
        name: '神圣壁画',
        icon: 'Palette',
        image: null,
        description: '猎人们在深山中发现了一个隐秘的洞穴，里面满是用赭石和木炭绘制的神秘图案——奔跑的野牛、持矛的猎人、还有无法辨认的神秘符号。萨满认为这是祖先留下的神谕。',
        triggerConditions: { maxEpoch: 0 },
        options: [
            {
                id: 'sacred_site',
                text: '设为圣地',
                description: '将洞穴封存，只允许萨满进入祭祀。',
                effects: { resourcePercent: { culture: 0.04 }, stability: 8, approval: { cleric: 25, peasant: 5 } },
            },
            {
                id: 'study_paintings',
                text: '研究壁画',
                description: '让所有人都来观看学习，从中寻找狩猎的智慧。',
                effects: { resourcePercent: { science: 0.03, culture: 0.02 }, approval: { cleric: -10, artisan: 15, peasant: 10 } },
            },
            {
                id: 'add_own_paintings',
                text: '添加新画',
                description: '让我们的工匠也在洞穴中留下记录。',
                effects: { resourcePercent: { culture: 0.03, science: 0.02 }, approval: { artisan: 20, cleric: -5 } },
            },
        ],
    },
    {
        id: 'tribal_marriage',
        name: '部落联姻',
        icon: 'Heart',
        image: null,
        description: '河对岸的部落派来使者，带来了珍贵的贝壳和兽皮作为礼物。他们提议将首领的女儿嫁给你部落最勇敢的猎人，以建立两个部落之间的永久和平。',
        triggerConditions: { maxEpoch: 1, minPopulation: 25 },
        options: [
            {
                id: 'accept_marriage',
                text: '欣然接受',
                description: '这是和平与繁荣的开始。',
                effects: { populationPercent: 0.03, stability: 12, approval: { peasant: 15, cleric: 10 } },
            },
            {
                id: 'demand_more',
                text: '要求更多嫁妆',
                description: '我们的猎人很优秀，值得更多。',
                effects: { resourcePercent: { food: 0.02 }, stability: -5, approval: { soldier: 10, peasant: -5 } },
                randomEffects: [
                    { chance: 0.4, effects: { resourcePercent: { food: 0.03 } }, description: '对方同意了更多条件！' },
                    { chance: 0.3, effects: { stability: -10, approval: { peasant: -10 } }, description: '对方愤然离去，联姻破裂！' },
                ],
            },
            {
                id: 'refuse_marriage',
                text: '婉言拒绝',
                description: '我们不需要外族的介入。',
                effects: { stability: -3, approval: { soldier: 8, cleric: -8, peasant: -5 } },
            },
        ],
    },
    {
        id: 'great_flood_legend',
        name: '洪水传说',
        icon: 'Waves',
        image: null,
        description: '篝火边，白发苍苍的长老讲述着一个古老的故事：很久以前，天神降下滔天洪水，吞没了整个世界，只有一对夫妻乘着木筏活了下来。长老说，只有虔诚祭祀，才能避免灾难重演。',
        triggerConditions: { maxEpoch: 0 },
        options: [
            {
                id: 'grand_sacrifice',
                text: '举行大祭',
                description: '按照传说中的方式，向天神献祭。',
                effects: { resourcePercent: { food: -0.03, culture: 0.04 }, stability: 10, approval: { cleric: 20, peasant: 10 } },
            },
            {
                id: 'build_rafts',
                text: '建造木筏',
                description: '以防万一，先准备逃生工具。',
                effects: { resourcePercent: { wood: -0.03, science: 0.02 }, approval: { artisan: 15, peasant: 5 } },
            },
            {
                id: 'dismiss_legend',
                text: '只是故事而已',
                description: '这不过是老人们吓唬孩子的传说。',
                effects: { stability: -5, approval: { cleric: -20, soldier: 10 } },
            },
        ],
    },
    {
        id: 'first_pottery',
        name: '第一件陶器',
        icon: 'Cylinder',
        image: null,
        description: '一个女人在篝火边用泥巴捏了一个小碗来盛水。第二天早上，她惊讶地发现碗变得又硬又结实！这个发现引起了整个部落的好奇。',
        triggerConditions: { maxEpoch: 0 },
        options: [
            {
                id: 'encourage_pottery',
                text: '鼓励制陶',
                description: '让更多人学习这项技术。',
                effects: { resourcePercent: { science: 0.04 }, approval: { artisan: 20, peasant: 10 }, buildingProductionMod: { stone_tool_workshop: 0.1 } },
            },
            {
                id: 'sacred_craft',
                text: '神圣技艺',
                description: '这是神灵的恩赐，只有被选中的人才能制作。',
                effects: { resourcePercent: { culture: 0.03, science: 0.02 }, approval: { cleric: 15, artisan: -10 } },
            },
            {
                id: 'focus_hunting',
                text: '专注狩猎',
                description: '这种玩意儿不如多打些猎物实在。',
                effects: { stability: -3, approval: { soldier: 10, artisan: -15 } },
            },
        ],
    },
    {
        id: 'star_reader',
        name: '观星者',
        icon: 'Star',
        image: null,
        description: '一个年轻人每天晚上都仰望星空，记录星星的位置变化。他声称自己能从星象中预测季节更替和猎物迁徙。有人认为他是疯子，有人认为他是先知。',
        triggerConditions: { maxEpoch: 1 },
        options: [
            {
                id: 'support_stargazer',
                text: '支持他的研究',
                description: '给他食物和时间，让他继续观察。',
                effects: { resourcePercent: { food: -0.015, science: 0.05 }, approval: { scribe: 20, cleric: -5 }, buildingProductionMod: { all: 0.02 } },
            },
            {
                id: 'make_him_shaman',
                text: '让他成为萨满助手',
                description: '他的能力应该为神灵服务。',
                effects: { resourcePercent: { culture: 0.03, science: 0.02 }, approval: { cleric: 15, scribe: 5 } },
            },
            {
                id: 'force_work',
                text: '让他去干活',
                description: '做梦不能填饱肚子，该干活了。',
                effects: { stability: -3, approval: { scribe: -15, soldier: 8 } },
            },
        ],
    },
    {
        id: 'bone_oracle',
        name: '骨卜占卜',
        icon: 'Skull',
        image: null,
        description: '萨满将一块兽骨投入火中，随着噼啪声响，骨头上出现了神秘的裂纹。萨满盯着这些裂纹，脸色逐渐凝重——他说这预示着大事将要发生。',
        triggerConditions: { maxEpoch: 0 },
        options: [
            {
                id: 'follow_oracle',
                text: '遵从神谕',
                description: '让萨满解读神意，指导部落行动。',
                effects: { resourcePercent: { culture: 0.03 }, stability: 8, approval: { cleric: 20, peasant: 5 } },
                randomEffects: [
                    { chance: 0.5, effects: { resourcePercent: { food: 0.03 }, stability: 5 }, description: '萨满的预言应验了！部落对神灵更加虔诚。' },
                ],
            },
            {
                id: 'question_oracle',
                text: '质疑占卜',
                description: '这不过是被火烧裂的骨头而已。',
                effects: { resourcePercent: { science: 0.02 }, stability: -8, approval: { cleric: -25, soldier: 10 } },
            },
            {
                id: 'learn_divination',
                text: '学习占卜',
                description: '让更多人学习解读骨卜，不让知识被垄断。',
                effects: { resourcePercent: { science: 0.02, culture: 0.02 }, approval: { cleric: -10, scribe: 15 } },
            },
        ],
    },
    {
        id: 'rival_tribe_encounter',
        name: '遭遇敌对部落',
        icon: 'Swords',
        image: null,
        description: '狩猎队在山谷中与另一个部落的战士狭路相逢。对方人数与我们相当，双方剑拔弩张，一触即发。空气中弥漫着紧张的气息，每个人都在等待首领的命令。',
        triggerConditions: { maxEpoch: 1, minPopulation: 30 },
        options: [
            {
                id: 'attack_rivals',
                text: '先发制人',
                description: '趁他们没准备好，发起攻击！',
                effects: { populationPercent: -0.02, stability: -5, approval: { soldier: 20, peasant: -15 } },
                randomEffects: [
                    { chance: 0.5, effects: { resourcePercent: { food: 0.05 }, approval: { soldier: 15 } }, description: '战斗胜利！我们缴获了敌人的物资！' },
                    { chance: 0.3, effects: { populationPercent: -0.03, stability: -10 }, description: '战斗惨烈，双方都损失惨重...' },
                ],
            },
            {
                id: 'show_strength',
                text: '武力威慑',
                description: '展示我们的力量，但不主动攻击。',
                effects: { resourcePercent: { food: -0.01 }, stability: 3, approval: { soldier: 10, peasant: 5 } },
            },
            {
                id: 'peaceful_retreat',
                text: '和平撤退',
                description: '没有必要为此流血，我们可以从另一条路走。',
                effects: { stability: 5, approval: { soldier: -15, peasant: 15, cleric: 10 } },
            },
        ],
    },

    // ==========================================
    // 青铜时代 (Epoch 1) - Bronze Age Events
    // ==========================================
    {
        id: 'bronze_secret',
        name: '青铜秘方',
        icon: 'Gem',
        image: null,
        description: '一位外来的铸造师声称知道制作最坚固青铜的秘密配方。他愿意以高价出售这个秘密，或者以换取永久居留权和特权。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'buy_secret',
                text: '购买秘方',
                description: '支付大量银币获得知识。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                        science: 0.05,
                    },
                    approval: {
                        artisan: 20,
                        merchant: -10,
                    },
                    resourceDemandMod: {
                        copper: 0.15, // 购买秘方
                        silver: 0.05,
                    },
                },
            },
            {
                id: 'grant_citizenship',
                text: '授予公民权',
                description: '让他成为我们的一员，分享他的知识。',
                effects: {
                    resourcePercent: {
                        science: 0.04,
                    },
                    populationPercent: 0.015,
                    approval: {
                        artisan: 15,
                        landowner: -10,
                    },
                    stratumDemandMod: {
                        peasant: 0.05, // 获得部分权利
                    },
                },
            },
            {
                id: 'steal_secret',
                text: '偷取秘方',
                description: '派人暗中学习他的技术。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                    },
                    stability: -10,
                    approval: {
                        soldier: 10,
                        merchant: -15,
                    },
                    stratumDemandMod: {
                        merchant: -0.08, // 商业信誉受损
                    },
                },
            },
            {
                id: 'refuse_offer',
                text: '拒绝',
                description: '我们的工匠会自己研究出来。',
                effects: {
                    approval: {
                        artisan: 5,
                    },
                    stratumDemandMod: {
                        artisan: -0.03, // 错失良机
                    },
                },
            },
        ],
    },
    {
        id: 'writing_invention',
        name: '文字的诞生',
        icon: 'BookOpen',
        image: null,
        description: '神庙的祭司们发明了一套符号系统来记录祭祀和贡品。商人们希望也能使用这套系统来记账，但祭司认为这是神圣的知识。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'sacred_only',
                text: '仅限神圣用途',
                description: '文字是神的礼物，只能用于宗教事务。',
                effects: {
                    resourcePercent: {
                        culture: 0.04,
                    },
                    approval: {
                        cleric: 25,
                        merchant: -20,
                        scribe: -10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.1, // 神圣用途
                    },
                },
            },
            {
                id: 'limited_secular',
                text: '有限开放',
                description: '允许王室和高官使用，但仍由祭司控制。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                        science: 0.02,
                    },
                    approval: {
                        cleric: 5,
                        scribe: 15,
                        merchant: -5,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 有限开放
                    },
                },
            },
            {
                id: 'public_writing',
                text: '公开传授',
                description: '文字应该为所有人服务，推广读写教育。',
                effects: {
                    resourcePercent: {
                        science: 0.04,
                        culture: 0.015,
                    },
                    approval: {
                        cleric: -20,
                        merchant: 20,
                        scribe: 25,
                        artisan: 10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.2, // 推广读写
                    },
                },
            },
        ],
    },
    {
        id: 'irrigation_project',
        name: '灌溉工程',
        icon: 'Droplet',
        image: null,
        description: '农民们提议建造一条运河来灌溉农田，但这需要大量劳力。贵族们担心这会影响他们的劳动力供应，而农民则渴望增产。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 3,
        },
        options: [
            {
                id: 'forced_labor',
                text: '强制征发劳役',
                description: '命令所有平民参与建设。',
                effects: {
                    resourcePercent: {
                        food: 0.05,
                    },
                    stability: -15,
                    approval: {
                        landowner: 10,
                        peasant: -25,
                        artisan: -15,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 劳役消耗
                        wood: 0.05, // 简易工具
                    },
                },
            },
            {
                id: 'paid_workers',
                text: '雇佣工人',
                description: '支付工资，吸引自愿参与者。',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                        food: 0.04,
                    },
                    approval: {
                        peasant: 15,
                        artisan: 10,
                        merchant: -5,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 支付工资
                        food: 0.03, // 雇佣工人
                    },
                },
            },
            {
                id: 'noble_contribution',
                text: '贵族分担',
                description: '要求贵族贡献劳力和资源。',
                effects: {
                    resourcePercent: {
                        food: 0.035,
                    },
                    approval: {
                        landowner: -20,
                        peasant: 20,
                    },
                    resourceDemandMod: {
                        food: 0.02, // 贵族贡献
                        silver: 0.01,
                    },
                },
            },
            {
                id: 'postpone_project',
                text: '暂缓工程',
                description: '现在不是建设的好时机。',
                effects: {
                    approval: {
                        peasant: -10,
                        landowner: 5,
                    },
                    stratumDemandMod: {
                        peasant: -0.05, // 农民不满
                    },
                },
            },
        ],
    },
    {
        id: 'slave_rebellion_bronze',
        name: '奴隶起义',
        icon: 'Users',
        image: null,
        description: '矿山的奴隶们发动了起义，他们杀死了监工，占领了矿区。他们要求获得自由，否则将破坏矿山设施。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 3,
        },
        options: [
            {
                id: 'crush_rebellion',
                text: '武力镇压',
                description: '派军队镇压起义，恢复秩序。',
                effects: {
                    stability: -10,
                    populationPercent: -0.03,
                    approval: {
                        soldier: 15,
                        landowner: 20,
                        peasant: -20,
                    },
                    resourceDemandMod: {
                        tools: 0.1, // 镇压消耗
                        food: 0.05,
                    },
                },
            },
            {
                id: 'negotiate_freedom',
                text: '谈判解放',
                description: '释放部分奴隶，换取和平解决。',
                effects: {
                    populationPercent: 0.05,
                    approval: {
                        landowner: -25,
                        peasant: 15,
                        artisan: 10,
                    },
                    resourceDemandMod: {
                        food: 0.08, // 释放奴隶
                        silver: 0.03,
                    },
                },
            },
            {
                id: 'improve_conditions',
                text: '改善待遇',
                description: '承诺改善奴隶待遇，但不给予自由。',
                effects: {
                    resourcePercent: {
                        food: -0.02,
                    },
                    stability: 5,
                    approval: {
                        landowner: -10,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 改善待遇
                    },
                },
            },
        ],
    },
    {
        id: 'city_state_alliance',
        name: '城邦联盟',
        icon: 'Handshake',
        image: null,
        description: '周边的几个城邦提议建立一个贸易和防御联盟。这将带来贸易利益，但也意味着在战争时必须援助盟友。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 3,
        },
        options: [
            {
                id: 'join_alliance',
                text: '加入联盟',
                description: '成为联盟的正式成员。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: 10,
                    approval: {
                        merchant: 20,
                        landowner: 10,
                        soldier: -10,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 联盟贡献
                        tools: 0.03, // 军事义务
                    },
                },
            },
            {
                id: 'trade_only',
                text: '仅参与贸易',
                description: '只参与经济合作，不承担军事义务。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    approval: {
                        merchant: 15,
                        soldier: 5,
                    },
                    resourceDemandMod: {
                        silver: 0.03, // 贸易合作
                    },
                },
            },
            {
                id: 'refuse_alliance',
                text: '拒绝联盟',
                description: '保持独立，不受他人约束。',
                effects: {
                    stability: -5,
                    approval: {
                        soldier: 15,
                        merchant: -15,
                    },
                    stratumDemandMod: {
                        merchant: -0.08, // 错失贸易机会
                    },
                },
            },
        ],
    },

    // ==========================================
    // 古典时代 (Epoch 2) - Classical Age Events
    // ==========================================
    {
        id: 'philosophy_school',
        name: '哲学学派之争',
        icon: 'BookOpen',
        image: null,
        description: '城市中出现了两个相互对立的哲学学派。一派主张理性至上，一派强调传统美德。两派的辩论已经演变成街头冲突。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'support_rationalists',
                text: '支持理性派',
                description: '理性和知识是进步的基础。',
                effects: {
                    resourcePercent: {
                        science: 0.05,
                        culture: 0.02,
                    },
                    approval: {
                        scribe: 25,
                        cleric: -20,
                        merchant: 10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.1, // 哲学著作
                        culture: 0.05,
                    },
                },
            },
            {
                id: 'support_traditionalists',
                text: '支持传统派',
                description: '祖先的美德才是社会的基石。',
                effects: {
                    resourcePercent: {
                        culture: 0.05,
                    },
                    stability: 10,
                    approval: {
                        cleric: 20,
                        scribe: -15,
                        landowner: 15,
                    },
                    resourceDemandMod: {
                        culture: 0.08, // 传统美德
                    },
                },
            },
            {
                id: 'public_debate',
                text: '举办公开辩论',
                description: '让两派公平竞争，由民众评判。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                        science: 0.03,
                    },
                    approval: {
                        scribe: 15,
                        cleric: 5,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 辩论记录
                    },
                },
            },
            {
                id: 'ban_both',
                text: '禁止两派',
                description: '哲学争论危害社会稳定。',
                effects: {
                    stability: 15,
                    approval: {
                        scribe: -30,
                        cleric: -10,
                        soldier: 10,
                    },
                    stratumDemandMod: {
                        scribe: -0.15, // 思想禁锢
                    },
                },
            },
        ],
    },
    {
        id: 'olympic_games',
        name: '运动会提案',
        icon: 'Trophy',
        image: null,
        description: '贵族们提议举办一场盛大的运动会，各城邦派遣最优秀的运动员参赛。这将耗费大量资源，但能增强国家声望。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'grand_games',
                text: '举办盛大运动会',
                description: '不惜代价展示国家实力。',
                effects: {
                    resourcePercent: {
                        silver: -0.04,
                        culture: 0.08,
                    },
                    stability: 15,
                    approval: {
                        landowner: 20,
                        soldier: 25,
                        peasant: 15,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 运动员和观众
                        silver: 0.05, // 组织费用
                    },
                },
            },
            {
                id: 'modest_games',
                text: '举办适度规模',
                description: '量力而行，不过度铺张。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                        culture: 0.04,
                    },
                    stability: 5,
                    approval: {
                        soldier: 15,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 运动员和观众
                        silver: 0.02, // 组织费用
                    },
                },
            },
            {
                id: 'decline_hosting',
                text: '拒绝主办',
                description: '资源应该用在更重要的事情上。',
                effects: {
                    approval: {
                        landowner: -15,
                        soldier: -10,
                        merchant: 10,
                    },
                    stratumDemandMod: {
                        landowner: -0.08, // 贵族不满
                    },
                },
            },
        ],
    },
    {
        id: 'democratic_reform',
        name: '民主改革呼声',
        icon: 'Vote',
        image: null,
        description: '城市的自由民要求参与政治决策，他们聚集在广场上，要求建立公民大会制度。贵族们强烈反对这种"暴民政治"。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'full_democracy',
                text: '建立公民大会',
                description: '让所有公民参与重大决策。',
                effects: {
                    stability: -10,
                    approval: {
                        peasant: 30,
                        artisan: 25,
                        merchant: 20,
                        landowner: -30,
                        cleric: -15,
                    },
                    resourceDemandMod: {
                        papyrus: 0.15, // 法律文件
                    },
                },
            },
            {
                id: 'limited_representation',
                text: '有限代表制',
                description: '设立代表机构，但保留贵族特权。',
                effects: {
                    stability: 5,
                    approval: {
                        peasant: 10,
                        artisan: 15,
                        landowner: -10,
                    },
                    resourceDemandMod: {
                        food: 0.03, // 供养新居民
                    },
                },
            },
            {
                id: 'reject_democracy',
                text: '维持现状',
                description: '政治是贵族的事务，平民无权置喙。',
                effects: {
                    stability: -5,
                    approval: {
                        landowner: 20,
                        peasant: -25,
                        artisan: -20,
                    },
                    stratumDemandMod: {
                        peasant: -0.1, // 农民不满
                    },
                },
            },
        ],
    },
    {
        id: 'theatrical_competition',
        name: '戏剧竞赛',
        icon: 'Drama',
        image: null,
        description: '戏剧节即将来临，但今年的参赛作品引发了争议。一部讽刺当权者的喜剧和一部歌颂英雄的悲剧同时入围。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'allow_satire',
                text: '允许讽刺剧',
                description: '艺术自由高于一切，即使是批评当权者。',
                effects: {
                    resourcePercent: {
                        culture: 0.04,
                    },
                    stability: -5,
                    approval: {
                        scribe: 25,
                        peasant: 15,
                        landowner: -15,
                    },
                    resourceDemandMod: {
                        culture: 0.1, // 戏剧创作
                    },
                },
            },
            {
                id: 'only_heroic',
                text: '只允许英雄剧',
                description: '戏剧应该歌颂美德，而非嘲笑权威。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                    },
                    stability: 10,
                    approval: {
                        landowner: 15,
                        soldier: 10,
                        scribe: -20,
                    },
                    stratumDemandMod: {
                        scribe: -0.1, // 艺术受限
                    },
                },
            },
            {
                id: 'fair_competition',
                text: '公平竞争',
                description: '让观众的欢呼声决定胜负。',
                effects: {
                    resourcePercent: {
                        culture: 0.04,
                    },
                    approval: {
                        scribe: 15,
                        peasant: 10,
                        merchant: 10,
                    },
                    resourceDemandMod: {
                        culture: 0.08, // 艺术繁荣
                    },
                },
            },
        ],
    },
    {
        id: 'gladiator_question',
        name: '角斗士制度',
        icon: 'Swords',
        image: null,
        description: '角斗表演越来越受欢迎，但一些人认为这种血腥娱乐有损国家形象。角斗士们自己也在要求改善待遇。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'expand_games',
                text: '扩大角斗规模',
                description: '人民需要娱乐，这有助于稳定。',
                effects: {
                    resourcePercent: {
                        silver: -0.012,
                    },
                    stability: 15,
                    approval: {
                        peasant: 20,
                        soldier: 15,
                        cleric: -15,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 角斗士和观众
                        tools: 0.05, // 武器
                    },
                },
            },
            {
                id: 'reform_games',
                text: '改革角斗制度',
                description: '减少致死场次，给予角斗士赎身机会。',
                effects: {
                    resourcePercent: {
                        silver: -0.028,
                    },
                    stability: 5,
                    approval: {
                        cleric: 10,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        stone: 0.05, // 建造材料
                        tools: 0.03,
                    },
                },
            },
            {
                id: 'abolish_games',
                text: '废除角斗',
                description: '这种野蛮行为应该被禁止。',
                effects: {
                    stability: -10,
                    approval: {
                        cleric: 25,
                        peasant: -20,
                        soldier: -15,
                    },
                    stratumDemandMod: {
                        peasant: -0.1, // 娱乐减少
                    },
                },
            },
        ],
    },

    // ==========================================
    // 封建时代 (Epoch 3) - Feudal Age Events
    // ==========================================
    {
        id: 'crusade_call',
        name: '十字军召唤',
        icon: 'Cross',
        image: null,
        description: '教会号召发动一场圣战，收复圣地。贵族们渴望荣耀和土地，但战争也意味着巨大的人员和财富损失。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'lead_crusade',
                text: '领导十字军',
                description: '亲自带领大军出征，追求最高荣耀。',
                effects: {
                    resourcePercent: {
                        silver: -0.012,
                        culture: 0.06,
                    },
                    populationPercent: -0.025,
                    approval: {
                        cleric: 30,
                        soldier: 25,
                        landowner: 15,
                        peasant: -20,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 军队补给
                        tools: 0.08, // 武器
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            resourcePercent: { silver: 0.08, culture: 0.05 },
                            approval: { soldier: 20 },
                        },
                        description: '十字军大获全胜，带回了大量财宝和圣物！',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            populationPercent: -0.012,
                            stability: -15,
                        },
                        description: '远征遭遇惨败，大量士兵丧生异乡...',
                    },
                ],
            },
            {
                id: 'send_army',
                text: '派遣军队',
                description: '派部分军队参与，但不亲自出征。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                        culture: 0.03,
                    },
                    populationPercent: -0.012,
                    approval: {
                        cleric: 15,
                        soldier: 10,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 军队补给
                        tools: 0.03, // 武器
                    },
                },
            },
            {
                id: 'financial_support',
                text: '只提供资金',
                description: '捐赠金钱支持圣战，但不派兵。',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                    },
                    approval: {
                        cleric: 10,
                        soldier: -10,
                        merchant: -5,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 资金支持
                    },
                },
            },
            {
                id: 'refuse_crusade',
                text: '拒绝参与',
                description: '我们有自己的事务要处理。',
                effects: {
                    approval: {
                        cleric: -25,
                        soldier: -15,
                        merchant: 15,
                        peasant: 10,
                    },
                    stratumDemandMod: {
                        cleric: -0.1, // 教会不满
                    },
                },
            },
        ],
    },
    {
        id: 'black_death',
        name: '黑死病',
        icon: 'Skull',
        image: null,
        description: '一种可怕的瘟疫开始在城市蔓延，人们惊恐地死去，街道上到处是尸体。医生束手无策，人们开始寻找替罪羊。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
        },
        options: [
            {
                id: 'quarantine',
                text: '严格隔离',
                description: '封锁疫区，禁止人员流动。',
                effects: {
                    populationPercent: -0.012,
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: -10,
                    approval: {
                        merchant: -25,
                        peasant: -10,
                        cleric: 10,
                    },
                    resourceDemandMod: {
                        cloth: 0.1, // 隔离用品
                        food: 0.05, // 隔离区补给
                    },
                },
            },
            {
                id: 'blame_outsiders',
                text: '驱逐外来者',
                description: '将瘟疫归咎于外来者，驱逐他们。',
                effects: {
                    populationPercent: -0.02,
                    stability: 5,
                    approval: {
                        peasant: 10,
                        merchant: -20,
                        cleric: -10,
                    },
                    stratumDemandMod: {
                        merchant: -0.1, // 商业受损
                    },
                },
            },
            {
                id: 'prayer_procession',
                text: '举行祈祷游行',
                description: '通过宗教仪式祈求神灵保佑。',
                effects: {
                    populationPercent: -0.025,
                    resourcePercent: {
                        culture: 0.02,
                    },
                    approval: {
                        cleric: 25,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        culture: 0.08, // 宗教仪式
                    },
                },
            },
            {
                id: 'medical_research',
                text: '研究治疗方法',
                description: '召集医生研究瘟疫，寻找治愈方法。',
                effects: {
                    populationPercent: -0.015,
                    resourcePercent: {
                        silver: -0.03,
                        science: 0.04,
                    },
                    approval: {
                        scribe: 20,
                        cleric: -15,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 医疗记录
                        silver: 0.03, // 医疗开销
                    },
                },
            },
        ],
    },
    {
        id: 'peasant_revolt_feudal',
        name: '农民起义',
        icon: 'Pitchfork',
        image: null,
        description: '不堪重负的农民们拿起草叉和镰刀，在一位神秘领袖的带领下起义了。他们要求减免税赋，废除农奴制度。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            classConditions: {
                peasant: { maxApproval: 30 },
            },
        },
        options: [
            {
                id: 'crush_revolt',
                text: '武力镇压',
                description: '派骑士镇压这些叛乱的农奴。',
                effects: {
                    populationPercent: -0.02,
                    stability: -15,
                    approval: {
                        landowner: 25,
                        soldier: 15,
                        peasant: -35,
                    },
                    resourceDemandMod: {
                        tools: 0.15, // 镇压消耗
                        food: 0.08,
                    },
                },
            },
            {
                id: 'negotiate_terms',
                text: '谈判让步',
                description: '减免部分税赋，换取和平。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: 10,
                    approval: {
                        peasant: 25,
                        landowner: -20,
                        artisan: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 谈判让步
                        food: 0.03,
                    },
                },
            },
            {
                id: 'promise_reforms',
                text: '承诺改革',
                description: '答应改革，但暗中准备秋后算账。',
                effects: {
                    stability: 5,
                    approval: {
                        peasant: 10,
                    },
                    stratumDemandMod: {
                        peasant: 0.05, // 暂时安抚
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            stability: -20,
                            approval: { peasant: -30 },
                        },
                        description: '农民发现承诺是骗局，起义再度爆发且更加激烈！',
                    },
                ],
            },
        ],
    },
    {
        id: 'cathedral_construction',
        name: '大教堂工程',
        icon: 'Church',
        image: null,
        description: '主教提议建造一座宏伟的大教堂，以彰显上帝的荣耀和国家的虔诚。这将是一项跨越数代人的工程。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
        },
        options: [
            {
                id: 'grand_cathedral',
                text: '建造宏伟教堂',
                description: '不惜代价建造最壮观的教堂。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                        culture: 0.08,
                    },
                    approval: {
                        cleric: 35,
                        artisan: 20,
                        peasant: -10,
                        merchant: -15,
                    },
                },
            },
            {
                id: 'modest_church',
                text: '建造朴素教堂',
                description: '建一座实用的教堂就足够了。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                        culture: 0.03,
                    },
                    approval: {
                        cleric: 10,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 改善待遇
                        silver: 0.02, // 赎身费用
                    },
                },
            },
            {
                id: 'secular_building',
                text: '建造世俗建筑',
                description: '资源应该用于市政建设，而非宗教。',
                effects: {
                    resourcePercent: {
                        silver: -0.04,
                        science: 0.03,
                    },
                    approval: {
                        cleric: -25,
                        merchant: 20,
                        artisan: 15,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 市政建设
                        brick: 0.05,
                    },
                },
            },
        ],
    },
    {
        id: 'guild_monopoly',
        name: '行会特权',
        icon: 'Shield',
        image: null,
        description: '城市的行会要求获得独家生产权，禁止非行会成员从事相关行业。商人们抱怨这会提高物价，年轻工匠则抱怨入会门槛太高。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
        },
        options: [
            {
                id: 'grant_monopoly',
                text: '授予垄断权',
                description: '支持行会，保证产品质量。',
                effects: {
                    resourcePercent: {
                        culture: 0.02,
                    },
                    stability: 10,
                    approval: {
                        artisan: 25,
                        merchant: -20,
                        peasant: -10,
                    },
                    resourceDemandMod: {
                        tools: 0.1, // 行会生产
                        cloth: 0.05,
                    },
                },
            },
            {
                id: 'break_monopoly',
                text: '打破垄断',
                description: '开放市场，允许自由竞争。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    approval: {
                        artisan: -25,
                        merchant: 25,
                        peasant: 15,
                    },
                    resourceDemandMod: {
                        tools: 0.08, // 自由竞争
                        cloth: 0.03,
                    },
                },
            },
            {
                id: 'regulate_guilds',
                text: '规范行会',
                description: '保留行会，但限制其特权。',
                effects: {
                    stability: 5,
                    approval: {
                        artisan: -5,
                        merchant: 10,
                        peasant: 5,
                    },
                    stratumDemandMod: {
                        artisan: -0.03, // 妥协
                    },
                },
            },
        ],
    },

    // ==========================================
    // 探索时代 (Epoch 4) - Age of Exploration Events
    // ==========================================
    {
        id: 'new_world_discovery',
        name: '新大陆发现',
        icon: 'Compass',
        image: null,
        description: '探险家们报告发现了一片未知的大陆！那里有丰富的资源和原住民。问题是如何处理这片新领土和当地人。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'colonize_aggressively',
                text: '武力殖民',
                description: '征服原住民，掠夺资源。',
                effects: {
                    resourcePercent: {
                        silver: 0.02,
                        food: 0.015,
                    },
                    stability: -10,
                    approval: {
                        soldier: 20,
                        merchant: 25,
                        cleric: -20,
                        peasant: -10,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 殖民者补给
                        tools: 0.08, // 武器
                    },
                },
            },
            {
                id: 'trade_relations',
                text: '建立贸易关系',
                description: '与原住民和平贸易，互通有无。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                        culture: 0.03,
                    },
                    approval: {
                        merchant: 30,
                        cleric: 10,
                        soldier: -10,
                    },
                    resourceDemandMod: {
                        spice: 0.1, // 贸易商品
                        silver: 0.05,
                    },
                },
            },
            {
                id: 'missionary_work',
                text: '传教为先',
                description: '先派传教士，以宗教感化原住民。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                        culture: 0.05,
                    },
                    approval: {
                        cleric: 30,
                        merchant: 5,
                    },
                    resourceDemandMod: {
                        culture: 0.1, // 传教活动
                    },
                },
            },
            {
                id: 'limited_contact',
                text: '限制接触',
                description: '建立少数贸易站，避免深度介入。',
                effects: {
                    resourcePercent: {
                        silver: 0.02,
                    },
                    stability: 5,
                    approval: {
                        merchant: 10,
                        cleric: 5,
                    },
                    resourceDemandMod: {
                        spice: 0.05, // 贸易商品
                    },
                },
            },
        ],
    },
    {
        id: 'printing_revolution',
        name: '印刷革命',
        icon: 'Book',
        image: null,
        description: '新发明的印刷术可以大量复制书籍，知识的传播将发生革命性变化。但教会担心异端思想会因此泛滥。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'embrace_printing',
                text: '推广印刷术',
                description: '支持新技术，传播知识。',
                effects: {
                    resourcePercent: {
                        science: 0.06,
                        culture: 0.04,
                    },
                    approval: {
                        scribe: 30,
                        merchant: 20,
                        cleric: -25,
                    },
                    resourceDemandMod: {
                        papyrus: 0.15, // 印刷材料
                    },
                },
            },
            {
                id: 'church_control',
                text: '教会审查',
                description: '允许印刷，但由教会审查内容。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                        culture: 0.02,
                    },
                    approval: {
                        cleric: 15,
                        scribe: -10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 审查
                    },
                },
            },
            {
                id: 'ban_printing',
                text: '禁止印刷',
                description: '这种技术会动摇社会秩序。',
                effects: {
                    stability: 10,
                    approval: {
                        cleric: 20,
                        scribe: -35,
                        merchant: -20,
                    },
                    stratumDemandMod: {
                        scribe: -0.15, // 思想禁锢
                    },
                },
            },
        ],
    },
    {
        id: 'reformation_movement',
        name: '宗教改革',
        icon: 'ScrollText',
        image: null,
        description: '一位神学家公开质疑教会的权威，他的观点正在迅速传播。支持者和反对者之间的冲突越来越激烈。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'support_reformers',
                text: '支持改革',
                description: '教会确实需要改革和净化。',
                effects: {
                    resourcePercent: {
                        culture: 0.05,
                    },
                    stability: -20,
                    approval: {
                        cleric: -30,
                        scribe: 25,
                        merchant: 20,
                        peasant: 15,
                    },
                },
            },
            {
                id: 'support_church',
                text: '支持教会',
                description: '维护传统权威，镇压异端。',
                effects: {
                    resourcePercent: {
                        culture: 0.02,
                    },
                    stability: 10,
                    approval: {
                        cleric: 30,
                        scribe: -20,
                        peasant: -10,
                    },
                    stratumDemandMod: {
                        scribe: -0.1, // 压制改革
                    },
                },
            },
            {
                id: 'allow_both',
                text: '允许两派共存',
                description: '宣布宗教宽容，两派都可信仰。',
                effects: {
                    stability: -10,
                    approval: {
                        cleric: -15,
                        scribe: 15,
                        merchant: 25,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.08, // 纳贡费用
                    },
                },
            },
        ],
    },
    {
        id: 'spice_trade_war',
        name: '香料战争',
        icon: 'Anchor',
        image: null,
        description: '控制东方香料贸易的商路成为列强争夺的焦点。我们的商人要求政府支持他们打破竞争对手的垄断。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'naval_war',
                text: '发动海战',
                description: '用武力打开贸易通道。',
                effects: {
                    resourcePercent: {
                        silver: -0.04,
                    },
                    populationPercent: -0.012,
                    approval: {
                        merchant: 25,
                        soldier: 20,
                        peasant: -15,
                    },
                    resourceDemandMod: {
                        tools: 0.15, // 军事消耗
                        silver: 0.08, // 战争开销
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            resourcePercent: { silver: 0.08 },
                        },
                        description: '海战胜利！我们获得了香料贸易的优势地位。',
                    },
                ],
            },
            {
                id: 'trade_company',
                text: '成立贸易公司',
                description: '组建国家支持的贸易公司。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                    },
                    approval: {
                        merchant: 30,
                        landowner: -10,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 公司投资
                        plank: 0.05, // 造船
                    },
                },
            },
            {
                id: 'find_alternative',
                text: '寻找替代路线',
                description: '资助探险家寻找新的贸易路线。',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                        science: 0.03,
                    },
                    approval: {
                        merchant: 15,
                        scribe: 15,
                    },
                    resourceDemandMod: {
                        silver: 0.03, // 探险费用
                        science: 0.02,
                    },
                },
            },
        ],
    },
    {
        id: 'witch_trials',
        name: '女巫审判',
        icon: 'Flame',
        image: null,
        description: '人们声称发现了女巫，恐惧在城镇中蔓延。宗教法庭要求进行审判，但一些人质疑这些指控的真实性。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 5,
        },
        options: [
            {
                id: 'full_trials',
                text: '支持审判',
                description: '清除女巫是保护社会的必要之举。',
                effects: {
                    populationPercent: -0.01,
                    stability: 5,
                    approval: {
                        cleric: 25,
                        peasant: 10,
                        scribe: -25,
                    },
                    resourceDemandMod: {
                        culture: 0.1, // 迷信活动
                    },
                },
            },
            {
                id: 'proper_investigation',
                text: '要求证据',
                description: '审判必须有确凿证据，不能仅凭指控。',
                effects: {
                    resourcePercent: {
                        science: 0.02,
                    },
                    approval: {
                        scribe: 20,
                        cleric: -10,
                        peasant: -5,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 调查费用
                    },
                },
            },
            {
                id: 'stop_trials',
                text: '停止审判',
                description: '这是迷信和迫害，必须停止。',
                effects: {
                    stability: -10,
                    approval: {
                        cleric: -30,
                        scribe: 30,
                        peasant: -15,
                    },
                    stratumDemandMod: {
                        cleric: -0.15, // 教会不满
                    },
                },
            },
        ],
    },

    // ==========================================
    // 启蒙时代 (Epoch 5) - Age of Enlightenment Events
    // ==========================================
    {
        id: 'encyclopedie',
        name: '百科全书计划',
        icon: 'Library',
        image: null,
        description: '一群学者提议编纂一部包含所有人类知识的百科全书。这将是启蒙运动的里程碑，但也会传播"危险"的思想。',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'fund_encyclopedia',
                text: '资助编纂',
                description: '支持这项伟大的知识工程。',
                effects: {
                    resourcePercent: {
                        silver: -0.05,
                        science: 0.08,
                        culture: 0.06,
                    },
                    approval: {
                        scribe: 35,
                        merchant: 15,
                        cleric: -25,
                        landowner: -15,
                    },
                    resourceDemandMod: {
                        papyrus: 0.15, // 知识传播
                        silver: 0.05, // 资助
                    },
                },
            },
            {
                id: 'censored_version',
                text: '资助但审查',
                description: '支持编纂，但删除敏感内容。',
                effects: {
                    resourcePercent: {
                        silver: -0.04,
                        science: 0.05,
                        culture: 0.03,
                    },
                    approval: {
                        scribe: 5,
                        cleric: 5,
                    },
                    resourceDemandMod: {
                        papyrus: 0.08, // 审查成本
                    },
                },
            },
            {
                id: 'ban_encyclopedia',
                text: '禁止编纂',
                description: '这种知识传播会动摇社会秩序。',
                effects: {
                    stability: 5,
                    approval: {
                        cleric: 20,
                        landowner: 15,
                        scribe: -35,
                        merchant: -15,
                    },
                    stratumDemandMod: {
                        scribe: -0.15, // 思想禁锢
                    },
                },
            },
        ],
    },
    {
        id: 'salon_culture',
        name: '沙龙文化',
        icon: 'Users',
        image: null,
        description: '贵族府邸中的沙龙成为思想交流的中心，哲学家、作家和科学家在这里自由讨论。但这些讨论有时涉及敏感的政治话题。',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'encourage_salons',
                text: '鼓励沙龙',
                description: '自由的思想交流有益于文化发展。',
                effects: {
                    resourcePercent: {
                        culture: 0.05,
                        science: 0.03,
                    },
                    stability: -5,
                    approval: {
                        scribe: 25,
                        landowner: 15,
                        cleric: -15,
                    },
                    resourceDemandMod: {
                        coffee: 0.1, // 咖啡消费
                        delicacies: 0.05,
                    },
                },
            },
            {
                id: 'monitor_salons',
                text: '监控沙龙',
                description: '允许沙龙存在，但安插眼线。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                        science: 0.02,
                    },
                    approval: {
                        scribe: -10,
                        landowner: 5,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 监控成本
                    },
                },
            },
            {
                id: 'ban_salons',
                text: '禁止私人聚会',
                description: '这些聚会是阴谋的温床。',
                effects: {
                    stability: 10,
                    approval: {
                        scribe: -30,
                        landowner: -20,
                        cleric: 10,
                    },
                    stratumDemandMod: {
                        scribe: -0.15, // 思想压制
                    },
                },
            },
        ],
    },
    {
        id: 'social_contract',
        name: '社会契约论',
        icon: 'FileText',
        image: null,
        description: '一本名为《社会契约论》的书正在知识分子中广泛传播。它宣称政府的权力来自人民的同意，而非神授。',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'embrace_ideas',
                text: '接受这些理念',
                description: '政府确实应该服务于人民。',
                effects: {
                    resourcePercent: {
                        culture: 0.04,
                    },
                    stability: -15,
                    approval: {
                        scribe: 30,
                        peasant: 25,
                        artisan: 20,
                        landowner: -25,
                        cleric: -20,
                    },
                    resourceDemandMod: {
                        papyrus: 0.15, // 理论传播
                    },
                },
            },
            {
                id: 'academic_only',
                text: '限于学术讨论',
                description: '允许学术研究，但禁止政治宣传。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                    },
                    approval: {
                        scribe: 10,
                        landowner: -5,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 学术研究
                    },
                },
            },
            {
                id: 'burn_books',
                text: '焚毁此书',
                description: '这是颠覆性的危险思想。',
                effects: {
                    stability: 10,
                    approval: {
                        cleric: 20,
                        landowner: 15,
                        scribe: -40,
                        peasant: -15,
                    },
                    stratumDemandMod: {
                        scribe: -0.2, // 思想压制
                    },
                },
            },
        ],
    },
    {
        id: 'scientific_academy',
        name: '皇家科学院',
        icon: 'Microscope',
        image: null,
        description: '科学家们请求建立一个由国家资助的科学院，系统地研究自然世界。这将需要大量资金，但可能带来技术进步。',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'grand_academy',
                text: '建立宏大的科学院',
                description: '大力投资科学研究。',
                effects: {
                    resourcePercent: {
                        silver: -0.05,
                        science: 0.08,
                    },
                    approval: {
                        scribe: 35,
                        merchant: 15,
                        landowner: -10,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 资助
                        papyrus: 0.1, // 研究材料
                    },
                },
            },
            {
                id: 'modest_academy',
                text: '建立小型研究所',
                description: '适度投资，逐步发展。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                        science: 0.05,
                    },
                    approval: {
                        scribe: 20,
                    },
                },
            },
            {
                id: 'private_funding',
                text: '鼓励私人资助',
                description: '让富人和商人赞助科学研究。',
                effects: {
                    resourcePercent: {
                        science: 0.03,
                    },
                    approval: {
                        merchant: 15,
                        scribe: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 私人资助
                    },
                },
            },
        ],
    },
    {
        id: 'vaccination_debate',
        name: '疫苗争议',
        icon: 'Syringe',
        image: null,
        description: '医生发明了一种预防天花的方法——接种牛痘。这种方法有效但争议巨大，许多人认为这是"不自然的"，甚至是亵渎神灵。',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
        },
        options: [
            {
                id: 'mandatory_vaccination',
                text: '强制接种',
                description: '为了公共健康，所有人都应该接种。',
                effects: {
                    population: 30,
                    resourcePercent: {
                        silver: -0.035,
                        science: 0.04,
                    },
                    approval: {
                        scribe: 25,
                        cleric: -25,
                        peasant: -15,
                    },
                    resourceDemandMod: {
                        silver: 0.03, // 疫苗成本
                        science: 0.02,
                    },
                },
            },
            {
                id: 'voluntary_vaccination',
                text: '自愿接种',
                description: '提供接种服务，但不强制。',
                effects: {
                    populationPercent: 0.04,
                    resourcePercent: {
                        silver: -0.012,
                        science: 0.03,
                    },
                    approval: {
                        scribe: 15,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        silver: 0.01, // 疫苗成本
                        science: 0.01,
                    },
                },
            },
            {
                id: 'ban_vaccination',
                text: '禁止接种',
                description: '这种做法违反自然法则。',
                effects: {
                    approval: {
                        cleric: 20,
                        peasant: 10,
                        scribe: -30,
                    },
                    stratumDemandMod: {
                        scribe: -0.15, // 科学受阻
                    },
                },
            },
        ],
    },

    // ==========================================
    // 工业时代 (Epoch 6) - Industrial Age Events
    // ==========================================
    {
        id: 'factory_conditions',
        name: '工厂劳动条件',
        icon: 'Factory',
        image: null,
        description: '工厂工人的恶劣劳动条件引发了公众关注。童工、超长工时和危险环境成为改革者攻击的目标。工厂主则警告说规制会损害竞争力。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'strict_regulation',
                text: '严格立法',
                description: '禁止童工，限制工时，强制安全标准。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: 10,
                    approval: {
                        worker: 35,
                        artisan: 20,
                        merchant: -25,
                        landowner: -15,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 监管成本
                        tools: 0.05, // 安全设备
                    },
                },
            },
            {
                id: 'mild_reform',
                text: '温和改革',
                description: '部分改善条件，但不影响生产。',
                effects: {
                    resourcePercent: {
                        silver: -0.012,
                    },
                    approval: {
                        worker: 15,
                        merchant: -5,
                    },
                    resourceDemandMod: {
                        silver: 0.01, // 改革成本
                    },
                },
            },
            {
                id: 'free_market',
                text: '市场自由',
                description: '政府不应干预私营企业。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: -10,
                    approval: {
                        merchant: 25,
                        worker: -30,
                        artisan: -20,
                    },
                    stratumDemandMod: {
                        worker: -0.15, // 工人不满
                    },
                },
            },
        ],
    },
    {
        id: 'railway_mania',
        name: '铁路狂热',
        icon: 'Train',
        image: null,
        description: '铁路投资热潮席卷全国，人们疯狂购买铁路公司的股票。这可能是改变时代的机遇，也可能是即将破裂的泡沫。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'state_railway',
                text: '国有铁路',
                description: '由国家建设和运营铁路网。',
                effects: {
                    resourcePercent: {
                        silver: -0.015,
                        science: 0.04,
                    },
                    populationPercent: 0.05,
                    stability: 5,
                    resourceDemandMod: { iron: 0.3, coal: 0.35, wood: 0.2, steel: 0.15 },
                    approval: {
                        worker: 20,
                        merchant: -15,
                        landowner: -10,
                    },
                },
            },
            {
                id: 'regulate_private',
                text: '规范私营',
                description: '允许私人投资，但政府监管。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                        science: 0.03,
                    },
                    populationPercent: 0.03,
                    resourceDemandMod: { iron: 0.2, coal: 0.2, wood: 0.15, steel: 0.1 },
                    approval: {
                        merchant: 15,
                        worker: 10,
                    },
                },
            },
            {
                id: 'laissez_faire',
                text: '放任自流',
                description: '让市场决定铁路的发展。',
                effects: {
                    resourcePercent: {
                        science: 0.02,
                    },
                    resourceDemandMod: { iron: 0.15, coal: 0.1, steel: 0.08 },
                    approval: {
                        merchant: 25,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            resourcePercent: { silver: -0.05 },
                            stability: -15,
                        },
                        description: '铁路泡沫破裂！许多投资者血本无归，经济陷入衰退。',
                    },
                ],
            },
        ],
    },
    {
        id: 'labor_union_formation',
        name: '工会运动',
        icon: 'Users',
        image: null,
        description: '工人们开始组织工会，要求集体谈判的权利。工厂主将其视为对财产权的威胁，而工人们则认为这是唯一能保护他们权益的方式。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'legalize_unions',
                text: '合法化工会',
                description: '承认工人组织和集体谈判的权利。',
                effects: {
                    stability: 5,
                    resourceDemandMod: { food: 0.15, cloth: 0.1 },
                    approval: {
                        worker: 40,
                        artisan: 25,
                        merchant: -30,
                        landowner: -20,
                    },
                    resourceDemandMod: {
                        food: 0.1, // 工人消费
                        cloth: 0.05,
                    },
                },
            },
            {
                id: 'limited_rights',
                text: '有限承认',
                description: '允许工会存在，但限制其活动。',
                effects: {
                    resourceDemandMod: { food: 0.05 },
                    approval: {
                        worker: 15,
                        merchant: -10,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 工人消费
                    },
                },
            },
            {
                id: 'ban_unions',
                text: '禁止工会',
                description: '工人结社是对社会秩序的威胁。',
                effects: {
                    stability: -15,
                    resourceDemandMod: { food: -0.1 },
                    approval: {
                        merchant: 20,
                        landowner: 15,
                        worker: -40,
                        artisan: -25,
                    },
                },
            },
        ],
    },
    {
        id: 'urban_poverty',
        name: '城市贫民窟',
        icon: 'Home',
        image: null,
        description: '工业化吸引了大量农村人口涌入城市，但住房严重短缺。贫民窟在城市边缘蔓延，疾病和犯罪率上升。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'public_housing',
                text: '建设公共住房',
                description: '由政府出资建设廉价住房。',
                effects: {
                    resourcePercent: {
                        silver: -0.05,
                    },
                    populationPercent: 0.04,
                    resourceDemandMod: { wood: 0.3, stone: 0.25, brick: 0.2 },
                    stability: 10,
                    approval: {
                        worker: 30,
                        peasant: 20,
                        merchant: -15,
                        landowner: -10,
                    },
                },
            },
            {
                id: 'incentivize_private',
                text: '鼓励私人建设',
                description: '给予开发商税收优惠。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    populationPercent: 0.02,
                    approval: {
                        merchant: 15,
                        worker: 5,
                    },
                    resourceDemandMod: {
                        brick: 0.08, // 住房建设
                        steel: 0.03,
                    },
                },
            },
            {
                id: 'demolish_slums',
                text: '拆除贫民窟',
                description: '强制拆除贫民窟，驱散居民。',
                effects: {
                    populationPercent: -0.012,
                    stability: -10,
                    approval: {
                        landowner: 15,
                        worker: -30,
                        peasant: -25,
                    },
                    stratumDemandMod: {
                        worker: -0.15, // 居民流离失所
                    },
                },
            },
        ],
    },
    {
        id: 'communist_manifesto',
        name: '共产主义宣言',
        icon: 'BookOpen',
        image: null,
        description: '一本名为《共产主义宣言》的小册子在工人中广泛传播，它呼吁工人阶级联合起来推翻资本主义制度。当局对此深感忧虑。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'suppress_movement',
                text: '镇压运动',
                description: '逮捕传播者，查禁书籍。',
                effects: {
                    stability: 5,
                    resourceDemandMod: { food: -0.1 },
                    approval: {
                        landowner: 20,
                        merchant: 15,
                        worker: -35,
                        artisan: -20,
                    },
                },
            },
            {
                id: 'reform_to_defuse',
                text: '改革化解',
                description: '通过社会改革来减少激进思想的吸引力。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                    },
                    stability: 10,
                    resourceDemandMod: { food: 0.05, cloth: 0.08 },
                    approval: {
                        worker: 20,
                        artisan: 15,
                        merchant: -15,
                    },
                    resourceDemandMod: {
                        food: 0.05, // 改善生活
                        cloth: 0.03,
                    },
                },
            },
            {
                id: 'allow_debate',
                text: '允许辩论',
                description: '思想自由是社会进步的基础。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                    },
                    stability: -15,
                    resourceDemandMod: { culture: 0.1 },
                    approval: {
                        worker: 25,
                        scribe: 20,
                        landowner: -25,
                        merchant: -20,
                    },
                },
            },
        ],
    },

    // ==================== 中国历史典故事件 ====================

    // 周礼 - 青铜时代/古典时代
    {
        id: 'ritual_reform',
        name: '礼制改革',
        icon: 'Scroll',
        description: '一位博学的官员上书朝廷，建议制定完整的礼仪制度来规范社会秩序。"礼者，天地之序也。"他认为通过明确的等级礼仪，可以让社会和谐稳定。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 3,
            minPopulation: 100,
        },
        options: [
            {
                id: 'establish_ritual',
                text: '制定周详的礼仪制度',
                description: '让每个阶层都知道自己的位置和本分。',
                effects: {
                    resourcePercent: {
                        culture: 0.05,
                        silver: -0.012,
                    },
                    stability: 20,
                    approval: {
                        landowner: 25,
                        official: 30,
                        cleric: 20,
                        peasant: -15,
                        worker: -10,
                    },
                },
            },
            {
                id: 'simplify_ritual',
                text: '简化礼仪，注重实用',
                description: '礼仪应当简明，不必繁文缛节。',
                effects: {
                    resourcePercent: {
                        culture: 0.02,
                    },
                    stability: 5,
                    approval: {
                        merchant: 15,
                        artisan: 10,
                        peasant: 10,
                        official: -10,
                    },
                },
            },
            {
                id: 'reject_ritual',
                text: '拒绝等级礼制',
                description: '人人平等，何须分高下贵贱？',
                effects: {
                    stability: -15,
                    approval: {
                        peasant: 20,
                        worker: 20,
                        landowner: -30,
                        official: -25,
                    },
                },
            },
        ],
    },

    // 孔子 - 古典时代
    {
        id: 'wandering_sage',
        name: '周游列国的圣人',
        icon: 'User',
        description: '一位白发苍苍的老者带着一群弟子来到国境。据说他曾是某国的大司寇，因政见不合而离开。他宣扬"仁义礼智信"，希望能找到愿意采纳其学说的君主。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
            minPopulation: 150,
        },
        options: [
            {
                id: 'hire_sage',
                text: '聘请他为国师',
                description: '以仁政治国，德行天下。',
                effects: {
                    resourcePercent: {
                        culture: 0.08,
                        silver: -0.012,
                    },
                    stability: 15,
                    approval: {
                        scribe: 35,
                        official: 25,
                        cleric: 20,
                        peasant: 10,
                        merchant: -10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.1, // 讲学材料
                        silver: 0.05, // 聘请费用
                    },
                },
            },
            {
                id: 'allow_teaching',
                text: '允许他在国内讲学',
                description: '有教无类，让百姓也能受教育。',
                effects: {
                    resourcePercent: {
                        culture: 0.04,
                    },
                    stability: 5,
                    approval: {
                        scribe: 25,
                        peasant: 15,
                        worker: 10,
                        official: -5,
                    },
                },
            },
            {
                id: 'expel_sage',
                text: '驱逐这些迂腐之人',
                description: '空谈仁义能当饭吃吗？',
                effects: {
                    resourcePercent: {
                        culture: -0.02,
                    },
                    stability: 5,
                    approval: {
                        soldier: 10,
                        merchant: 10,
                        scribe: -30,
                        cleric: -20,
                    },
                },
            },
        ],
    },

    // 秦长城 - 古典时代/封建时代
    {
        id: 'great_wall_project',
        name: '万里长城工程',
        icon: 'Building',
        description: '为抵御北方游牧民族的侵扰，将军们提议修建一条横跨边境的巨大城墙，将各段旧城墙连接起来。这将是史无前例的工程，需要征调大量民夫。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
            minPopulation: 250,
        },
        options: [
            {
                id: 'build_wall',
                text: '不惜代价修建长城',
                description: '千秋万代的功业！',
                effects: {
                    resourcePercent: {
                        stone: -0.03,
                        silver: -0.02,
                    },
                    populationPercent: -0.012,
                    stability: -20,
                    approval: {
                        soldier: 30,
                        landowner: 20,
                        peasant: -40,
                        worker: -35,
                        serf: -40,
                    },
                    resourceDemandMod: {
                        stone: 0.2, // 建造材料
                        food: 0.15, // 劳工补给
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            stability: 30,
                            approval: {
                                soldier: 20,
                            },
                        },
                        description: '长城建成，边境安宁！',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            stability: -30,
                            populationPercent: -0.012,
                            approval: {
                                peasant: -30,
                            },
                        },
                        description: '民夫大量逃亡，工地怨声载道。',
                    },
                ],
            },
            {
                id: 'limited_fortification',
                text: '只修建关键隘口',
                description: '在战略要地建立坚固堡垒。',
                effects: {
                    resourcePercent: {
                        stone: -0.06,
                        silver: -0.028,
                    },
                    populationPercent: -0.03,
                    stability: 5,
                    approval: {
                        soldier: 15,
                        peasant: -10,
                    },
                    stratumDemandMod: {
                        peasant: -0.05, // 弱者不满
                    },
                },
            },
            {
                id: 'reject_wall',
                text: '放弃修建计划',
                description: '与其修墙，不如安抚边民。',
                effects: {
                    approval: {
                        peasant: 20,
                        worker: 15,
                        soldier: -20,
                        landowner: -15,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.3,
                        effects: {
                            resourcePercent: {
                                silver: -0.012,
                                food: -0.03,
                            },
                            stability: -20,
                        },
                        description: '游牧骑兵南下劫掠！',
                    },
                ],
            },
        ],
    },

    // 七国之乱 - 古典时代/封建时代
    {
        id: 'vassal_rebellion',
        name: '诸侯叛乱',
        icon: 'Swords',
        description: '朝廷推行削减诸侯封地的政策引发强烈反弹。数位封疆大吏联合起来，以"清君侧"为名举兵反叛。叛军声势浩大，直逼京师。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 4,
            minPopulation: 200,
            classConditions: {
                landowner: { maxApproval: 40 },
            },
        },
        options: [
            {
                id: 'crush_rebellion',
                text: '派大军平叛',
                description: '顺我者昌，逆我者亡！',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                    },
                    stability: -25,
                    approval: {
                        soldier: 20,
                        official: 15,
                        landowner: -30,
                    },
                    resourceDemandMod: {
                        tools: 0.15, // 军事消耗
                        food: 0.1,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.6,
                        effects: {
                            stability: 35,
                            resourcePercent: {
                                silver: 0.012,
                            },
                            approval: {
                                landowner: -20,
                                official: 20,
                            },
                        },
                        description: '叛乱被成功镇压，诸侯势力大减。',
                    },
                    {
                        chance: 0.4,
                        effects: {
                            stability: -40,
                            populationPercent: -0.015,
                            approval: {
                                soldier: -20,
                                peasant: -30,
                            },
                        },
                        description: '平叛战争陷入僵持，国力大损。',
                    },
                ],
            },
            {
                id: 'negotiate_peace',
                text: '与叛军谈判',
                description: '暂时妥协，以图后计。',
                effects: {
                    stability: 10,
                    approval: {
                        landowner: 25,
                        official: -20,
                        soldier: -15,
                    },
                    stratumDemandMod: {
                        official: -0.1, // 官员不满
                    },
                },
            },
            {
                id: 'abandon_reform',
                text: '撤回削藩政策',
                description: '承认错误，恢复旧制。',
                effects: {
                    stability: 15,
                    approval: {
                        landowner: 40,
                        official: -30,
                        peasant: -10,
                    },
                    stratumDemandMod: {
                        official: -0.15, // 官员不满
                    },
                },
            },
        ],
    },

    // 安史之乱 - 封建时代
    {
        id: 'frontier_general_rebellion',
        name: '边将叛乱',
        icon: 'Horse',
        description: '一位手握重兵的边境将军突然起兵造反。这位将军本是皇帝的宠臣，掌管多个边镇，麾下精兵强将无数。叛军势如破竹，京城危在旦夕！',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            minPopulation: 350,
            classConditions: {
                soldier: { maxApproval: 50 },
            },
        },
        options: [
            {
                id: 'flee_capital',
                text: '皇室出奔避难',
                description: '留得青山在，不愁没柴烧。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                    },
                    stability: -40,
                    populationPercent: -0.012,
                    approval: {
                        official: -30,
                        soldier: -20,
                        peasant: -25,
                        merchant: -30,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 逃亡消耗
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            stability: 30,
                            approval: {
                                soldier: 30,
                            },
                        },
                        description: '忠臣良将组织起勤王之师！',
                    },
                ],
            },
            {
                id: 'defend_capital',
                text: '坚守京城死战',
                description: '天子守国门，君王死社稷！',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: -20,
                    approval: {
                        soldier: 25,
                        official: 20,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        tools: 0.2, // 军事消耗
                        food: 0.15,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            stability: 40,
                            approval: {
                                soldier: 30,
                                official: 25,
                            },
                        },
                        description: '京城保卫战取得胜利！',
                    },
                    {
                        chance: 0.4,
                        effects: {
                            stability: -50,
                            populationPercent: -0.012,
                            approval: {
                                soldier: -30,
                                peasant: -40,
                            },
                        },
                        description: '京城陷落，生灵涂炭。',
                    },
                ],
            },
            {
                id: 'seek_foreign_aid',
                text: '借外族兵马平叛',
                description: '以夷制夷，借刀杀人。',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                    },
                    stability: -10,
                    approval: {
                        soldier: -15,
                        peasant: -20,
                        official: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.08, // 借兵费用
                    },
                },
                randomEffects: [
                    {
                        chance: 0.6,
                        effects: {
                            stability: 25,
                        },
                        description: '叛乱被平定，但外族势力坐大。',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            resourcePercent: {
                                silver: -0.02,
                                food: -0.05,
                            },
                            stability: -20,
                        },
                        description: '外族趁火打劫，边境糜烂。',
                    },
                ],
            },
        ],
    },

    // 杯酒释兵权 - 封建时代
    {
        id: 'disarm_generals',
        name: '杯酒释兵权',
        icon: 'Wine',
        description: '新建立的王朝担忧武将拥兵自重，重蹈前朝覆辙。皇帝设宴款待功臣宿将，在酒酣耳热之际暗示他们交出兵权，以享富贵。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            minPopulation: 250,
        },
        options: [
            {
                id: 'release_generals',
                text: '以利诱之，解除兵权',
                description: '给予丰厚赏赐，换取军权集中。',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                    },
                    stability: 30,
                    approval: {
                        soldier: -25,
                        knight: -30,
                        official: 30,
                        landowner: 20,
                        merchant: 15,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 赏赐
                    },
                },
            },
            {
                id: 'partial_release',
                text: '只收部分将领兵权',
                description: '留用可信之人，遣散可疑者。',
                effects: {
                    resourcePercent: {
                        silver: -0.012,
                    },
                    stability: 15,
                    approval: {
                        soldier: -10,
                        knight: -15,
                        official: 15,
                    },
                    stratumDemandMod: {
                        soldier: -0.05, // 军方不满
                    },
                },
            },
            {
                id: 'keep_military',
                text: '维持现状',
                description: '功臣不可负，否则寒天下之心。',
                effects: {
                    approval: {
                        soldier: 20,
                        knight: 25,
                        official: -10,
                    },
                    stratumDemandMod: {
                        official: -0.05, // 官员不满
                    },
                },
                randomEffects: [
                    {
                        chance: 0.25,
                        effects: {
                            stability: -35,
                            approval: {
                                soldier: -20,
                            },
                        },
                        description: '某位将军拥兵自立，藩镇割据再现。',
                    },
                ],
            },
        ],
    },

    // 王安石变法 - 封建时代/探索时代
    {
        id: 'radical_reform',
        name: '激进的变法',
        icon: 'FileText',
        description: '一位锐意进取的大臣提出全面改革方案："天变不足畏，祖宗不足法，人言不足恤！"他主张推行青苗法、免役法、保甲法等新政，引发朝野激烈争论。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            minPopulation: 300,
        },
        options: [
            {
                id: 'full_reform',
                text: '全面推行变法',
                description: '富国强兵，舍此无他！',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                        culture: -0.03,
                    },
                    stability: -25,
                    approval: {
                        official: -30,
                        landowner: -35,
                        merchant: 20,
                        peasant: 15,
                        soldier: 20,
                    },
                    resourceDemandMod: {
                        papyrus: 0.1, // 变法文件
                        silver: 0.05, // 推广费用
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            resourcePercent: {
                                silver: 0.03,
                            },
                            stability: 20,
                        },
                        description: '变法初见成效，国库充盈！',
                    },
                    {
                        chance: 0.35,
                        effects: {
                            stability: -30,
                            approval: {
                                peasant: -30,
                                official: -20,
                            },
                        },
                        description: '变法执行走样，民怨沸腾。',
                    },
                ],
            },
            {
                id: 'gradual_reform',
                text: '试点推行，徐徐图之',
                description: '先在部分地区试行，总结经验。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: -5,
                    approval: {
                        official: -10,
                        landowner: -15,
                        merchant: 10,
                        peasant: 5,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 试点文件
                        silver: 0.02,
                    },
                },
            },
            {
                id: 'reject_reform',
                text: '驳回变法建议',
                description: '祖宗之法不可变！',
                effects: {
                    stability: 10,
                    approval: {
                        official: 20,
                        landowner: 25,
                        merchant: -15,
                        peasant: -10,
                    },
                    stratumDemandMod: {
                        peasant: -0.05, // 农民不满
                    },
                },
            },
        ],
    },

    // 明英宗亲征 - 封建时代/探索时代
    {
        id: 'emperor_personal_campaign',
        name: '皇帝亲征',
        icon: 'Crown',
        description: '北方游牧民族再次入侵，年轻的皇帝不顾群臣劝阻，执意要御驾亲征。宦官们也在一旁怂恿，说这是建立不世功业的大好机会。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            minPopulation: 350,
        },
        options: [
            {
                id: 'personal_campaign',
                text: '御驾亲征',
                description: '天子亲征，三军用命！',
                effects: {
                    resourcePercent: {
                        silver: -0.03,
                    },
                    stability: -15,
                    approval: {
                        soldier: 30,
                        official: -25,
                    },
                    resourceDemandMod: {
                        tools: 0.2, // 军事消耗
                        food: 0.15,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.25,
                        effects: {
                            stability: 40,
                            resourcePercent: {
                                culture: 0.05,
                            },
                            approval: {
                                soldier: 30,
                                official: 20,
                            },
                        },
                        description: '亲征大捷，威震四方！',
                    },
                    {
                        chance: 0.5,
                        effects: {
                            stability: -60,
                            populationPercent: -0.025,
                            resourcePercent: {
                                silver: -0.04,
                            },
                            approval: {
                                soldier: -40,
                                official: -30,
                                peasant: -30,
                            },
                        },
                        description: '兵败被俘！国家陷入危机！',
                    },
                ],
            },
            {
                id: 'send_general',
                text: '派遣大将出征',
                description: '运筹帷幄，不必亲冒矢石。',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: 5,
                    approval: {
                        soldier: 15,
                        official: 15,
                    },
                    resourceDemandMod: {
                        tools: 0.1, // 军事消耗
                        food: 0.08,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            stability: 20,
                            approval: {
                                soldier: 15,
                            },
                        },
                        description: '将军凯旋而归！',
                    },
                ],
            },
            {
                id: 'negotiate_tribute',
                text: '和议纳贡',
                description: '以财货换和平，免生灵涂炭。',
                effects: {
                    resourcePercent: {
                        silver: -0.025,
                    },
                    stability: 10,
                    approval: {
                        soldier: -25,
                        merchant: 15,
                        peasant: 10,
                        official: -10,
                    },
                },
            },
        ],
    },

    // 张居正改革 - 探索时代
    {
        id: 'grand_secretary_reform',
        name: '首辅改革',
        icon: 'Scale',
        description: '一位铁腕首辅大臣主持朝政，推行"一条鞭法"简化税制，清丈全国土地，严厉打击贪腐。他的改革触动了既得利益者的蛋糕。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
            minPopulation: 350,
        },
        options: [
            {
                id: 'support_reform',
                text: '全力支持改革',
                description: '除弊兴利，中兴有望！',
                effects: {
                    resourcePercent: {
                        silver: 0.03,
                    },
                    stability: -15,
                    approval: {
                        official: -30,
                        landowner: -35,
                        peasant: 25,
                        merchant: 20,
                        worker: 15,
                    },
                    resourceDemandMod: {
                        papyrus: 0.1, // 改革文件
                        silver: 0.05, // 推广费用
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            resourcePercent: {
                                silver: 0.012,
                            },
                            stability: 25,
                        },
                        description: '改革成功，国库充盈，吏治清明！',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            stability: -25,
                            approval: {
                                official: -20,
                            },
                        },
                        description: '改革派遭到政敌清算，人亡政息。',
                    },
                ],
            },
            {
                id: 'moderate_reform',
                text: '支持温和改革',
                description: '循序渐进，不可操之过急。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: 5,
                    approval: {
                        official: -10,
                        landowner: -15,
                        peasant: 10,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 改革文件
                        silver: 0.02,
                    },
                },
            },
            {
                id: 'block_reform',
                text: '否决改革方案',
                description: '维护既有体制，稳定压倒一切。',
                effects: {
                    stability: 10,
                    approval: {
                        official: 25,
                        landowner: 30,
                        peasant: -20,
                        merchant: -15,
                    },
                    resourceDemandMod: {
                        brick: 0.15, // 住房建设
                        steel: 0.08,
                    },
                },
            },
        ],
    },

    // 雍正官绅一体纳粮 - 探索时代/启蒙时代
    {
        id: 'universal_taxation',
        name: '官绅一体纳粮',
        icon: 'Coins',
        description: '长期以来，官员和有功名的士绅享有免税特权，导致税负集中在普通百姓身上。是否要打破这一惯例，要求所有人一体纳税。',
        triggerConditions: {
            minEpoch: 4,
            maxEpoch: 6,
            minPopulation: 350,
        },
        options: [
            {
                id: 'enforce_universal_tax',
                text: '强制推行一体纳粮',
                description: '官民一体，公平税负！',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: -20,
                    approval: {
                        official: -40,
                        landowner: -35,
                        scribe: -30,
                        peasant: 30,
                        worker: 25,
                        merchant: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.05, // 征税成本
                        papyrus: 0.03, // 记录
                    },
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: {
                            resourcePercent: {
                                silver: 0.012,
                            },
                            stability: 20,
                        },
                        description: '改革成功，税收大增，民心归附！',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            stability: -30,
                            approval: {
                                official: -20,
                                scribe: -15,
                            },
                        },
                        description: '官僚消极抵制，政令难以执行。',
                    },
                ],
            },
            {
                id: 'partial_reform',
                text: '部分取消特权',
                description: '只对大地主征税，保留小士绅优免。',
                effects: {
                    resourcePercent: {
                        silver: 0.02,
                    },
                    stability: -5,
                    approval: {
                        landowner: -20,
                        official: -15,
                        scribe: -10,
                        peasant: 15,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 改革成本
                        papyrus: 0.01,
                    },
                },
            },
            {
                id: 'maintain_privilege',
                text: '维持特权制度',
                description: '祖制不可轻改。',
                effects: {
                    stability: 5,
                    approval: {
                        official: 20,
                        landowner: 25,
                        scribe: 20,
                        peasant: -20,
                        worker: -15,
                    },
                    resourceDemandMod: {
                        papyrus: 0.05, // 讲学材料
                    },
                },
            },
        ],
    },

    // 黑船事件 - 启蒙时代/工业时代
    {
        id: 'black_ships',
        name: '黑船来航',
        icon: 'Ship',
        description: '几艘冒着黑烟的巨大铁甲船出现在港口外，船上的外国人带来了通商的要求。他们的大炮射程远超我国任何武器，令人胆寒。是开国还是攘夷？',
        triggerConditions: {
            minEpoch: 5,
            maxEpoch: 6,
            minPopulation: 350,
        },
        options: [
            {
                id: 'open_ports',
                text: '开港通商',
                description: '师夷长技以制夷。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                        culture: 0.03,
                    },
                    stability: -20,
                    approval: {
                        merchant: 35,
                        official: -20,
                        soldier: -30,
                        peasant: -15,
                        landowner: -20,
                    },
                    nationRelation: { all: 20 },
                    nationAggression: { all: -0.15 },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            resourcePercent: {
                                silver: 0.012,
                                science: 0.05,
                            },
                            stability: 15,
                            nationRelation: { random: 10 },
                        },
                        description: '贸易带来繁荣，西学东渐！',
                    },
                    {
                        chance: 0.3,
                        effects: {
                            stability: -25,
                            approval: {
                                peasant: -20,
                                worker: -20,
                            },
                        },
                        description: '不平等条约引发民族屈辱感。',
                    },
                ],
            },
            {
                id: 'limited_trade',
                text: '限制性通商',
                description: '只开放特定港口，严格管控。',
                effects: {
                    resourcePercent: {
                        silver: 0.012,
                    },
                    stability: -5,
                    approval: {
                        merchant: 15,
                        official: 5,
                        soldier: -10,
                    },
                    resourceDemandMod: {
                        silver: 0.02, // 贸易商品
                        tools: 0.01,
                    },
                },
            },
            {
                id: 'resist_foreigners',
                text: '攘夷！驱逐外国人！',
                description: '宁为玉碎，不为瓦全！',
                effects: {
                    stability: -10,
                    approval: {
                        soldier: 30,
                        peasant: 15,
                        merchant: -30,
                        official: 10,
                    },
                    nationRelation: { all: -30 },
                    nationAggression: { all: 0.2 },
                },
                randomEffects: [
                    {
                        chance: 0.6,
                        effects: {
                            resourcePercent: {
                                silver: -0.025,
                            },
                            populationPercent: -0.012,
                            stability: -30,
                            triggerWar: 'strongest',
                        },
                        description: '外国舰队炮轰港口，列强联军入侵！',
                    },
                ],
            },
        ],
    },

    // 掷出窗外事件 - 封建时代/探索时代
    {
        id: 'defenestration',
        name: '掷出窗外事件',
        icon: 'Landmark',
        description: '宗教和政治矛盾激化！一群愤怒的新宗教贵族冲入王宫，将几名代表中央权威的传统宗教官员从窗户扔了出去。这一暴力行为点燃了积蓄已久的火药桶。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 5,
            minPopulation: 250,
            classConditions: {
                cleric: { maxApproval: 50 },
            },
        },
        options: [
            {
                id: 'punish_rebels',
                text: '严惩叛乱者',
                description: '维护朝廷权威，镇压地方势力！',
                effects: {
                    resourcePercent: {
                        silver: -0.02,
                    },
                    stability: -30,
                    approval: {
                        cleric: 20,
                        official: 25,
                        landowner: -30,
                        peasant: -20,
                    },
                    resourceDemandMod: {
                        tools: 0.15, // 军事消耗
                        food: 0.1,
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: {
                            stability: -40,
                            populationPercent: -0.1,
                        },
                        description: '全面内战爆发！',
                    },
                ],
            },
            {
                id: 'negotiate_settlement',
                text: '谈判解决争端',
                description: '各方妥协，避免流血。',
                effects: {
                    stability: -10,
                    approval: {
                        cleric: -10,
                        official: -15,
                        landowner: 15,
                        merchant: 10,
                    },
                    resourceDemandMod: {
                        silver: 0.03, // 谈判成本
                    },
                },
            },
            {
                id: 'religious_freedom',
                text: '宣布宗教自由',
                description: '各人信仰自由，国家不得干涉。',
                effects: {
                    resourcePercent: {
                        culture: 0.03,
                    },
                    stability: -5,
                    approval: {
                        cleric: -35,
                        landowner: 20,
                        merchant: 20,
                        peasant: 15,
                        worker: 10,
                    },
                    resourceDemandMod: {
                        culture: 0.05, // 宗教自由
                    },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 石器时代 (Epoch 0)
    // ==========================================
    {
        id: 'cave_painting_masterpiece',
        name: '洞穴壁画杰作',
        icon: 'Edit3',
        description: '部落的艺术家在深邃的洞穴墙壁上绘制了令人惊叹的野兽和狩猎场景。不仅仅是装饰，萨满认为这蕴含着强大的魔法力量。',
        triggerConditions: {
            maxEpoch: 0,
            minPopulation: 40,
        },
        options: [
            {
                id: 'sacred_site',
                text: '奉为圣地',
                description: '将此洞穴定为部落的圣地，供以后世代瞻仰。',
                effects: {
                    resourcePercent: { culture: 0.1 },
                    stability: 10,
                    approval: { cleric: 20, peasant: 10 },
                    resourceDemandMod: { culture: 0.05 },
                },
            },
            {
                id: 'hunting_magic',
                text: '祈求狩猎魔法',
                description: '在壁画前举行仪式，祈求狩猎丰收。',
                effects: {
                    resourcePercent: { food: 0.05, culture: 0.03 },
                    approval: { soldier: 15, peasant: 5 },
                    resourceDemandMod: { food: 0.02 },
                },
            },
        ],
    },
    {
        id: 'wolf_domestication',
        name: '狼群驯化',
        icon: 'Dog', // Assuming 'Dog' or similar icon exists, using generic if not
        description: '一些游荡的狼群开始在营地边缘徘徊，吃剩饭。与其驱赶它们，也许我们可以尝试驯化它们，让它们成为狩猎的帮手。',
        triggerConditions: {
            maxEpoch: 0,
            minPopulation: 20,
        },
        options: [
            {
                id: 'tame_wolves',
                text: '驯化它们',
                description: '分给它们食物，建立信任。这将是人类最好的朋友。',
                effects: {
                    resourcePercent: { food: -0.05 },
                    approval: { soldier: 20, peasant: 10 },
                    resourceDemandMod: { food: 0.05 }, // 喂养狗
                    buildingProductionMod: {
                        lumber_camp: 0.1, // 狩猎/采集加成
                    },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: { resourcePercent: { food: 0.15 } },
                        description: '猎犬大大提高了狩猎效率！',
                    },
                ],
            },
            {
                id: 'drive_away',
                text: '驱赶它们',
                description: '狼是危险的野兽，不能留在这里。',
                effects: {
                    resourcePercent: { food: 0.02 }, // 省下饲料
                    stability: 5,
                    approval: { peasant: 5 },
                },
            },
        ],
    },
    {
        id: 'star_gazer',
        name: '仰望星空者',
        icon: 'Star',
        description: '一位部落成员每晚都在观察星星的移动，他声称能通过星象预测季节的变化和洪水的到来。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'support_observer',
                text: '供养观察者',
                description: '让他专心研究，不必参与劳作。',
                effects: {
                    resourcePercent: { science: 0.05, food: -0.01 },
                    approval: { cleric: 10, peasant: 5 },
                    resourceDemandMod: { food: 0.01 },
                },
            },
            {
                id: 'mystic_interpretation',
                text: '神祕主义解释',
                description: '星星是祖先的眼睛，将其纳入宗教体系。',
                effects: {
                    resourcePercent: { culture: 0.05 },
                    approval: { cleric: 20 },
                    resourceDemandMod: { culture: 0.05 },
                },
            },
        ],
    },
    {
        id: 'first_fermentation',
        name: '发酵的奇迹',
        icon: 'Wine',
        description: '有人发现储存过久的果实和谷物产生了一种神奇的液体，喝了之后能让人忘却烦恼，但也容易让人失态。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'celebrate_discovery',
                text: '欢庆这一发现',
                description: '这是神的恩赐！让我们尽情享用。',
                effects: {
                    stability: 10,
                    approval: { peasant: 20, soldier: 15 },
                    resourceDemandMod: { food: 0.1 }, // 酿酒消耗
                },
                randomEffects: [
                    {
                        chance: 0.3,
                        effects: { stability: -5, resourcePercent: { food: -0.05 } },
                        description: '全族醉酒，生产停滞了一天。',
                    },
                ],
            },
            {
                id: 'control_usage',
                text: '限制饮用',
                description: '只能在祭祀和庆典时饮用。',
                effects: {
                    resourcePercent: { culture: 0.02 },
                    stability: 5,
                    approval: { cleric: 10 },
                },
            },
        ],
    },
    {
        id: 'obsidian_trade',
        name: '黑曜石贸易',
        icon: 'Gem',
        description: '远方的信使带来了一种锋利的黑色石头——黑曜石。虽然我们附近没有产地，但可以通过交换获得这种优质的工具材料。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'establish_trade',
                text: '建立贸易网',
                description: '用多余的食物和皮毛交换黑曜石。',
                effects: {
                    resourcePercent: { food: -0.05, science: 0.02 },
                    approval: { artisan: 20, soldier: 10 },
                    buildingProductionMod: { stone_tool_workshop: 0.2 },
                },
            },
            {
                id: 'raiding_party',
                text: '劫掠',
                description: '抢夺他们的石头！',
                effects: {
                    resourcePercent: { food: 0.05 }, // 抢来的补给
                    stability: -5,
                    approval: { soldier: 20, peasant: -10 },
                    nationRelation: { all: -10 },
                },
            },
        ],
    },
    {
        id: 'burial_rites',
        name: '丧葬仪式',
        icon: 'Moon',
        description: '部落成员逝去后，人们就是否应该举行更隆重的仪式产生了讨论。有人建议在死者身边放置工具和花朵，以陪伴来世。',
        triggerConditions: {
            maxEpoch: 0,
        },
        options: [
            {
                id: 'elaborate_burial',
                text: '隆重安葬',
                description: '这能抚慰生者，凝聚部落人心。',
                effects: {
                    resourcePercent: { culture: 0.08, food: -0.02, tools: -0.01 },
                    stability: 15,
                    approval: { cleric: 25, peasant: 10 },
                },
            },
            {
                id: 'simple_burial',
                text: '简单掩埋',
                description: '资源宝贵，不应浪费在死者身上。',
                effects: {
                    resourcePercent: { food: 0.01 },
                    approval: { cleric: -15, peasant: -5 },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 青铜时代 (Epoch 1)
    // ==========================================
    {
        id: 'code_of_law',
        name: '法典石柱',
        icon: 'Scale',
        description: '随着城市人口增长，纠纷日益增多。一位贤明的统治者建议将法律刻在巨大的石柱上，立于市中心，让所有人知晓。"以此保护弱者不受强者欺凌"。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'enact_code',
                text: '颁布法典',
                description: '以眼还眼，以牙还牙，公平公正。',
                effects: {
                    resourcePercent: { culture: 0.05, silver: -0.02 },
                    stability: 25,
                    approval: { peasant: 20, merchant: 15, landowner: -10 },
                    resourceDemandMod: { stone: 0.05 },
                },
            },
            {
                id: 'noble_justice',
                text: '维护贵族裁判权',
                description: '法律不应束缚高贵者的手脚。',
                effects: {
                    stability: -5,
                    approval: { landowner: 25, peasant: -20, merchant: -10 },
                },
            },
        ],
    },
    {
        id: 'flood_myth',
        name: '大洪水传说',
        icon: 'Droplet',
        description: '关于一场毁灭世界的大洪水的传说在民间流传。祭司们以此警告世人要敬畏神明，而治水英雄的故事也在激励着人们。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'unite_people',
                text: '强调团结治水',
                description: '像先祖那样，团结一心战胜灾难。',
                effects: {
                    populationPercent: 0.02, // 吸引移民
                    stability: 10,
                    approval: { peasant: 15, worker: 10 },
                    buildingProductionMod: { farm: 0.05 },
                },
            },
            {
                id: 'worship_gods',
                text: '加强祭祀',
                description: '只有虔诚祈祷才能平息神怒。',
                effects: {
                    resourcePercent: { culture: 0.08, food: -0.03 },
                    approval: { cleric: 25, peasant: 5 },
                    resourceDemandMod: { culture: 0.1 },
                },
            },
        ],
    },
    {
        id: 'standardized_weights',
        name: '度量衡统一',
        icon: 'BarChart',
        description: '集市上充斥着各种不同的称重标准，导致欺诈横行，贸易受阻。商人们请求制定统一的度量衡标准。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'standardize',
                text: '统一度量衡',
                description: '制作标准量具，强制推行。',
                effects: {
                    resourcePercent: { silver: 0.05, science: 0.02 },
                    stability: 10,
                    approval: { merchant: 25, artisan: 10, peasant: 10 },
                    buildingProductionMod: { market: 0.15 },
                },
            },
            {
                id: 'laissez_faire_weights',
                text: '维持现状',
                description: '让市场自己调节。',
                effects: {
                    resourcePercent: { silver: -0.02 }, // 效率低下
                    approval: { merchant: -10 },
                },
            },
        ],
    },
    {
        id: 'oracle_bones',
        name: '甲骨占卜',
        icon: 'Bone', // Assuming Bone icon, else generic
        description: '王室占卜师在龟甲和兽骨上刻写文字，通过火烧后的裂纹来预测吉凶。这不仅是占卜，也是记录历史的方式。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'record_history',
                text: '重视记录',
                description: '将占卜结果和国家大事详细记录下来。',
                effects: {
                    resourcePercent: { culture: 0.1, science: 0.03 },
                    approval: { scribe: 25, cleric: 20 },
                    resourceDemandMod: { culture: 0.05 },
                },
            },
            {
                id: 'pure_divination',
                text: '专注神谕',
                description: '仅用于询问神意。',
                effects: {
                    resourcePercent: { culture: 0.05 },
                    approval: { cleric: 15 },
                },
            },
        ],
    },
    {
        id: 'bronze_collapse_fear',
        name: '海上民族的阴影',
        icon: 'Anchor',
        description: '流言四起，说一群来自海上的野蛮民族正在摧毁沿海的文明城邦。我们的贸易伙伴一个个失去了联系。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'fortify_coast',
                text: '加强沿海防御',
                description: '修建堡垒，训练士兵。',
                effects: {
                    resourcePercent: { stone: -0.05, silver: -0.03 },
                    stability: 5,
                    approval: { soldier: 20, merchant: 10 },
                    nationAggression: { all: -0.1 }, // 提高防御姿态
                },
            },
            {
                id: 'absorb_refugees',
                text: '接纳难民',
                description: '很多拥有技术的工匠逃难而来。',
                effects: {
                    populationPercent: 0.05,
                    resourcePercent: { food: -0.05 },
                    stability: -5,
                    approval: { artisan: 15, peasant: -10 },
                    buildingProductionMod: { industry: 0.05 },
                },
            },
        ],
    },
    {
        id: 'chariot_warfare',
        name: '战车冲锋',
        icon: 'Swords', // Generic military
        description: '这一新式武器彻底改变了战争的面貌。轻便的双轮战车和精锐的弓箭手成为了战场的主宰。',
        triggerConditions: {
            minEpoch: 1,
            maxEpoch: 2,
        },
        options: [
            {
                id: 'invest_chariots',
                text: '组建战车部队',
                description: '这需要大量的马匹和精湛的工艺。',
                effects: {
                    resourcePercent: { silver: -0.04, wood: -0.03 },
                    approval: { soldier: 25, landowner: 20 }, // 贵族喜欢战车
                    militaryBonus: 0.15,
                },
            },
            {
                id: 'counter_tactics',
                text: '研究反制战术',
                description: '寻找克制战车的方法。',
                effects: {
                    resourcePercent: { science: 0.03 },
                    approval: { soldier: 10 },
                    militaryBonus: 0.05,
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 古典时代 (Epoch 2)
    // ==========================================
    {
        id: 'great_library',
        name: '万卷书馆',
        icon: 'BookOpen',
        description: '一位在此避难的学者建议建立一座汇集天下书籍的图书馆。以此地为中心，收集全世界的知识。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 3,
        },
        options: [
            {
                id: 'build_library',
                text: '建立大图书馆',
                description: '派遣抄写员去世界各地搜集书卷。',
                effects: {
                    resourcePercent: { science: 0.1, culture: 0.08, silver: -0.05 },
                    approval: { scribe: 40, merchant: 10 },
                    resourceDemandMod: { papyrus: 0.2 },
                },
            },
            {
                id: 'small_archive',
                text: '建立皇家档案馆',
                description: '只收集本国的历史和法律。',
                effects: {
                    resourcePercent: { culture: 0.03 },
                    approval: { scribe: 15, official: 10 },
                },
            },
        ],
    },
    {
        id: 'silk_road_opening',
        name: '丝路凿空',
        icon: 'Map',
        description: '勇敢的探险家带着西域的地图回来了。他描述了一条通往遥远西方的贸易路线，那里有我们也未曾见过的珍宝。',
        triggerConditions: {
            minEpoch: 2,
        },
        options: [
            {
                id: 'open_trade_route',
                text: '打通商路',
                description: '派遣使团和商队，建立驿站。',
                effects: {
                    resourcePercent: { silver: 0.08, culture: 0.05 },
                    approval: { merchant: 40, soldier: 10 }, // 士兵护送
                    resourceDemandMod: { spice: 0.1, cloth: 0.1 },
                    nationRelation: { all: 10 },
                },
            },
            {
                id: 'close_borders',
                text: '严守边疆',
                description: '外面的世界充满了未知的危险。',
                effects: {
                    stability: 5,
                    approval: { soldier: 15, merchant: -20 },
                    resourcePercent: { silver: -0.02 },
                },
            },
        ],
    },
    {
        id: 'roman_roads',
        name: '条条大路',
        icon: 'Move',
        description: '随着军队的征服，我们需要更高效的道路系统来调动部队和运输物资。工程师提出了一套标准化的道路铺设方案。',
        triggerConditions: {
            minEpoch: 2,
        },
        options: [
            {
                id: 'massive_infrastructure',
                text: '建设帝国大道',
                description: '条条大路通首都！',
                effects: {
                    resourcePercent: { stone: -0.1, silver: -0.05 },
                    stability: 15,
                    approval: { merchant: 25, soldier: 20, peasant: 10 },
                    buildingProductionMod: { all: 0.1 }, // 物流提升
                },
            },
            {
                id: 'local_roads',
                text: '修缮现有道路',
                description: '修修补补即可。',
                effects: {
                    resourcePercent: { stone: -0.02 },
                    approval: { merchant: 5 },
                    buildingProductionMod: { all: 0.02 },
                },
            },
        ],
    },
    {
        id: 'academy_founding',
        name: '讲学之风',
        icon: 'Book',
        description: '首都聚集了大量的思想家。有人提议建立固定的讲学场所，让不同的学派可以公开辩论和授课。',
        triggerConditions: {
            minEpoch: 2,
            maxEpoch: 3,
        },
        options: [
            {
                id: 'state_academy',
                text: '设立国立学宫',
                description: '由国家供养，培养治国人才。',
                effects: {
                    resourcePercent: { science: 0.06, culture: 0.04 },
                    approval: { scribe: 30, official: 20 },
                    resourceDemandMod: { papyrus: 0.05 },
                },
            },
            {
                id: 'free_lectures',
                text: '鼓励私人讲学',
                description: '百家争鸣，自由发展。',
                effects: {
                    resourcePercent: { culture: 0.08, science: 0.02 },
                    stability: -5, // 思想活跃可能导致动荡
                    approval: { scribe: 25, peasant: 10 },
                },
            },
        ],
    },
    {
        id: 'census_taking',
        name: '大普查',
        icon: 'Clipboard',
        description: '为了更有效地征税和征兵，官员们请求进行一次全国性的人口普查。这将是一项浩大的工程，且可能引起民众的恐慌。',
        triggerConditions: {
            minEpoch: 2,
        },
        options: [
            {
                id: 'thorough_census',
                text: '彻底普查',
                description: '挨家挨户登记，清查隐匿人口。',
                effects: {
                    resourcePercent: { silver: 0.1 }, // 税基增加
                    stability: -10,
                    approval: { official: 20, peasant: -15, landowner: -15 },
                    resourceDemandMod: { papyrus: 0.1 },
                },
            },
            {
                id: 'loose_census',
                text: '粗略估算',
                description: '大致统计即可，以免扰民。',
                effects: {
                    resourcePercent: { silver: 0.02 },
                    approval: { official: 5, peasant: 5 },
                },
            },
        ],
    },
    {
        id: 'aqueduct_project',
        name: '引水渠工程',
        icon: 'Droplet',
        description: '城市人口激增导致水源短缺和卫生恶化。工程师建议修建巨大的引水渠，将山区的清泉引入城中。',
        triggerConditions: {
            minEpoch: 2,
            minPopulation: 300,
        },
        options: [
            {
                id: 'build_aqueduct',
                text: '修建引水渠',
                description: '这是城市的生命线，也是工程奇迹。',
                effects: {
                    resourcePercent: { stone: -0.08, silver: -0.04 },
                    populationPercent: 0.05, // 环境改善支持更多人口
                    stability: 15,
                    approval: { peasant: 25, worker: 20, artisan: 15 },
                },
            },
            {
                id: 'dig_wells',
                text: '多打几口井',
                description: '便宜且通过。',
                effects: {
                    resourcePercent: { stone: -0.01 },
                    approval: { peasant: 5 },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 封建时代 (Epoch 3)
    // ==========================================
    {
        id: 'magna_carta_demand',
        name: '大宪章的呼声',
        icon: 'Scroll',
        description: '贵族们对国王的专权和重税感到愤怒。他们在兰尼米德草地集结，要求国王签署一份限制王权、保障贵族权利的文件。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'sign_charter',
                text: '签署宪章',
                description: '王权也应在法律之下。',
                effects: {
                    stability: 20,
                    approval: { landowner: 35, merchant: 15, peasant: 5 },
                    resourcePercent: { silver: -0.05 }, // 税收受限
                    stratumDemandMod: { landowner: 0.1 }, // 贵族力量增强
                },
            },
            {
                id: 'reject_charter',
                text: '拒绝签署',
                description: '朕即国家，实际上并没有人能限制国王。',
                effects: {
                    stability: -25,
                    approval: { landowner: -40, soldier: -10 },
                },
                randomEffects: [
                    {
                        chance: 0.6,
                        effects: { stability: -30, resourcePercent: { silver: -0.1 } },
                        description: '内战爆发！贵族们起兵反抗。',
                    },
                ],
            },
        ],
    },
    {
        id: 'knightly_tournament',
        name: '比武大会',
        icon: 'Shield',
        description: '国王举办盛大的比武大会，以此来展示骑士的武艺和国家的强盛。这不仅是娱乐，也是军事演练。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'host_grand_tournament',
                text: '举办盛会',
                description: '邀请各地的骑士参加。',
                effects: {
                    resourcePercent: { silver: -0.05, culture: 0.05 },
                    stability: 10,
                    approval: { soldier: 25, landowner: 20, peasant: 15 },
                    militaryBonus: 0.05, // 军事训练
                },
            },
            {
                id: 'cancel_tournament',
                text: '取消以节省开支',
                description: '国库空虚，不宜铺张。',
                effects: {
                    resourcePercent: { silver: 0.02 },
                    approval: { soldier: -10, landowner: -10, peasant: -5 },
                },
            },
        ],
    },
    {
        id: 'university_founding',
        name: '古老大学',
        icon: 'Book',
        description: '学者行会请求获得特许状，建立一所自治的大学。他们希望脱离教会学校的控制，教授法律、医学和神学。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'grant_charter',
                text: '颁发特许状',
                description: '学术独立有助于知识的繁荣。',
                effects: {
                    resourcePercent: { science: 0.08, culture: 0.05 },
                    approval: { scribe: 35, merchant: 10, cleric: -10 },
                    resourceDemandMod: { papyrus: 0.1 },
                },
            },
            {
                id: 'church_control',
                text: '置于教会监管下',
                description: '知识必须服务于信仰。',
                effects: {
                    resourcePercent: { culture: 0.05 },
                    approval: { cleric: 20, scribe: -10 },
                },
            },
        ],
    },
    {
        id: 'alchemist_discovery',
        name: '炼金术士的实验',
        icon: 'FlaskConical',
        description: '一位炼金术士声称他在寻找长生不老药的过程中，意外发现了一种能产生剧烈爆炸的黑色粉末。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'weaponize',
                text: '研发武器',
                description: '这种粉末可以用来开山裂石，也可以用来杀敌。',
                effects: {
                    resourcePercent: { science: 0.05, silver: -0.05 },
                    militaryBonus: 0.1,
                    approval: { soldier: 20 },
                },
                randomEffects: [
                    {
                        chance: 0.3,
                        effects: { resourcePercent: { science: -0.02, stone: -0.05 } },
                        description: '实验室发生爆炸，损失惨重！',
                    },
                ],
            },
            {
                id: 'ignore_magic',
                text: '视为戏法',
                description: '不过是江湖骗术罢了。',
                effects: {
                    resourcePercent: { science: -0.01 },
                    approval: { cleric: 10 },
                },
            },
        ],
    },
    {
        id: 'hanseatic_league',
        name: '商业同盟',
        icon: 'Ship',
        description: '北方的商业城市结成了紧密的同盟，垄断了波罗的海的贸易。他们拥有自己的法律甚至海军。是否允许本国城市加入或与之合作？',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'cooperate_league',
                text: '加入同盟体系',
                description: '融入国际贸易网络。',
                effects: {
                    resourcePercent: { silver: 0.1, food: 0.05 },
                    approval: { merchant: 35, artisan: 15 },
                    nationRelation: { all: 15 },
                    resourceDemandMod: { cloth: 0.1, spice: 0.1 },
                },
            },
            {
                id: 'compete_league',
                text: '扶持本国商人对抗',
                description: '肥水不流外人田。',
                effects: {
                    resourcePercent: { silver: 0.02 },
                    stability: -5,
                    approval: { merchant: 10, landowner: 10 },
                },
            },
        ],
    },
    {
        id: 'chivalric_romance',
        name: '骑士文学',
        icon: 'Feather',
        description: '吟游诗人在宫廷中传唱着亚瑟王和圆桌骑士的故事。这种关于爱情、荣誉和冒险的文学形式正在贵族中流行。',
        triggerConditions: {
            minEpoch: 3,
            maxEpoch: 4,
        },
        options: [
            {
                id: 'sponsor_poets',
                text: '赞助吟游诗人',
                description: '这有助于提升宫廷的文化品位。',
                effects: {
                    resourcePercent: { culture: 0.08, silver: -0.02 },
                    approval: { landowner: 20, soldier: 10, scribe: 15 },
                },
            },
            {
                id: 'ban_frivolous',
                text: '禁止靡靡之音',
                description: '骑士应该练习武艺，而不是听这些爱情故事。',
                effects: {
                    resourcePercent: { culture: -0.02 },
                    approval: { soldier: 10, cleric: 10, landowner: -15 },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 探索时代 (Epoch 4)
    // ==========================================
    {
        id: 'potato_introduction',
        name: '神奇作物的传入',
        icon: 'Sprout',
        description: '来自新大陆的船只带来了一种名为"土豆"的块茎作物。据说它产量极高，且耐贫瘠，可以养活大量人口。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'promote_planting',
                text: '推广种植',
                description: '这是解决饥荒的神器！',
                effects: {
                    resourcePercent: { food: 0.2 },
                    populationPercent: 0.05,
                    stability: 15,
                    approval: { peasant: 30, landowner: 10 },
                    buildingProductionMod: { farm: 0.15 },
                },
            },
            {
                id: 'cautious_testing',
                text: '谨慎试种',
                description: '先在皇家花园里试种看看。',
                effects: {
                    resourcePercent: { food: 0.05 },
                    approval: { science: 10 },
                },
            },
        ],
    },
    {
        id: 'heliocentrism',
        name: '天体运行论',
        icon: 'Sun',
        description: '一位天文学家发表了惊世骇俗的理论：地球不是宇宙的中心，而是绕着太阳转！这严重挑战了教会的教义。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'support_science',
                text: '支持新理论',
                description: '真理往往掌握在少数人手中。',
                effects: {
                    resourcePercent: { science: 0.15 },
                    stability: -15,
                    approval: { scribe: 40, science: 30, cleric: -40 },
                    resourceDemandMod: { papyrus: 0.1 },
                },
            },
            {
                id: 'condemn_heresy',
                text: '斥为异端',
                description: '烧毁书籍，让他闭嘴。',
                effects: {
                    resourcePercent: { science: -0.05 },
                    stability: 10,
                    approval: { cleric: 30, peasant: 10, scribe: -25 },
                },
            },
        ],
    },
    {
        id: 'privateer_commission',
        name: '私掠许可证',
        icon: 'Skull',
        description: '为了削弱敌国的海上力量并充实国库，海军大臣建议向私人船长颁发特许状，允许他们抢劫敌国商船。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'issue_letters',
                text: '颁发私掠证',
                description: '他们是海盗，也是皇家的海盗。',
                effects: {
                    resourcePercent: { silver: 0.1, food: 0.05 }, // 抢来的财物
                    nationAggression: { all: 0.2 },
                    nationRelation: { all: -20 },
                    approval: { merchant: 15, soldier: 10 },
                    militaryBonus: 0.05,
                },
            },
            {
                id: 'uphold_honor',
                text: '维护国家荣誉',
                description: '国家不应支持这种卑劣行径。',
                effects: {
                    nationRelation: { all: 10 },
                    approval: { landowner: 5 },
                },
            },
        ],
    },
    {
        id: 'tulip_mania',
        name: '郁金香狂热',
        icon: 'Flower',
        description: '一种来自东方的花卉球茎价格被炒到了天价，全民陷入疯狂的投机。人们卖房置地只为求一株稀有的郁金香。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'market_intevention',
                text: '刺破泡沫',
                description: '这疯狂必须停止！强制限制交易。',
                effects: {
                    resourcePercent: { silver: -0.1 }, // 短期损失
                    stability: 10, // 长期稳定
                    approval: { merchant: -25, peasant: 10 },
                },
            },
            {
                id: 'join_speculation',
                text: '征收交易税',
                description: '既然大家都在炒，国库也要分一杯羹。',
                effects: {
                    resourcePercent: { silver: 0.15 },
                    stability: -10,
                    approval: { merchant: 10 },
                },
                randomEffects: [
                    {
                        chance: 0.5,
                        effects: { resourcePercent: { silver: -0.2 }, stability: -20 },
                        description: '泡沫突然破裂！经济崩盘。',
                    },
                ],
            },
        ],
    },
    {
        id: 'kabuki_plays',
        name: '浮世绘与歌舞伎',
        icon: 'Image',
        description: '在和平繁荣的年代，市民文化开始兴起。描绘市井生活的版画和喧闹的歌舞伎表演风靡一时，但这也被一些人视为堕落。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'promote_culture',
                text: '扶持市民文化',
                description: '这是人民的艺术！',
                effects: {
                    resourcePercent: { culture: 0.12, silver: 0.03 },
                    approval: { merchant: 25, artisan: 30, peasant: 15, landowner: -10 },
                    resourceDemandMod: { culture: 0.1 },
                },
            },
            {
                id: 'censor_art',
                text: '整顿风俗',
                description: '禁止奢侈和逾越礼制的娱乐。',
                effects: {
                    resourcePercent: { culture: -0.05 },
                    stability: 5,
                    approval: { landowner: 20, cleric: 15, merchant: -15 },
                },
            },
        ],
    },
    {
        id: 'tea_trade_boom',
        name: '茶叶贸易',
        icon: 'Coffee',
        description: '这种来自东方的神奇树叶泡出的饮料征服了所有人的味蕾。茶叶贸易带来了巨额利润，但也导致白银大量外流。',
        triggerConditions: {
            minEpoch: 4,
        },
        options: [
            {
                id: 'expand_trade',
                text: '扩大进口',
                description: '满足人民的需求。',
                effects: {
                    resourcePercent: { silver: -0.05, culture: 0.05 },
                    approval: { merchant: 30, landowner: 15, peasant: 10 },
                    resourceDemandMod: { food: 0.05 }, // 下午茶
                },
            },
            {
                id: 'grow_locally',
                text: '尝试本土种植',
                description: '或是寻找殖民地种植，以减少白银外流。',
                effects: {
                    resourcePercent: { science: 0.02, silver: 0.02 },
                    approval: { merchant: 15, landowner: 10 },
                    buildingProductionMod: { farm: 0.05 },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 启蒙时代 (Epoch 5)
    // ==========================================
    {
        id: 'hot_air_balloon',
        name: '热气球升空',
        icon: 'Wind',
        description: '在无数观众的惊叹声中，巨大的热气球载着两个人缓缓升空。人类终于迈出了征服天空的第一步。',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'fund_aeronautics',
                text: '资助航空研究',
                description: '天空是新的疆域。',
                effects: {
                    resourcePercent: { science: 0.1, silver: -0.05 },
                    approval: { science: 30, merchant: 10 },
                    nationRelation: { all: 10 }, // 国际声望
                },
            },
            {
                id: 'military_scout',
                text: '用于军事侦察',
                description: '站得高，看得远。',
                effects: {
                    militaryBonus: 0.1,
                    approval: { soldier: 20 },
                    resourcePercent: { silver: -0.03 },
                },
            },
        ],
    },
    {
        id: 'mozart_concert',
        name: '神童的音乐会',
        icon: 'Music',
        description: '一位年轻的音乐天才来到宫廷献艺。他创作的交响乐如此美妙，仿佛来自天国。整个宫廷都被他的才华所折服。',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'royal_patronage',
                text: '成为皇家赞助人',
                description: '让艺术之光照耀国家。',
                effects: {
                    resourcePercent: { culture: 0.15, silver: -0.05 },
                    stability: 10,
                    approval: { landowner: 25, merchant: 20 }, // 附庸风雅
                },
            },
            {
                id: 'public_concert',
                text: '举办公众音乐会',
                description: '艺术应当属于所有人。',
                effects: {
                    resourcePercent: { culture: 0.1, silver: 0.02 }, // 门票收入
                    approval: { merchant: 15, artisan: 20, peasant: 15 },
                    stability: 5,
                },
            },
        ],
    },
    {
        id: 'lightning_rod',
        name: '捕捉雷电',
        icon: 'Zap',
        description: '一位科学家通过风筝实验证明了雷电就是电，并发明了避雷针。这不仅能保护建筑，更打破了对雷电的迷信恐惧。',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'install_rods',
                text: '安装避雷针',
                description: '保护所有重要建筑。',
                effects: {
                    resourcePercent: { science: 0.05, copper: -0.02 },
                    stability: 5, // 减少火灾恐慌
                    approval: { science: 25, peasant: 10 },
                    buildingProductionMod: { industry: 0.05 }, // 安全保障
                },
            },
            {
                id: 'study_electricity',
                text: '研究电学',
                description: '这背后隐藏着无穷的力量。',
                effects: {
                    resourcePercent: { science: 0.15 },
                    approval: { science: 30 },
                    resourceDemandMod: { copper: 0.05 },
                },
            },
        ],
    },
    {
        id: 'taxation_representation',
        name: '无代表不纳税',
        icon: 'Flag',
        description: '殖民地和边远省份的居民抗议中央政府的征税，因为他们在议会中没有代表权。"对自由人强加税赋是暴政！"',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'grant_representation',
                text: '给予代表权',
                description: '扩大议会，吸纳他们的代表。',
                effects: {
                    stability: 20,
                    stability: 20,
                    approval: { merchant: 40, merchant: 20, landowner: -10 },
                    resourcePercent: { silver: 0.05 }, // 自愿纳税
                    nationRelation: { all: 30 },
                },
            },
            {
                id: 'suppress_protest',
                text: '镇压抗税',
                description: '这是叛乱行为！',
                effects: {
                    stability: -20,
                    approval: { soldier: 10, landowner: 15, merchant: -50 },
                    nationRelation: { all: -40 },
                },
            },
        ],
    },
    {
        id: 'agricultural_revolution',
        name: '农业革命',
        icon: 'Wheat',
        description: '新的耕作方法（如四圃轮作制）和播种机的发明大大提高了农业产量。更少的农民可以养活更多的人。',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'promote_new_methods',
                text: '推广新技术',
                description: '这是工业化的基础。',
                effects: {
                    resourcePercent: { food: 0.25 },
                    populationPercent: 0.1,
                    approval: { landowner: 30, science: 20 },
                    buildingProductionMod: { farm: 0.2 },
                },
            },
            {
                id: 'enclosure_movement',
                text: '圈地运动',
                description: '将土地集中起来规模化经营。',
                effects: {
                    resourcePercent: { food: 0.3, silver: 0.1 },
                    stability: -25, // 农民失去土地
                    approval: { landowner: 40, peasant: -40 },
                    populationPercent: 0.05, // 涌入城市
                },
            },
        ],
    },
    {
        id: 'romanticism_movement',
        name: '浪漫主义运动',
        icon: 'Heart',
        description: '作为对理性主义的反动，一场强调情感、自然和个人主义的文化运动正在兴起。诗人和艺术家们颂扬激情与野性。',
        triggerConditions: {
            minEpoch: 5,
        },
        options: [
            {
                id: 'embrace_romanticism',
                text: '拥抱浪漫主义',
                description: '让情感自由流淌。',
                effects: {
                    resourcePercent: { culture: 0.2 },
                    stability: -10, // 情绪化导致不稳定
                    approval: { artisan: 40, peasant: 30, official: -10 },
                },
            },
            {
                id: 'uphold_rationalism',
                text: '坚持理性主义',
                description: '秩序和理智才是国家强盛的基石。',
                effects: {
                    resourcePercent: { science: 0.1 },
                    stability: 10,
                    stability: 10,
                    approval: { official: 20, science: 15, artisan: -20 },
                },
            },
        ],
    },

    // ==========================================
    // 新增历史事件 - 工业时代 (Epoch 6)
    // ==========================================
    {
        id: 'steam_engine_revolution',
        name: '蒸汽机的改良',
        icon: 'Settings',
        description: '一个工程师大大改良了蒸汽机，使其效率成倍提高。现在它不仅能抽水，还能驱动纺织机和机车。蒸汽时代到来了！',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'industrialize_rapidly',
                text: '全面工业化',
                description: '将蒸汽机应用到所有领域！',
                effects: {
                    buildingProductionMod: { industry: 0.3 },
                    resourcePercent: { coal: -0.2 },
                    approval: { capitalist: 40, science: 20 },
                    buildingProductionMod: { factory: 0.5, mine: 0.3 },
                },
            },
            {
                id: 'regulated_adoption',
                text: '稳步推进',
                description: '注意安全和资源消耗。',
                effects: {
                    resourcePercent: { industry: 0.15, coal: -0.1 },
                    stability: 5,
                    approval: { official: 10 },
                    buildingProductionMod: { factory: 0.2 },
                },
            },
        ],
    },
    {
        id: 'telephone_patent',
        name: '电话的诞生',
        icon: 'Phone',
        description: '一个发明家申请了一项通过导线传送语音的专利。"快来这里，我需要你！"这是人类通讯史上的里程碑。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'build_network',
                text: '建设电话网络',
                description: '连接城市和乡村。',
                effects: {
                    resourcePercent: { science: 0.1, silver: -0.05 },
                    stability: 10, // 沟通顺畅
                    approval: { merchant: 30, worker: 20 },
                    resourceDemandMod: { copper: 0.2 }, // 铜线
                    nationRelation: { all: 5 },
                },
            },
            {
                id: 'exclusive_use',
                text: '仅供军政使用',
                description: '国家机密通讯优先。',
                effects: {
                    militaryBonus: 0.1,
                    stability: 15,
                    approval: { official: 20, soldier: 15 },
                },
            },
        ],
    },
    {
        id: 'impressionist_exhibition',
        name: '落选者沙龙',
        icon: 'Eye',
        description: '一群被官方沙龙拒绝的画家举办了自己的画展。他们用光影捕捉瞬间的印象，被评论家讥讽为"印象派"，但却吸引了公众的目光。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'support_innovators',
                text: '支持创新艺术家',
                description: '艺术需要打破陈规。',
                effects: {
                    resourcePercent: { culture: 0.2 },
                    approval: { artisan: 50, peasant: 25, landowner: -20 },
                    nationRelation: { all: 20 },
                },
            },
            {
                id: 'mock_them',
                text: '站在正统一方',
                description: '这些只是未完成的草稿。',
                effects: {
                    stability: 5,
                    stability: 5,
                    approval: { landowner: 30, artisan: -30 },
                },
            },
        ],
    },
    {
        id: 'world_fair',
        name: '万国博览会',
        icon: 'Globe',
        description: '这是一个展示工业、科学和文化成就的全球盛会。各国都将派出代表团，展示他们最先进的发明。我们是否要主办这次盛会？',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'host_fair',
                text: '主办博览会',
                description: '向世界展示我们的强盛！',
                effects: {
                    resourcePercent: { silver: -0.2, culture: 0.3 },
                    stability: 20,
                    approval: { merchant: 40, worker: 30 },
                    nationRelation: { all: 30 }, // 外交大胜利
                    buildingProductionMod: { market: 0.2, library: 0.2 },
                },
            },
            {
                id: 'participate_only',
                text: '仅设立展馆',
                description: '展示我们的特色产品。',
                effects: {
                    resourcePercent: { silver: -0.05, culture: 0.1 },
                    nationRelation: { all: 10 },
                    approval: { merchant: 15 },
                },
            },
        ],
    },
    {
        id: 'x_ray_discovery',
        name: '透视之光',
        icon: 'Activity',
        description: '一个科学家在实验室里发现了一种神秘的射线，可以穿透皮肤看到骨骼。这一发现震惊了医学界和物理学界。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'medical_application',
                text: '应用于医学',
                description: '无数伤病员将因此获救。',
                effects: {
                    resourcePercent: { science: 0.15 },
                    populationPercent: 0.05, // 死亡率下降
                    approval: { science: 40, worker: 20 },
                },
            },
            {
                id: 'pure_research',
                text: '深入物理研究',
                description: '探寻物质的本质。',
                effects: {
                    resourcePercent: { science: 0.25 },
                    approval: { science: 50 },
                },
            },
        ],
    },
    {
        id: 'suffrage_march',
        name: '争取投票权',
        icon: 'UserCheck',
        description: '成千上万的妇女和工人走上街头，要求平等的投票权。他们高呼口号，举行游行，甚至引发了一些冲突。',
        triggerConditions: {
            minEpoch: 6,
        },
        options: [
            {
                id: 'universal_suffrage',
                text: '通过普选权',
                description: '这是历史的潮流。',
                effects: {
                    stability: 10,
                    approval: { worker: 50, worker: 50, merchant: 40, landowner: -30 },
                    resourcePercent: { culture: 0.1 },
                },
            },
            {
                id: 'suppress_movement',
                text: '拒绝要求',
                description: '政治是精英的游戏。',
                effects: {
                    stability: -30,
                    stability: -30,
                    approval: { landowner: 30, worker: -40, merchant: -30 },
                    buildingProductionMod: { industry: -0.1 }, // 罢工
                },
                randomEffects: [
                    {
                        chance: 0.4,
                        effects: { stability: -40 },
                        description: '抗议演变为暴动！',
                    },
                ],
            },
        ],
    },
    // === 历史典故事件 ===
    {
        id: 'burning_books',
        name: '焚书禁学',
        icon: 'Flame',
        image: null,
        description: '宰相进言：民间流传着许多异端邪说和诽谤朝廷的文章，它们动摇人心，威胁统治。他建议收缴并焚毁所有私藏的经典著作，只保留官方认可的版本。一些学者闻讯后惊恐不已，试图藏匿书籍。',
        triggerConditions: { minEpoch: 2, maxEpoch: 4, minPopulation: 100 },
        options: [
            {
                id: 'burn_all',
                text: '焚毁一切异书',
                description: '统一思想，消除隐患。处死私藏者以儆效尤。',
                effects: { resourcePercent: { culture: -0.15, science: -0.1 }, stability: 20, approval: { scribe: -50, cleric: -30, soldier: 15, official: 25 } },
            },
            {
                id: 'selective_ban',
                text: '只禁政治敏感内容',
                description: '保留技术和医学书籍，只焚毁煽动性文章。',
                effects: { resourcePercent: { culture: -0.05 }, stability: 10, approval: { scribe: -20, official: 15 } },
            },
            {
                id: 'reject_proposal',
                text: '拒绝焚书',
                description: '知识是文明的根基，不能因恐惧而毁灭它。',
                effects: { resourcePercent: { culture: 0.05, science: 0.03 }, stability: -10, approval: { scribe: 30, cleric: 15, official: -20 } },
            },
        ],
    },
    {
        id: 'maritime_ban',
        name: '海禁之争',
        icon: 'Ship',
        image: null,
        description: '沿海地区海盗猖獗，走私活动也日益嚣张。有大臣建议实施海禁——禁止一切民间海上贸易，片帆不得下海。商人们闻讯大为恐慌，他们的生计全赖于海上贸易。',
        triggerConditions: { minEpoch: 3, maxEpoch: 5, minPopulation: 150 },
        options: [
            {
                id: 'total_ban',
                text: '全面海禁',
                description: '犯禁者斩！彻底杜绝海患。',
                effects: { stability: 15, approval: { merchant: -40, peasant: 10, official: 20 }, buildingProductionMod: { dockyard: -0.5, market: -0.2 } },
            },
            {
                id: 'licensed_trade',
                text: '官方许可贸易',
                description: '只允许持有官方牌照的船只出海。',
                effects: { resourcePercent: { silver: 0.05 }, approval: { merchant: -15, official: 15 } },
            },
            {
                id: 'strengthen_navy',
                text: '加强海防',
                description: '与其禁海，不如建设强大的海军剿灭海盗。',
                effects: { resourcePercent: { silver: -0.08 }, approval: { merchant: 20, soldier: 15, official: -10 }, buildingProductionMod: { dockyard: 0.15 } },
            },
        ],
    },
    {
        id: 'exam_scandal',
        name: '科场舞弊',
        icon: 'FileWarning',
        image: null,
        description: '今年的科举考试爆出惊天丑闻！有人发现主考官私下泄题，收受贿赂，让豪门子弟冒名顶替。落榜士子群情激愤，聚集在贡院门口抗议。此事若处理不当，将动摇整个选官制度的根基。',
        triggerConditions: { minEpoch: 2, maxEpoch: 5, minPopulation: 100 },
        options: [
            {
                id: 'severe_punishment',
                text: '严惩涉案官员',
                description: '斩首示众，株连九族，以儆效尤！',
                effects: { populationPercent: -0.01, stability: 15, approval: { scribe: 25, official: -20, peasant: 15 } },
            },
            {
                id: 'quiet_resolution',
                text: '低调处理',
                description: '革职查办但不公开，维护朝廷体面。',
                effects: { stability: -5, approval: { scribe: -15, official: 10, landowner: 10 } },
                randomEffects: [{ chance: 0.4, effects: { stability: -15, approval: { scribe: -20, peasant: -10 } }, description: '消息走漏，民间舆论哗然！' }],
            },
            {
                id: 'reform_system',
                text: '改革考试制度',
                description: '趁此机会推行匿名阅卷、糊名制度。',
                effects: { resourcePercent: { silver: -0.03, science: 0.05 }, approval: { scribe: 30, official: -15 } },
            },
        ],
    },
    {
        id: 'great_wall_project',
        name: '长城工程',
        icon: 'Building',
        image: null,
        description: '北方游牧民族的威胁日益严重，将军们提议在边境修筑一座绵延千里的长城。这将是史无前例的浩大工程，需要征发数十万民夫，耗费无数钱粮。但若能建成，将成为抵御外敌的钢铁屏障。',
        triggerConditions: { minEpoch: 2, maxEpoch: 4, minPopulation: 150 },
        options: [
            {
                id: 'build_wall',
                text: '倾全国之力修筑',
                description: '功在当代，利在千秋！',
                effects: { resourcePercent: { silver: -0.12, food: -0.08 }, populationPercent: -0.05, stability: -15, approval: { soldier: 25, peasant: -35, artisan: -20 } },
                randomEffects: [{ chance: 0.5, effects: { stability: 20, approval: { soldier: 20 } }, description: '长城建成！北方边境固若金汤！' }],
            },
            {
                id: 'partial_fortification',
                text: '修建关键要塞',
                description: '只在战略要地修筑城堡和关隘。',
                effects: { resourcePercent: { silver: -0.05 }, approval: { soldier: 15, peasant: -10 } },
            },
            {
                id: 'diplomatic_approach',
                text: '和亲贸易',
                description: '与其修墙，不如通过联姻和贸易来化解敌意。',
                effects: { resourcePercent: { silver: -0.03, culture: 0.04 }, approval: { merchant: 20, soldier: -20, peasant: 15 } },
            },
        ],
    },
    {
        id: 'paper_money_crisis',
        name: '纸币危机',
        icon: 'Banknote',
        image: null,
        description: '为了应付战争开支，朝廷大量印制纸币。起初人们还愿意接受，但现在纸币越来越不值钱，物价飞涨。市场上，一筐纸币只能换一斗米。商人们开始拒收官方纸币，民间私下以铜钱和银子交易。',
        triggerConditions: { minEpoch: 3, maxEpoch: 5, minPopulation: 120 },
        options: [
            {
                id: 'force_acceptance',
                text: '强制流通',
                description: '拒收者以抗旨论处！',
                effects: { stability: -20, approval: { merchant: -35, peasant: -25, official: 10 }, buildingProductionMod: { market: -0.3, industry: -0.15 } },
                randomEffects: [{ chance: 0.4, effects: { stability: -25 }, description: '各地爆发抗议，商业活动几乎停滞！' }],
            },
            {
                id: 'currency_reform',
                text: '货币改革',
                description: '回收旧币，发行新币，以实物储备背书。',
                effects: { resourcePercent: { silver: -0.1 }, stability: 10, approval: { merchant: 20, peasant: 15 }, buildingProductionMod: { market: 0.1 } },
            },
            {
                id: 'return_to_metal',
                text: '恢复金属货币',
                description: '废除纸币，重新使用铜钱和银两。',
                effects: { resourcePercent: { silver: -0.05 }, stability: 5, approval: { merchant: 25, peasant: 20, official: -15 } },
            },
        ],
    },
];

