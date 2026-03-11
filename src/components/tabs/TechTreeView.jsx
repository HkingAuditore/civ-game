/**
 * 科技树可视化组件
 * 全文明统一从上到下的树形布局
 * 跨时代前置关系用连线展示科技发展的传承性
 * 限制树宽度适配手机竖屏
 */
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, EPOCHS, TECHS } from '../../config';
import { TECH_MAP } from '../../config/technologies';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { getTechCostMultiplier } from '../../config/difficulty';

// 节点尺寸常量（紧凑版适配手机竖屏）
const NODE_W = 80;
const NODE_H = 52;
const GAP_X = 12;       // 同层节点间水平间距
const GAP_Y = 44;       // 层与层之间垂直间距
const PADDING = 12;     // 画布内边距
const MAX_COLS = 4;     // 每层最大列数（控制宽度）
const EPOCH_SEPARATOR_H = 28; // 时代分隔带高度
const EPOCH_SEPARATOR_GAP = 8; // 分隔带上下间距

/**
 * 统一树布局：将所有可见时代的科技作为一棵完整树布局
 * 主排序维度：时代（epoch），保证严格按时代从上到下排列
 * 次排序维度：时代内按拓扑深度（prerequisites链长度）分层
 * 每层最多 MAX_COLS 个节点，超出则分为多行
 *
 * @param {Array} allTechs - 所有可见的科技节点
 * @param {number} currentEpoch - 当前时代（决定未来时代锁定状态）
 * @returns {{ nodePositions, epochSeparators, width, height, rows }}
 */
function layoutUnifiedTree(allTechs, currentEpoch) {
    if (!allTechs || allTechs.length === 0) {
        return { nodePositions: new Map(), epochSeparators: [], width: 0, height: 0, rows: [] };
    }

    const techMap = new Map(allTechs.map(t => [t.id, t]));

    // 按时代分组
    const epochGroups = new Map();
    allTechs.forEach(t => {
        if (!epochGroups.has(t.epoch)) epochGroups.set(t.epoch, []);
        epochGroups.get(t.epoch).push(t);
    });
    // 时代索引排序
    const sortedEpochs = Array.from(epochGroups.keys()).sort((a, b) => a - b);

    // 在每个时代内部计算拓扑深度（只考虑同时代内的前置关系来分层）
    // 跨时代的前置关系用连线展示，但不影响层级排列
    function getIntraEpochDepth(tech, epochTechIds, cache) {
        if (cache.has(tech.id)) return cache.get(tech.id);
        const prereqs = (tech.prerequisites || []).filter(pid => epochTechIds.has(pid));
        if (prereqs.length === 0) {
            cache.set(tech.id, 0);
            return 0;
        }
        let maxParentDepth = 0;
        for (const pid of prereqs) {
            const parentTech = techMap.get(pid);
            if (parentTech) {
                maxParentDepth = Math.max(maxParentDepth, getIntraEpochDepth(parentTech, epochTechIds, cache));
            }
        }
        const d = maxParentDepth + 1;
        cache.set(tech.id, d);
        return d;
    }

    // 构建行列表：时代 → 时代内按深度分层 → 每层拆分为 MAX_COLS 子行
    const rows = []; // { techs: [], epoch: number }
    for (const ep of sortedEpochs) {
        const epochTechs = epochGroups.get(ep);
        const epochTechIds = new Set(epochTechs.map(t => t.id));
        const depthCache = new Map();
        epochTechs.forEach(t => getIntraEpochDepth(t, epochTechIds, depthCache));

        // 按深度分层
        const maxDepth = Math.max(0, ...Array.from(depthCache.values()));
        for (let d = 0; d <= maxDepth; d++) {
            const nodesAtDepth = epochTechs.filter(t => depthCache.get(t.id) === d);
            if (nodesAtDepth.length === 0) continue;
            // 拆分为 MAX_COLS 子行
            for (let i = 0; i < nodesAtDepth.length; i += MAX_COLS) {
                rows.push({ techs: nodesAtDepth.slice(i, i + MAX_COLS), epoch: ep });
            }
        }
    }

    // 计算节点坐标，在时代切换处插入分隔带
    const nodePositions = new Map();
    const epochSeparators = []; // { y, epochIdx, label }
    const maxRowWidth = MAX_COLS * NODE_W + (MAX_COLS - 1) * GAP_X;

    let cursorY = 0;
    let lastEpoch = -1;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const rowEpoch = row.epoch;

        // 如果时代发生了切换，插入分隔带
        if (rowEpoch !== lastEpoch && lastEpoch !== -1) {
            cursorY += EPOCH_SEPARATOR_GAP;
            epochSeparators.push({
                y: cursorY,
                epochIdx: rowEpoch,
                label: EPOCHS[rowEpoch]?.name || `时代 ${rowEpoch}`,
            });
            cursorY += EPOCH_SEPARATOR_H + EPOCH_SEPARATOR_GAP;
        } else if (lastEpoch === -1) {
            // 第一个时代也插入分隔带
            epochSeparators.push({
                y: cursorY,
                epochIdx: rowEpoch,
                label: EPOCHS[rowEpoch]?.name || `时代 ${rowEpoch}`,
            });
            cursorY += EPOCH_SEPARATOR_H + EPOCH_SEPARATOR_GAP;
        }
        lastEpoch = rowEpoch;

        // 计算本行节点的水平布局（居中）
        const layerWidth = row.techs.length * NODE_W + (row.techs.length - 1) * GAP_X;
        const startX = (maxRowWidth - layerWidth) / 2;

        for (let colIdx = 0; colIdx < row.techs.length; colIdx++) {
            const tech = row.techs[colIdx];
            const x = startX + colIdx * (NODE_W + GAP_X);
            nodePositions.set(tech.id, { x, y: cursorY });
        }

        cursorY += NODE_H + GAP_Y;
    }

    // 最终画布尺寸
    const height = cursorY - GAP_Y + PADDING; // 去掉最后一行多余的 GAP_Y
    const width = maxRowWidth;

    return { nodePositions, epochSeparators, width, height, rows };
}

