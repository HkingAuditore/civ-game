// 通用卡片详情Modal组件
// 用于移动端显示建筑、兵种、科技、政令的详细信息

import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA } from '../../config';

/**
 * 通用卡片详情Modal
 * @param {boolean} show - 是否显示
 * @param {function} onClose - 关闭回调
 * @param {string} title - 标题
 * @param {string} description - 描述
 * @param {object} icon - 图标配置 {name, color}
 * @param {array} sections - 内容区块数组
 * @param {object} actions - 操作按钮配置
 */
export const CardDetailModal = ({ show, onClose, title, description, icon, sections, actions }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end lg:items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Modal内容 - 移动端从底部滑出 */}
      <div className="relative w-full lg:w-auto lg:min-w-[500px] lg:max-w-2xl bg-gray-900 lg:rounded-2xl rounded-t-2xl border-t lg:border border-gray-700 shadow-2xl max-h-[85vh] lg:max-h-[90vh] flex flex-col animate-slide-up lg:animate-fade-in">
        {/* 头部 */}
        <div className="flex items-start justify-between p-4 border-b border-gray-800 bg-gray-800/50">
          <div className="flex items-start gap-3 flex-1">
            {icon && (
              <div className={`p-2 rounded-lg ${icon.bgColor || 'bg-gray-700'}`}>
                <Icon name={icon.name} size={24} className={icon.color || 'text-white'} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white">{title}</h3>
              {description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
          >
            <Icon name="X" size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sections && sections.map((section, index) => (
            <div key={index} className="space-y-2">
              {section.title && (
                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  {section.icon && <Icon name={section.icon} size={14} className={section.iconColor || 'text-gray-400'} />}
                  {section.title}
                </h4>
              )}
              
              {section.type === 'grid' && (
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{item.label}</span>
                        <span className={`text-sm font-semibold ${item.color || 'text-white'}`}>
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section.type === 'list' && (
                <div className="space-y-1">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {item.icon && <Icon name={item.icon} size={12} className={item.iconColor || 'text-gray-400'} />}
                      <span className={item.color || 'text-gray-300'}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {section.type === 'resources' && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(section.resources).map(([key, value]) => {
                    const resource = RESOURCES[key];
                    const hasEnough = section.current && section.current[key] >= value;
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                          hasEnough
                            ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                            : 'bg-red-900/30 text-red-400 border border-red-700/50'
                        }`}
                      >
                        {resource?.icon && <Icon name={resource.icon} size={12} />}
                        <span>{resource?.name || key}</span>
                        <span className="font-mono">{value}</span>
                        {section.current && (
                          <span className="text-[10px] opacity-70">({section.current[key] || 0})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {section.type === 'jobs' && (
                <div className="space-y-2">
                  {Object.entries(section.jobs).map(([key, data]) => {
                    const stratum = STRATA[key];
                    const fillPercent = data.fillPercent || 0;
                    return (
                      <div key={key} className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            {stratum?.icon && <Icon name={stratum.icon} size={12} className="text-gray-400" />}
                            <span className="text-xs text-gray-300">{stratum?.name || key}</span>
                            <span className="text-[10px] text-gray-500">
                              ({data.assigned}/{data.required})
                            </span>
                          </div>
                          {data.income !== undefined && (
                            <span className={`text-xs font-mono ${data.income >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              {data.income >= 0 ? '+' : ''}{data.income.toFixed(2)}银/日
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className="h-1 rounded-full bg-blue-400 transition-all"
                            style={{ width: `${fillPercent * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {section.type === 'custom' && section.content}
            </div>
          ))}
        </div>

        {/* 底部操作按钮 */}
        {actions && (
          <div className="p-4 border-t border-gray-800 bg-gray-800/50 space-y-2">
            {actions.primary && (
              <button
                onClick={actions.primary.onClick}
                disabled={actions.primary.disabled}
                className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  actions.primary.disabled
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : actions.primary.className || 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {actions.primary.icon && <Icon name={actions.primary.icon} size={16} />}
                {actions.primary.label}
              </button>
            )}
            {actions.secondary && (
              <button
                onClick={actions.secondary.onClick}
                disabled={actions.secondary.disabled}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  actions.secondary.disabled
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : actions.secondary.className || 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {actions.secondary.icon && <Icon name={actions.secondary.icon} size={16} />}
                {actions.secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
