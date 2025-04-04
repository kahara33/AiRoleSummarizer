// 構造化エージェント
// 拡張キーワードやデータを階層的構造に整理

import { AgentResult, RoleModelInput } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';
import { callAzureOpenAI } from '../azure-openai';

export interface HierarchicalCategory {
  id: string;            // カテゴリのID
  name: string;          // カテゴリの名前
  level: number;         // 階層レベル（0: ルート、1: 一次、2: 二次、...）
  parentId?: string;     // 親カテゴリID（ルートの場合はnull）
  keywords: string[];    // このカテゴリに属するキーワード
  description?: string;  // カテゴリの説明
}

export interface StructuringData {
  hierarchicalCategories: HierarchicalCategory[];
}

/**
 * 構造化エージェント
 * キーワードを意味のある階層構造に整理
 */
export async function structureKnowledge(
  input: RoleModelInput,
  industryData?: IndustryAnalysisData,
  keywordData?: KeywordExpansionData
): Promise<AgentResult<StructuringData>> {
  try {
    console.log(`Structuring knowledge for role: ${input.roleName}`);
    
    // キーワードデータが存在する場合は、それを使用
    const keywords = keywordData?.expandedKeywords || input.keywords;
    
    if (keywords.length === 0) {
      console.log('No keywords available for structuring');
      return {
        success: false,
        error: 'No keywords available for structuring'
      };
    }
    
    console.log(`Structuring ${keywords.length} keywords`);
    
    // 業界分析データがある場合は、それを活用
    const industryContext = industryData ? 
      `
      【業界洞察】
      ${industryData.industryInsights.map((insight, i) => `${i+1}. ${insight}`).join('\n')}
      
      【主要トレンド】
      ${industryData.keyTrends.map((trend, i) => `${i+1}. ${trend}`).join('\n')}
      ` : '';
    
    // 関連度情報の追加
    const relevanceInfo = keywordData?.relevance ? 
      Object.entries(keywordData.relevance)
        .sort((a, b) => b[1] - a[1])
        .map(([keyword, relevance]) => `「${keyword}」(関連度: ${relevance.toFixed(2)})`)
        .join(', ') : '';
    
    // プロンプトを生成
    const prompt = [
      {
        role: "system",
        content: `あなたは知識構造化の専門家です。与えられたキーワードセットを階層的な形式に整理し、意味のあるカテゴリに分類してください。
        結果はJSON形式で返してください。`
      },
      {
        role: "user",
        content: `次の役割とキーワードに基づいて、階層的な知識構造を作成してください：
        
        役割名: ${input.roleName}
        説明: ${input.description || '特に指定なし'}
        業界: ${input.industries.join(', ')}
        
        ${industryContext}
        
        以下のキーワードを意味のある階層構造に整理してください：
        ${keywords.join(', ')}
        
        ${relevanceInfo ? `\n【キーワードの関連度情報】\n${relevanceInfo}` : ''}
        
        階層構造は、中心となる概念（役割自体）をルートとし、主要カテゴリとサブカテゴリに分類してください。
        
        以下の形式でJSON出力してください：
        {
          "hierarchicalCategories": [
            {
              "id": "root",  // ルートノードのIDは常に"root"
              "name": "${input.roleName}",  // ルートノードの名前は役割名
              "level": 0,  // ルートノードのレベルは常に0
              "keywords": [],  // ルートノードに直接紐づくキーワードはない場合が多い
              "description": "ルート概念の説明"
            },
            {
              "id": "category1",  // 一意のID（category1, category2, などでOK）
              "name": "主要カテゴリ1",  // カテゴリ名
              "level": 1,  // 主要カテゴリはレベル1
              "parentId": "root",  // 親カテゴリID
              "keywords": ["関連キーワード1", "関連キーワード2"],  // このカテゴリに分類されるキーワード
              "description": "このカテゴリの説明"
            },
            {
              "id": "subcategory1",
              "name": "サブカテゴリ1",
              "level": 2,  // サブカテゴリはレベル2
              "parentId": "category1",  // 親カテゴリID
              "keywords": ["関連キーワード3", "関連キーワード4"],
              "description": "このサブカテゴリの説明"
            },
            ...
          ]
        }
        
        注意事項：
        - 主要カテゴリ（レベル1）は4〜6個程度作成してください
        - 各主要カテゴリには適切なサブカテゴリを2〜4個作成してください
        - 全てのキーワードがいずれかのカテゴリに含まれるようにしてください
        - カテゴリ名は簡潔に（5-15文字程度）
        - カテゴリの説明は30-50文字程度で作成してください
        - カテゴリ間は論理的に関連性があり、重複がないようにしてください
        - 日本語で回答してください`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 2000);
    
    // 結果をパース
    try {
      let structuringData: StructuringData;
      
      // JSON形式の部分を抽出
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuringData = JSON.parse(jsonMatch[0]);
      } else {
        structuringData = JSON.parse(responseContent);
      }
      
      // データの検証
      if (!structuringData.hierarchicalCategories || !Array.isArray(structuringData.hierarchicalCategories)) {
        structuringData = { hierarchicalCategories: [] };
      }
      
      // ルートノードがない場合は追加
      if (!structuringData.hierarchicalCategories.some(cat => cat.id === 'root')) {
        structuringData.hierarchicalCategories.unshift({
          id: 'root',
          name: input.roleName,
          level: 0,
          keywords: [],
          description: input.description || `${input.roleName}の情報構造`
        });
      }
      
      console.log(`Structuring completed with ${structuringData.hierarchicalCategories.length} categories`);
      
      return {
        success: true,
        data: structuringData
      };
    } catch (parseError: any) {
      console.error('Error parsing structuring response:', parseError);
      return {
        success: false,
        error: `Failed to parse structuring data: ${parseError.message}`
      };
    }
  } catch (error: any) {
    console.error('Error in structuring agent:', error);
    return {
      success: false,
      error: `Structuring failed: ${error.message}`
    };
  }
}