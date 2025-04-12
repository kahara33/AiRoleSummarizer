/**
 * AIエージェントサービス
 * 各専門エージェントの役割と処理フローを管理
 */

import * as websocket from '../websocket';
import { SearchCategory } from './exa-search-service';
import * as knowledgeGraphService from './knowledge-graph-service';
import * as exaSearchService from './exa-search-service';
import * as graphService from './graph-service-adapter';

// 処理フロータイプ
export enum ProcessFlowType {
  KNOWLEDGE_GRAPH_CREATION = 'knowledge_graph_creation',
  COLLECTION_PLAN_CREATION = 'collection_plan_creation',
  COLLECTION_EXECUTION = 'collection_execution',
  GRAPH_UPDATE_RECOMMENDATION = 'graph_update_recommendation',
  USER_INTERVIEW = 'user_interview',
  SAMPLE_SUMMARY_GENERATION = 'sample_summary_generation',
  USER_FEEDBACK_COLLECTION = 'user_feedback_collection'
}

// エージェントタイプ（新構成）
export enum AgentType {
  // 共通エージェント
  ORCHESTRATOR = 'Orchestrator',
  
  // グラフ作成と情報収集プラン作成関連
  GRAPH_BUILDER = 'GraphBuilder',         // グラフ構築エージェント
  INFORMATION_EXPLORER = 'InfoExplorer',  // 情報探索エージェント
  CONTENT_EVALUATOR = 'ContentEvaluator', // コンテンツ評価エージェント
  SAMPLE_SUMMARIZER = 'SampleSummarizer', // サンプル要約エージェント
  INTERVIEWER = 'Interviewer',            // ヒアリングエージェント
  PLAN_DESIGNER = 'PlanDesigner',         // プラン設計エージェント
  
  // 情報収集実行と要約関連（従来のエージェント）
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
    // 共通エージェント
    case AgentType.ORCHESTRATOR:
      return 'オーケストレーター';
    
    // 新エージェント（グラフ作成と情報収集プラン作成関連）
    case AgentType.GRAPH_BUILDER:
      return 'グラフ構築エージェント';
    case AgentType.INFORMATION_EXPLORER:
      return '情報探索エージェント';
    case AgentType.CONTENT_EVALUATOR:
      return 'コンテンツ評価エージェント';
    case AgentType.SAMPLE_SUMMARIZER:
      return 'サンプル要約エージェント';
    case AgentType.INTERVIEWER:
      return 'ヒアリングエージェント';
    case AgentType.PLAN_DESIGNER:
      return 'プラン設計エージェント';
    
    // 情報収集実行と要約関連（従来のエージェント）
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
 * 添付資料のAIエージェントアーキテクチャに基づく実装
 * 6つの専門エージェント（グラフ構築、情報探索、コンテンツ評価、サンプル要約、ヒアリング、プラン設計）による連携処理
 * 
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
    
