// 自建分析后端适配层
// 事件缓冲 → 批量 POST → 页面关闭时 sendBeacon 兜底

const API_URL = import.meta.env.VITE_ANALYTICS_API_URL;
const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY;

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_THRESHOLD = 200;
const USER_ID_KEY = 'civ_analytics_uid';

// ── 匿名用户 ID ──

function getOrCreateUserId() {
    if (typeof localStorage === 'undefined') return 'unknown';
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
        uid = crypto.randomUUID?.() || (`${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
}

// ── 会话 ID ──

const sessionId = crypto.randomUUID?.() || (`s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
let sessionStartTime = Date.now();

// ── 缓冲区 ──

const buffer = {
    design: [],
    resource: [],
    errors: [],
};

let flushTimer = null;
let heartbeatTimer = null;
let enabled = false;
let sessionEnded = false;
const sessionDimensions = {
    difficulty: null,
    scenario: null,
};

function normalizeDimensionValue(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 64) : null;
}

// ── 初始化 ──

// Named handlers for proper removal during HMR dispose
function _handleVisibilityChange() {
    if (document.visibilityState === 'hidden') flush();
}
function _handlePageHide() {
    endSession();
}
function _handleBeforeUnload() {
    endSession();
}

export function initCustomBackend({ difficulty = null, scenario = null } = {}) {
    if (!API_URL) {
        console.warn('[Analytics] No VITE_ANALYTICS_API_URL configured, custom backend disabled');
        return;
    }

    // Clean up old timers before re-init (HMR idempotency)
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

    console.log('[Analytics] Custom backend init →', API_URL);
    enabled = true;
    sessionEnded = false;
    sessionDimensions.difficulty = normalizeDimensionValue(difficulty);
    sessionDimensions.scenario = normalizeDimensionValue(scenario);

    const userId = getOrCreateUserId();

    sendJSON(`${API_URL}/api/session/start`, {
        userId,
        sessionId,
        appVersion: __APP_VERSION__,
        difficulty: sessionDimensions.difficulty,
        scenario: sessionDimensions.scenario,
        userAgent: navigator.userAgent,
    });

    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    heartbeatTimer = setInterval(() => {
        sendJSON(`${API_URL}/api/session/heartbeat`, {
            sessionId,
            difficulty: sessionDimensions.difficulty,
            scenario: sessionDimensions.scenario,
        });
    }, 120_000);

    window.addEventListener('visibilitychange', _handleVisibilityChange);
    window.addEventListener('pagehide', _handlePageHide);
    window.addEventListener('beforeunload', _handleBeforeUnload);
}

// ── 缓冲入口 ──

export function bufferDesignEvent(eventId, value, extra = {}) {
    if (!enabled) return;
    buffer.design.push({
        userId: getOrCreateUserId(),
        sessionId,
        eventId,
        value: value ?? null,
        epoch: extra.epoch || null,
        daysElapsed: extra.daysElapsed ?? null,
        playerNationId: extra.playerNationId || null,
        playerNationName: extra.playerNationName || null,
        timestamp: Date.now(),
    });
    if (buffer.design.length >= FLUSH_THRESHOLD) flush();
}

export function bufferResourceEvent(flowType, currency, amount, itemType, itemId) {
    if (!enabled) return;
    buffer.resource.push({
        userId: getOrCreateUserId(),
        sessionId,
        flowType,
        currency,
        amount: Math.round(amount),
        itemType: itemType || null,
        itemId: itemId || null,
        timestamp: Date.now(),
    });
    if (buffer.resource.length >= FLUSH_THRESHOLD) flush();
}

export function bufferErrorEvent(severity, message) {
    if (!enabled) return;
    buffer.errors.push({
        userId: getOrCreateUserId(),
        sessionId,
        severity,
        message: (message || '').slice(0, 1024),
        timestamp: Date.now(),
    });
    if (buffer.errors.length >= FLUSH_THRESHOLD) flush();
}

// ── 批量发送 ──

function flush() {
    const hasData = buffer.design.length > 0 || buffer.resource.length > 0 || buffer.errors.length > 0;
    if (!hasData) return;

    const payload = {
        design: buffer.design.splice(0),
        resource: buffer.resource.splice(0),
        errors: buffer.errors.splice(0),
    };

    sendJSON(`${API_URL}/api/events`, payload);
}

// ── 会话结束 ──

function endSession() {
    if (!enabled || sessionEnded) return;
    sessionEnded = true;

    flush();
    const durationMs = Date.now() - sessionStartTime;
    const payload = { sessionId, durationMs };
    const url = `${API_URL}/api/session/end${API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : ''}`;

    // 卸载阶段先尝试 keepalive fetch，保留自定义请求头；失败时仍有 beacon 兜底。
    sendJSON(`${API_URL}/api/session/end`, payload);

    if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' });
        navigator.sendBeacon(url, blob);
    }
}

// ── HTTP 工具 ──

function sendJSON(url, data) {
    try {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
            },
            body: JSON.stringify(data),
            keepalive: true,
        }).then(res => {
            if (!res.ok) console.warn('[Analytics] POST failed:', res.status, url);
        }).catch(err => {
            console.warn('[Analytics] Network error:', err.message, url);
        });
    } catch (e) {
        console.warn('[Analytics] Send error:', e.message);
    }
}

// ── 更新维度 ──

export function updateDimensions({ difficulty, scenario } = {}) {
    if (difficulty !== undefined) {
        sessionDimensions.difficulty = normalizeDimensionValue(difficulty);
    }
    if (scenario !== undefined) {
        sessionDimensions.scenario = normalizeDimensionValue(scenario);
    }

    if (!enabled || sessionEnded) return;

    // 维度变化后立即同步一次，避免仅依赖心跳造成延迟
    sendJSON(`${API_URL}/api/session/heartbeat`, {
        sessionId,
        difficulty: sessionDimensions.difficulty,
        scenario: sessionDimensions.scenario,
    });
}

// ── HMR dispose: clean up all module-level side effects ──

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        window.removeEventListener('visibilitychange', _handleVisibilityChange);
        window.removeEventListener('pagehide', _handlePageHide);
        window.removeEventListener('beforeunload', _handleBeforeUnload);
        enabled = false;
        sessionEnded = false;
    });
}
