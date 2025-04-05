import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

// 環境変数からデータベース接続情報を取得
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 接続プールの安定性を向上させる設定
  max: 10, // 最大接続数を減らして安定性を向上
  idleTimeoutMillis: 30000, // アイドル状態の接続を閉じるまでの時間（30秒）
  connectionTimeoutMillis: 5000, // 接続タイムアウト（5秒）
  // エラーが発生した接続を自動的に新しい接続に置き換える
  allowExitOnIdle: true
});

// エラー発生時のログ記録
pool.on('error', (err) => {
  console.error('予期せぬデータベースエラーが発生しました:', err);
  // クリティカルなエラーでもアプリケーションをクラッシュさせないよう、ここではエラーを処理するのみ
});

// 接続テスト - 明示的にクライアントを取得・解放して接続をテスト
async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('データベース接続に成功しました');
  } catch (err) {
    console.error('データベース接続に失敗しました:', err);
  } finally {
    client.release();
  }
}

// 接続テストを実行
testConnection();

// Drizzle ORM インスタンスの作成
export const db = drizzle(pool, { schema });