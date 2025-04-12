/**
 * WebSocketメッセージハンドラ
 * クライアントから受信したWebSocketメッセージを処理する
 */
import * as graphService from './services/graph-service-adapter';
import * as websocket from './websocket';
import * as knowledgeLibraryService from './services/crew-ai/knowledge-library-service';

/**
 * ナレッジグラフ生成リクエストを処理する
 * @param message 受信したメッセージ
 * @param ws WebSocketインスタンス
 */
export async function handleCreateKnowledgeGraph(message: any, roleModelId: string) {
  try {
    console.log('ナレッジグラフ生成リクエスト処理:', message);

    const payload = message.payload || message;
    const useExistingGraph = payload.useExistingGraph === true;
    const includeCollectionPlan = payload.includeCollectionPlan !== false; // デフォルトtrue
    const forceOverwrite = !useExistingGraph; // 既存グラフを使用しない場合は強制上書き

    // 進捗状況更新
    websocket.sendProgressUpdate(
      roleModelId,
      10,
      useExistingGraph 
        ? '既存のナレッジグラフを使用して情報収集プランを作成しています...'
        : 'ナレッジグラフと情報収集プランを生成しています...'
    );

    // エージェント処理
    websocket.sendAgentThoughts(
      'オーケストレーター',
      useExistingGraph
        ? '既存のナレッジグラフに基づいて情報収集プランを作成します'
        : 'ナレッジグラフと情報収集プランの生成プロセスを開始します',
      roleModelId,
      'starting'
    );

    if (!useExistingGraph) {
      // 強制上書きモードでナレッジグラフを生成
      const mainTopicName = payload.mainTopic || payload.industry || '一般';
      
      // サブトピックの生成（キーワードがあればそれを使用、なければデフォルト）
      const keywords = payload.keywords && payload.keywords.length > 0
        ? payload.keywords
        : ['情報収集', 'ナレッジ管理', 'データ分析', '意思決定支援'];
      
      // グラフ生成オプション
      const graphOptions = {
        mainTopic: mainTopicName,
        subTopics: keywords,
        description: `${mainTopicName}に関するナレッジグラフ`,
        createdBy: payload.userId
      };
      
      // 新しいグラフを生成（既存グラフがあれば上書き）
      await graphService.generateNewKnowledgeGraph(roleModelId, graphOptions, forceOverwrite);
    }

    // 情報収集プラン生成を処理
    const result = await knowledgeLibraryService.runKnowledgeLibraryProcess(
      roleModelId, 
      'auto-generated', 
      {
        title: payload.mainTopic || payload.industry || '一般情報収集',
        industries: [payload.industry || '一般'],
        keywords: payload.keywords || ['情報収集', 'ナレッジグラフ']
      }
    );

    // 処理結果に基づいてメッセージを送信
    if (result) {
      websocket.sendProgressUpdate(
        roleModelId,
        100,
        useExistingGraph 
          ? '情報収集プランの作成が完了しました'
          : 'ナレッジグラフと情報収集プランの生成が完了しました',
        { status: 'completed' }
      );
    } else {
      websocket.sendProgressUpdate(
        roleModelId,
        0,
        '処理中にエラーが発生しました',
        { status: 'error' }
      );
    }

    return true;
  } catch (err) {
    const error = err as Error;
    console.error('ナレッジグラフ生成エラー:', error);
    
    // エラー進捗更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      'ナレッジグラフ生成中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    return false;
  }
}

/**
 * 情報収集プラン生成リクエストを処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID
 */
export async function handleCreateCollectionPlan(message: any, roleModelId: string) {
  try {
    console.log('情報収集プラン生成リクエスト処理:', message);
    
    const payload = message.payload || message;
    
    // 進捗状況更新
    websocket.sendProgressUpdate(
      roleModelId,
      10,
      '既存のナレッジグラフを使用して情報収集プランを作成しています...'
    );
    
    // エージェント処理
    websocket.sendAgentThoughts(
      'オーケストレーター',
      '既存のナレッジグラフに基づいて情報収集プランを作成します',
      roleModelId,
      'starting'
    );
    
    // 情報収集プラン生成を処理
    const result = await knowledgeLibraryService.runKnowledgeLibraryProcess(
      roleModelId, 
      'auto-generated', 
      {
        title: payload.mainTopic || payload.industry || '一般情報収集',
        industries: [payload.industry || '一般'],
        keywords: payload.keywords || ['情報収集', 'ナレッジグラフ']
      }
    );
    
    // 処理結果に基づいてメッセージを送信
    if (result) {
      websocket.sendProgressUpdate(
        roleModelId,
        100,
        '情報収集プランの作成が完了しました',
        { status: 'completed' }
      );
    } else {
      websocket.sendProgressUpdate(
        roleModelId,
        0,
        '処理中にエラーが発生しました',
        { status: 'error' }
      );
    }
    
    return true;
  } catch (err) {
    const error = err as Error;
    console.error('情報収集プラン生成エラー:', error);
    
    // エラー進捗更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      '情報収集プラン生成中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    return false;
  }
}

/**
 * キャンセル操作を処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID
 */
export async function handleCancelOperation(message: any, roleModelId: string) {
  try {
    console.log('操作キャンセルリクエスト処理:', message);
    
    const payload = message.payload || message;
    const operationType = payload.operationType || 'unknown';
    
    // 進捗状況更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      `${operationType}操作をキャンセルしました`,
      { status: 'cancelled' }
    );
    
    // エージェント処理
    websocket.sendAgentThoughts(
      'システム',
      `${operationType}の処理がキャンセルされました`,
      roleModelId,
      'cancelled'
    );
    
    return true;
  } catch (error) {
    console.error('キャンセル処理エラー:', error);
    return false;
  }
}