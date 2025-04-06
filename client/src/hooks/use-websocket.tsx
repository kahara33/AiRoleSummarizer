import { useState, useRef, useCallback, useEffect } from 'react';

export interface WebSocketMessage {
  data: string;
  type: string;
  target?: string;
}

type WebSocketEvents = {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConnectionError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onProgressUpdate?: (data: Record<string, any>) => void;
  onError?: (data: Record<string, any>) => void;
  onCompletion?: (data: Record<string, any>) => void;
};

export function useWebSocket(
  url: string | null,
  events?: WebSocketEvents,
  autoConnect: boolean = false
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocketインスタンスの参照を保持
  const socketRef = useRef<WebSocket | null>(null);
  // 最後に使用したURLを保持
  const lastUrlRef = useRef<string | null>(null);

  // 接続を確立する関数
  const connect = useCallback(() => {
    if (!url) {
      setError('WebSocket URLが指定されていません');
      return;
    }

    // 既に接続していたり、接続中の場合は何もしない
    if (
      socketRef.current && 
      (socketRef.current.readyState === WebSocket.OPEN || 
       socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      // WebSocketインスタンスを作成
      socketRef.current = new WebSocket(url);
      lastUrlRef.current = url;
      
      // WebSocketイベントハンドラを設定
      socketRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        events?.onConnect?.();
      };
      
      socketRef.current.onclose = () => {
        setIsConnected(false);
        events?.onDisconnect?.();
      };
      
      socketRef.current.onerror = (event) => {
        setError('WebSocket接続エラー');
        setIsConnecting(false);
        events?.onConnectionError?.(event);
      };
      
      socketRef.current.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          // メッセージタイプに基づいて適切なハンドラを呼び出す
          switch (parsed.type) {
            case 'progress_update':
              events?.onProgressUpdate?.(parsed);
              break;
            case 'error':
              events?.onError?.(parsed);
              break;
            case 'completion':
              events?.onCompletion?.(parsed);
              break;
            default:
              // デフォルトのメッセージハンドラ
              events?.onMessage?.({
                data: event.data,
                type: parsed.type || 'unknown',
                target: parsed.target
              });
          }
        } catch (e) {
          console.error('WebSocketメッセージのパースに失敗:', e);
          // 非JSONメッセージとして処理
          events?.onMessage?.({
            data: event.data,
            type: 'raw'
          });
        }
      };
    } catch (err) {
      setError(`WebSocket初期化エラー: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnecting(false);
    }
  }, [url, events]);

  // 接続を切断する関数
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  // メッセージを送信する関数
  const send = useCallback((data: string | object) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocketが接続されていません');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socketRef.current.send(message);
      return true;
    } catch (err) {
      setError(`メッセージ送信エラー: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, []);

  // URLが変更された場合に再接続
  useEffect(() => {
    if (autoConnect && url && url !== lastUrlRef.current) {
      disconnect();
      connect();
    }
  }, [url, autoConnect, connect, disconnect]);

  // コンポーネントがアンマウントされた時に接続を閉じる
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send
  };
}