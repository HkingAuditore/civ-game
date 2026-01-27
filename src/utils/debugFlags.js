// PERFORMANCE: 'event' debug logs cause severe performance issues (3000+ logs per second)
// Keep this disabled to prevent game slowdown
const DEFAULT_DEBUG_FLAGS = {
    console: false,
    event: false, // DO NOT ENABLE - causes lag
    gameLoop: false,
    mainThread: false,
    simulation: false,
    trade: false,
    demands: false,
};

const toFlagMap = (list = []) => {
    const flags = {};
    list.forEach((key) => {
        const trimmed = String(key || '').trim();
        if (trimmed) {
            flags[trimmed] = true;
        }
    });
    return flags;
};

const parseFlags = (value) => {
    if (value == null) return null;
    if (value === true) return true;
    if (value === false) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (trimmed === 'true' || trimmed === 'all') return true;
        try {
            const parsed = JSON.parse(trimmed);
            return parseFlags(parsed);
        } catch {
            const list = trimmed.split(',').map(item => item.trim()).filter(Boolean);
            return list.length > 0 ? toFlagMap(list) : null;
        }
    }

    if (Array.isArray(value)) {
        return toFlagMap(value);
    }

    if (typeof value === 'object') {
        return value;
    }

    return null;
};

let cachedFlags = null;
let cachedOverride = undefined;

const resolveDebugFlags = () => {
    const globalRef = typeof globalThis !== 'undefined' ? globalThis : {};
    const override = globalRef.__CIV_DEBUG__;

    if (override !== cachedOverride) {
        cachedOverride = override;
        cachedFlags = null;
    }

    if (cachedFlags) {
        return cachedFlags;
    }

    let flags = parseFlags(override);
    if (!flags && typeof localStorage !== 'undefined') {
        try {
            flags = parseFlags(localStorage.getItem('civ_debug_flags'));
        } catch {
            flags = null;
        }
    }

    cachedFlags = flags || DEFAULT_DEBUG_FLAGS;
    return cachedFlags;
};

export const isDebugEnabled = (flag) => {
    const flags = resolveDebugFlags();
    if (flags === true) return true;
    return !!flags?.[flag];
};

export const debugLog = (flag, ...args) => {
    if (isDebugEnabled(flag)) {
        console.log(...args);
    }
};

export const debugWarn = (flag, ...args) => {
    if (isDebugEnabled(flag)) {
        console.warn(...args);
    }
};

export const debugError = (flag, ...args) => {
    if (isDebugEnabled(flag)) {
        console.error(...args);
    }
};

export const resetDebugFlagsCache = () => {
    cachedFlags = null;
    cachedOverride = undefined;
};
