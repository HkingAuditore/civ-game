/**
 * 理念涌现弹窗 — 三选一
 * 当理念分数达到阈值时弹出，展示3张候选理念卡牌
 * 若收藏已满（非升级），进入第二步"替换"流程
 */

import React, { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { IdeologyCard } from '../tabs/IdeologyCard';
import { IdeologyDetailSheet } from '../tabs/IdeologyDetailSheet';
import { useDevicePerformance } from '../../hooks/useDevicePerformance';
import { IDEOLOGY_MAP } from '../../config/ideologies';

const MotionDiv = motion.div;

const IdeologyEmergenceModalComponent = ({
    show = false,
    candidates = [],   // 3个候选理念对象
    onSelect,           // (ideologyId, discardId?) => void
    onSkip,             // () => void  跳过本次涌现
    equippedIds = [],   // 当前已装备的理念id
    collectionFull = false,   // 未装备收藏是否已满（>=10）
    collectionList = [],      // 当前未装备的理念列表 [{id, level, config}]
    rarityBonus = 0,    // 当前跳过累积的稀有度加成（0~3）
}) => {
    const [selectedId, setSelectedId] = useState(null);
    const [step, setStep] = useState(1); // 1=选择新理念, 2=选择放弃哪个
    const [discardId, setDiscardId] = useState(null);
    const [detailEntry, setDetailEntry] = useState(null);
    const { isLowPerformanceMode } = useDevicePerformance();

    const overlayClassName = 'absolute inset-0 bg-black/85 backdrop-blur-sm';
    const containerClassName = 'fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4';
    const shellClassName = 'relative w-full max-w-[1200px] flex flex-col items-center px-1';
    const gridViewportStyle = isLowPerformanceMode
        ? { overflowX: 'clip', WebkitOverflowScrolling: 'touch', padding: '12px' }
        : { overflowX: 'clip', WebkitOverflowScrolling: 'touch', padding: '6px 12px' };

    const handleSelect = useCallback((id) => {
        setSelectedId(id);
    }, []);

    // 判断选中的候选理念是否是已有理念的升级（同ID）
    const isUpgrade = selectedId
        ? candidates.find(c => c.id === selectedId)?.isUpgrade === true
        : false;

    // 第一步确认：若收藏满且非升级，进入第二步；否则直接完成
    const handleStep1Confirm = useCallback(() => {
        if (!selectedId) return;
        if (collectionFull && !isUpgrade) {
            setStep(2);
        } else {
            onSelect?.(selectedId);
            setSelectedId(null);
            setStep(1);
            setDiscardId(null);
            setDetailEntry(null);
        }
    }, [selectedId, collectionFull, isUpgrade, onSelect]);

    // 第二步确认：选择放弃的理念后完成
    const handleStep2Confirm = useCallback(() => {
        if (!discardId) return;
        onSelect?.(selectedId, discardId);
        setSelectedId(null);
        setStep(1);
        setDiscardId(null);
        setDetailEntry(null);
    }, [selectedId, discardId, onSelect]);

    const handleBack = useCallback(() => {
        setStep(1);
        setDiscardId(null);
        setDetailEntry(null);
    }, []);

    return createPortal(
        <AnimatePresence>
            {show && candidates.length > 0 && (
                <div
                    key="ideology-emergence-modal"
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

                    <MotionDiv
                        className={shellClassName}
                        style={{ maxHeight: '88vh', overflow: 'visible' }}
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 24 }}
                        transition={{ type: "spring", damping: 28, stiffness: 320 }}
                    >
                        {step === 1 ? (
                            <>
                                {/* 第一步：选择新理念 */}
                                <div className="text-center mb-2 sm:mb-4 shrink-0">
                                    <MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                                        {/* 稀有度加成提示 */}
                                        {rarityBonus > 0 && (
                                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/30 border border-amber-500/40 text-xs text-amber-300">
                                                <Icon name="TrendingUp" size={12} className="text-amber-400" />
                                                已跳过 {rarityBonus} 次，稀有度加成 +{rarityBonus} 层（上限3层）
                                            </div>
                                        )}
                                        {/* 收藏满提示 */}
                                        {collectionFull && (
                                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-900/30 border border-red-500/40 text-xs text-red-300">
                                                <Icon name="AlertTriangle" size={12} className="text-red-400" />
                                                收藏已满（10/10），选择后需放弃一个旧理念
                                            </div>
                                        )}
                                    </MotionDiv>
                                </div>

                                <div className="overflow-y-auto flex-1 min-h-0 w-full mb-2" style={gridViewportStyle}>
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
                                                transition={{ delay: 0.3 + index * 0.15, type: "spring", damping: 20, stiffness: 200 }}
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

                <MotionDiv
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: selectedId ? 1 : 0.3 }}
                                    className="text-center shrink-0 pt-1 pb-1"
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        {/* 跳过按钮 */}
                                        <button
                                            onClick={() => {
                                                setSelectedId(null);
                                                setStep(1);
                                                setDiscardId(null);
                                                setDetailEntry(null);
                                                onSkip?.();
                                            }}
                                            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all border-2 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500"
                                            title={rarityBonus < 3 ? `跳过后下次稀有度加成 +1（当前 ${rarityBonus}/3）` : '已达稀有度加成上限（3/3）'}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon name="SkipForward" size={16} />
                                                跳过
                                                {rarityBonus < 3
                                                    ? <span className="text-amber-400 text-xs">（稀有度+1）</span>
                                                    : <span className="text-gray-500 text-xs">（已满）</span>
                                                }
                                            </span>
                                        </button>
                                        {/* 确认按钮 */}
                                        <button
                                            onClick={handleStep1Confirm}
                                            disabled={!selectedId}
                                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                                                selectedId
                                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/50 text-white shadow-lg hover:shadow-purple-500/30 hover:scale-105'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon name={collectionFull && !isUpgrade ? 'ArrowRight' : 'Check'} size={16} />
                                                {collectionFull && !isUpgrade ? '下一步：选择放弃' : '确认选择'}
                                            </span>
                                        </button>
                                    </div>
                                </MotionDiv>
                            </>
                        ) : (
                            <>
                                {/* 第二步：选择放弃哪个旧理念 */}
                                <div className="text-center mb-2 sm:mb-4 shrink-0">
                                    <MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <Icon name="Trash2" size={20} className="text-red-400" />
                                            <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-yellow-400 font-decorative">
                                                选择放弃的理念
                                            </h2>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-400">
                                            收藏已满，请选择一个未装备的理念放弃，以获得
                                            <span className="text-purple-300 font-semibold mx-1">
                                                {IDEOLOGY_MAP[selectedId]?.name || selectedId}
                                            </span>
                                        </p>
                                    </MotionDiv>
                                </div>

                                <div className="overflow-y-auto flex-1 min-h-0 w-full mb-2" style={gridViewportStyle}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                                        {collectionList.map((entry, index) => (
                                            <MotionDiv
                                                key={entry.id}
                                                className={discardId === entry.id ? 'ring-2 ring-red-400/50 rounded-xl' : ''}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{
                                                    opacity: discardId && discardId !== entry.id ? 0.4 : 1,
                                                    y: 0,
                                                }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <IdeologyCard
                                                    ideology={entry.config || IDEOLOGY_MAP[entry.id]}
                                                    level={entry.level || 1}
                                                    isEquipped={false}
                                                    equippedIds={equippedIds}
                                                    compact={false}
                                                    onCardClick={() => setDetailEntry(entry)}
                                                    showCollectionActions={false}
                                                    customAction={{
                                                        label: discardId === entry.id ? '已选中放弃目标' : '放弃这个理念',
                                                        disabled: discardId === entry.id,
                                                        className: discardId === entry.id
                                                            ? 'bg-red-950/40 text-red-200 border border-red-500/50'
                                                            : 'bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-600/40',
                                                        onClick: () => setDiscardId(entry.id),
                                                    }}
                                                />
                                            </MotionDiv>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 pt-1 pb-1">
                                    <button
                                        onClick={handleBack}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-all"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Icon name="ArrowLeft" size={16} />
                                            返回
                                        </span>
                                    </button>
                                    <MotionDiv
                                        animate={{ opacity: discardId ? 1 : 0.3 }}
                                    >
                                        <button
                                            onClick={handleStep2Confirm}
                                            disabled={!discardId}
                                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                                                discardId
                                                    ? 'bg-gradient-to-r from-red-700 to-orange-600 border-red-400/50 text-white shadow-lg hover:scale-105'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon name="Check" size={16} />
                                                确认替换
                                            </span>
                                        </button>
                                    </MotionDiv>
                                </div>
                            </>
                        )}
                    </MotionDiv>
                </div>
            )}
            <IdeologyDetailSheet
                key="ideology-emergence-detail-sheet"
                ideology={detailEntry?.config || null}
                level={detailEntry?.level || 1}
                isEquipped={false}
                equippedIds={equippedIds}
                primaryAction={step === 2 && detailEntry ? {
                    label: discardId === detailEntry.id ? '已选中放弃目标' : '选择放弃这个理念',
                    icon: 'Trash2',
                    disabled: discardId === detailEntry.id,
                    className: 'border-red-500/50 text-red-200 bg-red-900/20 hover:bg-red-900/40',
                    onClick: () => setDiscardId(detailEntry.id),
                } : null}
                zIndex={130}
                onClose={() => setDetailEntry(null)}
            />
        </AnimatePresence>,
        document.body
    );
};

export const IdeologyEmergenceModal = memo(IdeologyEmergenceModalComponent);
