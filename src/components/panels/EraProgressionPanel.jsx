/**
 * 时代演进效果面板
 * 
 * 功能：
 * 1. 显示当前时代的外交加成
 * 2. 显示各系统的时代演进效果
 */

import React from 'react';
import { 
    getEraProgressionDescriptions,
    ERA_PROGRESSION_EFFECTS,
} from '../../config/diplomacy';
import { EPOCHS } from '../../config';

/**
 * 时代名称映射
 */
const ERA_NAMES = {
    0: '石器时代',
    1: '青铜时代',
    2: '铁器时代',
    3: '古典时代',
    4: '中世纪',
    5: '文艺复兴',
    6: '启蒙时代',
    7: '工业时代',
    8: '现代',
};

/**
 * 效果图标映射
 */
const EFFECT_ICONS = {
    merchantEfficiency: '🏪',
    vassalControl: '👑',
    treatyEfficiency: '📜',
    organizationEfficiency: '🏛️',
    overseasInvestment: '🏭',
    migrationEfficiency: '🌍',
};

/**
 * 单个效果卡片
 */
const EffectCard = ({ type, name, value, effect }) => {
    const icon = EFFECT_ICONS[type] || '📊';
    
    return (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-gray-300">{name}</span>
            </div>
            <div className="text-lg font-medium text-green-400">{value}</div>
            
            {/* 详细效果说明 */}
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                {type === 'merchantEfficiency' && effect.multiplier && (
                    <div>商人贸易效率 ×{effect.multiplier.toFixed(2)}</div>
                )}
                {type === 'vassalControl' && (
                    <>
                        <div>控制力 ×{effect.controlMultiplier?.toFixed(2) || '1.00'}</div>
                        <div>独立倾向削减 +{((effect.independenceReductionBonus || 0) * 100).toFixed(0)}%</div>
                    </>
                )}
                {type === 'treatyEfficiency' && (
                    <>
                        <div>条约时长 +{((effect.durationBonus || 0) * 100).toFixed(0)}%</div>
                        <div>维护费 -{((effect.maintenanceReduction || 0) * 100).toFixed(0)}%</div>
                    </>
                )}
                {type === 'organizationEfficiency' && (
                    <>
                        <div>组织效果 ×{effect.effectMultiplier?.toFixed(2) || '1.00'}</div>
                        <div>成员上限 +{Math.floor(effect.memberCapBonus || 0)}</div>
                    </>
                )}
                {type === 'overseasInvestment' && (
                    <>
                        <div>投资利润 ×{effect.profitMultiplier?.toFixed(2) || '1.00'}</div>
                        <div>风险降低 -{((effect.riskReduction || 0) * 100).toFixed(0)}%</div>
                    </>
                )}
                {type === 'migrationEfficiency' && (
                    <>
                        <div>移民流量 ×{effect.flowMultiplier?.toFixed(2) || '1.00'}</div>
                        <div>融入速度 +{((effect.integrationBonus || 0) * 100).toFixed(0)}%</div>
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * 时代演进效果面板主组件
 */
const EraProgressionPanel = ({ currentEra = 0 }) => {
    const eraName = ERA_NAMES[currentEra] || `时代 ${currentEra}`;
    const progressionEffects = getEraProgressionDescriptions(currentEra);
    
    // 计算时代优势
    const eraAdvantage = currentEra; // 相对于时代0的优势
    
    return (
        <div className="bg-gray-900/50 rounded-lg">
            {/* 标题 */}
            <div className="p-3 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                        <span>⏳</span>
                        <span>时代演进效果</span>
                    </h3>
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-sm rounded">
                        {eraName}
                    </span>
                </div>
                {eraAdvantage > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                        当前时代优势: +{eraAdvantage} 级
                    </div>
                )}
            </div>
            
            {/* 效果列表 */}
            <div className="p-3">
                {progressionEffects.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                        当前时代尚无额外加成
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {progressionEffects.map(effect => (
                            <EffectCard
                                key={effect.type}
                                type={effect.type}
                                name={effect.name}
                                value={effect.value}
                                effect={effect.effect}
                            />
                        ))}
                    </div>
                )}
            </div>
            
            {/* 下一时代预览 */}
            {currentEra < 8 && (
                <div className="p-3 border-t border-gray-700/50 bg-gray-800/30">
                    <div className="text-xs text-gray-400 mb-2">
                        下一时代 ({ERA_NAMES[currentEra + 1]}) 新增效果:
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-gray-500">
                            <span className="text-yellow-400">🏪</span> 商人 +10%
                        </div>
                        <div className="text-gray-500">
                            <span className="text-yellow-400">👑</span> 控制 +5%
                        </div>
                        <div className="text-gray-500">
                            <span className="text-yellow-400">📜</span> 条约 +10%
                        </div>
                        <div className="text-gray-500">
                            <span className="text-yellow-400">🏛️</span> 组织 +8%
                        </div>
                        <div className="text-gray-500">
                            <span className="text-yellow-400">🏭</span> 投资 +5%
                        </div>
                        <div className="text-gray-500">
                            <span className="text-yellow-400">🌍</span> 移民 +10%
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EraProgressionPanel;
