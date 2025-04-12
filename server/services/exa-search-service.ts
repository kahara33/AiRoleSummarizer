/**
 * Exa Search APIサービス
 * 情報検索と収集プランのための外部データ検索機能を提供
 * 添付資料の「Exa Search API 検索パターン例」を参考に拡張
 */

import fetch from 'node-fetch';

// 検索カテゴリー（拡張版）
export enum SearchCategory {
  // 基本カテゴリ
  WEB_SEARCH = 'web_search',
  NEWS = 'news',
  ACADEMIC = 'academic',
  GITHUB = 'github',
  TWITTER = 'twitter',
  PDF = 'pdf',
  PERSONAL_SITE = 'personal_site',
  
  // 特殊カテゴリ
  COMPANY_INFO = 'company_info',      // 企業情報
  PRODUCT_INFO = 'product_info',      // 製品情報
  TECHNOLOGY_TREND = 'tech_trend',    // 技術トレンド
  MARKET_ANALYSIS = 'market_analysis', // 市場分析
  COMPETITORS = 'competitors',        // 競合情報
  USE_CASES = 'use_cases',            // 活用事例
  CHALLENGES = 'challenges',          // 課題
  WHITEPAPER = 'whitepaper',          // ホワイトペーパー
  RESEARCH_PAPER = 'research_paper',  // 研究論文
}

// 時間範囲
export type TimeRange = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | 'all';

// 検索パラメータ
export interface SearchParams {
  query: string;
  numResults?: number;
  categoryFilters?: SearchCategory[];
  timeRange?: TimeRange;
  highlights?: boolean;
  useAutoprompt?: boolean;
}

// 検索結果
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  content: string;
  score: number;
  category?: string;
  publishedDate?: string;
  highlights?: string[];
  metadata?: Record<string, any>;
}

// 検索レスポンス
export interface SearchResponse {
  results: SearchResult[];
  autopromptString?: string;
  queryString?: string;
  status: 'success' | 'error';
  message?: string;
  error?: any;
}

/**
 * Exa Search APIを使用して検索を実行する
 * @param params 検索パラメータ
 * @returns 検索結果
 */
export async function searchWithExa(params: SearchParams): Promise<SearchResponse> {
  try {
    console.log('Exa Search API検索の実行:', params);
    
    // APIキーが設定されているか確認
    const exaApiKey = process.env.EXA_API_KEY;
    
    if (!exaApiKey) {
      console.error('Exa Search APIキーが設定されていません');
      return {
        results: [],
        status: 'error',
        message: 'APIキーが設定されていません',
        error: 'API_KEY_MISSING'
      };
    }
    
    // デモモードのシミュレーション結果
    // 実際にはAPIリクエストを行う
    
    // シミュレーション用のダミーデータ
    const dummyResults: SearchResult[] = [
      {
        id: `result-${Date.now()}-1`,
        title: `${params.query} に関する最新情報`,
        url: 'https://example.com/result1',
        content: `これは ${params.query} に関する重要な情報です。この分野では近年、革新的な進展が見られます。`,
        score: 0.95,
        category: 'web_search',
        publishedDate: new Date().toISOString(),
        highlights: [`${params.query} に関する重要な情報`]
      },
      {
        id: `result-${Date.now()}-2`,
        title: `${params.query} の市場分析`,
        url: 'https://example.com/result2',
        content: `${params.query} 市場は年率10%で成長しており、今後も拡大が見込まれています。主要企業は革新的な戦略を展開しています。`,
        score: 0.88,
        category: 'news',
        publishedDate: new Date(Date.now() - 86400000).toISOString(),
        highlights: [`${params.query} 市場は年率10%で成長`]
      },
      {
        id: `result-${Date.now()}-3`,
        title: `${params.query} における技術トレンド`,
        url: 'https://example.com/result3',
        content: `最新の技術トレンドでは、${params.query} において人工知能の活用が進んでいます。特に自然言語処理と機械学習の組み合わせが注目されています。`,
        score: 0.82,
        category: 'academic',
        publishedDate: new Date(Date.now() - 172800000).toISOString(),
        highlights: [`${params.query} において人工知能の活用が進んでいます`]
      }
    ];
    
    return {
      results: dummyResults,
      status: 'success',
      queryString: params.query,
      autopromptString: `${params.query} advanced techniques latest research`
    };
    
    // 実際のAPI呼び出し例（コメントアウト）
    /*
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${exaApiKey}`
      },
      body: JSON.stringify({
        query: params.query,
        num_results: params.numResults || 10,
        category_filters: params.categoryFilters || [],
        time_range: params.timeRange || 'all',
        highlights: params.highlights !== undefined ? params.highlights : true,
        use_autoprompt: params.useAutoprompt !== undefined ? params.useAutoprompt : false
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return {
      results: data.results,
      autopromptString: data.autoprompt_string,
      queryString: data.query_string,
      status: 'success'
    };
    */
  } catch (err: any) {
    const error = err as Error;
    console.error('Exa Search API検索エラー:', error);
    return {
      results: [],
      status: 'error',
      message: error.message || '検索中にエラーが発生しました',
      error: error.toString()
    };
  }
}

