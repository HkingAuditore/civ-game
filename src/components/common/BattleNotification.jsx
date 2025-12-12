// 战斗通知组件
// 在页面顶部显示战斗结果摘要，点击后展开详情

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './UIComponents';
import { UNIT_TYPES } from '../../config/militaryUnits';

// 配置常量
const MAX_VISIBLE_NOTIFICATIONS = 3;  // 最多显示3条通知
const AUTO_DISMISS_DELAY = 5000;      // 5秒后自动消失

/**
 * 单个战斗通知条目
 */
const NotificationItem = ({ notification, onView, onDismiss, autoDismissDelay = AUTO_DISMISS_DELAY }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  const result = notification.result;
  
  // 保持 onDismiss 的最新引用
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  
  // 自动消失计时器
  useEffect(() => {
    const notificationId = notification.id;
    
    if (isHovered) {
      // 鼠标悬停时暂停计时
      pausedTimeRef.current = Date.now() - startTimeRef.current;
      if (progressRef.current) {
        cancelAnimationFrame(progressRef.current);
      }
      return;
    }
    
    // 恢复计时
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / autoDismissDelay) * 100);
      setProgress(remaining);
      
      if (remaining > 0) {
        progressRef.current = requestAnimationFrame(updateProgress);
      } else {
        // 使用 ref 调用，避免依赖变化导致 effect 重置
        onDismissRef.current(notificationId);
      }
    };
    
    progressRef.current = requestAnimationFrame(updateProgress);
    
    return () => {
      if (progressRef.current) {
        cancelAnimationFrame(progressRef.current);
      }
    };
  }, [isHovered, autoDismissDelay, notification.id]); // 移除 onDismiss 依赖
  
  // 计算总损失
  const losses = result.losses || result.defenderLosses || {};
  const totalLosses = Object.values(losses).reduce((sum, count) => sum + (count || 0), 0);
  
  // 生成摘要文本
  const getSummaryText = () => {
    if (result.isRaid) {
      // 获取行动名称，默认为"突袭"
      const actionName = result.actionName || '突袭';
      if (result.victory) {
        return `成功击退了 ${result.nationName} 的${actionName}！`;
      } else {
        const lossDetails = [];
        if (result.foodLoss > 0) lossDetails.push(`粮食-${result.foodLoss}`);
        if (result.silverLoss > 0) lossDetails.push(`银币-${result.silverLoss}`);
        if (result.woodLoss > 0) lossDetails.push(`木材-${result.woodLoss}`);
        if (result.popLoss > 0) lossDetails.push(`人口-${result.popLoss}`);
        return `遭到 ${result.nationName} 的${actionName}！${lossDetails.length > 0 ? `（${lossDetails.join('、')}）` : ''}`;
      }
    } else {
      if (result.victory) {
        return `对 ${result.nationName || '敌方'} 的战斗胜利！${totalLosses > 0 ? `（损失${totalLosses}单位）` : ''}`;
      } else {
        return `对 ${result.nationName || '敌方'} 的战斗失利…${totalLosses > 0 ? `（损失${totalLosses}单位）` : ''}`;
      }
    }
  };

  return (
    <div 
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg backdrop-blur-sm cursor-pointer transition-all duration-200 overflow-hidden ${
        result.victory 
          ? 'bg-emerald-900/80 border-emerald-500/40 hover:bg-emerald-800/80' 
          : 'bg-red-900/80 border-red-500/40 hover:bg-red-800/80'
      } ${isHovered ? 'scale-[1.02]' : ''}`}
      onClick={() => onView(notification)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 进度条 - 显示剩余时间 */}
      <div 
        className={`absolute bottom-0 left-0 h-0.5 transition-all ${
          result.victory ? 'bg-emerald-400/60' : 'bg-red-400/60'
        }`}
        style={{ width: `${progress}%` }}
      />
      
      {/* 图标 */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        result.victory ? 'bg-emerald-700/50' : 'bg-red-700/50'
      }`}>
        <Icon 
          name={result.isRaid ? (result.victory ? 'Shield' : 'Flame') : (result.victory ? 'Trophy' : 'Skull')} 
          size={16} 
          className={result.victory ? 'text-emerald-300' : 'text-red-300'} 
        />
      </div>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${result.victory ? 'text-emerald-200' : 'text-red-200'}`}>
            {result.isRaid ? (result.victory ? `${result.actionName || '突袭'}击退` : `遭受${result.actionName || '突袭'}`) : (result.victory ? '战斗胜利' : '战斗失利')}
          </span>
          {!result.isRaid && typeof result.score === 'number' && (
            <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-ancient-ink/50 text-ancient-parchment">
              评分 {result.score.toFixed(0)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-200 truncate leading-tight mt-0.5">
          {getSummaryText()}
        </p>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onView(notification);
          }}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
          title="查看详情"
        >
          <Icon name="Eye" size={14} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
          title="关闭"
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    </div>
  );
};

/**
 * 战斗通知容器组件
 * @param {Array} notifications - 通知数组 [{id, result, timestamp}]
 * @param {Function} onViewDetail - 查看详情回调
 * @param {Function} onDismiss - 关闭单个通知回调
 * @param {Function} onDismissAll - 关闭所有通知回调
 */
export const BattleNotification = ({ notifications = [], onViewDetail, onDismiss, onDismissAll }) => {
  if (!notifications || notifications.length === 0) return null;

  // 只显示最新的 MAX_VISIBLE_NOTIFICATIONS 条通知
  const visibleNotifications = notifications.slice(-MAX_VISIBLE_NOTIFICATIONS);
  const hiddenCount = notifications.length - visibleNotifications.length;

  return createPortal(
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4 space-y-2 pointer-events-none">
      {/* 显示隐藏数量提示 */}
      {hiddenCount > 0 && (
        <div className="pointer-events-auto flex justify-center">
          <span className="px-2 py-0.5 text-[10px] text-gray-400 bg-gray-800/60 rounded-full border border-gray-600/30">
            还有 {hiddenCount} 条较早的通知
          </span>
        </div>
      )}
      
      {visibleNotifications.map((notification, index) => (
        <div 
          key={notification.id} 
          className="pointer-events-auto animate-slide-down"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <NotificationItem 
            notification={notification}
            onView={onViewDetail}
            onDismiss={onDismiss}
          />
        </div>
      ))}
      
      {/* 全部关闭按钮 */}
      {notifications.length > 1 && (
        <div className="pointer-events-auto flex justify-center pt-1">
          <button 
            onClick={onDismissAll}
            className="px-3 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700/80 rounded-full border border-gray-600/40 transition-colors"
          >
            全部关闭 ({notifications.length})
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default BattleNotification;
