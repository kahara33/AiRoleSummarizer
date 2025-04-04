// キーワード追加スクリプト
const { db } = require('./server/db');
const { keywords } = require('./shared/schema');
const { v4: uuidv4 } = require('uuid');

const keywordData = [
  // AIエージェント・オーケストレーションツール
  { name: 'Dify', description: 'AIエージェント・オーケストレーションツール: Dify / ディファイ', category: 'AIエージェント' },
  { name: 'AutoGen', description: 'AIエージェント・オーケストレーションツール: AutoGen / オートジェン', category: 'AIエージェント' },
  { name: 'LangChain', description: 'AIエージェント・オーケストレーションツール: LangChain / ラングチェーン', category: 'AIエージェント' },
  { name: 'LlamaIndex', description: 'AIエージェント・オーケストレーションツール: LlamaIndex / ラマインデックス', category: 'AIエージェント' },
  { name: 'CrewAI', description: 'AIエージェント・オーケストレーションツール: CrewAI / クルーAI', category: 'AIエージェント' },
  { name: 'BabyAGI', description: 'AIエージェント・オーケストレーションツール: BabyAGI / ベイビーAGI', category: 'AIエージェント' },
  { name: 'AutoGPT', description: 'AIエージェント・オーケストレーションツール: AutoGPT / オートGPT', category: 'AIエージェント' },
  { name: 'AgentGPT', description: 'AIエージェント・オーケストレーションツール: AgentGPT / エージェントGPT', category: 'AIエージェント' },
  { name: 'Semantic Kernel', description: 'AIエージェント・オーケストレーションツール: Semantic Kernel / セマンティックカーネル', category: 'AIエージェント' },
  { name: 'Haystack', description: 'AIエージェント・オーケストレーションツール: Haystack / ヘイスタック', category: 'AIエージェント' },
  
  // ベクトルデータベース
  { name: 'Pinecone', description: 'ベクトルデータベース・埋め込み技術: Pinecone / パインコーン', category: 'ベクトルDB' },
  { name: 'Weaviate', description: 'ベクトルデータベース・埋め込み技術: Weaviate / ウィービエイト', category: 'ベクトルDB' },
  { name: 'Milvus', description: 'ベクトルデータベース・埋め込み技術: Milvus / ミルバス', category: 'ベクトルDB' },
  { name: 'Chroma', description: 'ベクトルデータベース・埋め込み技術: Chroma / クロマ', category: 'ベクトルDB' },
  { name: 'FAISS', description: 'ベクトルデータベース・埋め込み技術: FAISS / フェイス', category: 'ベクトルDB' },
  { name: 'Qdrant', description: 'ベクトルデータベース・埋め込み技術: Qdrant / クドラント', category: 'ベクトルDB' },
  { name: 'PGVector', description: 'ベクトルデータベース・埋め込み技術: PGVector / ピージーベクター', category: 'ベクトルDB' },
  { name: 'Vespa', description: 'ベクトルデータベース・埋め込み技術: Vespa / ベスパ', category: 'ベクトルDB' },
  { name: 'Vald', description: 'ベクトルデータベース・埋め込み技術: Vald / バルド', category: 'ベクトルDB' },
  { name: 'Marqo', description: 'ベクトルデータベース・埋め込み技術: Marqo / マーコ', category: 'ベクトルDB' },
  
  // AIアプリケーション開発プラットフォーム
  { name: 'Streamlit', description: 'AIアプリケーション開発プラットフォーム: Streamlit / ストリームリット', category: 'AI開発' },
  { name: 'Gradio', description: 'AIアプリケーション開発プラットフォーム: Gradio / グラディオ', category: 'AI開発' },
  { name: 'Chainlit', description: 'AIアプリケーション開発プラットフォーム: Chainlit / チェーンリット', category: 'AI開発' },
  { name: 'Vercel AI Playground', description: 'AIアプリケーション開発プラットフォーム: Vercel AI Playground / バーセルAIプレイグラウンド', category: 'AI開発' },
  { name: 'Hugging Face Spaces', description: 'AIアプリケーション開発プラットフォーム: Hugging Face Spaces / ハギングフェイススペース', category: 'AI開発' },
  { name: 'LangSmith', description: 'AIアプリケーション開発プラットフォーム: LangSmith / ラングスミス', category: 'AI開発' },
  { name: 'Weights & Biases', description: 'AIアプリケーション開発プラットフォーム: Weights & Biases / ウェイツ&バイアセス', category: 'AI開発' },
  { name: 'Comet ML', description: 'AIアプリケーション開発プラットフォーム: Comet ML / コメットエムエル', category: 'AI開発' },
  { name: 'MLflow', description: 'AIアプリケーション開発プラットフォーム: MLflow / エムエルフロー', category: 'AI開発' },
  { name: 'Databricks Lakehouse AI', description: 'AIアプリケーション開発プラットフォーム: Databricks Lakehouse AI / データブリックスレイクハウスAI', category: 'AI開発' },
  
  // マルチモーダルAI・拡散モデル
  { name: 'Stable Diffusion', description: 'マルチモーダルAI・拡散モデル: Stable Diffusion / ステーブルディフュージョン', category: 'マルチモーダルAI' },
  { name: 'ComfyUI', description: 'マルチモーダルAI・拡散モデル: ComfyUI / コンフィUI', category: 'マルチモーダルAI' },
  { name: 'ControlNet', description: 'マルチモーダルAI・拡散モデル: ControlNet / コントロールネット', category: 'マルチモーダルAI' },
  { name: 'SDXL', description: 'マルチモーダルAI・拡散モデル: SDXL / エスディーエックスエル', category: 'マルチモーダルAI' },
  { name: 'DALL-E', description: 'マルチモーダルAI・拡散モデル: DALL-E / ダリ', category: 'マルチモーダルAI' },
  { name: 'Imagen', description: 'マルチモーダルAI・拡散モデル: Imagen / イマジェン', category: 'マルチモーダルAI' },
  { name: 'Firefly', description: 'マルチモーダルAI・拡散モデル: Firefly / ファイアフライ', category: 'マルチモーダルAI' },
  { name: 'Midjourney', description: 'マルチモーダルAI・拡散モデル: Midjourney / ミッドジャーニー', category: 'マルチモーダルAI' },
  { name: 'Sora', description: 'マルチモーダルAI・拡散モデル: Sora / ソラ', category: 'マルチモーダルAI' },
  { name: 'CLIP', description: 'マルチモーダルAI・拡散モデル: CLIP / クリップ', category: 'マルチモーダルAI' },
  
  // デプロイメント・MLOps
  { name: 'BentoML', description: 'デプロイメント・MLOps: BentoML / ベントエムエル', category: 'MLOps' },
  { name: 'Ray', description: 'デプロイメント・MLOps: Ray / レイ', category: 'MLOps' },
  { name: 'Seldon Core', description: 'デプロイメント・MLOps: Seldon Core / セルドンコア', category: 'MLOps' },
  { name: 'Kubeflow', description: 'デプロイメント・MLOps: Kubeflow / クーブフロー', category: 'MLOps' },
  { name: 'KServe', description: 'デプロイメント・MLOps: KServe / ケーサーブ', category: 'MLOps' },
  { name: 'Triton Inference Server', description: 'デプロイメント・MLOps: Triton Inference Server / トリトン推論サーバー', category: 'MLOps' },
  { name: 'TorchServe', description: 'デプロイメント・MLOps: TorchServe / トーチサーブ', category: 'MLOps' },
  { name: 'TF Serving', description: 'デプロイメント・MLOps: TF Serving / ティーエフサービング', category: 'MLOps' },
  { name: 'Cortex', description: 'デプロイメント・MLOps: Cortex / コーテックス', category: 'MLOps' },
  { name: 'ClearML', description: 'デプロイメント・MLOps: ClearML / クリアエムエル', category: 'MLOps' },
  
  // 日本発のAI技術・企業
  { name: 'Rinna', description: '日本発のAI技術・企業: Rinna / リンナ', category: '日本のAI' },
  { name: 'ABEJA', description: '日本発のAI技術・企業: ABEJA / アベジャ', category: '日本のAI' },
  { name: 'Preferred Networks', description: '日本発のAI技術・企業: Preferred Networks / プリファードネットワークス', category: '日本のAI' },
  { name: 'PFN', description: '日本発のAI技術・企業: PFN', category: '日本のAI' },
  { name: 'Matsuo Lab', description: '日本発のAI技術・企業: Matsuo Lab / 松尾研究室', category: '日本のAI' },
  { name: 'Elyza', description: '日本発のAI技術・企業: Elyza / エリザ', category: '日本のAI' },
  { name: 'Sakana AI', description: '日本発のAI技術・企業: Sakana AI / サカナAI', category: '日本のAI' },
  { name: 'SOINN', description: '日本発のAI技術・企業: SOINN / ソイン', category: '日本のAI' },
  { name: 'Stockmark', description: '日本発のAI技術・企業: Stockmark / ストックマーク', category: '日本のAI' },
  { name: 'Gehirn', description: '日本発のAI技術・企業: Gehirn / ゲヒルン', category: '日本のAI' },
  
  // 生成AI応用ツール
  { name: 'Notion AI', description: '生成AI応用ツール: Notion AI / ノーションAI', category: '生成AIツール' },
  { name: 'Otter.ai', description: '生成AI応用ツール: Otter.ai / オッターAI', category: '生成AIツール' },
  { name: 'Jasper', description: '生成AI応用ツール: Jasper / ジャスパー', category: '生成AIツール' },
  { name: 'Murf AI', description: '生成AI応用ツール: Murf AI / マーフAI', category: '生成AIツール' },
  { name: 'Gamma', description: '生成AI応用ツール: Gamma / ガンマ', category: '生成AIツール' },
  { name: 'Tome', description: '生成AI応用ツール: Tome / トーム', category: '生成AIツール' },
  { name: 'Lumen5', description: '生成AI応用ツール: Lumen5 / ルーメン5', category: '生成AIツール' },
  { name: 'Beautiful.ai', description: '生成AI応用ツール: Beautiful.ai / ビューティフルAI', category: '生成AIツール' },
  { name: 'Canva AI', description: '生成AI応用ツール: Canva AI / キャンバAI', category: '生成AIツール' },
  { name: 'Picsart AI', description: '生成AI応用ツール: Picsart AI / ピクサートAI', category: '生成AIツール' },
  
  // コード生成・自動化ツール
  { name: 'GitHub Copilot', description: 'コード生成・自動化ツール: GitHub Copilot / ギットハブコパイロット', category: 'コード生成' },
  { name: 'Amazon CodeWhisperer', description: 'コード生成・自動化ツール: Amazon CodeWhisperer / アマゾンコードウィスパラー', category: 'コード生成' },
  { name: 'Tabnine', description: 'コード生成・自動化ツール: Tabnine / タブナイン', category: 'コード生成' },
  { name: 'Sourcegraph Cody', description: 'コード生成・自動化ツール: Sourcegraph Cody / ソースグラフコディ', category: 'コード生成' },
  { name: 'Replit Ghostwriter', description: 'コード生成・自動化ツール: Replit Ghostwriter / レプリットゴーストライター', category: 'コード生成' },
  { name: 'Cursor', description: 'コード生成・自動化ツール: Cursor / カーソル', category: 'コード生成' },
  { name: 'Codeium', description: 'コード生成・自動化ツール: Codeium / コーディウム', category: 'コード生成' },
  { name: 'Mintlify', description: 'コード生成・自動化ツール: Mintlify / ミントリファイ', category: 'コード生成' },
  { name: 'Cody AI', description: 'コード生成・自動化ツール: Cody AI / コディAI', category: 'コード生成' },
  { name: 'UseVerbose', description: 'コード生成・自動化ツール: UseVerbose / ユーズバーボス', category: 'コード生成' }
];

