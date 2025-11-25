import React from 'react';
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
  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/70 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-3">
              <Icon name="Users" className="text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">人口详情</h2>
              <p className="text-sm text-gray-400">
                当前人口 {population} / {maxPop}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            aria-label="关闭"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">总人口变化趋势</p>
                <p className="text-xl font-semibold text-white">
                  当前 {population} 人 · 上限 {maxPop}
                </p>
              </div>
              <Icon name="Activity" className="text-blue-300" />
            </div>
            <SimpleLineChart data={populationHistory} color="#60a5fa" label="人口" />
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">阶层构成</p>
                <p className="text-xl font-semibold text-white">当前活跃阶层</p>
              </div>
              <Icon name="Layers" className="text-purple-300" />
            </div>
            <div className="space-y-3">
              {entries.length ? (
                entries.map(item => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Icon name={item.icon} size={16} className="text-amber-300" />
                        <span>{item.name}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {item.count} 人 · {item.percent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">暂无社会阶层数据。</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 bg-gray-900/70 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
