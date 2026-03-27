/**
 * 叛乱预测模型 - 完整特征数据集构建（拆分为小查询避免超时）
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

async function query(conn, sql, params = []) {
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } catch (e) {
    console.error("SQL Error:", e.message);
    return [];
  }
}

async function main() {
  let conn;
  async function getConnection() {
    if (!conn) conn = await mysql.createConnection(DB_CONFIG);
    await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    return conn;
  }

  // Step 1: 获取所有有叛乱的 session 及其第一次叛乱时间
  console.log("Step 1: 获取叛乱session列表...");
  conn = await getConnection();
  const rebellionSessions = await query(conn, `
    SELECT session_id, MIN(created_at) AS first_rebellion_at
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:%'
    GROUP BY session_id
  `);
  console.log(`  叛乱 session 数: ${rebellionSessions.length}`);

  // Step 2: 获取所有 session 列表
  console.log("Step 2: 获取所有 session...");
  const allSessions = await query(conn, `
    SELECT DISTINCT session_id FROM design_events
  `);
  console.log(`  总 session 数: ${allSessions.length}`);

  const rebSet = new Set(rebellionSessions.map(r => r.session_id));
  const rebTimeMap = {};
  rebellionSessions.forEach(r => { rebTimeMap[r.session_id] = r.first_rebellion_at; });

  // Step 3: 获取叛乱前的采样指标（每个session的最后一个采样点）
  console.log("Step 3: 获取叛乱前采样指标...");
  const rebPreMetrics = await query(conn, `
    SELECT 
      d.session_id,
      d.event_id,
      d.event_value,
      ROW_NUMBER() OVER (PARTITION BY d.session_id, d.event_id ORDER BY d.created_at DESC) AS rn
    FROM design_events d
    WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                          'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI',
                          'EconFlow:Tax', 'EconFlow:Trade', 'EconFlow:Military', 'EconFlow:Building', 'EconFlow:Official')
    AND d.session_id IN (${rebellionSessions.map(() => '?').join(',')})
  `, rebellionSessions.map(r => r.session_id));
  console.log(`  叛乱前采样记录数: ${rebPreMetrics.length}`);

  // Step 4: 获取控制组的采样指标
  const ctrlSessions = allSessions.filter(s => !rebSet.has(s.session_id)).map(s => s.session_id);
  console.log("Step 4: 获取控制组采样指标...");
  console.log(`  控制 session 数: ${ctrlSessions.length}`);

  // 分批查询控制组（避免IN子句太大）
  const ctrlPreMetrics = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < ctrlSessions.length; i += BATCH_SIZE) {
    const batch = ctrlSessions.slice(i, i + BATCH_SIZE);
    conn = await getConnection(); // 重连防止超时
    const rows = await query(conn, `
      SELECT 
        d.session_id,
        d.event_id,
        d.event_value,
        ROW_NUMBER() OVER (PARTITION BY d.session_id, d.event_id ORDER BY d.created_at DESC) AS rn
      FROM design_events d
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI',
                            'EconFlow:Tax', 'EconFlow:Trade', 'EconFlow:Military', 'EconFlow:Building', 'EconFlow:Official')
      AND d.session_id IN (${batch.map(() => '?').join(',')})
    `, batch);
    ctrlPreMetrics.push(...rows);
    console.log(`  批次 ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(ctrlSessions.length/BATCH_SIZE)}: ${rows.length} 条`);
  }

  // Step 5: 获取诉求和组织度计数
  console.log("Step 5: 获取诉求和组织度...");
  conn = await getConnection();
  const demandCounts = await query(conn, `
    SELECT 
      session_id,
      SUM(CASE WHEN event_id LIKE 'Demand:Fail:%' THEN 1 ELSE 0 END) AS demand_fails,
      SUM(CASE WHEN event_id LIKE 'Demand:Generate:%' THEN 1 ELSE 0 END) AS demand_total,
      SUM(CASE WHEN event_id LIKE 'Demand:Complete:%' THEN 1 ELSE 0 END) AS demand_completes,
      SUM(CASE WHEN event_id LIKE 'Organization:%' THEN 1 ELSE 0 END) AS org_events,
      MAX(CASE WHEN event_id LIKE 'Organization:%' THEN event_value END) AS max_org,
      AVG(CASE WHEN event_id LIKE 'Organization:%' THEN event_value END) AS avg_org
    FROM design_events
    GROUP BY session_id
  `);
  console.log(`  诉求计数 session 数: ${demandCounts.length}`);

  // Step 6: 获取 difficulty 信息
  console.log("Step 6: 获取难度信息...");
  conn = await getConnection();
  const difficulties = await query(conn, `
    SELECT session_id, difficulty FROM sessions WHERE difficulty IS NOT NULL
  `);
  console.log(`  有难度信息的 session 数: ${difficulties.length}`);

  await conn.end();

  // ===== 在内存中组装特征数据集 =====
  console.log("\n=== 组装特征数据集 ===");
  
  const METRICS = ['Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                   'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI',
                   'EconFlow:Tax', 'EconFlow:Trade', 'EconFlow:Military', 'EconFlow:Building', 'EconFlow:Official'];

  function buildFeatures(sessionId, metricsRows, isRebellion) {
    const feature = { session_id: sessionId, label: isRebellion ? 1 : 0 };
    
    for (const m of METRICS) {
      const shortName = m.replace(/:/g, '_').replace('Economy_', 'eco_').replace('Population_', 'pop_').replace('Military_', 'mil_').replace('Stability_', 'stab_');
      const matches = metricsRows.filter(r => r.session_id === sessionId && r.event_id === m && r.rn === 1);
      feature[shortName] = matches.length > 0 ? matches[0].event_value : null;
    }

    // 诉求和组织度
    const dc = demandCounts.find(d => d.session_id === sessionId);
    feature.demand_fails = dc ? (dc.demand_fails || 0) : 0;
    feature.demand_total = dc ? (dc.demand_total || 0) : 0;
    feature.demand_completes = dc ? (dc.demand_completes || 0) : 0;
    feature.org_events = dc ? (dc.org_events || 0) : 0;
    feature.max_org = dc ? dc.max_org : null;
    feature.avg_org = dc ? dc.avg_org : null;

    // 难度
    const diff = difficulties.find(d => d.session_id === sessionId);
    feature.difficulty = diff ? diff.difficulty : 'unknown';

    return feature;
  }

  const features = [];
  
  // 叛乱组
  for (const sid of rebellionSessions.map(r => r.session_id)) {
    features.push(buildFeatures(sid, rebPreMetrics, true));
  }
  
  // 控制组
  for (const sid of ctrlSessions) {
    features.push(buildFeatures(sid, ctrlPreMetrics, false));
  }

  console.log(`总特征行数: ${features.length}`);
  console.log(`叛乱组: ${features.filter(f => f.label === 1).length}`);
  console.log(`控制组: ${features.filter(f => f.label === 0).length}`);
  console.log(`有稳定度的: ${features.filter(f => f.stab_Level !== null).length}`);

  // 保存 CSV
  const headers = Object.keys(features[0]);
  const csv = [headers.join(','), ...features.map(row => 
    headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v);
    }).join(',')
  ).join('\n')];

  const csvPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_dataset.csv';
  fs.writeFileSync(csvPath, csv.join('\n'));
  console.log(`\n✅ 数据集已保存到 ${csvPath}`);

  // ===== 汇总统计 =====
  const rebData = features.filter(f => f.label === 1 && f.stab_Level !== null);
  const ctrlData = features.filter(f => f.label === 0 && f.stab_Level !== null);

  function stat(arr, field) {
    const vals = arr.map(r => r[field]).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (vals.length === 0) return { n: 0, avg: 0, min: 0, max: 0, median: 0, pct_above_threshold: 0 };
    vals.sort((a, b) => a - b);
    return {
      n: vals.length,
      avg: (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2),
      min: Number(vals[0]).toFixed(2),
      max: Number(vals[vals.length-1]).toFixed(2),
      median: Number(vals[Math.floor(vals.length/2)]).toFixed(2),
    };
  }

  console.log('\n=== 叛乱组 vs 控制组 对比 ===');
  const fields = [
    { key: 'stab_Level', name: '稳定度' },
    { key: 'eco_CPI', name: 'CPI' },
    { key: 'eco_GDP', name: 'GDP' },
    { key: 'eco_Treasury', name: '国库' },
    { key: 'pop_Total', name: '人口' },
    { key: 'pop_Starvation', name: '饥荒死亡' },
    { key: 'mil_ArmySize', name: '军队规模' },
    { key: 'eco_PPI', name: 'PPI' },
    { key: 'ecoFlow_Tax', name: '税收收入' },
    { key: 'ecoFlow_Trade', name: '贸易收入' },
    { key: 'ecoFlow_Military', name: '军事开支' },
    { key: 'demand_fails', name: '诉求失败次数' },
    { key: 'org_events', name: '组织度事件' },
    { key: 'demand_total', name: '总诉求次数' },
  ];

  for (const f of fields) {
    const rs = stat(rebData, f.key);
    const cs = stat(ctrlData, f.key);
    const ratio = rs.avg > 0 && cs.avg > 0 ? (parseFloat(rs.avg) / parseFloat(cs.avg)).toFixed(2) : 'N/A';
    console.log(`| ${f.name} | ${rs.avg} | ${cs.avg} | ${ratio}x |`);
  }

  // 更有趣的分析：饥荒死亡比例
  const rebStarv = rebData.filter(r => r.pop_Starvation > 0).length;
  const ctrlStarv = ctrlData.filter(r => r.pop_Starvation > 0).length;
  console.log(`\n有饥荒死亡: 叛乱组 ${rebStarv}/${rebData.length} (${(rebStarv/rebData.length*100).toFixed(1)}%), 控制组 ${ctrlStarv}/${ctrlData.length} (${(ctrlStarv/ctrlData.length*100).toFixed(1)}%)`);
  
  const rebLowStab = rebData.filter(r => r.stab_Level < 50).length;
  const ctrlLowStab = ctrlData.filter(r => r.stab_Level < 50).length;
  console.log(`稳定度<50: 叛乱组 ${rebLowStab}/${rebData.length} (${(rebLowStab/rebData.length*100).toFixed(1)}%), 控制组 ${ctrlLowStab}/${ctrlData.length} (${(ctrlLowStab/ctrlData.length*100).toFixed(1)}%)`);

  const rebHighCPI = rebData.filter(r => r.eco_CPI > 120).length;
  const ctrlHighCPI = ctrlData.filter(r => r.eco_CPI > 120).length;
  console.log(`CPI>120: 叛乱组 ${rebHighCPI}/${rebData.length} (${(rebHighCPI/rebData.length*100).toFixed(1)}%), 控制组 ${ctrlHighCPI}/${ctrlData.length} (${(ctrlHighCPI/ctrlData.length*100).toFixed(1)}%)`);

  // 保存 JSON 版本供后续分析
  fs.writeFileSync(
    'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_dataset.json',
    JSON.stringify(features, null, 2)
  );
  console.log('\n✅ JSON 数据集也保存了');
}

main().catch(console.error);
