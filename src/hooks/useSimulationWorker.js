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
    const runSimulation = useCallback((gameState) => {
        const disableWorker = typeof window !== 'undefined' && window.__SIM_DISABLE_WORKER === true;
        if (disableWorker) {
            return Promise.resolve(simulateTick(gameState));
        }
        // If worker is available and no pending operation
        if (workerRef.current && isUsingWorker && !pendingResolveRef.current) {
            return new Promise((resolve, reject) => {
                pendingResolveRef.current = resolve;
                pendingRejectRef.current = reject;
                
                // Set a timeout for worker response
                const timeout = setTimeout(() => {
                    if (pendingResolveRef.current) {
                        console.warn('[SimulationWorker] Worker timeout, falling back to main thread');
                        pendingResolveRef.current = null;
                        pendingRejectRef.current = null;
                        if (pendingLatestRef.current) {
                            pendingLatestRef.current.resolve({ __skipped: true });
                            pendingLatestRef.current = null;
                        }
                        
                        // Fall back to main thread
                        try {
                            const result = simulateTick(gameState);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }
                }, 5000); // 5 second timeout
                
                try {
                    workerRef.current.postMessage({
                        type: 'SIMULATE',
                        payload: gameState
                    });
                } catch (error) {
                    // If postMessage fails (e.g., non-cloneable data), fall back
                    clearTimeout(timeout);
                    pendingResolveRef.current = null;
                    pendingRejectRef.current = null;
                    console.warn('[SimulationWorker] postMessage failed, using main thread:', error);
                    
                    try {
                        const result = simulateTick(gameState);
                        resolve(result);
                    } catch (simError) {
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
        return Promise.resolve(simulateTick(gameState));
    }, [isUsingWorker]);

    return {
        runSimulation,
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
