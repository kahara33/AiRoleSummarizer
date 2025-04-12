/**
 * Neo4jサービス
 * Neo4jグラフデータベースとの通信機能を提供
 */

import neo4j, { Driver, Session, Record as Neo4jRecord } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

// Neo4jドライバーのインスタンス
let driver: Driver | null = null;

// 認証情報とURLの取得
const getNeo4jConfig = () => {
  // Neo4j Cloud URLまたはデフォルトのローカル接続
  const url = process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687';
  const username = process.env.NEO4J_USERNAME || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';
  console.log(`Neo4j接続情報: URL=${url}, ユーザー名=${username}`);
  return { url, username, password };
};

/**
 * Neo4jドライバを初期化する
 * @returns Neo4jドライバインスタンス
 */
export async function initDriver(): Promise<Driver> {
  if (driver) {
    return driver;
  }

  try {
    const { url, username, password } = getNeo4jConfig();
    driver = neo4j.driver(url, neo4j.auth.basic(username, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3時間
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2分
    });
    
    // 接続テスト
    await driver.verifyConnectivity();
    console.log('Successfully connected to Neo4j database');
    
    return driver;
  } catch (error) {
    console.error('Failed to connect to Neo4j database:', error);
    throw error;
  }
}

/**
 * ドライバを取得する（初期化されていなければ初期化する）
 * @returns Neo4jドライバインスタンス
 */
export async function getDriver(): Promise<Driver> {
  if (!driver) {
    return await initDriver();
  }
  return driver;
}

/**
 * Neo4j接続をテストする
 * @returns 接続が成功した場合はtrue、失敗した場合はfalse
 */
export async function testConnection(): Promise<boolean> {
  try {
    const driverInstance = await getDriver();
    await driverInstance.verifyConnectivity();
    console.log('Neo4j接続に成功しました');
    return true;
  } catch (error) {
    console.error('Neo4j接続テストに失敗しました:', error);
    return false;
  }
}

/**
 * セッションを取得する
 * @returns Neo4jセッション
 */
