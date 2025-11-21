// 城市地图组件
// 显示帝国全景视图，展示所有已建造的建筑

import React from 'react';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, EPOCHS } from '../../config/gameData';
import { getIcon } from '../../config/iconMap';

/**
 * 城市地图组件
 * 以网格形式展示所有建筑
 * @param {Object} buildings - 建筑数量对象 {buildingId: count}
 * @param {number} epoch - 当前时代
 */
export const CityMap = ({ buildings, epoch }) => {
  // 收集所有已建造的建筑
  const activeTiles = [];
  BUILDINGS.forEach(b => {
    const count = buildings[b.id] || 0;
    for (let i = 0; i < count; i++) {
      activeTiles.push(b);
    }
  });

  // 最小网格数量（8x8 = 64）
  const MIN_GRID = 64;
  const emptyCount = Math.max(0, MIN_GRID - activeTiles.length);
  const displayTiles = [...activeTiles, ...Array(emptyCount).fill(null)];

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-inner overflow-hidden">
      {/* 标题栏 */}
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
          <Icon name="Globe" size={14} /> 帝国全景视图
        </h3>
        <span className="text-xs text-gray-500">建筑总数: {activeTiles.length}</span>
      </div>

      {/* 建筑网格 */}
      <div className="grid grid-cols-8 gap-2 aspect-square sm:aspect-video sm:h-64 w-full bg-gray-800/50 rounded-lg p-2 overflow-y-auto content-start">
        {displayTiles.map((b, i) => {
          // 空地块
          if (!b) {
            return (
              <div 
                key={i} 
                className={`rounded-sm h-8 sm:h-auto w-full aspect-square opacity-20 ${EPOCHS[epoch].tileColor} transition-colors duration-1000`} 
              />
            );
          }
          
          // 建筑地块
          const VisualIcon = getIcon(b.visual.icon);
          return (
            <div
              key={i}
              className={`rounded-md aspect-square flex items-center justify-center shadow-lg transform transition-all hover:scale-110 group relative ${b.visual.color} ${b.cat === 'industry' || b.cat === 'gather' ? 'animate-pulse-slow' : ''}`}
              title={b.name}
            >
              {VisualIcon && <VisualIcon size={18} className={`${b.visual.text} group-hover:animate-bounce`} />}
            </div>
          );
        })}
      </div>

      {/* 装饰性背景动画 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-10">
        <div className="absolute top-10 left-10 w-32 h-12 bg-white rounded-full blur-xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-48 h-16 bg-white rounded-full blur-xl animate-float-slower"></div>
      </div>
    </div>
  );
};
