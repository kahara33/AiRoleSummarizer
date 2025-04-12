import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';

// WebSocketメッセージの型定義
interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

// WebSocketコンテキストの状態の型定義
interface MultiAgentWebSocketContextState {
  isConnected: boolean;
  connect: (roleModelId: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload: any) => void;
  sendCreateKnowledgeGraphRequest: (params: CreateKnowledgeGraphParams) => void;
  sendCancelOperationRequest: (operationType: string) => void;
  cancelOperation: () => boolean;
  isProcessing: boolean;
  messages: WSMessage[];
  agentThoughts: AgentThought[];
  progressUpdates: ProgressUpdate[];
  clearMessages: () => void;
}

// ナレッジグラフ生成リクエストパラメータの型定義
interface CreateKnowledgeGraphParams {
  industry: string;
  keywords: string[];
  sources?: string[];
  constraints?: string[];
  requirements?: string[];
}

// エージェント思考の型定義
export interface AgentThought {
  id?: string;
  agentName: string;
  thought: string;
  message?: string;
  timestamp: string;
  roleModelId: string;
  step?: string;
  type?: string;
  agentType?: string;
}

// 進捗更新の型定義
export interface ProgressUpdate {
  message: string;
  percent: number;
  timestamp: string;
  roleModelId?: string;
  // AgentThoughtsPanelと互換性を持たせるためのフィールド
  stage?: string;
  progress?: number;
  details?: any;
  progressPercent?: number;
}

// グローバルWebSocket状態を管理するためのシングルトンクラス
class GlobalWebSocketManager {
  private static instance: GlobalWebSocketManager;
  private socket: WebSocket | null = null;
  private currentRoleModelId: string | null = null;
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectAttempt: number = 0;
  private clientId: string | null = null;
  
  // シングルトンインスタンスの取得
  public static getInstance(): GlobalWebSocketManager {
    if (!GlobalWebSocketManager.instance) {
      GlobalWebSocketManager.instance = new GlobalWebSocketManager();
    }
    return GlobalWebSocketManager.instance;
  }
  
  // WebSocket接続の取得（なければ作成）
  public getSocket(userId: string, roleModelId: string, onStatusChange?: (isConnected: boolean) => void): WebSocket | null {
    if (this.socket && this.isConnected && this.currentRoleModelId === roleModelId) {
      return this.socket;
    }
    
    // 再接続が必要な場合は接続
    this.connect(userId, roleModelId, onStatusChange);
    return this.socket;
  }
  
  // 接続状態の取得
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  // WebSocket接続の作成
  public connect(userId: string, roleModelId: string, onStatusChange?: (isConnected: boolean) => void): void {
    // 既存の接続を確認
    if (this.socket && this.isConnected && this.currentRoleModelId === roleModelId) {
      console.log('既存のWebSocket接続が有効です');
      onStatusChange?.(true);
      return;
    }
    
    // すでに同じroleModelIdへの再接続プロセスが進行中の場合はスキップ
    if (this.socket && this.currentRoleModelId === roleModelId && this.socket.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket接続プロセスが進行中です');
      return;
    }
    
    // 再接続タイムアウトをクリア
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // 既存の接続を閉じる（別のroleModelIdへの接続の場合）
    if (this.socket && this.currentRoleModelId !== roleModelId) {
      this.disconnect();
    }
    
    // 接続先URLの構築
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // クライアントIDを永続化
    if (!this.clientId) {
      this.clientId = localStorage.getItem(`WS_CLIENT_ID_${userId}`);
      if (!this.clientId) {
        this.clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem(`WS_CLIENT_ID_${userId}`, this.clientId);
      }
    }
    
    // 接続URLの生成（キャッシュバスティングを含む）
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2, 10);
    const wsUrl = `${protocol}//${host}/api/ws?userId=${userId}&roleModelId=${roleModelId}&clientId=${this.clientId}&t=${timestamp}&r=${randomValue}`;
    
