/**
 * 理念涌现弹窗 — 三选一
 * 当理念分数达到阈值时弹出，展示3张候选理念卡牌
 */

import React, { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { IdeologyCard } from '../tabs/IdeologyCard';
import { useDevicePerformance } from '../../hooks/useDevicePerformance';

const MotionDiv = motion.div;

const IdeologyEmergenceModalComponent = ({
    show = false,
    candidates = [],   // 3个候选理念对象
    onSelect,           // (ideologyId) => void
    equippedIds = [],   // 当前已装备的理念id
}) => {
    const [selectedId, setSelectedId] = useState(null);
    const { isLowPerformanceMode } = useDevicePerformance();

    const overlayClassName = 'absolute inset-0 bg-black/85 backdrop-blur-sm';
    const containerClassName = isLowPerformanceMode
        ? 'fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4'
        : 'fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4';
    const shellClassName = 'relative w-full max-w-[1200px] flex flex-col items-center px-1';
    const titleWrapClassName = 'text-center mb-2 sm:mb-4 shrink-0';
    const gridViewportClassName = 'overflow-y-auto flex-1 min-h-0 w-full mb-2';
    const gridViewportStyle = isLowPerformanceMode
        ? { overflowX: 'clip', WebkitOverflowScrolling: 'touch', padding: '12px' }
        : { overflowX: 'clip', WebkitOverflowScrolling: 'touch', padding: '6px 12px' };
    const buttonWrapClassName = 'text-center shrink-0 pt-1 pb-1';

    const handleSelect = useCallback((id) => {
        setSelectedId(id);
    }, []);

    const handleConfirm = useCallback(() => {
        if (selectedId && onSelect) {
            onSelect(selectedId);
            setSelectedId(null);
        }
    }, [selectedId, onSelect]);

    return createPortal(
        <AnimatePresence>
            {show && candidates.length > 0 && (
                <div
                    className={containerClassName}
                    style={{
                        overflow: 'clip',
                        backgroundColor: isLowPerformanceMode ? 'rgba(0, 0, 0, 0.96)' : undefined,
                    }}
                >
                    {/* 遮罩层 */}
                    {!isLowPerformanceMode && (
                        <MotionDiv
                            className={overlayClassName}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4 }}
                        />
                    )}

                    {/* 内容区域 — overflow-hidden prevents scaled cards from causing page-level scrollbars */}
                    <MotionDiv
                        className={shellClassName}
                        style={{ maxHeight: '88vh', overflow: 'visible' }}
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 24 }}
                        transition={{ type: "spring", damping: 28, stiffness: 320 }}
                    >
                        {/* 标题 - shrink-0 to prevent compression */}
                        <div className={titleWrapClassName}>
                            <MotionDiv
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <Icon name="Sparkles" size={20} className="text-purple-400" />
                                    <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 font-decorative">
                                        理念涌现
                                    </h2>
                                    <Icon name="Sparkles" size={20} className="text-cyan-400" />
                                </div>
                                <p className="text-xs sm:text-sm text-gray-400">
                                    文明的思想之光闪耀，请选择一个理念加入你的收藏
                                </p>
                            </MotionDiv>
                        </div>

                        {/* 三张卡牌 — py/px 留出足够缓冲防止阴影/边框被裁切 */}
                        <div
                            className={gridViewportClassName}
                            style={gridViewportStyle}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
                                {candidates.map((candidate, index) => (
                                    <MotionDiv
                                        key={candidate.id}
                                        initial={{ opacity: 0, y: 40, rotateY: -90 }}
                                        animate={{
                                            opacity: selectedId && selectedId !== candidate.id ? 0.4 : 1,
                                            y: 0,
                                            rotateY: 0,
                                        }}
                                        transition={{
                                            delay: 0.3 + index * 0.15,
                                            type: "spring",
                                            damping: 20,
                                            stiffness: 200,
                                        }}
                                    >
                                        <IdeologyCard
                                            ideology={candidate}
                                            level={candidate.isUpgrade ? candidate.currentLevel : 0}
                                            isCandidate={true}
                                            isSelected={selectedId === candidate.id}
                                            onSelect={handleSelect}
                                            equippedIds={equippedIds}
                                            showProgressionPreview={true}
                                        />
                                    </MotionDiv>
                                ))}
                            </div>
                        </div>

                        {/* 确认按钮 - sticky at bottom */}
                        <MotionDiv
                            initial={{ opacity: 0 }}
                            animate={{ opacity: selectedId ? 1 : 0.3 }}
                            className={buttonWrapClassName}
                        >
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedId}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                                    selectedId
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/50 text-white shadow-lg hover:shadow-purple-500/30 hover:scale-105'
                                        : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon name="Check" size={16} />
                                    确认选择
                                </span>
                            </button>
                        </MotionDiv>
                    </MotionDiv>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export const IdeologyEmergenceModal = memo(IdeologyEmergenceModalComponent);
