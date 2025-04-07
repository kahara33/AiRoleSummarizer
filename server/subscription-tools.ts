import { db } from './db';
import { eq } from 'drizzle-orm';

// サブスクリプションプランごとに利用可能なツールのマッピング
const SUBSCRIPTION_TOOLS_MAP: Record<string, string[]> = {
  'lite': [
    'google_search',
    'web_scraping',
    'rss_feeds'
  ],
  'standard': [
    'google_search',
    'web_scraping',
    'rss_feeds',
    'social_media_analysis',
    'video_platforms'
  ],
  'premium': [
    'google_search',
    'web_scraping',
    'rss_feeds',
    'social_media_analysis',
    'video_platforms',
    'academic_databases',
    'industry_reports'
  ]
};

// デフォルトのプラン (非サブスクライバー用)
const DEFAULT_PLAN = 'lite';

/**
 * ユーザーのサブスクリプションプランに基づいて利用可能なツールを取得
 * @param userId ユーザーID
 * @returns 利用可能なツールのリスト
 */
export async function getUserSubscriptionTools(userId: string): Promise<string[]> {
  // 現段階では定型の結果を返す（プランシステム未実装のため）
  console.log(`ユーザー ${userId} にはデフォルトプラン(${DEFAULT_PLAN})を使用します`);
  return SUBSCRIPTION_TOOLS_MAP[DEFAULT_PLAN];
  
  /* TODO: サブスクリプションシステム実装後に有効化
  try {
    // ユーザーのアクティブなサブスクリプションを取得
    const userSubscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
      with: {
        plan: true
      }
    });

    // サブスクリプションがない場合はデフォルトプランを使用
    if (!userSubscription || !userSubscription.plan) {
      console.log(`ユーザー ${userId} の有効なサブスクリプションが見つかりませんでした。デフォルトプラン (${DEFAULT_PLAN}) を使用します。`);
      return SUBSCRIPTION_TOOLS_MAP[DEFAULT_PLAN];
    }

    // サブスクリプションプランに基づいてツールを返す
    const planName = userSubscription.plan.name.toLowerCase();
    const tools = SUBSCRIPTION_TOOLS_MAP[planName] || SUBSCRIPTION_TOOLS_MAP[DEFAULT_PLAN];
    
    console.log(`ユーザー ${userId} のプラン: ${planName}, 利用可能ツール: ${tools.join(', ')}`);
    return tools;
  } catch (error) {
    console.error(`ユーザーのサブスクリプションツール取得エラー: ${error}`);
    // エラー時はデフォルトプランを返す
    return SUBSCRIPTION_TOOLS_MAP[DEFAULT_PLAN];
  }
  */
}

/**
 * デフォルトのサブスクリプションプランをセットアップ
 * 新規インストール時に呼び出す
 */
export async function setupDefaultSubscriptionPlans(): Promise<void> {
  console.log('サブスクリプションプランのセットアップスキップ（機能未実装）');
  return;
  
  /* TODO: サブスクリプションシステム実装後に有効化
  try {
    // 既存のプランをチェック
    const existingPlans = await db.query.subscriptionPlans.findMany();
    if (existingPlans.length > 0) {
      console.log('サブスクリプションプランは既に設定されています');
      return;
    }

    // デフォルトプランを作成
    const defaultPlans = [
      {
        name: 'lite',
        description: 'ウェブ検索・スクレイピング・RSSフィードを含む基本的な情報収集ツールを提供します',
        price: 0,
        features: JSON.stringify([
          'Google検索',
          'Webスクレイピング', 
          'RSSフィード'
        ])
      },
      {
        name: 'standard',
        description: '基本ツールに加え、ソーシャルメディア分析と動画プラットフォーム統合を提供します',
        price: 2000,
        features: JSON.stringify([
          'Liteプランの全機能',
          'ソーシャルメディア分析',
          '動画プラットフォーム統合'
        ])
      },
      {
        name: 'premium',
        description: '最も包括的な情報収集体験。学術データベースと業界レポートアクセスを含む全機能を提供します',
        price: 5000,
        features: JSON.stringify([
          'Standardプランの全機能',
          '学術データベースアクセス',
          '業界レポートアクセス',
          'カスタム情報収集ワークフロー'
        ])
      }
    ];

    // データベースに挿入
    await db.insert(subscriptionPlans).values(defaultPlans);
    console.log('デフォルトのサブスクリプションプランが作成されました');
  } catch (error) {
    console.error('サブスクリプションプラン設定エラー:', error);
  }
  */
}

/**
 * ユーザーのサブスクリプションを更新または作成
 * @param userId ユーザーID
 * @param planName プラン名
 */
export async function assignUserSubscription(userId: string, planName: string): Promise<void> {
  console.log(`ユーザー ${userId} にプラン "${planName}" を割り当てようとしましたが、機能は未実装です`);
  return;
  
  /* TODO: サブスクリプションシステム実装後に有効化
  try {
    // プランの存在を確認
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, planName)
    });

    if (!plan) {
      throw new Error(`プラン "${planName}" が見つかりません`);
    }

    // 既存のサブスクリプションをチェック
    const existingSubscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId)
    });

    if (existingSubscription) {
      // 既存のサブスクリプションを更新
      await db
        .update(userSubscriptions)
        .set({
          planId: plan.id,
          updatedAt: new Date()
        })
        .where(eq(userSubscriptions.id, existingSubscription.id));
    } else {
      // 新しいサブスクリプションを作成
      await db.insert(userSubscriptions).values({
        userId,
        planId: plan.id
      });
    }

    console.log(`ユーザー ${userId} にプラン "${planName}" を割り当てました`);
  } catch (error) {
    console.error('ユーザーサブスクリプション割り当てエラー:', error);
    throw error;
  }
  */
}