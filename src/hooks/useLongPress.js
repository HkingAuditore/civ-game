import { useCallback, useRef } from 'react';

/**
 * Custom hook for handling long press events
 * @param {Function} onLongPress - Callback function to execute on long press
 * @param {Function} onClick - Callback function to execute on regular click
 * @param {Object} options - Configuration options
 * @param {number} options.delay - Delay in ms before triggering long press (default: 500)
 * @returns {Object} Event handlers to spread on the target element
 */
export const useLongPress = (
    onLongPress = () => {},
    onClick = () => {},
    { delay = 500 } = {}
) => {
    const timeoutRef = useRef(null);
    const isLongPressRef = useRef(false);

    const start = useCallback(
        (event) => {
            // Prevent default to avoid text selection on long press
            event.preventDefault();
            
            isLongPressRef.current = false;
            
            timeoutRef.current = setTimeout(() => {
                isLongPressRef.current = true;
                onLongPress(event);
            }, delay);
        },
        [onLongPress, delay]
    );

    const clear = useCallback(
        (event, shouldTriggerClick = true) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            if (shouldTriggerClick && !isLongPressRef.current) {
                onClick(event);
            }

            isLongPressRef.current = false;
        },
        [onClick]
    );

    return {
        onMouseDown: start,
        onMouseUp: (e) => clear(e, true),
        onMouseLeave: (e) => clear(e, false),
        onTouchStart: start,
        onTouchEnd: (e) => clear(e, true),
    };
};
