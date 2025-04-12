/**
 * メモリベースのグラフデータストレージサービス
 * Neo4jが利用できない環境でナレッジグラフを処理するための代替実装
 */

import { v4 as uuidv4 } from 'uuid';

// 型定義
interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface GraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, any>;
}

interface Graph {
  nodes: Map<string, GraphNode>;
  relationships: Map<string, GraphRelationship>;
}

// ロールモデルIDごとのグラフデータを保持するマップ
const graphs: Map<string, Graph> = new Map();

/**
 * グラフを初期化または取得する
 * @param roleModelId ロールモデルID
 * @returns グラフオブジェクト
 */
function getOrCreateGraph(roleModelId: string): Graph {
  if (!graphs.has(roleModelId)) {
    graphs.set(roleModelId, {
      nodes: new Map<string, GraphNode>(),
      relationships: new Map<string, GraphRelationship>(),
    });
  }
  return graphs.get(roleModelId)!;
}

/**
 * ノードを作成する
 * @param labelOrOptions ノードのラベルまたは作成オプション
 * @param properties ノードのプロパティ
 * @param roleModelId ロールモデルID（オプション）
 * @returns 作成されたノードのID
 */
export async function createNode(
  labelOrOptions: string | string[] | { labels: string[]; properties: Record<string, any> },
  properties?: Record<string, any>,
  roleModelId?: string
): Promise<string> {
  if (!roleModelId) {
    if (typeof labelOrOptions === 'object' && !Array.isArray(labelOrOptions) && labelOrOptions.properties && labelOrOptions.properties.roleModelId) {
      roleModelId = labelOrOptions.properties.roleModelId;
    } else if (properties && properties.roleModelId) {
      roleModelId = properties.roleModelId;
    } else {
      throw new Error('ロールモデルIDが指定されていません');
    }
  }

  // パラメータの解析
  let labels: string[];
  let nodeProperties: Record<string, any>;

  if (typeof labelOrOptions === 'object' && !Array.isArray(labelOrOptions)) {
    // オブジェクト形式
    labels = labelOrOptions.labels;
    nodeProperties = { ...labelOrOptions.properties };
  } else {
    // 文字列または配列形式
    if (Array.isArray(labelOrOptions)) {
      labels = labelOrOptions;
    } else {
      labels = [labelOrOptions];
    }
    nodeProperties = { ...(properties || {}) };
  }

  // roleModelIdの追加
  if (roleModelId && !nodeProperties.roleModelId) {
    nodeProperties.roleModelId = roleModelId;
  }

  // idが無ければ生成
  if (!nodeProperties.id) {
    nodeProperties.id = uuidv4();
  }

  // 作成日時の設定
  if (!nodeProperties.createdAt) {
    nodeProperties.createdAt = new Date().toISOString();
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);

  // ノードの作成と保存
  const node: GraphNode = {
    id: nodeProperties.id,
    labels,
    properties: nodeProperties,
  };

  graph.nodes.set(node.id, node);
  console.log(`メモリグラフにノードを作成: ${node.id}, ラベル: ${labels.join(':')}`);

  return node.id;
}

/**
 * ノードを検索または作成する
 * @param options 検索または作成オプション
 * @returns 既存または新規作成されたノードのID
 */
export async function findOrCreateNode(options: {
  labels: string[];
  matchProperties: Record<string, any>;
  createProperties?: Record<string, any>;
}): Promise<string> {
  const roleModelId = options.matchProperties.roleModelId;
  if (!roleModelId) {
    throw new Error('ロールモデルIDが指定されていません');
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);

  // ノードの検索
  let foundNode: GraphNode | undefined;
  for (const node of graph.nodes.values()) {
    if (node.properties.roleModelId === roleModelId) {
      let match = true;
      for (const key in options.matchProperties) {
        if (node.properties[key] !== options.matchProperties[key]) {
          match = false;
          break;
        }
      }
      if (match) {
        foundNode = node;
        break;
      }
    }
  }

  // 既存のノードが見つかった場合
  if (foundNode) {
    return foundNode.id;
  }

  // 見つからない場合は新しいノードを作成
  const createProps = { 
    ...options.matchProperties, 
    ...(options.createProperties || {}),
    id: options.matchProperties.id || uuidv4(),
    createdAt: new Date().toISOString()
  };

  const nodeId = await createNode(
    { labels: options.labels, properties: createProps },
    undefined,
    roleModelId
  );

  return nodeId;
}

/**
 * リレーションシップを作成する
 * @param options リレーションシップ作成オプション
 * @returns 作成されたリレーションシップのID
 */
