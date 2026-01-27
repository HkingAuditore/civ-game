import React, { useState, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA, BUILDINGS } from '../../config';
import { getPublicAssetUrl } from '../../utils/assetPath';
import { getEventImageUrl } from '../../utils/imageRegistry';
import { filterEventOptions } from '../../utils/eventEffectFilter';
import { formatNumberShortCN } from '../../utils/numberFormat';

/**
 * 事件沉浸式英雄图片组件
 * 图片作为背景，标题和描述叠加在上面
 */
const EventHeroImage = ({ eventId, event, hasImage, onImageLoad, onImageError }) => {
    const imagePath = getEventImageUrl(eventId)
        ?? getPublicAssetUrl(`images/events/${eventId}.webp`);

    return (
        <div className="relative w-full h-44 mb-3 rounded-xl overflow-hidden">
            {/* 背景图片 - 确保完全填满容器 */}
            <img
                src={imagePath}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${hasImage ? 'opacity-100' : 'opacity-0'}`}
                style={{ minWidth: '100%', minHeight: '100%' }}
                onLoad={onImageLoad}
                onError={onImageError}
                loading="lazy"
            />

            {/* 底部渐变蒙版 - 平滑过渡到面板背景 */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent z-[1]" />

            {/* 边缘柔化 - 四周轻微暗角 */}
            <div className="absolute inset-0 z-[1]" style={{
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(17,24,39,0.6) 100%)'
            }} />

            {/* 叠加在图片上的标题区域 */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-[2]">
                <div className="flex items-end gap-3">
                    {/* 仅当图片未加载成功时显示图标 */}
                    {!hasImage && (
                        <div
                            className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-xl border backdrop-blur-sm ${event.isDiplomaticEvent
                                ? 'bg-gradient-to-br from-blue-600/90 to-purple-700/90 border-blue-400/50'
                                : 'bg-gradient-to-br from-ancient-gold/80 to-ancient-bronze/80 border-ancient-gold/60'
                                }`}
                        >
                            <Icon name={event.icon} size={28} className="text-white drop-shadow-lg" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white leading-tight font-decorative drop-shadow-lg">
                            {event.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            {event.isDiplomaticEvent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-600/40 text-blue-200 rounded border border-blue-400/40 backdrop-blur-sm font-sans">
                                    <Icon name="Globe" size={10} />
                                    外交事件
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 装饰性边框 */}
            <div className="absolute inset-0 rounded-xl border border-ancient-gold/20 z-[3] pointer-events-none" />
        </div>
    );
};





/**
 * 事件详情组件 - 史诗风格
 * 显示事件的详细信息和选项
 * @param {Object} event - 事件对象
 * @param {Function} onSelectOption - 选择选项的回调
 * @param {Function} onClose - 关闭回调
 */
