// 成就系统逻辑钩子
// 将成就统计与解锁逻辑从 App.jsx 中抽离

import { useEffect, useMemo, useRef } from 'react';
import { ACHIEVEMENTS, COUNTRIES, EVENTS, calculateArmyPopulation } from '../config';

export const useAchievements = (gameState, { netSilverPerDay, tradeTax, taxes }) => {
    const baseEventIds = useMemo(() => new Set(EVENTS.map(event => event.id)), []);
    const unlockedAchievementIds = useMemo(
        () => new Set((gameState.unlockedAchievements || []).map(item => item.id)),
        [gameState.unlockedAchievements]
    );

    const achievementStats = useMemo(() => {
        const eventHistory = gameState.eventHistory || [];
        const eventIdSet = new Set();
        let annexCount = 0;
        let rebellionCount = 0;
        let rebellionVictoryCount = 0;
        let rebellionDefeatCount = 0;
        let coalitionRebellionCount = 0;
        eventHistory.forEach((entry) => {
            const eventId = entry?.eventId || '';
            const eventName = entry?.eventName || '';
            if (baseEventIds.has(eventId)) {
                eventIdSet.add(eventId);
            }
            if (eventId.startsWith('nation_annexed_')) {
                annexCount += 1;
            }
            if (/rebellion/i.test(eventId) || /叛乱/.test(eventName)) {
                rebellionCount += 1;
            }
            if (eventId.startsWith('rebellion_end_victory_')) {
                rebellionVictoryCount += 1;
            }
            if (eventId.startsWith('rebellion_end_defeat_')) {
                rebellionDefeatCount += 1;
            }
            if (eventId.startsWith('coalition_rebellion_')) {
                coalitionRebellionCount += 1;
            }
        });

        const techCount = (gameState.techsUnlocked || []).length;
        const buildingCount = Object.values(gameState.buildings || {})
            .reduce((sum, value) => sum + (Number(value) || 0), 0);
        const years = Math.max(1, Math.floor((gameState.daysElapsed || 0) / 360) + 1);
        const warCount = (gameState.nations || []).filter(nation => nation?.isAtWar).length;
        const armySize = calculateArmyPopulation(gameState.army || {});
        const richAll = Object.entries(gameState.popStructure || {}).every(([key, count]) => {
            if (!count || count <= 0) return true;
            const level = gameState.classLivingStandard?.[key]?.level;
            return level === '富裕' || level === '奢华';
        });
        const remainingNations = (gameState.nations || []).filter(nation => !nation?.isRebelNation).length;
        const battleResult = gameState.battleResult;
        const battleLosses = battleResult?.losses || {};
        const battleLossTotal = Object.values(battleLosses).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const battleCavalryWin = Boolean(battleResult?.victory && battleResult?.attackerAllCavalry);
        const battlePerfectWin = Boolean(battleResult?.victory && battleLossTotal === 0);
        const battleUnderdogWin = Boolean(
            battleResult?.victory
            && typeof battleResult?.powerRatio === 'number'
            && battleResult.powerRatio < 1
        );
        const battleLossRatio = battleResult?.attackerTotalUnits
            ? battleLossTotal / battleResult.attackerTotalUnits
            : null;
        const battleDominantWin = Boolean(
            battleResult?.victory
            && typeof battleResult?.powerRatio === 'number'
            && battleResult.powerRatio >= 1.5
            && battleLossRatio !== null
            && battleLossRatio <= 0.1
        );
        const battlePyrrhicWin = Boolean(
            battleResult?.victory
            && battleLossRatio !== null
            && battleLossRatio >= 0.5
        );

        const taxPolicies = gameState.taxPolicies || {};
        const taxRateValues = [
            ...Object.values(taxPolicies.headTaxRates || {}),
            ...Object.values(taxPolicies.resourceTaxRates || {}),
            ...Object.values(taxPolicies.businessTaxRates || {}),
        ].filter(value => typeof value === 'number');
        const taxAllNonPositive = taxRateValues.length > 0 && taxRateValues.every(value => value <= 0);
        const taxAllZero = taxRateValues.length > 0 && taxRateValues.every(value => value === 0);
        const taxAnyNegative = taxRateValues.some(value => value < 0);

        const tariffValues = [
            ...Object.values(taxPolicies.importTariffMultipliers || {}),
            ...Object.values(taxPolicies.exportTariffMultipliers || {}),
            ...Object.values(taxPolicies.resourceTariffMultipliers || {}),
        ].filter(value => typeof value === 'number');
        const tariffsAllNonPositive = tariffValues.length === 0 || tariffValues.every(value => value <= 0);

        const activeDecreeCount = (gameState.decrees || []).filter(d => d.active).length;

        const populatedStrataEntries = Object.entries(gameState.popStructure || {})
            .filter(([, count]) => count > 0);
        const populatedStrata = populatedStrataEntries.map(([key]) => key);
        const approvalAllHigh = populatedStrata.length > 0
            && populatedStrata.every(key => (gameState.classApproval?.[key] ?? 0) >= 80);
        const approvalAllLow = populatedStrata.length > 0
            && populatedStrata.every(key => (gameState.classApproval?.[key] ?? 0) <= 30);
        const richStrataCount = populatedStrataEntries.filter(([key]) => {
            const level = gameState.classLivingStandard?.[key]?.level;
            return level === '富裕' || level === '奢华';
        }).length;
        const poorStrataCount = populatedStrataEntries.filter(([key]) => {
            const level = gameState.classLivingStandard?.[key]?.level;
            return level === '贫困' || level === '赤贫';
        }).length;

        return {
            annexCount,
            rebellionCount,
            rebellionVictoryCount,
            rebellionDefeatCount,
            coalitionRebellionCount,
            techCount,
            eventCount: eventIdSet.size,
            buildingCount,
            years,
            warCount,
            armySize,
            richAll,
            remainingNations,
            dailyIncome: netSilverPerDay,
            battleCavalryWin,
            battlePerfectWin,
            battleUnderdogWin,
            battleDominantWin,
            battlePyrrhicWin,
            stability: gameState.stability ?? 0,
            silver: gameState.resources?.silver ?? 0,
            population: gameState.population ?? 0,
            epoch: gameState.epoch ?? 0,
            tradeRouteCount: gameState.tradeRoutes?.routes?.length || 0,
            tradeTax,
            taxIncome: taxes?.total || 0,
            taxAllNonPositive,
            taxAllZero,
            taxAnyNegative,
            tariffsAllNonPositive,
            activeDecreeCount,
            approvalAllHigh,
            approvalAllLow,
            coalitionSize: gameState.rulingCoalition?.length || 0,
            legitimacy: gameState.legitimacy ?? 0,
            popStructure: gameState.popStructure || {},
            richStrataCount,
            poorStrataCount,
            luxuryGap: (() => {
                const entries = Object.entries(gameState.popStructure || {}).filter(([, count]) => count > 0);
                if (entries.length === 0) return false;
                const levels = entries.map(([key]) => gameState.classLivingStandard?.[key]?.level || null);
                const hasLuxury = levels.some(level => level === '奢华');
                if (!hasLuxury) return false;
                return levels.every(level => level === '奢华' || level === '赤贫' || level === '贫困');
            })(),
            luxuryAll: (() => {
                const entries = Object.entries(gameState.popStructure || {}).filter(([, count]) => count > 0);
                if (entries.length === 0) return false;
                return entries.every(([key]) => gameState.classLivingStandard?.[key]?.level === '奢华');
            })(),
            povertyAll: (() => {
                const entries = Object.entries(gameState.popStructure || {}).filter(([, count]) => count > 0);
                if (entries.length === 0) return false;
                return entries.every(([key]) => {
                    const level = gameState.classLivingStandard?.[key]?.level;
                    return level === '赤贫' || level === '贫困';
                });
            })(),
            battlePerfectWinCount: gameState.achievementProgress?.battle_perfect_win || 0,
            battleCavalryWinCount: gameState.achievementProgress?.battle_cavalry_win || 0,
            luxuryGapCount: gameState.achievementProgress?.luxury_gap || 0,
            povertyAllCount: gameState.achievementProgress?.poverty_all || 0,
            luxuryAllCount: gameState.achievementProgress?.luxury_all || 0,
        };
    }, [
        baseEventIds,
        gameState.eventHistory,
        gameState.techsUnlocked,
        gameState.buildings,
        gameState.daysElapsed,
        gameState.nations,
        gameState.army,
        gameState.popStructure,
        gameState.classLivingStandard,
        gameState.battleResult,
        gameState.stability,
        gameState.resources,
        gameState.population,
        gameState.taxPolicies,
        gameState.decrees,
        gameState.classApproval,
        gameState.tradeRoutes,
        gameState.rulingCoalition,
        gameState.legitimacy,
        gameState.achievementProgress,
        tradeTax,
        taxes?.total,
        netSilverPerDay,
    ]);

    const lastLuxuryGapRef = useRef(false);
    const lastPovertyAllRef = useRef(false);
    const lastLuxuryAllRef = useRef(false);
    const lastBattleIdRef = useRef(null);

    useEffect(() => {
        if (!gameState.incrementAchievementProgress) return;
        const battleId = gameState.battleResult?.id || null;
        if (battleId && battleId !== lastBattleIdRef.current) {
            lastBattleIdRef.current = battleId;
            if (gameState.battleResult?.victory) {
                const losses = gameState.battleResult?.losses || {};
                const lossTotal = Object.values(losses).reduce((sum, value) => sum + (Number(value) || 0), 0);
                if (lossTotal === 0) {
                    gameState.incrementAchievementProgress('battle_perfect_win', 1);
                }
                if (gameState.battleResult?.attackerAllCavalry) {
                    gameState.incrementAchievementProgress('battle_cavalry_win', 1);
                }
            }
        }

        if (achievementStats.luxuryGap && !lastLuxuryGapRef.current) {
            lastLuxuryGapRef.current = true;
            gameState.incrementAchievementProgress('luxury_gap', 1);
        } else if (!achievementStats.luxuryGap) {
            lastLuxuryGapRef.current = false;
        }

        if (achievementStats.povertyAll && !lastPovertyAllRef.current) {
            lastPovertyAllRef.current = true;
            gameState.incrementAchievementProgress('poverty_all', 1);
        } else if (!achievementStats.povertyAll) {
            lastPovertyAllRef.current = false;
        }

        if (achievementStats.luxuryAll && !lastLuxuryAllRef.current) {
            lastLuxuryAllRef.current = true;
            gameState.incrementAchievementProgress('luxury_all', 1);
        } else if (!achievementStats.luxuryAll) {
            lastLuxuryAllRef.current = false;
        }
    }, [
        achievementStats.luxuryGap,
        achievementStats.povertyAll,
        achievementStats.luxuryAll,
        gameState.battleResult,
        gameState.incrementAchievementProgress,
    ]);

    useEffect(() => {
        if (!gameState.unlockAchievement) return;
        ACHIEVEMENTS.forEach((achievement) => {
            if (unlockedAchievementIds.has(achievement.id)) return;
            const condition = achievement.condition || {};
            const target = condition.target || 1;
            let met = false;
            switch (condition.type) {
                case 'annex':
                    met = achievementStats.annexCount >= target;
                    break;
                case 'annex_all':
                    met = achievementStats.remainingNations <= 0 && COUNTRIES.length > 0;
                    break;
                case 'rebellion':
                    met = achievementStats.rebellionCount >= target;
                    break;
                case 'rebellion_victory':
                    met = achievementStats.rebellionVictoryCount >= target;
                    break;
                case 'rebellion_defeat':
                    met = achievementStats.rebellionDefeatCount >= target;
                    break;
                case 'coalition_rebellion':
                    met = achievementStats.coalitionRebellionCount >= target;
                    break;
                case 'tech':
                    met = achievementStats.techCount >= target;
                    break;
                case 'event':
                    met = achievementStats.eventCount >= target;
                    break;
                case 'event_all':
                    met = achievementStats.eventCount >= baseEventIds.size;
                    break;
                case 'building':
                    met = achievementStats.buildingCount >= target;
                    break;
                case 'years':
                    met = achievementStats.years >= target;
                    break;
                case 'war_count':
                    met = achievementStats.warCount >= target;
                    break;
                case 'army_size':
                    met = achievementStats.armySize >= target;
                    break;
                case 'rich_all':
                    met = achievementStats.richAll;
                    break;
                case 'daily_income':
                    met = achievementStats.dailyIncome >= target;
                    break;
                case 'deficit':
                    met = achievementStats.dailyIncome <= target;
                    break;
                case 'stability_high':
                    met = achievementStats.stability >= target;
                    break;
                case 'stability_low':
                    met = achievementStats.stability <= target;
                    break;
                case 'treasury':
                    met = achievementStats.silver >= target;
                    break;
                case 'treasury_low':
                    met = achievementStats.silver <= target;
                    break;
                case 'population':
                    met = achievementStats.population >= target;
                    break;
                case 'epoch_reached':
                    met = achievementStats.epoch >= target;
                    break;
                case 'battle_cavalry_win':
                    met = achievementStats.battleCavalryWin;
                    break;
                case 'battle_perfect_win':
                    met = achievementStats.battlePerfectWin;
                    break;
                case 'battle_perfect_win_count':
                    met = achievementStats.battlePerfectWinCount >= target;
                    break;
                case 'battle_underdog_win':
                    met = achievementStats.battleUnderdogWin;
                    break;
                case 'battle_dominant_win':
                    met = achievementStats.battleDominantWin;
                    break;
                case 'battle_pyrrhic_win':
                    met = achievementStats.battlePyrrhicWin;
                    break;
                case 'luxury_gap':
                    met = achievementStats.luxuryGap;
                    break;
                case 'luxury_gap_count':
                    met = achievementStats.luxuryGapCount >= target;
                    break;
                case 'luxury_all':
                    met = achievementStats.luxuryAll;
                    break;
                case 'luxury_all_count':
                    met = achievementStats.luxuryAllCount >= target;
                    break;
                case 'poverty_all':
                    met = achievementStats.povertyAll;
                    break;
                case 'poverty_all_count':
                    met = achievementStats.povertyAllCount >= target;
                    break;
                case 'battle_cavalry_win_count':
                    met = achievementStats.battleCavalryWinCount >= target;
                    break;
                case 'pax_romana':
                    met = achievementStats.warCount === 0
                        && achievementStats.stability >= 80
                        && achievementStats.years >= 5;
                    break;
                case 'war_profiteer':
                    met = achievementStats.warCount >= 3 && achievementStats.dailyIncome >= 0;
                    break;
                case 'war_bankrupt':
                    met = achievementStats.warCount >= 1 && achievementStats.silver <= 0;
                    break;
                case 'caesar_dice':
                    met = achievementStats.warCount >= 1 && achievementStats.battleUnderdogWin;
                    break;
                case 'golden_mandate':
                    met = achievementStats.legitimacy >= 80
                        && achievementStats.stability >= 85
                        && achievementStats.richAll;
                    break;
                case 'tax_rich_deficit':
                    met = achievementStats.taxIncome >= target && achievementStats.dailyIncome < 0;
                    break;
                case 'polarizing_society':
                    met = achievementStats.richStrataCount >= 2 && achievementStats.poorStrataCount >= 2;
                    break;
                case 'reform_zeal':
                    met = achievementStats.taxAllZero && achievementStats.activeDecreeCount >= target;
                    break;
                case 'imperial_overstretch':
                    met = achievementStats.warCount >= 5 && achievementStats.stability <= 40;
                    break;
                case 'wall_and_silk':
                    met = achievementStats.tradeRouteCount >= 5 && achievementStats.stability >= 70;
                    break;
                case 'census_empire':
                    met = achievementStats.population >= target && achievementStats.approvalAllHigh;
                    break;
                case 'merchant_prince':
                    met = achievementStats.tradeRouteCount >= target
                        && achievementStats.taxIncome >= 500;
                    break;
                case 'law_iron':
                    met = achievementStats.activeDecreeCount >= target
                        && achievementStats.stability >= 70;
                    break;
                case 'army_sprawl':
                    met = achievementStats.armySize >= target
                        && achievementStats.dailyIncome < 0;
                    break;
                case 'people_and_sword':
                    met = achievementStats.population >= 20000
                        && achievementStats.armySize >= target;
                    break;
                case 'scholar_king':
                    met = achievementStats.techCount >= 30
                        && achievementStats.legitimacy >= 70;
                    break;
                case 'chronicler':
                    met = achievementStats.eventCount >= 60
                        && achievementStats.stability >= 70;
                    break;
                case 'annex_peace':
                    met = achievementStats.annexCount >= target
                        && achievementStats.warCount === 0;
                    break;
                case 'tax_free_profit':
                    met = achievementStats.taxAllNonPositive && achievementStats.dailyIncome > 0;
                    break;
                case 'tax_zero_profit':
                    met = achievementStats.taxAllZero && achievementStats.dailyIncome >= 0;
                    break;
                case 'bread_circus':
                    met = achievementStats.stability >= 85 && achievementStats.dailyIncome < 0;
                    break;
                case 'golden_age':
                    met = achievementStats.richAll && achievementStats.stability >= 90;
                    break;
                case 'dark_age':
                    met = achievementStats.povertyAll && achievementStats.stability <= 20;
                    break;
                case 'apocalypse':
                    met = achievementStats.stability <= 5 && achievementStats.silver <= 0;
                    break;
                case 'free_port':
                    met = achievementStats.tradeRouteCount >= 3 && achievementStats.tariffsAllNonPositive;
                    break;
                case 'silk_road':
                    met = achievementStats.tradeRouteCount >= 5 && achievementStats.tradeTax >= target;
                    break;
                case 'tax_income':
                    met = achievementStats.taxIncome >= target;
                    break;
                case 'decree_state':
                    met = achievementStats.activeDecreeCount >= target;
                    break;
                case 'approval_all_high':
                    met = achievementStats.approvalAllHigh;
                    break;
                case 'approval_all_low':
                    met = achievementStats.approvalAllLow;
                    break;
                case 'coalition_single_legit':
                    met = achievementStats.coalitionSize === 1 && achievementStats.legitimacy >= 60;
                    break;
                case 'coalition_big_legit':
                    met = achievementStats.coalitionSize >= 5 && achievementStats.legitimacy >= 60;
                    break;
                case 'mandate_heaven':
                    met = achievementStats.legitimacy >= 80 && achievementStats.stability >= 80;
                    break;
                case 'usurper':
                    met = achievementStats.legitimacy <= 30 && achievementStats.stability <= 30;
                    break;
                case 'legitimacy':
                    met = achievementStats.legitimacy >= target;
                    break;
                case 'stratum_pop':
                    met = (achievementStats.popStructure?.[condition.stratum] || 0) >= target;
                    break;
                case 'rich_strata_count':
                    met = achievementStats.richStrataCount >= target;
                    break;
                case 'poor_strata_count':
                    met = achievementStats.poorStrataCount >= target;
                    break;
                default:
                    break;
            }
            if (met) {
                gameState.unlockAchievement(achievement);
            }
        });
    }, [achievementStats, unlockedAchievementIds, gameState.unlockAchievement]);

    return { achievementStats };
};
