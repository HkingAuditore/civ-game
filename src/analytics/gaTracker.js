// GameAnalytics 事件追踪封装
// 所有上报入口统一经过此模块，便于节流、调试和未来替换 SDK

import gameanalytics from 'gameanalytics';
import { isGAInitialized } from './gaInit';
import { GA_EVENTS, GA_PROGRESSION_PREFIX } from './gaEvents';
import { bufferDesignEvent, bufferResourceEvent, bufferErrorEvent } from './customBackend';

const GA = gameanalytics?.GameAnalytics;
const EGAProgressionStatus = gameanalytics?.EGAProgressionStatus;
const EGAResourceFlowType = gameanalytics?.EGAResourceFlowType;
const EGAErrorSeverity = gameanalytics?.EGAErrorSeverity;
const UI_EVENT_PREFIX = 'UI:';
const ANALYTICS_EVENT_GROUP_FLAGS_KEY = 'civ_analytics_event_group_flags';
const DEFAULT_EVENT_GROUP_FLAGS = {
    core: true, // 经济/军事/人口/稳定等核心平衡事件
    ui: false,
    diplomacy_controls: false, // 外交微操偏好，不直接影响平衡
    strategic: false, // 低频且当前利用率低
    demand: false, // 诉求链路尚未稳定接线
    ai: true, // AI 国家状态采样 + AI 宣战/和平
    treaty: false, // 条约细分尚未形成稳定分析口径
};

let runtimeContextGetter = null;
let analyticsEventGroupFlags = loadAnalyticsEventGroupFlags();

function safe(fn) {
    if (!isGAInitialized()) return;
    try { fn(); } catch (e) { console.warn('[GA] Event error:', e); }
}

function normalizeRuntimeContext(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const daysElapsed = Number(raw.daysElapsed);
    return {
        epoch: raw.epoch || null,
        daysElapsed: Number.isFinite(daysElapsed) ? Math.max(0, Math.floor(daysElapsed)) : null,
        playerNationId: raw.playerNationId || null,
        playerNationName: raw.playerNationName || null,
    };
}

function getRuntimeContext() {
    if (typeof runtimeContextGetter !== 'function') return {};
    try {
        return normalizeRuntimeContext(runtimeContextGetter());
    } catch (e) {
        console.warn('[GA] Context getter error:', e);
        return {};
    }
}

function shouldSkipUIEvent(eventId) {
    // 当前分析目标不包含 UI 交互，统一忽略 UI 事件。
    return eventId.startsWith(UI_EVENT_PREFIX);
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function loadAnalyticsEventGroupFlags() {
    if (typeof localStorage === 'undefined') {
        return { ...DEFAULT_EVENT_GROUP_FLAGS };
    }
    try {
        const raw = localStorage.getItem(ANALYTICS_EVENT_GROUP_FLAGS_KEY);
        if (!raw) return { ...DEFAULT_EVENT_GROUP_FLAGS };
        const parsed = JSON.parse(raw);
        if (!isPlainObject(parsed)) return { ...DEFAULT_EVENT_GROUP_FLAGS };
        return {
            ...DEFAULT_EVENT_GROUP_FLAGS,
            ...Object.fromEntries(
                Object.entries(parsed).map(([key, val]) => [key, Boolean(val)])
            ),
        };
    } catch (_err) {
        return { ...DEFAULT_EVENT_GROUP_FLAGS };
    }
}

function persistAnalyticsEventGroupFlags() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(ANALYTICS_EVENT_GROUP_FLAGS_KEY, JSON.stringify(analyticsEventGroupFlags));
    } catch (_err) {
        // ignore
    }
}

