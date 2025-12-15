import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPublicAssetUrl } from '../../utils/assetPath';

// Define the mapping of eras to their background images
const ERA_BG_MAP = {
    0: 'bg_era_0_stone.webp',
    1: 'bg_era_1_bronze.webp',
    2: 'bg_era_2_classical.webp',
    3: 'bg_era_3_feudal.webp',
    4: 'bg_era_4_exploration.webp',
    5: 'bg_era_5_enlightenment.webp',
    6: 'bg_era_6_industrial.webp',
    7: 'bg_era_7_information.webp',
};

/**
 * EraBackground Component
 * 
 * Displays a seamless background texture that changes dynamically based on the current game era.
 * Uses framer-motion for smooth cross-fade transitions between eras.
 * 
 * @param {number} epoch - The current epoch ID (0-7)
 * @param {number} opacity - The opacity of the background texture (default: 0.05 for subtle effect)
 * @param {string} className - Additional CSS classes
 */
export const EraBackground = ({ epoch = 0, opacity = 0.08, className = '' }) => {

    const currentBg = useMemo(() => {
        const bgFile = ERA_BG_MAP[epoch] || ERA_BG_MAP[0];
        return getPublicAssetUrl(`images/backgrounds/${bgFile}`);
    }, [epoch]);

    return (
        <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${className}`}>
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={epoch}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: opacity }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full"
                    style={{
                        backgroundImage: `url(${currentBg})`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: '400px', // Adjust size as needed for the pattern scale
                        backgroundBlendMode: 'overlay', // Blend with the underlying dark theme
                    }}
                />
            </AnimatePresence>

            {/* Optional: Add a static overlay to ensure text readability if needed */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
        </div>
    );
};
