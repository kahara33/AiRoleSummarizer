/**
 * グラフサービスアダプタ
 * 優先的にNeo4jを使用し、利用できない場合はメモリベースのグラフサービスにフォールバック
 * ナレッジグラフの作成、取得、操作するための統合インターフェースを提供
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
 * 特定のロールモデルの既存ナレッジグラフを削除する
 * @param roleModelId ロールモデルID
 * @returns 削除されたノード数
 */
export async function deleteExistingKnowledgeGraph(roleModelId: string): Promise<number> {
  console.log(`ロールモデル "${roleModelId}" の既存ナレッジグラフを削除します`);
  if (neo4jAvailable) {
    try {
      return await neo4jService.deleteKnowledgeGraphByRoleModelId(roleModelId);
    } catch (error) {
      console.error('Neo4jでのナレッジグラフ削除に失敗しました。メモリベースに切り替えます:', error);
      neo4jAvailable = false;
    }
  }
  return 0; // メモリベースの場合は新規生成時に自動的に上書きされる
}

/**
 * 新しいナレッジグラフを生成する
 * @param roleModelId ロールモデルID
 * @param options グラフ生成オプション
 * @param forceOverwrite 既存のグラフを上書きするかどうか
 * @returns 生成されたグラフのメインノードID
 */
export async function generateNewKnowledgeGraph(
  roleModelId: string,
  options: {
    mainTopic: string;
    subTopics?: string[];
    description?: string;
    createdBy?: string;
  },
  forceOverwrite: boolean = false
): Promise<string> {
  // 強制上書きモードが有効なら、まず既存のグラフを削除
  if (forceOverwrite) {
    console.log(`既存のナレッジグラフを削除します (roleModelId=${roleModelId})`);
    const deletedCount = await deleteExistingKnowledgeGraph(roleModelId);
    console.log(`${deletedCount}ノードが削除されました`);
  }
  
  // 新しいグラフを生成
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

/**
 * ナレッジグラフを保存する
 * @param roleModelId ロールモデルID
 * @param graphData グラフデータ
 * @returns 保存が成功したかどうか
 */
export async function saveKnowledgeGraph(roleModelId: string, graphData: {
  nodes: any[];
  edges: any[];
}): Promise<boolean> {
  console.log(`ナレッジグラフを保存: roleModelId=${roleModelId}, ノード数=${graphData.nodes.length}, エッジ数=${graphData.edges.length}`);
  
  if (neo4jAvailable) {
    try {
      // 既存のグラフを削除
      await neo4jService.deleteKnowledgeGraphByRoleModelId(roleModelId);
      
      // ノードの作成
      const nodeIdMap = new Map<string, string>();
      
      for (const node of graphData.nodes) {
        const nodeId = await neo4jService.createNode(
          node.type,
          {
            ...node.properties,
            label: node.label,
            roleModelId
          },
          roleModelId
        );
        
        // 元のノードIDと新しいノードIDのマッピングを保存
        nodeIdMap.set(node.id, nodeId);
      }
      
      // エッジの作成
      for (const edge of graphData.edges) {
        // マッピングされたノードIDを使用
        const sourceId = nodeIdMap.get(edge.source);
        const targetId = nodeIdMap.get(edge.target);
        
        if (sourceId && targetId) {
          await neo4jService.createRelationship(
            sourceId,
            targetId,
            edge.type,
            edge.properties || {}
          );
        }
      }
      
      console.log(`ナレッジグラフを保存しました: roleModelId=${roleModelId}`);
      return true;
    } catch (error) {
      console.error('Neo4jでのナレッジグラフ保存に失敗しました:', error);
      neo4jAvailable = false;
    }
  }
  
  // メモリベースストレージの場合は簡易的に保存
  try {
    // メモリサービスには直接的な保存機能がないため、既存のグラフの代わりに新しいグラフを設定
    console.log(`メモリベースでナレッジグラフを保存: roleModelId=${roleModelId}`);
    memoryGraphService.setKnowledgeGraph(roleModelId, graphData);
    return true;
  } catch (error) {
    console.error('メモリベースでのナレッジグラフ保存に失敗しました:', error);
    return false;
  }
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