// 日志面板组件
// 显示游戏事件日志

import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 日志面板组件
 * 显示游戏事件日志
 * @param {Array} logs - 日志数组
 */
export const LogPanel = ({ logs }) => {
  return (
    <div className="glass-epic p-3 rounded-2xl border border-ancient-gold/20 shadow-epic relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/60 via-ancient-stone/30 to-ancient-ink/60 opacity-60" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <pattern id="log-panel-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 20 H80 M0 60 H80" stroke="currentColor" strokeWidth="0.5" className="text-ancient-gold/10" />
            <path d="M20 0 V80 M60 0 V80" stroke="currentColor" strokeWidth="0.5" className="text-ancient-gold/10" />
            <circle cx="40" cy="40" r="2" fill="currentColor" className="text-ancient-gold/30" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#log-panel-pattern)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ancient flex items-center gap-2">
            <Icon name="ScrollText" size={16} className="text-ancient-gold" />
            事件日志
          </h3>
          <span className="text-[11px] text-ancient-stone opacity-80">
            共 {logs.length} 条
          </span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-ancient-gold/40">
          {logs.length === 0 ? (
            <p className="text-xs text-ancient-stone opacity-70 italic text-center py-4">
              暂无事件
            </p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="text-xs text-ancient-parchment glass-ancient border border-ancient-gold/10 rounded-lg px-2 py-1.5 hover:border-ancient-gold/30 transition-all animate-fade-in"
              >
                <span className="text-ancient-gold/60 font-mono text-[10px] mr-2">#{idx + 1}</span>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
