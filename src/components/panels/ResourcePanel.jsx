// 资源面板组件
// 显示当前资源数量和生产速率

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config/gameData';

/**
 * 资源面板组件
 * 显示所有资源的当前数量和生产速率
 * @param {Object} resources - 资源对象
 * @param {Object} rates - 生产速率对象
 */
export const ResourcePanel = ({ resources, rates, market }) => {
  const [selectedResource, setSelectedResource] = useState(null);

  const getPrice = (key) => {
    if (!market) return RESOURCES[key]?.basePrice || 1;
    const base = RESOURCES[key]?.basePrice || 1;
    return market.prices?.[key] ?? base;
  };

  const handleSelect = (key) => {
    setSelectedResource(prev => (prev === key ? null : key));
  };

  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg">
      {/* 标题 */}
      <h3 className="text-sm font-bold mb-2 text-gray-300 flex items-center gap-2">
        <Icon name="Package" size={16} />
        资源
      </h3>

      {/* 资源列表 */}
      <div className="space-y-1">
        {Object.entries(RESOURCES).map(([key, info]) => {
          // 跳过虚拟资源和货币类资源
          if (info.type === 'virtual' || info.type === 'currency') return null;
          
          const amount = resources[key] || 0;
          const rate = rates[key] || 0;
          const price = getPrice(key);
          
          return (
            <div 
              key={key} 
              className={`flex items-center justify-between text-xs hover:bg-gray-700/50 p-1 rounded transition-colors cursor-pointer ${
                selectedResource === key ? 'bg-gray-700/70 border border-blue-500/40' : ''
              }`}
              onClick={() => handleSelect(key)}
            >
              {/* 资源图标和名称 */}
              <div className="flex items-center gap-1.5">
                <Icon name={info.icon} size={14} className={info.color} />
                <span className="text-gray-300">{info.name}</span>
              </div>

              {/* 资源数量和速率 */}
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-white">
                  {Math.floor(amount)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/70 text-[10px] text-slate-200 font-mono">
                  {price.toFixed(2)} 银币
                </span>
                {rate !== 0 && (
                  <span 
                    className={`text-xs font-mono ${
                      rate > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {rate > 0 ? '+' : ''}{rate.toFixed(1)}/s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedResource && (
        <div className="mt-3 p-3 bg-gray-900/60 rounded-lg border border-gray-700 text-xs text-gray-300">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-white flex items-center gap-1">
              <Icon name={RESOURCES[selectedResource]?.icon || 'Package'} size={12} />
              {RESOURCES[selectedResource]?.name || selectedResource}
            </span>
            <span className="text-blue-300 font-mono">
              价格: {getPrice(selectedResource).toFixed(2)} 银币
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>供给: <span className="text-green-300 font-mono">
              {(market?.supply?.[selectedResource] ?? 0).toFixed(2)}
            </span></span>
            <span>需求: <span className="text-red-300 font-mono">
              {(market?.demand?.[selectedResource] ?? 0).toFixed(2)}
            </span></span>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            需求/供给比: <span className="text-yellow-300 font-mono">
              {(() => {
                const supply = market?.supply?.[selectedResource] ?? 0.01;
                const demand = market?.demand?.[selectedResource] ?? 0.01;
                return (demand / supply).toFixed(2);
              })()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
