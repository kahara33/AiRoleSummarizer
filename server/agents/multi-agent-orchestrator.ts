/**
 * マルチエージェントオーケストレーター
 * 異なるAIエージェント（CrewAI, LangChain, LlamaIndex）間の連携を管理
 */

import { processRoleModelWithCrewAI } from './crewai-agents';
import { callLangChainTool } from './langchain-utils';
import { callLlamaIndexTool, queryLlamaIndex, summarizeWithLlamaIndex } from './llamaindex-utils';
import { KnowledgeGraphData, RoleModelInput } from './index';
import { sendProgressUpdate } from '../websocket';
// Azure OpenAIのファイルから関数をインポート
// Import Neo4j functions for saving knowledge graph data
import { createNode, createRelationship } from '../neo4j';

/**
 * マルチエージェントオーケストレーション
 * 役割モデルの知識グラフを生成するプロセス全体を管理
 * 
 * @param input 役割モデル入力データ
 * @returns 生成された知識グラフデータ
 */
export async function orchestrateAgents(input: RoleModelInput): Promise<KnowledgeGraphData> {
  console.log('マルチエージェントオーケストレーション開始', input);
  
  try {
    sendProgressUpdate('マルチエージェントオーケストレーションを開始します', 0, input.roleModelId);
    
    // ステップ1: 初期データ収集 (LangChain)
    sendProgressUpdate('初期データ収集を実行中...', 5, input.roleModelId);
    const initialDataPromise = callLangChainTool('web-search', {
      query: `${input.roleName} ${input.industries.join(' ')} 最新動向`
    }, input.roleModelId, 'Orchestrator');
    
    // ステップ2: キーワード拡張 (LangChain) - 並行処理
    sendProgressUpdate('キーワード拡張を準備中...', 10, input.roleModelId);
    const keywordExpansionPromise = callLangChainTool('keyword-expansion', { 
      baseKeywords: input.keywords,
      query: `${input.roleName} 関連キーワード`
    }, input.roleModelId, 'Orchestrator');
    
    // 並行処理の結果を取得
    const [initialData, expandedKeywords] = await Promise.all([
      initialDataPromise,
      keywordExpansionPromise
    ]);
    
    // ステップ3: CrewAIによる知識グラフ生成 (CrewAI)
    sendProgressUpdate('CrewAIによる処理を開始します', 20, input.roleModelId);
    const crewAIResult = await processRoleModelWithCrewAI(input);
    
    // ステップ4: 知識構造化 (LlamaIndex)
    sendProgressUpdate('LlamaIndexによる知識構造化を開始します', 60, input.roleModelId);
    await callLlamaIndexTool('structure-knowledge', {
      keywords: input.keywords,
      roleName: input.roleName
    }, input.roleModelId, 'Orchestrator');
    
    // ステップ5: 最終的な知識グラフの生成と最適化
    sendProgressUpdate('最終知識グラフを作成します', 80, input.roleModelId);
    
    // 知識グラフをデータベースに保存
    let saveSuccess = true;
    try {
      // 各ノードをNeo4jに保存
      for (const node of crewAIResult.nodes) {
        await createNode(
          'KnowledgeNode', 
          {
            id: node.id,
            name: node.name,
            level: node.level,
            type: node.type || 'default',
            parentId: node.parentId || null,
            description: node.description || null,
            color: node.color || null
          },
          input.roleModelId
        );
      }
      
      // 各エッジをNeo4jに保存
      for (const edge of crewAIResult.edges) {
        await createRelationship(
          edge.source,
          edge.target,
          'CONNECTS_TO',
          { 
            label: edge.label || null,
            strength: edge.strength || 0.5
          },
          input.roleModelId
        );
      }
    } catch (error) {
      console.error('Neo4jへの保存エラー:', error);
      saveSuccess = false;
    }
    
    if (saveSuccess) {
      sendProgressUpdate(`知識グラフをデータベースに保存しました`, 100, input.roleModelId);
      console.log(`Successfully created knowledge graph for ${input.roleName}`);
    } else {
      sendProgressUpdate(`知識グラフの保存中にエラーが発生しました`, 90, input.roleModelId, {
        message: '知識グラフの保存中にエラーが発生しました',
        progress: 90,
        error: true,
        errorMessage: '知識グラフをデータベースに保存できませんでした'
      });
      console.error(`Failed to save knowledge graph for ${input.roleName}`);
    }
    
    return crewAIResult;
  } catch (error) {
    console.error('マルチエージェントオーケストレーションエラー:', error);
    sendProgressUpdate(`エラーが発生しました: ${error instanceof Error ? error.message : '未知のエラー'}`, 
      0, input.roleModelId, { 
        message: `エラーが発生しました: ${error instanceof Error ? error.message : '未知のエラー'}`,
        progress: 0,
        error: true,
        errorMessage: error instanceof Error ? error.message : '未知のエラー'
      });
    
    // エラー時は空の知識グラフを返す
    return { nodes: [], edges: [] };
  }
}