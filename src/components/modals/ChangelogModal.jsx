// 游戏更新日志模态框
import React, { useState } from 'react';
import { CHANGELOG } from '../../config/changelog';
import { Icon } from '../common/UIComponents';

// 变更类型配置
const CHANGE_TYPE_CONFIG = {
    new: { label: '新增', color: 'text-emerald-300', bg: 'bg-emerald-900/30 border-emerald-500/30' },
    fix: { label: '修复', color: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-500/30' },
    balance: { label: '平衡', color: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-500/30' },
    remove: { label: '移除', color: 'text-red-300', bg: 'bg-red-900/30 border-red-500/30' },
    improve: { label: '优化', color: 'text-purple-300', bg: 'bg-purple-900/30 border-purple-500/30' },
};

/**
 * 单个版本条目组件
 */
const VersionEntry = ({ entry, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`rounded-lg border overflow-hidden ${entry.isLatest ? 'border-ancient-gold/40' : 'border-gray-700/50'}`}>
            {/* 版本头部 */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    entry.isLatest
                        ? 'bg-ancient-gold/10 hover:bg-ancient-gold/15'
                        : 'bg-gray-800/50 hover:bg-gray-800/70'
                }`}
            >
                <div className="flex items-center gap-2">
                    {entry.isLatest && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-ancient-gold/20 text-ancient-gold border border-ancient-gold/30">
                            最新
                        </span>
                    )}
                    <span className={`text-sm font-bold ${entry.isLatest ? 'text-ancient-gold' : 'text-gray-200'}`}>
                        v{entry.version}
                    </span>
                    <span className="text-xs text-gray-500">{entry.date}</span>
                </div>
                <Icon
                    name="ChevronDown"
                    size={14}
                    className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* 版本内容 */}
            {isOpen && (
                <div className="px-3 py-2 space-y-2 bg-gray-900/40">
                    {/* 亮点摘要 */}
                    {entry.highlights?.length > 0 && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {entry.highlights.join(' · ')}
                        </p>
                    )}
                    {/* 详细变更列表 */}
                    <div className="space-y-1.5">
                        {entry.changes.map((change, idx) => {
                            const typeConfig = CHANGE_TYPE_CONFIG[change.type] || CHANGE_TYPE_CONFIG.new;
                            return (
                                <div key={idx} className="flex items-start gap-2">
                                    <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold border ${typeConfig.bg} ${typeConfig.color}`}>
                                        {typeConfig.label}
                                    </span>
                                    <span className="text-xs text-gray-300 leading-relaxed">{change.text}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * 更新日志模态框
 */
export const ChangelogModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 模态框内容 */}
            <div className="relative w-full max-w-md bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl animate-slide-up flex flex-col max-h-[80vh]">
                {/* 头部 */}
                <div className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                        <Icon name="ScrollText" size={18} className="text-ancient-gold" />
                        更新日志
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                    >
                        <Icon name="X" size={14} />
                    </button>
                </div>

                {/* 版本列表 */}
                <div className="overflow-y-auto p-3 space-y-2 flex-1">
                    {CHANGELOG.map((entry, idx) => (
                        <VersionEntry
                            key={entry.version}
                            entry={entry}
                            defaultOpen={idx === 0}
                        />
                    ))}
                </div>

                {/* 底部 */}
                <div className="p-3 border-t border-gray-700 flex-shrink-0">
                    <p className="text-xs text-gray-500 text-center">
                        QQ群546526159，游戏持续更新中 🎮
                    </p>
                </div>
            </div>
        </div>
    );
};
