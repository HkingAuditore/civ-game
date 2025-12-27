// 移动端总览视图组件
// 显示阶层信息、市场信息和事件日志的综合视图
// 使用与PC端相同的组件和风格

import React from 'react';
import { StrataPanel } from '../panels/StrataPanel';
import { ResourcePanel } from '../panels/ResourcePanel';
import { LogPanel } from '../panels/LogPanel';
import { Icon } from '../common/UIComponents';

/**
 * 移动端总览Tab组件
 * 整合阶层、市场、日志信息，作为移动端初始视图
 * 使用与PC端相同的组件，保持显示一致性
 */
export const OverviewTab = ({
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
    onStratumDetailClick,
    // 市场相关
    resources = {},
    rates = {},
    market = {},
    epoch = 0,
    onResourceDetailClick,
    // 日志
    logs = [],
}) => {
    return (
        <div className="space-y-2">
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
                        <span className={`text-[9px] font-bold ${stability >= 70 ? 'text-green-400' : stability >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
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

            {/* 事件日志窗口 - 使用 glass-epic 风格，更紧凑 */}
            <section className="glass-epic rounded-lg border border-ancient-gold/20 shadow-epic overflow-hidden">
                <div className="px-2 py-1 border-b border-ancient-gold/20 bg-gradient-to-r from-cyan-500/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Icon name="ScrollText" size={12} className="text-cyan-400" />
                        <span className="text-xs font-bold text-cyan-400 font-decorative">事件日志</span>
                    </div>
                    <span className="text-[9px] text-ancient-stone">{logs.length} 条</span>
                </div>
                <div className="max-h-[160px] overflow-y-auto p-1.5">
                    <LogPanel logs={logs} hideContainer={true} />
                </div>
            </section>
        </div>
    );
};

