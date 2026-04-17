/**
 * saveWorkerClient.js — 封装 save.worker 的主线程客户端，模块级单例。
 *
 * 职责：
 *   1) 懒启动：第一次调用 stringifyShardsInWorker 时才 new Worker()，避免应用启动开销。
 *   2) 串行 + 合并覆盖：同一时间 worker 只处理一个请求；如果 worker 还在忙，新的请求
 *      会替换掉队列里前一个"已入队但未开始"的请求，旧请求的 Promise 会以 superseded 拒绝。
 *      （useAutoSave 已经做过一层防重入，这一层是兜底保障。）
 *   3) 降级可观测：任何失败都会把 worker 标记为不可用，并触发 trackSaveWorkerFallback 埋点，
 *      saveGame 捕获后回退到主线程序列化路径。
 *
 * 不做压缩：PR-5 才引入 gzip，这里只负责 stringify。
 */

import { trackSaveWorkerFallback } from '../analytics/gaTracker';
// Vite 的 ?worker import：打包时会把 save.worker.js 作为独立 chunk 输出，
// 并在运行时给出一个自带路径的构造器；与项目里 simulation.worker 用法保持一致
import SaveWorkerCtor from '../workers/save.worker.js?worker';

const SUPERSEDED = 'superseded';

let workerInstance = null;
let workerUnavailable = false;
let workerDisabled = false;
let requestCounter = 0;
let inflight = null;      // { id, resolve, reject, shards, postedAt }
let queued = null;        // { id, resolve, reject, shards }

// Runtime 开关：设置 window.__CIV_DISABLE_SAVE_WORKER__ = true 可强制回退主线程路径
const isDisabledRuntime = () => {
    if (workerDisabled) return true;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.__CIV_DISABLE_SAVE_WORKER__) {
            workerDisabled = true;
            return true;
        }
    } catch { /* noop */ }
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('civ_save_worker_disabled') === '1') {
            workerDisabled = true;
            return true;
        }
    } catch { /* noop */ }
    return false;
};

const reportFallback = (reason) => {
    try { trackSaveWorkerFallback(reason); } catch { /* noop */ }
};

const handleWorkerMessage = (event) => {
    const msg = event?.data;
    if (!msg || typeof msg.id !== 'number') return;
    const current = inflight;
    if (!current || current.id !== msg.id) {
        // 消息和当前请求不匹配（极端情况下 worker 重启后可能出现），忽略即可
        return;
    }
    inflight = null;
    if (msg.error) {
        current.reject({ kind: 'worker-error', message: msg.error });
    } else {
        current.resolve({
            jsons: msg.jsons,
            sizes: msg.sizes,
            compressedBlobs: msg.compressedBlobs,
            compressedSizes: msg.compressedSizes,
            compressionUsed: !!msg.compressionUsed,
        });
    }
    drainQueued();
};

const handleWorkerError = (event) => {
    const message = event?.message || 'worker-runtime-error';
    console.warn('[saveWorker] worker error:', message);
    workerUnavailable = true;
    reportFallback('runtime');
    // 通知等待中的请求
    if (inflight) {
        const req = inflight; inflight = null;
        req.reject({ kind: 'worker-error', message });
    }
    if (queued) {
        const req = queued; queued = null;
        req.reject({ kind: 'worker-error', message });
    }
    try { workerInstance && workerInstance.terminate(); } catch { /* noop */ }
    workerInstance = null;
};

const ensureWorker = () => {
    if (workerInstance) return workerInstance;
    if (workerUnavailable) return null;
    if (isDisabledRuntime()) return null;
    if (typeof Worker === 'undefined') {
        workerUnavailable = true;
        reportFallback('no-worker-api');
        return null;
    }
    try {
        // SaveWorkerCtor 是 Vite ?worker 语法生成的 Worker 构造器（无需自己拼 URL）
        workerInstance = new SaveWorkerCtor({ name: 'civ-save-worker' });
        workerInstance.onmessage = handleWorkerMessage;
        workerInstance.onerror = handleWorkerError;
        workerInstance.onmessageerror = (e) => {
            console.warn('[saveWorker] messageerror:', e);
            handleWorkerError({ message: 'messageerror' });
        };
        return workerInstance;
    } catch (error) {
        console.warn('[saveWorker] failed to instantiate:', error);
        workerUnavailable = true;
        reportFallback('instantiate');
        return null;
    }
};

