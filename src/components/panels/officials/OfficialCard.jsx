
import React, { memo } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA, RESOURCES, BUILDINGS } from '../../../config';

// 效果类型的显示名称映射
const EFFECT_TYPE_NAMES = {
    buildings: '建筑产出',
    categories: '类别产出',
    stratumDemandMod: '阶层需求',
    resourceDemandMod: '资源需求',
    resourceSupplyMod: '资源供给',
    passive: '被动产出',
    passivePercent: '被动收益',
    needsReduction: '需求减少',
    maxPop: '人口上限',
    incomePercent: '财政收入',
    stability: '稳定性',
    militaryBonus: '军事力量',
    approval: '满意度',
};

// 获取目标的显示名称
const getTargetName = (target, type) => {
    // 建筑 - BUILDINGS 是数组，需要用 find 查找
    const buildingDef = BUILDINGS.find(b => b.id === target);
    if (buildingDef) return buildingDef.name;
    // 阶层
    if (STRATA[target]) return STRATA[target].name;
    // 资源
    if (RESOURCES[target]) return RESOURCES[target].name;
    // 类别
    const categoryNames = {
        gather: '采集',
        industry: '工业',
        civic: '民用',
        military: '军事',
    };
    if (categoryNames[target]) return categoryNames[target];
    // 特殊
    if (target === 'silver') return '银币';
    if (target === 'food') return '粮食';
    if (target === 'culture') return '文化';
    if (target === 'science') return '科技';
    return target;
};

/**
 * 单个官员卡片组件
 * 显示已雇佣官员的信息或候选人的雇佣功能。
 */
