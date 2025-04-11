let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
const listeners: Record<string, Function[]> = {};

/**
 * WebSocketの初期化
 * @param customRoleModelId 特定のロールモデルIDを指定する場合
 * @returns WebSocketインスタンス
 */
export function initSocket(customRoleModelId?: string): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('既存のWebSocket接続を再利用します');
    return socket;
  }
  
  // 既存のタイマーをクリア
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // WebSocketの接続URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // サーバー側のパスが/api/wsになっているので合わせる
  const wsUrl = `${protocol}//${window.location.host}/api/ws`;
  
  // ロールモデルIDの決定（優先順位: カスタムID > URLパラメータ > デフォルト）
  let roleModelId = 'default';
  
  if (customRoleModelId) {
    roleModelId = customRoleModelId;
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoleModelId = urlParams.get('roleModelId');
    if (urlRoleModelId) {
      roleModelId = urlRoleModelId;
    }
  }
  
  // ユーザーIDを追加（必須パラメータ）
  const userId = localStorage.getItem('userId') || '0eb64aa6-4b1d-40a8-98df-c1839160232f'; // デフォルトの管理者ID
  
  // 一意のクライアントIDを生成（ユーザーID + タイムスタンプ + ランダム文字列）
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const clientId = `${userId}-${timestamp}-${randomString}`;
  
  // ロールモデルID、ユーザーID、クライアントIDをクエリパラメータとして追加
  const wsUrlWithParams = `${wsUrl}?roleModelId=${roleModelId}&userId=${userId}&clientId=${clientId}&t=${timestamp}`;
  
  console.log(`グローバルWebSocket接続を開始します:`, wsUrlWithParams);
  
  try {
    // WebSocketインスタンスを作成
    socket = new WebSocket(wsUrlWithParams);
    
    // 接続タイムアウト処理の追加（5秒）
    const connectionTimeout = setTimeout(() => {
      if (socket && socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket接続がタイムアウトしました。再接続を試みます。');
        socket.close();
        
        // 再接続を試行
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            console.log('WebSocket再接続を試行中...');
            initSocket(customRoleModelId);
          }, 3000);
        }
      }
    }, 5000);
  
    // 接続イベント
    socket.addEventListener('open', () => {
      // 接続タイムアウトをクリア
      clearTimeout(connectionTimeout);
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
          
          console.log('元のエージェント思考データ:', payloadData);
          console.log('thinking属性:', payloadData.thinking);
          console.log('reasoning属性:', payloadData.reasoning);
          console.log('decision属性:', payloadData.decision);
          
          // リスナーに配信する前にデータ形式を標準化
          const standardizedData = {
            ...payloadData,
            agentName: payloadData.agentName || payloadData.agent || 'エージェント',
            agentType: payloadData.agentType || payloadData.agent_type || 'unknown',
            thoughts: payloadData.thoughts || payloadData.message || payloadData.content || '',
            // 思考プロセスの詳細を確保
            thinking: payloadData.thinking || [{
              step: 'default',
              content: payloadData.thoughts || payloadData.message || payloadData.content || '',
              timestamp: payloadData.timestamp || new Date().toISOString()
            }],
            // 推論と決定を確保
            reasoning: payloadData.reasoning,
            decision: payloadData.decision,
            // コンテキストと入出力データを確保
            context: payloadData.context,
            inputData: payloadData.inputData,
            outputData: payloadData.outputData,
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
        // エラーメッセージの変換処理
        else if (data.type === 'error') {
          // errorイベントをエラーメッセージへ標準化
          const payloadData = data.payload || data;
          
          // リスナーに配信する前にデータ形式を標準化
          const standardizedData = {
            ...payloadData,
            message: payloadData.message || payloadData.error || 'エラーが発生しました',
            details: payloadData.details || payloadData.errorDetails || {},
            timestamp: payloadData.timestamp || new Date().toISOString()
          };
          
          console.error('エラーメッセージの標準化データ:', standardizedData);
          
          // リスナーに配信
          if (listeners['error']) {
            listeners['error'].forEach(callback => callback(standardizedData));
          }
        }
        // 完了メッセージの変換処理
        else if (data.type === 'completion') {
          // completionイベントを完了メッセージへ標準化
          const payloadData = data.payload || data;
          
          // リスナーに配信する前にデータ形式を標準化
          const standardizedData = {
            ...payloadData,
            message: payloadData.message || '処理が完了しました',
            data: payloadData.data || {},
            progress: 100, // 完了メッセージの場合は進捗を100%に設定
            timestamp: payloadData.timestamp || new Date().toISOString()
          };
          
          console.log('完了メッセージの標準化データ:', standardizedData);
          
          // リスナーに配信
          if (listeners['completion']) {
            listeners['completion'].forEach(callback => callback(standardizedData));
          }
        }
        // 知識グラフ更新の変換処理
        else if (data.type === 'knowledge-graph-update' || data.type === 'graph-update' || 
                data.type === 'knowledge_graph_update') {
          // すべての形式の知識グラフ更新イベントを標準化
          const payloadData = data.payload || data;
          
          // グラフ更新の詳細ログ
          console.log(`グラフ更新データ受信 - タイプ: ${data.type}, ペイロード:`, payloadData);
          
          // 完了フラグを推測（updateType, status, isCompleted フィールドから）
          const isComplete = 
            payloadData.updateType === 'complete' || 
            payloadData.status === 'completed' || 
            payloadData.isCompleted === true;
          
          // リスナーに配信する前にデータ形式を標準化
          const standardizedData = {
            ...payloadData,
            message: payloadData.message || 'グラフが更新されました',
            timestamp: payloadData.timestamp || new Date().toISOString(),
            type: payloadData.updateType || 'update',
            updateType: payloadData.updateType || 'update',
            roleModelId: payloadData.roleModelId,
            // 明示的に完了フラグを設定
            isCompleted: isComplete,
            status: isComplete ? 'completed' : (payloadData.status || 'in_progress'),
          };
          
          console.log('グラフ更新の標準化データ:', standardizedData);
          
          // 完了イベントの場合は進捗イベントも配信（互換性のため）
          if (isComplete && listeners['progress']) {
            const progressData = {
              ...standardizedData,
              progress: 100,
              percent: 100,
              progressPercent: 100,
              status: 'completed',
              message: standardizedData.message || 'グラフ生成が完了しました'
            };
            
            console.log('グラフ完了に伴う進捗更新:', progressData);
            listeners['progress'].forEach(callback => callback(progressData));
          }
          
          // リスナーに配信（すべての互換形式で配信し、互換性を確保）
          if (listeners['knowledge-graph-update']) {
            listeners['knowledge-graph-update'].forEach(callback => callback(standardizedData));
          }
          if (listeners['graph-update']) {
            listeners['graph-update'].forEach(callback => callback(standardizedData));
          }
          if (listeners['knowledge_graph_update']) {
            listeners['knowledge_graph_update'].forEach(callback => callback(standardizedData));
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
        // 情報収集プランメッセージ処理
        else if (data.type === 'information_plans' || data.type === 'information_plan_update') {
          const payloadData = data.payload || data;
          
          // リスナーに配信する前にデータ形式を標準化
          const standardizedData = {
            ...payloadData,
            plans: payloadData.plans || [],
            plan: payloadData.plan, // 単一プラン更新の場合
            roleModelId: payloadData.roleModelId,
            updateType: payloadData.updateType || 'update',
            timestamp: payloadData.timestamp || new Date().toISOString()
          };
          
          console.log('情報収集プラン標準化データ:', standardizedData);
          
          // リスナーに配信（両方のイベント名で配信）
          if (listeners['information_plans']) {
            listeners['information_plans'].forEach(callback => callback(standardizedData));
          }
          if (listeners['information_plan_update']) {
            listeners['information_plan_update'].forEach(callback => callback(standardizedData));
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
          initSocket(customRoleModelId);
        }, 5000);
      }
    });
    
    return socket;
  } catch (error) {
    console.error('WebSocket初期化エラー:', error);
    
    // エラー時に再接続を試行
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        console.log('WebSocket再接続を試行中...');
        initSocket(customRoleModelId);
      }, 5000);
    }
    
    // エラー時でもダミーインスタンスを返し、アプリケーションのクラッシュを防止
    return new WebSocket('wss://dummy-for-error-prevention');
  }
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

