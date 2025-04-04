const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// データベース接続
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// キーワードデータ - 添付リストから全てのキーワードを含む
const keywordData = [
  // AIエージェント・オーケストレーションツール (30キーワード)
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
  { name: 'Flowise', description: 'AIエージェント・オーケストレーションツール: Flowise / フロウワイズ', category: 'AIエージェント' },
  { name: 'LangFlow', description: 'AIエージェント・オーケストレーションツール: LangFlow / ラングフロー', category: 'AIエージェント' },
  { name: 'E2B', description: 'AIエージェント・オーケストレーションツール: E2B / イーツービー', category: 'AIエージェント' },
  { name: 'Griptape', description: 'AIエージェント・オーケストレーションツール: Griptape / グリップテープ', category: 'AIエージェント' },
  { name: 'Embedchain', description: 'AIエージェント・オーケストレーションツール: Embedchain / エンベッドチェーン', category: 'AIエージェント' },
  { name: 'GPT-Engineer', description: 'AIエージェント・オーケストレーションツール: GPT-Engineer / GPTエンジニア', category: 'AIエージェント' },
  { name: 'DSPy', description: 'AIエージェント・オーケストレーションツール: DSPy / ディーエスパイ', category: 'AIエージェント' },
  { name: 'Guidance', description: 'AIエージェント・オーケストレーションツール: Guidance / ガイダンス', category: 'AIエージェント' },
  { name: 'PromptFlow', description: 'AIエージェント・オーケストレーションツール: PromptFlow / プロンプトフロー', category: 'AIエージェント' },
  { name: 'Transformers Agents', description: 'AIエージェント・オーケストレーションツール: Transformers Agents / トランスフォーマーズエージェント', category: 'AIエージェント' },
  { name: 'Vercel AI SDK', description: 'AIエージェント・オーケストレーションツール: Vercel AI SDK / バーセルAI SDK', category: 'AIエージェント' },
  { name: 'Instructor', description: 'AIエージェント・オーケストレーションツール: Instructor / インストラクター', category: 'AIエージェント' },
  { name: 'Outlines', description: 'AIエージェント・オーケストレーションツール: Outlines / アウトラインズ', category: 'AIエージェント' },
  { name: 'TaskWeaver', description: 'AIエージェント・オーケストレーションツール: TaskWeaver / タスクウィーバー', category: 'AIエージェント' },
  { name: 'SuperAGI', description: 'AIエージェント・オーケストレーションツール: SuperAGI / スーパーAGI', category: 'AIエージェント' },
  { name: 'MetaGPT', description: 'AIエージェント・オーケストレーションツール: MetaGPT / メタGPT', category: 'AIエージェント' },
  { name: 'LMQL', description: 'AIエージェント・オーケストレーションツール: LMQL / エルエムキューエル', category: 'AIエージェント' },
  { name: 'OpenDevin', description: 'AIエージェント・オーケストレーションツール: OpenDevin / オープンデビン', category: 'AIエージェント' },
  { name: 'HuggingGPT', description: 'AIエージェント・オーケストレーションツール: HuggingGPT / ハギングGPT', category: 'AIエージェント' },
  { name: 'LLM Compiler', description: 'AIエージェント・オーケストレーションツール: LLM Compiler / LLMコンパイラー', category: 'AIエージェント' },
  
  // ベクトルデータベース・埋め込み技術 (20キーワード)
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
  { name: 'Supabase Vector', description: 'ベクトルデータベース・埋め込み技術: Supabase Vector / スーパーベースベクター', category: 'ベクトルDB' },
  { name: 'MongoDB Atlas Vector Search', description: 'ベクトルデータベース・埋め込み技術: MongoDB Atlas Vector Search / モンゴDBアトラスベクター', category: 'ベクトルDB' },
  { name: 'Redis Vector Similarity', description: 'ベクトルデータベース・埋め込み技術: Redis Vector Similarity / レディスベクター', category: 'ベクトルDB' },
  { name: 'Neo4j Vector Index', description: 'ベクトルデータベース・埋め込み技術: Neo4j Vector Index / ネオフォージェイベクター', category: 'ベクトルDB' },
  { name: 'SingleStore Vector Search', description: 'ベクトルデータベース・埋め込み技術: SingleStore Vector Search / シングルストアベクター', category: 'ベクトルDB' },
  { name: 'Elasticsearch Vector Search', description: 'ベクトルデータベース・埋め込み技術: Elasticsearch Vector Search / エラスティックサーチベクター', category: 'ベクトルDB' },
  { name: 'OpenSearch Vector Engine', description: 'ベクトルデータベース・埋め込み技術: OpenSearch Vector Engine / オープンサーチベクター', category: 'ベクトルDB' },
  { name: 'pgEmbedding', description: 'ベクトルデータベース・埋め込み技術: pgEmbedding / ピージーエンベディング', category: 'ベクトルDB' },
  { name: 'Vertex Matching Engine', description: 'ベクトルデータベース・埋め込み技術: Vertex Matching Engine / バーテックスマッチングエンジン', category: 'ベクトルDB' },
  { name: 'Vector Similarity Search', description: 'ベクトルデータベース・埋め込み技術: Vector Similarity Search / ベクター類似度検索', category: 'ベクトルDB' },
  
  // AIアプリケーション開発プラットフォーム (20キーワード)
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
  { name: 'Modal', description: 'AIアプリケーション開発プラットフォーム: Modal / モーダル', category: 'AI開発' },
  { name: 'Replicate', description: 'AIアプリケーション開発プラットフォーム: Replicate / レプリケート', category: 'AI開発' },
  { name: 'OpenAI Platform', description: 'AIアプリケーション開発プラットフォーム: OpenAI Platform / オープンAIプラットフォーム', category: 'AI開発' },
  { name: 'Helicone', description: 'AIアプリケーション開発プラットフォーム: Helicone / ヘリコーン', category: 'AI開発' },
  { name: 'Beam', description: 'AIアプリケーション開発プラットフォーム: Beam / ビーム', category: 'AI開発' },
  { name: 'Together AI', description: 'AIアプリケーション開発プラットフォーム: Together AI / トゥギャザーAI', category: 'AI開発' },
  { name: 'Clarifai', description: 'AIアプリケーション開発プラットフォーム: Clarifai / クラリファイ', category: 'AI開発' },
  { name: 'Roboflow', description: 'AIアプリケーション開発プラットフォーム: Roboflow / ロボフロー', category: 'AI開発' },
  { name: 'Baseten', description: 'AIアプリケーション開発プラットフォーム: Baseten / ベイステン', category: 'AI開発' },
  { name: 'Activeloop', description: 'AIアプリケーション開発プラットフォーム: Activeloop / アクティブループ', category: 'AI開発' },
  
  // マルチモーダルAI・拡散モデル (15キーワード)
  { name: 'Stable Diffusion', description: 'マルチモーダルAI・拡散モデル: Stable Diffusion / ステーブルディフュージョン', category: 'マルチモーダルAI' },
  { name: 'ComfyUI', description: 'マルチモーダルAI・拡散モデル: ComfyUI / コンフィUI', category: 'マルチモーダルAI' },
  { name: 'Stable Diffusion WebUI', description: 'マルチモーダルAI・拡散モデル: Stable Diffusion WebUI / ステーブルディフュージョンWebUI', category: 'マルチモーダルAI' },
  { name: 'ControlNet', description: 'マルチモーダルAI・拡散モデル: ControlNet / コントロールネット', category: 'マルチモーダルAI' },
  { name: 'SDXL', description: 'マルチモーダルAI・拡散モデル: SDXL / エスディーエックスエル', category: 'マルチモーダルAI' },
  { name: 'DALL-E', description: 'マルチモーダルAI・拡散モデル: DALL-E / ダリ', category: 'マルチモーダルAI' },
  { name: 'Imagen', description: 'マルチモーダルAI・拡散モデル: Imagen / イマジェン', category: 'マルチモーダルAI' },
  { name: 'Firefly', description: 'マルチモーダルAI・拡散モデル: Firefly / ファイアフライ', category: 'マルチモーダルAI' },
  { name: 'Midjourney', description: 'マルチモーダルAI・拡散モデル: Midjourney / ミッドジャーニー', category: 'マルチモーダルAI' },
  { name: 'Sora', description: 'マルチモーダルAI・拡散モデル: Sora / ソラ', category: 'マルチモーダルAI' },
  { name: 'Dream Studio', description: 'マルチモーダルAI・拡散モデル: Dream Studio / ドリームスタジオ', category: 'マルチモーダルAI' },
  { name: 'Gen-2', description: 'マルチモーダルAI・拡散モデル: Gen-2 / ジェン2', category: 'マルチモーダルAI' },
  { name: 'CLIP', description: 'マルチモーダルAI・拡散モデル: CLIP / クリップ', category: 'マルチモーダルAI' },
  { name: 'Kandinsky', description: 'マルチモーダルAI・拡散モデル: Kandinsky / カンディンスキー', category: 'マルチモーダルAI' },
  { name: 'Leonardo AI', description: 'マルチモーダルAI・拡散モデル: Leonardo AI / レオナルドAI', category: 'マルチモーダルAI' },
  
  // デプロイメント・MLOps (15キーワード)
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
  { name: 'Valohai', description: 'デプロイメント・MLOps: Valohai / バロハイ', category: 'MLOps' },
  { name: 'ZenML', description: 'デプロイメント・MLOps: ZenML / ゼンエムエル', category: 'MLOps' },
  { name: 'Metaflow', description: 'デプロイメント・MLOps: Metaflow / メタフロー', category: 'MLOps' },
  { name: 'DVC', description: 'デプロイメント・MLOps: DVC / ディーブイシー', category: 'MLOps' },
  { name: 'OctoAI', description: 'デプロイメント・MLOps: OctoAI / オクトAI', category: 'MLOps' },
  
  // 日本発のAI技術・企業 (10キーワード)
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
  
  // 生成AI応用ツール (20キーワード)
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
  { name: 'Descript', description: '生成AI応用ツール: Descript / ディスクリプト', category: '生成AIツール' },
  { name: 'Runway', description: '生成AI応用ツール: Runway / ランウェイ', category: '生成AIツール' },
  { name: 'Kaiber', description: '生成AI応用ツール: Kaiber / カイバー', category: '生成AIツール' },
  { name: 'Synthesia', description: '生成AI応用ツール: Synthesia / シンセシア', category: '生成AIツール' },
  { name: 'Lensa', description: '生成AI応用ツール: Lensa / レンザ', category: '生成AIツール' },
  { name: 'Grammarly', description: '生成AI応用ツール: Grammarly / グラマリー', category: '生成AIツール' },
  { name: 'LanguageTool', description: '生成AI応用ツール: LanguageTool / ランゲージツール', category: '生成AIツール' },
  { name: 'DeepL', description: '生成AI応用ツール: DeepL / ディープエル', category: '生成AIツール' },
  { name: 'Copy.ai', description: '生成AI応用ツール: Copy.ai / コピーAI', category: '生成AIツール' },
  { name: 'Caktus AI', description: '生成AI応用ツール: Caktus AI / カクタスAI', category: '生成AIツール' },
  
  // コード生成・自動化ツール (20キーワード)
  { name: 'GitHub Copilot', description: 'コード生成・自動化ツール: GitHub Copilot / ギットハブコパイロット', category: 'コード生成' },
  { name: 'Amazon CodeWhisperer', description: 'コード生成・自動化ツール: Amazon CodeWhisperer / アマゾンコードウィスパラー', category: 'コード生成' },
  { name: 'Tabnine', description: 'コード生成・自動化ツール: Tabnine / タブナイン', category: 'コード生成' },
  { name: 'Sourcegraph Cody', description: 'コード生成・自動化ツール: Sourcegraph Cody / ソースグラフコディ', category: 'コード生成' },
  { name: 'Replit Ghostwriter', description: 'コード生成・自動化ツール: Replit Ghostwriter / レプリットゴーストライター', category: 'コード生成' },
  { name: 'Cursor', description: 'コード生成・自動化ツール: Cursor / カーソル', category: 'コード生成' },
  { name: 'Codeium', description: 'コード生成・自動化ツール: Codeium / コーディウム', category: 'コード生成' },
  { name: 'Mintlify', description: 'コード生成・自動化ツール: Mintlify / ミントリファイ', category: 'コード生成' },
  { name: 'Cody AI', description: 'コード生成・自動化ツール: Cody AI / コディAI', category: 'コード生成' },
  { name: 'UseVerbose', description: 'コード生成・自動化ツール: UseVerbose / ユーズバーボス', category: 'コード生成' },
  { name: 'Kodezi', description: 'コード生成・自動化ツール: Kodezi / コデジ', category: 'コード生成' },
  { name: 'DeepSeek Coder', description: 'コード生成・自動化ツール: DeepSeek Coder / ディープシークコーダー', category: 'コード生成' },
  { name: 'WhatTheDiff', description: 'コード生成・自動化ツール: WhatTheDiff / ワットザディフ', category: 'コード生成' },
  { name: 'Adrenaline', description: 'コード生成・自動化ツール: Adrenaline / アドレナリン', category: 'コード生成' },
  { name: 'Amazon Q', description: 'コード生成・自動化ツール: Amazon Q / アマゾンQ', category: 'コード生成' },
  { name: 'Cline', description: 'コード生成・自動化ツール: Cline / クライン', category: 'コード生成' },
  { name: 'Continue', description: 'コード生成・自動化ツール: Continue / コンティニュー', category: 'コード生成' },
  { name: 'JetBrains AI Assistant', description: 'コード生成・自動化ツール: JetBrains AI Assistant / ジェットブレインズAIアシスタント', category: 'コード生成' },
  { name: 'Blackbox', description: 'コード生成・自動化ツール: Blackbox / ブラックボックス', category: 'コード生成' },
  { name: 'Fig AI', description: 'コード生成・自動化ツール: Fig AI / フィグAI', category: 'コード生成' }
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
        console.log(`+ キーワード「${keyword.name}」を追加しました (${keyword.category})`);
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