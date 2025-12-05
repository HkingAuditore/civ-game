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
        const netWealthDelta = (classWealthDelta[key] || 0) / safeDayScale;
        const netIncomePerCapita =
          netWealthDelta !== undefined && netWealthDelta !== null
            ? netWealthDelta / Math.max(count, 1)
            : incomePerCapita - expensePerCapita;
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
    <div className="glass-epic p-1.5 rounded-xl border border-ancient-gold/20 shadow-epic min-h-[460px] flex flex-col relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/50 via-ancient-stone/20 to-ancient-ink/50 opacity-50" />
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <pattern id="strata-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="currentColor" className="text-ancient-gold" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#strata-pattern)" />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col h-full">
      {/* 标题和稳定度 */}
      {!hideTitle && (
        <div className="flex flex-wrap items-center justify-between mb-1 gap-1.5 flex-shrink-0">
          <h3 className="text-xs font-serif font-bold text-ancient flex items-center gap-1.5">
            <Icon name="Users" size={14} className="text-ancient-gold" />
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
      
      {/* 移动端稳定度显示（当标题隐藏时） */}
      {hideTitle && (
        <div className="flex items-center justify-center gap-1.5 mb-1.5 flex-shrink-0 bg-ancient-ink/30 rounded-lg px-2 py-1 border border-ancient-gold/20">
          <span className="text-[10px] text-ancient-stone">总体稳定度</span>
          <Icon 
            name="TrendingUp" 
            size={12} 
            className={
              stability >= 70 ? 'text-green-400' :
              stability >= 40 ? 'text-yellow-400' :
              'text-red-400'
            } 
          />
          <span className={`text-[11px] font-bold ${
            stability >= 70 ? 'text-green-400' :
            stability >= 40 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {stability.toFixed(0)}%
          </span>
        </div>
      )}

      {/* 阶层列表 - 使用自定义滚动条样式 */}
      <div
        className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500"
        style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '300px' }}
      >
        {/* 移动端和小窗口：网格布局 - 使用好感度作为背景填充 */}
        <div className="md:hidden grid grid-cols-3 sm:grid-cols-4 gap-1.5">
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
                className="relative rounded-lg overflow-hidden hover:scale-[1.02] transition-all cursor-pointer border border-ancient-gold/30 shadow-ancient hover:shadow-glow-gold backdrop-blur-sm"
                style={{
                  background: getApprovalBgGradient(strata.approval),
                }}
                onClick={() => onDetailClick && onDetailClick(strata.key)}
              >
                {/* 卡片内容 */}
                <div className="relative z-10 p-1">
                  {/* 头部：图标、阶层名称 */}
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-6 h-6 bg-ancient-ink/60 rounded flex items-center justify-center flex-shrink-0 border border-ancient-gold/20">
                      <Icon name={strata.info.icon} size={12} className="text-ancient-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-ancient-parchment truncate leading-tight">{strata.info.name}</div>
                      <div className="text-[8px] text-ancient-stone font-mono leading-none">{strata.count}</div>
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
                  <div className="bg-ancient-ink/60 rounded px-1 py-0.5 backdrop-blur-sm border border-ancient-gold/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-ancient-stone leading-none">净收入</span>
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
            <div className="col-span-full text-center text-ancient-stone opacity-70 text-[10px] py-4">
              暂无可显示的阶层数据。
            </div>
          )}
        </div>

        {/* 桌面端大窗口：卡片布局 */}
        <div className="hidden md:block space-y-1">
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
                  className="glass-ancient p-1.5 rounded-lg hover:bg-ancient-gold/10 transition-all cursor-pointer border border-ancient-gold/20 hover:border-ancient-gold/40 hover:shadow-glow-gold"
                  onClick={() => onDetailClick && onDetailClick(key)}
                >
                  {/* 阶层名称、人口和好感度 - 合并为一行 */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <Icon name={info.icon} size={10} className="text-ancient-gold" />
                      <span className="text-[11px] font-semibold text-ancient-parchment">{info.name}</span>
                      <span className="text-[9px] text-ancient-stone">{count}人</span>
                    </div>
                    <span className={`text-[9px] font-semibold font-mono ${getApprovalColor(approval)}`}>
                      {approval.toFixed(0)}%
                    </span>
                  </div>

                  {/* 收入、支出与净增（人均） - 更紧凑 */}
                  <div className="grid grid-cols-3 gap-0.5 text-[8px] mb-0.5 bg-ancient-ink/30 px-1 py-0.5 rounded border border-ancient-gold/10">
                    <div className="flex items-center gap-0.5" title="人均日收入">
                      <span className="text-ancient-stone">收</span>
                      <span className="text-green-300 font-mono">
                        +{incomePerCapita.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 justify-center" title="人均日支出">
                      <span className="text-ancient-stone">支</span>
                      <span className="text-red-300 font-mono">
                        -{expensePerCapita.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 justify-end" title="人均日净增">
                      <span className="text-ancient-stone">净</span>
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
                    <div className="w-full bg-ancient-ink/50 rounded-full h-0.5 border border-ancient-gold/10">
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
                      <span className="text-ancient-stone">影响</span>
                      <span className="text-purple-400 font-semibold font-mono">{influence.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-0.5" title="阶层总财富">
                      <Icon name="Coins" size={8} className="text-ancient-gold" />
                      <span className="text-ancient-parchment font-mono">{wealthValue.toFixed(0)}</span>
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
      <div className="mt-1 pt-1 border-t border-ancient-gold/20 flex-shrink-0">
        <h4 className="text-[14px] font-serif font-bold text-ancient-stone mb-0.5 flex items-center gap-0.5">
          <Icon name="Activity" size={10} className="text-ancient-gold " />
          当前效果
        </h4>
        <div className="space-y-0.5 text-[12px] max-h-16 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/30">
          {activeBuffs.map((buff, index) => {
            const details = formatEffectDetails(buff);
            return (
              <div key={`buff-${index}`} className="text-green-400 leading-tight">
                <div className="flex items-center gap-0.5">
                  <Icon name="ArrowUp" size={8} />
                  <span className="font-semibold">{buff.desc || '满意加成'}</span>
                </div>
                {details.length > 0 && (
                  <div className="text-ancient-parchment opacity-80 ml-2 text-[10px]">{details.join('，')}</div>
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
                  <div className="text-ancient-parchment opacity-70 ml-2 text-[10px]">{details.join('，')}</div>
                )}
              </div>
            );
          })}
          {activeBuffs.length === 0 && activeDebuffs.length === 0 && (
            <span className="text-ancient-stone opacity-60 text-[10px] italic">无有效效果</span>
          )}
        </div>
      </div>

      {/* 提示文字 - 替代无效的详情按钮 */}
      <div className="mt-1 px-1.5 py-1 bg-ancient-ink/30 rounded-lg border border-ancient-gold/10 flex-shrink-0">
        <p className="text-[8px] text-ancient-stone text-center flex items-center justify-center gap-1">
          <Icon name="Info" size={8} className="text-ancient-gold/60" />
          点击任意阶层卡片查看详细信息
        </p>
      </div>
      </div>
    </div>
  );
};
