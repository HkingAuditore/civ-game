// 建设标签页组件
// 显示可建造的建筑列表

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';

/**
 * 建筑悬浮提示框 (使用 Portal)
 */
const BuildingTooltip = ({ building, count, epoch, techsUnlocked, jobFill, anchorElement, cost, resources }) => {
  if (!building || !anchorElement) return null;

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (anchorElement && tooltipRef.current) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = anchorRect.top;
      let left = anchorRect.right + 8; // 默认在右侧

      if (left + tooltipRect.width > window.innerWidth) {
        left = anchorRect.left - tooltipRect.width - 8;
      }

      if (top < 0) top = 0;
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height;
      }

      setPosition({ top, left });
    }
  }, [anchorElement, building, count]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 z-[9999] pointer-events-none animate-fade-in-fast"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <h4 className="text-sm font-bold text-white mb-1">{building.name}</h4>
      <p className="text-xs text-gray-300 mb-2">{building.desc}</p>

      {building.owner && (
        <div className="text-[10px] text-yellow-200 bg-yellow-900/40 border border-yellow-600/40 rounded px-2 py-1 mb-2 inline-flex items-center gap-1">
          <Icon name="User" size={10} className="text-yellow-300" />
          业主: {STRATA[building.owner]?.name || building.owner}
        </div>
      )}

      {cost && Object.keys(cost).length > 0 && (
        <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
          <div className="text-[10px] text-gray-300 mb-1">下一个建造成本</div>
          {Object.entries(cost).map(([res, val]) => {
            const hasEnough = (resources[res] || 0) >= val;
            return (
              <div key={`cost-${res}`} className="flex justify-between">
                <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                <span className={`font-mono ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(() => {
        const unlockedOutput = filterUnlockedResources(building.output, epoch, techsUnlocked);
        const unlockedInput = filterUnlockedResources(building.input, epoch, techsUnlocked);
        if (Object.keys(unlockedOutput).length === 0 && Object.keys(unlockedInput).length === 0) return null;
        return (
          <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
            <div className="text-[10px] text-gray-300 mb-1">资源流/个</div>
            {Object.entries(unlockedOutput).map(([res, val]) => (
              <div key={`out-${res}`} className="flex justify-between">
                <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                <span className="text-green-400 font-mono">+{val}</span>
              </div>
            ))}
            {Object.entries(unlockedInput).map(([res, val]) => (
              <div key={`in-${res}`} className="flex justify-between">
                <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                <span className="text-red-400 font-mono">-{val}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {building.jobs && (
        <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
          <div className="text-[10px] text-gray-300 mb-1">岗位</div>
          {Object.entries(building.jobs).map(([job, perBuilding]) => {
            const required = perBuilding * count;
            const assigned = jobFill?.[building.id]?.[job] ?? 0;
            const fillPercent = required > 0 ? Math.min(1, assigned / required) * 100 : 0;
            return (
              <div key={job} className="mb-1.5">
                <div className="flex justify-between text-[11px] text-gray-300">
                  <span className="text-gray-200 font-semibold">{STRATA[job]?.name || job}</span>
                  <span className="font-mono text-gray-200">{Math.round(assigned)}/{Math.round(required)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>每栋 {perBuilding}</span>
                  <span>总计 {Math.round(required)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1"><div className="h-1 rounded-full bg-blue-500" style={{ width: `${fillPercent}%` }}></div></div>
              </div>);
          })}
        </div>
      )}
      <div className="text-[10px] text-center text-gray-400 pt-1 border-t border-gray-700">点击查看完整数据与交互</div>
    </div>,
    document.body
  );
};

/**
 * 紧凑型建筑卡片
 * @param {Object} building - 建筑数据
 * @param {number} count - 拥有数量
 * @param {boolean} affordable - 是否可购买
 * @param {number} silverCost - 银币成本
 * @param {number} ownerIncome - 业主收益
 * @param {Function} onBuy - 购买回调
 * @param {Function} onSell - 出售回调
 * @param {Function} onShowDetails - 显示详情回调
 */
// 更紧凑的价格格式化函数
const formatCompactCost = (value) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 10000) return (value / 1000).toFixed(0) + 'k';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
  return Math.floor(value).toString();
};

const CompactBuildingCard = ({
  building,
  count,
  affordable,
  silverCost,
  ownerIncome,
  onBuy,
  onSell,
  onShowDetails,
  cost,
  onMouseEnter,
  onMouseLeave,
  epoch,
  techsUnlocked,
  jobFill,
  resources,
}) => {
  const VisualIcon = Icon;

  return (
    <div 
      className="group relative flex flex-col h-full glass-ancient border border-ancient-gold/20 rounded-lg p-1.5 text-center transition-all hover:border-ancient-gold/40 hover:shadow-glow-gold"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 点击区域，用于显示详情 */}
      <div
        className="flex-grow flex flex-col items-center cursor-pointer"
        onClick={() => onShowDetails(building.id)}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-0.5 icon-metal-container">
          <VisualIcon name={building.visual.icon} size={14} className={`${building.visual.text} icon-metal`} />
        </div>
        <div className="flex items-baseline gap-0.5">
          <h4 className="text-[10px] font-bold text-ancient-parchment leading-tight truncate max-w-[60px]">{building.name}</h4>
          {count > 0 && <p className="text-[8px] font-bold text-ancient-gold">×{count}</p>}
        </div>
      </div>

      {/* 岗位饱和度与资源总览 - 仅在有建筑时显示，且更紧凑 */}
      {count > 0 && (
        <div className="space-y-0.5 text-[9px] my-1">
          {/* 岗位饱和度 - 只显示进度条，不显示标签 */}
          {building.jobs && Object.keys(building.jobs).length > 0 && (
            <div className="bg-gray-900/40 rounded px-1 py-0.5">
              {Object.entries(building.jobs).map(([job, perBuilding]) => {
                const required = perBuilding * count;
                const assigned = jobFill?.[building.id]?.[job] ?? 0;
                const fillPercent = required > 0 ? Math.min(1, assigned / required) * 100 : 0;
                return (
                  <div key={job} className="flex items-center gap-0.5" title={`${STRATA[job]?.name}: ${Math.round(assigned)}/${Math.round(required)}`}>
                    <Icon name={STRATA[job]?.icon || 'User'} size={8} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 bg-gray-700 rounded-full h-1">
                      <div className="h-1 rounded-full bg-green-500" style={{ width: `${fillPercent}%` }}></div>
                    </div>
                    <span className="font-mono text-[8px] text-gray-300 whitespace-nowrap">{Math.round(assigned)}/{Math.round(required)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* 资源产出 - 更紧凑的显示 */}
          {(() => {
            const unlockedOutput = filterUnlockedResources(building.output, epoch, techsUnlocked);
            if (Object.keys(unlockedOutput).length === 0) return null;
            return (
              <div className="bg-gray-900/40 rounded px-1 py-0.5">
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {Object.entries(unlockedOutput).map(([res, val]) => {
                    // 计算总岗位需求和总分配人数
                    const totalRequired = Object.values(building.jobs || {}).reduce((sum, per) => sum + per * count, 0);
                    const totalAssigned = Object.values(jobFill?.[building.id] || {}).reduce((sum, num) => sum + num, 0);
                    
                    // 计算有效工作建筑的比例
                    const workingRatio = totalRequired > 0 ? Math.min(1, totalAssigned / totalRequired) : 1;
                    
                    // 计算实际总产量
                    const actualTotalOutput = val * count * workingRatio;

                    return (
                      <div key={res} className="flex items-center gap-0.5 text-green-300" title={`${RESOURCES[res]?.name} - 单个产出: ${val} / 实际总产出: ${actualTotalOutput.toFixed(1)}`}>
                        <Icon name={RESOURCES[res]?.icon || 'Box'} size={8} />
                        <span className="font-mono text-[9px]">+{actualTotalOutput.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 操作按钮 - 上下排布 */}
      <div className="mt-auto pt-0.5 flex flex-col gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onBuy(building.id); }}
          disabled={!affordable}
          className={`w-full px-1 py-0.5 rounded text-[10px] font-semibold transition-all ${
            affordable
              ? 'bg-green-600/80 hover:bg-green-500 text-white'
              : 'bg-gray-700/60 text-gray-400 cursor-not-allowed'
          } flex items-center justify-center gap-0.5`}
          title={`建造: ${silverCost.toFixed(0)} 银币`}
        >
          <Icon name="Plus" size={8} className="flex-shrink-0" />
          <Icon name="Coins" size={8} className="text-yellow-300 opacity-80 flex-shrink-0" />
          <span className={`truncate ${!affordable ? 'text-red-300' : ''}`}>{formatCompactCost(silverCost)}</span>
        </button>
        
        {count > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onSell(building.id); }}
            className="w-full px-1 py-0.5 bg-red-600/80 hover:bg-red-500 text-white rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-0.5"
            title="拆除"
          >
            <Icon name="Minus" size={8} />
            <span>拆除</span>
          </button>
        )}
      </div>
    </div>
  );
};


/**
 * 建设标签页组件
 * 显示可建造的建筑列表
 * @param {Object} buildings - 已建造的建筑对象
 * @param {Object} resources - 资源对象
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @param {Function} onBuy - 购买建筑回调
 * @param {Function} onSell - 出售建筑回调
 */
export const BuildTab = ({ 
  buildings, 
  resources, 
  epoch, 
  techsUnlocked, 
  popStructure: _popStructure = {}, // 保留以备将来使用
  jobFill = {},
  onBuy, 
  onSell,
  onShowDetails, // 新增：用于打开详情页的回调
  market,
}) => {
  const [hoveredBuilding, setHoveredBuilding] = useState({ building: null, element: null });
  const canHover = window.matchMedia('(hover: hover)').matches;

  const handleMouseEnter = (e, building, cost, resources) => {
    if (canHover) setHoveredBuilding({ building, element: e.currentTarget, cost, resources });
  };

  const NON_TRADE_KEYS = new Set(['maxPop']);
  const getResourcePrice = (key) => {
    if (!key || key === 'silver') return 1;
    const def = RESOURCES[key];
    if (!def) return 0;
    if (NON_TRADE_KEYS.has(key)) return 0;
    return market?.prices?.[key] ?? def.basePrice ?? 0;
  };

  const getOwnerIncomePerBuilding = (building) => {
    const outputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => {
      const price = getResourcePrice(res);
      return sum + price * val;
    }, 0);
    const inputValue = Object.entries(building.input || {}).reduce((sum, [res, val]) => {
      const price = getResourcePrice(res);
      return sum + price * val;
    }, 0);
    const wageCost = Object.entries(building.jobs || {}).reduce((sum, [job, perBuilding]) => {
      const wage = market?.wages?.[job] ?? 0;
      return sum + wage * perBuilding;
    }, 0);
    return outputValue - inputValue - wageCost;
  };

  // 新增：计算考虑了工作效率的实际人均收入
  const getActualOwnerPerCapitaIncome = (building, count) => {
    if (count === 0) return 0;

    // 1. 计算建筑的有效工作比例
    const totalRequired = Object.values(building.jobs || {}).reduce((sum, per) => sum + per * count, 0);
    const totalAssigned = Object.values(jobFill?.[building.id] || {}).reduce((sum, num) => sum + num, 0);
    const workingRatio = totalRequired > 0 ? Math.min(1, totalAssigned / totalRequired) : 1;

    // 2. 计算实际产出和投入价值
    const actualOutputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val * workingRatio, 0);
    const actualInputValue = Object.entries(building.input || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val * workingRatio, 0);

    // 3. 计算实际薪资成本（只给已分配的工人发薪水）
    const actualWageCost = Object.entries(jobFill?.[building.id] || {}).reduce((sum, [job, assignedCount]) => {
      const wage = market?.wages?.[job] ?? 0;
      return sum + wage * (assignedCount / count); // 平均到每个建筑
    }, 0);

    const actualProfitPerBuilding = actualOutputValue - actualInputValue - actualWageCost;
    const ownerWage = (building.owner && market?.wages?.[building.owner]) ? (market.wages[building.owner] * (building.jobs[building.owner] || 0)) : 0;
    const ownerWorkers = building.jobs?.[building.owner] || 1;
    return (actualProfitPerBuilding + ownerWage) / ownerWorkers;
  };

  const getJobIncomePerBuilding = (building, ownerIncome) => {
    const jobEntries = Object.keys(building.jobs || {}).map(job => {
      const wage = market?.wages?.[job] ?? 0;
      return {
        job,
        perCapitaIncome: wage,
      };
    });
    if (building.owner && jobEntries.every(entry => entry.perCapitaIncome === 0)) {
      const ownerRole = jobEntries.find(entry => entry.job === building.owner);
      if (ownerRole) {
        // 修复：将总利润除以该岗位的工人数量，得到人均收入
        const workerCount = building.jobs[building.owner] || 1;
        ownerRole.perCapitaIncome = ownerIncome / workerCount;
      }
    }
    return jobEntries;
  };

  /**
   * 检查建筑是否可用
   * @param {Object} building - 建筑对象
   * @returns {boolean}
   */
  const isBuildingAvailable = (building) => {
    // 检查时代要求
    if (building.epoch > epoch) return false;
    
    if (building.requiresTech && !techsUnlocked.includes(building.requiresTech)) return false;
    
    return true;
  };

  /**
   * 计算建筑成本
   * @param {Object} building - 建筑对象
   * @returns {Object} 成本对象
   */
  const calculateCost = (building) => {
    const count = buildings[building.id] || 0;
    const cost = {};
    for (let k in building.baseCost) {
      cost[k] = Math.ceil(building.baseCost[k] * Math.pow(1.15, count));
    }
    return cost;
  };

  // 按类别分组建筑
  const categories = {
    gather: { name: '采集与农业', icon: 'Wheat', color: 'text-yellow-400' },
    industry: { name: '工业生产', icon: 'Factory', color: 'text-blue-400' },
    civic: { name: '市政建筑', icon: 'Home', color: 'text-green-400' },
    military: { name: '军事建筑', icon: 'Swords', color: 'text-red-400' },
  };
  const categoryFilters = [
    { key: 'all', label: '全部' },
    { key: 'gather', label: '采集' },
    { key: 'industry', label: '工业' },
    { key: 'civic', label: '居住' },
    { key: 'military', label: '军事' },
  ];
  const [activeCategory, setActiveCategory] = useState('all');
  const categoriesToRender =
    activeCategory === 'all'
      ? Object.entries(categories)
      : Object.entries(categories).filter(([key]) => key === activeCategory);

  return (
    <div className="space-y-4 build-tab">
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-700/60 mb-3">
        {categoryFilters.map((filter) => {
          const isActive = filter.key === activeCategory;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveCategory(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-inner'
                  : 'bg-gray-700/70 text-gray-300 hover:bg-gray-600/60'
              }`}
              aria-pressed={isActive}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {categoriesToRender.map(([catKey, catInfo]) => {
        const categoryBuildings = BUILDINGS.filter(b => b.cat === catKey);
        
        return (
          <div key={catKey} className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
            {/* 类别标题 */}
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name={catInfo.icon} size={16} className={catInfo.color} />
              {catInfo.name}
            </h3>

            {/* 建筑列表 - 更紧凑布局 */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11 gap-1">
              {categoryBuildings.filter(b => isBuildingAvailable(b)).map(building => {
                const cost = calculateCost(building);
                const silverCost = calculateSilverCost(cost, market);
                const hasMaterials = Object.entries(cost).every(([res, val]) => (resources[res] || 0) >= val);
                const hasSilver = (resources.silver || 0) >= silverCost;
                const affordable = hasMaterials && hasSilver;
                const count = buildings[building.id] || 0;
                const actualIncome = getActualOwnerPerCapitaIncome(building, count);
                
                return (
                  <CompactBuildingCard
                    key={building.id}
                    building={building}
                    count={count}
                    affordable={affordable}
                    silverCost={silverCost}
                    ownerIncome={actualIncome} // 传递实际收入
                    cost={cost}
                    onBuy={onBuy}
                    onSell={onSell}
                    onMouseEnter={(e) => handleMouseEnter(e, building, cost, resources)}
                    onMouseLeave={() => canHover && setHoveredBuilding({ building: null, element: null })}
                    // 传递额外 props 给悬浮窗
                    epoch={epoch}
                    techsUnlocked={techsUnlocked}
                    jobFill={jobFill}
                    resources={resources}
                    onShowDetails={onShowDetails}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 悬浮提示框 Portal */}
      <BuildingTooltip
        building={hoveredBuilding.building}
        anchorElement={hoveredBuilding.element}
        count={hoveredBuilding.building ? (buildings[hoveredBuilding.building.id] || 0) : 0}
        epoch={epoch}
        techsUnlocked={techsUnlocked}
        jobFill={jobFill}
        cost={hoveredBuilding.cost}
        resources={resources}
      />
    </div>
  );
};
