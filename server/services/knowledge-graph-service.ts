/**
 * ナレッジグラフサービス
 * ナレッジグラフの作成、操作、更新機能を提供するサービス
 */

import * as neo4jService from './neo4j-service';
import * as graphService from './graph-service-adapter';
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
      await graphService.deleteExistingKnowledgeGraph(roleModelId);
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
    // neo4jServiceに直接メソッドがない場合はgraphService経由で保存
    await graphService.deleteExistingKnowledgeGraph(roleModelId);
    
    // 各ノードを登録
    for (const node of graphData.nodes) {
      await graphService.createNode(
        { labels: [node.type], properties: { ...node.properties, id: node.id, label: node.label } },
        undefined,
        roleModelId
      );
    }
    
    // 各エッジを登録
    for (const edge of graphData.edges) {
      await graphService.createRelationship({
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        type: edge.type,
        properties: edge.properties
      });
    }
    
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
 * 既存のナレッジグラフを強化する
 * 添付資料の階層的ナレッジグラフ構造に基づいて既存グラフを拡張
 * 
 * @param roleModelId ロールモデルID
 * @param initialGraph 初期グラフデータ
 * @param keywords キーワード配列
 * @returns 強化されたグラフデータ
 */
export async function enhanceKnowledgeGraph(
  roleModelId: string,
  initialGraph: GraphData,
  keywords: string[]
): Promise<GraphData> {
  try {
    console.log(`ナレッジグラフの強化開始: roleModelId=${roleModelId}, ノード数=${initialGraph.nodes.length}, エッジ数=${initialGraph.edges.length}`);
    
    // メインノード（業界ノード）を特定
    const mainNode = initialGraph.nodes.find(node => node.type === NodeType.INDUSTRY);
    
    if (!mainNode) {
      console.warn('メインノード（業界ノード）が見つかりません。初期グラフをそのまま返します。');
      return initialGraph;
    }
    
    // 階層1: カテゴリノードの追加（メインノードに直接接続）
    const categoryNodes = generateCategoryNodes(mainNode.label);
    
    // 階層2: サブカテゴリノードの追加（カテゴリノードに接続）
    const subCategoryNodes = generateSubCategoryNodes(categoryNodes, keywords);
    
    // 階層3: 具体的なエンティティノードの追加（サブカテゴリに接続）
    const entityNodes = generateEntityNodes(subCategoryNodes, keywords);
    
    // カテゴリノードをメインノードに接続するエッジ
    const categoryEdges = categoryNodes.map((node, index) => ({
      id: `cat-edge-${Date.now()}-${index}`,
      source: mainNode.id,
      target: node.id,
      type: EdgeType.RELATED_TO,
      properties: {
        weight: 0.9,
        description: `${mainNode.label} has category ${node.label}`
      }
    }));
    
    // サブカテゴリノードをカテゴリノードに接続するエッジ
    const subCategoryEdges = subCategoryNodes.map((node) => ({
      id: `subcat-edge-${Date.now()}-${node.id.split('-').pop()}`,
      source: node.properties.parentId,
      target: node.id,
      type: EdgeType.BELONGS_TO,
      properties: {
        weight: 0.85,
        description: `${node.label} belongs to category`
      }
    }));
    
    // エンティティノードをサブカテゴリノードに接続するエッジ
    const entityEdges = entityNodes.map((node) => ({
      id: `entity-edge-${Date.now()}-${node.id.split('-').pop()}`,
      source: node.properties.parentId,
      target: node.id,
      type: node.properties.relationshipType || EdgeType.BELONGS_TO,
      properties: {
        weight: 0.8,
        description: `${node.label} belongs to subcategory`
      }
    }));
    
    // エンティティ間の相互接続（一部のエンティティ間に関連性を追加）
    const crossEntityEdges = generateCrossEntityEdges(entityNodes);
    
    // 新しいノードとエッジをデータベースに保存
    const allNewNodes = [...categoryNodes, ...subCategoryNodes, ...entityNodes];
    const allNewEdges = [...categoryEdges, ...subCategoryEdges, ...entityEdges, ...crossEntityEdges];
    
    // 各ノードを登録
    for (const node of allNewNodes) {
      await graphService.createNode(
        { labels: [node.type], properties: { ...node.properties, id: node.id, label: node.label } },
        undefined,
        roleModelId
      );
    }
    
    // 各エッジを登録
    for (const edge of allNewEdges) {
      await graphService.createRelationship({
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        type: edge.type,
        properties: edge.properties
      });
    }
    
    // 強化されたグラフデータを返す
    const enhancedGraph: GraphData = {
      nodes: [...initialGraph.nodes, ...allNewNodes],
      edges: [...initialGraph.edges, ...allNewEdges]
    };
    
    console.log(`ナレッジグラフの強化完了: 合計ノード数=${enhancedGraph.nodes.length}, 合計エッジ数=${enhancedGraph.edges.length}`);
    return enhancedGraph;
    
  } catch (error) {
    console.error('ナレッジグラフ強化エラー:', error);
    return initialGraph; // エラー時は初期グラフをそのまま返す
  }
}

