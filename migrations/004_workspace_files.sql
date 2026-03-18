-- Workspace Files Table
-- 协作办公文件表

CREATE TABLE IF NOT EXISTS workspace_files (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'txt',
  file_url TEXT,
  file_size INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_workspace_updated_at ON workspace_files(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_created_at ON workspace_files(created_at DESC);
