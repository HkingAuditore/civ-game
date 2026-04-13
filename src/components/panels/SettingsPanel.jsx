// 设置面板组件
// 控制自动存档、读档方式及跨设备备份

import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Icon } from '../common/UIComponents';
import { useSound, useDevicePerformance, PERFORMANCE_MODES } from '../../hooks';
import { DIFFICULTY_LEVELS, getDifficultyOptions } from '../../config/difficulty';
import { setAnalyticsConsent, getAnalyticsConsent } from '../../analytics/gaInit';

// localStorage key for OTA update toggle (must match useOtaUpdate.js)
const OTA_UPDATE_ENABLED_KEY = 'civ_ota_update_enabled';


/**
 * 性能模式设置组件
 * 允许用户手动切换性能模式以优化低端设备体验
 */
const PerformanceModeSection = () => {
    const { isLowPerformanceMode, performanceMode, setPerformanceMode } = useDevicePerformance();

    const modeOptions = [
        { value: PERFORMANCE_MODES.AUTO, label: '自动', desc: '手机流畅/电脑自动' },
        { value: PERFORMANCE_MODES.HIGH, label: '高品质', desc: '全部特效' },
        { value: PERFORMANCE_MODES.LOW, label: '流畅', desc: '禁用特效' },
    ];

    return (
            <div className="border-t border-gray-700 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="Zap" size={14} /> 性能模式
                </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
                手机默认使用流畅模式，如需高画质请手动切换。
            </p>

            <div className="flex gap-2">
                {modeOptions.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPerformanceMode(opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-colors ${performanceMode === opt.value
                            ? 'bg-emerald-700/40 border-emerald-500/50 text-emerald-200'
                            : 'bg-gray-700/30 border-gray-600/50 text-gray-300 hover:bg-gray-700/50'
                            }`}
                    >
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                    </button>
                ))}
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLowPerformanceMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                当前状态：{isLowPerformanceMode ? '流畅模式（特效已禁用）' : '高品质模式'}
            </div>

            {/* Mobile performance tips */}
            <div className="mt-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-amber-400 font-medium">📱 移动端默认流畅模式</span>
                    <br />
                    • 减少发热和耗电，体验更稳定
                    <br />
                    • 如需高画质，请选择"高品质"
                    <br />
                    • 横屏模式下界面显示更完整
                </p>
            </div>
        </div>
    );
};

/**
 * Difficulty Setting Section
 * Allows player to choose game difficulty
 */
/**
 * Difficulty Setting Section (Read Only)
 * Allows player to view game difficulty
 */
const DifficultySectionComponent = ({ currentDifficulty }) => {
    const difficultyOptions = getDifficultyOptions();
    const currentConfig = difficultyOptions.find(o => o.id === currentDifficulty) || {};

    return (
            <div className="border-t border-gray-700 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="Target" size={14} /> 游戏难度
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 flex items-center gap-1">
                    <Icon name="Lock" size={10} /> 游戏中不可更改
                </span>
            </h4>

                <div className={`p-3 rounded-lg border-2 overflow-hidden relative ${currentDifficulty === 'very_easy' || currentDifficulty === 'easy' ? 'bg-emerald-900/20 border-emerald-500/30' :
                currentDifficulty === 'normal' ? 'bg-amber-900/20 border-amber-500/30' :
                    'bg-red-900/20 border-red-500/30'
                }`}>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="text-3xl filter drop-shadow-lg">
                            {currentConfig.icon || '⚖️'}
                        </div>
                        <div>
                            <div className={`text-sm font-bold flex items-center gap-2 ${currentDifficulty === 'very_easy' || currentDifficulty === 'easy' ? 'text-emerald-300' :
                            currentDifficulty === 'normal' ? 'text-amber-300' :
                                'text-red-300'
                            }`}>
                            {currentConfig.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                            {currentConfig.description}
                        </div>
                    </div>
                </div>

                {/* Background Pattern */}
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-5 pointer-events-none select-none">
                    {currentConfig.icon}
                </div>
            </div>

            <p className="text-xs text-gray-500 text-center">
                如需更改难度，请回到主菜单开始新游戏
            </p>
        </div>
    );
};

const AnalyticsToggleSection = () => {
    const [enabled, setEnabled] = useState(() => getAnalyticsConsent());

    const handleToggle = () => {
        const next = !enabled;
        setEnabled(next);
        setAnalyticsConsent(next);
    };

    return (
        <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Icon name="BarChart3" size={14} /> 数据分析
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
                匿名游戏数据帮助我们改善游戏体验，不收集任何个人信息。
            </p>
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">允许发送匿名游戏数据</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enabled}
                        onChange={handleToggle}
                    />
                    <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                    <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </label>
            </div>
        </div>
    );
};

/**
 * OTA 联网更新开关组件
 * Only rendered on native APP (Android/iOS). Hidden on web.
 */
const OtaUpdateSection = () => {
    // Default disabled — user must explicitly enable
    const [enabled, setEnabled] = useState(() => {
        try { return localStorage.getItem(OTA_UPDATE_ENABLED_KEY) === 'true'; } catch { return false; }
    });

    // Only show on native platform
    if (!Capacitor.isNativePlatform()) return null;

    const handleToggle = () => {
        const next = !enabled;
        setEnabled(next);
        try { localStorage.setItem(OTA_UPDATE_ENABLED_KEY, next ? 'true' : 'false'); } catch { /* ignore */ }
    };

    return (
        <div className="border-t border-gray-700 pt-3 space-y-2">
            <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Icon name="RefreshCw" size={14} /> 自动更新
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
                开启后，APP 启动时将自动检查并下载热更新。默认关闭。
            </p>
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">自动检查更新</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enabled}
                        onChange={handleToggle}
                    />
                    <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                    <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </label>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                {enabled ? '已开启，下次启动时检查更新' : '已关闭，不会自动下载更新'}
            </div>
        </div>
    );
};

export const SettingsPanel = ({
    isAutoSaveEnabled,
    autoSaveInterval,
    onToggleAutoSave,
    onIntervalChange,
    lastAutoSaveTime,
    onExportSave,
    onImportSave,
    isSaving,
    onClose,
    timeSettings,
    onTimeSettingsChange,
    difficulty,
    onDifficultyChange,
    eventConfirmationEnabled,
    onToggleEventConfirmation,
    showMusicPlayer,
    onToggleMusicPlayer,
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
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg p-3 space-y-3 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <Icon name="Sliders" size={16} /> 设置
                </h3>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <div className="flex items-center gap-1 text-emerald-300 text-xs">
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
                <p className="text-xs text-gray-400">最短 60 秒，最长 5 分钟。</p>
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-2">
                <Icon name="Clock" size={12} className="text-gray-500" />
                <span>上次自动存档：{renderLastAutoSave()}</span>
            </div>

            {/* 事件选择确认设置 */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>事件二次确认</span>
                    <span className={eventConfirmationEnabled ? 'text-emerald-300' : 'text-gray-500'}>
                        {eventConfirmationEnabled ? '已启用' : '已关闭'}
                    </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={eventConfirmationEnabled}
                        onChange={(e) => onToggleEventConfirmation && onToggleEventConfirmation(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                    <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${eventConfirmationEnabled ? 'translate-x-5' : ''}`} />
                </label>
                <p className="text-xs text-gray-400 leading-relaxed">
                    开启后，选择事件选项时需要再次点击确认按钮，防止误触。
                </p>
            </div>



            {/* 音乐播放器显示 */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>显示音乐播放器</span>
                    <span className={(showMusicPlayer ?? false) ? 'text-emerald-300' : 'text-gray-500'}>
                        {(showMusicPlayer ?? false) ? '已启用' : '已关闭'}
                    </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showMusicPlayer ?? false}
                        onChange={(e) => onToggleMusicPlayer && onToggleMusicPlayer(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                    <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${(showMusicPlayer ?? false) ? 'translate-x-5' : ''}`} />
                </label>
                <p className="text-xs text-gray-400 leading-relaxed">
                    默认关闭。开启后左下角会显示悬浮音乐播放器。
                </p>
            </div>



            <div className="border-t border-gray-700 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="HardDrive" size={14} /> 跨设备备份
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
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
                    <div className={`text-xs ${backupError ? 'text-red-300' : 'text-emerald-300'}`}>
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
        <p className="text-xs text-gray-400">
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

            {/* 游戏难度设置 */}
            <DifficultySectionComponent
                currentDifficulty={difficulty}
                onDifficultyChange={onDifficultyChange}
            />

            {/* 性能模式设置 */}
            <PerformanceModeSection />

            {/* 联网更新设置（暂时隐藏） */}
            {/* <OtaUpdateSection /> */}

            {/* Debug选项 */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="Code" size={14} /> Debug选项
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                    开发者调试选项，用于显示性能监控信息。
                </p>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                        <span>显示性能监控(PERF)</span>
                        <span className={
                            (typeof window !== 'undefined' && localStorage.getItem('debugPerfOverlay') === 'true')
                                ? 'text-emerald-300'
                                : 'text-gray-500'
                        }>
                            {(typeof window !== 'undefined' && localStorage.getItem('debugPerfOverlay') === 'true')
                                ? '已启用'
                                : '已关闭'}
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={typeof window !== 'undefined' && localStorage.getItem('debugPerfOverlay') === 'true'}
                            onChange={(e) => {
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('debugPerfOverlay', e.target.checked ? 'true' : 'false');
                                    // 触发自定义事件通知其他组件
                                    window.dispatchEvent(new Event('debugSettingsChanged'));
                                    // 强制重新渲染
                                    window.location.reload();
                                }
                            }}
                        />
                        <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-emerald-600 transition-colors" />
                        <div className={`absolute left-1 top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                            (typeof window !== 'undefined' && localStorage.getItem('debugPerfOverlay') === 'true')
                                ? 'translate-x-5'
                                : ''
                        }`} />
                    </label>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        开启后，右上角将显示游戏性能监控面板，包括帧时间、模拟时间等信息。
                    </p>
                </div>
            </div>

            {/* 音效设置 */}
            <div className="border-t border-gray-700 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="Volume2" size={14} /> 音效设置
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

            {/* 数据分析设置 */}
            <AnalyticsToggleSection />

            {/* 关于与法律 */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Icon name="Info" size={14} /> 关于
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
