/**
 * 音效Hook
 * 提供在React组件中使用音效的便捷方法
 */

import { useCallback, useEffect, useState } from 'react';
import { generateSound, SOUND_TYPES } from '../config/sounds';

/**
 * 音效管理Hook
 * @returns {Object} 音效控制方法和状态
 */
export function useSound() {
    const [enabled, setEnabled] = useState(true);
    const [volume, setVolume] = useState(0.5);

    // 从localStorage加载设置
    useEffect(() => {
        try {
            const settings = localStorage.getItem('sound_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                setEnabled(parsed.enabled !== false);
                setVolume(parsed.volume ?? 0.5);
            }
        } catch (e) {
            console.warn('Failed to load sound settings:', e);
        }
    }, []);

    // 监听localStorage变化，实时同步音效设置
    useEffect(() => {
        const handleStorageChange = (e) => {
            // 处理storage事件（跨标签页）
            if (e.key === 'sound_settings' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    setEnabled(parsed.enabled !== false);
                    setVolume(parsed.volume ?? 0.5);
                } catch (err) {
                    console.warn('Failed to parse sound settings from storage event:', err);
                }
            }
        };

        const handleCustomEvent = () => {
            // 处理同一页面内的设置变化
            try {
                const settings = localStorage.getItem('sound_settings');
                if (settings) {
                    const parsed = JSON.parse(settings);
                    setEnabled(parsed.enabled !== false);
                    setVolume(parsed.volume ?? 0.5);
                }
            } catch (err) {
                console.warn('Failed to reload sound settings:', err);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('soundSettingsChanged', handleCustomEvent);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('soundSettingsChanged', handleCustomEvent);
        };
    }, []);

    // 保存设置
    const saveSettings = useCallback((newEnabled, newVolume) => {
        try {
            localStorage.setItem('sound_settings', JSON.stringify({
                enabled: newEnabled,
                volume: newVolume,
            }));
            // 触发自定义事件，通知其他组件更新
            window.dispatchEvent(new Event('soundSettingsChanged'));
        } catch (e) {
            console.warn('Failed to save sound settings:', e);
        }
    }, []);

    /**
     * 播放音效
     */
    const playSound = useCallback((soundType) => {
        if (!enabled) return;

        try {
            const soundGenerator = generateSound(soundType);
            if (soundGenerator) {
                soundGenerator();
            }
        } catch (e) {
            console.warn(`Failed to play sound ${soundType}:`, e);
        }
    }, [enabled]);

    /**
     * 切换音效开关
     */
    const toggleSound = useCallback(() => {
        const newEnabled = !enabled;
        setEnabled(newEnabled);
        saveSettings(newEnabled, volume);
    }, [enabled, volume, saveSettings]);

    /**
     * 设置音量
     */
    const updateVolume = useCallback((newVolume) => {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        setVolume(clampedVolume);
        saveSettings(enabled, clampedVolume);
    }, [enabled, saveSettings]);

    return {
        enabled,
        volume,
        playSound,
        toggleSound,
        setVolume: updateVolume,
        SOUND_TYPES,
    };
}
