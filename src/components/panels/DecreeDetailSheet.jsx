import React from 'react';
import { Icon } from '../common/UIComponents';

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
          <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
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
      {decree.effects && decree.effects.length > 0 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded p-2">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="TrendingUp" size={12} className="text-green-400" />
            正面效果
          </h3>
          <div className="space-y-1">
            {decree.effects.map((effect, idx) => (
              <div key={idx} className="flex items-start gap-1.5 bg-green-900/20 rounded px-2 py-1">
                <Icon name="Plus" size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-green-300 leading-relaxed">{effect}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 负面效果 */}
      {decree.drawbacks && decree.drawbacks.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
          <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
            <Icon name="TrendingDown" size={12} className="text-red-400" />
            负面效果
          </h3>
          <div className="space-y-1">
            {decree.drawbacks.map((drawback, idx) => (
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

      {/* 操作按钮 */}
      <div className="pt-2">
        <button
          onClick={() => {
            if (onToggle) {
              onToggle(decree.id);
              onClose();
            }
          }}
          disabled={!onToggle}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
            onToggle
              ? isActive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-xl active:scale-95'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Icon name={isActive ? "XCircle" : "CheckCircle"} size={18} />
          <span>{isActive ? '废除政策' : '颁布政策'}</span>
        </button>
      </div>
    </div>
  );
};