import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';

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
  const foodPrice = market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
  const dailyWage = ((unit.maintenanceCost?.food || 0) * foodPrice * militaryWageRatio);
  
  // 检查是否有足够的资源招募
  const canAfford = Object.entries(unit.recruitCost).every(
    ([resource, cost]) => (resources[resource] || 0) >= cost
  ) && (resources.silver || 0) >= silverCost;
  
  // 当前拥有的该单位数量
  const currentCount = army[unit.id] || 0;
  const hasUnits = currentCount > 0;

  return (
    <div className="space-y-2">
      {/* 头部：单位名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className="w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="Swords" size={24} className="text-red-400 icon-metal-red" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">{unit.name}</h2>
          <p className="text-xs text-gray-400 leading-tight truncate">{unit.type}</p>
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

        {/* 速度 */}
        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon name="Zap" size={12} className="text-yellow-400" />
            <span className="text-[9px] text-gray-400 leading-none">速度</span>
          </div>
          <div className="text-sm font-bold text-yellow-300 font-mono leading-none">{unit.speed}</div>
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
                    {cost} ({(resources[resource] || 0).toFixed(1)})
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
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400">食粮需求</span>
            <span className="text-xs font-bold text-white font-mono">{unit.maintenanceCost?.food || 0}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400">粮价</span>
            <span className="text-xs font-bold text-white font-mono">{foodPrice.toFixed(2)} 银币</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400">军饷倍率</span>
            <span className="text-xs font-bold text-white font-mono">×{militaryWageRatio.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-gray-700">
            <div className="flex items-center gap-1">
              <Icon name="Coins" size={12} className="text-yellow-400" />
              <span className="text-xs text-gray-300">军饷</span>
            </div>
            <span className="text-sm font-bold text-yellow-300 font-mono">{dailyWage.toFixed(2)} 银币/日</span>
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
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        {/* 招募按钮 */}
        <button
          onClick={() => {
            if (onRecruit) {
              onRecruit(unit.id);
              onClose();
            }
          }}
          disabled={!canAfford || !onRecruit}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
            canAfford && onRecruit
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-xl active:scale-95'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Icon name="Plus" size={18} />
          <span>招募单位</span>
        </button>

        {/* 解散按钮 */}
        <button
          onClick={() => {
            if (onDisband) {
              onDisband(unit.id);
              onClose();
            }
          }}
          disabled={!hasUnits || !onDisband}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
            hasUnits && onDisband
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-xl active:scale-95'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Icon name="Minus" size={18} />
          <span>解散单位</span>
        </button>
      </div>
    </div>
  );
};
