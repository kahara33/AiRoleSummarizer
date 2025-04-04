/**
 * マルチエージェントシステムのエントリーポイント
 * 役割モデル用の知識グラフを生成する処理を提供する
 */

import { processRoleModel } from './multi-agent-orchestrator';
import { KnowledgeGraphData, RoleModelInput, AgentResult } from './types';

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