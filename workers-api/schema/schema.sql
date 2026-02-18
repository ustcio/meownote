-- Meow Note Database Schema
-- Cloudflare D1 (SQLite) Database Schema

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  ip TEXT,
  token TEXT,
  login_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- ============================================
-- Admin Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Visitors Table (Legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Page Views Table
-- ============================================
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  referrer TEXT,
  visitor_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Unique Visitors Table
-- ============================================
CREATE TABLE IF NOT EXISTS unique_visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  date TEXT NOT NULL,
  UNIQUE(visitor_id, date)
);

-- ============================================
-- Files Table
-- ============================================
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  size INTEGER DEFAULT 0,
  storage_path TEXT,
  downloads INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  folder_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Folders Table
-- ============================================
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Audit Logs Table (New)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  user_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Gold Trading Transactions Table
-- ============================================
CREATE TABLE IF NOT EXISTS gold_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  total_amount REAL NOT NULL,
  actual_sell_price REAL,
  profit REAL DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- ============================================
-- Price Alerts Table
-- ============================================
CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('buy', 'sell')),
  target_price REAL NOT NULL,
  current_price REAL,
  is_active INTEGER DEFAULT 1,
  is_triggered INTEGER DEFAULT 0,
  triggered_at DATETIME,
  notification_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Trading Statistics Table
-- ============================================
CREATE TABLE IF NOT EXISTS trading_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  total_buy REAL DEFAULT 0,
  total_sell REAL DEFAULT 0,
  total_quantity REAL DEFAULT 0,
  daily_profit REAL DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Notification Queue Table
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('email', 'web', 'push')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Default Admin User
-- ============================================
-- Password: admin123 (base64 encoded SHA256)
-- Run this after deployment and change password immediately
-- INSERT INTO admin_users (username, password_hash, role) 
-- VALUES ('admin', '<hash>', 'admin');
