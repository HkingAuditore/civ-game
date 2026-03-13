/**
 * Annual Report Utility Module
 * Handles year-end data snapshot collection, YoY comparison,
 * rating/scoring computation, and export text generation.
 */

import { BUILDINGS, EPOCHS, STRATA, RESOURCES, TECHS } from '../config';
import { calculateArmyPopulation, UNIT_TYPES } from '../config/militaryUnits';
import { formatNumberShortCN } from './numberFormat';

// ============================================================
// Helper: safe numeric value
// ============================================================
const safe = (v, fallback = 0) => {
    if (v == null || !Number.isFinite(v)) return fallback;
    return v;
};

const pct = (current, baseline) => {
    if (baseline === 0 && current === 0) return 0;
    if (baseline === 0) return current > 0 ? 100 : -100;
    return ((current - baseline) / Math.abs(baseline)) * 100;
};

// Chinese abbreviation number formatting (万/亿), consistent with game UI
const fmtNum = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    return formatNumberShortCN(n, { decimals: 1 });
};

const fmtDelta = (delta, pctVal) => {
    if (delta == null) return '';
    const sign = delta > 0 ? '📈+' : delta < 0 ? '📉' : '➖';
    const deltaStr = formatNumberShortCN(Math.abs(delta), { decimals: 1 });
    const pctStr = pctVal != null && Number.isFinite(pctVal) ? ` (${pctVal > 0 ? '+' : ''}${pctVal.toFixed(1)}%)` : '';
    return `${sign}${delta < 0 ? '-' : ''}${deltaStr}${pctStr}`;
};

// ============================================================
// 1. collectAnnualSnapshot
// ============================================================
/**
 * Collect a snapshot of all key metrics from current game state.
 * Designed to be called at year-end and year-start baseline capture.
 * @param {Object} gs - gameState (from useGameState return or stateRef.current)
 * @returns {Object} flat snapshot object
 */
export const collectAnnualSnapshot = (gs) => {
    if (!gs) return null;

    // --- Economy ---
    const silver = safe(gs.resources?.silver);
    const gdp = safe(gs.economicIndicators?.gdp?.total);
    const gdpChange = safe(gs.economicIndicators?.gdp?.change);
    const cpi = safe(gs.economicIndicators?.cpi?.index, 100);
    const ppi = safe(gs.economicIndicators?.ppi?.index, 100);
    const fiscalSilverDelta = safe(gs.fiscalActual?.silverDelta);

    // --- Population ---
    const population = safe(gs.population);
    const popStructure = gs.popStructure ? { ...gs.popStructure } : {};

    // --- Social ---
    const classApproval = gs.classApproval ? { ...gs.classApproval } : {};
    const stability = safe(gs.stability, 50);

    // --- Industry (buildings count by category) ---
    const buildings = gs.buildings || {};
    const buildingUpgrades = gs.buildingUpgrades || {};
    let totalBuildings = 0;
    const buildingsByCategory = { gather: 0, industry: 0, civic: 0, military: 0 };

    // Compute category counts using BUILDINGS config (field is 'cat' not 'category')
    if (Array.isArray(BUILDINGS)) {
        BUILDINGS.forEach(bConfig => {
            const count = safe(buildings[bConfig.id]);
            if (count > 0) {
                totalBuildings += count;
                const cat = bConfig.cat || bConfig.category;
                if (cat && buildingsByCategory[cat] !== undefined) {
                    buildingsByCategory[cat] += count;
                }
            }
        });
    }

    // --- Military ---
    const army = gs.army || {};
    const armyPopulation = calculateArmyPopulation(army);
    const militaryCorps = gs.militaryCorps || [];
    // Only count player corps (exclude AI nation corps)
    const playerCorps = Array.isArray(militaryCorps) ? militaryCorps.filter(c => !c.isAI) : [];
    const corpsCount = playerCorps.length;

    // Army composition by category
    const armyComposition = {};
    for (const [unitId, count] of Object.entries(army)) {
        if (count <= 0) continue;
        const unit = UNIT_TYPES?.[unitId];
        if (!unit) continue;
        const cat = unit.category || 'other';
        if (!armyComposition[cat]) armyComposition[cat] = { count: 0, population: 0 };
        armyComposition[cat].count += count;
        armyComposition[cat].population += (unit.populationCost || 1) * count;
    }

    // Daily military expense
    const militaryExpenseData = gs.dailyMilitaryExpense;
    const dailyMilitaryExpense = safe(militaryExpenseData?.dailyExpense);

    // --- Resources (full snapshot) ---
    const resources = gs.resources ? { ...gs.resources } : {};

    // --- Tech / Culture ---
    const techsUnlockedList = Array.isArray(gs.techsUnlocked) ? gs.techsUnlocked : [];
    const techsUnlocked = techsUnlockedList.length;
    const epoch = safe(gs.epoch, 0);

    // Collect recent tech names (last 5 unlocked techs) for display
    const recentTechIds = techsUnlockedList.slice(-5);
    const recentTechs = recentTechIds.map(id => {
        const techConfig = TECHS?.find?.(t => t.id === id);
        return { id, name: techConfig?.name || id };
    });

    // --- Taxes (from taxes state which tracks daily tax totals) ---
    const taxes = gs.taxes || {};
    const totalTax = safe(taxes.total);
    // fiscalActual.silverDelta is the net daily treasury change (more reliable for fiscal overview)
    const fiscalNetIncome = safe(gs.fiscalActual?.silverDelta);

    return {
        // Economy
        silver,
        gdp,
        gdpChange,
        cpi,
        ppi,
        fiscalSilverDelta,
        totalTax,
        fiscalNetIncome,

        // Population
        population,
        popStructure,

        // Social
        classApproval,
        stability,

        // Industry
        totalBuildings,
        buildingsByCategory,
        buildingUpgrades: buildingUpgrades ? { ...buildingUpgrades } : {},

        // Military
        armyPopulation,
        corpsCount,
        armyComposition,
        dailyMilitaryExpense,

        // Resources
        resources,

        // Tech
        techsUnlocked,
        epoch,
        recentTechs,

        // Timestamp
        daysElapsed: safe(gs.daysElapsed),
    };
};

