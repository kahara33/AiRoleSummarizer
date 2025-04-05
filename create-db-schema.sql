-- ユーザーロールの列挙型
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'editor', 'viewer');

-- ノードタイプの列挙型
CREATE TYPE node_type AS ENUM ('concept', 'industry', 'technology', 'company', 'keyword', 'document');

-- エッジタイプの列挙型
CREATE TYPE edge_type AS ENUM ('relation', 'inclusion', 'dependency', 'influence', 'data-flow');

-- 組織テーブル
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role user_role NOT NULL DEFAULT 'viewer',
  organization_id INTEGER REFERENCES organizations(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ロールモデルテーブル
CREATE TABLE IF NOT EXISTS role_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id INTEGER REFERENCES organizations(id),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 業界テーブル
CREATE TABLE IF NOT EXISTS industries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ロールモデルと業界の中間テーブル
CREATE TABLE IF NOT EXISTS role_model_industries (
  id SERIAL PRIMARY KEY,
  role_model_id INTEGER NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
  industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- キーワードテーブル
CREATE TABLE IF NOT EXISTS keywords (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ロールモデルとキーワードの中間テーブル
CREATE TABLE IF NOT EXISTS role_model_keywords (
  id SERIAL PRIMARY KEY,
  role_model_id INTEGER NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  importance INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 知識ノードテーブル
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type node_type NOT NULL DEFAULT 'concept',
  level INTEGER NOT NULL DEFAULT 0,
  parent_id VARCHAR(255),
  role_model_id INTEGER REFERENCES role_models(id) ON DELETE CASCADE,
  color VARCHAR(7),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 知識エッジテーブル
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id SERIAL PRIMARY KEY,
  source VARCHAR(255) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target VARCHAR(255) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  type edge_type NOT NULL DEFAULT 'relation',
  label VARCHAR(255),
  strength INTEGER NOT NULL DEFAULT 1,
  role_model_id INTEGER NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- バージョン管理テーブル
CREATE TABLE IF NOT EXISTS graph_versions (
  id SERIAL PRIMARY KEY,
  role_model_id INTEGER NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  description TEXT,
  snapshot TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- セッションテーブル (connect-pg-simple用)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- EVERYS組織の追加
INSERT INTO organizations (name, description) 
VALUES ('EVERYS', 'EVERYSは自律型情報収集サービスを提供する組織です。')
ON CONFLICT (name) DO NOTHING;

-- 初期ロールモデルの追加
INSERT INTO role_models (name, description, organization_id, is_public)
SELECT 'デフォルトロールモデル', 'システムのデフォルトロールモデルです。', id, TRUE
FROM organizations
WHERE name = 'EVERYS'
ON CONFLICT DO NOTHING;