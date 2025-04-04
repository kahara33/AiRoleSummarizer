// 業界分析エージェント
// 特定の業界に関する洞察と情報を生成

import { AgentResult, RoleModelInput } from './types';
import { callAzureOpenAI } from '../azure-openai';

export interface IndustryAnalysisData {
  industryInsights: string[];  // 業界全般の洞察
  targetAudience: string[];    // ターゲットとなる対象者・組織
  keyTrends: string[];         // 主要なトレンド
  businessModels: string[];    // ビジネスモデル
  challengesOpportunities: string[]; // 課題と機会
}

/**
 * 業界分析エージェント
 * 指定された業界に関する詳細な情報と洞察を提供
 */
export async function analyzeIndustries(
  input: RoleModelInput
): Promise<AgentResult<IndustryAnalysisData>> {
  try {
    console.log(`Analyzing industries for role: ${input.roleName}`);
    console.log(`Target industries: ${input.industries.join(', ')}`);
    
    if (input.industries.length === 0) {
      console.log('No industries specified, generating generic analysis');
    }
    
    // プロンプトを生成
    const prompt = [
      {
        role: "system",
        content: `あなたは業界分析のエキスパートです。特定の役割に関連する業界の分析と洞察を提供してください。
        結果はJSON形式で返してください。`
      },
      {
        role: "user",
        content: `次の役割と業界について分析してください：
        
        役割名: ${input.roleName}
        説明: ${input.description || '特に指定なし'}
        業界: ${input.industries.length > 0 ? input.industries.join(', ') : '特に指定なし'}
        キーワード: ${input.keywords.length > 0 ? input.keywords.join(', ') : '特に指定なし'}
        
        以下の形式でJSON出力してください：
        {
          "industryInsights": ["洞察1", "洞察2", ...],  // 業界全般の重要な洞察（5-7項目）
          "targetAudience": ["対象者1", "対象者2", ...], // この役割が対象とする顧客や組織（3-5項目）
          "keyTrends": ["トレンド1", "トレンド2", ...],  // 業界の主要なトレンド（4-6項目）
          "businessModels": ["モデル1", "モデル2", ...], // 関連するビジネスモデルや収益源（3-5項目）
          "challengesOpportunities": ["項目1", "項目2", ...] // 主な課題と機会（4-6項目）
        }
        
        回答は日本語で提供し、短く具体的に記述してください。各項目は40-60文字程度に抑えてください。`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 1500);
    
    // 結果をパース
    try {
      let analysisData: IndustryAnalysisData;
      
      // JSON形式の部分を抽出
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        analysisData = JSON.parse(responseContent);
      }
      
      // データの検証
      if (!analysisData.industryInsights || !Array.isArray(analysisData.industryInsights)) {
        analysisData.industryInsights = [];
      }
      if (!analysisData.targetAudience || !Array.isArray(analysisData.targetAudience)) {
        analysisData.targetAudience = [];
      }
      if (!analysisData.keyTrends || !Array.isArray(analysisData.keyTrends)) {
        analysisData.keyTrends = [];
      }
      if (!analysisData.businessModels || !Array.isArray(analysisData.businessModels)) {
        analysisData.businessModels = [];
      }
      if (!analysisData.challengesOpportunities || !Array.isArray(analysisData.challengesOpportunities)) {
        analysisData.challengesOpportunities = [];
      }
      
      console.log(`Industry analysis completed with ${analysisData.industryInsights.length} insights, ${analysisData.keyTrends.length} trends`);
      
      return {
        success: true,
        data: analysisData
      };
    } catch (parseError: any) {
      console.error('Error parsing industry analysis response:', parseError);
      return {
        success: false,
        error: `Failed to parse industry analysis data: ${parseError.message}`
      };
    }
  } catch (error: any) {
    console.error('Error in industry analysis agent:', error);
    return {
      success: false,
      error: `Industry analysis failed: ${error.message}`
    };
  }
}