import { useState, useCallback, useEffect } from 'react';
import { useGlobalWebSocket, AgentThought, ProgressUpdate } from './use-global-websocket';

/**
 * マルチエージェントWebSocketフック
 * グローバルWebSocketを拡張して、エージェント間通信に特化した機能を提供
 */
export function useMultiAgentWebSocket() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // グローバルWebSocketフックを使用
  const {
    isConnected,
    connect: globalConnect,
    disconnect: globalDisconnect,
    sendMessage: globalSendMessage,
    agentThoughts,
    progressUpdates,
    clearMessages
  } = useGlobalWebSocket();
  
  // WebSocket接続
  const connect = useCallback((roleModelId: string) => {
    try {
      setConnecting(true);
      setError(null);
      globalConnect();
    } catch (err) {
      setError('WebSocket接続エラー');
      console.error('WebSocket接続エラー:', err);
    } finally {
      setConnecting(false);
    }
  }, [globalConnect]);
  
  // WebSocket切断
  const disconnect = useCallback(() => {
    try {
      globalDisconnect();
      setIsProcessing(false);
    } catch (err) {
      console.error('WebSocket切断エラー:', err);
    }
  }, [globalDisconnect]);
  
  // メッセージ送信ラッパー関数
  const sendMessage = useCallback((type: string, payload: any) => {
    try {
      return globalSendMessage(type, payload);
    } catch (err) {
      console.error('メッセージ送信エラー:', err);
      return false;
    }
  }, [globalSendMessage]);
  
  // 処理状態のリセット
  const forceResetProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);
  
  // プログレス更新の監視
  useEffect(() => {
    if (progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      
      // エラー状態の更新
      if (latestUpdate.status === 'error' || latestUpdate.stage === 'error') {
        setError(latestUpdate.message || 'エラーが発生しました');
        setIsProcessing(false);
      }
      
      // 処理中状態の更新
      const isComplete = 
        latestUpdate.status === 'complete' || 
        latestUpdate.stage === 'complete' || 
        latestUpdate.percent >= 100 || 
        (latestUpdate.details && latestUpdate.details.complete === true);
      
      if (isComplete) {
        setIsProcessing(false);
      } else if (latestUpdate.message && !latestUpdate.message.includes('エラー')) {
        setIsProcessing(true);
      }
    }
  }, [progressUpdates]);
  
  // エージェント思考の監視
  useEffect(() => {
    if (agentThoughts.length > 0) {
      const latestThought = agentThoughts[agentThoughts.length - 1];
      
      // 思考タイプに基づく処理状態の更新
      if (latestThought.type === 'thinking' || latestThought.type === 'action') {
        setIsProcessing(true);
      } else if (latestThought.type === 'completed' || latestThought.type === 'complete') {
        setIsProcessing(false);
      }
    }
  }, [agentThoughts]);
  
  return {
    isConnected,
    connecting,
    error,
    agentThoughts,
    progressUpdates,
    isProcessing,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    forceResetProcessing
  };
}

export type { AgentThought, ProgressUpdate };