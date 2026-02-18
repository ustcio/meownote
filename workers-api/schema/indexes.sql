-- Meow Note Database Index Optimization Script
-- Run this script in Cloudflare D1 console or via wrangler d1 execute

-- ============================================
-- User Table Indexes
-- ============================================

-- Index for email lookups (login, signup validation)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for token lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- Page Views Table Indexes
-- ============================================

-- Index for date-based queries (heatmap, daily stats)
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);

-- Index for visitor tracking
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON page_views(visitor_id);

-- Composite index for date + visitor queries
CREATE INDEX IF NOT EXISTS idx_page_views_date_visitor ON page_views(date(created_at), visitor_id);

-- ============================================
-- Unique Visitors Table Indexes
-- ============================================

-- Index for date-based UV queries
CREATE INDEX IF NOT EXISTS idx_unique_visitors_date ON unique_visitors(date);

-- Index for visitor_id lookups
CREATE INDEX IF NOT EXISTS idx_unique_visitors_visitor_id ON unique_visitors(visitor_id);

-- Composite index for visitor + date (deduplication check)
CREATE INDEX IF NOT EXISTS idx_unique_visitors_visitor_date ON unique_visitors(visitor_id, date);

-- ============================================
-- Files Table Indexes
-- ============================================

-- Index for folder-based file listings
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- Index for uploader lookups
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);

-- ============================================
-- Folders Table Indexes
-- ============================================

-- Index for parent folder lookups
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- Index for creator lookups
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by);

-- ============================================
-- Visitors Table Indexes (Legacy)
-- ============================================

-- Index for IP + date lookups
CREATE INDEX IF NOT EXISTS idx_visitors_ip_date ON visitors(ip, date);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(date);

-- ============================================
-- Admin Users Table Indexes
-- ============================================

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ============================================
-- Verification Queries
-- ============================================

-- Run these to verify indexes were created:
-- SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name, name;

-- ============================================
-- Performance Analysis Queries
-- ============================================

-- Analyze query performance (run after creating indexes):
-- EXPLAIN QUERY PLAN SELECT * FROM page_views WHERE date(created_at) = date('now');
-- EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';
-- EXPLAIN QUERY PLAN SELECT * FROM unique_visitors WHERE date = date('now');
