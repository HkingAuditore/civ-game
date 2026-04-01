/**
 * Simulation Web Worker
 * 
 * Offloads the heavy simulateTick computation to a background thread,
 * keeping the main thread responsive for UI rendering.
 * 
 * Communication Protocol:
 * - Main → Worker: { type: 'SIMULATE', payload: gameState }
 * - Main → Worker: { type: 'SYNC_HISTORY', payload: { classWealthHistory, classNeedsHistory } }
 * - Main → Worker: { type: 'SET_DEBUG', payload: { enabled: boolean } }
 * - Worker → Main: { type: 'RESULT', payload: simulationResult }
 * - Worker → Main: { type: 'ERROR', error: errorMessage }
 */

// ⚠️ 必须最先导入：为 Worker 环境注入 window/document 兼容垫片，
// 防止 gameanalytics SDK 在模块初始化时因 window 不存在而崩溃。
import './workerGlobals';

import { simulateTick } from '../logic/simulation';

// [PERF] Worker内部history缓存，避免每tick序列化传输大量历史数据
let _historyCache = {
    classWealthHistory: {},
    classNeedsHistory: {},
};

// [PERF] 调试模式标志：关闭时从传输payload中剔除大量调试数据
let _debugEnabled = false;

// [PERF] tick 计数器：用于降频传输大型 UI 数据
// 每 tick postMessage 的结构化克隆是移动端 OOM 的主因（每次 1-3MB）
let _tickCounter = 0;
// 基础间隔：每 10 tick 传输一次完整 UI 数据
// 实际间隔 = BASE_UI_INTERVAL × gameSpeed，使高速模式下传输更稀疏
const BASE_UI_INTERVAL = 10;
let _gameSpeed = 1;

/**
 * [PERF] 剥离非必要数据，大幅减少 Worker→主线程的 postMessage 序列化体积
 *
 * 移动端 WebView 堆内存有限（256-512MB），每 tick 通过 postMessage
 * 深拷贝（structured clone）传输完整 simulation 结果是 OOM 的首要原因。
 *
 * 策略：
 * - 调试数据每 tick 都剥离（buildingDebugData, _perf.sections, modifiers.sources）
 * - 大型 UI-only 数据每 UI_DATA_INTERVAL tick 才传输一次，其余 tick 设为 null
 *   （主线程已有降频机制，不影响显示）
 */
function stripPayloadForTransfer(result) {
    if (!result || _debugEnabled) return result;

    const stripped = { ...result };

    // === 每 tick 都剥离的调试/审计字段 ===
    delete stripped.buildingDebugData;
    delete stripped._debug;
    // NOTE: _auditLog must be preserved — it is the core data source for the
    // fiscal breakdown panel (财政收支). Only strip the debug-only audit fields.
    delete stripped._auditSilverAtSpread;

    if (stripped._perf) {
        stripped._perf = { totalMs: stripped._perf.totalMs };
    }

    if (stripped.modifiers) {
        // Strip the large `sources` sub-object (only used by debug UI)
        const { sources: _sources, ...functionalModifiers } = stripped.modifiers;
        stripped.modifiers = functionalModifiers;
    }

    // === 降频传输的大型 UI 数据 ===
    // 这些字段仅供面板/图表显示，不影响下一 tick 的 simulation 计算
    const uiInterval = BASE_UI_INTERVAL * Math.max(1, _gameSpeed);
    const isFullTick = (_tickCounter % uiInterval) === 0;
    if (!isFullTick) {
        // buildingFinancialData: 每栋建筑的财务明细（主线程也只每10tick消费一次）
        stripped.buildingFinancialData = null;
        // classFinancialData: 每阶层的财务明细
        stripped.classFinancialData = null;
        // approvalBreakdown: 每阶层支持度分解
        stripped.approvalBreakdown = null;
        // needsReport 较小（仅 satisfactionRatio × 阶层数），保留每 tick 传输

        // market 子字段：保留 prices/demand/supply/wages（simulation 必需），
        // 剥离仅 UI 用的大型 breakdown
        if (stripped.market) {
            stripped.market = {
                prices: stripped.market.prices,
                demand: stripped.market.demand,
                supply: stripped.market.supply,
                wages: stripped.market.wages,
                needsShortages: stripped.market.needsShortages,
                // 以下字段仅供 UI 面板，降频传输
                stratumConsumption: null,
                supplyBreakdown: null,
                demandBreakdown: null,
                resourceLossBreakdown: null,
            };
        }
    }

    // [PERF] Nations data stripping: reduce structured clone overhead
    // Always strip defeated nations to minimal stubs;
    // on non-full ticks, also strip heavy sub-fields from AI nations.
    if (Array.isArray(stripped.nations)) {
        stripped.nations = stripped.nations.map(n => {
            if (n.isDefeated || (n.population || 0) <= 0) {
                return { id: n.id, name: n.name, isDefeated: true, population: 0 };
            }
            // Keep all fields for player nation
            if (n.isPlayer || n.id === 'player') return n;
            if (!isFullTick) {
                // Aggressive strip: remove heavy diagnostic + economy sub-objects
                const {
                    buildingProfile: _bp,
                    foreignPower: _fp,
                    economyTraits: _et,
                    warHistory: _wh,
                    tradeHistory: _th,
                    priceHistory: _ph,
                    resourceHistory: _rh,
                    ...liteNation
                } = n;
                return liteNation;
            }
            return n;
        });
    }

    stripped._isFullTick = isFullTick;
    return stripped;
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = function(event) {
    const { type, payload } = event.data;
    
    if (type === 'SIMULATE') {
        try {
            // [PERF] 同步游戏速度（用于动态调整 UI 数据传输频率）
            if (payload._gameSpeed) _gameSpeed = payload._gameSpeed;
            // [PERF] 从worker缓存注入history数据，无需主线程每tick传输
            const enrichedPayload = {
                ...payload,
                classWealthHistory: _historyCache.classWealthHistory,
                classNeedsHistory: _historyCache.classNeedsHistory,
            };

            // Execute the simulation
            const result = simulateTick(enrichedPayload);
            _tickCounter++;
            
            // [PERF] 剥离非必要数据后再传输，大幅减少postMessage序列化开销
            self.postMessage({
                type: 'RESULT',
                payload: stripPayloadForTransfer(result)
            });
        } catch (error) {
            // Send error back to main thread
            self.postMessage({
                type: 'ERROR',
                error: error.message || 'Unknown simulation error'
            });
        }
    } else if (type === 'SYNC_HISTORY') {
        // [PERF] 低频同步：主线程每N个tick发送一次history更新
        if (payload) {
            if (payload.classWealthHistory) {
                _historyCache.classWealthHistory = payload.classWealthHistory;
            }
            if (payload.classNeedsHistory) {
                _historyCache.classNeedsHistory = payload.classNeedsHistory;
            }
        }
    } else if (type === 'SET_DEBUG') {
        // 主线程可通知worker开启/关闭调试模式
        _debugEnabled = !!(payload && payload.enabled);
    } else if (type === 'PING') {
        // Health check - used to verify worker is responsive
        self.postMessage({ type: 'PONG' });
    }
};

// Signal that worker is ready
self.postMessage({ type: 'READY' });
