/**
 * 理念详情底部抽屉（BottomSheet）
 * 点击收藏库中的理念卡片后弹出，展示完整详情并提供装备/卸下操作
 */

import React, { useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { IdeologyCard } from './IdeologyCard';
import { useDevicePerformance } from '../../hooks/useDevicePerformance';

const MotionDiv = motion.div;

const IdeologyDetailSheetComponent = ({
    ideology,           // 理念配置对象
    level = 1,          // 当前等级
    isEquipped = false, // 是否已装备
    equippedIds = [],   // 所有已装备理念ID
    activeBuffs = [],   // 当前激活的限时buff列表
    cooldownRemaining = 0,
    onEquip,            // 装备回调 (id) => void
    onUnequip,          // 卸下回调 (id) => void
    onClose,            // 关闭回调
}) => {
    const { isLowPerformanceMode } = useDevicePerformance();
    const touchStartY = useRef(null);
    const sheetRef = useRef(null);

    // 触摸滑动关闭手势
    const handleTouchStart = useCallback((e) => {
        touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (touchStartY.current === null) return;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        if (deltaY > 60) {
            onClose?.();
        }
        touchStartY.current = null;
    }, [onClose]);

    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    }, [onClose]);

    const handleEquip = useCallback(() => {
        onEquip?.(ideology?.id);
        onClose?.();
    }, [onEquip, onClose, ideology]);

    const handleUnequip = useCallback(() => {
        onUnequip?.(ideology?.id);
        onClose?.();
    }, [onUnequip, onClose, ideology]);

    const show = !!ideology;

    return createPortal(
        <AnimatePresence>
            {show && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center"
                    onClick={handleOverlayClick}
                >
                    {/* 半透明遮罩 */}
                    <MotionDiv
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: isLowPerformanceMode ? 0.1 : 0.25 }}
                    />

                    {/* 抽屉面板 */}
                    <MotionDiv
                        ref={sheetRef}
                        className="relative w-full max-w-2xl mx-auto bg-gray-900 border border-gray-700/60 rounded-t-2xl shadow-2xl overflow-hidden"
                        style={{ maxHeight: '85vh' }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 拖拽指示条 */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-gray-600" />
                        </div>

                        {/* 顶部操作栏 */}
                        <div className="flex items-center justify-between px-4 pb-2">
                            <span className="text-xs text-gray-500">理念详情</span>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all"
                            >
                                <Icon name="X" size={16} />
                            </button>
                        </div>

                        {/* 详情内容（可滚动） */}
                        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                            <IdeologyCard
                                ideology={ideology}
                                level={level}
                                isEquipped={isEquipped}
                                equippedIds={equippedIds}
                                activeBuffs={activeBuffs}
                                cooldownRemaining={cooldownRemaining}
                                showProgressionPreview={true}
                                compact={false}
                            />
                        </div>

                        {/* 底部操作按钮 */}
                        <div className="px-4 py-3 border-t border-gray-800 flex gap-3">
                            {isEquipped ? (
                                <button
                                    onClick={handleUnequip}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 border-orange-500/50 text-orange-300 bg-orange-900/20 hover:bg-orange-900/40 transition-all flex items-center justify-center gap-2"
                                >
                                    <Icon name="MinusCircle" size={16} />
                                    卸下理念
                                </button>
                            ) : (
                                <button
                                    onClick={handleEquip}
                                    disabled={cooldownRemaining > 0}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                                        cooldownRemaining > 0
                                            ? 'border-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'border-green-500/50 text-green-300 bg-green-900/20 hover:bg-green-900/40'
                                    }`}
                                >
                                    <Icon name="PlusCircle" size={16} />
                                    {cooldownRemaining > 0 ? `冷却中 (${cooldownRemaining}天)` : '装备理念'}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
                            >
                                关闭
                            </button>
                        </div>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export const IdeologyDetailSheet = memo(IdeologyDetailSheetComponent);
