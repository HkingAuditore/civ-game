// Zustand Store 统一导出入口
// 按业务领域拆分的状态管理 store

export { useUIStore } from './useUIStore';
export { useResourceStore } from './useResourceStore';
export { usePopulationStore } from './usePopulationStore';
export { useBuildingStore } from './useBuildingStore';
export { useEconomyStore } from './useEconomyStore';
export { useMilitaryStore } from './useMilitaryStore';
export { useDiplomacyStore } from './useDiplomacyStore';
export { usePoliticsStore } from './usePoliticsStore';
export { useOfficialStore } from './useOfficialStore';
export { useEventStore } from './useEventStore';
export { useTradeStore } from './useTradeStore';

// 兼容桥接工具
export { getStoreSnapshot, applyStoreSnapshot, batchStoreUpdate } from './storeUtils';

// 同步层（useGameState → Zustand stores 单向同步）
export { useStoreSync, syncAllStoresToSnapshot } from './useStoreSync';

// 桥接工具（组件迁移辅助）
export { useStoreField, useStoreFields, getStoreAccessor } from './useStoreBridge';
