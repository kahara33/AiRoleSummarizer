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
      
      // エージェント関連のメッセージ変換処理（互換性対応）
      if (data.type === 'agent_thoughts' || data.type === 'agent-thoughts') {
        // agent_thoughtsイベントをエージェント思考メッセージへ標準化
        const payloadData = data.payload || data;
        
        // リスナーに配信する前にデータ形式を標準化
        const standardizedData = {
          ...payloadData,
          agentName: payloadData.agentName || payloadData.agent || 'エージェント',
          agentType: payloadData.agentType || payloadData.agent_type || 'unknown',
          thoughts: payloadData.thoughts || payloadData.message || payloadData.content || '',
          timestamp: payloadData.timestamp || new Date().toISOString()
        };
        
        console.log('エージェント思考の標準化データ:', standardizedData);
        
        // リスナーに配信（両方のイベント名で配信し、互換性を確保）
        if (listeners['agent_thoughts']) {
          listeners['agent_thoughts'].forEach(callback => callback(standardizedData));
        }
        if (listeners['agent-thoughts']) {
          listeners['agent-thoughts'].forEach(callback => callback(standardizedData));
        }
      }
      // 進捗更新の変換処理
      else if (data.type === 'progress') {
        // progressイベントを進捗メッセージへ標準化
        const payloadData = data.payload || data;
        
        // リスナーに配信する前にデータ形式を標準化
        const standardizedData = {
          ...payloadData,
          message: payloadData.message || `進捗: ${payloadData.progress || 0}%`,
          progress: payloadData.progress || 0,
          stage: payloadData.stage || 'system',
          timestamp: payloadData.timestamp || new Date().toISOString()
        };
        
        console.log('進捗更新の標準化データ:', standardizedData);
        
        // リスナーに配信
        if (listeners['progress']) {
          listeners['progress'].forEach(callback => callback(standardizedData));
        }
      }
      // 知識グラフ更新の変換処理
      else if (data.type === 'knowledge-graph-update' || data.type === 'graph-update') {
        // graph-updateイベントを知識グラフ更新メッセージへ標準化
        const payloadData = data.payload || data;
        
        // リスナーに配信する前にデータ形式を標準化
        const standardizedData = {
          ...payloadData,
          message: payloadData.message || 'グラフが更新されました',
          timestamp: payloadData.timestamp || new Date().toISOString(),
          type: payloadData.updateType || 'update'
        };
        
        console.log('グラフ更新の標準化データ:', standardizedData);
        
        // リスナーに配信（両方のイベント名で配信し、互換性を確保）
        if (listeners['knowledge-graph-update']) {
          listeners['knowledge-graph-update'].forEach(callback => callback(standardizedData));
        }
        if (listeners['graph-update']) {
          listeners['graph-update'].forEach(callback => callback(standardizedData));
        }
      }
      // エージェント間通信の変換処理
      else if (data.type === 'agent-communication') {
        // agent-communicationイベントをエージェント間通信メッセージへ標準化
        const payloadData = data.payload || data;
        
        // リスナーに配信する前にデータ形式を標準化
        const standardizedData = {
          ...payloadData,
          sourceAgentName: payloadData.sourceAgentName || payloadData.sourceAgent || 'Source',
          targetAgentName: payloadData.targetAgentName || payloadData.targetAgent || 'Target',
          message: payloadData.message || payloadData.content || 'エージェント間通信',
          timestamp: payloadData.timestamp || new Date().toISOString()
        };
        
        console.log('エージェント通信の標準化データ:', standardizedData);
        
        // リスナーに配信
        if (listeners['agent-communication']) {
          listeners['agent-communication'].forEach(callback => callback(standardizedData));
        }
      }
      // その他の標準メッセージ処理
      else if (data.type && listeners[data.type]) {
        // payloadが存在する場合はそれを使用、なければdata自体を使用
        const messageData = data.payload || data;
        // メッセージタイプに応じた詳細ログ
        console.log(`${data.type}処理前:`, messageData);
        // リスナーに配信
        listeners[data.type].forEach(callback => callback(messageData));
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