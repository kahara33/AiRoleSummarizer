/**
 * キーワード拡張エージェント
 * 初期キーワードを業界分析と組み合わせて拡張するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

/**
 * キーワード情報
 */
export interface Keyword {
  id: string;                     // キーワードID
  name: string;                   // キーワード名
  description: string;            // 説明
  relevanceScore: number;         // 関連性スコア（0-100）
  categories?: string[];          // カテゴリ（任意）
  relatedTerms?: string[];        // 関連用語（任意）
}

/**
 * キーワード拡張入力データ
 */
export interface KeywordExpansionInput {
  roleName: string;               // 役割名
  description: string;            // 役割の説明
  industries: string[];           // 選択された業界
  keywords: string[];             // 初期キーワード
  industryAnalysisData: IndustryAnalysisData; // 業界分析データ
  userId: string;                 // ユーザーID
  roleModelId: string;            // 役割モデルID
}

/**
 * キーワード拡張データ
 */
export interface KeywordExpansionData {
  keywords: Keyword[];           // 拡張されたキーワードリスト
}

/**
 * 初期キーワードを業界分析に基づいて拡張する
 * @param input キーワード拡張入力データ
 * @returns キーワード拡張データ
 */
export async function expandKeywords(
  input: KeywordExpansionInput
): Promise<AgentResult<KeywordExpansionData>> {
  try {
    console.log(`キーワード拡張エージェント起動: ${input.roleName}, 初期キーワード: ${input.keywords.join(', ')}`);
    
    // キーワード拡張プロセスの開始を通知
    sendAgentThoughts(
      input.userId, 
      input.roleModelId, 
      'KeywordExpansionAgent', 
      `役割「${input.roleName}」のキーワード拡張を開始します。`, 
      'thinking'
    );
    
    // 詳細なキーワード拡張プロセスのステップを説明
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KeywordExpansionAgent',
      `キーワード拡張プロセスの詳細:\n` +
      `1. 初期キーワード群の分析と意味的関連性の抽出中...\n` +
      `2. 業界分析データとの統合と関連キーワード候補の生成中...\n` +
      `3. 専門用語とビジネス用語の特定と収集中...\n` +
      `4. キーワード関連度のスコアリングと評価中...\n` +
      `5. 最終キーワードセットの最適化と調整中...`,
      'thinking'
    );
    
    // 入力キーワードの分析情報を提供
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KeywordExpansionAgent',
      `入力キーワード「${input.keywords.join('、')}」を分析中。初期キーワード数は${input.keywords.length}個です。これらから関連キーワードを拡張し、関連度スコアを計算します。`,
      'thinking'
    );
    
    // 業界情報の要約を作成
    const industries = input.industries.join(', ');
    const trends = input.industryAnalysisData.trends.join('\n- ');
    const technologies = input.industryAnalysisData.technologies.join('\n- ');
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたはキーワード拡張の専門家です。提供された初期キーワードと業界情報を分析して、関連するキーワードを拡張・生成してください。以下の形式でJSON出力してください:
{
  "keywords": [
    {
      "name": "キーワード1",
      "description": "キーワードの説明",
      "relevanceScore": 90,  // 役割との関連性スコア（0-100）
      "categories": ["カテゴリ1", "カテゴリ2"],  // キーワードが属するカテゴリ
      "relatedTerms": ["関連用語1", "関連用語2"]  // 関連する用語
    },
    ...
  ]
}`
      },
      {
        role: 'user',
        content: `役割名: ${input.roleName}
役割の説明: ${input.description}
選択された業界: ${industries}
初期キーワード: ${input.keywords.join(', ')}

業界トレンド:
- ${trends}

関連技術:
- ${technologies}

