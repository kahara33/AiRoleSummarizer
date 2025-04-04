/**
 * LangChainを活用したAIエージェント用ツール
 */

import { DynamicTool } from 'langchain/tools';
import { sendAgentThoughts } from '../../websocket';
import { callAzureOpenAI } from '../../azure-openai';
import { db } from '../../db';
import { industries } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * 業界データ検索ツール
 * データベースから業界情報を取得
 */
export const searchIndustryTool = new DynamicTool({
  name: "業界情報検索",
  description: "特定の業界名に関する詳細情報を取得します。業界名を入力してください。",
  func: async (industryName: string): Promise<string> => {
    try {
      // データベースから業界情報を取得
      const [industry] = await db
        .select()
        .from(industries)
        .where(eq(industries.name, industryName));
      
      if (!industry) {
        return `業界「${industryName}」の情報は見つかりませんでした。`;
      }
      
      return `
        業界名: ${industry.name}
        説明: ${industry.description || 'なし'}
        作成日: ${industry.createdAt?.toISOString() || 'なし'}
      `;
    } catch (error) {
      console.error('業界検索ツールエラー:', error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * 業界統計分析ツール
 * 業界に関する統計情報を分析
 */
export const industryStatisticsTool = new DynamicTool({
  name: "業界統計分析",
  description: "指定された業界の統計やトレンド情報を分析します。業界名を入力してください。",
  func: async (industryName: string): Promise<string> => {
    try {
      // この例では、Azure OpenAIを使って業界統計情報を生成
      const prompt = [
        {
          role: "system",
          content: "あなたは業界統計の専門家です。指定された業界の最新の統計情報と主要なトレンドを提供してください。"
        },
        {
          role: "user",
          content: `${industryName}業界の主要な統計情報と現在のトレンドを教えてください。具体的な数字を含めて簡潔に説明してください。`
        }
      ];
      
      const response = await callAzureOpenAI(prompt, 0.5, 1000);
      return response;
    } catch (error) {
      console.error('業界統計ツールエラー:', error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * 業界分析エージェント用ツール群
 */
export const industryAnalysisTools = [
  searchIndustryTool,
  industryStatisticsTool,
];

/**
 * WebSocketでエージェントの思考を送信するツール
 */
export const agentThoughtsTool = new DynamicTool({
  name: "エージェント思考送信",
  description: "エージェントの思考プロセスをWebSocketを通じてクライアントに送信します。",
  func: async (input: string): Promise<string> => {
    try {
      const { userId, roleModelId, agentName, thought } = JSON.parse(input);
      
      if (!userId || !roleModelId || !agentName || !thought) {
        return "必須パラメータが不足しています。userId, roleModelId, agentName, thought を指定してください。";
      }
      
      await sendAgentThoughts(userId, roleModelId, agentName, thought);
      return "思考プロセスを送信しました。";
    } catch (error) {
      console.error('思考送信ツールエラー:', error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});