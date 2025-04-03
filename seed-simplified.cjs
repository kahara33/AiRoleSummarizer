const { Pool } = require('pg');

// DB接続設定
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 主要な業種データ（簡略化）
const INDUSTRY_CATEGORIES = [
  {
    name: "製造業",
    subcategories: ["食品", "電子機器", "自動車", "化学", "機械"]
  },
  {
    name: "情報・通信業",
    subcategories: ["ソフトウェア", "通信", "放送", "インターネットサービス", "データセンター"]
  },
  {
    name: "金融業",
    subcategories: ["銀行", "証券", "保険", "投資", "フィンテック"]
  },
  {
    name: "小売業",
    subcategories: ["総合小売", "専門店", "Eコマース", "コンビニエンスストア"]
  },
  {
    name: "サービス業",
    subcategories: ["ビジネス支援", "エンターテイメント", "教育", "医療", "人材"]
  }
];

// 共通キーワードデータ（簡略化）
const COMMON_KEYWORDS = [
  "AI", "DX", "IoT", "クラウド", "ビッグデータ", 
  "SDGs", "サステナビリティ", "カーボンニュートラル",
  "リモートワーク", "グローバル"
];

async function main() {
  console.log('簡略化された業種・キーワードデータの挿入を開始します...');
  
  try {
    const client = await pool.connect();
    
    try {
      // トランザクション開始
      await client.query('BEGIN');

      console.log('業種大分類を登録中...');
      
      // 業種大分類の挿入
      for (let i = 0; i < INDUSTRY_CATEGORIES.length; i++) {
        const category = INDUSTRY_CATEGORIES[i];
        const categoryResult = await client.query(
          `INSERT INTO industry_categories (name, description, display_order) 
           VALUES ($1, $2, $3) 
           RETURNING id`,
          [category.name, `${category.name}業種カテゴリ`, i + 1]
        );
        
        const categoryId = categoryResult.rows[0].id;
        
        console.log(`  - ${category.name} (${categoryId})`);
        
        // 業種小分類の挿入
        console.log('  業種小分類を登録中...');
        for (let j = 0; j < category.subcategories.length; j++) {
          const subcategory = category.subcategories[j];
          await client.query(
            `INSERT INTO industry_subcategories (name, category_id, description, display_order) 
             VALUES ($1, $2, $3, $4)`,
            [subcategory, categoryId, `${category.name} > ${subcategory}`, j + 1]
          );
          
          console.log(`    - ${subcategory}`);
        }
      }
      
      console.log('共通キーワードを登録中...');
      
      // 共通キーワードの挿入
      for (let i = 0; i < COMMON_KEYWORDS.length; i++) {
        const keyword = COMMON_KEYWORDS[i];
        await client.query(
          `INSERT INTO keywords (name, description, is_common) 
           VALUES ($1, $2, $3)`,
          [keyword, `共通キーワード: ${keyword}`, true]
        );
        
        console.log(`  - ${keyword}`);
      }

      // トランザクションコミット
      await client.query('COMMIT');
      console.log('業種・キーワードデータの挿入が完了しました！');
      
    } catch (e) {
      // エラー発生時はロールバック
      await client.query('ROLLBACK');
      throw e;
    } finally {
      // クライアント解放
      client.release();
    }
    
  } catch (err) {
    console.error('業種・キーワードデータの挿入に失敗しました:', err);
    process.exit(1);
  } finally {
    // 接続プールを終了
    await pool.end();
  }
}

main().catch(err => {
  console.error('予期せぬエラーが発生しました:', err);
  process.exit(1);
});