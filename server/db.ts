import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

// 環境変数からデータベース接続情報を取得
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 接続プールの安定性を向上させる設定
  max: 20, // 最大接続数
  idleTimeoutMillis: 30000, // アイドル状態の接続を閉じるまでの時間（30秒）
  connectionTimeoutMillis: 5000, // 接続タイムアウト（5秒）
});

// 接続テスト
pool.connect()
  .then(() => console.log('データベース接続に成功しました'))
  .catch(err => console.error('データベース接続に失敗しました:', err));

// Drizzle ORM インスタンスの作成
export const db = drizzle(pool, { schema });