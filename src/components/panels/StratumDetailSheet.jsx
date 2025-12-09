import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';
import { isResourceUnlocked } from '../../utils/resources';

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
  epoch = 0,
  techsUnlocked = [],
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

  // Calculate living standard
  const wealthPerCapita = wealthValue / Math.max(count, 1);
  const startingWealth = stratum.startingWealth || 10;
  const wealthRatio = wealthPerCapita / startingWealth; // 1 = standard, >1 = wealthy, <1 = poor
  
  // Calculate wealth multiplier (same formula as simulation.js)
  // This represents actual consumption capacity
  let wealthMultiplier;
  if (wealthRatio <= 0) {
    wealthMultiplier = 0.3;
  } else if (wealthRatio < 1) {
    wealthMultiplier = 0.3 + wealthRatio * 0.7;
  } else {
    wealthMultiplier = Math.sqrt(wealthRatio) * (1 + Math.log(wealthRatio) * 0.2);
  }
  wealthMultiplier = Math.max(0.3, Math.min(5.0, wealthMultiplier));
  
  // Calculate how many luxury need tiers are unlocked
  const luxuryNeeds = stratum.luxuryNeeds || {};
  const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
  const unlockedLuxuryTiers = luxuryThresholds.filter(t => wealthRatio >= t).length;
  const totalLuxuryTiers = luxuryThresholds.length;
  
  // Calculate effective needs (base + unlocked luxury), only counting resources that are unlocked in current epoch/tech
  const baseNeedsCount = stratum.needs 
    ? Object.keys(stratum.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length 
    : 0;
  let effectiveNeedsCount = baseNeedsCount;
  let unlockedLuxuryNeedsDetail = [];
  for (const threshold of luxuryThresholds) {
    if (wealthRatio >= threshold) {
      const tierNeeds = luxuryNeeds[threshold];
      // Only count resources that are unlocked in current epoch/tech
      const unlockedTierResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
      const newResources = unlockedTierResources.filter(r => !stratum.needs?.[r]);
      if (unlockedTierResources.length > 0) {
        unlockedLuxuryNeedsDetail.push({ threshold, count: unlockedTierResources.length, newResources });
      }
      effectiveNeedsCount += newResources.length; // Only count truly new resources that are unlocked
    }
  }
  
  // Calculate needs satisfaction rate (based on shortages)
  const shortagesCount = shortages.length;
  const satisfactionRate = effectiveNeedsCount > 0 
    ? Math.max(0, (effectiveNeedsCount - shortagesCount) / effectiveNeedsCount)
    : 1;
  
  // Living standard is determined primarily by wealth ratio and luxury unlock
  // The thresholds are set higher to make progression more meaningful:
  // - 赤贫: wealthRatio < 0.5 (extreme poverty)
  // - 贫困: wealthRatio < 1 or low satisfaction (poverty)
  // - 温饱: wealthRatio < 2 or no luxury unlocked (basic survival)
  // - 小康: wealthRatio < 4 or < 30% luxury unlocked (comfortable)
  // - 富裕: wealthRatio < 8 or < 70% luxury unlocked (prosperous)
  // - 奢华: wealthRatio >= 8 and >= 70% luxury unlocked (luxurious)
  const luxuryUnlockRatio = totalLuxuryTiers > 0 ? unlockedLuxuryTiers / totalLuxuryTiers : 0;
  
  const getLivingStandardLevel = () => {
    if (wealthRatio < 0.5) {
      return { level: '赤贫', icon: 'Skull', color: 'text-gray-400', bgColor: 'bg-gray-900/30', borderColor: 'border-gray-500/30' };
    }
    if (wealthRatio < 1 || satisfactionRate < 0.5) {
      return { level: '贫困', icon: 'AlertTriangle', color: 'text-red-400', bgColor: 'bg-red-900/20', borderColor: 'border-red-500/30' };
    }
    // 温饱：财富刚好够基础需求，但还没有富裕需求
    if (wealthRatio < 2 || (totalLuxuryTiers > 0 && unlockedLuxuryTiers === 0)) {
      return { level: '温饱', icon: 'UtensilsCrossed', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-500/30' };
    }
    // 小康：开始解锁一些富裕需求，但不到30%
    if (wealthRatio < 4 || luxuryUnlockRatio < 0.3) {
      return { level: '小康', icon: 'Home', color: 'text-green-400', bgColor: 'bg-green-900/20', borderColor: 'border-green-500/30' };
    }
    // 富裕：解锁了相当多的富裕需求，但不到70%
    if (wealthRatio < 8 || luxuryUnlockRatio < 0.7) {
      return { level: '富裕', icon: 'Gem', color: 'text-blue-400', bgColor: 'bg-blue-900/20', borderColor: 'border-blue-500/30' };
    }
    // 奢华：财富极高且解锁了绝大多数富裕需求
    return { level: '奢华', icon: 'Crown', color: 'text-purple-400', bgColor: 'bg-purple-900/20', borderColor: 'border-purple-500/30' };
  };
  
  const livingStandard = getLivingStandardLevel();
  
  // Calculate a display score (for UI reference)
  // Score composition: wealth ratio (capped at 10x), satisfaction, luxury unlock
  const wealthScore = Math.min(40, wealthRatio * 4); // Max 40 points at 10x wealth
  const satisfactionScore = satisfactionRate * 30; // Max 30 points at 100% satisfaction
  const luxuryScore = luxuryUnlockRatio * 30; // Max 30 points at 100% luxury unlocked
  const livingStandardScore = Math.min(100, wealthScore + satisfactionScore + luxuryScore);

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

  // 筛选专属于该阶层的效果（使用class属性匹配当前阶层）
  const relevantBuffs = activeBuffs.filter(buff => 
    buff.class === stratumKey
  );
  const relevantDebuffs = activeDebuffs.filter(debuff => 
    debuff.class === stratumKey
  );

  return (
    <div className="space-y-2">
      {/* 头部：阶层名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name={stratum.icon} size={24} className="text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
<h2 className="text-lg font-bold text-white leading-tight font-decorative">{stratum.name}</h2>
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

      {/* 生活水平 */}
      <div className={`rounded p-2 border ${livingStandard.borderColor} ${livingStandard.bgColor}`}>
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="Activity" size={12} className="text-cyan-400" />
          生活水平
        </h3>
        <div className="flex items-center gap-3">
          {/* 等级图标和名称 */}
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${livingStandard.bgColor} border ${livingStandard.borderColor}`}>
              <Icon name={livingStandard.icon} size={20} className={livingStandard.color} />
            </div>
            <div>
              <div className={`text-lg font-bold ${livingStandard.color}`}>{livingStandard.level}</div>
              <div className="text-[9px] text-gray-400 leading-none">综合评分: {livingStandardScore.toFixed(0)}</div>
            </div>
          </div>
          
          {/* 详细指标 */}
          <div className="flex-1 grid grid-cols-3 gap-1.5">
            <div className="bg-gray-800/40 rounded px-2 py-1">
              <div className="text-[9px] text-gray-400 leading-none mb-0.5">人均财富</div>
              <div className="text-xs font-bold text-yellow-300 font-mono">{wealthPerCapita.toFixed(1)}</div>
              <div className="text-[8px] text-gray-500 leading-none">
                {wealthRatio >= 1 ? '↑' : '↓'} 基准{wealthRatio >= 1 ? '+' : ''}{((wealthRatio - 1) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-gray-800/40 rounded px-2 py-1">
              <div className="text-[9px] text-gray-400 leading-none mb-0.5">消费能力</div>
              <div className={`text-xs font-bold font-mono ${wealthMultiplier >= 2 ? 'text-purple-400' : wealthMultiplier >= 1.5 ? 'text-blue-400' : wealthMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                ×{wealthMultiplier.toFixed(2)}
              </div>
              <div className="text-[8px] text-gray-500 leading-none">
                需求购买倍率
              </div>
            </div>
            <div className="bg-gray-800/40 rounded px-2 py-1">
              <div className="text-[9px] text-gray-400 leading-none mb-0.5">需求满足</div>
              <div className={`text-xs font-bold font-mono ${satisfactionRate >= 0.8 ? 'text-green-400' : satisfactionRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {(satisfactionRate * 100).toFixed(0)}%
              </div>
              <div className="text-[8px] text-gray-500 leading-none">
                {effectiveNeedsCount - shortagesCount}/{effectiveNeedsCount} 项
              </div>
            </div>
          </div>
        </div>
        
        {/* 富裕需求解锁进度 - 只显示已解锁的档位，且只显示当前时代已解锁的资源 */}
        {unlockedLuxuryNeedsDetail.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-400">已解锁富裕需求</span>
              <span className="text-[9px] font-bold text-blue-400">
                {unlockedLuxuryNeedsDetail.length} 档
              </span>
            </div>
            <div className="flex gap-1">
              {unlockedLuxuryNeedsDetail.map(({ threshold, count }) => {
                const tierNeeds = luxuryNeeds[threshold];
                // Only show unlocked resources in tooltip
                const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                const resourceNames = unlockedResources.map(r => RESOURCES[r]?.name || r).join('、');
                return (
                  <div
                    key={threshold}
                    className="flex-1 rounded px-1.5 py-1 text-center bg-blue-900/30 border border-blue-500/40"
                    title={`${threshold}x财富解锁: ${resourceNames}`}
                  >
                    <div className="text-[9px] font-bold text-blue-300">
                      {threshold}×
                    </div>
                    <div className="text-[8px] text-gray-300">
                      +{count}项
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
          {totalLuxuryTiers > 0 && unlockedLuxuryTiers > 0 && (
            <span className="text-[8px] text-purple-400 ml-1">(含富裕需求)</span>
          )}
        </h3>
        
        {(() => {
          // Build effective needs map with source tracking
          const effectiveNeedsMap = {};
          // Add base needs (only if resource is unlocked)
          if (stratum.needs) {
            for (const [resKey, amount] of Object.entries(stratum.needs)) {
              // Skip resources that are not yet unlocked in current epoch/tech
              if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) continue;
              effectiveNeedsMap[resKey] = { amount, isBase: true, luxuryThreshold: null };
            }
          }
          // Add unlocked luxury needs (only if resource is unlocked)
          if (stratum.luxuryNeeds) {
            for (const threshold of luxuryThresholds) {
              if (wealthRatio >= threshold) {
                const tierNeeds = stratum.luxuryNeeds[threshold];
                for (const [resKey, amount] of Object.entries(tierNeeds)) {
                  // Skip resources that are not yet unlocked in current epoch/tech
                  if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) continue;
                  if (effectiveNeedsMap[resKey]) {
                    effectiveNeedsMap[resKey].amount += amount;
                    if (!effectiveNeedsMap[resKey].isBase) {
                      effectiveNeedsMap[resKey].luxuryThreshold = Math.min(effectiveNeedsMap[resKey].luxuryThreshold || Infinity, threshold);
                    }
                  } else {
                    effectiveNeedsMap[resKey] = { amount, isBase: false, luxuryThreshold: threshold };
                  }
                }
              }
            }
          }
          
          const effectiveNeedsEntries = Object.entries(effectiveNeedsMap);
          
          if (effectiveNeedsEntries.length === 0) {
            return (
              <div className="text-center text-gray-400 text-[10px] py-2">
                该阶层暂无特殊资源需求
              </div>
            );
          }
          
          return (
            <div className="space-y-1.5">
              {effectiveNeedsEntries.map(([resourceKey, { amount, isBase, luxuryThreshold }]) => {
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
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white leading-tight">{resource?.name || resourceKey}</span>
                        {!isBase && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30">
                            富裕 {luxuryThreshold}×
                          </span>
                        )}
                      </div>
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
          );
        })()}
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
