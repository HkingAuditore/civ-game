import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 事件详情组件
 * 显示事件的详细信息和选项
 * @param {Object} event - 事件对象
 * @param {Function} onSelectOption - 选择选项的回调
 * @param {Function} onClose - 关闭回调
 */
export const EventDetail = ({ event, onSelectOption, onClose }) => {
  if (!event) return null;

  const handleOptionClick = (option) => {
    onSelectOption(event.id, option);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* 事件头部 */}
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center shadow-lg ${
          event.isDiplomaticEvent 
            ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
            : 'bg-gradient-to-br from-yellow-500 to-orange-600'
        }`}>
          <Icon name={event.icon} size={32} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-2">{event.name}</h2>
          {event.isDiplomaticEvent && (
            <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-600/30 text-blue-300 rounded">
              外交事件
            </span>
          )}
        </div>
      </div>

      {/* 概览图片（如果有） */}
      {event.image && (
        <div className="w-full h-48 bg-gray-700 rounded-lg overflow-hidden">
          <img 
            src={event.image} 
            alt={event.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 事件描述 */}
      <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
        <p className="text-gray-200 leading-relaxed">{event.description}</p>
      </div>

      {/* 事件选项 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white mb-3">选择你的行动：</h3>
        {event.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option)}
            className="w-full text-left bg-gray-700 hover:bg-gray-600 rounded-lg p-4 border border-gray-600 hover:border-yellow-500 transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="text-white font-semibold mb-1 group-hover:text-yellow-400 transition-colors">
                  {option.text}
                </h4>
                {option.description && (
                  <p className="text-gray-400 text-sm mb-2">{option.description}</p>
                )}
                
                {/* 效果预览 */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {/* 资源效果 */}
                  {option.effects.resources && Object.entries(option.effects.resources).map(([resource, value]) => (
                    <span
                      key={resource}
                      className={`text-xs px-2 py-1 rounded ${
                        value > 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {resource}: {value > 0 ? '+' : ''}{value}
                    </span>
                  ))}
                  
                  {/* 人口效果 */}
                  {option.effects.population && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        option.effects.population > 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      人口: {option.effects.population > 0 ? '+' : ''}{option.effects.population}
                    </span>
                  )}
                  
                  {/* 稳定度效果 */}
                  {option.effects.stability && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        option.effects.stability > 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      稳定度: {option.effects.stability > 0 ? '+' : ''}{option.effects.stability}
                    </span>
                  )}
                  
                  {/* 科技效果 */}
                  {option.effects.science && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        option.effects.science > 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      科技: {option.effects.science > 0 ? '+' : ''}{option.effects.science}
                    </span>
                  )}
                  
                  {/* 阶层支持度效果 */}
                  {option.effects.approval && Object.entries(option.effects.approval).map(([stratum, value]) => (
                    <span
                      key={stratum}
                      className={`text-xs px-2 py-1 rounded ${
                        value > 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {stratum}支持度: {value > 0 ? '+' : ''}{value}
                    </span>
                  ))}
                </div>
              </div>
              
              <Icon 
                name="ChevronRight" 
                size={20} 
                className="text-gray-500 group-hover:text-yellow-400 transition-colors flex-shrink-0 mt-1" 
              />
            </div>
          </button>
        ))}
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-blue-300 text-sm">
            选择一个选项将立即生效，请仔细考虑每个选项的后果。
          </p>
        </div>
      </div>
    </div>
  );
};
