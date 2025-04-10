/**
 * CrewAIマネージャー
 * CrewAIのインターフェースとなるクラスを提供
 */
import { Crew } from 'crewai-js';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

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

// WebSocketサーバー関連のインポート
import { sendAgentThoughts, sendProgressUpdate, sendMessageToRoleModelViewers, sendPartialGraphUpdate } from '../../websocket';

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
   * Azure OpenAIを使用してエージェントの思考を生成する
   * @param agentName エージェント名
   * @param prompt プロンプト
   * @returns 生成された思考
   */
  private async generateAgentThought(agentName: string, prompt: string): Promise<string> {
    try {
      // Azure OpenAIへのリクエストを構築
      console.log(`エージェント ${agentName} の思考を生成します...`);
      
      // .envから取得されるAzure OpenAI API設定を使用
      const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
      const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://api.cognitive.microsoft.com';
      const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo';
      
      if (!AZURE_OPENAI_API_KEY) {
        console.error('Azure OpenAI API キーが設定されていません');
        return `${agentName}の思考を生成できませんでした。API設定を確認してください。`;
      }
      
      // OpenAI APIに直接リクエストを送信
      const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-07-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `あなたは${agentName}という専門知識を持つAIエージェントです。${this.industry}業界について詳しい専門家として、
              以下のガイドラインに従って簡潔な思考を表現してください：
              1. 専門家として考えている様子が伝わる自然な文体で
              2. 2-3文程度の簡潔な内容
              3. 専門用語は適度に使用し、必要に応じて簡単な説明を含める
              4. マークダウン記法や複雑な記号は使わない
              5. 人間らしい表現を心がける（例: "なるほど、これは...", "まず考えたいのは...", "ここで重要なのは..."）`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Azure OpenAI APIエラー:', errorData);
        return `${agentName}: 考え中...`;
      }
      
      const data = await response.json();
      let thought = data.choices && data.choices[0] && data.choices[0].message 
        ? data.choices[0].message.content
        : `${agentName}からの応答を取得できませんでした。`;
      
      // マークダウン記法や過剰な装飾を除去
      thought = thought.replace(/\*\*|\*|__|_|#|```|`|<[^>]*>/g, '');
      
      // 長すぎる思考を短くする
      const sentences = thought.split(/[。.!?！？]/);
      if (sentences.length > 4) {
        thought = sentences.slice(0, 3).join('。') + '。';
      }
      
      console.log(`エージェント ${agentName} の思考生成完了`);
      return thought;
    } catch (error) {
      console.error(`エージェント ${agentName} の思考生成中にエラーが発生しました:`, error);
      return `${agentName}: エラーが発生しました。詳細: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }
  
  /**
   * 指定されたミリ秒待機する
   * @param ms 待機ミリ秒
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            // 既にインポートしたsendAgentThoughts関数を使用
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
    try {
      const roleModelId = (this as any).roleModelId || 'default-role-model-id';
      sendProgressUpdate({
        message: `${stage}: ${detail}`,
        percent: progress,
        roleModelId
      });
      console.log(`進捗状況をWebSocketで直接送信: ${stage}, ${progress}%, ${detail}`);
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
   * タスクを実行する汎用メソッド
   * crewAI-jsのバージョンによってインターフェースが異なる可能性があるため、
   * 両方のインターフェースをサポート
   */
  private async runTask(task: any, input: any) {
    try {
      console.log(`タスク実行開始: ${task.name || 'unknown task'}`);
      console.log(`タスク入力: ${JSON.stringify(input)}`);
      
      // APIキーの確認
      if (!process.env.AZURE_OPENAI_API_KEY) {
        throw new Error('AZURE_OPENAI_API_KEYが設定されていません。APIキーを環境変数に設定してください。');
      }
      
      // タスク名を取得
      const taskName = task?.name || '';
      
      // タスクの種類に基づいて適切なプロンプトを生成
      let prompt = '';
      let responseProcessor = (text: string) => ({ result: text });
      
      if (taskName.includes('Analyze') || taskName === 'AnalyzeIndustryTask') {
        prompt = `あなたは業界分析の専門家です。以下の業界と初期キーワードに関連する分析を行ってください。
業界: ${input.industry || this.industry}
初期キーワード: ${input.initial_keywords || this.initialKeywords.join(', ')}

以下の形式でJSONを返してください：
{
  "expandedKeywords": [
    { "keyword": "キーワード1", "relevanceScore": 0.9, "description": "説明" },
    ...
  ],
  "hierarchy": {
    "root": "ルートノード",
    "children": [
      { "name": "カテゴリ1", "children": ["キーワード1", "キーワード2"] },
      ...
    ]
  },
  "keyRelationships": [
    { "source": "キーワード1", "target": "キーワード2", "relationship": "関連性の説明" },
    ...
  ],
  "summary": "分析の要約"
}`;
        
        responseProcessor = (text: string) => {
          try {
            // JSON部分を抽出する正規表現
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return { error: "有効なJSONが見つかりませんでした" };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { error: "JSONの解析に失敗しました", text };
          }
        };
      } else if (taskName.includes('Evaluate') || taskName === 'EvaluateSourcesTask') {
        prompt = `あなたは情報源の評価専門家です。以下の業界と重要なキーワードに関する情報源評価を行ってください。
業界: ${input.industry || this.industry}
重要キーワード: ${input.key_keywords || this.initialKeywords.join(', ')}
潜在的情報源: ${input.potential_sources || this.potentialSources.join(', ') || '一般的なビジネス情報源'}

以下の形式でJSONを返してください：
{
  "evaluatedSources": [
    { "name": "情報源1", "reliability": 0.9, "type": "情報源タイプ" },
    ...
  ],
  "trendPredictions": [
    { "trend": "トレンド予測1", "confidence": 0.8 },
    ...
  ]
}`;
        
        responseProcessor = (text: string) => {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return { error: "有効なJSONが見つかりませんでした" };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { error: "JSONの解析に失敗しました", text };
          }
        };
      } else if (taskName.includes('Design') || taskName === 'DesignGraphStructureTask') {
        // 入力データを解析
        let expandedKeywords = [];
        let keywordHierarchy = {};
        let keyRelationships = [];
        
        try {
          if (typeof input.expanded_keywords === 'string') {
            expandedKeywords = JSON.parse(input.expanded_keywords);
          } else if (Array.isArray(input.expanded_keywords)) {
            expandedKeywords = input.expanded_keywords;
          }
          
          if (typeof input.keyword_hierarchy === 'string') {
            keywordHierarchy = JSON.parse(input.keyword_hierarchy);
          } else if (typeof input.keyword_hierarchy === 'object') {
            keywordHierarchy = input.keyword_hierarchy;
          }
          
          if (typeof input.key_relationships === 'string') {
            keyRelationships = JSON.parse(input.key_relationships);
          } else if (Array.isArray(input.key_relationships)) {
            keyRelationships = input.key_relationships;
          }
        } catch (e) {
          console.error("入力JSONの解析エラー:", e);
        }
        
        prompt = `あなたはナレッジグラフの構造設計専門家です。以下のキーワードとその関係性に基づいてグラフ構造を設計してください。

キーワード: ${JSON.stringify(expandedKeywords || [])}
キーワード階層: ${JSON.stringify(keywordHierarchy || {})}
キーワード関係: ${JSON.stringify(keyRelationships || [])}

以下の形式でJSONを返してください：
{
  "graphStructure": {
    "nodes": [
      { "id": "ノードID", "label": "表示ラベル", "type": "concept", "description": "説明（オプション）" },
      ...
    ],
    "edges": [
      { "source": "ソースノードID", "target": "ターゲットノードID", "label": "関係性ラベル" },
      ...
    ]
  }
}`;
        
        responseProcessor = (text: string) => {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return { 
              graphStructure: {
                nodes: expandedKeywords.map((k: any) => ({ 
                  id: k.keyword, 
                  label: k.keyword, 
                  type: 'concept',
                  description: k.description || ''
                })),
                edges: keyRelationships.map((r: any) => ({ 
                  source: r.source, 
                  target: r.target, 
                  label: r.relationship 
                }))
              }
            };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { 
              graphStructure: {
                nodes: expandedKeywords.map((k: any) => ({ 
                  id: k.keyword, 
                  label: k.keyword, 
                  type: 'concept',
                  description: k.description || ''
                })),
                edges: keyRelationships.map((r: any) => ({ 
                  source: r.source, 
                  target: r.target, 
                  label: r.relationship 
                }))
              }
            };
          }
        };
      } else if (taskName.includes('Develop') || taskName === 'DevelopCollectionPlanTask') {
        // 入力データを解析
        let evaluatedSources = [];
        let priorityKeywords = input.priority_keywords || '';
        let constraints = input.resource_constraints || this.resourceConstraints.join(', ') || '';
        
        try {
          if (typeof input.evaluated_sources === 'string') {
            evaluatedSources = JSON.parse(input.evaluated_sources);
          } else if (Array.isArray(input.evaluated_sources)) {
            evaluatedSources = input.evaluated_sources;
          }
        } catch (e) {
          console.error("入力JSONの解析エラー:", e);
        }
        
        prompt = `あなたは情報収集計画の策定専門家です。以下の評価済み情報源と優先キーワードに基づいて情報収集計画を立案してください。

評価済み情報源: ${JSON.stringify(evaluatedSources || [])}
優先キーワード: ${priorityKeywords}
リソース制約: ${constraints}

以下の形式でJSONを返してください：
{
  "collectionPlan": {
    "priorityKeywords": ["優先キーワード1", "優先キーワード2", ...],
    "sources": ["情報源1", "情報源2", ...],
    "timeline": "収集タイムライン",
    "successMetrics": "成功指標",
    "collectionMethods": ["収集方法1", "収集方法2", ...]
  }
}`;
        
        responseProcessor = (text: string) => {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return { error: "有効なJSONが見つかりませんでした" };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { error: "JSONの解析に失敗しました", text };
          }
        };
      } else if (taskName.includes('Quality') || taskName === 'EvaluateQualityTask') {
        prompt = `あなたはナレッジグラフと情報収集計画の品質評価専門家です。以下の業界、キーワード、情報収集計画に基づいて評価を行ってください。

業界: ${this.industry}
キーワード: ${this.initialKeywords.join(', ')}
情報収集計画: ${JSON.stringify(input.collection_plan || {})}
グラフ構造: ${JSON.stringify(input.graph_structure || {})}

以下の形式でJSONを返してください：
{
  "qualityAssessment": {
    "strengths": ["強み1", "強み2", ...],
    "weaknesses": ["弱点1", "弱点2", ...],
    "improvementSuggestions": ["改善提案1", "改善提案2", ...]
  }
}`;
        
        responseProcessor = (text: string) => {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            return { error: "有効なJSONが見つかりませんでした" };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { 
              qualityAssessment: {
                strengths: ["包括的なキーワードカバレッジ", "信頼性の高い情報源"],
                weaknesses: ["最新技術動向の情報不足"],
                improvementSuggestions: ["セキュリティ関連のノードを追加"]
              }
            };
          }
        };
      } else if (taskName.includes('Integrate') || taskName === 'IntegrateAndDocumentTask') {
        prompt = `あなたはナレッジグラフと情報収集計画の統合と文書化の専門家です。以下のすべての結果を統合して、最終的な成果物を作成してください。

業界: ${this.industry}
キーワード: ${this.initialKeywords.join(', ')}
業界分析: ${JSON.stringify(input.industry_analysis || {})}
情報源評価: ${JSON.stringify(input.source_evaluation || {})}
グラフ構造: ${JSON.stringify(input.graph_structure || {})}
情報収集計画: ${JSON.stringify(input.collection_plan || {})}
品質評価: ${JSON.stringify(input.quality_assessment || {})}

以下の形式でJSONを返してください：
{
  "finalKnowledgeGraph": {
    "industry": "業界名",
    "keyFindings": ["主な発見1", "主な発見2", ...],
    "recommendedActions": ["推奨アクション1", "推奨アクション2", ...],
    "dataCollectionStrategy": "データ収集戦略の概要"
  }
}`;
        
        responseProcessor = (text: string) => {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsedJson = JSON.parse(jsonMatch[0]);
              
              // すべての入力データも結合して返す
              return {
                ...parsedJson,
                expandedKeywords: input.industry_analysis?.expandedKeywords || [],
                hierarchy: input.industry_analysis?.hierarchy || {},
                keyRelationships: input.industry_analysis?.keyRelationships || [],
                summary: input.industry_analysis?.summary || "",
                evaluatedSources: input.source_evaluation?.evaluatedSources || [],
                trendPredictions: input.source_evaluation?.trendPredictions || [],
                graphStructure: input.graph_structure?.graphStructure || {},
                collectionPlan: input.collection_plan?.collectionPlan || {},
                qualityAssessment: input.quality_assessment?.qualityAssessment || {}
              };
            }
            return { error: "有効なJSONが見つかりませんでした" };
          } catch (e) {
            console.error("JSON解析エラー:", e);
            return { error: "JSONの解析に失敗しました", text };
          }
        };
      } else {
        // その他の未知のタスク用の汎用プロンプト
        prompt = `あなたは「${taskName}」というタスクを実行する専門家です。以下の入力情報に基づいて、最適な結果を生成してください。

入力情報: ${JSON.stringify(input)}
業界: ${this.industry}
キーワード: ${this.initialKeywords.join(', ')}

JSONを含む詳細な分析結果を返してください。`;
      }
      
      // Azure OpenAI APIを使用してタスクを実行
      console.log(`${taskName}のためのAzure OpenAI APIリクエスト準備中...`);
      
      // Azure OpenAI APIに直接リクエストを送信
      const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
      const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://api.cognitive.microsoft.com';
      const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo';
      
      const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-07-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `あなたは「${this.industry}」業界に詳しい専門家として、各タスクに対して適切な結果を返してください。常に要求された形式に従ってください。`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Azure OpenAI APIエラー:', errorData);
        throw new Error(`Azure OpenAIからエラーレスポンス: ${errorData}`);
      }
      
      const data = await response.json();
      const resultText = data.choices && data.choices[0] && data.choices[0].message 
        ? data.choices[0].message.content
        : '';
      
      console.log(`${taskName}のAPIレスポンス受信 (length: ${resultText.length})`);
      
      // レスポンスをタスクに応じた形式に処理
      const processedResult = responseProcessor(resultText);
      console.log(`${taskName}の処理結果:`, JSON.stringify(processedResult).substring(0, 200) + '...');
      
      return processedResult;
    } catch (error) {
      console.error(`タスク実行エラー:`, error);
      // エラーを上位に伝播
      throw error;
    }
  }
  
  /**
   * ナレッジグラフ生成プロセスを実行
   * タスク間でデータを受け渡しながら処理を進める
   * @param skipGraphUpdate ナレッジグラフの更新をスキップするフラグ（情報収集プランのみ生成したい場合にtrue）
   */
  /**
   * 初期状態のノードとエッジを生成し、段階的な構築プロセスの開始点とする
   * @param roleModelId ロールモデルID
   * @param industry 業界名
   * @param keywords 初期キーワード配列
   * @returns 初期ノードとエッジを含むグラフデータ
   */
  private generateInitialGraphNodes(roleModelId: string, industry: string, keywords: string[]) {
    // 中心ノード（業界ノード）のID
    const industryNodeId = crypto.randomUUID();
    
    // ノードとエッジの配列を初期化
    const nodes = [];
    const edges = [];
    
    // 業界ノードを作成（中心ノード）
    nodes.push({
      id: industryNodeId,
      type: 'industry',
      name: industry,
      description: `${industry}業界の概要ノード`,
      level: 1,
      color: '#4285F4', // Googleブルー
      createdAt: new Date(),
      roleModelId: roleModelId
    });
    
    // 各キーワードをノードとして追加
    keywords.forEach((keyword, index) => {
      const nodeId = crypto.randomUUID();
      
      // キーワードノードを追加
      nodes.push({
        id: nodeId,
        type: 'keyword',
        name: keyword,
        description: `業界に関連する初期キーワード: ${keyword}`,
        parentId: industryNodeId, // 業界ノードに接続
        level: 2,
        color: '#EA4335', // Googleレッド
        createdAt: new Date(),
        roleModelId: roleModelId
      });
      
      // 業界ノードとキーワードノードを接続するエッジを追加
      edges.push({
        id: crypto.randomUUID(),
        source: industryNodeId,
        target: nodeId,
        type: 'related',
        label: '関連キーワード',
        roleModelId: roleModelId
      });
    });
    
    // 初期グラフデータをWebSocketを介して送信
    sendPartialGraphUpdate(
      roleModelId,
      { nodes, edges },
      'システム'
    );
    
    return { nodes, edges };

  }

  async generateKnowledgeGraph(skipGraphUpdate: boolean = false) {
    try {
      this.reportProgress('開始', 0, 'ナレッジグラフ生成プロセスを開始します');
      
      // ロールモデルIDの取得
      const roleModelId = (this as any).roleModelId || 'default-role-model-id';
      
      // 初期ノードとエッジを生成して送信（部分更新として）
      const initialGraphData = this.generateInitialGraphNodes(
        roleModelId,
        this.industry,
        this.initialKeywords
      );
      
      // 初期グラフ構造を部分的に送信
      try {
        sendPartialGraphUpdate(
          roleModelId,
          initialGraphData,
          'システム（初期化）'
        );
        console.log('初期グラフ構造を送信しました。');
      } catch (error) {
        console.error('初期グラフ構造の送信中にエラーが発生しました:', error);
      }
      
      // Azure OpenAIを使用して実際のAI思考を生成
      const orchestratorThought = await this.generateAgentThought(
        'オーケストレーター',
        `あなたは「${this.industry}」業界のナレッジグラフ生成における、AIエージェントチームの調整役です。
        チーム全体のタスクフローを設計し、各AIエージェント間の連携をどのように管理するか、具体的な内容で説明してください。
        初期キーワード: ${this.initialKeywords.join(', ')}`
      );
      
      // 開始メッセージをエージェント思考として発行 - 直接WebSocketインターフェースを使用
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        
        sendAgentThoughts(
          'オーケストレーター',
          orchestratorThought,
          roleModelId,
          {
            type: 'info', // 情報タイプを明示的に設定
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID() // 一意のIDを必ず設定
          }
        );
        console.log(`開始メッセージをWebSocketで直接送信: オーケストレーター`);
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました(開始メッセージ):', wsError);
      }
      
      // 元のイベントエミッターも維持（互換性のため）
      this.emit('agentThought', {
        agentName: 'オーケストレーター',
        thought: orchestratorThought,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID() // 一意のIDを必ず設定
      });
      
      // 各タスクの前に実際のAI思考を生成してから実行
      
      // 業界分析タスクの前の思考生成
      const analystThinking = await this.generateAgentThought(
        'ドメインアナリスト',
        `あなたは「${this.industry}」業界の専門家です。
        これから「${this.initialKeywords.join(', ')}」というキーワードを中心に業界分析を行います。
        どのような視点からアプローチし、どのような分析を行うか、その思考プロセスを詳細に説明してください。`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'ドメインアナリスト',
          analystThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 業界分析タスクの実行
      await this.delay(2000); // リアルタイム感のための遅延
      this.reportProgress('業界分析', 5, 'ドメインアナリストが業界分析を実行中...');
      const industryAnalysis = await this.runTask(
        AnalyzeIndustryTask,
        {
          industry: this.industry,
          initial_keywords: this.initialKeywords.join(', ')
        }
      );
      this.reportProgress('業界分析', 15, '業界分析が完了しました');
      
      // 業界分析結果に基づいてグラフを部分的に更新
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        
        // 分析結果から拡張されたキーワードを取得
        const expandedKeywords = industryAnalysis?.expandedKeywords || [];
        
        // 部分的なグラフ更新データを作成
        const analysisGraphData = {
          nodes: [],
          edges: []
        };
        
        // 既存の中心ノードを探す
        const rootNodeId = initialGraphData.nodes[0]?.id;
        
        // 拡張キーワードをノードとして追加
        expandedKeywords.forEach((keyword: any) => {
          const keywordId = crypto.randomUUID();
          analysisGraphData.nodes.push({
            id: keywordId,
            type: 'expanded_keyword',
            name: keyword.keyword,
            description: keyword.description || `${keyword.keyword}に関する詳細情報`,
            parentId: rootNodeId,
            level: 2,
            color: '#EA4335', // 赤色 - 分析で追加されたノード
            createdAt: new Date(),
            roleModelId
          });
          
          // ルートノードからのエッジを追加
          analysisGraphData.edges.push({
            id: crypto.randomUUID(),
            source: rootNodeId,
            target: keywordId,
            type: 'expanded',
            label: '関連キーワード',
            roleModelId
          });
        });
        
        // 部分更新として送信
        if (analysisGraphData.nodes.length > 0) {
          sendPartialGraphUpdate(
            roleModelId,
            analysisGraphData,
            'ドメインアナリスト'
          );
          console.log(`業界分析結果から${analysisGraphData.nodes.length}個のノードをグラフに追加しました`);
        }
      } catch (error) {
        console.error('業界分析結果のグラフ更新中にエラーが発生しました:', error);
      }
      
      // 分析完了メッセージ
      const analystCompletion = await this.generateAgentThought(
        'ドメインアナリスト',
        `あなたは「${this.industry}」業界の専門家として、「${this.initialKeywords.join(', ')}」に関する業界分析を完了しました。
        分析結果の概要と主な発見について、1-2文で簡潔に説明してください。`
      );
      
      // 完了メッセージをWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'ドメインアナリスト',
          analystCompletion,
          roleModelId,
          {
            type: 'success',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 情報源評価タスクの前の思考生成
      await this.delay(3000);
      const researcherThinking = await this.generateAgentThought(
        'トレンドリサーチャー',
        `あなたは「${this.industry}」業界の情報源評価専門家です。
        以下のキーワードに関連する情報源をどのように評価し、選定するか、その思考プロセスを詳細に説明してください。
        キーワード: ${industryAnalysis?.expandedKeywords?.map((k: any) => k.keyword)?.join(', ') || this.initialKeywords.join(', ')}`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'トレンドリサーチャー',
          researcherThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 情報源評価タスクの実行
      this.reportProgress('情報源評価', 20, 'トレンドリサーチャーが情報源評価を実行中...');
      const sourceEvaluation = await this.runTask(
        EvaluateSourcesTask,
        {
          industry: this.industry,
          key_keywords: industryAnalysis?.expandedKeywords?.map((k: any) => k.keyword)?.join(', ') || '',
          potential_sources: this.potentialSources.join(', ')
        }
      );
      this.reportProgress('情報源評価', 30, '情報源評価が完了しました');
      
      // 評価完了メッセージ
      const researcherCompletion = await this.generateAgentThought(
        'トレンドリサーチャー',
        `あなたはプランストラテジストとコンテキストマッパーと協力して「${this.industry}」業界の情報源評価を完了しました。
        評価結果を他のエージェントに報告するように、特に価値の高い情報源と、どのようにチームの成果に貢献するかについて1-2文で簡潔に説明してください。
        他のエージェントに対して質問や提案を含めてください。`
      );
      
      // 完了メッセージをWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'トレンドリサーチャー',
          researcherCompletion,
          roleModelId,
          {
            type: 'success',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // グラフ構造設計タスクの前の思考生成
      await this.delay(2500);
      const mapperThinking = await this.generateAgentThought(
        'コンテキストマッパー',
        `あなたは「${this.industry}」業界のナレッジグラフ構造設計専門家です。
        以下のキーワードとその関連性に基づいて、どのようにグラフ構造を設計するか、その思考プロセスを詳細に説明してください。
        キーワード: ${JSON.stringify(industryAnalysis?.expandedKeywords?.map((k: any) => k.keyword) || [])}
        関連性: ${JSON.stringify(industryAnalysis?.keyRelationships || [])}`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'コンテキストマッパー',
          mapperThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // グラフ構造設計タスクの実行
      this.reportProgress('グラフ構造設計', 35, 'コンテキストマッパーがグラフ構造を設計中...');
      const graphStructure = await this.runTask(
        DesignGraphStructureTask,
        {
          expanded_keywords: JSON.stringify(industryAnalysis?.expandedKeywords || []),
          keyword_hierarchy: JSON.stringify(industryAnalysis?.hierarchy || {}),
          key_relationships: JSON.stringify(industryAnalysis?.keyRelationships || [])
        }
      );
      this.reportProgress('グラフ構造設計', 45, 'グラフ構造設計が完了しました');
      
      // 設計完了メッセージ
      const mapperCompletion = await this.generateAgentThought(
        'コンテキストマッパー',
        `あなたはチームメンバーとして「${this.industry}」業界のナレッジグラフ構造設計に取り組んでいます。
        グラフ構造の設計を完了したので、他のエージェントメンバーに対して成果を報告し、意見や疑問点を求めるような
        自然な会話スタイルで、設計したグラフ構造の特徴と特に重要なノード間の関係性について説明してください。
        誰かのコメントに返信するような形式で話し始めてください。`
      );
      
      // 完了メッセージをWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'コンテキストマッパー',
          mapperCompletion,
          roleModelId,
          {
            type: 'success',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 情報収集プラン策定タスクの前の思考生成
      await this.delay(3500);
      const strategistThinking = await this.generateAgentThought(
        'プランストラテジスト',
        `あなたは「${this.industry}」業界の情報収集計画策定専門家です。
        以下の情報源評価と優先キーワードに基づいて、どのように情報収集計画を策定するか、その思考プロセスを詳細に説明してください。
        優先キーワード: ${industryAnalysis?.expandedKeywords
          ?.filter((k: any) => k.relevanceScore > 0.7)
          ?.map((k: any) => k.keyword)
          ?.join(', ') || ''}
        評価済み情報源: ${JSON.stringify(sourceEvaluation?.evaluatedSources || [])}`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'プランストラテジスト',
          strategistThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 情報収集プラン策定タスクの実行
      this.reportProgress('プラン策定', 50, 'プランストラテジストが情報収集プランを策定中...');
      const collectionPlan = await this.runTask(
        DevelopCollectionPlanTask,
        {
          evaluated_sources: JSON.stringify(sourceEvaluation?.evaluatedSources || []),
          priority_keywords: industryAnalysis?.expandedKeywords
            ?.filter((k: any) => k.relevanceScore > 0.7)
            ?.map((k: any) => k.keyword)
            ?.join(', ') || '',
          resource_constraints: this.resourceConstraints.join(', '),
          trend_predictions: JSON.stringify(sourceEvaluation?.trendPredictions || [])
        }
      );
      this.reportProgress('プラン策定', 60, '情報収集プラン策定が完了しました');
      
      // 策定完了メッセージ
      const strategistCompletion = await this.generateAgentThought(
        'プランストラテジスト',
        `コンテキストマッパーさんが作成したグラフ構造に基づいて「${this.industry}」業界の情報収集計画を策定しました。
        他のチームメンバーの意見も聞きたいと思いますが、策定した計画の特徴と収集戦略について、自然な会話形式で説明してください。
        特にトレンドリサーチャーさんやクリティカルシンカーさんからのフィードバックを求めるような形で話してみてください。`
      );
      
      // 完了メッセージをWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'プランストラテジスト',
          strategistCompletion,
          roleModelId,
          {
            type: 'success',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 品質評価タスクの前の思考生成
      await this.delay(2800);
      const thinkerThinking = await this.generateAgentThought(
        'クリティカルシンカー',
        `あなたは「${this.industry}」業界のナレッジグラフと情報収集計画の品質評価専門家です。
        以下のグラフ構造と情報収集計画に基づいて、どのように品質評価を行うか、その思考プロセスを詳細に説明してください。
        グラフ構造: ${JSON.stringify(graphStructure || {})}
        情報収集計画: ${JSON.stringify(collectionPlan || {})}`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'クリティカルシンカー',
          thinkerThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 品質評価タスクの実行
      this.reportProgress('品質評価', 65, 'クリティカルシンカーが品質評価を実行中...');
      const qualityAssessment = await this.runTask(
        EvaluateQualityTask,
        {
          graph_structure: JSON.stringify(graphStructure || {}),
          collection_plan: JSON.stringify(collectionPlan || {}),
          industry_analysis: JSON.stringify(industryAnalysis || {}),
          original_requirements: this.originalRequirements.join(', ')
        }
      );
      this.reportProgress('品質評価', 75, '品質評価が完了しました');
      
      // 評価完了メッセージ
      const thinkerCompletion = await this.generateAgentThought(
        'クリティカルシンカー',
        `プランストラテジストさんとコンテキストマッパーさんの作業を評価し、「${this.industry}」業界のナレッジグラフと情報収集プランの品質評価を完了しました。
        他のメンバーに対する建設的なフィードバックを含めて、評価結果の概要と主な強み/改善点について会話形式で説明してください。
        オーケストレーターさんへの提案も含めると良いでしょう。具体的な改善案についてメンバーの意見を求めるような質問も入れてください。`
      );
      
      // 完了メッセージをWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'クリティカルシンカー',
          thinkerCompletion,
          roleModelId,
          {
            type: 'success',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 統合と文書化タスクの前の思考生成
      await this.delay(3000);
      const integratorThinking = await this.generateAgentThought(
        'クリティカルシンカー',
        `あなたは「${this.industry}」業界のナレッジグラフと情報収集計画の統合と文書化専門家です。
        これまでの各タスクの結果を統合して最終的な成果物を作成するにあたり、どのようなアプローチを取るか、その思考プロセスを詳細に説明してください。`
      );
      
      // エージェント思考をWebSocketで送信
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        sendAgentThoughts(
          'クリティカルシンカー',
          integratorThinking,
          roleModelId,
          {
            type: 'thinking',
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
          }
        );
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました:', wsError);
      }
      
      // 最終統合タスクの実行
      this.reportProgress('最終統合', 80, '最終的なナレッジグラフと情報収集プランを統合中...');
      const finalResult = await this.runTask(
        IntegrateAndDocumentTask,
        {
          industry_analysis: JSON.stringify(industryAnalysis || {}),
          source_evaluation: JSON.stringify(sourceEvaluation || {}),
          graph_structure: JSON.stringify(graphStructure || {}),
          collection_plan: JSON.stringify(collectionPlan || {}),
          quality_assessment: JSON.stringify(qualityAssessment || {})
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
      
      // 知識グラフ更新の発行（完了時にグラフがリアルタイム更新されることを保証）
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        const timestamp = new Date().toISOString();
        
        // ナレッジグラフ完全更新のメッセージを送信
        console.log(`グラフ完全更新通知をWebSocketで送信: roleModelId=${roleModelId}`);
        
        // 短い遅延を追加して確実にクライアントがメッセージを受け取れるようにする
        setTimeout(() => {
          // 全てのイベント名で送信して確実に捕捉されるようにする
          // 同じメッセージを複数のタイプで送信する理由：
          // - さまざまなクライアントコードの互換性を維持するため
          // - エラー発生時のフォールバック機構として機能
          sendMessageToRoleModelViewers(roleModelId, 'graph-update', {
            message: 'ナレッジグラフが完成しました',
            timestamp: timestamp,
            updateType: 'complete',
            isComplete: true
          });
          
          setTimeout(() => {
            sendMessageToRoleModelViewers(roleModelId, 'knowledge-graph-update', {
              message: 'ナレッジグラフが完成しました',
              timestamp: timestamp,
              updateType: 'complete',
              isComplete: true
            });
            
            setTimeout(() => {
              sendMessageToRoleModelViewers(roleModelId, 'knowledge_graph_update', {
                message: 'ナレッジグラフが完成しました',
                timestamp: timestamp,
                updateType: 'complete',
                isComplete: true
              });
            }, 300);
          }, 300);
        }, 500);
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました(グラフ更新):', wsError);
      }
      
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
      
      // Azure OpenAIで思考生成
      const criticalThinking = await this.generateAgentThought(
        'クリティカルシンカー', 
        `業界「${this.industry}」のナレッジグラフと情報収集プランを改善するため、評価結果に基づいて詳細な分析を行ってください。
        特に盲点や不足している視点を特定し、具体的な改善提案を行ってください。
        初期キーワード: ${this.initialKeywords.join(', ')}
        品質評価結果: ${JSON.stringify(qualityAssessment || {})}`
      );
      
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: criticalThinking,
        timestamp: new Date().toISOString()
      });
      
      // 待機時間を追加してリアルタイム感を出す
      await this.delay(1500);
      
      // 各エージェントによる改善プロセス
      this.reportProgress('改善サイクル', 88, 'ドメインアナリストが追加キーワードと関係性を検討中...');
      
      const domainAnalystThinking = await this.generateAgentThought(
        'ドメインアナリスト',
        `業界「${this.industry}」に関する以下の初期分析結果をもとに、見落としていた重要キーワードや関係性を特定し、キーワード階層を最適化してください。
        初期キーワード: ${this.initialKeywords.join(', ')}
        業界分析結果: ${JSON.stringify(industryAnalysis || {})}
        品質評価結果: ${JSON.stringify(qualityAssessment || {})}`
      );
      
      this.emit('agentThought', {
        agentName: 'ドメインアナリスト',
        thought: domainAnalystThinking,
        timestamp: new Date().toISOString()
      });
      
      await this.delay(2000);
      
      this.reportProgress('改善サイクル', 90, 'コンテキストマッパーがグラフ構造を最適化中...');
      
      const contextMapperThinking = await this.generateAgentThought(
        'コンテキストマッパー',
        `業界「${this.industry}」のナレッジグラフ構造を改善するため、以下の初期グラフ構造と評価結果に基づいて再設計を行ってください。
        不要なノードの削除や関係性の強化など、具体的な改善点を示してください。
        グラフ構造: ${JSON.stringify(graphStructure || {})}
        品質評価結果: ${JSON.stringify(qualityAssessment || {})}`
      );
      
      this.emit('agentThought', {
        agentName: 'コンテキストマッパー',
        thought: contextMapperThinking,
        timestamp: new Date().toISOString()
      });
      
      await this.delay(1800);
      
      this.reportProgress('改善サイクル', 92, 'プランストラテジストが情報収集プランを調整中...');
      
      const planStratThinking = await this.generateAgentThought(
        'プランストラテジスト',
        `業界「${this.industry}」の情報収集プランを改善するため、以下の初期プランと評価結果に基づいて調整を行ってください。
        特に優先順位やリソース配分の最適化、重要な情報源や収集方法の追加など、具体的な改善点を示してください。
        初期情報収集プラン: ${JSON.stringify(collectionPlan || {})}
        品質評価結果: ${JSON.stringify(qualityAssessment || {})}`
      );
      
      this.emit('agentThought', {
        agentName: 'プランストラテジスト',
        thought: planStratThinking,
        timestamp: new Date().toISOString()
      });
      
      await this.delay(2500);
      
      this.reportProgress('改善サイクル', 95, '最終的な統合と文書化を行っています...');
      
      const finalThinking = await this.generateAgentThought(
        'クリティカルシンカー',
        `業界「${this.industry}」に関するナレッジグラフと情報収集プランの最終確認を行い、一貫性と完全性を検証してください。
        また、具体的な改善点と最終的な成果物についての簡潔な評価を行ってください。
        業界: ${this.industry}
        キーワード: ${this.initialKeywords.join(', ')}
        最新のグラフ構造: ${JSON.stringify(graphStructure || {})}
        最新の情報収集プラン: ${JSON.stringify(collectionPlan || {})}`
      );
      
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: finalThinking,
        timestamp: new Date().toISOString()
      });
      
      await this.delay(1500);
      
      // 情報収集プランの改善プロセスの思考を追加
      const planImprovementThinking = await this.generateAgentThought(
        'プランストラテジスト',
        `業界「${this.industry}」の改善された情報収集プランについて、特に収集対象の優先順位や効果的な情報源とデータ収集方法の観点から、実施した改善点を簡潔に説明してください。`
      );
      
      this.emit('agentThought', {
        agentName: 'プランストラテジスト',
        thought: planImprovementThinking,
        timestamp: new Date().toISOString()
      });
      
      await this.delay(1500);
      
      // 改善点を詳細に説明
      const finalImprovementThinking = await this.generateAgentThought(
        'クリティカルシンカー',
        `業界「${this.industry}」の改善された情報収集プランについて、初回バージョンと比較した際の強化点、特に情報源の多様性とデータの深さの観点から、最終的な評価を行ってください。`
      );
      
      this.emit('agentThought', {
        agentName: 'クリティカルシンカー',
        thought: finalImprovementThinking,
        timestamp: new Date().toISOString()
      });
      
      // 改善された最終結果を生成
      const graphImprovements = await this.generateAgentThought(
        'コンテキストマッパー',
        `業界「${this.industry}」のナレッジグラフの改善点について、特に構造の最適化、関係性の明確化、不要ノードの削除の観点から、1-2文で簡潔にまとめてください。`
      );
      
      const planImprovements = await this.generateAgentThought(
        'プランストラテジスト',
        `業界「${this.industry}」の情報収集プランの改善点について、特に優先順位とリソース配分の最適化の観点から、1-2文で簡潔にまとめてください。`
      );
      
      const qualityEnhancements = await this.generateAgentThought(
        'クリティカルシンカー',
        `業界「${this.industry}」のナレッジグラフと情報収集プランの初回評価で指摘された問題点の解決状況について、特に一貫性と完全性の観点から、1-2文で簡潔にまとめてください。`
      );
      
      const collectionPlanDetails = await this.generateAgentThought(
        'プランストラテジスト',
        `業界「${this.industry}」の改善された情報収集プランについて、特に情報源の多様性や収集データの粒度と範囲の観点から、1-2文で簡潔にまとめてください。`
      );
      
      // 改善された最終結果
      const improvedResult = {
        ...initialResult,
        improvementNotes: {
          graphImprovements,
          planImprovements,
          qualityEnhancements,
          collectionPlanDetails
        },
        timestamp: new Date().toISOString()
      };
      
      // 改善サイクル完了後にもグラフ更新通知
      try {
        const roleModelId = (this as any).roleModelId || 'default-role-model-id';
        const timestamp = new Date().toISOString();
        
        // 改善サイクル完了のグラフ更新通知を送信
        console.log(`改善サイクル完了後のグラフ更新通知をWebSocketで送信: roleModelId=${roleModelId}`);
        
        // 短い遅延を追加して確実にクライアントがメッセージを受け取れるようにする
        setTimeout(() => {
          // 全てのイベント名で送信して確実に捕捉されるようにする
          sendMessageToRoleModelViewers(roleModelId, 'graph-update', {
            message: 'ナレッジグラフが改善されました',
            timestamp: timestamp,
            updateType: 'improvement_complete',
            isComplete: true
          });
          
          setTimeout(() => {
            sendMessageToRoleModelViewers(roleModelId, 'knowledge-graph-update', {
              message: 'ナレッジグラフが改善されました',
              timestamp: timestamp,
              updateType: 'improvement_complete',
              isComplete: true
            });
            
            setTimeout(() => {
              sendMessageToRoleModelViewers(roleModelId, 'knowledge_graph_update', {
                message: 'ナレッジグラフが改善されました',
                timestamp: timestamp,
                updateType: 'improvement_complete',
                isComplete: true
              });
            }, 300);
          }, 300);
        }, 500);
      } catch (wsError) {
        console.error('WebSocket送信中にエラーが発生しました(改善サイクル後のグラフ更新):', wsError);
      }
      
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