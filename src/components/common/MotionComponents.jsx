import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

// Standard transition settings
const springTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30
};

const easeTransition = {
    type: "tween",
    ease: "circOut",
    duration: 0.3
};

/**
 * Wrapper for fading in elements
 */
export const FadeIn = ({ children, delay = 0, duration = 0.5, className = "" }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, delay, ease: "easeOut" }}
        className={className}
    >
        {children}
    </motion.div>
);

/**
 * Wrapper for sliding up elements (good for cards, lists)
 */
export const SlideUp = ({ children, delay = 0, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ ...easeTransition, delay }}
        className={className}
    >
        {children}
    </motion.div>
);

/**
 * Wrapper for scaling in elements (good for modals, popups)
 */
export const ScaleIn = ({ children, delay = 0, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ ...springTransition, delay }}
        className={className}
    >
        {children}
    </motion.div>
);

/**
 * Stagger container for lists
 */
export const StaggerContainer = ({ children, staggerDelay = 0.05, className = "" }) => {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay
            }
        }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const StaggerItem = ({ children, className = "" }) => {
    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div variants={item} className={className}>
            {children}
        </motion.div>
    );
};

/**
 * Animate numbers counting up/down smoothly using a spring
 */
export const RollingNumber = ({
    value,
    format = (v) => Math.floor(v),
    className = "",
    fixedWidth = false,
}) => {
    // Use a spring to smooth out value changes
    const spring = useSpring(value, { stiffness: 40, damping: 20 });

    // Track previous value so we can reserve max width across the transition
    const prevValueRef = useRef(value);
    const measureRef = useRef(null);
    const [reservedWidth, setReservedWidth] = useState(null);

    const prevValue = prevValueRef.current;

    const sampleText = useMemo(() => {
        if (!fixedWidth) return null;
        // Reserve width for both ends (prev -> next). This prevents reflow while animating.
        const a = String(format(prevValue));
        const b = String(format(value));
        return a.length >= b.length ? a : b;
    }, [fixedWidth, format, prevValue, value]);

    useLayoutEffect(() => {
        if (!fixedWidth) return;
        if (!measureRef.current) return;
        const rect = measureRef.current.getBoundingClientRect();
        // Avoid noisy updates
        const nextWidth = Math.ceil(rect.width);
        setReservedWidth((w) => (w === nextWidth ? w : nextWidth));
    }, [fixedWidth, sampleText]);

    // Transform the spring value to a formatted string
    const display = useTransform(spring, (current) => format(current));

    // Update spring target when value changes
    useEffect(() => {
        spring.set(value);
        prevValueRef.current = value;
    }, [value]);

    return (
        <>
            {fixedWidth && (
                <span
                    ref={measureRef}
                    className={`absolute -z-10 opacity-0 pointer-events-none whitespace-pre ${className}`}
                >
                    {sampleText}
                </span>
            )}
            <motion.span
                className={`inline-block ${className}`}
                style={fixedWidth && reservedWidth ? { width: reservedWidth } : undefined}
            >
                {display}
            </motion.span>
        </>
    );
};

// Export basic presets for direct usage
export const pageVariants = {
    initial: { opacity: 0, x: -10 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: 10 }
};

export const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3
};
