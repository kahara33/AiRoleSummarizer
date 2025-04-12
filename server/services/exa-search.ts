/**
 * Exa検索APIサービス
 * Exaを使用してウェブ検索と情報収集を行う機能を提供
 */
import fetch from 'node-fetch';
import { db } from '../db';
import { collectionSources, collectionSummaries } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { sendProgressUpdate } from '../websocket';

/**
 * Exa検索のオプション定義
 */
export interface ExaSearchOptions {
  query: string;
  numResults?: number;
  maxDocuments?: number;
  highlights?: boolean;
  useAutoprompt?: boolean;
  type?: 'keyword' | 'neural' | 'hybrid';
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  useCache?: boolean; // キャッシュを使用するかどうか（実際のAPIに送信されず、ローカル処理のみで使用）
}

/**
 * Exa検索結果アイテム定義
 */
export interface ExaSearchResult {
  id: string;
  url: string;
  title: string;
  text: string;
  highlights?: string[];
  score?: number;
  publishedDate?: string;
  author?: string;
  source?: string;
}

/**
 * Exa検索レスポンス定義
 */
export interface ExaSearchResponse {
  results: ExaSearchResult[];
  autoprompt?: string;
  queryID?: string;
}

/**
 * Exa検索APIを使用して検索を実行する
 * @param options 検索オプション
 * @param roleModelId ロールモデルID (WebSocket通信用)
 * @returns 検索結果
 */
export async function searchWithExa(
  options: ExaSearchOptions,
  roleModelId?: string
): Promise<{
  sources: ExaSearchResult[];
  summary: string;
}> {
  try {
    // Exa API Key の取得
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      console.error('EXA_API_KEY is not defined in environment variables');
      
      // エラー通知
      if (roleModelId) {
        sendProgressUpdate(roleModelId, 100, {
          type: 'error',
          message: 'Exa API Keyが設定されていません'
        });
      }
      
      return { sources: [], summary: '' };
    }
    
    // 進捗更新
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 30, '検索クエリを実行中...');
    }

    // 検索オプションの設定
    const searchOptions: ExaSearchOptions = {
      query: options.query,
      numResults: options.numResults || 10,
      highlights: options.highlights !== undefined ? options.highlights : true,
      useAutoprompt: options.useAutoprompt !== undefined ? options.useAutoprompt : false,
      type: options.type || 'hybrid',
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      startPublishedDate: options.startPublishedDate,
      endPublishedDate: options.endPublishedDate
    };

    // デバッグログ：検索リクエスト情報
    console.log(`Exa検索実行: クエリ="${options.query}", 結果件数=${options.numResults}`);
    console.log('検索オプション:', JSON.stringify(searchOptions));
    
    // Exa API へのリクエスト
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(searchOptions)
    });

    // レスポンスのチェック
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Exa API error: ${response.status} - ${errorText}`);
      
      // エラー通知
      if (roleModelId) {
        sendProgressUpdate(roleModelId, 100, {
          type: 'error',
          message: `検索APIエラー: ${response.status}`
        });
      }
      
      return { sources: [], summary: '' };
    }

    // JSONレスポンスのパース
    const data = await response.json() as ExaSearchResponse;
    
    // 進捗更新
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 50, `${data.results.length}件の検索結果を処理中...`);
    }

    // コンテンツの取得（必要に応じて）
    if (options.maxDocuments && options.maxDocuments > 0) {
      // URLのリスト作成
      const urls = data.results.slice(0, options.maxDocuments).map(r => r.url);
      
      try {
        // コンテンツの取得
        const contents = await fetchContentWithExa(urls, roleModelId);
        
        // 検索結果にコンテンツを追加
        contents.forEach((content, i) => {
          if (i < data.results.length) {
            data.results[i].text = content.text || data.results[i].text;
          }
        });
      } catch (error) {
        console.error('コンテンツ取得エラー:', error);
        
        // エラー通知
        if (roleModelId) {
          sendProgressUpdate(roleModelId, 100, {
            type: 'error',
            message: 'コンテンツ取得中にエラーが発生しました'
          });
        }
      }
    }

    // 簡易サマリーの生成
    let summary = `検索クエリ「${options.query}」に対する結果:\n\n`;
    summary += data.results.slice(0, 5).map((r, i) => 
      `${i+1}. ${r.title} - ${r.url.substring(0, 100)}${r.url.length > 100 ? '...' : ''}`
    ).join('\n');

    // 進捗更新
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 70, '検索完了、結果を処理中...');
    }

    return {
      sources: data.results,
      summary
    };
  } catch (error) {
    console.error('Exa検索エラー:', error);
    
    // エラー通知
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 100, {
        type: 'error',
        message: '検索処理中にエラーが発生しました'
      });
    }
    
    return { sources: [], summary: '' };
  }
}

/**
 * Exa検索APIを使用してコンテンツを取得する
 * @param urls 取得するURLのリスト
 * @param roleModelId ロールモデルID (WebSocket通信用)
 * @returns 取得したコンテンツ
 */
export async function fetchContentWithExa(
  urls: string[],
  roleModelId?: string
): Promise<{url: string; text: string}[]> {
  try {
    // Exa API Key の取得
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      console.error('EXA_API_KEY is not defined in environment variables');
      
      // エラー通知
      if (roleModelId) {
        sendProgressUpdate(roleModelId, 100, {
          type: 'error',
          message: 'Exa API Keyが設定されていません'
        });
      }
      
      return [];
    }

    // 進捗更新
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 40, 'コンテンツを取得中...');
    }

    // デバッグログ：コンテンツ取得リクエスト情報
    console.log(`Exaコンテンツ取得実行: URLs=${urls.length}件`);
    console.log('URLs:', urls);
    
    // Exa API へのリクエスト
    const response = await fetch('https://api.exa.ai/contents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ urls })
    });

    // レスポンスのチェック
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Exa API error: ${response.status} - ${errorText}`);
      
      // エラー通知
      if (roleModelId) {
        sendProgressUpdate(roleModelId, 100, {
          type: 'error',
          message: `コンテンツ取得APIエラー: ${response.status}`
        });
      }
      
      return [];
    }

    // JSONレスポンスのパース
    const contents = await response.json() as {url: string; text: string}[];
    
    // 進捗更新
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 60, 'コンテンツの取得完了');
    }
    
    return contents;
  } catch (error) {
    console.error('Exaコンテンツ取得エラー:', error);
    
    // エラー通知
    if (roleModelId) {
      sendProgressUpdate(roleModelId, 100, {
        type: 'error',
        message: 'コンテンツ取得中にエラーが発生しました'
      });
    }
    
    return [];
  }
}

