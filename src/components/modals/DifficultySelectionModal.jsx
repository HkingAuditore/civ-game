// 难度选择模态框组件
// 在另开新档时弹出，让玩家选择难度

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { getDifficultyOptions, DEFAULT_DIFFICULTY } from '../../config/difficulty';
import { getScenarioOptions } from '../../config/scenarios';

/**
 * 新档模式选择模态框组件
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {Function} onConfirm - 确认回调函数，传入 { difficulty, scenarioId, mode }
 * @param {Function} onCancel - 取消回调函数
 */
export const DifficultySelectionModal = ({ isOpen, onConfirm, onCancel }) => {
    const [selectedDifficulty, setSelectedDifficulty] = useState(DEFAULT_DIFFICULTY);
    const [mode, setMode] = useState('standard');
    const [selectedScenario, setSelectedScenario] = useState(null);
    const difficultyOptions = getDifficultyOptions();
    const scenarioOptions = getScenarioOptions();

    useEffect(() => {
        if (!isOpen) return;
        setSelectedDifficulty(DEFAULT_DIFFICULTY);
        setMode('standard');
        setSelectedScenario(scenarioOptions[0]?.id ?? null);
    }, [isOpen, scenarioOptions]);

    const handleConfirm = () => {
        onConfirm({
            difficulty: selectedDifficulty,
            scenarioId: mode === 'scenario' ? selectedScenario : null,
            mode,
        });
    };

    // 获取难度的样式配置
    const getDifficultyStyle = (difficultyId, isSelected) => {
        const baseStyle = 'rounded-lg border-2 p-3 cursor-pointer transition-all duration-200';

        if (difficultyId === 'very_easy' || difficultyId === 'easy') {
            return `${baseStyle} ${isSelected
                ? 'border-green-400 bg-green-900/40 shadow-lg shadow-green-500/20'
                : 'border-green-600/30 bg-green-900/20 hover:border-green-500/50'}`;
        } else if (difficultyId === 'normal') {
            return `${baseStyle} ${isSelected
                ? 'border-yellow-400 bg-yellow-900/40 shadow-lg shadow-yellow-500/20'
                : 'border-yellow-600/30 bg-yellow-900/20 hover:border-yellow-500/50'}`;
        } else if (difficultyId === 'hard') {
            return `${baseStyle} ${isSelected
                ? 'border-orange-400 bg-orange-900/40 shadow-lg shadow-orange-500/20'
                : 'border-orange-600/30 bg-orange-900/20 hover:border-orange-500/50'}`;
        } else {
            // Very Hard & Extreme
            return `${baseStyle} ${isSelected
                ? 'border-red-400 bg-red-900/40 shadow-lg shadow-red-500/20'
                : 'border-red-600/30 bg-red-900/20 hover:border-red-500/50'}`;
        }
    };

    const getTextColor = (difficultyId) => {
        if (difficultyId === 'very_easy' || difficultyId === 'easy') return 'text-green-300';
        if (difficultyId === 'normal') return 'text-yellow-300';
        if (difficultyId === 'hard') return 'text-orange-300';
        return 'text-red-300';
    };

    const getIconColor = (difficultyId) => {
        if (difficultyId === 'very_easy' || difficultyId === 'easy') return 'text-green-400';
        if (difficultyId === 'normal') return 'text-yellow-400';
        if (difficultyId === 'hard') return 'text-orange-400';
        return 'text-red-400';
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-md glass-epic border-t-2 lg:border-2 border-ancient-gold/40 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[92vh]"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* 头部 */}
                        <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Icon name="Target" size={22} className="text-ancient-gold" />
                                    <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-ancient-gold via-yellow-400 to-orange-400">
                                        选择新档模式
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-400">
                                    标准模式选择难度，情景模式选择起始条件
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setMode('standard')}
                                    className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${mode === 'standard'
                                        ? 'bg-ancient-gold/30 text-ancient-gold border border-ancient-gold/40'
                                        : 'bg-gray-700/40 text-gray-300 border border-transparent hover:border-gray-500/40'}`}
                                >
                                    标准模式
                                </button>
                                <button
                                    onClick={() => setMode('scenario')}
                                    className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${mode === 'scenario'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                        : 'bg-gray-700/40 text-gray-300 border border-transparent hover:border-gray-500/40'}`}
                                >
                                    情景模式
                                </button>
                            </div>
                        </div>

                        {/* 难度选项 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {mode === 'standard' && difficultyOptions.map((option) => {
                                const isSelected = selectedDifficulty === option.id;
                                return (
                                    <motion.div
                                        key={option.id}
                                        className={getDifficultyStyle(option.id, isSelected)}
                                        onClick={() => setSelectedDifficulty(option.id)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* 图标 */}
                                            <div className="text-2xl flex-shrink-0">
                                                {option.icon}
                                            </div>

                                            {/* 内容 */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`text-base font-bold ${getTextColor(option.id)}`}>
                                                        {option.name}
                                                    </h3>
                                                    {isSelected && (
                                                        <Icon
                                                            name="Check"
                                                            size={16}
                                                            className={getIconColor(option.id)}
                                                        />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                                                    {option.description}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {mode === 'scenario' && scenarioOptions.length === 0 && (
                                <div className="text-center text-xs text-gray-400 py-6">
                                    暂无可用情景配置
                                </div>
                            )}

                            {mode === 'scenario' && scenarioOptions.map((scenario) => {
                                const isSelected = selectedScenario === scenario.id;
                                return (
                                    <motion.div
                                        key={scenario.id}
                                        className={`rounded-lg border-2 p-3 cursor-pointer transition-all duration-200 ${isSelected
                                            ? 'border-emerald-400/60 bg-emerald-900/30 shadow-lg shadow-emerald-500/10'
                                            : 'border-emerald-600/20 bg-gray-900/30 hover:border-emerald-500/40'}`}
                                        onClick={() => setSelectedScenario(scenario.id)}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl flex-shrink-0">
                                                {scenario.icon || '📜'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-base font-bold text-emerald-200">
                                                        {scenario.name}
                                                    </h3>
                                                    {isSelected && (
                                                        <Icon
                                                            name="Check"
                                                            size={16}
                                                            className="text-emerald-300"
                                                        />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                                                    {scenario.description}
                                                </p>
                                                {scenario.highlights?.length > 0 && (
                                                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                                                        {scenario.highlights.join(' · ')}
                                                    </p>
                                                )}
                                                {scenario.tags?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {scenario.tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-900/40 text-emerald-200 border border-emerald-700/30"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* 提示信息 */}
                        <div className="flex-shrink-0 px-4">
                            <div className="bg-blue-900/30 border border-blue-500/30 p-3 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Icon name="Info" size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-blue-300 leading-relaxed">
                                        <span className="font-bold">提示：</span>
                                        {mode === 'standard'
                                            ? '开始新游戏不会删除您的现有存档，您可以随时通过读取存档继续之前的游戏。'
                                            : '情景模式会覆盖部分初始状态，可在配置文件中自由调整，难度默认普通。'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/50">
                            <div className="flex gap-3">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-red-400 hover:to-orange-400 text-white shadow-lg transition-all"
                                >
                                    {mode === 'scenario' ? '开始情景' : '开始新游戏'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
