// 社会阶层面板组件
// 显示各个社会阶层的人口、好感度和影响力

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config/gameData';

/**
 * 社会阶层面板组件
 * 显示各个社会阶层的详细信息
 * @param {Object} popStructure - 人口结构对象
 * @param {Object} classApproval - 阶层好感度对象
 * @param {Object} classInfluence - 阶层影响力对象
 * @param {number} stability - 稳定度
 * @param {Function} onDetailClick - 点击详情回调
 */
export const StrataPanel = ({ 
  popStructure, 
  classApproval, 
  classInfluence, 
  stability,
  onDetailClick 
}) => {
  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg">
      {/* 标题和稳定度 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <Icon name="Users" size={16} />
          社会阶层
        </h3>
        
        {/* 稳定度指示器 */}
        <div className="flex items-center gap-1">
          <Icon 
            name="TrendingUp" 
            size={14} 
            className={
              stability >= 70 ? 'text-green-400' :
              stability >= 40 ? 'text-yellow-400' :
              'text-red-400'
            } 
          />
          <span className={`text-xs font-bold ${
            stability >= 70 ? 'text-green-400' :
            stability >= 40 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {stability.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 阶层列表 */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {Object.entries(STRATA).map(([key, info]) => {
          const count = popStructure[key] || 0;
          if (count === 0) return null;
          
          const approval = classApproval[key] || 50;
          const influence = classInfluence[key] || 0;
          
          return (
            <div 
              key={key}
              className="bg-gray-700/50 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => onDetailClick && onDetailClick(key)}
            >
              {/* 阶层名称和人口 */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon name={info.icon} size={14} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-200">
                    {info.name}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {count}人
                </span>
              </div>

              {/* 好感度进度条 */}
              <div className="mb-1">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-400">好感度</span>
                  <span className={
                    approval >= 70 ? 'text-green-400' :
                    approval >= 40 ? 'text-yellow-400' :
                    'text-red-400'
                  }>
                    {approval.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      approval >= 70 ? 'bg-green-500' :
                      approval >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${approval}%` }}
                  />
                </div>
              </div>

              {/* 影响力 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">影响力</span>
                <span className="text-purple-400 font-semibold">
                  {influence.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 查看详情按钮 */}
      <button
        onClick={() => onDetailClick && onDetailClick(null)}
        className="w-full mt-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors flex items-center justify-center gap-1"
      >
        <Icon name="Info" size={12} />
        查看详细信息
      </button>
    </div>
  );
};
