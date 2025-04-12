/**
 * AIエージェントサービス
 * 各専門エージェントの役割と処理フローを管理
 */

import * as websocket from '../websocket';
import * as knowledgeGraphService from './knowledge-graph-service';
import * as exaSearchService from './exa-search-service';
import * as graphService from './graph-service-adapter';

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

// 思考ステータス
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
  status: ThoughtStatus | string
) {
  websocket.sendAgentThoughts(
    getAgentName(agentType),
    thought,
    roleModelId,
    status
  );
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
      return agentType.toString();
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
  data?: Record<string, any>
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
    overwrite?: boolean;
  }
): Promise<boolean> {
  try {
    console.log(`ナレッジグラフ作成フロー開始: ${roleModelId}`, params);
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      'ナレッジグラフと情報収集プランの生成プロセスを開始します',
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      10,
      'ナレッジグラフの構造を分析中...'
    );
    
    // 初期調査エージェントの思考
    sendAgentThought(
      AgentType.INITIAL_RESEARCHER,
      `${params.mainTopic}に関する初期データ収集を開始します。キーワード: ${params.subTopics.join(', ')}`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      30,
      'ナレッジグラフの構造を生成しています...'
    );
    
    // 知識統合エージェントの思考
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      `${params.mainTopic}に関するエンティティ間の関係を分析し、ナレッジグラフの構造を決定します`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // ナレッジグラフの生成
    const graphData = await knowledgeGraphService.generateHierarchicalKnowledgeGraph(
      roleModelId,
      params.mainTopic,
      params.subTopics,
      params.overwrite
    );
    
    if (!graphData) {
      throw new Error('ナレッジグラフの生成に失敗しました');
    }
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      60,
      'ナレッジグラフを生成しました。情報収集プランを作成しています...'
    );
    
    // プランストラテジストの思考
    sendAgentThought(
      AgentType.PLAN_STRATEGIST,
      `生成したナレッジグラフに基づいて最適な情報収集戦略を構築しています`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 情報収集プランのパターンを生成
    const collectionPatterns = exaSearchService.generateCollectionPlanPatterns(
      params.mainTopic,
      params.subTopics
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      90,
      '情報収集プランを最終化しています...'
    );
    
    // レポート作成エージェントの思考
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      '生成したナレッジグラフと情報収集プランをまとめています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ（${graphData.nodes.length}ノード, ${graphData.edges.length}エッジ）と情報収集プラン（${collectionPatterns.length}パターン）の生成が完了しました`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      100,
      'ナレッジグラフと情報収集プランの生成が完了しました',
      { status: 'completed' }
    );
    
    return true;
  } catch (err: any) {
    const error = err as Error;
    console.error('ナレッジグラフ作成フロー実行エラー:', error);
    
    // エラー進捗更新
    sendProgress(
      roleModelId,
      0,
      'ナレッジグラフ作成中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    // オーケストレーターのエラー思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ作成中にエラーが発生しました: ${error.message || '不明なエラー'}`,
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
    console.log(`情報収集プラン作成フロー開始: ${roleModelId}`, params);
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      '既存のナレッジグラフに基づいて情報収集プランを作成します（グラフは更新しません）',
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      10,
      '既存のナレッジグラフを使用して情報収集プランのみを作成しています...'
    );
    
    // プランストラテジストの思考
    sendAgentThought(
      AgentType.PLAN_STRATEGIST,
      '既存の知識グラフを活用して最適な情報収集プランを作成します',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 既存のグラフを取得して分析
    const existingGraph = await graphService.getKnowledgeGraph(roleModelId);
    
    if (!existingGraph || existingGraph.nodes.length === 0) {
      sendAgentThought(
        AgentType.PLAN_STRATEGIST,
        '既存のナレッジグラフが見つかりません。新しく作成することをお勧めします',
        roleModelId,
        ThoughtStatus.DECISION
      );
      
      // エラー進捗更新
      sendProgress(
        roleModelId,
        50,
        '既存のナレッジグラフが見つかりません。新しいグラフを作成してください',
        { 
          status: 'warning',
          needsNewGraph: true
        }
      );
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      sendAgentThought(
        AgentType.ORCHESTRATOR,
        '既存のナレッジグラフが見つからないため、新しいプラン生成を中断します',
        roleModelId,
        ThoughtStatus.ERROR
      );
      
      return false;
    }
    
    // 情報収集プランのパターンを生成
    const collectionPatterns = exaSearchService.generateCollectionPlanPatterns(
      params.mainTopic,
      params.keywords
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      50,
      '情報収集プランを生成中...'
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // レポート作成エージェントの思考
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      '情報収集計画をレポート形式にまとめています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン（${collectionPatterns.length}パターン）の生成が完了しました。既存のナレッジグラフは変更されていません。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      100,
      '情報収集プランの作成が完了しました',
      { status: 'completed' }
    );
    
    return true;
  } catch (err: any) {
    const error = err as Error;
    console.error('情報収集プラン作成フロー実行エラー:', error);
    
    // エラー進捗更新
    sendProgress(
      roleModelId,
      0,
      '情報収集プラン作成中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    // オーケストレーターのエラー思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン作成中にエラーが発生しました: ${error.message || '不明なエラー'}`,
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
    console.log(`情報収集実行フロー開始: ${roleModelId}, プランID: ${planId}`);
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン「${planId}」の実行と要約レポート作成を開始します`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      10,
      '情報源の検索を開始しています...'
    );
    
    // 検索実行エージェントの思考
    sendAgentThought(
      AgentType.SEARCH_CONDUCTOR,
      `情報収集プラン「${planId}」に基づいて検索クエリを作成し、情報源を特定します`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 情報収集プランを取得（実際はシミュレーション）
    const plan = {
      id: planId,
      name: `${planId}プラン`,
      queries: ['最新動向', '市場分析', '技術革新']
    };
    
    // 検索実行（シミュレーション）
    sendAgentThought(
      AgentType.SEARCH_CONDUCTOR,
      `複数の検索クエリを実行中: ${plan.queries.join(', ')}`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      30,
      '検索結果を処理しています...'
    );
    
    // コンテンツ処理エージェントの思考
    sendAgentThought(
      AgentType.CONTENT_PROCESSOR,
      '検索結果から価値のある情報を抽出し、構造化しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 重複管理エージェントの思考
    sendAgentThought(
      AgentType.DUPLICATION_MANAGER,
      '情報の重複を検出し、一意で価値のある洞察を特定しています',
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      60,
      '収集した情報を要約しています...'
    );
    
    // レポート作成エージェントの思考
    sendAgentThought(
      AgentType.REPORT_COMPILER,
      '収集した情報から要約レポートを作成しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 知識統合エージェントの思考
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      'レポート内容とナレッジグラフの関連性を分析しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      90,
      '要約レポートを完成させています...'
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集プラン「${planId}」の実行と要約レポート作成が完了しました`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      100,
      '情報収集と要約レポート作成が完了しました',
      { status: 'completed' }
    );
    
    return true;
  } catch (err: any) {
    const error = err as Error;
    console.error('情報収集実行フロー実行エラー:', error);
    
    // エラー進捗更新
    sendProgress(
      roleModelId,
      0,
      '情報収集実行中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    // オーケストレーターのエラー思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `情報収集実行中にエラーが発生しました: ${error.message || '不明なエラー'}`,
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
  reports: any[]
): Promise<boolean> {
  try {
    console.log(`ナレッジグラフ更新レコメンドフロー開始: ${roleModelId}, レポート数: ${reports.length}`);
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `${reports.length}件のレポートに基づいてナレッジグラフの更新レコメンドを作成します`,
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      10,
      'レポートを分析しています...'
    );
    
    // コンテンツ処理エージェントの思考
    sendAgentThought(
      AgentType.CONTENT_PROCESSOR,
      'レポートから重要なキーワードと概念を抽出しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      30,
      '既存のナレッジグラフと比較しています...'
    );
    
    // 知識統合エージェントの思考
    sendAgentThought(
      AgentType.KNOWLEDGE_INTEGRATOR,
      '既存のナレッジグラフと新しい情報の関連性を分析しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // グラフ更新レコメンデーションを生成
    const recommendations = await knowledgeGraphService.recommendGraphUpdates(roleModelId, reports);
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      60,
      '更新レコメンデーションを作成しています...'
    );
    
    // プランストラテジストの思考
    sendAgentThought(
      AgentType.PLAN_STRATEGIST,
      'ナレッジグラフの最適な拡張と更新戦略を策定しています',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      90,
      '更新レコメンデーションを最終化しています...'
    );
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ更新レコメンド（${recommendations.length}項目）の作成が完了しました`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      100,
      'ナレッジグラフ更新レコメンデーションの作成が完了しました',
      { 
        status: 'completed',
        recommendations
      }
    );
    
    return true;
  } catch (err: any) {
    const error = err as Error;
    console.error('ナレッジグラフ更新レコメンドフロー実行エラー:', error);
    
    // エラー進捗更新
    sendProgress(
      roleModelId,
      0,
      'ナレッジグラフ更新レコメンド中にエラーが発生しました',
      { 
        status: 'error',
        error: error.message || '不明なエラー'
      }
    );
    
    // オーケストレーターのエラー思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ更新レコメンド中にエラーが発生しました: ${error.message || '不明なエラー'}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}