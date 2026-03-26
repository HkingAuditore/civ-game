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

function safe(fn) {
    if (!isGAInitialized()) return;
    try { fn(); } catch (e) { console.warn('[GA] Event error:', e); }
}

// ═══════════════════════ Design Events ═══════════════════════

export function trackDesign(eventId, value) {
    safe(() => {
        if (value !== undefined && value !== null) {
            GA.addDesignEvent(eventId, Number(value));
        } else {
            GA.addDesignEvent(eventId);
        }
    });
    bufferDesignEvent(eventId, value);
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
export function trackBattleResult(result, lossRatio) {
    trackDesign(`${GA_EVENTS.MILITARY_BATTLE_RESULT}:${result || 'unknown'}`, lossRatio);
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
