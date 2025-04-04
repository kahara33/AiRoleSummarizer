/**
 * CrewAIを使用したマルチエージェントシステム
 * 役割モデル知識グラフ生成のためのエージェントチーム
 */

import { Crew, CrewOptions, Process } from 'crewai-js';
import { RoleModelInput } from '../../agents/types';
import { sendAgentThoughts, sendProgressUpdate } from '../../websocket';
import { KnowledgeGraphData } from '../../agents/types';
import { 
  createIndustryAnalysisAgent, 
  createKeywordExpansionAgent,
  createStructuringAgent,
  createKnowledgeGraphAgent
} from './agents';
import {
  createIndustryAnalysisTask,
  createKeywordExpansionTask,
  createStructuringTask,
  createKnowledgeGraphTask
} from './tasks';

// クルーからの出力を処理するヘルパー関数
const handleAgentOutput = async (
  userId: string,
  roleModelId: string,
  agentName: string,
  output: string
) => {
  // ログに出力
  console.log(`[${agentName}] 出力:`, output);
  
  // WebSocket経由でクライアントに送信
  await sendAgentThoughts(userId, roleModelId, agentName, output);
};

/**
 * 知識グラフ生成クルー
 * 複数のAIエージェントが協力して役割モデルの知識グラフを構築
 */
