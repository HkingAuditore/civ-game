/**
 * Ideology Event Bus
 * Lightweight publish/subscribe system for ideology event-driven effects.
 * Supports cooldown, maxTriggers, condition filtering, and log generation.
 * Framework-agnostic singleton — safe to import from simulation.js, useGameActions.js, etc.
 */

// ============ Event Type Constants ============

export const IDEOLOGY_EVENTS = {
    // A. Player actions (anchored in useGameActions.js)
    ON_BUILD: 'on_build',
    ON_UPGRADE: 'on_upgrade',
    ON_TECH_UNLOCK: 'on_tech_unlock',
    ON_EPOCH_ADVANCE: 'on_epoch_advance',
    ON_HIRE_OFFICIAL: 'on_hire_official',
    ON_FIRE_OFFICIAL: 'on_fire_official',
    ON_TREATY_SIGN: 'on_treaty_sign',
    ON_TREATY_BREAK: 'on_treaty_break',
    ON_DECLARE_WAR: 'on_declare_war',

    // B. Combat / War (anchored in useGameLoop.js)
    ON_BATTLE_VICTORY: 'on_battle_victory',
    ON_BATTLE_DEFEAT: 'on_battle_defeat',
    ON_WAR_VICTORY: 'on_war_victory',
    ON_WAR_START: 'on_war_start',

    // C. Economy / Trade (anchored in simulation.js)
    ON_TRADE_COMPLETE: 'on_trade_complete',
    ON_TAX_COLLECT: 'on_tax_collect',
    ON_SUBSIDY_PAID: 'on_subsidy_paid',
    ON_TREASURY_MILESTONE: 'on_treasury_milestone',
    ON_CHAIN_COMPLETE: 'on_chain_complete',

    // D. Population / Society (anchored in simulation.js)
    ON_POP_MILESTONE: 'on_pop_milestone',
    ON_STARVATION: 'on_starvation',
    ON_LIVING_STANDARD_CHANGE: 'on_living_standard_change',
    ON_CLASS_APPROVAL_LOW: 'on_class_approval_low',

    // E. Stability / Politics (anchored in simulation.js + useGameLoop.js)
    ON_STABILITY_CRISIS: 'on_stability_crisis',
    ON_STABILITY_HIGH: 'on_stability_high',
    ON_REBELLION_START: 'on_rebellion_start',
    ON_LEGITIMACY_CHANGE: 'on_legitimacy_change',

    // F. Diplomacy / International (anchored in simulation.js + useGameLoop.js)
    ON_RELATION_IMPROVE: 'on_relation_improve',
    ON_RELATION_HOSTILE: 'on_relation_hostile',
    ON_VASSAL_GAIN: 'on_vassal_gain',

    // G. Time / Cycle (anchored in simulation.js tick counter)
    ON_YEAR_END: 'on_year_end',
    ON_SEASON_CHANGE: 'on_season_change',
};

