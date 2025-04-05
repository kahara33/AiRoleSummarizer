import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { registerRoutes } from './routes';
import { db } from './db';
import { users, organizations, companies } from '@shared/schema';
import { hashPassword } from './auth';
import { closeNeo4j } from './neo4j';
import { eq, or } from 'drizzle-orm';

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

// サーバーの開始
async function startServer() {
  try {
    // ルートの登録
    const server = await registerRoutes(app);
    
    // 初期管理者ユーザーの作成
    await initializeAdminUser();
    
    // サーバーの起動
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
      console.log(`サーバーがポート ${PORT} で起動しました`);
    });
    
    // プロセス終了時のクリーンアップ
    process.on('SIGINT', async () => {
      console.log('サーバーをシャットダウンしています...');
      
      // Neo4j接続のクローズ
      await closeNeo4j();
      
      // サーバーの終了
      server.close(() => {
        console.log('サーバーをシャットダウンしました');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

// サーバー起動
startServer();