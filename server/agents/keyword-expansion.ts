// キーワード拡張エージェント
// 入力キーワードを拡張し、関連する追加キーワードを生成

import { AgentResult, RoleModelInput } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { callAzureOpenAI } from '../azure-openai';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket';

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
  industryData: IndustryAnalysisData
): Promise<AgentResult<KeywordExpansionData>> {
  try {
    console.log(`Expanding keywords for role: ${input.roleName}`);
    console.log(`Initial keywords: ${input.keywords.join(', ')}`);
    
    // WebSocketで進捗状況を送信（開始）
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'キーワード拡張',
        10,
        { stage: '初期化', initialCount: input.keywords.length }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'キーワード拡張エージェント',
        `キーワード拡張プロセスを開始します...\n役割: ${input.roleName}\n初期キーワード: ${input.keywords.join(', ') || 'なし'}\n\n業界分析データを活用して関連キーワードを抽出します。`
      );
    }
    
    // 明示的に元のキーワードを使用
    const baseKeywords = input.keywords;
    
    if (baseKeywords.length === 0) {
      console.log('No initial keywords provided, will generate based on role and industry');
      
      // 進捗状況更新
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'キーワード拡張エージェント',
          '初期キーワードが指定されていないため、役割の説明と業界分析から最適なキーワードを生成します。'
        );
      }
    }
    
    // 業界分析データからの詳細な情報を活用
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
    
    // 改善されたプロンプト：業界データとキーワードの関連付けを強化
    const prompt = [
      {
        role: "system",
        content: `あなたは情報収集のためのキーワード拡張スペシャリストです。提供された役割、業界、初期キーワードに基づいて、関連するキーワードを拡張してください。
        結果はJSON形式で返してください。
        
        このシステムは「情報収集サービス」です。ユーザーが日々の情報収集を効率的に行うために必要なキーワードを提供することが目的です。
        情報収集の観点から具体的で検索可能なキーワードが必要です。例えば、「Azure OpenAI Service」「Microsoft Power Platform」「React」のような具体的な製品名や技術名が望ましいです。`
      },
      {
        role: "user",
        content: `以下のロール、業界情報、ベースキーワードをもとに、情報収集に役立つキーワードを拡張してください：
        
        ロール名: ${input.roleName}
        ロール詳細: ${input.description || '特に指定なし'}
        業界: ${input.industries.length > 0 ? input.industries.join(', ') : '特に指定なし'}
        
        ベースキーワード: ${baseKeywords.join(', ')}
        
        業界分析情報:
        ${industryContext}
        
        この役割に重要と思われるキーワードを追加してください。本人の日々の情報収集や自己成長に役立つものを優先してください。
        入力キーワードは最重要キーワードとして含めてください。
        
        以下の形式でJSON出力してください：
        {
          "expandedKeywords": ["キーワード1", "キーワード2", ...],  // オリジナルのキーワードを含め、合計15-20個程度
          "relevance": {
            "キーワード1": 0.95,  // 関連度（0.0-1.0）
            "キーワード2": 0.85,
            ...
          }
        }
        
        各キーワードには関連度スコア(0.0-1.0)を付けてください。
        回答は日本語で提供し、キーワードは短く具体的に記述してください（各5-15文字程度）。
        技術用語、ツール名、概念名など、具体的で検索可能なキーワードを含めてください。
        最先端のトレンドやツールを含めることが重要です。`
      }
    ];
    
    // 進捗状況更新
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'キーワード拡張',
        30,
        { stage: 'AI分析中' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'キーワード拡張エージェント',
        '業界分析データを基に、関連キーワードを生成しています...\nAzure OpenAIに処理を依頼中です。'
      );
    }
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 1500);
    
    // 進捗状況更新
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'キーワード拡張',
        70,
        { stage: 'データ解析中' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'キーワード拡張エージェント',
        'AIからの回答を受信しました。キーワードデータを解析しています...'
      );
    }
    
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
        expansionData.expandedKeywords = [...baseKeywords];
      }
      if (!expansionData.relevance || typeof expansionData.relevance !== 'object') {
        expansionData.relevance = {};
        expansionData.expandedKeywords.forEach(keyword => {
          expansionData.relevance[keyword] = 1.0;
        });
      }
      
      // 元のキーワードが含まれていることを確認
      baseKeywords.forEach(keyword => {
        if (!expansionData.expandedKeywords.includes(keyword)) {
          expansionData.expandedKeywords.unshift(keyword);
          expansionData.relevance[keyword] = 1.0;
        }
      });
      
      // 進捗状況更新（完了）
      if (input.userId && input.roleModelId) {
        sendProgressUpdate(
          input.userId,
          input.roleModelId,
          'キーワード拡張',
          100,
          { 
            stage: '完了', 
            initialCount: baseKeywords.length,
            expandedCount: expansionData.expandedKeywords.length,
            newKeywords: expansionData.expandedKeywords.length - baseKeywords.length
          }
        );
        
        // 新しく追加されたキーワードのサンプルを表示
        const newKeywords = expansionData.expandedKeywords
          .filter(kw => !baseKeywords.includes(kw))
          .slice(0, 5);
          
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'キーワード拡張エージェント',
          `キーワード拡張が完了しました。\n\n` +
          `初期キーワード数: ${baseKeywords.length}\n` +
          `拡張後キーワード数: ${expansionData.expandedKeywords.length}\n\n` +
          `追加キーワード例: ${newKeywords.join('、')}\n\n` +
          `次のステップ: 構造化エージェントに拡張キーワードを渡します。`
        );
      }
      
      return {
        success: true,
        data: expansionData
      };
    } catch (error) {
      console.error('Error parsing keyword expansion result:', error);
      return {
        success: false,
        error: 'Failed to parse keyword expansion result'
      };
    }
  } catch (error) {
    console.error('Error in keyword expansion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in keyword expansion'
    };
  }
}
