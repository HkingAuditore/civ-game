// 事件管理面板组件
// 显示延迟处理的事件列表，允许玩家主动处理待处理事件

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { EventDetail } from '../modals/EventDetail';
import { BottomSheet } from '../tabs/BottomSheet';

/**
 * 事件管理面板 - 显示延迟处理的事件
 * @param {Array} deferredEvents - 延迟事件列表 [{ event, deferredAtTick, expiresAtTick }]
 * @param {number} currentTick - 当前游戏tick（daysElapsed）
 * @param {Function} onHandleEvent - 处理事件回调 (eventId, option) => void
 * @param {Function} onClose - 关闭面板回调
 * @param {Array} nations - 国家列表
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁科技
 */
export const EventManagerPanel = ({
    deferredEvents = [],
    currentTick = 0,
    onHandleEvent,
    onClose,
    nations = [],
    epoch = 0,
    techsUnlocked = [],
}) => {
    // 当前展开查看的事件
    const [expandedEventId, setExpandedEventId] = useState(null);

    // 获取展开的事件详情
    const expandedEvent = expandedEventId
        ? deferredEvents.find(item => item.event?.id === expandedEventId)?.event
        : null;

    // 计算剩余时间
    const getRemainingTicks = (expiresAtTick) => {
        return Math.max(0, expiresAtTick - currentTick);
    };

    // 获取紧急程度样式
    const getUrgencyStyle = (remainingTicks) => {
        if (remainingTicks <= 3) {
            return {
                bg: 'bg-red-900/40',
                border: 'border-red-500/50',
                text: 'text-red-300',
                badge: 'bg-red-600 text-white',
                icon: 'AlertTriangle',
            };
        } else if (remainingTicks <= 7) {
            return {
                bg: 'bg-yellow-900/30',
                border: 'border-yellow-500/40',
                text: 'text-yellow-300',
                badge: 'bg-yellow-600 text-white',
                icon: 'Clock',
            };
        } else {
            return {
                bg: 'bg-gray-800/40',
                border: 'border-gray-600/40',
                text: 'text-gray-300',
                badge: 'bg-gray-600 text-white',
                icon: 'Clock',
            };
        }
    };

    // 处理事件选项选择
    const handleSelectOption = (eventId, option) => {
        if (onHandleEvent) {
            onHandleEvent(eventId, option);
        }
        setExpandedEventId(null);
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-ancient-gold/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/80 to-purple-700/80 flex items-center justify-center border border-blue-400/50">
                        <Icon name="Bell" size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white font-decorative">事件管理</h2>
                        <p className="text-xs text-gray-400">
                            {deferredEvents.length > 0
                                ? `${deferredEvents.length} 个待处理事件`
                                : '暂无待处理事件'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                    <Icon name="X" size={20} className="text-gray-400" />
                </button>
            </div>

            {/* 事件列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {deferredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Icon name="CheckCircle" size={48} className="mb-4 text-green-500/50" />
                        <p className="text-sm">所有事件已处理完毕</p>
                        <p className="text-xs mt-1">新事件触发后可在此管理</p>
                    </div>
                ) : (
                    deferredEvents.map((item) => {
                        const { event, expiresAtTick } = item;
                        if (!event) return null;

                        const remainingTicks = getRemainingTicks(expiresAtTick);
                        const urgency = getUrgencyStyle(remainingTicks);
                        const isExpanded = expandedEventId === event.id;

                        return (
                            <div
                                key={event.id}
                                className={`rounded-xl border transition-all ${urgency.bg} ${urgency.border}`}
                            >
                                {/* 事件卡片头部 */}
                                <button
                                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                    className="w-full p-3 flex items-center gap-3 text-left"
                                >
                                    {/* 事件图标 */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        event.isDiplomaticEvent
                                            ? 'bg-gradient-to-br from-blue-600/80 to-purple-700/80 border border-blue-400/40'
                                            : 'bg-gradient-to-br from-ancient-gold/60 to-ancient-bronze/60 border border-ancient-gold/40'
                                    }`}>
                                        <Icon name={event.icon || 'Bell'} size={20} className="text-white" />
                                    </div>

                                    {/* 事件信息 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white truncate font-decorative">
                                            {event.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {event.isDiplomaticEvent && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-blue-600/40 text-blue-200 rounded border border-blue-400/30">
                                                    <Icon name="Globe" size={8} />
                                                    外交
                                                </span>
                                            )}
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded ${urgency.badge}`}>
                                                <Icon name={urgency.icon} size={8} />
                                                剩余 {remainingTicks} 天
                                            </span>
                                        </div>
                                    </div>

                                    {/* 展开/收起图标 */}
                                    <Icon
                                        name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                                        size={18}
                                        className="text-gray-400 flex-shrink-0"
                                    />
                                </button>

                                {/* 展开的事件详情 */}
                                {isExpanded && (
                                    <div className="border-t border-gray-700/50 p-3">
                                        <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                                            {event.description}
                                        </p>

                                        {/* 选项列表 */}
                                        <div className="space-y-2">
                                            {(event.options || []).map((option, index) => (
                                                <button
                                                    key={option.id || index}
                                                    onClick={() => handleSelectOption(event.id, option)}
                                                    className="w-full p-3 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-600/40 hover:border-ancient-gold/40 transition-all text-left group"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-white group-hover:text-ancient-gold transition-colors">
                                                                {option.text}
                                                            </p>
                                                            {option.description && (
                                                                <p className="text-xs text-gray-400 mt-1">
                                                                    {option.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Icon
                                                            name="ChevronRight"
                                                            size={16}
                                                            className="text-gray-500 group-hover:text-ancient-gold flex-shrink-0 mt-0.5 transition-colors"
                                                        />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 底部提示 */}
            {deferredEvents.length > 0 && (
                <div className="p-4 border-t border-gray-700/50">
                    <div className="glass-ancient rounded-xl p-3 border border-yellow-500/20">
                        <div className="flex items-start gap-2">
                            <Icon name="AlertCircle" size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-yellow-300 text-xs leading-relaxed">
                                请及时处理待处理事件。超时未处理的事件将强制弹出，届时必须做出选择。
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventManagerPanel;
