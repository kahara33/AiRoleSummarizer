/**
 * WebSocket通信モジュール
 * クライアントとのリアルタイム通信を管理
 */

import { Server } from 'http';
import WebSocket from 'ws';
import url from 'url';

// WebSocketサーバーインスタンス
let wss: WebSocket.Server | null = null;

// ロールモデルID別に接続を管理するマップ
const roleModelConnections: Map<string, Set<WebSocket>> = new Map();

/**
 * WebSocketサーバーを初期化する
 * @param server HTTPサーバーインスタンス
 */
export function initWebSocketServer(server: Server): void {
  if (wss) {
    return; // 既に初期化済み
  }

  // WebSocketサーバーの作成
  wss = new WebSocket.Server({ server });
  
  // 接続イベントのハンドリング
  wss.on('connection', (ws: WebSocket, request) => {
    console.log('New WebSocket connection established.');
    
    // URL パラメータの解析（例: /ws?roleModelId=xxx）
    const parsedUrl = url.parse(request.url || '', true);
    const roleModelId = parsedUrl.query.roleModelId as string;
    
    // ロールモデルIDが指定されている場合は登録
    if (roleModelId) {
      // ロールモデルIDに対応する接続セットがなければ作成
      if (!roleModelConnections.has(roleModelId)) {
        roleModelConnections.set(roleModelId, new Set());
      }
      
      // 接続を追加
      roleModelConnections.get(roleModelId)?.add(ws);
      
      console.log(`Client connected to role model ${roleModelId}`);
      
      // 接続成功メッセージを送信
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'success',
        roleModelId,
        message: 'Connected to knowledge library real-time updates.'
      }));
      
      // 切断時の処理
      ws.on('close', () => {
        // 接続リストから削除
        roleModelConnections.get(roleModelId)?.delete(ws);
        console.log(`Client disconnected from role model ${roleModelId}`);
        
        // 空の接続セットはマップから削除
        if (roleModelConnections.get(roleModelId)?.size === 0) {
          roleModelConnections.delete(roleModelId);
        }
      });
      
      // エラー時の処理
      ws.on('error', (error) => {
        console.error(`WebSocket error for role model ${roleModelId}:`, error);
      });
      
      // WebSocketメッセージの処理を行う非同期関数
      const handleMessage = async (message: WebSocket.Data, ws: WebSocket) => {
        try {
          const parsedMessage = JSON.parse(message.toString());
          console.log(`WebSocketメッセージ受信: type=${parsedMessage.type}, roleModelId=${roleModelId}`);
          
          // Client->Server メッセージの処理
          const { type } = parsedMessage;
          
          if (type === 'ping') {
            // Pingに対してPongで応答
            ws.send(JSON.stringify({
              type: 'pong',
              payload: {
                timestamp: new Date().toISOString()
              }
            }));
            console.log('Ping received from client');
          } else if (type === 'subscribe') {
            // サブスクリプションリクエスト - 既に接続時に処理されているので、確認メッセージを送信
            ws.send(JSON.stringify({
              type: 'connect_success',
              payload: {
                message: '接続が確立されました',
                clientId: parsedMessage.clientId || 'unknown',
                roleModelId: roleModelId
              }
            }));
            console.log(`Client ${parsedMessage.clientId || 'unknown'} subscribed to role model ${roleModelId}`);
          } else if (type === 'create_knowledge_graph') {
            // ナレッジグラフ生成リクエスト（新規または既存グラフを使用するかのフラグ付き）
            console.log(`クライアントからのナレッジグラフ生成リクエスト:`, parsedMessage);
            
            try {
              // クライアントに受信確認メッセージを送信
              ws.send(JSON.stringify({
                type: 'request_received',
                requestType: 'create_knowledge_graph',
                message: 'ナレッジグラフ生成リクエストを受信しました。処理を開始します。',
                timestamp: new Date().toISOString()
              }));
              
              // 進捗状況の初期値を送信
              sendProgressUpdate(
                roleModelId,
                5,
                'ナレッジグラフ生成を開始します...'
              );
              
              // 動的インポートでハンドラーモジュールを読み込む
              const handlers = await import('./websocket-handlers');
              const result = await handlers.handleCreateKnowledgeGraph(parsedMessage, roleModelId);
              
              console.log('ナレッジグラフ生成ハンドラ実行結果:', result ? '成功' : '失敗');
            } catch (error) {
              console.error('ナレッジグラフハンドラのロードまたは実行エラー:', error);
              
              ws.send(JSON.stringify({
                type: 'error',
                message: 'ナレッジグラフ生成処理中にエラーが発生しました',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
              }));
              
              // エラー進捗更新
              sendProgressUpdate(
                roleModelId,
                0,
                'ナレッジグラフ生成中にエラーが発生しました',
                { status: 'error' }
              );
            }
          } else if (type === 'create_collection_plan') {
            // 情報収集プラン生成リクエスト（既存グラフを使用）
            console.log(`クライアントからの情報収集プラン生成リクエスト:`, parsedMessage);
            
            try {
              // クライアントに受信確認メッセージを送信
              ws.send(JSON.stringify({
                type: 'request_received',
                requestType: 'create_collection_plan',
                message: '情報収集プラン生成リクエストを受信しました。処理を開始します。',
                timestamp: new Date().toISOString()
              }));
              
              // 進捗状況の初期値を送信
              sendProgressUpdate(
                roleModelId,
                5,
                '情報収集プラン生成を開始します...'
              );
              
              // 動的インポートでハンドラーモジュールを読み込む
              const handlers = await import('./websocket-handlers');
              const result = await handlers.handleCreateCollectionPlan(parsedMessage, roleModelId);
              
              console.log('情報収集プラン生成ハンドラ実行結果:', result ? '成功' : '失敗');
            } catch (error) {
              console.error('情報収集プランハンドラのロードまたは実行エラー:', error);
              
              ws.send(JSON.stringify({
                type: 'error',
                message: '情報収集プラン生成処理中にエラーが発生しました',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
              }));
              
              // エラー進捗更新
              sendProgressUpdate(
                roleModelId,
                0,
                '情報収集プラン生成中にエラーが発生しました',
                { status: 'error' }
              );
            }
          } else if (type === 'cancel_operation') {
            // 操作キャンセルリクエスト
            console.log(`クライアントからの操作キャンセルリクエスト:`, parsedMessage);
            
            try {
              // クライアントに受信確認メッセージを送信
              ws.send(JSON.stringify({
                type: 'request_received',
                requestType: 'cancel_operation',
                message: 'キャンセルリクエストを受信しました。処理を中止します。',
                timestamp: new Date().toISOString()
              }));
              
              // 動的インポートでハンドラーモジュールを読み込む
              const handlers = await import('./websocket-handlers');
              const result = await handlers.handleCancelOperation(parsedMessage, roleModelId);
              
              console.log('キャンセル操作ハンドラ実行結果:', result ? '成功' : '失敗');
            } catch (error) {
              console.error('キャンセルハンドラのロードまたは実行エラー:', error);
              
              ws.send(JSON.stringify({
                type: 'error',
                message: 'キャンセル処理中にエラーが発生しました',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
              }));
            }
          } else if (type === 'agent_thoughts' || type === 'progress' || type === 'graph_update') {
            // メッセージをそのまま処理（受信も送信も同じ型を使用）
            console.log(`Processing message type: ${type}`);
            
            // ペイロードにroleModelIdがなければ追加
            if (parsedMessage.payload && !parsedMessage.payload.roleModelId) {
              parsedMessage.payload.roleModelId = roleModelId;
            }
            
            // 同じロールモデルに属する他のクライアントに転送（必要に応じて）
            sendToRoleModel(roleModelId, parsedMessage);
          } else {
            console.log(`未処理のメッセージタイプ: ${type}`);
          }
          
        } catch (error) {
          console.error(`Error parsing message from role model ${roleModelId}:`, error);
        }
      };
      
      // メッセージ受信時の処理（非同期関数に処理を委譲）
      ws.on('message', (message) => {
        try {
          const msgData = JSON.parse(message.toString());
          console.log(`メッセージ受信: type=${msgData.type || 'unknown'}`);
          handleMessage(message, ws).catch(err => {
            console.error('WebSocketメッセージ処理エラー:', err);
          });
        } catch (error) {
          console.error('WebSocketメッセージの解析に失敗:', error);
        }
      });
    } else {
      // ロールモデルIDが指定されていない場合は切断
      console.warn('WebSocket connection without roleModelId rejected.');
      ws.send(JSON.stringify({
        type: 'error',
        message: 'ロールモデルIDが指定されていないため接続できません',
        details: 'WebSocket接続URLまたはメッセージペイロードにroleModelIdパラメータが必要です。クライアント側でroleModelIdが設定されていることを確認してください。'
      }));
      ws.close();
    }
  });
  
  console.log('WebSocket server initialized.');
}

