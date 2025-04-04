/**
 * 業界分析エージェント
 * 選択された業界の傾向や課題を分析するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

/**
 * 業界情報
 */
export interface Industry {
  id: string;                     // 業界ID
  name: string;                   // 業界名
  description: string;            // 説明
  subIndustries: string[];        // サブ業界リスト
}

/**
 * 業界分析入力データ
 */
export interface IndustryAnalysisInput {
  roleName: string;               // 役割名
  description: string;            // 役割の説明
  industries: string[];           // 選択された業界
  keywords: string[];             // 初期キーワード
  userId: string;                 // ユーザーID
  roleModelId: string;            // 役割モデルID
}

/**
 * 業界分析データ
 */
export interface IndustryAnalysisData {
  industries: Industry[];         // 業界リスト
  trends: string[];               // トレンドリスト
  challenges: string[];           // 課題リスト
  opportunities: string[];        // チャンスリスト
  keyPlayers: string[];           // 主要プレイヤーリスト
  technologies: string[];         // 関連技術リスト
  subIndustries: Map<string, string[]>; // 業界ごとのサブ業界マップ
}

/**
 * 選択された業界を分析する
 * @param input 業界分析入力データ
 * @returns 業界分析データ
 */
export async function analyzeIndustries(
  input: IndustryAnalysisInput
): Promise<AgentResult<IndustryAnalysisData>> {
  try {
    console.log(`業界分析エージェント起動: ${input.roleName}, 業界: ${input.industries.join(', ')}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `役割「${input.roleName}」の業界分析を開始します。`);
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは業界分析の専門家です。与えられた業界とキーワードに関して詳細な分析を行い、以下の形式でJSON出力してください:
{
  "industries": [
    {
      "name": "業界名",
      "description": "詳細な業界の説明",
      "subIndustries": ["サブ業界1", "サブ業界2", ...]
    },
    ...
  ],
  "trends": ["トレンド1", "トレンド2", ...],
  "challenges": ["課題1", "課題2", ...],
  "opportunities": ["機会1", "機会2", ...],
  "keyPlayers": ["主要プレイヤー1", "主要プレイヤー2", ...],
  "technologies": ["関連技術1", "関連技術2", ...]
}`
      },
      {
        role: 'user',
        content: `役割名: ${input.roleName}
役割の説明: ${input.description}
選択された業界: ${input.industries.join(', ')}
初期キーワード: ${input.keywords.join(', ')}

これらの業界と役割について包括的な分析を行ってください。特に、現在のトレンド、課題、機会、主要プレイヤー、関連技術について詳しく分析してください。各業界の説明も詳細に記述し、サブ業界も列挙してください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'IndustryAnalysisAgent',
      `業界「${input.industries.join(', ')}」のトレンド、課題、機会、主要プレイヤー、技術を分析中...`
    );
    
    // APIを呼び出して業界分析を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      const analysisData = JSON.parse(response);
      
      // 分析データを検証
      if (!analysisData.industries || !Array.isArray(analysisData.industries)) {
        throw new Error('応答データの形式が不正です');
      }
      
      // サブ業界マップを構築
      const subIndustryMap = new Map<string, string[]>();
      
      // 業界情報の処理とIDの割り当て
      const industries: Industry[] = analysisData.industries.map(industry => {
        const id = uuidv4();
        
        // サブ業界情報を保存
        if (industry.subIndustries && Array.isArray(industry.subIndustries)) {
          subIndustryMap.set(industry.name, industry.subIndustries);
        }
        
        return {
          id,
          name: industry.name || '不明な業界',
          description: industry.description || `${industry.name || '不明な業界'}の説明`,
          subIndustries: Array.isArray(industry.subIndustries) ? industry.subIndustries : []
        };
      });
      
      // 配列データの正規化
      const normalizeArray = (arr: any) => Array.isArray(arr) ? arr : [];
      
      // 結果オブジェクトの構築
      const result: IndustryAnalysisData = {
        industries,
        trends: normalizeArray(analysisData.trends),
        challenges: normalizeArray(analysisData.challenges),
        opportunities: normalizeArray(analysisData.opportunities),
        keyPlayers: normalizeArray(analysisData.keyPlayers),
        technologies: normalizeArray(analysisData.technologies),
        subIndustries: subIndustryMap
      };
      
      // 分析結果の思考をユーザーに共有
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'IndustryAnalysisAgent',
        `業界分析完了: ${result.industries.length}業界、${result.trends.length}トレンド、${result.technologies.length}技術を特定しました。`
      );
      
      return {
        success: true,
        data: result
      };
      
    } catch (parseError: any) {
      console.error('Error parsing industry analysis response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      // エラー時のフォールバックデータを作成
      const fallbackIndustries: Industry[] = input.industries.map(industryName => ({
        id: uuidv4(),
        name: industryName,
        description: `${industryName}業界`,
        subIndustries: []
      }));
      
      const fallbackMap = new Map<string, string[]>();
      fallbackIndustries.forEach(industry => {
        fallbackMap.set(industry.name, []);
      });
      
      const fallbackData: IndustryAnalysisData = {
        industries: fallbackIndustries,
        trends: input.keywords.slice(0, 3),
        challenges: ['市場競争の激化', '技術の急速な変化', '人材確保の難しさ'],
        opportunities: ['新興市場の開拓', 'デジタル化による効率向上', '顧客体験の改善'],
        keyPlayers: [],
        technologies: input.keywords.filter(k => k.includes('技術') || k.includes('システム') || k.includes('AI')),
        subIndustries: fallbackMap
      };
      
      return {
        success: false,
        error: `業界分析データの解析に失敗しました: ${parseError.message}`,
        data: fallbackData
      };
    }
    
  } catch (error: any) {
    console.error('Error in industry analysis:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: 業界分析の実行中にエラーが発生しました。`);
    
    // エラー時の最小限のデータを作成
    const basicIndustries: Industry[] = input.industries.map(industryName => ({
      id: uuidv4(),
      name: industryName,
      description: `${industryName}業界`,
      subIndustries: []
    }));
    
    const basicMap = new Map<string, string[]>();
    basicIndustries.forEach(industry => {
      basicMap.set(industry.name, []);
    });
    
    const basicData: IndustryAnalysisData = {
      industries: basicIndustries,
      trends: [],
      challenges: [],
      opportunities: [],
      keyPlayers: [],
      technologies: [],
      subIndustries: basicMap
    };
    
    return {
      success: false,
      error: `業界分析の実行中にエラーが発生しました: ${error.message}`,
      data: basicData
    };
  }
}