const postRequest = (req) => {
    const w = ensureWorker();
    if (!w) {
        req.reject({ kind: 'no-worker' });
        return;
    }
    inflight = req;
    req.postedAt = performance.now ? performance.now() : Date.now();
    try {
        // postMessage 会自动 structuredClone shards；对于纯数据树这一步只做浅层 transferable copy，
        // 比主线程 JSON.stringify 快得多
        w.postMessage({
            id: req.id,
            action: 'stringify',
            shards: req.shards,
            compress: !!req.compress,
        });
    } catch (error) {
        inflight = null;
        console.warn('[saveWorker] postMessage failed:', error);
        workerUnavailable = true;
        reportFallback('postmessage');
        req.reject({ kind: 'postmessage-failed', error });
    }
};

const drainQueued = () => {
    if (!queued) return;
    const next = queued; queued = null;
    postRequest(next);
};

/**
 * 把 shards 交给 worker 做 JSON.stringify（PR-5 起支持可选 gzip 压缩）。
 * @param {{ state?: object, nations?: any, history?: object, market?: object, social?: object }} shards
 * @param {{ compress?: boolean }} [options] compress=true 时 worker 会尝试用 CompressionStream('gzip') 压缩
 * @returns {Promise<{
 *   jsons: Record<string, string>,
 *   sizes: Record<string, number>,
 *   compressedBlobs?: Record<string, Uint8Array>,
 *   compressedSizes?: Record<string, number>,
 *   compressionUsed: boolean
 * }>}
 *          失败会 reject 一个 { kind: 'no-worker' | 'superseded' | 'worker-error' | 'postmessage-failed', ... } 对象
 */
export const stringifyShardsInWorker = (shards, options) => new Promise((resolve, reject) => {
    const w = ensureWorker();
    if (!w) {
        reject({ kind: 'no-worker' });
        return;
    }
    const id = ++requestCounter;
    const req = { id, resolve, reject, shards, compress: !!(options && options.compress) };
    if (inflight) {
        // 合并覆盖：queued 里的旧请求立即 reject("superseded")，由 saveGame 作无害化处理
        if (queued) {
            const victim = queued; queued = null;
            victim.reject({ kind: SUPERSEDED });
        }
        queued = req;
        return;
    }
    postRequest(req);
});

export const SAVE_WORKER_ERROR_KINDS = Object.freeze({
    NO_WORKER: 'no-worker',
    SUPERSEDED: 'superseded',
    WORKER_ERROR: 'worker-error',
    POSTMESSAGE_FAILED: 'postmessage-failed',
});

export const terminateSaveWorker = () => {
    if (workerInstance) {
        try { workerInstance.terminate(); } catch { /* noop */ }
        workerInstance = null;
    }
    workerUnavailable = false;
    workerDisabled = false;
    inflight = null;
    queued = null;
};

export const isSaveWorkerReady = () => !!workerInstance && !workerUnavailable && !isDisabledRuntime();

// ── [PR-5] gzip 压缩开关 ──
// 默认关闭，仅在灰度/运营指令下启用。读取端永远能识别压缩存档，不受此开关影响。
// 启用方式（任一即可）：
//   window.__CIV_ENABLE_SAVE_GZIP__ = true
//   localStorage.setItem('civ_save_gzip_enabled', '1')
export const isSaveCompressionEnabled = () => {
    if (typeof CompressionStream === 'undefined') return false;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.__CIV_ENABLE_SAVE_GZIP__) return true;
    } catch { /* noop */ }
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('civ_save_gzip_enabled') === '1') return true;
    } catch { /* noop */ }
    return false;
};