// ============================================================
// 2. computeYoYChanges
// ============================================================
/**
 * Compute year-over-year changes between current and baseline snapshots.
 * @param {Object} current - current year-end snapshot
 * @param {Object|null} baseline - previous year-end (or year-start) snapshot
 * @returns {Object} changes with absolute delta and percentage for each metric
 */
export const computeYoYChanges = (current, baseline) => {
    if (!current) return { isFirstYear: true };
    if (!baseline) return { isFirstYear: true, current };

    const change = (key) => {
        const cur = safe(current[key]);
        const base = safe(baseline[key]);
        return {
            current: cur,
            previous: base,
            delta: cur - base,
            percent: pct(cur, base),
        };
    };

    // Class approval changes
    const approvalChanges = {};
    const curApproval = current.classApproval || {};
    const baseApproval = baseline.classApproval || {};
    for (const cls of Object.keys(curApproval)) {
        approvalChanges[cls] = {
            current: safe(curApproval[cls]),
            previous: safe(baseApproval[cls]),
            delta: safe(curApproval[cls]) - safe(baseApproval[cls]),
        };
    }

    // Population structure changes
    const popStructureChanges = {};
    const curPop = current.popStructure || {};
    const basePop = baseline.popStructure || {};
    for (const cls of Object.keys(curPop)) {
        popStructureChanges[cls] = {
            current: safe(curPop[cls]),
            previous: safe(basePop[cls]),
            delta: safe(curPop[cls]) - safe(basePop[cls]),
        };
    }

    // Building category changes
    const buildingCategoryChanges = {};
    const curCats = current.buildingsByCategory || {};
    const baseCats = baseline.buildingsByCategory || {};
    for (const cat of ['gather', 'industry', 'civic', 'military']) {
        buildingCategoryChanges[cat] = {
            current: safe(curCats[cat]),
            previous: safe(baseCats[cat]),
            delta: safe(curCats[cat]) - safe(baseCats[cat]),
        };
    }

    // Building upgrades summary
    const curUpgrades = current.buildingUpgrades || {};
    const baseUpgrades = baseline.buildingUpgrades || {};
    let curTotalUpgraded = 0;
    let baseTotalUpgraded = 0;
    for (const levels of Object.values(curUpgrades)) {
        for (const [lvl, cnt] of Object.entries(levels || {})) {
            if (parseInt(lvl) > 0) curTotalUpgraded += safe(cnt);
        }
    }
    for (const levels of Object.values(baseUpgrades)) {
        for (const [lvl, cnt] of Object.entries(levels || {})) {
            if (parseInt(lvl) > 0) baseTotalUpgraded += safe(cnt);
        }
    }
    const upgradeChange = {
        current: curTotalUpgraded,
        previous: baseTotalUpgraded,
        delta: curTotalUpgraded - baseTotalUpgraded,
        percent: pct(curTotalUpgraded, baseTotalUpgraded),
    };

    // Resource changes (find top movers)
    const resourceChanges = {};
    const curRes = current.resources || {};
    const baseRes = baseline.resources || {};
    const allResKeys = new Set([...Object.keys(curRes), ...Object.keys(baseRes)]);
    for (const key of allResKeys) {
        if (key === 'silver') continue; // silver handled separately
        const cur = safe(curRes[key]);
        const base = safe(baseRes[key]);
        if (cur === 0 && base === 0) continue;
        resourceChanges[key] = {
            current: cur,
            previous: base,
            delta: cur - base,
            percent: pct(cur, base),
        };
    }

    return {
        isFirstYear: false,
        economy: {
            silver: change('silver'),
            gdp: change('gdp'),
            cpi: change('cpi'),
            ppi: change('ppi'),
            totalTax: change('totalTax'),
            fiscalNetIncome: change('fiscalNetIncome'),
        },
        population: {
            total: change('population'),
            structure: popStructureChanges,
        },
        social: {
            stability: change('stability'),
            approval: approvalChanges,
        },
        industry: {
            total: change('totalBuildings'),
            categories: buildingCategoryChanges,
            upgrades: upgradeChange,
        },
        military: {
            armyPopulation: change('armyPopulation'),
            corpsCount: change('corpsCount'),
            dailyMilitaryExpense: change('dailyMilitaryExpense'),
        },
        resources: resourceChanges,
        tech: {
            techsUnlocked: change('techsUnlocked'),
            epoch: change('epoch'),
        },
    };
};

