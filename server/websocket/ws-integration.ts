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
    
    // ドメイン分析のデモメッセージ
    setTimeout(() => {
      sendAgentThoughts(
        'ドメイン分析者',
        `ドメイン分析を開始します。業界: ${industry}、キーワード: ${keywords.join(', ')}`,
        roleModelId,
        { step: 'domain_analysis' }
      );
    }, 1000);
    
    // 進捗更新
    setTimeout(() => {
      sendProgressUpdate({
        message: 'ドメイン分析中...',
        percent: 15,
        roleModelId
      });
    }, 2000);
    
    // トレンド調査のデモメッセージ
    setTimeout(() => {
      sendAgentThoughts(
        'トレンド調査者',
        `トレンド調査を開始します。キーワード ${keywords[0]} に関連するトレンドを分析しています。`,
        roleModelId,
        { step: 'trend_research' }
      );
    }, 3000);
    
    // 進捗更新
    setTimeout(() => {
      sendProgressUpdate({
        message: 'トレンド調査中...',
        percent: 30,
        roleModelId
      });
    }, 4000);
    
    // CrewAIナレッジグラフ生成を開始
    // 実際のCrewAI処理を開始
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
      const wss = getWebSocketServer();
      if (wss) {
        wss.sendToRoleModelViewers(roleModelId, {
          type: 'crewai_error',
          payload: {
            message: 'ナレッジグラフの生成中にエラーが発生しました',
            error: error.message
          }
        });
      }
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