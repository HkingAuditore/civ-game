import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config';
import { SimpleLineChart } from '../common/SimpleLineChart';

export const PopulationDetailModal = ({
  isOpen,
  onClose,
  population = 0,
  maxPop = 0,
  popStructure = {},
  history = {},
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const animationClass = isAnimatingOut ? 'animate-sheet-out' : 'animate-sheet-in';

  const populationHistory = history?.population || [];
  const entries = Object.keys(STRATA)
    .map(key => {
      const count = popStructure[key] || 0;
      const percent = population > 0 ? (count / population) * 100 : 0;
      return {
        key,
        name: STRATA[key].name,
        icon: STRATA[key].icon,
        count,
        percent,
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={handleClose}></div>

      {/* 内容面板 */}
<div className={`relative w-full max-w-2xl glass-epic border-t-2 lg:border-2 border-ancient-gold/30 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[90vh] ${animationClass} lg:animate-slide-up`}>
        {/* 头部 */}
        <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-900/70">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 icon-metal-container icon-metal-container-lg flex-shrink-0">
              <Icon name="Users" size={24} className="text-blue-300 icon-metal-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">人口详情</h2>
              <p className="text-[10px] text-gray-400 leading-tight">
                当前人口 {population} / {maxPop}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-700 flex-shrink-0">
              <Icon name="X" size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 人口趋势 */}
          <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-wide text-gray-500 leading-none">总人口变化趋势</p>
                <p className="text-sm font-semibold text-white leading-tight mt-0.5">
                  当前 {population} 人 · 上限 {maxPop}
                </p>
              </div>
              <Icon name="Activity" size={16} className="text-blue-300" />
            </div>
            <SimpleLineChart data={populationHistory} color="#60a5fa" label="人口" />
          </div>

          {/* 阶层构成 */}
          <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-wide text-gray-500 leading-none">阶层构成</p>
                <p className="text-sm font-semibold text-white leading-tight mt-0.5">当前活跃阶层</p>
              </div>
              <Icon name="Layers" size={16} className="text-purple-300" />
            </div>
            <div className="space-y-2">
              {entries.length ? (
                entries.map(item => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-[10px] text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <Icon name={item.icon} size={14} className="text-amber-300" />
                        <span className="leading-none">{item.name}</span>
                      </div>
                      <div className="text-[9px] text-gray-400 font-mono leading-none">
                        {item.count} 人 · {item.percent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-gray-500 text-center py-2">暂无社会阶层数据。</p>
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
