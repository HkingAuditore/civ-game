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

// Import worker using Vite's worker import syntax
// This tells Vite to bundle the worker separately
import SimulationWorker from '../workers/simulation.worker.js?worker';

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

    // Initialize worker on mount
    useEffect(() => {
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;

        try {
            // Create worker instance
            const worker = new SimulationWorker();
            
            // Set up message handler
            worker.onmessage = (event) => {
                const { type, payload, error } = event.data;
                
                switch (type) {
                    case 'READY':
                        setIsUsingWorker(true);
                        console.log('[SimulationWorker] Worker ready');
                        break;
                        
                    case 'RESULT':
                        if (sendTimeRef.current > 0) {
                            lastExecTimeRef.current = Math.max(500, Date.now() - sendTimeRef.current);
                        }
                        if (pendingResolveRef.current) {
                            pendingResolveRef.current(payload);
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
            
            // Handle worker errors
            worker.onerror = (error) => {
                console.error('[SimulationWorker] Worker crashed:', error);
                setWorkerError(error.message || 'Worker crashed');
                setIsUsingWorker(false);
                
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
            
            workerRef.current = worker;
            
        } catch (error) {
            console.warn('[SimulationWorker] Failed to create worker, using main thread:', error);
            trackErrorWarning(`WorkerError: ${error.message || 'Failed to create worker'}`);
            setWorkerError(error.message || 'Failed to create worker');
            setIsUsingWorker(false);
        }
        
        // Cleanup on unmount
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
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
     */
    const stripMainThreadResult = useCallback((result) => {
        if (!result) return result;
        // Strip debug fields (same as Worker's stripPayloadForTransfer)
        // NOTE: _auditLog must be preserved — it feeds the fiscal breakdown panel (财政收支).
        delete result.buildingDebugData;
        delete result._debug;
        delete result._auditSilverAtSpread;
        if (result._perf) {
            result._perf = { totalMs: result._perf.totalMs };
        }
        if (result.modifiers) {
            delete result.modifiers.sources;
        }
        // Defeated nations → minimal stubs
        if (Array.isArray(result.nations)) {
            result.nations = result.nations.map(n => {
                if (n.isDefeated || (n.population || 0) <= 0) {
                    return { id: n.id, name: n.name, isDefeated: true, population: 0 };
                }
                return n;
            });
        }
        return result;
    }, []);

    const runSimulation = useCallback((gameState) => {
        const disableWorker = typeof window !== 'undefined' && window.__SIM_DISABLE_WORKER === true;
        if (disableWorker) {
            return Promise.resolve(stripMainThreadResult(simulateTick(gameState)));
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
                            const result = stripMainThreadResult(simulateTick(gameState));
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
                        const result = stripMainThreadResult(simulateTick(gameState));
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
        return Promise.resolve(stripMainThreadResult(simulateTick(gameState)));
    }, [isUsingWorker, stripMainThreadResult]);

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
     * [PERF] 控制Worker端调试数据传输开关
     * 关闭时worker会从返回payload中剔除buildingDebugData、_perf.sections、modifiers.sources
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

    return {
        runSimulation,
        syncHistory,
        setDebugMode,
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
