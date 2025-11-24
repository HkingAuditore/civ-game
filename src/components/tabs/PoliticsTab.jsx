// 政令标签页组件
// 显示可用政令和切换功能

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, EPOCHS } from '../../config';

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
export const PoliticsTab = ({ decrees, onToggle, taxPolicies, onUpdateTaxPolicies, popStructure = {}, market = {}, epoch = 0 }) => {
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
  const [seenStrataKeys, setSeenStrataKeys] = React.useState([]);
  const [seenResourceKeys, setSeenResourceKeys] = React.useState([]);
  const allStrataKeys = React.useMemo(
    () => Object.keys(popStructure || {}).filter((key) => STRATA[key]),
    [popStructure]
  );
  const activeStrata = React.useMemo(
    () => allStrataKeys.filter((key) => (popStructure[key] || 0) > 0),
    [allStrataKeys, popStructure]
  );

  React.useEffect(() => {
    if (activeStrata.length === 0) return;
    setSeenStrataKeys((prev) => {
      const nextSet = new Set(prev);
      let changed = false;
      activeStrata.forEach((key) => {
        if (!nextSet.has(key)) {
          nextSet.add(key);
          changed = true;
        }
      });
      return changed ? Array.from(nextSet) : prev;
    });
  }, [activeStrata]);

  const strataToDisplay = React.useMemo(() => {
    if (allStrataKeys.length === 0) return [];
    const unlockedSet = new Set(seenStrataKeys);
    const activeSet = new Set(activeStrata);
    return allStrataKeys.filter((key) => activeSet.has(key) || unlockedSet.has(key));
  }, [activeStrata, allStrataKeys, seenStrataKeys]);

  const handleHeadTaxChange = (key, value) => {
    if (!onUpdateTaxPolicies) return;
    const parsed = parseFloat(value);
    const numeric = Number.isNaN(parsed) ? 0 : parsed;
    onUpdateTaxPolicies(prev => ({
      ...prev,
      headTaxRates: {
        ...(prev?.headTaxRates || {}),
        [key]: numeric,
      },
    }));
  };

  const handleHeadDraftChange = (key, raw) => {
    setHeadDrafts(prev => ({
      ...prev,
      [key]: raw,
    }));
  };

  const commitHeadDraft = (key) => {
    if (headDrafts[key] === undefined) return;
    handleHeadTaxChange(key, headDrafts[key]);
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
  const marketResourceKeys = Object.entries(market?.supply || {})
    .filter(([, amount]) => amount > 0)
    .map(([key]) => key);
  React.useEffect(() => {
    if (marketResourceKeys.length === 0) return;
    setSeenResourceKeys((prev) => {
      const nextSet = new Set(prev);
      let changed = false;
      marketResourceKeys.forEach((key) => {
        const info = RESOURCES[key];
        if (!info) return;
        if (info.type && (info.type === 'virtual' || info.type === 'currency')) return;
        if (!nextSet.has(key)) {
          nextSet.add(key);
          changed = true;
        }
      });
      return changed ? Array.from(nextSet) : prev;
    });
  }, [marketResourceKeys]);

  const orderedResourceKeys = React.useMemo(() => {
    if (marketResourceKeys.length === 0 && seenResourceKeys.length === 0) return [];
    const ordered = [...marketResourceKeys];
    seenResourceKeys.forEach((key) => {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    });
    return ordered;
  }, [marketResourceKeys, seenResourceKeys]);

  const taxableResources = orderedResourceKeys
    .map(key => [key, RESOURCES[key]])
    .filter(([, info]) => info && (!info.type || (info.type !== 'virtual' && info.type !== 'currency')));

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-1">人头税（按日结算）</h4>
              <p className="text-[11px] text-gray-500 mb-2">针对每位在职人口，按阶层基准税率 × 调整系数收取银币。若为负数，则为补助。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {activeStrata.map((key) => {
                  const base = STRATA[key]?.headTaxBase ?? 0.01;
                  const finalRate = (headRates[key] ?? 1) * base;
                  return (
                    <div key={key} className="bg-gray-900/40 p-1.5 rounded border border-gray-700/50 text-[11px]">
                      <div className="flex items-center justify-between text-gray-300 mb-1">
                        <span>{STRATA[key]?.name || key}</span>
                        <span className="font-mono text-yellow-300">
                          {finalRate.toFixed(3)} 银币/人/日
                        </span>
                      </div>
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
                      className="w-full bg-gray-900/60 border border-gray-700 text-[11px] text-gray-200 rounded px-1.5 py-0.5"
                    />
                    </div>
                  );
                })}
                {activeStrata.length === 0 && (
                  <p className="text-xs text-gray-500">暂无需征税的阶层</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-1">资源交易税</h4>
              <p className="text-[11px] text-gray-500 mb-2">仅对当前在市场流通的资源，在买入/卖出时按照成交额加收税率。</p>
              <div className="space-y-2">
                {taxableResources.map(([key, info]) => (
                  <div key={key} className="bg-gray-900/40 p-2 rounded border border-gray-700/50">
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                      <span>{info.name}</span>
                      <span className="font-mono text-blue-300">
                        {((resourceRates[key] ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.01"
                      value={resourceRates[key] ?? 0}
                      onChange={(e) => handleResourceTaxChange(key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
                {taxableResources.length === 0 && (
                  <p className="text-xs text-gray-500">当前市场暂无可征税资源</p>
                )}
              </div>
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