/**
 * 特定のロールモデルIDに関連するクライアントにメッセージを送信する
 * @param roleModelId ロールモデルID
 * @param message 送信するメッセージ
 * @returns 送信成功したクライアント数
 */
export function sendToRoleModel(roleModelId: string, message: any): number {
  // ロールモデルに対応する接続セットを取得
  const connections = roleModelConnections.get(roleModelId);
  
  if (!connections || connections.size === 0) {
    return 0; // 接続なし
  }
  
  // メッセージをJSON文字列に変換（既に文字列の場合はそのまま）
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  
  // 各接続にメッセージを送信
  let sentCount = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error(`Error sending message to client:`, error);
      }
    }
  });
  
  return sentCount;
}

/**
 * 進捗状況の更新をクライアントに送信する
 * @param roleModelId ロールモデルID
 * @param progress 進捗率（0-100）または進捗オブジェクト
 * @param message 進捗メッセージ
 * @param data 追加データ（オプション）
 */
export function sendProgressUpdate(
  roleModelId: string,
  progress: number | Record<string, any>,
  message?: string | Record<string, any>,
  data?: Record<string, any>
): void {
  // 進捗情報を含むメッセージオブジェクトの作成
  const progressMessage = {
    type: 'progress',
    progress: typeof progress === 'number' ? { value: progress } : progress,
    message: message || '',
    data: data || {},
    timestamp: new Date().toISOString()
  };
  
  // ロールモデルの接続にメッセージを送信
  sendToRoleModel(roleModelId, progressMessage);
}

