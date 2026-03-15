// 资源详情模态框
// 展示库存、市场趋势以及可视化的产业链信息

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { RESOURCES, STRATA, BUILDINGS, UNIT_TYPES } from '../../config';
import { calculateLuxuryConsumptionMultiplier, calculateUnlockMultiplier, getSimpleLivingStandard } from '../../utils/livingStandard';
import { getAvailableResourceSet, isResourceDemandActive } from '../../utils/resources';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { getSimpleSupplyChain } from '../../utils/resourceGraph';

const formatAmount = (value) => {
    if (!Number.isFinite(value) || value === 0) return '0';
    return formatNumberShortCN(value, { decimals: 1 });
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

// --- 产业链可视化组件 (链条主体版) ---

// 资源标签映射
const TAG_MAP = {
    'essential': '生活必需', 'raw_material': '原材料', 'industrial': '工业资材',
    'manufactured': '制成品', 'luxury': '奢侈品', 'currency': '货币',
    'special': '特殊资源', 'basic_need': '基本需求', 'luxury_need': '奢侈需求',
    'construction': '建材', 'military': '军用', 'strategic': '战略',
    'refined': '加工品', 'raw': '原材料', 'food': '食物',
    'intermediate': '中间品', 'energy': '能源',
};

// --- 新版产业链视图：以资源为锚点的上下游卡片 ---

/** 角色标签配置 */
const ROLE_CONFIG = {
    source: { label: '原材料', color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/25', icon: 'Pickaxe' },
    intermediate: { label: '中间品', color: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-500/25', icon: 'Cog' },
    product: { label: '产出品', color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-500/25', icon: 'Package' },
    consumed: { label: '被消费', color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-500/25', icon: 'Users' },
};

/** 分析资源在单条产业链中的角色 */
const getResourceRole = (chain, resourceKey) => {
    let isSource = false, isIntermediate = false, isProduct = false, isConsumed = false;
    for (const stage of chain.stages) {
        const inputs = ensureArray(stage.input);
        const outputs = ensureArray(stage.output);
        const inInput = inputs.includes(resourceKey);
        const inOutput = outputs.includes(resourceKey);
        if (inOutput && (stage.stage === 'extraction' || stage.stage === 'primitive')) isSource = true;
        if (inOutput && (stage.stage === 'processing' || stage.stage === 'advanced')) isProduct = true;
        if (inInput && stage.stage === 'consumption') isConsumed = true;
        if (inInput && stage.stage !== 'consumption') isIntermediate = true;
    }
    // 优先级: source > intermediate > product > consumed
    if (isSource) return 'source';
    if (isIntermediate) return 'intermediate';
    if (isProduct) return 'product';
    if (isConsumed) return 'consumed';
    return 'intermediate';
};

/** 渲染资源小标签（带图标和名称） */
const ResourceChip = ({ rk, isCurrent = false, tiny = false }) => {
    const rd = RESOURCES[rk];
    if (!rd) return <span className="text-[10px] text-gray-500">{rk}</span>;
    if (isCurrent) return null; // 当前资源不在上下游中重复显示
    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border
            ${tiny ? 'text-[10px]' : 'text-[11px]'}
            bg-gray-900/60 border-white/8 text-ancient-parchment/90`}>
            <Icon name={rd.icon || 'Package'} size={tiny ? 11 : 13} className={rd.color || 'text-white'} />
            {rd.name}
        </span>
    );
};

/** 格式化建筑 ID 为友好名称（去下划线、首字母大写） */
const formatBuildingId = (bid) => {
    return bid.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/** 渲染建筑标签 */
const BuildingChip = ({ bid, count = 0 }) => {
    const bDef = BUILDINGS.find(b => b.id === bid);
    const name = bDef?.name || formatBuildingId(bid);
    const isUnknown = !bDef;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded border
            ${isUnknown
                ? 'border-red-700/30 text-red-400/70 bg-red-950/20'
                : count > 0
                    ? 'border-emerald-700/30 text-emerald-400/90 bg-emerald-950/30'
                    : 'border-gray-700/30 text-gray-500 bg-gray-900/30'}`}>
            <Icon name="Factory" size={10} className={isUnknown ? 'text-red-500/60' : count > 0 ? 'text-emerald-400/70' : 'text-gray-600'} />
            {name}{isUnknown && ' ⚠'}{count > 0 ? ` ×${count | 0}` : ''}
        </span>
    );
};

// --- 产业链流程图组件 ---

/** 构建产业链流程图的有向图结构 */
const buildChainFlowGraph = (chain, resourceKey, epoch) => {
    const stages = chain.stages;
    const nodes = [];
    const edges = [];
    // 收集所有涉及的资源（作为节点）
    const resourceSet = new Set();
    // 建立 stageIndex -> stage 映射
    const stageNodes = [];

    // 第一步：提取所有 stage 节点和涉及的资源
    stages.forEach((stage, idx) => {
        const inputs = ensureArray(stage.input);
        const outputs = ensureArray(stage.output);
        const inEpoch = !stage.epochRange || (epoch >= stage.epochRange[0] && epoch <= stage.epochRange[1]);
        const stageId = `stage_${idx}`;
        stageNodes.push({
            id: stageId,
            type: 'stage',
            data: stage,
            inEpoch,
            inputs,
            outputs,
        });
        inputs.forEach(r => resourceSet.add(r));
        outputs.forEach(r => resourceSet.add(r));
    });

    // 第二步：为每个资源创建资源节点
    const resourceNodes = {};
    resourceSet.forEach(rk => {
        const rd = RESOURCES[rk];
        const nodeId = `res_${rk}`;
        resourceNodes[rk] = {
            id: nodeId,
            type: 'resource',
            resourceKey: rk,
            data: rd,
            isCurrent: rk === resourceKey,
        };
    });

    // 第三步：建立边关系 (resource -> stage, stage -> resource)
    stageNodes.forEach(sn => {
        // 输入资源 → stage
        sn.inputs.forEach(rk => {
            if (resourceNodes[rk]) {
                edges.push({ from: resourceNodes[rk].id, to: sn.id });
            }
        });
        // stage → 输出资源
        sn.outputs.forEach(rk => {
            if (resourceNodes[rk]) {
                edges.push({ from: sn.id, to: resourceNodes[rk].id });
            }
        });
    });

    // 第四步：拓扑排序分配列
    const allNodes = [
        ...Object.values(resourceNodes),
        ...stageNodes.map(sn => ({ id: sn.id, type: sn.type, data: sn.data, inEpoch: sn.inEpoch, inputs: sn.inputs, outputs: sn.outputs })),
    ];
    const nodeMap = {};
    allNodes.forEach(n => { nodeMap[n.id] = { ...n, column: 0, row: 0 }; });

    // 计算入度和邻接表
    const inDegree = {};
    const adj = {};
    allNodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
    edges.forEach(e => {
        if (inDegree[e.to] !== undefined) inDegree[e.to]++;
        if (adj[e.from]) adj[e.from].push(e.to);
    });

    // BFS拓扑排序
    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const order = [];
    const visited = new Set();
    while (queue.length > 0) {
        const curr = queue.shift();
        if (visited.has(curr)) continue;
        visited.add(curr);
        order.push(curr);
        (adj[curr] || []).forEach(next => {
            if (nodeMap[next]) {
                nodeMap[next].column = Math.max(nodeMap[next].column, (nodeMap[curr]?.column || 0) + 1);
            }
            inDegree[next]--;
            if (inDegree[next] <= 0 && !visited.has(next)) queue.push(next);
        });
    }
    // 处理未访问到的节点（循环依赖等边缘情况）
    allNodes.forEach(n => {
        if (!visited.has(n.id)) {
            nodeMap[n.id].column = 0;
        }
    });

    // ── 路径裁剪：只保留经过当前资源的上下游路径 ──
    const currentNodeId = `res_${resourceKey}`;
    if (nodeMap[currentNodeId]) {
        // 构建反向邻接表
        const reverseAdj = {};
        allNodes.forEach(n => { reverseAdj[n.id] = []; });
        edges.forEach(e => {
            if (reverseAdj[e.to]) reverseAdj[e.to].push(e.from);
        });

        // BFS 向下游（正向）收集可达节点
        const downstream = new Set();
        const dQueue = [currentNodeId];
        while (dQueue.length > 0) {
            const cur = dQueue.shift();
            if (downstream.has(cur)) continue;
            downstream.add(cur);
            (adj[cur] || []).forEach(next => {
                if (!downstream.has(next)) dQueue.push(next);
            });
        }

        // BFS 向上游（反向）收集可达节点
        const upstream = new Set();
        const uQueue = [currentNodeId];
        while (uQueue.length > 0) {
            const cur = uQueue.shift();
            if (upstream.has(cur)) continue;
            upstream.add(cur);
            (reverseAdj[cur] || []).forEach(prev => {
                if (!upstream.has(prev)) uQueue.push(prev);
            });
        }

        // 合并：只保留上游 ∪ 下游 中的节点
        const reachable = new Set([...upstream, ...downstream]);

        // 移除不可达节点
        Object.keys(nodeMap).forEach(id => {
            if (!reachable.has(id)) delete nodeMap[id];
        });

        // 过滤不可达边
        for (let i = edges.length - 1; i >= 0; i--) {
            if (!reachable.has(edges[i].from) || !reachable.has(edges[i].to)) {
                edges.splice(i, 1);
            }
        }
    }

    // 第五步：重新紧凑化列号（裁剪后可能有空列）
    const usedCols = new Set(Object.values(nodeMap).map(n => n.column));
    const sortedCols = [...usedCols].sort((a, b) => a - b);
    const colRemap = {};
    sortedCols.forEach((col, idx) => { colRemap[col] = idx; });
    Object.values(nodeMap).forEach(n => { n.column = colRemap[n.column] ?? n.column; });

    // 第六步：按列分配行
    const columnGroups = {};
    Object.values(nodeMap).forEach(n => {
        if (!columnGroups[n.column]) columnGroups[n.column] = [];
        columnGroups[n.column].push(n);
    });
    Object.values(columnGroups).forEach(group => {
        // 当前资源节点排在前面
        group.sort((a, b) => {
            if (a.isCurrent) return -1;
            if (b.isCurrent) return 1;
            return 0;
        });
        group.forEach((n, idx) => { n.row = idx; });
    });

    const maxCol = Math.max(0, ...Object.values(nodeMap).map(n => n.column));
    const maxRow = Math.max(0, ...Object.values(nodeMap).map(n => n.row));

    return {
        nodes: Object.values(nodeMap),
        edges,
        maxCol,
        maxRow,
        resourceNodes,
        stageNodes: stageNodes.map(sn => nodeMap[sn.id]).filter(Boolean),
    };
};

/** 消费者/用途标签中文映射（非阶层类 consumer 值） */
const CONSUMER_LABEL_MAP = {
    all_classes: '全民消费',
    military: '军事', buildings: '建筑', machinery: '机械',
    ships: '船舶', tools: '工具',
    defense: '防御', conquest: '征伐', patrol: '巡逻',
    education: '教育', research: '研究',
    industry: '工业', civic: '民用', consumer: '消费品',
    agriculture: '农业',
};

/** 将 consumer ID 转为中文显示 */
const getConsumerLabel = (c) => CONSUMER_LABEL_MAP[c] || STRATA[c]?.name || formatBuildingId(c);

/** 将资源 ID 转为中文友好名（兜底 RESOURCES 中找不到的虚拟资源） */
const RESOURCE_ALIAS = {
    military_power: '军事力量',
};
const getResourceName = (rk, rd) => rd?.name || RESOURCE_ALIAS[rk] || formatBuildingId(rk);

/** 流程图节点组件 */
const FlowNode = ({ node, buildingCounts = {}, compact = false }) => {
    if (node.type === 'resource') {
        // 资源节点：圆形
        const rd = node.data;
        const isCurrent = node.isCurrent;
        return (
            <div className={`flex ${compact ? 'flex-row gap-1.5 px-1.5 py-1' : 'flex-col gap-1 p-1.5'} items-center rounded-xl border transition-all
                hover:brightness-110 hover:border-ancient-gold/40
                ${isCurrent
                    ? 'border-ancient-gold/50 bg-ancient-gold/10 shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                    : 'border-white/10 bg-gray-900/50'}`}
                style={{ minWidth: compact ? '56px' : '72px' }}>
                <div className={`${compact ? 'w-6 h-6' : 'w-9 h-9'} rounded-full flex items-center justify-center flex-shrink-0
                    ${isCurrent
                        ? 'bg-ancient-ink border-2 border-ancient-gold/60'
                        : 'bg-gray-800 border border-white/15'}`}>
                    <Icon name={rd?.icon || 'Package'} size={compact ? 12 : 18} className={rd?.color || 'text-white'} />
                </div>
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-medium text-center leading-tight
                    ${isCurrent ? 'text-ancient-gold' : 'text-ancient-parchment/80'}`}>
                    {getResourceName(node.resourceKey, rd)}
                </span>
            </div>
        );
    }

    // 阶段节点：精简标签样式，辅助信息悬浮显示
    const stage = node.data;
    const inEpoch = node.inEpoch;
    const buildings = stage?.buildings || [];
    const consumers = stage?.consumers;
    // 获取建筑信息用于 tooltip
    const buildingDefs = buildings.map(bid => BUILDINGS.find(b => b.id === bid)).filter(Boolean);
    const hasTooltipContent = consumers || buildingDefs.length > 0;

    const [showTip, setShowTip] = React.useState(false);

    return (
        <div
            className={`relative flex flex-col items-center gap-0.5 ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-lg border transition-all
            ${hasTooltipContent ? 'cursor-pointer' : ''}
            hover:brightness-110 hover:border-ancient-gold/40
            ${!inEpoch ? 'opacity-40 border-white/5 bg-gray-900/20' : 'border-white/10 bg-gray-900/50'}`}
            style={{ minWidth: compact ? '50px' : '64px', maxWidth: compact ? '100px' : '120px' }}
            onClick={() => hasTooltipContent && setShowTip(v => !v)}
            onMouseEnter={() => hasTooltipContent && setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
        >
            <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium text-ancient-parchment leading-tight text-center`}>{stage?.name}</span>
            {!inEpoch && stage?.epochRange && (
                <span className="text-[9px] text-gray-500">时代 {stage.epochRange[0]}-{stage.epochRange[1]}</span>
            )}
            {/* 悬浮/点击 tooltip */}
            {showTip && hasTooltipContent && (
                <div className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 min-w-[90px] max-w-[160px]
                    rounded-lg border border-ancient-gold/25 bg-gray-900/95 backdrop-blur-sm shadow-lg p-1.5
                    pointer-events-none animate-in fade-in duration-150">
                    {buildingDefs.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                            {buildingDefs.map(bd => (
                                <span key={bd.id} className="text-[9px] text-gray-400 leading-tight flex items-center gap-0.5">
                                    <Icon name="Factory" size={8} className="text-gray-500 flex-shrink-0" />
                                    {bd.name}
                                </span>
                            ))}
                        </div>
                    )}
                    {consumers && (
                        <span className="text-[9px] text-rose-300/70 leading-tight flex items-center gap-0.5 mt-0.5">
                            <Icon name="Users" size={8} className="text-rose-400/60 flex-shrink-0" />
                            {consumers.includes('all_classes') ? '全民消费' : consumers.map(c => getConsumerLabel(c)).join('、')}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/** 流程图连接箭头 SVG（含边上建筑名标签） */
const FlowArrows = ({ edges, nodePositions, containerRef, vertical = false, edgeBuildingMap = {} }) => {
    // 使用 SVG overlay 绘制连接线
    if (!containerRef?.current || !nodePositions || Object.keys(nodePositions).length === 0) return null;

    return (
        <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
            <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="rgba(212,175,55,0.4)" />
                </marker>
            </defs>
            {edges.map((edge, idx) => {
                const fromPos = nodePositions[edge.from];
                const toPos = nodePositions[edge.to];
                if (!fromPos || !toPos) return null;

                // 查找边上的建筑名
                const edgeKey = `${edge.from}->${edge.to}`;
                const buildingNames = edgeBuildingMap[edgeKey] || (edge.buildings || []).map(b => b.name).filter(Boolean);
                // 最多显示2个建筑名，多余的用+N表示
                const displayNames = buildingNames.slice(0, 2);
                const extraCount = buildingNames.length - 2;
                const labelText = displayNames.length > 0
                    ? displayNames.join('、') + (extraCount > 0 ? ` +${extraCount}` : '')
                    : '';

                if (vertical) {
                    const x1 = fromPos.centerX;
                    const y1 = fromPos.bottom;
                    const x2 = toPos.centerX;
                    const y2 = toPos.top;
                    const midY = (y1 + y2) / 2;
                    const midX = (x1 + x2) / 2;

                    return (
                        <g key={idx}>
                            <path
                                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                                stroke="rgba(212,175,55,0.25)"
                                strokeWidth="1.5"
                                fill="none"
                                markerEnd="url(#arrowhead)"
                            />
                            {labelText && (
                                <text
                                    x={midX}
                                    y={midY - 4}
                                    fill="rgba(212,175,55,0.5)"
                                    fontSize="8"
                                    textAnchor="middle"
                                    dominantBaseline="auto"
                                >
                                    {labelText}
                                </text>
                            )}
                        </g>
                    );
                } else {
                    const x1 = fromPos.right;
                    const y1 = fromPos.centerY;
                    const x2 = toPos.left;
                    const y2 = toPos.centerY;
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;

                    return (
                        <g key={idx}>
                            <path
                                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                                stroke="rgba(212,175,55,0.25)"
                                strokeWidth="1.5"
                                fill="none"
                                markerEnd="url(#arrowhead)"
                            />
                            {labelText && (
                                <text
                                    x={midX}
                                    y={midY - 5}
                                    fill="rgba(212,175,55,0.5)"
                                    fontSize="8"
                                    textAnchor="middle"
                                    dominantBaseline="auto"
                                >
                                    {labelText}
                                </text>
                            )}
                        </g>
                    );
                }
            })}
        </svg>
    );
};

/** 横向/纵向自适应流程图容器组件 (自动生成版) */
const AutoChainFlowGraph = ({ graph, resourceKey, buildingCounts = {} }) => {
    const containerRef = React.useRef(null);
    const [nodePositions, setNodePositions] = React.useState({});
    const nodeRefs = React.useRef({});
    const [isVertical, setIsVertical] = React.useState(false);

    // Detect narrow viewport for vertical layout
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)');
        const handler = (e) => setIsVertical(e.matches);
        handler(mq); // init
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // 渲染完成后测量节点位置
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const positions = {};
            Object.entries(nodeRefs.current).forEach(([nodeId, el]) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                positions[nodeId] = {
                    left: rect.left - containerRect.left,
                    right: rect.right - containerRect.left,
                    top: rect.top - containerRect.top,
                    bottom: rect.bottom - containerRect.top,
                    centerX: (rect.left + rect.right) / 2 - containerRect.left,
                    centerY: (rect.top + rect.bottom) / 2 - containerRect.top,
                };
            });
            setNodePositions(positions);
        }, 80);
        return () => clearTimeout(timer);
    }, [graph, isVertical]);

    // 按列分组
    const columns = useMemo(() => {
        const cols = {};
        graph.nodes.forEach(n => {
            if (!cols[n.column]) cols[n.column] = [];
            cols[n.column].push(n);
        });
        Object.values(cols).forEach(col => col.sort((a, b) => a.row - b.row));
        return cols;
    }, [graph]);

    // 构建边上建筑名称查找表
    const edgeBuildingMap = useMemo(() => {
        const map = {};
        graph.edges.forEach(e => {
            const key = `${e.from}->${e.to}`;
            map[key] = (e.buildings || []).map(b => b.name).filter(Boolean);
        });
        return map;
    }, [graph]);

    const colCount = graph.maxCol + 1;

    if (!graph.nodes.length) return null;

    return (
        <div className="rounded-xl border border-ancient-gold/12 bg-gray-950/50 overflow-hidden">
            {/* 流程图区域 */}
            {isVertical ? (
                /* ── 纵向布局（移动端）── */
                <div ref={containerRef} className="relative p-3 pt-4">
                    <FlowArrows edges={graph.edges} nodePositions={nodePositions} containerRef={containerRef} vertical edgeBuildingMap={edgeBuildingMap} />
                    <div className="flex flex-col gap-3">
                        {Array.from({ length: colCount }, (_, colIdx) => {
                            const nodesInCol = columns[colIdx] || [];
                            if (!nodesInCol.length) return null;
                            return (
                                <div key={colIdx} className="flex flex-wrap items-start gap-2 justify-center">
                                    {nodesInCol.map(node => (
                                        <div
                                            key={node.id}
                                            ref={el => { nodeRefs.current[node.id] = el; }}
                                        >
                                            <FlowNode node={node} buildingCounts={buildingCounts} compact />
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* ── 横向布局（桌面端）── */
                <div className="relative">
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-950/80 to-transparent z-10 pointer-events-none" />
                    <div
                        ref={containerRef}
                        className="relative overflow-x-auto p-3"
                        style={{ minWidth: `${Math.max(320, colCount * 130)}px` }}
                    >
                        <FlowArrows edges={graph.edges} nodePositions={nodePositions} containerRef={containerRef} edgeBuildingMap={edgeBuildingMap} />
                        <div className="flex items-start gap-3" style={{ minWidth: 'fit-content' }}>
                            {Array.from({ length: colCount }, (_, colIdx) => (
                                <div key={colIdx} className="flex flex-col items-center gap-2 flex-shrink-0">
                                    {(columns[colIdx] || []).map(node => (
                                        <div
                                            key={node.id}
                                            ref={el => { nodeRefs.current[node.id] = el; }}
                                        >
                                            <FlowNode node={node} buildingCounts={buildingCounts} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/** Building IO card — shows a building's inputs→outputs with the current resource highlighted */
const BuildingIOCard = ({ building, resourceKey, currentBuildingCount = 0, side = 'producer' }) => {
    const rd = RESOURCES[resourceKey];
    const isProducer = side === 'producer';
    // The "other" resources: for a producer, show its inputs; for a consumer, show its other inputs (co-inputs)
    const otherKeys = isProducer
        ? building.inputs.filter(rk => rk !== resourceKey)
        : building.inputs.filter(rk => rk !== resourceKey);
    // Resources on the "same side" as current resource: for a producer, show co-outputs; for a consumer, show outputs
    const sameKeys = isProducer
        ? building.outputs.filter(rk => rk !== resourceKey)
        : building.outputs.filter(rk => rk !== resourceKey);

    const isUnlocked = currentBuildingCount > 0;

    return (
        <div className={`rounded-lg border p-2 transition-all ${
            isUnlocked
                ? 'border-ancient-gold/20 bg-gray-900/60'
                : 'border-white/5 bg-gray-950/40 opacity-60'
        }`}>
            {/* Building name + count */}
            <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Icon name="Factory" size={11} className={isUnlocked ? 'text-ancient-gold/70' : 'text-gray-600'} />
                    <span className={`text-[11px] font-medium truncate ${
                        isUnlocked ? 'text-ancient-parchment' : 'text-gray-500'
                    }`}>
                        {building.name}
                    </span>
                </div>
                {currentBuildingCount > 0 && (
                    <span className="text-[9px] text-emerald-400/80 bg-emerald-950/40 px-1 py-0.5 rounded flex-shrink-0">
                        ×{currentBuildingCount}
                    </span>
                )}
            </div>
            {/* IO flow: inputs → [building] → outputs */}
            <div className="flex items-center gap-1">
                {isProducer ? (
                    <>
                        {/* Producer: inputs → current resource → co-outputs */}
                        {/* Left side: inputs */}
                        <div className="flex flex-wrap gap-0.5 flex-1 min-w-0">
                            {otherKeys.map(rk => (
                                <ResourceChip key={rk} rk={rk} tiny />
                            ))}
                        </div>
                        {/* Arrow */}
                        <Icon name="ArrowRight" size={10} className="text-gray-600 flex-shrink-0" />
                        {/* Right side: current resource + co-outputs */}
                        <div className="flex flex-wrap gap-0.5 flex-1 min-w-0 items-center justify-end">
                            {/* Current resource (highlighted) */}
                            <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 border text-[10px]
                                bg-ancient-gold/10 border-ancient-gold/30 text-ancient-gold flex-shrink-0">
                                <Icon name={rd?.icon || 'Package'} size={11} className={rd?.color || 'text-ancient-gold'} />
                                {rd?.name || resourceKey}
                            </span>
                            {/* Co-outputs */}
                            {sameKeys.length > 0 && (
                                <>
                                    <span className="text-[9px] text-gray-600 flex-shrink-0">+</span>
                                    {sameKeys.slice(0, 3).map(rk => (
                                        <ResourceChip key={rk} rk={rk} tiny />
                                    ))}
                                    {sameKeys.length > 3 && (
                                        <span className="text-[9px] text-gray-500">+{sameKeys.length - 3}</span>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Consumer: current resource + co-inputs → outputs */}
                        {/* Left side: current resource + co-inputs */}
                        <div className="flex flex-wrap gap-0.5 flex-1 min-w-0 items-center">
                            {/* Current resource (highlighted) - being consumed */}
                            <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 border text-[10px]
                                bg-ancient-gold/10 border-ancient-gold/30 text-ancient-gold flex-shrink-0">
                                <Icon name={rd?.icon || 'Package'} size={11} className={rd?.color || 'text-ancient-gold'} />
                                {rd?.name || resourceKey}
                            </span>
                            {/* Co-inputs (other inputs besides current resource) */}
                            {otherKeys.length > 0 && (
                                <>
                                    <span className="text-[9px] text-gray-600 flex-shrink-0">+</span>
                                    {otherKeys.slice(0, 3).map(rk => (
                                        <ResourceChip key={rk} rk={rk} tiny />
                                    ))}
                                    {otherKeys.length > 3 && (
                                        <span className="text-[9px] text-gray-500">+{otherKeys.length - 3}</span>
                                    )}
                                </>
                            )}
                        </div>
                        {/* Arrow */}
                        <Icon name="ArrowRight" size={10} className="text-gray-600 flex-shrink-0" />
                        {/* Right side: outputs */}
                        <div className="flex flex-wrap gap-0.5 flex-1 min-w-0 justify-end">
                            {sameKeys.map(rk => (
                                <ResourceChip key={rk} rk={rk} tiny />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/** 产业链主视图 — 简化版：直接展示上下游建筑 */
const DynamicChainView = ({ resourceKey, buildings = {}, epoch = 0 }) => {
    const resourceDef = RESOURCES[resourceKey];

    // Directly query which buildings produce/consume this resource
    const { producers, consumers } = useMemo(() => {
        return getSimpleSupplyChain(resourceKey, epoch);
    }, [resourceKey, epoch]);

    const hasRelations = producers.length > 0 || consumers.length > 0;

    return (
        <div className="space-y-3">
            {/* Resource header */}
            <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 rounded-lg bg-ancient-ink border border-ancient-gold/40 flex items-center justify-center shadow-[0_0_10px_-3px_rgba(212,175,55,0.25)]">
                    <Icon name={resourceDef?.icon || 'Package'} size={20} className={resourceDef?.color || 'text-white'} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-ancient-gold truncate">{resourceDef?.name} 的产业链</h3>
                    <p className="text-[10px] text-ancient-stone truncate">
                        {(resourceDef?.tags || []).map(t => TAG_MAP[t] || t).join(' · ') || '资源'}
                        {hasRelations && (
                            <span className="ml-2 text-gray-500">
                                | {producers.length} 种生产 · {consumers.length} 种消耗
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {hasRelations ? (
                <div className="space-y-3">
                    {/* Producers — buildings that OUTPUT this resource */}
                    {producers.length > 0 && (
                        <div className="rounded-xl border border-ancient-gold/12 bg-gray-950/50 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/30 border-b border-emerald-500/10">
                                <Icon name="ArrowDownToLine" size={12} className="text-emerald-400/70" />
                                <span className="text-[11px] font-bold text-emerald-300/90">生产来源</span>
                                <span className="text-[10px] text-gray-500">哪些建筑产出此资源</span>
                            </div>
                            <div className="p-2 space-y-1.5">
                                {producers.map(b => (
                                    <BuildingIOCard
                                        key={b.id}
                                        building={b}
                                        resourceKey={resourceKey}
                                        currentBuildingCount={buildings[b.id] || 0}
                                        side="producer"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Consumers — buildings that INPUT this resource */}
                    {consumers.length > 0 && (
                        <div className="rounded-xl border border-ancient-gold/12 bg-gray-950/50 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/30 border-b border-amber-500/10">
                                <Icon name="ArrowUpFromLine" size={12} className="text-amber-400/70" />
                                <span className="text-[11px] font-bold text-amber-300/90">消耗去向</span>
                                <span className="text-[10px] text-gray-500">哪些建筑消耗此资源</span>
                            </div>
                            <div className="p-2 space-y-1.5">
                                {consumers.map(b => (
                                    <BuildingIOCard
                                        key={b.id}
                                        building={b}
                                        resourceKey={resourceKey}
                                        currentBuildingCount={buildings[b.id] || 0}
                                        side="consumer"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-xs text-gray-500 italic text-center">
                    暂无相关建筑产出或消耗此资源
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
    treasuryChangeLog = [],
    daysElapsed = 0,
    epoch = 0,
    techsUnlocked = [],
    onClose,
    taxPolicies,
    onUpdateTaxPolicies,
    activeDebuffs = [],
    buildingFinancialData = {},
    economicIndicators = {}, // 新增：经济指标数据
}) => {
    const [activeTab, setActiveTab] = useState(TAB_OPTIONS[0].id);
    const [showEconomicDetails, setShowEconomicDetails] = useState(false); // 新增：经济指标详情折叠状态
    // Removed isAnimatingOut as framer-motion handles it
    const resourceDef = RESOURCES[resourceKey];
    const isSilver = resourceKey === 'silver';
    const availableResources = useMemo(() => getAvailableResourceSet(buildings), [buildings]);

    const priceHistoryData = useMemo(() => {
        const history = market?.priceHistory?.[resourceKey];
        return history ? [...history] : [];
    }, [market, resourceKey]);

    const [draftTaxRate, setDraftTaxRate] = useState(null);
    const [draftImportTariff, setDraftImportTariff] = useState(null);
    const [draftExportTariff, setDraftExportTariff] = useState(null);

    const currentTaxRate = taxPolicies?.resourceTaxRates?.[resourceKey] ?? 0;
    // 进口/出口关税（向后兼容旧的resourceTariffMultipliers）
    // 关税存储为小数（0=无关税，0.5=50%关税，<0=补贴）
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
        const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100; // 百分数转小数
        onUpdateTaxPolicies(prev => ({
            ...prev,
            importTariffMultipliers: {
                ...(prev?.importTariffMultipliers || {}),
                [resourceKey]: rateValue,
            },
        }));
        setDraftImportTariff(null);
    };

    const commitExportTariffDraft = () => {
        if (draftExportTariff === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftExportTariff);
        const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100; // 百分数转小数
        onUpdateTaxPolicies(prev => ({
            ...prev,
            exportTariffMultipliers: {
                ...(prev?.exportTariffMultipliers || {}),
                [resourceKey]: rateValue,
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
        tradeDemand,
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
                tradeDemand: [],
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
                if (baseNeeds[resKey] && isResourceDemandActive(resKey, epoch, techsUnlocked, availableResources)) {
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
                            if (!isResourceDemandActive(resKey, epoch, techsUnlocked, availableResources)) {
                                continue;
                            }
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

        const warProductionPenalty = sources.frontlineProductionPenalty || 0;

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
            // [修复] 使用实际产出数据，如果没有数据(undefined)才回退到理论值
            // 当建筑因为某些原因（如业主财富不足）停产时，实际产出应显示为0或真实值，而非理论值
            const actualAmount = realProduction !== undefined ? realProduction : theoreticalAmount;

            actualSupplyTotal += actualAmount;
            theoreticalSupplyTotal += theoreticalAmount;

            const modList = [];
            if (techBuildingPct !== 0) modList.push(`科技 +${(techBuildingPct * 100).toFixed(0)}%`);
            if (eventBuildingPct !== 0) modList.push(`事件 +${(eventBuildingPct * 100).toFixed(0)}%`);
            if (techCategoryPct !== 0) modList.push(`类别科技 +${(techCategoryPct * 100).toFixed(0)}%`);
            if (eventCategoryPct !== 0) modList.push(`类别事件 +${(eventCategoryPct * 100).toFixed(0)}%`);
            // 战争减产：前线产出惩罚
            if (warProductionPenalty > 0.001) {
                modList.push(`⚔️前线减产 -${(warProductionPenalty * 100).toFixed(0)}%`);
            }

            // 获取减产信息
            const finance = buildingFinancialData[building.id];
            const reductionReasons = finance?.reductionReasons || [];
            const productionEfficiency = finance?.productionEfficiency ?? 1;
            const isReduced = actualAmount < theoreticalAmount * 0.99 && theoreticalAmount > 0;

            const formulaText = perBuilding > 0
                ? `${count} 座`
                : '来自建筑升级';

            acc.push({
                id: building.id,
                name: building.name,
                baseAmount,
                theoreticalAmount,
                amount: actualAmount,
                isActual: realProduction !== undefined,
                formula: formulaText,
                mods: modList,
                hasBonus: actualAmount !== baseAmount,
                isReduced,
                reductionReasons,
                productionEfficiency,
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

        // NEW: Add Export as a demand source
        const tradeDemandList = [];
        const exportAmount = demandBreakdown[resourceKey]?.exports || 0;
        if (exportAmount > 0) {
            tradeDemandList.push({
                id: 'export',
                name: '国际贸易',
                baseAmount: 0,
                amount: exportAmount,
                formula: '商人出口',
                hasBonus: false,
            });
            actualDemandTotal += exportAmount;
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
            tradeDemand: tradeDemandList,
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
    const treasuryEntries = Array.isArray(treasuryChangeLog) ? treasuryChangeLog : [];
    const fiscalDay = useMemo(() => {
        if (!treasuryEntries.length) return null;
        const currentDay = Number.isFinite(daysElapsed) ? daysElapsed : 0;
        const tickDays = new Set();
        treasuryEntries.forEach((entry) => {
            if (!Number.isFinite(entry?.day)) return;
            const source = entry?.meta?.source;
            if (source && source !== 'action') {
                tickDays.add(entry.day);
            }
            if (!source && entry?.reason === 'tick_update') {
                tickDays.add(entry.day);
            }
        });
        if (tickDays.has(currentDay)) return currentDay;
        if (tickDays.has(currentDay - 1)) return currentDay - 1;
        return null;
    }, [treasuryEntries, daysElapsed]);
    const fiscalTreasuryEntries = useMemo(
        () => (fiscalDay === null ? [] : treasuryEntries.filter(entry => entry?.day === fiscalDay)),
        [treasuryEntries, fiscalDay]
    );
    const actualTreasuryEntries = useMemo(
        () => fiscalTreasuryEntries.filter(entry => entry?.meta?.source !== 'action'),
        [fiscalTreasuryEntries]
    );
    const actualTreasuryIncome = useMemo(() => {
        return actualTreasuryEntries.reduce((sum, entry) => {
            const amount = Number(entry?.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) return sum;
            return sum + amount;
        }, 0);
    }, [actualTreasuryEntries]);
    const hasActualTreasury = actualTreasuryEntries.length > 0;
    const displayedTreasuryIncome = hasActualTreasury ? actualTreasuryIncome : latestTax;
    const treasuryIncomeLabel = hasActualTreasury ? '国库收入统计' : '国库收入估算';

    // totalActualDemand 和 totalActualSupply 直接从 useMemo 中解构使用

    const inventory = resources[resourceKey] || 0;
    const marketSupply = market?.supply?.[resourceKey] || 0;
    const marketDemand = market?.demand?.[resourceKey] || 0;
    const marketLoss = market?.resourceLossBreakdown?.[resourceKey] || 0;
    const marketPrice = market?.prices?.[resourceKey] ?? resourceDef.basePrice ?? 0;
    const priceTrend =
        priceHistoryData.length >= 2
            ? priceHistoryData[priceHistoryData.length - 1] - priceHistoryData[priceHistoryData.length - 2]
            : 0;

    const latestSupply = supplyHistoryData[supplyHistoryData.length - 1] ?? marketSupply;
    const latestDemand = demandHistoryData[demandHistoryData.length - 1] ?? marketDemand;
    const latestLoss = marketLoss;
    const activeTabMeta = TAB_OPTIONS.find(tab => tab.id === activeTab);
    const isElectricity = resourceKey === 'electricity';

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
                className="relative w-full max-w-6xl glass-epic border-t-2 lg:border-2 border-ancient-gold/30 rounded-t-2xl lg:rounded-xl shadow-metal-xl flex flex-col max-h-[90vh] overflow-hidden"
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
                            <p className="text-xs lg:text-xs text-gray-400 leading-tight truncate">
                                库存 {formatAmount(inventory)} {isSilver ? '· 财政资源' : `· 价格 ${marketPrice.toFixed(2)}`}
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
                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-yellow-300/80 leading-none">国库银币</p>
                                    <p className="mt-1 text-base lg:text-lg font-bold text-yellow-200 font-mono leading-none">{formatAmount(latestTreasury)}</p>
                                    <p className="mt-0.5 lg:mt-1 text-xs lg:text-xs text-yellow-200/80 leading-none">
                                        储备 {formatAmount(resources[resourceKey] || 0)}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 lg:p-2.5">
                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-emerald-300/80 leading-none">每日国库收入</p>
                                    <p className="mt-1 text-base lg:text-lg font-bold text-emerald-200 font-mono leading-none">
                                        {formatAmount(displayedTreasuryIncome)}
                                    </p>
                                    <p className="mt-0.5 lg:mt-1 text-xs lg:text-xs text-emerald-200/80 leading-none">{treasuryIncomeLabel}</p>
                                </div>
                            </div>

                            {/* 宏观经济指标 */}
                            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2 lg:p-2.5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs uppercase tracking-wide text-blue-300/80">
                                        宏观经济指标
                                    </p>
                                    <button
                                        onClick={() => setShowEconomicDetails(!showEconomicDetails)}
                                        className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                                    >
                                        {showEconomicDetails ? '收起' : '展开'}
                                    </button>
                                </div>
                                
                                {/* 核心指标 */}
                                <div className="grid gap-2 grid-cols-3">
                                    {/* GDP */}
                                    <div>
                                        <p className="text-xs text-gray-400">GDP</p>
                                        <p className="text-sm font-bold text-blue-200">
                                            {formatAmount(economicIndicators.gdp?.total || 0)}
                                        </p>
                                        <p className={`text-xs ${(economicIndicators.gdp?.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(economicIndicators.gdp?.change || 0) >= 0 ? '+' : ''}
                                            {(economicIndicators.gdp?.change || 0).toFixed(1)}%
                                        </p>
                                    </div>
                                    
                                    {/* CPI */}
                                    <div>
                                        <p className="text-xs text-gray-400">CPI</p>
                                        <p className="text-sm font-bold text-orange-200">
                                            {(economicIndicators.cpi?.index || 100).toFixed(1)}
                                        </p>
                                        <p className={`text-xs ${(economicIndicators.cpi?.change || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {(economicIndicators.cpi?.change || 0) >= 0 ? '+' : ''}
                                            {(economicIndicators.cpi?.change || 0).toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">基准: 90日均价</p>
                                    </div>
                                    
                                    {/* PPI */}
                                    <div>
                                        <p className="text-xs text-gray-400">PPI</p>
                                        <p className="text-sm font-bold text-purple-200">
                                            {(economicIndicators.ppi?.index || 100).toFixed(1)}
                                        </p>
                                        <p className={`text-xs ${(economicIndicators.ppi?.change || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {(economicIndicators.ppi?.change || 0) >= 0 ? '+' : ''}
                                            {(economicIndicators.ppi?.change || 0).toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">基准: 90日均价</p>
                                    </div>
                                </div>
                                
                                {/* 详细信息（可折叠） */}
                                {showEconomicDetails && (
                                    <div className="mt-2 space-y-2 border-t border-blue-500/20 pt-2">
                                        {/* GDP分解 */}
                                        <div className="text-xs">
                                            <p className="text-gray-400 mb-1 text-xs">GDP构成</p>
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">消费 (C)</span>
                                                    <span className="text-white text-xs">{formatAmount(economicIndicators.gdp?.consumption || 0)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">投资 (I)</span>
                                                    <span className="text-white text-xs">{formatAmount(economicIndicators.gdp?.investment || 0)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">政府支出 (G)</span>
                                                    <span className="text-white text-xs">{formatAmount(economicIndicators.gdp?.government || 0)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">净出口 (NX)</span>
                                                    <span className={`text-xs ${(economicIndicators.gdp?.netExports || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatAmount(economicIndicators.gdp?.netExports || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* CPI贡献度 */}
                                        <div className="text-xs">
                                            <p className="text-gray-400 mb-1 text-xs">CPI主要贡献</p>
                                            {Object.entries(economicIndicators.cpi?.breakdown || {})
                                                .sort((a, b) => Math.abs(b[1].contribution || 0) - Math.abs(a[1].contribution || 0))
                                                .slice(0, 3)
                                                .map(([resource, data]) => (
                                                    <div key={resource} className="flex justify-between">
                                                        <span className="text-gray-500 text-xs">{RESOURCES[resource]?.name || resource}</span>
                                                        <span className={`text-xs ${(data.contribution || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                            {(data.contribution || 0) > 0 ? '+' : ''}{(data.contribution || 0).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 交易税调整 */}
                            {!isSilver && onUpdateTaxPolicies && (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                                    <p className="text-xs uppercase tracking-wide text-emerald-300/80 leading-none mb-2">交易税调整</p>
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
                                            <p className="text-xs text-gray-400">
                                                对市场交易额征税。负数为补贴。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* 走势图 */}
                            <div className="space-y-1.5 lg:space-y-2">
                                <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2">
                                    <div className="mb-1.5 lg:mb-2 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 leading-none">国库资金走势</p>
                                            <p className="text-xs lg:text-sm font-semibold text-white leading-tight mt-0.5">
                                                当前 {formatAmount(resources[resourceKey] || 0)} 银币
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
                                            <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 leading-none">每日国库收入走势</p>
                                            <p className="text-xs lg:text-sm font-semibold text-white leading-tight mt-0.5">
                                                当前 {formatAmount(displayedTreasuryIncome)} / 日
                                            </p>
                                        </div>
                                        <Icon name="Activity" size={14} className="text-emerald-300" />
                                    </div>
                                    <SimpleLineChart
                                        data={taxHistory}
                                        color="#34d399"
                                        label="每日国库收入"
                                    />
                                </div>
                                
                                {/* 经济指标走势图 */}
                                <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-2">
                                    <div className="mb-1.5 lg:mb-2">
                                        <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 leading-none">
                                            经济指标走势
                                        </p>
                                    </div>
                                    <MarketTrendChart
                                        series={[
                                            { 
                                                label: 'GDP', 
                                                data: history.gdp || [], 
                                                color: '#60a5fa' 
                                            },
                                            { 
                                                label: 'CPI', 
                                                data: history.cpi || [], 
                                                color: '#fb923c' 
                                            },
                                            { 
                                                label: 'PPI', 
                                                data: history.ppi || [], 
                                                color: '#c084fc' 
                                            },
                                        ]}
                                        height={180}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col">
                            {/* 标签页 */}
                            <div className="px-2 lg:px-3 pt-1.5 lg:pt-2 flex-shrink-0">
                                <div className="flex items-center gap-2 text-xs lg:text-xs rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm overflow-x-auto">
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
                                    <p className="text-xs lg:text-xs text-gray-500 pb-1 leading-tight">{activeTabMeta.description}</p>
                                )}
                            </div>
                            <div className="flex-1 space-y-2 lg:space-y-3 p-2 lg:p-3 overflow-y-auto">
                                {isElectricity && (
                                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                                        <div className="flex items-start gap-2">
                                            <Icon name="Zap" size={16} className="mt-0.5 text-yellow-300" />
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-yellow-100">即时供能资源</p>
                                                    <p className="text-xs text-yellow-100/80">电力会在国内市场即时结算，库存上限很低，无法长期囤积，也不会参与对外贸易。</p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-center">
                                                        <p className="text-xs text-emerald-300/80">发电</p>
                                                        <p className="text-sm font-bold text-emerald-200">{formatAmount(latestSupply)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-2 text-center">
                                                        <p className="text-xs text-rose-300/80">用电</p>
                                                        <p className="text-sm font-bold text-rose-200">{formatAmount(latestDemand)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-center">
                                                        <p className="text-xs text-amber-300/80">溢出损耗</p>
                                                        <p className="text-sm font-bold text-amber-200">{formatAmount(latestLoss)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 交易税调整 - 非银币资源 */}
                                {!isSilver && onUpdateTaxPolicies && (
                                    <div className="rounded-xl lg:rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-2.5 lg:p-4">
                                        <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 mb-1.5 lg:mb-2">交易税调整</p>
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
                                                <p className="text-xs lg:text-xs text-gray-400">当前状态</p>
                                            </div>
                                        </div>
                                        <p className="text-xs lg:text-xs text-gray-400 mt-1.5 lg:mt-2">对该资源的国内市场交易额征税。负数代表政府进行补贴。</p>
                                        <div className="mt-2 lg:mt-3 space-y-3">
                                            {/* 进口关税 */}
                                            <div>
                                                <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                                                    <Icon name="ArrowDownLeft" size={12} className="text-blue-400" />
                                                    进口关税
                                                </p>
                                                <div className="flex items-center gap-2 lg:gap-3">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        step="1"
                                                        value={draftImportTariff ?? (currentImportTariff * 100).toFixed(0)}
                                                        onChange={(e) => handleImportTariffDraftChange(e.target.value)}
                                                        onBlur={commitImportTariffDraft}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitImportTariffDraft();
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        className="w-20 lg:w-28 bg-gray-800/70 border border-gray-600 text-base lg:text-lg font-mono text-gray-200 rounded-lg px-1.5 lg:px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                                        placeholder="关税%"
                                                    />
                                                    <div className="text-right flex-1">
                                                        <p className="text-sm lg:text-base font-semibold text-blue-200">{(currentImportTariff * 100).toFixed(0)}%</p>
                                                        <p className="text-xs lg:text-xs text-gray-400">当前税率</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* 出口关税 */}
                                            <div>
                                                <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500 mb-1 flex items-center gap-1">
                                                    <Icon name="ArrowUpRight" size={12} className="text-green-400" />
                                                    出口关税
                                                </p>
                                                <div className="flex items-center gap-2 lg:gap-3">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        step="1"
                                                        value={draftExportTariff ?? (currentExportTariff * 100).toFixed(0)}
                                                        onChange={(e) => handleExportTariffDraftChange(e.target.value)}
                                                        onBlur={commitExportTariffDraft}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                commitExportTariffDraft();
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        className="w-20 lg:w-28 bg-gray-800/70 border border-gray-600 text-base lg:text-lg font-mono text-gray-200 rounded-lg px-1.5 lg:px-2 py-1 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center"
                                                        placeholder="关税%"
                                                    />
                                                    <div className="text-right flex-1">
                                                        <p className="text-sm lg:text-base font-semibold text-green-200">{(currentExportTariff * 100).toFixed(0)}%</p>
                                                        <p className="text-xs lg:text-xs text-gray-400">当前税率</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs lg:text-xs text-gray-400">关税与交易税独立计算，最终税率 = 交易税率 + 关税率（加法叠加）。负数为补贴。</p>
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'market' && (
                                    <div className="space-y-3 lg:space-y-4">
                                        <div className="grid grid-cols-2 gap-2 lg:gap-4">
                                            <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-2.5 lg:p-4">
                                                <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">库存概览</p>
                                                <p className="mt-1 lg:mt-2 text-2xl lg:text-2xl font-bold text-white">{formatAmount(inventory)}</p>
                                                <p className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-400">
                                                    日净变化 {formatAmount((latestSupply - latestDemand) || 0)}
                                                </p>
                                            </div>
                                            <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-2.5 lg:p-4">
                                                <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">市场价</p>
                                                <div className="mt-1 lg:mt-2 flex items-center gap-2 lg:gap-3 text-white">
                                                    <span className="text-2xl lg:text-2xl font-bold">{marketPrice.toFixed(2)}</span>
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
                                            <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-2 lg:p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">价格走势</p>
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
                                                        <p className="text-xs lg:text-xs text-gray-500">当前价格</p>
                                                        <p className="text-sm lg:text-base font-bold text-white">{marketPrice.toFixed(2)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-xs lg:text-xs text-gray-500">日变化</p>
                                                        <p className={`text-sm lg:text-base font-bold ${priceTrend > 0 ? 'text-emerald-300' : priceTrend < 0 ? 'text-rose-300' : 'text-white'
                                                            }`}>
                                                            {priceTrend >= 0 ? '+' : ''}{formatAmount(priceTrend)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 供需走势图 */}
                                            <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-2 lg:p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">供需走势</p>
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
                                                        <p className="text-xs lg:text-xs text-gray-500">供给</p>
                                                        <p className="text-sm lg:text-base font-bold text-emerald-300">{formatAmount(latestSupply)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-xs lg:text-xs text-gray-500">需求</p>
                                                        <p className="text-sm lg:text-base font-bold text-rose-300">{formatAmount(latestDemand)}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                        <p className="text-xs lg:text-xs text-gray-500">净供需</p>
                                                        <p className="text-sm lg:text-base font-bold text-white">{formatAmount((latestSupply || 0) - (latestDemand || 0))}</p>
                                                    </div>
                                                    {isElectricity && (
                                                        <div className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-1.5 text-center">
                                                            <p className="text-xs lg:text-xs text-gray-500">损耗</p>
                                                            <p className="text-sm lg:text-base font-bold text-amber-300">{formatAmount(latestLoss)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'analysis' && (
                                    <div className="grid gap-3 lg:gap-4 lg:grid-cols-2">

                                        {/* 市场实际数据对比说明 */}
                                        {(() => {
                                            const marketDemand = market?.demand?.[resourceKey] || 0;
                                            const marketSupply = market?.supply?.[resourceKey] || 0;
                                            const actualDemandTotal =
                                                stratumDemand.reduce((sum, item) => sum + item.amount, 0) +
                                                buildingDemand.reduce((sum, item) => sum + item.amount, 0) +
                                                armyDemand.reduce((sum, item) => sum + item.amount, 0) +
                                                tradeDemand.reduce((sum, item) => sum + item.amount, 0);
                                            const actualSupplyTotal = buildingSupply.reduce((sum, item) => sum + item.amount, 0);

                                            // 只有当市场有数据且与实际成交差异超过5%时才显示
                                            const demandDiff = actualDemandTotal > 0 ? Math.abs(marketDemand - actualDemandTotal) / actualDemandTotal : 0;
                                            const supplyDiff = actualSupplyTotal > 0 ? Math.abs(marketSupply - actualSupplyTotal) / actualSupplyTotal : 0;

                                            if ((marketDemand > 0 || marketSupply > 0) && (demandDiff > 0.05 || supplyDiff > 0.05)) {
                                                return (
                                                    <div className="lg:col-span-2 rounded-xl border border-blue-500/30 bg-blue-950/20 p-2.5">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Icon name="Info" size={14} className="text-blue-400" />
                                                            <p className="text-xs lg:text-xs text-blue-200 font-medium">实际成交数据</p>
                                                        </div>
                                                        <div className="grid gap-2 grid-cols-2">
                                                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30">
                                                                <div>
                                                                    <span className="text-xs text-rose-300">实际消费量</span>
                                                                    <span className="text-xs text-gray-500 ml-1">需求 {formatAmount(marketDemand)}</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-rose-400">{formatAmount(actualDemandTotal)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30">
                                                                <div>
                                                                    <span className="text-xs text-emerald-300">实际供给量</span>
                                                                    <span className="text-xs text-gray-500 ml-1">市场 {formatAmount(marketSupply)}</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-emerald-400">{formatAmount(actualSupplyTotal)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1.5">
                                                            实际成交=真实购买/消耗；市场需求/供给可能包含未成交部分
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-3 lg:p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">需求构成</p>
                                                    <p className="text-base lg:text-xl font-semibold text-white">
                                                        {activeTab === 'analysis' ? (
                                                            <>
                                                                实际消费 {formatAmount(stratumDemand.reduce((sum, item) => sum + item.amount, 0) + buildingDemand.reduce((sum, item) => sum + item.amount, 0) + armyDemand.reduce((sum, item) => sum + item.amount, 0) + tradeDemand.reduce((sum, item) => sum + item.amount, 0))}
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
                                                                                    <span className="text-xs px-1 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-500/30">
                                                                                        富裕新增
                                                                                    </span>
                                                                                )}
                                                                                {item.isLuxuryNeed && !item.isPureLuxury && (
                                                                                    <span className="text-xs px-1 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-500/30">
                                                                                        含富裕需求
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs lg:text-xs text-gray-500">{item.formula}</p>
                                                                            {/* {item.wealthRatio && (
                                    <p className="text-xs text-gray-400">财富比例: {item.wealthRatio}×</p>
                                  )} */}
                                                                            {item.mods && item.mods.length > 0 && (
                                                                                <p className={`text-xs ${item.isPureLuxury
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
                                                                            <p className="text-xs text-emerald-400">实际消费</p>
                                                                        )} */}
                                                                        {/* {!item.isActual && item.hasBonus && (
                                                                            <p className="text-xs text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
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
                                                    <p className="text-xs text-gray-500 mt-0.5">实际消耗 = 基础值 × 效率加成</p>
                                                    <div className="mt-1.5 lg:mt-2 space-y-1.5 lg:space-y-2">
                                                        {buildingDemand.length ? (
                                                            buildingDemand.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.hasBonus ? 'border-amber-500/30 bg-amber-950/20' : 'border-gray-800/60 bg-gray-900/60'} p-2 lg:p-3`}
                                                                >
                                                                    <div>
                                                                        <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                        <p className="text-xs lg:text-xs text-gray-500">{item.formula}</p>
                                                                        {item.mods && item.mods.length > 0 && (
                                                                            <p className="text-xs text-amber-400 mt-0.5">
                                                                                {item.mods.join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm lg:text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                                                                        {item.hasBonus && item.baseAmount !== item.amount && (
                                                                            <p className="text-xs text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
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
                                                                        <p className="text-xs lg:text-xs text-gray-500">{item.formula}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm lg:text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                                                                        {/* {item.hasBonus && (
                                                                            <p className="text-xs text-gray-500">基础: {formatAmount(item.baseAmount)}</p>
                                                                        )} */}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs lg:text-sm text-gray-500">暂无军队消耗</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {tradeDemand.length > 0 && (
                                                    <div>
                                                        <p className="text-xs lg:text-sm font-semibold text-gray-300">国际贸易</p>
                                                        <div className="mt-1.5 lg:mt-2 space-y-1.5 lg:space-y-2">
                                                            {tradeDemand.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-center justify-between rounded-lg lg:rounded-xl border border-blue-500/30 bg-blue-950/20 p-2 lg:p-3"
                                                                >
                                                                    <div>
                                                                        <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                        <p className="text-xs lg:text-xs text-gray-500">{item.formula}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm lg:text-base font-bold text-blue-200">{formatAmount(item.amount)}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-xl lg:rounded-xl border border-gray-800 bg-gray-950/60 p-3 lg:p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs lg:text-xs uppercase tracking-wide text-gray-500">生产来源</p>
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
                                            <p className="text-xs text-gray-500 mt-1">实际产出/消耗 = 基础值 × 效率加成（产出和消耗同比例变化）</p>
                                            <div className="mt-2 lg:mt-4 space-y-1.5 lg:space-y-2">
                                                {buildingSupply.length ? (
                                                    buildingSupply.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-center justify-between rounded-lg lg:rounded-xl border ${item.isReduced
                                                                    ? 'border-red-500/30 bg-red-950/20'
                                                                    : item.hasBonus
                                                                        ? 'border-emerald-500/30 bg-emerald-950/20'
                                                                        : 'border-gray-800/60 bg-gray-900/60'
                                                                } p-2 lg:p-3`}
                                                        >
                                                            <div>
                                                                <p className="text-xs lg:text-sm font-semibold text-white">{item.name}</p>
                                                                <p className="text-xs lg:text-xs text-gray-500">{item.formula}</p>
                                                                {item.mods && item.mods.length > 0 && (
                                                                    <p className="text-xs text-emerald-400">{item.mods.join(' · ')}</p>
                                                                )}
                                                                {/* 显示减产原因 */}
                                                                {item.isReduced && item.reductionReasons && item.reductionReasons.length > 0 && (
                                                                    <p className="text-xs text-red-400 mt-0.5">
                                                                        ⚠ 减产: {item.reductionReasons.map(r => `${r.label}(${(r.factor * 100).toFixed(0)}%)`).join(' · ')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <p className={`text-sm lg:text-base font-bold ${item.isReduced ? 'text-red-200' : 'text-emerald-200'}`}>
                                                                    {formatAmount(item.amount)}
                                                                </p>
                                                                {/* 当减产时显示理论产能作为对比 */}
                                                                {item.isReduced && item.theoreticalAmount > 0 && (
                                                                    <p className="text-xs text-gray-500">
                                                                        理论: {formatAmount(item.theoreticalAmount)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs lg:text-sm text-gray-500">暂无建筑供给</p>
                                                )}
                                            </div>
                                            {stratumEfficiencyWarnings.length > 0 && (
                                                <div className="mt-3 rounded-lg lg:rounded-xl border border-amber-600/30 bg-amber-500/5 p-2.5 lg:p-4">
                                                    <div className="flex items-center gap-2 text-amber-200 text-xs lg:text-xs font-semibold">
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
                                                                            <p className="text-xs text-gray-400">{warning.desc}</p>
                                                                        )}
                                                                        {warning.shortages.length > 0 && (
                                                                            <p className="text-xs text-amber-200/80 mt-0.5">
                                                                                需求缺口：{warning.shortages.join('、')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm lg:text-base font-semibold text-amber-200">
                                                                        {warning.penaltyPercent}%
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">生产惩罚</p>
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
                                    <DynamicChainView resourceKey={resourceKey} buildings={buildings} epoch={epoch} />
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
