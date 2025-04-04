/**
 * 知識グラフ生成エージェント
 * 構造化データから知識グラフを生成するAIエージェント
 */

import { AgentResult, KnowledgeGraphData, KnowledgeNode, KnowledgeEdge } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';
import { StructuringData, Category } from './structuring';
import { v4 as uuidv4 } from 'uuid';

/**
 * 知識グラフ生成入力データ
 */
export interface KnowledgeGraphInput {
  roleName: string;             // 役割名
  description: string;          // 役割の説明
  structuringData: StructuringData;  // 構造化データ
  industryAnalysisData: IndustryAnalysisData;  // 業界分析データ
  keywordExpansionData: KeywordExpansionData;  // キーワード拡張データ
  userId: string;               // ユーザーID
  roleModelId: string;          // 役割モデルID
}

/**
 * 構造化データから知識グラフを生成する
 * @param input 知識グラフ生成入力データ
 * @returns 知識グラフ生成結果
 */
export async function generateKnowledgeGraph(
  input: KnowledgeGraphInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`知識グラフ生成エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'KnowledgeGraphAgent', `役割「${input.roleName}」の知識グラフ生成を開始します。`);

    // 構造化データの検証
    if (!input.structuringData.categories || input.structuringData.categories.length === 0) {
      throw new Error('カテゴリデータが不足しています');
    }

    // ノードとエッジの配列を初期化
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    // カテゴリをノードに変換
    input.structuringData.categories.forEach(category => {
      // カテゴリノードを追加
      nodes.push({
        id: category.id,
        name: category.name,
        description: category.description,
        level: category.level,
        type: 'category',
        color: getCategoryColor(category.level),
        parentId: category.parentId || null
      });

      // 親カテゴリへのエッジを追加（存在する場合）
      if (category.parentId) {
        edges.push({
          id: uuidv4(),
          source: category.parentId,
          target: category.id,
          label: '包含',
          strength: 8
        });
      }
    });

    // カテゴリ間の関連をエッジに変換
    input.structuringData.connections.forEach(connection => {
      edges.push({
        id: uuidv4(),
        source: connection.sourceCategoryId,
        target: connection.targetCategoryId,
        label: connection.connectionType,
        strength: connection.strength
      });
    });

    // 業界情報をノードとして追加
    input.industryAnalysisData.industries.forEach(industry => {
      // 業界ノードを追加
      const industryNodeId = `industry_${industry.id}`;
      nodes.push({
        id: industryNodeId,
        name: industry.name,
        description: industry.description,
        level: 2, // 業界は第2階層に配置
        type: 'industry',
        color: '#3b82f6' // 青色
      });

      // 関連するカテゴリとの接続を検討
      const relatedCategories = findRelatedCategories(industry.name, input.structuringData.categories);
      relatedCategories.forEach(categoryId => {
        edges.push({
          id: uuidv4(),
          source: categoryId,
          target: industryNodeId,
          label: '関連',
          strength: 6
        });
      });
    });

    // キーワードをノードとして追加
    input.keywordExpansionData.keywords.forEach(keyword => {
      // キーワードノードを追加
      const keywordNodeId = `keyword_${keyword.id}`;
      nodes.push({
        id: keywordNodeId,
        name: keyword.name,
        description: keyword.description,
        level: 3, // キーワードは第3階層に配置
        type: 'keyword',
        color: '#10b981' // 緑色
      });

      // 関連するカテゴリとの接続
      const relatedCategories = findRelatedCategories(keyword.name, input.structuringData.categories);
      relatedCategories.forEach(categoryId => {
        edges.push({
          id: uuidv4(),
          source: categoryId,
          target: keywordNodeId,
          label: '関連',
          strength: 5
        });
      });
    });

    // 概念をノードとして追加
    input.keywordExpansionData.concepts.forEach(concept => {
      // 概念ノードを追加
      const conceptNodeId = `concept_${concept.id}`;
      nodes.push({
        id: conceptNodeId,
        name: concept.name,
        description: concept.description,
        level: 2, // 概念は第2階層に配置
        type: 'concept',
        color: '#8b5cf6' // 紫色
      });

      // 関連するキーワードとの接続
      concept.keywordIds.forEach(keywordId => {
        edges.push({
          id: uuidv4(),
          source: conceptNodeId,
          target: `keyword_${keywordId}`,
          label: '含む',
          strength: 7
        });
      });
    });

    // 思考過程をユーザーに共有
    sendAgentThoughts(input.userId, input.roleModelId, 'KnowledgeGraphAgent', `知識グラフを構築しました。${nodes.length}個のノードと${edges.length}個のエッジを生成しました。`);

    // 結果をログ出力
    console.log(`知識グラフ生成結果: ${nodes.length}個のノード、${edges.length}個のエッジを生成`);

    return {
      success: true,
      data: { nodes, edges }
    };

  } catch (error: any) {
    console.error('Error in knowledge graph generation:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'KnowledgeGraphAgent', `エラー: 知識グラフ生成の実行中にエラーが発生しました。`);

    return {
      success: false,
      error: `知識グラフ生成の実行中にエラーが発生しました: ${error.message}`,
      data: { nodes: [], edges: [] }
    };
  }
}

/**
 * カテゴリレベルに応じた色を取得する
 * @param level カテゴリレベル
 * @returns 色コード
 */
function getCategoryColor(level: number): string {
  switch (level) {
    case 1: return '#f97316'; // オレンジ（最上位）
    case 2: return '#ec4899'; // ピンク（第2階層）
    case 3: return '#eab308'; // 黄色（第3階層）
    default: return '#6b7280'; // グレー（その他）
  }
}

/**
 * 名前に基づいて関連するカテゴリを見つける
 * @param name 検索する名前
 * @param categories カテゴリ配列
 * @returns 関連するカテゴリIDの配列
 */
function findRelatedCategories(name: string, categories: Category[]): string[] {
  const relatedCategories: string[] = [];
  const keywords = name.toLowerCase().split(/\s+/);

  categories.forEach(category => {
    const categoryName = category.name.toLowerCase();
    const categoryDesc = category.description.toLowerCase();

    // 名前または説明に一致するキーワードがあるか確認
    for (const keyword of keywords) {
      if (keyword.length > 3 && (categoryName.includes(keyword) || categoryDesc.includes(keyword))) {
        relatedCategories.push(category.id);
        break;
      }
    }
  });

  // 関連カテゴリが見つからない場合、レベル1のカテゴリをランダムに選択
  if (relatedCategories.length === 0) {
    const topLevelCategories = categories.filter(c => c.level === 1);
    if (topLevelCategories.length > 0) {
      const randomIndex = Math.floor(Math.random() * topLevelCategories.length);
      relatedCategories.push(topLevelCategories[randomIndex].id);
    }
  }

  return relatedCategories;
}

/**
 * 指定されたノードを中心とした部分グラフを生成する
 * @param centerId 中心ノードのID
 * @param fullGraph 完全な知識グラフ
 * @param maxDepth 最大深度（デフォルト: 2）
 * @returns 部分知識グラフ
 */
export function generateSubgraph(
  centerId: string,
  fullGraph: KnowledgeGraphData,
  maxDepth: number = 2
): KnowledgeGraphData {
  const { nodes, edges } = fullGraph;
  const subgraphNodes: KnowledgeNode[] = [];
  const subgraphEdges: KnowledgeEdge[] = [];
  const visitedNodeIds = new Set<string>();

  // 中心ノードが存在するか確認
  const centerNode = nodes.find(node => node.id === centerId);
  if (!centerNode) {
    console.error(`中心ノード ${centerId} が見つかりません`);
    return { nodes: [], edges: [] };
  }

  // BFSで指定された深度までのノードとエッジを収集
  const queue: Array<{ node: KnowledgeNode, depth: number }> = [{ node: centerNode, depth: 0 }];
  visitedNodeIds.add(centerId);
  subgraphNodes.push(centerNode);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    // このノードから出るエッジを探す
    const outgoingEdges = edges.filter(edge => edge.source === node.id);
    for (const edge of outgoingEdges) {
      subgraphEdges.push(edge);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode && !visitedNodeIds.has(targetNode.id)) {
        visitedNodeIds.add(targetNode.id);
        subgraphNodes.push(targetNode);
        queue.push({ node: targetNode, depth: depth + 1 });
      }
    }

    // このノードに入るエッジを探す
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    for (const edge of incomingEdges) {
      subgraphEdges.push(edge);
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && !visitedNodeIds.has(sourceNode.id)) {
        visitedNodeIds.add(sourceNode.id);
        subgraphNodes.push(sourceNode);
        queue.push({ node: sourceNode, depth: depth + 1 });
      }
    }
  }

  return { nodes: subgraphNodes, edges: subgraphEdges };
}