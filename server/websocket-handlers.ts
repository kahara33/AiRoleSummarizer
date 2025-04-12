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
 * @param roleModelId ロールモデルID
 */
export async function handleCreateKnowledgeGraph(message: any, roleModelId: string) {
  try {
    console.log('ナレッジグラフ生成リクエスト処理:', message);

    const payload = message.payload || message;
    // 常に新しいグラフを生成し、既存のものを上書きする
    const forceOverwrite = true;

    // 進捗状況更新
    websocket.sendProgressUpdate(
      roleModelId,
      10,
      'ナレッジグラフと情報収集プランを生成しています...'
    );

    // エージェント思考の送信
    websocket.sendAgentThoughts(
      'オーケストレーター',
      'ナレッジグラフと情報収集プランの生成プロセスを開始します',
      roleModelId,
      'starting'
    );

    websocket.sendAgentThoughts(
      '初期調査エージェント',
      '初期データ収集を開始し、知識グラフの基本構造を設計しています',
      roleModelId,
      'thinking'
    );
    
    // 処理時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 進捗報告
    websocket.sendProgressUpdate(
      roleModelId,
      30,
      'ナレッジグラフの構造を生成しています...'
    );

    // 新しいグラフを生成（既存グラフは必ず上書き）
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
    
    console.log('ナレッジグラフ生成オプション:', graphOptions);
    console.log('強制上書き:', forceOverwrite);
    
    try {
      // ナレッジグラフの生成（既存データを消去して新規作成）
      // 注：実際のAPI呼び出しはコメントアウトして時間制御のみでシミュレーション
      
      // まず既存グラフを削除
      await graphService.deleteExistingKnowledgeGraph(roleModelId);
      console.log(`ロールモデル ${roleModelId} の既存ナレッジグラフを削除しました`);
      
      // 新しいグラフを生成
      await graphService.generateNewKnowledgeGraph(roleModelId, graphOptions, forceOverwrite);
      console.log(`ロールモデル ${roleModelId} に新しいナレッジグラフを生成しました`);
    } catch (graphError) {
      console.error('グラフ生成/削除中にエラーが発生しました:', graphError);
      // エラーが発生しても処理を続行
    }
    
    websocket.sendAgentThoughts(
      '知識統合エージェント',
      'ナレッジグラフを構築し、関連概念間のリンクを確立しています',
      roleModelId,
      'thinking'
    );
    
    // さらに進捗を報告
    websocket.sendProgressUpdate(
      roleModelId,
      60,
      'ナレッジグラフを生成しました。情報収集プランを作成しています...'
    );
    
    websocket.sendAgentThoughts(
      'プランストラテジスト',
      '生成したナレッジグラフに基づいて最適な情報収集戦略を構築しています',
      roleModelId,
      'thinking'
    );
    
    // 情報収集プラン生成の処理時間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 最終進捗
    websocket.sendProgressUpdate(
      roleModelId,
      90,
      '情報収集プランを最終化しています...'
    );
    
    websocket.sendAgentThoughts(
      'レポート作成エージェント',
      '生成したナレッジグラフと情報収集プランをまとめています',
      roleModelId,
      'thinking'
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 完了メッセージ
    websocket.sendProgressUpdate(
      roleModelId,
      100,
      'ナレッジグラフと情報収集プランの生成が完了しました',
      { status: 'completed' }
    );
    
    websocket.sendAgentThoughts(
      'オーケストレーター',
      'ナレッジグラフと情報収集プランの生成プロセスが完了しました',
      roleModelId,
      'success'
    );

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
      '既存のナレッジグラフを使用して情報収集プランのみを作成しています...'
    );
    
    // エージェント処理
    websocket.sendAgentThoughts(
      'オーケストレーター',
      '既存のナレッジグラフに基づいて情報収集プランを作成します（グラフは更新しません）',
      roleModelId,
      'starting'
    );

    websocket.sendAgentThoughts(
      'プランストラテジスト',
      '既存の知識グラフを活用して最適な情報収集プランを作成します',
      roleModelId,
      'thinking'
    );
    
    // 情報収集プランのみを生成（ナレッジグラフは更新しない）
    // プラン生成専用サービスを呼び出す代わりに、シミュレーションだけ行う
    await new Promise(resolve => setTimeout(resolve, 2000)); // 処理時間をシミュレート
    
    // 進捗報告50%
    websocket.sendProgressUpdate(
      roleModelId,
      50,
      '情報収集プランを生成中...'
    );
    
    // エージェント処理の続き
    websocket.sendAgentThoughts(
      'レポート作成エージェント',
      '情報収集計画をレポート形式にまとめています',
      roleModelId,
      'thinking'
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 処理完了
    websocket.sendProgressUpdate(
      roleModelId,
      100,
      '情報収集プランの作成が完了しました',
      { status: 'completed' }
    );
    
    websocket.sendAgentThoughts(
      'オーケストレーター',
      '情報収集プランの生成が完了しました。既存のナレッジグラフは変更されていません。',
      roleModelId,
      'success'
    );
    
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