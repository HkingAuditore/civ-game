/**
 * useSimulationWorker Hook
 * 
 * Manages the simulation Web Worker lifecycle with automatic fallback
 * to main-thread execution if the worker fails.
 * 
 * Benefits:
 * - Offloads heavy simulation to background thread
 * - Keeps UI responsive during complex calculations
 * - Automatic fallback for older browsers or if worker fails
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { simulateTick } from '../logic/simulation';
import { trackErrorWarning, trackErrorError } from '../analytics/gaTracker';
import { getOtaInfoSync } from '../utils/otaInfo';

// Import worker using Vite's worker import syntax
// This tells Vite to bundle the worker separately
import SimulationWorker from '../workers/simulation.worker.js?worker';

// ── Worker health tracking constants ──
const WORKER_FAIL_COUNT_KEY = 'civ_worker_fail_count';
const WORKER_DISABLED_KEY = 'civ_worker_disabled';
const WORKER_MAX_CONSECUTIVE_FAILS = 3;
const CRASH_LOG_KEY = 'civ_crash_log';
const CRASH_HISTORY_KEY = 'civ_crash_history';
const MAX_CRASH_HISTORY = 20;

/** Safe localStorage helpers (same pattern as crashReporter.js) */
function _safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function _safeSet(key, v) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

/** Check if Worker has been disabled by consecutive-failure circuit breaker */
function isWorkerCircuitBroken() {
    return _safeGet(WORKER_DISABLED_KEY) === 'true';
}

/** Increment fail counter; if >= threshold, set disabled flag */
function recordWorkerFail() {
    const count = (parseInt(_safeGet(WORKER_FAIL_COUNT_KEY), 10) || 0) + 1;
    _safeSet(WORKER_FAIL_COUNT_KEY, String(count));
    if (count >= WORKER_MAX_CONSECUTIVE_FAILS) {
        _safeSet(WORKER_DISABLED_KEY, 'true');
        console.warn(`[SimulationWorker] Circuit breaker: disabled after ${count} consecutive failures`);
    }
    return count;
}

/** Reset fail counter on successful Worker startup */
function resetWorkerFailCount() {
    _safeSet(WORKER_FAIL_COUNT_KEY, '0');
}

