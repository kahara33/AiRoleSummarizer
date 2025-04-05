import neo4j, { Driver, Session, Record as Neo4jRecord, QueryResult } from 'neo4j-driver';

let driver: Driver;

/**
 * Neo4jドライバーの初期化
 */
export async function initNeo4j(): Promise<Driver> {
  if (driver) {
    return driver;
  }

  try {
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxTransactionRetryTime: 30000,
    });

    // 接続テスト
    await driver.verifyConnectivity();
    console.log('Neo4j接続に成功しました');

    return driver;
  } catch (error) {
    console.error('Neo4j接続に失敗しました:', error);
    throw error;
  }
}

/**
 * Neo4jセッションの取得
 */
export async function getSession(): Promise<Session> {
  if (!driver) {
    await initNeo4j();
  }
  return driver.session();
}

/**
 * クエリの実行
 */
export async function runQuery(
  query: string,
  params: Record<string, any> = {}
): Promise<Neo4jRecord[]> {
  const session = await getSession();
  
  try {
    const result = await session.run(query, params);
    return result.records;
  } finally {
    await session.close();
  }
}

/**
 * ノードの作成
 */
export async function createNode(
  label: string,
  properties: Record<string, any>,
  roleModelId: string
): Promise<Neo4jRecord> {
  const session = await getSession();
  
  try {
    const query = `
      CREATE (n:${label} {id: $id, roleModelId: $roleModelId, ${Object.keys(properties)
        .filter(key => key !== 'id' && key !== 'roleModelId')
        .map(key => `${key}: $${key}`)
        .join(', ')}})
      RETURN n
    `;
    
    const params = {
      id: properties.id,
      roleModelId,
      ...properties,
    };
    
    const result = await session.run(query, params);
    if (result.records.length === 0) {
      throw new Error('ノードの作成に失敗しました');
    }
    
    return result.records[0];
  } finally {
    await session.close();
  }
}

/**
 * 関係の作成
 */
export async function createRelationship(
  sourceId: string,
  targetId: string,
  type: string,
  properties: Record<string, any> = {},
  roleModelId: string
): Promise<Neo4jRecord> {
  const session = await getSession();
  
  try {
    const propertiesClause = Object.keys(properties).length > 0
      ? `{${Object.keys(properties).map(key => `${key}: $${key}`).join(', ')}}`
      : '';
    
    const query = `
      MATCH (source {id: $sourceId}), (target {id: $targetId})
      WHERE source.roleModelId = $roleModelId AND target.roleModelId = $roleModelId
      CREATE (source)-[r:${type} ${propertiesClause}]->(target)
      RETURN r
    `;
    
    const params = {
      sourceId,
      targetId,
      roleModelId,
      ...properties,
    };
    
    const result = await session.run(query, params);
    if (result.records.length === 0) {
      throw new Error('関係の作成に失敗しました');
    }
    
    return result.records[0];
  } finally {
    await session.close();
  }
}

/**
 * ナレッジグラフの取得
 */
export async function getKnowledgeGraph(roleModelId: string): Promise<{
  nodes: any[];
  edges: any[];
}> {
  const session = await getSession();
  
  try {
    // ノードの取得
    const nodesQuery = `
      MATCH (n)
      WHERE n.roleModelId = $roleModelId
      RETURN n
    `;
    
    const nodesResult = await session.run(nodesQuery, { roleModelId });
    const nodes = nodesResult.records.map(record => {
      const node = record.get('n');
      return {
        id: node.properties.id,
        name: node.properties.name,
        description: node.properties.description,
        type: node.properties.type || node.labels[0].toLowerCase(),
        level: node.properties.level || 0,
        parentId: node.properties.parentId,
        color: node.properties.color,
      };
    });
    
    // エッジの取得
    const edgesQuery = `
      MATCH (source)-[r]->(target)
      WHERE source.roleModelId = $roleModelId AND target.roleModelId = $roleModelId
      RETURN source.id AS source, target.id AS target, type(r) AS type, properties(r) AS properties
    `;
    
    const edgesResult = await session.run(edgesQuery, { roleModelId });
    const edges = edgesResult.records.map(record => {
      const properties = record.get('properties');
      return {
        source: record.get('source'),
        target: record.get('target'),
        type: record.get('type').toLowerCase(),
        label: properties.label,
        strength: properties.strength || 1,
      };
    });
    
    return { nodes, edges };
  } finally {
    await session.close();
  }
}

/**
 * Neo4j接続の終了
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
  }
}