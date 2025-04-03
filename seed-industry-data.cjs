const { Pool } = require('pg');

// DB接続設定
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 東洋経済新報社の業種分類をベースにした業種データ
const INDUSTRY_CATEGORIES = [
  {
    name: "水産・農林業",
    subcategories: ["水産", "農業", "林業"]
  },
  {
    name: "鉱業",
    subcategories: ["石炭鉱業", "金属鉱業", "原油・天然ガス", "採石業", "その他鉱業"]
  },
  {
    name: "建設業",
    subcategories: ["建設", "住宅", "設備工事", "土木", "道路", "鉄道"]
  },
  {
    name: "食料品",
    subcategories: ["水産加工", "製粉", "製糖", "食油", "製菓", "製パン", "乳製品", "食肉加工", "調味料", "冷凍食品", "レトルト食品"]
  },
  {
    name: "繊維製品",
    subcategories: ["綿紡績", "化学繊維", "毛織物", "ニット", "レース・繊維二次製品", "絹紡績", "その他繊維製品"]
  },
  {
    name: "パルプ・紙",
    subcategories: ["パルプ", "洋紙", "板紙", "紙加工品"]
  },
  {
    name: "化学",
    subcategories: ["無機化学", "有機化学", "化学肥料", "化学繊維", "油脂・洗剤", "医薬品", "化粧品", "塗料", "合成樹脂", "写真感光材料"]
  },
  {
    name: "石油・石炭製品",
    subcategories: ["石油精製", "石油販売", "石炭製品", "コークス"]
  },
  {
    name: "ゴム製品",
    subcategories: ["タイヤ", "ゴムベルト", "ゴムホース", "医療・衛生用ゴム製品"]
  },
  {
    name: "ガラス・土石製品",
    subcategories: ["ガラス", "セメント", "セラミックス", "耐火物", "炭素・黒鉛製品", "アスベスト製品"]
  },
  {
    name: "鉄鋼",
    subcategories: ["銑鉄", "粗鋼", "熱間圧延鋼材", "冷間圧延鋼材", "めっき鋼材", "鋳鉄管", "鋳鍛鋼", "鉄鋼二次製品"]
  },
  {
    name: "非鉄金属",
    subcategories: ["銅", "アルミニウム", "鉛・亜鉛", "貴金属", "電線ケーブル", "非鉄金属加工品"]
  },
  {
    name: "金属製品",
    subcategories: ["建築用金属製品", "プレス・板金製品", "鉄骨", "金属容器", "ボルト・ナット類", "金属素形材製品", "金型", "金属工具", "ガス・石油機器"]
  },
  {
    name: "機械",
    subcategories: ["ボイラ・原動機", "農業・建設機械", "金属加工機械", "繊維機械", "事務用機械", "荷役運搬機械", "冷凍機・空調機", "ポンプ・圧縮機", "ベアリング", "動力伝導装置", "工作機械"]
  },
  {
    name: "電気機器",
    subcategories: ["発電機・電動機", "変圧器", "配電盤", "太陽電池", "産業用電気機器", "電気照明器具", "電池", "半導体", "電子部品", "集積回路", "デジタル家電", "通信機器", "計測機器", "医療用電子機器"]
  },
  {
    name: "輸送用機器",
    subcategories: ["自動車", "自動車部品", "二輪車", "自転車", "船舶", "航空機", "鉄道車両", "特殊車両"]
  },
  {
    name: "精密機器",
    subcategories: ["計測器", "医療機器", "光学機械", "時計", "カメラ", "眼鏡"]
  },
  {
    name: "その他製品",
    subcategories: ["貴金属製品", "楽器", "玩具", "運動用具", "文房具", "レジャー用品", "プラスチック製品"]
  },
  {
    name: "電気・ガス業",
    subcategories: ["電力", "ガス"]
  },
  {
    name: "陸運業",
    subcategories: ["鉄道", "バス・タクシー", "トラック", "倉庫・運輸関連", "運輸・物流"]
  },
  {
    name: "海運業",
    subcategories: ["外航海運", "内航海運", "海運業者"]
  },
  {
    name: "空運業",
    subcategories: ["定期航空", "不定期航空", "空港業務"]
  },
  {
    name: "倉庫・運輸関連業",
    subcategories: ["倉庫", "港湾運送", "運輸代理店", "こん包"]
  },
  {
    name: "情報・通信業",
    subcategories: ["通信", "放送", "情報サービス", "インターネット関連サービス", "ソフトウェア", "システムインテグレーション", "データセンター"]
  },
  {
    name: "卸売業",
    subcategories: ["総合商社", "繊維品卸売", "食料品卸売", "石油製品卸売", "鉄鋼・非鉄・鉱業製品卸売", "機械器具卸売", "医薬品卸売", "その他卸売"]
  },
  {
    name: "小売業",
    subcategories: ["百貨店", "スーパー", "コンビニエンスストア", "専門店", "ドラッグストア", "家電量販店", "ホームセンター", "通信販売", "オンラインショッピング"]
  },
  {
    name: "銀行業",
    subcategories: ["都市銀行", "地方銀行", "信託銀行", "ネット銀行"]
  },
  {
    name: "証券・商品先物取引業",
    subcategories: ["証券", "商品先物取引", "投資銀行業務", "資産運用"]
  },
  {
    name: "保険業",
    subcategories: ["生命保険", "損害保険", "保険代理店", "再保険"]
  },
  {
    name: "その他金融業",
    subcategories: ["消費者金融", "事業金融", "リース", "クレジットカード", "投資業"]
  },
  {
    name: "不動産業",
    subcategories: ["不動産取引", "不動産賃貸", "不動産管理", "住宅", "ビル開発", "住宅開発", "リート"]
  },
  {
    name: "サービス業",
    subcategories: ["ホテル", "レジャー", "外食", "広告", "人材サービス", "教育", "医療関連サービス", "介護・福祉", "コンサルティング", "シェアリングエコノミー"]
  }
];

