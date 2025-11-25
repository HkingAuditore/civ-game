// 资源详情模态框
// 展示库存、市场趋势以及可视化的产业链信息

import React, { useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { RESOURCES, STRATA, BUILDINGS, UNIT_TYPES, INDUSTRY_CHAINS } from '../../config';

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

const MarketTrendChart = ({ series = [], height = 220 }) => {
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
  const padding = 40;
  const totalPoints = Math.max(...normalizedSeries.map(item => item.data.length));
  const xStep = totalPoints > 1 ? (width - padding * 2) / (totalPoints - 1) : 0;
  const gridLines = 4;
  const ticks = Array.from({ length: gridLines + 1 }, (_, index) => ({
    value: yMin + (yRange / gridLines) * index,
    y: height - padding - ((yMin + (yRange / gridLines) * index - yMin) / yRange) * (height - padding * 2),
  }));

  const buildSeriesPath = (data) => {
    const offset = totalPoints - data.length;
    const coords = data
      .map((value, index) => {
        if (!Number.isFinite(value)) return null;
        const xIndex = offset + index;
        const x = padding + xIndex * xStep;
        const normalized = (value - yMin) / yRange;
        const y = height - padding - normalized * (height - padding * 2);
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
      <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-gray-950/60">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
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

const ChainNode = ({ resourceKey, label, subLabel, highlight = false }) => {
  const resource = resourceKey ? RESOURCES[resourceKey] : null;
  const iconName = resource?.icon || 'Package';
  const colorClass = resource?.color || 'text-indigo-300';

  return (
    <div
      className={`flex min-w-[96px] flex-col items-center rounded-2xl border px-4 py-3 text-center ${
        highlight
          ? 'border-emerald-400/80 bg-emerald-400/10'
          : 'border-gray-800/80 bg-gray-900/70'
      }`}
    >
      <div className="rounded-full border border-gray-800/60 bg-gray-950/70 p-2">
        <Icon name={iconName} size={20} className={colorClass} />
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{label || resource?.name || '未知'}</p>
      {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
    </div>
  );
};

const buildChainFlows = (resourceKey) => {
  if (!resourceKey) return [];
  return Object.values(INDUSTRY_CHAINS)
    .map(chain => {
      let involvesResource = false;
      const upstream = new Set();
      const downstream = new Set();

      chain.stages.forEach(stage => {
        const inputs = ensureArray(stage.input);
        const outputs = ensureArray(stage.output);

        if (outputs.includes(resourceKey)) {
          involvesResource = true;
          inputs.forEach(input => {
            if (RESOURCES[input]) {
              upstream.add(input);
            }
          });
        }

        if (inputs.includes(resourceKey)) {
          involvesResource = true;
          outputs.forEach(output => {
            if (RESOURCES[output] && output !== resourceKey) {
              downstream.add(output);
            }
          });
        }
      });

      if (!involvesResource) return null;

      return {
        id: chain.id,
        name: chain.name,
        desc: chain.desc,
        inputs: Array.from(upstream),
        outputs: Array.from(downstream),
      };
    })
    .filter(Boolean);
};

const TAB_OPTIONS = [
  { id: 'market', label: '市场行情', description: '价格走势与供需概览' },
  { id: 'analysis', label: '供需分析', description: '详细的需求构成与生产来源' },
  { id: 'chain', label: '产业链', description: '上下游产业关系' },
];

export const ResourceDetailModal = ({
  resourceKey,
  resources = {},
  market,
  buildings = {},
  popStructure = {},
  army = {},
  history = {},
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(TAB_OPTIONS[0].id);
  const resourceDef = RESOURCES[resourceKey];
  const isSilver = resourceKey === 'silver';

  const priceHistoryData = useMemo(() => {
    const history = market?.priceHistory?.[resourceKey];
    return history ? [...history] : [];
  }, [market, resourceKey]);

  const supplyHistoryData = useMemo(() => {
    const history = market?.supplyHistory?.[resourceKey];
    return history ? [...history] : [];
  }, [market, resourceKey]);

  const demandHistoryData = useMemo(() => {
    const history = market?.demandHistory?.[resourceKey];
    return history ? [...history] : [];
  }, [market, resourceKey]);

  const chainFlows = useMemo(() => buildChainFlows(resourceKey), [resourceKey]);

  const {
    stratumDemand,
    buildingDemand,
    armyDemand,
    buildingSupply,
  } = useMemo(() => {
    if (!resourceDef) {
      return {
        stratumDemand: [],
        buildingDemand: [],
        armyDemand: [],
        buildingSupply: [],
      };
    }

    const stratumDemandList = Object.entries(STRATA).reduce((acc, [key, stratum]) => {
      const perCap = stratum.needs?.[resourceKey] || 0;
      const population = popStructure[key] || 0;
      if (!perCap || !population) return acc;
      acc.push({
        key,
        name: stratum.name,
        icon: stratum.icon,
        amount: perCap * population,
        formula: `${population}人 × ${perCap}`,
      });
      return acc;
    }, []);

    const buildingDemandList = BUILDINGS.reduce((acc, building) => {
      const perBuilding = building.input?.[resourceKey] || 0;
      const count = buildings[building.id] || 0;
      if (!perBuilding || !count) return acc;
      acc.push({
        id: building.id,
        name: building.name,
        amount: perBuilding * count,
        formula: `${count} 座 × ${perBuilding}`,
      });
      return acc;
    }, []);

    const buildingSupplyList = BUILDINGS.reduce((acc, building) => {
      const perBuilding = building.output?.[resourceKey] || 0;
      const count = buildings[building.id] || 0;
      if (!perBuilding || !count) return acc;
      acc.push({
        id: building.id,
        name: building.name,
        amount: perBuilding * count,
        formula: `${count} 座 × ${perBuilding}`,
      });
      return acc;
    }, []);

    const armyDemandList = Object.entries(UNIT_TYPES).reduce((acc, [id, unit]) => {
      const perUnit = unit.maintenanceCost?.[resourceKey] || 0;
      const count = army[id] || 0;
      if (!perUnit || !count) return acc;
      acc.push({
        id,
        name: unit.name,
        amount: perUnit * count,
        formula: `${count} 队 × ${perUnit}`,
      });
      return acc;
    }, []);

    return {
      stratumDemand: stratumDemandList,
      buildingDemand: buildingDemandList,
      armyDemand: armyDemandList,
      buildingSupply: buildingSupplyList,
    };
  }, [resourceDef, resourceKey, popStructure, buildings, army]);

  if (!resourceKey || !resourceDef) return null;

  const treasuryHistory = history?.treasury || [];
  const taxHistory = history?.tax || [];
  const latestTreasury = treasuryHistory.length
    ? treasuryHistory[treasuryHistory.length - 1]
    : resources[resourceKey] || 0;
  const latestTax = taxHistory.length ? taxHistory[taxHistory.length - 1] : 0;

  const totalDemand =
    stratumDemand.reduce((sum, item) => sum + item.amount, 0) +
    buildingDemand.reduce((sum, item) => sum + item.amount, 0) +
    armyDemand.reduce((sum, item) => sum + item.amount, 0);
  const totalSupply = buildingSupply.reduce((sum, item) => sum + item.amount, 0);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-6xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-4">
              <Icon name={resourceDef.icon} size={28} className={resourceDef.color} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{resourceDef.name}</h2>
              <p className="text-sm text-gray-400">
                当前库存 {inventory.toFixed(1)} {isSilver ? '· 财政资源（非交易品）' : `· 市场价 ${marketPrice.toFixed(2)} 银币`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="关闭"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSilver ? (
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-yellow-300/80">国库银币</p>
                  <p className="mt-2 text-3xl font-bold text-yellow-200">{latestTreasury.toFixed(0)}</p>
                  <p className="mt-2 text-sm text-yellow-200/80">
                    当前储备 {(resources[resourceKey] || 0).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-300/80">每日税收</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-200">
                    {formatAmount(latestTax)}
                  </p>
                  <p className="mt-2 text-sm text-emerald-200/80">最新估算净税额</p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-200/80">财政说明</p>
                  <p className="mt-2 text-sm text-blue-100/80 leading-relaxed">
                    银币为非交易资源，仅通过税收、事件和政策流动，下面的走势可帮助你判断财政稳定性。
                  </p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">国库资金走势</p>
                      <p className="text-xl font-semibold text-white">
                        当前 {(resources[resourceKey] || 0).toFixed(0)} 银币
                      </p>
                    </div>
                    <Icon name="Coins" className="text-yellow-200" />
                  </div>
                  <SimpleLineChart
                    data={treasuryHistory}
                    color="#facc15"
                    label="银币"
                  />
                </div>
                <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">每日净税收走势</p>
                      <p className="text-xl font-semibold text-white">
                        当前 {formatAmount(latestTax)} / 日
                      </p>
                    </div>
                    <Icon name="Activity" className="text-emerald-300" />
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
              <div className="border-b border-gray-800 bg-gray-900/70 px-6 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              {TAB_OPTIONS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    tab.id === activeTab
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
              {activeTabMeta && (
                <span className="text-sm text-gray-500">{activeTabMeta.description}</span>
              )}
            </div>
              </div>
              <div className="flex-1 space-y-6 p-6">
            {activeTab === 'market' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">库存概览</p>
                    <p className="mt-2 text-3xl font-bold text-white">{inventory.toFixed(1)}</p>
                    <p className="mt-2 text-sm text-gray-400">
                      日净变化 {formatAmount((latestSupply - latestDemand) || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">市场状态</p>
                    <div className="mt-2 flex items-center gap-3 text-white">
                      <span className="text-3xl font-bold">{marketPrice.toFixed(2)}</span>
                      <span
                        className={`flex items-center gap-1 text-sm ${
                          priceTrend > 0
                            ? 'text-emerald-400'
                            : priceTrend < 0
                            ? 'text-rose-400'
                            : 'text-gray-400'
                        }`}
                      >
                        <Icon name={priceTrend >= 0 ? 'ArrowUp' : 'ArrowDown'} size={16} />
                        {priceTrend >= 0 ? '+' : ''}
                        {formatAmount(priceTrend)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">近两日价格变化</p>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">供需对比</p>
                    <div className="mt-2 flex items-center gap-6 text-sm">
                      <div>
                        <p className="text-gray-400">供给</p>
                        <p className="text-xl font-semibold text-emerald-300">{formatAmount(marketSupply)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">需求</p>
                        <p className="text-xl font-semibold text-rose-300">{formatAmount(marketDemand)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      缺口 {formatAmount(marketSupply - marketDemand)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">价格走势</p>
                        <p className="text-xl font-semibold text-white">
                          当前价格 {marketPrice.toFixed(2)} 银币
                        </p>
                      </div>
                      <Icon name="TrendingUp" className="text-sky-300" />
                    </div>
                    <div className="mt-4">
                      <MarketTrendChart
                        series={[
                          {
                            label: '市场价（银币）',
                            color: '#60a5fa',
                            data: priceHistoryData,
                          },
                        ]}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-400">
                      <span>
                        当前价格 <span className="text-white">{marketPrice.toFixed(2)}</span> 银币
                      </span>
                      <span>
                        日变化{' '}
                        <span
                          className={
                            priceTrend > 0
                              ? 'text-emerald-300'
                              : priceTrend < 0
                              ? 'text-rose-300'
                              : 'text-white'
                          }
                        >
                          {priceTrend >= 0 ? '+' : ''}
                          {formatAmount(priceTrend)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">供需走势</p>
                        <p className="text-xl font-semibold text-white">
                          净供需 {formatAmount((latestSupply || 0) - (latestDemand || 0))}
                        </p>
                      </div>
                      <Icon name="Activity" className="text-emerald-300" />
                    </div>
                    <div className="mt-4">
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
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-400">
                      <span>
                        最新供给 <span className="text-emerald-300">{formatAmount(latestSupply)}</span>
                      </span>
                      <span>
                        最新需求 <span className="text-rose-300">{formatAmount(latestDemand)}</span>
                      </span>
                      <span>
                        净供需 <span className="text-white">{formatAmount((latestSupply || 0) - (latestDemand || 0))}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">需求构成</p>
                      <p className="text-xl font-semibold text-white">总需求 {formatAmount(totalDemand)}</p>
                    </div>
                    <Icon name="TrendingUp" className="text-rose-300" />
                  </div>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-300">社会阶层</p>
                      <div className="mt-2 space-y-2">
                        {stratumDemand.length ? (
                          stratumDemand.map(item => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between rounded-xl border border-gray-800/60 bg-gray-900/60 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-gray-900/80 p-2">
                                  <Icon name={item.icon} size={18} className="text-amber-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-white">{item.name}</p>
                                  <p className="text-xs text-gray-500">{item.formula}</p>
                                </div>
                              </div>
                              <p className="text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">暂无有效需求</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-300">建筑/工坊</p>
                      <div className="mt-2 space-y-2">
                        {buildingDemand.length ? (
                          buildingDemand.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-gray-800/60 bg-gray-900/60 p-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.formula}</p>
                              </div>
                              <p className="text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">暂无建筑需求</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-300">军需</p>
                      <div className="mt-2 space-y-2">
                        {armyDemand.length ? (
                          armyDemand.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-gray-800/60 bg-gray-900/60 p-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.formula}</p>
                              </div>
                              <p className="text-base font-bold text-rose-200">{formatAmount(item.amount)}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">暂无军队消耗</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">生产来源</p>
                      <p className="text-xl font-semibold text-white">总供给 {formatAmount(totalSupply)}</p>
                    </div>
                    <Icon name="TrendingDown" className="text-emerald-300" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {buildingSupply.length ? (
                      buildingSupply.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-gray-800/60 bg-gray-900/60 p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.formula}</p>
                          </div>
                          <p className="text-base font-bold text-emerald-200">{formatAmount(item.amount)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">暂无建筑供给</p>
                    )}
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-800/60 bg-gray-900/60 p-4 text-sm text-gray-400">
                    本地产出 {formatAmount(totalSupply)} · 市场供给 {formatAmount(marketSupply)} · 缺口{' '}
                    {formatAmount(totalDemand - marketSupply)}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chain' && (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">产业链流程</p>
                    <p className="text-xl font-semibold text-white">上下游位置</p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {chainFlows.length ? (
                    chainFlows.map(flow => (
                      <div key={flow.id} className="rounded-2xl border border-gray-800/60 bg-gray-900/60 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">{flow.name}</p>
                            <p className="text-sm text-gray-400">{flow.desc}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                          <div className="flex flex-wrap gap-2">
                            {(flow.inputs.length ? flow.inputs : [null]).map((inputKey, index) => {
                              const resource = inputKey ? RESOURCES[inputKey] : null;
                              return (
                                <ChainNode
                                  key={`${flow.id}-input-${inputKey || index}`}
                                  resourceKey={inputKey}
                                  label={resource?.name || '原料/采集'}
                                  subLabel={resource ? '上游资源' : '无上游原料'}
                                />
                              );
                            })}
                          </div>
                          <Icon name="ArrowRight" className="text-gray-500" />
                          <ChainNode
                            resourceKey={resourceKey}
                            label={resourceDef.name}
                            subLabel="当前资源"
                            highlight
                          />
                          <Icon name="ArrowRight" className="text-gray-500" />
                          <div className="flex flex-wrap gap-2">
                            {(flow.outputs.length ? flow.outputs : [null]).map((outputKey, index) => {
                              const resource = outputKey ? RESOURCES[outputKey] : null;
                              return (
                                <ChainNode
                                  key={`${flow.id}-output-${outputKey || index}`}
                                  resourceKey={outputKey}
                                  label={resource?.name || '终端消费'}
                                  subLabel={resource ? '下游产物' : '等待消费'}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-gray-800/60 bg-gray-900/60 p-6 text-center text-sm text-gray-500">
                      暂未发现该资源的产业链数据。
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
};
