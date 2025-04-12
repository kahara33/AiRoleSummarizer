/**
 * ユーザーフィードバックサービス
 * AIエージェントの出力に対するユーザーフィードバックを処理するサービス
 */

import { v4 as uuidv4 } from 'uuid';
import * as graphServiceAdapter from './graph-service-adapter';
import * as knowledgeGraphService from './knowledge-graph-service';
import * as aiAgentService from './ai-agent-service';

/**
 * ユーザーフィードバックタイプ列挙型
 */
export enum FeedbackType {
  SUMMARY_PREFERENCE = 'summary_preference',  // 要約スタイルの選好
  TOPIC_RELEVANCE = 'topic_relevance',        // トピックの関連性評価
  KEYWORD_INTEREST = 'keyword_interest',      // キーワードへの関心度
  SEARCH_QUALITY = 'search_quality',          // 検索品質フィードバック
  GRAPH_STRUCTURE = 'graph_structure',        // グラフ構造フィードバック
  GENERAL_COMMENT = 'general_comment'         // 一般的なコメント
}

/**
 * ユーザーフィードバックインターフェース
 */
export interface UserFeedback {
  id?: string;
  roleModelId: string;
  feedbackType: FeedbackType;
  data: any;
  timestamp: number;
}

/**
 * サマリーサンプルインターフェース
 */
export interface SummarySample {
  id: string;
  type: string;
  title: string;
  content: string;
  characteristics: string[];
}

/**
 * フィードバックを処理する
 * @param feedback ユーザーフィードバック
 * @returns 処理が成功したかどうか
 */
export async function processFeedback(feedback: UserFeedback): Promise<boolean> {
  try {
    feedback.id = feedback.id || uuidv4();
    console.log(`フィードバック処理: type=${feedback.feedbackType}, roleModelId=${feedback.roleModelId}`);

    // フィードバックタイプに応じた処理
    switch (feedback.feedbackType) {
      case FeedbackType.SUMMARY_PREFERENCE:
        return await processSummaryPreference(feedback);
      case FeedbackType.TOPIC_RELEVANCE:
        return await processTopicRelevance(feedback);
      case FeedbackType.KEYWORD_INTEREST:
        return await processKeywordInterest(feedback);
      case FeedbackType.GRAPH_STRUCTURE:
        return await processGraphStructure(feedback);
      default:
        console.log(`未実装のフィードバックタイプ: ${feedback.feedbackType}`);
        return true; // 一般的なコメントなどはそのまま成功として返す
    }
  } catch (error) {
    console.error('フィードバック処理エラー:', error);
    return false;
  }
}

/**
 * 要約サンプルの好みに関するフィードバックを処理する
 * @param feedback ユーザーフィードバック
 * @returns 処理が成功したかどうか
 */
async function processSummaryPreference(feedback: UserFeedback): Promise<boolean> {
  try {
    const { preferredSamples, roleModelId } = feedback.data;
    console.log(`要約サンプル選好処理: ${preferredSamples.length}個のサンプルが選択されました`);

    // 既存のグラフを取得
    const existingGraph = await graphServiceAdapter.getKnowledgeGraph(roleModelId);
    
    if (!existingGraph || !existingGraph.nodes || existingGraph.nodes.length === 0) {
      console.error('既存のグラフが見つかりません');
      return false;
    }

    // フィードバックに基づいてグラフを強化
    const enhancedGraph = await knowledgeGraphService.incorporateUserFeedback(
      roleModelId,
      existingGraph,
      {
        preferredSummaryTypes: preferredSamples.map((sample: any) => sample.type),
        preferredCharacteristics: extractCharacteristics(preferredSamples)
      }
    );

    // 強化されたグラフを保存
    const saveResult = await graphServiceAdapter.saveKnowledgeGraph(roleModelId, enhancedGraph);
    
    return saveResult;
  } catch (error) {
    console.error('要約サンプル好みフィードバック処理エラー:', error);
    return false;
  }
}

/**
 * トピックの関連性に関するフィードバックを処理する
 * @param feedback ユーザーフィードバック
 * @returns 処理が成功したかどうか
 */
async function processTopicRelevance(feedback: UserFeedback): Promise<boolean> {
  try {
    const { topicId, relevanceScore, comments } = feedback.data;
    console.log(`トピック関連性フィードバック: topicId=${topicId}, score=${relevanceScore}`);
    
    // トピック関連性スコアを元に処理
    // ここにトピック関連性処理のロジックを実装
    
    return true;
  } catch (error) {
    console.error('トピック関連性フィードバック処理エラー:', error);
    return false;
  }
}

/**
 * キーワードへの関心度に関するフィードバックを処理する
 * @param feedback ユーザーフィードバック
 * @returns 処理が成功したかどうか
 */
async function processKeywordInterest(feedback: UserFeedback): Promise<boolean> {
  try {
    const { keywords, interestScores } = feedback.data;
    console.log(`キーワード関心度フィードバック: ${keywords.length}個のキーワード`);
    
    // キーワード関心度スコアを元に処理
    // ここにキーワード関心度処理のロジックを実装
    
    return true;
  } catch (error) {
    console.error('キーワード関心度フィードバック処理エラー:', error);
    return false;
  }
}

/**
 * グラフ構造に関するフィードバックを処理する
 * @param feedback ユーザーフィードバック
 * @returns 処理が成功したかどうか
 */
async function processGraphStructure(feedback: UserFeedback): Promise<boolean> {
  try {
    const { suggestions, nodeChanges } = feedback.data;
    console.log(`グラフ構造フィードバック: ${suggestions.length}個の提案`);
    
    // グラフ構造の変更提案を元に処理
    // ここにグラフ構造フィードバック処理のロジックを実装
    
    return true;
  } catch (error) {
    console.error('グラフ構造フィードバック処理エラー:', error);
    return false;
  }
}

/**
 * 要約サンプルを5つ生成する
 * @param roleModelId ロールモデルID
 * @param mainTopic メイントピック
 * @returns 要約サンプル配列
 */
export async function generateSummarySamples(roleModelId: string, mainTopic: string): Promise<SummarySample[]> {
  try {
    console.log(`要約サンプル生成: roleModelId=${roleModelId}, topic=${mainTopic}`);
    
    // AIエージェントを使用して5種類の要約サンプルを生成
    const samples = await aiAgentService.generateSummarySamples(mainTopic);
    
    return samples;
  } catch (error) {
    console.error('要約サンプル生成エラー:', error);
    return [];
  }
}

/**
 * ユーザーの好みの特性を抽出
 * @param preferredSamples ユーザーが好むサンプル
 * @returns 特性配列
 */
function extractCharacteristics(preferredSamples: any[]): string[] {
  try {
    // 各サンプルから特性を抽出して一意な配列を返す
    const allCharacteristics = preferredSamples
      .flatMap((sample: any) => sample.characteristics || []);
    
    // 重複を削除
    return [...new Set(allCharacteristics)];
  } catch (error) {
    console.error('特性抽出エラー:', error);
    return [];
  }
}