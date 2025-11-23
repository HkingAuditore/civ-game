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
}) => {
  const safeDayScale = Math.max(dayScale, 0.0001);
  const [viewMode, setViewMode] = useState('card');
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
        const wealthDelta = classWealthDelta[key] ?? 0;
        const totalIncome = (classIncome[key] || 0) / safeDayScale;
        const totalExpense = (classExpense[key] || 0) / safeDayScale;
        const incomePerCapita = totalIncome / Math.max(count, 1);
        const expensePerCapita = totalExpense / Math.max(count, 1);
        const netIncomePerCapita = incomePerCapita - expensePerCapita;
        const deltaColor =
          wealthDelta > 0 ? 'text-green-400' : wealthDelta < 0 ? 'text-red-400' : 'text-gray-400';
        const shortages = classShortages[key] || [];

        return {
          key,
          info,
          count,
          approval,
          influence,
          wealthValue,
          wealthDelta,
          deltaColor,
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
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg min-h-[460px] flex flex-col">
      {/* 标题和稳定度 */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2 flex-shrink-0">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Icon name="Users" size={16} />
          社会阶层
        </h3>

        <div className="flex items-center gap-2">
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

          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-gray-700/50 rounded-full p-0.5">
            <button
              className={`px-2 py-1 rounded-full text-[11px] flex items-center gap-1 transition-colors ${
                viewMode === 'card'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              onClick={() => setViewMode('card')}
              title="卡片视图"
            >
              <Icon name="List" size={12} />
              卡片
            </button>
            <button
              className={`px-2 py-1 rounded-full text-[11px] flex items-center gap-1 transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
              onClick={() => setViewMode('table')}
              title="表格视图"
            >
              <Icon name="Table" size={12} />
              表格
            </button>
          </div>
        </div>
      </div>

      {/* 阶层列表 - 使用自定义滚动条样式 */}
      <div
        className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500"
        style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '300px' }}
      >
        {viewMode === 'card' ? (
          <div className="space-y-1">
            {strataData.map(
              ({
                key,
                info,
                count,
                approval,
                influence,
                wealthValue,
                wealthDelta,
                deltaColor,
                incomePerCapita,
                expensePerCapita,
                shortages,
              }) => (
                <div
                  key={key}
                  className="bg-gray-700/50 p-1.5 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => onDetailClick && onDetailClick(key)}
                >
                  {/* 阶层名称、人口和好感度 - 合并为一行 */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon name={info.icon} size={12} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-200">{info.name}</span>
                      <span className="text-[10px] text-gray-500">{count}人</span>
                    </div>
                    <span className={`text-[10px] font-semibold ${getApprovalColor(approval)}`}>
                      {approval.toFixed(0)}%
                    </span>
                  </div>

                  {/* 收入和支出 */}
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">收入</span>
                      <span className="text-green-300 font-mono">
                        +{incomePerCapita.toFixed(2)}/天
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-400">支出</span>
                      <span className="text-red-300 font-mono">
                        -{expensePerCapita.toFixed(2)}/天
                      </span>
                    </div>
                  </div>

                  {/* 好感度进度条 */}
                  <div className="mb-0.5">
                    <div className="w-full bg-gray-600 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all ${
                          approval >= 70 ? 'bg-green-500' : approval >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${approval}%` }}
                      />
                    </div>
                  </div>

                  {/* 影响力和财富 */}
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">影响</span>
                      <span className="text-purple-400 font-semibold">{influence.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name="Coins" size={10} className="text-yellow-400" />
                      <span className="text-gray-200 font-mono">{wealthValue.toFixed(1)}</span>
                      <span className={`${deltaColor} font-mono`}>
                        {wealthDelta > 0 ? '+' : ''}
                        {wealthDelta.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* 短缺资源提示 */}
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
                        className={`flex items-center gap-1 text-[10px] text-red-300 flex-wrap ${labelBg} border ${labelBorder} rounded px-1.5 py-1 mt-0.5`}
                      >
                        <Icon name={labelIcon} size={12} className="text-red-400 animate-pulse" />
                        <span className="text-red-200 font-semibold">{labelText}:</span>
                        <div className="flex items-center gap-1 flex-wrap">
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
                                className={`px-1 py-0.5 ${bgColor} border ${borderColor} rounded flex items-center gap-0.5 animate-pulse`}
                                title={`${res?.name || resKey} ${reasonText}`}
                              >
                                <Icon name={reasonIcon} size={10} className="text-red-200" />
                                <Icon name={res?.icon || 'HelpCircle'} size={11} className="text-red-200" />
                                <span className="text-red-100 font-medium text-[9px]">{res?.name || resKey}</span>
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
        ) : (
          <div className="bg-gray-900/40 rounded-lg border border-gray-700 overflow-x-auto">
            <table className="w-full text-[11px] text-gray-300">
              <thead className="text-gray-400 text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">阶层</th>
                  <th className="text-right px-3 py-2 font-semibold">人口</th>
                  <th className="text-right px-3 py-2 font-semibold">好感</th>
                  <th className="text-right px-3 py-2 font-semibold">影响</th>
                  <th className="text-right px-3 py-2 font-semibold">财富</th>
                  <th className="text-right px-3 py-2 font-semibold">收入</th>
                </tr>
              </thead>
              <tbody>
                {strataData.map((strata) => (
                  <tr
                    key={`table-${strata.key}`}
                    className="border-t border-gray-800 hover:bg-gray-800/60 cursor-pointer"
                    style={{ height: '28px' }}
                    onClick={() => onDetailClick && onDetailClick(strata.key)}
                  >
                    <td className="px-3 py-1.5 text-gray-200">
                      <div className="flex items-center gap-1.5">
                        <Icon name={strata.info.icon} size={12} className="text-gray-400" />
                        <span className="font-semibold">{strata.info.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-300">{strata.count}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${getApprovalColor(strata.approval)}`}>
                      {strata.approval.toFixed(0)}%
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-purple-300">
                      {strata.influence.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-200">
                      {strata.wealthValue.toFixed(1)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono ${
                        strata.netIncomePerCapita >= 0 ? 'text-green-300' : 'text-red-300'
                      }`}
                    >
                      {strata.netIncomePerCapita >= 0 ? '+' : ''}
                      {strata.netIncomePerCapita.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {strataData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                      暂无可显示的阶层数据。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
