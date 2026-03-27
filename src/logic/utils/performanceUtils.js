/**
 * Performance Utilities Module
 * 
 * Provides rate limiting, caching, and tick frequency control utilities
 * for optimizing expensive calculations in the game simulation.
 */

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Configuration for rate-limited calculations
 * These determine how often expensive operations are performed
 */
export const RATE_LIMIT_CONFIG = {
    // Price calculations: every N ticks
    priceUpdateFrequency: 3,
    
    // AI decision making: every N ticks (OPTIMIZED: 5 -> 7 for better performance)
    aiDecisionFrequency: 7,
    
    // Trade calculations: every N ticks
    tradeUpdateFrequency: 3,

    // Merchant trade generation: every N ticks (separate from AI trade)
    merchantTradeFrequency: 1, // Changed from 5 to 1 to enable per-tick rotation

    // Manual trade routes: every N ticks
    manualTradeFrequency: 3,
    
    // Diplomatic relation updates: every N ticks (OPTIMIZED: 5 -> 10 for better performance)
    diplomacyUpdateFrequency: 10,

    // Slice counts to ensure full updates within N ticks
    aiNationUpdateSlices: 3,
    vassalUpdateSlices: 3,
    diplomacyUpdateSlices: 3,
    manualTradeSlices: 3,
    
    // Building upgrade distribution cache validation: every N ticks
    buildingCacheValidation: 10,

    // === 新增：deferred级频率配置 ===
    // 官员系统模拟：每tick执行，避免国企收益/官员收支被低频结算稀释
    officialSimFrequency: 1,
    // 内阁机制：每N个tick执行一次
    cabinetFrequency: 5,
    // 叛乱系统：每N个tick执行一次
    rebellionFrequency: 3,
    // 人口外流与惩罚：每N个tick执行一次
    exodusFrequency: 5,
    // 价格收敛（条约效果）：每N个tick执行一次
    priceConvergenceFrequency: 5,

    // === 新增：batch级频率配置（超低频） ===
    // 海外投资结算：每N个tick执行一次
    overseasInvestmentFrequency: 20,
    // 外国投资结算：每N个tick执行一次
    foreignInvestmentFrequency: 20,

    // === 新增：历史数据更新频率 ===
    historyUpdateFrequency: 5,
};

// ============================================================================
// 动态频率上下文（单例）
// 每个tick开始时设置当前国家数量，shouldRunThisTick自动使用动态频率
// ============================================================================
const _dynamicContext = {
    nationCount: 0,
    isLowPerf: false,
    isInitialized: false,
};

// ============================================================================
// Tick预算保护机制
// ============================================================================
const TICK_BUDGET_MS = 150; // critical级完成后的时间预算上限
const TICK_HARD_LIMIT_MS = 200; // 单tick绝对上限

const _tickBudget = {
    startTime: 0,
    budgetExceeded: false,
    consecutiveOverruns: 0,
};

/**
 * 开始新tick的预算计时（在simulateTick入口处调用）
 */
export function startTickBudget() {
    _tickBudget.startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    _tickBudget.budgetExceeded = false;
}

/**
 * 检查当前tick是否超过预算（在critical级分段全部完成后调用）
 * @returns {boolean} true表示超预算，应跳过后续deferred/batch操作
 */
export function checkTickBudget() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - _tickBudget.startTime;

    if (elapsed >= TICK_BUDGET_MS) {
        _tickBudget.budgetExceeded = true;
        _tickBudget.consecutiveOverruns++;

        // 连续3个tick超时，输出性能警告
        if (_tickBudget.consecutiveOverruns >= 3 && _tickBudget.consecutiveOverruns % 3 === 0) {
            console.warn(
                `[Performance] ☢️ Tick预算连续${_tickBudget.consecutiveOverruns}次超限(${elapsed.toFixed(1)}ms >= ${TICK_BUDGET_MS}ms)，` +
                `建议降低游戏速度或启用低性能模式`
            );
        }
        return true;
    }

    _tickBudget.consecutiveOverruns = 0;
    return false;
}

/**
 * 获取当前tick是否超预算（不重新计算，仅读取状态）
 */
export function isTickBudgetExceeded() {
    return _tickBudget.budgetExceeded;
}

