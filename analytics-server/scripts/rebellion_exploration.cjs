/**
 * 叛乱预测模型 - 第1步：数据探索与特征工程
 * 
 * 目标：理解叛乱事件结构，构建"叛乱前N个tick"的特征数据集
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
  
  const report = {};

  // ===== 1. 叛乱事件分布 =====
  console.log("=== 1. 叛乱事件分布 ===");
  const [rebellionEvents] = await conn.execute(`
    SELECT 
      event_id,
      COUNT(*) AS cnt,
      ROUND(AVG(event_value), 2) AS avg_value,
      ROUND(MIN(event_value), 2) AS min_value,
      ROUND(MAX(event_value), 2) AS max_value
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:%'
    GROUP BY event_id
    ORDER BY cnt DESC
  `);
  console.table(rebellionEvents);
  report.rebellionEvents = rebellionEvents;

  // ===== 2. 叛乱阶段细分 =====
  console.log("\n=== 2. 叛乱阶段 ===");
  const [rebellionPhases] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', 3) AS phase,
      SUBSTRING_INDEX(event_id, ':', -1) AS stratum,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY phase, stratum
    ORDER BY cnt DESC
    LIMIT 30
  `);
  console.table(rebellionPhases);
  report.rebellionPhases = rebellionPhases;

  // ===== 3. 组织度事件分布 =====
  console.log("\n=== 3. 组织度事件 ===");
  const [orgEvents] = await conn.execute(`
    SELECT 
      event_id,
      COUNT(*) AS cnt,
      ROUND(AVG(event_value), 2) AS avg_value
    FROM design_events 
    WHERE event_id LIKE 'Organization:%'
    GROUP BY event_id
    ORDER BY cnt DESC
  `);
  console.table(orgEvents);
  report.orgEvents = orgEvents;

  // ===== 4. 叛乱涉及的阶层分布 =====
  console.log("\n=== 4. 叛乱涉及的阶层 ===");
  const [rebellionStrata] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', -1) AS stratum,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY stratum
    ORDER BY cnt DESC
  `);
  console.table(rebellionStrata);
  report.rebellionStrata = rebellionStrata;

  // ===== 5. 诉求事件分布 =====
  console.log("\n=== 5. 诉求事件 ===");
  const [demandEvents] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', 3) AS demand_type,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Demand:%'
    GROUP BY demand_type
    ORDER BY cnt DESC
  `);
  console.table(demandEvents);
  report.demandEvents = demandEvents;

  // ===== 6. 诉求失败分布（叛乱前兆） =====
  console.log("\n=== 6. 诉求失败细分 ===");
  const [demandFails] = await conn.execute(`
    SELECT 
      event_id,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Demand:Fail:%'
    GROUP BY event_id
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.table(demandFails);
  report.demandFails = demandFails;

  // ===== 7. 叛乱事件时间序列样本（一个玩家的叛乱前后事件） =====
  console.log("\n=== 7. 叛乱前后的典型事件序列（随机抽样1个session） ===");
  const [sampleSession] = await conn.execute(`
    SELECT DISTINCT session_id 
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:phase:%' AND event_id LIKE '%brewing%'
    LIMIT 1
  `);
  
  if (sampleSession.length > 0) {
    const [timeline] = await conn.execute(`
      SELECT 
        event_id,
        event_value,
        days_elapsed,
        created_at
      FROM design_events 
      WHERE session_id = ?
      AND (
        event_id LIKE 'Rebellion:%' 
        OR event_id LIKE 'Organization:%'
        OR event_id LIKE 'Demand:%'
        OR event_id LIKE 'Stability:%'
        OR event_id LIKE 'Economy:CPI%'
        OR event_id LIKE 'Economy:Treasury%'
        OR event_id LIKE 'Population:Starvation%'
        OR event_id LIKE 'Economy:Crisis:%'
      )
      ORDER BY created_at
      LIMIT 100
    `, [sampleSession[0].session_id]);
    console.table(timeline);
    report.sampleTimeline = timeline;
  }

  // ===== 8. 关键统计：采样间隔和采样指标频率 =====
  console.log("\n=== 8. 周期采样指标频率（每30游戏日采样） ===");
  const [samplingFreq] = await conn.execute(`
    SELECT 
      event_id,
      COUNT(*) AS cnt,
      COUNT(DISTINCT session_id) AS sessions
    FROM design_events 
    WHERE event_id IN ('Economy:GDP', 'Economy:CPI', 'Economy:Treasury', 
                        'Stability:Level', 'Population:Total', 'Population:Starvation',
                        'Military:ArmySize', 'Economy:PPI')
    GROUP BY event_id
    ORDER BY cnt DESC
  `);
  console.table(samplingFreq);
  report.samplingFreq = samplingFreq;

  // ===== 9. 叛乱前的稳定度/CPI 分布 =====
  // 找出叛乱发生的session，然后看叛乱前最后一个稳定度和CPI
  console.log("\n=== 9. 叛乱前的经济指标（取叛乱前最近一次采样） ===");
  const [preRebellionMetrics] = await conn.execute(`
    WITH rebellion_sessions AS (
      SELECT DISTINCT session_id, user_id
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
    ),
    rebellion_times AS (
      SELECT 
        r.session_id,
        r.user_id,
        MIN(d.created_at) AS first_rebellion_at,
        MIN(d.days_elapsed) AS rebellion_day
      FROM rebellion_sessions r
      JOIN design_events d ON d.session_id = r.session_id AND d.event_id LIKE 'Rebellion:phase:%'
      GROUP BY r.session_id, r.user_id
    ),
    pre_rebellion_stats AS (
      SELECT 
        rt.session_id,
        rt.user_id,
        rt.rebellion_day,
        MAX(CASE WHEN d.event_id = 'Stability:Level' THEN d.event_value END) AS stability,
        MAX(CASE WHEN d.event_id = 'Economy:CPI' THEN d.event_value END) AS cpi,
        MAX(CASE WHEN d.event_id = 'Economy:GDP' THEN d.event_value END) AS gdp,
        MAX(CASE WHEN d.event_id = 'Economy:Treasury' THEN d.event_value END) AS treasury,
        MAX(CASE WHEN d.event_id = 'Population:Total' THEN d.event_value END) AS population,
        MAX(CASE WHEN d.event_id = 'Population:Starvation' THEN d.event_value END) AS starvation,
        MAX(CASE WHEN d.event_id = 'Military:ArmySize' THEN d.event_value END) AS army_size,
        MAX(CASE WHEN d.event_id = 'Economy:PPI' THEN d.event_value END) AS ppi
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI')
      GROUP BY rt.session_id, rt.user_id, rt.rebellion_day
    )
    SELECT 
      COUNT(*) AS total_sessions,
      ROUND(AVG(stability), 2) AS avg_stability,
      ROUND(AVG(cpi), 2) AS avg_cpi,
      ROUND(AVG(gdp), 2) AS avg_gdp,
      ROUND(AVG(treasury), 2) AS avg_treasury,
      ROUND(AVG(population), 0) AS avg_population,
      ROUND(SUM(CASE WHEN starvation > 0 THEN 1 ELSE 0 END), 0) AS sessions_with_starvation,
      ROUND(AVG(starvation), 0) AS avg_starvation,
      ROUND(AVG(army_size), 0) AS avg_army,
      ROUND(AVG(ppi), 2) AS avg_ppi
    FROM pre_rebellion_stats
    WHERE stability IS NOT NULL
  `);
  console.table(preRebellionMetrics);
  report.preRebellionMetrics = preRebellionMetrics;

  // ===== 10. 控制组：从未叛乱的session的同期指标 =====
  console.log("\n=== 10. 控制组：从未叛乱的session的经济指标（同游戏天数段） ===");
  const [controlMetrics] = await conn.execute(`
    WITH rebellion_sessions AS (
      SELECT DISTINCT session_id FROM design_events WHERE event_id LIKE 'Rebellion:phase:%'
    ),
    control_sessions AS (
      SELECT s.session_id, s.user_id
      FROM sessions s
      WHERE s.session_id NOT IN (SELECT session_id FROM rebellion_sessions)
      AND s.duration_ms > 600000  -- 至少玩了10分钟
    ),
    control_sampling AS (
      SELECT 
        cs.session_id,
        cs.user_id,
        d.event_id,
        d.event_value,
        d.days_elapsed
      FROM control_sessions cs
      JOIN design_events d ON d.session_id = cs.session_id
      WHERE d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP', 'Economy:Treasury',
                            'Population:Total', 'Population:Starvation', 'Military:ArmySize', 'Economy:PPI')
      AND d.days_elapsed BETWEEN 60 AND 600  -- 对应相似游戏进度
    )
    SELECT 
      COUNT(DISTINCT session_id) AS total_sessions,
      ROUND(AVG(CASE WHEN event_id = 'Stability:Level' THEN event_value END), 2) AS avg_stability,
      ROUND(AVG(CASE WHEN event_id = 'Economy:CPI' THEN event_value END), 2) AS avg_cpi,
      ROUND(AVG(CASE WHEN event_id = 'Economy:GDP' THEN event_value END), 2) AS avg_gdp,
      ROUND(AVG(CASE WHEN event_id = 'Economy:Treasury' THEN event_value END), 2) AS avg_treasury,
      ROUND(AVG(CASE WHEN event_id = 'Population:Total' THEN event_value END), 0) AS avg_population,
      ROUND(SUM(CASE WHEN event_id = 'Population:Starvation' AND event_value > 0 THEN 1 ELSE 0 END), 0) AS sessions_with_starvation,
      ROUND(AVG(CASE WHEN event_id = 'Population:Starvation' THEN event_value END), 0) AS avg_starvation,
      ROUND(AVG(CASE WHEN event_id = 'Military:ArmySize' THEN event_value END), 0) AS avg_army,
      ROUND(AVG(CASE WHEN event_id = 'Economy:PPI' THEN event_value END), 2) AS avg_ppi
    FROM control_sampling
  `);
  console.table(controlMetrics);
  report.controlMetrics = controlMetrics;

  // ===== 11. 叛乱前N个tick的特征详细分布 =====
  console.log("\n=== 11. 叛乱前稳定度分布直方图数据 ===");
  const [stabilityHist] = await conn.execute(`
    WITH rebellion_times AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
      GROUP BY session_id
    ),
    pre_stability AS (
      SELECT d.event_value AS stability
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.event_id = 'Stability:Level'
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
    )
    SELECT 
      CASE 
        WHEN stability >= 80 THEN '80-100 (高)'
        WHEN stability >= 60 THEN '60-79 (中高)'
        WHEN stability >= 40 THEN '40-59 (中)'
        WHEN stability >= 20 THEN '20-39 (低)'
        WHEN stability >= 0 THEN '0-19 (极低)'
        ELSE '负值'
      END AS stability_range,
      COUNT(*) AS cnt,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pre_stability), 1) AS pct
    FROM pre_stability
    GROUP BY stability_range
    ORDER BY MIN(stability) DESC
  `);
  console.table(stabilityHist);
  report.stabilityHist = stabilityHist;

  // ===== 12. 叛乱前CPI分布 =====
  console.log("\n=== 12. 叛乱前CPI分布 ===");
  const [cpiHist] = await conn.execute(`
    WITH rebellion_times AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
      GROUP BY session_id
    ),
    pre_cpi AS (
      SELECT d.event_value AS cpi
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.event_id = 'Economy:CPI'
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
    )
    SELECT 
      CASE 
        WHEN cpi >= 200 THEN '200+ (恶性通胀)'
        WHEN cpi >= 150 THEN '150-199 (高通胀)'
        WHEN cpi >= 120 THEN '120-149 (通胀)'
        WHEN cpi >= 100 THEN '100-119 (正常偏高)'
        WHEN cpi >= 80 THEN '80-99 (正常偏低)'
        WHEN cpi >= 50 THEN '50-79 (通缩)'
        ELSE '<50 (严重通缩)'
      END AS cpi_range,
      COUNT(*) AS cnt,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pre_cpi), 1) AS pct
    FROM pre_cpi
    GROUP BY cpi_range
    ORDER BY MIN(cpi) DESC
  `);
  console.table(cpiHist);
  report.cpiHist = cpiHist;

  // ===== 13. 叛乱前饥荒分布 =====
  console.log("\n=== 13. 叛乱前饥荒情况 ===");
  const [starvationData] = await conn.execute(`
    WITH rebellion_times AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
      GROUP BY session_id
    ),
    pre_starvation AS (
      SELECT d.event_value AS starv_deaths, d.days_elapsed
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.event_id = 'Population:Starvation'
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
    )
    SELECT 
      CASE 
        WHEN starv_deaths = 0 THEN '0 (无饥荒)'
        WHEN starv_deaths <= 100 THEN '1-100'
        WHEN starv_deaths <= 1000 THEN '101-1000'
        WHEN starv_deaths <= 10000 THEN '1001-10000'
        ELSE '10000+'
      END AS starvation_range,
      COUNT(*) AS cnt
    FROM pre_starvation
    GROUP BY starvation_range
    ORDER BY MIN(starv_deaths)
  `);
  console.table(starvationData);
  report.starvationData = starvationData;

  // ===== 14. 叛乱前的诉求失败次数 =====
  console.log("\n=== 14. 叛乱前的诉求失败次数 ===");
  const [demandFailCount] = await conn.execute(`
    WITH rebellion_times AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
      GROUP BY session_id
    ),
    pre_demand_fails AS (
      SELECT 
        rt.session_id,
        COUNT(*) AS fail_count
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.event_id LIKE 'Demand:Fail:%'
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
      GROUP BY rt.session_id
    )
    SELECT 
      CASE 
        WHEN fail_count = 0 THEN '0次'
        WHEN fail_count = 1 THEN '1次'
        WHEN fail_count <= 3 THEN '2-3次'
        WHEN fail_count <= 5 THEN '4-5次'
        WHEN fail_count <= 10 THEN '6-10次'
        ELSE '10次以上'
      END AS fail_range,
      COUNT(*) AS sessions,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pre_demand_fails), 1) AS pct
    FROM pre_demand_fails
    GROUP BY fail_range
    ORDER BY MIN(fail_count)
  `);
  console.table(demandFailCount);
  report.demandFailCount = demandFailCount;

  // ===== 15. 组织度在叛乱前的变化 =====
  console.log("\n=== 15. 叛乱前组织度数值分布 ===");
  const [orgBeforeRebellion] = await conn.execute(`
    WITH rebellion_times AS (
      SELECT 
        session_id,
        MIN(created_at) AS first_rebellion_at
      FROM design_events 
      WHERE event_id LIKE 'Rebellion:phase:%'
      GROUP BY session_id
    ),
    pre_org AS (
      SELECT d.event_value AS org_level
      FROM rebellion_times rt
      JOIN design_events d ON d.session_id = rt.session_id 
        AND d.event_id LIKE 'Organization:%'
        AND d.created_at < rt.first_rebellion_at
        AND d.created_at > DATE_SUB(rt.first_rebellion_at, INTERVAL 180 DAY)
    )
    SELECT 
      CASE 
        WHEN org_level >= 80 THEN '80-100'
        WHEN org_level >= 60 THEN '60-79'
        WHEN org_level >= 40 THEN '40-59'
        WHEN org_level >= 20 THEN '20-39'
        ELSE '0-19'
      END AS org_range,
      COUNT(*) AS cnt
    FROM pre_org
    GROUP BY org_range
    ORDER BY MIN(org_level) DESC
  `);
  console.table(orgBeforeRebellion);
  report.orgBeforeRebellion = orgBeforeRebellion;

  // 保存完整报告
  fs.writeFileSync(
    'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_exploration.json',
    JSON.stringify(report, null, 2)
  );

  console.log("\n✅ 报告已保存到 rebellion_exploration.json");

  await conn.end();
}

main().catch(console.error);
