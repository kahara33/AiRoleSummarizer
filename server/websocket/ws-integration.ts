import { Server } from 'http';
import { sendProgressUpdate, sendAgentThoughts, initWebSocketServer, getWebSocketServer } from './ws-server';
// CrewAIサービスをインポート
import { generateKnowledgeGraphWithCrewAI } from '../services/crew-ai/crew-ai-service';

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
          
        case 'chat_message':
          // チャットメッセージの処理（将来的な実装）
          console.log(`チャットメッセージを受信: ${message.payload.message}`);
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
    ).catch((error: Error) => {
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