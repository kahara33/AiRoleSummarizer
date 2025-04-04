/**
 * 構造化エージェント
 * キーワードと業界分析から階層的な知識構造を生成するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

/**
 * スキル情報
 */
export interface Skill {
  id: string;                     // スキルID
  name: string;                   // スキル名
  description: string;            // 説明
  level: string;                  // レベル（基礎、応用、専門家）
}

/**
 * サブカテゴリ情報
 */
export interface Subcategory {
  id: string;                     // サブカテゴリID
  name: string;                   // サブカテゴリ名
  description: string;            // 説明
  skills: Skill[];                // スキルリスト
}

/**
 * カテゴリ情報
 */
export interface Category {
  id: string;                     // カテゴリID
  name: string;                   // カテゴリ名
  description: string;            // 説明
  subcategories: Subcategory[];   // サブカテゴリリスト
}

/**
 * 構造化入力データ
 */
export interface StructuringInput {
  roleName: string;               // 役割名
  description: string;            // 役割の説明
  industries: string[];           // 選択された業界
  keywords: string[];             // 初期キーワード
  industryAnalysisData: IndustryAnalysisData; // 業界分析データ
  keywordExpansionData: KeywordExpansionData; // キーワード拡張データ
  userId: string;                 // ユーザーID
  roleModelId: string;            // 役割モデルID
}

/**
 * 構造化データ
 */
export interface StructuringData {
  categories: Category[];         // カテゴリリスト
}

/**
 * キーワードと業界分析から階層的な知識構造を生成する
 * @param input 構造化入力データ
 * @returns 構造化データ
 */
export async function structureContent(
  input: StructuringInput
): Promise<AgentResult<StructuringData>> {
  try {
    console.log(`構造化エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `役割「${input.roleName}」の知識構造化を開始します。`);
    
    // 主要キーワードを取得
    const topKeywords = input.keywordExpansionData.keywords
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 30)
      .map(kw => kw.name);
    
    // 業界情報の要約を作成
    const industries = input.industries.join(', ');
    const trends = input.industryAnalysisData.trends.join('\n- ');
    const challenges = input.industryAnalysisData.challenges.join('\n- ');
    const technologies = input.industryAnalysisData.technologies.join('\n- ');
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは知識構造化の専門家です。役割モデルのための階層的な知識構造を生成してください。以下の形式でJSON出力してください:
{
  "categories": [
    {
      "name": "カテゴリ名1",
      "description": "カテゴリの説明",
      "subcategories": [
        {
          "name": "サブカテゴリ名1",
          "description": "サブカテゴリの説明",
          "skills": [
            {
              "name": "スキル名1",
              "description": "スキルの説明",
              "level": "基礎/応用/専門家"
            },
            ...
          ]
        },
        ...
      ]
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

主要キーワード（関連性順）:
${topKeywords.join(', ')}

業界トレンド:
- ${trends}

業界課題:
- ${challenges}

関連技術:
- ${technologies}

この役割モデルの階層的な知識構造を作成してください。3-5個の主要カテゴリに分類し、各カテゴリには2-4個のサブカテゴリを含めてください。各サブカテゴリには3-7個のスキルを含めてください。各スキルには「基礎」「応用」「専門家」のいずれかのレベルを割り当ててください。説明は具体的かつ簡潔に記述してください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'StructuringAgent',
      `役割「${input.roleName}」の知識構造化中。キーワードと業界分析データを活用して、カテゴリ、サブカテゴリ、スキルの階層構造を作成しています。`
    );
    
    // APIを呼び出して知識構造化を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      const structuringData = JSON.parse(response);
      
      // カテゴリ情報を検証
      if (!structuringData.categories || !Array.isArray(structuringData.categories)) {
        throw new Error('応答データの形式が不正です');
      }
      
      // カテゴリデータの整形とIDの割り当て
      const categories: Category[] = structuringData.categories.map(category => {
        const categoryId = uuidv4();
        
        // サブカテゴリの処理
        const subcategories: Subcategory[] = Array.isArray(category.subcategories) 
          ? category.subcategories.map(subcategory => {
              const subcategoryId = uuidv4();
              
              // スキルの処理
              const skills: Skill[] = Array.isArray(subcategory.skills) 
                ? subcategory.skills.map(skill => ({
                    id: uuidv4(),
                    name: skill.name || '不明なスキル',
                    description: skill.description || `${skill.name || '不明なスキル'}に関するスキル`,
                    level: ['基礎', '応用', '専門家'].includes(skill.level) ? skill.level : '基礎'
                  }))
                : [];
                
              return {
                id: subcategoryId,
                name: subcategory.name || '不明なサブカテゴリ',
                description: subcategory.description || `${subcategory.name || '不明なサブカテゴリ'}に関する知識分野`,
                skills
              };
            })
          : [];
          
        return {
          id: categoryId,
          name: category.name || '不明なカテゴリ',
          description: category.description || `${category.name || '不明なカテゴリ'}に関する知識分野`,
          subcategories
        };
      });
      
      // 構造化結果の思考をユーザーに共有
      const totalSkills = categories.reduce((total, category) => {
        return total + category.subcategories.reduce((subTotal, subcategory) => {
          return subTotal + subcategory.skills.length;
        }, 0);
      }, 0);
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'StructuringAgent',
        `知識構造化完了: ${categories.length}個のカテゴリ、${categories.reduce((sum, cat) => sum + cat.subcategories.length, 0)}個のサブカテゴリ、${totalSkills}個のスキルを特定しました。`
      );
      
      return {
        success: true,
        data: {
          categories
        }
      };
      
    } catch (parseError: any) {
      console.error('Error parsing structuring response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      // 最低限の構造を生成
      return {
        success: false,
        error: `知識構造化データの解析に失敗しました: ${parseError.message}`,
        data: {
          categories: generateFallbackCategories(input)
        }
      };
    }
    
  } catch (error: any) {
    console.error('Error in content structuring:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: 知識構造化の実行中にエラーが発生しました。`);
    
    // エラー時の最小限のデータを作成
    return {
      success: false,
      error: `知識構造化の実行中にエラーが発生しました: ${error.message}`,
      data: {
        categories: generateFallbackCategories(input)
      }
    };
  }
}

