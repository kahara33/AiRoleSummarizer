/**
 * CrewAIサービス
 * WebSocketを通じてフロントエンドと連携するCrewAIのメインインターフェース
 */
import { createCrewManager } from './crew-manager';
import { sendProgressUpdate, sendAgentThoughts } from '../../websocket/ws-server';
import { sendDebugAgentThought, sendRoleModelDemoThoughts } from '../../websocket/debug-message-helper';

/**
 * CrewAIサービスクラス
 * ナレッジグラフ生成プロセスとWebSocket通信を管理
 */
export class CrewAIService {
  /**
   * ナレッジグラフ生成プロセスを開始
   * skipGraphUpdate: ナレッジグラフ更新をスキップし、情報収集プランのみを生成する場合はtrue
   */
  static async startKnowledgeGraphGeneration(
    userId: string,
    roleModelId: string,
    industry: string,
    initialKeywords: string[],
    potentialSources: string[] = [],
    resourceConstraints: string[] = [],
    originalRequirements: string[] = [],
    skipGraphUpdate: boolean = false
  ): Promise<any> {
    try {
      // ナレッジグラフ生成時は情報収集プランも含めて統合プロセスとして実行
      const processType = skipGraphUpdate ? '情報収集プラン作成' : 'ナレッジグラフと情報収集プラン生成';
      console.log(`CrewAI ${processType}プロセスを開始: roleModelId=${roleModelId}, industry=${industry}, keywords=${initialKeywords.join(', ')}`);
      
      // 最初のシステムメッセージを送信
      sendAgentThoughts(
        'システム',
        `CrewAI ${processType}を開始しています。WebSocketメッセージのテスト。`,
        roleModelId,
        {
          step: 'startup',
          timestamp: new Date().toISOString()
        }
      );
      
      // WebSocket接続テストメッセージ
      sendAgentThoughts(
        'システム',
        `WebSocket接続テスト: CrewAI ${processType}プロセスが開始されました。エージェント間の会話がここに表示されます。`,
        roleModelId,
        {
          industry,
          keywords: initialKeywords,
          step: 'startup',
          timestamp: new Date().toISOString()
        }
      );
      
      // 専門分析者からのメッセージ送信
      sendAgentThoughts(
        '専門分析',
        `新しい分析タスクを開始しています。業界: ${industry}、キーワード: ${initialKeywords.join(', ')}`,
        roleModelId,
        {
          step: 'domain_analysis_start',
          timestamp: new Date().toISOString()
        }
      );
      
      // 進捗状況を送信
      const initialMessage = skipGraphUpdate
        ? 'CrewAIで情報収集プランの作成を開始しています...' 
        : 'CrewAIでナレッジグラフと情報収集プランの生成を開始しています...';
      
      sendProgressUpdate({
        message: initialMessage,
        percent: 5,
        roleModelId
      });
      
      // 注: デモ思考プロセス生成は削除 - 実際のAI処理のみを表示するため
      
      // CrewManagerの作成 - roleModelIdを渡す
      const crewManager = createCrewManager(
        industry,
        initialKeywords,
        potentialSources,
        resourceConstraints,
        originalRequirements,
        roleModelId
      );
      
      // イベントリスナーの設定
      
      // エージェントの思考プロセスをクライアントに送信
      crewManager.on('agentThought', (data) => {
        const { agentName, thought, taskName } = data;
        console.log(`CrewAIエージェント思考: ${agentName} - ${thought.substring(0, 50)}...`);
        
        // エージェント名に基づいてメッセージタイプを決定
        let messageType = 'thinking';
        if (agentName.includes('ドメイン') || agentName === 'Domain Analyst') {
          messageType = 'domain_analysis';
        } else if (agentName.includes('トレンド') || agentName === 'Trend Researcher') {
          messageType = 'trend_research';
        } else if (agentName.includes('コンテキスト') || agentName === 'Context Mapper') {
          messageType = 'context_mapping';
        } else if (agentName.includes('プラン') || agentName === 'Plan Strategist') {
          messageType = 'plan_strategy';
        } else if (agentName.includes('クリティカル') || agentName === 'Critical Thinker') {
          messageType = 'critical_thinking';
        }
        
        sendAgentThoughts(
          agentName,
          thought,
          roleModelId,
          {
            industry,
            keywords: initialKeywords,
            timestamp: new Date().toISOString(),
            taskName: taskName || 'unknown',
            type: messageType
          }
        );
      });
      
      // 進捗状況をクライアントに送信
      crewManager.on('progress', (data) => {
        const { stage, progress, detail } = data;
        console.log(`CrewAI進捗状況: ${stage} - ${progress}% - ${detail}`);
        
        // 進捗更新に応じたエージェント名とメッセージタイプを決定
        let agentName = 'オーケストレーター';
        let messageType = 'info';
        
        if (stage === '業界分析') {
          agentName = 'ドメイン分析者';
        } else if (stage === '情報源評価') {
          agentName = 'トレンドリサーチャー';
        } else if (stage === 'グラフ構造設計') {
          agentName = 'コンテキストマッパー';
        } else if (stage === 'プラン策定') {
          agentName = 'プランストラテジスト';
        } else if (stage === '品質評価' || stage === '最終統合' || stage === '改善サイクル') {
          agentName = 'クリティカルシンカー';
        }
        
        // 進捗状況をエージェント思考イベントとしても送信
        sendAgentThoughts(
          agentName,
          detail,
          roleModelId,
          {
            stage,
            progress,
            timestamp: new Date().toISOString(),
            type: messageType
          }
        );
        
        // 通常の進捗更新も送信
        sendProgressUpdate({
          message: detail,
          percent: progress,
          roleModelId
        });
      });
      
      // タスク完了イベントをクライアントに送信
      crewManager.on('taskCompleted', (data) => {
        const { taskName, result } = data;
        console.log(`CrewAIタスク完了: ${taskName}`);
        
        // タスク名から担当エージェントを決定
        let agentName = 'タスクマネージャー';
        let messageType = 'success';
        
        if (taskName === 'AnalyzeIndustryTask') {
          agentName = 'ドメイン分析者';
        } else if (taskName === 'EvaluateSourcesTask') {
          agentName = 'トレンドリサーチャー';
        } else if (taskName === 'DesignGraphStructureTask') {
          agentName = 'コンテキストマッパー';
        } else if (taskName === 'DevelopCollectionPlanTask') {
          agentName = 'プランストラテジスト';
        } else if (taskName === 'EvaluateQualityTask' || taskName === 'IntegrateAndDocumentTask') {
          agentName = 'クリティカルシンカー';
        }
        
        // タスク完了をエージェント思考として送信
        sendAgentThoughts(
          agentName,
          `タスク「${taskName}」が完了しました。`,
          roleModelId,
          {
            taskName,
            timestamp: new Date().toISOString(),
            type: messageType
          }
        );
        
        // 重要なタスクの結果をよりわかりやすく表示
        if (taskName === 'DevelopCollectionPlan') {
          try {
            const planSummary = typeof result === 'string' 
              ? result 
              : typeof result.summary === 'string' 
                ? result.summary 
                : JSON.stringify(result).substring(0, 200) + '...';
                
            sendAgentThoughts(
              'プランストラテジスト',
              `情報収集プランの概要: ${planSummary}`,
              roleModelId,
              {
                planDetails: result,
                isResult: true,
                timestamp: new Date().toISOString()
              }
            );
          } catch (err) {
            console.error('プラン結果処理エラー:', err);
          }
        }
      });
      
      // エラーイベントをクライアントに送信
      crewManager.on('error', (err) => {
        console.error('CrewAIエラー:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // エラーメッセージをエージェント思考として送信
        sendAgentThoughts(
          'オーケストレーター',
          `処理中にエラーが発生しました: ${errorMessage}`,
          roleModelId,
          {
            timestamp: new Date().toISOString(),
            type: 'error',
            error: errorMessage
          }
        );
        
        // 通常のエラー更新も送信
        sendProgressUpdate({
          message: `エラーが発生しました: ${errorMessage}`,
          percent: 0,
          roleModelId
        });
      });
      
      // 非同期でナレッジグラフ生成/情報収集プラン作成を実行
      console.log(`CrewAI ${processType}プロセスを開始します...`);
      sendAgentThoughts(
        '調整役',
        `${processType}プロセスを開始します。\nナレッジグラフ生成プロセスを開始します`,
        roleModelId,
        {
          timestamp: new Date().toISOString(),
          type: 'info'
        }
      );
      
      // 非同期でCrewAIプロセスを実行し、エラーハンドリングを強化
      try {
        // CrewAIのナレッジグラフ生成を実行
        const result = await crewManager.generateKnowledgeGraph(skipGraphUpdate);
        console.log(`CrewAI ${processType}プロセスが完了しました`);
        
        // 正常終了時のメッセージを送信
        sendAgentThoughts(
          'オーケストレーター',
          `CrewAI ${processType}プロセスが完了しました。全エージェントのタスクが正常に終了しました。`,
          roleModelId,
          {
            timestamp: new Date().toISOString(),
            type: 'success'
          }
        );
        
        // 結果のメッセージを送信
        if (result) {
          if (skipGraphUpdate) {
            // 情報収集プランの結果を送信
            sendAgentThoughts(
              'クリティカルシンカー',
              '情報収集プランが完成しました。このプランには、情報収集の優先順位、リソース配分、スケジュール、成功指標が含まれています。',
              roleModelId,
              {
                result: result.collectionPlan,
                isCollectionPlan: true,
                timestamp: new Date().toISOString()
              }
            );
          } else {
            // ナレッジグラフと情報収集プランの両方の結果を送信
            sendAgentThoughts(
              'クリティカルシンカー',
              '最終的なナレッジグラフと情報収集プランが完成しました。改善サイクルによって品質が向上しています。',
              roleModelId,
              {
                result: result,
                isComplete: true,
                hasImprovements: !!result.improvementNotes,
                timestamp: new Date().toISOString()
              }
            );
          }
        }
        
        // 完了を示す進捗更新を送信（クライアントでボタン状態をリセットするため）
        sendProgressUpdate({
          message: `${processType}が正常に完了しました`,
          percent: 100,
          roleModelId,
          status: 'completed' // 状態フラグを追加
        });
        
        return result;
      } catch (error) {
        // エラー発生時のログとメッセージ処理
        console.error(`CrewAI ${processType}プロセスでエラーが発生しました:`, error);
        
        // エラーメッセージをより詳細に設定
        let errorMessage = '不明なエラーが発生しました';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          try {
            errorMessage = JSON.stringify(error);
          } catch (e) {
            errorMessage = 'エラーオブジェクトを文字列化できませんでした';
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        // エラーメッセージをエージェント思考として送信
        sendAgentThoughts(
          'オーケストレーター',
          `処理中にエラーが発生しました: ${errorMessage}`,
          roleModelId,
          {
            timestamp: new Date().toISOString(),
            type: 'error',
            error: errorMessage
          }
        );
        
        // エラー進捗を送信（クライアントでボタン状態をリセットするため）
        sendProgressUpdate({
          message: `エラーが発生しました: ${errorMessage}`,
          percent: 0,
          roleModelId,
          status: 'error' // 状態フラグを追加
        });
        
        throw error;
      }
    } catch (error) {
      console.error('CrewAI処理エラー:', error);
      
      // エラーメッセージを送信
      let errorMessage = '不明なエラーが発生しました';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'エラーオブジェクトを文字列化できませんでした';
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      sendProgressUpdate({
        message: `処理中にエラーが発生しました: ${errorMessage}`,
        percent: 0,
        roleModelId,
        status: 'error'
      });
      
      throw error;
    }
  }
  
  /**
   * 情報収集プラン作成プロセスを開始
   * ナレッジグラフ更新はスキップして情報収集プランのみを生成
   */
  static async startCollectionPlanGeneration(
    userId: string,
    roleModelId: string,
    industry: string,
    initialKeywords: string[],
    potentialSources: string[] = [],
    resourceConstraints: string[] = [],
    originalRequirements: string[] = []
  ): Promise<any> {
    // ナレッジグラフ更新をスキップするフラグをtrueにして既存メソッドを実行
    return CrewAIService.startKnowledgeGraphGeneration(
      userId,
      roleModelId,
      industry,
      initialKeywords,
      potentialSources,
      resourceConstraints,
      originalRequirements,
      true // skipGraphUpdate = true
    );
  }
}

/**
 * CrewAIでナレッジグラフを生成する関数
 */
export async function generateKnowledgeGraphWithCrewAI(
  userId: string,
  roleModelId: string,
  industry: string,
  initialKeywords: string[],
  potentialSources: string[] = [],
  resourceConstraints: string[] = [],
  originalRequirements: string[] = []
): Promise<any> {
  return CrewAIService.startKnowledgeGraphGeneration(
    userId,
    roleModelId,
    industry,
    initialKeywords,
    potentialSources,
    resourceConstraints,
    originalRequirements
  );
}