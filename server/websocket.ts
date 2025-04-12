/**
 * WebSocket通信の実装
 * マルチエージェント対話と知識グラフの更新通知を行う
 */
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifySession } from './auth';
import { parse as parseCookie } from 'cookie';
import { randomUUID } from 'crypto';
import { db } from './db';
import { knowledgeNodes, knowledgeEdges } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  getInformationCollectionPlansForRoleModel,
  saveInformationCollectionPlan,
  deleteInformationCollectionPlan,
  sendInformationCollectionPlansToClient,
  notifyInformationPlanUpdate
} from './information-plan-service';

// WebSocketServerのインスタンス
let wss: WebSocketServer;

// ロールモデルIDごとのクライアント接続を追跡
const clients: Map<string, Set<WebSocket>> = new Map();

// クライアント購読情報を追跡
const clientSubscriptions: Map<WebSocket, Set<string>> = new Map();

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
              const sessionCheck = verifySession(cookies.sessionId);
              authVerified = sessionCheck ? true : false;
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
            
            // 購読情報も削除
            if (clientSubscriptions.has(ws)) {
              clientSubscriptions.delete(ws);
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
              const clientId = (ws as any).clientId || 'unknown';
              
              // メッセージタイプの正規化
              const rawType = data.type || 'unknown';
              const normalizedType = typeof rawType === 'string' ? rawType.toLowerCase() : 'unknown';
              data.originalType = data.type; // 元のタイプを保存
              data.type = normalizedType;    // 正規化したタイプで上書き
              
              console.log(`メッセージ受信: clientId=${clientId}, type=${normalizedType}, original=${rawType}`);
              
              // pingメッセージの場合はpongですぐに応答
              if (normalizedType === 'ping') {
                console.log('Ping received from client');
                ws.send(JSON.stringify({
                  type: 'pong',
                  timestamp: new Date().toISOString(),
                  payload: data.payload // クライアントが送ったペイロードをそのまま返す
                }));
                return;
              }
              
              // データの詳細をログ出力してデバッグ
              if (data.type === 'agent_thoughts' || data.type === 'progress') {
                console.log(`デバッグ: ${data.type}メッセージの詳細:`, {
                  messageType: data.type,
                  roleModelId: data.roleModelId || (ws as any).roleModelId,
                  payload: data.payload ? '(存在する)' : '(なし)',
                  dataKeys: Object.keys(data)
                });
              }
              
              // メッセージの種類に応じて処理
              handleClientMessage(ws, data);
            } catch (jsonError) {
              console.error('JSONメッセージの解析に失敗:', jsonError);
            }
          } catch (messageError) {
            console.error(`WebSocketメッセージ処理エラー: ${messageError}`);
          }
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
 * クライアントメッセージに応じた処理を振り分ける
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleClientMessage(ws: WebSocket, data: any): void {
  try {
    // 厳密なデータ検証と正規化
    // type が undefined または null の場合はデフォルト値を設定し、小文字化して比較
    const rawMessageType = data.type || 'unknown';
    const messageType = typeof rawMessageType === 'string' ? rawMessageType.toLowerCase() : 'unknown';
    
    // デバッグ: 元のメッセージタイプと正規化した結果を表示
    console.log(`メッセージタイプの正規化: 元=${rawMessageType} → 正規化後=${messageType}`);
    
    // ペイロードの抽出（直接またはpayloadフィールドから）
    const payload = data.payload || data;
    
    // roleModelIdの優先順位付き抽出
    const specificRoleModelId = payload.roleModelId || data.roleModelId || (ws as any).roleModelId;
    
    // 詳細なデバッグログ
    console.log(`メッセージ処理 type=${messageType}, roleModelId=${specificRoleModelId}`, {
      originalType: data.type,
      normalizedType: messageType,
      payloadSize: payload ? Object.keys(payload).length : 0,
      hasRoleModelId: !!specificRoleModelId
    });
    
    // クライアントIDのログ（存在する場合）
    if ((ws as any).clientId) {
      console.log(`クライアントID: ${(ws as any).clientId}`);
    }
    
    // メッセージタイプに基づいて処理を分岐（小文字比較）
    switch (messageType) {
      case 'subscribe':
        console.log('サブスクリプションメッセージを処理します：', data);
        handleSubscribe(ws, data);
        break;
        
      case 'agent_thoughts':
      case 'agent_thought':
      case 'agent-thoughts':  // ハイフン形式も対応
      case 'thought':
      case 'thinking':
        // エージェント思考の処理
        console.log('エージェント思考メッセージを処理します', {
          dataType: data.type,
          roleModelId: data.roleModelId || (ws as any).roleModelId,
          payloadExists: !!data.payload,
          keys: Object.keys(data),
          payloadKeys: data.payload ? Object.keys(data.payload) : []
        });
        handleAgentThoughts(ws, data);
        break;
        
      case 'progress':
      case 'progress_update':
      case 'progress-update':  // ハイフン形式も対応
      case 'crewai_progress':
      case 'crewai-progress':  // ハイフン形式も対応
        // 進捗更新の処理
        console.log('進捗更新メッセージを処理します', {
          dataType: data.type,
          roleModelId: data.roleModelId || (ws as any).roleModelId,
          payloadExists: !!data.payload,
          keys: Object.keys(data),
          payloadKeys: data.payload ? Object.keys(data.payload) : []
        });
        handleProgressUpdate(ws, data);
        break;
        
      case 'chat_message':
      case 'message':
        // チャットメッセージの処理
        console.log('チャットメッセージを処理します');
        handleChatMessage(ws, data);
        break;
        
      case 'knowledge_graph_update':
      case 'knowledge-graph-update':
      case 'graph-update':
      case 'graph_update':
        // 知識グラフ更新の処理
        console.log('知識グラフ更新メッセージを処理します');
        handleGraphUpdate(ws, data);
        break;
        
      case 'information_collection_plan':
      case 'information_plan':
      case 'get_information_plans':
        // 情報収集プラン取得の処理
        console.log('情報収集プラン取得メッセージを処理します');
        handleInformationPlan(ws, data);
        break;
        
      case 'save_information_plan':
      case 'create_information_plan':
      case 'update_information_plan':
        // 情報収集プラン保存の処理
        console.log('情報収集プラン保存メッセージを処理します');
        handleSaveInformationPlan(ws, data);
        break;
        
      case 'delete_information_plan':
      case 'remove_information_plan':
        // 情報収集プラン削除の処理
        console.log('情報収集プラン削除メッセージを処理します');
        handleDeleteInformationPlan(ws, data);
        break;
        
      case 'ping':
        // Pingメッセージの処理
        console.log('Ping received from client');
        try {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error(`Pong送信エラー: ${error}`);
        }
        break;
        
      default:
        // その他のメッセージタイプの場合（デバッグログを追加）
        console.log(`未処理のメッセージタイプ: ${messageType}`);
        console.log("メッセージの詳細:", JSON.stringify({
          type: messageType,
          roleModelId: specificRoleModelId,
          hasPayload: !!data.payload,
          dataKeys: Object.keys(data),
          payloadKeys: data.payload ? Object.keys(data.payload) : []
        }, null, 2));
        
        // エージェント思考関連のメッセージは特別に処理
        if (
          messageType.includes('agent') || 
          messageType.includes('thought') || 
          messageType.includes('thinking') ||
          payload.agentName || 
          payload.agent_name ||
          payload.thinking
        ) {
          console.log(`エージェント思考として処理します: ${messageType}`);
          handleAgentThoughts(ws, data);
          return; // 処理終了
        } 
        
        // 進捗更新関連のメッセージの場合
        if (
          messageType.includes('progress') || 
          messageType.includes('status') || 
          payload.progress !== undefined || 
          payload.stage !== undefined
        ) {
          console.log(`進捗更新として処理します: ${messageType}`);
          handleProgressUpdate(ws, data);
          return; // 処理終了
        }
        
        // 知識グラフ関連のメッセージの場合
        if (
          messageType.includes('graph') || 
          messageType.includes('knowledge') ||
          payload.nodes !== undefined ||
          payload.edges !== undefined
        ) {
          console.log(`知識グラフ更新として処理します: ${messageType}`);
          handleGraphUpdate(ws, data);
          return; // 処理終了
        }
        
        // その他の場合は汎用メッセージとして処理
        console.log(`汎用的なメッセージとして処理します: ${messageType}`);
        try {
          ws.send(JSON.stringify({
            type: 'message_received',
            message: `メッセージタイプ '${messageType}' を受信しました`,
            originalType: messageType,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error(`確認メッセージ送信エラー: ${error}`);
        }
    }
  } catch (error) {
    console.error(`メッセージハンドラーエラー: ${error}`);
    try {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'メッセージ処理中にエラーが発生しました',
        error: String(error),
        timestamp: new Date().toISOString()
      }));
    } catch (sendError) {
      console.error(`エラーメッセージ送信エラー: ${sendError}`);
    }
  }
}