/**
 * エラー時に使用する基本的なカテゴリ構造を生成する
 * @param input 構造化入力データ
 * @returns カテゴリリスト
 */
function generateFallbackCategories(input: StructuringInput): Category[] {
  const categories: Category[] = [];
  
  // 業界に基づく基本カテゴリ
  if (input.industries.length > 0) {
    const skills: Skill[] = input.keywordExpansionData.keywords
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
      .map(keyword => ({
        id: uuidv4(),
        name: keyword.name,
        description: keyword.description,
        level: keyword.relevanceScore >= 80 ? '専門家' : keyword.relevanceScore >= 50 ? '応用' : '基礎'
      }));
      
    const industryCategory: Category = {
      id: uuidv4(),
      name: `${input.industries[0]}の知識`,
      description: `${input.industries[0]}業界に関する重要な知識分野`,
      subcategories: [
        {
          id: uuidv4(),
          name: `${input.industries[0]}の基本スキル`,
          description: `${input.industries[0]}業界で必要とされる基本的なスキルと知識`,
          skills: skills.slice(0, Math.min(skills.length, 3))
        }
      ]
    };
    
    categories.push(industryCategory);
  }
  
  // 役割に基づく基本カテゴリ
  const roleCategory: Category = {
    id: uuidv4(),
    name: `${input.roleName}の専門スキル`,
    description: `${input.roleName}として必要な専門的なスキルと知識`,
    subcategories: [
      {
        id: uuidv4(),
        name: '必須スキル',
        description: `${input.roleName}に不可欠な基本スキル`,
        skills: input.keywords.slice(0, Math.min(input.keywords.length, 3)).map(keyword => ({
          id: uuidv4(),
          name: keyword,
          description: `${keyword}に関するスキル`,
          level: '基礎'
        }))
      }
    ]
  };
  
  categories.push(roleCategory);
  
  return categories;
}