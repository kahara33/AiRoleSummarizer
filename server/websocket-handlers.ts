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
        try {
          // フィードバックを基にグラフを更新
          websocket.sendProgressUpdate(
            roleModelId,
            75,
            'ユーザーのフィードバックに基づいてナレッジグラフと収集プランを更新しています...',
            { status: 'updating_graph' }
          );
          
          // フィードバックデータの準備
          const mainTopic = payload.data.mainTopic || payload.mainTopic || 'AI';
          const subTopics = Array.isArray(payload.data.keywords) ? payload.data.keywords : [];
          const preferredSummaryTypes = Array.isArray(payload.data.preferredSummaryTypes) 
            ? payload.data.preferredSummaryTypes 
            : [];
          
          // ナレッジグラフ作成フェーズ2の実行（ユーザーフィードバック反映）
          console.log('ナレッジグラフ作成フェーズ2（フィードバック反映）を開始します');
          
          // 非同期で処理を実行して処理をブロックしないようにする
          setTimeout(async () => {
            try {
              // completeKnowledgeGraphCreation関数を呼び出して、AIプロセスのフェーズ2を実行
              const result = await aiAgentService.completeKnowledgeGraphCreation(
                roleModelId,
                {
                  preferredSummaryTypes,
                  additionalComments: payload.data.comments
                },
                mainTopic,
                subTopics
              );
              
              console.log('ナレッジグラフフェーズ2完了:', result);
            } catch (error) {
              console.error('ナレッジグラフフェーズ2エラー:', error);
              
              // エラー進捗更新
              websocket.sendProgressUpdate(
                roleModelId,
                0,
                'ナレッジグラフの最終化中にエラーが発生しました',
                { 
                  status: 'error',
                  error: error instanceof Error ? error.message : '不明なエラー'
                }
              );
            }
          }, 1000);
        } catch (error) {
          console.error('フィードバック処理のフェーズ2初期化エラー:', error);
          websocket.sendProgressUpdate(
            roleModelId,
            0,
            'フィードバック処理の初期化中にエラーが発生しました',
            { status: 'error', error: 'initialization_error' }
          );
        }
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
    
    // エージェント処理（システム通知として送信）
    websocket.sendMessage({
      type: 'agent_thought',
      agentType: 'システム', 
      content: `${operationType}の処理がキャンセルされました`,
      roleModelId,
      status: 'cancelled'
    });
    
    return true;
  } catch (error) {
    console.error('キャンセル処理エラー:', error);
    return false;
  }
}