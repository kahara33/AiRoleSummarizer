/**
 * マルチエージェントシステムの共通型定義
 */

/**
 * 知識グラフノードデータ型
 */
export type KnowledgeNodeData = {
  id: string; // ノードID
  name: string; // ノード名
  level: number; // 階層レベル（0がルート）
  type?: string; // ノードタイプ（'root', 'category', 'subcategory'等）
  parentId?: string | null; // 親ノードID
  description?: string | null; // 説明
  color?: string | null; // 色情報（必要に応じて）
};

/**
 * 知識グラフエッジデータ型
 */
export type KnowledgeEdgeData = {
  source: string; // ソースノードID
  target: string; // ターゲットノードID
  label?: string | null; // エッジラベル
  strength?: number; // エッジの強さ（0.0～1.0）
};

/**
 * 知識グラフデータ型
 */
export type KnowledgeGraphData = {
  nodes: KnowledgeNodeData[];
  edges: KnowledgeEdgeData[];
};

/**
 * 役割モデル入力データ型
 */
export type RoleModelInput = {
  roleModelId: string; // 役割モデルID
  roleName: string; // 役割名
  description: string; // 説明
  industries: string[]; // 関連業界リスト
  keywords: string[]; // 初期キーワードリスト
  userId: string; // ユーザーID
};

/**
 * エージェント思考プロセスデータ型
 */
export type AgentThoughtsData = {
  agentType: string; // エージェントタイプ
  stage: string; // 実行ステージ
  thinking: {
    step: string; // 思考ステップ
    content: string; // 思考内容
    timestamp: string; // タイムスタンプ
  }[];
  context?: any; // コンテキスト情報（任意）
};

/**
 * 進捗更新オプション型
 */
export type ProgressUpdateOptions = {
  stage?: string; // 実行ステージ
  subStage?: string; // サブステージ
  error?: boolean; // エラーフラグ
  errorMessage?: string; // エラーメッセージ
  detailedProgress?: {
    step: string; // ステップ名
    progress: number; // 進捗率（0-100）
    status: 'pending' | 'processing' | 'completed' | 'error'; // ステータス
    message?: string; // メッセージ（任意）
  }[];
};