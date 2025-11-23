// 资源详情模态框
// 展示单个资源的库存、价格、供需与产业链信息

import React, { useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA, BUILDINGS, UNIT_TYPES, INDUSTRY_CHAINS } from '../../config';

const formatAmount = (value) => {
  if (!Number.isFinite(value) || value === 0) return '0';
  if (Math.abs(value) >= 10) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(3);
};

const formatFlowLabel = (stage) => {
  if (!stage) return null;
  return `${stage.name}${stage.stage ? `（${stage.stage}）` : ''}`;
};

const buildChainDetails = (resourceKey, resourceDef) => {
  const hasResource = (field, key) => {
    if (!field) return false;
    if (Array.isArray(field)) return field.includes(key);
    return field === key;
  };

  return Object.values(INDUSTRY_CHAINS)
    .map((chain) => {
      const productionStages = [];
      const consumptionStages = [];
      chain.stages.forEach((stage, index) => {
        if (hasResource(stage.output, resourceKey)) {
          productionStages.push({ ...stage, index });
        }
        if (hasResource(stage.input, resourceKey)) {
          consumptionStages.push({ ...stage, index });
        }
      });

      if (productionStages.length === 0 && consumptionStages.length === 0) {
        return null;
      }

      const anchorIndex =
        productionStages[0]?.index ??
        consumptionStages[0]?.index ??
        0;

      const prevStage = anchorIndex > 0 ? chain.stages[anchorIndex - 1] : null;
      const downstreamStage = consumptionStages.length
        ? consumptionStages[0]
        : (anchorIndex < chain.stages.length - 1 ? chain.stages[anchorIndex + 1] : null);

      const flowParts = [
        formatFlowLabel(prevStage) || '原材料',
        resourceDef.name,
        formatFlowLabel(downstreamStage) || '成品',
      ];

      return {
        id: chain.id,
        name: chain.name,
        desc: chain.desc,
        productionStages,
        consumptionStages,
        flow: flowParts.join(' → '),
      };
    })
    .filter(Boolean);
};

export const ResourceDetailModal = ({
  resourceKey,
  resources = {},
  market,
  buildings = {},
  popStructure = {},
  army = {},
  onClose,
}) => {
  const resourceDef = RESOURCES[resourceKey];
  const marketPrice = market?.prices?.[resourceKey] ?? resourceDef?.basePrice ?? 0;
  const inventory = resources[resourceKey] || 0;

  const {
    stratumDemand,
    buildingDemand,
    armyDemand,
    buildingSupply,
    chainDetails,
  } = useMemo(() => {
    if (!resourceDef) {
      return {
        stratumDemand: [],
        buildingDemand: [],
        armyDemand: [],
        buildingSupply: [],
        chainDetails: [],
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
        formula: `${population} 人 × ${perCap}`,
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
      chainDetails: buildChainDetails(resourceKey, resourceDef),
    };
  }, [resourceKey, resourceDef, popStructure, buildings, army]);

  if (!resourceKey || !resourceDef) return null;

  const totalDemand =
    stratumDemand.reduce((sum, item) => sum + item.amount, 0) +
    buildingDemand.reduce((sum, item) => sum + item.amount, 0) +
    armyDemand.reduce((sum, item) => sum + item.amount, 0);
  const totalSupply = buildingSupply.reduce((sum, item) => sum + item.amount, 0);
  const marketSupply = market?.supply?.[resourceKey] || 0;
  const marketDemand = market?.demand?.[resourceKey] || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-800 p-3">
              <Icon name={resourceDef.icon} size={24} className={resourceDef.color} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{resourceDef.name}</h2>
              <p className="text-sm text-gray-400">
                当前库存 {inventory.toFixed(1)} · 市场价 {marketPrice.toFixed(2)} 银币
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

        <div className="grid gap-4 border-b border-gray-800 bg-gray-900/70 p-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400">库存</p>
            <p className="text-2xl font-bold text-white">{inventory.toFixed(1)}</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400">市场价</p>
            <p className="text-2xl font-bold text-amber-300">{marketPrice.toFixed(2)} 银币</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
            <p className="text-xs text-gray-400">市场供需 (每日)</p>
            <p className="text-sm text-gray-300">
              供给 <span className="text-green-300 font-mono">{formatAmount(marketSupply)}</span> · 需求{' '}
              <span className="text-red-300 font-mono">{formatAmount(marketDemand)}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">需求方</h3>
              <span className="text-sm text-gray-400">总计 {formatAmount(totalDemand)} / 日</span>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">社会阶层</h4>
              {stratumDemand.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {stratumDemand.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={item.icon || 'Users'} size={14} className="text-gray-300" />
                        <span className="text-gray-200">{item.name}</span>
                        <span className="text-[11px] text-gray-500">{item.formula}</span>
                      </div>
                      <span className="font-mono text-red-300">{formatAmount(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">暂无阶层直接需求。</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">建筑消耗</h4>
              {buildingDemand.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {buildingDemand.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-gray-200">{item.name}</p>
                        <p className="text-[11px] text-gray-500">{item.formula}</p>
                      </div>
                      <span className="font-mono text-red-300">{formatAmount(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">暂无建筑消耗。</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-1">军队维护</h4>
              {armyDemand.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {armyDemand.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-gray-200">{item.name}</p>
                        <p className="text-[11px] text-gray-500">{item.formula}</p>
                      </div>
                      <span className="font-mono text-red-300">{formatAmount(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">暂无军队维护需求。</p>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">供给方</h3>
              <span className="text-sm text-gray-400">总计 {formatAmount(totalSupply)} / 日</span>
            </div>
            {buildingSupply.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {buildingSupply.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-gray-200">{item.name}</p>
                      <p className="text-[11px] text-gray-500">{item.formula}</p>
                    </div>
                    <span className="font-mono text-green-300">{formatAmount(item.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">暂无建筑产出该资源。</p>
            )}
          </section>
        </div>

        <div className="space-y-4 border-t border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white">产业链位置</h3>
          {chainDetails.length > 0 ? (
            <div className="space-y-4">
              {chainDetails.map((chain) => (
                <div key={chain.id} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-white">{chain.name}</p>
                      <p className="text-xs text-gray-400">{chain.desc}</p>
                    </div>
                    <span className="rounded-full bg-blue-900/40 px-3 py-1 text-xs text-blue-200">
                      {chain.flow}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-400">生产阶段</p>
                      {chain.productionStages.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-sm text-gray-200">
                          {chain.productionStages.map((stage) => (
                            <li key={`${chain.id}-prod-${stage.index}`}>
                              • {stage.name}（{stage.stage || '阶段'}）
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">暂无上游生产信息。</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400">消费阶段</p>
                      {chain.consumptionStages.length > 0 ? (
                        <ul className="mt-1 space-y-1 text-sm text-gray-200">
                          {chain.consumptionStages.map((stage) => (
                            <li key={`${chain.id}-cons-${stage.index}`}>
                              • {stage.name}（{stage.stage || '阶段'}）
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">暂无下游消费信息。</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">该资源暂未纳入任何产业链配置。</p>
          )}
        </div>

        <div className="border-t border-gray-800 bg-gray-900/80 p-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Icon name="X" size={14} />
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
