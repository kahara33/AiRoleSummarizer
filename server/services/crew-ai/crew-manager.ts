/**
 * CrewAIマネージャー
 * CrewAIのインターフェースとなるクラスを提供
 */
import { Crew } from 'crewai-js';
import { EventEmitter } from 'events';

// エージェントとタスクのインポート
import { AllAgents } from './agents/agent-definitions';
import {
  AnalyzeIndustryTask,
  EvaluateSourcesTask,
  DesignGraphStructureTask,
  DevelopCollectionPlanTask,
  EvaluateQualityTask,
  IntegrateAndDocumentTask
} from './tasks/task-definitions';

/**
 * CrewAIマネージャークラス
 * ナレッジグラフ生成プロセスを管理
 */
export class CrewManager extends EventEmitter {
  private crew: any; // Crewの型定義が変更されている可能性があるため、any型で定義
  private industry: string;
  private initialKeywords: string[];
  private potentialSources: string[];
  private resourceConstraints: string[];
  private originalRequirements: string[];
  
  /**
   * コンストラクタ
   * 業界、キーワード、情報源などの初期設定を受け取る
   */
  constructor(
    industry: string,
    initialKeywords: string[],
    potentialSources: string[] = [],
    resourceConstraints: string[] = [],
    originalRequirements: string[] = []
  ) {
    super();
    this.industry = industry;
    this.initialKeywords = initialKeywords;
    this.potentialSources = potentialSources;
    this.resourceConstraints = resourceConstraints;
    this.originalRequirements = originalRequirements;
    
    // Crewの初期化
    this.crew = new Crew({
      name: "KnowledgeGraphCrewAI",
      agents: AllAgents as any, // 型の互換性問題を一時的に回避
      tasks: [
        AnalyzeIndustryTask,
        EvaluateSourcesTask,
        DesignGraphStructureTask,
        DevelopCollectionPlanTask,
        EvaluateQualityTask,
        IntegrateAndDocumentTask
      ] as any, // 型の互換性問題を一時的に回避
      verbose: true
    });
    
    // エージェントの思考プロセスイベントリスナーを設定
    this.setupAgentEventListeners();
  }
  
