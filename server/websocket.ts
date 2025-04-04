/**
 * WebSocketサーバー
 * クライアントとのリアルタイム通信を管理するモジュール
 */

import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { verifySession } from './auth';

/**
 * WebSocket通信の接続状態
 */
export enum WebSocketState {
  OPEN = 1
}

/**
 * WebSocketクライアント接続情報
 */
interface ClientConnection {
  id: string;           // 接続ID
  ws: WebSocket;        // WebSocketインスタンス
  userId: string;       // ユーザーID
  roleModelIds: string[]; // 購読している役割モデルID
}

/**
 * WebSocketメッセージ型
 */
interface WebSocketMessage {
  type: string;         // メッセージタイプ
  payload: any;         // ペイロード
}

// アクティブな接続を管理するMap
const clients = new Map<string, ClientConnection>();

/**
 * WebSocketサーバーを設定する
 * @param server HTTPサーバー
 * @returns 設定されたWebSocketServer
 */
export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  wss.on('connection', async (ws, req) => {
    // クライアント識別子を生成
    const clientId = randomUUID();
    
    // クッキーからセッションIDを取得
    const cookies = req.headers.cookie || '';
    const sessionIdMatch = cookies.match(/connect\.sid=s%3A([^.]+)/);
    let userId = null;
    
    if (sessionIdMatch && sessionIdMatch[1]) {
      const sessionId = decodeURIComponent(sessionIdMatch[1]);
      userId = await verifySession(sessionId);
    }
    
    if (!userId) {
      console.log('WebSocket connection rejected: Not authenticated');
      ws.close(4001, 'Not authenticated');
      return;
    }
    
    // クライアント情報を保存
    const client: ClientConnection = {
      id: clientId,
      ws,
      userId,
      roleModelIds: []
    };
    
    clients.set(clientId, client);
    console.log(`WebSocket client connected: ${clientId}, userId: ${userId}`);
    
    // 接続確認メッセージを送信
    sendMessage(ws, {
      type: 'connected',
      payload: { clientId }
    });
    
    // メッセージ受信時の処理
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(clientId, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // 接続終了時の処理
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });
  
  return wss;
}

/**
 * クライアントからのメッセージを処理する
 * @param clientId クライアントID
 * @param message 受信したメッセージ
 */
function handleClientMessage(clientId: string, message: WebSocketMessage): void {
  const client = clients.get(clientId);
  if (!client) return;
  
  switch (message.type) {
    case 'subscribe_role_model':
      // 役割モデルの購読
      if (message.payload && message.payload.roleModelId) {
        const { roleModelId } = message.payload;
        
        if (!client.roleModelIds.includes(roleModelId)) {
          client.roleModelIds.push(roleModelId);
          console.log(`Client ${clientId} subscribed to role model: ${roleModelId}`);
          
          sendMessage(client.ws, {
            type: 'subscription_success',
            payload: { roleModelId }
          });
        }
      }
      break;
      
    case 'unsubscribe_role_model':
      // 役割モデルの購読解除
      if (message.payload && message.payload.roleModelId) {
        const { roleModelId } = message.payload;
        
        client.roleModelIds = client.roleModelIds.filter(id => id !== roleModelId);
        console.log(`Client ${clientId} unsubscribed from role model: ${roleModelId}`);
        
        sendMessage(client.ws, {
          type: 'unsubscription_success',
          payload: { roleModelId }
        });
      }
      break;
      
    case 'ping':
      // Keep-alive ping
      sendMessage(client.ws, { type: 'pong', payload: {} });
      break;
      
    default:
      console.log(`Unknown message type from client ${clientId}: ${message.type}`);
  }
}

/**
 * WebSocket経由でメッセージを送信する
 * @param ws WebSocketインスタンス
 * @param message 送信するメッセージ
 */
function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
  if (ws.readyState === WebSocketState.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 特定ユーザーの特定役割モデルに関連する全クライアントにエージェントの思考を送信する
 * @param userId ユーザーID
 * @param roleModelId 役割モデルID
 * @param agentName エージェント名
 * @param message メッセージ内容
 * @param type メッセージタイプ（デフォルト: 'info'）
 */
export function sendAgentThoughts(
  userId: string,
  roleModelId: string,
  agentName: string,
  message: string,
  type: 'info' | 'error' | 'success' | 'thinking' = 'info'
): void {
  for (const client of clients.values()) {
    if (
      client.userId === userId &&
      client.roleModelIds.includes(roleModelId) &&
      client.ws.readyState === WebSocketState.OPEN
    ) {
      sendMessage(client.ws, {
        type: 'agent_thoughts',
        payload: {
          timestamp: Date.now(),
          agentName,
          message,
          type
        }
      });
    }
  }
}

/**
 * 特定ユーザーの特定役割モデルに関連する全クライアントに進捗状況を送信する
 * @param userId ユーザーID
 * @param roleModelId 役割モデルID
 * @param stage 現在のステージ
 * @param progress 進捗率（0-100）
 * @param details 詳細情報
 */
export function sendProgressUpdate(
  userId: string,
  roleModelId: string,
  stage: string,
  progress: number,
  details: any = {}
): void {
  for (const client of clients.values()) {
    if (
      client.userId === userId &&
      client.roleModelIds.includes(roleModelId) &&
      client.ws.readyState === WebSocketState.OPEN
    ) {
      sendMessage(client.ws, {
        type: 'progress_update',
        payload: {
          stage,
          progress,
          message: details.message || `${stage} ${progress}% 完了`,
          details
        }
      });
    }
  }
}

/**
 * 特定ユーザーの特定役割モデルに関連する全クライアントにエラーを送信する
 * @param userId ユーザーID
 * @param roleModelId 役割モデルID
 * @param error エラーメッセージ
 * @param details 詳細情報
 */
export function sendErrorMessage(
  userId: string,
  roleModelId: string,
  error: string,
  details: any = {}
): void {
  for (const client of clients.values()) {
    if (
      client.userId === userId &&
      client.roleModelIds.includes(roleModelId) &&
      client.ws.readyState === WebSocketState.OPEN
    ) {
      sendMessage(client.ws, {
        type: 'error',
        payload: {
          timestamp: Date.now(),
          error,
          details
        }
      });
    }
  }
}