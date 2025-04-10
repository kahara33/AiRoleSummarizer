import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

// グローバル名前空間に変数を定義
declare global {
  var graphUpdateCounter: number;
}

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
  status?: string; // 'completed', 'error'などの状態を示す
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
        
        // クエリパラメータからclientIdを取得（なければ生成）
        let clientId: string;
        if (query.clientId) {
          clientId = query.clientId as string;
        } else {
          clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        }
        
        if (!userId) {
          console.warn('ユーザーIDが指定されていません。接続を閉じます。');
          socket.close(1003, 'ユーザーIDが必要です');
          return;
        }
        
        // Nodeの内部ソケット設定を最適化（可能な場合）
        if ((socket as any)._socket && typeof (socket as any)._socket.setNoDelay === 'function') {
          (socket as any)._socket.setNoDelay(true);
        }
        
        console.log(`新しいWebSocket接続: clientId=${clientId}, userId=${userId}, roleModelId=${roleModelId || 'なし'}`);
        
        // 既存の接続を閉じる（同じクライアントIDから再接続の場合）
        if (this.clients.has(clientId)) {
          try {
            const existingClient = this.clients.get(clientId);
            if (existingClient && existingClient.socket.readyState === WS_CONSTANTS.OPEN) {
              console.log(`既存のWebSocket接続を閉じます: clientId=${clientId}`);
              existingClient.socket.close(1000, '新しい接続が確立されました');
            }
          } catch (error) {
            console.error(`既存接続のクローズエラー: clientId=${clientId}`, error);
          }
        }
        
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
  
  // 一意のIDとタイムスタンプを生成
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // イベントカウンターを初期化（未定義の場合）
  if (typeof global.graphUpdateCounter !== 'number') {
    global.graphUpdateCounter = 1;
  }
  
  // 進捗率を0～100の範囲に確実に収める
  const normalizedPercent = Math.max(0, Math.min(100, data.percent));
  
  // ステータスを標準化（完了状態の場合）
  let normalizedStatus = data.status;
  if (normalizedPercent >= 100 && (!normalizedStatus || normalizedStatus === 'in_progress')) {
    normalizedStatus = 'completed';
  }
  
  // 標準的な進捗メッセージフォーマット
  const message: WSMessage = {
    type: 'progress', // クライアント側では'progress'という名前のイベントハンドラが設定されている
    payload: {
      id: messageId,
      messageId: messageId,
      message: data.message || `進捗: ${normalizedPercent}%`,
      // すべての命名規則をサポート（クライアント側の互換性のため）
      progress: normalizedPercent,
      percent: normalizedPercent,
      progressPercent: normalizedPercent,
      // ロールモデルID
      roleModelId: data.roleModelId,
      // ステータス情報
      status: normalizedStatus,
      // タイムスタンプとシーケンス情報
      timestamp: timestamp,
      updateCounter: global.graphUpdateCounter++,
      // 完了状態かどうかのフラグ（追加の互換性フィールド）
      isCompleted: normalizedPercent >= 100 || normalizedStatus === 'completed',
      isError: normalizedStatus === 'error'
    },
    timestamp: timestamp
  };
  
  // 進捗メッセージを送信
  const sentCount = wss.sendToRoleModelViewers(data.roleModelId, message);
  
  // 完了状態（100%）の場合、progress-updateとしても送信
  if (normalizedPercent >= 100 || normalizedStatus === 'completed') {
    try {
      // 完了情報をより明示的に伝えるメッセージタイプも送信
      const completionMessage: WSMessage = {
        type: 'progress-update',
        payload: {
          ...message.payload,
          status: 'completed'
        },
        timestamp: timestamp
      };
      wss.sendToRoleModelViewers(data.roleModelId, completionMessage);
      
      // 明示的に完了メッセージも送信（互換性のため）
      const explicitCompletionMessage: WSMessage = {
        type: 'completion',
        payload: {
          ...message.payload,
          message: data.message || 'ナレッジグラフ生成プロセスが完了しました',
        },
        timestamp: timestamp
      };
      wss.sendToRoleModelViewers(data.roleModelId, explicitCompletionMessage);
      
      console.log(`完了進捗メッセージを送信しました: roleModelId=${data.roleModelId}, progress=${normalizedPercent}%`);
    } catch (error) {
      console.error('完了進捗メッセージの送信中にエラーが発生しました:', error);
    }
  }
  
  // エラー状態の場合、errorとしても送信
  if (normalizedStatus === 'error') {
    try {
      const errorMessage: WSMessage = {
        type: 'error',
        payload: {
          ...message.payload,
          message: data.message || 'ナレッジグラフ生成中にエラーが発生しました',
        },
        timestamp: timestamp
      };
      wss.sendToRoleModelViewers(data.roleModelId, errorMessage);
      
      console.log(`エラーメッセージを送信しました: roleModelId=${data.roleModelId}`);
    } catch (error) {
      console.error('エラーメッセージの送信中にエラーが発生しました:', error);
    }
  }
  
  return sentCount;
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
  
  // 一意のIDを生成（重複防止のため）
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // クライアント側のハンドラで確実に認識されるようにメッセージ形式を修正
  const message: WSMessage = {
    type: 'agent_thoughts', // クライアント側ではagent_thoughts（複数形）を期待している
    payload: {
      id: messageId,
      agentName,
      thought,
      message: thought, // クライアント側の互換性のため
      content: thought, // 別の互換性フィールド
      roleModelId,
      timestamp: timestamp,
      messageId: messageId, // 冗長だが、互換性のために追加
      ...additionalData
    },
    timestamp: timestamp
  };
  
  // 高頻度で発生するエージェント思考メッセージのログは最小限に抑える
  console.log(`エージェント思考メッセージを送信します: agentName=${agentName}, roleModelId=${roleModelId}, type=${message.type}`);
  
  // 単一のメッセージタイプで送信（クライアント側のallリスナーがすべて処理するため）
  const sentCount = wss.sendToRoleModelViewers(roleModelId, message);
  
  // 互換性のために別のイベント名でも送信（-形式とアンダースコア形式の両方をサポート）
  try {
    // agent-thoughtsイベントとしても送信（ハイフン形式）
    const alternativeMessage = {
      ...message,
      type: 'agent-thoughts'
    };
    wss.sendToRoleModelViewers(roleModelId, alternativeMessage);
  } catch (error) {
    console.error('代替形式でのエージェント思考メッセージ送信中にエラーが発生しました:', error);
  }
  
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
  
  // イベントカウンターを初期化（未定義の場合）
  if (typeof global.graphUpdateCounter !== 'number') {
    global.graphUpdateCounter = 1;
  }
  
  // カウンターの現在値を保存（送信すべき値）
  const currentCounter = global.graphUpdateCounter++;
  
  // 一意のメッセージIDを生成
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // payload.roleModelIdを明示的に設定してクライアント側の処理を確実にする
  const enhancedPayload = {
    ...payload,
    roleModelId: roleModelId,
    timestamp: timestamp,
    // メッセージIDとカウンターを追加して追跡可能にする
    messageId: messageId,
    updateCounter: currentCounter,
    // 互換性のために旧フォーマットもサポート
    id: payload.id || messageId
  };
  
  const message: WSMessage = {
    type,
    payload: enhancedPayload,
    timestamp: timestamp
  };
  
  const sentCount = wss.sendToRoleModelViewers(roleModelId, message);
  
  // グラフ更新と関連するイベントタイプの場合は、互換性のために代替タイプでも送信
  if (type === 'knowledge-graph-update' || type === 'graph-update' || type === 'knowledge_graph_update') {
    try {
      // すべてのフォーマットで送信して互換性を確保
      const formatVariants = [
        'knowledge-graph-update', 
        'knowledge_graph_update', 
        'graph-update'
      ];
      
      // 送信元のタイプを除外
      const alternativeFormats = formatVariants.filter(fmt => fmt !== type);
      
      // 代替フォーマットでも送信
      alternativeFormats.forEach(altType => {
        const altMessage = {
          ...message,
          type: altType
        };
        wss.sendToRoleModelViewers(roleModelId, altMessage);
      });
    } catch (error) {
      console.error('代替形式でのグラフ更新メッセージ送信中にエラーが発生しました:', error);
    }
  }
  
  return sentCount;
}