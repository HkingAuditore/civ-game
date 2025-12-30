// 资源详情模态框
// 展示库存、市场趋势以及可视化的产业链信息

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { RESOURCES, STRATA, BUILDINGS, UNIT_TYPES, INDUSTRY_CHAINS } from '../../config';
import { calculateLuxuryConsumptionMultiplier, calculateUnlockMultiplier, getSimpleLivingStandard } from '../../utils/livingStandard';
import { isResourceUnlocked } from '../../utils/resources';

const formatAmount = (value) => {
    if (!Number.isFinite(value) || value === 0) return '0';
    if (Math.abs(value) >= 10) return value.toFixed(1);
    if (Math.abs(value) >= 1) return value.toFixed(2);
    return value.toFixed(3);
};

const ensureArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const MarketTrendChart = ({ series = [], height = 220, square = false }) => {
    const normalizedSeries = series
        .map(item => ({
            ...item,
            data: Array.isArray(item.data) ? item.data : [],
            color: item.color || '#60a5fa',
        }))
        .filter(item => item.data.length > 0);

    const values = normalizedSeries.flatMap(item => item.data.filter(value => Number.isFinite(value)));
    if (!normalizedSeries.length || !values.length) {
        return (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">
                暂无历史数据
            </div>
        );
    }

    let yMin = Math.min(...values);
    let yMax = Math.max(...values);
    if (yMax === yMin) {
        const paddingRange = Math.abs(yMax) * 0.1 || 1;
        yMax += paddingRange;
        yMin -= paddingRange;
    }
    const yRange = Math.max(yMax - yMin, 1);

    const width = 640;
    const chartHeight = square ? 640 : height;
    const padding = square ? 40 : Math.max(20, Math.round(chartHeight * 0.12));
    const totalPoints = Math.max(...normalizedSeries.map(item => item.data.length));
    const xStep = totalPoints > 1 ? (width - padding * 2) / (totalPoints - 1) : 0;
    const gridLines = 4;
    const ticks = Array.from({ length: gridLines + 1 }, (_, index) => ({
        value: yMin + (yRange / gridLines) * index,
        y: chartHeight - padding - ((yMin + (yRange / gridLines) * index - yMin) / yRange) * (chartHeight - padding * 2),
    }));

    const buildSeriesPath = (data) => {
        const offset = totalPoints - data.length;
        const coords = data
            .map((value, index) => {
                if (!Number.isFinite(value)) return null;
                const xIndex = offset + index;
                const x = padding + xIndex * xStep;
                const normalized = (value - yMin) / yRange;
                const y = chartHeight - padding - normalized * (chartHeight - padding * 2);
                return { x, y };
            })
            .filter(Boolean);

        if (!coords.length) return null;

        const pathD = coords
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
            .join(' ');

        return { pathD, coords };
    };

    return (
        <div className="w-full">
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
                {normalizedSeries.map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-gray-300">
                        <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                    </div>
                ))}
            </div>
            <div
                className={`relative w-full overflow-hidden rounded-2xl bg-gray-950/60 ${square ? 'aspect-square' : ''}`}
                style={square ? undefined : { height: `${chartHeight}px` }}
            >
                <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
                    {ticks.map(({ value, y }, index) => (
                        <g key={`grid-${index}`}>
                            <line
                                x1={padding}
                                x2={width - padding / 2}
                                y1={y}
                                y2={y}
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="1"
                            />
                            <text
                                x={padding - 10}
                                y={y + 4}
                                fill="rgba(255,255,255,0.45)"
                                fontSize="10"
                                textAnchor="end"
                            >
                                {value.toFixed(1)}
                            </text>
                        </g>
                    ))}
                    <line
                        x1={padding}
                        x2={width - padding / 2}
                        y1={height - padding}
                        y2={height - padding}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                    />
                    {normalizedSeries.map(item => {
                        const pathData = buildSeriesPath(item.data);
                        if (!pathData) return null;
                        return (
                            <g key={`series-${item.label}`}>
                                <path
                                    d={pathData.pathD}
                                    stroke={item.color}
                                    strokeWidth="2.5"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {pathData.coords.map((point, index) => (
                                    <circle
                                        key={`${item.label}-${index}`}
                                        cx={point.x}
                                        cy={point.y}
                                        r="3"
                                        fill={item.color}
                                        stroke="rgba(15,23,42,0.8)"
                                        strokeWidth="1"
                                    />
                                ))}
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

const TAB_OPTIONS = [
    { id: 'market', label: '市场行情', description: '价格走势与供需概览' },
    { id: 'analysis', label: '供需分析', description: '详细的需求构成与生产来源' },
    { id: 'chain', label: '产业链', description: '完整的生产与消费链路' },
];

// --- 产业链可视化组件 (新版) ---

// 流向标记
const FlowBadge = ({ label, direction = 'right' }) => (
    <span className="inline-flex items-center gap-1 rounded-full border border-ancient-gold/30 bg-ancient-ink/50 px-2 py-0.5 text-[9px] text-ancient-parchment">
        <Icon name={direction === 'right' ? 'ArrowRight' : 'ArrowLeft'} size={10} className="text-ancient-gold" />
        {label}
    </span>
);

// 生产节点组件 (建筑)
const ProductionNode = ({ buildingId, building, role, currentResource, count = 0 }) => {
    if (!building) return null;

    const isProducer = role === 'producer';

    let ratioNode = null;
    if (isProducer) {
        const outputAmount = building.output?.[currentResource] || 0;
        const inputs = Object.entries(building.input || {}).map(([key, amount]) => ({
            key,
            name: RESOURCES[key]?.name || key,
            ratio: outputAmount ? (amount / outputAmount).toFixed(2) : '?'
        }));

        ratioNode = (
            <div className="mt-1.5 space-y-0.5">
                {inputs.length > 0 ? inputs.map(input => (
                    <div key={input.key} className="text-[10px] text-ancient-stone flex justify-between">
                        <span>{input.name}</span>
                        <span className="text-ancient-stone/80">x{input.ratio}</span>
                    </div>
                )) : (
                    <div className="text-[10px] text-ancient-stone/80">基础采集/生产</div>
                )}
            </div>
        );
    } else {
        const inputAmount = building.input?.[currentResource] || 0;
        const outputs = Object.entries(building.output || {}).map(([key, amount]) => ({
            key,
            name: RESOURCES[key]?.name || key,
            ratio: inputAmount ? (amount / inputAmount).toFixed(2) : '?'
        }));

        ratioNode = (
            <div className="mt-1.5 space-y-0.5">
                {outputs.length > 0 ? outputs.map(output => (
                    <div key={output.key} className="text-[10px] text-ancient-stone flex justify-between">
                        <span>→ {output.name}</span>
                        <span className="text-ancient-stone/80">x{output.ratio}</span>
                    </div>
                )) : (
                    <div className="text-[10px] text-ancient-stone/80">作为终端消费</div>
                )}
            </div>
        );
    }

    return (
        <div className="relative group w-full min-w-[180px] rounded-xl border border-ancient-gold/20 bg-gray-900/70 p-3 shadow-metal-sm transition-colors hover:border-ancient-gold/40">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${building.visual?.color || 'bg-gray-800'} border border-white/10`}>
                        <Icon name={building.visual?.icon || 'Home'} size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-ancient-parchment truncate">{building.name}</p>
                        <p className="text-[9px] text-ancient-stone">
                            {count > 0 ? `已建 ${count | 0} 座` : '未建造'}
                        </p>
                    </div>
                </div>
                <FlowBadge label={isProducer ? '产出' : '消耗'} direction={isProducer ? 'right' : 'left'} />
            </div>
            <div className="h-px bg-ancient-gold/10 w-full mb-1.5"></div>
            {ratioNode}
            <div className="mt-2 pt-1 border-t border-ancient-gold/10 flex justify-between items-center">
                <span className="text-[9px] text-ancient-stone">{isProducer ? '产出' : '消耗'}/座</span>
                <span className={`text-xs font-mono font-bold ${isProducer ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {isProducer
                        ? building.output?.[currentResource]
                        : building.input?.[currentResource]}
                </span>
            </div>
        </div>
    );
};

// 动态产业链视图
const DynamicChainView = ({ resourceKey, buildings = {} }) => {
    const { producers, consumers } = useMemo(() => {
        const prods = [];
        const cons = [];

        BUILDINGS.forEach(b => {
            if (b.output?.[resourceKey] > 0) prods.push(b);
            if (b.input?.[resourceKey] > 0) cons.push(b);
        });

        return { producers: prods, consumers: cons };
    }, [resourceKey]);

    const relevantChain = useMemo(() => {
        return Object.values(INDUSTRY_CHAINS).find(chain => {
            return chain.stages.some(s =>
                ensureArray(s.input).includes(resourceKey) ||
                ensureArray(s.output).includes(resourceKey)
            );
        });
    }, [resourceKey]);

    const resourceDef = RESOURCES[resourceKey];

    return (
        <div className="space-y-6">
            <div className="glass-ancient rounded-xl lg:rounded-2xl border border-ancient-gold/20 p-4 lg:p-6">
                <div className="lg:hidden space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300">
                                来源 / 生产
                            </span>
                            <span className="text-[9px] text-ancient-stone">上游</span>
                        </div>
                        <p className="text-[11px] text-ancient-stone">
                            将原料生产为 <span className="text-ancient-parchment font-semibold">{resourceDef?.name}</span>。
                        </p>
                        {producers.length > 0 ? (
                            <div className="space-y-2">
                                {producers.map(b => (
                                    <ProductionNode
                                        key={b.id}
                                        buildingId={b.id}
                                        building={b}
                                        role="producer"
                                        currentResource={resourceKey}
                                        count={buildings[b.id]}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500 italic">
                                无本地生产来源（可能为基础资源或仅靠进口）
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-ancient-stone">
                        <Icon name="ArrowDown" size={14} className="text-ancient-gold" />
                        进入核心资源
                    </div>

                    <div className="relative p-5 rounded-2xl border-2 border-ancient-gold/40 bg-ancient-ink/60 shadow-[0_0_30px_-5px_rgba(212,175,55,0.25)] backdrop-blur-sm">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-ancient-ink border border-ancient-gold/40 rounded-full">
                            <span className="text-[10px] font-bold text-ancient-gold uppercase tracking-widest">核心资源</span>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-xl bg-gray-900 border border-ancient-gold/20 flex items-center justify-center shadow-inner">
                                <Icon name={resourceDef?.icon || 'Package'} size={30} className={resourceDef?.color || 'text-white'} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-ancient-parchment">{resourceDef?.name}</h3>
                                <p className="text-xs text-ancient-stone mt-1">
                                    {(resourceDef?.tags || []).map(tag => {
                                        const tagMap = {
                                            'essential': '生活必需',
                                            'raw_material': '原材料',
                                            'industrial': '工业资材',
                                            'manufactured': '制成品',
                                            'luxury': '奢侈品',
                                            'currency': '货币',
                                            'special': '特殊资源',
                                            'basic_need': '基本需求',
                                            'luxury_need': '奢侈需求',
                                            'construction': '建材',
                                            'military': '军用',
                                            'strategic': '战略',
                                            'refined': '加工品',
                                            'raw': '原材料',
                                            'food': '食物'
                                        };
                                        return tagMap[tag] || tag;
                                    }).join(' · ') || '资源'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-ancient-stone">
                        <Icon name="ArrowDown" size={14} className="text-ancient-gold" />
                        进入下游用途
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-rose-950/50 border border-rose-500/30 text-[10px] text-rose-300">
                                用途 / 消耗
                            </span>
                            <span className="text-[9px] text-ancient-stone">下游</span>
                        </div>
                        <p className="text-[11px] text-ancient-stone">
                            作为生产材料或终端消费进入产业链。
                        </p>
                        {consumers.length > 0 ? (
                            <div className="space-y-2">
                                {consumers.map(b => (
                                    <ProductionNode
                                        key={b.id}
                                        buildingId={b.id}
                                        building={b}
                                        role="consumer"
                                        currentResource={resourceKey}
                                        count={buildings[b.id]}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500 italic">
                                无工业消耗用途（直接消费品/终端产品）
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden lg:grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                    {/* 上游：来源 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300">
                                来源 / 生产
                            </span>
                            <span className="text-[9px] text-ancient-stone">上游</span>
                        </div>
                        {producers.length > 0 ? (
                            <div className="space-y-3">
                                {producers.map(b => (
                                    <ProductionNode
                                        key={b.id}
                                        buildingId={b.id}
                                        building={b}
                                        role="producer"
                                        currentResource={resourceKey}
                                        count={buildings[b.id]}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500 italic">
                                无本地生产来源（可能为基础资源或仅靠进口）
                            </div>
                        )}
                    </div>

                    {/* 核心：当前资源 */}
                    <div className="flex flex-col justify-center items-center">
                        <div className="relative p-5 rounded-2xl border-2 border-ancient-gold/40 bg-ancient-ink/60 shadow-[0_0_30px_-5px_rgba(212,175,55,0.25)] backdrop-blur-sm">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-ancient-ink border border-ancient-gold/40 rounded-full">
                                <span className="text-[10px] font-bold text-ancient-gold uppercase tracking-widest">核心资源</span>
                            </div>
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-xl bg-gray-900 border border-ancient-gold/20 flex items-center justify-center shadow-inner">
                                    <Icon name={resourceDef?.icon || 'Package'} size={30} className={resourceDef?.color || 'text-white'} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-ancient-parchment">{resourceDef?.name}</h3>
                                    <p className="text-xs text-ancient-stone mt-1">
                                        {(resourceDef?.tags || []).map(tag => {
                                            const tagMap = {
                                                'essential': '生活必需',
                                                'raw_material': '原材料',
                                                'industrial': '工业资材',
                                                'manufactured': '制成品',
                                                'luxury': '奢侈品',
                                                'currency': '货币',
                                                'special': '特殊资源',
                                                'basic_need': '基本需求',
                                                'luxury_need': '奢侈需求',
                                                'construction': '建材',
                                                'military': '军用',
                                                'strategic': '战略',
                                                'refined': '加工品',
                                                'raw': '原材料',
                                                'food': '食物'
                                            };
                                            return tagMap[tag] || tag;
                                        }).join(' · ') || '资源'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 下游：去向 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-rose-950/50 border border-rose-500/30 text-[10px] text-rose-300">
                                用途 / 消耗
                            </span>
                            <span className="text-[9px] text-ancient-stone">下游</span>
                        </div>
                        {consumers.length > 0 ? (
                            <div className="space-y-3">
                                {consumers.map(b => (
                                    <ProductionNode
                                        key={b.id}
                                        buildingId={b.id}
                                        building={b}
                                        role="consumer"
                                        currentResource={resourceKey}
                                        count={buildings[b.id]}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500 italic">
                                无工业消耗用途（直接消费品/终端产品）
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {relevantChain && relevantChain.upgrades && (
                <div className="rounded-xl border border-ancient-gold/20 bg-gray-950/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon name="Zap" size={16} className="text-purple-300" />
                        <h4 className="text-sm font-bold text-purple-100">产业链升级 ({relevantChain.name})</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {relevantChain.upgrades.map(upgrade => (
                            <div key={upgrade.id} className="p-3 rounded-lg border border-purple-500/10 bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-purple-200">{upgrade.name}</span>
                                    <span className="text-[10px] text-gray-500">时代 {upgrade.unlockEpoch}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 space-y-0.5">
                                    {Object.entries(upgrade.bonus || {}).map(([k, v]) => {
                                        const bonusMap = {
                                            'efficiency': '效率',
                                            'output': '产出',
                                            'input': '消耗减免',
                                            'capacity': '容量',
                                            'defense': '防御',
                                            'attack': '攻击',
                                            'preservation': '保存率',
                                            'approval': '支持度',
                                            'stability': '稳定度',
                                            'sustainability': '可持续性',
                                            'workers': '劳力优化',
                                            'processing': '加工效率',
                                            'waste': '损耗',
                                            'cloth_output': '布料产出',
                                            'dye_output': '染料产出',
                                            'culture': '文化产出',
                                            'extraction': '开采效率',
                                            'depth': '矿井深度',
                                            'science': '科研产出',
                                            'spread': '传播效率',
                                            'access': '普及率',
                                            'price': '价格优化',
                                            'profit': '利润',
                                            'influence': '影响力',
                                            'cost': '成本',
                                            'supply': '补给效率',
                                            'mobility': '机动性',
                                            'production': '生产力',
                                            'quality': '质量'
                                        };
                                        const label = bonusMap[k] || k;
                                        return (
                                            <div key={k}>
                                                {label}: <span className="text-emerald-400">+{v * 100}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResourceDetailContent = ({
    resourceKey,
    resources = {},
    market,
    buildings = {},
    popStructure = {},
    wealth = {},
    classIncome = {},
    classLivingStandard = {},
    army = {},
    dailyMilitaryExpense = null,
    history = {},
    epoch = 0,
    techsUnlocked = [],
    onClose,
    taxPolicies,
    onUpdateTaxPolicies,
    activeDebuffs = [],
}) => {
    const [activeTab, setActiveTab] = useState(TAB_OPTIONS[0].id);
    // Removed isAnimatingOut as framer-motion handles it
    const resourceDef = RESOURCES[resourceKey];
    const isSilver = resourceKey === 'silver';

    const priceHistoryData = useMemo(() => {
        const history = market?.priceHistory?.[resourceKey];
        return history ? [...history] : [];
    }, [market, resourceKey]);

    const [draftTaxRate, setDraftTaxRate] = useState(null);
    const [draftImportTariff, setDraftImportTariff] = useState(null);
    const [draftExportTariff, setDraftExportTariff] = useState(null);

    const currentTaxRate = taxPolicies?.resourceTaxRates?.[resourceKey] ?? 0;
    // 进口/出口关税（向后兼容旧的resourceTariffMultipliers）
    // 关税倍率：0=无关税，1=100%关税，<0=补贴
    const currentImportTariff = taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;
    const currentExportTariff = taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0;

    const handleTaxDraftChange = (raw) => {
        setDraftTaxRate(raw);
    };

    const commitTaxDraft = () => {
        if (draftTaxRate === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftTaxRate);
        const numeric = Number.isNaN(parsed) ? 0 : parsed;
        const rateValue = numeric / 100; // Convert percentage to decimal
        onUpdateTaxPolicies(prev => ({
            ...prev,
            resourceTaxRates: { ...(prev?.resourceTaxRates || {}), [resourceKey]: rateValue },
        }));
        setDraftTaxRate(null);
    };

    const handleImportTariffDraftChange = (raw) => {
        setDraftImportTariff(raw);
    };

    const handleExportTariffDraftChange = (raw) => {
        setDraftExportTariff(raw);
    };

    const commitImportTariffDraft = () => {
        if (draftImportTariff === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftImportTariff);
        const multiplier = Number.isNaN(parsed) ? 0 : parsed;  // Allow negative for subsidies
        onUpdateTaxPolicies(prev => ({
            ...prev,
            importTariffMultipliers: {
                ...(prev?.importTariffMultipliers || {}),
                [resourceKey]: multiplier,
            },
        }));
        setDraftImportTariff(null);
    };

    const commitExportTariffDraft = () => {
        if (draftExportTariff === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftExportTariff);
        const multiplier = Number.isNaN(parsed) ? 0 : parsed;  // Allow negative for subsidies
        onUpdateTaxPolicies(prev => ({
            ...prev,
            exportTariffMultipliers: {
                ...(prev?.exportTariffMultipliers || {}),
                [resourceKey]: multiplier,
            },
        }));
        setDraftExportTariff(null);
    };

    const supplyHistoryData = useMemo(() => {
        const history = market?.supplyHistory?.[resourceKey];
        return history ? [...history] : [];
    }, [market, resourceKey]);

    const demandHistoryData = useMemo(() => {
        const history = market?.demandHistory?.[resourceKey];
        return history ? [...history] : [];
    }, [market, resourceKey]);



    const stratumEfficiencyWarnings = useMemo(() => {
        if (!Array.isArray(activeDebuffs) || !activeDebuffs.length) return [];
        const shortageMap = market?.needsShortages || {};
        const penaltyFields = ['production', 'industryBonus', 'efficiency'];
        return activeDebuffs
            .map(effect => {
                if (!effect || !effect.class) return null;
                const penaltyEntry = penaltyFields
                    .map(field => ({ field, value: effect[field] }))
                    .filter(item => typeof item.value === 'number' && item.value < 0)
                    .sort((a, b) => a.value - b.value)[0];
                if (!penaltyEntry) return null;
                const stratum = STRATA[effect.class] || {};
                const shortagesRaw = shortageMap[effect.class] || [];
                const shortages = shortagesRaw
                    .map(entry => {
                        if (!entry) return null;
                        const parsed = typeof entry === 'string' ? { resource: entry, reason: 'outOfStock' } : entry;
                        if (!parsed.resource) return null;
                        const resName = RESOURCES[parsed.resource]?.name || parsed.resource;
                        const reason =
                            parsed.reason === 'unaffordable'
                                ? '买不起'
                                : parsed.reason === 'both'
                                    ? '缺货/买不起'
                                    : '缺货';
                        return `${resName}(${reason})`;
                    })
                    .filter(Boolean);
                return {
                    key: effect.class,
                    name: stratum.name || effect.class,
                    icon: stratum.icon || 'Users',
                    desc: effect.desc,
                    penaltyPercent: Math.round(penaltyEntry.value * 100),
                    shortages,
                };
            })
            .filter(Boolean);
    }, [activeDebuffs, market]);

    const {
        stratumDemand,
        buildingDemand,
        armyDemand,
        buildingSupply,
        totalBaseDemand,
        totalBaseSupply,
        totalActualDemand,
        totalActualSupply,
        totalTheoreticalSupply,
    } = useMemo(() => {
        if (!resourceDef) {
            return {
                stratumDemand: [],
                buildingDemand: [],
                armyDemand: [],
                buildingSupply: [],
                totalBaseDemand: 0,
                totalBaseSupply: 0,
                totalActualDemand: 0,
                totalActualSupply: 0,
                totalTheoreticalSupply: 0,
            };
        }

        // 获取加成数据
        const modifiers = market?.modifiers || {};
        const stratumConsumption = market?.stratumConsumption || {};
        const supplyBreakdown = market?.supplyBreakdown || {};
        const sources = modifiers.sources || {};

        // 资源级别的加成
        const decreeResDemandMod = sources.decreeResourceDemand?.[resourceKey] || 0;
        const eventResDemandMod = sources.eventResourceDemand?.[resourceKey] || 0;
        const decreeResSupplyMod = sources.decreeResourceSupply?.[resourceKey] || 0;
        const resourceDemandMultiplier = 1 + decreeResDemandMod + eventResDemandMod;
        const resourceSupplyMultiplier = 1 + decreeResSupplyMod;

        let baseDemandTotal = 0;
        let actualDemandTotal = 0;
        let baseSupplyTotal = 0;
        let actualSupplyTotal = 0;
        let theoreticalSupplyTotal = 0;

        const stratumDemandList = Object.entries(STRATA).reduce((acc, [key, stratum]) => {
            const population = popStructure[key] || 0;
            if (!population) return acc;

            // 阶层级别的加成（政令+事件是加法叠加）
            const decreeStratumMod = sources.decreeStratumDemand?.[key] || 0;
            const eventStratumMod = sources.eventStratumDemand?.[key] || 0;
            const stratumMultiplier = 1 + decreeStratumMod + eventStratumMod;

            // 财富乘数是独立的乘法因子
            const wealthMultiplier = sources.stratumWealthMultiplier?.[key] || 1;

            const priceMap = market?.prices || {};
            const baseNeeds = stratum.needs || {};
            let essentialCostPerCapita = 0;
            ['food', 'cloth'].forEach(resKey => {
                if (baseNeeds[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                    const marketPrice = priceMap[resKey] || RESOURCES[resKey]?.basePrice || 1;
                    const basePrice = RESOURCES[resKey]?.basePrice || 1;
                    const effectivePrice = Math.max(marketPrice, basePrice);
                    essentialCostPerCapita += baseNeeds[resKey] * effectivePrice;
                }
            });
            const incomePerCapita = (classIncome[key] || 0) / Math.max(1, population);
            const incomeRatio = essentialCostPerCapita > 0
                ? incomePerCapita / essentialCostPerCapita
                : (incomePerCapita > 0 ? 10 : 0);

            // 计算财富比例（用于判断奢侈需求解锁）
            const startingWealth = stratum.startingWealth || 1;
            const totalWealthForStratum = wealth[key] || (startingWealth * population);
            const perCapitaWealth = totalWealthForStratum / Math.max(1, population);
            const wealthRatio = perCapitaWealth / startingWealth;
            const livingStandardLevel = classLivingStandard?.[key]?.level
                || getSimpleLivingStandard(incomeRatio).level;
            const unlockMultiplier = calculateUnlockMultiplier(
                incomeRatio,
                wealthRatio,
                stratum.wealthElasticity || 1.0,
                livingStandardLevel
            );
            const luxuryConsumptionMultiplier = calculateLuxuryConsumptionMultiplier({
                consumptionMultiplier: wealthMultiplier,
                incomeRatio,
                wealthRatio,
                livingStandardLevel,
            });

            // 合并基础需求和已解锁的动态需求
            const effectiveNeeds = { ...(stratum.needs || {}) };
            let unlockedLuxuryThreshold = null;
            if (stratum.luxuryNeeds) {
                const thresholds = Object.keys(stratum.luxuryNeeds).map(Number).sort((a, b) => a - b);
                for (const threshold of thresholds) {
                    if (unlockMultiplier >= threshold) {
                        unlockedLuxuryThreshold = threshold;
                        const luxuryNeedsAtThreshold = stratum.luxuryNeeds[threshold];
                        for (const [resKey, amount] of Object.entries(luxuryNeedsAtThreshold)) {
                            effectiveNeeds[resKey] =
                                (effectiveNeeds[resKey] || 0) + (amount * luxuryConsumptionMultiplier);
                        }
                    }
                }
            }

            // 检查当前资源是否在有效需求中
            const perCap = effectiveNeeds[resourceKey] || 0;
            if (!perCap) return acc;

            // 检查是否有来自luxuryNeeds的额外需求
            const basePerCap = stratum.needs?.[resourceKey] || 0;
            const luxuryPerCap = perCap - basePerCap;
            const isLuxuryNeed = luxuryPerCap > 0;
            const isPureLuxury = basePerCap === 0 && luxuryPerCap > 0;

            const baseAmount = perCap * population;
            baseDemandTotal += baseAmount;

            // 实际值 = 基础值 × 阶层加成 × 资源加成 × 财富乘数
            const actualAmount = baseAmount * stratumMultiplier * resourceDemandMultiplier * wealthMultiplier;
            actualDemandTotal += actualAmount;

            // NEW: Get actual consumption for this stratum if available
            const realConsumption = stratumConsumption[key]?.[resourceKey];

            // 收集加成信息用于显示
            const modList = [];
            if (decreeStratumMod !== 0) modList.push(`政令${decreeStratumMod > 0 ? '+' : ''}${(decreeStratumMod * 100).toFixed(0)}%`);
            if (eventStratumMod !== 0) modList.push(`事件${eventStratumMod > 0 ? '+' : ''}${(eventStratumMod * 100).toFixed(0)}%`);
            // 财富乘数显示为乘数形式
            if (Math.abs(wealthMultiplier - 1) > 0.01) {
                const wealthPercent = (wealthMultiplier - 1) * 100;
                modList.push(`财务状况导致需求${wealthPercent > 0 ? '+' : ''}${wealthPercent.toFixed(0)}%`);
            }
            // 显示动态需求来源
            if (isLuxuryNeed) {
                modList.push(`富裕额外需求+${luxuryPerCap.toFixed(3)}`);
            }

            // 构建公式说明
            let formula = `${population}人 × ${perCap.toFixed(3)}`;
            if (isLuxuryNeed && basePerCap > 0) {
                formula = `${population}人 × (${basePerCap}基础+${luxuryPerCap.toFixed(3)}富裕)`;
            } else if (isPureLuxury) {
                formula = `${population}人 × ${luxuryPerCap.toFixed(3)}(富裕需求)`;
            }

            acc.push({
                key,
                name: stratum.name,
                icon: stratum.icon,
                baseAmount,
                theoreticalAmount: actualAmount, // Keep theoretical for comparison
                amount: realConsumption ?? 0,
                isActual: realConsumption !== undefined,
                formula,
                mods: modList,
                hasBonus: actualAmount !== baseAmount || isLuxuryNeed,
                isLuxuryNeed,
                isPureLuxury,
                wealthRatio: wealthRatio.toFixed(2),
            });
            return acc;
        }, []);

        const demandBreakdown = market?.demandBreakdown || {};
        const buildingDemandList = BUILDINGS.reduce((acc, building) => {
            const perBuilding = building.input?.[resourceKey] || 0;
            const count = buildings[building.id] || 0;
            const realConsumption = demandBreakdown[resourceKey]?.buildings?.[building.id];

            if ((!count && (realConsumption ?? 0) <= 0) || (count > 0 && !perBuilding && (realConsumption ?? 0) <= 0)) return acc;

            const baseAmount = perBuilding * count;
            baseDemandTotal += baseAmount;

            // 获取建筑原料消耗修正（官员效果 + 政治立场效果）
            const inputCostMod = sources.productionInputCost?.[building.id] || 0;
            const inputCostMultiplier = 1 + inputCostMod;
            const safeInputMultiplier = Math.max(0.2, inputCostMultiplier);

            // 建筑消耗 = 基础值 × 原料成本修正 × 资源需求乘数
            const actualAmount = baseAmount * safeInputMultiplier * resourceDemandMultiplier;
            actualDemandTotal += actualAmount;

            const finalAmount = realConsumption ?? 0;

            // 构建修正说明
            const modList = [];
            if (inputCostMod !== 0) {
                const sign = inputCostMod > 0 ? '+' : '';
                modList.push(`官员/立场 ${sign}${(inputCostMod * 100).toFixed(0)}%`);
            }

            acc.push({
                id: building.id,
                name: building.name,
                baseAmount,
                amount: finalAmount,
                theoreticalAmount: actualAmount,
                isActual: realConsumption !== undefined,
                formula: perBuilding > 0 ? `${count} 座 ` : '来自建筑升级',
                mods: modList,
                hasBonus: finalAmount !== baseAmount || modList.length > 0,
            });
            return acc;
        }, []);

        const buildingSupplyList = BUILDINGS.reduce((acc, building) => {
            const perBuilding = building.output?.[resourceKey] || 0;
            const count = buildings[building.id] || 0;
            const realProduction = supplyBreakdown[resourceKey]?.buildings?.[building.id];

            // Include if building exists AND (has base output OR has actual production from upgrades)
            if (!count || (!perBuilding && (realProduction ?? 0) <= 0)) return acc;

            const baseAmount = perBuilding * count;
            baseSupplyTotal += baseAmount;

            // 建筑产出加成 - 使用加法叠加（与 simulation.js 一致）
            // 现在直接存储加成百分比（如 0.25 = +25%）
            const techBuildingPct = sources.techBuildingBonus?.[building.id] || 0;
            const eventBuildingPct = sources.eventBuildingProduction?.[building.id] || 0;
            const techCategoryPct = sources.techCategoryBonus?.[building.cat] || 0;
            const eventCategoryPct = sources.eventBuildingProduction?.[building.cat] || 0;
            // 加法叠加：所有百分比相加
            const totalBonusPct = techBuildingPct + eventBuildingPct + techCategoryPct + eventCategoryPct;
            const buildingMultiplier = 1 + totalBonusPct;

            const theoreticalAmount = baseAmount * buildingMultiplier * resourceSupplyMultiplier;
            const actualAmount = realProduction ?? 0;

            actualSupplyTotal += actualAmount;
            theoreticalSupplyTotal += theoreticalAmount;

            const modList = [];
            if (techBuildingPct !== 0) modList.push(`科技 +${(techBuildingPct * 100).toFixed(0)}%`);
            if (eventBuildingPct !== 0) modList.push(`事件 +${(eventBuildingPct * 100).toFixed(0)}%`);
            if (techCategoryPct !== 0) modList.push(`类别科技 +${(techCategoryPct * 100).toFixed(0)}%`);
            if (eventCategoryPct !== 0) modList.push(`类别事件 +${(eventCategoryPct * 100).toFixed(0)}%`);

            acc.push({
                id: building.id,
                name: building.name,
                baseAmount,
                theoreticalAmount,
                amount: actualAmount,
                isActual: realProduction !== undefined,
                formula: perBuilding > 0 ? `${count} 座` : '来自建筑升级',
                mods: modList,
                hasBonus: actualAmount !== baseAmount,
            });
            return acc;
        }, []);

        // NEW: Add Import as a source
        const importAmount = supplyBreakdown[resourceKey]?.imports || 0;
        if (importAmount > 0) {
            buildingSupplyList.push({
                id: 'import',
                name: '国际贸易',
                baseAmount: 0,
                theoreticalAmount: 0,
                amount: importAmount,
                isActual: true,
                formula: '商人进口',
                mods: [],
                hasBonus: false,
            });
            actualSupplyTotal += importAmount;
        }


        const armyDemandList = Object.entries(UNIT_TYPES).reduce((acc, [id, unit]) => {
            const perUnit = unit.maintenanceCost?.[resourceKey] || 0;
            const count = army[id] || 0;
            if (!perUnit || !count) return acc;

            const baseAmount = perUnit * count;
            baseDemandTotal += baseAmount;
            const actualAmount = baseAmount * resourceDemandMultiplier;
            actualDemandTotal += actualAmount;
            const actualConsumption = dailyMilitaryExpense?.resourceConsumption?.[resourceKey];

            acc.push({
                id,
                name: unit.name,
                baseAmount,
                amount: actualConsumption ?? 0,
                formula: `${count} 队 × ${perUnit}`,
                hasBonus: actualAmount !== baseAmount,
            });
            return acc;
        }, []);

        return {
            stratumDemand: stratumDemandList,
            buildingDemand: buildingDemandList,
            armyDemand: armyDemandList,
            buildingSupply: buildingSupplyList,
            totalBaseDemand: baseDemandTotal,
            totalBaseSupply: baseSupplyTotal,
            totalActualDemand: actualDemandTotal,
            totalActualSupply: actualSupplyTotal,
            totalTheoreticalSupply: theoreticalSupplyTotal,
        };
    }, [resourceDef, resourceKey, popStructure, buildings, army, market, wealth, classIncome, classLivingStandard, epoch, techsUnlocked, dailyMilitaryExpense]);

    // Removed early return and animationClass
    // Wrapper ensures resourceKey exists

    const handleClose = () => {
        onClose();
    };

    const treasuryHistory = history?.treasury || [];
    const taxHistory = history?.tax || [];
    const latestTreasury = treasuryHistory.length
        ? treasuryHistory[treasuryHistory.length - 1]
        : resources[resourceKey] || 0;
    const latestTax = taxHistory.length ? taxHistory[taxHistory.length - 1] : 0;

    // totalActualDemand 和 totalActualSupply 直接从 useMemo 中解构使用

    const inventory = resources[resourceKey] || 0;
    const marketSupply = market?.supply?.[resourceKey] || 0;
    const marketDemand = market?.demand?.[resourceKey] || 0;
    const marketPrice = market?.prices?.[resourceKey] ?? resourceDef.basePrice ?? 0;
    const priceTrend =
        priceHistoryData.length >= 2
            ? priceHistoryData[priceHistoryData.length - 1] - priceHistoryData[priceHistoryData.length - 2]
            : 0;

    const latestSupply = supplyHistoryData[supplyHistoryData.length - 1] ?? marketSupply;
    const latestDemand = demandHistoryData[demandHistoryData.length - 1] ?? marketDemand;
    const activeTabMeta = TAB_OPTIONS.find(tab => tab.id === activeTab);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center status-bar-safe-area pt-2">
            {/* 遮罩层 */}
            <motion.div
                className="absolute inset-0 bg-black/70"
                onClick={handleClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
            />

            {/* 内容面板 */}
            <motion.div
                className="relative w-full max-w-6xl glass-epic border-t-2 lg:border-2 border-ancient-gold/30 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[90vh] overflow-hidden"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
                {/* 头部 */}
                <div className="flex-shrink-0 p-2 lg:p-3 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 lg:w-10 lg:h-10 icon-metal-container icon-metal-container-lg flex-shrink-0">
                            <Icon name={resourceDef.icon} size={20} className={`${resourceDef.color} icon-metal`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm lg:text-base font-bold text-white leading-tight font-decorative">{resourceDef.name}</h2>
                            <p className="text-[9px] lg:text-[10px] text-gray-400 leading-tight truncate">
                                库存 {inventory.toFixed(1)} {isSilver ? '· 财政资源' : `· 价格 ${marketPrice.toFixed(2)}`}
                            </p>
                        </div>
                        <button onClick={handleClose} className="p-1.5 lg:p-2 rounded-full hover:bg-gray-700 flex-shrink-0">
                            <Icon name="X" size={16} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isSilver ? (
                        <div className="space-y-2 lg:space-y-3 p-2 lg:p-3">
                            {/* 财政概览 */}
                            <div className="grid gap-1.5 lg:gap-2 grid-cols-2">
                                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2 lg:p-2.5">
                                    <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-yellow-300/80 leading-none">国库银币</p>
                                    <p className="mt-1 text-base lg:text-lg font-bold text-yellow-200 font-mono leading-none">{latestTreasury.toFixed(0)}</p>
                                    <p className="mt-0.5 lg:mt-1 text-[8px] lg:text-[9px] text-yellow-200/80 leading-none">
                                        储备 {(resources[resourceKey] || 0).toFixed(0)}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 lg:p-2.5">
                                    <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-emerald-300/80 leading-none">每日税收</p>
                                    <p className="mt-1 text-base lg:text-lg font-bold text-emerald-200 font-mono leading-none">
                                        {formatAmount(latestTax)}
                                    </p>
                                    <p className="mt-0.5 lg:mt-1 text-[8px] lg:text-[9px] text-emerald-200/80 leading-none">净税额估算</p>
                                </div>
                            </div>
                            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2">
                                <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-blue-200/80 leading-none mb-0.5 lg:mb-1">财政说明</p>
                                <p className="text-[9px] lg:text-[10px] text-blue-100/80 leading-snug lg:leading-relaxed">
                                    银币为非交易资源,仅通过税收、事件和政策流动,下面的走势可帮助你判断财政稳定度。
                                </p>
                            </div>
                            {/* 交易税调整 */}
                            {!isSilver && onUpdateTaxPolicies && (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                                    <p className="text-[9px] uppercase tracking-wide text-emerald-300/80 leading-none mb-2">交易税调整</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step="1"
                                            value={draftTaxRate ?? (currentTaxRate * 100).toFixed(0)}
                                            onChange={(e) => handleTaxDraftChange(e.target.value)}
                                            onBlur={commitTaxDraft}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    commitTaxDraft();
                                                    e.target.blur();
                                                }
                                            }}
                                            className="w-24 bg-gray-800/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
                                            placeholder="税率%"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-emerald-200">
                                                当前税率: {(currentTaxRate * 100).toFixed(0)}%
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                对市场交易额征税。负数为补贴。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2">
                                <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-blue-200/80 leading-none mb-0.5 lg:mb-1">财政说明</p>
                                <p className="text-[9px] lg:text-[10px] text-blue-100/80 leading-snug lg:leading-relaxed">
                                    银币为非交易资源,仅通过税收、事件和政策流动,下面的走势可帮助你判断财政稳定度。
                                </p>
                            </div>
                            {/* 走势图 */}
                            <div className="space-y-1.5 lg:space-y-2">
                                <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2">
                                    <div className="mb-1.5 lg:mb-2 flex items-center justify-between">
                                        <div>
                                            <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-gray-500 leading-none">国库资金走势</p>
                                            <p className="text-xs lg:text-sm font-semibold text-white leading-tight mt-0.5">
                                                当前 {(resources[resourceKey] || 0).toFixed(0)} 银币
                                            </p>
                                        </div>
                                        <Icon name="Coins" size={14} className="text-yellow-200" />
                                    </div>
                                    <SimpleLineChart
                                        data={treasuryHistory}
                                        color="#facc15"
                                        label="银币"
                                    />
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2">
                                    <div className="mb-1.5 lg:mb-2 flex items-center justify-between">
                                        <div>
                                            <p className="text-[8px] lg:text-[9px] uppercase tracking-wide text-gray-500 leading-none">每日净税收走势</p>
                                            <p className="text-xs lg:text-sm font-semibold text-white leading-tight mt-0.5">
                                                当前 {formatAmount(latestTax)} / 日
                                            </p>
                                        </div>
                                        <Icon name="Activity" size={14} className="text-emerald-300" />
                                    </div>
                                    <SimpleLineChart
                                        data={taxHistory}
                                        color="#34d399"
                                        label="每日净税收"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col">
                            {/* 标签页 */}
                            <div className="px-2 lg:px-3 pt-1.5 lg:pt-2 flex-shrink-0">
                                <div className="flex items-center gap-2 text-[10px] lg:text-xs rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm overflow-x-auto">
                                    {TAB_OPTIONS.map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`min-w-[64px] px-3 py-1.5 rounded-full border-2 font-semibold whitespace-nowrap transition-all ${tab.id === activeTab
                                                ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                                                : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                                                }`}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {activeTabMeta && (
                                    <p className="text-[8px] lg:text-[9px] text-gray-500 pb-1 leading-tight">{activeTabMeta.description}</p>
                                )}
                            </div>
                            <div className="flex-1 space-y-2 lg:space-y-3 p-2 lg:p-3 overflow-y-auto">
                                {/* 交易税调整 - 非银币资源 */}
                                {!isSilver && onUpdateTaxPolicies && (
                                    <div className="rounded-xl lg:rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-2.5 lg:p-4">
                                        <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500 mb-1.5 lg:mb-2">交易税调整</p>
                                        <div className="flex items-center gap-2 lg:gap-4">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentValue = parseFloat(draftTaxRate ?? (currentTaxRate * 100));
                                                        const newValue = isNaN(currentValue) ? -10 : -currentValue;
                                                        handleTaxDraftChange(String(newValue));
                                                        // 触发提交
                                                        setTimeout(() => commitTaxDraft(), 0);
                                                    }}
                                                    className="btn-compact flex-shrink-0 w-7 h-7 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded-lg text-xs font-bold text-gray-300 flex items-center justify-center transition-colors"
                                                    title="切换正负值（税收/补贴）"
                                                >
                                                    ±
                                                </button>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={draftTaxRate ?? (currentTaxRate * 100).toFixed(0)}
                                                    onChange={(e) => handleTaxDraftChange(e.target.value)}
                                                    onBlur={commitTaxDraft}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            commitTaxDraft();
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    className="w-14 lg:w-20 bg-gray-800/70 border border-gray-600 text-base lg:text-lg font-mono text-gray-200 rounded-lg px-1.5 lg:px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
                                                />
                                                <span className="text-base lg:text-lg font-semibold text-emerald-300">%</span>
                                            </div>
                                            <div className="text-right flex-1">
                                                <p className={`text-base lg:text-lg font-bold ${currentTaxRate > 0 ? 'text-yellow-300' : currentTaxRate < 0 ? 'text-green-300' : 'text-gray-400'}`}>
                                                    {currentTaxRate > 0 ? '征税' : currentTaxRate < 0 ? '补贴' : '无'}
                                                </p>
                                                <p className="text-[10px] lg:text-xs text-gray-400">当前状态</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] lg:text-xs text-gray-400 mt-1.5 lg:mt-2">对该资源的国内市场交易额征税。负数代表政府进行补贴。</p>
                                        <div className="mt-2 lg:mt-3 space-y-3">
                                            {/* 进口关税 */}
                                            <div>
                                                <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                                                    <Icon name="ArrowDownLeft" size={12} className="text-blue-400" />
                                                    进口关税倍率
                                                </p>
                                                <div className="flex items-center gap-2 lg:gap-3">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        step="0.1"
                                                        value={draftImportTariff ?? currentImportTariff.toFixed(2)}
                                                        onChange={(e) => handleImportTariffDraftChange(e.target.value)}
                                                        onBlur={commitImportTariffDraft}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitImportTariffDraft();
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        className="w-20 lg:w-28 bg-gray-800/70 border border-gray-600 text-base lg:text-lg font-mono text-gray-200 rounded-lg px-1.5 lg:px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                                    />
                                                    <div className="text-right flex-1">
                                                        <p className="text-sm lg:text-base font-semibold text-blue-200">{currentImportTariff.toFixed(2)}×</p>
                                                        <p className="text-[10px] lg:text-xs text-gray-400">当前倍率</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* 出口关税 */}
                                            <div>
                                                <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                                                    <Icon name="ArrowUpRight" size={12} className="text-green-400" />
                                                    出口关税倍率
                                                </p>
                                                <div className="flex items-center gap-2 lg:gap-3">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        step="0.1"
                                                        value={draftExportTariff ?? currentExportTariff.toFixed(2)}
                                                        onChange={(e) => handleExportTariffDraftChange(e.target.value)}
                                                        onBlur={commitExportTariffDraft}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitExportTariffDraft();
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        className="w-20 lg:w-28 bg-gray-800/70 border border-gray-600 text-base lg:text-lg font-mono text-gray-200 rounded-lg px-1.5 lg:px-2 py-1 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center"
                                                    />
                                                    <div className="text-right flex-1">
                                                        <p className="text-sm lg:text-base font-semibold text-green-200">{currentExportTariff.toFixed(2)}×</p>
                                                        <p className="text-[10px] lg:text-xs text-gray-400">当前倍率</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[10px] lg:text-xs text-gray-400">关税与交易税独立计算，最终税率 = 交易税率 + 关税倍率（加法叠加，非乘法）。负数为补贴。</p>
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'market' && (
                                    <div className="space-y-3 lg:space-y-6">
                                        <div className="grid grid-cols-2 gap-2 lg:gap-4">
                                            <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-2.5 lg:p-4">
                                                <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">库存概览</p>
                                                <p className="mt-1 lg:mt-2 text-2xl lg:text-3xl font-bold text-white">{inventory.toFixed(1)}</p>
                                                <p className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-400">
                                                    日净变化 {formatAmount((latestSupply - latestDemand) || 0)}
                                                </p>
                                            </div>
                                            <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-2.5 lg:p-4">
                                                <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">市场价</p>
                                                <div className="mt-1 lg:mt-2 flex items-center gap-2 lg:gap-3 text-white">
                                                    <span className="text-2xl lg:text-3xl font-bold">{marketPrice.toFixed(2)}</span>
                                                    <span
                                                        className={`flex items-center gap-0.5 lg:gap-1 text-xs lg:text-sm ${priceTrend > 0
                                                            ? 'text-emerald-400'
                                                            : priceTrend < 0
                                                                ? 'text-rose-400'
                                                                : 'text-gray-400'
                                                            }`}
                                                    >
                                                        <Icon name={priceTrend >= 0 ? 'ArrowUp' : 'ArrowDown'} size={14} />
                                                        {priceTrend >= 0 ? '+' : ''}
                                                        {formatAmount(priceTrend)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-400">近两日价格变化</p>
                                            </div>
                                        </div>
                                        {/* 价格走势和供需走势 - 同行展示 */}
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:gap-3">
                                            {/* 价格走势图 */}
                                            <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-2 lg:p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">价格走势</p>
                                                    <Icon name="TrendingUp" size={14} className="text-sky-300" />
                                                </div>
                                                <MarketTrendChart
                                                    series={[
                                                        {
                                                            label: '市场价（银币）',
                                                            color: '#60a5fa',
                                                            data: priceHistoryData,
                                                        },
                                                    ]}
                                                    height={200}
                                                />
                                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-[9px] lg:text-[10px] text-gray-500">当前价格</p>
                                                        <p className="text-sm lg:text-base font-bold text-white">{marketPrice.toFixed(2)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-[9px] lg:text-[10px] text-gray-500">日变化</p>
                                                        <p className={`text-sm lg:text-base font-bold ${priceTrend > 0 ? 'text-emerald-300' : priceTrend < 0 ? 'text-rose-300' : 'text-white'
                                                            }`}>
                                                            {priceTrend >= 0 ? '+' : ''}{formatAmount(priceTrend)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 供需走势图 */}
                                            <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-2 lg:p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">供需走势</p>
                                                    <Icon name="Activity" size={14} className="text-emerald-300" />
                                                </div>
                                                <MarketTrendChart
                                                    series={[
                                                        {
                                                            label: '供给',
                                                            color: '#34d399',
                                                            data: supplyHistoryData,
                                                        },
                                                        {
                                                            label: '需求',
                                                            color: '#f87171',
                                                            data: demandHistoryData,
                                                        },
                                                    ]}
                                                    height={200}
                                                />
                                                <div className="mt-2 grid grid-cols-3 gap-1.5">
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-[9px] lg:text-[10px] text-gray-500">供给</p>
                                                        <p className="text-sm lg:text-base font-bold text-emerald-300">{formatAmount(latestSupply)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-[9px] lg:text-[10px] text-gray-500">需求</p>
                                                        <p className="text-sm lg:text-base font-bold text-rose-300">{formatAmount(latestDemand)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-[9px] lg:text-[10px] text-gray-500">净供需</p>
                                                        <p className="text-sm lg:text-base font-bold text-white">{formatAmount((latestSupply || 0) - (latestDemand || 0))}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'analysis' && (
                                    <div className="grid gap-3 lg:gap-6 lg:grid-cols-2">

                                        {/* 市场实际数据对比说明 */}
                                        {(() => {
                                            const marketDemand = market?.demand?.[resourceKey] || 0;
                                            const marketSupply = market?.supply?.[resourceKey] || 0;
                                            const actualDemandTotal =
                                                stratumDemand.reduce((sum, item) => sum + item.amount, 0) +
                                                buildingDemand.reduce((sum, item) => sum + item.amount, 0) +
                                                armyDemand.reduce((sum, item) => sum + item.amount, 0);
                                            const actualSupplyTotal = buildingSupply.reduce((sum, item) => sum + item.amount, 0);

                                            // 只有当市场有数据且与实际成交差异超过5%时才显示
                                            const demandDiff = actualDemandTotal > 0 ? Math.abs(marketDemand - actualDemandTotal) / actualDemandTotal : 0;
                                            const supplyDiff = actualSupplyTotal > 0 ? Math.abs(marketSupply - actualSupplyTotal) / actualSupplyTotal : 0;

                                            if ((marketDemand > 0 || marketSupply > 0) && (demandDiff > 0.05 || supplyDiff > 0.05)) {
                                                return (
                                                    <div className="lg:col-span-2 rounded-xl border border-blue-500/30 bg-blue-950/20 p-2.5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Icon name="Info" size={14} className="text-blue-400" />
                                                            <p className="text-[10px] lg:text-xs text-blue-200 font-medium">实际成交数据</p>
                                                        </div>
                                                        <div className="grid gap-2 grid-cols-2">
                                                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30">
                                                                <div>
                                                                    <span className="text-[10px] text-rose-300">实际消费量</span>
                                                                    <span className="text-[8px] text-gray-500 ml-1">需求 {formatAmount(marketDemand)}</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-rose-400">{formatAmount(actualDemandTotal)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30">
                                                                <div>
                                                                    <span className="text-[10px] text-emerald-300">实际供给量</span>
                                                                    <span className="text-[8px] text-gray-500 ml-1">市场 {formatAmount(marketSupply)}</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-emerald-400">{formatAmount(actualSupplyTotal)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 mt-1.5">
                                                            实际成交=真实购买/消耗；市场需求/供给可能包含未成交部分
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-3 lg:p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">需求构成</p>
                                                    <p className="text-base lg:text-xl font-semibold text-white">
                                                        {activeTab === 'analysis' ? (
                                                            <>
                                                                实际消费 {formatAmount(stratumDemand.reduce((sum, item) => sum + item.amount, 0) + buildingDemand.reduce((sum, item) => sum + item.amount, 0) + armyDemand.reduce((sum, item) => sum + item.amount, 0))}
                                                                {/* <span className="text-xs text-gray-500 ml-2 font-normal">
                                                                    (理论需求: {formatAmount(totalActualDemand)})
                                                                </span> */}
                                                            </>
                                                        ) : (
                                                            <>理论需求 {formatAmount(totalActualDemand)}</>
                                                        )}
                                                    </p>
                                                </div>
                                                <Icon name="TrendingUp" size={18} className="text-rose-300" />
                                            </div>
                                            <div className="mt-2 lg:mt-4 space-y-2 lg:space-y-4">
                                                <div>
                                                    <p className="text-xs lg:text-sm font-semibold text-gray-300">社会阶层</p>
                                                    <div className="mt-1.5 lg:mt-2 space-y-1.5 lg:space-y-2">
                                                        {stratumDemand.length ? (
                                                            stratumDemand.map(item => (
                                                                <div
                                                                    key={item.key}
                                                                    className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.isPureLuxury
                                                                        ? 'border-purple-500/30 bg-purple-950/20'
                                                                        : item.isLuxuryNeed
                                                                            ? 'border-indigo-500/30 bg-indigo-950/20'
                                                                            : item.hasBonus
                                                                                ? 'border-amber-500/30 bg-amber-950/20'
                                                                                : 'border-gray-800/60 bg-gray-900/60'
                                                                        } p-2 lg:p-3`}
                                                                >
                                                                    <div className="flex items-center gap-2 lg:gap-3">
                                                                        <div className={`rounded-lg lg:rounded-xl p-1.5 lg:p-2 ${item.isPureLuxury
                                                                            ? 'bg-purple-900/80'
                                                                            : item.isLuxuryNeed
                                                                                ? 'bg-indigo-900/80'
                                                                                : 'bg-gray-900/80'
                                                                            }`}>
                                                                            <Icon name={item.icon} size={16} className={
                                                                                item.isPureLuxury
                                                                                    ? 'text-purple-300'
                                                                                    : item.isLuxuryNeed
                                                                                        ? 'text-indigo-300'
                                                                                        : 'text-amber-300'
                                                                            } />
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                                {item.isPureLuxury && (
                                                                                    <span className="text-[8px] px-1 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-500/30">
                                                                                        富裕新增
                                                                                    </span>
                                                                                )}
                                                                                {item.isLuxuryNeed && !item.isPureLuxury && (
                                                                                    <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-500/30">
                                                                                        含富裕需求
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[10px] lg:text-xs text-gray-500">{item.formula}</p>
                                                                            {/* {item.wealthRatio && (
                                    <p className="text-[9px] text-gray-400">财富比例: {item.wealthRatio}×</p>
                                  )} */}
                                                                            {item.mods && item.mods.length > 0 && (
                                                                                <p className={`text-[9px] ${item.isPureLuxury
                                                                                    ? 'text-purple-400'
                                                                                    : item.isLuxuryNeed
                                                                                        ? 'text-indigo-400'
                                                                                        : 'text-amber-400'
                                                                                    }`}>{item.mods.join(' · ')}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className={`text-sm lg:text-base font-bold ${item.isPureLuxury
                                                                            ? 'text-purple-200'
                                                                            : item.isLuxuryNeed
                                                                                ? 'text-indigo-200'
                                                                                : 'text-rose-200'
                                                                            }`}>{formatAmount(item.amount)}</p>

                                                                        {/* {item.isActual && (
                                                                            <p className="text-[9px] text-emerald-400">实际消费</p>
                                                                        )} */}
                                                                        {/* {!item.isActual && item.hasBonus && (
                                                                            <p className="text-[9px] text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
                                                                        )} */}

                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs lg:text-sm text-gray-500">暂无有效需求</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs lg:text-sm font-semibold text-gray-300">建筑/工坊</p>
                                                    <p className="text-[9px] text-gray-500 mt-0.5">实际消耗 = 基础值 × 效率加成</p>
                                                    <div className="mt-1.5 lg:mt-2 space-y-1.5 lg:space-y-2">
                                                        {buildingDemand.length ? (
                                                            buildingDemand.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.hasBonus ? 'border-amber-500/30 bg-amber-950/20' : 'border-gray-800/60 bg-gray-900/60'} p-2 lg:p-3`}
                                                                >
                                                                    <div>
                                                                        <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                        <p className="text-[10px] lg:text-xs text-gray-500">{item.formula}</p>
                                                                        {item.mods && item.mods.length > 0 && (
                                                                            <p className="text-[9px] text-amber-400 mt-0.5">
                                                                                {item.mods.join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm lg:text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                                                                        {item.hasBonus && item.baseAmount !== item.amount && (
                                                                            <p className="text-[9px] text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs lg:text-sm text-gray-500">暂无建筑需求</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs lg:text-sm font-semibold text-gray-300">军需</p>
                                                    <div className="mt-1.5 lg:mt-2 space-y-1.5 lg:space-y-2">
                                                        {armyDemand.length ? (
                                                            armyDemand.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.hasBonus ? 'border-amber-500/30 bg-amber-950/20' : 'border-gray-800/60 bg-gray-900/60'} p-2 lg:p-3`}
                                                                >
                                                                    <div>
                                                                        <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                        <p className="text-[10px] lg:text-xs text-gray-500">{item.formula}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm lg:text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                                                                        {/* {item.hasBonus && (
                                                                            <p className="text-[9px] text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
                                                                        )} */}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs lg:text-sm text-gray-500">暂无军队消耗</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl lg:rounded-2xl border border-gray-800 bg-gray-950/60 p-3 lg:p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] lg:text-xs uppercase tracking-wide text-gray-500">生产来源</p>
                                                    <p className="text-base lg:text-xl font-semibold text-white">
                                                        {activeTab === 'analysis' ? (
                                                            <>
                                                                实际供给 {formatAmount(buildingSupply.reduce((sum, item) => sum + item.amount, 0))}
                                                                <span className="text-xs text-gray-500 ml-2 font-normal">
                                                                    (理论产能: {formatAmount(totalTheoreticalSupply)})
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>理论产能 {formatAmount(totalTheoreticalSupply)}</>
                                                        )}
                                                    </p>
                                                </div>
                                                <Icon name="TrendingDown" size={18} className="text-emerald-300" />
                                            </div>
                                            <p className="text-[9px] text-gray-500 mt-1">实际产出/消耗 = 基础值 × 效率加成（产出和消耗同比例变化）</p>
                                            <div className="mt-2 lg:mt-4 space-y-1.5 lg:space-y-2">
                                                {buildingSupply.length ? (
                                                    buildingSupply.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.hasBonus ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-gray-800/60 bg-gray-900/60'} p-2 lg:p-3`}
                                                        >
                                                            <div>
                                                                <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                <p className="text-[10px] lg:text-xs text-gray-500">{item.formula}</p>
                                                                {item.mods && item.mods.length > 0 && (
                                                                    <p className="text-[9px] text-emerald-400">{item.mods.join(' · ')}</p>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm lg:text-base font-bold text-emerald-200">{formatAmount(item.amount)}</p>
                                                                {/* {item.isActual && item.id !== 'import' && (
                                                                    <p className="text-[9px] text-emerald-400">实际产出</p>
                                                                )} */}
                                                                {/* {item.hasBonus && !item.isActual && (
                                                                    <p className="text-[9px] text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
                                                                )} */}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs lg:text-sm text-gray-500">暂无建筑供给</p>
                                                )}
                                            </div>
                                            {stratumEfficiencyWarnings.length > 0 && (
                                                <div className="mt-3 rounded-lg lg:rounded-xl border border-amber-600/30 bg-amber-500/5 p-2.5 lg:p-4">
                                                    <div className="flex items-center gap-2 text-amber-200 text-[10px] lg:text-xs font-semibold">
                                                        <Icon name="AlertTriangle" size={14} className="text-amber-300" />
                                                        劳动效率预警
                                                    </div>
                                                    <div className="mt-2 space-y-2">
                                                        {stratumEfficiencyWarnings.map(warning => (
                                                            <div key={warning.key} className="flex items-start justify-between gap-2">
                                                                <div className="flex items-start gap-2">
                                                                    <div className="rounded-lg bg-amber-400/10 border border-amber-400/30 p-1.5">
                                                                        <Icon name={warning.icon} size={14} className="text-amber-200" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs lg:text-sm font-semibold text-amber-100">{warning.name}</p>
                                                                        {warning.desc && (
                                                                            <p className="text-[10px] text-gray-400">{warning.desc}</p>
                                                                        )}
                                                                        {warning.shortages.length > 0 && (
                                                                            <p className="text-[10px] text-amber-200/80 mt-0.5">
                                                                                需求缺口：{warning.shortages.join('、')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm lg:text-base font-semibold text-amber-200">
                                                                        {warning.penaltyPercent}%
                                                                    </p>
                                                                    <p className="text-[9px] text-gray-500">生产惩罚</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-2 lg:mt-4 rounded-lg lg:rounded-xl border border-gray-800/60 bg-gray-900/60 p-2.5 lg:p-4 text-xs lg:text-sm text-gray-400">
                                                理论产能 {formatAmount(totalTheoreticalSupply)} · 理论需求 {formatAmount(totalActualDemand)} · 理论缺口{' '}
                                                {formatAmount(Math.max(0, totalActualDemand - totalTheoreticalSupply))}
                                                {(totalBaseSupply !== totalTheoreticalSupply || totalBaseDemand !== totalActualDemand) && (
                                                    <span className="text-gray-500 ml-2">
                                                        | 无加成: {formatAmount(totalBaseSupply)} / {formatAmount(totalBaseDemand)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'chain' && (
                                    <DynamicChainView resourceKey={resourceKey} buildings={buildings} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export const ResourceDetailModal = (props) => {
    return createPortal(
        <AnimatePresence>
            {(props.resourceKey && RESOURCES[props.resourceKey]) && (
                <ResourceDetailContent {...props} key="content" />
            )}
        </AnimatePresence>,
        document.body
    );
};
