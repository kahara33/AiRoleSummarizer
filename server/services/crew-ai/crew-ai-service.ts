/**
 * CrewAIサービス
 * WebSocketを通じてフロントエンドと連携するCrewAIのメインインターフェース
 */
import { createCrewManager } from './crew-manager';
import { sendProgressUpdate, sendAgentThoughts } from '../../websocket/ws-server';

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
      
      // 進捗状況を送信
      const initialMessage = skipGraphUpdate
        ? 'CrewAIで情報収集プランの作成を開始しています...' 
        : 'CrewAIでナレッジグラフと情報収集プランの生成を開始しています...';
      
      sendProgressUpdate({
        message: initialMessage,
        percent: 5,
        roleModelId
      });
      
      // CrewManagerの作成
      const crewManager = createCrewManager(
        industry,
        initialKeywords,
        potentialSources,
        resourceConstraints,
        originalRequirements
      );
      
      // イベントリスナーの設定
      
      // エージェントの思考プロセスをクライアントに送信
      crewManager.on('agentThought', (data) => {
        const { agentName, thought } = data;
        console.log(`CrewAIエージェント思考: ${agentName} - ${thought.substring(0, 50)}...`);
        
        sendAgentThoughts(
          agentName,
          thought,
          roleModelId,
          {
            industry,
            keywords: initialKeywords,
            timestamp: new Date().toISOString()
          }
        );
      });
      
      // 進捗状況をクライアントに送信
      crewManager.on('progress', (data) => {
        const { stage, progress, detail } = data;
        console.log(`CrewAI進捗状況: ${stage} - ${progress}% - ${detail}`);
        
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
        
        // タスク完了をエージェント思考として送信
        sendAgentThoughts(
          'タスクマネージャー',
          `タスク「${taskName}」が完了しました。`,
          roleModelId,
          {
            taskName,
            timestamp: new Date().toISOString()
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
        
        sendProgressUpdate({
          message: `エラーが発生しました: ${errorMessage}`,
          percent: 0,
          roleModelId
        });
      });
      
      // 非同期でナレッジグラフ生成/情報収集プラン作成を実行
      console.log(`CrewAI ${processType}プロセスを開始します...`);
      const result = await crewManager.generateKnowledgeGraph(skipGraphUpdate);
      console.log(`CrewAI ${processType}プロセスが完了しました`);
      
      // 完了メッセージを送信
      const completionMessage = skipGraphUpdate
        ? '情報収集プランの作成が完了しました'
        : 'ナレッジグラフ生成と情報収集プラン作成が完了しました';
      
      sendProgressUpdate({
        message: completionMessage,
        percent: 100,
        roleModelId
      });
      
      // 最終結果をエージェント思考として送信（より詳細に）
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
      
      return result;
    } catch (error) {
      console.error('CrewAI処理エラー:', error);
      
      // エラーメッセージを送信
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendProgressUpdate({
        message: `処理中にエラーが発生しました: ${errorMessage}`,
        percent: 0,
        roleModelId
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
): Promise<void> {
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