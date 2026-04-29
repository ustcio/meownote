-- Workspace server-side sessions
-- Stores only hashed session tokens; browsers receive the raw token in an HttpOnly cookie.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_sessions_expires_at
ON workspace_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_workspace_sessions_revoked_at
ON workspace_sessions(revoked_at);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES ('007', datetime('now'));
