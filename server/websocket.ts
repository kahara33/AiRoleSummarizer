/**
 * WebSocket サービス
 * リアルタイムの進捗状況や思考出力を提供するためのWebSocket実装
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import cookieParser from 'cookie-parser';
import { verifySession } from './auth';
import { AgentProgress, AgentOutputMessage } from './agents/types';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  activeModels: Set<string>;
}

// クライアント接続を追跡するためのマップ
const clientConnections: Map<string, ClientConnection> = new Map();

/**
 * WebSocketサーバーをHTTPサーバーに接続する
 * @param server HTTPサーバー
 */
export function setupWebSocketServer(server: Server): void {
  // WebSocketサーバーの初期化（パスを/wsに設定）
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  wss.on('connection', async (ws, request) => {
    try {
      console.log('New WebSocket connection established');
      
      // クエリパラメータからsessionIdを取得
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');
      
      // セッションIDがない場合は接続を閉じる
      if (!sessionId) {
        console.log('No sessionId provided, closing connection');
        ws.close(1008, 'No sessionId provided');
        return;
      }
      
      // セッションIDを検証してユーザーIDを取得
      const userId = await verifySession(sessionId);
      
      // 認証に失敗した場合は接続を閉じる
      if (!userId) {
        console.log('Invalid sessionId, closing connection');
        ws.close(1008, 'Invalid session');
        return;
      }
      
      // クライアント情報を設定
      const clientId = `${userId}_${Date.now()}`;
      const client: ClientConnection = {
        ws,
        userId,
        activeModels: new Set()
      };
      
      // クライアント管理マップに追加
      clientConnections.set(clientId, client);
      
      // クライアントごとのカスタムプロパティとしてユーザーIDを設定
      (ws as any).userId = userId;
      (ws as any).clientId = clientId;
      
      // ウェルカムメッセージを送信
      ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'WebSocket connection established',
        timestamp: Date.now()
      }));
      
      // クライアント切断時の処理
      ws.on('close', () => {
        console.log(`WebSocket connection closed for client ${clientId}`);
        clientConnections.delete(clientId);
      });
      
      // エラー処理
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
      
      // クライアントからのメッセージ処理
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          // クライアントからのモデル購読リクエスト
          if (data.type === 'subscribe_model' && data.modelId) {
            client.activeModels.add(data.modelId);
            ws.send(JSON.stringify({
              type: 'subscribe_success',
              modelId: data.modelId,
              timestamp: Date.now()
            }));
          }
          
          // クライアントからのモデル購読解除リクエスト
          if (data.type === 'unsubscribe_model' && data.modelId) {
            client.activeModels.delete(data.modelId);
            ws.send(JSON.stringify({
              type: 'unsubscribe_success',
              modelId: data.modelId,
              timestamp: Date.now()
            }));
          }
          
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });
      
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  console.log('WebSocket server is set up and ready');
}

/**
 * 指定されたユーザーと役割モデルに関する進捗状況を送信する
 * @param userId ユーザーID
 * @param modelId 役割モデルID
 * @param stage 現在のステージ
 * @param progress 進捗率（0-100）
 * @param details 詳細情報（オプション）
 */
export function sendProgressUpdate(
  userId: string,
  modelId: string,
  stage: string,
  progress: number,
  details?: any
): void {
  const progressData: AgentProgress = {
    stage,
    progress: Math.max(0, Math.min(100, progress)),
    message: details?.message || `${stage}: ${progress}%`,
    details
  };
  
  const message = JSON.stringify({
    type: 'progress_update',
    modelId,
    timestamp: Date.now(),
    data: progressData
  });
  
  // 該当するユーザーとモデルに関連するすべてのクライアントに送信
  sendToMatchingClients(userId, modelId, message);
}

/**
 * エージェント思考出力を送信する
 * @param userId ユーザーID
 * @param modelId 役割モデルID
 * @param agentName エージェント名
 * @param message メッセージ内容
 * @param type メッセージタイプ（デフォルト: thinking）
 */
export function sendAgentThoughts(
  userId: string,
  modelId: string,
  agentName: string,
  message: string,
  type: 'info' | 'error' | 'success' | 'thinking' = 'thinking'
): void {
  const thoughtData: AgentOutputMessage = {
    timestamp: Date.now(),
    agentName,
    message,
    type
  };
  
  const wsMessage = JSON.stringify({
    type: 'agent_thoughts',
    modelId,
    timestamp: Date.now(),
    data: thoughtData
  });
  
  // 該当するユーザーとモデルに関連するすべてのクライアントに送信
  sendToMatchingClients(userId, modelId, wsMessage);
}

/**
 * 条件に一致するクライアントにメッセージを送信する内部ヘルパー関数
 * @param userId ユーザーID
 * @param modelId モデルID
 * @param message 送信するメッセージ
 */
function sendToMatchingClients(userId: string, modelId: string, message: string): void {
  let matchingClients = 0;
  
  for (const client of clientConnections.values()) {
    // ユーザーIDが一致し、購読中のモデルかグローバル購読していれば送信
    if (client.userId === userId && 
        (client.activeModels.has(modelId) || client.activeModels.has('*'))) {
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        matchingClients++;
      }
    }
  }
  
  // デバッグ用：送信状況をログに出力
  console.log(`Sent message to ${matchingClients} clients for user ${userId} and model ${modelId}`);
  
  // 接続されているクライアントがない場合は、コンソールにメッセージを表示
  if (matchingClients === 0) {
    const data = JSON.parse(message);
    
    if (data.type === 'agent_thoughts') {
      console.log(`Agent thought (no clients): ${data.data.agentName} - ${data.data.message}`);
    } else if (data.type === 'progress_update') {
      console.log(`Progress update (no clients): ${data.data.stage} - ${data.data.message}`);
    }
  }
}