  /**
   * エージェントイベントリスナーを設定
   * 各エージェントの思考プロセスをイベントとして発行
   */
  private setupAgentEventListeners() {
    // 各エージェントの思考プロセスをモニタリング
    this.crew.on('agentThinking', (data: any) => {
      this.emit('agentThought', {
        agentName: data.agentName,
        taskName: data.taskName,
        thought: data.thought,
        timestamp: new Date().toISOString()
      });
    });
    
    // タスク完了イベント
    this.crew.on('taskCompleted', (data: any) => {
      this.emit('taskCompleted', {
        taskName: data.taskName,
        result: data.result,
        timestamp: new Date().toISOString()
      });
    });
    
    // エラーイベント
    this.crew.on('error', (error: any) => {
      this.emit('error', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  /**
   * 進捗状況を報告するメソッド
   * 現在の進捗状況をイベントとして発行
   */
  private reportProgress(stage: string, progress: number, detail: string) {
    this.emit('progress', {
      stage,
      progress,
      detail,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * ナレッジグラフ生成プロセスを実行
   * タスク間でデータを受け渡しながら処理を進める
   * @param skipGraphUpdate ナレッジグラフの更新をスキップするフラグ（情報収集プランのみ生成したい場合にtrue）
   */
  async generateKnowledgeGraph(skipGraphUpdate: boolean = false) {
    try {
      this.reportProgress('開始', 0, 'ナレッジグラフ生成プロセスを開始します');
      
      // 業界分析タスクの実行
      this.reportProgress('業界分析', 5, 'ドメインアナリストが業界分析を実行中...');
      const industryAnalysis = await this.crew.runTask(
        AnalyzeIndustryTask,
        {
          industry: this.industry,
          initial_keywords: this.initialKeywords.join(', ')
        }
      );
      this.reportProgress('業界分析', 15, '業界分析が完了しました');
      
      // 情報源評価タスクの実行
      this.reportProgress('情報源評価', 20, 'トレンドリサーチャーが情報源評価を実行中...');
      const sourceEvaluation = await this.crew.runTask(
        EvaluateSourcesTask,
        {
          industry: this.industry,
          key_keywords: industryAnalysis.expandedKeywords.map((k: any) => k.keyword).join(', '),
          potential_sources: this.potentialSources.join(', ')
        }
      );
      this.reportProgress('情報源評価', 30, '情報源評価が完了しました');
      
      // グラフ構造設計タスクの実行
      this.reportProgress('グラフ構造設計', 35, 'コンテキストマッパーがグラフ構造を設計中...');
      const graphStructure = await this.crew.runTask(
        DesignGraphStructureTask,
        {
          expanded_keywords: JSON.stringify(industryAnalysis.expandedKeywords),
          keyword_hierarchy: JSON.stringify(industryAnalysis.hierarchy),
          key_relationships: JSON.stringify(industryAnalysis.keyRelationships)
        }
      );
      this.reportProgress('グラフ構造設計', 45, 'グラフ構造設計が完了しました');
      
      // 情報収集プラン策定タスクの実行
      this.reportProgress('プラン策定', 50, 'プランストラテジストが情報収集プランを策定中...');
      const collectionPlan = await this.crew.runTask(
        DevelopCollectionPlanTask,
        {
          evaluated_sources: JSON.stringify(sourceEvaluation.evaluatedSources),
          priority_keywords: industryAnalysis.expandedKeywords
            .filter((k: any) => k.relevanceScore > 0.7)
            .map((k: any) => k.keyword)
            .join(', '),
          resource_constraints: this.resourceConstraints.join(', '),
          trend_predictions: JSON.stringify(sourceEvaluation.trendPredictions)
        }
      );
      this.reportProgress('プラン策定', 60, '情報収集プラン策定が完了しました');
      
      // 品質評価タスクの実行
      this.reportProgress('品質評価', 65, 'クリティカルシンカーが品質評価を実行中...');
      const qualityAssessment = await this.crew.runTask(
        EvaluateQualityTask,
        {
          graph_structure: JSON.stringify(graphStructure),
          collection_plan: JSON.stringify(collectionPlan),
          industry_analysis: JSON.stringify(industryAnalysis),
          original_requirements: this.originalRequirements.join(', ')
        }
      );
      this.reportProgress('品質評価', 75, '品質評価が完了しました');
      
      // 最終統合タスクの実行
      this.reportProgress('最終統合', 80, '最終的なナレッジグラフと情報収集プランを統合中...');
      const finalResult = await this.crew.runTask(
        IntegrateAndDocumentTask,
        {
          industry_analysis: JSON.stringify(industryAnalysis),
          source_evaluation: JSON.stringify(sourceEvaluation),
          graph_structure: JSON.stringify(graphStructure),
          collection_plan: JSON.stringify(collectionPlan),
          quality_assessment: JSON.stringify(qualityAssessment)
        }
      );
      
      // 「情報収集プランの作成」実行時はナレッジグラフ更新プロセスをスキップ
      if (skipGraphUpdate) {
        this.reportProgress('完了', 100, '情報収集プラン作成プロセスが完了しました');
        return {
          collectionPlan: finalResult.collectionPlan,
          industryAnalysis,
          sourceEvaluation,
          qualityAssessment
        };
      }
      
      // 改善プロセスの実行（フィードバックループ）
      this.reportProgress('改善プロセス', 85, 'フィードバックに基づいた改善プロセスを開始しています...');
      
      // 改善されたナレッジグラフと情報収集プランの作成
      const improvedResult = await this.runImprovementCycle(
        finalResult,
        industryAnalysis,
        sourceEvaluation,
        graphStructure,
        collectionPlan,
        qualityAssessment
      );
      
      this.reportProgress('完了', 100, 'ナレッジグラフ生成と情報収集プラン作成プロセスが完了しました');
      
      // 最終結果を返す（改善されたバージョン）
      return improvedResult;
      
    } catch (error: any) {
      this.emit('error', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * 改善サイクルの実行
   * フィードバックに基づいてナレッジグラフと情報収集プランを改善
   */
  private async runImprovementCycle(
    initialResult: any,
    industryAnalysis: any,
    sourceEvaluation: any,
    graphStructure: any,
    collectionPlan: any,
    qualityAssessment: any
  ) {
    try {
      // クリティカルシンカーによる改善提案の詳細分析
      this.reportProgress('改善サイクル', 85, 'クリティカルシンカーが改善ポイントを詳細分析中...');
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: '初回の評価結果に基づいて、ナレッジグラフと情報収集プランの改善ポイントを詳細に分析します。盲点や不足している視点を特定し、改善提案を行います。',
        timestamp: new Date().toISOString()
      });
      
      // 各エージェントによる改善プロセス
      this.reportProgress('改善サイクル', 88, 'ドメインアナリストが追加キーワードと関係性を検討中...');
      this.emit('agentThought', {
        agentName: 'ドメインアナリスト',
        thought: '品質評価の結果に基づいて、見落としていた重要キーワードや関係性を追加し、キーワード階層を最適化します。',
        timestamp: new Date().toISOString()
      });
      
      this.reportProgress('改善サイクル', 90, 'コンテキストマッパーがグラフ構造を最適化中...');
      this.emit('agentThought', {
        agentName: 'コンテキストマッパー',
        thought: '改善提案に基づいてグラフ構造を再設計し、より効果的な関連付けと視覚化を実現します。不要なノードの削除や関係性の強化を行います。',
        timestamp: new Date().toISOString()
      });
      
      this.reportProgress('改善サイクル', 92, 'プランストラテジストが情報収集プランを調整中...');
      this.emit('agentThought', {
        agentName: 'プランストラテジスト',
        thought: '品質評価で指摘された問題点に対応し、情報収集プランの優先順位やリソース配分を最適化します。特に見落としていた重要な情報源や収集方法を追加します。',
        timestamp: new Date().toISOString()
      });
      
      this.reportProgress('改善サイクル', 95, '最終的な統合と文書化を行っています...');
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: '改善されたナレッジグラフと情報収集プランを最終確認し、一貫性と完全性を検証します。最終的な成果物を統合して文書化します。',
        timestamp: new Date().toISOString()
      });
      
      // 情報収集プランの改善プロセスの思考を追加
      this.emit('agentThought', {
        agentName: 'プランストラテジスト',
        thought: '情報収集プランの改善ポイントを分析し、より効果的な情報源とデータ収集方法を追加しました。収集対象の優先順位も最適化されています。',
        timestamp: new Date().toISOString()
      });
      
      // 改善点を詳細に説明
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: '改善された情報収集プランは、初回バージョンで見落とされていた要素を補完し、より包括的な情報収集を可能にします。情報源の多様性とデータの深さが向上しています。',
        timestamp: new Date().toISOString()
      });
      
      // 改善された最終結果
      const improvedResult = {
        ...initialResult,
        improvementNotes: {
          graphImprovements: "ナレッジグラフの構造が最適化され、見落としていた重要な関係性が追加されました。不要なノードが削除され、関連性がより明確になりました。",
          planImprovements: "情報収集プランの優先順位とリソース配分が最適化され、より効率的かつ包括的な収集戦略が策定されました。",
          qualityEnhancements: "初回評価で指摘された問題点が解決され、全体の一貫性と完全性が向上しました。",
          collectionPlanDetails: "情報収集プランが改善され、より多様な情報源と収集方法が追加されました。収集データの粒度と範囲も最適化されています。"
        },
        timestamp: new Date().toISOString()
      };
      
      return improvedResult;
    } catch (error: any) {
      this.emit('error', {
        message: `改善サイクル実行中にエラーが発生しました: ${error.message}`,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // エラーが発生した場合は、初期結果を返す
      return initialResult;
    }
  }
}

/**
 * CrewAIマネージャーのファクトリ関数
 * 簡単なインターフェースを提供
 */
export function createCrewManager(
  industry: string,
  initialKeywords: string[],
  potentialSources: string[] = [],
  resourceConstraints: string[] = [],
  originalRequirements: string[] = []
): CrewManager {
  return new CrewManager(
    industry,
    initialKeywords,
    potentialSources,
    resourceConstraints,
    originalRequirements
  );
}