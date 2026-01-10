/**
 * 外交统计面板
 * 展示历史条约、贸易统计、外交关系概览
 */
import React, { useMemo, useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { TREATY_TYPE_LABELS, VASSAL_TYPE_LABELS } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    getRelationDescription,
    getVassalTypeDescription,
    formatTreatyDuration,
} from '../../utils/effectFormatter';

/**
 * 外交关系分布统计
 */
const RelationDistribution = memo(({ nations }) => {
    const distribution = useMemo(() => {
        const result = {
            allied: 0,      // 盟友
            friendly: 0,    // 友好 (relation >= 60)
            neutral: 0,     // 中立 (40-59)
            cold: 0,        // 冷淡 (20-39)
            hostile: 0,     // 敌对 (<20)
            atWar: 0,       // 交战中
            vassal: 0,      // 附庸
        };
        
        nations.forEach(nation => {
            if (nation.vassalOf === 'player') {
                result.vassal++;
            } else if (nation.atWarWithPlayer) {
                result.atWar++;
            } else if (nation.alliedWithPlayer) {
                result.allied++;
            } else {
                const relation = nation.relation || 50;
                if (relation >= 60) result.friendly++;
                else if (relation >= 40) result.neutral++;
                else if (relation >= 20) result.cold++;
                else result.hostile++;
            }
        });
        
        return result;
    }, [nations]);
    
    const total = nations.length;
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="PieChart" size={14} className="text-blue-400" />
                外交关系分布
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between bg-green-900/30 rounded px-2 py-1">
                    <span className="text-green-300 font-body">盟友</span>
                    <span className="text-white font-mono font-epic">{distribution.allied}</span>
                </div>
                <div className="flex items-center justify-between bg-blue-900/30 rounded px-2 py-1">
                    <span className="text-blue-300 font-body">友好</span>
                    <span className="text-white font-mono font-epic">{distribution.friendly}</span>
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                    <span className="text-gray-300 font-body">中立</span>
                    <span className="text-white font-mono font-epic">{distribution.neutral}</span>
                </div>
                <div className="flex items-center justify-between bg-yellow-900/30 rounded px-2 py-1">
                    <span className="text-yellow-300 font-body">冷淡</span>
                    <span className="text-white font-mono font-epic">{distribution.cold}</span>
                </div>
                <div className="flex items-center justify-between bg-red-900/30 rounded px-2 py-1">
                    <span className="text-red-300 font-body">敌对</span>
                    <span className="text-white font-mono font-epic">{distribution.hostile}</span>
                </div>
                <div className="flex items-center justify-between bg-orange-900/30 rounded px-2 py-1">
                    <span className="text-orange-300 font-body">交战</span>
                    <span className="text-white font-mono font-epic">{distribution.atWar}</span>
                </div>
                <div className="flex items-center justify-between bg-purple-900/30 rounded px-2 py-1 col-span-2">
                    <span className="text-purple-300 font-body">附庸国</span>
                    <span className="text-white font-mono font-epic">{distribution.vassal}</span>
                </div>
            </div>
            
            {/* 进度条可视化 */}
            <div className="mt-3 h-3 flex rounded-full overflow-hidden bg-gray-800">
                {distribution.allied > 0 && (
                    <div 
                        className="bg-green-500 transition-all" 
                        style={{ width: `${(distribution.allied / total) * 100}%` }}
                        title={`盟友: ${distribution.allied}`}
                    />
                )}
                {distribution.friendly > 0 && (
                    <div 
                        className="bg-blue-500 transition-all" 
                        style={{ width: `${(distribution.friendly / total) * 100}%` }}
                        title={`友好: ${distribution.friendly}`}
                    />
                )}
                {distribution.neutral > 0 && (
                    <div 
                        className="bg-gray-500 transition-all" 
                        style={{ width: `${(distribution.neutral / total) * 100}%` }}
                        title={`中立: ${distribution.neutral}`}
                    />
                )}
                {distribution.cold > 0 && (
                    <div 
                        className="bg-yellow-500 transition-all" 
                        style={{ width: `${(distribution.cold / total) * 100}%` }}
                        title={`冷淡: ${distribution.cold}`}
                    />
                )}
                {distribution.hostile > 0 && (
                    <div 
                        className="bg-red-500 transition-all" 
                        style={{ width: `${(distribution.hostile / total) * 100}%` }}
                        title={`敌对: ${distribution.hostile}`}
                    />
                )}
                {distribution.atWar > 0 && (
                    <div 
                        className="bg-orange-600 transition-all" 
                        style={{ width: `${(distribution.atWar / total) * 100}%` }}
                        title={`交战: ${distribution.atWar}`}
                    />
                )}
                {distribution.vassal > 0 && (
                    <div 
                        className="bg-purple-500 transition-all" 
                        style={{ width: `${(distribution.vassal / total) * 100}%` }}
                        title={`附庸: ${distribution.vassal}`}
                    />
                )}
            </div>
        </div>
    );
});

