// 庆典效果配置文件
// 定义所有可能的庆典效果，按时代分类

/**
 * 庆典效果类型
 * - temporary: 仅对下一年有效（持续360天）
 * - permanent: 永久生效
 * 
 * 每个时代现有10个庆典效果选项，提供丰富的策略选择
 * 总计：8个时代 x 10个效果 = 80个独特庆典效果
 */

export const FESTIVAL_EFFECTS = {
    // 石器时代 (Epoch 0)
    epoch0: [
        {
            id: 'stone_harvest_blessing',
            name: '丰收祝福',
            description: '祈求大地赐予丰收，粮食和木材产量提升',
            icon: 'Wheat',
            type: 'temporary',
            duration: 360, // 1年 = 360天
            effects: {
                categories: {
                    gather: 0.35 // 采集类建筑 +35% (短期buff提升)
                }
            },
            flavorText: '部落长老向天地祈祷，祝福这片土地的收成。'
        },
        {
            id: 'stone_fertility_rite',
            name: '生育仪式',
            description: '举行神圣仪式，人口增长加快',
            icon: 'Users',
            type: 'temporary',
            duration: 360,
            effects: {
                maxPop: 7 // 人口上限 +7 (短期buff提升)
            },
            flavorText: '族人围绕篝火起舞，祈求部落繁荣昌盛。'
        },
        {
            id: 'stone_tool_innovation',
            name: '工具革新',
            description: '改进石器制作技艺，永久提升生产效率',
            icon: 'Wrench',
            type: 'permanent',
            effects: {
                production: 0.025 // 全局生产 +2.5% (永久buff可叠加，降低单次效果)
            },
            flavorText: '工匠们发现了更好的打磨技术，这将永远改变部落的生产方式。'
        },
        {
            id: 'stone_hunting_ritual',
            name: '狩猎仪式',
            description: '举行狩猎前的祭祀，提升采集效率和稳定度',
            icon: 'Target',
            type: 'temporary',
            duration: 360,
            effects: {
                categories: {
                    gather: 0.28 // 短期buff提升
                },
                stability: 0.14 // 短期buff提升
            },
            flavorText: '猎人们在出发前祭拜山神，祈求满载而归。'
        },
        {
            id: 'stone_fire_mastery',
            name: '驭火之术',
            description: '掌握更好的用火技巧，永久提升工业产出',
            icon: 'Flame',
            type: 'permanent',
            effects: {
                industry: 0.03 // 永久buff可叠加，降低单次效果
            },
            flavorText: '火焰不再只是取暖的工具，更成为改造世界的力量。'
        },
        {
            id: 'stone_tribal_unity',
            name: '部落团结',
            description: '加强部落凝聚力，提升稳定度',
            icon: 'Heart',
            type: 'temporary',
            duration: 360,
            effects: {
                stability: 0.28, // 短期buff提升
            },
            flavorText: '氏族间的纷争暂时平息，所有人为了生存团结一致。'
        },
        {
            id: 'stone_cave_painting',
            name: '洞穴壁画',
            description: '记录部落历史，永久提升文化产出',
            icon: 'Image',
            type: 'permanent',
            effects: {
                cultureBonus: 0.04 // 永久buff可叠加，降低单次效果
            },
            flavorText: '壁画上的图案记录着祖先的智慧，代代相传。'
        },
        {
            id: 'stone_elder_wisdom',
            name: '长老智慧',
            description: '长老传授生存经验，提升多项能力',
            icon: 'BookOpen',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.21, // 短期buff提升
                stability: 0.21 // 短期buff提升
            },
            flavorText: '年迈的长老讲述着过往的经验，年轻人认真聆听。'
        },
        {
            id: 'stone_spirit_dance',
            name: '祭灵之舞',
            description: '举行盛大祭祀，大幅提升人口上限',
            icon: 'Music',
            type: 'temporary',
            duration: 360,
            effects: {
                maxPop: 11, // 短期buff提升
                stability: 0.17 // 短期buff提升
            },
            flavorText: '巫师带领族人跳起神秘的舞蹈，祈求祖灵庇佑。'
        },
        {
            id: 'stone_stone_working',
            name: '石器精工',
            description: '改进石器加工技术，永久提升采集效率',
            icon: 'Hammer',
            type: 'permanent',
            effects: {
                categories: {
                    gather: 0.05 // 永久buff可叠加，降低单次效果
                }
            },
            flavorText: '精心打磨的石器更加锋利耐用，狩猎和采集变得更加高效。'
        }
    ],

    // 青铜时代 (Epoch 1)
    epoch1: [
        {
            id: 'bronze_trade_fair',
            name: '贸易集市',
            description: '举办盛大集市，商业收入大幅提升',
            icon: 'ShoppingCart',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.42 // 税收收入 +42% (短期buff提升)
            },
            flavorText: '商人们从四面八方赶来，集市上人声鼎沸。'
        },
        {
            id: 'bronze_military_parade',
            name: '军事演习',
            description: '展示军队实力，军事力量暂时增强',
            icon: 'Shield',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.21 // 军事力量 +21% (短期buff提升)
            },
            flavorText: '青铜武器在阳光下闪耀，士兵们士气高昂。'
        },
        {
            id: 'bronze_metallurgy_advance',
            name: '冶金突破',
            description: '掌握更先进的冶炼技术，永久提升工业产出',
            icon: 'Flame',
            type: 'permanent',
            effects: {
                industry: 0.04 // 工业产出 +4% (永久buff可叠加)
            },
            flavorText: '铁匠们发现了新的合金配方，这是冶金史上的重大突破。'
        },
        {
            id: 'bronze_irrigation_festival',
            name: '灌溉庆典',
            description: '庆祝水利工程完工，农业产出大幅提升',
            icon: 'Droplet',
            type: 'temporary',
            duration: 360,
            effects: {
                categories: {
                    gather: 0.49 // 短期buff提升
                }
            },
            flavorText: '渠道将河水引入田地，农民们欢欣鼓舞。'
        },
        {
            id: 'bronze_writing_system',
            name: '文字诞生',
            description: '创造文字系统，永久提升文化和科研',
            icon: 'FileText',
            type: 'permanent',
            effects: {
                cultureBonus: 0.05, // 永久buff可叠加
                scienceBonus: 0.05 // 永久buff可叠加
            },
            flavorText: '刻在泥板上的符号记录着历史，文明迈入新纪元。'
        },
        {
            id: 'bronze_warrior_training',
            name: '战士训练营',
            description: '建立训练体系，军事力量和稳定度提升',
            icon: 'Swords',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.35, // 短期buff提升
                stability: 0.21 // 短期buff提升
            },
            flavorText: '年轻的战士们在训练场上挥汗如雨，磨练战技。'
        },
        {
            id: 'bronze_merchant_guild',
            name: '商人公会',
            description: '成立商人组织，永久提升税收',
            icon: 'Coins', type: 'permanent',
            effects: {
                taxIncome: 0.06, // 永久buff可叠加
            },
            flavorText: '商人们联合起来，建立了规范的贸易秩序。'
        },
        {
            id: 'bronze_temple_blessing',
            name: '神殿祝福',
            description: '神殿祭司举行盛大仪式，全面提升国力',
            icon: 'Church',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.25, // 短期buff提升
                stability: 0.28, // 短期buff提升
                cultureBonus: 0.21 // 短期buff提升
            },
            flavorText: '祭司们祈求神明降福，信徒们虔诚祷告。'
        },
        {
            id: 'bronze_wheel_invention',
            name: '车轮发明',
            description: '发明车轮，永久提升生产和贸易',
            icon: 'Circle',
            type: 'permanent',
            effects: {
                production: 0.04, // 永久buff可叠加
                taxIncome: 0.05 // 永久buff可叠加
            },
            flavorText: '车轮的发明让运输变得更加便捷，贸易蓬勃发展。'
        },
        {
            id: 'bronze_bronze_age_prosperity',
            name: '青铜繁荣',
            description: '青铜器普及带来繁荣，多项能力提升',
            icon: 'TrendingUp',
            type: 'temporary',
            duration: 360,
            effects: {
                industry: 0.35, // 短期buff提升
                maxPop: 17, // 短期buff提升
                taxIncome: 0.28 // 短期buff提升
            },
            flavorText: '青铜工具和武器的普及，让文明进入黄金时代。'
        }
    ],

    // 古典时代 (Epoch 2)
    epoch2: [
        {
            id: 'classical_philosophy_debate',
            name: '哲学辩论会',
            description: '学者云集，科研和文化产出大幅提升',
            icon: 'BookOpen',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.35, // 科研产出 +35% (短期buff提升)
                cultureBonus: 0.35  // 文化产出 +35% (短期buff提升)
            },
            flavorText: '智者们在广场上激烈辩论，思想的火花照亮了整个城邦。'
        },
        {
            id: 'classical_olympic_games',
            name: '竞技大会',
            description: '举办体育盛会，提升社会稳定和人口上限',
            icon: 'Award',
            type: 'temporary',
            duration: 360,
            effects: {
                stability: 0.21, // 稳定度 +21% (短期buff提升)
                maxPop: 14 // 短期buff提升
            },
            flavorText: '运动员们在竞技场上展现力与美，民众欢呼雀跃。'
        },
        {
            id: 'classical_architecture_school',
            name: '建筑学派',
            description: '建立建筑学院，永久提升建筑效率',
            icon: 'Building',
            type: 'permanent',
            effects: {
                categories: {
                    industry: 0.05 // 工业类建筑 +5% (永久buff可叠加)
                }
            },
            flavorText: '建筑大师们传授技艺，石柱和拱门的艺术将流传千古。'
        },
        {
            id: 'classical_library_foundation',
            name: '图书馆建立',
            description: '建造宏伟图书馆，永久提升科研和文化',
            icon: 'Library',
            type: 'permanent',
            effects: {
                scienceBonus: 0.06, // 永久buff可叠加
                cultureBonus: 0.06, // 永久buff可叠加
            },
            flavorText: '无数卷轴和书籍汇聚于此，成为知识的殿堂。'
        },
        {
            id: 'classical_senate_reform',
            name: '元老院改革',
            description: '改革政治体制，提升稳定度',
            icon: 'Scale',
            type: 'temporary',
            duration: 360,
            effects: {
                stability: 0.35 // 短期buff提升
            },
            flavorText: '元老们通过新的法案，政府运作更加高效。'
        },
        {
            id: 'classical_aqueduct_celebration',
            name: '引水渠庆典',
            description: '庆祝水利工程，人口和生产大幅提升',
            icon: 'Waves',
            type: 'temporary',
            duration: 360,
            effects: {
                maxPop: 21, // 短期buff提升
                production: 0.28 // 短期buff提升
            },
            flavorText: '清澈的水流进城市，解决了长期的用水问题。'
        },
        {
            id: 'classical_legion_triumph',
            name: '军团凯旋',
            description: '庆祝军事胜利，军事和税收提升',
            icon: 'Trophy',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.42, // 短期buff提升
                taxIncome: 0.35, // 短期buff提升
                stability: 0.25 // 短期buff提升
            },
            flavorText: '凯旋的军团带回战利品，民众夹道欢迎。'
        },
        {
            id: 'classical_theater_arts',
            name: '戏剧艺术',
            description: '发展戏剧文化，永久提升文化产出',
            icon: 'Drama',
            type: 'permanent',
            effects: {
                cultureBonus: 0.075, // 永久buff可叠加
                stability: 0.04 // 永久buff可叠加
            },
            flavorText: '悲剧和喜剧在剧场上演，艺术繁荣发展。'
        },
        {
            id: 'classical_trade_routes',
            name: '贸易路线',
            description: '开辟新贸易路线，永久提升税收',
            icon: 'Route',
            type: 'permanent',
            effects: {
                taxIncome: 0.075, // 永久buff可叠加
                production: 0.04 // 永久buff可叠加
            },
            flavorText: '商队往来不绝，丝绸之路带来繁荣。'
        },
        {
            id: 'classical_golden_age',
            name: '黄金时代',
            description: '文明达到巅峰，全方位大幅提升',
            icon: 'Sun',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.35, // 短期buff提升
                scienceBonus: 0.42, // 短期buff提升
                cultureBonus: 0.42, // 短期buff提升
                stability: 0.28 // 短期buff提升
            },
            flavorText: '这是文明最辉煌的时刻，后世将永远铭记。'
        }
    ],

    // 封建时代 (Epoch 3)
    epoch3: [
        {
            id: 'feudal_knights_tournament',
            name: '骑士比武',
            description: '举办骑士锦标赛，军事和文化双重提升',
            icon: 'Sword',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.28, // 短期buff提升
                cultureBonus: 0.21 // 短期buff提升
            },
            flavorText: '骑士们在国王面前展示武艺，赢得荣耀与赞誉。'
        },
        {
            id: 'feudal_harvest_festival',
            name: '丰收节',
            description: '庆祝丰收，提升采集效率和税收',
            icon: 'Leaf',
            type: 'temporary',
            duration: 360,
            effects: {
                categories: {
                    gather: 0.42 // 短期buff提升
                },
                taxIncome: 0.28 // 短期buff提升
            },
            flavorText: '农民们载歌载舞，庆祝又一个丰收年。'
        },
        {
            id: 'feudal_guild_system',
            name: '行会制度',
            description: '建立完善的行会体系，提升生产效率',
            icon: 'Users',
            type: 'permanent',
            effects: {
                production: 0.025 // 生产效率 +2.5% (永久buff可叠加)
            },
            flavorText: '工匠们组成行会，规范了生产标准和质量控制。'
        },
        {
            id: 'feudal_castle_construction',
            name: '城堡建设',
            description: '建造坚固城堡，军事和稳定度提升',
            icon: 'Castle',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.35, // 短期buff提升
                stability: 0.28, // 短期buff提升
            },
            flavorText: '高耸的城堡守护着领地，成为权力的象征。'
        },
        {
            id: 'feudal_monastery_learning',
            name: '修道院学识',
            description: '修道院保存知识，永久提升科研和文化',
            icon: 'BookHeart',
            type: 'permanent',
            effects: {
                scienceBonus: 0.05, // 永久buff可叠加
                cultureBonus: 0.06 // 永久buff可叠加
            },
            flavorText: '修士们抄写古籍，在黑暗时代保存着文明的火种。'
        },
        {
            id: 'feudal_manor_system',
            name: '庄园制度',
            description: '完善庄园经济，生产和税收提升',
            icon: 'Home',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.31, // 短期buff提升
                taxIncome: 0.35, // 短期buff提升
                categories: {
                    gather: 0.28 // 短期buff提升
                }
            },
            flavorText: '领主与农奴的关系更加规范，庄园经济蓬勃发展。'
        },
        {
            id: 'feudal_crusade_fervor',
            name: '圣战热情',
            description: '宗教热情高涨，军事和文化大幅提升',
            icon: 'Cross',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.49, // 短期buff提升
                cultureBonus: 0.28, // 短期buff提升
                stability: 0.21 // 短期buff提升
            },
            flavorText: '信徒们高举十字旗帜，为信仰而战。'
        },
        {
            id: 'feudal_market_charter',
            name: '市场特许',
            description: '授予市场特权，永久提升贸易收入',
            icon: 'Store',
            type: 'permanent',
            effects: {
                taxIncome: 0.09, // 永久buff可叠加
            },
            flavorText: '国王授予城镇市场特权，商业活动更加活跃。'
        },
        {
            id: 'feudal_chivalry_code',
            name: '骑士精神',
            description: '确立骑士准则，永久提升军事和文化',
            icon: 'Heart',
            type: 'permanent',
            effects: {
                militaryBonus: 0.06, // 永久buff可叠加
                cultureBonus: 0.05, // 永久buff可叠加
                stability: 0.04 // 永久buff可叠加
            },
            flavorText: '荣誉、勇气、忠诚——骑士精神成为时代的标志。'
        },
        {
            id: 'feudal_feudal_prosperity',
            name: '封建繁荣',
            description: '封建制度成熟，全面提升国力',
            icon: 'Crown',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.28, // 短期buff提升
                maxPop: 25, // 短期buff提升
                stability: 0.25 // 短期buff提升
            },
            flavorText: '封建体系运转良好，王国进入稳定发展期。'
        }
    ],

    // 探索时代 (Epoch 4)
    epoch4: [
        {
            id: 'exploration_discovery_expo',
            name: '发现博览会',
            description: '展示新大陆的奇珍异宝，科研和贸易繁荣',
            icon: 'Compass',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.42, // 短期buff提升
                taxIncome: 0.35 // 短期buff提升
            },
            flavorText: '探险家们带回了异域的珍宝和知识，开启了新的视野。'
        },
        {
            id: 'exploration_naval_review',
            name: '海军检阅',
            description: '展示强大舰队，军事力量和稳定度提升',
            icon: 'Anchor',
            type: 'temporary',
            duration: 360,
            effects: {
                militaryBonus: 0.35, // 短期buff提升
                stability: 0.28 // 短期buff提升
            },
            flavorText: '战舰列队驶过港口，展示着帝国的海上霸权。'
        },
        {
            id: 'exploration_navigation_school',
            name: '航海学院',
            description: '建立航海学院，永久提升全局生产效率',
            icon: 'Map',
            type: 'permanent',
            effects: {
                production: 0.05, // 永久buff可叠加
                scienceBonus: 0.04 // 永久buff可叠加
            },
            flavorText: '航海家们传授经验，培养新一代的探险者。'
        },
        {
            id: 'exploration_colonial_trade',
            name: '殖民贸易',
            description: '开辟殖民地贸易，税收大幅提升',
            icon: 'Ship',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.56, // 短期buff提升
                production: 0.21 // 短期buff提升
            },
            flavorText: '殖民地的财富源源不断运回本土。'
        },
        {
            id: 'exploration_cartography',
            name: '制图学突破',
            description: '绘制精确地图，永久提升科研和贸易',
            icon: 'MapPin',
            type: 'permanent',
            effects: {
                scienceBonus: 0.06, // 永久buff可叠加
                taxIncome: 0.075 // 永久buff可叠加
            },
            flavorText: '精确的地图让航海更加安全，贸易更加频繁。'
        },
        {
            id: 'exploration_spice_trade',
            name: '香料贸易',
            description: '垄断香料贸易，财富和文化提升',
            icon: 'Coffee',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.49, // 短期buff提升
                cultureBonus: 0.28, // 短期buff提升
                stability: 0.21 // 短期buff提升
            },
            flavorText: '珍贵的香料价值如黄金，带来巨大财富。'
        },
        {
            id: 'exploration_printing_press',
            name: '印刷机革命',
            description: '引入印刷技术，永久提升文化和科研',
            icon: 'Printer',
            type: 'permanent',
            effects: {
                cultureBonus: 0.075, // 永久buff可叠加
                scienceBonus: 0.075, // 永久buff可叠加
            },
            flavorText: '印刷机让知识快速传播，文明进入新纪元。'
        },
        {
            id: 'exploration_renaissance_art',
            name: '文艺复兴',
            description: '艺术繁荣发展，文化和稳定度大幅提升',
            icon: 'Palette',
            type: 'temporary',
            duration: 360,
            effects: {
                cultureBonus: 0.56, // 短期buff提升
                stability: 0.35, // 短期buff提升
                scienceBonus: 0.28 // 短期buff提升
            },
            flavorText: '艺术家们创作出不朽的杰作，文化达到巅峰。'
        },
        {
            id: 'exploration_gunpowder_weapons',
            name: '火药武器',
            description: '装备火药武器，永久提升军事力量',
            icon: 'Zap',
            type: 'permanent',
            effects: {
                militaryBonus: 0.09, // 永久buff可叠加
                industry: 0.05 // 永久buff可叠加
            },
            flavorText: '火药的轰鸣改变了战争的面貌，旧时代的骑士成为历史。'
        },
        {
            id: 'exploration_age_of_discovery',
            name: '大航海时代',
            description: '探索达到高峰，全方位提升',
            icon: 'Globe',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.35, // 短期buff提升
                scienceBonus: 0.42, // 短期buff提升
                taxIncome: 0.49, // 短期buff提升
                stability: 0.28 // 短期buff提升
            },
            flavorText: '这是探索的黄金时代，新世界的大门打开。'
        }
    ],

    // 启蒙时代 (Epoch 5)
    epoch5: [
        {
            id: 'enlightenment_science_fair',
            name: '科学博览会',
            description: '展示最新科技成果，科研产出大幅提升',
            icon: 'Microscope',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.56 // 短期buff提升
            },
            flavorText: '科学家们展示望远镜、显微镜等新发明，引发轰动。'
        },
        {
            id: 'enlightenment_salon_culture',
            name: '沙龙文化',
            description: '知识分子聚会，文化效率提升',
            icon: 'Coffee',
            type: 'temporary',
            duration: 360,
            effects: {
                cultureBonus: 0.49, // 短期buff提升
            },
            flavorText: '贵族沙龙中，思想家们讨论着自由、平等和理性。'
        },
        {
            id: 'enlightenment_education_reform',
            name: '教育改革',
            description: '建立现代教育体系，永久提升多项能力',
            icon: 'GraduationCap',
            type: 'permanent',
            effects: {
                scienceBonus: 0.06, // 永久buff可叠加
                cultureBonus: 0.06, // 永久buff可叠加
            },
            flavorText: '普及教育让更多人获得知识，这将改变整个社会。'
        },
        {
            id: 'enlightenment_constitution',
            name: '宪法制定',
            description: '颁布宪法，稳定度大幅提升',
            icon: 'FileText',
            type: 'temporary',
            duration: 360,
            effects: {
                stability: 0.49, // 短期buff提升
                cultureBonus: 0.28 // 短期buff提升
            },
            flavorText: '成文法保障公民权利，社会更加稳定有序。'
        },
        {
            id: 'enlightenment_encyclopedia',
            name: '百科全书',
            description: '编纂百科全书，永久提升科研和文化',
            icon: 'Book',
            type: 'permanent',
            effects: {
                scienceBonus: 0.09, // 永久buff可叠加
                cultureBonus: 0.075 // 永久buff可叠加
            },
            flavorText: '汇集人类知识的巨著，启蒙时代的纪念碑。'
        },
        {
            id: 'enlightenment_free_trade',
            name: '自由贸易',
            description: '实行自由贸易，经济全面繁荣',
            icon: 'TrendingUp',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.56, // 短期buff提升
                production: 0.35, // 短期buff提升
                stability: 0.21 // 短期buff提升
            },
            flavorText: '打破贸易壁垒，商品自由流通，经济蓬勃发展。'
        },
        {
            id: 'enlightenment_scientific_method',
            name: '科学方法',
            description: '确立科学方法论，永久提升科研',
            icon: 'Beaker',
            type: 'permanent',
            effects: {
                scienceBonus: 0.1, // 永久buff可叠加
                production: 0.05 // 永久buff可叠加
            },
            flavorText: '实验和观察成为探索真理的基础，科学进入新阶段。'
        },
        {
            id: 'enlightenment_industrial_dawn',
            name: '工业曙光',
            description: '工业革命开始，工业和生产提升',
            icon: 'Cog',
            type: 'temporary',
            duration: 360,
            effects: {
                industry: 0.49, // 短期buff提升
                production: 0.42, // 短期buff提升
                scienceBonus: 0.28 // 短期buff提升
            },
            flavorText: '蒸汽机的轰鸣预示着新时代的到来。'
        },
        {
            id: 'enlightenment_human_rights',
            name: '人权宣言',
            description: '宣布人权，永久提升稳定度和文化',
            icon: 'Users',
            type: 'permanent',
            effects: {
                stability: 0.075, // 永久buff可叠加
                cultureBonus: 0.06, // 永久buff可叠加
            },
            flavorText: '人人生而平等，这一理念深入人心。'
        },
        {
            id: 'enlightenment_age_of_reason',
            name: '理性时代',
            description: '理性思想盛行，全面提升国力',
            icon: 'Brain',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.49, // 短期buff提升
                cultureBonus: 0.49, // 短期buff提升
                stability: 0.35, // 短期buff提升
            },
            flavorText: '理性之光驱散蒙昧，人类文明进入新纪元。'
        }
    ],

    // 工业时代 (Epoch 6)
    epoch6: [
        {
            id: 'industrial_world_fair',
            name: '世界博览会',
            description: '举办国际博览会，全方位提升国力',
            icon: 'Globe',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.28, // 短期buff提升
                scienceBonus: 0.35, // 短期buff提升
                cultureBonus: 0.35, // 短期buff提升
                taxIncome: 0.42 // 短期buff提升
            },
            flavorText: '各国展馆林立，展示着工业时代的辉煌成就。'
        },
        {
            id: 'industrial_labor_movement',
            name: '劳工运动',
            description: '改善工人待遇，稳定度和生产效率提升',
            icon: 'Briefcase',
            type: 'temporary',
            duration: 360,
            effects: {
                stability: 0.35, // 短期buff提升
                industry: 0.28 // 短期buff提升
            },
            flavorText: '工人们争取到了更好的待遇，社会更加和谐。'
        },
        {
            id: 'industrial_assembly_line',
            name: '流水线革命',
            description: '引入流水线生产，永久大幅提升工业产出',
            icon: 'Factory',
            type: 'permanent',
            effects: {
                industry: 0.075, // 永久buff可叠加
                production: 0.06 // 永久buff可叠加
            },
            flavorText: '标准化生产彻底改变了制造业，效率提升了数倍。'
        },
        {
            id: 'industrial_railway_network',
            name: '铁路网络',
            description: '建设全国铁路，贸易和生产大幅提升',
            icon: 'Train',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.49, // 短期buff提升
                production: 0.42, // 短期buff提升
            },
            flavorText: '铁路连接各地，货物和人员快速流动。'
        },
        {
            id: 'industrial_steel_production',
            name: '钢铁工业',
            description: '大规模钢铁生产，永久提升工业和军事',
            icon: 'Hammer',
            type: 'permanent',
            effects: {
                industry: 0.09, // 永久buff可叠加
                militaryBonus: 0.075, // 永久buff可叠加
                production: 0.05 // 永久buff可叠加
            },
            flavorText: '钢铁是工业的骨骼，支撑着现代化建设。'
        },
        {
            id: 'industrial_telegraph_system',
            name: '电报系统',
            description: '建立电报网络，贸易效率提升',
            icon: 'Radio',
            type: 'temporary',
            duration: 360,
            effects: {
                taxIncome: 0.35, // 短期buff提升
                stability: 0.28 // 短期buff提升
            },
            flavorText: '信息瞬间传递，世界变得更加紧密。'
        },
        {
            id: 'industrial_public_health',
            name: '公共卫生',
            description: '建立卫生体系，永久提升人口和稳定度',
            icon: 'Heart',
            type: 'permanent',
            effects: {
                maxPop: 12, // 永久buff可叠加
                stability: 0.06, // 永久buff可叠加
                production: 0.04 // 永久buff可叠加
            },
            flavorText: '清洁的水源和医疗服务让人们更加健康。'
        },
        {
            id: 'industrial_urbanization',
            name: '城市化浪潮',
            description: '大规模城市化，多项能力提升',
            icon: 'Building2',
            type: 'temporary',
            duration: 360,
            effects: {
                maxPop: 42, // 短期buff提升
                industry: 0.35, // 短期buff提升
                taxIncome: 0.42, // 短期buff提升
            },
            flavorText: '人们涌入城市，工厂和商店如雨后春笋。'
        },
        {
            id: 'industrial_electricity',
            name: '电力革命',
            description: '普及电力，永久全面提升国力',
            icon: 'Zap',
            type: 'permanent',
            effects: {
                production: 0.075, // 永久buff可叠加
                industry: 0.1, // 永久buff可叠加
                scienceBonus: 0.075, // 永久buff可叠加
                cultureBonus: 0.05 // 永久buff可叠加
            },
            flavorText: '电灯照亮黑夜，电力驱动机器，世界进入电气时代。'
        },
        {
            id: 'industrial_golden_era',
            name: '工业黄金时代',
            description: '工业化高峰，全方位大幅提升',
            icon: 'Award',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.42, // 短期buff提升
                industry: 0.49, // 短期buff提升
                taxIncome: 0.56, // 短期buff提升
                stability: 0.35 // 短期buff提升
            },
            flavorText: '烟囱和机器的轰鸣谱写着进步的乐章。'
        }
    ],

    // 现代时代 (Epoch 7)
    epoch7: [
        {
            id: 'modern_innovation_summit',
            name: '创新峰会',
            description: '全球创新者齐聚，科技爆发式增长',
            icon: 'Lightbulb',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.7, // 短期buff提升
                production: 0.35 // 短期buff提升
            },
            flavorText: '科技巨头们分享最新突破，引领未来发展方向。'
        },
        {
            id: 'modern_cultural_renaissance',
            name: '文化复兴',
            description: '艺术与科技融合，文化和稳定度大幅提升',
            icon: 'Palette',
            type: 'temporary',
            duration: 360,
            effects: {
                cultureBonus: 0.63, // 短期buff提升
                stability: 0.42 // 短期buff提升
            },
            flavorText: '新媒体艺术蓬勃发展，文化产业成为经济支柱。'
        },
        {
            id: 'modern_digital_revolution',
            name: '数字革命',
            description: '全面数字化转型，永久提升所有方面',
            icon: 'Cpu',
            type: 'permanent',
            effects: {
                production: 0.075, // 永久buff可叠加
                scienceBonus: 0.075, // 永久buff可叠加
                cultureBonus: 0.075, // 永久buff可叠加
            },
            flavorText: '互联网和计算机技术彻底改变了社会运作方式。'
        },
        {
            id: 'modern_space_program',
            name: '太空计划',
            description: '启动太空探索，科研和文化大幅提升',
            icon: 'Rocket',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.63, // 短期buff提升
                cultureBonus: 0.49, // 短期buff提升
                stability: 0.35 // 短期buff提升
            },
            flavorText: '火箭升空，人类踏上星际征程。'
        },
        {
            id: 'modern_internet_age',
            name: '互联网时代',
            description: '互联网普及，永久提升多项能力',
            icon: 'Wifi',
            type: 'permanent',
            effects: {
                scienceBonus: 0.1, // 永久buff可叠加
                cultureBonus: 0.09, // 永久buff可叠加
                taxIncome: 0.1, // 永久buff可叠加
            },
            flavorText: '信息高速公路连接世界，知识无远弗届。'
        },
        {
            id: 'modern_green_energy',
            name: '绿色能源',
            description: '发展可再生能源，生产和稳定度提升',
            icon: 'Leaf',
            type: 'temporary',
            duration: 360,
            effects: {
                production: 0.42, // 短期buff提升
                stability: 0.39, // 短期buff提升
                industry: 0.35 // 短期buff提升
            },
            flavorText: '太阳能和风能取代化石燃料，可持续发展成为现实。'
        },
        {
            id: 'modern_ai_revolution',
            name: '人工智能',
            description: 'AI技术突破，永久全面提升',
            icon: 'Brain',
            type: 'permanent',
            effects: {
                scienceBonus: 0.125, // 永久buff可叠加
                production: 0.1, // 永久buff可叠加
                industry: 0.1, // 永久buff可叠加
            },
            flavorText: '人工智能改变了一切，机器学会思考。'
        },
        {
            id: 'modern_biotech_breakthrough',
            name: '生物科技',
            description: '生物技术突破，人口和科研提升',
            icon: 'Dna',
            type: 'temporary',
            duration: 360,
            effects: {
                maxPop: 56, // 短期buff提升
                scienceBonus: 0.56, // 短期buff提升
                stability: 0.31 // 短期buff提升
            },
            flavorText: '基因编辑和细胞疗法延长人类寿命。'
        },
        {
            id: 'modern_global_cooperation',
            name: '全球合作',
            description: '国际合作加强，永久提升稳定和贸易',
            icon: 'Globe',
            type: 'permanent',
            effects: {
                stability: 0.1, // 永久buff可叠加
                taxIncome: 0.125, // 永久buff可叠加
                cultureBonus: 0.075 // 永久buff可叠加
            },
            flavorText: '国家间的边界逐渐模糊，人类命运共同体形成。'
        },
        {
            id: 'modern_information_age',
            name: '信息时代',
            description: '信息革命高峰，全方位大幅提升',
            icon: 'Database',
            type: 'temporary',
            duration: 360,
            effects: {
                scienceBonus: 0.63, // 短期buff提升
                cultureBonus: 0.56, // 短期buff提升
                production: 0.42, // 短期buff提升
                stability: 0.35 // 短期buff提升
            },
            flavorText: '大数据和云计算重塑世界，人类进入新纪元。'
        }
    ]
};

/**
 * 根据时代获取可用的庆典效果
 * @param {number} epoch - 当前时代ID (0-7)
 * @returns {Array} 该时代的庆典效果数组 (每个时代10个)
 */
export const getFestivalEffectsForEpoch = (epoch) => {
    const key = `epoch${epoch}`;
    return FESTIVAL_EFFECTS[key] || [];
};

/**
 * 随机选择三个庆典效果
 * 使用Fisher-Yates洗牌算法确保真正的随机性
 * @param {number} epoch - 当前时代ID
 * @returns {Array} 三个随机选择的庆典效果
 */
export const getRandomFestivalEffects = (epoch) => {
    const availableEffects = getFestivalEffectsForEpoch(epoch);
    if (availableEffects.length <= 3) {
        return [...availableEffects];
    }

    // 使用Fisher-Yates洗牌算法进行真正的随机打乱
    const shuffled = [...availableEffects];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 选择前3个，确保每次都不同
    return shuffled.slice(0, 3);
};
