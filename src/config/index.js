// 配置文件统一导出入口
// 提供便捷的导入方式

// 基础配置
export { GAME_SPEEDS, RESOURCES, ECONOMIC_INFLUENCE } from './gameConstants';
export { EPOCHS } from './epochs';
export { STRATA } from './strata';
export { BUILDINGS } from './buildings';
export { TECHS } from './technologies';
export { DECREES } from './decrees';
export { COUNTRIES } from './countries';
export { MILITARY_ACTIONS } from './militaryActions';
export { TUTORIAL_STEPS } from './tutorialSteps';

// 事件系统
export { 
  EVENTS, 
  canTriggerEvent, 
  getRandomEvent,
  createWarDeclarationEvent,
  createGiftEvent,
  createPeaceRequestEvent,
  createBattleEvent,
} from './events';

// 军事单位系统
export { 
  UNIT_TYPES,
  calculateArmyFoodNeed,
  calculateBattlePower,
  calculateCounterBonus,
  calculateArmyMaintenance,
  calculateArmyAdminCost,
  calculateArmyCapacityNeed,
  calculateArmyPopulation,
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