    try {
      console.log('グローバルWebSocket接続を開始します:', wsUrl);
      const newSocket = new WebSocket(wsUrl);
      this.currentRoleModelId = roleModelId;
      
      // イベントハンドラ設定
      newSocket.onopen = () => {
        console.log('グローバルWebSocket接続が確立されました');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectAttempt++;
        
        // 接続状態変更の通知
        onStatusChange?.(true);
        
        // サブスクリプションメッセージを送信
        try {
          console.log(`roleModelId=${roleModelId}の情報をサブスクライブします`);
          newSocket.send(JSON.stringify({
            type: 'subscribe',
            roleModelId: roleModelId,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          console.error('サブスクリプションメッセージ送信エラー:', e);
        }
        
        // トースト通知は使用者が管理
        
        // pingインターバルの設定（既存のものがあればクリア）
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        
        // 定期的なping送信
        this.pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            try {
              newSocket.send(JSON.stringify({ 
                type: 'ping', 
                payload: { roleModelId },
                timestamp: new Date().toISOString() 
              }));
            } catch (e) {
              console.error('ping送信エラー:', e);
            }
          } else if (newSocket.readyState !== WebSocket.OPEN) {
            clearInterval(this.pingInterval as NodeJS.Timeout);
            this.pingInterval = null;
          }
        }, 15000); // 15秒間隔
      };
      
      // メッセージ受信ハンドラ
      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('WebSocketメッセージの解析エラー:', error);
        }
      };
      
      // 接続切断ハンドラ
      newSocket.onclose = (event) => {
        console.log('グローバルWebSocket接続が閉じられました', event.code, event.reason);
        this.isConnected = false;
        
        // 接続状態変更の通知
        onStatusChange?.(false);
        
        // 再接続を試みる
        this.reconnectAttempts++;
        
        // 再接続の遅延時間を計算（指数バックオフ）
        let reconnectDelay = 500; 
        if (this.reconnectAttempts === 2) {
          reconnectDelay = 1000;
        } else if (this.reconnectAttempts > 2) {
          reconnectDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 2), 30000);
        }
        
        console.log(`${reconnectDelay / 1000}秒後に再接続を試みます... (試行: ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        // 最大再接続回数に達していない場合のみ再接続
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
          this.reconnectTimeout = setTimeout(() => {
            if (this.currentRoleModelId) {
              this.connect(userId, this.currentRoleModelId, onStatusChange);
            }
          }, reconnectDelay);
        } else {
          console.error('最大再接続試行回数に達しました。手動での再接続が必要です。');
          // エラー通知は使用者が管理
        }
      };
      
      // エラーハンドラ
      newSocket.onerror = (error) => {
        console.error('グローバルWebSocketエラー:', error);
        // エラー通知は使用者が管理
      };
      
      this.socket = newSocket;
    } catch (error) {
      console.error('グローバルWebSocket接続エラー:', error);
      this.isConnected = false;
      onStatusChange?.(false);
    }
  }
  
  // WebSocket切断
  public disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'クライアントからの切断');
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoleModelId = null;
  }
  
  // メッセージ送信
  public sendMessage(type: string, payload: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }
  
  // メッセージイベントリスナーの登録
  public addMessageListener(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback);
  }
  
  // メッセージイベントリスナーの削除
  public removeMessageListener(type: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }
  
  // 受信メッセージの処理
  private handleMessage(message: any): void {
    // 特定のタイプのメッセージを対応するリスナーに配信
    if (message && message.type) {
      // リスナーへの配信
      const listeners = this.listeners.get(message.type);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error(`リスナーコールバックエラー (${message.type}):`, error);
          }
        });
      }
      
      // 汎用リスナーへの配信（すべてのメッセージを受け取る）
      const allListeners = this.listeners.get('all');
      if (allListeners) {
        allListeners.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error('汎用リスナーコールバックエラー:', error);
          }
        });
      }
    }
  }
}

// デフォルト値を持つコンテキスト作成
const MultiAgentWebSocketContext = createContext<MultiAgentWebSocketContextState>({
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  sendMessage: () => {},
  sendCreateKnowledgeGraphRequest: () => {},
  sendCancelOperationRequest: () => {},
  cancelOperation: () => false,
  isProcessing: false,
  messages: [],
  agentThoughts: [],
  progressUpdates: [],
  clearMessages: () => {}
});

// WebSocketプロバイダーコンポーネント
export function MultiAgentWebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // グローバルWebSocket管理インスタンスの取得
  const socketManager = useMemo(() => GlobalWebSocketManager.getInstance(), []);

  // WebSocketへのメッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    console.log('送信メッセージ準備:', type, payload);
    
    // 1. 接続状態のチェック - 未接続の場合は接続を試みる
    if (!socketManager.getConnectionStatus()) {
      console.warn('WebSocketが未接続です。自動的に再接続を試みます。');
      
      // 自動再接続を試みる
      if (currentRoleModelId && user) {
        // 先に通知（一度だけ）
        if (type !== 'ping') {
          toast({
            title: '接続再確立中',
            description: 'サーバーとの接続を再確立しています。しばらくお待ちください...'
          });
        }
        
        // 再接続試行
        socketManager.connect(user.id, currentRoleModelId, (connected) => {
          setIsConnected(connected);
          
          // 接続成功時のみメッセージ再送信
          if (connected) {
            console.log('再接続に成功しました。メッセージを送信します。');
            
            // 少し待ってからメッセージを再送信
            setTimeout(() => {
              try {
                socketManager.sendMessage(type, payload);
              } catch (e) {
                console.error('再送信エラー:', e);
              }
            }, 500);
          } else {
            if (type !== 'ping') {
              toast({
                title: '接続エラー',
                description: 'サーバーへの接続が確立できません。ページを更新してください。',
                variant: 'destructive'
              });
            }
          }
        });
        return;
      } else {
        console.error('roleModelIdまたはユーザー情報がないため、再接続できません');
        if (type !== 'ping') {
          toast({
            title: '接続エラー',
            description: 'サーバーへの接続情報が不足しています。ページを更新してください。',
            variant: 'destructive'
          });
        }
        return;
      }
    }
    
    // 3. すべての条件を満たしている場合、メッセージを送信
    try {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      console.log('WebSocketメッセージ送信:', message);
      socketManager.sendMessage(type, payload);
    } catch (error) {
      console.error('WebSocketメッセージ送信エラー:', error);
      toast({
        title: 'エラー',
        description: 'サーバーとの通信中にエラーが発生しました。',
        variant: 'destructive'
      });
    }
  }, [socketManager, isConnected, toast, user, currentRoleModelId]);

  // ナレッジグラフ生成リクエスト
  const sendCreateKnowledgeGraphRequest = useCallback((params: CreateKnowledgeGraphParams) => {
    sendMessage('create_knowledge_graph', params);
  }, [sendMessage]);
  
  // 操作キャンセルリクエスト
  const sendCancelOperationRequest = useCallback((operationType: string) => {
    sendMessage('cancel_operation', { operationType });
  }, [sendMessage]);

  // 前回の接続試行時間を記録
  const lastConnectAttemptRef = useRef<number>(0);
  
  // 接続状態をモニタリングする変数
  const reconnectAttemptsRef = useRef<number>(0);
  const connectAttemptRef = useRef<number>(0); // 全体の接続試行回数を追跡
  const maxReconnectAttempts = 10; // 最大再接続試行回数を10回に増加
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 定期的なping送信のインターバルを管理
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebSocket接続関数（デバウンス処理付き）
  const connect = useCallback((roleModelId: string) => {
    if (!user) {
      console.warn('ユーザーがログインしていないため、WebSocket接続を確立できません');
      return;
    }
    
    // 短時間に複数の接続要求が発生するのを防ぐ（1秒以内の再接続を防止）
    const now = Date.now();
    if (now - lastConnectAttemptRef.current < 1000) {
      console.log('短時間での再接続を防止します。前回の接続からの経過時間:', now - lastConnectAttemptRef.current, 'ms');
      return;
    }
    lastConnectAttemptRef.current = now;
    
    // 既に同じロールモデルに接続済みの場合は接続しない
    if (isConnected && currentRoleModelId === roleModelId) {
      console.log(`既に ${roleModelId} に接続済みです。再接続をスキップします。`);
      // グローバルインスタンスから接続状態を確認
      if (!socketManager.getConnectionStatus()) {
        console.warn('WebSocketが接続済みと認識されていますが、実際には開いていません。');
        // 再接続を試みる
        setIsConnected(false);
      } else {
        return; // 本当に接続されている場合は何もしない
      }
    }

    // 再接続タイムアウトがある場合はクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 既存の接続を閉じる
    if (socketManager.getSocket(user.id, roleModelId, setIsConnected)) {
      console.log('既存のWebSocket接続を閉じます');
      socketManager.disconnect();
    }

    // 接続先URLの構築 - パスとクエリパラメータの設定
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // WebSocketの接続安定性のために、より堅牢な接続URLを生成
    // クライアントIDを永続化して再接続時も同じIDを使用
    let clientId = localStorage.getItem(`WS_CLIENT_ID_${user.id}`);
    if (!clientId) {
      clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(`WS_CLIENT_ID_${user.id}`, clientId);
    }
    
    // タイムスタンプとランダム値を追加してキャッシュ問題を防止（クライアントIDは維持）
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2, 8);
    const wsUrl = `${protocol}//${host}/api/ws?userId=${user.id}&roleModelId=${roleModelId}&clientId=${clientId}&t=${timestamp}&r=${randomValue}`;
    console.log('WebSocket接続URL:', wsUrl);

    try {
      console.log('WebSocket接続を試みています...');
      const newSocket = new WebSocket(wsUrl);
      setCurrentRoleModelId(roleModelId);
      
      // 接続開始の即時ログ
      console.log('WebSocketオブジェクトが作成されました。状態:', newSocket.readyState);

      // WebSocketイベントハンドラ設定
      newSocket.onopen = () => {
        console.log('WebSocket接続が確立されました');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // 接続成功したら再接続試行回数をリセット
        
        // 再接続ではなく初回接続の場合のみトースト表示
        // connectAttemptRefが定義されていることを確認
        if (connectAttemptRef && connectAttemptRef.current <= 1) {
          toast({
            title: '接続成功',
            description: 'リアルタイム更新が有効になりました',
            variant: 'default'
          });
        }
        // アクセスカウンターをインクリメント
        if (connectAttemptRef) {
          connectAttemptRef.current++;
        }
        
        // 接続後すぐに最初のping送信
        setTimeout(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            try {
              newSocket.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
              console.log('最初のping送信');
            } catch (e) {
              console.error('ping送信エラー:', e);
            }
          }
        }, 1000);
        
        // pingIntervalを設定する前に既存のものがあればクリア
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // 定期的なpingを15秒間隔で送信（接続をアクティブに保つため）
        const pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            try {
              newSocket.send(JSON.stringify({ 
                type: 'ping', 
                payload: { roleModelId },
                timestamp: new Date().toISOString() 
              }));
              // ログは出力しない（コンソールを占有しないため）
            } catch (e) {
              console.error('定期的なping送信エラー:', e);
            }
          } else if (newSocket.readyState === WebSocket.CLOSED || newSocket.readyState === WebSocket.CLOSING) {
            // ソケットが閉じられている場合はインターバルをクリア
            clearInterval(pingInterval);
            pingIntervalRef.current = null;
          }
        }, 15000); // 15秒間隔
        
        pingIntervalRef.current = pingInterval;
      };

      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          handleMessage(message);
        } catch (error) {
          console.error('WebSocketメッセージの解析エラー:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket接続が閉じられました', event.code, event.reason);
        setIsConnected(false);

        // コードが1000以外でも再接続を試みる（ブラウザのネットワーク状態変更による自動切断など対応）
        // 再接続試行回数をインクリメント
        reconnectAttemptsRef.current++;
        
        // 最初の2回は短い間隔、その後は指数バックオフで再接続
        let reconnectDelay = 500; // 初回は0.5秒
        if (reconnectAttemptsRef.current === 2) {
          reconnectDelay = 1000; // 2回目は1秒
        } else if (reconnectAttemptsRef.current > 2) {
          // 3回目以降は指数バックオフ（2秒、4秒、8秒...最大30秒）
          reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 2), 30000);
        }
        
        console.log(`${reconnectDelay / 1000}秒後に再接続を試みます... (試行: ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        
        // 最大再接続回数に達していない場合のみ再接続を試みる
        if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
          // 再接続のインジケーターを表示（オプション）
          if (reconnectAttemptsRef.current > 2) {
            toast({
              title: '接続の再確立中',
              description: `サーバーとの接続を再確立しています... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
              duration: reconnectDelay - 100, // 少し短めに設定
            });
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (currentRoleModelId) {
              connect(currentRoleModelId);
            }
          }, reconnectDelay);
        } else {
          console.error('最大再接続試行回数に達しました。手動での再接続が必要です。');
          toast({
            title: '接続エラー',
            description: 'サーバーへの接続に失敗しました。ページを再読み込みするか、しばらく経ってから再試行してください。',
            variant: 'destructive'
          });
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocketエラー:', error);
        toast({
          title: '接続エラー',
          description: 'サーバーへの接続中にエラーが発生しました。しばらくしてから再試行してください。',
          variant: 'destructive'
        });
      };

      setSocket(newSocket);
    } catch (error) {
      console.error('WebSocket接続エラー:', error);
      toast({
        title: '接続エラー',
        description: 'サーバーへの接続に失敗しました',
        variant: 'destructive'
      });
    }
  }, [user, socket, toast, currentRoleModelId]);

  // WebSocket切断関数
  const disconnect = useCallback(() => {
    // 再接続タイムアウトがある場合はクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Ping間隔も必ずクリア
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (socket) {
      socket.close(1000, 'クライアントからの切断');
      setSocket(null);
      setIsConnected(false);
      setCurrentRoleModelId(null);
      reconnectAttemptsRef.current = 0; // 再接続カウンターをリセット
      console.log('WebSocket接続を切断しました');
    }
  }, [socket]);

  // メッセージクリア関数
  const clearMessages = useCallback(() => {
    setMessages([]);
    setAgentThoughts([]);
    setProgressUpdates([]);
  }, []);

  // コンポーネントのアンマウント時に接続をクリーンアップ
  useEffect(() => {
    return () => {
      // 再接続タイムアウトがある場合はクリア
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // ping間隔があればクリア
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (socket) {
        socket.close(1000, 'コンポーネントがアンマウントされました');
        console.log('コンポーネントのアンマウントによりWebSocket接続を閉じました');
      }
    };
  }, [socket]);
  
  // 定期的に接続状態をチェックする（ただし接続維持のための最小限の頻度）
  useEffect(() => {
    // 明示的に切断された場合、または再接続試行回数が上限に達した場合は
    // ポーリングによる再接続を行わない
    const shouldAttemptReconnect = 
      reconnectAttemptsRef.current <= maxReconnectAttempts && 
      currentRoleModelId !== null;
      
    if (!shouldAttemptReconnect) {
      return; // ポーリングを設定しない
    }
    
    const checkConnectionInterval = setInterval(() => {
      // 接続状態をチェック（明示的な閉鎖でなければ）
      if (socket && socket.readyState !== WebSocket.OPEN && 
          currentRoleModelId && shouldAttemptReconnect) {
        console.warn('WebSocketが切断されています。ポーリングによる再接続を試みます...');
        setIsConnected(false);
        connect(currentRoleModelId);
      } else if (socket && socket.readyState === WebSocket.OPEN) {
        // 接続中の場合はpingを送信（ハートビート、ただしログは最小限に）
        try {
          // roleModelIdを含めてサーバーが適切にルーティングできるようにする
          socket.send(JSON.stringify({ 
            type: 'ping', 
            payload: { roleModelId: currentRoleModelId },
            timestamp: new Date().toISOString() 
          }));
          // 30秒間隔のpingはログに残さない（コンソールを占有しないため）
        } catch (e) {
          console.error('Ping送信エラー:', e);
          // エラーの場合は切断したとみなす（次回のチェックで再接続）
          setIsConnected(false);
        }
      }
    }, 60000); // 60秒ごとにチェック（頻度を下げて負荷を軽減）
    
    return () => clearInterval(checkConnectionInterval);
  }, [socket, currentRoleModelId, connect, maxReconnectAttempts]);
  
  // メッセージタイプに応じた処理関数を定義（整理のため）
  const handleMessage = useCallback((message: WSMessage) => {
    console.log('WebSocketメッセージを受信:', message);
    
    // デバッグブロードキャストを検出して対処
    if (message.payload && message.payload._debug_broadcast) {
      console.log('デバッグブロードキャストメッセージを受信しました。通常のメッセージ処理をスキップします:', message.type);
      return;
    }
    
    // pongメッセージの場合は接続確認のみで特別な処理はしない
    if (message.type === 'pong') {
      console.log('Pong受信（接続確認OK）');
      return;
    }
    
    // コンソールに明示的にログを残して、どのようなメッセージが来ているか追跡できるようにする
    console.log(`WebSocket受信メッセージタイプ: ${message.type}`);
    
    // progressやprogress-update関連のメッセージを処理
    if (message.type === 'progress' || 
        message.type === 'progress-update' || 
        message.type === 'crewai_progress') {
      console.log('進捗更新メッセージを受信:', message);
      
      if (message.payload) {
        // 異なる形式をサポート
        const percent = typeof message.payload.percent === 'number' ? message.payload.percent : 
                      (typeof message.payload.progress === 'number' ? message.payload.progress : 50);
        
        const msg = message.payload.message || message.payload.text || '処理中...';
        
        // 進捗更新オブジェクトを作成して保存
        const progressUpdate: ProgressUpdate = {
          message: msg,
          percent: percent,
          timestamp: message.timestamp || new Date().toISOString(),
          roleModelId: message.payload.roleModelId || currentRoleModelId || '',
          // AgentThoughtsPanelと互換性を持たせるためのフィールド
          stage: message.payload.step || 'processing',
          progress: percent,
          progressPercent: percent,
          details: message.payload
        };
        
        console.log('進捗更新を追加:', progressUpdate);
        setProgressUpdates(prev => [...prev, progressUpdate]);
        
        // 思考データとしても登録（UI表示のため）
        const agentThought: AgentThought = {
          id: message.payload.id || crypto.randomUUID().toString(),
          agentName: 'システム',
          thought: `進捗状況: ${percent}% - ${msg}`,
          message: `進捗状況: ${percent}% - ${msg}`,
          type: 'progress',
          roleModelId: message.payload.roleModelId || currentRoleModelId || '',
          timestamp: message.timestamp || new Date().toISOString(),
          step: 'progress'
        };
        
        console.log('進捗情報をエージェント思考として追加:', agentThought);
        setAgentThoughts(prev => [...prev, agentThought]);
      }
      return;
    }
    
    switch (message.type) {
      case 'agent_thought':
      case 'agent_thoughts': // agent_thoughtsもサポート
      case 'agent-thoughts': // ハイフン区切りフォーマットもサポート
      case 'thought': // thoughtタイプも追加
        if (message.payload || (typeof message === 'object' && message.type === 'agent_thoughts')) {
          console.log(`エージェント思考を受信 (${message.type})`, message);
          
          // 直接メッセージにデータフィールドがある場合の処理を追加
          const payload = message.payload || message;
          
          // データからエージェント名と思考内容を安全に取得
          // anyを使用してTypescriptエラーを回避
          const payloadAny = payload as any;
          const messageAny = message as any;
          
          // エージェント名の取得を改善（複数のソースから安全に取得）
          const agentName = payloadAny.agentName || 
                            payloadAny.agent || 
                            messageAny.agentName || 
                            messageAny.agent || 
                            '未知のエージェント';
          
          // 思考内容をさまざまなフィールドから可能な限り取得
          let thought = '';
          if (typeof payloadAny.thought === 'string') {
            thought = payloadAny.thought;
          } else if (typeof payloadAny.thoughts === 'string') {
            thought = payloadAny.thoughts;
          } else if (typeof payloadAny.message === 'string') {
            thought = payloadAny.message;
          } else if (typeof payloadAny.content === 'string') {
            thought = payloadAny.content;
          } else if (typeof payloadAny === 'string') {
            thought = payloadAny;
          } else if (messageAny.thought || messageAny.thoughts) {
            thought = messageAny.thought || messageAny.thoughts || '';
          } else {
            // オブジェクトの場合は文字列化して適切なエラーメッセージを表示
            try {
              thought = typeof payloadAny === 'object' ? 
                JSON.stringify(payloadAny, null, 2) : 
                '不明なデータ形式';
            } catch (e) {
              thought = '不明なデータ形式';
            }
          }
          
          const agentThought: AgentThought = {
            id: payloadAny.id || crypto.randomUUID().toString(),
            agentName,
            thought,
            message: thought, // 互換性のため両方のフィールドにセット
            type: payloadAny.type || message.type || 'generic',
            roleModelId: payloadAny.roleModelId || currentRoleModelId || '',
            timestamp: message.timestamp || new Date().toISOString(),
            step: payloadAny.step || payloadAny.stage || 'thinking'
          };
          
          console.log('エージェント思考を追加:', agentThought);
          setAgentThoughts(prev => [...prev, agentThought]);
          
          // エージェント思考が来たときに進捗更新も送信（10%刻み）
          // これにより、エージェント思考があればプログレスバーも更新される
          if (currentRoleModelId) {
            const stepToProgress: Record<string, number> = {
              'domain_analysis_start': 10,
              'trend_research_preparation': 20,
              'context_mapping_preparation': 30,
              'plan_strategist_preparation': 40,
              'processing': 50,
              'result_compilation': 70,
              'finalization': 90
            };
            
            // ステップに基づいてプログレスを決定
            const step = payloadAny.step || payloadAny.stage;
            const percent = step && stepToProgress[step] 
              ? stepToProgress[step] 
              : (Math.floor(Math.random() * 5) + 5) * 10; // ステップ不明なら10〜50%のランダム値
            
            // エラーの場合は0%に設定
            const isError = payloadAny.error === true || step === 'error';
            
            const progressUpdate: ProgressUpdate = {
              message: isError 
                ? `エラーが発生しました: ${payloadAny.message || '不明なエラー'}` 
                : `${agentName}が処理中: ${thought.substring(0, 30)}...`,
              percent: isError ? 0 : percent,
              timestamp: new Date().toISOString(),
              roleModelId: currentRoleModelId,
              // AgentThoughtsPanelと互換性を持たせるためのフィールド
              stage: step || 'processing',
              progress: isError ? 0 : percent,
              progressPercent: isError ? 0 : percent,
              details: payloadAny
            };
            
            setProgressUpdates(prev => [...prev, progressUpdate]);
          }
        } else {
          console.warn('エージェント思考メッセージにペイロードがありません:', message);
        }
        break;

      case 'progress-update':
      case 'progress': // progressタイプもサポート
        if (message.payload) {
          console.log(`進捗更新を受信 (${message.type}):`, message.payload);
          const update: ProgressUpdate = {
            message: message.payload.message,
            percent: message.payload.percent || message.payload.progress || 0,
            timestamp: message.timestamp || new Date().toISOString(),
            roleModelId: message.payload.roleModelId || currentRoleModelId || undefined,
            // AgentThoughtsPanelと互換性を持たせるためのフィールド
            stage: message.payload.stage || message.payload.step || 'processing',
            progress: message.payload.progress || message.payload.percent || 0,
            progressPercent: message.payload.progress || message.payload.percent || 0,
            details: message.payload
          };
          setProgressUpdates(prev => [...prev, update]);
          
          // 完了通知（100%）の場合はトースト表示
          if (update.percent === 100) {
            toast({
              title: '処理完了',
              description: update.message || 'ナレッジグラフと情報収集プランの生成が完了しました',
              variant: 'default'
            });
          }
          
          // エラー通知（0%）の場合はトースト表示
          if (update.percent === 0) {
            toast({
              title: 'エラー',
              description: update.message || '処理中にエラーが発生しました',
              variant: 'destructive'
            });
          }
        }
        break;

      case 'chat_message':
        setMessages(prev => [...prev, message]);
        break;

      case 'crewai_error':
        toast({
          title: 'エラー',
          description: message.payload.message || 'ナレッジグラフの生成中にエラーが発生しました',
          variant: 'destructive'
        });
        break;

      default:
        // その他のメッセージはそのまま保存
        setMessages(prev => [...prev, message]);
        break;
    }
  }, [currentRoleModelId, toast]);


  
  // 処理中かどうかの状態を計算
  // 処理中の状態をより明確に判定
  const isProcessing = useMemo(() => {
    // 進捗が存在し、かつそのうち1つでも100%未満のものがあれば処理中と判断
    if (progressUpdates.length === 0) {
      return false;
    }
    
    // 最新の進捗が100%未満なら処理中と判断
    const latestUpdate = progressUpdates[progressUpdates.length - 1];
    if (latestUpdate && latestUpdate.percent < 100) {
      return true;
    }

    // 過去20秒以内に更新された進捗で100%未満のものがあれば処理中と判断
    const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
    return progressUpdates.some(update => 
      update.percent < 100 && 
      update.timestamp > twentySecondsAgo
    );
  }, [progressUpdates]);

  // キャンセル操作の実行関数
  const cancelOperation = useCallback(() => {
    if (!isConnected) {
      console.error('WebSocketが接続されていないため、操作をキャンセルできません');
      return false;
    }
    
    try {
      console.log('操作のキャンセルを要求します');
      sendMessage('cancel_operation', { timestamp: Date.now() });
      return true;
    } catch (error) {
      console.error('操作のキャンセル中にエラーが発生しました:', error);
      return false;
    }
  }, [isConnected, sendMessage]);
  
  // コンテキスト値の構築
  const value = {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest,
    cancelOperation,
    isProcessing,
    messages,
    agentThoughts,
    progressUpdates,
    clearMessages
  };

  return (
    <MultiAgentWebSocketContext.Provider value={value}>
      {children}
    </MultiAgentWebSocketContext.Provider>
  );
}