/**
 * サブスクリプションメッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleSubscribe(ws: WebSocket, data: any): void {
  try {
    // roleModelIdをペイロードから取得（複数の形式に対応）
    const specificRoleModelId = data.payload?.roleModelId || data.roleModelId;
    
    if (!specificRoleModelId) {
      console.log('サブスクリプションメッセージにroleModelIdが含まれていません');
      ws.send(JSON.stringify({
        type: 'subscription_error',
        message: 'roleModelIdが指定されていません',
        timestamp: new Date().toISOString(),
        status: 'error'
      }));
      return;
    }
    
    // クライアントIDを取得
    const clientId = getClientId(ws);
    console.log(`クライアント ${clientId} がロールモデル ${specificRoleModelId} を購読しました`);
    
    // 既存のロールモデルグループから削除
    modelIdToClients.forEach((clientSet, existingRoleModelId) => {
      if (existingRoleModelId !== specificRoleModelId) {
        clientSet.delete(clientId);
      }
    });
    
    // 新しいロールモデルグループに追加
    if (!modelIdToClients.has(specificRoleModelId)) {
      modelIdToClients.set(specificRoleModelId, new Set());
    }
    
    // クライアントをセットに追加
    modelIdToClients.get(specificRoleModelId)?.add(clientId);
    
    // クライアントのカスタムプロパティを更新
    (ws as any).roleModelId = specificRoleModelId;
    
    // 確認メッセージを送信
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      roleModelId: specificRoleModelId,
      timestamp: new Date().toISOString(),
      message: `ロールモデル ${specificRoleModelId} の購読に成功しました`
    }));
    
    // サブスクリプション情報を保存
    if (!clientSubscriptions.has(ws)) {
      clientSubscriptions.set(ws, new Set());
    }
    clientSubscriptions.get(ws)?.add(specificRoleModelId);
    
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
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      message: `ロールモデル ${specificRoleModelId} の購読を開始しました`,
      roleModelId: specificRoleModelId,
      timestamp: new Date().toISOString(),
      status: 'success'
    }));
    
    console.log(`サブスクリプション確認を送信: clientId=${(ws as any).clientId || 'unknown'}`);
    
    // 既存のナレッジグラフがあれば送信
    sendExistingKnowledgeGraph(ws, specificRoleModelId).catch(error => {
      console.error(`既存の知識グラフ送信エラー: ${error}`);
    });
  } catch (error) {
    console.error(`サブスクリプション処理エラー: ${error}`);
  }
}

/**
 * エージェント思考メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleAgentThoughts(ws: WebSocket, data: any): void {
  try {
    // ペイロードの抽出（直接またはpayloadフィールドから）
    const payload = data.payload || data;
    
    // エージェント名とメッセージの抽出（複数の形式に対応）
    const agentName = payload.agentName || payload.agent_name || payload.agent || 
                       data.agentName || data.agent_name || data.agent || 'エージェント';
    
    // 思考内容の抽出（複数の形式に対応）
    const thought = payload.thought || payload.thinking || payload.thoughts || 
                    payload.message || payload.content || 
                    data.thought || data.thinking || data.thoughts || 
                    data.message || data.content || '思考内容が記録されませんでした';
    
    // RoleModelIDの抽出
    const specificRoleModelId = payload.roleModelId || data.roleModelId || (ws as any).roleModelId;
    
    console.log(`エージェント思考メッセージを処理: ${agentName}, roleModelId=${specificRoleModelId}`);
    
    if (!specificRoleModelId) {
      console.log('エージェント思考メッセージにroleModelIdが含まれていません');
      return;
    }
    
    // 詳細データの集約
    const detailedData = {
      ...payload,
      agentName,
      thought,
      roleModelId: specificRoleModelId,
      timestamp: new Date().toISOString()
    };
    
    // エージェント思考を他のクライアントにも送信
    sendAgentThoughts(agentName, thought, specificRoleModelId, detailedData);
    
    // 送信元クライアントに確認を返す
    ws.send(JSON.stringify({
      type: 'thought_received',
      message: 'エージェント思考を受信しました',
      agentName,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error(`エージェント思考処理エラー: ${error}`);
  }
}

/**
 * 進捗更新メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleProgressUpdate(ws: WebSocket, data: any): void {
  try {
    // ペイロードの抽出（直接またはpayloadフィールドから）
    const payload = data.payload || data;
    
    // 進捗関連データの抽出（複数の形式に対応）
    const message = payload.message || payload.stage || data.message || data.stage || '';
    const progress = payload.progress || payload.percent || data.progress || data.percent || 0;
    const stage = payload.stage || payload.status || data.stage || data.status || 'processing';
    const subStage = payload.subStage || payload.sub_stage || data.subStage || data.sub_stage || '';
    
    // RoleModelIDの抽出
    const specificRoleModelId = payload.roleModelId || data.roleModelId || (ws as any).roleModelId;
    
    console.log(`進捗更新メッセージを処理: ${progress}%, roleModelId=${specificRoleModelId}`);
    
    if (!specificRoleModelId) {
      console.log('進捗更新メッセージにroleModelIdが含まれていません');
      return;
    }
    
    // 詳細データの集約
    const detailedData: ProgressUpdateData = {
      ...payload,
      message,
      progress,
      stage,
      subStage,
      roleModelId: specificRoleModelId,
      timestamp: new Date().toISOString()
    };
    
    // 進捗更新を他のクライアントにも送信
    sendProgressUpdate(message, progress, specificRoleModelId, detailedData);
    
    // 送信元クライアントに確認を返す
    ws.send(JSON.stringify({
      type: 'progress_received',
      message: '進捗更新を受信しました',
      progress,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error(`進捗更新処理エラー: ${error}`);
  }
}

/**
 * チャットメッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleChatMessage(ws: WebSocket, data: any): void {
  try {
    console.log(`チャットメッセージを受信しました`);
    
    const message = data.message || '';
    const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
    
    if (!message) {
      console.log('チャットメッセージが空です');
      return;
    }
    
    if (!specificRoleModelId) {
      console.log('チャットメッセージにroleModelIdが含まれていません');
      return;
    }
    
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
  } catch (error) {
    console.error(`チャットメッセージ処理エラー: ${error}`);
  }
}

/**
 * 知識グラフ更新メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleGraphUpdate(ws: WebSocket, data: any): void {
  try {
    const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
    console.log(`知識グラフ更新メッセージを受信: roleModelId=${specificRoleModelId}`);
    
    if (!specificRoleModelId) {
      console.log('知識グラフ更新メッセージにroleModelIdが含まれていません');
      return;
    }
    
    if (!data.nodes || !data.edges) {
      console.log('知識グラフ更新メッセージにノードとエッジのデータが含まれていません');
      return;
    }
    
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
  } catch (error) {
    console.error(`知識グラフ更新処理エラー: ${error}`);
  }
}

/**
 * 情報収集プラン取得メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleInformationPlan(ws: WebSocket, data: any): void {
  try {
    const specificRoleModelId = data.roleModelId || (ws as any).roleModelId;
    console.log(`情報収集プラン取得メッセージを受信: roleModelId=${specificRoleModelId}`);
    
    if (!specificRoleModelId) {
      console.log('情報収集プラン取得メッセージにroleModelIdが含まれていません');
      ws.send(JSON.stringify({
        type: 'information_plan_error',
        message: 'ロールモデルIDが指定されていません',
        timestamp: new Date().toISOString(),
        status: 'error'
      }));
      return;
    }
    
    // 情報収集プランをクライアントに送信
    sendInformationCollectionPlansToClient(ws, specificRoleModelId)
      .then(success => {
        console.log(`情報収集プラン送信: roleModelId=${specificRoleModelId}, 結果=${success ? '成功' : '失敗'}`);
      })
      .catch(error => {
        console.error(`情報収集プラン送信エラー: ${error}`);
        ws.send(JSON.stringify({
          type: 'information_plan_error',
          message: '情報収集プランの取得中にエラーが発生しました',
          error: String(error),
          timestamp: new Date().toISOString(),
          status: 'error'
        }));
      });
  } catch (error) {
    console.error(`情報収集プラン処理エラー: ${error}`);
    ws.send(JSON.stringify({
      type: 'information_plan_error',
      message: '情報収集プラン処理中にエラーが発生しました',
      error: String(error),
      timestamp: new Date().toISOString(),
      status: 'error'
    }));
  }
}

/**
 * 情報収集プラン保存メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleSaveInformationPlan(ws: WebSocket, data: any): void {
  try {
    const specificRoleModelId = data.roleModelId || data.payload?.roleModelId || (ws as any).roleModelId;
    console.log(`情報収集プラン保存メッセージを受信: roleModelId=${specificRoleModelId}`);
    
    if (!specificRoleModelId) {
      console.log('情報収集プラン保存メッセージにroleModelIdが含まれていません');
      ws.send(JSON.stringify({
        type: 'information_plan_error',
        message: 'ロールモデルIDが指定されていません',
        timestamp: new Date().toISOString(),
        status: 'error'
      }));
      return;
    }
    
    // プランデータを準備
    const planData = data.payload || data.plan || data;
    
    // roleModelIdが設定されていることを確認
    if (!planData.roleModelId) {
      planData.roleModelId = specificRoleModelId;
    }
    
    // 情報収集プランを保存
    saveInformationCollectionPlan(planData)
      .then(savedPlan => {
        console.log(`情報収集プラン保存成功: id=${savedPlan.id}`);
        
        // 保存成功メッセージを送信
        ws.send(JSON.stringify({
          type: 'information_plan_saved',
          message: '情報収集プランを保存しました',
          plan: savedPlan,
          roleModelId: specificRoleModelId,
          timestamp: new Date().toISOString(),
          status: 'success'
        }));
        
        // 他のクライアントに更新通知
        const updateType = planData.id ? 'update' : 'create';
        notifyInformationPlanUpdate(specificRoleModelId, savedPlan, updateType, sendMessageToRoleModelViewers);
      })
      .catch(error => {
        console.error(`情報収集プラン保存エラー: ${error}`);
        ws.send(JSON.stringify({
          type: 'information_plan_error',
          message: '情報収集プランの保存中にエラーが発生しました',
          error: String(error),
          timestamp: new Date().toISOString(),
          status: 'error'
        }));
      });
  } catch (error) {
    console.error(`情報収集プラン保存処理エラー: ${error}`);
    ws.send(JSON.stringify({
      type: 'information_plan_error',
      message: '情報収集プラン保存処理中にエラーが発生しました',
      error: String(error),
      timestamp: new Date().toISOString(),
      status: 'error'
    }));
  }
}

/**
 * 情報収集プラン削除メッセージの処理
 * @param ws WebSocketクライアント
 * @param data メッセージデータ
 */
