/**
 * 执政联盟面板组件
 * 允许玩家选择与哪些阶层联合执政
 */

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config';
import {
    getLegitimacyLevel,
    getLegitimacyLevelInfo,
    getEligibleCoalitionStrata,
    LEGITIMACY_THRESHOLD,
    calculateLegitimacy, // 用于实时计算合法性
    getLegitimacyTaxModifier, // 税收修正
    getLegitimacyOrganizationModifier, // 组织度增长修正
    getLegitimacyApprovalModifier, // 满意度修正
    COALITION_SENSITIVITY, // 联盟阶层敏感度配置
} from '../../logic/rulingCoalition';

// 阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'knight', 'engineer'],
    },
    middle: {
        name: '中产阶级',
        keys: ['artisan', 'soldier', 'cleric', 'scribe', 'navigator'],
    },
    lower: {
        name: '下层阶级',
        keys: ['peasant', 'serf', 'lumberjack', 'worker', 'miner'],
    },
};

/**
 * 执政联盟面板
 * @param {Object} props
 * @param {string[]} props.rulingCoalition - 当前联盟成员阶层键数组
 * @param {Function} props.onUpdateCoalition - 更新联盟回调函数
 * @param {Object} props.classInfluence - 各阶层影响力
 * @param {number} props.totalInfluence - 总影响力
 * @param {number} props.legitimacy - 当前合法性值
 * @param {Object} props.popStructure - 人口结构
 */
