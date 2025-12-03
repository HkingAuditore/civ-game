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
    <div className="space-y-1.5">
      {/* 表头 */}
      <div className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-[10px] text-ancient-stone border-b border-ancient-gold/20 pb-1.5 px-1">
        <span className="text-left font-semibold tracking-wide flex items-center gap-1">
          <Icon name="Layers" size={10} className="text-ancient-gold" />
          资源
        </span>
        <span className="min-w-[45px] text-right font-semibold">库存</span>
        <span className="min-w-[55px] text-right font-semibold">价格</span>
        <span className="min-w-[45px] text-right font-semibold">产出</span>
      </div>

      {/* 资源列表 */}
      {Object.entries(RESOURCES).map(([key, info]) => {
        if (info.type === 'virtual' || info.type === 'currency') return null;
        if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return null;

        const amount = resources[key] || 0;
        const rate = rates[key] || 0;
        const price = getPrice(key);

        return (
          <div
            key={key}
            className="relative group grid grid-cols-[1fr,auto,auto,auto] items-center gap-x-2 text-xs p-1.5 rounded-lg transition-all cursor-pointer overflow-hidden border border-ancient-gold/10 hover:border-ancient-gold/30 hover:bg-ancient-gold/5 hover:shadow-glow-gold"
            onClick={() => onDetailClick && onDetailClick(key)}
            title="点击查看详情"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-ancient-gold/0 via-ancient-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* 资源名称和图标 */}
            <div className="flex items-center gap-1.5 overflow-hidden relative z-10">
              <Icon name={info.icon} size={16} className={`${info.color} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-ancient-parchment font-semibold truncate leading-tight group-hover:text-ancient">
                  {info.name}
                </p>
              </div>
            </div>

            {/* 库存 */}
            <span className="font-mono font-bold text-ancient-parchment min-w-[45px] text-right relative z-10 group-hover:text-ancient">
              {formatCompactNumber(amount)}
            </span>

            {/* 价格 */}
            <div className="flex items-center justify-end gap-0.5 font-mono text-ancient-stone opacity-80 min-w-[55px] text-[10px] relative z-10 group-hover:text-ancient-gold">
              <span>{price.toFixed(2)}</span>
              <Icon name="Coins" size={10} className="text-ancient-gold" />
            </div>

            {/* 产出速率 */}
            <span
              className={`font-mono min-w-[45px] text-right relative z-10 transition-colors ${
                rate > 0
                  ? 'text-green-400 group-hover:text-green-300'
                  : rate < 0
                  ? 'text-red-400 group-hover:text-red-300'
                  : 'text-ancient-stone opacity-70'
              }`}
            >
              {rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : '--'}
            </span>
          </div>
        );
      })}
    </div>
  );
};
