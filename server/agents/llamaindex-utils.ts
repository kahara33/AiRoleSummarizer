/**
 * LlamaIndex統合のためのユーティリティ
 * 知識グラフのインデックス化と検索のためのヘルパー関数
 */

import { Document } from "llamaindex";
import {
  VectorStoreIndex,
  SimpleDirectoryReader,
  serviceContextFromDefaults,
  OpenAIEmbedding,
} from "llamaindex/core";
import { IndustryAnalysisData } from "./industry-analysis";
import { KeywordExpansionData } from "./keyword-expansion";
import { StructuringData } from "./structuring";
import { KnowledgeGraphData } from "./types";

/**
 * Azure OpenAI埋め込みモデルを作成
 */
export function createAzureEmbeddingModel() {
  return new OpenAIEmbedding({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_KEY,
    azureOpenAIApiVersion: "2024-02-15-preview",
    azureOpenAIApiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    azureOpenAIApiInstanceName: "everys-openai",
  });
}

/**
 * ドキュメントからベクトルインデックスを作成
 */
export async function createVectorIndex(documents: Document[]) {
  // 埋め込みモデルの作成
  const embedModel = createAzureEmbeddingModel();
  
  // サービスコンテキストの設定
  const serviceContext = serviceContextFromDefaults({
    embedModel,
  });
  
  // ベクトルインデックスの作成
  return await VectorStoreIndex.fromDocuments(documents, {
    serviceContext,
  });
}

/**
 * 役割モデルデータをドキュメント化
 */
export function createRoleModelDocuments(
  roleModelId: string,
  roleName: string,
  roleDescription: string,
  industries: string[],
  industryData: IndustryAnalysisData | null,
  keywordData: KeywordExpansionData | null,
  structuringData: StructuringData | null
) {
  const documents: Document[] = [];
  
  // 基本情報ドキュメント
  documents.push(
    new Document({
      text: `役割モデル: ${roleName}\n説明: ${roleDescription || "説明なし"}\n業界: ${industries.join(", ") || "指定なし"}`,
      metadata: {
        type: "role_model_base",
        role_id: roleModelId,
        role_name: roleName,
      },
    })
  );
  
  // 業界分析データがある場合
  if (industryData) {
    documents.push(
      new Document({
        text: `業界洞察:\n${industryData.industryInsights.join("\n")}\n\n` +
              `ターゲット対象:\n${industryData.targetAudience.join("\n")}\n\n` +
              `主要トレンド:\n${industryData.keyTrends.join("\n")}\n\n` +
              `ビジネスモデル:\n${industryData.businessModels.join("\n")}\n\n` +
              `課題と機会:\n${industryData.challengesOpportunities.join("\n")}`,
        metadata: {
          type: "industry_analysis",
          role_id: roleModelId,
          role_name: roleName,
        },
      })
    );
  }
  
  // キーワードデータがある場合
  if (keywordData) {
    documents.push(
      new Document({
        text: `キーワード:\n${keywordData.expandedKeywords.map(
          (kw) => `${kw} (関連度: ${keywordData.relevance[kw] || 0})`
        ).join("\n")}`,
        metadata: {
          type: "keywords",
          role_id: roleModelId,
          role_name: roleName,
        },
      })
    );
  }
  
  // 構造化データがある場合
  if (structuringData) {
    documents.push(
      new Document({
        text: `中心概念: ${structuringData.centralConcept}\n\n` +
              `メインカテゴリ:\n${structuringData.mainCategories.map(
                (cat) => {
                  return `- ${cat.name}: ${cat.description}\n  サブカテゴリ:\n${
                    cat.subcategories.map(
                      (sub) => {
                        return `  - ${sub.name}: ${sub.description}\n    スキル:\n${
                          sub.skills.map(
                            (skill) => `    - ${skill.name}: ${skill.description}`
                          ).join("\n")
                        }`;
                      }
                    ).join("\n")
                  }`;
                }
              ).join("\n\n")}`,
        metadata: {
          type: "knowledge_structure",
          role_id: roleModelId,
          role_name: roleName,
        },
      })
    );
  }
  
  return documents;
}

/**
 * 知識グラフをドキュメント化
 */
export function createKnowledgeGraphDocuments(
  roleModelId: string,
  roleName: string,
  graphData: KnowledgeGraphData
) {
  // ノードとエッジの情報をドキュメント化
  return new Document({
    text: `知識グラフノード:\n${graphData.nodes.map(
      (node) => `- ${node.name} (タイプ: ${node.type}, レベル: ${node.level}): ${node.description || "説明なし"}`
    ).join("\n")}\n\n知識グラフエッジ:\n${graphData.edges.map(
      (edge) => {
        const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
        const targetNode = graphData.nodes.find((n) => n.id === edge.target);
        return `- ${sourceNode?.name || edge.source} -> ${targetNode?.name || edge.target} ${edge.label ? `(${edge.label})` : ""}`;
      }
    ).join("\n")}`,
    metadata: {
      type: "knowledge_graph",
      role_id: roleModelId,
      role_name: roleName,
    },
  });
}

/**
 * 検索クエリの実行
 */
export async function queryKnowledgeBase(index: any, query: string) {
  const queryEngine = index.asQueryEngine();
  return await queryEngine.query({
    query,
  });
}