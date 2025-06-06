import neo4j, { Driver, Session, Record as Neo4jRecord, QueryResult } from 'neo4j-driver';

let driver: Driver;

/**
 * Neo4jドライバーの初期化
 * 非同期で実行され、接続に失敗しても他の機能に影響しない
 */
export async function initNeo4j(): Promise<Driver | null> {
  // すでにドライバーが初期化されている場合は、そのドライバーを返す
  if (driver) {
    return driver;
  }

  // 環境変数が設定されていない場合は、Neo4jを使用しない
  if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
    console.log('Neo4j環境変数が設定されていないため、Neo4jは使用しません');
    console.log('必要な環境変数: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD');
    console.log('PostgreSQLからデータを取得する代替処理に自動的に切り替えます');
    return null;
  }

  const connectWithTimeout = async (timeout: number): Promise<Driver | null> => {
    return new Promise((resolve) => {
      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        console.error(`Neo4j接続がタイムアウトしました (${timeout}ms)`);
        resolve(null);
      }, timeout);

      try {
        const uri = process.env.NEO4J_URI;
        const user = process.env.NEO4J_USER;
        const password = process.env.NEO4J_PASSWORD;

        // 環境変数が未設定の場合は処理を中断
        if (!uri || !user || !password) {
          clearTimeout(timeoutId);
          console.error('Neo4j環境変数が不足しています');
          resolve(null);
          return;
        }

        // ドライバーの作成
        const newDriver = neo4j.driver(
          uri as string, 
          neo4j.auth.basic(user as string, password as string), 
          {
            maxTransactionRetryTime: 30000,
            connectionTimeout: 15000, // 接続タイムアウトを15秒に設定
          }
        );

        // 接続テスト
        newDriver.verifyConnectivity()
          .then(() => {
            clearTimeout(timeoutId);
            driver = newDriver;
            console.log('Neo4j接続に成功しました');
            resolve(driver);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            console.error('Neo4j接続に失敗しました:', error);
            // ドライバーをクローズ
            newDriver.close().catch(e => console.error('ドライバークローズエラー:', e));
            resolve(null);
          });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Neo4jドライバー作成エラー:', error);
        resolve(null);
      }
    });
  };

  // タイムアウト30秒で接続試行
  return await connectWithTimeout(30000);
}

/**
 * Neo4jセッションの取得
 * タイムアウト機構付きで、一定時間内に接続できない場合はnullを返す
 */
export async function getSession(): Promise<Session | null> {
  // タイムアウト付きでセッション取得を試みる
  const getSessionWithTimeout = async (timeout: number): Promise<Session | null> => {
    return new Promise((resolve) => {
      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        console.error(`Neo4jセッション取得がタイムアウトしました (${timeout}ms)`);
        resolve(null);
      }, timeout);

      try {
        if (!driver) {
          // まだドライバーが初期化されていない場合、初期化を試みる
          initNeo4j().then(newDriver => {
            clearTimeout(timeoutId);
            
            if (!newDriver) {
              resolve(null);
              return;
            }
            
            try {
              const session = newDriver.session();
              resolve(session);
            } catch (error) {
              console.error('Neo4jセッション作成エラー:', error);
              resolve(null);
            }
          }).catch(error => {
            clearTimeout(timeoutId);
            console.error('Neo4j初期化エラー:', error);
            resolve(null);
          });
        } else {
          // すでにドライバーが初期化されている場合
          try {
            const session = driver.session();
            clearTimeout(timeoutId);
            resolve(session);
          } catch (error) {
            clearTimeout(timeoutId);
            console.error('Neo4jセッション作成エラー:', error);
            resolve(null);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Neo4jセッション取得中の予期せぬエラー:', error);
        resolve(null);
      }
    });
  };

  // 5秒のタイムアウトでセッション取得を試みる
  return await getSessionWithTimeout(5000);
}

/**
 * クエリの実行
 */
export async function runQuery(
  query: string,
  params: Record<string, any> = {}
): Promise<Neo4jRecord[]> {
  const session = await getSession();
  
  if (!session) {
    console.log('Neo4jセッションが取得できなかったため、操作をスキップします');
    return [];
  }
  
  try {
    const result = await session.run(query, params);
    return result.records;
  } finally {
    if (session) {
      await session.close();
    }
  }
}

/**
 * ノードの作成
 */
export async function createNode(
  label: string,
  properties: Record<string, any>,
  roleModelId: string
): Promise<Neo4jRecord | null> {
  const session = await getSession();
  
  if (!session) {
    console.log('Neo4jセッションが取得できなかったため、ノード作成をスキップします');
    return null;
  }
  
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
      console.error('ノードの作成に失敗しました');
      return null;
    }
    
    return result.records[0];
  } catch (error) {
    console.error('ノード作成エラー:', error);
    return null;
  } finally {
    if (session) {
      await session.close();
    }
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
): Promise<Neo4jRecord | null> {
  const session = await getSession();
  
  if (!session) {
    console.log('Neo4jセッションが取得できなかったため、関係作成をスキップします');
    return null;
  }
  
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
      console.error('関係の作成に失敗しました');
      return null;
    }
    
    return result.records[0];
  } catch (error) {
    console.error('関係作成エラー:', error);
    return null;
  } finally {
    if (session) {
      await session.close();
    }
  }
}

/**
 * ナレッジグラフの取得
 */
export async function getKnowledgeGraph(roleModelId: string): Promise<{
  nodes: any[];
  edges: any[];
}> {
  // UUIDの検証
  if (!roleModelId || roleModelId === 'default') {
    console.error(`無効なUUID形式: ${roleModelId}`);
    return { nodes: [], edges: [] };
  }
  
  const session = await getSession();
  
  if (!session) {
    console.log('Neo4jセッションが取得できなかったため、空のグラフを返します');
    return { nodes: [], edges: [] };
  }
  
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
  } catch (error) {
    console.error('グラフ取得エラー:', error);
    return { nodes: [], edges: [] };
  } finally {
    if (session) {
      await session.close();
    }
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