export const createKnowledgeGraphCrew = async (input: RoleModelInput): Promise<KnowledgeGraphData> => {
  // ユーザーIDとロールモデルIDが必要
  if (!input.userId || !input.roleModelId) {
    throw new Error('ユーザーIDとロールモデルIDが必要です');
  }

  // 進捗開始通知
  await sendProgressUpdate(
    input.userId,
    input.roleModelId,
    'マルチエージェント処理',
    5,
    { stage: '初期化中' }
  );
  
  await sendAgentThoughts(
    input.userId,
    input.roleModelId,
    'オーケストレーター',
    `役割モデル「${input.roleName}」の知識グラフ生成を開始します。\n\n` +
    `4つの専門AIエージェントが連携して知識グラフを生成します：\n` +
    `1. 業界分析エージェント\n` +
    `2. キーワード拡張エージェント\n` +
    `3. 構造化エージェント\n` +
    `4. 知識グラフエージェント`
  );

  try {
    // エージェントの作成
    const industryAnalysisAgent = createIndustryAnalysisAgent(input);
    const keywordExpansionAgent = createKeywordExpansionAgent(input);
    const structuringAgent = createStructuringAgent(input);
    const knowledgeGraphAgent = createKnowledgeGraphAgent(input);
    
    // 進捗通知
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      10,
      { stage: 'エージェント初期化完了' }
    );

    // 業界分析タスクを実行
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      '業界分析エージェントに業界分析タスクを割り当てています...'
    );
    
    const industryAnalysisTask = createIndustryAnalysisTask(input, industryAnalysisAgent);
    
    // 業界分析を別途実行（最初のタスク）
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      20,
      { stage: '業界分析中' }
    );
    
    // タスク実行前に通知
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      '業界分析エージェント',
      `「${input.roleName}」に関連する業界分析を開始します。\n` +
      `対象業界: ${input.industries.join(', ') || '指定なし'}`
    );
    
    // 業界分析タスクの実行
    const industryAnalysisResult = await industryAnalysisTask.execute();
    
    // 結果を処理してWebSocketで送信
    await handleAgentOutput(
      input.userId,
      input.roleModelId,
      '業界分析エージェント',
      `業界分析が完了しました。\n\n分析結果の概要:\n${industryAnalysisResult.substring(0, 300)}...`
    );
    
    // キーワード拡張タスクを実行
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      40,
      { stage: 'キーワード拡張中' }
    );
    
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      'キーワード拡張エージェントにキーワード拡張タスクを割り当てています...'
    );
    
    const keywordExpansionTask = createKeywordExpansionTask(
      input, 
      keywordExpansionAgent,
      industryAnalysisResult
    );
    
    // タスク実行前に通知
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'キーワード拡張エージェント',
      `「${input.roleName}」に関連するキーワード拡張を開始します。\n` +
      `初期キーワード: ${input.keywords.join(', ') || '指定なし'}`
    );
    
    // キーワード拡張タスクの実行
    const keywordExpansionResult = await keywordExpansionTask.execute();
    
    // 結果を処理してWebSocketで送信
    await handleAgentOutput(
      input.userId,
      input.roleModelId,
      'キーワード拡張エージェント',
      `キーワード拡張が完了しました。\n\n拡張結果の概要:\n${keywordExpansionResult.substring(0, 300)}...`
    );
    
    // 構造化タスクを実行
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      60,
      { stage: '知識構造化中' }
    );
    
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      '構造化エージェントに知識構造化タスクを割り当てています...'
    );
    
    const structuringTask = createStructuringTask(
      input,
      structuringAgent,
      industryAnalysisResult,
      keywordExpansionResult
    );
    
    // タスク実行前に通知
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      '構造化エージェント',
      `「${input.roleName}」に関連する知識の階層構造設計を開始します。\n` +
      `業界分析とキーワード拡張の結果を活用します。`
    );
    
    // 構造化タスクの実行
    const structuringResult = await structuringTask.execute();
    
    // 結果を処理してWebSocketで送信
    await handleAgentOutput(
      input.userId,
      input.roleModelId,
      '構造化エージェント',
      `知識構造化が完了しました。\n\n構造化結果の概要:\n${structuringResult.substring(0, 300)}...`
    );
    
    // 知識グラフ生成タスクを実行
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      80,
      { stage: '知識グラフ生成中' }
    );
    
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      '知識グラフエージェントにグラフ生成タスクを割り当てています...'
    );
    
    const knowledgeGraphTask = createKnowledgeGraphTask(
      input,
      knowledgeGraphAgent,
      structuringResult
    );
    
    // タスク実行前に通知
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      '知識グラフエージェント',
      `「${input.roleName}」の知識グラフ生成を開始します。\n` +
      `階層構造データをベースにノードとエッジを設計します。`
    );
    
    // 知識グラフタスクの実行
    const knowledgeGraphResult = await knowledgeGraphTask.execute();
    
    // 結果を処理してWebSocketで送信
    await handleAgentOutput(
      input.userId,
      input.roleModelId,
      '知識グラフエージェント',
      `知識グラフ生成が完了しました。\n\n生成結果の概要:\n${knowledgeGraphResult.substring(0, 300)}...`
    );
    
    // 最終結果の通知
    await sendProgressUpdate(
      input.userId,
      input.roleModelId,
      'マルチエージェント処理',
      100,
      { stage: '処理完了' }
    );
    
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      `役割モデル「${input.roleName}」の知識グラフ生成が完了しました。\n\n` +
      `すべてのエージェントタスクが正常に実行されました。\n` +
      `・業界分析: 完了\n` +
      `・キーワード拡張: 完了\n` +
      `・知識構造化: 完了\n` +
      `・知識グラフ生成: 完了\n\n` +
      `生成された知識グラフをデータベースに保存しています...`
    );
    
    // JSON結果をパースして返す
    try {
      // JSON部分を抽出
      const jsonMatch = knowledgeGraphResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const graphData = JSON.parse(jsonMatch[0]) as KnowledgeGraphData;
        return graphData;
      }
      
      // 直接パース
      return JSON.parse(knowledgeGraphResult) as KnowledgeGraphData;
    } catch (error) {
      console.error('知識グラフ結果のJSONパースエラー:', error);
      throw new Error('知識グラフデータの解析に失敗しました');
    }
  } catch (error) {
    console.error('マルチエージェントシステムエラー:', error);
    
    // エラー通知
    await sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'オーケストレーター',
      `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}\n` +
      `処理を中断します。`
    );
    
    throw error;
  }
};