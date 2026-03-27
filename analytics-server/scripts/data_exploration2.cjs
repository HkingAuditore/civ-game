const mysql = require("mysql2/promise");
const fs = require("fs");

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

  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

  const results = {};

  results["1_data_overview"] = (await conn.execute(`
    SELECT 
      (SELECT COUNT(*) FROM sessions) AS total_sessions,
      (SELECT COUNT(DISTINCT user_id) FROM sessions) AS total_players,
      (SELECT MIN(started_at) FROM sessions) AS earliest_session,
      (SELECT MAX(started_at) FROM sessions) AS latest_session,
      (SELECT COUNT(*) FROM design_events) AS total_design_events,
      (SELECT COUNT(*) FROM resource_events) AS total_resource_events,
      (SELECT COUNT(*) FROM error_events) AS total_errors
  `))[0];

  results["2_event_categories"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', 1) AS category, COUNT(*) AS cnt
    FROM design_events GROUP BY category ORDER BY cnt DESC
  `))[0];

  results["3_player_stats"] = (await conn.execute(`
    SELECT 
      COUNT(DISTINCT CASE WHEN DATE(started_at) = CURDATE() THEN user_id END) AS today_dau,
      COUNT(DISTINCT CASE WHEN started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN user_id END) AS week_dau,
      COUNT(DISTINCT CASE WHEN last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE) THEN user_id END) AS online_now,
      ROUND(AVG(duration_ms)/3600000, 2) AS avg_session_hours,
      ROUND(SUM(duration_ms)/3600000, 2) AS total_hours
    FROM sessions WHERE duration_ms IS NOT NULL AND duration_ms > 0
  `))[0];

  results["4_economy_stats"] = (await conn.execute(`
    SELECT event_id, COUNT(*) AS samples,
      ROUND(AVG(event_value), 2) AS avg_val,
      ROUND(MIN(event_value), 2) AS min_val,
      ROUND(MAX(event_value), 2) AS max_val
    FROM design_events 
    WHERE event_id IN ('Economy:GDP','Economy:CPI','Economy:PPI','Economy:Treasury','Population:Total','Stability:Level','Military:ArmySize')
    GROUP BY event_id
  `))[0];

  results["5_top_buildings"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS building, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Building:Buy:%' GROUP BY building ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["6_epoch_reach"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS epoch, COUNT(DISTINCT user_id) AS players
    FROM design_events WHERE event_id LIKE 'Epoch:Upgrade:%' GROUP BY epoch ORDER BY players DESC
  `))[0];

  results["7_diplomacy_events"] = (await conn.execute(`
    SELECT
      CASE
        WHEN event_id LIKE 'Diplomacy:Action:%:%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1)
        WHEN event_id LIKE 'Diplomacy:Action:%' THEN 'action_legacy_unknown'
        ELSE SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1)
      END AS action,
      COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Diplomacy:%' GROUP BY action ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["8_military_events"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1) AS action, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Military:%' GROUP BY action ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["9_event_choices_top20"] = (await conn.execute(`
    SELECT event_id, COUNT(*) AS cnt FROM design_events
    WHERE event_id LIKE 'Event:Choose:%' GROUP BY event_id ORDER BY cnt DESC LIMIT 20
  `))[0];

  results["10_econ_flow"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS type, COUNT(*) AS samples,
      ROUND(AVG(event_value), 2) AS avg_per_sample, ROUND(SUM(event_value), 2) AS total
    FROM design_events WHERE event_id LIKE 'EconFlow:%' GROUP BY type ORDER BY total DESC
  `))[0];

  results["11_crisis_events"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS crisis_type, COUNT(*) AS cnt, ROUND(AVG(event_value), 2) AS avg_value
    FROM design_events WHERE event_id LIKE 'Economy:Crisis:%' GROUP BY crisis_type ORDER BY cnt DESC
  `))[0];

  results["12_rebellion_events"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1) AS phase,
      SUBSTRING_INDEX(event_id, ':', -1) AS stratum, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Rebellion:%' GROUP BY phase, stratum ORDER BY cnt DESC LIMIT 20
  `))[0];

  results["13_top_techs"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS tech, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Tech:Research:%' GROUP BY tech ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["14_difficulty"] = (await conn.execute(`
    SELECT event_id, COUNT(*) AS cnt FROM design_events
    WHERE event_id LIKE 'Game:NewGame:%' GROUP BY event_id ORDER BY cnt DESC
  `))[0];

  results["15_top_decrees"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS decree, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Decree:Toggle:%' GROUP BY decree ORDER BY cnt DESC LIMIT 10
  `))[0];

  results["16_achievements"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS achievement, COUNT(*) AS cnt,
      MIN(event_value) AS earliest_day, ROUND(AVG(event_value), 1) AS avg_day
    FROM design_events WHERE event_id LIKE 'Achievement:Unlock:%' GROUP BY achievement ORDER BY cnt DESC LIMIT 20
  `))[0];

  results["17_hardcore_players"] = (await conn.execute(`
    SELECT user_id, ROUND(SUM(duration_ms)/3600000, 2) AS total_hours, COUNT(*) AS sessions, MAX(ended_at) AS last_played
    FROM sessions WHERE duration_ms IS NOT NULL AND duration_ms > 0
    GROUP BY user_id ORDER BY total_hours DESC LIMIT 10
  `))[0];

  results["18_dau_trend"] = (await conn.execute(`
    SELECT DATE(started_at) AS day, COUNT(DISTINCT user_id) AS dau
    FROM sessions WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) GROUP BY day ORDER BY day
  `))[0];

  results["19_starvation"] = (await conn.execute(`
    SELECT COUNT(*) AS total_events, SUM(event_value) AS total_deaths,
      ROUND(AVG(event_value), 1) AS avg_deaths, MAX(event_value) AS max_single_event
    FROM design_events WHERE event_id = 'Population:Starvation'
  `))[0];

  results["20_resource_summary"] = (await conn.execute(`
    SELECT currency, flow_type, COUNT(*) AS cnt, ROUND(SUM(amount), 2) AS total, ROUND(AVG(amount), 2) AS avg
    FROM resource_events GROUP BY currency, flow_type ORDER BY currency, flow_type
  `))[0];

  // === 额外有趣的查询 ===

  results["21_battle_win_rate"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS result, COUNT(*) AS cnt, ROUND(AVG(event_value), 2) AS avg_loss_ratio
    FROM design_events WHERE event_id LIKE 'Military:Battle:Victory%' OR event_id LIKE 'Military:Battle:Defeat%'
    GROUP BY result
  `))[0];

  results["22_tax_changes"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1) AS detail, COUNT(*) AS cnt,
      ROUND(AVG(event_value), 1) AS avg_rate_pct
    FROM design_events WHERE event_id LIKE 'Tax:Change:%' GROUP BY detail ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["23_demand_events"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1) AS demand_type, COUNT(*) AS cnt
    FROM design_events WHERE event_id LIKE 'Demand:%' GROUP BY demand_type ORDER BY cnt DESC
  `))[0];

  results["24_military_recruit_top"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS unit, COUNT(*) AS cnt, SUM(event_value) AS total_recruited
    FROM design_events WHERE event_id LIKE 'Military:Recruit:%' GROUP BY unit ORDER BY cnt DESC LIMIT 10
  `))[0];

  results["25_ideology_usage"] = (await conn.execute(`
    SELECT SUBSTRING_INDEX(event_id, ':', -1) AS ideology, COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Ideology:Equip:%' OR event_id LIKE 'Ideology:Unequip:%'
    GROUP BY ideology ORDER BY cnt DESC LIMIT 15
  `))[0];

  results["26_data_quality"] = (await conn.execute(`
    SELECT
      ROUND(100 * AVG(days_elapsed IS NOT NULL), 2) AS days_coverage_pct,
      ROUND(100 * AVG(player_nation_name IS NOT NULL), 2) AS nation_coverage_pct,
      ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%'), 2) AS diplomacy_action_share_pct,
      ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%' AND event_id NOT LIKE 'Diplomacy:Action:%:%'), 2) AS diplomacy_action_legacy_pct
    FROM design_events
  `))[0];

  results["27_in_game_day_buckets"] = (await conn.execute(`
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
  `))[0];

  fs.writeFileSync("c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/data_report.json", JSON.stringify(results, null, 2));
  console.log("Report saved to data_report.json");
  console.log("Sections:", Object.keys(results).join(", "));
  
  await conn.end();
})();
