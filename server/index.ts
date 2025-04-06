import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { registerRoutes } from './routes';
import { db, pool } from './db';
import { users, organizations, companies } from '@shared/schema';
import { hashPassword } from './auth';
import { closeNeo4j } from './neo4j';
import { eq, or } from 'drizzle-orm';
import { setupVite } from './vite';

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
      
      // 会社の追加
      let companyId: string;
      const existingCompany = await db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.name, 'EVERYS'),
      });
      
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const [company] = await db.insert(companies)
          .values({
            id: 'cab10e27-6ece-4aea-951b-c28b1db39838',  // UUID for EVERYS
            name: 'EVERYS',
            description: 'EVERYSは自律型情報収集サービスを提供する組織です。',
          })
          .returning({ id: companies.id });
        
        companyId = company.id;
      }
      
      // 管理者ユーザーの追加
      const hashedPassword = await hashPassword('3Bdf902@5155');
      
      await db.insert(users)
        .values({
          name: 'K. Harada',
          password: hashedPassword,
          email: 'k.harada@everys.jp',
          role: 'admin',
          companyId: companyId,
        });
      
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
    
    // ルートの登録
    const server = await registerRoutes(app);
    
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
    const PORT = process.env.PORT || 5000;
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