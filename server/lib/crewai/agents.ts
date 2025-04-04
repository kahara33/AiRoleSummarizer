/**
 * CrewAIエージェント定義
 * 役割モデル知識グラフ生成のための専門AIエージェント群
 */

import { Agent, AgentOptions } from 'crewai-js';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RoleModelInput } from '../../agents/types';
import { Tool } from 'langchain/tools';
import { industryAnalysisTools } from './tools';

// Azure OpenAIモデル設定
const getAzureOpenAIModel = () => {
  return new ChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_KEY,
    azureOpenAIApiVersion: '2024-02-15-preview',
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT!,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_ENDPOINT?.replace('https://', '').replace('.openai.azure.com', ''),
    temperature: 0.7,
  });
};

/**
 * 業界分析エージェント
 * 特定の役割に関連する業界の洞察と情報を分析
 */
export const createIndustryAnalysisAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    role: '業界分析エキスパート',
    goal: `${input.roleName}に関連する業界の洞察を深く分析する`,
    backstory: '業界分析のスペシャリストとして、様々な産業の動向を追跡し、重要なトレンドや機会を特定します。',
    verbose: true,
    allowDelegation: false,
    memory: true,
    tools: industryAnalysisTools as unknown as Tool[],
    llm: model as any,
  };

  return new Agent(agentConfig);
};

/**
 * キーワード拡張エージェント
 * 関連キーワードを識別して拡張
 */
export const createKeywordExpansionAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    role: 'キーワード拡張スペシャリスト',
    goal: `${input.roleName}に必要な情報収集のための関連キーワードを特定する`,
    backstory: 'キーワードとタグの専門家として、様々な分野の専門用語や検索キーワードに精通しています。',
    verbose: true,
    allowDelegation: false,
    memory: true,
    llm: model as any,
  };

  return new Agent(agentConfig);
};

/**
 * 構造化エージェント
 * 情報を階層的に整理
 */
export const createStructuringAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    role: '情報構造化スペシャリスト',
    goal: `${input.roleName}の知識を階層的に整理する`,
    backstory: '情報アーキテクトとして、複雑な情報を論理的で理解しやすい構造に整理することを専門としています。',
    verbose: true,
    allowDelegation: false,
    memory: true,
    llm: model as any,
  };

  return new Agent(agentConfig);
};

/**
 * 知識グラフエージェント
 * 最終的なナレッジグラフを生成
 */
export const createKnowledgeGraphAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    role: '知識グラフ設計者',
    goal: `${input.roleName}のための包括的な知識グラフを構築する`,
    backstory: '知識表現の専門家として、複雑な情報を視覚的かつ関連性のあるグラフ構造に変換します。',
    verbose: true,
    allowDelegation: false,
    memory: true,
    llm: model as any,
  };

  return new Agent(agentConfig);
};

/**
 * オーケストレーターエージェント
 * チーム全体を調整
 */
export const createOrchestratorAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    role: 'AIオーケストレーター',
    goal: '役割モデルの効果的な知識グラフ生成プロセスを管理調整する',
    backstory: 'チームリーダーとして、複数のAIエージェントの作業を調整し、統合された成果物を生み出します。',
    verbose: true,
    allowDelegation: true,
    memory: true,
    llm: model as any,
  };

  return new Agent(agentConfig);
};