この役割に関連するキーワードを拡張してください。元の初期キーワードを含め、合計で30-50個程度のキーワードを生成してください。
各キーワードには説明と役割への関連性スコア（0-100）を付けてください。スコアは役割への関連性の高さを示します。
キーワードはカテゴリに分類し、関連する用語も追加してください。`
      }
    ];
    
    // 思考過程をユーザーに共有（より詳細に）
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KeywordExpansionAgent',
      `初期キーワード「${input.keywords.join(', ')}」を業界「${industries}」の文脈で拡張中。役割に関連する重要なキーワードを探索しています。`,
      'thinking'
    );
    
    // キーワード拡張プロセスの詳細なステップを共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KeywordExpansionAgent',
      `キーワード拡張プロセスの詳細:\n` +
      `1. 業界分析結果からの関連キーワード抽出中...\n` +
      `2. 各キーワードの関連度スコアリング中...\n` +
      `3. 役割「${input.roleName}」に最適なキーワードの優先順位付け中...\n` +
      `4. 階層的なキーワード構造の検討中...\n` +
      `5. キーワード間の関連性分析中...`,
      'thinking'
    );
    
    // 業界トレンドに基づく詳細な分析情報を共有
    if (input.industryAnalysisData && input.industryAnalysisData.trends && input.industryAnalysisData.trends.length > 0) {
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'KeywordExpansionAgent',
        `業界トレンド「${input.industryAnalysisData.trends.slice(0, 3).join('、')}」に関連するキーワードを検索中...`,
        'thinking'
      );
    }
    
    // APIを呼び出してキーワード拡張を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      // 不完全なJSONやエスケープ問題に対処するため、JSONの部分だけを抽出
      let jsonStr = response;
      
      // JSON部分を探す（{から始まる部分を探す）
      const jsonStartIdx = response.indexOf('{');
      if (jsonStartIdx !== 0 && jsonStartIdx > 0) {
        jsonStr = response.substring(jsonStartIdx);
      }
      
      // 不完全なJSONを修復する試み
      // まず、jsonStrの内容をログに出力して確認
      console.log("Received JSON string (first 100 chars):", jsonStr.substring(0, 100));
      console.log("JSON string length:", jsonStr.length);
      
      // JSON文字列の修復を試みる
      let expansionData;
      
      try {
        // まず閉じ括弧が足りない場合に補完
        const openBraces = (jsonStr.match(/{/g) || []).length;
        const closeBraces = (jsonStr.match(/}/g) || []).length;
        
        if (openBraces > closeBraces) {
          // 閉じ括弧が足りない場合は追加
          const missingBraces = openBraces - closeBraces;
          jsonStr = jsonStr + "}".repeat(missingBraces);
          console.log(`JSON文字列を修復しました: ${missingBraces}個の閉じ括弧を追加`);
        }
        
        // 1. 最初のパース試行
        expansionData = JSON.parse(jsonStr);
        console.log("JSONのパースに成功しました");
      } catch (firstParseError) {
        console.error("JSON修復の最初の試みが失敗:", firstParseError);
        
        try {
          // 2. 正規表現でJSONオブジェクト全体を探す
          const jsonRegex = /{[\s\S]*?}/;
          const match = response.match(jsonRegex);
          
          if (match && match[0]) {
            console.log("正規表現でJSONを抽出しました");
            try {
              expansionData = JSON.parse(match[0]);
              console.log("抽出したJSONのパースに成功しました");
            } catch (regexParseError) {
              console.error("抽出したJSONのパースに失敗:", regexParseError);
              throw regexParseError;
            }
          } else {
            // 3. keywords配列だけを抽出
            console.log("JSONオブジェクト全体の抽出に失敗。キーワード配列のみを抽出します");
            const keywordsMatch = /"keywords"\s*:\s*\[([\s\S]*?)\]/;
            const keywordsData = response.match(keywordsMatch);
            
            if (keywordsData && keywordsData[0]) {
              console.log("キーワード配列を見つけました");
              const wrappedJson = `{${keywordsData[0]}}`;
              try {
                expansionData = JSON.parse(wrappedJson);
                console.log("キーワード配列のパースに成功しました");
              } catch (keywordsParseError) {
                console.error("キーワード配列のパースに失敗:", keywordsParseError);
                
                // 4. フォールバック - 空のキーワード配列を作成
                console.log("フォールバック：空のキーワード配列を使用");
                expansionData = { keywords: [] };
              }
            } else {
              // 5. 最終フォールバック
              console.log("キーワード配列も見つからず。フォールバックを使用");
              expansionData = { keywords: [] };
            }
          }
        } catch (secondParseError) {
          console.error("JSON修復のすべての試みが失敗:", secondParseError);
          // フォールバック
          console.log("すべての修復が失敗。フォールバックを使用");
          expansionData = { keywords: [] };
        }
      }
      
      // キーワード情報を検証
      if (!expansionData.keywords || !Array.isArray(expansionData.keywords)) {
        throw new Error('応答データの形式が不正です');
      }
      
      // キーワードデータの整形とIDの割り当て
      const keywords: Keyword[] = expansionData.keywords.map(keyword => ({
        id: uuidv4(),
        name: keyword.name || '不明なキーワード',
        description: keyword.description || `${keyword.name || '不明なキーワード'}に関するキーワード`,
        relevanceScore: typeof keyword.relevanceScore === 'number' 
          ? Math.max(0, Math.min(100, keyword.relevanceScore)) 
          : 50,
        categories: Array.isArray(keyword.categories) ? keyword.categories : undefined,
        relatedTerms: Array.isArray(keyword.relatedTerms) ? keyword.relatedTerms : undefined
      }));
      
      // 初期キーワードが含まれていない場合は追加
      const existingKeywords = new Set(keywords.map(k => k.name.toLowerCase()));
      
      input.keywords.forEach(initialKeyword => {
        if (!existingKeywords.has(initialKeyword.toLowerCase())) {
          keywords.push({
            id: uuidv4(),
            name: initialKeyword,
            description: `初期キーワード：${initialKeyword}`,
            relevanceScore: 90,  // 初期キーワードは高い関連性を持つ
          });
        }
      });
      
      // キーワード拡張結果の思考をユーザーに共有
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'KeywordExpansionAgent',
        `キーワード拡張完了: ${keywords.length}個のキーワードを生成しました。最も関連性の高いキーワード: ${keywords.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5).map(k => k.name).join(', ')}`
      );
      
      return {
        success: true,
        data: {
          keywords
        }
      };
      
    } catch (parseError: any) {
      console.error('Error parsing keyword expansion response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      // 初期キーワードのみを使用した基本的なデータを作成
      const fallbackKeywords: Keyword[] = input.keywords.map((keyword, index) => ({
        id: uuidv4(),
        name: keyword,
        description: `${keyword}に関するキーワード`,
        relevanceScore: 100 - index * 5, // 順番に応じて関連性を下げる（最大95まで下がる）
      }));
      
      // 業界名と技術リストからも追加キーワードを生成
      input.industries.forEach(industry => {
        fallbackKeywords.push({
          id: uuidv4(),
          name: industry,
          description: `${industry}業界`,
          relevanceScore: 85,
        });
      });
      
      input.industryAnalysisData.technologies.slice(0, 5).forEach((tech, index) => {
        fallbackKeywords.push({
          id: uuidv4(),
          name: tech,
          description: `関連技術：${tech}`,
          relevanceScore: 80 - index * 5,
        });
      });
      
      return {
        success: false,
        error: `キーワード拡張データの解析に失敗しました: ${parseError.message}`,
        data: {
          keywords: fallbackKeywords
        }
      };
    }
    
  } catch (error: any) {
    console.error('Error in keyword expansion:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `エラー: キーワード拡張の実行中にエラーが発生しました。`);
    
    // エラー時の最小限のデータを作成
    const basicKeywords: Keyword[] = input.keywords.map((keyword, index) => ({
      id: uuidv4(),
      name: keyword,
      description: `${keyword}に関するキーワード`,
      relevanceScore: 100 - index * 10, // 順番に応じて関連性を下げる
    }));
    
    return {
      success: false,
      error: `キーワード拡張の実行中にエラーが発生しました: ${error.message}`,
      data: {
        keywords: basicKeywords
      }
    };
  }
}