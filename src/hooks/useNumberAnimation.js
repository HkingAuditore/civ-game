import { useEffect, useState } from 'react';
import { useSpring, useMotionValue } from 'framer-motion';

/**
 * Hook to animate a number from start to end value
 * @param {number} value - The target value
 * @param {object} config - Animation config (stiffness, damping, etc.)
 */
export const useNumberAnimation = (value, config = { stiffness: 100, damping: 30 }) => {
    const motionValue = useMotionValue(value);
    const springValue = useSpring(motionValue, config);
    const [current, setCurrent] = useState(value);

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        const unsubscribe = springValue.on("change", (latest) => {
            setCurrent(Math.round(latest)); // Round for integer display, remove if decimal needed
        });
        return unsubscribe;
    }, [springValue]);

    return current;
};
