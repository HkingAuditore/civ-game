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
      <div className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-[10px] text-ancient-bronze px-1 pb-1 border-b border-ancient-gold/20">
        <span className="text-left font-semibold">资源</span>
        <span className="min-w-[45px] text-right font-semibold">库存</span>
        <span className="min-w-[55px] text-right font-semibold">价格</span>
        <span className="min-w-[45px] text-right font-semibold">产出</span>
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
            className="relative group grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-xs p-1 rounded transition-all cursor-pointer overflow-hidden hover:shadow-glow-gold"
            onClick={() => onDetailClick && onDetailClick(key)}
            title="点击查看详情"
          >
            {/* 悬停背景效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-ancient-gold/5 via-ancient-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 border border-ancient-gold/0 group-hover:border-ancient-gold/20 rounded transition-colors" />
            {/* 1. 资源图标和名称 (自动撑开) */}
            <div className="flex items-center gap-1.5 overflow-hidden relative z-10">
              <div className="relative">
                <div className="absolute inset-0 blur-sm opacity-50 group-hover:opacity-75 transition-opacity" style={{ color: info.color }} />
                <Icon name={info.icon} size={14} className={`${info.color} flex-shrink-0 relative`} />
              </div>
              <span className="text-gray-200 group-hover:text-ancient truncate transition-colors">{info.name}</span>
            </div>
            {/* 2. 资源数量 (右对齐) */}
            <span className="font-mono font-bold text-white min-w-[45px] text-right relative z-10 group-hover:text-ancient transition-colors">
              {formatCompactNumber(amount)}
            </span>
            {/* 3. 价格 (右对齐) */}
            <div className="flex items-center justify-end gap-0.5 font-mono text-slate-300 min-w-[55px] text-[10px] relative z-10 group-hover:text-ancient-gold transition-colors">
              <span>{price.toFixed(2)}</span>
              <Icon name="Coins" size={10} className="text-ancient-gold" />
            </div>

            {/* 4. 增长率 (右对齐) */}
            <span className={`font-mono min-w-[45px] text-right relative z-10 transition-all ${rate > 0 ? 'text-green-400 group-hover:text-green-300' : rate < 0 ? 'text-red-400 group-hover:text-red-300' : 'text-gray-500'}`}>
              {rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};
