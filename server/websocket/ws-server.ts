import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

// WebSocketの状態を表す定数
const WS_CONSTANTS = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// WebSocketクライアントの型定義
interface WSClient {
  id: string;
  userId: string;
  roleModelId: string;
  socket: WebSocket;
}

// 進捗更新データの型定義
export interface ProgressUpdateData {
  message: string;
  percent: number;
  roleModelId?: string;
}

// WebSocketメッセージの型定義
export interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

// WebSocketサーバークラス
export class WSServerManager {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private static instance: WSServerManager | null = null;

  // コンストラクタ - HTTPサーバーと関連付ける
  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      // ViteのWebSocketと競合しないよう専用パスを設定
      path: '/api/ws' 
    });
    
    // 接続イベントの処理
    this.wss.on('connection', (socket: WebSocket, req: any) => {
      try {
        // URLからクエリパラメータを取得
        const { query } = parse(req.url || '', true);
        const userId = query.userId as string;
        const roleModelId = query.roleModelId as string;
        
        if (!userId) {
          console.warn('ユーザーIDが指定されていません。接続を閉じます。');
          socket.close(1003, 'ユーザーIDが必要です');
          return;
        }
        
        // クライアントIDの生成（単純なUUID代替）
        const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        console.log(`新しいWebSocket接続: clientId=${clientId}, userId=${userId}, roleModelId=${roleModelId || 'なし'}`);
        
        // クライアントを保存
        this.clients.set(clientId, {
          id: clientId,
          userId,
          roleModelId: roleModelId || '',
          socket
        });
        
        // メッセージ受信イベントの処理
        socket.on('message', (data: any) => {
          try {
            const message = JSON.parse(data.toString()) as WSMessage;
            console.log(`メッセージ受信: clientId=${clientId}, type=${message.type}`);
            
            // pingメッセージへの応答
            if (message.type === 'ping') {
              // クライアントから受信したピングに応答
              console.log(`WebSocketメッセージ受信: type=${message.type}, roleModelId=${roleModelId}`);
              console.log('Ping received from client');
              
              // pongレスポンスを送信
              try {
                socket.send(JSON.stringify({
                  type: 'pong',
                  payload: {
                    time: new Date().toISOString()
                  },
                  timestamp: new Date().toISOString()
                }));
              } catch (e) {
                console.error('Pong送信エラー:', e);
              }
            }
            
            // メッセージイベントを発火
            this.emit('message', {
              clientId,
              userId,
              roleModelId,
              message
            });
          } catch (error) {
            console.error(`メッセージ解析エラー: ${error}`);
          }
        });
        
        // 切断イベントの処理
        socket.on('close', (code: number, reason: string) => {
          console.log(`WebSocket切断: clientId=${clientId}, code=${code}, reason=${reason}`);
          this.clients.delete(clientId);
          
          // 切断イベントを発火
          this.emit('disconnect', {
            clientId,
            userId,
            roleModelId,
            code,
            reason
          });
        });
        
        // エラーイベントの処理
        socket.on('error', (error: Error) => {
          console.error(`WebSocketエラー: clientId=${clientId}`, error);
          
          // エラーイベントを発火
          this.emit('error', {
            clientId,
            userId,
            roleModelId,
            error
          });
        });
        
        // PING/PONGの設定
        socket.on('pong', () => {
          // console.log(`PONG received from clientId=${clientId}`);
        });
        
        // 接続確立イベントを発火
        this.emit('connect', {
          clientId,
          userId,
          roleModelId
        });
        
        // 接続成功メッセージを送信
        this.sendToClient(clientId, {
          type: 'connect_success',
          payload: {
            message: '接続が確立されました',
            clientId,
            roleModelId
          }
        });
      } catch (error) {
        console.error('WebSocket connection handler error:', error);
        socket.close(1011, '内部サーバーエラー');
      }
    });
    
    // 定期的なクライアント監視
    setInterval(() => {
      // 全クライアントに対してPINGを送信
      Array.from(this.clients.entries()).forEach(([clientId, client]) => {
        if (client.socket.readyState === WS_CONSTANTS.OPEN) {
          client.socket.ping();
        } else if (client.socket.readyState !== WS_CONSTANTS.CONNECTING) {
          console.log(`非アクティブなクライアントを削除: clientId=${clientId}, state=${client.socket.readyState}`);
          this.clients.delete(clientId);
        }
      });
    }, 30000); // 30秒ごと
  }
  
  // 特定のクライアントにメッセージを送信
  sendToClient(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WS_CONSTANTS.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`クライアントへのメッセージ送信エラー: clientId=${clientId}`, error);
      }
    }
    return false;
  }
  
  // 特定のユーザーにメッセージを送信（同じユーザーの全セッション）
  sendToUser(userId: string, message: WSMessage): number {
    let sentCount = 0;
    
    Array.from(this.clients.entries()).forEach(([clientId, client]) => {
      if (client.userId === userId && client.socket.readyState === WS_CONSTANTS.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`ユーザーへのメッセージ送信エラー: userId=${userId}, clientId=${clientId}`, error);
        }
      }
    });
    
    return sentCount;
  }
  
  // 特定のロールモデルを閲覧中のユーザーにメッセージを送信
  sendToRoleModelViewers(roleModelId: string, message: WSMessage): number {
    let sentCount = 0;
    
    if (!roleModelId) {
      console.warn('roleModelIdが指定されていないため、メッセージは送信されません');
      return 0;
    }
    
    // デバッグログの抑制 - メッセージタイプが重要なものか特定の条件の場合のみログ出力
    const isImportantMessage = 
      message.type === 'progress-update' ||
      message.type === 'crewai_error' ||
      message.type === 'cancel_operation_result';
      
    // pingやagent_thoughtsなどの高頻度メッセージはログ出力しない
    if (isImportantMessage) {
      console.log(`ロールモデル ${roleModelId} 閲覧者にメッセージを送信します: type=${message.type}`);
    }
    
    let foundClients = false;
    
    Array.from(this.clients.keys()).forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === WS_CONSTANTS.OPEN) {
        // 対象のロールモデルを見ているクライアントにのみメッセージを送信
        const shouldSend = client.roleModelId === roleModelId;
        
        if (shouldSend) {
          try {
            client.socket.send(JSON.stringify(message));
            sentCount++;
            foundClients = true;
          } catch (error) {
            console.error(`クライアントへのメッセージ送信エラー: clientId=${clientId}`, error);
          }
        }
      }
    });
    
    // 重要なメッセージの場合のみ追加のログを出力
    if (isImportantMessage) {
      if (!foundClients) {
        console.log(`ロールモデル ${roleModelId} に接続されたアクティブなクライアントはありません`);
      } else {
        console.log(`${sentCount}件のクライアントにメッセージを送信しました: type=${message.type}`);
      }
    }
    
    return sentCount;
  }
  
  // 全クライアントにメッセージをブロードキャスト - デバッグのみ使用
  broadcast(message: WSMessage): number {
    let sentCount = 0;
    
    // 注意: ブロードキャストはデバッグモードでのみ使用すべき
    // 本番環境では通常、特定のユーザーまたはロールモデル視聴者にのみ送信する
    console.warn('ブロードキャスト機能が使用されました。これはデバッグ目的でのみ使用してください。');
    console.warn(`ブロードキャストメッセージ: type=${message.type}`);
    
    // エージェント思考メッセージを特別に処理
    if (message.type === 'agent_thought' || message.type === 'agent_thoughts') {
      console.log('エージェント思考メッセージはRoleModel固有のチャネルを介して処理されるべきです。');
      console.log('一時的にブロードキャストを許可しますが、適切なRoleModelの対象を指定してください。');
      
      // エージェント思考メッセージをすべてのクライアントに送信
      // これは一時的な措置です - 実際にはroleModelIdを指定して送信すべきです
      if (!message.payload.roleModelId) {
        message.payload.roleModelId = 'default';
      }
    }
    
    // デバッグインジケータをペイロードに追加
    const debugMessage = {
      ...message,
      payload: {
        ...message.payload,
        _debug_broadcast: true // これによりクライアントは通常操作と区別できる
      }
    };
    
    Array.from(this.clients.values()).forEach(client => {
      if (client.socket.readyState === WS_CONSTANTS.OPEN) {
        try {
          client.socket.send(JSON.stringify(debugMessage));
          sentCount++;
        } catch (error) {
          console.error(`ブロードキャストエラー: clientId=${client.id}`, error);
        }
      }
    });
    
    return sentCount;
  }
  
  // イベントリスナーの管理
  private eventListeners: Record<string, Function[]> = {};
  
  // イベントリスナーの追加
  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }
  
  // イベントの発火
  private emit(event: string, data: any) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`WebSocketイベントリスナーエラー: event=${event}`, error);
        }
      });
    }
  }
  
  // インスタンスの取得（シングルトンパターン）
  static getInstance(): WSServerManager | null {
    return WSServerManager.instance;
  }
  
  // インスタンスの設定
  static setInstance(instance: WSServerManager): void {
    WSServerManager.instance = instance;
  }
}

