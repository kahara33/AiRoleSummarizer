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
    this.crew.on('agentThinking', (data) => {
      this.emit('agentThought', {
        agentName: data.agentName,
        taskName: data.taskName,
        thought: data.thought,
        timestamp: new Date().toISOString()
      });
    });
    
    // タスク完了イベント
    this.crew.on('taskCompleted', (data) => {
      this.emit('taskCompleted', {
        taskName: data.taskName,
        result: data.result,
        timestamp: new Date().toISOString()
      });
    });
    
    // エラーイベント
    this.crew.on('error', (error) => {
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
   */
  async generateKnowledgeGraph() {
    try {
      this.reportProgress('開始', 0, 'ナレッジグラフ生成プロセスを開始します');
      
      // 業界分析タスクの実行
      this.reportProgress('業界分析', 10, 'ドメインアナリストが業界分析を実行中...');
      const industryAnalysis = await this.crew.runTask(
        AnalyzeIndustryTask,
        {
          industry: this.industry,
          initial_keywords: this.initialKeywords.join(', ')
        }
      );
      this.reportProgress('業界分析', 20, '業界分析が完了しました');
      
      // 情報源評価タスクの実行
      this.reportProgress('情報源評価', 25, 'トレンドリサーチャーが情報源評価を実行中...');
      const sourceEvaluation = await this.crew.runTask(
        EvaluateSourcesTask,
        {
          industry: this.industry,
          key_keywords: industryAnalysis.expandedKeywords.map(k => k.keyword).join(', '),
          potential_sources: this.potentialSources.join(', ')
        }
      );
      this.reportProgress('情報源評価', 40, '情報源評価が完了しました');
      
      // グラフ構造設計タスクの実行
      this.reportProgress('グラフ構造設計', 45, 'コンテキストマッパーがグラフ構造を設計中...');
      const graphStructure = await this.crew.runTask(
        DesignGraphStructureTask,
        {
          expanded_keywords: JSON.stringify(industryAnalysis.expandedKeywords),
          keyword_hierarchy: JSON.stringify(industryAnalysis.hierarchy),
          key_relationships: JSON.stringify(industryAnalysis.keyRelationships)
        }
      );
      this.reportProgress('グラフ構造設計', 60, 'グラフ構造設計が完了しました');
      
      // 情報収集プラン策定タスクの実行
      this.reportProgress('プラン策定', 65, 'プランストラテジストが情報収集プランを策定中...');
      const collectionPlan = await this.crew.runTask(
        DevelopCollectionPlanTask,
        {
          evaluated_sources: JSON.stringify(sourceEvaluation.evaluatedSources),
          priority_keywords: industryAnalysis.expandedKeywords
            .filter(k => k.relevanceScore > 0.7)
            .map(k => k.keyword)
            .join(', '),
          resource_constraints: this.resourceConstraints.join(', '),
          trend_predictions: JSON.stringify(sourceEvaluation.trendPredictions)
        }
      );
      this.reportProgress('プラン策定', 75, '情報収集プラン策定が完了しました');
      
      // 品質評価タスクの実行
      this.reportProgress('品質評価', 80, 'クリティカルシンカーが品質評価を実行中...');
      const qualityAssessment = await this.crew.runTask(
        EvaluateQualityTask,
        {
          graph_structure: JSON.stringify(graphStructure),
          collection_plan: JSON.stringify(collectionPlan),
          industry_analysis: JSON.stringify(industryAnalysis),
          original_requirements: this.originalRequirements.join(', ')
        }
      );
      this.reportProgress('品質評価', 90, '品質評価が完了しました');
      
      // 最終統合タスクの実行
      this.reportProgress('最終統合', 95, '最終的なナレッジグラフと情報収集プランを統合中...');
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
      
      this.reportProgress('完了', 100, 'ナレッジグラフ生成プロセスが完了しました');
      
      // 最終結果を返す
      return finalResult;
      
    } catch (error) {
      this.emit('error', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      throw error;
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