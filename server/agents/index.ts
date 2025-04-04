// AIエージェントのエントリポイント
// 知識グラフ生成のための複数エージェントを連携させる

import { RoleModelInput, KnowledgeGraphData, AgentResult } from './types';
import { callAzureOpenAI } from '../azure-openai';
import { orchestrator, fallbackGraphGeneration } from './orchestrator';
import { db } from '../db';
import { knowledgeNodes, knowledgeEdges } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

/**
 * 知識グラフ生成のメインプロセスを実行
 * 複数のAIエージェントを呼び出して知識グラフを構築する
 */
export async function generateKnowledgeGraphForRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    // 処理開始ログ
    console.log(`Starting knowledge graph generation for ${input.roleName}`);
    console.log(`Industries: ${input.industries.join(', ')}`);
    console.log(`Keywords: ${input.keywords.join(', ')}`);
    
    // roleModelIdがない場合は、idを使用
    if (!input.roleModelId) {
      input.roleModelId = input.id;
    }

    // AIオーケストレーターを実行
    const result = await orchestrator(input);
    
    if (result.success && result.data) {
      // 成功した場合、グラフデータをDBに保存
      await saveGeneratedGraph(input.id, result.data);
      return result;
    } else {
      // エラーが発生した場合、フォールバック処理を実行
      console.log(`Orchestration failed: ${result.error}. Using fallback generation.`);
      
      const fallbackResult = await fallbackGraphGeneration(input);
      
      if (fallbackResult.success && fallbackResult.data) {
        // フォールバックが成功した場合、グラフデータをDBに保存
        await saveGeneratedGraph(input.id, fallbackResult.data);
      }
      
      return fallbackResult;
    }
  } catch (error: any) {
    console.error('Error in knowledge graph generation:', error);
    return {
      success: false,
      error: `Knowledge graph generation failed: ${error.message}`
    };
  }
}

/**
 * 生成された知識グラフデータをデータベースに保存
 */
async function saveGeneratedGraph(roleModelId: string, graphData: KnowledgeGraphData): Promise<void> {
  try {
    console.log(`Saving knowledge graph for role model ${roleModelId}`);
    console.log(`Nodes: ${graphData.nodes.length}, Edges: ${graphData.edges.length}`);
    
    // 既存のノードとエッジを削除（再生成の場合）
    console.log('Removing existing nodes and edges...');
    await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId));
    await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId));
    
    // ノードをデータベースに保存
    for (const node of graphData.nodes) {
      const nodeData = {
        roleModelId,
        name: node.name,
        description: node.description || null,
        parentId: node.parentId || null,
        level: node.level || 0,
        type: node.type || 'default',
        color: node.color || '#4C51BF'
      };
      
      // IDの設定はスキーマで自動生成されるので省略
      
      await db.insert(knowledgeNodes).values(nodeData);
    }
    
    // エッジをデータベースに保存
    for (const edge of graphData.edges) {
      const edgeData = {
        roleModelId,
        sourceId: edge.source,
        targetId: edge.target,
        label: edge.label || null,
        strength: edge.strength || 1.0
      };
      
      await db.insert(knowledgeEdges).values(edgeData);
    }
    
    console.log('Knowledge graph saved successfully');
  } catch (error: any) {
    console.error('Error saving knowledge graph:', error);
    throw new Error(`Failed to save knowledge graph: ${error.message}`);
  }
}