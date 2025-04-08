import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';

// AgentThoughtの型定義
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

// ProgressUpdateの型定義
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
export class GlobalWebSocketManager {
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
  
  // 現在のロールモデルIDを取得
  public getCurrentRoleModelId(): string | null {
    return this.currentRoleModelId;
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
    
    // WebSocketがまだ生きている場合は再利用する
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('既存のWebSocket接続を再利用します');
      onStatusChange?.(true);
      return;
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
    
    // 接続URLの生成（クライアントIDは固定でタイムスタンプのみ更新）
    const timestamp = Date.now();
    const wsUrl = `${protocol}//${host}/api/ws?userId=${userId}&roleModelId=${roleModelId}&clientId=${this.clientId}&t=${timestamp}`;
    
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
        }
      };
      
      // エラーハンドラ
      newSocket.onerror = (error) => {
        console.error('グローバルWebSocketエラー:', error);
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

// Global WebSocket接続を使用するためのフック
export const useGlobalWebSocket = (roleModelId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // グローバルWebSocket管理インスタンスの取得
  const socketManager = useMemo(() => GlobalWebSocketManager.getInstance(), []);
  
  // WebSocketメッセージハンドラ
  const handleAgentThoughts = useCallback((message: any) => {
    console.log('エージェント思考メッセージを受信:', message);
    
    const payload = message.payload || message;
    const payloadAny = payload as any;
    
    // エージェント名の取得
    const agentName = payloadAny.agentName || 
                     payloadAny.agent || 
                     'エージェント';
    
    // 思考内容の取得
    let thought = '';
    if (typeof payloadAny.thought === 'string') {
      thought = payloadAny.thought;
    } else if (typeof payloadAny.message === 'string') {
      thought = payloadAny.message;
    } else if (typeof payloadAny.content === 'string') {
      thought = payloadAny.content;
    } else {
      thought = '詳細情報がありません';
    }
    
    const agentThought: AgentThought = {
      id: payloadAny.id || crypto.randomUUID().toString(),
      agentName,
      thought,
      message: thought,
      type: payloadAny.type || message.type || 'thinking',
      roleModelId: payloadAny.roleModelId || socketManager.getCurrentRoleModelId() || '',
      timestamp: message.timestamp || new Date().toISOString(),
      step: payloadAny.step || payloadAny.stage || 'thinking'
    };
    
    setAgentThoughts(prev => [...prev, agentThought]);
  }, [socketManager]);
  
  // 進捗更新メッセージハンドラ
  const handleProgressUpdates = useCallback((message: any) => {
    console.log('進捗更新メッセージを受信:', message);
    
    const payload = message.payload || message;
    const payloadAny = payload as any;
    
    // 進捗情報の抽出
    const progressValue = payloadAny.progress || payloadAny.percent || 0;
    const progressMessage = payloadAny.message || payloadAny.stage || '処理中...';
    
    const progressUpdate: ProgressUpdate = {
      message: progressMessage,
      percent: progressValue,
      progress: progressValue,
      stage: payloadAny.stage || 'processing',
      timestamp: message.timestamp || new Date().toISOString(),
      roleModelId: payloadAny.roleModelId || socketManager.getCurrentRoleModelId() || '',
      details: payloadAny
    };
    
    setProgressUpdates(prev => [...prev, progressUpdate]);
    
    // エラー進捗の場合はトースト表示
    if (payloadAny.stage === 'error' || progressUpdate.stage === 'error') {
      toast({
        title: 'エラー',
        description: progressMessage || '処理中にエラーが発生しました',
        variant: 'destructive'
      });
    }
    
    // 完了進捗の場合もトースト表示
    if ((progressValue >= 100 || payloadAny.stage === 'complete') && !payloadAny.error) {
      toast({
        title: '完了',
        description: progressMessage || '処理が完了しました',
      });
    }
  }, [socketManager, toast]);
  
  // 接続状態変更ハンドラ
  const handleConnectionStatus = useCallback((connected: boolean) => {
    setIsConnected(connected);
    
    // 初回接続時のみトースト表示（再接続時は表示しない）
    if (connected) {
      toast({
        title: '接続成功',
        description: 'リアルタイム更新が有効になりました',
        duration: 3000,
      });
    }
  }, [toast]);
  
  // WebSocketメッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!user || !user.id) {
      console.error('ユーザー情報がないためメッセージを送信できません');
      return false;
    }
    
    if (!roleModelId) {
      console.error('ロールモデルIDが指定されていないためメッセージを送信できません');
      return false;
    }
    
    // 接続を確保
    socketManager.getSocket(user.id, roleModelId, handleConnectionStatus);
    
    // メッセージを送信
    return socketManager.sendMessage(type, payload);
  }, [user, roleModelId, socketManager, handleConnectionStatus]);
  
  // WebSocket接続
  const connect = useCallback(() => {
    if (!user || !user.id) {
      console.error('ユーザー情報がないため接続できません');
      return;
    }
    
    if (!roleModelId) {
      console.error('ロールモデルIDが指定されていないため接続できません');
      return;
    }
    
    socketManager.getSocket(user.id, roleModelId, handleConnectionStatus);
  }, [user, roleModelId, socketManager, handleConnectionStatus]);
  
  // WebSocket切断
  const disconnect = useCallback(() => {
    socketManager.disconnect();
    setIsConnected(false);
  }, [socketManager]);
  
  // ロールモデルIDが変更されたときに接続を更新
  useEffect(() => {
    if (roleModelId && user?.id) {
      // イベントリスナーの登録
      socketManager.addMessageListener('agent_thoughts', handleAgentThoughts);
      socketManager.addMessageListener('agent_thought', handleAgentThoughts);
      socketManager.addMessageListener('thought', handleAgentThoughts);
      socketManager.addMessageListener('progress', handleProgressUpdates);
      socketManager.addMessageListener('progress_update', handleProgressUpdates);
      
      // 接続
      connect();
      
      // クリーンアップ
      return () => {
        socketManager.removeMessageListener('agent_thoughts', handleAgentThoughts);
        socketManager.removeMessageListener('agent_thought', handleAgentThoughts);
        socketManager.removeMessageListener('thought', handleAgentThoughts);
        socketManager.removeMessageListener('progress', handleProgressUpdates);
        socketManager.removeMessageListener('progress_update', handleProgressUpdates);
      };
    }
  }, [roleModelId, user?.id, socketManager, connect, handleAgentThoughts, handleProgressUpdates]);
  
  // メッセージリストクリア
  const clearMessages = useCallback(() => {
    setAgentThoughts([]);
    setProgressUpdates([]);
  }, []);
  
  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    agentThoughts,
    progressUpdates,
    clearMessages
  };
};

export default useGlobalWebSocket;