function handleDeleteInformationPlan(ws: WebSocket, data: any): void {
  try {
    const specificRoleModelId = data.roleModelId || data.payload?.roleModelId || (ws as any).roleModelId;
    const planId = data.planId || data.payload?.planId || data.id;
    
    console.log(`情報収集プラン削除メッセージを受信: planId=${planId}, roleModelId=${specificRoleModelId}`);
    
    if (!planId) {
      console.log('情報収集プラン削除メッセージにplanIdが含まれていません');
      ws.send(JSON.stringify({
        type: 'information_plan_error',
        message: 'プランIDが指定されていません',
        timestamp: new Date().toISOString(),
        status: 'error'
      }));
      return;
    }
    
    // 情報収集プランを削除
    deleteInformationCollectionPlan(planId)
      .then(result => {
        console.log(`情報収集プラン削除結果: ${JSON.stringify(result)}`);
        
        // 削除成功メッセージを送信
        ws.send(JSON.stringify({
          type: 'information_plan_deleted',
          message: '情報収集プランを削除しました',
          planId: planId,
          roleModelId: specificRoleModelId,
          timestamp: new Date().toISOString(),
          status: 'success'
        }));
        
        // 他のクライアントに削除通知
        if (specificRoleModelId) {
          notifyInformationPlanUpdate(specificRoleModelId, { id: planId }, 'delete', sendMessageToRoleModelViewers);
        }
      })
      .catch(error => {
        console.error(`情報収集プラン削除エラー: ${error}`);
        ws.send(JSON.stringify({
          type: 'information_plan_error',
          message: '情報収集プランの削除中にエラーが発生しました',
          error: String(error),
          timestamp: new Date().toISOString(),
          status: 'error'
        }));
      });
  } catch (error) {
    console.error(`情報収集プラン削除処理エラー: ${error}`);
    ws.send(JSON.stringify({
      type: 'information_plan_error',
      message: '情報収集プラン削除処理中にエラーが発生しました',
      error: String(error),
      timestamp: new Date().toISOString(),
      status: 'error'
    }));
  }
}

