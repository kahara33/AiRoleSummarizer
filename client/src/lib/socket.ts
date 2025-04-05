let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
const listeners: Record<string, Function[]> = {};

/**
 * WebSocketの初期化
 * @returns WebSocketインスタンス
 */
export function initSocket(): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }
  
  // 既存のタイマーをクリア
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // WebSocketの接続URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log('WebSocket初期化: ', wsUrl);
  
  socket = new WebSocket(wsUrl);
  
  // 接続イベント
  socket.addEventListener('open', () => {
    console.log('WebSocket接続完了');
  });
  
  // メッセージ受信イベント
  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocketメッセージ受信:', data);
      
      // イベントタイプに基づいてリスナーを呼び出す
      if (data.type && listeners[data.type]) {
        listeners[data.type].forEach(callback => callback(data));
      }
      
      // すべてのリスナーに対してメッセージを送信
      if (listeners['all']) {
        listeners['all'].forEach(callback => callback(data));
      }
      
      // 接続確認メッセージを受け取ったら、ロールモデルの購読テストを送信
      if (data.type === 'connected') {
        console.log('WebSocket接続確認を受信しました。');
        // 接続確認メッセージを受信しました
        // ここでは自動購読は行わず、コンポーネントから明示的に購読メッセージを送信します
        // (KnowledgeGraphViewerコンポーネントなどから)
      }
    } catch (error) {
      console.error('WebSocketメッセージの解析エラー:', error);
    }
  });
  
  // エラーイベント
  socket.addEventListener('error', (error) => {
    console.error('WebSocketエラー:', error);
  });
  
  // 切断イベント
  socket.addEventListener('close', (event) => {
    console.log(`WebSocket切断: コード ${event.code}, 理由: ${event.reason}`);
    
    // 再接続を試行
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        console.log('WebSocket再接続を試行中...');
        initSocket();
      }, 5000);
    }
  });
  
  return socket;
}

/**
 * WebSocketにイベントリスナーを追加
 * @param eventType イベントタイプ
 * @param callback コールバック関数
 */
export function addSocketListener(eventType: string, callback: Function): void {
  if (!listeners[eventType]) {
    listeners[eventType] = [];
  }
  
  listeners[eventType].push(callback);
}

/**
 * WebSocketからイベントリスナーを削除
 * @param eventType イベントタイプ
 * @param callback コールバック関数
 */
export function removeSocketListener(eventType: string, callback: Function): void {
  if (listeners[eventType]) {
    listeners[eventType] = listeners[eventType].filter(cb => cb !== callback);
  }
}

/**
 * WebSocketでメッセージを送信
 * @param type メッセージタイプ
 * @param payload メッセージデータ
 */
export function sendSocketMessage(type: string, payload: any): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('WebSocketが接続されていません');
    return;
  }
  
  socket.send(JSON.stringify({ type, payload }));
}

/**
 * WebSocket接続を閉じる
 */
export function closeSocket(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}