    // ========== フェーズ1: 初期化とオーケストレーション ==========
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      'ナレッジグラフと情報収集プランの生成プロセスを開始します。6つの専門エージェントによる連携処理を実行します。',
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      5,
      '初期データを分析中...'
    );
    
    // ========== フェーズ2: グラフ構築エージェントによる初期グラフ作成 ==========
    
    // グラフ構築エージェントの思考
    sendAgentThought(
      AgentType.GRAPH_BUILDER,
      `${params.mainTopic}業界と${params.subTopics.join(', ')}に関する初期エンティティ辞書を構築しています。階層関係と概念マッピングを設計中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // グラフ構築エージェントの思考 (続き)
    sendAgentThought(
      AgentType.GRAPH_BUILDER,
      `${params.mainTopic}のドメイン知識に基づいて基本ノード構造を生成しています。${params.subTopics.length}個のキーワードから階層的エンティティを構築中...`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      15,
      '初期ナレッジグラフの構造を生成しています...'
    );
    
    // 初期ナレッジグラフの生成（基本構造のみ）
    const initialGraphData = await knowledgeGraphService.generateHierarchicalKnowledgeGraph(
      roleModelId,
      params.mainTopic,
      params.subTopics,
      params.overwrite
    );
    
    if (!initialGraphData) {
      throw new Error('初期ナレッジグラフの生成に失敗しました');
    }
    
    // グラフ構築エージェントの完了思考
    sendAgentThought(
      AgentType.GRAPH_BUILDER,
      `初期ナレッジグラフ（${initialGraphData.nodes.length}ノード, ${initialGraphData.edges.length}エッジ）の構築が完了しました。情報探索エージェントにバトンタッチします。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ3: 情報探索エージェントによる情報収集 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      25,
      '外部情報ソースを探索中...'
    );
    
    // 情報探索エージェントの思考
    sendAgentThought(
      AgentType.INFORMATION_EXPLORER,
      `${params.mainTopic}業界に関する最新情報ソースを探索しています。信頼性の高いウェブソース、ニュース、学術資料、分析レポートを特定中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 情報探索エージェントの思考（続き）
    sendAgentThought(
      AgentType.INFORMATION_EXPLORER,
      `${params.subTopics.join(', ')}に関連する専門情報を各カテゴリ（企業情報、製品情報、技術トレンド、市場分析、事例）から収集しています...`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 基本検索パターンのテスト実行（表示のみ）
    const searchResults = await exaSearchService.searchWithExa({
      query: `${params.mainTopic} industry overview ${params.subTopics.join(' ')}`,
      numResults: 3,
      categoryFilters: [SearchCategory.WEB_SEARCH, SearchCategory.NEWS],
      timeRange: '6m'
    });
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 情報探索エージェントの完了思考
    sendAgentThought(
      AgentType.INFORMATION_EXPLORER,
      `${searchResults.results.length}件の関連情報ソースを特定しました。発見した情報をコンテンツ評価エージェントに提供します。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ4: コンテンツ評価エージェントによる情報評価 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      40,
      '収集した情報の品質と関連性を評価中...'
    );
    
    // コンテンツ評価エージェントの思考
    sendAgentThought(
      AgentType.CONTENT_EVALUATOR,
      `収集された情報ソースの品質、信頼性、関連性を分析しています。情報の新鮮さと専門性を評価基準に適用中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // コンテンツ評価エージェントの思考（続き）
    sendAgentThought(
      AgentType.CONTENT_EVALUATOR,
      `情報の重複を検出し、最も価値のある洞察を抽出しています。情報の信頼性スコアと関連性スコアを計算中...`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // コンテンツ評価エージェントの完了思考
    sendAgentThought(
      AgentType.CONTENT_EVALUATOR,
      `情報評価が完了しました。高品質な情報ソースを選別し、サンプル要約エージェントに提供します。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ5: サンプル要約エージェントによる要約パターン生成 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      55,
      '5種類の要約レポートパターンを生成中...'
    );
    
    // サンプル要約エージェントの思考
    sendAgentThought(
      AgentType.SAMPLE_SUMMARIZER,
      `${params.mainTopic}業界に関する5種類の要約レポートパターンを生成しています。市場概要、技術トレンド、主要プレイヤー分析、課題と機会、将来展望のテンプレートを作成中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 要約サンプルパターンを生成
    const summarySamples = [
      {
        id: 'market-overview',
        name: '市場概要',
        description: `${params.mainTopic}業界の市場規模、成長率、主要セグメント、地域分布などの基本情報を簡潔にまとめた要約です。`,
        sample: `${params.mainTopic}業界は2024年に約XX億円の市場規模を持ち、今後5年間でY%の年間成長率が予測されています。特に${params.subTopics[0] || '主要分野'}セグメントが最も急速に成長しており、${params.subTopics[1] || '新興技術'}の普及が市場をけん引しています。`
      },
      {
        id: 'tech-trends',
        name: '技術トレンド',
        description: `${params.mainTopic}業界における最新の技術動向と革新を分析した要約です。`,
        sample: `${params.mainTopic}業界では、${params.subTopics.join('、')}などの技術が急速に普及しています。特にAIと機械学習の統合が業務プロセスを変革し、効率性を40%向上させています。今後18ヶ月以内に、これらの技術の採用率は2倍になると予測されています。`
      },
      {
        id: 'key-players',
        name: '主要プレイヤー分析',
        description: `${params.mainTopic}業界の主要企業、市場シェア、競争戦略を分析した要約です。`,
        sample: `${params.mainTopic}業界では、上位5社で市場シェアの60%を占めています。業界リーダーはXYZ社で、革新的な${params.subTopics[0] || '技術'}ソリューションにより市場の25%を支配しています。新興企業のABC社は、ニッチな${params.subTopics[1] || '分野'}に特化することで急速に成長しています。`
      },
      {
        id: 'challenges',
        name: '課題と機会',
        description: `${params.mainTopic}業界が直面する主な課題と、それに関連する成長機会の分析です。`,
        sample: `${params.mainTopic}業界の主な課題は、${params.subTopics[0] || '技術'}の急速な変化に対する適応、規制環境の複雑さ、人材不足です。しかし、これらの課題は${params.subTopics[1] || '新たな市場'}における革新的なソリューション開発の機会も提供しています。`
      },
      {
        id: 'future-outlook',
        name: '将来展望',
        description: `${params.mainTopic}業界の今後3-5年の展望と長期的な発展予測を提供する要約です。`,
        sample: `${params.mainTopic}業界は今後5年間で大きな変革が予想されています。${params.subTopics.join('と')}の融合により、新しいビジネスモデルが出現し、従来の業界の境界が再定義されるでしょう。持続可能性と技術革新が業界の将来を形作る主要な推進力となります。`
      }
    ];
    
    // サンプル要約エージェントの完了思考
    sendAgentThought(
      AgentType.SAMPLE_SUMMARIZER,
      `5種類の要約レポートパターンの生成が完了しました: ${summarySamples.map(s => s.name).join('、')}`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ========== フェーズ6: ヒアリングエージェントによるユーザーサンプル提示 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      65,
      'ユーザー向け要約サンプルを準備しています...',
      { 
        status: 'waiting_for_user_input',
        summarySamples,
        message: `${params.mainTopic}業界に関する5種類の要約レポートパターンを生成しました。どのパターンが最も関心に合致するか、フィードバックをお願いします。`
      }
    );
    
    // ヒアリングエージェントの思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      `生成した5種類の要約サンプルをユーザーに提示し、どのタイプの情報が最も有用かフィードバックを求めています...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // ユーザー入力待機（実際のアプリケーションでは、ここでクライアント側からの入力を受け取る）
    // この例ではシミュレーションとして、ユーザーが「市場概要」と「技術トレンド」を選択したと仮定
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ヒアリングエージェントの思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      `ユーザーからのフィードバックを受け取りました。市場概要と技術トレンドの情報に特に関心があるようです。この嗜好に基づいて情報収集プランとナレッジグラフを最適化します。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ7: ユーザーフィードバックの反映 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      75,
      'ユーザーのフィードバックをナレッジグラフに反映しています...'
    );
    
    // ヒアリングエージェントの思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      `ユーザーのフィードバックを分析し、知識グラフの重み付けを調整しています。市場概要と技術トレンド関連のノードを強化します...`,
      roleModelId,
      ThoughtStatus.WORKING
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // ナレッジグラフのユーザーフィードバック集約
    const userPreferences = {
      categories: ['市場概要', '技術トレンド'],
      priorityKeywords: params.subTopics.slice(0, 2),
      feedbackType: 'explicit'
    };
    
    // ユーザーフィードバックをナレッジグラフサービスに送信（実際の実装ではこのデータを使用してグラフを調整）
    await knowledgeGraphService.incorporateUserFeedback(roleModelId, initialGraphData, userPreferences);
    
    // ヒアリングエージェントの完了思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      `ユーザーフィードバックの反映が完了しました。ナレッジグラフの関連部分を強化し、優先度を更新しました。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ8: グラフ構築エージェントによるグラフ最終化 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      80,
      'ナレッジグラフを最終化しています...'
    );
    
    // グラフ構築エージェントの思考
    sendAgentThought(
      AgentType.GRAPH_BUILDER,
      `収集した情報と分析結果に基づいてナレッジグラフを更新しています。エンティティ間の関係を強化し、階層構造を最適化中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 最終ナレッジグラフの生成（または更新）
    const finalGraphData = await knowledgeGraphService.enhanceKnowledgeGraph(
      roleModelId,
      initialGraphData,
      params.subTopics
    );
    
    // グラフ構築エージェントの完了思考
    sendAgentThought(
      AgentType.GRAPH_BUILDER,
      `ナレッジグラフの最終化が完了しました。合計${finalGraphData.nodes.length}ノード、${finalGraphData.edges.length}エッジを持つ包括的な知識構造が構築されました。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ8: プラン設計エージェントによる情報収集プラン作成 ==========
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      90,
      '最適な情報収集プランを作成しています...'
    );
    
    // プラン設計エージェントの思考
    sendAgentThought(
      AgentType.PLAN_DESIGNER,
      `最終化されたナレッジグラフに基づいて最適な情報収集プランを設計しています。キーワード（${params.subTopics.join(', ')}）の特性に合わせた検索戦略を構築中...`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 情報収集プランのパターンを生成（拡張版）
    const collectionPatterns = exaSearchService.generateCollectionPlanPatterns(
      params.mainTopic,
      params.subTopics
    );
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // プラン設計エージェントの完了思考
    sendAgentThought(
      AgentType.PLAN_DESIGNER,
      `${collectionPatterns.length}件の情報収集プランパターンの作成が完了しました。各プランには最適化された検索クエリと実行スケジュールが含まれています。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // ========== フェーズ9: オーケストレーターによる最終処理 ==========
    
    // オーケストレーターの完了思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ナレッジグラフ生成プロセスが完了しました。6つの専門エージェントの連携により、高品質なナレッジグラフ（${finalGraphData.nodes.length}ノード）と情報収集プラン（${collectionPatterns.length}種類）が作成されました。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      100,
      'ナレッジグラフと情報収集プランの生成が完了しました',
      { 
        status: 'completed',
        graphStats: {
          nodes: finalGraphData.nodes.length,
          edges: finalGraphData.edges.length
        },
        planStats: {
          count: collectionPatterns.length,
          categories: collectionPatterns.map(p => p.name)
        }
      }
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
    
    // プラン設計エージェントの思考
    sendAgentThought(
      AgentType.PLAN_DESIGNER,
      '既存の知識グラフを活用して最適な情報収集プランを作成します',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 既存のグラフを取得して分析
    const existingGraph = await graphService.getKnowledgeGraph(roleModelId);
    
    if (!existingGraph || existingGraph.nodes.length === 0) {
      sendAgentThought(
        AgentType.PLAN_DESIGNER,
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
/**
 * 要約サンプルを生成する
 * @param topic 要約対象のトピック
 * @returns 生成されたサンプル要約の配列
 */
/**
 * ユーザーフィードバック収集フロー
 * ユーザーに要約サンプルを提示し、フィードバックを収集する
 * 
 * @param roleModelId ロールモデルID
 * @param topic メイントピック
 * @returns 処理成功かどうか
 */
export async function runUserFeedbackCollectionFlow(
  roleModelId: string,
  topic: string
): Promise<boolean> {
  try {
    console.log(`ユーザーフィードバック収集フロー開始: ${roleModelId}, topic: ${topic}`);
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      'ユーザーのフィードバック収集プロセスを開始します。サンプル要約エージェントとヒアリングエージェントが連携して処理します。',
      roleModelId,
      ThoughtStatus.STARTING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      10,
      'ユーザーフィードバック収集を開始します...'
    );
    
    // サンプル要約エージェントの思考
    sendAgentThought(
      AgentType.SAMPLE_SUMMARIZER,
      `${topic}に関する複数の要約サンプルを生成しています。多様な視点と情報密度のバリエーションを用意します。`,
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      30,
      '要約サンプルを生成中...'
    );
    
    // 要約サンプルを生成
    const summarySamples = await generateSummarySamples(topic);
    
    // サンプル要約エージェントの完了思考
    sendAgentThought(
      AgentType.SAMPLE_SUMMARIZER,
      `${summarySamples.length}種類の要約サンプルの生成が完了しました。ヒアリングエージェントに提供します。`,
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      50,
      'ユーザーへの提示準備が完了しました'
    );
    
    // ヒアリングエージェントの思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      'ユーザーに複数の要約サンプルを提示し、フィードバックを収集します。ユーザーの関心に合致する情報の特性とパターンを特定します。',
      roleModelId,
      ThoughtStatus.THINKING
    );
    
    // 進捗状況の更新 - ユーザーへの選択肢提示
    sendProgress(
      roleModelId,
      70,
      'フィードバックを収集するため、以下の要約サンプルからお好みのタイプをお選びください。',
      {
        status: 'awaiting_feedback',
        samples: summarySamples,
        request_type: 'summary_selection',
        instructions: '最も関心のある要約タイプを1つ以上選択してください。このフィードバックはナレッジグラフと情報収集プランの最適化に使用されます。'
      }
    );
    
    // 実際のシステムではここでユーザーの入力を待機
    // このデモ実装では、入力受信をシミュレート
    
    // ヒアリングエージェントの思考
    sendAgentThought(
      AgentType.INTERVIEWER,
      'ユーザーからフィードバックを受信しました。選択された要約パターンに基づき、ユーザーの関心事項と情報ニーズを分析しています。',
      roleModelId,
      ThoughtStatus.DECISION
    );
    
    // 進捗状況の更新
    sendProgress(
      roleModelId,
      90,
      'フィードバックの処理を完了しました'
    );
    
    // オーケストレーターの思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      'ユーザーフィードバック収集プロセスが完了しました。収集した嗜好データをナレッジグラフの最適化とプラン設計に反映します。',
      roleModelId,
      ThoughtStatus.SUCCESS
    );
    
    // 進捗状況の最終更新
    sendProgress(
      roleModelId,
      100,
      'ユーザーフィードバック収集が完了しました',
      {
        status: 'completed',
        message: 'フィードバックが正常に処理されました。このデータを基にナレッジグラフと情報収集プランを最適化します。'
      }
    );
    
    return true;
  } catch (error) {
    console.error('ユーザーフィードバック収集フロー実行エラー:', error);
    
    // エラー進捗更新
    sendProgress(
      roleModelId,
      0,
      'フィードバック収集中にエラーが発生しました',
      {
        status: 'error',
        error: error instanceof Error ? error.message : '不明なエラー'
      }
    );
    
    // オーケストレーターのエラー思考
    sendAgentThought(
      AgentType.ORCHESTRATOR,
      `ユーザーフィードバック収集中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      roleModelId,
      ThoughtStatus.ERROR
    );
    
    return false;
  }
}

