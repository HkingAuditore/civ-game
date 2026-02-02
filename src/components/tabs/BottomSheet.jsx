import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
    preventEscapeClose = false,
    wrapperClassName = ''
}) => {
    // Use ref to track onClose to avoid stale closure issues
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Stable close handler that always uses the latest onClose
    const handleClose = useCallback(() => {
        onCloseRef.current?.();
    }, []);

    useEffect(() => {
        if (preventEscapeClose || !isOpen) return undefined;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [preventEscapeClose, isOpen, handleClose]);

    // Framer Motion handles rendering via AnimatePresence, so we always render the Portal if implementation allows,
    // but since we want the portal to exist only when open (or animating), 
    // AnimatePresence works best when the direct child is conditional.
    // However, createPortal returns a React Node. We can wrap the content INSIDE the portal.

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className={`fixed inset-0 z-[150] flex items-end justify-center lg:items-center ${wrapperClassName}`}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/60"
                        onClick={preventBackdropClose ? undefined : handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-2xl glass-epic border-t-2 lg:border-2 border-ancient-gold/30 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col"
                        style={{ maxHeight: 'calc(var(--real-viewport-height, 100vh) * 0.85)' }}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* Emergency close button - always visible at top-right corner */}
                        <button
                            onClick={handleClose}
                            className="absolute top-2 right-2 z-50 p-2 rounded-full bg-red-900/80 hover:bg-red-700 transition-colors shadow-lg border border-red-600/50"
                            aria-label="关闭面板"
                            title="点击关闭 (或按 Escape)"
                        >
                            <Icon name="X" size={18} className="text-white" />
                        </button>

                        {showHeader ? (
                            <>
                                <div className="flex-shrink-0 p-4 pr-12 border-b border-theme-border flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-white font-decorative">{title}</h3>
                                    {/* Keep the original close button for header mode */}
                                    {showCloseButton && (
                                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-700">
                                            <Icon name="X" size={20} className="text-gray-400" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto">{children}</div>
                            </>
                        ) : (
                            <div className="relative flex-1 p-4 pt-10 overflow-y-auto">
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
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
