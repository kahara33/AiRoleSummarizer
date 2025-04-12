/**
 * グラフサービスアダプタ
 * 優先的にNeo4jを使用し、利用できない場合はメモリベースのグラフサービスにフォールバック
 */

import * as memoryGraphService from './memory-graph-service';
import * as neo4jService from './neo4j-service';

// Neo4jの利用可能性を保持するフラグ
let neo4jAvailable = false;

/**
 * Neo4jサービスが利用可能かどうかを確認する
 * @returns Neo4jサービスが利用可能な場合はtrue、そうでない場合はfalse
 */
export async function checkNeo4jAvailability(): Promise<boolean> {
  try {
    const result = await neo4jService.testConnection();
    neo4jAvailable = result;
    if (result) {
      console.log('Neo4jデータベースに接続しました。Neo4jグラフサービスを使用します。');
    } else {
      console.log('Neo4jに接続できませんでした。メモリベースのグラフサービスを使用します。');
    }
    return result;
  } catch (error) {
    console.error('Neo4j接続テスト中にエラーが発生しました:', error);
    neo4jAvailable = false;
    console.log('メモリベースのグラフサービスを使用します');
    return false;
  }
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.createNode(labelOrOptions, properties, roleModelId);
    } catch (error) {
      console.error('Neo4jでのノード作成に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.createNode(labelOrOptions, properties, roleModelId);
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.findOrCreateNode(options);
    } catch (error) {
      console.error('Neo4jでのノード検索/作成に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.findOrCreateNode(options);
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.createRelationship(options);
    } catch (error) {
      console.error('Neo4jでのリレーションシップ作成に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.createRelationship(options);
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
  if (neo4jAvailable) {
    try {
      await neo4jService.deleteRelationship(options);
      return;
    } catch (error) {
      console.error('Neo4jでのリレーションシップ削除に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  await memoryGraphService.deleteRelationship(options);
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.getKnowledgeGraphForRoleModel(roleModelId);
    } catch (error) {
      console.error('Neo4jでのナレッジグラフ取得に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.getKnowledgeGraphForRoleModel(roleModelId);
}

/**
 * ノードの子ノードを取得する
 * @param nodeId 親ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 子ノードの配列
 */
export async function getChildNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  if (neo4jAvailable) {
    try {
      return await neo4jService.getChildNodes(nodeId, relationshipType);
    } catch (error) {
      console.error('Neo4jでの子ノード取得に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.getChildNodes(nodeId, relationshipType);
}

/**
 * ノードの親ノードを取得する
 * @param nodeId 子ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 親ノードの配列
 */
export async function getParentNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  if (neo4jAvailable) {
    try {
      return await neo4jService.getParentNodes(nodeId, relationshipType);
    } catch (error) {
      console.error('Neo4jでの親ノード取得に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.getParentNodes(nodeId, relationshipType);
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.generateNewKnowledgeGraph(roleModelId, options);
    } catch (error) {
      console.error('Neo4jでのナレッジグラフ生成に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.generateNewKnowledgeGraph(roleModelId, options);
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
  if (neo4jAvailable) {
    try {
      return await neo4jService.getKnowledgeGraph(roleModelId);
    } catch (error) {
      console.error('Neo4jでのナレッジグラフ取得に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return await memoryGraphService.getKnowledgeGraph(roleModelId);
}

// 初期化関数
(async function initialize() {
  try {
    // 環境変数をチェック
    const hasNeo4jCredentials = process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD;
    
    if (!hasNeo4jCredentials) {
      console.warn('Neo4j認証情報が設定されていません。メモリベースのグラフサービスを使用します。');
      neo4jAvailable = false;
      return;
    }
    
    // Neo4j接続テスト
    neo4jAvailable = await neo4jService.testConnection();
    
    if (neo4jAvailable) {
      console.info('Neo4jグラフデータベースを優先的に使用します。Neo4j接続が失敗した場合はメモリベースのグラフサービスに自動的に切り替えます。');
    } else {
      console.info('メモリベースのグラフサービスを使用します。Neo4j接続が利用できない場合はこのモードを使用します。');
    }
  } catch (error) {
    console.error('グラフサービス初期化エラー:', error);
    neo4jAvailable = false;
    console.info('メモリベースのグラフサービスを使用します。Neo4j接続が利用できない場合はこのモードを使用します。');
  }
})();