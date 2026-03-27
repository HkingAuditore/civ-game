/**
 * 叛乱预测模型 - 诊断 + 特征数据集构建
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

  // ===== 诊断：叛乱事件与采样事件的时间关系 =====
  console.log("=== 诊断：叛乱时间范围与采样时间范围 ===");
  const [diag] = await conn.execute(`
    SELECT 
      MIN(created_at) AS earliest_event,
      MAX(created_at) AS latest_event,
      MIN(CASE WHEN event_id LIKE 'Rebellion:%' THEN created_at END) AS earliest_rebellion,
      MAX(CASE WHEN event_id LIKE 'Rebellion:%' THEN created_at END) AS latest_rebellion,
      MIN(CASE WHEN event_id = 'Stability:Level' THEN created_at END) AS earliest_stability,
      MAX(CASE WHEN event_id = 'Stability:Level' THEN created_at END) AS latest_stability,
      DATEDIFF(MAX(CASE WHEN event_id LIKE 'Rebellion:%' THEN created_at END),
               MIN(CASE WHEN event_id LIKE 'Rebellion:%' THEN created_at END)) AS rebellion_span_days
    FROM design_events
  `);
  console.table(diag);

  // 看一下叛乱事件 session 的 created_at 和采样事件 session 的 created_at 分布
  console.log("\n=== 叛乱事件的 session_id 样本 ===");
  const [rebSessions] = await conn.execute(`
    SELECT DISTINCT session_id, MIN(created_at) AS first_event, MAX(created_at) AS last_event
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:%'
    GROUP BY session_id
    ORDER BY first_event DESC
    LIMIT 10
  `);
  console.table(rebSessions);

  // 看一下采样事件的 session_id 样本
  console.log("\n=== 采样事件的 session_id 样本 ===");
  const [samplingSessions] = await conn.execute(`
    SELECT DISTINCT session_id, MIN(created_at) AS first_event, MAX(created_at) AS last_event
    FROM design_events 
    WHERE event_id = 'Stability:Level'
    GROUP BY session_id
    ORDER BY first_event DESC
    LIMIT 10
  `);
  console.table(samplingSessions);

  // 关键检查：有叛乱的session里，有没有Stability:Level事件？
  console.log("\n=== 有叛乱的session中，有Stability:Level的比例 ===");
  const [overlap] = await conn.execute(`
    SELECT 
      COUNT(DISTINCT CASE WHEN event_id LIKE 'Rebellion:%' THEN session_id END) AS reb_sessions,
      COUNT(DISTINCT CASE WHEN event_id = 'Stability:Level' THEN session_id END) AS stab_sessions,
      COUNT(DISTINCT CASE WHEN event_id LIKE 'Rebellion:%' THEN session_id END) -
      COUNT(DISTINCT CASE WHEN event_id LIKE 'Rebellion:%' AND session_id IN (
        SELECT DISTINCT session_id FROM design_events WHERE event_id = 'Stability:Level'
      ) THEN session_id END) AS reb_without_stab
    FROM design_events
  `);
  console.table(overlap);

  // 直接看：某几个有叛乱的session里有什么采样事件
  if (rebSessions.length > 0) {
    const sid = rebSessions[0].session_id;
    console.log(`\n=== session ${sid} 的所有事件类型 ===`);
    const [sessionTypes] = await conn.execute(`
      SELECT SUBSTRING_INDEX(event_id, ':', 1) AS category, COUNT(*) AS cnt
      FROM design_events WHERE session_id = ?
      GROUP BY category ORDER BY cnt DESC
    `, [sid]);
    console.table(sessionTypes);
  }

  // 看看是不是 180 DAY 太大了——改为用 days_elapsed 做关联
  console.log("\n=== 用 days_elapsed 关联：叛乱发生时的 days_elapsed ===");
  const [rebDays] = await conn.execute(`
    SELECT 
      session_id,
      MIN(days_elapsed) AS first_rebellion_day,
      MAX(days_elapsed) AS last_rebellion_day
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:%'
    GROUP BY session_id
    ORDER BY first_rebellion_day
    LIMIT 10
  `);
  console.table(rebDays);

  // 采样事件的 days_elapsed
  console.log("\n=== 采样事件的 days_elapsed 范围 ===");
  const [samplingDays] = await conn.execute(`
    SELECT 
      event_id,
      MIN(days_elapsed) AS min_day,
      MAX(days_elapsed) AS max_day,
      AVG(days_elapsed) AS avg_day
    FROM design_events 
    WHERE event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:GDP')
    GROUP BY event_id
  `);
  console.table(samplingDays);

  await conn.end();
}

main().catch(console.error);
