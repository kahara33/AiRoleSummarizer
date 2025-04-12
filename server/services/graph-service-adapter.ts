/**
 * グラフサービスアダプタ
 * メモリベースのグラフサービスを提供する
 * （Neo4jが利用できない環境でも動作するよう、常にメモリベースの実装を使用）
 */

import * as memoryGraphService from './memory-graph-service';

// 常にメモリベースのグラフサービスを使用
const neo4jAvailable = false;

/**
 * Neo4jサービスが利用可能かどうかを確認する
 * @returns 常にfalseを返す
 */
export async function checkNeo4jAvailability(): Promise<boolean> {
  console.log('メモリベースのグラフサービスを使用します');
  return false;
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
  try {
    if (neo4jAvailable) {
      return await neo4jService.createRelationship(options);
    } else {
      return await memoryGraphService.createRelationship(options);
    }
  } catch (error) {
    console.warn('Neo4jでリレーションシップ作成に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.createRelationship(options);
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
  try {
    if (neo4jAvailable) {
      await neo4jService.deleteRelationship(options);
    } else {
      await memoryGraphService.deleteRelationship(options);
    }
  } catch (error) {
    console.warn('Neo4jでリレーションシップ削除に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    await memoryGraphService.deleteRelationship(options);
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
  try {
    if (neo4jAvailable) {
      return await neo4jService.getKnowledgeGraphForRoleModel(roleModelId);
    } else {
      return await memoryGraphService.getKnowledgeGraphForRoleModel(roleModelId);
    }
  } catch (error) {
    console.warn('Neo4jでナレッジグラフ取得に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.getKnowledgeGraphForRoleModel(roleModelId);
  }
}

/**
 * ノードの子ノードを取得する
 * @param nodeId 親ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 子ノードの配列
 */
export async function getChildNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  try {
    if (neo4jAvailable) {
      return await neo4jService.getChildNodes(nodeId, relationshipType);
    } else {
      return await memoryGraphService.getChildNodes(nodeId, relationshipType);
    }
  } catch (error) {
    console.warn('Neo4jで子ノード取得に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.getChildNodes(nodeId, relationshipType);
  }
}

/**
 * ノードの親ノードを取得する
 * @param nodeId 子ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 親ノードの配列
 */
export async function getParentNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  try {
    if (neo4jAvailable) {
      return await neo4jService.getParentNodes(nodeId, relationshipType);
    } else {
      return await memoryGraphService.getParentNodes(nodeId, relationshipType);
    }
  } catch (error) {
    console.warn('Neo4jで親ノード取得に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.getParentNodes(nodeId, relationshipType);
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
  try {
    if (neo4jAvailable) {
      return await neo4jService.generateNewKnowledgeGraph(roleModelId, options);
    } else {
      return await memoryGraphService.generateNewKnowledgeGraph(roleModelId, options);
    }
  } catch (error) {
    console.warn('Neo4jでナレッジグラフ生成に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.generateNewKnowledgeGraph(roleModelId, options);
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
    if (neo4jAvailable) {
      const result = await neo4jService.getKnowledgeGraph(roleModelId);
      // Neo4jから空のグラフが返された場合はメモリグラフをチェック
      if (result.nodes.length === 0 && result.edges.length === 0) {
        return await memoryGraphService.getKnowledgeGraph(roleModelId);
      }
      return result;
    } else {
      return await memoryGraphService.getKnowledgeGraph(roleModelId);
    }
  } catch (error) {
    console.warn('Neo4jでナレッジグラフ取得に失敗しました。メモリベースのサービスを使用します:', error);
    neo4jAvailable = false;
    return await memoryGraphService.getKnowledgeGraph(roleModelId);
  }
}

// 初期化時にNeo4jの利用可能性をチェック
checkNeo4jAvailability().catch(() => {
  console.warn('Neo4jの利用可能性チェックに失敗しました。メモリベースのグラフサービスを使用します。');
  neo4jAvailable = false;
});