-- ============================================================
-- civ-game 固定看板 SQL
-- 主题：留存 / 在线 / 时长 / 版本 / 错误
-- 使用方式：直接在 MySQL 客户端中逐段执行
-- ============================================================

USE civ_analytics;

-- 在线口径说明
-- 1. 当前在线：last_seen 在最近 3 分钟内
-- 2. 会话时长：started_at -> COALESCE(ended_at, last_seen, NOW())
-- 3. 已掉线未结算：ended_at IS NULL 且 last_seen 早于 3 分钟前

-- ============================================================
-- A1. 实时总览
-- ============================================================

SELECT
    NOW() AS snapshot_time,
    COUNT(*) AS total_sessions,
    COUNT(DISTINCT user_id) AS total_users,
    SUM(CASE WHEN started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS sessions_24h,
    SUM(CASE WHEN started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS sessions_7d,
    SUM(CASE WHEN last_seen >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN 1 ELSE 0 END) AS online_sessions_now,
    COUNT(DISTINCT CASE WHEN last_seen >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN user_id END) AS online_users_now,
    SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) AS closed_sessions,
    SUM(
        CASE
            WHEN ended_at IS NULL
             AND last_seen IS NOT NULL
             AND last_seen < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
            THEN 1 ELSE 0
        END
    ) AS stale_open_sessions
FROM sessions;

-- ============================================================
-- A2. 近 24 小时每小时启动趋势
-- ============================================================

SELECT
    DATE_FORMAT(started_at, '%Y-%m-%d %H:00:00') AS hour_bucket,
    COUNT(*) AS sessions_started,
    COUNT(DISTINCT user_id) AS users_started
FROM sessions
WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

-- ============================================================
-- A3. 当前在线用户 Top（按最近活跃时间）
-- ============================================================

SELECT
    user_id,
    COUNT(*) AS online_sessions,
    MAX(started_at) AS latest_started_at,
    MAX(last_seen) AS latest_last_seen,
    MAX(app_version) AS latest_version
FROM sessions
WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 3 MINUTE)
GROUP BY user_id
ORDER BY latest_last_seen DESC
LIMIT 100;

-- ============================================================
-- B1. 日 Cohort 留存（D1 / D3 / D7 / D14 / D30）
-- ============================================================

WITH first_day AS (
    SELECT
        user_id,
        DATE(MIN(started_at)) AS cohort_day
    FROM sessions
    GROUP BY user_id
),
activity_day AS (
    SELECT DISTINCT
        user_id,
        DATE(started_at) AS active_day
    FROM sessions
)
SELECT
    f.cohort_day,
    COUNT(*) AS cohort_size,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 1 THEN 1 END) AS d1_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 3 THEN 1 END) AS d3_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 7 THEN 1 END) AS d7_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 14 THEN 1 END) AS d14_users,
    COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 30 THEN 1 END) AS d30_users,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 1 THEN 1 END) / COUNT(*) * 100, 1) AS d1_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 3 THEN 1 END) / COUNT(*) * 100, 1) AS d3_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 7 THEN 1 END) / COUNT(*) * 100, 1) AS d7_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 14 THEN 1 END) / COUNT(*) * 100, 1) AS d14_pct,
    ROUND(COUNT(CASE WHEN DATEDIFF(a.active_day, f.cohort_day) = 30 THEN 1 END) / COUNT(*) * 100, 1) AS d30_pct
FROM first_day f
LEFT JOIN activity_day a
    ON a.user_id = f.user_id
GROUP BY f.cohort_day
ORDER BY f.cohort_day DESC
LIMIT 60;

-- ============================================================
-- B2. 近 14 天新增用户与回流用户
-- 说明：returning_users = 当天活跃但注册日早于当天
-- ============================================================

WITH first_day AS (
    SELECT
        user_id,
        DATE(MIN(started_at)) AS first_day
    FROM sessions
    GROUP BY user_id
),
active_day AS (
    SELECT DISTINCT
        user_id,
        DATE(started_at) AS active_day
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
)
SELECT
    a.active_day,
    COUNT(*) AS active_users,
    COUNT(CASE WHEN f.first_day = a.active_day THEN 1 END) AS new_users,
    COUNT(CASE WHEN f.first_day < a.active_day THEN 1 END) AS returning_users
FROM active_day a
JOIN first_day f
    ON f.user_id = a.user_id
GROUP BY a.active_day
ORDER BY a.active_day DESC;

-- ============================================================
-- C1. 每日时长看板
-- ============================================================

