import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';

/**
 * 阶层详情底部面板组件
 * 在BottomSheet中显示阶层的详细信息
 */
export const StratumDetailSheet = ({
  stratumKey,
  popStructure,
  classApproval,
  classInfluence,
  classWealth,
  classWealthDelta = {},
  classIncome,
  classExpense,
  classShortages,
  activeBuffs = [],
  activeDebuffs = [],
  dayScale = 1,
  taxPolicies,
  onUpdateTaxPolicies,
  onClose,
}) => {
  const safeDayScale = Math.max(dayScale, 0.0001);
  const stratum = STRATA[stratumKey];
  const [draftMultiplier, setDraftMultiplier] = useState(null);
  
  if (!stratum) {
    return (
      <div className="text-center text-gray-400 py-8">
        <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
        <p>未找到该阶层信息</p>
      </div>
    );
  }

  const count = popStructure[stratumKey] || 0;
  const approval = classApproval[stratumKey] || 50;
  const influence = classInfluence[stratumKey] || 0;
  const wealthValue = classWealth[stratumKey] ?? 0;
  const totalIncome = (classIncome[stratumKey] || 0) / safeDayScale;
  const totalExpense = (classExpense[stratumKey] || 0) / safeDayScale;
  const incomePerCapita = totalIncome / Math.max(count, 1);
  const expensePerCapita = totalExpense / Math.max(count, 1);
  const totalNetWealthChange = (classWealthDelta[stratumKey] || 0) / safeDayScale;
  const netIncomePerCapita =
    totalNetWealthChange !== undefined && totalNetWealthChange !== null
      ? totalNetWealthChange / Math.max(count, 1)
      : incomePerCapita - expensePerCapita;
  const shortages = classShortages[stratumKey] || [];
  const headTaxMultiplier = taxPolicies?.headTaxRates?.[stratumKey] ?? 1;

  const handleDraftChange = (raw) => {
    setDraftMultiplier(raw);
  };

  const commitDraft = () => {
    if (draftMultiplier === null || !onUpdateTaxPolicies) return;
    const parsed = parseFloat(draftMultiplier);
    const numeric = Number.isNaN(parsed) ? 1 : parsed; // 如果输入无效，重置为1
    onUpdateTaxPolicies(prev => ({
      ...prev,
      headTaxRates: {
        ...(prev?.headTaxRates || {}),
        [stratumKey]: numeric,
      },
    }));
    setDraftMultiplier(null);
  };


  const getApprovalColor = (value) => {
    if (value >= 70) return 'text-green-400';
    if (value >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getApprovalBgColor = (value) => {
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 筛选与该阶层相关的效果
  const relevantBuffs = activeBuffs.filter(buff => 
    !buff.targetClass || buff.targetClass === stratumKey
  );
  const relevantDebuffs = activeDebuffs.filter(debuff => 
    !debuff.targetClass || debuff.targetClass === stratumKey
  );

  return (
    <div className="space-y-2">
      {/* 头部：阶层名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name={stratum.icon} size={24} className="text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">{stratum.name}</h2>
          <p className="text-xs text-gray-400 leading-tight truncate">{stratum.desc}</p>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* 人口数量 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Users" size={12} className="text-blue-400" />
            <span className="text-[9px] text-gray-400 leading-none">人口</span>
          </div>
          <div className="text-sm font-bold text-white font-mono leading-none">{count}</div>
        </div>

        {/* 好感度 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Heart" size={12} className="text-pink-400" />
            <span className="text-[9px] text-gray-400 leading-none">好感</span>
          </div>
          <div className={`text-sm font-bold font-mono leading-none ${getApprovalColor(approval)}`}>
            {approval.toFixed(0)}%
          </div>
        </div>

        {/* 影响力 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Zap" size={12} className="text-purple-400" />
            <span className="text-[9px] text-gray-400 leading-none">影响</span>
          </div>
          <div className="text-sm font-bold text-purple-300 font-mono leading-none">{influence.toFixed(0)}</div>
        </div>

        {/* 财富总额 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Coins" size={12} className="text-yellow-400" />
            <span className="text-[9px] text-gray-400 leading-none">财富</span>
          </div>
          <div className="text-sm font-bold text-yellow-300 font-mono leading-none">{wealthValue.toFixed(0)}</div>
        </div>
      </div>

      {/* 人头税调整 */}
      {onUpdateTaxPolicies && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Sliders" size={12} className="text-yellow-400" />
            人头税调整
          </h3>
          <div className="grid grid-cols-2 gap-2 items-center">
            <div>
              <div className="text-[9px] text-gray-400 mb-0.5 leading-none">税率系数</div>
              <input
                type="text"
                inputMode="decimal"
                step="0.05"
                value={draftMultiplier ?? headTaxMultiplier}
                onChange={(e) => handleDraftChange(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitDraft();
                    e.target.blur();
                  }
                }}
                className="w-full bg-gray-900/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                placeholder="税率系数"
              />
            </div>
            <div>
              <div className="text-[9px] text-gray-400 mb-0.5 leading-none">实际税额 (每人每日)</div>
              <div className="bg-gray-800/50 rounded px-2 py-1.5 text-center">
                <span className={`text-sm font-bold font-mono ${
                  (stratum.headTaxBase * headTaxMultiplier) > 0 ? 'text-yellow-300' : (stratum.headTaxBase * headTaxMultiplier) < 0 ? 'text-green-300' : 'text-gray-400'
                }`}>
                  {(stratum.headTaxBase * headTaxMultiplier) < 0 ? '补贴 ' : ''}{Math.abs((stratum.headTaxBase || 0.01) * headTaxMultiplier).toFixed(3)}
                </span>
                <Icon 
                  name={(stratum.headTaxBase * headTaxMultiplier) > 0 ? "TrendingUp" : (stratum.headTaxBase * headTaxMultiplier) < 0 ? "TrendingDown" : "Coins"} 
                  size={12} 
                  className={`inline-block ml-1 ${
                    (stratum.headTaxBase * headTaxMultiplier) > 0 ? 'text-yellow-400' : (stratum.headTaxBase * headTaxMultiplier) < 0 ? 'text-green-400' : 'text-gray-500'
                  }`} 
                />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">实际税额 = 阶层基准税额 × 税率系数。负数系数代表补贴。</p>
        </div>
      )}

      {/* 收支情况 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="TrendingUp" size={12} className="text-green-400" />
          每日人均收支
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5 leading-none">收入</div>
            <div className="text-sm font-bold text-green-400 font-mono leading-none">
              +{incomePerCapita.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5 leading-none">支出</div>
            <div className="text-sm font-bold text-red-400 font-mono leading-none">
              -{expensePerCapita.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400 mb-0.5 leading-none">净收入</div>
            <div className={`text-sm font-bold font-mono leading-none ${netIncomePerCapita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {netIncomePerCapita >= 0 ? '+' : ''}{netIncomePerCapita.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* 资源需求 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="Package" size={12} className="text-amber-400" />
          资源需求清单
        </h3>
        
        {stratum.needs && Object.keys(stratum.needs).length > 0 ? (
          <div className="space-y-1.5">
            {Object.entries(stratum.needs).map(([resourceKey, amount]) => {
              const resource = RESOURCES[resourceKey];
              const shortage = shortages.find(s => 
                (typeof s === 'string' ? s : s.resource) === resourceKey
              );
              const isShortage = !!shortage;
              const reason = shortage && typeof shortage !== 'string' ? shortage.reason : 'outOfStock';
              
              let statusIcon = 'CheckCircle';
              let statusColor = 'text-green-400';
              let statusText = '✓ 需求已满足';
              let statusBg = 'bg-green-900/20';
              let borderColor = 'border-green-500/30';
              let reasonDetail = '';
              
              if (isShortage) {
                if (reason === 'unaffordable') {
                  statusIcon = 'DollarSign';
                  statusColor = 'text-orange-400';
                  statusText = '✗ 需求未满足';
                  statusBg = 'bg-orange-900/20';
                  borderColor = 'border-orange-500/40';
                  reasonDetail = '原因：该阶层买不起此资源';
                } else if (reason === 'outOfStock') {
                  statusIcon = 'XCircle';
                  statusColor = 'text-red-400';
                  statusText = '✗ 需求未满足';
                  statusBg = 'bg-red-900/20';
                  borderColor = 'border-red-500/40';
                  reasonDetail = '原因：市场上此资源缺货';
                } else if (reason === 'both') {
                  statusIcon = 'AlertTriangle';
                  statusColor = 'text-red-500';
                  statusText = '✗ 需求未满足';
                  statusBg = 'bg-red-900/30';
                  borderColor = 'border-red-500/50';
                  reasonDetail = '原因：市场缺货且该阶层买不起';
                }
              }
              
              return (
                <div 
                  key={resourceKey} 
                  className={`rounded p-2 border ${borderColor} ${statusBg} ${isShortage ? 'animate-pulse' : ''}`}
                >
                  {/* 资源名称和图标 */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-gray-800/60 rounded flex items-center justify-center flex-shrink-0">
                      <Icon name={resource?.icon || 'HelpCircle'} size={16} className={resource?.color || 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white leading-tight">{resource?.name || resourceKey}</div>
                      <div className="text-[9px] text-gray-400 leading-tight truncate">{resource?.desc || '资源描述'}</div>
                    </div>
                  </div>

                  {/* 需求量信息 */}
                  <div className="bg-gray-800/40 rounded px-2 py-1 mb-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-gray-400 leading-none">人均需求</span>
                      <span className="text-[10px] font-bold text-white font-mono leading-none">{amount}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-gray-400 leading-none">总需求</span>
                      <span className="text-[10px] font-bold text-blue-300 font-mono leading-none">{(amount * count).toFixed(0)}</span>
                    </div>
                  </div>

                  {/* 满足状态 */}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${statusBg}`}>
                    <Icon name={statusIcon} size={12} className={statusColor} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold ${statusColor} leading-tight`}>{statusText}</div>
                      {reasonDetail && (
                        <div className={`text-[9px] ${statusColor} leading-tight truncate`}>{reasonDetail}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-400 text-[10px] py-2">
            该阶层暂无特殊资源需求
          </div>
        )}
      </div>

      {/* 激活效果 */}
      {(relevantBuffs.length > 0 || relevantDebuffs.length > 0) && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Activity" size={12} className="text-blue-400" />
            激活效果
          </h3>
          <div className="space-y-1">
            {relevantBuffs.map((buff, index) => {
              const details = formatEffectDetails(buff);
              return (
                <div key={`buff-${index}`} className="bg-green-900/20 border border-green-500/30 rounded p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Icon name="ArrowUp" size={10} className="text-green-400" />
                    <span className="text-[10px] font-semibold text-green-300 leading-tight">{buff.desc || '满意加成'}</span>
                  </div>
                  {details.length > 0 && (
                    <div className="text-[9px] text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
                  )}
                </div>
              );
            })}
            {relevantDebuffs.map((debuff, index) => {
              const details = formatEffectDetails(debuff);
              return (
                <div key={`debuff-${index}`} className="bg-red-900/20 border border-red-500/30 rounded p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Icon name="ArrowDown" size={10} className="text-red-400" />
                    <span className="text-[10px] font-semibold text-red-300 leading-tight">{debuff.desc || '不满惩罚'}</span>
                  </div>
                  {details.length > 0 && (
                    <div className="text-[9px] text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