function getEventGroup(eventId) {
    if (eventId.startsWith(UI_EVENT_PREFIX)) return 'ui';
    if (
        eventId.startsWith(`${GA_EVENTS.TRADE_PREFERENCE}:`)
        || eventId.startsWith(`${GA_EVENTS.TRADE_MERCHANT}:`)
        || eventId.startsWith(`${GA_EVENTS.TRADE_ROUTE_MODE}:`)
        || eventId.startsWith(`${GA_EVENTS.POLICY_PRICE_CONTROL}:`)
    ) {
        return 'diplomacy_controls';
    }
    if (eventId.startsWith(`${GA_EVENTS.STRATEGIC_ACTION}:`)) return 'strategic';
    if (eventId.startsWith(`${GA_EVENTS.DEMAND_GENERATE}:`) || eventId.startsWith(`${GA_EVENTS.DEMAND_COMPLETE}:`) || eventId.startsWith(`${GA_EVENTS.DEMAND_FAIL}:`)) return 'demand';
    if (
        eventId.startsWith(`${GA_EVENTS.AI_WAR}:`)
        || eventId.startsWith(`${GA_EVENTS.AI_PEACE}:`)
        || eventId.startsWith(`${GA_EVENTS.AI_TO_AI_WAR}:`)
        || eventId.startsWith(`${GA_EVENTS.AI_TO_AI_PEACE}:`)
        || eventId.startsWith('AINation:')
    ) return 'ai';
    if (eventId.startsWith(`${GA_EVENTS.TREATY_SIGN}:`) || eventId.startsWith(`${GA_EVENTS.TREATY_EXPIRE}:`) || eventId.startsWith(`${GA_EVENTS.TREATY_BREAK}:`)) return 'treaty';
    return 'core';
}

function shouldSkipByEventGroup(eventId) {
    const group = getEventGroup(eventId);
    const enabled = analyticsEventGroupFlags[group];
    return enabled === false;
}

function shouldSkipDesignEvent(eventId) {
    return shouldSkipUIEvent(eventId) || shouldSkipByEventGroup(eventId);
}

export function setAnalyticsContextGetter(getter) {
    runtimeContextGetter = typeof getter === 'function' ? getter : null;
}

export function getAnalyticsEventGroupFlags() {
    return { ...analyticsEventGroupFlags };
}

export function updateAnalyticsEventGroupFlags(nextFlags = {}) {
    if (!isPlainObject(nextFlags)) return getAnalyticsEventGroupFlags();
    analyticsEventGroupFlags = {
        ...analyticsEventGroupFlags,
        ...Object.fromEntries(
            Object.entries(nextFlags).map(([key, val]) => [key, Boolean(val)])
        ),
    };
    persistAnalyticsEventGroupFlags();
    return getAnalyticsEventGroupFlags();
}

export function resetAnalyticsEventGroupFlags() {
    analyticsEventGroupFlags = { ...DEFAULT_EVENT_GROUP_FLAGS };
    persistAnalyticsEventGroupFlags();
    return getAnalyticsEventGroupFlags();
}

// ═══════════════════════ Design Events ═══════════════════════

export function trackDesign(eventId, value) {
    if (shouldSkipDesignEvent(eventId)) return;
    const context = getRuntimeContext();
    safe(() => {
        if (value !== undefined && value !== null) {
            GA.addDesignEvent(eventId, Number(value));
        } else {
            GA.addDesignEvent(eventId);
        }
    });
    bufferDesignEvent(eventId, value, context);
}

// ── 游戏生命周期 ──

export function trackNewGame(difficulty) {
    trackDesign(`${GA_EVENTS.GAME_NEW}:${difficulty || 'easy'}`);
}
export function trackLoadGame(daysElapsed) {
    trackDesign(GA_EVENTS.GAME_LOAD, daysElapsed);
}
export function trackSaveGame(daysElapsed, source = 'manual') {
    const eventId = source === 'auto' ? GA_EVENTS.GAME_SAVE_AUTO : GA_EVENTS.GAME_SAVE;
    trackDesign(eventId, daysElapsed);
}
export function trackResetGame(daysElapsed) {
    trackDesign(GA_EVENTS.GAME_RESET, daysElapsed);
}
export function trackExportSave() {
    trackDesign(GA_EVENTS.GAME_EXPORT);
}
export function trackImportSave() {
    trackDesign(GA_EVENTS.GAME_IMPORT);
}
export function trackDifficultySelect(difficulty) {
    trackDesign(`${GA_EVENTS.GAME_DIFFICULTY}:${difficulty}`);
}
export function trackScenarioSelect(scenario) {
    trackDesign(`${GA_EVENTS.GAME_SCENARIO}:${scenario}`);
}

// ── 建筑 ──

