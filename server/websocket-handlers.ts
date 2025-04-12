/**
 * WebSocketメッセージハンドラ
 * クライアントから受信したWebSocketメッセージを処理する
 */

import * as websocket from './websocket';
import * as aiAgentService from './services/ai-agent-service';
import * as userFeedbackService from './services/user-feedback-service';

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
 * ユーザーフィードバックを処理する
 * @param message 受信したメッセージ
 * @param roleModelId ロールモデルID
 */
export async function handleUserFeedback(message: any, roleModelId: string) {
  try {
    console.log('ユーザーフィードバック処理:', message);
    
    const payload = message.payload || message;
    const feedbackType = payload.feedbackType || userFeedbackService.FeedbackType.GENERAL_COMMENT;
    
    // フィードバックオブジェクトを作成
    const feedback: userFeedbackService.UserFeedback = {
      roleModelId,
      feedbackType,
      data: payload.data,
      timestamp: Date.now()
    };
    
    // フィードバックを処理
    const result = await userFeedbackService.processFeedback(feedback);
    
    if (result) {
      // 成功メッセージ
      websocket.sendProgressUpdate(
        roleModelId,
        100,
        'フィードバックを反映しました',
        { 
          status: 'feedback_processed',
          feedbackType
        }
      );
      
      // 次のステップの通知（要約サンプル選択の場合）
      if (feedbackType === userFeedbackService.FeedbackType.SUMMARY_PREFERENCE) {
        // フィードバックを基にグラフを更新
        websocket.sendProgressUpdate(
          roleModelId,
          75,
          'ユーザーのフィードバックに基づいてナレッジグラフと収集プランを更新しています...',
          { status: 'updating_graph' }
        );
        
        // ナレッジグラフの更新処理
        const mainTopic = payload.data.mainTopic || payload.mainTopic || 'AI';
        
        // グラフ更新が完了したら情報収集プランを生成
        websocket.sendProgressUpdate(
          roleModelId,
          90,
          'ナレッジグラフを最適化しました。情報収集プランを生成中...',
          { status: 'graph_updated' }
        );
        
        // 情報収集プラン作成を開始
        websocket.sendProgressUpdate(
          roleModelId,
          95,
          'ユーザーフィードバックを反映した情報収集プランを生成しています...',
          { status: 'creating_collection_plan' }
        );
        
        // 情報収集プラン作成フローを実行（非同期で行う）
        setTimeout(async () => {
          try {
            const collectionPlanResult = await aiAgentService.runCollectionPlanCreationFlow(
              roleModelId,
              {
                mainTopic: mainTopic,
                keywords: Array.isArray(payload.data.preferredSummaryTypes) 
                  ? payload.data.preferredSummaryTypes 
                  : []
              }
            );
            
            console.log('情報収集プラン作成完了:', collectionPlanResult);
          } catch (planError) {
            console.error('情報収集プラン作成エラー:', planError);
          }
        }, 3000);
      }
      
      // サンプル収集リクエストの場合は、サンプル提示フローを開始
      if (feedbackType === 'request_samples' || feedbackType === userFeedbackService.FeedbackType.REQUEST_SAMPLES) {
        const topic = payload.data?.topic || payload.topic || 'AI';
        
        // 非同期でユーザーフィードバック収集フローを実行
        aiAgentService.runUserFeedbackCollectionFlow(roleModelId, topic)
          .then(flowResult => {
            console.log('ユーザーフィードバック収集フロー完了:', flowResult);
          })
          .catch(flowError => {
            console.error('ユーザーフィードバック収集フローエラー:', flowError);
          });
      }
    } else {
      // エラーメッセージ
      websocket.sendProgressUpdate(
        roleModelId,
        0,
        'フィードバックの処理中にエラーが発生しました',
        { 
          status: 'error',
          error: 'フィードバック処理エラー'
        }
      );
    }
    
    return result;
  } catch (err) {
    const error = err as Error;
    console.error('ユーザーフィードバック処理エラー:', error);
    
    // エラー進捗更新
    websocket.sendProgressUpdate(
      roleModelId,
      0,
      'フィードバック処理中にエラーが発生しました',
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