/**
 * 情報収集プランを取得するためのリクエストを送信
 * @param roleModelId ロールモデルID
 */
export function requestInformationPlans(roleModelId: string): void {
  if (!roleModelId) {
    console.error('無効なパラメータ: roleModelIdが空です');
    return;
  }
  
  // WebSocketで情報収集プラン取得リクエストを送信
  sendSocketMessage('information_collection_plan', {
    roleModelId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`情報収集プランリクエストを送信しました - ロールモデル: ${roleModelId}`);
}

/**
 * 情報収集プランを保存
 * @param roleModelId ロールモデルID
 * @param planData プランデータ
 */
export function saveInformationPlan(roleModelId: string, planData: any): void {
  if (!roleModelId) {
    console.error('無効なパラメータ: roleModelIdが空です');
    return;
  }
  
  // プランデータにロールモデルIDを設定
  const dataToSend = {
    ...planData,
    roleModelId
  };
  
  // WebSocketで情報収集プラン保存リクエストを送信
  sendSocketMessage('save_information_plan', dataToSend);
  
  console.log(`情報収集プラン保存リクエストを送信しました - ロールモデル: ${roleModelId}`);
}

/**
 * 情報収集プランを削除
 * @param roleModelId ロールモデルID
 * @param planId プランID
 */
export function deleteInformationPlan(roleModelId: string, planId: string): void {
  if (!roleModelId || !planId) {
    console.error('無効なパラメータ: roleModelIdまたはplanIdが空です');
    return;
  }
  
  // WebSocketで情報収集プラン削除リクエストを送信
  sendSocketMessage('delete_information_plan', {
    roleModelId,
    planId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`情報収集プラン削除リクエストを送信しました - ロールモデル: ${roleModelId}, プランID: ${planId}`);
}

/**
 * エージェントチャットメッセージを送信
 * @param roleModelId ロールモデルID
 * @param message メッセージ内容
 */
export function sendAgentChatMessage(roleModelId: string, message: string): void {
  if (!roleModelId || !message.trim()) {
    console.error('無効なパラメータ: roleModelIdまたはmessageが空です');
    return;
  }
  
  // WebSocketでメッセージを送信
  sendSocketMessage('agent_chat', {
    roleModelId,
    message,
    timestamp: new Date().toISOString(),
    clientId: `client-${Date.now()}`
  });
  
  console.log(`エージェントチャットメッセージを送信しました - ロールモデル: ${roleModelId}, メッセージ: ${message.substring(0, 30)}...`);
}

/**
 * エラーメッセージを送信
 * @param roleModelId ロールモデルID
 * @param message エラーメッセージ
 * @param details エラー詳細（オプション）
 */
export function sendErrorMessage(roleModelId: string, message: string, details: Record<string, any> = {}): void {
  if (!roleModelId || !message.trim()) {
    console.error('無効なパラメータ: roleModelIdまたはmessageが空です');
    return;
  }
  
  // WebSocketでエラーメッセージを送信
  sendSocketMessage('error', {
    roleModelId,
    message,
    details,
    timestamp: new Date().toISOString()
  });
  
  console.error(`エラーメッセージを送信しました - ロールモデル: ${roleModelId}, メッセージ: ${message}`);
}

/**
 * 完了メッセージを送信
 * @param roleModelId ロールモデルID
 * @param message 完了メッセージ
 * @param data 追加データ（オプション）
 */
export function sendCompletionMessage(roleModelId: string, message: string, data: Record<string, any> = {}): void {
  if (!roleModelId || !message.trim()) {
    console.error('無効なパラメータ: roleModelIdまたはmessageが空です');
    return;
  }
  
  // WebSocketで完了メッセージを送信
  sendSocketMessage('completion', {
    roleModelId,
    message,
    data,
    timestamp: new Date().toISOString()
  });
  
  console.log(`完了メッセージを送信しました - ロールモデル: ${roleModelId}, メッセージ: ${message}`);
}

/**
 * 進捗更新メッセージを送信
 * @param roleModelId ロールモデルID
 * @param progress 進捗率（0〜100）
 * @param message メッセージ内容
 * @param stage 進捗ステージ
 * @param subStage サブステージ
 */
export function sendProgressUpdate(
  roleModelId: string, 
  progress: number, 
  message: string, 
  stage: string = 'processing',
  subStage: string = ''
): void {
  if (!roleModelId) {
    console.error('無効なパラメータ: roleModelIdが空です');
    return;
  }
  
  // 進捗率を0〜100の範囲に制限
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  
  // WebSocketで進捗更新メッセージを送信
  sendSocketMessage('progress', {
    roleModelId,
    progress: normalizedProgress,
    message: message || `進捗: ${normalizedProgress}%`,
    stage,
    subStage,
    timestamp: new Date().toISOString()
  });
  
  console.log(`進捗更新メッセージを送信しました - ロールモデル: ${roleModelId}, 進捗: ${normalizedProgress}%, メッセージ: ${message}`);
}