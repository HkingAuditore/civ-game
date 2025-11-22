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
    desc: "散居山林的部族，依靠掠夺捕猎为生。",
    appearEpoch: 0,
    expireEpoch: 1,
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
    desc: "愿意交换基础物资的和平部落。",
    appearEpoch: 0,
    expireEpoch: 2,
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
    desc: "掌控铜矿与香料通道的青铜时代富饶城邦。",
    appearEpoch: 1,
    expireEpoch: 3,
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
    desc: "讲求理性与艺术的古典城邦联盟，纸草与戏剧出口旺盛。",
    appearEpoch: 2,
    expireEpoch: 4,
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
    desc: "拥有骑士庄园与铁矿的封建强权，对土地要求苛刻。",
    appearEpoch: 3,
    expireEpoch: 4,
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
    desc: "远航冒险家组成的舰队国，以香料与木材换取武器。",
    appearEpoch: 4,
    expireEpoch: 5,
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
    desc: "咖啡馆、印刷术和学者构成的启蒙政体，热衷文化辩论。",
    appearEpoch: 5,
    expireEpoch: 6,
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
    desc: "控制煤田与钢铁的工业寡头，建造铁路赚取巨额利润。",
    appearEpoch: 6,
    expireEpoch: 7,
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
];
