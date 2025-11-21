// 战斗结果模态框组件
// 显示战斗结果的详细信息

import React from 'react';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES } from '../../config/militaryUnits';

/**
 * 战斗结果模态框组件
 * 显示战斗结果的详细信息
 * @param {Object} result - 战斗结果对象
 * @param {Function} onClose - 关闭回调
 */
export const BattleResultModal = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border-2 border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className={`p-6 border-b border-gray-700 ${
          result.victory 
            ? 'bg-gradient-to-r from-green-900/50 to-blue-900/50' 
            : 'bg-gradient-to-r from-red-900/50 to-gray-900/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon 
                name={result.victory ? 'Trophy' : 'Skull'} 
                size={32} 
                className={result.victory ? 'text-yellow-400' : 'text-red-400'} 
              />
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {result.victory ? '🎉 战斗胜利！' : '💀 战斗失败...'}
                </h2>
                <p className="text-sm text-gray-300 mt-1">
                  {result.actionType === 'raid' && '掠夺行动'}
                  {result.actionType === 'conquer' && '征服战争'}
                  {result.actionType === 'defend' && '防御作战'}
                  {result.actionType === 'scout' && '侦察任务'}
                </p>
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
          {/* 战斗统计 */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name="BarChart" size={16} className="text-blue-400" />
              战斗统计
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">我方战力</p>
                <p className="text-lg font-bold text-blue-400">
                  {result.ourPower?.toFixed(0) || 0}
                </p>
              </div>
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">敌方战力</p>
                <p className="text-lg font-bold text-red-400">
                  {result.enemyPower?.toFixed(0) || 0}
                </p>
              </div>
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">战力优势</p>
                <p className={`text-lg font-bold ${
                  result.powerRatio > 1 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.powerRatio?.toFixed(2) || 0}x
                </p>
              </div>
              <div className="bg-gray-700/50 p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">战斗评分</p>
                <p className="text-lg font-bold text-purple-400">
                  {result.score?.toFixed(0) || 0}
                </p>
              </div>
            </div>
          </div>

          {/* 我方损失 */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name="Heart" size={16} className="text-red-400" />
              我方损失
            </h3>
            {Object.keys(result.losses || {}).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(result.losses).map(([unitId, count]) => {
                  const unit = UNIT_TYPES[unitId];
                  return (
                    <div
                      key={unitId}
                      className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-3 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="User" size={14} className="text-red-400" />
                        <span className="text-sm text-white">{unit.name}</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">-{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 bg-green-900/20 border border-green-600/30 rounded">
                <Icon name="Check" size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-300">无损失！完美胜利！</p>
              </div>
            )}
          </div>

          {/* 敌方损失 */}
          {result.enemyLosses && Object.keys(result.enemyLosses).length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                <Icon name="Skull" size={16} className="text-gray-400" />
                敌方损失
              </h3>
              <div className="space-y-2">
                {Object.entries(result.enemyLosses).map(([unitId, count]) => {
                  const unit = UNIT_TYPES[unitId];
                  return (
                    <div
                      key={unitId}
                      className="flex items-center justify-between bg-gray-700/50 p-3 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="User" size={14} className="text-gray-400" />
                        <span className="text-sm text-white">{unit?.name || unitId}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-400">-{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 战利品 */}
          {result.victory && result.resourcesGained && Object.keys(result.resourcesGained).length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
                <Icon name="Gift" size={16} className="text-yellow-400" />
                战利品
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(result.resourcesGained).map(([resource, amount]) => (
                  <div
                    key={resource}
                    className="flex items-center justify-between bg-yellow-900/20 border border-yellow-600/30 p-3 rounded"
                  >
                    <span className="text-sm text-gray-300">{resource}</span>
                    <span className="text-sm font-bold text-yellow-400">+{amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 战斗描述 */}
          {result.description && (
            <div className="bg-gray-700/30 p-4 rounded border border-gray-600">
              <p className="text-sm text-gray-300 leading-relaxed">
                {result.description}
              </p>
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
