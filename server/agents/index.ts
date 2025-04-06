/**
 * マルチエージェントシステムのエントリーポイント
 * 役割モデル用の知識グラフを生成する処理を提供する
 */

import { processRoleModel } from './multi-agent-orchestrator';
import { processRoleModelWithCrewAI } from './crewai-agents';
import { KnowledgeGraphData, RoleModelInput, AgentResult } from './types';
export * from './langchain-utils';
export * from './llamaindex-utils';

/**
 * 役割モデルのための知識グラフを生成する
 * @param input 役割モデル入力データ
 * @returns 知識グラフデータ
 */
export async function generateKnowledgeGraphForRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  // マルチエージェントオーケストレーターに処理を委譲
  return await processRoleModel(input);
}

/**
 * CrewAI を使用して役割モデルの知識グラフを生成する
 * @param input 役割モデル入力データ
 * @returns 知識グラフデータ
 */
export async function generateKnowledgeGraphWithCrewAI(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    const graphData = await processRoleModelWithCrewAI(input);
    return {
      success: true,
      data: graphData
    };
  } catch (error) {
    console.error('CrewAI を使用した知識グラフ生成エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: { nodes: [], edges: [] }
    };
  }
}