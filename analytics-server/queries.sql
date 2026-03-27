-- ============================================================
-- civ-game 常用分析查询
-- 直接在 MySQL 客户端中运行即可
-- ============================================================

USE civ_analytics;

-- ────────────────────────────────────────────────
-- 1. DAU（日活跃用户数）
-- ────────────────────────────────────────────────

SELECT
    DATE(started_at) AS day,
    COUNT(DISTINCT user_id) AS dau
FROM sessions
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 2. MAU（月活跃用户数）
-- ────────────────────────────────────────────────

SELECT
    DATE_FORMAT(started_at, '%Y-%m') AS month,
    COUNT(DISTINCT user_id) AS mau
FROM sessions
GROUP BY month
ORDER BY month DESC
LIMIT 12;

-- ────────────────────────────────────────────────
-- 3. 平均会话时长（分钟）
-- ────────────────────────────────────────────────

SELECT
    DATE(started_at) AS day,
    ROUND(AVG(duration_ms) / 60000, 1) AS avg_minutes,
    ROUND(MAX(duration_ms) / 60000, 1) AS max_minutes,
    COUNT(*) AS sessions
FROM sessions
WHERE duration_ms IS NOT NULL
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 4. 每个玩家的总游戏时长（小时）
-- ────────────────────────────────────────────────

SELECT
    user_id,
    ROUND(SUM(duration_ms) / 3600000, 2) AS total_hours,
    COUNT(*) AS session_count,
    MIN(started_at) AS first_seen,
    MAX(started_at) AS last_seen
FROM sessions
WHERE duration_ms IS NOT NULL
GROUP BY user_id
ORDER BY total_hours DESC
LIMIT 100;

-- ────────────────────────────────────────────────
-- 5. D1/D7/D30 留存率
-- ────────────────────────────────────────────────

WITH first_day AS (
    SELECT user_id, DATE(MIN(started_at)) AS cohort_day
    FROM sessions
    GROUP BY user_id
),
activity AS (
    SELECT DISTINCT s.user_id, DATE(s.started_at) AS active_day
    FROM sessions s
)
SELECT
    f.cohort_day,
    COUNT(DISTINCT f.user_id) AS cohort_size,
    COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 1 THEN f.user_id END) AS d1,
    COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 7 THEN f.user_id END) AS d7,
    COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 30 THEN f.user_id END) AS d30,
    ROUND(COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 1 THEN f.user_id END) / COUNT(DISTINCT f.user_id) * 100, 1) AS d1_pct,
    ROUND(COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 7 THEN f.user_id END) / COUNT(DISTINCT f.user_id) * 100, 1) AS d7_pct,
    ROUND(COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 30 THEN f.user_id END) / COUNT(DISTINCT f.user_id) * 100, 1) AS d30_pct
FROM first_day f
LEFT JOIN activity a ON a.user_id = f.user_id
GROUP BY f.cohort_day
ORDER BY f.cohort_day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 6. 最热门建筑（购买次数）
-- ────────────────────────────────────────────────

SELECT
    SUBSTRING_INDEX(event_id, ':', -1) AS building,
    COUNT(*) AS buy_count,
    ROUND(AVG(event_value), 0) AS avg_cost
FROM design_events
WHERE event_id LIKE 'Building:Buy:%'
GROUP BY building
ORDER BY buy_count DESC
LIMIT 20;

-- ────────────────────────────────────────────────
-- 7. 最常研究的科技
-- ────────────────────────────────────────────────

SELECT
    SUBSTRING_INDEX(event_id, ':', -1) AS tech,
    COUNT(*) AS research_count,
    ROUND(AVG(event_value), 0) AS avg_science_cost
FROM design_events
WHERE event_id LIKE 'Tech:Research:%'
GROUP BY tech
ORDER BY research_count DESC
LIMIT 20;

-- ────────────────────────────────────────────────
-- 8. 事件选项偏好
-- ────────────────────────────────────────────────

SELECT
    event_id,
    COUNT(*) AS choose_count
FROM design_events
WHERE event_id LIKE 'Event:Choose:%'
GROUP BY event_id
ORDER BY choose_count DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 9. GDP 趋势（每日平均）
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    ROUND(AVG(event_value), 0) AS avg_gdp,
    ROUND(MIN(event_value), 0) AS min_gdp,
    ROUND(MAX(event_value), 0) AS max_gdp,
    COUNT(*) AS samples
