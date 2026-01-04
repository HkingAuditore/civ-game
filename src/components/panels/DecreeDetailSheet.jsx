import React from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA } from '../../config';

// 格式化修正值为百分比显示
const formatModPercent = (value) => {
  const percent = Math.round(value * 100);
  if (percent > 0) return `+${percent}%`;
  return `${percent}%`;
};

// 获取资源显示名称
const getResourceName = (key) => {
  return RESOURCES[key]?.name || key;
};

// 获取阶层显示名称
const getStratumName = (key) => {
  return STRATA[key]?.name || key;
};

// 判断是否为供需修正相关的效果文本
const isSupplyDemandEffect = (text) => {
  // 匹配包含资源名+需求/供应的模式，或包含阶层名+消费的模式
  const supplyDemandPatterns = [
    /需求\s*[+-]?\d+%/,      // 如：粮食需求 -10%
    /供应\s*[+-]?\d+%/,      // 如：食物供应 +15%
    /消费\s*[+-]?\d+%/,      // 如：军人消费 -10%
  ];
  return supplyDemandPatterns.some(pattern => pattern.test(text));
};

// 过滤掉供需修正相关的效果
const filterSupplyDemandEffects = (effects) => {
  if (!effects || !Array.isArray(effects)) return [];
  return effects.filter(effect => !isSupplyDemandEffect(effect));
};

/**
 * 政策详情底部面板组件
 * 在BottomSheet中显示政策的详细信息
 */
export const DecreeDetailSheet = ({
  decree,
  onToggle,
  onClose,
}) => {
  if (!decree) {
    return (
      <div className="text-center text-gray-400 py-8">
        <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
        <p>未找到该政策信息</p>
      </div>
    );
  }

  const isActive = decree.active;
  
  // 过滤掉供需修正相关的效果（避免与供需修正区块重复显示）
  const hasSupplyDemandMod = decree.modifiers && (
    decree.modifiers.resourceDemandMod || 
    decree.modifiers.stratumDemandMod || 
    decree.modifiers.resourceSupplyMod
  );
  const filteredEffects = hasSupplyDemandMod 
    ? filterSupplyDemandEffects(decree.effects) 
    : decree.effects;
  const filteredDrawbacks = hasSupplyDemandMod 
    ? filterSupplyDemandEffects(decree.drawbacks) 
    : decree.drawbacks;

  return (
    <div className="space-y-2">
      {/* 头部：政策名称和图标 */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <div className="w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center flex-shrink-0">
          {isActive ? (
            <Icon name="Check" size={24} className="text-green-400 icon-metal-green" />
          ) : (
            <Icon name="FileText" size={24} className="text-purple-400 icon-metal-purple" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-2 font-decorative">
            {decree.name}
            {isActive && (
              <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">生效中</span>
            )}
          </h2>
          <p className="text-xs text-gray-400 leading-tight">{decree.desc}</p>
        </div>
      </div>

      {/* 政策类别 */}
      <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">政策类别</span>
          <span className="text-xs font-bold text-white">
            {decree.category === 'economy' && '经济政策'}
            {decree.category === 'military' && '军事政策'}
            {decree.category === 'culture' && '文化政策'}
            {decree.category === 'social' && '社会政策'}
          </span>
        </div>
      </div>

      {/* 正面效果 */}
      {filteredEffects && filteredEffects.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded p-2">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1 font-decorative">
            <Icon name="TrendingUp" size={12} className="text-green-400" />
            正面效果
          </h3>
          <div className="space-y-1">
            {filteredEffects.map((effect, idx) => (
              <div key={idx} className="flex items-start gap-1.5 bg-green-900/20 rounded px-2 py-1">
                <Icon name="Plus" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-green-300 leading-relaxed">{effect}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 负面效果 */}
      {filteredDrawbacks && filteredDrawbacks.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1 font-decorative">
            <Icon name="TrendingDown" size={12} className="text-red-400" />
            负面效果
          </h3>
          <div className="space-y-1">
            {filteredDrawbacks.map((drawback, idx) => (
              <div key={idx} className="flex items-start gap-1.5 bg-red-900/20 rounded px-2 py-1">
                <Icon name="Minus" size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-red-300 leading-relaxed">{drawback}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 解锁条件 */}
      {decree.unlockEpoch !== undefined && decree.unlockEpoch > 0 && (
        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">解锁时代</span>
            <span className="text-xs font-bold text-purple-300">
              时代 {decree.unlockEpoch + 1}
            </span>
          </div>
        </div>
      )}

      {/* 供需修正效果 */}
      {decree.modifiers && (decree.modifiers.resourceDemandMod || decree.modifiers.stratumDemandMod || decree.modifiers.resourceSupplyMod) && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1 font-decorative">
            <Icon name="BarChart3" size={12} className="text-blue-400" />
            供需修正
          </h3>
          <div className="space-y-2">
            {/* 资源需求修正 */}
            {decree.modifiers.resourceDemandMod && Object.keys(decree.modifiers.resourceDemandMod).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400">资源需求</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(decree.modifiers.resourceDemandMod).map(([resKey, value]) => (
                    <span 
                      key={resKey} 
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        value > 0 ? 'bg-orange-900/30 text-orange-300' : 'bg-cyan-900/30 text-cyan-300'
                      }`}
                    >
                      {getResourceName(resKey)} {formatModPercent(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 资源供应修正 */}
            {decree.modifiers.resourceSupplyMod && Object.keys(decree.modifiers.resourceSupplyMod).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400">资源供应</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(decree.modifiers.resourceSupplyMod).map(([resKey, value]) => (
                    <span 
                      key={resKey} 
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        value > 0 ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                      }`}
                    >
                      {getResourceName(resKey)} {formatModPercent(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 阶层需求修正 */}
            {decree.modifiers.stratumDemandMod && Object.keys(decree.modifiers.stratumDemandMod).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400">阶层消费</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(decree.modifiers.stratumDemandMod).map(([stratumKey, value]) => (
                    <span 
                      key={stratumKey} 
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        value > 0 ? 'bg-purple-900/30 text-purple-300' : 'bg-teal-900/30 text-teal-300'
                      }`}
                    >
                      {getStratumName(stratumKey)} {formatModPercent(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 状态说明 */}
      <div className={`rounded p-3 border ${
        isActive 
          ? 'bg-green-900/20 border-green-500/30' 
          : 'bg-gray-700/50 border-gray-600'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon 
            name={isActive ? "CheckCircle" : "Circle"} 
            size={20} 
            className={isActive ? "text-green-400" : "text-gray-400"} 
          />
          <span className={`text-sm font-bold ${isActive ? 'text-green-300' : 'text-gray-300'}`}>
            {isActive ? '该政策当前生效中' : '该政策当前未启用'}
          </span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          {isActive 
            ? '政策效果正在影响你的国家。你可以随时废除该政策。'
            : '点击"颁布"按钮即可激活该政策。激活后政策效果将立即生效。'
          }
        </p>      </div>
    </div>
  );
};