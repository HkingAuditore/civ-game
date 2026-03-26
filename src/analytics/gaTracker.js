// GameAnalytics 事件追踪封装
// 所有上报入口统一经过此模块，便于节流、调试和未来替换 SDK

import gameanalytics from 'gameanalytics';
import { isGAInitialized } from './gaInit';
import { GA_EVENTS, GA_PROGRESSION_PREFIX } from './gaEvents';

const GA = gameanalytics?.GameAnalytics;
const EGAProgressionStatus = gameanalytics?.EGAProgressionStatus;
const EGAResourceFlowType = gameanalytics?.EGAResourceFlowType;
const EGAErrorSeverity = gameanalytics?.EGAErrorSeverity;

function safe(fn) {
    if (!isGAInitialized()) return;
    try { fn(); } catch (e) { console.warn('[GA] Event error:', e); }
}

// ──────────────────── Design Events ────────────────────

export function trackDesign(eventId, value) {
    safe(() => {
        if (value !== undefined && value !== null) {
            GA.addDesignEvent(eventId, Number(value));
        } else {
            GA.addDesignEvent(eventId);
        }
    });
}

// 游戏生命周期
export function trackNewGame(difficulty) {
    trackDesign(`${GA_EVENTS.GAME_NEW}:${difficulty || 'easy'}`);
}
export function trackLoadGame(daysElapsed) {
    trackDesign(GA_EVENTS.GAME_LOAD, daysElapsed);
}
export function trackSaveGame(daysElapsed) {
    trackDesign(GA_EVENTS.GAME_SAVE, daysElapsed);
}
export function trackResetGame(daysElapsed) {
    trackDesign(GA_EVENTS.GAME_RESET, daysElapsed);
}

// 建筑
export function trackBuyBuilding(buildingId, silverCost) {
    trackDesign(`${GA_EVENTS.BUILDING_BUY}:${buildingId}`, silverCost);
}
export function trackSellBuilding(buildingId) {
    trackDesign(`${GA_EVENTS.BUILDING_SELL}:${buildingId}`);
}
export function trackUpgradeBuilding(buildingId, level) {
    trackDesign(`${GA_EVENTS.BUILDING_UPGRADE}:${buildingId}`, level);
}

// 科技
export function trackResearchTech(techId, scienceCost) {
    trackDesign(`${GA_EVENTS.TECH_RESEARCH}:${techId}`, scienceCost);
}

// 时代
export function trackEpochUpgrade(epochId, daysElapsed) {
    trackDesign(`${GA_EVENTS.EPOCH_UPGRADE}:${epochId}`, daysElapsed);
}

// 外交
const DIPLOMACY_ACTION_MAP = {
    declare_war: GA_EVENTS.DIPLOMACY_DECLARE_WAR,
    propose_peace: GA_EVENTS.DIPLOMACY_PEACE,
    finalize_peace: GA_EVENTS.DIPLOMACY_PEACE,
    peace: GA_EVENTS.DIPLOMACY_PEACE,
    trade_route: GA_EVENTS.DIPLOMACY_TRADE_ROUTE,
    propose_alliance: GA_EVENTS.DIPLOMACY_ALLIANCE,
    break_alliance: GA_EVENTS.DIPLOMACY_ALLIANCE,
    establish_vassal: GA_EVENTS.DIPLOMACY_VASSAL,
    release_vassal: GA_EVENTS.DIPLOMACY_VASSAL,
    gift: GA_EVENTS.DIPLOMACY_GIFT,
    trade: GA_EVENTS.DIPLOMACY_TRADE,
    propose_treaty: GA_EVENTS.DIPLOMACY_TREATY,
    negotiate_treaty: GA_EVENTS.DIPLOMACY_TREATY,
    break_treaty: GA_EVENTS.DIPLOMACY_TREATY,
};

export function trackDiplomacy(action, nationId) {
    const base = DIPLOMACY_ACTION_MAP[action] || GA_EVENTS.DIPLOMACY_OTHER;
    trackDesign(`${base}:${nationId || 'unknown'}`);
}

// 军事
export function trackRecruit(unitId, count) {
    trackDesign(`${GA_EVENTS.MILITARY_RECRUIT}:${unitId}`, count);
}
export function trackBattleLaunch() {
    trackDesign(GA_EVENTS.MILITARY_BATTLE_LAUNCH);
}
export function trackBattleResult(result, lossRatio) {
    trackDesign(`${GA_EVENTS.MILITARY_BATTLE_RESULT}:${result || 'unknown'}`, lossRatio);
}
export function trackDisband(unitId, count) {
    trackDesign(`${GA_EVENTS.MILITARY_DISBAND}:${unitId}`, count);
}

