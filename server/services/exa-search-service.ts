/**
 * Exa Search APIサービス
 * 情報検索と収集プランのための外部データ検索機能を提供
 */

import fetch from 'node-fetch';

// 検索カテゴリー
export type SearchCategory = 
  | 'web_search' 
  | 'news' 
  | 'academic' 
  | 'github' 
  | 'twitter' 
  | 'pdf' 
  | 'personal_site';

// 時間範囲
export type TimeRange = '1d' | '1w' | '1m' | '3m' | '1y' | 'all';

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
 * @param industry 業界
 * @param keywords キーワード
 * @returns 情報収集パターンのリスト
 */
export function generateCollectionPlanPatterns(industry: string, keywords: string[]): any[] {
  // 実際にはAIを使用してより適切なパターンを生成
  // ここではテンプレートベースのシンプルな実装
  
  const patterns = [];
  
  // 業界概要パターン
  patterns.push({
    id: `plan-industry-overview-${Date.now()}`,
    name: `${industry}業界の概要`,
    description: `${industry}業界の基本情報、市場規模、主要プレイヤーに関する情報を収集`,
    queries: [
      `${industry} 業界 概要`,
      `${industry} 市場規模`,
      `${industry} 主要企業`
    ],
    categories: ['web_search', 'news'],
    timeRange: '1y'
  });
  
  // トレンド分析パターン
  patterns.push({
    id: `plan-trends-${Date.now()}`,
    name: `${industry}のトレンド分析`,
    description: `${industry}における最新トレンド、技術革新、将来予測に関する情報を収集`,
    queries: [
      `${industry} 最新トレンド`,
      `${industry} 技術革新`,
      `${industry} 将来予測`
    ],
    categories: ['news', 'academic'],
    timeRange: '3m'
  });
  
  // キーワード関連パターン
  if (keywords && keywords.length > 0) {
    keywords.forEach((keyword, index) => {
      if (index < 3) { // 最大3つのキーワードのみ使用
        patterns.push({
          id: `plan-keyword-${keyword}-${Date.now()}`,
          name: `${keyword}に関する詳細分析`,
          description: `${industry}における${keyword}の重要性、応用事例、課題に関する情報を収集`,
          queries: [
            `${industry} ${keyword} 重要性`,
            `${industry} ${keyword} 応用事例`,
            `${industry} ${keyword} 課題`
          ],
          categories: ['web_search', 'academic', 'news'],
          timeRange: '6m'
        });
      }
    });
  }
  
  // 競合分析パターン
  patterns.push({
    id: `plan-competitors-${Date.now()}`,
    name: `${industry}の競合分析`,
    description: `${industry}における競合状況、主要企業の戦略、市場シェアに関する情報を収集`,
    queries: [
      `${industry} 競合分析`,
      `${industry} 企業戦略`,
      `${industry} 市場シェア`
    ],
    categories: ['news', 'web_search'],
    timeRange: '6m'
  });
  
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