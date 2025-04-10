/**
 * CrewAIエージェント定義
 * 役割モデル知識グラフ生成のための専門AIエージェント群
 */

import { Agent } from 'crewai-js';
import { ChatOpenAI } from '@langchain/openai';
import { RoleModelInput } from '../../agents/types';
import { Tool } from '@langchain/core/tools';
import { industryAnalysisTools } from './tools';

// crewai-jsのAgentOptionsがエクスポートされていないため、インターフェースを定義
// nameは必須なので、?を削除
interface AgentOptions {
  name: string;
  role: string;
  goal: string;
  backstory: string;
  verbose?: boolean;
  allowDelegation?: boolean;
  memory?: boolean;
  tools?: any[];
  llm: any;
}

// Azure OpenAIモデル設定
const getAzureOpenAIModel = () => {
  console.log('Azure OpenAI設定情報のロード...');
  // 環境変数のチェック
  if (!process.env.AZURE_OPENAI_API_KEY) {
    console.error('AZURE_OPENAI_API_KEYが設定されていません');
  }
  
  try {
    // @langchain/openaiのChatOpenAIは以下のパラメータを受け付けるように変更
    return new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7,
      openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    });
  } catch (error) {
    console.error('Azure OpenAIモデルの初期化に失敗しました:', error);
    throw error;
  }
};

/**
 * 業界分析エージェント
 * 特定の役割に関連する業界の洞察と情報を分析
 */
export const createIndustryAnalysisAgent = (input: RoleModelInput) => {
  const model = getAzureOpenAIModel();
  
  const agentConfig: AgentOptions = {
    name: 'ドメインアナリスト',
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
    name: 'キーワードエキスパート',
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
    name: '構造化エキスパート',
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
    name: 'コンテキストマッパー',
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