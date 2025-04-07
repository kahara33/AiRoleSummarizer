import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
  agentName: string;
  thought: string;
  timestamp: string;
  roleModelId: string;
  step?: string;
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

  // WebSocket接続関数
  const connect = useCallback((roleModelId: string) => {
    if (!user) {
      console.warn('ユーザーがログインしていないため、WebSocket接続を確立できません');
      return;
    }

    // 既存の接続を閉じる
    if (socket) {
      socket.close();
    }

    // 接続先URLの構築
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?userId=${user.id}&roleModelId=${roleModelId}`;

    try {
      const newSocket = new WebSocket(wsUrl);
      setCurrentRoleModelId(roleModelId);

      // WebSocketイベントハンドラ設定
      newSocket.onopen = () => {
        console.log('WebSocket接続が確立されました');
        setIsConnected(true);
        toast({
          title: '接続成功',
          description: 'リアルタイム更新が有効になりました',
          variant: 'default'
        });
      };

      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          console.log('WebSocketメッセージを受信:', message);

          // メッセージタイプに応じた処理
          switch (message.type) {
            case 'agent_thought':
              if (message.payload) {
                const thought: AgentThought = {
                  agentName: message.payload.agentName,
                  thought: message.payload.thought,
                  roleModelId: message.payload.roleModelId,
                  timestamp: message.timestamp || new Date().toISOString(),
                  step: message.payload.step
                };
                setAgentThoughts(prev => [...prev, thought]);
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
        } catch (error) {
          console.error('WebSocketメッセージの解析エラー:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket接続が閉じられました', event.code, event.reason);
        setIsConnected(false);

        // 正常な切断でない場合は再接続を試みる
        if (event.code !== 1000) {
          console.log('5秒後に再接続を試みます...');
          setTimeout(() => {
            if (currentRoleModelId) {
              connect(currentRoleModelId);
            }
          }, 5000);
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
    if (socket) {
      socket.close(1000, 'クライアントからの切断');
      setSocket(null);
      setIsConnected(false);
      setCurrentRoleModelId(null);
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
      if (socket) {
        socket.close(1000, 'コンポーネントがアンマウントされました');
      }
    };
  }, [socket]);

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