// Human-readable event names for log display
export const EVENT_DISPLAY_NAMES = {
    [IDEOLOGY_EVENTS.ON_BUILD]: '建造建筑',
    [IDEOLOGY_EVENTS.ON_UPGRADE]: '升级建筑',
    [IDEOLOGY_EVENTS.ON_TECH_UNLOCK]: '解锁科技',
    [IDEOLOGY_EVENTS.ON_EPOCH_ADVANCE]: '进入新时代',
    [IDEOLOGY_EVENTS.ON_HIRE_OFFICIAL]: '录用官员',
    [IDEOLOGY_EVENTS.ON_FIRE_OFFICIAL]: '解雇官员',
    [IDEOLOGY_EVENTS.ON_TREATY_SIGN]: '签订条约',
    [IDEOLOGY_EVENTS.ON_TREATY_BREAK]: '撕毁条约',
    [IDEOLOGY_EVENTS.ON_DECLARE_WAR]: '宣战',
    [IDEOLOGY_EVENTS.ON_BATTLE_VICTORY]: '战斗胜利',
    [IDEOLOGY_EVENTS.ON_BATTLE_DEFEAT]: '战斗失败',
    [IDEOLOGY_EVENTS.ON_WAR_VICTORY]: '赢得战争',
    [IDEOLOGY_EVENTS.ON_WAR_START]: '战争开始',
    [IDEOLOGY_EVENTS.ON_TRADE_COMPLETE]: '完成贸易',
    [IDEOLOGY_EVENTS.ON_TAX_COLLECT]: '征收税赋',
    [IDEOLOGY_EVENTS.ON_SUBSIDY_PAID]: '发放补贴',
    [IDEOLOGY_EVENTS.ON_TREASURY_MILESTONE]: '国库里程碑',
    [IDEOLOGY_EVENTS.ON_CHAIN_COMPLETE]: '完成产业链',
    [IDEOLOGY_EVENTS.ON_POP_MILESTONE]: '人口里程碑',
    [IDEOLOGY_EVENTS.ON_STARVATION]: '发生饥荒',
    [IDEOLOGY_EVENTS.ON_LIVING_STANDARD_CHANGE]: '生活水平变化',
    [IDEOLOGY_EVENTS.ON_CLASS_APPROVAL_LOW]: '阶层不满',
    [IDEOLOGY_EVENTS.ON_STABILITY_CRISIS]: '稳定危机',
    [IDEOLOGY_EVENTS.ON_STABILITY_HIGH]: '社会稳定',
    [IDEOLOGY_EVENTS.ON_REBELLION_START]: '爆发叛乱',
    [IDEOLOGY_EVENTS.ON_LEGITIMACY_CHANGE]: '合法性变动',
    [IDEOLOGY_EVENTS.ON_RELATION_IMPROVE]: '关系改善',
    [IDEOLOGY_EVENTS.ON_RELATION_HOSTILE]: '关系恶化',
    [IDEOLOGY_EVENTS.ON_VASSAL_GAIN]: '获得附庸',
    [IDEOLOGY_EVENTS.ON_YEAR_END]: '年度结算',
    [IDEOLOGY_EVENTS.ON_SEASON_CHANGE]: '季节更替',
};

// ============ Effect Executor ============

// Safety caps for event-driven effects
const EFFECT_CAPS = {
    addResource: { silver: 1000, default: 100 },
    addStability: 20,
    addBuff: { maxDuration: 360 },  // V2: raised from 180 to support L3 strategic buffs
    addIdeologyScore: 50,
    modifyBonus: 0.5, // max 50% per single trigger
};

/**
 * Execute a single effect action, returning a result descriptor.
 * The caller (simulation or game loop) is responsible for actually mutating game state.
 * This function only computes what SHOULD happen and enforces caps.
 * 
 * @param {Object} effect - { action, resource?, amount?, buffId?, duration?, bonusKey?, ... }
 * @param {number} levelScale - level multiplier (1.0 / 1.5 / 2.0)
 * @returns {Object|null} effect result descriptor or null if invalid
 */
function executeEffect(effect, levelScale = 1.0) {
    if (!effect || !effect.action) return null;

    const scaled = (val) => val * levelScale;

    switch (effect.action) {
        case 'addResource': {
            const amount = scaled(effect.amount || 0);
            const cap = EFFECT_CAPS.addResource[effect.resource] || EFFECT_CAPS.addResource.default;
            const capped = Math.min(Math.abs(amount), cap) * Math.sign(amount);
            return { action: 'addResource', resource: effect.resource, amount: capped };
        }
        case 'addStability': {
            const amount = scaled(effect.amount || 0);
            const capped = Math.min(Math.abs(amount), EFFECT_CAPS.addStability) * Math.sign(amount);
            return { action: 'addStability', amount: capped };
        }
        case 'addBuff': {
            const duration = Math.min(scaled(effect.duration || 30), EFFECT_CAPS.addBuff.maxDuration);
            return {
                action: 'addBuff',
                buffId: effect.buffId || `ideology_buff_${Date.now()}`,
                effects: effect.effects || {},
                duration: Math.round(duration),
                name: effect.name || '理念效果',
            };
        }
        case 'addIdeologyScore': {
            const amount = scaled(effect.amount || 0);
            const capped = Math.min(Math.abs(amount), EFFECT_CAPS.addIdeologyScore) * Math.sign(amount);
            return { action: 'addIdeologyScore', amount: capped, category: effect.category };
        }
        case 'modifyBonus': {
            const amount = scaled(effect.amount || 0);
            const capped = Math.min(Math.abs(amount), EFFECT_CAPS.modifyBonus) * Math.sign(amount);
            return { action: 'modifyBonus', bonusKey: effect.bonusKey, amount: capped };
        }
        default:
            return null;
    }
}

// ============ Event Bus Core ============