/** Persist a Worker health event to civ_crash_log + history (mirrors crashReporter pattern) */
function persistWorkerHealthEvent(eventType, details = {}) {
    const otaInfo = getOtaInfoSync();
    const record = {
        type: eventType,
        message: details.message || eventType,
        timestamp: Date.now(),
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
        isOTA: otaInfo.isOTA,
        bundleVersion: otaInfo.bundleVersion,
        importMetaUrl: details.importMetaUrl || '',
        baseURI: typeof document !== 'undefined' ? document.baseURI : '',
        ...details.extra,
    };
    // Write to civ_crash_log (latest)
    _safeSet(CRASH_LOG_KEY, JSON.stringify(record));
    // Append to history ring buffer
    try {
        const raw = _safeGet(CRASH_HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        history.push(record);
        while (history.length > MAX_CRASH_HISTORY) history.shift();
        _safeSet(CRASH_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
}

/**
 * Hook to manage simulation execution with Worker fallback
 * @returns {Object} { runSimulation, isUsingWorker, workerError }
 */
export function useSimulationWorker() {
    const workerRef = useRef(null);
    const pendingResolveRef = useRef(null);
    const pendingRejectRef = useRef(null);
    const pendingLatestRef = useRef(null);
    const [isUsingWorker, setIsUsingWorker] = useState(false);
    const [workerError, setWorkerError] = useState(null);
    const isInitializedRef = useRef(false);
    const lastExecTimeRef = useRef(1000);
    const sendTimeRef = useRef(0);
    // [PERF] Delta Encoding: 存储上一次完整结果，用于合并 Worker 发来的增量
    const lastFullResultRef = useRef(null);

    // Initialize worker on mount
    useEffect(() => {
        // HMR safety: if Fast Refresh preserved the ref but the old Worker
        // was terminated during cleanup, we need to re-initialize.
        if (isInitializedRef.current) {
            // Check if the Worker is still alive
            if (workerRef.current) {
                try {
                    workerRef.current.postMessage({ type: 'PING' });
                    return; // Worker is still alive, skip re-init
                } catch {
                    // Worker was terminated or broken, fall through to re-init
                    console.warn('[SimulationWorker] HMR: stale Worker detected, re-initializing');
                    workerRef.current = null;
                    setIsUsingWorker(false);
                }
            } else {
                // Ref says initialized but no Worker — need to re-init
                console.warn('[SimulationWorker] HMR: Worker ref lost, re-initializing');
            }
        }
        isInitializedRef.current = true;

        // Circuit breaker: skip Worker entirely if it failed too many times in a row
        if (isWorkerCircuitBroken()) {
            console.warn('[SimulationWorker] Circuit breaker active — skipping Worker, using main thread');
            setWorkerError('Worker disabled by circuit breaker (consecutive failures)');
            setIsUsingWorker(false);
            persistWorkerHealthEvent('worker_circuit_broken', {
                message: 'Worker disabled by circuit breaker, using main thread',
                importMetaUrl: import.meta.url,
            });
            return;
        }

        // OTA fallback Worker filename (must match vite.config.js worker.rollupOptions.output.entryFileNames)
        const OTA_WORKER_FILENAME = 'assets/simulation.worker.js';

        /**
         * Attach standard message/error handlers to a Worker instance.
         */
        function attachWorkerHandlers(worker) {
            worker.onmessage = (event) => {
                const { type, payload, error } = event.data;

                switch (type) {
                    case 'READY':
                        setIsUsingWorker(true);
                        console.warn('[SimulationWorker] Worker ready');
                        // Health: reset fail counter & persist success event
                        resetWorkerFailCount();
                        persistWorkerHealthEvent('worker_ready', {
                            message: 'Worker initialized successfully',
                            importMetaUrl: import.meta.url,
                        });
                        break;

                    case 'RESULT': {
                        if (sendTimeRef.current > 0) {
                            lastExecTimeRef.current = Math.max(500, Date.now() - sendTimeRef.current);
                        }
                        // [PERF] Delta Encoding: 如果收到的是增量，合并到上一次完整结果
                        let resolvedPayload = payload;
                        if (payload && payload._isDelta === true && lastFullResultRef.current) {
                            resolvedPayload = { ...lastFullResultRef.current, ...payload };
                        }
                        // 缓存完整结果供下次 delta 合并
                        if (resolvedPayload && resolvedPayload._isDelta !== undefined) {
                            lastFullResultRef.current = resolvedPayload;
                        }
                        if (pendingResolveRef.current) {
                            pendingResolveRef.current(resolvedPayload);
                            pendingResolveRef.current = null;
                            pendingRejectRef.current = null;
                        }
                        if (pendingLatestRef.current && workerRef.current && isUsingWorker) {
                            const { gameState: queuedState, resolve, reject } = pendingLatestRef.current;
                            pendingLatestRef.current = null;
                            try {
                                workerRef.current.postMessage({
                                    type: 'SIMULATE',
                                    payload: queuedState
                                });
                                pendingResolveRef.current = resolve;
                                pendingRejectRef.current = reject;
                            } catch (error) {
                                pendingResolveRef.current = null;
                                pendingRejectRef.current = null;
                                reject(error);
                            }
                        }
                        break;
                    }
                    case 'ERROR':
                        console.error('[SimulationWorker] Worker error:', error);
                        if (pendingRejectRef.current) {
                            pendingRejectRef.current(new Error(error));
                            pendingResolveRef.current = null;
                            pendingRejectRef.current = null;
                        }
                        if (pendingLatestRef.current) {
                            pendingLatestRef.current.reject(new Error(error));
                            pendingLatestRef.current = null;
                        }
                        break;

                    case 'PONG':
                        // Worker is alive - used for health checks
                        break;
                }
            };

            worker.onerror = (workerErr) => {
                console.error('[SimulationWorker] Worker crashed:', workerErr);
                setWorkerError(workerErr.message || 'Worker crashed');
                setIsUsingWorker(false);

                // Health: record failure for circuit breaker
                const failCount = recordWorkerFail();
                persistWorkerHealthEvent('worker_crash', {
                    message: `Worker crashed (fail #${failCount}): ${workerErr.message || 'unknown'}`,
                    importMetaUrl: import.meta.url,
                    extra: { failCount },
                });

                // Reject any pending promise
                if (pendingRejectRef.current) {
                    pendingRejectRef.current(new Error('Worker crashed'));
                    pendingResolveRef.current = null;
                    pendingRejectRef.current = null;
                }
                if (pendingLatestRef.current) {
                    pendingLatestRef.current.reject(new Error('Worker crashed'));
                    pendingLatestRef.current = null;
                }
            };
        }

        /**
         * Try creating Worker via OTA fallback path using document.baseURI.
         * Returns the Worker instance or null if it also fails.
         */
        function tryOtaFallbackWorker() {
            try {
                const base = document.baseURI || location.href;
                const fallbackUrl = new URL(OTA_WORKER_FILENAME, base).href;
                console.warn('[SimulationWorker] Trying OTA fallback path:', fallbackUrl);
                const fallbackWorker = new Worker(fallbackUrl, { type: 'module' });
                return fallbackWorker;
            } catch (fallbackErr) {
                console.error('[SimulationWorker] OTA fallback path also failed:', fallbackErr);
                trackErrorWarning(
                    `WorkerOTAPathFail: ${fallbackErr.message || 'fallback failed'} | importMetaUrl=${import.meta.url} | baseURI=${document.baseURI}`
                );
                return null;
            }
        }

        try {
            // Primary: create worker via Vite's ?worker import
            const worker = new SimulationWorker();
            attachWorkerHandlers(worker);
            workerRef.current = worker;
        } catch (primaryError) {
            console.warn('[SimulationWorker] Primary worker creation failed, trying OTA fallback:', primaryError);

            // OTA fallback: use document.baseURI + fixed filename
            const fallbackWorker = tryOtaFallbackWorker();
            if (fallbackWorker) {
                attachWorkerHandlers(fallbackWorker);
                workerRef.current = fallbackWorker;
                trackErrorWarning(
                    `WorkerOTAPathOK: primary failed but fallback succeeded | importMetaUrl=${import.meta.url} | baseURI=${document.baseURI}`
                );
            } else {
            // Both paths failed → main thread fallback
                trackErrorWarning(`WorkerError: ${primaryError.message || 'Failed to create worker'}`);
                setWorkerError(primaryError.message || 'Failed to create worker');
                setIsUsingWorker(false);

                // Health: record creation failure for circuit breaker
                const failCount = recordWorkerFail();
                persistWorkerHealthEvent('worker_create_fail', {
                    message: `Worker creation failed (fail #${failCount}): ${primaryError.message || 'unknown'}`,
                    importMetaUrl: import.meta.url,
                    extra: { failCount },
                });
            }
        }
        
        // Cleanup on unmount (including HMR)
        return () => {
            // Reject all pending promises before terminating
            if (pendingResolveRef.current) {
                // Don't call reject — just silently discard to avoid error noise during HMR
                pendingResolveRef.current = null;
            }
            if (pendingRejectRef.current) {
                try { pendingRejectRef.current(new Error('Worker terminated (HMR/unmount)')); } catch { /* ignore */ }
                pendingRejectRef.current = null;
            }
            if (pendingLatestRef.current) {
                try { pendingLatestRef.current.reject(new Error('Worker terminated (HMR/unmount)')); } catch { /* ignore */ }
                pendingLatestRef.current = null;
            }

            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }

            // Reset so next mount (HMR) can re-initialize
            isInitializedRef.current = false;
        };
    }, []);

    /**
     * Run simulation - uses worker if available, falls back to main thread
     * @param {Object} gameState - The current game state to simulate
     * @returns {Promise<Object>} The simulation result
     */
    /**
     * [PERF] Strip non-essential data from simulation result in main-thread mode.
     * The Worker has its own stripPayloadForTransfer; this is the equivalent for
     * the disableWorker (gameSpeed >= 3) path where simulateTick runs directly.
     * 
     * 主线程模式下也实施降频剥离，减少 GC 压力和 React setState 开销。
     */
    const mainThreadTickCounterRef = useRef(0);
    const MAIN_THREAD_UI_INTERVAL = 10;

    /**
     * [FIX] Run simulateTick on main thread with correct _isFullTick injection.
     * Must compute isFullTick BEFORE calling simulateTick so that simulation
     * knows whether to include classFinancialData etc. in its return value.
     * Then strip the result for transfer (same as Worker's stripPayloadForTransfer).
     */
    const runMainThreadSimulation = useCallback((gameState) => {
        // Compute isFullTick BEFORE simulateTick, matching Worker behavior
        const isFullTick = (mainThreadTickCounterRef.current % MAIN_THREAD_UI_INTERVAL) === 0;
        const enrichedState = { ...gameState, _isFullTick: isFullTick };
        const result = simulateTick(enrichedState);
        // Increment AFTER simulateTick + strip, matching Worker's _tickCounter++ placement
        mainThreadTickCounterRef.current++;

        if (!result) return result;
        // Strip debug fields (same as Worker's stripPayloadForTransfer)
        // NOTE: _auditLog must be preserved — it feeds the fiscal breakdown panel (财政收支).
        delete result.buildingDebugData;
        delete result._debug;
        delete result._auditSilverAtSpread;
        if (result._perf) {
            result._perf = { totalMs: result._perf.totalMs };
        }
        // NOTE: modifiers.sources is preserved — needed by BuildingDetails / ResourceDetailModal.
        // It is already null on non-full ticks (gated by _isFullTick in simulation.js),
        // and fullTickCacheRef in useGameLoop.js caches it for non-full ticks.
        // Defeated nations → minimal stubs
        if (Array.isArray(result.nations)) {
            result.nations = result.nations.map(n => {
                if (n.isDefeated || (n.population || 0) <= 0) {
                    return { id: n.id, name: n.name, isDefeated: true, population: 0 };
                }
                return n;
            });
        }

        // [PERF] 主线程模式降频剥离：与 Worker 端 stripPayloadForTransfer 一致
        // isFullTick already computed above, reuse it
        result._isFullTick = isFullTick;
        if (!isFullTick) {
            result.buildingFinancialData = null;
            result.classFinancialData = null;
            result.approvalBreakdown = null;
            // [FIX] officials 不再剥离：它包含 simulation 下一 tick 必需的持久状态
            // （wealth、loyalty、lowLoyaltyDays、lastDayExpense 等），剥离会导致
            // 主线程用旧缓存覆盖状态，使忠诚度/消费变化被稀释到几乎为零
            result.activeFronts = null;
            result.activeBattles = null;
            result.foreignInvestmentStats = null;
            result.tradeOpportunities = null;
            if (result.market) {
                result.market = {
                    prices: result.market.prices,
                    wages: result.market.wages,
                    demand: null,
                    supply: null,
                    needsShortages: null,
                    stratumConsumption: null,
                    supplyBreakdown: null,
                    demandBreakdown: null,
                    resourceLossBreakdown: null,
                };
            }
            if (result.modifiers) {
                result.modifiers = {
                    ideologyRuleMods: result.modifiers.ideologyRuleMods || null,
                    officialEffects: result.modifiers.officialEffects || null,
                };
            }
        }
        return result;
    }, []);

    const runSimulation = useCallback((gameState) => {
        const disableWorker = typeof window !== 'undefined' && window.__SIM_DISABLE_WORKER === true;
        if (disableWorker) {
            return Promise.resolve(runMainThreadSimulation(gameState));
        }
        // If worker is available and no pending operation
        if (workerRef.current && isUsingWorker && !pendingResolveRef.current) {
            return new Promise((resolve, reject) => {
                pendingResolveRef.current = resolve;
                pendingRejectRef.current = reject;
                
                const adaptiveTimeout = Math.min(15000, Math.max(3000, lastExecTimeRef.current * 3));
                const timeout = setTimeout(() => {
                    if (pendingResolveRef.current) {
                        console.warn(`[SimulationWorker] Worker timeout (${adaptiveTimeout}ms), falling back to main thread`);
                        pendingResolveRef.current = null;
                        pendingRejectRef.current = null;
                        if (pendingLatestRef.current) {
                            pendingLatestRef.current.resolve({ __skipped: true });
                            pendingLatestRef.current = null;
                        }
                        
                        trackErrorWarning(`WorkerTimeout: simulation exceeded ${adaptiveTimeout}ms`);
                        try {
                            const result = runMainThreadSimulation(gameState);
                            resolve(result);
                        } catch (error) {
                            trackErrorError(`SimulationError: ${error.message}`);
                            reject(error);
                        }
                    }
                }, adaptiveTimeout);
                
                try {
                    sendTimeRef.current = Date.now();
                    workerRef.current.postMessage({
                        type: 'SIMULATE',
                        payload: gameState
                    });
                } catch (error) {
                    clearTimeout(timeout);
                    pendingResolveRef.current = null;
                    pendingRejectRef.current = null;
                    console.warn('[SimulationWorker] postMessage failed, using main thread:', error);
                    trackErrorWarning(`WorkerPostMessageError: ${error.message}`);
                    
                    try {
                        const result = runMainThreadSimulation(gameState);
                        resolve(result);
                    } catch (simError) {
                        trackErrorError(`SimulationError: ${simError.message}`);
                        reject(simError);
                    }
                }
                
                // Clear timeout when resolved
                const originalResolve = resolve;
                pendingResolveRef.current = (value) => {
                    clearTimeout(timeout);
                    originalResolve(value);
                };
            });
        }

        if (workerRef.current && isUsingWorker && pendingResolveRef.current) {
            return new Promise((resolve, reject) => {
                if (pendingLatestRef.current) {
                    pendingLatestRef.current.resolve({ __skipped: true });
                }
                pendingLatestRef.current = { gameState, resolve, reject };
            });
        }
        
        // Fallback: run on main thread
        return Promise.resolve(runMainThreadSimulation(gameState));
    }, [isUsingWorker, runMainThreadSimulation]);

    /**
     * [PERF] 低频同步history数据到worker缓存
     * 避免每tick都通过postMessage传输大量history数据
     * @param {Object} historyData - { classWealthHistory, classNeedsHistory }
     */
    const syncHistory = useCallback((historyData) => {
        if (workerRef.current && isUsingWorker) {
            try {
                workerRef.current.postMessage({
                    type: 'SYNC_HISTORY',
                    payload: historyData
                });
            } catch (e) {
                // 同步失败不影响主流程
                console.warn('[SimulationWorker] syncHistory failed:', e);
            }
        }
    }, [isUsingWorker]);

    /**
     * [PERF] 低频同步静态配置到worker缓存
     * 避免每tick都通过postMessage传输不变的配置数据（如理念、协同等）
     * @param {Object} configData - { equippedIdeologies, ideologySynergies, antiSynergies }
     */
    const syncConfig = useCallback((configData) => {
        if (workerRef.current && isUsingWorker) {
            try {
                workerRef.current.postMessage({
                    type: 'SYNC_CONFIG',
                    payload: configData
                });
            } catch (e) {
                // 同步失败不影响主流程
                console.warn('[SimulationWorker] syncConfig failed:', e);
            }
        }
    }, [isUsingWorker]);

    /**
     * [PERF] 控制Worker端调试数据传输开关
     * 关闭时worker会从返回payload中剔除buildingDebugData、_perf.sections等调试数据
     * @param {boolean} enabled - 是否启用调试数据传输
     */
    const setDebugMode = useCallback((enabled) => {
        if (workerRef.current && isUsingWorker) {
            try {
                workerRef.current.postMessage({
                    type: 'SET_DEBUG',
                    payload: { enabled }
                });
            } catch (e) {
                console.warn('[SimulationWorker] setDebugMode failed:', e);
            }
        }
    }, [isUsingWorker]);

    /**
     * [PERF] 动态调整 Worker 端 UI 数据传输间隔
     * 由内存监控 hook 调用：内存压力大时翻倍间隔，恢复时还原
     * @param {number} interval - 新的 UI 数据传输间隔（tick 数）
     */
    const setUiInterval = useCallback((interval) => {
        if (workerRef.current && isUsingWorker) {
            try {
                workerRef.current.postMessage({
                    type: 'SET_UI_INTERVAL',
                    payload: { interval }
                });
            } catch (e) {
                console.warn('[SimulationWorker] setUiInterval failed:', e);
            }
        }
    }, [isUsingWorker]);

    return {
        runSimulation,
        syncHistory,
        syncConfig,
        setDebugMode,
        setUiInterval,
        isUsingWorker,
        workerError
    };
}

/**
 * Synchronous simulation fallback
 * Use this when you need immediate results and can't use async/await
 * @param {Object} gameState - The current game state to simulate
 * @returns {Object} The simulation result
 */
export function runSimulationSync(gameState) {
    return simulateTick(gameState);
}