/**
 * 検索結果から要約を生成
 * @param results 検索結果
 * @param query 検索クエリ
 * @returns 要約
 */
export async function summarizeSearchResults(results: SearchResult[], query: string): Promise<string> {
  try {
    if (!results || results.length === 0) {
      return `「${query}」に関する検索結果はありませんでした。`;
    }
    
    // 実際にはLLMを使用して要約を生成
    // ここではシンプルな処理で代用
    
    const contentSamples = results
      .slice(0, 3) // 最大3つの結果を使用
      .map(result => result.highlights && result.highlights.length > 0 
        ? result.highlights[0] 
        : result.content.substring(0, 100)
      );
    
    return `
「${query}」に関する検索結果の要約:

1. ${results[0]?.title || 'N/A'}: ${contentSamples[0] || ''}

2. ${results[1]?.title || 'N/A'}: ${contentSamples[1] || ''}

3. ${results[2]?.title || 'N/A'}: ${contentSamples[2] || ''}

これらの情報源から、${query}に関する重要なポイントとして、
最新のトレンド、市場成長、および技術革新が挙げられます。
特に注目すべきは、人工知能やデータ分析の活用が進んでいる点です。
    `.trim();
  } catch (err: any) {
    const error = err as Error;
    console.error('検索結果要約エラー:', error);
    return `「${query}」に関する要約の生成中にエラーが発生しました。`;
  }
}

/**
 * 情報収集プランに関するパターンを生成する
 * 添付資料の「Exa Search API 検索パターン例」を参考に拡張実装
 * 
 * @param industry 業界
 * @param keywords キーワード
 * @returns 情報収集パターンのリスト
 */
/**
 * 情報収集プランのパターンを生成する
 * @param industry 業界名
 * @param keywords キーワード一覧
 * @param preferredTopics ユーザーが選択した好みのトピック（任意）
 * @returns 情報収集プランのパターン
 */
