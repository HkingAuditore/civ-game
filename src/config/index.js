// 配置文件统一导出入口
// 提供便捷的导入方式

// 基础配置
export { GAME_SPEEDS, RESOURCES, ECONOMIC_INFLUENCE, WEALTH_DECAY_RATE, TAX_LIMITS, LOG_STORAGE_LIMIT, HISTORY_STORAGE_LIMIT } from './gameConstants';
export { EPOCHS } from './epochs';
export { STRATA } from './strata';
export { BUILDINGS } from './buildings';
export { TECHS } from './technologies';
export { COUNTRIES } from './countries';
export { MILITARY_ACTIONS, getEnemyUnitsForEpoch } from './militaryActions';
export { TUTORIAL_STEPS } from './tutorialSteps';
export { ACHIEVEMENTS } from './achievements';
export {
    DIPLOMACY_ERA_UNLOCK,
    TREATY_CONFIGS,
    TREATY_TYPE_LABELS,
    OPEN_MARKET_TREATY_TYPES,
    PEACE_TREATY_TYPES,
    ORGANIZATION_EFFECTS,
    DIPLOMACY_SOVEREIGNTY_TYPES,
    DIPLOMACY_ORGANIZATION_TYPES,
    OVERSEAS_BUILDING_MODES,
    DEFAULT_VASSAL_STATUS,
    getTreatyDuration,
    getTreatyBreachPenalty,
    isDiplomacyUnlocked,
    // 附庸系统配置
    VASSAL_TYPE_CONFIGS,
    VASSAL_TYPE_LABELS,
    getAutonomyEffects,
    calculateIndependenceDesire,
    // calculateTribute 已废弃，请使用 vassalSystem.js 中的 calculateEnhancedTribute
    VASSAL_TRANSITION_REQUIREMENTS,
    INDEPENDENCE_WAR_CONDITIONS,
    // 条约成本配置
    calculateTreatySigningCost,
    getTreatyDailyMaintenance,
    TREATY_COSTS,
} from './diplomacy';

// 建筑升级配置
export {
    BUILDING_UPGRADES,
    getBuildingEffectiveConfig,
    getMaxUpgradeLevel,
    getUpgradeCost
} from './buildingUpgrades';

// 事件系统
export {
    EVENTS,
    canTriggerEvent,
    getRandomEvent,
    createWarDeclarationEvent,
    createGiftEvent,
    createAIRequestEvent,
    createPeaceRequestEvent,
    createEnemyPeaceRequestEvent,
    createPlayerPeaceProposalEvent,
    createBattleEvent,
    createAllianceRequestEvent,
    createAllianceProposalResultEvent,
    createAllianceBreakEvent,
    createTreatyProposalEvent,
    createTreatyProposalResultEvent,
    createTreatyBreachEvent,
    createNationAnnexedEvent,
    BASE_EVENTS,
    EPOCH_EVENTS,
    CLASS_CONFLICT_EVENTS,
    ECONOMIC_EVENTS,
    STATIC_DIPLOMATIC_EVENTS,
    // 联盟加入诉求事件
    checkCoalitionDemandCondition,
    createCoalitionDemandEvent,
    checkAndCreateCoalitionDemandEvent,
    resetCoalitionEventCooldowns,
} from './events';
// 军事单位系统
export {
    UNIT_TYPES,
    UNIT_CATEGORIES,
    COUNTER_RELATIONS,
    calculateArmyFoodNeed,
    calculateBattlePower,
    calculateCounterBonus,
    calculateArmyMaintenance,
    calculateArmyCapacityNeed,
    calculateArmyPopulation,
    calculateArmyScalePenalty,
    calculateArmyMaintenanceCost,
    calculateTotalArmyExpense,
    calculateUnitExpense,
    generateNationArmy,
    calculateNationBattlePower,
    simulateBattle
} from './militaryUnits';


// 产业链系统
export {
    INDUSTRY_CHAINS,
    CHAIN_SYNERGIES,
    CHAIN_BOTTLENECKS,
    CHAIN_DEVELOPMENT_PATHS,
    CHAIN_NATION_BONUSES,
    CHAIN_DECREE_EFFECTS
} from './industryChains';

// 系统联动机制
export {
    NATION_DECREE_SYNERGIES,
    CLASS_DECREE_FEEDBACK,
    CHAIN_CLASS_INTERACTION,
    DECREE_COMBINATIONS,
    EPOCH_SYSTEM_EFFECTS,
    BALANCE_MECHANISMS,
    SYSTEM_TRIGGERED_EVENTS
} from './systemSynergies';

// 庆典效果配置
export { FESTIVAL_EFFECTS } from './festivalEffects';

// 官员系统
export {
    OFFICIAL_EFFECT_TYPES,
    OFFICIAL_DRAWBACK_TYPES,
    generateName,
    generateRandomOfficial,
    calculateOfficialSalary
} from './officials';
