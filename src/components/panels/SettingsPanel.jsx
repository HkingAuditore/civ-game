// 设置面板组件
// 控制自动存档的开关、频率与读档方式

import React from 'react';
import { Icon } from '../common/UIComponents';

export const SettingsPanel = ({
  isAutoSaveEnabled,
  autoSaveInterval,
  onToggleAutoSave,
  onIntervalChange,
  lastAutoSaveTime,
  onManualSave,
  onManualLoad,
  onAutoLoad,
  autoSaveAvailable,
  isSaving,
  onClose,
}) => {
  // 格式化上次自动存档时间
  const renderLastAutoSave = () => {
    if (!lastAutoSaveTime) return '尚未自动存档';
    try {
      return new Date(lastAutoSaveTime).toLocaleTimeString();
    } catch {
      return '时间未知';
    }
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-4 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Icon name="Sliders" size={16} /> 设置
        </h3>
        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-1 text-emerald-300 text-[11px]">
              <Icon name="Activity" size={12} className="animate-spin" />
              <span>保存中</span>
            </div>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
              title="关闭设置"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <span>自动存档</span>
          <span className={isAutoSaveEnabled ? 'text-emerald-300' : 'text-gray-500'}>
            {isAutoSaveEnabled ? '已启用' : '已暂停'}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isAutoSaveEnabled}
            onChange={(e) => onToggleAutoSave(e.target.checked)}
          />
          <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
          <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${isAutoSaveEnabled ? 'translate-x-5' : ''}`} />
        </label>
      </div>

      <div className="space-y-2 text-xs text-gray-300">
        <div className="flex items-center justify-between">
          <span>自动存档间隔</span>
          <span>{autoSaveInterval} 秒</span>
        </div>
        <input
          type="range"
          min={15}
          max={300}
          step={15}
          value={autoSaveInterval}
          onChange={(e) => onIntervalChange(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <p className="text-[11px] text-gray-400">最短 15 秒，最长 5 分钟。</p>
      </div>

      <div className="text-[11px] text-gray-400 flex items-center gap-2">
        <Icon name="Clock" size={12} className="text-gray-500" />
        <span>上次自动存档：{renderLastAutoSave()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={onManualSave}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-500/30 text-emerald-200 transition-colors"
        >
          <Icon name="Save" size={14} />
          手动存档
        </button>
        <button
          type="button"
          onClick={onManualLoad}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-purple-700/30 hover:bg-purple-700/50 border border-purple-500/30 text-purple-200 transition-colors"
        >
          <Icon name="Download" size={14} />
          读手动档
        </button>
        <button
          type="button"
          onClick={onAutoLoad}
          disabled={!autoSaveAvailable}
          className={`col-span-2 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
            autoSaveAvailable
              ? 'bg-amber-700/30 hover:bg-amber-700/50 border-amber-500/30 text-amber-200'
              : 'bg-gray-700/40 border-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          title={autoSaveAvailable ? '读取最近的自动存档' : '暂无自动存档'}
        >
          <Icon name="Clock" size={14} />
          读自动档
        </button>
      </div>

      <div className="text-[11px] text-gray-400 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${autoSaveAvailable ? 'bg-emerald-400' : 'bg-gray-500'}`} />
        {autoSaveAvailable ? '检测到自动存档，可随时读取。' : '尚未生成自动存档。'}
      </div>
    </div>
  );
};
