/**
 * マルチエージェントオーケストレーター
 * 複数のAIエージェントの調整と実行を管理
 */

import { RoleModelInput, AgentResult, KnowledgeGraphData } from './types';
import { analyzeIndustries, IndustryAnalysisData, IndustryAnalysisInput } from './industry-analysis';
import { expandKeywords, KeywordExpansionData, KeywordExpansionInput } from './keyword-expansion';
import { structureContent, StructuringData, StructuringInput } from './structuring';
import { generateKnowledgeGraph, KnowledgeGraphInput } from './knowledge-graph';
import { sendProgressUpdate, sendAgentThoughts } from '../websocket';

/**
 * マルチエージェントによる役割モデル生成処理を実行
 * @param input 役割モデル入力データ
 * @returns 生成された知識グラフデータ
 */
export async function processRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    const roleModelId = input.roleModelId || input.id || '';
    
    // 進捗状況の初期化
    sendProgressUpdate(input.userId, roleModelId, 'starting', 0);
    
    // 1. 業界分析エージェント
    sendProgressUpdate(input.userId, roleModelId, 'industry_analysis', 10);
    
    const industryAnalysisInput: IndustryAnalysisInput = {
      roleName: input.roleName,
      description: input.description || '',
      industries: input.industries,
      userId: input.userId,
      roleModelId: roleModelId
    };
    
    const industryAnalysisResult = await analyzeIndustries(industryAnalysisInput);
    
    if (!industryAnalysisResult.success) {
      return {
        success: false,
        error: `業界分析エラー: ${industryAnalysisResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // 2. キーワード拡張エージェント
    sendProgressUpdate(input.userId, roleModelId, 'keyword_expansion', 30);
    
    const keywordExpansionInput: KeywordExpansionInput = {
      roleName: input.roleName,
      description: input.description || '',
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      userId: input.userId,
      roleModelId: roleModelId
    };
    
    const keywordExpansionResult = await expandKeywords(keywordExpansionInput);
    
    if (!keywordExpansionResult.success) {
      return {
        success: false,
        error: `キーワード拡張エラー: ${keywordExpansionResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // 3. 構造化エージェント
    sendProgressUpdate(input.userId, roleModelId, 'structuring', 50);
    
    const structuringInput: StructuringInput = {
      roleName: input.roleName,
      description: input.description || '',
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      userId: input.userId,
      roleModelId: roleModelId
    };
    
    const structuringResult = await structureContent(structuringInput);
    
    if (!structuringResult.success) {
      return {
        success: false,
        error: `構造化エラー: ${structuringResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // 4. 知識グラフ生成エージェント
    sendProgressUpdate(input.userId, roleModelId, 'knowledge_graph', 70);
    
    const knowledgeGraphInput: KnowledgeGraphInput = {
      roleName: input.roleName,
      description: input.description || '',
      structuringData: structuringResult.data,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      userId: input.userId,
      roleModelId: roleModelId
    };
    
    const knowledgeGraphResult = await generateKnowledgeGraph(knowledgeGraphInput);
    
    if (!knowledgeGraphResult.success) {
      return {
        success: false,
        error: `知識グラフ生成エラー: ${knowledgeGraphResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // 処理完了
    sendProgressUpdate(input.userId, roleModelId, 'completed', 100, {
      nodeCount: knowledgeGraphResult.data.nodes.length,
      edgeCount: knowledgeGraphResult.data.edges.length
    });
    
    sendAgentThoughts(input.userId, roleModelId, 'OrchestratorAgent', `役割モデル「${input.roleName}」の処理が完了しました。${knowledgeGraphResult.data.nodes.length}個のノードと${knowledgeGraphResult.data.edges.length}個のエッジを持つ知識グラフを生成しました。`);
    
    return knowledgeGraphResult;
    
  } catch (error: any) {
    console.error('Error in multi-agent orchestrator:', error);
    
    return {
      success: false,
      error: `マルチエージェント処理エラー: ${error.message}`,
      data: { nodes: [], edges: [] }
    };
  }
}