/**
 * 構造化エージェント
 * 業界分析とキーワード拡張データを使用して階層的な知識構造を作成するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData, Keyword } from './keyword-expansion';
import { sendAgentThoughts } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';

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
 * サブカテゴリ情報
 */
export interface Subcategory {
  id: string;                     // サブカテゴリID
  name: string;                   // サブカテゴリ名
  description: string;            // 説明
  skills: Skill[];                // スキルリスト
}

/**
 * スキル情報
 */
export interface Skill {
  id: string;                     // スキルID
  name: string;                   // スキル名
  description: string;            // 説明
  level?: string;                 // レベル（任意）
  keywords?: string[];            // 関連キーワード（任意）
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
 * 業界分析と拡張キーワードを使用してコンテンツを構造化する
 * @param input 構造化入力データ
 * @returns 構造化データ
 */
export async function structureContent(
  input: StructuringInput
): Promise<AgentResult<StructuringData>> {
  try {
    console.log(`構造化エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `役割「${input.roleName}」の知識構造化を開始します。`);
    
    // 業界情報の要約を作成
    const industries = input.industries.join(', ');
    const trends = input.industryAnalysisData.trends.join('\n- ');
    const technologies = input.industryAnalysisData.technologies.join('\n- ');
    
    // キーワード情報を整理
    const topKeywords = input.keywordExpansionData.keywords
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 30)
      .map(k => `${k.name} (関連度: ${k.relevanceScore}): ${k.description}`).join('\n- ');
    
    // OpenAIモデルに送信するメッセージを構築
    const messages = [
      {
        role: 'system',
        content: `あなたは知識構造化の専門家です。与えられた業界情報とキーワードから、役割に必要な知識やスキルを体系的に整理して階層構造を作成してください。以下の形式でJSON出力してください:
{
  "categories": [
    {
      "name": "カテゴリ1",
      "description": "カテゴリの説明",
      "subcategories": [
        {
          "name": "サブカテゴリ1",
          "description": "サブカテゴリの説明",
          "skills": [
            {
              "name": "スキル1",
              "description": "スキルの説明",
              "level": "初級/中級/上級",
              "keywords": ["関連キーワード1", "関連キーワード2"]
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

業界トレンド:
- ${trends}

関連技術:
- ${technologies}

重要キーワード:
- ${topKeywords}

この役割に必要な知識やスキルを体系的に整理し、3〜5個のカテゴリに分類してください。各カテゴリは3〜5個のサブカテゴリを含み、各サブカテゴリは関連するスキルを含めてください。スキルには説明、レベル、関連キーワードを含めてください。`
      }
    ];
    
    // 思考過程をユーザーに共有
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'StructuringAgent',
      `業界「${industries}」と拡張されたキーワードに基づいて、役割「${input.roleName}」に必要な知識を体系化しています。カテゴリ、サブカテゴリ、スキルの階層構造を作成中...`
    );
    
    // APIを呼び出して構造化を実行
    const response = await callAzureOpenAI(messages);
    
    try {
      // レスポンスをJSONとしてパース
      const structuringData = JSON.parse(response);
      
      // カテゴリ情報を検証
      if (!structuringData.categories || !Array.isArray(structuringData.categories)) {
        throw new Error('応答データの形式が不正です');
      }
      
      // IDを割り当てる関数
      const assignIds = (data: any): StructuringData => {
        const categories: Category[] = data.categories.map((category: any) => {
          const categoryId = uuidv4();
          
          const subcategories: Subcategory[] = (category.subcategories || []).map((subcategory: any) => {
            const subcategoryId = uuidv4();
            
            const skills: Skill[] = (subcategory.skills || []).map((skill: any) => {
              return {
                id: uuidv4(),
                name: skill.name || 'スキル名なし',
                description: skill.description || `${skill.name || 'スキル'}に関するスキル`,
                level: skill.level || '中級',
                keywords: Array.isArray(skill.keywords) ? skill.keywords : []
              };
            });
            
            return {
              id: subcategoryId,
              name: subcategory.name || 'サブカテゴリ名なし',
              description: subcategory.description || `${subcategory.name || 'サブカテゴリ'}に関するサブカテゴリ`,
              skills
            };
          });
          
          return {
            id: categoryId,
            name: category.name || 'カテゴリ名なし',
            description: category.description || `${category.name || 'カテゴリ'}に関するカテゴリ`,
            subcategories
          };
        });
        
        return { categories };
      };
      
      // IDを割り当てる
      const structuredData = assignIds(structuringData);
      
      // 統計情報を計算
      const categoryCount = structuredData.categories.length;
      const subcategoryCount = structuredData.categories.reduce(
        (acc, category) => acc + category.subcategories.length, 0
      );
      const skillCount = structuredData.categories.reduce(
        (acc, category) => acc + category.subcategories.reduce(
          (subAcc, subcategory) => subAcc + subcategory.skills.length, 0
        ), 0
      );
      
      // 構造化結果の思考をユーザーに共有
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'StructuringAgent',
        `知識構造化完了: ${categoryCount}カテゴリ、${subcategoryCount}サブカテゴリ、${skillCount}スキルを生成しました。`
      );
      
      return {
        success: true,
        data: structuredData
      };
      
    } catch (parseError: any) {
      console.error('Error parsing structuring response:', parseError);
      sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: APIレスポンスの解析に失敗しました。`);
      
      // 最小限の基本的な構造を作成
      const fallbackStructure: StructuringData = {
        categories: [
          {
            id: uuidv4(),
            name: '基本知識',
            description: `${input.roleName}に関する基本的な知識`,
            subcategories: [
              {
                id: uuidv4(),
                name: '主要概念',
                description: '役割における主要な概念と理論',
                skills: input.keywords.slice(0, 3).map(keyword => ({
                  id: uuidv4(),
                  name: keyword,
                  description: `${keyword}に関する知識とスキル`,
                  level: '中級',
                  keywords: [keyword]
                }))
              }
            ]
          },
          {
            id: uuidv4(),
            name: '業界知識',
            description: '選択された業界に関する専門知識',
            subcategories: input.industries.map(industry => ({
              id: uuidv4(),
              name: industry,
              description: `${industry}業界に関する知識`,
              skills: [
                {
                  id: uuidv4(),
                  name: `${industry}の基礎`,
                  description: `${industry}業界の基本的な理解`,
                  level: '初級',
                  keywords: [industry]
                },
                {
                  id: uuidv4(),
                  name: `${industry}のトレンド分析`,
                  description: `${industry}業界の最新トレンドを分析するスキル`,
                  level: '中級',
                  keywords: [industry, 'トレンド分析']
                }
              ]
            }))
          },
          {
            id: uuidv4(),
            name: '技術スキル',
            description: '役割に必要な技術的なスキルセット',
            subcategories: [
              {
                id: uuidv4(),
                name: '主要技術',
                description: '役割に必要な主要な技術',
                skills: input.industryAnalysisData.technologies.slice(0, 3).map(tech => ({
                  id: uuidv4(),
                  name: tech,
                  description: `${tech}に関する技術的スキル`,
                  level: '中級',
                  keywords: [tech]
                }))
              }
            ]
          }
        ]
      };
      
      return {
        success: false,
        error: `構造化データの解析に失敗しました: ${parseError.message}`,
        data: fallbackStructure
      };
    }
    
  } catch (error: any) {
    console.error('Error in structuring:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'StructuringAgent', `エラー: 知識構造化の実行中にエラーが発生しました。`);
    
    // エラー時の最小限の構造を作成
    const basicStructure: StructuringData = {
      categories: [
        {
          id: uuidv4(),
          name: '基本カテゴリ',
          description: `${input.roleName}の基本カテゴリ`,
          subcategories: [
            {
              id: uuidv4(),
              name: '基本サブカテゴリ',
              description: '基本的な知識とスキル',
              skills: [
                {
                  id: uuidv4(),
                  name: '基本スキル',
                  description: '役割に必要な基本的なスキル',
                  level: '初級'
                }
              ]
            }
          ]
        }
      ]
    };
    
    return {
      success: false,
      error: `知識構造化の実行中にエラーが発生しました: ${error.message}`,
      data: basicStructure
    };
  }
}