export function generateCollectionPlanPatterns(
  industry: string, 
  keywords: string[], 
  preferredTopics: string[] = []
): any[] {
  // 添付資料に基づく高度な検索パターンを実装
  const patterns = [];
  
  // ユーザーの好みに基づいて優先度を調整
  const getPriority = (patternType: string): 'high' | 'medium' | 'low' => {
    // 特定のパターンタイプにマッチするユーザー好みのトピックがあれば、優先度を高くする
    const priorities: Record<string, string[]> = {
      'industry-analysis': ['市場概要', '概要把握型'],
      'key-companies': ['主要プレイヤー分析', '比較分析型'],
      'tech-trends': ['技術トレンド', 'トレンド分析型'],
      'challenges-opportunities': ['課題と機会'],
      'regulatory': ['規制', '将来展望']
    };
    
    for (const [key, matchingTopics] of Object.entries(priorities)) {
      if (patternType === key && matchingTopics.some(topic => preferredTopics.includes(topic))) {
        return 'high';
      }
    }
    
    // デフォルトはmedium
    return 'medium';
  };
  
  // 業界分析パターン
  patterns.push({
    id: `plan-industry-analysis-${Date.now()}`,
    name: `${industry}業界の包括分析`,
    description: `${industry}業界の基本情報、市場規模、主要プレイヤー、最新トレンドに関する総合的な情報を収集`,
    queries: [
      `"${industry}" industry overview market size leading companies trends`,
      `"${industry}" 業界分析 市場規模 主要企業`,
      `"${industry}" recent developments future prospects`
    ],
    categories: [SearchCategory.WEB_SEARCH, SearchCategory.NEWS, SearchCategory.COMPANY_INFO],
    timeRange: '1y',
    executionPriority: getPriority('industry-analysis'),
    userPreferenceMatch: preferredTopics.some(topic => ['市場概要', '概要把握型'].includes(topic))
  });
  
  // 業界主要企業分析
  patterns.push({
    id: `plan-key-companies-${Date.now()}`,
    name: `${industry}主要企業分析`,
    description: `${industry}における主要企業の戦略、製品、サービス、市場ポジションを詳細に分析`,
    queries: [
      `"${industry}" "top companies" "market leaders" strategy`,
      `"${industry}" 主要企業 市場シェア 戦略`,
      `"${industry}" competitive landscape "company profiles"`,
      `"${industry}" leading companies financial performance`
    ],
    categories: [SearchCategory.COMPANY_INFO, SearchCategory.NEWS, SearchCategory.MARKET_ANALYSIS],
    timeRange: '1y',
    executionPriority: getPriority('key-companies'),
    userPreferenceMatch: preferredTopics.some(topic => ['主要プレイヤー分析', '比較分析型'].includes(topic))
  });
  
  // 最新技術トレンド分析
  patterns.push({
    id: `plan-tech-trends-${Date.now()}`,
    name: `${industry}における技術トレンド分析`,
    description: `${industry}における最新技術トレンド、革新、研究開発動向について詳細に調査`,
    queries: [
      `"${industry}" "emerging technologies" "innovation" "research and development"`,
      `"${industry}" 最新技術 イノベーション 研究開発`,
      `"${industry}" "technology adoption" "digital transformation"`,
      `"${industry}" technological breakthroughs "future trends"`
    ],
    categories: [SearchCategory.TECHNOLOGY_TREND, SearchCategory.RESEARCH_PAPER, SearchCategory.NEWS],
    timeRange: '6m',
    executionPriority: getPriority('tech-trends'),
    userPreferenceMatch: preferredTopics.some(topic => ['技術トレンド', 'トレンド分析型'].includes(topic))
  });
  
  // 市場課題と機会分析
  patterns.push({
    id: `plan-challenges-opportunities-${Date.now()}`,
    name: `${industry}の市場課題と機会`,
    description: `${industry}市場における主要な課題、リスク、将来の成長機会を特定`,
    queries: [
      `"${industry}" "market challenges" "risks" "barriers to entry"`,
      `"${industry}" 市場課題 リスク 参入障壁`,
      `"${industry}" "growth opportunities" "emerging markets"`,
      `"${industry}" "future outlook" "market potential"`
    ],
    categories: [SearchCategory.MARKET_ANALYSIS, SearchCategory.CHALLENGES, SearchCategory.NEWS],
    timeRange: '6m',
    executionPriority: getPriority('challenges-opportunities'),
    userPreferenceMatch: preferredTopics.some(topic => ['課題と機会'].includes(topic))
  });
  
  // 規制・法的環境分析
  patterns.push({
    id: `plan-regulatory-environment-${Date.now()}`,
    name: `${industry}の規制・法的環境`,
    description: `${industry}に影響を与える規制・法的フレームワーク、コンプライアンス要件、政策動向を調査`,
    queries: [
      `"${industry}" "regulations" "legal framework" "compliance requirements"`,
      `"${industry}" 規制 法的要件 コンプライアンス`,
      `"${industry}" "policy changes" "government initiatives"`,
      `"${industry}" "regulatory trends" "compliance challenges"`
    ],
    categories: [SearchCategory.NEWS, SearchCategory.CHALLENGES, SearchCategory.WHITEPAPER],
    timeRange: '1y',
    executionPriority: getPriority('regulatory'),
    userPreferenceMatch: preferredTopics.some(topic => ['規制', '将来展望'].includes(topic))
  });
  
  // キーワード関連分析（最大3つまで）
  if (keywords && keywords.length > 0) {
    keywords.forEach((keyword, index) => {
      if (index < 3) {
        patterns.push({
          id: `plan-keyword-${keyword.replace(/\s+/g, '-')}-${Date.now()}`,
          name: `${keyword}の詳細分析`,
          description: `${industry}における${keyword}の重要性、応用事例、最新技術、市場動向を詳細に調査`,
          queries: [
            `"${industry}" "${keyword}" "importance" "applications"`,
            `"${industry}" "${keyword}" "case studies" "best practices"`,
            `"${industry}" "${keyword}" "latest technologies" "innovations"`,
            `"${industry}" "${keyword}" "market trends" "future developments"`
          ],
          categories: [SearchCategory.USE_CASES, SearchCategory.TECHNOLOGY_TREND, SearchCategory.RESEARCH_PAPER],
          timeRange: '6m',
          executionPriority: 'high'
        });
      }
    });
  }
  
  // 特定のSaaSに関するカスタムパターン（Cloudキーワードが含まれる場合）
  if (keywords.some(k => k.toLowerCase().includes('cloud') || k.toLowerCase().includes('saas') || k.toLowerCase().includes('クラウド'))) {
    patterns.push({
      id: `plan-cloud-saas-${Date.now()}`,
      name: `クラウド/SaaSサービス最新動向`,
      description: `${industry}におけるクラウドコンピューティング、SaaS、プラットフォームサービスの最新動向と将来展望`,
      queries: [
        `"${industry}" "cloud computing" "SaaS" "platform services" "trends"`,
        `"${industry}" クラウドサービス SaaS プラットフォーム 最新動向`,
        `"${industry}" "cloud adoption" "digital transformation" "case studies"`,
        `"${industry}" "cloud providers" "market share" "competitive analysis"`
      ],
      categories: [SearchCategory.TECHNOLOGY_TREND, SearchCategory.COMPANY_INFO, SearchCategory.USE_CASES],
      timeRange: '6m',
      executionPriority: 'high'
    });
  }
  
  // 特定のAIに関するカスタムパターン（AIキーワードが含まれる場合）
  if (keywords.some(k => k.toLowerCase().includes('ai') || k.toLowerCase().includes('artificial intelligence') || k.toLowerCase().includes('人工知能'))) {
    patterns.push({
      id: `plan-ai-analysis-${Date.now()}`,
      name: `AI技術活用最前線`,
      description: `${industry}におけるAI技術の活用事例、最新研究、実装課題、将来展望を詳細に調査`,
      queries: [
        `"${industry}" "artificial intelligence" "AI applications" "machine learning" "use cases"`,
        `"${industry}" 人工知能 AI活用 機械学習 事例`,
        `"${industry}" "AI research" "deep learning" "latest developments"`,
        `"${industry}" "AI implementation challenges" "ethical considerations"`
      ],
      categories: [SearchCategory.TECHNOLOGY_TREND, SearchCategory.RESEARCH_PAPER, SearchCategory.USE_CASES],
      timeRange: '6m',
      executionPriority: 'high'
    });
  }
  
  return patterns;
}

