/**
 * マルチエージェントWebSocket接続のためのカスタムフック（改良版）
 * AgentConversationコンポーネントで使用するために最適化されています
 * 
 * GlobalWebSocketManagerに基づく高い信頼性を持つ実装です
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAuth } from './use-auth';
import { 
  GlobalWebSocketManager, 
  AgentThought as GlobalAgentThought,
  ProgressUpdate as GlobalProgressUpdate 
} from './use-global-websocket';

// AgentThought型の再エクスポート
export interface AgentThought extends GlobalAgentThought {}

// ProgressUpdate型の再エクスポート
export interface ProgressUpdate extends GlobalProgressUpdate {}

// WebSocketコンテキスト型
interface MultiAgentWebSocketContextType {
  isConnected: boolean;
  connecting: boolean;
  error: string | null;
  agentThoughts: AgentThought[];
  progressUpdates: ProgressUpdate[];
  isProcessing: boolean;
  connect: (roleModelId: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload: any) => boolean;
  clearMessages: () => void;
  forceResetProcessing: () => void;
}

/**
 * マルチエージェントWebSocketカスタムフック
 * 
 * 機能:
 * - 特定のroleModelIdに対するWebSocket接続
 * - エージェント思考メッセージの受信と管理
 * - 進捗状況の追跡
 * - 処理状態の管理
 * - 接続状態の通知
 */
// MultiAgentWebSocketコンテキスト
const MultiAgentWebSocketContext = createContext<MultiAgentWebSocketContextType | null>(null);

/**
 * MultiAgentWebSocketプロバイダコンポーネント
 */
export function MultiAgentWebSocketProvider({ children }: { children: React.ReactNode }) {
  const multiAgentWebSocket = useMultiAgentWebSocketManager();
  
  return (
    <MultiAgentWebSocketContext.Provider value={multiAgentWebSocket}>
      {children}
    </MultiAgentWebSocketContext.Provider>
  );
}

/**
 * マルチエージェントWebSocketフックを使用する
 */
export function useMultiAgentWebSocket() {
  const context = useContext(MultiAgentWebSocketContext);
  if (!context) {
    throw new Error('useMultiAgentWebSocket must be used within a MultiAgentWebSocketProvider');
  }
  return context;
}

// 実際のWebSocket管理ロジック
function useMultiAgentWebSocketManager() {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const { user } = useAuth();
  
  // グローバルWebSocket管理インスタンスの取得
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
        
        console.log(`マルチエージェントWebSocket接続を実行 (開発モード): roleModelId=${roleModelId}`);
        wsManager.connect(
          dummyUserId,
          roleModelId,
          (connected) => {
            setConnecting(false);
            setIsConnected(connected);
            if (connected) {
              console.log('マルチエージェントWebSocket接続状態の変更: 接続済み');
            } else {
              console.log('マルチエージェントWebSocket接続状態の変更: 切断');
              setError('WebSocket接続に失敗しました');
            }
          }
        );
        return;
      }
      
      setConnecting(false);
      setError('ユーザーが認証されていません');
      return;
    }
    
    setCurrentRoleModelId(roleModelId);
    
    // ユーザーIDを決定 (通常のユーザーまたはデバッグ用ダミー)
    const effectiveUserId = isDebugRoute ? dummyUserId : (user ? user.id : dummyUserId);
    
    console.log(`マルチエージェントWebSocket接続を実行: roleModelId=${roleModelId}`);
    wsManager.connect(
      effectiveUserId,
      roleModelId,
      (connected) => {
        setConnecting(false);
        setIsConnected(connected);
        if (connected) {
          console.log('マルチエージェントWebSocket接続状態の変更: 接続済み');
        } else {
          console.log('マルチエージェントWebSocket接続状態の変更: 切断');
          setError('WebSocket接続に失敗しました');
        }
      }
    );
  }, [user, wsManager]);
  
  // WebSocket切断
  const disconnect = useCallback(() => {
    wsManager.disconnect();
    setIsConnected(false);
    setCurrentRoleModelId(null);
    setError(null);
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
    
    return wsManager.sendMessage(type, payload);
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
          console.log('エラーが発生したため処理状態をリセットします');
          setIsProcessing(false);
        } else if (status === 'completed' || percent >= 100) {
          // 完了時には少し遅延してから処理状態をリセット
          console.log('処理が完了しました、状態をリセットします');
          setTimeout(() => {
            setIsProcessing(false);
          }, 2000); // 完了メッセージを表示するための短い遅延
        } else {
          // それ以外は処理中と判断
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
    forceResetProcessing
  };
}