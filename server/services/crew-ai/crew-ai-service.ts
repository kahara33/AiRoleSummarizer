/**
 * CrewAIサービス
 * WebSocketを通じてフロントエンドと連携するCrewAIのメインインターフェース
 */
import { createCrewManager } from './crew-manager';
import { sendProgressUpdate, sendAgentThoughts } from '../../websocket';

/**
 * CrewAIサービスクラス
 * ナレッジグラフ生成プロセスとWebSocket通信を管理
 */
export class CrewAIService {
  /**
   * ナレッジグラフ生成プロセスを開始
   */
  static async startKnowledgeGraphGeneration(
    userId: string,
    roleModelId: string,
    industry: string,
    initialKeywords: string[],
    potentialSources: string[] = [],
    resourceConstraints: string[] = [],
    originalRequirements: string[] = []
  ): Promise<any> {
    try {
      console.log(`CrewAI ナレッジグラフ生成プロセスを開始: roleModelId=${roleModelId}, industry=${industry}, keywords=${initialKeywords.join(', ')}`);
      
      // 進捗状況を送信
      sendProgressUpdate('CrewAIでナレッジグラフの生成を開始しています...', 5, roleModelId);
      
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
        
        sendProgressUpdate(
          detail,
          progress,
          roleModelId
        );
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
      });
      
      // エラーイベントをクライアントに送信
      crewManager.on('error', (err) => {
        console.error('CrewAIエラー:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        sendProgressUpdate(
          `エラーが発生しました: ${errorMessage}`,
          0,
          roleModelId
        );
      });
      
      // 非同期でナレッジグラフ生成を実行
      console.log('CrewAIナレッジグラフ生成を開始します...');
      const result = await crewManager.generateKnowledgeGraph();
      console.log('CrewAIナレッジグラフ生成が完了しました');
      
      // 完了メッセージを送信
      sendProgressUpdate(
        'ナレッジグラフの生成が完了しました',
        100,
        roleModelId
      );
      
      return result;
    } catch (error) {
      console.error('ナレッジグラフ生成エラー:', error);
      
      // エラーメッセージを送信
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendProgressUpdate(
        `ナレッジグラフの生成中にエラーが発生しました: ${errorMessage}`,
        0,
        roleModelId
      );
      
      throw error;
    }
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