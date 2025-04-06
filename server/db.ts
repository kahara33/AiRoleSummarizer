import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

// 環境変数からデータベース接続情報を取得
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 接続プールの安定性を向上させる設定
  max: 5, // 最大接続数をさらに減らして安定性を向上
  idleTimeoutMillis: 10000, // アイドル状態の接続を閉じるまでの時間（10秒）
  connectionTimeoutMillis: 10000, // 接続タイムアウト（10秒）に延長
  // クライアントを自動的に再接続させる
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