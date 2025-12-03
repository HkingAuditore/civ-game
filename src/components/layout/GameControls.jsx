// 游戏控制面板组件
// 包含速度控制、暂停、存档、帮助等功能

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';
import { GAME_SPEEDS } from '../../config';
import { useSound } from '../../hooks';
import { cn } from '../../config/unifiedStyles';

/**
 * 游戏控制面板组件
 * 包含游戏速度控制、暂停、存档、帮助等功能
 */
export const GameControls = ({
  isPaused,
  gameSpeed,
  onPauseToggle,
  onSpeedChange,
  onSave,
  onLoadManual,
  onLoadAuto,
  onSettings,
  onReset,
  onTutorial,
  onWiki,
  autoSaveAvailable,
  menuDirection = 'down', // 'up' or 'down'
  onTriggerEvent, // 新增：触发事件的回调
}) => {
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  
  const gameMenuRef = useRef(null);
  const helpMenuRef = useRef(null);
  
  const { playSound, SOUND_TYPES } = useSound();

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gameMenuRef.current && !gameMenuRef.current.contains(event.target)) {
        setIsGameMenuOpen(false);
        setIsLoadMenuOpen(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target)) {
        setIsHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 游戏速度控制 */}
      <div className="flex items-center rounded-xl border border-ancient-gold/20 glass-ancient overflow-hidden shadow-epic">
        {/* 暂停/继续按钮 */}
        <button
          onClick={() => {
            playSound(SOUND_TYPES.CLICK);
            onPauseToggle();
          }}
          className={cn(
            'px-3 py-2 transition-all flex items-center gap-2 text-xs font-bold min-h-[40px]',
            isPaused
              ? 'glass-ancient border-r border-green-500/30 text-green-300 hover:bg-green-500/10'
              : 'glass-ancient border-r border-orange-500/30 text-orange-300 hover:bg-orange-500/10'
          )}
          title={isPaused ? '继续游戏' : '暂停游戏'}
        >
          <Icon name={isPaused ? 'Play' : 'Pause'} size={14} />
          <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
        </button>
        
        <div className="w-px h-5 bg-ancient-gold/20 self-center"></div>
        
        {/* 速度选择按钮 */}
        {GAME_SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => {
              playSound(SOUND_TYPES.CLICK);
              onSpeedChange(speed);
              if (isPaused) onPauseToggle();
            }}
            disabled={isPaused}
            className={cn(
              'px-3 py-2 text-xs font-bold transition-all min-h-[40px]',
              isPaused
                ? 'text-ancient-stone/50 cursor-not-allowed'
                : 'hover:bg-ancient-gold/10',
              gameSpeed === speed && !isPaused
                ? 'bg-gradient-to-b from-ancient-gold/30 to-ancient-bronze/20 text-ancient-gold border-x border-ancient-gold/30'
                : isPaused
                ? ''
                : 'text-ancient-parchment'
            )}
            title={isPaused ? '请先继续游戏' : `${speed}倍速`}
          >
            <div className="flex items-center gap-1">
              <span>{speed}x</span>
              {speed > 1 && <Icon name="FastForward" size={12} />}
            </div>
          </button>
        ))}}
      </div>

      {/* 存档菜单 */}
      <div className="relative" ref={gameMenuRef}>
        <button
          onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
          className="px-3 py-2 glass-ancient border border-ancient-gold/20 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold text-ancient-parchment shadow-epic hover:border-ancient-gold/40 hover:glow-gold min-h-[40px]"
          title="存档菜单"
        >
          <Icon name="Menu" size={14} className="text-ancient-gold" />
          <span className="hidden lg:inline">存档</span>
        </button>
        
        {isGameMenuOpen && (
          <div className={cn(
            'absolute right-0 w-44 rounded-xl border border-ancient-gold/30 glass-epic shadow-monument py-1 z-[70] animate-slide-up',
            menuDirection === 'up' 
              ? 'bottom-full mb-2 origin-bottom-right' 
              : 'top-full mt-2 origin-top-right'
          )}>}
            <button
              onClick={() => { onSave(); setIsGameMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-green-300 hover:bg-ancient-gold/10 transition-colors rounded-lg"
            >
              <Icon name="Save" size={14} />
              <span className="ml-2">保存进度</span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => setIsLoadMenuOpen(!isLoadMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-ancient-gold/10 transition-colors rounded-lg"
              >
                <div className="flex items-center">
                  <Icon name="Upload" size={14} />
                  <span className="ml-2">读取存档</span>
                </div>
                <Icon name={isLoadMenuOpen ? 'ChevronDown' : 'ChevronRight'} size={12} />
              </button>
              
              {isLoadMenuOpen && (
                <div className="absolute right-full top-0 mr-1 w-40 rounded-xl border border-ancient-gold/30 glass-epic shadow-monument py-1 animate-slide-up">
                  <button
                    onClick={() => { onLoadManual(); setIsGameMenuOpen(false); setIsLoadMenuOpen(false); }}
                    className="w-full flex items-center px-4 py-2 text-xs font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded-lg"
                  >
                    <Icon name="Upload" size={12} />
                    <span className="ml-2">手动存档</span>
                  </button>
                  <button
                    onClick={() => { 
                      if (autoSaveAvailable) {
                        onLoadAuto(); 
                        setIsGameMenuOpen(false); 
                        setIsLoadMenuOpen(false);
                      }
                    }}
                    disabled={!autoSaveAvailable}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors rounded-lg',
                      autoSaveAvailable 
                        ? 'text-amber-300 hover:bg-ancient-gold/10'
                        : 'text-ancient-stone/50 cursor-not-allowed'
                    )}
                  >
                    <span className="ml-2">自动存档</span>
                    <Icon name="Clock" size={12} />
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => { onSettings(); setIsGameMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded-lg"
            >
              <Icon name="Settings" size={14} />
              <span className="ml-2">存档设置</span>
            </button>
            
            <div className="my-1 h-px bg-gradient-to-r from-transparent via-ancient-gold/30 to-transparent"></div>
            
            <button
              onClick={() => { 
                if (confirm('确定要重置游戏吗？所有进度将丢失！')) {
                  onReset(); 
                  setIsGameMenuOpen(false);
                }
              }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition-colors rounded-lg"
            >
              <Icon name="RefreshCw" size={14} />
              <span className="ml-2">重置游戏</span>
            </button>
          </div>
        )}
      </div>

      {/* 事件测试按钮（仅开发测试用） */}
      {/* {onTriggerEvent && (
        <button
          onClick={() => {
            playSound(SOUND_TYPES.CLICK);
            onTriggerEvent();
          }}
          className="px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/40 backdrop-blur-sm border border-yellow-500/50 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold text-yellow-300 shadow-md hover:shadow-lg"
          title="触发随机事件（测试）"
        >
          <Icon name="Zap" size={14} />
          <span className="hidden lg:inline">事件</span>
        </button>
      )} */}

      {/* 帮助菜单 */}
      <div className="relative" ref={helpMenuRef}>
        <button
          onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
          className="px-3 py-2 glass-ancient border border-blue-500/30 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold text-blue-300 shadow-epic hover:border-blue-500/50 hover:bg-blue-500/10 min-h-[40px]"
          title="帮助与指南"
        >
          <Icon name="HelpCircle" size={14} />
          <span className="hidden lg:inline">帮助</span>
        </button>
        
        {isHelpMenuOpen && (
          <div className={cn(
            'absolute right-0 w-40 rounded-xl border border-ancient-gold/30 glass-epic shadow-monument py-1 z-[70] animate-slide-up',
            menuDirection === 'up' 
              ? 'bottom-full mb-2 origin-bottom-right' 
              : 'top-full mt-2 origin-top-right'
          )}>}
            <button
              onClick={() => { onTutorial(); setIsHelpMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded-lg"
            >
              <Icon name="BookOpen" size={12} />
              <span className="ml-2">新手教程</span>
            </button>
            <button
              onClick={() => { onWiki(); setIsHelpMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded-lg"
            >
              <Icon name="Book" size={12} />
              <span className="ml-2">文明百科</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};