FROM design_events
WHERE event_id = 'Economy:GDP'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 10. CPI / PPI 趋势
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    ROUND(AVG(CASE WHEN event_id = 'Economy:CPI' THEN event_value END), 2) AS avg_cpi,
    ROUND(AVG(CASE WHEN event_id = 'Economy:PPI' THEN event_value END), 2) AS avg_ppi
FROM design_events
WHERE event_id IN ('Economy:CPI', 'Economy:PPI')
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 11. 市场商品价格趋势
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    ROUND(AVG(CASE WHEN event_id = 'Price:food' THEN event_value END), 2) AS food,
    ROUND(AVG(CASE WHEN event_id = 'Price:wood' THEN event_value END), 2) AS wood,
    ROUND(AVG(CASE WHEN event_id = 'Price:stone' THEN event_value END), 2) AS stone,
    ROUND(AVG(CASE WHEN event_id = 'Price:iron' THEN event_value END), 2) AS iron,
    ROUND(AVG(CASE WHEN event_id = 'Price:cloth' THEN event_value END), 2) AS cloth,
    ROUND(AVG(CASE WHEN event_id = 'Price:tools' THEN event_value END), 2) AS tools
FROM design_events
WHERE event_id LIKE 'Price:%'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 12. 人口增长趋势
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    ROUND(AVG(event_value), 0) AS avg_population,
    ROUND(MAX(event_value), 0) AS max_population
FROM design_events
WHERE event_id = 'Population:Total'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 13. 经济收支结构
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    ROUND(AVG(CASE WHEN event_id = 'EconFlow:Tax' THEN event_value END), 0) AS tax_income,
    ROUND(AVG(CASE WHEN event_id = 'EconFlow:Trade' THEN event_value END), 0) AS trade_income,
    ROUND(AVG(CASE WHEN event_id = 'EconFlow:Military' THEN event_value END), 0) AS military_cost,
    ROUND(AVG(CASE WHEN event_id = 'EconFlow:Building' THEN event_value END), 0) AS building_cost,
    ROUND(AVG(CASE WHEN event_id = 'EconFlow:Official' THEN event_value END), 0) AS official_cost
FROM design_events
WHERE event_id LIKE 'EconFlow:%'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 14. 时代进度漏斗（到达每个时代的玩家数）
-- ────────────────────────────────────────────────

SELECT
    SUBSTRING_INDEX(event_id, ':', -1) AS epoch,
    COUNT(DISTINCT user_id) AS players
FROM design_events
WHERE event_id LIKE 'Epoch:Upgrade:%'
GROUP BY epoch
ORDER BY players DESC;

-- ────────────────────────────────────────────────
-- 15. 难度分布
-- ────────────────────────────────────────────────

SELECT
    difficulty,
    COUNT(*) AS session_count,
    COUNT(DISTINCT user_id) AS player_count
FROM sessions
WHERE difficulty IS NOT NULL
GROUP BY difficulty
ORDER BY session_count DESC;

-- 16 已移除（UI 事件不再采集）

-- ────────────────────────────────────────────────
-- 16.1 核心字段上报完整度（最近7天）
-- ────────────────────────────────────────────────

SELECT
    ROUND(100 * AVG(days_elapsed IS NOT NULL), 2) AS days_coverage_pct,
    ROUND(100 * AVG(player_nation_name IS NOT NULL), 2) AS nation_coverage_pct
FROM design_events
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY);

-- ────────────────────────────────────────────────
-- 16.2 按玩家国家统计行为量（最近7天）
-- ────────────────────────────────────────────────

SELECT
    COALESCE(player_nation_name, 'unknown') AS player_nation,
    COUNT(*) AS event_count
FROM design_events
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY player_nation
ORDER BY event_count DESC;

-- ────────────────────────────────────────────────
-- 16.3 局内天数分层：核心经济指标（按30天桶）
-- ────────────────────────────────────────────────

SELECT
    FLOOR(days_elapsed / 30) * 30 AS day_bucket,
    ROUND(AVG(CASE WHEN event_id = 'Economy:GDP' THEN event_value END), 0) AS avg_gdp,
    ROUND(AVG(CASE WHEN event_id = 'Economy:CPI' THEN event_value END), 2) AS avg_cpi,
    ROUND(AVG(CASE WHEN event_id = 'Economy:PPI' THEN event_value END), 2) AS avg_ppi,
    ROUND(AVG(CASE WHEN event_id = 'Stability:Level' THEN event_value END), 2) AS avg_stability,
    ROUND(AVG(CASE WHEN event_id = 'Population:Total' THEN event_value END), 0) AS avg_population,
    COUNT(*) AS samples
