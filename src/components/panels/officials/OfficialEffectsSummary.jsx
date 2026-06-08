import React, { useMemo, useState } from 'react';
import { Icon } from '../../common/UIComponents';
import { aggregateAllOfficialBonuses } from '../../../logic/officials/manager';
import { formatEffect, CATEGORY_META } from '../../../logic/officials/effectFormat';

/**
 * 官员全部加成汇总面板
 * 把所有在任官员的加成（基础效果 + 政治立场效果 + 部长任命加成）
 * 一次性按类别汇总展示，无需逐张点开官员卡片。
 * 可折叠，默认收起。
 */
export const OfficialEffectsSummary = ({
    officials = [],
    officialsPaid = true,
    stanceContext = {},
    ministerAssignments = {},
}) => {
    const [expanded, setExpanded] = useState(false);

    const summary = useMemo(
        () => aggregateAllOfficialBonuses({
            officials,
            officialsPaid,
            stanceContext,
            ministerAssignments,
        }),
        [officials, officialsPaid, stanceContext, ministerAssignments]
    );

    const { groups, officialCount, stanceSatisfied, stanceUnsatisfied, totalItems } = summary;

    return (
        <div className="bg-gray-900/40 rounded-lg p-2.5 border border-gray-700/40">
            {/* 标题行（可点击折叠） */}
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between gap-2 text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <Icon name="Layers" size={12} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        全部加成汇总
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                        · 共{officialCount}名官员
                        {(stanceSatisfied + stanceUnsatisfied) > 0 && (
                            <> · 立场满足{stanceSatisfied}/未满足{stanceUnsatisfied}</>
                        )}
                    </span>
                </div>
                <Icon
                    name={expanded ? 'ChevronUp' : 'ChevronDown'}
                    size={14}
                    className="text-gray-400 flex-shrink-0"
                />
            </button>

            {/* 收起时的预览提示 */}
            {!expanded && (
                <div className="mt-1 text-xs text-gray-500">
                    {totalItems > 0
                        ? `点击展开查看 ${totalItems} 项加成的净总和`
                        : '当前无显著加成'}
                </div>
            )}

            {/* 展开内容 */}
            {expanded && (
                <div className="mt-2 space-y-2.5">
                    {groups.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-2 text-center">
                            当前在任官员未产生显著加成
                        </div>
                    ) : (
                        groups.map(group => {
                            const meta = CATEGORY_META[group.category] || CATEGORY_META.other;
                            return (
                                <div key={group.category}>
                                    {/* 类别小标题 */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <Icon name={meta.icon} size={11} className={meta.color} />
                                        <span className={`text-xs font-semibold ${meta.color}`}>
                                            {meta.name}
                                        </span>
                                    </div>
                                    {/* 该类别下的效果条目 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pl-1">
                                        {group.items.map(item => {
                                            const { description, isGood } = formatEffect(
                                                item.type,
                                                item.target,
                                                item.value
                                            );
                                            return (
                                                <div
                                                    key={`${item.type}-${item.target ?? ''}`}
                                                    className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-300' : 'text-red-300'}`}
                                                >
                                                    <Icon
                                                        name={isGood ? 'Plus' : 'Minus'}
                                                        size={10}
                                                        className={isGood ? 'text-green-500' : 'text-red-500'}
                                                    />
                                                    <span className="truncate" title={description}>{description}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div className="text-xs text-gray-600 pt-1 border-t border-gray-700/30 leading-snug">
                        汇总为所有在任官员效果、政治立场效果与部长任命加成的净总和（未付薪时基础效果减半）。
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfficialEffectsSummary;
