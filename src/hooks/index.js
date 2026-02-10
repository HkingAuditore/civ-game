// 钩子统一导出文件
// 方便其他模块导入钩子

export { useGameState } from './useGameState';
export { useGameLoop } from './useGameLoop';
export { useGameActions } from './useGameActions';
export { useAchievements } from './useAchievements';
export { useSound } from './useSound';
export { useEpicTheme, useEpochClasses, getEpochStyles } from './useEpicTheme';
export { useNumberAnimation } from './useNumberAnimation';
export { useViewportHeight, getViewportHeight, vh } from './useViewportHeight';
export { useDevicePerformance, isLowPerformance, PERFORMANCE_MODES } from './useDevicePerformance';
export { useThrottledGameState, useThrottledSelector, UI_THROTTLE_PRESETS } from './useThrottledGameState';
export { useResponsiveLayout } from './useResponsiveLayout';