/**
 * 情報収集プランに基づいた検索を実行し、結果を処理する
 * @param plan 情報収集プラン (タイトル、キーワード等を含む)
 * @param roleModelId ロールモデルID
 */
export async function executeSearchForCollectionPlan(
  plan: any,
  roleModelId: string
): Promise<{
  sources: ExaSearchResult[];
  summary: string;
}> {
  try {
    // プランからクエリを構築
    const primaryKeywords = plan.strategy?.primaryKeywords || [];
    const secondaryKeywords = plan.strategy?.secondaryKeywords || [];
    
    // キーワードが空の場合はタイトルを使用
    const query = primaryKeywords.length > 0 
      ? primaryKeywords.join(' ') + (secondaryKeywords.length > 0 ? ' ' + secondaryKeywords.join(' ') : '')
      : plan.title;
    
    // 検索オプションの設定
    const searchOptions: ExaSearchOptions = {
      query,
      numResults: 20,
      highlights: true,
      useAutoprompt: true,
      maxDocuments: 10,
      type: 'hybrid'
    };
    
    // Exa検索を実行
    const results = await searchWithExa(searchOptions, roleModelId);
    
    // 実行IDの生成（ソースとサマリーの紐付けに使用）
    const executionId = uuidv4();
    
    // 検索結果をDBに保存（既にcrewAIサービス側で行われている場合は不要）
    if (plan.collectionPlanId && results.sources.length > 0) {
      try {
        await Promise.all(results.sources.map(async (source) => {
          await db.insert(collectionSources).values({
            collectionPlanId: plan.collectionPlanId,
            executionId,
            title: source.title,
            url: source.url,
            content: source.text,
            relevanceScore: source.score || 0,
            toolUsed: 'exa_search',
            metadata: { highlights: source.highlights }
          });
        }));
        
        // サマリーの保存
        await db.insert(collectionSummaries).values({
          collectionPlanId: plan.collectionPlanId,
          executionId,
          title: `${plan.title} - 検索結果サマリー`,
          content: results.summary,
          keyTopics: primaryKeywords,
          sourceIds: results.sources.map(s => s.id),
          aiProcessLog: JSON.stringify({
            completedAt: new Date().toISOString(),
            processSteps: ['search']
          })
        });
      } catch (dbError) {
        console.error('検索結果保存エラー:', dbError);
      }
    }
    
    return results;
  } catch (error) {
    console.error('検索実行エラー:', error);
    
    // エラー通知
    sendProgressUpdate(roleModelId, 100, {
      type: 'error',
      message: '検索実行中にエラーが発生しました'
    });
    
    return { sources: [], summary: '' };
  }
}