/**
 * IdeologyEventBus — singleton pub/sub with cooldown, maxTriggers, and condition filtering.
 * 
 * Lifecycle:
 *   1. At game start / ideology equip: call registerIdeologyEvents(equipped) to bind events
 *   2. At relevant game actions: call emit(eventId, eventData, tick) to trigger effects
 *   3. Each tick: call flushLogs() to drain pending log entries
 *   4. On ideology change: call clearAllHandlers() then re-register
 */
class IdeologyEventBus {
    constructor() {
        /** @type {Map<string, Array<HandlerEntry>>} eventId -> handlers */
        this._handlers = new Map();
        /** @type {Array<string>} pending log entries to be flushed into game logs */
        this._pendingLogs = [];
        /** @type {Array<Object>} pending effect results to be applied by the caller */
        this._pendingEffects = [];
        /** @type {Map<string, number>} handlerKey -> last trigger tick (for cooldown) */
        this._cooldowns = new Map();
        /** @type {Map<string, number>} handlerKey -> trigger count (for maxTriggers) */
        this._triggerCounts = new Map();
    }

    /**
     * Register a handler for an event.
     * @param {string} eventId - one of IDEOLOGY_EVENTS values
     * @param {Object} handler - { ideologyId, ideologyName, effect, cooldownDays?, maxTriggers?, condition?, level? }
     */
    on(eventId, handler) {
        if (!eventId || !handler) return;
        if (!this._handlers.has(eventId)) {
            this._handlers.set(eventId, []);
        }
        this._handlers.get(eventId).push(handler);
    }

    /**
     * Remove all handlers for a specific ideology.
     * @param {string} ideologyId
     */
    offByIdeology(ideologyId) {
        for (const [eventId, handlers] of this._handlers.entries()) {
            this._handlers.set(eventId, handlers.filter(h => h.ideologyId !== ideologyId));
        }
        // Clean up cooldown/trigger records for this ideology
        for (const key of this._cooldowns.keys()) {
            if (key.startsWith(ideologyId + ':')) this._cooldowns.delete(key);
        }
        for (const key of this._triggerCounts.keys()) {
            if (key.startsWith(ideologyId + ':')) this._triggerCounts.delete(key);
        }
    }

    /**
     * Clear all registered handlers and state. Call when ideology loadout changes.
     */
    clearAllHandlers() {
        this._handlers.clear();
        this._cooldowns.clear();
        this._triggerCounts.clear();
        // Don't clear pending logs/effects — they should still be flushed
    }

    /**
     * Emit an event, triggering all matching handlers.
     * @param {string} eventId - one of IDEOLOGY_EVENTS values
     * @param {Object} eventData - context data for the event
     * @param {number} tick - current game tick (for cooldown calculation; 1 day = 1 tick)
     */
    emit(eventId, eventData = {}, tick = 0) {
        const handlers = this._handlers.get(eventId);
        if (!handlers || handlers.length === 0) return;

        for (const handler of handlers) {
            const handlerKey = `${handler.ideologyId}:${eventId}:${handler.effect?.action || 'unknown'}`;

            // Check maxTriggers
            if (handler.maxTriggers != null) {
                const count = this._triggerCounts.get(handlerKey) || 0;
                if (count >= handler.maxTriggers) continue;
            }

            // Check cooldown (cooldownDays in ticks, 1 day = 1 tick)
            if (handler.cooldownDays != null && handler.cooldownDays > 0) {
                const lastTick = this._cooldowns.get(handlerKey);
                if (lastTick != null && (tick - lastTick) < handler.cooldownDays) continue;
            }

            // Check condition filter
            if (handler.condition && !_matchCondition(handler.condition, eventData)) continue;

            // Execute effect
            const levelScale = _getLevelScale(handler.level || 1);
            const result = executeEffect(handler.effect, levelScale);
            if (!result) continue;

            // Record cooldown and trigger count
            this._cooldowns.set(handlerKey, tick);
            this._triggerCounts.set(handlerKey, (this._triggerCounts.get(handlerKey) || 0) + 1);

            // Queue effect result
            this._pendingEffects.push({
                ideologyId: handler.ideologyId,
                eventId,
                result,
                tick,
            });

            // Generate log entry
            const eventName = EVENT_DISPLAY_NAMES[eventId] || eventId;
            const effectDesc = _describeEffect(result);
            const logEntry = `🔮 [${handler.ideologyName || handler.ideologyId}] ${eventName}触发：${effectDesc}`;
            this._pendingLogs.push(logEntry);
        }
    }