/**
 * 统一连线组件：SVG 贝塞尔曲线（支持跨时代连线）
 */
const UnifiedTreeEdges = React.memo(({ allTechs, nodePositions, techsUnlocked }) => {
    const edges = [];

    allTechs.forEach(tech => {
        if (!tech.prerequisites) return;
        const toPos = nodePositions.get(tech.id);
        if (!toPos) return;

        tech.prerequisites.forEach(prereqId => {
            const fromPos = nodePositions.get(prereqId);
            if (!fromPos) return;

            const isCompleted = techsUnlocked.includes(prereqId) && techsUnlocked.includes(tech.id);
            const isAvailable = techsUnlocked.includes(prereqId) && !techsUnlocked.includes(tech.id);
            const fromTech = TECH_MAP[prereqId];
            const isCrossEpoch = fromTech && fromTech.epoch !== tech.epoch;

            // 从父节点底部中心 → 子节点顶部中心
            const x1 = fromPos.x + NODE_W / 2;
            const y1 = fromPos.y + NODE_H;
            const x2 = toPos.x + NODE_W / 2;
            const y2 = toPos.y;

            const midY = (y1 + y2) / 2;

            edges.push(
                <path
                    key={`${prereqId}-${tech.id}`}
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isCompleted ? '#22c55e' : isAvailable ? '#eab308' : '#4b5563'}
                    strokeWidth={isCompleted ? 2 : isCrossEpoch ? 1.5 : 1.5}
                    strokeOpacity={isCompleted ? 0.8 : isAvailable ? 0.6 : 0.25}
                    strokeDasharray={isCompleted ? 'none' : isAvailable ? 'none' : '4 3'}
                />
            );

            // 箭头
            if (isCompleted || isAvailable) {
                const arrowSize = 3.5;
                const arrowColor = isCompleted ? '#22c55e' : '#eab308';
                edges.push(
                    <polygon
                        key={`arrow-${prereqId}-${tech.id}`}
                        points={`${x2},${y2} ${x2 - arrowSize},${y2 - arrowSize * 1.5} ${x2 + arrowSize},${y2 - arrowSize * 1.5}`}
                        fill={arrowColor}
                        opacity={isCompleted ? 0.8 : 0.5}
                    />
                );
            }
        });
    });

    return <>{edges}</>;
});