export async function createRelationship(options: {
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  properties?: Record<string, any>;
}): Promise<string> {
  // ノードの存在確認とロールモデルIDの特定
  let roleModelId: string | undefined;
  let sourceNode: GraphNode | undefined;
  let targetNode: GraphNode | undefined;

  // すべてのグラフから該当するノードを検索
  for (const [graphRoleModelId, graph] of graphs.entries()) {
    if (!sourceNode && graph.nodes.has(options.sourceNodeId)) {
      sourceNode = graph.nodes.get(options.sourceNodeId);
      if (!roleModelId) {
        roleModelId = graphRoleModelId;
      }
    }
    if (!targetNode && graph.nodes.has(options.targetNodeId)) {
      targetNode = graph.nodes.get(options.targetNodeId);
      if (!roleModelId) {
        roleModelId = graphRoleModelId;
      }
    }
    if (sourceNode && targetNode) {
      break;
    }
  }

  if (!sourceNode || !targetNode) {
    throw new Error('ソースノードまたはターゲットノードが見つかりません');
  }

  if (!roleModelId) {
    roleModelId = sourceNode.properties.roleModelId || targetNode.properties.roleModelId;
  }

  if (!roleModelId) {
    throw new Error('ロールモデルIDが特定できません');
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);

  // プロパティの準備
  const props = { 
    ...(options.properties || {}), 
    id: options.properties?.id || uuidv4(),
    createdAt: options.properties?.createdAt || new Date().toISOString()
  };

  // リレーションシップの作成と保存
  const relationship: GraphRelationship = {
    id: props.id,
    sourceId: options.sourceNodeId,
    targetId: options.targetNodeId,
    type: options.type,
    properties: props,
  };

  graph.relationships.set(relationship.id, relationship);
  console.log(`メモリグラフにリレーションシップを作成: ${relationship.id}, タイプ: ${options.type}`);

  return relationship.id;
}

/**
 * リレーションシップを削除する
 * @param options リレーションシップ削除オプション
 */
export async function deleteRelationship(options: {
  sourceNodeId: string;
  targetNodeId: string;
  type?: string;
}): Promise<void> {
  let roleModelId: string | undefined;

  // すべてのグラフから該当するノードを検索
  for (const [graphRoleModelId, graph] of graphs.entries()) {
    if (graph.nodes.has(options.sourceNodeId) || graph.nodes.has(options.targetNodeId)) {
      roleModelId = graphRoleModelId;
      break;
    }
  }

  if (!roleModelId) {
    console.warn('ソースノードまたはターゲットノードが見つからないため、リレーションシップを削除できません');
    return;
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);

  // 対象リレーションシップの検索と削除
  for (const [id, rel] of graph.relationships.entries()) {
    if (rel.sourceId === options.sourceNodeId && rel.targetId === options.targetNodeId) {
      if (!options.type || rel.type === options.type) {
        graph.relationships.delete(id);
        console.log(`メモリグラフからリレーションシップを削除: ${id}`);
      }
    }
  }
}

/**
 * ロールモデルに関連するノードとリレーションシップを取得する
 * @param roleModelId ロールモデルID
 * @returns ノードとリレーションシップの配列
 */