/**
 * カテゴリノードを生成（階層1）
 * @param mainTopicLabel メイントピックラベル
 * @returns カテゴリノード配列
 */
function generateCategoryNodes(mainTopicLabel: string): GraphNode[] {
  const timestamp = Date.now();
  
  // 業界に関する6つの主要カテゴリを生成
  return [
    {
      id: `cat-market-${timestamp}`,
      label: '市場動向',
      type: NodeType.CONCEPT,
      properties: {
        name: '市場動向',
        description: `${mainTopicLabel}における市場の傾向、規模、成長率に関する情報`,
        importance: 0.95,
        category: 'market'
      }
    },
    {
      id: `cat-companies-${timestamp}`,
      label: '主要企業',
      type: NodeType.CONCEPT,
      properties: {
        name: '主要企業',
        description: `${mainTopicLabel}業界における主要プレイヤーと競合状況`,
        importance: 0.9,
        category: 'companies'
      }
    },
    {
      id: `cat-tech-${timestamp}`,
      label: '技術動向',
      type: NodeType.CONCEPT,
      properties: {
        name: '技術動向',
        description: `${mainTopicLabel}業界における主要技術とイノベーション`,
        importance: 0.9,
        category: 'technology'
      }
    },
    {
      id: `cat-products-${timestamp}`,
      label: '製品・サービス',
      type: NodeType.CONCEPT,
      properties: {
        name: '製品・サービス',
        description: `${mainTopicLabel}業界における代表的な製品とサービス`,
        importance: 0.85,
        category: 'products'
      }
    },
    {
      id: `cat-challenges-${timestamp}`,
      label: '課題と機会',
      type: NodeType.CONCEPT,
      properties: {
        name: '課題と機会',
        description: `${mainTopicLabel}業界が直面する課題と成長機会`,
        importance: 0.8,
        category: 'challenges'
      }
    },
    {
      id: `cat-trends-${timestamp}`,
      label: '将来展望',
      type: NodeType.CONCEPT,
      properties: {
        name: '将来展望',
        description: `${mainTopicLabel}業界の将来予測と新興トレンド`,
        importance: 0.85,
        category: 'trends'
      }
    }
  ];
}

/**
 * サブカテゴリノードを生成（階層2）
 * @param categoryNodes カテゴリノード配列
 * @param keywords キーワード配列
 * @returns サブカテゴリノード配列
 */
