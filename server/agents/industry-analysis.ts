/**
 * 業界分析エージェント
 * 役割に関連する業界情報を収集・分析するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

/**
 * 業界分析入力データ
 */
export interface IndustryAnalysisInput {
  roleName: string;             // 役割名
  description: string;          // 役割の説明
  industries: string[];         // 選択された業界
  userId: string;               // ユーザーID
  roleModelId: string;          // 役割モデルID
}

/**
 * 業界情報
 */
export interface Industry {
  id: string;                   // 業界ID
  name: string;                 // 業界名
  description: string;          // 説明
}

/**
 * サブ業界情報
 */
export interface SubIndustry {
  id: string;                   // サブ業界ID
  parentId: string;             // 親業界ID
  name: string;                 // サブ業界名
  description: string;          // 説明
}

/**
 * 業界分析データ
 */
export interface IndustryAnalysisData {
  industries: Industry[];       // 業界リスト
  subIndustries: SubIndustry[]; // サブ業界リスト
}

/**
 * 役割に関連する業界情報を分析する
 * @param input 業界分析入力データ
 * @returns 業界分析結果
 */
export async function analyzeIndustries(
  input: IndustryAnalysisInput
): Promise<AgentResult<IndustryAnalysisData>> {
  try {
    console.log(`業界分析エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `役割「${input.roleName}」の業界分析を開始します。選択された業界: ${input.industries.join(', ')}`);
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは業界分析の専門家です。提供された役割モデルの情報に基づいて、関連する業界と
その下位のサブ業界について詳細に分析してください。以下の形式でJSON出力してください:
{
  "industries": [
    {
      "id": "業界のユニークID（例：industry_01）",
      "name": "業界名",
      "description": "業界の説明（100-150文字）"
    }
  ],
  "subIndustries": [
    {
      "id": "サブ業界のユニークID（例：subindustry_01）",
      "parentId": "親業界のID",
      "name": "サブ業界名",
      "description": "サブ業界の説明（80-120文字）"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `役割名: ${input.roleName}
役割の説明: ${input.description}
選択された業界: ${input.industries.join(', ')}

この役割に関連する主要業界とサブ業界を特定し、それぞれについて簡潔な説明を提供してください。選択された業界を必ず含め、必要に応じて追加の関連業界を特定してください。各業界について最低2つのサブ業界を含めてください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `選択された業界（${input.industries.join(', ')}）に基づいて、関連する業界とサブ業界を特定しています。`);
    
    // APIを呼び出して業界分析を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      const analysisData: IndustryAnalysisData = JSON.parse(response);
      
      // データの検証
      if (!analysisData.industries || !Array.isArray(analysisData.industries)) {
        throw new Error('Industries data is missing or invalid');
      }
      
      if (!analysisData.subIndustries || !Array.isArray(analysisData.subIndustries)) {
        throw new Error('SubIndustries data is missing or invalid');
      }
      
      // 業界とサブ業界のIDを検証し、必要に応じて生成
      analysisData.industries.forEach(industry => {
        if (!industry.id) {
          industry.id = uuidv4();
        }
      });
      
      analysisData.subIndustries.forEach(subIndustry => {
        if (!subIndustry.id) {
          subIndustry.id = uuidv4();
        }
        
        // 親業界IDの検証
        const parentExists = analysisData.industries.some(industry => industry.id === subIndustry.parentId);
        if (!parentExists) {
          // 親業界が見つからない場合は最初の業界を親として設定
          subIndustry.parentId = analysisData.industries[0].id;
        }
      });
      
      // 結果をログ出力
      console.log(`業界分析結果: ${analysisData.industries.length}個の業界と${analysisData.subIndustries.length}個のサブ業界を特定`);
      
      // 分析結果の思考をユーザーに共有
      sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `分析完了: ${analysisData.industries.length}個の業界と${analysisData.subIndustries.length}個のサブ業界を特定しました。主要業界: ${analysisData.industries.map(i => i.name).join(', ')}`);
      
      return {
        success: true,
        data: analysisData
      };
      
    } catch (parseError: any) {
      console.error('Error parsing industry analysis response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      return {
        success: false,
        error: `APIレスポンスの解析に失敗しました: ${parseError.message}`,
        data: { industries: [], subIndustries: [] }
      };
    }
    
  } catch (error: any) {
    console.error('Error in industry analysis:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: 業界分析の実行中にエラーが発生しました。`);
    
    return {
      success: false,
      error: `業界分析の実行中にエラーが発生しました: ${error.message}`,
      data: { industries: [], subIndustries: [] }
    };
  }
}