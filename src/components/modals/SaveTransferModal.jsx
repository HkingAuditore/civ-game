// 存档传输管理弹窗
// 统一提供导出和导入存档的多种方式

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';

const IMPORT_TIMEOUT_MS = 15000;

/**
 * 存档传输弹窗组件
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {Function} onClose - 关闭回调
 * @param {Function} onExportFile - 导出为文件
 * @param {Function} onImportFile - 从文件导入
 */
export const SaveTransferModal = ({
    isOpen,
    onClose,
    onExportFile,
    onImportFile,
}) => {
    const [activeTab, setActiveTab] = useState('export');
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
    const [isProcessing, setIsProcessing] = useState(false);
    const importInputRef = useRef(null);

    const handleExportFile = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setStatus(null);
        try {
            await onExportFile?.();
            setStatus({ type: 'success', message: '存档已导出为文件！' });
        } catch (error) {
            setStatus({ type: 'error', message: error.message || '导出失败' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImportFile = async (event) => {
        if (!event?.target?.files?.length) return;
        const [file] = event.target.files;
        event.target.value = '';

        setIsProcessing(true);
        setStatus(null);
        try {
            const result = await Promise.race([
                Promise.resolve(onImportFile?.(file)),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('导入超时（15秒）。请重试，或先清理旧存档后再导入。')), IMPORT_TIMEOUT_MS);
                }),
            ]);
            if (!result) {
                throw new Error('导入未完成。请检查存档文件是否有效。');
            }
            setStatus({ type: 'success', message: '存档导入成功！' });
            setTimeout(() => onClose(), 1000);
        } catch (error) {
            setStatus({ type: 'error', message: error.message || '导入失败' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setStatus(null);
        setActiveTab('export');
        onClose();
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-sm glass-epic border-t-2 lg:border-2 border-ancient-gold/40 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[85vh]"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* 隐藏的文件输入 */}
                        <input
                            ref={importInputRef}
                            type="file"
                            className="hidden"
                            accept=".cgsave,.bin,.dat,.json,application/octet-stream"
                            onChange={handleImportFile}
                        />

                        {/* 头部 */}
                        <div className="flex-shrink-0 px-3 py-2.5 border-b border-gray-700 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="RefreshCw" size={18} className="text-ancient-gold" />
                                    <div>
                                        <h2 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-ancient-gold via-yellow-400 to-orange-400">
                                            存档传输
                                        </h2>
                                        <p className="text-xs text-gray-400 leading-tight">
                                            在不同设备间传输存档数据
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <Icon name="X" size={18} className="text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* 标签页切换 */}
                        <div className="flex-shrink-0 flex border-b border-gray-700">
                            <button
                                onClick={() => { setActiveTab('export'); setStatus(null); }}
                                className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'export'
                                        ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-900/20'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                <Icon name="Upload" size={14} />
                                导出存档
                            </button>
                            <button
                                onClick={() => { setActiveTab('import'); setStatus(null); }}
                                className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'import'
                                        ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                <Icon name="Download" size={14} />
                                导入存档
                            </button>
                        </div>

                        {/* 内容区域 */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {activeTab === 'export' ? (
                                <>
                                    <p className="text-xs text-gray-400 mb-3">
                                        选择导出方式，将当前存档传输到其他设备
                                    </p>

                                    {/* 导出为文件 */}
                                    <button
                                        onClick={handleExportFile}
                                        disabled={isProcessing}
                                        className="w-full p-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/40 transition-all text-left group disabled:opacity-50"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-500/20">
                                                <Icon name="FileDown" size={20} className="text-emerald-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-emerald-300">保存为文件</div>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    下载存档文件到设备，可通过文件管理器分享
                                                </p>
                                            </div>
                                            <Icon name="ChevronRight" size={16} className="text-gray-500 group-hover:text-emerald-400 transition-colors mt-2" />
                                        </div>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-400 mb-3">
                                        选择导入方式，从其他设备恢复存档
                                    </p>

                                    {/* 从文件导入 */}
                                    <button
                                        onClick={() => importInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className="w-full p-3 rounded-xl border border-blue-500/30 bg-blue-900/20 hover:bg-blue-900/40 transition-all text-left group disabled:opacity-50"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-blue-500/20">
                                                <Icon name="FileUp" size={20} className="text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-blue-300">从文件导入</div>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    选择 .cgsave 存档文件进行导入
                                                </p>
                                            </div>
                                            <Icon name="ChevronRight" size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors mt-2" />
                                        </div>
                                    </button>
                                </>
                            )}

                            {/* 状态提示 */}
                            {status && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-3 rounded-lg flex items-center gap-2 ${status.type === 'success'
                                            ? 'bg-green-900/40 border border-green-500/30'
                                            : 'bg-red-900/40 border border-red-500/30'
                                        }`}
                                >
                                    <Icon
                                        name={status.type === 'success' ? 'CheckCircle' : 'AlertCircle'}
                                        size={16}
                                        className={status.type === 'success' ? 'text-green-400' : 'text-red-400'}
                                    />
                                    <span className={`text-xs ${status.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                                        {status.message}
                                    </span>
                                </motion.div>
                            )}

                            {/* 处理中指示器 */}
                            {isProcessing && (
                                <div className="flex items-center justify-center gap-2 py-2">
                                    <div className="w-4 h-4 border-2 border-ancient-gold/30 border-t-ancient-gold rounded-full animate-spin" />
                                    <span className="text-xs text-gray-400">处理中...</span>
                                </div>
                            )}
                        </div>

                        {/* 底部提示 */}
                        <div className="flex-shrink-0 px-3 py-2 border-t border-gray-700 bg-gray-800/50">
                            <p className="text-xs text-gray-500 text-center">
                                💡 提示：导出后请妥善保存，存档数据包含游戏进度
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default SaveTransferModal;
