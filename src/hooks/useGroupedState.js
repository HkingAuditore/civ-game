/**
 * useGroupedState — Helper to merge multiple useState calls into grouped useReducer.
 *
 * Reduces the total number of React hooks in useGameState from 138+ to ~30,
 * making React Fast Refresh more stable (fewer hooks = less chance of mismatch).
 *
 * Each group returns individual [value, setter] pairs identical to useState,
 * so all consumers (useGameLoop, components, save/load) need zero changes.
 *
 * Usage:
 *   const { values, setters } = useGroupedState({
 *     foo: 1,
 *     bar: 'hello',
 *   });
 *   // values.foo === 1, setters.setFoo(2) works like useState setter
 */

import { useReducer, useCallback, useRef, useMemo } from 'react';

/**
 * Reducer for grouped state: supports per-field updates.
 * Action shape: { field: string, value: any | (prev) => next }
 */
function groupedReducer(state, action) {
    if (action.type === 'RESET') {
        return action.payload;
    }
    const { field, value } = action;
    const prev = state[field];
    const next = typeof value === 'function' ? value(prev) : value;
    if (Object.is(prev, next)) return state; // Bail out if unchanged
    return { ...state, [field]: next };
}

/**
 * Create a grouped state hook from an initial state object.
 * Returns { values, setters, resetAll }.
 *
 * - values: { [key]: currentValue } — read individual fields
 * - setters: { setKey: (valueOrUpdater) => void } — per-field setters
 * - resetAll: (newState) => void — bulk reset (used by loadGame)
 *
 * @param {Object} initialState - { fieldName: initialValue, ... }
 * @returns {{ values: Object, setters: Object, resetAll: Function }}
 */
export function useGroupedState(initialState) {
    const [state, dispatch] = useReducer(groupedReducer, initialState);

    // Memoize setter functions so they are stable across renders.
    // We use a ref to hold the dispatch so the callbacks never change identity.
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;

    // Build setter map once (field names are fixed at init time)
    const setters = useMemo(() => {
        const result = {};
        const fields = Object.keys(initialState);
        for (const field of fields) {
            // Convert "foo" → "setFoo"
            const setterName = 'set' + field.charAt(0).toUpperCase() + field.slice(1);
            // Stable callback that never changes identity
            result[setterName] = (value) => {
                dispatchRef.current({ field, value });
            };
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Intentionally empty — field names are static

    const resetAll = useCallback((newState) => {
        dispatchRef.current({ type: 'RESET', payload: newState });
    }, []);

    return { values: state, setters, resetAll };
}
