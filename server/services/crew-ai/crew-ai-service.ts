/**
 * CrewAIサービス
 * WebSocketを通じてフロントエンドと連携するCrewAIのメインインターフェース
 */
import { WebSocket } from 'ws';
import { createCrewManager } from './crew-manager';

// グローバルなWebSocketコネクション管理
const wsConnections = new Map<string, WebSocket>();

/**
 * CrewAIサービスクラス
 * ナレッジグラフ生成プロセスとWebSocket通信を管理
 */
export class CrewAIService {
  /**
   * WebSocketコネクションを登録
   */
  static registerWebSocket(userId: string, roleModelId: string, ws: WebSocket): void {
    const connectionId = `${userId}-${roleModelId}`;
    wsConnections.set(connectionId, ws);
    
    console.log(`WebSocket接続開始: ユーザーID=${userId}, ロールモデルID=${roleModelId}`);
    
    // 接続終了時の処理
    ws.on('close', (code, reason) => {
      console.log(`WebSocket接続終了: ユーザーID=${userId}, ロールモデルID=${roleModelId}, コード=${code}, 理由=${reason}`);
      wsConnections.delete(connectionId);
    });
  }
  
  /**
   * 特定のユーザーとロールモデルにメッセージを送信
   */
  static sendMessage(userId: string, roleModelId: string, type: string, payload: any): boolean {
    try {
      const connectionId = `${userId}-${roleModelId}`;
      const ws = wsConnections.get(connectionId);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type,
          payload,
          timestamp: new Date().toISOString()
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('WebSocketメッセージ送信エラー:', error);
      return false;
    }
  }
  
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
  ): Promise<void> {
    try {
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
        CrewAIService.sendMessage(userId, roleModelId, 'agent_thought', {
          ...data,
          industry,
          keywords: initialKeywords
        });
      });
      
      // 進捗状況をクライアントに送信
      crewManager.on('progress', (data) => {
        CrewAIService.sendMessage(userId, roleModelId, 'crewai_progress', {
          ...data,
          industry,
          keywords: initialKeywords
        });
      });
      
      // タスク完了イベントをクライアントに送信
      crewManager.on('taskCompleted', (data) => {
        CrewAIService.sendMessage(userId, roleModelId, 'task_completed', {
          ...data,
          industry,
          keywords: initialKeywords
        });
      });
      
      // エラーイベントをクライアントに送信
      crewManager.on('error', (error) => {
        CrewAIService.sendMessage(userId, roleModelId, 'crewai_error', {
          ...error,
          industry,
          keywords: initialKeywords
        });
      });
      
      // 生成プロセス開始を通知
      CrewAIService.sendMessage(userId, roleModelId, 'crewai_start', {
        industry,
        initialKeywords,
        potentialSources,
        timestamp: new Date().toISOString()
      });
      
      // 非同期でナレッジグラフ生成を実行
      const result = await crewManager.generateKnowledgeGraph();
      
      // 結果をクライアントに送信
      CrewAIService.sendMessage(userId, roleModelId, 'crewai_complete', {
        result,
        industry,
        keywords: initialKeywords,
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      console.error('ナレッジグラフ生成エラー:', error);
      
      // エラーをクライアントに送信
      CrewAIService.sendMessage(userId, roleModelId, 'crewai_error', {
        message: error.message,
        stack: error.stack,
        industry,
        keywords: initialKeywords,
        timestamp: new Date().toISOString()
      });
      
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