/**
 * キーワード拡張エージェント
 * 役割モデルに関連するキーワードを拡張して関連概念を抽出するAIエージェント
 */

import { AgentResult } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';
import { IndustryAnalysisData } from './industry-analysis';

/**
 * キーワード拡張入力データ
 */
export interface KeywordExpansionInput {
  roleName: string;             // 役割名
  description: string;          // 役割の説明
  industries: string[];         // 選択された業界
  keywords: string[];           // 選択されたキーワード
  industryAnalysisData: IndustryAnalysisData;  // 業界分析データ
  userId: string;               // ユーザーID
  roleModelId: string;          // 役割モデルID
}

/**
 * キーワード情報
 */
export interface Keyword {
  id: string;                   // キーワードID
  name: string;                 // キーワード名
  description: string;          // 説明
  importance: number;           // 重要度（1-10）
  industryIds: string[];        // 関連業界ID
}

/**
 * 概念情報
 */
export interface Concept {
  id: string;                   // 概念ID
  name: string;                 // 概念名
  description: string;          // 説明
  keywordIds: string[];         // 関連キーワードID
  relevance: number;            // 関連度（1-10）
}

/**
 * キーワード間関連
 */
export interface KeywordRelation {
  sourceKeywordId: string;      // 始点キーワードID
  targetKeywordId: string;      // 終点キーワードID
  relationType: string;         // 関連タイプ
  strength: number;             // 関連強度（1-10）
  description: string;          // 関連の説明
}

/**
 * キーワード拡張データ
 */
export interface KeywordExpansionData {
  keywords: Keyword[];          // キーワード
  concepts: Concept[];          // 概念
  relations: KeywordRelation[]; // キーワード間関連
}

/**
 * 役割モデルに関連するキーワードを拡張する
 * @param input キーワード拡張入力データ
 * @returns キーワード拡張結果
 */
export async function expandKeywords(
  input: KeywordExpansionInput
): Promise<AgentResult<KeywordExpansionData>> {
  try {
    console.log(`キーワード拡張エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `役割「${input.roleName}」のキーワード拡張を開始します。選択されたキーワード: ${input.keywords.join(', ')}`);
    
    // 業界情報をまとめる
    const industries = input.industryAnalysisData.industries.map(i => i.name).join(', ');
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたはキーワード拡張の専門家です。役割モデルに関連するキーワードを拡張し、関連概念を抽出してください。以下の形式でJSON出力してください:
{
  "keywords": [
    {
      "id": "キーワードのユニークID（例：keyword_01）",
      "name": "キーワード名",
      "description": "キーワードの説明（80-120文字）",
      "importance": 重要度（1-10の数値）,
      "industryIds": ["関連業界ID1", "関連業界ID2"]
    }
  ],
  "concepts": [
    {
      "id": "概念のユニークID（例：concept_01）",
      "name": "概念名",
      "description": "概念の説明（100-150文字）",
      "keywordIds": ["関連キーワードID1", "関連キーワードID2"],
      "relevance": 関連度（1-10の数値）
    }
  ],
  "relations": [
    {
      "sourceKeywordId": "始点キーワードID",
      "targetKeywordId": "終点キーワードID",
      "relationType": "関連タイプ（例：包含、類似、対立など）",
      "strength": 関連強度（1-10の数値）,
      "description": "関連の説明（50-80文字）"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `役割名: ${input.roleName}
役割の説明: ${input.description || '特になし'}
選択された業界: ${input.industries.join(', ')}
選択されたキーワード: ${input.keywords.join(', ')}

業界情報:
- 主要業界: ${industries}

この役割に関連するキーワードを拡張し、関連概念を抽出してください。元のキーワードを含め、追加で関連するキーワードを見つけ、それらの間の関連性を定義してください。また、キーワードから抽出される重要な概念も特定してください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `選択されたキーワード（${input.keywords.join(', ')}）と業界情報に基づいて、関連キーワードと概念を抽出しています。`);
    
    // APIを呼び出してキーワード拡張を実行
    const response = await callAzureOpenAI(messages, 0.7, 3000);
    
    try {
      // レスポンスをJSONとしてパース
      const expansionData: KeywordExpansionData = JSON.parse(response);
      
      // データの検証
      if (!expansionData.keywords || !Array.isArray(expansionData.keywords)) {
        throw new Error('Keywords data is missing or invalid');
      }
      
      if (!expansionData.concepts || !Array.isArray(expansionData.concepts)) {
        expansionData.concepts = []; // 空の配列を設定
      }
      
      if (!expansionData.relations || !Array.isArray(expansionData.relations)) {
        expansionData.relations = []; // 空の配列を設定
      }
      
      // 結果をログ出力
      console.log(`キーワード拡張結果: ${expansionData.keywords.length}個のキーワード、${expansionData.concepts.length}個の概念、${expansionData.relations.length}個の関連を特定`);
      
      // 分析結果の思考をユーザーに共有
      sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `拡張完了: ${expansionData.keywords.length}個のキーワードと${expansionData.concepts.length}個の概念を特定しました。キーワード: ${expansionData.keywords.map(k => k.name).join(', ')}`);
      
      return {
        success: true,
        data: expansionData
      };
      
    } catch (parseError: any) {
      console.error('Error parsing keyword expansion response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      return {
        success: false,
        error: `APIレスポンスの解析に失敗しました: ${parseError.message}`,
        data: { keywords: [], concepts: [], relations: [] }
      };
    }
    
  } catch (error: any) {
    console.error('Error in keyword expansion:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'KeywordExpansionAgent', `エラー: キーワード拡張の実行中にエラーが発生しました。`);
    
    return {
      success: false,
      error: `キーワード拡張の実行中にエラーが発生しました: ${error.message}`,
      data: { keywords: [], concepts: [], relations: [] }
    };
  }
}