// WebSocketサーバーの初期化
export function initWebSocketServer(server: Server): WSServerManager {
  if (!server) {
    console.warn('HTTPサーバーが指定されていません。WebSocketサーバーは初期化されません。');
    return WSServerManager.getInstance() as WSServerManager;
  }
  
  // 既存のインスタンスがあれば返す
  if (WSServerManager.getInstance()) {
    return WSServerManager.getInstance() as WSServerManager;
  }
  
  // 新しいインスタンスを作成
  const wss = new WSServerManager(server);
  WSServerManager.setInstance(wss);
  console.log('WebSocketサーバーが初期化されました');
  
  return wss;
}

// WebSocketサーバーのインスタンスを取得
export function getWebSocketServer(): WSServerManager | null {
  return WSServerManager.getInstance();
}

// 進捗更新の送信ヘルパー関数
export function sendProgressUpdate(data: ProgressUpdateData): number {
  const wss = getWebSocketServer();
  if (!wss) {
    console.warn('WebSocketサーバーが初期化されていないため、進捗更新を送信できません');
    return 0;
  }
  
  if (!data.roleModelId) {
    console.warn('roleModelIdが指定されていないため、進捗更新は送信されません');
    return 0;
  }
  
  const message: WSMessage = {
    type: 'progress-update',
    payload: {
      message: data.message,
      percent: data.percent,
      roleModelId: data.roleModelId
    },
    timestamp: new Date().toISOString()
  };
  
  return wss.sendToRoleModelViewers(data.roleModelId, message);
}