export async function generateSummarySamples(topic: string): Promise<any[]> {
  try {
    const agentName = AgentType.SAMPLE_SUMMARIZER;
    websocket.sendAgentThoughts(
      agentName,
      `${topic}に関する5種類の異なるタイプの要約サンプルを生成します`,
      'start'
    );

    // 5種類の要約パターンを定義
    const summaryTypes = [
      {
        id: 'technical',
        type: '技術的詳細型',
        characteristics: ['専門的', '技術重視', '詳細志向', 'データベース'],
        template: `${topic}に関する技術的な詳細と専門的な分析を含む要約`
      },
      {
        id: 'business',
        type: 'ビジネスインパクト型',
        characteristics: ['ビジネス視点', '市場動向', 'ROI分析', '戦略的'],
        template: `${topic}のビジネスへの影響と戦略的な意義に焦点を当てた要約`
      },
      {
        id: 'trend',
        type: 'トレンド分析型',
        characteristics: ['将来予測', '動向分析', 'トレンド重視', '展望'],
        template: `${topic}に関する最新トレンドと将来の展望に焦点を当てた要約`
      },
      {
        id: 'comparative',
        type: '比較分析型',
        characteristics: ['競合分析', '比較重視', '長所・短所', '評価'],
        template: `${topic}の競合比較と長所・短所を分析した要約`
      },
      {
        id: 'overview',
        type: '概要把握型',
        characteristics: ['簡潔', '要点重視', '全体像', 'エグゼクティブサマリー'],
        template: `${topic}の核心を簡潔に捉えたエグゼクティブサマリー`
      }
    ];

    // 各サンプルに要約内容を追加
    const samples = summaryTypes.map(type => {
      const sample = {
        ...type,
        title: `${type.type}サンプル`,
        content: generateSampleContent(topic, type.type, type.characteristics)
      };

      // 各サンプル生成の進捗を報告
      websocket.sendAgentThoughts(
        agentName,
        `${type.type}のサンプル要約を生成しました`,
        'thinking'
      );

      return sample;
    });

    // 完了報告
    websocket.sendAgentThoughts(
      agentName,
      `${topic}に関する5種類の要約サンプルの生成が完了しました`,
      'complete'
    );

    return samples;
  } catch (error) {
    console.error('要約サンプル生成エラー:', error);
    websocket.sendAgentThoughts(
      AgentType.SAMPLE_SUMMARIZER,
      `要約サンプル生成中にエラーが発生しました: ${error}`,
      'error'
    );
    return [];
  }
}

