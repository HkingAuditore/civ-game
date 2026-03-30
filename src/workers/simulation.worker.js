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

/**
 * [PERF] 剥离调试数据，减少Worker→主线程的传输体积
 * 在非调试模式下移除 buildingDebugData、_perf.sections、modifiers.sources 等
 * @param {Object} result - simulateTick的完整返回值
 * @returns {Object} 精简后的返回值
 */
function stripDebugData(result) {
    if (!result || _debugEnabled) return result;

    const stripped = { ...result };
    // 移除大型调试字段
    delete stripped.buildingDebugData;

    // 保留 _perf.totalMs 但移除详细 sections
    if (stripped._perf) {
        stripped._perf = { totalMs: stripped._perf.totalMs };
    }

    // 精简 modifiers：保留功能字段但移除 sources 分解
    if (stripped.modifiers) {
        const { sources: _sources, ...functionalModifiers } = stripped.modifiers;
        stripped.modifiers = functionalModifiers;
    }

    return stripped;
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = function(event) {
    const { type, payload } = event.data;
    
    if (type === 'SIMULATE') {
        try {
            // [PERF] 从worker缓存注入history数据，无需主线程每tick传输
            const enrichedPayload = {
                ...payload,
                classWealthHistory: _historyCache.classWealthHistory,
                classNeedsHistory: _historyCache.classNeedsHistory,
            };

            // Execute the simulation
            const result = simulateTick(enrichedPayload);
            
            // [PERF] 剥离调试数据后再传输，减少postMessage序列化开销
            self.postMessage({
                type: 'RESULT',
                payload: stripDebugData(result)
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
