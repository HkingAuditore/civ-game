const mysql = require("mysql2/promise");

(async () => {
  const conn = await mysql.createConnection({
    host: "gz-cdb-bwmozb7l.sql.tencentcdb.com",
    port: 63818,
    user: "civ_analytics",
    password: "59951308",
    database: "civ_analytics",
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  // 关掉 only_full_group_by，简化 GROUP BY 别名
  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

  console.log("=== 1. 数据总览 ===");
  const [overview] = await conn.execute(`
    SELECT 
      (SELECT COUNT(*) FROM sessions) AS total_sessions,
      (SELECT COUNT(DISTINCT user_id) FROM sessions) AS total_players,
      (SELECT MIN(started_at) FROM sessions) AS earliest_session,
      (SELECT MAX(started_at) FROM sessions) AS latest_session,
      (SELECT COUNT(*) FROM design_events) AS total_design_events,
      (SELECT COUNT(*) FROM resource_events) AS total_resource_events,
      (SELECT COUNT(*) FROM error_events) AS total_errors
  `);
  console.log(JSON.stringify(overview[0], null, 2));

  console.log("\n=== 2. design_events 事件分布（按类别） ===");
  const [eventCategories] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', 1) AS category,
      COUNT(*) AS cnt
    FROM design_events 
    GROUP BY SUBSTRING_INDEX(event_id, ':', 1) 
    ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(eventCategories, null, 2));

  console.log("\n=== 3. 活跃玩家统计 ===");
  const [playerStats] = await conn.execute(`
    SELECT 
      COUNT(DISTINCT CASE WHEN DATE(started_at) = CURDATE() THEN user_id END) AS today_dau,
      COUNT(DISTINCT CASE WHEN started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN user_id END) AS week_dau,
      COUNT(DISTINCT CASE WHEN started_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN user_id END) AS month_dau,
      COUNT(DISTINCT CASE WHEN last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE) THEN user_id END) AS online_now,
      ROUND(AVG(duration_ms)/3600000, 2) AS avg_session_hours,
      ROUND(SUM(duration_ms)/3600000, 2) AS total_hours
    FROM sessions
    WHERE duration_ms IS NOT NULL AND duration_ms > 0
  `);
  console.log(JSON.stringify(playerStats[0], null, 2));

  console.log("\n=== 4. 经济指标统计 ===");
  const [econStats] = await conn.execute(`
    SELECT 
      event_id,
      COUNT(*) AS samples,
      ROUND(AVG(event_value), 2) AS avg_val,
      ROUND(MIN(event_value), 2) AS min_val,
      ROUND(MAX(event_value), 2) AS max_val
    FROM design_events 
    WHERE event_id IN ('Economy:GDP', 'Economy:CPI', 'Economy:PPI', 'Economy:Treasury', 'Population:Total', 'Stability:Level', 'Military:ArmySize')
    GROUP BY event_id
    ORDER BY event_id
  `);
  console.log(JSON.stringify(econStats, null, 2));

  console.log("\n=== 5. 建筑购买 Top 15 ===");
  const [topBuildings] = await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS building, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Building:Buy:%'
    GROUP BY building ORDER BY cnt DESC LIMIT 15
  `);
  console.log(JSON.stringify(topBuildings, null, 2));

  console.log("\n=== 6. 时代到达率 ===");
  const [epochReach] = await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS epoch, COUNT(DISTINCT user_id) AS players
    FROM design_events WHERE event_id LIKE 'Epoch:Upgrade:%' GROUP BY epoch ORDER BY players DESC
  `);
  console.log(JSON.stringify(epochReach, null, 2));

  console.log("\n=== 7. 外交事件分布 ===");
  const [diploEvents] = await conn.execute(`
    SELECT 
      CASE
        WHEN event_id LIKE 'Diplomacy:Action:%:%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1)
        WHEN event_id LIKE 'Diplomacy:Action:%' THEN 'action_legacy_unknown'
        ELSE SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1)
      END AS action,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Diplomacy:%'
    GROUP BY action ORDER BY cnt DESC LIMIT 15
  `);
  console.log(JSON.stringify(diploEvents, null, 2));

  console.log("\n=== 8. 军事事件分布 ===");
  const [milEvents] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1) AS action,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Military:%'
    GROUP BY action ORDER BY cnt DESC LIMIT 15
  `);
  console.log(JSON.stringify(milEvents, null, 2));

  console.log("\n=== 9. 事件选项偏好 Top 20 ===");
  const [eventChoices] = await conn.execute(`
    SELECT event_id, COUNT(*) AS cnt FROM design_events
    WHERE event_id LIKE 'Event:Choose:%' GROUP BY event_id ORDER BY cnt DESC LIMIT 20
  `);
  console.log(JSON.stringify(eventChoices, null, 2));

  console.log("\n=== 10. 经济流水统计 ===");
  const [econFlow] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', -1) AS type,
      COUNT(*) AS samples,
      ROUND(AVG(event_value), 2) AS avg_per_sample,
      ROUND(SUM(event_value), 2) AS total
    FROM design_events 
    WHERE event_id LIKE 'EconFlow:%'
    GROUP BY type ORDER BY total DESC
  `);
  console.log(JSON.stringify(econFlow, null, 2));

  console.log("\n=== 11. 经济危机事件 ===");
  const [crisisEvents] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', -1) AS crisis_type,
      COUNT(*) AS cnt,
      ROUND(AVG(event_value), 2) AS avg_value
    FROM design_events 
    WHERE event_id LIKE 'Economy:Crisis:%'
    GROUP BY crisis_type ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(crisisEvents, null, 2));

  console.log("\n=== 12. 叛乱事件 ===");
  const [rebellionEvents] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1) AS phase,
      SUBSTRING_INDEX(event_id, ':', -1) AS stratum,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:%'
    GROUP BY phase, stratum ORDER BY cnt DESC LIMIT 20
  `);
  console.log(JSON.stringify(rebellionEvents, null, 2));

  console.log("\n=== 13. 科技研究 Top 15 ===");
  const [topTechs] = await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS tech, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Tech:Research:%' GROUP BY tech ORDER BY cnt DESC LIMIT 15
  `);
  console.log(JSON.stringify(topTechs, null, 2));

  console.log("\n=== 14. 难度分布 ===");
  const [difficulty] = await conn.execute(`
    SELECT event_id, COUNT(*) AS cnt FROM design_events
    WHERE event_id LIKE 'Game:NewGame:%' GROUP BY event_id ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(difficulty, null, 2));

  console.log("\n=== 15. 法令使用 Top 10 ===");
  const [topDecrees] = await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS decree, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Decree:Toggle:%' GROUP BY decree ORDER BY cnt DESC LIMIT 10
  `);
  console.log(JSON.stringify(topDecrees, null, 2));

  console.log("\n=== 16. 成就解锁统计 ===");
  const [achievements] = await conn.execute(`
    SELECT 
      SUBSTRING_INDEX(event_id, ':', -1) AS achievement,
      COUNT(*) AS cnt,
      MIN(event_value) AS earliest_day,
      AVG(event_value) AS avg_day
    FROM design_events 
    WHERE event_id LIKE 'Achievement:Unlock:%'
    GROUP BY achievement ORDER BY cnt DESC LIMIT 20
  `);
  console.log(JSON.stringify(achievements, null, 2));

  console.log("\n=== 17. 硬核玩家 Top 10（游戏时长） ===");
  const [hardcore] = await conn.execute(`
    SELECT user_id, 
      ROUND(SUM(duration_ms)/3600000, 2) AS total_hours,
      COUNT(*) AS sessions,
      MAX(ended_at) AS last_played
    FROM sessions 
    WHERE duration_ms IS NOT NULL AND duration_ms > 0
    GROUP BY user_id 
    ORDER BY total_hours DESC 
    LIMIT 10
  `);
  console.log(JSON.stringify(hardcore, null, 2));

  console.log("\n=== 18. 每日 DAU 趋势（最近 14 天） ===");
  const [dauTrend] = await conn.execute(`
    SELECT DATE(started_at) AS day, COUNT(DISTINCT user_id) AS dau
    FROM sessions
    WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
    GROUP BY day ORDER BY day
  `);
  console.log(JSON.stringify(dauTrend, null, 2));

  console.log("\n=== 19. 人口饥饿事件 ===");
  const [starvation] = await conn.execute(`
    SELECT COUNT(*) AS total_events,
      SUM(event_value) AS total_deaths,
      ROUND(AVG(event_value), 1) AS avg_deaths_per_event,
      MAX(event_value) AS max_deaths_single_event
    FROM design_events 
    WHERE event_id = 'Population:Starvation'
  `);
  console.log(JSON.stringify(starvation[0], null, 2));

  console.log("\n=== 20. 资源收支汇总 ===");
  const [resourceSummary] = await conn.execute(`
    SELECT 
      currency,
      flow_type,
      COUNT(*) AS cnt,
      ROUND(SUM(amount), 2) AS total_amount,
      ROUND(AVG(amount), 2) AS avg_amount
    FROM resource_events
    GROUP BY currency, flow_type
    ORDER BY currency, flow_type
  `);
  console.log(JSON.stringify(resourceSummary, null, 2));

  console.log("\n=== 21. 数据质量审计（核心覆盖） ===");
  const [quality] = await conn.execute(`
    SELECT
      ROUND(100 * AVG(days_elapsed IS NOT NULL), 2) AS days_coverage_pct,
      ROUND(100 * AVG(player_nation_name IS NOT NULL), 2) AS nation_coverage_pct,
      ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%'), 2) AS diplomacy_action_share_pct,
      ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%' AND event_id NOT LIKE 'Diplomacy:Action:%:%'), 2) AS diplomacy_action_legacy_pct
    FROM design_events
  `);
  console.log(JSON.stringify(quality[0], null, 2));

  console.log("\n=== 22. 局内天数分层（每30天） ===");
  const [dayBuckets] = await conn.execute(`
    SELECT
      FLOOR(days_elapsed / 30) * 30 AS day_bucket,
      ROUND(AVG(CASE WHEN event_id = 'Economy:GDP' THEN event_value END), 0) AS avg_gdp,
      ROUND(AVG(CASE WHEN event_id = 'Economy:CPI' THEN event_value END), 2) AS avg_cpi,
      COUNT(*) AS samples
    FROM design_events
    WHERE days_elapsed IS NOT NULL
      AND event_id IN ('Economy:GDP', 'Economy:CPI')
    GROUP BY day_bucket
    ORDER BY day_bucket
  `);
  console.log(JSON.stringify(dayBuckets, null, 2));

  await conn.end();
})();