/**
 * サンプル要約内容を生成する内部ヘルパー関数
 */
function generateSampleContent(topic: string, type: string, characteristics: string[]): string {
  // 実際の実装ではAIを使って内容を生成
  // ここではダミーコンテンツを返す
  const contentByType: Record<string, string> = {
    '技術的詳細型': `${topic}の技術的詳細分析：\n\n` +
      `1. 技術概要: ${topic}の主要技術コンポーネントとアーキテクチャ\n` +
      `2. 実装方法: 具体的な実装手法と技術スタック\n` +
      `3. 性能分析: パフォーマンスとスケーラビリティの評価\n` +
      `4. 技術的課題: 現在の実装における主な技術的課題\n` +
      `5. 将来の技術的発展: 今後予想される技術革新`,

    'ビジネスインパクト型': `${topic}のビジネスインパクト分析：\n\n` +
      `1. 市場機会: ${topic}がもたらす新たな市場機会\n` +
      `2. 収益モデル: 実現可能な収益化戦略と予測ROI\n` +
      `3. 競争優位性: 競合との差別化ポイントと市場ポジショニング\n` +
      `4. リスク評価: 考慮すべきビジネスリスクと対策\n` +
      `5. 戦略的提言: 最大のビジネス価値を引き出すための戦略提案`,

    'トレンド分析型': `${topic}の最新トレンド分析：\n\n` +
      `1. 現在のトレンド: ${topic}における最新の市場トレンド\n` +
      `2. 成長予測: 今後3-5年の成長見通しと普及率予測\n` +
      `3. 新興動向: 注目すべき新興サブカテゴリとイノベーション\n` +
      `4. 転換点: 業界に変革をもたらす可能性のある転換点\n` +
      `5. 将来展望: 長期的な発展シナリオと市場予測`,

    '比較分析型': `${topic}の比較分析：\n\n` +
      `1. 主要プレイヤー: ${topic}分野における主要企業の比較\n` +
      `2. ソリューション比較: 主要ソリューションの機能・性能比較\n` +
      `3. 長所・短所: 各アプローチの長所と短所の詳細分析\n` +
      `4. コスト比較: 実装・運用コストの比較分析\n` +
      `5. 最適選択: ユースケース別の最適選択ガイド`,

    '概要把握型': `${topic}の概要：\n\n` +
      `${topic}は現在急速に発展する分野であり、企業のデジタル変革において重要な役割を果たしています。主要な利点には効率化、コスト削減、精度向上があり、特に大規模データ処理と自動化において顕著な成果を上げています。現在の市場規模は約○○億円で、年間成長率は20%以上と予測されています。主要プレイヤーには大手IT企業と革新的スタートアップが含まれ、今後5年間でさらなる技術革新と市場拡大が期待されています。`
  };

  // 要約タイプに合わせたコンテンツを返す
  return contentByType[type] || `${topic}に関する${type}サンプル要約です。このサンプルは${characteristics.join('、')}の特性を持っています。`;
}

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
    
    // プラン設計エージェントの思考
    sendAgentThought(
      AgentType.PLAN_DESIGNER,
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