// 年度庆典模态框组件
// 每年自动触发，让玩家选择一个庆典效果

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { EPOCHS } from '../../config/epochs';

/**
 * 年度庆典模态框组件
 * @param {Array} festivalOptions - 三个庆典效果选项
 * @param {number} year - 当前年份
 * @param {number} epoch - 当前时代
 * @param {Function} onSelect - 选择回调函数
 */
export const AnnualFestivalModal = ({ festivalOptions, year, epoch, onSelect }) => {
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [hoveredEffect, setHoveredEffect] = useState(null);

  if (!festivalOptions || festivalOptions.length === 0) return null;

  const currentEpoch = EPOCHS[epoch] || EPOCHS[0];

  const handleConfirm = () => {
    if (selectedEffect) {
      onSelect(selectedEffect);
    }
  };

  const getEffectIcon = (iconName) => {
    return iconName || 'Star';
  };

  const formatEffectDetails = (effects) => {
    const details = [];
    
    if (effects.categories) {
      Object.entries(effects.categories).forEach(([cat, value]) => {
        const percent = (value * 100).toFixed(0);
        const catName = cat === 'gather' ? '采集' : cat === 'industry' ? '工业' : cat;
        details.push(`${catName}类建筑 +${percent}%`);
      });
    }
    
    if (effects.production) {
      details.push(`全局生产 +${(effects.production * 100).toFixed(0)}%`);
    }
    
    if (effects.industry) {
      details.push(`工业产出 +${(effects.industry * 100).toFixed(0)}%`);
    }
    
    if (effects.scienceBonus) {
      details.push(`科研产出 +${(effects.scienceBonus * 100).toFixed(0)}%`);
    }
    
    if (effects.cultureBonus) {
      details.push(`文化产出 +${(effects.cultureBonus * 100).toFixed(0)}%`);
    }
    
    if (effects.militaryBonus) {
      details.push(`军事力量 +${(effects.militaryBonus * 100).toFixed(0)}%`);
    }
    
    if (effects.taxIncome) {
      details.push(`税收收入 +${(effects.taxIncome * 100).toFixed(0)}%`);
    }
    
    if (effects.stability) {
      details.push(`稳定度 +${(effects.stability * 100).toFixed(0)}%`);
    }
    
    if (effects.maxPop) {
      details.push(`人口上限 +${effects.maxPop}`);
    }
    
    if (effects.admin) {
      details.push(`行政容量 +${effects.admin}`);
    }
    
    return details;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-800 rounded-lg border-2 border-yellow-500/50 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 模态框头部 */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-yellow-900/50 via-orange-900/50 to-red-900/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Icon name="Sparkles" size={40} className="text-yellow-400 animate-pulse" />
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400">
                🎊 年度庆典 🎊
              </h2>
              <Icon name="Sparkles" size={40} className="text-yellow-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-lg text-white font-semibold">
                第 {year} 年庆典盛会
              </p>
              <p className="text-sm text-gray-300">
                <span className={`font-bold ${currentEpoch.color}`}>{currentEpoch.name}</span> · 选择一项庆典效果来祝福您的文明
              </p>
            </div>
          </div>
        </div>

        {/* 模态框内容 */}
        <div className="p-6">
          <div className="mb-6 bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-blue-300 mb-1">庆典说明</p>
                <p>每年一度的盛大庆典来临！请从以下三个选项中选择一项效果。</p>
                <p className="mt-1">
                  <span className="text-yellow-400">⏱ 短期效果</span> 将持续整整一年（360天），
                  <span className="text-purple-400 ml-2">♾️ 永久效果</span> 将永远伴随您的文明。
                </p>
              </div>
            </div>
          </div>

          {/* 庆典选项 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {festivalOptions.map((effect, index) => {
              const isSelected = selectedEffect?.id === effect.id;
              const isHovered = hoveredEffect?.id === effect.id;
              const isPermanent = effect.type === 'permanent';
              const effectDetails = formatEffectDetails(effect.effects);

              return (
                <div
                  key={effect.id}
                  className={`relative cursor-pointer transition-all duration-300 transform ${
                    isSelected 
                      ? 'scale-105 shadow-2xl' 
                      : isHovered 
                      ? 'scale-102 shadow-xl' 
                      : 'scale-100'
                  }`}
                  onClick={() => setSelectedEffect(effect)}
                  onMouseEnter={() => setHoveredEffect(effect)}
                  onMouseLeave={() => setHoveredEffect(null)}
                >
                  <div className={`h-full rounded-lg border-2 overflow-hidden ${
                    isSelected
                      ? isPermanent
                        ? 'border-purple-400 bg-purple-900/30'
                        : 'border-yellow-400 bg-yellow-900/30'
                      : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                  }`}>
                    {/* 效果类型标签 */}
                    <div className={`px-3 py-1.5 text-center text-xs font-bold ${
                      isPermanent
                        ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-purple-100'
                        : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-yellow-100'
                    }`}>
                      {isPermanent ? '♾️ 永久效果' : '⏱ 短期效果（1年）'}
                    </div>

                    {/* 效果内容 */}
                    <div className="p-4">
                      {/* 图标和标题 */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-lg ${
                          isPermanent ? 'bg-purple-600/30' : 'bg-yellow-600/30'
                        }`}>
                          <Icon 
                            name={getEffectIcon(effect.icon)} 
                            size={28} 
                            className={isPermanent ? 'text-purple-300' : 'text-yellow-300'} 
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white leading-tight">
                            {effect.name}
                          </h3>
                        </div>
                      </div>

                      {/* 描述 */}
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                        {effect.description}
                      </p>

                      {/* 效果详情 */}
                      <div className="space-y-1.5 mb-3">
                        {effectDetails.map((detail, idx) => (
                          <div 
                            key={idx}
                            className={`flex items-center gap-2 text-xs p-2 rounded ${
                              isPermanent 
                                ? 'bg-purple-900/30 border border-purple-600/30' 
                                : 'bg-yellow-900/30 border border-yellow-600/30'
                            }`}
                          >
                            <Icon 
                              name="Plus" 
                              size={12} 
                              className={isPermanent ? 'text-purple-400' : 'text-yellow-400'} 
                            />
                            <span className="text-gray-200">{detail}</span>
                          </div>
                        ))}
                      </div>

                      {/* 风味文本 */}
                      <div className="pt-3 border-t border-gray-600">
                        <p className="text-xs text-gray-400 italic leading-relaxed">
                          "{effect.flavorText}"
                        </p>
                      </div>
                    </div>

                    {/* 选中指示器 */}
                    {isSelected && (
                      <div className={`absolute top-2 right-2 p-2 rounded-full ${
                        isPermanent ? 'bg-purple-500' : 'bg-yellow-500'
                      }`}>
                        <Icon name="Check" size={20} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 选择提示 */}
          {!selectedEffect && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400 animate-pulse">
                👆 请选择一项庆典效果
              </p>
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={handleConfirm}
            disabled={!selectedEffect}
            className={`w-full px-6 py-4 rounded-lg text-base font-bold transition-all duration-300 ${
              selectedEffect
                ? 'bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 hover:from-yellow-500 hover:via-orange-500 hover:to-red-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedEffect 
              ? `✨ 确认选择：${selectedEffect.name}` 
              : '请先选择一项庆典效果'}
          </button>
        </div>
      </div>
    </div>
  );
};
