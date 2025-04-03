const crypto = require('crypto');
const { promisify } = require('util');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { neon } = require('@neondatabase/serverless');
const { users } = require('./shared/schema');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createAdminUser() {
  // データベース接続
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  
  // パスワードをハッシュ化
  const hashedPassword = await hashPassword('3Bdf902@5155');
  
  try {
    // ユーザーが既に存在するか確認
    const existingUser = await db.select().from(users).where(eq(users.email, 'k.harada@everys.jp'));
    
    if (existingUser.length > 0) {
      console.log('管理者ユーザーは既に存在します');
      return;
    }
    
    // 新しい管理者ユーザーを作成
    const newUser = {
      email: 'k.harada@everys.jp',
      name: '原田一樹',
      password: hashedPassword
    };
    
    await db.insert(users).values(newUser);
    console.log('管理者ユーザーが正常に作成されました');
  } catch (error) {
    console.error('管理者ユーザーの作成中にエラーが発生しました:', error);
  }
}

createAdminUser();