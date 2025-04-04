// エージェントモジュールのエントリーポイント
// 外部からアクセスするためのインターフェースを提供します

import { RoleModelInput, KnowledgeGraphData, AgentResult } from './types';
import { orchestrateRoleModeling, orchestrateWithCrew } from './orchestrator';
// 個別エージェントのインポート（現在は直接orchestrator.tsで定義されているのでコメントアウト）
// import { industryAnalysisAgent } from './industry-analysis';
// import { keywordExpansionAgent } from './keyword-expansion';
// import { structuringAgent } from './structuring';
// import { knowledgeGraphGenerator, updateKnowledgeGraphByChat } from './knowledge-graph';
import { db } from '../db';
import { knowledgeNodes, knowledgeEdges, roleModels, type InsertKnowledgeNode, type InsertKnowledgeEdge } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// knowledgeGraphGenerator と updateKnowledgeGraphByChat の関数を再エクスポートするためのプレースホルダー
// 実際の実装が完了したら、これらを削除して実際のインポートに置き換える
const dummyKnowledgeGraphGenerator = async (input: any): Promise<AgentResult> => {
  return { result: { nodes: [], edges: [] }, metadata: {} };
};

const dummyUpdateKnowledgeGraphByChat = async (existingGraph: KnowledgeGraphData, chatPrompt: string): Promise<AgentResult> => {
  return { result: existingGraph, metadata: {} };
};

/**
 * ロールモデル定義プロセスを実行し、ナレッジグラフを生成します
 * 
 * @param input ロールモデル入力データ
 * @returns 生成されたナレッジグラフデータ
 */
export const generateRoleModelKnowledgeGraph = async (
  input: RoleModelInput
): Promise<KnowledgeGraphData> => {
  try {
    // オーケストレーターを呼び出してエージェントを連携させる
    const result = await orchestrateRoleModeling(input);
    return result.result as KnowledgeGraphData;
  } catch (error: any) {
    console.error('Error generating role model knowledge graph:', error);
    throw new Error(`Role model knowledge graph generation failed: ${error.message}`);
  }
};

/**
 * 生成されたナレッジグラフをデータベースに保存します
 * 
 * @param graphData ナレッジグラフデータ
 * @param roleModelId 関連するロールモデルのID
 * @returns 保存操作の結果
 */
export const saveKnowledgeGraphToDatabase = async (
  graphData: KnowledgeGraphData,
  roleModelId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    // トランザクションを使用して、すべてのノードとエッジを一括で保存
    // 注意: これはドライズルでの実装例です。実際の使用方法に合わせて調整してください。
    
    // 既存のノードとエッジを削除（ロールモデルに関連するもの）
    await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, String(roleModelId)));
    await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, String(roleModelId)));
    
    // 新しいノードを挿入
    for (const node of graphData.nodes) {
      const nodeData: InsertKnowledgeNode = {
        // IDは自動生成されるため、idフィールドは不要
        name: node.name,
        level: node.level,
        parentId: node.parentId || null,
        description: node.description || null,
        color: node.color || null,
        roleModelId: String(roleModelId)
      };
      
      await db.insert(knowledgeNodes).values(nodeData);
    }
    
    // 新しいエッジを挿入
    for (const edge of graphData.edges) {
      const edgeData: InsertKnowledgeEdge = {
        sourceId: edge.source,
        targetId: edge.target,
        label: edge.label || null,
        strength: edge.strength || 1.0,
        roleModelId: String(roleModelId)
      };
      
      await db.insert(knowledgeEdges).values(edgeData);
    }
    
    // ロールモデルのステータスを更新（ナレッジグラフが生成済みであることを示す）
    // 注：roleModelsテーブルにhasKnowledgeGraphフィールドが存在する場合にコメントを解除
    // await db
    //   .update(roleModels)
    //   .set({ hasKnowledgeGraph: true })
    //   .where(eq(roleModels.id, String(roleModelId)));
    
    return {
      success: true,
      message: `Knowledge graph saved successfully with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`
    };
  } catch (error: any) {
    console.error('Error saving knowledge graph to database:', error);
    throw new Error(`Failed to save knowledge graph: ${error.message}`);
  }
};

/**
 * ロールモデルのナレッジグラフをデータベースから取得します
 * 
 * @param roleModelId ロールモデルのID
 * @returns ナレッジグラフデータ
 */
export const getKnowledgeGraphForRoleModel = async (
  roleModelId: number
): Promise<KnowledgeGraphData> => {
  try {
    // ノードを取得
    const nodes = await db
      .select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.roleModelId, String(roleModelId)));
    
    // エッジを取得
    const edges = await db
      .select()
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.roleModelId, String(roleModelId)));
    
    // KnowledgeGraphData形式に変換
    const graphData: KnowledgeGraphData = {
      nodes: nodes.map(node => ({
        id: node.id, // idは常に存在する
        name: node.name,
        level: node.level,
        parentId: node.parentId,
        description: node.description,
        color: node.color
      })),
      edges: edges.map(edge => ({
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.label,
        strength: edge.strength === null ? undefined : edge.strength
      }))
    };
    
    return graphData;
  } catch (error: any) {
    console.error('Error fetching knowledge graph from database:', error);
    throw new Error(`Failed to fetch knowledge graph: ${error.message}`);
  }
};

// このモジュールで公開する関数
export {
  orchestrateRoleModeling,
  orchestrateWithCrew,
  // 個別エージェント（現在はorchestrator.tsで定義）
  dummyKnowledgeGraphGenerator as knowledgeGraphGenerator,
  dummyUpdateKnowledgeGraphByChat as updateKnowledgeGraphByChat
};