SELECT
    DATE(started_at) AS day,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users,
    ROUND(AVG(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 60, 1) AS avg_session_minutes,
    ROUND(MAX(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 60, 1) AS max_session_minutes,
    ROUND(SUM(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 3600, 2) AS total_session_hours
FROM sessions
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- ============================================================
-- C2. 用户累计时长 Top 100
-- ============================================================

SELECT
    user_id,
    COUNT(*) AS session_count,
    ROUND(SUM(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 3600, 2) AS total_hours,
    ROUND(AVG(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 60, 1) AS avg_minutes_per_session,
    MIN(started_at) AS first_seen,
    MAX(COALESCE(last_seen, started_at)) AS latest_seen
FROM sessions
GROUP BY user_id
ORDER BY total_hours DESC
LIMIT 100;

-- ============================================================
-- C3. 时长分桶
-- ============================================================

WITH session_lengths AS (
    SELECT
        TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW())) AS duration_seconds
    FROM sessions
)
SELECT
    CASE
        WHEN duration_seconds < 60 THEN '<1m'
        WHEN duration_seconds < 300 THEN '1-5m'
        WHEN duration_seconds < 900 THEN '5-15m'
        WHEN duration_seconds < 1800 THEN '15-30m'
        WHEN duration_seconds < 3600 THEN '30-60m'
        WHEN duration_seconds < 7200 THEN '1-2h'
        ELSE '2h+'
    END AS duration_bucket,
    COUNT(*) AS sessions
FROM session_lengths
GROUP BY duration_bucket
ORDER BY
    FIELD(duration_bucket, '<1m', '1-5m', '5-15m', '15-30m', '30-60m', '1-2h', '2h+');

-- ============================================================
-- D1. 版本总览
-- ============================================================

SELECT
    COALESCE(app_version, '(null)') AS app_version,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users,
    SUM(CASE WHEN last_seen >= DATE_SUB(NOW(), INTERVAL 3 MINUTE) THEN 1 ELSE 0 END) AS online_sessions_now,
    ROUND(AVG(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 60, 1) AS avg_session_minutes,
    ROUND(SUM(TIMESTAMPDIFF(SECOND, started_at, COALESCE(ended_at, last_seen, NOW()))) / 3600, 2) AS total_hours
FROM sessions
GROUP BY COALESCE(app_version, '(null)')
ORDER BY sessions DESC;

-- ============================================================
-- D2. 近 7 天版本趋势
-- ============================================================

SELECT
    DATE(started_at) AS day,
    COALESCE(app_version, '(null)') AS app_version,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_id) AS users
FROM sessions
WHERE started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY day, COALESCE(app_version, '(null)')
ORDER BY day DESC, sessions DESC;

-- ============================================================
-- D3. 最新版本渗透率
-- 说明：按最近 24 小时会话计算
-- ============================================================

WITH version_24h AS (
    SELECT
        COALESCE(app_version, '(null)') AS app_version,
        COUNT(*) AS sessions_24h
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY COALESCE(app_version, '(null)')
),
total_24h AS (
    SELECT COUNT(*) AS total_sessions_24h
    FROM sessions
    WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
)
SELECT
    v.app_version,
    v.sessions_24h,
    ROUND(v.sessions_24h / t.total_sessions_24h * 100, 1) AS session_share_pct
FROM version_24h v
CROSS JOIN total_24h t
ORDER BY v.sessions_24h DESC;

-- ============================================================
-- E1. 错误级别看板（24h）
-- ============================================================

SELECT
    severity,
    COUNT(*) AS error_count,
    COUNT(DISTINCT user_id) AS affected_users,
    COUNT(DISTINCT session_id) AS affected_sessions,
    MAX(created_at) AS latest_at
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY severity
ORDER BY FIELD(severity, 'critical', 'error', 'warning', 'info', 'debug');

-- ============================================================
-- E2. 错误趋势（按小时，近 24h）
-- ============================================================

SELECT
    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour_bucket,
    severity,
    COUNT(*) AS error_count
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY hour_bucket, severity
ORDER BY hour_bucket DESC, FIELD(severity, 'critical', 'error', 'warning', 'info', 'debug');

-- ============================================================
-- E3. 高频错误 Top 20（24h）
-- ============================================================

SELECT
    LEFT(message, 160) AS error_message,
    severity,
    COUNT(*) AS occurrences,
    COUNT(DISTINCT user_id) AS affected_users,
    COUNT(DISTINCT session_id) AS affected_sessions,
    MAX(created_at) AS latest_at
FROM error_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY LEFT(message, 160), severity
ORDER BY occurrences DESC, latest_at DESC
LIMIT 20;

-- ============================================================
-- E4. 最近错误明细
-- ============================================================

SELECT
    created_at,
    severity,
    session_id,
    user_id,
    LEFT(message, 300) AS message
FROM error_events
ORDER BY created_at DESC
LIMIT 50;