// 政治
export function trackStrategicAction(type, stratumId) {
    trackDesign(`${GA_EVENTS.STRATEGIC_ACTION}:${type}:${stratumId || 'unknown'}`);
}
export function trackDecreeToggle(decreeId) {
    trackDesign(`${GA_EVENTS.DECREE_TOGGLE}:${decreeId}`);
}
export function trackRebellionPhase(phase, stratumId, organization) {
    trackDesign(`${GA_EVENTS.REBELLION_PHASE}:${phase}:${stratumId}`, organization);
}
export function trackOfficialHire() {
    trackDesign(GA_EVENTS.OFFICIAL_HIRE);
}
export function trackOfficialFire() {
    trackDesign(GA_EVENTS.OFFICIAL_FIRE);
}

// 成就
export function trackAchievement(achievementId, daysElapsed) {
    trackDesign(`${GA_EVENTS.ACHIEVEMENT_UNLOCK}:${achievementId}`, daysElapsed);
}

// 周期采样（每 N 游戏日调用一次）
export function trackPeriodicMetrics({ gdp, cpi, population, stability, treasury, armySize }) {
    if (gdp !== undefined) trackDesign(GA_EVENTS.ECONOMY_GDP, gdp);
    if (cpi !== undefined) trackDesign(GA_EVENTS.ECONOMY_CPI, cpi);
    if (population !== undefined) trackDesign(GA_EVENTS.POPULATION_TOTAL, population);
    if (stability !== undefined) trackDesign(GA_EVENTS.STABILITY_LEVEL, stability);
    if (treasury !== undefined) trackDesign(GA_EVENTS.ECONOMY_TREASURY, treasury);
    if (armySize !== undefined) trackDesign(GA_EVENTS.MILITARY_ARMY_SIZE, armySize);
}

// ──────────────────── Progression Events ────────────────────

const EPOCH_NAMES = [
    'StoneAge', 'BronzeAge', 'ClassicalAge', 'FeudalAge',
    'ExplorationAge', 'EnlightenmentAge', 'IndustrialAge',
    'InformationAge', 'FutureAge',
];

function epochName(epochId) {
    return EPOCH_NAMES[epochId] || `Epoch${epochId}`;
}

export function trackProgressionStart(epochId) {
    safe(() => {
        GA.addProgressionEvent(
            EGAProgressionStatus.Start,
            GA_PROGRESSION_PREFIX,
            epochName(epochId)
        );
    });
}

export function trackProgressionComplete(epochId) {
    safe(() => {
        GA.addProgressionEvent(
            EGAProgressionStatus.Complete,
            GA_PROGRESSION_PREFIX,
            epochName(epochId)
        );
    });
}

// ──────────────────── Resource Events ────────────────────

export function trackResourceSink(currency, amount, itemType, itemId) {
    if (!amount || amount <= 0) return;
    safe(() => {
        GA.addResourceEvent(
            EGAResourceFlowType.Sink,
            currency,
            Math.round(amount),
            itemType,
            itemId || 'default'
        );
    });
}

export function trackResourceSource(currency, amount, itemType, itemId) {
    if (!amount || amount <= 0) return;
    safe(() => {
        GA.addResourceEvent(
            EGAResourceFlowType.Source,
            currency,
            Math.round(amount),
            itemType,
            itemId || 'default'
        );
    });
}

// ──────────────────── Error Events ────────────────────

export function trackError(severity, message) {
    safe(() => {
        GA.addErrorEvent(severity, message);
    });
}

export function trackErrorDebug(message) {
    trackError(EGAErrorSeverity.Debug, message);
}
export function trackErrorInfo(message) {
    trackError(EGAErrorSeverity.Info, message);
}
export function trackErrorWarning(message) {
    trackError(EGAErrorSeverity.Warning, message);
}
export function trackErrorError(message) {
    trackError(EGAErrorSeverity.Error, message);
}
export function trackErrorCritical(message) {
    trackError(EGAErrorSeverity.Critical, message);
}

// ──────────────────── 全局异常捕获 ────────────────────

export function installGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
        const msg = `UncaughtError: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
        trackErrorCritical(msg.slice(0, 256));
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = `UnhandledRejection: ${reason?.message || reason || 'unknown'}`;
        trackErrorCritical(msg.slice(0, 256));
    });
}
