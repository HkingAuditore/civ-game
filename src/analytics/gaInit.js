// GameAnalytics SDK 初始化与配置
// 在应用启动时调用 initGA()，之后即可通过 gaTracker 发送事件

import gameanalytics from 'gameanalytics';
import { GA_RESOURCE_CURRENCIES, GA_RESOURCE_ITEM_TYPES } from './gaEvents';

const GA = gameanalytics?.GameAnalytics;
const ANALYTICS_CONSENT_KEY = 'civ_analytics_consent';

let initialized = false;

export function initGA() {
    if (initialized) return;

    if (!GA) {
        console.error('[GA] GameAnalytics SDK failed to load — gameanalytics import:', gameanalytics);
        return;
    }

    const gameKey = import.meta.env.VITE_GA_GAME_KEY;
    const secretKey = import.meta.env.VITE_GA_SECRET_KEY;

    if (!gameKey || !secretKey) {
        if (import.meta.env.DEV) {
            console.warn('[GA] Missing VITE_GA_GAME_KEY or VITE_GA_SECRET_KEY — analytics disabled.');
        }
        return;
    }

    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (consent === 'false') {
        GA.setEnabledEventSubmission(false);
    }

    if (import.meta.env.DEV) {
        GA.setEnabledInfoLog(true);
    }

    GA.configureBuild(`web ${__APP_VERSION__}`);

    // 资源货币白名单（仅 [A-Za-z]）
    GA.configureAvailableResourceCurrencies(GA_RESOURCE_CURRENCIES);
    GA.configureAvailableResourceItemTypes(GA_RESOURCE_ITEM_TYPES);

    // 自定义维度
    GA.configureAvailableCustomDimensions01([
        'very_easy', 'easy', 'normal', 'hard', 'very_hard', 'extreme',
    ]);
    GA.configureAvailableCustomDimensions02([
        'freeplay', 'trading_republic', 'military_empire',
        'ancient_civilization', 'colonial_power', 'industrial_revolution',
    ]);
    GA.configureAvailableCustomDimensions03([
        'stone', 'bronze', 'classical', 'feudal',
        'exploration', 'enlightenment', 'industrial',
        'information', 'future',
    ]);

    GA.initialize(gameKey, secretKey);
    initialized = true;
}

export function isGAInitialized() {
    return initialized;
}

// 切换数据提交开关（GDPR）
export function setAnalyticsConsent(enabled) {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, String(enabled));
    GA.setEnabledEventSubmission(enabled);
}

export function getAnalyticsConsent() {
    const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored !== 'false';
}

// 设置自定义维度
export function setDimensions({ difficulty, scenario, epoch } = {}) {
    if (!initialized) return;
    if (difficulty) GA.setCustomDimension01(difficulty);
    if (scenario) GA.setCustomDimension02(scenario);
    if (epoch) GA.setCustomDimension03(epoch);
}
