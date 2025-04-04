// キーワード拡張エージェント
// 選択されたキーワードを拡張して関連キーワードを生成するエージェント

import { AgentResult, RoleModelInput } from './types';
import { callAzureOpenAI } from '../azure-openai';

interface KeywordExpansionInput extends RoleModelInput {
  industryInsights?: any;
}

interface KeywordExpansionOutput {
  expandedKeywords: string[];
  keywordCategories: {
    [category: string]: string[];
  };
  relevanceScores: {
    [keyword: string]: number;
  };
}

/**
 * キーワード拡張エージェント
 * 選択されたキーワードを拡張して、関連するさらなるキーワードを生成します
 */
export const keywordExpansionAgent = async (
  input: KeywordExpansionInput
): Promise<AgentResult> => {
  try {
    console.log('Running keyword expansion for:', input.keywords.join(', '));
    
    const keywordsStr = input.keywords.join(', ');
    const industriesStr = input.industries.join(', ');
    
    // 業界分析情報が利用可能な場合は、それを使用します
    const industryInsightsStr = input.industryInsights 
      ? `業界分析情報:\n${JSON.stringify(input.industryInsights, null, 2)}`
      : '';
    
    const promptMessages = [
      {
        role: "system",
        content: `あなたはキーワード拡張と分類の専門家です。与えられたキーワードセットを拡張し、関連する追加キーワードを生成してください。
        また、これらのキーワードを意味のあるカテゴリに分類し、ロールモデルとの関連性スコアを付けてください。
        
        出力は以下のJSON形式で返してください：
        {
          "expandedKeywords": ["キーワード1", "キーワード2", ...],
          "keywordCategories": {
            "カテゴリ1": ["キーワード1", "キーワード2", ...],
            "カテゴリ2": ["キーワード3", "キーワード4", ...],
            ...
          },
          "relevanceScores": {
            "キーワード1": 0.95,
            "キーワード2": 0.85,
            ...
          }
        }
        
        ・拡張キーワードは、元のキーワードを含めて合計で15〜25個程度にしてください。
        ・カテゴリは3〜5個作成してください。
        ・関連性スコアは0.0〜1.0の範囲で、このロールモデルにとっての重要度を示します。
        ・ごく一般的すぎるキーワードや、逆に狭すぎる意味のキーワードは避けてください。
        ・テクニカルなロールの場合は、専門用語を適切に含めてください。
        ・日本語で回答してください。`
      },
      {
        role: "user",
        content: `次のキーワードを拡張してください: ${keywordsStr}
        
        これらのキーワードは「${input.roleName}」というロールモデルに関連しています。
        このロールは次の業界に関連しています: ${industriesStr}
        
        ロールの説明: ${input.description || 'なし'}
        
        ${industryInsightsStr}`
      }
    ];
    
    // Azure OpenAIを呼び出してキーワード拡張を生成
    const responseText = await callAzureOpenAI(promptMessages, 0.7, 2000);
    
    // 応答をJSONとしてパース
    let expansionResult: KeywordExpansionOutput;
    try {
      expansionResult = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing keyword expansion JSON response:', e);
      throw new Error('Invalid response format from keyword expansion');
    }
    
    return {
      result: expansionResult,
      metadata: {
        originalKeywords: input.keywords,
        expandedCount: expansionResult.expandedKeywords.length,
        categoryCount: Object.keys(expansionResult.keywordCategories).length,
        promptTokens: promptMessages.reduce((acc, msg) => acc + msg.content.length, 0),
        responseTokens: responseText.length
      }
    };
  } catch (error: any) {
    console.error('Error in keyword expansion agent:', error);
    throw new Error(`Keyword expansion failed: ${error.message}`);
  }
};