async function addKeywords() {
  console.log('キーワードの追加を開始します...');
  
  let addedCount = 0;
  let errorCount = 0;
  
  for (const keyword of keywordData) {
    try {
      // 既に同じ名前のキーワードが存在するか確認
      const existingKeyword = await db.select().from(keywords).where('name', '=', keyword.name);
      
      if (existingKeyword.length > 0) {
        console.log(`- キーワード「${keyword.name}」は既に存在します。スキップします。`);
        continue;
      }
      
      // 新しいキーワードを追加
      await db.insert(keywords).values({
        id: uuidv4(),
        name: keyword.name,
        description: keyword.description,
        isCommon: true,
        status: 'active',
        parentId: null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      addedCount++;
      console.log(`+ キーワード「${keyword.name}」を追加しました (${keyword.category})`);
    } catch (error) {
      console.error(`! キーワード「${keyword.name}」の追加に失敗しました:`, error);
      errorCount++;
    }
  }
  
  console.log('\n=========================================');
  console.log(`処理完了: ${addedCount}件追加, ${errorCount}件エラー, ${keywordData.length - addedCount - errorCount}件スキップ`);
  console.log('=========================================');
}

// スクリプト実行
addKeywords()
  .then(() => {
    console.log('キーワード追加処理が完了しました。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  });