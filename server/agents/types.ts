/**
 * エージェントシステム共通型定義
 * 複数のAIエージェント間で共有される型の定義
 */

/**
 * 役割モデル入力データ
 */
export interface RoleModelInput {
  roleName: string;           // 役割名
  description?: string;       // 役割の説明
  industries: string[];       // 選択された業界
  keywords: string[];         // 初期キーワード
  userId: string;             // ユーザーID
  roleModelId: string;        // 役割モデルID
}

/**
 * 知識ノード
 */
export interface KnowledgeNode {
  id: string;                 // ノードID
  name: string;               // ノード名
  description: string;        // 説明
  level: number;              // 階層レベル（0がルート）
  type?: string;              // ノードタイプ
  color?: string;             // 表示色
  parentId?: string;          // 親ノードID
}

/**
 * 知識エッジ
 */
export interface KnowledgeEdge {
  source: string;             // 始点ノードID
  target: string;             // 終点ノードID
  label?: string;             // ラベル
  strength?: number;          // 関連強度
}

/**
 * 知識グラフデータ
 */
export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];     // ノードリスト
  edges: KnowledgeEdge[];     // エッジリスト
}

/**
 * 業界分析データ
 */
export interface IndustryAnalysisInput extends RoleModelInput {}

export interface IndustryAnalysisData {
  industries: string[];       // 分析された業界
  keywords: string[];         // 関連キーワード
  description: string;        // 業界の詳細説明
}

/**
 * キーワード拡張入力データ
 */
export interface KeywordExpansionInput extends RoleModelInput {
  industries: string[];      // 業界リスト
  keywords: string[];        // 初期キーワード
}

/**
 * キーワード拡張データ
 */
export interface KeywordExpansionData {
  expandedKeywords: string[];    // 拡張されたキーワード
  keywordRelations: Array<{      // キーワード間の関係
    source: string;
    target: string;
    strength: number;
  }>;
}

/**
 * 構造化入力データ
 */
export interface StructuringInput extends KeywordExpansionInput {
  expandedKeywords: string[];    // 拡張されたキーワード
  keywordRelations: Array<{      // キーワード間の関係
    source: string;
    target: string;
    strength: number;
  }>;
}

/**
 * カテゴリとサブカテゴリの構造
 */
export interface Category {
  name: string;
  description: string;
  subcategories: Subcategory[];
}

export interface Subcategory {
  name: string;
  description: string;
  skills: Skill[];
}

export interface Skill {
  name: string;
  description: string;
  importance: number; // 1-10
}

/**
 * 構造化データ
 */
export interface StructuringData {
  structuredContent: Category[];
  entities: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    level: number;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
}

/**
 * 知識グラフ入力データ
 */
export interface KnowledgeGraphInput extends StructuringInput {
  structuredContent: Category[];
  entities: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    level: number;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
}

/**
 * エージェント結果
 */
export interface AgentResult<T> {
  success: boolean;           // 成功したかどうか
  error?: string | Error;     // エラーメッセージまたはエラーオブジェクト
  data: T;                    // 結果データ
}

/**
 * 進捗ステップ状態
 */
export type ProgressStatus = 'pending' | 'processing' | 'completed' | 'error';

/**
 * 詳細な進捗ステップ
 */
export interface ProgressStep {
  step: string;               // ステップ名
  progress: number;           // 進捗率（0-100）
  status: ProgressStatus;     // ステータス
  message?: string;           // メッセージ
}

/**
 * エージェント進捗状況
 */
export interface AgentProgress {
  stage: string;                    // 現在のステージ
  subStage?: string;                // サブステージ
  progress: number;                 // 進捗率（0-100）
  message: string;                  // メッセージ
  detailedProgress?: ProgressStep[]; // 詳細な進捗情報
  details?: any;                    // その他の詳細情報
}

/**
 * エージェント出力メッセージ
 */
export interface AgentOutputMessage {
  timestamp: number;          // タイムスタンプ
  agentName: string;          // エージェント名
  message: string;            // メッセージ内容
  type: 'info' | 'error' | 'success' | 'thinking';  // メッセージタイプ
}