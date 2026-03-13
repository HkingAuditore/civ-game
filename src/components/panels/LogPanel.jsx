// 日志面板组件
// 显示游戏事件日志 - 使用虚拟滚动优化性能

import React, { useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';

const RESOURCE_NAME_MAP = Object.fromEntries(
    Object.entries(RESOURCES || {}).map(([key, config]) => [key, config?.name || key])
);

const BUILDING_NAME_MAP = Object.fromEntries(
    (BUILDINGS || []).map((building) => [building.id, building.name || building.id])
);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const humanizeTechnicalIds = (text) => {
    if (typeof text !== 'string' || !text) return text;

    let normalized = text;

    Object.entries(RESOURCE_NAME_MAP).forEach(([key, name]) => {
        normalized = normalized.replace(new RegExp(`\\b${escapeRegex(key)}\\b`, 'g'), name);
    });

    Object.entries(BUILDING_NAME_MAP).forEach(([key, name]) => {
        normalized = normalized.replace(new RegExp(`\\b${escapeRegex(key)}\\b`, 'g'), name);
    });

    return normalized;
};

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
            const action = tradeData.type === 'buy' ? '购买' : '出售';
            const preposition = tradeData.type === 'buy' ? '从市场' : '向市场';
            const resourceConfig = RESOURCES[tradeData.resource];
            const resourceName = resourceConfig ? resourceConfig.name : (tradeData.resource.charAt(0).toUpperCase() + tradeData.resource.slice(1));
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
            const reasonText = data.reason === 'relation_low' ? '关系恶化' : '长期遭受冷落';
            return `💔 同盟破裂：${data.nationName} 因为${reasonText}，单方面宣布解除与你的同盟关系。`;
        } catch (e) {
            return `💔 你的一个盟友解除了盟约。`;
        }
    }

    // Transform AI_MERCY_PEACE_OFFER logs
    if (log.includes('AI_MERCY_PEACE_OFFER:')) {
        try {
            const jsonStr = log.replace('AI_MERCY_PEACE_OFFER:', '');
            const data = JSON.parse(jsonStr);
            return `🕊️ 和平提议：${data.nationName} 见你国力衰弱，愿意无条件停战。`;
        } catch (e) {
            return `🕊️ 敌国提出了和平提议。`;
        }
    }

    // Transform WAR_DECLARATION_EVENT logs
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

    return humanizeTechnicalIds(log);
};

// 单个日志项组件 - 使用 React.memo 避免不必要的重渲染
const LogItem = React.memo(({ log, index }) => (
    <div className="text-xs text-ancient-parchment glass-ancient border border-ancient-gold/10 rounded-lg px-2 py-1.5 mb-1.5 hover:border-ancient-gold/30 transition-all">
        <span className="text-ancient-gold/60 font-mono text-xs mr-2">#{index + 1}</span>
        {log}
    </div>
));
LogItem.displayName = 'LogItem';

/**
 * 日志面板组件
 * @param {Array} logs - 日志数组
 * @param {boolean} hideContainer - 是否隐藏外层容器和标题
 * @param {number} maxHeight - 当hideContainer为true时的最大高度
 */
export const LogPanel = React.memo(({ logs, hideContainer = false, maxHeight = 300 }) => {
    const MAX_LOGS = 500;
    const parentRef = useRef(null);

    const { displayLogs, totalCount } = useMemo(() => {
        const safeLogs = Array.isArray(logs) ? logs : [];
        const total = safeLogs.length;
        const sliced = total > MAX_LOGS ? safeLogs.slice(total - MAX_LOGS) : safeLogs;
        return {
            displayLogs: sliced.map(transformLog),
            totalCount: total
        };
    }, [logs]);

    // 使用动态高度测量的虚拟化
    const virtualizer = useVirtualizer({
        count: displayLogs.length,
        getScrollElement: () => parentRef.current,
        // 估算每行高度：基础高度 + 根据文字长度估算的额外行数
        estimateSize: useCallback((index) => {
            const log = displayLogs[index] || '';
            // 估算：每40个字符大约一行，每行约20px，加上padding和margin
            const charCount = typeof log === 'string' ? log.length : 30;
            const estimatedLines = Math.max(1, Math.ceil(charCount / 40));
            return 24 + (estimatedLines * 16); // 基础24px + 每行16px
        }, [displayLogs]),
        overscan: 10, // 增加预渲染数量以平滑滚动
    });

    // 空状态
    if (displayLogs.length === 0) {
        const emptyContent = (
            <p className="text-xs text-ancient-stone opacity-70 italic text-center py-4">
                暂无事件
            </p>
        );

        if (hideContainer) return emptyContent;

        return (
            <div className="glass-epic p-3 rounded-2xl border border-ancient-gold/20 shadow-epic relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/60 via-ancient-stone/30 to-ancient-ink/60 opacity-60" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-ancient flex items-center gap-2 mb-2">
                        <Icon name="ScrollText" size={16} className="text-ancient-gold" />
                        事件日志
                    </h3>
                    {emptyContent}
                </div>
            </div>
        );
    }

    // 虚拟化列表内容
    const virtualContent = (
        <div
            ref={parentRef}
            className="overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-ancient-gold/40"
            style={{
                height: hideContainer ? maxHeight : 192,
                overflowY: 'auto',
                padding: hideContainer ? '6px' : '0',
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <LogItem log={displayLogs[virtualRow.index]} index={virtualRow.index} />
                    </div>
                ))}
            </div>
        </div>
    );

    if (hideContainer) {
        return virtualContent;
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
                    <span className="text-xs text-ancient-stone opacity-80">
                        共 {totalCount} 条{totalCount > MAX_LOGS && ` (显示最近 ${MAX_LOGS} 条)`}
                    </span>
                </div>

                {virtualContent}
            </div>
        </div>
    );
});
