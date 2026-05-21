import { createRoot } from 'react-dom/client';
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isDebugEnabled } from './utils/debugFlags';
import { installCrashReporter, getPendingCrashLog, getAbnormalExit, clearPendingCrashLog } from './utils/crashReporter';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

// ── 第一步：安装崩溃上报（在一切之前） ──
// installCrashReporter already has its own idempotent guard
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
    // Idempotent guard: only mute once across HMR reloads
    if (window.__CONSOLE_MUTED__) return;
    if (isDebugEnabled('console')) return;
    window.__CONSOLE_MUTED__ = true;
    const noop = () => {};
    // 保留 console.error 和 console.assert，确保崩溃信息不丢
    // 静默所有其他 console 方法，避免浏览器控制台持有对象引用导致内存泄漏
    const methodsToMute = [
        'log', 'warn', 'info', 'debug',
        'group', 'groupEnd', 'groupCollapsed',
        'table', 'dir', 'dirxml', 'trace', 'clear',
        'time', 'timeEnd', 'timeLog',
        'count', 'countReset',
        'profile', 'profileEnd',
    ];
    methodsToMute.forEach(method => {
        if (typeof console[method] === 'function') {
            console[method] = noop;
        }
    });
};

muteConsoleNoise();

// 禁用 Performance.measure/mark 以避免对象堆积导致内存泄漏
// 堆快照显示 89,040 个 PerformanceMeasure + 150,940 个 StackFrameInfo 驻留内存
// React DevTools 和 simulation.js 的 perf timing 是主要创建源
if (typeof Performance !== 'undefined' && !window.__PERF_PATCHED__) {
    window.__PERF_PATCHED__ = true;
    // 当 __PERF_USER_TIMING 显式开启时保留原始行为（用于性能调试）
    if (!(typeof window !== 'undefined' && window.__PERF_USER_TIMING === true)) {
        const noopMeasure = () => undefined;
        const noopMark = () => undefined;
        if (Performance.prototype.measure) {
            Performance.prototype.measure = noopMeasure;
        }
        if (Performance.prototype.mark) {
            Performance.prototype.mark = noopMark;
        }
    } else if (Performance.prototype.measure) {
        // 即使开启了 user timing，也要防止 DataCloneError
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
}

// 在原生平台上隐藏状态栏
if (Capacitor.isNativePlatform()) {
    StatusBar.hide().catch(err => console.log('StatusBar hide error:', err));
}

// ── React root: cache for HMR reuse ──
let _root = null;

const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>错误：找不到根元素</h1><p>请检查 index.html 文件</p></div>';
} else {
    try {
        // Reuse existing root on HMR; only create once
        if (!_root) {
            _root = createRoot(rootElement);
        }
        _root.render(
            <AppErrorBoundary>
                <App />
            </AppErrorBoundary>
        );
    } catch (error) {
        console.error('Failed to render app:', error);
        rootElement.innerHTML = '<div style="color: white; background: #1a1a1a; padding: 20px; font-family: sans-serif;"><h1>渲染错误</h1><p>' + error.message + '</p></div>';
    }
}

// ── HMR: let React Fast Refresh handle component updates ──
if (import.meta.hot) {
    import.meta.hot.accept();
}
