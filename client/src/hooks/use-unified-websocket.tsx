/**
 * 統合型WebSocketフック
 * 
 * 様々なWebSocket関連フックの機能を統合し、一貫したAPIを提供します。
 * ナレッジグラフ生成、情報収集プラン生成など、あらゆるWebSocket通信に使用できます。
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAuth } from './use-auth';
import { GlobalWebSocketManager, AgentThought, ProgressUpdate } from './use-global-websocket';

// WebSocketコンテキスト型
interface UnifiedWebSocketContextType {
  // 接続状態
  isConnected: boolean;
  connecting: boolean;
  error: string | null;
  
  // メッセージ状態
  agentThoughts: AgentThought[];
  progressUpdates: ProgressUpdate[];
  isProcessing: boolean;
  
  // 基本的な接続管理
  connect: (roleModelId: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload: any) => boolean;
  clearMessages: () => void;
  
  // 処理状態管理
  forceResetProcessing: () => void;
  
  // 特化型機能: ナレッジグラフ生成
  sendCreateKnowledgeGraphRequest: (options: {
    roleModelId?: string;
    includeCollectionPlan?: boolean;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => boolean;
  
  // 特化型機能: 情報収集プラン生成
  sendCreateCollectionPlanRequest: (options: {
    roleModelId?: string;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => boolean;
  
  // 特化型機能: キャンセル処理
  sendCancelOperationRequest: (operationType: string) => boolean;
  cancelOperation: () => boolean;
}

// WebSocketコンテキストの作成
const UnifiedWebSocketContext = createContext<UnifiedWebSocketContextType | null>(null);

/**
 * UnifiedWebSocketプロバイダコンポーネント
 */
export function UnifiedWebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsManager = useUnifiedWebSocketManager();
  
  return (
    <UnifiedWebSocketContext.Provider value={wsManager}>
      {children}
    </UnifiedWebSocketContext.Provider>
  );
}

/**
 * 統合型WebSocketフックを使用する
 */
export function useUnifiedWebSocket() {
  const context = useContext(UnifiedWebSocketContext);
  if (!context) {
    throw new Error('useUnifiedWebSocket must be used within a UnifiedWebSocketProvider');
  }
  return context;
}

/**
 * UnifiedWebSocketの内部実装
 * このフックは直接使用せず、useUnifiedWebSocketを通じてアクセスします
 */
