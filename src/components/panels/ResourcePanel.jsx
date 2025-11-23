// 资源面板组件
// 显示当前资源数量和生产速率

import React from 'react';
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
  onDetailClick,
}) => {

  // 格式化大额数字显示
  const formatCompactNumber = (value) => {
    const num = Math.floor(value);
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const getPrice = (key) => {
    if (!market) return RESOURCES[key]?.basePrice || 1;
    const base = RESOURCES[key]?.basePrice || 1;
    return market.prices?.[key] ?? base;
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
          return (
            <div key={key} className="text-xs">
              <div
                className="flex items-center justify-between hover:bg-gray-700/50 p-1 rounded transition-colors cursor-pointer"
                onClick={() => onDetailClick && onDetailClick(key)}
                title="点击查看详情"
              >
                {/* 资源图标和名称 */}
                <div className="flex items-center gap-1.5">
                  <Icon name={info.icon} size={14} className={info.color} />
                  <span className="text-gray-300">{info.name}</span>
                </div>

                {/* 资源数量和速率 */}
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white min-w-[50px] text-right">
                    {formatCompactNumber(amount)}
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
            </div>
          );
        })}
      </div>

    </div>
  );
};
