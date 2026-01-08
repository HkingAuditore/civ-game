// 交互式教程遮罩层组件
// 显示高亮区域、提示框、进度指示器

import React, { useEffect, useState } from 'react';
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
}) => {
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    // 计算提示框位置
    useEffect(() => {
        if (!currentStep) return;

        const calculateTooltipPosition = () => {
            const tooltipWidth = 320;
            const tooltipHeight = 200;
            const padding = 16;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top, left;

            if (targetRect) {
                // 有高亮目标时，提示框放在目标旁边
                const position = currentStep.tooltipPosition || 'bottom';

                switch (position) {
                    case 'top':
                        top = targetRect.top - tooltipHeight - padding;
                        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
                        break;
                    case 'bottom':
                        top = targetRect.top + targetRect.height + padding;
                        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
                        break;
                    case 'left':
                        top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
                        left = targetRect.left - tooltipWidth - padding;
                        break;
                    case 'right':
                        top = targetRect.top + (targetRect.height - tooltipHeight) / 2;
                        left = targetRect.left + targetRect.width + padding;
                        break;
                    default:
                        top = targetRect.top + targetRect.height + padding;
                        left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
                }

                // 确保提示框在视口内
                if (left < padding) left = padding;
                if (left + tooltipWidth > viewportWidth - padding) {
                    left = viewportWidth - tooltipWidth - padding;
                }
                if (top < padding) {
                    // 如果上方放不下，放到下方
                    top = targetRect.top + targetRect.height + padding;
                }
                if (top + tooltipHeight > viewportHeight - padding) {
                    // 如果下方放不下，放到上方
                    top = targetRect.top - tooltipHeight - padding;
                    if (top < padding) {
                        top = padding;
                    }
                }
            } else {
                // 无高亮目标时，居中显示
                top = (viewportHeight - tooltipHeight) / 2;
                left = (viewportWidth - tooltipWidth) / 2;
            }

            setTooltipPosition({ top, left });
        };

        calculateTooltipPosition();

        window.addEventListener('resize', calculateTooltipPosition);
        return () => window.removeEventListener('resize', calculateTooltipPosition);
    }, [currentStep, targetRect]);

    if (!isActive || !currentStep) return null;

    const phaseInfo = TUTORIAL_PHASES[currentStep.phase];

    return createPortal(
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[9999] pointer-events-none"
            >
                {/* 遮罩层 - 只有当存在高亮目标时才阻止点击 */}
                <motion.div
                    className={`absolute inset-0 bg-black/70 ${targetRect ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: targetRect ? 1 : 0.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={targetRect ? onClick : undefined}
                    style={{
                        // 使用 clip-path 创建高亮区域（镂空部分不会阻止点击）
                        clipPath: targetRect
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

                {/* 高亮边框 - 纯装饰性，不阻止点击 */}
                {targetRect && (
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

                {/* 指向箭头 */}
                {targetRect && (
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