/**
 * 活跃条约统计
 */
const ActiveTreatiesStats = memo(({ nations, daysElapsed }) => {
    const treatyStats = useMemo(() => {
        const stats = {
            total: 0,
            byType: {},
            expiringSoon: [], // 30天内到期的条约
        };
        
        nations.forEach(nation => {
            const treaties = nation.treatiesWithPlayer || [];
            treaties.forEach(treaty => {
                stats.total++;
                
                // 按类型统计
                const type = treaty.type || 'unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
                
                // 检查即将到期
                if (treaty.endDay) {
                    const remainingDays = treaty.endDay - daysElapsed;
                    if (remainingDays > 0 && remainingDays <= 30) {
                        stats.expiringSoon.push({
                            nation: nation.name,
                            nationId: nation.id,
                            type: treaty.type,
                            remainingDays,
                        });
                    }
                }
            });
        });
        
        // 排序即将到期的条约
        stats.expiringSoon.sort((a, b) => a.remainingDays - b.remainingDays);
        
        return stats;
    }, [nations, daysElapsed]);
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="FileText" size={14} className="text-amber-400" />
                活跃条约 ({treatyStats.total})
            </h4>
            
            {/* 按类型统计 */}
            {Object.keys(treatyStats.byType).length > 0 ? (
                <div className="space-y-1 mb-3">
                    {Object.entries(treatyStats.byType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-2 py-1">
                            <span className="text-gray-300 font-body">{TREATY_TYPE_LABELS[type] || type}</span>
                            <span className="text-white font-mono font-epic">{count}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-xs text-gray-500 text-center py-2 font-body">暂无活跃条约</div>
            )}
            
            {/* 即将到期的条约 */}
            {treatyStats.expiringSoon.length > 0 && (
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <div className="text-xs text-yellow-400 font-bold mb-1 flex items-center gap-1 font-decorative">
                        <Icon name="AlertTriangle" size={12} />
                        即将到期
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                        {treatyStats.expiringSoon.slice(0, 5).map((treaty, idx) => (
                            <div key={idx} className="text-xs bg-yellow-900/20 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-yellow-300 font-body truncate">
                                    {treaty.nation}: {TREATY_TYPE_LABELS[treaty.type] || treaty.type}
                                </span>
                                <span className="text-yellow-400 font-mono font-epic whitespace-nowrap ml-1">
                                    {treaty.remainingDays}天
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * 贸易统计面板
 */
const TradeStats = memo(({ tradeRoutes, nations }) => {
    const stats = useMemo(() => {
        const routes = tradeRoutes?.routes || [];
        const result = {
            totalRoutes: routes.length,
            exportRoutes: routes.filter(r => r.direction === 'export').length,
            importRoutes: routes.filter(r => r.direction === 'import').length,
            tradingPartners: new Set(routes.map(r => r.nationId)).size,
            totalVolume: routes.reduce((sum, r) => sum + (r.amount || 0), 0),
            routesByNation: {},
        };
        
        // 按国家统计路线数
        routes.forEach(route => {
            const nationId = route.nationId;
            if (!result.routesByNation[nationId]) {
                const nation = nations.find(n => n.id === nationId);
                result.routesByNation[nationId] = {
                    name: nation?.name || nationId,
                    count: 0,
                };
            }
            result.routesByNation[nationId].count++;
        });
        
        return result;
    }, [tradeRoutes, nations]);
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="TrendingUp" size={14} className="text-green-400" />
                贸易统计
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="text-gray-400 font-body">活跃路线</div>
                    <div className="text-white font-bold font-mono text-sm">{stats.totalRoutes}</div>
                </div>
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="text-gray-400 font-body">贸易伙伴</div>
                    <div className="text-white font-bold font-mono text-sm">{stats.tradingPartners}</div>
                </div>
                <div className="bg-green-900/30 rounded px-2 py-1.5">
                    <div className="text-green-400 font-body">出口路线</div>
                    <div className="text-green-300 font-bold font-mono text-sm">{stats.exportRoutes}</div>
                </div>
                <div className="bg-blue-900/30 rounded px-2 py-1.5">
                    <div className="text-blue-400 font-body">进口路线</div>
                    <div className="text-blue-300 font-bold font-mono text-sm">{stats.importRoutes}</div>
                </div>
            </div>
            
            {/* 主要贸易伙伴 */}
            {Object.keys(stats.routesByNation).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <div className="text-xs text-gray-400 mb-1 font-body">主要贸易伙伴</div>
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(stats.routesByNation)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 4)
                            .map(([nationId, data]) => (
                                <span 
                                    key={nationId}
                                    className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-body"
                                >
                                    {data.name} ({data.count})
                                </span>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * 附庸系统统计
 */
const VassalStats = memo(({ nations }) => {
    const vassalStats = useMemo(() => {
        const vassals = nations.filter(n => n.vassalOf === 'player');
        const result = {
            total: vassals.length,
            byType: {},
            totalTribute: 0,
            highIndependence: [], // 独立倾向 > 50 的附庸
        };
        
        vassals.forEach(vassal => {
            const type = vassal.vassalType || 'protectorate';
            result.byType[type] = (result.byType[type] || 0) + 1;
            
            // 估算朝贡（简化计算）
            const tribute = vassal.estimatedTribute || 0;
            result.totalTribute += tribute;
            
            // 检查独立倾向
            const independence = vassal.independenceDesire || 0;
            if (independence > 50) {
                result.highIndependence.push({
                    name: vassal.name,
                    id: vassal.id,
                    independence,
                    type: vassal.vassalType,
                });
            }
        });
        
        result.highIndependence.sort((a, b) => b.independence - a.independence);
        
        return result;
    }, [nations]);
    
    if (vassalStats.total === 0) {
        return null;
    }
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="Crown" size={14} className="text-purple-400" />
                附庸统计 ({vassalStats.total})
            </h4>
            
            {/* 按类型统计 */}
            <div className="space-y-1 mb-2">
                {Object.entries(vassalStats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs bg-purple-900/20 rounded px-2 py-1">
                        <span className="text-purple-300 font-body">{VASSAL_TYPE_LABELS[type] || type}</span>
                        <span className="text-white font-mono font-epic">{count}</span>
                    </div>
                ))}
            </div>
            
            {/* 高独立倾向警告 */}
            {vassalStats.highIndependence.length > 0 && (
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <div className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1 font-decorative">
                        <Icon name="AlertTriangle" size={12} />
                        独立倾向过高
                    </div>
                    <div className="space-y-1">
                        {vassalStats.highIndependence.slice(0, 3).map(vassal => (
                            <div key={vassal.id} className="text-xs bg-red-900/20 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-red-300 font-body truncate">{vassal.name}</span>
                                <span className="text-red-400 font-mono font-epic">{vassal.independence.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * 海外投资统计
 */
const InvestmentStats = memo(({ overseasInvestments }) => {
    const stats = useMemo(() => {
        const investments = overseasInvestments || [];
        const result = {
            total: investments.length,
            totalValue: 0,
            totalProfit: 0,
            byNation: {},
        };
        
        investments.forEach(inv => {
            result.totalValue += inv.initialCost || 0;
            result.totalProfit += inv.lastProfit || 0;
            
            const nationId = inv.nationId;
            if (!result.byNation[nationId]) {
                result.byNation[nationId] = {
                    name: inv.nationName || nationId,
                    count: 0,
                    profit: 0,
                };
            }
            result.byNation[nationId].count++;
            result.byNation[nationId].profit += inv.lastProfit || 0;
        });
        
        return result;
    }, [overseasInvestments]);
    
    if (stats.total === 0) {
        return null;
    }
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="Globe" size={14} className="text-cyan-400" />
                海外投资 ({stats.total})
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="text-gray-400 font-body">投资总额</div>
                    <div className="text-white font-bold font-mono">{formatNumberShortCN(stats.totalValue)}</div>
                </div>
                <div className="bg-cyan-900/30 rounded px-2 py-1.5">
                    <div className="text-cyan-400 font-body">月利润</div>
                    <div className={`font-bold font-mono ${stats.totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {stats.totalProfit >= 0 ? '+' : ''}{formatNumberShortCN(stats.totalProfit)}
                    </div>
                </div>
            </div>
            
            {/* 按国家统计 */}
            {Object.keys(stats.byNation).length > 0 && (
                <div className="space-y-1">
                    {Object.entries(stats.byNation)
                        .sort((a, b) => b[1].profit - a[1].profit)
                        .slice(0, 3)
                        .map(([nationId, data]) => (
                            <div key={nationId} className="text-xs bg-gray-800/50 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-gray-300 font-body truncate">{data.name}</span>
                                <span className="text-cyan-300 font-mono font-epic">{data.count}项</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
});

/**
 * 历史条约记录（含违约记录）
 */
const TreatyHistory = memo(({ nations, daysElapsed }) => {
    const historyStats = useMemo(() => {
        const result = {
            expiredTreaties: [],      // 正常到期的条约
            breachedTreaties: [],     // 被违约的条约
            totalExpired: 0,
            totalBreached: 0,
        };
        
        nations.forEach(nation => {
            // 收集历史条约记录
            const history = nation.treatyHistory || [];
            history.forEach(treaty => {
                const record = {
                    nation: nation.name,
                    nationId: nation.id,
                    type: treaty.type,
                    startDay: treaty.startDay,
                    endDay: treaty.endDay,
                    breachedBy: treaty.breachedBy,
                    breachDay: treaty.breachDay,
                };
                
                if (treaty.breachedBy) {
                    result.breachedTreaties.push(record);
                    result.totalBreached++;
                } else if (treaty.endDay && treaty.endDay <= daysElapsed) {
                    result.expiredTreaties.push(record);
                    result.totalExpired++;
                }
            });
        });
        
        // 按时间排序（最近的在前）
        result.expiredTreaties.sort((a, b) => (b.endDay || 0) - (a.endDay || 0));
        result.breachedTreaties.sort((a, b) => (b.breachDay || 0) - (a.breachDay || 0));
        
        return result;
    }, [nations, daysElapsed]);
    
    const totalHistory = historyStats.totalExpired + historyStats.totalBreached;
    
    if (totalHistory === 0) {
        return null;
    }
    
    return (
        <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                <Icon name="Archive" size={14} className="text-gray-400" />
                条约历史 ({totalHistory})
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="text-gray-400 font-body">正常到期</div>
                    <div className="text-white font-bold font-mono text-sm">{historyStats.totalExpired}</div>
                </div>
                <div className="bg-red-900/30 rounded px-2 py-1.5">
                    <div className="text-red-400 font-body">被违约</div>
                    <div className="text-red-300 font-bold font-mono text-sm">{historyStats.totalBreached}</div>
                </div>
            </div>
            
            {/* 违约记录警告 */}
            {historyStats.breachedTreaties.length > 0 && (
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <div className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1 font-decorative">
                        <Icon name="AlertOctagon" size={12} />
                        违约记录
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                        {historyStats.breachedTreaties.slice(0, 3).map((treaty, idx) => (
                            <div key={idx} className="text-xs bg-red-900/20 rounded px-2 py-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-red-300 font-body truncate">
                                        {treaty.nation}: {TREATY_TYPE_LABELS[treaty.type] || treaty.type}
                                    </span>
                                    <span className="text-red-400 font-mono text-[10px]">
                                        {treaty.breachedBy === 'player' ? '我方违约' : '对方违约'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* 近期到期 */}
            {historyStats.expiredTreaties.length > 0 && (
                <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <div className="text-xs text-gray-400 mb-1 font-body">近期到期</div>
                    <div className="space-y-1 max-h-16 overflow-y-auto">
                        {historyStats.expiredTreaties.slice(0, 2).map((treaty, idx) => (
                            <div key={idx} className="text-xs bg-gray-800/50 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-gray-300 font-body truncate">
                                    {treaty.nation}: {TREATY_TYPE_LABELS[treaty.type] || treaty.type}
                                </span>
                                <span className="text-gray-500 font-mono text-[10px]">
                                    第{treaty.endDay}天
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * 外交统计面板主组件
 */
const DiplomacyStatsPanelComponent = ({
    nations = [],
    daysElapsed = 0,
    tradeRoutes = { routes: [] },
    overseasInvestments = [],
    isExpanded = false,
    onToggle,
}) => {
    const [expanded, setExpanded] = useState(isExpanded);
    
    const handleToggle = () => {
        const newState = !expanded;
        setExpanded(newState);
        onToggle?.(newState);
    };
    
    return (
        <div className="bg-gray-800/40 rounded-lg border border-gray-700/50 overflow-hidden">
            {/* 折叠标题栏 */}
            <button
                onClick={handleToggle}
                className="w-full px-3 py-2 flex items-center justify-between bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Icon name="BarChart2" size={16} className="text-blue-400" />
                    <span className="text-sm font-bold text-white font-decorative">外交统计概览</span>
                </div>
                <Icon 
                    name={expanded ? "ChevronUp" : "ChevronDown"} 
                    size={16} 
                    className="text-gray-400" 
                />
            </button>
            
            {/* 展开内容 */}
            {expanded && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <RelationDistribution nations={nations} />
                    <ActiveTreatiesStats nations={nations} daysElapsed={daysElapsed} />
                    <TradeStats tradeRoutes={tradeRoutes} nations={nations} />
                    <TreatyHistory nations={nations} daysElapsed={daysElapsed} />
                    <VassalStats nations={nations} />
                    <InvestmentStats overseasInvestments={overseasInvestments} />
                </div>
            )}
        </div>
    );
};

export const DiplomacyStatsPanel = memo(DiplomacyStatsPanelComponent);
export default DiplomacyStatsPanel;
