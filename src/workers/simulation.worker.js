/**
 * Simulation Web Worker
 * 
 * Offloads the heavy simulateTick computation to a background thread,
 * keeping the main thread responsive for UI rendering.
 * 
 * Communication Protocol:
 * - Main → Worker: { type: 'SIMULATE', payload: gameState }
 * - Main → Worker: { type: 'SYNC_HISTORY', payload: { classWealthHistory, classNeedsHistory } }
 * - Main → Worker: { type: 'SYNC_CONFIG', payload: { equippedIdeologies, ideologySynergies, antiSynergies } }
 * - Main → Worker: { type: 'SET_DEBUG', payload: { enabled: boolean } }
 * - Main → Worker: { type: 'SET_UI_INTERVAL', payload: { interval: number } }
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

// [PERF] Worker内部静态配置缓存，避免每tick序列化传输不变的配置数据
// 仅在用户操作（装备/卸载理念等）时通过 SYNC_CONFIG 消息更新
let _configCache = {
    equippedIdeologies: null,
    ideologySynergies: null,
    antiSynergies: null,
};

// [PERF] tick 计数器：用于降频传输大型 UI 数据
// 每 tick postMessage 的结构化克隆是移动端 OOM 的主因（每次 1-3MB）
let _tickCounter = 0;

// [PERF] Delta Encoding：存储上一次传输的完整结果，用于计算增量
let _lastStrippedResult = null;

// Delta encoding 不参与比较的字段（每 tick 必定变化或为元数据）
const DELTA_SKIP_KEYS = new Set([
    '_perf', '_isFullTick', '_isDelta', '_auditLog',
    '_auditStartingSilver', '_auditEndingSilver', 'logs',
    'vassalDiplomacyRequests', '_cleanedNationIds',
]);

/**
 * [PERF] 计算当前结果与上一次结果的增量（顶层浅比较）
 * 仅传输发生变化的字段，大幅减少 structured clone 体积。
 * @param {Object} current - 当前 stripped 结果
 * @param {Object} last - 上一次传输的完整结果
 * @returns {{ delta: Object, fieldCount: number, totalFields: number }}
 */
function computeDelta(current, last) {
    if (!last) return { delta: current, fieldCount: Infinity, totalFields: 1 };

    const delta = {};
    let fieldCount = 0;
    let totalFields = 0;

    for (const key in current) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
        totalFields++;

        // 元数据/每tick必变字段始终包含
        if (DELTA_SKIP_KEYS.has(key)) {
            delta[key] = current[key];
            fieldCount++;
            continue;
        }

        const curVal = current[key];
        const lastVal = last[key];

        // 引用相等 → 跳过
        if (curVal === lastVal) continue;

        // null 比较
        if (curVal == null || lastVal == null) {
            delta[key] = curVal;
            fieldCount++;
            continue;
        }

        // 原始类型比较
        if (typeof curVal !== 'object') {
            if (curVal !== lastVal) {
                delta[key] = curVal;
                fieldCount++;
            }
            continue;
        }

        // 对象/数组：始终包含（深度比较成本太高）
        delta[key] = curVal;
        fieldCount++;
    }

    return { delta, fieldCount, totalFields };
}
// 基础间隔：每 N tick 传输一次完整 UI 数据（可由内存监控动态调整）
// 实际间隔 = _uiInterval × gameSpeed，使高速模式下传输更稀疏
let _uiInterval = 10;
let _gameSpeed = 1;

