/**
 * Shared OTA info utility.
 * Provides a cached, synchronous way to check if the app is running from an OTA bundle,
 * and an async initializer to populate the cache at startup.
 *
 * Usage:
 *   import { initOtaInfo, getOtaInfoSync } from '../utils/otaInfo';
 *   // Call initOtaInfo() once at app startup (e.g. in useOtaUpdate)
 *   // Then use getOtaInfoSync() anywhere for synchronous access
 */

const _cache = {
    isOTA: false,
    bundleId: null,
    bundleVersion: 'builtin',
    initialized: false,
};

/**
 * Async initializer — call once at app startup.
 * Populates the cache with current bundle info from CapacitorUpdater.
 */
export async function initOtaInfo() {
    if (_cache.initialized) return _cache;
    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const current = await CapacitorUpdater.current();
        const version = current?.bundle?.version || 'builtin';
        const id = current?.bundle?.id || null;
        _cache.isOTA = version !== 'builtin' && !!id;
        _cache.bundleId = id;
        _cache.bundleVersion = version;
    } catch {
        // Not on native platform or plugin unavailable — treat as non-OTA
        _cache.isOTA = false;
        _cache.bundleId = null;
        _cache.bundleVersion = 'builtin';
    }
    _cache.initialized = true;
    return _cache;
}

/**
 * Synchronous getter — returns cached OTA info.
 * Returns default (non-OTA) values if initOtaInfo() hasn't been called yet.
 */
export function getOtaInfoSync() {
    return {
        isOTA: _cache.isOTA,
        bundleId: _cache.bundleId,
        bundleVersion: _cache.bundleVersion,
    };
}