function useUnifiedWebSocketManager(): UnifiedWebSocketContextType {
  // 認証状態の取得
  const { user } = useAuth();
  
  // WebSocket接続とメッセージ状態
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // WebSocketマネージャと現在のroleModelId
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const wsManager = GlobalWebSocketManager.getInstance();
  
  // WebSocket接続
  const connect = useCallback((roleModelId: string) => {
    console.log('接続試行: user=', user, 'roleModelId=', roleModelId);
    setConnecting(true);
    setError(null);
    
    // デバッグモードの一時的なユーザーID
    const dummyUserId = '0eb64aa6-4b1d-40a8-98df-c1839160232f';
    
    // 現在のURLパスが /debug/ で始まるかをチェック - デバッグページで認証をバイパス
    const isDebugRoute = window.location.pathname.startsWith('/debug/');
    
    if (!user && !isDebugRoute) {
      console.warn('ユーザーがログインしていないため、WebSocket接続を確立できません');
      
      // 開発環境の場合や、デバッグルートの場合は仮のユーザーIDでダミー接続を試みる
      if (process.env.NODE_ENV === 'development' || isDebugRoute) {
        console.log('開発/デバッグ環境: 仮ユーザーIDでWebSocket接続を試みます');
        
        setCurrentRoleModelId(roleModelId);
        
        console.log(`WebSocket接続を実行 (開発モード): roleModelId=${roleModelId}`);
        wsManager.connect(
          dummyUserId,
          roleModelId,
          (connected) => {
            setConnecting(false);
            setIsConnected(connected);
            if (connected) {
              console.log('WebSocket接続状態の変更: 接続済み');
            } else {
              console.log('WebSocket接続状態の変更: 切断');
              setError('WebSocket接続に失敗しました');
            }
          }
        );
      } else {
        setConnecting(false);
        setError('ユーザーがログインしていません');
      }
      return;
    }
    
    // 正規ユーザーIDでWebSocket接続
    const userId = user?.id || dummyUserId;
    setCurrentRoleModelId(roleModelId);
    
    console.log(`WebSocket接続を実行: userId=${userId}, roleModelId=${roleModelId}`);
    wsManager.connect(
      userId,
      roleModelId,
      (connected) => {
        setConnecting(false);
        setIsConnected(connected);
        if (connected) {
          console.log('WebSocket接続状態の変更: 接続済み');
        } else {
          console.log('WebSocket接続状態の変更: 切断');
          setError('WebSocket接続に失敗しました');
        }
      }
    );
  }, [user, wsManager]);
  
  // WebSocket切断
  const disconnect = useCallback(() => {
    console.log('WebSocket切断を実行');
    wsManager.disconnect();
    setIsConnected(false);
    setCurrentRoleModelId(null);
  }, [wsManager]);
  
  // メッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!isConnected) {
      console.log('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    // ユーザーメッセージの場合、ローカルの状態にも追加する
    if (type === 'chat_message' || type === 'user_message') {
      console.log('ユーザーメッセージを送信します:', payload);
      
      // ユーザーメッセージをエージェント思考形式に変換して追加
      const userMessageThought: AgentThought = {
        id: `user-message-${Date.now()}`,
        agentName: 'ユーザー',
        thought: typeof payload === 'string' ? payload : payload.message || '',
        message: typeof payload === 'string' ? payload : payload.message || '',
        timestamp: new Date().toISOString(),
        roleModelId: payload.roleModelId || currentRoleModelId || '',
        type: 'user-message',
        agentType: 'user'
      };
      
      // エージェント思考リストに追加
      setAgentThoughts(prevThoughts => [...prevThoughts, userMessageThought]);
    }
    
    // すべてのメッセージにroleModelIdを確実に含める
    const enhancedPayload = typeof payload === 'object' 
      ? { 
          ...payload, 
          roleModelId: payload.roleModelId || currentRoleModelId 
        } 
      : { 
          message: payload, 
          roleModelId: currentRoleModelId 
        };
    
    console.log(`メッセージ送信(${type}):`, enhancedPayload);
    return wsManager.sendMessage(type, enhancedPayload);
  }, [isConnected, wsManager, currentRoleModelId]);
  
  // メッセージの消去
  const clearMessages = useCallback(() => {
    setAgentThoughts([]);
    setProgressUpdates([]);
  }, []);
  
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
        
        // 処理中状態を更新
        setIsProcessing(true);
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
        
        // ステータスの検出（エラーまたは完了）
        const status = payloadAny.status || message.status || null;
        
        // 進捗更新オブジェクトを作成
        const progressUpdate: ProgressUpdate = {
          message: progressMessage,
          percent,
          progress: percent,
          progressPercent: percent,
          timestamp: message.timestamp || new Date().toISOString(),
          roleModelId: payloadAny.roleModelId || message.roleModelId || currentRoleModelId || '',
          stage: payloadAny.stage || message.stage || 'processing',
          details: payloadAny.details || message.details || null,
          status
        };
        
        console.log('進捗更新を追加:', progressUpdate);
        setProgressUpdates(prev => [...prev, progressUpdate]);
        
        // 処理状態の更新
        if (status === 'error' || percent === 0) {
          // エラー時には即座に処理状態をリセット
          console.log('エラーが発生したため処理状態をリセットします', progressUpdate);
          setIsProcessing(false);
        } else if (status === 'completed' || percent >= 100) {
          // 完了時には少し遅延してから処理状態をリセット
          console.log('処理が完了しました、状態をリセットします', progressUpdate);
          // 確実に状態をリセットするため、即座に更新し、遅延後にも更新
          setIsProcessing(false);
          
          // バックアップとして2秒後に再度確認
          setTimeout(() => {
            console.log('処理完了の遅延リセット確認');
            setIsProcessing(false);
          }, 2000);
        } else if (percent > 0 && percent < 100) {
          // 途中経過の場合は処理中と判断
          setIsProcessing(true);
        }
      } catch (error) {
        console.error('進捗更新の処理エラー:', error);
      }
    };
    
    // すべてのメッセージを受け取るハンドラー
    const handleAllMessages = (message: any) => {
      console.log('すべてのメッセージリスナーが受信:', message);
      
      // メッセージタイプに基づいて適切なハンドラーに転送
      const type = message.type || '';
      
      if (type === 'agent_thought' || type === 'agent_thoughts' || type === 'thought') {
        handleAgentThought(message);
      } else if (type === 'progress' || type === 'progress_update') {
        handleProgress(message);
      }
    };
    
    // すべてのメッセージを受け取るリスナーのみを追加し、個別のリスナーは使用しない
    // 重複処理を避けるため
    wsManager.addMessageListener('all', handleAllMessages);
    
    // クリーンアップ
    return () => {
      wsManager.removeMessageListener('all', handleAllMessages);
    };
  }, [currentRoleModelId, wsManager]);
  
  // 初期接続と切断
  useEffect(() => {
    return () => {
      // コンポーネントのアンマウント時に切断
      disconnect();
    };
  }, [disconnect]);
  
  // 処理状態を強制的にリセットする関数
  const forceResetProcessing = useCallback(() => {
    console.log('処理状態を強制的にリセットします');
    setIsProcessing(false);
  }, []);

  // ナレッジグラフ生成リクエスト関数
  const sendCreateKnowledgeGraphRequest = useCallback((options: {
    roleModelId?: string;
    includeCollectionPlan?: boolean;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => {
    console.log('ナレッジグラフ生成リクエスト:', options);
    
    // ナレッジグラフ生成専用のメッセージタイプを使用
    const messageType = 'create_knowledge_graph';
    
    return sendMessage(messageType, {
      roleModelId: options.roleModelId || currentRoleModelId,
      includeCollectionPlan: options.includeCollectionPlan !== false, // デフォルトでtrue
      industry: options.industry || '一般',
      keywords: options.keywords || ['情報収集', 'ナレッジグラフ'],
      useExistingGraph: !!options.useExistingGraph
    });
  }, [sendMessage, currentRoleModelId]);
  
  // 情報収集プラン生成リクエスト関数
  const sendCreateCollectionPlanRequest = useCallback((options: {
    roleModelId?: string;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => {
    console.log('情報収集プラン生成リクエスト:', options);
    
    // 情報収集プラン生成専用のメッセージタイプを使用
    return sendMessage('create_collection_plan', {
      roleModelId: options.roleModelId || currentRoleModelId,
      industry: options.industry || '一般',
      keywords: options.keywords || ['情報収集', 'ナレッジグラフ'],
      useExistingGraph: options.useExistingGraph !== false // デフォルトでtrue
    });
  }, [sendMessage, currentRoleModelId]);
  
  // キャンセル操作リクエスト関数
  const sendCancelOperationRequest = useCallback((operationType: string) => {
    console.log(`${operationType} 操作のキャンセルリクエストを送信`);
    return sendMessage('cancel_operation', {
      operationType
    });
  }, [sendMessage]);
  
  // 一般的なキャンセル操作関数
  const cancelOperation = useCallback(() => {
    console.log('WebSocket操作のキャンセルを実行');
    // まず、汎用的なキャンセル操作を送信
    const result = sendMessage('cancel', {});
    
    // 処理状態をリセット
    setIsProcessing(false);
    
    return result;
  }, [sendMessage]);
  
  return {
    isConnected,
    connecting,
    error,
    connect,
    disconnect,
    sendMessage,
    agentThoughts,
    progressUpdates,
    isProcessing,
    clearMessages,
    forceResetProcessing,
    sendCreateKnowledgeGraphRequest,
    sendCreateCollectionPlanRequest,
    sendCancelOperationRequest,
    cancelOperation
  };
}