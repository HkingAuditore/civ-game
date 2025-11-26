import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA } from '../../config';
import { filterUnlockedResources } from '../../utils/resources';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';

/**
 * 详情面板中的信息区块
 * @param {string} title - 区块标题
 * @param {string} icon - 标题图标
 * @param {React.ReactNode} children - 内容
 * @param {string} [className] - 附加样式
 */
const DetailSection = ({ title, icon, children, className = '' }) => (
  <div className={`bg-gray-900/50 p-3 rounded-lg border border-gray-700/80 ${className}`}>
    <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
      <Icon name={icon} size={16} />
      {title}
    </h4>
    <div className="space-y-1 text-xs">{children}</div>
  </div>
);

/**
 * 用于显示键值对信息
 * @param {string} label - 标签
 * @param {string|number} value - 值
 * @param {string} valueClass - 值的CSS类
 */
const InfoRow = ({ label, value, valueClass = 'text-white' }) => (
  <div className="flex justify-between items-center py-0.5">
    <span className="text-gray-300">{label}</span>
    <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
  </div>
);

/**
 * 建筑详情组件
 * 在 BottomSheet 或 Modal 中显示
 * @param {Object} building - 建筑数据
 * @param {Object} gameState - 完整的游戏状态
 */
export const BuildingDetails = ({ building, gameState, onBuy, onSell }) => {
  if (!building || !gameState) return null;

  const { resources, epoch, techsUnlocked, market, buildings, jobFill } = gameState;
  const count = buildings[building.id] || 0;

  // --- 复用计算逻辑 ---
  // --- 复用 BuildTab 中的计算逻辑 ---
  const getResourcePrice = (key) => {
    if (!key || key === 'silver') return 1;
    return market?.prices?.[key] ?? (RESOURCES[key]?.basePrice || 0);
  };

  const getOwnerIncomePerBuilding = (b) => {
    const outputValue = Object.entries(b.output || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val, 0);
    const inputValue = Object.entries(b.input || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val, 0);
    const wageCost = Object.entries(b.jobs || {}).reduce((sum, [job, perBuilding]) => sum + (market?.wages?.[job] || 0) * perBuilding, 0);
    return outputValue - inputValue - wageCost;
  };

  // 修改：计算业主的“人均收入”
  const getOwnerPerCapitaIncome = (b) => {
    const profit = getOwnerIncomePerBuilding(b); // 这是纯利润
    let ownerWagesPerBuilding = 0;
    let ownerWorkersPerBuilding = 1; // 默认为1，防止除以0

    if (b.owner && b.jobs?.[b.owner]) {
      ownerWorkersPerBuilding = b.jobs[b.owner];
      ownerWagesPerBuilding = (market?.wages?.[b.owner] || 0) * ownerWorkersPerBuilding;
    }

    const totalIncomePerBuilding = profit + ownerWagesPerBuilding;
    return totalIncomePerBuilding / ownerWorkersPerBuilding;
  };

  const calculateCost = (b) => {
    const currentCount = buildings[b.id] || 0;
    const cost = {};
    for (let k in b.baseCost) {
      cost[k] = Math.ceil(b.baseCost[k] * Math.pow(1.15, currentCount));
    }
    return cost;
  };

  const ownerProfit = getOwnerIncomePerBuilding(building);
  const ownerPerCapitaIncome = getOwnerPerCapitaIncome(building);
  const nextCost = calculateCost(building);
  const nextSilverCost = calculateSilverCost(nextCost, market);
  const unlockedOutput = filterUnlockedResources(building.output, epoch, techsUnlocked);
  const unlockedInput = filterUnlockedResources(building.input, epoch, techsUnlocked);  
  const hasMaterials = Object.entries(nextCost).every(([res, val]) => (resources[res] || 0) >= val);
  const hasSilver = (resources.silver || 0) >= nextSilverCost;
  const canAffordNext = hasMaterials && hasSilver;

  // 计算总的业主岗位数量
  const totalOwnerWorkers = (building.jobs?.[building.owner] || 0) * count;
  // 计算总收益
  const totalIncomeForClass = ownerPerCapitaIncome * totalOwnerWorkers;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-start gap-4 p-1">
        <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${building.visual.color} flex items-center justify-center shadow-lg`}>
          <Icon name={building.visual.icon} size={36} className={building.visual.text} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{building.name}</h3>
          <p className="text-sm text-gray-300 mt-1">{building.desc}</p>
          {building.owner && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-yellow-200 bg-yellow-900/40 border border-yellow-600/40 rounded-full px-2.5 py-1">
              <Icon name="User" size={12} />
              <span className="font-semibold">业主: {STRATA[building.owner]?.name || building.owner}</span>
            </div>
          )}
        </div>
      </div>

      {/* 关键数据 */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/80">
          <div className="text-xs text-gray-400 mb-1">已拥有</div>
          <div className="text-2xl font-bold text-white">{count}</div>
        </div>
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/80">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
            <span>业主人均收入</span> <Icon name="Coins" size={12} className="text-yellow-400" />
          </div>
          <div className={`text-2xl font-bold ${ownerPerCapitaIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {ownerPerCapitaIncome.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 -mt-1">
            (每人)
          </div>
        </div>
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/80">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
            <span>阶层总收入</span> <Icon name="Coins" size={12} className="text-yellow-400" />
          </div>
          <div className={`text-2xl font-bold ${totalIncomeForClass >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalIncomeForClass.toFixed(1)}
          </div>
          <div className="text-[10px] text-gray-500 -mt-1">
            (共 {Math.round(totalOwnerWorkers)} 人)
          </div>
        </div>
      </div>

      {/* 详细信息 - 两列布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 资源流动 */}
        {(Object.keys(unlockedOutput).length > 0 || Object.keys(unlockedInput).length > 0) && (
          <DetailSection title="资源流动 (单个建筑)" icon="ArrowRightLeft">
            {Object.entries(unlockedOutput).map(([res, val]) => (
              <InfoRow key={`out-${res}`} label={RESOURCES[res]?.name || res} value={`+${val}`} valueClass="text-green-400" />
            ))}
            {Object.entries(unlockedInput).map(([res, val]) => (
              <InfoRow key={`in-${res}`} label={RESOURCES[res]?.name || res} value={`-${val}`} valueClass="text-red-400" />
            ))}
            {Object.keys(unlockedOutput).length === 0 && Object.keys(unlockedInput).length === 0 && (
              <p className="text-gray-500 text-center text-xs">当前时代无资源流动</p>
            )}
          </DetailSection>
        )}

        {/* 岗位信息 */}
        {building.jobs && Object.keys(building.jobs).length > 0 && (
          <DetailSection title="提供岗位" icon="Users">
            {Object.entries(building.jobs).map(([job, perBuilding], index) => {
              const requiredExact = perBuilding * count;
              const assignedRaw = jobFill?.[building.id]?.[job] ?? 0;
              const assignedExact = Math.min(assignedRaw, requiredExact);
              const fillPercent = requiredExact > 0 ? (assignedExact / requiredExact) * 100 : 0;
              const wage = market?.wages?.[job] || 0;

              return (
                <div key={job} className={index > 0 ? "pt-2 mt-2 border-t border-gray-700/60" : ""}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-200 font-semibold">{STRATA[job]?.name || job}</span>
                    <span className="text-yellow-300 font-mono">薪资: {wage.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${fillPercent}%` }}></div>
                    </div>
                    <span className="text-gray-300 font-mono text-[11px] w-20 text-right">{Math.round(assignedExact)}/{Math.round(requiredExact)}</span>
                  </div>
                </div>
              );
            })}
          </DetailSection>
        )}

        {/* 下一个建造成本 */}
        <DetailSection title="下一个建造成本" icon="Hammer" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(nextCost).map(([res, val]) => {
              const hasEnough = (resources[res] || 0) >= val;
              return (
                <InfoRow
                  key={res}
                  label={RESOURCES[res]?.name || res}
                  value={`${val}`}
                  valueClass={hasEnough ? 'text-green-400' : 'text-red-400'}
                />
              );
            })}
          </div>
          <div className="pt-2 mt-2 border-t border-gray-700/60">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-300 flex items-center gap-1.5">
                <Icon name="Coins" size={14} className="text-yellow-400" /> 总计
              </span>
              <span className={`font-mono font-semibold ${hasSilver ? 'text-green-400' : 'text-red-400'}`}>
                {formatSilverCost(nextSilverCost)}
              </span>
            </div>
          </div>
        </DetailSection>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <button
          onClick={() => onBuy && onBuy(building.id)}
          disabled={!canAffordNext}
          className="w-full px-4 py-3 rounded-lg text-sm font-bold transition-all bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/30 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
        >
          <Icon name="Plus" size={16} />
          <div className="flex items-center gap-1">
            <span>购买</span>
            <span className="font-mono">({formatSilverCost(nextSilverCost)})</span>
          </div>
        </button>
        
        {count > 0 && (
          <button
            onClick={() => onSell && onSell(building.id)}
            className="w-full px-4 py-3 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-red-600/30 flex items-center justify-center gap-2"
          >
            <Icon name="Minus" size={16} />
            <span>拆除</span>
          </button>
        )}
      </div>
    </div>
  );
};