export function trackBuyBuilding(buildingId, silverCost) {
    trackDesign(`${GA_EVENTS.BUILDING_BUY}:${buildingId}`, silverCost);
}
export function trackSellBuilding(buildingId) {
    trackDesign(`${GA_EVENTS.BUILDING_SELL}:${buildingId}`);
}
export function trackUpgradeBuilding(buildingId, level) {
    trackDesign(`${GA_EVENTS.BUILDING_UPGRADE}:${buildingId}`, level);
}
export function trackDowngradeBuilding(buildingId, level) {
    trackDesign(`${GA_EVENTS.BUILDING_DOWNGRADE}:${buildingId}`, level);
}
export function trackBatchUpgradeBuilding(buildingId, count) {
    trackDesign(`${GA_EVENTS.BUILDING_BATCH_UPGRADE}:${buildingId}`, count);
}
export function trackBatchDowngradeBuilding(buildingId, count) {
    trackDesign(`${GA_EVENTS.BUILDING_BATCH_DOWNGRADE}:${buildingId}`, count);
}

// ── 科技 ──

export function trackResearchTech(techId, scienceCost) {
    trackDesign(`${GA_EVENTS.TECH_RESEARCH}:${techId}`, scienceCost);
}

// ── 时代 ──

export function trackEpochUpgrade(epochId, daysElapsed) {
    trackDesign(`${GA_EVENTS.EPOCH_UPGRADE}:${epochId}`, daysElapsed);
}

// ── 外交 ──

