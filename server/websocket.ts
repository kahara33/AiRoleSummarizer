import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'cookie';
import { verifySession } from './auth';
import { ProgressUpdate } from '@shared/schema';

// UUIDの検証関数
function isValidUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// 接続中のクライアントソケットを格納するマップ
// ユーザーID -> そのユーザーが開いている全WebSocket接続
const clients = new Map<string, Set<WebSocket>>();

// ロールモデルID -> そのロールモデルに関心のあるWebSocket接続
const roleModelSubscriptions = new Map<string, Set<WebSocket>>();

/**
 * WebSocketサーバーをセットアップ
 * @param httpServer HTTPサーバー
 */
export function setupWebSocketServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', async (ws, req) => {
    console.log('WebSocket接続を受け付けました');
    
    let userId: string | null = null;
    let roleModelId = "";
    
    // クッキーからセッションIDを取得し、ユーザー認証を行う
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = parse(cookieHeader);
      const sessionId = cookies['connect.sid'];
      
      if (sessionId) {
        try {
          userId = await verifySession(sessionId);
          console.log(`WebSocket: ユーザー ${userId} が認証されました`);
        } catch (error) {
          console.error('WebSocket: セッション検証エラー:', error);
        }
      }
    }
    
    // 開発環境では認証をスキップする
    if (!userId) {
      console.log('WebSocket: 開発環境のため認証なしで接続を許可します');
      userId = "anonymous"; // 開発環境用の一時的なID
    }
    
    // クライアントマップに追加
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.add(ws);
    }
    
    // クライアントからのメッセージを処理
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // AIエージェントとのチャットメッセージ処理
        if (data.type === 'agent_chat') {
          const payload = data.payload || data;
          const roleModelId = payload.roleModelId;
          const userMessage = payload.message;
          
          console.log(`WebSocket: ユーザー ${userId} がエージェントにチャットメッセージを送信しました:`, {
            userId,
            roleModelId,
            message: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
            timestamp: payload.timestamp || new Date().toISOString(),
            clientId: payload.clientId || 'unknown'
          });
          
          // AIエージェントへの質問をまず確認メッセージとして送信
          sendMessageToRoleModelViewers('agent_thoughts', {
            agentName: 'システム',
            agentType: 'system',
            thoughts: `ユーザーからのメッセージを受信しました: ${userMessage}`,
            stage: 'user-input',
            timestamp: new Date().toISOString()
          }, roleModelId);
          
          // Azure OpenAIにメッセージを送信して処理（非同期で実行）
          handleAgentChatMessage(userId, roleModelId, userMessage).catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('エージェントチャットメッセージ処理エラー:', errorMessage);
            
            // エラーメッセージをクライアントに返す
            sendMessageToRoleModelViewers('agent_thoughts', {
              agentName: 'システム',
              agentType: 'system',
              thoughts: `メッセージの処理中にエラーが発生しました: ${errorMessage}`,
              stage: 'error',
              timestamp: new Date().toISOString()
            }, roleModelId);
          });
        }
        // ロールモデルの購読
        else if (data.type === 'subscribe' && data.payload && data.payload.roleModelId) {
          const requestedRoleModelId = data.payload.roleModelId;
          
          // UUIDが有効かどうかを検証する
          if (requestedRoleModelId === 'default' || !isValidUUID(requestedRoleModelId)) {
            console.error(`無効なUUID形式: ${requestedRoleModelId}`);
            ws.send(JSON.stringify({
              type: 'error',
              message: `無効なUUID形式: ${requestedRoleModelId}`
            }));
            return;
          }
          
          roleModelId = requestedRoleModelId;
          
          // クライアントの情報をログに記録（デバッグのため）
          const clientInfo = {
            userId: userId || 'anonymous',
            roleModelId: roleModelId,
            timestamp: new Date().toISOString(),
            clientId: data.payload.clientId || 'unknown',
            remoteAddress: req.socket.remoteAddress || 'unknown'
          };
          console.log(`WebSocket: ユーザー ${clientInfo.userId} がロールモデル ${roleModelId} を購読しました`, clientInfo);
          
          // ロールモデル購読セットが存在しない場合は作成
          if (!roleModelSubscriptions.has(roleModelId)) {
            roleModelSubscriptions.set(roleModelId, new Set());
            console.log(`[WebSocket] ロールモデル ${roleModelId} の購読セットを新規作成しました`);
          }
          
          // 購読リストにWebSocketを追加
          const subscribers = roleModelSubscriptions.get(roleModelId);
          if (subscribers) {
            subscribers.add(ws);
            console.log(`[WebSocket] ロールモデル ${roleModelId} の購読セット (${subscribers.size}件) にクライアントを追加しました`);
            
            // 既存のデータがあればそれらも送信（例：進行中の処理状態）
            // 注：実際の実装ではここにキャッシュされた状態を送信する処理を追加できる
          }
          
          // 購読確認のレスポンスを送信
          ws.send(JSON.stringify({
            type: 'subscribed',
            roleModelId
          }));
        }
      } catch (error) {
        console.error('WebSocket: メッセージ処理エラー:', error);
      }
    });
    
    // 接続クローズ時の処理
    ws.on('close', () => {
      console.log(`WebSocket: ユーザー ${userId} の接続が閉じられました`);
      
      // クライアントリストから削除
      if (userId && clients.has(userId)) {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clients.delete(userId);
          }
        }
      }
      
      // サブスクリプションリストから削除
      if (roleModelId && roleModelSubscriptions.has(roleModelId)) {
        const subscribers = roleModelSubscriptions.get(roleModelId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            roleModelSubscriptions.delete(roleModelId);
          }
        }
      }
    });
    
    // 初期状態の通知
    ws.send(JSON.stringify({
      type: 'connected',
      userId: userId
    }));
  });
  
  console.log('WebSocketサーバーが起動しました');
}

