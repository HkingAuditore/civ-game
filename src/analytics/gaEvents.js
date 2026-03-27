// GameAnalytics 事件名常量
// Design Event eventId 采用冒号分隔的层级结构，每段最长 32 字符

export const GA_EVENTS = {
    // ── 游戏生命周期 ──
    GAME_NEW: 'Game:NewGame',
    GAME_LOAD: 'Game:Load',
    GAME_SAVE: 'Game:Save',
    GAME_SAVE_AUTO: 'Game:AutoSave',
    GAME_RESET: 'Game:Reset',
    GAME_EXPORT: 'Game:Export',
    GAME_IMPORT: 'Game:Import',
    GAME_DIFFICULTY: 'Game:Difficulty',
    GAME_SCENARIO: 'Game:Scenario',

    // ── 建筑 ──
    BUILDING_BUY: 'Building:Buy',
    BUILDING_SELL: 'Building:Sell',
    BUILDING_UPGRADE: 'Building:Upgrade',
    BUILDING_DOWNGRADE: 'Building:Downgrade',
    BUILDING_BATCH_UPGRADE: 'Building:BatchUpgrade',
    BUILDING_BATCH_DOWNGRADE: 'Building:BatchDown',

    // ── 科技 ──
    TECH_RESEARCH: 'Tech:Research',

    // ── 时代 ──
    EPOCH_UPGRADE: 'Epoch:Upgrade',

    // ── 外交 ──
    DIPLOMACY_DECLARE_WAR: 'Diplomacy:DeclareWar',
    DIPLOMACY_PEACE: 'Diplomacy:Peace',
    DIPLOMACY_TREATY: 'Diplomacy:Treaty',
    DIPLOMACY_TRADE_ROUTE: 'Diplomacy:TradeRoute',
    DIPLOMACY_ALLIANCE: 'Diplomacy:Alliance',
    DIPLOMACY_VASSAL: 'Diplomacy:Vassal',
    DIPLOMACY_GIFT: 'Diplomacy:Gift',
    DIPLOMACY_TRADE: 'Diplomacy:Trade',
    DIPLOMACY_OTHER: 'Diplomacy:Action',
    DIPLOMACY_ANNEX: 'Diplomacy:Annex',

    // ── 附庸 ──
    VASSAL_APPROVE: 'Vassal:Approve',
    VASSAL_REJECT: 'Vassal:Reject',
    VASSAL_ORDER: 'Vassal:Order',

    // ── 和约 ──
    PEACE_ACCEPT: 'Peace:Accept',
    PEACE_REJECT: 'Peace:Reject',
    PEACE_PROPOSE: 'Peace:Propose',

    // ── 军事 ──
    MILITARY_RECRUIT: 'Military:Recruit',
    MILITARY_BATTLE_LAUNCH: 'Military:Battle:Launch',
    MILITARY_BATTLE_RESULT: 'Military:Battle',
    MILITARY_DISBAND: 'Military:Disband',
    MILITARY_DISBAND_ALL: 'Military:DisbandAll',
    MILITARY_CANCEL_TRAIN: 'Military:CancelTrain',
    MILITARY_CANCEL_ALL: 'Military:CancelAll',
    MILITARY_AUTO_REPLENISH: 'Military:AutoReplenish',
    MILITARY_WAGE_RATIO: 'Military:WageRatio',

    // ── 政治与稳定 ──
    STRATEGIC_ACTION: 'Strategic',
    DECREE_TOGGLE: 'Decree:Toggle',
    REBELLION_PHASE: 'Rebellion',
    REBELLION_ACTION: 'Rebellion:Action',
    REBELLION_COALITION: 'Rebellion:Coalition',
    OFFICIAL_HIRE: 'Official:Hire',
    OFFICIAL_FIRE: 'Official:Fire',
    OFFICIAL_SALARY: 'Official:Salary',
    OFFICIAL_MINISTER: 'Official:Minister',
    COALITION_CHANGE: 'Coalition:Change',

    // ── 税收与政策 ──
    TAX_CHANGE: 'Tax:Change',
    POLICY_PRICE_CONTROL: 'Policy:PriceControl',

    // ── 贸易 ──
    TRADE_PREFERENCE: 'Trade:Preference',
    TRADE_MERCHANT: 'Trade:Merchant',
    TRADE_ROUTE_MODE: 'Trade:RouteMode',

    // ── 事件系统 ──
    EVENT_CHOOSE: 'Event:Choose',

    // ── 手动采集 ──
    ACTION_GATHER: 'Action:ManualGather',

    // ── 理念 ──
    IDEOLOGY_EQUIP: 'Ideology:Equip',
    IDEOLOGY_UNEQUIP: 'Ideology:Unequip',
    IDEOLOGY_EMERGENCE_SELECT: 'Ideology:EmergenceSelect',
    IDEOLOGY_EMERGENCE_SKIP: 'Ideology:EmergenceSkip',

    // ── 成就 ──
    ACHIEVEMENT_UNLOCK: 'Achievement:Unlock',

    // ── 周期采样指标 ──
    ECONOMY_GDP: 'Economy:GDP',
    ECONOMY_CPI: 'Economy:CPI',
    ECONOMY_PPI: 'Economy:PPI',
    ECONOMY_TREASURY: 'Economy:Treasury',
    ECONOMY_CRISIS: 'Economy:Crisis',
    POPULATION_TOTAL: 'Population:Total',
    POPULATION_MILESTONE: 'Population:Milestone',
    POPULATION_EXODUS: 'Population:Exodus',
    POPULATION_STARVATION: 'Population:Starvation',
    STABILITY_LEVEL: 'Stability:Level',
    STABILITY_CHANGE: 'Stability:LevelChange',
    LEGITIMACY_CHANGE: 'Legitimacy:Change',
    MILITARY_ARMY_SIZE: 'Military:ArmySize',

    // ── 周期经济流水采样 ──
    ECON_FLOW_TAX: 'EconFlow:Tax',
    ECON_FLOW_TRADE: 'EconFlow:Trade',
    ECON_FLOW_MILITARY: 'EconFlow:Military',
    ECON_FLOW_BUILDING: 'EconFlow:Building',
    ECON_FLOW_OFFICIAL: 'EconFlow:Official',

    // ── 市场价格采样 ──
    PRICE_FOOD: 'Price:food',
    PRICE_WOOD: 'Price:wood',
    PRICE_STONE: 'Price:stone',
    PRICE_IRON: 'Price:iron',
    PRICE_CLOTH: 'Price:cloth',
    PRICE_TOOLS: 'Price:tools',

    // ── 诉求系统 ──
    DEMAND_GENERATE: 'Demand:Generate',
    DEMAND_COMPLETE: 'Demand:Complete',
    DEMAND_FAIL: 'Demand:Fail',

    // ── 组织度 ──
    ORGANIZATION_PHASE: 'Organization:Phase',

    // ── AI 行为 ──
    AI_WAR: 'AI:War',
    AI_PEACE: 'AI:Peace',

    // ── 条约 ──
    TREATY_SIGN: 'Treaty:Sign',
    TREATY_EXPIRE: 'Treaty:Expire',
    TREATY_BREAK: 'Treaty:Break',

    // ── UI 导航 ──
    UI_TAB: 'UI:Tab',
    UI_SUB_TAB: 'UI:SubTab',
    UI_SPEED: 'UI:Speed',
    UI_PAUSE: 'UI:Pause',
    UI_RESUME: 'UI:Resume',
    UI_PIN_BUILDING: 'UI:Pin:Building',
    UI_FILTER_BUILDING: 'UI:Filter:Building',
    UI_DETAIL: 'UI:Detail',
    UI_TUTORIAL: 'UI:Tutorial',
    UI_WIKI: 'UI:Wiki',
    UI_SETTINGS: 'UI:Settings',
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
