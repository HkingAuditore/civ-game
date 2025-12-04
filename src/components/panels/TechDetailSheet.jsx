import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, BUILDINGS } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';

// 科技解锁的建筑列表
const TECH_BUILDING_UNLOCKS = BUILDINGS.reduce((acc, building) => {
  if (!building.requiresTech) return acc;
  const techId = building.requiresTech;
  if (!acc[techId]) acc[techId] = [];
  acc[techId].push(building.name || building.id);
  return acc;
}, {});

/**
 * 科技详情底部面板组件
 * 在BottomSheet中显示科技的详细信息
 */
export const TechDetailSheet = ({
  tech,
  status,
  resources,
  market,
  onResearch,
  onClose,
}) => {
  if (!tech) {
    return (
      <div className="text-center text-gray-400 py-8">
        <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
        <p>未找到该科技信息</p>
      </div>
    );
  }

  const silverCost = calculateSilverCost(tech.cost, market);
  const isUnlocked = status === 'unlocked';
  const unlockedBuildings = TECH_BUILDING_UNLOCKS[tech.id] || [];
  
  // 检查是否有足够的资源研究
  const canAfford = !isUnlocked && Object.entries(tech.cost).every(
    ([resource, cost]) => (resources[resource] || 0) >= cost
  ) && (resources.silver || 0) >= silverCost;

  return (
    <div className="space-y-2">
      {/* 头部：科技名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className="w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center flex-shrink-0">
          {isUnlocked ? (
            <Icon name="Check" size={24} className="text-green-400 icon-metal-green" />
          ) : (
            <Icon name="Lightbulb" size={24} className="text-blue-400 icon-metal-blue" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
            {tech.name}
            {isUnlocked && (
              <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">已研究</span>
            )}
          </h2>
          <p className="text-xs text-gray-400 leading-tight truncate">{tech.desc}</p>
        </div>
      </div>

      {/* 特殊效果 */}
      {tech.effect && (
        <div className="bg-blue-900/30 rounded p-2 border border-blue-500/30">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Sparkles" size={12} className="text-blue-400" />
            特殊效果
          </h3>
          <p className="text-xs text-blue-300 leading-relaxed">{tech.effect}</p>
        </div>
      )}

      {/* 解锁建筑 */}
      {unlockedBuildings.length > 0 && (
        <div className="bg-amber-900/30 rounded p-2 border border-amber-500/30">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Building" size={12} className="text-amber-400" />
            解锁建筑
          </h3>
          <div className="flex flex-wrap gap-1">
            {unlockedBuildings.map((buildingName, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-0.5 bg-amber-900/40 border border-amber-600/40 rounded text-amber-300"
              >
                {buildingName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 研究成本 */}
      {!isUnlocked && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="Package" size={12} className="text-purple-400" />
            研究成本
          </h3>
          <div className="space-y-1">
            {Object.entries(tech.cost).map(([resource, cost]) => {
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
                      {Math.round(cost)} ({Math.round(resources[resource] || 0)})
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
      )}

      {/* 已研究提示 */}
      {isUnlocked && (
        <div className="bg-green-900/20 border border-green-500/30 rounded p-3 text-center">
          <Icon name="CheckCircle" size={32} className="text-green-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-green-300">该科技已研究完成</p>
          <p className="text-xs text-gray-400 mt-1">科技效果已永久生效</p>
        </div>
      )}

      {/* 研究按钮 */}
      {!isUnlocked && (
        <div className="pt-2">
          <button
            onClick={() => {
              if (onResearch) {
                onResearch(tech.id);
                onClose();
              }
            }}
            disabled={!canAfford || !onResearch}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
              canAfford && onResearch
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Icon name="Lightbulb" size={18} />
            <span>研究科技</span>
          </button>
        </div>
      )}
    </div>
  );
};
