// AIエージェントの共通型定義

/**
 * エージェント入力データ: 役割モデル情報
 */
export interface RoleModelInput {
  id: string;              // 役割モデルのID
  roleName: string;        // 役割モデルの名前
  description?: string;    // 役割の説明
  industries: string[];    // 関連業界
  keywords: string[];      // 関連キーワード
  organizationId?: string; // 組織ID（オプション）
  userId: string;          // ユーザーID
  roleModelId?: string;    // 役割モデルのID（DBアクセス用、idと同じ値）
}

/**
 * ナレッジグラフノード
 */
export interface KnowledgeNode {
  id: string;          // ノードの一意識別子
  name: string;        // ノード名（表示用）
  description?: string;// ノードの説明
  level: number;       // 階層レベル（0: ルート、1: 第一階層、...）
  parentId?: string;   // 親ノードID（ルートの場合はnull/undefined）
  type?: string;       // ノードタイプ（central, category, subcategory, skill, keyword など）
  color?: string;      // ノードの色
}

/**
 * ナレッジグラフエッジ（辺）
 */
export interface KnowledgeEdge {
  source: string;      // 始点ノードID
  target: string;      // 終点ノードID
  label?: string;      // 関係性のラベル
  strength?: number;   // 関係の強さ（0.0-1.0）
}

/**
 * ナレッジグラフ全体データ
 */
export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];  // ノードの配列
  edges: KnowledgeEdge[];  // エッジの配列
}

/**
 * エージェント実行結果の共通型
 */
export interface AgentResult<T> {
  success: boolean;    // 処理成功したかどうか
  data?: T;            // 成功時のデータ
  error?: string;      // エラーメッセージ
}