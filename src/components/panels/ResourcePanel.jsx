// 资源面板组件
// 显示当前资源数量和生产速率

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';

/**
 * 资源面板组件
 * 显示所有资源的当前数量和生产速率
 * @param {Object} resources - 资源对象
 * @param {Object} rates - 生产速率对象
 */
export const ResourcePanel = ({ 
  resources, 
  rates, 
  market,
  epoch = 0,
}) => {
  const [selectedResource, setSelectedResource] = useState(null);

  const getPrice = (key) => {
    if (!market) return RESOURCES[key]?.basePrice || 1;
    const base = RESOURCES[key]?.basePrice || 1;
    return market.prices?.[key] ?? base;
  };

  const handleSelect = (key) => {
    setSelectedResource(prev => (prev === key ? null : key));
  };

  const renderPriceChart = (history = []) => {
    if (!history || history.length <= 1) return null;
    const width = 160;
    const height = 48;
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;
    const points = history.map((price, index) => {
      const x = history.length > 1 ? (index / (history.length - 1)) * width : width;
      const y = height - ((price - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-16 text-blue-300 stroke-current fill-none"
      >
        <polyline points={points} strokeWidth="2" />
      </svg>
    );
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
          if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return null;
          
          const amount = resources[key] || 0;
          const rate = rates[key] || 0;
          const price = getPrice(key);
          const supply = market?.supply?.[key] ?? 0;
          const demand = market?.demand?.[key] ?? 0;
          const ratio = supply > 0 ? demand / supply : (demand > 0 ? Infinity : 1);
          const history = market?.priceHistory?.[key] || [];
          const isSelected = selectedResource === key;

          return (
            <div key={key} className="text-xs">
              <div
                className={`flex items-center justify-between hover:bg-gray-700/50 p-1 rounded transition-colors cursor-pointer ${
                  isSelected ? 'bg-gray-700/80 border border-blue-500/40' : ''
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
                  <span className="font-mono font-bold text-white min-w-[40px] text-right">
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
                    {rate > 0 ? '+' : ''}{rate.toFixed(1)}/日
                    </span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="mt-1 px-2 py-2 bg-gray-900/70 rounded border border-gray-700 text-[11px] text-gray-400 space-y-2">
                  <div className="flex gap-4 justify-end">
                    <span>供给 <span className="text-green-300 font-mono">{supply.toFixed(1)}</span></span>
                    <span>需求 <span className="text-red-300 font-mono">{demand.toFixed(1)}</span></span>
                    <span>需求/供给 <span className="text-yellow-300 font-mono">{Number.isFinite(ratio) ? ratio.toFixed(2) : '∞'}</span></span>
                  </div>
                  {renderPriceChart(history) || (
                    <div className="text-[10px] text-gray-600 text-right">价格变化数据不足</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
