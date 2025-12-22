/**
 * 政令配置
 * 基于真实历史典故设计，名称与效果匹配，增强策略深度
 * 每个政令都有历史出处或灵感来源
 */
export const DECREES = [
  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    石器时代 (Epoch 0)                        ║
  // ║        原始部落治理，氏族制度，自然崇拜                        ║
  // ╚══════════════════════════════════════════════════════════════╝
  
  {
    id: 'communal_granary',
    name: '公社粮仓',
    desc: '效仿新石器时代的氏族公社，建立集体粮仓统一分配食物，确保部落成员无人饿死。',
    category: 'social',
    unlockEpoch: 0,
    cost: {},
    effects: ['居民需求 -15%', '人口上限 +8%', '粮食需求 -10%', '农民好感 +8'],
    drawbacks: ['采集产出 -5%（缺乏激励）'],
    modifiers: {
      needsReduction: 0.15,
      maxPop: 0.08,
      categories: { gather: -0.05 },
      resourceDemandMod: { food: -0.10 },
      approval: { peasant: 8, serf: 8 },  // Public food distribution improves lower class satisfaction
    },
    active: false,
  },
  {
    id: 'shaman_council',
    name: '萨满议事',
    desc: '由部落萨满组成长老会议，通过占卜和仪式决定部落大事。',
    category: 'culture',
    unlockEpoch: 0,
    cost: {},
    effects: ['公共服务产出 +10%', '科研产出 +5%', '文化需求 +15%', '神职人员好感 +10'],
    drawbacks: ['每日 -2 银币祭祀开销'],
    modifiers: {
      categories: { civic: 0.10 },
      buildings: { library: 0.05 },
      passivePercent: { silver: -0.02 },  // Sacrifice expenses
      passive: { culture: 0.5 },
      resourceDemandMod: { culture: 0.15 },
      approval: { cleric: 10 },  // Shaman council empowers religious figures
    },
    active: false,
  },
  {
    id: 'hunting_party',
    name: '狩猎集会',
    desc: '组织大规模围猎活动，全部落青壮参与，既获取肉食皮毛，也锻炼协作能力。',
    category: 'economy',
    unlockEpoch: 0,
    cost: {},
    effects: ['采集产出 +12%', '军事产出 +5%', '食物供应 +15%', '军人好感 +5'],
    drawbacks: ['每日 -2 食物（宴会消耗）'],
    modifiers: {
      categories: { gather: 0.12, military: 0.05 },
      passivePercent: { food: -0.02 },  // Feast consumption
      resourceSupplyMod: { food: 0.15 },
      approval: { soldier: 5, lumberjack: 6 },  // Hunting events boost warrior and forager morale
    },
    active: false,
  },
  {
    id: 'blood_oath',
    name: '血盟誓约',
    desc: '通过歃血为盟的仪式凝聚氏族忠诚，违背誓约者将被放逐。',
    category: 'military',
    unlockEpoch: 0,
    cost: {},
    effects: ['军事产出 +15%', '居民需求 -5%', '军人消费 -10%', '军人好感 +12'],
    drawbacks: ['工业产出 -8%（封闭排外）', '工匠好感 -5'],
    modifiers: {
      categories: { military: 0.15, industry: -0.08 },
      needsReduction: 0.05,
      stratumDemandMod: { soldier: -0.10 },
      approval: { soldier: 12, knight: 10, artisan: -5 },  // Blood oath unites warriors but isolates craftsmen
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    青铜时代 (Epoch 1)                        ║
  // ║        早期王国，神权政治，奴隶制度萌芽                        ║
  // ╚══════════════════════════════════════════════════════════════╝
  
  {
    id: 'corvee_labor',
    name: '徭役征发',
    desc: '强制征调平民服劳役修筑工程，不支付报酬但提供口粮。',
    category: 'economy',
    unlockEpoch: 1,
    cost: {},
    effects: ['采集产出 +18%', '建筑成本 -10%', '石材供应 +12%'],
    drawbacks: ['人口上限 -8%', '居民需求 +5%', '农民好感 -15', '佃农好感 -12'],
    modifiers: {
      categories: { gather: 0.18 },
      buildCostReduction: 0.10,
      maxPop: -0.08,
      needsReduction: -0.05,
      resourceSupplyMod: { stone: 0.12 },
      approval: { peasant: -15, serf: -12, landowner: 8 },  // Forced labor angers commoners but benefits landowners
    },
    active: false,
  },
  {
    id: 'divine_kingship',
    name: '神王合一',
    desc: '宣称君主为神之化身，享有至高权威。',
    category: 'culture',
    unlockEpoch: 1,
    cost: {},
    effects: ['公共服务产出 +15%', '军事产出 +8%', '贵族消费 +20%', '神职人员好感 +15', '地主好感 +10'],
    drawbacks: ['科研产出 -10%（思想禁锢）', '学者好感 -10'],
    modifiers: {
      categories: { civic: 0.15, military: 0.08 },
      buildings: { library: -0.10, university: -0.10 },
      stratumDemandMod: { landowner: 0.20 },
      approval: { cleric: 15, landowner: 10, official: 8, scribe: -10 },  // Divine rule empowers clergy and nobles, suppresses scholars
    },
    active: false,
  },
  {
    id: 'bronze_standardization',
    name: '青铜标准',
    desc: '统一青铜器的合金配方和铸造规格，提高兵器农具质量。',
    category: 'economy',
    unlockEpoch: 1,
    cost: {},
    effects: ['工业产出 +12%', '军事建筑产出 +10%', '铜需求 +20%', '工匠好感 +10', '军人好感 +5'],
    drawbacks: ['财政收入 -2%（检验费用）'],
    modifiers: {
      categories: { industry: 0.12, military: 0.10 },
      incomePercent: -0.02,
      resourceDemandMod: { copper: 0.20 },
      approval: { artisan: 10, soldier: 5, miner: 8 },  // Standardization benefits craftsmen and miners
    },
    active: false,
  },
  {
    id: 'temple_economy',
    name: '神庙经济',
    desc: '神庙掌控大量土地和劳动力，成为经济中心。',
    category: 'economy',
    unlockEpoch: 1,
    cost: {},
    effects: ['财政收入 +10%', '公共服务 +8%', '神职人员消费 +15%', '神职人员好感 +15'],
    drawbacks: ['工业产出 -5%', '商人好感 -8'],
    modifiers: {
      incomePercent: 0.10,
      perPopPassive: { culture: 0.002 },
      categories: { civic: 0.08, industry: -0.05 },
      stratumDemandMod: { cleric: 0.15 },
      approval: { cleric: 15, merchant: -8 },  // Temple economy empowers clergy but competes with merchants
    },
    active: false,
  },
  {
    id: 'warrior_caste',
    name: '武士世袭',
    desc: '建立世袭武士阶层，专职战斗训练，享有土地特权。',
    category: 'military',
    unlockEpoch: 1,
    cost: {},
    effects: ['军事产出 +20%', '军事建筑产出 +15%', '武器需求 +18%', '军人好感 +15', '骑士好感 +12'],
    drawbacks: ['采集产出 -8%', '每日 -4 银币军饷', '农民好感 -10'],
    modifiers: {
      categories: { military: 0.20, gather: -0.08 },
      buildings: { barracks: 0.15, training_ground: 0.15 },
      passivePercent: { silver: -0.04 },  // Military stipend
      resourceDemandMod: { tools: 0.18 },
      approval: { soldier: 15, knight: 12, peasant: -10 },  // Warrior privileges anger peasants
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    古典时代 (Epoch 2)                        ║
  // ║        城邦文明，公民政治，哲学思辨                           ║
  // ╚══════════════════════════════════════════════════════════════╗
  
  {
    id: 'bread_and_circus',
    name: '面包与竞技',
    desc: '向民众免费发放粮食并举办竞技表演，换取政治支持。',
    category: 'social',
    unlockEpoch: 2,
    cost: {},
    effects: ['居民需求 -18%', '公共服务 +10%', '食物需求 +15%', '文化需求 +20%', '平民好感 +15'],
    drawbacks: ['每日 -6 食物', '每日 -4 银币'],
    modifiers: {
      needsReduction: 0.18,
      categories: { civic: 0.10 },
      passivePercent: { food: -0.06, silver: -0.04 },  // Entertainment expenses
      resourceDemandMod: { food: 0.15, culture: 0.20 },
      approval: { peasant: 15, worker: 12, artisan: 10, serf: 12 },  // Public entertainment pleases the masses
    },
    active: false,
  },
  {
    id: 'twelve_tables',
    name: '十二铜表法',
    desc: '将习惯法刻于铜表公示，平民与贵族同受法律约束。',
    category: 'social',
    unlockEpoch: 2,
    cost: {},
    effects: ['公共服务产出 +12%', '人口上限 +6%', '铜需求 +10%', '平民好感 +10'],
    drawbacks: ['军事产出 -5%（法律限制）', '贵族好感 -8'],
    modifiers: {
      categories: { civic: 0.12, military: -0.05 },
      maxPop: 0.06,
      passive: { culture: 0.8 },
      resourceDemandMod: { copper: 0.10 },
      approval: { peasant: 10, artisan: 10, merchant: 8, landowner: -8, knight: -8 },  // Equal law benefits commoners, restricts nobles
    },
    active: false,
  },
  {
    id: 'agora_assembly',
    name: '广场公民大会',
    desc: '公民在广场集会讨论城邦事务，投票决定重大政策。',
    category: 'culture',
    unlockEpoch: 2,
    cost: {},
    effects: ['科研产出 +15%', '公共服务 +8%', '学者消费 +15%', '莎草纸需求 +12%', '学者好感 +12', '商人好感 +8'],
    drawbacks: ['采集产出 -6%（公民脱产议政）'],
    modifiers: {
      buildings: { library: 0.15, university: 0.10 },
      categories: { civic: 0.08, gather: -0.06 },
      passive: { science: 1.5 },
      stratumDemandMod: { scribe: 0.15 },
      resourceDemandMod: { papyrus: 0.12 },
      approval: { scribe: 12, merchant: 8, official: 6 },  // Democratic assembly empowers educated citizens
    },
    active: false,
  },
  {
    id: 'salt_monopoly',
    name: '盐铁专卖',
    desc: '国家垄断盐铁生产销售，以此获取财政收入。',
    category: 'economy',
    unlockEpoch: 2,
    cost: {},
    effects: ['财政收入 +15%', '工业产出 +6%', '铁供应 +10%', '工具需求 -8%', '官员好感 +10'],
    drawbacks: ['居民需求 +8%', '人口上限 -5%', '商人好感 -15', '农民好感 -8'],
    modifiers: {
      incomePercent: 0.15,
      categories: { industry: 0.06 },
      needsReduction: -0.08,
      maxPop: -0.05,
      resourceSupplyMod: { iron: 0.10 },
      resourceDemandMod: { tools: -0.08 },
      approval: { official: 10, merchant: -15, peasant: -8 },  // State monopoly benefits officials, harms merchants and peasants
    },
    active: false,
  },
  {
    id: 'phalanx_drill',
    name: '方阵操练',
    desc: '训练重装步兵保持紧密队形，以长矛盾牌协同作战。',
    category: 'military',
    unlockEpoch: 2,
    cost: {},
    effects: ['军事产出 +18%', '兵营产出 +20%', '军人消费 +12%', '工具需求 +15%', '军人好感 +12'],
    drawbacks: ['每日 -5 银币训练费', '每日 -3 食物'],
    modifiers: {
      categories: { military: 0.18 },
      buildings: { barracks: 0.20, training_ground: 0.15 },
      passivePercent: { silver: -0.05, food: -0.03 },  // Training expenses
      stratumDemandMod: { soldier: 0.12 },
      resourceDemandMod: { tools: 0.15 },
      approval: { soldier: 12, knight: 8 },  // Military training improves soldier morale
    },
    active: false,
  },
  {
    id: 'guild_charter',
    name: '行会特许',
    desc: '授予手工业行会自治权，制定行业标准并培养学徒。',
    category: 'economy',
    unlockEpoch: 2,
    cost: {},
    effects: ['手工业产出 +15%', '工业产出 +8%', '工匠消费 +10%', '布料供应 +12%', '工匠好感 +15'],
    drawbacks: ['每日 -4 银币行会补贴'],
    modifiers: {
      buildings: {
        loom_house: 0.15,
        furniture_workshop: 0.15,
        dye_works: 0.15,
        tailor_workshop: 0.12,
      },
      categories: { industry: 0.08 },
      passivePercent: { silver: -0.04 },  // Guild subsidy
      stratumDemandMod: { artisan: 0.10 },
      resourceSupplyMod: { cloth: 0.12 },
      approval: { artisan: 15, worker: 5 },  // Guild charter empowers craftsmen
    },
    active: false,
  },
  {
    id: 'road_network',
    name: '驰道官路',
    desc: '修建标准化道路网络，连接各地城镇和边防。',
    category: 'economy',
    unlockEpoch: 2,
    cost: {},
    effects: ['采集产出 +10%', '工业产出 +8%', '军事产出 +5%', '商人消费 +15%', '石材需求 +10%', '商人好感 +10'],
    drawbacks: ['每日 -6 银币维护'],
    modifiers: {
      categories: { gather: 0.10, industry: 0.08, military: 0.05 },
      passivePercent: { silver: -0.06 },  // Road maintenance
      stratumDemandMod: { merchant: 0.15 },
      resourceDemandMod: { stone: 0.10 },
      approval: { merchant: 10, navigator: 8 },  // Road network benefits trade
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    封建时代 (Epoch 3)                        ║
  // ║        封建等级，骑士精神，宗教权威                           ║
  // ╚══════════════════════════════════════════════════════════════╗
  
  {
    id: 'feudal_levy',
    name: '封建征召',
    desc: '领主有义务在战时率领封臣应召出征，以土地换取军事效忠。',
    category: 'military',
    unlockEpoch: 3,
    cost: {},
    effects: ['军事产出 +22%', '军事建筑 +15%', '骑士消费 +20%', '食物需求 +10%', '骑士好感 +15', '地主好感 +10'],
    drawbacks: ['采集产出 -10%', '每日 -3 食物', '农民好感 -12'],
    modifiers: {
      categories: { military: 0.22, gather: -0.10 },
      buildings: { barracks: 0.15, fortress: 0.15 },
      passivePercent: { food: -0.03 },  // Feudal food consumption
      stratumDemandMod: { knight: 0.20 },
      resourceDemandMod: { food: 0.10 },
      approval: { knight: 15, landowner: 10, peasant: -12, serf: -10 },  // Feudal levy benefits nobility, burdens peasants
    },
    active: false,
  },
  {
    id: 'magna_carta',
    name: '大宪章',
    desc: '限制君主权力，保障贵族和自由民的基本权利。',
    category: 'social',
    unlockEpoch: 3,
    cost: {},
    effects: ['公共服务 +15%', '人口上限 +8%', '科研 +5%', '官员消费 +12%', '地主消费 -10%', '地主好感 +12', '学者好感 +8'],
    drawbacks: ['军事产出 -8%（君权受限）'],
    modifiers: {
      categories: { civic: 0.15, military: -0.08 },
      maxPop: 0.08,
      stratumDemandMod: { official: 0.12, landowner: -0.10 },
      buildings: { library: 0.05 },
      passive: { culture: 1 },
      approval: { landowner: 12, merchant: 10, scribe: 8, official: -5 },  // Magna Carta limits royal power, benefits nobles and merchants
    },
    active: false,
  },
  {
    id: 'tithe',
    name: '什一税',
    desc: '教会向信众征收收入的十分之一作为宗教税。',
    category: 'culture',
    unlockEpoch: 3,
    cost: {},
    effects: ['财政收入 +12%', '公共服务 +5%', '神职人员消费 +18%', '文化供应 +10%', '神职人员好感 +18'],
    drawbacks: ['居民需求 +8%', '工业产出 -4%', '农民好感 -10', '商人好感 -8'],
    modifiers: {
      incomePercent: 0.12,
      perPopPassive: { culture: 0.001 },
      categories: { civic: 0.05, industry: -0.04 },
      needsReduction: -0.08,
      stratumDemandMod: { cleric: 0.18 },
      resourceSupplyMod: { culture: 0.10 },
      approval: { cleric: 18, peasant: -10, merchant: -8, artisan: -5 },  // Tithe enriches clergy, burdens commoners
    },
    active: false,
  },
  {
    id: 'hanseatic_law',
    name: '汉萨商法',
    desc: '采用汉萨同盟的商业法规，保护商人权益和贸易自由。',
    category: 'economy',
    unlockEpoch: 3,
    cost: {},
    effects: ['市场/港口产出 +18%', '财政收入 +10%', '商人消费 +20%', '香料需求 +15%', '商人好感 +18'],
    drawbacks: ['采集产出 -5%', '地主好感 -5'],
    modifiers: {
      buildings: {
        market: 0.18,
        trade_port: 0.18,
        trading_post: 0.12,
      },
      incomePercent: 0.10,
      categories: { gather: -0.05 },
      stratumDemandMod: { merchant: 0.20 },
      resourceDemandMod: { spice: 0.15 },
      approval: { merchant: 18, navigator: 12, landowner: -5 },  // Trade law benefits merchants, reduces noble influence
    },
    active: false,
  },
  {
    id: 'inquisition',
    name: '宗教裁判',
    desc: '设立宗教法庭，审判异端和异教徒，维护信仰纯洁。',
    category: 'culture',
    unlockEpoch: 3,
    cost: {},
    effects: ['居民需求 -12%', '公共服务 +8%', '学者消费 -20%', '莎草纸需求 -15%', '神职人员好感 +15'],
    drawbacks: ['科研产出 -15%', '人口上限 -5%', '学者好感 -20', '商人好感 -10'],
    modifiers: {
      needsReduction: 0.12,
      categories: { civic: 0.08 },
      buildings: { library: -0.15, university: -0.15 },
      maxPop: -0.05,
      stratumDemandMod: { scribe: -0.20 },
      resourceDemandMod: { papyrus: -0.15 },
      approval: { cleric: 15, scribe: -20, merchant: -10, engineer: -12 },  // Inquisition empowers clergy, persecutes intellectuals
    },
    active: false,
  },
  {
    id: 'guild_monopoly',
    name: '行会垄断',
    desc: '行会获得特定行业的独占经营权，限制外来竞争。',
    category: 'economy',
    unlockEpoch: 3,
    cost: {},
    effects: ['工业产出 +15%', '手工业建筑 +12%', '工匠消费 +15%', '家具供应 +12%', '工匠好感 +18'],
    drawbacks: ['居民需求 +6%', '每日 -3 银币', '商人好感 -10', '消费者好感 -5'],
    modifiers: {
      categories: { industry: 0.15 },
      buildings: {
        loom_house: 0.12,
        furniture_workshop: 0.12,
        tailor_workshop: 0.12,
        stone_tool_workshop: 0.12,
      },
      needsReduction: -0.06,
      passivePercent: { silver: -0.03 },  // Monopoly fee
      stratumDemandMod: { artisan: 0.15 },
      resourceSupplyMod: { furniture: 0.12 },
      approval: { artisan: 18, merchant: -10, peasant: -5 },  // Monopoly benefits artisans, raises prices for others
    },
    active: false,
  },
  {
    id: 'knight_tournament',
    name: '骑士比武',
    desc: '举办骑士比武大会，展示武艺并招募勇士。',
    category: 'military',
    unlockEpoch: 3,
    cost: {},
    effects: ['军事产出 +15%', '文化产出 +10%', '骑士消费 +18%', '地主消费 +12%', '酒需求 +20%', '骑士好感 +15', '地主好感 +8'],
    drawbacks: ['每日 -5 银币比武开销', '每日 -2 食物宴席'],
    modifiers: {
      categories: { military: 0.15 },
      passivePercent: { silver: -0.05, food: -0.02 },  // Tournament expenses
      passive: { culture: 2 },  // Culture generated from tournament
      stratumDemandMod: { knight: 0.18, landowner: 0.12 },
      resourceDemandMod: { ale: 0.20 },
      approval: { knight: 15, landowner: 8, soldier: 10 },  // Tournament glorifies nobility and warriors
    },
    active: false,
  },
  {
    id: 'serfdom',
    name: '农奴制度',
    desc: '农民被束缚在土地上，为领主无偿劳作。',
    category: 'social',
    unlockEpoch: 3,
    cost: {},
    effects: ['采集产出 +20%', '农场产出 +15%', '佃农消费 -15%', '粮食供应 +12%', '地主消费 +20%', '地主好感 +20'],
    drawbacks: ['人口上限 -10%', '居民需求 +10%', '工业产出 -8%', '农民好感 -25', '佃农好感 -30'],
    modifiers: {
      categories: { gather: 0.20, industry: -0.08 },
      buildings: { farm: 0.15, large_estate: 0.15 },
      maxPop: -0.10,
      needsReduction: -0.10,
      stratumDemandMod: { serf: -0.15, landowner: 0.20 },
      resourceSupplyMod: { food: 0.12 },
      approval: { landowner: 20, peasant: -25, serf: -30 },  // Serfdom greatly benefits landowners, oppresses peasants
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    探索时代 (Epoch 4)                        ║
  // ║        地理大发现，殖民扩张，重商主义                         ║
  // ╚══════════════════════════════════════════════════════════════╗
  
  {
    id: 'navigation_act',
    name: '航海条例',
    desc: '规定殖民地货物只能由本国船只运输，保护本国航运业。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['船坞/港口产出 +25%', '每日 +8 银币航运利润', '水手消费 +15%', '香料供应 +10%', '水手好感 +15'],
    drawbacks: ['采集产出 -6%', '居民需求 +5%'],
    modifiers: {
      buildings: {
        dockyard: 0.25,
        trade_port: 0.20,
      },
      passivePercent: { silver: 0.08 },  // Shipping profits
      categories: { gather: -0.06 },
      needsReduction: -0.05,
      stratumDemandMod: { navigator: 0.15 },
      resourceSupplyMod: { spice: 0.10 },
      approval: { navigator: 15, merchant: 10 },  // Navigation act benefits sailors and merchants
    },
    active: false,
  },
  {
    id: 'encomienda',
    name: '委托监护',
    desc: '授权殖民者监护原住民并征收劳役贡赋。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['采集产出 +22%', '每日 +6 银币贡赋', '佃农消费 -20%', '粮食供应 +15%', '地主好感 +15'],
    drawbacks: ['公共服务 -10%', '人口上限 -8%', '佃农好感 -25', '农民好感 -15'],
    modifiers: {
      categories: { gather: 0.22, civic: -0.10 },
      passivePercent: { silver: 0.06 },  // Tribute revenue
      maxPop: -0.08,
      stratumDemandMod: { serf: -0.20 },
      resourceSupplyMod: { food: 0.15 },
      approval: { landowner: 15, serf: -25, peasant: -15 },  // Colonial exploitation benefits landowners, oppresses natives
    },
    active: false,
  },
  {
    id: 'joint_stock',
    name: '股份公司',
    desc: '允许多人合股经营贸易公司，分担风险共享利润。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['市场产出 +20%', '每日 +10 银币分红', '资本家消费 +25%', '商人消费 +18%', '香料需求 +20%', '资本家好感 +20', '商人好感 +15'],
    drawbacks: ['每日 -4 食物（公司运营）'],
    modifiers: {
      buildings: {
        market: 0.20,
        trade_port: 0.15,
      },
      passivePercent: { silver: 0.10, food: -0.04 },  // Dividends and operational costs
      stratumDemandMod: { capitalist: 0.25, merchant: 0.18 },
      resourceDemandMod: { spice: 0.20 },
      approval: { capitalist: 20, merchant: 15, engineer: 8 },  // Joint stock company benefits capitalists and merchants
    },
    active: false,
  },
  {
    id: 'press_gang',
    name: '强征水手',
    desc: '授权海军在港口强制征募水手服役。',
    category: 'military',
    unlockEpoch: 4,
    cost: {},
    effects: ['军事产出 +18%', '船坞产出 +20%', '水手消费 -15%', '酒需求 +10%'],
    drawbacks: ['公共服务 -8%', '人口上限 -6%', '水手好感 -20', '商人好感 -10'],
    modifiers: {
      categories: { military: 0.18, civic: -0.08 },
      buildings: { dockyard: 0.20 },
      maxPop: -0.06,
      stratumDemandMod: { navigator: -0.15 },
      resourceDemandMod: { ale: 0.10 },
      approval: { navigator: -20, merchant: -10, soldier: 5 },  // Forced recruitment angers sailors and merchants
    },
    active: false,
  },
  {
    id: 'bullionism',
    name: '金银本位',
    desc: '以贵金属储备量衡量国力，限制金银外流。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['每日 +12 银币（贸易顺差）', '商人消费 -12%', '香料需求 -20%', '布料供应 +8%', '官员好感 +8'],
    drawbacks: ['进口商品 -15%', '工业产出 -5%', '商人好感 -15'],
    modifiers: {
      passivePercent: { silver: 0.12 },  // Trade surplus
      categories: { industry: -0.05 },
      buildings: { trade_port: -0.15 },
      stratumDemandMod: { merchant: -0.12 },
      resourceDemandMod: { spice: -0.20 },
      resourceSupplyMod: { cloth: 0.08 },
      approval: { official: 8, merchant: -15 },  // Mercantilist policy benefits state, restricts merchants
    },
    active: false,
  },
  {
    id: 'printing_privilege',
    name: '出版特许',
    desc: '出版商需获得王室特许状才能印刷书籍。',
    category: 'culture',
    unlockEpoch: 4,
    cost: {},
    effects: ['印刷产出 +25%', '每日 +4 银币特许费', '学者消费 -10%', '莎草纸供应 +15%'],
    drawbacks: ['科研产出 -8%', '学者好感 -12'],
    modifiers: {
      buildings: {
        printing_house: 0.25,
        publishing_house: 0.20,
      },
      passivePercent: { silver: 0.04 },  // License fees
      buildings_negative: { library: -0.08 },
      stratumDemandMod: { scribe: -0.10 },
      resourceSupplyMod: { papyrus: 0.15 },
      approval: { scribe: -12, official: 10 },  // Printing privilege restricts scholars, benefits officials
    },
    active: false,
  },
  {
    id: 'plantation_system',
    name: '种植园制',
    desc: '在殖民地建立大规模种植园，生产经济作物出口。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['农场/庄园产出 +20%', '每日 +0.5 香料/咖啡', '地主消费 +15%', '咖啡供应 +20%', '香料供应 +18%', '地主好感 +18', '资本家好感 +12'],
    drawbacks: ['居民需求 +10%', '公共服务 -6%', '佃农好感 -15', '农民好感 -10'],
    modifiers: {
      buildings: {
        farm: 0.20,
        large_estate: 0.25,
      },
      passive: { spice: 0.5, coffee: 0.5 },
      needsReduction: -0.10,
      categories: { civic: -0.06 },
      stratumDemandMod: { landowner: 0.15 },
      resourceSupplyMod: { coffee: 0.20, spice: 0.18 },
      approval: { landowner: 18, capitalist: 12, serf: -15, peasant: -10 },  // Plantation system benefits landowners, exploits laborers
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    启蒙时代 (Epoch 5)                        ║
  // ║        理性主义，社会契约，科学革命                           ║
  // ╚══════════════════════════════════════════════════════════════╗
  
  {
    id: 'enlightened_despotism',
    name: '开明专制',
    desc: '君主以理性治国，推行有限改革但不放弃权力。',
    category: 'social',
    unlockEpoch: 5,
    cost: {},
    effects: ['公共服务 +18%', '科研产出 +12%', '工业产出 +8%', '官员消费 +15%', '工程师消费 +12%', '官员好感 +12', '工程师好感 +10'],
    drawbacks: ['每日 -8 银币改革开支'],
    modifiers: {
      categories: { civic: 0.18, industry: 0.08 },
      buildings: { library: 0.12, university: 0.12 },
      passivePercent: { silver: -0.08 },  // Reform expenses
      passive: { science: 2 },  // Knowledge generation
      stratumDemandMod: { official: 0.15, engineer: 0.12 },
      approval: { official: 12, engineer: 10, scribe: 8 },  // Enlightened despotism benefits educated elites
    },
    active: false,
  },
  {
    id: 'habeas_corpus',
    name: '人身保护令',
    desc: '未经法律程序不得任意拘禁公民。',
    category: 'social',
    unlockEpoch: 5,
    cost: {},
    effects: ['公共服务 +15%', '人口上限 +10%', '工人消费 +10%', '商人消费 +8%', '工人好感 +12', '商人好感 +10'],
    drawbacks: ['军事产出 -8%'],
    modifiers: {
      categories: { civic: 0.15, military: -0.08 },
      maxPop: 0.10,
      passive: { culture: 1.5 },
      stratumDemandMod: { worker: 0.10, merchant: 0.08 },
      approval: { worker: 12, merchant: 10, artisan: 8, peasant: 6 },  // Legal protection benefits commoners
    },
    active: false,
  },
  {
    id: 'royal_academy',
    name: '皇家学院',
    desc: '由王室资助建立科学院，汇聚学者研究自然哲学。',
    category: 'culture',
    unlockEpoch: 5,
    cost: {},
    effects: ['大学产出 +30%', '科研产出 +20%', '学者消费 +25%', '莎草纸需求 +20%', '学者好感 +20', '工程师好感 +12'],
    drawbacks: ['每日 -8 银币学术经费'],
    modifiers: {
      buildings: {
        university: 0.30,
        library: 0.15,
        navigator_school: 0.15,
      },
      passivePercent: { silver: -0.08 },  // Academic funding
      passive: { science: 3 },  // Scientific discoveries
      stratumDemandMod: { scribe: 0.25 },
      resourceDemandMod: { papyrus: 0.20 },
      approval: { scribe: 20, engineer: 12 },  // Royal academy greatly benefits scholars and engineers
    },
    active: false,
  },
  {
    id: 'physiocracy',
    name: '重农学说',
    desc: '认定土地是一切财富的源泉，废除内部关卡促进农业。',
    category: 'economy',
    unlockEpoch: 5,
    cost: {},
    effects: ['采集产出 +18%', '农场产出 +20%', '自耕农消费 +10%', '粮食供应 +15%', '商人消费 -15%', '农民好感 +15'],
    drawbacks: ['工业产出 -8%', '市场产出 -10%', '商人好感 -12'],
    modifiers: {
      categories: { gather: 0.18, industry: -0.08 },
      buildings: {
        farm: 0.20,
        large_estate: 0.15,
        market: -0.10,
      },
      stratumDemandMod: { peasant: 0.10, merchant: -0.15 },
      resourceSupplyMod: { food: 0.15 },
      approval: { peasant: 15, landowner: 10, merchant: -12 },  // Physiocracy benefits farmers, harms merchants
    },
    active: false,
  },
  {
    id: 'patent_system',
    name: '专利制度',
    desc: '授予发明者一定期限的独占权，激励技术创新。',
    category: 'economy',
    unlockEpoch: 5,
    cost: {},
    effects: ['工业产出 +15%', '工厂产出 +18%', '工程师消费 +20%', '钢铁供应 +10%', '工程师好感 +18'],
    drawbacks: ['每日 -5 银币专利管理', '工匠好感 -8'],
    modifiers: {
      categories: { industry: 0.15 },
      buildings: {
        factory: 0.18,
        steel_works: 0.15,
        printing_house: 0.12,
      },
      passivePercent: { silver: -0.05 },  // Patent management
      passive: { science: 1 },  // Innovation boost
      stratumDemandMod: { engineer: 0.20 },
      resourceSupplyMod: { steel: 0.10 },
      approval: { engineer: 18, capitalist: 10, artisan: -8 },  // Patent system benefits inventors, may restrict traditional craftsmen
    },
    active: false,
  },
  {
    id: 'freedom_of_press',
    name: '新闻自由',
    desc: '废除出版审查，允许报刊自由发行和评论。',
    category: 'culture',
    unlockEpoch: 5,
    cost: {},
    effects: ['印刷/出版产出 +25%', '科研产出 +10%', '文化产出 +15%', '学者消费 +15%', '莎草纸需求 +18%', '学者好感 +15'],
    drawbacks: ['公共服务 -5%（舆论批评）', '官员好感 -10'],
    modifiers: {
      buildings: {
        printing_house: 0.25,
        publishing_house: 0.25,
      },
      categories: { civic: -0.05 },
      stratumDemandMod: { scribe: 0.15 },
      resourceDemandMod: { papyrus: 0.18 },
      passive: { science: 2, culture: 3 },
      approval: { scribe: 15, merchant: 8, official: -10 },  // Press freedom benefits scholars, may threaten officials
    },
    active: false,
  },
  {
    id: 'standing_army',
    name: '常备军制',
    desc: '维持职业化常备军队，取代临时征召的封建军队。',
    category: 'military',
    unlockEpoch: 5,
    cost: {},
    effects: ['军事产出 +25%', '要塞产出 +20%', '军人消费 +20%', '工具需求 +15%', '食物需求 +12%', '军人好感 +18'],
    drawbacks: ['每日 -10 银币军饿', '每日 -5 食物军粮', '农民好感 -8'],
    modifiers: {
      categories: { military: 0.25 },
      buildings: { fortress: 0.20, barracks: 0.15 },
      passivePercent: { silver: -0.10, food: -0.05 },  // Military upkeep
      stratumDemandMod: { soldier: 0.20 },
      resourceDemandMod: { tools: 0.15, food: 0.12 },
      approval: { soldier: 18, knight: 10, peasant: -8 },  // Standing army benefits professional soldiers, burdens peasants
    },
    active: false,
  },
  {
    id: 'social_contract',
    name: '社会契约',
    desc: '政府权力来自人民的授权，统治者与被统治者存在契约关系。',
    category: 'social',
    unlockEpoch: 5,
    cost: {},
    effects: ['居民需求 -15%', '公共服务 +12%', '人口上限 +8%', '地主消费 -12%', '自耕农消费 +8%', '农民好感 +12', '工人好感 +10'],
    drawbacks: ['军事产出 -10%', '地主好感 -15', '骑士好感 -10'],
    modifiers: {
      needsReduction: 0.15,
      categories: { civic: 0.12, military: -0.10 },
      maxPop: 0.08,
      passive: { culture: 2 },
      stratumDemandMod: { landowner: -0.12, peasant: 0.08 },
      approval: { peasant: 12, worker: 10, artisan: 8, landowner: -15, knight: -10 },  // Social contract empowers commoners, limits nobility
    },
    active: false,
  },
  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    工业时代 (Epoch 6)                        ║
  // ║        机器生产，资本主义，劳工运动                           ║
  // ╚══════════════════════════════════════════════════════════════╝
  
  {
    id: 'factory_act',
    name: '工厂法',
    desc: '限制童工和女工工时，改善工厂安全条件。',
    category: 'social',
    unlockEpoch: 6,
    cost: {},
    effects: ['居民需求 -12%', '人口上限 +10%', '工人消费 +10%', '工具需求 -8%', '工人好感 +20'],
    drawbacks: ['工业产出 -8%', '每日 -4 银币监察费', '资本家好感 -12'],
    modifiers: {
      needsReduction: 0.12,
      maxPop: 0.10,
      categories: { industry: -0.08 },
      passivePercent: { silver: -0.04 },  // Inspection costs
      stratumDemandMod: { worker: 0.10 },
      resourceDemandMod: { tools: -0.08 },
      approval: { worker: 20, artisan: 10, miner: 15, capitalist: -12 },  // Factory act protects workers, costs capitalists
    },
    active: false,
  },
  {
    id: 'corn_laws_repeal',
    name: '废除谷物法',
    desc: '取消粮食进口关税，降低面包价格惠及工人。',
    category: 'economy',
    unlockEpoch: 6,
    cost: {},
    effects: ['居民需求 -10%', '工业产出 +10%', '工人消费 +12%', '粮食需求 -10%', '地主消费 -15%', '工人好感 +15'],
    drawbacks: ['采集产出 -12%', '农场产出 -10%', '地主好感 -20', '农民好感 -12'],
    modifiers: {
      needsReduction: 0.10,
      categories: { industry: 0.10, gather: -0.12 },
      buildings: { farm: -0.10 },
      stratumDemandMod: { worker: 0.12, landowner: -0.15 },
      resourceDemandMod: { food: -0.10 },
      approval: { worker: 15, artisan: 10, capitalist: 8, landowner: -20, peasant: -12 },  // Free trade benefits urban workers, harms farmers
    },
    active: false,
  },
  {
    id: 'laissez_faire',
    name: '自由放任',
    desc: '政府不干预经济，让市场自行调节。',
    category: 'economy',
    unlockEpoch: 6,
    cost: {},
    effects: ['工业产出 +18%', '市场产出 +20%', '资本家消费 +25%', '商人消费 +20%', '钢铁供应 +12%', '资本家好感 +20', '商人好感 +15'],
    drawbacks: ['公共服务 -12%', '居民需求 +8%', '工人好感 -15'],
    modifiers: {
      categories: { industry: 0.18, civic: -0.12 },
      buildings: { market: 0.20, factory: 0.15 },
      needsReduction: -0.08,
      stratumDemandMod: { capitalist: 0.25, merchant: 0.20 },
      resourceSupplyMod: { steel: 0.12 },
      approval: { capitalist: 20, merchant: 15, engineer: 8, worker: -15, miner: -10 },  // Laissez-faire benefits capitalists, harms workers
    },
    active: false,
  },
  {
    id: 'trade_union_act',
    name: '工会法案',
    desc: '承认工人结社权利，允许集体谈判工资条件。',
    category: 'social',
    unlockEpoch: 6,
    cost: {},
    effects: ['居民需求 -15%', '公共服务 +10%', '工人消费 +18%', '资本家消费 -15%', '工人好感 +25'],
    drawbacks: ['工业产出 -10%', '每日 -5 银币', '资本家好感 -20'],
    modifiers: {
      needsReduction: 0.15,
      categories: { civic: 0.10, industry: -0.10 },
      passivePercent: { silver: -0.05 },  // Union support
      stratumDemandMod: { worker: 0.18, capitalist: -0.15 },
      approval: { worker: 25, miner: 20, artisan: 15, capitalist: -20 },  // Union act empowers workers, angers capitalists
    },
    active: false,
  },
  {
    id: 'railway_boom',
    name: '铁路狂热',
    desc: '大规模投资铁路建设，连接城市与工业区。',
    category: 'economy',
    unlockEpoch: 6,
    cost: {},
    effects: ['采集产出 +15%', '工业产出 +15%', '军事产出 +10%', '工程师消费 +20%', '钢铁需求 +25%', '工人消费 +15%', '工程师好感 +18', '工人好感 +12'],
    drawbacks: ['每日 -12 银币建设维护'],
    modifiers: {
      categories: { gather: 0.15, industry: 0.15, military: 0.10 },
      passivePercent: { silver: -0.12 },  // Railway maintenance
      stratumDemandMod: { engineer: 0.20, worker: 0.15 },
      resourceDemandMod: { steel: 0.25 },
      approval: { engineer: 18, worker: 12, capitalist: 15, miner: 10 },  // Railway boom creates jobs and opportunities
    },
    active: false,
  },
  {
    id: 'mass_conscription',
    name: '全民皆兵',
    desc: '实行普遍义务兵役制，所有成年男性须服兵役。',
    category: 'military',
    unlockEpoch: 6,
    cost: {},
    effects: ['军事产出 +30%', '军事建筑 +25%', '军人消费 +25%', '食物需求 +18%', '工具需求 +20%', '军人好感 +15'],
    drawbacks: ['采集产出 -15%', '工业产出 -8%', '每日 -6 食物', '农民好感 -15', '工人好感 -10'],
    modifiers: {
      categories: { military: 0.30, gather: -0.15, industry: -0.08 },
      buildings: { barracks: 0.25, training_ground: 0.25, fortress: 0.20 },
      passivePercent: { food: -0.06 },  // Military rations
      stratumDemandMod: { soldier: 0.25 },
      resourceDemandMod: { food: 0.18, tools: 0.20 },
      approval: { soldier: 15, knight: 10, peasant: -15, worker: -10, artisan: -8 },  // Conscription disrupts civilian life
    },
    active: false,
  },
  {
    id: 'public_education_act',
    name: '义务教育',
    desc: '强制学龄儿童入学，由国家提供免费基础教育。',
    category: 'culture',
    unlockEpoch: 6,
    cost: {},
    effects: ['科研产出 +20%', '公共服务 +15%', '人口上限 +10%', '学者消费 +15%', '莎草纸需求 +15%', '学者好感 +15', '工人好感 +8'],
    drawbacks: ['每日 -10 银币教育经费'],
    modifiers: {
      buildings: { library: 0.20, university: 0.15 },
      categories: { civic: 0.15 },
      maxPop: 0.10,
      passivePercent: { silver: -0.10 },  // Education funding
      passive: { science: 2 },  // Knowledge generation
      stratumDemandMod: { scribe: 0.15 },
      resourceDemandMod: { papyrus: 0.15 },
      approval: { scribe: 15, worker: 8, peasant: 5, engineer: 10 },  // Public education benefits all but especially scholars
    },
    active: false,
  },
  {
    id: 'gold_standard',
    name: '金本位制',
    desc: '货币与黄金挂钩，固定汇率促进国际贸易。',
    category: 'economy',
    unlockEpoch: 6,
    cost: {},
    effects: ['市场/港口产出 +20%', '每日 +15 银币贸易利润', '商人消费 +15%', '香料需求 +12%', '咖啡需求 +10%', '商人好感 +15'],
    drawbacks: ['工业产出 -5%（货币紧缩）', '工人好感 -5'],
    modifiers: {
      buildings: {
        market: 0.20,
        trade_port: 0.20,
      },
      passivePercent: { silver: 0.15 },  // Trade profits
      categories: { industry: -0.05 },
      stratumDemandMod: { merchant: 0.15 },
      resourceDemandMod: { spice: 0.12, coffee: 0.10 },
      approval: { merchant: 15, capitalist: 10, worker: -5 },  // Gold standard benefits traders, may cause deflation for workers
    },
    active: false,
  },

  // ╔══════════════════════════════════════════════════════════════╗
  // ║                    通用政令（跨时代可用）                      ║
  // ║        基础治理政策，持续升级改进                              ║
  // ╚══════════════════════════════════════════════════════════════╝
  
  {
    id: 'tax_farming',
    name: '包税制',
    desc: '将征税权承包给私人，以固定款项换取收税权。',
    category: 'economy',
    unlockEpoch: 1,
    cost: {},
    effects: ['财政收入 +15%', '商人消费 +12%', '自耕农消费 -10%', '商人好感 +10'],
    drawbacks: ['居民需求 +10%', '公共服务 -8%', '农民好感 -15'],
    modifiers: {
      incomePercent: 0.15,
      needsReduction: -0.10,
      categories: { civic: -0.08 },
      stratumDemandMod: { merchant: 0.12, peasant: -0.10 },
      approval: { merchant: 10, peasant: -15, serf: -12 },  // Tax farming benefits merchants, burdens peasants
    },
    active: false,
  },
  {
    id: 'war_economy',
    name: '战时经济',
    desc: '将全部生产转入战争轨道，优先保障军需供应。',
    category: 'military',
    unlockEpoch: 2,
    cost: {},
    effects: ['军事产出 +35%', '工业产出 +12%', '军人消费 +30%', '工具需求 +25%', '工具供应 +15%', '军人好感 +20'],
    drawbacks: ['公共服务 -15%', '居民需求 +12%', '每日 -8 食物', '农民好感 -15', '商人好感 -10'],
    modifiers: {
      categories: { military: 0.35, industry: 0.12, civic: -0.15 },
      needsReduction: -0.12,
      passivePercent: { food: -0.08 },  // War supply consumption
      stratumDemandMod: { soldier: 0.30 },
      resourceDemandMod: { tools: 0.25 },
      resourceSupplyMod: { tools: 0.15 },
      approval: { soldier: 20, knight: 15, peasant: -15, merchant: -10, artisan: -8 },  // War economy favors military, burdens civilians
    },
    active: false,
  },
  {
    id: 'state_granary',
    name: '常平仓',
    desc: '政府设立粮仓，丰年收购余粮、荒年平价出售。',
    category: 'social',
    unlockEpoch: 1,
    cost: {},
    effects: ['居民需求 -10%', '每日 +3 食物储备效率', '粮食需求 -8%', '粮食供应 +8%', '农民好感 +10'],
    drawbacks: ['每日 -5 银币管理费'],
    modifiers: {
      needsReduction: 0.10,
      passivePercent: { food: 0.03, silver: -0.05 },  // Granary storage efficiency
      resourceDemandMod: { food: -0.08 },
      resourceSupplyMod: { food: 0.08 },
      approval: { peasant: 10, serf: 8 },  // Granary system protects farmers from famine
    },
    active: false,
  },
  {
    id: 'sumptuary_laws',
    name: '禁奢令',
    desc: '限制平民奢侈消费，规定不同等级的服饰住房标准。',
    category: 'social',
    unlockEpoch: 1,
    cost: {},
    effects: ['居民需求 -15%', '每日 +4 银币罚款', '奢侈品需求 -20%', '地主消费 -18%', '布料需求 -12%'],
    drawbacks: ['工业产出 -10%', '文化产出 -8%', '商人好感 -15', '工匠好感 -10'],
    modifiers: {
      needsReduction: 0.15,
      passivePercent: { silver: 0.04 },  // Fine revenue
      categories: { industry: -0.10 },
      passive_negative: { culture: -1.5 },
      stratumDemandMod: { landowner: -0.18 },
      resourceDemandMod: { delicacies: -0.20, fine_clothes: -0.20, cloth: -0.12 },
      approval: { merchant: -15, artisan: -10, landowner: -8 },  // Sumptuary laws restrict commerce and consumption
    },
    active: false,
  },
  {
    id: 'mercenary_contract',
    name: '雇佣军契约',
    desc: '雇佣职业军人作战，以金钱换取军事力量。',
    category: 'military',
    unlockEpoch: 2,
    cost: {},
    effects: ['军事产出 +20%', '军人消费 +15%', '工具需求 +12%', '军人好感 +12'],
    drawbacks: ['每日 -12 银币雇佣费'],
    modifiers: {
      categories: { military: 0.20 },
      passivePercent: { silver: -0.12 },  // Mercenary pay
      stratumDemandMod: { soldier: 0.15 },
      resourceDemandMod: { tools: 0.12 },
      approval: { soldier: 12 },  // Mercenary contracts benefit professional soldiers
    },
    active: false,
  },
  {
    id: 'colonial_exploitation',
    name: '殖民剥削',
    desc: '从海外殖民地大量榨取资源和劳动力。',
    category: 'economy',
    unlockEpoch: 4,
    cost: {},
    effects: ['每日 +0.6 香料/咖啡', '每日 +10 银币', '商人消费 +20%', '香料供应 +25%', '咖啡供应 +25%', '商人好感 +15', '资本家好感 +12'],
    drawbacks: ['公共服务 -12%', '居民需求 +8%'],
    modifiers: {
      passivePercent: { silver: 0.10 },  // Colonial revenue
      passive: { spice: 0.6, coffee: 0.6 },  // Exotic goods
      categories: { civic: -0.12 },
      needsReduction: -0.08,
      stratumDemandMod: { merchant: 0.20 },
      resourceSupplyMod: { spice: 0.25, coffee: 0.25 },
      approval: { merchant: 15, capitalist: 12, navigator: 10 },  // Colonial exploitation benefits trading classes
    },
    active: false,
  },
];
