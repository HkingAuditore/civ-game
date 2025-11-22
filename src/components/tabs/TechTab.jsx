// 科技标签页组件
// 显示科技树和时代升级功能

import React from 'react';
import { Icon } from '../common/UIComponents';
import { TECHS, EPOCHS } from '../../config';
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
  const canResearch = (tech) => {
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
  };

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
  const techsByEpoch = TECHS.reduce((acc, tech) => {
    if (!acc[tech.epoch]) acc[tech.epoch] = [];
    acc[tech.epoch].push(tech);
    return acc;
  }, {});

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

        {/* 按时代显示科技 */}
        <div className="space-y-4">
          {Object.entries(techsByEpoch).filter(([epochIdx]) => parseInt(epochIdx) <= epoch).map(([epochIdx, techs]) => {
            const epochInfo = EPOCHS[parseInt(epochIdx)];

            return (
              <div key={epochIdx}>
                {/* 时代标题 */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Flag" size={14} className="text-purple-400" />
                  <h4 className="text-sm font-bold text-purple-300">
                    {epochInfo.name}
                  </h4>
                </div>

                {/* 科技列表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                  {techs.map((tech) => {
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
                        {/* 科技头部 */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="text-sm font-bold text-white flex items-center gap-1">
                              {tech.name}
                              {status === 'unlocked' && (
                                <Icon name="Check" size={14} className="text-green-400" />
                              )}
                            </h5>
                            <p className="text-xs text-gray-400 mt-1">{tech.desc}</p>
                          </div>
                        </div>

                        {/* 科技效果 */}
                        {tech.effect && (
                          <div className="mb-2 p-2 bg-black/20 rounded">
                            <p className="text-xs text-blue-300">{tech.effect}</p>
                          </div>
                        )}

                        {/* 研究成本 */}
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

                        {/* 研究按钮 */}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