    /**
     * Register all event handlers from a list of equipped ideologies.
     * Call this when ideology loadout changes.
     * @param {Array} equippedIdeologies - array of ideology objects with effects.levels[n].onEvents
     */
    registerIdeologyEvents(equippedIdeologies) {
        this.clearAllHandlers();
        if (!Array.isArray(equippedIdeologies)) return;

        for (const ideology of equippedIdeologies) {
            if (!ideology?.effects?.levels) continue;
            const level = ideology.level || 1;
            const levelIndex = Math.min(level, ideology.effects.levels.length) - 1;
            const levelEffects = ideology.effects.levels[levelIndex];
            if (!levelEffects?.onEvents) continue;

            for (const eventDef of levelEffects.onEvents) {
                if (!eventDef?.event || !eventDef?.effect) continue;
                this.on(eventDef.event, {
                    ideologyId: ideology.id,
                    ideologyName: ideology.name,
                    effect: eventDef.effect,
                    cooldownDays: eventDef.cooldownDays,
                    maxTriggers: eventDef.maxTriggers,
                    condition: eventDef.condition,
                    level,
                });
            }
        }
    }

    /**
     * Drain and return all pending log entries. Clears the internal queue.
     * @returns {Array<string>}
     */
    flushLogs() {
        const logs = [...this._pendingLogs];
        this._pendingLogs = [];
        return logs;
    }

    /**
     * Drain and return all pending effect results. Clears the internal queue.
     * @returns {Array<Object>} each { ideologyId, eventId, result, tick }
     */
    flushEffects() {
        const effects = [...this._pendingEffects];
        this._pendingEffects = [];
        return effects;
    }

    /**
     * Get the trigger count for a specific ideology+event combination.
     * Used by UI to display "已触发 N 次".
     * @param {string} ideologyId
     * @param {string} eventId
     * @returns {number}
     */
    getTriggerCount(ideologyId, eventId) {
        let total = 0;
        for (const [key, count] of this._triggerCounts.entries()) {
            if (key.startsWith(`${ideologyId}:${eventId}:`)) {
                total += count;
            }
        }
        return total;
    }

    /**
     * Get all trigger counts for a specific ideology.
     * @param {string} ideologyId
     * @returns {Object} { eventId: count }
     */
    getAllTriggerCounts(ideologyId) {
        const counts = {};
        for (const [key, count] of this._triggerCounts.entries()) {
            if (key.startsWith(`${ideologyId}:`)) {
                const eventId = key.split(':')[1];
                counts[eventId] = (counts[eventId] || 0) + count;
            }
        }
        return counts;
    }
}

// ============ Internal Helpers ============

/**
 * Check if eventData matches the condition filter.
 * Condition is a plain object; all keys must match (AND logic).
 * Example: { category: 'military' } matches { category: 'military', buildingId: 'barracks' }
 */
function _matchCondition(condition, eventData) {
    if (!condition || typeof condition !== 'object') return true;
    for (const [key, value] of Object.entries(condition)) {
        if (Array.isArray(value)) {
            // OR: eventData[key] must be in the array
            if (!value.includes(eventData[key])) return false;
        } else {
            // Exact match
            if (eventData[key] !== value) return false;
        }
    }
    return true;
}

/**
 * Level scale factor: L1=1.0, L2=1.5, L3=2.0
 */
function _getLevelScale(level) {
    if (level <= 1) return 1.0;
    if (level === 2) return 1.5;
    return 2.0;
}

/**
 * Generate human-readable description for an effect result.
 */
function _describeEffect(result) {
    if (!result) return '';
    switch (result.action) {
        case 'addResource': {
            const sign = result.amount >= 0 ? '+' : '';
            return `${sign}${result.amount} ${result.resource || '资源'}`;
        }
        case 'addStability': {
            const sign = result.amount >= 0 ? '+' : '';
            return `稳定度 ${sign}${result.amount}`;
        }
        case 'addBuff':
            return `获得增益「${result.name}」(${result.duration}天)`;
        case 'addIdeologyScore': {
            const sign = result.amount >= 0 ? '+' : '';
            return `理念分数 ${sign}${result.amount}${result.category ? ` (${result.category})` : ''}`;
        }
        case 'modifyBonus': {
            const sign = result.amount >= 0 ? '+' : '';
            const pct = (result.amount * 100).toFixed(0);
            return `${result.bonusKey} ${sign}${pct}%`;
        }
        default:
            return JSON.stringify(result);
    }
}

// ============ Singleton Export ============

/** Global singleton event bus instance */
export const ideologyEventBus = new IdeologyEventBus();

export default ideologyEventBus;
