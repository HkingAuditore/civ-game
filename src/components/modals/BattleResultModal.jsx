// 战斗结果模态框组件
// 显示战斗结果的详细信息

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES } from '../../config/militaryUnits';
import { RESOURCES } from '../../config/gameConstants';

/**
 * 战斗结果模态框组件
 * 显示战斗结果的详细信息
 * @param {Object} result - 战斗结果对象
 * @param {Function} onClose - 关闭回调
 */
export const BattleResultModal = ({ result, onClose }) => {
    // Removed isAnimatingOut and handleClose logic as AnimatePresence handles it
    const isPlayerAttacker = result?.isPlayerAttacker !== undefined ? result.isPlayerAttacker : true;
    const ourArmy = isPlayerAttacker ? result?.attackerArmy : result?.defenderArmy;
    const enemyArmy = isPlayerAttacker ? result?.defenderArmy : result?.attackerArmy;

    return createPortal(
        <AnimatePresence>
            {result && (
                <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-2">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-ancient-ink/90 backdrop-blur-sm"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-2xl glass-monument border-2 border-ancient-gold/40 rounded-t-2xl lg:rounded-2xl shadow-monument flex flex-col max-h-[90vh] overflow-hidden"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/80 via-ancient-stone/20 to-ancient-ink/70 opacity-70" />
                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
                            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                <pattern id="battle-result-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                                    <circle cx="10" cy="10" r="1" fill="currentColor" className="text-ancient-gold/50" />
                                    <circle cx="70" cy="70" r="1" fill="currentColor" className="text-ancient-gold/30" />
                                    <path d="M0 0 L80 0 L80 80" stroke="currentColor" strokeWidth="0.4" className="text-ancient-gold/10" fill="none" />
                                </pattern>
                                <rect width="100%" height="100%" fill="url(#battle-result-pattern)" />
                            </svg>
                        </div>

                        <div className="relative z-10 flex flex-col h-full min-h-0">
                            {/* 头部 */}
                            <div
                                className={`flex-shrink-0 p-4 border-b border-ancient-gold/20 ${result.victory
                                    ? 'bg-gradient-to-r from-emerald-900/40 to-blue-900/30'
                                    : 'bg-gradient-to-r from-red-900/50 to-ancient-ink/60'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-ancient-ink/60 border border-ancient-gold/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                                        <Icon
                                            name={result.victory ? 'Trophy' : 'Skull'}
                                            size={26}
                                            className={result.victory ? 'text-ancient-gold' : 'text-red-400'}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-bold text-ancient leading-tight flex items-center gap-2">
                                            {result.victory ? '战斗胜利' : '战斗失利…'}
                                            {typeof result.score === 'number' && (
                                                <span className="px-2 py-0.5 text-[10px] rounded-full border border-ancient-gold/30 text-ancient-parchment bg-ancient-ink/40">
                                                    评分 {result.score.toFixed(0)}
                                                </span>
                                            )}
                                        </h2>
                                        <p className="text-[11px] text-ancient-parchment opacity-80 leading-tight truncate">
                                            {result.missionName || '未知任务'}
                                            {result.missionDifficulty && ` · 难度${result.missionDifficulty}`}
                                            {result.nationName && ` · 对手：${result.nationName}`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-full hover:bg-ancient-gold/10 transition-colors flex-shrink-0 text-ancient-stone"
                                    >
                                        <Icon name="X" size={18} />
                                    </button>
                                </div>
                                {result.missionDesc && (
                                    <p className="text-[11px] text-ancient-stone mt-2 leading-snug">{result.missionDesc}</p>
                                )}
                            </div>

                            {/* 内容区域 - 添加移动端触摸滚动支持 */}
                            <div
                                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
                                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
                            >
                                {/* 战斗统计 */}
                                {(!result.isRaid || (result.isRaid && result.ourPower > 0)) && (
                                    <div className="glass-ancient rounded-xl border border-ancient-gold/20 p-3 shadow-ancient">
                                        <h3 className="text-[11px] font-bold mb-2 flex items-center gap-1 text-ancient-parchment">
                                            <Icon name="BarChart" size={14} className="text-ancient-gold" />
                                            战斗统计
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-ancient-ink/50 border border-ancient-gold/10 rounded-lg p-2">
                                                <p className="text-[10px] text-ancient-stone mb-1 leading-none">我方战力</p>
                                                <p className="text-base font-bold text-ancient font-mono leading-none">
                                                    {result.ourPower?.toFixed(0) || 0}
                                                </p>
                                            </div>
                                            <div className="bg-ancient-ink/50 border border-ancient-gold/10 rounded-lg p-2">
                                                <p className="text-[10px] text-ancient-stone mb-1 leading-none">敌方战力</p>
                                                <p className="text-base font-bold text-red-400 font-mono leading-none">
                                                    {result.enemyPower?.toFixed(0) || 0}
                                                </p>
                                            </div>
                                            <div className="bg-ancient-ink/50 border border-ancient-gold/10 rounded-lg p-2">
                                                <p className="text-[10px] text-ancient-stone mb-1 leading-none">战力优势</p>
                                                <p
                                                    className={`text-base font-bold font-mono leading-none ${result.powerRatio > 1 ? 'text-green-400' : 'text-red-400'
                                                        }`}
                                                >
                                                    {result.powerRatio?.toFixed(2) || 0}x
                                                </p>
                                            </div>
                                            <div className="bg-ancient-ink/50 border border-ancient-gold/10 rounded-lg p-2">
                                                <p className="text-[10px] text-ancient-stone mb-1 leading-none">战斗评分</p>
                                                <p className="text-base font-bold text-purple-400 font-mono leading-none">
                                                    {result.score?.toFixed(0) || 0}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(ourArmy || enemyArmy) && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[11px] font-bold mb-2 flex items-center gap-1 text-white">
                                            <Icon name="Users" size={12} className="text-blue-400" />
                                            参战部队
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* 我方部队 */}
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 border-b border-gray-600 pb-1 mb-1">我方</div>
                                                {Object.entries(ourArmy || {}).map(([unitId, count]) => {
                                                    const unit = UNIT_TYPES[unitId];
                                                    if (!unit || count === 0) return null;
                                                    return (
                                                        <div key={unitId} className="flex items-center justify-between">
                                                            <span className="text-[10px] text-gray-300">{unit.name}</span>
                                                            <span className="text-[10px] font-mono text-gray-200">{count}</span>
                                                        </div>
                                                    );
                                                })}
                                                {Object.keys(ourArmy || {}).length === 0 && (
                                                    <div className="text-[10px] text-gray-500 italic">无数据</div>
                                                )}
                                            </div>

                                            {/* 敌方部队 */}
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 border-b border-gray-600 pb-1 mb-1">敌方</div>
                                                {Object.entries(enemyArmy || {}).map(([unitId, count]) => {
                                                    const unit = UNIT_TYPES[unitId];
                                                    if (!unit || count === 0) return null;
                                                    return (
                                                        <div key={unitId} className="flex items-center justify-between">
                                                            <span className="text-[10px] text-gray-300">{unit.name}</span>
                                                            <span className="text-[10px] font-mono text-red-300">{count}</span>
                                                        </div>
                                                    );
                                                })}
                                                {Object.keys(enemyArmy || {}).length === 0 && (
                                                    <div className="text-[10px] text-gray-500 italic">无数据</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 我方损失 - 使用 result.losses（对应玩家作为攻击方的损失） */}
                                {(!result.isRaid || (result.isRaid && Object.keys(result.losses || {}).length > 0)) && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                                            <Icon name="Heart" size={12} className="text-red-400" />
                                            我方损失
                                        </h3>
                                        {Object.keys(result.losses || {}).length > 0 ? (
                                            <div className="space-y-1">
                                                {Object.entries(result.losses || {}).map(([unitId, count]) => {
                                                    const unit = UNIT_TYPES[unitId];
                                                    if (!unit || count === 0) return null;
                                                    return (
                                                        <div
                                                            key={unitId}
                                                            className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <Icon name="User" size={12} className="text-red-400" />
                                                                <span className="text-[10px] text-white leading-none">{unit.name}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{count}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 bg-green-900/20 border border-green-600/30 rounded">
                                                <Icon name="Check" size={16} className="text-green-400 mx-auto mb-1" />
                                                <p className="text-[10px] text-green-300 leading-tight">无损失！完美胜利！</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 敌方损失 - 使用 result.enemyLosses（对应敌人作为防守方的损失） */}
                                {result.enemyLosses && Object.keys(result.enemyLosses).length > 0 && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                                            <Icon name="Skull" size={12} className="text-gray-400" />
                                            敌方损失
                                        </h3>
                                        <div className="space-y-1">
                                            {Object.entries(result.enemyLosses).map(([unitId, count]) => {
                                                const unit = UNIT_TYPES[unitId];
                                                if (!unit || count === 0) return null;
                                                return (
                                                    <div
                                                        key={unitId}
                                                        className="flex items-center justify-between bg-gray-800/50 p-1.5 rounded"
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <Icon name="User" size={12} className="text-gray-400" />
                                                            <span className="text-[10px] text-white leading-none">{unit?.name || unitId}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-400 font-mono leading-none">-{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 资源损失（突袭事件） */}
                                {result.isRaid && (result.foodLoss > 0 || result.silverLoss > 0) && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                                            <Icon name="AlertTriangle" size={12} className="text-red-400" />
                                            资源损失
                                        </h3>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {result.foodLoss > 0 && (
                                                <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                                                    <span className="text-[10px] text-gray-300 leading-none">粮食</span>
                                                    <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.foodLoss}</span>
                                                </div>
                                            )}
                                            {result.silverLoss > 0 && (
                                                <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                                                    <span className="text-[10px] text-gray-300 leading-none">银币</span>
                                                    <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.silverLoss}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 人口损失（突袭事件） */}
                                {result.isRaid && result.popLoss > 0 && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                                            <Icon name="Users" size={12} className="text-red-400" />
                                            人口损失
                                        </h3>
                                        <div className="bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-300 leading-none">总人口</span>
                                                <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.popLoss}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 战利品 */}
                                {result.victory && result.resourcesGained && Object.keys(result.resourcesGained).length > 0 && (
                                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                        <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                                            <Icon name="Gift" size={12} className="text-yellow-400" />
                                            战利品
                                        </h3>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {Object.entries(result.resourcesGained).map(([resource, amount]) => (
                                                <div
                                                    key={resource}
                                                    className="flex items-center justify-between bg-yellow-900/20 border border-yellow-600/30 p-1.5 rounded"
                                                >
                                                    <span className="text-[10px] text-gray-300 leading-none">{RESOURCES[resource]?.name || resource}</span>
                                                    <span className="text-[10px] font-bold text-yellow-400 font-mono leading-none">+{amount}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 战斗描述 */}
                                {/*result.description && (
                <div className="bg-gray-700/30 p-2 rounded border border-gray-600">
                  <p className="text-[10px] text-gray-300 leading-relaxed">
                    {result.description}
                  </p>
                </div>
              )*/}
                            </div>

                            {/* 底部按钮 */}
                            <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800/50">
                                <button
                                    onClick={onClose}
                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
                                >
                                    确定
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div >
            )}
        </AnimatePresence >,
        document.body
    );
};
