// 阶层详情模态框组件
// 显示社会阶层的详细信息

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config/gameData';

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
export const StratumDetailModal = ({
  stratumKey,
  popStructure,
  classApproval,
  classInfluence,
  classWealth,
  totalInfluence,
  totalWealth,
  activeBuffs,
  activeDebuffs,
  onClose,
}) => {
  if (!stratumKey) return null;

  const stratum = STRATA[stratumKey];
  if (!stratum) return null;

  const population = popStructure[stratumKey] || 0;
  const approval = classApproval[stratumKey] || 50;
  const influence = classInfluence[stratumKey] || 0;
  const wealth = classWealth[stratumKey] || 0;

  // 计算百分比
  const totalPop = Object.values(popStructure).reduce((sum, count) => sum + count, 0);
  const popPercent = totalPop > 0 ? (population / totalPop) * 100 : 0;
  const influencePercent = totalInfluence > 0 ? (influence / totalInfluence) * 100 : 0;
  const wealthPercent = totalWealth > 0 ? (wealth / totalWealth) * 100 : 0;

  // 获取该阶层相关的buff和debuff
  const stratumBuffs = activeBuffs.filter(buff => buff.source === stratumKey);
  const stratumDebuffs = activeDebuffs.filter(debuff => debuff.source === stratumKey);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border-2 border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-700 rounded-lg">
                <Icon name={stratum.icon} size={32} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{stratum.name}</h2>
                <p className="text-sm text-gray-300 mt-1">{stratum.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Icon name="X" size={24} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* 模态框内容 */}
        <div className="p-6 space-y-6">
          {/* 基础统计 */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name="BarChart" size={16} className="text-blue-400" />
              基础统计
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">人口数量</p>
                <p className="text-lg font-bold text-white">{population}</p>
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
                <p className="text-lg font-bold text-yellow-400">{wealth.toFixed(0)}</p>
                <p className="text-xs text-yellow-400 mt-1">{wealthPercent.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* 阶层特性 */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name="Star" size={16} className="text-yellow-400" />
              阶层特性
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">财富权重</p>
                <p className="text-sm text-white">{stratum.wealthWeight}x</p>
              </div>
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">影响力基数</p>
                <p className="text-sm text-white">{stratum.influenceBase}</p>
              </div>
            </div>
          </div>

          {/* 资源需求 */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name="Package" size={16} className="text-green-400" />
              资源需求
            </h3>
            <div className="space-y-2">
              {Object.entries(stratum.needs).map(([resource, amount]) => {
                // 这里需要从外部传入当前资源供给情况
                // 暂时显示需求量
                return (
                  <div
                    key={resource}
                    className="flex items-center justify-between bg-gray-700/50 p-3 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="Package" size={14} className="text-blue-400" />
                      <span className="text-sm text-white">{resource}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{amount}/人/天</p>
                      <p className="text-xs text-gray-400">
                        总需求: {(amount * population).toFixed(1)}/天
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 满意效果 */}
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

          {/* 不满效果 */}
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

          {/* 当前激活的效果 */}
          {(stratumBuffs.length > 0 || stratumDebuffs.length > 0) && (
            <div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                <Icon name="Zap" size={16} className="text-yellow-400" />
                当前激活的效果
              </h3>
              <div className="space-y-2">
                {stratumBuffs.map((buff, idx) => (
                  <div
                    key={`buff-${idx}`}
                    className="flex items-start gap-2 bg-green-900/20 border border-green-600/30 p-3 rounded"
                  >
                    <Icon name="TrendingUp" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-300">{buff.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{buff.description}</p>
                    </div>
                  </div>
                ))}
                {stratumDebuffs.map((debuff, idx) => (
                  <div
                    key={`debuff-${idx}`}
                    className="flex items-start gap-2 bg-red-900/20 border border-red-600/30 p-3 rounded"
                  >
                    <Icon name="TrendingDown" size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-300">{debuff.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{debuff.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 管理建议 */}
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
