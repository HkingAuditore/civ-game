import { createRoot } from 'react-dom/client';
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isDebugEnabled } from './utils/debugFlags';
import { installCrashReporter, getPendingCrashLog, getAbnormalExit, clearPendingCrashLog } from './utils/crashReporter';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

// ── 第一步：安装崩溃上报（在一切之前） ──
installCrashReporter();

// 检查上次会话是否异常退出（OOM / 强杀等无法捕获的崩溃）
const previousCrash = getPendingCrashLog();
const abnormalExit = getAbnormalExit();
if (previousCrash || abnormalExit) {
    // 暂存到 window 上，等 analytics 初始化后上报
    window.__CIV_PENDING_CRASH__ = previousCrash;
    window.__CIV_ABNORMAL_EXIT__ = abnormalExit;
    clearPendingCrashLog();
}

const muteConsoleNoise = () => {
    if (isDebugEnabled('console')) return;
    const noop = () => {};
    // 保留 console.error，确保崩溃信息不丢
    console.log = noop;
    console.warn = noop;
};

muteConsoleNoise();

// 禁用 Performance.measure 以避免大对象克隆导致的内存溢出
// React DevTools 在开发模式下会尝试使用 performance.measure 记录组件渲染
// 当游戏状态过大时会导致 DataCloneError
if (typeof Performance !== 'undefined' && Performance.prototype.measure) {
    const originalMeasure = Performance.prototype.measure;
    Performance.prototype.measure = function(...args) {
        try {
            return originalMeasure.apply(this, args);
        } catch (error) {
            if (error.name === 'DataCloneError') {
                return undefined;
            }
            throw error;
        }
    };
}

// 在原生平台上隐藏状态栏
if (Capacitor.isNativePlatform()) {
    StatusBar.hide().catch(err => console.log('StatusBar hide error:', err));
}

const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>错误：找不到根元素</h1><p>请检查 index.html 文件</p></div>';
} else {
    try {
        createRoot(rootElement).render(
            <AppErrorBoundary>
                <App />
            </AppErrorBoundary>
        );
    } catch (error) {
        console.error('Failed to render app:', error);
        rootElement.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>渲染错误</h1><p>' + error.message + '</p></div>';
    }
}
