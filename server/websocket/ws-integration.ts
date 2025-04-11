import { Server } from 'http';
import { sendProgressUpdate, sendAgentThoughts, initWebSocketServer, getWebSocketServer } from './ws-server';
// CrewAIサービスをインポート
import { generateKnowledgeGraphWithCrewAI, CrewAIService } from '../services/crew-ai/crew-ai-service';
// キャンセル処理のハンドラをインポート
import { handleCancelOperation } from './cancel-handler';

// WebSocketサーバーのクライアントへの送信関数を取得
const wsServer = {
  sendToClient: (clientId: string, message: any) => {
    const server = getWebSocketServer();
    if (server) {
      return server.sendToClient(clientId, message);
    }
    return false;
  }
};

// WebSocketとCrewAIを統合する関数
export function setupWebSocketIntegration(server: Server): void {
  const wsServer = initWebSocketServer(server);
  
  // WebSocketメッセージの処理
  wsServer.on('message', async (data: any) => {
    const { clientId, userId, roleModelId, message } = data;
    
    console.log(`WebSocketメッセージ受信: type=${message.type}, roleModelId=${roleModelId}`);
    
    try {
      switch (message.type) {
        case 'create_knowledge_graph':
          handleCreateKnowledgeGraph(roleModelId, message.payload);
          break;
          
        case 'create_collection_plan':
          handleCreateCollectionPlan(roleModelId, message.payload);
          break;
          
        case 'cancel_operation':
          // 処理のキャンセルリクエスト
          handleCancelOperation(roleModelId, message.payload);
          break;
          
        case 'chat_message':
          // チャットメッセージの処理（将来的な実装）
          console.log(`チャットメッセージを受信: ${message.payload.message}`);
          break;
          
        case 'ping':
          // クライアントからのping応答
          console.log('Ping received from client');
          
          // 本番環境ではデバッグメッセージを送信しない
          // NODE_ENVとSEND_DEBUG_MESSAGESの環境変数がセットされていなかったので、通常の処理を有効にする
          // if (process.env.NODE_ENV === 'development' && process.env.SEND_DEBUG_MESSAGES === 'true') {
          // デバッグ用のテストエージェント思考は送信せず、ping応答のみを返す
          
          // pong応答を返す
          wsServer.sendToClient(clientId, {
            type: 'pong',
            payload: {
              timestamp: new Date().toISOString()
            }
          });

          
          break;
          
        default:
          console.log(`未処理のメッセージタイプ: ${message.type}`);
          break;
      }
    } catch (error) {
      console.error(`WebSocketメッセージ処理エラー: ${error}`);
    }
  });
  
  console.log('WebSocket統合が設定されました');
}

// ナレッジグラフ生成リクエストの処理
async function handleCreateKnowledgeGraph(roleModelId: string, payload: any): Promise<void> {
  try {
    const { industry, keywords, sources, constraints, requirements } = payload;
    
    console.log(`ナレッジグラフ生成開始: roleModelId=${roleModelId}, industry=${industry}, keywords=${keywords.join(', ')}`);
    
    // 開始メッセージを送信
    sendProgressUpdate({
      message: 'ナレッジグラフの生成を開始しています...',
      percent: 5,
      roleModelId
    });
    
    // まずはリアルタイムフィードバックのために初期メッセージを送信
    // ドメイン分析のデモメッセージ
    sendAgentThoughts(
      'ドメイン分析者',
      `ドメイン分析を開始します。業界: ${industry}、キーワード: ${keywords.join(', ')}の情報を収集します。`,
      roleModelId,
      { step: 'domain_analysis_start' }
    );
    
    // トレンド調査のデモメッセージ
    setTimeout(() => {
      sendAgentThoughts(
        'トレンド調査者',
        `トレンド調査を準備しています。キーワード「${keywords.join('」「')}」に関連するトレンドを分析するための準備をしています。`,
        roleModelId,
        { step: 'trend_research_preparation' }
      );
    }, 1000);
    
    // コンテキストマッパーのデモメッセージ
    setTimeout(() => {
      sendAgentThoughts(
        'コンテキストマッパー',
        `情報の構造化を準備しています。関連キーワードの関係性と階層構造を分析する準備をしています。`,
        roleModelId,
        { step: 'context_mapping_preparation' }
      );
    }, 2000);
    
    // プロセス中間ステップのプログレス更新も送信
    setTimeout(() => {
      sendProgressUpdate({
        message: 'ドメイン分析を実行中...',
        percent: 25,
        roleModelId
      });
    }, 3000);
    
    setTimeout(() => {
      sendProgressUpdate({
        message: 'トレンド調査を実行中...',
        percent: 45,
        roleModelId
      });
    }, 5000);
    
    setTimeout(() => {
      sendProgressUpdate({
        message: '関連情報の構造化を実行中...',
        percent: 65,
        roleModelId
      });
    }, 7000);
    
    // CrewAIナレッジグラフ生成を開始
    console.log('実際のCrewAI処理を開始します...');
    generateKnowledgeGraphWithCrewAI(
      'system', // システムユーザーとして実行（将来的にはWebSocketクライアントのユーザーIDを使用）
      roleModelId,
      industry,
      keywords,
      sources || [],
      constraints || [],
      requirements || []
    ).then(() => {
      // 完了メッセージを送信
      sendProgressUpdate({
        message: 'ナレッジグラフの生成が完了しました',
        percent: 100,
        roleModelId
      });
    }).catch((error: Error) => {
      console.error('CrewAIナレッジグラフ生成エラー:', error);
      
      // エラーメッセージを送信
      sendProgressUpdate({
        message: `ナレッジグラフの生成中にエラーが発生しました: ${error.message}`,
        percent: 0,
        roleModelId
      });
      
      // 詳細なエラー情報も送信
      sendAgentThoughts(
        'システム',
        `エラーが発生しました: ${error.message}\n${error.stack || ''}`,
        roleModelId,
        { 
          step: 'error',
          error: true,
          message: error.message,
          stack: error.stack
        }
      );
    });
    
  } catch (error) {
    console.error('ナレッジグラフ生成リクエストエラー:', error);
    
    // エラーメッセージを送信
    sendProgressUpdate({
      message: 'ナレッジグラフの生成に失敗しました',
      percent: 0,
      roleModelId
    });
  }
}