/**
 * 既存の知識グラフデータをクライアントに送信する関数
 * @param ws WebSocketクライアント
 * @param roleModelId ロールモデルID
 * @returns 処理結果の約束（Promise）
 */
export async function sendExistingKnowledgeGraph(ws: WebSocket, roleModelId: string): Promise<void> {
  try {
    console.log(`既存ナレッジグラフデータを取得中: roleModelId=${roleModelId}`);

    // データベースからそのロールモデルのノードとエッジを取得
    const nodes = await db.query.knowledgeNodes.findMany({
      where: eq(knowledgeNodes.roleModelId, roleModelId),
    });

    const edges = await db.query.knowledgeEdges.findMany({
      where: eq(knowledgeEdges.roleModelId, roleModelId),
    });

    console.log(`ナレッジグラフデータ取得完了: ${nodes.length}個のノードと${edges.length}個のエッジを取得`);

    // データが存在するか確認
    if (nodes.length === 0 && edges.length === 0) {
      console.log(`ロールモデル ${roleModelId} の既存ナレッジグラフデータは見つかりませんでした`);
      
      // データがない場合も通知を送信
      ws.send(JSON.stringify({
        type: 'knowledge_graph_data',
        roleModelId,
        message: 'ナレッジグラフデータは存在しません',
        status: 'empty',
        data: { nodes: [], edges: [] },
        timestamp: new Date().toISOString()
      }));
      
      return;
    }

    // データを送信
    console.log(`既存ナレッジグラフデータを送信中: roleModelId=${roleModelId}, ${nodes.length}ノード, ${edges.length}エッジ`);
    
    // 知識グラフデータを送信
    ws.send(JSON.stringify({
      type: 'knowledge_graph_data',
      roleModelId,
      message: 'ナレッジグラフデータを取得しました',
      status: 'success',
      data: { 
        nodes,
        edges
      },
      timestamp: new Date().toISOString()
    }));
    
    console.log(`ナレッジグラフデータの送信が完了しました: roleModelId=${roleModelId}`);
  } catch (error) {
    console.error(`ナレッジグラフデータ送信エラー: ${error}`);
    
    // エラー通知を送信
    ws.send(JSON.stringify({
      type: 'knowledge_graph_error',
      roleModelId,
      message: 'ナレッジグラフデータの取得中にエラーが発生しました',
      status: 'error',
      timestamp: new Date().toISOString()
    }));
    
    throw error;
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

  const data = {
    type: 'error',
    message,
    roleModelId,
    timestamp: new Date().toISOString(),
    status: 'error',
    details: errorDetails
  };

  // 標準メッセージ形式のJSONを生成
  const message_json = JSON.stringify(data);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.log(`エラーメッセージを送信: ${roleModelId}, "${message}"`);
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

  const messageData = {
    type: 'completion',
    message,
    roleModelId,
    timestamp: new Date().toISOString(),
    status: 'completed',
    data: data || {}
  };

  // 標準メッセージ形式のJSONを生成
  const message_json = JSON.stringify(messageData);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.log(`完了メッセージを送信: ${roleModelId}, "${message}"`);
}

/**
 * エージェントの思考プロセスを送信する関数
 * @param agentName エージェント名
 * @param thoughts 思考内容
 * @param roleModelId ロールモデルID
 * @param detailedData 詳細データ（graphUpdate:ナレッジグラフの部分的な更新を含む場合がある）
 */
export
function sendAgentThoughts(
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

  const data = {
    type: 'agent_thoughts',
    message: thoughts,
    thought: thoughts, // 互換性のため
    agentName,
    agent: agentName, // 互換性のため
    roleModelId,
    timestamp: new Date().toISOString(),
    ...(detailedData || {})
  };

  // 標準メッセージ形式のJSONを生成
  const message_json = JSON.stringify(data);

  // 該当ロールモデルに接続されているすべてのクライアントに送信
  clientSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message_json);
    }
  });

  console.log(`エージェント思考を送信: ${roleModelId}, ${agentName}, "${thoughts.substring(0, 50)}..."`);
  
  // グラフ更新データが含まれている場合は、部分的な更新も送信
  if (detailedData && (detailedData.graphUpdate || detailedData.knowledgeGraphUpdate)) {
    const graphData = detailedData.graphUpdate || detailedData.knowledgeGraphUpdate;
    if (graphData && graphData.nodes && graphData.edges) {
      console.log(`エージェント ${agentName} からグラフ更新データを検出: ノード数=${graphData.nodes.length}, エッジ数=${graphData.edges.length}`);
      
      // 部分的なグラフ更新を送信
      sendPartialGraphUpdate(
        roleModelId,
        {
          nodes: graphData.nodes,
          edges: graphData.edges
        },
        agentName
      );
    }
  }
}

