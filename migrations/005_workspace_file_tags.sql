-- Workspace file tags
-- 为 workspace_files 增加 tag 字段

ALTER TABLE workspace_files ADD COLUMN tag TEXT DEFAULT '';
