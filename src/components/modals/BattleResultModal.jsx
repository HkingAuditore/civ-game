// 战斗结果模态框组件
// 显示战斗结果的详细信息

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES } from '../../config/militaryUnits';
import { RESOURCES } from '../../config/gameConstants';

/**
 * 战斗结果模态框组件
 * 显示战斗结果的详细信息
 * @param {Object} result - 战斗结果对象
 * @param {Function} onClose - 关闭回调
 */
export const BattleResultModal = ({ result, onClose }) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  if (!result) return null;

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const animationClass = isAnimatingOut ? 'animate-sheet-out' : 'animate-sheet-in';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={handleClose}></div>

      {/* 内容面板 */}
      <div className={`relative w-full max-w-2xl bg-gray-800 border-t-2 lg:border-2 border-gray-700 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${animationClass} lg:animate-slide-up`}>
        {/* 头部 */}
        <div className={`flex-shrink-0 p-3 border-b border-gray-700 ${
          result.victory 
            ? 'bg-gradient-to-r from-green-900/50 to-blue-900/50' 
            : 'bg-gradient-to-r from-red-900/50 to-gray-900/50'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon 
                name={result.victory ? 'Trophy' : 'Skull'} 
                size={24} 
                className={result.victory ? 'text-yellow-400' : 'text-red-400'} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">
                {result.victory ? '🎉 战斗胜利！' : '💀 战斗失败...'}
              </h2>
              <p className="text-[10px] text-gray-300 leading-tight truncate">
                {result.missionName || '军事行动'} {result.missionDifficulty && `（${result.missionDifficulty}）`}
                {result.nationName && ` · 目标：${result.nationName}`}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-700 flex-shrink-0">
              <Icon name="X" size={18} className="text-gray-400" />
            </button>
          </div>
          {result.missionDesc && (
            <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">{result.missionDesc}</p>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 战斗统计 */}
          {(!result.isRaid || (result.isRaid && result.ourPower > 0)) && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="BarChart" size={12} className="text-blue-400" />
                战斗统计
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-gray-800/50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-400 mb-0.5 leading-none">我方战力</p>
                  <p className="text-sm font-bold text-blue-400 font-mono leading-none">
                    {result.ourPower?.toFixed(0) || 0}
                  </p>
                </div>
                <div className="bg-gray-800/50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-400 mb-0.5 leading-none">敌方战力</p>
                  <p className="text-sm font-bold text-red-400 font-mono leading-none">
                    {result.enemyPower?.toFixed(0) || 0}
                  </p>
                </div>
                <div className="bg-gray-800/50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-400 mb-0.5 leading-none">战力优势</p>
                  <p className={`text-sm font-bold font-mono leading-none ${
                    result.powerRatio > 1 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.powerRatio?.toFixed(2) || 0}x
                  </p>
                </div>
                <div className="bg-gray-800/50 p-1.5 rounded">
                  <p className="text-[9px] text-gray-400 mb-0.5 leading-none">战斗评分</p>
                  <p className="text-sm font-bold text-purple-400 font-mono leading-none">
                    {result.score?.toFixed(0) || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 我方损失 */}
          {(!result.isRaid || (result.isRaid && Object.keys(result.losses || result.defenderLosses || {}).length > 0)) && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="Heart" size={12} className="text-red-400" />
                我方损失
              </h3>
              {Object.keys(result.losses || result.defenderLosses || result.attackerLosses || {}).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(result.losses || result.defenderLosses || result.attackerLosses || {}).map(([unitId, count]) => {
                    const unit = UNIT_TYPES[unitId];
                    if (!unit || count === 0) return null;
                    return (
                      <div
                        key={unitId}
                        className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded"
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon name="User" size={12} className="text-red-400" />
                          <span className="text-[10px] text-white leading-none">{unit.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-2 bg-green-900/20 border border-green-600/30 rounded">
                  <Icon name="Check" size={16} className="text-green-400 mx-auto mb-1" />
                  <p className="text-[10px] text-green-300 leading-tight">无损失！完美胜利！</p>
                </div>
              )}
            </div>
          )}

          {/* 敌方损失 */}
          {(result.enemyLosses || result.attackerLosses) && Object.keys(result.enemyLosses || result.attackerLosses || {}).length > 0 && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="Skull" size={12} className="text-gray-400" />
                敌方损失
              </h3>
              <div className="space-y-1">
                {Object.entries(result.enemyLosses || result.attackerLosses || {}).map(([unitId, count]) => {
                  const unit = UNIT_TYPES[unitId];
                  if (!unit || count === 0) return null;
                  return (
                    <div
                      key={unitId}
                      className="flex items-center justify-between bg-gray-800/50 p-1.5 rounded"
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon name="User" size={12} className="text-gray-400" />
                        <span className="text-[10px] text-white leading-none">{unit?.name || unitId}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 font-mono leading-none">-{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 资源损失（突袭事件） */}
          {result.isRaid && (result.foodLoss > 0 || result.silverLoss > 0) && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="AlertTriangle" size={12} className="text-red-400" />
                资源损失
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {result.foodLoss > 0 && (
                  <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                    <span className="text-[10px] text-gray-300 leading-none">粮食</span>
                    <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.foodLoss}</span>
                  </div>
                )}
                {result.silverLoss > 0 && (
                  <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                    <span className="text-[10px] text-gray-300 leading-none">银币</span>
                    <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.silverLoss}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 人口损失（突袭事件） */}
          {result.isRaid && result.popLoss > 0 && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="Users" size={12} className="text-red-400" />
                人口损失
              </h3>
              <div className="bg-red-900/20 border border-red-600/30 p-1.5 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-300 leading-none">总人口</span>
                  <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.popLoss}</span>
                </div>
              </div>
            </div>
          )}

          {/* 战利品 */}
          {result.victory && result.resourcesGained && Object.keys(result.resourcesGained).length > 0 && (
            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
              <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
                <Icon name="Gift" size={12} className="text-yellow-400" />
                战利品
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(result.resourcesGained).map(([resource, amount]) => (
                  <div
                    key={resource}
                    className="flex items-center justify-between bg-yellow-900/20 border border-yellow-600/30 p-1.5 rounded"
                  >
                    <span className="text-[10px] text-gray-300 leading-none">{RESOURCES[resource]?.name || resource}</span>
                    <span className="text-[10px] font-bold text-yellow-400 font-mono leading-none">+{amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 战斗描述 */}
          {/*result.description && (
            <div className="bg-gray-700/30 p-2 rounded border border-gray-600">
              <p className="text-[10px] text-gray-300 leading-relaxed">
                {result.description}
              </p>
            </div>
          )*/}
        </div>

        {/* 底部按钮 */}
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
