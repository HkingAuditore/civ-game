// 组件统一导出文件
// 方便其他模块导入组件

// 通用组件
export { Icon, FloatingText } from './common/UIComponents';

// 游戏组件
export { CityMap } from './game/CityMap';

// 面板组件
export { ResourcePanel } from './panels/ResourcePanel';
export { StrataPanel } from './panels/StrataPanel';
export { LogPanel } from './panels/LogPanel';
export { SettingsPanel } from './panels/SettingsPanel';
export { default as EmpireScene } from './panels/EmpireScene';

// 标签页组件
export { BuildTab } from './tabs/BuildTab';
export { MilitaryTab } from './tabs/MilitaryTab';
export { TechTab } from './tabs/TechTab';
export { PoliticsTab } from './tabs/PoliticsTab';
export { DiplomacyTab } from './tabs/DiplomacyTab';

// 模态框组件
export { BattleResultModal } from './modals/BattleResultModal';
export { StratumDetailModal } from './modals/StratumDetailModal';
export { ResourceDetailModal } from './modals/ResourceDetailModal';
export { PopulationDetailModal } from './modals/PopulationDetailModal';
export { AnnualFestivalModal } from './modals/AnnualFestivalModal';
export { TutorialModal } from './modals/TutorialModal';
export { WikiModal } from './modals/WikiModal';
