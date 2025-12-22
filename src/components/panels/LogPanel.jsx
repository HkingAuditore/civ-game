// 日志面板组件
// 显示游戏事件日志

import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * Transform technical logs to human-readable format
 * @param {string} log - Raw log entry
 * @returns {string} - Human-readable log entry
 */
const transformLog = (log) => {
    if (typeof log !== 'string') return log;

    // Transform RAID_EVENT logs (supports multiple action types)
    if (log.includes('❗RAID_EVENT❗')) {
        try {
            const jsonStr = log.replace('❗RAID_EVENT❗', '');
            const raidData = JSON.parse(jsonStr);
            // 获取行动名称，默认为"突袭"
            const actionName = raidData.actionName || '突袭';
            if (raidData.victory) {
                return `⚔️ 成功击退了 ${raidData.nationName} 的${actionName}！`;
            } else {
                const losses = [];
                if (raidData.foodLoss > 0) losses.push(`粮食 -${raidData.foodLoss}`);
                if (raidData.silverLoss > 0) losses.push(`银币 -${raidData.silverLoss}`);
                if (raidData.woodLoss > 0) losses.push(`木材 -${raidData.woodLoss}`);
                if (raidData.popLoss > 0) losses.push(`人口 -${raidData.popLoss}`);
                const lossText = losses.length > 0 ? `（${losses.join('，')}）` : '';
                return `🔥 遭到 ${raidData.nationName} 的${actionName}！${lossText}`;
            }
        } catch (e) {
            return `⚔️ 发生了一场敌方军事行动！`;
        }
    }

    // Transform AI_TRADE_EVENT logs
    if (log.includes('AI_TRADE_EVENT:')) {
        try {
            const jsonStr = log.replace('AI_TRADE_EVENT:', '');
            const tradeData = JSON.parse(jsonStr);
            // Format: AI_TRADE_EVENT:{"nationId":"...","nationName":"...","resource":"...","amount":...,"price":...,"type":"buy"|"sell","totalValue":...}
            const action = tradeData.type === 'buy' ? '购买' : '出售';
            const preposition = tradeData.type === 'buy' ? '从市场' : '向市场';
            // We need to access RESOURCES config to get resource name if possible, 
            // but transformLog is outside component. We'll use the key as fallback or try to infer.
            // Since we can't easily import RESOURCES here without check, we'll just use the key capitalized.
            const resourceName = tradeData.resource.charAt(0).toUpperCase() + tradeData.resource.slice(1);

            return `⚖️ 贸易报告：${tradeData.nationName} ${preposition}${action}了 ${tradeData.amount} ${resourceName}（总价 ${Math.round(tradeData.totalValue)} 银币）。`;
        } catch (e) {
            return `⚖️ 发生了一笔大宗国际贸易。`;
        }
    }

    // Transform AI_DEMAND_SURRENDER logs
    if (log.includes('AI_DEMAND_SURRENDER:')) {
        try {
            const jsonStr = log.replace('AI_DEMAND_SURRENDER:', '');
            const data = JSON.parse(jsonStr);
            // Format: {"nationId":"...","nationName":"...","warScore":...,"demandType":"...","demandAmount":...}
            let demandText = '';
            switch (data.demandType) {
                case 'tribute': demandText = `支付 ${data.demandAmount} 银币赔款`; break;
                case 'territory': demandText = `割让 ${data.demandAmount} 人口对应的领土`; break;
                case 'open_market': demandText = `开放市场 ${data.demandAmount} 天`; break;
                default: demandText = '无条件投降';
            }
            return `🏳️ 劝降通牒：${data.nationName} 要求你${demandText}以结束战争！`;
        } catch (e) {
            return `🏳️ 敌国发来了劝降通牒。`;
        }
    }

    // Transform AI_BREAK_ALLIANCE logs
    if (log.includes('AI_BREAK_ALLIANCE:')) {
        try {
            const jsonStr = log.replace('AI_BREAK_ALLIANCE:', '');
            const data = JSON.parse(jsonStr);
            // Format: {"nationId":"...","nationName":"...","reason":"..."}
            const reasonText = data.reason === 'relation_low' ? '关系恶化' : '长期遭受冷落';
            return `💔 同盟破裂：${data.nationName} 因为${reasonText}，单方面宣布解除与你的同盟关系。`;
        } catch (e) {
            return `💔 你的一个盟友解除了盟约。`;
        }
    }

    // Transform WAR_DECLARATION_EVENT logs (Existing logic, kept for context but checking if update needed)
    // The original code had this, we just keep it or ensure we didn't overwrite it if it was in the range.
    // The previous tool call view showed it was there.
    if (log.includes('WAR_DECLARATION_EVENT:')) {
        try {
            const jsonStr = log.replace('WAR_DECLARATION_EVENT:', '');
            const warData = JSON.parse(jsonStr);
            const reason = warData.reason === 'wealth' ? '觊觎你的财富' : '扩张领土';
            return `⚔️ 宣战布告：${warData.nationName} ${reason ? `出于${reason}` : ''}对你宣战！`;
        } catch (e) {
            return `⚔️ 有国家对你宣战！`;
        }
    }

    return log;
};