function generateSubCategoryNodes(categoryNodes: GraphNode[], keywords: string[]): GraphNode[] {
  const timestamp = Date.now();
  const subCategoryNodes: GraphNode[] = [];
  
  // 各カテゴリに対するサブカテゴリを生成
  categoryNodes.forEach((category, categoryIndex) => {
    const categoryType = category.properties.category;
    
    // カテゴリタイプに基づいて適切なサブカテゴリを生成
    switch (categoryType) {
      case 'market':
        subCategoryNodes.push(
          {
            id: `subcat-market-size-${timestamp}-${categoryIndex}`,
            label: '市場規模',
            type: NodeType.CONCEPT,
            properties: {
              name: '市場規模',
              description: '業界の市場規模と成長率',
              importance: 0.8,
              parentId: category.id
            }
          },
          {
            id: `subcat-segments-${timestamp}-${categoryIndex}`,
            label: '市場セグメント',
            type: NodeType.CONCEPT,
            properties: {
              name: '市場セグメント',
              description: '業界の主要セグメントと構造',
              importance: 0.75,
              parentId: category.id
            }
          },
          {
            id: `subcat-regions-${timestamp}-${categoryIndex}`,
            label: '地域分析',
            type: NodeType.CONCEPT,
            properties: {
              name: '地域分析',
              description: '地域別市場動向',
              importance: 0.7,
              parentId: category.id
            }
          }
        );
        break;
        
      case 'companies':
        subCategoryNodes.push(
          {
            id: `subcat-leaders-${timestamp}-${categoryIndex}`,
            label: '市場リーダー',
            type: NodeType.CONCEPT,
            properties: {
              name: '市場リーダー',
              description: '業界をリードする企業',
              importance: 0.85,
              parentId: category.id
            }
          },
          {
            id: `subcat-innovators-${timestamp}-${categoryIndex}`,
            label: '革新的企業',
            type: NodeType.CONCEPT,
            properties: {
              name: '革新的企業',
              description: '革新的な企業と新興企業',
              importance: 0.8,
              parentId: category.id
            }
          },
          {
            id: `subcat-strategies-${timestamp}-${categoryIndex}`,
            label: '企業戦略',
            type: NodeType.CONCEPT,
            properties: {
              name: '企業戦略',
              description: '主要企業の戦略と競争優位性',
              importance: 0.75,
              parentId: category.id
            }
          }
        );
        break;
        
      case 'technology':
        subCategoryNodes.push(
          {
            id: `subcat-core-tech-${timestamp}-${categoryIndex}`,
            label: '中核技術',
            type: NodeType.CONCEPT,
            properties: {
              name: '中核技術',
              description: '業界の中核となる技術',
              importance: 0.85,
              parentId: category.id
            }
          },
          {
            id: `subcat-emerging-tech-${timestamp}-${categoryIndex}`,
            label: '新興技術',
            type: NodeType.CONCEPT,
            properties: {
              name: '新興技術',
              description: '新たに登場している技術と研究開発',
              importance: 0.8,
              parentId: category.id
            }
          }
        );
        
        // キーワードが技術関連の場合、キーワードベースのサブカテゴリを追加
        keywords.forEach((keyword, kwIndex) => {
          if (kwIndex < 2) { // 最初の2つのキーワードのみ使用
            subCategoryNodes.push({
              id: `subcat-tech-kw-${timestamp}-${kwIndex}`,
              label: `${keyword}技術`,
              type: NodeType.CONCEPT,
              properties: {
                name: `${keyword}関連技術`,
                description: `${keyword}に関連する技術動向`,
                importance: 0.75,
                parentId: category.id
              }
            });
          }
        });
        break;
        
      case 'products':
        subCategoryNodes.push(
          {
            id: `subcat-flagship-${timestamp}-${categoryIndex}`,
            label: '主力製品',
            type: NodeType.CONCEPT,
            properties: {
              name: '主力製品',
              description: '業界の代表的な製品',
              importance: 0.8,
              parentId: category.id
            }
          },
          {
            id: `subcat-services-${timestamp}-${categoryIndex}`,
            label: 'サービス',
            type: NodeType.CONCEPT,
            properties: {
              name: 'サービス',
              description: '業界の主要サービス提供',
              importance: 0.75,
              parentId: category.id
            }
          },
          {
            id: `subcat-pricing-${timestamp}-${categoryIndex}`,
            label: '価格モデル',
            type: NodeType.CONCEPT,
            properties: {
              name: '価格モデル',
              description: '製品とサービスの価格設定モデル',
              importance: 0.7,
              parentId: category.id
            }
          }
        );
        break;
        
      case 'challenges':
        subCategoryNodes.push(
          {
            id: `subcat-barriers-${timestamp}-${categoryIndex}`,
            label: '障壁',
            type: NodeType.CONCEPT,
            properties: {
              name: '障壁',
              description: '業界の成長に対する障壁',
              importance: 0.75,
              parentId: category.id
            }
          },
          {
            id: `subcat-opportunities-${timestamp}-${categoryIndex}`,
            label: '機会',
            type: NodeType.CONCEPT,
            properties: {
              name: '機会',
              description: '新たな成長機会',
              importance: 0.8,
              parentId: category.id
            }
          },
          {
            id: `subcat-regulations-${timestamp}-${categoryIndex}`,
            label: '規制環境',
            type: NodeType.CONCEPT,
            properties: {
              name: '規制環境',
              description: '業界に影響を与える規制と政策',
              importance: 0.7,
              parentId: category.id
            }
          }
        );
        break;
        
      case 'trends':
        subCategoryNodes.push(
          {
            id: `subcat-future-tech-${timestamp}-${categoryIndex}`,
            label: '将来技術',
            type: NodeType.CONCEPT,
            properties: {
              name: '将来技術',
              description: '今後5-10年で重要となる技術',
              importance: 0.85,
              parentId: category.id
            }
          },
          {
            id: `subcat-market-predict-${timestamp}-${categoryIndex}`,
            label: '市場予測',
            type: NodeType.CONCEPT,
            properties: {
              name: '市場予測',
              description: '業界の長期的な市場予測',
              importance: 0.8,
              parentId: category.id
            }
          },
          {
            id: `subcat-disruptions-${timestamp}-${categoryIndex}`,
            label: '破壊的変化',
            type: NodeType.CONCEPT,
            properties: {
              name: '破壊的変化',
              description: '業界に破壊的変化をもたらす可能性のある要因',
              importance: 0.75,
              parentId: category.id
            }
          }
        );
        break;
    }
  });
  
  return subCategoryNodes;
}

