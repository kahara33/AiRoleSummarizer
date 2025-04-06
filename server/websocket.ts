import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifySession } from './auth';
import { parse as parseCookie } from 'cookie';

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
  // WebSocketServerの作成
  wss = new WebSocketServer({ server, path: '/ws' });

  // 接続イベントのハンドリング
  wss.on('connection', async (ws, req) => {
    // セッションの検証
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

    console.log(`WebSocket接続完了: ユーザーID=${userId}, ロールモデルID=${roleModelId}`);

    // 接続確認メッセージを送信
    ws.send(JSON.stringify({
      type: 'connection',
      message: '接続が確立されました',
      roleModelId
    }));

    // クライアント切断時の処理
    ws.on('close', () => {
      const clientSet = clients.get(roleModelId);
      if (clientSet) {
        clientSet.delete(ws);
        // クライアント集合が空になった場合、Mapからエントリを削除
        if (clientSet.size === 0) {
          clients.delete(roleModelId);
        }
      }
      console.log(`WebSocket接続終了: ユーザーID=${userId}, ロールモデルID=${roleModelId}`);
    });

    // エラー処理
    ws.on('error', (error) => {
      console.error(`WebSocketエラー: ${error.message}`);
    });
  });

  console.log('WebSocketサーバーが初期化されました');
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
        client.send(message_json);
      }
    });
  });

  console.log(`全クライアントにメッセージを送信: "${message}"`);
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
 * WebSocketサーバーを終了
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close();
    console.log('WebSocketサーバーが終了しました');
  }
}