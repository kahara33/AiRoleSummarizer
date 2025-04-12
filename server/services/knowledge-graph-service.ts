/**
 * ナレッジグラフサービス
 * ナレッジグラフの作成、操作、更新機能を提供するサービス
 */

import * as neo4jService from './neo4j-service';
import * as exaService from './exa-search-service';

// ノードタイプ
export enum NodeType {
  INDUSTRY = 'Industry',
  COMPANY = 'Company',
  PRODUCT = 'Product',
  TECHNOLOGY = 'Technology',
  TREND = 'Trend',
  PERSON = 'Person',
  CONCEPT = 'Concept',
  KEYWORD = 'Keyword'
}

// エッジタイプ
export enum EdgeType {
  BELONGS_TO = 'BELONGS_TO',
  DEVELOPS = 'DEVELOPS',
  COMPETES_WITH = 'COMPETES_WITH',
  INFLUENCES = 'INFLUENCES',
  USES = 'USES',
  RELATED_TO = 'RELATED_TO',
  HAS_INTEREST = 'HAS_INTEREST',
  WORKS_ON = 'WORKS_ON'
}

// グラフノード
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  properties: Record<string, any>;
}

// グラフエッジ
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  properties: Record<string, any>;
}

// グラフデータ
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * 階層的ナレッジグラフを生成する
 * @param roleModelId ロールモデルID
 * @param mainTopic メイントピック
 * @param subTopics サブトピック
 * @param overwrite 既存グラフを上書きするかどうか
 * @returns 生成したグラフデータ
 */
export async function generateHierarchicalKnowledgeGraph(
  roleModelId: string,
  mainTopic: string,
  subTopics: string[] = [],
  overwrite: boolean = false
): Promise<GraphData | null> {
  try {
    console.log(`階層的ナレッジグラフの生成開始: ${mainTopic}, サブトピック:`, subTopics);
    
    // 既存グラフを上書きする場合は削除
    if (overwrite) {
      await neo4jService.deleteExistingKnowledgeGraph(roleModelId);
      console.log(`既存のナレッジグラフを削除しました: ${roleModelId}`);
    }
    
    // メイントピックからノード階層を作成
    const mainNode = {
      id: `main-${Date.now()}`,
      label: mainTopic,
      type: NodeType.INDUSTRY,
      properties: {
        name: mainTopic,
        description: `${mainTopic} industry knowledge graph`,
        importance: 1.0
      }
    };
    
    // サブトピックノードを作成
    const subNodes = subTopics.map((topic, index) => ({
      id: `sub-${Date.now()}-${index}`,
      label: topic,
      type: NodeType.KEYWORD,
      properties: {
        name: topic,
        description: `Keyword related to ${mainTopic}`,
        importance: 0.8
      }
    }));
    
    // エッジを作成（メイントピックとサブトピックを接続）
    const edges = subNodes.map((node, index) => ({
      id: `edge-${Date.now()}-${index}`,
      source: mainNode.id,
      target: node.id,
      type: EdgeType.RELATED_TO,
      properties: {
        weight: 1.0,
        description: `${mainTopic} is related to ${node.label}`
      }
    }));
    
    // 拡張ノードと関係性をAIベースで生成（実際にはより複雑なAI生成を行う）
    const extendedNodes = generateExtendedNodes(mainTopic, subTopics);
    const extendedEdges = generateExtendedEdges(mainNode.id, subNodes, extendedNodes);
    
    // グラフデータを構築
    const graphData: GraphData = {
      nodes: [mainNode, ...subNodes, ...extendedNodes],
      edges: [...edges, ...extendedEdges]
    };
    
    // Neo4jにグラフを保存
    const savedGraph = await neo4jService.createKnowledgeGraph(roleModelId, graphData.nodes, graphData.edges);
    console.log(`ナレッジグラフを作成しました: ノード${graphData.nodes.length}個, エッジ${graphData.edges.length}個`);
    
    return graphData;
  } catch (error) {
    console.error('ナレッジグラフ生成エラー:', error);
    return null;
  }
}

/**
 * 拡張ノードを生成する（AIベース）
 * @param mainTopic メイントピック
 * @param subTopics サブトピック
 * @returns 拡張ノード
 */
