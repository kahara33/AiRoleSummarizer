import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import * as cookie from 'cookie';
import { verifySession } from './auth';

// クライアント管理用マップ: ユーザーIDごとの接続リスト
const clients = new Map<string, WebSocket[]>();

// ユーザーIDをリクエストから取得
function getUserIdFromRequest(req: IncomingMessage): string {
  try {
    // URLからクエリパラメータを取得
    const { query } = parse(req.url || '', true);
    
    // クエリパラメータからユーザーIDを取得
    if (query.userId && typeof query.userId === 'string') {
      return query.userId;
    }
    
    // Cookieからセッション情報を取得
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies['connect.sid'];
    
    if (sessionId) {
      const userId = verifySession(sessionId);
      if (userId) return userId;
    }
    
    // 上記の方法でユーザーIDが取得できない場合、不明ユーザーとして扱う
    return 'unknown';
  } catch (error) {
    console.error('Error getting user ID from request:', error);
    return 'unknown';
  }
}

/**
 * WebSocketサーバーを初期化
 */
export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });
  
  console.log('WebSocket server initialized');
  
  wss.on('connection', (ws, req) => {
    const userId = getUserIdFromRequest(req);
    console.log(`New WebSocket connection for user: ${userId}`);
    
    // ユーザーのWebSocket接続リストを取得または作成
    if (!clients.has(userId)) {
      clients.set(userId, []);
    }
    clients.get(userId)?.push(ws);
    
    // 接続時に初期メッセージを送信
    ws.send(JSON.stringify({
      type: 'connection_established',
      userId,
      timestamp: new Date().toISOString()
    }));
    
    // 接続が閉じられたときの処理
    ws.on('close', () => {
      console.log(`WebSocket connection closed for user: ${userId}`);
      const userClients = clients.get(userId) || [];
      clients.set(userId, userClients.filter(client => client !== ws));
    });
    
    // エラー発生時の処理
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
    
    // クライアントからのメッセージを受信した場合の処理（必要に応じて）
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from user ${userId}:`, data);
        
        // 必要に応じてメッセージを処理
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  });
  
  return wss;
}

/**
 * 進捗状況更新をユーザーに送信
 */
export function sendProgressUpdate(
  userId: string, 
  roleModelId: string, 
  stage: string, 
  progress: number, 
  details?: any
) {
  const userClients = clients.get(userId) || [];
  if (userClients.length === 0) {
    console.log(`No WebSocket connections for user: ${userId}`);
    return;
  }
  
  const message = JSON.stringify({
    type: 'progress_update',
    roleModelId,
    stage,
    progress,
    details,
    timestamp: new Date().toISOString()
  });
  
  let sentCount = 0;
  userClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });
  
  console.log(`Sent progress update (${stage}: ${progress}%) to ${sentCount} clients for user ${userId}`);
}

/**
 * エージェントの思考過程を送信
 */
export function sendAgentThoughts(
  userId: string,
  roleModelId: string,
  agentName: string,
  thoughts: string
) {
  const userClients = clients.get(userId) || [];
  if (userClients.length === 0) return;
  
  const message = JSON.stringify({
    type: 'agent_thoughts',
    roleModelId,
    agentName,
    thoughts,
    timestamp: new Date().toISOString()
  });
  
  userClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * エラーメッセージを送信
 */
export function sendErrorMessage(
  userId: string,
  roleModelId: string,
  errorMessage: string,
  errorDetails?: any
) {
  const userClients = clients.get(userId) || [];
  if (userClients.length === 0) return;
  
  const message = JSON.stringify({
    type: 'error',
    roleModelId,
    errorMessage,
    errorDetails,
    timestamp: new Date().toISOString()
  });
  
  userClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
