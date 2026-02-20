-- ================================================================================
-- AI 分析结果表迁移
-- 创建日期：2026-02-20
-- 目的：持久化 AI 分析结果，支持历史查询和回测
-- ================================================================================

-- 创建 AI 分析结果表
CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  trend TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0,
  signals TEXT,  -- JSON 格式存储信号列表
  recommendation TEXT,
  risk_level TEXT DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为 AI 分析结果表添加索引
CREATE INDEX IF NOT EXISTS idx_ai_analysis_timestamp 
ON ai_analysis_results(timestamp);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_trend 
ON ai_analysis_results(trend);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_price 
ON ai_analysis_results(price);

-- 创建预警历史表
CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  session TEXT,
  direction TEXT,
  price REAL,
  alert_type TEXT,
  alert_message TEXT,
  score INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  level3_metadata TEXT,  -- JSON 格式存储 Level 3 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为预警历史表添加索引
CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp 
ON alert_history(timestamp);

CREATE INDEX IF NOT EXISTS idx_alert_history_session 
ON alert_history(session);

CREATE INDEX IF NOT EXISTS idx_alert_history_direction 
ON alert_history(direction);

-- 记录迁移日志
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('003', datetime('now'));
