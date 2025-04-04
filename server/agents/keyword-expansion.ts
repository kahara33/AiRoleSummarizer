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
    sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `役割「${input.roleName}」のキーワード拡張を開始します。`);
    
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
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KeywordExpansionAgent',
      `初期キーワード「${input.keywords.join(', ')}」を業界「${industries}」の文脈で拡張中。役割に関連する重要なキーワードを探索しています。`
    );
    
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
      
      console.log("Processing JSON response for keyword expansion");
      
      // JSONパースを試みる
      const expansionData = JSON.parse(jsonStr);
      
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