/**
 * マルチエージェントオーケストレーター
 * 複数のAIエージェントを調整し、知識グラフ生成プロセスを管理する
 */

import { analyzeIndustries, IndustryAnalysisInput } from './industry-analysis';
import { expandKeywords, KeywordExpansionInput } from './keyword-expansion';
import { structureContent, StructuringInput } from './structuring';
import { generateKnowledgeGraph, KnowledgeGraphInput } from './knowledge-graph';
import { AgentResult, KnowledgeGraphData, RoleModelInput } from './types';
import { sendProgressUpdate, sendAgentThoughts } from '../websocket';

/**
 * 役割モデルの処理を実行する
 * @param input 役割モデル入力データ
 * @returns 知識グラフデータ
 */
export async function processRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`マルチエージェントオーケストレーター起動: ${input.roleName}`);
    
    // ステップ1: 業界分析エージェントを実行
    sendProgressUpdate(input.userId, input.roleModelId, 'industry_analysis', 0, { message: '業界分析を開始します' });
    
    // inputのdescriptionが任意なので、デフォルト値を設定
    const industryAnalysisInput: IndustryAnalysisInput = {
      ...input,
      description: input.description || `${input.roleName}の役割`
    };
    
    const industryAnalysisResult = await analyzeIndustries(industryAnalysisInput);
    
    if (!industryAnalysisResult.success) {
      return {
        success: false,
        error: `業界分析に失敗しました: ${industryAnalysisResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    sendProgressUpdate(input.userId, input.roleModelId, 'industry_analysis', 100, { message: '業界分析が完了しました' });
    
    // ステップ2: キーワード拡張エージェントを実行
    sendProgressUpdate(input.userId, input.roleModelId, 'keyword_expansion', 0, { message: 'キーワード拡張を開始します' });
    
    const keywordExpansionInput: KeywordExpansionInput = {
      roleName: input.roleName,
      description: input.description || `${input.roleName}の役割`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    const keywordExpansionResult = await expandKeywords(keywordExpansionInput);
    
    if (!keywordExpansionResult.success) {
      return {
        success: false,
        error: `キーワード拡張に失敗しました: ${keywordExpansionResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    sendProgressUpdate(input.userId, input.roleModelId, 'keyword_expansion', 100, { message: 'キーワード拡張が完了しました' });
    
    // ステップ3: 構造化エージェントを実行
    sendProgressUpdate(input.userId, input.roleModelId, 'structuring', 0, { message: '知識の構造化を開始します' });
    
    const structuringInput: StructuringInput = {
      roleName: input.roleName,
      description: input.description || `${input.roleName}の役割`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    const structuringResult = await structureContent(structuringInput);
    
    if (!structuringResult.success) {
      return {
        success: false,
        error: `知識の構造化に失敗しました: ${structuringResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    sendProgressUpdate(input.userId, input.roleModelId, 'structuring', 100, { message: '知識の構造化が完了しました' });
    
    // ステップ4: 知識グラフ生成エージェントを実行
    sendProgressUpdate(input.userId, input.roleModelId, 'knowledge_graph', 0, { message: '知識グラフの生成を開始します' });
    
    const knowledgeGraphInput: KnowledgeGraphInput = {
      roleName: input.roleName,
      description: input.description || `${input.roleName}の役割`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      structuringData: structuringResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    const knowledgeGraphResult = await generateKnowledgeGraph(knowledgeGraphInput);
    
    if (!knowledgeGraphResult.success) {
      return {
        success: false,
        error: `知識グラフの生成に失敗しました: ${knowledgeGraphResult.error}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    sendProgressUpdate(input.userId, input.roleModelId, 'knowledge_graph', 100, { message: '知識グラフの生成が完了しました' });
    
    // ステップ5: 完了メッセージを送信
    sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'completed',
      100,
      {
        message: `役割モデル「${input.roleName}」の処理が完了しました`,
        stats: {
          industries: industryAnalysisResult.data.industries.length,
          keywords: keywordExpansionResult.data.keywords.length,
          categories: structuringResult.data.categories.length,
          nodes: knowledgeGraphResult.data.nodes.length,
          edges: knowledgeGraphResult.data.edges.length
        }
      }
    );
    
    return {
      success: true,
      data: knowledgeGraphResult.data
    };
    
  } catch (error: any) {
    console.error('Error in processRoleModel:', error);
    
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'OrchestratorAgent',
      `エラー: 役割モデル処理の実行中にエラーが発生しました: ${error.message}`,
      'error'
    );
    
    return {
      success: false,
      error: `役割モデル処理の実行中にエラーが発生しました: ${error.message}`,
      data: { nodes: [], edges: [] }
    };
  }
}

/**
 * 産業サブカテゴリに関連するノードとエッジを保存する
 * @param roleModelId 役割モデルID
 * @param industrySubcategoryId 産業サブカテゴリID
 * @param nodes 知識ノードリスト
 * @param edges 知識エッジリスト
 */
export async function saveIndustrySubcategoryGraph(
  roleModelId: string,
  industrySubcategoryId: string,
  nodes: any[],
  edges: any[]
): Promise<boolean> {
  try {
    console.log(`産業サブカテゴリグラフの保存: ${roleModelId}, ${industrySubcategoryId}, ${nodes.length}ノード, ${edges.length}エッジ`);
    
    // ここにデータベース保存処理を実装することができます
    // 現在は成功したことにします
    
    return true;
  } catch (error: any) {
    console.error('Error in saveIndustrySubcategoryGraph:', error);
    return false;
  }
}

/**
 * キーワードに関連するノードとエッジを保存する
 * @param roleModelId 役割モデルID
 * @param keywordId キーワードID
 * @param nodes 知識ノードリスト
 * @param edges 知識エッジリスト
 */
export async function saveKeywordGraph(
  roleModelId: string,
  keywordId: string,
  nodes: any[],
  edges: any[]
): Promise<boolean> {
  try {
    console.log(`キーワードグラフの保存: ${roleModelId}, ${keywordId}, ${nodes.length}ノード, ${edges.length}エッジ`);
    
    // ここにデータベース保存処理を実装することができます
    // 現在は成功したことにします
    
    return true;
  } catch (error: any) {
    console.error('Error in saveKeywordGraph:', error);
    return false;
  }
}

/**
 * 知識グラフのサブグラフを抽出する
 * @param graphData 知識グラフデータ
 * @param centerNodeId 中心ノードID
 * @param depth 深さ（何ホップまで取得するか）
 * @returns サブグラフデータ
 */
export function extractSubgraph(
  graphData: KnowledgeGraphData,
  centerNodeId: string,
  depth: number = 2
): KnowledgeGraphData {
  // ノードIDのセットを初期化
  const nodeIds = new Set<string>([centerNodeId]);
  
  // 指定された深さまでエッジを辿ってノードを追加
  for (let i = 0; i < depth; i++) {
    const nodesToAdd = new Set<string>();
    
    // 現在のノードセットに関連するエッジを検索
    graphData.edges.forEach(edge => {
      if (nodeIds.has(edge.source) && !nodeIds.has(edge.target)) {
        nodesToAdd.add(edge.target);
      } else if (nodeIds.has(edge.target) && !nodeIds.has(edge.source)) {
        nodesToAdd.add(edge.source);
      }
    });
    
    // 新しく見つかったノードを追加
    nodesToAdd.forEach(id => nodeIds.add(id));
  }
  
  // 選択されたノードのみを含むノードリストを作成
  const nodes = graphData.nodes.filter(node => nodeIds.has(node.id));
  
  // 選択されたノード間のエッジのみを含むエッジリストを作成
  const edges = graphData.edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  
  return {
    nodes,
    edges
  };
}

/**
 * 知識グラフを拡張する（新しいノードとエッジを追加）
 * @param graphData 既存の知識グラフデータ
 * @param newNodes 追加するノード
 * @param newEdges 追加するエッジ
 * @returns 拡張された知識グラフデータ
 */
export function expandKnowledgeGraph(
  graphData: KnowledgeGraphData,
  newNodes: any[],
  newEdges: any[]
): KnowledgeGraphData {
  // 既存のノードIDを収集（重複チェック用）
  const existingNodeIds = new Set(graphData.nodes.map(node => node.id));
  
  // 重複しないノードのみを追加
  const filteredNewNodes = newNodes.filter(node => !existingNodeIds.has(node.id));
  
  // エッジの重複チェック用の関数
  const createEdgeKey = (edge: any) => `${edge.source}-${edge.target}`;
  
  // 既存のエッジキーを収集
  const existingEdgeKeys = new Set(graphData.edges.map(createEdgeKey));
  
  // 重複しないエッジのみを追加
  const filteredNewEdges = newEdges.filter(edge => 
    !existingEdgeKeys.has(createEdgeKey(edge))
  );
  
  // 既存のグラフに新しいノードとエッジを追加
  return {
    nodes: [...graphData.nodes, ...filteredNewNodes],
    edges: [...graphData.edges, ...filteredNewEdges]
  };
}

/**
 * 知識グラフから特定のノードとそれに接続するエッジを削除する
 * @param graphData 知識グラフデータ
 * @param nodeIds 削除するノードIDのリスト
 * @returns 更新された知識グラフデータ
 */
export function removeNodesFromGraph(
  graphData: KnowledgeGraphData,
  nodeIds: string[]
): KnowledgeGraphData {
  // 削除するノードIDのセット
  const nodeIdSet = new Set(nodeIds);
  
  // 指定されたノードを除外
  const filteredNodes = graphData.nodes.filter(node => !nodeIdSet.has(node.id));
  
  // 削除されたノードに接続するエッジも除外
  const filteredEdges = graphData.edges.filter(edge => 
    !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target)
  );
  
  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
}

/**
 * 知識グラフをノードタイプでフィルタリングする
 * @param graphData 知識グラフデータ
 * @param nodeTypes 含めるノードタイプのリスト
 * @returns フィルタリングされた知識グラフデータ
 */
export function filterGraphByNodeTypes(
  graphData: KnowledgeGraphData,
  nodeTypes: string[]
): KnowledgeGraphData {
  // 指定されたタイプのノードのみを含める
  const filteredNodes = graphData.nodes.filter(node => 
    node.type && nodeTypes.includes(node.type)
  );
  
  // フィルタリングされたノードのIDを収集
  const nodeIds = new Set(filteredNodes.map(node => node.id));
  
  // フィルタリングされたノード間のエッジのみを含める
  const filteredEdges = graphData.edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  
  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
}

/**
 * 階層型の知識グラフを生成する
 * @param input 役割モデル入力データ
 * @returns 階層型知識グラフデータ
 */
export function generateHierarchicalGraph(
  input: RoleModelInput
): KnowledgeGraphData {
  // ルートノード（役割）
  const roleNode = {
    id: 'role',
    name: input.roleName,
    level: 0,
    type: 'role',
    color: '#FF5733',
    description: input.description || `${input.roleName}の役割`
  };

  const nodes = [roleNode];
  const edges = [];

  // 業界ノード
  input.industries.forEach((industry, i) => {
    const industryId = `industry_${i}`;
    nodes.push({
      id: industryId,
      name: industry,
      level: 1,
      type: 'industry',
      color: '#FF33A8',
      parentId: 'role',
      description: `${industry}業界`
    });

    edges.push({
      source: 'role',
      target: industryId,
      label: 'in_industry'
    });
  });

  // キーワードノード
  input.keywords.forEach((keyword, i) => {
    const keywordId = `keyword_${i}`;
    nodes.push({
      id: keywordId,
      name: keyword,
      level: 1,
      type: 'keyword',
      color: '#00CED1',
      parentId: 'role',
      description: `キーワード: ${keyword}`
    });

    edges.push({
      source: 'role',
      target: keywordId,
      label: 'has_keyword'
    });
  });

  return {
    nodes,
    edges
  };
}

/**
 * クエリに基づいて知識グラフをフィルタリングする
 * @param graphData 知識グラフデータ
 * @param query 検索クエリ
 * @returns フィルタリングされた知識グラフデータ
 */
export function searchKnowledgeGraph(
  graphData: KnowledgeGraphData,
  query: string
): KnowledgeGraphData {
  const queryLower = query.toLowerCase();
  
  // クエリに一致するノードをフィルタリング
  const matchingNodes = graphData.nodes.filter(node => 
    node.name.toLowerCase().includes(queryLower) || 
    node.description.toLowerCase().includes(queryLower)
  );
  
  // 一致するノードのIDを収集
  const nodeIds = new Set(matchingNodes.map(node => node.id));
  
  // 一致するノード間のエッジをフィルタリング
  const matchingEdges = graphData.edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  
  return {
    nodes: matchingNodes,
    edges: matchingEdges
  };
}