/**
 * 设置动态频率上下文（每tick入口处调用一次）
 * @param {number} nationCount - 当前存活的AI国家数量
 * @param {boolean} [isLowPerf=false] - 是否处于低性能模式
 */
export function setDynamicFrequencyContext(nationCount, isLowPerf = false) {
    _dynamicContext.nationCount = nationCount;
    _dynamicContext.isLowPerf = isLowPerf;
    _dynamicContext.isInitialized = true;
}

/**
 * Check if a rate-limited operation should run this tick
 * 自动结合动态频率上下文（国家数量 + 设备性能）计算实际频率
 * @param {number} tick - Current tick number
 * @param {string} operationType - Type of operation (key in RATE_LIMIT_CONFIG)
 * @param {boolean} forceRun - Override to force execution
 * @returns {boolean} Whether the operation should run
 */
export function shouldRunThisTick(tick, operationType, forceRun = false) {
    if (forceRun) return true;
    
    const baseFreq = RATE_LIMIT_CONFIG[`${operationType}Frequency`] || 
                     RATE_LIMIT_CONFIG[operationType] || 1;
    
    // 如果动态上下文已初始化，使用动态频率；否则回退到基础频率
    const priority = PERF_SEGMENT_PRIORITY[operationType] || TICK_PRIORITY.DEFERRED;
    const frequency = _dynamicContext.isInitialized
        ? getDynamicFrequency(baseFreq, _dynamicContext.nationCount, priority)
        : baseFreq;
    
    // [PERF] Tick预算保护：超时时自动跳过非critical操作
    if (_tickBudget.budgetExceeded && priority !== TICK_PRIORITY.CRITICAL) {
        return false;
    }
    
    return tick % frequency === 0;
}

// ============================================================================
// 三级Tick频率优先级体系
// ============================================================================

/**
 * Tick优先级枚举
 * CRITICAL：每tick必须执行的收入/经济流转操作
 * DEFERRED：可延迟数tick执行的决策/行动类操作
 * BATCH：可大幅延迟执行的超低频操作（如20tick一次）
 */
export const TICK_PRIORITY = {
    CRITICAL: 'critical',
    DEFERRED: 'deferred',
    BATCH: 'batch',
};

/**
 * 所有35个性能分段的优先级映射
 * 用于标识每个分段属于哪个频率级别
 */
export const PERF_SEGMENT_PRIORITY = {
    // === CRITICAL级：每tick执行（收入/经济流转） ===
    priceUpdate:        TICK_PRIORITY.CRITICAL,
    preProduction:      TICK_PRIORITY.CRITICAL,
    ownerJobsAdjust:    TICK_PRIORITY.CRITICAL,
    availableResources: TICK_PRIORITY.CRITICAL,
    populationJobs:     TICK_PRIORITY.CRITICAL,
    passiveGains:       TICK_PRIORITY.CRITICAL,
    headTax:            TICK_PRIORITY.CRITICAL,
    productionLoop:     TICK_PRIORITY.CRITICAL,
    armyMaintenance:    TICK_PRIORITY.CRITICAL,
    needsConsumption:   TICK_PRIORITY.CRITICAL,
    socialEconomy:      TICK_PRIORITY.CRITICAL,
    livingStandards:    TICK_PRIORITY.CRITICAL,
    approvalCalc:       TICK_PRIORITY.CRITICAL,
    wealthDecay:        TICK_PRIORITY.CRITICAL,
    influenceCalc:      TICK_PRIORITY.CRITICAL,
    stabilityCalc:      TICK_PRIORITY.CRITICAL,
    marketEconomy:      TICK_PRIORITY.CRITICAL,
    marketUpdate:       TICK_PRIORITY.CRITICAL,
    vassalUpdates:      TICK_PRIORITY.CRITICAL,
    buffsDebuffs:       TICK_PRIORITY.CRITICAL,
    bonusesApply:       TICK_PRIORITY.CRITICAL,
    merchantTrade:      TICK_PRIORITY.CRITICAL, // Merchant trade must run every tick (execution is cheap; only opportunity evaluation is throttled internally)

    // === DEFERRED级：低频执行（决策/行动类） ===
    aiNationUpdate:       TICK_PRIORITY.DEFERRED,
    diplomacyAI:          TICK_PRIORITY.DEFERRED,
    officialsSim:         TICK_PRIORITY.DEFERRED,
    cabinetMechanics:     TICK_PRIORITY.DEFERRED,
    exodusAndPenalties:   TICK_PRIORITY.DEFERRED,
    monthlyRelationDecay: TICK_PRIORITY.DEFERRED,
    orgMonthly:           TICK_PRIORITY.DEFERRED,
    migrationMonthly:     TICK_PRIORITY.DEFERRED,
    rebellionDaily:       TICK_PRIORITY.DEFERRED,
    priceConvergence:     TICK_PRIORITY.DEFERRED,

    // === BATCH级：超低频执行 ===
    overseasInvestments:  TICK_PRIORITY.BATCH,
    overseasUpgrades:     TICK_PRIORITY.BATCH,
    foreignInvestments:   TICK_PRIORITY.BATCH,
    foreignUpgrades:      TICK_PRIORITY.BATCH,
    manualTrade:          TICK_PRIORITY.BATCH,
};

