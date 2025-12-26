// 成就解锁提示

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './UIComponents';

const AUTO_DISMISS_DELAY = 2500;

const AchievementToastItem = ({ notification, onDismiss }) => {
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => {
            onDismiss(notification.id);
        }, AUTO_DISMISS_DELAY);
        return () => clearTimeout(timerRef.current);
    }, [notification.id, onDismiss]);

    return (
        <motion.div
            className="w-72 bg-gray-900/90 border border-ancient-gold/40 rounded-xl shadow-glow-gold backdrop-blur-md p-3 flex gap-3 cursor-pointer"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={() => onDismiss(notification.id)}
        >
            <div className="p-2 rounded-lg bg-ancient-gold/20">
                <Icon name={notification.icon || 'Award'} size={18} className="text-ancient-gold" />
            </div>
            <div className="flex-1">
                <div className="text-xs font-bold text-ancient-gold">成就解锁</div>
                <div className="text-sm font-semibold text-white">{notification.name}</div>
                <div className="text-[10px] text-gray-300">{notification.description}</div>
            </div>
        </motion.div>
    );
};

export const AchievementToast = ({ notifications = [], onDismiss }) => {
    if (!notifications.length) return null;

    return (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] space-y-2">
            <AnimatePresence>
                {notifications.map((notification) => (
                    <AchievementToastItem
                        key={notification.id}
                        notification={notification}
                        onDismiss={onDismiss}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};
