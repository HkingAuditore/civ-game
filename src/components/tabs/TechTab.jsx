// 科技标签页组件
// 显示科技树和时代升级功能

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { TECHS, EPOCHS, BUILDINGS } from '../../config';
import { RESOURCES } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';

const EPOCH_BONUS_LABELS = {
  gatherBonus: { label: '采集产出', type: 'percent' },
  industryBonus: { label: '工业产出', type: 'percent' },
  cultureBonus: { label: '文化产出', type: 'percent' },
  scienceBonus: { label: '科研产出', type: 'percent' },
  militaryBonus: { label: '军事力量', type: 'percent' },
  adminBonus: { label: '行政容量', type: 'flat' },
};

const formatBonusValue = (key, value) => {
  const meta = EPOCH_BONUS_LABELS[key];
  if (meta?.type === 'flat') {
    return `${value > 0 ? '+' : ''}${value}`;
  }
  const numeric = typeof value === 'number' ? value : Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${(numeric * 100).toFixed(0)}%`;
};

const TECH_BUILDING_UNLOCKS = BUILDINGS.reduce((acc, building) => {
  if (!building.requiresTech) return acc;
  const techId = building.requiresTech;
  if (!acc[techId]) acc[techId] = [];
  acc[techId].push(building.name || building.id);
  return acc;
}, {});

/**
 * 科技标签页组件
 * 显示科技树和时代升级
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @param {number} epoch - 当前时代
 * @param {Object} resources - 资源对象
 * @param {number} population - 总人口
 * @param {Function} onResearch - 研究科技回调
 * @param {Function} onUpgradeEpoch - 升级时代回调
 * @param {Function} canUpgradeEpoch - 检查是否可升级时代
 */
export const TechTab = ({
  techsUnlocked,
  epoch,
  resources,
  population,
  onResearch,
  onUpgradeEpoch,
  canUpgradeEpoch,
  market,
}) => {
  /**
   * 检查科技是否可研究
   * @param {Object} tech - 科技对象
   * @returns {boolean}
   */
  const canResearch = useCallback((tech) => {
    // 已研究
    if (techsUnlocked.includes(tech.id)) return false;
    
    // 时代不足
    if (tech.epoch > epoch) return false;
    
    // 资源不足
    for (let resource in tech.cost) {
      if ((resources[resource] || 0) < tech.cost[resource]) return false;
    }

    const silverCost = calculateSilverCost(tech.cost, market);
    if ((resources.silver || 0) < silverCost) return false;
    
    return true;
  }, [techsUnlocked, epoch, resources, market]);

  /**
   * 获取科技状态
   * @param {Object} tech - 科技对象
   * @returns {string} 状态：unlocked/available/locked
   */
  const getTechStatus = (tech) => {
    if (techsUnlocked.includes(tech.id)) return 'unlocked';
    if (tech.epoch > epoch) return 'locked';
    return 'available';
  };

  // 按时代分组科技
  const techsByEpoch = useMemo(() => {
    return TECHS.reduce((acc, tech) => {
      if (!acc[tech.epoch]) acc[tech.epoch] = [];
      acc[tech.epoch].push(tech);
      return acc;
    }, {});
  }, []);

  const [expandedEpochs, setExpandedEpochs] = useState(() => {
    const defaults = new Set();
    Object.keys(techsByEpoch).forEach((epochIdx) => {
      const idx = parseInt(epochIdx, 10);
      const techs = techsByEpoch[idx] || [];
      const hasUnresearched = techs.some((tech) => !techsUnlocked.includes(tech.id));
      if (idx === epoch || hasUnresearched) {
        defaults.add(idx);
      }
    });
    return defaults;
  });

  const [showUnresearchedOnly, setShowUnresearchedOnly] = useState(false);

  useEffect(() => {
    // 自动展开新进入的时代
    setExpandedEpochs((prev) => {
      if (prev.has(epoch)) return prev;
      const updated = new Set(prev);
      updated.add(epoch);
      return updated;
    });
  }, [epoch]);

  const visibleEpochIndices = useMemo(() => (
    Object.keys(techsByEpoch)
      .map(Number)
      .filter((idx) => idx <= epoch)
      .sort((a, b) => a - b)
  ), [techsByEpoch, epoch]);

  const epochSummaries = useMemo(() => {
    return visibleEpochIndices.reduce((acc, idx) => {
      const techs = techsByEpoch[idx] || [];
      const total = techs.length;
      const researchedCount = techs.filter((tech) => techsUnlocked.includes(tech.id)).length;
      const hasResearchable = techs.some((tech) => canResearch(tech));
      acc[idx] = {
        techs,
        total,
        researchedCount,
        isCompleted: total > 0 && researchedCount === total,
        hasResearchable,
      };
      return acc;
    }, {});
  }, [visibleEpochIndices, techsByEpoch, techsUnlocked, canResearch]);

  const areAllVisibleExpanded = visibleEpochIndices.length > 0 && visibleEpochIndices.every((idx) => expandedEpochs.has(idx));

  const toggleEpoch = (idx) => {
    setExpandedEpochs((prev) => {
      const updated = new Set(prev);
      if (updated.has(idx)) {
        updated.delete(idx);
      } else {
        updated.add(idx);
      }
      return updated;
    });
  };

  const handleToggleAll = () => {
    setExpandedEpochs(() => {
      if (areAllVisibleExpanded) {
        return new Set();
      }
      return new Set(visibleEpochIndices);
    });
  };

  const nextEpochInfo = epoch < EPOCHS.length - 1 ? EPOCHS[epoch + 1] : null;
  const nextEpochSilverCost = nextEpochInfo ? calculateSilverCost(nextEpochInfo.cost, market) : 0;
  const hasNextEpochSilver = nextEpochInfo ? (resources.silver || 0) >= nextEpochSilverCost : true;

  return (
    <div className="space-y-4">
      {/* 时代升级区域 */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 rounded-lg border-2 border-purple-500/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="Crown" size={20} className="text-yellow-400" />
              当前时代：{EPOCHS[epoch].name}
            </h3>
            <p className="text-xs text-gray-300 mt-1">
              {EPOCHS[epoch].description}
            </p>
          </div>
          
          {epoch < EPOCHS.length - 1 && nextEpochInfo && (
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">下一时代</p>
              <p className="text-sm font-bold text-purple-300">
                {nextEpochInfo.name}
              </p>
            </div>
          )}
        </div>

        {/* 时代加成 */}
        {EPOCHS[epoch].bonuses && (
          <div className="mb-3 p-3 bg-black/20 rounded">
            <p className="text-xs text-gray-400 mb-2">当前时代加成：</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(EPOCHS[epoch].bonuses).map(([key, value]) => (
                key === 'desc' ? null : (
                  <div key={key} className="flex items-center gap-1 text-xs">
                    <Icon name="TrendingUp" size={12} className="text-green-400" />
                    <span className="text-gray-300">
                      {EPOCH_BONUS_LABELS[key]?.label || RESOURCES[key]?.name || key}:
                      <span className="text-green-400 ml-1">{formatBonusValue(key, value)}</span>
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* 升级按钮 */}
        {epoch < EPOCHS.length - 1 && nextEpochInfo && (
          <div>
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-1">升级要求：</p>
              <div className="flex flex-wrap gap-2">
                {nextEpochInfo.req.science && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      resources.science >= nextEpochInfo.req.science
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {RESOURCES.science?.name || '科研'}: {resources.science.toFixed(0)} / {nextEpochInfo.req.science}
                  </span>
                )}
                {nextEpochInfo.req.population && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      population >= nextEpochInfo.req.population
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    人口: {population} / {nextEpochInfo.req.population}
                  </span>
                )}
                {nextEpochInfo.req.culture && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      resources.culture >= nextEpochInfo.req.culture
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {RESOURCES.culture?.name || '文化'}: {resources.culture.toFixed(0)} / {nextEpochInfo.req.culture}
                  </span>
                )}
              </div>
            </div>

              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-1">升级成本：</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(nextEpochInfo.cost).map(([resource, cost]) => (
                    <span
                      key={resource}
                      className={`text-xs px-2 py-1 rounded ${
                        (resources[resource] || 0) >= cost
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {RESOURCES[resource]?.name || resource}: {cost}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-400">银币成本</span>
                  <span className={hasNextEpochSilver ? 'text-slate-100 font-semibold' : 'text-red-400 font-semibold'}>
                    {formatSilverCost(nextEpochSilverCost)}
                  </span>
                </div>
              </div>

            <button
              onClick={onUpgradeEpoch}
              disabled={!canUpgradeEpoch() || !hasNextEpochSilver}
              className={`w-full px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                canUpgradeEpoch() && hasNextEpochSilver
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {canUpgradeEpoch() && hasNextEpochSilver ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="ArrowUp" size={16} />
                  升级到 {nextEpochInfo.name}
                </span>
              ) : (
                '条件不足'
              )}
            </button>
          </div>
        )}

        {epoch === EPOCHS.length - 1 && (
          <div className="text-center py-2">
            <p className="text-sm text-yellow-400">
              🎉 你已达到最高时代！
            </p>
          </div>
        )}
      </div>

      {/* 科技树 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Lightbulb" size={16} className="text-yellow-400" />
          科技树
        </h3>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="form-checkbox rounded border-gray-600 text-purple-400 focus:ring-purple-500"
              checked={showUnresearchedOnly}
              onChange={(e) => setShowUnresearchedOnly(e.target.checked)}
            />
            仅显示未研究
          </label>
          <button
            onClick={handleToggleAll}
            className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-200 hover:border-purple-400 hover:text-white transition-colors"
          >
            {areAllVisibleExpanded ? '全部折叠' : '全部展开'}
          </button>
        </div>

        {/* 按时代显示科技 */}
        <div className="space-y-4">
          {visibleEpochIndices.map((epochIdx) => {
            const epochInfo = EPOCHS[epochIdx];
            const summary = epochSummaries[epochIdx];
            const isExpanded = expandedEpochs.has(epochIdx);
            const progressLabel = summary?.isCompleted
              ? '✓ 已完成'
              : `${summary?.researchedCount || 0}/${summary?.total || 0}`;
            const progressClass = summary?.isCompleted ? 'text-green-400' : 'text-gray-300';

            const techs = summary?.techs || [];
            const visibleTechs = showUnresearchedOnly
              ? techs.filter((tech) => !techsUnlocked.includes(tech.id))
              : techs;

            return (
              <div
                key={epochIdx}
                className={`border rounded-lg ${
                  summary?.hasResearchable ? 'border-yellow-400/70' : 'border-gray-700'
                } bg-gray-900/40`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-purple-200"
                  onClick={() => toggleEpoch(epochIdx)}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={isExpanded ? 'ArrowDown' : 'ArrowRight'} size={16} className="text-purple-300" />
                    <span className="font-bold">{epochInfo?.name}</span>
                    {summary?.hasResearchable && (
                      <span className="h-2 w-2 rounded-full bg-yellow-300 animate-pulse" />
                    )}
                  </div>
                  <div className={`text-xs font-semibold ${progressClass}`}>
                    {progressLabel}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-800 px-3 py-4">
                    {visibleTechs.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {visibleTechs.map((tech) => {
                          const status = getTechStatus(tech);
                          const silverCost = calculateSilverCost(tech.cost, market);
                          const affordable = canResearch(tech);

                          return (
                            <div
                              key={tech.id}
                              className={`p-3 rounded-lg border transition-all ${
                                status === 'unlocked'
                                  ? 'bg-green-900/20 border-green-600'
                                  : affordable
                                  ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                                  : 'bg-gray-700/50 border-gray-700'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h5 className="text-sm font-bold text-white flex items-center gap-1">
                                    {tech.name}
                                    {status === 'unlocked' && (
                                      <Icon name="Check" size={14} className="text-green-400" />
                                    )}
                                  </h5>
                                  <p className="text-xs text-gray-400 mt-1">{tech.desc}</p>
                                  {TECH_BUILDING_UNLOCKS[tech.id]?.length > 0 && (
                                    <p className="text-[11px] text-amber-300 mt-1">
                                      解锁建筑：{TECH_BUILDING_UNLOCKS[tech.id].join('、')}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {tech.effect && (
                                <div className="mb-2 p-2 bg-black/20 rounded">
                                  <p className="text-xs text-blue-300">{tech.effect}</p>
                                </div>
                              )}

                              {status !== 'unlocked' && (
                                <>
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {Object.entries(tech.cost).map(([resource, cost]) => (
                                      <span
                                        key={resource}
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          (resources[resource] || 0) >= cost
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-red-900/30 text-red-400'
                                        }`}
                                      >
                                        {RESOURCES[resource]?.name || resource}: {cost}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="text-gray-400">银币成本</span>
                                    <span className={
                                      (resources.silver || 0) >= silverCost
                                        ? 'text-slate-100 font-semibold'
                                        : 'text-red-400 font-semibold'
                                    }>
                                      {formatSilverCost(silverCost)}
                                    </span>
                                  </div>
                                </>
                              )}

                              {status === 'unlocked' ? (
                                <div className="text-center py-1 bg-green-900/20 rounded text-xs text-green-400 font-semibold">
                                  ✓ 已研究
                                </div>
                              ) : (
                                <button
                                  onClick={() => onResearch(tech.id)}
                                  disabled={!affordable}
                                  className={`w-full px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                                    affordable
                                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  研究
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center">
                        {showUnresearchedOnly ? '该时代暂无未研究科技。' : '该时代暂无科技。'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
