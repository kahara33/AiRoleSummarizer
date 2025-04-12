/**
 * ユーザーフィードバックサービス
 * ナレッジグラフと要約サンプルに対するユーザーフィードバックを処理するサービス
 */

import * as graphService from './graph-service-adapter';
import * as knowledgeGraphService from './knowledge-graph-service';
import { GraphData } from './knowledge-graph-service';
import { WebSocket } from 'ws';

/**
 * ユーザーフィードバックタイプ
 */
export enum FeedbackType {
  SUMMARY_PREFERENCE = 'summary_preference',  // 要約サンプルの嗜好
  GRAPH_FEEDBACK = 'graph_feedback',          // グラフ構造に対するフィードバック
  KEYWORD_PRIORITY = 'keyword_priority',      // キーワードの優先順位
  GENERAL_COMMENT = 'general_comment'         // 一般的なコメント
}

/**
 * ユーザーフィードバックインターフェース
 */
export interface UserFeedback {
  roleModelId: string;
  feedbackType: FeedbackType;
  data: any;  // フィードバックタイプに応じたデータ
  timestamp: number;
}

/**
 * 要約サンプル嗜好インターフェース
 */
export interface SummaryPreference {
  selectedSampleIds: string[];      // 選択されたサンプルID
  priorityCategories: string[];     // 優先カテゴリ
  additionalKeywords?: string[];    // 追加のキーワード
}

/**
 * 要約サンプル嗜好をグラフパラメータに変換
 * @param preference 要約サンプル嗜好
 * @returns グラフ更新パラメータ
 */
function convertPreferenceToGraphParams(preference: SummaryPreference): {
  categories: string[];
  priorityKeywords: string[];
  feedbackType: string;
} {
  return {
    categories: preference.priorityCategories,
    priorityKeywords: preference.additionalKeywords || [],
    feedbackType: 'explicit'
  };
}

/**
 * 要約サンプルに基づいてグラフを更新
 * @param roleModelId ロールモデルID
 * @param feedback ユーザーフィードバック
 * @returns 更新されたグラフデータ
 */
export async function updateGraphBasedOnSummaryPreference(
  roleModelId: string,
  preference: SummaryPreference
): Promise<GraphData | null> {
  try {
    console.log(`要約サンプル嗜好に基づくグラフ更新: roleModelId=${roleModelId}`);
    
    // 既存のグラフを取得
    const existingGraph = await graphService.getKnowledgeGraph(roleModelId);
    
    if (!existingGraph) {
      console.warn('更新対象の既存グラフが見つかりません');
      return null;
    }
    
    // 嗜好をグラフパラメータに変換
    const graphParams = convertPreferenceToGraphParams(preference);
    
    // ナレッジグラフサービスを使用してグラフを更新
    const updatedGraph = await knowledgeGraphService.incorporateUserFeedback(
      roleModelId,
      existingGraph,
      graphParams
    );
    
    // 更新されたグラフをデータベースに保存
    await graphService.saveKnowledgeGraph(roleModelId, updatedGraph);
    
    console.log(`グラフ更新完了: roleModelId=${roleModelId}, ノード数=${updatedGraph.nodes.length}`);
    
    return updatedGraph;
  } catch (error) {
    console.error('要約サンプル嗜好に基づくグラフ更新エラー:', error);
    return null;
  }
}

/**
 * WebSocketを通じてフィードバック要求を送信
 * @param socket WebSocketオブジェクト
 * @param roleModelId ロールモデルID
 * @param samples 要約サンプル
 */
export function sendFeedbackRequest(
  socket: WebSocket,
  roleModelId: string,
  samples: any[]
): void {
  try {
    if (socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが開いていないため、フィードバック要求を送信できません');
      return;
    }
    
    const message = {
      type: 'feedback_request',
      roleModelId,
      data: {
        requestType: 'summary_preference',
        samples,
        message: '以下の要約サンプルから最も関心のあるものを選択してください。これにより、情報収集プランがカスタマイズされます。'
      }
    };
    
    socket.send(JSON.stringify(message));
    console.log(`フィードバック要求を送信: roleModelId=${roleModelId}, サンプル数=${samples.length}`);
  } catch (error) {
    console.error('フィードバック要求送信エラー:', error);
  }
}

/**
 * フィードバックを処理
 * @param feedback ユーザーフィードバック
 * @returns 処理成功フラグ
 */
export async function processFeedback(feedback: UserFeedback): Promise<boolean> {
  try {
    console.log(`フィードバック処理開始: roleModelId=${feedback.roleModelId}, タイプ=${feedback.feedbackType}`);
    
    switch (feedback.feedbackType) {
      case FeedbackType.SUMMARY_PREFERENCE:
        // 要約サンプル嗜好に基づいてグラフを更新
        await updateGraphBasedOnSummaryPreference(
          feedback.roleModelId,
          feedback.data as SummaryPreference
        );
        break;
        
      case FeedbackType.GRAPH_FEEDBACK:
        // グラフ構造に対するフィードバックを処理
        // 実装省略（将来の拡張用）
        break;
        
      case FeedbackType.KEYWORD_PRIORITY:
        // キーワードの優先順位に基づいてグラフを更新
        // 実装省略（将来の拡張用）
        break;
        
      case FeedbackType.GENERAL_COMMENT:
        // 一般的なコメントを処理
        // 実装省略（将来の拡張用）
        break;
        
      default:
        console.warn(`未知のフィードバックタイプ: ${feedback.feedbackType}`);
        return false;
    }
    
    console.log(`フィードバック処理完了: roleModelId=${feedback.roleModelId}`);
    return true;
  } catch (error) {
    console.error('フィードバック処理エラー:', error);
    return false;
  }
}