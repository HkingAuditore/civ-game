/**
 * 经济崩溃模型 - 数据提取脚本
 * 从 civ_analytics 数据库提取崩溃分析所需的全量数据
 * 输出: ai_reports/collapse_data.json
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, 'collapse_data.json');

async function main() {
    const conn = await mysql.createConnection({
        host: 'gz-cdb-bwmozb7l.sql.tencentcdb.com',
        port: 63818,
        user: 'civ_analytics',
        password: '59951308',
        database: 'civ_analytics',
        charset: 'utf8mb4'
    });

    const result = {};

    // ── 1. 崩溃玩家/会话清单 ──
    console.log('[1/6] 崩溃玩家清单...');
    const [crisisPlayers] = await conn.execute(`
        SELECT DISTINCT user_id, session_id FROM design_events
        WHERE event_id LIKE 'Economy:Crisis:%'
           OR event_id = 'Population:Starvation'
    `);
    result.crisisSessionIds = new Set(crisisPlayers.map(r => r.session_id));
    result.crisisUserIds = new Set(crisisPlayers.map(r => r.user_id));
    result.crisisSessions = crisisPlayers;

    // ── 2. 崩溃事件明细（去重：每个 session 每种 crisis 只取首次） ──
    console.log('[2/6] 崩溃事件明细...');
    const [crisisEvents] = await conn.execute(`
        SELECT session_id, user_id, event_id, event_value, created_at
        FROM design_events
        WHERE event_id LIKE 'Economy:Crisis:%'
           OR event_id = 'Population:Starvation'
        ORDER BY session_id, created_at
    `);
    // 去重：同一 session 同种危机只取首次
    const deduped = [];
    const seen = new Set();
    for (const row of crisisEvents) {
        const key = `${row.session_id}|${row.event_id}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(row);
        }
    }
    result.crisisEvents = deduped;

    // ── 3. 叛乱事件（同样去重） ──
    console.log('[3/6] 叛乱事件...');
    const [rebellionEvents] = await conn.execute(`
        SELECT session_id, user_id, event_id, event_value, created_at
        FROM design_events
        WHERE event_id LIKE 'Rebellion:%'
        ORDER BY session_id, created_at
    `);
    result.rebellionEvents = rebellionEvents;

    // 叛乱去重：同一 session 同种 event_id 只取首次
    const rebDeduped = [];
    const rebSeen = new Set();
    for (const row of rebellionEvents) {
        const key = `${row.session_id}|${row.event_id}`;
        if (!rebSeen.has(key)) {
            rebSeen.add(key);
            rebDeduped.push(row);
        }
    }
    result.rebellionEventsDeduped = rebDeduped;

    // ── 4. 经济指标时间序列（全量） ──
    console.log('[4/6] 经济指标时间序列...');
    const [econSeries] = await conn.execute(`
        SELECT session_id, user_id, event_id, event_value, created_at
        FROM design_events
        WHERE event_id IN ('Economy:CPI','Economy:GDP','Economy:Treasury',
                           'Stability:Level','Population:Total')
          AND event_value IS NOT NULL
          AND event_value >= 0
        ORDER BY session_id, created_at
    `);
    result.econSeries = econSeries;

    // ── 5. 全服指标分布统计（分位数） ──
    console.log('[5/6] 指标分布统计...');
    const metrics = ['Economy:CPI', 'Economy:GDP', 'Economy:Treasury', 'Population:Total', 'Stability:Level'];
    const distributions = {};

    for (const metric of metrics) {
        // 排除极端异常值
        let maxVal = 10000000;
        if (metric === 'Stability:Level') maxVal = 101;
        if (metric === 'Economy:CPI') maxVal = 2000;

        const [rows] = await conn.execute(`
            SELECT event_value FROM design_events
            WHERE event_id = ? AND event_value >= 0 AND event_value <= ?
            ORDER BY event_value
        `, [metric, maxVal]);

        const vals = rows.map(r => r.event_value);
        const n = vals.length;
        if (n === 0) continue;

        const pct = (p) => vals[Math.min(Math.floor(p * n), n - 1)];
        distributions[metric] = {
            count: n,
            min: +vals[0].toFixed(2),
            p10: +pct(0.1).toFixed(2),
            p25: +pct(0.25).toFixed(2),
            p50: +pct(0.5).toFixed(2),
            p75: +pct(0.75).toFixed(2),
            p90: +pct(0.9).toFixed(2),
            max: +vals[n - 1].toFixed(2),
            mean: +(vals.reduce((a, b) => a + b, 0) / n).toFixed(2),
            stddev: +Math.sqrt(vals.reduce((a, b) => a + (b - vals.reduce((s, v) => s + v, 0) / n) ** 2, 0) / n).toFixed(2)
        };
    }
    result.distributions = distributions;

    // ── 6. 稳定度关键变化 ──
    console.log('[6/6] 稳定度关键变化...');
    const [stabilityChanges] = await conn.execute(`
        SELECT session_id, user_id, event_id, event_value, created_at
        FROM design_events
        WHERE event_id LIKE 'Stability:LevelChange:%'
        ORDER BY session_id, created_at
    `);
    result.stabilityChanges = stabilityChanges;

    // ── 汇总统计 ──
    console.log('\n汇总:');
    console.log(`  崩溃会话: ${result.crisisSessionIds.size}`);
    console.log(`  崩溃玩家: ${result.crisisUserIds.size}`);
    console.log(`  去重危机事件: ${deduped.length}`);
    console.log(`  叛乱事件(去重): ${rebDeduped.length}`);
    console.log(`  经济指标采样: ${econSeries.length}`);
    console.log(`  稳定度变化: ${stabilityChanges.length}`);

    // 去掉 Set（JSON 不支持）
    delete result.crisisSessionIds;
    delete result.crisisUserIds;

    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 0));
    console.log(`\n已写入 ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`);

    await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
