// 游戏控制面板组件 - 史诗风格重构
// 紧凑设计，突出历史感

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { GAME_SPEEDS } from '../../config';
import { useSound } from '../../hooks';
import { cn } from '../../config/unifiedStyles';

/**
 * 游戏控制面板组件 - 史诗风格
 * 紧凑设计，减少空间占用
 */
export const GameControls = ({
  isPaused,
  gameSpeed,
  onPauseToggle,
  onSpeedChange,
  onSave,
  onLoadManual,
  onLoadAuto,
  onExportSave,
  onImportSave,
  onSettings,
  onReset,
  onTutorial,
  onWiki,
  autoSaveAvailable,
  menuDirection = 'down',
  onTriggerEvent,
}) => {
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const [gameMenuPos, setGameMenuPos] = useState(null);
  const [helpMenuPos, setHelpMenuPos] = useState(null);
  const importInputRef = useRef(null);

  const gameMenuButtonRef = useRef(null);
  const helpMenuButtonRef = useRef(null);
  const gameMenuContentRef = useRef(null);
  const helpMenuContentRef = useRef(null);
  
  const { playSound, SOUND_TYPES } = useSound();

  const getMenuPosition = (element, direction = 'down') => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const offset = 8;
    const isUp = direction === 'up';
    return {
      top: isUp ? rect.top - offset : rect.bottom + offset,
      left: rect.right,
      translateY: isUp ? '-100%' : '0',
    };
  };

  const updateGameMenuPosition = () => {
    if (!gameMenuButtonRef.current) return;
    const pos = getMenuPosition(gameMenuButtonRef.current, menuDirection);
    if (pos) setGameMenuPos(pos);
  };

  const updateHelpMenuPosition = () => {
    if (!helpMenuButtonRef.current) return;
    const pos = getMenuPosition(helpMenuButtonRef.current, menuDirection);
    if (pos) setHelpMenuPos(pos);
  };

  useLayoutEffect(() => {
    if (!isGameMenuOpen) return undefined;
    updateGameMenuPosition();
    const handle = () => updateGameMenuPosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isGameMenuOpen, menuDirection]);

  useLayoutEffect(() => {
    if (!isHelpMenuOpen) return undefined;
    updateHelpMenuPosition();
    const handle = () => updateHelpMenuPosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isHelpMenuOpen, menuDirection]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        isGameMenuOpen &&
        !gameMenuButtonRef.current?.contains(target) &&
        !gameMenuContentRef.current?.contains(target)
      ) {
        setIsGameMenuOpen(false);
        setIsLoadMenuOpen(false);
      }
      if (
        isHelpMenuOpen &&
        !helpMenuButtonRef.current?.contains(target) &&
        !helpMenuContentRef.current?.contains(target)
      ) {
        setIsHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGameMenuOpen, isHelpMenuOpen]);

  const handleImportFile = async (event) => {
    if (!event?.target?.files?.length || typeof onImportSave !== 'function') return;
    const [file] = event.target.files;
    event.target.value = '';
    try {
      await onImportSave(file);
      setIsGameMenuOpen(false);
      setIsLoadMenuOpen(false);
    } catch (error) {
      console.error('Import save failed:', error);
    }
  };

  const handleGameMenuToggle = () => {
    if (!isGameMenuOpen) {
      updateGameMenuPosition();
    } else {
      setIsLoadMenuOpen(false);
    }
    setIsGameMenuOpen((prev) => !prev);
  };

  const handleHelpMenuToggle = () => {
    if (!isHelpMenuOpen) {
      updateHelpMenuPosition();
    }
    setIsHelpMenuOpen((prev) => !prev);
  };

  return (
    <div className="game-controls flex items-stretch sm:items-center gap-0.5 sm:gap-1.5 h-8 sm:h-7">
      <input
        ref={importInputRef}
        type="file"
        className="hidden"
        accept=".cgsave,.bin,.dat,application/octet-stream"
        onChange={handleImportFile}
      />
      {/* 游戏速度控制 - 紧凑设计 */}
      <div className="flex items-center h-full rounded-md sm:rounded-lg border border-ancient-gold/20 glass-ancient shadow-ancient">
        {/* 暂停/继续按钮 */}
        <button
          onClick={() => {
            playSound(SOUND_TYPES.CLICK);
            onPauseToggle();
          }}
          className={cn(
            'h-full px-1.5 sm:px-2 transition-all flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold touch-feedback',
            isPaused
              ? 'bg-green-500/10 border-r border-green-500/30 text-green-300 hover:bg-green-500/20'
              : 'bg-orange-500/10 border-r border-orange-500/30 text-orange-300 hover:bg-orange-500/20'
          )}
          title={isPaused ? '继续游戏' : '暂停游戏'}
        >
          <Icon name={isPaused ? 'Play' : 'Pause'} size={10} className="sm:w-3 sm:h-3 flex-shrink-0" />
          <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
        </button>
        
        {/* 速度选择按钮 */}
        <div className="flex items-center h-full">
          {GAME_SPEEDS.map((speed, idx) => (
            <button
              key={speed}
              onClick={() => {
                playSound(SOUND_TYPES.CLICK);
                onSpeedChange(speed);
                if (isPaused) onPauseToggle();
              }}
              disabled={isPaused}
              className={cn(
                'h-full px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-bold transition-all flex items-center justify-center touch-feedback',
                idx > 0 && 'border-l border-ancient-gold/10',
                isPaused
                  ? 'text-ancient-stone/40 cursor-not-allowed'
                  : 'hover:bg-ancient-gold/10',
                gameSpeed === speed && !isPaused
                  ? 'bg-gradient-to-b from-ancient-gold/25 to-ancient-bronze/15 text-ancient-gold'
                  : isPaused
                  ? ''
                  : 'text-ancient-parchment/80'
              )}
              title={isPaused ? '请先继续游戏' : `${speed}倍速`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* 存档菜单 */}
      <div className="flex h-full">
        <button
          ref={gameMenuButtonRef}
          onClick={handleGameMenuToggle}
          className="h-full px-2 glass-ancient border border-ancient-gold/20 rounded-md sm:rounded-lg transition-all flex items-center justify-center text-ancient-parchment shadow-ancient hover:border-ancient-gold/40 hover:shadow-glow-gold touch-feedback"
          title="存档菜单"
        >
          <Icon name="Menu" size={12} className="sm:w-3.5 sm:h-3.5 text-ancient-gold" />
        </button>
        {isGameMenuOpen && gameMenuPos &&
          createPortal(
            <div className="pointer-events-none fixed inset-0 z-40">
              <div
                className="absolute"
                style={{
                  top: gameMenuPos.top,
                  left: gameMenuPos.left,
                  transform: `translate(-100%, ${gameMenuPos.translateY})`,
                }}
              >
                <div
                  ref={gameMenuContentRef}
                  className={cn(
                    'relative w-40 rounded-lg border border-ancient-gold/30 glass-epic shadow-monument py-1 pointer-events-auto animate-slide-up',
                    menuDirection === 'up' ? 'origin-bottom-right' : 'origin-top-right'
                  )}
                >
                  <button
                    onClick={() => { onSave(); setIsGameMenuOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-green-300 hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                  >
                    <Icon name="Save" size={12} />
                    <span className="ml-2">保存进度</span>
                  </button>
                  
                  <div className="relative">
                    <button
                      onClick={() => setIsLoadMenuOpen(!isLoadMenuOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-purple-300 hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                    >
                      <div className="flex items-center">
                        <Icon name="Upload" size={12} />
                        <span className="ml-2">读取存档</span>
                      </div>
                      <Icon name={isLoadMenuOpen ? 'ChevronDown' : 'ChevronRight'} size={10} />
                    </button>
                    
                    {isLoadMenuOpen && (
                      <div className={cn(
                        'absolute w-36 rounded-lg border border-ancient-gold/30 glass-epic shadow-monument py-1 animate-slide-up',
                        menuDirection === 'up'
                          ? 'right-full bottom-0 mr-1 origin-bottom-right'
                          : 'right-full top-0 mr-1 origin-top-right'
                      )}>
                        <button
                          onClick={() => { onLoadManual(); setIsGameMenuOpen(false); setIsLoadMenuOpen(false); }}
                          className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                        >
                          <Icon name="Upload" size={10} />
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
                            'w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold transition-colors rounded touch-feedback',
                            autoSaveAvailable 
                              ? 'text-amber-300 hover:bg-ancient-gold/10'
                              : 'text-ancient-stone/40 cursor-not-allowed'
                          )}
                        >
                          <span className="ml-2">自动存档</span>
                          <Icon name="Clock" size={10} />
                        </button>
                        <button
                          onClick={async () => {
                            if (typeof onExportSave === 'function') {
                              await onExportSave();
                            }
                            setIsGameMenuOpen(false);
                            setIsLoadMenuOpen(false);
                          }}
                          disabled={!onExportSave}
                          className={cn(
                            'w-full flex items-center px-3 py-2 text-[10px] font-semibold transition-colors rounded touch-feedback',
                            onExportSave ? 'text-emerald-200 hover:bg-ancient-gold/10' : 'text-ancient-stone/40 cursor-not-allowed'
                          )}
                        >
                          <Icon name="UploadCloud" size={10} />
                          <span className="ml-2">导出存档</span>
                        </button>
                        <button
                          onClick={() => {
                            if (onImportSave) {
                              importInputRef.current?.click();
                            }
                          }}
                          disabled={!onImportSave}
                          className={cn(
                            'w-full flex items-center px-3 py-2 text-[10px] font-semibold transition-colors rounded touch-feedback',
                            onImportSave ? 'text-blue-200 hover:bg-ancient-gold/10' : 'text-ancient-stone/40 cursor-not-allowed'
                          )}
                        >
                          <Icon name="DownloadCloud" size={10} />
                          <span className="ml-2">导入存档</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => { onSettings(); setIsGameMenuOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                  >
                    <Icon name="Settings" size={12} />
                    <span className="ml-2">存档设置</span>
                  </button>
                  
                  <div className="my-1 h-px bg-gradient-to-r from-transparent via-ancient-gold/30 to-transparent mx-2"></div>
                  
                  <button
                    onClick={() => { 
                      if (window.confirm('确定要重置游戏吗？所有进度将丢失。')) {
                        onReset(); 
                        setIsGameMenuOpen(false);
                      }
                    }}
                    className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-red-300 hover:bg-red-500/10 transition-colors rounded touch-feedback"
                  >
                    <Icon name="RefreshCw" size={12} />
                    <span className="ml-2">重置游戏</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* 帮助菜单 */}
      <div className="flex h-full">
        <button
          ref={helpMenuButtonRef}
          onClick={handleHelpMenuToggle}
          className="h-full px-2 glass-ancient border border-blue-500/30 rounded-md sm:rounded-lg transition-all flex items-center justify-center text-blue-300 shadow-ancient hover:border-blue-500/50 hover:bg-blue-500/10 touch-feedback"
          title="帮助与指南"
        >
          <Icon name="HelpCircle" size={12} className="sm:w-3.5 sm:h-3.5" />
        </button>
        
        {isHelpMenuOpen && helpMenuPos &&
          createPortal(
            <div className="pointer-events-none fixed inset-0 z-40">
              <div
                className="absolute"
                style={{
                  top: helpMenuPos.top,
                  left: helpMenuPos.left,
                  transform: `translate(-100%, ${helpMenuPos.translateY})`,
                }}
              >
                <div
                  ref={helpMenuContentRef}
                  className={cn(
                    'w-36 rounded-lg border border-ancient-gold/30 glass-epic shadow-monument py-1 pointer-events-auto animate-slide-up',
                    menuDirection === 'up' ? 'origin-bottom-right' : 'origin-top-right'
                  )}
                >
                  <button
                    onClick={() => { onTutorial(); setIsHelpMenuOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                  >
                    <Icon name="BookOpen" size={10} />
                    <span className="ml-2">新手教程</span>
                  </button>
                  <button
                    onClick={() => { onWiki(); setIsHelpMenuOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-[10px] font-semibold text-ancient-parchment hover:bg-ancient-gold/10 transition-colors rounded touch-feedback"
                  >
                    <Icon name="Book" size={10} />
                    <span className="ml-2">文明百科</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
