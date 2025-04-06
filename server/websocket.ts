import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifySession } from './auth';
import { parse as parseCookie } from 'cookie';
import { randomUUID } from 'crypto';

// WebSocketServerのインスタンス
let wss: WebSocketServer;

// ロールモデルIDごとのクライアント接続を追跡
const clients: Map<string, Set<WebSocket>> = new Map();

// 進捗更新の型
export type ProgressUpdateData = {
  message: string;
  progress: number;
  stage: string;
  subStage: string;
};

/**
 * WebSocketサーバーの初期化
 * @param server HTTPサーバーインスタンス
 */
export function initWebSocket(server: HttpServer): void {
  try {
    // WebSocketServerの作成
    wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      clientTracking: true, // クライアントを追跡
      perMessageDeflate: { // パフォーマンス向上のための圧縮設定
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        threshold: 1024 // 1KB以上のメッセージのみ圧縮
      }
    });

    // サーバーエラーイベントのハンドリング
    wss.on('error', (error) => {
      console.error('WebSocketサーバーエラー:', error);
      // サーバー全体はクラッシュさせず、ログだけ出力
    });

    // サーバーのヘッダー検証エラーイベントのハンドリング
    wss.on('headers', (headers, request) => {
      // ヘッダー処理のデバッグログ（必要に応じてコメントアウト）
      // console.log('WebSocket接続ヘッダー:', headers);
    });

    // 接続イベントのハンドリング
    wss.on('connection', async (ws, req) => {
      // 接続のタイムアウト設定（30秒）
      ws.on('pong', () => {
        (ws as any).isAlive = true; // 生存確認
      });

      // セッションの検証
      try {
        const cookies = parseCookie(req.headers.cookie || '');
        const sessionId = cookies['connect.sid'] || '';
        
        let userId: string | null = null;
        
        if (sessionId) {
          userId = await verifySession(sessionId);
        }

        // 本番環境以外では認証をスキップ
        if (process.env.NODE_ENV !== 'production' && !userId) {
          console.log('開発環境: WebSocket認証をスキップします');
          userId = 'development-user-id';
        } else if (!userId) {
          // 認証されていない場合は接続を閉じる
          console.log('認証されていないWebSocket接続を閉じます');
          ws.close(1008, 'Unauthorized');
          return;
        }

        // URLパラメータからロールモデルIDを取得
        const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
        const roleModelId = urlParams.get('roleModelId');

        if (!roleModelId) {
          // ロールモデルIDが指定されていない場合は接続を閉じる
          console.log('ロールモデルIDが指定されていないWebSocket接続を閉じます');
          ws.close(1008, 'Missing roleModelId');
          return;
        }

        // ロールモデルIDに対応するクライアント集合を取得または作成
        if (!clients.has(roleModelId)) {
          clients.set(roleModelId, new Set());
        }
        clients.get(roleModelId)?.add(ws);

        // カスタムプロパティを追加（TypeScriptでの型対応のためany型を使用）
        (ws as any).userId = userId;
        (ws as any).roleModelId = roleModelId;
        (ws as any).isAlive = true;
        (ws as any).connectionTime = new Date();

        console.log(`WebSocket接続完了: ユーザーID=${userId}, ロールモデルID=${roleModelId}`);

        // 接続確認メッセージを送信
        try {
          ws.send(JSON.stringify({
            type: 'connection',
            message: '接続が確立されました',
            roleModelId,
            timestamp: new Date().toISOString()
          }));
        } catch (sendError) {
          console.error(`接続確認メッセージ送信エラー: ${sendError}`);
        }

        // クライアント切断時の処理
        ws.on('close', (code, reason) => {
          try {
            const clientSet = clients.get(roleModelId);
            if (clientSet) {
              clientSet.delete(ws);
              // クライアント集合が空になった場合、Mapからエントリを削除
              if (clientSet.size === 0) {
                clients.delete(roleModelId);
              }
            }
            console.log(`WebSocket接続終了: ユーザーID=${userId}, ロールモデルID=${roleModelId}, コード=${code}, 理由=${reason}`);
          } catch (cleanupError) {
            console.error(`WebSocket切断処理エラー: ${cleanupError}`);
          }
        });

        // メッセージイベントのハンドリング
        ws.on('message', (message) => {
          try {
            // クライアントからのメッセージ処理
            const msgStr = message.toString();
            
            // シンプルなping-pong処理
            if (msgStr === 'ping') {
              ws.send('pong');
              return;
            }
            
            // JSON形式のメッセージを解析
            try {
              const data = JSON.parse(msgStr);
              console.log('WebSocketメッセージを受信:', data.type);
              
              // サブスクリプションメッセージの処理
              if (data.type === 'subscribe') {
                const specificRoleModelId = data.payload?.roleModelId;
                
                if (specificRoleModelId && specificRoleModelId !== 'default') {
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
                  clients.get(specificRoleModelId)?.add(ws);
                  
                  // クライアントにサブスクリプション確認を送信
                  try {
                    ws.send(JSON.stringify({
                      type: 'subscription_confirmed',
                      message: `ロールモデル ${specificRoleModelId} の購読を開始しました`,
                      roleModelId: specificRoleModelId,
                      timestamp: new Date().toISOString()
                    }));
                  } catch (sendError) {
                    console.error(`サブスクリプション確認メッセージ送信エラー: ${sendError}`);
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
          console.error(`WebSocketクライアントエラー: ユーザーID=${userId}, ロールモデルID=${roleModelId}, エラー=${error.message}`);
          // エラーが発生しても接続は自動的に閉じない（クライアント側で処理させる）
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
  message: string,
  progress: number,
  roleModelId: string,
  detailedData?: ProgressUpdateData
): void {
  const clientSet = clients.get(roleModelId);
  if (!clientSet || clientSet.size === 0) {
    console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
    return;
  }

  // 進捗を0-100の範囲に制限
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  
  // データの統合（複数のクライアントライブラリでの互換性を確保）
  const data = {
    type: 'progress',
    message,
    progress: normalizedProgress,
    progress_update: normalizedProgress, // 後方互換性のため
    roleModelId,
    timestamp: new Date().toISOString(),
    stage: detailedData?.stage || 'processing',
    subStage: detailedData?.subStage || '',
    ...detailedData
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
  if (progress % 5 === 0 || progress === 100) {
    console.log(`進捗更新を送信: ${roleModelId}, ${normalizedProgress}%, "${message}"`);
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
    type: 'agent-thoughts',
    agent_thoughts: true, // 後方互換性のため
    agentName,
    agent: agentName, // 後方互換性のため
    agent_type: detailedData?.agentType || 'PlannerAgent',
    thoughts,
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
  // 接続されているクライアントが存在するかチェック
  let activeClientsCount = 0;
  clients.forEach((clientSet) => {
    activeClientsCount += clientSet.size;
  });
  
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
 * 知識グラフ更新メッセージを送信する関数
 * @param roleModelId ロールモデルID
 * @param graphData 知識グラフデータ（ノードとエッジの配列）
 * @param updateType 更新タイプ（'create', 'update', 'delete'）
 */
export function sendKnowledgeGraphUpdate(
  roleModelId: string,
  graphData: { nodes: any[], edges: any[] },
  updateType: 'create' | 'update' | 'delete' = 'update'
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
    console.log(`知識グラフデータ（${graphData.nodes.length}ノード、${graphData.edges.length}エッジ）は保存されました`);
    console.log('クライアントが接続された時点で最新データが利用可能になります');
    return;
  }
  
  // データの準備
  const basePayload = {
    roleModelId,
    timestamp: new Date().toISOString(),
    message: `知識グラフが${updateType === 'create' ? '作成' : updateType === 'update' ? '更新' : '削除'}されました`,
    updateType,
    ...graphData
  };
  
  // 各タイプでメッセージを送信（クライアントの互換性確保のため）
  messageTypes.forEach(type => {
    const payload = {
      ...basePayload,
      type
    };
    
    const message_json = JSON.stringify(payload);
    
    // 接続されているすべてのクライアントに送信
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
  
  console.log(`知識グラフ更新を送信: ${roleModelId}, ${graphData.nodes.length}ノード, ${graphData.edges.length}エッジ`);
}

/**
 * WebSocketサーバーを終了
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close();
    console.log('WebSocketサーバーが終了しました');
  }
}