/**
 * 日志面板组件
 * 显示游戏事件日志
 * @param {Array} logs - 日志数组
 * @param {boolean} hideContainer - 是否隐藏外层容器和标题
 */
export const LogPanel = ({ logs, hideContainer = false }) => {
    // Transform technical logs to human-readable format
    const displayLogs = logs.map(transformLog);

    // 内容部分 - 如果hideContainer为true，不添加滚动限制（由外部容器控制）
    const content = (
        <div className={hideContainer ? "space-y-1.5" : "space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-ancient-gold/40"}>
            {displayLogs.length === 0 ? (
                <p className="text-xs text-ancient-stone opacity-70 italic text-center py-4">
                    暂无事件
                </p>
            ) : (
                displayLogs.map((log, idx) => (
                    <div
                        key={idx}
                        className="text-xs text-ancient-parchment glass-ancient border border-ancient-gold/10 rounded-lg px-2 py-1.5 hover:border-ancient-gold/30 transition-all animate-fade-in"
                    >
                        <span className="text-ancient-gold/60 font-mono text-[10px] mr-2">#{idx + 1}</span>
                        {log}
                    </div>
                ))
            )}
        </div>
    );

    // 如果隐藏容器，直接返回内容
    if (hideContainer) {
        return content;
    }

    return (
        <div className="glass-epic p-3 rounded-2xl border border-ancient-gold/20 shadow-epic relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/60 via-ancient-stone/30 to-ancient-ink/60 opacity-60" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <pattern id="log-panel-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                        <path d="M0 20 H80 M0 60 H80" stroke="currentColor" strokeWidth="0.5" className="text-ancient-gold/10" />
                        <path d="M20 0 V80 M60 0 V80" stroke="currentColor" strokeWidth="0.5" className="text-ancient-gold/10" />
                        <circle cx="40" cy="40" r="2" fill="currentColor" className="text-ancient-gold/30" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#log-panel-pattern)" />
                </svg>
            </div>

            <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ancient flex items-center gap-2">
                        <Icon name="ScrollText" size={16} className="text-ancient-gold" />
                        事件日志
                    </h3>
                    <span className="text-[11px] text-ancient-stone opacity-80">
                        共 {displayLogs.length} 条
                    </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-ancient-gold/40">
                    {displayLogs.length === 0 ? (
                        <p className="text-xs text-ancient-stone opacity-70 italic text-center py-4">
                            暂无事件
                        </p>
                    ) : (
                        displayLogs.map((log, idx) => (
                            <div
                                key={idx}
                                className="text-xs text-ancient-parchment glass-ancient border border-ancient-gold/10 rounded-lg px-2 py-1.5 hover:border-ancient-gold/30 transition-all animate-fade-in"
                            >
                                <span className="text-ancient-gold/60 font-mono text-[10px] mr-2">#{idx + 1}</span>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
