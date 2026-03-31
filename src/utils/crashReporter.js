// 崩溃持久化与上报模块
// 设计原则：不依赖任何第三方 SDK，在 React 挂载之前即可工作
// 崩溃信息写入 localStorage，下次启动时读取并上报

const CRASH_LOG_KEY = 'civ_crash_log';
const CRASH_HISTORY_KEY = 'civ_crash_history';
const MAX_HISTORY = 20;
const MAX_STACK_LEN = 2048;
const SESSION_ALIVE_KEY = 'civ_session_alive';
const MEMORY_SAMPLE_KEY = 'civ_last_memory_mb';

let _reportCallback = null;
let _memoryPollTimer = null;

// ── localStorage 安全读写 ──

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded or private mode */ }
}
function safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── 崩溃记录结构 ──

function buildCrashRecord(type, message, extra = {}) {
    return {
        type,
        message: (message || 'unknown').slice(0, 1024),
        stack: (extra.stack || '').slice(0, MAX_STACK_LEN),
        componentStack: (extra.componentStack || '').slice(0, MAX_STACK_LEN),
        url: typeof location !== 'undefined' ? location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: Date.now(),
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
        memoryMB: extra.memoryMB || getLastMemorySample(),
        sessionDuration: getSessionDuration(),
        ...extra.custom,
    };
}

// ── 持久化崩溃日志 ──

function persistCrash(record) {
    safeSetItem(CRASH_LOG_KEY, JSON.stringify(record));
    appendToHistory(record);
}

function appendToHistory(record) {
    try {
        const raw = safeGetItem(CRASH_HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        history.push(record);
        while (history.length > MAX_HISTORY) history.shift();
        safeSetItem(CRASH_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
}

// ── 会话存活标记（用于检测非正常退出） ──

let _sessionStart = Date.now();

function markSessionAlive() {
    safeSetItem(SESSION_ALIVE_KEY, String(Date.now()));
}

function clearSessionAlive() {
    safeRemoveItem(SESSION_ALIVE_KEY);
}

function getSessionDuration() {
    return Date.now() - _sessionStart;
}

function checkPreviousSessionCrash() {
    const aliveTs = safeGetItem(SESSION_ALIVE_KEY);
    if (!aliveTs) return null;
    return {
        type: 'session_not_closed',
        lastAliveAt: Number(aliveTs),
        possibleOOM: true,
    };
}

// ── 内存监控 ──

function getLastMemorySample() {
    const raw = safeGetItem(MEMORY_SAMPLE_KEY);
    return raw ? Number(raw) : null;
}

function startMemoryMonitor(intervalMs = 10000) {
    if (_memoryPollTimer) return;
    if (typeof performance === 'undefined') return;

    // performance.memory 是 Chrome 非标准 API
    if (performance.memory) {
        _memoryPollTimer = setInterval(() => {
            try {
                const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
                safeSetItem(MEMORY_SAMPLE_KEY, String(mb));
            } catch { /* ignore */ }
        }, intervalMs);
    }
}

function stopMemoryMonitor() {
    if (_memoryPollTimer) {
        clearInterval(_memoryPollTimer);
        _memoryPollTimer = null;
    }
}

// ── 全局错误处理（在 React 之前安装） ──

function handleGlobalError(event) {
    const record = buildCrashRecord('uncaught_error', event.message, {
        stack: event.error?.stack || '',
        custom: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        },
    });
    persistCrash(record);
    tryReport(record);
}

function handleUnhandledRejection(event) {
    const reason = event.reason;
    const message = reason?.message || String(reason || 'unknown');
    const record = buildCrashRecord('unhandled_rejection', message, {
        stack: reason?.stack || '',
    });
    persistCrash(record);
    tryReport(record);
}

// React ErrorBoundary 专用入口
export function reportReactCrash(error, errorInfo) {
    const record = buildCrashRecord('react_render_error', error?.message || 'React render crash', {
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
    });
    persistCrash(record);
    tryReport(record);
    return record;
}

// ── 上报回调 ──

function tryReport(record) {
    if (typeof _reportCallback === 'function') {
        try { _reportCallback(record); } catch { /* 上报本身不能再抛异常 */ }
    }
}

// ── 公开 API ──

export function installCrashReporter() {
    _sessionStart = Date.now();

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    startMemoryMonitor();
    markSessionAlive();

    // 定期刷新存活标记
    setInterval(markSessionAlive, 5000);

    // 页面正常关闭时清除存活标记
    window.addEventListener('pagehide', () => {
        stopMemoryMonitor();
        clearSessionAlive();
    });
    window.addEventListener('beforeunload', () => {
        clearSessionAlive();
    });
}

export function setReportCallback(fn) {
    _reportCallback = typeof fn === 'function' ? fn : null;
}

export function getPendingCrashLog() {
    const raw = safeGetItem(CRASH_LOG_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export function getAbnormalExit() {
    return checkPreviousSessionCrash();
}

export function clearPendingCrashLog() {
    safeRemoveItem(CRASH_LOG_KEY);
}

export function getCrashHistory() {
    try {
        const raw = safeGetItem(CRASH_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function clearCrashHistory() {
    safeRemoveItem(CRASH_HISTORY_KEY);
}

export function getLastMemoryMB() {
    return getLastMemorySample();
}
