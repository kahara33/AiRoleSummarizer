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
  industryData: IndustryAnalysisData,
  keywordData: KeywordExpansionData
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
    
    // 業界分析データのコンテキスト
    const industryContext = `
      【業界洞察】
      ${industryData.industryInsights.map((insight, i) => `${i+1}. ${insight}`).join('\n')}
      
      【主要トレンド】
      ${industryData.keyTrends.map((trend, i) => `${i+1}. ${trend}`).join('\n')}
      
      【ターゲット対象】
      ${industryData.targetAudience.map((audience, i) => `${i+1}. ${audience}`).join('\n')}
      
      【ビジネスモデル】
      ${industryData.businessModels.map((model, i) => `${i+1}. ${model}`).join('\n')}
      
      【課題と機会】
      ${industryData.challengesOpportunities.map((item, i) => `${i+1}. ${item}`).join('\n')}
    `;
    
    // 関連度情報の追加
    const relevanceInfo = keywordData?.relevance ? 
      Object.entries(keywordData.relevance)
        .sort((a, b) => b[1] - a[1])
        .map(([keyword, score]) => `${keyword}: ${score.toFixed(2)}`)
        .join('\n') : '';
    
    // 改善されたプロンプト：情報収集特化の固定カテゴリーを実装
    const prompt = [
      {
        role: "system",
        content: `あなたは情報構造化の専門家です。情報収集のための最適な階層構造を設計してください。`
      },
      {
        role: "user",
        content: `以下のロール、業界データ、キーワードを情報収集に最適化された階層構造に整理してください。

        必ず以下の5つの情報収集カテゴリを第一階層のノードとして使用してください:
        1. 情報収集目的（なぜ情報を集めるのか）
        2. 情報源と技術リソース（どこから情報を得るか）
        3. 業界専門知識（関連する業界知識）
        4. トレンド分析（最新動向の把握方法）
        5. 実践応用分野（収集した情報の活用法）
        
        ロール名: ${input.roleName}
        ロール詳細: ${input.description || '特に指定なし'}
        業界: ${input.industries.length > 0 ? input.industries.join(', ') : '特に指定なし'}
        
        業界分析データ:
        ${industryContext}
        
        キーワードデータ（関連度順）:
        ${relevanceInfo}
        
        以下の形式でJSON出力してください：
        {
          "hierarchicalCategories": [
            {
              "id": "root",  // ルートID
              "name": "${input.roleName}",  // ルート名はロール名
              "level": 0,  // ルートレベルは常に0
              "keywords": [],  // ルートノードに直接紐づくキーワードはない場合が多い
              "description": "ルート概念の説明"
            },
            {
              "id": "purpose",
              "name": "情報収集目的",
              "level": 1,
              "parentId": "root",
              "keywords": ["関連キーワード1", "関連キーワード2"],
              "description": "情報収集の目的と意義"
            },
            {
              "id": "sources",
              "name": "情報源と技術リソース",
              "level": 1,
              "parentId": "root",
              "keywords": ["関連キーワード3", "関連キーワード4"],
              "description": "情報を取得するリソースと方法"
            },
            ... 他の第一階層カテゴリと第二階層以降のカテゴリ ...
          ]
        }
        
        注意事項：
        - 5つの固定第一階層カテゴリを必ず使用してください
        - 各第一階層カテゴリには適切なサブカテゴリを2〜4個作成してください
        - 全てのキーワードがいずれかのカテゴリに含まれるようにしてください
        - カテゴリ名は簡潔に（5-15文字程度）
        - カテゴリの説明は30-50文字程度で作成してください
        - カテゴリ間は論理的に関連性があり、重複がないようにしてください
        - 各カテゴリにはロールと業界に固有のサブカテゴリを含めてください
        - 日本語で回答してください`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 2500);
    
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
        structuringData.hierarchicalCategories = [];
      }
      
      // ルートカテゴリが存在することを確認
      if (!structuringData.hierarchicalCategories.some(cat => cat.level === 0)) {
        structuringData.hierarchicalCategories.unshift({
          id: "root",
          name: input.roleName,
          level: 0,
          keywords: [],
          description: `${input.roleName}の知識構造`
        });
      }
      
      // 5つの固定カテゴリが存在することを確認
      const requiredCategories = [
        { id: "purpose", name: "情報収集目的", description: "情報収集の目的と意義" },
        { id: "sources", name: "情報源と技術リソース", description: "情報を取得するリソースと方法" },
        { id: "domain", name: "業界専門知識", description: "関連する業界知識" },
        { id: "trends", name: "トレンド分析", description: "最新動向の把握方法" },
        { id: "application", name: "実践応用分野", description: "収集した情報の活用法" }
      ];
      
      // 不足カテゴリの追加
      const rootId = structuringData.hierarchicalCategories.find(cat => cat.level === 0)?.id || "root";
      requiredCategories.forEach(reqCat => {
        if (!structuringData.hierarchicalCategories.some(cat => cat.id === reqCat.id || cat.name === reqCat.name)) {
          structuringData.hierarchicalCategories.push({
            id: reqCat.id,
            name: reqCat.name,
            level: 1,
            parentId: rootId,
            keywords: [],
            description: reqCat.description
          });
        }
      });
      
      return {
        success: true,
        data: structuringData
      };
    } catch (error) {
      console.error('Error parsing structuring result:', error);
      return {
        success: false,
        error: 'Failed to parse structuring result'
      };
    }
  } catch (error) {
    console.error('Error in knowledge structuring:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in knowledge structuring'
    };
  }
}
