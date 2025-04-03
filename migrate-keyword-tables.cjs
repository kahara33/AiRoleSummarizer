const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('データベースマイグレーションを開始します...');
    // トランザクションを開始
    await pool.query('BEGIN');

    // ここに追加するテーブルのSQL文を記述
    const tables = [
      // キーワードマスター（拡張）
      `ALTER TABLE keywords 
       ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
       ADD COLUMN IF NOT EXISTS parent_id UUID,
       ADD COLUMN IF NOT EXISTS created_by UUID,
       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`,
      
      // キーワード同義語・関連語テーブル
      `CREATE TABLE IF NOT EXISTS keyword_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        target_keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        strength INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (source_keyword_id, target_keyword_id)
      )`,
      
      // キーワード分野タグテーブル
      `CREATE TABLE IF NOT EXISTS keyword_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        color TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // キーワードと分野タグの関連付けテーブル
      `CREATE TABLE IF NOT EXISTS keyword_field_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        field_id UUID NOT NULL REFERENCES keyword_fields(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (keyword_id, field_id)
      )`,
      
      // 業界とキーワードの関連度テーブル
      `CREATE TABLE IF NOT EXISTS industry_keyword_relevance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        industry_subcategory_id UUID NOT NULL REFERENCES industry_subcategories(id) ON DELETE CASCADE,
        keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (industry_subcategory_id, keyword_id)
      )`,
      
      // よく使われる業界組み合わせを保存するテーブル
      `CREATE TABLE IF NOT EXISTS industry_combinations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_shared BOOLEAN NOT NULL DEFAULT FALSE,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // 業界組み合わせの詳細
      `CREATE TABLE IF NOT EXISTS industry_combination_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        combination_id UUID NOT NULL REFERENCES industry_combinations(id) ON DELETE CASCADE,
        industry_subcategory_id UUID NOT NULL REFERENCES industry_subcategories(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (combination_id, industry_subcategory_id)
      )`,
      
      // よく使われるキーワード組み合わせを保存するテーブル
      `CREATE TABLE IF NOT EXISTS keyword_collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_shared BOOLEAN NOT NULL DEFAULT FALSE,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )`,
      
      // キーワード組み合わせの詳細
      `CREATE TABLE IF NOT EXISTS keyword_collection_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES keyword_collections(id) ON DELETE CASCADE,
        keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE (collection_id, keyword_id)
      )`
    ];

    // 順番にテーブル作成クエリを実行
    for (const sql of tables) {
      console.log(`以下のSQLを実行: ${sql.substr(0, 70)}...`);
      await pool.query(sql);
    }

    // トランザクションをコミット
    await pool.query('COMMIT');
    console.log('マイグレーションが正常に完了しました。');
  } catch (error) {
    // エラーが発生した場合はロールバック
    await pool.query('ROLLBACK');
    console.error('マイグレーションに失敗しました:', error);
    process.exit(1);
  } finally {
    // 接続を終了
    await pool.end();
  }
}

main();