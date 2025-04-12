/**
 * WebSocketメッセージハンドラ
 * クライアントから受信したWebSocketメッセージを処理する
 */

import * as websocket from './websocket';
import * as aiAgentService from './services/ai-agent-service';

/**
 * ナレッジグラフ生成リクエストを処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID
 */
export async function handleCreateKnowledgeGraph(message: any, roleModelId: string) {
  try {
    console.log('ナレッジグラフ生成リクエスト処理:', message);

    const payload = message.payload || message;
    
    // メイントピックとサブトピックを取得
    const mainTopic = payload.mainTopic || payload.industry || '一般';
    const subTopics = payload.keywords && payload.keywords.length > 0
      ? payload.keywords
      : ['情報収集', 'ナレッジ管理', 'データ分析', '意思決定支援'];
    
    // AIエージェントサービスを使用してナレッジグラフ作成フローを実行
    const result = await aiAgentService.runKnowledgeGraphCreationFlow(
      roleModelId, 
      {
        mainTopic,
        subTopics,
        overwrite: true // 常に既存グラフを上書き
      }
    );
    
    return result;
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
    
    // メイントピックとキーワードを取得
    const mainTopic = payload.mainTopic || payload.industry || '一般';
    const keywords = payload.keywords && payload.keywords.length > 0
      ? payload.keywords
      : ['情報収集', 'ナレッジ管理', 'データ分析', '意思決定支援'];
    
    // AIエージェントサービスを使用して情報収集プラン作成フローを実行
    const result = await aiAgentService.runCollectionPlanCreationFlow(
      roleModelId,
      {
        mainTopic,
        keywords
      }
    );
    
    return result;
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
 * 情報収集実行リクエストを処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID 
 */
export async function handleExecuteCollectionPlan(message: any, roleModelId: string) {
  try {
    console.log('情報収集実行リクエスト処理:', message);
    
    const payload = message.payload || message;
    const planId = payload.planId || `plan-${Date.now()}`;
    
    // AIエージェントサービスを使用して情報収集実行フローを実行
    const result = await aiAgentService.runCollectionExecutionFlow(
      roleModelId,
      planId
    );
    
    return result;
  } catch (err) {
    const error = err as Error;
    console.error('情報収集実行エラー:', error);
    
    // エラー進捗更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      '情報収集実行中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    return false;
  }
}

/**
 * ナレッジグラフ更新レコメンドリクエストを処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID
 */
export async function handleGraphUpdateRecommendation(message: any, roleModelId: string) {
  try {
    console.log('ナレッジグラフ更新レコメンドリクエスト処理:', message);
    
    const payload = message.payload || message;
    const reports = payload.reports || [];
    
    // AIエージェントサービスを使用してナレッジグラフ更新レコメンドフローを実行
    const result = await aiAgentService.runGraphUpdateRecommendationFlow(
      roleModelId,
      reports
    );
    
    return result;
  } catch (err) {
    const error = err as Error;
    console.error('ナレッジグラフ更新レコメンドエラー:', error);
    
    // エラー進捗更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      'ナレッジグラフ更新レコメンド中にエラーが発生しました',
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