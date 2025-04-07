/**
 * プランストラテジストエージェントのツール
 * 情報収集戦略立案、プラン最適化と評価基準設定を担当
 */
import { Tool } from 'crewai-js';

// AI/LLMサービスとの連携用関数（実際の実装は別ファイルで行う）
import { 
  generateCollectionPlan, 
  evaluateInformationValue, 
  optimizeCollectionSchedule
} from '../../../ai-services';

export const PlanStrategistTools = [
  {
    name: "プラン生成ツール",
    description: "情報収集プランを生成する",
    async func: async ({ keywords, industries, sources, timeframe }) => {
      try {
        // 情報収集プランを生成
        const plan = await generateCollectionPlan(keywords, industries, sources, timeframe);
        
        return JSON.stringify({
          planName: plan.name,
          planDescription: plan.description,
          keyAreas: plan.keyAreas,
          prioritizedKeywords: plan.prioritizedKeywords,
          recommendedSources: plan.recommendedSources,
          collectionFrequency: plan.frequency,
          expectedOutcomes: plan.expectedOutcomes,
          evaluationCriteria: plan.evaluationCriteria
        });
      } catch (error) {
        return `プラン生成中にエラーが発生しました: ${error.message}`;
      }
    }
  },
  
  {
    name: "情報価値評価ツール",
    description: "各情報の価値と優先度を計算する",
    async func: async ({ informationItem, context, existingKnowledge }) => {
      try {
        // 情報の価値を評価
        const valueAssessment = await evaluateInformationValue(informationItem, context, existingKnowledge);
        
        return JSON.stringify({
          informationItem,
          noveltyScore: valueAssessment.novelty,
          relevanceScore: valueAssessment.relevance,
          impactScore: valueAssessment.impact,
          credibilityScore: valueAssessment.credibility,
          overallValueScore: valueAssessment.overallValue,
          collectionPriority: valueAssessment.priority,
          justification: valueAssessment.justification
        });
      } catch (error) {
        return `情報価値評価中にエラーが発生しました: ${error.message}`;
      }
    }
  },
  
  {
    name: "収集スケジューラー",
    description: "効率的な情報収集スケジュールを設計する",
    async func: async ({ sources, priorities, constraints, frequency }) => {
      try {
        // 情報収集スケジュールを最適化
        const schedule = await optimizeCollectionSchedule(sources, priorities, constraints, frequency);
        
        return JSON.stringify({
          overallSchedule: schedule.overview,
          sourceSpecificSchedules: schedule.sourceSchedules,
          resourceAllocation: schedule.resourceAllocation,
          priorityAdjustments: schedule.priorityAdjustments,
          automationRecommendations: schedule.automationRecommendations,
          frequencyJustification: schedule.frequencyJustification
        });
      } catch (error) {
        return `スケジュール最適化中にエラーが発生しました: ${error.message}`;
      }
    }
  }
];