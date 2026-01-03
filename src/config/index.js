// 配置文件统一导出入口
// 提供便捷的导入方式

// 基础配置
export { GAME_SPEEDS, RESOURCES, ECONOMIC_INFLUENCE, WEALTH_DECAY_RATE, TAX_LIMITS } from './gameConstants';
export { EPOCHS } from './epochs';
export { STRATA } from './strata';
export { BUILDINGS } from './buildings';
export { TECHS } from './technologies';
export { COUNTRIES } from './countries';
export { MILITARY_ACTIONS, getEnemyUnitsForEpoch } from './militaryActions';
export { TUTORIAL_STEPS } from './tutorialSteps';
export { ACHIEVEMENTS } from './achievements';

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
