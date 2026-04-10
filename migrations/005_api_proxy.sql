-- ================================================================================
-- API Proxy 代理中转系统迁移
-- 创建日期：2026-04-10
-- 目的：支持超级管理员自定义 API 源配置、通道管理、使用统计
-- ================================================================================

-- 源 API 配置表
CREATE TABLE IF NOT EXISTS api_proxy_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_format TEXT DEFAULT 'openai',
  default_model TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 中转通道表
CREATE TABLE IF NOT EXISTS api_proxy_channels (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model_override TEXT,
  rate_limit INTEGER DEFAULT 0,
  daily_quota INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES api_proxy_sources(id) ON DELETE CASCADE
);

-- 使用统计表
CREATE TABLE IF NOT EXISTS api_proxy_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES api_proxy_channels(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sources_active ON api_proxy_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_channels_source ON api_proxy_channels(source_id);
CREATE INDEX IF NOT EXISTS idx_channels_active ON api_proxy_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_channel ON api_proxy_usage(channel_id);
CREATE INDEX IF NOT EXISTS idx_usage_source ON api_proxy_usage(source_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON api_proxy_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_source_date ON api_proxy_usage(source_id, date(created_at));
CREATE INDEX IF NOT EXISTS idx_usage_channel_date ON api_proxy_usage(channel_id, date(created_at));

-- 记录迁移日志
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('005', datetime('now'));