/**
 * 情報収集プランから要約レポートを作成（実行結果をシミュレート）
 * @param plan 情報収集プラン
 * @returns 要約レポート
 */
export async function executeCollectionPlan(plan: any): Promise<any> {
  try {
    console.log(`情報収集プラン「${plan.name}」の実行開始`);
    
    const allResults = [];
    
    // 各クエリに対して検索を実行
    let lastSearchResults: SearchResponse | null = null;
    
    for (const query of plan.queries) {
      // 検索を実行
      const searchResults = await searchWithExa({
        query,
        numResults: 5,
        categoryFilters: plan.categories,
        timeRange: plan.timeRange,
        highlights: true
      });
      
      if (searchResults.status === 'success') {
        allResults.push(...searchResults.results);
        lastSearchResults = searchResults;
      }
    }
    
    // 検索結果の重複を排除
    const uniqueResults = allResults.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    );
    
    // 結果を要約
    const summary = await summarizeSearchResults(uniqueResults, plan.name);
    
    // レポートを作成
    const report = {
      id: `report-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      executedAt: new Date().toISOString(),
      summary,
      sources: lastSearchResults && lastSearchResults.results ? lastSearchResults.results.map((r: SearchResult) => ({
        title: r.title,
        url: r.url,
        publishedDate: r.publishedDate
      })) : [],
      keyInsights: [
        `${plan.name}に関する最新の動向`,
        `主要企業の取り組みと戦略`,
        `今後の課題と展望`
      ]
    };
    
    console.log(`情報収集プラン「${plan.name}」の実行完了、レポート作成`);
    return report;
  } catch (err: any) {
    const error = err as Error;
    console.error('情報収集プラン実行エラー:', error);
    return {
      id: `report-error-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      executedAt: new Date().toISOString(),
      error: error.message || '情報収集中にエラーが発生しました',
      status: 'error'
    };
  }
}