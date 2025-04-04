// 業界分析エージェント
// 特定の業界に関する洞察と情報を生成

import { AgentResult, RoleModelInput } from './types';
import { callAzureOpenAI } from '../azure-openai';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket';

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
    
    // WebSocketで進捗状況を送信（開始）
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        '業界分析',
        10,
        { stage: '初期化', industries: input.industries }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        '業界分析エージェント',
        `業界分析を開始します...\n分析対象: ${input.roleName}\n業界: ${input.industries.join(', ') || '指定なし'}`
      );
    }
    
    if (input.industries.length === 0) {
      console.log('No industries specified, generating generic analysis');
      
      // 進捗状況更新
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          '業界分析エージェント',
          '業界が指定されていないため、一般的な分析を行います。キーワードやロール説明から業界を推定します。'
        );
      }
    }
    
    // 改善されたプロンプト：より明示的にロール情報を活用
    const prompt = [
      {
        role: "system",
        content: `あなたは業界分析の専門家です。与えられたロールと業界について詳細な分析を行ってください。
        結果はJSON形式で返してください。
        
        このシステムは「情報収集サービス」です。ユーザーが日々の情報収集を効率的に行うために必要な知識構造を構築することが目的です。
        分析は具体的で実用的であるべきです。特に情報収集の観点から重要な項目を強調してください。`
      },
      {
        role: "user",
        content: `以下のロール、業界、キーワードについて分析してください：
        
        ロール名: ${input.roleName}
        ロール詳細: ${input.description || '特に指定なし'}
        業界: ${input.industries.length > 0 ? input.industries.join(', ') : '特に指定なし'}
        関連キーワード: ${input.keywords.length > 0 ? input.keywords.join(', ') : '特に指定なし'}
        
        分析結果には以下の項目を含めてください：
        
        以下の形式でJSON出力してください：
        {
          "industryInsights": ["洞察1", "洞察2", ...],  // 業界全般の重要な洞察（5-7項目）
          "targetAudience": ["対象者1", "対象者2", ...], // この役割が対象とする顧客や組織（3-5項目）
          "keyTrends": ["トレンド1", "トレンド2", ...],  // 業界の主要なトレンド（4-6項目）
          "businessModels": ["モデル1", "モデル2", ...], // 関連するビジネスモデルや収益源（3-5項目）
          "challengesOpportunities": ["項目1", "項目2", ...] // 主な課題と機会（4-6項目）
        }
        
        回答は日本語で提供し、短く具体的に記述してください。各項目は40-60文字程度に抑えてください。
        日々の情報収集に役立つ具体的な観点を含めるよう心がけてください。`
      }
    ];
    
    // 進捗状況更新
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        '業界分析',
        30,
        { stage: 'AI分析中' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        '業界分析エージェント',
        'Azure OpenAIに業界分析を依頼しています...\nこの処理には数秒かかることがあります。'
      );
    }
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 1500);
    
    // 進捗状況更新
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        '業界分析',
        70,
        { stage: 'データ解析中' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        '業界分析エージェント',
        'AIからの回答を受信しました。結果を解析しています...'
      );
    }
    
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
      
      // 進捗状況更新（完了）
      if (input.userId && input.roleModelId) {
        sendProgressUpdate(
          input.userId,
          input.roleModelId,
          '業界分析',
          100,
          { stage: '完了', itemCount: {
            insights: analysisData.industryInsights.length,
            audiences: analysisData.targetAudience.length,
            trends: analysisData.keyTrends.length
          }}
        );
        
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          '業界分析エージェント',
          `業界分析が完了しました。\n\n主な洞察: ${analysisData.industryInsights.slice(0, 2).join('、')}\n\n主なトレンド: ${analysisData.keyTrends.slice(0, 2).join('、')}\n\n次のステップ: キーワード拡張エージェントに分析結果を渡します。`
        );
      }
      
      return {
        success: true,
        data: analysisData
      };
    } catch (error) {
      console.error('Error parsing industry analysis result:', error);
      return {
        success: false,
        error: 'Failed to parse industry analysis result'
      };
    }
  } catch (error) {
    console.error('Error in industry analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in industry analysis'
    };
  }
}
