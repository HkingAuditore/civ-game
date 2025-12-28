
import React, { memo } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA, OFFICIAL_EFFECT_TYPES } from '../../../config';

/**
 * Single Official Card Component
 * Displays information for a hired official or functionality to hire a candidate.
 */
export const OfficialCard = memo(({
    official,
    isCandidate = false,
    onAction,
    canAfford = true,
    actionDisabled = false
}) => {
    if (!official) return null;

    const stratumDef = STRATA[official.stratum];
    const stratumColor = stratumDef?.color || 'text-gray-400';
    const stratumIcon = stratumDef?.icon || 'User';

    // Format salary display
    const salary = official.salary || 0;

    // Get effect descriptions
    const renderEffects = () => {
        const items = [];

        // Positive Effects
        if (official.effects) {
            Object.entries(official.effects).forEach(([type, value]) => {
                const config = OFFICIAL_EFFECT_TYPES[type];
                if (!config) return;

                let text = '';
                if (typeof config.format === 'function') {
                    // Try to resolve target name if possible (would need access to Configs, maybe pass simple text for now)
                    // For now simple formatting
                    text = `${config.name}: ${value}`;
                    // To do better formatting we might need context or helpers. 
                    // Let's rely on a simple mapping for now or improved later.

                    // Simple manual formatting based on type to look good:
                    if (type === 'production') text = `Production +${(value * 100).toFixed(0)}%`;
                    else if (type === 'stability') text = `Stability +${value}`;
                    else if (type === 'approval') text = `Approval +${value}`;
                    else if (type.includes('Mod')) text = `${config.name} ${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
                    else text = `${config.name} +${value}`;
                } else {
                    text = `${config.name} +${value}`;
                }

                items.push(
                    <div key={`eff-${type}`} className="flex items-center gap-1 text-xs text-green-300">
                        <Icon name="Plus" size={12} className="text-green-500" />
                        <span>{text}</span>
                    </div>
                );
            });
        }

        // Drawbacks
        if (official.drawbacks) {
            Object.entries(official.drawbacks).forEach(([type, value]) => {
                const config = OFFICIAL_EFFECT_TYPES[type];
                if (!config) return;

                let text = `${config.name} -${Math.abs(value)}`;
                if (type.includes('Mod') || type.includes('Percent')) {
                    text = `${config.name} -${(Math.abs(value) * 100).toFixed(0)}%`;
                }

                items.push(
                    <div key={`draw-${type}`} className="flex items-center gap-1 text-xs text-red-300">
                        <Icon name="Minus" size={12} className="text-red-500" />
                        <span>{text}</span>
                    </div>
                );
            });
        }

        return items;
    };

    return (
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 flex flex-col gap-2 hover:border-gray-600 transition-colors">
            {/* Header: Name, Stratum, Salary */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded bg-gray-900/50 ${stratumColor}`}>
                        <Icon name={stratumIcon} size={16} />
                    </div>
                    <div>
                        <div className="font-bold text-gray-200 text-sm leading-tight">{official.name}</div>
                        <div className={`text-[10px] ${stratumColor} opacity-80`}>
                            {stratumDef?.name || official.stratum} Origin
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-yellow-500 font-mono text-xs">
                        <span>{salary}</span>
                        <Icon name="Coins" size={12} />
                    </div>
                    <div className="text-[10px] text-gray-500">Daily Salary</div>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-700/50 w-full" />

            {/* Effects List */}
            <div className="flex-grow space-y-1">
                {renderEffects()}
                {(!official.effects && !official.drawbacks) && (
                    <div className="text-xs text-gray-500 italic">No significant effects</div>
                )}
            </div>

            {/* Action Button */}
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
                        Hire
                    </button>
                ) : (
                    <button
                        onClick={() => onAction(official.id)}
                        disabled={actionDisabled}
                        className="w-full py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-900/50"
                    >
                        <Icon name="UserMinus" size={12} />
                        Dismiss
                    </button>
                )}
            </div>
        </div>
    );
});
