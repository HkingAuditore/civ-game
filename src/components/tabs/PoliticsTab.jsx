// 政令标签页组件
// 显示可用政令和切换功能

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, EPOCHS } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';

// 定义阶层分组，用于UI显示
const STRATA_GROUPS = {
  upper: {
    name: '上流阶级',
    keys: ['merchant', 'official', 'landowner', 'capitalist', 'knight', 'engineer'],
  },
  middle: {
    name: '中产阶级',
    keys: ['worker', 'artisan', 'miner', 'soldier', 'cleric', 'scribe', 'navigator'],
  },
  lower: {
    name: '底层阶级',
    keys: ['unemployed', 'peasant', 'serf', 'lumberjack', 'slave'],
  },
};

// 定义资源分组
const RESOURCE_GROUPS = {
  basic: {
    name: '基础资源',
    keys: ['food', 'wood', 'stone', 'cloth'],
  },
  industrial: {
    name: '工业原料',
    keys: ['brick', 'plank', 'copper', 'tools', 'dye', 'iron', 'coal', 'steel'],
  },
  consumer: {
    name: '消费品',
    keys: ['papyrus', 'delicacies', 'furniture', 'ale', 'fine_clothes', 'spice', 'coffee'],
  }
};
const ALL_GROUPED_RESOURCES = new Set(Object.values(RESOURCE_GROUPS).flatMap(g => g.keys));

// 紧凑型资源税卡片
const ResourceTaxCard = ({ resourceKey, info, rate, hasSupply, onChange }) => (
  <div 
    className={`bg-gray-900/40 p-2.5 rounded-lg border flex flex-col justify-between transition-opacity ${
      hasSupply ? 'border-gray-700/60' : 'border-gray-800/50 opacity-50'
    }`}
  >
    <div>
      {/* 头部：Icon + 名称 + 缺货标记 */}
      <div className="flex items-center gap-2 mb-1">
        <Icon name={info.icon || 'Box'} size={14} className={info.color || 'text-gray-400'} />
        <span className="font-semibold text-gray-300 text-xs flex-grow whitespace-nowrap overflow-hidden text-ellipsis">{info.name}</span>
        {!hasSupply && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="当前无市场供应"></div>}
      </div>
      {/* 状态栏：当前税率 */}
      <div className="text-center my-1">
        <span className="font-mono text-blue-300 text-lg">
          {((rate ?? 0) * 100).toFixed(0)}<span className="text-xs">%</span>
        </span>
      </div>
    </div>
    {/* 控制区：滑动条 */}
    <input
      type="range"
      min="0"
      max="2.0" // 最大税率200%
      step="0.01"
      value={rate ?? 0}
      onChange={(e) => onChange(resourceKey, e.target.value)}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
    />
  </div>
);

/**
 * 政令标签页组件
 * 显示所有政令及其效果
 * @param {Array} decrees - 政令数组
 * @param {Function} onToggle - 切换政令回调
 * @param {Object} taxPolicies - 税收策略
 * @param {Function} onUpdateTaxPolicies - 更新税收策略回调
 * @param {Object} popStructure - 当前人口结构
 * @param {number} epoch - 当前时代编号
 */
