// 游戏数据统一导出文件
// 将所有配置文件集中导出，方便其他模块导入

// 导入各个配置模块
import { EPOCHS } from './epochs';
import { STRATA } from './strata';
import { BUILDINGS } from './buildings';
import { GAME_SPEEDS, RESOURCES } from './gameConstants';
import { TECHS } from './technologies';
import { DECREES } from './decrees';
import { COUNTRIES } from './countries';
import { MILITARY_ACTIONS } from './militaryActions';
import { UNIT_TYPES, calculateArmyAdminCost, calculateArmyPopulation, simulateBattle, calculateBattlePower, calculateArmyFoodNeed, calculateArmyMaintenance } from './militaryUnits';


import { ICON_MAP } from './iconMap';

// 统一导出所有配置
export {
  // 游戏速度
  GAME_SPEEDS,
  
  // 时代配置
  EPOCHS,
  
  // 社会阶层
  STRATA,
  
  // 资源类型
  RESOURCES,
  
  // 外交国家
  COUNTRIES,
  
  // 建筑配置
  BUILDINGS,
  
  // 科技树
  TECHS,
  
  // 政令配置
  DECREES,

  // 固定军事行动
  MILITARY_ACTIONS,

  // 军事单位
  UNIT_TYPES,
  calculateArmyAdminCost,
  calculateArmyPopulation,
  simulateBattle,
  calculateBattlePower,
  calculateArmyFoodNeed,
  calculateArmyMaintenance,

  // 图标
  ICON_MAP,
};
