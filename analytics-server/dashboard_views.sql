-- ============================================================
-- civ-game 固定看板视图
-- 主题：留存 / 在线 / 时长 / 版本 / 错误
-- 使用方式：在 MySQL 客户端中执行本文件
-- ============================================================

USE civ_analytics;

-- ============================================================
-- 1. 会话宽表：统一在线、时长、闭环状态口径
-- ============================================================

CREATE OR REPLACE VIEW vw_session_metrics AS
SELECT
    s.id,
    s.user_id,
    s.session_id,
    s.app_version,
    s.difficulty,
    s.scenario,
    s.user_agent,
    s.started_at,
    s.last_seen,
    s.ended_at,
    s.duration_ms,
    COALESCE(s.ended_at, s.last_seen, NOW()) AS effective_end_at,
    TIMESTAMPDIFF(SECOND, s.started_at, COALESCE(s.ended_at, s.last_seen, NOW())) AS duration_seconds_est,
    ROUND(TIMESTAMPDIFF(SECOND, s.started_at, COALESCE(s.ended_at, s.last_seen, NOW())) / 60, 1) AS duration_minutes_est,
    CASE
        WHEN s.last_seen >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN 1
        ELSE 0
    END AS is_online_now,
    CASE
        WHEN s.ended_at IS NULL
         AND s.last_seen IS NOT NULL
         AND s.last_seen < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
        THEN 1
        ELSE 0
    END AS is_stale_open
FROM sessions s;

-- ============================================================
-- 2. 用户首日视图：留存 / 新老用户共用
-- ============================================================

CREATE OR REPLACE VIEW vw_user_first_seen_day AS
SELECT
    user_id,
    DATE(MIN(started_at)) AS first_day
FROM sessions
GROUP BY user_id;

-- ============================================================
-- 3. 实时总览
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_overview AS
SELECT
    NOW() AS snapshot_time,
    COUNT(*) AS total_sessions,
    COUNT(DISTINCT user_id) AS total_users,
    SUM(CASE WHEN started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS sessions_24h,
    SUM(CASE WHEN started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS sessions_7d,
    SUM(is_online_now) AS online_sessions_now,
    COUNT(DISTINCT CASE WHEN is_online_now = 1 THEN user_id END) AS online_users_now,
    SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) AS closed_sessions,
    SUM(is_stale_open) AS stale_open_sessions,
    ROUND(AVG(duration_seconds_est) / 60, 1) AS avg_session_minutes,
    ROUND(SUM(duration_seconds_est) / 3600, 2) AS total_session_hours
FROM vw_session_metrics;

-- ============================================================
-- 4. 近 24 小时每小时启动趋势
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_sessions_hourly_24h AS
SELECT
    DATE_FORMAT(started_at, '%Y-%m-%d %H:00:00') AS hour_bucket,
    COUNT(*) AS sessions_started,
    COUNT(DISTINCT user_id) AS users_started
FROM sessions
WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(started_at, '%Y-%m-%d %H:00:00');

-- ============================================================
-- 5. 当前在线用户
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_online_users_now AS
SELECT
    user_id,
    COUNT(*) AS online_sessions,
    MAX(started_at) AS latest_started_at,
    MAX(last_seen) AS latest_last_seen,
    MAX(app_version) AS latest_version
FROM vw_session_metrics
WHERE is_online_now = 1
GROUP BY user_id;

-- ============================================================
-- 6. 日留存视图（D1 / D3 / D7 / D14 / D30）
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_retention_daily AS
SELECT
    f.first_day AS cohort_day,
    COUNT(*) AS cohort_size,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 1 THEN 1 END) AS d1_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 3 THEN 1 END) AS d3_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 7 THEN 1 END) AS d7_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 14 THEN 1 END) AS d14_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 30 THEN 1 END) AS d30_users,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 1 THEN 1 END) / COUNT(*) * 100, 1) AS d1_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 3 THEN 1 END) / COUNT(*) * 100, 1) AS d3_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 7 THEN 1 END) / COUNT(*) * 100, 1) AS d7_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 14 THEN 1 END) / COUNT(*) * 100, 1) AS d14_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.first_day) = 30 THEN 1 END) / COUNT(*) * 100, 1) AS d30_pct
FROM vw_user_first_seen_day f
LEFT JOIN (
    SELECT DISTINCT
        user_id,
        DATE(started_at) AS active_day
    FROM sessions
) a
    ON a.user_id = f.user_id
GROUP BY f.first_day;

-- ============================================================
-- 7. 近 14 天新增 / 回流用户
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_new_returning_14d AS
SELECT
    a.active_day,
    COUNT(*) AS active_users,
    COUNT(CASE WHEN f.first_day = a.active_day THEN 1 END) AS new_users,
    COUNT(CASE WHEN f.first_day < a.active_day THEN 1 END) AS returning_users
