// 阶层详情模态框组件
// 显示社会阶层的详细信息

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { STRATA } from '../../config';
import { RESOURCES } from '../../config/gameConstants';
import { formatEffectDetails } from '../../utils/effectFormatter';
import { isResourceUnlocked } from '../../utils/resources';
import { formatNumberShortCN } from '../../utils/numberFormat';

/**
 * 阶层详情模态框组件
 * 显示社会阶层的详细信息
 * @param {string} stratumKey - 阶层键值
 * @param {Object} popStructure - 人口结构对象
 * @param {Object} classApproval - 阶层好感度对象
 * @param {Object} classInfluence - 阶层影响力对象
 * @param {Object} classWealth - 阶层财富对象
 * @param {number} totalInfluence - 总影响力
 * @param {number} totalWealth - 总财富
 * @param {Array} activeBuffs - 激活的buff数组
 * @param {Array} activeDebuffs - 激活的debuff数组
 * @param {Function} onClose - 关闭回调
 */
const AllStrataSummary = ({
  popStructure,
  classApproval,
  classInfluence,
  activeBuffs,
  activeDebuffs,
  stability,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="glass-epic rounded-xl border-2 border-ancient-gold/30 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-metal-xl">
        <div className="p-4 md:p-6 border-b border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
<h2 className="text-xl md:text-2xl font-bold text-white font-decorative">社会阶层总览</h2>
              {/* 稳定度显示 */}
              <div className="flex items-center gap-2 mt-2">
                <Icon 
                  name="Heart" 
                  size={16} 
                  className={`flex-shrink-0 ${
                    stability >= 70 ? 'text-green-400' : 
                    stability >= 40 ? 'text-yellow-400' : 
                    'text-red-400 animate-pulse'
                  }`}
                />
                <span className="text-sm text-gray-300">总体稳定度:</span>
                <span className={`text-sm font-bold ${
                  stability >= 70 ? 'text-green-400' : 
                  stability >= 40 ? 'text-yellow-400' : 
                  'text-red-400'
                }`}>
                  {Math.floor(stability)}%
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg flex-shrink-0">
              <Icon name="X" size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="p-2 text-sm font-semibold text-gray-300">阶层</th>
                <th className="p-2 text-sm font-semibold text-gray-300">人口</th>
                <th className="p-2 text-sm font-semibold text-gray-300">好感度</th>
                <th className="p-2 text-sm font-semibold text-gray-300">影响力</th>
                <th className="p-2 text-sm font-semibold text-gray-300">当前效果</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(STRATA).map(key => {
                const stratum = STRATA[key];
                const count = popStructure[key] || 0;
                if (count === 0) return null;

                const approval = classApproval[key] || 50;
                const influence = classInfluence[key] || 0;

                const buffs = activeBuffs.filter(b => b.class === key || b.source === key);
                const debuffs = activeDebuffs.filter(d => d.class === key || d.source === key);

                return (
                  <tr key={key} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="p-2 text-sm text-white flex items-center gap-2">
                      <Icon name={stratum.icon} size={16} /> {stratum.name}
                    </td>
                    <td className="p-2 text-sm text-gray-300">{formatNumberShortCN(count, { decimals: 1 })}</td>
                    <td className="p-2 text-sm">
                      <span className={
                        approval >= 70 ? 'text-green-400' :
                        approval >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }>{approval.toFixed(0)}%</span>
                    </td>
                    <td className="p-2 text-sm text-purple-400">{influence.toFixed(1)}</td>
                    <td className="p-2 text-xs space-y-1">
                      {buffs.map((b, i) => {
                        const details = formatEffectDetails(b);
                        return (
                          <div key={i} className="text-green-400">
                            <span className="font-semibold">{b.desc || '满意加成'}</span>
                            {details.length > 0 && (
                              <span className="text-gray-300 ml-2">({details.join('，')})</span>
                            )}
                          </div>
                        );
                      })}
                      {debuffs.map((d, i) => {
                        const details = formatEffectDetails(d);
                        return (
                          <div key={i} className="text-red-400">
                            <span className="font-semibold">{d.desc || '不满惩罚'}</span>
                            {details.length > 0 && (
                              <span className="text-gray-300 ml-2">({details.join('，')})</span>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

const STRATUM_TAB_OPTIONS = [
  { id: 'overview', label: '概览', description: '基础统计与管理建议' },
  { id: 'economy', label: '经济', description: '趋势与财富结构' },
  { id: 'needs', label: '需求', description: '资源消费与满意度预览' },
];

export const StratumDetailModal = ({
  stratumKey,
  popStructure,
  classApproval,
  classInfluence,
  classWealth,
  classWealthHistory = {},
  totalInfluence,
  totalWealth,
  activeBuffs,
  activeDebuffs,
  epoch = 0,
  techsUnlocked = [],
  history = {},
  stability = 50,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!stratumKey || stratumKey === 'all') {
    return (
      <AllStrataSummary 
        popStructure={popStructure}
        classApproval={classApproval}
        classInfluence={classInfluence}
        activeBuffs={activeBuffs}
        activeDebuffs={activeDebuffs}
        stability={stability}
        onClose={onClose}
      />
    );
  }

  const stratum = STRATA[stratumKey];
  if (!stratum) return null;
  const activeTabMeta = STRATUM_TAB_OPTIONS.find(tab => tab.id === activeTab);

  const population = popStructure[stratumKey] || 0;
  const approval = classApproval[stratumKey] || 50;
  const influence = classInfluence[stratumKey] || 0;
  const wealth = classWealth[stratumKey] || 0;
  const wealthPerCapita = wealth / Math.max(1, population);

  // 计算百分比
  const totalPop = Object.values(popStructure).reduce((sum, count) => sum + count, 0);
  const popPercent = totalPop > 0 ? (population / totalPop) * 100 : 0;
  const influencePercent = totalInfluence > 0 ? (influence / totalInfluence) * 100 : 0;
  const wealthPercent = totalWealth > 0 ? (wealth / totalWealth) * 100 : 0;

  // 获取该阶层相关的buff和debuff
  const stratumBuffs = activeBuffs.filter(buff => buff.class === stratumKey || buff.source === stratumKey);
  const stratumDebuffs = activeDebuffs.filter(debuff => debuff.class === stratumKey || debuff.source === stratumKey);
  const wealthHistory = classWealthHistory[stratumKey] || [];
  const stratumHistory = history?.class?.[stratumKey] || { pop: [], income: [], expense: [] };

  const renderWealthChart = (history = []) => {
    if (!history || history.length <= 1) return null;
    const width = 260;
    const height = 90;
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;
    const points = history.map((value, index) => {
      const x = history.length > 1 ? (index / (history.length - 1)) * width : width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-24 text-emerald-300 stroke-current fill-none"
      >
        <polyline points={points} strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="glass-epic rounded-xl border border-ancient-gold/30 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-monument animate-slide-bounce">
        {/* 模态框头部 - 史诗风格 */}
        <div className="p-3 md:p-4 border-b border-ancient-gold/20 bg-gradient-to-r from-purple-900/30 via-ancient-ink/50 to-blue-900/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
              <div className="p-2 md:p-2.5 icon-metal-container icon-metal-container-lg flex-shrink-0 animate-breathe-glow">
                <Icon name={stratum.icon} size={22} className="text-ancient-gold icon-metal-gold md:w-7 md:h-7" />
              </div>
              <div className="flex-1 min-w-0">
<h2 className="text-lg md:text-2xl font-bold text-white font-decorative">{stratum.name}</h2>
                <p className="text-xs md:text-sm text-gray-300 mt-1">{stratum.description}</p>
                {/* 稳定度显示 */}
                <div className="flex items-center gap-1.5 md:gap-2 mt-2">
                  <Icon 
                    name="Heart" 
                    size={14} 
                    className={`flex-shrink-0 ${
                      stability >= 70 ? 'text-green-400' : 
                      stability >= 40 ? 'text-yellow-400' : 
                      'text-red-400 animate-pulse'
                    }`}
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">总体稳定度:</span>
                  <span className={`text-xs md:text-sm font-bold ${
                    stability >= 70 ? 'text-green-400' : 
                    stability >= 40 ? 'text-yellow-400' : 
                    'text-red-400'
                  }`}>
                    {Math.floor(stability)}%
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-ancient-gold/20 rounded-lg transition-colors flex-shrink-0 border border-ancient-gold/20 hover:border-ancient-gold/40"
            >
              <Icon name="X" size={18} className="text-ancient-stone hover:text-ancient-gold transition-colors md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* 模态框内容 */}
        <div className="border-b border-gray-700 bg-gray-800/60 px-6 pt-4">
          <div className="flex flex-wrap items-center gap-3 pb-4">
            {STRATUM_TAB_OPTIONS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  tab.id === activeTab
                    ? 'bg-indigo-500/20 text-indigo-200'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {activeTabMeta?.description && (
              <span className="text-sm text-gray-500">{activeTabMeta.description}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                  <Icon name="BarChart" size={16} className="text-blue-400" />
                  基础统计
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">人口数量</p>
                    <p className="text-lg font-bold text-white">{formatNumberShortCN(population, { decimals: 1 })}</p>
                    <p className="text-xs text-blue-400 mt-1">{popPercent.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">好感度</p>
                    <p className={`text-lg font-bold ${
                      approval >= 70 ? 'text-green-400' :
                      approval >= 40 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {approval.toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">影响力</p>
                    <p className="text-lg font-bold text-purple-400">{influence.toFixed(1)}</p>
                    <p className="text-xs text-purple-400 mt-1">{influencePercent.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">财富</p>
                    <p className="text-lg font-bold text-yellow-400">{formatNumberShortCN(wealth, { decimals: 1 })}</p>
                    <p className="text-xs text-yellow-400 mt-1">{wealthPercent.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">人均财富</p>
                    <p className="text-lg font-bold text-yellow-300">{formatNumberShortCN(wealthPerCapita, { decimals: 1 })}</p>
                    <p className="text-xs text-gray-500 mt-1">银币/人</p>
                  </div>
                </div>
              </div>

              {(stratumBuffs.length > 0 || stratumDebuffs.length > 0) && (
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                    <Icon name="Zap" size={16} className="text-yellow-400" />
                    当前激活的效果
                  </h3>
                  <div className="space-y-2">
                    {stratumBuffs.map((buff, idx) => {
                      const details = formatEffectDetails(buff);
                      return (
                        <div
                          key={`buff-${idx}`}
                          className="flex items-start gap-2 bg-green-900/20 border border-green-600/30 p-3 rounded"
                        >
                          <Icon name="TrendingUp" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-green-300">{buff.desc || buff.name || '满意加成'}</p>
                            {details.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1">{details.join('，')}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {stratumDebuffs.map((debuff, idx) => {
                      const details = formatEffectDetails(debuff);
                      return (
                        <div
                          key={`debuff-${idx}`}
                          className="flex items-start gap-2 bg-red-900/20 border border-red-600/30 p-3 rounded"
                        >
                          <Icon name="TrendingDown" size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-300">{debuff.desc || debuff.name || '不满惩罚'}</p>
                            {details.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1">{details.join('，')}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded">
                <div className="flex items-start gap-3">
                  <Icon name="Lightbulb" size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-300 mb-2">管理建议</h4>
                    <ul className="space-y-1 text-xs text-gray-300">
                      {approval < 40 && (
                        <li>• 该阶层好感度较低，建议增加资源供给或调整政策</li>
                      )}
                      {influence > totalInfluence * 0.3 && (
                        <li>• 该阶层影响力较大，需要重点关注其需求</li>
                      )}
                      {population > totalPop * 0.4 && (
                        <li>• 该阶层人口占比较高，是社会的主要组成部分</li>
                      )}
                      {approval >= 70 && (
                        <li>• 该阶层满意度高，可以获得正面加成</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                  <Icon name="Activity" size={16} className="text-cyan-400" />
                  趋势分析
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="bg-gray-700/40 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-2">人口变化</p>
                    <SimpleLineChart
                      data={stratumHistory.pop}
                      color="#38bdf8"
                      label="人口"
                    />
                  </div>
                  <div className="bg-gray-700/40 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-2">收入变化</p>
                    <SimpleLineChart
                      data={stratumHistory.income}
                      color="#4ade80"
                      label="收入"
                    />
                  </div>
                  <div className="bg-gray-700/40 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-2">支出变化</p>
                    <SimpleLineChart
                      data={stratumHistory.expense}
                      color="#f87171"
                      label="支出"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                  <Icon name="TrendingUp" size={16} className="text-emerald-400" />
                  财富变化
                </h3>
                <div className="bg-gray-700/40 p-3 rounded">
                  {renderWealthChart(wealthHistory) || (
                    <p className="text-xs text-gray-500">暂无足够数据绘制曲线</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                  <Icon name="Star" size={16} className="text-yellow-400" />
                  阶层特性
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">财富权重</p>
                    <p className="text-sm text-white">{stratum.wealthWeight}x</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">影响力基数</p>
                    <p className="text-sm text-white">{stratum.influenceBase}</p>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1">财富弹性</p>
                    <p className={`text-sm font-bold ${
                      (stratum.wealthElasticity || 1.0) >= 1.5 ? 'text-purple-400' :
                      (stratum.wealthElasticity || 1.0) >= 1.0 ? 'text-blue-400' :
                      (stratum.wealthElasticity || 1.0) >= 0.7 ? 'text-green-400' :
                      'text-yellow-400'
                    }`}>{stratum.wealthElasticity || 1.0}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">收入转化消费速度</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'needs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                  <Icon name="Package" size={16} className="text-green-400" />
                  资源需求
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const needsEntries = Object.entries(stratum.needs || {});
                    const visibleNeeds = needsEntries.filter(([resource]) => {
                      return isResourceUnlocked(resource, epoch, techsUnlocked);
                    });
                    return visibleNeeds.length > 0 ? (
                      visibleNeeds.map(([resource, amount]) => {
                        const resourceName = RESOURCES[resource]?.name || resource;
                        const totalNeed = amount * population;
                        return (
                          <div
                            key={resource}
                            className="flex items-center justify-between bg-gray-700/50 p-3 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Icon name="Package" size={14} className="text-blue-400" />
                              <span className="text-sm text-white">{resourceName}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">{amount}/人/天</p>
                              <p className="text-xs text-gray-400">
                                总需求: {formatNumberShortCN(totalNeed, { decimals: 1 })}/天
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-500 italic">当前时代暂无物资需求</p>
                    );
                  })()}
                </div>
              </div>

              {stratum.satisfiedEffects && stratum.satisfiedEffects.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                    <Icon name="ThumbsUp" size={16} className="text-green-400" />
                    满意时的效果
                  </h3>
                  <div className="space-y-2">
                    {stratum.satisfiedEffects.map((effect, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-green-900/20 border border-green-600/30 p-3 rounded"
                      >
                        <Icon name="Plus" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-300">{effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stratum.dissatisfiedEffects && stratum.dissatisfiedEffects.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                    <Icon name="ThumbsDown" size={16} className="text-red-400" />
                    不满时的效果
                  </h3>
                  <div className="space-y-2">
                    {stratum.dissatisfiedEffects.map((effect, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-red-900/20 border border-red-600/30 p-3 rounded"
                      >
                        <Icon name="Minus" size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
