// 社会阶层面板组件
// 显示各个社会阶层的人口、好感度和影响力

import React, { useMemo, useState } from 'react';
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
  classIncome = {},
  classExpense = {},
  onDetailClick,
  dayScale = 1,
  hideTitle = false,  // 新增：是否隐藏标题
}) => {
  const safeDayScale = Math.max(dayScale, 0.0001);
  // 移除viewMode状态，因为我们将根据屏幕尺寸自动切换
  const getApprovalColor = (value) => {
    if (value >= 70) return 'text-green-400';
    if (value >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };
  const strataData = useMemo(() => {
    return Object.entries(STRATA)
      .map(([key, info]) => {
        const count = popStructure[key] || 0;
        const approval = classApproval[key] || 50;
        const influence = classInfluence[key] || 0;
        const wealthValue = classWealth[key] ?? 0;
        const totalIncome = (classIncome[key] || 0) / safeDayScale;
        const totalExpense = (classExpense[key] || 0) / safeDayScale;
        const incomePerCapita = totalIncome / Math.max(count, 1);
        const expensePerCapita = totalExpense / Math.max(count, 1);
        const netIncomePerCapita = incomePerCapita - expensePerCapita;
        const shortages = classShortages[key] || [];

        return {
          key,
          info,
          count,
          approval,
          influence,
          wealthValue,
          incomePerCapita,
          expensePerCapita,
          netIncomePerCapita,
          shortages,
        };
      })
      .filter((entry) => entry.count > 0);
  }, [
    popStructure,
    classApproval,
    classInfluence,
    classWealth,
    classWealthDelta,
    classIncome,
    classExpense,
    classShortages,
    safeDayScale,
  ]);
  return (
    <div className="bg-gray-800 p-1.5 rounded-lg border border-gray-700 shadow-lg min-h-[460px] flex flex-col">
      {/* 标题和稳定度 */}
      {!hideTitle && (
        <div className="flex flex-wrap items-center justify-between mb-1 gap-1.5 flex-shrink-0">
          <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Icon name="Users" size={14} />
            社会阶层
          </h3>

          {/* 稳定度指示器 */}
          <div className="flex items-center gap-0.5">
            <Icon 
              name="TrendingUp" 
              size={12} 
              className={
                stability >= 70 ? 'text-green-400' :
                stability >= 40 ? 'text-yellow-400' :
                'text-red-400'
              } 
            />
            <span className={`text-[10px] font-bold ${
              stability >= 70 ? 'text-green-400' :
              stability >= 40 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {stability.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* 阶层列表 - 使用自定义滚动条样式 */}
      <div
        className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500"
        style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '300px' }}
      >
        {/* 移动端和小窗口：网格布局 - 使用好感度作为背景填充 */}
        <div className="lg:hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
          {strataData.map((strata) => {
            // 计算好感度对应的背景颜色
            const getApprovalBgGradient = (approval) => {
              if (approval >= 70) {
                return `linear-gradient(to right, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.15) ${approval}%, rgba(31, 41, 55, 0.5) ${approval}%, rgba(31, 41, 55, 0.5) 100%)`;
              } else if (approval >= 40) {
                return `linear-gradient(to right, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.15) ${approval}%, rgba(31, 41, 55, 0.5) ${approval}%, rgba(31, 41, 55, 0.5) 100%)`;
              } else {
                return `linear-gradient(to right, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.15) ${approval}%, rgba(31, 41, 55, 0.5) ${approval}%, rgba(31, 41, 55, 0.5) 100%)`;
              }
            };

            return (
              <div
                key={`grid-${strata.key}`}
                className="relative rounded overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer border border-gray-600/50 shadow-sm"
                style={{
                  background: getApprovalBgGradient(strata.approval),
                }}
                onClick={() => onDetailClick && onDetailClick(strata.key)}
              >
                {/* 卡片内容 */}
                <div className="relative z-10 p-1">
                  {/* 头部：图标、阶层名称 */}
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-6 h-6 bg-gray-800/60 rounded flex items-center justify-center flex-shrink-0">
                      <Icon name={strata.info.icon} size={12} className="text-gray-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white truncate leading-tight">{strata.info.name}</div>
                      <div className="text-[8px] text-gray-300 font-mono leading-none">{strata.count}</div>
                    </div>
                    {/* 短缺闪烁图标 */}
                    {strata.shortages.length > 0 && (
                      <div className="flex-shrink-0">
                        <Icon 
                          name="AlertTriangle" 
                          size={10} 
                          className="text-red-400 animate-pulse drop-shadow-[0_0_3px_rgba(248,113,113,0.8)]" 
                        />
                      </div>
                    )}
                  </div>

                  {/* 每日人均净收入 */}
                  <div className="bg-gray-900/60 rounded px-1 py-0.5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-gray-400 leading-none">净收入</span>
                      <span
                        className={`text-[9px] font-bold font-mono leading-none ${
                          strata.netIncomePerCapita >= 0 ? 'text-green-300' : 'text-red-300'
                        }`}
                      >
                        {strata.netIncomePerCapita >= 0 ? '+' : ''}
                        {strata.netIncomePerCapita.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {strataData.length === 0 && (
            <div className="col-span-full text-center text-gray-500 text-[10px] py-4">
              暂无可显示的阶层数据。
            </div>
          )}
        </div>

        {/* 桌面端大窗口：卡片布局 */}
        <div className="hidden lg:block space-y-0.5">
          {strataData.map(
            ({
              key,
              info,
              count,
              approval,
              influence,
              wealthValue,
              incomePerCapita,
              expensePerCapita,
              netIncomePerCapita,
              shortages,
            }) => (
                <div
                  key={key}
                  className="bg-gray-700/50 p-1 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => onDetailClick && onDetailClick(key)}
                >
                  {/* 阶层名称、人口和好感度 - 合并为一行 */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <Icon name={info.icon} size={10} className="text-gray-400" />
                      <span className="text-[10px] font-semibold text-gray-200">{info.name}</span>
                      <span className="text-[8px] text-gray-500">{count}人</span>
                    </div>
                    <span className={`text-[9px] font-semibold font-mono ${getApprovalColor(approval)}`}>
                      {approval.toFixed(0)}%
                    </span>
                  </div>

                  {/* 收入、支出与净增（人均） - 更紧凑 */}
                  <div className="grid grid-cols-3 gap-0.5 text-[8px] mb-0.5 bg-gray-900/30 px-1 py-0.5 rounded">
                    <div className="flex items-center gap-0.5" title="人均日收入">
                      <span className="text-gray-500">收</span>
                      <span className="text-green-300 font-mono">
                        +{incomePerCapita.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 justify-center" title="人均日支出">
                      <span className="text-gray-500">支</span>
                      <span className="text-red-300 font-mono">
                        -{expensePerCapita.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 justify-end" title="人均日净增">
                      <span className="text-gray-500">净</span>
                      <span
                        className={`font-mono ${
                          netIncomePerCapita >= 0 ? 'text-green-300' : 'text-red-300'
                        }`}
                      >
                        {netIncomePerCapita > 0 ? '+' : ''}
                        {netIncomePerCapita.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* 好感度进度条 - 更细 */}
                  <div className="mb-0.5">
                    <div className="w-full bg-gray-600 rounded-full h-0.5">
                      <div
                        className={`h-0.5 rounded-full transition-all ${
                          approval >= 70 ? 'bg-green-500' : approval >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${approval}%` }}
                      />
                    </div>
                  </div>

                  {/* 影响力和财富 - 更紧凑 */}
                  <div className="flex items-center justify-between text-[8px]">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">影响</span>
                      <span className="text-purple-400 font-semibold font-mono">{influence.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-0.5" title="阶层总财富">
                      <Icon name="Coins" size={8} className="text-yellow-400" />
                      <span className="text-gray-200 font-mono">{wealthValue.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* 短缺资源提示 - 更紧凑 */}
                  {shortages.length > 0 && (() => {
                    const hasOutOfStock = shortages.some((s) => {
                      const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                      return reason === 'outOfStock' || reason === 'both';
                    });
                    const hasUnaffordable = shortages.some((s) => {
                      const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                      return reason === 'unaffordable' || reason === 'both';
                    });

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
                      <div
                        className={`flex items-center gap-0.5 text-[8px] text-red-300 flex-wrap ${labelBg} border ${labelBorder} rounded px-1 py-0.5 mt-0.5`}
                      >
                        <Icon name={labelIcon} size={10} className="text-red-400 animate-pulse" />
                        <span className="text-red-200 font-semibold">{labelText}:</span>
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {shortages.map((shortage, idx) => {
                            const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                            const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
                            const res = RESOURCES[resKey];

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
                                className={`px-0.5 py-0.5 ${bgColor} border ${borderColor} rounded flex items-center gap-0.5 animate-pulse`}
                                title={`${res?.name || resKey} ${reasonText}`}
                              >
                                <Icon name={reasonIcon} size={8} className="text-red-200" />
                                <Icon name={res?.icon || 'HelpCircle'} size={9} className="text-red-200" />
                                <span className="text-red-100 font-medium text-[8px]">{res?.name || resKey}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            )}
        </div>
      </div>

      {/* 当前效果 - 更紧凑 */}
      <div className="mt-1 pt-1 border-t border-gray-700 flex-shrink-0">
        <h4 className="text-[9px] font-bold text-gray-400 mb-0.5 flex items-center gap-0.5">
          <Icon name="Activity" size={10} />
          当前效果
        </h4>
        <div className="space-y-0.5 text-[8px] max-h-16 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {activeBuffs.map((buff, index) => {
            const details = formatEffectDetails(buff);
            return (
              <div key={`buff-${index}`} className="text-green-400 leading-tight">
                <div className="flex items-center gap-0.5">
                  <Icon name="ArrowUp" size={8} />
                  <span className="font-semibold">{buff.desc || '满意加成'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-2 text-[7px]">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeDebuffs.map((debuff, index) => {
            const details = formatEffectDetails(debuff);
            return (
              <div key={`debuff-${index}`} className="text-red-400 leading-tight">
                <div className="flex items-center gap-0.5">
                  <Icon name="ArrowDown" size={8} />
                  <span className="font-semibold">{debuff.desc || '不满惩罚'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-gray-300 ml-2 text-[7px]">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeBuffs.length === 0 && activeDebuffs.length === 0 && (
            <span className="text-gray-500 text-[8px] italic">无有效效果</span>
          )}
        </div>
      </div>

      {/* 查看详情按钮 - 更紧凑 */}
      <button
        onClick={() => onDetailClick && onDetailClick('all')}
        className="w-full mt-1 px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[9px] rounded transition-colors flex items-center justify-center gap-0.5 flex-shrink-0"
      >
        <Icon name="Info" size={9} />
        查看详细信息
      </button>
    </div>
  );
};
