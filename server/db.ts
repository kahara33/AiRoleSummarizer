import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

// データベース接続の再試行機能を設定
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

// PostgreSQLプールのシングルトンインスタンス
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 接続プールの安定性を向上させる設定
  max: 10, // 同時実行可能な接続数
  min: 2,  // 常に維持する最小接続数
  idleTimeoutMillis: 30000, // アイドル状態の接続を閉じるまでの時間（30秒）
  connectionTimeoutMillis: 15000, // 接続タイムアウト（15秒）
  // クライアントを自動的に再接続させる
  allowExitOnIdle: true,
  // 接続エラー時に自動的に再接続を試みる
  keepAlive: true
});

// エラー発生時のログ記録
pool.on('error', (err: Error) => {
  console.error('予期せぬデータベースエラーが発生しました:', err);
  // クリティカルなエラーでもアプリケーションをクラッシュさせないよう、ここではエラーを処理するのみ
});

// 再試行ロジックを含む接続テスト
async function testConnection() {
  let retries = 0;
  let lastError;

  while (retries < MAX_RETRIES) {
    const client = await pool.connect().catch(err => {
      console.error(`データベース接続試行 ${retries + 1}/${MAX_RETRIES} 失敗:`, err);
      lastError = err;
      return null;
    });

    if (!client) {
      // バックオフ時間を計算（指数関数的に増加）
      const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      console.log(`${backoffTime}ms後に再試行します...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      retries++;
      continue;
    }

    try {
      await client.query('SELECT 1');
      console.log('データベース接続に成功しました');
      client.release();
      return; // 成功したら終了
    } catch (err) {
      console.error(`クエリ実行試行 ${retries + 1}/${MAX_RETRIES} 失敗:`, err);
      lastError = err;
      client.release();
      
      // バックオフ時間を計算（指数関数的に増加）
      const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      console.log(`${backoffTime}ms後に再試行します...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      retries++;
    }
  }
  
  console.error(`最大試行回数(${MAX_RETRIES})に達しました。データベース接続に失敗しました:`, lastError);
}

// 接続テストを実行
testConnection();

// Drizzle ORM インスタンスの作成
export const db = drizzle(pool, { schema });