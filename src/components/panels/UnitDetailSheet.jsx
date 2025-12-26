import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { UNIT_CATEGORIES } from '../../config/militaryUnits';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { EPOCHS } from '../../config/epochs';

/**
 * 军事单位详情底部面板组件
 * 在BottomSheet中显示单位的详细信息
 */
export const UnitDetailSheet = ({
  unit,
  resources,
  market,
  militaryWageRatio = 1,
  army = {},
  onRecruit,
  onDisband,
  onDisbandAll, // 新增：一键解散某种兵种所有单位
  onClose,
}) => {
  if (!unit) {
    return (
      <div className="text-center text-gray-400 py-8">
        <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
        <p>未找到该单位信息</p>
      </div>
    );
  }

  const silverCost = calculateSilverCost(unit.recruitCost, market);
  // 军饷 = 银币维护费 × 军饷倍率
  const baseSilverMaintenance = unit.maintenanceCost?.silver || 0;
  const dailyWage = baseSilverMaintenance * militaryWageRatio;
  
  // 检查是否有足够的资源招募
  const canAfford = Object.entries(unit.recruitCost).every(
    ([resource, cost]) => (resources[resource] || 0) >= cost
  ) && (resources.silver || 0) >= silverCost;
  
  // 当前拥有的该单位数量
  const currentCount = army[unit.id] || 0;
  const hasUnits = currentCount > 0;

  // 获取类别信息
  const categoryInfo = UNIT_CATEGORIES[unit.category] || {};
  // 获取时代信息
  const epochInfo = EPOCHS[unit.epoch] || {};

  return (
    <div className="space-y-2">
      {/* 头部：单位名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className={`w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon name={unit.icon || 'Swords'} size={24} className={`${categoryInfo.color || 'text-red-400'} icon-metal-red`} />
        </div>
        <div className="flex-1 min-w-0">
<h2 className="text-lg font-bold text-white leading-tight font-decorative">{unit.name}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-400 leading-tight">
            <span className={categoryInfo.color}>{categoryInfo.name || unit.type}</span>
            <span>•</span>
            <span>{epochInfo.name || `时代 ${unit.epoch}`}</span>
          </div>
        </div>
      </div>

      {/* 核心属性卡片 */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* 攻击力 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Sword" size={12} className="text-red-400" />
            <span className="text-[9px] text-gray-400 leading-none">攻击</span>
          </div>
          <div className="text-sm font-bold text-white font-mono leading-none">{unit.attack}</div>
        </div>

        {/* 防御力 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Shield" size={12} className="text-blue-400" />
            <span className="text-[9px] text-gray-400 leading-none">防御</span>
          </div>
          <div className="text-sm font-bold text-white font-mono leading-none">{unit.defense}</div>
        </div>

        {/* 射程 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Target" size={12} className="text-green-400" />
            <span className="text-[9px] text-gray-400 leading-none">射程</span>
          </div>
          <div className="text-sm font-bold text-green-300 font-mono leading-none">{unit.range || 1}</div>
        </div>

        {/* 训练时间 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Clock" size={12} className="text-purple-400" />
            <span className="text-[9px] text-gray-400 leading-none">训练</span>
          </div>
          <div className="text-sm font-bold text-purple-300 font-mono leading-none">{unit.trainingTime}天</div>
        </div>
      </div>

      {/* 克制关系 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="Swords" size={12} className="text-yellow-400" />
          克制关系
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {/* 克制 */}
          <div className="bg-gray-800/40 rounded px-2 py-1.5">
            <div className="flex items-center gap-1 mb-1">
              <Icon name="ChevronUp" size={12} className="text-green-400" />
              <span className="text-[9px] text-gray-400">克制</span>
            </div>
            <div className="text-xs">
              {unit.counters && Object.keys(unit.counters).length > 0 ? (
                Object.entries(unit.counters).map(([category, bonus]) => {
                  const targetCategory = UNIT_CATEGORIES[category];
                  return (
                    <span key={category} className={`${targetCategory?.color || 'text-white'} mr-2`}>
                      {targetCategory?.name || category} (+{Math.round((bonus - 1) * 100)}%)
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-500">无</span>
              )}
            </div>
          </div>
          {/* 被克制 */}
          <div className="bg-gray-800/40 rounded px-2 py-1.5">
            <div className="flex items-center gap-1 mb-1">
              <Icon name="ChevronDown" size={12} className="text-red-400" />
              <span className="text-[9px] text-gray-400">被克制</span>
            </div>
            <div className="text-xs">
              {unit.weakAgainst && unit.weakAgainst.length > 0 ? (
                unit.weakAgainst.map((category) => {
                  const targetCategory = UNIT_CATEGORIES[category];
                  return (
                    <span key={category} className={`${targetCategory?.color || 'text-white'} mr-2`}>
                      {targetCategory?.name || category}
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-500">无</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 特殊能力 */}
      {unit.abilities && unit.abilities.length > 0 && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Star" size={12} className="text-amber-400" />
            特殊能力
          </h3>
          <div className="flex flex-wrap gap-1">
            {unit.abilities.map((ability, index) => (
              <span key={index} className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
                {ability}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 招募成本 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="Package" size={12} className="text-amber-400" />
          招募成本
        </h3>
        <div className="space-y-1">
          {Object.entries(unit.recruitCost).map(([resource, cost]) => {
            const resourceInfo = RESOURCES[resource];
            const hasEnough = (resources[resource] || 0) >= cost;
            return (
              <div key={resource} className="bg-gray-800/40 rounded px-2 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon name={resourceInfo?.icon || 'Box'} size={14} className={resourceInfo?.color || 'text-gray-400'} />
                    <span className="text-xs text-gray-300">{resourceInfo?.name || resource}</span>
                  </div>
                  <span className={`text-xs font-bold font-mono ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                    {cost}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="bg-gray-800/40 rounded px-2 py-1 border-t border-gray-700 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="Coins" size={14} className="text-yellow-400" />
                <span className="text-xs text-gray-300">总计</span>
              </div>
              <span className={`text-xs font-bold font-mono ${(resources.silver || 0) >= silverCost ? 'text-green-400' : 'text-red-400'}`}>
                {formatSilverCost(silverCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 维护成本 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
          <Icon name="TrendingDown" size={12} className="text-red-400" />
          维护成本（每日）
        </h3>
        <div className="bg-gray-800/40 rounded px-2 py-1.5">
          {/* 资源消耗列表 */}
          <div className="space-y-1">
            {(() => {
              const prices = market?.prices || {};
              let totalDailyCost = 0;
              const resourceItems = Object.entries(unit.maintenanceCost || {}).map(([resource, cost]) => {
                const resourceInfo = RESOURCES[resource];
                if (!resourceInfo || cost <= 0) return null;
                const price = prices[resource] || 1;
                const silverValue = resource === 'silver' ? cost * militaryWageRatio : cost * price;
                totalDailyCost += silverValue;
                const isAffordable = (resources[resource] || 0) >= cost;
                return (
                  <div key={resource} className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-gray-300">
                      <Icon name={resourceInfo.icon || 'Package'} size={10} className={resourceInfo.color || 'text-gray-400'} />
                      {resourceInfo.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono ${isAffordable ? 'text-gray-300' : 'text-red-400'}`}>
                        -{cost.toFixed(1)}/日
                      </span>
                      {resource !== 'silver' && (
                        <span className="text-yellow-400/70 text-[9px] font-mono">
                          ≈{silverValue.toFixed(1)}<Icon name="Coins" size={8} className="inline ml-0.5" />
                        </span>
                      )}
                      {resource === 'silver' && (
                        <span className="text-yellow-400/70 text-[9px] font-mono">
                          ×{militaryWageRatio.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              }).filter(Boolean);
              
              return (
                <>
                  {resourceItems}
                  <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-gray-700/50">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Icon name="Coins" size={10} className="text-yellow-400" />
                      资源折算
                    </span>
                    <span className="text-xs font-bold text-yellow-300 font-mono">
                      ≈{totalDailyCost.toFixed(1)}<Icon name="Coins" size={10} className="inline ml-0.5" />/日
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 单位描述 */}
      {unit.desc && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <h3 className="text-[10px] font-bold text-white mb-1 flex items-center gap-1">
            <Icon name="Info" size={12} className="text-blue-400" />
            单位说明
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">{unit.desc}</p>
        </div>
      )}

      {/* 当前拥有数量 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name="Users" size={14} className="text-blue-400" />
            <span className="text-xs text-gray-300">当前拥有</span>
          </div>
          <span className="text-sm font-bold text-white font-mono">{currentCount} 个单位</span>
        </div>
        {unit.populationCost && unit.populationCost > 1 && (
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-700">
            <span className="text-[9px] text-gray-400">人口占用</span>
            <span className="text-xs text-white font-mono">{unit.populationCost} 人/单位</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        {/* 招募按钮 */}
        <button
          onClick={() => {
            if (onRecruit) {
              onRecruit(unit.id);
              onClose();
            }
          }}
          disabled={!canAfford || !onRecruit}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded font-bold text-xs transition-all ${
            canAfford && onRecruit
              ? 'bg-green-600 hover:bg-green-500 text-white active:scale-95'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Icon name="Plus" size={14} />
          <span>招募</span>
        </button>

        {/* 解散按钮 - 点击解散1个，长按解散全部 */}
        <button
          onMouseDown={(e) => {
            if (!hasUnits || !onDisband) return;
            const btn = e.currentTarget;
            btn.dataset.longPressTriggered = 'false';
            const timer = setTimeout(() => {
              btn.dataset.longPressTriggered = 'true';
              if (onDisbandAll) {
                onDisbandAll(unit.id);
                onClose();
              }
            }, 500);
            btn.dataset.longPressTimer = String(timer);
          }}
          onMouseUp={(e) => {
            const btn = e.currentTarget;
            clearTimeout(Number(btn.dataset.longPressTimer));
            if (btn.dataset.longPressTriggered !== 'true') {
              if (onDisband) {
                onDisband(unit.id);
                onClose();
              }
            }
          }}
          onMouseLeave={(e) => {
            clearTimeout(Number(e.currentTarget.dataset.longPressTimer));
          }}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            btn.dataset.longPressTriggered = 'false';
            const timer = setTimeout(() => {
              btn.dataset.longPressTriggered = 'true';
              if (onDisbandAll) {
                onDisbandAll(unit.id);
                onClose();
              }
            }, 500);
            btn.dataset.longPressTimer = String(timer);
          }}
          onTouchMove={(e) => {
            clearTimeout(Number(e.currentTarget.dataset.longPressTimer));
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            clearTimeout(Number(btn.dataset.longPressTimer));
            if (btn.dataset.longPressTriggered !== 'true') {
              if (onDisband) {
                onDisband(unit.id);
                onClose();
              }
            }
          }}
          disabled={!hasUnits || !onDisband}
          className={`px-3 py-2 rounded font-bold text-xs transition-all select-none ${
            hasUnits && onDisband
              ? 'bg-red-600/80 hover:bg-red-500 text-white active:scale-95'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          title="点击解散1个，长按解散全部"
        >
          解散
        </button>
      </div>
    </div>
  );
};
