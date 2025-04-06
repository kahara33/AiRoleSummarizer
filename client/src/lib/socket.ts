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
      
      // 受信データの詳細ログを出力して問題を特定
      if (data.type) {
        console.log(`WebSocketメッセージ詳細 (${data.type}):`, {
          type: data.type,
          payload: data.payload,
          timestamp: new Date().toISOString(),
          hasListeners: Boolean(listeners[data.type]),
          listenersCount: listeners[data.type]?.length || 0
        });
      }
      
      // イベントタイプに基づいたデータ処理（特殊ケース）
      if (data.type === 'agent_thoughts') {
        console.log('Agent thoughts処理前:', data.payload || data);
        // ペイロードがある場合はそれを、なければデータをそのまま送信
        const messageData = data.payload || data;
        if (listeners[data.type]) {
          listeners[data.type].forEach(callback => callback(messageData));
        }
        return; // 以降の処理はスキップ
      }
      
      // 通信イベントの特殊処理
      if (data.type === 'agent-communication') {
        console.log('Agent communication処理前:', data.payload || data);
        const messageData = data.payload || data;
        if (listeners[data.type]) {
          listeners[data.type].forEach(callback => callback(messageData));
        }
        return; // 以降の処理はスキップ
      }
      
      // 進捗イベントの特殊処理
      if (data.type === 'progress') {
        console.log('Progress update処理前:', data.payload || data);
        const messageData = data.payload || data;
        if (listeners[data.type]) {
          listeners[data.type].forEach(callback => callback(messageData));
        }
        return; // 以降の処理はスキップ
      }
      
      // イベントタイプに基づいてリスナーを呼び出す
      if (data.type && listeners[data.type]) {
        listeners[data.type].forEach(callback => callback(data.payload || data));
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
  
  // サブスクリプションの場合、roleModelIdのUUID形式を検証
  if (type === 'subscribe' && payload?.roleModelId) {
    const roleModelId = payload.roleModelId;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // defaultまたは無効なUUID形式の場合は送信しない
    if (roleModelId === 'default' || !uuidPattern.test(roleModelId)) {
      console.error(`無効なUUID形式のためメッセージを送信しません: ${roleModelId}`);
      console.trace('以下がスタックトレースです:');
      return;
    }
  }
  
  console.log(`WebSocketメッセージを送信: ${type}`, payload);
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