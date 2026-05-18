// 娓告垙鐘舵€佺鐞嗛挬锟?
// 闆嗕腑绠＄悊鎵€鏈夋父鎴忕姸鎬侊紝閬垮厤App.jsx涓姸鎬佸畾涔夎繃锟?

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGroupedState } from './useGroupedState';
import { COUNTRIES, DEFAULT_VASSAL_STATUS, RESOURCES, STRATA } from '../config';
import { HISTORY_STORAGE_LIMIT, LOG_STORAGE_LIMIT } from '../config/gameConstants';
import { isOldUpgradeFormat, migrateUpgradesToNewFormat } from '../utils/buildingUpgradeUtils';
import { migrateAllOfficialsForInvestment } from '../logic/officials/migration';
import { ensureFrontDefaults, generateFront } from '../logic/diplomacy/frontSystem';
import { ensureBattleDefaults } from '../logic/diplomacy/battleSystem';
import { migrateNationEconomy } from '../logic/diplomacy/economy';
import { calculateAITreasuryTargetRatio } from '../logic/diplomacy/economyUtils';
import { ensureAIMilitaryState, syncAINationMilitary, evaluateAIFrontPlan } from '../logic/diplomacy/aiWar';
import { DEFAULT_DIFFICULTY, getDifficultyConfig, getStartingSilverMultiplier, getInitialBuildings } from '../config/difficulty';
import { getScenarioById } from '../config/scenarios';
import { clampBootstrapPopulation } from '../utils/populationClamp';
import { createAnnualReportAccumulator } from '../utils/annualReport';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import {
    trackSaveGame, trackLoadGame, trackResetGame, trackNewGame, trackErrorError,
    trackExportSave, trackImportSave, trackCoalitionChange,
    trackIdeologyEquip, trackIdeologyUnequip,
    // [PR-1] 瀛樻。鎬ц兘瑙傛祴
    trackSaveDuration, trackSaveBytes, trackSavePath,
} from '../analytics/gaTracker';
// [PR-4] save.worker 瀹㈡埛绔細鎶?5 鐗?shard 鐨?JSON.stringify 鎼涓荤嚎绋?// [PR-5] 鍚屾椂鎻愪緵 gzip 鍘嬬缉寮€鍏筹紙榛樿鍏抽棴锛屾寜鐏板害寮€鍚級
import { stringifyShardsInWorker, SAVE_WORKER_ERROR_KINDS, isSaveCompressionEnabled } from '../utils/saveWorkerClient';
import { trackSaveWorkerFallback } from '../analytics/gaTracker';

// [PR-5] 瑙ｅ帇缂╄緟鍔╋細鎶?IDB 璇诲埌鐨?Uint8Array/ArrayBuffer/Blob 瑙ｆ垚 JSON 瀛楃涓层€?// 璇诲彇绔案杩滃皾璇曡瘑鍒帇缂╄礋杞斤紝鎵€浠ュ嵆渚夸互鍚庡叧鎺夊啓鍏ヤ晶鐨?gzip 寮€鍏筹紝鍘嗗彶瀛樻。涔熻兘缁х画璇汇€?const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

const toUint8 = async (raw) => {
    if (raw == null) return null;
    if (raw instanceof Uint8Array) return raw;
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (typeof Blob !== 'undefined' && raw instanceof Blob) {
        const buf = await raw.arrayBuffer();
        return new Uint8Array(buf);
    }
    return null;
};

const isGzipBytes = (bytes) => !!(bytes && bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1);

const decompressGzipToString = async (bytes) => {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('DecompressionStream unavailable');
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const text = await new Response(ds.readable).text();
    return text;
};

/**
 * 鎶婁粠 IDB 璇诲嚭鐨?shard 鍘熷鍊艰鑼冨寲涓哄瓧绗︿覆銆? *   - string: 鍘熸牱杩斿洖锛坴2 鏈帇缂╄矾寰勶級
 *   - Uint8Array/ArrayBuffer/Blob: 鑻ユ槸 gzip 澶村垯瑙ｅ帇锛屽惁鍒欐寜 UTF-8 鏂囨湰瑙ｇ爜
 *   - 鍏跺畠锛氳繑鍥?null锛岀敱璋冪敤鏂规寜"缂哄け"澶勭悊
 */
const normalizeShardRawToJsonString = async (raw) => {
    if (raw == null) return null;
    if (typeof raw === 'string') return raw;
    const bytes = await toUint8(raw);
    if (!bytes) return null;
    if (isGzipBytes(bytes)) {
        return decompressGzipToString(bytes);
    }
    // 鍏滃簳锛氶潪 gzip 鐨勪簩杩涘埗锛堟瀬灏戣锛夛紝鎸?UTF-8 瑙ｇ爜
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(bytes);
    }
    return null;
};

// 澶氬瓨妗ｆЫ浣嶇郴锟?
const SAVE_SLOT_COUNT = 10; // 鎵嬪姩瀛樻。妲戒綅鏁伴噺
const SAVE_SLOT_PREFIX = 'civ_game_save_slot_';
const AUTOSAVE_KEY = 'civ_game_autosave_v1';
// [PR-2] SAVE_FORMAT_VERSION v1 = 鍗曞潡 JSON 鍏ㄩ噺瀛樻。锛泇2 = 鍒嗙墖瀛樻。锛坰tate/nations/history/market/social锛?// v1 瀛樻。浠嶅吋瀹硅鍙栵紱棣栨鍔犺浇鍚庝繚瀛樻椂浼氳嚜鍔ㄥ崌绾т负 v2
const SAVE_FORMAT_VERSION = 2;
const LEGACY_SAVE_FORMAT_VERSION = 1;
const DISCOVERY_SAVE_VERSION = 1;
const SAVE_FILE_EXTENSION = 'cgsave';
const SAVE_OBFUSCATION_KEY = 'civ_game_simple_mask_v1';
// Lower soft limit to prefer IndexedDB earlier (localStorage quota issues)
const LOCAL_STORAGE_SOFT_LIMIT = 1 * 1024 * 1024;
const EXTERNAL_SAVE_FLAG = '__externalSave';
const EXTERNAL_SAVE_STORAGE = 'indexeddb';
const SAVE_IDB_NAME = 'civ_game_save_db_v1';
const SAVE_IDB_STORE = 'saves';
const MAX_LOADED_MILITARY_CORPS = 800;
const MAX_LOADED_GENERALS = 1200;
const FAST_LOAD_MILITARY_ENTITY_THRESHOLD = 260;

// 鍏煎鏃у瓨妗ｇ殑 key锛堢敤浜庤縼绉伙級
const LEGACY_SAVE_KEY = 'civ_game_save_data_v1';
const ACHIEVEMENT_STORAGE_KEY = 'civ_game_achievements_v1';
const ACHIEVEMENT_PROGRESS_KEY = 'civ_game_achievement_progress_v1';

const hasIndexedDb = () => typeof indexedDB !== 'undefined';
const IDB_OPEN_TIMEOUT_MS = 8000;
const IDB_REQUEST_TIMEOUT_MS = 10000;

// [PERF] 鍗曚緥缂撳瓨 IndexedDB 杩炴帴锛岄伩鍏嶆瘡娆″瓨妗ｆ搷浣滈兘 open 鏂拌繛鎺ュ鑷存硠婕?let _dbInstance = null;
let _dbOpenPromise = null;

const openSaveDb = () => {
    if (_dbInstance) return Promise.resolve(_dbInstance);
    if (_dbOpenPromise) return _dbOpenPromise;

    _dbOpenPromise = new Promise((resolve, reject) => {
        if (!hasIndexedDb()) {
            reject(new Error('IndexedDB not available'));
            return;
        }

        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            _dbOpenPromise = null;
            reject(new Error('IndexedDB open timeout'));
        }, IDB_OPEN_TIMEOUT_MS);

        const settle = (handler) => (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            handler(value);
        };

        let request;
        try {
            request = indexedDB.open(SAVE_IDB_NAME, 1);
        } catch (error) {
            clearTimeout(timeoutId);
            _dbOpenPromise = null;
            reject(error);
            return;
        }

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SAVE_IDB_STORE)) {
                db.createObjectStore(SAVE_IDB_STORE);
            }
        };
        request.onsuccess = settle(() => {
            const db = request.result;
            db.onclose = () => { _dbInstance = null; _dbOpenPromise = null; };
            db.onversionchange = () => { db.close(); _dbInstance = null; _dbOpenPromise = null; };
            _dbInstance = db;
            _dbOpenPromise = null;
            resolve(db);
        });
        request.onerror = settle(() => { _dbOpenPromise = null; reject(request.error || new Error('Failed to open IndexedDB')); });
        request.onblocked = settle(() => { _dbOpenPromise = null; reject(new Error('IndexedDB open blocked')); });
    });

    return _dbOpenPromise;
};

const readSaveFromIndexedDb = async (key) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('IndexedDB read timeout'));
        }, IDB_REQUEST_TIMEOUT_MS);
        const settle = (handler) => () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            handler();
        };
        try {
            const tx = db.transaction(SAVE_IDB_STORE, 'readonly');
            const store = tx.objectStore(SAVE_IDB_STORE);
            const request = store.get(key);
            request.onsuccess = settle(() => resolve(request.result || null));
            request.onerror = settle(() => reject(request.error || new Error('Failed to read save')));
            tx.onabort = settle(() => reject(tx.error || new Error('IndexedDB read aborted')));
        } catch (error) {
            settle(() => reject(error))();
        }
    });
};

const writeSaveToIndexedDb = async (key, value) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('IndexedDB write timeout'));
        }, IDB_REQUEST_TIMEOUT_MS);
        const settle = (handler) => () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            handler();
        };
        try {
            const tx = db.transaction(SAVE_IDB_STORE, 'readwrite');
            const store = tx.objectStore(SAVE_IDB_STORE);
            const request = store.put(value, key);
            request.onsuccess = settle(() => resolve(true));
            request.onerror = settle(() => reject(request.error || new Error('Failed to write save')));
            tx.onabort = settle(() => reject(tx.error || new Error('IndexedDB write aborted')));
        } catch (error) {
            settle(() => reject(error))();
        }
    });
};

const removeSaveFromIndexedDb = async (key) => {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('IndexedDB delete timeout'));
        }, IDB_REQUEST_TIMEOUT_MS);
        const settle = (handler) => () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            handler();
        };
        try {
            const tx = db.transaction(SAVE_IDB_STORE, 'readwrite');
            const store = tx.objectStore(SAVE_IDB_STORE);
            const request = store.delete(key);
            request.onsuccess = settle(() => resolve(true));
            request.onerror = settle(() => reject(request.error || new Error('Failed to delete save')));
            tx.onabort = settle(() => reject(tx.error || new Error('IndexedDB delete aborted')));
        } catch (error) {
            settle(() => reject(error))();
        }
    });
};

const buildExternalSaveStub = (payload, { storage = EXTERNAL_SAVE_STORAGE, sizeBytes = 0 } = {}) => ({
    [EXTERNAL_SAVE_FLAG]: true,
    storage,
    sizeBytes,
    updatedAt: payload.updatedAt,
    saveSource: payload.saveSource,
    difficulty: payload.difficulty,
    empireName: payload.empireName,
    daysElapsed: payload.daysElapsed,
    epoch: payload.epoch,
    population: payload.population,
});

const isExternalSaveStub = (data) => !!(data && data[EXTERNAL_SAVE_FLAG]);

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲
// [PR-2] 鍒嗙墖瀛樻。锛圫harded Save锛夌浉鍏冲伐鍏?// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲
// 鍒嗙墖鐩爣锛氭妸鍘熸湰涓€涓ぇ JSON锛堥€氬父 1鈥?MB锛夋媶鎴?5 涓皬 JSON 鐙珛鍐欏叆 IDB銆?// 涓荤嚎绋嬩笉蹇呬竴娆?stringify 鏁翠釜瀵硅薄锛涙瘡涓垎鐗囩嫭绔?stringify + put锛屽崟娆″け璐?// 涓嶉樆濉炲叾瀹冨垎鐗囷紱鏈潵鍙互缁撳悎 dirty-bit 鍙啓鍙樺寲杩囩殑鍒嗙墖銆?//
// 鍒嗙墖鍒掑垎鍘熷垯锛?//   state   鈥斺€?鏍稿績涓氬姟鎬侊紝姣?tick 閮戒細鍙樺寲浣嗕綋绉皬锛堝崟鏁板€?/ 灏忓璞★級
//   nations 鈥斺€?鏈€澶х殑鍗曞瓧娈碉紝鐙珛鍒嗙墖渚夸簬鍚庣画鍙啓瀹?//   history 鈥斺€?鏃堕棿搴忓垪+鍘嗗彶璁板綍锛屼綋绉腑澶с€佸彉鍖栦綆棰?//   market  鈥斺€?甯傚満/浠锋牸鍘嗗彶锛屼綋绉腑绛夈€佸彉鍖栦腑绛?//   social  鈥斺€?闃跺眰/寤虹瓚璐㈠姟鏄庣粏 + 娲剧敓鍘嗗彶锛屼綋绉腑澶с€佸彉鍖栦腑浣?// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲

const SHARD_FLAG = '__shardedSave';
const SHARD_VERSION = 2;
const SHARD_NAMES = ['state', 'nations', 'history', 'market', 'social'];
const SHARD_KEY_SUFFIX = ':shard:';

// 鍝簺椤跺眰瀛楁灞炰簬鍝釜鍒嗙墖锛涙湭鍒楀嚭鐨勫瓧娈靛叏閮ㄥ綊鍏?state 鍒嗙墖
const SHARD_FIELD_MAP = {
    nations: ['nations'],
    history: [
        'history',
        'annualReportHistory',
        'eventHistory',
        'logs',
        'vassalDiplomacyHistory',
    ],
    market: [
        'market',
        'priceHistory',
        'equilibriumPrices',
        'economicIndicators',
    ],
    social: [
        'classIncome',
        'classExpense',
        'classFinancialData',
        'buildingFinancialData',
        'classWealthHistory',
        'classNeedsHistory',
        'totalInfluence',
        'totalWealth',
        'activeBuffs',
        'activeDebuffs',
    ],
};

// field 鈫?shardName 鍙嶅悜鏄犲皠
const SHARD_FIELD_INDEX = (() => {
    const idx = {};
    for (const [shard, fields] of Object.entries(SHARD_FIELD_MAP)) {
        for (const f of fields) idx[f] = shard;
    }
    return idx;
})();

const shardKeyFor = (baseKey, shardName) => `${baseKey}${SHARD_KEY_SUFFIX}${shardName}`;

// 鎶?flat payload 鎷嗘垚 { state, nations, history, market, social } 浜斾釜瀛愬璞?const splitPayloadToShards = (payload) => {
    const shards = { state: {}, nations: null, history: {}, market: {}, social: {} };
    if (!payload || typeof payload !== 'object') return shards;
    for (const key of Object.keys(payload)) {
        const value = payload[key];
        const targetShard = SHARD_FIELD_INDEX[key];
        if (targetShard === 'nations') {
            shards.nations = value;
        } else if (targetShard) {
            shards[targetShard][key] = value;
        } else {
            shards.state[key] = value;
        }
    }
    return shards;
};

// 鎶婁簲涓垎鐗囧悎骞跺洖 flat payload锛涚己澶卞垎鐗囩敤绌哄厹搴曚繚璇佸姞杞戒笉 break
const mergeShardsToPayload = ({ state, nations, history, market, social } = {}) => {
    const merged = { ...(state || {}) };
    if (nations !== undefined && nations !== null) {
        merged.nations = nations;
    }
    if (history && typeof history === 'object') Object.assign(merged, history);
    if (market && typeof market === 'object') Object.assign(merged, market);
    if (social && typeof social === 'object') Object.assign(merged, social);
    return merged;
};

// 鍒嗙墖 stub锛堝啓鍏?localStorage 鐨勫皬绱㈠紩锛夛細
//   淇濈暀鐜版湁 EXTERNAL_SAVE_FLAG 浠ヤ究鑰?loadGame 鍒嗘敮鑷姩璧?IDB 璺緞
//   闄勫姞 SHARD_FLAG + shards 鍒楄〃锛岃鏂?loadGame 鍒嗘敮璇嗗埆"璧板垎鐗囪鍙?
const buildShardedSaveStub = (payload, { sizeBytes = 0, shardSizes = null, failedShards = null } = {}) => ({
    [EXTERNAL_SAVE_FLAG]: true,
    [SHARD_FLAG]: true,
    shardVersion: SHARD_VERSION,
    storage: 'idb-sharded',
    sizeBytes,
    updatedAt: payload?.updatedAt,
    saveSource: payload?.saveSource,
    difficulty: payload?.difficulty,
    empireName: payload?.empireName,
    daysElapsed: payload?.daysElapsed,
    epoch: payload?.epoch,
    population: payload?.population,
    shards: SHARD_NAMES.slice(),
    shardSizes: shardSizes || undefined,
    failedShards: failedShards && failedShards.length ? failedShards : undefined,
});

const isShardedSaveStub = (data) => !!(data && data[SHARD_FLAG] && Array.isArray(data.shards));


// 鎶?宸茬粡 stringify 濂界殑瀛楃涓?鎹㈢畻鎴愬昂瀵告弿杩般€?// PR-1锛氶伩鍏?new Blob + 閲嶅 stringify銆備及绠楄鍒欙細
//  - ASCII 涓诲锛堟父鎴忓瓨妗?JSON 缁濆ぇ閮ㄥ垎鏄?ASCII 瀛楁鍚?鏁板瓧锛?鈫?1 char 鈮?1 byte
//  - 灏鹃儴涔樹互 1.02 浣滀负瀹夊叏绯绘暟锛岄槻姝?Unicode 瀛楁锛堝浗瀹跺悕涓枃锛夎浣庝及
// 瀵?鏄惁闇€瑕?IDB 鍒嗘祦"鐨勯槇鍊煎垽鏂€岃█锛岃繖涓繎浼艰冻澶熺簿纭€?const sizeDescFromString = (jsonString) => {
    if (typeof jsonString !== 'string') {
        return { bytes: 0, kb: '0', mb: '0', display: '0KB' };
    }
    const approxBytes = Math.ceil(jsonString.length * 1.02);
    const kb = (approxBytes / 1024).toFixed(1);
    const mb = (approxBytes / (1024 * 1024)).toFixed(2);
    return {
        bytes: approxBytes,
        kb,
        mb,
        display: approxBytes > 1024 * 1024 ? `${mb}MB` : `${kb}KB`,
    };
};


const getLoadedCorpsTotalUnits = (corps) => Object.values(corps?.units || {}).reduce((sum, count) => sum + Number(count || 0), 0);

const loadAchievementsFromStorage = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to load achievements:', error);
        return [];
    }
};

const loadAchievementProgressFromStorage = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(ACHIEVEMENT_PROGRESS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Failed to load achievement progress:', error);
        return {};
    }
};

/**
 * 鑾峰彇鎵€鏈夊瓨妗ｆЫ浣嶄俊锟?
 * @returns {Array} 瀛樻。妲戒綅淇℃伅鏁扮粍
 */