// ============================================================
// 3. rateMetric
// ============================================================
const RATING_THRESHOLDS = {
    // Metrics where higher growth is better
    positive: [
        { min: 30, grade: 'S', label: '卓越' },
        { min: 15, grade: 'A', label: '优秀' },
        { min: 5, grade: 'B', label: '良好' },
        { min: 0, grade: 'C', label: '稳定' },
        { min: -10, grade: 'D', label: '衰退' },
        { min: -Infinity, grade: 'F', label: '危机' },
    ],
    // Metrics where lower is better (like CPI - lower inflation is better)
    inflation: [
        { min: -Infinity, max: 2, grade: 'S', label: '物价稳定' },
        { min: 2, max: 5, grade: 'A', label: '温和通胀' },
        { min: 5, max: 10, grade: 'B', label: '通胀可控' },
        { min: 10, max: 20, grade: 'C', label: '通胀偏高' },
        { min: 20, max: 50, grade: 'D', label: '严重通胀' },
        { min: 50, max: Infinity, grade: 'F', label: '恶性通胀' },
    ],
    // Stability rating (absolute value 0-100)
    stability: [
        { min: 80, grade: 'S', label: '太平盛世' },
        { min: 60, grade: 'A', label: '社会稳定' },
        { min: 40, grade: 'B', label: '基本稳定' },
        { min: 25, grade: 'C', label: '有些动荡' },
        { min: 10, grade: 'D', label: '社会动荡' },
        { min: -Infinity, grade: 'F', label: '濒临崩溃' },
    ],
};

/**
 * Rate a single metric.
 * @param {string} metricKey - one of 'gdp', 'population', 'buildings', 'military', 'silver', 'cpi', 'stability', 'approval'
 * @param {number} value - percent change or absolute value depending on metric
 * @returns {{ grade: string, label: string }}
 */
export const rateMetric = (metricKey, value) => {
    const v = safe(value);
    let thresholds;

    if (metricKey === 'cpi' || metricKey === 'ppi') {
        thresholds = RATING_THRESHOLDS.inflation;
        for (const t of thresholds) {
            if (v >= t.min && v < t.max) return { grade: t.grade, label: t.label };
        }
        return { grade: 'C', label: '未知' };
    }

    if (metricKey === 'stability') {
        thresholds = RATING_THRESHOLDS.stability;
        for (const t of thresholds) {
            if (v >= t.min) return { grade: t.grade, label: t.label };
        }
        return { grade: 'F', label: '濒临崩溃' };
    }

    // Default: positive growth metrics
    thresholds = RATING_THRESHOLDS.positive;
    for (const t of thresholds) {
        if (v >= t.min) return { grade: t.grade, label: t.label };
    }
    return { grade: 'F', label: '危机' };
};

// ============================================================
// 4. computeOverallScore
// ============================================================
const GRADE_SCORES = { S: 100, A: 85, B: 70, C: 55, D: 35, F: 15 };

