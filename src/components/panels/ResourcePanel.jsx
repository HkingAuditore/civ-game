// 资源面板组件
// 显示当前资源数量和生产速率

import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config/gameData';

/**
 * 资源面板组件
 * 显示所有资源的当前数量和生产速率
 * @param {Object} resources - 资源对象
 * @param {Object} rates - 生产速率对象
 */
export const ResourcePanel = ({ resources, rates }) => {
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
          // 跳过虚拟资源（如行政力）
          if (info.type === 'virtual') return null;
          
          const amount = resources[key] || 0;
          const rate = rates[key] || 0;
          
          return (
            <div 
              key={key} 
              className="flex items-center justify-between text-xs hover:bg-gray-700/50 p-1 rounded transition-colors"
            >
              {/* 资源图标和名称 */}
              <div className="flex items-center gap-1.5">
                <Icon name={info.icon} size={14} className={info.color} />
                <span className="text-gray-300">{info.name}</span>
              </div>

              {/* 资源数量和速率 */}
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">
                  {Math.floor(amount)}
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
    </div>
  );
};
