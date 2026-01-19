// 交互式教程遮罩层组件
// 显示高亮区域、提示框、进度指示器

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { TUTORIAL_PHASES } from '../../config/interactiveTutorialSteps';

/**
 * 教程遮罩层组件
 */
export const TutorialOverlay = ({
    isActive,
    currentStep,
    stepNumber,
    totalSteps,
    targetRect,
    onSkip,
    onNext,
    onClick,
    isDetailOpen = false, // 是否有详情面板打开
}) => {
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef(null);
    
    // 判断是否允许自由交互（state-change触发器需要玩家自由操作）
    const allowFreeInteraction = currentStep?.trigger === 'state-change';
    
    // 当允许自由交互且详情页打开时，隐藏高亮框（避免高亮框在错误位置造成困惑）
    const hideHighlight = allowFreeInteraction && isDetailOpen;

    // 计算提示框位置
    useEffect(() => {
        if (!currentStep) return;

        const calculateTooltipPosition = () => {
            // 默认尺寸作为回退
            let tooltipWidth = 320;
            let tooltipHeight = 200;
            
            // 如果有ref，使用实际尺寸
            if (tooltipRef.current) {
                const rect = tooltipRef.current.getBoundingClientRect();
                tooltipWidth = rect.width || tooltipWidth;
                tooltipHeight = rect.height || tooltipHeight;
            }
            
            const padding = 16;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top, left;

            if (targetRect) {
                // 有高亮目标时，提示框放在目标旁边
                const position = currentStep.tooltipPosition || 'auto';
                
                // 计算各个方向是否有足够空间
                const spaceTop = targetRect.top - padding;
                const spaceBottom = viewportHeight - targetRect.top - targetRect.height - padding;
                const spaceLeft = targetRect.left - padding;
                const spaceRight = viewportWidth - targetRect.left - targetRect.width - padding;
                
                const clampToViewport = (rawTop, rawLeft) => {
                    let clampedTop = rawTop;
                    let clampedLeft = rawLeft;

                    if (clampedLeft < padding) clampedLeft = padding;
                    if (clampedLeft + tooltipWidth > viewportWidth - padding) {
                        clampedLeft = viewportWidth - tooltipWidth - padding;
                    }
                    if (clampedTop < padding) {
                        clampedTop = padding;
                    }
                    if (clampedTop + tooltipHeight > viewportHeight - padding) {
                        clampedTop = viewportHeight - tooltipHeight - padding;
                    }

                    return { top: clampedTop, left: clampedLeft };
                };

                const getPosition = (pos) => {
                    switch (pos) {
                        case 'top':
                            return {
                                top: targetRect.top - tooltipHeight - padding,
                                left: targetRect.left + (targetRect.width - tooltipWidth) / 2,
                            };
                        case 'bottom':
                            return {
                                top: targetRect.top + targetRect.height + padding,
                                left: targetRect.left + (targetRect.width - tooltipWidth) / 2,
                            };
                        case 'left':
                            return {
                                top: targetRect.top + (targetRect.height - tooltipHeight) / 2,
                                left: targetRect.left - tooltipWidth - padding,
                            };
                        case 'right':
                            return {
                                top: targetRect.top + (targetRect.height - tooltipHeight) / 2,
                                left: targetRect.left + targetRect.width + padding,
                            };
                        default:
                            return {
                                top: targetRect.top + targetRect.height + padding,
                                left: targetRect.left + (targetRect.width - tooltipWidth) / 2,
                            };
                    }
                };

                const hasSpaceForPosition = (pos) => {
                    switch (pos) {
                        case 'top':
                            return spaceTop >= tooltipHeight + padding;
                        case 'bottom':
                            return spaceBottom >= tooltipHeight + padding;
                        case 'left':
                            return spaceLeft >= tooltipWidth + padding;
                        case 'right':
                            return spaceRight >= tooltipWidth + padding;
                        default:
                            return false;
                    }
                };

                const pickAutoPosition = () => {
                    // 优先级：下方 > 上方 > 右侧 > 左侧
                    if (spaceBottom >= tooltipHeight + padding) return 'bottom';
                    if (spaceTop >= tooltipHeight + padding) return 'top';
                    if (spaceRight >= tooltipWidth + padding) return 'right';
                    if (spaceLeft >= tooltipWidth + padding) return 'left';
                    // 都放不下时，选择空间最大的方向
                    const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
                    if (maxSpace === spaceBottom) return 'bottom';
                    if (maxSpace === spaceTop) return 'top';
                    if (maxSpace === spaceRight) return 'right';
                    return 'left';
                };

                // 若指定方向空间不足，则自动挑一个合适位置
                let actualPosition = position === 'auto' ? pickAutoPosition() : position;
                if (position !== 'auto' && !hasSpaceForPosition(position)) {
                    actualPosition = pickAutoPosition();
                }

                const isOverlappingTarget = (candidateTop, candidateLeft) => {
                    const candidateRight = candidateLeft + tooltipWidth;
                    const candidateBottom = candidateTop + tooltipHeight;
                    return !(
                        candidateRight <= targetRect.left ||
                        candidateLeft >= targetRect.left + targetRect.width ||
                        candidateBottom <= targetRect.top ||
                        candidateTop >= targetRect.top + targetRect.height
                    );
                };

                const placeCandidate = (pos) => {
                    const raw = getPosition(pos);
                    return clampToViewport(raw.top, raw.left);
                };

                let placed = placeCandidate(actualPosition);
                if (isOverlappingTarget(placed.top, placed.left)) {
                    const candidates = ['bottom', 'top', 'right', 'left'];
                    for (const candidate of candidates) {
                        const next = placeCandidate(candidate);
                        if (!isOverlappingTarget(next.top, next.left)) {
                            placed = next;
                            break;
                        }
                    }
                }

                top = placed.top;
                left = placed.left;
            } else {
                // 无高亮目标时，居中显示
                top = (viewportHeight - tooltipHeight) / 2;
                left = (viewportWidth - tooltipWidth) / 2;
            }

            setTooltipPosition({ top, left });
        };

        // 初始计算
        calculateTooltipPosition();
        
        // 延迟再计算一次，确保ref已经获取到实际尺寸
        const timer = setTimeout(calculateTooltipPosition, 50);

        window.addEventListener('resize', calculateTooltipPosition);
        return () => {
            window.removeEventListener('resize', calculateTooltipPosition);
            clearTimeout(timer);
        };
    }, [currentStep, targetRect]);

    if (!isActive || !currentStep) return null;

    const phaseInfo = TUTORIAL_PHASES[currentStep.phase];

    return createPortal(
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[9999] pointer-events-none"
            >
                {/* 遮罩层 - state-change类型时不阻止点击，允许玩家自由操作 */}
                <motion.div
                    className={`absolute inset-0 bg-black/70 ${targetRect && !allowFreeInteraction ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: allowFreeInteraction ? 0.3 : (targetRect ? 1 : 0.5) }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={targetRect && !allowFreeInteraction ? onClick : undefined}
                    style={{
                        // 使用 clip-path 创建高亮区域（镂空部分不会阻止点击）
                        // 当允许自由交互时，不使用clip-path，整个遮罩层都是半透明的
                        clipPath: targetRect && !allowFreeInteraction
                            ? `polygon(
                                0% 0%, 
                                0% 100%, 
                                ${targetRect.left}px 100%, 
                                ${targetRect.left}px ${targetRect.top}px, 
                                ${targetRect.left + targetRect.width}px ${targetRect.top}px, 
                                ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px, 
                                ${targetRect.left}px ${targetRect.top + targetRect.height}px, 
                                ${targetRect.left}px 100%, 
                                100% 100%, 
                                100% 0%
                            )`
                            : 'none',
                    }}
                />

                {/* 高亮边框 - 纯装饰性，不阻止点击；当详情页打开时隐藏 */}
                {targetRect && !hideHighlight && (
                    <motion.div
                        className="absolute border-2 border-blue-400 rounded-lg pointer-events-none"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            top: targetRect.top,
                            left: targetRect.left,
                            width: targetRect.width,
                            height: targetRect.height,
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                        }}
                    >
                        {/* 脉冲动画 */}
                        <motion.div
                            className="absolute inset-0 border-2 border-blue-400 rounded-lg"
                            animate={{
                                scale: [1, 1.05, 1],
                                opacity: [0.8, 0.4, 0.8],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        />
                    </motion.div>
                )}

                {/* 提示框 */}
                <motion.div
                    ref={tooltipRef}
                    className="absolute w-80 bg-gray-900/95 backdrop-blur-sm border border-blue-500/50 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 进度条 */}
                    <div className="h-1 bg-gray-800">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
                        />
                    </div>

                    {/* 头部 */}
                    <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                                {phaseInfo?.name} · {stepNumber}/{totalSteps}
                            </span>
                        </div>
                        <button
                            onClick={onSkip}
                            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                        >
                            跳过教程
                        </button>
                    </div>

                    {/* 内容 */}
                    <div className="p-4">
                        <h3 className="text-lg font-bold text-white mb-2">
                            {currentStep.content.title}
                        </h3>
                        <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                            {currentStep.content.description}
                        </p>
                        {currentStep.content.hint && (
                            <p className="text-xs text-blue-300 mt-3 flex items-center gap-1">
                                <Icon name="Lightbulb" size={14} />
                                {currentStep.content.hint}
                            </p>
                        )}
                    </div>

                    {/* 底部按钮 */}
                    {(currentStep.trigger === 'any-click' || currentStep.type === 'info') && (
                        <div className="px-4 pb-4">
                            <button
                                onClick={onNext}
                                className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                继续
                                <Icon name="ChevronRight" size={16} />
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* 指向箭头 - 当详情页打开时隐藏 */}
                {targetRect && !hideHighlight && (
                    <motion.div
                        className="absolute pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            top: targetRect.top + targetRect.height / 2 - 20,
                            left: targetRect.left - 40,
                        }}
                    >
                        <motion.div
                            animate={{ x: [0, 10, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        >
                            <Icon name="ArrowRight" size={32} className="text-blue-400" />
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default TutorialOverlay;
