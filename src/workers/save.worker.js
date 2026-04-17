/* eslint-env worker */
/**
 * save.worker.js — 专门承担存档 JSON 序列化（可选 + gzip 压缩）的 Web Worker。
 *
 * 设计目标：
 *   1) 把 saveGame 里最重的一步（对 nations/state/... 做 JSON.stringify）搬离主线程，
 *      让主线程在自动存档窗口里只需要把 shards 做一次 structuredClone + postMessage，
 *      随后即可继续处理渲染/渲染帧/worker tick 消费，不再被 1–3MB 的序列化吞掉 100–400ms。
 *   2) [PR-5] 可选 gzip 压缩：如果主线程传来 compress: true 且运行环境支持 CompressionStream，
 *      每片 JSON 会被压缩为 Uint8Array（实测约 10–20% 的原始体积），显著降低 IDB 写盘量。
 *      Uint8Array 通过 Transferable 回传，不产生额外拷贝。
 *   3) 纯计算型 worker：不访问 localStorage / IDB / DOM / analytics，便于在所有平台稳定启动。
 *   4) 单向请求-响应协议，每条消息自带一个数字 id，主线程据此匹配回包。
 *
 * 协议：
 *   主线程 → worker:
 *     { id: number, action: 'stringify', shards: { state, nations, history, market, social },
 *       compress?: boolean }
 *   worker → 主线程：
 *     成功：{ id, jsons: { [shard]: string }, sizes: { [shard]: number },
 *             compressedBlobs?: { [shard]: Uint8Array },
 *             compressedSizes?: { [shard]: number },
 *             compressionUsed: boolean }
 *     失败：{ id, error: string }
 *
 * 关于 sizes：
 *   这里算的是"字节近似值"，和 useGameState.js 的 sizeDescFromString 保持一致（length * 1.02），
 *   用于 stub.sizeBytes / 埋点上报；既避免主线程再做一次 .length，也不牵扯 Blob / TextEncoder。
 *   compressedSizes 是真正的压缩字节数（Uint8Array.byteLength），用于观测 gzip 收益。
 */

const supportsCompression = typeof CompressionStream !== 'undefined';

const encoder = supportsCompression && typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/**
 * 用 CompressionStream('gzip') 把 JSON 字符串压缩为 Uint8Array。
 * 出错时返回 null，上层回退到未压缩字符串。
 */
async function gzipString(text) {
    if (!supportsCompression || !encoder) return null;
    try {
        const input = encoder.encode(text);
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        // 不 await 写入；write 返回的 promise 只代表流背压，close 才代表全部消费完
        writer.write(input);
        writer.close();
        // 用 Response 把可读流聚合为 ArrayBuffer，避免手写 reader 循环
        const buffer = await new Response(cs.readable).arrayBuffer();
        return new Uint8Array(buffer);
    } catch {
        return null;
    }
}

self.onmessage = async (event) => {
    const payload = event.data || {};
    const id = payload.id;
    const action = payload.action;

    if (action !== 'stringify') {
        self.postMessage({ id, error: `unknown-action:${action}` });
        return;
    }

    const shards = payload.shards || {};
    const compress = !!payload.compress;

    try {
        const jsons = {};
        const sizes = {};
        const names = Object.keys(shards);

        // Step 1: stringify 所有 shard（worker 内单线程串行，但总耗时基本等于一次 stringify 全量）
        for (const name of names) {
            const value = shards[name];
            const json = value === null || value === undefined
                ? 'null'
                : JSON.stringify(value);
            jsons[name] = json;
            sizes[name] = Math.ceil(json.length * 1.02);
        }

        // Step 2: 若要求压缩且环境支持，逐片 gzip
        let compressedBlobs;
        let compressedSizes;
        let compressionUsed = false;
        const transferables = [];
        if (compress && supportsCompression) {
            compressedBlobs = {};
            compressedSizes = {};
            const results = await Promise.all(names.map((name) => gzipString(jsons[name])));
            let allOk = true;
            results.forEach((blob, idx) => {
                const name = names[idx];
                if (blob) {
                    compressedBlobs[name] = blob;
                    compressedSizes[name] = blob.byteLength;
                    transferables.push(blob.buffer);
                } else {
                    allOk = false;
                }
            });
            if (allOk) {
                compressionUsed = true;
            } else {
                // 只要有一片压缩失败，全部退回到字符串路径，让主线程写盘逻辑保持一致
                compressedBlobs = undefined;
                compressedSizes = undefined;
                transferables.length = 0;
            }
        }

        const response = { id, jsons, sizes, compressionUsed };
        if (compressionUsed) {
            response.compressedBlobs = compressedBlobs;
            response.compressedSizes = compressedSizes;
        }
        // Uint8Array.buffer 作为 transferable 传回主线程，避免 1–3MB 数据再拷贝一次
        self.postMessage(response, transferables);
    } catch (error) {
        const message = (error && (error.message || error.toString())) || 'stringify-failed';
        self.postMessage({ id, error: String(message) });
    }
};