export const EventDetail = ({ event, onSelectOption, onClose, nations = [], epoch = 0, techsUnlocked = [], confirmationEnabled = false }) => {
    if (!event) return null;

    // 图片加载状态管理
    const [hasImage, setHasImage] = useState(false);
    const [imageError, setImageError] = useState(false);

    // 已选中的选项（用于确认前高亮显示）
    const [selectedOption, setSelectedOption] = useState(null);

    // 使用 ref 追踪上一个事件对象引用
    const prevEventRef = React.useRef(null);

    // 当事件对象引用变化时重置图片状态
    if (prevEventRef.current !== event) {
        prevEventRef.current = event;
        // 需要在渲染期间同步重置，因为 useEffect 是异步的
        if (hasImage || imageError) {
            setHasImage(false);
            setImageError(false);
        }
    }

    // 过滤事件选项，移除尚未解锁的效果
    const filteredOptions = filterEventOptions(event.options, epoch, techsUnlocked);

    // 获取可见国家列表
    const visibleNations = nations.filter(n => n.visible !== false);

    // 获取事件中预解析的随机国家信息
    const resolvedRandomNation = event._resolvedRandomNation;

    // 根据选择器解析出实际国家名称
    const resolveNationNames = (selector) => {
        if (!visibleNations.length && selector !== 'all') return null;

        switch (selector) {
            case 'random':
                // 使用事件生成时已确定的随机国家
                if (resolvedRandomNation) {
                    return `（${resolvedRandomNation.name}）`;
                }
                return '（随机国家）';
            case 'all':
                // 目标是所有国家时，不显示具体国家名
                return null;
            case 'hostile': {
                const hostiles = visibleNations.filter(n => (n.relation || 50) < 30);
                if (hostiles.length === 0) return '（当前无敌对国家！此效果将无效）';
                return `（${hostiles.map(n => n.name).join('、')}）`;
            }
            case 'friendly': {
                const friendlies = visibleNations.filter(n => (n.relation || 50) >= 60);
                if (friendlies.length === 0) return '（当前无友好国家！此效果将无效）';
                return `（${friendlies.map(n => n.name).join('、')}）`;
            }
            case 'strongest': {
                if (visibleNations.length === 0) return null;
                const strongest = visibleNations.reduce((a, b) => (a.wealth || 0) > (b.wealth || 0) ? a : b);
                return `（${strongest.name}）`;
            }
            case 'weakest': {
                if (visibleNations.length === 0) return null;
                const weakest = visibleNations.reduce((a, b) => (a.wealth || 0) < (b.wealth || 0) ? a : b);
                return `（${weakest.name}）`;
            }
            default: {
                // 直接指定的国家ID（可能是从random预解析来的）
                const nation = visibleNations.find(n => n.id === selector);
                // 对于已解析的国家ID，直接返回国家名称作为前缀
                return nation ? `（${nation.name}）` : null;
            }
        }
    };

    // 判断选择器是否是具体的国家ID（而非选择器关键字）
    const isDirectNationId = (selector) => {
        const selectorKeywords = ['random', 'all', 'hostile', 'friendly', 'strongest', 'weakest'];
        return !selectorKeywords.includes(selector);
    };

    const getResourceName = (key) => (RESOURCES && RESOURCES[key]?.name) || key;
    const getStratumName = (key) => (STRATA && STRATA[key]?.name) || key;

    // Format percentage value for display (e.g., 0.05 -> "+5%", -0.03 -> "-3%")
    const formatPercent = (value) => {
        const percent = Math.round(value * 100);
        return `${percent > 0 ? '+' : ''}${percent}%`;
    };

    const formatSignedShortNumber = (value, { decimals = 1 } = {}) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return String(value ?? 0);
        // Use formatNumberShortCN's built-in sign parameter to handle both positive and negative numbers
        return formatNumberShortCN(value, { decimals, sign: true });
    };

    const nationSelectorLabels = {
        random: '随机国家',
        all: '所有国家',
        hostile: '敌对国家',
        friendly: '友好国家',
        strongest: '最强国家',
        weakest: '最弱国家',
    };

    const diplomaticStyles = {
        relation: {
            icon: 'Globe2',
            labelSuffix: '关系',
            positiveClass: 'bg-sky-900/50 text-sky-300 border border-sky-500/40',
            negativeClass: 'bg-rose-900/50 text-rose-300 border border-rose-500/40',
            formatter: (value) => formatSignedShortNumber(value, { decimals: 1 }),
        },
        aggression: {
            icon: 'Flame',
            labelSuffix: '侵略性',
            positiveClass: 'bg-red-900/50 text-red-300 border border-red-500/40',
            negativeClass: 'bg-green-900/50 text-green-300 border border-green-500/40',
            formatter: (value) => formatPercent(value),
        },
        wealth: {
            icon: 'Coins',
            labelSuffix: '财富',
            positiveClass: 'bg-amber-900/50 text-amber-200 border border-amber-500/40',
            negativeClass: 'bg-slate-900/50 text-slate-200 border border-slate-500/40',
            formatter: (value) => formatSignedShortNumber(value, { decimals: 1 }),
        },
        volatility: {
            icon: 'Activity',
            labelSuffix: '市场波动',
            positiveClass: 'bg-orange-900/50 text-orange-300 border border-orange-500/40',
            negativeClass: 'bg-cyan-900/50 text-cyan-300 border border-cyan-500/40',
            formatter: (value) => formatPercent(value),
        },
    };

    const optionThemeStyles = {
        baseBackground: 'linear-gradient(135deg, var(--theme-surface-trans) 0%, var(--theme-surface-muted) 50%, var(--theme-surface-trans) 100%)',
        selectedBackground: 'linear-gradient(135deg, var(--theme-surface) 0%, var(--theme-surface-alt) 50%, var(--theme-surface) 100%)',
        hoverBackground: 'linear-gradient(135deg, var(--theme-surface-alt) 0%, var(--theme-surface) 50%, var(--theme-surface-alt) 100%)',
        baseShadow: 'inset 0 0 0 1px var(--theme-border), 0 2px 8px rgba(0, 0, 0, 0.35)',
        selectedShadow: 'inset 0 0 0 2px var(--theme-accent), 0 0 18px var(--theme-glow)',
        hoverShadow: 'inset 0 0 0 1px var(--theme-accent), 0 0 14px var(--theme-glow)',
    };

    const handleOptionClick = (option) => {
        if (confirmationEnabled) {
            // 点击选项时只是选中，不立即执行
            setSelectedOption(option);
        } else {
            // 立即执行
            onSelectOption(event.id, option);
            onClose();
        }
    };

    // 处理确认按钮点击（仅在二次确认模式下使用）
    const handleConfirmOption = () => {
        if (selectedOption) {
            onSelectOption(event.id, selectedOption);
            onClose();
        }
    };

    // 渲染国家效果徽章
    const renderNationEffectBadges = (effectMap, type, keyPrefix) => {
        if (!effectMap) return null;

        const style = diplomaticStyles[type];
        if (!style) return null;

        return Object.entries(effectMap)
            .filter(([target]) => !target.startsWith('_'))
            .map(([target, value]) => {
                let targetName = resolveNationNames(target);
                if (targetName) {
                    targetName = targetName.replace(/^[（(](.+)[）)]$/, '$1');
                } else {
                    targetName = nationSelectorLabels[target] || target;
                }

                return (
                    <span
                        key={`${keyPrefix}-${type}-${target}`}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? style.positiveClass : style.negativeClass
                            } font-sans`}
                    >
                        <Icon name={style.icon} size={10} />
                        <span className="font-medium">{targetName}{style.labelSuffix}</span>
                        <span className="font-mono font-bold">{style.formatter(value)}</span>
                    </span>
                );
            });
    };

    // 渲染触发效果徽章（宣战/议和）
    const renderTriggerBadge = (target, type, keyPrefix) => {
        if (!target) return null;

        let targetName = resolveNationNames(target);
        if (targetName) {
            targetName = targetName.replace(/^[（(](.+)[）)]$/, '$1');
        } else {
            targetName = nationSelectorLabels[target] || target;
        }

        const isWar = type === 'war';
        const icon = isWar ? 'Swords' : 'Handshake';
        const label = isWar ? '宣战' : '议和';
        const className = isWar
            ? 'bg-red-900/60 text-red-200 border border-red-500/50'
            : 'bg-blue-900/60 text-blue-200 border border-blue-500/50';

        return (
            <span
                key={`${keyPrefix}-${type}-${target}`}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${className} font-sans`}
            >
                <Icon name={icon} size={10} />
                <span className="font-medium">与{targetName}{label}</span>
            </span>
        );
    };

    return (
        <div className="space-y-3 font-sans">
            {/* 沉浸式英雄区块 - 当有图片时显示，标题叠加在图片上 */}
            {!imageError && (
                <EventHeroImage
                    eventId={event.id}
                    event={event}
                    hasImage={hasImage}
                    onImageLoad={() => setHasImage(true)}
                    onImageError={() => setImageError(true)}
                />
            )}

            {/* 传统头部 - 仅当图片加载失败时显示 */}
            {imageError && (
                <div className="flex items-start gap-3">
                    <div
                        className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border ${event.isDiplomaticEvent
                            ? 'bg-gradient-to-br from-blue-600/80 to-purple-700/80 border-blue-400/30'
                            : 'bg-gradient-to-br from-ancient-gold/60 to-ancient-bronze/60 border-ancient-gold/40'
                            }`}
                    >
                        <Icon name={event.icon} size={28} className="text-white drop-shadow-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-ancient leading-tight font-decorative">{event.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {event.isDiplomaticEvent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-600/20 text-blue-300 rounded border border-blue-500/30 font-sans">
                                    <Icon name="Globe" size={10} />
                                    外交事件
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 事件描述 - 玻璃拟态 */}
            <div className="glass-ancient rounded-xl p-3 border border-ancient-gold/20 font-sans">
                <p className="text-sm text-ancient-parchment leading-relaxed font-sans">{event.description}</p>
            </div>

            {/* 事件选项 */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold text-ancient-stone uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Icon name="Target" size={12} style={{ color: 'var(--theme-accent)' }} />
                    选择你的行动
                </h3>
                {filteredOptions.map((option) => {
                    const isSelected = selectedOption?.id === option.id;
                    const isDisabled = option.disabled === true;
                    return (
                        <button
                            key={option.id}
                            onClick={() => !isDisabled && handleOptionClick(option)}
                            disabled={isDisabled}
                            className="w-full text-left rounded-xl p-3 transition-all group font-sans"
                            style={{
                                background: isDisabled
                                    ? 'rgba(60, 60, 60, 0.3)'
                                    : isSelected
                                        ? optionThemeStyles.selectedBackground
                                        : optionThemeStyles.baseBackground,
                                // 使用 box-shadow 实现稳定的边框效果，避免 border 在移动端的渲染问题
                                boxShadow: isDisabled
                                    ? 'inset 0 0 0 1px rgba(100, 100, 100, 0.3), 0 2px 8px rgba(0, 0, 0, 0.35)'
                                    : isSelected
                                        ? optionThemeStyles.selectedShadow
                                        : optionThemeStyles.baseShadow,
                                opacity: isDisabled ? 0.5 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSelected && !isDisabled) {
                                    e.currentTarget.style.boxShadow = optionThemeStyles.hoverShadow;
                                    e.currentTarget.style.background = optionThemeStyles.hoverBackground;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected && !isDisabled) {
                                    e.currentTarget.style.boxShadow = optionThemeStyles.baseShadow;
                                    e.currentTarget.style.background = optionThemeStyles.baseBackground;
                                }
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-ancient-parchment group-hover:text-ancient transition-colors leading-tight font-sans">
                                        {option.text}
                                    </h4>
                                    {option.description && (
                                        <p className="text-[11px] text-ancient-stone mt-1 leading-snug font-sans">{option.description}</p>
                                    )}

                                    {/* 效果预览 - 显示完整文字标签 */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {/* 资源效果（固定值） - 显示资源名称 */}
                                        {option.effects?.resources &&
                                            Object.entries(option.effects.resources || {}).map(([resource, value]) => (
                                                <span
                                                    key={resource}
                                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-green-900/50 text-green-300 border border-green-500/40' : 'bg-red-900/50 text-red-300 border border-red-500/40'
                                                        } font-sans`}
                                                >
                                                    <Icon name={RESOURCES[resource]?.icon || 'Package'} size={10} />
                                                    <span className="font-medium">{getResourceName(resource)}</span>
                                                    <span className="font-mono font-bold">{formatSignedShortNumber(value, { decimals: 1 })}</span>
                                                </span>
                                            ))}

                                        {/* 资源效果（百分比） - 显示资源名称和百分比 */}
                                        {option.effects?.resourcePercent &&
                                            Object.entries(option.effects.resourcePercent || {}).map(([resource, value]) => (
                                                <span
                                                    key={`pct-${resource}`}
                                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-green-900/50 text-green-300 border border-green-500/40' : 'bg-red-900/50 text-red-300 border border-red-500/40'
                                                        } font-sans`}
                                                >
                                                    <Icon name={RESOURCES[resource]?.icon || 'Package'} size={10} />
                                                    <span className="font-medium">{getResourceName(resource)}</span>
                                                    <span className="font-mono font-bold">{formatPercent(value)}</span>
                                                </span>
                                            ))}

                                        {/* 人口效果（固定值） - 显示"人口"标签 */}
                                        {option.effects?.population && (
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${option.effects.population > 0
                                                    ? 'bg-green-900/50 text-green-300 border border-green-500/40'
                                                    : 'bg-red-900/50 text-red-300 border border-red-500/40'
                                                    } font-sans`}
                                            >
                                                <Icon name="Users" size={10} />
                                                <span className="font-medium">人口</span>
                                                <span className="font-mono font-bold">{formatSignedShortNumber(option.effects.population, { decimals: 1 })}</span>
                                            </span>
                                        )}

                                        {/* 人口效果（百分比） - 显示"人口"标签和百分比 */}
                                        {option.effects?.populationPercent && (
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${option.effects.populationPercent > 0
                                                    ? 'bg-green-900/50 text-green-300 border border-green-500/40'
                                                    : 'bg-red-900/50 text-red-300 border border-red-500/40'
                                                    } font-sans`}
                                            >
                                                <Icon name="Users" size={10} />
                                                <span className="font-medium">人口</span>
                                                <span className="font-mono font-bold">{formatPercent(option.effects.populationPercent)}</span>
                                            </span>
                                        )}

                                        {/* 稳定度效果 */}
                                        {option.effects?.stability && (
                                            <span
                                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${option.effects.stability > 0
                                                    ? 'bg-green-900/50 text-green-300 border border-green-500/40'
                                                    : 'bg-red-900/50 text-red-300 border border-red-500/40'
                                                    } font-sans`}
                                            >
                                                <Icon name="TrendingUp" size={10} />
                                                <span className="font-medium">稳定</span>
                                                <span className="font-mono font-bold">{formatSignedShortNumber(option.effects.stability, { decimals: 1 })}</span>
                                            </span>
                                        )}

                                        {/* 阶层支持度效果 - 显示阶层名称 */}
                                        {option.effects?.approval &&
                                            Object.entries(option.effects.approval || {}).map(([stratum, value]) => (
                                                <span
                                                    key={stratum}
                                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-blue-900/50 text-blue-300 border border-blue-500/40' : 'bg-orange-900/50 text-orange-300 border border-orange-500/40'
                                                        } font-sans`}
                                                >
                                                    <Icon name={STRATA[stratum]?.icon || 'User'} size={10} />
                                                    <span className="font-medium">{getStratumName(stratum)}支持</span>
                                                    <span className="font-mono font-bold">{formatSignedShortNumber(value, { decimals: 1 })}</span>
                                                </span>
                                            ))}

                                        {/* 经济效果 - 资源需求修正 (时效性) */}
                                        {(() => {
                                            const demandMod = option.effects?.resourceDemandMod;
                                            if (!demandMod) return null;
                                            return Object.entries(demandMod).map(([resource, value]) => (
                                                <span
                                                    key={`demand-${resource}`}
                                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-purple-900/50 text-purple-300 border border-purple-500/40' : 'bg-cyan-900/50 text-cyan-300 border border-cyan-500/40'
                                                        } font-sans`}
                                                    title="此效果会随时间衰减"
                                                >
                                                    <Icon name="TrendingUp" size={10} />
                                                    <span className="font-medium">{getResourceName(resource)}需求</span>
                                                    <span className="font-mono font-bold">{formatPercent(value)}</span>
                                                    <Icon name="Clock" size={8} className="opacity-60" />
                                                </span>
                                            ));
                                        })()}

                                        {/* 经济效果 - 阶层消费修正 (时效性) */}
                                        {(() => {
                                            const stratumDemand = option.effects?.stratumDemandMod;
                                            if (!stratumDemand) return null;
                                            return Object.entries(stratumDemand).map(([stratum, value]) => (
                                                <span
                                                    key={`stratumDemand-${stratum}`}
                                                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-purple-900/50 text-purple-300 border border-purple-500/40' : 'bg-cyan-900/50 text-cyan-300 border border-cyan-500/40'
                                                        } font-sans`}
                                                    title="此效果会随时间衰减"
                                                >
                                                    <Icon name="ShoppingCart" size={10} />
                                                    <span className="font-medium">{getStratumName(stratum)}消费</span>
                                                    <span className="font-mono font-bold">{formatPercent(value)}</span>
                                                    <Icon name="Clock" size={8} className="opacity-60" />
                                                </span>
                                            ));
                                        })()}

                                        {/* 经济效果 - 建筑产量修正 (时效性) */}
                                        {(() => {
                                            const productionMod = option.effects?.buildingProductionMod;
                                            if (!productionMod) return null;
                                            return Object.entries(productionMod).map(([target, value]) => {
                                                // Try to find building name, fallback to category name or raw key
                                                const building = BUILDINGS.find(b => b.id === target);
                                                const categoryNames = { gather: '采集类', industry: '工业类', civic: '市政类', all: '所有' };
                                                const displayName = building?.name || categoryNames[target] || target;
                                                return (
                                                    <span
                                                        key={`production-${target}`}
                                                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${value > 0 ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/40' : 'bg-rose-900/50 text-rose-300 border border-rose-500/40'
                                                            } font-sans`}
                                                        title="此效果会随时间衰减"
                                                    >
                                                        <Icon name="Factory" size={10} />
                                                        <span className="font-medium">{displayName}产量</span>
                                                        <span className="font-mono font-bold">{formatPercent(value)}</span>
                                                        <Icon name="Clock" size={8} className="opacity-60" />
                                                    </span>
                                                );
                                            });
                                        })()}

                                        {option.effects && renderNationEffectBadges(option.effects.nationRelation, 'relation', `option-${option.id}`)}
                                        {option.effects && renderNationEffectBadges(option.effects.nationAggression, 'aggression', `option-${option.id}`)}
                                        {option.effects && renderNationEffectBadges(option.effects.nationWealth, 'wealth', `option-${option.id}`)}
                                        {option.effects && renderNationEffectBadges(option.effects.nationMarketVolatility, 'volatility', `option-${option.id}`)}
                                        {option.effects && renderTriggerBadge(option.effects.triggerWar, 'war', `option-${option.id}`)}
                                        {option.effects && renderTriggerBadge(option.effects.triggerPeace, 'peace', `option-${option.id}`)}
                                    </div>

                                    {/* 随机效果预览 */}
                                    {option.randomEffects && option.randomEffects.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-ancient-gold/10">
                                            <div className="flex items-center gap-1 mb-1.5">
                                                <Icon name="Dices" size={10} className="text-yellow-400" />
                                                <span className="text-[10px] text-yellow-400 font-medium font-sans">可能的额外效果</span>
                                            </div>
                                            {option.randomEffects.map((randomEffect, idx) => (
                                                <div key={idx} className="mb-1.5 last:mb-0">
                                                    <span className="text-[9px] text-yellow-300/70 font-medium font-sans">
                                                        {Math.round(randomEffect.chance * 100)}% 概率：
                                                    </span>
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {/* 随机效果 - 资源（固定值） */}
                                                        {randomEffect.effects.resources &&
                                                            Object.entries(randomEffect.effects.resources).map(([resource, value]) => (
                                                                <span
                                                                    key={`rand-res-${idx}-${resource}`}
                                                                    className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${value > 0 ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                                                        } font-sans`}
                                                                >
                                                                    <Icon name={RESOURCES[resource]?.icon || 'Package'} size={9} />
                                                                    <span>{getResourceName(resource)}</span>
                                                                    <span className="font-mono font-bold">{formatSignedShortNumber(value, { decimals: 1 })}</span>
                                                                </span>
                                                            ))}
                                                        {/* 随机效果 - 资源（百分比） */}
                                                        {randomEffect.effects.resourcePercent &&
                                                            Object.entries(randomEffect.effects.resourcePercent).map(([resource, value]) => (
                                                                <span
                                                                    key={`rand-res-pct-${idx}-${resource}`}
                                                                    className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${value > 0 ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                                                        } font-sans`}
                                                                >
                                                                    <Icon name={RESOURCES[resource]?.icon || 'Package'} size={9} />
                                                                    <span>{getResourceName(resource)}</span>
                                                                    <span className="font-mono font-bold">{formatPercent(value)}</span>
                                                                </span>
                                                            ))}
                                                        {/* 随机效果 - 人口（固定值） */}
                                                        {randomEffect.effects.population && (
                                                            <span
                                                                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${randomEffect.effects.population > 0
                                                                    ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                                                    } font-sans`}
                                                            >
                                                                <Icon name="Users" size={9} />
                                                                <span>人口</span>
                                                                <span className="font-mono font-bold">{formatSignedShortNumber(randomEffect.effects.population, { decimals: 1 })}</span>
                                                            </span>
                                                        )}
                                                        {/* 随机效果 - 人口（百分比） */}
                                                        {randomEffect.effects.populationPercent && (
                                                            <span
                                                                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${randomEffect.effects.populationPercent > 0
                                                                    ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                                                    } font-sans`}
                                                            >
                                                                <Icon name="Users" size={9} />
                                                                <span>人口</span>
                                                                <span className="font-mono font-bold">{formatPercent(randomEffect.effects.populationPercent)}</span>
                                                            </span>
                                                        )}
                                                        {/* 随机效果 - 稳定度 */}
                                                        {randomEffect.effects.stability && (
                                                            <span
                                                                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${randomEffect.effects.stability > 0
                                                                    ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                                                    } font-sans`}
                                                            >
                                                                <Icon name="TrendingUp" size={9} />
                                                                <span>稳定</span>
                                                                <span className="font-mono font-bold">{formatSignedShortNumber(randomEffect.effects.stability, { decimals: 1 })}</span>
                                                            </span>
                                                        )}
                                                        {/* 随机效果 - 阶层支持度 */}
                                                        {randomEffect.effects.approval &&
                                                            Object.entries(randomEffect.effects.approval).map(([stratum, value]) => (
                                                                <span
                                                                    key={`rand-app-${idx}-${stratum}`}
                                                                    className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${value > 0 ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' : 'bg-orange-900/30 text-orange-400 border border-orange-500/30'
                                                                        } font-sans`}
                                                                >
                                                                    <Icon name={STRATA[stratum]?.icon || 'User'} size={9} />
                                                                    <span>{getStratumName(stratum)}</span>
                                                                    <span className="font-mono font-bold">{formatSignedShortNumber(value, { decimals: 1 })}</span>
                                                                </span>
                                                            ))}
                                                        {renderNationEffectBadges(randomEffect.effects.nationRelation, 'relation', `random-${option.id}-${idx}`)}
                                                        {renderNationEffectBadges(randomEffect.effects.nationAggression, 'aggression', `random-${option.id}-${idx}`)}
                                                        {renderNationEffectBadges(randomEffect.effects.nationWealth, 'wealth', `random-${option.id}-${idx}`)}
                                                        {renderNationEffectBadges(randomEffect.effects.nationMarketVolatility, 'volatility', `random-${option.id}-${idx}`)}
                                                        {renderTriggerBadge(randomEffect.effects.triggerWar, 'war', `random-${option.id}-${idx}`)}
                                                        {renderTriggerBadge(randomEffect.effects.triggerPeace, 'peace', `random-${option.id}-${idx}`)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <Icon
                                    name={isSelected ? "Check" : "ChevronRight"}
                                    size={16}
                                    className="transition-colors flex-shrink-0 mt-0.5"
                                    style={{ color: isSelected ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 底部确认按钮 - 仅在开启二次确认时显示 */}
            {confirmationEnabled && (
                <div className="pt-2 border-t border-ancient-gold/20">
                    <button
                        onClick={handleConfirmOption}
                        disabled={!selectedOption}
                        className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 font-sans ${selectedOption
                            ? 'btn-epoch-primary'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                            }`}
                        style={selectedOption ? {
                            background: 'linear-gradient(135deg, var(--theme-secondary) 0%, var(--theme-primary) 55%, var(--theme-secondary) 100%)',
                            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 0 14px var(--theme-glow)',
                        } : undefined}
                    >
                        {selectedOption ? (
                            <>
                                <Icon name="Check" size={16} />
                                确认选择：{selectedOption.text}
                            </>
                        ) : (
                            '请先选择一个选项'
                        )}
                    </button>
                </div>
            )}

            {/* 提示信息 - 仅在开启二次确认时显示 */}
            {confirmationEnabled && (
                <div className="glass-ancient rounded-xl p-2.5 border border-blue-500/20 font-sans">
                    <div className="flex items-start gap-2">
                        <Icon name="Info" size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-blue-300 text-[11px] leading-snug font-sans">
                            点击选项进行选择，然后点击确认按钮执行。请仔细考虑每个选项的后果。
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