// 共通キーワードデータ
const COMMON_KEYWORDS = [
  "DX", "デジタルトランスフォーメーション", "AI", "人工知能", "機械学習",
  "IoT", "クラウドコンピューティング", "ビッグデータ", "ブロックチェーン",
  "サステナビリティ", "SDGs", "カーボンニュートラル", "ESG投資",
  "ワークスタイル変革", "リモートワーク", "ハイブリッドワーク",
  "イノベーション", "スタートアップ", "オープンイノベーション",
  "グローバル展開", "マーケットイン", "UX", "カスタマーエクスペリエンス",
  "デジタルマーケティング", "メタバース", "Web3.0", "5G", "6G",
  "サイバーセキュリティ", "BCP", "事業継続計画", "リスクマネジメント",
  "アジャイル開発", "DevOps", "SaaS", "PaaS", "IaaS",
  "エッジコンピューティング", "量子コンピュータ", "RPA", "自動化"
];

async function main() {
  console.log('業種・キーワードデータの挿入を開始します...');
  
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
           ON CONFLICT (name) DO UPDATE 
           SET description = EXCLUDED.description, 
               display_order = EXCLUDED.display_order
           RETURNING id`,
          [category.name, `${category.name}業種カテゴリ`, i + 1]
        );
        
        const categoryId = categoryResult.rows[0].id;
        
        console.log(`  - ${category.name} (${categoryId})`);
        
        // 業種小分類の挿入
        console.log('  業種小分類を登録中...');
        for (let j = 0; j < category.subcategories.length; j++) {
          const subcategory = category.subcategories[j];
          // 小分類は複合ユニーク制約がないので、存在確認してから挿入
          const existingResult = await client.query(
            `SELECT id FROM industry_subcategories 
             WHERE name = $1 AND category_id = $2`,
            [subcategory, categoryId]
          );
          
          if (existingResult.rows.length === 0) {
            await client.query(
              `INSERT INTO industry_subcategories (name, category_id, description, display_order) 
               VALUES ($1, $2, $3, $4)`,
              [subcategory, categoryId, `${category.name} > ${subcategory}`, j + 1]
            );
          } else {
            await client.query(
              `UPDATE industry_subcategories 
               SET description = $1, display_order = $2
               WHERE name = $3 AND category_id = $4`,
              [`${category.name} > ${subcategory}`, j + 1, subcategory, categoryId]
            );
          }
          
          console.log(`    - ${subcategory}`);
        }
      }
      
      console.log('共通キーワードを登録中...');
      
      // 共通キーワードの挿入
      for (let i = 0; i < COMMON_KEYWORDS.length; i++) {
        const keyword = COMMON_KEYWORDS[i];
        await client.query(
          `INSERT INTO keywords (name, description, is_common) 
           VALUES ($1, $2, $3)
           ON CONFLICT (name) DO UPDATE 
           SET description = EXCLUDED.description, 
               is_common = EXCLUDED.is_common`,
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