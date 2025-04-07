import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { registerRoutes } from './routes';
import { db, pool } from './db';
import { users, organizations } from '@shared/schema';
import { hashPassword } from './auth';
import { closeNeo4j } from './neo4j';
import { eq, or } from 'drizzle-orm';
import { setupVite } from './vite';
import { setupWebSocketServer } from './websocket/ws-server-setup';

// Express アプリケーションの初期化
const app = express();

// ミドルウェアの設定
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// CORS設定（開発時のみ必要）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// 初期管理者ユーザーの作成
async function initializeAdminUser() {
  try {
    // 管理者ユーザーが存在するか確認
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.role, 'admin'),
    });
    
    if (!existingAdmin) {
      console.log('管理者ユーザーが存在しないため、初期管理者を作成します');
      
      // 組織の追加
      let organizationId: string;
      try {
        // 組織テーブルのカラム構造を確認
        const organizations_columns = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'organizations'
        `);
        console.log('組織テーブルのカラム構造:', organizations_columns.rows);
        
        const existingOrganization = await db.query.organizations.findFirst({
          where: (organizations, { eq }) => eq(organizations.name, 'EVERYS'),
        });
        
        if (existingOrganization) {
          organizationId = existingOrganization.id;
        } else {
          // 実際のテーブル構造に合わせたクエリ
          const insertResult = await pool.query(`
            INSERT INTO organizations (name, description) 
            VALUES ('EVERYS', 'EVERYSは自律型情報収集サービスを提供する組織です。')
            RETURNING id
          `);
          organizationId = insertResult.rows[0].id;
        }
      } catch (error) {
        console.error('組織追加エラー:', error);
        throw error;
      }
      
      // 管理者ユーザーの追加
      try {
        // ユーザーテーブルのカラム構造を確認
        const users_columns = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'users'
        `);
        console.log('ユーザーテーブルのカラム構造:', users_columns.rows);
        
        // 既存のユーザーを確認
        const existingUser = await pool.query(`
          SELECT * FROM users WHERE email = 'k.harada@everys.jp'
        `);
        
        if (existingUser.rows.length > 0) {
          console.log('管理者ユーザーは既に存在します');
          return;
        }
        
        const hashedPassword = await hashPassword('3Bdf902@5155');
        
        // organizationIdがUUID形式であることを確認
        console.log('組織ID:', organizationId);
        
        // 実際のテーブル構造に合わせたクエリ (company_idをNULLに設定)
        await pool.query(`
          INSERT INTO users (name, email, password, role) 
          VALUES ('K. Harada', 'k.harada@everys.jp', $1, 'admin')
        `, [hashedPassword]);
        
        console.log('管理者ユーザーを作成しました（会社IDなし）');
        
        // 後でこのユーザーに正しい会社IDを設定することを推奨
        console.log('注: 管理者ユーザーに会社IDが設定されていません。適切なUUID値で更新することを推奨します。');
      } catch (error) {
        console.error('管理者ユーザー追加エラー:', error);
        throw error;
      }
      
      console.log('初期管理者ユーザーを作成しました');
    }
  } catch (error) {
    console.error('初期管理者ユーザー作成エラー:', error);
  }
}

// プロセス終了時のクリーンアップ関数
async function gracefulShutdown(signal: string, server: any) {
  console.log(`${signal} シグナルを受信しました。サーバーをシャットダウンしています...`);
  
  // シャットダウンタイムアウト (10秒後に強制終了)
  const shutdownTimeout = setTimeout(() => {
    console.error('シャットダウンがタイムアウトしました。強制終了します...');
    process.exit(1);
  }, 10000);
  
  try {
    // Neo4j接続のクローズ
    await Promise.race([
      closeNeo4j(),
      new Promise(resolve => setTimeout(() => {
        console.warn('Neo4j接続のクローズがタイムアウトしました');
        resolve(null);
      }, 3000))
    ]);
    
    // PostgreSQL接続プールのクローズ
    await Promise.race([
      pool.end(),
      new Promise(resolve => setTimeout(() => {
        console.warn('PostgreSQL接続プールのクローズがタイムアウトしました');
        resolve(null);
      }, 3000))
    ]);
    console.log('データベース接続を終了しました');
  } catch (err) {
    console.error('リソース解放エラー:', err);
  }
  
  // サーバーの終了
  server.close(() => {
    console.log('サーバーをシャットダウンしました');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });
}

// 開発環境設定
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'development';
  console.log('開発環境として実行中');
}

// サーバーの開始
async function startServer() {
  try {
    // データベース接続テストの実行（明示的に確認）
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('データベース接続に成功しました');
    } catch (error) {
      console.error('データベース接続テストエラー:', error);
      console.log('アプリケーションは続行しますが、データベース機能が制限される可能性があります');
    }
    
    // WebSocketサーバーのセットアップ
    const httpServer = setupWebSocketServer(app);
    
    // ルートの登録
    const server = await registerRoutes(app, httpServer);
    
    // 開発環境でViteのセットアップ
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    }
    
    // 初期管理者ユーザーの作成を試みる（エラーでもアプリ起動は継続）
    try {
      await initializeAdminUser();
    } catch (error) {
      console.error('管理者ユーザー初期化エラー:', error);
      console.log('管理者ユーザーの初期化に失敗しましたが、アプリケーションは続行します');
    }
    
    // サーバーの起動
    const PORT = parseInt(process.env.PORT || '5000', 10);
    const HOST = '0.0.0.0'; // すべてのネットワークインターフェイスにバインド
    
    server.listen(PORT, HOST, () => {
      console.log(`サーバーが ${HOST}:${PORT} で起動しました`);
    });
    
    // プロセス終了時のクリーンアップ
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP', server));
    
    // 未処理の例外/Promiseリジェクションの処理
    process.on('uncaughtException', (error) => {
      console.error('未処理の例外:', error);
      // クリティカルな例外の場合はシャットダウン
      gracefulShutdown('UNCAUGHT_EXCEPTION', server);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未処理のPromiseリジェクション:', reason);
      // ここではアプリケーションをクラッシュさせないが、ログに記録する
    });
    
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

// サーバー起動
startServer();