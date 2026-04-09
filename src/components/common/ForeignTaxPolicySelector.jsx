import React from 'react';
import { FOREIGN_INVESTMENT_POLICIES } from '../../logic/diplomacy/overseasInvestment';

/**
 * Compact per-nation tax policy override selector.
 * Renders "跟随全局" + 4 policy tier buttons.
 *
 * Props:
 *  - nationId: string — target nation ID
 *  - currentOverride: string|null — current override policy key, or null/undefined for "follow global"
 *  - globalPolicy: string — current global policy key (default 'normal')
 *  - onChange: (nationId, policyKey|null) => void — callback; null means "follow global"
 *  - label: string — optional label prefix (default '税率:')
 */
const COLOR_MAP = {
    green: 'border-green-600 bg-green-900/40 text-green-400',
    gray: 'border-gray-500 bg-gray-700/40 text-gray-300',
    yellow: 'border-yellow-600 bg-yellow-900/40 text-yellow-400',
    red: 'border-red-600 bg-red-900/40 text-red-400',
};

const ForeignTaxPolicySelector = ({ nationId, currentOverride, globalPolicy = 'normal', onChange, label = '税率:' }) => {
    const globalPolicyConfig = FOREIGN_INVESTMENT_POLICIES[globalPolicy] || FOREIGN_INVESTMENT_POLICIES.normal;

    const options = [
        { key: 'follow_global', label: `跟随全局(${(globalPolicyConfig.taxRate * 100).toFixed(0)}%)`, color: 'gray' },
        ...Object.entries(FOREIGN_INVESTMENT_POLICIES).map(([k, v]) => ({
            key: k,
            label: `${v.label} ${(v.taxRate * 100).toFixed(0)}%`,
            color: v.color,
        })),
    ];

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {label && <span className="text-xs text-gray-500">{label}</span>}
            {options.map(opt => {
                const isActive = opt.key === 'follow_global'
                    ? !currentOverride
                    : currentOverride === opt.key;
                return (
                    <button
                        key={opt.key}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange?.(nationId, opt.key === 'follow_global' ? null : opt.key);
                        }}
                        className={`px-1.5 py-0.5 rounded border text-xs transition-all ${
                            isActive
                                ? `${COLOR_MAP[opt.color] || COLOR_MAP.gray} ring-1 ring-offset-1 ring-offset-gray-900 font-bold`
                                : 'border-gray-700/40 bg-gray-900/30 text-gray-500 hover:bg-gray-800/40'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
};

export default ForeignTaxPolicySelector;