/**
 * 动态频率计算 — 根据AI国家数量和设备性能模式调整实际执行频率
 * @param {number} baseFreq - 基础频率（来自RATE_LIMIT_CONFIG）
 * @param {number} nationCount - 当前存活的AI国家数量
 * @param {string} priority - TICK_PRIORITY中的优先级（用于决定缩放系数）
 * @returns {number} 实际应使用的频率值
 */
export function getDynamicFrequency(baseFreq, nationCount, priority = TICK_PRIORITY.DEFERRED) {
    // critical级始终每tick执行，不做动态调整
    if (priority === TICK_PRIORITY.CRITICAL) return 1;

    let freq = baseFreq;

    // 根据AI国家数量缩放：超过15个时开始增大间隔
    const NATION_THRESHOLD = 15;
    if (nationCount > NATION_THRESHOLD) {
        const scaleFactor = 1 + (nationCount - NATION_THRESHOLD) * 0.05;
        freq = Math.round(freq * scaleFactor);
    }

    // 根据设备性能模式缩放（通过动态上下文传入，兼容worker环境）
    if (_dynamicContext.isLowPerf) {
        if (priority === TICK_PRIORITY.DEFERRED) {
            freq = Math.round(freq * 1.5);
        } else if (priority === TICK_PRIORITY.BATCH) {
            freq = Math.round(freq * 2);
        }
    }

    // 确保最小值为1
    return Math.max(1, freq);
}

/**
 * 获取指定操作在当前条件下的动态频率值
 * 便捷函数，组合了RATE_LIMIT_CONFIG查找和getDynamicFrequency
 * @param {string} operationType - 操作类型（RATE_LIMIT_CONFIG中的key）
 * @param {number} nationCount - 当前存活AI国家数量
 * @returns {number} 实际频率值
 */
export function getEffectiveFrequency(operationType, nationCount) {
    const baseFreq = RATE_LIMIT_CONFIG[`${operationType}Frequency`] ||
                     RATE_LIMIT_CONFIG[operationType] || 1;
    const priority = PERF_SEGMENT_PRIORITY[operationType] || TICK_PRIORITY.DEFERRED;
    return getDynamicFrequency(baseFreq, nationCount, priority);
}

// ============================================================================
// TICK-LEVEL CACHE UTILITIES
// ============================================================================

/**
 * Simple tick-scoped cache for expensive calculations
 * Cache is automatically invalidated each tick
 */
class TickCache {
    constructor() {
        this.cache = new Map();
        this.lastTick = -1;
    }
    
    /**
     * Get cached value or compute and cache it
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @param {Function} computeFn - Function to compute value if not cached
     * @returns {*} Cached or computed value
     */
    getOrCompute(tick, key, computeFn) {
        // Invalidate cache on new tick
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
        }
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        const value = computeFn();
        this.cache.set(key, value);
        return value;
    }
    
    /**
     * Get cached value without computing
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @returns {*|undefined} Cached value or undefined
     */
    get(tick, key) {
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
            return undefined;
        }
        return this.cache.get(key);
    }
    
    /**
     * Set cached value
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(tick, key, value) {
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
        }
        this.cache.set(key, value);
    }
    
    /**
     * Clear all cached values
     */
    clear() {
        this.cache.clear();
        this.lastTick = -1;
    }
}

