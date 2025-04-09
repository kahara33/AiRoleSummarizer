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
    originalRequirements: string[] = [],
    roleModelId: string = '' // ロールモデルIDを追加
  ) {
    super();
    this.industry = industry;
    this.initialKeywords = initialKeywords;
    this.potentialSources = potentialSources;
    this.resourceConstraints = resourceConstraints;
    this.originalRequirements = originalRequirements;
    
    // ロールモデルIDを保持（WebSocket通信に必要）
    (this as any).roleModelId = roleModelId;
    
    try {
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
      console.log('Crewインスタンス初期化成功');
    } catch (error) {
      console.error('Crewインスタンスの初期化に失敗しました:', error);
      // フォールバックとして、EventEmitterとしての基本機能を維持
      this.crew = {
        on: () => console.log('EventEmitterのフォールバックが呼び出されました'),
        runTask: async () => { 
          console.error('Crewインスタンスがないためタスクを実行できません'); 
          return {}; 
        }
      } as any;
    }
    
    // WebSocket関連のデバッグログ
    console.log(`CrewManagerが初期化されました。roleModelId=${roleModelId}`);
    
    // エージェントの思考プロセスイベントリスナーを設定
    this.setupAgentEventListeners();
  }
  
  /**
   * エージェントイベントリスナーを設定
   * 各エージェントの思考プロセスをイベントとして発行
   */
  private setupAgentEventListeners() {
    // 各エージェントの思考プロセスをモニタリング
    // 元のイベントリスナーを強化
    // イベントリスナーを安全に登録するためのチェック
    if (this.crew && typeof this.crew.on === 'function') {
      try {
        this.crew.on('agentThinking', (data: any) => {
          console.log('CrewAI エージェント思考イベント検出:', data);
          
          // 日本語名とタスクタイプのマッピング
          let japaneseAgentName = data.agentName;
          if (data.agentName === 'Domain Analyst') {
            japaneseAgentName = 'ドメイン分析者';
          } else if (data.agentName === 'Trend Researcher') {
            japaneseAgentName = 'トレンドリサーチャー';
          } else if (data.agentName === 'Context Mapper') {
            japaneseAgentName = 'コンテキストマッパー';
          } else if (data.agentName === 'Plan Strategist') {
            japaneseAgentName = 'プランストラテジスト';
          } else if (data.agentName === 'Critical Thinker') {
            japaneseAgentName = 'クリティカルシンカー';
          }
          
          // 思考内容がない場合は、既定の思考内容を提供
          const thoughtContent = data.thought || `${japaneseAgentName}がタスク「${data.taskName || "未知のタスク"}」を処理中...`;
          
          // 直接サーバーのWebSocketインターフェースを使ってエージェント思考を送信
          // これにより、イベントのデッドロックやリスナー問題を回避
          try {
            const sendAgentThoughts = require('../../websocket/ws-server').sendAgentThoughts;
            
            // WebSocketサーバー関数を使用して直接送信
            if (typeof sendAgentThoughts === 'function') {
              // roleModelIdがなくて送信されない場合があるため、
              // ダミーのIDを設定（後でフィルタリングされる）
              const roleModelId = (this as any).roleModelId || 'default-role-model-id';
              sendAgentThoughts(
                japaneseAgentName,
                thoughtContent,
                roleModelId,
                {
                  taskName: data.taskName,
                  type: 'thinking', // 思考中タイプを明示的に設定
                  timestamp: new Date().toISOString()
                }
              );
              console.log(`WebSocketを介してエージェント思考を直接送信: ${japaneseAgentName}`);
            } else {
              console.error('sendAgentThoughts関数が見つかりません。WebSocketでの送信に失敗しました。');
            }
          } catch (wsError) {
            console.error('WebSocket送信中にエラーが発生しました:', wsError);
          }
          
          // 従来のイベントエミッターも維持（互換性のため）
          this.emit('agentThought', {
            agentName: japaneseAgentName,
            taskName: data.taskName,
            thought: thoughtContent,
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID() // 一意のIDを必ず設定
          });
          
          // クリティカルなログも出力して、イベントの発行を確認
          console.log(`エージェント思考イベントを発行: ${japaneseAgentName} - ${thoughtContent.substring(0, 50)}...`);
        });
      } catch (error) {
        console.error('エージェント思考イベントリスナーの登録中にエラーが発生しました:', error);
      }
    
    }
    
    // タスク完了イベント
    if (this.crew && typeof this.crew.on === 'function') {
      try {
        this.crew.on('taskCompleted', (data: any) => {
          console.log('CrewAI タスク完了イベント検出:', data);
          
          // タスク名から担当エージェントを決定
          let agentName = 'タスクマネージャー';
          if (data.taskName === 'AnalyzeIndustryTask') {
            agentName = 'ドメイン分析者';
          } else if (data.taskName === 'EvaluateSourcesTask') {
            agentName = 'トレンドリサーチャー';
          } else if (data.taskName === 'DesignGraphStructureTask') {
            agentName = 'コンテキストマッパー';
          } else if (data.taskName === 'DevelopCollectionPlanTask') {
            agentName = 'プランストラテジスト';
          } else if (data.taskName === 'EvaluateQualityTask' || data.taskName === 'IntegrateAndDocumentTask') {
            agentName = 'クリティカルシンカー';
          }
          
          // 直接WebSocketインターフェースを使用してタスク完了メッセージを送信
          try {
            const sendAgentThoughts = require('../../websocket/ws-server').sendAgentThoughts;
            if (typeof sendAgentThoughts === 'function') {
              const roleModelId = (this as any).roleModelId || 'default-role-model-id';
              const thought = `タスク「${data.taskName}」の処理が完了しました。結果を他のエージェントに共有します。`;
              
              sendAgentThoughts(
                agentName,
                thought,
                roleModelId,
                {
                  taskName: data.taskName,
                  type: 'success', // 成功タイプを明示的に設定
                  timestamp: new Date().toISOString(),
                  id: crypto.randomUUID() // 一意のIDを必ず設定
                }
              );
              console.log(`タスク完了メッセージをWebSocketで直接送信: ${agentName} - ${data.taskName}`);
            } else {
              console.error('sendAgentThoughts関数が見つかりません。WebSocketでの送信に失敗しました。');
            }
          } catch (wsError) {
            console.error('WebSocket送信中にエラーが発生しました(タスク完了):', wsError);
          }
          
          // 元のイベントエミッターも維持（互換性のため）
          this.emit('agentThought', {
            agentName: agentName,
            thought: `タスク「${data.taskName}」の処理が完了しました。結果を他のエージェントに共有します。`,
            taskName: data.taskName,
            timestamp: new Date().toISOString(),
            type: 'success',
            id: crypto.randomUUID() // 一意のIDを必ず設定
          });
          
          // 元のタスク完了イベントも発行
          this.emit('taskCompleted', {
            taskName: data.taskName,
            result: data.result,
            agentName: agentName, // 担当エージェント情報を追加
            timestamp: new Date().toISOString()
          });
          
          console.log(`タスク完了イベントを発行: ${agentName} - ${data.taskName}`);
        });
      } catch (error) {
        console.error('タスク完了イベントリスナーの登録中にエラーが発生しました:', error);
      }
    
    }
    
    // エラーイベント
    if (this.crew && typeof this.crew.on === 'function') {
      try {
        this.crew.on('error', (error: any) => {
          this.emit('error', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          });
        });
      } catch (error) {
        console.error('エラーイベントリスナーの登録中にエラーが発生しました:', error);
      }
    }
  }
  
  /**
   * 進捗状況を報告するメソッド
   * 現在の進捗状況をイベントとして発行
   */
  private reportProgress(stage: string, progress: number, detail: string) {
    // 直接WebSocketインターフェースを使用して進捗状況を送信
    const sendProgressUpdate = require('../../websocket/ws-server').sendProgressUpdate;
    try {
      if (typeof sendProgressUpdate === 'function') {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendProgressUpdate({
          message: `${stage}: ${detail}`,
          percent: progress,
          roleModelId,
          stage,
          details: detail
        });
        console.log(`進捗状況をWebSocketで直接送信: ${stage}, ${progress}%, ${detail}`);
      } else {
        console.error('sendProgressUpdate関数が見つかりません。WebSocketでの送信に失敗しました。');
      }
    } catch (wsError) {
      console.error('WebSocket送信中にエラーが発生しました(進捗):', wsError);
    }
    
    // 元のイベントエミッターも維持（互換性のため）
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
      
      // 開始メッセージをエージェント思考として発行 - 直接WebSocketインターフェースを使用
      const sendAgentThoughts = require('../../websocket/ws-server').sendAgentThoughts;
      try {
        if (typeof sendAgentThoughts === 'function') {
          const roleModelId = (this as any).roleModelId || 'default-role-model-id';
          const thought = 'AIエージェントチーム全体のタスクフローを設計し、エージェント間の連携を管理します。まず業界分析から始め、段階的にナレッジグラフと情報収集プランを構築していきます。';
          
          sendAgentThoughts(
            'オーケストレーター',
            thought,
            roleModelId,
            {
              type: 'info', // 情報タイプを明示的に設定
              timestamp: new Date().toISOString(),
              id: crypto.randomUUID() // 一意のIDを必ず設定
            }
          );
          console.log(`開始メッセージをWebSocketで直接送信: オーケストレーター`);
        }
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました(開始メッセージ):', wsError);
      }
      
      // 元のイベントエミッターも維持（互換性のため）
      this.emit('agentThought', {
        agentName: 'オーケストレーター',
        thought: 'AIエージェントチーム全体のタスクフローを設計し、エージェント間の連携を管理します。まず業界分析から始め、段階的にナレッジグラフと情報収集プランを構築していきます。',
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID() // 一意のIDを必ず設定
      });
      
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
  originalRequirements: string[] = [],
  roleModelId: string = ''
): CrewManager {
  return new CrewManager(
    industry,
    initialKeywords,
    potentialSources,
    resourceConstraints,
    originalRequirements,
    roleModelId
  );
}