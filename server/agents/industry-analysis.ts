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
    
    // 業界分析プロセスの開始を通知
    sendAgentThoughts(
      input.userId, 
      input.roleModelId, 
      'IndustryAnalysisAgent', 
      `役割「${input.roleName}」の業界分析を開始します。`, 
      'thinking'
    );
    
    // 詳細な業界分析プロセスのステップを説明
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'IndustryAnalysisAgent',
      `業界分析プロセスの詳細:\n` +
      `1. 選択された業界の市場動向と競争環境の調査中...\n` +
      `2. 業界特有のトレンドとイノベーションの特定中...\n` +
      `3. 主要な課題と機会ポイントの分析中...\n` +
      `4. 主要プレイヤーと競合状況の評価中...\n` +
      `5. 業界に関連する重要技術の特定と分析中...`,
      'thinking'
    );
    
    // 対象業界の詳細情報
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'IndustryAnalysisAgent',
      `対象業界: ${input.industries.join('、')}。業界ごとの特性と相互関連性を含めた包括的な分析を行います。特に役割「${input.roleName}」に関連する側面に焦点を当てます。`,
      'thinking'
    );
    
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
    
    // 思考過程をユーザーに共有（詳細）
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'IndustryAnalysisAgent',
      `業界「${input.industries.join(', ')}」のトレンド、課題、機会、主要プレイヤー、技術を分析中...`,
      'thinking'
    );

    // 各業界について詳細な分析情報を提供
    for (const industry of input.industries) {
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'IndustryAnalysisAgent',
        `${industry}業界の詳細分析プロセス：\n- 市場規模と成長率の評価\n- 主要企業と競争状況の調査\n- 最新技術トレンドの特定\n- 規制環境と法的要件の確認\n- 消費者行動と需要パターンの分析中...`,
        'thinking'
      );
    }
    
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