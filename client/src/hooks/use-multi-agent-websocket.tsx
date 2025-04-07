import { useState, useEffect, useRef, useCallback } from 'react';

// メッセージタイプの定義
type MessageType = 
  | 'chat_message' 
  | 'agent_thought' 
  | 'agent-thought'
  | 'agent-thoughts'
  | 'agent_thoughts'
  | 'crewai_progress' 
  | 'progress-update'
  | 'progress'
  | 'error'
  | 'connection'
  | 'subscription_confirmed';

// WebSocketメッセージの型定義
interface JsonMessage {
  type: MessageType;
  data?: {
    message?: string;
    agentName?: string;
    agentType?: string;
    thought?: string;
    thoughts?: string;
    content?: string;
    progress?: number;
    stage?: string;
    error?: string;
  };
  // サーバー形式のメッセージのためのフィールド
  message?: string;
  agentName?: string;
  agentType?: string;
  agent?: string;   // 後方互換性のため
  agent_type?: string; // 後方互換性のため
  thought?: string;
  thoughts?: string;
  content?: string;
  progress?: number;
  progress_update?: number; // 後方互換性のため
  stage?: string;
  error?: string;
  roleModelId?: string;
}

export interface WebSocketHook {
  subscribe: (roleModelId: string) => void;
  lastJsonMessage: JsonMessage | null;
  send: (message: string | object) => boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWebSocket(url?: string | null): WebSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastJsonMessage, setLastJsonMessage] = useState<JsonMessage | null>(null);
  
  const socket = useRef<WebSocket | null>(null);
  const currentRoleModelId = useRef<string | null>(null);

  // WebSocketメッセージハンドラ
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      setLastJsonMessage(data);
    } catch (e) {
      console.error('WebSocketメッセージのパースに失敗:', e);
    }
  }, []);

  // WebSocketエラーハンドラ
  const handleError = useCallback((event: Event) => {
    console.error('WebSocketエラー:', event);
    setError('WebSocket接続エラーが発生しました');
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // WebSocket接続ハンドラ
  const handleOpen = useCallback(() => {
    console.log('WebSocket接続が確立されました');
    setIsConnected(true);
    setIsConnecting(false);
    setError(null);

    // ロールモデルを購読
    if (currentRoleModelId.current && socket.current) {
      socket.current.send(JSON.stringify({
        type: 'subscribe',
        payload: { roleModelId: currentRoleModelId.current }
      }));
      console.log(`ロールモデルID ${currentRoleModelId.current} を購読しました`);
    }
  }, []);

  // WebSocket切断ハンドラ
  const handleClose = useCallback(() => {
    console.log('WebSocket接続が閉じられました');
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // ロールモデルを購読する関数
  const subscribe = useCallback((roleModelId: string) => {
    if (!roleModelId) return;

    // 既に同じロールモデルを購読している場合は何もしない
    if (currentRoleModelId.current === roleModelId && socket.current && socket.current.readyState === WebSocket.OPEN) {
      return;
    }

    currentRoleModelId.current = roleModelId;

    // 既存の接続があれば閉じる
    if (socket.current) {
      socket.current.close();
    }

    // 新しい接続を作成
    try {
      setIsConnecting(true);
      // WebSocket APIのURLを構築
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?roleModelId=${roleModelId}`;
      
      socket.current = new WebSocket(wsUrl);
      socket.current.onmessage = handleMessage;
      socket.current.onerror = handleError;
      socket.current.onopen = handleOpen;
      socket.current.onclose = handleClose;
    } catch (err) {
      console.error('WebSocket初期化エラー:', err);
      setError(`WebSocket接続を確立できませんでした: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnecting(false);
    }
  }, [handleMessage, handleError, handleOpen, handleClose]);

  // メッセージ送信関数
  const send = useCallback((data: string | object): boolean => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      setError('WebSocketが接続されていません');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.current.send(message);
      return true;
    } catch (err) {
      setError(`メッセージ送信エラー: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, []);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, []);

  return {
    subscribe,
    lastJsonMessage,
    send,
    isConnected,
    isConnecting,
    error
  };
}