// カスタムフック
export function useMultiAgentWebSocket() {
  const context = useContext(MultiAgentWebSocketContext);
  if (context === undefined) {
    throw new Error('useMultiAgentWebSocketはMultiAgentWebSocketProviderの中で使用する必要があります');
  }
  
  // 最新の進捗状況を計算するロジックを追加
  const progressStatus = useMemo(() => {
    const progressMsgs = context.messages.filter(msg => 
      (msg.type === 'progress' || msg.type === 'progress-update' || msg.type === 'crewai_progress') && 
      msg.payload && 
      (typeof msg.payload.progress === 'number' || typeof msg.payload.percent === 'number')
    );
    
    if (progressMsgs.length === 0) return null;
    
    const latestMsg = progressMsgs[progressMsgs.length - 1];
    const progress = typeof latestMsg.payload.progress === 'number' ? latestMsg.payload.progress : 
                    typeof latestMsg.payload.percent === 'number' ? latestMsg.payload.percent : 0;
                    
    return {
      progress: progress,
      message: typeof latestMsg.payload.message === 'string' ? latestMsg.payload.message : 
               typeof latestMsg.payload.stage === 'string' ? latestMsg.payload.stage : '処理中...'
    };
  }, [context.messages]);
  
  // コンテキストを拡張して返す
  return {
    ...context,
    progressStatus
  };
}