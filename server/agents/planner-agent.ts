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
  
  // 進捗更新用のコールバック
  public onProgressUpdate: ((progressData: ProgressUpdate) => void) | null = null;

  constructor(roleModelId: string, userId: string) {
    this.roleModelId = roleModelId;
    this.userId = userId;
  }
  
  /**
   * 進捗を報告する
   * @param message メッセージ
   * @param progress 進捗率
   * @param stage ステージ
   * @param subStage サブステージ
   */
  private reportProgress(message: string, progress: number, stage: string, subStage: string = ''): void {
    const progressData: ProgressUpdate = {
      message,
      progress,
      stage,
      subStage
    };
    
    // WebSocketで進捗を送信
    sendProgressUpdate(
      message,
      progress,
      this.roleModelId,
      progressData
    );
    
    // コールバックが設定されていれば呼び出す
    if (this.onProgressUpdate) {
      this.onProgressUpdate(progressData);
    }
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
      this.reportProgress(
        '情報収集プラン作成エージェントを初期化しています',
        5,
        'planning',
        '初期化'
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
      this.reportProgress(
        `以下のツールが利用可能です: ${this.availableTools.join(', ')}`,
        10,
        'planning',
        'ツール確認'
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
      this.reportProgress(
        '情報収集戦略の策定を開始しています',
        20,
        'planning',
        '戦略策定'
      );

      // 簡易的なプラン概要を作成（実際はもっと複雑な処理が入る）
      const planOutline = {
        industries: industries.map(id => ({ id })),
        keywords: keywords.map(id => ({ id })),
        focusAreas: [
          {
            name: '業界動向',
            importance: 'high',
            keyTopics: ['市場トレンド', '技術革新', '規制環境'],
            recommendedTools: this.availableTools.filter(tool => 
              ['google_search', 'web_scraping', 'industry_reports'].includes(tool)
            )
          },
          {
            name: 'キーワード関連情報',
            importance: 'medium',
            keyTopics: ['事例研究', '実装例', '課題'],
            recommendedTools: this.availableTools.filter(tool => 
              ['google_search', 'web_scraping', 'social_media_analysis'].includes(tool)
            )
          }
        ]
      };

      // 進捗状況を更新
      this.reportProgress(
        '情報収集プラン概要が完成しました',
        40,
        'planning',
        '概要作成'
      );

      // 情報源を選択（実際はもっと複雑な処理が入る）
      const sources = this.selectInformationSources(planOutline.focusAreas);

      this.reportProgress(
        '情報源の選択が完了しました',
        50,
        'planning',
        '情報源選択'
      );

      // 検索クエリ（簡易版）
      const queries = [
        {
          query: `業界分析 ${industries[0]} 最新動向`,
          targetArea: '業界動向',
          expectedResults: '業界の最新動向と市場変化',
          recommendedSources: ['Google検索', '業界レポート']
        },
        {
          query: `${keywords.join(' ')} 事例研究 ケーススタディ`,
          targetArea: 'キーワード関連情報',
          expectedResults: '関連する成功事例や実装例',
          recommendedSources: ['Google検索', 'Webスクレイピング']
        }
      ];

      this.reportProgress(
        '効果的な検索クエリが作成されました',
        60,
        'planning',
        'クエリ作成'
      );

      // 詳細プラン
      const detailedPlan = {
        sources,
        queries,
        frequency: '日次',
        priorityOrder: ['業界動向', 'キーワード関連情報'],
        estimatedTime: '1-2時間/日'
      };

      this.reportProgress(
        '情報収集プランの詳細が完成しました',
        70,
        'planning',
        '詳細作成'
      );

      // 実行計画（簡易版）
      const executionPlan = {
        schedule: {
          daily: ['ニュース確認', 'RSS購読'],
          weekly: ['詳細分析', 'レポートまとめ'],
          monthly: ['トレンド分析', '方向性確認']
        },
        toolsUsage: this.availableTools.map(tool => ({
          name: tool,
          frequency: 'daily',
          priority: tool === 'google_search' ? 'high' : 'medium'
        }))
      };

      this.reportProgress(
        '情報収集の実行計画とスケジュールが完成しました',
        95,
        'planning',
        '実行計画作成'
      );

      // 最終的なプランを組み立て
      const finalPlan = {
        outline: planOutline,
        detailedPlan: detailedPlan,
        executionPlan: executionPlan,
        metadata: {
          createdAt: new Date().toISOString(),
          roleModelId: this.roleModelId,
          userId: this.userId,
          industries: industries.length,
          keywords: keywords.length
        }
      };

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
}