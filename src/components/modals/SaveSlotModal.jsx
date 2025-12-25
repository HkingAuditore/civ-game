// 存档槽位选择弹窗组件
// 支持保存模式和加载模式，显示所有存档槽位信息

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { getAllSaveSlots } from '../../hooks/useGameState';
import { EPOCHS } from '../../config/epochs';

/**
 * 格式化时间戳为可读日期
 */
const formatDate = (timestamp) => {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * 格式化游戏天数为年月
 */
const formatGameTime = (daysElapsed) => {
    if (!daysElapsed) return '第1年';
    const year = Math.floor(daysElapsed / 360) + 1;
    const dayInYear = daysElapsed % 360;
    const month = Math.floor(dayInYear / 30) + 1;
    return `第${year}年${month}月`;
};

/**
 * 存档槽位选择弹窗组件
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {string} mode - 模式: 'save' 保存 | 'load' 加载
 * @param {Function} onSelect - 选择回调函数，传入 slotIndex
 * @param {Function} onCancel - 取消回调函数
 */
export const SaveSlotModal = ({ isOpen, mode = 'save', onSelect, onCancel }) => {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // 获取存档槽位信息
    const slots = useMemo(() => {
        if (!isOpen) return [];
        return getAllSaveSlots();
    }, [isOpen]);

    // 分离手动存档和自动存档
    const manualSlots = slots.filter(s => !s.isAutoSave);
    const autoSlot = slots.find(s => s.isAutoSave);

    const isSaveMode = mode === 'save';
    const title = isSaveMode ? '保存游戏' : '加载存档';
    const subtitle = isSaveMode
        ? '选择一个存档槽位保存当前进度'
        : '选择一个存档读取';

    const handleSlotClick = (slot) => {
        if (isSaveMode) {
            // 保存模式：如果槽位非空，需要确认覆盖
            if (!slot.isEmpty) {
                setSelectedSlot(slot);
                setShowConfirm(true);
            } else {
                onSelect(slot.slotIndex);
            }
        } else {
            // 加载模式：只能选择非空槽位
            if (!slot.isEmpty) {
                onSelect(slot.slotIndex);
            }
        }
    };

    const handleConfirmOverwrite = () => {
        if (selectedSlot) {
            onSelect(selectedSlot.slotIndex);
        }
        setShowConfirm(false);
        setSelectedSlot(null);
    };

    const handleCancelOverwrite = () => {
        setShowConfirm(false);
        setSelectedSlot(null);
    };

    const renderSlotCard = (slot, isAuto = false) => {
        const isEmpty = slot.isEmpty;
        const isDisabled = !isSaveMode && isEmpty;
        const epoch = EPOCHS[slot.epoch] || EPOCHS[0];

        return (
            <motion.div
                key={isAuto ? 'auto' : slot.slotIndex}
                className={`
                    relative rounded-xl border-2 p-3 transition-all
                    ${isDisabled
                        ? 'border-gray-700/50 bg-gray-800/30 cursor-not-allowed opacity-50'
                        : isEmpty
                            ? 'border-dashed border-gray-600 bg-gray-800/50 hover:border-ancient-gold/50 hover:bg-gray-700/50 cursor-pointer'
                            : isAuto
                                ? 'border-amber-500/40 bg-amber-900/20 hover:border-amber-400/60 hover:bg-amber-900/30 cursor-pointer'
                                : 'border-ancient-gold/40 bg-gray-800/60 hover:border-ancient-gold/60 hover:bg-gray-700/60 cursor-pointer'
                    }
                `}
                onClick={() => !isDisabled && handleSlotClick(slot)}
                whileHover={!isDisabled ? { scale: 1.02 } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
            >
                {/* 槽位标题 */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isAuto ? 'Clock' : 'Save'}
                            size={14}
                            className={isAuto ? 'text-amber-400' : 'text-ancient-gold'}
                        />
                        <span className={`text-sm font-bold ${isAuto ? 'text-amber-300' : 'text-ancient-parchment'}`}>
                            {slot.name}
                        </span>
                        {isAuto && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 font-medium">
                                自动
                            </span>
                        )}
                    </div>
                    {!isEmpty && (
                        <Icon
                            name={isSaveMode ? 'Edit3' : 'ArrowRight'}
                            size={12}
                            className="text-gray-400"
                        />
                    )}
                </div>

                {isEmpty ? (
                    <div className="text-center py-4">
                        <Icon name="Plus" size={24} className="text-gray-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">空白存档</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {/* 游戏进度 */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">进度:</span>
                            <span className="text-white font-medium">{formatGameTime(slot.daysElapsed)}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-300">{epoch?.name || '石器时代'}</span>
                        </div>

                        {/* 人口和难度 */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">人口:</span>
                            <span className="text-blue-300 font-medium">{slot.population || 0}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-400">难度:</span>
                            <span className="font-medium">
                                {slot.difficultyIcon} {slot.difficultyName}
                            </span>
                        </div>

                        {/* 保存时间 */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                            <Icon name="Clock" size={10} />
                            <span>{formatDate(slot.updatedAt)}</span>
                        </div>
                    </div>
                )}
            </motion.div>
        );
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
                                    <Icon
                                        name={isSaveMode ? 'Save' : 'Upload'}
                                        size={22}
                                        className="text-ancient-gold"
                                    />
                                    <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-ancient-gold via-yellow-400 to-orange-400">
                                        {title}
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-400">
                                    {subtitle}
                                </p>
                            </div>
                        </div>

                        {/* 存档槽位列表 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {/* 手动存档槽位 */}
                            <div className="space-y-2">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold px-1">
                                    手动存档
                                </p>
                                {manualSlots.map(slot => renderSlotCard(slot))}
                            </div>

                            {/* 自动存档（仅加载模式显示） */}
                            {!isSaveMode && autoSlot && (
                                <div className="space-y-2 pt-2 border-t border-gray-700/50">
                                    <p className="text-[10px] text-amber-500/80 uppercase tracking-wide font-semibold px-1">
                                        自动存档
                                    </p>
                                    {renderSlotCard(autoSlot, true)}
                                </div>
                            )}
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex-shrink-0 p-4 border-t border-gray-700 bg-gray-800/50">
                            <button
                                onClick={onCancel}
                                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </motion.div>

                    {/* 覆盖确认对话框 */}
                    <AnimatePresence>
                        {showConfirm && (
                            <motion.div
                                className="absolute inset-0 z-10 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="absolute inset-0 bg-black/60" onClick={handleCancelOverwrite} />
                                <motion.div
                                    className="relative bg-gray-800 border border-red-500/50 rounded-xl p-4 max-w-sm mx-4 shadow-2xl"
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon name="AlertTriangle" size={20} className="text-red-400" />
                                        <h3 className="text-base font-bold text-red-300">覆盖存档</h3>
                                    </div>
                                    <p className="text-sm text-gray-300 mb-4">
                                        确定要覆盖 <span className="font-bold text-white">{selectedSlot?.name}</span> 吗？
                                        <br />
                                        <span className="text-xs text-gray-400">
                                            当前存档：{formatGameTime(selectedSlot?.daysElapsed)}，{selectedSlot?.difficultyIcon} {selectedSlot?.difficultyName}
                                        </span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCancelOverwrite}
                                            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleConfirmOverwrite}
                                            className="flex-1 px-3 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
                                        >
                                            确认覆盖
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