// Singleton instance for simulation-wide use
export const tickCache = new TickCache();

// ============================================================================
// BUILDING LEVEL DISTRIBUTION CACHE
// ============================================================================

/**
 * Cache for building upgrade level distributions
 * Avoids recalculating level counts multiple times per tick
 */
const buildingLevelCache = new Map();
let buildingCacheLastTick = -1;

/**
 * Get or compute building level distribution
 * @param {number} tick - Current tick
 * @param {string} buildingId - Building ID
 * @param {Object} buildingUpgrades - Building upgrades state
 * @param {number} buildingCount - Total building count
 * @returns {{ levelCounts: Object, fullLevelCounts: Object, upgradedCount: number }}
 */
export function getBuildingLevelDistribution(tick, buildingId, buildingUpgrades, buildingCount) {
    // Invalidate on new tick
    if (tick !== buildingCacheLastTick) {
        buildingLevelCache.clear();
        buildingCacheLastTick = tick;
    }
    
    const cacheKey = `${buildingId}:${buildingCount}`;
    
    if (buildingLevelCache.has(cacheKey)) {
        return buildingLevelCache.get(cacheKey);
    }
    
    // Compute level distribution
    const storedLevelCounts = buildingUpgrades[buildingId] || {};
    let rawUpgradedCount = 0;
    const rawLevelCounts = {};
    
    Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
        const lvl = parseInt(lvlStr);
        if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
            rawUpgradedCount += lvlCount;
            rawLevelCounts[lvl] = lvlCount;
        }
    });
    
    // [FIX] Normalize level counts if stored upgrades exceed actual building count
    // This can happen due to data inconsistency (e.g., buildings sold but upgrades not synced)
    // Prioritize higher level buildings when trimming
    const fullLevelCounts = {};
    let actualUpgradedCount = 0;
    
    if (rawUpgradedCount > buildingCount) {
        // Upgrade data inconsistent - normalize by keeping higher levels first
        const sortedLevels = Object.keys(rawLevelCounts)
            .map(k => parseInt(k))
            .sort((a, b) => b - a); // Descending order, higher levels first
        
        let remainingCapacity = buildingCount;
        for (const lvl of sortedLevels) {
            const wanted = rawLevelCounts[lvl];
            const actual = Math.min(wanted, remainingCapacity);
            if (actual > 0) {
                fullLevelCounts[lvl] = actual;
                actualUpgradedCount += actual;
                remainingCapacity -= actual;
            }
        }
        fullLevelCounts[0] = remainingCapacity; // Remaining are level 0
    } else {
        // Normal case: upgrades total <= building count
        Object.assign(fullLevelCounts, rawLevelCounts);
        fullLevelCounts[0] = Math.max(0, buildingCount - rawUpgradedCount);
        actualUpgradedCount = rawUpgradedCount;
    }
    
    const result = {
        levelCounts: storedLevelCounts,
        fullLevelCounts,
        upgradedCount: actualUpgradedCount,
        level0Count: fullLevelCounts[0],
        hasUpgrades: actualUpgradedCount > 0
    };
    
    buildingLevelCache.set(cacheKey, result);
    return result;
}

/**
 * Clear building level cache
 */
export function clearBuildingLevelCache() {
    buildingLevelCache.clear();
    buildingCacheLastTick = -1;
}

// ============================================================================
// DIRTY FLAG TRACKING
// ============================================================================

/**
 * Tracks which game state aspects have changed
 * Used to skip expensive recalculations when data hasn't changed
 */
const dirtyFlags = {
    buildings: true,
    population: true,
    resources: true,
    prices: true,
    wages: true,
};

/**
 * Mark a state aspect as dirty (changed)
 * @param {string} aspect - State aspect name
 */
export function markDirty(aspect) {
    if (aspect in dirtyFlags) {
        dirtyFlags[aspect] = true;
    }
}

/**
 * Check if a state aspect is dirty
 * @param {string} aspect - State aspect name
 * @returns {boolean}
 */
export function isDirty(aspect) {
    return dirtyFlags[aspect] === true;
}

/**
 * Clear dirty flag for a state aspect
 * @param {string} aspect - State aspect name
 */
