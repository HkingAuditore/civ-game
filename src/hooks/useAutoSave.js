/**
 * useAutoSave — Extracted from useGameLoop for independent lifecycle management.
 *
 * Handles auto-save logic both when the game is paused and during active gameplay.
 * Having this as a separate hook means its cleanup runs independently during HMR,
 * without affecting the main simulation loop.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.stateRef - Shared state ref from useGameLoop
 * @param {React.MutableRefObject} params.saveGameRef - Ref to the saveGame function
 * @param {boolean} params.isPaused - Whether the game is currently paused
 */
import { useEffect, useRef } from 'react';

export function useAutoSave({ stateRef, saveGameRef, isPaused }) {
    const autoSaveTimerRef = useRef(null);

    useEffect(() => {
        // Clear any existing timer
        if (autoSaveTimerRef.current) {
            clearInterval(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        // Auto-save check runs every 60 seconds regardless of pause state
        autoSaveTimerRef.current = setInterval(() => {
            const current = stateRef.current;
            if (!current.isAutoSaveEnabled) return;

            const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
            const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
            if (elapsed >= intervalSeconds * 1000 && saveGameRef.current) {
                saveGameRef.current({ source: 'auto' });
                stateRef.current.lastAutoSaveTime = Date.now();
            }
        }, 60000);

        return () => {
            if (autoSaveTimerRef.current) {
                clearInterval(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [stateRef, saveGameRef, isPaused]);
}