/**
 * 特定のユーザーにメッセージを送信
 * @param userId ユーザーID
 * @param message 送信するメッセージ
 */
export function sendToUser(userId: string, message: any): void {
  if (clients.has(userId)) {
    const userSockets = clients.get(userId);
    if (userSockets) {
      userSockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      });
    }
  }
}

/**
 * 特定のロールモデルを購読しているクライアントにメッセージを送信
 * @param type メッセージタイプ
 * @param payload メッセージ内容
 * @param roleModelId ロールモデルID
 */
export function sendMessageToRoleModelViewers(type: string, payload: any, roleModelId: string): void {
  console.log(`Sending ${type} message to roleModel ${roleModelId} subscribers:`, payload);
  
  // メッセージ形式を修正（payloadにネストして送信）
  const message = {
    type,
    payload: {
      ...payload,
      roleModelId,
      timestamp: new Date().toISOString()
    }
  };
  
  if (roleModelSubscriptions.has(roleModelId)) {
    const subscribers = roleModelSubscriptions.get(roleModelId);
    if (subscribers) {
      console.log(`Sending to ${subscribers.size} subscribers`);
      
      subscribers.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify(message));
          } catch (err) {
            console.error('WebSocket送信エラー:', err);
          }
        }
      });
    }
  } else {
    console.log(`No subscribers found for roleModel ${roleModelId}`);
  }
}

/**
 * エージェントの思考プロセスを送信する拡張関数
 * @param agentName エージェント名
 * @param thoughts 思考内容
 * @param roleModelId ロールモデルID
 * @param additionalData 追加データ (詳細な思考プロセス、推論、決定事項など)
 */
export function sendAgentThoughts(
  agentName: string, 
  thoughts: string, 
  roleModelId?: string,
  additionalData?: {
    agentType?: string;
    stage?: string;
    subStage?: string;
    thinking?: Array<{
      step: string;
      content: string;
      timestamp: string;
    }>;
    reasoning?: string;
    decision?: string;
    context?: any;
    inputData?: any;
    outputData?: any;
    timestamp?: string;
  }
): void {
  console.log(`エージェント思考: ${agentName} - ${thoughts.substring(0, 50)}...`);
  
  // 思考内容の詳細ログを出力（デバッグ用）
  if (additionalData) {
    console.log('送信する詳細な思考情報:', {
      agentName,
      hasThinkinList: Boolean(additionalData.thinking),
      thinkingStepsCount: additionalData.thinking?.length || 0,
      hasReasoning: Boolean(additionalData.reasoning),
      hasDecision: Boolean(additionalData.decision),
      hasContext: Boolean(additionalData.context),
      hasInputData: Boolean(additionalData.inputData),
      hasOutputData: Boolean(additionalData.outputData),
      stage: additionalData.stage,
      agentType: additionalData.agentType
    });
  }
  
  if (roleModelId && isValidUUID(roleModelId)) {
    // 標準的なエージェントタイプを特定する
    const standardizedAgentType = 
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("industry") ? "industry-analysis" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("keyword") ? "keyword-expansion" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("structur") ? "structuring" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("graph") ? "knowledge-graph" :
      (additionalData?.agentType || agentName || "")
        .toLowerCase()
        .includes("orchestr") ? "orchestrator" : "agent";
    
    // thinking属性が必ず配列として渡されるように前処理
    let thinkingSteps = additionalData?.thinking;
    if (!thinkingSteps || !Array.isArray(thinkingSteps) || thinkingSteps.length === 0) {
      thinkingSteps = [{
        step: "思考プロセス",
        content: thoughts,
        timestamp: new Date().toISOString()
      }];
    }
    
    const payload = {
      agentName,
      thoughts,
      // 追加データがある場合はマージする
      ...additionalData,
      // エージェントタイプが指定されていない場合は標準化したタイプを使用
      agentType: additionalData?.agentType || standardizedAgentType,
      // 詳細な思考プロセスを必ず配列として設定
      thinking: thinkingSteps,
      // タイムスタンプを確保
      timestamp: additionalData?.timestamp || new Date().toISOString()
    };
    
    sendMessageToRoleModelViewers('agent_thoughts', payload, roleModelId);
  } else {
    console.error(`無効なUUID形式のロールモデルID: ${roleModelId}`);
  }
}

