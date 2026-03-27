/**
 * 叛乱预测模型 - 正确的特征数据集构建
 * 用 session_id 关联，不依赖 days_elapsed 或 created_at
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

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

  // ===== 1. 叛乱前指标（有叛乱的session，取叛乱前最后一条采样） =====
  // 思路：对每个有叛乱的session，取 created_at 在第一次叛乱之前的采样数据
  console.log("=== 1. 叛乱前经济指标（用 created_at 排序，取叛乱前最后一条） ===");
  const [preReb] = await conn.execute(`
    WITH rebellion_first AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:%'
      GROUP BY session_id
    ),
    pre_metrics AS (
      SELECT 
        rf.session_id,
        rf.first_rebellion_at,
        d.event_id,
        d.event_value,
        ROW_NUMBER() OVER (PARTITION BY rf.session_id, d.event_id ORDER BY d.created_at DESC) AS rn
      FROM rebellion_first rf
      JOIN design_events d ON d.session_id = rf.session_id 
        AND d.created_at < rf.first_rebellion_at
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI')
    )
    SELECT 
      session_id,
      first_rebellion_at,
      MAX(CASE WHEN event_id = 'Stability:Level' AND rn = 1 THEN event_value END) AS stability,
      MAX(CASE WHEN event_id = 'Economy:CPI' AND rn = 1 THEN event_value END) AS cpi,
      MAX(CASE WHEN event_id = 'Economy:GDP' AND rn = 1 THEN event_value END) AS gdp,
      MAX(CASE WHEN event_id = 'Economy:Treasury' AND rn = 1 THEN event_value END) AS treasury,
      MAX(CASE WHEN event_id = 'Population:Total' AND rn = 1 THEN event_value END) AS population,
      MAX(CASE WHEN event_id = 'Population:Starvation' AND rn = 1 THEN event_value END) AS starvation,
      MAX(CASE WHEN event_id = 'Military:ArmySize' AND rn = 1 THEN event_value END) AS army_size,
      MAX(CASE WHEN event_id = 'Economy:PPI' AND rn = 1 THEN event_value END) AS ppi
    FROM pre_metrics
    WHERE rn = 1
    GROUP BY session_id, first_rebellion_at
  `);
  
  console.log(`总行数: ${preReb.length}`);
  // 过滤有 stability 的
  const withStability = preReb.filter(r => r.stability !== null);
  console.log(`有稳定度数据的行数: ${withStability.length}`);
  
  if (withStability.length > 0) {
    const avg = (field) => {
      const vals = withStability.map(r => r[field]).filter(v => v !== null && v !== undefined);
      return vals.length > 0 ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2) : 'N/A';
    };
    const cnt = (field, condition) => withStability.filter(r => condition(r[field])).length;
    
    console.log(`\n--- 叛乱前指标汇总 (N=${withStability.length}) ---`);
    console.log(`稳定度: avg=${avg('stability')}`);
    console.log(`CPI: avg=${avg('cpi')}`);
    console.log(`GDP: avg=${avg('gdp')}`);
    console.log(`国库: avg=${avg('treasury')}`);
    console.log(`人口: avg=${avg('population')}`);
    console.log(`饥荒死亡: avg=${avg('starvation')}, 有饥荒session=${cnt('starvation', v => v > 0)}`);
    console.log(`军队: avg=${avg('army_size')}`);
    console.log(`PPI: avg=${avg('ppi')}`);
  }

  // ===== 2. 控制组：从未叛乱的session =====
  console.log("\n=== 2. 控制组：从未叛乱的session的指标 ===");
  const [control] = await conn.execute(`
    WITH rebellion_sessions AS (
      SELECT DISTINCT session_id FROM design_events WHERE event_id LIKE 'Rebellion:%'
    ),
    control_last AS (
      SELECT 
        d.session_id,
        d.event_id,
        d.event_value,
        ROW_NUMBER() OVER (PARTITION BY d.session_id, d.event_id ORDER BY d.created_at DESC) AS rn
      FROM design_events d
      WHERE d.session_id NOT IN (SELECT session_id FROM rebellion_sessions)
      AND d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI')
    )
    SELECT 
      session_id,
      MAX(CASE WHEN event_id = 'Stability:Level' AND rn = 1 THEN event_value END) AS stability,
      MAX(CASE WHEN event_id = 'Economy:CPI' AND rn = 1 THEN event_value END) AS cpi,
      MAX(CASE WHEN event_id = 'Economy:GDP' AND rn = 1 THEN event_value END) AS gdp,
      MAX(CASE WHEN event_id = 'Economy:Treasury' AND rn = 1 THEN event_value END) AS treasury,
      MAX(CASE WHEN event_id = 'Population:Total' AND rn = 1 THEN event_value END) AS population,
      MAX(CASE WHEN event_id = 'Population:Starvation' AND rn = 1 THEN event_value END) AS starvation,
      MAX(CASE WHEN event_id = 'Military:ArmySize' AND rn = 1 THEN event_value END) AS army_size,
      MAX(CASE WHEN event_id = 'Economy:PPI' AND rn = 1 THEN event_value END) AS ppi
    FROM control_last
    WHERE rn = 1
    GROUP BY session_id
  `);
  
  console.log(`总行数: ${control.length}`);
  const ctrlWithStab = control.filter(r => r.stability !== null);
  console.log(`有稳定度数据的行数: ${ctrlWithStab.length}`);
  
  if (ctrlWithStab.length > 0) {
    const avg = (field) => {
      const vals = ctrlWithStab.map(r => r[field]).filter(v => v !== null && v !== undefined);
      return vals.length > 0 ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2) : 'N/A';
    };
    const cnt = (field, condition) => ctrlWithStab.filter(r => condition(r[field])).length;
    
    console.log(`\n--- 控制组指标汇总 (N=${ctrlWithStab.length}) ---`);
    console.log(`稳定度: avg=${avg('stability')}`);
    console.log(`CPI: avg=${avg('cpi')}`);
    console.log(`GDP: avg=${avg('gdp')}`);
    console.log(`国库: avg=${avg('treasury')}`);
    console.log(`人口: avg=${avg('population')}`);
    console.log(`饥荒死亡: avg=${avg('starvation')}, 有饥荒session=${cnt('starvation', v => v > 0)}`);
    console.log(`军队: avg=${avg('army_size')}`);
    console.log(`PPI: avg=${avg('ppi')}`);
  }

  // ===== 3. 叛乱前的诉求失败次数 =====
  console.log("\n=== 3. 叛乱前的诉求失败次数（按 session） ===");
  const [demandFails] = await conn.execute(`
    WITH rebellion_first AS (
      SELECT session_id, MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:%'
      GROUP BY session_id
    )
    SELECT 
      rf.session_id,
      COUNT(*) AS demand_fail_count
    FROM rebellion_first rf
    JOIN design_events d ON d.session_id = rf.session_id 
      AND d.event_id LIKE 'Demand:Fail:%'
      AND d.created_at < rf.first_rebellion_at
    GROUP BY rf.session_id
    ORDER BY demand_fail_count DESC
    LIMIT 20
  `);
  console.table(demandFails);

  // ===== 4. 叛乱前的组织度变化 =====
  console.log("\n=== 4. 叛乱前的组织度数值（按 session） ===");
  const [orgData] = await conn.execute(`
    WITH rebellion_first AS (
      SELECT session_id, MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:%'
      GROUP BY session_id
    )
    SELECT 
      rf.session_id,
      COUNT(*) AS org_events,
      MAX(d.event_value) AS max_org,
      AVG(d.event_value) AS avg_org
    FROM rebellion_first rf
    JOIN design_events d ON d.session_id = rf.session_id 
      AND d.event_id LIKE 'Organization:%'
      AND d.created_at < rf.first_rebellion_at
    GROUP BY rf.session_id
    ORDER BY max_org DESC
    LIMIT 20
  `);
  console.table(orgData);

  // ===== 5. 完整特征数据集：每个session一条 =====
  console.log("\n=== 5. 构建完整特征数据集 ===");
  const [featureDataset] = await conn.execute(`
    WITH rebellion_first AS (
      SELECT session_id, MIN(created_at) AS first_rebellion_at, 1 AS has_rebellion
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:%'
      GROUP BY session_id
    ),
    all_sessions AS (
      SELECT DISTINCT session_id FROM design_events
    ),
    session_labels AS (
      SELECT 
        a.session_id,
        COALESCE(r.has_rebellion, 0) AS has_rebellion,
        r.first_rebellion_at
      FROM all_sessions a
      LEFT JOIN rebellion_first r ON a.session_id = r.session_id
    ),
    last_metrics AS (
      SELECT 
        d.session_id,
        d.event_id,
        d.event_value,
        ROW_NUMBER() OVER (PARTITION BY d.session_id, d.event_id ORDER BY 
          CASE WHEN d.created_at < COALESCE((SELECT first_rebellion_at FROM session_labels sl WHERE sl.session_id = d.session_id), '9999-12-31') 
               THEN d.created_at 
               ELSE '0001-01-01' 
          END DESC
        ) AS rn
      FROM design_events d
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI')
    ),
    demand_counts AS (
      SELECT 
        d.session_id,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Fail:%' THEN 1 END) AS demand_fails,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Generate:%' THEN 1 END) AS demand_total,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Complete:%' THEN 1 END) AS demand_completes,
        COUNT(CASE WHEN d.event_id LIKE 'Organization:%' THEN 1 END) AS org_events
      FROM design_events d
      GROUP BY d.session_id
    )
    SELECT 
      sl.session_id,
      sl.has_rebellion AS label,
      MAX(CASE WHEN lm.event_id = 'Stability:Level' AND lm.rn = 1 THEN lm.event_value END) AS stability,
      MAX(CASE WHEN lm.event_id = 'Economy:CPI' AND lm.rn = 1 THEN lm.event_value END) AS cpi,
      MAX(CASE WHEN lm.event_id = 'Economy:GDP' AND lm.rn = 1 THEN lm.event_value END) AS gdp,
      MAX(CASE WHEN lm.event_id = 'Economy:Treasury' AND lm.rn = 1 THEN lm.event_value END) AS treasury,
      MAX(CASE WHEN lm.event_id = 'Population:Total' AND lm.rn = 1 THEN lm.event_value END) AS population,
      MAX(CASE WHEN lm.event_id = 'Population:Starvation' AND lm.rn = 1 THEN lm.event_value END) AS starvation,
      MAX(CASE WHEN lm.event_id = 'Military:ArmySize' AND lm.rn = 1 THEN lm.event_value END) AS army_size,
      MAX(CASE WHEN lm.event_id = 'Economy:PPI' AND lm.rn = 1 THEN lm.event_value END) AS ppi,
      COALESCE(dc.demand_fails, 0) AS demand_fails,
      COALESCE(dc.demand_total, 0) AS demand_total,
      COALESCE(dc.demand_completes, 0) AS demand_completes,
      COALESCE(dc.org_events, 0) AS org_events
    FROM session_labels sl
    LEFT JOIN last_metrics lm ON lm.session_id = sl.session_id
    LEFT JOIN demand_counts dc ON dc.session_id = sl.session_id
    GROUP BY sl.session_id, sl.has_rebellion, dc.demand_fails, dc.demand_total, dc.demand_completes, dc.org_events
  `);

  console.log(`总 session 数: ${featureDataset.length}`);
  console.log(`有叛乱: ${featureDataset.filter(r => r.label === 1).length}`);
  console.log(`无叛乱: ${featureDataset.filter(r => r.label === 0).length}`);
  
  // 保存完整数据集
  const csvPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_features.csv';
  if (featureDataset.length > 0) {
    const headers = Object.keys(featureDataset[0]);
    const csv = [headers.join(','), ...featureDataset.map(row => 
      headers.map(h => {
        const v = row[h];
        return v === null || v === undefined ? '' : String(v);
      }).join(',')
    )].join('\n');
    fs.writeFileSync(csvPath, csv);
    console.log(`\n✅ 特征数据集已保存到 ${csvPath} (${featureDataset.length} 行)`);
  }

  // ===== 6. 更精确的"叛乱前"特征集 =====
  // 只取叛乱session在第一次叛乱之前的数据
  console.log("\n=== 6. 精确的叛乱前特征集（叛乱前最后一个采样点） ===");
  const [preciseReb] = await conn.execute(`
    WITH rebellion_first AS (
      SELECT session_id, MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:%'
      GROUP BY session_id
    ),
    pre_reb_metrics AS (
      SELECT 
        rf.session_id,
        d.event_id,
        d.event_value,
        ROW_NUMBER() OVER (PARTITION BY rf.session_id, d.event_id ORDER BY d.created_at DESC) AS rn
      FROM rebellion_first rf
      JOIN design_events d ON d.session_id = rf.session_id 
        AND d.created_at < rf.first_rebellion_at
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI',
                            'EconFlow:Tax', 'EconFlow:Trade', 'EconFlow:Military', 'EconFlow:Building', 'EconFlow:Official')
    ),
    pre_demands AS (
      SELECT 
        rf.session_id,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Fail:%' THEN 1 END) AS demand_fails,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Generate:%' THEN 1 END) AS demand_total,
        COUNT(CASE WHEN d.event_id LIKE 'Demand:Complete:%' THEN 1 END) AS demand_completes,
        COUNT(CASE WHEN d.event_id LIKE 'Organization:%' THEN 1 END) AS org_events,
        MAX(CASE WHEN d.event_id LIKE 'Organization:%' THEN d.event_value END) AS max_org_level,
        AVG(CASE WHEN d.event_id LIKE 'Organization:%' THEN d.event_value END) AS avg_org_level
      FROM rebellion_first rf
      JOIN design_events d ON d.session_id = rf.session_id 
        AND d.created_at < rf.first_rebellion_at
      WHERE d.event_id LIKE 'Demand:%' OR d.event_id LIKE 'Organization:%'
      GROUP BY rf.session_id
    )
    SELECT 
      m.session_id,
      1 AS label,
      MAX(CASE WHEN m.event_id = 'Stability:Level' AND m.rn = 1 THEN m.event_value END) AS stability,
      MAX(CASE WHEN m.event_id = 'Economy:CPI' AND m.rn = 1 THEN m.event_value END) AS cpi,
      MAX(CASE WHEN m.event_id = 'Economy:GDP' AND m.rn = 1 THEN m.event_value END) AS gdp,
      MAX(CASE WHEN m.event_id = 'Economy:Treasury' AND m.rn = 1 THEN m.event_value END) AS treasury,
      MAX(CASE WHEN m.event_id = 'Population:Total' AND m.rn = 1 THEN m.event_value END) AS population,
      MAX(CASE WHEN m.event_id = 'Population:Starvation' AND m.rn = 1 THEN m.event_value END) AS starvation,
      MAX(CASE WHEN m.event_id = 'Military:ArmySize' AND m.rn = 1 THEN m.event_value END) AS army_size,
      MAX(CASE WHEN m.event_id = 'Economy:PPI' AND m.rn = 1 THEN m.event_value END) AS ppi,
      MAX(CASE WHEN m.event_id = 'EconFlow:Tax' AND m.rn = 1 THEN m.event_value END) AS tax_income,
      MAX(CASE WHEN m.event_id = 'EconFlow:Trade' AND m.rn = 1 THEN m.event_value END) AS trade_income,
      MAX(CASE WHEN m.event_id = 'EconFlow:Military' AND m.rn = 1 THEN m.event_value END) AS military_cost,
      MAX(CASE WHEN m.event_id = 'EconFlow:Building' AND m.rn = 1 THEN m.event_value END) AS building_cost,
      MAX(CASE WHEN m.event_id = 'EconFlow:Official' AND m.rn = 1 THEN m.event_value END) AS official_cost,
      COALESCE(pd.demand_fails, 0) AS demand_fails,
      COALESCE(pd.demand_total, 0) AS demand_total,
      COALESCE(pd.demand_completes, 0) AS demand_completes,
      COALESCE(pd.org_events, 0) AS org_events,
      pd.max_org_level,
      pd.avg_org_level
    FROM pre_reb_metrics m
    LEFT JOIN pre_demands pd ON pd.session_id = m.session_id
    WHERE m.rn = 1
    GROUP BY m.session_id, pd.demand_fails, pd.demand_total, pd.demand_completes, pd.org_events, pd.max_org_level, pd.avg_org_level
  `);

  console.log(`叛乱前特征集: ${preciseReb.length} 行`);
  
  // 保存
  const csvPath2 = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_pre_features.csv';
  if (preciseReb.length > 0) {
    const headers = Object.keys(preciseReb[0]);
    const csv = [headers.join(','), ...preciseReb.map(row => 
      headers.map(h => {
        const v = row[h];
        return v === null || v === undefined ? '' : String(v);
      }).join(',')
    )].join('\n');
    fs.writeFileSync(csvPath2, csv);
    console.log(`✅ 叛乱前特征集已保存到 ${csvPath2}`);
    
    // 汇总统计
    const withStab = preciseReb.filter(r => r.stability !== null);
    console.log(`\n--- 叛乱前指标汇总 (N=${withStab.length}) ---`);
    const avg = (field) => {
      const vals = withStab.map(r => r[field]).filter(v => v !== null && v !== undefined);
      return vals.length > 0 ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2) : 'N/A';
    };
    const pct = (field, condition) => {
      const c = withStab.filter(r => condition(r[field])).length;
      return (c / withStab.length * 100).toFixed(1) + '%';
    };
    console.log(`稳定度: avg=${avg('stability')}, <30: ${pct('stability', v => v < 30)}, <50: ${pct('stability', v => v < 50)}`);
    console.log(`CPI: avg=${avg('cpi')}, >120: ${pct('cpi', v => v > 120)}, >150: ${pct('cpi', v => v > 150)}`);
    console.log(`GDP: avg=${avg('gdp')}`);
    console.log(`国库: avg=${avg('treasury')}`);
    console.log(`人口: avg=${avg('population')}`);
    console.log(`饥荒: avg=${avg('starvation')}, 有饥荒: ${pct('starvation', v => v > 0)}`);
    console.log(`军队: avg=${avg('army_size')}`);
    console.log(`PPI: avg=${avg('ppi')}`);
    console.log(`诉求失败: avg=${avg('demand_fails')}, 有失败: ${pct('demand_fails', v => v > 0)}`);
    console.log(`组织度事件: avg=${avg('org_events')}`);
  }

  await conn.end();
}

main().catch(console.error);
