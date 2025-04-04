/**
 * LangChain統合のためのユーティリティ
 * Azure OpenAI APIとLangChainを連携するためのヘルパー関数
 */

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "langchain/prompts";
import {
  StructuredOutputParser,
  OutputFixingParser,
} from "langchain/output_parsers";
import { z } from "zod";

/**
 * Azure OpenAI APIを使用したLangChainチャットモデルを初期化
 */
export function createAzureOpenAIModel(
  temperature = 0.7,
  maxTokens = 1500
): ChatOpenAI {
  return new ChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_KEY,
    azureOpenAIApiVersion: "2024-02-15-preview",
    azureOpenAIApiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    azureOpenAIApiInstanceName: "everys-openai",
    temperature,
    maxTokens,
  });
}

/**
 * 業界分析のための構造化出力パーサーを作成
 */
export function createIndustryAnalysisParser() {
  // Zodスキーマを使用して出力形式を定義
  const industryAnalysisSchema = z.object({
    industryInsights: z.array(z.string()).describe("業界全般の重要な洞察（5-7項目）"),
    targetAudience: z.array(z.string()).describe("この役割が対象とする顧客や組織（3-5項目）"),
    keyTrends: z.array(z.string()).describe("業界の主要なトレンド（4-6項目）"),
    businessModels: z.array(z.string()).describe("関連するビジネスモデルや収益源（3-5項目）"),
    challengesOpportunities: z.array(z.string()).describe("主な課題と機会（4-6項目）"),
  });

  // 構造化出力パーサーを作成
  const parser = StructuredOutputParser.fromZodSchema(industryAnalysisSchema);
  
  // エラー修正機能付きパーサーを作成（JSONパース失敗を修正）
  return OutputFixingParser.fromParser(parser);
}

/**
 * キーワード拡張のための構造化出力パーサーを作成
 */
export function createKeywordExpansionParser() {
  // Zodスキーマを使用して出力形式を定義
  const keywordExpansionSchema = z.object({
    expandedKeywords: z.array(z.string()).describe("オリジナルのキーワードを含め、合計15-20個程度"),
    relevance: z.record(z.number().min(0).max(1)).describe("キーワードと関連度のマッピング（0.0-1.0）"),
  });

  // 構造化出力パーサーを作成
  const parser = StructuredOutputParser.fromZodSchema(keywordExpansionSchema);
  
  // エラー修正機能付きパーサーを作成
  return OutputFixingParser.fromParser(parser);
}

/**
 * 知識構造化のための構造化出力パーサーを作成
 */
export function createStructuringParser() {
  // Zodスキーマを使用して出力形式を定義
  const structuringSchema = z.object({
    centralConcept: z.string().describe("中心となるコンセプト/テーマ"),
    mainCategories: z.array(
      z.object({
        name: z.string().describe("メインカテゴリ名"),
        description: z.string().describe("カテゴリの説明"),
        subcategories: z.array(
          z.object({
            name: z.string().describe("サブカテゴリ名"),
            description: z.string().describe("サブカテゴリの説明"),
            skills: z.array(
              z.object({
                name: z.string().describe("スキル/知識項目名"),
                description: z.string().describe("スキル/知識の説明"),
              })
            ).describe("関連するスキルや知識（3-5項目）"),
          })
        ).describe("サブカテゴリ（2-4項目）"),
      })
    ).describe("メインカテゴリ（3-5項目）"),
  });

  // 構造化出力パーサーを作成
  const parser = StructuredOutputParser.fromZodSchema(structuringSchema);
  
  // エラー修正機能付きパーサーを作成
  return OutputFixingParser.fromParser(parser);
}

/**
 * 業界分析のためのプロンプトテンプレートを作成
 */
export function createIndustryAnalysisPrompt(parser: any) {
  return PromptTemplate.fromTemplate(`あなたは業界分析の専門家です。与えられたロールと業界について詳細な分析を行ってください。
結果はJSON形式で返してください。

このシステムは「情報収集サービス」です。ユーザーが日々の情報収集を効率的に行うために必要な知識構造を構築することが目的です。
分析は具体的で実用的であるべきです。特に情報収集の観点から重要な項目を強調してください。

以下のロール、業界、キーワードについて分析してください：

ロール名: {roleName}
ロール詳細: {roleDescription}
業界: {industries}
関連キーワード: {keywords}

分析結果には以下の項目を含めてください：

{format_instructions}

回答は日本語で提供し、短く具体的に記述してください。各項目は40-60文字程度に抑えてください。
日々の情報収集に役立つ具体的な観点を含めるよう心がけてください。`);
}

/**
 * キーワード拡張のためのプロンプトテンプレートを作成
 */
export function createKeywordExpansionPrompt(parser: any) {
  return PromptTemplate.fromTemplate(`あなたは情報収集のためのキーワード拡張スペシャリストです。
提供された役割、業界、初期キーワードに基づいて、関連するキーワードを拡張してください。
結果はJSON形式で返してください。

このシステムは「情報収集サービス」です。ユーザーが日々の情報収集を効率的に行うために必要なキーワードを提供することが目的です。
情報収集の観点から具体的で検索可能なキーワードが必要です。例えば、「Azure OpenAI Service」「Microsoft Power Platform」「React」のような具体的な製品名や技術名が望ましいです。

以下のロール、業界情報、ベースキーワードをもとに、情報収集に役立つキーワードを拡張してください：

ロール名: {roleName}
ロール詳細: {roleDescription}
業界: {industries}
ベースキーワード: {baseKeywords}

業界分析情報:
{industryContext}

この役割に重要と思われるキーワードを追加してください。本人の日々の情報収集や自己成長に役立つものを優先してください。
入力キーワードは最重要キーワードとして含めてください。

{format_instructions}

各キーワードには関連度スコア(0.0-1.0)を付けてください。
回答は日本語で提供し、キーワードは短く具体的に記述してください（各5-15文字程度）。
技術用語、ツール名、概念名など、具体的で検索可能なキーワードを含めてください。
最先端のトレンドやツールを含めることが重要です。`);
}

/**
 * 知識構造化のためのプロンプトテンプレートを作成
 */
export function createStructuringPrompt(parser: any) {
  return PromptTemplate.fromTemplate(`あなたは知識体系のアーキテクトです。
与えられた役割モデル、業界分析、キーワードから、階層的な知識構造を生成してください。
結果はJSON形式で返してください。

ロール: {roleName}
ロール詳細: {roleDescription}
業界: {industries}

業界分析:
{industryAnalysis}

キーワード:
{keywords}

この役割モデルに必要な知識・スキルを階層的に整理してください。
中心的なコンセプトを頂点として、複数のメインカテゴリに分類し、各カテゴリはサブカテゴリと具体的なスキルに展開します。

例えば「AIエンジニア」なら、以下のような構造：
- 中心：AIエンジニアリング
- カテゴリ：技術スキル、ドメイン知識、ソフトスキル
- サブカテゴリ：機械学習、自然言語処理、データエンジニアリング
- スキル：Python、TensorFlow、データ前処理、モデル評価

{format_instructions}

知識体系は以下の原則に従って構築してください：
1. 論理的な階層関係を維持すること
2. 抽象的な概念から具体的なスキルへと展開すること
3. 業界分析で得られた洞察を反映すること
4. キーワードを適切なカテゴリに配置すること
5. 網羅性と専門性のバランスを取ること`);
}