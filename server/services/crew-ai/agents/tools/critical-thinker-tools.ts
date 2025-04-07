/**
 * クリティカルシンカーエージェントのツール
 * 各エージェントの提案を批判的に評価、盲点の発見と品質保証を担当
 */
import { Tool } from 'crewai-js';

// AI/LLMサービスとの連携用関数（実際の実装は別ファイルで行う）
import { 
  verifyConsistency, 
  analyzeInformationGaps, 
  generateExplanation
} from '../../../ai-services';

export const CriticalThinkerTools = [
  {
    name: "一貫性検証ツール",
    description: "プランとグラフの一貫性を検証する",
    async func: async ({ plan, knowledgeGraph, requirements }) => {
      try {
        // プランとグラフの一貫性を検証
        const consistencyReport = await verifyConsistency(plan, knowledgeGraph, requirements);
        
        return JSON.stringify({
          overallConsistencyScore: consistencyReport.overallScore,
          graphPlanAlignment: consistencyReport.alignmentScore,
          internalContradictions: consistencyReport.contradictions,
          coverageGaps: consistencyReport.gaps,
          requirementsFulfillment: consistencyReport.requirementsFulfillment,
          recommendedAdjustments: consistencyReport.recommendedAdjustments
        });
      } catch (error) {
        return `一貫性検証中にエラーが発生しました: ${error.message}`;
      }
    }
  },
  
  {
    name: "ギャップ分析ツール",
    description: "情報収集の空白領域を特定する",
    async func: async ({ currentPlan, industryBenchmarks, companyNeeds }) => {
      try {
        // 情報収集の空白領域を分析
        const gapAnalysis = await analyzeInformationGaps(currentPlan, industryBenchmarks, companyNeeds);
        
        return JSON.stringify({
          identifiedGaps: gapAnalysis.gaps,
          criticalOmissions: gapAnalysis.criticalOmissions,
          unexploredAreas: gapAnalysis.unexploredAreas,
          competitiveDisadvantages: gapAnalysis.competitiveDisadvantages,
          gapImportanceRanking: gapAnalysis.importanceRanking,
          remediationSuggestions: gapAnalysis.remediationSuggestions
        });
      } catch (error) {
        return `ギャップ分析中にエラーが発生しました: ${error.message}`;
      }
    }
  },
  
  {
    name: "説明生成ツール",
    description: "プラン採用理由の論理的説明を生成する",
    async func: async ({ plan, alternativesConsidered, decisionCriteria }) => {
      try {
        // プラン採用理由の説明を生成
        const explanation = await generateExplanation(plan, alternativesConsidered, decisionCriteria);
        
        return JSON.stringify({
          coreSummary: explanation.summary,
          keyRationale: explanation.rationale,
          alternativesAnalysis: explanation.alternativesAnalysis,
          tradeoffs: explanation.tradeoffs,
          expectedBenefits: explanation.benefits,
          potentialRisks: explanation.risks,
          mitigationStrategies: explanation.mitigationStrategies
        });
      } catch (error) {
        return `説明生成中にエラーが発生しました: ${error.message}`;
      }
    }
  }
];