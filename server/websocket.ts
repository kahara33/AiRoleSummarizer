import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'cookie';
import { verifySession } from './auth';

// UUIDの検証関数
function isValidUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

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
        if (data.type === 'subscribe' && data.payload && data.payload.roleModelId) {
          const requestedRoleModelId = data.payload.roleModelId;
          
          // UUIDが有効かどうかを検証する
          if (requestedRoleModelId === 'default' || !isValidUUID(requestedRoleModelId)) {
            console.error(`無効なUUID形式: ${requestedRoleModelId}`);
            ws.send(JSON.stringify({
              type: 'error',
              message: `無効なUUID形式: ${requestedRoleModelId}`
            }));
            return;
          }
          
          roleModelId = requestedRoleModelId;
          console.log(`WebSocket: ユーザー ${userId || 'anonymous'} がロールモデル ${roleModelId} を購読しました`);
          
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
  
  // メッセージ形式を修正（payloadにネストして送信）
  const message = {
    type,
    payload: {
      ...payload,
      roleModelId,
      timestamp: new Date().toISOString()
    }
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

/**
 * エージェントの思考プロセスを送信する拡張関数
 * @param agentName エージェント名
 * @param thoughts 思考内容
 * @param roleModelId ロールモデルID
 * @param additionalData 追加データ (詳細な思考プロセス、推論、決定事項など)
 */
export function sendAgentThoughts(
  agentName: string, 
  thoughts: string, 
  roleModelId?: string,
  additionalData?: {
    agentType?: string;
    stage?: string;
    thinking?: Array<{
      step: string;
      content: string;
      timestamp: string;
    }>;
    reasoning?: string;
    decision?: string;
    context?: any;
    inputData?: any;
    outputData?: any;
  }
): void {
  console.log(`エージェント思考: ${agentName} - ${thoughts.substring(0, 50)}...`);
  
  if (roleModelId && isValidUUID(roleModelId)) {
    // 標準的なエージェントタイプを特定する
    const standardizedAgentType = 
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("industry") ? "industry-analysis" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("keyword") ? "keyword-expansion" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("structur") ? "structuring" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("graph") ? "knowledge-graph" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("orchestr") ? "orchestrator" : "agent";
    
    const payload = {
      agentName,
      thoughts,
      // 追加データがある場合はマージする
      ...additionalData,
      // エージェントタイプが指定されていない場合は標準化したタイプを使用
      agentType: additionalData?.agentType || standardizedAgentType,
      // 詳細な思考プロセスがない場合、基本的な思考ステップを生成
      thinking: additionalData?.thinking || [{
        step: "思考プロセス",
        content: thoughts,
        timestamp: new Date().toISOString()
      }]
    };
    
    sendMessageToRoleModelViewers('agent_thoughts', payload, roleModelId);
  } else {
    console.error(`無効なUUID形式のロールモデルID: ${roleModelId}`);
  }
}

/**
 * 進捗更新情報を送信する拡張関数
 * @param message メッセージ
 * @param progress 進捗率 (0-100)
 * @param roleModelId ロールモデルID
 * @param additionalData 追加データ (詳細な進捗情報など)
 */
export function sendProgressUpdate(
  message: string, 
  progress: number, 
  roleModelId: string,
  additionalData?: {
    stage?: string;
    subStage?: string;
    detailedProgress?: Array<{
      step: string;
      progress: number;
      status: 'pending' | 'processing' | 'completed' | 'error';
      message?: string;
    }>;
  }
): void {
  console.log(`進捗更新: ${message} (${progress}%) - ロールモデル ${roleModelId}`);
  
  if (isValidUUID(roleModelId)) {
    const payload = {
      message,
      progress,
      // 追加データがある場合はマージする
      ...additionalData
    };
    
    sendMessageToRoleModelViewers('progress', payload, roleModelId);
  } else {
    console.error(`無効なUUID形式のロールモデルID: ${roleModelId}`);
  }
}