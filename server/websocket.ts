import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import url from 'url';
import { verifySession } from './auth';

interface Client {
  id: string;
  ws: WebSocket;
  userId?: string;
  roleModelId?: string;
}

// クライアント管理
let clients: Client[] = [];

/**
 * WebSocketサーバーの初期化
 * @param server HTTPサーバーインスタンス
 */
export function setupWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  console.log('WebSocketサーバーが初期化されました');

  // 接続時の処理
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // クライアントID生成
    const clientId = generateClientId();
    
    // セッションCookieからユーザーIDを取得
    const cookies = parseCookies(req);
    const sessionId = cookies['connect.sid'];
    const userId = sessionId ? await verifySession(sessionId) : null;
    
    // クエリパラメータから表示中のロールモデルIDを取得
    const queryParams = url.parse(req.url || '', true).query;
    const roleModelId = queryParams.roleModelId as string;
    
    // クライアント情報を記録
    const client: Client = {
      id: clientId,
      ws,
      userId: userId || undefined,
      roleModelId: roleModelId,
    };
    
    clients.push(client);
    
    console.log(`新しいWebSocket接続: クライアントID=${clientId}, ユーザーID=${userId || 'ゲスト'}`);
    
    // 認証状態をクライアントに通知
    const authStatus = {
      type: 'auth-status',
      payload: {
        authenticated: !!userId,
        userId: userId,
      },
    };
    
    ws.send(JSON.stringify(authStatus));
    
    // クライアントがメッセージを送信した時の処理
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log(`クライアント ${clientId} からのメッセージ:`, data);
        
        // 必要に応じてメッセージを処理
        handleClientMessage(client, data);
      } catch (error) {
        console.error('WebSocketメッセージの解析エラー:', error);
      }
    });
    
    // 接続が閉じられた時の処理
    ws.on('close', () => {
      console.log(`クライアント ${clientId} の接続が閉じられました`);
      clients = clients.filter(c => c.id !== clientId);
    });
    
    // エラー処理
    ws.on('error', (error) => {
      console.error(`クライアント ${clientId} でエラーが発生:`, error);
    });
  });

  return wss;
}

/**
 * 全クライアントにメッセージをブロードキャスト
 * @param type メッセージタイプ
 * @param payload メッセージデータ
 * @param filter 特定の条件でフィルタリング
 */
export function broadcastMessage(
  type: string,
  payload: any,
  filter?: (client: Client) => boolean
): void {
  const message = JSON.stringify({ type, payload });
  
  clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(client)) {
        client.ws.send(message);
      }
    }
  });
}

/**
 * 特定のロールモデル閲覧者にメッセージを送信
 * @param type メッセージタイプ
 * @param payload メッセージデータ
 * @param roleModelId ロールモデルID
 */
export function sendMessageToRoleModelViewers(
  type: string,
  payload: any,
  roleModelId: string
): void {
  broadcastMessage(type, payload, client => client.roleModelId === roleModelId);
}

/**
 * エージェントの思考プロセスを送信
 * @param agentName エージェント名
 * @param thought 思考内容
 * @param roleModelId ロールモデルID (オプション)
 */
export function sendAgentThoughts(
  agentName: string,
  thought: string,
  roleModelId?: string
): void {
  const payload = {
    agent: agentName,
    thought: thought,
    timestamp: new Date().toISOString()
  };
  
  if (roleModelId) {
    sendMessageToRoleModelViewers('agent-thoughts', payload, roleModelId);
  } else {
    broadcastMessage('agent-thoughts', payload);
  }
}

/**
 * 進捗状況を送信
 * @param message 進捗メッセージ
 * @param percent 完了パーセンテージ (0-100)
 * @param roleModelId ロールモデルID (オプション)
 */
export function sendProgressUpdate(
  message: string,
  percent: number,
  roleModelId?: string
): void {
  const payload = {
    message,
    percent: Math.min(100, Math.max(0, percent)),
    timestamp: new Date().toISOString()
  };
  
  if (roleModelId) {
    sendMessageToRoleModelViewers('progress-update', payload, roleModelId);
  } else {
    broadcastMessage('progress-update', payload);
  }
}

/**
 * 特定のユーザーにメッセージを送信
 * @param type メッセージタイプ
 * @param payload メッセージデータ
 * @param userId ユーザーID
 */
export function sendMessageToUser(
  type: string,
  payload: any,
  userId: string
): void {
  broadcastMessage(type, payload, client => client.userId === userId);
}

/**
 * クライアントメッセージの処理
 * @param client クライアント情報
 * @param data メッセージデータ
 */
function handleClientMessage(client: Client, data: any): void {
  const { type, payload } = data;
  
  switch (type) {
    case 'subscribe-role-model':
      // ロールモデル購読のリクエスト
      client.roleModelId = payload.roleModelId;
      console.log(`クライアント ${client.id} がロールモデル ${payload.roleModelId} を購読`);
      break;
      
    case 'agent-control':
      // エージェント制御コマンド
      if (client.userId) {
        // 認証済みユーザーからのコマンドのみ処理
        console.log(`ユーザー ${client.userId} からのエージェント制御コマンド:`, payload);
        // ここでエージェント制御のロジックを呼び出す
      }
      break;
  }
}

/**
 * 一意のクライアントIDを生成
 */
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * リクエストヘッダーからCookieを解析
 * @param req リクエストオブジェクト
 * @returns Cookieオブジェクト
 */
function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = decodeURIComponent(value);
    });
  }
  
  return cookies;
}