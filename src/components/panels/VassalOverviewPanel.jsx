/**
 * 附庸概览面板
 * 显示玩家所有附庸国的汇总信息和管理入口
 */

import React, { useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    VASSAL_TYPE_CONFIGS,
    TRADE_POLICY_DEFINITIONS,
    LABOR_POLICY_DEFINITIONS,
    GOVERNANCE_POLICY_DEFINITIONS,
    MILITARY_POLICY_DEFINITIONS,
} from '../../config/diplomacy';
import { calculateEnhancedTribute } from '../../logic/diplomacy/vassalSystem';

// 外交控制政策定义（枚举来自 adjustVassalPolicy 逻辑）
const DIPLOMATIC_CONTROL_DEFINITIONS = {
    autonomous: { id: 'autonomous', name: '自治', description: '附庸可自主开展外交' },
    guided:     { id: 'guided',     name: '引导', description: '宗主指导外交方向' },
    puppet:     { id: 'puppet',     name: '傀儡', description: '完全服从宗主外交意志' },
};
// 投资政策定义
const INVESTMENT_POLICY_DEFINITIONS = {
    autonomous: { id: 'autonomous', name: '自主投资', description: '附庸自主决定投资方向' },
    guided:     { id: 'guided',     name: '引导投资', description: '宗主提供投资建议' },
    forced:     { id: 'forced',     name: '强制投资', description: '宗主指令投资项目' },
};

// 批量政策各维度定义
const VASSAL_POLICY_DIMS = [
    { key: 'diplomaticControl', label: '外交控制', icon: 'Globe',    color: 'text-blue-400',   defs: DIPLOMATIC_CONTROL_DEFINITIONS, order: ['autonomous', 'guided', 'puppet'] },
    { key: 'tradePolicy',       label: '贸易政策', icon: 'TrendingUp',color: 'text-green-400',  defs: TRADE_POLICY_DEFINITIONS,       order: ['free', 'preferential', 'monopoly', 'exclusive', 'dumping', 'looting'] },
    { key: 'labor',             label: '劳工政策', icon: 'Hammer',   color: 'text-orange-400', defs: LABOR_POLICY_DEFINITIONS,       order: ['standard', 'exploitation', 'slavery'] },
    { key: 'governance',        label: '治理政策', icon: 'Landmark', color: 'text-purple-400', defs: GOVERNANCE_POLICY_DEFINITIONS,  order: ['autonomous', 'puppet_govt', 'direct_rule'] },
    { key: 'military',          label: '军事政策', icon: 'Sword',    color: 'text-red-400',    defs: MILITARY_POLICY_DEFINITIONS,    order: ['autonomous', 'call_to_arms', 'auto_join'] },
    { key: 'investmentPolicy',  label: '投资政策', icon: 'BarChart2',color: 'text-yellow-400', defs: INVESTMENT_POLICY_DEFINITIONS,  order: ['autonomous', 'guided', 'forced'] },
];

/**
 * 附属国批量政策底部面板（内嵌于 VassalOverviewPanel）
 */
