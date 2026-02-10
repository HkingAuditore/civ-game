import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

const SIZE_CLASS = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-none',
};

export function ResponsiveModal({
    isOpen,
    onClose,
    children,
    size = 'lg',
    mobileMode = 'sheet',
    className = '',
    panelClassName = '',
    closeOnBackdrop = true,
    closeOnEscape = true,
    safeArea = true,
    zIndexClass = 'z-[120]',
    ariaLabel = 'dialog',
}) {
    const panelRef = useRef(null);
    const { isPhone } = useResponsiveLayout();
    const lastFocusedRef = useRef(null);

    const isFullscreen = isPhone && mobileMode === 'fullscreen';
    const isSheet = isPhone && mobileMode === 'sheet';

    const panelShapeClass = useMemo(() => {
        if (isFullscreen) return 'rounded-none h-full w-full';
        if (isSheet) return 'rounded-t-2xl border-t-2 w-full max-h-[92vh]';
        return `rounded-2xl w-full ${SIZE_CLASS[size] || SIZE_CLASS.lg} max-h-[90vh]`;
    }, [isFullscreen, isSheet, size]);

    useEffect(() => {
        if (!isOpen) return undefined;

        lastFocusedRef.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
            if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === 'function') {
                lastFocusedRef.current.focus();
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !closeOnEscape) return undefined;
        const onKeydown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKeydown);
        return () => document.removeEventListener('keydown', onKeydown);
    }, [isOpen, closeOnEscape, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const panel = panelRef.current;
        if (!panel) return undefined;
        const focusable = panel.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && typeof focusable.focus === 'function') focusable.focus();
        return undefined;
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className={`fixed inset-0 ${zIndexClass} flex justify-center ${isSheet ? 'items-end' : 'items-center'} ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
        >
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={closeOnBackdrop ? onClose : undefined}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                className={`relative bg-gray-900 border border-ancient-gold/30 shadow-2xl overflow-hidden flex flex-col ${panelShapeClass} ${panelClassName}`}
                style={safeArea ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}

export default ResponsiveModal;