const METRIC_WEIGHTS = {
    gdp: 0.20,
    silver: 0.10,
    population: 0.15,
    stability: 0.20,
    buildings: 0.10,
    military: 0.10,
    cpi: 0.10,
    approval: 0.05,
};

/**
 * Compute overall annual score.
 * @param {Object} changes - from computeYoYChanges
 * @param {Object} currentSnapshot - current snapshot for absolute values
 * @returns {{ score: number, grade: string, summary: string, ratings: Object }}
 */
export const computeOverallScore = (changes, currentSnapshot) => {
    if (!changes || changes.isFirstYear) {
        // First year: compute score from absolute values instead of hardcoding 50
        const stabilityRating = rateMetric('stability', safe(currentSnapshot?.stability, 50));
        const pop = safe(currentSnapshot?.population);
        const silver = safe(currentSnapshot?.silver);
        const techs = safe(currentSnapshot?.techsUnlocked);
        const bld = safe(currentSnapshot?.totalBuildings);
        const stab = safe(currentSnapshot?.stability, 50);

        // Weighted absolute assessment
        let firstYearScore = 0;
        // Stability: 0-100 -> 0-30 pts
        firstYearScore += Math.min(stab, 100) * 0.3;
        // Population: scale logarithmically (1K=10, 10K=20, 100K=30)
        firstYearScore += Math.min(pop > 0 ? Math.log10(pop) * 7.5 : 0, 30);
        // Silver: scale logarithmically (100=5, 1K=10, 10K=15)
        firstYearScore += Math.min(silver > 0 ? Math.log10(silver) * 5 : 0, 20);
        // Techs: 0-10 pts
        firstYearScore += Math.min(techs * 0.5, 10);
        // Buildings: 0-10 pts
        firstYearScore += Math.min(bld * 0.1, 10);

        firstYearScore = Math.round(Math.min(firstYearScore, 100));

        let firstYearGrade;
        if (firstYearScore >= 90) firstYearGrade = 'S';
        else if (firstYearScore >= 75) firstYearGrade = 'A';
        else if (firstYearScore >= 60) firstYearGrade = 'B';
        else if (firstYearScore >= 45) firstYearGrade = 'C';
        else if (firstYearScore >= 30) firstYearGrade = 'D';
        else firstYearGrade = 'F';

        const FIRST_YEAR_SUMMARIES = {
            S: '国力鼎盛，根基深厚',
            A: '家底殷实，前景可期',
            B: '基业初成，稳步前行',
            C: '开国之年，百废待兴',
            D: '筚路蓝缕，任重道远',
            F: '白手起家，艰辛创业',
        };

        return {
            score: firstYearScore,
            grade: firstYearGrade,
            summary: FIRST_YEAR_SUMMARIES[firstYearGrade],
            ratings: { stability: stabilityRating },
        };
    }

    const ratings = {};

    // Economy ratings
    ratings.gdp = rateMetric('gdp', changes.economy?.gdp?.percent || 0);
    ratings.silver = rateMetric('silver', changes.economy?.silver?.percent || 0);
    ratings.cpi = rateMetric('cpi', changes.economy?.cpi?.percent || 0);

    // Population
    ratings.population = rateMetric('population', changes.population?.total?.percent || 0);

    // Social
    ratings.stability = rateMetric('stability', currentSnapshot?.stability || 50);

    // Average approval
    const approvalValues = Object.values(changes.social?.approval || {});
    const avgApproval = approvalValues.length > 0
        ? approvalValues.reduce((sum, a) => sum + safe(a.current), 0) / approvalValues.length
        : 50;
    ratings.approval = rateMetric('stability', avgApproval); // reuse stability scale

    // Industry
    ratings.buildings = rateMetric('buildings', changes.industry?.total?.percent || 0);

    // Military
    ratings.military = rateMetric('military', changes.military?.armyPopulation?.percent || 0);

    // Weighted score
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [key, weight] of Object.entries(METRIC_WEIGHTS)) {
        if (ratings[key]) {
            weightedSum += GRADE_SCORES[ratings[key].grade] * weight;
            totalWeight += weight;
        }
    }
    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Overall grade
    let grade;
    if (score >= 90) grade = 'S';
    else if (score >= 75) grade = 'A';
    else if (score >= 60) grade = 'B';
    else if (score >= 45) grade = 'C';
    else if (score >= 30) grade = 'D';
    else grade = 'F';

    // Summary text
    const SUMMARIES = {
        S: '繁荣盛世，国泰民安',
        A: '欣欣向荣，前途光明',
        B: '稳中有进，任重道远',
        C: '波澜不惊，尚待发展',
        D: '多事之秋，亟待改善',
        F: '内忧外患，国运堪忧',
    };

    return { score, grade, summary: SUMMARIES[grade], ratings };
};

