-- ================================================================================
-- 数据库索引优化迁移
-- 创建日期：2026-02-19
-- 目的：提升 AI 分析查询性能，减少延迟
-- ================================================================================

-- 为 gold_price_history 表添加索引
-- 优化按日期和时间戳查询的性能
CREATE INDEX IF NOT EXISTS idx_gold_price_date 
ON gold_price_history(date, timestamp);

CREATE INDEX IF NOT EXISTS idx_gold_price_timestamp 
ON gold_price_history(timestamp);

-- 为 gold_transactions 表添加索引
-- 优化按交易类型、创建时间、状态查询的性能
CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON gold_transactions(type);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON gold_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON gold_transactions(status);

-- 复合索引：优化按类型和时间范围查询
CREATE INDEX IF NOT EXISTS idx_transactions_type_created_at 
ON gold_transactions(type, created_at);

-- 复合索引：优化按日期和价格查询（用于回测）
CREATE INDEX IF NOT EXISTS idx_gold_price_date_price 
ON gold_price_history(date, price);

-- 记录迁移日志
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('001', datetime('now'));
