// 游戏控制面板组件
// 包含速度控制、暂停、存档、帮助等功能

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { GAME_SPEEDS } from '../../config';
import { useSound } from '../../hooks';

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
      <div className="flex items-center rounded-xl border border-gray-700/50 bg-gray-800/40 backdrop-blur-sm overflow-hidden shadow-md">
        {/* 暂停/继续按钮 */}
        <button
          onClick={() => {
            playSound(SOUND_TYPES.CLICK);
            onPauseToggle();
          }}
          className={`
            px-3 py-2 transition-all flex items-center gap-2 text-xs font-bold
            ${isPaused
              ? 'bg-green-600/30 hover:bg-green-600/40 text-green-200'
              : 'bg-orange-600/30 hover:bg-orange-600/40 text-orange-200'
            }
          `}
          title={isPaused ? '继续游戏' : '暂停游戏'}
        >
          <Icon name={isPaused ? 'Play' : 'Pause'} size={14} />
          <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
        </button>
        
        <div className="w-px h-5 bg-gray-600 self-center"></div>
        
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
            className={`
              px-3 py-2 text-xs font-bold transition-all
              ${isPaused
                ? 'text-gray-500 cursor-not-allowed'
                : 'hover:bg-gray-700/50'
              }
              ${gameSpeed === speed && !isPaused
                ? 'bg-blue-600 text-white shadow-glow-sm'
                : isPaused
                ? ''
                : 'text-gray-300'
              }
            `}
            title={isPaused ? '请先继续游戏' : `${speed}倍速`}
          >
            <div className="flex items-center gap-1">
              <span>{speed}x</span>
              {speed > 1 && <Icon name="FastForward" size={12} />}
            </div>
          </button>
        ))}
      </div>

      {/* 存档菜单 */}
      <div className="relative" ref={gameMenuRef}>
        <button
          onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
          className="px-3 py-2 bg-slate-700/60 hover:bg-slate-600/60 backdrop-blur-sm border border-slate-500/50 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold text-slate-200 shadow-md hover:shadow-lg"
          title="存档菜单"
        >
  <Icon name="Menu" size={14} className="text-slate-200" />
          <span className="hidden lg:inline">存档</span>
        </button>
        
        {isGameMenuOpen && (
          <div className={`
            absolute right-0 w-44 rounded-xl border border-slate-700/70 bg-slate-900/95 backdrop-blur-md shadow-glass py-1 z-[70] animate-slide-up
            ${menuDirection === 'up' 
              ? 'bottom-full mb-2 origin-bottom-right' 
              : 'top-full mt-2 origin-top-right'
            }
          `}>
            <button
              onClick={() => { onSave(); setIsGameMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-green-300 hover:bg-slate-700/60 transition-colors"
            >
              <Icon name="Save" size={14} />
              <span className="ml-2">保存进度</span>
            </button>
            
            <div className="relative">
              <button
                onClick={() => setIsLoadMenuOpen(!isLoadMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-purple-200 hover:bg-slate-700/60 transition-colors"
              >
                <div className="flex items-center">
                  <Icon name="Upload" size={14} />
                  <span className="ml-2">读取存档</span>
                </div>
                <Icon name={isLoadMenuOpen ? 'ChevronDown' : 'ChevronRight'} size={12} />
              </button>
              
              {isLoadMenuOpen && (
                <div className="absolute right-full top-0 mr-1 w-40 rounded-xl border border-slate-700/70 bg-slate-800/95 backdrop-blur-md shadow-glass py-1 animate-slide-up">
                  <button
                    onClick={() => { onLoadManual(); setIsGameMenuOpen(false); setIsLoadMenuOpen(false); }}
                    className="w-full flex items-center px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 transition-colors"
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
                    className={`
                      w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors
                      ${autoSaveAvailable 
                        ? 'text-amber-200 hover:bg-slate-700/60'
                        : 'text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    <span className="ml-2">自动存档</span>
                    <Icon name="Clock" size={12} />
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => { onSettings(); setIsGameMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 transition-colors"
            >
              <Icon name="Settings" size={14} />
              <span className="ml-2">存档设置</span>
            </button>
            
            <div className="my-1 h-px bg-slate-700"></div>
            
            <button
              onClick={() => { 
                if (confirm('确定要重置游戏吗？所有进度将丢失！')) {
                  onReset(); 
                  setIsGameMenuOpen(false);
                }
              }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-red-300 hover:bg-slate-700/60 transition-colors"
            >
              <Icon name="RefreshCw" size={14} />
              <span className="ml-2">重置游戏</span>
            </button>
          </div>
        )}
      </div>

      {/* 帮助菜单 */}
      <div className="relative" ref={helpMenuRef}>
        <button
          onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
          className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 backdrop-blur-sm border border-blue-500/50 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold text-blue-300 shadow-md hover:shadow-lg"
          title="帮助与指南"
        >
          <Icon name="HelpCircle" size={14} />
          <span className="hidden lg:inline">帮助</span>
        </button>
        
        {isHelpMenuOpen && (
          <div className={`
            absolute right-0 w-40 rounded-xl border border-slate-700/70 bg-slate-900/95 backdrop-blur-md shadow-glass py-1 z-[70] animate-slide-up
            ${menuDirection === 'up' 
              ? 'bottom-full mb-2 origin-bottom-right' 
              : 'top-full mt-2 origin-top-right'
            }
          `}>
            <button
              onClick={() => { onTutorial(); setIsHelpMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 transition-colors"
            >
              <Icon name="BookOpen" size={12} />
              <span className="ml-2">新手教程</span>
            </button>
            <button
              onClick={() => { onWiki(); setIsHelpMenuOpen(false); }}
              className="w-full flex items-center px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/60 transition-colors"
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