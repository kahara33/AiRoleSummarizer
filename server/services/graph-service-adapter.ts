/**
 * グラフサービスアダプタ
 * メモリベースのグラフサービスを提供する
 * （Neo4jが利用できない環境でも動作するよう、常にメモリベースの実装を使用）
 */

import * as memoryGraphService from './memory-graph-service';

// 常にメモリベースのグラフサービスを使用
let neo4jAvailable = false;

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
  return await memoryGraphService.getKnowledgeGraphForRoleModel(roleModelId);
}

/**
 * ノードの子ノードを取得する
 * @param nodeId 親ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 子ノードの配列
 */
export async function getChildNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
  return await memoryGraphService.getChildNodes(nodeId, relationshipType);
}

/**
 * ノードの親ノードを取得する
 * @param nodeId 子ノードID
 * @param relationshipType リレーションシップタイプ（オプション）
 * @returns 親ノードの配列
 */
export async function getParentNodes(nodeId: string, relationshipType?: string): Promise<Record<string, any>[]> {
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
  return await memoryGraphService.getKnowledgeGraph(roleModelId);
}

// Neo4jは使用せず、常にメモリベースのグラフサービスを使用
console.info('メモリベースのグラフサービスを使用します。');