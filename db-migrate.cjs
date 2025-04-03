const { Pool } = require('pg');

// DB接続設定
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 自動マイグレーション実行
async function main() {
  console.log('Running automatic migration...');
  
  // データベーステーブルの作成
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS industry_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS industry_subcategories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category_id UUID NOT NULL REFERENCES industry_categories(id) ON DELETE CASCADE,
        description TEXT NOT NULL DEFAULT '',
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS keywords (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        is_common BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS role_model_industries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_model_id UUID NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
        industry_subcategory_id UUID NOT NULL REFERENCES industry_subcategories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS role_model_keywords (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_model_id UUID NOT NULL REFERENCES role_models(id) ON DELETE CASCADE,
        keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE
      );
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error during migration:', err);
  process.exit(1);
});