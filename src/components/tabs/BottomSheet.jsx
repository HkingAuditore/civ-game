import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';

/**
 * 响应式底部面板/模态框
 * @param {boolean} isOpen - 是否打开
 * @param {Function} onClose - 关闭回调
 * @param {React.ReactNode} children - 内容
 * @param {string} title - 标题
 * @param {boolean} [showHeader=true] - 是否显示头部
 * @param {boolean} [preventBackdropClose=false] - 是否禁止点击背景关闭
 * @param {boolean} [showCloseButton=true] - 是否显示右上角关闭按钮
 * @param {boolean} [preventEscapeClose=false] - 是否禁止按下 Escape 关闭
 */
export const BottomSheet = ({
  isOpen,
  onClose,
  children,
  title,
  showHeader = true,
  preventBackdropClose = false,
  showCloseButton = true,
  preventEscapeClose = false
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (preventEscapeClose) return undefined;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [preventEscapeClose]);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
      setIsAnimatingOut(false);
    }, 300); // 动画时长
  };

  if (!isOpen) return null;

  const animationClass = isAnimatingOut ? 'animate-sheet-out' : 'animate-sheet-in';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      role="dialog"
      aria-modal="true"
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={preventBackdropClose ? undefined : handleClose}
      ></div>

      {/* 内容面板 */}
      <div
        className={`relative w-full max-w-2xl bg-gray-800 border-t-2 lg:border-2 border-gray-700 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] ${animationClass} lg:animate-slide-up`}
      >
        {showHeader ? (
          <>
            <div className="flex-shrink-0 p-4 border-b border-theme-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{title}</h3>
              {showCloseButton && (
                <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-700">
                  <Icon name="X" size={20} className="text-gray-400" />
                </button>
              )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto">{children}</div>
          </>
        ) : (
          <div className="relative flex-1 p-4 overflow-y-auto">
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-gray-900/50 hover:bg-gray-700/80 transition-colors"
              >
                <Icon name="X" size={20} className="text-gray-400" />
              </button>
            )}
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
