/**
 * Exa Search APIサービス
 * 情報検索と収集プランのための外部データ検索機能を提供
 */

import axios from 'axios';

// Exa Search API設定
const EXA_API_KEY = process.env.EXA_API_KEY;
const EXA_API_BASE_URL = 'https://api.exa.ai';

// 検索カテゴリタイプ
export type SearchCategory = 
  | 'web_search' 
  | 'news' 
  | 'academic' 
  | 'github' 
  | 'twitter' 
  | 'pdf' 
  | 'personal_site';

// 検索時間範囲
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

// 検索結果インターフェース
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

// 検索レスポンスインターフェース
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
    if (!EXA_API_KEY) {
      console.error('Exa API Key が設定されていません');
      return {
        results: [],
        status: 'error',
        message: 'API Key が設定されていません'
      };
    }

    console.log('Exa Search API 検索リクエスト:', params);

    const response = await axios.post(
      `${EXA_API_BASE_URL}/search`, 
      {
        query: params.query,
        num_results: params.numResults || 10,
        use_autoprompt: params.useAutoprompt || false,
        include_domains: [],
        exclude_domains: [],
        ...(params.categoryFilters && { type: params.categoryFilters }),
        ...(params.timeRange && { time_range: params.timeRange }),
        ...(params.highlights && { highlights: params.highlights })
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Exa-Api-Key': EXA_API_KEY
        }
      }
    );

    console.log(`Exa検索完了: ${response.data.results?.length || 0}件の結果`);

    return {
      results: response.data.results.map((result: any) => ({
        id: result.id,
        title: result.title,
        url: result.url,
        content: result.text || result.content || '',
        score: result.score || 0,
        category: result.category || 'web',
        publishedDate: result.published_date || result.publishedDate || null,
        highlights: result.highlights || [],
        metadata: result.metadata || {}
      })),
      autopromptString: response.data.autoprompt_string,
      queryString: response.data.query_string,
      status: 'success'
    };

  } catch (error: any) {
    console.error('Exa Search API エラー:', error.message, error.response?.data);
    return {
      results: [],
      status: 'error',
      message: `検索中にエラーが発生しました: ${error.message}`,
      error: error.response?.data || error.message
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
    // 実際にはここでOpenAIやAnthropicの要約APIを使用して要約を生成
    // 現在はダミー実装
    const resultsText = results.map(r => `- ${r.title}: ${r.content.substring(0, 150)}...`).join('\n');
    return `「${query}」の検索結果要約：\n\n${resultsText}\n\n以上が検索結果の要約です。`;
  } catch (error: any) {
    console.error('要約生成エラー:', error);
    return `要約を生成できませんでした。エラー: ${error.message}`;
  }
}

/**
 * 情報収集プランに関するパターンを生成する
 * @param industry 業界
 * @param keywords キーワード
 * @returns 情報収集パターンのリスト
 */
export function generateCollectionPlanPatterns(industry: string, keywords: string[]): any[] {
  // 検索パターンを生成
  const patterns = [];
  
  // 業界の最新トレンド（1週間）
  patterns.push({
    name: `${industry}業界の最新トレンド（直近1週間）`,
    description: `${industry}業界における最新のトレンドや動向を把握する`,
    searchParams: {
      query: `${industry} 最新 トレンド 動向`,
      categoryFilters: ['news', 'web_search'],
      timeRange: '1w',
      numResults: 10
    },
    frequency: 'weekly'
  });
  
  // 各キーワードの最新情報（1日）
  for (const keyword of keywords) {
    patterns.push({
      name: `${keyword}に関する最新情報（日次）`,
      description: `${keyword}に関する最新の情報やニュースを収集する`,
      searchParams: {
        query: `${keyword} 最新 news update`,
        categoryFilters: ['news', 'web_search'],
        timeRange: '1d',
        numResults: 5
      },
      frequency: 'daily'
    });
  }
  
  // 各キーワードの研究論文（月次）
  for (const keyword of keywords) {
    patterns.push({
      name: `${keyword}に関する最新研究（月次）`,
      description: `${keyword}に関する最新の研究論文や学術発表を収集する`,
      searchParams: {
        query: `${keyword} research paper latest development`,
        categoryFilters: ['academic', 'pdf'],
        timeRange: '1m',
        numResults: 5
      },
      frequency: 'monthly'
    });
  }
  
  // 業界の競合情報（週次）
  patterns.push({
    name: `${industry}業界の競合情報（週次）`,
    description: `${industry}業界における主要企業の競合情報を収集する`,
    searchParams: {
      query: `${industry} 競合 企業 市場シェア 比較`,
      categoryFilters: ['news', 'web_search'],
      timeRange: '1w',
      numResults: 5
    },
    frequency: 'weekly'
  });
  
  // オープンソースプロジェクト関連（隔週）
  const techKeywords = keywords.join(' OR ');
  patterns.push({
    name: `関連技術のオープンソースプロジェクト（隔週）`,
    description: `関連する技術のオープンソースプロジェクトの最新動向を把握する`,
    searchParams: {
      query: `${techKeywords} github opensource project`,
      categoryFilters: ['github'],
      timeRange: '2w',
      numResults: 5
    },
    frequency: 'biweekly'
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
    // 実際にはここで情報収集プランに従ってExa検索APIを呼び出して結果を取得
    // 現在はシミュレーション実装
    
    // 検索実行
    const searchResults = await searchWithExa(plan.searchParams);
    
    // 結果が取得できた場合は要約を生成
    if (searchResults.status === 'success' && searchResults.results.length > 0) {
      const summary = await summarizeSearchResults(
        searchResults.results, 
        plan.searchParams.query
      );
      
      return {
        planId: plan.id || `plan-${Date.now()}`,
        planName: plan.name,
        executedAt: new Date().toISOString(),
        searchQuery: plan.searchParams.query,
        resultCount: searchResults.results.length,
        sources: searchResults.results.map((r: SearchResult) => ({
          title: r.title,
          url: r.url,
          publishedDate: r.publishedDate
        })),
        summary,
        status: 'completed'
      };
    } else {
      // 検索結果がない場合
      return {
        planId: plan.id || `plan-${Date.now()}`,
        planName: plan.name,
        executedAt: new Date().toISOString(),
        searchQuery: plan.searchParams.query,
        resultCount: 0,
        sources: [],
        summary: '検索結果が見つかりませんでした。',
        status: 'no_results'
      };
    }
  } catch (error: any) {
    console.error('情報収集プラン実行エラー:', error);
    return {
      planId: plan.id || `plan-${Date.now()}`,
      planName: plan.name,
      executedAt: new Date().toISOString(),
      searchQuery: plan.searchParams.query,
      status: 'error',
      error: error.message
    };
  }
}