export const OfficialCard = memo(({
    official,
    isCandidate = false,
    onAction,
    canAfford = true,
    actionDisabled = false
}) => {
    if (!official) return null;

    // 使用 sourceStratum 或 stratum
    const stratumKey = official.sourceStratum || official.stratum;
    const stratumDef = STRATA[stratumKey];
    const stratumColor = stratumDef?.color || 'text-gray-400';
    const stratumIcon = stratumDef?.icon || 'User';

    // 格式化薪俸显示
    const salary = official.salary || 0;

    // 获取效果描述
    const renderEffects = () => {
        const items = [];
        const effects = official.effects || {};

        // 生成一条人性化的效果描述
        const formatEffect = (type, target, value) => {
            const targetName = target ? getTargetName(target, type) : null;
            const isPositive = value > 0;
            const absValue = Math.abs(value);

            // 判断这个效果对玩家是好是坏
            let isGood = isPositive;
            let description = '';

            switch (type) {
                // ========== 生产类 ==========
                case 'buildings':
                    // 建筑产出加成
                    description = `${targetName}产出 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'categories':
                    // 类别产出加成
                    description = `${targetName}类建筑产出 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'wartimeProduction':
                    // 战时产出加成
                    description = `战时产出 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;

                // ========== 经济类 ==========
                case 'tradeBonus':
                    // 贸易利润
                    description = `贸易利润 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'taxEfficiency':
                    // 税收效率
                    description = `税收效率 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'buildingCostMod':
                    // 建筑成本：负值是好的（降低成本）
                    isGood = value < 0;
                    description = `建筑成本 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;
                case 'incomePercent':
                    // 财政收入
                    description = `税收收入 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'passive':
                    // 被动产出：每日额外获得资源
                    description = `每日${targetName} ${isPositive ? '+' : ''}${value.toFixed(1)}`;
                    break;
                case 'passivePercent':
                    // 被动百分比收益
                    description = `${targetName}总收入 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'corruption':
                    // 腐败：税收损失（正值是坏的）
                    isGood = false;
                    description = `腐败损失 ${(value * 100).toFixed(0)}%`;
                    break;

                // ========== 需求/资源类 ==========
                case 'stratumDemandMod':
                    // 阶层需求修正：负值是好的（减少消耗）
                    isGood = value < 0;
                    description = `${targetName}消耗 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;
                case 'resourceDemandMod':
                    // 资源需求修正：负值是好的
                    isGood = value < 0;
                    description = `${targetName}消耗 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;
                case 'resourceSupplyMod':
                    // 资源供给加成
                    description = `${targetName}产量 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'resourceWaste':
                    // 资源浪费（正值是坏的）
                    isGood = value < 0;
                    description = `${targetName}浪费 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'needsReduction':
                    // 需求减少：正值是好的
                    description = `全民消耗 ${value > 0 ? '-' : '+'}${(absValue * 100).toFixed(0)}%`;
                    break;

                // ========== 人口/发展类 ==========
                case 'maxPop':
                    // 人口上限
                    description = `人口上限 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'populationGrowth':
                    // 人口增长
                    description = `人口增长 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'researchSpeed':
                    // 科研产出加成
                    description = `科研产出 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;

                // ========== 政治类 ==========
                case 'approval':
                    // 阶层满意度
                    description = `${targetName}满意度 ${isPositive ? '+' : ''}${value}`;
                    break;
                case 'coalitionApproval':
                    // 联盟阶层满意度
                    description = `联盟满意度 ${isPositive ? '+' : ''}${value}`;
                    break;
                case 'legitimacyBonus':
                    // 合法性
                    description = `合法性 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'organizationDecay':
                    // 组织度增长：负值是好的（减缓组织度增长）
                    isGood = value < 0;
                    description = `组织度增长 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;
                case 'factionConflict':
                    // 派系冲突（正值是坏的）
                    isGood = value < 0;
                    description = `派系冲突 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'stability':
                    // 稳定性
                    description = `稳定性 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;

                // ========== 军事类 ==========
                case 'militaryBonus':
                    // 军事战力
                    description = `军队战力 ${isPositive ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    break;
                case 'militaryUpkeep':
                    // 军事维护：负值是好的（降低维护）
                    isGood = value < 0;
                    description = `军事维护 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;

                // ========== 外交类 ==========
                case 'diplomaticBonus':
                    // 外交关系每日改善
                    description = `每日外交关系 ${isPositive ? '+' : ''}${value.toFixed(1)}`;
                    break;
                case 'diplomaticCooldown':
                    // 外交冷却：负值是好的（缩短冷却）
                    isGood = value < 0;
                    description = `外交冷却 ${value < 0 ? '' : '+'}${(value * 100).toFixed(0)}%`;
                    break;
                case 'diplomaticIncident':
                    // 外交事故（正值是坏的）
                    isGood = false;
                    description = `外交衰减 +${value.toFixed(1)}/日`;
                    break;

                default:
                    description = `${type}${target ? ` (${target})` : ''}: ${value}`;
            }

            return { description, isGood };
        };

        Object.entries(effects).forEach(([type, valueOrObj]) => {
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                // 嵌套对象：例如 { buildings: { farm: 0.1, mine: 0.05 } }
                Object.entries(valueOrObj).forEach(([target, value]) => {
                    const { description, isGood } = formatEffect(type, target, value);
                    items.push(
                        <div key={`eff-${type}-${target}`} className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                            <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                            <span>{description}</span>
                        </div>
                    );
                });
            } else {
                // 简单数值
                const { description, isGood } = formatEffect(type, null, valueOrObj);
                items.push(
                    <div key={`eff-${type}`} className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                        <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                        <span>{description}</span>
                    </div>
                );
            }
        });

        return items;
    };

    const effectItems = renderEffects();

    return (
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 flex flex-col gap-2 hover:border-gray-600 transition-colors">
            {/* 头部: 姓名, 阶层, 薪俸 */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded bg-gray-900/50 ${stratumColor}`}>
                        <Icon name={stratumIcon} size={16} />
                    </div>
                    <div>
                        <div className="font-bold text-gray-200 text-sm leading-tight">{official.name}</div>
                        <div className={`text-[10px] ${stratumColor} opacity-80`}>
                            {stratumDef?.name || stratumKey || '未知'} 出身
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-yellow-500 font-mono text-xs">
                        <span>{salary}</span>
                        <Icon name="Coins" size={12} />
                    </div>
                    <div className="text-[10px] text-gray-500">每日薪俸</div>
                    {/* 在职官员显示个人财富 */}
                    {!isCandidate && typeof official.wealth === 'number' && (
                        <div className="flex items-center justify-end gap-1 text-blue-400 font-mono text-[10px] mt-1">
                            <span>存款 {official.wealth.toFixed(0)}</span>
                            {typeof official.lastDayExpense === 'number' && official.lastDayExpense > 0 && (
                                <span className="text-gray-500">(-{official.lastDayExpense.toFixed(1)}/日)</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-gray-700/50 w-full" />

            {/* 效果列表 */}
            <div className="flex-grow space-y-1">
                {/* 显示对出身阶层的影响力加成 */}
                {official.stratumInfluenceBonus > 0 && (
                    <div className="flex items-center gap-1 text-xs text-purple-300">
                        <Icon name={stratumDef?.icon || "Users"} size={12} className="text-purple-400" />
                        <span>
                            {stratumDef?.name || stratumKey}影响力 +{(official.stratumInfluenceBonus * 100).toFixed(0)}%
                        </span>
                    </div>
                )}

                {effectItems.length > 0 ? effectItems : (
                    official.stratumInfluenceBonus <= 0 && (
                        <div className="text-xs text-gray-500 italic">无显著效果</div>
                    )
                )}
            </div>

            {/* 操作按钮 */}
            <div className="mt-2">
                {isCandidate ? (
                    <button
                        onClick={() => onAction(official.id)}
                        disabled={actionDisabled || !canAfford}
                        className={`w-full py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors
                            ${canAfford && !actionDisabled
                                ? 'bg-green-700 hover:bg-green-600 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Icon name="UserPlus" size={12} />
                        雇佣
                    </button>
                ) : (
                    <button
                        onClick={() => onAction(official.id)}
                        disabled={actionDisabled}
                        className="w-full py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-900/50"
                    >
                        <Icon name="UserMinus" size={12} />
                        解雇
                    </button>
                )}
            </div>
        </div>
    );
});
