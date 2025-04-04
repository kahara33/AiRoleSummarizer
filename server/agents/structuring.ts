/**
 * 構造化エージェント
 * 収集した業界情報とキーワードを階層的カテゴリに構造化するAIエージェント
 */

import { AgentResult } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';

/**
 * 構造化処理入力データ
 */
export interface StructuringInput {
  roleName: string;             // 役割名
  description: string;          // 役割の説明
  industries: string[];         // 選択された業界
  keywords: string[];           // 選択されたキーワード
  industryAnalysisData: IndustryAnalysisData;  // 業界分析データ
  keywordExpansionData: KeywordExpansionData;  // キーワード拡張データ
  userId: string;               // ユーザーID
  roleModelId: string;          // 役割モデルID
}

/**
 * カテゴリ情報
 */
export interface Category {
  id: string;                   // カテゴリID
  name: string;                 // カテゴリ名
  description: string;          // 説明
  level: number;                // 階層レベル（1: 最上位）
  parentId?: string | null;     // 親カテゴリID
}

/**
 * カテゴリ間関連
 */
export interface CategoryConnection {
  sourceCategoryId: string;     // 始点カテゴリID
  targetCategoryId: string;     // 終点カテゴリID
  connectionType: string;       // 関連タイプ
  strength: number;             // 関連強度（1-10）
  description: string;          // 関連の説明
}

/**
 * 構造化データ
 */
export interface StructuringData {
  categories: Category[];                // カテゴリ
  connections: CategoryConnection[];     // カテゴリ間関連
}

/**
 * 収集した情報を階層的カテゴリに構造化する
 * @param input 構造化処理入力データ
 * @returns 構造化結果
 */
export async function structureContent(
  input: StructuringInput
): Promise<AgentResult<StructuringData>> {
  try {
    console.log(`構造化エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `役割「${input.roleName}」の情報構造化を開始します。`);
    
    // 業界情報とキーワードをまとめる
    const industries = input.industryAnalysisData.industries.map(i => i.name).join(', ');
    const subIndustries = input.industryAnalysisData.subIndustries.map(s => s.name).join(', ');
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは情報構造化の専門家です。業界情報とキーワードを階層的カテゴリに整理してください。以下の形式でJSON出力してください:
{
  "categories": [
    {
      "id": "カテゴリのユニークID（例：category_01）",
      "name": "カテゴリ名",
      "description": "カテゴリの説明（80-120文字）",
      "level": 階層レベル（1: 最上位、2: 第2階層、3: 第3階層）,
      "parentId": "親カテゴリID（最上位カテゴリの場合はnull）"
    }
  ],
  "connections": [
    {
      "sourceCategoryId": "始点カテゴリID",
      "targetCategoryId": "終点カテゴリID",
      "connectionType": "関連タイプ（例：包含、関連、対立など）",
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
- サブ業界: ${subIndustries}

この役割に関連する情報を階層的カテゴリに構造化してください。最上位（レベル1）、第2階層（レベル2）、第3階層（レベル3）のカテゴリを作成し、それらの関連性を定義してください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `分析された業界情報とキーワードに基づいて、階層的カテゴリ構造を生成しています。最上位カテゴリから第3階層まで作成します。`);
    
    // APIを呼び出して構造化を実行
    const response = await callAzureOpenAI(messages, 0.5, 3000);
    
    try {
      // レスポンスをJSONとしてパース
      const structuringData: StructuringData = JSON.parse(response);
      
      // データの検証
      if (!structuringData.categories || !Array.isArray(structuringData.categories)) {
        throw new Error('Categories data is missing or invalid');
      }
      
      if (!structuringData.connections || !Array.isArray(structuringData.connections)) {
        structuringData.connections = []; // 空の配列を設定
      }
      
      // 結果をログ出力
      console.log(`構造化結果: ${structuringData.categories.length}個のカテゴリ、${structuringData.connections.length}個の関連を生成`);
      
      // 分析結果の思考をユーザーに共有
      sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `構造化完了: ${structuringData.categories.length}個のカテゴリを階層的に配置しました。最上位カテゴリ: ${structuringData.categories.filter(c => c.level === 1).map(c => c.name).join(', ')}`);
      
      return {
        success: true,
        data: structuringData
      };
      
    } catch (parseError: any) {
      console.error('Error parsing structuring response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      return {
        success: false,
        error: `APIレスポンスの解析に失敗しました: ${parseError.message}`,
        data: { categories: [], connections: [] }
      };
    }
    
  } catch (error: any) {
    console.error('Error in structuring content:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: 情報構造化の実行中にエラーが発生しました。`);
    
    return {
      success: false,
      error: `情報構造化の実行中にエラーが発生しました: ${error.message}`,
      data: { categories: [], connections: [] }
    };
  }
}