const VassalBatchSheet = memo(({ isOpen, onClose, vassals = [], onDiplomaticAction }) => {
    const vassalCount = vassals.length;
    const [batchPolicy, setBatchPolicy] = React.useState({});
    const [enabledFields, setEnabledFields] = React.useState(new Set());
    const [tributePct, setTributePct] = React.useState(100);
    const [tributeEnabled, setTributeEnabled] = React.useState(false);
    const [feedback, setFeedback] = React.useState('');

    const showFeedback = (msg) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(''), 2500);
    };

    const handleClose = () => {
        setBatchPolicy({});
        setEnabledFields(new Set());
        setTributePct(100);
        setTributeEnabled(false);
        setFeedback('');
        onClose();
    };

    const toggleField = (key) => {
        setEnabledFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const setDimValue = (key, value) => {
        setBatchPolicy(prev => ({ ...prev, [key]: value }));
        setEnabledFields(prev => { const next = new Set(prev); next.add(key); return next; });
    };

    const handleApply = () => {
        if (vassalCount === 0) { showFeedback('❌ 当前没有附属国'); return; }
        if (enabledFields.size === 0 && !tributeEnabled) { showFeedback('❌ 请至少选择一项要应用的政策'); return; }
        const filteredPolicy = {};
        enabledFields.forEach(key => { if (batchPolicy[key] !== undefined) filteredPolicy[key] = batchPolicy[key]; });
        if (tributeEnabled) filteredPolicy.tributeRate = 0.1 * (tributePct / 100);
        if (Object.keys(filteredPolicy).length === 0) { showFeedback('❌ 请先为已勾选的维度选择值'); return; }
        vassals.forEach(n => onDiplomaticAction?.(n.id, 'adjust_vassal_policy', { policy: filteredPolicy }));
        const policyLabels = Object.keys(filteredPolicy).map(k => VASSAL_POLICY_DIMS.find(d => d.key === k)?.label || k).join('、');
        showFeedback(`✅ 已对 ${vassalCount} 个附属国应用：${policyLabels}`);
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={handleClose} title="⚡ 批量政策设置">
            <div className="space-y-4 p-1">
                {feedback && (
                    <div className="text-center text-sm text-green-300 bg-green-900/30 border border-green-700/40 rounded-lg py-2 px-3">{feedback}</div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>勾选要修改的维度，选择目标值后批量应用</span>
                    <div className="flex gap-2">
                        <button onClick={() => { setEnabledFields(new Set(VASSAL_POLICY_DIMS.map(d => d.key))); setTributeEnabled(true); }} className="px-2 py-0.5 bg-gray-700/50 hover:bg-gray-600/60 border border-gray-600/50 text-gray-300 rounded transition-colors">全选</button>
                        <button onClick={() => { setEnabledFields(new Set()); setTributeEnabled(false); }} className="px-2 py-0.5 bg-gray-700/50 hover:bg-gray-600/60 border border-gray-600/50 text-gray-300 rounded transition-colors">清除</button>
                    </div>
                </div>

                <div className="space-y-2">
                    {VASSAL_POLICY_DIMS.map(dim => {
                        const isEnabled = enabledFields.has(dim.key);
                        const currentVal = batchPolicy[dim.key];
                        const options = dim.order.filter(k => dim.defs[k]);
                        return (
                            <div key={dim.key} className={`rounded-xl border p-3 transition-colors ${isEnabled ? 'border-ancient-gold/40 bg-gray-800/50' : 'border-gray-700/40 bg-gray-900/30 opacity-70'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <button onClick={() => toggleField(dim.key)} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isEnabled ? 'bg-yellow-500/80 border-yellow-400' : 'bg-gray-700 border-gray-500'}`}>
                                        {isEnabled && <Icon name="Check" size={10} className="text-white" />}
                                    </button>
                                    <Icon name={dim.icon} size={13} className={dim.color} />
                                    <span className="text-sm font-semibold text-gray-200">{dim.label}</span>
                                    {currentVal && <span className="ml-auto text-xs text-ancient-gold bg-ancient-gold/10 px-2 py-0.5 rounded-full">{dim.defs[currentVal]?.name || currentVal}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {options.map(optKey => {
                                        const def = dim.defs[optKey];
                                        if (!def) return null;
                                        const isSelected = currentVal === optKey;
                                        return (
                                            <button key={optKey} onClick={() => setDimValue(dim.key, optKey)}
                                                className={`text-left px-2 py-1.5 rounded-lg border text-xs transition-colors ${isSelected ? 'bg-ancient-gold/20 border-ancient-gold/60 text-ancient-parchment' : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'}`}>
                                                <div className="font-semibold">{def.name}</div>
                                                {def.description && <div className="text-gray-500 mt-0.5 leading-tight text-xs">{def.description.slice(0, 20)}{def.description.length > 20 ? '…' : ''}</div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* 朝贡率 */}
                    <div className={`rounded-xl border p-3 transition-colors ${tributeEnabled ? 'border-ancient-gold/40 bg-gray-800/50' : 'border-gray-700/40 bg-gray-900/30 opacity-70'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setTributeEnabled(p => !p)} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${tributeEnabled ? 'bg-yellow-500/80 border-yellow-400' : 'bg-gray-700 border-gray-500'}`}>
                                {tributeEnabled && <Icon name="Check" size={10} className="text-white" />}
                            </button>
                            <Icon name="Coins" size={13} className="text-yellow-400" />
                            <span className="text-sm font-semibold text-gray-200">朝贡率</span>
                            <span className="ml-auto text-xs text-ancient-gold font-mono">{tributePct}% 基础值</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 flex-shrink-0">50%</span>
                            <input type="range" min={50} max={150} step={5} value={tributePct}
                                onChange={e => { setTributePct(Number(e.target.value)); setTributeEnabled(true); }}
                                className="flex-grow accent-yellow-500" />
                            <span className="text-xs text-gray-500 flex-shrink-0">150%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">基础朝贡率约为 GDP 增量的 10%</p>
                    </div>
                </div>

                <button onClick={handleApply} disabled={vassalCount === 0}
                    className="w-full py-3 bg-purple-700/60 hover:bg-purple-600/70 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-600/50 text-purple-100 text-sm rounded-xl font-bold transition-colors active:scale-95 flex items-center justify-center gap-2">
                    <Icon name="Layers" size={16} />
                    批量应用到 {vassalCount} 个附属国
                </button>
            </div>
        </BottomSheet>
    );
});
VassalBatchSheet.displayName = 'VassalBatchSheet';

/**
 * 附庸概览面板
 */
export const VassalOverviewPanel = memo(({
    isOpen,
    onClose,
    nations = [],
    playerResources = {},
    onSelectVassal,
    onAdjustPolicy,
    onReleaseVassal,
    onDiplomaticAction,
}) => {
    // 获取所有附庸
    const vassals = useMemo(() => {
        return nations.filter(n => n.vassalOf === 'player' && !n.isAnnexed);
    }, [nations]);

    // 批量政策面板状态
    const [batchSheetOpen, setBatchSheetOpen] = React.useState(false);

    // 计算汇总数据
    const summary = useMemo(() => {
        let totalTribute = 0;
        let totalWealth = 0;
        let totalPopulation = 0;
        let avgIndependence = 0;
        let atRiskCount = 0;

        vassals.forEach(v => {
            const tribute = calculateEnhancedTribute(v);
            totalTribute += tribute.silver || 0;
            totalWealth += v.wealth || 0;
            totalPopulation += v.population || 0;
            avgIndependence += v.independencePressure || 0;
            if ((v.independencePressure || 0) > 60) atRiskCount++;
        });

        if (vassals.length > 0) {
            avgIndependence /= vassals.length;
        }

        return {
            count: vassals.length,
            totalTribute,
            totalWealth,
            totalPopulation,
            avgIndependence,
            atRiskCount,
        };
    }, [vassals]);

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="👑 附庸概览"
        >
            <div className="space-y-4">
                {/* 汇总统计 */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/40">
                        <div className="text-xs text-purple-400 mb-1">附庸数</div>
                        <div className="text-lg font-bold text-purple-200">{summary.count}</div>
                    </div>
                    <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-700/40">
                        <div className="text-xs text-amber-400 mb-1">日朝贡</div>
                        <div className="text-lg font-bold text-amber-200">{formatNumberShortCN(summary.totalTribute)}</div>
                    </div>
                    <div className={`rounded-lg p-3 border ${summary.atRiskCount > 0 ? 'bg-red-900/30 border-red-700/40' : 'bg-gray-800/50 border-gray-700/40'}`}>
                        <div className="text-xs text-gray-400 mb-1">独立风险</div>
                        <div className={`text-lg font-bold ${summary.atRiskCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {summary.atRiskCount > 0 ? `${summary.atRiskCount}国` : '无'}
                        </div>
                    </div>
                </div>

                {/* 整体统计 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-400">附庸总财富:</span>
                            <span className="text-white ml-2">{formatNumberShortCN(summary.totalWealth)}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">附庸总人口:</span>
                            <span className="text-white ml-2">{formatNumberShortCN(summary.totalPopulation)}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">平均独立倾向:</span>
                            <span className={`ml-2 ${summary.avgIndependence > 50 ? 'text-red-400' : 'text-green-400'}`}>
                                {summary.avgIndependence.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* 附庸列表 - Unified List */}
                {vassals.length > 0 ? (
                    <div className="space-y-4">
                        <div>
                            <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                <Icon name="Crown" size={14} className="text-purple-400" />
                                附庸国列表
                                <span className="text-gray-500 text-xs">({vassals.length})</span>
                                {onDiplomaticAction && (
                                    <button
                                        onClick={() => setBatchSheetOpen(true)}
                                        className="ml-auto flex items-center gap-1 px-2 py-1 bg-purple-800/40 hover:bg-purple-700/50 border border-purple-600/40 text-purple-300 text-xs rounded-lg font-semibold transition-colors active:scale-95"
                                        title="批量统一设置所有附属国政策"
                                    >
                                        <Icon name="Layers" size={11} />
                                        批量政策
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {vassals.map(vassal => {
                                    const tribute = calculateEnhancedTribute(vassal);
                                    const independence = vassal.independencePressure || 0;
                                    const isAtRisk = independence > 60;
                                    return (
                                        <div
                                            key={vassal.id}
                                            className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-gray-700/30 ${isAtRisk ? 'border-red-700/50 bg-red-900/20' : 'border-gray-700/40 bg-gray-800/30'}`}
                                            onClick={() => onSelectVassal && onSelectVassal(vassal)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon name="Flag" size={16} className="text-amber-400" />
                                                    <span className="font-semibold text-white">{vassal.name}</span>
                                                    {isAtRisk && (
                                                        <span className="px-1.5 py-0.5 text-xs bg-red-600 text-white rounded">风险</span>
                                                    )}
                                                </div>
                                <div className="text-sm text-amber-400 font-semibold">
                                                    +{formatNumberShortCN(tribute.silver)}/日
                                                </div>
                                            </div>

                                            {/* 详细指标 */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-gray-400">朝贡率:</span>
                                                    <span className="text-white ml-1">{Math.round((vassal.tributeRate || 0) * 100)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">独立:</span>
                                                    <span className={`ml-1 ${isAtRisk ? 'text-red-400' : 'text-gray-200'}`}>
                                                        {Math.round(independence)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 操作按钮 */}
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    className="flex-1 py-1.5 text-xs rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800/50 border border-blue-700/40"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAdjustPolicy && onAdjustPolicy(vassal);
                                                    }}
                                                >
                                                    调整政策
                                                </button>
                                                <button
                                                    className="flex-1 py-1.5 text-xs rounded bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 border border-purple-700/40"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReleaseVassal && onReleaseVassal(vassal);
                                                    }}
                                                >
                                                    释放附庸
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 bg-gray-800/30 rounded-lg border border-gray-700/40">
                        <Icon name="Crown" size={40} className="mx-auto mb-3 opacity-50" />
                        <div className="text-base font-semibold mb-1">暂无附庸国</div>
                        <div className="text-sm">通过战争或外交途径征服/接纳附庸</div>
                    </div>
                )}

                {/* 提示 */}
                <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-700/30">
                    💡 高独立倾向的附庸可能发动独立战争，需加强控制或提高满意度
                </div>
            </div>

            {/* 嵌套批量政策面板 */}
            {onDiplomaticAction && (
                <VassalBatchSheet
                    isOpen={batchSheetOpen}
                    onClose={() => setBatchSheetOpen(false)}
                    vassals={vassals}
                    onDiplomaticAction={onDiplomaticAction}
                />
            )}
        </BottomSheet>
    );
});

VassalOverviewPanel.displayName = 'VassalOverviewPanel';

export default VassalOverviewPanel;
