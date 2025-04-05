import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

// 環境変数からデータベース接続情報を取得
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 接続テスト
pool.connect()
  .then(() => console.log('データベース接続に成功しました'))
  .catch(err => console.error('データベース接続に失敗しました:', err));

// Drizzle ORM インスタンスの作成
export const db = drizzle(pool, { schema });