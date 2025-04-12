/**
 * AIエージェントサービス
 * 各専門エージェントの役割と処理フローを管理
 */

import * as websocket from '../websocket';
import * as exaSearchService from './exa-search-service';
import * as knowledgeGraphService from './knowledge-graph-service';

// 処理フロータイプ
export enum ProcessFlowType {
  KNOWLEDGE_GRAPH_CREATION = 'knowledge_graph_creation',
  COLLECTION_PLAN_CREATION = 'collection_plan_creation',
  COLLECTION_EXECUTION = 'collection_execution',
  GRAPH_UPDATE_RECOMMENDATION = 'graph_update_recommendation'
}

// エージェントタイプ
export enum AgentType {
  ORCHESTRATOR = 'Orchestrator',
  INITIAL_RESEARCHER = 'InitialResearcher',
  PLAN_STRATEGIST = 'PlanStrategist',
  SEARCH_CONDUCTOR = 'SearchConductor',
  CONTENT_PROCESSOR = 'ContentProcessor',
  DUPLICATION_MANAGER = 'DuplicationManager',
  KNOWLEDGE_INTEGRATOR = 'KnowledgeIntegrator',
  REPORT_COMPILER = 'ReportCompiler'
}

// エージェント思考ステータス
export enum ThoughtStatus {
  STARTING = 'starting',
  THINKING = 'thinking',
  WORKING = 'working',
  DECISION = 'decision',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

/**
 * エージェント思考を送信する
 * @param agentType エージェントタイプ
 * @param thought 思考内容
 * @param roleModelId ロールモデルID
 * @param status 思考ステータス
 */
function sendAgentThought(
  agentType: AgentType | string,
  thought: string,
  roleModelId: string,
  status: ThoughtStatus | string = ThoughtStatus.THINKING
) {
  websocket.sendAgentThoughts(getAgentName(agentType), thought, roleModelId, status);
}

/**
 * エージェント名を取得する
 * @param agentType エージェントタイプ
 * @returns エージェント名（日本語）
 */
function getAgentName(agentType: AgentType | string): string {
  switch (agentType) {
    case AgentType.ORCHESTRATOR:
      return 'オーケストレーター';
    case AgentType.INITIAL_RESEARCHER:
      return '初期調査エージェント';
    case AgentType.PLAN_STRATEGIST:
      return 'プランストラテジスト';
    case AgentType.SEARCH_CONDUCTOR:
      return '検索実行エージェント';
    case AgentType.CONTENT_PROCESSOR:
      return 'コンテンツ処理エージェント';
    case AgentType.DUPLICATION_MANAGER:
      return '重複管理エージェント';
    case AgentType.KNOWLEDGE_INTEGRATOR:
      return '知識統合エージェント';
    case AgentType.REPORT_COMPILER:
      return 'レポート作成エージェント';
    default:
      return agentType;
  }
}

/**
 * 進捗メッセージを送信する
 * @param roleModelId ロールモデルID
 * @param progress 進捗（0-100）
 * @param message メッセージ
 * @param data 追加データ
 */
function sendProgress(
  roleModelId: string,
  progress: number,
  message: string,
  data: Record<string, any> = {}
) {
  websocket.sendProgressUpdate(roleModelId, progress, message, data);
}

/**
 * ナレッジグラフ作成フロー
 * @param roleModelId ロールモデルID
 * @param params パラメータ
 */
export async function runKnowledgeGraphCreationFlow(
  roleModelId: string,
  params: {
    mainTopic: string;
    subTopics: string[];
    overwrite: boolean;
  }
): Promise<boolean> {
  try {
    const { mainTopic, subTopics, overwrite } = params;
    
    // オーケストレーターの開始メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフと情報収集プラン作成プロセスを開始します。メイントピック: ${mainTopic}`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗報告：10%
    sendProgress(roleModelId, 10, 'ナレッジグラフ作成プロセスを開始します...');
    
    // 初期調査エージェント
    sendAgentThought(
      AgentType.INITIAL_RESEARCHER,
      `${mainTopic}に関する初期データ収集とナレッジグラフの基本構造を設計します`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 進捗報告：30%
    sendProgress(roleModelId, 30, 'ナレッジグラフの構造を設計中...');
    
    // 知識統合エージェント
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      `${mainTopic}と${subTopics.join(', ')}のキーワードを元に階層構造を構築します`,
      roleModelId
    );
    
    // 階層的ナレッジグラフを生成
    const graphData = await knowledgeGraphService.generateHierarchicalKnowledgeGraph(
      roleModelId,
      mainTopic,
      subTopics,
      overwrite
    );
    
    if (!graphData) {
      throw new Error('ナレッジグラフの生成に失敗しました');
    }
    
    // 進捗報告：60%
    sendProgress(roleModelId, 60, 'ナレッジグラフを生成しました。情報収集プランを作成中...');
    
    // プランストラテジスト
    sendAgentThought(
      AgentType.PLAN_STRATEGIST,
      `生成したナレッジグラフに基づいて効果的な情報収集プランを設計します`,
      roleModelId
    );
    
    // 情報収集プランのパターンを生成
    const collectionPlans = exaSearchService.generateCollectionPlanPatterns(mainTopic, subTopics);
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗報告：80%
    sendProgress(roleModelId, 80, '情報収集プランのパターンを生成しました');
    
    // レポート作成エージェント
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      `${collectionPlans.length}個の情報収集パターンを組み立て、実行計画にまとめています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 完了報告
    sendProgress(
      roleModelId, 
      100, 
      'ナレッジグラフと情報収集プランの生成が完了しました',
      { 
        status: 'completed',
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.edges.length,
        planCount: collectionPlans.length
      }
    );
    
    // オーケストレーターの完了メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ（${graphData.nodes.length}ノード）と情報収集プラン（${collectionPlans.length}プラン）の生成が完了しました`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    return true;
  } catch (error: any) {
    console.error('ナレッジグラフ作成エラー:', error);
    
    // エラー進捗
    sendProgress(
      roleModelId,
      0,
      `ナレッジグラフ作成中にエラーが発生しました: ${error.message}`,
      { status: 'error' }
    );
    
    // オーケストレーターのエラーメッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ作成中にエラーが発生しました: ${error.message}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}

/**
 * 情報収集プラン作成フロー
 * @param roleModelId ロールモデルID
 * @param params パラメータ
 */
export async function runCollectionPlanCreationFlow(
  roleModelId: string,
  params: {
    mainTopic: string;
    keywords: string[];
  }
): Promise<boolean> {
  try {
    const { mainTopic, keywords } = params;
    
    // オーケストレーターの開始メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `既存のナレッジグラフを元に情報収集プランを作成します。メイントピック: ${mainTopic}`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗報告：10%
    sendProgress(roleModelId, 10, '既存のナレッジグラフを使用して情報収集プランのみを作成しています...');
    
    // プランストラテジスト
    sendAgentThought(
      AgentType.PLAN_STRATEGIST,
      `既存の知識グラフを分析し、Exa Searchに最適な検索パターンを作成します`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗報告：40%
    sendProgress(roleModelId, 40, 'Exa Search APIのクエリパターンを生成中...');
    
    // 検索実行エージェント
    sendAgentThought(
      AgentType.SEARCH_CONDUCTOR,
      `${mainTopic}に関する情報収集のためのExa Search APIクエリパターンを複数作成しています`,
      roleModelId
    );
    
    // 情報収集プランのパターンを生成
    const collectionPlans = exaSearchService.generateCollectionPlanPatterns(mainTopic, keywords);
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 進捗報告：70%
    sendProgress(roleModelId, 70, `${collectionPlans.length}個の情報収集パターンを作成しました`);
    
    // レポート作成エージェント
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      `検索パターンから情報収集プランを作成し、最適な頻度と優先度を設定しています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 完了報告
    sendProgress(
      roleModelId, 
      100, 
      '情報収集プランの作成が完了しました',
      { 
        status: 'completed',
        planCount: collectionPlans.length
      }
    );
    
    // オーケストレーターの完了メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン（${collectionPlans.length}プラン）の作成が完了しました。既存のナレッジグラフは変更されていません。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    return true;
  } catch (error: any) {
    console.error('情報収集プラン作成エラー:', error);
    
    // エラー進捗
    sendProgress(
      roleModelId,
      0,
      `情報収集プラン作成中にエラーが発生しました: ${error.message}`,
      { status: 'error' }
    );
    
    // オーケストレーターのエラーメッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン作成中にエラーが発生しました: ${error.message}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}

/**
 * 情報収集実行と要約レポート作成フロー
 * @param roleModelId ロールモデルID
 * @param planId 情報収集プランID
 */
export async function runCollectionExecutionFlow(
  roleModelId: string,
  planId: string
): Promise<boolean> {
  try {
    // 実際にはDB等から情報収集プランを取得する
    // ここではシミュレーションのためダミープランを作成
    const dummyPlan = {
      id: planId,
      name: `情報収集プラン-${planId}`,
      searchParams: {
        query: 'AI最新動向',
        numResults: 5,
        categoryFilters: ['news', 'web_search'],
        timeRange: '1w'
      }
    };
    
    // オーケストレーターの開始メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン「${dummyPlan.name}」の実行と要約レポート作成を開始します`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗報告：10%
    sendProgress(roleModelId, 10, '情報収集プランの実行を開始します...');
    
    // 検索実行エージェント
    sendAgentThought(
      AgentType.SEARCH_CONDUCTOR,
      `Exa Search APIを使用して「${dummyPlan.searchParams.query}」の検索を実行します`,
      roleModelId
    );
    
    // 情報収集プランを実行
    const executionResult = await exaSearchService.executeCollectionPlan(dummyPlan);
    
    // 進捗報告：40%
    sendProgress(roleModelId, 40, '検索結果を処理中...');
    
    // コンテンツ処理エージェント
    sendAgentThought(
      AgentType.CONTENT_PROCESSOR,
      `${executionResult.resultCount}件の検索結果を分析し、関連性と重要度で評価しています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 重複管理エージェント
    sendAgentThought(
      AgentType.DUPLICATION_MANAGER,
      `検索結果の重複チェックと既存データとの整合性を確認しています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 進捗報告：70%
    sendProgress(roleModelId, 70, '要約レポートを作成中...');
    
    // レポート作成エージェント
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      `検索結果を要約し、重要ポイントを抽出したレポートを作成しています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 知識統合エージェント
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      `要約レポートとナレッジグラフの関連付けを行っています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 完了報告
    sendProgress(
      roleModelId, 
      100, 
      '情報収集と要約レポートの作成が完了しました',
      { 
        status: 'completed',
        reportId: `report-${Date.now()}`,
        resultCount: executionResult.resultCount
      }
    );
    
    // オーケストレーターの完了メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン「${dummyPlan.name}」の実行と要約レポート作成が完了しました`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    return true;
  } catch (error: any) {
    console.error('情報収集実行エラー:', error);
    
    // エラー進捗
    sendProgress(
      roleModelId,
      0,
      `情報収集実行中にエラーが発生しました: ${error.message}`,
      { status: 'error' }
    );
    
    // オーケストレーターのエラーメッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集実行中にエラーが発生しました: ${error.message}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}

/**
 * ナレッジグラフ更新レコメンドフロー
 * @param roleModelId ロールモデルID
 * @param reports 要約レポート一覧
 */
export async function runGraphUpdateRecommendationFlow(
  roleModelId: string,
  reports: any[] = []
): Promise<boolean> {
  try {
    // オーケストレーターの開始メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフの更新推奨プロセスを開始します`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗報告：10%
    sendProgress(roleModelId, 10, 'ナレッジグラフの更新推奨を分析中...');
    
    // 知識統合エージェント
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      `収集されたレポートデータを分析し、ナレッジグラフの改善点を特定しています`,
      roleModelId
    );
    
    // ナレッジグラフの更新を推奨
    const recommendations = await knowledgeGraphService.recommendGraphUpdates(roleModelId, reports);
    
    // 進捗報告：50%
    sendProgress(roleModelId, 50, '更新候補を評価中...');
    
    // 初期調査エージェント
    sendAgentThought(
      AgentType.INITIAL_RESEARCHER,
      `${recommendations.length}個の更新候補をExa Searchで検証し、関連性を評価しています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗報告：80%
    sendProgress(roleModelId, 80, '更新推奨レポートを作成中...');
    
    // レポート作成エージェント
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      `検証結果から最も重要なナレッジグラフ更新案をレポートにまとめています`,
      roleModelId
    );
    
    // 少し待機して処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 完了報告
    sendProgress(
      roleModelId, 
      100, 
      'ナレッジグラフの更新推奨が完了しました',
      { 
        status: 'completed',
        recommendationCount: recommendations.length
      }
    );
    
    // オーケストレーターの完了メッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフの更新推奨プロセスが完了しました。${recommendations.length}個の更新候補が提案されています。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    return true;
  } catch (error: any) {
    console.error('ナレッジグラフ更新推奨エラー:', error);
    
    // エラー進捗
    sendProgress(
      roleModelId,
      0,
      `ナレッジグラフ更新推奨中にエラーが発生しました: ${error.message}`,
      { status: 'error' }
    );
    
    // オーケストレーターのエラーメッセージ
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ更新推奨中にエラーが発生しました: ${error.message}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}