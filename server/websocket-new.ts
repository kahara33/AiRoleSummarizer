import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

// WebSocketサーバーインスタンス
let wss: WebSocketServer;

// ロールモデルIDごとにクライアントを管理するマップ
const clients = new Map<string, Set<WebSocket>>();

/**
 * WebSocketメッセージの進捗更新データ型
 */
export type ProgressUpdateData = {
  message?: string;
  progress?: number;
  stage?: string;
  subStage?: string;
  roleModelId?: string;
  [key: string]: any;
};

/**
 * WebSocketサーバーの初期化
 * @param server HTTPサーバーインスタンス
 */
export function initWebSocket(server: HttpServer): void {
  try {
    // 既存のWSS接続があれば終了
    if (wss) {
      console.log('既存のWebSocketサーバーを終了します');
      try {
        wss.close();
      } catch (err) {
        console.error('WebSocketサーバーの終了中にエラーが発生しました:', err);
      }
    }
    
    // パスをAPIパスの下に変更 (/api/ws)
    wss = new WebSocketServer({ 
      server, 
      path: '/api/ws',
      // WebSocketサーバーのデバッグログを有効化
      clientTracking: true,
    });
    
    console.log('WebSocketサーバーが初期化されました (path: /api/ws)');
    
    wss.on('connection', (ws, req) => {
      try {
        // クエリパラメータからユーザー情報を取得
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId') || 'anonymous';
        const roleModelId = url.searchParams.get('roleModelId') || 'default';
        const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // WebSocketインスタンスにメタデータを付与
        (ws as any).userId = userId;
        (ws as any).roleModelId = roleModelId;
        (ws as any).clientId = clientId;
        (ws as any).isAlive = true;
        
        console.log(`新しいWebSocket接続: clientId=${clientId}, userId=${userId}, roleModelId=${roleModelId}`);
        
        // 接続時の処理 - 既存の接続を閉じてこの接続を優先する
        // 同じユーザーIDの既存接続を確認
        wss.clients.forEach((client) => {
          if (client !== ws && (client as any).userId === userId && (client as any).roleModelId === roleModelId) {
            console.log(`既存のWebSocket接続を閉じます: clientId=${(client as any).clientId}`);
            try {
              client.close(1000, '新しい接続が確立されました');
            } catch (closeError) {
              console.error(`既存接続の切断に失敗: ${closeError}`);
            }
          }
        });
        
        // ロールモデルIDで初期サブスクリプション
        if (roleModelId && roleModelId !== 'default') {
          if (!clients.has(roleModelId)) {
            clients.set(roleModelId, new Set());
          }
          clients.get(roleModelId)?.add(ws);
        }
        
        // 接続時の挨拶メッセージ
        try {
          ws.send(JSON.stringify({
            type: 'welcome',
            message: 'WebSocket接続が確立されました',
            clientId,
            userId,
            roleModelId,
            timestamp: new Date().toISOString()
          }));
        } catch (welcomeError) {
          console.error(`歓迎メッセージ送信エラー: ${welcomeError}`);
        }
        
        // クリーンアップと切断処理
        const cleanup = () => {
          try {
            // ユーザーのロールモデル購読からこのWebSocketを削除
            const userRoleModelId = (ws as any).roleModelId;
            if (userRoleModelId && clients.has(userRoleModelId)) {
              const clientSet = clients.get(userRoleModelId);
              if (clientSet) {
                clientSet.delete(ws);
                if (clientSet.size === 0) {
                  clients.delete(userRoleModelId);
                }
              }
            }
          } catch (cleanupError) {
            console.error(`WebSocket切断処理エラー: ${cleanupError}`);
          }
        };
        
        // pongイベントを監視して生存確認を更新
        ws.on('pong', () => {
          (ws as any).isAlive = true;
        });
        
        // 切断イベントのハンドリング
        ws.on('close', (code, reason) => {
          console.log(`WebSocket切断: clientId=${clientId}, code=${code}, reason=${reason}`);
          cleanup();
        });
        
        // メッセージ受信処理
        ws.on('message', (message) => {
          try {
            const msgStr = message.toString();
            
            // シンプルなping-pong処理
            if (msgStr === 'ping') {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
              }));
              return;
            }
            
            // JSON形式のメッセージを解析
            try {
              const data = JSON.parse(msgStr);
              console.log(`WebSocketメッセージ受信: type=${data.type}, roleModelId=${(ws as any).roleModelId}`);
              
              // pingメッセージの場合はpongですぐに応答
              if (data.type === 'ping') {
                console.log('Ping received from client');
                ws.send(JSON.stringify({
                  type: 'pong',
                  timestamp: new Date().toISOString(),
                  payload: data.payload // クライアントが送ったペイロードをそのまま返す
                }));
                return;
              }
              
              // メッセージの内容をログ
              console.log(`メッセージ受信: clientId=${clientId}, type=${data.type}`);
              
              // サブスクリプションメッセージの処理
              if (data.type === 'subscribe') {
                const specificRoleModelId = data.payload?.roleModelId || data.roleModelId;
                
                if (specificRoleModelId) {
                  console.log(`クライアントがロールモデル ${specificRoleModelId} を購読しました`);
                  
                  // 既存のロールモデルグループから削除
                  clients.forEach((clientSet, existingRoleModelId) => {
                    if (existingRoleModelId !== specificRoleModelId) {
                      clientSet.delete(ws);
                    }
                  });
                  
                  // 新しいロールモデルグループに追加
                  if (!clients.has(specificRoleModelId)) {
                    clients.set(specificRoleModelId, new Set());
                  }
                  
                  // クライアントをセットに追加
                  clients.get(specificRoleModelId)?.add(ws);
                  
                  // クライアントのカスタムプロパティを更新
                  (ws as any).roleModelId = specificRoleModelId;
                  
                  // 接続状態のログ出力
                  let totalClients = 0;
                  let modelInfo = '';
                  clients.forEach((clientSet, id) => {
                    if (clientSet.size > 0) {
                      totalClients += clientSet.size;
                      modelInfo += `${id}(${clientSet.size}件), `;
                    }
                  });
                  
                  console.log(`現在の接続状態: 合計${totalClients}件、モデル別: ${modelInfo || 'なし'}`);
                  
                  // クライアントにサブスクリプション確認を送信
                  try {
                    ws.send(JSON.stringify({
                      type: 'subscription_confirmed',
                      message: `ロールモデル ${specificRoleModelId} の購読を開始しました`,
                      roleModelId: specificRoleModelId,
                      timestamp: new Date().toISOString(),
                      status: 'success'
                    }));
                    
                    console.log(`サブスクリプション確認を送信: clientId=${clientId}`);
                  } catch (sendError) {
                    console.error(`サブスクリプション確認メッセージ送信エラー: ${sendError}`);
                  }
                } else {
                  console.log('サブスクリプションメッセージにroleModelIdが含まれていません');
                  try {
                    ws.send(JSON.stringify({
                      type: 'subscription_error',
                      message: 'roleModelIdが指定されていません',
                      timestamp: new Date().toISOString(),
                      status: 'error'
                    }));
                  } catch (sendError) {
                    console.error(`エラーメッセージ送信失敗: ${sendError}`);
                  }
                }
              }
              // agent_thoughtsメッセージの処理
              else if (data.type === 'agent_thoughts' || data.type === 'agent-thoughts') {
                const agentName = data.agentName || data.agent || data.payload?.agentName || data.payload?.agent || 'エージェント';
                const thought = data.thought || data.message || data.content || 
                               (data.payload ? (data.payload.thought || data.payload.message || data.payload.content) : '') || 
                               '思考内容が記録されませんでした';
                const specificRoleModelId = data.roleModelId || data.payload?.roleModelId || (ws as any).roleModelId;
                
                console.log(`エージェント思考メッセージを処理: ${agentName}`);
                
                // エージェント思考をブロードキャスト
                if (specificRoleModelId) {
                  sendAgentThoughts(agentName, thought, specificRoleModelId, data.payload || data);
                  
                  // 送信元クライアントに確認を返す
                  ws.send(JSON.stringify({
                    type: 'thought_received',
                    message: 'エージェント思考を受信しました',
                    agentName,
                    timestamp: new Date().toISOString()
                  }));
                }
              }
              // progressメッセージの処理
              else if (data.type === 'progress' || data.type === 'progress-update') {
                const message = data.message || data.payload?.message || data.stage || '';
                const progress = data.progress || data.payload?.progress || data.percent || data.payload?.percent || 0;
                const specificRoleModelId = data.roleModelId || data.payload?.roleModelId || (ws as any).roleModelId;
                
                console.log(`進捗更新メッセージを処理: ${progress}%`);
                
                // 進捗更新をブロードキャスト
                if (specificRoleModelId) {
                  sendProgressUpdate(message, progress, specificRoleModelId, data.payload || data);
                  
                  // 送信元クライアントに確認を返す
                  ws.send(JSON.stringify({
                    type: 'progress_received',
                    message: '進捗更新を受信しました',
                    progress,
                    timestamp: new Date().toISOString()
                  }));
                }
              }
              // 知識グラフ更新メッセージの処理
              else if (data.type === 'knowledge_graph_update' || data.type === 'knowledge-graph-update' || data.type === 'graph-update') {
                const specificRoleModelId = data.roleModelId || data.payload?.roleModelId || (ws as any).roleModelId;
                
                console.log(`知識グラフ更新メッセージを処理: ${specificRoleModelId}`);
                
                // データの準備 - ペイロードまたはデータ本体のどちらかから取得
                const payload = data.payload || data;
                const nodes = payload.nodes || [];
                const edges = payload.edges || [];
                
                // 知識グラフ更新をブロードキャスト
                if (specificRoleModelId) {
                  sendKnowledgeGraphUpdate(
                    specificRoleModelId, 
                    { nodes, edges },
                    payload.updateType || 'update',
                    payload
                  );
                  
                  // 送信元クライアントに確認を返す
                  ws.send(JSON.stringify({
                    type: 'graph_update_received',
                    message: '知識グラフ更新を受信しました',
                    timestamp: new Date().toISOString()
                  }));
                }
              }
              // 未知のメッセージタイプの場合
              else if (data.type && data.type !== 'ping') {
                console.log(`その他のメッセージタイプ: ${data.type}`);
                
                // エージェント思考っぽいメッセージは特別に処理
                if (data.type.includes('agent') || data.type.includes('thought') || data.type.includes('thinking')) {
                  const agentName = data.agentName || data.agent || 'エージェント';
                  const thought = data.thought || data.message || data.content || data.payload || '思考内容が記録されませんでした';
                  const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                  
                  console.log(`特殊なエージェント思考メッセージを処理: ${agentName}`);
                  
                  // エージェント思考をブロードキャスト
                  if (specificRoleModelId) {
                    // エージェント思考を他のクライアントにも送信
                    sendAgentThoughts(agentName, thought, specificRoleModelId, data);
                    
                    // 送信元クライアントに確認を返す
                    ws.send(JSON.stringify({
                      type: 'thought_received',
                      message: 'エージェント思考を受信しました',
                      agentName,
                      timestamp: new Date().toISOString()
                    }));
                  }
                }
                else {
                  // 汎用的な確認メッセージを送信
                  try {
                    ws.send(JSON.stringify({
                      type: 'message_received',
                      message: `メッセージタイプ '${data.type}' を受信しました`,
                      originalType: data.type,
                      timestamp: new Date().toISOString()
                    }));
                  } catch (sendError) {
                    console.error(`確認メッセージ送信エラー: ${sendError}`);
                  }
                }
              }
            } catch (jsonError) {
              console.error('JSONメッセージの解析に失敗:', jsonError);
            }
          } catch (messageError) {
            console.error(`WebSocketメッセージ処理エラー: ${messageError}`);
          }
        });
        
        // エラー処理
        ws.on('error', (error) => {
          console.error(`WebSocketクライアントエラー: ユーザーID=${userId}, エラー=${error.message}`);
        });
      } catch (connectionError) {
        console.error(`WebSocket接続処理エラー: ${connectionError}`);
        try {
          ws.close(1011, 'Server error during connection setup');
        } catch (closeError) {
          console.error(`WebSocket切断エラー: ${closeError}`);
        }
      }
    });
    
    // 定期的なクライアント生存確認
    const interval = setInterval(() => {
      try {
        wss.clients.forEach((ws) => {
          const wsExt = ws as any;
          if (wsExt.isAlive === false) {
            // 前回のping時点で応答がなかった場合、切断
            console.log(`非応答WebSocketを終了: ${wsExt.userId || 'unknown'}`);
            return ws.terminate();
          }
          
          // 生存確認をfalseに設定（pongで更新される）
          wsExt.isAlive = false;
          // ping送信
          ws.ping();
        });
      } catch (pingError) {
        console.error(`WebSocket ping処理エラー: ${pingError}`);
      }
    }, 30000); // 30秒ごとに実行
    
    // サーバーが閉じたらintervalをクリア
    wss.on('close', () => {
      clearInterval(interval);
      console.log('WebSocketサーバーの生存確認がクリアされました');
    });
    
    console.log('WebSocketサーバーが初期化されました');
  } catch (initError) {
    console.error('WebSocketサーバー初期化エラー:', initError);
    // サーバー全体はクラッシュさせず、WebSocket機能だけ無効化
  }
}

