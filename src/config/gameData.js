// 游戏数据统一导出文件
// 将所有配置文件集中导出，方便其他模块导入

// 导入各个配置模块
import { EPOCHS } from './epochs';
import { STRATA } from './strata';
import { BUILDINGS } from './buildings';
import { GAME_SPEEDS, RESOURCES } from './gameConstants';
import { TECHS } from './technologies';
import { COUNTRIES } from './countries';
import { MILITARY_ACTIONS } from './militaryActions';
import { 
  INDUSTRY_CHAINS, 
  CHAIN_SYNERGIES, 
  CHAIN_BOTTLENECKS, 
  CHAIN_DEVELOPMENT_PATHS,
  CHAIN_NATION_BONUSES,
  CHAIN_DECREE_EFFECTS 
} from './industryChains';
import {
  NATION_DECREE_SYNERGIES,
  CLASS_DECREE_FEEDBACK,
  CHAIN_CLASS_INTERACTION,
  DECREE_COMBINATIONS,
  EPOCH_SYSTEM_EFFECTS,
  BALANCE_MECHANISMS,
  SYSTEM_TRIGGERED_EVENTS
} from './systemSynergies';

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
  
  // 固定军事行动
  MILITARY_ACTIONS,

  // 产业链系统
  INDUSTRY_CHAINS,
  CHAIN_SYNERGIES,
  CHAIN_BOTTLENECKS,
  CHAIN_DEVELOPMENT_PATHS,
  CHAIN_NATION_BONUSES,
  CHAIN_DECREE_EFFECTS,

  // 系统联动机制
  NATION_DECREE_SYNERGIES,
  CLASS_DECREE_FEEDBACK,
  CHAIN_CLASS_INTERACTION,
  DECREE_COMBINATIONS,
  EPOCH_SYSTEM_EFFECTS,
  BALANCE_MECHANISMS,
  SYSTEM_TRIGGERED_EVENTS,
};
