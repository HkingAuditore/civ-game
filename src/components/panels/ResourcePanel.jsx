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
    // 重构：移除外部容器和标题，使用 Grid 布局来精确对齐所有列
    <div className="space-y-1">
      {/* 新增：列标题 */}
      <div className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-[10px] text-gray-400 px-1 pb-1 border-b border-gray-700/50">
        <span className="text-left">资源</span>
        <span className="min-w-[45px] text-right">市场库存</span>
        <span className="min-w-[55px] text-right">市场价</span>
        <span className="min-w-[45px] text-right">产出/日</span>
      </div>

      {/* 资源列表 */}
      {Object.entries(RESOURCES).map(([key, info]) => {
        // 跳过虚拟资源和货币类资源
        if (info.type === 'virtual' || info.type === 'currency') return null;
        if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return null;
        
        const amount = resources[key] || 0;
        const rate = rates[key] || 0;
        const price = getPrice(key);
        return (
          <div
            key={key}
            className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-xs hover:bg-gray-700/50 p-1 rounded transition-colors cursor-pointer"
            onClick={() => onDetailClick && onDetailClick(key)}
            title="点击查看详情"
          >
            {/* 1. 资源图标和名称 (自动撑开) */}
            <div className="flex items-center gap-1.5 overflow-hidden">
              <Icon name={info.icon} size={14} className={`${info.color} flex-shrink-0`} />
              <span className="text-gray-300 truncate">{info.name}</span>
            </div>
            {/* 2. 资源数量 (右对齐) */}
            <span className="font-mono font-bold text-white min-w-[45px] text-right">
              {formatCompactNumber(amount)}
            </span>
            {/* 3. 价格 (右对齐) */}
            <div className="flex items-center justify-end gap-0.5 font-mono text-slate-300 min-w-[55px] text-[10px]">
              <span>{price.toFixed(2)}</span>
              <Icon name="Coins" size={10} className="text-yellow-400" />
            </div>

            {/* 4. 增长率 (右对齐) */}
            <span className={`font-mono min-w-[45px] text-right ${rate > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};
