// 年度庆典模态框组件
// 每年自动触发，让玩家选择一个庆典效果

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { EPOCHS } from '../../config/epochs';

/**
 * 年度庆典模态框组件
 * @param {Array} festivalOptions - 三个庆典效果选项
 * @param {number} year - 当前年份
 * @param {number} epoch - 当前时代
 * @param {Function} onSelect - 选择回调函数
 */
export const AnnualFestivalModal = ({ festivalOptions, year, epoch, onSelect }) => {
    const [selectedEffect, setSelectedEffect] = useState(null);
    const [hoveredEffect, setHoveredEffect] = useState(null);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    const show = festivalOptions && festivalOptions.length > 0;
    const currentEpoch = EPOCHS[epoch] || EPOCHS[0];

    const handleConfirm = () => {
        if (selectedEffect) {
            onSelect(selectedEffect);
        }
    };

    const getEffectIcon = (iconName) => {
        return iconName || 'Star';
    };

    const formatEffectDetails = (effects) => {
        const details = [];

        if (effects.categories) {
            Object.entries(effects.categories).forEach(([cat, value]) => {
                const percent = (value * 100).toFixed(0);
                const catName = cat === 'gather' ? '采集' : cat === 'industry' ? '工业' : cat;
                details.push(`${catName}类建筑 +${percent}%`);
            });
        }

        if (effects.production) {
            details.push(`全局生产 +${(effects.production * 100).toFixed(0)}%`);
        }

        if (effects.industry) {
            details.push(`工业产出 +${(effects.industry * 100).toFixed(0)}%`);
        }

        if (effects.scienceBonus) {
            details.push(`科研产出 +${(effects.scienceBonus * 100).toFixed(0)}%`);
        }

        if (effects.cultureBonus) {
            details.push(`文化产出 +${(effects.cultureBonus * 100).toFixed(0)}%`);
        }

        if (effects.militaryBonus) {
            details.push(`军事力量 +${(effects.militaryBonus * 100).toFixed(0)}%`);
        }

        if (effects.taxIncome) {
            details.push(`税收收入 +${(effects.taxIncome * 100).toFixed(0)}%`);
        }

        if (effects.stability) {
            details.push(`稳定度 +${(effects.stability * 100).toFixed(0)}%`);
        }

        if (effects.maxPop) {
            details.push(`人口上限 +${effects.maxPop}`);
        }

        return details;
    };

    return createPortal(
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-4xl glass-epic border-t-2 lg:border-2 border-ancient-gold/40 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[92vh]"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* 头部 */}
                        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-700 bg-gradient-to-r from-yellow-900/50 via-orange-900/50 to-red-900/50">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <Icon name="Sparkles" size={16} className="text-yellow-400 animate-pulse" />
                                    <h2 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400">
                                        🎊 年度庆典 🎊
                                    </h2>
                                    <Icon name="Sparkles" size={16} className="text-yellow-400 animate-pulse" />
                                </div>
                                <p className="text-xs text-white font-semibold leading-tight">
                                    第 {year} 年庆典盛会
                                </p>
                                <p className="text-xs text-gray-300 leading-tight">
                                    <span className={`font-bold ${currentEpoch.name}`}>{currentEpoch.name}</span> · 选择一项庆典效果来祝福您的文明
                                </p>
                            </div>
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                            {/* 庆典说明 */}
                            <div className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg">
                                <div className="flex items-start gap-1.5">
                                    <Icon name="Info" size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-gray-300 leading-relaxed">
                                        <p className="font-semibold text-blue-300 leading-tight">庆典说明</p>
                                        <p>每年一度的盛大庆典来临！请从以下三个选项中选择一项效果。</p>
                                        <p className="mt-0.5">
                                            <span className="text-yellow-400">⏱ 短期效果</span> 将持续整整一年（360天），
                                            <span className="text-purple-400 ml-1">♾️ 永久效果</span> 将永远伴随您的文明。
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 庆典选项 */}
                            <div className="grid grid-cols-1 gap-1.5">
                                {festivalOptions.map((effect, index) => {
                                    const isSelected = selectedEffect?.id === effect.id;
                                    const isPermanent = effect.type === 'permanent';
                                    const effectDetails = formatEffectDetails(effect.effects);

                                    return (
                                        <motion.div
                                            key={effect.id}
                                            className={`relative cursor-pointer transition-all duration-200`}
                                            onClick={() => setSelectedEffect(effect)}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            <div className={`rounded-lg border-2 overflow-hidden ${isSelected
                                                ? isPermanent
                                                    ? 'border-purple-400 bg-purple-900/30'
                                                    : 'border-yellow-400 bg-yellow-900/30'
                                                : 'border-gray-600 bg-gray-700/50'
                                                }`}>
                                                {/* 效果类型标签 */}
                                                <div className={`px-2 py-0.5 text-center text-[12px] font-bold ${isPermanent
                                                    ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-purple-100'
                                                    : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-yellow-100'
                                                    }`}>
                                                    {isPermanent ? '♾️ 永久效果' : '⏱ 短期效果（1年）'}
                                                </div>

                                                {/* 效果内容 */}
                                                <div className="p-2">
                                                    {/* 图标和标题 */}
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className={`p-2 rounded-lg ${isPermanent ? 'bg-purple-600/30' : 'bg-yellow-600/30'
                                                            }`}>
                                                            <Icon
                                                                name={getEffectIcon(effect.icon)}
                                                                size={20}
                                                                className={isPermanent ? 'text-purple-300' : 'text-yellow-300'}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-sm font-bold text-white leading-tight">
                                                                {effect.name}
                                                            </h3>
                                                        </div>
                                                        {/* 选中指示器 */}
                                                        {isSelected && (
                                                            <div className={`p-1 rounded-full ${isPermanent ? 'bg-purple-500' : 'bg-yellow-500'
                                                                }`}>
                                                                <Icon name="Check" size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 描述 */}
                                                    <p className="text-xs text-gray-300 mb-1.5 leading-relaxed">
                                                        {effect.description}
                                                    </p>

                                                    {/* 效果详情 */}
                                                    <div className="space-y-1 mb-1.5">
                                                        {effectDetails.map((detail, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center gap-1.5 text-xs p-1 rounded ${isPermanent
                                                                    ? 'bg-purple-900/30 border border-purple-600/30'
                                                                    : 'bg-yellow-900/30 border border-yellow-600/30'
                                                                    }`}
                                                            >
                                                                <Icon
                                                                    name="Plus"
                                                                    size={10}
                                                                    className={isPermanent ? 'text-purple-400' : 'text-yellow-400'}
                                                                />
                                                                <span className="text-gray-200 leading-none">{detail}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* 风味文本 */}
                                                    <div className="pt-1.5 border-t border-gray-600">
                                                        <p className="text-xs text-gray-400 italic leading-relaxed">
                                                            "{effect.flavorText}"
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* 选择提示 */}
                            {!selectedEffect && (
                                <div className="text-center">
                                    <p className="text-xs text-gray-400 animate-pulse leading-tight">
                                        👆 请选择一项庆典效果
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex-shrink-0 px-3 py-2 border-t border-gray-700 bg-gray-800/50">
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedEffect}
                                className={`w-full px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedEffect
                                    ? 'bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 hover:from-yellow-500 hover:via-orange-500 hover:to-red-500 text-white shadow-lg'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {selectedEffect
                                    ? `✨ 确认选择：${selectedEffect.name}`
                                    : '请先选择一项庆典效果'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
