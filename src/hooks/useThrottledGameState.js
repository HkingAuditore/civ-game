/**
 * useThrottledGameState Hook
 * 
 * Provides throttled access to game state for UI components.
 * Reduces UI re-render frequency without affecting simulation accuracy.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Default throttle interval in milliseconds
 */
const DEFAULT_THROTTLE_MS = 250;

/**
 * Hook that throttles game state updates to reduce UI re-renders
 * 
 * @param {Object} gameState - The full game state object
 * @param {number} throttleMs - Minimum milliseconds between updates (default: 250)
 * @returns {Object} Throttled game state that updates less frequently
 * 
 * @example
 * const throttledState = useThrottledGameState(gameState, 300);
 * // throttledState updates at most every 300ms
 */
export function useThrottledGameState(gameState, throttleMs = DEFAULT_THROTTLE_MS) {
    const [throttledState, setThrottledState] = useState(gameState);
    const lastUpdateRef = useRef(0);
    const pendingUpdateRef = useRef(null);
    const rafIdRef = useRef(null);
    
    const updateState = useCallback(() => {
        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        
        if (timeSinceLastUpdate >= throttleMs) {
            // Enough time has passed, update immediately
            setThrottledState(gameState);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else if (!pendingUpdateRef.current) {
            // Schedule update for later
            const delay = throttleMs - timeSinceLastUpdate;
            pendingUpdateRef.current = setTimeout(() => {
                setThrottledState(gameState);
                lastUpdateRef.current = performance.now();
                pendingUpdateRef.current = null;
            }, delay);
        }
    }, [gameState, throttleMs]);
    
    // Use requestAnimationFrame for smooth updates
    useEffect(() => {
        rafIdRef.current = requestAnimationFrame(updateState);
        
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
            }
        };
    }, [updateState]);
    
    return throttledState;
}

/**
 * Hook that selects and throttles specific parts of game state
 * More efficient than throttling the entire state object
 * 
 * @param {Object} gameState - The full game state object
 * @param {Function} selector - Function to select desired state slice
 * @param {number} throttleMs - Minimum milliseconds between updates
 * @returns {*} Selected and throttled state slice
 * 
 * @example
 * const resources = useThrottledSelector(gameState, state => state.resources, 200);
 */
export function useThrottledSelector(gameState, selector, throttleMs = DEFAULT_THROTTLE_MS) {
    const selectedValue = selector(gameState);
    const [throttledValue, setThrottledValue] = useState(selectedValue);
    const lastUpdateRef = useRef(0);
    const pendingUpdateRef = useRef(null);
    
    useEffect(() => {
        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        
        if (timeSinceLastUpdate >= throttleMs) {
            setThrottledValue(selectedValue);
            lastUpdateRef.current = now;
        } else if (!pendingUpdateRef.current) {
            const delay = throttleMs - timeSinceLastUpdate;
            pendingUpdateRef.current = setTimeout(() => {
                setThrottledValue(selectedValue);
                lastUpdateRef.current = performance.now();
                pendingUpdateRef.current = null;
            }, delay);
        }
        
        return () => {
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
            }
        };
    }, [selectedValue, throttleMs]);
    
    return throttledValue;
}

/**
 * Configuration for different UI update frequencies
 */
export const UI_THROTTLE_PRESETS = {
    // Critical UI elements (resources, treasury)
    fast: 150,
    
    // Standard panels (logs, buildings)
    normal: 250,
    
    // Low priority panels (statistics, charts)
    slow: 500,
    
    // Background/decorative elements
    background: 1000,
};

export default useThrottledGameState;
