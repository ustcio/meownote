-- ================================================================================
-- 价格预警容错字段迁移
-- 创建日期：2026-02-20
-- 目的：为 price_alerts 表添加 tolerance 字段
-- ================================================================================

-- 添加 tolerance 字段（容错范围，默认 1.00 元）
ALTER TABLE price_alerts ADD COLUMN tolerance REAL DEFAULT 1.00;

-- 记录迁移日志
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('002', datetime('now'));