/**
 * エージェントの思考過程をクライアントに送信する
 * @param agentName エージェント名
 * @param thought 思考内容
 * @param roleModelId ロールモデルID
 * @param status ステータス（'thinking', 'decision', 'error'など）
 */
export function sendAgentThoughts(
  agentName: string,
  thought: string,
  roleModelId: string,
  status: string = 'thinking'
): void {
  // エージェント思考メッセージの作成
  const thoughtMessage = {
    type: 'agent_thoughts', // クライアント側のuse-multi-agent-websocket-fixedとの互換性のため'agent_thoughts'に変更
    agentName,
    thought,
    status,
    timestamp: new Date().toISOString()
  };
  
  // ロールモデルの接続にメッセージを送信
  sendToRoleModel(roleModelId, thoughtMessage);
}

/**
 * ナレッジグラフの更新をクライアントに送信する
 * @param roleModelId ロールモデルID
 * @param graphData グラフデータ（ノードとエッジを含む）
 */
export function sendGraphUpdate(
  roleModelId: string,
  graphData: {
    nodes: any[];
    edges: any[];
  }
): void {
  // グラフ更新メッセージの作成
  const graphMessage = {
    type: 'graph_update',
    graphData,
    timestamp: new Date().toISOString()
  };
  
  // ロールモデルの接続にメッセージを送信
  sendToRoleModel(roleModelId, graphMessage);
}