export const PoliticsTab = ({ decrees, onToggle, taxPolicies, onUpdateTaxPolicies, popStructure = {}, market = {}, epoch = 0, techsUnlocked = [] }) => {
  // 按类别分组政令
  const categories = {
    economy: { name: '经济政策', icon: 'Coins', color: 'text-yellow-400' },
    military: { name: '军事政策', icon: 'Shield', color: 'text-red-400' },
    culture: { name: '文化政策', icon: 'Book', color: 'text-purple-400' },
    social: { name: '社会政策', icon: 'Users', color: 'text-blue-400' },
  };

  const unlockedDecrees = (decrees || []).filter(d => (d.unlockEpoch ?? 0) <= epoch);
  const lockedDecrees = (decrees || []).filter(d => (d.unlockEpoch ?? 0) > epoch);
  const nextUnlockEpoch = lockedDecrees.length > 0
    ? lockedDecrees.reduce((min, d) => {
        const value = d.unlockEpoch ?? Infinity;
        return value < min ? value : min;
      }, Infinity)
    : null;
  const nextUnlockEpochName = Number.isFinite(nextUnlockEpoch)
    ? (EPOCHS[nextUnlockEpoch]?.name || `第 ${nextUnlockEpoch + 1} 个时代`)
    : null;
  const unlockedActiveCount = unlockedDecrees.filter(d => d.active).length;
  const unlockedInactiveCount = unlockedDecrees.length - unlockedActiveCount;
  const policyEfficiency = unlockedDecrees.length > 0
    ? ((unlockedActiveCount / unlockedDecrees.length) * 100).toFixed(0)
    : '0';

  const decreesByCategory = unlockedDecrees.reduce((acc, decree) => {
    const category = decree.category || 'social';
    if (!acc[category]) acc[category] = [];
    acc[category].push(decree);
    return acc;
  }, {});

  const headRates = taxPolicies?.headTaxRates || {};
  const resourceRates = taxPolicies?.resourceTaxRates || {};
  const [headDrafts, setHeadDrafts] = React.useState({});
  
  // 获取所有已解锁的阶层
  const unlockedStrataKeys = React.useMemo(() => {
    return Object.keys(STRATA).filter(key => {
      const stratum = STRATA[key];
      // 检查阶层是否在当前时代已解锁（如果没有明确解锁时代，默认为已解锁）
      if (stratum.unlockEpoch !== undefined && stratum.unlockEpoch > epoch) {
        return false;
      }
      // 检查科技要求
      if (stratum.unlockTech && !techsUnlocked.includes(stratum.unlockTech)) {
        return false;
      }
      return true;
    });
  }, [epoch, techsUnlocked]);

  const strataToDisplay = React.useMemo(
    () => unlockedStrataKeys,
    [unlockedStrataKeys]
  );

  // 处理人头税临时输入变化的逻辑
  const handleHeadDraftChange = (key, raw) => {
    setHeadDrafts(prev => ({ ...prev, [key]: raw }));
  };

  // 提交人头税修改的逻辑
  const commitHeadDraft = (key) => {
    if (headDrafts[key] === undefined) return;
    const parsed = parseFloat(headDrafts[key]);
    const numeric = Number.isNaN(parsed) ? 1 : parsed; // 如果输入无效，重置为1
    onUpdateTaxPolicies(prev => ({
      ...prev,
      headTaxRates: {
        ...(prev?.headTaxRates || {}),
        [key]: numeric,
      },
    }));
    setHeadDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResourceTaxChange = (key, value) => {
    if (!onUpdateTaxPolicies) return;
    const parsed = parseFloat(value);
    const numeric = Number.isNaN(parsed) ? 0 : parsed;
    onUpdateTaxPolicies(prev => ({
      ...prev,
      resourceTaxRates: {
        ...(prev?.resourceTaxRates || {}),
        [key]: numeric,
      },
    }));
  };
  
  // 获取所有已解锁的资源
  const unlockedResourceKeys = React.useMemo(() => {
    return Object.keys(RESOURCES).filter(key => {
      const resource = RESOURCES[key];
      // 跳过虚拟资源和货币类型
      if (resource.type && (resource.type === 'virtual' || resource.type === 'currency')) {
        return false;
      }
      // 检查资源是否已解锁
      return isResourceUnlocked(key, epoch, techsUnlocked);
    });
  }, [epoch, techsUnlocked]);

  const marketResourceKeys = Object.entries(market?.supply || {})
    .filter(([, amount]) => amount > 0)
    .map(([key]) => key);

  const orderedResourceKeys = React.useMemo(() => {
    if (unlockedResourceKeys.length === 0) return [];
    const ordered = [...marketResourceKeys];
    unlockedResourceKeys.forEach((key) => {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    });
    return ordered;
  }, [marketResourceKeys, unlockedResourceKeys]);

  const taxableResources = orderedResourceKeys
    .map(key => [key, RESOURCES[key]])
    .filter(([, info]) => info && (!info.type || (info.type !== 'virtual' && info.type !== 'currency')));

  // 渲染单个阶层的人头税卡片
  const renderStratumCard = (key) => {
    const stratumInfo = STRATA[key] || {};
    const base = stratumInfo.headTaxBase ?? 0.01;
    const finalRate = (headRates[key] ?? 1) * base;
    const population = popStructure[key] || 0;
    const hasPopulation = population > 0;

    return (
      <div 
        key={key} 
        className={`bg-gray-900/40 p-2 rounded-md border text-xs flex flex-col gap-2 ${
          hasPopulation ? 'border-gray-700/60' : 'border-gray-800 opacity-60'
        }`}
      >
        {/* 第一行：Icon, 名称, 人口 */}
        <div className="flex items-center gap-1.5">
          <Icon name={stratumInfo.icon || 'User'} size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-300 flex-grow">{stratumInfo.name || key}</span>
          <span className="text-gray-500 text-[10px] font-mono">{population.toLocaleString()} 人</span>
        </div>

        {/* 第二行：税率和输入框（始终显示） */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-yellow-400 whitespace-nowrap text-[10px]">
            {finalRate.toFixed(3)}/人
          </span>
          <input
            type="text"
            inputMode="decimal"
            step="0.05"
            value={headDrafts[key] ?? (headRates[key] ?? 1)}
            onChange={(e) => handleHeadDraftChange(key, e.target.value)}
            onBlur={() => commitHeadDraft(key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitHeadDraft(key);
                e.target.blur();
              }
            }}
            className="w-full bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="税率系数"
          />
        </div>
      </div>
    );
  };

  const allGroupKeys = new Set(Object.values(STRATA_GROUPS).flatMap(g => g.keys));
  
  const renderResourceGroup = (group, resources) => {
    const groupResources = resources.filter(([key]) => group.keys.includes(key));
    if (groupResources.length === 0) return null;

    return (
      <div key={group.name} className="mb-4">
        <h5 className="text-xs font-semibold text-gray-400 mb-2">{group.name}</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {groupResources.map(([key, info]) => (
            <ResourceTaxCard
              key={key}
              resourceKey={key}
              info={info}
              rate={resourceRates[key]}
              hasSupply={(market?.supply?.[key] || 0) > 0}
              onChange={handleResourceTaxChange}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 政令说明 */}
      <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-300 mb-1">关于政令</h3>
            <p className="text-xs text-gray-300">
              政令是国家的政策方针，可以带来各种加成或减益。激活的政令会立即生效，
              但某些政令可能会影响社会阶层的满意度。请根据国家发展需要谨慎选择。
            </p>
          </div>
        </div>
      </div>

      {/* 税收政策调节 */}
      {onUpdateTaxPolicies && (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
            <Icon name="Sliders" size={16} className="text-green-400" />
            税收政策
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 人头税部分 */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-1">人头税（按日结算）</h4>
                <p className="text-[11px] text-gray-500 mb-3">针对每位在职人口，按阶层基准税率 × 调整系数收取银币。若为负数，则为补助。</p>
              </div>
              
              {/* 遍历阶层分组来渲染UI */}
              {Object.values(STRATA_GROUPS).map(group => {
                // 筛选出当前分组下需要显示的阶层
                const groupStrata = strataToDisplay.filter(key => group.keys.includes(key));
                if (groupStrata.length === 0) return null;

                return (
                  <div key={group.name}>
                    <h5 className="text-xs font-semibold text-gray-400 mb-2">{group.name}</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {groupStrata.map(renderStratumCard)}
                    </div>
                  </div>
                );
              })}

              {/* 处理未分组的阶层 */}
              {(() => {
                const ungroupedStrata = strataToDisplay.filter(key => !allGroupKeys.has(key));
                if (ungroupedStrata.length === 0) return null;

                return (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-400 mb-2">其他</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ungroupedStrata.map(renderStratumCard)}
                    </div>
                  </div>
                );
              })()}

              {strataToDisplay.length === 0 && (
                <p className="text-xs text-gray-500">暂无需征税的阶层</p>
              )}
            </div>

            {/* 资源税部分 */}
            <div className="max-h-[500px] overflow-y-auto pr-2">
              <h4 className="text-xs font-semibold text-gray-400 mb-1">资源交易税</h4>
              <p className="text-[11px] text-gray-500 mb-3">对市场交易的资源，按成交额收取固定比例的税，会计入国库。</p>
              
              {Object.values(RESOURCE_GROUPS).map(group => renderResourceGroup(group, taxableResources))}
              
              {(() => {
                const ungroupedResources = taxableResources.filter(([key]) => !ALL_GROUPED_RESOURCES.has(key));
                if (ungroupedResources.length === 0) return null;
                return (
                   <div key="other-resources" className="mb-4">
                    <h5 className="text-xs font-semibold text-gray-400 mb-2">其他</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {ungroupedResources.map(([key, info]) => (
                        <ResourceTaxCard
                          key={key}
                          resourceKey={key}
                          info={info}
                          rate={resourceRates[key]}
                          hasSupply={(market?.supply?.[key] || 0) > 0}
                          onChange={handleResourceTaxChange}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {taxableResources.length === 0 && (
                  <p className="text-xs text-gray-500 mt-4">当前市场暂无可征税资源</p>
              )}
            </div>
          </div>
        </div>
      )}

      {unlockedDecrees.length === 0 && (
        <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg text-xs text-yellow-100">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <Icon name="Lock" size={14} className="text-yellow-300" />
            当前时代暂无可颁布政令
          </p>
          <p>
            升级到 {nextUnlockEpochName || '更高时代'} 后可解锁新的政策。
          </p>
        </div>
      )}

      {/* 按类别显示政令 */}
      {Object.entries(categories).map(([catKey, catInfo]) => {
        const categoryDecrees = decreesByCategory[catKey] || [];
        if (categoryDecrees.length === 0) return null;

        return (
          <div key={catKey} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {/* 类别标题 */}
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name={catInfo.icon} size={16} className={catInfo.color} />
              {catInfo.name}
            </h3>

            {/* 政令列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categoryDecrees.map((decree) => (
                <div
                  key={decree.id}
                  className={`p-4 rounded-lg border transition-all ${
                    decree.active
                      ? 'bg-green-900/20 border-green-600 shadow-lg'
                      : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {/* 政令头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {decree.name}
                        {decree.active && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                            生效中
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">{decree.desc}</p>
                    </div>
                  </div>

                  {/* 政令效果 */}
                  <div className="space-y-2 mb-3">
                    {/* 正面效果 */}
                    {decree.effects && decree.effects.length > 0 && (
                      <div className="p-2 bg-green-900/20 rounded">
                        <p className="text-xs text-gray-400 mb-1">正面效果：</p>
                        <div className="space-y-1">
                          {decree.effects.map((effect, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Icon name="Plus" size={12} className="text-green-400" />
                              <span className="text-green-300">{effect}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 负面效果 */}
                    {decree.drawbacks && decree.drawbacks.length > 0 && (
                      <div className="p-2 bg-red-900/20 rounded">
                        <p className="text-xs text-gray-400 mb-1">负面效果：</p>
                        <div className="space-y-1">
                          {decree.drawbacks.map((drawback, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Icon name="Minus" size={12} className="text-red-400" />
                              <span className="text-red-300">{drawback}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 切换按钮 */}
                  <button
                    onClick={() => onToggle(decree.id)}
                    className={`w-full px-4 py-2 rounded text-sm font-semibold transition-all ${
                      decree.active
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {decree.active ? (
                      <span className="flex items-center justify-center gap-2">
                        <Icon name="X" size={14} />
                        废除政令
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Icon name="Check" size={14} />
                        颁布政令
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 当前生效的政令统计 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-300">
          <Icon name="FileText" size={16} className="text-blue-400" />
          政令统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">总政令数</p>
            <p className="text-lg font-bold text-white">{unlockedDecrees.length}</p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">生效中</p>
            <p className="text-lg font-bold text-green-400">
              {unlockedActiveCount}
            </p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">未启用</p>
            <p className="text-lg font-bold text-gray-400">
              {unlockedInactiveCount}
            </p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">政策效率</p>
            <p className="text-lg font-bold text-blue-400">
              {policyEfficiency}%
            </p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">待解锁</p>
            <p className="text-lg font-bold text-yellow-300">
              {lockedDecrees.length}
            </p>
          </div>
        </div>
        {lockedDecrees.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-3">
            还有 {lockedDecrees.length} 条政令将在后续时代解锁{nextUnlockEpochName ? `，最近的是 ${nextUnlockEpochName}` : ''}。
          </p>
        )}
      </div>
    </div>
  );
};