/**
 * 進捗更新情報を送信する拡張関数
 * @param message メッセージ
 * @param progress 進捗率 (0-100)
 * @param roleModelId ロールモデルID
 * @param additionalData 追加データ (詳細な進捗情報など)
 */
export function sendProgressUpdate(
  message: string, 
  progress: number, 
  roleModelId: string,
  additionalData?: ProgressUpdate
): void {
  console.log(`進捗更新: ${message} (${progress}%) - ロールモデル ${roleModelId}`);
  
  if (roleModelId && isValidUUID(roleModelId)) {
    const payload = {
      message,
      progress,
      // 追加データがある場合はマージする
      ...additionalData
    };
    
    sendMessageToRoleModelViewers('progress', payload, roleModelId);
  } else {
    console.error(`無効なUUID形式のロールモデルID: ${roleModelId}`);
  }
}

/**
 * ユーザーからのチャットメッセージを処理
 * Azure OpenAIを使用して応答を生成
 * @param userId ユーザーID
 * @param roleModelId ロールモデルID
 * @param message ユーザーからのメッセージ
 */
async function handleAgentChatMessage(userId: string, roleModelId: string, message: string): Promise<void> {
  try {
    // ロールモデルの情報を取得（実装に応じて）
    
    // 処理中メッセージを送信
    sendMessageToRoleModelViewers('agent_thoughts', {
      agentName: 'AIアシスタント',
      agentType: 'assistant',
      thoughts: '入力メッセージを分析中...',
      stage: 'processing',
      timestamp: new Date().toISOString()
    }, roleModelId);
    
    // Azure OpenAIを使用して応答を生成
    const { callAzureOpenAI } = await import('./azure-openai');
    
    // ユーザーの入力と役割に応じたシステムメッセージを設定
    const messages = [
      {
        role: 'system',
        content: 'あなたは自律型情報収集サービスのAIアシスタントです。ユーザーのロールに関する質問や知識グラフへの追加・変更依頼に対応してください。応答は簡潔かつ親切に行ってください。'
      },
      {
        role: 'user',
        content: message
      }
    ];
    
    // 処理中であることを通知
    sendMessageToRoleModelViewers('agent_thoughts', {
      agentName: 'AIアシスタント',
      agentType: 'assistant',
      thoughts: 'Azure OpenAIに応答をリクエスト中...',
      stage: 'api-request',
      timestamp: new Date().toISOString()
    }, roleModelId);
    
    // Azure OpenAIを呼び出して応答を取得
    const response = await callAzureOpenAI(messages);
    
    // AIの応答を送信
    sendMessageToRoleModelViewers('agent_thoughts', {
      agentName: 'AIアシスタント',
      agentType: 'assistant',
      thoughts: response,
      stage: 'response',
      timestamp: new Date().toISOString()
    }, roleModelId);
    
    // 必要に応じて知識グラフの更新処理を実行
    // （メッセージ内容に応じて知識グラフを更新する処理をここに追加）
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('AIエージェントチャットメッセージ処理エラー:', errorMessage);
    
    // エラーメッセージを送信
    sendMessageToRoleModelViewers('agent_thoughts', {
      agentName: 'AIアシスタント',
      agentType: 'system',
      thoughts: `エラーが発生しました: ${errorMessage}`,
      stage: 'error',
      timestamp: new Date().toISOString()
    }, roleModelId);
  }
}