export const CoalitionPanel = ({
    rulingCoalition = [],
    onUpdateCoalition,
    classInfluence = {},
    totalInfluence = 0,
    legitimacy = 0,
    popStructure = {},
    classApproval = {}, // 新增：各阶层满意度
}) => {
    // 获取可选阶层
    const eligibleStrata = getEligibleCoalitionStrata(popStructure);

    // 计算联盟总影响力占比
    const coalitionInfluenceShare = React.useMemo(() => {
        if (totalInfluence <= 0) return 0;
        let share = 0;
        rulingCoalition.forEach(key => {
            share += classInfluence[key] || 0;
        });
        return share / totalInfluence;
    }, [rulingCoalition, classInfluence, totalInfluence]);

    // 实时计算合法性值和等级（不依赖传入的 legitimacy，暂停时也能更新）
    const realTimeLegitimacy = React.useMemo(() => {
        return calculateLegitimacy(coalitionInfluenceShare, {
            classApproval,
            coalitionMembers: rulingCoalition,
            classInfluence,
        });
    }, [coalitionInfluenceShare, classApproval, rulingCoalition, classInfluence]);

    // 实时计算税收修正和组织度修正
    const taxModifier = React.useMemo(() => {
        return getLegitimacyTaxModifier(realTimeLegitimacy);
    }, [realTimeLegitimacy]);

    const orgModifier = React.useMemo(() => {
        // 非联盟阶层的组织度增长修正
        return getLegitimacyOrganizationModifier(realTimeLegitimacy, false);
    }, [realTimeLegitimacy]);

    // 获取合法性等级信息（基于实时计算值）
    const legitimacyLevel = getLegitimacyLevel(realTimeLegitimacy);
    const legitimacyInfo = getLegitimacyLevelInfo(legitimacyLevel);

    // 满意度修正（非法政府惩罚）
    const approvalModifier = React.useMemo(() => {
        return getLegitimacyApprovalModifier(realTimeLegitimacy);
    }, [realTimeLegitimacy]);

    // 计算联盟成员加权平均满意度和满意度因子
    const { avgCoalitionApproval, approvalLegitimacyFactor } = React.useMemo(() => {
        if (rulingCoalition.length === 0) {
            return { avgCoalitionApproval: 50, approvalLegitimacyFactor: 1.0 };
        }
        let totalWeight = 0;
        let weightedApproval = 0;
        rulingCoalition.forEach(key => {
            const approval = classApproval[key] ?? 50;
            const influence = classInfluence[key] || 1;
            weightedApproval += approval * influence;
            totalWeight += influence;
        });
        const avg = totalWeight > 0 ? weightedApproval / totalWeight : 50;
        const factor = avg < 50 ? (0.5 + avg / 100) : 1.0;
        return { avgCoalitionApproval: avg, approvalLegitimacyFactor: factor };
    }, [rulingCoalition, classApproval, classInfluence]);

    // 切换阶层联盟状态
    const toggleCoalitionMember = (stratumKey) => {
        if (!onUpdateCoalition) return;

        if (rulingCoalition.includes(stratumKey)) {
            // 移除
            onUpdateCoalition(rulingCoalition.filter(k => k !== stratumKey));
        } else {
            // 添加
            onUpdateCoalition([...rulingCoalition, stratumKey]);
        }
    };

    // 渲染单个阶层选择卡片
    const renderStratumCard = (stratumKey) => {
        const stratum = STRATA[stratumKey];
        if (!stratum) return null;

        const isSelected = rulingCoalition.includes(stratumKey);
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? (influence / totalInfluence * 100).toFixed(1) : '0.0';
        const population = popStructure[stratumKey] || 0;

        return (
            <button
                key={stratumKey}
                onClick={() => toggleCoalitionMember(stratumKey)}
                className={`
                    relative p-2 rounded-lg border transition-all cursor-pointer
                    ${isSelected
                        ? 'bg-amber-900/30 border-amber-500/50 ring-1 ring-amber-400/30'
                        : 'bg-gray-900/30 border-gray-700/50 hover:border-gray-600'
                    }
                `}
            >
                {/* 选中指示器 */}
                {isSelected && (
                    <div className="absolute top-1 right-1">
                        <Icon name="Check" size={12} className="text-amber-400" />
                    </div>
                )}

                {/* 阶层信息 */}
                <div className="flex items-center gap-2 mb-1">
                    <Icon name={stratum.icon || 'User'} size={16} className={isSelected ? 'text-amber-400' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                        {stratum.name}
                    </span>
                </div>

                {/* 影响力和人口 */}
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>影响力 {influenceShare}%</span>
                    <span>{population.toLocaleString()}人</span>
                </div>
            </button>
        );
    };

    // 渲染阶层组
    const renderStrataGroup = (groupKey, group) => {
        const groupStrata = group.keys.filter(k => eligibleStrata.includes(k));
        if (groupStrata.length === 0) return null;

        return (
            <div key={groupKey} className="mb-3">
                <h5 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    {group.name}
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {groupStrata.map(key => renderStratumCard(key))}
                </div>
            </div>
        );
    };

    return (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30 mb-4">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Users" size={16} className="text-amber-400" />
                    执政联盟
                </h3>

                {/* 合法性状态徽章 */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${legitimacyInfo.bgColor} border ${legitimacyInfo.borderColor}`}>
                    <Icon name={legitimacyInfo.icon} size={14} className={legitimacyInfo.color} />
                    <span className={`text-xs font-semibold ${legitimacyInfo.color}`}>
                        {legitimacyInfo.name}
                    </span>
                </div>
            </div>

            {/* 合法性说明 */}
            <div className="mb-3 p-2 bg-gray-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">联盟影响力</span>
                    <span className={`text-sm font-bold ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>
                        {(coalitionInfluenceShare * 100).toFixed(1)}%
                    </span>
                </div>

                {/* 进度条 */}
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                        style={{ width: `${Math.min(100, coalitionInfluenceShare * 100)}%` }}
                    />
                    {/* 40%阈值标记 */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                        style={{ left: `${LEGITIMACY_THRESHOLD * 100}%` }}
                    />
                </div>

                <p className="text-[10px] text-gray-500 mt-1">
                    {legitimacyInfo.description}
                </p>

                {/* 合法性效果显示 */}
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    {/* 合法性数值 - 突出显示 */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600/30">
                        <span className="text-sm font-bold text-gray-300">政府合法性</span>
                        <span className={`text-lg font-bold ${legitimacyInfo.color}`}>
                            {realTimeLegitimacy.toFixed(0)}
                        </span>
                    </div>

                    {/* 数据区域 - 联盟满意度相关 */}
                    {rulingCoalition.length > 0 && (
                        <div className="mb-2">
                            <div className="text-[9px] text-gray-500 mb-1">数据</div>
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Heart" size={10} className="text-pink-400" />联盟满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className={`text-xs font-bold ${avgCoalitionApproval >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                    {avgCoalitionApproval.toFixed(0)}
                                </span>
                            </div>
                            {approvalLegitimacyFactor < 1 && (
                                <div className="flex items-center py-0.5">
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                        <Icon name="TrendingDown" size={10} className="text-red-400" />满意度对合法性的影响
                                    </span>
                                    <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                    <span className="text-xs font-bold text-red-400">
                                        ×{approvalLegitimacyFactor.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 效果区域 */}
                    <div>
                        <div className="text-[9px] text-gray-500 mb-1">效果</div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Coins" size={10} className="text-yellow-400" />税收效率
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${taxModifier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(taxModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Users" size={10} className="text-orange-400" />非联盟组织度
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${orgModifier <= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(orgModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        {approvalModifier !== 0 && (
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Frown" size={10} className="text-red-400" />全民满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className="text-xs font-bold text-red-400">
                                    {approvalModifier}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 阶层选择网格 */}
            <div className="space-y-2">
                {Object.entries(STRATA_GROUPS).map(([key, group]) => renderStrataGroup(key, group))}
            </div>

            {/* 警告提示 */}
            {rulingCoalition.length > 0 && (
                <div className="mt-3 p-2 bg-amber-900/20 rounded-lg border border-amber-700/30">
                    <div className="flex items-start gap-2">
                        <Icon name="AlertTriangle" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-[10px] text-amber-300/80">
                            <p className="font-semibold mb-1">联盟代价：</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
                                <li>税收负担阈值：{(COALITION_SENSITIVITY.TAX_THRESHOLD_NORMAL * 100).toFixed(0)}% → <span className="text-red-400">{(COALITION_SENSITIVITY.TAX_THRESHOLD_COALITION * 100).toFixed(0)}%</span></li>
                                <li>收入目标乘数：×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_NORMAL.toFixed(2)} → <span className="text-red-400">×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_COALITION.toFixed(2)}</span></li>
                                <li>基础短缺压力：{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                                <li>奢侈短缺压力：{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