function generateExtendedNodes(mainTopic: string, subTopics: string[]): GraphNode[] {
  // 実際にはAIを使用して業界やキーワードに関連するエンティティを生成
  // ここではシンプルな例としてダミーノードを生成
  
  const extendedNodes: GraphNode[] = [];
  
  // 企業ノード
  extendedNodes.push({
    id: `company-${Date.now()}-1`,
    label: `${mainTopic} Leader`,
    type: NodeType.COMPANY,
    properties: {
      name: `${mainTopic} Leader Corp`,
      description: `Leading company in ${mainTopic}`,
      importance: 0.9
    }
  });
  
  extendedNodes.push({
    id: `company-${Date.now()}-2`,
    label: `${mainTopic} Innovator`,
    type: NodeType.COMPANY,
    properties: {
      name: `${mainTopic} Innovator Inc`,
      description: `Innovative company in ${mainTopic}`,
      importance: 0.85
    }
  });
  
  // 製品ノード
  extendedNodes.push({
    id: `product-${Date.now()}-1`,
    label: `${subTopics[0] || mainTopic} Solution`,
    type: NodeType.PRODUCT,
    properties: {
      name: `${subTopics[0] || mainTopic} Solution`,
      description: `Product for ${subTopics[0] || mainTopic}`,
      importance: 0.7
    }
  });
  
  // 技術ノード
  subTopics.forEach((topic, index) => {
    if (index < 2) { // 最初の2つのサブトピックのみ
      extendedNodes.push({
        id: `tech-${Date.now()}-${index}`,
        label: `${topic} Technology`,
        type: NodeType.TECHNOLOGY,
        properties: {
          name: `${topic} Technology`,
          description: `Technology related to ${topic}`,
          importance: 0.75
        }
      });
    }
  });
  
  // トレンドノード
  extendedNodes.push({
    id: `trend-${Date.now()}-1`,
    label: `${mainTopic} Future Trend`,
    type: NodeType.TREND,
    properties: {
      name: `Future of ${mainTopic}`,
      description: `Emerging trend in ${mainTopic}`,
      importance: 0.8
    }
  });
  
  return extendedNodes;
}

/**
 * 拡張エッジを生成する（AIベース）
 * @param mainNodeId メインノードID
 * @param subNodes サブノード
 * @param extendedNodes 拡張ノード
 * @returns 拡張エッジ
 */
function generateExtendedEdges(mainNodeId: string, subNodes: GraphNode[], extendedNodes: GraphNode[]): GraphEdge[] {
  const extendedEdges: GraphEdge[] = [];
  const timestamp = Date.now();
  
  // 企業ノードの関係性
  const companyNodes = extendedNodes.filter(node => node.type === NodeType.COMPANY);
  
  // 企業間の競合関係
  if (companyNodes.length >= 2) {
    extendedEdges.push({
      id: `edge-comp-${timestamp}-1`,
      source: companyNodes[0].id,
      target: companyNodes[1].id,
      type: EdgeType.COMPETES_WITH,
      properties: {
        weight: 0.9,
        description: `${companyNodes[0].label} competes with ${companyNodes[1].label}`
      }
    });
  }
  
  // 企業と業界の関係性
  companyNodes.forEach((company, index) => {
    extendedEdges.push({
      id: `edge-ind-comp-${timestamp}-${index}`,
      source: company.id,
      target: mainNodeId,
      type: EdgeType.BELONGS_TO,
      properties: {
        weight: 1.0,
        description: `${company.label} belongs to ${mainNodeId}`
      }
    });
  });
  
  // 製品ノードの関係性
  const productNodes = extendedNodes.filter(node => node.type === NodeType.PRODUCT);
  const techNodes = extendedNodes.filter(node => node.type === NodeType.TECHNOLOGY);
  
  // 企業と製品の関係性
  if (companyNodes.length > 0 && productNodes.length > 0) {
    extendedEdges.push({
      id: `edge-comp-prod-${timestamp}-1`,
      source: companyNodes[0].id,
      target: productNodes[0].id,
      type: EdgeType.DEVELOPS,
      properties: {
        weight: 0.85,
        description: `${companyNodes[0].label} develops ${productNodes[0].label}`
      }
    });
  }
  
  // 技術と製品の関係性
  if (techNodes.length > 0 && productNodes.length > 0) {
    extendedEdges.push({
      id: `edge-tech-prod-${timestamp}-1`,
      source: productNodes[0].id,
      target: techNodes[0].id,
      type: EdgeType.USES,
      properties: {
        weight: 0.8,
        description: `${productNodes[0].label} uses ${techNodes[0].label}`
      }
    });
  }
  
  // サブトピックと技術の関係性
  if (subNodes.length > 0 && techNodes.length > 0) {
    extendedEdges.push({
      id: `edge-sub-tech-${timestamp}-1`,
      source: subNodes[0].id,
      target: techNodes[0].id,
      type: EdgeType.RELATED_TO,
      properties: {
        weight: 0.75,
        description: `${subNodes[0].label} is related to ${techNodes[0].label}`
      }
    });
  }
  
  // トレンドと業界の関係性
  const trendNodes = extendedNodes.filter(node => node.type === NodeType.TREND);
  
  if (trendNodes.length > 0) {
    extendedEdges.push({
      id: `edge-trend-ind-${timestamp}-1`,
      source: trendNodes[0].id,
      target: mainNodeId,
      type: EdgeType.INFLUENCES,
      properties: {
        weight: 0.9,
        description: `${trendNodes[0].label} influences ${mainNodeId}`
      }
    });
  }
  
  return extendedEdges;
}

