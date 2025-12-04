import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA } from '../../config';

/**
 * 事件详情组件 - 史诗风格
 * 显示事件的详细信息和选项
 * @param {Object} event - 事件对象
 * @param {Function} onSelectOption - 选择选项的回调
 * @param {Function} onClose - 关闭回调
 */
export const EventDetail = ({ event, onSelectOption, onClose }) => {
  if (!event) return null;

  const getResourceName = (key) => (RESOURCES && RESOURCES[key]?.name) || key;
  const getStratumName = (key) => (STRATA && STRATA[key]?.name) || key;

  const handleOptionClick = (option) => {
    onSelectOption(event.id, option);
    onClose();
  };

  return (
    <div className="space-y-3">
      {/* 事件头部 - 史诗风格 */}
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border ${
            event.isDiplomaticEvent
              ? 'bg-gradient-to-br from-blue-600/80 to-purple-700/80 border-blue-400/30'
              : 'bg-gradient-to-br from-ancient-gold/60 to-ancient-bronze/60 border-ancient-gold/40'
          }`}
        >
          <Icon name={event.icon} size={28} className="text-white drop-shadow-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-ancient leading-tight">{event.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {event.isDiplomaticEvent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-blue-600/20 text-blue-300 rounded border border-blue-500/30">
                <Icon name="Globe" size={10} />
                外交事件
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 事件描述 - 玻璃拟态 */}
      <div className="glass-ancient rounded-xl p-3 border border-ancient-gold/20">
        <p className="text-sm text-ancient-parchment leading-relaxed">{event.description}</p>
      </div>

      {/* 事件选项 */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-ancient-stone uppercase tracking-wider flex items-center gap-1.5">
          <Icon name="Target" size={12} className="text-ancient-gold" />
          选择你的行动
        </h3>
        {event.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option)}
            className="w-full text-left glass-ancient hover:bg-ancient-gold/10 rounded-xl p-3 border border-ancient-gold/20 hover:border-ancient-gold/40 transition-all group hover:shadow-glow-gold"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-ancient-parchment group-hover:text-ancient transition-colors leading-tight">
                  {option.text}
                </h4>
                {option.description && (
                  <p className="text-[11px] text-ancient-stone mt-1 leading-snug">{option.description}</p>
                )}

                {/* 效果预览 - 显示完整文字标签 */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {/* 资源效果 - 显示资源名称 */}
                  {option.effects.resources &&
                    Object.entries(option.effects.resources).map(([resource, value]) => (
                      <span
                        key={resource}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${
                          value > 0 ? 'bg-green-900/50 text-green-300 border border-green-500/40' : 'bg-red-900/50 text-red-300 border border-red-500/40'
                        }`}
                      >
                        <Icon name={RESOURCES[resource]?.icon || 'Package'} size={10} />
                        <span className="font-medium">{getResourceName(resource)}</span>
                        <span className="font-mono font-bold">{value > 0 ? '+' : ''}{value}</span>
                      </span>
                    ))}

                  {/* 人口效果 - 显示"人口"标签 */}
                  {option.effects.population && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${
                        option.effects.population > 0
                          ? 'bg-green-900/50 text-green-300 border border-green-500/40'
                          : 'bg-red-900/50 text-red-300 border border-red-500/40'
                      }`}
                    >
                      <Icon name="Users" size={10} />
                      <span className="font-medium">人口</span>
                      <span className="font-mono font-bold">{option.effects.population > 0 ? '+' : ''}{option.effects.population}</span>
                    </span>
                  )}

                  {/* 稳定度效果 */}
                  {option.effects.stability && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${
                        option.effects.stability > 0
                          ? 'bg-green-900/50 text-green-300 border border-green-500/40'
                          : 'bg-red-900/50 text-red-300 border border-red-500/40'
                      }`}
                    >
                      <Icon name="TrendingUp" size={10} />
                      <span className="font-medium">稳定</span>
                      <span className="font-mono font-bold">{option.effects.stability > 0 ? '+' : ''}{option.effects.stability}</span>
                    </span>
                  )}

                  {/* 阶层支持度效果 - 显示阶层名称 */}
                  {option.effects.approval &&
                    Object.entries(option.effects.approval).map(([stratum, value]) => (
                      <span
                        key={stratum}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${
                          value > 0 ? 'bg-blue-900/50 text-blue-300 border border-blue-500/40' : 'bg-orange-900/50 text-orange-300 border border-orange-500/40'
                        }`}
                      >
                        <Icon name={STRATA[stratum]?.icon || 'User'} size={10} />
                        <span className="font-medium">{getStratumName(stratum)}支持</span>
                        <span className="font-mono font-bold">{value > 0 ? '+' : ''}{value}</span>
                      </span>
                    ))}
                </div>

                {/* 随机效果预览 */}
                {option.randomEffects && option.randomEffects.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-ancient-gold/10">
                    <div className="flex items-center gap-1 mb-1.5">
<Icon name="Dices" size={10} className="text-yellow-400" />
                      <span className="text-[10px] text-yellow-400 font-medium">可能的额外效果</span>
                    </div>
                    {option.randomEffects.map((randomEffect, idx) => (
                      <div key={idx} className="mb-1.5 last:mb-0">
                        <span className="text-[9px] text-yellow-300/70 font-medium">
                          {Math.round(randomEffect.chance * 100)}% 概率：
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {/* 随机效果 - 资源 */}
                          {randomEffect.effects.resources &&
                            Object.entries(randomEffect.effects.resources).map(([resource, value]) => (
                              <span
                                key={`rand-res-${idx}-${resource}`}
                                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                                  value > 0 ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                }`}
                              >
                                <Icon name={RESOURCES[resource]?.icon || 'Package'} size={9} />
                                <span>{getResourceName(resource)}</span>
                                <span className="font-mono font-bold">{value > 0 ? '+' : ''}{value}</span>
                              </span>
                            ))}
                          {/* 随机效果 - 人口 */}
                          {randomEffect.effects.population && (
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                                randomEffect.effects.population > 0
                                  ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                                  : 'bg-red-900/30 text-red-400 border border-red-500/30'
                              }`}
                            >
                              <Icon name="Users" size={9} />
                              <span>人口</span>
                              <span className="font-mono font-bold">{randomEffect.effects.population > 0 ? '+' : ''}{randomEffect.effects.population}</span>
                            </span>
                          )}
                          {/* 随机效果 - 稳定度 */}
                          {randomEffect.effects.stability && (
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                                randomEffect.effects.stability > 0
                                  ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                                  : 'bg-red-900/30 text-red-400 border border-red-500/30'
                              }`}
                            >
                              <Icon name="TrendingUp" size={9} />
                              <span>稳定</span>
                              <span className="font-mono font-bold">{randomEffect.effects.stability > 0 ? '+' : ''}{randomEffect.effects.stability}</span>
                            </span>
                          )}
                          {/* 随机效果 - 阶层支持度 */}
                          {randomEffect.effects.approval &&
                            Object.entries(randomEffect.effects.approval).map(([stratum, value]) => (
                              <span
                                key={`rand-app-${idx}-${stratum}`}
                                className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                                  value > 0 ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' : 'bg-orange-900/30 text-orange-400 border border-orange-500/30'
                                }`}
                              >
                                <Icon name={STRATA[stratum]?.icon || 'User'} size={9} />
                                <span>{getStratumName(stratum)}</span>
                                <span className="font-mono font-bold">{value > 0 ? '+' : ''}{value}</span>
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Icon
                name="ChevronRight"
                size={16}
                className="text-ancient-stone group-hover:text-ancient-gold transition-colors flex-shrink-0 mt-0.5"
              />
            </div>
          </button>
        ))}
      </div>

      {/* 提示信息 */}
      <div className="glass-ancient rounded-xl p-2.5 border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-blue-300 text-[11px] leading-snug">
            选择一个选项将立即生效，请仔细考虑每个选项的后果。
          </p>
        </div>
      </div>
    </div>
  );
};
