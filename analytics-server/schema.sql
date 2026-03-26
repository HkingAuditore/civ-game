-- ============================================================
-- civ-game 自建分析后端 — MySQL Schema
-- 运行方式: mysql -u root -p civ_analytics < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS civ_analytics
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE civ_analytics;

-- ── 会话表 ──

CREATE TABLE IF NOT EXISTS sessions (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    session_id  VARCHAR(64)  NOT NULL,
    app_version VARCHAR(32)  DEFAULT NULL,
    difficulty  VARCHAR(32)  DEFAULT NULL,
    scenario    VARCHAR(64)  DEFAULT NULL,
    user_agent  TEXT         DEFAULT NULL,
    started_at  DATETIME     NOT NULL,
    ended_at    DATETIME     DEFAULT NULL,
    last_seen   DATETIME     DEFAULT NULL,
    duration_ms INT UNSIGNED DEFAULT NULL,

    UNIQUE KEY uk_session (session_id),
    INDEX idx_user      (user_id),
    INDEX idx_started   (started_at),
    INDEX idx_last_seen (last_seen)
) ENGINE=InnoDB;

-- ── 设计事件表（Design Events）──

CREATE TABLE IF NOT EXISTS design_events (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       VARCHAR(64)   NOT NULL,
    session_id    VARCHAR(64)   NOT NULL,
    event_id      VARCHAR(128)  NOT NULL COMMENT '层级事件名，如 Building:Buy:farm',
    event_value   DOUBLE        DEFAULT NULL,
    epoch         VARCHAR(32)   DEFAULT NULL,
    days_elapsed  INT           DEFAULT NULL,
    created_at    DATETIME      NOT NULL,

    INDEX idx_user       (user_id),
    INDEX idx_session    (session_id),
    INDEX idx_event      (event_id),
    INDEX idx_created    (created_at),
    INDEX idx_event_time (event_id, created_at)
) ENGINE=InnoDB;

-- ── 资源事件表（Resource Events）──

CREATE TABLE IF NOT EXISTS resource_events (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    session_id  VARCHAR(64)  NOT NULL,
    flow_type   ENUM('source','sink') NOT NULL,
    currency    VARCHAR(32)  NOT NULL COMMENT 'silver / science / culture',
    amount      INT          NOT NULL DEFAULT 0,
    item_type   VARCHAR(32)  DEFAULT NULL COMMENT 'tax / trade / building / military …',
    item_id     VARCHAR(64)  DEFAULT NULL,
    created_at  DATETIME     NOT NULL,

    INDEX idx_user     (user_id),
    INDEX idx_session  (session_id),
    INDEX idx_currency (currency, flow_type),
    INDEX idx_created  (created_at)
) ENGINE=InnoDB;

-- ── 错误事件表（Error Events）──

CREATE TABLE IF NOT EXISTS error_events (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64)   NOT NULL,
    session_id  VARCHAR(64)   NOT NULL,
    severity    VARCHAR(16)   NOT NULL COMMENT 'debug / info / warning / error / critical',
    message     TEXT          NOT NULL,
    created_at  DATETIME      NOT NULL,

    INDEX idx_user     (user_id),
    INDEX idx_session  (session_id),
    INDEX idx_severity (severity),
    INDEX idx_created  (created_at)
) ENGINE=InnoDB;
