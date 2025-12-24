-- mite.now D1 Database Schema
-- Users, Subscriptions, Deployments, and Quota Management

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                          -- Google OAuth user_id
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',                     -- 'super_admin' | 'user'
  subscription_tier TEXT DEFAULT 'free',        -- 'free' | 'pro'
  subscription_status TEXT DEFAULT 'active',    -- 'active' | 'canceled' | 'past_due'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  extra_quota_packs INTEGER DEFAULT 0,          -- Number of additional 5-pack quotas purchased
  custom_domain TEXT,                           -- Pro user's 1 custom domain
  custom_domain_verified INTEGER DEFAULT 0,     -- Boolean: 0 or 1
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================
-- Deployments Table
-- ============================================
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  user_id TEXT,                                 -- NULL = anonymous user (legacy)
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT,                           -- Pro user can bind custom domain
  framework TEXT,
  status TEXT,                                  -- 'pending' | 'building' | 'deploying' | 'ready' | 'failed'
  cloud_run_url TEXT,
  has_database INTEGER DEFAULT 0,               -- Boolean: has D1 database
  d1_database_id TEXT,                          -- Associated D1 database ID
  expires_at INTEGER,                           -- Free users: 72 hours TTL, NULL = never expires
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Sessions Table (for auth)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                          -- Session token
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_rotated_at INTEGER,                      -- When session was last rotated
  rotation_count INTEGER DEFAULT 0,             -- Number of times session has been rotated
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_subdomain ON deployments(subdomain);
CREATE INDEX IF NOT EXISTS idx_deployments_expires_at ON deployments(expires_at);
CREATE INDEX IF NOT EXISTS idx_deployments_custom_domain ON deployments(custom_domain);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- Insert Super Admin (backtrue@gmail.com)
-- This will be done via code on first login
-- ============================================