// ============================================================
// 5. generateSectionCommentary
// ============================================================
/**
 * Generate a natural language commentary for each report section.
 * @param {string} section - section key
 * @param {Object} changes - from computeYoYChanges
 * @param {Object} current - current snapshot
 * @returns {string} commentary text
 */
export const generateSectionCommentary = (section, changes, current) => {
    if (!changes || changes.isFirstYear) {
        // First year: generate data-driven commentary using absolute values
        const pop = safe(current?.population);
        const silver = safe(current?.silver);
        const stab = safe(current?.stability, 50);
        const techs = safe(current?.techsUnlocked);
        const bld = safe(current?.totalBuildings);
        const corps = safe(current?.corpsCount);
        const army = safe(current?.armyPopulation);

        const commentaries = {
            economy: silver > 10000
                ? `国库储银 ${fmtNum(silver)}，财力雄厚。`
                : silver > 1000
                    ? `国库存银 ${fmtNum(silver)}，尚可维持。`
                    : `国库仅有 ${fmtNum(silver)} 银币，财政紧张。`,
            population: pop > 100000
                ? `治下人口 ${fmtNum(pop)}，人丁兴旺。`
                : pop > 10000
                    ? `治下人口 ${fmtNum(pop)}，规模适中。`
                    : `治下人口 ${fmtNum(pop)}，尚待发展。`,
            industry: bld > 50
                ? `已建成 ${bld} 座建筑，产业体系初具规模。`
                : `拥有 ${bld} 座建筑，基础设施建设方兴未艾。`,
            military: army > 0
                ? `拥兵 ${fmtNum(army)} 人、${corps} 个军团，保境安民。`
                : '尚无常备军力，亟需整军备武。',
            resources: '首年国情概览，资源储备初步建立。',
            tech: techs > 0
                ? `已掌握 ${techs} 项科技，文明根基初现。`
                : '科技发展蓄势待发。',
            social: stab >= 70
                ? `稳定度 ${stab.toFixed(0)}，社会安定祥和。`
                : stab >= 40
                    ? `稳定度 ${stab.toFixed(0)}，社会基本稳定。`
                    : `稳定度仅 ${stab.toFixed(0)}，民心动荡不安。`,
        };
        return commentaries[section] || '';
    }

    switch (section) {
        case 'economy': {
            const gdpPct = safe(changes.economy?.gdp?.percent);
            const silverDelta = safe(changes.economy?.silver?.delta);
            if (gdpPct > 20) return `经济蓬勃发展，GDP 增长 ${gdpPct.toFixed(1)}%，国库${silverDelta >= 0 ? '充盈' : '承压'}。`;
            if (gdpPct > 5) return `经济稳步增长，GDP 增长 ${gdpPct.toFixed(1)}%。`;
            if (gdpPct > -5) return `经济基本持平，GDP 变化 ${gdpPct.toFixed(1)}%。`;
            return `经济出现衰退，GDP 下降 ${Math.abs(gdpPct).toFixed(1)}%，需引起重视。`;
        }
        case 'population': {
            const popPct = safe(changes.population?.total?.percent);
            if (popPct > 10) return `人口快速增长 ${popPct.toFixed(1)}%，劳动力充足。`;
            if (popPct > 0) return `人口温和增长 ${popPct.toFixed(1)}%。`;
            if (popPct === 0) return '人口总量保持稳定。';
            return `人口减少 ${Math.abs(popPct).toFixed(1)}%，需关注民生。`;
        }
        case 'industry': {
            const bldDelta = safe(changes.industry?.total?.delta);
            const upgDelta = safe(changes.industry?.upgrades?.delta);
            const upgNote = upgDelta > 0 ? `升级建筑 ${upgDelta} 座。` : '';
            if (bldDelta > 5) return `产业蓬勃发展，新增 ${bldDelta} 座建筑。${upgNote}`;
            if (bldDelta > 0) return `产业小幅扩张，新增 ${bldDelta} 座建筑。${upgNote}`;
            if (bldDelta === 0) return `产业规模维持不变。${upgNote}`;
            return `产业萎缩，减少 ${Math.abs(bldDelta)} 座建筑。${upgNote}`;
        }
        case 'military': {
            const milPct = safe(changes.military?.armyPopulation?.percent);
            const corps = safe(current?.corpsCount);
            const milExpense = safe(current?.dailyMilitaryExpense);
            const expenseNote = milExpense > 0 ? `日均军费 ${fmtNum(milExpense)} 银币。` : '';
            const corpsNote = corps > 0 ? `，编有 ${corps} 个军团` : '';
            if (milPct > 20) return `军力大幅扩充 ${milPct.toFixed(1)}%${corpsNote}。${expenseNote}`;
            if (milPct > 0) return `军力稳步增长${corpsNote}。${expenseNote}`;
            if (milPct === 0) return `军力保持稳定${corpsNote}。${expenseNote}`;
            return `军力有所削减${corpsNote}。${expenseNote}`;
        }
        case 'resources': {
            const resChanges = changes.resources || {};
            const sorted = Object.entries(resChanges)
                .filter(([, v]) => v.delta !== 0)
                .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta));
            if (sorted.length === 0) return '资源储备基本稳定。';
            const top = sorted.slice(0, 3).map(([k, v]) => {
                const resName = RESOURCES?.[k]?.name || k;
                return `${resName} ${v.delta > 0 ? '+' : ''}${v.delta.toFixed(0)}`;
            }).join('，');
            return `主要资源变动：${top}。`;
        }
        case 'tech': {
            const techDelta = safe(changes.tech?.techsUnlocked?.delta);
            const epochChanged = safe(changes.tech?.epoch?.delta) > 0;
            const recentNames = (current?.recentTechs || []).slice(-techDelta > 0 ? -techDelta : 0)
                .map(t => t.name).slice(0, 3);
            const techList = recentNames.length > 0 ? `包括「${recentNames.join('」「')}」${techDelta > 3 ? '等' : ''}。` : '';
            if (epochChanged) return `迈入新时代！本年度研发 ${techDelta} 项新科技。${techList}`;
            if (techDelta > 3) return `科技蓬勃发展，研发 ${techDelta} 项新科技。${techList}`;
            if (techDelta > 0) return `科技稳步推进，研发 ${techDelta} 项新科技。${techList}`;
            return '本年度无新科技突破。';
        }
        case 'social': {
            const stab = safe(current?.stability, 50);
            const stabDelta = safe(changes.social?.stability?.delta);
            // Find the most dissatisfied class
            const approvalEntries = Object.entries(changes.social?.approval || {});
            const worstClass = approvalEntries.sort((a, b) => safe(a[1].current) - safe(b[1].current))[0];
            const worstNote = worstClass
                ? `${STRATA[worstClass[0]]?.name || worstClass[0]}满意度最低（${safe(worstClass[1].current).toFixed(0)}）。`
                : '';
            if (stab >= 70 && stabDelta >= 0) return `社会安定繁荣，稳定度 ${stab.toFixed(0)}。${worstNote}`;
            if (stab >= 50) return `社会基本稳定（${stab.toFixed(0)}），局部问题有待关注。${worstNote}`;
            if (stab >= 30) return `社会矛盾加剧（${stab.toFixed(0)}），民怨上升。${worstNote}`;
            return `社会动荡不安（${stab.toFixed(0)}），多阶层不满情绪高涨。${worstNote}`;
        }
        default:
            return '';
    }
};

