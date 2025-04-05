/**
 * 知識グラフ生成エージェント
 * 階層的な知識構造から視覚化可能な知識グラフを生成するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
export { KnowledgeGraphInput } from './types';
import { 
  AgentResult, KnowledgeGraphInput, KnowledgeGraphData,
  KnowledgeNode, KnowledgeEdge 
} from './types';
import { callAzureOpenAI } from '../azure-openai';
import { sendAgentThoughts } from '../websocket';

/**
 * 知識グラフを生成する
 * @param input 知識グラフ入力データ
 * @returns 知識グラフデータ
 */
export async function generateKnowledgeGraph(
  input: KnowledgeGraphInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`知識グラフ生成開始: ${input.roleName}`);
    
    // AIを使用した本格的な実装の例
    sendAgentThoughts('Knowledge Graph Agent', `${input.roleName}の知識グラフ生成を行います。エンティティ数: ${input.entities.length}`, input.roleModelId);
    
    // モック実装 - 実際の実装では、ここでAzure OpenAIを呼び出す
    
    // ノードとエッジの抽出
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    
    // エンティティからノードへの変換
    input.entities.forEach(entity => {
      const node: KnowledgeNode = {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        level: entity.level,
        type: entity.type,
        color: getColorForEntityType(entity.type)
      };
      
      nodes.push(node);
    });
    
    // リレーションシップからエッジへの変換
    input.relationships.forEach(rel => {
      const edge: KnowledgeEdge = {
        source: rel.source,
        target: rel.target,
        label: rel.type.replace(/_/g, ' '),
        strength: rel.strength
      };
      
      edges.push(edge);
    });
    
    // 追加の関連性生成
    // 同じレベルのノード間の関連性も追加（実際の実装ではAIを使用）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        // 同じタイプで同じレベルのノードの場合、5%の確率で関連を追加
        if (node1.type === node2.type && node1.level === node2.level && Math.random() < 0.05) {
          edges.push({
            source: node1.id,
            target: node2.id,
            label: '関連',
            strength: 0.3 + Math.random() * 0.3 // 0.3〜0.6の範囲
          });
        }
      }
    }
    
    // 知識グラフデータを返す
    return {
      success: true,
      data: {
        nodes,
        edges
      }
    };
    
  } catch (error) {
    console.error('知識グラフ生成エラー:', error);
    
    return {
      success: false,
      error: `知識グラフ生成エージェントエラー: ${error instanceof Error ? error.message : String(error)}`,
      data: {
        nodes: [],
        edges: []
      }
    };
  }
}

/**
 * エンティティタイプに応じた色を取得する
 * @param type エンティティタイプ
 * @returns 色コード
 */
function getColorForEntityType(type: string): string {
  switch (type?.toLowerCase()) {
    case 'role':
      return '#ff6b6b'; // 赤
    case 'category':
      return '#48dbfb'; // 青
    case 'subcategory':
      return '#1dd1a1'; // 緑
    case 'skill':
      return '#feca57'; // 黄
    case 'concept':
      return '#5f27cd'; // 紫
    case 'tool':
      return '#ff9ff3'; // ピンク
    case 'knowledge':
      return '#54a0ff'; // 水色
    default:
      return '#c8d6e5'; // グレー
  }
}