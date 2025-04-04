// キーワード拡張エージェント
// 入力キーワードを拡張し、関連する追加キーワードを生成

import { AgentResult, RoleModelInput } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { callAzureOpenAI } from '../azure-openai';

export interface KeywordExpansionData {
  expandedKeywords: string[];       // 拡張されたキーワードリスト
  relevance: Record<string, number>; // キーワードと関連度のマッピング（0.0-1.0）
}

/**
 * キーワード拡張エージェント
 * 初期キーワードに基づいて関連キーワードを推奨し、キーワードを拡張
 */
export async function expandKeywords(
  input: RoleModelInput,
  industryData?: IndustryAnalysisData
): Promise<AgentResult<KeywordExpansionData>> {
  try {
    console.log(`Expanding keywords for role: ${input.roleName}`);
    console.log(`Initial keywords: ${input.keywords.join(', ')}`);
    
    if (input.keywords.length === 0) {
      console.log('No initial keywords provided, will generate based on role and industry');
    }
    
    // 業界分析データがある場合は、それを活用
    const industryContext = industryData ? 
      `
      【業界洞察】
      ${industryData.industryInsights.map((insight, i) => `${i+1}. ${insight}`).join('\n')}
      
      【主要トレンド】
      ${industryData.keyTrends.map((trend, i) => `${i+1}. ${trend}`).join('\n')}
      
      【ターゲット対象】
      ${industryData.targetAudience.map((audience, i) => `${i+1}. ${audience}`).join('\n')}
      ` : '';
    
    // プロンプトを生成
    const prompt = [
      {
        role: "system",
        content: `あなたはキーワード拡張のエキスパートです。提供された役割、業界、初期キーワードに基づいて、関連するキーワードを拡張してください。
        結果はJSON形式で返してください。`
      },
      {
        role: "user",
        content: `次の役割と初期キーワードに基づいて、関連キーワードを拡張・推奨してください：
        
        役割名: ${input.roleName}
        説明: ${input.description || '特に指定なし'}
        業界: ${input.industries.length > 0 ? input.industries.join(', ') : '特に指定なし'}
        初期キーワード: ${input.keywords.length > 0 ? input.keywords.join(', ') : '特に指定なし'}
        
        ${industryContext}
        
        この役割に重要と思われるキーワードを追加してください。本人の日々の情報収集や自己成長に役立つものを優先してください。
        以下の形式でJSON出力してください：
        {
          "expandedKeywords": ["キーワード1", "キーワード2", ...],  // オリジナルのキーワードを含め、合計15-20個程度
          "relevance": {
            "キーワード1": 0.95,  // 関連度（0.0-1.0）
            "キーワード2": 0.85,
            ...
          }
        }
        
        回答は日本語で提供し、キーワードは短く具体的に記述してください（各5-15文字程度）。
        技術用語、ツール名、概念名など、具体的で検索可能なキーワードを含めてください。`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 1500);
    
    // 結果をパース
    try {
      let expansionData: KeywordExpansionData;
      
      // JSON形式の部分を抽出
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        expansionData = JSON.parse(jsonMatch[0]);
      } else {
        expansionData = JSON.parse(responseContent);
      }
      
      // データの検証
      if (!expansionData.expandedKeywords || !Array.isArray(expansionData.expandedKeywords)) {
        expansionData.expandedKeywords = [...input.keywords]; // 少なくとも元のキーワードは含める
      }
      
      if (!expansionData.relevance || typeof expansionData.relevance !== 'object') {
        expansionData.relevance = {};
        // デフォルトの関連度を設定
        expansionData.expandedKeywords.forEach(keyword => {
          expansionData.relevance[keyword] = input.keywords.includes(keyword) ? 1.0 : 0.7;
        });
      }
      
      console.log(`Keyword expansion completed with ${expansionData.expandedKeywords.length} keywords`);
      
      return {
        success: true,
        data: expansionData
      };
    } catch (parseError: any) {
      console.error('Error parsing keyword expansion response:', parseError);
      return {
        success: false,
        error: `Failed to parse keyword expansion data: ${parseError.message}`
      };
    }
  } catch (error: any) {
    console.error('Error in keyword expansion agent:', error);
    return {
      success: false,
      error: `Keyword expansion failed: ${error.message}`
    };
  }
}