export async function getKnowledgeGraphForRoleModel(roleModelId: string): Promise<{
  nodes: Record<string, any>[];
  edges: Record<string, any>[];
}> {
  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);
  
  const nodes: Record<string, any>[] = [];
  const edges: Record<string, any>[] = [];
  const nodeMap = new Map<string, boolean>();
  
  // ノードとエッジの抽出
  for (const node of graph.nodes.values()) {
    if (node.properties.roleModelId === roleModelId && !nodeMap.has(node.id)) {
      nodes.push(processNodeProperties(node.properties));
      nodeMap.set(node.id, true);
    }
  }
  
  // リレーションシップの抽出（ノードが存在するもののみ）
  for (const rel of graph.relationships.values()) {
    const sourceNode = graph.nodes.get(rel.sourceId);
    const targetNode = graph.nodes.get(rel.targetId);
    
    if (sourceNode && targetNode && 
        (sourceNode.properties.roleModelId === roleModelId || targetNode.properties.roleModelId === roleModelId)) {
      
      // ノードが含まれていなければ追加
      if (!nodeMap.has(sourceNode.id)) {
        nodes.push(processNodeProperties(sourceNode.properties));
        nodeMap.set(sourceNode.id, true);
      }
      
      if (!nodeMap.has(targetNode.id)) {
        nodes.push(processNodeProperties(targetNode.properties));
        nodeMap.set(targetNode.id, true);
      }
      
      // エッジの追加
      edges.push({
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type,
        ...processEdgeProperties(rel.properties)
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * ノードの子ノードを取得する
 * @param nodeId 親ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 子ノードの配列
 */
export async function getChildNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  let parentNode: GraphNode | undefined;
  let roleModelId: string | undefined;

  // すべてのグラフから該当するノードを検索
  for (const [graphRoleModelId, graph] of graphs.entries()) {
    if (graph.nodes.has(nodeId)) {
      parentNode = graph.nodes.get(nodeId);
      roleModelId = graphRoleModelId;
      break;
    }
  }

  if (!parentNode || !roleModelId) {
    console.warn(`ノードID ${nodeId} が見つからないため、子ノードを取得できません`);
    return [];
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);
  const result: Record<string, any>[] = [];

  // 子ノードの検索
  for (const rel of graph.relationships.values()) {
    if (rel.sourceId === nodeId && (!relationshipType || rel.type === relationshipType)) {
      const childNode = graph.nodes.get(rel.targetId);
      if (childNode) {
        const childNodeData = processNodeProperties(childNode.properties);
        childNodeData.relationType = rel.type;
        result.push(childNodeData);
      }
    }
  }

  return result;
}

/**
 * ノードの親ノードを取得する
 * @param nodeId 子ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 親ノードの配列
 */
export async function getParentNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  let childNode: GraphNode | undefined;
  let roleModelId: string | undefined;

  // すべてのグラフから該当するノードを検索
  for (const [graphRoleModelId, graph] of graphs.entries()) {
    if (graph.nodes.has(nodeId)) {
      childNode = graph.nodes.get(nodeId);
      roleModelId = graphRoleModelId;
      break;
    }
  }

  if (!childNode || !roleModelId) {
    console.warn(`ノードID ${nodeId} が見つからないため、親ノードを取得できません`);
    return [];
  }

  // グラフの取得
  const graph = getOrCreateGraph(roleModelId);
  const result: Record<string, any>[] = [];

  // 親ノードの検索
  for (const rel of graph.relationships.values()) {
    if (rel.targetId === nodeId && (!relationshipType || rel.type === relationshipType)) {
      const parentNode = graph.nodes.get(rel.sourceId);
      if (parentNode) {
        const parentNodeData = processNodeProperties(parentNode.properties);
        parentNodeData.relationType = rel.type;
        result.push(parentNodeData);
      }
    }
  }

  return result;
}

/**
 * 新しいナレッジグラフを生成する
 * @param roleModelId ロールモデルID
 * @param options グラフ生成オプション
 * @returns 生成されたグラフのメインノードID
 */
export async function generateNewKnowledgeGraph(
  roleModelId: string,
  options: {
    mainTopic: string;
    subTopics?: string[];
    description?: string;
    createdBy?: string;
  }
): Promise<string> {
  // メインノードの作成
  const mainNodeId = await createNode({
    labels: ['Topic', 'MainTopic'],
    properties: {
      name: options.mainTopic,
      description: options.description || '',
      roleModelId,
      createdBy: options.createdBy,
      level: 0,
      color: '#4299E1', // デフォルトの青色
      updatedAt: new Date().toISOString()
    }
  });
  
  // サブトピックがある場合は作成して関連付け
  if (options.subTopics && options.subTopics.length > 0) {
    for (const subTopic of options.subTopics) {
      const subNodeId = await createNode({
        labels: ['Topic', 'SubTopic'],
        properties: {
          name: subTopic,
          roleModelId,
          parentId: mainNodeId,
          level: 1,
          color: '#ED8936', // オレンジ色
          updatedAt: new Date().toISOString()
        }
      });
      
      // メインノードとの関連付け
      await createRelationship({
        sourceNodeId: mainNodeId,
        targetNodeId: subNodeId,
        type: 'HAS_SUBTOPIC'
      });
    }
  }
  
  return mainNodeId;
}

/**
 * ロールモデルの知識グラフを取得する
 * @param roleModelId ロールモデルID
 * @returns ノードとエッジの配列
 */
export async function getKnowledgeGraph(roleModelId: string): Promise<{
  nodes: any[];
  edges: any[];
}> {
  try {
    // ロールモデルIDが有効かチェック
    if (!roleModelId) {
      console.warn('無効なロールモデルID');
      return { nodes: [], edges: [] };
    }
    
    const result = await getKnowledgeGraphForRoleModel(roleModelId);
    
    // グラフが空の場合はダミーノードを作成
    if (result.nodes.length === 0) {
      console.log(`ロールモデル ${roleModelId} のグラフが空のため、ダミーノードを作成します`);
      const mainTopic = 'ナレッジグラフ';
      await generateNewKnowledgeGraph(roleModelId, {
        mainTopic,
        subTopics: ['情報収集', 'AI活用', '技術動向', '市場分析', 'ビジネス戦略'],
        description: 'AI活用コンサルタント向けのナレッジグラフ'
      });
      
      // 再度グラフを取得
      return await getKnowledgeGraphForRoleModel(roleModelId);
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching knowledge graph for role model ${roleModelId}:`, error);
    // エラーが発生した場合は空のグラフを返す
    return { nodes: [], edges: [] };
  }
}

// ヘルパー関数: ノードプロパティを処理する
function processNodeProperties(properties: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // 各プロパティを処理
  for (const key in properties) {
    let value = properties[key];
    
    // JSON文字列を解析（実際にはメモリなのでこの処理は不要だが互換性のために残す）
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // パースエラーの場合はそのまま
      }
    }
    
    result[key] = value;
  }
  
  return result;
}

// ヘルパー関数: エッジプロパティを処理する
function processEdgeProperties(properties: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // 各プロパティを処理
  for (const key in properties) {
    let value = properties[key];
    
    // JSON文字列を解析（実際にはメモリなのでこの処理は不要だが互換性のために残す）
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // パースエラーの場合はそのまま
      }
    }
    
    // idとsource/targetを除外（別途セット済み）
    if (key !== 'id' && key !== 'source' && key !== 'target') {
      result[key] = value;
    }
  }
  
  return result;
}