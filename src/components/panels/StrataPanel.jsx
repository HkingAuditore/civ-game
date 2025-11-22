// 社会阶层面板组件
// 显示各个社会阶层的人口、好感度和影响力

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';

/**
 * 社会阶层面板组件
 * 显示各个社会阶层的详细信息
 * @param {Object} popStructure - 人口结构对象
 * @param {Object} classApproval - 阶层好感度对象
 * @param {Object} classInfluence - 阶层影响力对象
 * @param {number} stability - 稳定度
 * @param {Function} onDetailClick - 点击详情回调
 */
export const StrataPanel = ({ 
  popStructure, 
  classApproval, 
  classInfluence, 
  stability,
  activeBuffs = [],
  activeDebuffs = [],
  classWealth = {},
  classWealthDelta = {},
  classShortages = {},
  onDetailClick 
}) => {
  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg min-h-[460px]">
      {/* 标题和稳定度 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Icon name="Users" size={16} />
          社会阶层
        </h3>
        
        {/* 稳定度指示器 */}
        <div className="flex items-center gap-1">
          <Icon 
            name="TrendingUp" 
            size={14} 
            className={
              stability >= 70 ? 'text-green-400' :
              stability >= 40 ? 'text-yellow-400' :
              'text-red-400'
            } 
          />
          <span className={`text-xs font-bold ${
            stability >= 70 ? 'text-green-400' :
            stability >= 40 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {stability.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 阶层列表 */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {Object.entries(STRATA).map(([key, info]) => {
          const count = popStructure[key] || 0;
          if (count === 0) return null;
          
          const approval = classApproval[key] || 50;
          const influence = classInfluence[key] || 0;
          const wealthValue = classWealth[key] ?? 0;
          const wealthDelta = classWealthDelta[key] ?? 0;
          const prevWealth = wealthValue - wealthDelta;
          let changeRate = 0;
          if (Math.abs(prevWealth) > 0.001) {
            changeRate = wealthDelta / prevWealth;
          } else if (wealthDelta > 0) {
            changeRate = 1;
          } else if (wealthDelta < 0) {
            changeRate = -1;
          }
          const deltaColor = wealthDelta > 0 ? 'text-green-400' : wealthDelta < 0 ? 'text-red-400' : 'text-gray-400';
          const rateText = `${changeRate > 0 ? '+' : changeRate < 0 ? '' : ''}${(changeRate * 100).toFixed(1)}%`;
          const shortages = classShortages[key] || [];
          
          return (
            <div 
              key={key}
              className="bg-gray-700/50 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => onDetailClick && onDetailClick(key)}
            >
              {/* 阶层名称和人口 */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon name={info.icon} size={14} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-200">
                    {info.name}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {count}人
                </span>
              </div>

              {/* 好感度进度条 */}
              <div className="mb-1">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-400">好感度</span>
                  <span className={
                    approval >= 70 ? 'text-green-400' :
                    approval >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }>
                    {approval.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      approval >= 70 ? 'bg-green-500' :
                      approval >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${approval}%` }}
                  />
                </div>
              </div>

              {/* 影响力 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">影响力</span>
                <span className="text-purple-400 font-semibold">
                  {influence.toFixed(1)}
                </span>
              </div>

              {/* 财富信息 */}
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-400 flex items-center gap-1">
                  <Icon name="Coins" size={12} className="text-yellow-400" />
                  财富
                </span>
                <div className="flex flex-col items-end text-right font-mono leading-tight">
                  <span className="text-gray-200 text-sm">{wealthValue.toFixed(1)}</span>
                  <span className={`${deltaColor} text-[11px]`}>
                    {wealthDelta > 0 ? '+' : ''}{wealthDelta.toFixed(1)} ({rateText})
                  </span>
                </div>
              </div>

              {/* 短缺资源提示 */}
              {shortages.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-red-300 mt-1 flex-wrap">
                  <Icon name="AlertTriangle" size={12} className="text-red-400" />
                  <span>短缺:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {shortages.map(resKey => {
                      const res = RESOURCES[resKey];
                      return (
                        <span
                          key={`${key}-${resKey}`}
                          className="px-1 py-0.5 bg-gray-800/60 rounded flex items-center"
                          title={`${res?.name || resKey} 供应不足`}
                        >
                          <Icon
                            name={res?.icon || 'HelpCircle'}
                            size={11}
                            className="text-red-300"
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 当前效果 */}
      <div className="mt-2 pt-2 border-t border-gray-700">
        <h4 className="text-xs font-bold text-gray-400 mb-1.5 flex items-center gap-1.5">
          <Icon name="Activity" size={14} />
          当前效果
        </h4>
        <div className="space-y-1 text-xs max-h-24 overflow-y-auto pr-1">
          {activeBuffs.map((buff, index) => {
            const details = formatEffectDetails(buff);
            return (
              <div key={`buff-${index}`} className="text-green-400">
                <div className="flex items-center gap-1.5">
                  <Icon name="ArrowUp" size={12} />
                  <span className="font-semibold">{buff.desc || '满意加成'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-4">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeDebuffs.map((debuff, index) => {
            const details = formatEffectDetails(debuff);
            return (
              <div key={`debuff-${index}`} className="text-red-400">
                <div className="flex items-center gap-1.5">
                  <Icon name="ArrowDown" size={12} />
                  <span className="font-semibold">{debuff.desc || '不满惩罚'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-4">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeBuffs.length === 0 && activeDebuffs.length === 0 && (
            <span className="text-gray-500 text-xs italic">无有效效果</span>
          )}
        </div>
      </div>

      {/* 查看详情按钮 */}
      <button
        onClick={() => onDetailClick && onDetailClick('all')}
        className="w-full mt-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors flex items-center justify-center gap-1"
      >
        <Icon name="Info" size={12} />
        查看详细信息
      </button>
    </div>
  );
};
