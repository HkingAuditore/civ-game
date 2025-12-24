// 设置面板组件
// 控制自动存档、读档方式及跨设备备份

import React, { useRef, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { useSound } from '../../hooks';

export const SettingsPanel = ({
    isAutoSaveEnabled,
    autoSaveInterval,
    onToggleAutoSave,
    onIntervalChange,
    lastAutoSaveTime,
    onManualSave,
    onManualLoad,
    onAutoLoad,
    onExportSave,
    onImportSave,
    autoSaveAvailable,
    isSaving,
    onClose,
    timeSettings,
    onTimeSettingsChange,
}) => {
    const { enabled: soundEnabled, volume, toggleSound, setVolume, playSound, SOUND_TYPES } = useSound();
    const fileInputRef = useRef(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [backupMessage, setBackupMessage] = useState('');
    const [backupError, setBackupError] = useState('');
    const approvalSettings = timeSettings?.approval || {};
    const stabilitySettings = timeSettings?.stability || {};
    const approvalDuration = Math.max(5, approvalSettings.duration || 30);
    const stabilityDuration = Math.max(5, stabilitySettings.duration || 30);
    const approvalDecay = Math.max(0, Math.min(0.95, approvalSettings.decayRate ?? 0.04));
    const stabilityDecay = Math.max(0, Math.min(0.95, stabilitySettings.decayRate ?? 0.04));

    const updateTimeSetting = (type, key, value) => {
        if (typeof onTimeSettingsChange !== 'function') return;
        onTimeSettingsChange(prev => {
            const next = {
                approval: { duration: approvalDuration, decayRate: approvalDecay },
                stability: { duration: stabilityDuration, decayRate: stabilityDecay },
                ...(prev || {}),
            };
            next[type] = {
                duration: next[type]?.duration ?? (type === 'approval' ? approvalDuration : stabilityDuration),
                decayRate: next[type]?.decayRate ?? (type === 'approval' ? approvalDecay : stabilityDecay),
                ...next[type],
                [key]: value,
            };
            return next;
        });
    };
    // 格式化上次自动存档时间
    const renderLastAutoSave = () => {
        if (!lastAutoSaveTime) return '尚未自动存档';
        try {
            return new Date(lastAutoSaveTime).toLocaleTimeString();
        } catch {
            return '时间未知';
        }
    };

    const handleExport = async () => {
        if (typeof onExportSave !== 'function') return;
        setBackupError('');
        setBackupMessage('');
        setIsExporting(true);
        try {
            await onExportSave();
            setBackupMessage('已导出存档，可复制到其他设备。');
            playSound(SOUND_TYPES.SUCCESS);
        } catch (error) {
            setBackupError(error?.message || '导出失败，请稍后重试。');
            console.error('Export save failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportFile = async (event) => {
        if (!event?.target?.files?.length || typeof onImportSave !== 'function') return;
        const [file] = event.target.files;
        event.target.value = '';
        setBackupError('');
        setBackupMessage('');
        setIsImporting(true);
        try {
            await onImportSave(file);
            setBackupMessage(`已导入存档：${file.name}`);
            playSound(SOUND_TYPES.SUCCESS);
        } catch (error) {
            setBackupError(error?.message || '导入失败，请确认文件有效。');
            console.error('Import save failed:', error);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-4 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <Icon name="Sliders" size={16} /> 设置
                </h3>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <div className="flex items-center gap-1 text-emerald-300 text-[11px]">
                            <Icon name="Activity" size={12} className="animate-spin" />
                            <span>保存中</span>
                        </div>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                            title="关闭设置"
                        >
                            <Icon name="X" size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>自动存档</span>
                    <span className={isAutoSaveEnabled ? 'text-emerald-300' : 'text-gray-500'}>
                        {isAutoSaveEnabled ? '已启用' : '已暂停'}
                    </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isAutoSaveEnabled}
                        onChange={(e) => onToggleAutoSave(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                    <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${isAutoSaveEnabled ? 'translate-x-5' : ''}`} />
                </label>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
                <div className="flex items-center justify-between">
                    <span>自动存档间隔</span>
                    <span>{autoSaveInterval} 秒</span>
                </div>
                <input
                    type="range"
                    min={60}
                    max={300}
                    step={15}
                    value={autoSaveInterval}
                    onChange={(e) => onIntervalChange(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-gray-400">最短 60 秒，最长 5 分钟。</p>
            </div>

            <div className="text-[11px] text-gray-400 flex items-center gap-2">
                <Icon name="Clock" size={12} className="text-gray-500" />
                <span>上次自动存档：{renderLastAutoSave()}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                    type="button"
                    onClick={onManualSave}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-500/30 text-emerald-200 transition-colors"
                >
                    <Icon name="Save" size={14} />
                    手动存档
                </button>
                <button
                    type="button"
                    onClick={onManualLoad}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-purple-700/30 hover:bg-purple-700/50 border border-purple-500/30 text-purple-200 transition-colors"
                >
                    <Icon name="Download" size={14} />
                    读手动档
                </button>
                <button
                    type="button"
                    onClick={onAutoLoad}
                    disabled={!autoSaveAvailable}
                    className={`col-span-2 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-colors ${autoSaveAvailable
                        ? 'bg-amber-700/30 hover:bg-amber-700/50 border-amber-500/30 text-amber-200'
                        : 'bg-gray-700/40 border-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                    title={autoSaveAvailable ? '读取最近的自动存档' : '暂无自动存档'}
                >
                    <Icon name="Clock" size={14} />
                    读自动档
                </button>
            </div>

            <div className="text-[11px] text-gray-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${autoSaveAvailable ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                {autoSaveAvailable ? '检测到自动存档，可随时读取。' : '尚未生成自动存档。'}
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <Icon name="HardDrive" size={16} /> 跨设备备份
                </h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    导出二进制存档文件（.cgsave）即可复制到其他设备；在此导入可立即恢复进度。
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={!onExportSave || isExporting}
                        className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-colors ${isExporting
                            ? 'bg-blue-900/30 border-blue-700/40 text-blue-200 cursor-wait'
                            : 'bg-blue-700/20 hover:bg-blue-700/40 border-blue-500/30 text-blue-100'
                            } ${!onExportSave ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        {isExporting ? (
                            <Icon name="Activity" size={14} className="animate-spin" />
                        ) : (
                            <Icon name="UploadCloud" size={14} />
                        )}
                        导出存档
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!onImportSave || isImporting}
                        className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-colors ${isImporting
                            ? 'bg-purple-900/30 border-purple-700/40 text-purple-200 cursor-wait'
                            : 'bg-purple-700/20 hover:bg-purple-700/40 border-purple-500/30 text-purple-100'
                            } ${!onImportSave ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        {isImporting ? (
                            <Icon name="Activity" size={14} className="animate-spin" />
                        ) : (
                            <Icon name="DownloadCloud" size={14} />
                        )}
                        导入存档
                    </button>
                </div>
                {(backupMessage || backupError) && (
                    <div className={`text-[11px] ${backupError ? 'text-red-300' : 'text-emerald-300'}`}>
                        {backupError || backupMessage}
                    </div>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".cgsave,.bin,.dat,application/octet-stream"
                    onChange={handleImportFile}
                />
            </div>

            {/* <div className="border-t border-gray-700 pt-4 space-y-4">
        <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <Icon name="Clock" size={16} /> 时间设置
        </h4>
        <p className="text-[11px] text-gray-400">
          调整事件奖励的持续时间与消退速度，确保阶层好感度与稳定度不会在一个 Tick 内立即归零。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-300">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>阶层好感持续</span>
              <span>{approvalDuration} 天</span>
            </div>
            <input
              type="range"
              min={5}
              max={180}
              value={approvalDuration}
              onChange={(e) => updateTimeSetting('approval', 'duration', Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex items-center justify-between">
              <span>消退速度</span>
              <span>{Math.round(approvalDecay * 100)}% / 天</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={Math.round(approvalDecay * 100)}
              onChange={(e) => updateTimeSetting('approval', 'decayRate', Number(e.target.value) / 100)}
              className="w-full accent-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>稳定度持续</span>
              <span>{stabilityDuration} 天</span>
            </div>
            <input
              type="range"
              min={5}
              max={180}
              value={stabilityDuration}
              onChange={(e) => updateTimeSetting('stability', 'duration', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex items-center justify-between">
              <span>消退速度</span>
              <span>{Math.round(stabilityDecay * 100)}% / 天</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={Math.round(stabilityDecay * 100)}
              onChange={(e) => updateTimeSetting('stability', 'decayRate', Number(e.target.value) / 100)}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      </div> */}

            {/* 音效设置 */}
            <div className="border-t border-gray-700 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <Icon name="Volume2" size={16} /> 音效设置
                </h4>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                        <span>游戏音效</span>
                        <span className={soundEnabled ? 'text-emerald-300' : 'text-gray-500'}>
                            {soundEnabled ? '已启用' : '已关闭'}
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={soundEnabled}
                            onChange={() => {
                                toggleSound();
                                // 播放测试音效
                                if (!soundEnabled) {
                                    setTimeout(() => playSound(SOUND_TYPES.SUCCESS), 100);
                                }
                            }}
                        />
                        <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                        <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : ''}`} />
                    </label>
                </div>

                {soundEnabled && (
                    <div className="space-y-2 text-xs text-gray-300">
                        <div className="flex items-center justify-between">
                            <span>音效音量</span>
                            <span>{Math.round(volume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={volume * 100}
                            onChange={(e) => setVolume(Number(e.target.value) / 100)}
                            className="w-full accent-emerald-500"
                        />
                    </div>
                )}

                {soundEnabled && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => playSound(SOUND_TYPES.CLICK)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                        >
                            点击
                        </button>
                        <button
                            type="button"
                            onClick={() => playSound(SOUND_TYPES.SUCCESS)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                        >
                            成功
                        </button>
                        <button
                            type="button"
                            onClick={() => playSound(SOUND_TYPES.BUILD)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                        >
                            建造
                        </button>
                        <button
                            type="button"
                            onClick={() => playSound(SOUND_TYPES.BATTLE)}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                        >
                            战斗
                        </button>
                    </div>
                )}
            </div>

            {/* 关于与法律 */}
            <div className="border-t border-gray-700 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <Icon name="Info" size={16} /> 关于
                </h4>
                <a
                    href="./privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600 text-gray-300 transition-colors"
                >
                    <span className="flex items-center gap-2 text-sm">
                        <Icon name="Shield" size={14} />
                        隐私政策
                    </span>
                    <Icon name="ExternalLink" size={14} className="text-gray-500" />
                </a>
            </div>
        </div>
    );
};
