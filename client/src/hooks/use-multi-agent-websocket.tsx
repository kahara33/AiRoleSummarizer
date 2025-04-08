import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
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
interface AgentThought {
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
interface ProgressUpdate {
  message: string;
  percent: number;
  timestamp: string;
  roleModelId?: string;
}

// デフォルト値を持つコンテキスト作成
const MultiAgentWebSocketContext = createContext<MultiAgentWebSocketContextState>({
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  sendMessage: () => {},
  sendCreateKnowledgeGraphRequest: () => {},
  messages: [],
  agentThoughts: [],
  progressUpdates: [],
  clearMessages: () => {}
});

// WebSocketプロバイダーコンポーネント
export function MultiAgentWebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // WebSocketへのメッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && isConnected) {
      try {
        const message = {
          type,
          payload,
          timestamp: new Date().toISOString()
        };
        socket.send(JSON.stringify(message));
        console.log('WebSocketメッセージを送信:', message);
      } catch (error) {
        console.error('WebSocketメッセージ送信エラー:', error);
        toast({
          title: 'エラー',
          description: 'メッセージの送信に失敗しました',
          variant: 'destructive'
        });
      }
    } else {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      toast({
        title: '警告',
        description: 'サーバーに接続されていません。再接続してください。',
        variant: 'destructive'
      });
    }
  }, [socket, isConnected, toast]);

  // ナレッジグラフ生成リクエスト
  const sendCreateKnowledgeGraphRequest = useCallback((params: CreateKnowledgeGraphParams) => {
    sendMessage('create_knowledge_graph', params);
  }, [sendMessage]);

  // 前回の接続試行時間を記録
  const lastConnectAttemptRef = useRef<number>(0);
  
  // 接続状態をモニタリングする変数
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5; // 最大再接続試行回数
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    if (socket && isConnected && currentRoleModelId === roleModelId) {
      console.log(`既に ${roleModelId} に接続済みです。再接続をスキップします。`);
      // 念のため接続状態を確認
      if (socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocketが接続済みと認識されていますが、実際には開いていません。状態:', socket.readyState);
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
    if (socket) {
      console.log('既存のWebSocket接続を閉じます');
      socket.close();
    }

    // 接続先URLの構築 - パス形式の変更
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // ViteのWebSocketとの競合を防ぐためパスを変更
    const wsUrl = `${protocol}//${host}/api/ws?userId=${user.id}&roleModelId=${roleModelId}`;
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
        toast({
          title: '接続成功',
          description: 'リアルタイム更新が有効になりました',
          variant: 'default'
        });
        
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

        // 正常な切断でない場合は再接続を試みる
        if (event.code !== 1000) {
          // 再接続試行回数をインクリメント
          reconnectAttemptsRef.current++;
          
          // 指数バックオフで再接続（1秒、2秒、4秒、8秒...）
          const reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          
          console.log(`${reconnectDelay / 1000}秒後に再接続を試みます... (試行: ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          // 最大再接続回数に達していない場合のみ再接続を試みる
          if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
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
        } else {
          // 正常な切断の場合は再接続カウンターをリセット
          reconnectAttemptsRef.current = 0;
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
    
    if (socket) {
      socket.close(1000, 'クライアントからの切断');
      setSocket(null);
      setIsConnected(false);
      setCurrentRoleModelId(null);
      reconnectAttemptsRef.current = 0; // 再接続カウンターをリセット
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
      
      if (socket) {
        socket.close(1000, 'コンポーネントがアンマウントされました');
      }
    };
  }, [socket]);
  
  // 定期的に接続状態をチェックする
  useEffect(() => {
    const checkConnectionInterval = setInterval(() => {
      if (socket && socket.readyState !== WebSocket.OPEN && currentRoleModelId) {
        console.warn('WebSocketが切断されています。再接続を試みます...');
        setIsConnected(false);
        connect(currentRoleModelId);
      } else if (socket && socket.readyState === WebSocket.OPEN) {
        // 接続中の場合はpingを送信（ハートビート）
        try {
          socket.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          console.log('Ping送信（接続確認）');
        } catch (e) {
          console.error('Ping送信エラー:', e);
          setIsConnected(false);
        }
      }
    }, 30000); // 30秒ごとにチェック
    
    return () => clearInterval(checkConnectionInterval);
  }, [socket, currentRoleModelId, connect]);
  
  // メッセージタイプに応じた処理関数を定義（整理のため）
  const handleMessage = useCallback((message: WSMessage) => {
    console.log('WebSocketメッセージを受信:', message);
    
    // pongメッセージの場合は接続確認のみで特別な処理はしない
    if (message.type === 'pong') {
      console.log('Pong受信（接続確認OK）');
      return;
    }
    
    switch (message.type) {
      case 'agent_thought':
        if (message.payload) {
          console.log('エージェント思考を受信:', message);
          
          // データからエージェント名と思考内容を安全に取得
          const agentName = message.payload.agentName || message.payload.agent || '未知のエージェント';
          
          // 思考内容をさまざまなフィールドから可能な限り取得
          let thought = '';
          if (typeof message.payload.thought === 'string') {
            thought = message.payload.thought;
          } else if (typeof message.payload.message === 'string') {
            thought = message.payload.message;
          } else if (typeof message.payload.content === 'string') {
            thought = message.payload.content;
          } else if (typeof message.payload === 'string') {
            thought = message.payload;
          } else {
            // オブジェクトの場合は文字列化
            thought = JSON.stringify(message.payload);
          }
          
          const agentThought: AgentThought = {
            id: message.payload.id || crypto.randomUUID().toString(),
            agentName,
            thought,
            message: thought, // 互換性のため両方のフィールドにセット
            type: message.payload.type || 'generic',
            roleModelId: message.payload.roleModelId || currentRoleModelId || '',
            timestamp: message.timestamp || new Date().toISOString(),
            step: message.payload.step
          };
          
          console.log('エージェント思考を追加:', agentThought);
          setAgentThoughts(prev => [...prev, agentThought]);
        } else {
          console.warn('エージェント思考メッセージにペイロードがありません:', message);
        }
        break;

      case 'progress-update':
        if (message.payload) {
          const update: ProgressUpdate = {
            message: message.payload.message,
            percent: message.payload.percent,
            timestamp: message.timestamp || new Date().toISOString(),
            roleModelId: message.payload.roleModelId || currentRoleModelId || undefined
          };
          setProgressUpdates(prev => [...prev, update]);
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

  // コンテキスト値の構築
  const value = {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    sendCreateKnowledgeGraphRequest,
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
  return context;
}