export async function getSession(): Promise<Session> {
  const driver = await getDriver();
  return driver.session();
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
  const session = await getSession();
  try {
    let labels: string;
    let nodeProperties: Record<string, any>;
    
    // パラメータの解析
    if (typeof labelOrOptions === 'object' && !Array.isArray(labelOrOptions)) {
      // オブジェクト形式
      labels = labelOrOptions.labels.join(':');
      nodeProperties = { ...labelOrOptions.properties };
    } else {
      // 文字列または配列形式
      if (Array.isArray(labelOrOptions)) {
        labels = labelOrOptions.join(':');
      } else {
        labels = labelOrOptions;
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
    
    // プロパティのJSONシリアライズ
    const props: Record<string, any> = {};
    for (const key in nodeProperties) {
      if (typeof nodeProperties[key] === 'object' && nodeProperties[key] !== null) {
        props[key] = JSON.stringify(nodeProperties[key]);
      } else {
        props[key] = nodeProperties[key];
      }
    }
    
    // Cypher クエリの実行
    const result = await session.run(
      `CREATE (n:${labels} $props) RETURN n.id as id`,
      { props }
    );
    
    return result.records[0].get('id') as string;
  } finally {
    await session.close();
  }
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
  const session = await getSession();
  try {
    // ラベルとプロパティの準備
    const labels = options.labels.join(':');
    const matchProps = { ...options.matchProperties };
    const createProps = { 
      ...matchProps, 
      ...(options.createProperties || {}),
      id: matchProps.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    
    // プロパティのJSONシリアライズ
    const matchPropsJson: Record<string, any> = {};
    for (const key in matchProps) {
      if (typeof matchProps[key] === 'object' && matchProps[key] !== null) {
        matchPropsJson[key] = JSON.stringify(matchProps[key]);
      } else {
        matchPropsJson[key] = matchProps[key];
      }
    }
    
    const createPropsJson: Record<string, any> = {};
    for (const key in createProps) {
      if (typeof createProps[key] === 'object' && createProps[key] !== null) {
        createPropsJson[key] = JSON.stringify(createProps[key]);
      } else {
        createPropsJson[key] = createProps[key];
      }
    }
    
    // Cypher クエリの実行
    const result = await session.run(
      `
      MERGE (n:${labels} {id: $matchProps.id})
      ON CREATE SET n = $createProps
      RETURN n.id as id
      `,
      { 
        matchProps: matchPropsJson, 
        createProps: createPropsJson 
      }
    );
    
    return result.records[0].get('id') as string;
  } finally {
    await session.close();
  }
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
  const session = await getSession();
  try {
    // プロパティの準備
    const props = { 
      ...(options.properties || {}), 
      id: options.properties?.id || uuidv4(),
      createdAt: options.properties?.createdAt || new Date().toISOString()
    };
    
    // プロパティのJSONシリアライズ
    const propsJson: Record<string, any> = {};
    for (const key in props) {
      if (typeof props[key] === 'object' && props[key] !== null) {
        propsJson[key] = JSON.stringify(props[key]);
      } else {
        propsJson[key] = props[key];
      }
    }
    
    // Cypher クエリの実行
    const result = await session.run(
      `
      MATCH (source {id: $sourceId})
      MATCH (target {id: $targetId})
      CREATE (source)-[r:${options.type} $props]->(target)
      RETURN r.id as id
      `,
      { 
        sourceId: options.sourceNodeId, 
        targetId: options.targetNodeId,
        props: propsJson
      }
    );
    
    return result.records[0].get('id') as string;
  } finally {
    await session.close();
  }
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
  const session = await getSession();
  try {
    // 型指定の有無に応じたクエリ
    const typeClause = options.type ? `:${options.type}` : '';
    
    // Cypher クエリの実行
    await session.run(
      `
      MATCH (source {id: $sourceId})-[r${typeClause}]->(target {id: $targetId})
      DELETE r
      `,
      { 
        sourceId: options.sourceNodeId, 
        targetId: options.targetNodeId
      }
    );
  } finally {
    await session.close();
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
  const session = await getSession();
  try {
    // Cypher クエリの実行 - ノードとリレーションシップを取得
    const result = await session.run(
      `
      MATCH (n)-[r]-(m)
      WHERE n.roleModelId = $roleModelId OR m.roleModelId = $roleModelId
      RETURN n, r, m
      `,
      { roleModelId }
    );
    
    const nodes: Record<string, any>[] = [];
    const edges: Record<string, any>[] = [];
    const nodeMap = new Map<string, boolean>();
    
    // レコードを処理してノードとエッジを抽出
    result.records.forEach((record: Neo4jRecord) => {
      const n = record.get('n').properties;
      const m = record.get('m').properties;
      const r = record.get('r').properties;
      
      // ノードの追加 (重複を避ける)
      if (!nodeMap.has(n.id)) {
        nodes.push(processNodeProperties(n));
        nodeMap.set(n.id, true);
      }
      
      if (!nodeMap.has(m.id)) {
        nodes.push(processNodeProperties(m));
        nodeMap.set(m.id, true);
      }
      
      // エッジの追加
      edges.push({
        id: r.id || uuidv4(),
        source: n.id,
        target: m.id,
        type: record.get('r').type,
        ...processEdgeProperties(r)
      });
    });
    
    return { nodes, edges };
  } finally {
    await session.close();
  }
}

/**
 * ノードの子ノードを取得する
 * @param nodeId 親ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 子ノードの配列
 */
export async function getChildNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  const session = await getSession();
  try {
    // 型指定の有無に応じたクエリ
    const typeClause = relationshipType ? `:${relationshipType}` : '';
    
    // Cypher クエリの実行
    const result = await session.run(
      `
      MATCH (parent {id: $nodeId})-[r${typeClause}]->(child)
      RETURN child, type(r) as relationType
      `,
      { nodeId }
    );
    
    return result.records.map((record: Neo4jRecord) => {
      const node = processNodeProperties(record.get('child').properties);
      node.relationType = record.get('relationType');
      return node;
    });
  } finally {
    await session.close();
  }
}

/**
 * ノードの親ノードを取得する
 * @param nodeId 子ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 親ノードの配列
 */
export async function getParentNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  const session = await getSession();
  try {
    // 型指定の有無に応じたクエリ
    const typeClause = relationshipType ? `:${relationshipType}` : '';
    
    // Cypher クエリの実行
    const result = await session.run(
      `
      MATCH (child {id: $nodeId})<-[r${typeClause}]-(parent)
      RETURN parent, type(r) as relationType
      `,
      { nodeId }
    );
    
    return result.records.map((record: Neo4jRecord) => {
      const node = processNodeProperties(record.get('parent').properties);
      node.relationType = record.get('relationType');
      return node;
    });
  } finally {
    await session.close();
  }
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
 * ドライバをクローズする
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
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
    // 接続テスト
    const driver = await getDriver();
    await driver.verifyConnectivity();
    console.log(`Neo4j接続に成功しました`);
    
    // ロールモデルIDが有効かチェック
    if (!roleModelId) {
      console.warn('無効なロールモデルID');
      return { nodes: [], edges: [] };
    }
    
    return await getKnowledgeGraphForRoleModel(roleModelId);
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
    
    // JSON文字列を解析
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
    
    // JSON文字列を解析
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