/**
 * [PERF] 剥离非必要数据，大幅减少 Worker→主线程的 postMessage 序列化体积
 *
 * 移动端 WebView 堆内存有限（256-512MB），每 tick 通过 postMessage
 * 深拷贝（structured clone）传输完整 simulation 结果是 OOM 的首要原因。
 *
 * 策略：
 * - 调试数据每 tick 都剥离（buildingDebugData, _perf.sections）
 * - modifiers.sources 保留（供 BuildingDetails / ResourceDetailModal 显示加成明细）
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

    // NOTE: modifiers.sources is NOT stripped here — it is needed by
    // BuildingDetails and ResourceDetailModal for bonus breakdown display.
    // It is already gated by _isFullTick in simulation.js (null on non-full ticks),
    // and the fullTickCacheRef in useGameLoop.js caches it for non-full ticks.

    // === 降频传输的大型 UI 数据 ===
    // 这些字段仅供面板/图表显示，不影响下一 tick 的 simulation 计算
    const uiInterval = _uiInterval * Math.max(1, _gameSpeed);
    const isFullTick = (_tickCounter % uiInterval) === 0;
    if (!isFullTick) {
        // buildingFinancialData: 每栋建筑的财务明细（主线程也只每10tick消费一次）
        stripped.buildingFinancialData = null;
        // classFinancialData: 每阶层的财务明细
        stripped.classFinancialData = null;
        // approvalBreakdown: 每阶层支持度分解
        stripped.approvalBreakdown = null;
        // needsReport 较小（仅 satisfactionRatio × 阶层数），保留每 tick 传输

        // [PERF] 额外剥离仅 UI 用的大型字段，主线程使用 fullTickCacheRef 缓存
        stripped.officials = null;
        stripped.activeFronts = null;
        stripped.activeBattles = null;
        stripped.foreignInvestmentStats = null;
        stripped.tradeOpportunities = null;

        // market 子字段：仅保留 prices/wages（simulation 下一 tick 必需），
        // 剥离 demand/supply/needsShortages 及所有 breakdown（仅 UI 用）
        if (stripped.market) {
            stripped.market = {
                prices: stripped.market.prices,
                wages: stripped.market.wages,
                // 以下字段仅供 UI 面板，降频传输
                demand: null,
                supply: null,
                needsShortages: null,
                stratumConsumption: null,
                supplyBreakdown: null,
                demandBreakdown: null,
                resourceLossBreakdown: null,
            };
        }

        // [PERF] modifiers: 非 full tick 仅保留 simulation 必需子集
        if (stripped.modifiers) {
            stripped.modifiers = {
                ideologyRuleMods: stripped.modifiers.ideologyRuleMods || null,
                officialEffects: stripped.modifiers.officialEffects || null,
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
                // Aggressive strip: remove heavy diagnostic/history sub-objects
                // NOTE: economyTraits MUST be preserved — it contains critical persistent
                // state (ownBasePopulation, lastGrowthTick, developmentRate, etc.) that
                // the AI economy system needs every tick.
                // NOTE: foreignPower MUST be preserved — simulation.js uses it every tick
                // (24 references) for AI nation economy calculations. Stripping it causes
                // foreignPower to be re-initialized every non-full tick, resetting AI data.
                const {
                    buildingProfile: _bp,
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

            // [PERF] 预计算 isFullTick，传入 simulateTick 以便跳过非必要计算
            const uiInterval = _uiInterval * Math.max(1, _gameSpeed);
            const isFullTickForSim = ((_tickCounter) % uiInterval) === 0;

            // [PERF] 从worker缓存注入history和静态配置数据，无需主线程每tick传输
            const enrichedPayload = {
                ...payload,
                classWealthHistory: _historyCache.classWealthHistory,
                classNeedsHistory: _historyCache.classNeedsHistory,
                _isFullTick: isFullTickForSim,
            };
            // [PERF] 注入缓存的静态配置（仅当主线程未传入时使用缓存）
            if (_configCache.equippedIdeologies != null && enrichedPayload.equippedIdeologies == null) {
                enrichedPayload.equippedIdeologies = _configCache.equippedIdeologies;
            }
            if (_configCache.ideologySynergies != null && enrichedPayload.ideologySynergies == null) {
                enrichedPayload.ideologySynergies = _configCache.ideologySynergies;
            }
            if (_configCache.antiSynergies != null && enrichedPayload.antiSynergies == null) {
                enrichedPayload.antiSynergies = _configCache.antiSynergies;
            }

            // Execute the simulation
            const result = simulateTick(enrichedPayload);
            
            // [PERF] 剥离非必要数据后再传输，大幅减少postMessage序列化开销
            // NOTE: must strip BEFORE incrementing _tickCounter, so that
            // stripPayloadForTransfer's isFullTick check uses the same
            // counter value as isFullTickForSim above.
            const stripped = stripPayloadForTransfer(result);
            _tickCounter++;

            // [PERF] Delta Encoding：仅传输与上一次结果不同的字段
            const { delta, fieldCount, totalFields } = computeDelta(stripped, _lastStrippedResult);
            // 如果 delta 字段数 >= 总字段数的 80%，回退到完整传输（delta 收益不大）
            const useDelta = _lastStrippedResult != null && totalFields > 0 && fieldCount < totalFields * 0.8;

            if (useDelta) {
                delta._isDelta = true;
                self.postMessage({ type: 'RESULT', payload: delta });
            } else {
                stripped._isDelta = false;
                self.postMessage({ type: 'RESULT', payload: stripped });
            }

            // 缓存本次完整结果供下一 tick delta 比较
            _lastStrippedResult = stripped;
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
    } else if (type === 'SYNC_CONFIG') {
        // [PERF] 低频同步：主线程仅在配置变化时发送静态配置更新
        if (payload) {
            if (payload.equippedIdeologies !== undefined) {
                _configCache.equippedIdeologies = payload.equippedIdeologies;
            }
            if (payload.ideologySynergies !== undefined) {
                _configCache.ideologySynergies = payload.ideologySynergies;
            }
            if (payload.antiSynergies !== undefined) {
                _configCache.antiSynergies = payload.antiSynergies;
            }
        }
    } else if (type === 'SET_DEBUG') {
        // 主线程可通知worker开启/关闭调试模式
        _debugEnabled = !!(payload && payload.enabled);
    } else if (type === 'SET_UI_INTERVAL') {
        // [PERF] 内存监控动态调整 UI 数据传输间隔
        if (payload && typeof payload.interval === 'number' && payload.interval >= 1) {
            _uiInterval = Math.max(1, Math.round(payload.interval));
        }
    } else if (type === 'PING') {
        // Health check - used to verify worker is responsive
        self.postMessage({ type: 'PONG' });
    }
};

// Signal that worker is ready
self.postMessage({ type: 'READY' });