/**
 * ナレッジグラフの更新を推奨する（レコメンデーション）
 * @param roleModelId ロールモデルID
 * @param reports 要約レポート一覧
 * @returns 更新推奨
 */
export async function recommendGraphUpdates(roleModelId: string, reports: any[]): Promise<any[]> {
  try {
    console.log(`ナレッジグラフ更新レコメンデーション生成: ${roleModelId}`);
    
    // 既存のグラフデータを取得
    const existingGraph = await neo4jService.getKnowledgeGraph(roleModelId);
    
    if (!existingGraph || !existingGraph.nodes || existingGraph.nodes.length === 0) {
      console.log('既存のグラフデータが見つかりません');
      return [];
    }
    
    // 既存ノードの分析
    const existingNodes = new Set(existingGraph.nodes.map((node: any) => node.label.toLowerCase()));
    const recommendations = [];
    
    // 各レポートから新しいキーワードや概念を抽出
    // 実際にはここでAIを使用して抽出する
    for (const report of reports) {
      // 単純な例として、レポートタイトルから単語を抽出
      if (report.summary) {
        const words = extractKeywordsFromText(report.summary);
        
        for (const word of words) {
          // 既存ノードに含まれていない場合は推奨
          if (!existingNodes.has(word.toLowerCase()) && word.length > 3) {
            recommendations.push({
              keyword: word,
              source: report.planName,
              confidence: 0.7,
              type: determineNodeType(word),
              suggestedRelation: {
                source: word,
                target: findRelatedExistingNode(existingGraph.nodes, word),
                type: EdgeType.RELATED_TO
              }
            });
          }
        }
      }
    }
    
    return recommendations;
  } catch (error) {
    console.error('ナレッジグラフ更新レコメンデーションエラー:', error);
    return [];
  }
}

/**
 * テキストからキーワードを抽出する（簡易実装）
 * @param text テキスト
 * @returns キーワード
 */
function extractKeywordsFromText(text: string): string[] {
  // 実際にはAIや自然言語処理を使用してキーワードを抽出
  // ここでは簡易的な実装
  const words = text.split(/\s+/);
  const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of']);
  
  return words
    .filter(word => word.length > 3 && !stopWords.has(word.toLowerCase()))
    .map(word => word.replace(/[.,;:!?()]/g, ''))
    .filter(word => word.length > 0);
}

/**
 * ノードタイプを決定する（簡易実装）
 * @param keyword キーワード
 * @returns ノードタイプ
 */
function determineNodeType(keyword: string): NodeType {
  // 実際にはAIや分類器を使用してノードタイプを決定
  // ここでは簡易的な実装
  
  // 企業名の特徴（Inc, Corp, Ltd などで終わる）
  if (/Inc\.?$|Corp\.?$|Ltd\.?$|LLC$|Company$/.test(keyword)) {
    return NodeType.COMPANY;
  }
  
  // 製品名の特徴（数字やバージョンを含む）
  if (/\d+(\.\d+)*|v\d+/.test(keyword)) {
    return NodeType.PRODUCT;
  }
  
  // 技術名の特徴（一般的な技術用語）
  if (/AI|ML|API|Cloud|Platform|Framework|Language|Protocol/.test(keyword)) {
    return NodeType.TECHNOLOGY;
  }
  
  // トレンド名の特徴（「次世代」「未来」などを含む）
  if (/Future|Next|Trend|Emerging|Innovation/.test(keyword)) {
    return NodeType.TREND;
  }
  
  // デフォルトはコンセプト
  return NodeType.CONCEPT;
}

/**
 * 関連する既存ノードを見つける（簡易実装）
 * @param existingNodes 既存ノード
 * @param newKeyword 新しいキーワード
 * @returns 関連ノードID
 */
function findRelatedExistingNode(existingNodes: any[], newKeyword: string): string {
  // 実際にはAIや自然言語処理を使用して関連ノードを見つける
  // ここでは簡易的な実装（最初のノードを返す）
  return existingNodes.length > 0 ? existingNodes[0].id : '';
}