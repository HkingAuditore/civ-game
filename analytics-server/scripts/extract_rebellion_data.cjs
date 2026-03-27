/**
 * 叛乱预警报告 - 分步数据提取 + 纯前端生成报告
 * 先把数据分步提取到 JSON，然后另一个脚本生成 HTML
 */
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: "gz-cdb-bwmozb7l.sql.tencentcdb.com",
  port: 63818,
  user: "civ_analytics",
  password: "59951308",
  database: "civ_analytics",
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

async function getConnection() {
  const conn = await mysql.createConnection(DB_CONFIG);
  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
  return conn;
}

async function safeQuery(sql, params = []) {
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(sql, params);
    await conn.end();
    return rows;
  } catch (e) {
    console.error(`SQL Error: ${e.message}`);
    try { await conn.end(); } catch (_) {}
    return [];
  }
}

async function main() {
  const data = {};

  // 1. 叛乱 session 列表
  console.log("1. 叛乱 session...");
  const rebSessions = await safeQuery(`
    SELECT session_id FROM design_events WHERE event_id LIKE 'Rebellion:%' GROUP BY session_id
  `);
  data.rebSessionCount = rebSessions.length;
  data.rebSessionIds = rebSessions.map(r => r.session_id);
  const rebSet = new Set(data.rebSessionIds);
  console.log(`  ✓ ${data.rebSessionCount} sessions`);

  // 2. 叛乱组指标（分指标查询，避免大 JOIN 超时）
  console.log("2. 叛乱组指标...");
  data.rebMetrics = {};
  const metrics = ['Stability:Level', 'Economy:CPI', 'Economy:PPI', 'Economy:GDP', 
                   'Economy:Treasury', 'Population:Total', 'Population:Starvation', 'Military:ArmySize'];
  const metricKeys = { 'Stability:Level': 'stability', 'Economy:CPI': 'cpi', 'Economy:PPI': 'ppi',
                       'Economy:GDP': 'gdp', 'Economy:Treasury': 'treasury', 
                       'Population:Total': 'population', 'Population:Starvation': 'starvation',
                       'Military:ArmySize': 'army_size' };

  for (const metric of metrics) {
    const key = metricKeys[metric];
    // 分批查询避免超时
    const all = [];
    for (let i = 0; i < data.rebSessionIds.length; i += 50) {
      const batch = data.rebSessionIds.slice(i, i + 50);
      const rows = await safeQuery(`
        SELECT d.session_id, d.event_value
        FROM design_events d
        WHERE d.session_id IN (${batch.map(() => '?').join(',')})
        AND d.event_id = ?
        AND d.created_at < (
          SELECT MIN(created_at) FROM design_events d2 
          WHERE d2.session_id = d.session_id AND d2.event_id LIKE 'Rebellion:%'
        )
        ORDER BY d.created_at DESC
      `, [...batch, metric]);
      all.push(...rows);
      if (i % 100 === 0) process.stdout.write('.');
    }
    
    // 取每个session的最后一个值（已按时间倒序）
    const sessionMap = {};
    for (const r of all) {
      if (!sessionMap[r.session_id]) sessionMap[r.session_id] = r.event_value;
    }
    data.rebMetrics[key] = sessionMap;
    console.log(`  ✓ ${key}: ${Object.keys(sessionMap).length} sessions`);
  }

  // 3. 控制 session 列表
  console.log("\n3. 控制 session...");
  const allSessionIds = await safeQuery(`SELECT DISTINCT session_id FROM design_events`);
  const ctrlIds = allSessionIds.map(s => s.session_id).filter(id => !rebSet.has(id));
  data.ctrlSessionCount = ctrlIds.length;
  data.ctrlSessionIds = ctrlIds;
  console.log(`  ✓ ${data.ctrlSessionCount} sessions`);

  // 4. 控制组指标（分批）
  console.log("4. 控制组指标...");
  data.ctrlMetrics = {};
  for (const metric of metrics) {
    const key = metricKeys[metric];
    const all = [];
    for (let i = 0; i < ctrlIds.length; i += 50) {
      const batch = ctrlIds.slice(i, i + 50);
      const rows = await safeQuery(`
        SELECT d.session_id, d.event_value
        FROM design_events d
        WHERE d.session_id IN (${batch.map(() => '?').join(',')})
        AND d.event_id = ?
        ORDER BY d.created_at DESC
      `, [...batch, metric]);
      all.push(...rows);
      if (i % 200 === 0) process.stdout.write('.');
    }
    const sessionMap = {};
    for (const r of all) {
      if (!sessionMap[r.session_id]) sessionMap[r.session_id] = r.event_value;
    }
    data.ctrlMetrics[key] = sessionMap;
    console.log(`  ✓ ${key}: ${Object.keys(sessionMap).length} sessions`);
  }

  // 5. 诉求计数
  console.log("\n5. 诉求计数...");
  data.demandCounts = {};
  for (let i = 0; i < allSessionIds.length; i += 100) {
    const batch = allSessionIds.slice(i, i + 100).map(s => s.session_id);
    const rows = await safeQuery(`
      SELECT 
        session_id,
        SUM(CASE WHEN event_id LIKE 'Demand:Fail:%' THEN 1 ELSE 0 END) AS demand_fails,
        SUM(CASE WHEN event_id LIKE 'Demand:Generate:%' THEN 1 ELSE 0 END) AS demand_total,
        SUM(CASE WHEN event_id LIKE 'Organization:%' THEN 1 ELSE 0 END) AS org_events
      FROM design_events
      WHERE session_id IN (${batch.map(() => '?').join(',')})
      GROUP BY session_id
    `, batch);
    rows.forEach(r => { data.demandCounts[r.session_id] = r; });
    process.stdout.write('.');
  }
  console.log(`  ✓ ${Object.keys(data.demandCounts).length} sessions`);

  // 6. 叛乱阶层分布
  console.log("\n6. 叛乱阶层...");
  data.strata = await safeQuery(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS stratum, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY stratum ORDER BY cnt DESC
  `);
  console.log(`  ✓ ${data.strata.length} strata`);

  // 7. 叛乱阶段分布
  console.log("7. 叛乱阶段...");
  data.phases = await safeQuery(`
    SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1) AS phase, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY phase
  `);
  console.log(`  ✓ ${data.phases.length} phases`);

  // 保存
  const outPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_data.json';
  fs.writeFileSync(outPath, JSON.stringify(data), 'utf-8');
  console.log(`\n✅ 数据已保存到 ${outPath}`);
}

main().catch(console.error);