/**
 * 全てのロールモデルクライアントに対してメッセージを送信する関数
 * @param message メッセージ
 * @param type メッセージタイプ
 * @param data 追加データ
 */
export function sendMessageToRoleModelViewers(
  targetRoleModelId: string | string[] | undefined,
  type: string,
  data: any
): void {
  if (!targetRoleModelId) {
    console.log('送信先のロールモデルIDが指定されていません');
    return;
  }

  const roleModelIds = Array.isArray(targetRoleModelId) ? targetRoleModelId : [targetRoleModelId];
  let sentCount = 0;

  // 各ロールモデルIDに対して処理
  roleModelIds.forEach(roleModelId => {
    const clientSet = clients.get(roleModelId);
    if (!clientSet || clientSet.size === 0) {
      console.log(`ロールモデル ${roleModelId} に接続されたクライアントはありません`);
      return;
    }

    const messageData = {
      type,
      roleModelId,
      timestamp: new Date().toISOString(),
      ...data
    };

    // 標準メッセージ形式のJSONを生成
    const message_json = JSON.stringify(messageData);

    // 該当ロールモデルに接続されているすべてのクライアントに送信
    clientSet.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message_json);
        sentCount++;
      }
    });
  });

  if (sentCount > 0) {
    const roleModelIdStr = Array.isArray(targetRoleModelId) ? targetRoleModelId.join(', ') : targetRoleModelId;
    console.log(`メッセージを送信: type=${type}, roleModelIds=[${roleModelIdStr}], クライアント数=${sentCount}`);
  }
}



