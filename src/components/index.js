// 组件统一导出文件
// 方便其他模块导入组件

// 通用组件
export { Icon, FloatingText } from './common/UIComponents';
export { BattleNotification } from './common/BattleNotification';
export { ResponsiveModal } from './common/ResponsiveModal';

// 统一UI组件
export {
    Button,
    Card,
    Modal,
    Input,
    Badge,
    Divider,
    ListItem,
    ProgressBar,
    Tabs,
    InfoCard as UnifiedInfoCard,
    CollapsibleCard as UnifiedCollapsibleCard,
    ActionCard as UnifiedActionCard,
    StatsGrid,
} from './common/UnifiedUI';

// 动态效果组件
export {
    FloatingParticles,
    LightSweep,
    PulseRing,
    GridBackground,
    DynamicGradient,
    BorderGlow,
    StarField,
    HoverCard,
    ProgressGlow,
    RippleEffect,
    EpicBackground,
} from './common/DynamicEffects';

// 增强卡片组件
export {
    EnhancedCard,
    InfoCard,
    ListCard,
    CollapsibleCard,
    ActionCard,
    ProgressCard,
    CardGrid,
} from './common/EnhancedCards';

// 布局组件
export { StatusBar } from './layout/StatusBar';
export { BottomNav } from './layout/BottomNav';
export { GameControls } from './layout/GameControls';

// 游戏组件
export { CityMap } from './game/CityMap';

// 面板组件
export { ResourcePanel } from './panels/ResourcePanel';
export { StrataPanel } from './panels/StrataPanel';
export { StratumDetailSheet } from './panels/StratumDetailSheet';
export { LogPanel } from './panels/LogPanel';
export { SettingsPanel } from './panels/SettingsPanel';
export { default as EmpireScene } from './panels/EmpireScene';
export { default as RebellionPanel } from './panels/RebellionPanel';
export { default as MigrationPanel } from './panels/MigrationPanel';
export { default as EraProgressionPanel } from './panels/EraProgressionPanel';

// 标签页组件
export { BuildTab } from './tabs/BuildTab';
export { MilitaryTab } from './tabs/MilitaryTab';
export { TechTab } from './tabs/TechTab';
export { PoliticsTab } from './tabs/PoliticsTab';
export { DiplomacyTab } from './tabs/DiplomacyTab';
export { OverviewTab } from './tabs/OverviewTab';

// 模态框组件
export { BattleResultModal } from './modals/BattleResultModal';
export { StratumDetailModal } from './modals/StratumDetailModal';
export { ResourceDetailModal } from './modals/ResourceDetailModal';
export { PopulationDetailModal } from './modals/PopulationDetailModal';
export { AnnualFestivalModal } from './modals/AnnualFestivalModal';
export { TutorialModal } from './modals/TutorialModal';
export { WikiModal } from './modals/WikiModal';
export { CardDetailModal } from './modals/CardDetailModal';
export { DeclareWarModal } from './modals/DeclareWarModal';