const DIPLOMACY_ACTION_MAP = {
    declare_war: GA_EVENTS.DIPLOMACY_DECLARE_WAR,
    propose_peace: GA_EVENTS.DIPLOMACY_PEACE,
    finalize_peace: GA_EVENTS.DIPLOMACY_PEACE,
    peace: GA_EVENTS.DIPLOMACY_PEACE,
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

function sanitizeSegment(value) {
    return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

export function trackDiplomacy(action, nationId) {
    const actionKey = sanitizeSegment(action);
    const nationKey = sanitizeSegment(nationId);
    const base = DIPLOMACY_ACTION_MAP[actionKey];
    if (base) {
        trackDesign(`${base}:${nationKey}`);
        return;
    }
    // 未归类动作保留 action 维度，避免全部挤在 Diplomacy:Action。
    trackDesign(`${GA_EVENTS.DIPLOMACY_OTHER}:${actionKey}:${nationKey}`);
}

// ── 附庸 ──

export function trackVassalApprove(action, nationId) {
    trackDesign(`${GA_EVENTS.VASSAL_APPROVE}:${action}:${nationId || 'unknown'}`);
}
export function trackVassalReject(action, nationId) {
    trackDesign(`${GA_EVENTS.VASSAL_REJECT}:${action}:${nationId || 'unknown'}`);
}
export function trackVassalOrder(orderType, nationId) {
    trackDesign(`${GA_EVENTS.VASSAL_ORDER}:${orderType}:${nationId || 'unknown'}`);
}

// ── 和约 ──

export function trackPeaceAccept(nationId) {
    trackDesign(`${GA_EVENTS.PEACE_ACCEPT}:${nationId || 'unknown'}`);
}
export function trackPeaceReject(nationId) {
    trackDesign(`${GA_EVENTS.PEACE_REJECT}:${nationId || 'unknown'}`);
}
export function trackPeacePropose(nationId) {
    trackDesign(`${GA_EVENTS.PEACE_PROPOSE}:${nationId || 'unknown'}`);
}

// ── 军事 ──

export function trackRecruit(unitId, count) {
    trackDesign(`${GA_EVENTS.MILITARY_RECRUIT}:${unitId}`, count);
}
export function trackBattleLaunch() {
    trackDesign(GA_EVENTS.MILITARY_BATTLE_LAUNCH);
}
export function trackBattleResult(result, lossRatio, nationId) {
    const nid = nationId ? `:${sanitizeSegment(nationId)}` : '';
    trackDesign(`${GA_EVENTS.MILITARY_BATTLE_RESULT}:${result || 'unknown'}${nid}`, lossRatio);
}
export function trackDisband(unitId, count) {
    trackDesign(`${GA_EVENTS.MILITARY_DISBAND}:${unitId}`, count);
}
export function trackDisbandAll(totalCount) {
    trackDesign(GA_EVENTS.MILITARY_DISBAND_ALL, totalCount);
}
export function trackCancelTraining(unitId) {
    trackDesign(`${GA_EVENTS.MILITARY_CANCEL_TRAIN}:${unitId}`);
}
export function trackCancelAllTraining(queueSize) {
    trackDesign(GA_EVENTS.MILITARY_CANCEL_ALL, queueSize);
}
export function trackAutoReplenish(enabled) {
    trackDesign(`${GA_EVENTS.MILITARY_AUTO_REPLENISH}:${enabled ? 'on' : 'off'}`);
}
export function trackWageRatio(ratio) {
    trackDesign(GA_EVENTS.MILITARY_WAGE_RATIO, Math.round(ratio * 100));
}

// ── 政治 ──

export function trackStrategicAction(type, stratumId) {
    trackDesign(`${GA_EVENTS.STRATEGIC_ACTION}:${type}:${stratumId || 'unknown'}`);
}
export function trackDecreeToggle(decreeId) {
    trackDesign(`${GA_EVENTS.DECREE_TOGGLE}:${decreeId}`);
}
export function trackRebellionPhase(phase, stratumId, organization) {
    trackDesign(`${GA_EVENTS.REBELLION_PHASE}:${phase}:${stratumId}`, organization);
}
export function trackRebellionAction(actionType, stratumId) {
    trackDesign(`${GA_EVENTS.REBELLION_ACTION}:${actionType}:${stratumId || 'unknown'}`);
}
export function trackRebellionCoalition(stratumId) {
    trackDesign(`${GA_EVENTS.REBELLION_COALITION}:${stratumId}`);
}
export function trackOfficialHire() {
    trackDesign(GA_EVENTS.OFFICIAL_HIRE);
}
export function trackOfficialFire() {
    trackDesign(GA_EVENTS.OFFICIAL_FIRE);
}
export function trackOfficialSalary(newSalary) {
    trackDesign(GA_EVENTS.OFFICIAL_SALARY, newSalary);
}
export function trackMinisterAssign(role) {
    trackDesign(`${GA_EVENTS.OFFICIAL_MINISTER}:${role}`);
}
export function trackCoalitionChange(memberCount) {
    trackDesign(GA_EVENTS.COALITION_CHANGE, memberCount);
}

// ── 税收与政策 ──

export function trackTaxChange(taxType, stratumOrResource, newRate) {
    trackDesign(`${GA_EVENTS.TAX_CHANGE}:${taxType}:${stratumOrResource}`, Math.round(newRate * 100));
}
export function trackPriceControl(resource, controlPrice) {
    trackDesign(`${GA_EVENTS.POLICY_PRICE_CONTROL}:${resource}`, controlPrice);
}

// ── 贸易 ──

export function trackTradePreference(direction, resource) {
    trackDesign(`${GA_EVENTS.TRADE_PREFERENCE}:${direction}:${resource}`);
}
export function trackMerchantAssign(nationId, count) {
    trackDesign(`${GA_EVENTS.TRADE_MERCHANT}:${nationId}`, count);
}
export function trackTradeRouteMode(nationId, mode) {
    trackDesign(`${GA_EVENTS.TRADE_ROUTE_MODE}:${nationId}:${mode}`);
}

// ── 事件系统 ──

export function trackEventChoice(eventId, optionIndex) {
    trackDesign(`${GA_EVENTS.EVENT_CHOOSE}:${eventId}:${optionIndex}`);
}

// ── 手动采集 ──

export function trackManualGather(amount) {
    trackDesign(GA_EVENTS.ACTION_GATHER, amount);
}

// ── 理念 ──

export function trackIdeologyEquip(ideologyId) {
    trackDesign(`${GA_EVENTS.IDEOLOGY_EQUIP}:${ideologyId}`);
}
export function trackIdeologyUnequip(ideologyId) {
    trackDesign(`${GA_EVENTS.IDEOLOGY_UNEQUIP}:${ideologyId}`);
}
export function trackIdeologyEmergenceSelect(ideologyId, scoreCost) {
    trackDesign(`${GA_EVENTS.IDEOLOGY_EMERGENCE_SELECT}:${ideologyId}`, scoreCost);
}
export function trackIdeologyEmergenceSkip(scoreCost) {
    trackDesign(GA_EVENTS.IDEOLOGY_EMERGENCE_SKIP, scoreCost);
}

// ── 成就 ──

export function trackAchievement(achievementId, daysElapsed) {
    trackDesign(`${GA_EVENTS.ACHIEVEMENT_UNLOCK}:${achievementId}`, daysElapsed);
}

// ── 周期采样（每 N 游戏日调用一次） ──

export function trackPeriodicMetrics({ gdp, cpi, ppi, population, stability, treasury, armySize }) {
    if (gdp !== undefined) trackDesign(GA_EVENTS.ECONOMY_GDP, gdp);
    if (cpi !== undefined) trackDesign(GA_EVENTS.ECONOMY_CPI, cpi);
    if (ppi !== undefined) trackDesign(GA_EVENTS.ECONOMY_PPI, ppi);
    if (population !== undefined) trackDesign(GA_EVENTS.POPULATION_TOTAL, population);
    if (stability !== undefined) trackDesign(GA_EVENTS.STABILITY_LEVEL, stability);
    if (treasury !== undefined) trackDesign(GA_EVENTS.ECONOMY_TREASURY, treasury);
    if (armySize !== undefined) trackDesign(GA_EVENTS.MILITARY_ARMY_SIZE, armySize);
}

export function trackEconomicFlows({ taxIncome, tradeIncome, militaryCost, buildingCost, officialCost }) {
    if (taxIncome) trackDesign(GA_EVENTS.ECON_FLOW_TAX, Math.round(taxIncome));
    if (tradeIncome) trackDesign(GA_EVENTS.ECON_FLOW_TRADE, Math.round(tradeIncome));
    if (militaryCost) trackDesign(GA_EVENTS.ECON_FLOW_MILITARY, Math.round(militaryCost));
    if (buildingCost) trackDesign(GA_EVENTS.ECON_FLOW_BUILDING, Math.round(buildingCost));
    if (officialCost) trackDesign(GA_EVENTS.ECON_FLOW_OFFICIAL, Math.round(officialCost));
}

export function trackPriceSampling(prices) {
    if (!prices) return;
    const priceKeys = ['food', 'wood', 'stone', 'iron', 'cloth', 'tools'];
    for (const key of priceKeys) {
        if (prices[key] !== undefined) {
            trackDesign(`Price:${key}`, Math.round(prices[key] * 100) / 100);
        }
    }
}

// ── 里程碑与状态变化 ──

export function trackPopulationMilestone(milestone, population) {
    trackDesign(`${GA_EVENTS.POPULATION_MILESTONE}:${milestone}`, population);
}
export function trackPopulationExodus(stratumKey, count) {
    trackDesign(`${GA_EVENTS.POPULATION_EXODUS}:${stratumKey}`, count);
}
export function trackPopulationStarvation(deaths) {
    trackDesign(GA_EVENTS.POPULATION_STARVATION, deaths);
}
export function trackStabilityLevelChange(newLevel, stability) {
    trackDesign(`${GA_EVENTS.STABILITY_CHANGE}:${newLevel}`, Math.round(stability));
}
export function trackLegitimacyChange(level, legitimacy) {
    trackDesign(`${GA_EVENTS.LEGITIMACY_CHANGE}:${level}`, Math.round(legitimacy));
}
export function trackEconomicCrisis(type, value) {
    trackDesign(`${GA_EVENTS.ECONOMY_CRISIS}:${type}`, value);
}

// ── 诉求系统 ──

export function trackDemandGenerate(demandType, stratumKey) {
    trackDesign(`${GA_EVENTS.DEMAND_GENERATE}:${demandType}:${stratumKey}`);
}
export function trackDemandComplete(demandType, daysToFulfill) {
    trackDesign(`${GA_EVENTS.DEMAND_COMPLETE}:${demandType}`, daysToFulfill);
}
export function trackDemandFail(demandType) {
    trackDesign(`${GA_EVENTS.DEMAND_FAIL}:${demandType}`);
}

// ── 组织度 ──

export function trackOrganizationPhase(stratumKey, newPhase, organization) {
    trackDesign(`${GA_EVENTS.ORGANIZATION_PHASE}:${stratumKey}:${newPhase}`, Math.round(organization));
}

// ── AI 行为 ──

export function trackAIWar(nationId) {
    trackDesign(`${GA_EVENTS.AI_WAR}:${nationId}`);
}
export function trackAIPeace(nationId) {
    trackDesign(`${GA_EVENTS.AI_PEACE}:${nationId}`);
}
export function trackAIToAIWar(attackerId, defenderId) {
    trackDesign(`${GA_EVENTS.AI_TO_AI_WAR}:${attackerId}:${defenderId}`);
}
export function trackAIToAIPeace(nationA, nationB) {
    trackDesign(`${GA_EVENTS.AI_TO_AI_PEACE}:${nationA}:${nationB}`);
}

// ── AI 国家周期采样 ──

export function trackAINationSampling(nations) {
    if (!Array.isArray(nations)) return;
    const MAX_SAMPLE = 5;
    const sorted = nations
        .filter(n => n && n.id && !n.isRebelNation)
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .slice(0, MAX_SAMPLE);
    for (const n of sorted) {
        const nid = sanitizeSegment(n.id);
        if (n.population !== undefined) trackDesign(`${GA_EVENTS.AI_NATION_POP}:${nid}`, Math.round(n.population));
        if (n.wealth !== undefined) trackDesign(`${GA_EVENTS.AI_NATION_WEALTH}:${nid}`, Math.round(n.wealth));
        if (n.relation !== undefined) trackDesign(`${GA_EVENTS.AI_NATION_RELATION}:${nid}`, Math.round(n.relation));
    }
}

// ── 条约 ──

export function trackTreatySign(treatyType, nationId) {
    trackDesign(`${GA_EVENTS.TREATY_SIGN}:${treatyType}:${nationId || 'unknown'}`);
}
export function trackTreatyExpire(treatyType) {
    trackDesign(`${GA_EVENTS.TREATY_EXPIRE}:${treatyType}`);
}
export function trackTreatyBreak(treatyType, nationId) {
    trackDesign(`${GA_EVENTS.TREATY_BREAK}:${treatyType}:${nationId || 'unknown'}`);
}

// ── 外交吞并 ──

export function trackAnnex(nationId) {
    trackDesign(`${GA_EVENTS.DIPLOMACY_ANNEX}:${nationId}`);
}

// ── UI 导航与参与度 ──

export function trackTabSwitch(tabId) {
    trackDesign(`${GA_EVENTS.UI_TAB}:${tabId}`);
}
export function trackSubTabSwitch(parentTab, subTab) {
    trackDesign(`${GA_EVENTS.UI_SUB_TAB}:${parentTab}:${subTab}`);
}
export function trackSpeedChange(speed) {
    trackDesign(`${GA_EVENTS.UI_SPEED}:${speed}`);
}
export function trackPause() {
    trackDesign(GA_EVENTS.UI_PAUSE);
}
export function trackResume() {
    trackDesign(GA_EVENTS.UI_RESUME);
}
export function trackBuildingPin(buildingId) {
    trackDesign(`${GA_EVENTS.UI_PIN_BUILDING}:${buildingId}`);
}
export function trackBuildingFilter(category) {
    trackDesign(`${GA_EVENTS.UI_FILTER_BUILDING}:${category}`);
}
export function trackDetailView(type, id) {
    trackDesign(`${GA_EVENTS.UI_DETAIL}:${type}:${id}`);
}
export function trackTutorialOpen() {
    trackDesign(GA_EVENTS.UI_TUTORIAL);
}
export function trackWikiOpen() {
    trackDesign(GA_EVENTS.UI_WIKI);
}
export function trackSettingsOpen() {
    trackDesign(GA_EVENTS.UI_SETTINGS);
}

// ═══════════════════════ Progression Events ═══════════════════════

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

// ═══════════════════════ Resource Events ═══════════════════════

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
    bufferResourceEvent('sink', currency, amount, itemType, itemId);
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
    bufferResourceEvent('source', currency, amount, itemType, itemId);
}

// ═══════════════════════ Error Events ═══════════════════════

const SEVERITY_NAMES = { 1: 'debug', 2: 'info', 3: 'warning', 4: 'error', 5: 'critical' };

export function trackError(severity, message) {
    safe(() => {
        GA.addErrorEvent(severity, message);
    });
    bufferErrorEvent(SEVERITY_NAMES[severity] || 'error', message);
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

// ═══════════════════════ 全局异常捕获 ═══════════════════════

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
