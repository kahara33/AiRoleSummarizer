import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';

// WebSocketメッセージの型定義
export interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
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

// グローバルWebSocketのフック
export function useGlobalWebSocket(roleModelId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(
    roleModelId || null
  );
  const { user } = useAuth();
  const { toast } = useToast();
  
  // グローバルWebSocket管理インスタンスの取得
  const wsManager = GlobalWebSocketManager.getInstance();
  
  // WebSocket接続
  const connect = useCallback(() => {
    if (!user || !currentRoleModelId) {
      console.warn('ユーザーがログインしていないか、ロールモデルIDが未設定のため、WebSocket接続を確立できません');
      return;
    }
    
    console.log(`WebSocket接続を実行: roleModelId=${currentRoleModelId}`);
    wsManager.connect(
      user.id,
      currentRoleModelId,
      (connected) => {
        setIsConnected(connected);
        if (connected) {
          console.log('WebSocket接続状態の変更: 接続済み');
        } else {
          console.log('WebSocket接続状態の変更: 切断');
        }
      }
    );
  }, [user, currentRoleModelId, wsManager]);
  
  // WebSocket切断
  const disconnect = useCallback(() => {
    wsManager.disconnect();
    setIsConnected(false);
  }, [wsManager]);
  
  // メッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!isConnected) {
      console.log('WebSocketが接続されていないため、メッセージを送信できません');
      toast({
        title: '接続エラー',
        description: 'サーバーへの接続が確立されていません',
        variant: 'destructive'
      });
      
      // 自動再接続を試みる
      connect();
      return false;
    }
    
    return wsManager.sendMessage(type, payload);
  }, [isConnected, wsManager, toast, connect]);
  
  // メッセージの消去
  const clearMessages = useCallback(() => {
    setAgentThoughts([]);
    setProgressUpdates([]);
  }, []);
  
  // ロールモデルIDの変更監視
  useEffect(() => {
    if (roleModelId && roleModelId !== currentRoleModelId) {
      setCurrentRoleModelId(roleModelId);
    }
  }, [roleModelId, currentRoleModelId]);
  
  // 初期接続と切断
  useEffect(() => {
    // roleModelIdがある場合のみ接続
    if (currentRoleModelId) {
      connect();
    }
    
    // クリーンアップ
    return () => {
      // コンポーネントのアンマウント時に切断
      disconnect();
    };
  }, [currentRoleModelId, connect, disconnect]);
  
  // WebSocketメッセージリスナーの設定
  useEffect(() => {
    if (!currentRoleModelId) return;
    
    const handleAgentThought = (message: any) => {
      console.log('エージェント思考メッセージを受信:', message);
      
      // メッセージからエージェント思考データを抽出
      try {
        // ペイロードを取得（直接メッセージがペイロードの場合もある）
        const payload = message.payload || message;
        const payloadAny = payload as any;
        
        // エージェント名を取得
        const agentName = payloadAny.agentName || 
                          payloadAny.agent || 
                          message.agentName || 
                          message.agent || 
                          '未知のエージェント';
        
        // 思考内容を取得（複数の可能なフィールドから）
        let thought = '';
        if (typeof payloadAny.thought === 'string') {
          thought = payloadAny.thought;
        } else if (typeof payloadAny.thoughts === 'string') {
          thought = payloadAny.thoughts;
        } else if (typeof payloadAny.message === 'string') {
          thought = payloadAny.message;
        } else if (typeof payloadAny.content === 'string') {
          thought = payloadAny.content;
        } else if (typeof message.thought === 'string') {
          thought = message.thought;
        } else if (typeof message.message === 'string') {
          thought = message.message;
        } else {
          thought = '思考内容が見つかりません';
        }
        
        // 一意のIDを生成（存在すればそれを使用）
        const id = payloadAny.id || message.id || crypto.randomUUID().toString();
        
        // エージェント思考オブジェクトを作成
        const agentThought: AgentThought = {
          id,
          agentName,
          thought,
          message: thought,
          timestamp: message.timestamp || new Date().toISOString(),
          roleModelId: payloadAny.roleModelId || message.roleModelId || currentRoleModelId || '',
          step: payloadAny.step || message.step || 'thinking',
          type: payloadAny.type || message.type || 'generic',
          agentType: payloadAny.agentType || message.agentType || 'generic'
        };
        
        console.log('エージェント思考を追加:', agentThought);
        setAgentThoughts(prev => [...prev, agentThought]);
      } catch (error) {
        console.error('エージェント思考の処理エラー:', error);
      }
    };
    
    const handleProgress = (message: any) => {
      console.log('進捗メッセージを受信:', message);
      
      // メッセージから進捗データを抽出
      try {
        // ペイロードを取得（直接メッセージがペイロードの場合もある）
        const payload = message.payload || message;
        const payloadAny = payload as any;
        
        // 進捗メッセージを取得
        const progressMessage = payloadAny.message || 
                              message.message || 
                              payloadAny.stage ||
                              message.stage ||
                              '処理中...';
        
        // 進捗率を取得（複数の可能なフィールドから）
        let percent = 0;
        if (typeof payloadAny.percent === 'number') {
          percent = payloadAny.percent;
        } else if (typeof payloadAny.progress === 'number') {
          percent = payloadAny.progress;
        } else if (typeof message.percent === 'number') {
          percent = message.percent;
        } else if (typeof message.progress === 'number') {
          percent = message.progress;
        }
        
        // 進捗更新オブジェクトを作成
        const progressUpdate: ProgressUpdate = {
          message: progressMessage,
          percent,
          progress: percent,
          progressPercent: percent,
          timestamp: message.timestamp || new Date().toISOString(),
          roleModelId: payloadAny.roleModelId || message.roleModelId || currentRoleModelId || '',
          stage: payloadAny.stage || message.stage || 'processing',
          details: payloadAny.details || message.details || null
        };
        
        console.log('進捗更新を追加:', progressUpdate);
        setProgressUpdates(prev => [...prev, progressUpdate]);
      } catch (error) {
        console.error('進捗更新の処理エラー:', error);
      }
    };
    
    // リスナーを追加
    wsManager.addMessageListener('agent_thought', handleAgentThought);
    wsManager.addMessageListener('agent_thoughts', handleAgentThought);
    wsManager.addMessageListener('thought', handleAgentThought);
    wsManager.addMessageListener('progress', handleProgress);
    wsManager.addMessageListener('progress_update', handleProgress);
    
    // クリーンアップ
    return () => {
      wsManager.removeMessageListener('agent_thought', handleAgentThought);
      wsManager.removeMessageListener('agent_thoughts', handleAgentThought);
      wsManager.removeMessageListener('thought', handleAgentThought);
      wsManager.removeMessageListener('progress', handleProgress);
      wsManager.removeMessageListener('progress_update', handleProgress);
    };
  }, [currentRoleModelId, wsManager]);
  
  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    agentThoughts,
    progressUpdates,
    clearMessages
  };
}