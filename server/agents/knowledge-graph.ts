// ナレッジグラフ生成エージェント
// 構造化された情報からナレッジグラフデータを生成するエージェント

import { AgentResult, KnowledgeGraphData, KnowledgeNode, KnowledgeEdge, RoleModelInput } from './types';
import { v4 as uuidv4 } from 'uuid';

interface KnowledgeGraphInput extends RoleModelInput {
  structure?: any;
}

/**
 * ナレッジグラフ生成エージェント
 * 構造化データからD3.js互換のナレッジグラフデータを生成します
 */
export const knowledgeGraphGenerator = async (
  input: KnowledgeGraphInput
): Promise<AgentResult> => {
  try {
    console.log('Generating knowledge graph for role:', input.roleName);
    
    // 構造化データが利用可能か確認
    if (!input.structure || !input.structure.hierarchicalStructure) {
      throw new Error('Hierarchical structure is required for knowledge graph generation');
    }
    
    const { rootNode, childNodes } = input.structure.hierarchicalStructure;
    
    // ノードの色を階層レベルに基づいて割り当てる関数
    const getNodeColor = (level: number): string => {
      const colors = [
        '#4C51BF', // インディゴ-800 (ルートノード)
        '#2C5282', // ブルー-800 (レベル1)
        '#2B6CB0', // ブルー-700 (レベル2)
        '#3182CE', // ブルー-600 (レベル3)
      ];
      return colors[Math.min(level, colors.length - 1)];
    };
    
    // ノードとエッジの配列を生成
    const nodes: KnowledgeNode[] = [
      {
        id: rootNode.id,
        name: rootNode.name,
        level: rootNode.level,
        description: rootNode.description,
        color: getNodeColor(rootNode.level)
      }
    ];
    
    const edges: KnowledgeEdge[] = [];
    
    // 子ノードをナレッジグラフデータに変換
    childNodes.forEach((node: any) => {
      // ノードを追加
      nodes.push({
        id: node.id,
        name: node.name,
        level: node.level,
        parentId: node.parentId,
        description: node.description,
        color: getNodeColor(node.level)
      });
      
      // エッジを追加（親ノードとの接続）
      if (node.parentId) {
        edges.push({
          source: node.parentId,
          target: node.id,
          strength: 1.0 - (node.level * 0.2) // レベルが深いほど強度は低くなる
        });
      }
    });
    
    // 結果をKnowledgeGraphData形式で返す
    const graphData: KnowledgeGraphData = {
      nodes,
      edges
    };
    
    return {
      result: graphData,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        maxLevel: Math.max(...nodes.map(node => node.level))
      }
    };
  } catch (error: any) {
    console.error('Error in knowledge graph generator:', error);
    throw new Error(`Knowledge graph generation failed: ${error.message}`);
  }
};

/**
 * 知識グラフの追加更新（チャットを通じた対話的な更新）
 */
export const updateKnowledgeGraphByChat = async (
  existingGraph: KnowledgeGraphData,
  chatPrompt: string
): Promise<AgentResult> => {
  try {
    // この関数は今後実装予定です
    // チャットからの入力に基づいて既存のナレッジグラフを更新します
    
    // 現時点では既存のグラフをそのまま返します
    return {
      result: existingGraph,
      metadata: {
        updated: false,
        reason: 'Chat-based updates not yet implemented'
      }
    };
  } catch (error: any) {
    console.error('Error in updating knowledge graph by chat:', error);
    throw new Error(`Knowledge graph update failed: ${error.message}`);
  }
};