// ============================================================
// 6. generateExportText
// ============================================================
const CATEGORY_NAMES = { gather: '采集', industry: '工业', civic: '民政', military: '军事' };

/**
 * Generate a formatted plain text export of the annual report.
 * @param {Object} reportData - { changes, current, scoring }
 * @param {string} empireName
 * @param {number} year
 * @param {number} epochIndex
 * @returns {string}
 */
export const generateExportText = (reportData, empireName, year, epochIndex) => {
    const { changes, current, scoring } = reportData;
    const epochName = EPOCHS?.[epochIndex]?.name || `时代 ${epochIndex + 1}`;

    const lines = [];
    lines.push('═'.repeat(40));
    lines.push(`📜 ${empireName || '我的文明'} · 第 ${year} 年年度政府工作报告`);
    lines.push(`🏛️ ${epochName}`);
    lines.push('═'.repeat(40));
    lines.push('');

    // Overall score
    lines.push(`🏆 综合评定: ${scoring.grade}级 (${scoring.score}分)`);
    lines.push(`📝 ${scoring.summary}`);
    lines.push('─'.repeat(40));

    if (changes?.isFirstYear) {
        lines.push('');
        lines.push('📊 【经济概况】');
        lines.push(`  💰 国库: ${fmtNum(current.silver)} 银币`);
        lines.push(`  📈 GDP: ${fmtNum(current.gdp)}`);
        lines.push(`  💵 日均税收: ${fmtNum(current.totalTax)}`);

        lines.push('');
        lines.push('👥 【人口与民生】');
        lines.push(`  人口总量: ${fmtNum(current.population)}`);
        const firstPopStruct = current.popStructure || {};
        for (const [cls, count] of Object.entries(firstPopStruct)) {
            if (count > 0) {
                const clsName = STRATA[cls]?.name || cls;
                lines.push(`    ${clsName}: ${fmtNum(count)}`);
            }
        }

        lines.push('');
        lines.push('🏗️ 【产业发展】');
        lines.push(`  建筑总数: ${current.totalBuildings} 座`);
        for (const [cat, name] of Object.entries(CATEGORY_NAMES)) {
            const cur = current.buildingsByCategory?.[cat] || 0;
            if (cur > 0) lines.push(`    ${name}: ${cur}`);
        }

        lines.push('');
        lines.push('⚔️ 【军事力量】');
        lines.push(`  军力: ${fmtNum(current.armyPopulation)} 人 | ${current.corpsCount} 军团`);
        if (current.dailyMilitaryExpense > 0) lines.push(`  日均军费: ${fmtNum(current.dailyMilitaryExpense)} 银币`);
        const firstArmyComp = current.armyComposition || {};
        if (Object.keys(firstArmyComp).length > 0) {
            const ARMY_CAT_NAMES = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', siege: '攻城', gunpowder: '火器' };
            for (const [cat, data] of Object.entries(firstArmyComp)) {
                lines.push(`    ${ARMY_CAT_NAMES[cat] || cat}: ${fmtNum(data.population)} 人`);
            }
        }

        lines.push('');
        lines.push('📦 【资源储备】');
        const firstResEntries = Object.entries(current.resources || {})
            .filter(([, v]) => safe(v) > 0)
            .sort((a, b) => safe(b[1]) - safe(a[1]))
            .slice(0, 5);
        for (const [key, val] of firstResEntries) {
            const resName = RESOURCES?.[key]?.name || key;
            lines.push(`    ${resName}: ${fmtNum(safe(val))}`);
        }

        lines.push('');
        lines.push('🔬 【科技文化】');
        lines.push(`  已解锁科技: ${current.techsUnlocked} 项`);
        lines.push(`  当前时代: ${epochName}`);
        if (current.recentTechs?.length > 0) {
            lines.push(`  最近研发: ${current.recentTechs.map(t => t.name).join('、')}`);
        }

        lines.push('');
        lines.push('⚖️ 【社会稳定】');
        lines.push(`  稳定度: ${current.stability.toFixed(1)}`);
        const firstApproval = current.classApproval || {};
        for (const [cls, val] of Object.entries(firstApproval)) {
            const clsName = STRATA[cls]?.name || cls;
            lines.push(`    ${clsName} 满意度: ${safe(val).toFixed(1)}`);
        }
    } else {
        // Economy
        lines.push('');
        lines.push(`📊 【经济概况】${generateSectionCommentary('economy', changes, current)}`);
        lines.push(`  💰 国库: ${fmtNum(current.silver)}  ${fmtDelta(changes.economy?.silver?.delta, changes.economy?.silver?.percent)}`);
        lines.push(`  📈 GDP: ${fmtNum(current.gdp)}  ${fmtDelta(changes.economy?.gdp?.delta, changes.economy?.gdp?.percent)}`);
        lines.push(`  📊 CPI: ${fmtNum(current.cpi)}  ${fmtDelta(changes.economy?.cpi?.delta, changes.economy?.cpi?.percent)}`);
        lines.push(`  🏭 PPI: ${fmtNum(current.ppi)}  ${fmtDelta(changes.economy?.ppi?.delta, changes.economy?.ppi?.percent)}`);

        // Population
        lines.push('');
        lines.push(`👥 【人口与民生】${generateSectionCommentary('population', changes, current)}`);
        lines.push(`  人口总量: ${fmtNum(current.population)}  ${fmtDelta(changes.population?.total?.delta, changes.population?.total?.percent)}`);
    const popStruct = current.popStructure || {};
        for (const [cls, count] of Object.entries(popStruct)) {
            if (count > 0) {
                const clsName = STRATA[cls]?.name || cls;
                const sDelta = changes.population?.structure?.[cls]?.delta;
                lines.push(`    ${clsName}: ${fmtNum(count)}${sDelta ? ` (${sDelta > 0 ? '+' : ''}${fmtNum(sDelta)})` : ''}`);
            }
        }

        // Industry
        lines.push('');
        lines.push(`🏗️ 【产业发展】${generateSectionCommentary('industry', changes, current)}`);
        lines.push(`  建筑总数: ${current.totalBuildings}  ${fmtDelta(changes.industry?.total?.delta)}`);
        for (const [cat, name] of Object.entries(CATEGORY_NAMES)) {
            const cur = current.buildingsByCategory?.[cat] || 0;
            const d = changes.industry?.categories?.[cat]?.delta || 0;
            lines.push(`    ${name}: ${cur}${d !== 0 ? ` (${d > 0 ? '+' : ''}${d})` : ''}`);
        }

        // Military
        lines.push('');
        lines.push(`⚔️ 【军事力量】${generateSectionCommentary('military', changes, current)}`);
        lines.push(`  总兵力: ${fmtNum(current.armyPopulation)}  ${fmtDelta(changes.military?.armyPopulation?.delta, changes.military?.armyPopulation?.percent)}`);
        lines.push(`  军团数: ${current.corpsCount}  ${fmtDelta(changes.military?.corpsCount?.delta)}`);
        if (current.dailyMilitaryExpense > 0) {
            lines.push(`  日均军费: ${fmtNum(current.dailyMilitaryExpense)}  ${fmtDelta(changes.military?.dailyMilitaryExpense?.delta)}`);
        }
        const armyComp = current.armyComposition || {};
        if (Object.keys(armyComp).length > 0) {
            const ARMY_CAT_NAMES = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', siege: '攻城', gunpowder: '火器' };
            for (const [cat, data] of Object.entries(armyComp)) {
                lines.push(`    ${ARMY_CAT_NAMES[cat] || cat}: ${fmtNum(data.population)} 人`);
            }
        }

        // Resources
        lines.push('');
        lines.push(`📦 【资源储备】${generateSectionCommentary('resources', changes, current)}`);
        const resSorted = Object.entries(changes.resources || {})
            .filter(([, v]) => v.delta !== 0)
            .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
            .slice(0, 5);
        for (const [key, val] of resSorted) {
            const resName = RESOURCES?.[key]?.name || key;
            lines.push(`    ${resName}: ${fmtNum(val.current)}  ${fmtDelta(val.delta, val.percent)}`);
        }
        if (resSorted.length === 0) lines.push('    (无显著变动)');

        // Tech
        lines.push('');
        lines.push(`🔬 【科技文化】${generateSectionCommentary('tech', changes, current)}`);
        lines.push(`  已解锁科技: ${current.techsUnlocked}  ${fmtDelta(changes.tech?.techsUnlocked?.delta)}`);
        lines.push(`  当前时代: ${epochName}`);
        if (current.recentTechs?.length > 0 && safe(changes.tech?.techsUnlocked?.delta) > 0) {
            const newTechNames = current.recentTechs.slice(-safe(changes.tech?.techsUnlocked?.delta)).map(t => t.name);
            if (newTechNames.length > 0) lines.push(`  本年新科技: ${newTechNames.join('、')}`);
        }

        // Social
        lines.push('');
        lines.push(`⚖️ 【社会稳定】${generateSectionCommentary('social', changes, current)}`);
        lines.push(`  稳定度: ${current.stability.toFixed(1)}  ${fmtDelta(changes.social?.stability?.delta)}`);
        const approvalChanges = changes.social?.approval || {};
        for (const [cls, a] of Object.entries(approvalChanges)) {
            const clsName = STRATA[cls]?.name || cls;
            lines.push(`    ${clsName} 满意度: ${safe(a.current).toFixed(1)}  ${fmtDelta(a.delta)}`);
        }
    }

    lines.push('');
    lines.push('═'.repeat(40));
    lines.push(`📅 报告生成于第 ${year} 年年末`);
    lines.push('═'.repeat(40));

    return lines.join('\n');
};

/**
 * Build the full report data object from game state.
 * Convenience wrapper that calls all computation functions.
 * @param {Object} gameState - current game state
 * @param {Object|null} baseline - year-start baseline snapshot
 * @returns {Object} { current, changes, scoring, commentaries }
 */
export const buildAnnualReport = (gameState, baseline) => {
    const current = collectAnnualSnapshot(gameState);
    const changes = computeYoYChanges(current, baseline);
    const scoring = computeOverallScore(changes, current);

    const sections = ['economy', 'population', 'industry', 'military', 'resources', 'tech', 'social'];
    const commentaries = {};
    sections.forEach(s => {
        commentaries[s] = generateSectionCommentary(s, changes, current);
    });

    return { current, changes, scoring, commentaries };
};
