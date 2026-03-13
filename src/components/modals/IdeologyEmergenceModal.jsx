/**
 * 理念涌现弹窗 — 三选一
 * 当理念分数达到阈值时弹出，展示3张候选理念卡牌
 */

import React, { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { IdeologyCard } from '../tabs/IdeologyCard';

const IdeologyEmergenceModalComponent = ({
    show = false,
    candidates = [],   // 3个候选理念对象
    onSelect,           // (ideologyId) => void
    equippedIds = [],   // 当前已装备的理念id
}) => {
    const [selectedId, setSelectedId] = useState(null);
    const [confirming, setConfirming] = useState(false);

    const handleSelect = (id) => {
        setSelectedId(id);
        setConfirming(false);
    };

    const handleConfirm = () => {
        if (selectedId && onSelect) {
            onSelect(selectedId);
            setSelectedId(null);
            setConfirming(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            {show && candidates.length > 0 && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    />

                    {/* 内容区域 */}
                    <motion.div
                        className="relative w-full max-w-[1400px] max-h-[88vh] overflow-y-auto flex flex-col items-center px-1"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* 标题 */}
                        <div className="text-center mb-6">
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Icon name="Sparkles" size={24} className="text-purple-400" />
                                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 font-decorative">
                                        理念涌现
                                    </h2>
                                    <Icon name="Sparkles" size={24} className="text-cyan-400" />
                                </div>
                                <p className="text-sm text-gray-400">
                                    文明的思想之光闪耀，请选择一个理念加入你的收藏
                                </p>
                            </motion.div>
                        </div>

                        {/* 三张卡牌 */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-4 w-full mb-6">
                            {candidates.map((candidate, index) => (
                                <motion.div
                                    key={candidate.id}
                                    initial={{ opacity: 0, y: 40, rotateY: -90 }}
                                    animate={{
                                        opacity: selectedId && selectedId !== candidate.id ? 0.4 : 1,
                                        y: 0,
                                        rotateY: 0,
                                        scale: selectedId === candidate.id ? 1.05 : selectedId ? 0.95 : 1,
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
                                </motion.div>
                            ))}
                        </div>

                        {/* 确认按钮 */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: selectedId ? 1 : 0.3 }}
                            className="text-center"
                        >
                            {!confirming ? (
                                <button
                                    onClick={() => selectedId && setConfirming(true)}
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
                            ) : (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleConfirm}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-600 border-2 border-green-400/50 text-white shadow-lg hover:shadow-green-500/30 transition-all"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Icon name="Check" size={16} />
                                            确定
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setConfirming(false)}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-800 border-2 border-gray-600 text-gray-300 hover:bg-gray-700 transition-all"
                                    >
                                        返回
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export const IdeologyEmergenceModal = memo(IdeologyEmergenceModalComponent);
