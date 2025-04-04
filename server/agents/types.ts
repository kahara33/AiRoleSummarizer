/**
 * マルチAIエージェントシステムで使用する共通型定義
 */

/**
 * 役割モデル入力データ
 * エージェントへの入力として使用
 */
export interface RoleModelInput {
  id?: string;                 // 役割モデルID
  roleModelId?: string;        // 役割モデルID（idと同じ）
  userId: string;              // ユーザーID
  roleName: string;            // 役割名
  description?: string;        // 役割の説明
  industries: string[];        // 関連業界リスト
  keywords: string[];          // 関連キーワードリスト
}

/**
 * エージェント処理結果
 * 成功/失敗とデータまたはエラーメッセージを含む
 */
export interface AgentResult<T> {
  success: boolean;            // 処理成功フラグ
  data: T;                     // 処理結果データ
  error?: string;              // エラーメッセージ
}

/**
 * ナレッジグラフノード
 */
export interface KnowledgeNode {
  id?: string;                 // ノードID
  name: string;                // ノード名
  level: number;               // 階層レベル
  description?: string;        // 説明
  type?: string;               // ノードタイプ
  color?: string;              // 表示色
  parentId?: string | null;    // 親ノードID
}

/**
 * ナレッジグラフエッジ
 */
export interface KnowledgeEdge {
  id?: string;                 // エッジID
  source: string;              // 始点ノードID
  target: string;              // 終点ノードID
  label?: string;              // エッジラベル
  strength?: number;           // 関連強度
}

/**
 * ナレッジグラフデータ
 * ノードとエッジの集合
 */
export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];      // ノードリスト
  edges: KnowledgeEdge[];      // エッジリスト
}

/**
 * WebSocket進捗状況更新データ
 */
export interface ProgressUpdate {
  userId: string;              // ユーザーID
  roleModelId: string;         // 役割モデルID
  stage: string;               // 処理ステージ
  progress: number;            // 進捗率（0-100）
  data?: any;                  // 追加データ
}

/**
 * WebSocketエージェント思考データ
 */
export interface AgentThought {
  userId: string;              // ユーザーID
  roleModelId: string;         // 役割モデルID
  agentName: string;           // エージェント名
  thought: string;             // 思考内容
  timestamp: number;           // タイムスタンプ
}