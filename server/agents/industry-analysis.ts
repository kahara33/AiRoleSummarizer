/**
 * 業界分析エージェント
 * 選択された業界に関する分析を行うAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

/**
 * 業界情報
 */
export interface Industry {
  id: string;                 // 業界ID
  name: string;               // 業界名
  description: string;        // 説明
}

/**
 * サブ業界情報
 */
export interface SubIndustry {
  id: string;                 // サブ業界ID
  name: string;               // サブ業界名
  description: string;        // 説明
  parentId: string;           // 親業界ID
}

/**
 * 業界分析入力データ
 */
export interface IndustryAnalysisInput {
  roleName: string;           // 役割名
  description: string;        // 役割の説明
  industries: string[];       // 選択された業界
  keywords: string[];         // 初期キーワード
  userId: string;             // ユーザーID
  roleModelId: string;        // 役割モデルID
}

/**
 * 業界分析データ
 */
export interface IndustryAnalysisData {
  industries: Industry[];     // 業界リスト
  subIndustries: SubIndustry[]; // サブ業界リスト
  trends: string[];           // 業界トレンド
  challenges: string[];       // 業界課題
  opportunities: string[];    // 業界機会
  keyPlayers: string[];       // 主要プレイヤー
  technologies: string[];     // 関連技術
}

/**
 * 選択された業界に基づいて分析を行う
 * @param input 業界分析入力データ
 * @returns 業界分析結果
 */
export async function analyzeIndustries(
  input: IndustryAnalysisInput
): Promise<AgentResult<IndustryAnalysisData>> {
  try {
    console.log(`業界分析エージェント起動: ${input.roleName}, 業界: ${input.industries.join(', ')}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `役割「${input.roleName}」の業界分析を開始します。対象業界: ${input.industries.join(', ')}`);
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは業界分析の専門家です。提供された業界について詳細な分析を行い、役割に関連する情報を抽出してください。以下の形式でJSON出力してください:
{
  "trends": ["トレンド1", "トレンド2", ...],         // 業界の重要なトレンド（5-10件）
  "challenges": ["課題1", "課題2", ...],            // 業界が直面する課題（5-10件）
  "opportunities": ["機会1", "機会2", ...],         // 業界の成長機会（5-10件）
  "keyPlayers": ["主要企業/組織1", "主要企業/組織2", ...], // 主要プレイヤー（5-10件）
  "technologies": ["技術1", "技術2", ...],          // 関連する重要技術（5-10件）
  "subIndustries": [                              // サブ業界情報
    {
      "name": "サブ業界名1",
      "description": "サブ業界の説明"
    },
    ...
  ]
}`
      },
      {
        role: 'user',
        content: `役割名: ${input.roleName}
役割の説明: ${input.description}
選択された業界: ${input.industries.join(', ')}
初期キーワード: ${input.keywords.join(', ')}

この役割に関連する業界分析を行ってください。特に、この役割に特に関連する視点から業界を分析し、トレンド、課題、機会、主要プレイヤー、関連技術、サブ業界について詳細に説明してください。それぞれ5-10項目程度に整理してください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'IndustryAnalysisAgent',
      `業界「${input.industries.join(', ')}」の分析中。トレンド、課題、機会、主要プレイヤー、関連技術、サブ業界を特定しています。`
    );
    
    // APIを呼び出して業界分析を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      const analysisData = JSON.parse(response);
      
      // 各プロパティの存在を確認
      const trends = Array.isArray(analysisData.trends) ? analysisData.trends : [];
      const challenges = Array.isArray(analysisData.challenges) ? analysisData.challenges : [];
      const opportunities = Array.isArray(analysisData.opportunities) ? analysisData.opportunities : [];
      const keyPlayers = Array.isArray(analysisData.keyPlayers) ? analysisData.keyPlayers : [];
      const technologies = Array.isArray(analysisData.technologies) ? analysisData.technologies : [];
      const rawSubIndustries = Array.isArray(analysisData.subIndustries) ? analysisData.subIndustries : [];
      
      // 業界とサブ業界のデータを作成
      const industries: Industry[] = input.industries.map(industryName => ({
        id: uuidv4(),
        name: industryName,
        description: `${industryName}業界`
      }));
      
      // 親業界IDのマッピングを作成
      const industryMap = new Map<string, string>();
      industries.forEach(industry => {
        industryMap.set(industry.name.toLowerCase(), industry.id);
      });
      
      // サブ業界を整形
      const subIndustries: SubIndustry[] = rawSubIndustries.map(subIndustry => {
        // 親業界の決定（最初の業界をデフォルトとして使用）
        const defaultParentId = industries.length > 0 ? industries[0].id : uuidv4();
        let parentId = defaultParentId;
        
        // サブ業界名から関連する親業界を推測
        const subIndustryName = subIndustry.name.toLowerCase();
        for (const [industryName, id] of industryMap.entries()) {
          if (subIndustryName.includes(industryName)) {
            parentId = id;
            break;
          }
        }
        
        return {
          id: uuidv4(),
          name: subIndustry.name,
          description: subIndustry.description || `${subIndustry.name}のサブ業界`,
          parentId
        };
      });
      
      // 業界分析結果の思考をユーザーに共有
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'IndustryAnalysisAgent',
        `業界分析完了: ${trends.length}件のトレンド、${challenges.length}件の課題、${subIndustries.length}件のサブ業界を特定しました。`
      );
      
      return {
        success: true,
        data: {
          industries,
          subIndustries,
          trends,
          challenges,
          opportunities,
          keyPlayers,
          technologies
        }
      };
      
    } catch (parseError: any) {
      console.error('Error parsing industry analysis response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      // 基本的なデータを作成
      const industries: Industry[] = input.industries.map(industryName => ({
        id: uuidv4(),
        name: industryName,
        description: `${industryName}業界`
      }));
      
      return {
        success: false,
        error: `業界分析データの解析に失敗しました: ${parseError.message}`,
        data: {
          industries,
          subIndustries: [],
          trends: [`${input.industries.join(', ')} 業界の最新トレンド`],
          challenges: [`${input.industries.join(', ')} 業界の主要課題`],
          opportunities: [`${input.industries.join(', ')} 業界の成長機会`],
          keyPlayers: [`${input.industries.join(', ')} 業界の主要企業`],
          technologies: [`${input.industries.join(', ')} 業界の重要技術`]
        }
      };
    }
    
  } catch (error: any) {
    console.error('Error in industry analysis:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'IndustryAnalysisAgent', `エラー: 業界分析の実行中にエラーが発生しました。`);
    
    // エラー時の基本的なデータを作成
    const industries: Industry[] = input.industries.map(industryName => ({
      id: uuidv4(),
      name: industryName,
      description: `${industryName}業界`
    }));
    
    return {
      success: false,
      error: `業界分析の実行中にエラーが発生しました: ${error.message}`,
      data: {
        industries,
        subIndustries: [],
        trends: input.industries.map(industry => `${industry}業界の発展トレンド`),
        challenges: input.industries.map(industry => `${industry}業界における課題`),
        opportunities: input.industries.map(industry => `${industry}業界の新たな機会`),
        keyPlayers: input.industries.map(industry => `${industry}業界の主要企業`),
        technologies: input.keywords.length > 0 ? input.keywords : [`${input.industries[0] || ''}関連技術`]
      }
    };
  }
}