// エージェント思考の送信ヘルパー関数
export function sendAgentThoughts(
  agentName: string,
  thought: string,
  roleModelId: string,
  additionalData: any = {}
): number {
  const wss = getWebSocketServer();
  if (!wss) {
    console.warn('WebSocketサーバーが初期化されていないため、エージェント思考を送信できません');
    return 0;
  }
  
  if (!roleModelId) {
    console.warn('roleModelIdが指定されていないため、エージェント思考は送信されません');
    return 0;
  }
  
  // クライアント側のハンドラで確実に認識されるようにメッセージ形式を修正
  const message: WSMessage = {
    type: 'agent_thought', // クライアント側の主要なイベントハンドラ名
    payload: {
      id: crypto.randomUUID(), // 一意のIDを必ず生成
      agentName,
      thought,
      message: thought, // クライアント側の互換性のため
      roleModelId,
      timestamp: new Date().toISOString(), // タイムスタンプをペイロード内にも含める
      ...additionalData
    },
    timestamp: new Date().toISOString()
  };
  
  // 高頻度で発生するエージェント思考メッセージのログは最小限に抑える
  console.log(`エージェント思考メッセージを送信します: agentName=${agentName}, roleModelId=${roleModelId}, type=${message.type}`);
  
  // 単一のメッセージタイプで送信（クライアント側のallリスナーがすべて処理するため）
  const sentCount = wss.sendToRoleModelViewers(roleModelId, message);
  
  return sentCount;
}

// ロールモデル閲覧者へのメッセージ送信ヘルパー関数
export function sendMessageToRoleModelViewers(
  roleModelId: string,
  type: string,
  payload: any
): number {
  const wss = getWebSocketServer();
  if (!wss) {
    console.warn('WebSocketサーバーが初期化されていないため、メッセージを送信できません');
    return 0;
  }
  
  if (!roleModelId) {
    console.warn('roleModelIdが指定されていないため、メッセージは送信されません');
    return 0;
  }
  
  const message: WSMessage = {
    type,
    payload,
    timestamp: new Date().toISOString()
  };
  
  return wss.sendToRoleModelViewers(roleModelId, message);
}