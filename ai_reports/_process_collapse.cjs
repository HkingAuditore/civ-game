/**
 * 经济崩溃模型 - 数据处理脚本
 * 从 collapse_data.json 计算崩溃前征兆、相关性、预警阈值
 * 输出: ai_reports/collapse_processed.json（轻量级，供报告使用）
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'collapse_data.json');
const OUTPUT = path.join(__dirname, 'collapse_processed.json');

console.log('加载数据...');
const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const result = {};

// ── 工具函数 ──
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}
function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        const a = x[i] - mx, b = y[i] - my;
        num += a * b; dx += a * a; dy += b * b;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// ── 1. 构建崩溃会话集合 ──
console.log('[1/5] 构建会话映射...');
const crisisSessions = new Set();
const crisisFirstEvent = {}; // session_id -> { type, created_at }
for (const ev of raw.crisisEvents) {
    crisisSessions.add(ev.session_id);
    if (!crisisFirstEvent[ev.session_id] || ev.created_at < crisisFirstEvent[ev.session_id].created_at) {
        crisisFirstEvent[ev.session_id] = {
            type: ev.event_id.includes('bankruptcy') ? 'bankruptcy' : 'hyperinflation',
            created_at: ev.created_at,
            value: ev.event_value
        };
    }
}
// 饥荒也标记
for (const ev of raw.crisisEvents) {
    if (ev.event_id === 'Population:Starvation') {
        crisisSessions.add(ev.session_id);
        if (!crisisFirstEvent[ev.session_id] || ev.created_at < crisisFirstEvent[ev.session_id].created_at) {
            crisisFirstEvent[ev.session_id] = { type: 'starvation', created_at: ev.created_at, value: ev.event_value };
        }
    }
}

// ── 2. 按 session 构建经济指标时间序列 ──
console.log('[2/5] 构建时间序列...');
const sessionSeries = {}; // session_id -> { CPI: [], GDP: [], Treasury: [], Stability: [], Population: [], timestamps: [] }
for (const row of raw.econSeries) {
    if (!sessionSeries[row.session_id]) {
        sessionSeries[row.session_id] = { CPI: [], GDP: [], Treasury: [], Stability: [], Population: [], timestamps: [] };
    }
    const s = sessionSeries[row.session_id];
    const metric = row.event_id.split(':')[1]; // CPI, GDP, Treasury, Level, Total
    if (metric === 'CPI') s.CPI.push(row.event_value);
    else if (metric === 'GDP') s.GDP.push(row.event_value);
    else if (metric === 'Treasury') s.Treasury.push(row.event_value);
    else if (metric === 'Level') s.Stability.push(row.event_value);
    else if (metric === 'Total') s.Population.push(row.event_value);

    // timestamps 用 created_at（不按 metric 去重，只保留第一个）
    if (s.timestamps.length < 2000 && !s.timestamps.find(t => t === row.created_at)) {
        s.timestamps.push(row.created_at);
    }
}
const allSessionIds = Object.keys(sessionSeries);
console.log(`  总会话: ${allSessionIds.length}, 崩溃会话: ${crisisSessions.size}`);

// ── 3. 崩溃前征兆提取 ──
console.log('[3/5] 提取崩溃前征兆...');
const WINDOW = 10; // 崩溃前 10 个采样点
const collapsePreData = []; // { sessionId, type, CPI[], GDP[], Treasury[], Stability[], Population[] }
const normalData = []; // 对照组

for (const sid of allSessionIds) {
    const s = sessionSeries[sid];
    if (!s || s.CPI.length < 3) continue;

    if (crisisSessions.has(sid) && crisisFirstEvent[sid]) {
        // 崩溃会话：取崩溃时间点之前的指标
        const crisisTime = new Date(crisisFirstEvent[sid].created_at).getTime();
        const preCPI = s.CPI.filter((_, i) => new Date(s.timestamps[i] || 0).getTime() < crisisTime).slice(-WINDOW);
        const preGDP = s.GDP.filter((_, i) => new Date(s.timestamps[i] || 0).getTime() < crisisTime).slice(-WINDOW);
        const preTreasury = s.Treasury.filter((_, i) => new Date(s.timestamps[i] || 0).getTime() < crisisTime).slice(-WINDOW);
        const preStability = s.Stability.filter((_, i) => new Date(s.timestamps[i] || 0).getTime() < crisisTime).slice(-WINDOW);
        const prePop = s.Population.filter((_, i) => new Date(s.timestamps[i] || 0).getTime() < crisisTime).slice(-WINDOW);

        if (preCPI.length >= 2) {
            collapsePreData.push({
                sessionId: sid,
                type: crisisFirstEvent[sid].type,
                CPI: preCPI, GDP: preGDP, Treasury: preTreasury, Stability: preStability, Population: prePop
            });
        }
    } else {
        // 正常会话：取同样窗口
        normalData.push({
            sessionId: sid,
            CPI: s.CPI.slice(-WINDOW),
            GDP: s.GDP.slice(-WINDOW),
            Treasury: s.Treasury.slice(-WINDOW),
            Stability: s.Stability.slice(-WINDOW),
            Population: s.Population.slice(-WINDOW)
        });
    }
}
console.log(`  崩溃前样本: ${collapsePreData.length}, 正常对照: ${normalData.length}`);

// ── 4. 聚合统计 ──
console.log('[4/5] 聚合统计...');

// 崩溃前各指标的最后值（即崩溃前夕）
function extractLastVals(dataArr) {
    return {
        CPI: dataArr.map(d => d.CPI.length ? d.CPI[d.CPI.length - 1] : null).filter(v => v != null && v > 0 && v < 2000),
        GDP: dataArr.map(d => d.GDP.length ? d.GDP[d.GDP.length - 1] : null).filter(v => v != null && v > 0),
        Treasury: dataArr.map(d => d.Treasury.length ? d.Treasury[d.Treasury.length - 1] : null).filter(v => v != null),
        Stability: dataArr.map(d => d.Stability.length ? d.Stability[d.Stability.length - 1] : null).filter(v => v != null),
        Population: dataArr.map(d => d.Population.length ? d.Population[d.Population.length - 1] : null).filter(v => v != null && v > 0)
    };
}

function computeStats(arr) {
    if (!arr.length) return { count: 0, mean: 0, median: 0, stddev: 0, p10: 0, p25: 0, p75: 0, p90: 0 };
    const s = [...arr].sort((a, b) => a - b);
    return {
        count: arr.length,
        mean: +mean(arr).toFixed(2),
        median: +median(arr).toFixed(2),
        stddev: +stddev(arr).toFixed(2),
        p10: +s[Math.floor(s.length * 0.1)].toFixed(2),
        p25: +s[Math.floor(s.length * 0.25)].toFixed(2),
        p75: +s[Math.floor(s.length * 0.75)].toFixed(2),
        p90: +s[Math.floor(s.length * 0.9)].toFixed(2)
    };
}

const collapseLastVals = extractLastVals(collapsePreData);
const normalLastVals = extractLastVals(normalData);

result.collapsePreStats = {};
result.normalStats = {};
for (const key of ['CPI', 'GDP', 'Treasury', 'Stability', 'Population']) {
    result.collapsePreStats[key] = computeStats(collapseLastVals[key]);
    result.normalStats[key] = computeStats(normalLastVals[key]);
}

// ── 5. 崩溃前轨迹（按采样点聚合） ──
console.log('[5/5] 崩溃前轨迹聚合...');

// 按崩溃类型分组
const byType = {};
for (const d of collapsePreData) {
    if (!byType[d.type]) byType[d.type] = [];
    byType[d.type].push(d);
}

// 每个类型在每个采样点的均值
result.preTrajectory = {};
const metrics = ['CPI', 'GDP', 'Treasury', 'Stability', 'Population'];
for (const [type, dataArr] of Object.entries(byType)) {
    result.preTrajectory[type] = {};
    for (const m of metrics) {
        const maxLen = Math.max(...dataArr.map(d => d[m].length), 0);
        const trajectory = [];
        for (let i = 0; i < maxLen; i++) {
            const vals = dataArr.map(d => d[m][i]).filter(v => v != null && v > 0 && v < 1e7);
            trajectory.push(vals.length ? +mean(vals).toFixed(2) : null);
        }
        result.preTrajectory[type][m] = trajectory;
    }
}

// 正常对照组轨迹
result.normalTrajectory = {};
for (const m of metrics) {
    const maxLen = Math.max(...normalData.map(d => d[m].length), 0);
    const trajectory = [];
    for (let i = 0; i < maxLen; i++) {
        const vals = normalData.map(d => d[m][i]).filter(v => v != null && v > 0 && v < 1e7);
        trajectory.push(vals.length ? +mean(vals).toFixed(2) : null);
    }
    result.normalTrajectory[m] = trajectory;
}

// ── 6. 相关性矩阵 ──
console.log('[6/6] 相关性矩阵...');
const corrMetrics = ['CPI', 'GDP', 'Treasury', 'Stability', 'Population'];
result.correlationMatrix = {};

// 对崩溃会话做相关性
const collapseCorrData = {};
for (const m of corrMetrics) {
    collapseCorrData[m] = collapsePreData.map(d => d.CPI.length ? d[m][d[m].length - 1] : null).filter(v => v != null);
}

result.correlationMatrix.collapse = {};
for (const m1 of corrMetrics) {
    result.correlationMatrix.collapse[m1] = {};
    for (const m2 of corrMetrics) {
        const pairs = collapsePreData.map(d => {
            const v1 = d[m1].length ? d[m1][d[m1].length - 1] : null;
            const v2 = d[m2].length ? d[m2][d[m2].length - 1] : null;
            return (v1 != null && v2 != null) ? [v1, v2] : null;
        }).filter(Boolean);
        if (pairs.length >= 5) {
            result.correlationMatrix.collapse[m1][m2] = +pearson(pairs.map(p => p[0]), pairs.map(p => p[1])).toFixed(3);
        } else {
            result.correlationMatrix.collapse[m1][m2] = 0;
        }
    }
}

// 对正常会话做相关性
result.correlationMatrix.normal = {};
for (const m1 of corrMetrics) {
    result.correlationMatrix.normal[m1] = {};
    for (const m2 of corrMetrics) {
        const pairs = normalData.map(d => {
            const v1 = d[m1].length ? d[m1][d[m1].length - 1] : null;
            const v2 = d[m2].length ? d[m2][d[m2].length - 1] : null;
            return (v1 != null && v2 != null) ? [v1, v2] : null;
        }).filter(Boolean);
        if (pairs.length >= 5) {
            result.correlationMatrix.normal[m1][m2] = +pearson(pairs.map(p => p[0]), pairs.map(p => p[1])).toFixed(3);
        } else {
            result.correlationMatrix.normal[m1][m2] = 0;
        }
    }
}

// ── 7. CPI 增速分析 ──
console.log('[7/7] CPI 增速分析...');
result.cpiGrowth = { collapse: [], normal: [] };

for (const d of collapsePreData) {
    if (d.CPI.length >= 2) {
        const last = d.CPI[d.CPI.length - 1];
        const prev = d.CPI[d.CPI.length - 2];
        if (prev > 0) result.cpiGrowth.collapse.push(+((last - prev) / prev * 100).toFixed(1));
    }
}

for (const d of normalData) {
    if (d.CPI.length >= 2) {
        const last = d.CPI[d.CPI.length - 1];
        const prev = d.CPI[d.CPI.length - 2];
        if (prev > 0) result.cpiGrowth.normal.push(+((last - prev) / prev * 100).toFixed(1));
    }
}

// ── 8. 典型案例选取 ──
console.log('[8/8] 选取典型案例...');
// 选 5 个有代表性的崩溃案例（数据点多的）
const candidates = collapsePreData
    .filter(d => d.CPI.length >= 5)
    .sort((a, b) => (b.CPI.length + b.GDP.length) - (a.CPI.length + a.GDP.length));

result.caseStudies = candidates.slice(0, 5).map(d => {
    // 找到这个 session 的完整时间序列
    const full = sessionSeries[d.sessionId];
    return {
        sessionId: d.sessionId,
        type: d.type,
        seriesLength: d.CPI.length,
        CPI: full ? full.CPI.slice(0, 30) : d.CPI,
        GDP: full ? full.GDP.slice(0, 30) : d.GDP,
        Treasury: full ? full.Treasury.slice(0, 30) : d.Treasury,
        Stability: full ? full.Stability.slice(0, 30) : d.Stability,
        Population: full ? full.Population.slice(0, 30) : d.Population
    };
});

// ── 9. 崩溃事件统计 ──
result.crisisSummary = {
    totalCrisisPlayers: raw.crisisSessions.length,
    uniquePlayers: [...new Set(raw.crisisSessions.map(r => r.user_id))].length,
    uniqueSessions: [...new Set(raw.crisisSessions.map(r => r.session_id))].length,
    byType: {}
};

// 统计每种危机类型
for (const ev of raw.crisisEvents) {
    const type = ev.event_id.includes('bankruptcy') ? 'bankruptcy' :
                 ev.event_id.includes('hyperinflation') ? 'hyperinflation' : 'starvation';
    if (!result.crisisSummary.byType[type]) result.crisisSummary.byType[type] = 0;
    result.crisisSummary.byType[type]++;
}

// 叛乱统计
result.rebellionSummary = {
    totalDeduped: raw.rebellionEventsDeduped.length,
    byPhase: {},
    byStratum: {}
};
for (const ev of raw.rebellionEventsDeduped) {
    const parts = ev.event_id.split(':');
    const phase = parts[1]; // brewing, plotting, uprising
    const stratum = parts[2]; // lumberjack, miner, peasant, etc.
    result.rebellionSummary.byPhase[phase] = (result.rebellionSummary.byPhase[phase] || 0) + 1;
    result.rebellionSummary.byStratum[stratum] = (result.rebellionSummary.byStratum[stratum] || 0) + 1;
}

// ── 10. 全服分布 ──
result.distributions = raw.distributions;

// ── 保存 ──
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
console.log(`\n已写入 ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB)`);
