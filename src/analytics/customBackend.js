// 自建分析后端适配层
// 事件缓冲 → 批量 POST → 页面关闭时 sendBeacon 兜底

const API_URL = import.meta.env.VITE_ANALYTICS_API_URL;
const API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY;

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 50;
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
let enabled = false;

// ── 初始化 ──

export function initCustomBackend() {
    if (!API_URL) return;
    enabled = true;

    const userId = getOrCreateUserId();

    sendJSON(`${API_URL}/api/session/start`, {
        userId,
        sessionId,
        appVersion: import.meta.env.VITE_APP_VERSION || '2.1.11',
        difficulty: null,
        scenario: null,
        userAgent: navigator.userAgent,
    });

    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    setInterval(() => {
        sendJSON(`${API_URL}/api/session/heartbeat`, { sessionId });
    }, 60_000);

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });

    window.addEventListener('pagehide', () => {
        endSession();
    });
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
    flush();
    const durationMs = Date.now() - sessionStartTime;
    const body = JSON.stringify({ sessionId, durationMs });

    if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(
            `${API_URL}/api/session/end${API_KEY ? `?key=${API_KEY}` : ''}`,
            blob
        );
    } else {
        sendJSON(`${API_URL}/api/session/end`, { sessionId, durationMs });
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
        }).catch(() => {});
    } catch {
        // 静默降级
    }
}

// ── 更新维度 ──

export function updateDimensions({ difficulty, scenario } = {}) {
    // 维度信息通过 session 更新，不额外发请求
    // 后续的 design event 会通过 extra.epoch 携带时代信息
    void difficulty;
    void scenario;
}