/**
 * エンティティノードを生成（階層3）
 * @param subCategoryNodes サブカテゴリノード配列
 * @param keywords キーワード配列
 * @returns エンティティノード配列
 */
function generateEntityNodes(subCategoryNodes: GraphNode[], keywords: string[]): GraphNode[] {
  const timestamp = Date.now();
  const entityNodes: GraphNode[] = [];
  
  // サブカテゴリごとに具体的なエンティティを生成
  subCategoryNodes.forEach((subCategory, index) => {
    const subcatId = subCategory.id;
    const subcatLabel = subCategory.label;
    
    // サブカテゴリラベルに基づいて適切なエンティティを生成
    if (subcatLabel.includes('市場リーダー')) {
      // 市場リーダー企業のエンティティ
      entityNodes.push(
        {
          id: `entity-company1-${timestamp}-${index}`,
          label: 'トップ企業A',
          type: NodeType.COMPANY,
          properties: {
            name: 'トップ企業A',
            description: '業界最大手企業',
            importance: 0.9,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        },
        {
          id: `entity-company2-${timestamp}-${index}`,
          label: 'トップ企業B',
          type: NodeType.COMPANY,
          properties: {
            name: 'トップ企業B',
            description: '業界2位の企業',
            importance: 0.85,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        }
      );
    } 
    else if (subcatLabel.includes('革新的企業')) {
      // 革新的企業のエンティティ
      entityNodes.push(
        {
          id: `entity-innovator1-${timestamp}-${index}`,
          label: '革新企業X',
          type: NodeType.COMPANY,
          properties: {
            name: '革新企業X',
            description: '革新的な技術で注目されるスタートアップ',
            importance: 0.8,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        },
        {
          id: `entity-innovator2-${timestamp}-${index}`,
          label: '新興企業Y',
          type: NodeType.COMPANY,
          properties: {
            name: '新興企業Y',
            description: '急成長中の新興企業',
            importance: 0.75,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        }
      );
    }
    else if (subcatLabel.includes('主力製品')) {
      // 主力製品のエンティティ
      entityNodes.push(
        {
          id: `entity-product1-${timestamp}-${index}`,
          label: '主要製品1',
          type: NodeType.PRODUCT,
          properties: {
            name: '主要製品1',
            description: '市場シェア上位の製品',
            importance: 0.85,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        },
        {
          id: `entity-product2-${timestamp}-${index}`,
          label: '主要製品2',
          type: NodeType.PRODUCT,
          properties: {
            name: '主要製品2',
            description: '人気の高い製品',
            importance: 0.8,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        }
      );
    }
    else if (subcatLabel.includes('中核技術') || subcatLabel.includes('新興技術')) {
      // 技術関連のエンティティ
      let techName1 = '基盤技術';
      let techName2 = '先端技術';
      
      // キーワードがあれば使用
      if (keywords.length > 0) {
        techName1 = `${keywords[0]}技術`;
        if (keywords.length > 1) {
          techName2 = `${keywords[1]}技術`;
        }
      }
      
      entityNodes.push(
        {
          id: `entity-tech1-${timestamp}-${index}`,
          label: techName1,
          type: NodeType.TECHNOLOGY,
          properties: {
            name: techName1,
            description: '業界の基盤となる技術',
            importance: 0.85,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        },
        {
          id: `entity-tech2-${timestamp}-${index}`,
          label: techName2,
          type: NodeType.TECHNOLOGY,
          properties: {
            name: techName2,
            description: '最先端技術',
            importance: 0.8,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        }
      );
    }
    else if (subcatLabel.includes('市場規模')) {
      // 市場データのエンティティ
      entityNodes.push(
        {
          id: `entity-market-data-${timestamp}-${index}`,
          label: '市場規模データ',
          type: NodeType.CONCEPT,
          properties: {
            name: '市場規模データ',
            description: '市場規模と成長率の定量的データ',
            importance: 0.8,
            parentId: subcatId,
            relationshipType: EdgeType.BELONGS_TO
          }
        }
      );
    }
    else if (subcatLabel.includes('将来技術') || subcatLabel.includes('破壊的変化')) {
      // 将来トレンドのエンティティ
      entityNodes.push(
        {
          id: `entity-trend1-${timestamp}-${index}`,
          label: '成長トレンド',
          type: NodeType.TREND,
          properties: {
            name: '成長トレンド',
            description: '今後5年間の重要成長トレンド',
            importance: 0.85,
            parentId: subcatId,
            relationshipType: EdgeType.INFLUENCES
          }
        },
        {
          id: `entity-trend2-${timestamp}-${index}`,
          label: '新興動向',
          type: NodeType.TREND,
          properties: {
            name: '新興動向',
            description: '新たに出現しつつある業界動向',
            importance: 0.8,
            parentId: subcatId,
            relationshipType: EdgeType.INFLUENCES
          }
        }
      );
    }
  });
  
  return entityNodes;
}

/**
 * エンティティ間の相互接続エッジを生成
 * @param entityNodes エンティティノード配列
 * @returns クロスエンティティエッジ配列
 */
function generateCrossEntityEdges(entityNodes: GraphNode[]): GraphEdge[] {
  const timestamp = Date.now();
  const crossEdges: GraphEdge[] = [];
  
  // 企業ノードを抽出
  const companyNodes = entityNodes.filter(node => node.type === NodeType.COMPANY);
  
  // 製品ノードを抽出
  const productNodes = entityNodes.filter(node => node.type === NodeType.PRODUCT);
  
  // 技術ノードを抽出
  const techNodes = entityNodes.filter(node => node.type === NodeType.TECHNOLOGY);
  
  // トレンドノードを抽出
  const trendNodes = entityNodes.filter(node => node.type === NodeType.TREND);
  
  // 企業間の競合関係
  if (companyNodes.length >= 2) {
    crossEdges.push({
      id: `cross-comp-${timestamp}-1`,
      source: companyNodes[0].id,
      target: companyNodes[1].id,
      type: EdgeType.COMPETES_WITH,
      properties: {
        weight: 0.85,
        description: `${companyNodes[0].label}と${companyNodes[1].label}は市場競合関係にある`
      }
    });
  }
  
  // 企業と製品の関係（開発関係）
  if (companyNodes.length > 0 && productNodes.length > 0) {
    crossEdges.push({
      id: `cross-comp-prod-${timestamp}-1`,
      source: companyNodes[0].id,
      target: productNodes[0].id,
      type: EdgeType.DEVELOPS,
      properties: {
        weight: 0.9,
        description: `${companyNodes[0].label}は${productNodes[0].label}を開発している`
      }
    });
  }
  
  // 製品と技術の関係（利用関係）
  if (productNodes.length > 0 && techNodes.length > 0) {
    crossEdges.push({
      id: `cross-prod-tech-${timestamp}-1`,
      source: productNodes[0].id,
      target: techNodes[0].id,
      type: EdgeType.USES,
      properties: {
        weight: 0.85,
        description: `${productNodes[0].label}は${techNodes[0].label}を利用している`
      }
    });
  }
  
  // トレンドと企業の関係（影響関係）
  if (trendNodes.length > 0 && companyNodes.length > 0) {
    crossEdges.push({
      id: `cross-trend-comp-${timestamp}-1`,
      source: trendNodes[0].id,
      target: companyNodes[0].id,
      type: EdgeType.INFLUENCES,
      properties: {
        weight: 0.8,
        description: `${trendNodes[0].label}は${companyNodes[0].label}に影響を与えている`
      }
    });
  }
  
  // トレンドと技術の関係（影響関係）
  if (trendNodes.length > 0 && techNodes.length > 0) {
    crossEdges.push({
      id: `cross-trend-tech-${timestamp}-1`,
      source: trendNodes[0].id,
      target: techNodes[0].id,
      type: EdgeType.INFLUENCES,
      properties: {
        weight: 0.85,
        description: `${trendNodes[0].label}は${techNodes[0].label}の発展に影響を与えている`
      }
    });
  }
  
  return crossEdges;
}

/**
 * ナレッジグラフの更新を推奨する（レコメンデーション）
 * @param roleModelId ロールモデルID
 * @param reports 要約レポート一覧
 * @returns 更新推奨
 */
/**
 * ユーザーフィードバックをナレッジグラフに反映
 * @param roleModelId ロールモデルID
 * @param graphData 現在のグラフデータ
 * @param userPreferences ユーザー嗜好データ
 * @returns 更新されたグラフデータ
 */
export async function incorporateUserFeedback(
  roleModelId: string,
  graphData: GraphData,
  userPreferences: {
    categories: string[];
    priorityKeywords: string[];
    feedbackType: string;
  }
): Promise<GraphData> {
  try {
    console.log(`ユーザーフィードバックの反映開始: roleModelId=${roleModelId}, 優先カテゴリ=${userPreferences.categories.join(', ')}`);
    
    // 優先カテゴリに合致するノードを強調
    const enhancedNodes = graphData.nodes.map(node => {
      // ユーザーが関心を示したカテゴリに関連するノードを強調
      if (userPreferences.categories.some(category => 
          node.label.includes(category) || 
          (node.properties?.category && node.properties.category.includes(category))
      )) {
        return {
          ...node,
          properties: {
            ...node.properties,
            importance: 'high',
            userPreferred: true,
            visualWeight: 1.5
          }
        };
      }

      // 優先キーワードに関連するノードを強調
      if (userPreferences.priorityKeywords.some(keyword => 
          node.label.toLowerCase().includes(keyword.toLowerCase())
      )) {
        return {
          ...node,
          properties: {
            ...node.properties,
            importance: 'medium',
            userRelevant: true,
            visualWeight: 1.2
          }
        };
      }
      
      return node;
    });
    
    // エッジの重み付けを調整
    const enhancedEdges = graphData.edges.map(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      
      // 優先カテゴリに関連するエッジを強調
      if (sourceNode && targetNode) {
        const sourcePreferred = sourceNode.properties?.userPreferred || sourceNode.properties?.userRelevant;
        const targetPreferred = targetNode.properties?.userPreferred || targetNode.properties?.userRelevant;
        
        if (sourcePreferred && targetPreferred) {
          return {
            ...edge,
            properties: {
              ...edge.properties,
              weight: Math.min((edge.properties?.weight || 0.5) * 1.5, 1.0),
              userFeedback: 'preferred_connection'
            }
          };
        }
      }
      
      return edge;
    });
    
    // フィードバックを反映した更新済みグラフを返す
    const updatedGraph = {
      nodes: enhancedNodes,
      edges: enhancedEdges
    };
    
    console.log(`ユーザーフィードバック反映完了: ノード数=${updatedGraph.nodes.length}, エッジ数=${updatedGraph.edges.length}`);
    
    // 実際の環境では、このグラフをNeo4jなどのデータベースに保存するロジックを追加
    
    return updatedGraph;
  } catch (error) {
    console.error('ユーザーフィードバック反映エラー:', error);
    return graphData; // エラー時は元のグラフをそのまま返す
  }
}

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