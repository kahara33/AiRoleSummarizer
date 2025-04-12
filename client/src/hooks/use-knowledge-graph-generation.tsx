/**
 * ナレッジグラフ生成用の特化型WebSocketフック
 * 標準のWebSocketフックを拡張し、ナレッジグラフ生成に必要な機能を追加
 */
import { useCallback } from 'react';
import { useMultiAgentWebSocket } from './use-multi-agent-websocket-fixed';

// フックのインターフェース
export interface UseKnowledgeGraphGenerationResult {
  // 基本的なWebSocket状態
  isConnected: boolean;
  connecting: boolean;
  error: string | null;
  agentThoughts: any[];
  progressUpdates: any[];
  isProcessing: boolean;
  
  // 基本的なWebSocketメソッド
  connect: (roleModelId: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload: any) => boolean;
  clearMessages: () => void;
  forceResetProcessing: () => void;
  
  // 拡張されたナレッジグラフ生成用メソッド
  sendCreateKnowledgeGraphRequest: (options: {
    roleModelId?: string;
    includeCollectionPlan?: boolean;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => boolean;
  
  // キャンセル関連のメソッド
  sendCancelOperationRequest: (operationType: string) => boolean;
  cancelOperation: () => boolean;
}

/**
 * ナレッジグラフ生成用のカスタムフック
 * WebSocketフックにナレッジグラフ生成機能を追加
 */
export function useKnowledgeGraphGeneration(): UseKnowledgeGraphGenerationResult {
  // 基本のWebSocketフックを使用
  const wsHook = useMultiAgentWebSocket();
  
  // 接続状態のデバッグログ
  useEffect(() => {
    console.log('useKnowledgeGraphGeneration: WebSocket接続状態:', wsHook.isConnected ? '接続済み' : '未接続');
  }, [wsHook.isConnected]);
  
  // ナレッジグラフ生成リクエスト送信関数
  const sendCreateKnowledgeGraphRequest = useCallback((options: {
    roleModelId?: string;
    includeCollectionPlan?: boolean;
    industry?: string;
    keywords?: string[];
    useExistingGraph?: boolean;
  }) => {
    console.log('ナレッジグラフ生成リクエスト:', options);
    const roleModelId = options.roleModelId;
    
    if (!roleModelId) {
      console.error('ナレッジグラフ生成にはroleModelIdが必要です');
      return false;
    }
    
    // 既存のグラフを使用する場合と新規生成の場合で異なるメッセージタイプを使用
    const messageType = options.useExistingGraph ? 'create_collection_plan' : 'create_knowledge_graph';
    
    return wsHook.sendMessage(messageType, {
      roleModelId,
      includeCollectionPlan: options.includeCollectionPlan !== false, // デフォルトでtrue
      industry: options.industry || '一般',
      keywords: options.keywords || ['情報収集', 'ナレッジグラフ'],
      useExistingGraph: !!options.useExistingGraph
    });
  }, [wsHook.sendMessage]);
  
  // キャンセル操作リクエスト送信関数
  const sendCancelOperationRequest = useCallback((operationType: string) => {
    console.log(`${operationType} 操作のキャンセルリクエストを送信`);
    return wsHook.sendMessage('cancel_operation', {
      operationType
    });
  }, [wsHook.sendMessage]);
  
  // 一般的なキャンセル操作関数
  const cancelOperation = useCallback(() => {
    console.log('WebSocket操作のキャンセルを実行');
    // まず、汎用的なキャンセル操作を送信
    const result = wsHook.sendMessage('cancel', {});
    
    // 処理状態をリセット
    wsHook.forceResetProcessing();
    
    return result;
  }, [wsHook.sendMessage, wsHook.forceResetProcessing]);
  
  // 拡張されたAPIを返す
  return {
    ...wsHook, // 基本のWebSocketフック機能をそのまま継承
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest,
    cancelOperation
  };
}