/**
 * 时代分隔带组件
 */
const EpochSeparator = React.memo(({ separator, width }) => {
    const epochInfo = EPOCHS[separator.epochIdx];
    const colorClass = epochInfo?.color || 'text-gray-400';
    return (
        <div
            className="absolute flex items-center gap-2 px-2"
            style={{
                top: separator.y,
                left: 0,
                width: width,
                height: EPOCH_SEPARATOR_H,
            }}
        >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
            <span className={`text-[11px] font-bold font-decorative whitespace-nowrap ${colorClass}`}>
                {separator.label}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        </div>
    );
});

/**
 * 紧凑型单个科技节点卡片
 */
const TechNode = React.memo(({
    tech, status, affordable, pos, silverCost,
    onResearch, onShowDetails, resources, isLocked
}) => {
    const nodeClass = status === 'unlocked'
        ? 'glass-ancient border-green-600/60'
        : isLocked
            ? 'bg-gray-800/40 border-gray-700/40 opacity-50'
            : affordable
                ? 'glass-ancient border-ancient-gold/30 hover:border-blue-400/70 hover:shadow-glow-gold'
                : 'bg-gray-800/60 border-gray-600/50';

    return (
        <div
            className={`absolute rounded-lg border transition-all cursor-pointer active:scale-[0.96] overflow-hidden ${nodeClass}`}
            style={{
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
            }}
            onClick={() => onShowDetails && onShowDetails(tech, status)}
        >
            <div className="flex flex-col items-center justify-center h-full px-1 py-0.5">
                <span className="text-[10px] text-white text-center leading-tight line-clamp-2 font-medium">
                    {tech.name}
                </span>
                {status === 'unlocked' ? (
                    <span className="text-[9px] text-green-400 mt-0.5">✓</span>
                ) : isLocked ? (
                    <span className="text-[9px] text-gray-500 mt-0.5">🔒</span>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onResearch(tech.id); }}
                        disabled={!affordable}
                        className={`mt-0.5 w-[92%] px-1 py-0.5 rounded text-[9px] font-semibold ${
                            affordable
                                ? 'bg-blue-600/80 hover:bg-blue-500 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <span className={(resources.silver || 0) < silverCost ? 'text-red-300' : ''}>
                            {formatSilverCost(silverCost)}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
});

/**
 * 科技树可视化主组件
 * 统一全文明科技树，从上到下展开，跨时代传承
 */
export const TechTreeView = React.memo(({
    techsByEpoch,
    visibleEpochIndices,
    techsUnlocked,
    epoch,
    resources,
    market,
    difficulty,
    canResearch,
    onResearch,
    onShowTechDetails,
    showUnresearchedOnly,
}) => {
    const multiplier = getTechCostMultiplier(difficulty);
    const containerRef = useRef(null);

    // 收集所有可见的科技节点（当前时代及以前的时代）
    const allVisibleTechs = useMemo(() => {
        let techs = [];
        for (const epochIdx of visibleEpochIndices) {
            const epochTechs = techsByEpoch[epochIdx] || [];
            techs = techs.concat(epochTechs);
        }
        if (showUnresearchedOnly) {
            // 过滤时保留连线完整性
            const unresTechIds = new Set(techs.filter(t => !techsUnlocked.includes(t.id)).map(t => t.id));
            const neededIds = new Set(unresTechIds);
            techs.forEach(t => {
                if (unresTechIds.has(t.id) && t.prerequisites) {
                    t.prerequisites.forEach(pid => neededIds.add(pid));
                }
            });
            techs = techs.filter(t => neededIds.has(t.id));
        }
        return techs;
    }, [visibleEpochIndices, techsByEpoch, techsUnlocked, showUnresearchedOnly]);

    // 统一树布局
    const layout = useMemo(() => {
        return layoutUnifiedTree(allVisibleTechs, epoch);
    }, [allVisibleTechs, epoch]);

    // 统计各时代研究进度
    const epochProgress = useMemo(() => {
        const progress = {};
        for (const epochIdx of visibleEpochIndices) {
            const epochTechs = techsByEpoch[epochIdx] || [];
            const total = epochTechs.length;
            const researched = epochTechs.filter(t => techsUnlocked.includes(t.id)).length;
            progress[epochIdx] = { total, researched };
        }
        return progress;
    }, [visibleEpochIndices, techsByEpoch, techsUnlocked]);

    // 画布尺寸
    const canvasWidth = layout.width + PADDING * 2;
    const canvasHeight = layout.height + PADDING * 2;
    const displayWidth = Math.max(canvasWidth, 320);

    if (allVisibleTechs.length === 0) {
        return (
            <p className="text-xs text-gray-400 text-center py-3">
            {showUnresearchedOnly ? '暂无未研究的科技。' : '暂无可显示的科技。'}
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {/* 时代研究进度概览 */}
            <div className="flex flex-wrap gap-1.5 px-1">
                {visibleEpochIndices.map(epochIdx => {
                    const p = epochProgress[epochIdx];
                    if (!p) return null;
                    const epochInfo = EPOCHS[epochIdx];
                    const isComplete = p.total > 0 && p.researched === p.total;
                    return (
                        <div
                            key={epochIdx}
                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                                isComplete
                                    ? 'border-green-600/50 bg-green-900/20 text-green-400'
                                    : epochIdx === epoch
                                        ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-300'
                                        : 'border-gray-600/30 bg-gray-800/30 text-gray-400'
                            }`}
                        >
                            <span className="font-medium">{epochInfo?.name}</span>
                            <span className="opacity-70">{p.researched}/{p.total}</span>
                        </div>
                    );
                })}
            </div>

            {/* 统一科技树画布 */}
            <div
                ref={containerRef}
                className="overflow-x-auto overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/40"
                style={{ maxHeight: '70vh', WebkitOverflowScrolling: 'touch' }}
            >
                <div
                    className="relative"
                    style={{
                        width: displayWidth,
                        height: canvasHeight,
                        minWidth: '100%',
                    }}
                >
                    {/* SVG 连线层 */}
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        width={displayWidth}
                        height={canvasHeight}
                        style={{ overflow: 'visible' }}
                    >
                        <g transform={`translate(${PADDING + (displayWidth - canvasWidth) / 2}, ${PADDING})`}>
                            <UnifiedTreeEdges
                                allTechs={allVisibleTechs}
                                nodePositions={layout.nodePositions}
                                techsUnlocked={techsUnlocked}
                            />
                        </g>
                    </svg>

                    {/* 时代分隔带层 */}
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: PADDING + (displayWidth - canvasWidth) / 2,
                            top: PADDING,
                            width: layout.width,
                            height: layout.height,
                        }}
                    >
                        {layout.epochSeparators.map((sep, idx) => (
                            <EpochSeparator
                                key={`sep-${sep.epochIdx}-${idx}`}
                                separator={sep}
                                width={layout.width}
                            />
                        ))}
                    </div>

                    {/* 节点层 */}
                    <div
                        className="absolute"
                        style={{
                            left: PADDING + (displayWidth - canvasWidth) / 2,
                            top: PADDING,
                            width: layout.width,
                            height: layout.height,
                        }}
                    >
                        {allVisibleTechs.map(tech => {
                            const pos = layout.nodePositions.get(tech.id);
                            if (!pos) return null;

                            const isUnlocked = techsUnlocked.includes(tech.id);
                            const isLocked = tech.epoch > epoch;
                            const status = isUnlocked ? 'unlocked' : 'available';
                            const adjustedCost = Object.fromEntries(
                                Object.entries(tech.cost).map(([r, v]) => [r, Math.ceil(v * multiplier)])
                            );
                            const silverCost = calculateSilverCost(adjustedCost, market);
                            const affordable = canResearch(tech);

                            return (
                                <TechNode
                                    key={tech.id}
                                    tech={tech}
                                    status={status}
                                    affordable={affordable}
                                    pos={pos}
                                    silverCost={silverCost}
                                    onResearch={onResearch}
                                    onShowDetails={onShowTechDetails}
                                    resources={resources}
                                    isLocked={isLocked}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
});