/**
 * 特定のロールモデルに対して進捗状況の更新を送信
 * @param message メッセージ文字列
 * @param progress 進捗率（0-100）
 * @param roleModelId ロールモデルID
 * @param detailedData 詳細な進捗データ
 */
export function sendProgressUpdate(
  messageOrData: string | ProgressUpdateData,
  progress?: number,
  roleModelId?: string,
  detailedData?: ProgressUpdateData
): void {
  // 古いシグネチャとの互換性のために入力パラメータをチェック
  let message: string;
  let progressValue: number;
  let roleModelIdValue: string;
  let detailedDataValue: ProgressUpdateData | undefined;
  
  // オブジェクト形式で呼び出された場合
  if (typeof messageOrData === 'object') {
    const data = messageOrData as ProgressUpdateData;
    message = data.message || '';
    progressValue = data.progress !== undefined ? data.progress : 0;
    roleModelIdValue = data.roleModelId || '';
    detailedDataValue = data;
  } else {
    // 従来の個別パラメータ形式で呼び出された場合
    message = messageOrData;
    progressValue = progress !== undefined ? progress : 0;
    roleModelIdValue = roleModelId || '';
    detailedDataValue = detailedData;
  }
  
  // ロールモデルIDが未定義の場合は処理を中止
  if (!roleModelIdValue) {
    console.log('ロールモデルIDが指定されていないため、進捗更新を送信できません');
    return;
  }
  const clientSet = clients.get(roleModelIdValue);
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelIdValue} に接続されたクライアントはありません`);
    return;
  }

  // 進捗を0-100の範囲に制限
  const normalizedProgress = Math.min(100, Math.max(0, progressValue));
  
  // データの統合（複数のクライアントライブラリでの互換性を確保）
  const data = {
    type: 'progress',
    message,
    progress: normalizedProgress,
    progress_update: normalizedProgress, // 後方互換性のため
    roleModelId: roleModelIdValue,
    timestamp: new Date().toISOString(),
    stage: detailedDataValue?.stage || 'processing',
    subStage: detailedDataValue?.subStage || '',
    ...(detailedDataValue || {})
  };

  // 標準メッセージ形式のJSONを生成
  const message_json = JSON.stringify(data);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  // 冗長なログは出力しない（進捗が5%以上変化した場合のみ出力）
  if (normalizedProgress % 5 === 0 || normalizedProgress === 100) {
    console.log(`進捗更新を送信: ${roleModelIdValue}, ${normalizedProgress}%, "${message}"`);
  }
}

/**
 * 特定のロールモデルに対してエラーメッセージを送信
 * @param message エラーメッセージ
 * @param roleModelId ロールモデルID
 * @param errorDetails エラー詳細
 */
export function sendErrorMessage(
  message: string,
  roleModelId: string,
  errorDetails?: any
): void {
  const clientSet = clients.get(roleModelId);
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
    return;
  }

  // データの統合（複数のクライアントライブラリでの互換性を確保）
  const data = {
    type: 'error',
    message,
    error: message, // 後方互換性のため
    roleModelId,
    timestamp: new Date().toISOString(),
    details: errorDetails,
    // 進捗表示をリセットするためのフィールド（兼用クライアント対応）
    progress: 0,
    progress_update: 0,
    stage: 'error',
    subStage: errorDetails?.subStage || ''
  };

  const message_json = JSON.stringify(data);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.error(`エラーメッセージを送信: ${roleModelId}, "${message}"`);
}

/**
 * 特定のロールモデルに対して完了メッセージを送信
 * @param message 完了メッセージ
 * @param roleModelId ロールモデルID
 * @param data 追加データ
 */
export function sendCompletionMessage(
  message: string,
  roleModelId: string,
  data?: any
): void {
  const clientSet = clients.get(roleModelId);
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
    return;
  }

  // データの統合（複数のクライアントライブラリでの互換性を確保）
  const payload = {
    type: 'completion',
    message,
    roleModelId,
    timestamp: new Date().toISOString(),
    // 進捗表示を100%に設定（兼用クライアント対応）
    progress: 100,
    progress_update: 100,
    stage: 'complete',
    subStage: data?.subStage || '',
    data
  };

  const message_json = JSON.stringify(payload);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.log(`完了メッセージを送信: ${roleModelId}, "${message}"`);
  
  // 進捗更新メッセージとしても送信（代替クライアント対応）
  sendProgressUpdate(message, 100, roleModelId, {
    message,
    progress: 100,
    stage: 'complete',
    subStage: data?.subStage || ''
  });
}

/**
 * エージェントの思考プロセスを送信する関数
 * @param agentName エージェント名
 * @param thoughts 思考内容
 * @param roleModelId ロールモデルID
 * @param detailedData 詳細なデータ
 */
export function sendAgentThoughts(
  agentName: string,
  thoughts: string,
  roleModelId: string,
  detailedData?: any
): void {
  const clientSet = clients.get(roleModelId);
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
    return;
  }

  // クライアントの互換性のためのデータ統合
  const data = {
    type: 'agent_thoughts', // クライアント側が 'agent_thoughts'として処理するために修正
    agent_thoughts: true, // 後方互換性のため
    agent_thought: true, // 別の互換性形式
    agentName,
    agent: agentName, // 後方互換性のため
    agentType: detailedData?.agentType || 'PlannerAgent', // 後方互換性のため
    thoughts,
    thought: thoughts, // 後方互換性のため
    message: thoughts, // 後方互換性のため
    content: thoughts, // 後方互換性のため
    thinking: detailedData?.thinking || [{
      step: detailedData?.subStage || 'thinking',
      content: thoughts,
      timestamp: new Date().toISOString()
    }],
    roleModelId,
    timestamp: new Date().toISOString(),
    ...detailedData
  };

  const message_json = JSON.stringify(data);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.log(`エージェント思考を送信: ${roleModelId}, ${agentName}, "${thoughts.substring(0, 50)}..."`);
}

/**
 * 全てのロールモデルクライアントに対してメッセージを送信する関数
 * @param message メッセージ
 * @param type メッセージタイプ
 * @param data 追加データ
 */
export function sendMessageToRoleModelViewers(
  message: string,
  type: string = 'info',
  data?: any
): void {
  // 特定のロールモデルIDに対してのみ送信する場合
  const specificRoleModelId = data?.roleModelId;
  
  // 接続されているクライアントが存在するかチェック
  let activeClientsCount = 0;
  
  if (specificRoleModelId) {
    // 特定のロールモデルIDに対してのみチェック
    const clientSet = clients.get(specificRoleModelId);
    activeClientsCount = clientSet?.size || 0;
    
    if (activeClientsCount === 0) {
      console.log(`ロールモデル ${specificRoleModelId} に接続されたクライアントはありません`);
    }
  } else {
    // すべてのクライアントをチェック
    clients.forEach((clientSet) => {
      activeClientsCount += clientSet.size;
    });
  }
  
  // 接続されているクライアントがない場合
  if (activeClientsCount === 0) {
    console.log(`接続されているクライアントがないため、メッセージを送信できません: "${message}"`);
    
    // 知識グラフ更新の場合は特別なログを出力
    if (type === 'knowledge_graph_update' || type === 'knowledge-graph-update' || type === 'graph-update') {
      console.log('知識グラフが更新されました。クライアント再接続時に最新データが取得されます。');
      
      // データベースに保存されたことを確認する追加ログ
      if (data?.nodes?.length) {
        console.log(`知識グラフ更新の詳細: ${data.nodes.length}ノード, ${data.edges?.length || 0}エッジ`);
      }
    }
    
    return;
  }

  // すべてのロールモデルクライアントを取得
  clients.forEach((clientSet, roleModelId) => {
    if (clientSet.size === 0) return;

    const payload = {
      type,
      message,
      roleModelId,
      timestamp: new Date().toISOString(),
      ...data
    };

    const message_json = JSON.stringify(payload);

    // クライアントに送信
    clientSet.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message_json);
        } catch (error) {
          console.error(`クライアントへのメッセージ送信エラー: ${error}`);
        }
      }
    });
  });

  console.log(`${activeClientsCount}個のクライアントにメッセージを送信: "${message}"`);
}

/**
 * 部分的なナレッジグラフ更新を送信する関数（段階的な構築用）
 * @param roleModelId ロールモデルID
 * @param partialData 部分的なグラフデータ（段階的に追加されるノードとエッジ）
 * @param agentName データを生成したエージェント名
 */
export function sendPartialGraphUpdate(
  roleModelId: string,
  partialData: { nodes: any[], edges: any[] },
  agentName: string = '不明なエージェント'
): void {
  // 部分更新用の専用updateTypeを使用
  sendKnowledgeGraphUpdate(roleModelId, partialData, 'partial', {
    agentName,
    timestamp: new Date().toISOString(),
    partial: true,
    message: `${agentName}がナレッジグラフを部分的に更新しました`
  });
}

/**
 * 知識グラフ更新メッセージを送信する関数
 * @param roleModelId ロールモデルID
 * @param graphData 知識グラフデータ（ノードとエッジの配列）
 * @param updateType 更新タイプ（'create', 'update', 'delete', 'partial'）
 * @param additionalData 追加データ（オプション）
 */
export function sendKnowledgeGraphUpdate(
  roleModelId: string,
  graphData: { nodes: any[], edges: any[] },
  updateType: 'create' | 'update' | 'delete' | 'partial' | 'complete' = 'update',
  additionalData: any = {}
): void {
  const clientSet = clients.get(roleModelId);
  
  // 複数形式でのメッセージタイプ（クライアントの互換性確保のため）
  const messageTypes = [
    'knowledge_graph_update',
    'knowledge-graph-update',
    'graph-update'
  ];
  
  // 詳細ログ - 接続クライアント
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
    console.log(`接続されているクライアントがないため、メッセージを送信できません: "${roleModelId}"`);
    console.log('知識グラフが更新されました。クライアント再接続時に最新データが取得されます。');
    return;
  }
  
  // データの準備
  const basePayload = {
    roleModelId,
    timestamp: new Date().toISOString(),
    message: `知識グラフが${updateType === 'create' ? '作成' : updateType === 'update' ? '更新' : updateType === 'partial' ? '部分的に更新' : '削除'}されました`,
    ...additionalData,
    updateType,
    ...graphData
  };
  
  // 各タイプでメッセージを送信（クライアントの互換性確保のため）
  messageTypes.forEach(type => {
    // typeフィールドをこのレベルに含めると、クライアント側のコードで
    // data.type で参照できるためブラウザコンソールに表示される
    const payload = {
      type,
      payload: {
        ...basePayload,
        updateType: updateType,
        isComplete: updateType === 'create' || updateType === 'complete' || updateType === 'update',
        isPartial: updateType === 'partial',
        roleModelId,
        timestamp: new Date().toISOString()
      }
    };
    
    const message_json = JSON.stringify(payload);
    
    // 該当ロールモデルに接続されているすべてのクライアントに送信
    clientSet.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message_json);
        } catch (error) {
          console.error(`知識グラフ更新メッセージ送信エラー: ${error}`);
        }
      }
    });
  });
  
  console.log(`知識グラフ更新を送信: roleModelId=${roleModelId}, updateType=${updateType}, nodes=${graphData.nodes.length}, edges=${graphData.edges.length}`);
}

/**
 * WebSocketサーバーを終了
 */
export function closeWebSocketServer(): void {
  try {
    if (wss) {
      wss.close();
      console.log('WebSocketサーバーを終了しました');
    }
  } catch (error) {
    console.error(`WebSocketサーバー終了エラー: ${error}`);
  }
}