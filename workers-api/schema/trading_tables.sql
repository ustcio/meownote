CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('buy', 'sell')),
  target_price REAL NOT NULL,
  current_price REAL,
  is_active INTEGER DEFAULT 1,
  is_triggered INTEGER DEFAULT 0,
  triggered_at DATETIME,
  notification_sent INTEGER DEFAULT 0,
  email_sent INTEGER DEFAULT 0,
  feishu_sent INTEGER DEFAULT 0,
  meow_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS notification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME
);
