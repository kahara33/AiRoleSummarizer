/**
 * エージェント関連機能のエクスポートファイル
 */

// 各種エージェント実装をエクスポート
export { processRoleModelWithCrewAI } from './crewai-agents';
export { orchestrateAgents } from './multi-agent-orchestrator';
import { orchestrateAgents } from './multi-agent-orchestrator';

// ツールとユーティリティ関数をエクスポート
export { callLangChainTool } from './langchain-utils';
export { callLlamaIndexTool, queryLlamaIndex, summarizeWithLlamaIndex } from './llamaindex-utils';

// 型定義を直接提供（types.tsからコピー）
export type KnowledgeNodeData = {
  id: string;
  name: string;
  level: number;
  type?: string;
  parentId?: string | null;
  description?: string | null;
  color?: string | null;
};

export type RoleModelInput = {
  roleModelId: string;
  roleName: string;
  description: string;
  industries: string[];
  keywords: string[];
  userId: string;
};

// KnowledgeGraphDataの型定義を直接提供
export type KnowledgeGraphData = {
  nodes: {
    id: string;
    name: string;
    level: number;
    type?: string;
    parentId?: string | null;
    description?: string | null;
    color?: string | null;
  }[];
  edges: {
    source: string;
    target: string;
    label?: string | null;
    strength?: number;
  }[];
};

/**
 * エージェント処理結果の汎用型
 */
export type AgentResult = {
  success: boolean;
  data: any;
  error?: string;
};

/**
 * CrewAIを使った知識グラフ生成関数
 * routes.tsから呼び出されるインターフェース
 */
export async function generateKnowledgeGraphWithCrewAI(input: RoleModelInput): Promise<{success: boolean; data: any; error?: string}> {
  try {
    // multi-agent-orchestrator.tsの関数を呼び出す
    const graphData = await orchestrateAgents(input);
    
    // 成功したらデータを返す
    return {
      success: true,
      data: graphData
    };
  } catch (error) {
    console.error('CrewAIによる知識グラフ生成エラー:', error);
    return {
      success: false,
      data: { nodes: [], edges: [] },
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    };
  }
}