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
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg">
      {/* 标题 */}
      <h3 className="text-sm font-bold mb-2 text-gray-300 flex items-center gap-2">
        <Icon name="ScrollText" size={16} />
        事件日志
      </h3>

      {/* 日志列表 */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 italic">暂无事件</p>
        ) : (
          logs.map((log, idx) => (
            <div 
              key={idx} 
              className="text-xs text-gray-300 bg-gray-700/30 p-1.5 rounded hover:bg-gray-700/50 transition-colors animate-fade-in"
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
