// 成就系统弹窗
// 展示已解锁与未解锁的成就列表

import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { ACHIEVEMENTS } from '../../config';
import { cn } from '../../config/unifiedStyles';

const AchievementItem = ({ achievement, unlocked }) => (
    <div
        className={cn(
            'p-3 rounded-xl border transition-all',
            unlocked
                ? 'border-ancient-gold/40 bg-gray-800/60'
                : 'border-gray-700/50 bg-gray-900/40 opacity-70'
        )}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div
                    className={cn(
                        'p-1.5 rounded-lg',
                        unlocked ? 'bg-ancient-gold/30' : 'bg-gray-700/40'
                    )}
                >
                    <Icon
                        name={unlocked ? achievement.icon : 'Lock'}
                        size={14}
                        className={unlocked ? 'text-ancient-gold' : 'text-gray-400'}
                    />
                </div>
                <div className="text-xs font-semibold text-gray-200">
                    {unlocked ? achievement.name : '未解锁'}
                </div>
            </div>
            <span
                className={cn(
                    'text-[10px] font-semibold',
                    unlocked ? 'text-emerald-300' : 'text-gray-500'
                )}
            >
                {unlocked ? '已解锁' : '锁定中'}
            </span>
        </div>
        <div className="mt-2 text-[10px] text-gray-300">
            {achievement.description}
        </div>
    </div>
);

/**
 * 成就弹窗
 */
export const AchievementsModal = ({ isOpen, onClose, unlockedAchievements = [] }) => {
    const unlockedSet = useMemo(() => {
        const ids = new Set();
        unlockedAchievements.forEach((item) => ids.add(item.id));
        return ids;
    }, [unlockedAchievements]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center lg:items-center">
                    <motion.div
                        className="absolute inset-0 bg-black/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="relative w-full max-w-md glass-epic border-t-2 lg:border-2 border-ancient-gold/40 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[85vh]"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="Award" size={20} className="text-ancient-gold" />
                                    <h2 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-ancient-gold via-yellow-400 to-orange-400">
                                        成就
                                    </h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <Icon name="X" size={18} className="text-gray-400" />
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                成就解锁与设备绑定，不随存档变化
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {ACHIEVEMENTS.map((achievement) => (
                                <AchievementItem
                                    key={achievement.id}
                                    achievement={achievement}
                                    unlocked={unlockedSet.has(achievement.id)}
                                />
                            ))}
                        </div>

                        <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/50">
                            <button
                                onClick={onClose}
                                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
