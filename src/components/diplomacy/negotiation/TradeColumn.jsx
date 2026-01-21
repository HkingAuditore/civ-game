import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, Icon } from '../../common/UnifiedUI';
import { RESOURCES } from '../../../config/gameConstants';

// Compact inline select using portal - fixes z-index and positioning issues
const InlineSelect = ({ value, onChange, options, placeholder, themeColor = 'amber' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    // Color theme
    const colorClasses = {
        amber: { text: 'text-amber-400', activeBg: 'bg-amber-500/20' },
        green: { text: 'text-green-400', activeBg: 'bg-green-500/20' },
        red: { text: 'text-red-400', activeBg: 'bg-red-500/20' },
    };
    const colors = colorClasses[themeColor] || colorClasses.amber;

    // Calculate dropdown position
    const getDropdownPosition = useCallback(() => {
        if (!buttonRef.current) return { top: 0, left: 0, width: 0 };
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = Math.min(200, options.length * 28 + 8);
        
        // If not enough space below, show above
        const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
        
        return {
            top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 2,
            left: rect.left,
            width: Math.max(rect.width, 100),
        };
    }, [options.length]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (buttonRef.current?.contains(e.target)) return;
            if (dropdownRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        const handleScroll = (e) => {
            // Don't close if scrolling inside the dropdown itself
            if (dropdownRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        
        document.addEventListener('mousedown', handleClick);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.value === value);
    const displayText = selectedOption?.label || placeholder;
    const pos = isOpen ? getDropdownPosition() : null;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex-1 min-w-0 bg-black/30 text-[11px] px-1.5 py-1 outline-none cursor-pointer rounded border border-ancient-gold/20 hover:border-ancient-gold/40 transition-colors flex items-center justify-between gap-0.5"
            >
                <span className={`truncate ${value ? 'text-ancient-parchment' : 'text-ancient-stone/40'}`}>
                    {displayText}
                </span>
                <Icon name="ChevronDown" size={10} className={`flex-shrink-0 text-ancient-gold/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && pos && createPortal(
                <div 
                    ref={dropdownRef}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
                    className="bg-[#12121f] border border-ancient-gold/50 rounded shadow-2xl max-h-[200px] overflow-y-auto"
                >
                    {options.map((opt, i) => (
                        <div
                            key={opt.value || `opt-${i}`}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-2 py-1 cursor-pointer text-[11px] transition-colors border-b border-white/5 last:border-0
                                ${opt.value === value ? `${colors.activeBg} ${colors.text}` : 'text-ancient-parchment hover:bg-white/5'}
                                ${!opt.value ? 'text-ancient-stone/40 italic' : ''}
                            `}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

// Single compact resource row: [Select ▼] [Amount] [×]
const ResourceRow = ({ resource, index, onUpdate, onRemove, availableResources, themeColor, t }) => (
    <div className="flex items-center gap-1">
        <InlineSelect
            value={resource.key}
            onChange={(val) => onUpdate(index, 'key', val)}
            placeholder={t('negotiation.selectResource', '选择...')}
            themeColor={themeColor}
            options={[
                { value: '', label: '选择...' },
                ...availableResources.map(([key, res]) => ({ value: key, label: res.name }))
            ]}
        />
        {resource.key && (
            <input
                type="number"
                min="0"
                value={resource.amount || ''}
                onChange={(e) => onUpdate(index, 'amount', Number(e.target.value) || 0)}
                placeholder="0"
                className="w-14 bg-black/30 text-[11px] px-1.5 py-1 rounded border border-ancient-gold/20 hover:border-ancient-gold/40 text-center font-mono text-cyan-300 outline-none"
            />
        )}
        <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-0.5 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400/60 hover:text-red-300 transition-colors"
        >
            <Icon name="X" size={10} />
        </button>
    </div>
);

const TradeColumn = ({
    type,
    draft,
    setDraft,
    tradableResources,
    className,
    t = (k, v) => v
}) => {
    const isOffer = type === 'offer';
    const silverKey = isOffer ? 'signingGift' : 'demandSilver';
    const resourcesKey = isOffer ? 'resources' : 'demandResources';

    // Theme
    const themeColor = isOffer ? 'green' : 'red';
    const headerColor = isOffer ? 'text-green-400' : 'text-red-400';
    const borderColor = isOffer ? 'border-green-500/20' : 'border-red-500/20';
    const silverColor = isOffer ? 'text-amber-400' : 'text-red-300';
    const addBtnClasses = isOffer 
        ? 'text-green-400/50 hover:text-green-400 hover:bg-green-900/20' 
        : 'text-red-400/50 hover:text-red-400 hover:bg-red-900/20';

    const currentResources = draft[resourcesKey] || [];
    const selectedKeys = currentResources.map(r => r.key).filter(Boolean);
    
    const getAvailableResources = (currentKey) => 
        tradableResources.filter(([key]) => key === currentKey || !selectedKeys.includes(key));

    const handleAddResource = () => {
        setDraft(prev => ({
            ...prev,
            [resourcesKey]: [...(prev[resourcesKey] || []), { key: '', amount: 0 }]
        }));
    };

    const handleUpdateResource = (index, field, value) => {
        setDraft(prev => {
            const newResources = [...(prev[resourcesKey] || [])];
            newResources[index] = { ...newResources[index], [field]: value };
            return { ...prev, [resourcesKey]: newResources };
        });
    };

    const handleRemoveResource = (index) => {
        setDraft(prev => {
            const newResources = [...(prev[resourcesKey] || [])];
            newResources.splice(index, 1);
            return { ...prev, [resourcesKey]: newResources };
        });
    };

    const canAddMore = currentResources.length < tradableResources.length;

    return (
        <Card className={`p-2 space-y-2 ${borderColor} ${className}`}>
            {/* Header */}
            <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${headerColor}`}>
                <Icon name={isOffer ? 'Gift' : 'Hand'} size={12} />
                {isOffer ? t('negotiation.myOffer', '我方筹码 (OFFER)') : t('negotiation.myDemand', '我方索求 (DEMAND)')}
            </div>

            {/* Silver - single line */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-ancient-stone flex items-center gap-0.5 whitespace-nowrap">
                    <Icon name="Coins" size={10} className={silverColor} />银币
                </span>
                <div className="flex-1 flex items-center rounded overflow-hidden border border-ancient-gold/20 hover:border-ancient-gold/40 bg-black/20">
                    <input
                        type="number"
                        min="0"
                        value={draft[silverKey] || ''}
                        onChange={(e) => setDraft(prev => ({ ...prev, [silverKey]: Number(e.target.value) || 0 }))}
                        placeholder="0"
                        className={`flex-1 bg-transparent py-0.5 px-1.5 text-right font-mono text-[11px] font-bold outline-none ${silverColor}`}
                    />
                    <span className="px-1 text-[9px] text-ancient-stone/50 bg-black/20 border-l border-white/5">Silver</span>
                </div>
            </div>

            {/* Resources - compact list */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-ancient-stone flex items-center gap-0.5">
                        <Icon name="Package" size={10} className="text-cyan-400" />资源
                        {currentResources.length > 0 && <span className="text-ancient-gold/40">({currentResources.length})</span>}
                    </span>
                    {canAddMore && (
                        <button
                            type="button"
                            onClick={handleAddResource}
                            className={`text-[9px] px-1 py-0.5 rounded transition-colors flex items-center gap-0.5 ${addBtnClasses}`}
                        >
                            <Icon name="Plus" size={9} />添加
                        </button>
                    )}
                </div>

                {currentResources.map((resource, index) => (
                    <ResourceRow
                        key={index}
                        resource={resource}
                        index={index}
                        onUpdate={handleUpdateResource}
                        onRemove={handleRemoveResource}
                        availableResources={getAvailableResources(resource.key)}
                        themeColor={themeColor}
                        t={t}
                    />
                ))}
            </div>
        </Card>
    );
};

export default TradeColumn;
