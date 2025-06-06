import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifySession } from './auth';
import { parse as parseCookie } from 'cookie';
import { randomUUID } from 'crypto';
import { sendExistingKnowledgeGraph } from './knowledge-graph-service';

// WebSocketServerのインスタンス
let wss: WebSocketServer;

// ロールモデルIDごとのクライアント接続を追跡
const clients: Map<string, Set<WebSocket>> = new Map();

// 進捗更新の型
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
    console.log('WebSocketサーバーを初期化しています...');
    
    // WebSocketServerを作成
    wss = new WebSocketServer({ 
      noServer: true,
      clientTracking: true
    });
    
    // HTTP Upgradeイベントをハンドリング
    server.on('upgrade', (request, socket, head) => {
      try {
        // WebSocketサーバーにアップグレードリクエストを委譲
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (upgradeError) {
        console.error('WebSocketアップグレードエラー:', upgradeError);
        socket.destroy();
      }
    });
    
    // 接続イベントのハンドリング
    wss.on('connection', (ws, req) => {
      try {
        // クエリパラメータの解析
        const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
        const userId = urlParams.get('userId');
        const roleModelId = urlParams.get('roleModelId');
        
        // ユーザーIDが指定されていない場合は接続を閉じる
        if (!userId) {
          console.log('ユーザーIDが指定されていないWebSocket接続を閉じます');
          ws.close(1008, 'Missing userId');
          return;
        }
        
        // クライアント識別子を生成
        const clientId = `${userId}-${Date.now()}-${randomUUID().substring(0, 8)}`;
        (ws as any).clientId = clientId;
        
        // ロールモデルIDが指定されている場合は設定
        if (roleModelId) {
          (ws as any).roleModelId = roleModelId;
          
          if (!clients.has(roleModelId)) {
            clients.set(roleModelId, new Set());
          }
          clients.get(roleModelId)?.add(ws);
          
          console.log(`新しいWebSocket接続: clientId=${clientId}, userId=${userId}, roleModelId=${roleModelId}`);
        } else {
          console.log(`新しいWebSocket接続: clientId=${clientId}, userId=${userId}, roleModelIdなし`);
        }
        
        // Cookie認証情報の取得（オプション）
        let authVerified = false;
        if (req.headers.cookie) {
          try {
            const cookies = parseCookie(req.headers.cookie);
            if (cookies.sessionId) {
              authVerified = verifySession(cookies.sessionId, userId);
            }
          } catch (cookieError) {
            console.error('Cookie解析エラー:', cookieError);
            // 認証エラーでも接続は許可（セキュリティレベルに応じて変更可）
          }
        }
        
        // ws.isAliveフラグを設定
        (ws as any).isAlive = true;
        
        // pongイベントを監視して生存確認を更新
        ws.on('pong', () => {
          (ws as any).isAlive = true;
        });
        
        // 切断イベントのハンドリング
        ws.on('close', () => {
          console.log(`WebSocket切断: clientId=${clientId}`);
          cleanup();
        });
        
        // 切断処理のクリーンアップ関数
        const cleanup = () => {
          try {
            // ユーザーのロールモデル購読からこのWebSocketを削除
            const roleModelId = (ws as any).roleModelId;
            if (roleModelId && clients.has(roleModelId)) {
              const clientSet = clients.get(roleModelId);
              if (clientSet) {
                clientSet.delete(ws);
                console.log(`切断されたクライアントをロールモデル ${roleModelId} から削除しました`);
                
                // クライアントがいなくなった場合はマップからエントリを削除
                if (clientSet.size === 0) {
                  clients.delete(roleModelId);
                  console.log(`空のロールモデル ${roleModelId} をクライアントマップから削除しました`);
                }
              }
            }
          } catch (cleanupError) {
            console.error(`WebSocket切断処理エラー: ${cleanupError}`);
          }
        };

        // メッセージイベントのハンドリング
        ws.on('message', (message) => {
          try {
            // クライアントからのメッセージ処理
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
              const clientId = (ws as any).clientId || 'unknown';
              console.log(`メッセージ受信: clientId=${clientId}, type=${data.type}`);
              
              // サブスクリプションメッセージの処理
              if (data.type === 'subscribe') {
                // roleModelIdをペイロードから取得（複数の形式に対応）
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
                    
                    console.log(`サブスクリプション確認を送信: clientId=${(ws as any).clientId || 'unknown'}`);
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
              // エージェント思考メッセージの処理
              else if (data.type === 'agent_thoughts' || data.type === 'agent_thought' || data.type === 'thought') {
                const agentName = data.agentName || data.agent || 'エージェント';
                const thought = data.thought || data.message || data.content || data.payload || '思考内容が記録されませんでした';
                const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                
                console.log(`エージェント思考メッセージを処理: ${agentName}`);
                
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
              // 進捗更新メッセージの処理
              else if (data.type === 'progress' || data.type === 'progress_update' || data.type === 'crewai_progress') {
                const message = data.message || data.stage || '';
                const progress = data.progress || data.percent || 0;
                const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                
                console.log(`進捗更新メッセージを処理: ${progress}%`);
                
                // 進捗更新をブロードキャスト
                if (specificRoleModelId) {
                  // 進捗更新を他のクライアントにも送信
                  sendProgressUpdate(message, progress, specificRoleModelId, data);
                  
                  // 送信元クライアントに確認を返す
                  ws.send(JSON.stringify({
                    type: 'progress_received',
                    message: '進捗更新を受信しました',
                    progress,
                    timestamp: new Date().toISOString()
                  }));
                }
              }
              // チャットメッセージの処理
              else if (data.type === 'chat_message') {
                console.log(`チャットメッセージを受信しました`);
                
                const message = data.message || '';
                const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                
                if (!message) {
                  console.log('チャットメッセージが空です');
                  return;
                }
                
                if (specificRoleModelId) {
                  // マルチエージェント思考プロセスのシミュレーション
                  console.log(`チャットメッセージをサーバーで処理: roleModelId=${specificRoleModelId}, message="${message.substring(0, 50)}..."`);
                  
                  // Orchestratorエージェントの思考を送信
                  setTimeout(() => {
                    sendAgentThoughts(
                      'Orchestrator', 
                      `質問「${message}」を受け取りました。分析を開始します。`, 
                      specificRoleModelId,
                      { agentType: 'orchestrator' }
                    );
                  }, 500);
                  
                  // AnalyzerAgentの思考を送信
                  setTimeout(() => {
                    sendAgentThoughts(
                      'AnalyzerAgent', 
                      `質問を解析しています: 「${message}」\n\nこの質問は知識グラフの構造に関連していると判断しました。`, 
                      specificRoleModelId,
                      { agentType: 'analyzer' }
                    );
                  }, 1500);
                  
                  // 進捗更新を送信
                  setTimeout(() => {
                    sendProgressUpdate(
                      '情報収集を実行中...', 
                      25, 
                      specificRoleModelId
                    );
                  }, 2500);
                  
                  // ResearcherAgentの思考を送信
                  setTimeout(() => {
                    sendAgentThoughts(
                      'ResearcherAgent', 
                      `関連情報を収集しています。\n\n・ナレッジグラフは知識の構造化に有効\n・複数のエージェントが協調して処理`, 
                      specificRoleModelId,
                      { agentType: 'researcher' }
                    );
                  }, 3500);
                  
                  // 別の進捗更新を送信
                  setTimeout(() => {
                    sendProgressUpdate(
                      '情報の構造化を実行中...', 
                      55, 
                      specificRoleModelId
                    );
                  }, 4500);
                  
                  // DomainExpertAgentの思考を送信
                  setTimeout(() => {
                    sendAgentThoughts(
                      'DomainExpertAgent', 
                      `専門的な視点からの分析:\n\nマルチエージェントシステムは複数のAIが連携して効率的に問題解決を行うアーキテクチャです。`, 
                      specificRoleModelId,
                      { agentType: 'domain_expert' }
                    );
                  }, 5500);
                  
                  // 最終進捗更新を送信
                  setTimeout(() => {
                    sendProgressUpdate(
                      '回答の生成中...', 
                      85, 
                      specificRoleModelId
                    );
                  }, 6500);
                  
                  // 最終的な応答を生成
                  setTimeout(() => {
                    const response = `あなたの質問「${message}」に関する回答です。マルチエージェントシステムを使用して分析した結果、この質問に対する答えは...\n\n知識グラフは情報の関連性を視覚化し、複数のAIエージェントがそれぞれの専門知識を活かして協調的に問題を解決します。`;
                    
                    // チャット応答をブロードキャスト
                    sendMessageToRoleModelViewers(response, 'chat_message', {
                      roleModelId: specificRoleModelId
                    });
                    
                    // 進捗の完了を送信
                    sendProgressUpdate(
                      'チャット応答の生成が完了しました。', 
                      100, 
                      specificRoleModelId
                    );
                  }, 7500);
                  
                  // 送信元クライアントに確認を返す
                  ws.send(JSON.stringify({
                    type: 'chat_received',
                    message: 'チャットメッセージを受信して処理中です',
                    timestamp: new Date().toISOString()
                  }));
                }
              }
              // 知識グラフ関連メッセージの処理
              else if (data.type === 'knowledge_graph_update' || data.type === 'knowledge-graph-update' || data.type === 'graph-update') {
                const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                console.log(`知識グラフ更新メッセージを受信: roleModelId=${specificRoleModelId}`);
                
                if (specificRoleModelId && data.nodes && data.edges) {
                  // 知識グラフ更新を他のクライアントにも送信
                  sendKnowledgeGraphUpdate(
                    specificRoleModelId,
                    { nodes: data.nodes, edges: data.edges },
                    data.updateType || 'update',
                    data
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
                console.log(`未処理のメッセージタイプ: ${data.type}`);
                
                // エージェント思考っぽいメッセージは特別に処理
                if (data.type.includes('agent') || data.type.includes('thought') || data.type.includes('thinking')) {
                  const agentName = data.agentName || data.agent || 'エージェント';
                  const thought = data.thought || data.message || data.content || data.payload || '思考内容が記録されませんでした';
                  const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
                  
                  console.log(`未知の形式のエージェント思考メッセージを処理: ${agentName}`);
                  
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
    console.log(`知識グラフデータ（${graphData.nodes.length}ノード、${graphData.edges.length}エッジ）は保存されました`);
    console.log('クライアントが接続された時点で最新データが利用可能になります');
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
    
    console.log(`知識グラフ更新メッセージ送信: タイプ=${type}, ノード数=${graphData.nodes.length}, エッジ数=${graphData.edges.length}`);
    
    // 接続されているすべてのクライアントに送信
    let sentCount = 0;
    clientSet.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message_json);
          sentCount++;
        } catch (sendError) {
          console.error(`知識グラフ更新メッセージ送信エラー: ${sendError}`);
        }
      }
    });
    
    console.log(`知識グラフ更新メッセージを${sentCount}個のクライアントに送信完了`);
  });
}

/**
 * WebSocketサーバーを終了
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close();
  }
}