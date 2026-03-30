// 移动端总览视图组件
// 显示阶层信息、市场信息和事件日志的综合视图
// 使用与PC端相同的组件和风格

import React, { useMemo } from 'react';
import { StrataPanel } from '../panels/StrataPanel';
import { ResourcePanel } from '../panels/ResourcePanel';
import { LogPanel } from '../panels/LogPanel';
import { Icon } from '../common/UIComponents';
import { EPOCHS, TECHS } from '../../config';

/**
 * 移动端总览Tab组件
 * 整合阶层、市场、日志信息，作为移动端初始视图
 * 使用与PC端相同的组件，保持显示一致性
 */
export const OverviewTab = React.memo(({
    // 阶层相关
    popStructure = {},
    classApproval = {},
    classInfluence = {},
    stability = 50,
    population = 0,
    activeBuffs = [],
    activeDebuffs = [],
    classWealth = {},
    classWealthDelta = {},
    classShortages = {},
    classIncome = {},
    classExpense = {},
    classLivingStandard = {},
    rebellionStates = {},
    officials = [],
    onStratumDetailClick,
    // 市场相关
    resources = {},
    rates = {},
    market = {},
    epoch = 0,
    onResourceDetailClick,
    // 事件效果
    activeEventEffects = {},
    // 日志
    logs = [],
    // 时代进度
    techsUnlocked = [],
}) => {
    const epochProgress = useMemo(() => {
        const nextIdx = epoch + 1;
        if (nextIdx >= EPOCHS.length) return null;
        const next = EPOCHS[nextIdx];
        if (!next) return null;
        const reqPop = next.req?.population || 0;
        const reqScience = next.req?.science || 0;
        const currentEpochTechs = TECHS.filter(t => t.epoch === epoch);
        const researchedCount = currentEpochTechs.filter(t => techsUnlocked.includes(t.id)).length;
        const requiredTechCount = Math.floor(currentEpochTechs.length * 0.8);
        return {
            name: next.name,
            popReq: reqPop, popCur: population,
            sciReq: reqScience, sciCur: Math.floor(resources.science || 0),
            techReq: requiredTechCount, techCur: researchedCount, techTotal: currentEpochTechs.length,
        };
    }, [epoch, population, resources.science, techsUnlocked]);

    return (
        <div className="space-y-2">
            {/* 时代升级进度提示 */}
            {epochProgress && (
                <section className="glass-epic rounded-lg border border-amber-500/30 shadow-epic overflow-hidden">
                    <div className="px-2 py-1.5 bg-gradient-to-r from-amber-500/15 to-transparent">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Icon name="Crown" size={12} className="text-amber-400" />
                            <span className="text-xs font-bold text-amber-400 font-decorative">
                                迈向{epochProgress.name}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {epochProgress.popReq > 0 && (
                                <div className={`text-center px-1.5 py-1 rounded text-xs ${population >= epochProgress.popReq ? 'bg-green-900/30 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                    人口 {population}/{epochProgress.popReq}
                                </div>
                            )}
                            {epochProgress.sciReq > 0 && (
                                <div className={`text-center px-1.5 py-1 rounded text-xs ${epochProgress.sciCur >= epochProgress.sciReq ? 'bg-green-900/30 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                    科研 {epochProgress.sciCur}/{epochProgress.sciReq}
                                </div>
                            )}
                            <div className={`text-center px-1.5 py-1 rounded text-xs ${epochProgress.techCur >= epochProgress.techReq ? 'bg-green-900/30 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                科技 {epochProgress.techCur}/{epochProgress.techReq}
                            </div>
                        </div>
                    </div>
                </section>
            )}
            {/* 社会阶层窗口 - 使用 glass-epic 风格，更紧凑 */}
            <section className="glass-epic rounded-lg border border-ancient-gold/20 shadow-epic overflow-hidden">
                <div className="px-2 py-1 border-b border-ancient-gold/20 bg-gradient-to-r from-ancient-gold/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Icon name="Users" size={12} className="text-ancient-gold" />
                        <span className="text-xs font-bold text-ancient-gold font-decorative">社会阶层</span>
                    </div>
                    {/* 稳定度指示器 */}
                    <div className="flex items-center gap-1">
                        <Icon
                            name="TrendingUp"
                            size={10}
                            className={stability >= 70 ? 'text-green-400' : stability >= 40 ? 'text-yellow-400' : 'text-red-400'}
                        />
                        <span className={`text-xs font-bold ${stability >= 70 ? 'text-green-400' : stability >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {stability.toFixed(0)}%
                        </span>
                    </div>
                </div>
                <div className="max-h-[280px] overflow-y-auto p-2">
                    <StrataPanel
                        popStructure={popStructure}
                        classApproval={classApproval}
                        classInfluence={classInfluence}
                        stability={stability}
                        population={population}
                        activeBuffs={activeBuffs}
                        activeDebuffs={activeDebuffs}
                        classWealth={classWealth}
                        classWealthDelta={classWealthDelta}
                        classShortages={classShortages}
                        classIncome={classIncome}
                        classExpense={classExpense}
                        classLivingStandard={classLivingStandard}
                        rebellionStates={rebellionStates}
                        officials={officials}
                        dayScale={1}
                        onDetailClick={onStratumDetailClick}
                        hideTitle={true}
                        forceRowLayout={false}
                        bareMode={true}
                    />
                </div>
            </section>

            {/* 国内市场窗口 - 使用 glass-epic 风格，更紧凑 */}
            <section className="glass-epic rounded-lg border border-ancient-gold/20 shadow-epic overflow-hidden">
                <div className="px-2 py-1 border-b border-ancient-gold/20 bg-gradient-to-r from-emerald-500/10 to-transparent flex items-center gap-1.5">
                    <Icon name="Store" size={12} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 font-decorative">国内市场</span>
                </div>
                <div className="max-h-[240px] overflow-y-auto p-1.5">
                    <ResourcePanel
                        resources={resources}
                        rates={rates}
                        market={market}
                        epoch={epoch}
                        onDetailClick={onResourceDetailClick}
                        title=""
                        showDetailedMobile={true}
                    />
                </div>
            </section>

            {/* 当前事件效果 */}
            {(() => {
                const effectItems = [];
                if (activeEventEffects?.approval?.length > 0) {
                    activeEventEffects.approval.forEach((e, i) => {
                        effectItems.push({ key: `approval-${i}`, label: `${e.stratum || '全体'}满意度`, value: e.currentValue, remaining: e.remainingDays });
                    });
                }
                if (activeEventEffects?.stability?.length > 0) {
                    activeEventEffects.stability.forEach((e, i) => {
                        effectItems.push({ key: `stability-${i}`, label: '稳定度', value: e.currentValue, remaining: e.remainingDays });
                    });
                }
                if (activeEventEffects?.resourceDemandMod) {
                    Object.entries(activeEventEffects.resourceDemandMod).forEach(([res, e]) => {
                        if (e?.currentValue) effectItems.push({ key: `resDemand-${res}`, label: `${res}需求`, value: e.currentValue, remaining: e.remainingDays });
                    });
                }
                if (activeEventEffects?.buildingProductionMod) {
                    Object.entries(activeEventEffects.buildingProductionMod).forEach(([cat, e]) => {
                        if (e?.currentValue) effectItems.push({ key: `bldProd-${cat}`, label: `${cat}产出`, value: e.currentValue, remaining: e.remainingDays });
                    });
                }
                if (activeEventEffects?.forcedSubsidy?.length > 0) {
                    activeEventEffects.forcedSubsidy.forEach((e, i) => {
                        effectItems.push({ key: `subsidy-${i}`, label: '强制补贴', value: e.currentValue || e.amount, remaining: e.remainingDays });
                    });
                }
                if (effectItems.length === 0) return null;
                return (
                    <section className="glass-epic rounded-lg border border-ancient-gold/20 shadow-epic overflow-hidden">
                        <div className="px-2 py-1 border-b border-ancient-gold/20 bg-gradient-to-r from-violet-500/10 to-transparent flex items-center gap-1.5">
                            <Icon name="Clock" size={12} className="text-violet-400" />
                            <span className="text-xs font-bold text-violet-400 font-decorative">当前事件效果</span>
                            <span className="ml-auto text-xs text-gray-500">{effectItems.length} 项</span>
                        </div>
                        <div className="p-2 space-y-1">
                            {effectItems.map(item => (
                                <div key={item.key} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-300">{item.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-mono font-semibold ${item.value > 0 ? 'text-green-300' : item.value < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                                            {item.value > 0 ? '+' : ''}{typeof item.value === 'number' && Math.abs(item.value) < 2 ? `${(item.value * 100).toFixed(0)}%` : item.value?.toFixed?.(1) ?? item.value}
                                        </span>
                                        {item.remaining != null && (
                                            <span className="text-gray-500 text-[10px]">{item.remaining}天</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })()}

            {/* 事件日志窗口 - 使用 glass-epic 风格，更紧凑 */}
            <section className="glass-epic rounded-lg border border-ancient-gold/20 shadow-epic overflow-hidden">
                <div className="px-2 py-1 border-b border-ancient-gold/20 bg-gradient-to-r from-cyan-500/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Icon name="ScrollText" size={12} className="text-cyan-400" />
                        <span className="text-xs font-bold text-cyan-400 font-decorative">事件日志</span>
                    </div>
                    <span className="text-xs text-ancient-stone">{logs.length} 条</span>
                </div>
                <LogPanel logs={logs} hideContainer={true} maxHeight={160} />
            </section>
        </div>
    );
});

