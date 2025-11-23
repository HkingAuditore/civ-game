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
  onDetailClick,
  dayScale = 1,
}) => {
  const safeDayScale = Math.max(dayScale, 0.0001);
  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg min-h-[460px] flex flex-col">
      {/* 标题和稳定度 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
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

      {/* 阶层列表 - 使用自定义滚动条样式 */}
      <div className="space-y-1 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500" style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '300px' }}>
        {Object.entries(STRATA).map(([key, info]) => {
          const count = popStructure[key] || 0;
          if (count === 0) return null;
          
          const approval = classApproval[key] || 50;
          const influence = classInfluence[key] || 0;
          const wealthValue = classWealth[key] ?? 0;
          const wealthDelta = classWealthDelta[key] ?? 0;
          const perClassDeltaPerDay = (classWealthDelta[key] || 0) / safeDayScale;
          const incomePerCapita = perClassDeltaPerDay / Math.max(count, 1);
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
              className="bg-gray-700/50 p-1.5 rounded hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => onDetailClick && onDetailClick(key)}
            >
              {/* 阶层名称、人口和好感度 - 合并为一行 */}
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <Icon name={info.icon} size={12} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-200">
                    {info.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {count}人
                  </span>
                  <span className={`text-[10px] font-mono ${incomePerCapita > 0 ? 'text-green-500' : incomePerCapita < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    ({incomePerCapita > 0 ? '人均收入: +' : '人均收入: '}{incomePerCapita.toFixed(2)}/天)
                  </span>
                </div>
                <span className={`text-[10px] font-semibold ${
                  approval >= 70 ? 'text-green-400' :
                  approval >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {approval.toFixed(0)}%
                </span>
              </div>

              {/* 好感度进度条 - 更细 */}
              <div className="mb-0.5">
                <div className="w-full bg-gray-600 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full transition-all ${
                      approval >= 70 ? 'bg-green-500' :
                      approval >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${approval}%` }}
                  />
                </div>
              </div>

              {/* 影响力和财富 - 合并为一行 */}
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">影响</span>
                  <span className="text-purple-400 font-semibold">
                    {influence.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="Coins" size={10} className="text-yellow-400" />
                  <span className="text-gray-200 font-mono">{wealthValue.toFixed(1)}</span>
                  <span className={`${deltaColor} font-mono`}>
                    {wealthDelta > 0 ? '+' : ''}{wealthDelta.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* 短缺资源提示 - 强化版，区分缺货和买不起 */}
              {shortages.length > 0 && (() => {
                // 统计不同类型的短缺
                const hasOutOfStock = shortages.some(s => {
                  const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                  return reason === 'outOfStock' || reason === 'both';
                });
                const hasUnaffordable = shortages.some(s => {
                  const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                  return reason === 'unaffordable' || reason === 'both';
                });
                
                // 根据短缺类型确定标签文字和样式
                let labelText = '短缺';
                let labelIcon = 'AlertTriangle';
                let labelBg = 'bg-red-900/30';
                let labelBorder = 'border-red-500/40';
                
                if (hasOutOfStock && hasUnaffordable) {
                  labelText = '缺货&买不起';
                  labelIcon = 'XCircle';
                  labelBg = 'bg-red-900/40';
                  labelBorder = 'border-red-600/50';
                } else if (hasUnaffordable) {
                  labelText = '买不起';
                  labelIcon = 'DollarSign';
                  labelBg = 'bg-orange-900/30';
                  labelBorder = 'border-orange-500/40';
                } else if (hasOutOfStock) {
                  labelText = '缺货';
                  labelIcon = 'Package';
                  labelBg = 'bg-red-900/30';
                  labelBorder = 'border-red-500/40';
                }
                
                return (
                  <div className={`flex items-center gap-1 text-[10px] text-red-300 flex-wrap ${labelBg} border ${labelBorder} rounded px-1.5 py-1 mt-0.5`}>
                    <Icon name={labelIcon} size={12} className="text-red-400 animate-pulse" />
                    <span className="text-red-200 font-semibold">{labelText}:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {shortages.map((shortage, idx) => {
                        // 兼容旧格式（字符串）和新格式（对象）
                        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                        const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
                        const res = RESOURCES[resKey];
                        
                        // 根据原因选择不同的样式和图标
                        let reasonIcon = 'AlertTriangle';
                        let reasonText = '供应不足';
                        let bgColor = 'bg-red-800/60';
                        let borderColor = 'border-red-500/60';
                        
                        if (reason === 'unaffordable') {
                          reasonIcon = 'DollarSign';
                          reasonText = '买不起';
                          bgColor = 'bg-orange-800/60';
                          borderColor = 'border-orange-500/60';
                        } else if (reason === 'outOfStock') {
                          reasonIcon = 'Package';
                          reasonText = '缺货';
                          bgColor = 'bg-red-800/60';
                          borderColor = 'border-red-500/60';
                        } else if (reason === 'both') {
                          reasonIcon = 'XCircle';
                          reasonText = '缺货且买不起';
                          bgColor = 'bg-red-900/80';
                          borderColor = 'border-red-600/80';
                        }
                      
                        return (
                          <span
                            key={`${key}-${resKey}-${idx}`}
                            className={`px-1 py-0.5 ${bgColor} border ${borderColor} rounded flex items-center gap-0.5 animate-pulse`}
                            title={`${res?.name || resKey} ${reasonText}`}
                          >
                            <Icon
                              name={reasonIcon}
                              size={10}
                              className="text-red-200"
                            />
                            <Icon
                              name={res?.icon || 'HelpCircle'}
                              size={11}
                              className="text-red-200"
                            />
                            <span className="text-red-100 font-medium text-[9px]">
                              {res?.name || resKey}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* 当前效果 - 更紧凑 */}
      <div className="mt-1.5 pt-1.5 border-t border-gray-700 flex-shrink-0">
        <h4 className="text-[10px] font-bold text-gray-400 mb-1 flex items-center gap-1">
          <Icon name="Activity" size={12} />
          当前效果
        </h4>
        <div className="space-y-0.5 text-[10px] max-h-20 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {activeBuffs.map((buff, index) => {
            const details = formatEffectDetails(buff);
            return (
              <div key={`buff-${index}`} className="text-green-400 leading-tight">
                <div className="flex items-center gap-1">
                  <Icon name="ArrowUp" size={10} />
                  <span className="font-semibold">{buff.desc || '满意加成'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-3 text-[9px]">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeDebuffs.map((debuff, index) => {
            const details = formatEffectDetails(debuff);
            return (
              <div key={`debuff-${index}`} className="text-red-400 leading-tight">
                <div className="flex items-center gap-1">
                  <Icon name="ArrowDown" size={10} />
                  <span className="font-semibold">{debuff.desc || '不满惩罚'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-3 text-[9px]">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeBuffs.length === 0 && activeDebuffs.length === 0 && (
            <span className="text-gray-500 text-[10px] italic">无有效效果</span>
          )}
        </div>
      </div>

      {/* 查看详情按钮 - 更紧凑 */}
      <button
        onClick={() => onDetailClick && onDetailClick('all')}
        className="w-full mt-1.5 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] rounded transition-colors flex items-center justify-center gap-1 flex-shrink-0"
      >
        <Icon name="Info" size={10} />
        查看详细信息
      </button>
    </div>
  );
};