export function clearDirty(aspect) {
    if (aspect in dirtyFlags) {
        dirtyFlags[aspect] = false;
    }
}

/**
 * Reset all dirty flags to true (for initialization)
 */
export function resetAllDirty() {
    Object.keys(dirtyFlags).forEach(key => {
        dirtyFlags[key] = true;
    });
}

// ============================================================================
// 帧率监控与性能日志
// ============================================================================

/**
 * 帧率监控器
 * 追踪tick执行帧率，检测到持续低帧率时提供回调通知
 */
const _fpsMonitor = {
    tickTimes: [],       // 最近N个tick的时间戳
    windowSize: 30,      // 滑动窗口大小
    lowFpsThreshold: 15, // 低帧率阈值（ticks/second）
    lowFpsCount: 0,      // 连续低帧率计数
    lowFpsAlertAt: 10,   // 连续N次低帧率时触发警告
    lastAlertTime: 0,    // 上次警告时间（避免频繁警告）
    alertCooldownMs: 10000, // 警告冷却时间（10秒）
};

/**
 * 记录一个tick完成的时间，更新帧率统计
 * @returns {{ fps: number, isLowFps: boolean } | null} 帧率信息（窗口满时返回）
 */
export function recordTickComplete() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    _fpsMonitor.tickTimes.push(now);

    // 保持滑动窗口大小
    if (_fpsMonitor.tickTimes.length > _fpsMonitor.windowSize) {
        _fpsMonitor.tickTimes.shift();
    }

    // 窗口未满时不计算
    if (_fpsMonitor.tickTimes.length < _fpsMonitor.windowSize) {
        return null;
    }

    // 计算帧率：N个tick / 总时间（秒）
    const totalTimeMs = now - _fpsMonitor.tickTimes[0];
    const fps = totalTimeMs > 0 ? ((_fpsMonitor.windowSize - 1) / totalTimeMs) * 1000 : 0;
    const isLowFps = fps < _fpsMonitor.lowFpsThreshold;

    if (isLowFps) {
        _fpsMonitor.lowFpsCount++;
    } else {
        _fpsMonitor.lowFpsCount = 0;
    }

    // 连续低帧率警告
    if (_fpsMonitor.lowFpsCount >= _fpsMonitor.lowFpsAlertAt) {
        if (now - _fpsMonitor.lastAlertTime >= _fpsMonitor.alertCooldownMs) {
            _fpsMonitor.lastAlertTime = now;
            console.warn(
                `[Performance] ⚠️ 持续低帧率: ${fps.toFixed(1)} tps (阈值: ${_fpsMonitor.lowFpsThreshold})，` +
                `建议切换到低性能模式`
            );
        }
    }

    return { fps: Math.round(fps * 10) / 10, isLowFps };
}

/**
 * 获取当前帧率（仅读取，不更新）
 * @returns {number} 当前帧率，窗口未满时返回-1
 */
export function getCurrentFps() {
    if (_fpsMonitor.tickTimes.length < _fpsMonitor.windowSize) return -1;
    const now = _fpsMonitor.tickTimes[_fpsMonitor.tickTimes.length - 1];
    const totalTimeMs = now - _fpsMonitor.tickTimes[0];
    return totalTimeMs > 0 ? Math.round(((_fpsMonitor.windowSize - 1) / totalTimeMs) * 1000 * 10) / 10 : 0;
}

/**
 * [DEV] 开发环境性能日志：输出每个性能分段的执行/跳过状态
 * @param {number} tick - 当前tick号
 * @param {Object} segmentStatus - { segmentName: boolean } 映射，true表示执行，false表示跳过
 */
export function logTickSegments(tick, segmentStatus) {
    // 每100个tick输出一次摘要，避免控制台刷屏
    if (tick % 100 !== 0) return;

    const executed = [];
    const skipped = [];

    Object.entries(segmentStatus).forEach(([name, didRun]) => {
        if (didRun) {
            executed.push(name);
        } else {
            skipped.push(name);
        }
    });

    console.groupCollapsed(`[PerfLog] Tick ${tick}: 执行=${executed.length} 跳过=${skipped.length}`);
    console.log('执行:', executed.join(', '));
    console.log('跳过:', skipped.join(', '));
    console.groupEnd();
}