export const getAllSaveSlots = () => {
    if (typeof window === 'undefined') return [];

    const slots = [];

    // 鑾峰彇鎵嬪姩瀛樻。妲戒綅
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
        const key = `${SAVE_SLOT_PREFIX}${i}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                const diffConfig = getDifficultyConfig(data.difficulty);
                slots.push({
                    slotIndex: i,
                    isEmpty: false,
                    name: `瀛樻。 ${i + 1}`,
                    empireName: data.empireName || null,
                    updatedAt: data.updatedAt,
                    daysElapsed: data.daysElapsed || 0,
                    epoch: data.epoch || 0,
                    population: data.population || 0,
                    difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                    difficultyName: diffConfig?.name || '??',
                    difficultyIcon: diffConfig?.icon || '??',
                });
            } catch (e) {
                slots.push({ slotIndex: i, isEmpty: true, name: `瀛樻。 ${i + 1}` });
            }
        } else {
            slots.push({ slotIndex: i, isEmpty: true, name: `瀛樻。 ${i + 1}` });
        }
    }

    // 鑾峰彇鑷姩瀛樻。
    const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
    if (autoRaw) {
        try {
            const data = JSON.parse(autoRaw);
            const diffConfig = getDifficultyConfig(data.difficulty);
            slots.push({
                slotIndex: -1,
                isAutoSave: true,
                isEmpty: false,
                name: '鑷姩瀛樻。',
                empireName: data.empireName || null,
                updatedAt: data.updatedAt,
                daysElapsed: data.daysElapsed || 0,
                epoch: data.epoch || 0,
                population: data.population || 0,
                difficulty: data.difficulty || DEFAULT_DIFFICULTY,
                    difficultyName: diffConfig?.name || '??',
                    difficultyIcon: diffConfig?.icon || '??',
            });
        } catch (e) {
            // 鑷姩瀛樻。鎹熷潖锛屽拷锟?
        }
    }

    return slots;
};

/**
 * 鍒犻櫎鎸囧畾鐨勫瓨妗ｆЫ浣嶏紙鐙珛鍑芥暟锛屽彲鍦ㄧ粍浠跺璋冪敤锟?
 * @param {number} slotIndex - 瀛樻。妲戒綅绱㈠紩锟?-2涓烘墜鍔ㄥ瓨妗ｏ紝-1涓鸿嚜鍔ㄥ瓨妗ｏ級
 * @returns {boolean} 鏄惁鍒犻櫎鎴愬姛
 */
export const deleteSaveSlot = (slotIndex) => {
    if (typeof window === 'undefined') return false;

    try {
        let targetKey;

        if (slotIndex === -1) {
            // 鍒犻櫎鑷姩瀛樻。
            targetKey = AUTOSAVE_KEY;
        } else {
            // 鍒犻櫎鎵嬪姩瀛樻。妲戒綅
            const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
            targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
        }

        const rawData = localStorage.getItem(targetKey);
        if (!rawData) {
            return false;
        }

        try {
            const parsed = JSON.parse(rawData);
            // [PR-2] 鍒嗙墖瀛樻。锛氭竻鐞嗘墍鏈?shard:* key
            if (isShardedSaveStub(parsed)) {
                const shardNames = Array.isArray(parsed.shards) && parsed.shards.length
                    ? parsed.shards
                    : SHARD_NAMES;
                for (const name of shardNames) {
                    void removeSaveFromIndexedDb(shardKeyFor(targetKey, name));
                }
                void removeSaveFromIndexedDb(targetKey);
            } else if (isExternalSaveStub(parsed)) {
                void removeSaveFromIndexedDb(targetKey);
            }
        } catch (parseError) {
            // Ignore malformed save metadata
        }

        localStorage.removeItem(targetKey);
        return true;
    } catch (error) {
        console.error('Delete save slot failed:', error);
        return false;
    }
};

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const toBase64 = (arrayBuffer) => {
    if (typeof window === 'undefined') {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(arrayBuffer).toString('base64');
        }
        throw new Error('Base64 缂栫爜涓嶅彲锟?);
    }
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const fromBase64 = (base64) => {
    if (typeof window === 'undefined') {
        if (typeof Buffer !== 'undefined') {
            return Uint8Array.from(Buffer.from(base64, 'base64'));
        }
        throw new Error('Base64 瑙ｇ爜涓嶅彲锟?);
    }
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const canObfuscate = !!textEncoder && !!textDecoder;

const encodeSavePayload = (payload) => {
    if (!canObfuscate) throw new Error('褰撳墠鐜涓嶆敮鎸佸啓鍏ユ贩娣嗗瓨锟?);
    const jsonBytes = textEncoder.encode(JSON.stringify(payload));
    const keyBytes = textEncoder.encode(SAVE_OBFUSCATION_KEY);
    const masked = new Uint8Array(jsonBytes.length);
    for (let i = 0; i < jsonBytes.length; i += 1) {
        masked[i] = jsonBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return toBase64(masked.buffer);
};

const decodeSavePayload = (encoded) => {
    if (!canObfuscate) throw new Error('褰撳墠鐜涓嶆敮鎸佽鍙栨贩娣嗗瓨锟?);
    const maskedBytes = fromBase64(encoded);
    const keyBytes = textEncoder.encode(SAVE_OBFUSCATION_KEY);
    const restored = new Uint8Array(maskedBytes.length);
    for (let i = 0; i < maskedBytes.length; i += 1) {
        restored[i] = maskedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return JSON.parse(textDecoder.decode(restored));
};

const INITIAL_RESOURCES = {
    food: 300,
    wood: 300,
    stone: 200,
    cloth: 80,
    plank: 0,
    brick: 0,
    iron: 0,
    tools: 0,
    copper: 0,
    papyrus: 0,
    spice: 0,
    coffee: 0,
    coal: 0,
    steel: 0,
    silver: 600,
    science: 0,
    culture: 300
};

const COUNTRY_IDS = COUNTRIES.map((country) => country.id);
const COUNTRY_ID_SET = new Set(COUNTRY_IDS);
const COUNTRY_TEMPLATE_MAP = new Map(COUNTRIES.map((country) => [country.id, country]));
const LEGACY_NATION_ID_ALIASES = {
    highland_mining: 'highland_mining_consortium',
    academy_principality: 'academy_principalities',
    mountain_clan: 'mountain_clans',
};

const normalizeNationId = (nationId) => {
    if (nationId === null || nationId === undefined) {
        return nationId;
    }

    if (nationId === 0 || nationId === '0' || nationId === 'player') {
        return 'player';
    }

    const rawId = String(nationId);
    if (COUNTRY_ID_SET.has(rawId)) {
        return rawId;
    }

    const aliasedId = LEGACY_NATION_ID_ALIASES[rawId];
    if (aliasedId && COUNTRY_ID_SET.has(aliasedId)) {
        return aliasedId;
    }

    const prefixMatches = COUNTRY_IDS.filter((countryId) => countryId.startsWith(rawId));
    if (prefixMatches.length === 1) {
        return prefixMatches[0];
    }

    return rawId;
};

const mergeCountryTemplate = (nation) => {
    if (!nation || nation.id === 'player' || nation.isRebelNation) {
        return nation;
    }

    const normalizedNationId = normalizeNationId(nation.id);
    const template = COUNTRY_TEMPLATE_MAP.get(normalizedNationId);
    if (!template) {
        return {
            ...nation,
            id: normalizedNationId,
        };
    }

    return {
        ...template,
        ...nation,
        id: normalizedNationId,
        appearEpoch: template.appearEpoch ?? nation.appearEpoch ?? 0,
        expireEpoch: template.expireEpoch ?? nation.expireEpoch ?? null,
        relation: Number.isFinite(nation.relation) ? nation.relation : 50,
        culturalTraits: {
            ...(template.culturalTraits || {}),
            ...(nation.culturalTraits || {}),
        },
        economyTraits: {
            ...(template.economyTraits || {}),
            ...(nation.economyTraits || {}),
            resourceBias: {
                ...(template.economyTraits?.resourceBias || {}),
                ...(nation.economyTraits?.resourceBias || {}),
            },
        },
        specialAbilities: Array.isArray(nation.specialAbilities)
            ? nation.specialAbilities
            : (Array.isArray(template.specialAbilities) ? template.specialAbilities : []),
    };
};

const buildInitialWealth = () => {
    const wealth = {};
    Object.keys(STRATA).forEach(key => {
        wealth[key] = STRATA[key].startingWealth || 0;
    });
    return wealth;
};

const sanitizeExpansionSettings = (settings = {}) => {
    if (!settings || typeof settings !== 'object') return {};
    const cleaned = {};
    Object.entries(settings).forEach(([buildingId, config]) => {
        if (!config || typeof config !== 'object') return;
        const { maxCount, ...rest } = config;
        cleaned[buildingId] = { ...rest };
    });
    return cleaned;
};

const buildInitialWealthHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => {
        history[key] = [];
    });
    return history;
};

const buildInitialNeedsHistory = () => {
    const history = {};
    Object.keys(STRATA).forEach(key => {
        history[key] = [];
    });
    return history;
};

const buildInitialLivingStandardStreaks = () => {
    const streaks = {};
    Object.keys(STRATA).forEach(key => {
        streaks[key] = { streak: 0, level: null };
    });
    return streaks;
};

const buildInitialHistory = () => {
    const classHistory = {};
    Object.keys(STRATA).forEach(key => {
        classHistory[key] = { pop: [], income: [], expense: [] };
    });
    return {
        treasury: [],
        tax: [],
        fiscalNetIncome: [],
        population: [],
        class: classHistory,
        // 缁忔祹鎸囨爣鍘嗗彶
        gdp: [],
        cpi: [],
        ppi: [],
    };
};

const buildInitialMerchantState = () => ({
    pendingTrades: [],
    lastTradeTime: 0,
    lockedCapital: 0,

    // Trade 2.0: player-assigned merchants by nation id
    // Example: { 'rome': 10, 'egypt': 5 }
    merchantAssignments: {},

    // Trade 2.0: per-resource preference multipliers (1 = neutral)
    // Shape: { import: { food: 1.2 }, export: { iron: 1.5 } }
    merchantTradePreferences: { import: {}, export: {} },
});

// Use constants from gameConstants.js for consistent limits
const AUTO_SAVE_LIMITS = {
    history: HISTORY_STORAGE_LIMIT,
    classHistory: HISTORY_STORAGE_LIMIT,
    eventHistory: HISTORY_STORAGE_LIMIT,
    classSeries: HISTORY_STORAGE_LIMIT,
    marketHistory: HISTORY_STORAGE_LIMIT,
    logs: LOG_STORAGE_LIMIT,
};

// Aggressive limits are half of normal limits, minimum 5
const AUTO_SAVE_AGGRESSIVE_LIMITS = {
    history: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    classHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    eventHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    classSeries: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    marketHistory: Math.max(5, Math.floor(HISTORY_STORAGE_LIMIT / 3)),
    logs: Math.max(10, Math.floor(LOG_STORAGE_LIMIT / 2)),
};

const trimArray = (value, limit) => (Array.isArray(value) ? value.slice(-limit) : value);
const trimRecentLogs = (logs, limit) => (Array.isArray(logs) ? logs.slice(0, limit) : logs);

const trimClassSeriesMap = (seriesMap, limit) => {
    if (!seriesMap || typeof seriesMap !== 'object') {
        return seriesMap;
    }
    const trimmed = {};
    Object.keys(seriesMap).forEach((key) => {
        trimmed[key] = trimArray(seriesMap[key], limit);
    });
    return trimmed;
};

const trimHistorySnapshot = (history, limit) => {
    if (!history || typeof history !== 'object') {
        return history;
    }
    const next = {
        ...history,
        treasury: trimArray(history.treasury, limit),
        tax: trimArray(history.tax, limit),
        fiscalNetIncome: trimArray(history.fiscalNetIncome, limit),
        population: trimArray(history.population, limit),
    };
    if (history.class && typeof history.class === 'object') {
        const classHistory = {};
        Object.keys(history.class).forEach((key) => {
            const entry = history.class[key] || {};
            classHistory[key] = {
                ...entry,
                pop: trimArray(entry.pop, limit),
                income: trimArray(entry.income, limit),
                expense: trimArray(entry.expense, limit),
            };
        });
        next.class = classHistory;
    }
    return next;
};

// [NEW] 杩佺Щ鏃х増娴峰鎶曡祫鏁版嵁锛堜粠 input/output 锟?strategy锟?
const migrateOverseasInvestments = (investments) => {
    if (!Array.isArray(investments)) return [];

    const normalize = (inv) => {
        const baseInv = inv.strategy ? { ...inv } : { ...inv };
        if (!baseInv.strategy) {
            if (inv.outputDest === 'home') {
                baseInv.strategy = 'RESOURCE_EXTRACTION';
            } else if (inv.inputSource === 'home') {
                baseInv.strategy = 'MARKET_DUMPING';
            } else {
                baseInv.strategy = 'PROFIT_MAX';
            }
        }
        if (!Number.isFinite(baseInv.count)) {
            baseInv.count = 1;
        }
        return baseInv;
    };

    const getGroupKey = (inv) => {
        const strategy = inv.strategy || 'PROFIT_MAX';
        return `${inv.targetNationId}::${inv.buildingId}::${inv.ownerStratum || 'capitalist'}::${strategy}`;
    };

    const merged = new Map();
    investments.forEach((raw) => {
        const inv = normalize(raw);
        const key = getGroupKey(inv);
        if (!merged.has(key)) {
            merged.set(key, inv);
            return;
        }
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            count: (existing.count || 1) + (inv.count || 1),
            investmentAmount: (existing.investmentAmount || 0) + (inv.investmentAmount || 0),
            createdDay: Math.min(existing.createdDay || inv.createdDay || 0, inv.createdDay || 0),
        });
    });

    return Array.from(merged.values());
};

const migrateForeignInvestments = (investments) => {
    if (!Array.isArray(investments)) return [];

    const normalize = (inv) => {
        const baseInv = { ...inv };
        if (!baseInv.strategy) {
            baseInv.strategy = 'PROFIT_MAX';
        }
        if (!Number.isFinite(baseInv.count)) {
            baseInv.count = 1;
        }
        return baseInv;
    };

    const getGroupKey = (inv) => {
        const strategy = inv.strategy || 'PROFIT_MAX';
        return `${inv.ownerNationId}::${inv.buildingId}::${inv.investorStratum || 'capitalist'}::${strategy}`;
    };

    const merged = new Map();
    const nonOperating = []; // nationalized / suspended 绛夐潪杩愯惀璁板綍鍗曠嫭淇濈暀锛屼笉鍙備笌 count 鍚堝苟
    investments.forEach((raw) => {
        const inv = normalize(raw);
        if (inv.status !== 'operating') {
            nonOperating.push(inv);
            return;
        }
        const key = getGroupKey(inv);
        if (!merged.has(key)) {
            merged.set(key, inv);
            return;
        }
        const existing = merged.get(key);
        merged.set(key, {
            ...existing,
            count: (existing.count || 1) + (inv.count || 1),
            investmentAmount: (existing.investmentAmount || 0) + (inv.investmentAmount || 0),
            createdDay: Math.min(existing.createdDay || inv.createdDay || 0, inv.createdDay || 0),
        });
    });

    return [...Array.from(merged.values()), ...nonOperating];
};

const normalizeNationKeyedRecord = (record, valueMapper = (value) => value) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return record;
    }

    const normalized = {};
    Object.entries(record).forEach(([nationId, value]) => {
        normalized[normalizeNationId(nationId)] = valueMapper(value);
    });
    return normalized;
};

const normalizeNationObject = (nation) => {
    if (!nation || typeof nation !== 'object') {
        return nation;
    }

    return {
        ...nation,
        id: normalizeNationId(nation.id),
        warTarget: normalizeNationId(nation.warTarget),
        vassalOf: normalizeNationId(nation.vassalOf),
        overlordId: normalizeNationId(nation.overlordId),
        foreignRelations: normalizeNationKeyedRecord(nation.foreignRelations),
        foreignWars: normalizeNationKeyedRecord(nation.foreignWars, (war) => {
            if (!war || typeof war !== 'object') {
                return war;
            }

            return {
                ...war,
                attackerId: normalizeNationId(war.attackerId),
                defenderId: normalizeNationId(war.defenderId),
                targetNationId: normalizeNationId(war.targetNationId),
            };
        }),
    };
};

const normalizeOrganizationState = (diplomacyOrganizations) => {
    if (!diplomacyOrganizations || typeof diplomacyOrganizations !== 'object') {
        return diplomacyOrganizations;
    }

    return {
        ...diplomacyOrganizations,
        organizations: Array.isArray(diplomacyOrganizations.organizations)
            ? diplomacyOrganizations.organizations.map((org) => {
                if (!org || typeof org !== 'object') {
                    return org;
                }

                return {
                    ...org,
                    founderId: normalizeNationId(org.founderId),
                    leaderId: normalizeNationId(org.leaderId),
                    members: Array.isArray(org.members) ? org.members.map((memberId) => normalizeNationId(memberId)) : org.members,
                };
            })
            : [],
    };
};

const normalizeInvestmentRecord = (investment) => {
    if (!investment || typeof investment !== 'object') {
        return investment;
    }

    return {
        ...investment,
        targetNationId: normalizeNationId(investment.targetNationId),
        ownerNationId: normalizeNationId(investment.ownerNationId),
    };
};

const normalizeFrontRecord = (front) => {
    if (!front || typeof front !== 'object') {
        return front;
    }

    const attackerId = normalizeNationId(front.attackerId);
    const defenderId = normalizeNationId(front.defenderId);

    return {
        ...front,
        attackerId,
        defenderId,
        warId: typeof front.warId === 'string' && front.warId.includes('_vs_')
            ? `${attackerId}_vs_${defenderId}`
            : front.warId,
        resourceNodes: Array.isArray(front.resourceNodes)
            ? front.resourceNodes.map((node) => (
                node && typeof node === 'object'
                    ? {
                        ...node,
                        owner: normalizeNationId(node.owner),
                    }
                    : node
            ))
            : front.resourceNodes,
        infrastructure: Array.isArray(front.infrastructure)
            ? front.infrastructure.map((item) => (
                item && typeof item === 'object'
                    ? {
                        ...item,
                        owner: normalizeNationId(item.owner),
                    }
                    : item
            ))
            : front.infrastructure,
        destroyedBuildings: normalizeNationKeyedRecord(front.destroyedBuildings),
    };
};

const normalizeBattleRecord = (battle) => {
    if (!battle || typeof battle !== 'object') {
        return battle;
    }

    return {
        ...battle,
        attackerId: normalizeNationId(battle.attackerId),
        defenderId: normalizeNationId(battle.defenderId),
        attackerNationId: normalizeNationId(battle.attackerNationId),
        defenderNationId: normalizeNationId(battle.defenderNationId),
        winnerId: normalizeNationId(battle.winnerId),
        loserId: normalizeNationId(battle.loserId),
    };
};

const normalizeTradeRecord = (trade) => {
    if (!trade || typeof trade !== 'object') {
        return trade;
    }

    return {
        ...trade,
        partnerId: normalizeNationId(trade.partnerId),
        nationId: normalizeNationId(trade.nationId),
        targetNationId: normalizeNationId(trade.targetNationId),
        ownerNationId: normalizeNationId(trade.ownerNationId),
    };
};

const normalizeVassalDiplomacyEntry = (entry) => {
    if (!entry || typeof entry !== 'object') {
        return entry;
    }

    return {
        ...entry,
        nationId: normalizeNationId(entry.nationId),
        vassalId: normalizeNationId(entry.vassalId),
        overlordId: normalizeNationId(entry.overlordId),
        targetId: normalizeNationId(entry.targetId),
        targetNationId: normalizeNationId(entry.targetNationId),
    };
};

const normalizeLoadedSaveData = (rawData) => {
    if (!rawData || typeof rawData !== 'object') {
        return rawData;
    }

    const merchantState = rawData.merchantState && typeof rawData.merchantState === 'object'
        ? {
            ...rawData.merchantState,
            merchantAssignments: normalizeNationKeyedRecord(rawData.merchantState.merchantAssignments),
            assignments: normalizeNationKeyedRecord(rawData.merchantState.assignments),
            pendingTrades: Array.isArray(rawData.merchantState.pendingTrades)
                ? rawData.merchantState.pendingTrades.map(normalizeTradeRecord)
                : rawData.merchantState.pendingTrades,
        }
        : rawData.merchantState;

    const market = rawData.market && typeof rawData.market === 'object'
        ? {
            ...rawData.market,
            activeTrades: Array.isArray(rawData.market.activeTrades) ? rawData.market.activeTrades.map(normalizeTradeRecord) : rawData.market.activeTrades,
            tradeHistory: Array.isArray(rawData.market.tradeHistory) ? rawData.market.tradeHistory.map(normalizeTradeRecord) : rawData.market.tradeHistory,
            completedTrades: Array.isArray(rawData.market.completedTrades) ? rawData.market.completedTrades.map(normalizeTradeRecord) : rawData.market.completedTrades,
        }
        : rawData.market;

    return {
        ...rawData,
        selectedTarget: normalizeNationId(rawData.selectedTarget),
        nations: Array.isArray(rawData.nations) ? rawData.nations.map(normalizeNationObject) : rawData.nations,
        diplomacyOrganizations: normalizeOrganizationState(rawData.diplomacyOrganizations),
        overseasInvestments: Array.isArray(rawData.overseasInvestments) ? rawData.overseasInvestments.map(normalizeInvestmentRecord) : rawData.overseasInvestments,
        foreignInvestments: Array.isArray(rawData.foreignInvestments) ? rawData.foreignInvestments.map(normalizeInvestmentRecord) : rawData.foreignInvestments,
        activeFronts: Array.isArray(rawData.activeFronts) ? rawData.activeFronts.map(normalizeFrontRecord) : rawData.activeFronts,
        activeBattles: Array.isArray(rawData.activeBattles) ? rawData.activeBattles.map(normalizeBattleRecord) : rawData.activeBattles,
        militaryCorps: Array.isArray(rawData.militaryCorps)
            ? rawData.militaryCorps.map((corps) => (
                corps && typeof corps === 'object'
                    ? {
                        ...corps,
                        nationId: normalizeNationId(corps.nationId),
                    }
                    : corps
            ))
            : rawData.militaryCorps,
        generals: Array.isArray(rawData.generals)
            ? rawData.generals.map((general) => (
                general && typeof general === 'object'
                    ? {
                        ...general,
                        nationId: normalizeNationId(general.nationId),
                    }
                    : general
            ))
            : rawData.generals,
        merchantState,
        market,
        vassalDiplomacyQueue: Array.isArray(rawData.vassalDiplomacyQueue) ? rawData.vassalDiplomacyQueue.map(normalizeVassalDiplomacyEntry) : rawData.vassalDiplomacyQueue,
        vassalDiplomacyHistory: Array.isArray(rawData.vassalDiplomacyHistory) ? rawData.vassalDiplomacyHistory.map(normalizeVassalDiplomacyEntry) : rawData.vassalDiplomacyHistory,
    };
};

const collectReferencedNationIds = (data) => {
    const referencedNationIds = new Set();
    const addNationId = (nationId) => {
        const normalizedNationId = normalizeNationId(nationId);
        if (COUNTRY_ID_SET.has(normalizedNationId)) {
            referencedNationIds.add(normalizedNationId);
        }
    };

    addNationId(data.selectedTarget);

    const organizations = data.diplomacyOrganizations?.organizations || [];
    organizations.forEach((org) => {
        addNationId(org?.founderId);
        addNationId(org?.leaderId);
        if (Array.isArray(org?.members)) {
            org.members.forEach(addNationId);
        }
    });

    (data.overseasInvestments || []).forEach((investment) => {
        addNationId(investment?.targetNationId);
        addNationId(investment?.ownerNationId);
    });

    (data.foreignInvestments || []).forEach((investment) => {
        addNationId(investment?.targetNationId);
        addNationId(investment?.ownerNationId);
    });

    (data.activeFronts || []).forEach((front) => {
        addNationId(front?.attackerId);
        addNationId(front?.defenderId);
    });

    (data.activeBattles || []).forEach((battle) => {
        addNationId(battle?.attackerId);
        addNationId(battle?.defenderId);
        addNationId(battle?.winnerId);
        addNationId(battle?.loserId);
    });

    (data.militaryCorps || []).forEach((corps) => addNationId(corps?.nationId));
    (data.generals || []).forEach((general) => addNationId(general?.nationId));

    Object.keys(data.merchantState?.merchantAssignments || {}).forEach(addNationId);
    (data.merchantState?.pendingTrades || []).forEach((trade) => {
        addNationId(trade?.partnerId);
        addNationId(trade?.nationId);
        addNationId(trade?.targetNationId);
        addNationId(trade?.ownerNationId);
    });

    ['activeTrades', 'tradeHistory', 'completedTrades'].forEach((key) => {
        (data.market?.[key] || []).forEach((trade) => {
            addNationId(trade?.partnerId);
            addNationId(trade?.nationId);
            addNationId(trade?.targetNationId);
            addNationId(trade?.ownerNationId);
        });
    });

    (data.vassalDiplomacyQueue || []).forEach((entry) => {
        addNationId(entry?.nationId);
        addNationId(entry?.vassalId);
        addNationId(entry?.overlordId);
        addNationId(entry?.targetId);
        addNationId(entry?.targetNationId);
    });

    (data.vassalDiplomacyHistory || []).forEach((entry) => {
        addNationId(entry?.nationId);
        addNationId(entry?.vassalId);
        addNationId(entry?.overlordId);
        addNationId(entry?.targetId);
        addNationId(entry?.targetNationId);
    });

    return referencedNationIds;
};

const rebuildLoadedNationRoster = ({
    rawNations,
    referencedNationIds,
    playerState,
}) => {
    const loadedNationList = Array.isArray(rawNations)
        ? rawNations
            .filter((nation) => nation && typeof nation === 'object')
            .map(normalizeNationObject)
            .filter((nation) => nation?.id && nation.id !== 'player')
        : [];

    const loadedNationMap = new Map();
    loadedNationList.forEach((nation) => {
        if (!loadedNationMap.has(nation.id)) {
            loadedNationMap.set(nation.id, nation);
        }
    });

    const validLoadedNationIds = new Set(
        Array.from(loadedNationMap.keys()).filter((nationId) => COUNTRY_ID_SET.has(nationId))
    );
    const missingReferencedNationIds = Array.from(referencedNationIds)
        .filter((nationId) => !validLoadedNationIds.has(nationId));
    const currentEpoch = playerState?.epoch ?? 0;
    const severeRosterLoss = (
        !Array.isArray(rawNations)
        || validLoadedNationIds.size <= 1
    );
    const shouldRebuildRoster = (
        !Array.isArray(rawNations)
        || validLoadedNationIds.size === 0
        || missingReferencedNationIds.length > 0
    );

    if (!shouldRebuildRoster) {
        return {
            nations: loadedNationList,
            missingReferencedNationIds,
            rebuilt: false,
            severeRosterLoss,
        };
    }

    const bootstrapNations = buildInitialNations(playerState).map((nation) => {
        const loadedNation = loadedNationMap.get(nation.id);
        const appearEpoch = nation.appearEpoch ?? 0;
        const isExpired = nation.expireEpoch != null && currentEpoch > nation.expireEpoch;
        const fallbackDiscovered = severeRosterLoss
            ? (!isExpired && appearEpoch <= currentEpoch)
            : referencedNationIds.has(nation.id);
        if (loadedNation) {
            if (!severeRosterLoss) {
                return loadedNation;
            }

            return {
                ...loadedNation,
                discovered: fallbackDiscovered,
                _recoveredFromTemplate: true,
            };
        }

        return {
            ...nation,
            discovered: fallbackDiscovered,
            _recoveredFromTemplate: true,
        };
    });

    const extraLoadedNations = loadedNationList.filter((nation) => !COUNTRY_ID_SET.has(nation.id));

        return {
            nations: [...bootstrapNations, ...extraLoadedNations],
            missingReferencedNationIds,
            rebuilt: true,
            severeRosterLoss,
        };
    };

const trimMarketSnapshot = (market, limit) => {
    if (!market || typeof market !== 'object') {
        return market;
    }
    const trimSeriesMap = (seriesMap) => {
        if (!seriesMap || typeof seriesMap !== 'object') {
            return seriesMap;
        }
        const trimmed = {};
        Object.keys(seriesMap).forEach((key) => {
            trimmed[key] = trimArray(seriesMap[key], limit);
        });
        return trimmed;
    };
    return {
        ...market,
        priceHistory: trimSeriesMap(market.priceHistory),
        supplyHistory: trimSeriesMap(market.supplyHistory),
        demandHistory: trimSeriesMap(market.demandHistory),
    };
};

const compactSavePayload = (payload, { aggressive = false } = {}) => {
    const limits = aggressive ? AUTO_SAVE_AGGRESSIVE_LIMITS : AUTO_SAVE_LIMITS;

    // Compact nations array (remove history and unnecessary data from vassals)
    const compactNations = (nations) => {
        if (!Array.isArray(nations)) return nations;
        return nations.map(nation => {
            const compacted = { ...nation };
            const historyLimit = nation.isPlayer ? limits.history : Math.floor(limits.history / 2);
            const classSeriesLimit = nation.isPlayer ? limits.classSeries : Math.floor(limits.classSeries / 2);
            const eventLimit = nation.isPlayer ? limits.eventHistory : Math.floor(limits.eventHistory / 2);
            const logLimit = nation.isPlayer ? Math.min(limits.logs, 20) : Math.min(limits.logs, 10);

            if (aggressive) {
                delete compacted.history;
                delete compacted.classWealthHistory;
                delete compacted.classNeedsHistory;
                compacted.eventHistory = [];
                compacted.logs = [];
            } else {
                if (compacted.history) {
                    compacted.history = trimHistorySnapshot(compacted.history, historyLimit);
                }
                if (compacted.classWealthHistory) {
                    compacted.classWealthHistory = trimClassSeriesMap(compacted.classWealthHistory, classSeriesLimit);
                }
                if (compacted.classNeedsHistory) {
                    compacted.classNeedsHistory = trimClassSeriesMap(compacted.classNeedsHistory, classSeriesLimit);
                }
                if (compacted.eventHistory) {
                    compacted.eventHistory = trimArray(compacted.eventHistory, eventLimit);
                }
                if (compacted.logs) {
                    compacted.logs = trimRecentLogs(compacted.logs, logLimit);
                }
            }

            if (compacted.market) {
                if (aggressive || !nation.isPlayer) {
                    compacted.market = {
                        ...compacted.market,
                        priceHistory: {},
                        supplyHistory: {},
                        demandHistory: {},
                    };
                } else {
                    compacted.market = trimMarketSnapshot(compacted.market, Math.floor(limits.marketHistory / 2));
                }
            }

            return compacted;
        });
    };

    const compacted = {
        ...payload,
        history: trimHistorySnapshot(payload.history, limits.history),
        classWealthHistory: trimClassSeriesMap(payload.classWealthHistory, limits.classSeries),
        classNeedsHistory: trimClassSeriesMap(payload.classNeedsHistory, limits.classSeries),
        market: trimMarketSnapshot(payload.market, limits.marketHistory),
        eventHistory: trimArray(payload.eventHistory, limits.eventHistory),
        logs: trimRecentLogs(payload.logs, limits.logs),
        vassalDiplomacyHistory: trimArray(payload.vassalDiplomacyHistory, limits.eventHistory),
        nations: compactNations(payload.nations),
        clicks: [],
    };
    if (aggressive) {
        compacted.history = buildInitialHistory();
        compacted.classWealthHistory = buildInitialWealthHistory();
        compacted.classNeedsHistory = buildInitialNeedsHistory();
        compacted.eventHistory = trimArray(payload.eventHistory, Math.min(5, limits.eventHistory));
        compacted.logs = trimRecentLogs(payload.logs, Math.min(5, limits.logs));
    }
    return compacted;
};

const buildMinimalAutoSavePayload = (payload) => {
    // Ultra-minimal nations (only essential data)
    const minimalNations = Array.isArray(payload.nations) ? payload.nations.map(nation => {
        if (nation.isPlayer) {
            // Keep player nation but remove history
            return {
                ...nation,
                history: undefined,
                classWealthHistory: undefined,
                classNeedsHistory: undefined,
                eventHistory: [],
                logs: [],
                market: nation.market ? {
                    prices: nation.market.prices,
                    priceHistory: {},
                    supplyHistory: {},
                    demandHistory: {},
                } : undefined,
            };
        }
        // For vassals, keep only critical data
        return {
            id: nation.id,
            name: nation.name,
            isPlayer: nation.isPlayer,
            discovered: nation.discovered,
            _discoveredBy: nation._discoveredBy,
            resources: nation.resources,
            population: nation.population,
            wealth: nation.wealth,
            budget: nation.budget,
            economyTraits: nation.economyTraits,
            lastGiftToPlayerDay: nation.lastGiftToPlayerDay,
            buildings: nation.buildings,
            vassalType: nation.vassalType,
            overlordId: nation.overlordId,
            vassalPolicy: nation.vassalPolicy,
            independenceTendency: nation.independenceTendency,
            socialStructure: nation.socialStructure,
        };
    }) : [];

    return {
        saveFormatVersion: payload.saveFormatVersion,
        resources: payload.resources,
        population: payload.population,
        popStructure: payload.popStructure,
        maxPop: payload.maxPop,
        buildings: payload.buildings,
        buildingUpgrades: payload.buildingUpgrades,
        techsUnlocked: payload.techsUnlocked,
        epoch: payload.epoch,
        gameSpeed: payload.gameSpeed,
        isPaused: payload.isPaused,
        nations: minimalNations,
        classApproval: payload.classApproval,
        classInfluence: payload.classInfluence,
        classWealth: payload.classWealth,
        stability: payload.stability,
        daysElapsed: payload.daysElapsed,
        army: payload.army,
        militaryCorps: payload.militaryCorps,
        generals: payload.generals,
        activeFronts: payload.activeFronts,
        activeBattles: payload.activeBattles,
        taxes: payload.taxes,
        taxPolicies: payload.taxPolicies,
        jobFill: payload.jobFill,
        market: payload.market ? {
            prices: payload.market.prices,
            priceHistory: {},
            supplyHistory: {},
            demandHistory: {},
        } : undefined,
        overseasBuildings: payload.overseasBuildings || [],
        rebellionStates: payload.rebellionStates,
        rulingCoalition: payload.rulingCoalition,
        legitimacy: payload.legitimacy,
        officials: payload.officials,
        ministerAssignments: payload.ministerAssignments,
        activeDecrees: payload.activeDecrees || [],
        ideologyScore: payload.ideologyScore ?? 0,
        ideologyScoreSpent: payload.ideologyScoreSpent ?? 0,
        ideologyCollection: Array.isArray(payload.ideologyCollection) ? payload.ideologyCollection : [],
        equippedIdeologies: Array.isArray(payload.equippedIdeologies) ? payload.equippedIdeologies : [],
        ideologySlotCount: payload.ideologySlotCount ?? 3,
        ideologyCooldowns: payload.ideologyCooldowns || {},
        ideologyMilestones: Array.isArray(payload.ideologyMilestones) ? payload.ideologyMilestones : [],
        pendingIdeologyEmergence: payload.pendingIdeologyEmergence ?? null,
        autoSaveInterval: payload.autoSaveInterval,
        isAutoSaveEnabled: payload.isAutoSaveEnabled,
        difficulty: payload.difficulty,
        empireName: payload.empireName,
        updatedAt: payload.updatedAt,
        saveSource: 'auto-minimal',
        // Remove ALL heavy data
        history: undefined,
        classWealthHistory: undefined,
        classNeedsHistory: undefined,
        eventHistory: [],
        logs: [],
        clicks: [],
        // Remove non-essential fields
        maxPopBonus: undefined,
        birthAccumulator: undefined,
        activeTab: undefined,
        classWealthDelta: undefined,
        classIncome: undefined,
        classExpense: undefined,
        classFinancialData: undefined,
        totalInfluence: undefined,
        totalWealth: undefined,
        activeBuffs: undefined,
        activeDebuffs: undefined,
        classInfluenceShift: undefined,
        classShortages: undefined,
        classLivingStandard: undefined,
        livingStandardStreaks: undefined,
        migrationCooldowns: undefined,
        militaryQueue: undefined,
        selectedTarget: undefined,
        battleResult: undefined,
        playerInstallmentPayment: undefined,
        autoRecruitEnabled: undefined,
        targetArmyComposition: undefined,
        militaryWageRatio: undefined,
        lastBattleTargetId: undefined,
        lastBattleDay: undefined,
        annualReportBaseline: undefined,
        annualReportAccumulator: undefined,
        lastFestivalYear: undefined,
        showTutorial: undefined,
        currentEvent: undefined,
        merchantState: undefined,
        tradeStats: undefined,
        diplomacyOrganizations: undefined,
        vassalDiplomacyQueue: undefined,
        vassalDiplomacyHistory: [],
        foreignInvestmentPolicy: undefined,
        foreignInvestmentPolicyOverrides: undefined,
        eventEffectSettings: undefined,
        activeEventEffects: undefined,
        actionCooldowns: undefined,
        actionUsage: undefined,
        promiseTasks: undefined,
        lastAutoSaveTime: undefined,
        officialCandidates: undefined,
        lastSelectionDay: undefined,
        officialCapacity: undefined,
        lastMinisterExpansionDay: undefined,
        decreeCooldowns: undefined,
        quotaTargets: undefined,
    };
};

const DEFAULT_EVENT_EFFECT_SETTINGS = {
    approval: { duration: 30, decayRate: 0.04 },
    stability: { duration: 30, decayRate: 0.04 },
    // Economic effect settings - longer duration, slower decay
    resourceDemand: { duration: 60, decayRate: 0.02 },      // Resource demand modifier
    stratumDemand: { duration: 60, decayRate: 0.02 },       // Stratum consumption modifier
    buildingProduction: { duration: 45, decayRate: 0.025 }, // Building production modifier

    // UI / Log visibility settings
    logVisibility: {
        showMerchantTradeLogs: false,
        showTradeLogs: false,
        showOfficialLogs: false,
        showMusicPlayer: false,
    },
};

const buildInitialEventEffects = () => ({
    approval: [],
    stability: [],
    // Economic effects: array of { target, currentValue, remainingDays, decayRate, source }
    resourceDemand: [],      // target: resource key, currentValue: percentage modifier (e.g., 0.2 = +20%)
    stratumDemand: [],       // target: stratum key, currentValue: percentage modifier
    buildingProduction: [],  // target: building category or id, currentValue: percentage modifier
    // Forced subsidies from rebel ultimatums
    forcedSubsidy: [],       // { id, name, stratumKey, dailyAmount, remainingDays, createdAt }
});

const buildInitialDiplomacyOrganizations = () => ({
    organizations: [],
    lastGlobalGiftToPlayerDay: 0,
});

/**
 * 杩佺Щ鏃у瓨妗ｄ腑鐨勭粍缁囨暟鎹紝纭繚姣忎釜缁勭粐閮芥湁 founderId
 * @param {Object} diplomacyOrganizations - 澶栦氦缁勭粐鏁版嵁
 * @returns {Object} 杩佺Щ鍚庣殑缁勭粐鏁版嵁
 */
const migrateDiplomacyOrganizations = (diplomacyOrganizations) => {
    if (!diplomacyOrganizations || typeof diplomacyOrganizations !== 'object') {
        return buildInitialDiplomacyOrganizations();
    }

    const organizations = Array.isArray(diplomacyOrganizations.organizations)
        ? diplomacyOrganizations.organizations
        : [];

    const migratedOrganizations = organizations
        .map(org => {
            // 濡傛灉缁勭粐宸茬粡锟?founderId锛岀洿鎺ヨ繑锟?
            if (org.founderId) {
                return org;
            }

            // 鏃у瓨妗ｅ吋瀹癸細浣跨敤绗竴涓垚鍛樹綔涓哄垱濮嬩汉
            const firstMember = org.members?.[0];
            if (!firstMember) {
                // 娌℃湁鎴愬憳鐨勭粍缁囧簲璇ヨ绉婚櫎
                console.log(`[Save Migration] Removing organization "${org.name}" with no members.`);
                return null;
            }

            console.log(`[Save Migration] Organization "${org.name}" missing founderId, using first member: ${firstMember}`);
            return {
                ...org,
                founderId: firstMember,
            };
        })
        .filter(org => org !== null); // 绉婚櫎鏃犳晥缁勭粐

    const lastGlobalGiftToPlayerDay = Number.isFinite(diplomacyOrganizations.lastGlobalGiftToPlayerDay)
        ? diplomacyOrganizations.lastGlobalGiftToPlayerDay
        : 0;

    return {
        ...diplomacyOrganizations,
        organizations: migratedOrganizations,
        lastGlobalGiftToPlayerDay,
    };
};

const buildInitialOverseasBuildings = () => ([]);

const buildInitialMinisterAssignments = () => ({
    agriculture: null,
    industry: null,
    commerce: null,
    civic: null,
    military: null,
    diplomacy: null,
});

const buildInitialMinisterAutoExpansion = () => ({
    agriculture: true,
    industry: true,
    commerce: true,
    civic: true,
});

const buildInitialMinisterExpansionCooldowns = () => ({
    global: 0,
    agriculture: 0,
    industry: 0,
    commerce: 0,
    civic: 0,
});

const normalizeMinisterExpansionCooldowns = (value) => {
    const base = buildInitialMinisterExpansionCooldowns();
    if (Number.isFinite(value)) {
        return {
            ...base,
            global: value,
            agriculture: value,
            industry: value,
            commerce: value,
            civic: value,
        };
    }
    if (!value || typeof value !== 'object') {
        return base;
    }
    return {
        ...base,
        ...value,
    };
};

const isTradable = (resourceKey) => {
    if (resourceKey === 'silver') return false;
    const def = RESOURCES[resourceKey];
    if (!def) return false;
    return !def.type || def.type !== 'virtual';
};

const buildInitialMarket = () => {
    const prices = {};
    Object.keys(RESOURCES).forEach(key => {
        if (!isTradable(key)) return;
        prices[key] = Math.max(0.5, RESOURCES[key].basePrice || 1);
    });

    return {
        prices,
        demand: {},
        supply: {},
        wages: {},
        priceHistory: {},
        supplyHistory: {},
        demandHistory: {},
    };
};

const buildDefaultHeadTaxRates = () => {
    const rates = {};
    Object.keys(STRATA).forEach(key => {
        rates[key] = 0.05; // 榛樿 5% 绋庣巼锛堢洿鎺ュ瓨鍌ㄦ瘮鐜囷紝鎵€瑙佸嵆鎵€寰楋級
    });
    return rates;
};

const buildDefaultResourceTaxRates = () => {
    const rates = {};
    Object.keys(RESOURCES).forEach(key => {
        if (!isTradable(key)) return;
        rates[key] = 0.05;
    });
    return rates;
};

const buildDefaultBusinessTaxRates = () => {
    const rates = {};
    // 榛樿鎵€鏈夊缓绛戣惀涓氱◣锟?锛堜笉鏀剁◣涔熶笉琛ヨ创锟?
    return rates;
};

const buildInitialNations = (playerState = null) => {
    // 濡傛灉鎻愪緵浜嗙帺瀹剁姸鎬侊紝鐢ㄤ簬缂╂斁鏂板浗瀹剁殑鍒濆锟?
    const playerPopulation = playerState?.population || 0;
    const playerCivilianWealth = Object.values(playerState?.classWealth || {}).reduce((sum, value) => {
        return sum + Math.max(0, Number(value) || 0);
    }, 0);
    const playerWealth = (playerState?.resources?.silver || 0) + playerCivilianWealth * 0.35;
    const currentEpoch = playerState?.epoch || 0;

    return COUNTRIES.map(nation => {
        const appearEpoch = nation.appearEpoch ?? 0;
        const epochPopulationBaseline = 1 + appearEpoch * 0.3;
        const epochWealthBaseline = 1 + appearEpoch * 0.2;
        
        // 璁＄畻缂╂斁鍥犲瓙锛氬熀浜庣帺瀹跺綋鍓嶅彂灞曟按骞冲拰鍥藉鍑虹幇鏃朵唬
        let populationScale = epochPopulationBaseline;
        let wealthScale = epochWealthBaseline;
        
        if (playerState && appearEpoch > 0) {
            // 濡傛灉鍥藉鍑虹幇鏃朵唬鏅氫簬褰撳墠鏃朵唬锛岃鏄庢槸鍚庢湡瑙ｉ攣鐨勫浗锟?
            // 闇€瑕佹牴鎹帺瀹跺綋鍓嶅疄鍔涜繘琛岀缉锟?
            if (appearEpoch <= currentEpoch) {
                // 涓嶅啀鎶?AI 缂╁埌鐜╁鐨?20%-30%锛屽惁鍒欏悗鏈熻В閿佸浗瀹朵細鍍忊€滃嚑鍗佷汉鍙ｅ皬鏉戣惤鈥濄€?                const playerPopulationScale = Math.max(0.75, Math.min(1.35, 0.75 + playerPopulation / 6000));
                const playerWealthScale = Math.max(0.7, Math.min(1.3, 0.7 + playerWealth / 60000));
                populationScale *= playerPopulationScale;
                wealthScale *= playerWealthScale;
            }
        }
        
        // 鍒濆鍖栧簱瀛橈細鍩轰簬璧勬簮鍋忓樊锛屽洿缁曠洰鏍囧簱锟?00娉㈠姩
        const inventory = {};
        const targetInventory = 500;
        if (nation.economyTraits?.resourceBias) {
            Object.entries(nation.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
                // 浣跨敤锟?aiEconomy.js 涓€鑷寸殑鐩爣搴撳瓨鍏紡
                const dynamicTarget = Math.round(500 * Math.pow(bias, 1.2));
                if (bias > 1) {
                    // 鐗逛骇璧勬簮锛氶珮搴撳瓨锛屽湪鐩爣鍊肩殑1.0-1.5鍊嶄箣闂达紙宸茬粡寰堥珮浜嗭級
                    inventory[resourceKey] = Math.floor(dynamicTarget * (1.0 + Math.random() * 0.5));
                } else if (bias < 1) {
                    // 绋€缂鸿祫婧愶細浣庡簱瀛橈紝鍦ㄧ洰鏍囧€肩殑0.3-0.6鍊嶄箣锟?
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.3 + Math.random() * 0.3));
                } else {
                    // 涓€ц祫婧愶細涓瓑搴撳瓨锛屽湪鐩爣鍊肩殑0.8-1.2鍊嶄箣锟?
                    inventory[resourceKey] = Math.floor(dynamicTarget * (0.8 + Math.random() * 0.4));
                }
            });
        }

        // 鍒濆鍖栬储瀵岋細搴旂敤缂╂斁鍥犲瓙
        const baseWealth = nation.wealth ?? 800;
        const wealth = Math.floor(baseWealth * wealthScale);
        const budget = Math.floor(wealth * calculateAITreasuryTargetRatio({
            wealth,
            population: nation.population || 100,
            epoch: appearEpoch,
            isAtWar: false,
            aggression: nation.aggression || 0.3,
            capacityUsage: 0.55,
            developmentRate: nation.economyTraits?.developmentRate || 1.0,
        }));
        
        const wealthRating = Math.max(0.4, wealth / 800);
        const baseVolatility = typeof nation.marketVolatility === 'number'
            ? Math.min(0.9, Math.max(0.1, nation.marketVolatility))
            : 0.3;
        const populationLean = nation.culturalTraits?.agriculturalFocus ? 1.15 : 1;
        const populationFactor = Math.min(2.5, Math.max(0.6, wealthRating * populationLean));
        const wealthFactor = Math.min(
            3.5,
            Math.max(
                0.5,
                wealthRating * (1 + Math.max(0, appearEpoch) * 0.05)
            )
        );

        // 鍒濆鍖栧熀纭€浜哄彛锛氬簲鐢ㄧ缉鏀惧洜锟?
        const basePopulation = Math.floor((1000 + Math.floor(Math.random() * 500)) * populationScale); // 搴旂敤缂╂斁
        const vassalStatus = {
            vassalOf: Object.prototype.hasOwnProperty.call(nation, 'vassalOf')
                ? nation.vassalOf
                : DEFAULT_VASSAL_STATUS.vassalOf,
            vassalType: Object.prototype.hasOwnProperty.call(nation, 'vassalType')
                ? nation.vassalType
                : DEFAULT_VASSAL_STATUS.vassalType,
            tributeRate: Number.isFinite(nation.tributeRate)
                ? nation.tributeRate
                : DEFAULT_VASSAL_STATUS.tributeRate,
            independencePressure: Number.isFinite(nation.independencePressure)
                ? nation.independencePressure
                : DEFAULT_VASSAL_STATUS.independencePressure,
        };

        return {
            ...nation,
            relation: 50,
            // 娓愯繘寮忓彂鐜帮細鍒濆鏃朵唬鍥藉榛樿宸插彂鐜帮紝鍏朵綑寰呭彂鐜?            discovered: appearEpoch <= currentEpoch,
            treaties: Array.isArray(nation.treaties) ? nation.treaties : [],
            openMarketUntil: nation.openMarketUntil ?? null,
            peaceTreatyUntil: nation.peaceTreatyUntil ?? null,
            ...vassalStatus,
            organizationMemberships: Array.isArray(nation.organizationMemberships)
                ? nation.organizationMemberships
                : [],
            overseasAssets: Array.isArray(nation.overseasAssets) ? nation.overseasAssets : [],
            warScore: nation.warScore ?? 0,
            isAtWar: nation.isAtWar ?? false,
            wealth,
            budget,
            inventory,
            enemyLosses: 0,
            warDuration: 0,
            warStartDay: null,
            lastLootDay: null,
            militaryStrength: 1.0, // 鍒濆鍐涗簨瀹炲姏涓烘弧锟?
            population: basePopulation, // 鍒濆浜哄彛
            wealthTemplate: wealth,
            foreignPower: {
                baseRating: wealthRating,
                volatility: baseVolatility,
                appearEpoch,
                populationFactor,
                wealthFactor,
            },
            economyTraits: {
                ...nation.economyTraits,
                baseWealth: wealth, // 淇濆瓨鍩虹璐㈠瘜鐢ㄤ簬鎭㈠
                basePopulation, // 淇濆瓨鍩虹浜哄彛鐢ㄤ簬鎭㈠
            },
        };
    });
};

const buildScenarioPopulation = (scenarioOverrides) => {
    if (!scenarioOverrides?.popStructure) return null;
    const total = Object.values(scenarioOverrides.popStructure)
        .reduce((sum, value) => sum + (Number(value) || 0), 0);
    return total || null;
};

/**
 * 娓告垙鐘舵€佺鐞嗛挬锟?
 * 闆嗕腑绠＄悊鎵€鏈夋父鎴忕姸锟?
 * @returns {Object} 鍖呭惈鎵€鏈夌姸鎬佸拰鐘舵€佹洿鏂板嚱鏁扮殑瀵硅薄
 */
export const useGameState = () => {
    // ========== 鍩虹璧勬簮鐘讹拷?==========
    const [resources, setResourcesState] = useState(INITIAL_RESOURCES);

    // ========== 浜哄彛涓庣ぞ浼氱姸锟?==========
    const [population, setPopulation] = useState(5);
    const [popStructure, setPopStructure] = useState({});
    const [maxPop, setMaxPop] = useState(10);
    const [birthAccumulator, setBirthAccumulator] = useState(0);
    // 棰濆浜哄彛涓婇檺鍔犳垚锛堝閫氳繃鍓插湴鑾峰緱锛夛紝涓嶄細琚瘡鏃ユā鎷熻锟?
    const [maxPopBonus, setMaxPopBonus] = useState(0);

    // ========== 寤虹瓚涓庣鎶€鐘讹拷?==========
    const [buildings, setBuildings] = useState({});
    const [buildingUpgrades, setBuildingUpgrades] = useState({}); // 寤虹瓚鍗囩骇绛夌骇 { buildingId: { level: count } } - 姣忎釜绛夌骇鐨勫缓绛戞暟锟?
    const [techsUnlocked, setTechsUnlocked] = useState([]);
    const [epoch, setEpoch] = useState(0);

    // ========== 鐞嗗康绯荤粺鐘舵€?==========
    // ========== 鐞嗗康绯荤粺锛坓rouped: 10 useState 鈫?1 useReducer锛?==========
    const { values: _ideologyState, setters: _ideologySetters, resetAll: _resetIdeologyState } = useGroupedState({
        ideologyScore: 0,
        ideologyScoreSpent: 0,
        ideologyCollection: [], // [{ id, level }]
        equippedIdeologies: [], // string[]
        ideologySlotCount: 3,
        ideologyCooldowns: {}, // { [id]: days }
        ideologyMilestones: [], // string[]
        pendingIdeologyEmergence: null, // null | { candidates }
        ideologyEmergenceRarityBonus: 0, // 璺宠繃绱Н鐨勭█鏈夊害鍔犳垚锛?~3锛?        lastEmergenceWasSkipped: false, // 涓婃娑岀幇鏄惁鏄烦杩囷紙鐢ㄤ簬鍒ゆ柇鍔犳垚鏄惁鐣欏瓨锛?    });
    const ideologyScore = _ideologyState.ideologyScore;
    const setIdeologyScore = _ideologySetters.setIdeologyScore;
    const ideologyScoreSpent = _ideologyState.ideologyScoreSpent;
    const setIdeologyScoreSpent = _ideologySetters.setIdeologyScoreSpent;
    const ideologyCollection = _ideologyState.ideologyCollection;
    const setIdeologyCollection = _ideologySetters.setIdeologyCollection;
    const equippedIdeologies = _ideologyState.equippedIdeologies;
    const setEquippedIdeologies = _ideologySetters.setEquippedIdeologies;
    const ideologySlotCount = _ideologyState.ideologySlotCount;
    const setIdeologySlotCount = _ideologySetters.setIdeologySlotCount;
    const ideologyCooldowns = _ideologyState.ideologyCooldowns;
    const setIdeologyCooldowns = _ideologySetters.setIdeologyCooldowns;
    const ideologyMilestones = _ideologyState.ideologyMilestones;
    const setIdeologyMilestones = _ideologySetters.setIdeologyMilestones;
    const pendingIdeologyEmergence = _ideologyState.pendingIdeologyEmergence;
    const setPendingIdeologyEmergence = _ideologySetters.setPendingIdeologyEmergence;
    const ideologyEmergenceRarityBonus = _ideologyState.ideologyEmergenceRarityBonus;
    const setIdeologyEmergenceRarityBonus = _ideologySetters.setIdeologyEmergenceRarityBonus;
    const lastEmergenceWasSkipped = _ideologyState.lastEmergenceWasSkipped;
    const setLastEmergenceWasSkipped = _ideologySetters.setLastEmergenceWasSkipped;

    // ========== 娓告垙鎺у埗鐘舵€侊紙grouped: 12 useState 鈫?1 useReducer锛?==========
    const { values: _gameControlState, setters: _gameControlSetters, resetAll: _resetGameControlState } = useGroupedState({
        activeTab: 'overview',
        gameSpeed: 1,
        isPaused: false,
        pausedBeforeEvent: false, // 浜嬩欢瑙﹀彂鍓嶇殑鏆傚仠鐘舵€?        autoSaveInterval: 60, // 鑷姩瀛樻。闂撮殧锛堢锛?        isAutoSaveEnabled: true, // 鑷姩瀛樻。寮€鍏?        lastAutoSaveTime: Date.now(), // 涓婃鑷姩瀛樻。鏃堕棿
        autoSaveBlocked: false, // 鑷姩瀛樻。鍥犻厤棰濊绂佺敤
        isSaving: false, // UI淇濆瓨鐘舵€佹寚绀?        difficulty: DEFAULT_DIFFICULTY, // 娓告垙闅惧害
        empireName: '鎴戠殑甯濆浗', // 鍥藉/甯濆浗鍚嶇О
        eventConfirmationEnabled: false, // 浜嬩欢浜屾纭寮€鍏?    });
    const activeTab = _gameControlState.activeTab;
    const setActiveTab = _gameControlSetters.setActiveTab;
    const gameSpeed = _gameControlState.gameSpeed;
    const setGameSpeed = _gameControlSetters.setGameSpeed;
    const isPaused = _gameControlState.isPaused;
    const setIsPaused = _gameControlSetters.setIsPaused;
    const pausedBeforeEvent = _gameControlState.pausedBeforeEvent;
    const setPausedBeforeEvent = _gameControlSetters.setPausedBeforeEvent;
    const autoSaveInterval = _gameControlState.autoSaveInterval;
    const setAutoSaveInterval = _gameControlSetters.setAutoSaveInterval;
    const isAutoSaveEnabled = _gameControlState.isAutoSaveEnabled;
    const setIsAutoSaveEnabled = _gameControlSetters.setIsAutoSaveEnabled;
    const lastAutoSaveTime = _gameControlState.lastAutoSaveTime;
    const setLastAutoSaveTime = _gameControlSetters.setLastAutoSaveTime;
    const autoSaveBlocked = _gameControlState.autoSaveBlocked;
    const setAutoSaveBlocked = _gameControlSetters.setAutoSaveBlocked;
    const isSaving = _gameControlState.isSaving;
    const setIsSaving = _gameControlSetters.setIsSaving;
    const difficulty = _gameControlState.difficulty;
    const setDifficulty = _gameControlSetters.setDifficulty;
    const empireName = _gameControlState.empireName;
    const setEmpireName = _gameControlSetters.setEmpireName;
    const eventConfirmationEnabled = _gameControlState.eventConfirmationEnabled;
    const setEventConfirmationEnabled = _gameControlSetters.setEventConfirmationEnabled;
    const savingIndicatorTimer = useRef(null);
    const autoSaveQuotaNotifiedRef = useRef(false);
    // [PR-3] 鍒嗙墖澧為噺鍐欏叆缂撳瓨锛?    //   缁撴瀯涓?{ [targetKey]: { state: lastJson, nations: lastJson, ... } }
    //   姣忔鎴愬姛 writeShardedSave 鍚庤褰曟瘡鐗囩殑 JSON 瀛楃涓诧紱涓嬫 autoSave
    //   鏃舵妸褰撳墠 shard JSON 鍜屼笂涓€浠藉仛 O(n) 瀛楃涓叉瘮杈冿紝鍙妸鍙樺寲杩囩殑鍒嗙墖鍐欏洖 IDB銆?    //   鎵嬪姩瀛樻。 / 妲戒綅鍒囨崲 / applyLoadedGameState 鍚庝細娓呯┖杩欎釜缂撳瓨浠ュ己鍒跺叏閲忓啓鍏ャ€?    const lastSavedShardJsonsRef = useRef({});

    // ========== Pending Actions Queue锛堢帺瀹舵搷浣滃閲忛槦鍒楋級==========
    // 瑙ｅ喅 tick 瑕嗙洊鐜╁鎿嶄綔鐨勭珵浜夋潯浠讹細
    // buyBuilding/sellBuilding 灏嗗閲忓啓鍏ユ闃熷垪锛宼ick 鍚姩鏃跺悎骞跺埌 simulationParams
    const pendingActionsRef = useRef({
        buildingDeltas: {},   // { [buildingId]: deltaCount } 姝ｆ暟=璐拱锛岃礋鏁?鍑哄敭
        resourceDeltas: {},   // { [resourceId]: deltaAmount } 璐熸暟=娑堣€?    });

    // ========== 鏀夸护涓庡浜ょ姸鎬侊紙grouped: 7 useState 鈫?1 useReducer锛?==========
    const { values: _diplomacyState, setters: _diplomacySetters, resetAll: _resetDiplomacyState } = useGroupedState({
        nations: buildInitialNations(),
        diplomaticReputation: 50, // 鍥介檯澹拌獕 (0-100)
        overseasInvestments: [],    // 鐜╁鍦ㄩ檮搴稿浗鐨勬姇璧?        foreignInvestments: [],
        foreignInvestmentPolicy: 'normal',      // 澶栧浗鍦ㄧ帺瀹跺浗鐨勬姇璧?        foreignInvestmentPolicyOverrides: {},  // 閫愬浗绋庣巼瑕嗙洊
    });
    const nations = _diplomacyState.nations;
    const setNations = _diplomacySetters.setNations;
    const diplomaticReputation = _diplomacyState.diplomaticReputation;
    const setDiplomaticReputation = _diplomacySetters.setDiplomaticReputation;
    const overseasInvestments = _diplomacyState.overseasInvestments;
    const setOverseasInvestments = _diplomacySetters.setOverseasInvestments;
    const foreignInvestments = _diplomacyState.foreignInvestments;
    const setForeignInvestments = _diplomacySetters.setForeignInvestments;
    const foreignInvestmentPolicy = _diplomacyState.foreignInvestmentPolicy;
    const setForeignInvestmentPolicy = _diplomacySetters.setForeignInvestmentPolicy;
    const foreignInvestmentPolicyOverrides = _diplomacyState.foreignInvestmentPolicyOverrides;
    const setForeignInvestmentPolicyOverrides = _diplomacySetters.setForeignInvestmentPolicyOverrides;

    // ========== 瀹樺憳绯荤粺锛坓rouped: 8 useState 鈫?1 useReducer锛?==========
    const { values: _officialState, setters: _officialSetters, resetAll: _resetOfficialState } = useGroupedState({
        officials: [],           // 褰撳墠闆囦剑鐨勫畼鍛?        officialsSimCursor: 0, // 瀹樺憳鍒嗙墖妯℃嫙娓告爣
        officialCandidates: [], // 褰撳墠鍊欓€変汉鍒楄〃
        lastSelectionDay: -999,   // 涓婃涓惧姙閫夋嫈鐨勬椂闂?        officialCapacity: 2,      // 瀹樺憳瀹归噺
        ministerAssignments: buildInitialMinisterAssignments(),
        ministerAutoExpansion: buildInitialMinisterAutoExpansion(),
        lastMinisterExpansionDay: buildInitialMinisterExpansionCooldowns(),
    });
    const officials = _officialState.officials;
    const setOfficials = _officialSetters.setOfficials;
    const officialsSimCursor = _officialState.officialsSimCursor;
    const setOfficialsSimCursor = _officialSetters.setOfficialsSimCursor;
    const officialCandidates = _officialState.officialCandidates;
    const setOfficialCandidates = _officialSetters.setOfficialCandidates;
    const lastSelectionDay = _officialState.lastSelectionDay;
    const setLastSelectionDay = _officialSetters.setLastSelectionDay;
    const officialCapacity = _officialState.officialCapacity;
    const setOfficialCapacity = _officialSetters.setOfficialCapacity;
    // 娉ㄦ剰锛氫骇涓氭斂绛栧凡杩佺Щ涓洪€愬畼鍛樺瓧娈?official.propertyPolicy锛堥粯璁?'private'锛?    const ministerAssignments = _officialState.ministerAssignments;
    const setMinisterAssignments = _officialSetters.setMinisterAssignments;
    const ministerAutoExpansion = _officialState.ministerAutoExpansion;
    const setMinisterAutoExpansion = _officialSetters.setMinisterAutoExpansion;
    const lastMinisterExpansionDay = _officialState.lastMinisterExpansionDay;
    const setLastMinisterExpansionDay = _officialSetters.setLastMinisterExpansionDay;
    // ========== 鍐呴榿鍗忓悓绯荤粺锛坓rouped: 6 useState 鈫?1 useReducer锛?==========
    const { values: _policyState, setters: _policySetters, resetAll: _resetPolicyState } = useGroupedState({
        decrees: [],
        activeDecrees: {},           // 褰撳墠鐢熸晥鐨勪复鏃舵硶浠?        decreeCooldowns: {},       // 娉曚护鍐峰嵈鏃堕棿
        quotaTargets: {},             // 璁″垝缁忔祹闃跺眰閰嶉鐩爣
        expansionSettings: {},   // 鑷敱甯傚満寤虹瓚鎵╁紶璁剧疆
        priceControls: {
            enabled: false,
            governmentBuyPrices: {},
            governmentSellPrices: {},
        },
    });
    const decrees = _policyState.decrees;
    const setDecrees = _policySetters.setDecrees;
    const activeDecrees = _policyState.activeDecrees;
    const setActiveDecrees = _policySetters.setActiveDecrees;
    const decreeCooldowns = _policyState.decreeCooldowns;
    const setDecreeCooldowns = _policySetters.setDecreeCooldowns;
    const setDecreCooldowns = setDecreeCooldowns; // 鍏煎鏃ф嫾鍐欒皟鐢?    const quotaTargets = _policyState.quotaTargets;
    const setQuotaTargets = _policySetters.setQuotaTargets;
    const expansionSettings = _policyState.expansionSettings;
    const setExpansionSettings = _policySetters.setExpansionSettings;
    const priceControls = _policyState.priceControls;
    const setPriceControls = _policySetters.setPriceControls;


    // ========== 绀句細闃跺眰锛坓rouped: 18 useState 鈫?1 useReducer, classWealth kept separate for custom setter锛?==========
    const { values: _socialState, setters: _socialSetters, resetAll: _resetSocialState } = useGroupedState({
        classApproval: {},
        approvalBreakdown: {}, // [NEW] 鍚勯樁灞傛弧鎰忓害鍒嗚В鏁版嵁
        classInfluence: {},
        classWealthDelta: {},
        classIncome: {},
        classExpense: {},
        classFinancialData: {}, // Detailed financial breakdown
        buildingFinancialData: {}, // Per-building realized financial stats
        stateBuildingSilverOutput: 0,
        totalInfluence: 0,
        totalWealth: 0,
        activeBuffs: [],
        activeDebuffs: [],
        classInfluenceShift: {},
        classShortages: {},
        classLivingStandard: {}, // 鍚勯樁灞傜敓娲绘按骞虫暟鎹?        livingStandardStreaks: buildInitialLivingStandardStreaks(),
        migrationCooldowns: {}, // 闃跺眰杩佺Щ鍐峰嵈鐘舵€?{ roleKey: ticksRemaining }
        taxShock: {}, // [NEW] 鍚勯樁灞傜疮绉◣鏀跺啿鍑诲€?{ roleKey: number }
    });
    const classApproval = _socialState.classApproval;
    const setClassApproval = _socialSetters.setClassApproval;
    const approvalBreakdown = _socialState.approvalBreakdown;
    const setApprovalBreakdown = _socialSetters.setApprovalBreakdown;
    const classInfluence = _socialState.classInfluence;
    const setClassInfluence = _socialSetters.setClassInfluence;
    const [classWealth, setClassWealthState] = useState(buildInitialWealth());
    const classWealthDelta = _socialState.classWealthDelta;
    const setClassWealthDelta = _socialSetters.setClassWealthDelta;
    const classIncome = _socialState.classIncome;
    const setClassIncome = _socialSetters.setClassIncome;
    const classExpense = _socialState.classExpense;
    const setClassExpense = _socialSetters.setClassExpense;
    const classFinancialData = _socialState.classFinancialData;
    const setClassFinancialData = _socialSetters.setClassFinancialData;
    const buildingFinancialData = _socialState.buildingFinancialData;
    const setBuildingFinancialData = _socialSetters.setBuildingFinancialData;
    const stateBuildingSilverOutput = _socialState.stateBuildingSilverOutput;
    const setStateBuildingSilverOutput = _socialSetters.setStateBuildingSilverOutput;
    const totalInfluence = _socialState.totalInfluence;
    const setTotalInfluence = _socialSetters.setTotalInfluence;
    const totalWealth = _socialState.totalWealth;
    const setTotalWealth = _socialSetters.setTotalWealth;
    const activeBuffs = _socialState.activeBuffs;
    const setActiveBuffs = _socialSetters.setActiveBuffs;
    const activeDebuffs = _socialState.activeDebuffs;
    const setActiveDebuffs = _socialSetters.setActiveDebuffs;
    const classInfluenceShift = _socialState.classInfluenceShift;
    const setClassInfluenceShift = _socialSetters.setClassInfluenceShift;
    const classShortages = _socialState.classShortages;
    const setClassShortages = _socialSetters.setClassShortages;
    const classLivingStandard = _socialState.classLivingStandard;
    const setClassLivingStandard = _socialSetters.setClassLivingStandard;
    const livingStandardStreaks = _socialState.livingStandardStreaks;
    const setLivingStandardStreaks = _socialSetters.setLivingStandardStreaks;
    const migrationCooldowns = _socialState.migrationCooldowns;
    const setMigrationCooldowns = _socialSetters.setMigrationCooldowns;
    const taxShock = _socialState.taxShock;
    const setTaxShock = _socialSetters.setTaxShock;
    // Kept as independent useState (high-frequency or special handling)
    const [classWealthHistory, setClassWealthHistory] = useState(buildInitialWealthHistory());
    const [classNeedsHistory, setClassNeedsHistory] = useState(buildInitialNeedsHistory());
    const [stability, setStability] = useState(50);
    const [stratumDetailView, setStratumDetailView] = useState(null);
    const [resourceDetailView, setResourceDetailView] = useState(null);
    const [populationDetailView, setPopulationDetailView] = useState(false);
    const [history, setHistory] = useState(buildInitialHistory());
    
    // ========== 缁忔祹鎸囨爣涓庤储鏀匡紙grouped: 7 useState 鈫?1 useReducer锛?==========
    const { values: _economicState, setters: _economicSetters, resetAll: _resetEconomicState } = useGroupedState({
        priceHistory: {}, // 浠锋牸鍘嗗彶锛堟渶杩?5澶╋級
        equilibriumPrices: {}, // 闀挎湡鍧囪　浠锋牸锛?0澶╂粴鍔ㄥ钩鍧囷級
        economicIndicators: {
            gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
            cpi: { index: 100, change: 0, breakdown: {} },
            ppi: { index: 100, change: 0, breakdown: {} },
        },
        eventEffectSettings: DEFAULT_EVENT_EFFECT_SETTINGS,
        activeEventEffects: buildInitialEventEffects(),
        fiscalActual: {
            silverDelta: 0,
            officialSalaryPaid: 0,
            forcedSubsidyPaid: 0,
            forcedSubsidyUnpaid: 0,
        },
        treasuryChangeLog: [],
        dailyMilitaryExpense: null,
    });
    const priceHistory = _economicState.priceHistory;
    const setPriceHistory = _economicSetters.setPriceHistory;
    const equilibriumPrices = _economicState.equilibriumPrices;
    const setEquilibriumPrices = _economicSetters.setEquilibriumPrices;
    const economicIndicators = _economicState.economicIndicators;
    const setEconomicIndicators = _economicSetters.setEconomicIndicators;
    const eventEffectSettings = _economicState.eventEffectSettings;
    const setEventEffectSettings = _economicSetters.setEventEffectSettings;
    const activeEventEffects = _economicState.activeEventEffects;
    const setActiveEventEffects = _economicSetters.setActiveEventEffects;
    const fiscalActual = _economicState.fiscalActual;
    const setFiscalActual = _economicSetters.setFiscalActual;
    const treasuryChangeLog = _economicState.treasuryChangeLog;
    const setTreasuryChangeLog = _economicSetters.setTreasuryChangeLog;
    const dailyMilitaryExpense = _economicState.dailyMilitaryExpense;
    const setDailyMilitaryExpense = _economicSetters.setDailyMilitaryExpense;

    // ========== 鏃堕棿鐘讹拷?==========
    const [daysElapsed, setDaysElapsed] = useState(0);

    // [PERF] 鎵归噺杩藉姞 treasury 鏃ュ織锛屽噺灏?setState 璋冪敤娆℃暟
    const appendTreasuryChangeLogBatch = (batch) => {
        if (!Array.isArray(batch) || batch.length === 0) return;
        setTreasuryChangeLog(prev => [...prev, ...batch].slice(-300));
    };

    const appendTreasuryChangeLog = (entry) => {
        setTreasuryChangeLog(prev => [...prev, entry].slice(-300));
    };

    const setResources = (updater, options = {}) => {
        const {
            reason = 'unknown',
            meta = null,
            audit = true,
            auditEntries = null,
            auditStartingSilver = null,
            _diag = null,
        } = options || {};
        setResourcesState(prev => {
            const before = Number(prev?.silver || 0);
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next || typeof next !== 'object') return prev;
            const after = Number(next?.silver || 0);
            const logDay = Number.isFinite(meta?.day) ? meta.day : daysElapsed;
            const metaSource = meta && typeof meta === 'object' ? meta.source : undefined;
            if (audit) {
                const batch = [];
                const entries = Array.isArray(auditEntries) ? auditEntries : [];
                if (entries.length > 0 && Number.isFinite(after)) {
                    let running = Number.isFinite(auditStartingSilver) ? auditStartingSilver : before;
                    let entryTotal = 0;
                    const timestamp = Date.now();
                    entries.forEach((entry) => {
                        const amount = Number(entry?.amount || 0);
                        if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) return;
                        const entryBefore = running;
                        const entryAfter = entryBefore + amount;
                        batch.push({
                            timestamp,
                            day: logDay,
                            amount,
                            before: entryBefore,
                            after: entryAfter,
                            reason: entry?.reason || reason,
                            meta: entry?.meta ?? meta,
                        });
                        running = entryAfter;
                        entryTotal += amount;
                    });
                    // [FIX] entryTotal 浠?auditStartingSilver 涓哄熀绾匡紙妯℃嫙瀹為檯璧风偣锛夛紝
                    // 鑰?(after - before) 浠?prev.silver 涓哄熀绾匡紙React 鐘舵€侊級銆?                    // 褰撳瓨鍦?pending delta 鎴?tick 閲嶅彔鏃讹紝涓や釜鍩虹嚎鍙兘涓嶅悓銆?                    // 浣跨敤 auditStartingSilver 浣滀负 effectiveBefore 缁熶竴鍩虹嚎銆?                    const lateActionDelta = _diag ? (before - (_diag.mergedSilver || before)) : 0;
                    const effectiveBefore = Number.isFinite(auditStartingSilver) ? auditStartingSilver : before;
                    const residual = (after - effectiveBefore) - entryTotal - lateActionDelta;
                    if (Number.isFinite(residual) && Math.abs(residual) > 0.01) {
                        batch.push({
                            timestamp: Date.now(),
                            day: logDay,
                            amount: residual,
                            before: running,
                            after: running + residual,
                            reason: 'untracked_delta',
                            meta: metaSource ? { reason, meta, source: metaSource } : { reason, meta },
                        });
                    }
                } else if (Number.isFinite(after) && after !== before) {
                    batch.push({
                        timestamp: Date.now(),
                        day: logDay,
                        amount: after - before,
                        before,
                        after,
                        reason,
                        meta,
                    });
                }
                if (batch.length > 0) {
                    appendTreasuryChangeLogBatch(batch);
                }
            }
            return next;
        });
    };

    const setClassWealth = (updater, options = {}) => {
        setClassWealthState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next || typeof next !== 'object') return prev;
            return next;
        });
    };

    // ========== 鍐涗簨绯荤粺锛坓rouped: 16 useState 鈫?1 useReducer锛?==========
    const { values: _militaryState, setters: _militarySetters, resetAll: _resetMilitaryState } = useGroupedState({
        army: {},
        militaryQueue: [],
        selectedTarget: null,
        battleResult: null,
        battleNotifications: [], // 鎴樻枟閫氱煡闃熷垪
        militaryWageRatio: 1.5,
        autoRecruitEnabled: false,  // 鑷姩琛ュ叺寮€鍏?        targetArmyComposition: {},  // 鐩爣鍐涢槦缂栧埗
        lastBattleTargetId: null, // 涓婃鏀诲嚮鐨勭洰鏍嘔D
        lastBattleDay: -999, // 涓婃鏀诲嚮鐨勬椂闂?        militaryCorps: [], // 鍐涘洟鍒楄〃
        generals: [], // 灏嗛鍒楄〃
        activeFronts: [], // 娲昏穬鎴樼嚎
        activeBattles: [], // 杩涜涓殑鎴樻枟
        pendingRepairs: [], // 鎴樺悗寰呬慨澶嶅缓绛慬{ buildingId, count, source }]
        corpsReplenishQueue: {}, // 鍐涘洟琛ュ叺缂洪闃熷垪 { [corpsId]: { [unitId]: deficitCount } }
    });
    const army = _militaryState.army;
    const setArmy = _militarySetters.setArmy;
    const militaryQueue = _militaryState.militaryQueue;
    const setMilitaryQueue = _militarySetters.setMilitaryQueue;
    const selectedTarget = _militaryState.selectedTarget;
    const setSelectedTarget = _militarySetters.setSelectedTarget;
    const battleResult = _militaryState.battleResult;
    const setBattleResult = _militarySetters.setBattleResult;
    const battleNotifications = _militaryState.battleNotifications;
    const setBattleNotifications = _militarySetters.setBattleNotifications;
    const militaryWageRatio = _militaryState.militaryWageRatio;
    const setMilitaryWageRatio = _militarySetters.setMilitaryWageRatio;
    const autoRecruitEnabled = _militaryState.autoRecruitEnabled;
    const setAutoRecruitEnabled = _militarySetters.setAutoRecruitEnabled;
    const targetArmyComposition = _militaryState.targetArmyComposition;
    const setTargetArmyComposition = _militarySetters.setTargetArmyComposition;
    const lastBattleTargetId = _militaryState.lastBattleTargetId;
    const setLastBattleTargetId = _militarySetters.setLastBattleTargetId;
    const lastBattleDay = _militaryState.lastBattleDay;
    const setLastBattleDay = _militarySetters.setLastBattleDay;
    const militaryCorps = _militaryState.militaryCorps;
    const setMilitaryCorps = _militarySetters.setMilitaryCorps;
    const generals = _militaryState.generals;
    const setGenerals = _militarySetters.setGenerals;
    const activeFronts = _militaryState.activeFronts;
    const setActiveFronts = _militarySetters.setActiveFronts;
    const activeBattles = _militaryState.activeBattles;
    const setActiveBattles = _militarySetters.setActiveBattles;
    const pendingRepairs = _militaryState.pendingRepairs;
    const setPendingRepairs = _militarySetters.setPendingRepairs;
    const corpsReplenishQueue = _militaryState.corpsReplenishQueue;
    const setCorpsReplenishQueue = _militarySetters.setCorpsReplenishQueue;

    // ========== Annual report system (grouped: 5 useState 鈫?1 useReducer) ==========
    const { values: _annualState, setters: _annualSetters, resetAll: _resetAnnualState } = useGroupedState({
        festivalModal: null, // { reportData, year }
        annualReportBaseline: null, // Year-start baseline snapshot
        annualReportAccumulator: createAnnualReportAccumulator(), // 褰撳墠骞村害绱鍣?        lastFestivalYear: 1, // Last report year (starts at 1 to avoid year-1 trigger)
        annualReportHistory: [], // Historical reports: [{ year, epoch, reportData }]
    });
    const festivalModal = _annualState.festivalModal;
    const setFestivalModal = _annualSetters.setFestivalModal;
    const annualReportBaseline = _annualState.annualReportBaseline;
    const setAnnualReportBaseline = _annualSetters.setAnnualReportBaseline;
    const annualReportAccumulator = _annualState.annualReportAccumulator;
    const setAnnualReportAccumulator = _annualSetters.setAnnualReportAccumulator;
    const lastFestivalYear = _annualState.lastFestivalYear;
    const setLastFestivalYear = _annualSetters.setLastFestivalYear;
    const annualReportHistory = _annualState.annualReportHistory;
    const setAnnualReportHistory = _annualSetters.setAnnualReportHistory;
    // ========== 璐告槗涓庡浜ょ粍缁囷紙grouped: 6 useState 鈫?1 useReducer锛?==========
    const { values: _tradeState, setters: _tradeSetters, resetAll: _resetTradeState } = useGroupedState({
        merchantState: buildInitialMerchantState(), // 鍟嗕汉浜ゆ槗鐘舵€?        tradeStats: { tradeTax: 0 }, // 姣忔棩璐告槗绋庢敹
        diplomacyOrganizations: buildInitialDiplomacyOrganizations(),
        vassalDiplomacyQueue: [],
        vassalDiplomacyHistory: [],
        overseasBuildings: buildInitialOverseasBuildings(),
    });
    const merchantState = _tradeState.merchantState;
    const setMerchantState = _tradeSetters.setMerchantState;
    const tradeStats = _tradeState.tradeStats;
    const setTradeStats = _tradeSetters.setTradeStats;
    const diplomacyOrganizations = _tradeState.diplomacyOrganizations;
    const setDiplomacyOrganizations = _tradeSetters.setDiplomacyOrganizations;
    const vassalDiplomacyQueue = _tradeState.vassalDiplomacyQueue;
    const setVassalDiplomacyQueue = _tradeSetters.setVassalDiplomacyQueue;
    const vassalDiplomacyHistory = _tradeState.vassalDiplomacyHistory;
    const setVassalDiplomacyHistory = _tradeSetters.setVassalDiplomacyHistory;
    const overseasBuildings = _tradeState.overseasBuildings;
    const setOverseasBuildings = _tradeSetters.setOverseasBuildings;

    // ========== 绛栫暐琛屽姩涓庝簨浠讹紙grouped: 8 useState 鈫?1 useReducer锛?==========
    const { values: _eventActionState, setters: _eventActionSetters, resetAll: _resetEventActionState } = useGroupedState({
        actionCooldowns: {},
        actionUsage: {},
        promiseTasks: [],
        playerInstallmentPayment: null, // 鐜╁鐨勫垎鏈熸敮浠樺崗璁?        rebellionStates: {},
        rulingCoalition: ['peasant'], // 鑱旂洘鎴愬憳闃跺眰閿暟缁?        legitimacy: 0, // 鍚堟硶鎬у€?0-100)
        modifiers: {},
    });
    const actionCooldowns = _eventActionState.actionCooldowns;
    const setActionCooldowns = _eventActionSetters.setActionCooldowns;
    const actionUsage = _eventActionState.actionUsage;
    const setActionUsage = _eventActionSetters.setActionUsage;
    const promiseTasks = _eventActionState.promiseTasks;
    const setPromiseTasks = _eventActionSetters.setPromiseTasks;
    const playerInstallmentPayment = _eventActionState.playerInstallmentPayment;
    const setPlayerInstallmentPayment = _eventActionSetters.setPlayerInstallmentPayment;
    const rebellionStates = _eventActionState.rebellionStates;
    const setRebellionStates = _eventActionSetters.setRebellionStates;
    const rulingCoalition = _eventActionState.rulingCoalition;
    const setRulingCoalition = _eventActionSetters.setRulingCoalition;
    const legitimacy = _eventActionState.legitimacy;
    const setLegitimacy = _eventActionSetters.setLegitimacy;
    const modifiers = _eventActionState.modifiers;
    const setModifiers = _eventActionSetters.setModifiers;

    // ========== 鏁欑▼绯荤粺鐘讹拷?==========
    const [showTutorial, setShowTutorial] = useState(() => {
        // 妫€鏌ユ槸鍚﹀凡瀹屾垚鏁欑▼
        const completed = localStorage.getItem('tutorial_completed');
        return !completed; // 濡傛灉娌℃湁璁板綍锛屽垯鏄剧ず鏁欑▼
    });

    // ========== 浜嬩欢绯荤粺鐘讹拷?==========
    const [currentEvent, setCurrentEvent] = useState(null); // 褰撳墠鏄剧ず鐨勪簨锟?
    const [eventHistory, setEventHistory] = useState([]); // 浜嬩欢鍘嗗彶璁板綍

    // ========== 鎴愬氨绯荤粺鐘讹拷?==========
    const [unlockedAchievements, setUnlockedAchievements] = useState(loadAchievementsFromStorage);
    const [achievementNotifications, setAchievementNotifications] = useState([]);
    const [achievementProgress, setAchievementProgress] = useState(loadAchievementProgressFromStorage);

    // ========== UI鐘讹拷?==========
    const [logs, setLogs] = useState(["娆㈣繋鏉ュ埌绗?1 澶╋紝鎮ㄧ殑鏂囨槑鍒氬垰璧锋锛?]);
    const [clicks, setClicks] = useState([]);
    const [rates, setRates] = useState({});
    const [taxes, setTaxes] = useState({
        total: 0,
        breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
        efficiency: 1,
    });
    const [taxPolicies, setTaxPolicies] = useState({
        headTaxRates: buildDefaultHeadTaxRates(),
        resourceTaxRates: buildDefaultResourceTaxRates(),
        businessTaxRates: buildDefaultBusinessTaxRates(),
        exportTariffMultipliers: {},
        importTariffMultipliers: {},
        resourceTariffMultipliers: {},
        _headTaxVersion: 3,
    });
    const [jobFill, setJobFill] = useState({});
    const [jobsAvailable, setJobsAvailable] = useState({}); // 鍚勯樁灞傚彲鐢ㄥ矖浣嶆暟锟?
    const [buildingJobsRequired, setBuildingJobsRequired] = useState({}); // 姣忎釜寤虹瓚鐨勫疄闄呭矖浣嶉渶锟?
    const [market, setMarket] = useState(buildInitialMarket());

    useEffect(() => {
        return () => {
            if (savingIndicatorTimer.current) {
                clearTimeout(savingIndicatorTimer.current);
            }
        };
    }, []);

    const addLogEntry = (message) => {
        setLogs(prev => [message, ...prev].slice(0, 8));
    };

    const applyScenarioConfig = (scenarioId) => {
        if (!scenarioId) return;
        const scenario = getScenarioById(scenarioId);
        if (!scenario) return;

        const overrides = scenario.overrides || {};

        if (overrides.resources) {
            setResources(
                { ...INITIAL_RESOURCES, ...overrides.resources },
                { reason: 'scenario_override', meta: { scenarioId } }
            );
        }

        // Default starting buildings: 1 farm + 1 lumber camp + 1 loom house
        // This gives the player a basic food/wood/cloth supply at game start.
        const defaultStartingBuildings = { farm: 1, lumber_camp: 1, loom_house: 1 };

        if (overrides.buildings) {
            // Merge to ensure defaults exist unless explicitly overridden
            setBuildings({ ...defaultStartingBuildings, ...overrides.buildings });
        } else {
            setBuildings(defaultStartingBuildings);
        }

        if (overrides.buildingUpgrades) {
            setBuildingUpgrades(overrides.buildingUpgrades);
        }

        if (overrides.techsUnlocked) {
            setTechsUnlocked(overrides.techsUnlocked);
        }

        if (typeof overrides.epoch === 'number') {
            setEpoch(overrides.epoch);
        }

        if (overrides.classApproval) {
            setClassApproval(overrides.classApproval);
        }

        if (overrides.classInfluence) {
            setClassInfluence(overrides.classInfluence);
        }

        if (overrides.classWealth) {
            setClassWealth(
                { ...buildInitialWealth(), ...overrides.classWealth },
                { reason: 'scenario_override', meta: { scenarioId } }
            );
        }

        if (typeof overrides.stability === 'number') {
            setStability(overrides.stability);
        }

        if (overrides.rulingCoalition) {
            setRulingCoalition(overrides.rulingCoalition);
        }

        if (typeof overrides.maxPopBonus === 'number') {
            setMaxPopBonus(overrides.maxPopBonus);
        }

        if (overrides.popStructure) {
            setPopStructure(overrides.popStructure);
        }

        const scenarioPopulation = buildScenarioPopulation(overrides);
        const targetPopulation = typeof overrides.population === 'number'
            ? overrides.population
            : scenarioPopulation;

        if (typeof targetPopulation === 'number') {
            setPopulation(targetPopulation);
            const nextMaxPop = typeof overrides.maxPop === 'number'
                ? Math.max(overrides.maxPop, targetPopulation)
                : Math.max(10, targetPopulation);
            setMaxPop(nextMaxPop);
        } else if (typeof overrides.maxPop === 'number') {
            setMaxPop(overrides.maxPop);
        }

        // ========== 鏂板閰嶇疆椤规敮锟?==========

        // 澶栦氦鍏崇郴閰嶇疆
        if (overrides.nationRelations) {
            setNations(prev => prev.map(n => ({
                ...n,
                relation: typeof overrides.nationRelations[n.id] === 'number'
                    ? overrides.nationRelations[n.id]
                    : n.relation
            })));
        }

        // 鍒濆鍐涢槦閰嶇疆
        if (overrides.army) {
            setArmy(overrides.army);
        }

        // 甯傚満浠锋牸閰嶇疆
        if (overrides.marketPrices) {
            setMarket(prev => ({
                ...prev,
                prices: { ...prev.prices, ...overrides.marketPrices }
            }));
        }

        // 鍚堟硶鎬ч厤锟?
        if (typeof overrides.legitimacy === 'number') {
            setLegitimacy(overrides.legitimacy);
        }

        // 绋庢敹鏀跨瓥閰嶇疆
        if (overrides.taxPolicies) {
            setTaxPolicies(prev => ({
                ...prev,
                ...overrides.taxPolicies
            }));
        }
    };

    // Auto-load the most recent save on startup
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        try {
            // 妫€鏌ユ槸鍚︽槸鏂版父鎴忔ā寮忥紙锟?鍙﹀紑鏂版。"杩涘叆锟?
            const startNewGame = localStorage.getItem('start_new_game');
            if (startNewGame === 'true') {
                localStorage.removeItem('start_new_game');
                const newGameDifficulty = localStorage.getItem('new_game_difficulty');
                let difficultyForNewGame = DEFAULT_DIFFICULTY;
                if (newGameDifficulty) {
                    console.log(`[DEBUG] Initializing New Game with Difficulty: ${newGameDifficulty}`);
                    difficultyForNewGame = newGameDifficulty;
                    setDifficulty(newGameDifficulty);
                    localStorage.removeItem('new_game_difficulty');
                }
                // 璇诲彇骞惰缃笣鍥藉悕锟?
                const newGameEmpireName = localStorage.getItem('new_game_empire_name');
                if (newGameEmpireName) {
                    setEmpireName(newGameEmpireName);
                    localStorage.removeItem('new_game_empire_name');
                }
                const newGameScenario = localStorage.getItem('new_game_scenario');
                if (newGameScenario) {
                    applyScenarioConfig(newGameScenario);
                    localStorage.removeItem('new_game_scenario');
                } else {
                    // Standard Game: Apply difficulty-based initial buildings
                    const initialBuildings = getInitialBuildings(difficultyForNewGame);
                    setBuildings(initialBuildings);
                }

                // Difficulty-based starting treasury boost
                const startingSilverMultiplier = getStartingSilverMultiplier(difficultyForNewGame);
                if (startingSilverMultiplier !== 1.0) {
                    setResources(
                        prev => ({
                            ...prev,
                            silver: Math.floor((prev?.silver ?? INITIAL_RESOURCES.silver) * startingSilverMultiplier),
                        }),
                        { reason: 'difficulty_starting_silver' }
                    );
                }

                // 璺宠繃鑷姩鍔犺浇锛屽紑濮嬫柊娓告垙
                trackNewGame(difficultyForNewGame);
                return;
            }

            // 鏀堕泦鎵€鏈夊瓨妗ｇ殑鏃堕棿锟?
            const saves = [];

            // 妫€鏌ユ墜鍔ㄥ瓨妗ｆЫ锟?
            for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
                const key = `${SAVE_SLOT_PREFIX}${i}`;
                const raw = localStorage.getItem(key);
                if (raw) {
                    try {
                        const data = JSON.parse(raw);
                        if (data.updatedAt) {
                            saves.push({ slotIndex: i, updatedAt: data.updatedAt, source: 'manual' });
                        }
                    } catch (e) {
                        console.warn(`Failed to parse slot ${i}:`, e);
                    }
                }
            }

            // 妫€鏌ヨ嚜鍔ㄥ瓨锟?
            const autoRaw = localStorage.getItem(AUTOSAVE_KEY);
            if (autoRaw) {
                try {
                    const autoData = JSON.parse(autoRaw);
                    if (autoData.updatedAt) {
                        saves.push({ slotIndex: -1, updatedAt: autoData.updatedAt, source: 'auto' });
                    }
                } catch (e) {
                    console.warn('Failed to parse auto-save:', e);
                }
            }

            // 妫€鏌ユ棫鐗堝瓨妗ｅ苟杩佺Щ鍒版Ы锟?
            const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
            if (legacyRaw && saves.filter(s => s.source === 'manual').length === 0) {
                try {
                    // 杩佺Щ鏃у瓨妗ｅ埌妲戒綅0
                    localStorage.setItem(`${SAVE_SLOT_PREFIX}0`, legacyRaw);
                    localStorage.removeItem(LEGACY_SAVE_KEY);
                    const legacyData = JSON.parse(legacyRaw);
                    if (legacyData.updatedAt) {
                        saves.push({ slotIndex: 0, updatedAt: legacyData.updatedAt, source: 'manual' });
                    }
                    console.log('Migrated legacy save to slot 0');
                } catch (e) {
                    console.warn('Failed to migrate legacy save:', e);
                }
            }

            if (saves.length === 0) {
                // No saves found, start fresh - check for new game difficulty
                const newGameDifficulty = localStorage.getItem('new_game_difficulty');
                let difficultyForNewGame = DEFAULT_DIFFICULTY;
                if (newGameDifficulty) {
                    difficultyForNewGame = newGameDifficulty;
                    setDifficulty(newGameDifficulty);
                    localStorage.removeItem('new_game_difficulty');
                }
                const newGameScenario = localStorage.getItem('new_game_scenario');
                if (newGameScenario) {
                    applyScenarioConfig(newGameScenario);
                    localStorage.removeItem('new_game_scenario');
                } else {
                    // Standard Game: Apply difficulty-based initial buildings
                    const initialBuildings = getInitialBuildings(difficultyForNewGame);
                    setBuildings(initialBuildings);
                }

                // Difficulty-based starting treasury boost
                const startingSilverMultiplier = getStartingSilverMultiplier(difficultyForNewGame);
                if (startingSilverMultiplier !== 1.0) {
                    setResources(
                        prev => ({
                            ...prev,
                            silver: Math.floor((prev?.silver ?? INITIAL_RESOURCES.silver) * startingSilverMultiplier),
                        }),
                        { reason: 'difficulty_starting_silver' }
                    );
                }

                return;
            }

            // 鎵惧埌鏈€鏂扮殑瀛樻。
            saves.sort((a, b) => b.updatedAt - a.updatedAt);
            const mostRecent = saves[0];

            // Use setTimeout to ensure loadGame has access to addLogEntry
            setTimeout(() => {
                loadGame({ source: mostRecent.source, slotIndex: mostRecent.slotIndex });
            }, 0);
        } catch (error) {
            console.warn('Auto-load failed:', error);
        }
    }, []);

    const triggerSavingIndicator = () => {
        setIsSaving(true);
        if (savingIndicatorTimer.current) {
            clearTimeout(savingIndicatorTimer.current);
        }
        savingIndicatorTimer.current = setTimeout(() => {
            setIsSaving(false);
            savingIndicatorTimer.current = null;
        }, 1000);
    };

    const buildSavePayload = ({ source = 'manual', timestamp = Date.now() } = {}) => {
        const nextLastAuto = source === 'auto' ? timestamp : lastAutoSaveTime;
        // [PR-1] buildSavePayload 鍓旈櫎绾?UI 鎬?/ 涓存椂灞曠ず缁撴瀯锛?        //   - activeTab / stratumDetailView / resourceDetailView / populationDetailView
        //   - selectedTarget / battleResult / festivalModal / currentEvent / showTutorial
        //   - classWealthDelta / classInfluenceShift 锛堝崟 tick 琛嶇敓鍊硷紝涓嬩釜 tick 浼氶噸绠楋級
        // 杩欎簺瀛楁鍦?applyLoadedGameState 閲岄兘宸茬粡鐢?`data.X || default` 鍏滃簳锛岃€佸瓨妗ｄ粛鍙銆?        return {
            payload: {
                saveFormatVersion: SAVE_FORMAT_VERSION,
                resources,
                population,
                popStructure,
                maxPop,
                maxPopBonus,
                birthAccumulator,
                buildings,
                buildingUpgrades,
                techsUnlocked,
                epoch,
                gameSpeed,
                isPaused,
                nations,
                diplomaticReputation,
                officials,
                officialsSimCursor,
                officialCandidates,
                lastSelectionDay,
                officialCapacity,
                ministerAssignments,
                ministerAutoExpansion,
                lastMinisterExpansionDay,
                decrees,
                activeDecrees,
                decreeCooldowns,
                quotaTargets,
                expansionSettings: sanitizeExpansionSettings(expansionSettings),
                priceControls, // [NEW] planned economy price control settings
                classApproval,
                classInfluence,
                classWealth,
                // classWealthDelta / classInfluenceShift 鏄崟 tick 琛嶇敓閲忥紝涓嶅叆瀛樻。
                classIncome,
                classExpense,
                classFinancialData,
                buildingFinancialData,
                classWealthHistory,
                classNeedsHistory,
                totalInfluence,
                totalWealth,
                activeBuffs,
                activeDebuffs,
                stability,
                // stratumDetailView / resourceDetailView / populationDetailView 鏄?UI 寮圭獥閫変腑椤?                classShortages,
                classLivingStandard,
                livingStandardStreaks,
                migrationCooldowns,
                history,
                // 缁忔祹鎸囨爣
                priceHistory,
                equilibriumPrices,
                economicIndicators,
                daysElapsed,
                army,
                militaryQueue,
                militaryCorps,
                generals,
                activeFronts,
                activeBattles,
                pendingRepairs,
                corpsReplenishQueue,
                // selectedTarget / battleResult 涓?UI 閫夋嫨/涓存椂缁撶畻灞曠ず锛屼笉鍏ュ瓨妗?                playerInstallmentPayment,
                autoRecruitEnabled,
                targetArmyComposition,
                militaryWageRatio,
                // festivalModal 涓哄勾搴﹁妭搴嗗脊绐楋紝涓嬩竴 tick 鐨勫勾搴︽娴嬩細鑷劧閲嶅缓
                annualReportBaseline,
                annualReportAccumulator,
                lastFestivalYear,
                annualReportHistory,
                // showTutorial / currentEvent 涓哄脊绐?UI 鎬侊紱showTutorial 宸叉湁鐙珛鏁欑▼杩涘害瀛樺偍
                eventHistory,
                logs,
                clicks,
                rates,
                taxes,
                taxPolicies,
                jobFill,
                market,
                merchantState,
                tradeStats,
                diplomacyOrganizations,
                vassalDiplomacyQueue,
                vassalDiplomacyHistory,
                overseasBuildings,
                overseasInvestments,
                foreignInvestments,
                foreignInvestmentPolicy,
                foreignInvestmentPolicyOverrides,
                eventEffectSettings,
                activeEventEffects,
                rebellionStates,
                rulingCoalition,
                legitimacy,
                actionCooldowns,
                actionUsage,
                promiseTasks,
                autoSaveInterval,
                isAutoSaveEnabled,
                lastAutoSaveTime: nextLastAuto,
                difficulty,
                empireName,
                eventConfirmationEnabled,
                updatedAt: timestamp,
                saveSource: source,
                // 鐞嗗康绯荤粺
                ideologyScore,
                ideologyScoreSpent,
                ideologyCollection,
                equippedIdeologies,
                ideologySlotCount,
                ideologyCooldowns,
                ideologyMilestones,
                pendingIdeologyEmergence,
                ideologyEmergenceRarityBonus,
                discoveryVersion: DISCOVERY_SAVE_VERSION,
                // AI balance version marker - increment to trigger re-migration of old saves
                // v1: initial migration for too-strong/too-weak AI
                // v2: fix missing economyTraits fields that prevent AI development
                // v3: clamp future AI ticks + seed missing AI gift cooldown
                // v4: fix infinite growth bug (populationBasedMinimum loop)
                // v5: economy migration + display split
                // v6: battle/front/corps load reconciliation
                // v7: hydrate trimmed legacy nation saves from COUNTRIES templates
                aiBalanceVersion: 7,
            },
            nextLastAuto,
        };
    };

    const applyLoadedGameState = (data) => {
        if (!data || typeof data !== 'object') {
            throw new Error('瀛樻。鏁版嵁鏃犳晥');
        }
        data = normalizeLoadedSaveData(data);
        setResources(data.resources || INITIAL_RESOURCES, { reason: 'load_game', audit: false });

        // [FIX] 瀛樻。浜哄彛鍚屾淇锛氶槻姝opulation鍜宲opStructure涓嶄竴鑷村鑷寸殑鎭舵€ф墸鍑忓惊锟?
        // 濡傛灉瀛樻。涓殑population涓巔opStructure鎬诲拰涓嶄竴鑷达紝浠opStructure涓哄噯
        let loadedPopulation = data.population ?? 5;
        const loadedPopStructure = data.popStructure || {};
        const popStructureTotal = Object.values(loadedPopStructure).reduce((sum, val) => sum + (val || 0), 0);

        if (popStructureTotal > 0 && Math.abs(loadedPopulation - popStructureTotal) > 0.5) {
            console.log(`[Save Migration] Population mismatch detected! population=${loadedPopulation}, popStructure sum=${popStructureTotal}. Fixing...`);
            loadedPopulation = popStructureTotal; // 浠opStructure鎬诲拰涓哄噯
        }

        setPopulation(loadedPopulation);
        setPopStructure(loadedPopStructure);
        setMaxPop(data.maxPop ?? 10);
        setMaxPopBonus(data.maxPopBonus || 0);
        setBirthAccumulator(data.birthAccumulator || 0);
        setBuildings(data.buildings || {});
        // 鍗囩骇鏍煎紡杩佺Щ锛氭娴嬫棫鏍煎紡骞惰嚜鍔ㄨ浆锟?
        let upgrades = data.buildingUpgrades || {};
        if (isOldUpgradeFormat(upgrades, data.buildings)) {
            console.log('[Save Migration] Detected old buildingUpgrades format, migrating...');
            upgrades = migrateUpgradesToNewFormat(upgrades, data.buildings);
        }
        
        // [FIX] 娓呯悊涓嶄竴鑷寸殑鍗囩骇鏁版嵁锛氱‘淇濆崌绾ф暟閲忎笉瓒呰繃寤虹瓚鏁伴噺
        // 杩欏彲浠ヤ慨澶嶇敱浜庢暟鎹崯鍧忔垨鏃х増鏈琤ug瀵艰嚧鐨勪笉涓€锟?
        const buildings = data.buildings || {};
        let hasInconsistency = false;
        for (const [buildingId, levelCounts] of Object.entries(upgrades)) {
            if (!levelCounts || typeof levelCounts !== 'object') continue;
            const buildingCount = buildings[buildingId] || 0;
            let totalUpgraded = 0;
            for (const lvlCount of Object.values(levelCounts)) {
                if (typeof lvlCount === 'number' && lvlCount > 0) {
                    totalUpgraded += lvlCount;
                }
            }
            if (totalUpgraded > buildingCount) {
                console.warn(`[Save Migration] Building upgrade inconsistency detected for ${buildingId}: ${totalUpgraded} upgrades > ${buildingCount} buildings. Normalizing...`);
                hasInconsistency = true;
                // 瑙勮寖鍖栵細鎸夐珮绛夌骇浼樺厛鍒嗛厤
                const sortedLevels = Object.keys(levelCounts)
                    .map(k => parseInt(k))
                    .filter(k => Number.isFinite(k) && k > 0 && levelCounts[k] > 0)
                    .sort((a, b) => b - a);
                let remaining = buildingCount;
                const normalizedCounts = {};
                for (const lvl of sortedLevels) {
                    const wanted = levelCounts[lvl];
                    const actual = Math.min(wanted, remaining);
                    if (actual > 0) {
                        normalizedCounts[lvl] = actual;
                        remaining -= actual;
                    }
                }
                if (Object.keys(normalizedCounts).length > 0) {
                    upgrades[buildingId] = normalizedCounts;
                } else {
                    delete upgrades[buildingId];
                }
            }
        }
        if (hasInconsistency) {
            console.log('[Save Migration] Building upgrade data normalized.');
        }
        
        setBuildingUpgrades(upgrades);
        setTechsUnlocked(data.techsUnlocked || []);
        setEpoch(data.epoch ?? 0);
        setActiveTab(data.activeTab || 'build');
        setGameSpeed(data.gameSpeed ?? 1);
        setIsPaused(true);
        setDiplomaticReputation(data.diplomaticReputation ?? 50);

        // [FIX] Legacy save migration: Fix AI nations with broken population/wealth from old versions
        // Only apply to saves WITHOUT aiBalanceVersion marker (old saves before this fix)
        const nationBootstrapState = {
            population: loadedPopulation,
            classWealth: data.classWealth,
            resources: data.resources,
            epoch: data.epoch ?? 0,
        };
        const referencedNationIds = collectReferencedNationIds(data);
        const recoveredNationRoster = rebuildLoadedNationRoster({
            rawNations: data.nations,
            referencedNationIds,
            playerState: nationBootstrapState,
        });
        if (recoveredNationRoster.rebuilt) {
            console.warn(
                `[Save Migration] Rebuilt nation roster from templates. ` +
                `loaded=${Array.isArray(data.nations) ? data.nations.length : 0}, ` +
                `missingReferenced=${recoveredNationRoster.missingReferencedNationIds.join(', ') || 'none'}`
            );
        }
        const loadedNations = recoveredNationRoster.nations.map((nation) => {
            if (!nation || nation.id === 'player') return nation;
            const mergedNation = mergeCountryTemplate(nation);
            return ensureAIMilitaryState(migrateNationEconomy(mergedNation), data.epoch ?? 0);
        });
        const playerPop = loadedPopulation; // Use player population loaded above
        const playerWealth = (data.resources?.silver) || 1000;
        const currentEpoch = data.epoch ?? 0;
        const loadedTick = data.daysElapsed || 0;
        const saveDiscoveryVersion = Number.isFinite(data.discoveryVersion)
            ? data.discoveryVersion
            : Number(data.discoveryVersion) || 0;
        const needsDiscoveryMigration = saveDiscoveryVersion < DISCOVERY_SAVE_VERSION;
        
        let migratedNations = loadedNations;
        // [FIX v2] Check if save version is outdated (missing OR less than current version)
        // This ensures old saves that were saved after partial fixes still get updated
        const CURRENT_AI_BALANCE_VERSION = 7;
        const saveAIVersion = data.aiBalanceVersion || 0;
        const needsMigration = saveAIVersion < CURRENT_AI_BALANCE_VERSION;
        
        if (needsMigration) {
            console.log(`[Save Migration] AI balance version ${saveAIVersion} < ${CURRENT_AI_BALANCE_VERSION}, applying migration...`);
            // This is an old save - check for broken AI nations
            migratedNations = loadedNations.map(n => {
                // Skip player nation
                if (n.id === 'player') return n;
                
                const aiPop = n.population || 0;
                const aiWealth = n.wealth || 0;
                const popRatio = aiPop / Math.max(1, playerPop);
                const wealthRatio = aiWealth / Math.max(1, playerWealth);
                
                // [FIX v4] Also check per-capita wealth cap (reduced caps)
                // Per-capita wealth cap by epoch: Stone=2k, Ancient=4k, Medieval=8k, Industrial=16k, Modern=32k
                const nationEpoch = n.epoch ?? 0;
                const perCapitaWealthCap = Math.min(50000, 2000 * Math.pow(2, Math.min(nationEpoch, 4)));
                const aiPerCapitaWealth = aiWealth / Math.max(1, aiPop);
                const perCapitaExceeded = aiPerCapitaWealth > perCapitaWealthCap;
                
                // [FIX v3] Check if AI nation is TOO WEAK (population < 100 or less than 5% of player)
                // Old saves often have AI stuck at 10-30 population due to missing growth logic
                const isTooWeak = aiPop < 100 || (playerPop > 100 && popRatio < 0.05);
                
                // [FIX v4] Check for infinite growth bug (population > 1 billion indicates bug)
                // Bug was caused by populationBasedMinimum = currentPop * 10 creating feedback loop
                const hasInfiniteGrowthBug = aiPop > 1000000000 || aiWealth > 1000000000000;
                
                // If AI population OR wealth exceeds 10x player's level, OR per-capita wealth exceeds cap, OR is too weak, OR has infinite growth bug
                if (popRatio > 10 || wealthRatio > 10 || perCapitaExceeded || isTooWeak || hasInfiniteGrowthBug) {
                    const reason = hasInfiniteGrowthBug
                        ? `INFINITE GROWTH BUG: pop=${aiPop.toExponential(2)}, wealth=${aiWealth.toExponential(2)}`
                        : isTooWeak 
                        ? `TOO WEAK: pop=${aiPop}, wealth=${aiWealth}` 
                        : `TOO STRONG: pop=${aiPop}, wealth=${aiWealth}, per-capita=${aiPerCapitaWealth.toFixed(0)}, cap=${perCapitaWealthCap}`;
                    console.log(`[Save Migration] Resetting broken AI nation: ${n.name} (${reason})`);
                    
                    
                    // Calculate reasonable values based on player's current development
                    // 鍚屾椂缁欐瘡涓椂浠ｈ缃嫭绔嬪湴鏉匡紝閬垮厤鐜╁鑷繁杩樺緢灏忕殑鏃跺€欐妸 AI 涔熼噸缃垚 100 浜烘潙搴?                    const appearEpoch = n.appearEpoch ?? 0;
                    const epochBonus = 1 + Math.min(appearEpoch, currentEpoch) * 0.2;
                    const epochPopulationFloor = [900, 1400, 2200, 3400, 5200, 7800, 11000][Math.min(appearEpoch, 6)];
                    const epochWealthFloor = [1200, 2200, 4200, 7600, 13000, 22000, 36000][Math.min(appearEpoch, 6)];
                    
                    // Population: 30-80% of player, with epoch bonus
                    const targetPopScale = 0.3 + Math.random() * 0.5; // 0.3 to 0.8
                    const scaledPopulation = clampBootstrapPopulation(playerPop * targetPopScale * epochBonus);
                    const newPopulation = Math.max(scaledPopulation, epochPopulationFloor);
                    
                    // Wealth: 20-60% of player, with epoch bonus, but capped by per-capita limit
                    const targetWealthScale = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
                    const rawNewWealth = Math.floor(playerWealth * targetWealthScale * epochBonus);
                    // Ensure per-capita wealth doesn't exceed cap, but keep a sensible epoch floor.
                    const maxWealthByPerCapita = newPopulation * perCapitaWealthCap * 0.75;
                    const newWealth = Math.max(epochWealthFloor, Math.min(Math.max(500, rawNewWealth), maxWealthByPerCapita));
                    
                    // Reset economy traits
                    const newEconomyTraits = {
                        ...(n.economyTraits || {}),
                        ownBasePopulation: Math.max(100, Math.floor(newPopulation * 0.7)),
                        ownBaseWealth: newWealth,
                        basePopulation: newPopulation,
                        baseWealth: newWealth,
                        developmentRate: 0.8 + Math.random() * 0.4,
                        lastGrowthTick: Math.max(0, loadedTick - 15), // [FIX] Set to recent tick instead of 0
                    };
                    
                    return {
                        ...n,
                        population: newPopulation,
                        wealth: newWealth,
                        budget: Math.floor(newWealth * calculateAITreasuryTargetRatio({
                            wealth: newWealth,
                            population: newPopulation,
                            epoch: nationEpoch,
                            isAtWar: false,
                            aggression: n.aggression || 0.3,
                            capacityUsage: 0.6,
                            developmentRate: 1.0,
                        })),
                        wealthTemplate: newWealth,
                        economyTraits: newEconomyTraits,
                    };
                }
                
                // [FIX v2] For nations that don't need full reset, still ensure they have ALL required economyTraits
                // This fixes old saves where nations may have economyTraits but missing critical fields
                // Without these fields, AI nations WILL NOT DEVELOP!
                const fixedEconomyTraits = { ...(n.economyTraits || {}) };
                let needsFix = false;
                const currentPop = n.population || 16;
                const currentWealth = n.wealth || 1000;
                
                // [CRITICAL] Fix missing ownBasePopulation - without this, growth model fails!
                if (!fixedEconomyTraits.ownBasePopulation || !Number.isFinite(fixedEconomyTraits.ownBasePopulation) || fixedEconomyTraits.ownBasePopulation < 1) {
                    fixedEconomyTraits.ownBasePopulation = Math.max(5, currentPop);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing ownBasePopulation for: ${n.name} -> ${fixedEconomyTraits.ownBasePopulation}`);
                }
                
                // [CRITICAL] Fix missing ownBaseWealth
                if (!fixedEconomyTraits.ownBaseWealth || !Number.isFinite(fixedEconomyTraits.ownBaseWealth) || fixedEconomyTraits.ownBaseWealth < 100) {
                    fixedEconomyTraits.ownBaseWealth = Math.max(500, currentWealth);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing ownBaseWealth for: ${n.name} -> ${fixedEconomyTraits.ownBaseWealth}`);
                }
                
                // [CRITICAL] Fix missing developmentRate - controls growth speed!
                if (!fixedEconomyTraits.developmentRate || !Number.isFinite(fixedEconomyTraits.developmentRate) || fixedEconomyTraits.developmentRate < 0.1) {
                    fixedEconomyTraits.developmentRate = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing developmentRate for: ${n.name} -> ${fixedEconomyTraits.developmentRate.toFixed(2)}`);
                }
                
                // Fix missing lastGrowthTick
                if (fixedEconomyTraits.lastGrowthTick === undefined || fixedEconomyTraits.lastGrowthTick === null || !Number.isFinite(fixedEconomyTraits.lastGrowthTick)) {
                    fixedEconomyTraits.lastGrowthTick = Math.max(0, loadedTick - 15);
                    needsFix = true;
                    console.log(`[Save Migration] Fixed missing lastGrowthTick for: ${n.name}`);
                }
                
                // Fix missing lastDevelopmentTick
                if (fixedEconomyTraits.lastDevelopmentTick === undefined || fixedEconomyTraits.lastDevelopmentTick === null || !Number.isFinite(fixedEconomyTraits.lastDevelopmentTick)) {
                    fixedEconomyTraits.lastDevelopmentTick = Math.max(0, loadedTick - 15);
                    needsFix = true;
                }
                
                // Fix missing basePopulation (target for development)
                if (!fixedEconomyTraits.basePopulation || !Number.isFinite(fixedEconomyTraits.basePopulation)) {
                    fixedEconomyTraits.basePopulation = currentPop;
                    needsFix = true;
                }
                
                // Fix missing baseWealth (target for development)
                if (!fixedEconomyTraits.baseWealth || !Number.isFinite(fixedEconomyTraits.baseWealth)) {
                    fixedEconomyTraits.baseWealth = currentWealth;
                    needsFix = true;
                }
                
                if (needsFix) {
                    console.log(`[Save Migration] Applied economyTraits fixes for: ${n.name}`);
                    return { ...n, economyTraits: fixedEconomyTraits };
                }
                
                return n;
            });

            // [FIX v3] 淇鏈潵鏃堕棿锟?+ 琛ラ綈 AI 閫佺ぜ鍐峰嵈瀛楁
            const safeLoadedTick = Number.isFinite(loadedTick) ? loadedTick : 0;
            migratedNations = migratedNations.map(n => {
                if (!n || n.id === 'player') return n;
                const next = { ...n };

                if (next.economyTraits) {
                    if (Number.isFinite(next.economyTraits.lastGrowthTick) && next.economyTraits.lastGrowthTick > safeLoadedTick) {
                        next.economyTraits.lastGrowthTick = Math.max(0, safeLoadedTick - 15);
                    }
                    if (Number.isFinite(next.economyTraits.lastDevelopmentTick) && next.economyTraits.lastDevelopmentTick > safeLoadedTick) {
                        next.economyTraits.lastDevelopmentTick = Math.max(0, safeLoadedTick - 15);
                    }
                }

                if (!Number.isFinite(next.lastGiftToPlayerDay) || next.lastGiftToPlayerDay > safeLoadedTick) {
                    // 鏃у瓨妗ｇ己澶辫瀛楁浼氱粫杩囧叏灞€閫佺ぜ鍐峰嵈
                    next.lastGiftToPlayerDay = safeLoadedTick;
                }

                return next;
            });
        }

        // ========================================================================
        // [CRITICAL FIX] UNCONDITIONAL lastGrowthTick/lastDevelopmentTick reset
        // This MUST run for ALL saves (not just old versions) because:
        // 1. The save file stores lastGrowthTick from when it was saved
        // 2. When loaded, daysElapsed is restored but growth functions check
        //    (currentTick - lastGrowthTick >= 10) to decide if growth should happen
        // 3. If the save was made recently (e.g., lastGrowthTick = daysElapsed - 2),
        //    then after loading, nations won't grow until 10 ticks pass
        // 4. This caused the "frozen AI" bug after loading saves
        // 
        // Solution: Reset lastGrowthTick to (loadedTick - 20) so growth triggers
        // immediately on the first simulation tick after loading.
        // ========================================================================
        const finalLoadedTick = Number.isFinite(loadedTick) ? loadedTick : 0;
        
        migratedNations = migratedNations.map(n => {
            if (!n || n.id === 'player') return n;
            
            const next = { ...n };
            
            // Ensure economyTraits exists
            if (!next.economyTraits) {
                next.economyTraits = {};
            } else {
                next.economyTraits = { ...next.economyTraits };
            }
            
            // [FIX v4] ALWAYS reset lastGrowthTick unconditionally
            // This ensures growth will happen on the first tick after loading
            next.economyTraits.lastGrowthTick = Math.max(0, finalLoadedTick - 20);
            
            // Also reset lastDevelopmentTick unconditionally
            next.economyTraits.lastDevelopmentTick = Math.max(0, finalLoadedTick - 20);
            
            return next;
        });

        let normalizedLoadedNations = migratedNations.map(n => {
            const mergedNation = n.id === 'player' ? n : mergeCountryTemplate(n);
            const normalizedNation = mergedNation.id === 'player'
                ? mergedNation
                : migrateNationEconomy(mergedNation);
            // 鏃у瓨妗ｅ吋瀹癸細杩佺Щ discovered 瀛楁
            const currentEpoch = data.epoch ?? 0;
            const hasDiscoveredField = Object.prototype.hasOwnProperty.call(mergedNation, 'discovered');
            const isLegacyTrimmedNation = (
                saveAIVersion < 7
                && mergedNation.id !== 'player'
                && !Object.prototype.hasOwnProperty.call(n, 'relation')
                && !Object.prototype.hasOwnProperty.call(n, 'appearEpoch')
                && !Object.prototype.hasOwnProperty.call(n, 'expireEpoch')
            );
            const isRecoveredNation = mergedNation._recoveredFromTemplate === true;
            let discovered;
            if (isRecoveredNation) {
                discovered = mergedNation.discovered === true;
            } else if (needsDiscoveryMigration) {
                const appearEpoch = mergedNation.appearEpoch ?? 0;
                const isExpired = mergedNation.expireEpoch != null && currentEpoch > mergedNation.expireEpoch;
                discovered = !isExpired && appearEpoch <= currentEpoch;
            } else if (hasDiscoveredField) {
                if (mergedNation.discovered === false && isLegacyTrimmedNation) {
                    discovered = (mergedNation.appearEpoch ?? 0) <= currentEpoch;
                } else {
                    discovered = mergedNation.discovered;
                }
            } else {
                // 鏃х簿绠€瀛樻。鍙兘缂?relation/appearEpoch 绛夊瓧娈碉紝杩欓噷鐢ㄦā鏉胯ˉ鍏ㄥ悗鐨勬暟鎹厹搴曘€?                const appearEpoch = mergedNation.appearEpoch ?? 0;
                const hasLegacyDiplomacyState = (
                    mergedNation.relation !== undefined
                    || Array.isArray(mergedNation.treaties)
                    || mergedNation.isAtWar === true
                    || mergedNation.vassalOf === 'player'
                    || Number.isFinite(mergedNation.lastGiftToPlayerDay)
                );
                discovered = appearEpoch <= currentEpoch && hasLegacyDiplomacyState;
            }
            return {
                ...normalizedNation,
                discovered,
                treaties: Array.isArray(mergedNation.treaties) ? mergedNation.treaties : [],
                openMarketUntil: Object.prototype.hasOwnProperty.call(mergedNation, 'openMarketUntil') ? mergedNation.openMarketUntil : null,
                peaceTreatyUntil: Object.prototype.hasOwnProperty.call(mergedNation, 'peaceTreatyUntil') ? mergedNation.peaceTreatyUntil : null,
                vassalOf: Object.prototype.hasOwnProperty.call(mergedNation, 'vassalOf') ? mergedNation.vassalOf : DEFAULT_VASSAL_STATUS.vassalOf,
                vassalType: Object.prototype.hasOwnProperty.call(mergedNation, 'vassalType') ? mergedNation.vassalType : DEFAULT_VASSAL_STATUS.vassalType,
                tributeRate: Number.isFinite(mergedNation.tributeRate) ? mergedNation.tributeRate : DEFAULT_VASSAL_STATUS.tributeRate,
                independencePressure: Number.isFinite(mergedNation.independencePressure) ? mergedNation.independencePressure : DEFAULT_VASSAL_STATUS.independencePressure,
                organizationMemberships: Array.isArray(mergedNation.organizationMemberships) ? mergedNation.organizationMemberships : [],
                overseasAssets: Array.isArray(mergedNation.overseasAssets) ? mergedNation.overseasAssets : [],
            };
        });

        const appearedNations = normalizedLoadedNations.filter((nation) => {
            if (!nation || nation.id === 'player' || nation.isRebelNation || nation.isAnnexed) {
                return false;
            }
            const appearEpoch = nation.appearEpoch ?? 0;
            if (appearEpoch > currentEpoch) return false;
            if (nation.expireEpoch != null && currentEpoch > nation.expireEpoch) return false;
            return true;
        });
        const visibleNationCount = appearedNations.filter((nation) => (
            nation.vassalOf === 'player' || nation.discovered === true
        )).length;
        const referencedAppearedNationCount = appearedNations.filter((nation) => (
            referencedNationIds.has(nation.id)
        )).length;
        const visibleReferencedNationCount = appearedNations.filter((nation) => (
            referencedNationIds.has(nation.id)
            && (nation.vassalOf === 'player' || nation.discovered === true)
        )).length;
        const poisonedDiscoveryState = (
            appearedNations.length >= 8
            && referencedAppearedNationCount >= 5
            && visibleNationCount <= 1
            && visibleReferencedNationCount <= 1
        );

        if (appearedNations.length > 0 && (visibleNationCount === 0 || poisonedDiscoveryState)) {
            const restoreReason = visibleNationCount === 0
                ? 'no_visible_nations'
                : 'poisoned_discovery_state';
            console.warn(
                `[Save Migration] Restoring discovered state for appeared nations. ` +
                `reason=${restoreReason}, appeared=${appearedNations.length}, ` +
                `visible=${visibleNationCount}, referencedAppeared=${referencedAppearedNationCount}, ` +
                `visibleReferenced=${visibleReferencedNationCount}`
            );
            normalizedLoadedNations = normalizedLoadedNations.map((nation) => {
                if (!nation || nation.id === 'player' || nation.isRebelNation || nation.isAnnexed) {
                    return nation;
                }
                const appearEpoch = nation.appearEpoch ?? 0;
                const isExpired = nation.expireEpoch != null && currentEpoch > nation.expireEpoch;
                if (appearEpoch > currentEpoch || isExpired) {
                    return nation;
                }
                return {
                    ...nation,
                    discovered: true,
                };
            });
        }

        setNations(normalizedLoadedNations);
        setOfficials(migrateAllOfficialsForInvestment(data.officials || [], data.daysElapsed || 0, data.officialPropertyPolicy));
        setOfficialsSimCursor(data.officialsSimCursor ?? 0);
        setOfficialCandidates(data.officialCandidates || []);
        setLastSelectionDay(data.lastSelectionDay ?? -999);
        setOfficialCapacity(data.officialCapacity ?? 2);
        setMinisterAssignments({
            ...buildInitialMinisterAssignments(),
            ...(data.ministerAssignments || {}),
        });
        setMinisterAutoExpansion({
            ...buildInitialMinisterAutoExpansion(),
            ...(data.ministerAutoExpansion || {}),
        });
        setLastMinisterExpansionDay(normalizeMinisterExpansionCooldowns(data.lastMinisterExpansionDay));
        setExpansionSettings(sanitizeExpansionSettings(data.expansionSettings)); // [FIX] 鍔犺浇鑷敱甯傚満鎵╁紶璁剧疆
        setDecrees(Array.isArray(data.decrees) ? data.decrees : []);
        setActiveDecrees(data.activeDecrees || {});
        setDecreeCooldowns(data.decreeCooldowns || {});
        // Planned economy quota controls: keep backward compatibility with older saves
        const loadedQuotaTargets = data.quotaTargets;
        const normalizedQuotaTargets = loadedQuotaTargets
            && typeof loadedQuotaTargets === 'object'
            && Object.prototype.hasOwnProperty.call(loadedQuotaTargets, 'targets')
            ? loadedQuotaTargets
            : { enabled: true, targets: loadedQuotaTargets || {} };
        setQuotaTargets(normalizedQuotaTargets);
        setPriceControls(data.priceControls || {
            enabled: false,
            governmentBuyPrices: {},
            governmentSellPrices: {},
        });
        setTaxShock(data.taxShock || {});
        setClassApproval(data.classApproval || {});
        setClassInfluence(data.classInfluence || {});
        setClassWealth(data.classWealth || buildInitialWealth(), { reason: 'load_game', audit: false });
        setClassWealthDelta(data.classWealthDelta || {});
        setClassIncome(data.classIncome || {});
        setClassExpense(data.classExpense || {});
        setClassFinancialData(data.classFinancialData || {});
        setClassWealthHistory(trimClassSeriesMap(
            data.classWealthHistory || buildInitialWealthHistory(),
            AUTO_SAVE_LIMITS.classSeries,
        ));
        setClassNeedsHistory(trimClassSeriesMap(
            data.classNeedsHistory || buildInitialNeedsHistory(),
            AUTO_SAVE_LIMITS.classSeries,
        ));
        setTotalInfluence(data.totalInfluence || 0);
        setTotalWealth(data.totalWealth || 0);
        setActiveBuffs(data.activeBuffs || []);
        setActiveDebuffs(data.activeDebuffs || []);
        setClassInfluenceShift(data.classInfluenceShift || {});
        setStability(data.stability ?? 50);
        setStratumDetailView(data.stratumDetailView || null);
        setResourceDetailView(data.resourceDetailView || null);
        setClassShortages(data.classShortages || {});
        setClassLivingStandard(data.classLivingStandard || {});
        setLivingStandardStreaks(data.livingStandardStreaks || buildInitialLivingStandardStreaks());
        setMigrationCooldowns(data.migrationCooldowns || {});
        setPopulationDetailView(data.populationDetailView || false);
        setHistory(trimHistorySnapshot(data.history || buildInitialHistory(), AUTO_SAVE_LIMITS.history));
        
        // 缁忔祹鎸囨爣
        setPriceHistory(data.priceHistory || {});
        setEquilibriumPrices(data.equilibriumPrices || {});
        setEconomicIndicators(data.economicIndicators || {
            gdp: { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 },
            cpi: { index: 100, change: 0, breakdown: {} },
            ppi: { index: 100, change: 0, breakdown: {} },
        });
        
        const parsedDaysElapsed = Number.isFinite(data.daysElapsed)
            ? data.daysElapsed
            : Number(data.daysElapsed);
        setDaysElapsed(Number.isFinite(parsedDaysElapsed) ? parsedDaysElapsed : 0);
        setArmy(data.army || {});
        // [PERF] Batched queue migration: convert old flat array to batched format
        const rawQueue = data.militaryQueue || [];
        if (rawQueue.length > 0 && rawQueue[0] && !('count' in rawQueue[0])) {
            // Old format: each item is a single unit. Merge into batches.
            const batchMap = new Map(); // key -> batch object
            for (const item of rawQueue) {
                if (!item?.unitId) continue;
                const key = `${item.unitId}|${item.status}|${item.remainingTime}|${item.totalTime}|${item.isAutoReplenish || false}`;
                if (batchMap.has(key)) {
                    batchMap.get(key).count += 1;
                } else {
                    batchMap.set(key, { ...item, count: 1 });
                }
            }
            const migratedQueue = Array.from(batchMap.values());
            console.log(`[Save Migration] Converted flat militaryQueue (${rawQueue.length} items) to batched format (${migratedQueue.length} batches)`);
            setMilitaryQueue(migratedQueue);
        } else {
            setMilitaryQueue(rawQueue);
        }
        setCorpsReplenishQueue(data.corpsReplenishQueue || {});
        const rawMilitaryCorps = Array.isArray(data.militaryCorps) ? data.militaryCorps : [];
        if (rawMilitaryCorps.length > MAX_LOADED_MILITARY_CORPS) {
            console.warn(`[Save Migration] militaryCorps too large (${rawMilitaryCorps.length}), truncating to ${MAX_LOADED_MILITARY_CORPS}.`);
        }
        let loadedMilitaryCorps = rawMilitaryCorps
            .slice(0, MAX_LOADED_MILITARY_CORPS)
            .filter(Boolean)
            .filter((corps) => getLoadedCorpsTotalUnits(corps) > 0);
        const rawGenerals = Array.isArray(data.generals) ? data.generals : [];
        if (rawGenerals.length > MAX_LOADED_GENERALS) {
            console.warn(`[Save Migration] generals too large (${rawGenerals.length}), truncating to ${MAX_LOADED_GENERALS}.`);
        }
        let loadedGenerals = rawGenerals.slice(0, MAX_LOADED_GENERALS).filter(Boolean);
        const shouldUseFastMilitaryLoad = (loadedMilitaryCorps.length + loadedGenerals.length) > FAST_LOAD_MILITARY_ENTITY_THRESHOLD;
        if (shouldUseFastMilitaryLoad) {
            console.warn(`[Save Migration] Large military payload detected (corps=${loadedMilitaryCorps.length}, generals=${loadedGenerals.length}), using fast-load path.`);
            // 蹇€熷姞杞斤細浠呴噸缃皢棰嗗垎閰嶅拰AI鍏靛洟閮ㄧ讲锛屼繚鐣欑帺瀹跺叺鍥㈢殑閮ㄧ讲鐘舵€?            const fastLoadFronts = (data.activeFronts || []).map(front => ensureFrontDefaults(front));
            const fastFrontIdSet = new Set(fastLoadFronts.filter(f => f.status === 'active').map(f => f.id));
            loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => {
                if (corps.isAI) {
                    // AI鍏靛洟锛氶噸缃儴缃蹭互鑺傜渷鍔犺浇鏃堕棿锛圓I浼氬湪娓告垙tick涓噸鏂伴儴缃诧級
                    return { ...corps, generalId: null, assignedFrontId: null, status: 'idle' };
                }
                // 鐜╁鍏靛洟锛氫繚鐣欐湁鏁堢殑鍓嶇嚎鍒嗛厤
                const assignedFrontId = fastFrontIdSet.has(corps.assignedFrontId) ? corps.assignedFrontId : null;
                return {
                    ...corps,
                    generalId: null,  // 灏嗛浠嶇劧閲嶇疆浠ヤ繚鎸佸揩閫熷姞杞界殑鎬ц兘浼樺娍
                    assignedFrontId,
                    status: assignedFrontId ? 'deployed' : 'idle',
                };
            });
            // 閲嶅缓鍓嶇嚎鐨?assignedCorps 鐜╁渚у垪琛?            const playerCorpsByFrontFast = new Map();
            for (const corps of loadedMilitaryCorps) {
                if (corps.isAI || !corps.assignedFrontId) continue;
                if (!playerCorpsByFrontFast.has(corps.assignedFrontId)) {
                    playerCorpsByFrontFast.set(corps.assignedFrontId, []);
                }
                playerCorpsByFrontFast.get(corps.assignedFrontId).push(corps.id);
            }
            const reconciledFastFronts = fastLoadFronts.map((front) => {
                const playerSide = front.attackerId === 'player' ? 'attacker' : 'defender';
                const playerCorpsForFront = playerCorpsByFrontFast.get(front.id) || [];
                return {
                    ...front,
                    assignedCorps: {
                        ...front.assignedCorps,
                        [playerSide]: playerCorpsForFront,
                    },
                    frontlineCorpsOrder: {
                        ...(front.frontlineCorpsOrder || {}),
                        [playerSide]: playerCorpsForFront,
                    },
                    activeBattleId: null,
                };
            });
            setMilitaryCorps(loadedMilitaryCorps);
            setGenerals(loadedGenerals);
            setActiveFronts(reconciledFastFronts);
            setActiveBattles([]);
            setPendingRepairs(data.pendingRepairs || []);
        } else {
            const loadedFronts = (data.activeFronts || []).map(front => ensureFrontDefaults(front));
            const playerWarNations = (migratedNations || []).filter(n => n?.isAtWar === true && !n?.isRebelNation);
            const existingActiveEnemyIds = new Set(
                loadedFronts
                    .filter(front => front.status === 'active' && (front.attackerId === 'player' || front.defenderId === 'player'))
                    .map(front => (front.attackerId === 'player' ? front.defenderId : front.attackerId))
            );
            const playerEco = {
                resources: data.resources || {},
                buildings: data.buildings || {},
                population: loadedPopulation || data.population || 0,
                wealth: data.resources?.silver || 0,
            };
            const rebuiltFronts = playerWarNations
                .filter(nation => !existingActiveEnemyIds.has(nation.id))
                .map(nation => {
                    const enemyEco = {
                        resources: {},
                        buildings: {},
                        population: nation.population || nation.militaryPower || 200,
                        wealth: nation.wealth || 500,
                    };
                    const front = generateFront(nation.id, 'player', data.epoch ?? 0, enemyEco, playerEco);
                    front.createdDay = data.daysElapsed || 0;
                    front.startDay = data.daysElapsed || 0;
                    return front;
                });

            let reconciledFronts = [...loadedFronts, ...rebuiltFronts].map(front => {
                if (front.status !== 'active') return front;
                const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
                const enemyNation = (migratedNations || []).find(n => n.id === enemyId);
                if (!enemyNation || enemyNation.isAtWar !== true) {
                    return { ...front, status: 'collapsed' };
                }
                return front;
            });
            const initialFrontIdSet = new Set(reconciledFronts.map((front) => front.id));
            const validOfficialIdSet = new Set((data.officials || []).filter(Boolean).map((official) => official.id));
            loadedGenerals = loadedGenerals.filter((general) => (
                general?.isAI === true
                || !general?.officialId
                || validOfficialIdSet.has(general.officialId)
            ));
            const validGeneralIdSet = new Set(loadedGenerals.map((general) => general.id));

            loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => {
                const assignedFrontId = initialFrontIdSet.has(corps.assignedFrontId) ? corps.assignedFrontId : null;
                return {
                    ...corps,
                    generalId: validGeneralIdSet.has(corps.generalId) ? corps.generalId : null,
                    assignedFrontId,
                    status: assignedFrontId ? 'deployed' : 'idle',
                };
            });

            let hydratedNations = (migratedNations || []).map((nation) => {
                if (!nation || nation.id === 'player') return nation;
                const syncResult = syncAINationMilitary({
                    nation,
                    epoch: currentEpoch,
                    currentDay: parsedDaysElapsed || 0,
                    militaryCorps: loadedMilitaryCorps,
                    generals: loadedGenerals,
                });
                loadedMilitaryCorps = [
                    ...loadedMilitaryCorps.filter((corps) => !(corps?.isAI && corps.nationId === nation.id)),
                    ...syncResult.corps,
                ];
                loadedGenerals = [
                    ...loadedGenerals.filter((general) => !syncResult.corps.some((corps) => corps.generalId === general.id)),
                    ...syncResult.generals,
                ];
                return syncResult.nation;
            });

            for (const front of reconciledFronts) {
                if (front?.status !== 'active') continue;
                const enemyId = front.attackerId === 'player' ? front.defenderId : front.attackerId;
                const enemyNation = hydratedNations.find((nation) => nation.id === enemyId);
                if (!enemyNation) continue;
                const playerSide = front.attackerId === 'player' ? 'attacker' : 'defender';
                const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
                const enemyCorpsOnFront = loadedMilitaryCorps.filter((corps) => corps.isAI && corps.nationId === enemyId && corps.assignedFrontId === front.id);
                if (enemyCorpsOnFront.length > 0) continue;
                const playerCorpsOnFront = loadedMilitaryCorps.filter((corps) => !corps.isAI && corps.assignedFrontId === front.id);
                const idleEnemyCorps = loadedMilitaryCorps.filter((corps) => corps.isAI && corps.nationId === enemyId && !corps.assignedFrontId);
                if (idleEnemyCorps.length <= 0) continue;
                const frontPlan = evaluateAIFrontPlan({
                    nation: enemyNation,
                    front,
                    ownCorps: idleEnemyCorps,
                    enemyCorps: playerCorpsOnFront,
                });
                const deployCount = Math.max(1, Math.min(idleEnemyCorps.length, frontPlan.desiredCorps || 1));
                const deployIds = idleEnemyCorps.slice(0, deployCount).map((corps) => corps.id);
                loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => {
                    if (!deployIds.includes(corps.id)) return corps;
                    return {
                        ...corps,
                        assignedFrontId: front.id,
                        status: 'deployed',
                        frontTask: frontPlan.taskAssignments?.[corps.id] || corps.frontTask || 'assault',
                    };
                });
                reconciledFronts = reconciledFronts.map((item) => {
                    if (item.id !== front.id) return item;
                    return {
                        ...item,
                        aiPosture: frontPlan.posture,
                        postures: {
                            ...(item.postures || {}),
                            [enemySide]: frontPlan.posture,
                        },
                        assignedCorps: {
                            ...item.assignedCorps,
                            [enemySide]: deployIds,
                        },
                        frontlineCorpsOrder: {
                            ...(item.frontlineCorpsOrder || {}),
                            [enemySide]: frontPlan.frontlineCorpsOrder?.length > 0 ? frontPlan.frontlineCorpsOrder : deployIds,
                        },
                    };
                });
            }
            const corpsIdSet = new Set(loadedMilitaryCorps.map((corps) => corps.id));
            // 鏋勫缓浠?frontId 鈫?鍚勪晶鍏靛洟ID 鐨勬槧灏勶紝鐢ㄤ簬閲嶅缓 assignedCorps
            const playerCorpsByFront = new Map();
            const aiCorpsByFront = new Map();
            for (const corps of loadedMilitaryCorps) {
                if (!corps.assignedFrontId) continue;
                const targetMap = corps.isAI ? aiCorpsByFront : playerCorpsByFront;
                if (!targetMap.has(corps.assignedFrontId)) {
                    targetMap.set(corps.assignedFrontId, []);
                }
                targetMap.get(corps.assignedFrontId).push(corps.id);
            }
            reconciledFronts = reconciledFronts.map((front) => {
                const pruneList = (list = []) => list.filter((id) => corpsIdSet.has(id));
                const playerSide = front.attackerId === 'player' ? 'attacker' : 'defender';
                const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
                // 鍏堜慨鍓棤鏁圛D
                const prunedAttacker = pruneList(front.assignedCorps?.attacker);
                const prunedDefender = pruneList(front.assignedCorps?.defender);
                // 浠庡叺鍥㈡暟鎹噸寤虹帺瀹朵晶鍜孉I渚х殑 assignedCorps锛堣ˉ鍏ㄧ己澶辩殑鍏靛洟ID锛?                const playerCorpsForFront = playerCorpsByFront.get(front.id) || [];
                const aiCorpsForFront = aiCorpsByFront.get(front.id) || [];
                const existingPlayerSet = new Set(playerSide === 'attacker' ? prunedAttacker : prunedDefender);
                const existingEnemySet = new Set(enemySide === 'attacker' ? prunedAttacker : prunedDefender);
                // 灏嗙己澶辩殑鍏靛洟ID娉ㄥ叆鍒板搴斾晶
                for (const corpsId of playerCorpsForFront) {
                    if (!existingPlayerSet.has(corpsId)) existingPlayerSet.add(corpsId);
                }
                for (const corpsId of aiCorpsForFront) {
                    if (!existingEnemySet.has(corpsId)) existingEnemySet.add(corpsId);
                }
                const rebuiltPlayerList = [...existingPlayerSet];
                const rebuiltEnemyList = [...existingEnemySet];
                const rebuiltAssignedCorps = {
                    [playerSide]: rebuiltPlayerList,
                    [enemySide]: rebuiltEnemyList,
                };
                // 鍚屾牱閲嶅缓 frontlineCorpsOrder
                const prunedFrontlineAttacker = pruneList(front.frontlineCorpsOrder?.attacker);
                const prunedFrontlineDefender = pruneList(front.frontlineCorpsOrder?.defender);
                const existingFrontlinePlayer = new Set(playerSide === 'attacker' ? prunedFrontlineAttacker : prunedFrontlineDefender);
                for (const corpsId of playerCorpsForFront) {
                    if (!existingFrontlinePlayer.has(corpsId)) existingFrontlinePlayer.add(corpsId);
                }
                const rebuiltFrontlinePlayer = [...existingFrontlinePlayer];
                const rebuiltFrontlineCorpsOrder = {
                    [playerSide]: rebuiltFrontlinePlayer,
                    [enemySide]: enemySide === 'attacker' ? prunedFrontlineAttacker : prunedFrontlineDefender,
                };
                return {
                    ...front,
                    assignedCorps: rebuiltAssignedCorps,
                    frontlineCorpsOrder: rebuiltFrontlineCorpsOrder,
                    activeBattleId: null,
                };
            });

            const frontStatusMap = new Map(reconciledFronts.map(front => [front.id, front.status]));
            const activeCorpsIds = new Set(loadedMilitaryCorps.map((corps) => corps.id));
            const corpsById = new Map(loadedMilitaryCorps.map((corps) => [corps.id, corps]));
            const reconciledBattles = (data.activeBattles || [])
                .map((rawBattle) => ensureBattleDefaults(rawBattle))
                .filter((battle) => {
                    if (!battle || battle.status !== 'active') return false;
                    if (battle.result?.finalized) return false;
                    if (frontStatusMap.get(battle.frontId) !== 'active') return false;
                    if (battle.currentRound >= battle.totalDays) return false;
                    const attackerCorps = corpsById.get(battle.attacker?.corpsId);
                    const defenderCorps = corpsById.get(battle.defender?.corpsId);
                    if (!activeCorpsIds.has(battle.attacker?.corpsId) || !activeCorpsIds.has(battle.defender?.corpsId)) return false;
                    return attackerCorps?.assignedFrontId === battle.frontId && defenderCorps?.assignedFrontId === battle.frontId;
                });
            const activeBattleCorps = new Set(
                reconciledBattles.flatMap((battle) => [battle.attacker?.corpsId, battle.defender?.corpsId]).filter(Boolean)
            );
            loadedMilitaryCorps = loadedMilitaryCorps.map((corps) => ({
                ...corps,
                status: activeBattleCorps.has(corps.id)
                    ? 'in_combat'
                    : (corps.assignedFrontId ? 'deployed' : 'idle'),
            }));
            const activeBattleIdByFront = new Map(reconciledBattles.map((battle) => [battle.frontId, battle.id]));
            reconciledFronts = reconciledFronts.map((front) => ({
                ...front,
                activeBattleId: activeBattleIdByFront.get(front.id) || null,
            }));

            setMilitaryCorps(loadedMilitaryCorps);
            setGenerals(loadedGenerals);
            setActiveFronts(reconciledFronts);
            setActiveBattles(reconciledBattles);
            setPendingRepairs(data.pendingRepairs || []);
            migratedNations = hydratedNations;
        }
        setSelectedTarget(data.selectedTarget || null);
        setBattleResult(data.battleResult || null);
        setPlayerInstallmentPayment(data.playerInstallmentPayment || null);
        setMilitaryWageRatio(data.militaryWageRatio || 1.5);
        setAutoRecruitEnabled(data.autoRecruitEnabled || false);
        setTargetArmyComposition(data.targetArmyComposition || {});
        setFestivalModal(data.festivalModal || null);
        setAnnualReportBaseline(data.annualReportBaseline || null);
        setAnnualReportAccumulator(data.annualReportAccumulator || createAnnualReportAccumulator());
        setLastFestivalYear(data.lastFestivalYear || 1);
        setAnnualReportHistory((Array.isArray(data.annualReportHistory) ? data.annualReportHistory : []).slice(-10));
        setShowTutorial(data.showTutorial ?? true);
        setCurrentEvent(data.currentEvent || null);
        setEventHistory(trimArray(data.eventHistory || [], AUTO_SAVE_LIMITS.eventHistory));
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setClicks(Array.isArray(data.clicks) ? data.clicks : []);
        setRates(data.rates || {});
        setTaxes(data.taxes || {
            total: 0,
            breakdown: { headTax: 0, industryTax: 0, subsidy: 0, policyIncome: 0, policyExpense: 0 },
            efficiency: 1,
        });
        const defaultTaxPolicies = {
            headTaxRates: buildDefaultHeadTaxRates(),
            resourceTaxRates: buildDefaultResourceTaxRates(),
            businessTaxRates: buildDefaultBusinessTaxRates(),
            exportTariffMultipliers: {},
            importTariffMultipliers: {},
            resourceTariffMultipliers: {},
            _headTaxVersion: 3,
        };
        const loadedTaxPolicies = data.taxPolicies || {};
        if (!loadedTaxPolicies._headTaxVersion && loadedTaxPolicies.headTaxRates) {
            const htr = loadedTaxPolicies.headTaxRates;
            const HEAD_TAX_BASE = 0.05;
            const HEAD_TAX_RATIO = 0.10;
            const MAX_NEW_RATE = 5.0;
            const savedWages = data.market?.wages || {};
            Object.keys(htr).forEach(key => {
                if (key.startsWith('_')) return;
                const oldRate = htr[key];
                if (oldRate > 0) {
                    const oldTaxPerCapita = oldRate * (STRATA[key]?.headTaxBase ?? HEAD_TAX_BASE);
                    const wage = savedWages[key];
                    if (wage > 0) {
                        const incomeShare = oldTaxPerCapita / wage;
                        const newRate = incomeShare / HEAD_TAX_RATIO;
                        htr[key] = Math.min(newRate, MAX_NEW_RATE);
                        console.log(`[Save Migration] headTaxRates.${key}: old ${oldRate}脳${HEAD_TAX_BASE}=${oldTaxPerCapita.toFixed(3)}/浜?鏃? wage=${wage.toFixed(3)}, share=${(incomeShare * 100).toFixed(1)}% -> newRate=${htr[key].toFixed(3)}`);
                    } else {
                        htr[key] = Math.min(oldRate, 1.0);
                        console.log(`[Save Migration] headTaxRates.${key}: no wage data, old ${oldRate} -> capped ${htr[key]}`);
                    }
                } else if (oldRate < 0) {
                    const oldSubsidy = Math.abs(oldRate) * (STRATA[key]?.headTaxBase ?? HEAD_TAX_BASE);
                    htr[key] = -oldSubsidy;
                    console.log(`[Save Migration] headTaxRates.${key}: old subsidy multiplier ${oldRate} -> absolute -${oldSubsidy.toFixed(4)}`);
                }
            });
            loadedTaxPolicies._headTaxVersion = 2;
            console.log('[Save Migration] headTaxRates migrated to v2 (income-proportional)');
        }
        // v2 鈫?v3: HEAD_TAX_INCOME_RATIO 浠?0.05 鏀逛负 1.0锛宧eadTaxRates 鐩存帴瀛樺偍绋庣巼姣旂巼
        // 鏃?v2 鏍煎紡: rate 鏄?multiplier, 瀹為檯绋庣巼 = 0.05 脳 multiplier
        // 鏂?v3 鏍煎紡: rate 鐩存帴鏄◣鐜囨瘮鐜? 瀹為檯绋庣巼 = 1.0 脳 rate = rate
        // 杩佺Щ: newRate = oldMultiplier 脳 0.05
        if (loadedTaxPolicies._headTaxVersion === 2 && loadedTaxPolicies.headTaxRates) {
            const htr = loadedTaxPolicies.headTaxRates;
            const OLD_BASE = 0.05;
            Object.keys(htr).forEach(key => {
                if (key.startsWith('_')) return;
                const oldMultiplier = htr[key];
                if (oldMultiplier >= 0) {
                    htr[key] = oldMultiplier * OLD_BASE;
                }
                // 璐熷€硷紙琛ヨ创妯″紡锛変繚鎸佷笉鍙橈紝鍥犱负琛ヨ创鏄粷瀵瑰€?            });
            loadedTaxPolicies._headTaxVersion = 3;
            console.log('[Save Migration] headTaxRates migrated to v3 (direct ratio, HEAD_TAX_INCOME_RATIO=1.0)');
        }
        setTaxPolicies({
            ...defaultTaxPolicies,
            ...loadedTaxPolicies,
            exportTariffMultipliers: loadedTaxPolicies.exportTariffMultipliers
                ?? loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.exportTariffMultipliers,
            importTariffMultipliers: loadedTaxPolicies.importTariffMultipliers
                ?? loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.importTariffMultipliers,
            resourceTariffMultipliers: loadedTaxPolicies.resourceTariffMultipliers
                ?? defaultTaxPolicies.resourceTariffMultipliers,
        });
        setJobFill(data.jobFill || {});
        const loadedMarket = trimMarketSnapshot(
            data.market || buildInitialMarket(),
            AUTO_SAVE_LIMITS.marketHistory,
        );
        setMarket(loadedMarket);
        const loadedMerchantStateRaw = data.merchantState || buildInitialMerchantState();
        setMerchantState({
            ...buildInitialMerchantState(),
            ...(loadedMerchantStateRaw || {}),
            merchantAssignments: (loadedMerchantStateRaw && typeof loadedMerchantStateRaw === 'object' && loadedMerchantStateRaw.merchantAssignments && typeof loadedMerchantStateRaw.merchantAssignments === 'object')
                ? loadedMerchantStateRaw.merchantAssignments
                : (loadedMerchantStateRaw?.assignments && typeof loadedMerchantStateRaw.assignments === 'object' ? loadedMerchantStateRaw.assignments : {}),
        });
        setTradeStats(data.tradeStats || { tradeTax: 0 });
        setDiplomacyOrganizations(migrateDiplomacyOrganizations(data.diplomacyOrganizations));
        setVassalDiplomacyQueue(Array.isArray(data.vassalDiplomacyQueue) ? data.vassalDiplomacyQueue : []);
        setVassalDiplomacyHistory(Array.isArray(data.vassalDiplomacyHistory) ? data.vassalDiplomacyHistory : []);
        setOverseasBuildings(data.overseasBuildings || buildInitialOverseasBuildings());
        setOverseasInvestments(migrateOverseasInvestments(data.overseasInvestments || []));
        setForeignInvestments(migrateForeignInvestments(data.foreignInvestments || []));
        setForeignInvestmentPolicy(data.foreignInvestmentPolicy || 'normal');
        setForeignInvestmentPolicyOverrides(data.foreignInvestmentPolicyOverrides || {});
        setAutoSaveInterval(data.autoSaveInterval ?? 60);
        setIsAutoSaveEnabled(data.isAutoSaveEnabled ?? true);
        setLastAutoSaveTime(data.lastAutoSaveTime || Date.now());
        setDifficulty(data.difficulty || DEFAULT_DIFFICULTY);
        setEmpireName(data.empireName || '鎴戠殑甯濆浗');
        setEventEffectSettings({
            ...DEFAULT_EVENT_EFFECT_SETTINGS,
            ...(data.eventEffectSettings || {}),
            logVisibility: {
                ...DEFAULT_EVENT_EFFECT_SETTINGS.logVisibility,
                ...((data.eventEffectSettings || {}).logVisibility || {}),
            },
        });
        const loadedEffects = data.activeEventEffects || {};
        setActiveEventEffects({
            approval: Array.isArray(loadedEffects.approval) ? loadedEffects.approval : [],
            stability: Array.isArray(loadedEffects.stability) ? loadedEffects.stability : [],
            resourceDemand: Array.isArray(loadedEffects.resourceDemand) ? loadedEffects.resourceDemand : [],
            stratumDemand: Array.isArray(loadedEffects.stratumDemand) ? loadedEffects.stratumDemand : [],
            buildingProduction: Array.isArray(loadedEffects.buildingProduction) ? loadedEffects.buildingProduction : [],
            forcedSubsidy: Array.isArray(loadedEffects.forcedSubsidy) ? loadedEffects.forcedSubsidy : [],
        });
        setRebellionStates(data.rebellionStates || {});
        // 濡傛灉瀛樻。娌℃湁鑱旂洘鎴栦负绌烘暟缁勶紝榛樿浣跨敤鑷€曞啘
        const loadedCoalition = data.rulingCoalition;
        setRulingCoalition(Array.isArray(loadedCoalition) && loadedCoalition.length > 0 ? loadedCoalition : ['peasant']);
        setLegitimacy(data.legitimacy || 0);
        setIdeologyScore(data.ideologyScore ?? 0);
        setIdeologyScoreSpent(data.ideologyScoreSpent ?? 0);
        setIdeologyCollection(Array.isArray(data.ideologyCollection) ? data.ideologyCollection : []);
        setEquippedIdeologies(Array.isArray(data.equippedIdeologies) ? data.equippedIdeologies : []);
        setIdeologySlotCount(data.ideologySlotCount ?? 3);
        setIdeologyCooldowns(data.ideologyCooldowns || {});
        setIdeologyMilestones(Array.isArray(data.ideologyMilestones) ? data.ideologyMilestones : []);
        setPendingIdeologyEmergence(data.pendingIdeologyEmergence ?? null);
        setIdeologyEmergenceRarityBonus(data.ideologyEmergenceRarityBonus ?? 0);
        setActionUsage(data.actionUsage || {});
        setPromiseTasks(data.promiseTasks || []);
        setEventConfirmationEnabled(data.eventConfirmationEnabled || false);
        // [PR-3] 鍔犺浇瀹屾垚鍚庢竻绌哄垎鐗?dirty 缂撳瓨锛屽己鍒朵笅涓€娆?saveGame 鍏ㄩ噺鍐欏叆鎵€鏈夊垎鐗囷紝
        // 浠ョ‘淇?IDB 鍐呭涓庡垰鍔犺浇鐨勫唴瀛樼姸鎬佸畬鍏ㄤ竴鑷达紙閬垮厤娈嬬暀鐨勪笂娆′細璇濆揩鐓ч€犳垚璺宠繃锛?        lastSavedShardJsonsRef.current = {};
    };

    const saveGame = async ({ source = 'manual', slotIndex = 0 } = {}) => {
        if (source === 'auto' && (autoSaveBlocked || !isAutoSaveEnabled)) {
            return;
        }
        trackSaveGame(daysElapsed, source);
        const timestamp = Date.now();
        const { payload } = buildSavePayload({ source, timestamp });
        // [PR-1] 濮嬬粓璧?compact 璺緞锛坢anual/auto 涓€鑷达紝鍑忓皯鍘嗗彶鍒嗘敮锛?        const payloadToSave = compactSavePayload(payload);
        let targetKey;
        let friendlyName;

        // [PR-1] 閫氱敤杈呭姪锛氫竴娆?stringify 寰楀埌 JSON + size 鎻忚堪
        const stringifyAndSize = (obj) => {
            const json = JSON.stringify(obj);
            return { json, size: sizeDescFromString(json) };
        };
        const primaryStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        // [PR-2] 鍒嗙墖璺緞锛欼DB 鍙敤鏃朵紭鍏堜娇鐢紝閬垮厤鍗曟 stringify 鏁翠釜 payload銆?        //   localStorage 鍙啓涓€涓瀬灏忕殑 stub锛屾墍鏈夐噸閲忕骇鏁版嵁钀藉埌 IDB 鍒嗙墖涓€?        // [PR-1] 濡傛灉鍒嗙墖璺緞涓嶅彲鐢紙IDB 涓嶅彲鐢ㄦ垨鍒嗙墖鍐欏叆澶辫触锛夛紝鎵嶅洖閫€鍒?stringify 鏁翠釜 payload 鐨勬棫璺緞銆?        let primaryJson = null;
        let saveSize = { bytes: 0, kb: '0', mb: '0', display: '0KB' };

        // 璐┛鏁翠釜 saveGame 鐨勭姸鎬佸彉閲忥紝鐢ㄤ簬缁撴潫鏃剁粺涓€涓婃姤鍩嬬偣
        let savePathLabel = 'unknown';
        let saveSucceeded = false;
        let saveBytesReported = 0;
        const shardByteBreakdown = {};

        // [PR-2/PR-3] 宸ュ叿锛氭竻鐞嗕竴涓瓨妗?key 鍏宠仈鐨勬墍鏈夊瓨鍌?        //   localStorage stub + IDB 涓婚敭 + IDB 鎵€鏈夊垎鐗?+ 鏈湴 dirty-bit 缂撳瓨
        const removeSaveEverywhere = (key, { parsedStub = null } = {}) => {
            try { localStorage.removeItem(key); } catch { /* noop */ }
            void removeSaveFromIndexedDb(key);
            const shardNames = (parsedStub && Array.isArray(parsedStub.shards) && parsedStub.shards.length)
                ? parsedStub.shards
                : SHARD_NAMES;
            for (const name of shardNames) {
                void removeSaveFromIndexedDb(shardKeyFor(key, name));
            }
            // 娓呮帀 dirty-bit 缂撳瓨锛岃涓嬫淇濆瓨鍒拌繖涓?key 鏃惰蛋鍏ㄩ噺
            if (lastSavedShardJsonsRef.current[key]) {
                delete lastSavedShardJsonsRef.current[key];
            }
        };

        // Helper function to clean up old saves
        const cleanupOldSaves = ({ includeAutoSave = false } = {}) => {
            try {
                // Find and remove oldest manual save slots (keep only the most recent 3)
                const saveSlots = [];
                for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
                    const key = `${SAVE_SLOT_PREFIX}${i}`;
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            const parsed = JSON.parse(data);
                            saveSlots.push({ key, timestamp: parsed.updatedAt || 0, size: data.length, parsed });
                        } catch (e) {
                            // Invalid save, remove it锛堣繕鏈夊彲鑳界暀涓嬪鍎垮垎鐗囷紝杩欓噷椤烘墜娓呬竴涓嬶級
                            removeSaveEverywhere(key);
                        }
                    }
                }

                // Sort by timestamp (oldest first) and remove oldest saves
                saveSlots.sort((a, b) => a.timestamp - b.timestamp);
                const toRemove = saveSlots.slice(0, Math.max(0, saveSlots.length - 3));
                toRemove.forEach(slot => {
                    removeSaveEverywhere(slot.key, { parsedStub: slot.parsed });
                    console.log(`Cleaned up old save: ${slot.key} (${(slot.size / 1024).toFixed(1)}KB)`);
                });

                let removedAuto = false;
                if (includeAutoSave && localStorage.getItem(AUTOSAVE_KEY)) {
                    let autoParsed = null;
                    try { autoParsed = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); } catch { /* noop */ }
                    removeSaveEverywhere(AUTOSAVE_KEY, { parsedStub: autoParsed });
                    removedAuto = true;
                    console.log('Cleaned up autosave to free space.');
                }

                if (localStorage.getItem(LEGACY_SAVE_KEY)) {
                    localStorage.removeItem(LEGACY_SAVE_KEY);
                }

                return toRemove.length > 0 || removedAuto;
            } catch (e) {
                console.error('Failed to cleanup old saves:', e);
                return false;
            }
        };

        const shouldUseExternalStorage = (bytes) => hasIndexedDb() && bytes >= LOCAL_STORAGE_SOFT_LIMIT;

        // [PR-1] persistExternalSave 缁熶竴鎺ユ敹"宸?stringify 鐨?JSON 瀛楃涓?+ 鍘熷 payload + size 鎻忚堪"
        //   jsonString锛氱洿鎺?put 杩?IDB锛岄伩鍏嶅湪鍐欑洏鏃跺啀 stringify 涓€娆?        //   payloadForStub锛氱敤浜庢瀯閫?localStorage stub锛堝彧璇诲皬瀛楁锛?        const persistExternalSave = async (jsonString, payloadForStub, saveSize) => {
            if (!hasIndexedDb()) {
                return false;
            }
            try {
                await writeSaveToIndexedDb(targetKey, jsonString);
            } catch (error) {
                console.error('External save failed:', error);
                return false;
            }

            const stub = buildExternalSaveStub(payloadForStub, { sizeBytes: saveSize.bytes });
            const stubJson = JSON.stringify(stub);
            let stubStored = false;
            try {
                localStorage.setItem(targetKey, stubJson);
                stubStored = true;
            } catch (stubError) {
                const cleaned = cleanupOldSaves({ includeAutoSave: source !== 'auto' });
                if (cleaned) {
                    try {
                        localStorage.setItem(targetKey, stubJson);
                        stubStored = true;
                    } catch (retryError) {
                        console.warn('Failed to store external save stub:', retryError);
                    }
                }
            }

            if (!stubStored) {
                void removeSaveFromIndexedDb(targetKey);
                return false;
            }

            triggerSavingIndicator();
            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry(`馃捑 娓告垙宸蹭繚瀛樺埌${friendlyName}锟?${saveSize.display})`);
            }
            return true;
        };

        // [PR-2/PR-3] 鎶?payload 鎷嗘垚 5 涓垎鐗囩嫭绔嬪啓鍏?IDB锛沴ocalStorage 鍙暀 stub 绱㈠紩
        //   - 鎴愬姛鏉′欢锛歴tate + nations 涓ょ墖蹇呴』閮芥垚鍔燂紙鎴栬鍒ゅ畾涓烘湭鍙樻洿锛夛紱
        //     鍏朵綑 history/market/social 澶辫触涓嶉樆鏂?save锛屼粎鍦?stub.failedShards 閲岃褰曘€?        //   - PR-3 dirty-bit锛氬姣旀瘡鐗?JSON 涓庝笂娆″啓鍏ョ殑鐗堟湰锛屾湭鍙樻洿鐨勫垎鐗囩洿鎺ヨ烦杩?IDB 鍐欏叆锛?        //     鍙湪 stub.shardSizes 閲屾部鐢ㄦ棫灏哄銆傛墜鍔ㄥ瓨妗?(source==='manual') 寮哄埗鍏ㄩ噺銆?        const writeShardedSave = async (shardedPayload) => {
            if (!hasIndexedDb()) {
                return { ok: false, reason: 'no-idb' };
            }
            const shards = splitPayloadToShards(shardedPayload);
            const shardSizes = {};
            const shardJsons = {};
            let totalBytes = 0;

            // [PR-4] 浼樺厛鎶?stringify 涓㈢粰 save.worker锛涗富绾跨▼鍙礋璐?postMessage锛堚増structuredClone 涓€娆★級
            //   - worker 鎴愬姛锛氱洿鎺ユ嬁鍒版墍鏈?shard 鐨?json/size锛屼富绾跨▼璺宠繃 3MB 绾х殑 JSON.stringify
            //   - worker 澶辫触鎴栦笉瀛樺湪锛氬洖閫€鍒颁富绾跨▼涓茶 stringify 璺緞锛圥R-1 鐨勫疄鐜帮級
            //   - "superseded" 涓嶇畻閿欒锛屼絾浣滀负鍚堝苟瑕嗙洊鐨勪俊鍙疯涓婂眰璺宠繃鏈鍐欏叆
            // [PR-5] 鍚屾椂鍙€夎 worker 鍋?gzip 鍘嬬缉锛岄檷浣?IDB 鍐欑洏閲忥紙瀹炴祴 10鈥?0% 鍘熶綋绉級
            let workerUsed = false;
            let supersededBySaveWorker = false;
            let shardBlobs = null;           // [PR-5] 姣忕墖鐨?gzip Uint8Array锛堣嫢鍘嬬缉鍚敤涓旀垚鍔燂級
            let shardCompressedSizes = null; // [PR-5] 姣忕墖鐨勫帇缂╁瓧鑺傛暟
            let compressionActive = false;   // [PR-5] 鏈鍐欏叆鏈€缁堟槸鍚﹁蛋浜嗗帇缂╅€氶亾
            try {
                const workerShards = {
                    state: shards.state,
                    nations: shards.nations,
                    history: shards.history,
                    market: shards.market,
                    social: shards.social,
                };
                const compressRequested = isSaveCompressionEnabled();
                const result = await stringifyShardsInWorker(workerShards, { compress: compressRequested });
                if (result && result.jsons) {
                    for (const name of SHARD_NAMES) {
                        const json = result.jsons[name];
                        shardJsons[name] = typeof json === 'string' ? json : 'null';
                        const size = result.sizes && typeof result.sizes[name] === 'number'
                            ? result.sizes[name]
                            : Math.ceil(shardJsons[name].length * 1.02);
                        shardSizes[name] = size;
                        totalBytes += size;
                    }
                    if (result.compressionUsed && result.compressedBlobs) {
                        shardBlobs = result.compressedBlobs;
                        shardCompressedSizes = result.compressedSizes || {};
                        compressionActive = true;
                    }
                    workerUsed = true;
                }
            } catch (err) {
                const kind = (err && err.kind) || 'unknown';
                if (kind === SAVE_WORKER_ERROR_KINDS.SUPERSEDED) {
                    // 鏇存柊鐨勪竴娆¤嚜鍔ㄥ瓨妗ｅ凡缁忚繘鍏ラ槦鍒楋細鐩存帴鏀惧純褰撳墠鍐欏叆锛岃鍚庨潰閭ｆ鏉ュ仛
                    supersededBySaveWorker = true;
                } else if (kind === SAVE_WORKER_ERROR_KINDS.NO_WORKER) {
                    // 鐜涓嶆敮鎸?Worker / 琚?runtime flag 鍏虫帀锛涗笉鍋氬煁鐐癸紙saveWorkerClient 宸茬粡鐐硅繃涓€娆★級
                } else {
                    console.warn('[Save] save.worker failed, fallback to main-thread stringify:', err);
                    try { trackSaveWorkerFallback(kind); } catch { /* noop */ }
                }
            }

            if (supersededBySaveWorker) {
                return { ok: false, reason: 'superseded' };
            }

            if (!workerUsed) {
                // 涓荤嚎绋嬪厹搴曡矾寰勶細涓茶 stringify 5 浠斤紱姣忎唤閮芥瘮鏁?payload 灏忓緱澶?                for (const name of SHARD_NAMES) {
                    const value = name === 'nations' ? shards.nations : shards[name];
                    const json = value === null || value === undefined ? 'null' : JSON.stringify(value);
                    shardJsons[name] = json;
                    shardSizes[name] = Math.ceil(json.length * 1.02);
                    totalBytes += shardSizes[name];
                }
            }

            // [PR-3] 鍩轰簬涓婁竴娆?save 蹇収璁＄畻姣忕墖鏄惁闇€瑕佸啓鍏?            const forceAll = source === 'manual';
            const lastSnap = lastSavedShardJsonsRef.current[targetKey] || {};
            const dirtyFlags = {};
            const skippedShards = [];
            for (const name of SHARD_NAMES) {
                if (forceAll || lastSnap[name] !== shardJsons[name]) {
                    dirtyFlags[name] = true;
                } else {
                    dirtyFlags[name] = false;
                    skippedShards.push(name);
                }
            }

            // 浼樺厛鍐?state + nations锛堝繀閫夛紝鑻ユ湭 dirty 鍒欑洿鎺ュ垽閫氳繃锛?            // [PR-5] 鑻ユ湰娆″帇缂╂垚鍔燂紝鍐欏叆 Uint8Array锛圛DB 鍘熺敓鏀寔 Blob/ArrayBuffer/TypedArray锛夛紝
            //        鍚﹀垯鍐欏叆 JSON 瀛楃涓诧紱涓ょ鏍煎紡 loadGame 渚ч兘浼氳瘑鍒?            const writeOne = async (name) => {
                if (!dirtyFlags[name]) return; // 鑴忎綅娓呴浂璺宠繃
                const value = (compressionActive && shardBlobs && shardBlobs[name])
                    ? shardBlobs[name]
                    : shardJsons[name];
                await writeSaveToIndexedDb(shardKeyFor(targetKey, name), value);
            };
            try {
                await writeOne('state');
                await writeOne('nations');
            } catch (error) {
                console.error('[Save] sharded primary write failed:', error);
                // 娓呯悊宸插啓鍏ョ殑閮ㄥ垎锛岄槻姝笅娆¤鍙栨椂鎶婂崐鎴暟鎹?merge 杩涘幓
                for (const name of SHARD_NAMES) {
                    try { await removeSaveFromIndexedDb(shardKeyFor(targetKey, name)); } catch { /* noop */ }
                }
                delete lastSavedShardJsonsRef.current[targetKey];
                return { ok: false, reason: 'shard-primary-failed', error };
            }

            const secondary = ['history', 'market', 'social'];
            const secondaryResults = await Promise.allSettled(secondary.map(writeOne));
            const failedSecondary = [];
            secondaryResults.forEach((r, i) => {
                if (r.status === 'rejected') failedSecondary.push(secondary[i]);
            });

            // [PR-5] 鑻ユ湰娆″帇缂╂垚鍔燂紝stub.sizeBytes 浠ュ帇缂╁悗鐨勫瓧鑺備负鍑嗭紙鍙嶆槧鐪熷疄纾佺洏鍗犵敤锛夛紝
            //        骞堕檮甯﹀師濮嬪瓧鑺備緵鍥炵湅锛沴oadGame 涓嶄緷璧栬繖閲岋紝绾补瑙傛祴鐢?            let stubSizeBytes = totalBytes;
            let totalCompressedBytes = 0;
            if (compressionActive && shardCompressedSizes) {
                totalCompressedBytes = SHARD_NAMES.reduce(
                    (sum, n) => sum + (shardCompressedSizes[n] || 0),
                    0
                );
                if (totalCompressedBytes > 0) stubSizeBytes = totalCompressedBytes;
            }

            // 鍐?stub 鍒?localStorage锛堝皬鏁版嵁锛屽悓姝ュ啓浣?< 1KB锛屼富绾跨▼寮€閿€鍙拷鐣ワ級
            const stub = buildShardedSaveStub(shardedPayload, {
                sizeBytes: stubSizeBytes,
                shardSizes: compressionActive && shardCompressedSizes ? shardCompressedSizes : shardSizes,
                failedShards: failedSecondary,
            });
            if (compressionActive) {
                stub.compression = 'gzip';
                stub.rawBytes = totalBytes; // 鏈帇缂╀綋绉紝璋冭瘯/瑙傛祴鐢?            }
            const stubJson = JSON.stringify(stub);
            try {
                localStorage.setItem(targetKey, stubJson);
            } catch (stubError) {
                // stub 鍐欏け璐ュ線寰€鏄?localStorage 婊★細娓呯悊鑰佸瓨妗ｅ悗鍐嶈瘯涓€娆?                const cleaned = cleanupOldSaves({ includeAutoSave: source !== 'auto' });
                if (cleaned) {
                    try {
                        localStorage.setItem(targetKey, stubJson);
                    } catch (retryError) {
                        console.warn('[Save] Failed to store sharded stub after cleanup:', retryError);
                        // 鍒犳帀宸插啓鍏ョ殑鍒嗙墖锛屼繚鎸佷竴鑷存€?                        for (const name of SHARD_NAMES) {
                            try { await removeSaveFromIndexedDb(shardKeyFor(targetKey, name)); } catch { /* noop */ }
                        }
                        return { ok: false, reason: 'stub-quota', error: retryError };
                    }
                } else {
                    for (const name of SHARD_NAMES) {
                        try { await removeSaveFromIndexedDb(shardKeyFor(targetKey, name)); } catch { /* noop */ }
                    }
                    return { ok: false, reason: 'stub-quota', error: stubError };
                }
            }

            // 鍗囩骇娓呯悊锛歷1 瀛樻。鍦?targetKey 涓嬬殑 IDB 鏁村潡 payload 鐜板湪宸插簾寮?            // 濡傛灉杩欐槸涓€娆′粠 v1 鈫?v2 鐨勪繚瀛橈紝椤烘墜娓呮帀閭ｄ釜鏁村潡锛岄槻姝㈠崰绌洪棿
            try { await removeSaveFromIndexedDb(targetKey); } catch { /* noop */ }

            // [PR-3] 璁板綍鏈鍐欏叆鐨勫揩鐓э紱澶辫触鐨?secondary 鍒嗙墖涓嶆洿鏂帮紙淇濇寔 dirty锛夛紝涓嬫閲嶈瘯
            const nextSnap = { ...(lastSavedShardJsonsRef.current[targetKey] || {}) };
            for (const name of SHARD_NAMES) {
                if (failedSecondary.includes(name)) continue;
                nextSnap[name] = shardJsons[name];
            }
            lastSavedShardJsonsRef.current[targetKey] = nextSnap;

            return {
                ok: true,
                bytes: totalBytes,
                shardSizes,
                failedSecondary,
                skippedShards,
                dirtyShards: SHARD_NAMES.filter((n) => dirtyFlags[n]),
                // [PR-5] 鍘嬬缉鐩稿叧锛屼緵 saveGame 涓婃姤鍩嬬偣鐢?                compressionUsed: compressionActive,
                compressedBytes: totalCompressedBytes,
                shardCompressedSizes: compressionActive ? shardCompressedSizes : null,
            };
        };

        try {

            // 纭畾瀛樺偍 key
            if (source === 'auto') {
                targetKey = AUTOSAVE_KEY;
                friendlyName = '鑷姩瀛樻。';
            } else {
                // 鎵嬪姩瀛樻。浣跨敤妲戒綅
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `瀛樻。 ${safeIndex + 1}`;
            }

            // [PR-2] 涓昏矾寰勶細IDB 鍒嗙墖銆侷DB 鍙敤鍗充紭鍏堜娇鐢ㄣ€?            if (hasIndexedDb()) {
                const sharded = await writeShardedSave(payloadToSave);
                if (sharded.ok) {
                    // [PR-3/PR-5] shardByteBreakdown 鍙褰曠湡姝ｅ啓鍏?IDB 鐨勫垎鐗囧瓧鑺傛暟锛?                    // 鏈?dirty 鐨勫垎鐗囦互 0 涓婃姤锛堜究浜庡湪鐪嬫澘涓婄湅 dirty-bit 鐨勫懡涓巼锛?                    // 鍘嬬缉鍚敤鏃舵敼鐢ㄥ帇缂╁悗鐨勫瓧鑺傦紝鍙嶆槧鐪熷疄纾佺洏鍐欏叆閲?                    const sizeTable = sharded.compressionUsed && sharded.shardCompressedSizes
                        ? sharded.shardCompressedSizes
                        : sharded.shardSizes;
                    for (const name of SHARD_NAMES) {
                        const wroteThisShard = sharded.dirtyShards && sharded.dirtyShards.includes(name);
                        shardByteBreakdown[name] = wroteThisShard ? (sizeTable[name] || 0) : 0;
                    }
                    const bytesWritten = (sharded.dirtyShards || []).reduce((sum, n) => sum + (sizeTable[n] || 0), 0);
                    triggerSavingIndicator();
                    if (source === 'auto') {
                        setLastAutoSaveTime(timestamp);
                    } else {
                        // 鐢?鏈鍐欏叆閲?鏋勯€?sizeDesc锛涙墜鍔ㄥ瓨妗?dirty-bit 寮哄埗鍏ㄩ噺鎵€浠ョ瓑浜?bytes 鎬婚噺
                        const bytesForDisplay = source === 'manual' ? sharded.bytes : bytesWritten || sharded.bytes;
                        saveSize = {
                            bytes: bytesForDisplay,
                            kb: (bytesForDisplay / 1024).toFixed(1),
                            mb: (bytesForDisplay / (1024 * 1024)).toFixed(2),
                            display: bytesForDisplay > 1024 * 1024
                                ? `${(bytesForDisplay / (1024 * 1024)).toFixed(2)}MB`
                                : `${(bytesForDisplay / 1024).toFixed(1)}KB`,
                        };
                        addLogEntry(`馃捑 娓告垙宸蹭繚瀛樺埌${friendlyName}锟?${saveSize.display})`);
                    }
                    if (sharded.failedSecondary && sharded.failedSecondary.length) {
                        savePathLabel = 'idb_sharded_partial';
                    } else if (sharded.skippedShards && sharded.skippedShards.length === SHARD_NAMES.length) {
                        // 鍏ㄩ儴 shard 閮芥湭鍙樻洿锛氬彧鏇存柊浜?stub锛堝嚑鐧惧瓧鑺傦級
                        savePathLabel = 'idb_sharded_stuponly';
                    } else if (sharded.skippedShards && sharded.skippedShards.length > 0) {
                        savePathLabel = 'idb_sharded_incremental';
                    } else {
                        savePathLabel = 'idb_sharded';
                    }
                    // [PR-5] 鍘嬬缉璺緞鍗曠嫭鎵撲竴涓悗缂€锛屼究浜庣湅鏉垮尯鍒?gzip/鏈帇缂╃殑鍐欏叆鍒嗗竷
                    if (sharded.compressionUsed) {
                        savePathLabel = `${savePathLabel}_gz`;
                    }
                    saveSucceeded = true;
                    // 涓婃姤"瀹為檯鍐欏叆瀛楄妭"鑰岄潪 payload 鎬诲ぇ灏忥紝瑙傛祴 dirty-bit 鐨勬敹鐩?                    saveBytesReported = bytesWritten || sharded.bytes;
                    return;
                }
                // [PR-4] save.worker 鍚堝苟瑕嗙洊锛氳繖娆¤姹傝鍚庝竴娆℃柊璇锋眰鍙栦唬浜嗐€?                // 涓嶆槸閿欒锛岀洿鎺ラ潤榛樿繑鍥烇紝璁╂洿鏂扮殑閭ｆ鍐欏叆瀹屾垚鍗冲彲锛岄伩鍏嶅娆¤惤鐩樸€?                if (sharded.reason === 'superseded') {
                    savePathLabel = 'superseded';
                    saveBytesReported = 0;
                    return;
                }
                // 鍒嗙墖鍐欏け璐ワ細钀藉埌涓嬮潰鐨勬棫璺緞
                console.warn('[Save] Sharded path unavailable, falling back to legacy single-blob:', sharded.reason);
            }

            // [Legacy] 鍗?blob 璺緞锛堜粎鍦?IDB 涓嶅彲鐢?/ 鍒嗙墖鍐欏け璐ユ椂璧帮級
            const primary = stringifyAndSize(payloadToSave);
            primaryJson = primary.json;
            saveSize = primary.size;
            console.log(`Attempting to save (${friendlyName}): ${saveSize.display}`);

            if (shouldUseExternalStorage(saveSize.bytes)) {
                const stored = await persistExternalSave(primaryJson, payloadToSave, saveSize);
                if (stored) {
                    savePathLabel = 'idb_direct';
                    saveSucceeded = true;
                    saveBytesReported = saveSize.bytes;
                    return;
                }
            }

            localStorage.setItem(targetKey, primaryJson);
            triggerSavingIndicator();

            if (source === 'auto') {
                setLastAutoSaveTime(timestamp);
            } else {
                addLogEntry(`馃捑 娓告垙宸蹭繚瀛樺埌${friendlyName}锟?${saveSize.display})`);
            }
            savePathLabel = 'localstorage_direct';
            saveSucceeded = true;
            saveBytesReported = saveSize.bytes;
        } catch (error) {
            const isQuotaExceeded = error?.name === 'QuotaExceededError'
                || `${error?.message || ''}`.toLowerCase().includes('quota');
            if (isQuotaExceeded) {
                // [PR-1] Quota 鍥為€€閾惧唴姣忎竴姝ヤ篃鍙?stringify 涓€娆★紝娌跨敤鐩稿悓瀛楃涓插仛灏哄浼扮畻涓庡啓鐩?                const stringifyAndSize = (obj) => {
                    const json = JSON.stringify(obj);
                    return { json, size: sizeDescFromString(json) };
                };

                // On quota exceeded, try IndexedDB first (don't rely on size threshold)
                if (hasIndexedDb()) {
                    console.log('Quota exceeded - trying IndexedDB directly...');
                    const compactedPayload = compactSavePayload(payload, { aggressive: true });
                    const { json: compactJson, size: compactSize } = stringifyAndSize(compactedPayload);
                    const stored = await persistExternalSave(compactJson, compactedPayload, compactSize);
                    if (stored) {
                        addLogEntry(`鈿狅笍 瀛樻。绌洪棿涓嶈冻锛屽凡淇濆瓨鍒版祻瑙堝櫒鏁版嵁锟?(${compactSize.display})銆俙);
                        savePathLabel = 'idb_compact';
                        saveSucceeded = true;
                        saveBytesReported = compactSize.bytes;
                        return;
                    }
                }

                // Fallback: Try aggressive compaction to localStorage
                try {
                    const compactedPayload = compactSavePayload(payload, { aggressive: true });
                    const { json: compactJson, size: compactSize } = stringifyAndSize(compactedPayload);
                    console.log(`Trying compact save: ${compactSize.display}`);

                    localStorage.setItem(targetKey, compactJson);
                    triggerSavingIndicator();
                    if (source === 'auto') {
                        setLastAutoSaveTime(timestamp);
                    }
                    addLogEntry(`鈿狅笍 瀛樻。绌洪棿涓嶈冻锛屽凡浣跨敤绮剧畝瀛樻。 (${compactSize.display})銆俙);
                    savePathLabel = 'localstorage_compact';
                    saveSucceeded = true;
                    saveBytesReported = compactSize.bytes;
                    return;
                } catch (fallbackError) {
                    console.error('Compact save failed:', fallbackError);
                }

                // Try minimal save for manual save as last resort
                if (source !== 'auto') {
                    try {
                        const minimalPayload = {
                            ...buildMinimalAutoSavePayload(payload),
                            saveSource: 'manual-minimal',
                        };
                        const { json: minimalJson, size: minimalSize } = stringifyAndSize(minimalPayload);
                        console.log(`Trying minimal manual save: ${minimalSize.display}`);

                        // Try IndexedDB first for minimal save too
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(minimalJson, minimalPayload, minimalSize);
                            if (stored) {
                                addLogEntry(`鈿狅笍 瀛樻。宸蹭繚瀛樺埌娴忚鍣ㄦ暟鎹簱 (${minimalSize.display})銆俙);
                                savePathLabel = 'idb_minimal';
                                saveSucceeded = true;
                                saveBytesReported = minimalSize.bytes;
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, minimalJson);
                        triggerSavingIndicator();
                        addLogEntry(`鈿狅笍 瀛樻。绌洪棿涓嶈冻锛屽凡鍒囨崲涓烘渶灏忓瓨锟?(${minimalSize.display})銆俙);
                        savePathLabel = 'localstorage_minimal';
                        saveSucceeded = true;
                        saveBytesReported = minimalSize.bytes;
                        return;
                    } catch (minimalManualError) {
                        console.error('Minimal manual save failed:', minimalManualError);
                    }
                }

                // Try minimal save for auto-save
                if (source === 'auto') {
                    try {
                        const minimalPayload = buildMinimalAutoSavePayload(payload);
                        const { json: minimalJson, size: minimalSize } = stringifyAndSize(minimalPayload);
                        console.log(`Trying minimal save: ${minimalSize.display}`);

                        // Try IndexedDB first for minimal save too
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(minimalJson, minimalPayload, minimalSize);
                            if (stored) {
                                setLastAutoSaveTime(timestamp);
                                savePathLabel = 'idb_minimal';
                                saveSucceeded = true;
                                saveBytesReported = minimalSize.bytes;
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, minimalJson);
                        triggerSavingIndicator();
                        setLastAutoSaveTime(timestamp);
                        addLogEntry(`鈿狅笍 鑷姩瀛樻。宸插垏鎹负鏈€灏忓瓨锟?(${minimalSize.display})銆俙);
                        savePathLabel = 'localstorage_minimal';
                        saveSucceeded = true;
                        saveBytesReported = minimalSize.bytes;
                        return;
                    } catch (minimalError) {
                        console.error('Minimal auto save failed:', minimalError);
                    }
                }

                // Try cleaning up old saves and retry
                const cleaned = cleanupOldSaves({ includeAutoSave: source !== 'auto' });
                if (cleaned) {
                    try {
                        const minimalPayload = source === 'auto'
                            ? buildMinimalAutoSavePayload(payload)
                            : compactSavePayload(payload, { aggressive: true });
                        const { json: retryJson, size: retrySize } = stringifyAndSize(minimalPayload);
                        console.log(`Retrying after cleanup: ${retrySize.display}`);

                        // Try IndexedDB first after cleanup
                        if (hasIndexedDb()) {
                            const stored = await persistExternalSave(retryJson, minimalPayload, retrySize);
                            if (stored) {
                                if (source === 'auto') {
                                    setLastAutoSaveTime(timestamp);
                                }
                                addLogEntry(`鈿狅笍 宸叉竻鐞嗘棫瀛樻。骞朵繚锟?(${retrySize.display})銆俙);
                                savePathLabel = 'idb_retry_clean';
                                saveSucceeded = true;
                                saveBytesReported = retrySize.bytes;
                                return;
                            }
                        }

                        localStorage.setItem(targetKey, retryJson);
                        triggerSavingIndicator();
                        if (source === 'auto') {
                            setLastAutoSaveTime(timestamp);
                        }
                        addLogEntry(`鈿狅笍 宸叉竻鐞嗘棫瀛樻。骞朵繚锟?(${retrySize.display})銆傚缓璁畾鏈熷鍑哄瓨妗ｃ€俙);
                        savePathLabel = 'localstorage_retry_clean';
                        saveSucceeded = true;
                        saveBytesReported = retrySize.bytes;
                        return;
                    } catch (retryError) {
                        console.error('Save failed after cleanup:', retryError);
                    }
                }

                // Remove redundant final IndexedDB attempt since we already tried it first

                // All attempts failed
                savePathLabel = 'quota_blocked';
                if (source === 'auto') {
                    setIsAutoSaveEnabled(false);
                    setAutoSaveBlocked(true);
                    if (!autoSaveQuotaNotifiedRef.current) {
                        autoSaveQuotaNotifiedRef.current = true;
                        addLogEntry('锟?鑷姩瀛樻。绌洪棿涓嶈冻锛屽凡鑷姩鍏抽棴銆傝瀵煎嚭瀛樻。鎴栨竻鐞嗘祻瑙堝櫒缂撳瓨锟?);
                    }
                    return;
                } else {
                    addLogEntry('锟?瀛樻。澶辫触锛氬瓨鍌ㄧ┖闂翠笉瓒炽€傝瀵煎嚭褰撳墠瀛樻。鎴栨竻鐞嗘祻瑙堝櫒缂撳瓨锟?);
                }
            } else {
                savePathLabel = 'error';
                console.error(`${source === 'auto' ? 'Auto' : 'Manual'} save failed:`, error);
                trackErrorError(`SaveWriteError: ${error.message}`);
                if (source === 'auto') {
                    addLogEntry(`锟?鑷姩瀛樻。澶辫触锟?{error.message}`);
                } else {
                    addLogEntry(`锟?瀛樻。澶辫触锟?{error.message}`);
                }
            }
            setIsSaving(false);
        } finally {
            // [PR-1/PR-2] 缁熶竴鐨?saveGame 缁撴潫鍩嬬偣锛氭棤璁烘垚鍔?澶辫触/鍝潯鍒嗘敮锛岄兘鍙笂鎶ヤ竴娆?            try {
                const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const durationMs = Math.max(0, endTime - primaryStart);
                trackSaveDuration(source, durationMs);
                trackSavePath(source, savePathLabel);
                if (saveSucceeded && saveBytesReported > 0) {
                    trackSaveBytes(source, saveBytesReported);
                    // [PR-2] 鍒嗙墖璺緞涓嬮澶栦笂鎶ユ瘡鐗囧瓧鑺傛暟锛屼究浜庤瀵熷摢涓垎鐗囨渶閲?                    for (const [name, bytes] of Object.entries(shardByteBreakdown)) {
                        if (Number.isFinite(bytes) && bytes > 0) {
                            trackSaveBytes(source, bytes, name);
                        }
                    }
                }
            } catch {
                // 鍩嬬偣寮傚父缁濅笉褰卞搷涓绘祦绋?            }
        }
    };

    const loadGame = async ({ source = 'manual', slotIndex = 0 } = {}) => {
        try {
            // 纭畾瀛樺偍 key
            let targetKey;
            let friendlyName;

            if (source === 'auto' || slotIndex === -1) {
                // 鍔犺浇鑷姩瀛樻。
                targetKey = AUTOSAVE_KEY;
                friendlyName = '鑷姩瀛樻。';
            } else {
                // 鍔犺浇鎵嬪姩瀛樻。妲戒綅
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `瀛樻。 ${safeIndex + 1}`;
            }

            const rawData = localStorage.getItem(targetKey);
            if (!rawData) {
                addLogEntry(`鈿狅笍 鏈壘锟?{friendlyName}鏁版嵁銆俙);
                return false;
            }

            const data = JSON.parse(rawData);

            // [PR-2] 鍒嗙墖瀛樻。 (v2)锛歴tub 鏈韩鍙惈绱㈠紩锛岀湡姝?payload 鍒嗘暎鍦?IDB 鐨?5 涓垎鐗囬噷
            if (isShardedSaveStub(data)) {
                if (!hasIndexedDb()) {
                    addLogEntry(`锟?${friendlyName}璇诲彇澶辫触锛氭祻瑙堝櫒涓嶆敮鎸佹墿灞曞瓨鍌ㄣ€俙);
                    return false;
                }
                const shardReads = await Promise.all(SHARD_NAMES.map(async (name) => {
                    try {
                        const raw = await readSaveFromIndexedDb(shardKeyFor(targetKey, name));
                        if (raw === null || raw === undefined) return [name, null];
                        // [PR-5] 鍐欏叆绔彲鑳芥槸瀛楃涓叉垨 gzip Uint8Array锛涜繖閲岀粺涓€杞垚 JSON 瀛楃涓插啀瑙ｆ瀽
                        const jsonString = await normalizeShardRawToJsonString(raw);
                        if (jsonString === null) return [name, null];
                        return [name, JSON.parse(jsonString)];
                    } catch (shardError) {
                        console.warn(`[Load] shard '${name}' read failed:`, shardError);
                        return [name, null];
                    }
                }));
                const shardMap = Object.fromEntries(shardReads);
                // state + nations 缂轰换涓€锛岃涓烘崯鍧?                if (!shardMap.state || shardMap.nations === null || shardMap.nations === undefined) {
                    addLogEntry(`锟?${friendlyName}璇诲彇澶辫触锛氭牳蹇冨垎鐗囩己澶便€俙);
                    return false;
                }
                const merged = mergeShardsToPayload(shardMap);
                // 鍥炲～ stub 鐨?meta锛坲pdatedAt / saveSource 绛夛紝闃叉 state 鍒嗙墖娌℃湁锛?                merged.updatedAt = merged.updatedAt ?? data.updatedAt;
                merged.saveSource = merged.saveSource ?? data.saveSource;
                applyLoadedGameState(merged);
                addLogEntry(`馃搨 ${friendlyName}璇诲彇鎴愬姛锛乣);
                trackLoadGame(merged?.daysElapsed || daysElapsed);
                return true;
            }

            if (isExternalSaveStub(data)) {
                if (!hasIndexedDb()) {
                    addLogEntry(`锟?${friendlyName}璇诲彇澶辫触锛氭祻瑙堝櫒涓嶆敮鎸佹墿灞曞瓨鍌ㄣ€俙);
                    return false;
                }
                const externalRaw = await readSaveFromIndexedDb(targetKey);
                if (!externalRaw) {
                    addLogEntry(`锟?${friendlyName}璇诲彇澶辫触锛氬閮ㄥ瓨妗ｆ暟鎹己澶便€俙);
                    return false;
                }
                const externalData = typeof externalRaw === 'string'
                    ? JSON.parse(externalRaw)
                    : externalRaw;
                applyLoadedGameState(externalData);
                addLogEntry(`馃搨 ${friendlyName}璇诲彇鎴愬姛锛乣);
                trackLoadGame(externalData?.daysElapsed || daysElapsed);
                return true;
            }
            applyLoadedGameState(data);
            addLogEntry(`馃搨 ${friendlyName}璇诲彇鎴愬姛锛乣);
            trackLoadGame(data?.daysElapsed || daysElapsed);
            return true;
        } catch (error) {
            console.error('Load game failed:', error);
            addLogEntry(`锟?璇诲彇瀛樻。澶辫触锟?{error.message}`);
            trackErrorError(`SaveLoadError: ${error.message}`);
            return false;
        }
    };

    /**
     * 鍒犻櫎鎸囧畾鐨勫瓨锟?
     * @param {number} slotIndex - 瀛樻。妲戒綅绱㈠紩锟?-2涓烘墜鍔ㄥ瓨妗ｏ紝-1涓鸿嚜鍔ㄥ瓨妗ｏ級
     * @returns {boolean} 鏄惁鍒犻櫎鎴愬姛
     */
    const deleteSave = ({ slotIndex = 0 } = {}) => {
        try {
            let targetKey;
            let friendlyName;

            if (slotIndex === -1) {
                // 鍒犻櫎鑷姩瀛樻。
                targetKey = AUTOSAVE_KEY;
                friendlyName = '鑷姩瀛樻。';
            } else {
                // 鍒犻櫎鎵嬪姩瀛樻。妲戒綅
                const safeIndex = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slotIndex));
                targetKey = `${SAVE_SLOT_PREFIX}${safeIndex}`;
                friendlyName = `瀛樻。 ${safeIndex + 1}`;
            }

            const rawData = localStorage.getItem(targetKey);
            if (!rawData) {
                addLogEntry(`鈿狅笍 ${friendlyName}涓嶅瓨鍦紝鏃犻渶鍒犻櫎銆俙);
                return false;
            }

            try {
                const parsed = JSON.parse(rawData);
                // [PR-2] 鍒嗙墖瀛樻。锛氫竴骞舵竻鐞嗘墍鏈?shard:* 閿?                if (isShardedSaveStub(parsed)) {
                    const shardNames = Array.isArray(parsed.shards) && parsed.shards.length
                        ? parsed.shards
                        : SHARD_NAMES;
                    for (const name of shardNames) {
                        void removeSaveFromIndexedDb(shardKeyFor(targetKey, name));
                    }
                    // 鏃ц矾寰勪笂涔熷彲鑳芥湁 targetKey 鐨勬畫浣欙紙v1 杩佺Щ杩囨潵锛夛紝椤烘墜娓呬竴涓?                    void removeSaveFromIndexedDb(targetKey);
                } else if (isExternalSaveStub(parsed)) {
                    void removeSaveFromIndexedDb(targetKey);
                }
            } catch (parseError) {
                // Ignore malformed save metadata
            }

            localStorage.removeItem(targetKey);
            addLogEntry(`馃棏锟?${friendlyName}宸插垹闄ゃ€俙);
            return true;
        } catch (error) {
            console.error('Delete save failed:', error);
            addLogEntry(`锟?鍒犻櫎瀛樻。澶辫触锟?{error.message}`);
            return false;
        }
    };

    const exportSaveToBinary = async () => {
        if (typeof window === 'undefined' || typeof Blob === 'undefined') {
            throw new Error('瀵煎嚭浠呮敮鎸佹祻瑙堝櫒鐜');
        }
        trackExportSave();
        try {
            const timestamp = Date.now();
            const { payload } = buildSavePayload({ source: 'binary-export', timestamp });
            // Compact the payload before export to reduce file size
            const compactedPayload = compactSavePayload(payload);
            let fileJson = JSON.stringify(compactedPayload);
            let note = '?? ????????????????';
            if (canObfuscate) {
                fileJson = JSON.stringify({
                    format: SAVE_FORMAT_VERSION,
                    obfuscated: true,
                    data: encodeSavePayload(compactedPayload),
                    updatedAt: compactedPayload.updatedAt,
                });
                note = '?? ?????????????????';
            }
            const blob = new Blob([fileJson], { type: 'application/octet-stream' });
            const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
            // 鐢熸垚鏂囦欢鍚嶏細濡傛灉鏈夊笣鍥藉悕绉板垯鍖呭惈鍦ㄦ枃浠跺悕涓紝鍚﹀垯浣跨敤榛樿鏍煎紡
            const safeEmpireName = empireName
                ? empireName.replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 20)
                : '';
            const filename = safeEmpireName
                ? `civ-save-${safeEmpireName}-${iso}.${SAVE_FILE_EXTENSION}`
                : `civ-save-${iso}.${SAVE_FILE_EXTENSION}`;

            // 妫€娴嬭繍琛岀幆锟?
            const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
            // 鍙湁褰撹繍琛屽湪鍘熺敓骞冲彴锛坕OS/Android锛夋椂鎵嶈涓烘槸 Native 鐜
            // 锟?Web 绔紙鍖呮嫭 PC 娴忚鍣ㄥ拰绉诲姩绔祻瑙堝櫒锛夛紝鍗充娇寮曞叆锟?Capacitor 涔熸槸 Web 骞冲彴锛屾敮鎸佷笅杞介摼锟?
            const isNative = window.Capacitor?.isNativePlatform() || false;
            console.log('[Export] Environment:', { isMobile, isNative, platform: window.Capacitor?.getPlatform() || 'web', userAgent: navigator.userAgent });

            // 鏂规0锛氬師锟?App 瀵煎嚭 (Capacitor Native)
            // 浣跨敤 Filesystem 鍐欏叆缂撳瓨锛岀劧鍚庣敤 Share 鎻掍欢鍒嗕韩鏂囦欢
            if (isNative) {
                try {
                    console.log('[Export] Trying Native Filesystem & Share...');
                    // 鍐欏叆涓存椂鏂囦欢鍒扮紦瀛樼洰锟?
                    const result = await Filesystem.writeFile({
                        path: filename,
                        data: fileJson,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8,
                    });

                    console.log('[Export] File written to:', result.uri);

                    // 璋冪敤鍘熺敓绯荤粺鍒嗕韩
                    await Share.share({
                        title: '瀵煎嚭瀛樻。',
                        text: `鏂囨槑宕涜捣瀛樻。: ${filename}`,
                        url: result.uri,
                        dialogTitle: '???????',
                    });

                    addLogEntry('馃摛 瀛樻。宸插鍑猴紒');
                    return true;
                } catch (nativeError) {
                    console.error('[Export] Native export failed:', nativeError);
                    if (nativeError.message !== 'Share canceled') {
                        addLogEntry(`鈿狅笍 鍘熺敓瀵煎嚭鍑洪敊: ${nativeError.message}锛屽皾璇曚娇鐢ㄥ壀璐存澘銆俙);
                    } else {
                        return false; // 鐢ㄦ埛鍙栨秷
                    }
                    // 濡傛灉澶辫触锛岀户缁墽琛屽悗澶囨柟妗堬紙涓昏鏄壀璐存澘锟?
                }
            }

            // 鏂规1锛歐eb Share API锛堟敮鎸佸垎浜枃浠剁殑璁惧锛屼粎闄愮Щ鍔ㄧ Web锟?
            // 锟?PC 绔皾锟?Share API 鍙兘浼氭秷鑰楃敤鎴锋墜鍔匡紝瀵艰嚧鍚庣画鐨勪笅杞借鎷︽埅锛屾墍浠ヤ粎鍦ㄧЩ鍔ㄧ鍚敤
            if (isMobile && navigator.share && navigator.canShare) {
                try {
                    const file = new File([blob], filename, { type: 'application/octet-stream' });
                    const shareData = { files: [file] };

                    if (navigator.canShare(shareData)) {
                        console.log('[Export] Trying Web Share API with file...');
                        await navigator.share(shareData);
                        addLogEntry('馃摛 瀛樻。宸查€氳繃鍒嗕韩瀵煎嚭锟?);
                        return true;
                    }
                } catch (shareError) {
                    if (shareError.name === 'AbortError') {
                        addLogEntry('鈩癸笍 宸插彇娑堝垎浜拷');
                        return false;
                    }
                    console.warn('[Export] Share API with file failed:', shareError);
                }
            }

            // 鏂规2锛氭闈㈡祻瑙堝櫒涓嬭浇锛堥潪绉诲姩锟?Web绔級
            // 浼樺厛灏濊瘯涓嬭浇鏂囦欢锛岃繖鏄渶绗﹀悎鐢ㄦ埛棰勬湡锟?瀵煎嚭鍒版枃锟?鐨勮锟?
            // 鍗充娇锟?Capacitor Web 鐗堬紙PC娴忚鍣級锛宨sNative 涔熸槸 false锛屽彲浠ヤ笅锟?
            if (!isNative) {
                try {
                    console.log('[Export] Trying download link...');
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    link.click();
                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }, 1000);
                    addLogEntry(note);
                    return true;
                } catch (downloadError) {
                    console.warn('[Export] Download link failed:', downloadError);
                }
            }

            // 鏂规3锛氬壀璐存澘 API锛堜綔涓哄悗澶囨柟妗堬級
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    console.log('[Export] Trying Clipboard API...');
                    await navigator.clipboard.writeText(fileJson);
                    addLogEntry('馃搵 瀛樻。鏁版嵁宸插鍒跺埌鍓创鏉匡紒璇风矘璐翠繚瀛樺埌澶囧繕褰曟垨鏂囨湰鏂囦欢锟?);
                    return true;
                } catch (clipboardError) {
                    console.warn('[Export] Clipboard API failed:', clipboardError);
                }
            }

            // 鏂规4锛堟渶缁堜繚搴曪級锛氬脊绐楁彁绀虹敤鎴锋墜鍔ㄥ锟?
            console.log('[Export] Falling back to prompt...');
            // 缂╃煭瀛樻。鏁版嵁鐢ㄤ簬鏄剧ず锛堝お闀夸細瀵艰嚧寮圭獥闂锟?
            const shortData = fileJson.length > 500
                ? fileJson.substring(0, 500) + '...[鏁版嵁宸叉埅鏂紝璇蜂娇鐢ㄤ笅鏂瑰畬鏁村鍒禲'
                : fileJson;

            // 鍒涘缓涓€涓殣钘忕殑 textarea 鐢ㄤ簬澶嶅埗
            const textarea = document.createElement('textarea');
            textarea.value = fileJson;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (copied) {
                    addLogEntry('馃搵 瀛樻。鏁版嵁宸插鍒跺埌鍓创鏉匡紒璇风矘璐翠繚瀛樺埌澶囧繕褰曪拷');
                    alert('瀛樻。鏁版嵁宸插鍒跺埌鍓创鏉匡紒\n\n璇锋墦寮€澶囧繕褰曟垨鍏朵粬鏂囨湰搴旂敤锛岀矘璐翠繚瀛橈拷');
                    return true;
                }
            } catch (execError) {
                document.body.removeChild(textarea);
                console.warn('[Export] execCommand copy failed:', execError);
            }

            // 濡傛灉鎵€鏈夋柟妗堥兘澶辫触锛屾樉绀哄瓨妗ｆ暟鎹鐢ㄦ埛鎵嬪姩澶嶅埗
            addLogEntry('鈿狅笍 鑷姩瀵煎嚭澶辫触锛岃鎵嬪姩澶嶅埗瀛樻。鏁版嵁锟?);
            const userCopied = window.prompt(
                '鑷姩瀵煎嚭澶辫触銆傝鎵嬪姩闀挎寜涓嬫柟鏂囨湰鍏ㄩ€夊鍒讹紝淇濆瓨鍒板蹇樺綍锛歕n锛堟枃鏈緢闀匡紝璇风‘淇濆叏閮ㄥ鍒讹級',
                fileJson
            );

            if (userCopied !== null) {
                addLogEntry('馃搵 璇风‘淇濆凡澶嶅埗瀹屾暣瀛樻。鏁版嵁锟?);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Export save failed:', error);
            addLogEntry(`锟?瀵煎嚭瀛樻。澶辫触锟?{error.message}`);
            throw error;
        }
    };

    // 瀵煎嚭瀛樻。鍒板壀璐存澘
    const exportSaveToClipboard = async () => {
        try {
            const timestamp = Date.now();
            const { payload } = buildSavePayload({ source: 'clipboard-export', timestamp });
            let fileJson = JSON.stringify(payload);
            if (canObfuscate) {
                fileJson = JSON.stringify({
                    format: SAVE_FORMAT_VERSION,
                    obfuscated: true,
                    data: encodeSavePayload(payload),
                    updatedAt: payload.updatedAt,
                });
            }

            // 灏濊瘯浣跨敤 Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(fileJson);
                    addLogEntry('馃搵 瀛樻。宸插鍒跺埌鍓创鏉匡紒');
                    return true;
                } catch (clipboardError) {
                    console.warn('[Export] Clipboard API failed:', clipboardError);
                }
            }

            // 鍥為€€鏂规锛氫娇锟?execCommand
            const textarea = document.createElement('textarea');
            textarea.value = fileJson;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (copied) {
                    addLogEntry('馃搵 瀛樻。宸插鍒跺埌鍓创鏉匡紒');
                    return true;
                }
            } catch (execError) {
                document.body.removeChild(textarea);
                console.warn('[Export] execCommand copy failed:', execError);
            }

            throw new Error('鏃犳硶澶嶅埗鍒板壀璐存澘');
        } catch (error) {
            console.error('Export to clipboard failed:', error);
            addLogEntry(`锟?澶嶅埗澶辫触锟?{error.message}`);
            throw error;
        }
    };

    const persistImportedSave = async (payload, targetKey) => {
        // [PR-1] 涓€娆?stringify 璐┛鏁存潯 import 鍐欏叆璺緞
        const payloadJson = JSON.stringify(payload);
        const size = sizeDescFromString(payloadJson);
        const storeStub = (stub) => {
            try {
                localStorage.setItem(targetKey, JSON.stringify(stub));
                return true;
            } catch (error) {
                return false;
            }
        };

        const saveToIndexedDb = async () => {
            await writeSaveToIndexedDb(targetKey, payloadJson);
            const stub = buildExternalSaveStub(payload, { sizeBytes: size.bytes });
            const stubStored = storeStub(stub);
            if (!stubStored) {
                await removeSaveFromIndexedDb(targetKey);
                throw new Error('External stub storage failed');
            }
            return { stored: true, external: true, size };
        };

        if (hasIndexedDb() && size.bytes >= LOCAL_STORAGE_SOFT_LIMIT) {
            try {
                return await saveToIndexedDb();
            } catch (error) {
                console.warn('[Import] External storage failed:', error);
            }
        }

        try {
            localStorage.setItem(targetKey, payloadJson);
            return { stored: true, external: false, size };
        } catch (error) {
            if (hasIndexedDb()) {
                return await saveToIndexedDb();
            }
            throw error;
        }
    };

    const importSaveFromBinary = async (fileOrBuffer) => {
        trackImportSave();
        try {
            if (!fileOrBuffer) {
                throw new Error('璇烽€夋嫨鏈夋晥鐨勫瓨妗ｆ枃锟?);
            }
            if (!textDecoder) {
                throw new Error('褰撳墠鐜涓嶆敮鎸佽В鏋愬瓨妗ｆ枃锟?);
            }
            let buffer;
            if (fileOrBuffer instanceof ArrayBuffer) {
                buffer = fileOrBuffer;
            } else if (fileOrBuffer instanceof Uint8Array) {
                buffer = fileOrBuffer.buffer;
            } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
                buffer = await fileOrBuffer.arrayBuffer();
            } else {
                throw new Error('鏃犳硶瑙ｆ瀽鐨勬枃浠剁被锟?);
            }
            const jsonString = textDecoder.decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
            const parsed = JSON.parse(jsonString);
            const processed = parsed && parsed.obfuscated && parsed.data
                ? decodeSavePayload(parsed.data)
                : parsed;
            const normalized = {
                ...processed,
                saveFormatVersion: processed.saveFormatVersion || parsed.format || SAVE_FORMAT_VERSION,
                saveSource: 'binary-import',
                updatedAt: processed.updatedAt || parsed.updatedAt || Date.now(),
                lastAutoSaveTime: processed.lastAutoSaveTime || lastAutoSaveTime || Date.now(),
            };

            // Helper function to check quota error
            const isQuotaExceeded = (err) => err?.name === 'QuotaExceededError'
                || `${err?.message || ''}`.toLowerCase().includes('quota');

            // Try to save, with fallback compression for quota issues
            const targetKey = `${SAVE_SLOT_PREFIX}0`;
            try {
                await persistImportedSave(normalized, targetKey);
            } catch (saveError) {
                if (isQuotaExceeded(saveError)) {
                    // First fallback: aggressive compact
                    console.warn('[Import] Quota exceeded, trying aggressive compact...');
                    try {
                        const compactedPayload = compactSavePayload(normalized, { aggressive: true });
                        await persistImportedSave(compactedPayload, targetKey);
                        addLogEntry('鈿狅笍 瀛樻。绌洪棿涓嶈冻锛屽凡浣跨敤绮剧畝瀵煎叆锟?);
                    } catch (compactError) {
                        if (isQuotaExceeded(compactError)) {
                            // Second fallback: minimal payload
                            console.warn('[Import] Compact failed, trying minimal payload...');
                            try {
                                const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                await persistImportedSave(minimalPayload, targetKey);
                                addLogEntry('鈿狅笍 瀛樻。绌洪棿涓ラ噸涓嶈冻锛屽凡浣跨敤鏈€灏忓鍏ワ紙閮ㄥ垎鍘嗗彶鏁版嵁涓㈠け锛夛拷');
                            } catch (minimalError) {
                                // Final fallback: clear old saves and retry
                                console.warn('[Import] Minimal failed, clearing old saves...');
                                try {
                                    localStorage.removeItem(AUTOSAVE_KEY);
                                    const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                    await persistImportedSave(minimalPayload, targetKey);
                                    addLogEntry('鈿狅笍 宸叉竻鐞嗚嚜鍔ㄥ瓨妗ｄ互鑵惧嚭绌洪棿锛屽鍏ユ垚鍔燂拷');
                                } catch (finalError) {
                                    throw new Error('瀛樺偍绌洪棿宸叉弧锛屾棤娉曞鍏ュ瓨妗ｃ€傝鍦ㄦ祻瑙堝櫒璁剧疆涓竻鐞嗙綉绔欐暟鎹垨鍒犻櫎鐜版湁瀛樻。鍚庨噸璇曪拷');
                                }
                            }
                        } else {
                            throw compactError;
                        }
                    }
                } else {
                    throw saveError;
                }
            }

            applyLoadedGameState(normalized);
            addLogEntry('馃摜 宸蹭粠澶囦唤鏂囦欢瀵煎叆瀛樻。锟?);
            return true;
        } catch (error) {
            console.error('Import save failed:', error);
            addLogEntry(`锟?瀵煎叆瀛樻。澶辫触锟?{error.message}`);
            throw error;
        }
    };

    // 浠庢枃锟?鍓创鏉垮鍏ュ瓨锟?
    const importSaveFromText = async (textInput = null) => {
        try {
            let jsonString = textInput;

            // 濡傛灉娌℃湁浼犲叆鏂囨湰锛屽皾璇曚粠鍓创鏉胯鍙栨垨寮圭獥璁╃敤鎴风矘锟?
            if (!jsonString) {
                // 鏂规1锛氬皾璇曚粠鍓创鏉胯锟?
                if (navigator.clipboard && navigator.clipboard.readText) {
                    try {
                        jsonString = await navigator.clipboard.readText();
                        if (jsonString && jsonString.trim()) {
                            console.log('[Import] Read from clipboard, length:', jsonString.length);
                        }
                    } catch (clipboardError) {
                        console.warn('[Import] Clipboard read failed:', clipboardError);
                    }
                }

                // 鏂规2锛氬鏋滃壀璐存澘璇诲彇澶辫触鎴栦负绌猴紝寮圭獥璁╃敤鎴风矘锟?
                if (!jsonString || !jsonString.trim()) {
                    jsonString = window.prompt(
                        '璇风矘璐村瓨妗ｆ暟鎹細\n锛堥暱鎸夎緭鍏ユ锛岄€夋嫨绮樿创锟?,
                        ''
                    );
                    if (jsonString === null) {
                        addLogEntry('鈩癸笍 宸插彇娑堝鍏ワ拷');
                        return false;
                    }
                }
            }

            if (!jsonString || !jsonString.trim()) {
                throw new Error('瀛樻。鏁版嵁涓虹┖');
            }

            // 瑙ｆ瀽 JSON
            const parsed = JSON.parse(jsonString.trim());
            const processed = parsed && parsed.obfuscated && parsed.data
                ? decodeSavePayload(parsed.data)
                : parsed;

            const normalized = {
                ...processed,
                saveFormatVersion: processed.saveFormatVersion || parsed.format || SAVE_FORMAT_VERSION,
                saveSource: 'text-import',
                updatedAt: processed.updatedAt || parsed.updatedAt || Date.now(),
                lastAutoSaveTime: processed.lastAutoSaveTime || lastAutoSaveTime || Date.now(),
            };

            // Helper function to check quota error
            const isQuotaExceeded = (err) => err?.name === 'QuotaExceededError'
                || `${err?.message || ''}`.toLowerCase().includes('quota');

            // Try to save, with fallback compression for quota issues
            const targetKey = `${SAVE_SLOT_PREFIX}0`;
            try {
                await persistImportedSave(normalized, targetKey);
            } catch (saveError) {
                if (isQuotaExceeded(saveError)) {
                    // First fallback: aggressive compact
                    console.warn('[Import] Quota exceeded, trying aggressive compact...');
                    try {
                        const compactedPayload = compactSavePayload(normalized, { aggressive: true });
                        await persistImportedSave(compactedPayload, targetKey);
                        addLogEntry('鈿狅笍 瀛樻。绌洪棿涓嶈冻锛屽凡浣跨敤绮剧畝瀵煎叆锟?);
                    } catch (compactError) {
                        if (isQuotaExceeded(compactError)) {
                            // Second fallback: minimal payload
                            console.warn('[Import] Compact failed, trying minimal payload...');
                            try {
                                const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                await persistImportedSave(minimalPayload, targetKey);
                                addLogEntry('鈿狅笍 瀛樻。绌洪棿涓ラ噸涓嶈冻锛屽凡浣跨敤鏈€灏忓鍏ワ紙閮ㄥ垎鍘嗗彶鏁版嵁涓㈠け锛夛拷');
                            } catch (minimalError) {
                                // Final fallback: clear old saves and retry
                                console.warn('[Import] Minimal failed, clearing old saves...');
                                try {
                                    localStorage.removeItem(AUTOSAVE_KEY);
                                    const minimalPayload = buildMinimalAutoSavePayload(normalized);
                                    await persistImportedSave(minimalPayload, targetKey);
                                    addLogEntry('鈿狅笍 宸叉竻鐞嗚嚜鍔ㄥ瓨妗ｄ互鑵惧嚭绌洪棿锛屽鍏ユ垚鍔燂拷');
                                } catch (finalError) {
                                    throw new Error('瀛樺偍绌洪棿宸叉弧锛屾棤娉曞鍏ュ瓨妗ｃ€傝鍦ㄦ祻瑙堝櫒璁剧疆涓竻鐞嗙綉绔欐暟鎹垨鍒犻櫎鐜版湁瀛樻。鍚庨噸璇曪拷');
                                }
                            }
                        } else {
                            throw compactError;
                        }
                    }
                } else {
                    throw saveError;
                }
            }

            applyLoadedGameState(normalized);
            addLogEntry('馃摜 宸蹭粠鍓创鏉垮鍏ュ瓨妗ｏ紒');
            return true;
        } catch (error) {
            console.error('Import from text failed:', error);
            if (error instanceof SyntaxError) {
                addLogEntry('锟?瀵煎叆澶辫触锛氬瓨妗ｆ暟鎹牸寮忔棤鏁堬紝璇风‘淇濆畬鏁村鍒讹拷');
            } else {
                addLogEntry(`锟?瀵煎叆瀛樻。澶辫触锟?{error.message}`);
            }
            throw error;
        }
    };

    // 寮€濮嬫柊娓告垙锛堜笉鍒犻櫎鐜版湁瀛樻。锟?
    const resetGame = (options = null) => {
        if (typeof window === 'undefined') {
            return;
        }
        trackResetGame(daysElapsed);
        const normalized = typeof options === 'string'
            ? { difficulty: options }
            : (options || {});
        // 鏍囪涓烘柊娓告垙妯″紡锛屽惎鍔ㄦ椂涓嶅姞杞戒换浣曞瓨锟?
        localStorage.setItem('start_new_game', 'true');
        // 濡傛灉鎸囧畾浜嗛毦搴︼紝淇濆瓨锟?localStorage 浠ヤ究鏂版父鎴忓惎鍔ㄦ椂浣跨敤
        if (normalized.difficulty) {
            localStorage.setItem('new_game_difficulty', normalized.difficulty);
        }
        if (normalized.scenarioId) {
            localStorage.setItem('new_game_scenario', normalized.scenarioId);
        }
        // 濡傛灉鎸囧畾浜嗗笣鍥藉悕绉帮紝淇濆瓨锟?localStorage 浠ヤ究鏂版父鎴忓惎鍔ㄦ椂浣跨敤
        if (normalized.empireName) {
            localStorage.setItem('new_game_empire_name', normalized.empireName);
        }
        window.location.reload();
    };

    const unlockAchievement = useCallback((achievement) => {
        if (!achievement?.id) return;
        let didUnlock = false;
        const unlockedAt = Date.now();
        setUnlockedAchievements(prev => {
            if (prev.some(item => item.id === achievement.id)) return prev;
            didUnlock = true;
            const next = [...prev, { id: achievement.id, unlockedAt }];
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(next));
                } catch (error) {
                    console.warn('Failed to save achievements:', error);
                }
            }
            return next;
        });
        // [FIX] 灏嗛€氱煡 setState 绉诲埌 updater 澶栭潰锛岄伩鍏嶅祵濂?setState 瀵艰嚧娓叉煋椋庢毚
        // 浣跨敤 queueMicrotask 纭繚鍦ㄥ綋鍓嶆壒閲忔洿鏂板畬鎴愬悗鍐嶈拷鍔犻€氱煡
        queueMicrotask(() => {
            if (!didUnlock) return;
            setAchievementNotifications(list => [
                ...list,
                {
                    id: `${achievement.id}-${unlockedAt}`,
                    name: achievement.name,
                    description: achievement.description,
                    icon: achievement.icon,
                },
            ]);
        });
    }, []);

    const incrementAchievementProgress = useCallback((key, amount = 1) => {
        if (!key) return;
        setAchievementProgress(prev => {
            const current = prev?.[key] || 0;
            const nextValue = current + amount;
            if (nextValue === current) return prev;
            const next = { ...(prev || {}), [key]: nextValue };
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(ACHIEVEMENT_PROGRESS_KEY, JSON.stringify(next));
                } catch (error) {
                    console.warn('Failed to save achievement progress:', error);
                }
            }
            return next;
        });
    }, []);

    const dismissAchievementNotification = useCallback((notificationId) => {
        setAchievementNotifications(prev => prev.filter(item => item.id !== notificationId));
    }, []);

    const hasAutoSave = () => {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem(AUTOSAVE_KEY);
    };

    // 杩斿洖鎵€鏈夌姸鎬佸拰鏇存柊鍑芥暟
    return {
        // 璧勬簮
        resources,
        setResources,
        treasuryChangeLog,
        market,
        setMarket,

        // 浜哄彛
        population,
        setPopulation,
        popStructure,
        setPopStructure,
        maxPop,
        setMaxPop,
        maxPopBonus,
        setMaxPopBonus,
        birthAccumulator,
        setBirthAccumulator,

        // 寤虹瓚涓庣鎶€
        buildings,
        setBuildings,
        buildingUpgrades,
        setBuildingUpgrades,
        techsUnlocked,
        setTechsUnlocked,
        epoch,
        setEpoch,

        // 鐞嗗康绯荤粺
        ideologyScore,
        setIdeologyScore,
        ideologyScoreSpent,
        setIdeologyScoreSpent,
        ideologyCollection,
        setIdeologyCollection,
        equippedIdeologies,
        setEquippedIdeologies,
        ideologySlotCount,
        setIdeologySlotCount,
        ideologyCooldowns,
        setIdeologyCooldowns,
        ideologyMilestones,
        setIdeologyMilestones,
        pendingIdeologyEmergence,
        setPendingIdeologyEmergence,
        ideologyEmergenceRarityBonus,
        setIdeologyEmergenceRarityBonus,
        lastEmergenceWasSkipped,
        setLastEmergenceWasSkipped,

        daysElapsed,
        setDaysElapsed,

        // 娓告垙鎺у埗
        activeTab,
        setActiveTab,
        gameSpeed,
        setGameSpeed,
        isPaused,
        setIsPaused,
        pausedBeforeEvent,
        setPausedBeforeEvent,
        autoSaveInterval,
        setAutoSaveInterval,
        isAutoSaveEnabled,
        setIsAutoSaveEnabled,
        lastAutoSaveTime,
        setLastAutoSaveTime,
        isSaving,
        difficulty,
        setDifficulty,

        // 鏀夸护涓庡锟?
        nations,
        setNations,
        diplomaticReputation,
        setDiplomaticReputation,
        selectedTarget,
        setSelectedTarget,

        // 瀹樺憳绯荤粺 (鏂板)
        officials,
        setOfficials,
        officialsSimCursor,
        setOfficialsSimCursor,
        officialCandidates,
        setOfficialCandidates,
        lastSelectionDay,
        setLastSelectionDay,
        officialCapacity,
        setOfficialCapacity,
        ministerAssignments,
        setMinisterAssignments,
        ministerAutoExpansion,
        setMinisterAutoExpansion,
        lastMinisterExpansionDay,
        setLastMinisterExpansionDay,
        // 鍐呴榿鍗忓悓绯荤粺
        decrees,
        setDecrees,
        activeDecrees,
        setActiveDecrees,
        decreeCooldowns,
        setDecreCooldowns,
        // Alias with correct spelling for callers
        setDecreeCooldowns,
        quotaTargets,
        setQuotaTargets,
        expansionSettings,
        setExpansionSettings,
        priceControls,
        setPriceControls,

        // 绀句細闃跺眰
        classApproval,
        setClassApproval,
        approvalBreakdown,
        setApprovalBreakdown,
        classInfluence,
        setClassInfluence,
        classWealth,
        setClassWealth,
        classWealthDelta,
        setClassWealthDelta,
        classIncome,
        setClassIncome,
        classExpense,
        setClassExpense,
        classFinancialData,
        setClassFinancialData,
        buildingFinancialData,
        setBuildingFinancialData,
        stateBuildingSilverOutput,
        setStateBuildingSilverOutput,
        classWealthHistory,
        setClassWealthHistory,
        classNeedsHistory,
        setClassNeedsHistory,
        totalInfluence,
        setTotalInfluence,
        totalWealth,
        setTotalWealth,
        activeBuffs,
        setActiveBuffs,
        activeDebuffs,
        setActiveDebuffs,
        classInfluenceShift,
        setClassInfluenceShift,
        stability,
        setStability,
        stratumDetailView,
        setStratumDetailView,
        resourceDetailView,
        setResourceDetailView,
        classShortages,
        setClassShortages,
        classLivingStandard,
        setClassLivingStandard,
        livingStandardStreaks,
        setLivingStandardStreaks,
        migrationCooldowns,
        setMigrationCooldowns,
        taxShock,
        setTaxShock,
        populationDetailView,
        setPopulationDetailView,
        history,
        setHistory,
        
        // 缁忔祹鎸囨爣
        priceHistory,
        setPriceHistory,
        equilibriumPrices,
        setEquilibriumPrices,
        economicIndicators,
        setEconomicIndicators,
        
        eventEffectSettings,
        setEventEffectSettings,
        activeEventEffects,
        setActiveEventEffects,

        // 璐㈡斂锛堝疄闄呭彛寰勶級
        fiscalActual,
        setFiscalActual,

        // 鍐涗簨绯荤粺
        army,
        setArmy,
        militaryQueue,
        setMilitaryQueue,
        battleResult,
        setBattleResult,
        battleNotifications,
        setBattleNotifications,
        militaryWageRatio,
        setMilitaryWageRatio,
        autoRecruitEnabled,
        setAutoRecruitEnabled,
        targetArmyComposition,
        setTargetArmyComposition,
        lastBattleTargetId,
        setLastBattleTargetId,
        lastBattleDay,
        setLastBattleDay,
        militaryCorps,
        setMilitaryCorps,
        generals,
        setGenerals,
        activeFronts,
        setActiveFronts,
        activeBattles,
        setActiveBattles,
        pendingRepairs,
        setPendingRepairs,
        corpsReplenishQueue,
        setCorpsReplenishQueue,

        // Annual report system
        festivalModal,
        setFestivalModal,
        annualReportBaseline,
        setAnnualReportBaseline,
        annualReportAccumulator,
        setAnnualReportAccumulator,
        lastFestivalYear,
        setLastFestivalYear,
        annualReportHistory,
        setAnnualReportHistory,

        // 鍟嗕汉浜ゆ槗绯荤粺
        merchantState,
        setMerchantState,

        // 璐告槗缁熻
        tradeStats,
        setTradeStats,
        diplomacyOrganizations,
        setDiplomacyOrganizations,
        vassalDiplomacyQueue,
        setVassalDiplomacyQueue,
        vassalDiplomacyHistory,
        setVassalDiplomacyHistory,
        overseasInvestments,
        setOverseasInvestments,
        foreignInvestments,
        setForeignInvestments, // [FIX] Expose setter
        foreignInvestmentPolicy,
        setForeignInvestmentPolicy,
        foreignInvestmentPolicyOverrides,
        setForeignInvestmentPolicyOverrides,
        setOverseasBuildings, setOverseasBuildings,

        // 绛栫暐琛屽姩
        actionCooldowns,
        setActionCooldowns,
        actionUsage,
        setActionUsage,
        promiseTasks,
        setPromiseTasks,

        // 鏁欑▼绯荤粺
        showTutorial,
        setShowTutorial,

        // 浜嬩欢绯荤粺
        currentEvent,
        setCurrentEvent,
        eventHistory,
        setEventHistory,
        unlockedAchievements,
        setUnlockedAchievements,
        achievementNotifications,
        unlockAchievement,
        dismissAchievementNotification,
        achievementProgress,
        incrementAchievementProgress,

        // 鍜屽钩鍗忚
        playerInstallmentPayment,
        setPlayerInstallmentPayment,

        // 鍙涗贡绯荤粺
        rebellionStates,
        setRebellionStates,

        // 鎵ф斂鑱旂洘
        rulingCoalition,
        setRulingCoalition,
        legitimacy,
        setLegitimacy,

        // Modifiers
        modifiers,
        setModifiers,

        // UI
        logs,
        setLogs,
        clicks,
        setClicks,
        rates,
        setRates,
        taxes,
        setTaxes,
        taxPolicies,
        setTaxPolicies,
        jobFill,
        setJobFill,
        jobsAvailable,
        setJobsAvailable,
        buildingJobsRequired,
        setBuildingJobsRequired,
        saveGame,
        loadGame,
        deleteSave,
        exportSaveToBinary,
        exportSaveToClipboard,
        importSaveFromBinary,
        importSaveFromText,
        hasAutoSave,
        resetGame,
        eventConfirmationEnabled,
        setEventConfirmationEnabled,
        // 鍥藉/甯濆浗鍚嶇О
        empireName,
        setEmpireName,
        // 璐㈡斂鏁版嵁
        fiscalActual,
        setFiscalActual,
        dailyMilitaryExpense,
        setDailyMilitaryExpense,
        // Pending Actions Queue锛坱ick-action 绔炰簤鏉′欢淇锛?        pendingActionsRef,
    };
};

// 鈹€鈹€ HMR: force full refresh for core hook changes 鈹€鈹€
// Fast Refresh cannot safely preserve 138+ useState hooks; invalidate to trigger full reload.
if (import.meta.hot) {
    import.meta.hot.invalidate();
}

