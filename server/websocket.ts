import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'cookie';
import { verifySession } from './auth';

// 接続中のクライアントソケットを格納するマップ
// ユーザーID -> そのユーザーが開いている全WebSocket接続
const clients = new Map<string, Set<WebSocket>>();

// ロールモデルID -> そのロールモデルに関心のあるWebSocket接続
const roleModelSubscriptions = new Map<string, Set<WebSocket>>();

/**
 * WebSocketサーバーをセットアップ
 * @param httpServer HTTPサーバー
 */
export function setupWebSocketServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', async (ws, req) => {
    console.log('WebSocket接続を受け付けました');
    
    let userId: string | null = null;
    let roleModelId: string | null = null;
    
    // クッキーからセッションIDを取得し、ユーザー認証を行う
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = parse(cookieHeader);
      const sessionId = cookies['connect.sid'];
      
      if (sessionId) {
        try {
          userId = await verifySession(sessionId);
          console.log(`WebSocket: ユーザー ${userId} が認証されました`);
        } catch (error) {
          console.error('WebSocket: セッション検証エラー:', error);
        }
      }
    }
    
    // 開発環境では認証をスキップする
    if (!userId) {
      console.log('WebSocket: 開発環境のため認証なしで接続を許可します');
      userId = "anonymous"; // 開発環境用の一時的なID
    }
    
    // クライアントマップに追加
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);
    
    // クライアントからのメッセージを処理
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // ロールモデルの購読
        if (data.type === 'subscribe' && data.roleModelId) {
          roleModelId = data.roleModelId;
          console.log(`WebSocket: ユーザー ${userId} がロールモデル ${roleModelId} を購読しました`);
          
          if (!roleModelSubscriptions.has(roleModelId)) {
            roleModelSubscriptions.set(roleModelId, new Set());
          }
          roleModelSubscriptions.get(roleModelId)!.add(ws);
          
          // 購読確認のレスポンスを送信
          ws.send(JSON.stringify({
            type: 'subscribed',
            roleModelId: roleModelId
          }));
        }
      } catch (error) {
        console.error('WebSocket: メッセージ処理エラー:', error);
      }
    });
    
    // 接続クローズ時の処理
    ws.on('close', () => {
      console.log(`WebSocket: ユーザー ${userId} の接続が閉じられました`);
      
      // クライアントリストから削除
      if (userId && clients.has(userId)) {
        clients.get(userId)!.delete(ws);
        if (clients.get(userId)!.size === 0) {
          clients.delete(userId);
        }
      }
      
      // サブスクリプションリストから削除
      if (roleModelId && roleModelSubscriptions.has(roleModelId)) {
        roleModelSubscriptions.get(roleModelId)!.delete(ws);
        if (roleModelSubscriptions.get(roleModelId)!.size === 0) {
          roleModelSubscriptions.delete(roleModelId);
        }
      }
    });
    
    // 初期状態の通知
    ws.send(JSON.stringify({
      type: 'connected',
      userId: userId
    }));
  });
  
  console.log('WebSocketサーバーが起動しました');
}

/**
 * 特定のユーザーにメッセージを送信
 * @param userId ユーザーID
 * @param message 送信するメッセージ
 */
export function sendToUser(userId: string, message: any): void {
  if (clients.has(userId)) {
    const userSockets = clients.get(userId)!;
    for (const socket of userSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }
  }
}

/**
 * 特定のロールモデルを購読しているクライアントにメッセージを送信
 * @param type メッセージタイプ
 * @param payload メッセージ内容
 * @param roleModelId ロールモデルID
 */
export function sendMessageToRoleModelViewers(type: string, payload: any, roleModelId: string): void {
  console.log(`Sending ${type} message to roleModel ${roleModelId} subscribers:`, payload);
  
  const message = {
    type,
    ...payload,
    roleModelId,
    timestamp: new Date().toISOString()
  };
  
  if (roleModelSubscriptions.has(roleModelId)) {
    const subscribers = roleModelSubscriptions.get(roleModelId)!;
    console.log(`Sending to ${subscribers.size} subscribers`);
    
    for (const socket of subscribers) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(message));
        } catch (err) {
          console.error('WebSocket送信エラー:', err);
        }
      }
    }
  } else {
    console.log(`No subscribers found for roleModel ${roleModelId}`);
  }
}

export function sendAgentThoughts(agentName: string, thoughts: string, roleModelId?: string): void {
  console.log(`エージェント思考: ${agentName} - ${thoughts.substring(0, 50)}...`);
  
  if (roleModelId) {
    const payload = {
      agentName,
      thoughts
    };
    
    sendMessageToRoleModelViewers('agent_thoughts', payload, roleModelId);
  }
}

export function sendProgressUpdate(message: string, progress: number, roleModelId: string): void {
  console.log(`進捗更新: ${message} (${progress}%) - ロールモデル ${roleModelId}`);
  
  const payload = {
    message,
    progress
  };
  
  sendMessageToRoleModelViewers('progress', payload, roleModelId);
}