FROM (
    SELECT DISTINCT
        user_id,
        DATE(started_at) AS active_day
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
) a
JOIN vw_user_first_seen_day f
    ON f.user_id = a.user_id
GROUP BY a.active_day;

-- ============================================================
-- 8. 每日时长看板
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_duration_daily AS
SELECT
    DATE(started_at) AS day,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users,
    ROUND(AVG(duration_seconds_est) / 60, 1) AS avg_session_minutes,
    ROUND(MAX(duration_seconds_est) / 60, 1) AS max_session_minutes,
    ROUND(SUM(duration_seconds_est) / 3600, 2) AS total_session_hours
FROM vw_session_metrics
GROUP BY DATE(started_at);

-- ============================================================
-- 9. 用户累计时长 Top
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_user_total_hours AS
SELECT
    user_id,
    COUNT(*) AS session_count,
    ROUND(SUM(duration_seconds_est) / 3600, 2) AS total_hours,
    ROUND(AVG(duration_seconds_est) / 60, 1) AS avg_minutes_per_session,
    MIN(started_at) AS first_seen,
    MAX(COALESCE(last_seen, started_at)) AS latest_seen
FROM vw_session_metrics
GROUP BY user_id;

-- ============================================================
-- 10. 时长分桶
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_duration_buckets AS
SELECT
    CASE
        WHEN duration_seconds_est < 60 THEN '<1m'
        WHEN duration_seconds_est < 300 THEN '1-5m'
        WHEN duration_seconds_est < 900 THEN '5-15m'
        WHEN duration_seconds_est < 1800 THEN '15-30m'
        WHEN duration_seconds_est < 3600 THEN '30-60m'
        WHEN duration_seconds_est < 7200 THEN '1-2h'
        ELSE '2h+'
    END AS duration_bucket,
    COUNT(*) AS sessions
FROM vw_session_metrics
GROUP BY
    CASE
        WHEN duration_seconds_est < 60 THEN '<1m'
        WHEN duration_seconds_est < 300 THEN '1-5m'
        WHEN duration_seconds_est < 900 THEN '5-15m'
        WHEN duration_seconds_est < 1800 THEN '15-30m'
        WHEN duration_seconds_est < 3600 THEN '30-60m'
        WHEN duration_seconds_est < 7200 THEN '1-2h'
        ELSE '2h+'
    END;

-- ============================================================
-- 11. 版本总览
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_version_summary AS
SELECT
    COALESCE(app_version, '(null)') AS app_version,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users,
    SUM(is_online_now) AS online_sessions_now,
    ROUND(AVG(duration_seconds_est) / 60, 1) AS avg_session_minutes,
    ROUND(SUM(duration_seconds_est) / 3600, 2) AS total_hours
FROM vw_session_metrics
GROUP BY COALESCE(app_version, '(null)');

-- ============================================================
-- 12. 近 7 天版本趋势
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_version_daily_7d AS
SELECT
    DATE(started_at) AS day,
    COALESCE(app_version, '(null)') AS app_version,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users
FROM sessions
WHERE started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(started_at), COALESCE(app_version, '(null)');

-- ============================================================
-- 13. 近 24 小时版本渗透率
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_version_share_24h AS
SELECT
    v.app_version,
    v.sessions_24h,
    ROUND(v.sessions_24h / t.total_sessions_24h * 100, 1) AS session_share_pct
FROM (
    SELECT
        COALESCE(app_version, '(null)') AS app_version,
        COUNT(*) AS sessions_24h
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY COALESCE(app_version, '(null)')
) v
CROSS JOIN (
    SELECT COUNT(*) AS total_sessions_24h
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
) t;

-- ============================================================
-- 14. 错误级别看板（24h）
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_errors_24h_by_severity AS
SELECT
    severity,
    COUNT(*) AS error_count,
    COUNT(DISTINCT user_id) AS affected_users,
    COUNT(DISTINCT session_id) AS affected_sessions,
    MAX(created_at) AS latest_at
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY severity;

-- ============================================================
-- 15. 错误小时趋势（24h）
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_errors_hourly_24h AS
SELECT
    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour_bucket,
    severity,
    COUNT(*) AS error_count
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00'), severity;

-- ============================================================
-- 16. 高频错误 Top（24h）
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_error_top_24h AS
SELECT
    LEFT(message, 160) AS error_message,
    severity,
    COUNT(*) AS occurrences,
    COUNT(DISTINCT user_id) AS affected_users,
    COUNT(DISTINCT session_id) AS affected_sessions,
    MAX(created_at) AS latest_at
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY LEFT(message, 160), severity;

-- ============================================================
-- 17. 最近错误明细
-- ============================================================

CREATE OR REPLACE VIEW vw_dashboard_error_recent AS
SELECT
    created_at,
    severity,
    session_id,
    user_id,
    LEFT(message, 300) AS message
FROM error_events;