// 情報収集プラン作成リクエストの処理
async function handleCreateCollectionPlan(roleModelId: string, payload: any): Promise<void> {
  try {
    const { industry, keywords, sources, constraints, requirements } = payload;
    
    console.log(`情報収集プラン作成開始: roleModelId=${roleModelId}, industry=${industry}, keywords=${keywords.join(', ')}`);
    
    // 開始メッセージを送信
    sendProgressUpdate({
      message: '情報収集プランの作成を開始しています...',
      percent: 5,
      roleModelId
    });
    
    // まずはリアルタイムフィードバックのために初期メッセージを送信
    // ドメイン分析のデモメッセージ
    sendAgentThoughts(
      'ドメイン分析者',
      `ドメイン分析を開始します。業界: ${industry}、キーワード: ${keywords.join(', ')}の情報を収集して情報収集プランを策定します。`,
      roleModelId,
      { step: 'domain_analysis_start' }
    );
    
    // プランストラテジストのデモメッセージ
    setTimeout(() => {
      sendAgentThoughts(
        'プランストラテジスト',
        `情報収集プランを立案するための準備をしています。効果的なデータ収集戦略を策定します。`,
        roleModelId,
        { step: 'plan_strategist_preparation' }
      );
      
      // プログレス更新も送信
      sendProgressUpdate({
        message: 'プラン戦略を開発中...',
        percent: 30,
        roleModelId
      });
    }, 1000);
    
    // 処理中のプログレス更新
    setTimeout(() => {
      sendAgentThoughts(
        '批評的思考者',
        `情報収集プランの評価基準を確立しています。品質と網羅性を確保するためのチェックポイントを設定します。`,
        roleModelId,
        { step: 'processing' }
      );
      
      sendProgressUpdate({
        message: '情報フレームワークを構築中...',
        percent: 50,
        roleModelId
      });
    }, 3000);
    
    setTimeout(() => {
      sendAgentThoughts(
        'プランストラテジスト',
        `情報収集プランの詳細を作成しています。重要な情報源、優先すべき領域、情報の検証方法を含めた包括的なプランを構築します。`,
        roleModelId,
        { step: 'result_compilation' }
      );
      
      sendProgressUpdate({
        message: 'プランの詳細を作成中...',
        percent: 70,
        roleModelId
      });
    }, 5000);
    
    // CrewAI情報収集プラン作成を開始（ナレッジグラフ更新はスキップ）
    console.log('実際のCrewAI処理を開始します（情報収集プランのみ）...');
    
    // 新しいcollectionPlan専用メソッドを使用
    CrewAIService.startCollectionPlanGeneration(
      'system', // システムユーザーとして実行（将来的にはWebSocketクライアントのユーザーIDを使用）
      roleModelId,
      industry,
      keywords,
      sources || [],
      constraints || [],
      requirements || []
    ).then(() => {
      // 完了メッセージを送信
      sendProgressUpdate({
        message: '情報収集プランの作成が完了しました',
        percent: 100,
        roleModelId
      });
      
      sendAgentThoughts(
        'プランストラテジスト',
        `情報収集プランが完成しました。このプランに基づいて効率的に情報を収集できます。`,
        roleModelId,
        { step: 'finalization' }
      );
    }).catch((error: Error) => {
      console.error('CrewAI情報収集プラン作成エラー:', error);
      
      // エラーメッセージを送信
      sendProgressUpdate({
        message: `情報収集プランの作成中にエラーが発生しました: ${error.message}`,
        percent: 0,
        roleModelId
      });
      
      // 詳細なエラー情報も送信
      sendAgentThoughts(
        'システム',
        `エラーが発生しました: ${error.message}\n${error.stack || ''}`,
        roleModelId,
        { 
          step: 'error',
          error: true,
          message: error.message,
          stack: error.stack
        }
      );
    });
    
  } catch (error) {
    console.error('情報収集プラン作成リクエストエラー:', error);
    
    // エラーメッセージを送信
    sendProgressUpdate({
      message: '情報収集プランの作成に失敗しました',
      percent: 0,
      roleModelId
    });
  }
}