/**
 * ナレッジグラフ更新を送信する関数
 * @param roleModelId ロールモデルID
 * @param graphData グラフデータ（ノードとエッジ）
 * @param updateType 更新タイプ（'create', 'update', 'delete', 'partial', 'complete'）
 * @param additionalData 追加データ
 */
export
function sendKnowledgeGraphUpdate(
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
 * 部分的なナレッジグラフ更新を送信する関数（段階的な構築用）
 * @param roleModelId ロールモデルID
 * @param partialData 部分的なグラフデータ（段階的に追加されるノードとエッジ）
 * @param agentName データを生成したエージェント名
 */
export function sendPartialGraphUpdate(
  roleModelId: string,
  partialData: { nodes: any[], edges: any[] },
  agentName: string = ''
): void {
  console.log(`部分的なグラフ更新を送信: roleModelId=${roleModelId}, エージェント=${agentName}, ノード数=${partialData.nodes.length}, エッジ数=${partialData.edges.length}`);
  
  // 部分更新として明示的にマーキング
  const additionalData = {
    isPartial: true,
    agentName,
    partialUpdateId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // 一意の更新ID
    timestamp: new Date().toISOString()
  };
  
  // 部分更新として送信（'partial'タイプを使用）
  sendKnowledgeGraphUpdate(
    roleModelId,
    partialData,
    'partial',
    additionalData
  );
}

/**
 * WebSocketサーバーを終了
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close();
    console.log('WebSocketサーバーを終了しました');
  }
}