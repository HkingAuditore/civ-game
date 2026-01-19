import React, { useMemo, useState } from 'react';
import { Input, Badge } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { getRelationLabel } from '../../utils/diplomacyUtils';

const NationList = ({ nations, visibleNations, selectedNationId, onSelectNation, relationInfo, diplomacyRequests = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, allies, enemies
    const [sortBy] = useState('relation'); // relation, name

    // Helper to check for pending requests
    const getPendingRequestCount = (nationId) => {
        return diplomacyRequests.filter(req => req.vassalId === nationId).length;
    };

    const filteredNations = useMemo(() => {
        let result = visibleNations || nations || [];

        if (searchTerm) {
            const lowerKey = searchTerm.toLowerCase();
            result = result.filter((n) => n.name.toLowerCase().includes(lowerKey));
        }

        if (filterType !== 'all') {
            result = result.filter((n) => {
                const rel = relationInfo ? relationInfo(n) : { value: 0, isAllied: false };
                if (filterType === 'allies') return rel.isAllied || rel.value >= 60;
                if (filterType === 'enemies') return n.isAtWar || rel.value <= 20;
                return true;
            });
        }

        result = result.slice().sort((a, b) => {
            // Prioritize nations with pending requests
            const aCount = getPendingRequestCount(a.id);
            const bCount = getPendingRequestCount(b.id);
            if (aCount !== bCount) return bCount - aCount;

            if (sortBy === 'name') return a.name.localeCompare(b.name);
            const relA = relationInfo ? relationInfo(a)?.value || 0 : 0;
            const relB = relationInfo ? relationInfo(b)?.value || 0 : 0;
            return relB - relA;
        });

        return result;
    }, [nations, visibleNations, searchTerm, filterType, sortBy, relationInfo, diplomacyRequests]);

    return (
        <div className="flex flex-col h-full bg-theme-surface-trans border-r border-theme-border">
            <div className="p-3 space-y-2 border-b border-theme-border bg-theme-surface flex-shrink-0">
                <Input
                    placeholder="搜索国家..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-theme-surface-trans border-theme-border text-sm h-8"
                />

                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {[
                        { id: 'all', label: '全部' },
                        { id: 'allies', label: '盟友' },
                        { id: 'enemies', label: '敌对' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilterType(f.id)}
                            className={`
                                px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border
                                ${filterType === f.id
                                    ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                                    : 'bg-transparent border-theme-border text-theme-text opacity-70 hover:opacity-100 hover:text-theme-accent'}
                            `}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-ancient-gold/20 hover:scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/30">
                {/* Global Overview Item */}
                <div
                    onClick={() => onSelectNation(null)}
                    className={`
                        relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group mb-3
                        ${selectedNationId === null
                            ? 'bg-theme-accent/10 border-theme-accent shadow-gold-metal'
                            : 'bg-theme-surface-trans border-theme-border hover:border-theme-accent hover:bg-theme-surface'}
                    `}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`
                                w-8 h-8 rounded bg-gray-800 flex items-center justify-center border text-sm shadow-inner
                                ${selectedNationId === null ? 'border-theme-accent text-theme-accent' : 'border-gray-700 text-theme-text opacity-70'}
                            `}
                        >
                            <Icon name="Globe" size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span
                                className={`font-bold text-sm leading-tight ${selectedNationId === null
                                    ? 'text-theme-accent'
                                    : 'text-theme-text group-hover:text-theme-accent transition-colors'}`}
                            >
                                外交概览
                            </span>
                            <span className="text-[10px] text-ancient-stone/60">
                                查看全球局势
                            </span>
                        </div>
                    </div>

                    {selectedNationId === null && (
                        <div
                            className="absolute left-0 top-2 bottom-2 w-0.5 bg-theme-accent rounded-r"
                            style={{ boxShadow: '0 0 8px var(--theme-glow)' }}
                        />
                    )}
                </div>

                {filteredNations.length === 0 ? (
                    <div className="text-center py-8 text-ancient-stone/50 text-sm flex flex-col items-center gap-2">
                        <Icon name="Search" size={24} className="opacity-50" />
                        <span>未找到符合条件的国家</span>
                    </div>
                ) : (
                    filteredNations.map((nation) => {
                        const rel = relationInfo ? relationInfo(nation) : { value: 0, label: '', color: 'text-ancient-stone', bg: '' };
                        const isSelected = selectedNationId === nation.id;
                        const relColor = rel.value >= 60 ? 'text-green-400' : rel.value <= 20 ? 'text-red-400' : 'text-ancient-stone';
                        const relIcon = rel.value >= 60 ? 'Smile' : rel.value <= 20 ? 'Frown' : 'Meh';
                        const pendingCount = getPendingRequestCount(nation.id);
                        const hasRequest = pendingCount > 0;
                        const isVassal = nation.isVassal || nation.vassalOf === 'player';

                        return (
                            <div
                                key={nation.id}
                                onClick={() => onSelectNation(nation.id)}
                                className={`
                                    relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                                    ${isSelected
                                        ? 'bg-theme-accent/10 border-theme-accent shadow-gold-metal'
                                        : 'bg-theme-surface-trans border-theme-border hover:border-theme-accent hover:bg-theme-surface'}
                                    ${hasRequest ? 'border-l-4 border-l-red-500 bg-red-900/10' : ''} 
                                `}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div
                                            className={`
                                                w-8 h-8 rounded bg-gray-800 flex items-center justify-center border text-sm shadow-inner relative
                                                ${isSelected ? 'border-theme-accent text-theme-accent' : 'border-gray-700 text-theme-text opacity-70'}
                                            `}
                                        >
                                            {nation.name.charAt(0)}
                                            {hasRequest && (
                                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center shadow-glow-red animate-pulse z-10">
                                                    <span className="text-[9px] font-bold text-white">{pendingCount}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span
                                                className={`font-bold text-sm leading-tight flex items-center gap-1 ${isSelected
                                                    ? 'text-theme-accent'
                                                    : 'text-theme-text group-hover:text-theme-accent transition-colors'}`}
                                            >
                                                {nation.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Icon name={relIcon} size={12} className={relColor} />
                                                <span className={`text-xs font-mono font-bold ${relColor}`}>
                                                    {rel.value > 0 ? '+' : ''}{Math.round(rel.value)}
                                                </span>
                                                <span className="text-[10px] text-ancient-stone/60">
                                                    {getRelationLabel(rel.value)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        {hasRequest && (
                                            <Badge variant="danger" className="text-[9px] px-1.5 py-0.5 shadow-depth-sm animate-pulse flex items-center gap-1">
                                                <Icon name="AlertCircle" size={10} />
                                                审批
                                            </Badge>
                                        )}
                                        {nation.isAtWar && (
                                            <Badge variant="danger" className="text-[9px] px-1 py-0 shadow-depth-sm animate-pulse">
                                                交战中
                                            </Badge>
                                        )}
                                        <div className="flex gap-1">
                                            {isVassal && <Icon name="Anchor" size={12} className="text-blue-400" title="附庸国" />}
                                            {nation.isSuzerain && <Icon name="Crown" size={12} className="text-amber-400" title="宗主国" />}
                                        </div>
                                    </div>
                                </div>

                                {isSelected && (
                                    <div
                                        className="absolute left-0 top-2 bottom-2 w-0.5 bg-theme-accent rounded-r"
                                        style={{ boxShadow: '0 0 8px var(--theme-glow)' }}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default NationList;
