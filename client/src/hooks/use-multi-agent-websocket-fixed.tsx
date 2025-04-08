import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';
import { useGlobalWebSocket, GlobalWebSocketManager } from './use-global-websocket';

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

// WebSocketプロバイダーコンポーネント（新しいグローバルWebSocketを使用）
export function MultiAgentWebSocketProvider({ children }: { children: ReactNode }) {
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // グローバルWebSocketフックを使用
  const { 
    isConnected, 
    connect,
    disconnect,
    sendMessage: globalSendMessage,
    agentThoughts,
    progressUpdates,
    clearMessages
  } = useGlobalWebSocket(currentRoleModelId || undefined);

  // WebSocketへのメッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!currentRoleModelId) {
      console.error('ロールモデルIDが設定されていないため、メッセージを送信できません');
      toast({
        title: 'エラー',
        description: 'ロールモデルが選択されていません',
        variant: 'destructive'
      });
      return;
    }
    
    return globalSendMessage(type, payload);
  }, [currentRoleModelId, globalSendMessage, toast]);

  // ナレッジグラフ生成リクエスト
  const sendCreateKnowledgeGraphRequest = useCallback((params: CreateKnowledgeGraphParams) => {
    sendMessage('create_knowledge_graph', params);
  }, [sendMessage]);
  
  // 操作キャンセルリクエスト
  const sendCancelOperationRequest = useCallback((operationType: string) => {
    sendMessage('cancel_operation', { operationType });
  }, [sendMessage]);

  // WebSocket接続関数
  const connectToWebSocket = useCallback((roleModelId: string) => {
    if (!user) {
      console.warn('ユーザーがログインしていないため、WebSocket接続を確立できません');
      return;
    }
    
    setCurrentRoleModelId(roleModelId);
    connect();
  }, [user, connect]);

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
  
  // 処理中かどうかの状態を計算
  const isProcessing = useMemo(() => {
    // 進捗が存在し、かつそのうち1つでも100%未満のものがあれば処理中と判断
    if (progressUpdates.length === 0) {
      return false;
    }
    
    // 最新の進捗が100%未満なら処理中と判断
    const latestUpdate = progressUpdates[progressUpdates.length - 1];
    if (latestUpdate && (latestUpdate.percent < 100 && latestUpdate.progress || 0) < 100) {
      return true;
    }

    // 過去20秒以内に更新された進捗で100%未満のものがあれば処理中と判断
    const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
    return progressUpdates.some(update => 
      (update.percent < 100 || (update.progress || 0) < 100) && 
      update.timestamp > twentySecondsAgo
    );
  }, [progressUpdates]);
  
  // メッセージタイプによってreactiveな処理を行う
  useEffect(() => {
    // 受信したメッセージをmessages配列に追加
    const handleOtherMessage = (message: any) => {
      if (message.type && message.type !== 'agent_thoughts' && message.type !== 'progress' && 
          message.type !== 'pong' && message.type !== 'connection') {
        console.log('その他のメッセージを受信:', message.type);
        setMessages(prev => [...prev, message]);
      }
    };
    
    // メッセージリスナーを設定
    // 直接インポートしたグローバルマネージャーを使用
    const globalManager = GlobalWebSocketManager.getInstance();
    globalManager.addMessageListener('all', handleOtherMessage);
    
    return () => {
      globalManager.removeMessageListener('all', handleOtherMessage);
    };
  }, []);
  
  // コンテキスト値の構築
  const value = {
    isConnected,
    connect: connectToWebSocket,
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
  return context;
}

export default useMultiAgentWebSocket;