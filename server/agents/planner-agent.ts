import { sendProgressUpdate, sendAgentThoughts, sendErrorMessage, sendCompletionMessage } from '../websocket';
import { callAzureOpenAI } from '../azure-openai';
import { getUserSubscriptionTools } from '../subscription-tools';
import { IndustryAnalysisAgent } from './industry-analysis-agent';
import { KeywordExpansionAgent } from './keyword-expansion-agent';
import { KnowledgeNode } from '@shared/schema';
import { db } from '../db';

// 進捗更新用の型定義
type ProgressUpdate = {
  message: string;
  progress: number;
  stage: string;
  subStage: string;
};

export class PlannerAgent {
  private roleModelId: string;
  private userId: string;
  private availableTools: string[] = [];

  constructor(roleModelId: string, userId: string) {
    this.roleModelId = roleModelId;
    this.userId = userId;
  }

  /**
   * 情報収集プランを作成する
   * @param industries 業界IDs
   * @param keywords キーワードIDs
   * @param knowledgeNodes 知識グラフノード
   * @returns 情報収集プラン
   */
  async createInformationCollectionPlan(
    industries: string[],
    keywords: string[],
    knowledgeNodes: KnowledgeNode[]
  ): Promise<any> {
    try {
      console.log(`情報収集プラン作成開始 - RoleModelID: ${this.roleModelId}, UserID: ${this.userId}`);
      console.log(`入力データ - 業界: ${industries.length}件, キーワード: ${keywords.length}件, ノード: ${knowledgeNodes.length}件`);
      
      // 進捗状況を更新
      sendProgressUpdate(
        '情報収集プランの作成を開始',
        5,
        this.roleModelId,
        {
          message: '情報収集プラン作成エージェントを初期化しています',
          progress: 5,
          stage: 'planning',
          subStage: '初期化'
        }
      );

      // ユーザーの購読プランに基づいて利用可能なツールを取得
      try {
        this.availableTools = await getUserSubscriptionTools(this.userId);
        console.log(`利用可能ツール取得成功: ${this.availableTools.join(', ')}`);
      } catch (toolError) {
        console.error('ツール取得エラー:', toolError);
        // エラーがあってもデフォルトのツールセットで継続
        this.availableTools = ['google_search', 'web_scraping', 'rss_feeds'];
        
        // 警告メッセージを送信
        sendAgentThoughts(
          '情報収集プランナー',
          `警告: ユーザーの購読情報取得中にエラーが発生しました。デフォルトのツールセットを使用します: ${this.availableTools.join(', ')}`,
          this.roleModelId,
          {
            stage: 'planning',
            subStage: 'エラー検出'
          }
        );
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        '利用可能なツールを確認',
        10,
        this.roleModelId,
        {
          message: `以下のツールが利用可能です: ${this.availableTools.join(', ')}`,
          progress: 10,
          stage: 'planning',
          subStage: 'ツール確認'
        }
      );

      // 入力データの検証
      if (!industries || industries.length === 0) {
        console.error('業界データが不足しています');
        sendErrorMessage(
          '情報収集プラン作成エラー: 業界データが不足しています',
          this.roleModelId,
          { stage: 'planning', subStage: 'データ検証' }
        );
        throw new Error('業界データが不足しています');
      }

      if (!keywords || keywords.length === 0) {
        console.error('キーワードデータが不足しています');
        sendErrorMessage(
          '情報収集プラン作成エラー: キーワードデータが不足しています',
          this.roleModelId,
          { stage: 'planning', subStage: 'データ検証' }
        );
        throw new Error('キーワードデータが不足しています');
      }

      if (!knowledgeNodes || knowledgeNodes.length === 0) {
        console.error('知識グラフノードが不足しています');
        sendErrorMessage(
          '情報収集プラン作成エラー: 知識グラフノードが不足しています',
          this.roleModelId,
          { stage: 'planning', subStage: 'データ検証' }
        );
        throw new Error('知識グラフノードが不足しています');
      }

      // 業界分析用のノードを取得
      const industryNodes = knowledgeNodes.filter(
        node => node.type === 'Industry' || node.type === 'BusinessFunction'
      );
      
      // キーワード関連のノードを取得
      const keywordNodes = knowledgeNodes.filter(
        node => node.type === 'Keyword' || node.type === 'Technology' || node.type === 'Concept'
      );

      if (industryNodes.length === 0) {
        console.warn('業界関連ノードが見つかりません');
        sendAgentThoughts(
          '情報収集プランナー',
          '警告: 業界関連ノードが見つかりません。汎用的な情報収集計画を生成します。',
          this.roleModelId,
          {
            stage: 'planning',
            subStage: 'データ検証'
          }
        );
      }

      // 進捗状況を更新
      sendProgressUpdate(
        '情報収集戦略の策定',
        20,
        this.roleModelId,
        {
          message: '役割モデルと知識グラフに基づく最適な情報収集戦略を策定中',
          progress: 20,
          stage: 'planning',
          subStage: '戦略策定'
        }
      );

      // 情報収集プランの大枠を作成
      let planOutline;
      try {
        console.log('プラン概要作成開始');
        planOutline = await this.createPlanOutline(industries, keywords, knowledgeNodes);
        console.log('プラン概要作成完了');
      } catch (outlineError) {
        console.error('プラン概要作成エラー:', outlineError);
        sendErrorMessage(
          `情報収集プラン概要作成エラー: ${outlineError instanceof Error ? outlineError.message : '不明なエラー'}`,
          this.roleModelId
        );
        throw outlineError;
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        '情報収集プラン概要完成',
        40,
        this.roleModelId,
        {
          message: '情報収集プランの概要が完成しました',
          progress: 40, 
          stage: 'planning',
          subStage: '概要作成'
        }
      );

      // 詳細計画の作成
      let detailedPlan;
      try {
        console.log('詳細プラン作成開始');
        detailedPlan = await this.createDetailedPlan(planOutline, industryNodes, keywordNodes);
        console.log('詳細プラン作成完了');
      } catch (detailError) {
        console.error('詳細プラン作成エラー:', detailError);
        sendErrorMessage(
          `情報収集プラン詳細作成エラー: ${detailError instanceof Error ? detailError.message : '不明なエラー'}`,
          this.roleModelId
        );
        throw detailError;
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        '情報収集プラン詳細完成',
        70,
        this.roleModelId,
        {
          message: '情報収集プランの詳細が完成しました',
          progress: 70,
          stage: 'planning',
          subStage: '詳細作成'
        }
      );

      // 実行計画とスケジュールの作成
      let executionPlan;
      try {
        console.log('実行プラン作成開始');
        executionPlan = await this.createExecutionPlan(detailedPlan);
        console.log('実行プラン作成完了');
      } catch (execError) {
        console.error('実行プラン作成エラー:', execError);
        sendErrorMessage(
          `情報収集プラン実行計画作成エラー: ${execError instanceof Error ? execError.message : '不明なエラー'}`,
          this.roleModelId
        );
        throw execError;
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        '情報収集プラン完成',
        95,
        this.roleModelId,
        {
          message: '情報収集プランの実行計画とスケジュールが完成しました',
          progress: 95,
          stage: 'planning',
          subStage: '実行計画作成'
        }
      );

      // 最終的なプランを組み立て
      const finalPlan = {
        outline: planOutline,
        detailedPlan: detailedPlan,
        executionPlan: executionPlan,
        createdAt: new Date().toISOString(),
        tools: this.availableTools,
      };
      
      // 最終的な思考メッセージを送信
      sendAgentThoughts(
        '情報収集プランナー',
        `情報収集プランの作成が完了しました。役割モデルに関連する情報を効率的に収集するための包括的なプランを策定しました。このプランには焦点領域の特定、最適な情報源の選択、詳細なクエリ生成、および効果的な実行計画が含まれています。`,
        this.roleModelId,
        {
          stage: 'planning',
          subStage: 'プラン完成'
        }
      );

      // 完了メッセージを送信
      sendCompletionMessage(
        '情報収集プランが正常に作成されました',
        this.roleModelId,
        {
          planSummary: {
            industries: planOutline.industries.length,
            keywords: planOutline.keywords.length,
            focusAreas: planOutline.focusAreas.length,
            sources: detailedPlan.sources.length,
            queries: detailedPlan.queries.length
          }
        }
      );

      console.log('情報収集プラン作成が完了しました');
      return finalPlan;

    } catch (error) {
      console.error('情報収集プラン作成エラー:', error);
      
      // エラー状況を更新
      sendErrorMessage(
        `情報収集プラン作成エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        this.roleModelId,
        {
          details: error instanceof Error ? error.stack : '詳細不明',
          timestamp: new Date().toISOString()
        }
      );
      
      throw error;
    }
  }

  /**
   * プランの概要を作成する
   */
  private async createPlanOutline(
    industries: string[],
    keywords: string[],
    knowledgeNodes: KnowledgeNode[]
  ): Promise<any> {
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      '業界分析を開始します。選択された業界に関する詳細情報を収集し、主要なトレンドと市場構造を特定します。',
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '業界分析開始'
      }
    );
    
    // 業界分析エージェントの初期化と実行
    const industryAgent = new IndustryAnalysisAgent(this.roleModelId);
    const industryAnalysis = await industryAgent.analyzeIndustries(industries);
    
    // 進捗状況を更新
    sendProgressUpdate(
      '業界分析完了',
      25,
      this.roleModelId,
      {
        message: '役割モデルに関連する業界の分析が完了しました',
        progress: 25,
        stage: 'planning',
        subStage: '業界分析'
      }
    );
    
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      `業界分析が完了しました。${industries.length}つの業界について詳細な市場情報を取得しました。次にキーワード拡張を開始します。`,
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '業界分析完了'
      }
    );
    
    // キーワード拡張エージェントの初期化と実行
    const keywordAgent = new KeywordExpansionAgent(this.roleModelId);
    const expandedKeywords = await keywordAgent.expandKeywords(keywords, industryAnalysis);
    
    // 進捗状況を更新
    sendProgressUpdate(
      'キーワード拡張完了',
      30,
      this.roleModelId,
      {
        message: 'キーワードの拡張と関連付けが完了しました',
        progress: 30,
        stage: 'planning',
        subStage: 'キーワード拡張'
      }
    );
    
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      `キーワード拡張が完了しました。${expandedKeywords.length}個の関連キーワードを特定しました。次に情報収集の戦略を立案します。`,
      this.roleModelId,
      {
        stage: 'planning',
        subStage: 'キーワード拡張完了'
      }
    );

    // ノード間の関連性分析
    const nodeRelationships = this.analyzeNodeRelationships(knowledgeNodes);
    
    // プラン概要の作成
    const planOutline = {
      industries: industryAnalysis,
      keywords: expandedKeywords,
      relationships: nodeRelationships,
      focusAreas: this.identifyFocusAreas(nodeRelationships, industryAnalysis, expandedKeywords),
    };
    
    return planOutline;
  }

  /**
   * ノード間の関連性を分析する
   */
  private analyzeNodeRelationships(nodes: KnowledgeNode[]): any {
    // 実際の実装ではノード間の関連性をより詳細に分析する
    const centralNodes = nodes
      .filter(node => node.level <= 1) // レベル0と1のノードを中心ノードとして扱う
      .map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        level: node.level,
        childCount: nodes.filter(n => n.parentId === node.id).length,
        importance: node.level === 0 ? 'very high' : 'high'
      }));
    
    const relationships = {
      centralNodes: centralNodes,
      clusters: this.identifyClusters(nodes),
    };
    
    return relationships;
  }

  /**
   * ノードクラスターを識別する
   */
  private identifyClusters(nodes: KnowledgeNode[]): any[] {
    // ノードタイプによるクラスタリング (実際にはもっと複雑なアルゴリズムを使用)
    const typeSet = new Set<string>();
    nodes.forEach(node => {
      if (node.type) {
        typeSet.add(node.type);
      }
    });
    const types = Array.from(typeSet);
    
    return types.map(type => ({
      type,
      nodes: nodes.filter(node => node.type === type).map(node => ({
        id: node.id,
        name: node.name,
        level: node.level
      })),
      relevance: type === 'Industry' || type === 'BusinessFunction' ? 'high' : 'medium'
    }));
  }

  /**
   * 重点収集領域を特定する
   */
  private identifyFocusAreas(nodeRelationships: any, industryAnalysis: any, expandedKeywords: any): any[] {
    // 簡易的な実装 (実際はもっと複雑なロジックになる)
    const focusAreas = [
      {
        name: '業界動向',
        importance: 'high',
        keyTopics: industryAnalysis.slice(0, 3).map((i: any) => i.name || i),
        recommendedTools: this.availableTools.filter(tool => 
          ['google_search', 'web_scraping', 'industry_reports', 'academic_databases'].includes(tool)
        )
      },
      {
        name: 'キーワード関連情報',
        importance: 'medium',
        keyTopics: expandedKeywords.slice(0, 5).map((k: any) => k.name || k),
        recommendedTools: this.availableTools.filter(tool => 
          ['google_search', 'web_scraping', 'social_media_analysis'].includes(tool)
        )
      },
      {
        name: '競合分析',
        importance: 'high',
        keyTopics: ['競合戦略', 'マーケットシェア', '差別化要因'],
        recommendedTools: this.availableTools.filter(tool => 
          ['web_scraping', 'industry_reports', 'news_api'].includes(tool)
        )
      }
    ];
    
    return focusAreas;
  }

  /**
   * 詳細計画を作成する
   */
  private async createDetailedPlan(planOutline: any, industryNodes: KnowledgeNode[], keywordNodes: KnowledgeNode[]): Promise<any> {
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      '情報収集の詳細計画を策定します。まず、利用可能なツールを基に最適な情報源を選択します。',
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '詳細計画開始'
      }
    );
    
    // 利用可能なツールに基づいて情報源を選択
    const sources = this.selectInformationSources(planOutline.focusAreas);
    
    // 進捗状況を更新
    sendProgressUpdate(
      '情報源の選択完了',
      50,
      this.roleModelId,
      {
        message: '各収集領域に最適な情報源の選択が完了しました',
        progress: 50,
        stage: 'planning',
        subStage: '情報源選択'
      }
    );
    
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      `情報源の選択が完了しました。利用可能なツールから${sources.length}種類の情報源を特定しました。次に効果的な検索クエリと戦略を策定します。`,
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '情報源選択完了'
      }
    );
    
    // クエリと検索戦略の作成
    const queries = await this.generateQueries(
      industryNodes, 
      keywordNodes, 
      planOutline.industries, 
      planOutline.keywords
    );
    
    // 進捗状況を更新
    sendProgressUpdate(
      'クエリと検索戦略完了',
      60,
      this.roleModelId,
      {
        message: '効果的な検索クエリと戦略の作成が完了しました',
        progress: 60,
        stage: 'planning',
        subStage: 'クエリ作成'
      }
    );
    
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      `検索クエリの作成が完了しました。${queries.length}個の効果的な検索クエリを生成し、それぞれ最適な情報源と紐づけました。`,
      this.roleModelId,
      {
        stage: 'planning',
        subStage: 'クエリ作成完了'
      }
    );
    
    // 詳細計画の作成
    const detailedPlan = {
      sources: sources,
      queries: queries,
      prioritizedTopics: this.prioritizeTopics(planOutline.focusAreas, industryNodes, keywordNodes),
    };
    
    return detailedPlan;
  }

  /**
   * 情報源を選択する
   */
  private selectInformationSources(focusAreas: any[]): any[] {
    const sources: any[] = [];
    
    // 利用可能なツールに基づいて情報源を追加
    if (this.availableTools.includes('google_search')) {
      sources.push({
        name: 'Google検索',
        type: 'web_search',
        coverage: ['業界動向', 'キーワード関連情報', '競合分析'],
        usage: 'primary',
        limitations: 'パブリックに利用可能な情報のみ'
      });
    }
    
    if (this.availableTools.includes('web_scraping')) {
      sources.push({
        name: 'Webスクレイピング',
        type: 'automated_collection',
        coverage: ['業界動向', 'キーワード関連情報', '競合分析'],
        usage: 'primary',
        limitations: '構造化されていないデータの扱いが難しい'
      });
    }
    
    if (this.availableTools.includes('rss_feeds')) {
      sources.push({
        name: 'RSSフィード',
        type: 'automated_collection',
        coverage: ['業界動向', 'ニュース'],
        usage: 'secondary',
        limitations: 'RSSを提供しているサイトのみ'
      });
    }
    
    if (this.availableTools.includes('social_media_analysis')) {
      sources.push({
        name: 'ソーシャルメディア分析',
        type: 'trend_analysis',
        coverage: ['業界動向', '消費者反応', 'トレンド'],
        usage: 'supplementary',
        limitations: 'バイアスや信頼性の問題あり'
      });
    }
    
    if (this.availableTools.includes('video_platforms')) {
      sources.push({
        name: '動画プラットフォーム',
        type: 'multimedia',
        coverage: ['トレンド', '製品デモ', '専門家の見解'],
        usage: 'supplementary',
        limitations: 'コンテンツの質にばらつきあり'
      });
    }
    
    if (this.availableTools.includes('academic_databases')) {
      sources.push({
        name: '学術データベース',
        type: 'research',
        coverage: ['最新研究', '専門知識', '技術動向'],
        usage: 'primary',
        limitations: 'アクセスに制限がある可能性'
      });
    }
    
    if (this.availableTools.includes('industry_reports')) {
      sources.push({
        name: '業界レポート',
        type: 'professional_analysis',
        coverage: ['市場調査', '産業動向', '詳細な分析'],
        usage: 'primary',
        limitations: '高コストまたはアクセス制限あり'
      });
    }
    
    return sources;
  }

  /**
   * 検索クエリを生成する
   */
  private async generateQueries(
    industryNodes: KnowledgeNode[], 
    keywordNodes: KnowledgeNode[],
    industries: any[],
    keywords: any[]
  ): Promise<any[]> {
    // クエリ生成用のプロンプト作成
    const prompt = `
以下の業界とキーワードに関する効果的な検索クエリを5つ生成してください。
結果はJSON形式で返してください。

業界:
${industryNodes.map(node => node.name).join(', ')}

キーワード:
${keywordNodes.map(node => node.name).join(', ')}

必要な出力フォーマット:
{
  "queries": [
    {
      "query": "検索クエリ文字列",
      "targetArea": "対象収集領域",
      "expectedResults": "期待される結果の説明",
      "recommendedSources": ["情報源1", "情報源2"]
    },
    ...
  ]
}
`;

    try {
      // Azure OpenAIを使用してクエリを生成
      const response = await callAzureOpenAI([
        {
          role: 'system',
          content: 'あなたは情報収集の専門家です。効果的な検索クエリを生成してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], 0.7, 1000);
      
      // レスポンスからJSONを抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/```\n([\s\S]*?)\n```/) || 
                        response.match(/({[\s\S]*})/);
      
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]).queries;
        } catch (e) {
          console.error('JSON解析エラー:', e);
          // フォールバック: シンプルなクエリセットを返す
          return this.generateFallbackQueries(industryNodes, keywordNodes);
        }
      } else {
        console.error('JSON形式のレスポンスを抽出できませんでした');
        return this.generateFallbackQueries(industryNodes, keywordNodes);
      }
    } catch (error) {
      console.error('クエリ生成エラー:', error);
      return this.generateFallbackQueries(industryNodes, keywordNodes);
    }
  }

  /**
   * フォールバックのシンプルなクエリを生成
   */
  private generateFallbackQueries(industryNodes: KnowledgeNode[], keywordNodes: KnowledgeNode[]): any[] {
    const industries = industryNodes.slice(0, 2).map(node => node.name);
    const keywords = keywordNodes.slice(0, 3).map(node => node.name);
    
    const queries = [
      {
        query: `${industries[0] || '業界'} ${keywords[0] || 'トレンド'} 最新動向`,
        targetArea: '業界動向',
        expectedResults: '業界の最新動向と市場変化',
        recommendedSources: ['Google検索', '業界レポート']
      },
      {
        query: `${keywords.join(' ')} 事例研究 ケーススタディ`,
        targetArea: 'キーワード関連情報',
        expectedResults: '関連する成功事例や実装例',
        recommendedSources: ['Google検索', 'Webスクレイピング']
      },
      {
        query: `${industries[0] || '業界'} 主要企業 比較 分析`,
        targetArea: '競合分析',
        expectedResults: '主要企業の戦略と市場ポジション',
        recommendedSources: ['業界レポート', 'Webスクレイピング']
      }
    ];
    
    return queries;
  }

  /**
   * トピックを優先順位付けする
   */
  private prioritizeTopics(focusAreas: any[], industryNodes: KnowledgeNode[], keywordNodes: KnowledgeNode[]): any[] {
    // 重要度に基づいてトピックを優先順位付け
    const prioritizedTopics = [
      ...industryNodes.slice(0, 3).map(node => ({
        name: node.name,
        type: 'industry',
        priority: 'high',
        rationale: '主要業界として直接関連性が高い'
      })),
      ...keywordNodes
        .filter(node => node.level <= 1)
        .slice(0, 5)
        .map(node => ({
          name: node.name,
          type: 'keyword',
          priority: node.level === 0 ? 'high' : 'medium',
          rationale: node.level === 0 ? '中心的なキーワード' : '関連する重要キーワード'
        }))
    ];
    
    return prioritizedTopics;
  }

  /**
   * 実行計画とスケジュールを作成する
   */
  private async createExecutionPlan(detailedPlan: any): Promise<any> {
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      '情報収集の実行計画とスケジュールを策定します。収集すべき情報の優先順位とタイムラインを設定します。',
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '実行計画開始'
      }
    );
    
    // 実行計画の作成
    const executionSteps = [
      {
        step: 1,
        name: '初期リサーチ',
        description: '基本的な業界動向と主要キーワードに関する幅広い情報収集',
        sources: ['Google検索', 'Webスクレイピング'],
        queries: detailedPlan.queries.slice(0, 2),
        timeEstimate: '1-2日',
        priority: 'high'
      },
      {
        step: 2,
        name: '深堀り調査',
        description: '重点分野に関する詳細調査と専門情報の収集',
        sources: this.availableTools.includes('academic_databases') ? 
                ['学術データベース', '業界レポート'] : ['Webスクレイピング', 'RSSフィード'],
        queries: detailedPlan.queries.slice(2),
        timeEstimate: '2-3日',
        priority: 'high'
      },
      {
        step: 3,
        name: '最新情報モニタリング',
        description: '継続的な情報更新と新しい動向のチェック',
        sources: this.availableTools.includes('rss_feeds') ? 
                ['RSSフィード', 'ソーシャルメディア分析'] : ['Google検索', 'Webスクレイピング'],
        timeEstimate: '継続的',
        priority: 'medium'
      }
    ];
    
    // スケジュール作成
    const schedule = {
      totalDuration: '5-7日（初期収集）+ 継続的モニタリング',
      phases: [
        {
          name: '準備フェーズ',
          duration: '1日',
          tasks: ['情報源の設定', '検索クエリの最適化']
        },
        {
          name: '主要収集フェーズ',
          duration: '3-5日',
          tasks: ['初期リサーチの実行', '深堀り調査の実施', '情報の整理と分析']
        },
        {
          name: '継続モニタリングフェーズ',
          duration: '継続的',
          tasks: ['定期的な最新情報のチェック', '新しいソースの追加', '収集戦略の調整']
        }
      ]
    };
    
    // 実行計画の組み立て
    const executionPlan = {
      steps: executionSteps,
      schedule: schedule,
      toolUsageStrategy: this.createToolUsageStrategy(),
      successMetrics: [
        '収集情報の網羅性 (業界の主要側面をカバー)',
        '情報の新鮮さ (過去6ヶ月以内のデータが50%以上)',
        '情報源の多様性 (少なくとも3種類以上の情報源を活用)'
      ]
    };
    
    // エージェントの思考プロセスを送信
    sendAgentThoughts(
      '情報収集プランナー',
      `情報収集の実行計画とスケジュールが完成しました。${executionSteps.length}段階の収集ステップと${executionPlan.toolUsageStrategy.length}種類のツール戦略を策定しました。`,
      this.roleModelId,
      {
        stage: 'planning',
        subStage: '実行計画完了'
      }
    );
    
    return executionPlan;
  }

  /**
   * ツール使用戦略を作成する
   */
  private createToolUsageStrategy(): any {
    // 利用可能なツールに基づいて戦略を作成
    const strategies: any[] = [];
    
    if (this.availableTools.includes('google_search')) {
      strategies.push({
        tool: 'Google検索',
        usage: '初期情報収集と幅広いトピックの探索',
        searchTips: [
          '引用符を使用した完全一致検索',
          'site:指定子を使用して特定ドメインの情報を取得',
          'filetype:指定子でPDFやプレゼンテーションを探す'
        ]
      });
    }
    
    if (this.availableTools.includes('web_scraping')) {
      strategies.push({
        tool: 'Webスクレイピング',
        usage: '定期的なデータ収集と構造化情報の抽出',
        implementationTips: [
          '主要なニュースサイトやブログからの定期的な情報取得',
          '競合他社のウェブサイトからの製品・サービス情報収集',
          '複数ソースからのデータ統合と比較分析'
        ]
      });
    }
    
    if (this.availableTools.includes('rss_feeds')) {
      strategies.push({
        tool: 'RSSフィード',
        usage: 'リアルタイムの業界ニュースモニタリング',
        recommendedFeeds: [
          '業界専門メディアのRSSフィード',
          '主要企業の公式ブログフィード',
          '専門家やアナリストのブログフィード'
        ]
      });
    }
    
    // Premium/Standardプラン向けのツール
    if (this.availableTools.includes('social_media_analysis')) {
      strategies.push({
        tool: 'ソーシャルメディア分析',
        usage: 'トレンド把握と消費者反応の分析',
        platformFocus: [
          'Twitter: 最新のトレンドと速報',
          'LinkedIn: 業界関係者の見解と専門的議論',
          'Reddit: 特定分野の詳細な議論とコミュニティ反応'
        ]
      });
    }
    
    if (this.availableTools.includes('video_platforms')) {
      strategies.push({
        tool: '動画プラットフォーム',
        usage: '専門家のデモやインタビュー、詳細解説の収集',
        channelTypes: [
          '業界カンファレンスのセッション記録',
          '専門家による解説チャンネル',
          '企業の公式デモや事例紹介'
        ]
      });
    }
    
    // Premiumプラン専用ツール
    if (this.availableTools.includes('academic_databases')) {
      strategies.push({
        tool: '学術データベース',
        usage: '最新研究と科学的根拠に基づく情報収集',
        databases: [
          'Google Scholar: 幅広い学術論文の初期検索',
          '専門データベース: 分野固有の詳細研究',
          'ArXiv: 最新のプレプリント論文取得'
        ]
      });
    }
    
    if (this.availableTools.includes('industry_reports')) {
      strategies.push({
        tool: '業界レポート',
        usage: '詳細な市場分析と予測データの取得',
        reportSources: [
          '市場調査会社の公開レポート',
          '業界団体や政府機関の発行資料',
          '投資家向け分析レポートのサマリー'
        ]
      });
    }
    
    return strategies;
  }
}