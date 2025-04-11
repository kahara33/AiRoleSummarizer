/**
 * ナレッジグラフ関連のユーティリティ関数
 */
import { db } from './db';
import { knowledgeNodes, knowledgeEdges } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { WebSocket } from 'ws';

/**
 * 既存の知識グラフデータをWebSocketクライアントに送信する関数
 * @param ws WebSocketクライアント
 * @param roleModelId ロールモデルID
 * @returns 処理結果の約束（Promise）
 */
export async function sendExistingKnowledgeGraph(ws: WebSocket, roleModelId: string): Promise<boolean> {
  try {
    console.log(`既存ナレッジグラフデータを取得中: roleModelId=${roleModelId}`);

    // データベースからそのロールモデルのノードとエッジを取得
    const nodes = await db.query.knowledgeNodes.findMany({
      where: eq(knowledgeNodes.roleModelId, roleModelId),
    });

    const edges = await db.query.knowledgeEdges.findMany({
      where: eq(knowledgeEdges.roleModelId, roleModelId),
    });

    console.log(`ナレッジグラフデータ取得完了: ${nodes.length}個のノードと${edges.length}個のエッジを取得`);

    // データが存在するか確認
    if (nodes.length === 0 && edges.length === 0) {
      console.log(`ロールモデル ${roleModelId} の既存ナレッジグラフデータは見つかりませんでした`);
      
      // データがない場合も通知を送信
      ws.send(JSON.stringify({
        type: 'knowledge_graph_data',
        roleModelId,
        message: 'ナレッジグラフデータは存在しません',
        status: 'empty',
        data: { nodes: [], edges: [] },
        timestamp: new Date().toISOString()
      }));
      
      return true;
    }

    // データを送信
    console.log(`既存ナレッジグラフデータを送信中: roleModelId=${roleModelId}, ${nodes.length}ノード, ${edges.length}エッジ`);
    
    // 知識グラフデータを送信
    ws.send(JSON.stringify({
      type: 'knowledge_graph_data',
      roleModelId,
      message: 'ナレッジグラフデータを取得しました',
      status: 'success',
      data: { 
        nodes,
        edges
      },
      timestamp: new Date().toISOString()
    }));
    
    console.log(`ナレッジグラフデータの送信が完了しました: roleModelId=${roleModelId}`);
    return true;
  } catch (error) {
    console.error(`ナレッジグラフデータ送信エラー: ${error}`);
    
    // エラー通知を送信
    ws.send(JSON.stringify({
      type: 'knowledge_graph_error',
      roleModelId,
      message: 'ナレッジグラフデータの取得中にエラーが発生しました',
      status: 'error',
      timestamp: new Date().toISOString()
    }));
    
    return false;
  }
}