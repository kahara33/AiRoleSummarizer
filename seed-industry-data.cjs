const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// データベース接続
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// キーワードデータ
const keywordData = [
  // AIエージェント・オーケストレーションツール (30キーワード)
  { name: 'Dify', description: 'AIエージェント・オーケストレーションツール: Dify / ディファイ' },
  { name: 'AutoGen', description: 'AIエージェント・オーケストレーションツール: AutoGen / オートジェン' },
  { name: 'LangChain', description: 'AIエージェント・オーケストレーションツール: LangChain / ラングチェーン' },
  { name: 'LlamaIndex', description: 'AIエージェント・オーケストレーションツール: LlamaIndex / ラマインデックス' },
  { name: 'CrewAI', description: 'AIエージェント・オーケストレーションツール: CrewAI / クルーAI' },
  { name: 'BabyAGI', description: 'AIエージェント・オーケストレーションツール: BabyAGI / ベイビーAGI' },
  { name: 'AutoGPT', description: 'AIエージェント・オーケストレーションツール: AutoGPT / オートGPT' },
  { name: 'AgentGPT', description: 'AIエージェント・オーケストレーションツール: AgentGPT / エージェントGPT' },
  { name: 'Semantic Kernel', description: 'AIエージェント・オーケストレーションツール: Semantic Kernel / セマンティックカーネル' },
  { name: 'Haystack', description: 'AIエージェント・オーケストレーションツール: Haystack / ヘイスタック' },
  
  // ベクトルデータベース
  { name: 'Pinecone', description: 'ベクトルデータベース・埋め込み技術: Pinecone / パインコーン' },
  { name: 'Weaviate', description: 'ベクトルデータベース・埋め込み技術: Weaviate / ウィービエイト' },
  { name: 'Milvus', description: 'ベクトルデータベース・埋め込み技術: Milvus / ミルバス' },
  { name: 'Chroma', description: 'ベクトルデータベース・埋め込み技術: Chroma / クロマ' },
  { name: 'FAISS', description: 'ベクトルデータベース・埋め込み技術: FAISS / フェイス' },
  
  // AIアプリケーション開発プラットフォーム
  { name: 'Streamlit', description: 'AIアプリケーション開発プラットフォーム: Streamlit / ストリームリット' },
  { name: 'Gradio', description: 'AIアプリケーション開発プラットフォーム: Gradio / グラディオ' },
  { name: 'Chainlit', description: 'AIアプリケーション開発プラットフォーム: Chainlit / チェーンリット' },
  { name: 'Vercel AI Playground', description: 'AIアプリケーション開発プラットフォーム: Vercel AI Playground / バーセルAIプレイグラウンド' },
  { name: 'Hugging Face Spaces', description: 'AIアプリケーション開発プラットフォーム: Hugging Face Spaces / ハギングフェイススペース' },
  
  // マルチモーダルAI・拡散モデル
  { name: 'Stable Diffusion', description: 'マルチモーダルAI・拡散モデル: Stable Diffusion / ステーブルディフュージョン' },
  { name: 'ComfyUI', description: 'マルチモーダルAI・拡散モデル: ComfyUI / コンフィUI' },
  { name: 'ControlNet', description: 'マルチモーダルAI・拡散モデル: ControlNet / コントロールネット' },
  { name: 'SDXL', description: 'マルチモーダルAI・拡散モデル: SDXL / エスディーエックスエル' },
  { name: 'DALL-E', description: 'マルチモーダルAI・拡散モデル: DALL-E / ダリ' },
  
  // デプロイメント・MLOps
  { name: 'BentoML', description: 'デプロイメント・MLOps: BentoML / ベントエムエル' },
  { name: 'Ray', description: 'デプロイメント・MLOps: Ray / レイ' },
  { name: 'Seldon Core', description: 'デプロイメント・MLOps: Seldon Core / セルドンコア' },
  { name: 'Kubeflow', description: 'デプロイメント・MLOps: Kubeflow / クーブフロー' },
  { name: 'KServe', description: 'デプロイメント・MLOps: KServe / ケーサーブ' },
  
  // 日本発のAI技術・企業
  { name: 'Rinna', description: '日本発のAI技術・企業: Rinna / リンナ' },
  { name: 'ABEJA', description: '日本発のAI技術・企業: ABEJA / アベジャ' },
  { name: 'Preferred Networks', description: '日本発のAI技術・企業: Preferred Networks / プリファードネットワークス' },
  { name: 'PFN', description: '日本発のAI技術・企業: PFN' },
  { name: 'Matsuo Lab', description: '日本発のAI技術・企業: Matsuo Lab / 松尾研究室' },
  
  // 生成AI応用ツール
  { name: 'Notion AI', description: '生成AI応用ツール: Notion AI / ノーションAI' },
  { name: 'Otter.ai', description: '生成AI応用ツール: Otter.ai / オッターAI' },
  { name: 'Jasper', description: '生成AI応用ツール: Jasper / ジャスパー' },
  { name: 'Murf AI', description: '生成AI応用ツール: Murf AI / マーフAI' },
  { name: 'Gamma', description: '生成AI応用ツール: Gamma / ガンマ' },
  
  // コード生成・自動化ツール
  { name: 'GitHub Copilot', description: 'コード生成・自動化ツール: GitHub Copilot / ギットハブコパイロット' },
  { name: 'Amazon CodeWhisperer', description: 'コード生成・自動化ツール: Amazon CodeWhisperer / アマゾンコードウィスパラー' },
  { name: 'Tabnine', description: 'コード生成・自動化ツール: Tabnine / タブナイン' },
  { name: 'Sourcegraph Cody', description: 'コード生成・自動化ツール: Sourcegraph Cody / ソースグラフコディ' },
  { name: 'Replit Ghostwriter', description: 'コード生成・自動化ツール: Replit Ghostwriter / レプリットゴーストライター' }
];

async function addKeywordsOneByOne() {
  console.log('キーワードの追加を開始します...');
  
  let addedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  try {
    // 現在のキーワードリストを取得
    const result = await pool.query('SELECT name FROM keywords');
    const existingKeywordNames = result.rows.map(row => row.name);
    
    console.log(`既存のキーワード: ${existingKeywordNames.length}件`);
    
    // 各キーワードを個別に追加
    for (const keyword of keywordData) {
      try {
        // 既に同じ名前のキーワードが存在するか確認
        if (existingKeywordNames.includes(keyword.name)) {
          console.log(`- キーワード「${keyword.name}」は既に存在します。スキップします。`);
          skippedCount++;
          continue;
        }
        
        // 新しいキーワードを追加（個別トランザクション）
        const id = uuidv4();
        await pool.query(
          'INSERT INTO keywords (id, name, description, is_common, status, parent_id, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [id, keyword.name, keyword.description, true, 'active', null, null, new Date(), new Date()]
        );
        
        addedCount++;
        console.log(`+ キーワード「${keyword.name}」を追加しました`);
      } catch (error) {
        console.error(`! キーワード「${keyword.name}」の追加に失敗しました:`, error.message);
        errorCount++;
      }
    }
    
  } catch (error) {
    console.error('データベース操作中にエラーが発生しました:', error.message);
    errorCount++;
  }
  
  console.log('\n=========================================');
  console.log(`処理完了: ${addedCount}件追加, ${errorCount}件エラー, ${skippedCount}件スキップ`);
  console.log('=========================================');
}

// スクリプト実行
addKeywordsOneByOne()
  .then(() => {
    console.log('キーワード追加処理が完了しました。');
    pool.end();
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error.message);
    pool.end();
  });