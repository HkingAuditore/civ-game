// GameAnalytics 事件名常量
// Design Event eventId 采用冒号分隔的层级结构，每段最长 32 字符

export const GA_EVENTS = {
    // 游戏生命周期
    GAME_NEW: 'Game:NewGame',
    GAME_LOAD: 'Game:Load',
    GAME_SAVE: 'Game:Save',
    GAME_RESET: 'Game:Reset',

    // 建筑
    BUILDING_BUY: 'Building:Buy',
    BUILDING_SELL: 'Building:Sell',
    BUILDING_UPGRADE: 'Building:Upgrade',

    // 科技
    TECH_RESEARCH: 'Tech:Research',

    // 时代
    EPOCH_UPGRADE: 'Epoch:Upgrade',

    // 外交
    DIPLOMACY_DECLARE_WAR: 'Diplomacy:DeclareWar',
    DIPLOMACY_PEACE: 'Diplomacy:Peace',
    DIPLOMACY_TREATY: 'Diplomacy:Treaty',
    DIPLOMACY_TRADE_ROUTE: 'Diplomacy:TradeRoute',
    DIPLOMACY_ALLIANCE: 'Diplomacy:Alliance',
    DIPLOMACY_VASSAL: 'Diplomacy:Vassal',
    DIPLOMACY_GIFT: 'Diplomacy:Gift',
    DIPLOMACY_TRADE: 'Diplomacy:Trade',
    DIPLOMACY_OTHER: 'Diplomacy:Action',

    // 军事
    MILITARY_RECRUIT: 'Military:Recruit',
    MILITARY_BATTLE_LAUNCH: 'Military:Battle:Launch',
    MILITARY_BATTLE_RESULT: 'Military:Battle',
    MILITARY_DISBAND: 'Military:Disband',

    // 政治与稳定
    STRATEGIC_ACTION: 'Strategic',
    DECREE_TOGGLE: 'Decree:Toggle',
    REBELLION_PHASE: 'Rebellion',
    OFFICIAL_HIRE: 'Official:Hire',
    OFFICIAL_FIRE: 'Official:Fire',

    // 成就
    ACHIEVEMENT_UNLOCK: 'Achievement:Unlock',

    // 周期采样
    ECONOMY_GDP: 'Economy:GDP',
    ECONOMY_CPI: 'Economy:CPI',
    ECONOMY_TREASURY: 'Economy:Treasury',
    POPULATION_TOTAL: 'Population:Total',
    STABILITY_LEVEL: 'Stability:Level',
    MILITARY_ARMY_SIZE: 'Military:ArmySize',
};

// Resource Event itemType 白名单（需在初始化时配置）
export const GA_RESOURCE_ITEM_TYPES = [
    'tax', 'trade', 'building', 'military', 'tech',
    'diplomacy', 'event', 'gather', 'production', 'decree',
];

// Resource Event currency 白名单
export const GA_RESOURCE_CURRENCIES = ['silver', 'science', 'culture'];

// Progression Event 前缀
export const GA_PROGRESSION_PREFIX = 'Epoch';

// 将内部 reason 映射为 GA itemType
export const REASON_TO_ITEM_TYPE = {
    build_purchase: 'building',
    building_upgrade: 'building',
    tech_research: 'tech',
    upgrade_epoch: 'tech',
    recruit_unit: 'military',
    diplomatic_gift: 'diplomacy',
    diplomatic_trade: 'diplomacy',
    tax_income: 'tax',
    trade_income: 'trade',
    decree_cost: 'decree',
    event_reward: 'event',
    manual_gather: 'gather',
};
