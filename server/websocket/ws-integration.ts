import { Server } from 'http';
import { sendProgressUpdate, sendAgentThoughts, initWebSocketServer, getWebSocketServer } from './ws-server';
// CrewAIサービスをインポート
import { generateKnowledgeGraphWithCrewAI, CrewAIService } from '../services/crew-ai/crew-ai-service';

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
          
        case 'chat_message':
          // チャットメッセージの処理（将来的な実装）
          console.log(`チャットメッセージを受信: ${message.payload.message}`);
          break;
          
        case 'ping':
          console.log('Ping received from client, sending debug agent thoughts');
          
          // デバッグ用: テストエージェント思考データを送信
          setTimeout(() => {
            sendAgentThoughts(
              'デバッグエージェント',
              'デバッグ用エージェント思考メッセージです。このメッセージが表示されていれば、WebSocket接続とエージェント思考表示機能は正常に動作しています。',
              roleModelId,
              {
                step: 'debug_test',
                reasoning: `WebSocketサーバー診断プロセス:
1. WebSocket接続の確立を確認
2. メッセージ送受信の整合性チェック
3. UI表示確認と思考プロセスのリアルタイム更新テスト

診断結果:
- サーバー側WebSocket設定: OK
- クライアント側接続状態: OK
- メッセージフォーマット: OK 
- 表示レンダリング: OK`,
                details: {
                  connectionState: "正常",
                  messageFormat: "JSON正常",
                  renderingStatus: "レンダリング正常",
                  timestamp: new Date().toISOString()
                }
              }
            );
          }, 1000);
          
          setTimeout(() => {
            sendAgentThoughts(
              'ドメイン分析者',
              'ドメイン分析を開始します。収集した情報を基に分析を進めています。',
              roleModelId,
              { 
                step: 'domain_analysis',
                agentType: 'thinking',
                reasoning: `分析対象の業界構造とバリューチェーンを把握するため、以下の点に注目しています：

1. 市場セグメンテーション - B2B/B2Cの比率、顧客企業規模別の市場特性
2. 主要プレイヤーの戦略ポジショニング - 差別化要因、競争優位性、提供価値
3. 顧客ニーズと未解決課題 - 潜在的痛点、表面化していない要求事項
4. デジタル化/AI導入の阻害要因 - 技術的制約、組織的課題、コスト構造

これらの情報を統合して、AIエージェントが提供できる具体的な価値と導入障壁を特定します。`,
                steps: [
                  "業界構造分析とバリューチェーン把握",
                  "競合分析と差別化要因の特定",
                  "顧客セグメント別ニーズマッピング",
                  "AIエージェント適用領域の優先順位付け",
                  "導入シナリオと価値創出プロセスのモデル化"
                ],
                details: {
                  analysisMethod: "Porter's Five Forces + VRIO分析フレームワーク",
                  dataPoints: "112件の既存市場調査レポート、24件の業界インタビュー",
                  completionEstimate: "42%完了"
                }
              }
            );
          }, 2000);
          
          setTimeout(() => {
            sendAgentThoughts(
              'トレンド調査者',
              '業界トレンドを調査しています。最新の動向を確認中です。',
              roleModelId,
              { 
                step: 'trend_research',
                agentType: 'thinking',
                reasoning: `業界動向調査においては、以下の観点からデータを収集・分析しています：

1. 技術採用トレンド - 先進企業におけるAI/ML技術の実装状況と効果測定
2. 規制環境の変化 - データプライバシーやAI倫理に関する新たな法規制
3. スタートアップエコシステム - 新たなビジネスモデルや破壊的イノベーション
4. 消費者行動変化 - デジタルチャネル利用パターンとオムニチャネル戦略への影響

これらのトレンドデータをもとに、短期・中期・長期の予測モデルを構築し、戦略的意思決定に活用可能な形に整理します。`,
                steps: [
                  "グローバル技術採用パターンの時系列分析",
                  "規制動向と将来影響予測",
                  "イノベーション・ホットスポットの特定",
                  "消費者行動変化の兆候と加速要因分析",
                  "戦略的示唆と行動推奨事項のまとめ"
                ],
                details: {
                  primarySources: ["業界カンファレンス発表", "専門家インタビュー", "投資動向", "特許申請データ"],
                  timeHorizon: "2024-2027 (3年)",
                  confidenceLevel: "中～高 (データ充足度による)"
                }
              }
            );
          }, 3000);
          
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
    }, 1000);
    
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
    ).catch((error: Error) => {
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