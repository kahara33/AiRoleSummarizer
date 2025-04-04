/**
 * AIエージェントシステムのメインモジュール
 * エージェント処理のオーケストレーションと結果の保存を担当
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { knowledgeNodes, knowledgeEdges } from '@shared/schema';
import { RoleModelInput, KnowledgeGraphData, KnowledgeNode, KnowledgeEdge } from './types';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket';
import { processRoleModel } from './multi-agent-orchestrator';

/**
 * 知識グラフ生成のメインプロセスを実行
 * マルチAIエージェントを呼び出して知識グラフを構築する
 */
export async function generateKnowledgeGraphForRoleModel(
  input: RoleModelInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 役割モデルIDの設定（なければ生成）
    const roleModelId = input.roleModelId || input.id;
    if (!roleModelId) {
      throw new Error('Role model ID is required');
    }
    
    // WebSocketで開始通知
    if (input.userId) {
      sendProgressUpdate(
        input.userId,
        roleModelId,
        'グラフ生成',
        0,
        { stage: '開始', message: '知識グラフ生成プロセスを開始します' }
      );
      
      sendAgentThoughts(
        input.userId,
        roleModelId,
        'システム',
        `知識グラフ生成プロセスを開始します。\n役割モデル: ${input.roleName}\n\nマルチAIエージェントシステムを初期化しています...`
      );
    }

    // 既存のノードとエッジを削除
    await db.delete(knowledgeNodes).where('roleModelId = $1', [roleModelId]);
    await db.delete(knowledgeEdges).where('roleModelId = $1', [roleModelId]);

    // マルチAIエージェントシステムで知識グラフを生成
    const result = await processRoleModel({
      ...input,
      roleModelId,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || '知識グラフの生成に失敗しました');
    }

    // 生成されたグラフデータをデータベースに保存
    await saveGeneratedGraph(roleModelId, result.data);

    // WebSocketで完了通知
    if (input.userId) {
      sendProgressUpdate(
        input.userId,
        roleModelId,
        'グラフ生成',
        100,
        { 
          stage: '完了', 
          message: '知識グラフが正常に生成されました',
          counts: {
            nodes: result.data.nodes.length,
            edges: result.data.edges.length
          }
        }
      );
      
      sendAgentThoughts(
        input.userId,
        roleModelId,
        'システム',
        `知識グラフ生成が完了しました。\n\nノード数: ${result.data.nodes.length}\nエッジ数: ${result.data.edges.length}\n\n処理を終了します。`
      );
    }

    return {
      success: true,
      message: `Knowledge graph generated successfully with ${result.data.nodes.length} nodes and ${result.data.edges.length} edges`,
    };
  } catch (error) {
    console.error('Error in generateKnowledgeGraphForRoleModel:', error);
    
    // WebSocketでエラー通知
    if (input.userId && input.roleModelId) {
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'システム',
        `エラーが発生しました。処理を中断します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in knowledge graph generation',
    };
  }
}

/**
 * 生成された知識グラフデータをデータベースに保存
 */
async function saveGeneratedGraph(roleModelId: string, graphData: KnowledgeGraphData): Promise<void> {
  try {
    console.log(`Saving knowledge graph for role model: ${roleModelId}`);
    console.log(`Nodes: ${graphData.nodes.length}, Edges: ${graphData.edges.length}`);

    // ノードの保存
    for (const node of graphData.nodes) {
      const nodeData = {
        id: node.id || uuidv4(),
        roleModelId,
        name: node.name,
        description: node.description || '',
        level: node.level,
        type: node.type || 'default',
        color: node.color || '#CCCCCC',
        parentId: node.parentId || null,
      };

      await db.insert(knowledgeNodes).values(nodeData);
      console.log(`Created node: ${nodeData.name} -> ${nodeData.id}`);
    }

    // エッジの保存
    for (const edge of graphData.edges) {
      const edgeData = {
        id: uuidv4(),
        roleModelId,
        source: edge.source,
        target: edge.target,
        label: edge.label || null,
        strength: edge.strength || 1.0,
      };

      await db.insert(knowledgeEdges).values(edgeData);
      console.log(`Created edge: ${edgeData.source} -> ${edgeData.target}`);
    }

    console.log(`Successfully created knowledge graph for ${roleModelId} with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
  } catch (error) {
    console.error('Error saving generated graph:', error);
    throw error;
  }
}