FROM design_events
WHERE days_elapsed IS NOT NULL
  AND event_id IN ('Economy:GDP', 'Economy:CPI', 'Economy:PPI', 'Stability:Level', 'Population:Total')
GROUP BY day_bucket
ORDER BY day_bucket;

-- ────────────────────────────────────────────────
-- 16.4 难度分层：CPI 与破产率（按30天桶）
-- ────────────────────────────────────────────────

SELECT
    COALESCE(s.difficulty, 'unknown') AS difficulty,
    FLOOR(d.days_elapsed / 30) * 30 AS day_bucket,
    ROUND(AVG(CASE WHEN d.event_id = 'Economy:CPI' THEN d.event_value END), 2) AS avg_cpi,
    SUM(CASE WHEN d.event_id = 'Economy:Crisis:bankruptcy' THEN 1 ELSE 0 END) AS bankruptcy_events,
    COUNT(*) AS samples
FROM design_events d
LEFT JOIN sessions s ON s.session_id = d.session_id
WHERE d.days_elapsed IS NOT NULL
  AND d.event_id IN ('Economy:CPI', 'Economy:Crisis:bankruptcy')
GROUP BY difficulty, day_bucket
ORDER BY difficulty, day_bucket;

-- ────────────────────────────────────────────────
-- 16.5 指定国家局内物价（按30天桶，替换国家名）
-- ────────────────────────────────────────────────

SELECT
    FLOOR(days_elapsed / 30) * 30 AS day_bucket,
    SUBSTRING_INDEX(event_id, ':', -1) AS resource,
    ROUND(AVG(event_value), 2) AS avg_price,
    COUNT(*) AS samples
FROM design_events
WHERE event_id LIKE 'Price:%'
  AND player_nation_name = '***'
  AND days_elapsed IS NOT NULL
GROUP BY day_bucket, resource
ORDER BY day_bucket, resource;

-- ────────────────────────────────────────────────
-- 16.6 外交动作兼容解析 + 旧格式占比
-- ────────────────────────────────────────────────

SELECT
    CASE
        WHEN event_id LIKE 'Diplomacy:Action:%:%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1)
        WHEN event_id LIKE 'Diplomacy:Action:%' THEN 'action_legacy_unknown'
        ELSE SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1)
    END AS action,
    COUNT(*) AS cnt
FROM design_events
WHERE event_id LIKE 'Diplomacy:%'
GROUP BY action
ORDER BY cnt DESC
LIMIT 30;

SELECT
    ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%'), 2) AS diplomacy_action_share_pct,
    ROUND(100 * AVG(event_id LIKE 'Diplomacy:Action:%' AND event_id NOT LIKE 'Diplomacy:Action:%:%'), 2) AS diplomacy_action_legacy_pct
FROM design_events
WHERE event_id LIKE 'Diplomacy:%';

-- ────────────────────────────────────────────────
-- 17. 错误统计（按严重级别）
-- ────────────────────────────────────────────────

SELECT
    severity,
    COUNT(*) AS error_count,
    COUNT(DISTINCT user_id) AS affected_users
FROM error_events
GROUP BY severity
ORDER BY FIELD(severity, 'critical', 'error', 'warning', 'info', 'debug');

-- ────────────────────────────────────────────────
-- 18. 最常见错误 Top 20
-- ────────────────────────────────────────────────

SELECT
    LEFT(message, 120) AS error_msg,
    severity,
    COUNT(*) AS occurrences,
    COUNT(DISTINCT user_id) AS affected_users,
    MAX(created_at) AS last_seen
FROM error_events
WHERE severity IN ('error', 'critical')
GROUP BY error_msg, severity
ORDER BY occurrences DESC
LIMIT 20;

-- ────────────────────────────────────────────────
-- 19. 资源收支平衡（silver）
-- ────────────────────────────────────────────────

SELECT
    DATE(created_at) AS day,
    SUM(CASE WHEN flow_type = 'source' THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN flow_type = 'sink' THEN amount ELSE 0 END) AS total_expense,
    SUM(CASE WHEN flow_type = 'source' THEN amount ELSE -amount END) AS net_flow
FROM resource_events
WHERE currency = 'silver'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ────────────────────────────────────────────────
-- 20. 叛乱事件统计
-- ────────────────────────────────────────────────

SELECT
    event_id,
    COUNT(*) AS occurrences,
    COUNT(DISTINCT user_id) AS affected_players
FROM design_events
WHERE event_id LIKE 'Organization:Phase:%'
   OR event_id LIKE 'Rebellion:%'
GROUP BY event_id
ORDER BY occurrences DESC;
