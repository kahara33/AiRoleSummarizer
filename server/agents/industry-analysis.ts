// 業界分析エージェント
// 選択された業界に関する洞察を生成するエージェント

import { AgentResult, RoleModelInput } from './types';
import { callAzureOpenAI } from '../azure-openai';

interface IndustryAnalysisOutput {
  keyInsights: string[];
  industryTrends: string[];
  majorPlayers: string[];
  challengesAndOpportunities: string[];
}

/**
 * 業界分析エージェント
 * 選択された業界に関する重要な洞察を生成します
 */
export const industryAnalysisAgent = async (
  input: RoleModelInput
): Promise<AgentResult> => {
  try {
    console.log('Running industry analysis for:', input.industries.join(', '));
    
    const industriesStr = input.industries.join(', ');
    const promptMessages = [
      {
        role: "system",
        content: `あなたは業界分析の専門家です。選択された業界に関する重要な洞察を生成してください。分析は説得力があり、専門的で、詳細である必要があります。
        
        出力は以下のJSON形式で返してください：
        {
          "keyInsights": ["洞察1", "洞察2", ...],
          "industryTrends": ["トレンド1", "トレンド2", ...],
          "majorPlayers": ["主要プレイヤー1", "主要プレイヤー2", ...],
          "challengesAndOpportunities": ["課題/機会1", "課題/機会2", ...]
        }
        
        各セクションには、最低でも3つ、最大で5つの要素を含めてください。
        日本語で回答してください。`
      },
      {
        role: "user",
        content: `次の業界について分析してください: ${industriesStr}
        
        この分析は「${input.roleName}」というロールの定義に使用されます。このロールの説明: ${input.description || 'なし'}`
      }
    ];
    
    // Azure OpenAIを呼び出して業界分析を生成
    const responseText = await callAzureOpenAI(promptMessages, 0.7, 2000);
    
    // 応答をJSONとしてパース
    let analysisResult: IndustryAnalysisOutput;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing industry analysis JSON response:', e);
      throw new Error('Invalid response format from industry analysis');
    }
    
    return {
      result: analysisResult,
      metadata: {
        industries: input.industries,
        promptTokens: promptMessages.reduce((acc, msg) => acc + msg.content.length, 0),
        responseTokens: responseText.length
      }
    };
  } catch (error: any) {
    console.error('Error in industry analysis agent:', error);
    throw new Error(`Industry analysis failed: ${error.message}`);
  }
};